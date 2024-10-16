/** @type {import('webpack').Configuration} */
export const publicLibConfig = {
    mode: 'production',
    entry: './public/lib.js',
    cache: true,
    devtool: 'source-map',
    module: {
        rules: [{
            test: /\.js$/,
            exclude: /node_modules/,
        }],
    },
    experiments: {
        outputModule: true,
    },
    output: {
        filename: 'lib.js',
        libraryTarget: 'module',
    },
};
