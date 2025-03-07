#!/usr/bin/env node

// native node modules
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
import os from 'os';
import path from 'node:path';
import util from 'node:util';
import net from 'node:net';
import dns from 'node:dns';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

// cli/fs related library imports
import open from 'open';
import yargs from 'yargs/yargs';
import { hideBin } from 'yargs/helpers';

// express/server related library imports
import cors from 'cors';
import { csrfSync } from 'csrf-sync';
import express from 'express';
import compression from 'compression';
import cookieSession from 'cookie-session';
import multer from 'multer';
import responseTime from 'response-time';
import helmet from 'helmet';
import bodyParser from 'body-parser';

// net related library imports
import fetch from 'node-fetch';
import ipRegex from 'ip-regex';

// Unrestrict console logs display limit
util.inspect.defaultOptions.maxArrayLength = null;
util.inspect.defaultOptions.maxStringLength = null;
util.inspect.defaultOptions.depth = 4;

// local library imports
import { loadPlugins } from './src/plugin-loader.js';
import {
    initUserStorage,
    getCookieSecret,
    getCookieSessionName,
    getAllEnabledUsers,
    ensurePublicDirectoriesExist,
    getUserDirectoriesList,
    migrateSystemPrompts,
    migrateUserData,
    requireLoginMiddleware,
    setUserDataMiddleware,
    shouldRedirectToLogin,
    tryAutoLogin,
    router as userDataRouter,
} from './src/users.js';

import getWebpackServeMiddleware from './src/middleware/webpack-serve.js';
import basicAuthMiddleware from './src/middleware/basicAuth.js';
import whitelistMiddleware from './src/middleware/whitelist.js';
import multerMonkeyPatch from './src/middleware/multerMonkeyPatch.js';
import initRequestProxy from './src/request-proxy.js';
import getCacheBusterMiddleware from './src/middleware/cacheBuster.js';
import {
    getVersion,
    getConfigValue,
    color,
    forwardFetchResponse,
    removeColorFormatting,
    getSeparator,
    stringToBool,
    urlHostnameToIPv6,
    canResolve,
    safeReadFileSync,
    setupLogLevel,
} from './src/util.js';
import { UPLOADS_DIRECTORY } from './src/constants.js';
import { ensureThumbnailCache } from './src/endpoints/thumbnails.js';

// Routers
import { router as usersPublicRouter } from './src/endpoints/users-public.js';
import { router as usersPrivateRouter } from './src/endpoints/users-private.js';
import { router as usersAdminRouter } from './src/endpoints/users-admin.js';
import { router as movingUIRouter } from './src/endpoints/moving-ui.js';
import { router as imagesRouter } from './src/endpoints/images.js';
import { router as quickRepliesRouter } from './src/endpoints/quick-replies.js';
import { router as avatarsRouter } from './src/endpoints/avatars.js';
import { router as themesRouter } from './src/endpoints/themes.js';
import { router as openAiRouter } from './src/endpoints/openai.js';
import { router as googleRouter } from './src/endpoints/google.js';
import { router as anthropicRouter } from './src/endpoints/anthropic.js';
import { router as tokenizersRouter } from './src/endpoints/tokenizers.js';
import { router as presetsRouter } from './src/endpoints/presets.js';
import { router as secretsRouter } from './src/endpoints/secrets.js';
import { router as thumbnailRouter } from './src/endpoints/thumbnails.js';
import { router as novelAiRouter } from './src/endpoints/novelai.js';
import { router as extensionsRouter } from './src/endpoints/extensions.js';
import { router as assetsRouter } from './src/endpoints/assets.js';
import { router as filesRouter } from './src/endpoints/files.js';
import { router as charactersRouter } from './src/endpoints/characters.js';
import { router as chatsRouter } from './src/endpoints/chats.js';
import { router as groupsRouter } from './src/endpoints/groups.js';
import { router as worldInfoRouter } from './src/endpoints/worldinfo.js';
import { router as statsRouter, init as statsInit, onExit as statsOnExit } from './src/endpoints/stats.js';
import { router as backgroundsRouter } from './src/endpoints/backgrounds.js';
import { router as spritesRouter } from './src/endpoints/sprites.js';
import { router as contentManagerRouter, checkForNewContent } from './src/endpoints/content-manager.js';
import { router as settingsRouter, init as settingsInit } from './src/endpoints/settings.js';
import { router as stableDiffusionRouter } from './src/endpoints/stable-diffusion.js';
import { router as hordeRouter } from './src/endpoints/horde.js';
import { router as vectorsRouter } from './src/endpoints/vectors.js';
import { router as translateRouter } from './src/endpoints/translate.js';
import { router as classifyRouter } from './src/endpoints/classify.js';
import { router as captionRouter } from './src/endpoints/caption.js';
import { router as searchRouter } from './src/endpoints/search.js';
import { router as openRouterRouter } from './src/endpoints/openrouter.js';
import { router as chatCompletionsRouter } from './src/endpoints/backends/chat-completions.js';
import { router as koboldRouter } from './src/endpoints/backends/kobold.js';
import { router as textCompletionsRouter } from './src/endpoints/backends/text-completions.js';
import { router as scaleAltRouter } from './src/endpoints/backends/scale-alt.js';
import { router as speechRouter } from './src/endpoints/speech.js';
import { router as azureRouter } from './src/endpoints/azure.js';

// Work around a node v20.0.0, v20.1.0, and v20.2.0 bug. The issue was fixed in v20.3.0.
// https://github.com/nodejs/node/issues/47822#issuecomment-1564708870
// Safe to remove once support for Node v20 is dropped.
if (process.versions && process.versions.node && process.versions.node.match(/20\.[0-2]\.0/)) {
    // @ts-ignore
    if (net.setDefaultAutoSelectFamily) net.setDefaultAutoSelectFamily(false);
}

const DEFAULT_PORT = 8000;
const DEFAULT_AUTORUN = false;
const DEFAULT_LISTEN = false;
const DEFAULT_LISTEN_ADDRESS_IPV6 = '[::]';
const DEFAULT_LISTEN_ADDRESS_IPV4 = '0.0.0.0';
const DEFAULT_CORS_PROXY = false;
const DEFAULT_WHITELIST = true;
const DEFAULT_ACCOUNTS = false;
const DEFAULT_CSRF_DISABLED = false;
const DEFAULT_BASIC_AUTH = false;
const DEFAULT_PER_USER_BASIC_AUTH = false;

const DEFAULT_ENABLE_IPV6 = false;
const DEFAULT_ENABLE_IPV4 = true;

const DEFAULT_PREFER_IPV6 = false;

const DEFAULT_AVOID_LOCALHOST = false;

const DEFAULT_AUTORUN_HOSTNAME = 'auto';
const DEFAULT_AUTORUN_PORT = -1;

const DEFAULT_PROXY_ENABLED = false;
const DEFAULT_PROXY_URL = '';
const DEFAULT_PROXY_BYPASS = [];

const cliArguments = yargs(hideBin(process.argv))
    .usage('Usage: <your-start-script> <command> [options]')
    .option('enableIPv6', {
        type: 'string',
        default: null,
        describe: `Enables IPv6.\n[config default: ${DEFAULT_ENABLE_IPV6}]`,
    }).option('enableIPv4', {
        type: 'string',
        default: null,
        describe: `Enables IPv4.\n[config default: ${DEFAULT_ENABLE_IPV4}]`,
    }).option('port', {
        type: 'number',
        default: null,
        describe: `Sets the port under which SillyTavern will run.\nIf not provided falls back to yaml config 'port'.\n[config default: ${DEFAULT_PORT}]`,
    }).option('dnsPreferIPv6', {
        type: 'boolean',
        default: null,
        describe: `Prefers IPv6 for dns\nyou should probably have the enabled if you're on an IPv6 only network\nIf not provided falls back to yaml config 'preferIPv6'.\n[config default: ${DEFAULT_PREFER_IPV6}]`,
    }).option('autorun', {
        type: 'boolean',
        default: null,
        describe: `Automatically launch SillyTavern in the browser.\nAutorun is automatically disabled if --ssl is set to true.\nIf not provided falls back to yaml config 'autorun'.\n[config default: ${DEFAULT_AUTORUN}]`,
    }).option('autorunHostname', {
        type: 'string',
        default: null,
        describe: 'the autorun hostname, probably best left on \'auto\'.\nuse values like \'localhost\', \'st.example.com\'',
    }).option('autorunPortOverride', {
        type: 'string',
        default: null,
        describe: 'Overrides the port for autorun with open your browser with this port and ignore what port the server is running on. -1 is use server port',
    }).option('listen', {
        type: 'boolean',
        default: null,
        describe: `SillyTavern is listening on all network interfaces (Wi-Fi, LAN, localhost). If false, will limit it only to internal localhost (127.0.0.1).\nIf not provided falls back to yaml config 'listen'.\n[config default: ${DEFAULT_LISTEN}]`,
    }).option('listenAddressIPv6', {
        type: 'string',
        default: null,
        describe: 'Set SillyTavern to listen to a specific IPv6 address. If not set, it will fallback to listen to all.\n[config default: [::] ]',
    }).option('listenAddressIPv4', {
        type: 'string',
        default: null,
        describe: 'Set SillyTavern to listen to a specific IPv4 address. If not set, it will fallback to listen to all.\n[config default: 0.0.0.0 ]',
    }).option('corsProxy', {
        type: 'boolean',
        default: null,
        describe: `Enables CORS proxy\nIf not provided falls back to yaml config 'enableCorsProxy'.\n[config default: ${DEFAULT_CORS_PROXY}]`,
    }).option('disableCsrf', {
        type: 'boolean',
        default: null,
        describe: 'Disables CSRF protection',
    }).option('ssl', {
        type: 'boolean',
        default: false,
        describe: 'Enables SSL',
    }).option('certPath', {
        type: 'string',
        default: 'certs/cert.pem',
        describe: 'Path to your certificate file.',
    }).option('keyPath', {
        type: 'string',
        default: 'certs/privkey.pem',
        describe: 'Path to your private key file.',
    }).option('whitelist', {
        type: 'boolean',
        default: null,
        describe: 'Enables whitelist mode',
    }).option('dataRoot', {
        type: 'string',
        default: null,
        describe: 'Root directory for data storage',
    }).option('avoidLocalhost', {
        type: 'boolean',
        default: null,
        describe: 'Avoids using \'localhost\' for autorun in auto mode.\nuse if you don\'t have \'localhost\' in your hosts file',
    }).option('basicAuthMode', {
        type: 'boolean',
        default: null,
        describe: 'Enables basic authentication',
    }).option('requestProxyEnabled', {
        type: 'boolean',
        default: null,
        describe: 'Enables a use of proxy for outgoing requests',
    }).option('requestProxyUrl', {
        type: 'string',
        default: null,
        describe: 'Request proxy URL (HTTP or SOCKS protocols)',
    }).option('requestProxyBypass', {
        type: 'array',
        default: null,
        describe: 'Request proxy bypass list (space separated list of hosts)',
    }).parseSync();

// change all relative paths
const serverDirectory = import.meta.dirname ?? path.dirname(fileURLToPath(import.meta.url));
console.log(`Node version: ${process.version}. Running in ${process.env.NODE_ENV} environment. Server directory: ${serverDirectory}`);
process.chdir(serverDirectory);

const app = express();
app.use(helmet({
    contentSecurityPolicy: false,
}));
app.use(compression());
app.use(responseTime());


/** @type {number} */
const server_port = cliArguments.port ?? process.env.SILLY_TAVERN_PORT ?? getConfigValue('port', DEFAULT_PORT);
/** @type {boolean} */
const autorun = (cliArguments.autorun ?? getConfigValue('autorun', DEFAULT_AUTORUN)) && !cliArguments.ssl;
/** @type {boolean} */
const listen = cliArguments.listen ?? getConfigValue('listen', DEFAULT_LISTEN);
/** @type {string} */
const listenAddressIPv6 = cliArguments.listenAddressIPv6 ?? getConfigValue('listenAddress.ipv6', DEFAULT_LISTEN_ADDRESS_IPV6);
/** @type {string} */
const listenAddressIPv4 = cliArguments.listenAddressIPv4 ?? getConfigValue('listenAddress.ipv4', DEFAULT_LISTEN_ADDRESS_IPV4);
/** @type {boolean} */
const enableCorsProxy = cliArguments.corsProxy ?? getConfigValue('enableCorsProxy', DEFAULT_CORS_PROXY);
const enableWhitelist = cliArguments.whitelist ?? getConfigValue('whitelistMode', DEFAULT_WHITELIST);
/** @type {string} */
const dataRoot = cliArguments.dataRoot ?? getConfigValue('dataRoot', './data');
/** @type {boolean} */
const disableCsrf = cliArguments.disableCsrf ?? getConfigValue('disableCsrfProtection', DEFAULT_CSRF_DISABLED);
const basicAuthMode = cliArguments.basicAuthMode ?? getConfigValue('basicAuthMode', DEFAULT_BASIC_AUTH);
const perUserBasicAuth = getConfigValue('perUserBasicAuth', DEFAULT_PER_USER_BASIC_AUTH);
/** @type {boolean} */
const enableAccounts = getConfigValue('enableUserAccounts', DEFAULT_ACCOUNTS);

const uploadsPath = path.join(dataRoot, UPLOADS_DIRECTORY);


/** @type {boolean | "auto"} */
let enableIPv6 = stringToBool(cliArguments.enableIPv6) ?? getConfigValue('protocol.ipv6', DEFAULT_ENABLE_IPV6);
/** @type {boolean | "auto"} */
let enableIPv4 = stringToBool(cliArguments.enableIPv4) ?? getConfigValue('protocol.ipv4', DEFAULT_ENABLE_IPV4);

/** @type {string} */
const autorunHostname = cliArguments.autorunHostname ?? getConfigValue('autorunHostname', DEFAULT_AUTORUN_HOSTNAME);
/** @type {number} */
const autorunPortOverride = cliArguments.autorunPortOverride ?? getConfigValue('autorunPortOverride', DEFAULT_AUTORUN_PORT);

/** @type {boolean} */
const dnsPreferIPv6 = cliArguments.dnsPreferIPv6 ?? getConfigValue('dnsPreferIPv6', DEFAULT_PREFER_IPV6);

/** @type {boolean} */
const avoidLocalhost = cliArguments.avoidLocalhost ?? getConfigValue('avoidLocalhost', DEFAULT_AVOID_LOCALHOST);

const proxyEnabled = cliArguments.requestProxyEnabled ?? getConfigValue('requestProxy.enabled', DEFAULT_PROXY_ENABLED);
const proxyUrl = cliArguments.requestProxyUrl ?? getConfigValue('requestProxy.url', DEFAULT_PROXY_URL);
const proxyBypass = cliArguments.requestProxyBypass ?? getConfigValue('requestProxy.bypass', DEFAULT_PROXY_BYPASS);

if (dnsPreferIPv6) {
    // Set default DNS resolution order to IPv6 first
    dns.setDefaultResultOrder('ipv6first');
    console.log('Preferring IPv6 for DNS resolution');
} else {
    // Set default DNS resolution order to IPv4 first
    dns.setDefaultResultOrder('ipv4first');
    console.log('Preferring IPv4 for DNS resolution');
}


const ipOptions = [true, 'auto', false];

if (!ipOptions.includes(enableIPv6)) {
    console.warn(color.red('`protocol: ipv6` option invalid'), '\n use:', ipOptions, '\n setting to:', DEFAULT_ENABLE_IPV6);
    enableIPv6 = DEFAULT_ENABLE_IPV6;
}
if (!ipOptions.includes(enableIPv4)) {
    console.warn(color.red('`protocol: ipv4` option invalid'), '\n use:', ipOptions, '\n setting to:', DEFAULT_ENABLE_IPV4);
    enableIPv4 = DEFAULT_ENABLE_IPV4;
}

if (enableIPv6 === false && enableIPv4 === false) {
    console.error('error: You can\'t disable all internet protocols: at least IPv6 or IPv4 must be enabled.');
    process.exit(1);
}

// CORS Settings //
const CORS = cors({
    origin: 'null',
    methods: ['OPTIONS'],
});

app.use(CORS);

if (listen && basicAuthMode) app.use(basicAuthMiddleware);

app.use(whitelistMiddleware(enableWhitelist, listen));

if (enableCorsProxy) {
    app.use(bodyParser.json({
        limit: '200mb',
    }));
    console.log('Enabling CORS proxy');

    app.use('/proxy/:url(*)', async (req, res) => {
        const url = req.params.url; // get the url from the request path

        // Disallow circular requests
        const serverUrl = req.protocol + '://' + req.get('host');
        if (url.startsWith(serverUrl)) {
            return res.status(400).send('Circular requests are not allowed');
        }

        try {
            const headers = JSON.parse(JSON.stringify(req.headers));
            const headersToRemove = [
                'x-csrf-token', 'host', 'referer', 'origin', 'cookie',
                'x-forwarded-for', 'x-forwarded-protocol', 'x-forwarded-proto',
                'x-forwarded-host', 'x-real-ip', 'sec-fetch-mode',
                'sec-fetch-site', 'sec-fetch-dest',
            ];

            headersToRemove.forEach(header => delete headers[header]);

            const bodyMethods = ['POST', 'PUT', 'PATCH'];

            const response = await fetch(url, {
                method: req.method,
                headers: headers,
                body: bodyMethods.includes(req.method) ? JSON.stringify(req.body) : undefined,
            });

            // Copy over relevant response params to the proxy response
            forwardFetchResponse(response, res);

        } catch (error) {
            res.status(500).send('Error occurred while trying to proxy to: ' + url + ' ' + error);
        }
    });
} else {
    app.use('/proxy/:url(*)', async (_, res) => {
        const message = 'CORS proxy is disabled. Enable it in config.yaml or use the --corsProxy flag.';
        console.log(message);
        res.status(404).send(message);
    });
}

function getSessionCookieAge() {
    // Defaults to "no expiration" if not set
    const configValue = getConfigValue('sessionTimeout', -1);

    // Convert to milliseconds
    if (configValue > 0) {
        return configValue * 1000;
    }

    // "No expiration" is just 400 days as per RFC 6265
    if (configValue < 0) {
        return 400 * 24 * 60 * 60 * 1000;
    }

    // 0 means session cookie is deleted when the browser session ends
    // (depends on the implementation of the browser)
    return undefined;
}

/**
 * Checks the network interfaces to determine the presence of IPv6 and IPv4 addresses.
 *
 * @returns {Promise<[boolean, boolean, boolean, boolean]>} A promise that resolves to an array containing:
 * - [0]: `hasIPv6` (boolean) - Whether the computer has any IPv6 address, including (`::1`).
 * - [1]: `hasIPv4` (boolean) - Whether the computer has any IPv4 address, including (`127.0.0.1`).
 * - [2]: `hasIPv6Local` (boolean) - Whether the computer has local IPv6 address (`::1`).
 * - [3]: `hasIPv4Local` (boolean) - Whether the computer has local IPv4 address (`127.0.0.1`).
 */
async function getHasIP() {
    let hasIPv6 = false;
    let hasIPv6Local = false;

    let hasIPv4 = false;
    let hasIPv4Local = false;

    const interfaces = os.networkInterfaces();

    for (const iface of Object.values(interfaces)) {
        if (iface === undefined) {
            continue;
        }

        for (const info of iface) {
            if (info.family === 'IPv6') {
                hasIPv6 = true;
                if (info.address === '::1') {
                    hasIPv6Local = true;
                }
            }

            if (info.family === 'IPv4') {
                hasIPv4 = true;
                if (info.address === '127.0.0.1') {
                    hasIPv4Local = true;
                }
            }
            if (hasIPv6 && hasIPv4 && hasIPv6Local && hasIPv4Local) break;
        }
        if (hasIPv6 && hasIPv4 && hasIPv6Local && hasIPv4Local) break;
    }
    return [
        hasIPv6,
        hasIPv4,
        hasIPv6Local,
        hasIPv4Local,
    ];
}

app.use(cookieSession({
    name: getCookieSessionName(),
    sameSite: 'strict',
    httpOnly: true,
    maxAge: getSessionCookieAge(),
    secret: getCookieSecret(),
}));

app.use(setUserDataMiddleware);

// CSRF Protection //
if (!disableCsrf) {
    const csrfSyncProtection = csrfSync({
        getTokenFromState: (req) => {
            if (!req.session) {
                console.error('(CSRF error) getTokenFromState: Session object not initialized');
                return;
            }
            return req.session.csrfToken;
        },
        getTokenFromRequest: (req) => {
            return req.headers['x-csrf-token']?.toString();
        },
        storeTokenInState: (req, token) => {
            if (!req.session) {
                console.error('(CSRF error) storeTokenInState: Session object not initialized');
                return;
            }
            req.session.csrfToken = token;
        },
        size: 32,
    });

    app.get('/csrf-token', (req, res) => {
        res.json({
            'token': csrfSyncProtection.generateToken(req),
        });
    });

    // Customize the error message
    csrfSyncProtection.invalidCsrfTokenError.message = color.red('Invalid CSRF token. Please refresh the page and try again.');
    csrfSyncProtection.invalidCsrfTokenError.stack = undefined;

    app.use(csrfSyncProtection.csrfSynchronisedProtection);
} else {
    console.warn('\nCSRF protection is disabled. This will make your server vulnerable to CSRF attacks.\n');
    app.get('/csrf-token', (req, res) => {
        res.json({
            'token': 'disabled',
        });
    });
}

// Static files
// Host index page
app.get('/', getCacheBusterMiddleware(), (request, response) => {
    if (shouldRedirectToLogin(request)) {
        const query = request.url.split('?')[1];
        const redirectUrl = query ? `/login?${query}` : '/login';
        return response.redirect(redirectUrl);
    }

    return response.sendFile('index.html', { root: path.join(process.cwd(), 'public') });
});

// Host login page
app.get('/login', async (request, response) => {
    if (!enableAccounts) {
        console.log('User accounts are disabled. Redirecting to index page.');
        return response.redirect('/');
    }

    try {
        const autoLogin = await tryAutoLogin(request, basicAuthMode);

        if (autoLogin) {
            return response.redirect('/');
        }
    } catch (error) {
        console.error('Error during auto-login:', error);
    }

    return response.sendFile('login.html', { root: path.join(process.cwd(), 'public') });
});

// Host frontend assets
const webpackMiddleware = getWebpackServeMiddleware();
app.use(webpackMiddleware);
app.use(express.static(process.cwd() + '/public', {}));

// Public API
app.use('/api/users', usersPublicRouter);

// Everything below this line requires authentication
app.use(requireLoginMiddleware);
app.get('/api/ping', (request, response) => {
    if (request.query.extend && request.session) {
        request.session.touch = Date.now();
    }

    response.sendStatus(204);
});

// File uploads
app.use(multer({ dest: uploadsPath, limits: { fieldSize: 10 * 1024 * 1024 } }).single('avatar'));
app.use(multerMonkeyPatch);

// User data mount
app.use('/', userDataRouter);
// Private endpoints
app.use('/api/users', usersPrivateRouter);
// Admin endpoints
app.use('/api/users', usersAdminRouter);

app.get('/version', async function (_, response) {
    const data = await getVersion();
    response.send(data);
});

function cleanUploads() {
    try {
        if (fs.existsSync(uploadsPath)) {
            const uploads = fs.readdirSync(uploadsPath);

            if (!uploads.length) {
                return;
            }

            console.debug(`Cleaning uploads folder (${uploads.length} files)`);
            uploads.forEach(file => {
                const pathToFile = path.join(uploadsPath, file);
                fs.unlinkSync(pathToFile);
            });
        }
    } catch (err) {
        console.error(err);
    }
}

/**
 * Redirect a deprecated API endpoint URL to its replacement. Because fetch, form submissions, and $.ajax follow
 * redirects, this is transparent to client-side code.
 * @param {string} src The URL to redirect from.
 * @param {string} destination The URL to redirect to.
 */
function redirect(src, destination) {
    app.use(src, (req, res) => {
        console.warn(`API endpoint ${src} is deprecated; use ${destination} instead`);
        // HTTP 301 causes the request to become a GET. 308 preserves the request method.
        res.redirect(308, destination);
    });
}

// Redirect deprecated character API endpoints
redirect('/createcharacter', '/api/characters/create');
redirect('/renamecharacter', '/api/characters/rename');
redirect('/editcharacter', '/api/characters/edit');
redirect('/editcharacterattribute', '/api/characters/edit-attribute');
redirect('/v2/editcharacterattribute', '/api/characters/merge-attributes');
redirect('/deletecharacter', '/api/characters/delete');
redirect('/getcharacters', '/api/characters/all');
redirect('/getonecharacter', '/api/characters/get');
redirect('/getallchatsofcharacter', '/api/characters/chats');
redirect('/importcharacter', '/api/characters/import');
redirect('/dupecharacter', '/api/characters/duplicate');
redirect('/exportcharacter', '/api/characters/export');

// Redirect deprecated chat API endpoints
redirect('/savechat', '/api/chats/save');
redirect('/getchat', '/api/chats/get');
redirect('/renamechat', '/api/chats/rename');
redirect('/delchat', '/api/chats/delete');
redirect('/exportchat', '/api/chats/export');
redirect('/importgroupchat', '/api/chats/group/import');
redirect('/importchat', '/api/chats/import');
redirect('/getgroupchat', '/api/chats/group/get');
redirect('/deletegroupchat', '/api/chats/group/delete');
redirect('/savegroupchat', '/api/chats/group/save');

// Redirect deprecated group API endpoints
redirect('/getgroups', '/api/groups/all');
redirect('/creategroup', '/api/groups/create');
redirect('/editgroup', '/api/groups/edit');
redirect('/deletegroup', '/api/groups/delete');

// Redirect deprecated worldinfo API endpoints
redirect('/getworldinfo', '/api/worldinfo/get');
redirect('/deleteworldinfo', '/api/worldinfo/delete');
redirect('/importworldinfo', '/api/worldinfo/import');
redirect('/editworldinfo', '/api/worldinfo/edit');

// Redirect deprecated stats API endpoints
redirect('/getstats', '/api/stats/get');
redirect('/recreatestats', '/api/stats/recreate');
redirect('/updatestats', '/api/stats/update');

// Redirect deprecated backgrounds API endpoints
redirect('/getbackgrounds', '/api/backgrounds/all');
redirect('/delbackground', '/api/backgrounds/delete');
redirect('/renamebackground', '/api/backgrounds/rename');
redirect('/downloadbackground', '/api/backgrounds/upload'); // yes, the downloadbackground endpoint actually uploads one

// Redirect deprecated theme API endpoints
redirect('/savetheme', '/api/themes/save');

// Redirect deprecated avatar API endpoints
redirect('/getuseravatars', '/api/avatars/get');
redirect('/deleteuseravatar', '/api/avatars/delete');
redirect('/uploaduseravatar', '/api/avatars/upload');

// Redirect deprecated quick reply endpoints
redirect('/deletequickreply', '/api/quick-replies/delete');
redirect('/savequickreply', '/api/quick-replies/save');

// Redirect deprecated image endpoints
redirect('/uploadimage', '/api/images/upload');
redirect('/listimgfiles/:folder', '/api/images/list/:folder');
redirect('/api/content/import', '/api/content/importURL');

// Redirect deprecated moving UI endpoints
redirect('/savemovingui', '/api/moving-ui/save');

// Redirect Serp endpoints
redirect('/api/serpapi/search', '/api/search/serpapi');
redirect('/api/serpapi/visit', '/api/search/visit');
redirect('/api/serpapi/transcript', '/api/search/transcript');

app.use('/api/moving-ui', movingUIRouter);
app.use('/api/images', imagesRouter);
app.use('/api/quick-replies', quickRepliesRouter);
app.use('/api/avatars', avatarsRouter);
app.use('/api/themes', themesRouter);
app.use('/api/openai', openAiRouter);
app.use('/api/google', googleRouter);
app.use('/api/anthropic', anthropicRouter);
app.use('/api/tokenizers', tokenizersRouter);
app.use('/api/presets', presetsRouter);
app.use('/api/secrets', secretsRouter);
app.use('/thumbnail', thumbnailRouter);
app.use('/api/novelai', novelAiRouter);
app.use('/api/extensions', extensionsRouter);
app.use('/api/assets', assetsRouter);
app.use('/api/files', filesRouter);
app.use('/api/characters', charactersRouter);
app.use('/api/chats', chatsRouter);
app.use('/api/groups', groupsRouter);
app.use('/api/worldinfo', worldInfoRouter);
app.use('/api/stats', statsRouter);
app.use('/api/backgrounds', backgroundsRouter);
app.use('/api/sprites', spritesRouter);
app.use('/api/content', contentManagerRouter);
app.use('/api/settings', settingsRouter);
app.use('/api/sd', stableDiffusionRouter);
app.use('/api/horde', hordeRouter);
app.use('/api/vector', vectorsRouter);
app.use('/api/translate', translateRouter);
app.use('/api/extra/classify', classifyRouter);
app.use('/api/extra/caption', captionRouter);
app.use('/api/search', searchRouter);
app.use('/api/backends/text-completions', textCompletionsRouter);
app.use('/api/openrouter', openRouterRouter);
app.use('/api/backends/kobold', koboldRouter);
app.use('/api/backends/chat-completions', chatCompletionsRouter);
app.use('/api/backends/scale-alt', scaleAltRouter);
app.use('/api/speech', speechRouter);
app.use('/api/azure', azureRouter);

const tavernUrlV6 = new URL(
    (cliArguments.ssl ? 'https://' : 'http://') +
    (listen ? (ipRegex.v6({ exact: true }).test(listenAddressIPv6) ? listenAddressIPv6 : '[::]') : '[::1]') +
    (':' + server_port),
);

const tavernUrl = new URL(
    (cliArguments.ssl ? 'https://' : 'http://') +
    (listen ? (ipRegex.v4({ exact: true }).test(listenAddressIPv4) ? listenAddressIPv4 : '0.0.0.0') : '127.0.0.1') +
    (':' + server_port),
);

/**
 * Tasks that need to be run before the server starts listening.
 */
const preSetupTasks = async function () {
    const version = await getVersion();

    // Print formatted header
    console.log();
    console.log(`SillyTavern ${version.pkgVersion}`);
    console.log(version.gitBranch ? `Running '${version.gitBranch}' (${version.gitRevision}) - ${version.commitDate}` : '');
    if (version.gitBranch && !version.isLatest && ['staging', 'release'].includes(version.gitBranch)) {
        console.log('INFO: Currently not on the latest commit.');
        console.log('      Run \'git pull\' to update. If you have any merge conflicts, run \'git reset --hard\' and \'git pull\' to reset your branch.');
    }
    console.log();

    const directories = await getUserDirectoriesList();
    await checkForNewContent(directories);
    await ensureThumbnailCache();
    cleanUploads();

    await settingsInit();
    await statsInit();

    const cleanupPlugins = await initializePlugins();
    const consoleTitle = process.title;

    let isExiting = false;
    const exitProcess = async () => {
        if (isExiting) return;
        isExiting = true;
        await statsOnExit();
        if (typeof cleanupPlugins === 'function') {
            await cleanupPlugins();
        }
        setWindowTitle(consoleTitle);
        process.exit();
    };

    // Set up event listeners for a graceful shutdown
    process.on('SIGINT', exitProcess);
    process.on('SIGTERM', exitProcess);
    process.on('uncaughtException', (err) => {
        console.error('Uncaught exception:', err);
        exitProcess();
    });

    // Add request proxy.
    initRequestProxy({ enabled: proxyEnabled, url: proxyUrl, bypass: proxyBypass });

    // Wait for frontend libs to compile
    await webpackMiddleware.runWebpackCompiler();
};

/**
 * Gets the hostname to use for autorun in the browser.
 * @param {boolean} useIPv6 If use IPv6
 * @param {boolean} useIPv4 If use IPv4
 * @returns Promise<string> The hostname to use for autorun
 */
async function getAutorunHostname(useIPv6, useIPv4) {
    if (autorunHostname === 'auto') {
        let localhostResolve = await canResolve('localhost', useIPv6, useIPv4);

        if (useIPv6 && useIPv4) {
            return (avoidLocalhost || !localhostResolve) ? '[::1]' : 'localhost';
        }

        if (useIPv6) {
            return '[::1]';
        }

        if (useIPv4) {
            return '127.0.0.1';
        }
    }

    return autorunHostname;
}

/**
 * Tasks that need to be run after the server starts listening.
 * @param {boolean} v6Failed If the server failed to start on IPv6
 * @param {boolean} v4Failed If the server failed to start on IPv4
 * @param {boolean} useIPv6 If the server is using IPv6
 * @param {boolean} useIPv4 If the server is using IPv4
 */
const postSetupTasks = async function (v6Failed, v4Failed, useIPv6, useIPv4) {
    const autorunUrl = new URL(
        (cliArguments.ssl ? 'https://' : 'http://') +
        (await getAutorunHostname(useIPv6, useIPv4)) +
        (':') +
        ((autorunPortOverride >= 0) ? autorunPortOverride : server_port),
    );

    console.log('Launching...');

    if (autorun) open(autorunUrl.toString());

    setWindowTitle('SillyTavern WebServer');

    let logListen = 'SillyTavern is listening on';

    if (useIPv6 && !v6Failed) {
        logListen += color.green(
            ' IPv6: ' + tavernUrlV6.host,
        );
    }

    if (useIPv4 && !v4Failed) {
        logListen += color.green(
            ' IPv4: ' + tavernUrl.host,
        );
    }

    const goToLog = 'Go to: ' + color.blue(autorunUrl) + ' to open SillyTavern';
    const plainGoToLog = removeColorFormatting(goToLog);

    console.log(logListen);
    if (listen) {
        console.log();
        console.log('To limit connections to internal localhost only ([::1] or 127.0.0.1), change the setting in config.yaml to "listen: false".');
        console.log('Check the "access.log" file in the SillyTavern directory to inspect incoming connections.');
    }
    console.log('\n' + getSeparator(plainGoToLog.length) + '\n');
    console.log(goToLog);
    console.log('\n' + getSeparator(plainGoToLog.length) + '\n');


    if (basicAuthMode) {
        if (perUserBasicAuth && !enableAccounts) {
            console.error(color.red(
                'Per-user basic authentication is enabled, but user accounts are disabled. This configuration may be insecure.',
            ));
        } else if (!perUserBasicAuth) {
            const basicAuthUser = getConfigValue('basicAuthUser', {});
            if (!basicAuthUser?.username || !basicAuthUser?.password) {
                console.warn(color.yellow(
                    'Basic Authentication is enabled, but username or password is not set or empty!',
                ));
            }
        }
    }

    setupLogLevel();
};

/**
 * Loads server plugins from a directory.
 * @returns {Promise<Function>} Function to be run on server exit
 */
async function initializePlugins() {
    try {
        const pluginDirectory = path.join(serverDirectory, 'plugins');
        const cleanupPlugins = await loadPlugins(app, pluginDirectory);
        return cleanupPlugins;
    } catch {
        console.log('Plugin loading failed.');
        return () => { };
    }
}

/**
 * Set the title of the terminal window
 * @param {string} title Desired title for the window
 */
function setWindowTitle(title) {
    if (process.platform === 'win32') {
        process.title = title;
    }
    else {
        process.stdout.write(`\x1b]2;${title}\x1b\x5c`);
    }
}

/**
 * Prints an error message and exits the process if necessary
 * @param {string} message The error message to print
 * @returns {void}
 */
function logSecurityAlert(message) {
    if (basicAuthMode || enableWhitelist) return; // safe!
    console.error(color.red(message));
    if (getConfigValue('securityOverride', false)) {
        console.warn(color.red('Security has been overridden. If it\'s not a trusted network, change the settings.'));
        return;
    }
    process.exit(1);
}

/**
 * Handles the case where the server failed to start on one or both protocols.
 * @param {boolean} v6Failed If the server failed to start on IPv6
 * @param {boolean} v4Failed If the server failed to start on IPv4
 * @param {boolean} useIPv6 If use IPv6
 * @param {boolean} useIPv4 If use IPv4
 */
function handleServerListenFail(v6Failed, v4Failed, useIPv6, useIPv4) {
    if (v6Failed && !useIPv4) {
        console.error(color.red('fatal error: Failed to start server on IPv6 and IPv4 disabled'));
        process.exit(1);
    }

    if (v4Failed && !useIPv6) {
        console.error(color.red('fatal error: Failed to start server on IPv4 and IPv6 disabled'));
        process.exit(1);
    }

    if (v6Failed && v4Failed) {
        console.error(color.red('fatal error: Failed to start server on both IPv6 and IPv4'));
        process.exit(1);
    }
}

/**
 * Creates an HTTPS server.
 * @param {URL} url The URL to listen on
 * @param {number} ipVersion the ip version to use
 * @returns {Promise<void>} A promise that resolves when the server is listening
 * @throws {Error} If the server fails to start
 */
function createHttpsServer(url, ipVersion) {
    return new Promise((resolve, reject) => {
        const server = https.createServer(
            {
                cert: fs.readFileSync(cliArguments.certPath),
                key: fs.readFileSync(cliArguments.keyPath),
            }, app);
        server.on('error', reject);
        server.on('listening', resolve);

        let host = url.hostname;
        if (ipVersion === 6) host = urlHostnameToIPv6(url.hostname);
        server.listen({
            host: host,
            port: Number(url.port || 443),
            // see https://nodejs.org/api/net.html#serverlisten for why ipv6Only is used
            ipv6Only: true,
        });
    });
}

/**
 * Creates an HTTP server.
 * @param {URL} url The URL to listen on
 * @param {number} ipVersion the ip version to use
 * @returns {Promise<void>} A promise that resolves when the server is listening
 * @throws {Error} If the server fails to start
 */
function createHttpServer(url, ipVersion) {
    return new Promise((resolve, reject) => {
        const server = http.createServer(app);
        server.on('error', reject);
        server.on('listening', resolve);

        let host = url.hostname;
        if (ipVersion === 6) host = urlHostnameToIPv6(url.hostname);
        server.listen({
            host: host,
            port: Number(url.port || 80),
            // see https://nodejs.org/api/net.html#serverlisten for why ipv6Only is used
            ipv6Only: true,
        });
    });
}

/**
 * Starts the server using http or https depending on config
 * @param {boolean} useIPv6 If use IPv6
 * @param {boolean} useIPv4 If use IPv4
 */
async function startHTTPorHTTPS(useIPv6, useIPv4) {
    let v6Failed = false;
    let v4Failed = false;

    const createFunc = cliArguments.ssl ? createHttpsServer : createHttpServer;

    if (useIPv6) {
        try {
            await createFunc(tavernUrlV6, 6);
        } catch (error) {
            console.error('non-fatal error: failed to start server on IPv6');
            console.error(error);

            v6Failed = true;
        }
    }

    if (useIPv4) {
        try {
            await createFunc(tavernUrl, 4);
        } catch (error) {
            console.error('non-fatal error: failed to start server on IPv4');
            console.error(error);

            v4Failed = true;
        }
    }

    return [v6Failed, v4Failed];
}

async function startServer() {
    let useIPv6 = (enableIPv6 === true);
    let useIPv4 = (enableIPv4 === true);

    let hasIPv6 = false,
        hasIPv4 = false,
        hasIPv6Local = false,
        hasIPv4Local = false,
        hasIPv6Any = false,
        hasIPv4Any = false;

    if (enableIPv6 === 'auto' || enableIPv4 === 'auto') {
        [hasIPv6Any, hasIPv4Any, hasIPv6Local, hasIPv4Local] = await getHasIP();

        hasIPv6 = listen ? hasIPv6Any : hasIPv6Local;
        if (enableIPv6 === 'auto') {
            useIPv6 = hasIPv6;
        }
        if (hasIPv6) {
            if (useIPv6) {
                console.log(color.green('IPv6 support detected'));
            } else {
                console.log('IPv6 support detected (but disabled)');
            }
        }

        hasIPv4 = listen ? hasIPv4Any : hasIPv4Local;
        if (enableIPv4 === 'auto') {
            useIPv4 = hasIPv4;
        }
        if (hasIPv4) {
            if (useIPv4) {
                console.log(color.green('IPv4 support detected'));
            } else {
                console.log('IPv4 support detected (but disabled)');
            }
        }

        if (enableIPv6 === 'auto' && enableIPv4 === 'auto') {
            if (!hasIPv6 && !hasIPv4) {
                console.error('Both IPv6 and IPv4 are not detected');
                process.exit(1);
            }
        }
    }

    if (!useIPv6 && !useIPv4) {
        console.error('Both IPv6 and IPv4 are disabled,\nP.S. you should never see this error, at least at one point it was checked for before this, with the rest of the config options');
        process.exit(1);
    }

    const [v6Failed, v4Failed] = await startHTTPorHTTPS(useIPv6, useIPv4);
    handleServerListenFail(v6Failed, v4Failed, useIPv6, useIPv4);
    postSetupTasks(v6Failed, v4Failed, useIPv6, useIPv4);
}

async function verifySecuritySettings() {
    // Skip all security checks as listen is set to false
    if (!listen) {
        return;
    }

    if (!enableAccounts) {
        logSecurityAlert('Your current SillyTavern configuration is insecure (listening to non-localhost). Enable whitelisting, basic authentication or user accounts.');
    }

    const users = await getAllEnabledUsers();
    const unprotectedUsers = users.filter(x => !x.password);
    const unprotectedAdminUsers = unprotectedUsers.filter(x => x.admin);

    if (unprotectedUsers.length > 0) {
        console.warn(color.blue('A friendly reminder that the following users are not password protected:'));
        unprotectedUsers.map(x => `${color.yellow(x.handle)} ${color.red(x.admin ? '(admin)' : '')}`).forEach(x => console.warn(x));
        console.log();
        console.warn(`Consider setting a password in the admin panel or by using the ${color.blue('recover.js')} script.`);
        console.log();

        if (unprotectedAdminUsers.length > 0) {
            logSecurityAlert('If you are not using basic authentication or whitelisting, you should set a password for all admin users.');
        }
    }
}

/**
 * Registers a not-found error response if a not-found error page exists. Should only be called after all other middlewares have been registered.
 */
function apply404Middleware() {
    const notFoundWebpage = safeReadFileSync('./public/error/url-not-found.html') ?? '';
    app.use((req, res) => {
        res.status(404).send(notFoundWebpage);
    });
}

// User storage module needs to be initialized before starting the server
initUserStorage(dataRoot)
    .then(ensurePublicDirectoriesExist)
    .then(migrateUserData)
    .then(migrateSystemPrompts)
    .then(verifySecuritySettings)
    .then(preSetupTasks)
    .then(apply404Middleware)
    .finally(startServer);
