
import { vec3 } from 'gl-matrix';
import { shuffle } from './shuffle';

interface Dictionary { [id: number]: number; }


// splits a triangle edge by adding an appropriate new point (normalized on sphere)
// to the points list (if not already cached) and returns the index to this point.
function splitEdge(
    a: number,
    b: number,
    points: Array<vec3>,
    cache: Dictionary): number {

    const aSmaller = a < b;
    const smaller = (aSmaller ? a : b);
    const greater = (aSmaller ? b : a);
    const hash = ((smaller << 32) + greater);

    if (!(cache[hash] === undefined)) {
        return cache[hash];
    }

    const a3 = points[a];
    const b3 = points[b];

    // s = normalize((a3 + b3) * 0.5)
    const k1 = vec3.add(vec3.create(), a3, b3);
    const k2 = vec3.scale(vec3.create(), k1, 0.5);
    const s = vec3.normalize(vec3.create(), k2);

    points.push(s);
    const i = points.length - 1;

    cache[hash] = i;

    return i;
}

// creates at least minN points on a unitsphere by creating a hemi-icosphere:
// approach to create evenly distributed points on a sphere
//   1. create points of icosphere
//   2. cutout hemisphere
//   3. randomize point list
export function pointsOnSphere(minN: number): Array<vec3> {

    // 1. create an icosphere

    const t = (1.0 + Math.sqrt(5.0)) * 0.5;

    const icopoints = Array<vec3>();
    const icofaces = Array<vec3>(); // unsigned int

    // basic icosahedron
    icopoints.push(vec3.fromValues(-1, t, 0));
    icopoints.push(vec3.fromValues(1, t, 0));
    icopoints.push(vec3.fromValues(-1, -t, 0));
    icopoints.push(vec3.fromValues(1, -t, 0));

    icopoints.push(vec3.fromValues(0, -1, t));
    icopoints.push(vec3.fromValues(0, 1, t));
    icopoints.push(vec3.fromValues(0, -1, -t));
    icopoints.push(vec3.fromValues(0, 1, -t));

    icopoints.push(vec3.fromValues(t, 0, -1));
    icopoints.push(vec3.fromValues(t, 0, 1));
    icopoints.push(vec3.fromValues(-t, 0, -1));
    icopoints.push(vec3.fromValues(-t, 0, 1));

    // normalize
    for (let i = 0; i < 12; ++i) {
        vec3.normalize(icopoints[i], icopoints[i]);
    }

    icofaces.push(vec3.fromValues(0, 11, 5));
    icofaces.push(vec3.fromValues(0, 5, 1));
    icofaces.push(vec3.fromValues(0, 1, 7));
    icofaces.push(vec3.fromValues(0, 7, 10));
    icofaces.push(vec3.fromValues(0, 10, 11));

    icofaces.push(vec3.fromValues(1, 5, 9));
    icofaces.push(vec3.fromValues(5, 11, 4));
    icofaces.push(vec3.fromValues(11, 10, 2));
    icofaces.push(vec3.fromValues(10, 7, 6));
    icofaces.push(vec3.fromValues(7, 1, 8));

    icofaces.push(vec3.fromValues(3, 9, 4));
    icofaces.push(vec3.fromValues(3, 4, 2));
    icofaces.push(vec3.fromValues(3, 2, 6));
    icofaces.push(vec3.fromValues(3, 6, 8));
    icofaces.push(vec3.fromValues(3, 8, 9));

    icofaces.push(vec3.fromValues(4, 9, 5));
    icofaces.push(vec3.fromValues(2, 4, 11));
    icofaces.push(vec3.fromValues(6, 2, 10));
    icofaces.push(vec3.fromValues(8, 6, 7));
    icofaces.push(vec3.fromValues(9, 8, 1));

    // iterative triangle refinement - split each triangle
    // into 4 new ones and create points appropriately.

    const r = Math.ceil(Math.log(2.0 / 12.0 * minN)) / Math.log(4.0); // N = 12 * 4 ^ r

    const cache: Dictionary = {};

    for (let i = 0; i < r; ++i) {
        const size = icofaces.length;

        for (let f = 0; f < size; ++f) {
            const face = icofaces[f];

            const a = face[0];
            const b = face[1];
            const c = face[2];

            const ab = splitEdge(a, b, icopoints, cache);
            const bc = splitEdge(b, c, icopoints, cache);
            const ca = splitEdge(c, a, icopoints, cache);

            icofaces[f] = vec3.fromValues(ab, bc, ca);

            icofaces.push(vec3.fromValues(a, ab, ca));
            icofaces.push(vec3.fromValues(b, bc, ab));
            icofaces.push(vec3.fromValues(c, ca, bc));
        }
    }

    // 2. remove lower hemisphere
    let points = Array<vec3>();
    const size = icopoints.length;
    for (let i = 0; i < size; ++i) {
        if (icopoints[i][2] > 0.0) {
            points.push(vec3.clone(icopoints[i]));
        }
    }

    // 3. shuffle all points of hemisphere
    points = shuffle(points);

    return points;
}
