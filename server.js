#!/usr/bin/env node

// native node modules
import path from 'node:path';
import util from 'node:util';
import net from 'node:net';
import dns from 'node:dns';
import process from 'node:process';
import { fileURLToPath } from 'node:url';

import cors from 'cors';
import { csrfSync } from 'csrf-sync';
import express from 'express';
import compression from 'compression';
import cookieSession from 'cookie-session';
import multer from 'multer';
import responseTime from 'response-time';
import helmet from 'helmet';
import bodyParser from 'body-parser';
import open from 'open';

// local library imports
import { serverEvents, EVENT_NAMES } from './src/server-events.js';
import { CommandLineParser } from './src/command-line.js';
import { loadPlugins } from './src/plugin-loader.js';
import {
    initUserStorage,
    getCookieSecret,
    getCookieSessionName,
    ensurePublicDirectoriesExist,
    getUserDirectoriesList,
    migrateSystemPrompts,
    migrateUserData,
    requireLoginMiddleware,
    setUserDataMiddleware,
    shouldRedirectToLogin,
    cleanUploads,
    getSessionCookieAge,
    verifySecuritySettings,
    loginPageMiddleware,
} from './src/users.js';

import getWebpackServeMiddleware from './src/middleware/webpack-serve.js';
import basicAuthMiddleware from './src/middleware/basicAuth.js';
import getWhitelistMiddleware from './src/middleware/whitelist.js';
import accessLoggerMiddleware, { getAccessLogPath, migrateAccessLog } from './src/middleware/accessLogWriter.js';
import multerMonkeyPatch from './src/middleware/multerMonkeyPatch.js';
import initRequestProxy from './src/request-proxy.js';
import getCacheBusterMiddleware from './src/middleware/cacheBuster.js';
import corsProxyMiddleware from './src/middleware/corsProxy.js';
import {
    getVersion,
    color,
    removeColorFormatting,
    getSeparator,
    safeReadFileSync,
    setupLogLevel,
    setWindowTitle,
} from './src/util.js';
import { UPLOADS_DIRECTORY } from './src/constants.js';
import { ensureThumbnailCache } from './src/endpoints/thumbnails.js';

// Routers
import { router as usersPublicRouter } from './src/endpoints/users-public.js';
import { init as statsInit, onExit as statsOnExit } from './src/endpoints/stats.js';
import { checkForNewContent } from './src/endpoints/content-manager.js';
import { init as settingsInit } from './src/endpoints/settings.js';
import { redirectDeprecatedEndpoints, ServerStartup, setupPrivateEndpoints } from './src/server-startup.js';

// Unrestrict console logs display limit
util.inspect.defaultOptions.maxArrayLength = null;
util.inspect.defaultOptions.maxStringLength = null;
util.inspect.defaultOptions.depth = 4;

// Set a working directory for the server
const serverDirectory = import.meta.dirname ?? path.dirname(fileURLToPath(import.meta.url));
console.log(`Node version: ${process.version}. Running in ${process.env.NODE_ENV} environment. Server directory: ${serverDirectory}`);
process.chdir(serverDirectory);

// Work around a node v20.0.0, v20.1.0, and v20.2.0 bug. The issue was fixed in v20.3.0.
// https://github.com/nodejs/node/issues/47822#issuecomment-1564708870
// Safe to remove once support for Node v20 is dropped.
if (process.versions && process.versions.node && process.versions.node.match(/20\.[0-2]\.0/)) {
    // @ts-ignore
    if (net.setDefaultAutoSelectFamily) net.setDefaultAutoSelectFamily(false);
}

const cliArgs = new CommandLineParser().parse(process.argv);
globalThis.DATA_ROOT = cliArgs.dataRoot;
globalThis.COMMAND_LINE_ARGS = cliArgs;

if (!cliArgs.enableIPv6 && !cliArgs.enableIPv4) {
    console.error('error: You can\'t disable all internet protocols: at least IPv6 or IPv4 must be enabled.');
    process.exit(1);
}

try {
    if (cliArgs.dnsPreferIPv6) {
        dns.setDefaultResultOrder('ipv6first');
        console.log('Preferring IPv6 for DNS resolution');
    } else {
        dns.setDefaultResultOrder('ipv4first');
        console.log('Preferring IPv4 for DNS resolution');
    }
} catch (error) {
    console.warn('Failed to set DNS resolution order. Possibly unsupported in this Node version.');
}

const app = express();
app.use(helmet({
    contentSecurityPolicy: false,
}));
app.use(compression());
app.use(responseTime());

app.use(bodyParser.json({ limit: '200mb' }));
app.use(bodyParser.urlencoded({ extended: true, limit: '200mb' }));

// CORS Settings //
const CORS = cors({
    origin: 'null',
    methods: ['OPTIONS'],
});

app.use(CORS);

if (cliArgs.listen && cliArgs.basicAuthMode) {
    app.use(basicAuthMiddleware);
}

if (cliArgs.whitelistMode) {
    const whitelistMiddleware = await getWhitelistMiddleware();
    app.use(whitelistMiddleware);
}

if (cliArgs.listen) {
    app.use(accessLoggerMiddleware());
}

if (cliArgs.enableCorsProxy) {
    app.use('/proxy/:url(*)', corsProxyMiddleware);
} else {
    app.use('/proxy/:url(*)', async (_, res) => {
        const message = 'CORS proxy is disabled. Enable it in config.yaml or use the --corsProxy flag.';
        console.log(message);
        res.status(404).send(message);
    });
}

app.use(cookieSession({
    name: getCookieSessionName(),
    sameSite: 'strict',
    httpOnly: true,
    maxAge: getSessionCookieAge(),
    secret: getCookieSecret(globalThis.DATA_ROOT),
}));

app.use(setUserDataMiddleware);

// CSRF Protection //
if (!cliArgs.disableCsrf) {
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
app.get('/login', loginPageMiddleware);

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
const uploadsPath = path.join(cliArgs.dataRoot, UPLOADS_DIRECTORY);
app.use(multer({ dest: uploadsPath, limits: { fieldSize: 10 * 1024 * 1024 } }).single('avatar'));
app.use(multerMonkeyPatch);

app.get('/version', async function (_, response) {
    const data = await getVersion();
    response.send(data);
});

redirectDeprecatedEndpoints(app);
setupPrivateEndpoints(app);

/**
 * Tasks that need to be run before the server starts listening.
 * @returns {Promise<void>}
 */
async function preSetupTasks() {
    const version = await getVersion();

    // Print formatted header
    console.log();
    console.log(`SillyTavern ${version.pkgVersion}`);
    if (version.gitBranch) {
        console.log(`Running '${version.gitBranch}' (${version.gitRevision}) - ${version.commitDate}`);
        if (!version.isLatest && ['staging', 'release'].includes(version.gitBranch)) {
            console.log('INFO: Currently not on the latest commit.');
            console.log('      Run \'git pull\' to update. If you have any merge conflicts, run \'git reset --hard\' and \'git pull\' to reset your branch.');
        }
    }
    console.log();

    const directories = await getUserDirectoriesList();
    await checkForNewContent(directories);
    await ensureThumbnailCache();
    cleanUploads();
    migrateAccessLog();

    await settingsInit();
    await statsInit();

    const pluginsDirectory = path.join(serverDirectory, 'plugins');
    const cleanupPlugins = await loadPlugins(app, pluginsDirectory);
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
    initRequestProxy({ enabled: cliArgs.requestProxyEnabled, url: cliArgs.requestProxyUrl, bypass: cliArgs.requestProxyBypass });

    // Wait for frontend libs to compile
    await webpackMiddleware.runWebpackCompiler();
}

/**
 * Tasks that need to be run after the server starts listening.
 * @param {import('./src/server-startup.js').ServerStartupResult} result The result of the server startup
 * @returns {Promise<void>}
 */
async function postSetupTasks(result) {
    const autorunHostname = await cliArgs.getAutorunHostname(result);
    const autorunUrl = cliArgs.getAutorunUrl(autorunHostname);

    if (cliArgs.autorun) {
        console.log('Launching in a browser...');
        await open(autorunUrl.toString());
    }

    setWindowTitle('SillyTavern WebServer');

    let logListen = 'SillyTavern is listening on';

    if (result.useIPv6 && !result.v6Failed) {
        logListen += color.green(
            ' IPv6: ' + cliArgs.getIPv6ListenUrl().host,
        );
    }

    if (result.useIPv4 && !result.v4Failed) {
        logListen += color.green(
            ' IPv4: ' + cliArgs.getIPv4ListenUrl().host,
        );
    }

    const goToLog = 'Go to: ' + color.blue(autorunUrl) + ' to open SillyTavern';
    const plainGoToLog = removeColorFormatting(goToLog);

    console.log(logListen);
    if (cliArgs.listen) {
        console.log();
        console.log('To limit connections to internal localhost only ([::1] or 127.0.0.1), change the setting in config.yaml to "listen: false".');
        console.log('Check the "access.log" file in the data directory to inspect incoming connections:', color.green(getAccessLogPath()));
    }
    console.log('\n' + getSeparator(plainGoToLog.length) + '\n');
    console.log(goToLog);
    console.log('\n' + getSeparator(plainGoToLog.length) + '\n');

    setupLogLevel();
    serverEvents.emit(EVENT_NAMES.SERVER_STARTED, { url: autorunUrl });
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
initUserStorage(globalThis.DATA_ROOT)
    .then(ensurePublicDirectoriesExist)
    .then(migrateUserData)
    .then(migrateSystemPrompts)
    .then(verifySecuritySettings)
    .then(preSetupTasks)
    .then(apply404Middleware)
    .then(() => new ServerStartup(app, cliArgs).start())
    .then(postSetupTasks);
