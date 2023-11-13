#!/usr/bin/env node

// native node modules
const crypto = require('crypto');
const fs = require('fs');
const http = require("http");
const https = require('https');
const path = require('path');
const readline = require('readline');
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
const multer = require("multer");
const responseTime = require('response-time');

// net related library imports
const net = require("net");
const dns = require('dns');
const DeviceDetector = require("device-detector-js");
const fetch = require('node-fetch').default;
const ipaddr = require('ipaddr.js');
const ipMatching = require('ip-matching');
const json5 = require('json5');

// image processing related library imports
const encode = require('png-chunks-encode');
const extract = require('png-chunks-extract');
const jimp = require('jimp');
const mime = require('mime-types');
const PNGtext = require('png-chunk-text');

// misc/other imports
const _ = require('lodash');

// Unrestrict console logs display limit
util.inspect.defaultOptions.maxArrayLength = null;
util.inspect.defaultOptions.maxStringLength = null;

// local library imports
const basicAuthMiddleware = require('./src/middleware/basicAuthMiddleware');
const characterCardParser = require('./src/character-card-parser.js');
const contentManager = require('./src/content-manager');
const statsHelpers = require('./statsHelpers.js');
const { readSecret, migrateSecrets, SECRET_KEYS } = require('./src/secrets');
const { delay, getVersion, deepMerge } = require('./src/util');
const { invalidateThumbnail, ensureThumbnailCache } = require('./src/thumbnails');
const { getTokenizerModel, getTiktokenTokenizer, loadTokenizers, TEXT_COMPLETION_MODELS, getSentencepiceTokenizer, sentencepieceTokenizers } = require('./src/tokenizers');
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
    .option('disableCsrf', {
        type: 'boolean',
        default: false,
        describe: 'Disables CSRF protection'
    }).option('ssl', {
        type: 'boolean',
        default: false,
        describe: 'Enables SSL'
    }).option('certPath', {
        type: 'string',
        default: 'certs/cert.pem',
        describe: 'Path to your certificate file.'
    }).option('keyPath', {
        type: 'string',
        default: 'certs/privkey.pem',
        describe: 'Path to your private key file.'
    }).parseSync();

// change all relative paths
const directory = process['pkg'] ? path.dirname(process.execPath) : __dirname;
console.log(process['pkg'] ? 'Running from binary' : 'Running from source');
process.chdir(directory);

const app = express();
app.use(compression());
app.use(responseTime());

// impoort from statsHelpers.js

const config = require(path.join(process.cwd(), './config.conf'));

const server_port = process.env.SILLY_TAVERN_PORT || config.port;

const whitelistPath = path.join(process.cwd(), "./whitelist.txt");
let whitelist = config.whitelist;

if (fs.existsSync(whitelistPath)) {
    try {
        let whitelistTxt = fs.readFileSync(whitelistPath, 'utf-8');
        whitelist = whitelistTxt.split("\n").filter(ip => ip).map(ip => ip.trim());
    } catch (e) { }
}

const whitelistMode = config.whitelistMode;
const autorun = config.autorun && !cliArguments.ssl;
const enableExtensions = config.enableExtensions;
const listen = config.listen;

const API_OPENAI = "https://api.openai.com/v1";
const API_CLAUDE = "https://api.anthropic.com/v1";

// These should be gone and come from the frontend. But for now, they're here.
let api_server = "http://0.0.0.0:5000";
let main_api = "kobold";

let characters = {};
let response_dw_bg;

let color = {
    byNum: (mess, fgNum) => {
        mess = mess || '';
        fgNum = fgNum === undefined ? 31 : fgNum;
        return '\u001b[' + fgNum + 'm' + mess + '\u001b[39m';
    },
    black: (mess) => color.byNum(mess, 30),
    red: (mess) => color.byNum(mess, 31),
    green: (mess) => color.byNum(mess, 32),
    yellow: (mess) => color.byNum(mess, 33),
    blue: (mess) => color.byNum(mess, 34),
    magenta: (mess) => color.byNum(mess, 35),
    cyan: (mess) => color.byNum(mess, 36),
    white: (mess) => color.byNum(mess, 37)
};

function getMancerHeaders() {
    const apiKey = readSecret(SECRET_KEYS.MANCER);

    return apiKey ? ({
        "X-API-KEY": apiKey,
        "Authorization": `Bearer ${apiKey}`,
    }) : {};
}

function getAphroditeHeaders() {
    const apiKey = readSecret(SECRET_KEYS.APHRODITE);

    return apiKey ? ({
        "X-API-KEY": apiKey,
        "Authorization": `Bearer ${apiKey}`,
    }) : {};
}

function getOverrideHeaders(urlHost) {
    const overrideHeaders = config.requestOverrides?.find((e) => e.hosts?.includes(urlHost))?.headers;
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
    let headers = {};

    if (request.body.use_mancer) {
        headers = getMancerHeaders();
    } else if (request.body.use_aphrodite) {
        headers = getAphroditeHeaders();
    } else {
        headers = server ? getOverrideHeaders((new URL(server))?.host) : {};
    }

    args.headers = Object.assign(args.headers, headers);
}

function humanizedISO8601DateTime(date) {
    let baseDate = typeof date === 'number' ? new Date(date) : new Date();
    let humanYear = baseDate.getFullYear();
    let humanMonth = (baseDate.getMonth() + 1);
    let humanDate = baseDate.getDate();
    let humanHour = (baseDate.getHours() < 10 ? '0' : '') + baseDate.getHours();
    let humanMinute = (baseDate.getMinutes() < 10 ? '0' : '') + baseDate.getMinutes();
    let humanSecond = (baseDate.getSeconds() < 10 ? '0' : '') + baseDate.getSeconds();
    let humanMillisecond = (baseDate.getMilliseconds() < 10 ? '0' : '') + baseDate.getMilliseconds();
    let HumanizedDateTime = (humanYear + "-" + humanMonth + "-" + humanDate + " @" + humanHour + "h " + humanMinute + "m " + humanSecond + "s " + humanMillisecond + "ms");
    return HumanizedDateTime;
};

var charactersPath = 'public/characters/';
var chatsPath = 'public/chats/';
const SETTINGS_FILE = './public/settings.json';
const AVATAR_WIDTH = 400;
const AVATAR_HEIGHT = 600;
const jsonParser = express.json({ limit: '100mb' });
const urlencodedParser = express.urlencoded({ extended: true, limit: '100mb' });
const { DIRECTORIES, UPLOADS_PATH, PALM_SAFETY } = require('./src/constants');
const { TavernCardValidator } = require("./src/validator/TavernCardValidator");

// CSRF Protection //
if (cliArguments.disableCsrf === false) {
    const CSRF_SECRET = crypto.randomBytes(8).toString('hex');
    const COOKIES_SECRET = crypto.randomBytes(8).toString('hex');

    const { generateToken, doubleCsrfProtection } = doubleCsrf({
        getSecret: () => CSRF_SECRET,
        cookieName: "X-CSRF-Token",
        cookieOptions: {
            httpOnly: true,
            sameSite: "strict",
            secure: false
        },
        size: 64,
        getTokenFromRequest: (req) => req.headers["x-csrf-token"]
    });

    app.get("/csrf-token", (req, res) => {
        res.json({
            "token": generateToken(res, req)
        });
    });

    app.use(cookieParser(COOKIES_SECRET));
    app.use(doubleCsrfProtection);
} else {
    console.warn("\nCSRF protection is disabled. This will make your server vulnerable to CSRF attacks.\n");
    app.get("/csrf-token", (req, res) => {
        res.json({
            "token": 'disabled'
        });
    });
}

// CORS Settings //
const CORS = cors({
    origin: 'null',
    methods: ['OPTIONS']
});

app.use(CORS);

if (listen && config.basicAuthMode) app.use(basicAuthMiddleware);

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
        console.log(color.red('Forbidden: Connection attempt from ' + clientIp + '. If you are attempting to connect, please add your IP address in whitelist or disable whitelist mode in config.conf in root of SillyTavern folder.\n'));
        return res.status(403).send('<b>Forbidden</b>: Connection attempt from <b>' + clientIp + '</b>. If you are attempting to connect, please add your IP address in whitelist or disable whitelist mode in config.conf in root of SillyTavern folder.');
    }
    next();
});


app.use(express.static(process.cwd() + "/public", {}));

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
    const filePath = decodeURIComponent(path.join(process.cwd(), charactersPath, req.url.replace(/%20/g, ' ')));
    fs.readFile(filePath, (err, data) => {
        if (err) {
            res.status(404).send('File not found');
            return;
        }
        res.send(data);
    });
});
app.use(multer({ dest: UPLOADS_PATH, limits: { fieldSize: 10 * 1024 * 1024 } }).single("avatar"));
app.get("/", function (request, response) {
    response.sendFile(process.cwd() + "/public/index.html");
});
app.get("/notes/*", function (request, response) {
    response.sendFile(process.cwd() + "/public" + request.url + ".html");
});
app.get('/deviceinfo', function (request, response) {
    const userAgent = request.header('user-agent');
    const deviceDetector = new DeviceDetector();
    const deviceInfo = deviceDetector.parse(userAgent || "");
    return response.send(deviceInfo);
});
app.get('/version', async function (_, response) {
    const data = await getVersion();
    response.send(data);
})

//**************Kobold api
app.post("/generate", jsonParser, async function (request, response_generate) {
    if (!request.body) return response_generate.sendStatus(400);

    const request_prompt = request.body.prompt;
    const controller = new AbortController();
    request.socket.removeAllListeners('close');
    request.socket.on('close', async function () {
        if (request.body.can_abort && !response_generate.writableEnded) {
            try {
                console.log('Aborting Kobold generation...');
                // send abort signal to koboldcpp
                const abortResponse = await fetch(`${api_server}/extra/abort`, {
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
        if (!!request.body.stop_sequence) {
            this_settings['stop_sequence'] = request.body.stop_sequence;
        }
    }

    console.log(this_settings);
    const args = {
        body: JSON.stringify(this_settings),
        headers: Object.assign(
            { "Content-Type": "application/json" },
            getOverrideHeaders((new URL(api_server))?.host)
        ),
        signal: controller.signal,
    };

    const MAX_RETRIES = 50;
    const delayAmount = 2500;
    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            const url = request.body.streaming ? `${api_server}/extra/generate/stream` : `${api_server}/v1/generate`;
            const response = await fetch(url, { method: 'POST', timeout: 0, ...args });

            if (request.body.streaming) {
                request.socket.on('close', function () {
                    if (response.body instanceof Readable) response.body.destroy(); // Close the remote stream
                    response_generate.end(); // End the Express response
                });

                response.body.on('end', function () {
                    console.log("Streaming request finished");
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
                console.log("Endpoint response:", data);
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
app.post("/api/textgenerationwebui/status", jsonParser, async function (request, response) {
    if (!request.body) return response.sendStatus(400);

    try {
        if (request.body.api_server.indexOf('localhost') !== -1) {
            request.body.api_server = request.body.api_server.replace('localhost', '127.0.0.1');
        }

        console.log('Trying to connect to API:', request.body);

        // Convert to string + remove trailing slash + /v1 suffix
        const baseUrl = String(request.body.api_server).replace(/\/$/, '').replace(/\/v1$/, '');

        const args = {
            headers: { "Content-Type": "application/json" },
        };

        setAdditionalHeaders(request, args, baseUrl);

        let url = baseUrl;
        let result = '';

        if (request.body.legacy_api) {
            url += "/v1/model";
        }
        else if (request.body.use_ooba) {
            url += "/v1/models";
        }
        else if (request.body.use_aphrodite) {
            url += "/v1/models";
        }
        else if (request.body.use_mancer) {
            url += "/oai/v1/models";
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
            console.log('Models response is not an array.')
            return response.status(400);
        }

        const modelIds = data.data.map(x => x.id);
        console.log('Models available:', modelIds);

        // Set result to the first model ID
        result = modelIds[0] || 'Valid';

        if (request.body.use_ooba) {
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
                console.error('Failed to get Ooba model info:', error);
            }
        }

        return response.send({ result, data: data.data });
    } catch (error) {
        console.error(error);
        return response.status(500);
    }
});

app.post("/api/textgenerationwebui/generate", jsonParser, async function (request, response_generate) {
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
            url += "/v1/generate";
        }
        else if (request.body.use_aphrodite || request.body.use_ooba) {
            url += "/v1/completions";
        }
        else if (request.body.use_mancer) {
            url += "/oai/v1/completions";
        }

        const args = {
            method: 'POST',
            body: JSON.stringify(request.body),
            headers: { "Content-Type": "application/json" },
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
                console.log("Streaming request finished");
                response_generate.end();
            });
        }
        else {
            const completionsReply = await fetch(url, args);

            if (completionsReply.ok) {
                const data = await completionsReply.json();
                console.log("Endpoint response:", data);

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
        console.log("Endpoint error:", error);

        if (!response_generate.headersSent) {
            return response_generate.send(value);
        }

        return response_generate.end();
    }
});

app.post("/savechat", jsonParser, function (request, response) {
    try {
        var dir_name = String(request.body.avatar_url).replace('.png', '');
        let chat_data = request.body.chat;
        let jsonlData = chat_data.map(JSON.stringify).join('\n');
        writeFileAtomicSync(`${chatsPath + sanitize(dir_name)}/${sanitize(String(request.body.file_name))}.jsonl`, jsonlData, 'utf8');
        backupChat(dir_name, jsonlData)
        return response.send({ result: "ok" });
    } catch (error) {
        response.send(error);
        return console.log(error);
    }
});

app.post("/getchat", jsonParser, function (request, response) {
    try {
        const dirName = String(request.body.avatar_url).replace('.png', '');
        const chatDirExists = fs.existsSync(chatsPath + dirName);

        //if no chat dir for the character is found, make one with the character name
        if (!chatDirExists) {
            fs.mkdirSync(chatsPath + dirName);
            return response.send({});
        }


        if (!request.body.file_name) {
            return response.send({});
        }

        const fileName = `${chatsPath + dirName}/${sanitize(String(request.body.file_name))}.jsonl`;
        const chatFileExists = fs.existsSync(fileName);

        if (!chatFileExists) {
            return response.send({});
        }

        const data = fs.readFileSync(fileName, 'utf8');
        const lines = data.split('\n');

        // Iterate through the array of strings and parse each line as JSON
        const jsonData = lines.map((l) => { try { return JSON.parse(l); } catch (_) { } }).filter(x => x);
        return response.send(jsonData);
    } catch (error) {
        console.error(error);
        return response.send({});
    }
});

// Only called for kobold
app.post("/getstatus", jsonParser, async function (request, response) {
    if (!request.body) return response.sendStatus(400);
    api_server = request.body.api_server;
    main_api = request.body.main_api;
    if (api_server.indexOf('localhost') != -1) {
        api_server = api_server.replace('localhost', '127.0.0.1');
    }

    const args = {
        headers: { "Content-Type": "application/json" }
    };

    setAdditionalHeaders(request, args, api_server);

    const url = api_server + "/v1/model";
    let version = '';
    let koboldVersion = {};

    if (main_api == "kobold") {
        try {
            version = (await fetchJSON(api_server + "/v1/info/version")).result
        }
        catch {
            version = '0.0.0';
        }
        try {
            koboldVersion = (await fetchJSON(api_server + "/extra/version"));
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

        if (data.result == "ReadOnly") {
            data.result = "no_connection";
        }

        data.version = version;
        data.koboldVersion = koboldVersion;

        return response.send(data);
    } catch (error) {
        console.log(error);
        return response.send({ result: "no_connection" });
    }
});


function tryParse(str) {
    try {
        return json5.parse(str);
    } catch {
        return undefined;
    }
}

function convertToV2(char) {
    // Simulate incoming data from frontend form
    const result = charaFormatData({
        json_data: JSON.stringify(char),
        ch_name: char.name,
        description: char.description,
        personality: char.personality,
        scenario: char.scenario,
        first_mes: char.first_mes,
        mes_example: char.mes_example,
        creator_notes: char.creatorcomment,
        talkativeness: char.talkativeness,
        fav: char.fav,
        creator: char.creator,
        tags: char.tags,
        depth_prompt_prompt: char.depth_prompt_prompt,
        depth_prompt_response: char.depth_prompt_response,
    });

    result.chat = char.chat ?? humanizedISO8601DateTime();
    result.create_date = char.create_date ?? humanizedISO8601DateTime();
    return result;
}


function unsetFavFlag(char) {
    _.set(char, 'fav', false);
    _.set(char, 'data.extensions.fav', false);
}

function readFromV2(char) {
    if (_.isUndefined(char.data)) {
        console.warn(`Char ${char['name']} has Spec v2 data missing`);
        return char;
    }

    const fieldMappings = {
        name: 'name',
        description: 'description',
        personality: 'personality',
        scenario: 'scenario',
        first_mes: 'first_mes',
        mes_example: 'mes_example',
        talkativeness: 'extensions.talkativeness',
        fav: 'extensions.fav',
        tags: 'tags',
    };

    _.forEach(fieldMappings, (v2Path, charField) => {
        //console.log(`Migrating field: ${charField} from ${v2Path}`);
        const v2Value = _.get(char.data, v2Path);
        if (_.isUndefined(v2Value)) {
            let defaultValue = undefined;

            // Backfill default values for missing ST extension fields
            if (v2Path === 'extensions.talkativeness') {
                defaultValue = 0.5;
            }

            if (v2Path === 'extensions.fav') {
                defaultValue = false;
            }

            if (!_.isUndefined(defaultValue)) {
                //console.debug(`Spec v2 extension data missing for field: ${charField}, using default value: ${defaultValue}`);
                char[charField] = defaultValue;
            } else {
                console.debug(`Char ${char['name']} has Spec v2 data missing for unknown field: ${charField}`);
                return;
            }
        }
        if (!_.isUndefined(char[charField]) && !_.isUndefined(v2Value) && String(char[charField]) !== String(v2Value)) {
            console.debug(`Char ${char['name']} has Spec v2 data mismatch with Spec v1 for field: ${charField}`, char[charField], v2Value);
        }
        char[charField] = v2Value;
    });

    char['chat'] = char['chat'] ?? humanizedISO8601DateTime();

    return char;
}

//***************** Main functions
function charaFormatData(data) {
    // This is supposed to save all the foreign keys that ST doesn't care about
    const char = tryParse(data.json_data) || {};

    // Checks if data.alternate_greetings is an array, a string, or neither, and acts accordingly. (expected to be an array of strings)
    const getAlternateGreetings = data => {
        if (Array.isArray(data.alternate_greetings)) return data.alternate_greetings
        if (typeof data.alternate_greetings === 'string') return [data.alternate_greetings]
        return []
    }

    // Spec V1 fields
    _.set(char, 'name', data.ch_name);
    _.set(char, 'description', data.description || '');
    _.set(char, 'personality', data.personality || '');
    _.set(char, 'scenario', data.scenario || '');
    _.set(char, 'first_mes', data.first_mes || '');
    _.set(char, 'mes_example', data.mes_example || '');

    // Old ST extension fields (for backward compatibility, will be deprecated)
    _.set(char, 'creatorcomment', data.creator_notes);
    _.set(char, 'avatar', 'none');
    _.set(char, 'chat', data.ch_name + ' - ' + humanizedISO8601DateTime());
    _.set(char, 'talkativeness', data.talkativeness);
    _.set(char, 'fav', data.fav == 'true');

    // Spec V2 fields
    _.set(char, 'spec', 'chara_card_v2');
    _.set(char, 'spec_version', '2.0');
    _.set(char, 'data.name', data.ch_name);
    _.set(char, 'data.description', data.description || '');
    _.set(char, 'data.personality', data.personality || '');
    _.set(char, 'data.scenario', data.scenario || '');
    _.set(char, 'data.first_mes', data.first_mes || '');
    _.set(char, 'data.mes_example', data.mes_example || '');

    // New V2 fields
    _.set(char, 'data.creator_notes', data.creator_notes || '');
    _.set(char, 'data.system_prompt', data.system_prompt || '');
    _.set(char, 'data.post_history_instructions', data.post_history_instructions || '');
    _.set(char, 'data.tags', typeof data.tags == 'string' ? (data.tags.split(',').map(x => x.trim()).filter(x => x)) : data.tags || []);
    _.set(char, 'data.creator', data.creator || '');
    _.set(char, 'data.character_version', data.character_version || '');
    _.set(char, 'data.alternate_greetings', getAlternateGreetings(data));

    // ST extension fields to V2 object
    _.set(char, 'data.extensions.talkativeness', data.talkativeness);
    _.set(char, 'data.extensions.fav', data.fav == 'true');
    _.set(char, 'data.extensions.world', data.world || '');

    // Spec extension: depth prompt
    const depth_default = 4;
    const depth_value = !isNaN(Number(data.depth_prompt_depth)) ? Number(data.depth_prompt_depth) : depth_default;
    _.set(char, 'data.extensions.depth_prompt.prompt', data.depth_prompt_prompt ?? '');
    _.set(char, 'data.extensions.depth_prompt.depth', depth_value);
    //_.set(char, 'data.extensions.create_date', humanizedISO8601DateTime());
    //_.set(char, 'data.extensions.avatar', 'none');
    //_.set(char, 'data.extensions.chat', data.ch_name + ' - ' + humanizedISO8601DateTime());

    if (data.world) {
        try {
            const file = readWorldInfoFile(data.world);

            // File was imported - save it to the character book
            if (file && file.originalData) {
                _.set(char, 'data.character_book', file.originalData);
            }

            // File was not imported - convert the world info to the character book
            if (file && file.entries) {
                _.set(char, 'data.character_book', convertWorldInfoToCharacterBook(data.world, file.entries));
            }

        } catch {
            console.debug(`Failed to read world info file: ${data.world}. Character book will not be available.`);
        }
    }

    return char;
}

app.post("/createcharacter", urlencodedParser, async function (request, response) {
    if (!request.body) return response.sendStatus(400);

    request.body.ch_name = sanitize(request.body.ch_name);

    const char = JSON.stringify(charaFormatData(request.body));
    const internalName = getPngName(request.body.ch_name);
    const avatarName = `${internalName}.png`;
    const defaultAvatar = './public/img/ai4.png';
    const chatsPath = DIRECTORIES.chats + internalName; //path.join(chatsPath, internalName);

    if (!fs.existsSync(chatsPath)) fs.mkdirSync(chatsPath);

    if (!request.file) {
        charaWrite(defaultAvatar, char, internalName, response, avatarName);
    } else {
        const crop = tryParse(request.query.crop);
        const uploadPath = path.join(UPLOADS_PATH, request.file.filename);
        await charaWrite(uploadPath, char, internalName, response, avatarName, crop);
        fs.unlinkSync(uploadPath);
    }
});

app.post('/renamechat', jsonParser, async function (request, response) {
    if (!request.body || !request.body.original_file || !request.body.renamed_file) {
        return response.sendStatus(400);
    }

    const pathToFolder = request.body.is_group
        ? DIRECTORIES.groupChats
        : path.join(DIRECTORIES.chats, String(request.body.avatar_url).replace('.png', ''));
    const pathToOriginalFile = path.join(pathToFolder, request.body.original_file);
    const pathToRenamedFile = path.join(pathToFolder, request.body.renamed_file);
    console.log('Old chat name', pathToOriginalFile);
    console.log('New chat name', pathToRenamedFile);

    if (!fs.existsSync(pathToOriginalFile) || fs.existsSync(pathToRenamedFile)) {
        console.log('Either Source or Destination files are not available');
        return response.status(400).send({ error: true });
    }

    console.log('Successfully renamed.');
    fs.renameSync(pathToOriginalFile, pathToRenamedFile);
    return response.send({ ok: true });
});

app.post("/renamecharacter", jsonParser, async function (request, response) {
    if (!request.body.avatar_url || !request.body.new_name) {
        return response.sendStatus(400);
    }

    const oldAvatarName = request.body.avatar_url;
    const newName = sanitize(request.body.new_name);
    const oldInternalName = path.parse(request.body.avatar_url).name;
    const newInternalName = getPngName(newName);
    const newAvatarName = `${newInternalName}.png`;

    const oldAvatarPath = path.join(charactersPath, oldAvatarName);

    const oldChatsPath = path.join(chatsPath, oldInternalName);
    const newChatsPath = path.join(chatsPath, newInternalName);

    try {
        // Read old file, replace name int it
        const rawOldData = await charaRead(oldAvatarPath);
        if (rawOldData === undefined) throw new Error("Failed to read character file");

        const oldData = getCharaCardV2(json5.parse(rawOldData));
        _.set(oldData, 'data.name', newName);
        _.set(oldData, 'name', newName);
        const newData = JSON.stringify(oldData);

        // Write data to new location
        await charaWrite(oldAvatarPath, newData, newInternalName);

        // Rename chats folder
        if (fs.existsSync(oldChatsPath) && !fs.existsSync(newChatsPath)) {
            fs.renameSync(oldChatsPath, newChatsPath);
        }

        // Remove the old character file
        fs.rmSync(oldAvatarPath);

        // Return new avatar name to ST
        return response.send({ 'avatar': newAvatarName });
    }
    catch (err) {
        console.error(err);
        return response.sendStatus(500);
    }
});

app.post("/editcharacter", urlencodedParser, async function (request, response) {
    if (!request.body) {
        console.error('Error: no response body detected');
        response.status(400).send('Error: no response body detected');
        return;
    }

    if (request.body.ch_name === '' || request.body.ch_name === undefined || request.body.ch_name === '.') {
        console.error('Error: invalid name.');
        response.status(400).send('Error: invalid name.');
        return;
    }

    let char = charaFormatData(request.body);
    char.chat = request.body.chat;
    char.create_date = request.body.create_date;
    char = JSON.stringify(char);
    let target_img = (request.body.avatar_url).replace('.png', '');

    try {
        if (!request.file) {
            const avatarPath = path.join(charactersPath, request.body.avatar_url);
            await charaWrite(avatarPath, char, target_img, response, 'Character saved');
        } else {
            const crop = tryParse(request.query.crop);
            const newAvatarPath = path.join(UPLOADS_PATH, request.file.filename);
            invalidateThumbnail('avatar', request.body.avatar_url);
            await charaWrite(newAvatarPath, char, target_img, response, 'Character saved', crop);
            fs.unlinkSync(newAvatarPath);
        }
    }
    catch {
        console.error('An error occured, character edit invalidated.');
    }
});


/**
 * Handle a POST request to edit a character attribute.
 *
 * This function reads the character data from a file, updates the specified attribute,
 * and writes the updated data back to the file.
 *
 * @param {Object} request - The HTTP request object.
 * @param {Object} response - The HTTP response object.
 * @returns {void}
 */
app.post("/editcharacterattribute", jsonParser, async function (request, response) {
    console.log(request.body);
    if (!request.body) {
        console.error('Error: no response body detected');
        response.status(400).send('Error: no response body detected');
        return;
    }

    if (request.body.ch_name === '' || request.body.ch_name === undefined || request.body.ch_name === '.') {
        console.error('Error: invalid name.');
        response.status(400).send('Error: invalid name.');
        return;
    }

    try {
        const avatarPath = path.join(charactersPath, request.body.avatar_url);
        let charJSON = await charaRead(avatarPath);
        if (typeof charJSON !== 'string') throw new Error("Failed to read character file");

        let char = JSON.parse(charJSON)
        //check if the field exists
        if (char[request.body.field] === undefined && char.data[request.body.field] === undefined) {
            console.error('Error: invalid field.');
            response.status(400).send('Error: invalid field.');
            return;
        }
        char[request.body.field] = request.body.value;
        char.data[request.body.field] = request.body.value;
        let newCharJSON = JSON.stringify(char);
        await charaWrite(avatarPath, newCharJSON, (request.body.avatar_url).replace('.png', ''), response, 'Character saved');
    } catch (err) {
        console.error('An error occured, character edit invalidated.', err);
    }
});

/**
 * Handle a POST request to edit character properties.
 *
 * Merges the request body with the selected character and
 * validates the result against TavernCard V2 specification.
 *
 * @param {Object} request - The HTTP request object.
 * @param {Object} response - The HTTP response object.
 *
 * @returns {void}
 * */
app.post("/v2/editcharacterattribute", jsonParser, async function (request, response) {
    const update = request.body;
    const avatarPath = path.join(charactersPath, update.avatar);

    try {
        let character = JSON.parse(await charaRead(avatarPath));
        character = deepMerge(character, update);

        const validator = new TavernCardValidator(character);

        //Accept either V1 or V2.
        if (validator.validate()) {
            await charaWrite(
                avatarPath,
                JSON.stringify(character),
                (update.avatar).replace('.png', ''),
                response,
                'Character saved'
            );
        } else {
            console.log(validator.lastValidationError)
            response.status(400).send({ message: `Validation failed for ${character.name}`, error: validator.lastValidationError });
        }
    } catch (exception) {
        response.status(500).send({ message: 'Unexpected error while saving character.', error: exception.toString() });
    }
});

app.post("/deletecharacter", jsonParser, async function (request, response) {
    if (!request.body || !request.body.avatar_url) {
        return response.sendStatus(400);
    }

    if (request.body.avatar_url !== sanitize(request.body.avatar_url)) {
        console.error('Malicious filename prevented');
        return response.sendStatus(403);
    }

    const avatarPath = charactersPath + request.body.avatar_url;
    if (!fs.existsSync(avatarPath)) {
        return response.sendStatus(400);
    }

    fs.rmSync(avatarPath);
    invalidateThumbnail('avatar', request.body.avatar_url);
    let dir_name = (request.body.avatar_url.replace('.png', ''));

    if (!dir_name.length) {
        console.error('Malicious dirname prevented');
        return response.sendStatus(403);
    }

    if (request.body.delete_chats == true) {
        try {
            await fs.promises.rm(path.join(chatsPath, sanitize(dir_name)), { recursive: true, force: true })
        } catch (err) {
            console.error(err);
            return response.sendStatus(500);
        }
    }

    return response.sendStatus(200);
});

/**
 * @param {express.Response | undefined} response
 * @param {{file_name: string} | string} mes
 */
async function charaWrite(img_url, data, target_img, response = undefined, mes = 'ok', crop = undefined) {
    try {
        // Read the image, resize, and save it as a PNG into the buffer
        const image = await tryReadImage(img_url, crop);

        // Get the chunks
        const chunks = extract(image);
        const tEXtChunks = chunks.filter(chunk => chunk.name === 'tEXt');

        // Remove all existing tEXt chunks
        for (let tEXtChunk of tEXtChunks) {
            chunks.splice(chunks.indexOf(tEXtChunk), 1);
        }
        // Add new chunks before the IEND chunk
        const base64EncodedData = Buffer.from(data, 'utf8').toString('base64');
        chunks.splice(-1, 0, PNGtext.encode('chara', base64EncodedData));
        //chunks.splice(-1, 0, text.encode('lorem', 'ipsum'));

        writeFileAtomicSync(charactersPath + target_img + '.png', Buffer.from(encode(chunks)));
        if (response !== undefined) response.send(mes);
        return true;
    } catch (err) {
        console.log(err);
        if (response !== undefined) response.status(500).send(err);
        return false;
    }
}

async function tryReadImage(img_url, crop) {
    try {
        let rawImg = await jimp.read(img_url);
        let final_width = rawImg.bitmap.width, final_height = rawImg.bitmap.height

        // Apply crop if defined
        if (typeof crop == 'object' && [crop.x, crop.y, crop.width, crop.height].every(x => typeof x === 'number')) {
            rawImg = rawImg.crop(crop.x, crop.y, crop.width, crop.height);
            // Apply standard resize if requested
            if (crop.want_resize) {
                final_width = AVATAR_WIDTH
                final_height = AVATAR_HEIGHT
            } else {
                final_width = crop.width;
                final_height = crop.height;
            }
        }

        const image = await rawImg.cover(final_width, final_height).getBufferAsync(jimp.MIME_PNG);
        return image;
    }
    // If it's an unsupported type of image (APNG) - just read the file as buffer
    catch {
        return fs.readFileSync(img_url);
    }
}

async function charaRead(img_url, input_format) {
    return characterCardParser.parse(img_url, input_format);
}

/**
 * calculateChatSize - Calculates the total chat size for a given character.
 *
 * @param  {string} charDir The directory where the chats are stored.
 * @return { {chatSize: number, dateLastChat: number} }         The total chat size.
 */
const calculateChatSize = (charDir) => {
    let chatSize = 0;
    let dateLastChat = 0;

    if (fs.existsSync(charDir)) {
        const chats = fs.readdirSync(charDir);
        if (Array.isArray(chats) && chats.length) {
            for (const chat of chats) {
                const chatStat = fs.statSync(path.join(charDir, chat));
                chatSize += chatStat.size;
                dateLastChat = Math.max(dateLastChat, chatStat.mtimeMs);
            }
        }
    }

    return { chatSize, dateLastChat };
}

// Calculate the total string length of the data object
const calculateDataSize = (data) => {
    return typeof data === 'object' ? Object.values(data).reduce((acc, val) => acc + new String(val).length, 0) : 0;
}

/**
 * processCharacter - Process a given character, read its data and calculate its statistics.
 *
 * @param  {string} item The name of the character.
 * @param  {number} i    The index of the character in the characters list.
 * @return {Promise}     A Promise that resolves when the character processing is done.
 */
const processCharacter = async (item, i) => {
    try {
        const img_data = await charaRead(charactersPath + item);
        if (img_data === undefined) throw new Error("Failed to read character file");

        let jsonObject = getCharaCardV2(json5.parse(img_data));
        jsonObject.avatar = item;
        characters[i] = jsonObject;
        characters[i]['json_data'] = img_data;
        const charStat = fs.statSync(path.join(charactersPath, item));
        characters[i]['date_added'] = charStat.birthtimeMs;
        characters[i]['create_date'] = jsonObject['create_date'] || humanizedISO8601DateTime(charStat.birthtimeMs);
        const char_dir = path.join(chatsPath, item.replace('.png', ''));

        const { chatSize, dateLastChat } = calculateChatSize(char_dir);
        characters[i]['chat_size'] = chatSize;
        characters[i]['date_last_chat'] = dateLastChat;
        characters[i]['data_size'] = calculateDataSize(jsonObject?.data);
    }
    catch (err) {
        characters[i] = {
            date_added: 0,
            date_last_chat: 0,
            chat_size: 0
        };

        console.log(`Could not process character: ${item}`);

        if (err instanceof SyntaxError) {
            console.log("String [" + i + "] is not valid JSON!");
        } else {
            console.log("An unexpected error occurred: ", err);
        }
    }
}


/**
 * HTTP POST endpoint for the "/getcharacters" route.
 *
 * This endpoint is responsible for reading character files from the `charactersPath` directory,
 * parsing character data, calculating stats for each character and responding with the data.
 * Stats are calculated only on the first run, on subsequent runs the stats are fetched from
 * the `charStats` variable.
 * The stats are calculated by the `calculateStats` function.
 * The characters are processed by the `processCharacter` function.
 *
 * @param  {object}   request  The HTTP request object.
 * @param  {object}   response The HTTP response object.
 * @return {undefined}         Does not return a value.
 */
app.post("/getcharacters", jsonParser, function (request, response) {
    fs.readdir(charactersPath, async (err, files) => {
        if (err) {
            console.error(err);
            return;
        }

        const pngFiles = files.filter(file => file.endsWith('.png'));
        characters = {};

        let processingPromises = pngFiles.map((file, index) => processCharacter(file, index));
        await Promise.all(processingPromises); performance.mark('B');

        // Filter out invalid/broken characters
        characters = Object.values(characters).filter(x => x?.name).reduce((acc, val, index) => {
            acc[index] = val;
            return acc;
        }, {});

        response.send(JSON.stringify(characters));
    });
});

app.post("/getonecharacter", jsonParser, async function (request, response) {
    if (!request.body) return response.sendStatus(400);
    const item = request.body.avatar_url;
    const filePath = path.join(charactersPath, item);

    if (!fs.existsSync(filePath)) {
        return response.sendStatus(404);
    }

    characters = {};
    await processCharacter(item, 0);

    return response.send(characters[0]);
});

/**
 * Handle a POST request to get the stats object
 *
 * This function returns the stats object that was calculated by the `calculateStats` function.
 *
 *
 * @param {Object} request - The HTTP request object.
 * @param {Object} response - The HTTP response object.
 * @returns {void}
 */
app.post("/getstats", jsonParser, function (request, response) {
    response.send(JSON.stringify(statsHelpers.getCharStats()));
});

/**
 * Endpoint: POST /recreatestats
 *
 * Triggers the recreation of statistics from chat files.
 * - If successful: returns a 200 OK status.
 * - On failure: returns a 500 Internal Server Error status.
 *
 * @param {Object} request - Express request object.
 * @param {Object} response - Express response object.
 */
app.post("/recreatestats", jsonParser, function (request, response) {
    if (statsHelpers.loadStatsFile(DIRECTORIES.chats, DIRECTORIES.characters, true)) {
        return response.sendStatus(200);
    } else {
        return response.sendStatus(500);
    }
});



/**
 * Handle a POST request to update the stats object
 *
 * This function updates the stats object with the data from the request body.
 *
 * @param {Object} request - The HTTP request object.
 * @param {Object} response - The HTTP response object.
 * @returns {void}
 *
*/
app.post("/updatestats", jsonParser, function (request, response) {
    if (!request.body) return response.sendStatus(400);
    statsHelpers.setCharStats(request.body);
    return response.sendStatus(200);
});



app.post("/getbackgrounds", jsonParser, function (request, response) {
    var images = getImages("public/backgrounds");
    response.send(JSON.stringify(images));

});

app.post("/getuseravatars", jsonParser, function (request, response) {
    var images = getImages("public/User Avatars");
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

app.post("/setbackground", jsonParser, function (request, response) {
    try {
        const bg = `#bg1 {background-image: url('../backgrounds/${request.body.bg}');}`;
        writeFileAtomicSync('public/css/bg_load.css', bg, 'utf8');
        response.send({ result: 'ok' });
    } catch (err) {
        console.log(err);
        response.send(err);
    }
});

app.post("/delbackground", jsonParser, function (request, response) {
    if (!request.body) return response.sendStatus(400);

    if (request.body.bg !== sanitize(request.body.bg)) {
        console.error('Malicious bg name prevented');
        return response.sendStatus(403);
    }

    const fileName = path.join('public/backgrounds/', sanitize(request.body.bg));

    if (!fs.existsSync(fileName)) {
        console.log('BG file not found');
        return response.sendStatus(400);
    }

    fs.rmSync(fileName);
    invalidateThumbnail('bg', request.body.bg);
    return response.send('ok');
});

app.post("/delchat", jsonParser, function (request, response) {
    console.log('/delchat entered');
    if (!request.body) {
        console.log('no request body seen');
        return response.sendStatus(400);
    }

    if (request.body.chatfile !== sanitize(request.body.chatfile)) {
        console.error('Malicious chat name prevented');
        return response.sendStatus(403);
    }

    const dirName = String(request.body.avatar_url).replace('.png', '');
    const fileName = `${chatsPath + dirName}/${sanitize(String(request.body.chatfile))}`;
    const chatFileExists = fs.existsSync(fileName);

    if (!chatFileExists) {
        console.log(`Chat file not found '${fileName}'`);
        return response.sendStatus(400);
    } else {
        console.log('found the chat file: ' + fileName);
        /* fs.unlinkSync(fileName); */
        fs.rmSync(fileName);
        console.log('deleted chat file: ' + fileName);

    }


    return response.send('ok');
});

app.post('/renamebackground', jsonParser, function (request, response) {
    if (!request.body) return response.sendStatus(400);

    const oldFileName = path.join(DIRECTORIES.backgrounds, sanitize(request.body.old_bg));
    const newFileName = path.join(DIRECTORIES.backgrounds, sanitize(request.body.new_bg));

    if (!fs.existsSync(oldFileName)) {
        console.log('BG file not found');
        return response.sendStatus(400);
    }

    if (fs.existsSync(newFileName)) {
        console.log('New BG file already exists');
        return response.sendStatus(400);
    }

    fs.renameSync(oldFileName, newFileName);
    invalidateThumbnail('bg', request.body.old_bg);
    return response.send('ok');
});

app.post("/downloadbackground", urlencodedParser, function (request, response) {
    response_dw_bg = response;
    if (!request.body || !request.file) return response.sendStatus(400);

    const img_path = path.join(UPLOADS_PATH, request.file.filename);
    const filename = request.file.originalname;

    try {
        fs.copyFileSync(img_path, path.join('public/backgrounds/', filename));
        invalidateThumbnail('bg', filename);
        response_dw_bg.send(filename);
        fs.unlinkSync(img_path);
    } catch (err) {
        console.error(err);
        response_dw_bg.sendStatus(500);
    }
});

app.post("/savesettings", jsonParser, function (request, response) {
    try {
        writeFileAtomicSync('public/settings.json', JSON.stringify(request.body, null, 4), 'utf8');
        response.send({ result: "ok" });
    } catch (err) {
        console.log(err);
        response.send(err);
    }
});

function getCharaCardV2(jsonObject) {
    if (jsonObject.spec === undefined) {
        jsonObject = convertToV2(jsonObject);
    } else {
        jsonObject = readFromV2(jsonObject);
    }
    return jsonObject;
}

function readAndParseFromDirectory(directoryPath, fileExtension = '.json') {
    const files = fs
        .readdirSync(directoryPath)
        .filter(x => path.parse(x).ext == fileExtension)
        .sort();

    const parsedFiles = [];

    files.forEach(item => {
        try {
            const file = fs.readFileSync(path.join(directoryPath, item), 'utf-8');
            parsedFiles.push(fileExtension == '.json' ? json5.parse(file) : file);
        }
        catch {
            // skip
        }
    });

    return parsedFiles;
}

function sortByModifiedDate(directory) {
    return (a, b) => +(new Date(fs.statSync(`${directory}/${b}`).mtime)) - +(new Date(fs.statSync(`${directory}/${a}`).mtime));
}

function sortByName(_) {
    return (a, b) => a.localeCompare(b);
}

function readPresetsFromDirectory(directoryPath, options = {}) {
    const {
        sortFunction,
        removeFileExtension = false
    } = options;

    const files = fs.readdirSync(directoryPath).sort(sortFunction);
    const fileContents = [];
    const fileNames = [];

    files.forEach(item => {
        try {
            const file = fs.readFileSync(path.join(directoryPath, item), 'utf8');
            json5.parse(file);
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
    let settings
    try {
        settings = fs.readFileSync('public/settings.json', 'utf8');
    } catch (e) {
        return response.sendStatus(500);
    }

    // NovelAI Settings
    const { fileContents: novelai_settings, fileNames: novelai_setting_names }
        = readPresetsFromDirectory(DIRECTORIES.novelAI_Settings, {
            sortFunction: sortByName(DIRECTORIES.novelAI_Settings),
            removeFileExtension: true
        });

    // OpenAI Settings
    const { fileContents: openai_settings, fileNames: openai_setting_names }
        = readPresetsFromDirectory(DIRECTORIES.openAI_Settings, {
            sortFunction: sortByModifiedDate(DIRECTORIES.openAI_Settings), removeFileExtension: true
        });

    // TextGenerationWebUI Settings
    const { fileContents: textgenerationwebui_presets, fileNames: textgenerationwebui_preset_names }
        = readPresetsFromDirectory(DIRECTORIES.textGen_Settings, {
            sortFunction: sortByName(DIRECTORIES.textGen_Settings), removeFileExtension: true
        });

    //Kobold
    const { fileContents: koboldai_settings, fileNames: koboldai_setting_names }
        = readPresetsFromDirectory(DIRECTORIES.koboldAI_Settings, {
            sortFunction: sortByName(DIRECTORIES.koboldAI_Settings), removeFileExtension: true
        })

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

app.post('/getworldinfo', jsonParser, (request, response) => {
    if (!request.body?.name) {
        return response.sendStatus(400);
    }

    const file = readWorldInfoFile(request.body.name);

    return response.send(file);
});

app.post('/deleteworldinfo', jsonParser, (request, response) => {
    if (!request.body?.name) {
        return response.sendStatus(400);
    }

    const worldInfoName = request.body.name;
    const filename = sanitize(`${worldInfoName}.json`);
    const pathToWorldInfo = path.join(DIRECTORIES.worlds, filename);

    if (!fs.existsSync(pathToWorldInfo)) {
        throw new Error(`World info file ${filename} doesn't exist.`);
    }

    fs.rmSync(pathToWorldInfo);

    return response.sendStatus(200);
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

/**
 * @param {string} name Name of World Info file
 * @param {object} entries Entries object
 */
function convertWorldInfoToCharacterBook(name, entries) {
    /** @type {{ entries: object[]; name: string }} */
    const result = { entries: [], name };

    for (const index in entries) {
        const entry = entries[index];

        const originalEntry = {
            id: entry.uid,
            keys: entry.key,
            secondary_keys: entry.keysecondary,
            comment: entry.comment,
            content: entry.content,
            constant: entry.constant,
            selective: entry.selective,
            insertion_order: entry.order,
            enabled: !entry.disable,
            position: entry.position == 0 ? 'before_char' : 'after_char',
            extensions: {
                position: entry.position,
                exclude_recursion: entry.excludeRecursion,
                display_index: entry.displayIndex,
                probability: entry.probability ?? null,
                useProbability: entry.useProbability ?? false,
                depth: entry.depth ?? 4,
                selectiveLogic: entry.selectiveLogic ?? 0,
            },
        };

        result.entries.push(originalEntry);
    }

    return result;
}

function readWorldInfoFile(worldInfoName) {
    const dummyObject = { entries: {} };

    if (!worldInfoName) {
        return dummyObject;
    }

    const filename = `${worldInfoName}.json`;
    const pathToWorldInfo = path.join(DIRECTORIES.worlds, filename);

    if (!fs.existsSync(pathToWorldInfo)) {
        console.log(`World info file ${filename} doesn't exist.`);
        return dummyObject;
    }

    const worldInfoText = fs.readFileSync(pathToWorldInfo, 'utf8');
    const worldInfo = json5.parse(worldInfoText);
    return worldInfo;
}


function getImages(path) {
    return fs
        .readdirSync(path)
        .filter(file => {
            const type = mime.lookup(file);
            return type && type.startsWith('image/');
        })
        .sort(Intl.Collator().compare);
}

app.post("/getallchatsofcharacter", jsonParser, async function (request, response) {
    if (!request.body) return response.sendStatus(400);

    const characterDirectory = (request.body.avatar_url).replace('.png', '');

    try {
        const chatsDirectory = path.join(chatsPath, characterDirectory);
        const files = fs.readdirSync(chatsDirectory);
        const jsonFiles = files.filter(file => path.extname(file) === '.jsonl');

        if (jsonFiles.length === 0) {
            response.send({ error: true });
            return;
        }

        const jsonFilesPromise = jsonFiles.map((file) => {
            return new Promise(async (res) => {
                const pathToFile = path.join(chatsPath, characterDirectory, file);
                const fileStream = fs.createReadStream(pathToFile);
                const stats = fs.statSync(pathToFile);
                const fileSizeInKB = `${(stats.size / 1024).toFixed(2)}kb`;

                const rl = readline.createInterface({
                    input: fileStream,
                    crlfDelay: Infinity
                });

                let lastLine;
                let itemCounter = 0;
                rl.on('line', (line) => {
                    itemCounter++;
                    lastLine = line;
                });
                rl.on('close', () => {
                    rl.close();

                    if (lastLine) {
                        const jsonData = tryParse(lastLine);
                        if (jsonData && (jsonData.name || jsonData.character_name)) {
                            const chatData = {};

                            chatData['file_name'] = file;
                            chatData['file_size'] = fileSizeInKB;
                            chatData['chat_items'] = itemCounter - 1;
                            chatData['mes'] = jsonData['mes'] || '[The chat is empty]';
                            chatData['last_mes'] = jsonData['send_date'] || Date.now();

                            res(chatData);
                        } else {
                            console.log('Found an invalid or corrupted chat file:', pathToFile);
                            res({});
                        }
                    }
                });
            });
        });

        const chatData = await Promise.all(jsonFilesPromise);
        const validFiles = chatData.filter(i => i.file_name);

        return response.send(validFiles);
    } catch (error) {
        console.log(error);
        return response.send({ error: true });
    }
});

function getPngName(file) {
    let i = 1;
    let base_name = file;
    while (fs.existsSync(charactersPath + file + '.png')) {
        file = base_name + i;
        i++;
    }
    return file;
}

app.post("/importcharacter", urlencodedParser, async function (request, response) {

    if (!request.body || request.file === undefined) return response.sendStatus(400);

    let png_name = '';
    let filedata = request.file;
    let uploadPath = path.join(UPLOADS_PATH, filedata.filename);
    var format = request.body.file_type;
    const defaultAvatarPath = './public/img/ai4.png';
    const { importRisuSprites } = require('./src/sprites');
    //console.log(format);
    if (filedata) {
        if (format == 'json') {
            fs.readFile(uploadPath, 'utf8', async (err, data) => {
                fs.unlinkSync(uploadPath);

                if (err) {
                    console.log(err);
                    response.send({ error: true });
                }

                let jsonData = json5.parse(data);

                if (jsonData.spec !== undefined) {
                    console.log('importing from v2 json');
                    importRisuSprites(jsonData);
                    unsetFavFlag(jsonData);
                    jsonData = readFromV2(jsonData);
                    jsonData["create_date"] = humanizedISO8601DateTime();
                    png_name = getPngName(jsonData.data?.name || jsonData.name);
                    let char = JSON.stringify(jsonData);
                    charaWrite(defaultAvatarPath, char, png_name, response, { file_name: png_name });
                } else if (jsonData.name !== undefined) {
                    console.log('importing from v1 json');
                    jsonData.name = sanitize(jsonData.name);
                    if (jsonData.creator_notes) {
                        jsonData.creator_notes = jsonData.creator_notes.replace("Creator's notes go here.", "");
                    }
                    png_name = getPngName(jsonData.name);
                    let char = {
                        "name": jsonData.name,
                        "description": jsonData.description ?? '',
                        "creatorcomment": jsonData.creatorcomment ?? jsonData.creator_notes ?? '',
                        "personality": jsonData.personality ?? '',
                        "first_mes": jsonData.first_mes ?? '',
                        "avatar": 'none',
                        "chat": jsonData.name + " - " + humanizedISO8601DateTime(),
                        "mes_example": jsonData.mes_example ?? '',
                        "scenario": jsonData.scenario ?? '',
                        "create_date": humanizedISO8601DateTime(),
                        "talkativeness": jsonData.talkativeness ?? 0.5,
                        "creator": jsonData.creator ?? '',
                        "tags": jsonData.tags ?? '',
                    };
                    char = convertToV2(char);
                    let charJSON = JSON.stringify(char);
                    charaWrite(defaultAvatarPath, charJSON, png_name, response, { file_name: png_name });
                } else if (jsonData.char_name !== undefined) {//json Pygmalion notepad
                    console.log('importing from gradio json');
                    jsonData.char_name = sanitize(jsonData.char_name);
                    if (jsonData.creator_notes) {
                        jsonData.creator_notes = jsonData.creator_notes.replace("Creator's notes go here.", "");
                    }
                    png_name = getPngName(jsonData.char_name);
                    let char = {
                        "name": jsonData.char_name,
                        "description": jsonData.char_persona ?? '',
                        "creatorcomment": jsonData.creatorcomment ?? jsonData.creator_notes ?? '',
                        "personality": '',
                        "first_mes": jsonData.char_greeting ?? '',
                        "avatar": 'none',
                        "chat": jsonData.name + " - " + humanizedISO8601DateTime(),
                        "mes_example": jsonData.example_dialogue ?? '',
                        "scenario": jsonData.world_scenario ?? '',
                        "create_date": humanizedISO8601DateTime(),
                        "talkativeness": jsonData.talkativeness ?? 0.5,
                        "creator": jsonData.creator ?? '',
                        "tags": jsonData.tags ?? '',
                    };
                    char = convertToV2(char);
                    let charJSON = JSON.stringify(char);
                    charaWrite(defaultAvatarPath, charJSON, png_name, response, { file_name: png_name });
                } else {
                    console.log('Incorrect character format .json');
                    response.send({ error: true });
                }
            });
        } else {
            try {
                var img_data = await charaRead(uploadPath, format);
                if (img_data === undefined) throw new Error('Failed to read character data');

                let jsonData = json5.parse(img_data);

                jsonData.name = sanitize(jsonData.data?.name || jsonData.name);
                png_name = getPngName(jsonData.name);

                if (jsonData.spec !== undefined) {
                    console.log('Found a v2 character file.');
                    importRisuSprites(jsonData);
                    unsetFavFlag(jsonData);
                    jsonData = readFromV2(jsonData);
                    jsonData["create_date"] = humanizedISO8601DateTime();
                    const char = JSON.stringify(jsonData);
                    await charaWrite(uploadPath, char, png_name, response, { file_name: png_name });
                    fs.unlinkSync(uploadPath);
                } else if (jsonData.name !== undefined) {
                    console.log('Found a v1 character file.');

                    if (jsonData.creator_notes) {
                        jsonData.creator_notes = jsonData.creator_notes.replace("Creator's notes go here.", "");
                    }

                    let char = {
                        "name": jsonData.name,
                        "description": jsonData.description ?? '',
                        "creatorcomment": jsonData.creatorcomment ?? jsonData.creator_notes ?? '',
                        "personality": jsonData.personality ?? '',
                        "first_mes": jsonData.first_mes ?? '',
                        "avatar": 'none',
                        "chat": jsonData.name + " - " + humanizedISO8601DateTime(),
                        "mes_example": jsonData.mes_example ?? '',
                        "scenario": jsonData.scenario ?? '',
                        "create_date": humanizedISO8601DateTime(),
                        "talkativeness": jsonData.talkativeness ?? 0.5,
                        "creator": jsonData.creator ?? '',
                        "tags": jsonData.tags ?? '',
                    };
                    char = convertToV2(char);
                    const charJSON = JSON.stringify(char);
                    await charaWrite(uploadPath, charJSON, png_name, response, { file_name: png_name });
                    fs.unlinkSync(uploadPath);
                } else {
                    console.log('Unknown character card format');
                    response.send({ error: true });
                }
            } catch (err) {
                console.log(err);
                response.send({ error: true });
            }
        }
    }
});

app.post("/dupecharacter", jsonParser, async function (request, response) {
    try {
        if (!request.body.avatar_url) {
            console.log("avatar URL not found in request body");
            console.log(request.body);
            return response.sendStatus(400);
        }
        let filename = path.join(DIRECTORIES.characters, sanitize(request.body.avatar_url));
        if (!fs.existsSync(filename)) {
            console.log('file for dupe not found');
            console.log(filename);
            return response.sendStatus(404);
        }
        let suffix = 1;
        let newFilename = filename;

        // If filename ends with a _number, increment the number
        const nameParts = path.basename(filename, path.extname(filename)).split('_');
        const lastPart = nameParts[nameParts.length - 1];

        let baseName;

        if (!isNaN(Number(lastPart)) && nameParts.length > 1) {
            suffix = parseInt(lastPart) + 1;
            baseName = nameParts.slice(0, -1).join("_"); // construct baseName without suffix
        } else {
            baseName = nameParts.join("_"); // original filename is completely the baseName
        }

        newFilename = path.join(DIRECTORIES.characters, `${baseName}_${suffix}${path.extname(filename)}`);

        while (fs.existsSync(newFilename)) {
            let suffixStr = "_" + suffix;
            newFilename = path.join(DIRECTORIES.characters, `${baseName}${suffixStr}${path.extname(filename)}`);
            suffix++;
        }

        fs.copyFileSync(filename, newFilename);
        console.log(`${filename} was copied to ${newFilename}`);
        response.sendStatus(200);
    }
    catch (error) {
        console.error(error);
        return response.send({ error: true });
    }
});

app.post("/exportchat", jsonParser, async function (request, response) {
    if (!request.body.file || (!request.body.avatar_url && request.body.is_group === false)) {
        return response.sendStatus(400);
    }
    const pathToFolder = request.body.is_group
        ? DIRECTORIES.groupChats
        : path.join(DIRECTORIES.chats, String(request.body.avatar_url).replace('.png', ''));
    let filename = path.join(pathToFolder, request.body.file);
    let exportfilename = request.body.exportfilename
    if (!fs.existsSync(filename)) {
        const errorMessage = {
            message: `Could not find JSONL file to export. Source chat file: ${filename}.`
        }
        console.log(errorMessage.message);
        return response.status(404).json(errorMessage);
    }
    try {
        // Short path for JSONL files
        if (request.body.format == 'jsonl') {
            try {
                const rawFile = fs.readFileSync(filename, 'utf8');
                const successMessage = {
                    message: `Chat saved to ${exportfilename}`,
                    result: rawFile,
                }

                console.log(`Chat exported as ${exportfilename}`);
                return response.status(200).json(successMessage);
            }
            catch (err) {
                console.error(err);
                const errorMessage = {
                    message: `Could not read JSONL file to export. Source chat file: ${filename}.`
                }
                console.log(errorMessage.message);
                return response.status(500).json(errorMessage);
            }
        }

        const readStream = fs.createReadStream(filename);
        const rl = readline.createInterface({
            input: readStream,
        });
        let buffer = '';
        rl.on('line', (line) => {
            const data = JSON.parse(line);
            if (data.mes) {
                const name = data.name;
                const message = (data?.extra?.display_text || data?.mes || '').replace(/\r?\n/g, '\n');
                buffer += (`${name}: ${message}\n\n`);
            }
        });
        rl.on('close', () => {
            const successMessage = {
                message: `Chat saved to ${exportfilename}`,
                result: buffer,
            }
            console.log(`Chat exported as ${exportfilename}`);
            return response.status(200).json(successMessage);
        });
    }
    catch (err) {
        console.log("chat export failed.")
        console.log(err);
        return response.sendStatus(400);
    }
})

app.post("/exportcharacter", jsonParser, async function (request, response) {
    if (!request.body.format || !request.body.avatar_url) {
        return response.sendStatus(400);
    }

    let filename = path.join(DIRECTORIES.characters, sanitize(request.body.avatar_url));

    if (!fs.existsSync(filename)) {
        return response.sendStatus(404);
    }

    switch (request.body.format) {
        case 'png':
            return response.sendFile(filename, { root: process.cwd() });
        case 'json': {
            try {
                let json = await charaRead(filename);
                if (json === undefined) return response.sendStatus(400);
                let jsonObject = getCharaCardV2(json5.parse(json));
                return response.type('json').send(jsonObject)
            }
            catch {
                return response.sendStatus(400);
            }
        }
    }

    return response.sendStatus(400);
});

app.post("/importgroupchat", urlencodedParser, function (request, response) {
    try {
        const filedata = request.file;

        if (!filedata) {
            return response.sendStatus(400);
        }

        const chatname = humanizedISO8601DateTime();
        const pathToUpload = path.join(UPLOADS_PATH, filedata.filename);
        const pathToNewFile = path.join(DIRECTORIES.groupChats, `${chatname}.jsonl`);
        fs.copyFileSync(pathToUpload, pathToNewFile);
        fs.unlinkSync(pathToUpload);
        return response.send({ res: chatname });
    } catch (error) {
        console.error(error);
        return response.send({ error: true });
    }
});

app.post("/importchat", urlencodedParser, function (request, response) {
    if (!request.body) return response.sendStatus(400);

    var format = request.body.file_type;
    let filedata = request.file;
    let avatar_url = (request.body.avatar_url).replace('.png', '');
    let ch_name = request.body.character_name;
    let user_name = request.body.user_name || 'You';

    if (!filedata) {
        return response.sendStatus(400);
    }

    try {
        const data = fs.readFileSync(path.join(UPLOADS_PATH, filedata.filename), 'utf8');

        if (format === 'json') {
            const jsonData = json5.parse(data);
            if (jsonData.histories !== undefined) {
                //console.log('/importchat confirms JSON histories are defined');
                const chat = {
                    from(history) {
                        return [
                            {
                                user_name: user_name,
                                character_name: ch_name,
                                create_date: humanizedISO8601DateTime(),
                            },
                            ...history.msgs.map(
                                (message) => ({
                                    name: message.src.is_human ? user_name : ch_name,
                                    is_user: message.src.is_human,
                                    send_date: humanizedISO8601DateTime(),
                                    mes: message.text,
                                })
                            )];
                    }
                }

                const newChats = [];
                (jsonData.histories.histories ?? []).forEach((history) => {
                    newChats.push(chat.from(history));
                });

                const errors = [];

                for (const chat of newChats) {
                    const filePath = `${chatsPath + avatar_url}/${ch_name} - ${humanizedISO8601DateTime()} imported.jsonl`;
                    const fileContent = chat.map(tryParse).filter(x => x).join('\n');

                    try {
                        writeFileAtomicSync(filePath, fileContent, 'utf8');
                    } catch (err) {
                        errors.push(err);
                    }
                }

                if (0 < errors.length) {
                    response.send('Errors occurred while writing character files. Errors: ' + JSON.stringify(errors));
                }

                response.send({ res: true });
            } else if (Array.isArray(jsonData.data_visible)) {
                // oobabooga's format
                /** @type {object[]} */
                const chat = [{
                    user_name: user_name,
                    character_name: ch_name,
                    create_date: humanizedISO8601DateTime(),
                }];

                for (const arr of jsonData.data_visible) {
                    if (arr[0]) {
                        const userMessage = {
                            name: user_name,
                            is_user: true,
                            send_date: humanizedISO8601DateTime(),
                            mes: arr[0],
                        };
                        chat.push(userMessage);
                    }
                    if (arr[1]) {
                        const charMessage = {
                            name: ch_name,
                            is_user: false,
                            send_date: humanizedISO8601DateTime(),
                            mes: arr[1],
                        };
                        chat.push(charMessage);
                    }
                }

                const chatContent = chat.map(obj => JSON.stringify(obj)).join('\n');
                writeFileAtomicSync(`${chatsPath + avatar_url}/${ch_name} - ${humanizedISO8601DateTime()} imported.jsonl`, chatContent, 'utf8');

                response.send({ res: true });
            } else {
                console.log('Incorrect chat format .json');
                return response.send({ error: true });
            }
        }

        if (format === 'jsonl') {
            const line = data.split('\n')[0];

            let jsonData = json5.parse(line);

            if (jsonData.user_name !== undefined || jsonData.name !== undefined) {
                fs.copyFileSync(path.join(UPLOADS_PATH, filedata.filename), (`${chatsPath + avatar_url}/${ch_name} - ${humanizedISO8601DateTime()}.jsonl`));
                response.send({ res: true });
            } else {
                console.log('Incorrect chat format .jsonl');
                return response.send({ error: true });
            }
        }
    } catch (error) {
        console.error(error);
        return response.send({ error: true });
    }
});

app.post('/importworldinfo', urlencodedParser, (request, response) => {
    if (!request.file) return response.sendStatus(400);

    const filename = `${path.parse(sanitize(request.file.originalname)).name}.json`;

    let fileContents = null;

    if (request.body.convertedData) {
        fileContents = request.body.convertedData;
    } else {
        const pathToUpload = path.join(UPLOADS_PATH, request.file.filename);
        fileContents = fs.readFileSync(pathToUpload, 'utf8');
        fs.unlinkSync(pathToUpload);
    }

    try {
        const worldContent = json5.parse(fileContents);
        if (!('entries' in worldContent)) {
            throw new Error('File must contain a world info entries list');
        }
    } catch (err) {
        return response.status(400).send('Is not a valid world info file');
    }

    const pathToNewFile = path.join(DIRECTORIES.worlds, filename);
    const worldName = path.parse(pathToNewFile).name;

    if (!worldName) {
        return response.status(400).send('World file must have a name');
    }

    writeFileAtomicSync(pathToNewFile, fileContents);
    return response.send({ name: worldName });
});

app.post('/editworldinfo', jsonParser, (request, response) => {
    if (!request.body) {
        return response.sendStatus(400);
    }

    if (!request.body.name) {
        return response.status(400).send('World file must have a name');
    }

    try {
        if (!('entries' in request.body.data)) {
            throw new Error('World info must contain an entries list');
        }
    } catch (err) {
        return response.status(400).send('Is not a valid world info file');
    }

    const filename = `${sanitize(request.body.name)}.json`;
    const pathToFile = path.join(DIRECTORIES.worlds, filename);

    writeFileAtomicSync(pathToFile, JSON.stringify(request.body.data, null, 4));

    return response.send({ ok: true });
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
        return response.status(400).send({ error: "No image data provided" });
    }

    // Extracting the base64 data and the image format
    const match = request.body.image.match(/^data:image\/(png|jpg|webp|jpeg|gif);base64,(.+)$/);
    if (!match) {
        return response.status(400).send({ error: "Invalid image format" });
    }

    const [, format, base64Data] = match;

    // Constructing filename and path
    let filename = `${Date.now()}.${format}`;
    if (request.body.filename) {
        filename = `${request.body.filename}.${format}`;
    }

    // if character is defined, save to a sub folder for that character
    let pathToNewFile = path.join(DIRECTORIES.userImages, filename);
    if (request.body.ch_name) {
        pathToNewFile = path.join(DIRECTORIES.userImages, request.body.ch_name, filename);
    }

    try {
        ensureDirectoryExistence(pathToNewFile);
        const imageBuffer = Buffer.from(base64Data, 'base64');
        await fs.promises.writeFile(pathToNewFile, imageBuffer);
        // send the path to the image, relative to the client folder, which means removing the first folder from the path which is 'public'
        pathToNewFile = pathToNewFile.split(path.sep).slice(1).join(path.sep);
        response.send({ path: pathToNewFile });
    } catch (error) {
        console.log(error);
        response.status(500).send({ error: "Failed to save the image" });
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
        return res.status(500).send({ error: "Unable to retrieve files" });
    }
});


app.post('/getgroups', jsonParser, (_, response) => {
    const groups = [];

    if (!fs.existsSync(DIRECTORIES.groups)) {
        fs.mkdirSync(DIRECTORIES.groups);
    }

    const files = fs.readdirSync(DIRECTORIES.groups).filter(x => path.extname(x) === '.json');
    const chats = fs.readdirSync(DIRECTORIES.groupChats).filter(x => path.extname(x) === '.jsonl');

    files.forEach(function (file) {
        try {
            const filePath = path.join(DIRECTORIES.groups, file);
            const fileContents = fs.readFileSync(filePath, 'utf8');
            const group = json5.parse(fileContents);
            const groupStat = fs.statSync(filePath);
            group['date_added'] = groupStat.birthtimeMs;
            group['create_date'] = humanizedISO8601DateTime(groupStat.birthtimeMs);

            let chat_size = 0;
            let date_last_chat = 0;

            if (Array.isArray(group.chats) && Array.isArray(chats)) {
                for (const chat of chats) {
                    if (group.chats.includes(path.parse(chat).name)) {
                        const chatStat = fs.statSync(path.join(DIRECTORIES.groupChats, chat));
                        chat_size += chatStat.size;
                        date_last_chat = Math.max(date_last_chat, chatStat.mtimeMs);
                    }
                }
            }

            group['date_last_chat'] = date_last_chat;
            group['chat_size'] = chat_size;
            groups.push(group);
        }
        catch (error) {
            console.error(error);
        }
    });

    return response.send(groups);
});

app.post('/creategroup', jsonParser, (request, response) => {
    if (!request.body) {
        return response.sendStatus(400);
    }

    const id = String(Date.now());
    const groupMetadata = {
        id: id,
        name: request.body.name ?? 'New Group',
        members: request.body.members ?? [],
        avatar_url: request.body.avatar_url,
        allow_self_responses: !!request.body.allow_self_responses,
        activation_strategy: request.body.activation_strategy ?? 0,
        generation_mode: request.body.generation_mode ?? 0,
        disabled_members: request.body.disabled_members ?? [],
        chat_metadata: request.body.chat_metadata ?? {},
        fav: request.body.fav,
        chat_id: request.body.chat_id ?? id,
        chats: request.body.chats ?? [id],
    };
    const pathToFile = path.join(DIRECTORIES.groups, `${id}.json`);
    const fileData = JSON.stringify(groupMetadata);

    if (!fs.existsSync(DIRECTORIES.groups)) {
        fs.mkdirSync(DIRECTORIES.groups);
    }

    writeFileAtomicSync(pathToFile, fileData);
    return response.send(groupMetadata);
});

app.post('/editgroup', jsonParser, (request, response) => {
    if (!request.body || !request.body.id) {
        return response.sendStatus(400);
    }
    const id = request.body.id;
    const pathToFile = path.join(DIRECTORIES.groups, `${id}.json`);
    const fileData = JSON.stringify(request.body);

    writeFileAtomicSync(pathToFile, fileData);
    return response.send({ ok: true });
});

app.post('/getgroupchat', jsonParser, (request, response) => {
    if (!request.body || !request.body.id) {
        return response.sendStatus(400);
    }

    const id = request.body.id;
    const pathToFile = path.join(DIRECTORIES.groupChats, `${id}.jsonl`);

    if (fs.existsSync(pathToFile)) {
        const data = fs.readFileSync(pathToFile, 'utf8');
        const lines = data.split('\n');

        // Iterate through the array of strings and parse each line as JSON
        const jsonData = lines.map(line => tryParse(line)).filter(x => x);
        return response.send(jsonData);
    } else {
        return response.send([]);
    }
});

app.post('/deletegroupchat', jsonParser, (request, response) => {
    if (!request.body || !request.body.id) {
        return response.sendStatus(400);
    }

    const id = request.body.id;
    const pathToFile = path.join(DIRECTORIES.groupChats, `${id}.jsonl`);

    if (fs.existsSync(pathToFile)) {
        fs.rmSync(pathToFile);
        return response.send({ ok: true });
    }

    return response.send({ error: true });
});

app.post('/savegroupchat', jsonParser, (request, response) => {
    if (!request.body || !request.body.id) {
        return response.sendStatus(400);
    }

    const id = request.body.id;
    const pathToFile = path.join(DIRECTORIES.groupChats, `${id}.jsonl`);

    if (!fs.existsSync(DIRECTORIES.groupChats)) {
        fs.mkdirSync(DIRECTORIES.groupChats);
    }

    let chat_data = request.body.chat;
    let jsonlData = chat_data.map(JSON.stringify).join('\n');
    writeFileAtomicSync(pathToFile, jsonlData, 'utf8');
    backupChat(String(id), jsonlData);
    return response.send({ ok: true });
});

app.post('/deletegroup', jsonParser, async (request, response) => {
    if (!request.body || !request.body.id) {
        return response.sendStatus(400);
    }

    const id = request.body.id;
    const pathToGroup = path.join(DIRECTORIES.groups, sanitize(`${id}.json`));

    try {
        // Delete group chats
        const group = json5.parse(fs.readFileSync(pathToGroup, 'utf8'));

        if (group && Array.isArray(group.chats)) {
            for (const chat of group.chats) {
                console.log('Deleting group chat', chat);
                const pathToFile = path.join(DIRECTORIES.groupChats, `${id}.jsonl`);

                if (fs.existsSync(pathToFile)) {
                    fs.rmSync(pathToFile);
                }
            }
        }
    } catch (error) {
        console.error('Could not delete group chats. Clean them up manually.', error);
    }

    if (fs.existsSync(pathToGroup)) {
        fs.rmSync(pathToGroup);
    }

    return response.send({ ok: true });
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
app.post("/getstatus_openai", jsonParser, async function (request, response_getstatus_openai) {
    if (!request.body) return response_getstatus_openai.sendStatus(400);

    let api_url;
    let api_key_openai;
    let headers;

    if (request.body.use_openrouter == false) {
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
        return response_getstatus_openai.status(401).send({ error: true });
    }

    try {
        const response = await fetch(api_url + "/models", {
            method: 'GET',
            headers: {
                "Authorization": "Bearer " + api_key_openai,
                ...headers,
            },
        });

        if (response.ok) {
            const data = await response.json();
            response_getstatus_openai.send(data);

            if (request.body.use_openrouter && Array.isArray(data?.data)) {
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
                    console.log('OpenAI endpoint did not return a list of models.')
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

app.post("/openai_bias", jsonParser, async function (request, response) {
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
            encodeFunction = (text) => new Uint32Array(tokenizer.encodeIds(text));
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
            messageStrings.push("System: " + m.content);
        }
        else if (m.role === 'system' && m.name !== undefined) {
            messageStrings.push(m.name + ": " + m.content);
        }
        else {
            messageStrings.push(m.role + ": " + m.content);
        }
    });
    return messageStrings.join("\n") + '\nassistant:';
}

async function sendScaleRequest(request, response) {

    const api_url = new URL(request.body.api_url_scale).toString();
    const api_key_scale = readSecret(SECRET_KEYS.SCALE);

    if (!api_key_scale) {
        return response.status(401).send({ error: true });
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
            method: "POST",
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

        const reply = { choices: [{ "message": { "content": generateResponseJson.output, } }] };
        return response.send(reply);
    } catch (error) {
        console.log(error);
        if (!response.headersSent) {
            return response.status(500).send({ error: true });
        }
    }
}

app.post("/generate_altscale", jsonParser, function (request, response_generate_scale) {
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
                    taxonomy: null
                },
                prompt: {
                    id: '',
                    template: '{{input}}\n',
                    exampleVariables: {},
                    variablesSourceDataId: null,
                    systemMessage: request.body.sysprompt
                },
                modelParameters: {
                    id: '',
                    modelId: 'GPT4',
                    modelType: 'OpenAi',
                    maxTokens: request.body.max_tokens,
                    temperature: request.body.temp,
                    stop: "user:",
                    suffix: null,
                    topP: request.body.top_p,
                    logprobs: null,
                    logitBias: request.body.logit_bias
                },
                inputs: [
                    {
                        index: '-1',
                        valueByName: {
                            input: request.body.prompt
                        }
                    }
                ]
            },
            meta: {
                values: {
                    'variant.taxonomy': ['undefined'],
                    'prompt.variablesSourceDataId': ['undefined'],
                    'modelParameters.suffix': ['undefined'],
                    'modelParameters.logprobs': ['undefined'],
                }
            }
        })
    })
        .then(response => response.json())
        .then(data => {
            console.log(data.result.data.json.outputs[0])
            return response_generate_scale.send({ output: data.result.data.json.outputs[0] });
        })
        .catch((error) => {
            console.error('Error:', error)
            return response_generate_scale.send({ error: true })
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
        return response.status(401).send({ error: true });
    }

    try {
        const controller = new AbortController();
        request.socket.removeAllListeners('close');
        request.socket.on('close', function () {
            controller.abort();
        });

        let requestPrompt = convertClaudePrompt(request.body.messages, true, !request.body.exclude_assistant);

        if (request.body.assistant_prefill && !request.body.exclude_assistant) {
            requestPrompt += request.body.assistant_prefill;
        }

        console.log('Claude request:', requestPrompt);
        const stop_sequences = ["\n\nHuman:", "\n\nSystem:", "\n\nAssistant:"];

        // Add custom stop sequences
        if (Array.isArray(request.body.stop)) {
            stop_sequences.push(...request.body.stop);
        }

        const generateResponse = await fetch(api_url + '/complete', {
            method: "POST",
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
                "Content-Type": "application/json",
                "anthropic-version": '2023-06-01',
                "x-api-key": api_key_claude,
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
                console.log("Streaming request finished");
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
            const reply = { choices: [{ "message": { "content": responseText, } }] };
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
        return response.status(401).send({ error: true });
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
            method: "POST",
            headers: {
                "Content-Type": "application/json"
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
        const reply = { choices: [{ "message": { "content": responseText, } }] };
        return response.send(reply);
    } catch (error) {
        console.log('Error communicating with Palm API: ', error);
        if (!response.headersSent) {
            return response.status(500).send({ error: true });
        }
    }
}

app.post("/generate_openai", jsonParser, function (request, response_generate_openai) {
    if (!request.body) return response_generate_openai.status(400).send({ error: true });

    if (request.body.use_claude) {
        return sendClaudeRequest(request, response_generate_openai);
    }

    if (request.body.use_scale) {
        return sendScaleRequest(request, response_generate_openai);
    }

    if (request.body.use_ai21) {
        return sendAI21Request(request, response_generate_openai);
    }

    if (request.body.use_palm) {
        return sendPalmRequest(request, response_generate_openai);
    }

    let api_url;
    let api_key_openai;
    let headers;
    let bodyParams;

    if (!request.body.use_openrouter) {
        api_url = new URL(request.body.reverse_proxy || API_OPENAI).toString();
        api_key_openai = request.body.reverse_proxy ? request.body.proxy_password : readSecret(SECRET_KEYS.OPENAI);
        headers = {};
        bodyParams = {};
    } else {
        api_url = 'https://openrouter.ai/api/v1';
        api_key_openai = readSecret(SECRET_KEYS.OPENROUTER);
        // OpenRouter needs to pass the referer: https://openrouter.ai/docs
        headers = { 'HTTP-Referer': request.headers.referer };
        bodyParams = { 'transforms': ["middle-out"] };

        if (request.body.use_fallback) {
            bodyParams['route'] = 'fallback';
        }
    }

    if (!api_key_openai && !request.body.reverse_proxy) {
        return response_generate_openai.status(401).send({ error: true });
    }

    // Add custom stop sequences
    if (Array.isArray(request.body.stop) && request.body.stop.length > 0) {
        bodyParams['stop'] = request.body.stop;
    }

    const isTextCompletion = Boolean(request.body.model && TEXT_COMPLETION_MODELS.includes(request.body.model)) || typeof request.body.messages === 'string';
    const textPrompt = isTextCompletion ? convertChatMLPrompt(request.body.messages) : '';
    const endpointUrl = isTextCompletion && !request.body.use_openrouter ? `${api_url}/completions` : `${api_url}/chat/completions`;

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
            "messages": isTextCompletion === false ? request.body.messages : undefined,
            "prompt": isTextCompletion === true ? textPrompt : undefined,
            "model": request.body.model,
            "temperature": request.body.temperature,
            "max_tokens": request.body.max_tokens,
            "stream": request.body.stream,
            "presence_penalty": request.body.presence_penalty,
            "frequency_penalty": request.body.frequency_penalty,
            "top_p": request.body.top_p,
            "top_k": request.body.top_k,
            "stop": isTextCompletion === false ? request.body.stop : undefined,
            "logit_bias": request.body.logit_bias,
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
            const fetchResponse = await fetch(endpointUrl, config)

            if (fetchResponse.ok) {
                if (request.body.stream) {
                    console.log('Streaming request in progress');
                    fetchResponse.body.pipe(response_generate_openai);
                    fetchResponse.body.on('end', () => {
                        console.log('Streaming request finished');
                        response_generate_openai.end();
                    });
                } else {
                    let json = await fetchResponse.json()
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
    console.log(request.body.messages)
    request.socket.removeAllListeners('close');
    request.socket.on('close', function () {
        controller.abort();
    });
    const options = {
        method: 'POST',
        headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            Authorization: `Bearer ${readSecret(SECRET_KEYS.AI21)}`
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
                applyToEmojis: false
            },
            presencePenalty: {
                scale: request.body.presence_penalty,
                applyToWhitespaces: false,
                applyToPunctuations: false,
                applyToNumbers: false,
                applyToStopwords: false,
                applyToEmojis: false
            },
            countPenalty: {
                scale: request.body.count_pen,
                applyToWhitespaces: false,
                applyToPunctuations: false,
                applyToNumbers: false,
                applyToStopwords: false,
                applyToEmojis: false
            },
            prompt: request.body.messages
        }),
        signal: controller.signal,
    };

    fetch(`https://api.ai21.com/studio/v1/${request.body.model}/complete`, options)
        .then(r => r.json())
        .then(r => {
            if (r.completions === undefined) {
                console.log(r)
            } else {
                console.log(r.completions[0].data.text)
            }
            const reply = { choices: [{ "message": { "content": r.completions[0].data.text, } }] };
            return response.send(reply)
        })
        .catch(err => {
            console.error(err)
            return response.send({ error: true })
        });

}

app.post("/tokenize_via_api", jsonParser, async function (request, response) {
    if (!request.body) {
        return response.sendStatus(400);
    }
    const text = String(request.body.text) || '';
    const api = String(request.body.api);
    const baseUrl = String(request.body.url);
    const legacyApi = Boolean(request.body.legacy_api);

    try {
        if (api == 'textgenerationwebui') {
            const args = {
                method: 'POST',
                headers: { "Content-Type": "application/json" },
            };

            setAdditionalHeaders(request, args, null);

            // Convert to string + remove trailing slash + /v1 suffix
            let url = String(baseUrl).replace(/\/$/, '').replace(/\/v1$/, '');

            if (legacyApi) {
                url += '/v1/token-count';
                args.body = JSON.stringify({ "prompt": text });
            } else {
                url += '/v1/internal/encode';
                args.body = JSON.stringify({ "text": text });
            }

            const result = await fetch(url, args);

            if (!result.ok) {
                console.log(`API returned error: ${result.status} ${result.statusText}`);
                return response.send({ error: true });
            }

            const data = await result.json();
            const count = legacyApi ? data?.results[0]?.tokens : data?.length;
            const ids = legacyApi ? [] : data?.tokens;

            return response.send({ count, ids });
        }

        else if (api == 'kobold') {
            const args = {
                method: 'POST',
                body: JSON.stringify({ "prompt": text }),
                headers: { "Content-Type": "application/json" }
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
require('./src/openai').registerEndpoints(app, jsonParser);

// Tokenizers
require('./src/tokenizers').registerEndpoints(app, jsonParser);

// Preset management
require('./src/presets').registerEndpoints(app, jsonParser);

// Secrets managemenet
require('./src/secrets').registerEndpoints(app, jsonParser);

// Thumbnail generation
require('./src/thumbnails').registerEndpoints(app, jsonParser);

// NovelAI generation
require('./src/novelai').registerEndpoints(app, jsonParser);

// Third-party extensions
require('./src/extensions').registerEndpoints(app, jsonParser);

// Asset management
require('./src/assets').registerEndpoints(app, jsonParser);

// Character sprite management
require('./src/sprites').registerEndpoints(app, jsonParser, urlencodedParser);

// Custom content management
require('./src/content-manager').registerEndpoints(app, jsonParser);

// Stable Diffusion generation
require('./src/stable-diffusion').registerEndpoints(app, jsonParser);

// LLM and SD Horde generation
require('./src/horde').registerEndpoints(app, jsonParser);

// Vector storage DB
require('./src/vectors').registerEndpoints(app, jsonParser);

// Chat translation
require('./src/translate').registerEndpoints(app, jsonParser);

// Emotion classification
require('./src/classify').registerEndpoints(app, jsonParser);

// Image captioning
require('./src/caption').registerEndpoints(app, jsonParser);

const tavernUrl = new URL(
    (cliArguments.ssl ? 'https://' : 'http://') +
    (listen ? '0.0.0.0' : '127.0.0.1') +
    (':' + server_port)
);

const autorunUrl = new URL(
    (cliArguments.ssl ? 'https://' : 'http://') +
    ('127.0.0.1') +
    (':' + server_port)
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
    await statsHelpers.loadStatsFile(DIRECTORIES.chats, DIRECTORIES.characters);

    // Set up event listeners for a graceful shutdown
    process.on('SIGINT', statsHelpers.writeStatsToFileAndExit);
    process.on('SIGTERM', statsHelpers.writeStatsToFileAndExit);
    process.on('uncaughtException', (err) => {
        console.error('Uncaught exception:', err);
        statsHelpers.writeStatsToFileAndExit();
    });

    setInterval(statsHelpers.saveStatsToFile, 5 * 60 * 1000);

    console.log('Launching...');

    if (autorun) open(autorunUrl.toString());

    console.log(color.green('SillyTavern is listening on: ' + tavernUrl));

    if (listen) {
        console.log('\n0.0.0.0 means SillyTavern is listening on all network interfaces (Wi-Fi, LAN, localhost). If you want to limit it only to internal localhost (127.0.0.1), change the setting in config.conf to "listen=false". Check "access.log" file in the SillyTavern directory if you want to inspect incoming connections.\n');
    }
}

if (listen && !config.whitelistMode && !config.basicAuthMode) {
    if (config.securityOverride) {
        console.warn(color.red("Security has been overridden. If it's not a trusted network, change the settings."));
    }
    else {
        console.error(color.red('Your SillyTavern is currently unsecurely open to the public. Enable whitelisting or basic authentication.'));
        process.exit(1);
    }
}

if (true === cliArguments.ssl) {
    https.createServer(
        {
            cert: fs.readFileSync(cliArguments.certPath),
            key: fs.readFileSync(cliArguments.keyPath)
        }, app)
        .listen(
            Number(tavernUrl.port) || 443,
            tavernUrl.hostname,
            setupTasks
        );
} else {
    http.createServer(app).listen(
        Number(tavernUrl.port) || 80,
        tavernUrl.hostname,
        setupTasks
    );
}

function generateTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

/**
 *
 * @param {string} name
 * @param {string} chat
 */
function backupChat(name, chat) {
    try {
        const isBackupDisabled = config.disableChatBackup;

        if (isBackupDisabled) {
            return;
        }

        if (!fs.existsSync(DIRECTORIES.backups)) {
            fs.mkdirSync(DIRECTORIES.backups);
        }

        // replace non-alphanumeric characters with underscores
        name = sanitize(name).replace(/[^a-z0-9]/gi, '_').toLowerCase();

        const backupFile = path.join(DIRECTORIES.backups, `chat_${name}_${generateTimestamp()}.json`);
        writeFileAtomicSync(backupFile, chat, 'utf-8');

        removeOldBackups(`chat_${name}_`);
    } catch (err) {
        console.log(`Could not backup chat for ${name}`, err);
    }
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

/**
 * @param {string} prefix
 */
function removeOldBackups(prefix) {
    const MAX_BACKUPS = 25;

    let files = fs.readdirSync(DIRECTORIES.backups).filter(f => f.startsWith(prefix));
    if (files.length > MAX_BACKUPS) {
        files = files.map(f => path.join(DIRECTORIES.backups, f));
        files.sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);

        fs.rmSync(files[0]);
    }
}

function ensurePublicDirectoriesExist() {
    for (const dir of Object.values(DIRECTORIES)) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}
