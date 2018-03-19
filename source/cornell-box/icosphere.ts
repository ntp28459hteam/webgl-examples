
import { vec3 } from 'gl-matrix';
import { shuffle } from './shuffle';

import { auxiliaries } from 'webgl-operate';


export function pointsOnSphere(minN: number): Array<vec3> {

    // random directions in tangent space
    const donkey = new Array<vec3>(4096);

    for (let i = 0; i < donkey.length; ++i) {
        const bound = 1.0 - 1e-4;
        const x = auxiliaries.rand(-bound, bound);
        const z = auxiliaries.rand(-bound, bound);
        const y = Math.sqrt(Math.max(1.0 - x * x - z * z, 1e-4));
        donkey[i] = vec3.normalize(vec3.create(), vec3.fromValues(x, y, z));

        // donkey.push(vec3.normalize(vec3.create(), vec3.fromValues(
        //     auxiliaries.rand(-0.6, 0.6),
        //     auxiliaries.rand(0.1, 0.6), // only in positive normal direction
        //     auxiliaries.rand(-0.6, 0.6),
        // )));
    }
    // console.log(donkey);
    return donkey;

}
