
import {
    AccumulatePass, auxiliaries, BlitPass, Camera, Context, DefaultFramebuffer, Framebuffer, Invalidate,
    MouseEventProvider, NdcFillingTriangle, Program, Renderbuffer, Renderer, Shader, Texture2,
} from 'webgl-operate';

import { vec3, vec4 } from 'gl-matrix';

// scene data
import { colors, indices, vertices } from './scene';

// helper functions
import { pointsOnSphere } from './icosphere';
import { pointsInLight } from './light';


// camera constants
const _gEye = vec3.fromValues(
    +0.000000, -0.005102, -3.861230);
const _gCenter = vec3.fromValues(
    +0.000000, -0.000000, +0.000000);
const _gUp = vec3.fromValues(
    +0.000000, +1.000000, +0.000000);
const _gFovy = 37.0;


export class CornellRenderer extends Renderer {

    protected _extensions = false;

    // stuff
    protected _camera: Camera;
    protected _ndcTriangle: NdcFillingTriangle;

    // program and uniforms
    protected _program: Program;
    protected _uTransform: WebGLUniformLocation;

    protected _uFrame: WebGLUniformLocation;
    protected _uRand: WebGLUniformLocation;
    protected _uEye: WebGLUniformLocation;
    protected _uViewport: WebGLUniformLocation;

    // Textures
    protected _verticesImage: Texture2;
    protected _indicesImage: Texture2;
    protected _colorsImage: Texture2;

    protected _hsphereImage: Texture2;
    protected _lightsImage: Texture2;

    // blit and accumulate
    protected _accumulate: AccumulatePass;
    protected _blit: BlitPass;

    protected _defaultFBO: DefaultFramebuffer;
    protected _colorRenderTexture: Texture2;
    protected _depthRenderbuffer: Renderbuffer;
    protected _intermediateFBO: Framebuffer;


    protected onUpdate(): boolean {

        const angle = ((window.performance.now() * 0.01) % 360) * auxiliaries.DEG2RAD;
        const radius = vec3.len(_gEye);
        this._camera.eye = vec3.fromValues(radius * Math.sin(angle), 0.0, radius * Math.cos(angle));

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

        } else if (this._altered.frameSize) {
            this._intermediateFBO.resize(this._frameSize[0], this._frameSize[1]);
        }

        if (this._altered.clearColor) {
            this._intermediateFBO.clearColor(this._clearColor);
        }

        this._accumulate.update();


        if (this._camera.altered) {
            this._program.bind();

            gl.uniformMatrix4fv(this._uTransform, gl.GL_FALSE, this._camera.viewProjectionInverse);
            gl.uniform1i(this._uRand, Math.floor(Math.random() * 1e6));
            gl.uniform3fv(this._uEye, this._camera.eye);
            gl.uniform4f(this._uViewport,
                this._camera.viewport[0],
                this._camera.viewport[1],
                1.0 / this._camera.viewport[0],
                1.0 / this._camera.viewport[1]);
        }

        this._altered.reset();
    }

    protected onFrame(frameNumber: number): void {
        const gl = this._context.gl;

        gl.viewport(0, 0, this._frameSize[0], this._frameSize[1]);
        this._camera.viewport = [this._frameSize[0], this._frameSize[1]];

        this._intermediateFBO.bind();
        this._intermediateFBO.clear(gl.COLOR_BUFFER_BIT, false, false);

        // set uniforms
        this._program.bind();
        gl.uniform1i(this._uFrame, frameNumber);

        this._verticesImage.bind(gl.TEXTURE0);
        this._indicesImage.bind(gl.TEXTURE1);
        this._colorsImage.bind(gl.TEXTURE2);

        this._hsphereImage.bind(gl.TEXTURE3);
        this._lightsImage.bind(gl.TEXTURE4);

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
        this._camera.fovy = _gFovy;

        // program
        const vert = new Shader(this._context, gl.VERTEX_SHADER, 'cornell.vert');
        vert.initialize(require('./cornell.vert'));
        const frag = new Shader(this._context, gl.FRAGMENT_SHADER, 'cornell.frag');
        frag.initialize(require('./cornell.frag'));
        this._program = new Program(this._context);
        this._program.initialize([vert, frag]);

        // uniforms
        this._uTransform = this._program.uniform('u_transform');
        this._uFrame = this._program.uniform('u_frame');
        this._uRand = this._program.uniform('u_rand');
        this._uEye = this._program.uniform('u_eye');
        this._uViewport = this._program.uniform('u_viewport');

        this._program.bind();
        gl.uniform1i(this._program.uniform('u_vertices'), 0);
        gl.uniform1i(this._program.uniform('u_indices'), 1);
        gl.uniform1i(this._program.uniform('u_colors'), 2);
        gl.uniform1i(this._program.uniform('u_hsphere'), 3);
        gl.uniform1i(this._program.uniform('u_lights'), 4);
        this._program.unbind();

        // triangle
        this._ndcTriangle = new NdcFillingTriangle(this._context);
        const aVertex = this._program.attribute('a_vertex', 0);
        this._ndcTriangle.initialize(aVertex);

        // scene textures
        this._verticesImage = new Texture2(this._context, 'verticesImage');
        this._verticesImage.initialize(vertices.length / 3, 1, gl.RGB32F, gl.RGB, gl.FLOAT); // height 1
        this._verticesImage.data(vertices);
        this._verticesImage.wrap(gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE);
        this._verticesImage.filter(gl.NEAREST, gl.NEAREST);

        this._indicesImage = new Texture2(this._context, 'indicesImage');
        this._indicesImage.initialize(indices.length / 4, 1, gl.RGBA8UI, gl.RGBA_INTEGER, gl.UNSIGNED_BYTE); // height 1
        this._indicesImage.data(indices);
        this._indicesImage.wrap(gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE);
        this._indicesImage.filter(gl.NEAREST, gl.NEAREST);

        this._colorsImage = new Texture2(this._context, 'colorsImage');
        this._colorsImage.initialize(colors.length / 4
            , 1, gl.RGBA32F, gl.RGBA, gl.FLOAT); // height 1
        this._colorsImage.data(colors);
        this._colorsImage.wrap(gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE);
        this._colorsImage.filter(gl.NEAREST, gl.NEAREST);

        // CREATE HEMISPHERE PATH SAMPLES
        const points = pointsOnSphere(16384);
        const samplerSize = Math.floor(Math.sqrt(points.length));
        const spherePoints = new Float32Array(samplerSize * samplerSize * 3);
        for (let i = 0; i < samplerSize * samplerSize; ++i) {
            spherePoints[3 * i + 0] = points[i][0];
            spherePoints[3 * i + 1] = points[i][1];
            spherePoints[3 * i + 2] = points[i][2];
        }
        this._hsphereImage = new Texture2(this._context, 'hsphereImage');
        this._hsphereImage.initialize(samplerSize, samplerSize, gl.RGB32F, gl.RGB, gl.FLOAT);
        this._hsphereImage.data(spherePoints);
        this._hsphereImage.wrap(gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE);
        this._hsphereImage.filter(gl.NEAREST, gl.NEAREST);

        // CREATE LIGHT AREA SAMPLES
        const l1 = vec3.fromValues(vertices[0], vertices[1], vertices[2]);
        const l2 = vec3.fromValues(vertices[6], vertices[7], vertices[8]);
        const lights = pointsInLight(l1, l2, 32 * 32);
        const lights2 = new Float32Array(lights.length * 3);
        let i2 = 0;
        for (const light of lights) {
            lights2[i2++] = light[0];
            lights2[i2++] = light[1];
            lights2[i2++] = light[2];
        }
        this._lightsImage = new Texture2(this._context, 'lightsImage');
        this._lightsImage.initialize(32, 32, gl.RGB32F, gl.RGB, gl.FLOAT);
        this._lightsImage.data(lights2);
        this._lightsImage.wrap(gl.CLAMP_TO_EDGE, gl.CLAMP_TO_EDGE);
        this._lightsImage.filter(gl.NEAREST, gl.NEAREST);

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

        this._verticesImage.uninitialize();
        this._indicesImage.uninitialize();
        this._colorsImage.uninitialize();
        this._hsphereImage.uninitialize();
        this._lightsImage.uninitialize();

        this._intermediateFBO.uninitialize();
        this._defaultFBO.uninitialize();
        this._colorRenderTexture.uninitialize();
        this._depthRenderbuffer.uninitialize();

        this._blit.uninitialize();
    }

}
