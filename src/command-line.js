import fs from 'node:fs';
import path from 'node:path';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';
import ipRegex from 'ip-regex';
import envPaths from 'env-paths';
import { color, getConfigValue, stringToBool } from './util.js';
import { initConfig } from './config-init.js';

/**
 * @typedef {object} CommandLineArguments Parsed command line arguments
 * @property {string} configPath Path to the config file
 * @property {string} dataRoot Data root directory
 * @property {number} port Port number
 * @property {boolean} listen If SillyTavern is listening on all network interfaces
 * @property {string} listenAddressIPv6 IPv6 address to listen to
 * @property {string} listenAddressIPv4 IPv4 address to listen to
 * @property {boolean|string} enableIPv4 If enable IPv4 protocol ("auto" is also allowed)
 * @property {boolean|string} enableIPv6 If enable IPv6 protocol ("auto" is also allowed)
 * @property {boolean} dnsPreferIPv6 If prefer IPv6 for DNS
 * @property {boolean} browserLaunchEnabled If automatically launch SillyTavern in the browser
 * @property {string} browserLaunchHostname Browser launch hostname
 * @property {number} browserLaunchPort Browser launch port override (-1 is use server port)
 * @property {boolean} browserLaunchAvoidLocalhost If avoid using 'localhost' for browser launch in auto mode
 * @property {boolean} enableCorsProxy If enable CORS proxy
 * @property {boolean} disableCsrf If disable CSRF protection
 * @property {boolean} ssl If enable SSL
 * @property {string} certPath Path to certificate
 * @property {string} keyPath Path to private key
 * @property {boolean} whitelistMode If enable whitelist mode
 * @property {boolean} basicAuthMode If enable basic authentication
 * @property {boolean} requestProxyEnabled If enable outgoing request proxy
 * @property {string} requestProxyUrl Request proxy URL
 * @property {string[]} requestProxyBypass Request proxy bypass list
 * @property {function(): URL} getIPv4ListenUrl Get IPv4 listen URL
 * @property {function(): URL} getIPv6ListenUrl Get IPv6 listen URL
 * @property {function(import('./server-startup.js').ServerStartupResult): Promise<string>} getBrowserLaunchHostname Get browser launch hostname
 * @property {function(string): URL} getBrowserLaunchUrl Get browser launch URL
 */

/**
 * Provides a command line arguments parser.
 */
export class CommandLineParser {
    /**
     * Gets the default configuration values.
     * @param {boolean} isGlobal If the configuration is global or not
     * @returns {CommandLineArguments} Default configuration values
     */
    getDefaultConfig(isGlobal) {
        const appPaths = envPaths('SillyTavern', { suffix: '' });
        const configPath = isGlobal ? path.join(appPaths.data, 'config.yaml') : './config.yaml';
        const dataPath = isGlobal ? path.join(appPaths.data, 'data') : './data';
        return Object.freeze({
            configPath: configPath,
            dataRoot: dataPath,
            port: 8000,
            listen: false,
            listenAddressIPv6: '[::]',
            listenAddressIPv4: '0.0.0.0',
            enableIPv4: true,
            enableIPv6: false,
            dnsPreferIPv6: false,
            browserLaunchEnabled: false,
            browserLaunchHostname: 'auto',
            browserLaunchPort: -1,
            browserLaunchAvoidLocalhost: false,
            enableCorsProxy: false,
            disableCsrf: false,
            ssl: false,
            certPath: 'certs/cert.pem',
            keyPath: 'certs/privkey.pem',
            whitelistMode: true,
            basicAuthMode: false,
            requestProxyEnabled: false,
            requestProxyUrl: '',
            requestProxyBypass: [],
            getIPv4ListenUrl: function () {
                throw new Error('getIPv4ListenUrl is not implemented');
            },
            getIPv6ListenUrl: function () {
                throw new Error('getIPv6ListenUrl is not implemented');
            },
            getBrowserLaunchHostname: async function () {
                throw new Error('getBrowserLaunchHostname is not implemented');
            },
            getBrowserLaunchUrl: function () {
                throw new Error('getBrowserLaunchUrl is not implemented');
            },
        });
    }

    constructor() {
        this.booleanAutoOptions = [true, false, 'auto'];
    }

    /**
     * Parses command line arguments.
     * Arguments that are not provided will be filled with config values.
     * @param {string[]} args Process startup arguments.
     * @returns {CommandLineArguments} Parsed command line arguments.
     */
    parse(args) {
        const cliArguments = yargs(hideBin(args))
            .usage('Usage: <your-start-script> [options]\nOptions that are not provided will be filled with config values.')
            .option('global', {
                type: 'boolean',
                default: null,
                describe: 'Use global data and config paths instead of the server directory',
            })
            .option('configPath', {
                type: 'string',
                default: null,
                describe: 'Path to the config file (only for standalone mode)',
            })
            .option('enableIPv6', {
                type: 'string',
                default: null,
                describe: 'Enables IPv6 protocol',
            })
            .option('enableIPv4', {
                type: 'string',
                default: null,
                describe: 'Enables IPv4 protocol',
            })
            .option('port', {
                type: 'number',
                default: null,
                describe: 'Sets the server listening port',
            })
            .option('dnsPreferIPv6', {
                type: 'boolean',
                default: null,
                describe: 'Prefers IPv6 for DNS\nYou should probably have the enabled if you\'re on an IPv6 only network',
            })
            .option('browserLaunchEnabled', {
                type: 'boolean',
                default: null,
                describe: 'Automatically launch SillyTavern in the browser',
            })
            .option('browserLaunchHostname', {
                type: 'string',
                default: null,
                describe: 'Sets the browser launch hostname, best left on \'auto\'.\nUse values like \'localhost\', \'st.example.com\'',
            })
            .option('browserLaunchPort', {
                type: 'number',
                default: null,
                describe: 'Overrides the port for browser launch with open your browser with this port and ignore what port the server is running on. -1 is use server port',
            })
            .option('browserLaunchAvoidLocalhost', {
                type: 'boolean',
                default: null,
                describe: 'Avoids using \'localhost\' for browser launch in auto mode.\nUse if you don\'t have \'localhost\' in your hosts file',
            })
            .option('listen', {
                type: 'boolean',
                default: null,
                describe: 'Whether to listen on all network interfaces',
            })
            .option('listenAddressIPv6', {
                type: 'string',
                default: null,
                describe: 'Specific IPv6 address to listen to',
            })
            .option('listenAddressIPv4', {
                type: 'string',
                default: null,
                describe: 'Specific IPv4 address to listen to',
            })
            .option('corsProxy', {
                type: 'boolean',
                default: null,
                describe: 'Enables CORS proxy',
            })
            .option('disableCsrf', {
                type: 'boolean',
                default: null,
                describe: 'Disables CSRF protection - NOT RECOMMENDED',
            })
            .option('ssl', {
                type: 'boolean',
                default: null,
                describe: 'Enables SSL',
            })
            .option('certPath', {
                type: 'string',
                default: null,
                describe: 'Path to SSL certificate file',
            })
            .option('keyPath', {
                type: 'string',
                default: null,
                describe: 'Path to SSL private key file',
            })
            .option('whitelist', {
                type: 'boolean',
                default: null,
                describe: 'Enables whitelist mode',
            })
            .option('dataRoot', {
                type: 'string',
                default: null,
                describe: 'Root directory for data storage (only for standalone mode)',
            })
            .option('basicAuthMode', {
                type: 'boolean',
                default: null,
                describe: 'Enables basic authentication',
            })
            .option('requestProxyEnabled', {
                type: 'boolean',
                default: null,
                describe: 'Enables a use of proxy for outgoing requests',
            })
            .option('requestProxyUrl', {
                type: 'string',
                default: null,
                describe: 'Request proxy URL (HTTP or SOCKS protocols)',
            })
            .option('requestProxyBypass', {
                type: 'array',
                describe: 'Request proxy bypass list (space separated list of hosts)',
            })
            /* DEPRECATED options */
            .option('autorun', {
                type: 'boolean',
                default: null,
                describe: 'DEPRECATED: Use "browserLaunchEnabled" instead.',
            })
            .option('autorunHostname', {
                type: 'string',
                default: null,
                describe: 'DEPRECATED: Use "browserLaunchHostname" instead.',
            })
            .option('autorunPortOverride', {
                type: 'number',
                default: null,
                describe: 'DEPRECATED: Use "browserLaunchPort" instead.',
            })
            .option('avoidLocalhost', {
                type: 'boolean',
                default: null,
                describe: 'DEPRECATED: Use "browserLaunchAvoidLocalhost" instead.',
            })
            .parseSync();

        const isGlobal = globalThis.FORCE_GLOBAL_MODE ?? cliArguments.global ?? false;
        const defaultConfig = this.getDefaultConfig(isGlobal);

        if (isGlobal && cliArguments.configPath) {
            console.warn(color.yellow('Warning: "--configPath" argument is ignored in global mode'));
        }

        if (isGlobal && cliArguments.dataRoot) {
            console.warn(color.yellow('Warning: "--dataRoot" argument is ignored in global mode'));
        }

        const configPath = isGlobal
            ? defaultConfig.configPath
            : (cliArguments.configPath ?? defaultConfig.configPath);
        if (isGlobal && !fs.existsSync(path.dirname(configPath))) {
            fs.mkdirSync(path.dirname(configPath), { recursive: true });
        }
        initConfig(configPath);

        const dataRoot = isGlobal
            ? defaultConfig.dataRoot
            : (cliArguments.dataRoot ?? getConfigValue('dataRoot', defaultConfig.dataRoot));
        if (isGlobal && !fs.existsSync(dataRoot)) {
            fs.mkdirSync(dataRoot, { recursive: true });
        }

        /** @type {CommandLineArguments} */
        const result = {
            configPath: configPath,
            dataRoot: dataRoot,
            port: cliArguments.port ?? getConfigValue('port', defaultConfig.port, 'number'),
            listen: cliArguments.listen ?? getConfigValue('listen', defaultConfig.listen, 'boolean'),
            listenAddressIPv6: cliArguments.listenAddressIPv6 ?? getConfigValue('listenAddress.ipv6', defaultConfig.listenAddressIPv6),
            listenAddressIPv4: cliArguments.listenAddressIPv4 ?? getConfigValue('listenAddress.ipv4', defaultConfig.listenAddressIPv4),
            enableIPv4: stringToBool(cliArguments.enableIPv4) ?? stringToBool(getConfigValue('protocol.ipv4', defaultConfig.enableIPv4)) ?? defaultConfig.enableIPv4,
            enableIPv6: stringToBool(cliArguments.enableIPv6) ?? stringToBool(getConfigValue('protocol.ipv6', defaultConfig.enableIPv6)) ?? defaultConfig.enableIPv6,
            dnsPreferIPv6: cliArguments.dnsPreferIPv6 ?? getConfigValue('dnsPreferIPv6', defaultConfig.dnsPreferIPv6, 'boolean'),
            browserLaunchEnabled: cliArguments.browserLaunchEnabled ?? cliArguments.autorun ?? getConfigValue('browserLaunch.enabled', defaultConfig.browserLaunchEnabled, 'boolean'),
            browserLaunchHostname: cliArguments.browserLaunchHostname ?? cliArguments.autorunHostname ?? getConfigValue('browserLaunch.hostname', defaultConfig.browserLaunchHostname),
            browserLaunchPort: cliArguments.browserLaunchPort ?? cliArguments.autorunPortOverride ?? getConfigValue('browserLaunch.port', defaultConfig.browserLaunchPort, 'number'),
            browserLaunchAvoidLocalhost: cliArguments.browserLaunchAvoidLocalhost ?? cliArguments.avoidLocalhost ?? getConfigValue('browserLaunch.avoidLocalhost', defaultConfig.browserLaunchAvoidLocalhost, 'boolean'),
            enableCorsProxy: cliArguments.corsProxy ?? getConfigValue('enableCorsProxy', defaultConfig.enableCorsProxy, 'boolean'),
            disableCsrf: cliArguments.disableCsrf ?? getConfigValue('disableCsrfProtection', defaultConfig.disableCsrf, 'boolean'),
            ssl: cliArguments.ssl ?? getConfigValue('ssl.enabled', defaultConfig.ssl, 'boolean'),
            certPath: cliArguments.certPath ?? getConfigValue('ssl.certPath', defaultConfig.certPath),
            keyPath: cliArguments.keyPath ?? getConfigValue('ssl.keyPath', defaultConfig.keyPath),
            whitelistMode: cliArguments.whitelist ?? getConfigValue('whitelistMode', defaultConfig.whitelistMode, 'boolean'),
            basicAuthMode: cliArguments.basicAuthMode ?? getConfigValue('basicAuthMode', defaultConfig.basicAuthMode, 'boolean'),
            requestProxyEnabled: cliArguments.requestProxyEnabled ?? getConfigValue('requestProxy.enabled', defaultConfig.requestProxyEnabled, 'boolean'),
            requestProxyUrl: cliArguments.requestProxyUrl ?? getConfigValue('requestProxy.url', defaultConfig.requestProxyUrl),
            requestProxyBypass: cliArguments.requestProxyBypass ?? getConfigValue('requestProxy.bypass', defaultConfig.requestProxyBypass),
            getIPv4ListenUrl: function () {
                const isValid = ipRegex.v4({ exact: true }).test(this.listenAddressIPv4);
                return new URL(
                    (this.ssl ? 'https://' : 'http://') +
                    (this.listen ? (isValid ? this.listenAddressIPv4 : '0.0.0.0') : '127.0.0.1') +
                    (':' + this.port),
                );
            },
            getIPv6ListenUrl: function () {
                const isValid = ipRegex.v6({ exact: true }).test(this.listenAddressIPv6);
                return new URL(
                    (this.ssl ? 'https://' : 'http://') +
                    (this.listen ? (isValid ? this.listenAddressIPv6 : '[::]') : '[::1]') +
                    (':' + this.port),
                );
            },
            getBrowserLaunchHostname: async function ({ useIPv6, useIPv4 }) {
                if (this.browserLaunchHostname === 'auto') {
                    if (useIPv6 && useIPv4) {
                        return this.browserLaunchAvoidLocalhost ? '[::1]' : 'localhost';
                    }

                    if (useIPv6) {
                        return '[::1]';
                    }

                    if (useIPv4) {
                        return '127.0.0.1';
                    }
                }

                return this.browserLaunchHostname;
            },
            getBrowserLaunchUrl: function (hostname) {
                const browserLaunchPort = (this.browserLaunchPort >= 0) ? this.browserLaunchPort : this.port;
                return new URL(
                    (this.ssl ? 'https://' : 'http://') +
                    (hostname) +
                    (':') +
                    (browserLaunchPort),
                );
            },
        };

        if (!this.booleanAutoOptions.includes(result.enableIPv6)) {
            console.warn(color.red('`protocol: ipv6` option invalid'), '\n use:', this.booleanAutoOptions, '\n setting to:', defaultConfig.enableIPv6);
            result.enableIPv6 = defaultConfig.enableIPv6;
        }

        if (!this.booleanAutoOptions.includes(result.enableIPv4)) {
            console.warn(color.red('`protocol: ipv4` option invalid'), '\n use:', this.booleanAutoOptions, '\n setting to:', defaultConfig.enableIPv4);
            result.enableIPv4 = defaultConfig.enableIPv4;
        }

        return result;
    }
}
