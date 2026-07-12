import process from 'node:process';
import http from 'node:http';
import https from 'node:https';
import { URL } from 'node:url';
import net from 'node:net';
import dns from 'node:dns';
import { ProxyAgent } from 'proxy-agent';
import { isValidUrl, color } from './util.js';

const LOG_HEADER = '[Request Proxy]';

/**
 * Parse a bypass list entry and determine its type.
 * @param {string} entry A single bypass entry from the config.
 * @returns {{type: 'cidr', ip: string, prefix: number} | {type: 'ip-wildcard', parts: string[]} | {type: 'domain', pattern: string} | null}
 */
function parseBypassEntry(entry) {
    const trimmed = entry.trim();
    if (!trimmed) return null;

    // CIDR notation: 192.168.0.0/16
    const cidrMatch = trimmed.match(/^(\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3})\/(\d{1,2})$/);
    if (cidrMatch && net.isIPv4(cidrMatch[1])) {
        const prefix = parseInt(cidrMatch[2], 10);
        if (prefix >= 0 && prefix <= 32) {
            return { type: 'cidr', ip: cidrMatch[1], prefix };
        }
    }

    // IP wildcard: 192.168.*.*
    if (trimmed.includes('*')) {
        const parts = trimmed.split('.');
        if (parts.length === 4) {
            return { type: 'ip-wildcard', parts };
        }
    }

    // Everything else is treated as a domain/hostname pattern
    return { type: 'domain', pattern: trimmed };
}

/**
 * Check if an IPv4 address falls within a CIDR range.
 * @param {string} ip - The IP address to check.
 * @param {string} cidrIP - The network address.
 * @param {number} prefix - The subnet prefix length (0-32).
 * @returns {boolean}
 */
function ipInCIDR(ip, cidrIP, prefix) {
    const ipParts = ip.split('.').map(Number);
    const cidrParts = cidrIP.split('.').map(Number);

    const ipNum = ((ipParts[0] << 24) | (ipParts[1] << 16) | (ipParts[2] << 8) | ipParts[3]) >>> 0;
    const cidrNum = ((cidrParts[0] << 24) | (cidrParts[1] << 16) | (cidrParts[2] << 8) | cidrParts[3]) >>> 0;
    const mask = prefix === 0 ? 0 : (~((1 << (32 - prefix)) - 1)) >>> 0;

    return (ipNum & mask) === (cidrNum & mask);
}

/**
 * Check if an IPv4 address matches a wildcard pattern like 192.168.*.*
 * @param {string} ip - The IP address to check.
 * @param {string[]} wildcardParts - The wildcard pattern split by '.'.
 * @returns {boolean}
 */
function ipMatchesWildcard(ip, wildcardParts) {
    const ipParts = ip.split('.');
    if (ipParts.length !== 4) return false;
    for (let i = 0; i < 4; i++) {
        if (wildcardParts[i] !== '*' && wildcardParts[i] !== ipParts[i]) {
            return false;
        }
    }
    return true;
}

/**
 * Check if a hostname matches a domain bypass pattern.
 * Supports exact match, leading dot (`.example.com` matches `example.com` and any subdomain),
 * and leading wildcard (`*.example.com` — same as leading dot).
 * @param {string} hostname
 * @param {string} pattern
 * @returns {boolean}
 */
function hostnameMatchesDomain(hostname, pattern) {
    // *.example.com -> .example.com
    if (pattern.startsWith('*.')) {
        pattern = pattern.slice(1);
    }
    // .example.com matches example.com and any subdomain
    if (pattern.startsWith('.')) {
        return hostname === pattern.slice(1) || hostname.endsWith(pattern);
    }
    // Exact match (case-insensitive, since hostnames are)
    return hostname.toLowerCase() === pattern.toLowerCase();
}

/**
 * Check whether a URL should bypass the proxy based on the bypass list.
 * Handles CIDR notation, IP wildcards, and domain/hostname patterns.
 * @param {string} urlStr - The URL being requested.
 * @param {string[]} bypassList - List of bypass patterns from config.
 * @returns {Promise<boolean>}
 */
async function shouldBypassProxy(urlStr, bypassList) {
    let hostname;
    try {
        hostname = new URL(urlStr).hostname;
    } catch {
        return false;
    }

    if (!hostname) return false;

    for (const entry of bypassList) {
        const rule = parseBypassEntry(entry);
        if (!rule) continue;

        switch (rule.type) {
            case 'domain':
                if (hostnameMatchesDomain(hostname, rule.pattern)) {
                    return true;
                }
                break;

            case 'ip-wildcard':
                if (net.isIPv4(hostname)) {
                    if (ipMatchesWildcard(hostname, rule.parts)) {
                        return true;
                    }
                } else {
                    // Resolve hostname to IP for wildcard matching
                    try {
                        const addresses = await dns.promises.resolve4(hostname);
                        if (addresses.some(addr => ipMatchesWildcard(addr, rule.parts))) {
                            return true;
                        }
                    } catch {
                        // DNS resolution failed, continue to next rule
                    }
                }
                break;

            case 'cidr':
                if (net.isIPv4(hostname)) {
                    if (ipInCIDR(hostname, rule.ip, rule.prefix)) {
                        return true;
                    }
                } else {
                    // Resolve hostname to IP for CIDR matching
                    try {
                        const addresses = await dns.promises.resolve4(hostname);
                        if (addresses.some(addr => ipInCIDR(addr, rule.ip, rule.prefix))) {
                            return true;
                        }
                    } catch {
                        // DNS resolution failed, continue to next rule
                    }
                }
                break;
        }
    }

    return false;
}

/**
 * Initialize request proxy.
 * @param {ProxySettings} settings Proxy settings.
 * @typedef {object} ProxySettings
 * @property {boolean} enabled Whether proxy is enabled.
 * @property {string} url Proxy URL.
 * @property {string[]} bypass List of URLs to bypass proxy.
 *   Supports: domain patterns (example.com, .example.com, *.example.com),
 *   CIDR notation (192.168.0.0/16), and IP wildcards (192.168.*.*).
 * @property {boolean} enableKeepAlive Enable HTTP/HTTPS keep-alive.
 * @property {boolean} privateRequestFilterEnabled Whether the private request filter is enabled.
 */
export default function initRequestProxy({ enabled, url, bypass, enableKeepAlive, privateRequestFilterEnabled }) {
    try {
        // No proxy is enabled, so return
        if (!enabled) {
            return;
        }

        if (privateRequestFilterEnabled) {
            console.warn(color.yellow(LOG_HEADER), 'Warning: Request proxy is enabled while private request filter is also enabled. Only URLs that BYPASS the request proxy will be checked.');
            console.warn(color.yellow(LOG_HEADER), 'To ensure all requests are properly filtered, disable the request proxy.');
        }

        if (!url) {
            console.error(color.red(LOG_HEADER), 'No proxy URL provided');
            return;
        }

        if (!isValidUrl(url)) {
            console.error(color.red(LOG_HEADER), 'Invalid proxy URL provided');
            return;
        }

        // Set environment variables for libraries that read them directly
        process.env.all_proxy = url;

        const hasBypass = Array.isArray(bypass) && bypass.length > 0;
        if (hasBypass) {
            process.env.no_proxy = bypass.join(',');
        }

        const httpAgent = http.globalAgent;
        const httpsAgent = https.globalAgent;

        /**
         * Custom proxy resolution callback.
         * Uses our own bypass logic to support CIDR notation and IP wildcards,
         * which are not handled by the default proxy-from-env resolution.
         * @param {string} urlStr
         * @returns {Promise<string>}
         */
        async function getProxyForUrl(urlStr) {
            if (hasBypass && await shouldBypassProxy(urlStr, bypass)) {
                return ''; // falsy return = bypass proxy
            }
            return url;
        }

        const proxyAgent = new ProxyAgent({
            httpAgent,
            httpsAgent,
            keepAlive: enableKeepAlive,
            getProxyForUrl,
        });

        http.globalAgent = proxyAgent;
        https.globalAgent = proxyAgent;

        console.info();
        console.info(color.green(LOG_HEADER), 'Proxy URL is used:', color.blue(url));
        console.info();
    } catch (error) {
        console.error(color.red(LOG_HEADER), 'Failed to initialize request proxy:', error);
    }
}
