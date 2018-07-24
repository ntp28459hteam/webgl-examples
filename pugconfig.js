/**
 * This custom script is used to build/copy example sources for distribution:
 * - copy specific assets such as style sheets or scripts (either 3rd party or custom ones)
 * - compile specific pug templates and render to dist path
 */

const watch = process.argv.indexOf('--watch') > 1;

const fs = require('fs');
const path = require('path');
const copy = require('./copy.js');
const pug = require('pug');


const websiteDir = './website';
const buildDir = './build';

const examples = require(websiteDir + '/examples.json');

const WEBGL_OPERATE_DIST = './node_modules/webgl-operate/dist';

const assets = [
    ['./data', buildDir + '/data', ['*'], [], false],
    [websiteDir, buildDir, ['css/*.css', 'js/*.js', 'img/*.{svg,png,jpg}', 'fonts/*', '*.{svg,png,ico,xml,json}'], [], false],
    [WEBGL_OPERATE_DIST, buildDir + '/js', ['webgl-operate.{js,js.map}'], [], true],
    ['./node_modules/rxjs/bundles/', `${buildDir}/js`, ['rxjs.umd.min.js'], [], false]
];


function render(template, target, object) {
    const src = path.join(websiteDir, template + '.pug');
    const dst = path.join(buildDir, target + '.html');
    if (!fs.existsSync(src)) {
        console.log('skipped:', target);
        return;
    }

    const html = pug.renderFile(src, object);
    fs.writeFileSync(dst, html);
    console.log('emitted:', dst);
}


var build_pending = false;

function build() {
    assets.forEach((asset) => copy(asset[0], asset[1], asset[2], asset[3], asset[4]));

    render('index', 'index', { 'examples': examples });

    examples.forEach((example) => {
        render(example.target, example.target, { 'example': example });
    });

    build_pending = false;
}


build(); // trigger initial build

if (watch) {
    function onWatch() {
        if (build_pending) {
            return;
        }

        build_pending = true;
        setTimeout(build, 100);
    }

    fs.watch(websiteDir, { recursive: false }, onWatch);
    fs.watch(WEBGL_OPERATE_DIST, { recursive: false }, onWatch);
}

