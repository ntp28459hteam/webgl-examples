

import { Canvas, Wizard } from 'webgl-operate';

import { CornellRenderer } from './cornellrenderer';


function onload() {
    const canvas = new Canvas('example-canvas');
    const context = canvas.context;
    const renderer = new CornellRenderer();

    canvas.renderer = renderer;
    canvas.framePrecision = Wizard.Precision.float;
    canvas.frameScale = [0.5, 0.5];
    canvas.clearColor.fromHex('d6d8db');
    canvas.controller.multiFrameNumber = 1024;
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
