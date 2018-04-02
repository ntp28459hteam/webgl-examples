# WebGL Examples

WebGL examples using TypeScript and [webgl-operate](https://webgl-operate.org).


#### How to Setup a New Example

In order to setup a new example, let's say `new-renderer`, the following steps are recommended:
* Copy and paste the `source/test-renderer` directory which is intended as template for examples.
* Rename the copied folder to, e.g., `source/new-renderer`.
* Rename the main renderer class accordingly, e.g., `testrenderer.ts` to `newrenderer.ts`.
* Adjust the the `source/new-renderer/example.ts` according to your needs.
* Extend the entry property in `webpack.config.js`, e.g., by adding <br> `new-renderer': ['require.ts', 'new-renderer/example.ts']`.
* Add and adjust the associated website, e.g., by copying and renaming <br> `website/test-renderer.pug` to `website/new-renderer.pug`.
* Finally, add an entry to `website/examples.json` in the root directoy, e.g., `new-renderer`.

Running `build` will transpile all sources and example websites to the `./build` directory. The new renderer should result in a `./build/new-renderer.js` and `./build/new-renderer.html`.
Running `start` or `start-watch` enables `localhost:4000/new-renderer.html` to be accessed and debugged.

Please note that we try to reduce these steps in the near future, e.g., by providing a script for these steps.
