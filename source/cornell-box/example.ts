

import * as gloperate from 'webgl-operate';

import { CornellRenderer } from './cornellrenderer';


function onload() {
    const canvas = new gloperate.Canvas('example-canvas');
    const context = canvas.context;
    const renderer = new CornellRenderer();
    canvas.renderer = renderer;
    canvas.framePrecision = `float`;
    canvas.controller.multiFrameNumber = 128;
    canvas.element.addEventListener('click', () => { canvas.controller.update(); });

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
