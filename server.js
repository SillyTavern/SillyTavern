#!/usr/bin/env node

// native node modules
const crypto = require('crypto');
const fs = require('fs');
const http = require('http');
const https = require('https');
const path = require('path');
const util = require('util');
const { Readable } = require('stream');

// cli/fs related library imports
const open = require('open');
const sanitize = require('sanitize-filename');
const writeFileAtomicSync = require('write-file-atomic').sync;
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

// express/server related library imports
const cors = require('cors');
const doubleCsrf = require('csrf-csrf').doubleCsrf;
const express = require('express');
const compression = require('compression');
const cookieParser = require('cookie-parser');
const multer = require('multer');
const responseTime = require('response-time');

// net related library imports
const net = require('net');
const dns = require('dns');
const DeviceDetector = require('device-detector-js');
const fetch = require('node-fetch').default;
const ipaddr = require('ipaddr.js');
const ipMatching = require('ip-matching');

// image processing related library imports
const jimp = require('jimp');

// Unrestrict console logs display limit
util.inspect.defaultOptions.maxArrayLength = null;
util.inspect.defaultOptions.maxStringLength = null;

// local library imports
const basicAuthMiddleware = require('./src/middleware/basicAuthMiddleware');
const { jsonParser, urlencodedParser } = require('./src/express-common.js');
const contentManager = require('./src/endpoints/content-manager');
const { readSecret, migrateSecrets, SECRET_KEYS } = require('./src/endpoints/secrets');
const { delay, getVersion, getConfigValue, color, uuidv4, tryParse, clientRelativePath, removeFileExtension, generateTimestamp, removeOldBackups, getImages } = require('./src/util');
const { ensureThumbnailCache } = require('./src/endpoints/thumbnails');
const { getTokenizerModel, getTiktokenTokenizer, loadTokenizers, TEXT_COMPLETION_MODELS, getSentencepiceTokenizer, sentencepieceTokenizers } = require('./src/endpoints/tokenizers');
const { convertClaudePrompt } = require('./src/chat-completion');

// Work around a node v20.0.0, v20.1.0, and v20.2.0 bug. The issue was fixed in v20.3.0.
// https://github.com/nodejs/node/issues/47822#issuecomment-1564708870
// Safe to remove once support for Node v20 is dropped.
if (process.versions && process.versions.node && process.versions.node.match(/20\.[0-2]\.0/)) {
    // @ts-ignore
    if (net.setDefaultAutoSelectFamily) net.setDefaultAutoSelectFamily(false);
}

// Set default DNS resolution order to IPv4 first
dns.setDefaultResultOrder('ipv4first');

const cliArguments = yargs(hideBin(process.argv))
    .option('autorun', {
        type: 'boolean',
        default: false,
        describe: 'Automatically launch SillyTavern in the browser.',
    }).option('corsProxy', {
        type: 'boolean',
        default: false,
        describe: 'Enables CORS proxy',
    }).option('disableCsrf', {
        type: 'boolean',
        default: false,
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
    }).parseSync();

// change all relative paths
const directory = process['pkg'] ? path.dirname(process.execPath) : __dirname;
console.log(process['pkg'] ? 'Running from binary' : 'Running from source');
process.chdir(directory);

const app = express();
app.use(compression());
app.use(responseTime());

const server_port = process.env.SILLY_TAVERN_PORT || getConfigValue('port', 8000);

const whitelistPath = path.join(process.cwd(), './whitelist.txt');
let whitelist = getConfigValue('whitelist', []);

if (fs.existsSync(whitelistPath)) {
    try {
        let whitelistTxt = fs.readFileSync(whitelistPath, 'utf-8');
        whitelist = whitelistTxt.split('\n').filter(ip => ip).map(ip => ip.trim());
    } catch (e) {
        // Ignore errors that may occur when reading the whitelist (e.g. permissions)
    }
}

const whitelistMode = getConfigValue('whitelistMode', true);
const autorun = (getConfigValue('autorun', false) || cliArguments.autorun) && !cliArguments.ssl;
const enableExtensions = getConfigValue('enableExtensions', true);
const listen = getConfigValue('listen', false);

const API_OPENAI = 'https://api.openai.com/v1';
const API_CLAUDE = 'https://api.anthropic.com/v1';

function getMancerHeaders() {
    const apiKey = readSecret(SECRET_KEYS.MANCER);

    return apiKey ? ({
        'X-API-KEY': apiKey,
        'Authorization': `Bearer ${apiKey}`,
    }) : {};
}

function getAphroditeHeaders() {
    const apiKey = readSecret(SECRET_KEYS.APHRODITE);

    return apiKey ? ({
        'X-API-KEY': apiKey,
        'Authorization': `Bearer ${apiKey}`,
    }) : {};
}

function getTabbyHeaders() {
    const apiKey = readSecret(SECRET_KEYS.TABBY);

    return apiKey ? ({
        'x-api-key': apiKey,
        'Authorization': `Bearer ${apiKey}`,
    }) : {};
}

function getOverrideHeaders(urlHost) {
    const requestOverrides = getConfigValue('requestOverrides', []);
    const overrideHeaders = requestOverrides?.find((e) => e.hosts?.includes(urlHost))?.headers;
    if (overrideHeaders && urlHost) {
        return overrideHeaders;
    } else {
        return {};
    }
}

/**
 * Sets additional headers for the request.
 * @param {object} request Original request body
 * @param {object} args New request arguments
 * @param {string|null} server API server for new request
 */
function setAdditionalHeaders(request, args, server) {
    let headers;

    switch (request.body.api_type) {
        case TEXTGEN_TYPES.MANCER:
            headers = getMancerHeaders();
            break;
        case TEXTGEN_TYPES.APHRODITE:
            headers = getAphroditeHeaders();
            break;
        case TEXTGEN_TYPES.TABBY:
            headers = getTabbyHeaders();
            break;
        default:
            headers = server ? getOverrideHeaders((new URL(server))?.host) : {};
            break;
    }

    Object.assign(args.headers, headers);
}

const SETTINGS_FILE = './public/settings.json';
const { DIRECTORIES, UPLOADS_PATH, PALM_SAFETY, TEXTGEN_TYPES, CHAT_COMPLETION_SOURCES, AVATAR_WIDTH, AVATAR_HEIGHT } = require('./src/constants');

// CORS Settings //
const CORS = cors({
    origin: 'null',
    methods: ['OPTIONS'],
});

app.use(CORS);

if (listen && getConfigValue('basicAuthMode', false)) app.use(basicAuthMiddleware);

// IP Whitelist //
let knownIPs = new Set();

function getIpFromRequest(req) {
    let clientIp = req.connection.remoteAddress;
    let ip = ipaddr.parse(clientIp);
    // Check if the IP address is IPv4-mapped IPv6 address
    if (ip.kind() === 'ipv6' && ip instanceof ipaddr.IPv6 && ip.isIPv4MappedAddress()) {
        const ipv4 = ip.toIPv4Address().toString();
        clientIp = ipv4;
    } else {
        clientIp = ip;
        clientIp = clientIp.toString();
    }
    return clientIp;
}

app.use(function (req, res, next) {
    const clientIp = getIpFromRequest(req);

    if (listen && !knownIPs.has(clientIp)) {
        const userAgent = req.headers['user-agent'];
        console.log(color.yellow(`New connection from ${clientIp}; User Agent: ${userAgent}\n`));
        knownIPs.add(clientIp);

        // Write access log
        const timestamp = new Date().toISOString();
        const log = `${timestamp} ${clientIp} ${userAgent}\n`;
        fs.appendFile('access.log', log, (err) => {
            if (err) {
                console.error('Failed to write access log:', err);
            }
        });
    }

    //clientIp = req.connection.remoteAddress.split(':').pop();
    if (whitelistMode === true && !whitelist.some(x => ipMatching.matches(clientIp, ipMatching.getMatch(x)))) {
        console.log(color.red('Forbidden: Connection attempt from ' + clientIp + '. If you are attempting to connect, please add your IP address in whitelist or disable whitelist mode in config.yaml in root of SillyTavern folder.\n'));
        return res.status(403).send('<b>Forbidden</b>: Connection attempt from <b>' + clientIp + '</b>. If you are attempting to connect, please add your IP address in whitelist or disable whitelist mode in config.yaml in root of SillyTavern folder.');
    }
    next();
});

// CSRF Protection //
if (!cliArguments.disableCsrf) {
    const CSRF_SECRET = crypto.randomBytes(8).toString('hex');
    const COOKIES_SECRET = crypto.randomBytes(8).toString('hex');

    const { generateToken, doubleCsrfProtection } = doubleCsrf({
        getSecret: () => CSRF_SECRET,
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

if (getConfigValue('enableCorsProxy', false) || cliArguments.corsProxy) {
    const bodyParser = require('body-parser');
    app.use(bodyParser.json());
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
            res.statusCode = response.status;
            res.statusMessage = response.statusText;
            response.body.pipe(res);

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

app.use(express.static(process.cwd() + '/public', {}));

app.use('/backgrounds', (req, res) => {
    const filePath = decodeURIComponent(path.join(process.cwd(), 'public/backgrounds', req.url.replace(/%20/g, ' ')));
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.status(404).send('File not found');
            return;
        }
        //res.contentType('image/jpeg');
        res.send(data);
    });
});

app.use('/characters', (req, res) => {
    const filePath = decodeURIComponent(path.join(process.cwd(), DIRECTORIES.characters, req.url.replace(/%20/g, ' ')));
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.status(404).send('File not found');
            return;
        }
        res.send(data);
    });
});
app.use(multer({ dest: UPLOADS_PATH, limits: { fieldSize: 10 * 1024 * 1024 } }).single('avatar'));
app.get('/', function (request, response) {
    response.sendFile(process.cwd() + '/public/index.html');
});
app.get('/notes/*', function (request, response) {
    response.sendFile(process.cwd() + '/public' + request.url + '.html');
});
app.get('/deviceinfo', function (request, response) {
    const userAgent = request.header('user-agent');
    const deviceDetector = new DeviceDetector();
    const deviceInfo = deviceDetector.parse(userAgent || '');
    return response.send(deviceInfo);
});
app.get('/version', async function (_, response) {
    const data = await getVersion();
    response.send(data);
});

//**************Kobold api
app.post('/generate', jsonParser, async function (request, response_generate) {
    if (!request.body) return response_generate.sendStatus(400);

    if (request.body.api_server.indexOf('localhost') != -1) {
        request.body.api_server = request.body.api_server.replace('localhost', '127.0.0.1');
    }

    const request_prompt = request.body.prompt;
    const controller = new AbortController();
    request.socket.removeAllListeners('close');
    request.socket.on('close', async function () {
        if (request.body.can_abort && !response_generate.writableEnded) {
            try {
                console.log('Aborting Kobold generation...');
                // send abort signal to koboldcpp
                const abortResponse = await fetch(`${request.body.api_server}/extra/abort`, {
                    method: 'POST',
                });

                if (!abortResponse.ok) {
                    console.log('Error sending abort request to Kobold:', abortResponse.status);
                }
            } catch (error) {
                console.log(error);
            }
        }
        controller.abort();
    });

    let this_settings = {
        prompt: request_prompt,
        use_story: false,
        use_memory: false,
        use_authors_note: false,
        use_world_info: false,
        max_context_length: request.body.max_context_length,
        max_length: request.body.max_length,
    };

    if (request.body.gui_settings == false) {
        const sampler_order = [request.body.s1, request.body.s2, request.body.s3, request.body.s4, request.body.s5, request.body.s6, request.body.s7];
        this_settings = {
            prompt: request_prompt,
            use_story: false,
            use_memory: false,
            use_authors_note: false,
            use_world_info: false,
            max_context_length: request.body.max_context_length,
            max_length: request.body.max_length,
            rep_pen: request.body.rep_pen,
            rep_pen_range: request.body.rep_pen_range,
            rep_pen_slope: request.body.rep_pen_slope,
            temperature: request.body.temperature,
            tfs: request.body.tfs,
            top_a: request.body.top_a,
            top_k: request.body.top_k,
            top_p: request.body.top_p,
            min_p: request.body.min_p,
            typical: request.body.typical,
            sampler_order: sampler_order,
            singleline: !!request.body.singleline,
            use_default_badwordsids: request.body.use_default_badwordsids,
            mirostat: request.body.mirostat,
            mirostat_eta: request.body.mirostat_eta,
            mirostat_tau: request.body.mirostat_tau,
            grammar: request.body.grammar,
            sampler_seed: request.body.sampler_seed,
        };
        if (request.body.stop_sequence) {
            this_settings['stop_sequence'] = request.body.stop_sequence;
        }
    }

    console.log(this_settings);
    const args = {
        body: JSON.stringify(this_settings),
        headers: Object.assign(
            { 'Content-Type': 'application/json' },
            getOverrideHeaders((new URL(request.body.api_server))?.host),
        ),
        signal: controller.signal,
    };

    const MAX_RETRIES = 50;
    const delayAmount = 2500;
    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            const url = request.body.streaming ? `${request.body.api_server}/extra/generate/stream` : `${request.body.api_server}/v1/generate`;
            const response = await fetch(url, { method: 'POST', timeout: 0, ...args });

            if (request.body.streaming) {
                request.socket.on('close', function () {
                    if (response.body instanceof Readable) response.body.destroy(); // Close the remote stream
                    response_generate.end(); // End the Express response
                });

                response.body.on('end', function () {
                    console.log('Streaming request finished');
                    response_generate.end();
                });

                // Pipe remote SSE stream to Express response
                return response.body.pipe(response_generate);
            } else {
                if (!response.ok) {
                    const errorText = await response.text();
                    console.log(`Kobold returned error: ${response.status} ${response.statusText} ${errorText}`);

                    try {
                        const errorJson = JSON.parse(errorText);
                        const message = errorJson?.detail?.msg || errorText;
                        return response_generate.status(400).send({ error: { message } });
                    } catch {
                        return response_generate.status(400).send({ error: { message: errorText } });
                    }
                }

                const data = await response.json();
                console.log('Endpoint response:', data);
                return response_generate.send(data);
            }
        } catch (error) {
            // response
            switch (error?.status) {
                case 403:
                case 503: // retry in case of temporary service issue, possibly caused by a queue failure?
                    console.debug(`KoboldAI is busy. Retry attempt ${i + 1} of ${MAX_RETRIES}...`);
                    await delay(delayAmount);
                    break;
                default:
                    if ('status' in error) {
                        console.log('Status Code from Kobold:', error.status);
                    }
                    return response_generate.send({ error: true });
            }
        }
    }

    console.log('Max retries exceeded. Giving up.');
    return response_generate.send({ error: true });
});

//************** Text generation web UI
app.post('/api/textgenerationwebui/status', jsonParser, async function (request, response) {
    if (!request.body) return response.sendStatus(400);

    try {
        if (request.body.api_server.indexOf('localhost') !== -1) {
            request.body.api_server = request.body.api_server.replace('localhost', '127.0.0.1');
        }

        console.log('Trying to connect to API:', request.body);

        // Convert to string + remove trailing slash + /v1 suffix
        const baseUrl = String(request.body.api_server).replace(/\/$/, '').replace(/\/v1$/, '');

        const args = {
            headers: { 'Content-Type': 'application/json' },
        };

        setAdditionalHeaders(request, args, baseUrl);

        let url = baseUrl;
        let result = '';

        if (request.body.legacy_api) {
            url += '/v1/model';
        } else {
            switch (request.body.api_type) {
                case TEXTGEN_TYPES.OOBA:
                case TEXTGEN_TYPES.APHRODITE:
                case TEXTGEN_TYPES.KOBOLDCPP:
                    url += '/v1/models';
                    break;
                case TEXTGEN_TYPES.MANCER:
                    url += '/oai/v1/models';
                    break;
                case TEXTGEN_TYPES.TABBY:
                    url += '/v1/model/list';
                    break;
            }
        }

        const modelsReply = await fetch(url, args);

        if (!modelsReply.ok) {
            console.log('Models endpoint is offline.');
            return response.status(400);
        }

        const data = await modelsReply.json();

        if (request.body.legacy_api) {
            console.log('Legacy API response:', data);
            return response.send({ result: data?.result });
        }

        if (!Array.isArray(data.data)) {
            console.log('Models response is not an array.');
            return response.status(400);
        }

        const modelIds = data.data.map(x => x.id);
        console.log('Models available:', modelIds);

        // Set result to the first model ID
        result = modelIds[0] || 'Valid';

        if (request.body.api_type === TEXTGEN_TYPES.OOBA) {
            try {
                const modelInfoUrl = baseUrl + '/v1/internal/model/info';
                const modelInfoReply = await fetch(modelInfoUrl, args);

                if (modelInfoReply.ok) {
                    const modelInfo = await modelInfoReply.json();
                    console.log('Ooba model info:', modelInfo);

                    const modelName = modelInfo?.model_name;
                    result = modelName || result;
                }
            } catch (error) {
                console.error(`Failed to get Ooba model info: ${error}`);
            }
        } else if (request.body.api_type === TEXTGEN_TYPES.TABBY) {
            try {
                const modelInfoUrl = baseUrl + '/v1/model';
                const modelInfoReply = await fetch(modelInfoUrl, args);

                if (modelInfoReply.ok) {
                    const modelInfo = await modelInfoReply.json();
                    console.log('Tabby model info:', modelInfo);

                    const modelName = modelInfo?.id;
                    result = modelName || result;
                } else {
                    // TabbyAPI returns an error 400 if a model isn't loaded

                    result = 'None';
                }
            } catch (error) {
                console.error(`Failed to get TabbyAPI model info: ${error}`);
            }
        }

        return response.send({ result, data: data.data });
    } catch (error) {
        console.error(error);
        return response.status(500);
    }
});

app.post('/api/textgenerationwebui/generate', jsonParser, async function (request, response_generate) {
    if (!request.body) return response_generate.sendStatus(400);

    try {
        if (request.body.api_server.indexOf('localhost') !== -1) {
            request.body.api_server = request.body.api_server.replace('localhost', '127.0.0.1');
        }

        const baseUrl = request.body.api_server;
        console.log(request.body);

        const controller = new AbortController();
        request.socket.removeAllListeners('close');
        request.socket.on('close', function () {
            controller.abort();
        });

        // Convert to string + remove trailing slash + /v1 suffix
        let url = String(baseUrl).replace(/\/$/, '').replace(/\/v1$/, '');

        if (request.body.legacy_api) {
            url += '/v1/generate';
        } else {
            switch (request.body.api_type) {
                case TEXTGEN_TYPES.APHRODITE:
                case TEXTGEN_TYPES.OOBA:
                case TEXTGEN_TYPES.TABBY:
                case TEXTGEN_TYPES.KOBOLDCPP:
                    url += '/v1/completions';
                    break;
                case TEXTGEN_TYPES.MANCER:
                    url += '/oai/v1/completions';
                    break;
            }
        }

        const args = {
            method: 'POST',
            body: JSON.stringify(request.body),
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            timeout: 0,
        };

        setAdditionalHeaders(request, args, baseUrl);

        if (request.body.stream) {
            const completionsStream = await fetch(url, args);
            // Pipe remote SSE stream to Express response
            completionsStream.body.pipe(response_generate);

            request.socket.on('close', function () {
                if (completionsStream.body instanceof Readable) completionsStream.body.destroy(); // Close the remote stream
                response_generate.end(); // End the Express response
            });

            completionsStream.body.on('end', function () {
                console.log('Streaming request finished');
                response_generate.end();
            });
        }
        else {
            const completionsReply = await fetch(url, args);

            if (completionsReply.ok) {
                const data = await completionsReply.json();
                console.log('Endpoint response:', data);

                // Wrap legacy response to OAI completions format
                if (request.body.legacy_api) {
                    const text = data?.results[0]?.text;
                    data['choices'] = [{ text }];
                }

                return response_generate.send(data);
            } else {
                const text = await completionsReply.text();
                const errorBody = { error: true, status: completionsReply.status, response: text };

                if (!response_generate.headersSent) {
                    return response_generate.send(errorBody);
                }

                return response_generate.end();
            }
        }
    } catch (error) {
        let value = { error: true, status: error?.status, response: error?.statusText };
        console.log('Endpoint error:', error);

        if (!response_generate.headersSent) {
            return response_generate.send(value);
        }

        return response_generate.end();
    }
});

// Only called for kobold
app.post('/getstatus', jsonParser, async function (request, response) {
    if (!request.body) return response.sendStatus(400);
    let api_server = request.body.api_server;
    if (api_server.indexOf('localhost') != -1) {
        api_server = api_server.replace('localhost', '127.0.0.1');
    }

    const args = {
        headers: { 'Content-Type': 'application/json' },
    };

    setAdditionalHeaders(request, args, api_server);

    const url = api_server + '/v1/model';
    let version = '';
    let koboldVersion = {};

    if (request.body.main_api == 'kobold') {
        try {
            version = (await fetchJSON(api_server + '/v1/info/version')).result;
        }
        catch {
            version = '0.0.0';
        }
        try {
            koboldVersion = (await fetchJSON(api_server + '/extra/version'));
        }
        catch {
            koboldVersion = {
                result: 'Kobold',
                version: '0.0',
            };
        }
    }

    try {
        let data = await fetchJSON(url, args);

        if (!data || typeof data !== 'object') {
            data = {};
        }

        if (data.result == 'ReadOnly') {
            data.result = 'no_connection';
        }

        data.version = version;
        data.koboldVersion = koboldVersion;

        return response.send(data);
    } catch (error) {
        console.log(error);
        return response.send({ result: 'no_connection' });
    }
});


app.post('/getuseravatars', jsonParser, function (request, response) {
    var images = getImages('public/User Avatars');
    response.send(JSON.stringify(images));

});

app.post('/deleteuseravatar', jsonParser, function (request, response) {
    if (!request.body) return response.sendStatus(400);

    if (request.body.avatar !== sanitize(request.body.avatar)) {
        console.error('Malicious avatar name prevented');
        return response.sendStatus(403);
    }

    const fileName = path.join(DIRECTORIES.avatars, sanitize(request.body.avatar));

    if (fs.existsSync(fileName)) {
        fs.rmSync(fileName);
        return response.send({ result: 'ok' });
    }

    return response.sendStatus(404);
});


app.post('/savesettings', jsonParser, function (request, response) {
    try {
        writeFileAtomicSync('public/settings.json', JSON.stringify(request.body, null, 4), 'utf8');
        response.send({ result: 'ok' });
    } catch (err) {
        console.log(err);
        response.send(err);
    }
});

function readAndParseFromDirectory(directoryPath, fileExtension = '.json') {
    const files = fs
        .readdirSync(directoryPath)
        .filter(x => path.parse(x).ext == fileExtension)
        .sort();

    const parsedFiles = [];

    files.forEach(item => {
        try {
            const file = fs.readFileSync(path.join(directoryPath, item), 'utf-8');
            parsedFiles.push(fileExtension == '.json' ? JSON.parse(file) : file);
        }
        catch {
            // skip
        }
    });

    return parsedFiles;
}

function sortByName(_) {
    return (a, b) => a.localeCompare(b);
}

function readPresetsFromDirectory(directoryPath, options = {}) {
    const {
        sortFunction,
        removeFileExtension = false,
        fileExtension = '.json',
    } = options;

    const files = fs.readdirSync(directoryPath).sort(sortFunction).filter(x => path.parse(x).ext == fileExtension);
    const fileContents = [];
    const fileNames = [];

    files.forEach(item => {
        try {
            const file = fs.readFileSync(path.join(directoryPath, item), 'utf8');
            JSON.parse(file);
            fileContents.push(file);
            fileNames.push(removeFileExtension ? item.replace(/\.[^/.]+$/, '') : item);
        } catch {
            // skip
            console.log(`${item} is not a valid JSON`);
        }
    });

    return { fileContents, fileNames };
}

// Wintermute's code
app.post('/getsettings', jsonParser, (request, response) => {
    let settings;
    try {
        settings = fs.readFileSync('public/settings.json', 'utf8');
    } catch (e) {
        return response.sendStatus(500);
    }

    // NovelAI Settings
    const { fileContents: novelai_settings, fileNames: novelai_setting_names }
        = readPresetsFromDirectory(DIRECTORIES.novelAI_Settings, {
            sortFunction: sortByName(DIRECTORIES.novelAI_Settings),
            removeFileExtension: true,
        });

    // OpenAI Settings
    const { fileContents: openai_settings, fileNames: openai_setting_names }
        = readPresetsFromDirectory(DIRECTORIES.openAI_Settings, {
            sortFunction: sortByName(DIRECTORIES.openAI_Settings), removeFileExtension: true,
        });

    // TextGenerationWebUI Settings
    const { fileContents: textgenerationwebui_presets, fileNames: textgenerationwebui_preset_names }
        = readPresetsFromDirectory(DIRECTORIES.textGen_Settings, {
            sortFunction: sortByName(DIRECTORIES.textGen_Settings), removeFileExtension: true,
        });

    //Kobold
    const { fileContents: koboldai_settings, fileNames: koboldai_setting_names }
        = readPresetsFromDirectory(DIRECTORIES.koboldAI_Settings, {
            sortFunction: sortByName(DIRECTORIES.koboldAI_Settings), removeFileExtension: true,
        });

    const worldFiles = fs
        .readdirSync(DIRECTORIES.worlds)
        .filter(file => path.extname(file).toLowerCase() === '.json')
        .sort((a, b) => a.localeCompare(b));
    const world_names = worldFiles.map(item => path.parse(item).name);

    const themes = readAndParseFromDirectory(DIRECTORIES.themes);
    const movingUIPresets = readAndParseFromDirectory(DIRECTORIES.movingUI);
    const quickReplyPresets = readAndParseFromDirectory(DIRECTORIES.quickreplies);

    const instruct = readAndParseFromDirectory(DIRECTORIES.instruct);
    const context = readAndParseFromDirectory(DIRECTORIES.context);

    response.send({
        settings,
        koboldai_settings,
        koboldai_setting_names,
        world_names,
        novelai_settings,
        novelai_setting_names,
        openai_settings,
        openai_setting_names,
        textgenerationwebui_presets,
        textgenerationwebui_preset_names,
        themes,
        movingUIPresets,
        quickReplyPresets,
        instruct,
        context,
        enable_extensions: enableExtensions,
    });
});

app.post('/savetheme', jsonParser, (request, response) => {
    if (!request.body || !request.body.name) {
        return response.sendStatus(400);
    }

    const filename = path.join(DIRECTORIES.themes, sanitize(request.body.name) + '.json');
    writeFileAtomicSync(filename, JSON.stringify(request.body, null, 4), 'utf8');

    return response.sendStatus(200);
});

app.post('/savemovingui', jsonParser, (request, response) => {
    if (!request.body || !request.body.name) {
        return response.sendStatus(400);
    }

    const filename = path.join(DIRECTORIES.movingUI, sanitize(request.body.name) + '.json');
    writeFileAtomicSync(filename, JSON.stringify(request.body, null, 4), 'utf8');

    return response.sendStatus(200);
});

app.post('/savequickreply', jsonParser, (request, response) => {
    if (!request.body || !request.body.name) {
        return response.sendStatus(400);
    }

    const filename = path.join(DIRECTORIES.quickreplies, sanitize(request.body.name) + '.json');
    writeFileAtomicSync(filename, JSON.stringify(request.body, null, 4), 'utf8');

    return response.sendStatus(200);
});


app.post('/uploaduseravatar', urlencodedParser, async (request, response) => {
    if (!request.file) return response.sendStatus(400);

    try {
        const pathToUpload = path.join(UPLOADS_PATH, request.file.filename);
        const crop = tryParse(request.query.crop);
        let rawImg = await jimp.read(pathToUpload);

        if (typeof crop == 'object' && [crop.x, crop.y, crop.width, crop.height].every(x => typeof x === 'number')) {
            rawImg = rawImg.crop(crop.x, crop.y, crop.width, crop.height);
        }

        const image = await rawImg.cover(AVATAR_WIDTH, AVATAR_HEIGHT).getBufferAsync(jimp.MIME_PNG);

        const filename = request.body.overwrite_name || `${Date.now()}.png`;
        const pathToNewFile = path.join(DIRECTORIES.avatars, filename);
        writeFileAtomicSync(pathToNewFile, image);
        fs.rmSync(pathToUpload);
        return response.send({ path: filename });
    } catch (err) {
        return response.status(400).send('Is not a valid image');
    }
});


/**
 * Ensure the directory for the provided file path exists.
 * If not, it will recursively create the directory.
 *
 * @param {string} filePath - The full path of the file for which the directory should be ensured.
 */
function ensureDirectoryExistence(filePath) {
    const dirname = path.dirname(filePath);
    if (fs.existsSync(dirname)) {
        return true;
    }
    ensureDirectoryExistence(dirname);
    fs.mkdirSync(dirname);
}

/**
 * Endpoint to handle image uploads.
 * The image should be provided in the request body in base64 format.
 * Optionally, a character name can be provided to save the image in a sub-folder.
 *
 * @route POST /uploadimage
 * @param {Object} request.body - The request payload.
 * @param {string} request.body.image - The base64 encoded image data.
 * @param {string} [request.body.ch_name] - Optional character name to determine the sub-directory.
 * @returns {Object} response - The response object containing the path where the image was saved.
 */
app.post('/uploadimage', jsonParser, async (request, response) => {
    // Check for image data
    if (!request.body || !request.body.image) {
        return response.status(400).send({ error: 'No image data provided' });
    }

    try {
        // Extracting the base64 data and the image format
        const splitParts = request.body.image.split(',');
        const format = splitParts[0].split(';')[0].split('/')[1];
        const base64Data = splitParts[1];
        const validFormat = ['png', 'jpg', 'webp', 'jpeg', 'gif'].includes(format);
        if (!validFormat) {
            return response.status(400).send({ error: 'Invalid image format' });
        }

        // Constructing filename and path
        let filename;
        if (request.body.filename) {
            filename = `${removeFileExtension(request.body.filename)}.${format}`;
        } else {
            filename = `${Date.now()}.${format}`;
        }

        // if character is defined, save to a sub folder for that character
        let pathToNewFile = path.join(DIRECTORIES.userImages, filename);
        if (request.body.ch_name) {
            pathToNewFile = path.join(DIRECTORIES.userImages, request.body.ch_name, filename);
        }

        ensureDirectoryExistence(pathToNewFile);
        const imageBuffer = Buffer.from(base64Data, 'base64');
        await fs.promises.writeFile(pathToNewFile, imageBuffer);
        response.send({ path: clientRelativePath(pathToNewFile) });
    } catch (error) {
        console.log(error);
        response.status(500).send({ error: 'Failed to save the image' });
    }
});

app.post('/listimgfiles/:folder', (req, res) => {
    const directoryPath = path.join(process.cwd(), 'public/user/images/', sanitize(req.params.folder));

    if (!fs.existsSync(directoryPath)) {
        fs.mkdirSync(directoryPath, { recursive: true });
    }

    try {
        const images = getImages(directoryPath);
        return res.send(images);
    } catch (error) {
        console.error(error);
        return res.status(500).send({ error: 'Unable to retrieve files' });
    }
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

/* OpenAI */
app.post('/getstatus_openai', jsonParser, async function (request, response_getstatus_openai) {
    if (!request.body) return response_getstatus_openai.sendStatus(400);

    let api_url;
    let api_key_openai;
    let headers;

    if (request.body.chat_completion_source !== CHAT_COMPLETION_SOURCES.OPENROUTER) {
        api_url = new URL(request.body.reverse_proxy || API_OPENAI).toString();
        api_key_openai = request.body.reverse_proxy ? request.body.proxy_password : readSecret(SECRET_KEYS.OPENAI);
        headers = {};
    } else {
        api_url = 'https://openrouter.ai/api/v1';
        api_key_openai = readSecret(SECRET_KEYS.OPENROUTER);
        // OpenRouter needs to pass the referer: https://openrouter.ai/docs
        headers = { 'HTTP-Referer': request.headers.referer };
    }

    if (!api_key_openai && !request.body.reverse_proxy) {
        console.log('OpenAI API key is missing.');
        return response_getstatus_openai.status(400).send({ error: true });
    }

    try {
        const response = await fetch(api_url + '/models', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + api_key_openai,
                ...headers,
            },
        });

        if (response.ok) {
            const data = await response.json();
            response_getstatus_openai.send(data);

            if (request.body.chat_completion_source === CHAT_COMPLETION_SOURCES.OPENROUTER && Array.isArray(data?.data)) {
                let models = [];

                data.data.forEach(model => {
                    const context_length = model.context_length;
                    const tokens_dollar = Number(1 / (1000 * model.pricing?.prompt));
                    const tokens_rounded = (Math.round(tokens_dollar * 1000) / 1000).toFixed(0);
                    models[model.id] = {
                        tokens_per_dollar: tokens_rounded + 'k',
                        context_length: context_length,
                    };
                });

                console.log('Available OpenRouter models:', models);
            } else {
                const models = data?.data;

                if (Array.isArray(models)) {
                    const modelIds = models.filter(x => x && typeof x === 'object').map(x => x.id).sort();
                    console.log('Available OpenAI models:', modelIds);
                } else {
                    console.log('OpenAI endpoint did not return a list of models.');
                }
            }
        }
        else {
            console.log('OpenAI status check failed. Either Access Token is incorrect or API endpoint is down.');
            response_getstatus_openai.send({ error: true, can_bypass: true, data: { data: [] } });
        }
    } catch (e) {
        console.error(e);

        if (!response_getstatus_openai.headersSent) {
            response_getstatus_openai.send({ error: true });
        } else {
            response_getstatus_openai.end();
        }
    }
});

app.post('/openai_bias', jsonParser, async function (request, response) {
    if (!request.body || !Array.isArray(request.body))
        return response.sendStatus(400);

    try {
        const result = {};
        const model = getTokenizerModel(String(request.query.model || ''));

        // no bias for claude
        if (model == 'claude') {
            return response.send(result);
        }

        let encodeFunction;

        if (sentencepieceTokenizers.includes(model)) {
            const tokenizer = getSentencepiceTokenizer(model);
            const instance = await tokenizer?.get();
            encodeFunction = (text) => new Uint32Array(instance?.encodeIds(text));
        } else {
            const tokenizer = getTiktokenTokenizer(model);
            encodeFunction = (tokenizer.encode.bind(tokenizer));
        }

        for (const entry of request.body) {
            if (!entry || !entry.text) {
                continue;
            }

            try {
                const tokens = getEntryTokens(entry.text, encodeFunction);

                for (const token of tokens) {
                    result[token] = entry.value;
                }
            } catch {
                console.warn('Tokenizer failed to encode:', entry.text);
            }
        }

        // not needed for cached tokenizers
        //tokenizer.free();
        return response.send(result);

        /**
         * Gets tokenids for a given entry
         * @param {string} text Entry text
         * @param {(string) => Uint32Array} encode Function to encode text to token ids
         * @returns {Uint32Array} Array of token ids
         */
        function getEntryTokens(text, encode) {
            // Get raw token ids from JSON array
            if (text.trim().startsWith('[') && text.trim().endsWith(']')) {
                try {
                    const json = JSON.parse(text);
                    if (Array.isArray(json) && json.every(x => typeof x === 'number')) {
                        return new Uint32Array(json);
                    }
                } catch {
                    // ignore
                }
            }

            // Otherwise, get token ids from tokenizer
            return encode(text);
        }
    } catch (error) {
        console.error(error);
        return response.send({});
    }
});

function convertChatMLPrompt(messages) {
    if (typeof messages === 'string') {
        return messages;
    }

    const messageStrings = [];
    messages.forEach(m => {
        if (m.role === 'system' && m.name === undefined) {
            messageStrings.push('System: ' + m.content);
        }
        else if (m.role === 'system' && m.name !== undefined) {
            messageStrings.push(m.name + ': ' + m.content);
        }
        else {
            messageStrings.push(m.role + ': ' + m.content);
        }
    });
    return messageStrings.join('\n') + '\nassistant:';
}

async function sendScaleRequest(request, response) {

    const api_url = new URL(request.body.api_url_scale).toString();
    const api_key_scale = readSecret(SECRET_KEYS.SCALE);

    if (!api_key_scale) {
        console.log('Scale API key is missing.');
        return response.status(400).send({ error: true });
    }

    const requestPrompt = convertChatMLPrompt(request.body.messages);
    console.log('Scale request:', requestPrompt);

    try {
        const controller = new AbortController();
        request.socket.removeAllListeners('close');
        request.socket.on('close', function () {
            controller.abort();
        });

        const generateResponse = await fetch(api_url, {
            method: 'POST',
            body: JSON.stringify({ input: { input: requestPrompt } }),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${api_key_scale}`,
            },
            timeout: 0,
        });

        if (!generateResponse.ok) {
            console.log(`Scale API returned error: ${generateResponse.status} ${generateResponse.statusText} ${await generateResponse.text()}`);
            return response.status(generateResponse.status).send({ error: true });
        }

        const generateResponseJson = await generateResponse.json();
        console.log('Scale response:', generateResponseJson);

        const reply = { choices: [{ 'message': { 'content': generateResponseJson.output } }] };
        return response.send(reply);
    } catch (error) {
        console.log(error);
        if (!response.headersSent) {
            return response.status(500).send({ error: true });
        }
    }
}

app.post('/generate_altscale', jsonParser, function (request, response_generate_scale) {
    if (!request.body) return response_generate_scale.sendStatus(400);

    fetch('https://dashboard.scale.com/spellbook/api/trpc/v2.variant.run', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'cookie': `_jwt=${readSecret(SECRET_KEYS.SCALE_COOKIE)}`,
        },
        body: JSON.stringify({
            json: {
                variant: {
                    name: 'New Variant',
                    appId: '',
                    taxonomy: null,
                },
                prompt: {
                    id: '',
                    template: '{{input}}\n',
                    exampleVariables: {},
                    variablesSourceDataId: null,
                    systemMessage: request.body.sysprompt,
                },
                modelParameters: {
                    id: '',
                    modelId: 'GPT4',
                    modelType: 'OpenAi',
                    maxTokens: request.body.max_tokens,
                    temperature: request.body.temp,
                    stop: 'user:',
                    suffix: null,
                    topP: request.body.top_p,
                    logprobs: null,
                    logitBias: request.body.logit_bias,
                },
                inputs: [
                    {
                        index: '-1',
                        valueByName: {
                            input: request.body.prompt,
                        },
                    },
                ],
            },
            meta: {
                values: {
                    'variant.taxonomy': ['undefined'],
                    'prompt.variablesSourceDataId': ['undefined'],
                    'modelParameters.suffix': ['undefined'],
                    'modelParameters.logprobs': ['undefined'],
                },
            },
        }),
    })
        .then(response => response.json())
        .then(data => {
            console.log(data.result.data.json.outputs[0]);
            return response_generate_scale.send({ output: data.result.data.json.outputs[0] });
        })
        .catch((error) => {
            console.error('Error:', error);
            return response_generate_scale.send({ error: true });
        });

});

/**
 * @param {express.Request} request
 * @param {express.Response} response
 */
async function sendClaudeRequest(request, response) {

    const api_url = new URL(request.body.reverse_proxy || API_CLAUDE).toString();
    const api_key_claude = request.body.reverse_proxy ? request.body.proxy_password : readSecret(SECRET_KEYS.CLAUDE);

    if (!api_key_claude) {
        console.log('Claude API key is missing.');
        return response.status(400).send({ error: true });
    }

    try {
        const controller = new AbortController();
        request.socket.removeAllListeners('close');
        request.socket.on('close', function () {
            controller.abort();
        });

        let doSystemPrompt = request.body.model === 'claude-2' || request.body.model === 'claude-2.1';
        let requestPrompt = convertClaudePrompt(request.body.messages, true, !request.body.exclude_assistant, doSystemPrompt);

        if (request.body.assistant_prefill && !request.body.exclude_assistant) {
            requestPrompt += request.body.assistant_prefill;
        }

        console.log('Claude request:', requestPrompt);
        const stop_sequences = ['\n\nHuman:', '\n\nSystem:', '\n\nAssistant:'];

        // Add custom stop sequences
        if (Array.isArray(request.body.stop)) {
            stop_sequences.push(...request.body.stop);
        }

        const generateResponse = await fetch(api_url + '/complete', {
            method: 'POST',
            signal: controller.signal,
            body: JSON.stringify({
                prompt: requestPrompt,
                model: request.body.model,
                max_tokens_to_sample: request.body.max_tokens,
                stop_sequences: stop_sequences,
                temperature: request.body.temperature,
                top_p: request.body.top_p,
                top_k: request.body.top_k,
                stream: request.body.stream,
            }),
            headers: {
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01',
                'x-api-key': api_key_claude,
            },
            timeout: 0,
        });

        if (request.body.stream) {
            // Pipe remote SSE stream to Express response
            generateResponse.body.pipe(response);

            request.socket.on('close', function () {
                if (generateResponse.body instanceof Readable) generateResponse.body.destroy(); // Close the remote stream
                response.end(); // End the Express response
            });

            generateResponse.body.on('end', function () {
                console.log('Streaming request finished');
                response.end();
            });
        } else {
            if (!generateResponse.ok) {
                console.log(`Claude API returned error: ${generateResponse.status} ${generateResponse.statusText} ${await generateResponse.text()}`);
                return response.status(generateResponse.status).send({ error: true });
            }

            const generateResponseJson = await generateResponse.json();
            const responseText = generateResponseJson.completion;
            console.log('Claude response:', responseText);

            // Wrap it back to OAI format
            const reply = { choices: [{ 'message': { 'content': responseText } }] };
            return response.send(reply);
        }
    } catch (error) {
        console.log('Error communicating with Claude: ', error);
        if (!response.headersSent) {
            return response.status(500).send({ error: true });
        }
    }
}

/**
 * @param {express.Request} request
 * @param {express.Response} response
 */
async function sendPalmRequest(request, response) {
    const api_key_palm = readSecret(SECRET_KEYS.PALM);

    if (!api_key_palm) {
        console.log('Palm API key is missing.');
        return response.status(400).send({ error: true });
    }

    const body = {
        prompt: {
            text: request.body.messages,
        },
        stopSequences: request.body.stop,
        safetySettings: PALM_SAFETY,
        temperature: request.body.temperature,
        topP: request.body.top_p,
        topK: request.body.top_k || undefined,
        maxOutputTokens: request.body.max_tokens,
        candidate_count: 1,
    };

    console.log('Palm request:', body);

    try {
        const controller = new AbortController();
        request.socket.removeAllListeners('close');
        request.socket.on('close', function () {
            controller.abort();
        });

        const generateResponse = await fetch(`https://generativelanguage.googleapis.com/v1beta2/models/text-bison-001:generateText?key=${api_key_palm}`, {
            body: JSON.stringify(body),
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            signal: controller.signal,
            timeout: 0,
        });

        if (!generateResponse.ok) {
            console.log(`Palm API returned error: ${generateResponse.status} ${generateResponse.statusText} ${await generateResponse.text()}`);
            return response.status(generateResponse.status).send({ error: true });
        }

        const generateResponseJson = await generateResponse.json();
        const responseText = generateResponseJson?.candidates[0]?.output;

        if (!responseText) {
            console.log('Palm API returned no response', generateResponseJson);
            let message = `Palm API returned no response: ${JSON.stringify(generateResponseJson)}`;

            // Check for filters
            if (generateResponseJson?.filters[0]?.message) {
                message = `Palm filter triggered: ${generateResponseJson.filters[0].message}`;
            }

            return response.send({ error: { message } });
        }

        console.log('Palm response:', responseText);

        // Wrap it back to OAI format
        const reply = { choices: [{ 'message': { 'content': responseText } }] };
        return response.send(reply);
    } catch (error) {
        console.log('Error communicating with Palm API: ', error);
        if (!response.headersSent) {
            return response.status(500).send({ error: true });
        }
    }
}

app.post('/generate_openai', jsonParser, function (request, response_generate_openai) {
    if (!request.body) return response_generate_openai.status(400).send({ error: true });

    switch (request.body.chat_completion_source) {
        case CHAT_COMPLETION_SOURCES.CLAUDE: return sendClaudeRequest(request, response_generate_openai);
        case CHAT_COMPLETION_SOURCES.SCALE: return sendScaleRequest(request, response_generate_openai);
        case CHAT_COMPLETION_SOURCES.AI21: return sendAI21Request(request, response_generate_openai);
        case CHAT_COMPLETION_SOURCES.PALM: return sendPalmRequest(request, response_generate_openai);
    }

    let api_url;
    let api_key_openai;
    let headers;
    let bodyParams;

    if (request.body.chat_completion_source !== CHAT_COMPLETION_SOURCES.OPENROUTER) {
        api_url = new URL(request.body.reverse_proxy || API_OPENAI).toString();
        api_key_openai = request.body.reverse_proxy ? request.body.proxy_password : readSecret(SECRET_KEYS.OPENAI);
        headers = {};
        bodyParams = {};

        if (getConfigValue('openai.randomizeUserId', false)) {
            bodyParams['user'] = uuidv4();
        }
    } else {
        api_url = 'https://openrouter.ai/api/v1';
        api_key_openai = readSecret(SECRET_KEYS.OPENROUTER);
        // OpenRouter needs to pass the referer: https://openrouter.ai/docs
        headers = { 'HTTP-Referer': request.headers.referer };
        bodyParams = { 'transforms': ['middle-out'] };

        if (request.body.use_fallback) {
            bodyParams['route'] = 'fallback';
        }
    }

    if (!api_key_openai && !request.body.reverse_proxy) {
        console.log('OpenAI API key is missing.');
        return response_generate_openai.status(400).send({ error: true });
    }

    // Add custom stop sequences
    if (Array.isArray(request.body.stop) && request.body.stop.length > 0) {
        bodyParams['stop'] = request.body.stop;
    }

    const isTextCompletion = Boolean(request.body.model && TEXT_COMPLETION_MODELS.includes(request.body.model)) || typeof request.body.messages === 'string';
    const textPrompt = isTextCompletion ? convertChatMLPrompt(request.body.messages) : '';
    const endpointUrl = isTextCompletion && request.body.chat_completion_source !== CHAT_COMPLETION_SOURCES.OPENROUTER ?
        `${api_url}/completions` :
        `${api_url}/chat/completions`;

    const controller = new AbortController();
    request.socket.removeAllListeners('close');
    request.socket.on('close', function () {
        controller.abort();
    });

    /** @type {import('node-fetch').RequestInit} */
    const config = {
        method: 'post',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + api_key_openai,
            ...headers,
        },
        body: JSON.stringify({
            'messages': isTextCompletion === false ? request.body.messages : undefined,
            'prompt': isTextCompletion === true ? textPrompt : undefined,
            'model': request.body.model,
            'temperature': request.body.temperature,
            'max_tokens': request.body.max_tokens,
            'stream': request.body.stream,
            'presence_penalty': request.body.presence_penalty,
            'frequency_penalty': request.body.frequency_penalty,
            'top_p': request.body.top_p,
            'top_k': request.body.top_k,
            'stop': isTextCompletion === false ? request.body.stop : undefined,
            'logit_bias': request.body.logit_bias,
            'seed': request.body.seed,
            ...bodyParams,
        }),
        signal: controller.signal,
        timeout: 0,
    };

    console.log(JSON.parse(String(config.body)));

    makeRequest(config, response_generate_openai, request);

    /**
     *
     * @param {*} config
     * @param {express.Response} response_generate_openai
     * @param {express.Request} request
     * @param {Number} retries
     * @param {Number} timeout
     */
    async function makeRequest(config, response_generate_openai, request, retries = 5, timeout = 5000) {
        try {
            const fetchResponse = await fetch(endpointUrl, config);

            if (fetchResponse.ok) {
                if (request.body.stream) {
                    console.log('Streaming request in progress');
                    fetchResponse.body.pipe(response_generate_openai);
                    fetchResponse.body.on('end', () => {
                        console.log('Streaming request finished');
                        response_generate_openai.end();
                    });
                } else {
                    let json = await fetchResponse.json();
                    response_generate_openai.send(json);
                    console.log(json);
                    console.log(json?.choices[0]?.message);
                }
            } else if (fetchResponse.status === 429 && retries > 0) {
                console.log(`Out of quota, retrying in ${Math.round(timeout / 1000)}s`);
                setTimeout(() => {
                    timeout *= 2;
                    makeRequest(config, response_generate_openai, request, retries - 1, timeout);
                }, timeout);
            } else {
                await handleErrorResponse(fetchResponse);
            }
        } catch (error) {
            console.log('Generation failed', error);
            if (!response_generate_openai.headersSent) {
                response_generate_openai.send({ error: true });
            } else {
                response_generate_openai.end();
            }
        }
    }

    async function handleErrorResponse(response) {
        const responseText = await response.text();
        const errorData = tryParse(responseText);

        const statusMessages = {
            400: 'Bad request',
            401: 'Unauthorized',
            402: 'Credit limit reached',
            403: 'Forbidden',
            404: 'Not found',
            429: 'Too many requests',
            451: 'Unavailable for legal reasons',
            502: 'Bad gateway',
        };

        const message = errorData?.error?.message || statusMessages[response.status] || 'Unknown error occurred';
        const quota_error = response.status === 429 && errorData?.error?.type === 'insufficient_quota';
        console.log(message);

        if (!response_generate_openai.headersSent) {
            response_generate_openai.send({ error: { message }, quota_error: quota_error });
        } else if (!response_generate_openai.writableEnded) {
            response_generate_openai.write(response);
        } else {
            response_generate_openai.end();
        }
    }
});

async function sendAI21Request(request, response) {
    if (!request.body) return response.sendStatus(400);
    const controller = new AbortController();
    console.log(request.body.messages);
    request.socket.removeAllListeners('close');
    request.socket.on('close', function () {
        controller.abort();
    });
    const options = {
        method: 'POST',
        headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            Authorization: `Bearer ${readSecret(SECRET_KEYS.AI21)}`,
        },
        body: JSON.stringify({
            numResults: 1,
            maxTokens: request.body.max_tokens,
            minTokens: 0,
            temperature: request.body.temperature,
            topP: request.body.top_p,
            stopSequences: request.body.stop_tokens,
            topKReturn: request.body.top_k,
            frequencyPenalty: {
                scale: request.body.frequency_penalty * 100,
                applyToWhitespaces: false,
                applyToPunctuations: false,
                applyToNumbers: false,
                applyToStopwords: false,
                applyToEmojis: false,
            },
            presencePenalty: {
                scale: request.body.presence_penalty,
                applyToWhitespaces: false,
                applyToPunctuations: false,
                applyToNumbers: false,
                applyToStopwords: false,
                applyToEmojis: false,
            },
            countPenalty: {
                scale: request.body.count_pen,
                applyToWhitespaces: false,
                applyToPunctuations: false,
                applyToNumbers: false,
                applyToStopwords: false,
                applyToEmojis: false,
            },
            prompt: request.body.messages,
        }),
        signal: controller.signal,
    };

    fetch(`https://api.ai21.com/studio/v1/${request.body.model}/complete`, options)
        .then(r => r.json())
        .then(r => {
            if (r.completions === undefined) {
                console.log(r);
            } else {
                console.log(r.completions[0].data.text);
            }
            const reply = { choices: [{ 'message': { 'content': r.completions[0].data.text } }] };
            return response.send(reply);
        })
        .catch(err => {
            console.error(err);
            return response.send({ error: true });
        });

}

app.post('/tokenize_via_api', jsonParser, async function (request, response) {
    if (!request.body) {
        return response.sendStatus(400);
    }
    const text = String(request.body.text) || '';
    const api = String(request.body.main_api);
    const baseUrl = String(request.body.url);
    const legacyApi = Boolean(request.body.legacy_api);

    try {
        if (api == 'textgenerationwebui') {
            const args = {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
            };

            setAdditionalHeaders(request, args, null);

            // Convert to string + remove trailing slash + /v1 suffix
            let url = String(baseUrl).replace(/\/$/, '').replace(/\/v1$/, '');

            if (legacyApi) {
                url += '/v1/token-count';
                args.body = JSON.stringify({ 'prompt': text });
            } else {
                switch (request.body.api_type) {
                    case TEXTGEN_TYPES.TABBY:
                        url += '/v1/token/encode';
                        args.body = JSON.stringify({ 'text': text });
                        break;
                    case TEXTGEN_TYPES.KOBOLDCPP:
                        url += '/api/extra/tokencount';
                        args.body = JSON.stringify({ 'prompt': text });
                        break;
                    default:
                        url += '/v1/internal/encode';
                        args.body = JSON.stringify({ 'text': text });
                        break;
                }
            }

            const result = await fetch(url, args);

            if (!result.ok) {
                console.log(`API returned error: ${result.status} ${result.statusText}`);
                return response.send({ error: true });
            }

            const data = await result.json();
            const count = legacyApi ? data?.results[0]?.tokens : (data?.length ?? data?.value);
            const ids = legacyApi ? [] : (data?.tokens ?? []);

            return response.send({ count, ids });
        }

        else if (api == 'kobold') {
            const args = {
                method: 'POST',
                body: JSON.stringify({ 'prompt': text }),
                headers: { 'Content-Type': 'application/json' },
            };

            let url = String(baseUrl).replace(/\/$/, '');
            url += '/extra/tokencount';

            const result = await fetch(url, args);

            if (!result.ok) {
                console.log(`API returned error: ${result.status} ${result.statusText}`);
                return response.send({ error: true });
            }

            const data = await result.json();
            const count = data['value'];
            return response.send({ count: count, ids: [] });
        }

        else {
            console.log('Unknown API', api);
            return response.send({ error: true });
        }
    } catch (error) {
        console.log(error);
        return response.send({ error: true });
    }
});

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
redirect('/setbackground', '/api/backgrounds/set');
redirect('/delbackground', '/api/backgrounds/delete');
redirect('/renamebackground', '/api/backgrounds/rename');
redirect('/downloadbackground', '/api/backgrounds/upload'); // yes, the downloadbackground endpoint actually uploads one

// ** REST CLIENT ASYNC WRAPPERS **

/**
 * Convenience function for fetch requests (default GET) returning as JSON.
 * @param {string} url
 * @param {import('node-fetch').RequestInit} args
 */
async function fetchJSON(url, args = {}) {
    if (args.method === undefined) args.method = 'GET';
    const response = await fetch(url, args);

    if (response.ok) {
        const data = await response.json();
        return data;
    }

    throw response;
}

// ** END **

// OpenAI API
app.use('/api/openai', require('./src/endpoints/openai').router);

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

const tavernUrl = new URL(
    (cliArguments.ssl ? 'https://' : 'http://') +
    (listen ? typeof listen === "string" ? listen : '0.0.0.0' : '127.0.0.1') +
    (':' + server_port),
);

const autorunUrl = new URL(
    (cliArguments.ssl ? 'https://' : 'http://') +
    ('127.0.0.1') +
    (':' + server_port),
);

const setupTasks = async function () {
    const version = await getVersion();

    console.log(`SillyTavern ${version.pkgVersion}` + (version.gitBranch ? ` '${version.gitBranch}' (${version.gitRevision})` : ''));

    backupSettings();
    migrateSecrets(SETTINGS_FILE);
    ensurePublicDirectoriesExist();
    await ensureThumbnailCache();
    contentManager.checkForNewContent();
    cleanUploads();

    await loadTokenizers();
    await statsEndpoint.init();

    const exitProcess = () => {
        statsEndpoint.onExit();
        process.exit();
    };

    // Set up event listeners for a graceful shutdown
    process.on('SIGINT', exitProcess);
    process.on('SIGTERM', exitProcess);
    process.on('uncaughtException', (err) => {
        console.error('Uncaught exception:', err);
        exitProcess();
    });

    console.log('Launching...');

    if (autorun) open(autorunUrl.toString());

    console.log(color.green('SillyTavern is listening on: ' + tavernUrl));

    if (listen) {
        console.log('\n0.0.0.0 means SillyTavern is listening on all network interfaces (Wi-Fi, LAN, localhost). If you want to limit it only to internal localhost (127.0.0.1), change the setting in config.yaml to "listen: false". Check "access.log" file in the SillyTavern directory if you want to inspect incoming connections.\n');
    }
};

if (listen && !getConfigValue('whitelistMode', true) && !getConfigValue('basicAuthMode', false)) {
    if (getConfigValue('securityOverride', false)) {
        console.warn(color.red('Security has been overridden. If it\'s not a trusted network, change the settings.'));
    }
    else {
        console.error(color.red('Your SillyTavern is currently unsecurely open to the public. Enable whitelisting or basic authentication.'));
        process.exit(1);
    }
}

if (cliArguments.ssl) {
    https.createServer(
        {
            cert: fs.readFileSync(cliArguments.certPath),
            key: fs.readFileSync(cliArguments.keyPath),
        }, app)
        .listen(
            Number(tavernUrl.port) || 443,
            tavernUrl.hostname,
            setupTasks,
        );
} else {
    http.createServer(app).listen(
        Number(tavernUrl.port) || 80,
        tavernUrl.hostname,
        setupTasks,
    );
}

function backupSettings() {
    try {
        if (!fs.existsSync(DIRECTORIES.backups)) {
            fs.mkdirSync(DIRECTORIES.backups);
        }

        const backupFile = path.join(DIRECTORIES.backups, `settings_${generateTimestamp()}.json`);
        fs.copyFileSync(SETTINGS_FILE, backupFile);

        removeOldBackups('settings_');
    } catch (err) {
        console.log('Could not backup settings file', err);
    }
}

function ensurePublicDirectoriesExist() {
    for (const dir of Object.values(DIRECTORIES)) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}
