import crypto from 'node:crypto';
import { DEFAULT_USER } from '../constants.js';
import { getConfigValue } from '../util.js';

export class CacheBuster {
    /**
     * Check if the cache buster is enabled based on the configuration.
     * @returns {boolean} Whether the cache buster is enabled.
     */
    isEnabled() {
        return !!getConfigValue('cacheBuster.enabled', false, 'boolean');
    }

    /**
     * Check if the cache should be busted for the given request.
     * @param {import('express').Request} request Express request object.
     * @param {import('express').Response} response Express response object.
     * @returns {boolean} Whether the cache should be busted.
     */
    shouldBust(request, response) {
        // If disabled with config, don't do anything
        if (!this.isEnabled()) {
            return false;
        }

        // If response headers are already sent or response is ended
        if (response.headersSent || response.writableEnded) {
            console.warn('Cache Buster: Response ended or headers already sent');
            return false;
        }

        // Check if the user agent matches the configured pattern
        const userAgentPattern = getConfigValue('cacheBuster.userAgentPattern', '');
        const userAgent = request.headers['user-agent'] || '';

        // Bust cache for all requests if no pattern is set
        if (!userAgentPattern) {
            return true;
        }

        try {
            const regex = new RegExp(userAgentPattern, 'i');
            return regex.test(userAgent);
        } catch (error) {
            console.error('Cache Buster: Invalid user agent pattern:', userAgentPattern, error);
            return false;
        }
    }

    /**
     * Middleware to bust the browser cache for the current user.
     * @returns {import('express').RequestHandler}
     */
    get middleware() {
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
            this.bust(request, response);
            next();
        };
    }

    /**
     * Bust the cache for the given response.
     * @param {import('express').Request} request Express request object.
     * @param {import('express').Response} response Express response object.
     * @returns {void}
     */
    bust(request, response) {
        if (this.shouldBust(request, response)) {
            response.setHeader('Clear-Site-Data', '"cache"');
        }
    }
}
