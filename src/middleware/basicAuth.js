/**
 * When applied, this middleware will ensure the request contains the required header for basic authentication and only
 * allow access to the endpoint after successful authentication.
 */
const { getConfig } = require('../util.js');

const unauthorizedResponse = (res) => {
    res.set('WWW-Authenticate', 'Basic realm="SillyTavern", charset="UTF-8"');
    return res.status(401).send('Authentication required');
};

const basicAuthMiddleware = function (request, response, callback) {
    const config = getConfig();
    const authHeader = request.headers.authorization;

    if (!authHeader) {
        return unauthorizedResponse(response);
    }

    const [scheme, credentials] = authHeader.split(' ');

    if (scheme !== 'Basic' || !credentials) {
        return unauthorizedResponse(response);
    }

    const [username, password] = Buffer.from(credentials, 'base64')
        .toString('utf8')
        .split(':');

    if (username === config.basicAuthUser.username && password === config.basicAuthUser.password) {
        return callback();
    } else {
        return unauthorizedResponse(response);
    }
};

module.exports = basicAuthMiddleware;
