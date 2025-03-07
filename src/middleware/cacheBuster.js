import crypto from 'node:crypto';
import { DEFAULT_USER } from '../constants.js';

/**
 * Middleware to bust the browser cache for the current user.
 * @returns {import('express').RequestHandler}
 */
export default function getCacheBusterMiddleware() {
    /**
     * @type {Set<string>} Handles/User-Agents that have already been busted.
     */
    const keys = new Set();

    return (request, response, next) => {
        const handle = request.user?.profile?.handle || DEFAULT_USER.handle;
        const userAgent = request.headers['user-agent'] || '';
        const hash = crypto.createHash('sha256').update(userAgent).digest('hex');
        const key = `${handle}-${hash}`;

        if (keys.has(key)) {
            return next();
        }

        keys.add(key);
        response.setHeader('Clear-Site-Data', '"cache"');
        next();
    };
}
