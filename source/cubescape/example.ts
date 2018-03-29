
import { Canvas, Color } from 'webgl-operate';

import { CubescapeRenderer } from './cubescaperenderer';


function onload() {
    const canvas = new Canvas('example-canvas');
    const context = canvas.context;

    canvas.clearColor.fromHex('f8f9fa');

    const renderer = new CubescapeRenderer();
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
