var express = require('express');
var app = express();
var fs = require('fs');
const readline = require('readline');
const open = require('open');

var rimraf = require("rimraf");
const multer  = require("multer");
const https = require('https');
//const PNG = require('pngjs').PNG;
const extract = require('png-chunks-extract');
const encode = require('png-chunks-encode');
const PNGtext = require('png-chunk-text');

const sharp = require('sharp');
sharp.cache(false);
const path = require('path');

var Client = require('node-rest-client').Client;
var client = new Client();

var api_server = "";//"http://127.0.0.1:5000";
var server_port = 8000;

var api_novelai = "https://api.novelai.net";

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

var is_colab = false;

const jsonParser = express.json({limit: '100mb'});
const urlencodedParser = express.urlencoded({extended: true, limit: '100mb'});




app.post("/getlastversion", jsonParser, function(request, response_getlastversion = response){
    if(!request.body) return response_getlastversion.sendStatus(400);
    
    const repo = 'TavernAI/TavernAI';

    https.request({
        hostname: 'github.com',
        path: `/${repo}/releases/latest`,
        method: 'HEAD'
    }, (res) => {
        if(res.statusCode === 302) {
            const glocation = res.headers.location;
            const versionStartIndex = glocation.lastIndexOf('@')+1;
            const version = glocation.substring(versionStartIndex);
            //console.log(version);
            response_getlastversion.send({version: version});
        }else{
            response_getlastversion.send({version: 'error'});
        }
    }).end();
        

});
app.use(express.static(__dirname + "/public", { refresh: true }));
app.use('/backgrounds', (req, res) => {
  const filePath = path.join(process.cwd(), 'public/backgrounds', req.url);
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
  const filePath = path.join(process.cwd(), 'public/characters', req.url);
  fs.readFile(filePath, (err, data) => {
    if (err) {
      res.status(404).send('File not found');
      return;
    }
    //res.contentType('image/jpeg');
    res.send(data);
  });
});
app.use(multer({dest:"uploads"}).single("avatar"));
app.get("/", function(request, response){
    response.sendFile(__dirname + "/public/index.html"); 
    //response.send("<h1>Главная страница</h1>");
});
app.get("/notes/*", function(request, response){
    response.sendFile(__dirname + "/public"+request.url+".html"); 
    //response.send("<h1>Главная страница</h1>");
});
//**************Kobold api
app.post("/generate", jsonParser, function(request, response_generate = response){
    if(!request.body) return response_generate.sendStatus(400);
    //console.log(request.body.prompt);
    //const dataJson = JSON.parse(request.body);
    request_promt = request.body.prompt;
    
    //console.log(request.body);
    var this_settings = { prompt: request_promt,
                        use_story:false,
                        use_memory:false,
                        use_authors_note:false,
                        use_world_info:false,
                        max_context_length: request.body.max_context_length
                        //temperature: request.body.temperature,
                        //max_length: request.body.max_length
                        };
                        
    if(request.body.gui_settings == false){
        var sampler_order = [request.body.s1,request.body.s2,request.body.s3,request.body.s4,request.body.s5,request.body.s6,request.body.s7];
        this_settings = { prompt: request_promt,
                        use_story:false,
                        use_memory:false,
                        use_authors_note:false,
                        use_world_info:false,
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
    client.post(api_server+"/v1/generate",args, function (data, response) {
        if(response.statusCode == 200){
            console.log(data);
            response_generate.send(data);
        }
        if(response.statusCode == 422){
            console.log('Validation error');
            response_generate.send({error: true});
        }
        if(response.statusCode == 501 || response.statusCode == 503 || response.statusCode == 507){
            console.log(data);
            response_generate.send({error: true});
        }
    }).on('error', function (err) {
        console.log(err);
	//console.log('something went wrong on the request', err.request.options);
        response_generate.send({error: true});
    });
});
app.post("/savechat", jsonParser, function(request, response){
    //console.log(request.data);
    //console.log(request.body.bg);
     //const data = request.body;
    //console.log(request);
    //console.log(request.body.chat);
    //var bg = "body {background-image: linear-gradient(rgba(19,21,44,0.75), rgba(19,21,44,0.75)), url(../backgrounds/"+request.body.bg+");}";
    var dir_name = String(request.body.avatar_url).replace('.png','');
    let chat_data = request.body.chat;
    let jsonlData = chat_data.map(JSON.stringify).join('\n');
    fs.writeFile('public/chats/'+dir_name+"/"+request.body.file_name+'.jsonl', jsonlData, 'utf8', function(err) {
        if(err) {
            response.send(err);
            return console.log(err);
            //response.send(err);
        }else{
            //response.redirect("/");
            response.send({result: "ok"});
        }
    });
    
});
app.post("/getchat", jsonParser, function(request, response){
    //console.log(request.data);
    //console.log(request.body.bg);
     //const data = request.body;
    //console.log(request);
    //console.log(request.body.chat);
    //var bg = "body {background-image: linear-gradient(rgba(19,21,44,0.75), rgba(19,21,44,0.75)), url(../backgrounds/"+request.body.bg+");}";
    var dir_name = String(request.body.avatar_url).replace('.png','');

    fs.stat('public/chats/'+dir_name, function(err, stat) {
            
        if(stat === undefined){

            fs.mkdirSync('public/chats/'+dir_name);
            response.send({});
            return;
        }else{
            
            if(err === null){
                
                fs.stat('public/chats/'+dir_name+"/"+request.body.file_name+".jsonl", function(err, stat) {
                    
                    if (err === null) {
                        
                        if(stat !== undefined){
                            fs.readFile('public/chats/'+dir_name+"/"+request.body.file_name+".jsonl", 'utf8', (err, data) => {
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


                            });
                        }
                    }else{
                        response.send({});
                        //return console.log(err);
                        return;
                    }
                });
            }else{
                console.error(err);
                response.send({});
                return;
            }
        }
        

    });

    
});
app.post("/getstatus", jsonParser, function(request, response_getstatus = response){
    if(!request.body) return response_getstatus.sendStatus(400);
    api_server = request.body.api_server;
    if(api_server.indexOf('localhost') != -1){
        api_server = api_server.replace('localhost','127.0.0.1');
    }
    var args = {
        headers: { "Content-Type": "application/json" }
    };
    client.get(api_server+"/v1/model",args, function (data, response) {
        if(response.statusCode == 200){
            if(data.result != "ReadOnly"){
                
                //response_getstatus.send(data.result);
            }else{
                data.result = "no_connection";
            }
        }else{
            data.result = "no_connection";
        }
        response_getstatus.send(data);
        //console.log(response.statusCode);
        //console.log(data);
        //response_getstatus.send(data);
        //data.results[0].text
    }).on('error', function (err) {
        //console.log('');
	//console.log('something went wrong on the request', err.request.options);
        response_getstatus.send({result: "no_connection"});
    });
});
function checkServer(){
    //console.log('Check run###################################################');
    api_server = 'http://127.0.0.1:5000';
    var args = {
        headers: { "Content-Type": "application/json" }
    };
    client.get(api_server+"/v1/model",args, function (data, response) {
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
function charaFormatData(data){
    var char = {"name": data.ch_name, "description": data.description, "personality": data.personality, "first_mes": data.first_mes, "avatar": 'none', "chat": Date.now(), "mes_example": data.mes_example, "scenario": data.scenario, "create_date": Date.now()};
    return char;
}
app.post("/createcharacter", urlencodedParser, function(request, response){
    if(!request.body) return response.sendStatus(400);
    if (!fs.existsSync('public/characters/'+request.body.ch_name+'.png')){
        if(!fs.existsSync('public/chats/'+request.body.ch_name) )fs.mkdirSync('public/chats/'+request.body.ch_name);
        //if(!fs.existsSync('public/characters/'+request.body.ch_name+'/chats')) fs.mkdirSync('public/characters/'+request.body.ch_name+'/chats');
        //if(!fs.existsSync('public/characters/'+request.body.ch_name+'/avatars')) fs.mkdirSync('public/characters/'+request.body.ch_name+'/avatars');
        
        let filedata = request.file;
        //console.log(filedata.mimetype);
        var fileType = ".png";
        var img_file = "ai";
        var img_path = "public/img/";
        
        var char = charaFormatData(request.body);//{"name": request.body.ch_name, "description": request.body.description, "personality": request.body.personality, "first_mes": request.body.first_mes, "avatar": 'none', "chat": Date.now(), "last_mes": '', "mes_example": ''};
        char = JSON.stringify(char);
        if(!filedata){
            
            charaWrite('./public/img/fluffy.png', char, request.body.ch_name, response);
            
            //fs.writeFile('public/characters/'+request.body.ch_name+"/"+request.body.ch_name+".json", char, 'utf8', function(err) {
                //if(err) {
                    //response.send(err);
                    //return console.log(err);
                //}else{
                    
                //}
            //});
        }else{
            
            img_path = "./uploads/";
            img_file = filedata.filename
            if (filedata.mimetype == "image/jpeg") fileType = ".jpeg";
            if (filedata.mimetype == "image/png") fileType = ".png";
            if (filedata.mimetype == "image/gif") fileType = ".gif";
            if (filedata.mimetype == "image/bmp") fileType = ".bmp";
            charaWrite(img_path+img_file, char, request.body.ch_name, response);
        }
        //console.log("The file was saved.");

    }else{
        response.send("Error: A character with that name already exists.");
    }
    //console.log(request.body);
    //response.send(request.body.ch_name);

    //response.redirect("https://metanit.com")
});


app.post("/editcharacter", urlencodedParser, function(request, response){
    if(!request.body) return response.sendStatus(400);
    let filedata = request.file;
    //console.log(filedata.mimetype);
    var fileType = ".png";
    var img_file = "ai";
    var img_path = "./public/characters/";
    
    var char = charaFormatData(request.body);//{"name": request.body.ch_name, "description": request.body.description, "personality": request.body.personality, "first_mes": request.body.first_mes, "avatar": request.body.avatar_url, "chat": request.body.chat, "last_mes": request.body.last_mes, "mes_example": ''};
    char.chat = request.body.chat;
    char.create_date = request.body.create_date;
    
    char = JSON.stringify(char);
    if(!filedata){

        charaWrite(img_path+request.body.avatar_url, char, request.body.ch_name, response, 'Character saved');
    }else{
        //console.log(filedata.filename);
        img_path = "uploads/";
        img_file = filedata.filename;

        charaWrite(img_path+img_file, char, request.body.ch_name, response, 'Character saved');
        //response.send('Character saved');
    }
});
app.post("/deletecharacter", urlencodedParser, function(request, response){
    if(!request.body) return response.sendStatus(400);
    rimraf('public/characters/'+request.body.avatar_url, (err) => { 
        if(err) {
            response.send(err);
            return console.log(err);
        }else{
            //response.redirect("/");
            let dir_name = request.body.avatar_url;
            rimraf('public/chats/'+dir_name.replace('.png',''), (err) => { 
                if(err) {
                    response.send(err);
                    return console.log(err);
                }else{
                    //response.redirect("/");

                    response.send('ok');
                }
            });
        }
    });
});

async function charaWrite(img_url, data, name, response = undefined, mes = 'ok'){
    try {
        // Load the image in any format
        sharp.cache(false);
        var image = await sharp(img_url).resize(400, 600).toFormat('png').toBuffer();// old 170 234
        // Convert the image to PNG format
        //const pngImage = image.toFormat('png');

        // Resize the image to 100x100
        //const resizedImage = pngImage.resize(100, 100);

        // Get the chunks
        var chunks = extract(image);
         var tEXtChunks = chunks.filter(chunk => chunk.name === 'tEXt');

        // Remove all existing tEXt chunks
        for (var tEXtChunk of tEXtChunks) {
            chunks.splice(chunks.indexOf(tEXtChunk), 1);
        }
        // Add new chunks before the IEND chunk
        var base64EncodedData = Buffer.from(data, 'utf8').toString('base64');
        chunks.splice(-1, 0, PNGtext.encode('chara', base64EncodedData));
        //chunks.splice(-1, 0, text.encode('lorem', 'ipsum'));

        fs.writeFileSync('public/characters/'+name+'.png', new Buffer.from(encode(chunks)));
        if(response !== undefined) response.send(mes);
            

    } catch (err) {
        console.log(err);
        if(response !== undefined) response.send(err);
    }
}

      
            


function charaRead(img_url){
    sharp.cache(false);
    const buffer = fs.readFileSync(img_url);
    const chunks = extract(buffer);
     
    const textChunks = chunks.filter(function (chunk) {
      return chunk.name === 'tEXt';
    }).map(function (chunk) {
        //console.log(text.decode(chunk.data));
      return PNGtext.decode(chunk.data);
    });
    var base64DecodedData = Buffer.from(textChunks[0].text, 'base64').toString('utf8');
    return base64DecodedData;//textChunks[0].text;
    //console.log(textChunks[0].keyword); // 'hello'
    //console.log(textChunks[0].text);    // 'world'
}

app.post("/getcharacters", jsonParser, function(request, response){
    fs.readdir("public/characters", (err, files) => {
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
            var img_data = charaRead('./public/characters/'+item);
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
    //getCharaterFile(directories, response,0);
    
});
app.post("/getbackgrounds", jsonParser, function(request, response){
    var images = getImages("public/backgrounds");
    if(is_colab === true){
        images = ['tavern.png'];
    }
    response.send(JSON.stringify(images));
    
});
app.post("/iscolab", jsonParser, function(request, response){
    let send_data = false;
    if(process.env.colaburl !== undefined){
        send_data = String(process.env.colaburl).trim();
    }
    response.send({colaburl:send_data});
    
});
app.post("/getuseravatars", jsonParser, function(request, response){
    var images = getImages("public/User Avatars");
    response.send(JSON.stringify(images));
    
});
app.post("/setbackground", jsonParser, function(request, response){
    //console.log(request.data);
    //console.log(request.body.bg);
     //const data = request.body;
    //console.log(request);
    //console.log(1);
    var bg = "#bg1 {background-image: linear-gradient(rgba(19,21,44,0.75), rgba(19,21,44,0.75)), url(../backgrounds/"+request.body.bg+");}";
    fs.writeFile('public/css/bg_load.css', bg, 'utf8', function(err) {
        if(err) {
            response.send(err);
            return console.log(err);
        }else{
            //response.redirect("/");
            response.send({result:'ok'});
        }
    });
    
});
app.post("/delbackground", jsonParser, function(request, response){
    if(!request.body) return response.sendStatus(400);
    rimraf('public/backgrounds/'+request.body.bg, (err) => { 
        if(err) {
            response.send(err);
            return console.log(err);
        }else{
            //response.redirect("/");
            response.send('ok');
        }
    });
    
});
app.post("/downloadbackground", urlencodedParser, function(request, response){
    response_dw_bg = response;
    if(!request.body) return response.sendStatus(400);

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
    fs.copyFile(img_path+img_file, 'public/backgrounds/'+img_file+fileType, (err) => {
        if(err) {
            
            return console.log(err);
        }else{
            //console.log(img_file+fileType);
            response_dw_bg.send(img_file+fileType);
        }
        //console.log('The image was copied from temp directory.');
    });


});

app.post("/savesettings", jsonParser, function(request, response){


    fs.writeFile('public/settings.json', JSON.stringify(request.body), 'utf8', function(err) {
        if(err) {
            response.send(err);
            return console.log(err);
            //response.send(err);
        }else{
            //response.redirect("/");
            response.send({result: "ok"});
        }
    });
    
});
app.post('/getsettings', jsonParser, (request, response) => { //Wintermute's code
    const koboldai_settings = [];
    const koboldai_setting_names = [];
    const novelai_settings = [];
    const novelai_setting_names = [];
    const settings = fs.readFileSync('public/settings.json', 'utf8',  (err, data) => {
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
        novelai_settings,
        novelai_setting_names
    });
});


function getCharaterFile(directories,response,i){ //old need del
    if(directories.length > i){
        
        fs.stat('public/characters/'+directories[i]+'/'+directories[i]+".json", function(err, stat) {
            if (err == null) {
                fs.readFile('public/characters/'+directories[i]+'/'+directories[i]+".json", 'utf8', (err, data) => {
                    if (err) {
                      console.error(err);
                      return;
                    }
                    //console.log(data);

                    characters[character_i] = {};
                    characters[character_i] = data;
                    i++;
                    character_i++;
                    getCharaterFile(directories,response,i);
                });
            }else{
                i++;
                getCharaterFile(directories,response,i);
            }
        });
        
    }else{
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

app.post("/getstatus_novelai", jsonParser, function(request, response_getstatus_novel =response){
    
    if(!request.body) return response_getstatus_novel.sendStatus(400);
    api_key_novel = request.body.key;
    var data = {};
    var args = {
        data: data,
        
        headers: { "Content-Type": "application/json",  "Authorization": "Bearer "+api_key_novel}
    };
    client.get(api_novelai+"/user/subscription",args, function (data, response) {
        if(response.statusCode == 200){
            //console.log(data);
            response_getstatus_novel.send(data);//data);
        }
        if(response.statusCode == 401){
            console.log('Access Token is incorrect.');
            response_getstatus_novel.send({error: true});
        }
        if(response.statusCode == 500 || response.statusCode == 501 || response.statusCode == 501 || response.statusCode == 503 || response.statusCode == 507){
            console.log(data);
            response_getstatus_novel.send({error: true});
        }
    }).on('error', function (err) {
        //console.log('');
	//console.log('something went wrong on the request', err.request.options);
        response_getstatus_novel.send({error: true});
    });
});



app.post("/generate_novelai", jsonParser, function(request, response_generate_novel = response){
    if(!request.body) return response_generate_novel.sendStatus(400);

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
        
        headers: { "Content-Type": "application/json",  "Authorization": "Bearer "+api_key_novel}
    };
    client.post(api_novelai+"/ai/generate",args, function (data, response) {
        if(response.statusCode == 201){
            console.log(data);
            response_generate_novel.send(data);
        }
        if(response.statusCode == 400){
            console.log('Validation error');
            response_generate_novel.send({error: true});
        }
        if(response.statusCode == 401){
            console.log('Access Token is incorrect');
            response_generate_novel.send({error: true});
        }
        if(response.statusCode == 402){
            console.log('An active subscription is required to access this endpoint');
            response_generate_novel.send({error: true});
        }
        if(response.statusCode == 500 || response.statusCode == 409){
            console.log(data);
            response_generate_novel.send({error: true});
        }
    }).on('error', function (err) {
        //console.log('');
	//console.log('something went wrong on the request', err.request.options);
        response_getstatus.send({error: true});
    });
});

app.post("/getallchatsofchatacter", jsonParser, function(request, response){
    if(!request.body) return response.sendStatus(400);

    var char_dir = (request.body.avatar_url).replace('.png','')
    fs.readdir('public/chats/'+char_dir, (err, files) => {
        if (err) {
          console.error(err);
          response.send({error: true});
          return;
        }

        // filter for JSON files
        const jsonFiles = files.filter(file => path.extname(file) === '.jsonl');

        // sort the files by name
        //jsonFiles.sort().reverse();

        // print the sorted file names
        var chatData = {};
        let ii = jsonFiles.length;
        for(let i = jsonFiles.length-1; i >= 0; i--){
            const file = jsonFiles[i];

            const fileStream = fs.createReadStream('public/chats/'+char_dir+'/'+file);
            const rl = readline.createInterface({
                input: fileStream,
                crlfDelay: Infinity
            });

            let lastLine;

            rl.on('line', (line) => {
                lastLine = line;
            });

            rl.on('close', () => {
                if(lastLine){
                    let jsonData = JSON.parse(lastLine);
                    if(jsonData.name !== undefined){
                        chatData[i] = {};
                        chatData[i]['file_name'] = file;
                        chatData[i]['mes'] = jsonData['mes'];
                        ii--;
                        if(ii === 0){ 
                            response.send(chatData);
                        }
                    }else{
                        return;
                    }
                  }
                rl.close();
            });
        }
    });
    
});
function getPngName(file){
    if (fs.existsSync('./public/characters/'+file+'.png')) {
        file = file+'1';
    }
    return file;
}
app.post("/importcharacter", urlencodedParser, function(request, response){
    if(!request.body) return response.sendStatus(400);

        let png_name = '';
        let filedata = request.file;
        //console.log(filedata.filename);
        var format = request.body.file_type;
        //console.log(format);
        if(filedata){
            if(format == 'json'){
                fs.readFile('./uploads/'+filedata.filename, 'utf8', (err, data) => {
                    if (err){
                        console.log(err);
                        response.send({error:true});
                    }
                    const jsonData = JSON.parse(data);
                    
                    if(jsonData.char_name !== undefined){//json Pygmalion notepad
                        png_name = getPngName(jsonData.char_name);
                        var char = {"name": jsonData.char_name, "description": jsonData.char_persona, "personality": '', "first_mes": jsonData.char_greeting, "avatar": 'none', "chat": Date.now(), "mes_example": jsonData.example_dialogue, "scenario": jsonData.world_scenario, "create_date": Date.now()};
                        char = JSON.stringify(char);
                        charaWrite('./public/img/fluffy.png', char, png_name, response, {file_name: png_name});
                    }else if(jsonData.name !== undefined){
                        png_name = getPngName(jsonData.name);
                        var char = {"name": jsonData.name, "description": jsonData.description, "personality": jsonData.personality, "first_mes": jsonData.first_mes, "avatar": 'none', "chat": Date.now(), "mes_example": '', "scenario": '', "create_date": Date.now()};
                        char = JSON.stringify(char);
                        charaWrite('./public/img/fluffy.png', char, png_name, response, {file_name: png_name});
                    }else{
                        console.log('Incorrect character format .json');
                        response.send({error:true});
                    }
                });
            }else{
                try{
                    
                    var img_data = charaRead('./uploads/'+filedata.filename);
                    let jsonObject = JSON.parse(img_data);
                    png_name = getPngName(jsonObject.name);
                    if(jsonObject.name !== undefined){
                        fs.copyFile('./uploads/'+filedata.filename, 'public/characters/'+png_name+'.png', (err) => {
                            if(err) {
                                response.send({error:true});
                                return console.log(err);
                            }else{
                                //console.log(img_file+fileType);
                                response.send({file_name: png_name});
                            }
                            //console.log('The image was copied from temp directory.');
                        });
                    }
                }catch(err){
                    console.log(err);
                    response.send({error:true});
                }
            }
            //charaWrite(img_path+img_file, char, request.body.ch_name, response);
        }
        //console.log("The file was saved.");


    //console.log(request.body);
    //response.send(request.body.ch_name);

    //response.redirect("https://metanit.com")
});

app.post("/importchat", urlencodedParser, function(request, response){
    if(!request.body) return response.sendStatus(400);

        var format = request.body.file_type;
        let filedata = request.file;
        let avatar_url = (request.body.avatar_url).replace('.png', '');
        let ch_name = request.body.character_name;
        //console.log(filedata.filename);
        //var format = request.body.file_type;
        //console.log(format);
       //console.log(1);
        if(filedata){

            if(format === 'json'){
                fs.readFile('./uploads/'+filedata.filename, 'utf8', (err, data) => {

                    if (err){
                        console.log(err);
                        response.send({error:true});
                    }

                    const jsonData = JSON.parse(data);
                    var new_chat = [];
                    if(jsonData.histories !== undefined){
                        let i = 0;
                        new_chat[i] = {};
                        new_chat[0]['user_name'] = 'You';
                        new_chat[0]['character_name'] = ch_name;
                        new_chat[0]['create_date'] = Date.now();
                        i++;
                        jsonData.histories.histories[0].msgs.forEach(function(item) {
                            new_chat[i] = {};
                            if(item.src.is_human == true){
                                new_chat[i]['name'] = 'You';
                            }else{
                                new_chat[i]['name'] = ch_name;
                            }
                            new_chat[i]['is_user'] = item.src.is_human;
                            new_chat[i]['is_name'] = true;
                            new_chat[i]['send_date'] = Date.now();
                            new_chat[i]['mes'] = item.text;
                            i++;
                        });
                        const chatJsonlData = new_chat.map(JSON.stringify).join('\n');
                        fs.writeFile('public/chats/'+avatar_url+'/'+Date.now()+'.jsonl', chatJsonlData, 'utf8', function(err) {
                            if(err) {
                                response.send(err);
                                return console.log(err);
                                //response.send(err);
                            }else{
                                //response.redirect("/");
                                response.send({res:true});
                            }
                        });
                        
                    }else{
                        response.send({error:true});
                        return;
                    }

                });
            }
            if(format === 'jsonl'){
                const fileStream = fs.createReadStream('./uploads/'+filedata.filename);
                const rl = readline.createInterface({
                  input: fileStream,
                  crlfDelay: Infinity
                });
                
                rl.once('line', (line) => {
                    let jsonData = JSON.parse(line);
                    
                    if(jsonData.user_name !== undefined){
                        fs.copyFile('./uploads/'+filedata.filename, 'public/chats/'+avatar_url+'/'+Date.now()+'.jsonl', (err) => {
                            if(err) {
                                response.send({error:true});
                                return console.log(err);
                            }else{
                                response.send({res:true});
                                return;
                            }
                        });
                    }else{
                        //response.send({error:true});
                        return;
                    }
                    rl.close();
                });
            }

        }

});







app.listen(server_port, function() {
    if(process.env.colab !== undefined){
        if(process.env.colab == 2){
            is_colab = true;
        }
    }
    console.log('Launching...');
    open('http:127.0.0.1:'+server_port);
    console.log('TavernAI started: http://127.0.0.1:'+server_port);
    if (fs.existsSync('public/characters/update.txt')) { //&& !is_colab <- this need to put again
        convertStage1();
    }

});

//#####################CONVERTING IN NEW FORMAT########################

var charactersB = {};//B - Backup
var character_ib = 0;

var directoriesB = {};


function convertStage1(){
    //if (!fs.existsSync('public/charactersBackup')) {
        //fs.mkdirSync('public/charactersBackup');
        //copyFolder('public/characters/', 'public/charactersBackup');
    //}
    
    var directories = getDirectories2("public/characters");
    //console.log(directories[0]);
    charactersB = {};
    character_ib = 0;
    var folderForDel = {};
    getCharaterFile2(directories, 0);
}
function convertStage2(){
    //directoriesB = JSON.parse(directoriesB);
    //console.log(directoriesB);
    var mes = true;
    for (const key in directoriesB) {
        if(mes){
            console.log('***');
            console.log('The update of the character format has begun...');
            console.log('***');
            mes = false;
        }
        //console.log(`${key}: ${directoriesB[key]}`);
        //console.log(JSON.parse(charactersB[key]));
        //console.log(directoriesB[key]);
        
        var char = JSON.parse(charactersB[key]);
        char.create_date = Date.now();
        charactersB[key] = JSON.stringify(char);
        var avatar = 'public/img/fluffy.png';
        if(char.avatar !== 'none'){
            avatar = 'public/characters/'+char.name+'/avatars/'+char.avatar;
        }
        
        charaWrite(avatar, charactersB[key], directoriesB[key]);
        
        const files = fs.readdirSync('public/characters/'+directoriesB[key]+'/chats');
        if (!fs.existsSync('public/chats/'+char.name)) {
            fs.mkdirSync('public/chats/'+char.name);
        }
        files.forEach(function(file) {
            // Read the contents of the file
            
            const fileContents = fs.readFileSync('public/characters/'+directoriesB[key]+'/chats/' + file, 'utf8');


            // Iterate through the array of strings and parse each line as JSON
            let chat_data = JSON.parse(fileContents);
            let new_chat_data = [];
            let this_chat_user_name = 'You';
            let is_pass_0 = false;
            if(chat_data[0].indexOf('<username-holder>') !== -1){
                this_chat_user_name = chat_data[0].substr('<username-holder>'.length, chat_data[0].length);
                is_pass_0 = true;
            }
            let i = 0;
            let ii = 0;
            new_chat_data[i] = {user_name:'You', character_name:char.name, create_date: Date.now()};
            i++;
            ii++;
            chat_data.forEach(function(mes) {
                if(!(i === 1 && is_pass_0)){
                    if(mes.indexOf('<username-holder>') === -1 && mes.indexOf('<username-idkey>') === -1){
                        new_chat_data[ii] = {};
                        let is_name = false;
                        if(mes.trim().indexOf(this_chat_user_name+':') !== 0){
                            if(mes.trim().indexOf(char.name+':') === 0){
                                mes = mes.replace(char.name+':','');
                                is_name = true;
                            }
                            new_chat_data[ii]['name'] = char.name;
                            new_chat_data[ii]['is_user'] = false;
                            new_chat_data[ii]['is_name'] = is_name;
                            new_chat_data[ii]['send_date'] = Date.now();

                        }else{
                            mes = mes.replace(this_chat_user_name+':','');
                            new_chat_data[ii]['name'] = 'You';
                            new_chat_data[ii]['is_user'] = true;
                            new_chat_data[ii]['is_name'] = true;
                            new_chat_data[ii]['send_date'] = Date.now();

                        }
                        new_chat_data[ii]['mes'] = mes.trim();
                        ii++;
                    }
                }
                i++;
                
            });
            const jsonlData = new_chat_data.map(JSON.stringify).join('\n');
            // Write the contents to the destination folder
            fs.writeFileSync('public/chats/'+char.name+'/' + file+'l', jsonlData);
        });
        //fs.rmSync('public/characters/'+directoriesB[key],{ recursive: true });
        console.log(char.name+' update!');
    }
    //removeFolders('public/characters');
    fs.unlinkSync('public/characters/update.txt');
    if(mes == false){
        console.log('***');
        console.log('Сharacter format update completed successfully!');
        console.log('***');
        console.log('Now you can delete these folders, they are no longer used by TavernAI:');
    }
    for (const key in directoriesB) {
        console.log('public/characters/'+directoriesB[key]);
    }
}
function removeFolders(folder) {
    const files = fs.readdirSync(folder);
    files.forEach(function(file) {
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
    files.forEach(function(file) {
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
function getCharaterFile2(directories,i){
    if(directories.length > i){
            fs.stat('public/characters/'+directories[i]+'/'+directories[i]+".json", function(err, stat) {
                if (err == null) {
                    fs.readFile('public/characters/'+directories[i]+'/'+directories[i]+".json", 'utf8', (err, data) => {
                        if (err) {
                          console.error(err);
                          return;
                        }
                        //console.log(data);
                        if (!fs.existsSync('public/characters/'+directories[i]+'.png')) {
                            charactersB[character_ib] = {};
                            charactersB[character_ib] = data;
                            directoriesB[character_ib] = directories[i];
                            character_ib++;
                        }
                        i++;
                        getCharaterFile2(directories,i);
                    });
                }else{
                    i++;
                    getCharaterFile2(directories,i);
                }
            });
    }else{
        convertStage2();
    }
}
/*
* async function aaa2(){
try {
    // Load the image in any format

    const image = await sharp('./original.jpg').resize(100, 100).toFormat('png');

  image.metadata((err, metadata) => {
    if (err) throw err;
    if (!metadata.chunks) {
        metadata.chunks = [];
    }
const textData = text.encode('hello', 'world');
const textBuffer = Buffer.from(`${textData.keyword}\0${textData.text}`);
metadata.chunks.push({
  type: 'tEXt',
  data: textBuffer
});
    return metadata;
  })
  .toFile('test-out.png')
  .then(() => {
    console.log('PNG image with tEXt chunks has been saved.');
  })
  .catch((err) => {
    console.log(err);
  });
} catch (err) {
    console.log(err);
}
}
* function writePNG(){

const buffer = fs.readFileSync('test-out.png');
const chunks = extract(buffer);
 const tEXtChunks = chunks.filter(chunk => chunk.name === 'tEXt');

// Remove all existing tEXt chunks
for (const tEXtChunk of tEXtChunks) {
    chunks.splice(chunks.indexOf(tEXtChunk), 1);
}
// Add new chunks before the IEND chunk
chunks.splice(-1, 0, text.encode('hello', 'world'));
chunks.splice(-1, 0, text.encode('lorem', 'ipsum'));
 
fs.writeFileSync(
  'test-out.png',
  new Buffer.from(encode(chunks))
);
}
 *     function readPNG2(){
    sharp('./test-out.png')
  .metadata()
  .then((metadata) => {
      console.log(metadata);
    if (!metadata.chunks) {
        console.log("No tEXt chunks found in the image file");
    }
    const textChunks = metadata.chunks.filter((chunk) => chunk.type === 'tEXt');
    textChunks.forEach((textChunk) => {
        const textData = JSON.parse(textChunk.data.toString());
        console.log(textData);
    });
  })
  .catch((err) => {
    console.log(err);
  });
  }
const requestListener = function (req, res) {
    fs.readFile(__dirname + "/index.html")
        .then(contents => {
            res.setHeader("Content-Type", "text/html");
            res.writeHead(200);
            res.end(contents);
        })
        .catch(err => {
            res.writeHead(500);
            res.end(err);
            return;
        });
};



const server = http.createServer(requestListener);
server.listen(port, host, () => {
    console.log(`Server is running on http://${host}:${port}`);
});
*/

