
const path = require('path');
const webpack = require('webpack');

module.exports = (env, options) => {
    const config = {
        context: __dirname + '/source',
        cache: true,
        devtool: 'source-map',
        plugins: [],
        entry: {
            'test-renderer': ['require.ts', 'test-renderer/example.ts'],
            'camera-navigation': ['require.ts', 'camera-navigation/example.ts'],
            'cornell-box': ['require.ts', 'cornell-box/example.ts'],
            'sky-triangle': ['require.ts', 'sky-triangle/example.ts'],
            'cubescape': ['require.ts', 'cubescape/example.ts'],
            // 'openll-showcase': ['require.ts', 'openll-showcase/example.ts'],
        },
        externals: {
            'webgl-operate': 'gloperate'
        },
        output: {
            path: __dirname + '/build',
            filename: '[name].js',
            libraryTarget: 'umd',
            umdNamedDefine: true
        },
        resolve: {
            modules: [__dirname + '/node_modules', __dirname + '/source'],
            extensions: ['.ts', '.tsx', '.js']
        },
        module: {
            rules: [
                {
                    test: /\.tsx?$/,
                    use: {
                        loader: 'ts-loader',
                    }
                },
                {
                    test: /\.(glsl|vert|frag)$/,
                    use: { loader: 'webpack-glsl-loader' },
                }]
        }
    };

    if (process.env.ANALYZE) {
        const analyzer = require('webpack-bundle-analyzer').BundleAnalyzerPlugin;
        module.exports.cache = false;
        module.exports.plugins.push(new analyzer());
    }

    if (options.mode === 'development') {
        const LiveReloadPlugin = require('webpack-livereload-plugin');
        config.plugins.push(new LiveReloadPlugin());
    }

    return config
};


