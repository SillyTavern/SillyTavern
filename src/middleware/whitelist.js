const path = require('path');
const fs = require('fs');
const ipaddr = require('ipaddr.js');
const ipMatching = require('ip-matching');

const { color, getConfigValue } = require('../util');

const whitelistPath = path.join(process.cwd(), './whitelist.txt');
let whitelist = getConfigValue('whitelist', []);
let knownIPs = new Set();
const whitelistMode = getConfigValue('whitelistMode', true);

if (fs.existsSync(whitelistPath)) {
    try {
        let whitelistTxt = fs.readFileSync(whitelistPath, 'utf-8');
        whitelist = whitelistTxt.split('\n').filter(ip => ip).map(ip => ip.trim());
    } catch (e) {
        // Ignore errors that may occur when reading the whitelist (e.g. permissions)
    }
}

function getForwardedIp(req) {
    // Check if X-Real-IP is available
    if (req.headers['x-real-ip']) {
        return req.headers['x-real-ip'];
    }

    // Check for X-Forwarded-For and parse if available
    if (req.headers['x-forwarded-for']) {
        const ipList = req.headers['x-forwarded-for'].split(',').map(ip => ip.trim());
        return ipList[0];
    }

    // If none of the headers are available, return undefined
    return undefined;
}

function getIpFromRequest(req) {
    let clientIp = req.connection.remoteAddress;
    let ip = ipaddr.parse(clientIp);
    // Check if the IP address is IPv4-mapped IPv6 address
    if (ip.kind() === 'ipv6' && ip instanceof ipaddr.IPv6 && ip.isIPv4MappedAddress()) {
        const ipv4 = ip.toIPv4Address().toString();
        clientIp = ipv4;
    } else {
        clientIp = ip;
        clientIp = clientIp.toString();
    }
    return clientIp;
}

/**
 * Returns a middleware function that checks if the client IP is in the whitelist.
 * @param {boolean} listen If listen mode is enabled via config or command line
 * @returns {import('express').RequestHandler} The middleware function
 */
function whitelistMiddleware(listen) {
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
