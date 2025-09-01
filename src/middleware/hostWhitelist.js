import path from 'node:path';
import { color, getConfigValue, safeReadFileSync } from '../util.js';
import { serverDirectory } from '../server-directory.js';
import { isHostAllowed, hostValidationMiddleware } from 'host-validation-middleware';

const knownHosts = new Set();

const hostWhitelistEnabled = !!getConfigValue('hostWhitelist.enabled', false);
const hostWhitelist = Object.freeze(getConfigValue('hostWhitelist.hosts', []));
const hostWhitelistScan = !!getConfigValue('hostWhitelist.scan', false, 'boolean');

const hostNotAllowedHtml = safeReadFileSync(path.join(serverDirectory, 'public/error/host-not-allowed.html'))?.toString() ?? '';

const validationMiddleware = hostValidationMiddleware({
    allowedHosts: hostWhitelist,
    generateErrorMessage: () => hostNotAllowedHtml,
    errorResponseContentType: 'text/html',
});

/**
 * Middleware to validate remote hosts.
 * Useful to protect against DNS rebinding attacks.
 * @param {import('express').Request} req Request
 * @param {import('express').Response} res Response
 * @param {import('express').NextFunction} next Next middleware
 */
export default function hostWhitelistMiddleware(req, res, next) {
    const hostValue = req.headers.host;
    if (hostWhitelistScan && !isHostAllowed(hostValue, hostWhitelist) && !knownHosts.has(hostValue)) {
        console.warn(color.red('Request from untrusted host:'), hostValue);
        console.warn(`If you trust this host, you can add it to ${color.yellow('hostWhitelist.whitelist')} in config.yaml`);
        if (!hostWhitelistEnabled) {
            console.warn(`To protect against host spoofing, consider setting ${color.yellow('hostWhitelist.enabled')} to true`);
        }
        knownHosts.add(hostValue);
    }

    if (!hostWhitelistEnabled) {
        return next();
    }

    return validationMiddleware(req, res, next);
}
