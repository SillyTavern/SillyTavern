#!/usr/bin/env node

createDefaultFiles();

function createDefaultFiles() {
    const fs = require('fs');
    const path = require('path');
    const files = {
        settings: 'public/settings.json',
        bg_load: 'public/css/bg_load.css',
        config: 'config.conf',
    };

    for (const file of Object.values(files)) {
        try {
            if (!fs.existsSync(file)) {
                const defaultFilePath = path.join('default', path.parse(file).base);
                fs.copyFileSync(defaultFilePath, file);
                console.log(`Created default file: ${file}`);
            }
        } catch (error) {
            console.error(`FATAL: Could not write default file: ${file}`, error);
        }
    }
}

const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');
const net = require("net");
// work around a node v20 bug: https://github.com/nodejs/node/issues/47822#issuecomment-1564708870
if (net.setDefaultAutoSelectFamily) {
    net.setDefaultAutoSelectFamily(false);
}

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
    }).argv;

// change all relative paths
const path = require('path');
const directory = process.pkg ? path.dirname(process.execPath) : __dirname;
console.log(process.pkg ? 'Running from binary' : 'Running from source');
process.chdir(directory);

const express = require('express');
const compression = require('compression');
const app = express();
const responseTime = require('response-time');
const simpleGit = require('simple-git');

app.use(compression());
app.use(responseTime());

const fs = require('fs');
const writeFileAtomicSync = require('write-file-atomic').sync;
const readline = require('readline');
const open = require('open');

const multer = require("multer");
const http = require("http");
const https = require('https');
const basicAuthMiddleware = require('./src/middleware/basicAuthMiddleware');
const contentManager = require('./src/content-manager');
const extract = require('png-chunks-extract');
const encode = require('png-chunks-encode');
const PNGtext = require('png-chunk-text');

const jimp = require('jimp');
const sanitize = require('sanitize-filename');
const mime = require('mime-types');

const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const ipaddr = require('ipaddr.js');
const json5 = require('json5');

const exif = require('piexifjs');
const webp = require('webp-converter');
const DeviceDetector = require("device-detector-js");
const { TextEncoder, TextDecoder } = require('util');
const utf8Encode = new TextEncoder();
const commandExistsSync = require('command-exists').sync;

// impoort from statsHelpers.js
const statsHelpers = require('./statsHelpers.js');

const characterCardParser = require('./src/character-card-parser.js');
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
const allowKeysExposure = config.allowKeysExposure;

const axios = require('axios');
const tiktoken = require('@dqbd/tiktoken');
const WebSocket = require('ws');

function getHordeClient() {
    const AIHorde = require("./src/horde");
    const ai_horde = new AIHorde({
        client_agent: getVersion()?.agent || 'SillyTavern:UNKNOWN:Cohee#1207',
    });
    return ai_horde;
}

const ipMatching = require('ip-matching');
const yauzl = require('yauzl');

const Client = require('node-rest-client').Client;
const client = new Client();

client.on('error', (err) => {
    console.error('An error occurred:', err);
});

let api_server = "http://0.0.0.0:5000";
let api_novelai = "https://api.novelai.net";
let api_openai = "https://api.openai.com/v1";
let api_claude = "https://api.anthropic.com/v1";
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

function get_mancer_headers() {
    const api_key_mancer = readSecret(SECRET_KEYS.MANCER);
    return api_key_mancer ? { "X-API-KEY": api_key_mancer } : {};
}



//RossAscends: Added function to format dates used in files and chat timestamps to a humanized format.
//Mostly I wanted this to be for file names, but couldn't figure out exactly where the filename save code was as everything seemed to be connected.
//During testing, this performs the same as previous date.now() structure.
//It also does not break old characters/chats, as the code just uses whatever timestamp exists in the chat.
//New chats made with characters will use this new formatting.
//Useable variable is (( humanizedISO8601Datetime ))

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

const { SentencePieceProcessor } = require("@agnai/sentencepiece-js");
const { Tokenizer } = require('@agnai/web-tokenizers');
const CHARS_PER_TOKEN = 3.35;

let spp_llama;
let spp_nerd;
let spp_nerd_v2;
let claude_tokenizer;

async function loadSentencepieceTokenizer(modelPath) {
    try {
        const spp = new SentencePieceProcessor();
        await spp.load(modelPath);
        return spp;
    } catch (error) {
        console.error("Sentencepiece tokenizer failed to load: " + modelPath, error);
        return null;
    }
};

async function countSentencepieceTokens(spp, text) {
    // Fallback to strlen estimation
    if (!spp) {
        return {
            ids: [],
            count: Math.ceil(text.length / CHARS_PER_TOKEN)
        };
    }

    let cleaned = text; // cleanText(text); <-- cleaning text can result in an incorrect tokenization

    let ids = spp.encodeIds(cleaned);
    return {
        ids,
        count: ids.length
    };
}

async function loadClaudeTokenizer(modelPath) {
    try {
        const arrayBuffer = fs.readFileSync(modelPath).buffer;
        const instance = await Tokenizer.fromJSON(arrayBuffer);
        return instance;
    } catch (error) {
        console.error("Claude tokenizer failed to load: " + modelPath, error);
        return null;
    }
}

function countClaudeTokens(tokenizer, messages) {
    const convertedPrompt = convertClaudePrompt(messages, false, false);

    // Fallback to strlen estimation
    if (!tokenizer) {
        return Math.ceil(convertedPrompt.length / CHARS_PER_TOKEN);
    }

    const count = tokenizer.encode(convertedPrompt).length;
    return count;
}

const tokenizersCache = {};

function getTokenizerModel(requestModel) {
    if (requestModel.includes('claude')) {
        return 'claude';
    }

    if (requestModel.includes('gpt-4-32k')) {
        return 'gpt-4-32k';
    }

    if (requestModel.includes('gpt-4')) {
        return 'gpt-4';
    }

    if (requestModel.includes('gpt-3.5-turbo')) {
        return 'gpt-3.5-turbo';
    }

    if (requestModel.startsWith('text-') || requestModel.startsWith('code-')) {
        return requestModel;
    }

    // default
    return 'gpt-3.5-turbo';
}

function getTiktokenTokenizer(model) {
    if (tokenizersCache[model]) {
        return tokenizersCache[model];
    }

    const tokenizer = tiktoken.encoding_for_model(model);
    console.log('Instantiated the tokenizer for', model);
    tokenizersCache[model] = tokenizer;
    return tokenizer;
}

function humanizedISO8601DateTime() {
    let baseDate = new Date(Date.now());
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

var is_colab = process.env.colaburl !== undefined;
var charactersPath = 'public/characters/';
var chatsPath = 'public/chats/';
const UPLOADS_PATH = './uploads';
const AVATAR_WIDTH = 400;
const AVATAR_HEIGHT = 600;
const jsonParser = express.json({ limit: '100mb' });
const urlencodedParser = express.urlencoded({ extended: true, limit: '100mb' });
const baseRequestArgs = { headers: { "Content-Type": "application/json" } };
const directories = {
    worlds: 'public/worlds/',
    avatars: 'public/User Avatars',
    images: 'public/img/',
    userImages: 'public/user/images/',
    groups: 'public/groups/',
    groupChats: 'public/group chats',
    chats: 'public/chats/',
    characters: 'public/characters/',
    backgrounds: 'public/backgrounds',
    novelAI_Settings: 'public/NovelAI Settings',
    koboldAI_Settings: 'public/KoboldAI Settings',
    openAI_Settings: 'public/OpenAI Settings',
    textGen_Settings: 'public/TextGen Settings',
    thumbnails: 'thumbnails/',
    thumbnailsBg: 'thumbnails/bg/',
    thumbnailsAvatar: 'thumbnails/avatar/',
    themes: 'public/themes',
    movingUI: 'public/movingUI',
    extensions: 'public/scripts/extensions',
    instruct: 'public/instruct',
    context: 'public/context',
    backups: 'backups/',
    quickreplies: 'public/QuickReplies',
    assets: 'public/assets',
};

// CSRF Protection //
if (cliArguments.disableCsrf === false) {
    const doubleCsrf = require('csrf-csrf').doubleCsrf;

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
            "token": generateToken(res)
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
const cors = require('cors');
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
    if (ip.kind() === 'ipv6' && ip.isIPv4MappedAddress()) {
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


app.use(express.static(process.cwd() + "/public", { refresh: true }));

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
    const deviceInfo = deviceDetector.parse(userAgent);
    return response.send(deviceInfo);
});
app.get('/version', function (_, response) {
    const data = getVersion();
    response.send(data);
})

//**************Kobold api
app.post("/generate", jsonParser, async function (request, response_generate = response) {
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
        singleline: !!request.body.singleline,
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
            typical: request.body.typical,
            sampler_order: sampler_order,
            singleline: !!request.body.singleline,
        };
        if (!!request.body.stop_sequence) {
            this_settings['stop_sequence'] = request.body.stop_sequence;
        }
    }

    console.log(this_settings);
    const args = {
        body: JSON.stringify(this_settings),
        headers: { "Content-Type": "application/json" },
        signal: controller.signal,
    };

    const MAX_RETRIES = 50;
    const delayAmount = 2500;
    let fetch, url, response;
    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            fetch = require('node-fetch').default;
            url = request.body.streaming ? `${api_server}/extra/generate/stream` : `${api_server}/v1/generate`;
            response = await fetch(url, { method: 'POST', timeout: 0, ...args });

            if (request.body.streaming) {
                request.socket.on('close', function () {
                    response.body.destroy(); // Close the remote stream
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
app.post("/generate_textgenerationwebui", jsonParser, async function (request, response_generate = response) {
    if (!request.body) return response_generate.sendStatus(400);

    console.log(request.body);

    const controller = new AbortController();
    let isGenerationStopped = false;
    request.socket.removeAllListeners('close');
    request.socket.on('close', function () {
        isGenerationStopped = true;
        controller.abort();
    });

    if (request.header('X-Response-Streaming')) {
        response_generate.writeHead(200, {
            'Content-Type': 'text/plain;charset=utf-8',
            'Transfer-Encoding': 'chunked',
            'Cache-Control': 'no-transform',
        });

        async function* readWebsocket() {
            const streamingUrl = request.header('X-Streaming-URL').replace("localhost", "127.0.0.1");
            const websocket = new WebSocket(streamingUrl);

            websocket.on('open', async function () {
                console.log('WebSocket opened');
                const combined_args = Object.assign(request.body.use_mancer ? get_mancer_headers() : {}, request.body);
                websocket.send(JSON.stringify(combined_args));
            });

            websocket.on('close', (code, buffer) => {
                const reason = new TextDecoder().decode(buffer)
                console.log("WebSocket closed (reason: %o)", reason);
            });

            while (true) {
                if (isGenerationStopped) {
                    console.error('Streaming stopped by user. Closing websocket...');
                    websocket.close();
                    return;
                }

                let rawMessage = null;
                try {
                    // This lunacy is because the websocket can fail to connect AFTER we're awaiting 'message'... so 'message' never triggers.
                    // So instead we need to look for 'error' at the same time to reject the promise. And then remove the listener if we resolve.
                    // This is awful.
                    // Welcome to the shenanigan shack.
                    rawMessage = await new Promise(function (resolve, reject) {
                        websocket.once('error', reject);
                        websocket.once('message', (data, isBinary) => {
                            websocket.removeListener('error', reject);
                            resolve(data, isBinary);
                        });
                    });
                } catch (err) {
                    console.error("Socket error:", err);
                    websocket.close();
                    yield "[SillyTavern] Streaming failed:\n" + err;
                    return;
                }

                const message = json5.parse(rawMessage);

                switch (message.event) {
                    case 'text_stream':
                        yield message.text;
                        break;
                    case 'stream_end':
                        websocket.close();
                        return;
                }
            }
        }

        let reply = '';

        try {
            for await (const text of readWebsocket()) {
                if (typeof text !== 'string') {
                    break;
                }

                let newText = text;

                if (!newText) {
                    continue;
                }

                reply += text;
                response_generate.write(newText);
            }

            console.log(reply);
        }
        finally {
            response_generate.end();
        }
    }
    else {
        const args = {
            body: JSON.stringify(request.body),
            headers: { "Content-Type": "application/json" },
            signal: controller.signal,
        };

        if (request.body.use_mancer) {
            args.headers = Object.assign(args.headers, get_mancer_headers());
        }

        try {
            const data = await postAsync(api_server + "/v1/generate", args);
            console.log("Endpoint response:", data);
            return response_generate.send(data);
        } catch (error) {
            retval = { error: true, status: error.status, response: error.statusText };
            console.log("Endpoint error:", error);
            try {
                retval.response = await error.json();
                retval.response = retval.response.result;
            } catch { }
            return response_generate.send(retval);
        }
    }
});


app.post("/savechat", jsonParser, function (request, response) {
    try {
        var dir_name = String(request.body.avatar_url).replace('.png', '');
        let chat_data = request.body.chat;
        let jsonlData = chat_data.map(JSON.stringify).join('\n');
        writeFileAtomicSync(`${chatsPath + sanitize(dir_name)}/${sanitize(String(request.body.file_name))}.jsonl`, jsonlData, 'utf8');
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
        const jsonData = lines.map(tryParse).filter(x => x);
        return response.send(jsonData);
    } catch (error) {
        console.error(error);
        return response.send({});
    }
});

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

    if (main_api == 'textgenerationwebui' && request.body.use_mancer) {
        args.headers = Object.assign(args.headers, get_mancer_headers());
    }

    const url = api_server + "/v1/model";
    let version = '';
    let koboldVersion = {};

    if (main_api == "kobold") {
        try {
            version = (await getAsync(api_server + "/v1/info/version")).result;
        }
        catch {
            version = '0.0.0';
        }
        try {
            koboldVersion = (await getAsync(api_server + "/extra/version"));
        }
        catch {
            koboldVersion = {
                result: 'Kobold',
                version: '0.0',
            };
        }
    }

    try {
        let data = await getAsync(url, args);

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

function getVersion() {
    let pkgVersion = 'UNKNOWN';
    let gitRevision = null;
    let gitBranch = null;
    try {
        const pkgJson = require('./package.json');
        pkgVersion = pkgJson.version;
        if (!process.pkg && commandExistsSync('git')) {
            gitRevision = require('child_process')
                .execSync('git rev-parse --short HEAD', { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'ignore'] })
                .toString().trim();

            gitBranch = require('child_process')
                .execSync('git rev-parse --abbrev-ref HEAD', { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'ignore'] })
                .toString().trim();
        }
    }
    catch {
        // suppress exception
    }

    const agent = `SillyTavern:${pkgVersion}:Cohee#1207`;
    return { agent, pkgVersion, gitRevision, gitBranch };
}

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
    });

    result.chat = char.chat ?? humanizedISO8601DateTime();
    result.create_date = char.create_date;
    return result;
}


function unsetFavFlag(char) {
    const _ = require('lodash');
    _.set(char, 'fav', false);
    _.set(char, 'data.extensions.fav', false);
}

function readFromV2(char) {
    const _ = require('lodash');
    if (_.isUndefined(char.data)) {
        console.warn('Spec v2 data missing');
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
                console.debug(`Spec v2 data missing for unknown field: ${charField}`);
                return;
            }
        }
        if (!_.isUndefined(char[charField]) && !_.isUndefined(v2Value) && String(char[charField]) !== String(v2Value)) {
            console.debug(`Spec v2 data mismatch with Spec v1 for field: ${charField}`, char[charField], v2Value);
        }
        char[charField] = v2Value;
    });

    char['chat'] = char['chat'] ?? humanizedISO8601DateTime();

    return char;
}

//***************** Main functions
function charaFormatData(data) {
    // This is supposed to save all the foreign keys that ST doesn't care about
    const _ = require('lodash');
    const char = tryParse(data.json_data) || {};

    // This function uses _.cond() to create a series of conditional checks that return the desired output based on the input data.
    // It checks if data.alternate_greetings is an array, a string, or neither, and acts accordingly.
    const getAlternateGreetings = data => _.cond([
        [d => Array.isArray(d.alternate_greetings), d => d.alternate_greetings],
        [d => typeof d.alternate_greetings === 'string', d => [d.alternate_greetings]],
        [_.stubTrue, _.constant([])]
    ])(data);

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
    _.set(char, 'create_date', humanizedISO8601DateTime());

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
    const chatsPath = directories.chats + internalName; //path.join(chatsPath, internalName);

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
        ? directories.groupChats
        : path.join(directories.chats, String(request.body.avatar_url).replace('.png', ''));
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
        const _ = require('lodash');
        // Read old file, replace name int it
        const rawOldData = await charaRead(oldAvatarPath);
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
        charaRead(avatarPath).then((char) => {
            char = JSON.parse(char);
            //check if the field exists
            if (char[request.body.field] === undefined && char.data[request.body.field] === undefined) {
                console.error('Error: invalid field.');
                response.status(400).send('Error: invalid field.');
                return;
            }
            char[request.body.field] = request.body.value;
            char.data[request.body.field] = request.body.value;
            char = JSON.stringify(char);
            return { char };
        }).then(({ char }) => {
            charaWrite(avatarPath, char, (request.body.avatar_url).replace('.png', ''), response, 'Character saved');
        }).catch((err) => {
            console.error('An error occured, character edit invalidated.', err);
        });
    }
    catch {
        console.error('An error occured, character edit invalidated.');
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

async function charaWrite(img_url, data, target_img, response = undefined, mes = 'ok', crop = undefined) {
    try {
        // Read the image, resize, and save it as a PNG into the buffer
        const image = await tryReadImage(img_url, crop);

        // Get the chunks
        const chunks = extract(image);
        const tEXtChunks = chunks.filter(chunk => chunk.create_date === 'tEXt' || chunk.name === 'tEXt');

        // Remove all existing tEXt chunks
        for (let tEXtChunk of tEXtChunks) {
            chunks.splice(chunks.indexOf(tEXtChunk), 1);
        }
        // Add new chunks before the IEND chunk
        const base64EncodedData = Buffer.from(data, 'utf8').toString('base64');
        chunks.splice(-1, 0, PNGtext.encode('chara', base64EncodedData));
        //chunks.splice(-1, 0, text.encode('lorem', 'ipsum'));

        writeFileAtomicSync(charactersPath + target_img + '.png', new Buffer.from(encode(chunks)));
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
 * @return {number}         The total chat size.
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
        let jsonObject = getCharaCardV2(json5.parse(img_data));
        jsonObject.avatar = item;
        characters[i] = jsonObject;
        characters[i]['json_data'] = img_data;
        const charStat = fs.statSync(path.join(charactersPath, item));
        characters[i]['date_added'] = charStat.birthtimeMs;
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
app.post("/iscolab", jsonParser, function (request, response) {
    let send_data = false;
    if (is_colab) {
        send_data = String(process.env.colaburl).trim();
    }
    response.send({ colaburl: send_data });

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

    const fileName = path.join(directories.avatars, sanitize(request.body.avatar));

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

    const oldFileName = path.join('public/backgrounds/', sanitize(request.body.old_bg));
    const newFileName = path.join('public/backgrounds/', sanitize(request.body.new_bg));

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
    return (a, b) => new Date(fs.statSync(`${directory}/${b}`).mtime) - new Date(fs.statSync(`${directory}/${a}`).mtime);
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
    const settings = fs.readFileSync('public/settings.json', 'utf8', (err, data) => {
        if (err) return response.sendStatus(500);

        return data;
    });

    // NovelAI Settings
    const { fileContents: novelai_settings, fileNames: novelai_setting_names }
        = readPresetsFromDirectory(directories.novelAI_Settings, {
            sortFunction: sortByName(directories.novelAI_Settings),
            removeFileExtension: true
        });

    // OpenAI Settings
    const { fileContents: openai_settings, fileNames: openai_setting_names }
        = readPresetsFromDirectory(directories.openAI_Settings, {
            sortFunction: sortByModifiedDate(directories.openAI_Settings), removeFileExtension: true
        });

    // TextGenerationWebUI Settings
    const { fileContents: textgenerationwebui_presets, fileNames: textgenerationwebui_preset_names }
        = readPresetsFromDirectory(directories.textGen_Settings, {
            sortFunction: sortByName(directories.textGen_Settings), removeFileExtension: true
        });

    //Kobold
    const { fileContents: koboldai_settings, fileNames: koboldai_setting_names }
        = readPresetsFromDirectory(directories.koboldAI_Settings, {
            sortFunction: sortByName(directories.koboldAI_Settings), removeFileExtension: true
        })

    const worldFiles = fs
        .readdirSync(directories.worlds)
        .filter(file => path.extname(file).toLowerCase() === '.json')
        .sort((a, b) => a < b);
    const world_names = worldFiles.map(item => path.parse(item).name);

    const themes = readAndParseFromDirectory(directories.themes);
    const movingUIPresets = readAndParseFromDirectory(directories.movingUI);
    const quickReplyPresets = readAndParseFromDirectory(directories.quickreplies);

    const instruct = readAndParseFromDirectory(directories.instruct);
    const context = readAndParseFromDirectory(directories.context);

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
    const pathToWorldInfo = path.join(directories.worlds, filename);

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

    const filename = path.join(directories.themes, sanitize(request.body.name) + '.json');
    writeFileAtomicSync(filename, JSON.stringify(request.body, null, 4), 'utf8');

    return response.sendStatus(200);
});

app.post('/savemovingui', jsonParser, (request, response) => {
    if (!request.body || !request.body.name) {
        return response.sendStatus(400);
    }

    const filename = path.join(directories.movingUI, sanitize(request.body.name) + '.json');
    writeFileAtomicSync(filename, JSON.stringify(request.body, null, 4), 'utf8');

    return response.sendStatus(200);
});

app.post('/savequickreply', jsonParser, (request, response) => {
    if (!request.body || !request.body.name) {
        return response.sendStatus(400);
    }

    const filename = path.join(directories.quickreplies, sanitize(request.body.name) + '.json');
    writeFileAtomicSync(filename, JSON.stringify(request.body, null, 4), 'utf8');

    return response.sendStatus(200);
});

function convertWorldInfoToCharacterBook(name, entries) {
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
            }
        };

        result.entries.push(originalEntry);
    }

    return result;
}

function readWorldInfoFile(worldInfoName) {
    if (!worldInfoName) {
        return { entries: {} };
    }

    const filename = `${worldInfoName}.json`;
    const pathToWorldInfo = path.join(directories.worlds, filename);

    if (!fs.existsSync(pathToWorldInfo)) {
        throw new Error(`World info file ${filename} doesn't exist.`);
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

//***********Novel.ai API

app.post("/getstatus_novelai", jsonParser, function (request, response_getstatus_novel = response) {

    if (!request.body) return response_getstatus_novel.sendStatus(400);
    const api_key_novel = readSecret(SECRET_KEYS.NOVEL);

    if (!api_key_novel) {
        return response_getstatus_novel.sendStatus(401);
    }

    var data = {};
    var args = {
        data: data,
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + api_key_novel }
    };
    client.get(api_novelai + "/user/subscription", args, function (data, response) {
        if (response.statusCode == 200) {
            //console.log(data);
            response_getstatus_novel.send(data);//data);
        }
        else {
            if (response.statusCode == 401) {
                console.log('Access Token is incorrect.');
            }

            console.log(data);
            response_getstatus_novel.send({ error: true });
        }
    }).on('error', function () {
        response_getstatus_novel.send({ error: true });
    });
});

app.post("/generate_novelai", jsonParser, async function (request, response_generate_novel = response) {
    if (!request.body) return response_generate_novel.sendStatus(400);

    const api_key_novel = readSecret(SECRET_KEYS.NOVEL);

    if (!api_key_novel) {
        return response_generate_novel.sendStatus(401);
    }

    const controller = new AbortController();
    request.socket.removeAllListeners('close');
    request.socket.on('close', function () {
        controller.abort();
    });

    const novelai = require('./src/novelai');
    const isNewModel = (request.body.model.includes('clio') || request.body.model.includes('kayra'));
    const badWordsList = novelai.getBadWordsList(request.body.model);

    // Add customized bad words for Clio and Kayra
    if (isNewModel && Array.isArray(request.body.bad_words_ids)) {
        for (const badWord of request.body.bad_words_ids) {
            if (Array.isArray(badWord) && badWord.every(x => Number.isInteger(x))) {
                badWordsList.push(badWord);
            }
        }
    }

    // Add default biases for dinkus and asterism
    const logit_bias_exp = isNewModel ? novelai.logitBiasExp.slice() : [];

    if (Array.isArray(logit_bias_exp) && Array.isArray(request.body.logit_bias_exp)) {
        logit_bias_exp.push(...request.body.logit_bias_exp);
    }

    const data = {
        "input": request.body.input,
        "model": request.body.model,
        "parameters": {
            "use_string": request.body.use_string,
            "temperature": request.body.temperature,
            "max_length": request.body.max_length,
            "min_length": request.body.min_length,
            "tail_free_sampling": request.body.tail_free_sampling,
            "repetition_penalty": request.body.repetition_penalty,
            "repetition_penalty_range": request.body.repetition_penalty_range,
            "repetition_penalty_slope": request.body.repetition_penalty_slope,
            "repetition_penalty_frequency": request.body.repetition_penalty_frequency,
            "repetition_penalty_presence": request.body.repetition_penalty_presence,
            "repetition_penalty_whitelist": isNewModel ? novelai.repPenaltyAllowList : null,
            "top_a": request.body.top_a,
            "top_p": request.body.top_p,
            "top_k": request.body.top_k,
            "typical_p": request.body.typical_p,
            "mirostat_lr": request.body.mirostat_lr,
            "mirostat_tau": request.body.mirostat_tau,
            "cfg_scale": request.body.cfg_scale,
            "cfg_uc": request.body.cfg_uc,
            "phrase_rep_pen": request.body.phrase_rep_pen,
            "stop_sequences": request.body.stop_sequences,
            "bad_words_ids": badWordsList,
            "logit_bias_exp": logit_bias_exp,
            "generate_until_sentence": request.body.generate_until_sentence,
            "use_cache": request.body.use_cache,
            "use_string": request.body.use_string ?? true,
            "return_full_text": request.body.return_full_text,
            "prefix": request.body.prefix,
            "order": request.body.order
        }
    };
    const util = require('util');
    console.log(util.inspect(data, { depth: 4 }))

    const args = {
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + api_key_novel },
        signal: controller.signal,
    };

    try {
        const fetch = require('node-fetch').default;
        const url = request.body.streaming ? `${api_novelai}/ai/generate-stream` : `${api_novelai}/ai/generate`;
        const response = await fetch(url, { method: 'POST', timeout: 0, ...args });

        if (request.body.streaming) {
            // Pipe remote SSE stream to Express response
            response.body.pipe(response_generate_novel);

            request.socket.on('close', function () {
                response.body.destroy(); // Close the remote stream
                response_generate_novel.end(); // End the Express response
            });

            response.body.on('end', function () {
                console.log("Streaming request finished");
                response_generate_novel.end();
            });
        } else {
            if (!response.ok) {
                const text = await response.text();
                let message = text;
                console.log(`Novel API returned error: ${response.status} ${response.statusText} ${text}`);

                try {
                    const data = JSON.parse(text);
                    message = data.message;
                }
                catch {
                    // ignore
                }

                return response_generate_novel.status(response.status).send({ error: { message } });
            }

            const data = await response.json();
            console.log(data);
            return response_generate_novel.send(data);
        }
    } catch (error) {
        return response_generate_novel.send({ error: true });
    }
});

app.post("/getallchatsofcharacter", jsonParser, function (request, response) {
    if (!request.body) return response.sendStatus(400);

    var char_dir = (request.body.avatar_url).replace('.png', '')
    fs.readdir(chatsPath + char_dir, (err, files) => {
        if (err) {
            console.log('found error in history loading');
            console.error(err);
            response.send({ error: true });
            return;
        }

        // filter for JSON files
        const jsonFiles = files.filter(file => path.extname(file) === '.jsonl');

        // sort the files by name
        //jsonFiles.sort().reverse();
        // print the sorted file names
        var chatData = {};
        let ii = jsonFiles.length;	//this is the number of files belonging to the character
        if (ii !== 0) {
            //console.log('found '+ii+' chat logs to load');
            for (let i = jsonFiles.length - 1; i >= 0; i--) {
                const file = jsonFiles[i];
                const fileStream = fs.createReadStream(chatsPath + char_dir + '/' + file);

                const fullPathAndFile = chatsPath + char_dir + '/' + file
                const stats = fs.statSync(fullPathAndFile);
                const fileSizeInKB = (stats.size / 1024).toFixed(2) + "kb";

                //console.log(fileSizeInKB);

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
                    ii--;
                    if (lastLine) {

                        let jsonData = tryParse(lastLine);
                        if (jsonData && (jsonData.name !== undefined || jsonData.character_name !== undefined)) {
                            chatData[i] = {};
                            chatData[i]['file_name'] = file;
                            chatData[i]['file_size'] = fileSizeInKB;
                            chatData[i]['chat_items'] = itemCounter - 1;
                            chatData[i]['mes'] = jsonData['mes'] || '[The chat is empty]';
                            chatData[i]['last_mes'] = jsonData['send_date'] || Date.now();
                        } else {
                            console.log('Found an invalid or corrupted chat file: ' + fullPathAndFile);
                        }
                    }
                    if (ii === 0) {
                        //console.log('ii count went to zero, responding with chatData');
                        response.send(chatData);
                    }
                    //console.log('successfully closing getallchatsofcharacter');
                    rl.close();
                });
            };
        } else {
            //console.log('Found No Chats. Exiting Load Routine.');
            response.send({ error: true });
        };
    })
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

    if (!request.body) return response.sendStatus(400);

    let png_name = '';
    let filedata = request.file;
    let uploadPath = path.join(UPLOADS_PATH, filedata.filename);
    var format = request.body.file_type;
    const defaultAvatarPath = './public/img/ai4.png';
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
                    char = JSON.stringify(char);
                    charaWrite(defaultAvatarPath, char, png_name, response, { file_name: png_name });
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
                    char = JSON.stringify(char);
                    charaWrite(defaultAvatarPath, char, png_name, response, { file_name: png_name });
                } else {
                    console.log('Incorrect character format .json');
                    response.send({ error: true });
                }
            });
        } else {
            try {
                var img_data = await charaRead(uploadPath, format);
                let jsonData = json5.parse(img_data);

                jsonData.name = sanitize(jsonData.data?.name || jsonData.name);
                png_name = getPngName(jsonData.name);

                if (format == 'webp') {
                    try {
                        let convertedPath = path.join(UPLOADS_PATH, path.basename(uploadPath, ".webp") + ".png")
                        await webp.dwebp(uploadPath, convertedPath, "-o");
                        fs.unlinkSync(uploadPath);
                        uploadPath = convertedPath;
                    }
                    catch {
                        console.error('WEBP image conversion failed. Using the default character image.');
                        uploadPath = defaultAvatarPath;
                    }
                }

                if (jsonData.spec !== undefined) {
                    console.log('Found a v2 character file.');
                    importRisuSprites(jsonData);
                    unsetFavFlag(jsonData);
                    jsonData = readFromV2(jsonData);
                    let char = JSON.stringify(jsonData);
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
                    char = JSON.stringify(char);
                    await charaWrite(uploadPath, char, png_name, response, { file_name: png_name });
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
        let filename = path.join(directories.characters, sanitize(request.body.avatar_url));
        if (!fs.existsSync(filename)) {
            console.log('file for dupe not found');
            console.log(filename);
            return response.sendStatus(404);
        }
        let suffix = 1;
        let newFilename = filename;
        while (fs.existsSync(newFilename)) {
            let suffixStr = "_" + suffix;
            let ext = path.extname(filename);
            newFilename = filename.slice(0, -ext.length) + suffixStr + ext;
            suffix++;
        }
        fs.copyFile(filename, newFilename, (err) => {
            if (err) throw err;
            console.log(`${filename} was copied to ${newFilename}`);
            response.sendStatus(200);
        });
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
        ? directories.groupChats
        : path.join(directories.chats, String(request.body.avatar_url).replace('.png', ''));
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

        const readline = require('readline');
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

    let filename = path.join(directories.characters, sanitize(request.body.avatar_url));

    if (!fs.existsSync(filename)) {
        return response.sendStatus(404);
    }

    switch (request.body.format) {
        case 'png':
            return response.sendFile(filename, { root: process.cwd() });
        case 'json': {
            try {
                let json = await charaRead(filename);
                let jsonObject = getCharaCardV2(json5.parse(json));
                return response.type('json').send(jsonObject)
            }
            catch {
                return response.sendStatus(400);
            }
        }
        case 'webp': {
            try {
                let json = await charaRead(filename);
                let stringByteArray = utf8Encode.encode(json).toString();
                let inputWebpPath = path.join(UPLOADS_PATH, `${Date.now()}_input.webp`);
                let outputWebpPath = path.join(UPLOADS_PATH, `${Date.now()}_output.webp`);
                let metadataPath = path.join(UPLOADS_PATH, `${Date.now()}_metadata.exif`);
                let metadata =
                {
                    "Exif": {
                        [exif.ExifIFD.UserComment]: stringByteArray,
                    },
                };
                const exifString = exif.dump(metadata);
                writeFileAtomicSync(metadataPath, exifString, 'binary');

                await webp.cwebp(filename, inputWebpPath, '-q 95');
                await webp.webpmux_add(inputWebpPath, outputWebpPath, metadataPath, 'exif');

                response.sendFile(outputWebpPath, { root: process.cwd() }, () => {
                    fs.rmSync(inputWebpPath);
                    fs.rmSync(metadataPath);
                    fs.rmSync(outputWebpPath);
                });

                return;
            }
            catch (err) {
                console.log(err);
                return response.sendStatus(400);
            }
        }
    }

    return response.sendStatus(400);
});

app.post("/importgroupchat", urlencodedParser, function (request, response) {
    try {
        const filedata = request.file;
        const chatname = humanizedISO8601DateTime();
        const pathToUpload = path.join(UPLOADS_PATH, filedata.filename);
        const pathToNewFile = path.join(directories.groupChats, `${chatname}.jsonl`);
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

    if (filedata) {
        if (format === 'json') {
            fs.readFile(path.join(UPLOADS_PATH, filedata.filename), 'utf8', (err, data) => {

                if (err) {
                    console.log(err);
                    response.send({ error: true });
                }

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
                                        is_name: true,
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
                                is_name: true,
                                send_date: humanizedISO8601DateTime(),
                                mes: arr[0],
                            };
                            chat.push(userMessage);
                        }
                        if (arr[1]) {
                            const charMessage = {
                                name: ch_name,
                                is_user: false,
                                is_name: true,
                                send_date: humanizedISO8601DateTime(),
                                mes: arr[1],
                            };
                            chat.push(charMessage);
                        }
                    }

                    writeFileAtomicSync(`${chatsPath + avatar_url}/${ch_name} - ${humanizedISO8601DateTime()} imported.jsonl`, chat.map(JSON.stringify).join('\n'), 'utf8');

                    response.send({ res: true });
                } else {
                    response.send({ error: true });
                }
            });
        }
        if (format === 'jsonl') {
            //console.log(humanizedISO8601DateTime()+':imported chat format is JSONL');
            const fileStream = fs.createReadStream(path.join(UPLOADS_PATH, filedata.filename));
            const rl = readline.createInterface({
                input: fileStream,
                crlfDelay: Infinity
            });

            rl.once('line', (line) => {
                let jsonData = json5.parse(line);

                if (jsonData.user_name !== undefined || jsonData.name !== undefined) {
                    fs.copyFile(path.join(UPLOADS_PATH, filedata.filename), (`${chatsPath + avatar_url}/${ch_name} - ${humanizedISO8601DateTime()}.jsonl`), (err) => {
                        if (err) {
                            response.send({ error: true });
                            return console.log(err);
                        } else {
                            response.send({ res: true });
                            return;
                        }
                    });
                } else {
                    response.send({ error: true });
                    return;
                }
                rl.close();
            });
        }
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

    const pathToNewFile = path.join(directories.worlds, filename);
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
    const pathToFile = path.join(directories.worlds, filename);

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
        const pathToNewFile = path.join(directories.avatars, filename);
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
    const match = request.body.image.match(/^data:image\/(png|jpg|webp);base64,(.+)$/);
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
    let pathToNewFile = path.join(directories.userImages, filename);
    if (request.body.ch_name) {
        pathToNewFile = path.join(directories.userImages, request.body.ch_name, filename);
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


app.post('/getgroups', jsonParser, (_, response) => {
    const groups = [];

    if (!fs.existsSync(directories.groups)) {
        fs.mkdirSync(directories.groups);
    }

    const files = fs.readdirSync(directories.groups).filter(x => path.extname(x) === '.json');
    const chats = fs.readdirSync(directories.groupChats).filter(x => path.extname(x) === '.jsonl');

    files.forEach(function (file) {
        try {
            const filePath = path.join(directories.groups, file);
            const fileContents = fs.readFileSync(filePath, 'utf8');
            const group = json5.parse(fileContents);
            const groupStat = fs.statSync(filePath);
            group['date_added'] = groupStat.birthtimeMs;

            let chat_size = 0;
            let date_last_chat = 0;

            if (Array.isArray(group.chats) && Array.isArray(chats)) {
                for (const chat of chats) {
                    if (group.chats.includes(path.parse(chat).name)) {
                        const chatStat = fs.statSync(path.join(directories.groupChats, chat));
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
        disabled_members: request.body.disabled_members ?? [],
        chat_metadata: request.body.chat_metadata ?? {},
        fav: request.body.fav,
        chat_id: request.body.chat_id ?? id,
        chats: request.body.chats ?? [id],
    };
    const pathToFile = path.join(directories.groups, `${id}.json`);
    const fileData = JSON.stringify(groupMetadata);

    if (!fs.existsSync(directories.groups)) {
        fs.mkdirSync(directories.groups);
    }

    writeFileAtomicSync(pathToFile, fileData);
    return response.send(groupMetadata);
});

app.post('/editgroup', jsonParser, (request, response) => {
    if (!request.body || !request.body.id) {
        return response.sendStatus(400);
    }
    const id = request.body.id;
    const pathToFile = path.join(directories.groups, `${id}.json`);
    const fileData = JSON.stringify(request.body);

    writeFileAtomicSync(pathToFile, fileData);
    return response.send({ ok: true });
});

app.post('/getgroupchat', jsonParser, (request, response) => {
    if (!request.body || !request.body.id) {
        return response.sendStatus(400);
    }

    const id = request.body.id;
    const pathToFile = path.join(directories.groupChats, `${id}.jsonl`);

    if (fs.existsSync(pathToFile)) {
        const data = fs.readFileSync(pathToFile, 'utf8');
        const lines = data.split('\n');

        // Iterate through the array of strings and parse each line as JSON
        const jsonData = lines.map(json5.parse);
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
    const pathToFile = path.join(directories.groupChats, `${id}.jsonl`);

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
    const pathToFile = path.join(directories.groupChats, `${id}.jsonl`);

    if (!fs.existsSync(directories.groupChats)) {
        fs.mkdirSync(directories.groupChats);
    }

    let chat_data = request.body.chat;
    let jsonlData = chat_data.map(JSON.stringify).join('\n');
    writeFileAtomicSync(pathToFile, jsonlData, 'utf8');
    return response.send({ ok: true });
});

app.post('/deletegroup', jsonParser, async (request, response) => {
    if (!request.body || !request.body.id) {
        return response.sendStatus(400);
    }

    const id = request.body.id;
    const pathToGroup = path.join(directories.groups, sanitize(`${id}.json`));

    try {
        // Delete group chats
        const group = json5.parse(fs.readFileSync(pathToGroup));

        if (group && Array.isArray(group.chats)) {
            for (const chat of group.chats) {
                console.log('Deleting group chat', chat);
                const pathToFile = path.join(directories.groupChats, `${id}.jsonl`);

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

/**
 * Discover the extension folders
 * If the folder is called third-party, search for subfolders instead
 */
app.get('/discover_extensions', jsonParser, function (_, response) {

    // get all folders in the extensions folder, except third-party
    const extensions = fs
        .readdirSync(directories.extensions)
        .filter(f => fs.statSync(path.join(directories.extensions, f)).isDirectory())
        .filter(f => f !== 'third-party');

    // get all folders in the third-party folder, if it exists

    if (!fs.existsSync(path.join(directories.extensions, 'third-party'))) {
        return response.send(extensions);
    }

    const thirdPartyExtensions = fs
        .readdirSync(path.join(directories.extensions, 'third-party'))
        .filter(f => fs.statSync(path.join(directories.extensions, 'third-party', f)).isDirectory());

    // add the third-party extensions to the extensions array
    extensions.push(...thirdPartyExtensions.map(f => `third-party/${f}`));
    console.log(extensions);


    return response.send(extensions);
});

app.get('/get_sprites', jsonParser, function (request, response) {
    const name = request.query.name;
    const spritesPath = path.join(directories.characters, name);
    let sprites = [];

    try {
        if (fs.existsSync(spritesPath) && fs.statSync(spritesPath).isDirectory()) {
            sprites = fs.readdirSync(spritesPath)
                .filter(file => {
                    const mimeType = mime.lookup(file);
                    return mimeType && mimeType.startsWith('image/');
                })
                .map((file) => {
                    const pathToSprite = path.join(spritesPath, file);
                    return {
                        label: path.parse(pathToSprite).name.toLowerCase(),
                        path: `/characters/${name}/${file}`,
                    };
                });
        }
    }
    catch (err) {
        console.log(err);
    }
    finally {
        return response.send(sprites);
    }
});

function getThumbnailFolder(type) {
    let thumbnailFolder;

    switch (type) {
        case 'bg':
            thumbnailFolder = directories.thumbnailsBg;
            break;
        case 'avatar':
            thumbnailFolder = directories.thumbnailsAvatar;
            break;
    }

    return thumbnailFolder;
}

function getOriginalFolder(type) {
    let originalFolder;

    switch (type) {
        case 'bg':
            originalFolder = directories.backgrounds;
            break;
        case 'avatar':
            originalFolder = directories.characters;
            break;
    }

    return originalFolder;
}

function invalidateThumbnail(type, file) {
    const folder = getThumbnailFolder(type);
    const pathToThumbnail = path.join(folder, file);

    if (fs.existsSync(pathToThumbnail)) {
        fs.rmSync(pathToThumbnail);
    }
}

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

async function ensureThumbnailCache() {
    const cacheFiles = fs.readdirSync(directories.thumbnailsBg);

    // files exist, all ok
    if (cacheFiles.length) {
        return;
    }

    console.log('Generating thumbnails cache. Please wait...');

    const bgFiles = fs.readdirSync(directories.backgrounds);
    const tasks = [];

    for (const file of bgFiles) {
        tasks.push(generateThumbnail('bg', file));
    }

    await Promise.all(tasks);
    console.log(`Done! Generated: ${bgFiles.length} preview images`);
}

async function generateThumbnail(type, file) {
    const pathToCachedFile = path.join(getThumbnailFolder(type), file);
    const pathToOriginalFile = path.join(getOriginalFolder(type), file);

    const cachedFileExists = fs.existsSync(pathToCachedFile);
    const originalFileExists = fs.existsSync(pathToOriginalFile);

    // to handle cases when original image was updated after thumb creation
    let shouldRegenerate = false;

    if (cachedFileExists && originalFileExists) {
        const originalStat = fs.statSync(pathToOriginalFile);
        const cachedStat = fs.statSync(pathToCachedFile);

        if (originalStat.mtimeMs > cachedStat.ctimeMs) {
            //console.log('Original file changed. Regenerating thumbnail...');
            shouldRegenerate = true;
        }
    }

    if (cachedFileExists && !shouldRegenerate) {
        return pathToCachedFile;
    }

    if (!originalFileExists) {
        return null;
    }

    const imageSizes = { 'bg': [160, 90], 'avatar': [96, 144] };
    const mySize = imageSizes[type];

    try {
        let buffer;

        try {
            const image = await jimp.read(pathToOriginalFile);
            buffer = await image.cover(mySize[0], mySize[1]).quality(95).getBufferAsync(mime.lookup('jpg'));
        }
        catch (inner) {
            console.warn(`Thumbnailer can not process the image: ${pathToOriginalFile}. Using original size`);
            buffer = fs.readFileSync(pathToOriginalFile);
        }

        writeFileAtomicSync(pathToCachedFile, buffer);
    }
    catch (outer) {
        return null;
    }

    return pathToCachedFile;
}

app.get('/thumbnail', jsonParser, async function (request, response) {
    const type = request.query.type;
    const file = sanitize(request.query.file);

    if (!type || !file) {
        return response.sendStatus(400);
    }

    if (!(type == 'bg' || type == 'avatar')) {
        return response.sendStatus(400);
    }

    if (sanitize(file) !== file) {
        console.error('Malicious filename prevented');
        return response.sendStatus(403);
    }

    if (config.disableThumbnails == true) {
        const pathToOriginalFile = path.join(getOriginalFolder(type), file);
        return response.sendFile(pathToOriginalFile, { root: process.cwd() });
    }

    const pathToCachedFile = await generateThumbnail(type, file);

    if (!pathToCachedFile) {
        return response.sendStatus(404);
    }

    return response.sendFile(pathToCachedFile, { root: process.cwd() });
});

/* OpenAI */
app.post("/getstatus_openai", jsonParser, function (request, response_getstatus_openai = response) {
    if (!request.body) return response_getstatus_openai.sendStatus(400);

    let api_url;
    let api_key_openai;
    let headers;

    if (request.body.use_openrouter == false) {
        api_url = new URL(request.body.reverse_proxy || api_openai).toString();
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

    const args = {
        headers: {
            "Authorization": "Bearer " + api_key_openai,
            ...headers,
        },
    };
    client.get(api_url + "/models", args, function (data, response) {
        if (response.statusCode == 200) {
            response_getstatus_openai.send(data);
            if (request.body.use_openrouter) {
                let models = [];
                data.data.forEach(model => {
                    const context_length = model.context_length;
                    const tokens_dollar = parseFloat(1 / (1000 * model.pricing.prompt));
                    const tokens_rounded = (Math.round(tokens_dollar * 1000) / 1000).toFixed(0);
                    models[model.id] = {
                        tokens_per_dollar: tokens_rounded + 'k',
                        context_length: context_length,
                    };
                });
                console.log('Available OpenRouter models:', models);
            } else {
                const modelIds = data?.data?.map(x => x.id)?.sort();
                console.log('Available OpenAI models:', modelIds);
            }
        }
        if (response.statusCode == 401) {
            console.log('Access Token is incorrect.');
            response_getstatus_openai.send({ error: true });
        }
        if (response.statusCode == 404) {
            console.log('Endpoint not found.');
            response_getstatus_openai.send({ error: true });
        }
        if (response.statusCode == 500 || response.statusCode == 501 || response.statusCode == 501 || response.statusCode == 503 || response.statusCode == 507) {
            console.log(data);
            response_getstatus_openai.send({ error: true });
        }
    }).on('error', function () {
        response_getstatus_openai.send({ error: true });
    });
});

app.post("/openai_bias", jsonParser, async function (request, response) {
    if (!request.body || !Array.isArray(request.body))
        return response.sendStatus(400);

    let result = {};

    const model = getTokenizerModel(String(request.query.model || ''));

    // no bias for claude
    if (model == 'claude') {
        return response.send(result);
    }

    const tokenizer = getTiktokenTokenizer(model);

    for (const entry of request.body) {
        if (!entry || !entry.text) {
            continue;
        }

        try {
            const tokens = tokenizer.encode(entry.text);

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
});

app.post("/deletepreset_openai", jsonParser, function (request, response) {
    if (!request.body || !request.body.name) {
        return response.sendStatus(400);
    }

    const name = request.body.name;
    const pathToFile = path.join(directories.openAI_Settings, `${name}.settings`);

    if (fs.existsSync(pathToFile)) {
        fs.rmSync(pathToFile);
        return response.send({ ok: true });
    }

    return response.send({ error: true });
});

function convertChatMLPrompt(messages) {
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
    return messageStrings.join("\n");
}

// Prompt Conversion script taken from RisuAI by @kwaroran (GPLv3).
function convertClaudePrompt(messages, addHumanPrefix, addAssistantPostfix) {
    // Claude doesn't support message names, so we'll just add them to the message content.
    for (const message of messages) {
        if (message.name && message.role !== "system") {
            message.content = message.name + ": " + message.content;
            delete message.name;
        }
    }

    let requestPrompt = messages.map((v) => {
        let prefix = '';
        switch (v.role) {
            case "assistant":
                prefix = "\n\nAssistant: ";
                break
            case "user":
                prefix = "\n\nHuman: ";
                break
            case "system":
                // According to the Claude docs, H: and A: should be used for example conversations.
                if (v.name === "example_assistant") {
                    prefix = "\n\nA: ";
                } else if (v.name === "example_user") {
                    prefix = "\n\nH: ";
                } else {
                    prefix = "\n\n";
                }
                break
        }
        return prefix + v.content;
    }).join('');

    if (addHumanPrefix) {
        requestPrompt = "\n\nHuman: " + requestPrompt;
    }

    if (addAssistantPostfix) {
        requestPrompt = requestPrompt + '\n\nAssistant: ';
    }

    return requestPrompt;
}

async function sendScaleRequest(request, response) {
    const fetch = require('node-fetch').default;

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

async function sendClaudeRequest(request, response) {
    const fetch = require('node-fetch').default;

    const api_url = new URL(request.body.reverse_proxy || api_claude).toString();
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
                generateResponse.body.destroy(); // Close the remote stream
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

    let api_url;
    let api_key_openai;
    let headers;
    let bodyParams;

    if (!request.body.use_openrouter) {
        api_url = new URL(request.body.reverse_proxy || api_openai).toString();
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

    const isTextCompletion = Boolean(request.body.model && (request.body.model.startsWith('text-') || request.body.model.startsWith('code-')));
    const textPrompt = isTextCompletion ? convertChatMLPrompt(request.body.messages) : '';
    const endpointUrl = isTextCompletion ? `${api_url}/completions` : `${api_url}/chat/completions`;

    const controller = new AbortController();
    request.socket.removeAllListeners('close');
    request.socket.on('close', function () {
        controller.abort();
    });

    const config = {
        method: 'post',
        url: endpointUrl,
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + api_key_openai,
            ...headers,
        },
        data: {
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
            "stop": request.body.stop,
            "logit_bias": request.body.logit_bias,
            ...bodyParams,
        },
        signal: controller.signal,
    };

    console.log(config.data);

    if (request.body.stream) {
        config.responseType = 'stream';
    }

    async function makeRequest(config, response_generate_openai, request, retries = 5, timeout = 5000) {
        try {
            const response = await axios(config);

            if (response.status <= 299) {
                if (request.body.stream) {
                    console.log('Streaming request in progress');
                    response.data.pipe(response_generate_openai);
                    response.data.on('end', () => {
                        console.log('Streaming request finished');
                        response_generate_openai.end();
                    });
                } else {
                    response_generate_openai.send(response.data);
                    console.log(response.data);
                    console.log(response.data?.choices[0]?.message);
                }
            } else {
                handleErrorResponse(response, response_generate_openai, request);
            }
        } catch (error) {
            if (error.response && error.response.status === 429 && retries > 0) {
                console.log(`Out of quota, retrying in ${Math.round(timeout / 1000)}s`);
                setTimeout(() => {
                    makeRequest(config, response_generate_openai, request, retries - 1);
                }, timeout);
            } else {
                let errorData = error?.response?.data;

                if (request.body.stream) {
                    try {
                        const chunks = await readAllChunks(errorData);
                        const blob = new Blob(chunks, { type: 'application/json' });
                        const text = await blob.text();
                        errorData = JSON.parse(text);
                    } catch {
                        console.warn('Error parsing streaming response');
                    }
                } else {
                    errorData = typeof errorData === 'string' ? tryParse(errorData) : errorData;
                }

                handleError(error, response_generate_openai, errorData);
            }
        }
    }

    function handleErrorResponse(response, response_generate_openai, request) {
        if (response.status >= 400 && response.status <= 504) {
            console.log('Error occurred:', response.status, response.data);
            response_generate_openai.send({ error: true });
        }
    }

    function handleError(error, response_generate_openai, errorData) {
        console.error('Error:', error?.message);

        let message = error?.response?.statusText;

        const statusMessages = {
            400: 'Bad request',
            401: 'Unauthorized',
            402: 'Credit limit reached',
            403: 'Forbidden',
            404: 'Not found',
            429: 'Too many requests',
            451: 'Unavailable for legal reasons',
        };

        const status = error?.response?.status;
        if (statusMessages.hasOwnProperty(status)) {
            message = errorData?.error?.message || statusMessages[status];
            console.log(message);
        }

        const quota_error = error?.response?.status === 429 && errorData?.error?.type === 'insufficient_quota';
        const response = { error: { message }, quota_error: quota_error }
        if (!response_generate_openai.headersSent) {
            response_generate_openai.send(response);
        } else if (!response_generate_openai.writableEnded) {
            response_generate_openai.write(response);
        }
    }

    makeRequest(config, response_generate_openai, request);
});

app.post("/tokenize_openai", jsonParser, function (request, response_tokenize_openai = response) {
    if (!request.body) return response_tokenize_openai.sendStatus(400);

    let num_tokens = 0;
    const model = getTokenizerModel(String(request.query.model || ''));

    if (model == 'claude') {
        num_tokens = countClaudeTokens(claude_tokenizer, request.body);
        return response_tokenize_openai.send({ "token_count": num_tokens });
    }

    const tokensPerName = model.includes('gpt-4') ? 1 : -1;
    const tokensPerMessage = model.includes('gpt-4') ? 3 : 4;
    const tokensPadding = 3;

    const tokenizer = getTiktokenTokenizer(model);

    for (const msg of request.body) {
        try {
            num_tokens += tokensPerMessage;
            for (const [key, value] of Object.entries(msg)) {
                num_tokens += tokenizer.encode(value).length;
                if (key == "name") {
                    num_tokens += tokensPerName;
                }
            }
        } catch {
            console.warn("Error tokenizing message:", msg);
        }
    }
    num_tokens += tokensPadding;

    // not needed for cached tokenizers
    //tokenizer.free();

    response_tokenize_openai.send({ "token_count": num_tokens });
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

app.post("/tokenize_ai21", jsonParser, function (request, response_tokenize_ai21 = response) {
    if (!request.body) return response_tokenize_ai21.sendStatus(400);
    const options = {
        method: 'POST',
        headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            Authorization: `Bearer ${readSecret(SECRET_KEYS.AI21)}`
        },
        body: JSON.stringify({ text: request.body[0].content })
    };

    fetch('https://api.ai21.com/studio/v1/tokenize', options)
        .then(response => response.json())
        .then(response => response_tokenize_ai21.send({ "token_count": response.tokens.length }))
        .catch(err => console.error(err));
});

app.post("/save_preset", jsonParser, function (request, response) {
    const name = sanitize(request.body.name);
    if (!request.body.preset || !name) {
        return response.sendStatus(400);
    }

    const settings = getPresetSettingsByAPI(request.body.apiId);
    const filename = name + settings.extension;

    if (!settings.folder) {
        return response.sendStatus(400);
    }

    const fullpath = path.join(settings.folder, filename);
    writeFileAtomicSync(fullpath, JSON.stringify(request.body.preset, null, 4), 'utf-8');
    return response.send({ name });
});

app.post("/delete_preset", jsonParser, function (request, response) {
    const name = sanitize(request.body.name);
    if (!name) {
        return response.sendStatus(400);
    }

    const settings = getPresetSettingsByAPI(request.body.apiId);
    const filename = name + settings.extension;

    if (!settings.folder) {
        return response.sendStatus(400);
    }

    const fullpath = path.join(settings.folder, filename);

    if (fs.existsSync(fullpath)) {
        fs.unlinkSync(fullpath);
        return response.sendStatus(200);
    } else {
        return response.sendStatus(404);
    }
});

app.post("/savepreset_openai", jsonParser, function (request, response) {
    const name = sanitize(request.query.name);
    if (!request.body || !name) {
        return response.sendStatus(400);
    }

    const filename = `${name}.settings`;
    const fullpath = path.join(directories.openAI_Settings, filename);
    writeFileAtomicSync(fullpath, JSON.stringify(request.body, null, 4), 'utf-8');
    return response.send({ name });
});

function getPresetSettingsByAPI(apiId) {
    switch (apiId) {
        case 'kobold':
        case 'koboldhorde':
            return { folder: directories.koboldAI_Settings, extension: '.settings' };
        case 'novel':
            return { folder: directories.novelAI_Settings, extension: '.settings' };
        case 'textgenerationwebui':
            return { folder: directories.textGen_Settings, extension: '.settings' };
        case 'instruct':
            return { folder: directories.instruct, extension: '.json' };
        case 'context':
            return { folder: directories.context, extension: '.json' };
        default:
            return { folder: null, extension: null };
    }
}

function createSentencepieceEncodingHandler(getTokenizerFn) {
    return async function (request, response) {
        try {
            if (!request.body) {
                return response.sendStatus(400);
            }

            const text = request.body.text || '';
            const tokenizer = getTokenizerFn();
            const { ids, count } = await countSentencepieceTokens(tokenizer, text);
            return response.send({ ids, count });
        } catch (error) {
            console.log(error);
            return response.send({ ids: [], count: 0 });
        }
    };
}

function createSentencepieceDecodingHandler(getTokenizerFn) {
    return async function (request, response) {
        try {
            if (!request.body) {
                return response.sendStatus(400);
            }

            const ids = request.body.ids || [];
            const tokenizer = getTokenizerFn();
            const text = await tokenizer.decodeIds(ids);
            return response.send({ text });
        } catch (error) {
            console.log(error);
            return response.send({ text: '' });
        }
    };
}

function createTiktokenEncodingHandler(modelId) {
    return async function (request, response) {
        try {
            if (!request.body) {
                return response.sendStatus(400);
            }

            const text = request.body.text || '';
            const tokenizer = getTiktokenTokenizer(modelId);
            const tokens = Object.values(tokenizer.encode(text));
            return response.send({ ids: tokens, count: tokens.length });
        } catch (error) {
            console.log(error);
            return response.send({ ids: [], count: 0 });
        }
    }
}

function createTiktokenDecodingHandler(modelId) {
    return async function (request, response) {
        try {
            if (!request.body) {
                return response.sendStatus(400);
            }

            const ids = request.body.ids || [];
            const tokenizer = getTiktokenTokenizer(modelId);
            const textBytes = tokenizer.decode(new Uint32Array(ids));
            const text = new TextDecoder().decode(textBytes);
            return response.send({ text });
        } catch (error) {
            console.log(error);
            return response.send({ text: '' });
        }
    }
}

app.post("/tokenize_llama", jsonParser, createSentencepieceEncodingHandler(() => spp_llama));
app.post("/tokenize_nerdstash", jsonParser, createSentencepieceEncodingHandler(() => spp_nerd));
app.post("/tokenize_nerdstash_v2", jsonParser, createSentencepieceEncodingHandler(() => spp_nerd_v2));
app.post("/tokenize_gpt2", jsonParser, createTiktokenEncodingHandler('gpt2'));
app.post("/decode_llama", jsonParser, createSentencepieceDecodingHandler(() => spp_llama));
app.post("/decode_nerdstash", jsonParser, createSentencepieceDecodingHandler(() => spp_nerd));
app.post("/decode_nerdstash_v2", jsonParser, createSentencepieceDecodingHandler(() => spp_nerd_v2));
app.post("/decode_gpt2", jsonParser, createTiktokenDecodingHandler('gpt2'));
app.post("/tokenize_via_api", jsonParser, async function (request, response) {
    if (!request.body) {
        return response.sendStatus(400);
    }
    const text = request.body.text || '';

    try {
        const args = {
            body: JSON.stringify({ "prompt": text }),
            headers: { "Content-Type": "application/json" }
        };

        if (main_api == 'textgenerationwebui' && request.body.use_mancer) {
            args.headers = Object.assign(args.headers, get_mancer_headers());
            const data = await postAsync(api_server + "/v1/token-count", args);
            return response.send({ count: data['results'][0]['tokens'] });
        }

        else if (main_api == 'kobold') {
            const data = await postAsync(api_server + "/extra/tokencount", args);
            const count = data['value'];
            return response.send({ count: count });
        }

        else {
            return response.send({ error: true });
        }
    } catch (error) {
        console.log(error);
        return response.send({ error: true });
    }
});


// ** REST CLIENT ASYNC WRAPPERS **

async function postAsync(url, args) {
    const fetch = require('node-fetch').default;
    const response = await fetch(url, { method: 'POST', timeout: 0, ...args });

    if (response.ok) {
        const data = await response.json();
        return data;
    }

    throw response;
}

function getAsync(url, args) {
    return new Promise((resolve, reject) => {
        client.get(url, args, (data, response) => {
            if (response.statusCode >= 400) {
                reject(data);
            }
            resolve(data);
        }).on('error', e => reject(e));
    })
}
// ** END **

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
    const version = getVersion();

    console.log(`SillyTavern ${version.pkgVersion}` + (version.gitBranch ? ` '${version.gitBranch}' (${version.gitRevision})` : ''));

    backupSettings();
    migrateSecrets();
    ensurePublicDirectoriesExist();
    await ensureThumbnailCache();
    contentManager.checkForNewContent();
    cleanUploads();

    // Colab users could run the embedded tool
    if (!is_colab) await convertWebp();

    [spp_llama, spp_nerd, spp_nerd_v2, claude_tokenizer] = await Promise.all([
        loadSentencepieceTokenizer('src/sentencepiece/tokenizer.model'),
        loadSentencepieceTokenizer('src/sentencepiece/nerdstash.model'),
        loadSentencepieceTokenizer('src/sentencepiece/nerdstash_v2.model'),
        loadClaudeTokenizer('src/claude.json'),
    ]);

    await statsHelpers.loadStatsFile(directories.chats, directories.characters);

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

if (true === cliArguments.ssl)
    https.createServer(
        {
            cert: fs.readFileSync(cliArguments.certPath),
            key: fs.readFileSync(cliArguments.keyPath)
        }, app)
        .listen(
            tavernUrl.port || 443,
            tavernUrl.hostname,
            setupTasks
        );
else
    http.createServer(app).listen(
        tavernUrl.port || 80,
        tavernUrl.hostname,
        setupTasks
    );

async function convertWebp() {
    const files = fs.readdirSync(directories.characters).filter(e => e.endsWith(".webp"));

    if (!files.length) {
        return;
    }

    console.log(`${files.length} WEBP files will be automatically converted.`);

    for (const file of files) {
        try {
            const source = path.join(directories.characters, file);
            const dest = path.join(directories.characters, path.basename(file, ".webp") + ".png");

            if (fs.existsSync(dest)) {
                console.log(`${dest} already exists. Delete ${source} manually`);
                continue;
            }

            console.log(`Read... ${source}`);
            const data = await charaRead(source);

            console.log(`Convert... ${source} -> ${dest}`);
            await webp.dwebp(source, dest, "-o");

            console.log(`Write... ${dest}`);
            const success = await charaWrite(dest, data, path.parse(dest).name);

            if (!success) {
                console.log(`Failure on ${source} -> ${dest}`);
                continue;
            }

            console.log(`Remove... ${source}`);
            fs.rmSync(source);
        } catch (err) {
            console.log(err);
        }
    }
}

function backupSettings() {
    const MAX_BACKUPS = 25;

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

    try {
        if (!fs.existsSync(directories.backups)) {
            fs.mkdirSync(directories.backups);
        }

        const backupFile = path.join(directories.backups, `settings_${generateTimestamp()}.json`);
        fs.copyFileSync(SETTINGS_FILE, backupFile);

        let files = fs.readdirSync(directories.backups).filter(f => f.startsWith('settings_'));
        if (files.length > MAX_BACKUPS) {
            files = files.map(f => path.join(directories.backups, f));
            files.sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);

            fs.rmSync(files[0]);
        }
    } catch (err) {
        console.log('Could not backup settings file', err);
    }
}

function ensurePublicDirectoriesExist() {
    for (const dir of Object.values(directories)) {
        if (!fs.existsSync(dir)) {
            fs.mkdirSync(dir, { recursive: true });
        }
    }
}

const SECRETS_FILE = './secrets.json';
const SETTINGS_FILE = './public/settings.json';
const SECRET_KEYS = {
    HORDE: 'api_key_horde',
    MANCER: 'api_key_mancer',
    OPENAI: 'api_key_openai',
    NOVEL: 'api_key_novel',
    CLAUDE: 'api_key_claude',
    DEEPL: 'deepl',
    LIBRE: 'libre',
    LIBRE_URL: 'libre_url',
    OPENROUTER: 'api_key_openrouter',
    SCALE: 'api_key_scale',
    AI21: 'api_key_ai21',
    SCALE_COOKIE: 'scale_cookie',
}

function migrateSecrets() {
    if (!fs.existsSync(SETTINGS_FILE)) {
        console.log('Settings file does not exist');
        return;
    }

    try {
        let modified = false;
        const fileContents = fs.readFileSync(SETTINGS_FILE);
        const settings = JSON.parse(fileContents);
        const oaiKey = settings?.api_key_openai;
        const hordeKey = settings?.horde_settings?.api_key;
        const novelKey = settings?.api_key_novel;

        if (typeof oaiKey === 'string') {
            console.log('Migrating OpenAI key...');
            writeSecret(SECRET_KEYS.OPENAI, oaiKey);
            delete settings.api_key_openai;
            modified = true;
        }

        if (typeof hordeKey === 'string') {
            console.log('Migrating Horde key...');
            writeSecret(SECRET_KEYS.HORDE, hordeKey);
            delete settings.horde_settings.api_key;
            modified = true;
        }

        if (typeof novelKey === 'string') {
            console.log('Migrating Novel key...');
            writeSecret(SECRET_KEYS.NOVEL, novelKey);
            delete settings.api_key_novel;
            modified = true;
        }

        if (modified) {
            console.log('Writing updated settings.json...');
            const settingsContent = JSON.stringify(settings);
            writeFileAtomicSync(SETTINGS_FILE, settingsContent, "utf-8");
        }
    }
    catch (error) {
        console.error('Could not migrate secrets file. Proceed with caution.');
    }
}

app.post('/writesecret', jsonParser, (request, response) => {
    const key = request.body.key;
    const value = request.body.value;

    writeSecret(key, value);
    return response.send('ok');
});

app.post('/readsecretstate', jsonParser, (_, response) => {
    if (!fs.existsSync(SECRETS_FILE)) {
        return response.send({});
    }

    try {
        const fileContents = fs.readFileSync(SECRETS_FILE);
        const secrets = JSON.parse(fileContents);
        const state = {};

        for (const key of Object.values(SECRET_KEYS)) {
            state[key] = !!secrets[key]; // convert to boolean
        }

        return response.send(state);
    } catch (error) {
        console.error(error);
        return response.send({});
    }
});

const ANONYMOUS_KEY = "0000000000";

app.post('/generate_horde', jsonParser, async (request, response) => {
    const api_key_horde = readSecret(SECRET_KEYS.HORDE) || ANONYMOUS_KEY;
    const url = 'https://horde.koboldai.net/api/v2/generate/text/async';

    const args = {
        "body": JSON.stringify(request.body),
        "headers": {
            "Content-Type": "application/json",
            "Client-Agent": request.header('Client-Agent'),
            "apikey": api_key_horde,
        }
    };

    console.log(args.body);
    try {
        const data = await postAsync(url, args);
        return response.send(data);
    } catch (error) {
        console.log('Horde returned an error:', error.statusText);

        if (typeof error.text === 'function') {
            const message = await error.text();
            console.log(message);
            return response.send({ error: { message } });
        } else {
            return response.send({ error: true });
        }
    }
});

app.post('/viewsecrets', jsonParser, async (_, response) => {
    if (!allowKeysExposure) {
        console.error('secrets.json could not be viewed unless the value of allowKeysExposure in config.conf is set to true');
        return response.sendStatus(403);
    }

    if (!fs.existsSync(SECRETS_FILE)) {
        console.error('secrets.json does not exist');
        return response.sendStatus(404);
    }

    try {
        const fileContents = fs.readFileSync(SECRETS_FILE);
        const secrets = JSON.parse(fileContents);
        return response.send(secrets);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

app.post('/horde_samplers', jsonParser, async (_, response) => {
    try {
        const ai_horde = getHordeClient();
        const samplers = Object.values(ai_horde.ModelGenerationInputStableSamplers);
        response.send(samplers);
    } catch (error) {
        console.error(error);
        response.sendStatus(500);
    }
});

app.post('/horde_models', jsonParser, async (_, response) => {
    try {
        const ai_horde = getHordeClient();
        const models = await ai_horde.getModels();
        response.send(models);
    } catch (error) {
        console.error(error);
        response.sendStatus(500);
    }
});

app.post('/horde_userinfo', jsonParser, async (_, response) => {
    const api_key_horde = readSecret(SECRET_KEYS.HORDE);

    if (!api_key_horde) {
        return response.send({ anonymous: true });
    }

    try {
        const ai_horde = getHordeClient();
        const user = await ai_horde.findUser({ token: api_key_horde });
        return response.send(user);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
})

app.post('/horde_generateimage', jsonParser, async (request, response) => {
    const MAX_ATTEMPTS = 200;
    const CHECK_INTERVAL = 3000;
    const api_key_horde = readSecret(SECRET_KEYS.HORDE) || ANONYMOUS_KEY;
    console.log('Stable Horde request:', request.body);

    try {
        const ai_horde = getHordeClient();
        const generation = await ai_horde.postAsyncImageGenerate(
            {
                prompt: `${request.body.prompt_prefix} ${request.body.prompt} ### ${request.body.negative_prompt}`,
                params:
                {
                    sampler_name: request.body.sampler,
                    hires_fix: request.body.enable_hr,
                    use_gfpgan: request.body.restore_faces,
                    cfg_scale: request.body.scale,
                    steps: request.body.steps,
                    width: request.body.width,
                    height: request.body.height,
                    karras: Boolean(request.body.karras),
                    n: 1,
                },
                r2: false,
                nsfw: request.body.nfsw,
                models: [request.body.model],
            },
            { token: api_key_horde });

        if (!generation.id) {
            console.error('Image generation request is not satisfyable:', generation.message || 'unknown error');
            return response.sendStatus(400);
        }

        for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
            await delay(CHECK_INTERVAL);
            const check = await ai_horde.getImageGenerationCheck(generation.id);
            console.log(check);

            if (check.done) {
                const result = await ai_horde.getImageGenerationStatus(generation.id);
                return response.send(result.generations[0].img);
            }

            /*
            if (!check.is_possible) {
                return response.sendStatus(503);
            }
            */

            if (check.faulted) {
                return response.sendStatus(500);
            }
        }

        return response.sendStatus(504);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

app.post('/libre_translate', jsonParser, async (request, response) => {
    const key = readSecret(SECRET_KEYS.LIBRE);
    const url = readSecret(SECRET_KEYS.LIBRE_URL);

    const text = request.body.text;
    const lang = request.body.lang;

    if (!text || !lang) {
        return response.sendStatus(400);
    }

    console.log('Input text: ' + text);

    try {
        const result = await fetch(url, {
            method: "POST",
            body: JSON.stringify({
                q: text,
                source: "auto",
                target: lang,
                format: "text",
                api_key: key
            }),
            headers: { "Content-Type": "application/json" }
        });

        if (!result.ok) {
            return response.sendStatus(result.status);
        }

        const json = await result.json();
        console.log('Translated text: ' + json.translatedText);

        return response.send(json.translatedText);
    } catch (error) {
        console.log("Translation error: " + error.message);
        return response.sendStatus(500);
    }
});

app.post('/google_translate', jsonParser, async (request, response) => {
    const { generateRequestUrl, normaliseResponse } = require('google-translate-api-browser');

    const text = request.body.text;
    const lang = request.body.lang;

    if (!text || !lang) {
        return response.sendStatus(400);
    }

    console.log('Input text: ' + text);

    const url = generateRequestUrl(text, { to: lang });

    https.get(url, (resp) => {
        let data = '';

        resp.on('data', (chunk) => {
            data += chunk;
        });

        resp.on('end', () => {
            const result = normaliseResponse(JSON.parse(data));
            console.log('Translated text: ' + result.text);
            return response.send(result.text);
        });
    }).on("error", (err) => {
        console.log("Translation error: " + err.message);
        return response.sendStatus(500);
    });
});

app.post('/deepl_translate', jsonParser, async (request, response) => {
    const key = readSecret(SECRET_KEYS.DEEPL);

    if (!key) {
        return response.sendStatus(401);
    }

    const text = request.body.text;
    const lang = request.body.lang;

    if (!text || !lang) {
        return response.sendStatus(400);
    }

    console.log('Input text: ' + text);

    const fetch = require('node-fetch').default;
    const params = new URLSearchParams();
    params.append('text', text);
    params.append('target_lang', lang);

    try {
        const result = await fetch('https://api-free.deepl.com/v2/translate', {
            method: 'POST',
            body: params,
            headers: {
                'Accept': 'application/json',
                'Authorization': `DeepL-Auth-Key ${key}`,
                'Content-Type': 'application/x-www-form-urlencoded',
            },
            timeout: 0,
        });

        if (!result.ok) {
            return response.sendStatus(result.status);
        }

        const json = await result.json();
        console.log('Translated text: ' + json.translations[0].text);

        return response.send(json.translations[0].text);
    } catch (error) {
        console.log("Translation error: " + error.message);
        return response.sendStatus(500);
    }
});

app.post('/novel_tts', jsonParser, async (request, response) => {
    const token = readSecret(SECRET_KEYS.NOVEL);

    if (!token) {
        return response.sendStatus(401);
    }

    const text = request.body.text;
    const voice = request.body.voice;

    if (!text || !voice) {
        return response.sendStatus(400);
    }

    try {
        const fetch = require('node-fetch').default;
        const url = `${api_novelai}/ai/generate-voice?text=${encodeURIComponent(text)}&voice=-1&seed=${encodeURIComponent(voice)}&opus=false&version=v2`;
        const result = await fetch(url, {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${token}`,
                'Accept': 'audio/mpeg',
            },
            timeout: 0,
        });

        if (!result.ok) {
            return response.sendStatus(result.status);
        }

        const chunks = await readAllChunks(result.body);
        const buffer = Buffer.concat(chunks);
        response.setHeader('Content-Type', 'audio/mpeg');
        return response.send(buffer);
    }
    catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

app.post('/delete_sprite', jsonParser, async (request, response) => {
    const label = request.body.label;
    const name = request.body.name;

    if (!label || !name) {
        return response.sendStatus(400);
    }

    try {
        const spritesPath = path.join(directories.characters, name);

        // No sprites folder exists, or not a directory
        if (!fs.existsSync(spritesPath) || !fs.statSync(spritesPath).isDirectory()) {
            return response.sendStatus(404);
        }

        const files = fs.readdirSync(spritesPath);

        // Remove existing sprite with the same label
        for (const file of files) {
            if (path.parse(file).name === label) {
                fs.rmSync(path.join(spritesPath, file));
            }
        }

        return response.sendStatus(200);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

app.post('/upload_sprite_pack', urlencodedParser, async (request, response) => {
    const file = request.file;
    const name = request.body.name;

    if (!file || !name) {
        return response.sendStatus(400);
    }

    try {
        const spritesPath = path.join(directories.characters, name);

        // Create sprites folder if it doesn't exist
        if (!fs.existsSync(spritesPath)) {
            fs.mkdirSync(spritesPath);
        }

        // Path to sprites is not a directory. This should never happen.
        if (!fs.statSync(spritesPath).isDirectory()) {
            return response.sendStatus(404);
        }

        const spritePackPath = path.join(UPLOADS_PATH, file.filename);
        const sprites = await getImageBuffers(spritePackPath);
        const files = fs.readdirSync(spritesPath);

        for (const [filename, buffer] of sprites) {
            // Remove existing sprite with the same label
            const existingFile = files.find(file => path.parse(file).name === path.parse(filename).name);

            if (existingFile) {
                fs.rmSync(path.join(spritesPath, existingFile));
            }

            // Write sprite buffer to disk
            const pathToSprite = path.join(spritesPath, filename);
            writeFileAtomicSync(pathToSprite, buffer);
        }

        // Remove uploaded ZIP file
        fs.rmSync(spritePackPath);
        return response.send({ count: sprites.length });
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

app.post('/upload_sprite', urlencodedParser, async (request, response) => {
    const file = request.file;
    const label = request.body.label;
    const name = request.body.name;

    if (!file || !label || !name) {
        return response.sendStatus(400);
    }

    try {
        const spritesPath = path.join(directories.characters, name);

        // Create sprites folder if it doesn't exist
        if (!fs.existsSync(spritesPath)) {
            fs.mkdirSync(spritesPath);
        }

        // Path to sprites is not a directory. This should never happen.
        if (!fs.statSync(spritesPath).isDirectory()) {
            return response.sendStatus(404);
        }

        const files = fs.readdirSync(spritesPath);

        // Remove existing sprite with the same label
        for (const file of files) {
            if (path.parse(file).name === label) {
                fs.rmSync(path.join(spritesPath, file));
            }
        }

        const filename = label + path.parse(file.originalname).ext;
        const spritePath = path.join(UPLOADS_PATH, file.filename);
        const pathToFile = path.join(spritesPath, filename);
        // Copy uploaded file to sprites folder
        fs.cpSync(spritePath, pathToFile);
        // Remove uploaded file
        fs.rmSync(spritePath);
        return response.sendStatus(200);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

app.post('/import_custom', jsonParser, async (request, response) => {
    if (!request.body.url) {
        return response.sendStatus(400);
    }

    try {
        const url = request.body.url;
        let result;

        const chubParsed = parseChubUrl(url);

        if (chubParsed?.type === 'character') {
            console.log('Downloading chub character:', chubParsed.id);
            result = await downloadChubCharacter(chubParsed.id);
        }
        else if (chubParsed?.type === 'lorebook') {
            console.log('Downloading chub lorebook:', chubParsed.id);
            result = await downloadChubLorebook(chubParsed.id);
        }
        else {
            return response.sendStatus(404);
        }

        response.set('Content-Type', result.fileType);
        response.set('Content-Disposition', `attachment; filename="${result.fileName}"`);
        response.set('X-Custom-Content-Type', chubParsed?.type);
        return response.send(result.buffer);
    } catch (error) {
        console.log('Importing custom content failed', error);
        return response.sendStatus(500);
    }
});

async function downloadChubLorebook(id) {
    const fetch = require('node-fetch').default;

    const result = await fetch('https://api.chub.ai/api/lorebooks/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            "fullPath": id,
            "format": "SILLYTAVERN",
        }),
    });

    if (!result.ok) {
        console.log(await result.text());
        throw new Error('Failed to download lorebook');
    }

    const name = id.split('/').pop();
    const buffer = await result.buffer();
    const fileName = `${sanitize(name)}.json`;
    const fileType = result.headers.get('content-type');

    return { buffer, fileName, fileType };
}

async function downloadChubCharacter(id) {
    const fetch = require('node-fetch').default;

    const result = await fetch('https://api.chub.ai/api/characters/download', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
            "format": "tavern",
            "fullPath": id,
        })
    });

    if (!result.ok) {
        throw new Error('Failed to download character');
    }

    const buffer = await result.buffer();
    const fileName = result.headers.get('content-disposition')?.split('filename=')[1] || `${sanitize(id)}.png`;
    const fileType = result.headers.get('content-type');

    return { buffer, fileName, fileType };
}

function parseChubUrl(str) {
    const splitStr = str.split('/');
    const length = splitStr.length;

    if (length < 2) {
        return null;
    }

    let domainIndex = -1;

    splitStr.forEach((part, index) => {
        if (part === 'www.chub.ai' || part === 'chub.ai') {
            domainIndex = index;
        }
    })

    const lastTwo = domainIndex !== -1 ? splitStr.slice(domainIndex + 1) : splitStr;

    const firstPart = lastTwo[0].toLowerCase();

    if (firstPart === 'characters' || firstPart === 'lorebooks') {
        const type = firstPart === 'characters' ? 'character' : 'lorebook';
        const id = type === 'character' ? lastTwo.slice(1).join('/') : lastTwo.join('/');
        return {
            id: id,
            type: type
        };
    } else if (length === 2) {
        return {
            id: lastTwo.join('/'),
            type: 'character'
        };
    }

    return null;
}

function importRisuSprites(data) {
    try {
        const name = data?.data?.name;
        const risuData = data?.data?.extensions?.risuai;

        // Not a Risu AI character
        if (!risuData || !name) {
            return;
        }

        let images = [];

        if (Array.isArray(risuData.additionalAssets)) {
            images = images.concat(risuData.additionalAssets);
        }

        if (Array.isArray(risuData.emotions)) {
            images = images.concat(risuData.emotions);
        }

        // No sprites to import
        if (images.length === 0) {
            return;
        }

        // Create sprites folder if it doesn't exist
        const spritesPath = path.join(directories.characters, name);
        if (!fs.existsSync(spritesPath)) {
            fs.mkdirSync(spritesPath);
        }

        // Path to sprites is not a directory. This should never happen.
        if (!fs.statSync(spritesPath).isDirectory()) {
            return;
        }

        console.log(`RisuAI: Found ${images.length} sprites for ${name}. Writing to disk.`);
        const files = fs.readdirSync(spritesPath);

        outer: for (const [label, fileBase64] of images) {
            // Remove existing sprite with the same label
            for (const file of files) {
                if (path.parse(file).name === label) {
                    console.log(`RisuAI: The sprite ${label} for ${name} already exists. Skipping.`);
                    continue outer;
                }
            }

            const filename = label + '.png';
            const pathToFile = path.join(spritesPath, filename);
            writeFileAtomicSync(pathToFile, fileBase64, { encoding: 'base64' });
        }

        // Remove additionalAssets and emotions from data (they are now in the sprites folder)
        delete data.data.extensions.risuai.additionalAssets;
        delete data.data.extensions.risuai.emotions;
    } catch (error) {
        console.error(error);
    }
}

function writeSecret(key, value) {
    if (!fs.existsSync(SECRETS_FILE)) {
        const emptyFile = JSON.stringify({});
        writeFileAtomicSync(SECRETS_FILE, emptyFile, "utf-8");
    }

    const fileContents = fs.readFileSync(SECRETS_FILE);
    const secrets = JSON.parse(fileContents);
    secrets[key] = value;
    writeFileAtomicSync(SECRETS_FILE, JSON.stringify(secrets), "utf-8");
}

function readSecret(key) {
    if (!fs.existsSync(SECRETS_FILE)) {
        return undefined;
    }

    const fileContents = fs.readFileSync(SECRETS_FILE);
    const secrets = JSON.parse(fileContents);
    return secrets[key];
}

async function readAllChunks(readableStream) {
    return new Promise((resolve, reject) => {
        // Consume the readable stream
        const chunks = [];
        readableStream.on('data', (chunk) => {
            chunks.push(chunk);
        });

        readableStream.on('end', () => {
            //console.log('Finished reading the stream.');
            resolve(chunks);
        });

        readableStream.on('error', (error) => {
            console.error('Error while reading the stream:', error);
            reject();
        });
    });
}

async function getImageBuffers(zipFilePath) {
    return new Promise((resolve, reject) => {
        // Check if the zip file exists
        if (!fs.existsSync(zipFilePath)) {
            reject(new Error('File not found'));
            return;
        }

        const imageBuffers = [];

        yauzl.open(zipFilePath, { lazyEntries: true }, (err, zipfile) => {
            if (err) {
                reject(err);
            } else {
                zipfile.readEntry();
                zipfile.on('entry', (entry) => {
                    const mimeType = mime.lookup(entry.fileName);
                    if (mimeType && mimeType.startsWith('image/') && !entry.fileName.startsWith('__MACOSX')) {
                        console.log(`Extracting ${entry.fileName}`);
                        zipfile.openReadStream(entry, (err, readStream) => {
                            if (err) {
                                reject(err);
                            } else {
                                const chunks = [];
                                readStream.on('data', (chunk) => {
                                    chunks.push(chunk);
                                });

                                readStream.on('end', () => {
                                    imageBuffers.push([path.parse(entry.fileName).base, Buffer.concat(chunks)]);
                                    zipfile.readEntry(); // Continue to the next entry
                                });
                            }
                        });
                    } else {
                        zipfile.readEntry(); // Continue to the next entry
                    }
                });

                zipfile.on('end', () => {
                    resolve(imageBuffers);
                });

                zipfile.on('error', (err) => {
                    reject(err);
                });
            }
        });
    });
}



/**
 * This function extracts the extension information from the manifest file.
 * @param {string} extensionPath - The path of the extension folder
 * @returns {Object} - Returns the manifest data as an object
 */
async function getManifest(extensionPath) {
    const manifestPath = path.join(extensionPath, 'manifest.json');

    // Check if manifest.json exists
    if (!fs.existsSync(manifestPath)) {
        throw new Error(`Manifest file not found at ${manifestPath}`);
    }

    const manifest = JSON.parse(fs.readFileSync(manifestPath, 'utf8'));
    return manifest;
}

async function checkIfRepoIsUpToDate(extensionPath) {
    const git = simpleGit();
    await git.cwd(extensionPath).fetch('origin');
    const currentBranch = await git.cwd(extensionPath).branch();
    const currentCommitHash = await git.cwd(extensionPath).revparse(['HEAD']);
    const log = await git.cwd(extensionPath).log({
        from: currentCommitHash,
        to: `origin/${currentBranch.current}`,
    });

    // Fetch remote repository information
    const remotes = await git.cwd(extensionPath).getRemotes(true);

    return {
        isUpToDate: log.total === 0,
        remoteUrl: remotes[0].refs.fetch, // URL of the remote repository
    };
}



/**
 * HTTP POST handler function to clone a git repository from a provided URL, read the extension manifest,
 * and return extension information and path.
 *
 * @param {Object} request - HTTP Request object, expects a JSON body with a 'url' property.
 * @param {Object} response - HTTP Response object used to respond to the HTTP request.
 *
 * @returns {void}
 */
app.post('/get_extension', jsonParser, async (request, response) => {
    const git = simpleGit();
    if (!request.body.url) {
        return response.status(400).send('Bad Request: URL is required in the request body.');
    }

    try {
        // make sure the third-party directory exists
        if (!fs.existsSync(directories.extensions + '/third-party')) {
            fs.mkdirSync(directories.extensions + '/third-party');
        }

        const url = request.body.url;
        const extensionPath = path.join(directories.extensions, 'third-party', path.basename(url, '.git'));

        if (fs.existsSync(extensionPath)) {
            return response.status(409).send(`Directory already exists at ${extensionPath}`);
        }

        await git.clone(url, extensionPath);
        console.log(`Extension has been cloned at ${extensionPath}`);


        const { version, author, display_name } = await getManifest(extensionPath);


        return response.send({ version, author, display_name, extensionPath });

    } catch (error) {
        console.log('Importing custom content failed', error);
        return response.status(500).send(`Server Error: ${error.message}`);
    }
});

/**
 * HTTP POST handler function to pull the latest updates from a git repository
 * based on the extension name provided in the request body. It returns the latest commit hash,
 * the path of the extension, the status of the repository (whether it's up-to-date or not),
 * and the remote URL of the repository.
 *
 * @param {Object} request - HTTP Request object, expects a JSON body with an 'extensionName' property.
 * @param {Object} response - HTTP Response object used to respond to the HTTP request.
 *
 * @returns {void}
 */
app.post('/update_extension', jsonParser, async (request, response) => {
    const git = simpleGit();
    if (!request.body.extensionName) {
        return response.status(400).send('Bad Request: extensionName is required in the request body.');
    }

    try {
        const extensionName = request.body.extensionName;
        const extensionPath = path.join(directories.extensions, 'third-party', extensionName);

        if (!fs.existsSync(extensionPath)) {
            return response.status(404).send(`Directory does not exist at ${extensionPath}`);
        }

        const { isUpToDate, remoteUrl } = await checkIfRepoIsUpToDate(extensionPath);
        const currentBranch = await git.cwd(extensionPath).branch();
        if (!isUpToDate) {

            await git.cwd(extensionPath).pull('origin', currentBranch.current);
            console.log(`Extension has been updated at ${extensionPath}`);
        } else {
            console.log(`Extension is up to date at ${extensionPath}`);
        }
        await git.cwd(extensionPath).fetch('origin');
        const fullCommitHash = await git.cwd(extensionPath).revparse(['HEAD']);
        const shortCommitHash = fullCommitHash.slice(0, 7);

        return response.send({ shortCommitHash, extensionPath, isUpToDate, remoteUrl });

    } catch (error) {
        console.log('Updating custom content failed', error);
        return response.status(500).send(`Server Error: ${error.message}`);
    }
});

/**
 * HTTP POST handler function to get the current git commit hash and branch name for a given extension.
 * It checks whether the repository is up-to-date with the remote, and returns the status along with
 * the remote URL of the repository.
 *
 * @param {Object} request - HTTP Request object, expects a JSON body with an 'extensionName' property.
 * @param {Object} response - HTTP Response object used to respond to the HTTP request.
 *
 * @returns {void}
 */
app.post('/get_extension_version', jsonParser, async (request, response) => {
    const git = simpleGit();
    if (!request.body.extensionName) {
        return response.status(400).send('Bad Request: extensionName is required in the request body.');
    }

    try {
        const extensionName = request.body.extensionName;
        const extensionPath = path.join(directories.extensions, 'third-party', extensionName);

        if (!fs.existsSync(extensionPath)) {
            return response.status(404).send(`Directory does not exist at ${extensionPath}`);
        }

        const currentBranch = await git.cwd(extensionPath).branch();
        // get only the working branch
        const currentBranchName = currentBranch.current;
        await git.cwd(extensionPath).fetch('origin');
        const currentCommitHash = await git.cwd(extensionPath).revparse(['HEAD']);
        console.log(currentBranch, currentCommitHash);
        const { isUpToDate, remoteUrl } = await checkIfRepoIsUpToDate(extensionPath);

        return response.send({ currentBranchName, currentCommitHash, isUpToDate, remoteUrl });

    } catch (error) {
        console.log('Getting extension version failed', error);
        return response.status(500).send(`Server Error: ${error.message}`);
    }
}
);

/**
 * HTTP POST handler function to delete a git repository based on the extension name provided in the request body.
 *
 * @param {Object} request - HTTP Request object, expects a JSON body with a 'url' property.
 * @param {Object} response - HTTP Response object used to respond to the HTTP request.
 *
 * @returns {void}
 */
app.post('/delete_extension', jsonParser, async (request, response) => {
    if (!request.body.extensionName) {
        return response.status(400).send('Bad Request: extensionName is required in the request body.');
    }

    // Sanatize the extension name to prevent directory traversal
    const extensionName = sanitize(request.body.extensionName);

    try {
        const extensionPath = path.join(directories.extensions, 'third-party', extensionName);

        if (!fs.existsSync(extensionPath)) {
            return response.status(404).send(`Directory does not exist at ${extensionPath}`);
        }

        await fs.promises.rmdir(extensionPath, { recursive: true });
        console.log(`Extension has been deleted at ${extensionPath}`);

        return response.send(`Extension has been deleted at ${extensionPath}`);

    } catch (error) {
        console.log('Deleting custom content failed', error);
        return response.status(500).send(`Server Error: ${error.message}`);
    }
});


/**
 * HTTP POST handler function to retrieve name of all files of a given folder path.
 *
 * @param {Object} request - HTTP Request object. Require folder path in query
 * @param {Object} response - HTTP Response object will contain a list of file path.
 *
 * @returns {void}
 */
app.post('/get_assets', jsonParser, async (request, response) => {
    const folderPath = path.join(directories.assets);
    let output = {}
    //console.info("Checking files into",folderPath);

    try {
        if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
            const folders = fs.readdirSync(folderPath)
                .filter(filename => {
                    return fs.statSync(path.join(folderPath, filename)).isDirectory();
                });

            for (const folder of folders) {
                if (folder == "temp")
                    continue;
                const files = fs.readdirSync(path.join(folderPath, folder))
                    .filter(filename => {
                        return filename != ".placeholder";
                    });
                output[folder] = [];
                for (const file of files) {
                    output[folder].push(path.join("assets", folder, file));
                }
            }
        }
    }
    catch (err) {
        console.log(err);
    }
    finally {
        return response.send(output);
    }
});


function checkAssetFileName(inputFilename) {
    // Sanitize filename
    if (inputFilename.indexOf('\0') !== -1) {
        console.debug("Bad request: poisong null bytes in filename.");
        return '';
    }

    if (!/^[a-zA-Z0-9_\-\.]+$/.test(inputFilename)) {
        console.debug("Bad request: illegal character in filename, only alphanumeric, '_', '-' are accepted.");
        return '';
    }

    if (contentManager.unsafeExtensions.some(ext => inputFilename.toLowerCase().endsWith(ext))) {
        console.debug("Bad request: forbidden file extension.");
        return '';
    }

    if (inputFilename.startsWith('.')) {
        console.debug("Bad request: filename cannot start with '.'");
        return '';
    }

    return path.normalize(inputFilename).replace(/^(\.\.(\/|\\|$))+/, '');;
}

/**
 * HTTP POST handler function to download the requested asset.
 *
 * @param {Object} request - HTTP Request object, expects a url, a category and a filename.
 * @param {Object} response - HTTP Response only gives status.
 *
 * @returns {void}
 */
app.post('/asset_download', jsonParser, async (request, response) => {
    const { Readable } = require('stream');
    const { finished } = require('stream/promises');
    const url = request.body.url;
    const inputCategory = request.body.category;
    const inputFilename = sanitize(request.body.filename);
    const validCategories = ["bgm", "ambient"];

    // Check category
    let category = null;
    for (i of validCategories)
        if (i == inputCategory)
            category = i;

    if (category === null) {
        console.debug("Bad request: unsuported asset category.");
        return response.sendStatus(400);
    }

    // Sanitize filename
    const safe_input = checkAssetFileName(inputFilename);
    if (safe_input == '')
        return response.sendFile(400);

    const temp_path = path.join(directories.assets, "temp", safe_input)
    const file_path = path.join(directories.assets, category, safe_input)
    console.debug("Request received to download", url, "to", file_path);

    try {
        // Download to temp
        const downloadFile = (async (url, temp_path) => {
            const res = await fetch(url);
            if (!res.ok) {
                throw new Error(`Unexpected response ${res.statusText}`);
            }
            const destination = path.resolve(temp_path);
            // Delete if previous download failed
            if (fs.existsSync(temp_path)) {
                fs.unlink(temp_path, (err) => {
                    if (err) throw err;
                });
            }
            const fileStream = fs.createWriteStream(destination, { flags: 'wx' });
            await finished(Readable.fromWeb(res.body).pipe(fileStream));
        });

        await downloadFile(url, temp_path);

        // Move into asset place
        console.debug("Download finished, moving file from", temp_path, "to", file_path);
        fs.renameSync(temp_path, file_path);
        response.sendStatus(200);
    }
    catch (error) {
        console.log(error);
        response.sendStatus(500);
    }
});

/**
 * HTTP POST handler function to delete the requested asset.
 *
 * @param {Object} request - HTTP Request object, expects a category and a filename
 * @param {Object} response - HTTP Response only gives stats.
 *
 * @returns {void}
 */
app.post('/asset_delete', jsonParser, async (request, response) => {
    const { Readable } = require('stream');
    const { finished } = require('stream/promises');
    const inputCategory = request.body.category;
    const inputFilename = sanitize(request.body.filename);
    const validCategories = ["bgm", "ambient"];

    // Check category
    let category = null;
    for (i of validCategories)
        if (i == inputCategory)
            category = i;

    if (category === null) {
        console.debug("Bad request: unsuported asset category.");
        return response.sendStatus(400);
    }

    // Sanitize filename
    const safe_input = checkAssetFileName(inputFilename);
    if (safe_input == '')
        return response.sendFile(400);

    const file_path = path.join(directories.assets, category, safe_input)
    console.debug("Request received to delete", category, file_path);

    try {
        // Delete if previous download failed
        if (fs.existsSync(file_path)) {
            fs.unlink(file_path, (err) => {
                if (err) throw err;
            });
            console.debug("Asset deleted.");
        }
        else {
            console.debug("Asset not found.");
            response.sendStatus(400);
        }
        // Move into asset place
        response.sendStatus(200);
    }
    catch (error) {
        console.log(error);
        response.sendStatus(500);
    }
});


///////////////////////////////
/**
 * HTTP POST handler function to retrieve a character background music list.
 *
 * @param {Object} request - HTTP Request object, expects a character name in the query.
 * @param {Object} response - HTTP Response object will contain a list of audio file path.
 *
 * @returns {void}
 */
app.post('/get_character_assets_list', jsonParser, async (request, response) => {
    const name = sanitize(request.query.name);
    const inputCategory = request.query.category;
    const validCategories = ["bgm", "ambient"]

    // Check category
    let category = null
    for (i of validCategories)
        if (i == inputCategory)
            category = i

    if (category === null) {
        console.debug("Bad request: unsuported asset category.");
        return response.sendStatus(400);
    }

    const folderPath = path.join(directories.characters, name, category);

    let output = [];
    try {
        if (fs.existsSync(folderPath) && fs.statSync(folderPath).isDirectory()) {
            const files = fs.readdirSync(folderPath)
                .filter(filename => {
                    return filename != ".placeholder";
                });

            for (i of files)
                output.push(`/characters/${name}/${category}/${i}`);

        }
        return response.send(output);
    }
    catch (err) {
        console.log(err);
        return response.sendStatus(500);
    }
});
