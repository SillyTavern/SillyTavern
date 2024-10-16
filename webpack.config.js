/** @type {import('webpack').Configuration} */
export const publicLibConfig = {
    mode: 'production',
    entry: './public/lib.js',
    cache: true,
    devtool: 'source-map',
    module: {},
    experiments: {
        outputModule: true,
    },
    output: {
        filename: 'lib.js',
        libraryTarget: 'module',
    },
};
