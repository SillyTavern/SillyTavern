/** @type {import('webpack').Configuration} */
export const publicLibConfig = {
    mode: 'production',
    entry: './public/lib.js',
    cache: true,
    devtool: false,
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
