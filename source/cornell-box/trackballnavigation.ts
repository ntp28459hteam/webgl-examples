
import { mat4, quat, vec2, vec3 } from 'gl-matrix';

import {
    Camera, EventHandler, gl_matrix_extensions, Invalidate, MouseEventProvider, Navigation,
} from 'webgl-operate';


export class TrackballNavigation {

    protected static readonly ROTATE_FACTOR = 0.004;


    /** @see {@link camera} */
    protected _camera: Camera | undefined = undefined;
    protected _reference = new Camera();

    protected _initialPoint: vec2;
    protected _currentPoint: vec2;

    protected _eventHandler: EventHandler;


    // Current interaction mode
    protected _mode: TrackballNavigation.Modes | undefined;


    // Current rotation matrix
    protected _rotation: mat4 = mat4.create();

    // Last recorded mouse position
    // protected _lastPos: vec2;


    constructor(invalidate: Invalidate, mouseEventProvider: MouseEventProvider) {

        /* Create event handler that listens to mouse events. */
        this._eventHandler = new EventHandler(invalidate, mouseEventProvider);

        /* Listen to mouse events. */
        this._eventHandler.pushMouseDownHandler((latests: Array<MouseEvent>, previous: Array<MouseEvent>) =>
            this.onMouseDown(latests, previous));
        this._eventHandler.pushMouseUpHandler((latests: Array<MouseEvent>, previous: Array<MouseEvent>) =>
            this.onMouseUp(latests, previous));
        this._eventHandler.pushMouseMoveHandler((latests: Array<MouseEvent>, previous: Array<MouseEvent>) =>
            this.onMouseMove(latests, previous));
        // this._eventHandler.pushMouseWheelHandler((latests: Array<WheelEvent>, previous: Array<WheelEvent>) =>
        //     this.onWheel(latests, previous));
    }

    protected mode(event: MouseEvent | TouchEvent | KeyboardEvent): TrackballNavigation.Modes | undefined {
        if ((event.type === 'mousedown' || event.type === 'mousemove') && ((event as MouseEvent).buttons & 1)) {
            // Mouse button 1: rotate
            return TrackballNavigation.Modes.Rotate;
        } else if ((event.type === 'mousedown' || event.type === 'mousemove')
            // Mouse button 2: zoom
            && ((event as MouseEvent).buttons & 2)) {
            return TrackballNavigation.Modes.Zoom;
        } else if (event.type === 'wheel') {
            // Mouse wheel: zoom
            return TrackballNavigation.Modes.ZoomStep;
        }

        // Unknown interaction
        return undefined;
    }

    protected onMouseDown(latests: Array<MouseEvent>, previous: Array<MouseEvent>) {
        for (const event of latests) {
            this._mode = this.mode(event);

            switch (this._mode) {
                case TrackballNavigation.Modes.Zoom:
                    // this.startZoom(event);
                    break;

                case TrackballNavigation.Modes.Rotate:
                    this.startRotate(event);
                    break;

                default:
                    break;
            }
        }
    }

    protected onMouseUp(latests: Array<MouseEvent>, previous: Array<MouseEvent>) {
        for (const event of latests) {
            if (undefined === this._mode) {
                return;
            }

            event.preventDefault();
        }
    }

    protected onMouseMove(latests: Array<MouseEvent>, previous: Array<MouseEvent>) {
        for (const event of latests) {
            const modeWasUndefined = (this._mode === undefined);
            this._mode = this.mode(event);

            switch (this._mode) {
                case TrackballNavigation.Modes.Zoom:
                    // modeWasUndefined ? this.startZoom(event) : this.updateZoom(event);
                    break;

                case TrackballNavigation.Modes.Rotate:
                    modeWasUndefined ? this.startRotate(event) : this.updateRotate(event);
                    break;

                default:
                    break;
            }
        }
    }

    // protected onWheel(latests: Array<WheelEvent>, previous: Array<WheelEvent>) {
    //     for (const event of latests) {
    //         this._mode = this.mode(event);

    //         switch (this._mode) {
    //             case TrackballNavigation.Modes.ZoomStep:
    //                 this.applyZoomStep(event);
    //                 break;

    //             default:
    //                 break;
    //         }
    //     }
    // }

    // protected startZoom(event: MouseEvent): void {
    //     // Stop default action for the event
    //     /** @todo does not work, because this is only a copy? */
    //     event.preventDefault();

    //     // Update mouse position
    //     const pos = vec2.fromValues(event.clientX, event.clientY);
    //     this._lastPos = pos;
    // }

    // protected updateZoom(event: MouseEvent): void {
    //     // Stop default action for the event
    //     /** @todo does not work, because this is only a copy? */
    //     event.preventDefault();

    //     // Get mouse position
    //     const pos = vec2.fromValues(event.clientX, event.clientY);

    //     // Update zoom
    //     const deltaY = pos[1] - this._lastPos[1];
    //     this._radius = gl_matrix_extensions.clamp(this._radius + deltaY * 0.01, 1.0, 10.0);

    //     // Update last mouse position
    //     this._lastPos = pos;

    //     // Calculate new camera transformation
    //     this.updateCamera();
    // }

    // protected applyZoomStep(event: WheelEvent): void {
    //     // Stop default action for the event
    //     /** @todo does not work, because this is only a copy? */
    //     event.preventDefault();

    //     // Update zoom
    //     const delta = event.deltaY > 0 ? 1 : -1;
    //     this._radius = gl_matrix_extensions.clamp(this._radius + delta * 0.3, 1.0, 10.0);

    //     // Calculate new camera transformation
    //     this.updateCamera();
    // }

    protected startRotate(event: MouseEvent): void {
        // Stop default action for the event
        /** @todo does not work, because this is only a copy? */
        event.preventDefault();

        this._initialPoint = this.offsets(event)[0];
    }

    protected updateRotate(event: MouseEvent): void {
        // Stop default action for the event
        /** @todo does not work, because this is only a copy? */
        event.preventDefault();

        /* Retrieve current event positions. */
        this._currentPoint = this.offsets(event)[0];

        /** @todo move to event handler... */
        const magnitudes = vec2.subtract(vec2.create(), this._initialPoint, this._currentPoint);
        vec2.scale(magnitudes, magnitudes, window.devicePixelRatio * TrackballNavigation.ROTATE_FACTOR);

        /* Rotation uses difference between two events, thus, initial position is reset. */
        vec2.copy(this._initialPoint, this._currentPoint);

        /* Create rotation with respect to arbitrary camera center and up vector. */
        const centerToEye = vec3.sub(vec3.create(), this._reference.eye, this._reference.center);
        vec3.normalize(centerToEye, centerToEye);
        const up = vec3.normalize(vec3.create(), this._reference.up);

        /* Create vertical rotation axis. */
        const ortho = vec3.cross(vec3.create(), centerToEye, up);
        vec3.scale(up, up, magnitudes[1]);
        vec3.scale(ortho, ortho, magnitudes[0]);

        /* Create overall rotation axis for quaternion based rotation. */
        const axis = vec3.cross(vec3.create(), vec3.add(vec3.create(), up, ortho), centerToEye);
        vec3.normalize(axis, axis);

        /* Create quaternion and modify rotation transformation. */
        const q = quat.setAxisAngle(quat.create(), axis, vec2.len(magnitudes));
        mat4.multiply(this._rotation, this._rotation, mat4.fromQuat(mat4.create(), q));

        this.updateCamera();
    }

    protected updateCamera(): void {
        if (this._camera === undefined) {
            return;
        }

        /* Adjust for arbitrary camera center and rotate using quaternion based rotation. */
        const T = mat4.fromTranslation(mat4.create(), this._reference.center);
        mat4.multiply(T, T, this._rotation);
        mat4.translate(T, T, vec3.negate(vec3.create(), this._reference.center));

        const up = vec3.transformMat4(vec3.create(), vec3.fromValues(0.0, 1.0, 0.0), this._rotation);
        const eye = vec3.transformMat4(vec3.create(), this._reference.eye, T);

        this._camera.up = up;
        this._camera.eye = eye;
    }


    update() {
        this._eventHandler.update();
    }


    /**
     * The camera that is to be modified in response to various events.
     */
    set camera(camera: Camera | undefined) {
        if (this._camera === camera) {
            return;
        }
        this._camera = camera;
        if (camera === undefined) {
            return;
        }
        Object.assign(this._reference, camera);
        this.updateCamera();
    }

    get camera(): Camera | undefined {
        return this._camera;
    }


    /** @todo move this to the event handler in webgl-operate...
     *
     * Normalize mouse and touch event coordinates for various browsers.
     *
     * @param event - Mouse or touch event.
     * @param normalize - Whether or not to compute normalized mouse and touch coordinates (offsets).
     *
     * @returns Array of normalized x and y offsets (in case of multiple touches).
     */
    offsets(event: MouseEvent | WheelEvent | TouchEvent, normalize: boolean = true): Array<vec2> {
        const offsets = new Array<vec2>();

        if (event instanceof MouseEvent) {
            const e = event as MouseEvent;
            offsets.push(vec2.fromValues(e.clientX, e.clientY));

        } else if (event instanceof WheelEvent) {
            const e = event as WheelEvent;
            offsets.push(vec2.fromValues(e.clientX, e.clientY));

        } else if (event instanceof TouchEvent) {
            const e = event as TouchEvent;
            /* tslint:disable-next-line:prefer-for-of */
            for (let i = 0; i < e.touches.length; ++i) {
                const touch = e.touches[i];
                offsets.push(vec2.fromValues(touch.clientX, touch.clientY));
            }
        }

        const target = event.target || event.currentTarget || event.srcElement;
        const rect = (target as HTMLElement).getBoundingClientRect();

        for (const offset of offsets) {
            offset[0] = Math.floor(offset[0] - rect.left);
            offset[1] = Math.floor(offset[1] - rect.top);
            if (normalize) {
                vec2.scale(offset, offset, window.devicePixelRatio);
            }
        }
        return offsets;
    }

}

export namespace TrackballNavigation {

    export enum Modes { Rotate, Zoom, ZoomStep }

}
