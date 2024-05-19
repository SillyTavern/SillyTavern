#!/usr/bin/env node

// native node modules
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const util = require('util');

// cli/fs related library imports
const open = require('open');
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// express/server related library imports
const cors = require('cors');
const doubleCsrf = require('csrf-csrf').doubleCsrf;
const express = require('express');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const cookieSession = require('cookie-session');
const multer = require('multer');
const responseTime = require('response-time');
const helmet = require('helmet').default;

// net related library imports
const net = require('net');
const dns = require('dns');
const fetch = require('node-fetch').default;

// Unrestrict console logs display limit
util.inspect.defaultOptions.maxArrayLength = null;
util.inspect.defaultOptions.maxStringLength = null;
util.inspect.defaultOptions.depth = 4;

// local library imports
const userModule = require('./src/users');
const basicAuthMiddleware = require('./src/middleware/basicAuth');
const whitelistMiddleware = require('./src/middleware/whitelist');
const contentManager = require('./src/endpoints/content-manager');
const {
    getVersion,
    getConfigValue,
    color,
    forwardFetchResponse,
} = require('./src/util');
const { ensureThumbnailCache } = require('./src/endpoints/thumbnails');

// Work around a node v20.0.0, v20.1.0, and v20.2.0 bug. The issue was fixed in v20.3.0.
// https://github.com/nodejs/node/issues/47822#issuecomment-1564708870
// Safe to remove once support for Node v20 is dropped.
if (process.versions && process.versions.node && process.versions.node.match(/20\.[0-2]\.0/)) {
    // @ts-ignore
    if (net.setDefaultAutoSelectFamily) net.setDefaultAutoSelectFamily(false);
}

// Set default DNS resolution order to IPv4 first
dns.setDefaultResultOrder('ipv4first');

const DEFAULT_PORT = 8000;
const DEFAULT_AUTORUN = false;
const DEFAULT_LISTEN = false;
const DEFAULT_CORS_PROXY = false;
const DEFAULT_WHITELIST = true;
const DEFAULT_ACCOUNTS = false;
const DEFAULT_CSRF_DISABLED = false;
const DEFAULT_BASIC_AUTH = false;

const cliArguments = yargs(hideBin(process.argv))
    .usage('Usage: <your-start-script> <command> [options]')
    .option('port', {
        type: 'number',
        default: null,
        describe: `Sets the port under which SillyTavern will run.\nIf not provided falls back to yaml config 'port'.\n[config default: ${DEFAULT_PORT}]`,
    }).option('autorun', {
        type: 'boolean',
        default: null,
        describe: `Automatically launch SillyTavern in the browser.\nAutorun is automatically disabled if --ssl is set to true.\nIf not provided falls back to yaml config 'autorun'.\n[config default: ${DEFAULT_AUTORUN}]`,
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
    }).option('basicAuthMode', {
        type: 'boolean',
        default: null,
        describe: 'Enables basic authentication',
    }).parseSync();

// change all relative paths
console.log(`Node version: ${process.version}. Running in ${process.env.NODE_ENV} environment.`);
const serverDirectory = __dirname;
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
const enableAccounts = getConfigValue('enableUserAccounts', DEFAULT_ACCOUNTS);

const { UPLOADS_PATH } = require('./src/constants');

// CORS Settings //
const CORS = cors({
    origin: 'null',
    methods: ['OPTIONS'],
});

app.use(CORS);

if (listen && basicAuthMode) app.use(basicAuthMiddleware);

app.use(whitelistMiddleware(enableWhitelist, listen));

if (enableCorsProxy) {
    const bodyParser = require('body-parser');
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
            delete headers['x-csrf-token'];
            delete headers['host'];
            delete headers['referer'];
            delete headers['origin'];
            delete headers['cookie'];
            delete headers['sec-fetch-mode'];
            delete headers['sec-fetch-site'];
            delete headers['sec-fetch-dest'];

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

app.use(cookieSession({
    name: userModule.getCookieSessionName(),
    sameSite: 'strict',
    httpOnly: true,
    maxAge: 24 * 60 * 60 * 1000, // 24 hours
    secret: userModule.getCookieSecret(),
}));

app.use(userModule.setUserDataMiddleware);

// CSRF Protection //
if (!disableCsrf) {
    const COOKIES_SECRET = userModule.getCookieSecret();

    const { generateToken, doubleCsrfProtection } = doubleCsrf({
        getSecret: userModule.getCsrfSecret,
        cookieName: 'X-CSRF-Token',
        cookieOptions: {
            httpOnly: true,
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
    if (userModule.shouldRedirectToLogin(request)) {
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
        const autoLogin = await userModule.tryAutoLogin(request);

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
app.use('/api/users', require('./src/endpoints/users-public').router);

// Everything below this line requires authentication
app.use(userModule.requireLoginMiddleware);
app.get('/api/ping', (_, response) => response.sendStatus(204));

// File uploads
app.use(multer({ dest: UPLOADS_PATH, limits: { fieldSize: 10 * 1024 * 1024 } }).single('avatar'));
app.use(require('./src/middleware/multerMonkeyPatch'));

// User data mount
app.use('/', userModule.router);
// Private endpoints
app.use('/api/users', require('./src/endpoints/users-private').router);
// Admin endpoints
app.use('/api/users', require('./src/endpoints/users-admin').router);

app.get('/version', async function (_, response) {
    const data = await getVersion();
    response.send(data);
});

function cleanUploads() {
    try {
        if (fs.existsSync(UPLOADS_PATH)) {
            const uploads = fs.readdirSync(UPLOADS_PATH);

            if (!uploads.length) {
                return;
            }

            console.debug(`Cleaning uploads folder (${uploads.length} files)`);
            uploads.forEach(file => {
                const pathToFile = path.join(UPLOADS_PATH, file);
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

// Moving UI
app.use('/api/moving-ui', require('./src/endpoints/moving-ui').router);

// Image management
app.use('/api/images', require('./src/endpoints/images').router);

// Quick reply management
app.use('/api/quick-replies', require('./src/endpoints/quick-replies').router);

// Avatar management
app.use('/api/avatars', require('./src/endpoints/avatars').router);

// Theme management
app.use('/api/themes', require('./src/endpoints/themes').router);

// OpenAI API
app.use('/api/openai', require('./src/endpoints/openai').router);

//Google API
app.use('/api/google', require('./src/endpoints/google').router);

//Anthropic API
app.use('/api/anthropic', require('./src/endpoints/anthropic').router);

// Tokenizers
app.use('/api/tokenizers', require('./src/endpoints/tokenizers').router);

// Preset management
app.use('/api/presets', require('./src/endpoints/presets').router);

// Secrets managemenet
app.use('/api/secrets', require('./src/endpoints/secrets').router);

// Thumbnail generation. These URLs are saved in chat, so this route cannot be renamed!
app.use('/thumbnail', require('./src/endpoints/thumbnails').router);

// NovelAI generation
app.use('/api/novelai', require('./src/endpoints/novelai').router);

// Third-party extensions
app.use('/api/extensions', require('./src/endpoints/extensions').router);

// Asset management
app.use('/api/assets', require('./src/endpoints/assets').router);

// File management
app.use('/api/files', require('./src/endpoints/files').router);

// Character management
app.use('/api/characters', require('./src/endpoints/characters').router);

// Chat management
app.use('/api/chats', require('./src/endpoints/chats').router);

// Group management
app.use('/api/groups', require('./src/endpoints/groups').router);

// World info management
app.use('/api/worldinfo', require('./src/endpoints/worldinfo').router);

// Stats calculation
const statsEndpoint = require('./src/endpoints/stats');
app.use('/api/stats', statsEndpoint.router);

// Background management
app.use('/api/backgrounds', require('./src/endpoints/backgrounds').router);

// Character sprite management
app.use('/api/sprites', require('./src/endpoints/sprites').router);

// Custom content management
app.use('/api/content', require('./src/endpoints/content-manager').router);

// Settings load/store
const settingsEndpoint = require('./src/endpoints/settings');
app.use('/api/settings', settingsEndpoint.router);

// Stable Diffusion generation
app.use('/api/sd', require('./src/endpoints/stable-diffusion').router);

// LLM and SD Horde generation
app.use('/api/horde', require('./src/endpoints/horde').router);

// Vector storage DB
app.use('/api/vector', require('./src/endpoints/vectors').router);

// Chat translation
app.use('/api/translate', require('./src/endpoints/translate').router);

// Emotion classification
app.use('/api/extra/classify', require('./src/endpoints/classify').router);

// Image captioning
app.use('/api/extra/caption', require('./src/endpoints/caption').router);

// Web search extension
app.use('/api/serpapi', require('./src/endpoints/serpapi').router);

// The different text generation APIs

// Ooba/OpenAI text completions
app.use('/api/backends/text-completions', require('./src/endpoints/backends/text-completions').router);

// KoboldAI
app.use('/api/backends/kobold', require('./src/endpoints/backends/kobold').router);

// OpenAI chat completions
app.use('/api/backends/chat-completions', require('./src/endpoints/backends/chat-completions').router);

// Scale (alt method)
app.use('/api/backends/scale-alt', require('./src/endpoints/backends/scale-alt').router);

// Speech (text-to-speech and speech-to-text)
app.use('/api/speech', require('./src/endpoints/speech').router);

const tavernUrl = new URL(
    (cliArguments.ssl ? 'https://' : 'http://') +
    (listen ? '0.0.0.0' : '127.0.0.1') +
    (':' + server_port),
);

const autorunUrl = new URL(
    (cliArguments.ssl ? 'https://' : 'http://') +
    ('127.0.0.1') +
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

    const directories = await userModule.getUserDirectoriesList();
    await contentManager.checkForNewContent(directories);
    await ensureThumbnailCache();
    cleanUploads();

    await settingsEndpoint.init();
    await statsEndpoint.init();

    const cleanupPlugins = await loadPlugins();
    const consoleTitle = process.title;

    let isExiting = false;
    const exitProcess = async () => {
        if (isExiting) return;
        isExiting = true;
        statsEndpoint.onExit();
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
};

/**
 * Tasks that need to be run after the server starts listening.
 */
const postSetupTasks = async function () {
    console.log('Launching...');

    if (autorun) open(autorunUrl.toString());

    setWindowTitle('SillyTavern WebServer');

    console.log(color.green('SillyTavern is listening on: ' + tavernUrl));

    if (listen) {
        console.log('\n0.0.0.0 means SillyTavern is listening on all network interfaces (Wi-Fi, LAN, localhost). If you want to limit it only to internal localhost (127.0.0.1), change the setting in config.yaml to "listen: false". Check "access.log" file in the SillyTavern directory if you want to inspect incoming connections.\n');
    }

    if (basicAuthMode) {
        const basicAuthUser = getConfigValue('basicAuthUser', {});
        if (!basicAuthUser?.username || !basicAuthUser?.password) {
            console.warn(color.yellow('Basic Authentication is enabled, but username or password is not set or empty!'));
        }
    }

    if (listen && !basicAuthMode && enableAccounts) {
        await userModule.checkAccountsProtection();
    }
};

/**
 * Loads server plugins from a directory.
 * @returns {Promise<Function>} Function to be run on server exit
 */
async function loadPlugins() {
    try {
        const pluginDirectory = path.join(serverDirectory, 'plugins');
        const loader = require('./src/plugin-loader');
        const cleanupPlugins = await loader.loadPlugins(app, pluginDirectory);
        return cleanupPlugins;
    } catch {
        console.log('Plugin loading failed.');
        return () => { };
    }
}

if (listen && !enableWhitelist && !basicAuthMode) {
    if (getConfigValue('securityOverride', false)) {
        console.warn(color.red('Security has been overridden. If it\'s not a trusted network, change the settings.'));
    }
    else {
        console.error(color.red('Your SillyTavern is currently unsecurely open to the public. Enable whitelisting or basic authentication.'));
        process.exit(1);
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

// User storage module needs to be initialized before starting the server
userModule.initUserStorage(dataRoot)
    .then(userModule.ensurePublicDirectoriesExist)
    .then(userModule.migrateUserData)
    .then(preSetupTasks)
    .finally(() => {
        if (cliArguments.ssl) {
            https.createServer(
                {
                    cert: fs.readFileSync(cliArguments.certPath),
                    key: fs.readFileSync(cliArguments.keyPath),
                }, app)
                .listen(
                    Number(tavernUrl.port) || 443,
                    tavernUrl.hostname,
                    postSetupTasks,
                );
        } else {
            http.createServer(app).listen(
                Number(tavernUrl.port) || 80,
                tavernUrl.hostname,
                postSetupTasks,
            );
        }
    });
