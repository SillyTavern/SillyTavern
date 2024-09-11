const http = require('node:http');
const https = require('node:https');

const { getConfigValue, isValidUrl, color } = require('./util.js');

const LOG_HEADER = '[Request Proxy]';

function initRequestProxy() {
    try {
        const { ProxyAgent } = require('proxy-agent');
        const proxyEnabled = getConfigValue('requestProxy.enabled', false);

        // No proxy is enabled, so return
        if (!proxyEnabled) {
            return;
        }

        const proxyUrl = getConfigValue('requestProxy.url', '');

        if (!proxyUrl) {
            console.error(color.red(LOG_HEADER), 'No proxy URL provided');
            return;
        }

        if (!isValidUrl(proxyUrl)) {
            console.error(color.red(LOG_HEADER), 'Invalid proxy URL provided');
            return;
        }

        // ProxyAgent uses proxy-from-env under the hood
        // Reference: https://github.com/Rob--W/proxy-from-env
        process.env.all_proxy = proxyUrl;

        const proxyBypass = getConfigValue('requestProxy.bypass', []);

        if (Array.isArray(proxyBypass) && proxyBypass.length > 0) {
            process.env.no_proxy = proxyBypass.join(',');
        }

        const proxyAgent = new ProxyAgent();
        http.globalAgent = proxyAgent;
        https.globalAgent = proxyAgent;

        console.log();
        console.log(color.green(LOG_HEADER), 'Proxy URL is used:', color.blue(proxyUrl));
        console.log();
    } catch (error) {
        console.error(color.red(LOG_HEADER), 'Failed to initialize request proxy:', error);
    }
}

module.exports = initRequestProxy;
