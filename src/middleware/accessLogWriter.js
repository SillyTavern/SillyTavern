import path from 'node:path';
import fs from 'node:fs';
import { getIpFromRequest, getRealOrForwardedIp } from '../express-common.js';
import { color, getConfigValue } from '../util.js';

const enableAccessLog = getConfigValue('logging.enableAccessLog', true, 'boolean');

const knownIPs = new Set();

export const getAccessLogPath = () => path.join(globalThis.DATA_ROOT, 'access.log');

export function migrateAccessLog() {
    try {
        if (!fs.existsSync('access.log')) {
            return;
        }
        const logPath = getAccessLogPath();
        if (fs.existsSync(logPath)) {
            return;
        }
        fs.renameSync('access.log', logPath);
        console.log(color.yellow('Migrated access.log to new location:'), logPath);
    } catch (e) {
        console.error('Failed to migrate access log:', e);
        console.info('Please move access.log to the data directory manually.');
    }
}

/**
 * Creates middleware for logging access and new connections
 * @returns {import('express').RequestHandler}
 */
export default function accessLoggerMiddleware() {
    return function (req, res, next) {
        const socketIp = getIpFromRequest(req);
        const forwardedIp = getRealOrForwardedIp(req);
        const ipString = forwardedIp ? `${socketIp} (forwarded: ${forwardedIp})` : socketIp;
        const userAgent = req.headers['user-agent'] || 'unknown';

        if (!knownIPs.has(ipString)) {
            // Log new connection
            knownIPs.add(ipString);

            // Write to access log if enabled
            if (enableAccessLog) {
                console.info(color.yellow(`New connection from ${ipString}; User Agent: ${userAgent}\n`));
                const logPath = getAccessLogPath();
                const timestamp = new Date().toISOString();
                const log = `${timestamp} ${ipString} ${userAgent}\n`;

                fs.appendFile(logPath, log, (err) => {
                    if (err) {
                        console.error('Failed to write access log:', err);
                    }
                });
            }
        }

        next();
    };
}
