import crypto from 'node:crypto';
import { DEFAULT_USER } from '../constants.js';
import { getConfigValue } from '../util.js';

/**
 * Sets the Clear-Site-Data header to bust the browser cache.
 */
class CacheBuster {
    /**
     * Handles/User-Agents that have already been busted.
     * @type {Set<string>}
     */
    #keys = new Set();

    /**
     * User agent regex to match against requests.
     * @type {RegExp | null}
     */
    #userAgentRegex = null;

    /**
     * Whether the cache buster is enabled.
     * @type {boolean | null}
     */
    #isEnabled = null;

    constructor() {
        this.#isEnabled = !!getConfigValue('cacheBuster.enabled', false, 'boolean');
        const userAgentPattern = getConfigValue('cacheBuster.userAgentPattern', '');
        if (userAgentPattern) {
            try {
                this.#userAgentRegex = new RegExp(userAgentPattern, 'i');
            } catch {
                console.error('[Cache Buster] Invalid user agent pattern:', userAgentPattern);
            }
        }
    }

    /**
     * Check if the cache should be busted for the given request.
     * @param {import('express').Request} request Express request object.
     * @param {import('express').Response} response Express response object.
     * @returns {boolean} Whether the cache should be busted.
     */
    shouldBust(request, response) {
        // If disabled with config, don't do anything
        if (!this.#isEnabled) {
            return false;
        }

        // If response headers are already sent or response is ended
        if (response.headersSent || response.writableEnded) {
            console.warn('[Cache Buster] Response ended or headers already sent');
            return false;
        }

        // Check if the user agent matches the configured pattern
        const userAgent = request.headers['user-agent'] || '';

        // Bust cache for all requests if no pattern is set
        if (!this.#userAgentRegex) {
            return true;
        }

        return this.#userAgentRegex.test(userAgent);
    }

    /**
     * Middleware to bust the browser cache for the current user.
     * @type {import('express').RequestHandler}
     */
    #middleware(request, response, next) {
        const handle = request.user?.profile?.handle || DEFAULT_USER.handle;
        const userAgent = request.headers['user-agent'] || '';
        const hash = crypto.createHash('sha256').update(userAgent).digest('hex');
        const key = `${handle}-${hash}`;

        if (this.#keys.has(key)) {
            return next();
        }

        this.#keys.add(key);
        this.bust(request, response);
        next();
    }

    /**
     * Middleware to bust the browser cache for the current user.
     * @returns {import('express').RequestHandler} The middleware function.
     */
    get middleware() {
        return this.#middleware.bind(this);
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

// Export a single instance for the entire application
const instance = new CacheBuster();
export default instance;
