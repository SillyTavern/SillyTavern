import process from 'node:process';
import path from 'node:path';
import isDocker from 'is-docker';
import { serverDirectory } from './src/server-directory.js';

/**
 * Get the Webpack configuration for the public/lib.js file.
 * 1. Docker has got cache and the output file pre-baked.
 * 2. Non-Docker environments use the global DATA_ROOT variable to determine the cache and output directories.
 * @param {boolean} forceDist Whether to force the use the /dist folder.
 * @returns {import('webpack').Configuration}
 * @throws {Error} If the DATA_ROOT variable is not set.
 * */
export default function getPublicLibConfig(forceDist = false) {
    function getCacheDirectory() {
        if (forceDist || isDocker()) {
            return path.resolve(process.cwd(), 'dist/webpack');
        }

        if (typeof globalThis.DATA_ROOT === 'string') {
            return path.resolve(globalThis.DATA_ROOT, '_webpack', 'cache');
        }

        throw new Error('DATA_ROOT variable is not set.');
    }

    function getOutputDirectory() {
        if (forceDist || isDocker()) {
            return path.resolve(process.cwd(), 'dist');
        }

        if (typeof globalThis.DATA_ROOT === 'string') {
            return path.resolve(globalThis.DATA_ROOT, '_webpack', 'output');
        }

        throw new Error('DATA_ROOT variable is not set.');
    }

    const cacheDirectory = getCacheDirectory();
    const outputDirectory = getOutputDirectory();

    return {
        mode: 'production',
        entry: path.join(serverDirectory, 'public/lib.js'),
        cache: {
            type: 'filesystem',
            cacheDirectory: cacheDirectory,
            store: 'pack',
            compression: 'gzip',
        },
        devtool: false,
        watch: false,
        module: {},
        stats: {
            preset: 'minimal',
            assets: false,
            modules: false,
            colors: true,
            timings: true,
        },
        experiments: {
            outputModule: true,
        },
        performance: {
            hints: false,
        },
        output: {
            path: outputDirectory,
            filename: 'lib.js',
            libraryTarget: 'module',
        },
    };
}
