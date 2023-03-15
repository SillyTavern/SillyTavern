import { humanizedDateTime } from "./scripts/RossAscends-mods.js";
import { encode, decode } from "../scripts/gpt-2-3-tokenizer/mod.js";

//RossAscends: exporting functions and vars for RA mods.
export {
    Generate,
    getSettings,
    saveSettings,
    printMessages,
    clearChat,
    getChat,
    this_chid,
    settings,
    characters,
    online_status,
    main_api,
    api_server,
    api_key_novel,
    getCharacters,
    is_send_press,
    world_info,
};

// API OBJECT FOR EXTERNAL WIRING
window["TavernAI"] = {};

const VERSION = "1.2.8";
let converter = new showdown.Converter({ emoji: "true" });
let bg_menu_toggle = false;
const systemUserName = "TavernAI";
let default_user_name = "You";
let name1 = default_user_name;
let name2 = "TavernAI";
let chat = [];
let safetychat = [
    {
        name: systemUserName,
        is_user: false,
        is_name: true,
        create_date: 0,
        mes: "\n*You deleted a character/chat and arrived back here for safety reasons! Pick another character!*\n\n",
    },
];
let chat_create_date = 0;

let prev_selected_char = null;
let default_ch_mes = "Hello";
let count_view_mes = 0;
let mesStr = "";
let generatedPromtCache = "";
let characters = [];
let groups = [];
let selected_group = null;
let is_group_automode_enabled = false;
let this_chid;
let active_character;
let backgrounds = [];
const default_avatar = "img/fluffy.png";
const system_avatar = "img/five.png";
let is_colab = false;
let is_checked_colab = false;
let is_mes_reload_avatar = false;
let collapse_newlines = false;

const system_message_types = {
    HELP: "help",
    WELCOME: "welcome",
    GROUP: "group",
    EMPTY: "empty",
    GENERIC: "generic",
};

const system_messages = {
    help: {
        name: systemUserName,
        force_avatar: system_avatar,
        is_user: false,
        is_system: true,
        is_name: true,
        mes: 'Hi there! The following chat formatting commands are supported:<br><ul><li><tt>*text*</tt> – format the actions that your character does</li><li><tt>{*text*}</tt> – set the behavioral bias for your character</li></ul><p>Need more help? Visit our wiki – <a target="_blank" href="https://github.com/TavernAI/TavernAI/wiki">TavernAI Wiki</a>!</p>',
    },
    welcome: 
    {
        name: systemUserName,
        force_avatar: system_avatar,
        is_user: false,
        is_name: true,
        mes:
            'Hello there! In order to begin chatting:<ol><li>Connect to one of the supported generation APIs</li><li>Create or pick a character from the list</li></ol>' +
            'Still have questions left? Check out built-in help or visit our <a target="_blank" href="https://github.com/TavernAI/TavernAI/wiki">TavernAI Wiki</a>!'
    },
    group: {
        name: systemUserName,
        force_avatar: system_avatar,
        is_user: false,
        is_system: true,
        is_name: true,
        mes: "Group chat created. Say 'Hi' to lovely people!",
    },
    empty: {
        name: systemUserName,
        force_avatar: system_avatar,
        is_user: false,
        is_system: true,
        is_name: true,
        mes: "No one hears you. **Hint:** add more members to the group!",
    },
    generic: {
        name: systemUserName,
        force_avatar: system_avatar,
        is_user: false,
        is_system: true,
        is_name: true,
        mes: "Generic system message. User `text` parameter to override the contents",
    },
};

const world_info_position = {
    before: 0,
    after: 1,
};
const talkativeness_default = 0.5;
const storage_keys = {
    collapse_newlines: "TavernAI_collapse_newlines",
};

var is_advanced_char_open = false;
var is_world_edit_open = false;

var menu_type = ""; //what is selected in the menu
var selected_button = ""; //which button pressed
//create pole save
var create_save_name = "";
var create_save_description = "";
var create_save_personality = "";
var create_save_first_message = "";
var create_save_avatar = "";
var create_save_scenario = "";
var create_save_mes_example = "";
var create_save_talkativeness = talkativeness_default;

var timerSaveEdit;
var timerWorldSave;
var timerGroupSave;
var durationSaveEdit = 200;
//animation right menu
var animation_rm_duration = 200;
var animation_rm_easing = "";

var popup_type = "";
var bg_file_for_del = "";
var online_status = "no_connection";

var api_server = "";
var api_server_textgenerationwebui = "";
//var interval_timer = setInterval(getStatus, 2000);
var interval_timer_novel = setInterval(getStatusNovel, 3000);
const groupAutoModeInterval = setInterval(groupChatAutoModeWorker, 5000);
var is_get_status = false;
var is_get_status_novel = false;
var is_api_button_press = false;
var is_api_button_press_novel = false;

var is_send_press = false; //Send generation
let is_group_generating = false; // Group generation flag
var add_mes_without_animation = false;

var this_del_mes = 0;

var this_edit_mes_text = "";
var this_edit_mes_chname = "";
var this_edit_mes_id;

const delay = (ms) => new Promise((res) => setTimeout(res, ms));
//settings
var settings;
var koboldai_settings;
var koboldai_setting_names;
var preset_settings = "gui";
var user_avatar = "you.png";
var temp = 0.5;
var world_info = null;
var world_names;
var world_info_data = null;
var world_info_depth = 2;
var world_info_budget = 128;
var imported_world_name = "";
var amount_gen = 80; //default max length of AI generated responses
var max_context = 2048;
var rep_pen = 1;
var rep_pen_size = 100;

var textgenerationwebui_settings = {
    temp: 0.5,
    top_p: 0.9,
    top_k: 0,
    typical_p: 1,
    rep_pen: 1.1,
    rep_pen_size: 0,
    penalty_alpha: 0,
};

var is_pygmalion = false;
var tokens_already_generated = 0;
var message_already_generated = "";
var if_typing_text = false;
const tokens_cycle_count = 30;
var cycle_count_generation = 0;

var anchor_order = 0;
var style_anchor = true;
var character_anchor = true;
let extension_prompts = {};
var auto_connect = false;
var auto_load_chat = false;

var main_api = "kobold";
//novel settings
var temp_novel = 0.5;
var rep_pen_novel = 1;
var rep_pen_size_novel = 100;

var api_key_novel = "";
var novel_tier;
var model_novel = "euterpe-v2";
var novelai_settings;
var novelai_setting_names;
var preset_settings_novel = "Classic-Krake";

//css
var bg1_toggle = true; // inits the BG as BG1
var css_mes_bg = $('<div class="mes"></div>').css("background");
var css_send_form_display = $("<div id=send_form></div>").css("display");

var colab_ini_step = 1;

var token;

setInterval(function () {
    switch (colab_ini_step) {
        case 0:
            $("#colab_popup_text").html("<h3>Initialization</h3>");
            colab_ini_step = 1;
            break;
        case 1:
            $("#colab_popup_text").html("<h3>Initialization.</h3>");
            colab_ini_step = 2;
            break;
        case 2:
            $("#colab_popup_text").html("<h3>Initialization..</h3>");
            colab_ini_step = 3;
            break;
        case 3:
            $("#colab_popup_text").html("<h3>Initialization...</h3>");
            colab_ini_step = 0;
            break;
    }
}, 500);
/////////////

$.ajaxPrefilter((options, originalOptions, xhr) => {
    xhr.setRequestHeader("X-CSRF-Token", token);
});

$.get("/csrf-token").then((data) => {
    token = data.token;
    getCharacters();
    getSettings("def");
    getLastVersion();
    sendSystemMessage(system_message_types.WELCOME);
    getBackgrounds();
    getUserAvatars();
});

function checkOnlineStatus() {
    //console.log(online_status);
    if (online_status == "no_connection") {
        $("#send_textarea").attr("placeholder", "Not connected to API!"); //Input bar placeholder tells users they are not connected
        $("#send_form").css("background-color", "rgba(100,0,0,0.7)"); //entire input form area is red when not connected
        $("#send_but").css("display", "none"); //send button is hidden when not connected

        $("#online_status_indicator2").css("background-color", "red");
        $("#online_status_text2").html("No connection...");
        $("#online_status_indicator3").css("background-color", "red");
        $("#online_status_text3").html("No connection...");
        is_get_status = false;
        is_get_status_novel = false;
    } else {
        $("#send_textarea").attr("placeholder", "Type a message..."); //on connect, placeholder tells user to type message
        $("#send_form").css("background-color", "rgba(0,0,0,0.7)"); //on connect, form BG changes to transprent black
        $("#send_but").css("display", "inline"); //on connect, send button shows up

        $("#online_status_indicator2").css("background-color", "green");
        $("#online_status_text2").html(online_status);
        $("#online_status_indicator3").css("background-color", "green");
        $("#online_status_text3").html(online_status);
        $("#online_status_indicator4").css("background-color", "green");
        $("#online_status_text4").html(online_status);
    }
}

async function getLastVersion() {
    jQuery.ajax({
        type: "POST", //
        url: "/getlastversion", //
        data: JSON.stringify({
            "": "",
        }),
        beforeSend: function () { },
        cache: false,
        dataType: "json",
        contentType: "application/json",
        //processData: false,
        success: function (data) {
            var getVersion = data.version;
            if (getVersion !== "error" && getVersion != undefined) {
                if (compareVersions(getVersion, VERSION) === 1) {
                    $("#verson").append(" <span>(v." + getVersion + ")</span>");
                }
            }
        },
        error: function (jqXHR, exception) {
            console.log(exception);
            console.log(jqXHR);
        },
    });
}

async function getStatus() {
    if (is_get_status) {
        jQuery.ajax({
            type: "POST", //
            url: "/getstatus", //
            data: JSON.stringify({
                api_server:
                    main_api == "kobold" ? api_server : api_server_textgenerationwebui,
                main_api: main_api,
            }),
            beforeSend: function () {
                if (is_api_button_press) {
                    //$("#api_loading").css("display", 'inline-block');
                    //$("#api_button").css("display", 'none');
                }
                //$('#create_button').attr('value','Creating...'); //
            },
            cache: false,
            dataType: "json",
            crossDomain: true,
            contentType: "application/json",
            //processData: false,
            success: function (data) {
                online_status = data.result;
                if (online_status == undefined) {
                    online_status = "no_connection";
                }
                if (online_status.toLowerCase().indexOf("pygmalion") != -1) {
                    is_pygmalion = true;
                    online_status += " (Pyg. formatting on)";
                } else {
                    is_pygmalion = false;
                }

                //console.log(online_status);
                resultCheckStatus();
                if (online_status !== "no_connection") {
                    var checkStatusNow = setTimeout(getStatus, 3000); //getStatus();
                }
            },
            error: function (jqXHR, exception) {
                console.log(exception);
                console.log(jqXHR);
                online_status = "no_connection";

                resultCheckStatus();
            },
        });
    } else {
        if (is_get_status_novel != true) {
            online_status = "no_connection";
        }
    }
}

function resultCheckStatus() {
    is_api_button_press = false;
    checkOnlineStatus();
    $("#api_loading").css("display", "none");
    $("#api_button").css("display", "inline-block");
    $("#api_loading_textgenerationwebui").css("display", "none");
    $("#api_button_textgenerationwebui").css("display", "inline-block");
}

async function getSoftPromptsList() {
    if (!api_server) {
        return;
    }

    const response = await fetch("/getsoftprompts", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": token,
        },
        body: JSON.stringify({ api_server: api_server }),
    });

    if (response.ok) {
        const data = await response.json();
        updateSoftPromptsList(data.soft_prompts);
    }
}

function clearSoftPromptsList() {
    $('#softprompt option[value!=""]').each(function () {
        $(this).remove();
    });
}

function updateSoftPromptsList(soft_prompts) {
    // Delete SPs removed from Kobold
    $("#softprompt option").each(function () {
        const value = $(this).attr("value");

        if (value == "") {
            return;
        }

        const prompt = soft_prompts.find((x) => x.name === value);
        if (!prompt) {
            $(this).remove();
        }
    });

    // Add SPs added to Kobold
    soft_prompts.forEach((prompt) => {
        if ($(`#softprompt option[value="${prompt.name}"]`).length === 0) {
            $("#softprompt").append(
                `<option value="${prompt.name}">${prompt.name}</option>`
            );

            if (prompt.selected) {
                $("#softprompt").val(prompt.name);
            }
        }
    });

    // No SP selected or no SPs
    if (soft_prompts.length === 0 || !soft_prompts.some((x) => x.selected)) {
        $("#softprompt").val("");
    }
}

function printCharacters() {
    //console.log('printCharacters() entered');

    $("#rm_print_characters_block").empty();
    //console.log('printCharacters() -- sees '+characters.length+' characters.');
    characters.forEach(function (item, i, arr) {
        var this_avatar = default_avatar;
        if (item.avatar != "none") {
            this_avatar = "characters/" + item.avatar + "?" + Date.now();
        } //RossAscends: changed 'prepend' to 'append' to make alphabetical sorting display correctly.
        $("#rm_print_characters_block").append(
            "<div class=character_select chid=" +
            i +
            ' id="CharID' +
            i +
            '"><div class=avatar><img src="' +
            this_avatar +
            '"></div><div class=ch_name>' +
            item.name +
            "</div></div>"
        );
        //console.log('printcharacters() -- printing -- ChID '+i+' ('+item.name+')');
    });
    printGroups();
}

function printGroups() {
    for (let group of groups) {
        const template = $("#group_list_template .group_select").clone();
        template.data("id", group.id);
        template.find(".ch_name").html(group.name);
        $("#rm_print_characters_block").prepend(template);
        updateGroupAvatar(group);
    }
}

function updateGroupAvatar(group) {
    $("#rm_print_characters_block .group_select").each(function () {
        if ($(this).data("id") == group.id) {
            const avatar = getGroupAvatar(group);
            if (avatar) {
                $(this).find(".avatar").replaceWith(avatar);
            }
        }
    });
}

function getGroupAvatar(group) {
    const memberAvatars = [];
    if (group && Array.isArray(group.members) && group.members.length) {
        for (const member of group.members) {
            const charIndex = characters.findIndex((x) => x.name === member);
            if (charIndex !== -1 && characters[charIndex].avatar !== "none") {
                const this_avatar = `characters/${characters[charIndex].avatar
                    }#${Date.now()}`;
                memberAvatars.push(this_avatar);
            }
            if (memberAvatars.length === 4) {
                break;
            }
        }
    }

    // Cohee: there's probably a smarter way to do this..
    if (memberAvatars.length === 1) {
        const groupAvatar = $("#group_avatars_template .collage_1").clone();
        groupAvatar.find(".img_1").attr("src", memberAvatars[0]);
        return groupAvatar;
    }

    if (memberAvatars.length === 2) {
        const groupAvatar = $("#group_avatars_template .collage_2").clone();
        groupAvatar.find(".img_1").attr("src", memberAvatars[0]);
        groupAvatar.find(".img_2").attr("src", memberAvatars[1]);
        return groupAvatar;
    }

    if (memberAvatars.length === 3) {
        const groupAvatar = $("#group_avatars_template .collage_3").clone();
        groupAvatar.find(".img_1").attr("src", memberAvatars[0]);
        groupAvatar.find(".img_2").attr("src", memberAvatars[1]);
        groupAvatar.find(".img_3").attr("src", memberAvatars[2]);
        return groupAvatar;
    }

    if (memberAvatars.length === 4) {
        const groupAvatar = $("#group_avatars_template .collage_4").clone();
        groupAvatar.find(".img_1").attr("src", memberAvatars[0]);
        groupAvatar.find(".img_2").attr("src", memberAvatars[1]);
        groupAvatar.find(".img_3").attr("src", memberAvatars[2]);
        groupAvatar.find(".img_4").attr("src", memberAvatars[3]);
        return groupAvatar;
    }

    // default avatar
    const groupAvatar = $("#group_avatars_template .collage_1").clone();
    groupAvatar.find(".img_1").attr("src", group.avatar_url);
    return groupAvatar;
}

async function getCharacters() {
    await getGroups();

    //console.log('getCharacters() -- entered');
    //console.log(characters);
    var response = await fetch("/getcharacters", {
        //RossAscends: changed from const
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": token,
        },
        body: JSON.stringify({
            "": "",
        }),
    });
    if (response.ok === true) {
        var getData = ""; //RossAscends: reset to force array to update to account for deleted character.
        var getData = await response.json(); //RossAscends: changed from const
        //console.log(getData);

        //var aa = JSON.parse(getData[0]);

        var load_ch_count = Object.getOwnPropertyNames(getData); //RossAscends: change from const to create dynamic character load amounts.
        var charCount = load_ch_count.length;
        //console.log('/getcharacters -- expecting to load '+charCount+' characters.')
        for (var i = 0; i < load_ch_count.length; i++) {
            characters[i] = [];
            characters[i] = getData[i];
            //console.log('/getcharacters -- loaded character #'+(i+1)+' ('+characters[i].name+')');
        }
        //RossAscends: updated character sorting to be alphabetical
        characters.sort(function (a, b) {
            //console.log('sorting characters: '+a.name+' vs '+b.name);
            if (a.name < b.name) {
                return -1;
            }
            if (a.name > b.name) {
                return 1;
            }
            return 0;
        });
        //console.log(characters);

        //characters.reverse();
        //console.log('/getcharacters -- this_chid -- '+this_chid);
        if (this_chid != undefined && this_chid != "invalid-safety-id") {
            $("#avatar_url_pole").val(characters[this_chid].avatar);
        }

        //console.log('/getcharacters -- sending '+i+' characters to /printcharacters');
        printCharacters();
        //console.log(propOwn.length);
        //return JSON.parse(getData[0]);
        //const getData = await response.json();
        //var getMessage = getData.results[0].text;
    }
}

async function getBackgrounds() {
    const response = await fetch("/getbackgrounds", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": token,
        },
        body: JSON.stringify({
            "": "",
        }),
    });
    if (response.ok === true) {
        const getData = await response.json();
        //background = getData;
        //console.log(getData.length);
        for (var i = 0; i < getData.length; i++) {
            //console.log(1);
            $("#bg_menu_content").append(
                "<div class=bg_example><img bgfile='" +
                getData[i] +
                "' class=bg_example_img src='backgrounds/" +
                getData[i] +
                "'><img bgfile='" +
                getData[i] +
                "' class=bg_example_cross src=img/cross.png></div>"
            );
        }
        //var aa = JSON.parse(getData[0]);
        //const load_ch_coint = Object.getOwnPropertyNames(getData);
    }
}
async function isColab() {
    is_checked_colab = true;
    const response = await fetch("/iscolab", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": token,
        },
        body: JSON.stringify({
            "": "",
        }),
    });
    if (response.ok === true) {
        const getData = await response.json();
        if (getData.colaburl != false) {
            $("#colab_shadow_popup").css("display", "none");
            is_colab = true;
            let url = String(getData.colaburl).split("flare.com")[0] + "flare.com";
            url = String(url).split("loca.lt")[0] + "loca.lt";
            $("#api_url_text").val(url);
            setTimeout(function () {
                $("#api_button").click();
            }, 2000);
        }
    }
}

async function setBackground(bg) {
    /*
              const response = await fetch("/setbackground", {
                  method: "POST",
                  headers: { "Content-Type": "application/json" },
                  body: JSON.stringify({
                          "bg": bg
                      })
      
              });
              if (response.ok === true) {
                  //const getData = await response.json();
                  //background = getData;
      
                  //var aa = JSON.parse(getData[0]);
                  //const load_ch_coint = Object.getOwnPropertyNames(getData);
              }*/
    //console.log(bg);
    jQuery.ajax({
        type: "POST", //
        url: "/setbackground", //
        data: JSON.stringify({
            bg: bg,
        }),
        beforeSend: function () {
            //$('#create_button').attr('value','Creating...'); //
        },
        cache: false,
        dataType: "json",
        contentType: "application/json",
        //processData: false,
        success: function (html) {
            //setBackground(html);
            //$('body').css('background-image', 'linear-gradient(rgba(19,21,44,0.75), rgba(19,21,44,0.75)), url('+e.target.result+')');
            //$("#form_bg_download").after("<div class=bg_example><img bgfile='"+html+"' class=bg_example_img src='backgrounds/"+html+"'><img bgfile='"+html+"' class=bg_example_cross src=img/cross.png></div>");
        },
        error: function (jqXHR, exception) {
            console.log(exception);
            console.log(jqXHR);
        },
    });
}

async function delBackground(bg) {
    const response = await fetch("/delbackground", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": token,
        },
        body: JSON.stringify({
            bg: bg,
        }),
    });
    if (response.ok === true) {
        //const getData = await response.json();
        //background = getData;
        //var aa = JSON.parse(getData[0]);
        //const load_ch_coint = Object.getOwnPropertyNames(getData);
    }
}

function printMessages() {
    //console.log(chat);
    //console.log('printMessages() -- printing messages for -- '+this_chid+' '+active_character+' '+characters[this_chid]);
    chat.forEach(function (item, i, arr) {
        addOneMessage(item);
    });
}

function clearChat() {
    count_view_mes = 0;
    extension_prompts = {};
    $("#chat").html("");
}

function messageFormating(mes, ch_name, isSystem, forceAvatar) {
    if (this_chid != undefined && !isSystem)
        mes = mes.replaceAll("<", "&lt;").replaceAll(">", "&gt;"); //for *****
    if (this_chid === undefined) {
        mes = mes
            .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
            .replace(/\*(.+?)\*/g, "<i>$1</i>")
            .replace(/\n/g, "<br/>");
    } else if (!isSystem) {
        mes = converter.makeHtml(mes);
        mes = mes.replace(/{([^}]+)}/g, "");
        mes = mes.replace(/\n/g, "<br/>");
        mes = mes.trim();
    }

    if (forceAvatar) {
        mes = mes.replaceAll(ch_name + ":", "");
    }

    if (ch_name !== name1) {
        mes = mes.replaceAll(name2 + ":", "");
    }
    return mes;
}

function appendImageToMessage(mes, messageElement) {
    if (mes.extra?.image) {
        const image = document.createElement("img");
        image.src = mes.extra?.image;
        image.classList.add("img_extra");
        messageElement.find(".mes_text").prepend(image);
    }
}

function addOneMessage(mes) {
    //var message = mes['mes'];
    //message = mes['mes'].replace(/^\s+/g, '');
    //console.log(message.indexOf(name1+":"));
    var messageText = mes["mes"];
    var characterName = name1;
    var avatarImg = "User Avatars/" + user_avatar;
    const isSystem = mes.is_system;
    generatedPromtCache = "";
    //thisText = thisText.split("\n").join("<br>");
    var avatarImg = "User Avatars/" + user_avatar;
    if (!mes["is_user"]) {
        if (mes.force_avatar) {
            avatarImg = mes.force_avatar;
        } else if (this_chid == undefined || this_chid == "invalid-safety-id") {
            avatarImg = "img/five.png";
        } else {
            if (characters[this_chid].avatar != "none") {
                avatarImg = "characters/" + characters[this_chid].avatar;
                if (is_mes_reload_avatar !== false) {
                    avatarImg += "?" + is_mes_reload_avatar;
                    //console.log(avatarImg);
                }
            } else {
                avatarImg = default_avatar;
            }
        }

        characterName = mes.is_system || mes.force_avatar ? mes.name : name2;
    }

    //Formating
    //messageText = messageText.replace(/\*\*(.+?)\*\*/g, '<b>$1</b>').replace(/\*(.+?)\*/g, '<i>$1</i>').replace(/\n/g, '<br/>');
    //if(characterName != name1){
    //messageText = messageText.replaceAll(name2+":", "");
    //}
    //console.log(messageText);
    if (count_view_mes == 0) {
        messageText = messageText.replace(/{{user}}/gi, name1);
        messageText = messageText.replace(/{{char}}/gi, name2);
        messageText = messageText.replace(/<USER>/gi, name1);
        messageText = messageText.replace(/<BOT>/gi, name2);
    }
    messageText = messageFormating(
        messageText,
        characterName,
        isSystem,
        mes.force_avatar
    );
    const bias = messageFormating(mes.extra?.bias ?? "");

    $("#chat").append(
        "<div class='mes' mesid=" +
        count_view_mes +
        " ch_name=" +
        characterName +
        "><div class='for_checkbox'></div><input type='checkbox' class='del_checkbox'><div class=avatar><img src='" +
        avatarImg +
        "'></div><div class=mes_block><div class=ch_name>" +
        characterName +
        "<div title=Edit class=mes_edit></div><div class=mes_edit_cancel><img src=img/cancel.png></div><div class=mes_edit_done><img src=img/done.png></div></div><div class=mes_text>" +
        `</div><div class='mes_bias'>${bias}</div></div></div>`
    );

    const newMessage = $(`#chat [mesid="${count_view_mes}"]`);
    newMessage.data("isSystem", isSystem);

    appendImageToMessage(mes, newMessage);

    if (isSystem) {
        newMessage.find(".mes_edit").hide();
    }

    if (!if_typing_text) {
        //console.log(messageText);
        $("#chat")
            .children()
            .filter('[mesid="' + count_view_mes + '"]')
            .children(".mes_block")
            .children(".mes_text")
            .append(messageText);
    } else {
        typeWriter(
            $("#chat")
                .children()
                .filter('[mesid="' + count_view_mes + '"]')
                .children(".mes_block")
                .children(".mes_text"),
            messageText,
            50,
            0
        );
    }
    count_view_mes++;
    if (!add_mes_without_animation) {
        $("#chat").children().last().css("opacity", 1.0);
        $("#chat")
            .children()
            .last()
            .transition({
                opacity: 1.0,
                duration: 700,
                easing: "",
                complete: function () { },
            });
    } else {
        add_mes_without_animation = false;
    }
    var $textchat = $("#chat");
    $textchat.scrollTop($textchat[0].scrollHeight);
}

function typeWriter(target, text, speed, i) {
    if (i < text.length) {
        //target.append(text.charAt(i));
        target.html(target.html() + text.charAt(i));
        i++;
        setTimeout(() => typeWriter(target, text, speed, i), speed);
    }
}

function newMesPattern(name) {
    //Patern which denotes a new message
    name = name + ":";
    return name;
}

function substituteParams(content) {
    content = content.replace(/{{user}}/gi, name1);
    content = content.replace(/{{char}}/gi, name2);
    content = content.replace(/<USER>/gi, name1);
    content = content.replace(/<BOT>/gi, name2);
    return content;
}

function checkWorldInfo(chat) {
    if (world_info_data.entries.length == 0) {
        return "";
    }

    const messagesToLookBack = world_info_depth * 2;
    let textToScan = chat.slice(0, messagesToLookBack).join("").toLowerCase();
    let worldInfoBefore = "";
    let worldInfoAfter = "";
    let needsToScan = true;
    let allActivatedEntries = new Set();

    const sortedEntries = Object.keys(world_info_data.entries)
        .map((x) => world_info_data.entries[x])
        .sort((a, b) => b.order - a.order);
    while (needsToScan) {
        let activatedNow = new Set();

        for (let entry of sortedEntries) {
            if (allActivatedEntries.has(entry.uid)) {
                continue;
            }

            if (entry.constant) {
                activatedNow.add(entry.uid);
            }

            if (Array.isArray(entry.key) && entry.key.length) {
                primary: for (let key of entry.key) {
                    if (key && textToScan.includes(key.trim().toLowerCase())) {
                        if (
                            entry.selective &&
                            Array.isArray(entry.keysecondary) &&
                            entry.keysecondary.length
                        ) {
                            secondary: for (let keysecondary of entry.keysecondary) {
                                if (
                                    keysecondary &&
                                    textToScan.includes(keysecondary.trim().toLowerCase())
                                ) {
                                    activatedNow.add(entry.uid);
                                    break secondary;
                                }
                            }
                        } else {
                            activatedNow.add(entry.uid);
                            break primary;
                        }
                    }
                }
            }
        }

        needsToScan = activatedNow.size > 0;
        const newEntries = [...activatedNow]
            .map((x) => world_info_data.entries[x])
            .sort((a, b) => sortedEntries.indexOf(a) - sortedEntries.indexOf(b));

        for (const entry of newEntries) {
            if (entry.position === world_info_position.after) {
                worldInfoAfter = `${substituteParams(
                    entry.content
                )}\n${worldInfoAfter}`;
            } else {
                worldInfoBefore = `${substituteParams(
                    entry.content
                )}\n${worldInfoBefore}`;
            }

            if (
                encode(worldInfoBefore + worldInfoAfter).length >= world_info_budget
            ) {
                needsToScan = false;
                break;
            }
        }

        if (needsToScan) {
            textToScan =
                newEntries
                    .map((x) => x.content)
                    .join("\n")
                    .toLowerCase() + textToScan;
        }

        allActivatedEntries = new Set([...allActivatedEntries, ...activatedNow]);
    }

    return { worldInfoBefore, worldInfoAfter };
}

function isHelpRequest(message) {
    const helpTokens = ["/?", "/help"];
    return helpTokens.includes(message.trim().toLowerCase());
}

function sendSystemMessage(type, text) {
    const systemMessage = system_messages[type];

    if (!systemMessage) {
        return;
    }

    const newMessage = { ...systemMessage, send_date: humanizedDateTime() };

    if (text) {
        newMessage.mes = text;
    }

    chat.push(newMessage);
    addOneMessage(newMessage);
    is_send_press = false;
}

function extractMessageBias(message) {
    if (!message) {
        return null;
    }

    const found = [];
    const rxp = /{([^}]+)}/g;
    let curMatch;

    while ((curMatch = rxp.exec(message))) {
        found.push(curMatch[1].trim());
    }

    if (!found.length) {
        return "";
    }

    return ` ${found.join(" ")} `;
}

async function Generate(type, automatic_trigger) {
    //encode("dsfs").length
    tokens_already_generated = 0;
    message_already_generated = name2 + ": ";

    if (isHelpRequest($("#send_textarea").val())) {
        sendSystemMessage(system_message_types.HELP);
        $("#send_textarea").val("").trigger("input");
        return;
    }

    if (selected_group && !is_group_generating) {
        generateGroupWrapper(false);
        return;
    }

    if (
        online_status != "no_connection" &&
        this_chid != undefined &&
        this_chid !== "invalid-safety-id"
    ) {
        if (type !== "regenerate") {
            is_send_press = true;
            var textareaText = $("#send_textarea").val();
            //console.log('Not a Regenerate call, so posting normall with input of: ' +textareaText);
            $("#send_textarea").val("").trigger("input");
        } else {
            //console.log('Regenerate call detected')
            var textareaText = "";
            if (chat[chat.length - 1]["is_user"]) {
                //If last message from You
            } else {
                //console.log('about to remove last msg')
                chat.length = chat.length - 1;
                count_view_mes -= 1;
                //console.log('removing last msg')
                $("#chat").children().last().remove();
            }
        }

        $("#send_but").css("display", "none");
        $("#loading_mes").css("display", "inline-block");

        let promptBias = null;
        let messageBias = extractMessageBias(textareaText);

        // gets bias of the latest message where it was applied
        for (let mes of chat) {
            if (mes && mes.is_user && mes.extra && mes.extra.bias) {
                promptBias = mes.extra.bias;
            }
        }

        // bias from the latest message is top priority
        promptBias = messageBias ?? promptBias ?? "";

        var storyString = "";
        var userSendString = "";
        var finalPromt = "";

        var postAnchorChar = "talks a lot with descriptions"; //'Talk a lot with description what is going on around';// in asterisks
        var postAnchorStyle = "Writing style: very long messages"; //"[Genre: roleplay chat][Tone: very long messages with descriptions]";

        var anchorTop = "";
        var anchorBottom = "";
        var topAnchorDepth = 8;

        if (character_anchor && !is_pygmalion) {
            if (anchor_order === 0) {
                anchorTop = name2 + " " + postAnchorChar;
            } else {
                anchorBottom = "[" + name2 + " " + postAnchorChar + "]";
            }
        }
        if (style_anchor && !is_pygmalion) {
            if (anchor_order === 1) {
                anchorTop = postAnchorStyle;
            } else {
                anchorBottom = "[" + postAnchorStyle + "]";
            }
        }

        //*********************************
        //PRE FORMATING STRING
        //*********************************
        if (textareaText != "" && !automatic_trigger) {
            chat[chat.length] = {};
            chat[chat.length - 1]["name"] = name1;
            chat[chat.length - 1]["is_user"] = true;
            chat[chat.length - 1]["is_name"] = true;
            chat[chat.length - 1]["send_date"] = humanizedDateTime();
            chat[chat.length - 1]["mes"] = textareaText;
            chat[chat.length - 1]["extra"] = {};

            if (messageBias) {
                chat[chat.length - 1]["extra"]["bias"] = messageBias;
            }

            addOneMessage(chat[chat.length - 1]);
        }
        var chatString = "";
        var arrMes = [];
        var mesSend = [];
        var charDescription = $.trim(characters[this_chid].description);
        var charPersonality = $.trim(characters[this_chid].personality);
        var Scenario = $.trim(characters[this_chid].scenario);
        var mesExamples = $.trim(characters[this_chid].mes_example);
        var checkMesExample = $.trim(mesExamples.replace(/<START>/gi, "")); //for check length without tag
        if (checkMesExample.length == 0) mesExamples = "";
        var mesExamplesArray = [];
        //***Base replace***
        if (mesExamples !== undefined) {
            if (mesExamples.length > 0) {
                if (is_pygmalion) {
                    mesExamples = mesExamples.replace(/{{user}}:/gi, "You:");
                    mesExamples = mesExamples.replace(/<USER>:/gi, "You:");
                }
                mesExamples = mesExamples.replace(/{{user}}/gi, name1);
                mesExamples = mesExamples.replace(/{{char}}/gi, name2);
                mesExamples = mesExamples.replace(/<USER>/gi, name1);
                mesExamples = mesExamples.replace(/<BOT>/gi, name2);
                //mesExamples = mesExamples.replaceAll('<START>', '[An example of how '+name2+' responds]');
                let blocks = mesExamples.split(/<START>/gi);
                mesExamplesArray = blocks
                    .slice(1)
                    .map((block) => `<START>\n${block.trim()}\n`);
            }
        }
        if (charDescription !== undefined) {
            if (charDescription.length > 0) {
                charDescription = charDescription.replace(/{{user}}/gi, name1);
                charDescription = charDescription.replace(/{{char}}/gi, name2);
                charDescription = charDescription.replace(/<USER>/gi, name1);
                charDescription = charDescription.replace(/<BOT>/gi, name2);
            }
        }
        if (charPersonality !== undefined) {
            if (charPersonality.length > 0) {
                charPersonality = charPersonality.replace(/{{user}}/gi, name1);
                charPersonality = charPersonality.replace(/{{char}}/gi, name2);
                charPersonality = charPersonality.replace(/<USER>/gi, name1);
                charPersonality = charPersonality.replace(/<BOT>/gi, name2);
            }
        }
        if (Scenario !== undefined) {
            if (Scenario.length > 0) {
                Scenario = Scenario.replace(/{{user}}/gi, name1);
                Scenario = Scenario.replace(/{{char}}/gi, name2);
                Scenario = Scenario.replace(/<USER>/gi, name1);
                Scenario = Scenario.replace(/<BOT>/gi, name2);
            }
        }

        if (is_pygmalion) {
            if (charDescription.length > 0) {
                storyString = name2 + "'s Persona: " + charDescription + "\n";
            }
            if (charPersonality.length > 0) {
                storyString += "Personality: " + charPersonality + "\n";
            }
            if (Scenario.length > 0) {
                storyString += "Scenario: " + Scenario + "\n";
            }
        } else {
            if (charDescription !== undefined) {
                if (charPersonality.length > 0) {
                    charPersonality = name2 + "'s personality: " + charPersonality; //"["+name2+"'s personality: "+charPersonality+"]";
                }
            }
            if (charDescription !== undefined) {
                if ($.trim(charDescription).length > 0) {
                    if (
                        charDescription.slice(-1) !== "]" ||
                        charDescription.substr(0, 1) !== "["
                    ) {
                        //charDescription = '['+charDescription+']';
                    }
                    storyString += charDescription + "\n";
                }
            }

            if (count_view_mes < topAnchorDepth) {
                storyString += charPersonality + "\n";
            }
        }

        var count_exm_add = 0;
        var chat2 = [];
        var j = 0;
        for (var i = chat.length - 1; i >= 0; i--) {
            if (j == 0) {
                chat[j]["mes"] = chat[j]["mes"].replace(/{{user}}/gi, name1);
                chat[j]["mes"] = chat[j]["mes"].replace(/{{char}}/gi, name2);
                chat[j]["mes"] = chat[j]["mes"].replace(/<USER>/gi, name1);
                chat[j]["mes"] = chat[j]["mes"].replace(/<BOT>/gi, name2);
            }
            let this_mes_ch_name = "";
            if (chat[j]["is_user"]) {
                this_mes_ch_name = name1;
            } else {
                this_mes_ch_name = name2;
            }
            if (chat[j]["is_name"]) {
                chat2[i] = this_mes_ch_name + ": " + chat[j]["mes"] + "\n";
            } else {
                chat2[i] = chat[j]["mes"] + "\n";
            }
            // system messages produce no text
            if (chat[j]["is_system"]) {
                chat2[i] = "";
            }
            // replace bias markup
            chat2[i] = (chat2[i] ?? "").replace(/{([^}]+)}/g, "");
            j++;
        }
        //chat2 = chat2.reverse();
        var this_max_context = 1487;
        if (main_api == "kobold") this_max_context = max_context;
        if (main_api == "novel") {
            if (novel_tier === 1) {
                this_max_context = 1024;
            } else {
                this_max_context = 2048 - 60; //fix for fat tokens
                if (model_novel == "krake-v2") {
                    this_max_context -= 160;
                }
            }
        }

        let worldInfoString = "",
            worldInfoBefore = "",
            worldInfoAfter = "";

        if (world_info && world_info_data) {
            const activatedWorldInfo = checkWorldInfo(chat2);
            worldInfoBefore = activatedWorldInfo.worldInfoBefore;
            worldInfoAfter = activatedWorldInfo.worldInfoAfter;
            worldInfoString = worldInfoBefore + worldInfoAfter;
        }

        let extension_prompt = Object.keys(extension_prompts)
            .sort()
            .map((x) => extension_prompts[x])
            .filter((x) => x)
            .join("\n");
        if (extension_prompt.length && !extension_prompt.endsWith("\n")) {
            extension_prompt += "\n";
        }

        var i = 0;

        for (var item of chat2) {
            //console.log(encode("dsfs").length);
            chatString = item + chatString;
            if (
                encode(
                    JSON.stringify(
                        worldInfoString +
                        storyString +
                        chatString +
                        anchorTop +
                        anchorBottom +
                        charPersonality +
                        promptBias +
                        extension_prompt
                    )
                ).length +
                120 <
                this_max_context
            ) {
                //(The number of tokens in the entire promt) need fix, it must count correctly (added +120, so that the description of the character does not hide)

                //if (is_pygmalion && i == chat2.length-1) item='<START>\n'+item;
                arrMes[arrMes.length] = item;
            } else {
                i = chat.length - 1;
            }
            await delay(1); //For disable slow down (encode gpt-2 need fix)
            //console.log(i+' '+chat.length);
            count_exm_add = 0;
            if (i == chat.length - 1) {
                //arrMes[arrMes.length-1] = '<START>\n'+arrMes[arrMes.length-1];
                let mesExmString = "";
                for (let iii = 0; iii < mesExamplesArray.length; iii++) {
                    //mesExamplesArray It need to make from end to start
                    mesExmString = mesExmString + mesExamplesArray[iii];
                    if (
                        encode(
                            JSON.stringify(
                                worldInfoString +
                                storyString +
                                mesExmString +
                                chatString +
                                anchorTop +
                                anchorBottom +
                                charPersonality +
                                promptBias +
                                extension_prompt
                            )
                        ).length +
                        120 <
                        this_max_context
                    ) {
                        //example of dialogs
                        if (!is_pygmalion) {
                            mesExamplesArray[iii] = mesExamplesArray[iii].replace(
                                /<START>/i,
                                "This is how " + name2 + " should talk"
                            ); //An example of how '+name2+' responds
                        }
                        count_exm_add++;
                        await delay(1);

                        //arrMes[arrMes.length] = item;
                    } else {
                        iii = mesExamplesArray.length;
                    }
                }

                if (!is_pygmalion) {
                    if (Scenario !== undefined) {
                        if (Scenario.length > 0) {
                            storyString +=
                                "Circumstances and context of the dialogue: " + Scenario + "\n";
                        }
                    }
                    //storyString+='\nThen the roleplay chat between '+name1+' and '+name2+' begins.\n';
                }
                runGenerate();
                return;
            }
            i++;
        }

        function runGenerate(cycleGenerationPromt = "") {
            generatedPromtCache += cycleGenerationPromt;
            if (generatedPromtCache.length == 0) {
                chatString = "";
                arrMes = arrMes.reverse();
                var is_add_personality = false;
                arrMes.forEach(function (item, i, arr) {
                    //For added anchors and others

                    if (
                        i >= arrMes.length - 1 &&
                        $.trim(item).substr(0, (name1 + ":").length) != name1 + ":"
                    ) {
                        if (textareaText == "") {
                            item = item.substr(0, item.length - 1);
                        }
                    }
                    if (
                        i === arrMes.length - topAnchorDepth &&
                        count_view_mes >= topAnchorDepth &&
                        !is_add_personality
                    ) {
                        is_add_personality = true;
                        //chatString = chatString.substr(0,chatString.length-1);
                        //anchorAndPersonality = "[Genre: roleplay chat][Tone: very long messages with descriptions]";
                        if ((anchorTop != "" || charPersonality != "") && !is_pygmalion) {
                            if (anchorTop != "") charPersonality += " ";
                            item += "[" + charPersonality + anchorTop + "]\n";
                        }
                    }
                    if (
                        i >= arrMes.length - 1 &&
                        count_view_mes > 8 &&
                        $.trim(item).substr(0, (name1 + ":").length) == name1 + ":" &&
                        !is_pygmalion
                    ) {
                        //For add anchor in end
                        item = item.substr(0, item.length - 1);
                        //chatString+=postAnchor+"\n";//"[Writing style: very long messages]\n";
                        item = item + anchorBottom + "\n";
                    }
                    if (is_pygmalion) {
                        if (
                            i >= arrMes.length - 1 &&
                            $.trim(item).substr(0, (name1 + ":").length) == name1 + ":"
                        ) {
                            //for add name2 when user sent
                            item = item + name2 + ":";
                        }
                        if (
                            i >= arrMes.length - 1 &&
                            $.trim(item).substr(0, (name1 + ":").length) != name1 + ":"
                        ) {
                            //for add name2 when continue
                            if (textareaText == "") {
                                item = item + "\n" + name2 + ":";
                            }
                        }
                        if ($.trim(item).indexOf(name1) === 0) {
                            item = item.replace(name1 + ":", "You:");
                        }
                    }
                    mesSend[mesSend.length] = item;
                    //chatString = chatString+item;
                });
            }
            //finalPromt +=chatString;
            //console.log(storyString);

            //console.log(encode(characters[this_chid].description+chatString).length);
            //console.log(encode(JSON.stringify(characters[this_chid].description+chatString)).length);
            if (type == "force_name2") {
                finalPromt += name2 + ":";
            }
            //console.log(JSON.stringify(storyString));
            //Send story string
            var mesSendString = "";
            var mesExmString = "";

            function setPromtString() {
                mesSendString = "";
                mesExmString = "";
                for (let j = 0; j < count_exm_add; j++) {
                    mesExmString += mesExamplesArray[j];
                }
                for (let j = 0; j < mesSend.length; j++) {
                    mesSendString += mesSend[j];
                }
            }

            function checkPromtSize() {
                setPromtString();
                let thisPromtContextSize =
                    encode(
                        JSON.stringify(
                            worldInfoString +
                            storyString +
                            mesExmString +
                            mesSendString +
                            anchorTop +
                            anchorBottom +
                            charPersonality +
                            generatedPromtCache +
                            promptBias +
                            extension_prompt
                        )
                    ).length + 120;

                if (thisPromtContextSize > this_max_context) {
                    //if the prepared prompt is larger than the max context size...

                    if (count_exm_add > 0) {
                        // ..and we have example mesages..
                        //console.log('Context size: '+thisPromtContextSize+' -- too big, removing example message');
                        //mesExamplesArray.length = mesExamplesArray.length-1;
                        count_exm_add--; // remove the example messages...
                        checkPromtSize(); // and try agin...
                    } else if (mesSend.length > 0) {
                        // if the chat history is longer than 0
                        //console.log('Context size: '+thisPromtContextSize+' -- too big, removing oldest chat message');
                        mesSend.shift(); // remove the first (oldest) chat entry..
                        checkPromtSize(); // and check size again..
                    } else {
                        //end
                    }
                }
            }

            if (generatedPromtCache.length > 0) {
                //console.log('Generated Prompt Cache length: '+generatedPromtCache.length);
                checkPromtSize();
            } else {
                setPromtString();
            }

            if (!is_pygmalion) {
                mesSendString =
                    "\nThen the roleplay chat between " +
                    name1 +
                    " and " +
                    name2 +
                    " begins.\n" +
                    mesSendString;
            } else {
                mesSendString = "<START>\n" + mesSendString;
                //mesSendString = mesSendString; //This edit simply removes the first "<START>" that is prepended to all context prompts
            }
            finalPromt =
                worldInfoBefore +
                storyString +
                worldInfoAfter +
                extension_prompt +
                mesExmString +
                mesSendString +
                generatedPromtCache +
                promptBias;
            finalPromt = finalPromt.replace(/\r/gm, "");

            //if we aren't using the kobold GUI settings...
            if (
                main_api == "textgenerationwebui" ||
                (main_api == "kobold" && preset_settings != "gui")
            ) {
                var this_settings =
                    koboldai_settings[koboldai_setting_names[preset_settings]];

                var this_amount_gen = parseInt(amount_gen); // how many tokens the AI will be requested to generate
                if (is_pygmalion) {
                    // if we are using a pygmalion model...
                    if (tokens_already_generated === 0) {
                        // if nothing has been generated yet..
                        if (parseInt(amount_gen) >= 50) {
                            // if the max gen setting is > 50...(
                            this_amount_gen = 50; // then only try to make 50 this cycle..
                        } else {
                            this_amount_gen = parseInt(amount_gen); // otherwise, make as much as the max amount request.
                        }
                    } else {
                        // if we already recieved some generated text...
                        if (
                            parseInt(amount_gen) - tokens_already_generated <
                            tokens_cycle_count
                        ) {
                            // if the remaining tokens to be made is less than next potential cycle count
                            this_amount_gen = parseInt(amount_gen) - tokens_already_generated; // subtract already generated amount from the desired max gen amount
                        } else {
                            this_amount_gen = tokens_cycle_count; // otherwise make the standard cycle amont (frist 50, and 30 after that)
                        }
                    }
                }
            }

            var generate_data;
            if (main_api == "kobold") {
                var generate_data = {
                    prompt: finalPromt,
                    gui_settings: true,
                    max_length: amount_gen,
                    temperature: temp,
                    max_context_length: max_context,
                };
                if (preset_settings != "gui") {
                    generate_data = {
                        prompt: finalPromt,
                        gui_settings: false,
                        sampler_order: this_settings.sampler_order,
                        max_context_length: parseInt(max_context), //this_settings.max_length,
                        max_length: this_amount_gen, //parseInt(amount_gen),
                        rep_pen: parseFloat(rep_pen),
                        rep_pen_range: parseInt(rep_pen_size),
                        rep_pen_slope: this_settings.rep_pen_slope,
                        temperature: parseFloat(temp),
                        tfs: this_settings.tfs,
                        top_a: this_settings.top_a,
                        top_k: this_settings.top_k,
                        top_p: this_settings.top_p,
                        typical: this_settings.typical,
                        s1: this_settings.sampler_order[0],
                        s2: this_settings.sampler_order[1],
                        s3: this_settings.sampler_order[2],
                        s4: this_settings.sampler_order[3],
                        s5: this_settings.sampler_order[4],
                        s6: this_settings.sampler_order[5],
                        s7: this_settings.sampler_order[6],
                        use_world_info: false,
                    };
                }
            }

            if (main_api == "textgenerationwebui") {
                const doSample = textgenerationwebui_settings.penalty_alpha == 0;
                var generate_data = {
                    data: [
                        finalPromt,
                        this_amount_gen, // min_length
                        doSample, // do_sample
                        textgenerationwebui_settings.temp, // temperature
                        textgenerationwebui_settings.top_p, // top_p
                        textgenerationwebui_settings.typical_p, // typical_p
                        textgenerationwebui_settings.rep_pen, // repetition_penalty
                        textgenerationwebui_settings.top_k, // top_k
                        0, // min_length
                        textgenerationwebui_settings.rep_pen_size, // no_repeat_ngram_size
                        1, // num_beams
                        textgenerationwebui_settings.penalty_alpha, // penalty_alpha
                        1, // length_penalty
                        false, // early_stopping
                        name1, // name1
                        name2, // name2
                        "", // Context
                        true, // stop at newline
                        max_context, // Maximum prompt size in tokens
                        1, // num attempts
                    ],
                };
            }

            if (main_api == "novel") {
                var this_settings =
                    novelai_settings[novelai_setting_names[preset_settings_novel]];
                generate_data = {
                    input: finalPromt,
                    model: model_novel,
                    use_string: true,
                    temperature: parseFloat(temp_novel),
                    max_length: this_settings.max_length,
                    min_length: this_settings.min_length,
                    tail_free_sampling: this_settings.tail_free_sampling,
                    repetition_penalty: parseFloat(rep_pen_novel),
                    repetition_penalty_range: parseInt(rep_pen_size_novel),
                    repetition_penalty_frequency:
                        this_settings.repetition_penalty_frequency,
                    repetition_penalty_presence:
                        this_settings.repetition_penalty_presence,
                    //"stop_sequences": {{187}},
                    //bad_words_ids = {{50256}, {0}, {1}};
                    //generate_until_sentence = true;
                    use_cache: false,
                    //use_string = true;
                    return_full_text: false,
                    prefix: "vanilla",
                    order: this_settings.order,
                };
            }
            var generate_url = "";
            if (main_api == "kobold") {
                generate_url = "/generate";
            } else if (main_api == "textgenerationwebui") {
                generate_url = "/generate_textgenerationwebui";
            } else if (main_api == "novel") {
                generate_url = "/generate_novelai";
            }
            jQuery.ajax({
                type: "POST", //
                url: generate_url, //
                data: JSON.stringify(generate_data),
                beforeSend: function () {
                    //$('#create_button').attr('value','Creating...');
                },
                cache: false,
                dataType: "json",
                contentType: "application/json",
                success: function (data) {
                    tokens_already_generated += this_amount_gen; // add new gen amt to any prev gen counter..

                    //console.log('Tokens requested in total: '+tokens_already_generated);
                    //$("#send_textarea").focus();
                    //$("#send_textarea").removeAttr('disabled');
                    is_send_press = false;
                    if (!data.error) {
                        //const getData = await response.json();
                        var getMessage = "";
                        if (main_api == "kobold") {
                            getMessage = data.results[0].text;
                        } else if (main_api == "textgenerationwebui") {
                            getMessage = data.data[0];
                            if (getMessage == null || data.error) {
                                popup_type = "default";
                                callPopup(
                                    "<h3>Got empty response from Text generation web UI. Try restarting the API with recommended options.</h3>"
                                );
                                return;
                            }
                            getMessage = getMessage.substring(finalPromt.length);
                        } else if (main_api == "novel") {
                            getMessage = data.output;
                        }

                        if (collapse_newlines) {
                            getMessage = getMessage.replaceAll(/\n+/g, "\n");
                        }

                        //Pygmalion run again													// to make it continue generating so long as it's under max_amount and hasn't signaled
                        // an end to the character's response via typing "You:" or adding "<endoftext>"
                        if (is_pygmalion) {
                            if_typing_text = false;
                            message_already_generated += getMessage;
                            promptBias = "";
                            //console.log('AI Response so far: '+message_already_generated);
                            if (
                                message_already_generated.indexOf("You:") === -1 && //if there is no 'You:' in the response msg
                                message_already_generated.indexOf("<|endoftext|>") === -1 && //if there is no <endoftext> stamp in the response msg
                                tokens_already_generated < parseInt(amount_gen) && //if the gen'd msg is less than the max response length..
                                getMessage.length > 0
                            ) {
                                //if we actually have gen'd text at all...
                                runGenerate(getMessage); //generate again with the 'GetMessage' argument..
                                return;
                            }

                            getMessage = message_already_generated;
                        }
                        //Formating
                        getMessage = $.trim(getMessage);
                        if (is_pygmalion) {
                            getMessage = getMessage.replace(new RegExp("<USER>", "g"), name1);
                            getMessage = getMessage.replace(new RegExp("<BOT>", "g"), name2);
                            getMessage = getMessage.replace(
                                new RegExp("You:", "g"),
                                name1 + ":"
                            );
                        }
                        if (getMessage.indexOf(name1 + ":") != -1) {
                            getMessage = getMessage.substr(
                                0,
                                getMessage.indexOf(name1 + ":")
                            );
                        }
                        if (getMessage.indexOf("<|endoftext|>") != -1) {
                            getMessage = getMessage.substr(
                                0,
                                getMessage.indexOf("<|endoftext|>")
                            );
                        }
                        // clean-up group message from excessive generations
                        if (type == "group_chat" && selected_group) {
                            const group = groups.find((x) => x.id == selected_group);

                            if (group && Array.isArray(group.members) && group.members) {
                                for (let member of group.members) {
                                    // Skip current speaker.
                                    if (member === name2) {
                                        continue;
                                    }

                                    const indexOfMember = getMessage.indexOf(member + ":");
                                    if (indexOfMember != -1) {
                                        getMessage = getMessage.substr(0, indexOfMember);
                                    }
                                }
                            }
                        }
                        let this_mes_is_name = true;
                        if (getMessage.indexOf(name2 + ":") === 0) {
                            getMessage = getMessage.replace(name2 + ":", "");
                            getMessage = getMessage.trimStart();
                        } else {
                            this_mes_is_name = false;
                        }
                        if (type === "force_name2") this_mes_is_name = true;
                        //getMessage = getMessage.replace(/^\s+/g, '');
                        if (getMessage.length > 0) {
                            chat[chat.length] = {};
                            chat[chat.length - 1]["name"] = name2;
                            chat[chat.length - 1]["is_user"] = false;
                            chat[chat.length - 1]["is_name"] = this_mes_is_name;
                            chat[chat.length - 1]["send_date"] = humanizedDateTime();
                            getMessage = $.trim(getMessage);
                            chat[chat.length - 1]["mes"] = getMessage;

                            if (type === "group_chat") {
                                let avatarImg = default_avatars;
                                if (characters[this_chid].avatar != "none") {
                                    avatarImg = `characters/${characters[this_chid].avatar
                                        }?${Date.now()}`;
                                }
                                chat[chat.length - 1]["is_name"] = true;
                                chat[chat.length - 1]["force_avatar"] = avatarImg;
                            }

                            addOneMessage(chat[chat.length - 1]);
                            $("#send_but").css("display", "inline");
                            $("#loading_mes").css("display", "none");

                            if (type == "group_chat" && selected_group) {
                                saveGroupChat(selected_group);
                            } else {
                                saveChat();
                            }
                            //console.log('/savechat called by /Generate');
                            //let final_message_length = encode(JSON.stringify(getMessage)).length;
                            //console.log('AI Response: +'+getMessage+ '('+final_message_length+' tokens)');
                        } else {
                            Generate("force_name2");
                        }
                    } else {
                        $("#send_but").css("display", "inline");
                        $("#loading_mes").css("display", "none");
                    }
                },
                error: function (jqXHR, exception) {
                    $("#send_textarea").removeAttr("disabled");
                    is_send_press = false;
                    $("#send_but").css("display", "inline");
                    $("#loading_mes").css("display", "none");
                    console.log(exception);
                    console.log(jqXHR);
                },
            });
        }
    } else {
        if (this_chid == undefined || this_chid == "invalid-safety-id") {
            //send ch sel
            popup_type = "char_not_selected";
            callPopup("<h3>Сharacter is not selected</h3>");
        }
        is_send_press = false;
    }
}

async function saveChat() {
    chat.forEach(function (item, i) {
        if (item["is_user"]) {
            var str = item["mes"].replace(name1 + ":", default_user_name + ":");
            chat[i]["mes"] = str;
            chat[i]["name"] = default_user_name;
        }
    });
    var save_chat = [
        {
            user_name: default_user_name,
            character_name: name2,
            create_date: chat_create_date,
        },
        ...chat,
    ];
    jQuery.ajax({
        type: "POST",
        url: "/savechat",
        data: JSON.stringify({
            ch_name: characters[this_chid].name,
            file_name: characters[this_chid].chat,
            chat: save_chat,
            avatar_url: characters[this_chid].avatar,
        }),
        beforeSend: function () {
            //$('#create_button').attr('value','Creating...');
        },
        cache: false,
        dataType: "json",
        contentType: "application/json",
        success: function (data) { },
        error: function (jqXHR, exception) {
            console.log(exception);
            console.log(jqXHR);
        },
    });
}

async function getChat() {
    console.log("/getchat -- entered for -- " + characters[this_chid].name);
    jQuery.ajax({
        type: "POST",
        url: "/getchat",
        data: JSON.stringify({
            ch_name: characters[this_chid].name,
            file_name: characters[this_chid].chat,
            avatar_url: characters[this_chid].avatar,
        }),
        beforeSend: function () {
            //$('#create_button').attr('value','Creating...');
        },
        cache: false,
        dataType: "json",
        contentType: "application/json",
        success: function (data) {
            //console.log(data);
            //chat.length = 0;
            if (data[0] !== undefined) {
                for (let key in data) {
                    chat.push(data[key]);
                }
                //chat =  data;
                chat_create_date = chat[0]["create_date"];
                //console.log('/getchat saw chat_create_date: '+chat_create_date);
                chat.shift();
            } else {
                chat_create_date = humanizedDateTime();
            }
            //console.log(chat);
            getChatResult();
            saveChat();
        },
        error: function (jqXHR, exception) {
            getChatResult();
            console.log(exception);
            console.log(jqXHR);
        },
    });
}
function getChatResult() {
    name2 = characters[this_chid].name;
    if (chat.length > 1) {
        chat.forEach(function (item, i) {
            if (item["is_user"]) {
                var str = item["mes"].replace(default_user_name + ":", name1 + ":");
                chat[i]["mes"] = str;
                chat[i]["name"] = name1;
            }
        });
    } else {
        //console.log(characters[this_chid].first_mes);
        chat[0] = {};
        chat[0]["name"] = name2;
        chat[0]["is_user"] = false;
        chat[0]["is_name"] = true;
        chat[0]["send_date"] = humanizedDateTime();
        if (characters[this_chid].first_mes != "") {
            chat[0]["mes"] = characters[this_chid].first_mes;
        } else {
            chat[0]["mes"] = default_ch_mes;
        }
    }
    printMessages();
    select_selected_character(this_chid);
}
async function generateGroupWrapper(by_auto_mode) {
    if (online_status === "no_connection") {
        is_group_generating = false;
        is_send_press = false;
        return;
    }

    const group = groups.find((x) => x.id === selected_group);

    if (!group || !Array.isArray(group.members) || !group.members.length) {
        sendSystemMessage(system_message_types.EMPTY);
        return;
    }

    try {
        is_group_generating = true;
        this_chid = undefined;
        name2 = "";
        const userInput = $("#send_textarea").val();

        let typingIndicator = $("#chat .typing_indicator");

        if (typingIndicator.length === 0) {
            typingIndicator = $(
                "#typing_indicator_template .typing_indicator"
            ).clone();
            typingIndicator.hide();
            $("#chat").append(typingIndicator);
        }

        let messagesBefore = chat.length;
        let activationText = "";
        if (userInput && userInput.length && !by_auto_mode) {
            activationText = userInput;
            messagesBefore++;
        } else {
            const lastMessage = chat[chat.length - 1];
            if (lastMessage && !lastMessage.is_system) {
                activationText = lastMessage.mes;
            }
        }

        const activatedMembers = activateMembers(group.members, activationText);
        // now the real generation begins: cycle through every character
        for (const chId of activatedMembers) {
            this_chid = chId;
            name2 = characters[chId].name;

            await Generate("group_chat", by_auto_mode);

            // update indicator and scroll down
            typingIndicator
                .find(".typing_indicator_name")
                .text(characters[chId].name);
            $("#chat").append(typingIndicator);
            typingIndicator.show(250, function () {
                typingIndicator.get(0).scrollIntoView({ behavior: "smooth" });
            });

            while (true) {
                // check if message generated already
                if (chat.length == messagesBefore) {
                    await delay(10);
                } else {
                    messagesBefore++;
                    break;
                }
            }

            // hide and reapply the indicator to the bottom of the list
            typingIndicator.hide(250);
            $("#chat").append(typingIndicator);
        }
    } finally {
        is_group_generating = false;
        is_send_press = false;
        this_chid = undefined;
    }
}
function activateMembers(members, input) {
    let activatedNames = [];

    // find mentions
    if (input && input.length) {
        for (let inputWord of extractAllWords(input)) {
            for (let member of members) {
                if (extractAllWords(member).includes(inputWord)) {
                    activatedNames.push(member);
                    break;
                }
            }
        }
    }

    // activation by talkativeness (in shuffled order)
    const shuffledMembers = shuffle([...members]);
    for (let member of shuffledMembers) {
        const character = characters.find((x) => x.name === member);

        if (!character) {
            continue;
        }

        const rollValue = Math.random();
        let talkativeness = Number(character.talkativeness);
        talkativeness = Number.isNaN(talkativeness)
            ? talkativeness_default
            : talkativeness;
        if (talkativeness >= rollValue) {
            activatedNames.push(member);
        }
    }

    // pick 1 at random if no one was activated
    if (activatedNames.length === 0) {
        const randomIndex = Math.floor(Math.random() * members.length);
        activatedNames.push(members[randomIndex]);
    }

    // de-duplicate array of names
    activatedNames = activatedNames.filter(onlyUnique);

    // map to character ids
    const memberIds = activatedNames
        .map((x) => characters.findIndex((y) => y.name === x))
        .filter((x) => x !== -1);
    return memberIds;
}
function extractAllWords(value) {
    const words = [];

    if (!value) {
        return words;
    }

    const matches = value.matchAll(/\b\w+\b/gim);
    for (let match of matches) {
        words.push(match[0].toLowerCase());
    }
    return words;
}

// Group chats
async function getGroupChat(id) {
    const response = await fetch("/getgroupchat", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": token,
        },
        body: JSON.stringify({ id: id }),
    });

    if (response.ok) {
        const data = await response.json();
        if (Array.isArray(data) && data.length) {
            for (let key of data) {
                chat.push(key);
            }
            printMessages();
        } else {
            sendSystemMessage(system_message_types.GROUP);
            const group = groups.find((x) => x.id === id);
            if (group && Array.isArray(group.members)) {
                for (let name of group.members) {
                    const character = characters.find((x) => x.name === name);

                    if (!character) {
                        continue;
                    }

                    const mes = {};
                    mes["is_user"] = false;
                    mes["is_system"] = false;
                    mes["name"] = character.name;
                    mes["is_name"] = true;
                    mes["send_date"] = humanizedDateTime();
                    mes["mes"] = character.first_mes
                        ? substituteParams(character.first_mes.trim())
                        : default_ch_mes;
                    mes["force_avatar"] =
                        character.avatar != "none"
                            ? `characters/${character.avatar}?${Date.now()}`
                            : default_avatar;
                    chat.push(mes);
                    addOneMessage(mes);
                }
            }
        }

        await saveGroupChat(id);
    }
}

async function saveGroupChat(id) {
    const response = await fetch("/savegroupchat", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": token,
        },
        body: JSON.stringify({ id: id, chat: [...chat] }),
    });
}

async function getGroups() {
    const response = await fetch("/getgroups", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": token,
        },
    });

    if (response.ok) {
        const data = await response.json();
        groups = data.sort((a, b) => a.id - b.id);
    }
}

async function deleteGroup(id) {
    const response = await fetch("/deletegroup", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": token,
        },
        body: JSON.stringify({ id: id }),
    });

    if (response.ok) {
        active_character = "invalid-safety-id"; //unsets the chid in settings (this prevents AutoLoadChat from trying to load the wrong ChID
        this_chid = "invalid-safety-id"; //unsets expected chid before reloading (related to getCharacters/printCharacters from using old arrays)
        selected_group = null;
        characters.length = 0; // resets the characters array, forcing getcharacters to reset
        name2 = systemUserName; // replaces deleted charcter name with *****, since she wil be displayed next.
        chat = [...safetychat]; // sets up ***** to tell user about having deleted a character

        /*   QuickRefresh(); */
        $("#rm_info_avatar").html("");
        $("#rm_info_block").transition({ opacity: 0, duration: 0 });
        select_rm_info("Group deleted!");
        $("#rm_info_block").transition({ opacity: 1.0, duration: 2000 });
    }
}

async function editGroup(id, immediately) {
    const group = groups.find((x) => x.id == id);

    if (!group) {
        return;
    }

    async function _save() {
        const response = await fetch("/editgroup", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": token,
            },
            body: JSON.stringify(group),
        });
    }

    if (immediately) {
        return await _save();
    }

    clearTimeout(timerGroupSave);
    timerGroupSave = setTimeout(async () => await _save(), durationSaveEdit);
}

async function groupChatAutoModeWorker() {
    if (!is_group_automode_enabled || online_status === "no_connection") {
        return;
    }

    if (!selected_group || is_send_press || is_group_generating) {
        return;
    }

    const group = groups.find((x) => x.id === selected_group);

    if (!group || !Array.isArray(group.members) || !group.members.length) {
        return;
    }

    await generateGroupWrapper(true);
}

function select_group_chats(chat_id) {
    menu_type = "group_chats";
    const group = chat_id && groups.find((x) => x.id == chat_id);
    const groupName = group?.name ?? "";

    $("#rm_group_chat_name").val(groupName);
    $("#rm_group_chat_name").off();
    $("#rm_group_chat_name").on("input", async function () {
        if (chat_id) {
            group.name = $(this).val();
            await editGroup(chat_id);
        }
    });
    $("#rm_group_filter").val("").trigger("input");
    $("#rm_group_chats_block").css("display", "flex");
    $("#rm_group_chats_block").css("opacity", 0.0);
    $("#rm_group_chats_block").transition({
        opacity: 1.0,
        duration: animation_rm_duration,
        easing: animation_rm_easing,
        complete: function () { },
    });

    $("#rm_ch_create_block").css("display", "none");
    $("#rm_characters_block").css("display", "none");

    async function memberClickHandler(event) {
        event.stopPropagation();
        const id = $(this).data("id");
        const isDelete = !!$(this).closest("#rm_group_members").length;
        const template = $(this).clone();
        template.data("id", id);
        template.click(memberClickHandler);

        if (isDelete) {
            template.find(".plus").show();
            template.find(".minus").hide();
            $("#rm_group_add_members").prepend(template);
        } else {
            template.find(".plus").hide();
            template.find(".minus").show();
            $("#rm_group_members").prepend(template);
        }

        if (group) {
            if (isDelete) {
                const index = group.members.findIndex((x) => x === id);
                if (index !== -1) {
                    group.members.splice(index, 1);
                }
            } else {
                group.members.push(id);
            }
            await editGroup(chat_id);
            updateGroupAvatar(group);
        }

        $(this).remove();
        const groupHasMembers = !!$("#rm_group_members").children().length;
        $("#rm_group_submit").prop("disabled", !groupHasMembers);
    }

    // render characters list
    $("#rm_group_add_members").empty();
    $("#rm_group_members").empty();
    for (let character of characters) {
        const avatar =
            character.avatar != "none"
                ? `characters/${character.avatar}#${Date.now()}`
                : default_avatar;
        const template = $("#group_member_template .group_member").clone();
        template.data("id", character.name);
        template.find(".avatar img").attr("src", avatar);
        template.find(".ch_name").html(character.name);
        template.click(memberClickHandler);

        if (
            group &&
            Array.isArray(group.members) &&
            group.members.includes(character.name)
        ) {
            template.find(".plus").hide();
            template.find(".minus").show();
            $("#rm_group_members").append(template);
        } else {
            template.find(".plus").show();
            template.find(".minus").hide();
            $("#rm_group_add_members").append(template);
        }
    }

    const groupHasMembers = !!$("#rm_group_members").children().length;
    $("#rm_group_submit").prop("disabled", !groupHasMembers);

    // bottom buttons
    if (chat_id) {
        $("#rm_group_submit").hide();
        $("#rm_group_delete").show();
    } else {
        $("#rm_group_submit").show();
        $("#rm_group_delete").hide();
    }

    $("#rm_group_delete").off();
    $("#rm_group_delete").on("click", function () {
        popup_type = "del_group";
        $("#dialogue_popup").data("group_id", chat_id);
        callPopup("<h3>Delete the group?</h3>");
    });

    // top bar
    if (group) {
        var display_name = groupName;
        $("#rm_button_selected_ch").children("h2").css(deselected_button_style);
        $("#rm_button_selected_ch").children("h2").text("");
    }
}
function openNavToggle() {
    if (!$("#nav-toggle").prop("checked")) {
        $("#nav-toggle").trigger("click");
    }
}
function changeMainAPI() {
    if ($("#main_api").find(":selected").val() == "kobold") {
        $("#kobold_api").css("display", "block");
        $("#novel_api").css("display", "none");
        $("#textgenerationwebui_api").css("display", "none");
        main_api = "kobold";
        $("#max_context_block").css("display", "block");
        $("#amount_gen_block").css("display", "block");
        $("#softprompt_block").css("display", "block");
        $("#settings_perset").trigger("change");
    }
    if ($("#main_api").find(":selected").val() == "textgenerationwebui") {
        $("#kobold_api").css("display", "none");
        $("#novel_api").css("display", "none");
        $("#textgenerationwebui_api").css("display", "block");
        main_api = "textgenerationwebui";
        $("#max_context_block").css("display", "block");
        $("#amount_gen_block").css("display", "block");
        $("#softprompt_block").css("display", "block");
        $("#amount_gen_block").children().prop("disabled", false);
        $("#amount_gen_block").css("opacity", 1.0);
    }

    if ($("#main_api").find(":selected").val() == "novel") {
        $("#kobold_api").css("display", "none");
        $("#novel_api").css("display", "block");
        $("#textgenerationwebui_api").css("display", "none");
        main_api = "novel";
        $("#max_context_block").css("display", "none");
        $("#amount_gen_block").css("display", "none");
        $("#softprompt_block").css("display", "none");
    }
}
async function getUserAvatars() {
    $("#user_avatar_block").html(""); //RossAscends: necessary to avoid doubling avatars each QuickRefresh.
    $("#user_avatar_block").append('<div class="avatar_upload">+</div>');
    const response = await fetch("/getuseravatars", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": token,
        },
        body: JSON.stringify({
            "": "",
        }),
    });
    if (response.ok === true) {
        const getData = await response.json();
        //background = getData;
        //console.log(getData.length);

        for (var i = 0; i < getData.length; i++) {
            //console.log(1);
            appendUserAvatar(getData[i]);
        }
        //var aa = JSON.parse(getData[0]);
        //const load_ch_coint = Object.getOwnPropertyNames(getData);
    }
}

function highlightSelectedAvatar() {
    $("#user_avatar_block").find(".avatar").removeClass("selected");
    $("#user_avatar_block")
        .find(`.avatar[imgfile='${user_avatar}']`)
        .addClass("selected");
}

function appendUserAvatar(name) {
    const block = $("#user_avatar_block").append(
        '<div imgfile="' +
        name +
        '" class="avatar"><img src="User Avatars/' +
        name +
        '"</div>'
    );
    highlightSelectedAvatar();
}
//***************SETTINGS****************//
///////////////////////////////////////////
async function getSettings(type) {
    //timer

    //console.log('getSettings() pinging server for settings request');
    jQuery.ajax({
        type: "POST",
        url: "/getsettings",
        data: JSON.stringify({}),
        beforeSend: function () { },
        cache: false,
        dataType: "json",
        contentType: "application/json",
        //processData: false,
        success: function (data) {
            if (data.result != "file not find" && data.settings) {
                settings = JSON.parse(data.settings);
                if (settings.username !== undefined) {
                    if (settings.username !== "") {
                        name1 = settings.username;
                        $("#your_name").val(name1);
                    }
                }

                //Load which API we are using
                if (settings.main_api != undefined) {
                    main_api = settings.main_api;
                    $("#main_api option[value=" + main_api + "]").attr(
                        "selected",
                        "true"
                    );
                    changeMainAPI();
                }
                //load Novel API KEY is exists
                if (settings.api_key_novel != undefined) {
                    api_key_novel = settings.api_key_novel;
                    $("#api_key_novel").val(api_key_novel);
                }
                //load the rest of the Novel settings without any checks
                model_novel = settings.model_novel;
                $("#model_novel_select option[value=" + model_novel + "]").attr(
                    "selected",
                    "true"
                );

                novelai_setting_names = data.novelai_setting_names;
                novelai_settings = data.novelai_settings;
                novelai_settings.forEach(function (item, i, arr) {
                    novelai_settings[i] = JSON.parse(item);
                });
                var arr_holder = {};

                $("#settings_perset_novel").empty();

                novelai_setting_names.forEach(function (item, i, arr) {
                    arr_holder[item] = i;
                    $("#settings_perset_novel").append(
                        "<option value=" + i + ">" + item + "</option>"
                    );
                });
                novelai_setting_names = {};
                novelai_setting_names = arr_holder;

                preset_settings_novel = settings.preset_settings_novel;
                $(
                    "#settings_perset_novel option[value=" +
                    novelai_setting_names[preset_settings_novel] +
                    "]"
                ).attr("selected", "true");

                //Load KoboldAI settings
                koboldai_setting_names = data.koboldai_setting_names;
                koboldai_settings = data.koboldai_settings;
                koboldai_settings.forEach(function (item, i, arr) {
                    koboldai_settings[i] = JSON.parse(item);
                });
                var arr_holder = {};

                $("#settings_perset").empty(); //RossAscends: uncommented this to prevent settings selector from doubling preset list on QuickRefresh
                $("#settings_perset").append(
                    '<option value="gui">GUI KoboldAI Settings</option>'
                ); //adding in the GUI settings, since it is not loaded dynamically

                koboldai_setting_names.forEach(function (item, i, arr) {
                    arr_holder[item] = i;
                    $("#settings_perset").append(
                        "<option value=" + i + ">" + item + "</option>"
                    );
                    //console.log('loading preset #'+i+' -- '+item);
                });
                koboldai_setting_names = {};
                koboldai_setting_names = arr_holder;
                preset_settings = settings.preset_settings;

                //Load AI model config settings (temp, context length, anchors, and anchor order)

                textgenerationwebui_settings =
                    settings.textgenerationwebui_settings || textgenerationwebui_settings;

                temp = settings.temp;
                amount_gen = settings.amount_gen;
                if (settings.max_context !== undefined)
                    max_context = parseInt(settings.max_context);
                if (settings.anchor_order !== undefined)
                    anchor_order = parseInt(settings.anchor_order);
                if (settings.style_anchor !== undefined)
                    style_anchor = !!settings.style_anchor;
                if (settings.character_anchor !== undefined)
                    character_anchor = !!settings.character_anchor;
                if (settings.world_info_depth !== undefined)
                    world_info_depth = Number(settings.world_info_depth);
                if (settings.world_info_budget !== undefined)
                    world_info_budget = Number(settings.world_info_budget);

                //load poweruser options
                if (settings.auto_connect !== undefined)
                    auto_connect = !!settings.auto_connect;
                if (settings.auto_load_chat !== undefined)
                    auto_load_chat = !!settings.auto_load_chat;

                rep_pen = settings.rep_pen;
                rep_pen_size = settings.rep_pen_size;

                var addZeros = "";
                if (isInt(temp)) addZeros = ".00";
                $("#temp").val(temp);
                $("#temp_counter").html(temp + addZeros);

                $("#style_anchor").prop("checked", style_anchor);
                $("#character_anchor").prop("checked", character_anchor);
                $("#anchor_order option[value=" + anchor_order + "]").attr(
                    "selected",
                    "true"
                );

                $("#auto-connect-checkbox").prop("checked", auto_connect);
                $("#auto-load-chat-checkbox").prop("checked", auto_load_chat);

                $("#max_context").val(max_context);
                $("#max_context_counter").html(max_context + " Tokens");

                $("#amount_gen").val(amount_gen);
                $("#amount_gen_counter").html(amount_gen + " Tokens");

                $("#world_info_depth_counter").html(`${world_info_depth} Messages`);
                $("#world_info_depth").val(world_info_depth);

                $("#world_info_budget_counter").html(`${world_info_budget} Tokens`);
                $("#world_info_budget").val(world_info_budget);

                addZeros = "";
                if (isInt(rep_pen)) addZeros = ".00";
                $("#rep_pen").val(rep_pen);
                $("#rep_pen_counter").html(rep_pen + addZeros);

                $("#rep_pen_size").val(rep_pen_size);
                $("#rep_pen_size_counter").html(rep_pen_size + " Tokens");

                //Novel
                temp_novel = settings.temp_novel;
                rep_pen_novel = settings.rep_pen_novel;
                rep_pen_size_novel = settings.rep_pen_size_novel;

                addZeros = "";
                if (isInt(temp_novel)) addZeros = ".00";
                $("#temp_novel").val(temp_novel);
                $("#temp_counter_novel").html(temp_novel + addZeros);

                addZeros = "";
                if (isInt(rep_pen_novel)) addZeros = ".00";
                $("#rep_pen_novel").val(rep_pen_novel);
                $("#rep_pen_counter_novel").html(rep_pen_novel + addZeros);

                $("#rep_pen_size_novel").val(rep_pen_size_novel);
                $("#rep_pen_size_counter_novel").html(rep_pen_size_novel + " Tokens");

                //Enable GUI deference settings if GUI is selected for Kobold
                if (preset_settings == "gui") {
                    $("#settings_perset option[value=gui]")
                        .attr("selected", "true")
                        .trigger("change");
                    $("#range_block").children().prop("disabled", true);
                    $("#range_block").css("opacity", 0.5);

                    $("#amount_gen_block").children().prop("disabled", true);
                    $("#amount_gen_block").css("opacity", 0.45);
                } else {
                    if (typeof koboldai_setting_names[preset_settings] !== "undefined") {
                        $(
                            "#settings_perset option[value=" +
                            koboldai_setting_names[preset_settings] +
                            "]"
                        )
                            .attr("selected", "true")
                            .trigger("change");
                    } else {
                        $("#range_block").children().prop("disabled", true);
                        $("#range_block").css("opacity", 0.5);
                        $("#amount_gen_block").children().prop("disabled", true);
                        $("#amount_gen_block").css("opacity", 0.45);

                        preset_settings = "gui";
                        $("#settings_perset option[value=gui]")
                            .attr("selected", "true")
                            .trigger("change");
                    }
                }

                //Load User's Name and Avatar

                user_avatar = settings.user_avatar;
                $(".mes").each(function () {
                    if ($(this).attr("ch_name") == name1) {
                        $(this)
                            .children(".avatar")
                            .children("img")
                            .attr("src", "User Avatars/" + user_avatar);
                    }
                });

                //Load the API server URL from settings
                api_server = settings.api_server;
                $("#api_url_text").val(api_server);

                // world info settings
                world_names = data.world_names?.length ? data.world_names : [];

                if (settings.world_info != undefined) {
                    if (world_names.includes(settings.world_info)) {
                        world_info = settings.world_info;
                    }
                }

                world_names.forEach((item, i) => {
                    $("#world_info").append(`<option value='${i}'>${item}</option>`);
                    // preselect world if saved
                    if (item == world_info) {
                        $("#world_info").val(i).change();
                    }
                });
                // end world info settings

                if (data.enable_extensions) {
                    const src = "scripts/extensions.js";
                    if ($(`script[src="${src}"]`).length === 0) {
                        const script = document.createElement("script");
                        script.type = "text/javascript";
                        script.src = src;
                        $("body").append(script);
                    }
                }

                //get the character to auto-load
                if (settings.active_character !== undefined) {
                    if (settings.active_character !== "") {
                        active_character = settings.active_character;
                    }
                }

                api_server_textgenerationwebui =
                    settings.api_server_textgenerationwebui;
                $("#textgenerationwebui_api_url_text").val(
                    api_server_textgenerationwebui
                );

                for (var i of [
                    "temp",
                    "rep_pen",
                    "rep_pen_size",
                    "top_k",
                    "top_p",
                    "typical_p",
                    "penalty_alpha",
                ]) {
                    $("#" + i + "_textgenerationwebui").val(
                        textgenerationwebui_settings[i]
                    );
                    $("#" + i + "_counter_textgenerationwebui").html(
                        textgenerationwebui_settings[i]
                    );
                }
                /*                            //RossAscends: getting variables added/adjusted/applied with RA-mods
                                active_character = settings.active_character;
                                this_chid = settings.active_character; //forcing variable sameness for chid and this_chid with active_character in order to load RA_ALC
                                var chid = settings.active_character; //forcing variable sameness for chid and this_chid with active_character in order to load RA_ALC
                                console.log(
                                    "getSettings -- loaded from file -- active_character : " +
                                    settings.active_character
                                );
                                auto_connect = settings.auto_connect;
                                auto_load_chat = settings.auto_load_chat; */
                selected_button = settings.selected_button;
                /*                         NavOpenClosePref = settings.NavOpenClosePref;
                                stickyNavPref = settings.stickyNavPref; */
                /*                         $("#nav-toggle").prop("checked", NavOpenClosePref);
                                $("#rm_button_panel_pin").prop("checked", stickyNavPref);
                                $("#auto-connect-checkbox").prop("checked", auto_connect);
                                $("#auto-load-chat-checkbox").prop("checked", auto_load_chat);  */
            }

            if (!is_checked_colab) isColab();
        },
        error: function (jqXHR, exception) {
            console.log(exception);
            console.log(jqXHR);
        },
    });

    collapse_newlines =
        localStorage.getItem(storage_keys.collapse_newlines) == "true";
    $("#collapse-newlines-checkbox").prop("checked", collapse_newlines);
}

async function saveSettings(type) {
    //console.log('Entering settings with name1 = '+name1);
    jQuery.ajax({
        type: "POST",
        url: "/savesettings",
        data: JSON.stringify({
            username: name1,
            api_server: api_server,
            api_server_textgenerationwebui: api_server_textgenerationwebui,
            preset_settings: preset_settings,
            preset_settings_novel: preset_settings_novel,
            user_avatar: user_avatar,
            temp: temp,
            amount_gen: amount_gen,
            max_context: max_context,
            anchor_order: anchor_order,
            style_anchor: style_anchor,
            character_anchor: character_anchor,
            auto_connect: auto_connect,
            auto_load_chat: auto_load_chat,
            main_api: main_api,
            api_key_novel: api_key_novel,
            rep_pen: rep_pen,
            rep_pen_size: rep_pen_size,
            model_novel: model_novel,
            temp_novel: temp_novel,
            rep_pen_novel: rep_pen_novel,
            rep_pen_size_novel: rep_pen_size_novel,
            world_info: world_info,
            world_info_depth: world_info_depth,
            world_info_budget: world_info_budget,
            active_character: active_character,
            textgenerationwebui_settings: textgenerationwebui_settings,
        }),
        beforeSend: function () {
            //console.log('saveSettings() -- active_character -- '+active_character);
            if (type == "change_name") {
                name1 = $("#your_name").val();
                //     console.log('beforeSend name1 = '+name1);
            }
        },
        cache: false,
        dataType: "json",
        contentType: "application/json",
        //processData: false,
        success: function (data) {
            //online_status = data.result;
            if (type == "change_name") {
                //console.log('got name change');
                //console.log('success: reading from settings = ' + settings.username);
                //name1 = settings.username;

                clearChat();
                printMessages();
            }
        },
        error: function (jqXHR, exception) {
            console.log(exception);
            console.log(jqXHR);
        },
    });

    localStorage.setItem(storage_keys.collapse_newlines, collapse_newlines);
}

function isInt(value) {
    return (
        !isNaN(value) &&
        parseInt(Number(value)) == value &&
        !isNaN(parseInt(value, 10))
    );
}

function messageEditDone(div) {
    var text = div
        .parent()
        .parent()
        .children(".mes_text")
        .children(".edit_textarea")
        .val();
    //var text = chat[this_edit_mes_id];
    text = text.trim();
    const bias = extractMessageBias(text);
    chat[this_edit_mes_id]["mes"] = text;

    // editing old messages
    if (!chat[this_edit_mes_id]["extra"]) {
        chat[this_edit_mes_id]["extra"] = {};
    }

    chat[this_edit_mes_id]["extra"]["bias"] = bias ?? null;

    div.parent().parent().children(".mes_text").empty();
    div.css("display", "none");
    div.parent().children(".mes_edit_cancel").css("display", "none");
    div.parent().children(".mes_edit").css("display", "inline-block");
    div
        .parent()
        .parent()
        .children(".mes_text")
        .append(messageFormating(text, this_edit_mes_chname));
    div.parent().parent().children(".mes_bias").empty();
    div.parent().parent().children(".mes_bias").append(messageFormating(bias));
    appendImageToMessage(chat[this_edit_mes_id], div.closest(".mes"));
    this_edit_mes_id = undefined;
    if (selected_group) {
        saveGroupChat(selected_group);
    } else {
        saveChat();
    }
}

async function getAllCharaChats() {
    //console.log('getAllCharaChats() pinging server for character chat history.');
    $("#select_chat_div").html("");
    //console.log(characters[this_chid].chat);
    jQuery.ajax({
        type: "POST",
        url: "/getallchatsofcharacter",
        data: JSON.stringify({ avatar_url: characters[this_chid].avatar }),
        beforeSend: function () {
            //$('#create_button').attr('value','Creating...');
        },
        cache: false,
        dataType: "json",
        contentType: "application/json",
        success: function (data) {
            $("#load_select_chat_div").css("display", "none");
            let dataArr = Object.values(data);
            data = dataArr.sort((a, b) =>
                a["file_name"].localeCompare(b["file_name"])
            );
            data = data.reverse();

            for (const key in data) {
                let strlen = 300;
                let mes = data[key]["mes"];
                if (mes !== undefined) {
                    if (mes.length > strlen) {
                        mes = "..." + mes.substring(mes.length - strlen);
                    }
                    $("#select_chat_div").append(
                        '<div class="select_chat_block" file_name="' +
                        data[key]["file_name"] +
                        '"><div class=avatar><img src="characters/' +
                        characters[this_chid]["avatar"] +
                        '""></div><div class="select_chat_block_filename">' +
                        data[key]["file_name"] +
                        '</div><div class="select_chat_block_mes">' +
                        mes +
                        "</div></div>"
                    );
                    if (
                        characters[this_chid]["chat"] ==
                        data[key]["file_name"].replace(".jsonl", "")
                    ) {
                        //children().last()
                        $("#select_chat_div")
                            .children(":nth-last-child(1)")
                            .attr("highlight", true);
                    }
                }
            }
            //<div id="select_chat_div">

            //<div id="load_select_chat_div">
            //console.log(data);
            //chat.length = 0;

            //chat =  data;
            //getChatResult();
            //saveChat();
            //console.log('getAllCharaChats() -- Finished successfully');
        },
        error: function (jqXHR, exception) {
            //getChatResult();
            //console.log('getAllCharaChats() -- Failed');
            console.log(exception);
            console.log(jqXHR);
        },
    });
}

//************************************************************
//************************Novel.AI****************************
//************************************************************
async function getStatusNovel() {
    if (is_get_status_novel) {
        var data = { key: api_key_novel };

        jQuery.ajax({
            type: "POST", //
            url: "/getstatus_novelai", //
            data: JSON.stringify(data),
            beforeSend: function () {
                //$('#create_button').attr('value','Creating...');
            },
            cache: false,
            dataType: "json",
            contentType: "application/json",
            success: function (data) {
                if (data.error != true) {
                    //var settings2 = JSON.parse(data);
                    //const getData = await response.json();
                    novel_tier = data.tier;
                    if (novel_tier == undefined) {
                        online_status = "no_connection";
                    }
                    if (novel_tier === 0) {
                        online_status = "Paper";
                    }
                    if (novel_tier === 1) {
                        online_status = "Tablet";
                    }
                    if (novel_tier === 2) {
                        online_status = "Scroll";
                    }
                    if (novel_tier === 3) {
                        online_status = "Opus";
                    }
                }
                resultCheckStatusNovel();
            },
            error: function (jqXHR, exception) {
                online_status = "no_connection";
                console.log(exception);
                console.log(jqXHR);
                resultCheckStatusNovel();
            },
        });
    } else {
        if (is_get_status != true) {
            online_status = "no_connection";
        }
    }
}

function compareVersions(v1, v2) {
    const v1parts = v1.split(".");
    const v2parts = v2.split(".");

    for (let i = 0; i < v1parts.length; ++i) {
        if (v2parts.length === i) {
            return 1;
        }

        if (v1parts[i] === v2parts[i]) {
            continue;
        }
        if (v1parts[i] > v2parts[i]) {
            return 1;
        } else {
            return -1;
        }
    }

    if (v1parts.length != v2parts.length) {
        return -1;
    }

    return 0;
}

function select_rm_info(text, charId = null) {
    $("#rm_characters_block").css("display", "none");
    $("#rm_api_block").css("display", "none");
    $("#rm_ch_create_block").css("display", "none");
    $("#rm_group_chats_block").css("display", "none");
    $("#rm_info_block").css("display", "flex");

    $("#rm_info_text").html("<h3>" + text + "</h3>");

    $("#rm_button_characters").css("class", "deselected-right-tab");
    $("#rm_button_settings").css("class", "deselected-right-tab");
    $("#rm_button_selected_ch").css("class", "deselected-right-tab");

    prev_selected_char = charId;
}

function select_selected_character(chid) {
    //character select
    //console.log('select_selected_character() -- starting with input of -- '+chid+' (name:'+characters[chid].name+')');
    select_rm_create();
    menu_type = "character_edit";
    $("#delete_button").css("display", "block");
    $("#export_button").css("display", "block");
    $("#rm_button_selected_ch").css("class", "selected-right-tab");
    var display_name = characters[chid].name;

    $("#rm_button_selected_ch").children("h2").text(display_name);

    //create text poles
    $("#rm_button_back").css("display", "none");
    //$("#character_import_button").css("display", "none");
    $("#create_button").attr("value", "Save");
    $("#create_button").css("display", "none");
    var i = 0;
    while ($("#rm_button_selected_ch").width() > 170 && i < 100) {
        display_name = display_name.slice(0, display_name.length - 2);
        //console.log(display_name);
        $("#rm_button_selected_ch")
            .children("h2")
            .text($.trim(display_name) + "...");
        i++;
    }
    $("#add_avatar_button").val("");

    $("#character_popup_text_h3").text(characters[chid].name);
    $("#character_name_pole").val(characters[chid].name);
    $("#description_textarea").val(characters[chid].description);
    $("#personality_textarea").val(characters[chid].personality);
    $("#firstmessage_textarea").val(characters[chid].first_mes);
    $("#scenario_pole").val(characters[chid].scenario);
    $("#talkativeness_slider").val(
        characters[chid].talkativeness ?? talkativeness_default
    );
    $("#mes_example_textarea").val(characters[chid].mes_example);
    $("#selected_chat_pole").val(characters[chid].chat);
    $("#create_date_pole").val(characters[chid].create_date);
    $("#avatar_url_pole").val(characters[chid].avatar);
    $("#chat_import_avatar_url").val(characters[chid].avatar);
    $("#chat_import_character_name").val(characters[chid].name);
    //$("#avatar_div").css("display", "none");
    var this_avatar = default_avatar;
    if (characters[chid].avatar != "none") {
        this_avatar = "characters/" + characters[chid].avatar;
    }
    $("#avatar_load_preview").attr("src", this_avatar + "?" + Date.now());
    $("#name_div").css("display", "none");

    $("#form_create").attr("actiontype", "editcharacter");
    active_character = chid;
    //console.log('select_selected_character() -- active_character -- '+chid+'(ChID of '+display_name+')');
    saveSettings();
    //console.log('select_selected_character() -- called saveSettings() to save -- active_character -- '+active_character+'(ChID of '+display_name+')');
}

function select_rm_create() {
    menu_type = "create";

    //console.log('select_rm_Create() -- selected button: '+selected_button);
    if (selected_button == "create") {
        if (create_save_avatar != "") {
            $("#add_avatar_button").get(0).files = create_save_avatar;
            read_avatar_load($("#add_avatar_button").get(0));
        }
    }

    $("#rm_characters_block").css("display", "none");
    $("#rm_api_block").css("display", "none");
    $("#rm_ch_create_block").css("display", "block");
    $("#rm_group_chats_block").css("display", "none");

    $("#rm_ch_create_block").css("opacity", 0.0);
    $("#rm_ch_create_block").transition({
        opacity: 1.0,
        duration: animation_rm_duration,
        easing: animation_rm_easing,
        complete: function () { },
    });
    $("#rm_info_block").css("display", "none");

    $("#delete_button_div").css("display", "none");
    $("#delete_button").css("display", "none");
    $("#export_button").css("display", "none");
    $("#create_button").css("display", "block");
    $("#create_button").attr("value", "Create");
    //RossAscends: commented this out as part of the auto-loading token counter
    //$('#result_info').html('&nbsp;');
    $("#rm_button_characters").css("class", "deselected-right-tab");
    $("#rm_button_settings").css("class", "deselected-right-tab");
    $("#rm_button_selected_ch").css("class", "deselected-right-tab");

    //create text poles
    $("#rm_button_back").css("display", "inline-block");
    $("#character_import_button").css("display", "inline-block");
    $("#character_popup_text_h3").text("Create character");
    $("#character_name_pole").val(create_save_name);
    $("#description_textarea").val(create_save_description);
    $("#personality_textarea").val(create_save_personality);
    $("#firstmessage_textarea").val(create_save_first_message);
    $("#talkativeness_slider").val(create_save_talkativeness);
    $("#scenario_pole").val(create_save_scenario);
    if ($.trim(create_save_mes_example).length == 0) {
        $("#mes_example_textarea").val("<START>");
    } else {
        $("#mes_example_textarea").val(create_save_mes_example);
    }
    $("#avatar_div").css("display", "grid");
    $("#avatar_load_preview").attr("src", default_avatar);
    $("#name_div").css("display", "block");

    $("#form_create").attr("actiontype", "createcharacter");
}

function select_rm_characters() {
    /* QuickRefresh(true); */

    if (prev_selected_char) {
        let newChId = characters.findIndex((x) => x.name == prev_selected_char);
        $(`.character_select[chid="${newChId}"]`).trigger("click");
        prev_selected_char = null;
    }

    menu_type = "characters";
    $("#rm_characters_block").css("display", "block");
    $("#rm_characters_block").css("opacity", 0.0);
    $("#rm_characters_block").transition({
        opacity: 1.0,
        duration: animation_rm_duration,
        easing: animation_rm_easing,
        complete: function () { },
    });

    $("#rm_api_block").css("display", "none");
    $("#rm_ch_create_block").css("display", "none");
    $("#rm_info_block").css("display", "none");
    $("#rm_group_chats_block").css("display", "none");

    $("#rm_button_characters").css("class", "selected-right-tab");
    $("#rm_button_settings").css("class", "deselected-right-tab");
    $("#rm_button_selected_ch").css("class", "deselected-right-tab");
}

/// UTILS
function onlyUnique(value, index, array) {
    return array.indexOf(value) === index;
}

function shuffle(array) {
    let currentIndex = array.length,
        randomIndex;

    while (currentIndex != 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex],
            array[currentIndex],
        ];
    }
    return array;
}

function setExtensionPrompt(key, value) {
    extension_prompts[key] = value;
}

async function updateWorldInfoList(importedWorldName) {
    var result = await fetch("/getsettings", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": token,
        },
        body: JSON.stringify({}),
    });

    if (result.ok) {
        var data = await result.json();
        world_names = data.world_names?.length ? data.world_names : [];
        $("#world_info").find('option[value!="None"]').remove();

        world_names.forEach((item, i) => {
            $("#world_info").append(`<option value='${i}'>${item}</option>`);
        });

        if (importedWorldName) {
            const indexOf = world_names.indexOf(world_info);
            $("#world_info").val(indexOf);

            popup_type = "world_imported";
            callPopup("<h3>World imported successfully! Select it now?</h3>");
        }
    }
}

function download(content, fileName, contentType) {
    var a = document.createElement("a");
    var file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
}

// World Info Editor
async function showWorldEditor() {
    if (!world_info) {
        popup_type = "default";
        callPopup("<h3>Select a world info first!</h3>");
        return;
    }

    is_world_edit_open = true;
    $("#world_popup_name").val(world_info);
    $("#world_popup").css("display", "flex");
    await loadWorldInfoData();
    displayWorldEntries(world_info_data);
}

async function loadWorldInfoData() {
    if (!world_info) {
        return;
    }

    const response = await fetch("/getworldinfo", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": token,
        },
        body: JSON.stringify({ name: world_info }),
    });

    if (response.ok) {
        world_info_data = await response.json();
    }
}

function hideWorldEditor() {
    is_world_edit_open = false;
    $("#world_popup").css("display", "none");
}

function displayWorldEntries(data) {
    $("#world_popup_entries_list").empty();

    if (!data || !("entries" in data)) {
        return;
    }

    for (const entryUid in data.entries) {
        const entry = data.entries[entryUid];
        appendWorldEntry(entry);
    }
}

function appendWorldEntry(entry) {
    const template = $("#entry_edit_template .world_entry").clone();
    template.data("uid", entry.uid);

    // key
    const keyInput = template.find('textarea[name="key"]');
    keyInput.data("uid", entry.uid);
    keyInput.on("input", function () {
        const uid = $(this).data("uid");
        const value = $(this).val();
        $(this).css("height", ""); //reset the height
        $(this).css("height", $(this).prop("scrollHeight") + "px");
        world_info_data.entries[uid].key = value
            .split(",")
            .map((x) => x.trim())
            .filter((x) => x);
        saveWorldInfo();
    });
    keyInput.val(entry.key.join(",")).trigger("input");
    keyInput.css("height", ""); //reset the height
    keyInput.css("height", $(this).prop("scrollHeight") + "px");

    // keysecondary
    const keySecondaryInput = template.find('textarea[name="keysecondary"]');
    keySecondaryInput.data("uid", entry.uid);
    keySecondaryInput.on("input", function () {
        const uid = $(this).data("uid");
        const value = $(this).val();
        $(this).css("height", ""); //reset the height
        $(this).css("height", $(this).prop("scrollHeight") + "px");
        world_info_data.entries[uid].keysecondary = value
            .split(",")
            .map((x) => x.trim())
            .filter((x) => x);
        saveWorldInfo();
    });
    keySecondaryInput.val(entry.keysecondary.join(",")).trigger("input");
    keySecondaryInput.css("height", ""); //reset the height
    keySecondaryInput.css("height", $(this).prop("scrollHeight") + "px");

    // comment
    const commentInput = template.find('textarea[name="comment"]');
    commentInput.data("uid", entry.uid);
    commentInput.on("input", function () {
        const uid = $(this).data("uid");
        const value = $(this).val();
        $(this).css("height", ""); //reset the height
        $(this).css("height", $(this).prop("scrollHeight") + "px");
        world_info_data.entries[uid].comment = value;
        saveWorldInfo();
    });
    commentInput.val(entry.comment).trigger("input");
    commentInput.css("height", ""); //reset the height
    commentInput.css("height", $(this).prop("scrollHeight") + "px");

    // content
    const contentInput = template.find('textarea[name="content"]');
    contentInput.data("uid", entry.uid);
    contentInput.on("input", function () {
        const uid = $(this).data("uid");
        const value = $(this).val();
        world_info_data.entries[uid].content = value;
        $(this).css("height", ""); //reset the height
        $(this).css("height", $(this).prop("scrollHeight") + "px");
        saveWorldInfo();

        // count tokens
        const numberOfTokens = encode(value).length;
        $(this)
            .closest(".world_entry")
            .find(".world_entry_form_token_counter")
            .html(numberOfTokens);
    });
    contentInput.val(entry.content).trigger("input");
    contentInput.css("height", ""); //reset the height
    contentInput.css("height", $(this).prop("scrollHeight") + "px");

    // selective
    const selectiveInput = template.find('input[name="selective"]');
    selectiveInput.data("uid", entry.uid);
    selectiveInput.on("input", function () {
        const uid = $(this).data("uid");
        const value = $(this).prop("checked");
        world_info_data.entries[uid].selective = value;
        saveWorldInfo();

        const keysecondary = $(this)
            .closest(".world_entry")
            .find(".keysecondary");
        value ? keysecondary.show() : keysecondary.hide();
    });
    selectiveInput.prop("checked", entry.selective).trigger("input");
    selectiveInput.siblings(".checkbox_fancy").click(function () {
        $(this).siblings("input").click();
    });

    // constant
    const constantInput = template.find('input[name="constant"]');
    constantInput.data("uid", entry.uid);
    constantInput.on("input", function () {
        const uid = $(this).data("uid");
        const value = $(this).prop("checked");
        world_info_data.entries[uid].constant = value;
        saveWorldInfo();
    });
    constantInput.prop("checked", entry.constant).trigger("input");
    constantInput.siblings(".checkbox_fancy").click(function () {
        $(this).siblings("input").click();
    });

    // order
    const orderInput = template.find('input[name="order"]');
    orderInput.data("uid", entry.uid);
    orderInput.on("input", function () {
        const uid = $(this).data("uid");
        const value = Number($(this).val());

        world_info_data.entries[uid].order = !isNaN(value) ? value : 0;
        saveWorldInfo();
    });
    orderInput.val(entry.order).trigger("input");

    // position
    if (entry.position === undefined) {
        entry.position = 0;
    }

    const positionInput = template.find('input[name="position"]');
    positionInput.data("uid", entry.uid);
    positionInput.on("input", function () {
        const uid = $(this).data("uid");
        const value = Number($(this).val());
        world_info_data.entries[uid].position = !isNaN(value) ? value : 0;
        saveWorldInfo();
    });
    template
        .find(`input[name="position"][value=${entry.position}]`)
        .prop("checked", true)
        .trigger("input");

    // display uid
    template.find(".world_entry_form_uid_value").html(entry.uid);

    // delete button
    const deleteButton = template.find("input.delete_entry_button");
    deleteButton.data("uid", entry.uid);
    deleteButton.on("click", function () {
        const uid = $(this).data("uid");
        deleteWorldInfoEntry(uid);
        $(this).closest(".world_entry").remove();
        saveWorldInfo();
    });

    template.appendTo("#world_popup_entries_list");
    return template;
}

async function deleteWorldInfoEntry(uid) {
    if (!world_info_data || !("entries" in world_info_data)) {
        return;
    }

    delete world_info_data.entries[uid];
}

function createWorldInfoEntry() {
    const newEntryTemplate = {
        key: [],
        keysecondary: [],
        comment: "",
        content: "",
        constant: false,
        selective: false,
        order: 100,
        position: 0,
    };
    const newUid = getFreeWorldEntryUid();

    if (!Number.isInteger(newUid)) {
        console.error("Couldn't assign UID to a new entry");
        return;
    }

    const newEntry = { uid: newUid, ...newEntryTemplate };
    world_info_data.entries[newUid] = newEntry;

    const entryTemplate = appendWorldEntry(newEntry);
    entryTemplate.get(0).scrollIntoView({ behavior: "smooth" });
}

async function saveWorldInfo(immediately) {
    if (!world_info || !world_info_data) {
        return;
    }

    async function _save() {
        const response = await fetch("/editworldinfo", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": token,
            },
            body: JSON.stringify({ name: world_info, data: world_info_data }),
        });
    }

    if (immediately) {
        return await _save();
    }

    clearTimeout(timerWorldSave);
    timerWorldSave = setTimeout(async () => await _save(), durationSaveEdit);
}

async function renameWorldInfo() {
    const oldName = world_info;
    const newName = $("#world_popup_name").val();

    if (oldName === newName) {
        return;
    }

    world_info = newName;
    await saveWorldInfo(true);
    await deleteWorldInfo(oldName, newName);
}

async function deleteWorldInfo(worldInfoName, selectWorldName) {
    if (!world_names.includes(worldInfoName)) {
        return;
    }

    const response = await fetch("/deleteworldinfo", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": token,
        },
        body: JSON.stringify({ name: worldInfoName }),
    });

    if (response.ok) {
        await updateWorldInfoList();

        const selectedIndex = world_names.indexOf(selectWorldName);
        if (selectedIndex !== -1) {
            $("#world_info").val(selectedIndex).change();
        } else {
            $("#world_info").val("None").change();
        }

        hideWorldEditor();
    }
}

function getFreeWorldEntryUid() {
    if (!world_info_data || !("entries" in world_info_data)) {
        return null;
    }

    const MAX_UID = 1_000_000; // <- should be safe enough :)
    for (let uid = 0; uid < MAX_UID; uid++) {
        if (uid in world_info_data.entries) {
            continue;
        }
        return uid;
    }

    return null;
}

function getFreeWorldName() {
    const MAX_FREE_NAME = 100_000;
    for (let index = 1; index < MAX_FREE_NAME; index++) {
        const newName = `New World (${index})`;
        if (world_names.includes(newName)) {
            continue;
        }
        return newName;
    }

    return undefined;
}

async function createNewWorldInfo() {
    const worldInfoTemplate = { entries: {} };
    const worldInfoName = getFreeWorldName();

    if (!worldInfoName) {
        return;
    }

    world_info = worldInfoName;
    world_info_data = { ...worldInfoTemplate };
    await saveWorldInfo(true);
    await updateWorldInfoList();

    const selectedIndex = world_names.indexOf(worldInfoName);
    if (selectedIndex !== -1) {
        $("#world_info").val(selectedIndex).change();
    } else {
        $("#world_info").val("None").change();
    }
}

window["TavernAI"].getContext = function () {
    return {
        chat: chat,
        characters: characters,
        groups: groups,
        worldInfo: world_info_data,
        name1: name1,
        name2: name2,
        characterId: this_chid,
        groupId: selected_group,
        chatId: this_chid && characters[this_chid] && characters[this_chid].chat,
        onlineStatus: online_status,
        addOneMessage: addOneMessage,
        generate: Generate,
        encode: encode,
        extensionPrompts: extension_prompts,
        setExtensionPrompt: setExtensionPrompt,
        saveChat: saveChat,
        sendSystemMessage: sendSystemMessage,
    };
};

$(document).ready(function () {

    $("#character_search_bar").on("input", function () {
        const searchValue = $(this).val().trim().toLowerCase();

        if (!searchValue) {
            $("#rm_print_characters_block .character_select").show();
        } else {
            $("#rm_print_characters_block .character_select").each(function () {
                $(this).children(".ch_name").text().toLowerCase().includes(searchValue)
                    ? $(this).show()
                    : $(this).hide();
            });
        }
    });

    $("#characloud_url").click(function () {
        window.open("https://boosty.to/tavernai", "_blank");
    });
    $("#send_but").click(function () {
        //$( "#send_but" ).css({"background": "url('img/load.gif')","background-size": "100%, 100%", "background-position": "center center"});
        if (is_send_press == false) {
            is_send_press = true;

            Generate();
        }
    });

    //hotkey to send input with enter (shift+enter generates a new line in the chat input box)
    //this is not ideal for touch device users with virtual keyboards.
    //ideally we would detect if the user is using a virtual keyboard, and disable this shortcut for them.
    //because mobile users' hands are always near the screen, tapping the send button is better for them, and enter should always make a new line.
    //note: CAI seems to have this handled. PC: shift+enter = new line, enter = send. iOS: shift+enter AND enter both make new lines, and only the send button sends.
    //maybe a way to simulate this would be to disable the eventListener for people iOS.

    $("#send_textarea").keydown(function (e) {
        if (
            !e.shiftKey &&
            !e.ctrlKey &&
            e.key == "Enter" &&
            is_send_press == false
        ) {
            is_send_press = true;
            e.preventDefault();
            Generate();
        }
    });

    /*     //RossAscends: Additional hotkeys
      document.addEventListener('keydown', (event) => {
  
          if (event.ctrlKey && event.key == "Enter") {				// Ctrl+Enter for Regeneration Last Response
  
              if (is_send_press == false) {
                  is_send_press = true;
                  Generate('regenerate');
              }
          } else if (event.ctrlKey && event.key == "ArrowUp") {		//Ctrl+UpArrow for Connect to last server
  
              document.getElementById('api_button').click();
  
          }
      }); */

    //menu buttons setup
    var selected_button_style = {};
    var deselected_button_style = {};

    $("#rm_button_create").css("class", "deselected-right-tab");
    $("#rm_button_characters").css("class", "deselected-right-tab");

    $("#rm_button_settings").click(function () {
        selected_button = "settings";
        menu_type = "settings";
        $("#rm_characters_block").css("display", "none");
        $("#rm_api_block").css("display", "grid");
        $("#rm_api_block").css("opacity", 0.0);
        $("#rm_api_block").transition({
            opacity: 1.0,
            duration: animation_rm_duration,
            easing: animation_rm_easing,
            complete: function () { },
        });

        $("#rm_ch_create_block").css("display", "none");
        $("#rm_info_block").css("display", "none");
        $("#rm_group_chats_block").css("display", "none");
        $("#rm_button_characters").css("class", "deselected-right-tab");
        $("#rm_button_settings").css("class", "selected-right-tab");
        $("#rm_button_selected_ch").css("class", "deselected-right-tab");
    });
    $("#rm_button_characters").click(function () {
        selected_button = "characters";
        select_rm_characters();
    });
    $("#rm_button_back").click(function () {
        selected_button = "characters";
        select_rm_characters();
    });
    $("#rm_button_create").click(function () {
        selected_button = "create";
        select_rm_create();
    });
    $("#rm_button_selected_ch").click(function () {
        selected_button = "character_edit";
        select_selected_character(this_chid);
    });
    $(document).on("click", ".group_select", async function () {
        const id = $(this).data("id");
        selected_button = "group_chats";

        if (!is_send_press && !is_group_generating) {
            if (selected_group !== id) {
                selected_group = id;
                this_chid = undefined;
                this_edit_mes_id = undefined;
                clearChat();
                chat.length = 0;
                await getGroupChat(id);
            }

            select_group_chats(id);
        }
    });
    $("#rm_button_group_chats").click(function () {
        selected_button = "group_chats";
        select_group_chats();
    });
    $("#rm_button_back_from_group").click(function () {
        selected_button = "characters";
        select_rm_characters();
    });
    $("#rm_group_filter").on("input", function () {
        const searchValue = $(this).val().trim().toLowerCase();

        if (!searchValue) {
            $("#rm_group_add_members .group_member").show();
        } else {
            $("#rm_group_add_members .group_member").each(function () {
                $(this).children(".ch_name").text().toLowerCase().includes(searchValue)
                    ? $(this).show()
                    : $(this).hide();
            });
        }
    });
    $("#rm_group_submit").click(async function () {
        let name = $("#rm_group_chat_name").val();
        const members = $("#rm_group_members .group_member")
            .map((_, x) => $(x).data("id"))
            .toArray();

        if (!name) {
            name = `Chat with ${members.join(", ")}`;
        }

        // placeholder
        const avatar_url = "/img/five.png";

        const createGroupResponse = await fetch("/creategroup", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": token,
            },
            body: JSON.stringify({
                name: name,
                members: members,
                avatar_url: avatar_url,
            }),
        });

        if (createGroupResponse.ok) {
            const createGroupData = await createGroupResponse.json();
            const id = createGroupData.id;

            await getCharacters();
            $("#rm_info_avatar").html("");
            var avatar = $("#avatar_div_div").clone();
            avatar.find("img").attr("src", avatar_url);
            $("#rm_info_avatar").append(avatar);
            $("#rm_info_block").transition({ opacity: 0, duration: 0 });
            select_rm_info("Group chat created");
            $("#rm_info_block").transition({ opacity: 1.0, duration: 2000 });
        }
    });

    $("#rm_group_automode").on("input", function () {
        const value = $(this).prop("checked");
        is_group_automode_enabled = value;
    });

    $(document).on("click", ".character_select", function () {
        if (this_chid !== $(this).attr("chid")) {
            //if clicked on a different character from what was currently selected
            if (!is_send_press) {
                selected_group = null;
                is_group_generating = false;
                this_edit_mes_id = undefined;
                selected_button = "character_edit";
                this_chid = $(this).attr("chid");
                active_character = this_chid;
                clearChat();
                chat.length = 0;
                getChat();

                //console.log('Clicked on '+characters[this_chid].name+' Active_Character set to: '+active_character+' (ChID:'+this_chid+')');
            }
        } else {
            //if clicked on character that was already selected
            selected_button = "character_edit";
            select_selected_character(this_chid);
        }
        $("#character_search_bar").val("").trigger("input");
    });
    var scroll_holder = 0;
    var is_use_scroll_holder = false;
    $(document).on("input", ".edit_textarea", function () {
        scroll_holder = $("#chat").scrollTop();
        $(this).height(0).height(this.scrollHeight);
        is_use_scroll_holder = true;
    });
    $("#chat").on("scroll", function () {
        if (is_use_scroll_holder) {
            $("#chat").scrollTop(scroll_holder);
            is_use_scroll_holder = false;
        }
    });
    $(document).on("click", ".del_checkbox", function () {
        //when a 'delete message' checkbox is clicked
        $(".del_checkbox").each(function () {
            $(this).prop("checked", false);
            $(this).parent().css("background", css_mes_bg);
        });
        $(this).parent().css("background", "#600"); //sets the bg of the mes selected for deletion
        var i = $(this).parent().attr("mesid"); //checks the message ID in the chat
        this_del_mes = i;
        while (i < chat.length) {
            //as long as the current message ID is less than the total chat length
            $(".mes[mesid='" + i + "']").css("background", "#600"); //sets the bg of the all msgs BELOW the selected .mes
            $(".mes[mesid='" + i + "']")
                .children(".del_checkbox")
                .prop("checked", true);
            i++;
            //console.log(i);
        }
    });
    $(document).on("click", "#user_avatar_block .avatar", function () {
        user_avatar = $(this).attr("imgfile");
        $(".mes").each(function () {
            if ($(this).attr("ch_name") == name1) {
                $(this)
                    .children(".avatar")
                    .children("img")
                    .attr("src", "User Avatars/" + user_avatar);
            }
        });
        saveSettings();
        highlightSelectedAvatar();
    });
    $(document).on("click", "#user_avatar_block .avatar_upload", function () {
        $("#avatar_upload_file").click();
    });
    $("#avatar_upload_file").on("change", function (e) {
        const file = e.target.files[0];

        if (!file) {
            return;
        }

        const formData = new FormData($("#form_upload_avatar").get(0));

        jQuery.ajax({
            type: "POST",
            url: "/uploaduseravatar",
            data: formData,
            beforeSend: () => { },
            cache: false,
            contentType: false,
            processData: false,
            success: function (data) {
                if (data.path) {
                    appendUserAvatar(data.path);
                }
            },
            error: (jqXHR, exception) => { },
        });

        // Will allow to select the same file twice in a row
        $("#form_upload_avatar").trigger("reset");
    });
    $("#logo_block").click(function (event) {
        if (!bg_menu_toggle) {
            $("#bg_menu_button").transition({
                perspective: "100px",
                rotate3d: "1,1,0,180deg",
            });
            $("#bg_menu_content").transition({
                opacity: 1.0,
                height: "90vh",
                duration: 340,
                easing: "in",
                complete: function () {
                    bg_menu_toggle = true;
                    $("#bg_menu_content").css("overflow-y", "auto");
                },
            });
        } else {
            $("#bg_menu_button").transition({
                perspective: "100px",
                rotate3d: "1,1,0,360deg",
            });
            $("#bg_menu_content").css("overflow-y", "hidden");
            $("#bg_menu_content").transition({
                opacity: 0.0,
                height: "0px",
                duration: 340,
                easing: "in",
                complete: function () {
                    bg_menu_toggle = false;
                },
            });
        }
    });
    $(document).on("click", ".bg_example_img", function () {
        //when user clicks on a BG thumbnail...
        var this_bgfile = $(this).attr("bgfile"); // this_bgfile = whatever they clicked

        if (bg1_toggle == true) {
            //if bg1 is toggled true (initially set as true in first JS vars)
            bg1_toggle = false; // then toggle it false
            var number_bg = 2; // sets a variable for bg2
            var target_opacity = 1.0; // target opacity is 100%
        } else {
            //if bg1 is FALSE
            bg1_toggle = true; // make it true
            var number_bg = 1; // set variable to bg1..
            var target_opacity = 0.0; // set target opacity to 0
        }
        $("#bg2").stop(); // first, stop whatever BG transition was happening before
        $("#bg2").transition({
            // start a new BG transition routine
            opacity: target_opacity, // set opacity to previously set variable
            duration: 1300, //animation_rm_duration,
            easing: "linear",
            complete: function () {
                // why does the BG transition completion make the #options (right nav) invisible?
                $("#options").css("display", "none");
            },
        });
        $("#bg" + number_bg).css(
            "background-image",
            'url("backgrounds/' + this_bgfile + '")'
        );
        setBackground(this_bgfile);
    });
    $(document).on("click", ".bg_example_cross", function () {
        bg_file_for_del = $(this);
        //$(this).parent().remove();
        //delBackground(this_bgfile);
        popup_type = "del_bg";
        callPopup("<h3>Delete the background?</h3>");
    });
    $("#advanced_div").click(function () {
        if (!is_advanced_char_open) {
            is_advanced_char_open = true;
            $("#character_popup").css("display", "grid");
            $("#character_popup").css("opacity", 0.0);
            $("#character_popup").transition({
                opacity: 1.0,
                duration: animation_rm_duration,
                easing: animation_rm_easing,
            });
        } else {
            is_advanced_char_open = false;
            $("#character_popup").css("display", "none");
        }
    });
    $("#character_cross").click(function () {
        is_advanced_char_open = false;
        $("#character_popup").css("display", "none");
    });
    $("#character_popup_ok").click(function () {
        is_advanced_char_open = false;
        $("#character_popup").css("display", "none");
    });
    $("#dialogue_popup_ok").click(function () {
        $("#shadow_popup").css("display", "none");
        $("#shadow_popup").css("opacity:", 0.0);
        if (popup_type == "del_bg") {
            delBackground(bg_file_for_del.attr("bgfile"));
            bg_file_for_del.parent().remove();
        }
        if (popup_type == "del_ch") {
            console.log(
                "Deleting character -- ChID: " +
                this_chid +
                " -- Name: " +
                characters[this_chid].name
            );
            var msg = jQuery("#form_create").serialize(); // ID form
            jQuery.ajax({
                method: "POST",
                url: "/deletecharacter",
                beforeSend: function () {
                    select_rm_info("Character deleted");
                    //$('#create_button').attr('value','Deleting...');
                },
                data: msg,
                cache: false,
                success: function (html) {
                    //RossAscends: New handling of character deletion that avoids page refreshes and should have fixed char corruption due to cache problems.
                    //due to how it is handled with 'popup_type', i couldn't find a way to make my method completely modular, so keeping it in TAI-main.js as a new default.
                    //this allows for dynamic refresh of character list after deleting a character.
                    $("#character_cross").click(); // closes advanced editing popup
                    this_chid = "invalid-safety-id"; // unsets expected chid before reloading (related to getCharacters/printCharacters from using old arrays)
                    //avatar = "..img/*****.jpg";
                    characters.length = 0; // resets the characters array, forcing getcharacters to reset
                    name2 = systemUserName; // replaces deleted charcter name with *****, since she will be displayed next.
                    chat = [...safetychat]; // sets up ***** to tell user about having deleted a character
                    $(document.getElementById("rm_button_selected_ch")).css(
                        "class",
                        "deselected-right-tab"
                    ); // 'deselects' character's tab panel
                    $(document.getElementById("rm_button_selected_ch"))
                        .children("h2")
                        .text(""); // removes character name from nav tabs
                    clearChat(); // removes deleted char's chat
                    this_chid = undefined; // prevents getCharacters from trying to load an invalid char.
                    getCharacters(); // gets the new list of characters (that doesn't include the deleted one)
                    printMessages(); // prints out *****'s 'deleted character' message
                    //console.log("#dialogue_popup_ok(del-char) >>>> saving");
                    saveSettings(); // saving settings to keep changes to variables
                    //getCharacters();
                    //$('#create_button_div').html(html);
                },
            });
        }
        if (popup_type === "world_imported" && imported_world_name) {
            world_names.forEach((item, i) => {
                if (item === imported_world_name) {
                    $("#world_info").val(i).change();
                }
            });
            imported_world_name = "";
        }
        if (popup_type === "del_world" && world_info) {
            deleteWorldInfo(world_info);
        }
        if (popup_type === "del_group") {
            const groupId = $("#dialogue_popup").data("group_id");

            if (groupId) {
                deleteGroup(groupId);
            }
        }
        //Make a new chat for selected character
        if (
            popup_type == "new_chat" &&
            this_chid != undefined &&
            menu_type != "create"
        ) {
            //Fix it; New chat doesn't create while open create character menu
            clearChat();
            chat.length = 0;
            characters[this_chid].chat = name2 + " - " + humanizedDateTime(); //RossAscends: added character name to new chat filenames and replaced Date.now() with humanizedDateTime;
            $("#selected_chat_pole").val(characters[this_chid].chat);
            timerSaveEdit = setTimeout(() => {
                $("#create_button").click();
            }, durationSaveEdit);
            getChat();
        }
    });
    $("#dialogue_popup_cancel").click(function () {
        $("#shadow_popup").css("display", "none");
        $("#shadow_popup").css("opacity:", 0.0);
        popup_type = "";
    });
    function callPopup(text) {
        $("#dialogue_popup_cancel").css("display", "inline-block");
        switch (popup_type) {
            case "text":
            case "char_not_selected":
                $("#dialogue_popup_ok").text("Ok");
                $("#dialogue_popup_cancel").css("display", "none");
                break;

            case "world_imported":
            case "new_chat":
                $("#dialogue_popup_ok").text("Yes");
                break;
            case "del_world":
            case "del_group":
            default:
                $("#dialogue_popup_ok").text("Delete");
        }
        $("#dialogue_popup_text").html(text);
        $("#shadow_popup").css("display", "block");
        $("#shadow_popup").transition({
            opacity: 1.0,
            duration: animation_rm_duration,
            easing: animation_rm_easing,
        });
    }
    function read_bg_load(input) {
        if (input.files && input.files[0]) {
            var reader = new FileReader();

            reader.onload = function (e) {
                $("#bg_load_preview")
                    .attr("src", e.target.result)
                    .width(103)
                    .height(83);

                var formData = new FormData($("#form_bg_download").get(0));

                //console.log(formData);
                jQuery.ajax({
                    type: "POST",
                    url: "/downloadbackground",
                    data: formData,
                    beforeSend: function () {
                        //$('#create_button').attr('value','Creating...');
                    },
                    cache: false,
                    contentType: false,
                    processData: false,
                    success: function (html) {
                        setBackground(html);
                        if (bg1_toggle == true) {
                            // this is a repeat of the background setting function for when  user uploads a new BG image
                            bg1_toggle = false; // should make the Bg setting a modular function to be called in both cases
                            var number_bg = 2;
                            var target_opacity = 1.0;
                        } else {
                            bg1_toggle = true;
                            var number_bg = 1;
                            var target_opacity = 0.0;
                        }
                        $("#bg2").transition({
                            opacity: target_opacity,
                            duration: 1300, //animation_rm_duration,
                            easing: "linear",
                            complete: function () {
                                $("#options").css("display", "none");
                            },
                        });
                        $("#bg" + number_bg).css(
                            "background-image",
                            "url(" + e.target.result + ")"
                        );
                        $("#form_bg_download").after(
                            "<div class=bg_example><img bgfile='" +
                            html +
                            "' class=bg_example_img src='backgrounds/" +
                            html +
                            "'><img bgfile='" +
                            html +
                            "' class=bg_example_cross src=img/cross.png></div>"
                        );
                    },
                    error: function (jqXHR, exception) {
                        console.log(exception);
                        console.log(jqXHR);
                    },
                });
            };

            reader.readAsDataURL(input.files[0]);
        }
    }
    $("#add_bg_button").change(function () {
        read_bg_load(this);
    });
    function read_avatar_load(input) {
        if (input.files && input.files[0]) {
            var reader = new FileReader();
            if (selected_button == "create") {
                create_save_avatar = input.files;
            }
            reader.onload = function (e) {
                if (selected_button == "character_edit") {
                    timerSaveEdit = setTimeout(() => {
                        $("#create_button").click();
                    }, durationSaveEdit);
                }
                $("#avatar_load_preview").attr("src", e.target.result);
                //.width(103)
                //.height(83);
                //console.log(e.target.result.name);
            };

            reader.readAsDataURL(input.files[0]);
        }
    }
    $("#add_avatar_button").change(function () {
        is_mes_reload_avatar = Date.now();
        read_avatar_load(this);
    });
    $("#form_create").submit(function (e) {
        $("#rm_info_avatar").html("");
        var formData = new FormData($("#form_create").get(0));
        if ($("#form_create").attr("actiontype") == "createcharacter") {
            if ($("#character_name_pole").val().length > 0) {
                //if the character name text area isn't empty (only posible when creating a new character)
                //console.log('/createcharacter entered');
                jQuery.ajax({
                    type: "POST",
                    url: "/createcharacter",
                    data: formData,
                    beforeSend: function () {
                        $("#create_button").attr("disabled", true);
                        $("#create_button").attr("value", "Creating...");
                    },
                    cache: false,
                    contentType: false,
                    processData: false,
                    success: async function (html) {
                        $("#character_cross").click(); //closes the advanced character editing popup
                        $("#character_name_pole").val("");
                        create_save_name = "";
                        $("#description_textarea").val("");
                        create_save_description = "";
                        $("#personality_textarea").val("");
                        create_save_personality = "";
                        $("#firstmessage_textarea").val("");
                        create_save_first_message = "";
                        $("#talkativeness_slider").val(talkativeness_default);
                        create_save_talkativeness = talkativeness_default;

                        $("#character_popup_text_h3").text("Create character");

                        $("#scenario_pole").val("");
                        create_save_scenario = "";
                        $("#mes_example_textarea").val("");
                        create_save_mes_example = "";

                        create_save_avatar = "";

                        $("#create_button").removeAttr("disabled");
                        $("#add_avatar_button").replaceWith(
                            $("#add_avatar_button").val("").clone(true)
                        );

                        $("#create_button").attr("value", "Create");
                        if (true) {
                            let oldSelectedChar = null;
                            if (this_chid != undefined && this_chid != "invalid-safety-id") {
                                oldSelectedChar = characters[this_chid].name;
                            }

                            await getCharacters();

                            $("#rm_info_block").transition({ opacity: 0, duration: 0 });
                            var $prev_img = $("#avatar_div_div").clone();
                            $("#rm_info_avatar").append($prev_img);
                            select_rm_info("Character created", oldSelectedChar);

                            $("#rm_info_block").transition({ opacity: 1.0, duration: 2000 });
                        } else {
                            $("#result_info").html(html);
                        }
                    },
                    error: function (jqXHR, exception) {
                        //alert('ERROR: '+xhr.status+ ' Status Text: '+xhr.statusText+' '+xhr.responseText);
                        $("#create_button").removeAttr("disabled");
                    },
                });
            } else {
                $("#result_info").html("Name not entered");
            }
        } else {
            //console.log('/editcharacter -- entered.');
            //console.log('Avatar Button Value:'+$("#add_avatar_button").val());
            jQuery.ajax({
                type: "POST",
                url: "/editcharacter",
                data: formData,
                beforeSend: function () {
                    $("#create_button").attr("disabled", true);
                    $("#create_button").attr("value", "Save");
                },
                cache: false,
                contentType: false,
                processData: false,
                success: function (html) {
                    $(".mes").each(function () {
                        if ($(this).attr("ch_name") != name1) {
                            $(this)
                                .children(".avatar")
                                .children("img")
                                .attr("src", $("#avatar_load_preview").attr("src"));
                        }
                    });
                    if (chat.length === 1) {
                        var this_ch_mes = default_ch_mes;
                        if ($("#firstmessage_textarea").val() != "") {
                            this_ch_mes = $("#firstmessage_textarea").val();
                        }
                        if (
                            this_ch_mes !=
                            $.trim(
                                $("#chat")
                                    .children(".mes")
                                    .children(".mes_block")
                                    .children(".mes_text")
                                    .text()
                            )
                        ) {
                            clearChat();
                            chat.length = 0;
                            chat[0] = {};
                            chat[0]["name"] = name2;
                            chat[0]["is_user"] = false;
                            chat[0]["is_name"] = true;
                            chat[0]["mes"] = this_ch_mes;
                            add_mes_without_animation = true;
                            addOneMessage(chat[0]);
                        }
                    }
                    $("#create_button").removeAttr("disabled");
                    getCharacters();

                    $("#add_avatar_button").replaceWith(
                        $("#add_avatar_button").val("").clone(true)
                    );
                    $("#create_button").attr("value", "Save");
                    //console.log('/editcharacters -- this_chid -- '+this_chid);
                    /*                     if (this_chid != undefined && this_chid != 'invalid-safety-id') {   //added check to avoid trying to load tokens in case of character deletion
                                  CountCharTokens();
                              } */
                },
                error: function (jqXHR, exception) {
                    $("#create_button").removeAttr("disabled");
                    $("#result_info").html("<font color=red>Error: no connection</font>");
                },
            });
        }
    });
    $("#delete_button").click(function () {
        popup_type = "del_ch";
        callPopup(
            "<h3>Delete the character?</h3>Your chat will be closed."
        );
    });
    $("#rm_info_button").click(function () {
        $("#rm_info_avatar").html("");
        select_rm_characters();
    });
    //@@@@@@@@@@@@@@@@@@@@@@@@
    //character text poles creating and editing save
    $("#character_name_pole").on("change keyup paste", function () {
        if (menu_type == "create") {
            create_save_name = $("#character_name_pole").val();
        }
    });
    $("#description_textarea").on("keyup paste cut", function () {
        //change keyup paste cut

        if (menu_type == "create") {
            create_save_description = $("#description_textarea").val();
            CountCharTokens();
        } else {
            timerSaveEdit = setTimeout(() => {
                $("#create_button").click();
            }, durationSaveEdit);
        }
    });
    $("#personality_textarea").on("keyup paste cut", function () {
        if (menu_type == "create") {
            create_save_personality = $("#personality_textarea").val();
            CountCharTokens();
        } else {
            timerSaveEdit = setTimeout(() => {
                $("#create_button").click();
            }, durationSaveEdit);
        }
    });
    $("#scenario_pole").on("keyup paste cut", function () {
        if (menu_type == "create") {
            create_save_scenario = $("#scenario_pole").val();
            CountCharTokens();
        } else {
            timerSaveEdit = setTimeout(() => {
                $("#create_button").click();
            }, durationSaveEdit);
        }
    });
    $("#mes_example_textarea").on("keyup paste cut", function () {
        if (menu_type == "create") {
            create_save_mes_example = $("#mes_example_textarea").val();
            CountCharTokens();
        } else {
            timerSaveEdit = setTimeout(() => {
                $("#create_button").click();
            }, durationSaveEdit);
        }
    });
    $("#firstmessage_textarea").on("keyup paste cut", function () {
        if (menu_type == "create") {
            create_save_first_message = $("#firstmessage_textarea").val();
            CountCharTokens();
        } else {
            timerSaveEdit = setTimeout(() => {
                $("#create_button").click();
            }, durationSaveEdit);
        }
    });
    $("#talkativeness_slider").on("input", function () {
        if (menu_type == "create") {
            create_save_talkativeness = $("#talkativeness_slider").val();
        } else {
            timerSaveEdit = setTimeout(() => {
                $("#create_button").click();
            }, durationSaveEdit);
        }
    });
    $("#api_button").click(function () {
        if ($("#api_url_text").val() != "") {
            $("#api_loading").css("display", "inline-block");
            $("#api_button").css("display", "none");
            api_server = $("#api_url_text").val();
            api_server = $.trim(api_server);
            //console.log("1: "+api_server);
            if (api_server.substr(api_server.length - 1, 1) == "/") {
                api_server = api_server.substr(0, api_server.length - 1);
            }
            if (
                !(
                    api_server.substr(api_server.length - 3, 3) == "api" ||
                    api_server.substr(api_server.length - 4, 4) == "api/"
                )
            ) {
                api_server = api_server + "/api";
            }
            //console.log("2: "+api_server);
            main_api = "kobold";
            saveSettings();
            is_get_status = true;
            is_api_button_press = true;
            getStatus();
            clearSoftPromptsList();
            getSoftPromptsList();
        }
    });

    $("#api_button_textgenerationwebui").click(function () {
        if ($("#textgenerationwebui_api_url_text").val() != "") {
            $("#api_loading_textgenerationwebui").css("display", "inline-block");
            $("#api_button_textgenerationwebui").css("display", "none");
            api_server_textgenerationwebui = $(
                "#textgenerationwebui_api_url_text"
            ).val();
            api_server_textgenerationwebui = $.trim(api_server_textgenerationwebui);
            if (
                api_server_textgenerationwebui.substr(
                    api_server_textgenerationwebui.length - 1,
                    1
                ) == "/"
            ) {
                api_server_textgenerationwebui = api_server_textgenerationwebui.substr(
                    0,
                    api_server_textgenerationwebui.length - 1
                );
            }
            //console.log("2: "+api_server_textgenerationwebui);
            main_api = "textgenerationwebui";
            saveSettings();
            is_get_status = true;
            is_api_button_press = true;
            getStatus();
        }
    });

    $("body").click(function () {
        if ($("#options").css("opacity") == 1.0) {
            $("#options").transition({
                opacity: 0.0,
                duration: 100, //animation_rm_duration,
                easing: animation_rm_easing,
                complete: function () {
                    $("#options").css("display", "none");
                },
            });
        }
    });

    $("#options_button").click(function () {
        // this is the options button click function, shows the options menu if closed
        if (
            $("#options").css("display") === "none" &&
            $("#options").css("opacity") == 0.0
        ) {
            $("#options").css("display", "block");
            $("#options").transition({
                opacity: 1.0, // the manual setting of CSS via JS is what allows the click-away feature to work
                duration: 100,
                easing: animation_rm_easing,
                complete: function () { },
            });
        }
    });

    $("#option_select_chat").click(function () {
        if (selected_group) {
            // will open a chat selection screen
            openNavToggle();
            $("#rm_button_characters").trigger("click");
            return;
        }
        if (this_chid != undefined && !is_send_press) {
            getAllCharaChats();
            $("#shadow_select_chat_popup").css("display", "block");
            $("#shadow_select_chat_popup").css("opacity", 0.0);
            $("#shadow_select_chat_popup").transition({
                opacity: 1.0,
                duration: animation_rm_duration,
                easing: animation_rm_easing,
            });
        }
    });
    $("#option_start_new_chat").click(function () {
        if (selected_group) {
            // will open a group creation screen
            openNavToggle();
            $("#rm_button_group_chats").trigger("click");
            return;
        }
        if (this_chid != undefined && !is_send_press) {
            popup_type = "new_chat";
            callPopup("<h3>Start new chat?</h3>");
        }
    });
    $("#option_regenerate").click(function () {
        if (is_send_press == false) {
            is_send_press = true;
            Generate("regenerate");
        }
    });
    // this function hides the input form, and shows the delete/cancel buttons for deleting messages from chat
    $("#option_delete_mes").click(function () {
        if (
            (this_chid != undefined && !is_send_press) ||
            (selected_group && !is_group_generating)
        ) {
            $("#dialogue_del_mes").css("display", "block");
            $("#send_form").css("display", "none");
            $(".del_checkbox").each(function () {
                if ($(this).parent().attr("mesid") != 0) {
                    $(this).css("display", "block");
                    $(this).parent().children(".for_checkbox").css("display", "none");
                }
            });
        }
    });
    //functionality for the cancel delete messages button, reverts to normal display of input form
    $("#dialogue_del_mes_cancel").click(function () {
        $("#dialogue_del_mes").css("display", "none");
        $("#send_form").css("display", css_send_form_display);
        $(".del_checkbox").each(function () {
            $(this).css("display", "none");
            $(this).parent().children(".for_checkbox").css("display", "block");
            $(this).parent().css("background", css_mes_bg);
            $(this).prop("checked", false);
        });
        this_del_mes = 0;
    });
    //confirms message delation with the "ok" button
    $("#dialogue_del_mes_ok").click(function () {
        $("#dialogue_del_mes").css("display", "none");
        $("#send_form").css("display", css_send_form_display);
        $(".del_checkbox").each(function () {
            $(this).css("display", "none");
            $(this).parent().children(".for_checkbox").css("display", "block");
            $(this).parent().css("background", css_mes_bg);
            $(this).prop("checked", false);
        });
        if (this_del_mes != 0) {
            $(".mes[mesid='" + this_del_mes + "']")
                .nextAll("div")
                .remove();
            $(".mes[mesid='" + this_del_mes + "']").remove();
            chat.length = this_del_mes;
            count_view_mes = this_del_mes;
            if (selected_group) {
                saveGroupChat(selected_group);
            } else {
                saveChat();
            }
            var $textchat = $("#chat");
            $textchat.scrollTop($textchat[0].scrollHeight);
        }
        this_del_mes = 0;
    });

    $("#world_info").change(async function () {
        const selectedWorld = $("#world_info").find(":selected").val();
        world_info = null;
        world_info_data = null;

        if (selectedWorld !== "None") {
            const worldIndex = Number(selectedWorld);
            world_info = !isNaN(worldIndex) ? world_names[worldIndex] : null;
            await loadWorldInfoData();
        }

        hideWorldEditor();
        saveSettings();
    });

    $("#settings_perset").change(function () {
        if ($("#settings_perset").find(":selected").val() != "gui") {
            preset_settings = $("#settings_perset").find(":selected").text();
            temp = koboldai_settings[koboldai_setting_names[preset_settings]].temp;
            amount_gen =
                koboldai_settings[koboldai_setting_names[preset_settings]].genamt;
            rep_pen =
                koboldai_settings[koboldai_setting_names[preset_settings]].rep_pen;
            rep_pen_size =
                koboldai_settings[koboldai_setting_names[preset_settings]]
                    .rep_pen_range;
            max_context =
                koboldai_settings[koboldai_setting_names[preset_settings]].max_length;
            $("#temp").val(temp);
            $("#temp_counter").html(temp);

            $("#amount_gen").val(amount_gen);
            $("#amount_gen_counter").html(amount_gen);

            $("#max_context").val(max_context);
            $("#max_context_counter").html(max_context + " Tokens");

            $("#rep_pen").val(rep_pen);
            $("#rep_pen_counter").html(rep_pen);

            $("#rep_pen_size").val(rep_pen_size);
            $("#rep_pen_size_counter").html(rep_pen_size + " Tokens");

            $("#range_block").children().prop("disabled", false);
            $("#range_block").css("opacity", 1.0);
            $("#amount_gen_block").children().prop("disabled", false);
            $("#amount_gen_block").css("opacity", 1.0);
        } else {
            //$('.button').disableSelection();
            preset_settings = "gui";
            $("#range_block").children().prop("disabled", true);
            $("#range_block").css("opacity", 0.5);
            $("#amount_gen_block").children().prop("disabled", true);
            $("#amount_gen_block").css("opacity", 0.45);
        }
        saveSettings();
    });
    $("#settings_perset_novel").change(function () {
        preset_settings_novel = $("#settings_perset_novel")
            .find(":selected")
            .text();
        temp_novel =
            novelai_settings[novelai_setting_names[preset_settings_novel]]
                .temperature;
        //amount_gen = koboldai_settings[koboldai_setting_names[preset_settings]].genamt;
        rep_pen_novel =
            novelai_settings[novelai_setting_names[preset_settings_novel]]
                .repetition_penalty;
        rep_pen_size_novel =
            novelai_settings[novelai_setting_names[preset_settings_novel]]
                .repetition_penalty_range;
        $("#temp_novel").val(temp_novel);
        $("#temp_counter_novel").html(temp_novel);

        //$('#amount_gen').val(amount_gen);
        //$('#amount_gen_counter').html(amount_gen);

        $("#rep_pen_novel").val(rep_pen_novel);
        $("#rep_pen_counter_novel").html(rep_pen_novel);

        $("#rep_pen_size_novel").val(rep_pen_size_novel);
        $("#rep_pen_size_counter_novel").html(rep_pen_size_novel + " Tokens");

        //$("#range_block").children().prop("disabled", false);
        //$("#range_block").css('opacity',1.0);
        saveSettings();
    });
    $("#main_api").change(function () {
        is_pygmalion = false;
        is_get_status = false;
        is_get_status_novel = false;
        online_status = "no_connection";
        clearSoftPromptsList();
        checkOnlineStatus();
        changeMainAPI();
        saveSettings();
    });
    $("#softprompt").change(async function () {
        if (!api_server) {
            return;
        }

        const selected = $("#softprompt").find(":selected").val();
        const response = await fetch("/setsoftprompt", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": token,
            },
            body: JSON.stringify({ name: selected, api_server: api_server }),
        });

        if (!response.ok) {
            console.error("Couldn't change soft prompt");
        }
    });

    for (var i of [
        "temp",
        "rep_pen",
        "rep_pen_size",
        "top_k",
        "top_p",
        "typical_p",
        "penalty_alpha",
    ]) {
        $("#" + i + "_textgenerationwebui").attr("x-setting-id", i);
        $(document).on("input", "#" + i + "_textgenerationwebui", function () {
            var i = $(this).attr("x-setting-id");
            var val = $(this).val();
            if (isInt(val)) {
                $("#" + i + "_counter_textgenerationwebui").html($(this).val() + ".00");
            } else {
                $("#" + i + "_counter_textgenerationwebui").html($(this).val());
            }
            textgenerationwebui_settings[i] = parseFloat(val);
            setTimeout(saveSettings, 500);
        });
    }

    $(document).on("input", "#temp", function () {
        temp = $(this).val();
        if (isInt(temp)) {
            $("#temp_counter").html($(this).val() + ".00");
        } else {
            $("#temp_counter").html($(this).val());
        }
        var tempTimer = setTimeout(saveSettings, 500);
    });

    $(document).on("input", "#amount_gen", function () {
        amount_gen = $(this).val();
        $("#amount_gen_counter").html($(this).val());
        var amountTimer = setTimeout(saveSettings, 500);
    });

    $(document).on("input", "#max_context", function () {
        max_context = parseInt($(this).val());
        $("#max_context_counter").html($(this).val() + " Tokens");
        var max_contextTimer = setTimeout(saveSettings, 500);
    });

    $(document).on("input", "#world_info_depth", function () {
        world_info_depth = Number($(this).val());
        $("#world_info_depth_counter").html(`${$(this).val()} Messages`);
        setTimeout(saveSettings, 500);
    });

    $(document).on("input", "#world_info_budget", function () {
        world_info_budget = Number($(this).val());
        $("#world_info_budget_counter").html(`${$(this).val()} Tokens`);
        setTimeout(saveSettings, 500);
    });

    $("#style_anchor").change(function () {
        style_anchor = !!$("#style_anchor").prop("checked");
        saveSettings();
    });

    $("#character_anchor").change(function () {
        character_anchor = !!$("#character_anchor").prop("checked");
        saveSettings();
    });

    $("#auto-connect-checkbox").change(function () {
        auto_connect = !!$("#auto-connect-checkbox").prop("checked");
        saveSettings();
    });

    $("#auto-load-chat-checkbox").change(function () {
        auto_load_chat = !!$("#auto-load-chat-checkbox").prop("checked");
        saveSettings();
    });

    $("#collapse-newlines-checkbox").change(function () {
        collapse_newlines = !!$("#collapse-newlines-checkbox").prop("checked");
        saveSettings();
    });

    $(document).on("input", "#rep_pen", function () {
        rep_pen = $(this).val();
        if (isInt(rep_pen)) {
            $("#rep_pen_counter").html($(this).val() + ".00");
        } else {
            $("#rep_pen_counter").html($(this).val());
        }
        var repPenTimer = setTimeout(saveSettings, 500);
    });

    $(document).on("input", "#rep_pen_size", function () {
        rep_pen_size = $(this).val();
        $("#rep_pen_size_counter").html($(this).val() + " Tokens");
        var repPenSizeTimer = setTimeout(saveSettings, 500);
    });

    //Novel
    $(document).on("input", "#temp_novel", function () {
        temp_novel = $(this).val();

        if (isInt(temp_novel)) {
            $("#temp_counter_novel").html($(this).val() + ".00");
        } else {
            $("#temp_counter_novel").html($(this).val());
        }
        var tempTimer_novel = setTimeout(saveSettings, 500);
    });

    $(document).on("input", "#rep_pen_novel", function () {
        rep_pen_novel = $(this).val();
        if (isInt(rep_pen_novel)) {
            $("#rep_pen_counter_novel").html($(this).val() + ".00");
        } else {
            $("#rep_pen_counter_novel").html($(this).val());
        }
        var repPenTimer_novel = setTimeout(saveSettings, 500);
    });

    $(document).on("input", "#rep_pen_size_novel", function () {
        rep_pen_size_novel = $(this).val();
        $("#rep_pen_size_counter_novel").html($(this).val() + " Tokens");
        var repPenSizeTimer_novel = setTimeout(saveSettings, 500);
    });

    $("#donation").click(function () {
        $("#shadow_tips_popup").css("display", "block");
        $("#shadow_tips_popup").transition({
            opacity: 1.0,
            duration: 100,
            easing: animation_rm_easing,
            complete: function () { },
        });
    });

    $("#tips_cross").click(function () {
        $("#shadow_tips_popup").transition({
            opacity: 0.0,
            duration: 100,
            easing: animation_rm_easing,
            complete: function () {
                $("#shadow_tips_popup").css("display", "none");
            },
        });
    });

    $("#select_chat_cross").click(function () {
        $("#shadow_select_chat_popup").css("display", "none");
        $("#load_select_chat_div").css("display", "block");
    });

    //********************
    //***Message Editor***
    $(document).on("click", ".mes_edit", function () {
        if (this_chid !== undefined || selected_group) {
            const message = $(this).closest(".mes");

            if (message.data("isSystem")) {
                return;
            }

            let chatScrollPosition = $("#chat").scrollTop();
            if (this_edit_mes_id !== undefined) {
                let mes_edited = $("#chat")
                    .children()
                    .filter('[mesid="' + this_edit_mes_id + '"]')
                    .children(".mes_block")
                    .children(".ch_name")
                    .children(".mes_edit_done");
                messageEditDone(mes_edited);
            }
            $(this).parent().parent().children(".mes_text").empty();
            $(this).css("display", "none");
            $(this)
                .parent()
                .children(".mes_edit_done")
                .css("display", "inline-block");
            $(this).parent().children(".mes_edit_done").css("opacity", 0.0);
            $(this)
                .parent()
                .children(".mes_edit_cancel")
                .css("display", "inline-block");
            $(this).parent().children(".mes_edit_cancel").css("opacity", 0.0);
            $(this)
                .parent()
                .children(".mes_edit_done")
                .transition({
                    opacity: 1.0,
                    duration: 600,
                    easing: "",
                    complete: function () { },
                });
            $(this)
                .parent()
                .children(".mes_edit_cancel")
                .transition({
                    opacity: 1.0,
                    duration: 600,
                    easing: "",
                    complete: function () { },
                });
            var edit_mes_id = $(this).parent().parent().parent().attr("mesid");
            this_edit_mes_id = edit_mes_id;

            var text = chat[edit_mes_id]["mes"];
            if (chat[edit_mes_id]["is_user"]) {
                this_edit_mes_chname = name1;
            } else if (chat[edit_mes_id]["forced_avatar"]) {
                this_edit_mes_chname = chat[edit_mes_id]["name"];
            } else {
                this_edit_mes_chname = name2;
            }
            text = text.trim();
            $(this)
                .parent()
                .parent()
                .children(".mes_text")
                .append(
                    '<textarea class=edit_textarea style="max-width:auto; ">' +
                    text +
                    "</textarea>"
                );
            let edit_textarea = $(this)
                .parent()
                .parent()
                .children(".mes_text")
                .children(".edit_textarea");
            edit_textarea.css("opacity", 0.0);
            edit_textarea.transition({
                opacity: 1.0,
                duration: 0,
                easing: "",
                complete: function () { },
            });
            edit_textarea.height(0);
            edit_textarea.height(edit_textarea[0].scrollHeight);
            edit_textarea.focus();
            edit_textarea[0].setSelectionRange(
                edit_textarea.val().length,
                edit_textarea.val().length
            );
            if (this_edit_mes_id == count_view_mes - 1) {
                $("#chat").scrollTop(chatScrollPosition);
            }
        }
    });
    $(document).on("click", ".mes_edit_cancel", function () {
        //var text = $(this).parent().parent().children('.mes_text').children('.edit_textarea').val();
        var text = chat[this_edit_mes_id]["mes"];

        $(this).parent().parent().children(".mes_text").empty();
        $(this).css("display", "none");
        $(this).parent().children(".mes_edit_done").css("display", "none");
        $(this).parent().children(".mes_edit").css("display", "inline-block");
        $(this)
            .parent()
            .parent()
            .children(".mes_text")
            .append(messageFormating(text, this_edit_mes_chname));
        appendImageToMessage(chat[this_edit_mes_id], $(this).closest(".mes"));
        this_edit_mes_id = undefined;
    });
    $(document).on("click", ".mes_edit_done", function () {
        messageEditDone($(this));
    });

    $("#your_name_button").click(function () {
        if (!is_send_press) {
            name1 = $("#your_name").val();
            if (name1 === undefined || name1 == "") name1 = default_user_name;
            console.log(name1);
            saveSettings("change_name");
        }
    });
    //Select chat

    $("#api_button_novel").click(function () {
        if ($("#api_key_novel").val() != "") {
            $("#api_loading_novel").css("display", "inline-block");
            $("#api_button_novel").css("display", "none");
            api_key_novel = $("#api_key_novel").val();
            api_key_novel = $.trim(api_key_novel);
            //console.log("1: "+api_server);
            saveSettings();
            is_get_status_novel = true;
            is_api_button_press_novel = true;
        }
    });
    function resultCheckStatusNovel() {
        is_api_button_press_novel = false;
        checkOnlineStatus();
        $("#api_loading_novel").css("display", "none");
        $("#api_button_novel").css("display", "inline-block");
    }
    $("#model_novel_select").change(function () {
        model_novel = $("#model_novel_select").find(":selected").val();
        saveSettings();
    });
    $("#anchor_order").change(function () {
        anchor_order = parseInt($("#anchor_order").find(":selected").val());
        saveSettings();
    });

    //**************************CHARACTER IMPORT EXPORT*************************//
    $("#character_import_button").click(function () {
        $("#character_import_file").click();
    });
    $("#character_import_file").on("change", function (e) {
        $("#rm_info_avatar").html("");
        var file = e.target.files[0];
        //console.log(1);
        if (!file) {
            return;
        }
        var ext = file.name.match(/\.(\w+)$/);
        if (
            !ext ||
            (ext[1].toLowerCase() != "json" && ext[1].toLowerCase() != "png")
        ) {
            return;
        }

        var format = ext[1].toLowerCase();
        $("#character_import_file_type").val(format);
        //console.log(format);
        var formData = new FormData($("#form_import").get(0));

        jQuery.ajax({
            type: "POST",
            url: "/importcharacter",
            data: formData,
            beforeSend: function () {
                //$('#create_button').attr('disabled',true);
                //$('#create_button').attr('value','Creating...');
            },
            cache: false,
            contentType: false,
            processData: false,
            success: async function (data) {
                if (data.file_name !== undefined) {
                    $("#rm_info_block").transition({ opacity: 0, duration: 0 });
                    var $prev_img = $("#avatar_div_div").clone();
                    $prev_img
                        .children("img")
                        .attr("src", "characters/" + data.file_name + ".png");
                    $("#rm_info_avatar").append($prev_img);

                    let oldSelectedChar = null;
                    if (this_chid != undefined && this_chid != "invalid-safety-id") {
                        oldSelectedChar = characters[this_chid].name;
                    }

                    await getCharacters();
                    select_rm_info("Character created", oldSelectedChar);
                    $("#rm_info_block").transition({ opacity: 1, duration: 1000 });
                }
            },
            error: function (jqXHR, exception) {
                $("#create_button").removeAttr("disabled");
            },
        });
    });
    $("#export_button").click(function () {
        var link = document.createElement("a");
        link.href = "characters/" + characters[this_chid].avatar;
        link.download = characters[this_chid].avatar;
        document.body.appendChild(link);
        link.click();
    });
    //**************************CHAT IMPORT EXPORT*************************//
    $("#chat_import_button").click(function () {
        $("#chat_import_file").click();
    });
    $("#chat_import_file").on("change", function (e) {
        var file = e.target.files[0];
        //console.log(1);
        if (!file) {
            return;
        }
        var ext = file.name.match(/\.(\w+)$/);
        if (
            !ext ||
            (ext[1].toLowerCase() != "json" && ext[1].toLowerCase() != "jsonl")
        ) {
            return;
        }

        var format = ext[1].toLowerCase();
        $("#chat_import_file_type").val(format);
        //console.log(format);
        var formData = new FormData($("#form_import_chat").get(0));
        //console.log('/importchat entered with: '+formData);
        jQuery.ajax({
            type: "POST",
            url: "/importchat",
            data: formData,
            beforeSend: function () {
                $("#select_chat_div").html("");
                $("#load_select_chat_div").css("display", "block");
                //$('#create_button').attr('value','Creating...');
            },
            cache: false,
            contentType: false,
            processData: false,
            success: function (data) {
                //console.log(data);
                if (data.res) {
                    getAllCharaChats();
                }
            },
            error: function (jqXHR, exception) {
                $("#create_button").removeAttr("disabled");
            },
        });
    });

    $(document).on("click", ".select_chat_block", function () {
        let file_name = $(this).attr("file_name").replace(".jsonl", "");
        //console.log(characters[this_chid]['chat']);
        characters[this_chid]["chat"] = file_name;
        clearChat();
        chat.length = 0;
        getChat();
        $("#selected_chat_pole").val(file_name);
        $("#create_button").click();
        $("#shadow_select_chat_popup").css("display", "none");
        $("#load_select_chat_div").css("display", "block");
    });

    //**************************WORLD INFO IMPORT EXPORT*************************//
    $("#world_import_button").click(function () {
        $("#world_import_file").click();
    });

    $("#world_import_file").on("change", function (e) {
        var file = e.target.files[0];

        if (!file) {
            return;
        }

        const ext = file.name.match(/\.(\w+)$/);
        if (!ext || ext[1].toLowerCase() !== "json") {
            return;
        }

        var formData = new FormData($("#form_world_import").get(0));

        jQuery.ajax({
            type: "POST",
            url: "/importworldinfo",
            data: formData,
            beforeSend: () => { },
            cache: false,
            contentType: false,
            processData: false,
            success: function (data) {
                if (data.name) {
                    imported_world_name = data.name;
                    updateWorldInfoList(imported_world_name);
                }
            },
            error: (jqXHR, exception) => { },
        });

        // Will allow to select the same file twice in a row
        $("#form_world_import").trigger("reset");
    });

    $("#world_info_edit_button").click(() => {
        is_world_edit_open ? hideWorldEditor() : showWorldEditor();
    });

    $("#world_popup_export").click(() => {
        if (world_info && world_info_data) {
            const jsonValue = JSON.stringify(world_info_data);
            const fileName = `${world_info}.json`;
            download(jsonValue, fileName, "application/json");
        }
    });

    $("#world_popup_delete").click(() => {
        popup_type = "del_world";
        callPopup("<h3>Delete the World Info?</h3>");
    });

    $("#world_popup_new").click(() => {
        createWorldInfoEntry();
    });

    $("#world_cross").click(() => {
        hideWorldEditor();
    });

    $("#world_popup_name_button").click(() => {
        renameWorldInfo();
    });

    $("#world_create_button").click(() => {
        createNewWorldInfo();
    });
});
