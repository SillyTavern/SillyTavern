import path from 'node:path';
import fs from 'node:fs';
import process from 'node:process';
import dns from 'node:dns';
import Handlebars from 'handlebars';
import ipMatching from 'ip-matching';
import isDocker from 'is-docker';

import { getIpFromRequest } from '../express-common.js';
import { color, getConfigValue, safeReadFileSync } from '../util.js';

const whitelistPath = path.join(process.cwd(), './whitelist.txt');
const enableForwardedWhitelist = !!getConfigValue('enableForwardedWhitelist', false, 'boolean');
const whitelistDockerHosts = !!getConfigValue('whitelistDockerHosts', true, 'boolean');
/** @type {string[]} */
let whitelist = getConfigValue('whitelist', []);

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
 * Resolves the IP addresses of Docker hostnames and adds them to the whitelist.
 * @returns {Promise<void>} Promise that resolves when the Docker hostnames are resolved
 */
async function addDockerHostsToWhitelist() {
    if (!whitelistDockerHosts || !isDocker()) {
        return;
    }

    const whitelistHosts = ['host.docker.internal', 'gateway.docker.internal'];

    for (const entry of whitelistHosts) {
        try {
            const result = await dns.promises.lookup(entry);
            console.info(`Resolved whitelist hostname ${color.green(entry)} to IPv${result.family} address ${color.green(result.address)}`);
            whitelist.push(result.address);
        } catch (e) {
            console.warn(`Failed to resolve whitelist hostname ${color.red(entry)}: ${e.message}`);
        }
    }
}

/**
 * Returns a middleware function that checks if the client IP is in the whitelist.
 * @returns {Promise<import('express').RequestHandler>} Promise that resolves to the middleware function
 */
export default async function getWhitelistMiddleware() {
    const forbiddenWebpage = Handlebars.compile(
        safeReadFileSync('./public/error/forbidden-by-whitelist.html') ?? '',
    );

    const noLogPaths = [
        '/favicon.ico',
    ];

    await addDockerHostsToWhitelist();

    return function (req, res, next) {
        const clientIp = getIpFromRequest(req);
        const forwardedIp = getForwardedIp(req);
        const userAgent = req.headers['user-agent'];

        //clientIp = req.connection.remoteAddress.split(':').pop();
        if (!whitelist.some(x => ipMatching.matches(clientIp, ipMatching.getMatch(x)))
            || forwardedIp && !whitelist.some(x => ipMatching.matches(forwardedIp, ipMatching.getMatch(x)))
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
