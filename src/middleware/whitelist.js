const path = require('path');
const fs = require('fs');
const ipMatching = require('ip-matching');

const { getIpFromRequest } = require('../express-common');
const { color, getConfigValue } = require('../util');

const whitelistPath = path.join(process.cwd(), './whitelist.txt');
const enableForwardedWhitelist = getConfigValue('enableForwardedWhitelist', false);
let whitelist = getConfigValue('whitelist', []);
let knownIPs = new Set();

if (fs.existsSync(whitelistPath)) {
    try {
        let whitelistTxt = fs.readFileSync(whitelistPath, 'utf-8');
        whitelist = whitelistTxt.split('\n').filter(ip => ip).map(ip => ip.trim());
    } catch (e) {
        // Ignore errors that may occur when reading the whitelist (e.g. permissions)
    }
}

/**
 * Get the client IP address from the request headers.
 * @param {import('express').Request} req Express request object
 * @returns {string|undefined} The client IP address
 */
function getForwardedIp(req) {
    if (!enableForwardedWhitelist) {
        return undefined;
    }

    // Check if X-Real-IP is available
    if (req.headers['x-real-ip']) {
        return req.headers['x-real-ip'].toString();
    }

    // Check for X-Forwarded-For and parse if available
    if (req.headers['x-forwarded-for']) {
        const ipList = req.headers['x-forwarded-for'].toString().split(',').map(ip => ip.trim());
        return ipList[0];
    }

    // If none of the headers are available, return undefined
    return undefined;
}

/**
 * Returns a middleware function that checks if the client IP is in the whitelist.
 * @param {boolean} whitelistMode If whitelist mode is enabled via config or command line
 * @param {boolean} listen If listen mode is enabled via config or command line
 * @returns {import('express').RequestHandler} The middleware function
 */
function whitelistMiddleware(whitelistMode, listen) {
    return function (req, res, next) {
        const clientIp = getIpFromRequest(req);
        const forwardedIp = getForwardedIp(req);

        if (listen && !knownIPs.has(clientIp)) {
            const userAgent = req.headers['user-agent'];
            console.log(color.yellow(`New connection from ${clientIp}; User Agent: ${userAgent}\n`));
            knownIPs.add(clientIp);

            // Write access log
            const timestamp = new Date().toISOString();
            const log = `${timestamp} ${clientIp} ${userAgent}\n`;
            fs.appendFile('access.log', log, (err) => {
                if (err) {
                    console.error('Failed to write access log:', err);
                }
            });
        }

        //clientIp = req.connection.remoteAddress.split(':').pop();
        if (whitelistMode === true && !whitelist.some(x => ipMatching.matches(clientIp, ipMatching.getMatch(x)))
            || forwardedIp && whitelistMode === true && !whitelist.some(x => ipMatching.matches(forwardedIp, ipMatching.getMatch(x)))
        ) {
            // Log the connection attempt with real IP address
            const ipDetails = forwardedIp ? `${clientIp} (forwarded from ${forwardedIp})` : clientIp;
            console.log(color.red('Forbidden: Connection attempt from ' + ipDetails + '. If you are attempting to connect, please add your IP address in whitelist or disable whitelist mode in config.yaml in root of SillyTavern folder.\n'));
            return res.status(403).send('<b>Forbidden</b>: Connection attempt from <b>' + ipDetails + '</b>. If you are attempting to connect, please add your IP address in whitelist or disable whitelist mode in config.yaml in root of SillyTavern folder.');
        }
        next();
    };
}

module.exports = whitelistMiddleware;
