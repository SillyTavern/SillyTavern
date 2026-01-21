import getWebpackServeMiddleware from '../src/middleware/webpack-serve.js';

const middleware = getWebpackServeMiddleware();
await middleware.runWebpackCompiler({ forceDist: true });
