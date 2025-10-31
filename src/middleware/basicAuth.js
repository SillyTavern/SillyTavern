/**
 * When applied, this middleware will ensure the request contains the required header for basic authentication and only
 * allow access to the endpoint after successful authentication.
 */
import { Buffer } from 'node:buffer';
import storage from 'node-persist';
import { getAllUserHandles, toKey, getPasswordHash } from '../users.js';
import { getConfigValue, safeReadFileSync } from '../util.js';

const PER_USER_BASIC_AUTH = getConfigValue('perUserBasicAuth', false, 'boolean');
const ENABLE_ACCOUNTS = getConfigValue('enableUserAccounts', false, 'boolean');

const basicAuthMiddleware = async function (request, response, callback) {
    const unauthorizedWebpage = safeReadFileSync('./public/error/unauthorized.html') ?? '';
    const unauthorizedResponse = (res) => {
        res.set('WWW-Authenticate', 'Basic realm="SillyTavern", charset="UTF-8"');
        return res.status(401).send(unauthorizedWebpage);
    };

    const basicAuthUserName = getConfigValue('basicAuthUser.username');
    const basicAuthUserPassword = getConfigValue('basicAuthUser.password');
    const authHeader = request.headers.authorization;

    if (!authHeader) {
        return unauthorizedResponse(response);
    }

    const [scheme, credentials] = authHeader.split(' ');

    if (scheme !== 'Basic' || !credentials) {
        return unauthorizedResponse(response);
    }

    const usePerUserAuth = PER_USER_BASIC_AUTH && ENABLE_ACCOUNTS;
    const [username, password] = Buffer.from(credentials, 'base64')
        .toString('utf8')
        .split(':');

    if (!usePerUserAuth && username === basicAuthUserName && password === basicAuthUserPassword) {
        return callback();
    } else if (usePerUserAuth) {
        const userHandles = await getAllUserHandles();
        for (const userHandle of userHandles) {
            if (username === userHandle) {
                const user = await storage.getItem(toKey(userHandle));
                if (user && user.enabled && (user.password && user.password === getPasswordHash(password, user.salt))) {
                    return callback();
                }
            }
        }
    }
    return unauthorizedResponse(response);
};

export default basicAuthMiddleware;
