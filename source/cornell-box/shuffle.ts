
import { vec3 } from 'gl-matrix';

// https://en.wikipedia.org/wiki/Fisher-Yates_shuffle
export function shuffle(deck: Array<vec3>) {
    const randomizedDeck = [];
    const array = deck.slice();
    while (array.length !== 0) {
        const rIndex = Math.floor(array.length * Math.random());
        randomizedDeck.push(array[rIndex]);
        array.splice(rIndex, 1);
    }
    return randomizedDeck;
}
