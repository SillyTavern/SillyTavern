#!/usr/bin/env node

// native node modules
import fs from 'node:fs';
import http from 'node:http';
import https from 'node:https';
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
import { doubleCsrf } from 'csrf-csrf';
import express from 'express';
import compression from 'compression';
import cookieParser from 'cookie-parser';
import cookieSession from 'cookie-session';
import multer from 'multer';
import responseTime from 'response-time';
import helmet from 'helmet';
import bodyParser from 'body-parser';

// net related library imports
import fetch from 'node-fetch';

// Unrestrict console logs display limit
util.inspect.defaultOptions.maxArrayLength = null;
util.inspect.defaultOptions.maxStringLength = null;
util.inspect.defaultOptions.depth = 4;

// local library imports
import{ loadPlugins } from './src/plugin-loader.js';
import {
    initUserStorage,
    getCsrfSecret,
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
import basicAuthMiddleware from './src/middleware/basicAuth.js';
import whitelistMiddleware from './src/middleware/whitelist.js';
import multerMonkeyPatch from './src/middleware/multerMonkeyPatch.js';
import initRequestProxy from './src/request-proxy.js';
import {
    getVersion,
    getConfigValue,
    color,
    forwardFetchResponse,
    removeColorFormatting,
    getSeparator,
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
        type: 'boolean',
        default: null,
        describe: `Enables IPv6.\n[config default: ${DEFAULT_ENABLE_IPV6}]`,
    }).option('enableIPv4', {
        type: 'boolean',
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

const server_port = cliArguments.port ?? process.env.SILLY_TAVERN_PORT ?? getConfigValue('port', DEFAULT_PORT);
const autorun = (cliArguments.autorun ?? getConfigValue('autorun', DEFAULT_AUTORUN)) && !cliArguments.ssl;
const listen = cliArguments.listen ?? getConfigValue('listen', DEFAULT_LISTEN);
const enableCorsProxy = cliArguments.corsProxy ?? getConfigValue('enableCorsProxy', DEFAULT_CORS_PROXY);
const enableWhitelist = cliArguments.whitelist ?? getConfigValue('whitelistMode', DEFAULT_WHITELIST);
const dataRoot = cliArguments.dataRoot ?? getConfigValue('dataRoot', './data');
const disableCsrf = cliArguments.disableCsrf ?? getConfigValue('disableCsrfProtection', DEFAULT_CSRF_DISABLED);
const basicAuthMode = cliArguments.basicAuthMode ?? getConfigValue('basicAuthMode', DEFAULT_BASIC_AUTH);
const perUserBasicAuth = getConfigValue('perUserBasicAuth', DEFAULT_PER_USER_BASIC_AUTH);
const enableAccounts = getConfigValue('enableUserAccounts', DEFAULT_ACCOUNTS);

const uploadsPath = path.join(dataRoot, UPLOADS_DIRECTORY);

const enableIPv6 = cliArguments.enableIPv6 ?? getConfigValue('protocol.ipv6', DEFAULT_ENABLE_IPV6);
const enableIPv4 = cliArguments.enableIPv4 ?? getConfigValue('protocol.ipv4', DEFAULT_ENABLE_IPV4);

const autorunHostname = cliArguments.autorunHostname ?? getConfigValue('autorunHostname', DEFAULT_AUTORUN_HOSTNAME);
const autorunPortOverride = cliArguments.autorunPortOverride ?? getConfigValue('autorunPortOverride', DEFAULT_AUTORUN_PORT);

const dnsPreferIPv6 = cliArguments.dnsPreferIPv6 ?? getConfigValue('dnsPreferIPv6', DEFAULT_PREFER_IPV6);

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

if (!enableIPv6 && !enableIPv4) {
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
    // Defaults to 24 hours in seconds if not set
    const configValue = getConfigValue('sessionTimeout', 24 * 60 * 60);

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
    const COOKIES_SECRET = getCookieSecret();

    const { generateToken, doubleCsrfProtection } = doubleCsrf({
        getSecret: getCsrfSecret,
        cookieName: 'X-CSRF-Token',
        cookieOptions: {
            sameSite: 'strict',
            secure: false,
        },
        size: 64,
        getTokenFromRequest: (req) => req.headers['x-csrf-token'],
    });

    app.get('/csrf-token', (req, res) => {
        res.json({
            'token': generateToken(res, req),
        });
    });

    app.use(cookieParser(COOKIES_SECRET));
    app.use(doubleCsrfProtection);
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
app.get('/', (request, response) => {
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
app.use(express.static(process.cwd() + '/public', {}));

// Public API
app.use('/api/users', usersPublicRouter);

// Everything below this line requires authentication
app.use(requireLoginMiddleware);
app.get('/api/ping', (_, response) => response.sendStatus(204));

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
    (listen ? '[::]' : '[::1]') +
    (':' + server_port),
);

const tavernUrl = new URL(
    (cliArguments.ssl ? 'https://' : 'http://') +
    (listen ? '0.0.0.0' : '127.0.0.1') +
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
};

/**
 * Gets the hostname to use for autorun in the browser.
 * @returns {string} The hostname to use for autorun
 */
function getAutorunHostname() {
    if (autorunHostname === 'auto') {
        if (enableIPv6 && enableIPv4) {
            if (avoidLocalhost) return '[::1]';
            return 'localhost';
        }

        if (enableIPv6) {
            return '[::1]';
        }

        if (enableIPv4) {
            return '127.0.0.1';
        }
    }

    return autorunHostname;
}

/**
 * Tasks that need to be run after the server starts listening.
 * @param {boolean} v6Failed If the server failed to start on IPv6
 * @param {boolean} v4Failed If the server failed to start on IPv4
 */
const postSetupTasks = async function (v6Failed, v4Failed) {
    const autorunUrl = new URL(
        (cliArguments.ssl ? 'https://' : 'http://') +
        (getAutorunHostname()) +
        (':') +
        ((autorunPortOverride >= 0) ? autorunPortOverride : server_port),
    );

    console.log('Launching...');

    if (autorun) open(autorunUrl.toString());

    setWindowTitle('SillyTavern WebServer');

    let logListen = 'SillyTavern is listening on';

    if (enableIPv6 && !v6Failed) {
        logListen += color.green(' IPv6: ' + tavernUrlV6.host);
    }

    if (enableIPv4 && !v4Failed) {
        logListen += color.green(' IPv4: ' + tavernUrl.host);
    }

    const goToLog = 'Go to: ' + color.blue(autorunUrl) + ' to open SillyTavern';
    const plainGoToLog = removeColorFormatting(goToLog);

    console.log(logListen);
    console.log('\n' + getSeparator(plainGoToLog.length) + '\n');
    console.log(goToLog);
    console.log('\n' + getSeparator(plainGoToLog.length) + '\n');

    if (listen) {
        console.log('[::] or 0.0.0.0 means SillyTavern is listening on all network interfaces (Wi-Fi, LAN, localhost). If you want to limit it only to internal localhost ([::1] or 127.0.0.1), change the setting in config.yaml to "listen: false". Check "access.log" file in the SillyTavern directory if you want to inspect incoming connections.\n');
    }

    if (basicAuthMode) {
        if (perUserBasicAuth && !enableAccounts) {
            console.error(color.red('Per-user basic authentication is enabled, but user accounts are disabled. This configuration may be insecure.'));
        } else if (!perUserBasicAuth) {
            const basicAuthUser = getConfigValue('basicAuthUser', {});
            if (!basicAuthUser?.username || !basicAuthUser?.password) {
                console.warn(color.yellow('Basic Authentication is enabled, but username or password is not set or empty!'));
            }
        }
    }
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
 */
function handleServerListenFail(v6Failed, v4Failed) {
    if (v6Failed && !enableIPv4) {
        console.error(color.red('fatal error: Failed to start server on IPv6 and IPv4 disabled'));
        process.exit(1);
    }

    if (v4Failed && !enableIPv6) {
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
 * @returns {Promise<void>} A promise that resolves when the server is listening
 * @throws {Error} If the server fails to start
 */
function createHttpsServer(url) {
    return new Promise((resolve, reject) => {
        const server = https.createServer(
            {
                cert: fs.readFileSync(cliArguments.certPath),
                key: fs.readFileSync(cliArguments.keyPath),
            }, app);
        server.on('error', reject);
        server.on('listening', resolve);
        server.listen(Number(url.port || 443), url.hostname);
    });
}

/**
 * Creates an HTTP server.
 * @param {URL} url The URL to listen on
 * @returns {Promise<void>} A promise that resolves when the server is listening
 * @throws {Error} If the server fails to start
 */
function createHttpServer(url) {
    return new Promise((resolve, reject) => {
        const server = http.createServer(app);
        server.on('error', reject);
        server.on('listening', resolve);
        server.listen(Number(url.port || 80), url.hostname);
    });
}

async function startHTTPorHTTPS() {
    let v6Failed = false;
    let v4Failed = false;

    const createFunc = cliArguments.ssl ? createHttpsServer : createHttpServer;

    if (enableIPv6) {
        try {
            await createFunc(tavernUrlV6);
        } catch (error) {
            console.error('non-fatal error: failed to start server on IPv6');
            console.error(error);

            v6Failed = true;
        }
    }

    if (enableIPv4) {
        try {
            await createFunc(tavernUrl);
        } catch (error) {
            console.error('non-fatal error: failed to start server on IPv4');
            console.error(error);

            v4Failed = true;
        }
    }

    return [v6Failed, v4Failed];
}

async function startServer() {
    const [v6Failed, v4Failed] = await startHTTPorHTTPS();

    handleServerListenFail(v6Failed, v4Failed);
    postSetupTasks(v6Failed, v4Failed);
}

async function verifySecuritySettings() {
    // Skip all security checks as listen is set to false
    if (!listen) {
        return;
    }

    if (!enableAccounts) {
        logSecurityAlert('Your SillyTavern is currently insecurely open to the public. Enable whitelisting, basic authentication or user accounts.');
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

// User storage module needs to be initialized before starting the server
initUserStorage(dataRoot)
    .then(ensurePublicDirectoriesExist)
    .then(migrateUserData)
    .then(migrateSystemPrompts)
    .then(verifySecuritySettings)
    .then(preSetupTasks)
    .finally(startServer);
