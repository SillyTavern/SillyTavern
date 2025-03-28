import path from 'node:path';
import webpack from 'webpack';
import getPublicLibConfig from '../../webpack.config.js';

export default function getWebpackServeMiddleware() {
    /**
     * A very spartan recreation of webpack-dev-middleware.
     * @param {import('express').Request} req Request object.
     * @param {import('express').Response} res Response object.
     * @param {import('express').NextFunction} next Next function.
     * @type {import('express').RequestHandler}
     */
    function devMiddleware(req, res, next) {
        const publicLibConfig = getPublicLibConfig();
        const outputPath = publicLibConfig.output?.path;
        const outputFile = publicLibConfig.output?.filename;

        if (req.method === 'GET' && path.parse(req.path).base === outputFile) {
            return res.sendFile(outputFile, { root: outputPath });
        }

        next();
    }

    /**
     * Wait until Webpack is done compiling.
     * @param {object} param Parameters.
     * @param {boolean} [param.forceDist] Whether to force the use the /dist folder.
     * @returns {Promise<void>}
     */
    devMiddleware.runWebpackCompiler = ({ forceDist = false } = {}) => {
        const publicLibConfig = getPublicLibConfig(forceDist);
        const compiler = webpack(publicLibConfig);

        return new Promise((resolve) => {
            console.log();
            console.log('Compiling frontend libraries...');
            compiler.run((_error, stats) => {
                const output = stats?.toString(publicLibConfig.stats);
                if (output) {
                    console.log(output);
                    console.log();
                }
                compiler.close(() => {
                    resolve();
                });
            });
        });
    };

    return devMiddleware;
}
