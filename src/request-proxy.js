import process from 'node:process';
import http from 'node:http';
import https from 'node:https';
import { ProxyAgent } from 'proxy-agent';
import { isValidUrl, color } from './util.js';
import fs from 'node:fs'
import path from 'node:path'

const LOG_HEADER = '[Request Proxy]';

/**
 * Initialize request proxy.
 * @param {ProxySettings} settings Proxy settings.
 * @typedef {object} ProxySettings
 * @property {boolean} enabled Whether proxy is enabled.
 * @property {string} url Proxy URL.
 * @property {string[]} bypass List of URLs to bypass proxy.
 * @property {string} sslRootCertPath ssl root certificate path, file extension name is pem
 */
export default function initRequestProxy({ enabled, url, bypass, sslRootCertPath }) {
    try {
        // No proxy is enabled, so return
        if (!enabled) {
            return;
        }

        if (!url) {
            console.error(color.red(LOG_HEADER), 'No proxy URL provided');
            return;
        }

        if (!isValidUrl(url)) {
            console.error(color.red(LOG_HEADER), 'Invalid proxy URL provided');
            return;
        }

        // ProxyAgent uses proxy-from-env under the hood
        // Reference: https://github.com/Rob--W/proxy-from-env
        process.env.all_proxy = url;
        process.env.http_proxy = url;
        process.env.https_proxy = url;
        if (sslRootCertPath) {
            // Load Charles root certificate
            const selfSignedCertPath = path.resolve(sslRootCertPath);

            if (fs.existsSync(selfSignedCertPath)) {
                process.env.NODE_EXTRA_CA_CERTS = selfSignedCertPath;
                process.env.NODE_TLS_REJECT_UNAUTHORIZED = "0"
                console.info(color.green(LOG_HEADER), 'self-signed root certificate loaded');
            } else {
                console.error(color.red(LOG_HEADER), 'self-signed root certificate not found at:', selfSignedCertPath);
            }
        }

        if (Array.isArray(bypass) && bypass.length > 0) {
            process.env.no_proxy = bypass.join(',');
        }

        const proxyAgent = new ProxyAgent();
        http.globalAgent = proxyAgent;
        https.globalAgent = proxyAgent;

        console.info();
        console.info(color.green(LOG_HEADER), 'Proxy URL is used:', color.blue(url));
        console.info();
    } catch (error) {
        console.error(color.red(LOG_HEADER), 'Failed to initialize request proxy:', error);
    }
}
