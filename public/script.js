import { humanizedDateTime } from "./scripts/RossAscends-mods.js";
import { encode } from "../scripts/gpt-2-3-tokenizer/mod.js";

import {
    kai_settings,
    loadKoboldSettings,
    formatKoboldUrl,
    getKoboldGenerationData,
} from "./scripts/kai-settings.js";

import {
    textgenerationwebui_settings,
    loadTextGenSettings,
} from "./scripts/textgen-settings.js";

import {
    world_info_budget,
    world_info_data,
    world_info_depth,
    world_info,
    getWorldInfoPrompt,
    selectImportedWorldInfo,
    setWorldInfoSettings,
    deleteWorldInfo,
} from "./scripts/world-info.js";

import {
    groups,
    selected_group,
    saveGroupChat,
    getGroups,
    generateGroupWrapper,
    deleteGroup,
    is_group_generating,
    printGroups,
    resetSelectedGroup,
    select_group_chats,
    regenerateGroup,
} from "./scripts/group-chats.js";

import {
    collapseNewlines,
    loadPowerUserSettings,
    power_user,
} from "./scripts/power-user.js";

import {
    setOpenAIMessageExamples,
    setOpenAIMessages,
    prepareOpenAIMessages,
    sendOpenAIRequest,
    loadOpenAISettings,
    setOpenAIOnlineStatus,
    generateOpenAIPromptCache,
    oai_settings,
    is_get_status_openai,
    openai_msgs,
} from "./scripts/openai.js";

import {
    getNovelTier,
    loadNovelPreset,
    loadNovelSettings,
    nai_settings,
} from "./scripts/nai-settings.js";

import { showBookmarksButtons } from "./scripts/bookmarks.js";

import {
    horde_settings,
    loadHordeSettings,
    generateHorde,
    checkHordeStatus,
    adjustHordeGenerationParams,
} from "./scripts/horde.js";

import {
    poe_settings,
    loadPoeSettings,
    POE_MAX_CONTEXT,
    generatePoe,
    is_get_status_poe,
    setPoeOnlineStatus,
} from "./scripts/poe.js";

import { debounce, delay } from "./scripts/utils.js";

//exporting functions and vars for mods
export {
    Generate,
    getSettings,
    saveSettings,
    saveSettingsDebounced,
    printMessages,
    clearChat,
    getChat,
    getCharacters,
    callPopup,
    substituteParams,
    sendSystemMessage,
    addOneMessage,
    deleteLastMessage,
    resetChatState,
    select_rm_info,
    setCharacterId,
    setCharacterName,
    setOnlineStatus,
    checkOnlineStatus,
    setEditedMessageId,
    setSendButtonState,
    selectRightMenuWithAnimation,
    setRightTabSelectedClass,
    openCharacterChat,
    saveChat,
    messageFormating,
    getExtensionPrompt,
    showSwipeButtons,
    hideSwipeButtons,
    changeMainAPI,
    setGenerationProgress,
    chat,
    this_chid,
    settings,
    characters,
    online_status,
    main_api,
    api_server,
    system_messages,
    nai_settings,
    token,
    name1,
    name2,
    is_send_press,
    api_server_textgenerationwebui,
    count_view_mes,
    max_context,
    default_avatar,
    system_message_types,
    talkativeness_default,
    default_ch_mes,
    extension_prompt_types,
}

// API OBJECT FOR EXTERNAL WIRING
window["TavernAI"] = {};

let converter = new showdown.Converter({ emoji: "true" });
/* let bg_menu_toggle = false; */
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
const default_ch_mes = "Hello";
let count_view_mes = 0;
let mesStr = "";
let generatedPromtCache = "";
let characters = [];
let this_chid;
let active_character;
let backgrounds = [];
const default_avatar = "img/ai4.png";
const system_avatar = "img/five.png";
let is_colab = false;
let is_checked_colab = false;
let is_mes_reload_avatar = false;
let optionsPopper = Popper.createPopper(document.getElementById('send_form'), document.getElementById('options'), {
    placement: 'top-start'
});
let dialogueResolve = null;

const durationSaveEdit = 200;
const saveSettingsDebounced = debounce(() => saveSettings(), durationSaveEdit);
const saveCharacterDebounced = debounce(() => $("#create_button").click(), durationSaveEdit);
const getStatusDebounced = debounce(() => getStatus(), 5000);

const system_message_types = {
    HELP: "help",
    WELCOME: "welcome",
    GROUP: "group",
    EMPTY: "empty",
    GENERIC: "generic",
    BOOKMARK_CREATED: "bookmark_created",
    BOOKMARK_BACK: "bookmark_back",
};

const extension_prompt_types = {
    AFTER_SCENARIO: 0,
    IN_CHAT: 1
};

const system_messages = {
    help: {
        name: systemUserName,
        force_avatar: system_avatar,
        is_user: false,
        is_system: true,
        is_name: true,
        mes: [
            'Hi there! The following chat formatting commands are supported:',
            '<ol>',
            '<li><tt>*text*</tt> – format the actions that your character does</li>',
            '<li><tt>{{text}}</tt> – set the behavioral bias for the AI character</li>',
            '<li><tt>{{}}</tt> – cancel a previously set bias</li>',
            '</ol>',
            'Need more help? Visit our wiki – <a href=\"https://github.com/TavernAI/TavernAI/wiki\">TavernAI Wiki</a>!'
        ].join('')
    },
    welcome:
    {
        name: systemUserName,
        force_avatar: system_avatar,
        is_user: false,
        is_name: true,
        mes: [
            'Welcome to TavernAI! In order to begin chatting:',
            '<ul>',
            '<li>Connect to one of the supported generation APIs</li>',
            '<li>Create or pick a character from the list</li>',
            '</ul>',
            'Still have questions left?\n',
            'Check out built-in help by typing <tt>/?</tt> in any chat or visit our ',
            '<a target="_blank" href="https://github.com/TavernAI/TavernAI/wiki">TavernAI Wiki</a>!'
        ].join('')
    },
    group: {
        name: systemUserName,
        force_avatar: system_avatar,
        is_user: false,
        is_system: true,
        is_name: true,
        is_group: true,
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
    bookmark_created: {
        name: systemUserName,
        force_avatar: system_avatar,
        is_user: false,
        is_system: true,
        is_name: true,
        mes: `Bookmark created! Click here to open the bookmark chat: <a class="bookmark_link" file_name="{0}" href="javascript:void(null);">{1}</a>`,
    },
    bookmark_back: {
        name: systemUserName,
        force_avatar: system_avatar,
        is_user: false,
        is_system: true,
        is_name: true,
        mes: `Click here to return to the previous chat: <a class="bookmark_link" file_name="{0}" href="javascript:void(null);">Return</a>`,
    },
};

// refresh token
$(document).ajaxError(function myErrorHandler(_, xhr) {
    if (xhr.status == 403) {
        $.get("/csrf-token").then((data) => {
            console.log('refreshed csrf token');
            token = data.token;
        });
    }
});

const talkativeness_default = 0.5;

var is_advanced_char_open = false;

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

//animation right menu
var animation_rm_duration = 500;
var animation_rm_easing = "";

var popup_type = "";
var bg_file_for_del = "";
var chat_file_for_del = "";
var online_status = "no_connection";

var api_server = "";
var api_server_textgenerationwebui = "";
//var interval_timer = setInterval(getStatus, 2000);
var interval_timer_novel = setInterval(getStatusNovel, 3000);
var is_get_status = false;
var is_get_status_novel = false;
var is_api_button_press = false;
var is_api_button_press_novel = false;

var is_send_press = false; //Send generation
var add_mes_without_animation = false;

var this_del_mes = 0;

//message editing and chat scroll posistion persistence
var this_edit_mes_text = "";
var this_edit_mes_chname = "";
var this_edit_mes_id;
var scroll_holder = 0;
var is_use_scroll_holder = false;

//settings
var settings;
var koboldai_settings;
var koboldai_setting_names;
var preset_settings = "gui";
var user_avatar = "you.png";
var amount_gen = 80; //default max length of AI generated responses
var max_context = 2048;

var is_pygmalion = false;
var tokens_already_generated = 0;
var message_already_generated = "";
var if_typing_text = false;
const tokens_cycle_count = 30;
var cycle_count_generation = 0;

var swipes = false;

let anchor_order = 0;
let style_anchor = true;
let character_anchor = true;
let extension_prompts = {};

var main_api;// = "kobold";
//novel settings
let novel_tier;
let novelai_settings;
let novelai_setting_names;

//css
var bg1_toggle = true; // inits the BG as BG1
var css_mes_bg = $('<div class="mes"></div>').css("background");
var css_send_form_display = $("<div id=send_form></div>").css("display");
let generate_loop_counter = 0;
const MAX_GENERATION_LOOPS = 5;
var colab_ini_step = 1;

let token;

//////////// Is this needed?
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

///// initialization protocol ////////
$.get("/csrf-token").then((data) => {
    token = data.token;
    getCharacters();
    getSettings("def");
    sendSystemMessage(system_message_types.WELCOME);
    getBackgrounds();
    getUserAvatars();
});

///////////// UNUSED FUNCTIONS MOVED TO TOP ///////////////

function newMesPattern(name) {
    //Patern which denotes a new message
    name = name + ":";
    return name;
}

//////////////////////////////////////////

function checkOnlineStatus() {
    ///////// REMOVED LINES THAT DUPLICATE RA_CHeckOnlineStatus FEATURES 

    if (online_status == "no_connection") {
        $("#online_status_indicator2").css("background-color", "red");  //Kobold
        $("#online_status_text2").html("No connection...");
        $("#online_status_indicator3").css("background-color", "red");  //Novel
        $("#online_status_text3").html("No connection...");
        $(".online_status_indicator4").css("background-color", "red");  //OAI / ooba
        $(".online_status_text4").html("No connection...");
        is_get_status = false;
        is_get_status_novel = false;
        setOpenAIOnlineStatus(false);
        setPoeOnlineStatus(false);
    } else {
        $("#online_status_indicator2").css("background-color", "green"); //kobold
        $("#online_status_text2").html(online_status);
        $("#online_status_indicator3").css("background-color", "green"); //novel
        $("#online_status_text3").html(online_status);
        $(".online_status_indicator4").css("background-color", "green"); //OAI / ooba
        $(".online_status_text4").html(online_status);
    }
}

async function getStatus() {
    if (is_get_status) {
        if (main_api == "kobold" && horde_settings.use_horde) {
            try {
                const hordeStatus = await checkHordeStatus();
                online_status = hordeStatus ? 'Connected' : 'no_connection';
                resultCheckStatus();
    
                if (online_status !== "no_connection") {
                    getStatusDebounced();
                }
            }
            catch {
                online_status = "no_connection";
                resultCheckStatus();
            }

            return;
        }

        jQuery.ajax({
            type: "POST", //
            url: "/getstatus", //
            data: JSON.stringify({
                api_server:
                    main_api == "kobold" ? api_server : api_server_textgenerationwebui,
                main_api: main_api,
            }),
            beforeSend: function () { },
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
                if (online_status.toLowerCase().indexOf("pygmalion") != -1 || (online_status !== "no_connection" && power_user.force_pygmalion_formatting)) {
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
        if (is_get_status_novel != true && is_get_status_openai != true && main_api != "poe") {
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
        let this_avatar = default_avatar;
        if (item.avatar != "none") {
            this_avatar = `/thumbnail?type=avatar&file=${encodeURIComponent(item.avatar)}&${Date.now()}`;
        } //RossAscends: changed 'prepend' to 'append' to make alphabetical sorting display correctly.
        $("#rm_print_characters_block").append(

            `<div class=character_select chid=${i} id="CharID${i}">
                <div class=avatar><img src="${this_avatar}"></div>
                <div class=ch_name>${item.name}</div>
            </div>`
        );
        //console.log('printcharacters() -- printing -- ChID '+i+' ('+item.name+')');
    });
    printGroups();
}

async function getCharacters() {
    await getGroups();
    var response = await fetch("/getcharacters", {
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
        getData = await response.json();
        const load_ch_count = Object.getOwnPropertyNames(getData);
        for (var i = 0; i < load_ch_count.length; i++) {
            characters[i] = [];
            characters[i] = getData[i];
            characters[i]['name'] = DOMPurify.sanitize(characters[i]['name']);
        }
        if (this_chid != undefined && this_chid != "invalid-safety-id") {
            $("#avatar_url_pole").val(characters[this_chid].avatar);
        }
        printCharacters();
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
        for (const bg of getData) {
            const thumbPath = `/thumbnail?type=bg&file=${encodeURIComponent(bg)}`;
            $("#bg_menu_content").append(
                `<div class="bg_example" bgfile="${bg}" class="bg_example_img" style="background-image: url('${thumbPath}');">
                <div bgfile="${bg}" class="bg_example_cross">
            </div>`
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
        success: function (html) { },
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

    }
}

async function delChat(chatfile) {
    const response = await fetch("/delchat", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": token,
        },
        body: JSON.stringify({
            chatfile: chatfile,
            id: characters[this_chid].name
        }),
    });
    if (response.ok === true) {
        //close past chat popup
        $("#select_chat_cross").click();

        // choose another chat if current was deleted
        if (chatfile.replace('.jsonl', '') === characters[this_chid].chat) {
            await replaceCurrentChat();
        }

        //open the history view again after 100ms
        //hide option popup menu
        setTimeout(function () {
            $("#option_select_chat").click();
            $("#options").hide();
        }, 100);
    }
}

async function replaceCurrentChat() {
    clearChat();
    chat.length = 0;

    const chatsResponse = await fetch("/getallchatsofcharacter", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            "X-CSRF-Token": token,
        },
        body: JSON.stringify({ avatar_url: characters[this_chid].avatar })
    });

    if (chatsResponse.ok) {
        const chats = Object.values(await chatsResponse.json());

        // pick existing chat
        if (chats.length && typeof chats[0] === 'object') {
            characters[this_chid].chat = chats[0].file_name.replace('.jsonl', '');
            $("#selected_chat_pole").val(characters[this_chid].chat);
            saveCharacterDebounced();
            await getChat();
        }

        // start new chat
        else {
            characters[this_chid].chat = name2 + " - " + humanizedDateTime();
            $("#selected_chat_pole").val(characters[this_chid].chat);
            saveCharacterDebounced();
            await getChat();
        }
    }
}

function printMessages() {
    chat.forEach(function (item, i, arr) {
        addOneMessage(item);
    });
}

function clearChat() {
    count_view_mes = 0;
    extension_prompts = {};
    $("#chat").html("");
}

function deleteLastMessage() {
    count_view_mes--;
    chat.length = chat.length - 1;
    $('#chat').children('.mes').last().remove();
}

function messageFormating(mes, ch_name, isSystem, forceAvatar) {
    if (!mes) {
        mes = '';
    }

    if (this_chid != undefined && !isSystem)
        mes = mes.replaceAll("<", "&lt;").replaceAll(">", "&gt;"); //for welcome message
    if (this_chid === undefined && !selected_group) {
        mes = mes
            .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
            .replace(/\*(.+?)\*/g, "<i>$1</i>")
            .replace(/\n/g, "<br/>");
    } else if (!isSystem) {
        mes = converter.makeHtml(mes);
        //mes = mes.replace(/{.*}/g, "");
        mes = mes.replace(/{{(\*?.+?\*?)}}/g, "");
        

        mes = mes.replace(/\n/g, "<br/>");
        mes = mes.trim();

        mes = mes.replace(/<code>[\s\S]*?<\/code>/g, function(match) {
            return match.replace(/&amp;/g, '&');
        });
    }

    if (forceAvatar) {
        mes = mes.replaceAll(ch_name + ":", "");
    }

    if (ch_name !== name1) {
        mes = mes.replaceAll(name2 + ":", "");
    }
    return mes;
}

function getMessageFromTemplate(mesId, characterName, isUser, avatarImg, bias, isSystem) {
    const mes = $('#message_template .mes').clone();
    mes.attr({ 'mesid': mesId, 'ch_name': characterName, 'is_user': isUser, 'is_system': !!isSystem });
    mes.find('.avatar img').attr('src', avatarImg);
    mes.find('.ch_name .name_text').text(characterName);
    mes.find('.mes_bias').html(bias);
    return mes;
}

function appendImageToMessage(mes, messageElement) {
    if (mes.extra?.image) {
        const image = document.createElement("img");
        image.src = mes.extra?.image;
        image.title = mes.title;
        image.classList.add("img_extra");
        messageElement.find(".mes_text").prepend(image);
    }
}

function addOneMessage(mes, type = "normal", insertAfter = null) {

    var messageText = mes["mes"];
    var characterName = name1;
    var avatarImg = "User Avatars/" + user_avatar;
    const isSystem = mes.is_system;
    generatedPromtCache = "";
    if (!mes["is_user"]) {
        if (mes.force_avatar) {
            avatarImg = mes.force_avatar;
        } else if (this_chid == undefined || this_chid == "invalid-safety-id") {
            avatarImg = system_avatar;
        } else {
            if (characters[this_chid].avatar != "none") {
                avatarImg = `/thumbnail?type=avatar&file=${encodeURIComponent(characters[this_chid].avatar)}`;
                if (is_mes_reload_avatar !== false) {
                    avatarImg += "&" + is_mes_reload_avatar;
                }
            } else {
                avatarImg = default_avatar;
            }
        }

        characterName = mes.is_system || mes.force_avatar ? mes.name : name2;
    }

    if (count_view_mes == 0) {
        messageText = substituteParams(messageText);
    }
    messageText = messageFormating(
        messageText,
        characterName,
        isSystem,
        mes.force_avatar
    );
    const bias = messageFormating(mes.extra?.bias ?? "");

    var HTMLForEachMes = getMessageFromTemplate(count_view_mes, characterName, mes.is_user, avatarImg, bias, isSystem);

    if (type !== 'swipe') {
        if (!insertAfter) {
            $("#chat").append(HTMLForEachMes);
        }
        else {
            const target = $("#chat").find(`.mes[mesid="${insertAfter}"]`);
            $(HTMLForEachMes).insertAfter(target);
            $(HTMLForEachMes).find('.swipe_left').css('display', 'none');
            $(HTMLForEachMes).find('.swipe_right').css('display', 'none');
        }
    }

    const newMessage = $(`#chat [mesid="${count_view_mes}"]`);
    newMessage.data("isSystem", isSystem);

    appendImageToMessage(mes, newMessage);

    if (isSystem) {
        newMessage.find(".mes_edit").hide();
    }

    newMessage.find('.avatar img').on('error', function () {
        $(this).attr("src", "/img/user-slash-solid.svg");
    });

    if (type === 'swipe') {
        $("#chat").children().filter('[mesid="' + (count_view_mes - 1) + '"]').children('.mes_block').children('.mes_text').html('');
        $("#chat").children().filter('[mesid="' + (count_view_mes - 1) + '"]').children('.mes_block').children('.mes_text').append(messageText);

        //console.log(mes);
    } else {
        $("#chat").children().filter('[mesid="' + count_view_mes + '"]').children('.mes_block').children('.mes_text').append(messageText);
        hideSwipeButtons();
        count_view_mes++;

    }

    // Don't scroll if not inserting last
    if (!insertAfter) {
        $('#chat .mes').last().addClass('last_mes');
        $('#chat .mes').eq(-2).removeClass('last_mes');

        hideSwipeButtons();
        showSwipeButtons();

        var $textchat = $("#chat");
        $textchat.scrollTop(($textchat[0].scrollHeight));
    }
}

function substituteParams(content, _name1, _name2) {
    _name1 = _name1 ?? name1;
    _name2 = _name2 ?? name2;

    content = content.replace(/{{user}}/gi, _name1);
    content = content.replace(/{{char}}/gi, _name2);
    content = content.replace(/<USER>/gi, _name1);
    content = content.replace(/<BOT>/gi, _name2);
    return content;
}

function getSlashCommand(message, type) {
    if (type == "regenerate" || type == "swipe") {
        return null;
    }

    const commandMap = {
        "/?": system_message_types.HELP,
        "/help": system_message_types.HELP
    };

    const activationText = message.trim().toLowerCase();

    if (Object.keys(commandMap).includes(activationText)) {
        return commandMap[activationText];
    }

    return null;
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

    if (!newMessage.extras) {
        newMessage.extras = {};
    }

    newMessage.extras.type = type;

    chat.push(newMessage);
    addOneMessage(newMessage);
    is_send_press = false;
}

function extractMessageBias(message) {
    if (!message) {
        return null;
    }

    const found = [];
    const rxp = /{{(\*?.+?\*?)}}/g;
    //const rxp = /{([^}]+)}/g;
    let curMatch;

    while ((curMatch = rxp.exec(message))) {
        found.push(curMatch[1].trim());
    }

    if (!found.length) {
        // cancels a bias
        if (message.includes('{') && message.includes('}')) {
            return '';
        }
        return null;
    }

    return ` ${found.join(" ")} `;
}

function cleanGroupMessage(getMessage) {
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
    return getMessage;
}

function getExtensionPrompt(position = 0, depth = undefined, separator = "\n") {
    let extension_prompt = Object.keys(extension_prompts)
        .sort()
        .map((x) => extension_prompts[x])
        .filter(x => x.position == position && x.value && (depth === undefined || x.depth == depth))
        .map(x => x.value.trim())
        .join(separator);
    if (extension_prompt.length && !extension_prompt.startsWith(separator)) {
        extension_prompt = separator + extension_prompt;
    }
    if (extension_prompt.length && !extension_prompt.endsWith(separator)) {
        extension_prompt = extension_prompt + separator;
    }
    extension_prompt = substituteParams(extension_prompt);
    return extension_prompt;
}

function baseChatReplace(value, name1, name2) {
    if (value !== undefined && value.length > 0) {
        if (is_pygmalion) {
            value = value.replace(/{{user}}:/gi, "You:");
            value = value.replace(/<USER>:/gi, "You:");
        }
        value = value.replace(/{{user}}/gi, name1);
        value = value.replace(/{{char}}/gi, name2);
        value = value.replace(/<USER>/gi, name1);
        value = value.replace(/<BOT>/gi, name2);

        if (power_user.collapse_newlines) {
            value = collapseNewlines(value);
        }
    }
    return value;
}

function appendToStoryString(value, prefix) {
    if (value !== undefined && value.length > 0) {
        return prefix + value + '\n';
    }
    return '';
}

async function Generate(type, automatic_trigger, force_name2) {
    console.log('Generate entered');
    setGenerationProgress(0);
    tokens_already_generated = 0;
    message_already_generated = name2 + ': ';

    const slashCommand = getSlashCommand($("#send_textarea").val(), type);

    if (slashCommand == system_message_types.HELP) {
        sendSystemMessage(system_message_types.HELP);
        $("#send_textarea").val('').trigger('input');
        return;
    }

    if (selected_group && !is_group_generating) {
        generateGroupWrapper(false, type = type);
        return;
    }

    if (online_status != 'no_connection' && this_chid != undefined && this_chid !== 'invalid-safety-id') {
        if (type !== 'regenerate' && type !== "swipe") {
            is_send_press = true;
            var textareaText = $("#send_textarea").val();
            //console.log('Not a Regenerate call, so posting normall with input of: ' +textareaText);
            $("#send_textarea").val('').trigger('input');

        } else {
            //console.log('Regenerate call detected')
            var textareaText = "";
            if (chat[chat.length - 1]['is_user']) {//If last message from You

            }
            else if (type !== "swipe") {
                chat.length = chat.length - 1;
                count_view_mes -= 1;
                openai_msgs.pop();
                $('#chat').children().last().hide(500, function () {
                    $(this).remove();
                });
            }
        }

        deactivateSendButtons();

        let promptBias = null;
        let messageBias = extractMessageBias(textareaText);

        // gets bias of the latest message where it was applied
        for (let mes of chat.slice().reverse()) {
            if (mes && mes.is_user && mes.extra && mes.extra.bias) {
                if (mes.extra.bias.trim().length > 0) {
                    promptBias = mes.extra.bias;
                }
                break;
            }
        }

        // bias from the latest message is top priority//

        promptBias = messageBias ?? promptBias ?? '';

        var storyString = "";
        var userSendString = "";
        var finalPromt = "";
        var postAnchorChar = "Elaborate speaker";//'Talk a lot with description what is going on around';// in asterisks
        var postAnchorStyle = "Writing style: very long messages";//"[Genre: roleplay chat][Tone: very long messages with descriptions]";
        var anchorTop = '';
        var anchorBottom = '';
        var topAnchorDepth = 8;

        if (character_anchor && !is_pygmalion) {
            console.log('saw not pyg');
            if (anchor_order === 0) {
                anchorTop = name2 + " " + postAnchorChar;
            } else {
                console.log('saw pyg, adding anchors')
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
            chat[chat.length - 1]['name'] = name1;
            chat[chat.length - 1]['is_user'] = true;
            chat[chat.length - 1]['is_name'] = true;
            chat[chat.length - 1]['send_date'] = humanizedDateTime();
            chat[chat.length - 1]['mes'] = textareaText;
            chat[chat.length - 1]['extra'] = {};

            if (messageBias) {
                console.log('checking bias');
                chat[chat.length - 1]['extra']['bias'] = messageBias;
            }
            //console.log('Generate calls addOneMessage');
            addOneMessage(chat[chat.length - 1]);
        }
        ////////////////////////////////////
        let chatString = '';
        let arrMes = [];
        let mesSend = [];
        let charDescription = baseChatReplace($.trim(characters[this_chid].description), name1, name2);
        let charPersonality = baseChatReplace($.trim(characters[this_chid].personality), name1, name2);
        let Scenario = baseChatReplace($.trim(characters[this_chid].scenario), name1, name2);
        let mesExamples = baseChatReplace($.trim(characters[this_chid].mes_example), name1, name2);

        if (!mesExamples.startsWith('<START>')) {
            mesExamples = '<START>\n' + mesExamples.trim();
        }

        if (mesExamples.replace(/<START>/gi, '').trim().length === 0) {
            mesExamples = '';
        }

        let mesExamplesArray = mesExamples.split(/<START>/gi).slice(1).map(block => `<START>\n${block.trim()}\n`);

        if (main_api === 'openai') {
            const oai_chat = [...chat].filter(x => !x.is_system);

            if (type == 'swipe') {
                oai_chat.pop();
            }

            setOpenAIMessages(oai_chat);
            setOpenAIMessageExamples(mesExamplesArray);
        }

        if (is_pygmalion) {
            storyString += appendToStoryString(charDescription, power_user.disable_description_formatting ? '' : name2 + "'s Persona: ");
            storyString += appendToStoryString(charPersonality, power_user.disable_personality_formatting ? '' : 'Personality: ');
            storyString += appendToStoryString(Scenario, power_user.disable_scenario_formatting ? '' : 'Scenario: ');
        } else {
            if (charDescription !== undefined) {
                if (charPersonality.length > 0 && !power_user.disable_personality_formatting) {
                    charPersonality = name2 + "'s personality: " + charPersonality;
                }
            }

            storyString += appendToStoryString(charDescription, '');

            if (storyString.endsWith('\n')) {
                storyString = storyString.slice(0, -1);
            }

            if (count_view_mes < topAnchorDepth) {
                storyString += '\n' + appendToStoryString(charPersonality, '');
            }
        }

        if (power_user.custom_chat_separator && power_user.custom_chat_separator.length) {
            for (let i = 0; i < mesExamplesArray.length; i++) {
                mesExamplesArray[i] = mesExamplesArray[i].replace(/<START>/gi, power_user.custom_chat_separator);
            }
        }

        if (power_user.pin_examples && main_api !== 'openai') {
            for (let example of mesExamplesArray) {
                if (!is_pygmalion) {
                    if (!storyString.endsWith('\n')) {
                        storyString += '\n';
                    }
                    example = example.replace(/<START>/i, 'This is how ' + name2 + ' should talk');//An example of how '+name2+' responds
                }
                storyString += appendToStoryString(example, '');
            }
        }

        // Pygmalion does that anyway
        if (power_user.always_force_name2 && !is_pygmalion) {
            force_name2 = true;
        }

        //////////////////////////////////

        var count_exm_add = 0;
        console.log('emptying chat2');
        var chat2 = [];
        var j = 0;
        console.log('pre-replace chat.length = ' + chat.length);
        for (var i = chat.length - 1; i >= 0; i--) {
            let charName = selected_group ? chat[j].name : name2;
            if (j == 0) {
                chat[j]['mes'] = chat[j]['mes'].replace(/{{user}}/gi, name1);
                chat[j]['mes'] = chat[j]['mes'].replace(/{{char}}/gi, charName);
                chat[j]['mes'] = chat[j]['mes'].replace(/<USER>/gi, name1);
                chat[j]['mes'] = chat[j]['mes'].replace(/<BOT>/gi, charName);
            }
            let this_mes_ch_name = '';
            if (chat[j]['is_user']) {
                this_mes_ch_name = name1;
            } else {
                this_mes_ch_name = charName;
            }
            if (chat[j]['is_name']) {
                chat2[i] = this_mes_ch_name + ': ' + chat[j]['mes'] + '\n';
            } else {
                chat2[i] = chat[j]['mes'] + '\n';
            }
            // system messages produce no text
            if (chat[j]['is_system']) {
                chat2[i] = '';
            }

            // replace bias markup
            //chat2[i] = (chat2[i] ?? '').replace(/{.*}/g, '');
            chat2[i] = (chat2[i] ?? '').replace(/{{(\*?.+?\*?)}}/g, '');
            //console.log('replacing chat2 {}s');
            j++;
        }
        console.log('post replace chat.length = ' + chat.length);
        //chat2 = chat2.reverse();
        var this_max_context = 1487;
        if (main_api == 'kobold') this_max_context = max_context;
        if (main_api == 'novel') {
            if (novel_tier === 1) {
                this_max_context = 1024;
            } else {
                this_max_context = 2048 - 60;//fix for fat tokens 
                if (nai_settings.model_novel == 'krake-v2') {
                    this_max_context -= 160;
                }
            }
        }
        if (main_api == 'openai') {
            this_max_context = oai_settings.openai_max_context;
        }
        if (main_api == 'textgenerationwebui') {
            this_max_context = (max_context - amount_gen);
        }

        if (main_api == 'poe') {
            this_max_context = Math.min(Number(max_context), POE_MAX_CONTEXT);
        }

        let hordeAmountGen = null;
        if (main_api == 'kobold' && horde_settings.use_horde && horde_settings.auto_adjust) {
            const adjustedParams = await adjustHordeGenerationParams(this_max_context, amount_gen);
            this_max_context = adjustedParams.maxContextLength;
            hordeAmountGen = adjustedParams.maxLength;
        }

        let { worldInfoString, worldInfoBefore, worldInfoAfter } = getWorldInfoPrompt(chat2);
        let extension_prompt = getExtensionPrompt(extension_prompt_types.AFTER_SCENARIO);
        const zeroDepthAnchor = getExtensionPrompt(extension_prompt_types.IN_CHAT, 0, ' ');

        /////////////////////// swipecode
        if (type == 'swipe') {

            console.log('pre swipe shift: ' + chat2.length);
            console.log('shifting swipe chat2');
            chat2.shift();

        }
        console.log('post swipe shift:' + chat2.length);
        var i = 0;

        // hack for regeneration of the first message
        if (chat2.length == 0) {
            chat2.push('');
        }

        for (var item of chat2) {
            chatString = item + chatString;
            if (encode(JSON.stringify(
                worldInfoString + storyString + chatString +
                anchorTop + anchorBottom +
                charPersonality + promptBias + extension_prompt + zeroDepthAnchor
            )).length + 120 < this_max_context) { //(The number of tokens in the entire promt) need fix, it must count correctly (added +120, so that the description of the character does not hide)
                //if (is_pygmalion && i == chat2.length-1) item='<START>\n'+item;
                arrMes[arrMes.length] = item;
            } else {
                console.log('reducing chat.length by 1');
                i = chat2.length - 1;
            }

            await delay(1); //For disable slow down (encode gpt-2 need fix)
            // console.log(i+' '+chat.length);

            count_exm_add = 0;

            if (i === chat2.length - 1) {
                if (!power_user.pin_examples) {
                    let mesExmString = '';
                    for (let iii = 0; iii < mesExamplesArray.length; iii++) {
                        mesExmString += mesExamplesArray[iii];
                        const prompt = worldInfoString + storyString + mesExmString + chatString + anchorTop + anchorBottom + charPersonality + promptBias + extension_prompt + zeroDepthAnchor;
                        if (encode(JSON.stringify(prompt)).length + 120 < this_max_context) {
                            if (!is_pygmalion) {
                                mesExamplesArray[iii] = mesExamplesArray[iii].replace(/<START>/i, `This is how ${name2} should talk`);
                            }
                            count_exm_add++;
                            await delay(1);
                        } else {
                            iii = mesExamplesArray.length;
                        }
                    }
                }
                if (!is_pygmalion && Scenario && Scenario.length > 0) {
                    if (!storyString.endsWith('\n')) {
                        storyString += '\n';
                    }
                    storyString += !power_user.disable_scenario_formatting ? `Circumstances and context of the dialogue: ${Scenario}\n` : `${Scenario}\n`;
                }
                console.log('calling runGenerate');
                await runGenerate();
                return;
            }
            i++;
        }

        async function runGenerate(cycleGenerationPromt = '') {
            is_send_press = true;

            generatedPromtCache += cycleGenerationPromt;
            if (generatedPromtCache.length == 0) {
                if (main_api === 'openai') {
                    generateOpenAIPromptCache(charPersonality, topAnchorDepth, anchorTop, anchorBottom);
                }

                console.log('generating prompt');
                chatString = "";
                arrMes = arrMes.reverse();
                var is_add_personality = false;
                arrMes.forEach(function (item, i, arr) {//For added anchors and others

                    if (i >= arrMes.length - 1 && $.trim(item).substr(0, (name1 + ":").length) != name1 + ":") {
                        if (textareaText == "") {
                            item = item.substr(0, item.length - 1);
                        }
                    }
                    if (i === arrMes.length - topAnchorDepth && count_view_mes >= topAnchorDepth && !is_add_personality) {

                        is_add_personality = true;
                        //chatString = chatString.substr(0,chatString.length-1);
                        //anchorAndPersonality = "[Genre: roleplay chat][Tone: very long messages with descriptions]";
                        if ((anchorTop != "" || charPersonality != "") && !is_pygmalion) {
                            if (anchorTop != "") charPersonality += ' ';
                            item += "[" + charPersonality + anchorTop + ']\n';
                        }
                    }
                    if (i >= arrMes.length - 1 && count_view_mes > 8 && $.trim(item).substr(0, (name1 + ":").length) == name1 + ":" && !is_pygmalion) {//For add anchor in end
                        item = item.substr(0, item.length - 1);
                        //chatString+=postAnchor+"\n";//"[Writing style: very long messages]\n";
                        item = item + anchorBottom + "\n";
                    }
                    if (is_pygmalion) {
                        if (i >= arrMes.length - 1 && $.trim(item).substr(0, (name1 + ":").length) == name1 + ":") {//for add name2 when user sent
                            item = item + name2 + ":";
                        }
                        if (i >= arrMes.length - 1 && $.trim(item).substr(0, (name1 + ":").length) != name1 + ":") {//for add name2 when continue
                            if (textareaText == "") {
                                item = item + '\n' + name2 + ":";
                            }
                        }
                        if ($.trim(item).indexOf(name1) === 0) {
                            item = item.replace(name1 + ':', 'You:');
                        }
                    }

                    if (i === 0) {
                        // Process those that couldn't get that far
                        for (let upperDepth = 100; upperDepth >= arrMes.length; upperDepth--) {
                            const upperAnchor = getExtensionPrompt(extension_prompt_types.IN_CHAT, upperDepth);
                            if (upperAnchor && upperAnchor.length) {
                                item = upperAnchor + item;
                            }
                        }
                    }

                    const anchorDepth = Math.abs(i - arrMes.length + 1);
                    const extensionAnchor = getExtensionPrompt(extension_prompt_types.IN_CHAT, anchorDepth);

                    if (anchorDepth > 0 && extensionAnchor && extensionAnchor.length) {
                        item += extensionAnchor;
                    }

                    mesSend[mesSend.length] = item;
                });
            }

            let mesSendString = '';
            let mesExmString = '';

            function setPromtString() {
                mesSendString = '';
                mesExmString = '';
                for (let j = 0; j < count_exm_add; j++) {
                    mesExmString += mesExamplesArray[j];
                }
                for (let j = 0; j < mesSend.length; j++) {

                    mesSendString += mesSend[j];
                    if (force_name2 && j === mesSend.length - 1 && tokens_already_generated === 0) {
                        if (!mesSendString.endsWith('\n')) {
                            mesSendString += '\n';
                        }
                        mesSendString += name2 + ':';
                    }
                }
            }

            function checkPromtSize() {

                setPromtString();
                let thisPromtContextSize = encode(JSON.stringify(worldInfoString + storyString + mesExmString + mesSendString + anchorTop + anchorBottom + charPersonality + generatedPromtCache + promptBias + extension_prompt + zeroDepthAnchor)).length + 120;

                if (thisPromtContextSize > this_max_context) {		//if the prepared prompt is larger than the max context size...

                    if (count_exm_add > 0) {							// ..and we have example mesages..
                        //console.log('Context size: '+thisPromtContextSize+' -- too big, removing example message');
                        //mesExamplesArray.length = mesExamplesArray.length-1;
                        count_exm_add--;							// remove the example messages...
                        checkPromtSize();							// and try agin...
                    } else if (mesSend.length > 0) {					// if the chat history is longer than 0
                        //console.log('Context size: '+thisPromtContextSize+' -- too big, removing oldest chat message');
                        mesSend.shift();							// remove the first (oldest) chat entry..
                        checkPromtSize();							// and check size again..
                    } else {
                        //end
                    }
                }
            }

            if (generatedPromtCache.length > 0) {
                //console.log('Generated Prompt Cache length: '+generatedPromtCache.length);
                checkPromtSize();
            } else {
                console.log('calling setPromtString')
                setPromtString();
            }

            // add a custom dingus (if defined)
            if (power_user.custom_chat_separator && power_user.custom_chat_separator.length) {
                mesSendString = power_user.custom_chat_separator + '\n' + mesSendString;
            }
            // add non-pygma dingus
            else if (!is_pygmalion) {
                mesSendString = '\nThen the roleplay chat between ' + name1 + ' and ' + name2 + ' begins.\n' + mesSendString;
            }
            // add pygma <START>
            else {
                mesSendString = '<START>\n' + mesSendString;
                //mesSendString = mesSendString; //This edit simply removes the first "<START>" that is prepended to all context prompts
            }
            finalPromt = worldInfoBefore + storyString + worldInfoAfter + extension_prompt + mesExmString + mesSendString + generatedPromtCache + promptBias;

            if (zeroDepthAnchor && zeroDepthAnchor.length) {
                if (!isMultigenEnabled() || tokens_already_generated == 0) {
                    const trimBothEnds = !force_name2 && !is_pygmalion;
                    let trimmedPrompt = (trimBothEnds ? zeroDepthAnchor.trim() : zeroDepthAnchor.trimEnd());

                    if (trimBothEnds && !finalPromt.endsWith('\n')) {
                        finalPromt += '\n';
                    }

                    finalPromt += trimmedPrompt;

                    if (force_name2 || is_pygmalion) {
                        finalPromt += ' ';
                    }
                }
            }

            finalPromt = finalPromt.replace(/\r/gm, '');

            if (power_user.collapse_newlines) {
                finalPromt = collapseNewlines(finalPromt);
            }

            //console.log('final prompt decided');
            let this_amount_gen = parseInt(amount_gen); // how many tokens the AI will be requested to generate
            let this_settings = koboldai_settings[koboldai_setting_names[preset_settings]];

            if (isMultigenEnabled()) {
                if (tokens_already_generated === 0) { // if nothing has been generated yet..
                    if (parseInt(amount_gen) >= 50) { // if the max gen setting is > 50...(
                        this_amount_gen = 50; // then only try to make 50 this cycle..
                    }
                    else {
                        this_amount_gen = parseInt(amount_gen); // otherwise, make as much as the max amount request.
                    }
                }
                else { // if we already recieved some generated text...
                    if (parseInt(amount_gen) - tokens_already_generated < tokens_cycle_count) { // if the remaining tokens to be made is less than next potential cycle count
                        this_amount_gen = parseInt(amount_gen) - tokens_already_generated; // subtract already generated amount from the desired max gen amount
                    }
                    else {
                        this_amount_gen = tokens_cycle_count; // otherwise make the standard cycle amont (frist 50, and 30 after that)
                    }
                }
            }

            if (main_api == 'kobold' && horde_settings.use_horde && hordeAmountGen) {
                this_amount_gen = Math.min(this_amount_gen, hordeAmountGen);
            }

            var generate_data;
            if (main_api == 'kobold') {
                var generate_data = {
                    prompt: finalPromt,
                    gui_settings: true,
                    max_length: amount_gen,
                    temperature: kai_settings.temp,
                    max_context_length: max_context,
                    singleline: kai_settings.single_line,
                };

                if (preset_settings != 'gui' || horde_settings.use_horde) {
                    generate_data = getKoboldGenerationData(finalPromt, this_settings, this_amount_gen, this_max_context);
                }
            }

            if (main_api == 'textgenerationwebui') {
                var generate_data = {
                    data: [
                        finalPromt,
                        this_amount_gen, // max new tokens
                        textgenerationwebui_settings.do_sample, // do_sample
                        textgenerationwebui_settings.temp, // temperature
                        textgenerationwebui_settings.top_p, // top_p
                        textgenerationwebui_settings.typical_p, // typical_p
                        textgenerationwebui_settings.rep_pen, // repetition_penalty
                        textgenerationwebui_settings.encoder_rep_pen, // encoder rep pen
                        textgenerationwebui_settings.top_k, // top_k
                        textgenerationwebui_settings.min_length, // min_length
                        textgenerationwebui_settings.no_repeat_ngram_size, // no_repeat_ngram_size
                        textgenerationwebui_settings.num_beams, // num_beams
                        textgenerationwebui_settings.penalty_alpha, // penalty_alpha
                        textgenerationwebui_settings.length_penalty, // length_penalty
                        textgenerationwebui_settings.early_stopping, // early_stopping
                        textgenerationwebui_settings.seed, // seed
                        name1, // name1
                        name2, // name2
                        "",  // Context
                        true, // stop at newline
                        this_max_context, // Maximum prompt size in tokens
                        1, // num attempts
                    ]
                };
            }

            if (main_api == 'novel') {
                const this_settings = novelai_settings[novelai_setting_names[nai_settings.preset_settings_novel]];
                generate_data = {
                    "input": finalPromt,
                    "model": nai_settings.model_novel,
                    "use_string": true,
                    "temperature": parseFloat(nai_settings.temp_novel),
                    "max_length": this_settings.max_length,
                    "min_length": this_settings.min_length,
                    "tail_free_sampling": this_settings.tail_free_sampling,
                    "repetition_penalty": parseFloat(nai_settings.rep_pen_novel),
                    "repetition_penalty_range": parseInt(nai_settings.rep_pen_size_novel),
                    "repetition_penalty_frequency": this_settings.repetition_penalty_frequency,
                    "repetition_penalty_presence": this_settings.repetition_penalty_presence,
                    //"stop_sequences": {{187}},
                    //bad_words_ids = {{50256}, {0}, {1}};
                    //generate_until_sentence = true;
                    "use_cache": false,
                    //use_string = true;
                    "return_full_text": false,
                    "prefix": "vanilla",
                    "order": this_settings.order
                };
            }

            var generate_url = '';
            if (main_api == 'kobold') {
                generate_url = '/generate';
            } else if (main_api == 'textgenerationwebui') {
                generate_url = '/generate_textgenerationwebui';
            } else if (main_api == 'novel') {
                generate_url = '/generate_novelai';
            }
            console.log('rungenerate calling API');


            if (main_api == 'openai') {
                let prompt = await prepareOpenAIMessages(name2, storyString, worldInfoBefore, worldInfoAfter, extension_prompt, promptBias);
                sendOpenAIRequest(prompt).then(onSuccess).catch(onError);
            }
            else if (main_api == 'kobold' && horde_settings.use_horde) {
                generateHorde(finalPromt, generate_data).then(onSuccess).catch(onError);
            }
            else if (main_api == 'poe') {
                generatePoe(finalPromt).then(onSuccess).catch(onError);
            }
            else {
                jQuery.ajax({
                    type: 'POST', // 
                    url: generate_url, // 
                    data: JSON.stringify(generate_data),
                    beforeSend: function () {
                        //$('#create_button').attr('value','Creating...'); 
                    },
                    cache: false,
                    dataType: "json",
                    contentType: "application/json",
                    success: onSuccess,
                    error: onError
                }); //end of "if not data error"
            }

            function onSuccess(data) {
                tokens_already_generated += this_amount_gen;			// add new gen amt to any prev gen counter..

                is_send_press = false;
                if (!data.error) {
                    //const getData = await response.json();
                    var getMessage = "";
                    if (main_api == 'kobold' && !horde_settings.use_horde) {
                        getMessage = data.results[0].text;
                    }
                    else if (main_api == 'kobold' && horde_settings.use_horde) {
                        getMessage = data;
                    }
                    else if (main_api == 'textgenerationwebui') {
                        getMessage = data.data[0];
                        if (getMessage == null || data.error) {
                            activateSendButtons();
                            callPopup('<h3>Got empty response from Text generation web UI. Try restarting the API with recommended options.</h3>', 'text');
                            return;
                        }
                        getMessage = getMessage.substring(finalPromt.length);
                    }
                    else if (main_api == 'novel') {
                        getMessage = data.output;
                    }
                    if (main_api == 'openai' || main_api == 'poe') {
                        getMessage = data;
                    }

                    if (power_user.collapse_newlines) {
                        getMessage = collapseNewlines(getMessage);
                    }

                    //Pygmalion run again
                    // to make it continue generating so long as it's under max_amount and hasn't signaled
                    // an end to the character's response via typing "You:" or adding "<endoftext>"
                    if (isMultigenEnabled()) {
                        if_typing_text = false;
                        message_already_generated += getMessage;
                        promptBias = '';
                        if (message_already_generated.indexOf('You:') === -1 &&             //if there is no 'You:' in the response msg
                            message_already_generated.indexOf('<|endoftext|>') === -1 &&    //if there is no <endoftext> stamp in the response msg
                            tokens_already_generated < parseInt(amount_gen) &&              //if the gen'd msg is less than the max response length..
                            getMessage.length > 0) {                                        //if we actually have gen'd text at all... 
                            runGenerate(getMessage);
                            console.log('returning to make generate again');            //generate again with the 'GetMessage' argument..
                            return;
                        }

                        getMessage = message_already_generated;
                    }

                    //Formating
                    getMessage = $.trim(getMessage);
                    if (is_pygmalion) {
                        getMessage = getMessage.replace(/<USER>/g, name1);
                        getMessage = getMessage.replace(/<BOT>/g, name2);
                        getMessage = getMessage.replace(/You:/g, name1 + ':');
                    }
                    if (getMessage.indexOf(name1 + ":") != -1) {
                        getMessage = getMessage.substr(0, getMessage.indexOf(name1 + ":"));

                    }
                    if (getMessage.indexOf('<|endoftext|>') != -1) {
                        getMessage = getMessage.substr(0, getMessage.indexOf('<|endoftext|>'));

                    }
                    // clean-up group message from excessive generations
                    if (selected_group) {
                        getMessage = cleanGroupMessage(getMessage);
                    }
                    let this_mes_is_name = true;
                    if (getMessage.indexOf(name2 + ":") === 0) {
                        getMessage = getMessage.replace(name2 + ':', '');
                        getMessage = getMessage.trimStart();
                    } else {
                        this_mes_is_name = false;
                    }
                    if (force_name2) this_mes_is_name = true;
                    //getMessage = getMessage.replace(/^\s+/g, '');
                    if (getMessage.length > 0) {
                        ({ type, getMessage } = saveReply(type, getMessage, this_mes_is_name));
                        generate_loop_counter = 0;
                    } else {
                        ++generate_loop_counter;

                        if (generate_loop_counter > MAX_GENERATION_LOOPS) {
                            callPopup(`Could not extract reply in ${MAX_GENERATION_LOOPS} attempts. Try generating again`, 'text');
                            generate_loop_counter = 0;
                            $("#send_textarea").removeAttr('disabled');
                            is_send_press = false;
                            activateSendButtons();
                            setGenerationProgress(0);
                            showSwipeButtons();
                            $('.mes_edit:last').show();
                            throw new Error('Generate circuit breaker interruption');
                        }

                        // regenerate with character speech reenforced
                        // to make sure we leave on swipe type while also adding the name2 appendage
                        setTimeout(() => {
                            const newType = type == "swipe" ? "swipe" : "force_name2";
                            Generate(newType, automatic_trigger = false, force_name2 = true);
                        }, generate_loop_counter * 1000);
                    }
                } else {
                    activateSendButtons();
                    //console.log('runGenerate calling showSwipeBtns');
                    showSwipeButtons();
                }
                console.log('/savechat called by /Generate');

                saveChatConditional();

                activateSendButtons();
                showSwipeButtons();
                setGenerationProgress(0);
                $('.mes_edit:last').show();
            };

            function onError(jqXHR, exception) {
                $("#send_textarea").removeAttr('disabled');
                is_send_press = false;
                activateSendButtons();
                setGenerationProgress(0);
                console.log(exception);
                console.log(jqXHR);
            };

        } //rungenerate ends
    } else {    //generate's primary loop ends, after this is error handling for no-connection or safety-id

        if (this_chid == undefined || this_chid == 'invalid-safety-id') {
            //send ch sel
            popup_type = 'char_not_selected';
            callPopup('<h3>Сharacter is not selected</h3>');
        }
        is_send_press = false;
    }
    console.log('generate ending');
} //generate ends

function saveReply(type, getMessage, this_mes_is_name) {
    if (chat.length && (chat[chat.length - 1]['swipe_id'] === undefined ||
        chat[chat.length - 1]['is_user'])) {
        type = 'normal';
    }

    if (type === 'swipe') {
        chat[chat.length - 1]['swipes'][chat[chat.length - 1]['swipes'].length] = getMessage;
        if (chat[chat.length - 1]['swipe_id'] === chat[chat.length - 1]['swipes'].length - 1) {
            //console.log(getMessage);
            chat[chat.length - 1]['mes'] = getMessage;
            // console.log('runGenerate calls addOneMessage for swipe');
            addOneMessage(chat[chat.length - 1], 'swipe');
        } else {
            chat[chat.length - 1]['mes'] = getMessage;
        }
        is_send_press = false;
    } else {
        console.log('entering chat update routine for non-swipe post');
        is_send_press = false;
        chat[chat.length] = {};
        chat[chat.length - 1]['name'] = name2;
        chat[chat.length - 1]['is_user'] = false;
        chat[chat.length - 1]['is_name'] = this_mes_is_name;
        chat[chat.length - 1]['send_date'] = humanizedDateTime();
        getMessage = $.trim(getMessage);
        chat[chat.length - 1]['mes'] = getMessage;

        if (selected_group) {
            console.log('entering chat update for groups');
            let avatarImg = 'img/ai4.png';
            if (characters[this_chid].avatar != 'none') {
                avatarImg = `/thumbnail?type=avatar&file=${encodeURIComponent(characters[this_chid].avatar)}&${Date.now()}`;
            }
            chat[chat.length - 1]['is_name'] = true;
            chat[chat.length - 1]['force_avatar'] = avatarImg;
        }
        //console.log('runGenerate calls addOneMessage');
        addOneMessage(chat[chat.length - 1]);

        activateSendButtons();
    }
    return { type, getMessage };
}

function isMultigenEnabled() {
    return power_user.multigen && (main_api == 'textgenerationwebui' || main_api == 'kobold' || main_api == 'novel');
}

function activateSendButtons() {
    is_send_press = false;
    $("#send_but").css("display", "inline");
    $("#loading_mes").css("display", "none");
}

function deactivateSendButtons() {
    $("#send_but").css("display", "none");
    $("#loading_mes").css("display", "inline-block");
}

function resetChatState() {
    active_character = "invalid-safety-id"; //unsets the chid in settings (this prevents AutoLoadChat from trying to load the wrong ChID
    this_chid = "invalid-safety-id"; //unsets expected chid before reloading (related to getCharacters/printCharacters from using old arrays)
    name2 = systemUserName; // replaces deleted charcter name with system user since it will be displayed next.
    chat = [...safetychat]; // sets up system user to tell user about having deleted a character
    characters.length = 0; // resets the characters array, forcing getcharacters to reset
}

function setCharacterId(value) {
    this_chid = value;
}

function setCharacterName(value) {
    name2 = value;
}

function setOnlineStatus(value) {
    online_status = value;
}

function setEditedMessageId(value) {
    this_edit_mes_id = value;
}

function setSendButtonState(value) {
    is_send_press = value;
}

function resultCheckStatusNovel() {
    is_api_button_press_novel = false;
    checkOnlineStatus();
    $("#api_loading_novel").css("display", "none");
    $("#api_button_novel").css("display", "inline-block");
}

async function saveChat(chat_name) {
    let file_name = chat_name ?? characters[this_chid].chat;
    chat.forEach(function (item, i) {
        if (item["is_group"]) {
            alert('Trying to save group chat with regular saveChat function. Aborting to prevent corruption.');
            throw new Error('Group chat saved from saveChat');
        }
        if (item.is_user) {
            var str = item.mes.replace(`${name1}:`, `${default_user_name}:`);
            chat[i].mes = str;
            chat[i].name = default_user_name;
        } else if (i !== chat.length - 1 && chat[i].swipe_id !== undefined) {
          //  delete chat[i].swipes;
          //  delete chat[i].swipe_id;
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
            file_name: file_name,
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

function read_avatar_load(input) {
    if (input.files && input.files[0]) {
        const reader = new FileReader();
        if (selected_button == "create") {
            create_save_avatar = input.files;
        }
        reader.onload = function (e) {
            if (selected_button == "character_edit") {
                saveCharacterDebounced();
            }
            $("#avatar_load_preview").attr("src", e.target.result);
            //.width(103)
            //.height(83);
            //console.log(e.target.result.name);
        };

        reader.readAsDataURL(input.files[0]);
    }
}

async function getChat() {
    //console.log('/getchat -- entered for -- ' + characters[this_chid].name);
    try {
        const response = await $.ajax({
            type: 'POST',
            url: '/getchat',
            data: JSON.stringify({
                ch_name: characters[this_chid].name,
                file_name: characters[this_chid].chat,
                avatar_url: characters[this_chid].avatar
            }),
            dataType: 'json',
            contentType: 'application/json',
        });
        if (response[0] !== undefined) {
            chat.push(...response);
            chat_create_date = chat[0]['create_date'];
            chat.shift();
        } else {
            chat_create_date = humanizedDateTime();
        }
        getChatResult();
        saveChat();
    } catch (error) {
        getChatResult();
        console.log(error);
    }
}

function getChatResult() {
    name2 = characters[this_chid].name;
    if (chat.length > 1) {
        for (let i = 0; i < chat.length; i++) {
            const item = chat[i];
            if (item["is_user"]) {
                item['mes'] = item['mes'].replace(default_user_name + ':', name1 + ':');
                item['name'] = name1;
            }
        }
    } else {
        const firstMes = characters[this_chid].first_mes || default_ch_mes;
        chat[0] = {
            name: name2,
            is_user: false,
            is_name: true,
            send_date: humanizedDateTime(),
            mes: firstMes
        };
    }
    printMessages();
    select_selected_character(this_chid);
}

async function openCharacterChat(file_name) {
    characters[this_chid]["chat"] = file_name;
    clearChat();
    chat.length = 0;
    await getChat();
    $("#selected_chat_pole").val(file_name);
    $("#create_button").click();
    $("#shadow_select_chat_popup").css("display", "none");
    $("#load_select_chat_div").css("display", "block");
}

/* function openNavToggle() {
    if (!$("#nav-toggle").prop("checked")) {
        $("#nav-toggle").trigger("click");
    }
} */

////////// OPTIMZED MAIN API CHANGE FUNCTION ////////////

function changeMainAPI() {
    const selectedVal = $("#main_api").val();
    //console.log(selectedVal);
    const apiElements = {
        "kobold": {
            apiSettings: $("#kobold_api-settings"),
            apiConnector: $("#kobold_api"),
            apiPresets: $('#kobold_api-presets'),
            apiRanges: $("#range_block"),
            maxContextElem: $("#max_context_block"),
            amountGenElem: $("#amount_gen_block"),
            softPromptElem: $("#softprompt_block")
        },
        "textgenerationwebui": {
            apiSettings: $("#textgenerationwebui_api-settings"),
            apiConnector: $("#textgenerationwebui_api"),
            apiPresets: $('#textgenerationwebui_api-presets'),
            apiRanges: $("#range_block_textgenerationwebui"),
            maxContextElem: $("#max_context_block"),
            amountGenElem: $("#amount_gen_block"),
            softPromptElem: $("#softprompt_block")
        },
        "novel": {
            apiSettings: $("#novel_api-settings"),
            apiConnector: $("#novel_api"),
            apiPresets: $('#novel_api-presets'),
            apiRanges: $("#range_block_novel"),
            maxContextElem: $("#max_context_block"),
            amountGenElem: $("#amount_gen_block"),
            softPromptElem: $("#softprompt_block")
        },
        "openai": {
            apiSettings: $("#openai_settings"),
            apiConnector: $("#openai_api"),
            apiPresets: $('#openai_api-presets'),
            apiRanges: $("#range_block_openai"),
            maxContextElem: $("#max_context_block"),
            amountGenElem: $("#amount_gen_block"),
            softPromptElem: $("#softprompt_block"),
        },
        "poe": {
            apiSettings: $("#poe_settings"),
            apiConnector: $("#poe_api"),
            apiPresets: $(""),
            apiRanges: $(""),
            maxContextElem: $("#max_context_block"),
            amountGenElem: $("#amount_gen_block"),
            softPromptElem: $("#softprompt_block"),
        }
    };
    //console.log('--- apiElements--- ');
    //console.log(apiElements);

    for (const apiName in apiElements) {
        const apiObj = apiElements[apiName];
        const isCurrentApi = selectedVal === apiName;

        apiObj.apiSettings.css("display", isCurrentApi ? "block" : "none");
        apiObj.apiConnector.css("display", isCurrentApi ? "block" : "none");
        apiObj.apiRanges.css("display", isCurrentApi ? "block" : "none");
        apiObj.apiPresets.css("display", isCurrentApi ? "block" : "none");

        if (isCurrentApi && apiName === "openai") {
            apiObj.apiPresets.css("display", "flex");
        }

        if (isCurrentApi && apiName === "kobold") {
            //console.log("enabling SP for kobold");
            $("#softprompt_block").css("display", "block");
        }

        if (isCurrentApi && (apiName === "textgenerationwebui" || apiName === "novel")) {
            console.log("enabling amount_gen for ooba/novel");
            apiObj.amountGenElem.find('input').prop("disabled", false);
            apiObj.amountGenElem.css("opacity", 1.0);
        }

        // Hide common settings for OpenAI
        if (selectedVal == "openai") {
            $("#common-gen-settings-block").css("display", "none");
        } else {
            $("#common-gen-settings-block").css("display", "block");
        }

    }

    main_api = selectedVal;
    online_status = "no_connection";

    if (main_api == "kobold" && horde_settings.use_horde) {
        is_get_status = true;
        getStatus();
    }
}

////////////////////////////////////////////////////

async function getUserAvatars() {
    $("#user_avatar_block").html(""); //RossAscends: necessary to avoid doubling avatars each refresh.
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

                novelai_setting_names = data.novelai_setting_names;
                novelai_settings = data.novelai_settings;
                novelai_settings.forEach(function (item, i, arr) {
                    novelai_settings[i] = JSON.parse(item);
                });
                let arr_holder = {};

                $("#settings_perset_novel").empty();

                novelai_setting_names.forEach(function (item, i, arr) {
                    arr_holder[item] = i;
                    $("#settings_perset_novel").append(`<option value=${i}>${item}</option>`);
                });
                novelai_setting_names = {};
                novelai_setting_names = arr_holder;

                nai_settings.preset_settings_novel = settings.preset_settings_novel;
                $(
                    `#settings_perset_novel option[value=${novelai_setting_names[nai_settings.preset_settings_novel]}]`
                ).attr("selected", "true");

                //Load KoboldAI settings
                koboldai_setting_names = data.koboldai_setting_names;
                koboldai_settings = data.koboldai_settings;
                koboldai_settings.forEach(function (item, i, arr) {
                    koboldai_settings[i] = JSON.parse(item);
                });

                arr_holder = {};

                $("#settings_perset").empty(); //RossAscends: uncommented this to prevent settings selector from doubling preset list on refresh
                $("#settings_perset").append(
                    '<option value="gui">GUI KoboldAI Settings</option>'
                ); //adding in the GUI settings, since it is not loaded dynamically

                koboldai_setting_names.forEach(function (item, i, arr) {
                    arr_holder[item] = i;
                    $("#settings_perset").append(`<option value=${i}>${item}</option>`);
                    //console.log('loading preset #'+i+' -- '+item);
                });
                koboldai_setting_names = {};
                koboldai_setting_names = arr_holder;
                preset_settings = settings.preset_settings;

                //Load AI model config settings (temp, context length, anchors, and anchor order)

                amount_gen = settings.amount_gen;
                if (settings.max_context !== undefined)
                    max_context = parseInt(settings.max_context);
                if (settings.anchor_order !== undefined)
                    anchor_order = parseInt(settings.anchor_order);
                if (settings.style_anchor !== undefined)
                    style_anchor = !!settings.style_anchor;
                if (settings.character_anchor !== undefined)
                    character_anchor = !!settings.character_anchor;

                $("#style_anchor").prop("checked", style_anchor);
                $("#character_anchor").prop("checked", character_anchor);
                $("#anchor_order option[value=" + anchor_order + "]").attr(
                    "selected",
                    "true"
                );

                $("#max_context").val(max_context);
                $("#max_context_counter").text(`${max_context} Tokens`);

                $("#amount_gen").val(amount_gen);
                $("#amount_gen_counter").text(`${amount_gen} Tokens`);

                swipes = !!settings.swipes;  //// swipecode
                $('#swipes-checkbox').prop('checked', swipes); /// swipecode
                //console.log('getSettings -- swipes = ' + swipes + '. toggling box');
                hideSwipeButtons();
                //console.log('getsettings calling showswipebtns');
                showSwipeButtons();

                // Kobold
                loadKoboldSettings(settings);

                // Novel
                loadNovelSettings(settings);

                // TextGen
                loadTextGenSettings(data, settings);

                // OpenAI
                loadOpenAISettings(data, settings);

                // Horde
                loadHordeSettings(settings);

                // Poe
                loadPoeSettings(settings);

                // Load power user settings
                loadPowerUserSettings(settings);


                //Enable GUI deference settings if GUI is selected for Kobold
                if (main_api === "kobold") {
                    if (preset_settings == "gui") {
                        $("#settings_perset option[value=gui]")
                            .attr("selected", "true")
                            .trigger("change");
                    } else {
                        if (typeof koboldai_setting_names[preset_settings] !== "undefined") {
                            $(`#settings_perset option[value=${koboldai_setting_names[preset_settings]}]`)
                                .attr("selected", "true");
                        } else {
                            preset_settings = "gui";
                            $("#settings_perset option[value=gui]")
                                .attr("selected", "true")
                                .trigger("change");
                        }
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

                setWorldInfoSettings(settings, data);

                if (data.enable_extensions) {
                    const src = "scripts/extensions.js";
                    if ($(`script[src="${src}"]`).length === 0) {
                        const script = document.createElement("script");
                        script.type = "module";
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

                selected_button = settings.selected_button;
            }

            if (!is_checked_colab) isColab();
        },
        error: function (jqXHR, exception) {
            console.log(exception);
            console.log(jqXHR);
        },
    });
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
            user_avatar: user_avatar,
            amount_gen: amount_gen,
            max_context: max_context,
            anchor_order: anchor_order,
            style_anchor: style_anchor,
            character_anchor: character_anchor,
            main_api: main_api,
            world_info: world_info,
            world_info_depth: world_info_depth,
            world_info_budget: world_info_budget,
            active_character: active_character,
            textgenerationwebui_settings: textgenerationwebui_settings,
            swipes: swipes,
            horde_settings: horde_settings,
            power_user: power_user,
            poe_settings: poe_settings,
            ...nai_settings,
            ...kai_settings,
            ...oai_settings,
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


                clearChat();
                printMessages();
            }
        },
        error: function (jqXHR, exception) {
            console.log(exception);
            console.log(jqXHR);
        },
    });
}

function isInt(value) {
    return (
        !isNaN(value) &&
        parseInt(Number(value)) == value &&
        !isNaN(parseInt(value, 10))
    );
}

function messageEditDone(div) {
    let mesBlock = div.closest(".mes_block");
    var text = mesBlock.find(".edit_textarea").val().trim();
    const bias = extractMessageBias(text);
    chat[this_edit_mes_id]["mes"] = text;

    // editing old messages
    if (!chat[this_edit_mes_id]["extra"]) {
        chat[this_edit_mes_id]["extra"] = {};
    }

    chat[this_edit_mes_id]["extra"]["bias"] = bias ?? null;

    mesBlock.find(".mes_text").empty();
    mesBlock.find(".mes_edit_buttons").css("display", "none");
    mesBlock.find(".mes_edit").css("display", "inline-block");
    mesBlock.find(".mes_text").append(messageFormating(text, this_edit_mes_chname, chat[this_edit_mes_id].is_system, chat[this_edit_mes_id].force_avatar));
    mesBlock.find(".mes_bias").empty();
    mesBlock.find(".mes_bias").append(messageFormating(bias));
    appendImageToMessage(chat[this_edit_mes_id], div.closest(".mes"));
    this_edit_mes_id = undefined;
    saveChatConditional();
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
            $("#ChatHistoryCharName").html(characters[this_chid].name);
            for (const key in data) {
                let strlen = 300;
                let mes = data[key]["mes"];
                if (mes !== undefined) {
                    if (mes.length > strlen) {
                        mes = "..." + mes.substring(mes.length - strlen);
                    }
                    $("#select_chat_div").append(
                        '<div class="select_chat_block_wrapper">' +
                        '<div class="select_chat_block" file_name="' + data[key]["file_name"] + '">' +
                        '<div class=avatar><img src="characters/' + characters[this_chid]["avatar"] + '""></div >' +
                        '<div class="select_chat_block_filename">' + data[key]["file_name"] + '</div>' +
                        '<div class="select_chat_block_mes">' +
                        mes +
                        "</div>" +
                        "</div >" +
                        '<div file_name="' + data[key]["file_name"] + '" class="PastChat_cross"></div>' +
                        '</div>'


                    );
                    if (
                        characters[this_chid]["chat"] ==
                        data[key]["file_name"].replace(".jsonl", "")
                    ) {
                        //children().last()
                        $("#select_chat_div")
                            .find(".select_chat_block:last")
                            .attr("highlight", true);
                    }
                }
            }
        },
        error: function (jqXHR, exception) {

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
        const data = { key: nai_settings.api_key_novel };

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
                    novel_tier = data.tier;
                    online_status = getNovelTier(novel_tier);
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
        if (is_get_status != true && is_get_status_openai != true && is_get_status_poe != true) {
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

function selectRightMenuWithAnimation(selectedMenuId) {
    const displayModes = {
        'rm_info_block': 'flex',
        'rm_group_chats_block': 'flex',
        'rm_api_block': 'grid',
        'rm_characters_block': 'flex',
    };
    document.querySelectorAll('#right-nav-panel .right_menu').forEach((menu) => {
        $(menu).css('display', 'none');

        if (selectedMenuId && selectedMenuId.replace('#', '') === menu.id) {
            const mode = displayModes[menu.id] ?? 'block';
            $(menu).css('display', mode);
            $(menu).css("opacity", 0.0);
            $(menu).transition({
                opacity: 1.0,
                duration: animation_rm_duration,
                easing: animation_rm_easing,
                complete: function () { },
            });
        }
    })
}

function setRightTabSelectedClass(selectedButtonId) {
    document.querySelectorAll('#right-nav-panel-tabs .right_menu_button').forEach((button) => {
        button.classList.remove('selected-right-tab');

        if (selectedButtonId && selectedButtonId.replace('#', '') === button.id) {
            button.classList.add('selected-right-tab');
        }
    });
}

function select_rm_info(text, charId = null) {
    $("#rm_info_text").html("<h3>" + text + "</h3>");

    selectRightMenuWithAnimation('rm_info_block');
    setRightTabSelectedClass();

    prev_selected_char = charId;

    if (prev_selected_char) {
        const newId = characters.findIndex((x) => x.name == prev_selected_char);
        if (newId >= 0) {
            this_chid = newId;
        }
    }
}

function select_selected_character(chid) {
    //character select
    //console.log('select_selected_character() -- starting with input of -- '+chid+' (name:'+characters[chid].name+')');
    select_rm_create();
    menu_type = "character_edit";
    $("#delete_button").css("display", "block");
    $("#export_button").css("display", "block");
    setRightTabSelectedClass('rm_button_selected_ch');
    var display_name = characters[chid].name;

    //create text poles
    $("#rm_button_back").css("display", "none");
    //$("#character_import_button").css("display", "none");
    $("#create_button").attr("value", "Save");              // what is the use case for this?
    $("#create_button_label").css("display", "none");

    $("#rm_button_selected_ch").children("h2").text(display_name);
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
        this_avatar = "/thumbnail?type=avatar&file=" + encodeURIComponent(characters[chid].avatar);
    }
    $("#avatar_load_preview").attr("src", this_avatar + "&" + Date.now());
    $("#name_div").css("display", "none");

    $("#form_create").attr("actiontype", "editcharacter");
    active_character = chid;
    //console.log('select_selected_character() -- active_character -- '+chid+'(ChID of '+display_name+')');
    saveSettingsDebounced();
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

    selectRightMenuWithAnimation('rm_ch_create_block');
    setRightTabSelectedClass();

    $("#delete_button_div").css("display", "none");
    $("#delete_button").css("display", "none");
    $("#export_button").css("display", "none");
    $("#create_button_label").css("display", "block");
    $("#create_button").attr("value", "Create");
    //RossAscends: commented this out as part of the auto-loading token counter
    //$('#result_info').html('&nbsp;');

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
    $("#avatar_div").css("display", "flex");
    $("#avatar_load_preview").attr("src", default_avatar);
    $("#name_div").css("display", "block");

    $("#form_create").attr("actiontype", "createcharacter");
}

function select_rm_characters() {
    restoreSelectedCharacter();

    menu_type = "characters";
    selectRightMenuWithAnimation('rm_characters_block');
    setRightTabSelectedClass('rm_button_characters');
}

function restoreSelectedCharacter() {
    if (prev_selected_char) {
        let newChId = characters.findIndex((x) => x.name == prev_selected_char);
        $(`.character_select[chid="${newChId}"]`).trigger("click");
        prev_selected_char = null;
    }
}

function setExtensionPrompt(key, value, position, depth) {
    extension_prompts[key] = { value, position, depth };
}

function callPopup(text, type) {
    if (type) {
        popup_type = type;
    }

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
        case "del_chat":
        default:
            $("#dialogue_popup_ok").text("Delete");
    }

    $("#dialogue_popup_input").val('');
    if (popup_type == 'input') {
        $("#dialogue_popup_input").css("display", "block");
        $("#dialogue_popup_ok").text("Save");
    }
    else {
        $("#dialogue_popup_input").css("display", "none");
    }

    $("#dialogue_popup_text").html(text);
    $("#shadow_popup").css("display", "block");
    if (popup_type == 'input') {
        $("#dialogue_popup_input").focus();
    }
    $("#shadow_popup").transition({
        opacity: 1.0,
        duration: animation_rm_duration,
        easing: animation_rm_easing,
    });

    return new Promise((resolve) => {
        dialogueResolve = resolve;
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
                        `<div class=bg_example bgfile="${html}" style="background-image: url('/thumbnail?type=bg&file=${encodeURIComponent(html)}');">
                            <img class=bg_example_cross src="img/cross.png">
                        </div>`
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

function showSwipeButtons() {
    if (
        chat[chat.length - 1].is_system ||
        !swipes ||
        $('.mes:last').attr('mesid') <= 0 ||
        chat[chat.length - 1].is_user ||
        count_view_mes <= 1 ||
        (selected_group && is_group_generating)
    ) { return; }

    //had to add this to make the swipe counter work
    //(copied from the onclick functions for swipe buttons..
    //don't know why the array isn't set for non-swipe messsages in Generate or addOneMessage..)

    if (chat[chat.length - 1]['swipe_id'] === undefined) {              // if there is no swipe-message in the last spot of the chat array
        chat[chat.length - 1]['swipe_id'] = 0;                        // set it to id 0
        chat[chat.length - 1]['swipes'] = [];                         // empty the array
        chat[chat.length - 1]['swipes'][0] = chat[chat.length - 1]['mes'];  //assign swipe array with last message from chat
    }

    const currentMessage = $("#chat").children().filter(`[mesid="${count_view_mes - 1}"]`);
    const swipeId = chat[chat.length - 1].swipe_id;
    var swipesCounterHTML = (`${(swipeId + 1)}/${(chat[chat.length - 1].swipes.length)}`);

    if (swipeId !== undefined && swipeId != 0) {
        currentMessage.children('.swipe_left').css('display', 'flex');
    }
    if (is_send_press === false || chat[chat.length - 1].swipes.length >= swipeId) {     //only show right when generate is off, or when next right swipe would not make a generate happen
        currentMessage.children('.swipe_right').css('display', 'flex');
        currentMessage.children('.swipe_right').css('opacity', '0.3');
    }
    //console.log((chat[chat.length - 1]));
    if ((chat[chat.length - 1].swipes.length - swipeId) === 1) {
        //console.log('highlighting R swipe');
        currentMessage.children('.swipe_right').css('opacity', '0.7');
    }
    //console.log(swipesCounterHTML);

    $(".swipes-counter").html(swipesCounterHTML);

    //console.log(swipeId);
    //console.log(chat[chat.length - 1].swipes.length);
}

function hideSwipeButtons() {
    //console.log('hideswipebuttons entered');
    $("#chat").children().filter('[mesid="' + (count_view_mes - 1) + '"]').children('.swipe_right').css('display', 'none');
    $("#chat").children().filter('[mesid="' + (count_view_mes - 1) + '"]').children('.swipe_left').css('display', 'none');
}

function saveChatConditional() {
    if (selected_group) {
        saveGroupChat(selected_group);
    }
    else {
        saveChat();
    }
}

function updateViewMessageIds() {
    $('#chat').find(".mes").each(function (index, element) {
        $(element).attr("mesid", index);
    });

    $('#chat .mes').removeClass('last_mes');
    $('#chat .mes').last().addClass('last_mes');

    updateEditArrowClasses();
}

function updateEditArrowClasses() {
    $("#chat .mes .mes_edit_up").removeClass("disabled");
    $("#chat .mes .mes_edit_down").removeClass("disabled");

    if (this_edit_mes_id !== undefined) {
        const down = $(`#chat .mes[mesid="${this_edit_mes_id}"] .mes_edit_down`);
        const up = $(`#chat .mes[mesid="${this_edit_mes_id}"] .mes_edit_up`);
        const lastId = Number($("#chat .mes").last().attr("mesid"));
        const firstId = Number($("#chat .mes").first().attr("mesid"));

        if (lastId == Number(this_edit_mes_id)) {
            down.addClass("disabled");
        }

        if (firstId == Number(this_edit_mes_id)) {
            up.addClass("disabled");
        }
    }
}

function closeMessageEditor() {
    if (this_edit_mes_id) {
        $(`#chat .mes[mesid="${this_edit_mes_id}"] .mes_edit_cancel`).click();
    }
}

function setGenerationProgress(progress) {
    if (!progress) {
        $('#send_textarea').css({'background': '', 'transition': ''});
    }
    else {
        $('#send_textarea').css({
            'background': `linear-gradient(90deg, #008000d6 ${progress}%, transparent ${progress}%)`,
            'transition': '0.25s ease-in-out'
        });
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
        maxContext: Number(max_context),
        addOneMessage: addOneMessage,
        generate: Generate,
        encode: encode,
        extensionPrompts: extension_prompts,
        setExtensionPrompt: setExtensionPrompt,
        saveChat: saveChatConditional,
        sendSystemMessage: sendSystemMessage,
        activateSendButtons,
        deactivateSendButtons, 
        saveReply,
    };
};

$(document).ready(function () {

    $('#swipes-checkbox').change(function () {
        console.log('detected swipes-checkbox changed values')
        swipes = !!$('#swipes-checkbox').prop('checked');
        if (swipes) {
            //console.log('toggle change calling showswipebtns');
            showSwipeButtons();
        } else {
            hideSwipeButtons();
        }
        saveSettingsDebounced();
    });

    ///// SWIPE BUTTON CLICKS ///////

    $(document).on('click', '.swipe_right', function () {               //when we click swipe right button
        if (chat.length -1 === Number(this_edit_mes_id)) {
            closeMessageEditor();
        }

        const swipe_duration = 120;
        const swipe_range = 700;
        //console.log(swipe_range);
        let run_generate = false;
        let run_swipe_right = false;
        if (chat[chat.length - 1]['swipe_id'] === undefined) {              // if there is no swipe-message in the last spot of the chat array
            chat[chat.length - 1]['swipe_id'] = 0;                        // set it to id 0
            chat[chat.length - 1]['swipes'] = [];                         // empty the array
            chat[chat.length - 1]['swipes'][0] = chat[chat.length - 1]['mes'];  //assign swipe array with last message from chat
        }
        chat[chat.length - 1]['swipe_id']++;                                      //make new slot in array
        //console.log(chat[chat.length-1]['swipes']);
        if (parseInt(chat[chat.length - 1]['swipe_id']) === chat[chat.length - 1]['swipes'].length) { //if swipe id of last message is the same as the length of the 'swipes' array

            run_generate = true;
        } else if (parseInt(chat[chat.length - 1]['swipe_id']) < chat[chat.length - 1]['swipes'].length) { //otherwise, if the id is less than the number of swipes
            chat[chat.length - 1]['mes'] = chat[chat.length - 1]['swipes'][chat[chat.length - 1]['swipe_id']]; //load the last mes box with the latest generation
            run_swipe_right = true; //then prepare to do normal right swipe to show next message
        }

        if (chat[chat.length - 1]['swipe_id'] > chat[chat.length - 1]['swipes'].length) { //if we swipe right while generating (the swipe ID is greater than what we are viewing now)
            chat[chat.length - 1]['swipe_id'] = chat[chat.length - 1]['swipes'].length; //show that message slot (will be '...' while generating)
        }
        if (run_generate) {               //hide swipe arrows while generating
            $(this).css('display', 'none');

        }
        if (run_generate || run_swipe_right) {                // handles animated transitions when swipe right, specifically height transitions between messages

            let this_mes_div = $(this).parent();
            let this_mes_block = $(this).parent().children('.mes_block').children('.mes_text');
            const this_mes_div_height = this_mes_div[0].scrollHeight;
            const this_mes_block_height = this_mes_block[0].scrollHeight;

            this_mes_div.children('.swipe_left').css('display', 'flex');
            this_mes_div.children('.mes_block').transition({        // this moves the div back and forth
                x: '-' + swipe_range,
                duration: swipe_duration,
                easing: animation_rm_easing,
                queue: false,
                complete: function () {
                    /*if (!selected_group) {
                        var typingIndicator = $("#typing_indicator_template .typing_indicator").clone();
                        typingIndicator.find(".typing_indicator_name").text(characters[this_chid].name);
                    } */
                    /* $("#chat").append(typingIndicator); */
                    const is_animation_scroll = ($('#chat').scrollTop() >= ($('#chat').prop("scrollHeight") - $('#chat').outerHeight()) - 10);
                    //console.log(parseInt(chat[chat.length-1]['swipe_id']));
                    //console.log(chat[chat.length-1]['swipes'].length);
                    if (run_generate && parseInt(chat[chat.length - 1]['swipe_id']) === chat[chat.length - 1]['swipes'].length) {
                        //console.log('showing ""..."');
                        /* if (!selected_group) {
                        } else { */
                        $("#chat").children().filter('[mesid="' + (count_view_mes - 1) + '"]').children('.mes_block').children('.mes_text').html('...');  //shows "..." while generating
                        /* } */
                    } else {
                        //console.log('showing previously generated swipe candidate, or "..."');
                        //console.log('onclick right swipe calling addOneMessage');
                        addOneMessage(chat[chat.length - 1], 'swipe');
                    }
                    let new_height = this_mes_div_height - (this_mes_block_height - this_mes_block[0].scrollHeight);
                    if (new_height < 103) new_height = 103;


                    this_mes_div.animate({ height: new_height + 'px' }, {
                        duration: 100,
                        queue: false,
                        progress: function () {
                            // Scroll the chat down as the message expands
                            if (is_animation_scroll) $("#chat").scrollTop($("#chat")[0].scrollHeight);
                        },
                        complete: function () {
                            this_mes_div.css('height', 'auto');
                            // Scroll the chat down to the bottom once the animation is complete
                            if (is_animation_scroll) $("#chat").scrollTop($("#chat")[0].scrollHeight);
                        }
                    });
                    this_mes_div.children('.mes_block').transition({
                        x: swipe_range,
                        duration: 0,
                        easing: animation_rm_easing,
                        queue: false,
                        complete: function () {
                            this_mes_div.children('.mes_block').transition({
                                x: '0px',
                                duration: swipe_duration,
                                easing: animation_rm_easing,
                                queue: false,
                                complete: function () {
                                    if (run_generate && !is_send_press && parseInt(chat[chat.length - 1]['swipe_id']) === chat[chat.length - 1]['swipes'].length) {
                                        console.log('caught here 2');
                                        is_send_press = true;
                                        $('.mes_edit:last').hide();
                                        Generate('swipe');
                                    } else {
                                        if (parseInt(chat[chat.length - 1]['swipe_id']) !== chat[chat.length - 1]['swipes'].length) {
                                            saveChatConditional();
                                        }
                                    }
                                }
                            });
                        }
                    });
                }
            });

            $(this).parent().children('.avatar').transition({ // moves avatar aong with swipe
                x: '-' + swipe_range,
                duration: swipe_duration,
                easing: animation_rm_easing,
                queue: false,
                complete: function () {
                    $(this).parent().children('.avatar').transition({
                        x: swipe_range,
                        duration: 0,
                        easing: animation_rm_easing,
                        queue: false,
                        complete: function () {
                            $(this).parent().children('.avatar').transition({
                                x: '0px',
                                duration: swipe_duration,
                                easing: animation_rm_easing,
                                queue: false,
                                complete: function () {

                                }
                            });
                        }
                    });
                }
            });
        }

    });

    $(document).on('click', '.swipe_left', function () {      // when we swipe left..but no generation.
        if (chat.length -1 === Number(this_edit_mes_id)) {
            closeMessageEditor();
        }

        const swipe_duration = 120;
        const swipe_range = '700px';
        chat[chat.length - 1]['swipe_id']--;
        if (chat[chat.length - 1]['swipe_id'] >= 0) {
            /*$(this).parent().children('swipe_right').css('display', 'flex');
            if (chat[chat.length - 1]['swipe_id'] === 0) {
                $(this).css('display', 'none');
            }*/ // Just in case
            let this_mes_div = $(this).parent();
            let this_mes_block = $(this).parent().children('.mes_block').children('.mes_text');
            const this_mes_div_height = this_mes_div[0].scrollHeight;
            this_mes_div.css('height', this_mes_div_height);
            const this_mes_block_height = this_mes_block[0].scrollHeight;
            chat[chat.length - 1]['mes'] = chat[chat.length - 1]['swipes'][chat[chat.length - 1]['swipe_id']];
            $(this).parent().children('.mes_block').transition({
                x: swipe_range,
                duration: swipe_duration,
                easing: animation_rm_easing,
                queue: false,
                complete: function () {
                    const is_animation_scroll = ($('#chat').scrollTop() >= ($('#chat').prop("scrollHeight") - $('#chat').outerHeight()) - 10);
                    //console.log('on left swipe click calling addOneMessage');
                    addOneMessage(chat[chat.length - 1], 'swipe');
                    let new_height = this_mes_div_height - (this_mes_block_height - this_mes_block[0].scrollHeight);
                    if (new_height < 103) new_height = 103;
                    this_mes_div.animate({ height: new_height + 'px' }, {
                        duration: 100,
                        queue: false,
                        progress: function () {
                            // Scroll the chat down as the message expands

                            if (is_animation_scroll) $("#chat").scrollTop($("#chat")[0].scrollHeight);
                        },
                        complete: function () {
                            this_mes_div.css('height', 'auto');
                            // Scroll the chat down to the bottom once the animation is complete
                            if (is_animation_scroll) $("#chat").scrollTop($("#chat")[0].scrollHeight);
                        }
                    });
                    $(this).parent().children('.mes_block').transition({
                        x: '-' + swipe_range,
                        duration: 0,
                        easing: animation_rm_easing,
                        queue: false,
                        complete: function () {
                            $(this).parent().children('.mes_block').transition({
                                x: '0px',
                                duration: swipe_duration,
                                easing: animation_rm_easing,
                                queue: false,
                                complete: function () {
                                    saveChatConditional();
                                }
                            });
                        }
                    });
                }
            });

            $(this).parent().children('.avatar').transition({
                x: swipe_range,
                duration: swipe_duration,
                easing: animation_rm_easing,
                queue: false,
                complete: function () {
                    $(this).parent().children('.avatar').transition({
                        x: '-' + swipe_range,
                        duration: 0,
                        easing: animation_rm_easing,
                        queue: false,
                        complete: function () {
                            $(this).parent().children('.avatar').transition({
                                x: '0px',
                                duration: swipe_duration,
                                easing: animation_rm_easing,
                                queue: false,
                                complete: function () {

                                }
                            });
                        }
                    });
                }
            });
        }
        if (chat[chat.length - 1]['swipe_id'] < 0) {
            chat[chat.length - 1]['swipe_id'] = 0;
        }
    });

    $("#character_search_bar").on("input", function () {
        const selector = ['#rm_print_characters_block .character_select', '#rm_print_characters_block .group_select'].join(',');
        const searchValue = $(this).val().trim().toLowerCase();

        if (!searchValue) {
            $(selector).show();
        } else {
            $(selector).each(function () {
                $(this).children(".ch_name").text().toLowerCase().includes(searchValue)
                    ? $(this).show()
                    : $(this).hide();
            });
        }
    });

    $("#send_but").click(function () {
        if (is_send_press == false) {
            is_send_press = true;
            Generate();
        }
    });

    $("#send_textarea").keydown(function (e) {
        if (!e.shiftKey && !e.ctrlKey && e.key == "Enter" && is_send_press == false) {
            is_send_press = true;
            e.preventDefault();
            Generate();
        }
    });

    //menu buttons setup

    $("#rm_button_settings").click(function () {
        selected_button = "settings";
        menu_type = "settings";
        selectRightMenuWithAnimation('rm_api_block');
        setRightTabSelectedClass('rm_button_settings');
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
        if (selected_group) {
            select_group_chats(selected_group);
        } else {
            selected_button = "character_edit";
            select_selected_character(this_chid);
        }
    });

    $(document).on("click", ".character_select", function () {
        if (selected_group && is_group_generating) {
            return;
        }

        if (this_chid !== $(this).attr("chid")) {
            //if clicked on a different character from what was currently selected
            if (!is_send_press) {
                resetSelectedGroup();
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
        saveSettingsDebounced();
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

    $(document).on("click", ".bg_example", function () {
        //when user clicks on a BG thumbnail...
        var this_bgfile = $(this).attr("bgfile"); // this_bgfile = whatever they clicked

        // if clicked on upload button
        if (!this_bgfile) {
            return;
        }

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
            },
        });
        $("#bg" + number_bg).css(
            "background-image",
            'url("backgrounds/' + this_bgfile + '")'
        );
        setBackground(this_bgfile);
    });
    $(document).on("click", ".bg_example_cross", function (e) {
        e.stopPropagation();
        bg_file_for_del = $(this);
        //$(this).parent().remove();
        //delBackground(this_bgfile);
        popup_type = "del_bg";
        callPopup("<h3>Delete the background?</h3>");
    });

    $(document).on("click", ".PastChat_cross", function () {
        chat_file_for_del = $(this).attr('file_name');
        console.log('detected cross click for' + chat_file_for_del);
        popup_type = "del_chat";
        callPopup("<h3>Delete the Chat File?</h3>");
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
    $("#dialogue_popup_ok").click(function (e) {
        $("#shadow_popup").css("display", "none");
        $("#shadow_popup").css("opacity:", 0.0);
        if (popup_type == "del_bg") {
            delBackground(bg_file_for_del.attr("bgfile"));
            bg_file_for_del.parent().remove();
        }
        if (popup_type == "del_chat") {

            delChat(chat_file_for_del);

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
                    characters.length = 0; // resets the characters array, forcing getcharacters to reset
                    name2 = systemUserName; // replaces deleted charcter name with system user since she will be displayed next.
                    chat = [...safetychat]; // sets up system user to tell user about having deleted a character
                    setRightTabSelectedClass() // 'deselects' character's tab panel
                    $(document.getElementById("rm_button_selected_ch"))
                        .children("h2")
                        .text(""); // removes character name from nav tabs
                    clearChat(); // removes deleted char's chat
                    this_chid = undefined; // prevents getCharacters from trying to load an invalid char.
                    getCharacters(); // gets the new list of characters (that doesn't include the deleted one)
                    printMessages(); // prints out system user's 'deleted character' message
                    //console.log("#dialogue_popup_ok(del-char) >>>> saving");
                    saveSettingsDebounced(); // saving settings to keep changes to variables
                    //getCharacters();
                    //$('#create_button_div').html(html);
                },
            });
        }
        if (popup_type === "world_imported") {
            selectImportedWorldInfo();
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
            saveCharacterDebounced();
            getChat();
        }

        if (dialogueResolve) {
            if (popup_type == 'input') {
                dialogueResolve($("#dialogue_popup_input").val());
                $("#dialogue_popup_input").val('');
            }
            else {
                dialogueResolve(true);
            }

            dialogueResolve = null;
        }
    });
    $("#dialogue_popup_cancel").click(function (e) {
        $("#shadow_popup").css("display", "none");
        $("#shadow_popup").css("opacity:", 0.0);
        popup_type = "";

        if (dialogueResolve) {
            dialogueResolve(false);
            dialogueResolve = null;
        }
    });

    $("#add_bg_button").change(function () {
        read_bg_load(this);
    });

    $("#add_avatar_button").change(function () {
        is_mes_reload_avatar = Date.now();
        read_avatar_load(this);
    });

    $("#form_create").submit(function (e) {
        $("#rm_info_avatar").html("");
        let save_name = create_save_name;
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
                        $("#create_button").attr("value", "⏳");
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

                        $("#create_button").attr("value", "✅");
                        if (true) {
                            let oldSelectedChar = null;
                            if (this_chid != undefined && this_chid != "invalid-safety-id") {
                                oldSelectedChar = characters[this_chid].name;
                            }

                            await getCharacters();

                            $("#rm_info_block").transition({ opacity: 0, duration: 0 });
                            var $prev_img = $("#avatar_div_div").clone();
                            $("#rm_info_avatar").append($prev_img);
                            select_rm_info(`Character created<br><h4>${DOMPurify.sanitize(save_name)}</h4>`, oldSelectedChar);

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
                        if ($(this).attr("is_system") == 'true') {
                            return;
                        }
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
                            //console.log('form create submission calling addOneMessage');
                            addOneMessage(chat[0]);
                        }
                    }
                    $("#create_button").removeAttr("disabled");
                    getCharacters();

                    $("#add_avatar_button").replaceWith(
                        $("#add_avatar_button").val("").clone(true)
                    );
                    $("#create_button").attr("value", "Save");
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

    //////// OPTIMIZED ALL CHAR CREATION/EDITING TEXTAREA LISTENERS ///////////////

    $("#character_name_pole").on("input", function () {
        if (menu_type == "create") {
            create_save_name = $("#character_name_pole").val();
        }
    });

    $("#description_textarea, #personality_textarea, #scenario_pole, #mes_example_textarea, #firstmessage_textarea")
        .on("input", function () {
            if (menu_type == "create") {
                create_save_description = $("#description_textarea").val();
                create_save_personality = $("#personality_textarea").val();
                create_save_scenario = $("#scenario_pole").val();
                create_save_mes_example = $("#mes_example_textarea").val();
                create_save_first_message = $("#firstmessage_textarea").val();
            } else {
                saveCharacterDebounced();
            }
        });

    $("#talkativeness_slider").on("input", function () {
        if (menu_type == "create") {
            create_save_talkativeness = $("#talkativeness_slider").val();
        } else {
            saveCharacterDebounced();
        }
    });

    ///////////////////////////////////////////////////////////////////////////////////

    $("#api_button").click(function (e) {
        e.stopPropagation();
        if ($("#api_url_text").val() != "" && !horde_settings.use_horde) {
            let value = formatKoboldUrl($.trim($("#api_url_text").val()));

            if (!value) {
                callPopup('Please enter a valid URL.', 'text');
                return;
            }

            $("#api_url_text").val(value); 
            api_server = value;
            $("#api_loading").css("display", "inline-block");
            $("#api_button").css("display", "none");

            main_api = "kobold";
            saveSettingsDebounced();
            is_get_status = true;
            is_api_button_press = true;
            getStatus();
            clearSoftPromptsList();
            getSoftPromptsList();
        }
        else if (horde_settings.use_horde) {
            main_api = "kobold";
            is_get_status = true;
            getStatus();
            clearSoftPromptsList();
        }
    });

    $("#api_button_textgenerationwebui").click(function (e) {
        e.stopPropagation();
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
            saveSettingsDebounced();
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
            optionsPopper.update();
            showBookmarksButtons();
            $("#options").css("display", "block");
            $("#options").transition({
                opacity: 1.0, // the manual setting of CSS via JS is what allows the click-away feature to work
                duration: 100,
                easing: animation_rm_easing,
                complete: function () { optionsPopper.update(); },
            });
        }
    });

    ///////////// OPTIMIZED LISTENERS FOR LEFT SIDE OPTIONS POPUP MENU //////////////////////

    $("#options_button [id]").on("click", function () {
        var id = $(this).attr("id");

        if (id == "option_select_chat") {
            if (selected_group) {
                // will open a chat selection screen
                /* openNavToggle(); */
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
        }

        else if (id == "option_start_new_chat") {
            if (selected_group) {
                // will open a group creation screen
                /* openNavToggle(); */
                $("#rm_button_group_chats").trigger("click");
                return;
            }
            if (this_chid != undefined && !is_send_press) {
                popup_type = "new_chat";
                callPopup("<h3>Start new chat?</h3>");
            }
        }

        else if (id == "option_regenerate") {
            if (is_send_press == false) {
                //hideSwipeButtons();

                if (selected_group) {
                    regenerateGroup();
                }
                else {
                    is_send_press = true;
                    Generate("regenerate");
                }
            }
        }

        else if (id == "option_delete_mes") {
            closeMessageEditor();
            hideSwipeButtons();
            if ((this_chid != undefined && !is_send_press) || (selected_group && !is_group_generating)) {
                $("#dialogue_del_mes").css("display", "block");
                $("#send_form").css("display", "none");
                $(".del_checkbox").each(function () {
                    if ($(this).parent().attr("mesid") != 0) {
                        $(this).css("display", "block");
                        $(this).parent().children(".for_checkbox").css("display", "none");
                    }
                });
            }
        }
    });

    //////////////////////////////////////////////////////////////////////////////////////////////

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
        console.log('canceled del msgs, calling showswipesbtns');
        showSwipeButtons();
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
            saveChatConditional();
            var $textchat = $("#chat");
            $textchat.scrollTop($textchat[0].scrollHeight);
        }
        this_del_mes = 0;
        $('#chat .mes').last().addClass('last_mes');
        $('#chat .mes').eq(-2).removeClass('last_mes');
        console.log('confirmed del msgs, calling showswipesbtns');
        showSwipeButtons();
    });

    $("#settings_perset").change(function () {
        if ($("#settings_perset").find(":selected").val() != "gui") {
            preset_settings = $("#settings_perset").find(":selected").text();
            const preset = koboldai_settings[koboldai_setting_names[preset_settings]];
            loadKoboldSettings(preset);

            amount_gen = preset.genamt;
            $("#amount_gen").val(amount_gen);
            $("#amount_gen_counter").text(`${amount_gen} Tokens`);

            max_context = preset.max_length;
            $("#max_context").val(max_context);
            $("#max_context_counter").text(`${max_context} Tokens`);

            $("#range_block").find('input').prop("disabled", false);
            $("#kobold-advanced-config").find('input').prop("disabled", false);
            $("#kobold-advanced-config").css('opacity', 1.0);

            $("#range_block").css("opacity", 1.0);
            $("#amount_gen_block").find('input').prop("disabled", false);

            $("#amount_gen_block").css("opacity", 1.0);
        } else {
            //$('.button').disableSelection();
            preset_settings = "gui";
            $("#range_block").find('input').prop("disabled", true);
            $("#kobold-advanced-config").find('input').prop("disabled", true);
            $("#kobold-advanced-config").css('opacity', 0.5);

            $("#range_block").css("opacity", 0.5);
            $("#amount_gen_block").find('input').prop("disabled", true);

            $("#amount_gen_block").css("opacity", 0.45);
        }
        saveSettingsDebounced();
    });

    $("#settings_perset_novel").change(function () {
        nai_settings.preset_settings_novel = $("#settings_perset_novel")
            .find(":selected")
            .text();

        const preset = novelai_settings[novelai_setting_names[nai_settings.preset_settings_novel]];
        loadNovelPreset(preset);

        saveSettingsDebounced();
    });

    $("#main_api").change(function () {
        is_pygmalion = false;
        is_get_status = false;
        is_get_status_novel = false;
        setOpenAIOnlineStatus(false);
        setPoeOnlineStatus(false);
        online_status = "no_connection";
        clearSoftPromptsList();
        checkOnlineStatus();
        changeMainAPI();
        saveSettingsDebounced();
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

    ////////////////// OPTIMIZED RANGE SLIDER LISTENERS////////////////

    const sliders = [
        {
            sliderId: "#amount_gen",
            counterId: "#amount_gen_counter",
            format: (val) => `${val} Tokens`,
            setValue: (val) => { amount_gen = Number(val); },
        },
        {
            sliderId: "#max_context",
            counterId: "#max_context_counter",
            format: (val) => `${val} Tokens`,
            setValue: (val) => { max_context = Number(val); },
        }
    ];

    sliders.forEach(slider => {
        $(document).on("input", slider.sliderId, function () {
            const value = $(this).val();
            const formattedValue = slider.format(value);
            slider.setValue(value);
            $(slider.counterId).text(formattedValue);
            console.log('saving');
            saveSettingsDebounced();
        });
    });

    //////////////////////////////////////////////////////////////


    $("#style_anchor").change(function () {
        style_anchor = !!$("#style_anchor").prop("checked");
        saveSettingsDebounced();
    });

    $("#character_anchor").change(function () {
        character_anchor = !!$("#character_anchor").prop("checked");
        saveSettingsDebounced();
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
                    .find(".mes_block")
                    .find(".mes_edit_done");
                if (edit_mes_id == count_view_mes - 1) { //if the generating swipe (...)
                    if (chat[edit_mes_id]['swipe_id'] !== undefined) {
                        if (chat[edit_mes_id]['swipes'].length === chat[edit_mes_id]['swipe_id']) {
                            run_edit = false;
                        }
                    }
                    if (run_edit) {
                        hideSwipeButtons();
                    }
                }
                messageEditDone(mes_edited);
            }
            $(this).closest(".mes_block").find(".mes_text").empty();
            $(this).css("display", "none");
            $(this).closest(".mes_block").find(".mes_edit_buttons").css("display", "inline-flex");
            var edit_mes_id = $(this).closest(".mes").attr("mesid");
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
                .closest(".mes_block")
                .find(".mes_text")
                .append(
                    '<textarea class=edit_textarea style="max-width:auto; ">' +
                    text +
                    "</textarea>"
                );
            let edit_textarea = $(this)
                .closest(".mes_block")
                .find(".edit_textarea");
            edit_textarea.height(0);
            edit_textarea.height(edit_textarea[0].scrollHeight);
            edit_textarea.focus();
            edit_textarea[0].setSelectionRange(     //this sets the cursor at the end of the text
                edit_textarea.val().length,
                edit_textarea.val().length
            );
            if (this_edit_mes_id == count_view_mes - 1) {
                $("#chat").scrollTop(chatScrollPosition);
            }

            updateEditArrowClasses();
        }
    });
    $(document).on("click", ".mes_edit_cancel", function () {
        let text = chat[this_edit_mes_id]["mes"];

        $(this).closest(".mes_block").find(".mes_text").empty();
        $(this).closest(".mes_edit_buttons").css("display", "none");
        $(this).closest(".mes_block").find(".mes_edit").css("display", "inline-block");
        $(this)
            .closest(".mes_block")
            .find(".mes_text")
            .append(messageFormating(text, this_edit_mes_chname));
        appendImageToMessage(chat[this_edit_mes_id], $(this).closest(".mes"));
        this_edit_mes_id = undefined;
    });

    $(document).on("click", ".mes_edit_up", function() {
        if (is_send_press || this_edit_mes_id <= 0) {
             return;
        }

        hideSwipeButtons();
        const targetId = Number(this_edit_mes_id) - 1;
        const target = $(`#chat .mes[mesid="${targetId}"]`);
        const root = $(this).closest('.mes');

        if (root.length === 0 || target.length === 0) {
            return;
        }

        root.insertBefore(target);

        target.attr("mesid", this_edit_mes_id);
        root.attr("mesid", targetId);

        const temp = chat[targetId];
        chat[targetId] = chat[this_edit_mes_id];
        chat[this_edit_mes_id] = temp;

        this_edit_mes_id = targetId;
        updateViewMessageIds();
        saveChatConditional();
        showSwipeButtons();
    });

    $(document).on("click", ".mes_edit_down", function () {
        if (is_send_press || this_edit_mes_id >= chat.length - 1) {
            return;
        }

        hideSwipeButtons();
        const targetId = Number(this_edit_mes_id) + 1;
        const target = $(`#chat .mes[mesid="${targetId}"]`);
        const root = $(this).closest('.mes');

        if (root.length === 0 || target.length === 0) {
            return;
        }

        root.insertAfter(target);

        target.attr("mesid", this_edit_mes_id);
        root.attr("mesid", targetId);

        const temp = chat[targetId];
        chat[targetId] = chat[this_edit_mes_id];
        chat[this_edit_mes_id] = temp;

        this_edit_mes_id = targetId;
        updateViewMessageIds();
        saveChatConditional();
        showSwipeButtons();
    });

    $(document).on("click", ".mes_edit_copy", function () {
        if (!confirm('Create a copy of this message?')) {
            return;
        }

        hideSwipeButtons();
        let oldScroll = $('#chat')[0].scrollTop;
        const clone = JSON.parse(JSON.stringify(chat[this_edit_mes_id])); // quick and dirty clone
        clone.send_date = Date.now();
        clone.mes = $(this).closest(".mes").find('.edit_textarea').val().trim();

        chat.splice(Number(this_edit_mes_id) + 1, 0, clone);
        addOneMessage(clone, 'normal', this_edit_mes_id);

        updateViewMessageIds();
        saveChatConditional();
        $('#chat')[0].scrollTop = oldScroll;
        showSwipeButtons();
    });

    $(document).on("click", ".mes_edit_delete", function () {
        if (!confirm("Are you sure you want to delete this message?")) {
            return;
        }

        const mes = $(this).closest(".mes");

        if (!mes) {
            return;
        }

        chat.splice(this_edit_mes_id, 1);
        this_edit_mes_id = undefined;
        mes.remove();
        count_view_mes--;

        updateViewMessageIds();
        saveChatConditional();

        hideSwipeButtons();
        showSwipeButtons();
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

    $("#api_button_novel").click(function (e) {
        e.stopPropagation();
        if ($("#api_key_novel").val() != "") {
            $("#api_loading_novel").css("display", "inline-block");
            $("#api_button_novel").css("display", "none");
            nai_settings.api_key_novel = $.trim($("#api_key_novel").val());
            saveSettingsDebounced();
            is_get_status_novel = true;
            is_api_button_press_novel = true;
        }
    });
    $("#anchor_order").change(function () {
        anchor_order = parseInt($("#anchor_order").find(":selected").val());
        saveSettingsDebounced();
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
                    select_rm_info(`Character imported<br><h4>${DOMPurify.sanitize(data.file_name)}</h4>`, oldSelectedChar);
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

    $("#rm_button_group_chats").click(function () {
        selected_button = "group_chats";
        select_group_chats();
    });

    $("#rm_button_back_from_group").click(function () {
        selected_button = "characters";
        select_rm_characters();
    });

    $("#rm_button_extensions").click(function () {
        menu_type = 'extennsions';
        selected_button = 'extensions';
        setRightTabSelectedClass('rm_button_extensions');
        selectRightMenuWithAnimation('rm_extensions_block');
    });

    $(document).on("click", ".select_chat_block, .bookmark_link", async function () {
        let file_name = $(this).attr("file_name").replace(".jsonl", "");
        openCharacterChat(file_name);
    });

    $('.drawer-toggle').click(function () {
        var icon = $(this).find('.drawer-icon');
        var drawer = $(this).parent().find('.drawer-content');
        var drawerWasOpenAlready = $(this).parent().find('.drawer-content').hasClass('openDrawer');
        const pinnedDrawerClicked = drawer.hasClass('pinnedOpen');

        if (!drawerWasOpenAlready) {
            $('.openDrawer').not('.pinnedOpen').slideToggle(200, "swing");
            $('.openIcon').toggleClass('closedIcon openIcon');
            $('.openDrawer').not('.pinnedOpen').toggleClass('closedDrawer openDrawer');
            icon.toggleClass('openIcon closedIcon');
            drawer.toggleClass('openDrawer closedDrawer');
            $(this).closest('.drawer').find('.drawer-content').slideToggle(200, "swing");
        } else if (drawerWasOpenAlready) {
            icon.toggleClass('closedIcon openIcon');

            if (pinnedDrawerClicked) {
                $(drawer).slideToggle(200, "swing");
            }
            else {
                $('.openDrawer').not('.pinnedOpen').slideToggle(200, "swing");
            }

            drawer.toggleClass('closedDrawer openDrawer');
        }
    });

    $("html").on('touchstart mousedown', function (e) {
        var clickTarget = $(e.target);

        const forbiddenTargets = ['#character_cross', '#avatar-and-name-block', '#shadow_popup', '#world_popup'];
        for (const id of forbiddenTargets) {
            if (clickTarget.closest(id).length > 0) {
                return;
            }
        }

        var targetParentHasOpenDrawer = clickTarget.parents('.openDrawer').length;
        if (clickTarget.hasClass('drawer-icon') == false && !clickTarget.hasClass('openDrawer')) {
            if (jQuery.find('.openDrawer').length !== 0) {
                if (targetParentHasOpenDrawer === 0) {
                    //console.log($('.openDrawer').not('.pinnedOpen').length);
                    $('.openDrawer').not('.pinnedOpen').slideToggle(200, "swing");
                    $('.openIcon').toggleClass('closedIcon openIcon');
                    $('.openDrawer').not('.pinnedOpen').toggleClass('closedDrawer openDrawer');

                }
            }

        }
    });

    $(document).on('click', '.inline-drawer-toggle', function () {
        var icon = $(this).find('.inline-drawer-icon');
        icon.toggleClass('down up');
        $(this).closest('.inline-drawer').find('.inline-drawer-content').slideToggle();
    });

    $(document).keyup(function(e) {
        if (e.key === "Escape") {
            closeMessageEditor();
       }
   });
})
