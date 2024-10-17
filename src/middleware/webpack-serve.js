import webpack from 'webpack';
import middleware from 'webpack-dev-middleware';
import { publicLibConfig } from '../../webpack.config.js';

export default function getWebpackServeMiddleware() {
    const compiler = webpack(publicLibConfig);

    return middleware(compiler, {});
}
