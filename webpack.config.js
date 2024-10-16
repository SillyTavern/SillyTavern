/** @type {import('webpack').Configuration} */
export const publicLibConfig = {
    mode: 'production',
    entry: './public/lib.js',
    cache: true,
    devtool: 'source-map',
    module: {},
    stats: 'minimal',
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
