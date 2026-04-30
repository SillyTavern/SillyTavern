import net from 'node:net';
import tls from 'node:tls';
import http from 'node:http';
import https from 'node:https';
import dns from 'node:dns';
import ipMatch from 'ip-matching';
import ipRegex from 'ip-regex';
import { Agent } from 'agent-base';
import { color } from './util.js';
import { filterValidIpPatterns } from './express-common.js';

const LOG_HEADER = '[Private Request Filter]';

/** @type {import('ip-matching').IPMatch[]} */
const privateIpRanges = [
    // Loopback (IPv4)
    ipMatch.getMatch('127.0.0.0/8'),
    // Class A private network
    ipMatch.getMatch('10.0.0.0/8'),
    // Class B private network
    ipMatch.getMatch('172.16.0.0/12'),
    // Class C private network
    ipMatch.getMatch('192.168.0.0/16'),
    // Link-local address (IPv4)
    ipMatch.getMatch('169.254.0.0/16'),
    // Loopback (IPv6)
    ipMatch.getMatch('::1/128'),
    // Unique local address (IPv6)
    ipMatch.getMatch('fc00::/7'),
    // Link-local address (IPv6)
    ipMatch.getMatch('fe80::/10'),
];

/**
 * Custom HTTP/HTTPS agent that blocks requests to private IP addresses unless they are explicitly allowed in the private address whitelist.
 * This is used to prevent Server-Side Request Forgery (SSRF) attacks by ensuring that the server cannot make requests to internal services or resources that are not intended to be exposed.
 * The agent checks if the target host resolves to a private IP address and blocks the request if it does, unless the IP address is included in the private address whitelist.
 * The private address whitelist can contain specific IP addresses or CIDR ranges that are allowed to be accessed even if they fall within private IP ranges.
 */
class PrivateRequestAgent extends Agent {
    /**
     * List of private IP addresses or CIDR ranges to allow
     * @type {Readonly<import('ip-matching').IPMatch[]>}
     */
    privateAddressWhitelist = [];

    /**
     * Whether to log blocked requests to the console
     * @type {boolean}
     */
    logBlocked = true;

    /**
     * Whether to log allowed requests to the console
     * @type {boolean}
     */
    logAllowed = false;

    /**
     * Whether to allow requests to hosts that cannot be resolved
     * @type {boolean}
     */
    allowUnresolvedHosts = false;

    /**
     * Create a new PrivateRequestAgent instance.
     * @param {object} options
     * @param {string[]} options.privateAddressWhitelist List of private IP addresses or CIDR ranges to allow.
     * @param {boolean} options.logBlocked Whether to log blocked requests to the console.
     * @param {boolean} options.logAllowed Whether to log allowed requests to the console.
     * @param {boolean} options.allowUnresolvedHosts Whether to allow requests to hosts that cannot be resolved.
     * @param {boolean} options.enableKeepAlive Whether to enable HTTP/HTTPS keep-alive.
     */
    constructor(options = { privateAddressWhitelist: [], logBlocked: true, logAllowed: false, allowUnresolvedHosts: false, enableKeepAlive: false }) {
        super({ keepAlive: options.enableKeepAlive });

        const logEntryWarning = (entry, message) => `${color.red('Warning')}: Ignoring invalid private whitelist entry ${color.yellow(entry)} - ${message}`;
        const whitelistArray = Array.isArray(options.privateAddressWhitelist) ? options.privateAddressWhitelist : [];
        this.privateAddressWhitelist = Object.freeze(filterValidIpPatterns(whitelistArray, logEntryWarning).map(pattern => ipMatch.getMatch(pattern)));
        this.allowUnresolvedHosts = options.allowUnresolvedHosts;
        this.logBlocked = options.logBlocked;
        this.logAllowed = options.logAllowed;
    }

    /**
     * Check if the given address is a private IP address.
     * @param {string} address The IP address to check.
     * @returns {boolean} Whether the given address is a private IP address.
     */
    #isPrivateIp(address) {
        return privateIpRanges.some(range => range.matches(address));
    }

    /**
     * Check if the given address is allowed based on the private address whitelist.
     * @param {string} address The IP address to check.
     * @returns {boolean} Whether the given address is allowed based on the private address whitelist.
     */
    #isAllowedPrivateAddress(address) {
        // Permit the request if the private IP address is in the whitelist
        return this.privateAddressWhitelist.some(match => match.matches(address));
    }

    /**
     * Connect method that checks if the target host resolves to a private IP address and blocks the request if it does.
     * @param {http.ClientRequest} _req HTTP request object.
     * @param {import('agent-base').AgentConnectOpts} options Agent connection options.
     */
    async connect(_req, options) {
        /**
         * Raise an error and log it if necessary.
         * @param {string} message The error message.
         * @param {boolean} [log=true] Whether to log the error to the console.
         */
        const raiseError = (message, log = true) => {
            if (log) {
                console.error(color.red(LOG_HEADER), message);
            }
            throw new Error(message);
        };

        /**
         * Establish a connection to the target host using either TLS or a regular socket based on the options provided.
         * @param {string|null} [hostOverride] Pass a host to override the one in options when connecting.
         * @returns {net.Socket|tls.TLSSocket} A socket connected to the target host.
         */
        const connect = (hostOverride = null) => {
            if (hostOverride) {
                options.host = hostOverride;
            }
            if (options.secureEndpoint) {
                return tls.connect(options);
            } else {
                return net.connect(options);
            }
        };

        /**
         * Validate the given IP address against the private address whitelist and connect if it's allowed.
         * @param {string} ip The IP address to validate.
         * @returns {net.Socket|tls.TLSSocket} A socket connected to the target IP address if it's allowed, otherwise an error is raised.
         */
        const validateIpAddress = (ip) => {
            // Not a private IP address, allow the request
            if (!this.#isPrivateIp(ip)) {
                return connect(ip);
            }

            // Private IP address, check if it's allowed in the whitelist
            if (this.#isAllowedPrivateAddress(ip)) {
                if (this.logAllowed) {
                    console.info(color.green(LOG_HEADER), 'Allowed request to private IP address:', color.blue(ip));
                }

                return connect(ip);
            }

            return raiseError(`Blocked request to private IP address: ${ip}`, this.logBlocked);
        };

        /**
         * Resolve the given host to an IP address using DNS lookup.
         * @param {string} host The host to resolve to an IP address.
         * @returns {Promise<string>} The resolved IP address for the given host, or an empty string if the host cannot be resolved.
         */
        const lookupHost = async (host) => {
            try {
                return (await dns.promises.lookup(host)).address;
            } catch {
                return '';
            }
        };

        const host = options.host;

        if (!host) {
            return raiseError('No host specified in request options', true);
        }

        const isIp = ipRegex.v4({ exact: true }).test(host) || ipRegex.v6({ exact: true }).test(host);

        if (isIp) {
            return validateIpAddress(host);
        } else {
            const address = await lookupHost(host);
            if (!address) {
                if (this.allowUnresolvedHosts) {
                    return connect();
                } else {
                    return raiseError(`Unable to resolve host: ${host}. Set privateAddressWhitelist.allowUnresolvedHosts to true to bypass this check.`, true);
                }
            }

            return validateIpAddress(address);
        }
    }
}

/**
 * Initialize the private request filter by replacing the global HTTP and HTTPS agents with an instance of PrivateRequestAgent.
 * @param {object} options Options for initializing the private request filter.
 * @param {boolean} options.listen Whether the server is listening for incoming requests. This is used to determine whether to log a warning if the private request filter is not enabled.
 * @param {boolean} options.enabled Whether the private request filter is enabled.
 * @param {string[]} options.privateAddressWhitelist List of private IP addresses or CIDR ranges to allow.
 * @param {boolean} options.logBlocked Whether to log blocked requests to the console.
 * @param {boolean} options.logAllowed Whether to log allowed requests to the console.
 * @param {boolean} options.allowUnresolvedHosts Whether to allow requests to hosts that cannot be resolved.
 * @param {boolean} options.enableKeepAlive Whether to enable HTTP/HTTPS keep-alive.
 */
export default function initPrivateRequestFilter({ listen, enabled, privateAddressWhitelist, logBlocked, logAllowed, allowUnresolvedHosts, enableKeepAlive }) {
    if (!enabled) {
        if (listen) {
            console.warn();
            console.warn(color.yellow('Warning: listen is enabled but private request filter is disabled. This may expose your server to SSRF attacks.'));
            console.warn(color.blue('To enable, provide trusted addresses in privateAddressWhitelist.allowedRanges and set privateAddressWhitelist.enabled to true in config.yaml and restart the server.'));
        }
        return;
    }

    const agent = new PrivateRequestAgent({ privateAddressWhitelist, logBlocked, logAllowed, allowUnresolvedHosts, enableKeepAlive });

    http.globalAgent = agent;
    https.globalAgent = agent;

    console.info();
    console.info(color.green(LOG_HEADER), 'Enabled');
    if (agent.privateAddressWhitelist.length > 0) {
        console.info(color.green(LOG_HEADER), 'Allowed private addresses:', color.blue(agent.privateAddressWhitelist.join(', ')));
    }
    console.info();
}
