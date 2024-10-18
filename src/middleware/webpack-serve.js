import process from 'node:process';
import webpack from 'webpack';
import middleware from 'webpack-dev-middleware';
import { publicLibConfig } from '../../webpack.config.js';

export default function getWebpackServeMiddleware() {
    const compiler = webpack(publicLibConfig);

    if (process.env.NODE_ENV === 'production') {
        compiler.hooks.done.tap('serve', () => {
            if (compiler.watching) {
                compiler.watching.close(() => { });
            }
            compiler.watchFileSystem = null;
            compiler.watchMode = false;
        });
    }

    return middleware(compiler, {});
}
