
import { Canvas, Color } from 'webgl-operate';

import { Skybox } from './skybox';
import { SkyTriangle } from './skytriangle';
import { SplitRenderer } from './splitrenderer';


function onload() {
    const canvas = new Canvas('example-canvas');
    const context = canvas.context;

    canvas.clearColor.fromHex('d6d8db');

    const renderer = new SplitRenderer();
    canvas.renderer = renderer;

    // export variables
    (window as any)['canvas'] = canvas;
    (window as any)['context'] = context;
    (window as any)['renderer'] = renderer;
}

if (window.document.readyState === 'complete') {
    onload();
} else {
    window.onload = onload;
}
