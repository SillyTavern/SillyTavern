/**
 * When applied, this middleware will ensure the request contains the required header for basic authentication and only
 * allow access to the endpoint after successful authentication.
 */
import { Buffer } from 'node:buffer';
import path from 'node:path';
import storage from 'node-persist';
import { RateLimiterMemory, RateLimiterRes } from 'rate-limiter-flexible';
import { getAllUserHandles, toKey, getPasswordHash } from '../users.js';
import { getConfigValue, safeReadFileSync } from '../util.js';
import { getIpAddress, retryAfter } from '../express-common.js';

const PER_USER_BASIC_AUTH = !!getConfigValue('perUserBasicAuth', false, 'boolean');
const ENABLE_ACCOUNTS = !!getConfigValue('enableUserAccounts', false, 'boolean');
const PREFER_REAL_IP_HEADER = !!getConfigValue('rateLimiting.preferRealIpHeader', false, 'boolean');
const BASIC_AUTH_ATTEMPTS = getConfigValue('rateLimiting.basicAuthMaxAttempts', 5, 'number');

const basicAuthLimiter = new RateLimiterMemory({
    points: BASIC_AUTH_ATTEMPTS > 0 ? BASIC_AUTH_ATTEMPTS : Number.MAX_SAFE_INTEGER,
    duration: 60,
});

const basicAuthMiddleware = async function (request, response, callback) {
    const unauthorizedResponse = (res) => {
        const unauthorizedWebpage = safeReadFileSync(path.join(globalThis.DATA_ROOT, '_errors', 'unauthorized.html')) ?? '';
        res.set('WWW-Authenticate', 'Basic realm="SillyTavern", charset="UTF-8"');
        return res.status(401).send(unauthorizedWebpage);
    };

    try {
        const ip = getIpAddress(request, PREFER_REAL_IP_HEADER);

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

        const rateLimit = await basicAuthLimiter.get(ip);

        if (rateLimit !== null && rateLimit.consumedPoints > basicAuthLimiter.points) {
            throw rateLimit;
        }

        const usePerUserAuth = PER_USER_BASIC_AUTH && ENABLE_ACCOUNTS;
        const [username, ...passwordParts] = Buffer.from(credentials, 'base64')
            .toString('utf8')
            .split(':');
        const password = passwordParts.join(':');

        if (!usePerUserAuth && username === basicAuthUserName && password === basicAuthUserPassword) {
            await basicAuthLimiter.delete(ip);
            return callback();
        } else if (usePerUserAuth) {
            const userHandles = await getAllUserHandles();
            for (const userHandle of userHandles) {
                if (username === userHandle) {
                    const user = await storage.getItem(toKey(userHandle));
                    if (user && user.enabled && (user.password && user.password === getPasswordHash(password, user.salt))) {
                        await basicAuthLimiter.delete(ip);
                        return callback();
                    }
                }
            }
        }

        await basicAuthLimiter.consume(ip);
        return unauthorizedResponse(response);
    } catch (error) {
        if (error instanceof RateLimiterRes) {
            console.error('Basic auth failed: Rate limited from', getIpAddress(request, PREFER_REAL_IP_HEADER), request.method, request.originalUrl);
            return retryAfter(response, error).sendStatus(429);
        }
        console.error('Basic auth error:', error);
        return response.sendStatus(500);
    }
};

export default basicAuthMiddleware;
