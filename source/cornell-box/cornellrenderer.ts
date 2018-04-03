
import {
    AccumulatePass, AntiAliasingKernel, auxiliaries, BlitPass, Camera, Context, DefaultFramebuffer, Framebuffer,
    Invalidate, MouseEventProvider, NdcFillingTriangle, Program, Renderbuffer, Renderer, Shader, Texture2, Wizard,
} from 'webgl-operate';

import { vec3, vec4 } from 'gl-matrix';

// helper functions
import { encodeFloatArray, encodeFloatArrayAndScale, pointsInLight, pointsOnSphere } from './helper';
import { TrackballNavigation } from './trackballnavigation';

import { colors, indices, vertices } from './cornellbox';


// camera constants
const _gEye = vec3.fromValues(
    +0.000000, +0.005102, -3.861230);
const _gCenter = vec3.fromValues(
    +0.000000, +0.000000, +0.000000);
const _gUp = vec3.fromValues(
    +0.000000, +1.000000, +0.000000);

// corners of axis aligned light cuboid
const light0 = vec3.fromValues(-0.233813, +1 - 2e-2, -0.188126);
const light1 = vec3.fromValues(+0.233813, +1 - 2e-1, +0.187411);


export class CornellRenderer extends Renderer {

    protected _extensions = false;

    // stuff
    protected _camera: Camera;
    protected _navigation: TrackballNavigation;
    protected _ndcTriangle: NdcFillingTriangle;

    // program and uniforms
    protected _program: Program;
    protected _uTransform: WebGLUniformLocation;

    protected _uFrame: WebGLUniformLocation;
    protected _uRand: WebGLUniformLocation;
    protected _uEye: WebGLUniformLocation;
    protected _uViewport: WebGLUniformLocation;

    protected _ndcOffsetKernel: AntiAliasingKernel;
    protected _uNdcOffset: WebGLUniformLocation;

    // Textures
    protected _hsphereImage: Texture2;
    protected _lightsImage: Texture2;

    // blit and accumulate
    protected _accumulate: AccumulatePass;
    protected _blit: BlitPass;

    protected _defaultFBO: DefaultFramebuffer;
    protected _colorRenderTexture: Texture2;
    protected _depthRenderbuffer: Renderbuffer;
    protected _intermediateFBO: Framebuffer;

    // for webgl1
    protected _verticesImage: Texture2;
    protected _indicesImage: Texture2;
    protected _colorsImage: Texture2;

    protected onUpdate(): boolean {

        this._ndcOffsetKernel = new AntiAliasingKernel(this._multiFrameNumber);

        // Update camera navigation (process events)
        this._navigation.update();

        return this._altered.any || this._camera.altered;
    }

    protected onPrepare(): void {

        const gl = this._context.gl;
        const gl2facade = this._context.gl2facade;

        if (!this._intermediateFBO.initialized) {
            this._colorRenderTexture.initialize(this._frameSize[0], this._frameSize[1],
                this._context.isWebGL2 ? gl.RGBA8 : gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE);
            this._depthRenderbuffer.initialize(this._frameSize[0], this._frameSize[1], gl.DEPTH_COMPONENT16);
            this._intermediateFBO.initialize([[gl2facade.COLOR_ATTACHMENT0, this._colorRenderTexture]
                , [gl.DEPTH_ATTACHMENT, this._depthRenderbuffer]]);

        }

        // resize
        if (this._altered.frameSize) {
            this._intermediateFBO.resize(this._frameSize[0], this._frameSize[1]);
            this._camera.viewport = [this._frameSize[0], this._frameSize[1]];
        }
        if (this._altered.canvasSize) {
            this._camera.aspect = this._canvasSize[0] / this._canvasSize[1];
        }

        if (this._altered.clearColor) {
            this._intermediateFBO.clearColor(this._clearColor);
        }

        this._accumulate.update();


        if (this._camera.altered) {
            this._program.bind();

            gl.uniformMatrix4fv(this._uTransform, gl.GL_FALSE, this._camera.viewProjectionInverse);
            gl.uniform3fv(this._uEye, this._camera.eye);
            gl.uniform4f(this._uViewport,
                this._camera.viewport[0],
                this._camera.viewport[1],
                1.0 / this._camera.viewport[0],
                1.0 / this._camera.viewport[1]);
        }

        this._altered.reset();
        this._camera.altered = false;
    }

    protected onFrame(frameNumber: number): void {
        const gl = this._context.gl;

        gl.viewport(0, 0, this._frameSize[0], this._frameSize[1]);
        this._camera.viewport = [this._frameSize[0], this._frameSize[1]];

        this._intermediateFBO.bind();
        this._intermediateFBO.clear(gl.COLOR_BUFFER_BIT, false, false);

        const ndcOffset = this._ndcOffsetKernel.get(frameNumber);
        ndcOffset[0] = 2.0 * ndcOffset[0] / this._frameSize[0];
        ndcOffset[1] = 2.0 * ndcOffset[1] / this._frameSize[1];

        // set uniforms
        this._program.bind();
        gl.uniform1i(this._uFrame, frameNumber);
        gl.uniform1i(this._uRand, Math.floor(Math.random() * 1e6));
        gl.uniform2fv(this._uNdcOffset, ndcOffset);

        this._hsphereImage.bind(gl.TEXTURE0);
        this._lightsImage.bind(gl.TEXTURE1);

        // webgl1
        if (this._context.isWebGL1) {
            this._verticesImage.bind(gl.TEXTURE2);
            this._indicesImage.bind(gl.TEXTURE3);
            this._colorsImage.bind(gl.TEXTURE4);
        }

        // render geometry
        this._ndcTriangle.bind();
        this._ndcTriangle.draw();
        this._ndcTriangle.unbind();

        this._intermediateFBO.unbind();

        this._accumulate.frame(frameNumber);
    }

    protected onSwap(): void {
        this._blit.framebuffer = this._accumulate.framebuffer ?
            this._accumulate.framebuffer : this._blit.framebuffer = this._intermediateFBO;
        this._blit.frame();
    }

    protected onInitialize(context: Context, callback: Invalidate, mouseEventProvider: MouseEventProvider): boolean {
        const gl = this._context.gl;
        const gl2facade = this._context.gl2facade;

        /* Enable required extensions. */

        if (this._extensions === false && this._context.isWebGL1) {
            auxiliaries.assert(this._context.supportsStandardDerivatives,
                `expected OES_standard_derivatives support`);
            /* tslint:disable-next-line:no-unused-expression */
            this._context.standardDerivatives;
            this._extensions = true;
        }

        this._camera = new Camera();
        this._camera.eye = _gEye;
        this._camera.center = _gCenter;
        this._camera.up = _gUp;
        this._camera.near = 0.1;
        this._camera.far = 4.0;

        // Initialize navigation
        this._navigation = new TrackballNavigation(callback, mouseEventProvider);
        this._navigation.camera = this._camera;


        // program
        const vert = new Shader(this._context, gl.VERTEX_SHADER, 'cornell.vert');
        vert.initialize(require('./cornell.vert'));
        const frag = new Shader(this._context, gl.FRAGMENT_SHADER, 'cornell.frag');
        frag.initialize(require(this._context.isWebGL1 ?
            (this._context.supportsTextureFloat ? './cornell1.frag' : './cornell0.frag') :
            './cornell2.frag'));
        this._program = new Program(this._context);
        this._program.initialize([vert, frag]);

        // uniforms
        this._uTransform = this._program.uniform('u_transform');
        this._uFrame = this._program.uniform('u_frame');
        this._uRand = this._program.uniform('u_rand');
        this._uEye = this._program.uniform('u_eye');
        this._uViewport = this._program.uniform('u_viewport');

        this._program.bind();
        gl.uniform1i(this._program.uniform('u_hsphere'), 0);
        gl.uniform1i(this._program.uniform('u_lights'), 1);
        this._program.unbind();

        // triangle
        this._ndcTriangle = new NdcFillingTriangle(this._context);
        const aVertex = this._program.attribute('a_vertex', 0);
        this._ndcTriangle.initialize(aVertex);


        // CREATE HEMISPHERE PATH SAMPLES and LIGHT AREA SAMPLES
        this._hsphereImage = new Texture2(this._context, 'hsphereImage');
        this._lightsImage = new Texture2(this._context, 'lightsImage');

        const points = pointsOnSphere(32 * 32);
        const samplerSize = Math.floor(Math.sqrt(points.length)); // shader expects 32
        const spherePoints = new Float32Array(samplerSize * samplerSize * 3);
        for (let i = 0; i < samplerSize * samplerSize; ++i) {
            spherePoints[3 * i + 0] = points[i][0];
            spherePoints[3 * i + 1] = points[i][1];
            spherePoints[3 * i + 2] = points[i][2];
        }

        const lights = pointsInLight(light0, light1, 32 * 32);
        const lights2 = new Float32Array(lights.length * 3);
        let i2 = 0;
        for (const light of lights) {
            lights2[i2++] = light[0];
            lights2[i2++] = light[1];
            lights2[i2++] = light[2];
        }

        // special case for webgl1 and no float support
        if (this._context.isWebGL1 && !this._context.supportsTextureFloat) {
            this._hsphereImage.initialize(32 * 3, 32, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE);
            this._hsphereImage.data(encodeFloatArrayAndScale(spherePoints));
            this._lightsImage.initialize(32 * 3, 32, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE);
            this._lightsImage.data(encodeFloatArrayAndScale(lights2));
        } else {
            const fnt = Wizard.queryInternalTextureFormat(this._context, gl.RGB, 'float');
            this._hsphereImage.initialize(samplerSize, samplerSize, fnt[0], gl.RGB, fnt[1]);
            this._hsphereImage.data(spherePoints);
            this._lightsImage.initialize(32, 32, fnt[0], gl.RGB, fnt[1]);
            this._lightsImage.data(lights2);
        }

        this._hsphereImage.wrap(gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE);
        this._hsphereImage.filter(gl.NEAREST, gl.NEAREST);
        this._lightsImage.wrap(gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE);
        this._lightsImage.filter(gl.NEAREST, gl.NEAREST);


        // scene textures for webgl1
        if (this._context.isWebGL1) {
            this._program.bind();
            gl.uniform1i(this._program.uniform('u_vertices'), 2);
            gl.uniform1i(this._program.uniform('u_indices'), 3);
            gl.uniform1i(this._program.uniform('u_colors'), 4);
            this._program.unbind();

            this._verticesImage = new Texture2(this._context, 'verticesImage');
            this._indicesImage = new Texture2(this._context, 'indicesImage');
            this._colorsImage = new Texture2(this._context, 'colorsImage');

            this._indicesImage.initialize(indices.length / 4, 1, gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE);
            this._indicesImage.data(indices);

            if (context.supportsTextureFloat) {
                this._verticesImage.initialize(vertices.length / 3, 1, gl.RGB, gl.RGB, gl.FLOAT);
                this._verticesImage.data(vertices);
                this._colorsImage.initialize(colors.length / 3, 1, gl.RGB, gl.RGB, gl.FLOAT);
                this._colorsImage.data(colors);
            } else {
                // no floats => encode float in 3 bytes
                this._verticesImage.initialize(vertices.length / 3 * 3, 1, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE);
                this._verticesImage.data(encodeFloatArrayAndScale(vertices));
                this._colorsImage.initialize(colors.length / 3 * 3, 1, gl.RGB, gl.RGB, gl.UNSIGNED_BYTE);
                this._colorsImage.data(encodeFloatArray(colors));
            }

            this._verticesImage.wrap(gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE);
            this._verticesImage.filter(gl.NEAREST, gl.NEAREST);

            this._indicesImage.wrap(gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE);
            this._indicesImage.filter(gl.NEAREST, gl.NEAREST);

            this._colorsImage.wrap(gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE);
            this._colorsImage.filter(gl.NEAREST, gl.NEAREST);
        }

        // ndc offset for anti-aliasing
        this._uNdcOffset = this._program.uniform('u_ndcOffset');

        // framebuffers, textures, and render buffers
        this._defaultFBO = new DefaultFramebuffer(this._context, 'DefaultFBO');
        this._defaultFBO.initialize();
        this._colorRenderTexture = new Texture2(this._context, 'ColorRenderTexture');
        this._depthRenderbuffer = new Renderbuffer(this._context, 'DepthRenderbuffer');
        this._intermediateFBO = new Framebuffer(this._context, 'IntermediateFBO');

        // accumulation
        this._accumulate = new AccumulatePass(this._context);
        this._accumulate.initialize(this._ndcTriangle);
        this._accumulate.precision = this._framePrecision;
        this._accumulate.texture = this._colorRenderTexture;

        // blit
        this._blit = new BlitPass(this._context);
        this._blit.initialize(this._ndcTriangle);
        this._blit.readBuffer = gl2facade.COLOR_ATTACHMENT0;
        this._blit.drawBuffer = gl.BACK;
        this._blit.target = this._defaultFBO;

        return true;
    }

    protected onUninitialize(): void {
        this._program.uninitialize();
        this._ndcTriangle.uninitialize();

        this._hsphereImage.uninitialize();
        this._lightsImage.uninitialize();

        if (this._context.isWebGL1) {
            this._verticesImage.uninitialize();
            this._indicesImage.uninitialize();
            this._colorsImage.uninitialize();
        }

        this._intermediateFBO.uninitialize();
        this._defaultFBO.uninitialize();
        this._colorRenderTexture.uninitialize();
        this._depthRenderbuffer.uninitialize();

        this._blit.uninitialize();
    }

}
