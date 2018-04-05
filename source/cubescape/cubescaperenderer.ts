
import { vec3 } from 'gl-matrix';

import {
    BlitPass, Camera, Context, DefaultFramebuffer, EventHandler, Framebuffer, Invalidate,
    MouseEventProvider, Navigation, Program, Renderbuffer, Renderer, Shader, Texture2, Wizard,
} from 'webgl-operate';

import { Cube } from './cube';


// camera constants
const _gEye = vec3.fromValues(0.2, 0.8, -2.0);
const _gCenter = vec3.fromValues(0.0, -1.2, 0.0);
const _gUp = vec3.fromValues(0.0, 1.0, 0.0);


export class CubescapeRenderer extends Renderer {

    protected _extensions = false;

    // FBO and Blit
    protected _defaultFBO: DefaultFramebuffer;
    protected _colorRenderTexture: Texture2;
    protected _depthRenderbuffer: Renderbuffer;
    protected _intermediateFBO: Framebuffer;
    protected _blit: BlitPass;

    // camera
    protected _camera: Camera;
    protected _navigation: Navigation;

    // cubes
    protected _cube: Cube;
    protected _program: Program;
    protected _uViewProjection: WebGLUniformLocation;
    protected _aVertex: GLuint;
    protected _numCubes = 64;

    // skyBox and skyTriangle use the same cubeMap
    protected _patches: Texture2;
    protected _terrain: Texture2;

    protected _eventHandler: EventHandler;


    protected onUpdate(): boolean {

        this._navigation.update();
        this._eventHandler.update();

        return this._altered.any || this._camera.altered;
    }

    protected onPrepare(): void {

        // resize
        if (this._altered.frameSize) {
            this._intermediateFBO.resize(this._frameSize[0], this._frameSize[1]);
            this._camera.viewport = [this._frameSize[0], this._frameSize[1]];
        }
        if (this._altered.canvasSize) {
            this._camera.aspect = this._canvasSize[0] / this._canvasSize[1];
        }

        // update clear color
        if (this._altered.clearColor) {
            this._intermediateFBO.clearColor(this._clearColor);
        }

        this._altered.reset();
    }

    protected onFrame(frameNumber: number): void {
        const gl = this._context.gl;

        // bind FBO
        this._intermediateFBO.bind();
        this._intermediateFBO.clear(gl.COLOR_BUFFER_BIT | gl.DEPTH_BUFFER_BIT, false, false);

        gl.viewport(0, 0, this._frameSize[0], this._frameSize[1]);

        gl.enable(gl.CULL_FACE);
        gl.cullFace(gl.BACK);
        gl.enable(gl.DEPTH_TEST);

        this._program.bind();
        gl.uniformMatrix4fv(this._uViewProjection, gl.GL_FALSE, this._camera.viewProjection);
        gl.uniform1i(this._program.uniform('u_numcubes'), this._numCubes);
        gl.uniform1f(this._program.uniform('u_time'), window.performance.now() * 0.002);
        this._terrain.bind(gl.TEXTURE0);
        this._patches.bind(gl.TEXTURE1);
        gl.uniform1i(this._program.uniform('u_terrain'), 0);
        gl.uniform1i(this._program.uniform('u_patches'), 1);

        this._cube.bind();
        this._cube.numCubes = this._numCubes;
        this._cube.draw();
        this._cube.unbind();

        this._program.unbind();

        gl.cullFace(gl.BACK);
        gl.disable(gl.CULL_FACE);

        // unbind FBO
        this._intermediateFBO.unbind();
    }

    protected onSwap(): void {
        this._blit.frame();
        this.invalidate();
    }

    protected onInitialize(context: Context, callback: Invalidate, mouseEventProvider: MouseEventProvider): boolean {
        const gl = this._context.gl;
        const gl2facade = this._context.gl2facade;

        this._eventHandler = new EventHandler(callback, mouseEventProvider);
        this._eventHandler.pushMouseWheelHandler((latests: Array<WheelEvent>, previous: Array<WheelEvent>) => {
            this._numCubes = this._numCubes + ((latests[latests.length - 1].wheelDeltaY > 0) ? +1 : -1);
            this._numCubes = Math.min(1024, Math.max(8, this._numCubes));
        });

        // load images
        // const internalFormatAndType = Wizard.queryInternalTextureFormat(this._context, gl.RGB, 'byte');
        this._terrain = new Texture2(this._context);
        this._terrain.initialize(64, 64, gl.R8, gl.RED, gl.UNSIGNED_BYTE);
        this._terrain.wrap(gl.REPEAT, gl.REPEAT);
        this._terrain.filter(gl.LINEAR, gl.LINEAR);
        this._terrain.load('data/cubescape-terrain.png');

        this._patches = new Texture2(this._context);
        this._patches.initialize(64, 16, gl.RGB32F, gl.RGB, gl.FLOAT);
        this._patches.wrap(gl.REPEAT, gl.REPEAT);
        this._patches.filter(gl.NEAREST, gl.NEAREST);
        this._patches.load('data/cubescape-patches.png');

        // init program
        const vert = new Shader(this._context, gl.VERTEX_SHADER, 'cube.vert');
        vert.initialize(require('./cube.vert'));
        const frag = new Shader(this._context, gl.FRAGMENT_SHADER, 'cube.frag');
        frag.initialize(require('./cube.frag'));
        this._program = new Program(this._context);
        this._program.initialize([vert, frag]);
        this._aVertex = this._program.attribute('a_vertex', 0);
        this._uViewProjection = this._program.uniform('u_viewProjection');

        // init cube geometry
        this._cube = new Cube(this._context, 'cubes'); // TODO not 16 every time
        this._cube.initialize(this._aVertex);

        // init camera
        this._camera = new Camera();
        this._camera.eye = _gEye;
        this._camera.center = _gCenter;
        this._camera.up = _gUp;
        this._camera.near = 0.1;
        this._camera.far = 4.0;

        this._navigation = new Navigation(callback, mouseEventProvider);
        this._navigation.camera = this._camera;

        // init FBO & BlitPass
        this._defaultFBO = new DefaultFramebuffer(this._context, 'DefaultFBO');
        this._defaultFBO.initialize();
        this._colorRenderTexture = new Texture2(this._context, 'ColorRenderTexture');
        this._colorRenderTexture.initialize(480, 270,
            this._context.isWebGL2 ? gl.RGBA8 : gl.RGBA, gl.RGBA, gl.UNSIGNED_BYTE);
        this._depthRenderbuffer = new Renderbuffer(this._context, 'DepthRenderbuffer');
        this._depthRenderbuffer.initialize(480, 270, gl.DEPTH_COMPONENT16);
        this._intermediateFBO = new Framebuffer(this._context, 'IntermediateFBO');
        this._intermediateFBO.initialize([[gl2facade.COLOR_ATTACHMENT0, this._colorRenderTexture]
            , [gl.DEPTH_ATTACHMENT, this._depthRenderbuffer]]);
        this._blit = new BlitPass(this._context);
        this._blit.initialize();
        this._blit.framebuffer = this._intermediateFBO;
        this._blit.readBuffer = gl2facade.COLOR_ATTACHMENT0;
        this._blit.drawBuffer = gl.BACK;
        this._blit.target = this._defaultFBO;

        return true;
    }

    protected onUninitialize(): void {
        this._cube.uninitialize();

        this._patches.uninitialize();
        this._terrain.uninitialize();

        this._intermediateFBO.uninitialize();
        this._defaultFBO.uninitialize();
        this._colorRenderTexture.uninitialize();
        this._depthRenderbuffer.uninitialize();
        this._blit.uninitialize();
    }

}

