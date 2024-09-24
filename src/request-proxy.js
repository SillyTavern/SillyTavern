const http = require('node:http');
const https = require('node:https');

const { isValidUrl, color } = require('./util.js');

const LOG_HEADER = '[Request Proxy]';

/**
 * Initialize request proxy.
 * @param {ProxySettings} settings Proxy settings.
 * @typedef {object} ProxySettings
 * @property {boolean} enabled Whether proxy is enabled.
 * @property {string} url Proxy URL.
 * @property {string[]} bypass List of URLs to bypass proxy.
 */
function initRequestProxy({ enabled, url, bypass }) {
    try {
        const { ProxyAgent } = require('proxy-agent');

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


        if (Array.isArray(bypass) && bypass.length > 0) {
            process.env.no_proxy = bypass.join(',');
        }

        const proxyAgent = new ProxyAgent();
        http.globalAgent = proxyAgent;
        https.globalAgent = proxyAgent;

        console.log();
        console.log(color.green(LOG_HEADER), 'Proxy URL is used:', color.blue(url));
        console.log();
    } catch (error) {
        console.error(color.red(LOG_HEADER), 'Failed to initialize request proxy:', error);
    }
}

module.exports = initRequestProxy;
