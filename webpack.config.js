import process from 'node:process';
import path from 'node:path';

/** @type {import('webpack').Configuration} */
export const publicLibConfig = {
    mode: 'production',
    entry: './public/lib.js',
    cache: {
        type: 'filesystem',
        cacheDirectory: path.resolve(process.cwd(), 'dist/webpack'),
    },
    devtool: false,
    watch: false,
    module: {},
    stats: {
        preset: 'minimal',
        assets: false,
        modules: false,
    },
    experiments: {
        outputModule: true,
    },
    performance: {
        hints: false,
    },
    output: {
        filename: 'lib.js',
        libraryTarget: 'module',
    },
};
