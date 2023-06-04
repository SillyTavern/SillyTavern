#!/usr/bin/env node

const process = require('process')
const yargs = require('yargs/yargs');
const { hideBin } = require('yargs/helpers');

const cliArguments = yargs(hideBin(process.argv))
    .option('ssl', {
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
app.use(compression());

const fs = require('fs');
const readline = require('readline');
const open = require('open');

const rimraf = require("rimraf");
const multer = require("multer");
const http = require("http");
const https = require('https');
const basicAuthMiddleware = require('./src/middleware/basicAuthMiddleware');
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
const AIHorde = require("./src/horde");
const ai_horde = new AIHorde({
    client_agent: getVersion()?.agent || 'SillyTavern:UNKNOWN:Cohee#1207',
});
const ipMatching = require('ip-matching');
const yauzl = require('yauzl');

const Client = require('node-rest-client').Client;
const client = new Client();

client.on('error', (err) => {
    console.error('An error occurred:', err);
});

const poe = require('./poe-client');

let api_server = "http://0.0.0.0:5000";
let api_novelai = "https://api.novelai.net";
let api_openai = "https://api.openai.com/v1";
let main_api = "kobold";

let response_generate_novel;
let characters = {};
let response_dw_bg;
let response_getstatus;


//RossAscends: Added function to format dates used in files and chat timestamps to a humanized format.
//Mostly I wanted this to be for file names, but couldn't figure out exactly where the filename save code was as everything seemed to be connected.
//During testing, this performs the same as previous date.now() structure.
//It also does not break old characters/chats, as the code just uses whatever timestamp exists in the chat.
//New chats made with characters will use this new formatting.
//Useable variable is (( humanizedISO8601Datetime ))

const delay = ms => new Promise(resolve => setTimeout(resolve, ms))

const { SentencePieceProcessor, cleanText } = require("sentencepiece-js");

let spp;

async function loadSentencepieceTokenizer() {
    try {
        const spp = new SentencePieceProcessor();
        await spp.load("src/sentencepiece/tokenizer.model");
        return spp;
    } catch (error) {
        console.error("Sentencepiece tokenizer failed to load.");
        return null;
    }
};

async function countTokensLlama(text) {
    // Fallback to strlen estimation
    if (!spp) {
        return Math.ceil(v.length / 3.35);
    }

    let cleaned = cleanText(text);

    let ids = spp.encodeIds(cleaned);
    return ids.length;
}

const tokenizersCache = {};

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
const AVATAR_WIDTH = 400;
const AVATAR_HEIGHT = 600;
const jsonParser = express.json({ limit: '100mb' });
const urlencodedParser = express.urlencoded({ extended: true, limit: '100mb' });
const baseRequestArgs = { headers: { "Content-Type": "application/json" } };
const directories = {
    worlds: 'public/worlds/',
    avatars: 'public/User Avatars',
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
    extensions: 'public/scripts/extensions',
    instruct: 'public/instruct',
    context: 'public/context',
};

// CSRF Protection //
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

// CORS Settings //
const cors = require('cors');
const CORS = cors({
    origin: 'null',
    methods: ['OPTIONS']
});

app.use(CORS);

if (listen && config.basicAuthMode) app.use(basicAuthMiddleware);

app.use(function (req, res, next) { //Security
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

    //clientIp = req.connection.remoteAddress.split(':').pop();
    if (whitelistMode === true && !whitelist.some(x => ipMatching.matches(clientIp, ipMatching.getMatch(x)))) {
        console.log('Forbidden: Connection attempt from ' + clientIp + '. If you are attempting to connect, please add your IP address in whitelist or disable whitelist mode in config.conf in root of SillyTavern folder.\n');
        return res.status(403).send('<b>Forbidden</b>: Connection attempt from <b>' + clientIp + '</b>. If you are attempting to connect, please add your IP address in whitelist or disable whitelist mode in config.conf in root of SillyTavern folder.');
    }
    next();
});

app.use((req, res, next) => {
    if (req.url.startsWith('/characters/') && is_colab && process.env.googledrive == 2) {

        const filePath = path.join(charactersPath, decodeURIComponent(req.url.substr('/characters'.length)));
        console.log('req.url: ' + req.url);
        console.log(filePath);
        fs.access(filePath, fs.constants.R_OK, (err) => {
            if (!err) {
                res.sendFile(filePath, { root: process.cwd() });
            } else {
                res.send('Character not found: ' + filePath);
                //next();
            }
        });
    } else {
        next();
    }
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
app.use(multer({ dest: "uploads" }).single("avatar"));
app.get("/", function (request, response) {
    response.sendFile(process.cwd() + "/public/index.html");
});
app.get("/notes/*", function (request, response) {
    response.sendFile(process.cwd() + "/public" + request.url + ".html");
});
app.get('/get_faq', function (_, response) {
    response.sendFile(process.cwd() + "/faq.md");
});
app.get('/get_readme', function (_, response) {
    response.sendFile(process.cwd() + "/readme.md");
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
    request.socket.on('close', function () {
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
        signal: controller.signal,
        headers: { "Content-Type": "application/json" },
    };

    const MAX_RETRIES = 10;
    const delayAmount = 3000;
    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            const data = await postAsync(api_server + "/v1/generate", args);
            console.log(data);
            return response_generate.send(data);
        }
        catch (error) {
            // data
            if (typeof error['text'] === 'function') {
                console.log(await error.text());
            }

            // response
            switch (error.statusCode) {
                case 503:
                    await delay(delayAmount);
                    break;
                default:
                    return response_generate.send({ error: true });
            }
        }
    }
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
            const streamingUrl = request.header('X-Streaming-URL');
            const websocket = new WebSocket(streamingUrl);

            websocket.on('open', async function () {
                console.log('websocket open');
                websocket.send(JSON.stringify(request.body));
            });

            websocket.on('error', (err) => {
                console.error(err);
                websocket.close();
            });

            websocket.on('close', (code, buffer) => {
                const reason = new TextDecoder().decode(buffer)
                console.log(reason);
            });

            while (true) {
                if (isGenerationStopped) {
                    console.error('Streaming stopped by user. Closing websocket...');
                    websocket.close();
                    return;
                }

                const rawMessage = await new Promise(resolve => websocket.once('message', resolve));
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

        try {
            const data = await postAsync(api_server + "/v1/generate", args);
            console.log(data);
            return response_generate.send(data);
        } catch (error) {
            console.log(error);
            return response_generate.send({ error: true });
        }
    }
});


app.post("/savechat", jsonParser, function (request, response) {
    try {
        var dir_name = String(request.body.avatar_url).replace('.png', '');
        let chat_data = request.body.chat;
        let jsonlData = chat_data.map(JSON.stringify).join('\n');
        fs.writeFileSync(`${chatsPath + dir_name}/${sanitize(String(request.body.file_name))}.jsonl`, jsonlData, 'utf8');
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

app.post("/getstatus", jsonParser, async function (request, response_getstatus = response) {
    if (!request.body) return response_getstatus.sendStatus(400);
    api_server = request.body.api_server;
    main_api = request.body.main_api;
    if (api_server.indexOf('localhost') != -1) {
        api_server = api_server.replace('localhost', '127.0.0.1');
    }
    var args = {
        headers: { "Content-Type": "application/json" }
    };
    var url = api_server + "/v1/model";
    let version = '';
    if (main_api == "kobold") {
        try {
            version = (await getAsync(api_server + "/v1/info/version")).result;
        }
        catch {
            version = '0.0.0';
        }
    }
    client.get(url, args, function (data, response) {
        if (typeof data !== 'object') {
            data = {};
        }
        if (response.statusCode == 200) {
            data.version = version;
            if (data.result != "ReadOnly") {
            } else {
                data.result = "no_connection";
            }
        } else {
            data.result = "no_connection";
        }
        response_getstatus.send(data);
    }).on('error', function () {
        response_getstatus.send({ result: "no_connection" });
    });
});

const formatApiUrl = (url) => (url.indexOf('localhost') !== -1)
    ? url.replace('localhost', '127.0.0.1')
    : url;

app.post('/getsoftprompts', jsonParser, async function (request, response) {
    if (!request.body || !request.body.api_server) {
        return response.sendStatus(400);
    }

    const baseUrl = formatApiUrl(request.body.api_server);
    let soft_prompts = [];

    try {
        const softPromptsList = (await getAsync(`${baseUrl}/v1/config/soft_prompts_list`, baseRequestArgs)).values.map(x => x.value);
        const softPromptSelected = (await getAsync(`${baseUrl}/v1/config/soft_prompt`, baseRequestArgs)).value;
        soft_prompts = softPromptsList.map(x => ({ name: x, selected: x === softPromptSelected }));
    } catch (err) {
        soft_prompts = [];
    }

    return response.send({ soft_prompts });
});

app.post("/setsoftprompt", jsonParser, async function (request, response) {
    if (!request.body || !request.body.api_server) {
        return response.sendStatus(400);
    }

    const baseUrl = formatApiUrl(request.body.api_server);
    const args = {
        headers: { "Content-Type": "application/json" },
        data: { value: request.body.name ?? '' },
    };

    try {
        await putAsync(`${baseUrl}/v1/config/soft_prompt`, args);
    } catch {
        return response.sendStatus(500);
    }

    return response.sendStatus(200);
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
                .execSync('git rev-parse --short HEAD', { cwd: process.cwd() })
                .toString().trim();

            gitBranch = require('child_process')
                .execSync('git rev-parse --abbrev-ref HEAD', { cwd: process.cwd() })
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


//***************** Main functions
function charaFormatData(data) {
    var char = {
        "name": data.ch_name,
        "description": data.description,
        "creatorcomment": data.creatorcomment,
        "personality": data.personality,
        "first_mes": data.first_mes,
        "avatar": 'none', "chat": data.ch_name + ' - ' + humanizedISO8601DateTime(),
        "mes_example": data.mes_example,
        "scenario": data.scenario,
        "create_date": humanizedISO8601DateTime(),
        "talkativeness": data.talkativeness,
        "fav": data.fav
    };
    return char;
}

app.post("/createcharacter", urlencodedParser, function (request, response) {
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
        const uploadPath = path.join("./uploads/", request.file.filename);
        charaWrite(uploadPath, char, internalName, response, avatarName, crop);
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
        // Read old file, replace name int it
        const rawOldData = await charaRead(oldAvatarPath);
        const oldData = json5.parse(rawOldData);
        oldData['name'] = newName;
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
            const newAvatarPath = path.join("./uploads/", request.file.filename);
            invalidateThumbnail('avatar', request.body.avatar_url);
            await charaWrite(newAvatarPath, char, target_img, response, 'Character saved', crop);
        }
    }
    catch {
        console.error('An error occured, character edit invalidated.');
    }
});

app.post("/deletecharacter", urlencodedParser, function (request, response) {
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

    rimraf(path.join(chatsPath, sanitize(dir_name)), (err) => {
        if (err) {
            response.send(err);
            return console.log(err);
        } else {
            //response.redirect("/");

            response.send('ok');
        }
    });
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

        fs.writeFileSync(charactersPath + target_img + '.png', new Buffer.from(encode(chunks)));
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

        // Apply crop if defined
        if (typeof crop == 'object' && [crop.x, crop.y, crop.width, crop.height].every(x => typeof x === 'number')) {
            rawImg = rawImg.crop(crop.x, crop.y, crop.width, crop.height);
        }

        const image = await rawImg.cover(AVATAR_WIDTH, AVATAR_HEIGHT).getBufferAsync(jimp.MIME_PNG);
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

app.post("/getcharacters", jsonParser, function (request, response) {
    fs.readdir(charactersPath, async (err, files) => {
        if (err) {
            console.error(err);
            return;
        }

        const pngFiles = files.filter(file => file.endsWith('.png'));

        //console.log(pngFiles);
        characters = {};
        var i = 0;
        for (const item of pngFiles) {
            try {
                var img_data = await charaRead(charactersPath + item);
                let jsonObject = json5.parse(img_data);
                jsonObject.avatar = item;
                //console.log(jsonObject);
                characters[i] = {};
                characters[i] = jsonObject;

                try {
                    const charStat = fs.statSync(path.join(charactersPath, item));
                    characters[i]['date_added'] = charStat.birthtimeMs;
                    const char_dir = path.join(chatsPath, item.replace('.png', ''));

                    let chat_size = 0;
                    let date_last_chat = 0;

                    if (fs.existsSync(char_dir)) {
                        const chats = fs.readdirSync(char_dir);

                        if (Array.isArray(chats) && chats.length) {
                            for (const chat of chats) {
                                const chatStat = fs.statSync(path.join(char_dir, chat));
                                chat_size += chatStat.size;
                                date_last_chat = Math.max(date_last_chat, chatStat.mtimeMs);
                            }
                        }
                    }

                    characters[i]['date_last_chat'] = date_last_chat;
                    characters[i]['chat_size'] = chat_size;
                }
                catch {
                    characters[i]['date_added'] = 0;
                    characters[i]['date_last_chat'] = 0;
                    characters[i]['chat_size'] = 0;
                }

                i++;
            } catch (error) {
                console.log(`Could not read character: ${item}`);
                if (error instanceof SyntaxError) {
                    console.log("String [" + (i) + "] is not valid JSON!");
                } else {
                    console.log("An unexpected error occurred: ", error);
                }
            }
        };
        //console.log(characters);
        response.send(JSON.stringify(characters));
    });

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
app.post("/setbackground", jsonParser, function (request, response) {
    var bg = "#bg1 {background-image: url('../backgrounds/" + request.body.bg + "');}";
    fs.writeFile('public/css/bg_load.css', bg, 'utf8', function (err) {
        if (err) {
            response.send(err);
            return console.log(err);
        } else {
            //response.redirect("/");
            response.send({ result: 'ok' });
        }
    });

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

    const fileName = path.join(directories.chats, '/', sanitize(request.body.id), '/', sanitize(request.body.chatfile));
    if (!fs.existsSync(fileName)) {
        console.log('Chat file not found');
        return response.sendStatus(400);
    } else {
        console.log('found the chat file: ' + fileName);
        /* fs.unlinkSync(fileName); */
        fs.rmSync(fileName);
        console.log('deleted chat file: ' + fileName);

    }


    return response.send('ok');
});


app.post("/downloadbackground", urlencodedParser, function (request, response) {
    response_dw_bg = response;
    if (!request.body) return response.sendStatus(400);

    let filedata = request.file;
    //console.log(filedata.mimetype);
    var fileType = ".png";
    var img_file = "ai";
    var img_path = "public/img/";

    img_path = "uploads/";
    img_file = filedata.filename;
    if (filedata.mimetype == "image/jpeg") fileType = ".jpeg";
    if (filedata.mimetype == "image/png") fileType = ".png";
    if (filedata.mimetype == "image/gif") fileType = ".gif";
    if (filedata.mimetype == "image/bmp") fileType = ".bmp";
    fs.copyFile(img_path + img_file, 'public/backgrounds/' + img_file + fileType, (err) => {
        invalidateThumbnail('bg', img_file + fileType);
        if (err) {

            return console.log(err);
        } else {
            //console.log(img_file+fileType);
            response_dw_bg.send(img_file + fileType);
        }
        //console.log('The image was copied from temp directory.');
    });


});

app.post("/savesettings", jsonParser, function (request, response) {
    fs.writeFile('public/settings.json', JSON.stringify(request.body), 'utf8', function (err) {
        if (err) {
            response.send(err);
            return console.log(err);
            //response.send(err);
        } else {
            //response.redirect("/");
            response.send({ result: "ok" });
        }
    });
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
            sortFunction: sortByModifiedDate(directories.novelAI_Settings),
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
            sortFunction: sortByModifiedDate(directories.textGen_Settings), removeFileExtension: true
        });

    //Kobold
    const { fileContents: koboldai_settings, fileNames: koboldai_setting_names }
        = readPresetsFromDirectory(directories.koboldAI_Settings, {
            sortFunction: sortByModifiedDate(directories.koboldAI_Settings), removeFileExtension: true
        })

    const worldFiles = fs
        .readdirSync(directories.worlds)
        .filter(file => path.extname(file).toLowerCase() === '.json')
        .sort((a, b) => a < b);
    const world_names = worldFiles.map(item => path.parse(item).name);

    const themes = readAndParseFromDirectory(directories.themes);
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
    fs.writeFileSync(filename, JSON.stringify(request.body), 'utf8');

    return response.sendStatus(200);
});

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
        return response_generate_novel.sendStatus(401);
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
        if (response.statusCode == 401) {
            console.log('Access Token is incorrect.');
            response_getstatus_novel.send({ error: true });
        }
        if (response.statusCode == 500 || response.statusCode == 501 || response.statusCode == 501 || response.statusCode == 503 || response.statusCode == 507) {
            console.log(data);
            response_getstatus_novel.send({ error: true });
        }
    }).on('error', function () {
        //console.log('');
        //console.log('something went wrong on the request', err.request.options);
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

    console.log(request.body);
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
            "top_a": request.body.top_a,
            "top_p": request.body.top_p,
            "top_k": request.body.top_k,
            "typical_p": request.body.typical_p,
            //"stop_sequences": {{187}},
            //bad_words_ids = {{50256}, {0}, {1}};
            //generate_until_sentence = true;
            "use_cache": request.body.use_cache,
            //use_string = true;
            "return_full_text": request.body.return_full_text,
            "prefix": request.body.prefix,
            "order": request.body.order
        }
    };

    const args = {
        body: JSON.stringify(data),
        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + api_key_novel },
        signal: controller.signal,
    };

    try {
        const response = await postAsync(api_novelai + "/ai/generate", args);
        console.log(response);
        return response_generate_novel.send(response);
    } catch (error) {
        switch (error?.statusCode) {
            case 400:
                console.log('Validation error');
                break;
            case 401:
                console.log('Access Token is incorrect');
                break;
            case 402:
                console.log('An active subscription is required to access this endpoint');
                break;
        }

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

                        let jsonData = json5.parse(lastLine);
                        if (jsonData.name !== undefined || jsonData.character_name !== undefined) {
                            chatData[i] = {};
                            chatData[i]['file_name'] = file;
                            chatData[i]['file_size'] = fileSizeInKB;
                            chatData[i]['chat_items'] = itemCounter - 1;
                            chatData[i]['mes'] = jsonData['mes'] || '[The chat is empty]';
                            chatData[i]['last_mes'] = jsonData['send_date'] || Date.now();
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
    let uploadPath = path.join('./uploads', filedata.filename);
    var format = request.body.file_type;
    const defaultAvatarPath = './public/img/ai4.png';
    //console.log(format);
    if (filedata) {
        if (format == 'json') {
            fs.readFile(uploadPath, 'utf8', async (err, data) => {
                if (err) {
                    console.log(err);
                    response.send({ error: true });
                }
                const jsonData = json5.parse(data);

                if (jsonData.name !== undefined) {
                    jsonData.name = sanitize(jsonData.name);

                    png_name = getPngName(jsonData.name);
                    let char = {
                        "name": jsonData.name,
                        "description": jsonData.description ?? '',
                        "creatorcomment": jsonData.creatorcomment ?? '',
                        "personality": jsonData.personality ?? '',
                        "first_mes": jsonData.first_mes ?? '',
                        "avatar": 'none', "chat": jsonData.name + " - " + humanizedISO8601DateTime(),
                        "mes_example": jsonData.mes_example ?? '',
                        "scenario": jsonData.scenario ?? '',
                        "create_date": humanizedISO8601DateTime(),
                        "talkativeness": jsonData.talkativeness ?? 0.5
                    };
                    char = JSON.stringify(char);
                    charaWrite(defaultAvatarPath, char, png_name, response, { file_name: png_name });
                } else if (jsonData.char_name !== undefined) {//json Pygmalion notepad
                    jsonData.char_name = sanitize(jsonData.char_name);

                    png_name = getPngName(jsonData.char_name);
                    let char = {
                        "name": jsonData.char_name,
                        "description": jsonData.char_persona ?? '',
                        "creatorcomment": '',
                        "personality": '',
                        "first_mes": jsonData.char_greeting ?? '',
                        "avatar": 'none',
                        "chat": jsonData.name + " - " + humanizedISO8601DateTime(),
                        "mes_example": jsonData.example_dialogue ?? '',
                        "scenario": jsonData.world_scenario ?? '',
                        "create_date": humanizedISO8601DateTime(),
                        "talkativeness": jsonData.talkativeness ?? 0.5
                    };
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
                jsonData.name = sanitize(jsonData.name);

                if (format == 'webp') {
                    try {
                        let convertedPath = path.join('./uploads', path.basename(uploadPath, ".webp") + ".png")
                        await webp.dwebp(uploadPath, convertedPath, "-o");
                        uploadPath = convertedPath;
                    }
                    catch {
                        console.error('WEBP image conversion failed. Using the default character image.');
                        uploadPath = defaultAvatarPath;
                    }
                }

                png_name = getPngName(jsonData.name);

                if (jsonData.name !== undefined) {
                    let char = {
                        "name": jsonData.name,
                        "description": jsonData.description ?? '',
                        "creatorcomment": jsonData.creatorcomment ?? '',
                        "personality": jsonData.personality ?? '',
                        "first_mes": jsonData.first_mes ?? '',
                        "avatar": 'none',
                        "chat": jsonData.name + " - " + humanizedISO8601DateTime(),
                        "mes_example": jsonData.mes_example ?? '',
                        "scenario": jsonData.scenario ?? '',
                        "create_date": humanizedISO8601DateTime(),
                        "talkativeness": jsonData.talkativeness ?? 0.5
                    };
                    char = JSON.stringify(char);
                    await charaWrite(uploadPath, char, png_name, response, { file_name: png_name });
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
        const readline = require('readline');
        const fs = require('fs');
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
                let jsonObject = json5.parse(json);
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
                let inputWebpPath = `./uploads/${Date.now()}_input.webp`;
                let outputWebpPath = `./uploads/${Date.now()}_output.webp`;
                let metadataPath = `./uploads/${Date.now()}_metadata.exif`;
                let metadata =
                {
                    "Exif": {
                        [exif.ExifIFD.UserComment]: stringByteArray,
                    },
                };
                const exifString = exif.dump(metadata);
                fs.writeFileSync(metadataPath, exifString, 'binary');

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
        fs.copyFileSync(`./uploads/${filedata.filename}`, (`${directories.groupChats}/${chatname}.jsonl`));
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
            fs.readFile(`./uploads/${filedata.filename}`, 'utf8', (err, data) => {

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
                    newChats.forEach(chat => fs.writeFile(
                        `${chatsPath + avatar_url}/${ch_name} - ${humanizedISO8601DateTime()} imported.jsonl`,
                        chat.map(JSON.stringify).join('\n'),
                        'utf8',
                        (err) => err ?? errors.push(err)
                    )
                    );

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

                    fs.writeFileSync(`${chatsPath + avatar_url}/${ch_name} - ${humanizedISO8601DateTime()} imported.jsonl`, chat.map(JSON.stringify).join('\n'), 'utf8');

                    response.send({ res: true });
                } else {
                    response.send({ error: true });
                }
            });
        }
        if (format === 'jsonl') {
            //console.log(humanizedISO8601DateTime()+':imported chat format is JSONL');
            const fileStream = fs.createReadStream('./uploads/' + filedata.filename);
            const rl = readline.createInterface({
                input: fileStream,
                crlfDelay: Infinity
            });

            rl.once('line', (line) => {
                let jsonData = json5.parse(line);

                if (jsonData.user_name !== undefined || jsonData.name !== undefined) {
                    fs.copyFile(`./uploads/${filedata.filename}`, (`${chatsPath + avatar_url}/${ch_name} - ${humanizedISO8601DateTime()}.jsonl`), (err) => {
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

    const filename = sanitize(request.file.originalname);

    if (path.parse(filename).ext.toLowerCase() !== '.json') {
        return response.status(400).send('Only JSON files are supported.')
    }

    const pathToUpload = path.join('./uploads/', request.file.filename);
    const fileContents = fs.readFileSync(pathToUpload, 'utf8');

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

    fs.writeFileSync(pathToNewFile, fileContents);
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

    const filename = `${request.body.name}.json`;
    const pathToFile = path.join(directories.worlds, filename);

    fs.writeFileSync(pathToFile, JSON.stringify(request.body.data));

    return response.send({ ok: true });
});

app.post('/uploaduseravatar', urlencodedParser, async (request, response) => {
    if (!request.file) return response.sendStatus(400);

    try {
        const pathToUpload = path.join('./uploads/' + request.file.filename);
        const crop = tryParse(request.query.crop);
        let rawImg = await jimp.read(pathToUpload);

        if (typeof crop == 'object' && [crop.x, crop.y, crop.width, crop.height].every(x => typeof x === 'number')) {
            rawImg = rawImg.crop(crop.x, crop.y, crop.width, crop.height);
        }

        const image = await rawImg.cover(AVATAR_WIDTH, AVATAR_HEIGHT).getBufferAsync(jimp.MIME_PNG);

        const filename = `${Date.now()}.png`;
        const pathToNewFile = path.join(directories.avatars, filename);
        fs.writeFileSync(pathToNewFile, image);
        fs.rmSync(pathToUpload);
        return response.send({ path: filename });
    } catch (err) {
        return response.status(400).send('Is not a valid image');
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

    const id = Date.now();
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

    fs.writeFileSync(pathToFile, fileData);
    return response.send(groupMetadata);
});

app.post('/editgroup', jsonParser, (request, response) => {
    if (!request.body || !request.body.id) {
        return response.sendStatus(400);
    }
    const id = request.body.id;
    const pathToFile = path.join(directories.groups, `${id}.json`);
    const fileData = JSON.stringify(request.body);

    fs.writeFileSync(pathToFile, fileData);
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
    fs.writeFileSync(pathToFile, jsonlData, 'utf8');
    return response.send({ ok: true });
});

app.post('/deletegroup', jsonParser, async (request, response) => {
    if (!request.body || !request.body.id) {
        return response.sendStatus(400);
    }

    const id = request.body.id;
    const pathToGroup = path.join(directories.groups, sanitize(`${id}.json`));
    const pathToChat = path.join(directories.groupChats, sanitize(`${id}.jsonl`));

    if (fs.existsSync(pathToGroup)) {
        fs.rmSync(pathToGroup);
    }

    if (fs.existsSync(pathToChat)) {
        fs.rmSync(pathToChat);
    }

    return response.send({ ok: true });
});

const POE_DEFAULT_BOT = 'a2';

async function getPoeClient(token, useCache = false) {
    let client = new poe.Client(false, useCache);
    await client.init(token);
    return client;
}

app.post('/status_poe', jsonParser, async (request, response) => {
    const token = readSecret(SECRET_KEYS.POE);

    if (!token) {
        return response.sendStatus(401);
    }

    try {
        const client = await getPoeClient(token);
        const botNames = client.get_bot_names();
        client.disconnect_ws();

        return response.send({ 'bot_names': botNames });
    }
    catch (err) {
        console.error(err);
        return response.sendStatus(401);
    }
});

app.post('/purge_poe', jsonParser, async (request, response) => {
    const token = readSecret(SECRET_KEYS.POE);

    if (!token) {
        return response.sendStatus(401);
    }

    const bot = request.body.bot ?? POE_DEFAULT_BOT;
    const count = request.body.count ?? -1;

    try {
        const client = await getPoeClient(token, true);
        await client.purge_conversation(bot, count);
        client.disconnect_ws();

        return response.send({ "ok": true });
    }
    catch (err) {
        console.error(err);
        return response.sendStatus(500);
    }
});

app.post('/generate_poe', jsonParser, async (request, response) => {
    if (!request.body.prompt) {
        return response.sendStatus(400);
    }

    const token = readSecret(SECRET_KEYS.POE);

    if (!token) {
        return response.sendStatus(401);
    }

    let isGenerationStopped = false;
    request.socket.removeAllListeners('close');
    request.socket.on('close', function () {
        isGenerationStopped = true;

        if (client) {
            client.abortController.abort();
        }
    });
    const prompt = request.body.prompt;
    const bot = request.body.bot ?? POE_DEFAULT_BOT;
    const streaming = request.body.streaming ?? false;

    let client;

    try {
        client = await getPoeClient(token, true);
    }
    catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }

    if (streaming) {
        try {
            response.writeHead(200, {
                'Content-Type': 'text/plain;charset=utf-8',
                'Transfer-Encoding': 'chunked',
                'Cache-Control': 'no-transform',
            });

            let reply = '';
            for await (const mes of client.send_message(bot, prompt)) {
                if (isGenerationStopped) {
                    console.error('Streaming stopped by user. Closing websocket...');
                    break;
                }

                let newText = mes.text.substring(reply.length);
                reply = mes.text;
                response.write(newText);
            }
            console.log(reply);
        }
        catch (err) {
            console.error(err);
        }
        finally {
            client.disconnect_ws();
            response.end();
        }
    }
    else {
        try {
            let reply;
            for await (const mes of client.send_message(bot, prompt)) {
                reply = mes.text;
            }
            console.log(reply);
            client.disconnect_ws();
            return response.send({ 'reply': reply });
        }
        catch {
            client.disconnect_ws();
            return response.sendStatus(500);
        }
    }
});

app.get('/discover_extensions', jsonParser, function (_, response) {
    const extensions = fs
        .readdirSync(directories.extensions)
        .filter(f => fs.statSync(path.join(directories.extensions, f)).isDirectory());

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

        fs.writeFileSync(pathToCachedFile, buffer);
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

    const api_key_openai = readSecret(SECRET_KEYS.OPENAI);

    if (!api_key_openai) {
        return response_getstatus_openai.sendStatus(401);
    }

    const api_url = new URL(request.body.reverse_proxy || api_openai).toString();
    const args = {
        headers: { "Authorization": "Bearer " + api_key_openai }
    };
    client.get(api_url + "/models", args, function (data, response) {
        if (response.statusCode == 200) {
            response_getstatus_openai.send(data);
            const modelIds = data?.data?.map(x => x.id)?.sort();
            console.log('Available OpenAI models:', modelIds);
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

    const tokenizer = getTiktokenTokenizer(request.query.model === 'gpt-4-0314' ? 'gpt-4' : request.query.model);

    for (const entry of request.body) {
        if (!entry || !entry.text) {
            continue;
        }

        const tokens = tokenizer.encode(entry.text);

        for (const token of tokens) {
            result[token] = entry.value;
        }
    }

    // not needed for cached tokenizers
    //tokenizer.free();
    return response.send(result);
});

// Shamelessly stolen from Agnai
app.post("/openai_usage", jsonParser, async function (request, response) {
    if (!request.body) return response.sendStatus(400);
    const key = readSecret(SECRET_KEYS.OPENAI);

    if (!key) {
        console.warn('Get key usage failed: Missing OpenAI API key.');
        return response.sendStatus(401);
    }

    const api_url = new URL(request.body.reverse_proxy || api_openai).toString();

    const headers = {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${key}`,
    };

    const date = new Date();
    date.setDate(1);
    const start_date = date.toISOString().slice(0, 10);

    date.setMonth(date.getMonth() + 1);
    const end_date = date.toISOString().slice(0, 10);

    try {
        const res = await getAsync(
            `${api_url}/dashboard/billing/usage?start_date=${start_date}&end_date=${end_date}`,
            { headers },
        );
        return response.send(res);
    }
    catch {
        return response.sendStatus(400);
    }
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

app.post("/generate_openai", jsonParser, function (request, response_generate_openai) {
    if (!request.body) return response_generate_openai.sendStatus(400);
    const api_url = new URL(request.body.reverse_proxy || api_openai).toString();

    const api_key_openai = readSecret(SECRET_KEYS.OPENAI);

    if (!api_key_openai) {
        return response_generate_openai.sendStatus(401);
    }

    const controller = new AbortController();
    request.socket.removeAllListeners('close');
    request.socket.on('close', function () {
        controller.abort();
    });

    console.log(request.body);
    const config = {
        method: 'post',
        url: api_url + '/chat/completions',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + api_key_openai
        },
        data: {
            "messages": request.body.messages,
            "model": request.body.model,
            "temperature": request.body.temperature,
            "max_tokens": request.body.max_tokens,
            "stream": request.body.stream,
            "presence_penalty": request.body.presence_penalty,
            "frequency_penalty": request.body.frequency_penalty,
            "top_p": request.body.top_p,
            "stop": request.body.stop,
            "logit_bias": request.body.logit_bias
        },
        signal: controller.signal,
    };

    if (request.body.stream)
        config.responseType = 'stream';

    axios(config)
        .then(function (response) {
            if (response.status <= 299) {
                if (request.body.stream) {
                    console.log("Streaming request in progress")
                    response.data.pipe(response_generate_openai);
                    response.data.on('end', function () {
                        console.log("Streaming request finished");
                        response_generate_openai.end();
                    });
                } else {
                    response_generate_openai.send(response.data);
                    console.log(response.data);
                    console.log(response.data?.choices[0]?.message);
                }
            } else if (response.status == 400) {
                console.log('Validation error');
                response_generate_openai.send({ error: true });
            } else if (response.status == 401) {
                console.log('Access Token is incorrect');
                response_generate_openai.send({ error: true });
            } else if (response.status == 402) {
                console.log('An active subscription is required to access this endpoint');
                response_generate_openai.send({ error: true });
            } else if (response.status == 429) {
                console.log('Out of quota');
                const quota_error = response?.data?.type === 'insufficient_quota';
                response_generate_openai.send({ error: true, quota_error, });
            } else if (response.status == 500 || response.status == 409 || response.status == 504) {
                if (request.body.stream) {
                    response.data.on('data', chunk => {
                        console.log(chunk.toString());
                    });
                } else {
                    console.log(response.data);
                }
                response_generate_openai.send({ error: true });
            }
        })
        .catch(function (error) {
            if (error.response) {
                if (request.body.stream) {
                    error.response.data.on('data', chunk => {
                        console.log(chunk.toString());
                    });
                } else {
                    console.log(error.response.data);
                }
            }
            try {
                const quota_error = error?.response?.status === 429 && error?.response?.data?.error?.type === 'insufficient_quota';
                if (!response_generate_openai.headersSent) {
                    response_generate_openai.send({ error: true, quota_error });
                }
            } catch (error) {
                console.error(error);
                if (!response_generate_openai.headersSent) {
                    return response_generate_openai.send({ error: true });
                }
            } finally {
                response_generate_openai.end();
            }
        });
});

app.post("/tokenize_openai", jsonParser, function (request, response_tokenize_openai = response) {
    if (!request.body) return response_tokenize_openai.sendStatus(400);

    const tokensPerName = request.query.model.includes('gpt-4') ? 1 : -1;
    const tokensPerMessage = request.query.model.includes('gpt-4') ? 3 : 4;
    const tokensPadding = 3;

    const tokenizer = getTiktokenTokenizer(request.query.model === 'gpt-4-0314' ? 'gpt-4' : request.query.model);

    let num_tokens = 0;
    for (const msg of request.body) {
        num_tokens += tokensPerMessage;
        for (const [key, value] of Object.entries(msg)) {
            num_tokens += tokenizer.encode(value).length;
            if (key == "name") {
                num_tokens += tokensPerName;
            }
        }
    }
    num_tokens += tokensPadding;

    // not needed for cached tokenizers
    //tokenizer.free();

    response_tokenize_openai.send({ "token_count": num_tokens });
});

app.post("/savepreset_openai", jsonParser, function (request, response) {
    const name = sanitize(request.query.name);
    if (!request.body || !name) {
        return response.sendStatus(400);
    }

    const filename = `${name}.settings`;
    const fullpath = path.join(directories.openAI_Settings, filename);
    fs.writeFileSync(fullpath, JSON.stringify(request.body), 'utf-8');
    return response.send({ name });
});

app.post("/tokenize_llama", jsonParser, async function (request, response) {
    if (!request.body) {
        return response.sendStatus(400);
    }

    const count = await countTokensLlama(request.body.text);
    return response.send({ count });
});

// ** REST CLIENT ASYNC WRAPPERS **

function putAsync(url, args) {
    return new Promise((resolve, reject) => {
        client.put(url, args, (data, response) => {
            if (response.statusCode >= 400) {
                reject(data);
            }
            resolve(data);
        }).on('error', e => reject(e));
    })
}

async function postAsync(url, args) {
    const fetch = require('node-fetch').default;
    const response = await fetch(url, { method: 'POST', timeout: 0, ...args });

    if (response.ok) {
        const data = await response.json();
        return data;
    }

    throw new Error(response);
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
    migrateSecrets();
    ensurePublicDirectoriesExist();
    await ensureThumbnailCache();

    // Colab users could run the embedded tool
    if (!is_colab) await convertWebp();

    spp = await loadSentencepieceTokenizer();

    console.log('Launching...');

    if (autorun) open(autorunUrl.toString());
    console.log('SillyTavern is listening on: ' + tavernUrl);
}

if (listen && !config.whitelistMode && !config.basicAuthMode) {
    if (config.securityOverride)
        console.warn("Security has been override. If it's not a trusted network, change the settings.");
    else {
        console.error('Your SillyTavern is currently unsecurely open to the public. Enable whitelisting or basic authentication.');
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
            tavernUrl.port,
            tavernUrl.hostname,
            setupTasks
        );
else
    http.createServer(app).listen(
        tavernUrl.port,
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
    OPENAI: 'api_key_openai',
    POE: 'api_key_poe',
    NOVEL: 'api_key_novel',
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
        const poeKey = settings?.poe_settings?.token;
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

        if (typeof poeKey === 'string') {
            console.log('Migrating Poe key...');
            writeSecret(SECRET_KEYS.POE, poeKey);
            delete settings.poe_settings.token;
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
            fs.writeFileSync(SETTINGS_FILE, settingsContent, "utf-8");
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
        console.error(error);
        return response.sendStatus(500);
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
    const samplers = Object.values(ai_horde.ModelGenerationInputStableSamplers);
    response.send(samplers);
});

app.post('/horde_models', jsonParser, async (_, response) => {
    const models = await ai_horde.getModels();
    response.send(models);
});

app.post('/horde_userinfo', jsonParser, async (_, response) => {
    const api_key_horde = readSecret(SECRET_KEYS.HORDE);

    if (!api_key_horde) {
        return response.send({ anonymous: true });
    }

    try {
        const user = await ai_horde.findUser({ token: api_key_horde });
        return response.send(user);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
})

app.post('/horde_generateimage', jsonParser, async (request, response) => {
    const MAX_ATTEMPTS = 100;
    const CHECK_INTERVAL = 3000;
    const api_key_horde = readSecret(SECRET_KEYS.HORDE) || ANONYMOUS_KEY;
    console.log('Stable Horde request:', request.body);

    try {
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

        const spritePackPath = path.join("./uploads/", file.filename);
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
            fs.writeFileSync(pathToSprite, buffer);
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
        const spritePath = path.join("./uploads/", file.filename);
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

function writeSecret(key, value) {
    if (!fs.existsSync(SECRETS_FILE)) {
        const emptyFile = JSON.stringify({});
        fs.writeFileSync(SECRETS_FILE, emptyFile, "utf-8");
    }

    const fileContents = fs.readFileSync(SECRETS_FILE);
    const secrets = JSON.parse(fileContents);
    secrets[key] = value;
    fs.writeFileSync(SECRETS_FILE, JSON.stringify(secrets), "utf-8");
}

function readSecret(key) {
    if (!fs.existsSync(SECRETS_FILE)) {
        return undefined;
    }

    const fileContents = fs.readFileSync(SECRETS_FILE);
    const secrets = JSON.parse(fileContents);
    return secrets[key];
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
