var express = require('express');
var app = express();
var fs = require('fs');
var rimraf = require("rimraf");
const multer  = require("multer");

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
var api_key_novel;

const jsonParser = express.json();
const urlencodedParser = express.urlencoded({extended: false});

app.use(express.static(__dirname + "/public"));
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
        //console.log('');
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
    fs.writeFile('public/characters/'+request.body.ch_name+'/chats/'+request.body.file_name+'.json', JSON.stringify(request.body.chat), 'utf8', function(err) {
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

    fs.stat('public/characters/'+request.body.ch_name+'/chats/'+request.body.file_name+'.json', function(err, stat) {
        if (err == null) {
            fs.readFile('public/characters/'+request.body.ch_name+'/chats/'+request.body.file_name+'.json', 'utf8', (err, data) => {
                if (err) {
                  console.error(err);
                  response.send(err);
                  return;
                }
                //console.log(data);
                response.send(data);
                
                
            });
        }else{
            response.send({});
            //return console.log(err);
            return;
        }
    });
    
});
app.post("/getstatus", jsonParser, function(request, response_getstatus = response){
    if(!request.body) return response.sendStatus(400);
    
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


//***************** Main functions
app.post("/createcharacter", urlencodedParser, function(request, response){
    response_create = response;
    if(!request.body) return response.sendStatus(400);
    if (!fs.existsSync('public/characters/'+request.body.ch_name+'/'+request.body.ch_name+'.json')){
        if(!fs.existsSync('public/characters/'+request.body.ch_name) )fs.mkdirSync('public/characters/'+request.body.ch_name);
        if(!fs.existsSync('public/characters/'+request.body.ch_name+'/chats')) fs.mkdirSync('public/characters/'+request.body.ch_name+'/chats');
        if(!fs.existsSync('public/characters/'+request.body.ch_name+'/avatars')) fs.mkdirSync('public/characters/'+request.body.ch_name+'/avatars');
        
        let filedata = request.file;
        //console.log(filedata.mimetype);
        var fileType = ".png";
        var img_file = "ai";
        var img_path = "public/img/";
        if(!filedata){
            var char = {"name": request.body.ch_name, "description": request.body.description, "personality": request.body.personality, "first_mes": request.body.first_mes, "avatar": 'none', "chat": Date.now(), "last_mes": '', "mes_example": ''};
            char = JSON.stringify(char);
            fs.writeFile('public/characters/'+request.body.ch_name+"/"+request.body.ch_name+".json", char, 'utf8', function(err) {
                if(err) {
                    response.send(err);
                    return console.log(err);
                }else{
                    response_create.send('ok');
                }
            });
        }else{
            
            img_path = "uploads/";
            img_file = filedata.filename
            if (filedata.mimetype == "image/jpeg") fileType = ".jpeg";
            if (filedata.mimetype == "image/png") fileType = ".png";
            if (filedata.mimetype == "image/gif") fileType = ".gif";
            if (filedata.mimetype == "image/bmp") fileType = ".bmp";
            fs.copyFile(img_path+img_file, 'public/characters/'+request.body.ch_name+'/avatars/'+img_file+fileType, (err) => {
                if(err) {
                    response.send(err);
                    return console.log(err);
                }
                var char = {"name": request.body.ch_name, "description": request.body.description, "personality": request.body.personality, "first_mes": request.body.first_mes, "avatar": img_file+fileType, "chat": Date.now(), "last_mes": '', "mes_example": ''};
                char = JSON.stringify(char);
                fs.writeFile('public/characters/'+request.body.ch_name+"/"+request.body.ch_name+".json", char, 'utf8', function(err) {
                    if(err) {
                        response.send(err);
                        return console.log(err);
                    }else{
                        response_create.send('ok');
                    }
                });
                //console.log('The image was copied from temp directory.');
            });
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
    response_edit = response;
    let filedata = request.file;
    //console.log(filedata.mimetype);
    var fileType = ".png";
    var img_file = "ai";
    var img_path = "public/img/";
    if(!filedata){
    //console.log(request.body.avatar_url);
        var char = {"name": request.body.ch_name, "description": request.body.description, "personality": request.body.personality, "first_mes": request.body.first_mes, "avatar": request.body.avatar_url, "chat": request.body.chat, "last_mes": request.body.last_mes, "mes_example": ''};
        char = JSON.stringify(char);
        fs.writeFile('public/characters/'+request.body.ch_name+"/"+request.body.ch_name+".json", char, 'utf8', function(err) {
            if(err) {
                response.send(err);
                return console.log(err);
            }else{
                response_edit.send('Character saved');
            }
        });
    }else{
        
        img_path = "uploads/";
        img_file = filedata.filename
        if (filedata.mimetype == "image/jpeg") fileType = ".jpeg";
        if (filedata.mimetype == "image/png") fileType = ".png";
        if (filedata.mimetype == "image/gif") fileType = ".gif";
        if (filedata.mimetype == "image/bmp") fileType = ".bmp";
        fs.copyFile(img_path+img_file, 'public/characters/'+request.body.ch_name+'/avatars/'+img_file+fileType, (err) => {
            if(err) {
                response.send(err);
                return console.log(err);
            }
            var char = {"name": request.body.ch_name, "description": request.body.description, "personality": request.body.personality, "first_mes": request.body.first_mes, "avatar": img_file+fileType, "chat": request.body.chat, "last_mes": request.body.last_mes, "mes_example": ''};
            char = JSON.stringify(char);
            fs.writeFile('public/characters/'+request.body.ch_name+"/"+request.body.ch_name+".json", char, 'utf8', function(err) {
                if(err) {
                    response.send(err);
                    return console.log(err);
                }else{
                    response_edit.send('Character saved');
                }
            });
            //console.log('The image was copied from temp directory.');
        });
    }
});
app.post("/deletecharacter", urlencodedParser, function(request, response){
    if(!request.body) return response.sendStatus(400);
    rimraf('public/characters/'+request.body.ch_name, (err) => { 
        if(err) {
            response.send(err);
            return console.log(err);
        }else{
            //response.redirect("/");
            response.send('ok');
        }
    });
});


app.post("/getcharacters", jsonParser, function(request, response){
    var directories = getDirectories("public/characters");
    //console.log(directories[0]);
    characters = {};
    character_i = 0;
    getCharaterFile(directories, response,0);
    
});
app.post("/getbackgrounds", jsonParser, function(request, response){
    var images = getImages("public/backgrounds");
    response.send(JSON.stringify(images));
    
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

app.post("/getsettings2", jsonParser, function(request, response){//Elder
    var koboldai_settings = [];
    var koboldai_setting_names = [];
    fs.stat('public/settings.json', function(err, stat) {
        if (err == null) {
            fs.readFile('public/settings.json', 'utf8', (err, data) => {
                if (err) {
                    console.error(err);
                    return;
                }
                var files = getKoboldSettingFiles("public/KoboldAI Settings");
                
                var get_count_files = 0;
                var count = 0;
                files.forEach(function(item, i, arr) {
                    if(item.substr(item.length-9,9) == '.settings'){
                        fs.readFile("public/KoboldAI Settings/"+item, 'utf8', (err, data2) => {
                            if (err) {
                                console.error(err);
                                return;
                            }
                            get_count_files++;
                            koboldai_settings[count] = data2;
                            koboldai_setting_names[count] = item.substr(0,item.length-9);
                            count++;

                            if(files.length <= get_count_files) sendData(data);
                            
                        });
                    }else{
                        get_count_files++;
                        if(files.length <= get_count_files) sendData(data);
                    }
                });
                
            });
        }else{
            response.send({result: "file not find"});
        }
    });
    function sendData(data){
        var data3 = {settings:data, koboldai_settings:koboldai_settings, koboldai_setting_names:koboldai_setting_names};
        //console.log(data3);
        response.send(data3);
    }
    
});

function getCharaterFile(directories,response,i){
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
    if(!request.body) return response_generate.sendStatus(400);
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









app.listen(server_port, function() {
  console.log('Server started: http://127.0.0.1:'+server_port);
  
  
});




/*
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

