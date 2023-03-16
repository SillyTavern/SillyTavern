const express = require('express');
const app = express();
const fs = require('fs');
const readline = require('readline');
const open = require('open');

const rimraf = require("rimraf");
const multer = require("multer");
const https = require('https');
//const PNG = require('pngjs').PNG;
const extract = require('png-chunks-extract');
const encode = require('png-chunks-encode');
const PNGtext = require('png-chunk-text');

const jimp = require('jimp');
const path = require('path');

const cookieParser = require('cookie-parser');
const crypto = require('crypto');
const ipaddr = require('ipaddr.js');

const config = require(path.join(process.cwd(), './config.conf'));
const server_port = config.port;
const whitelist = config.whitelist;
const whitelistMode = config.whitelistMode;
const autorun = config.autorun;
const enableExtensions = config.enableExtensions;


var Client = require('node-rest-client').Client;
var client = new Client();

var api_server = "http://0.0.0.0:5000";
var api_novelai = "https://api.novelai.net";
var main_api = "kobold";

var response_get_story;
var response_generate;
var response_generate_novel;
var request_promt;
var response_promt;
var characters = {};
var character_i = 0;
var response_create;
var response_edit;
var response_dw_bg;
var response_getstatus;
var response_getstatus_novel;
var response_getlastversion;
var api_key_novel;

//RossAscends: Added function to format dates used in files and chat timestamps to a humanized format.
//Mostly I wanted this to be for file names, but couldn't figure out exactly where the filename save code was as everything seemed to be connected. 
//During testing, this performs the same as previous date.now() structure.
//It also does not break old characters/chats, as the code just uses whatever timestamp exists in the chat.
//New chats made with characters will use this new formatting.
//Useable variable is (( humanizedISO8601Datetime ))



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

var is_colab = false;
var charactersPath = 'public/characters/';
var chatsPath = 'public/chats/';
if (is_colab && process.env.googledrive == 2) {
    charactersPath = '/content/drive/MyDrive/TavernAI/characters/';
    chatsPath = '/content/drive/MyDrive/TavernAI/chats/';
}
const jsonParser = express.json({ limit: '100mb' });
const urlencodedParser = express.urlencoded({ extended: true, limit: '100mb' });
const baseRequestArgs = { headers: { "Content-Type": "application/json" } };
const directories = {
    worlds: 'public/worlds/',
    avatars: 'public/User Avatars',
    groups: 'public/groups/',
    groupChats: 'public/group chats',
};

// CSRF Protection //
const doubleCsrf = require('csrf-csrf').doubleCsrf;

const CSRF_SECRET = crypto.randomBytes(8).toString('hex');
const COOKIES_SECRET = crypto.randomBytes(8).toString('hex');

const { invalidCsrfTokenError, generateToken, doubleCsrfProtection } = doubleCsrf({
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
    if (whitelistMode === true && !whitelist.includes(clientIp)) {
        console.log('Forbidden: Connection attempt from ' + clientIp + '. If you are attempting to connect, please add your IP address in whitelist or disable whitelist mode in config.conf in root of TavernAI folder.\n');
        return res.status(403).send('<b>Forbidden</b>: Connection attempt from <b>' + clientIp + '</b>. If you are attempting to connect, please add your IP address in whitelist or disable whitelist mode in config.conf in root of TavernAI folder.');
    }
    next();
});

app.use((req, res, next) => {
    if (req.url.startsWith('/characters/') && is_colab && process.env.googledrive == 2) {

        const filePath = path.join(charactersPath, decodeURIComponent(req.url.substr('/characters'.length)));
        fs.access(filePath, fs.constants.R_OK, (err) => {
            if (!err) {
                res.sendFile(filePath);
            } else {
                res.send('Character not found: ' + filePath);
                //next();
            }
        });
    } else {
        next();
    }
});

app.use(express.static(__dirname + "/public", { refresh: true }));

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
        //res.contentType('image/jpeg');
        res.send(data);
    });
});
app.use(multer({ dest: "uploads" }).single("avatar"));
app.get("/", function (request, response) {
    response.sendFile(__dirname + "/public/index.html");
    //response.send("<h1>Главная страница</h1>");
});
app.get("/notes/*", function (request, response) {
    response.sendFile(__dirname + "/public" + request.url + ".html");
    //response.send("<h1>Главная страница</h1>");
});
app.post("/getlastversion", jsonParser, function (request, response_getlastversion = response) {
    if (!request.body) return response_getlastversion.sendStatus(400);

    const repo = 'TavernAI/TavernAI';
    let req;
    req = https.request({
        hostname: 'github.com',
        path: `/${repo}/releases/latest`,
        method: 'HEAD'
    }, (res) => {
        if (res.statusCode === 302) {
            const glocation = res.headers.location;
            const versionStartIndex = glocation.lastIndexOf('@') + 1;
            const version = glocation.substring(versionStartIndex);
            //console.log(version);
            response_getlastversion.send({ version: version });
        } else {
            response_getlastversion.send({ version: 'error' });
        }
    });

    req.on('error', (error) => {
        console.error(error);
        response_getlastversion.send({ version: 'error' });
    });

    req.end();
});

//**************Kobold api
app.post("/generate", jsonParser, function (request, response_generate = response) {
    if (!request.body) return response_generate.sendStatus(400);
    //console.log(request.body.prompt);
    //const dataJson = JSON.parse(request.body);
    request_promt = request.body.prompt;

    //console.log(request.body);
    var this_settings = {
        prompt: request_promt,
        use_story: false,
        use_memory: false,
        use_authors_note: false,
        use_world_info: false,
        max_context_length: request.body.max_context_length
        //temperature: request.body.temperature,
        //max_length: request.body.max_length
    };

    if (request.body.gui_settings == false) {
        var sampler_order = [request.body.s1, request.body.s2, request.body.s3, request.body.s4, request.body.s5, request.body.s6, request.body.s7];
        this_settings = {
            prompt: request_promt,
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
            sampler_order: sampler_order
        };
    }

    console.log(this_settings);
    var args = {
        data: this_settings,
        headers: { "Content-Type": "application/json" }
    };
    client.post(api_server + "/v1/generate", args, function (data, response) {
        if (response.statusCode == 200) {
            console.log(data);
            response_generate.send(data);
        }
        if (response.statusCode == 422) {
            console.log('Validation error');
            response_generate.send({ error: true });
        }
        if (response.statusCode == 501 || response.statusCode == 503 || response.statusCode == 507) {
            console.log(data);
            response_generate.send({ error: true });
        }
    }).on('error', function (err) {
        console.log(err);
        //console.log('something went wrong on the request', err.request.options);
        response_generate.send({ error: true });
    });
});

//************** Text generation web UI
app.post("/generate_textgenerationwebui", jsonParser, function (request, response_generate = response) {
    if (!request.body) return response_generate.sendStatus(400);

    console.log(request.body);
    var args = {
        data: request.body,
        headers: { "Content-Type": "application/json" }
    };
    client.post(api_server + "/run/textgen", args, function (data, response) {
        console.log("####", data);
        if (response.statusCode == 200) {
            console.log(data);
            response_generate.send(data);
        }
        if (response.statusCode == 422) {
            console.log('Validation error');
            response_generate.send({ error: true });
        }
        if (response.statusCode == 501 || response.statusCode == 503 || response.statusCode == 507) {
            console.log(data);
            response_generate.send({ error: true });
        }
    }).on('error', function (err) {
        console.log(err);
        //console.log('something went wrong on the request', err.request.options);
        response_generate.send({ error: true });
    });
});


app.post("/savechat", jsonParser, function (request, response) {
    //console.log(humanizedISO8601DateTime()+':/savechat/ entered');
    //console.log(request.data);
    //console.log(request.body.bg);
    //const data = request.body;
    //console.log(request);
    //console.log(request.body.chat);
    //var bg = "body {background-image: linear-gradient(rgba(19,21,44,0.75), rgba(19,21,44,0.75)), url(../backgrounds/"+request.body.bg+");}";
    var dir_name = String(request.body.avatar_url).replace('.png', '');
    //console.log(humanizedISO8601DateTime()+':/savechat sees '+dir_name+' as the character name (derived from avatar PNG filename)');
    let chat_data = request.body.chat;
    let jsonlData = chat_data.map(JSON.stringify).join('\n');
    //console.log(humanizedISO8601DateTime()+':/savechat saving a chat named '+request.body.file_name+'.jsonl');
    fs.writeFile(chatsPath + dir_name + "/" + request.body.file_name + '.jsonl', jsonlData, 'utf8', function (err) {
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
app.post("/getchat", jsonParser, function (request, response) {
    //console.log(request.data);
    //console.log(request.body.bg);
    //const data = request.body;
    //console.log(request);
    //console.log(request.body.chat);
    //var bg = "body {background-image: linear-gradient(rgba(19,21,44,0.75), rgba(19,21,44,0.75)), url(../backgrounds/"+request.body.bg+");}";
    //console.log(humanizedISO8601DateTime()+':/getchat entered');
    var dir_name = String(request.body.avatar_url).replace('.png', '');

    fs.stat(chatsPath + dir_name, function (err, stat) {

        if (stat === undefined) {		//if no chat dir for the character is found, make one with the character name

            fs.mkdirSync(chatsPath + dir_name);
            response.send({});
            return;
        } else {

            if (err === null) { //if there is a dir, then read the requested file from the JSON call

                fs.stat(chatsPath + dir_name + "/" + request.body.file_name + ".jsonl", function (err, stat) {

                    if (err === null) { //if no error (the file exists), read the file
                        //console.log(humanizedISO8601DateTime()+':/getchat tries to access: '+chatsPath+dir_name+'/'+request.body.file_name+'.jsonl');                        
                        if (stat !== undefined) {
                            fs.readFile(chatsPath + dir_name + "/" + request.body.file_name + ".jsonl", 'utf8', (err, data) => {
                                if (err) {
                                    console.error(err);
                                    response.send(err);
                                    return;
                                }
                                //console.log(data);
                                const lines = data.split('\n');

                                // Iterate through the array of strings and parse each line as JSON
                                const jsonData = lines.map(JSON.parse);
                                response.send(jsonData);
                                //console.log('read the requested file')

                            });
                        }
                    } else {
                        response.send({});
                        //return console.log(err);
                        return;
                    }
                });
            } else {
                console.error(err);
                response.send({});
                return;
            }
        }
    });


});
app.post("/getstatus", jsonParser, function (request, response_getstatus = response) {
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
    if (main_api == "textgenerationwebui") {
        url = api_server;
        args = {}
    }
    client.get(url, args, function (data, response) {
        if (response.statusCode == 200) {
            if (main_api == "textgenerationwebui") {
                // console.log(body);
                try {
                    var body = data.toString();
                    var response = body.match(/gradio_config[ =]*(\{.*\});/)[1];
                    if (!response)
                        throw "no_connection";
                    data = { result: JSON.parse(response).components.filter((x) => x.props.label == "Model")[0].props.value };
                    if (!data)
                        throw "no_connection";
                } catch {
                    data = { result: "no_connection" };
                }
            } else {
                if (data.result != "ReadOnly") {
                    //response_getstatus.send(data.result);
                } else {
                    data.result = "no_connection";
                }
            }
        } else {
            data.result = "no_connection";
        }
        response_getstatus.send(data);
        //console.log(response.statusCode);
        //console.log(data);
        //response_getstatus.send(data);
        //data.results[0].text
    }).on('error', function (err) {
        //console.log(url);
        //console.log('something went wrong on the request', err.request.options);
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

function checkServer() {
    //console.log('Check run###################################################');
    api_server = 'http://127.0.0.1:5000';
    var args = {
        headers: { "Content-Type": "application/json" }
    };
    client.get(api_server + "/v1/model", args, function (data, response) {
        console.log(data.result);
        //console.log('###################################################');
        console.log(data);
    }).on('error', function (err) {
        console.log(err);
        //console.log('');
        //console.log('something went wrong on the request', err.request.options);
        //console.log('errorrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrrr');
    });
}

//***************** Main functions
function charaFormatData(data) {
    var char = { "name": data.ch_name, "description": data.description, "personality": data.personality, "first_mes": data.first_mes, "avatar": 'none', "chat": data.ch_name + ' - ' + humanizedISO8601DateTime(), "mes_example": data.mes_example, "scenario": data.scenario, "create_date": humanizedISO8601DateTime(), "talkativeness": data.talkativeness };
    return char;
}
app.post("/createcharacter", urlencodedParser, function (request, response) {



    //var sameNameChar = fs.existsSync(charactersPath+request.body.ch_name+'.png');
    //if (sameNameChar == true) return response.sendStatus(500);
    if (!request.body) return response.sendStatus(400);
    console.log('/createcharacter -- looking for -- ' + (charactersPath + request.body.ch_name + '.png'));
    console.log('Does this file already exists? ' + fs.existsSync(charactersPath + request.body.ch_name + '.png'));
    if (!fs.existsSync(charactersPath + request.body.ch_name + '.png')) {
        if (!fs.existsSync(chatsPath + request.body.ch_name)) fs.mkdirSync(chatsPath + request.body.ch_name);
        let filedata = request.file;
        //console.log(filedata.mimetype);
        var fileType = ".png";
        var img_file = "ai";
        var img_path = "public/img/";
        var char = charaFormatData(request.body);//{"name": request.body.ch_name, "description": request.body.description, "personality": request.body.personality, "first_mes": request.body.first_mes, "avatar": 'none', "chat": Date.now(), "last_mes": '', "mes_example": ''};
        char = JSON.stringify(char);
        if (!filedata) {
            charaWrite('./public/img/fluffy.png', char, request.body.ch_name, response);
        } else {

            img_path = "./uploads/";
            img_file = filedata.filename
            if (filedata.mimetype == "image/jpeg") fileType = ".jpeg";
            if (filedata.mimetype == "image/png") fileType = ".png";
            if (filedata.mimetype == "image/gif") fileType = ".gif";
            if (filedata.mimetype == "image/bmp") fileType = ".bmp";
            charaWrite(img_path + img_file, char, request.body.ch_name, response);
        }
        //console.log("The file was saved.");

    } else {
        console.error("Error: Cannot save file. A character with that name already exists.");
        response.send("Error: A character with that name already exists.");
        //response.send({error: true});
    }
    //console.log(request.body);
    //response.send(request.body.ch_name);

    //response.redirect("https://metanit.com")
});


app.post("/editcharacter", urlencodedParser, async function (request, response) {
    if (!request.body) return response.sendStatus(400);
    let filedata = request.file;
    //console.log(filedata.mimetype);
    var fileType = ".png";
    var img_file = "ai";
    var img_path = charactersPath;

    var char = charaFormatData(request.body);//{"name": request.body.ch_name, "description": request.body.description, "personality": request.body.personality, "first_mes": request.body.first_mes, "avatar": request.body.avatar_url, "chat": request.body.chat, "last_mes": request.body.last_mes, "mes_example": ''};
    char.chat = request.body.chat;
    char.create_date = request.body.create_date;

    char = JSON.stringify(char);
    let target_img = (request.body.avatar_url).replace('.png', '');

    try {
        if (!filedata) {

            await charaWrite(img_path + request.body.avatar_url, char, target_img, response, 'Character saved');
        } else {
            //console.log(filedata.filename);
            img_path = "uploads/";
            img_file = filedata.filename;

            await charaWrite(img_path + img_file, char, target_img, response, 'Character saved');
            //response.send('Character saved');
        }
    }
    catch {
        return response.send(400);
    }
});
app.post("/deletecharacter", urlencodedParser, function (request, response) {
    if (!request.body) return response.sendStatus(400);
    rimraf(charactersPath + request.body.avatar_url, (err) => {
        if (err) {
            response.send(err);
            return console.log(err);
        } else {
            //response.redirect("/");
            let dir_name = request.body.avatar_url;
            rimraf(chatsPath + dir_name.replace('.png', ''), (err) => {
                if (err) {
                    response.send(err);
                    return console.log(err);
                } else {
                    //response.redirect("/");

                    response.send('ok');
                }
            });
        }
    });
});

async function charaWrite(img_url, data, target_img, response = undefined, mes = 'ok') {
    try {
        // Read the image, resize, and save it as a PNG into the buffer
        const rawImg = await jimp.read(img_url);
        const image = await rawImg.cover(400, 600).getBufferAsync(jimp.MIME_PNG);

        // Get the chunks
        const chunks = extract(image);
        const tEXtChunks = chunks.filter(chunk => chunk.create_date === 'tEXt');

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


    } catch (err) {
        console.log(err);
        if (response !== undefined) response.send(err);
    }
}





function charaRead(img_url) {
    const buffer = fs.readFileSync(img_url);
    const chunks = extract(buffer);

    const textChunks = chunks.filter(function (chunk) {
        return chunk.name === 'tEXt';
    }).map(function (chunk) {
        //console.log(text.decode(chunk.data));
        return PNGtext.decode(chunk.data);
    });
    var base64DecodedData = Buffer.from(textChunks[0].text, 'base64').toString('utf8');
    return base64DecodedData;//textChunks[0].text;
    //console.log(textChunks[0].keyword); // 'hello'
    //console.log(textChunks[0].text);    // 'world'
}

app.post("/getcharacters", jsonParser, function (request, response) {
    fs.readdir(charactersPath, (err, files) => {
        if (err) {
            console.error(err);
            return;
        }

        const pngFiles = files.filter(file => file.endsWith('.png'));

        //console.log(pngFiles);
        characters = {};
        var i = 0;
        pngFiles.forEach(item => {
            //console.log(item);
            var img_data = charaRead(charactersPath + item);
            try {
                let jsonObject = JSON.parse(img_data);
                jsonObject.avatar = item;
                //console.log(jsonObject);
                characters[i] = {};
                characters[i] = jsonObject;
                i++;
            } catch (error) {
                if (error instanceof SyntaxError) {
                    console.log("String [" + (i) + "] is not valid JSON!");
                } else {
                    console.log("An unexpected error occurred: ", error);
                }
            }
        });
        //console.log(characters);
        response.send(JSON.stringify(characters));
    });
    //var directories = getDirectories("public/characters");
    //console.log(directories[0]);
    //characters = {};
    //character_i = 0;
    //getCharacterFile(directories, response,0);

});
app.post("/getbackgrounds", jsonParser, function (request, response) {
    var images = getImages("public/backgrounds");
    if (is_colab === true) {
        images = ['tavern.png'];
    }
    response.send(JSON.stringify(images));

});
app.post("/iscolab", jsonParser, function (request, response) {
    let send_data = false;
    if (process.env.colaburl !== undefined) {
        send_data = String(process.env.colaburl).trim();
    }
    response.send({ colaburl: send_data });

});
app.post("/getuseravatars", jsonParser, function (request, response) {
    var images = getImages("public/User Avatars");
    response.send(JSON.stringify(images));

});
app.post("/setbackground", jsonParser, function (request, response) {
    //console.log(request.data);
    //console.log(request.body.bg);
    //const data = request.body;
    //console.log(request);
    //console.log(1);
    var bg = "#bg1 {background-image: url(../backgrounds/" + request.body.bg + ");}";
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
    rimraf('public/backgrounds/' + request.body.bg, (err) => {
        if (err) {
            response.send(err);
            return console.log(err);
        } else {
            //response.redirect("/");
            response.send('ok');
        }
    });

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
app.post('/getsettings', jsonParser, (request, response) => { //Wintermute's code
    const koboldai_settings = [];
    const koboldai_setting_names = [];
    const novelai_settings = [];
    const novelai_setting_names = [];
    const settings = fs.readFileSync('public/settings.json', 'utf8', (err, data) => {
        if (err) return response.sendStatus(500);

        return data;
    });
    //Kobold
    const files = fs
        .readdirSync('public/KoboldAI Settings')
        .sort(
            (a, b) =>
                new Date(fs.statSync(`public/KoboldAI Settings/${b}`).mtime) -
                new Date(fs.statSync(`public/KoboldAI Settings/${a}`).mtime)
        );

    const worldFiles = fs
        .readdirSync(directories.worlds)
        .filter(file => path.extname(file).toLowerCase() === '.json')
        .sort((a, b) => a < b);
    const world_names = worldFiles.map(item => path.parse(item).name);

    files.forEach(item => {
        const file = fs.readFileSync(
            `public/KoboldAI Settings/${item}`,
            'utf8',
            (err, data) => {
                if (err) return response.sendStatus(500)

                return data;
            }
        );
        koboldai_settings.push(file);
        koboldai_setting_names.push(item.replace(/\.[^/.]+$/, ''));
    });

    //Novel
    const files2 = fs
        .readdirSync('public/NovelAI Settings')
        .sort(
            (a, b) =>
                new Date(fs.statSync(`public/NovelAI Settings/${b}`).mtime) -
                new Date(fs.statSync(`public/NovelAI Settings/${a}`).mtime)
        );

    files2.forEach(item => {
        const file2 = fs.readFileSync(
            `public/NovelAI Settings/${item}`,
            'utf8',
            (err, data) => {
                if (err) return response.sendStatus(500);

                return data;
            }
        );

        novelai_settings.push(file2);
        novelai_setting_names.push(item.replace(/\.[^/.]+$/, ''));
    });

    response.send({
        settings,
        koboldai_settings,
        koboldai_setting_names,
        world_names,
        novelai_settings,
        novelai_setting_names,
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
    const filename = `${worldInfoName}.json`;
    const pathToWorldInfo = path.join(directories.worlds, filename);

    if (!fs.existsSync(pathToWorldInfo)) {
        throw new Error(`World info file ${filename} doesn't exist.`);
    }

    fs.rmSync(pathToWorldInfo);

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
    const worldInfo = JSON.parse(worldInfoText);
    return worldInfo;
}

function getCharacterFile(directories, response, i) { //old need del
    if (directories.length > i) {

        fs.stat(charactersPath + directories[i] + '/' + directories[i] + ".json", function (err, stat) {
            if (err == null) {
                fs.readFile(charactersPath + directories[i] + '/' + directories[i] + ".json", 'utf8', (err, data) => {
                    if (err) {
                        console.error(err);
                        return;
                    }
                    //console.log(data);

                    characters[character_i] = {};
                    characters[character_i] = data;
                    i++;
                    character_i++;
                    getCharacterFile(directories, response, i);
                });
            } else {
                i++;
                getCharacterFile(directories, response, i);
            }
        });

    } else {
        response.send(JSON.stringify(characters));
    }
}
function getImages(path) {
    return fs.readdirSync(path).sort(function (a, b) {
        return new Date(fs.statSync(path + '/' + a).mtime) - new Date(fs.statSync(path + '/' + b).mtime);
    }).reverse();
}
function getKoboldSettingFiles(path) {
    return fs.readdirSync(path).sort(function (a, b) {
        return new Date(fs.statSync(path + '/' + a).mtime) - new Date(fs.statSync(path + '/' + b).mtime);
    }).reverse();
}
function getDirectories(path) {
    return fs.readdirSync(path).sort(function (a, b) {
        return new Date(fs.statSync(path + '/' + a).mtime) - new Date(fs.statSync(path + '/' + b).mtime);
    }).reverse();
}

//***********Novel.ai API 

app.post("/getstatus_novelai", jsonParser, function (request, response_getstatus_novel = response) {

    if (!request.body) return response_getstatus_novel.sendStatus(400);
    api_key_novel = request.body.key;
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
    }).on('error', function (err) {
        //console.log('');
        //console.log('something went wrong on the request', err.request.options);
        response_getstatus_novel.send({ error: true });
    });
});



app.post("/generate_novelai", jsonParser, function (request, response_generate_novel = response) {
    if (!request.body) return response_generate_novel.sendStatus(400);

    console.log(request.body);
    var data = {
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
            "repetition_penalty_frequency": request.body.repetition_penalty_frequency,
            "repetition_penalty_presence": request.body.repetition_penalty_presence,
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

    var args = {
        data: data,

        headers: { "Content-Type": "application/json", "Authorization": "Bearer " + api_key_novel }
    };
    client.post(api_novelai + "/ai/generate", args, function (data, response) {
        if (response.statusCode == 201) {
            console.log(data);
            response_generate_novel.send(data);
        }
        if (response.statusCode == 400) {
            console.log('Validation error');
            response_generate_novel.send({ error: true });
        }
        if (response.statusCode == 401) {
            console.log('Access Token is incorrect');
            response_generate_novel.send({ error: true });
        }
        if (response.statusCode == 402) {
            console.log('An active subscription is required to access this endpoint');
            response_generate_novel.send({ error: true });
        }
        if (response.statusCode == 500 || response.statusCode == 409) {
            console.log(data);
            response_generate_novel.send({ error: true });
        }
    }).on('error', function (err) {
        //console.log('');
        //console.log('something went wrong on the request', err.request.options);
        response_getstatus.send({ error: true });
    });
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
        console.log('looking for JSONL files');
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
                const rl = readline.createInterface({
                    input: fileStream,
                    crlfDelay: Infinity
                });

                let lastLine;
                rl.on('line', (line) => {
                    lastLine = line;
                });
                rl.on('close', () => {
                    if (lastLine) {
                        let jsonData = JSON.parse(lastLine);
                        if (jsonData.name !== undefined) {
                            chatData[i] = {};
                            chatData[i]['file_name'] = file;
                            chatData[i]['mes'] = jsonData['mes'];
                            ii--;
                            if (ii === 0) {
                                console.log('ii count went to zero, responding with chatData');
                                response.send(chatData);
                            }
                        } else {
                            console.log('just returning from getallchatsofcharacter');
                            return;
                        }
                    }
                    console.log('successfully closing getallchatsofcharacter');
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
    //console.log(filedata.filename);
    var format = request.body.file_type;
    //console.log(format);
    if (filedata) {
        if (format == 'json') {
            fs.readFile('./uploads/' + filedata.filename, 'utf8', async (err, data) => {
                if (err) {
                    console.log(err);
                    response.send({ error: true });
                }
                const jsonData = JSON.parse(data);

                if (jsonData.name !== undefined) {
                    png_name = getPngName(jsonData.name);
                    let char = { "name": jsonData.name, "description": jsonData.description ?? '', "personality": jsonData.personality ?? '', "first_mes": jsonData.first_mes ?? '', "avatar": 'none', "chat": humanizedISO8601DateTime(), "mes_example": jsonData.mes_example ?? '', "scenario": jsonData.scenario ?? '', "create_date": humanizedISO8601DateTime(), "talkativeness": jsonData.talkativeness ?? 0.5 };
                    char = JSON.stringify(char);
                    charaWrite('./public/img/fluffy.png', char, png_name, response, { file_name: png_name });
                } else if (jsonData.char_name !== undefined) {//json Pygmalion notepad
                    png_name = getPngName(jsonData.char_name);
                    let char = { "name": jsonData.char_name, "description": jsonData.char_persona ?? '', "personality": '', "first_mes": jsonData.char_greeting ?? '', "avatar": 'none', "chat": humanizedISO8601DateTime(), "mes_example": jsonData.example_dialogue ?? '', "scenario": jsonData.world_scenario ?? '', "create_date": humanizedISO8601DateTime(), "talkativeness": jsonData.talkativeness ?? 0.5 };
                    char = JSON.stringify(char);
                    charaWrite('./public/img/fluffy.png', char, png_name, response, { file_name: png_name });
                } else {
                    console.log('Incorrect character format .json');
                    response.send({ error: true });
                }
            });
        } else {
            try {

                var img_data = charaRead('./uploads/' + filedata.filename);
                let jsonData = JSON.parse(img_data);
                png_name = getPngName(jsonData.name);

                if (jsonData.name !== undefined) {
                    let char = { "name": jsonData.name, "description": jsonData.description ?? '', "personality": jsonData.personality ?? '', "first_mes": jsonData.first_mes ?? '', "avatar": 'none', "chat": humanizedISO8601DateTime(), "mes_example": jsonData.mes_example ?? '', "scenario": jsonData.scenario ?? '', "create_date": humanizedISO8601DateTime(), "talkativeness": jsonData.talkativeness ?? 0.5 };
                    char = JSON.stringify(char);
                    await charaWrite('./uploads/' + filedata.filename, char, png_name, response, { file_name: png_name });
                    /*
                    fs.copyFile('./uploads/'+filedata.filename, charactersPath+png_name+'.png', (err) => {
                        if(err) {
                            response.send({error:true});
                            return console.log(err);
                        }else{
                            //console.log(img_file+fileType);
                            response.send({file_name: png_name});
                        }
                        //console.log('The image was copied from temp directory.');
                    });*/
                }
            } catch (err) {
                console.log(err);
                response.send({ error: true });
            }
        }
        //charaWrite(img_path+img_file, char, request.body.ch_name, response);
    }
    //console.log("The file was saved.");


    //console.log(request.body);
    //response.send(request.body.ch_name);

    //response.redirect("https://metanit.com")
});

app.post("/importchat", urlencodedParser, function (request, response) {
    //console.log(humanizedISO8601DateTime()+':/importchat begun');
    if (!request.body) return response.sendStatus(400);

    var format = request.body.file_type;
    let filedata = request.file;
    let avatar_url = (request.body.avatar_url).replace('.png', '');
    let ch_name = request.body.character_name;
    //console.log(filedata.filename);
    //var format = request.body.file_type;
    //console.log(format);
    //console.log(1);
    if (filedata) {

        if (format === 'json') {
            fs.readFile('./uploads/' + filedata.filename, 'utf8', (err, data) => {

                if (err) {
                    console.log(err);
                    response.send({ error: true });
                }

                const jsonData = JSON.parse(data);
                var new_chat = [];
                if (jsonData.histories !== undefined) {
                    //console.log('/importchat confirms JSON histories are defined');
                    let i = 0;
                    new_chat[i] = {};
                    new_chat[0]['user_name'] = 'You';
                    new_chat[0]['character_name'] = ch_name;
                    new_chat[0]['create_date'] = humanizedISO8601DateTime() //Date.now();
                    i++;
                    jsonData.histories.histories[0].msgs.forEach(function (item) {
                        new_chat[i] = {};
                        if (item.src.is_human == true) {
                            new_chat[i]['name'] = 'You';
                        } else {
                            new_chat[i]['name'] = ch_name;
                        }
                        new_chat[i]['is_user'] = item.src.is_human;
                        new_chat[i]['is_name'] = true;
                        new_chat[i]['send_date'] = humanizedISO8601DateTime() //Date.now();
                        new_chat[i]['mes'] = item.text;
                        i++;
                    });
                    const chatJsonlData = new_chat.map(JSON.stringify).join('\n');
                    //console.log('/importchat saving a file: '+ch_name+' - '+humanizedISO8601DateTime()+' imported.jsonl');
                    fs.writeFile(chatsPath + avatar_url + '/' + ch_name + ' - ' + humanizedISO8601DateTime() + ' imported.jsonl', chatJsonlData, 'utf8', function (err) { //added ch_name and replaced Date.now() with humanizedISO8601DateTime

                        if (err) {
                            response.send(err);
                            return console.log(err);
                            //response.send(err);
                        } else {
                            //response.redirect("/");
                            response.send({ res: true });
                        }
                    });

                } else {
                    response.send({ error: true });
                    return;
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
                let jsonData = JSON.parse(line);

                if (jsonData.user_name !== undefined) {
                    //console.log(humanizedISO8601DateTime()+':/importchat copying chat as '+ch_name+' - '+humanizedISO8601DateTime()+'.jsonl');
                    fs.copyFile('./uploads/' + filedata.filename, chatsPath + avatar_url + '/' + ch_name + ' - ' + humanizedISO8601DateTime() + '.jsonl', (err) => { //added character name and replaced Date.now() with humanizedISO8601DateTime
                        if (err) {
                            response.send({ error: true });
                            return console.log(err);
                        } else {
                            response.send({ res: true });
                            return;
                        }
                    });
                } else {
                    //response.send({error:true});
                    return;
                }
                rl.close();
            });
        }

    }

});

app.post('/importworldinfo', urlencodedParser, (request, response) => {
    if (!request.file) return response.sendStatus(400);

    const filename = request.file.originalname;

    if (path.parse(filename).ext.toLowerCase() !== '.json') {
        return response.status(400).send('Only JSON files are supported.')
    }

    const pathToUpload = path.join('./uploads/' + request.file.filename);
    const fileContents = fs.readFileSync(pathToUpload, 'utf8');

    try {
        const worldContent = JSON.parse(fileContents);
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
        const rawImg = await jimp.read(pathToUpload);
        const image = await rawImg.cover(400, 400).getBufferAsync(jimp.MIME_PNG);

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

    const files = fs.readdirSync(directories.groups);
    files.forEach(function (file) {
        const fileContents = fs.readFileSync(path.join(directories.groups, file), 'utf8');
        const group = JSON.parse(fileContents);
        groups.push(group);
    });

    return response.send(groups);
});

app.post('/creategroup', jsonParser, (request, response) => {
    if (!request.body) {
        return response.sendStatus(400);
    }

    const id = Date.now();
    const chatMetadata = { id: id, name: request.body.name ?? 'New Group', members: request.body.members ?? [], avatar_url: request.body.avatar_url };
    const pathToFile = path.join(directories.groups, `${id}.json`);
    const fileData = JSON.stringify(chatMetadata);

    if (!fs.existsSync(directories.groups)) {
        fs.mkdirSync(directories.groups);
    }

    fs.writeFileSync(pathToFile, fileData);
    return response.send(chatMetadata);
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
        const jsonData = lines.map(JSON.parse);
        return response.send(jsonData);
    } else {
        return response.send([]);
    }
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
    const pathToGroup = path.join(directories.groups, `${id}.json`);
    const pathToChat = path.join(directories.groupChats, `${id}.jsonl`);

    if (fs.existsSync(pathToGroup)) {
        fs.rmSync(pathToGroup);
    }

    if (fs.existsSync(pathToChat)) {
        fs.rmSync(pathToChat);
    }

    return response.send({ ok: true });
});

// ** REST CLIENT ASYNC WRAPPERS **
function deleteAsync(url, args) {
    return new Promise((resolve, reject) => {
        client.delete(url, args, (data, response) => {
            if (response.statusCode >= 400) {
                reject(data);
            }
            resolve(data);
        }).on('error', e => reject(e));
    })
}

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

function postAsync(url, args) {
    return new Promise((resolve, reject) => {
        client.post(url, args, (data, response) => {
            if (response.statusCode >= 400) {
                reject(data);
            }
            resolve(data);
        }).on('error', e => reject(e));
    })
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

app.listen(server_port, function () {
    if (process.env.colab !== undefined) {
        if (process.env.colab == 2) {
            is_colab = true;
        }
    }
    console.log('Launching...');
    if (autorun) open('http:127.0.0.1:' + server_port);
    console.log('TavernAI started: http://127.0.0.1:' + server_port);
    if (fs.existsSync('public/characters/update.txt') && !is_colab) {
        convertStage1();
    }

});

//#####################CONVERTING IN NEW FORMAT########################

var charactersB = {};//B - Backup
var character_ib = 0;

var directoriesB = {};


function convertStage1() {
    //if (!fs.existsSync('public/charactersBackup')) {
    //fs.mkdirSync('public/charactersBackup');
    //copyFolder('public/characters/', 'public/charactersBackup');
    //}

    var directories = getDirectories2("public/characters");
    //console.log(directories[0]);
    charactersB = {};
    character_ib = 0;
    var folderForDel = {};
    getCharacterFile2(directories, 0);
}
function convertStage2() {
    //directoriesB = JSON.parse(directoriesB);
    //console.log(directoriesB);
    var mes = true;
    for (const key in directoriesB) {
        if (mes) {
            console.log('***');
            console.log('The update of the character format has begun...');
            console.log('***');
            mes = false;
        }
        //console.log(`${key}: ${directoriesB[key]}`);
        //console.log(JSON.parse(charactersB[key]));
        //console.log(directoriesB[key]);

        var char = JSON.parse(charactersB[key]);
        char.create_date = humanizedISO8601DateTime();
        charactersB[key] = JSON.stringify(char);
        var avatar = 'public/img/fluffy.png';
        if (char.avatar !== 'none') {
            avatar = 'public/characters/' + char.name + '/avatars/' + char.avatar;
        }

        charaWrite(avatar, charactersB[key], directoriesB[key]);

        const files = fs.readdirSync('public/characters/' + directoriesB[key] + '/chats');
        if (!fs.existsSync(chatsPath + char.name)) {
            fs.mkdirSync(chatsPath + char.name);
        }
        files.forEach(function (file) {
            // Read the contents of the file

            const fileContents = fs.readFileSync('public/characters/' + directoriesB[key] + '/chats/' + file, 'utf8');


            // Iterate through the array of strings and parse each line as JSON
            let chat_data = JSON.parse(fileContents);
            let new_chat_data = [];
            let this_chat_user_name = 'You';
            let is_pass_0 = false;
            if (chat_data[0].indexOf('<username-holder>') !== -1) {
                this_chat_user_name = chat_data[0].substr('<username-holder>'.length, chat_data[0].length);
                is_pass_0 = true;
            }
            let i = 0;
            let ii = 0;
            new_chat_data[i] = { user_name: 'You', character_name: char.name, create_date: humanizedISO8601DateTime() };
            i++;
            ii++;
            chat_data.forEach(function (mes) {
                if (!(i === 1 && is_pass_0)) {
                    if (mes.indexOf('<username-holder>') === -1 && mes.indexOf('<username-idkey>') === -1) {
                        new_chat_data[ii] = {};
                        let is_name = false;
                        if (mes.trim().indexOf(this_chat_user_name + ':') !== 0) {
                            if (mes.trim().indexOf(char.name + ':') === 0) {
                                mes = mes.replace(char.name + ':', '');
                                is_name = true;
                            }
                            new_chat_data[ii]['name'] = char.name;
                            new_chat_data[ii]['is_user'] = false;
                            new_chat_data[ii]['is_name'] = is_name;
                            new_chat_data[ii]['send_date'] = humanizedISO8601DateTime(); //Date.now();

                        } else {
                            mes = mes.replace(this_chat_user_name + ':', '');
                            new_chat_data[ii]['name'] = 'You';
                            new_chat_data[ii]['is_user'] = true;
                            new_chat_data[ii]['is_name'] = true;
                            new_chat_data[ii]['send_date'] = humanizedISO8601DateTime(); //Date.now();

                        }
                        new_chat_data[ii]['mes'] = mes.trim();
                        ii++;
                    }
                }
                i++;

            });
            const jsonlData = new_chat_data.map(JSON.stringify).join('\n');
            // Write the contents to the destination folder
            //console.log('convertstage2 writing a file: '+chatsPath+char.name+'/' + file+'l');		
            fs.writeFileSync(chatsPath + char.name + '/' + file + 'l', jsonlData);
        });
        //fs.rmSync('public/characters/'+directoriesB[key],{ recursive: true });
        console.log(char.name + ' update!');
    }
    //removeFolders('public/characters');
    fs.unlinkSync('public/characters/update.txt');
    if (mes == false) {
        console.log('***');
        console.log('Сharacter format update completed successfully!');
        console.log('***');
        console.log('Now you can delete these folders, they are no longer used by TavernAI:');
    }
    for (const key in directoriesB) {
        console.log('public/characters/' + directoriesB[key]);
    }
}
function removeFolders(folder) {
    const files = fs.readdirSync(folder);
    files.forEach(function (file) {
        const filePath = folder + '/' + file;
        const stat = fs.statSync(filePath);
        if (stat.isDirectory()) {
            removeFolders(filePath);
            fs.rmdirSync(filePath);
        }
    });
}

function copyFolder(src, dest) {
    const files = fs.readdirSync(src);
    files.forEach(function (file) {
        const filePath = src + '/' + file;
        const stat = fs.statSync(filePath);
        if (stat.isFile()) {
            fs.copyFileSync(filePath, dest + '/' + file);
        } else if (stat.isDirectory()) {
            fs.mkdirSync(dest + '/' + file);
            copyFolder(filePath, dest + '/' + file);
        }
    });
}


function getDirectories2(path) {
    return fs.readdirSync(path)
        .filter(function (file) {
            return fs.statSync(path + '/' + file).isDirectory();
        })
        .sort(function (a, b) {
            return new Date(fs.statSync(path + '/' + a).mtime) - new Date(fs.statSync(path + '/' + b).mtime);
        })
        .reverse();
}
function getCharacterFile2(directories, i) {
    if (directories.length > i) {
        fs.stat('public/characters/' + directories[i] + '/' + directories[i] + ".json", function (err, stat) {
            if (err == null) {
                fs.readFile('public/characters/' + directories[i] + '/' + directories[i] + ".json", 'utf8', (err, data) => {
                    if (err) {
                        console.error(err);
                        return;
                    }
                    //console.log(data);
                    if (!fs.existsSync('public/characters/' + directories[i] + '.png')) {
                        charactersB[character_ib] = {};
                        charactersB[character_ib] = data;
                        directoriesB[character_ib] = directories[i];
                        character_ib++;
                    }
                    i++;
                    getCharacterFile2(directories, i);
                });
            } else {
                i++;
                getCharacterFile2(directories, i);
            }
        });
    } else {
        convertStage2();
    }
}
