
import { vec3 } from 'gl-matrix';

import { auxiliaries } from 'webgl-operate';

// https://en.wikipedia.org/wiki/Fisher-Yates_shuffle
function shuffle(deck: Array<vec3>) {
    const randomizedDeck = [];
    const array = deck.slice();
    while (array.length !== 0) {
        const rIndex = Math.floor(array.length * Math.random());
        randomizedDeck.push(array[rIndex]);
        array.splice(rIndex, 1);
    }
    return randomizedDeck;
}

export function pointsInLight(llf: vec3, urb: vec3, minN: number): Array<vec3> {

    let lights = Array<vec3>();

    const min = vec3.min(vec3.create(), llf, urb);
    const max = vec3.max(vec3.create(), llf, urb);
    const size = vec3.subtract(vec3.create(), max, min);

    const r = Math.ceil(Math.sqrt(1.0 * minN));
    const step = vec3.scale(vec3.create(), size, (1.0 - 1e-4) / (r - 1.0)); // the "<=" and floating precision
    for (let x = min[0]; x <= max[0]; x += step[0]) {
        for (let z = min[2]; z <= max[2]; z += step[2]) {
            lights.push(vec3.fromValues(x, auxiliaries.rand(min[1], max[1]), z));
        }
    }

    // 2. shuffle all points
    lights = shuffle(lights);

    return lights;
}

export function pointsOnSphere(numPoints: number): Array<vec3> {

    // random directions in tangent space
    const donkey = new Array<vec3>(numPoints);

    for (let i = 0; i < donkey.length; ++i) {
        const bound = 1.0 - 1e-4;
        const x = auxiliaries.rand(-bound, bound);
        const z = auxiliaries.rand(-bound, bound);
        const y = Math.sqrt(Math.max(1.0 - x * x - z * z, 1e-4));
        donkey[i] = vec3.normalize(vec3.create(), vec3.fromValues(x, y, z));
    }
    return donkey;
}
