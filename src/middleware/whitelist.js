import path from 'node:path';
import Handlebars from 'handlebars';
import ipMatching from 'ip-matching';

import { filterValidIpPatterns, getIpFromRequest, getRealOrForwardedIp } from '../express-common.js';
import { color, getConfigValue, safeReadFileSync } from '../util.js';

const enableForwardedWhitelist = !!getConfigValue('enableForwardedWhitelist', false, 'boolean');
/** @type {string[]} */
let whitelist = getConfigValue('whitelist', []);

whitelist = filterValidIpPatterns(whitelist, (entry, message) => `${color.red('Warning')}: Ignoring invalid whitelist entry ${color.yellow(entry)} - ${message}`);

/**
 * Returns a middleware function that checks if the client IP is in the whitelist.
 * @returns {Promise<import('express').RequestHandler>} Promise that resolves to the middleware function
 */
export default async function getWhitelistMiddleware() {
    const forbiddenWebpage = Handlebars.compile(
        safeReadFileSync(path.join(globalThis.DATA_ROOT, '_errors', 'forbidden-by-whitelist.html')) ?? '',
    );

    const noLogPaths = [
        '/favicon.ico',
    ];

    return function (req, res, next) {
        const clientIp = getIpFromRequest(req);
        const forwardedIp = enableForwardedWhitelist && getRealOrForwardedIp(req);
        const userAgent = req.headers['user-agent'];

        /**
         * Checks if an IP address matches any entry in the whitelist.
         * @param {string[]} whitelist - The list of whitelisted IPs/CIDRs
         * @param {string} ip - The IP address to check
         * @returns {boolean} True if the IP matches any whitelist entry
         */
        function isIPInWhitelist(whitelist, ip) {
            return whitelist.some(x => ipMatching.matches(ip, ipMatching.getMatch(x)));
        }

        //clientIp = req.connection.remoteAddress.split(':').pop();
        if (!isIPInWhitelist(whitelist, clientIp)
            || (forwardedIp && !isIPInWhitelist(whitelist, forwardedIp))
        ) {
            // Log the connection attempt with real IP address
            const ipDetails = forwardedIp
                ? `${clientIp} (forwarded from ${forwardedIp})`
                : clientIp;

            if (!noLogPaths.includes(req.path)) {
                console.warn(
                    color.red(
                        `Blocked connection from ${ipDetails}; User Agent: ${userAgent}\n\tTo allow this connection, add its IP address to the whitelist or disable whitelist mode by editing config.yaml in the root directory of your SillyTavern installation.\n`,
                    ),
                );
            }

            return res.status(403).send(forbiddenWebpage({ ipDetails }));
        }
        next();
    };
}
