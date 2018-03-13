
import { vec3 } from 'gl-matrix';
import { shuffle } from './shuffle';

// random number between a and b with a < b
function linearRand(a: number, b: number): number {
    return Math.floor(Math.random() * (b - a)) + a;
}


export function pointsInLight(llf: vec3, urb: vec3, minN: number): Array<vec3> {

    let lights = Array<vec3>();

    const min = vec3.min(vec3.create(), llf, urb);
    const max = vec3.max(vec3.create(), llf, urb);
    const size = vec3.subtract(vec3.create(), max, min);

    const r = Math.ceil(Math.sqrt(1.0 * minN));
    const step = vec3.scale(vec3.create(), size, 0.999 / (r - 1.0)); // 0.999 because the "<=" and floating precision
    for (let x = min[0]; x <= max[0]; x += step[0]) {
        for (let z = min[2]; z <= max[2]; z += step[2]) {
            lights.push(vec3.fromValues(x, linearRand(min[1], max[1]), z));
        }
    }

    // 2. shuffle all points
    lights = shuffle(lights);

    return lights;
}
