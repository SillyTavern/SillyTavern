import { humanizedDateTime, favsToHotswap } from "./scripts/RossAscends-mods.js";
import { encode } from "../scripts/gpt-2-3-tokenizer/mod.js";
import { GPT3BrowserTokenizer } from "../scripts/gpt-3-tokenizer/gpt3-tokenizer.js";
import {
    kai_settings,
    loadKoboldSettings,
    formatKoboldUrl,
    getKoboldGenerationData,
    canUseKoboldStopSequence,
} from "./scripts/kai-settings.js";

import {
    textgenerationwebui_settings,
    loadTextGenSettings,
    generateTextGenWithStreaming,
    getTextGenGenerationData,
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
    world_info_recursive,
    world_info_case_sensitive,
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
    group_generation_id,
    getGroupChat,
    renameGroupMember,
    createNewGroupChat,
    getGroupPastChats,
    getGroupAvatar,
    openGroupChat,
    editGroup,
    deleteGroupChat,
    renameGroupChat,
    importGroupChat,
} from "./scripts/group-chats.js";

import {
    collapseNewlines,
    loadPowerUserSettings,
    playMessageSound,
    sortCharactersList,
    fixMarkdown,
    power_user,
    pygmalion_options,
    tokenizers,
    formatInstructModeChat,
    formatInstructStoryString,
    formatInstructModePrompt,
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
    openai_messages_count,
    getTokenCountOpenAI,
} from "./scripts/openai.js";

import {
    getNovelGenerationData,
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
    getHordeModels,
    adjustHordeGenerationParams,
    MIN_AMOUNT_GEN,
} from "./scripts/horde.js";

import {
    poe_settings,
    loadPoeSettings,
    generatePoe,
    is_get_status_poe,
    setPoeOnlineStatus,
    appendPoeAnchors,
} from "./scripts/poe.js";

import {
    debounce,
    delay,
    restoreCaretPosition,
    saveCaretPosition,
    end_trim_to_sentence,
    countOccurrences,
    isOdd,
    isElementInViewport,
    sortMoments,
    timestampToMoment,
    download,
} from "./scripts/utils.js";

import { extension_settings, loadExtensionSettings, runGenerationInterceptors } from "./scripts/extensions.js";
import { executeSlashCommands, getSlashCommandsHelp, registerSlashCommand } from "./scripts/slash-commands.js";
import {
    tag_map,
    tags,
    loadTagsSettings,
    printTags,
    getTagsList,
    appendTagToList,
    createTagMapFromList,
    renameTagKey,
} from "./scripts/tags.js";
import {
    SECRET_KEYS,
    readSecretState,
    secret_state,
    writeSecret
} from "./scripts/secrets.js";
import uniqolor from "./scripts/uniqolor.js";
import { EventEmitter } from './scripts/eventemitter.js';
import { context_settings, loadContextTemplatesFromSettings } from "./scripts/context-template.js";

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
    messageFormatting,
    getExtensionPrompt,
    showSwipeButtons,
    hideSwipeButtons,
    changeMainAPI,
    setGenerationProgress,
    updateChatMetadata,
    scrollChatToBottom,
    getTokenCount,
    isStreamingEnabled,
    getThumbnailUrl,
    getStoppingStrings,
    getStatus,
    reloadMarkdownProcessor,
    getCurrentChatId,
    chat,
    this_chid,
    selected_button,
    menu_type,
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
    max_context,
    chat_metadata,
    streamingProcessor,
    default_avatar,
    system_message_types,
    talkativeness_default,
    default_ch_mes,
    extension_prompt_types,
    updateVisibleDivs
}

// API OBJECT FOR EXTERNAL WIRING
window["SillyTavern"] = {};

const gpt3 = new GPT3BrowserTokenizer({ type: 'gpt3' });
hljs.addPlugin({ "before:highlightElement": ({ el }) => { el.textContent = el.innerText } });

// Markdown converter
let converter;
reloadMarkdownProcessor();

// array for prompt token calculations
console.log('initializing Prompt Itemization Array on Startup');
let itemizedPrompts = [];

/* let bg_menu_toggle = false; */
export const systemUserName = "SillyTavern System";
let default_user_name = "You";
let name1 = default_user_name;
let name2 = "SillyTavern System";
let chat = [];
let safetychat = [
    {
        name: systemUserName,
        is_user: false,
        is_name: true,
        create_date: 0,
        mes: "You deleted a character/chat and arrived back here for safety reasons! Pick another character!",
    },
];
let chat_create_date = 0;

const default_ch_mes = "Hello";
let count_view_mes = 0;
let mesStr = "";
let generatedPromtCache = "";
let generation_started = new Date();
let characters = [];
let this_chid;
let backgrounds = [];
const default_avatar = "img/ai4.png";
export const system_avatar = "img/five.png";
export let CLIENT_VERSION = 'SillyTavern:UNKNOWN:Cohee#1207'; // For Horde header
let is_colab = false;
let is_checked_colab = false;
let is_mes_reload_avatar = false;
let optionsPopper = Popper.createPopper(document.getElementById('send_form'), document.getElementById('options'), {
    placement: 'top-start'
});
let exportPopper = Popper.createPopper(document.getElementById('export_button'), document.getElementById('export_format_popup'), {
    placement: 'left'
});
let rawPromptPopper = Popper.createPopper(document.getElementById('dialogue_popup'), document.getElementById('rawPromptPopup'), {
    placement: 'right'
});

let dialogueResolve = null;
let chat_metadata = {};
let streamingProcessor = null;
let crop_data = undefined;
let is_delete_mode = false;
let fav_ch_checked = false;

//initialize global var for future cropped blobs
let currentCroppedAvatar = '';

const durationSaveEdit = 500;
const saveSettingsDebounced = debounce(() => saveSettings(), durationSaveEdit);
const saveCharacterDebounced = debounce(() => $("#create_button").trigger('click'), durationSaveEdit);
const getStatusDebounced = debounce(() => getStatus(), 90000);
const saveChatDebounced = debounce(() => saveChatConditional(), 1000);

const system_message_types = {
    HELP: "help",
    WELCOME: "welcome",
    GROUP: "group",
    EMPTY: "empty",
    GENERIC: "generic",
    BOOKMARK_CREATED: "bookmark_created",
    BOOKMARK_BACK: "bookmark_back",
    NARRATOR: "narrator",
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
            `Hi there! The following chat formatting commands are supported:
            <ul>
            <li><tt>{​{text}​}</tt> - sets a one-time behavioral bias for the AI. Resets when you send the next message.
            </li>
            </ul>
            Hotkeys/Keybinds:
            <ul>
            <li><tt>Up</tt> = Edit last message in chat</li>
            <li><tt>Ctrl+Up</tt> = Edit last USER message in chat</li>
            <li><tt>Left</tt> = swipe left</li>
            <li><tt>Right</tt> = swipe right (NOTE: swipe hotkeys are disabled when chatbar has something typed into it)</li>
            <li><tt>Ctrl+Left</tt> = view locally stored variables (in the browser console window)</li>
            <li><tt>Enter</tt> (with chat bar selected) = send your message to AI</li>
            <li><tt>Ctrl+Enter</tt> = Regenerate the last AI response</li>
            <li><tt>Escape</tt> = stop AI response generation</li>
            </ul>`
        ]
    },
    welcome:
    {
        name: systemUserName,
        force_avatar: system_avatar,
        is_user: false,
        is_name: true,
        mes: [
            '<h2>Welcome to <span id="version_display_welcome">SillyTavern</span>!</h2>',
            '<div id="version_display_welcome"></div>',
            '<h3>Want to Update to the latest version?</h3>',
            "Read the <a href='/notes/update.html' target='_blank'>instructions here</a>. Also located in your installation's base folder",
            '<hr>',
            '<h3>In order to begin chatting:</h3>',
            '<ol>',
            '<li>Connect to one of the supported generation APIs (the plug icon)</li>',
            '<li>Create or pick a character from the list (the top-right namecard icon)</li>',
            '</ol>',
            '<hr>',
            '<h3>Where to download more characters?</h3>',
            '<i>(Not endorsed, your discretion is advised)</i>',
            '<ol>',
            '<li><a target="_blank" href="https://discord.gg/pygmalionai">Pygmalion AI Discord</a></li>',
            '<li><a target="_blank" href="https://www.characterhub.org/">CharacterHub (NSFW)</a></li>',
            '</ol>',
            '<hr>',
            '<h3>Where can I get help?</h3>',
            'Before going any further, check out the following resources:',
            '<ol>',
            '<li><a target="_blank" href="/notes/readme.md">Introduction to SillyTavern</a></li>',
            '<li><a target="_blank" href="/notes/faq.md">SillyTavern FAQ</a></li>',
            '<li><a target="_blank" href="/notes">SillyTavern Guidebook</a></li>',
            '<li><a target="_blank" href="https://github.com/Cohee1207/TavernAI-extras/blob/main/README.md">Extras API Docs</a></li>',
            '<li><a target="_blank" href="https://docs.alpindale.dev/">Pygmalion AI Docs</a></li>',
            '</ol>',
            'Type <tt>/?</tt> in any chat to get help on message formatting commands.',
            '<hr>',
            '<h3>Still have questions or suggestions left?</h3>',
            '<a target="_blank" href="https://discord.gg/RZdyAEUPvj">SillyTavern Community Discord</a>',
            '<br>',
            '<a target="_blank" href="https://github.com/Cohee1207/SillyTavern/issues">Post a GitHub issue.</a>',
            '<br>',
            '<a target="_blank" href="https://github.com/Cohee1207/SillyTavern#questions-or-suggestions">Contact the developers.</a>',
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
        mes: "No one hears you. <b>Hint&#58;</b> add more members to the group!",
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

export const event_types = {
    EXTRAS_CONNECTED: 'extras_connected',
    MESSAGE_SWIPED: 'message_swiped',
    MESSAGE_SENT: 'message_sent',
    MESSAGE_RECEIVED: 'message_received',
    MESSAGE_EDITED: 'message_edited',
    MESSAGE_DELETED: 'message_deleted',
    IMPERSONATE_READY: 'impersonate_ready',
}

export const eventSource = new EventEmitter();

$(document).ajaxError(function myErrorHandler(_, xhr) {
    if (xhr.status == 403) {
        toastr.warning("doubleCsrf errors in console are NORMAL in this case. Just reload the page or close this tab.", "Looks like you've opened SillyTavern in another browser tab", { timeOut: 0, extendedTimeOut: 0, preventDuplicates: true });
    }
});

async function getClientVersion() {
    try {
        const response = await fetch('/version');
        const data = await response.json();
        CLIENT_VERSION = data.agent;
        let displayVersion = `SillyTavern ${data.pkgVersion}`;

        if (data.gitRevision && data.gitBranch) {
            displayVersion += ` '${data.gitBranch}'(${data.gitRevision})`;
        }

        $('#version_display').text(displayVersion);
        $('#version_display_welcome').text(displayVersion);
    } catch (err) {
        console.log("Couldn't get client version", err);
    }
}

function getTokenCount(str, padding = undefined) {
    let tokenizerType = power_user.tokenizer;

    if (main_api === 'openai') {
        if (padding === power_user.token_padding) {
            // For main "shadow" prompt building
            tokenizerType = tokenizers.NONE;
        } else {
            // For extensions and WI
            return getTokenCountOpenAI(str);
        }
    }

    if (padding === undefined) {
        padding = 0;
    }

    switch (tokenizerType) {
        case tokenizers.NONE:
            return Math.ceil(str.length / CHARACTERS_PER_TOKEN_RATIO) + padding;
        case tokenizers.GPT3:
            return gpt3.encode(str).bpe.length + padding;
        case tokenizers.CLASSIC:
            return encode(str).length + padding;
        case tokenizers.LLAMA:
            let tokenCount = 0;
            jQuery.ajax({
                async: false,
                type: 'POST', //
                url: `/tokenize_llama`,
                data: JSON.stringify({ text: str }),
                dataType: "json",
                contentType: "application/json",
                success: function (data) {
                    tokenCount = data.count;
                }
            });
            return tokenCount + padding;
    }
}

function reloadMarkdownProcessor(render_formulas = false) {
    if (render_formulas) {
        converter = new showdown.Converter({
            emoji: "true",
            underline: "true",
            extensions: [
                showdownKatex(
                    {
                        delimiters: [
                            { left: '$$', right: '$$', display: true, asciimath: false },
                            { left: '$', right: '$', display: false, asciimath: true },
                        ]
                    }
                )],
        });
    }
    else {
        converter = new showdown.Converter({
            emoji: "true",
        });
    }

    return converter;
}

function getCurrentChatId() {
    if (selected_group) {
        return groups.find(x => x.id == selected_group)?.chat_id;
    }
    else if (this_chid) {
        return characters[this_chid].chat;
    }
}

const CHARACTERS_PER_TOKEN_RATIO = 3.35;
const talkativeness_default = 0.5;

var is_advanced_char_open = false;

var menu_type = ""; //what is selected in the menu
var selected_button = ""; //which button pressed
//create pole save
var create_save_name = "";
var create_fav_chara = "";
var create_save_description = "";
var create_save_creatorcomment = "";
var create_save_personality = "";
var create_save_first_message = "";
var create_save_avatar = "";
var create_save_scenario = "";
var create_save_mes_example = "";
var create_save_talkativeness = talkativeness_default;

//animation right menu
var animation_duration = 250;
var animation_easing = "ease-in-out";
var popup_type = "";
var bg_file_for_del = "";
var chat_file_for_del = "";
var online_status = "no_connection";

var api_server = "";
var api_server_textgenerationwebui = "";
//var interval_timer = setInterval(getStatus, 2000);
var interval_timer_novel = setInterval(getStatusNovel, 90000);
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
var cycle_count_generation = 0;

var swipes = true;
let extension_prompts = {};

var main_api;// = "kobold";
//novel settings
let novel_tier;
let novelai_settings;
let novelai_setting_names;
let abortController;

//css
var css_mes_bg = $('<div class="mes"></div>').css("background");
var css_send_form_display = $("<div id=send_form></div>").css("display");
let generate_loop_counter = 0;
const MAX_GENERATION_LOOPS = 5;

let token;

var PromptArrayItemForRawPromptDisplay;

export function getRequestHeaders() {
    return {
        "Content-Type": "application/json",
        "X-CSRF-Token": token,
    };
}

$.ajaxPrefilter((options, originalOptions, xhr) => {
    xhr.setRequestHeader("X-CSRF-Token", token);
});

///// initialization protocol ////////
$.get("/csrf-token").then(async (data) => {
    token = data.token;
    sendSystemMessage(system_message_types.WELCOME);
    await readSecretState();
    await getClientVersion();
    await getSettings("def");
    await getUserAvatars();
    await getCharacters();
    await getBackgrounds();
});

function checkOnlineStatus() {
    ///////// REMOVED LINES THAT DUPLICATE RA_CHeckOnlineStatus FEATURES

    if (online_status == "no_connection") {
        $("#online_status_indicator2").css("background-color", "red");  //Kobold
        $("#online_status_text2").html("No connection...");
        $("#online_status_indicator_horde").css("background-color", "red");  //Kobold Horde
        $("#online_status_text_horde").html("No connection...");
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
        $("#online_status_indicator_horde").css("background-color", "green");  //Kobold Horde
        $("#online_status_text_horde").html(online_status);
        $("#online_status_indicator3").css("background-color", "green"); //novel
        $("#online_status_text3").html(online_status);
        $(".online_status_indicator4").css("background-color", "green"); //OAI / ooba
        $(".online_status_text4").html(online_status);
    }
}

async function getStatus() {
    if (is_get_status) {
        if (main_api == "koboldhorde") {
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
                if ((online_status.toLowerCase().indexOf("pygmalion") != -1 && power_user.pygmalion_formatting == pygmalion_options.AUTO)
                    || (online_status !== "no_connection" && power_user.pygmalion_formatting == pygmalion_options.ENABLED)) {
                    is_pygmalion = true;
                    online_status += " (Pyg. formatting on)";
                } else {
                    is_pygmalion = false;
                }

                // determine if we can use stop sequence
                if (main_api === "kobold" || main_api === "koboldhorde") {
                    kai_settings.use_stop_sequence = canUseKoboldStopSequence(data.version);
                }

                //console.log(online_status);
                resultCheckStatus();
                if (online_status !== "no_connection") {
                    getStatusDebounced();
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
        headers: getRequestHeaders(),
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

async function printCharacters() {
    $("#rm_print_characters_block").empty();
    characters.forEach(function (item, i, arr) {
        let this_avatar = default_avatar;
        if (item.avatar != "none") {
            this_avatar = getThumbnailUrl('avatar', item.avatar);
        }
        // Populate the template
        const template = $('#character_template .character_select').clone();
        template.attr({ 'chid': i, 'id': `CharID${i}` });
        template.find('img').attr('src', this_avatar);
        template.find('.avatar').attr('title', item.avatar);
        template.find('.ch_name').text(item.name);
        template.find('.ch_fav_icon').css("display", 'none');
        template.addClass(item.fav == "true" ? 'is_fav' : '');
        template.find('.ch_fav').val(item.fav);

        // Display inline tags
        const tags = getTagsList(item.avatar);
        const tagsElement = template.find('.tags');
        tags.forEach(tag => appendTagToList(tagsElement, tag, {}));

        // Add to the list
        $("#rm_print_characters_block").append(template);
    });

    printTags();
    printGroups();
    sortCharactersList();
    favsToHotswap();
    await delay(300);
    updateVisibleDivs();

}

async function getCharacters() {
    var response = await fetch("/getcharacters", {
        method: "POST",
        headers: getRequestHeaders(),
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

            // For dropped-in cards
            if (!characters[i]['chat']) {
                characters[i]['chat'] = `${characters[i]['name']} - ${humanizedDateTime()}`;
            }

            characters[i]['chat'] = String(characters[i]['chat']);
        }
        if (this_chid != undefined && this_chid != "invalid-safety-id") {
            $("#avatar_url_pole").val(characters[this_chid].avatar);
        }
        await getGroups();
        await printCharacters();
    }
}

async function getBackgrounds() {
    const response = await fetch("/getbackgrounds", {
        method: "POST",
        headers: getRequestHeaders(),
        body: JSON.stringify({
            "": "",
        }),
    });
    if (response.ok === true) {
        const getData = await response.json();
        //background = getData;
        //console.log(getData.length);
        for (const bg of getData) {
            const thumbPath = getThumbnailUrl('bg', bg);
            $("#bg_menu_content").append(
                `<div class="bg_example flex-container" bgfile="${bg}" class="bg_example_img" title="${bg}" style="background-image: url('${thumbPath}');">
                    <div bgfile="${bg}" class="bg_example_cross fa-solid fa-circle-xmark"></div>
                    <div class="BGSampleTitle">
                        ${bg
                    .replace('.png', '')
                    .replace('.jpg', '')
                    .replace('.webp', '')}
                </div>
                </div>`
            );
        }
    }
}
async function isColab() {
    is_checked_colab = true;
    const response = await fetch("/iscolab", {
        method: "POST",
        headers: getRequestHeaders(),
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
        headers: getRequestHeaders(),
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
        headers: getRequestHeaders(),
        body: JSON.stringify({
            chatfile: chatfile,
            id: characters[this_chid].name
        }),
    });
    if (response.ok === true) {
        // choose another chat if current was deleted
        if (chatfile.replace('.jsonl', '') === characters[this_chid].chat) {
            await replaceCurrentChat();
        }
    }
}

async function replaceCurrentChat() {
    clearChat();
    chat.length = 0;

    const chatsResponse = await fetch("/getallchatsofcharacter", {
        method: 'POST',
        headers: getRequestHeaders(),
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
        addOneMessage(item, { scroll: i === arr.length - 1 });
    });
}

function clearChat() {
    count_view_mes = 0;
    extension_prompts = {};
    $("#chat").children().remove();
}

function deleteLastMessage() {
    count_view_mes--;
    chat.length = chat.length - 1;
    $('#chat').children('.mes').last().remove();
    eventSource.emit(event_types.MESSAGE_DELETED, chat.length);
}

export async function reloadCurrentChat() {
    clearChat();
    chat.length = 0;

    if (selected_group) {
        await getGroupChat(selected_group);
    }
    else if (this_chid) {
        await getChat();
    }
    else {
        resetChatState();
        printMessages();
    }
}

function messageFormatting(mes, ch_name, isSystem, isUser) {
    if (!mes) {
        mes = '';
    }

    if (power_user.auto_fix_generated_markdown) {
        mes = fixMarkdown(mes);
    }

    if (this_chid != undefined && !isSystem)
        mes = mes.replaceAll("<", "&lt;").replaceAll(">", "&gt;"); //for welcome message
    if ((this_chid === undefined || this_chid === "invalid-safety-id") && !selected_group) {
        mes = mes
            .replace(/\*\*(.+?)\*\*/g, "<b>$1</b>")
            .replace(/\n/g, "<br/>");
    } else if (!isSystem) {
        mes = mes.replace(/```[\s\S]*?```|``[\s\S]*?``|`[\s\S]*?`|(\".+?\")|(\u201C.+?\u201D)/gm, function (match, p1, p2) {
            if (p1) {
                return '<q>"' + p1.replace(/\"/g, "") + '"</q>';
            } else if (p2) {
                return '<q>“' + p2.replace(/\u201C|\u201D/g, "") + '”</q>';
            } else {
                return match;
            }
        });
        mes = mes.replaceAll('\\begin{align*}', '$$');
        mes = mes.replaceAll('\\end{align*}', '$$');
        mes = converter.makeHtml(mes);
        mes = mes.replace(/{{(\*?.*\*?)}}/g, "");

        mes = mes.replace(/\n/g, "<br/>");
        mes = mes.trim();

        mes = mes.replace(/<code(.*)>[\s\S]*?<\/code>/g, function (match) {
            return match.replace(/&amp;/g, '&');
        });
    }

    // Hides bias from empty messages send with slash commands
    if (isSystem) {
        mes = mes.replace(/{{(\*?.*\*?)}}/g, "");
    }

    if (!power_user.allow_name2_display && ch_name && !isUser && !isSystem) {
        mes = mes.replaceAll(`${ch_name}:`, "");
    }

    return mes;
}

function getMessageFromTemplate({ mesId, characterName, isUser, avatarImg, bias, isSystem, title, timerValue, timerTitle, bookmarkLink } = {}) {
    const mes = $('#message_template .mes').clone();
    mes.attr({
        'mesid': mesId,
        'ch_name': characterName,
        'is_user': isUser,
        'is_system': !!isSystem,
        'bookmark_link': bookmarkLink,
    });
    mes.find('.avatar img').attr('src', avatarImg);
    mes.find('.ch_name .name_text').text(characterName);
    mes.find('.mes_bias').html(bias);
    title && mes.attr('title', title);
    timerValue && mes.find('.mes_timer').attr('title', timerTitle).text(timerValue);

    return mes;
}

export function updateMessageBlock(messageId, message) {
    const messageElement = $(`#chat [mesid="${messageId}"]`);
    const text = message?.extra?.display_text ?? message.mes;
    messageElement.find('.mes_text').html(messageFormatting(text, message.name, message.is_system, message.is_user));
    addCopyToCodeBlocks(messageElement)
    appendImageToMessage(message, messageElement);
}

export function appendImageToMessage(mes, messageElement) {
    if (mes.extra?.image) {
        const image = messageElement.find('.mes_img');
        const text = messageElement.find('.mes_text');
        const isInline = !!mes.extra?.inline_image;
        image.attr('src', mes.extra?.image);
        image.attr('title', mes.extra?.title || mes.title || '');
        messageElement.find(".mes_img_container").addClass("img_extra");
        image.toggleClass("img_inline", isInline);
        text.toggleClass('displayNone', !isInline);
    }
}

export function addCopyToCodeBlocks(messageElement) {
    const codeBlocks = $(messageElement).find("pre code");
    for (let i = 0; i < codeBlocks.length; i++) {
        hljs.highlightElement(codeBlocks.get(i));
        if (navigator.clipboard !== undefined) {
            const copyButton = document.createElement('i');
            copyButton.classList.add('fa-solid', 'fa-copy', 'code-copy');
            copyButton.title = 'Copy code';
            codeBlocks.get(i).appendChild(copyButton);
            copyButton.addEventListener('pointerup', function (event) {
                navigator.clipboard.writeText(codeBlocks.get(i).innerText);
                toastr.info('Copied!', '', { timeOut: 2000 });
            });
        }
    }
}


function addOneMessage(mes, { type = "normal", insertAfter = null, scroll = true } = {}) {
    var messageText = mes["mes"];

    if (mes?.extra?.display_text) {
        messageText = mes.extra.display_text;
    }

    if (mes.name === name1) {
        var characterName = name1; //set to user's name by default
    } else { var characterName = mes.name }

    var avatarImg = "User Avatars/" + user_avatar;
    const isSystem = mes.is_system;
    const title = mes.title;
    generatedPromtCache = "";

    //for non-user mesages
    if (!mes["is_user"]) {
        if (mes.force_avatar) {
            avatarImg = mes.force_avatar;
        } else if (this_chid === undefined || this_chid === "invalid-safety-id") {
            avatarImg = system_avatar;
        } else {
            if (characters[this_chid].avatar != "none") {
                avatarImg = getThumbnailUrl('avatar', characters[this_chid].avatar);
                if (is_mes_reload_avatar !== false) {
                    avatarImg += "&" + is_mes_reload_avatar;
                }
            } else {
                avatarImg = default_avatar;
            }
        }
        //old processing:
        //if messge is from sytem, use the name provided in the message JSONL to proceed,
        //if not system message, use name2 (char's name) to proceed
        //characterName = mes.is_system || mes.force_avatar ? mes.name : name2;

    }

    if (count_view_mes == 0) {
        messageText = substituteParams(messageText);
    }
    messageText = messageFormatting(
        messageText,
        characterName,
        isSystem,
        mes.is_user,
    );
    const bias = messageFormatting(mes.extra?.bias ?? "");
    const bookmarkLink = mes?.extra?.bookmark_link ?? '';

    let params = {
        mesId: count_view_mes,
        characterName: characterName,
        isUser: mes.is_user,
        avatarImg: avatarImg,
        bias: bias,
        isSystem: isSystem,
        title: title,
        bookmarkLink: bookmarkLink,
        ...formatGenerationTimer(mes.gen_started, mes.gen_finished),
    };

    const HTMLForEachMes = getMessageFromTemplate(params);

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

    const newMessageId = type == 'swipe' ? count_view_mes - 1 : count_view_mes;
    const newMessage = $(`#chat [mesid="${newMessageId}"]`);
    const isSmallSys = mes?.extra?.isSmallSys;
    newMessage.data("isSystem", isSystem);

    if (isSystem) {
        // newMessage.find(".mes_edit").hide();
        newMessage.find(".mes_prompt").hide(); //don't need prompt button for sys
    }

    if (isSmallSys === true) {
        newMessage.addClass('smallSysMes');
    }

    // don't need prompt button for user
    if (params.isUser === true) {
        newMessage.find(".mes_prompt").hide();
        //console.log(`hiding prompt for user mesID ${params.mesId}`);
    }

    //shows or hides the Prompt display button
    let mesIdToFind = Number(newMessage.attr('mesId'));
    if (itemizedPrompts.length !== 0) {
        //console.log(`itemizedPrompt.length = ${itemizedPrompts.length}`)
        for (var i = 0; i < itemizedPrompts.length; i++) {
            if (itemizedPrompts[i].mesId === mesIdToFind) {
                newMessage.find(".mes_prompt").show();
                break;
                //console.log(`showing prompt for mesID ${params.mesId} from ${params.characterName}`);
            } else {
                //console.log(`no cache obj for mesID ${mesIdToFind}, hiding prompt button and continuing search`);
                newMessage.find(".mes_prompt").hide();
                //console.log(itemizedPrompts);
            }
        }
    } else if (params.isUser !== true) { //hide all when prompt cache is empty
        //console.log('saw empty prompt cache, hiding all prompt buttons');
        $(".mes_prompt").hide();
        //console.log(itemizedPrompts);
    } else {
        //console.log('skipping prompt data for User Message');
    }

    newMessage.find('.avatar img').on('error', function () {
        $(this).hide();
        $(this).parent().html(`<div class="missing-avatar fa-solid fa-user-slash"></div>`);
    });

    if (type === 'swipe') {
        $("#chat").find(`[mesid="${count_view_mes - 1}"]`).find('.mes_text').html('');
        $("#chat").find(`[mesid="${count_view_mes - 1}"]`).find('.mes_text').append(messageText);
        appendImageToMessage(mes, $("#chat").find(`[mesid="${count_view_mes - 1}"]`));
        $("#chat").find(`[mesid="${count_view_mes - 1}"]`).attr('title', title);

        if (mes.swipe_id == mes.swipes.length - 1) {
            $("#chat").find(`[mesid="${count_view_mes - 1}"]`).find('.mes_timer').text(params.timerValue);
            $("#chat").find(`[mesid="${count_view_mes - 1}"]`).find('.mes_timer').attr('title', params.timerTitle);
        } else {
            $("#chat").find(`[mesid="${count_view_mes - 1}"]`).find('.mes_timer').html('');
        }
    } else {
        $("#chat").find(`[mesid="${count_view_mes}"]`).find('.mes_text').append(messageText);
        appendImageToMessage(mes, newMessage);
        hideSwipeButtons();
        count_view_mes++;
    }

    addCopyToCodeBlocks(newMessage);

    // Don't scroll if not inserting last
    if (!insertAfter && scroll) {
        $('#chat .mes').last().addClass('last_mes');
        $('#chat .mes').eq(-2).removeClass('last_mes');

        hideSwipeButtons();
        showSwipeButtons();
        scrollChatToBottom();
    }
}

function formatGenerationTimer(gen_started, gen_finished) {
    if (!gen_started || !gen_finished) {
        return {};
    }

    const dateFormat = 'HH:mm:ss D MMM YYYY';
    const start = moment(gen_started);
    const finish = moment(gen_finished);
    const seconds = finish.diff(start, 'seconds', true);
    const timerValue = `${seconds.toFixed(1)}s`;
    const timerTitle = [
        `Generation queued: ${start.format(dateFormat)}`,
        `Reply received: ${finish.format(dateFormat)}`,
        `Time to generate: ${seconds} seconds`,
    ].join('\n');

    return { timerValue, timerTitle };
}

function scrollChatToBottom() {
    if (power_user.auto_scroll_chat_to_bottom) {
        var $textchat = $("#chat");
        $textchat.scrollTop(($textchat[0].scrollHeight));
    }
}

function substituteParams(content, _name1, _name2) {
    _name1 = _name1 ?? name1;
    _name2 = _name2 ?? name2;
    if (!content) {
        return ''
    }

    content = content.replace(/{{user}}/gi, _name1);
    content = content.replace(/{{char}}/gi, _name2);
    content = content.replace(/<USER>/gi, _name1);
    content = content.replace(/<BOT>/gi, _name2);
    content = content.replace(/{{time}}/gi, moment().format('LT'));
    content = content.replace(/{{date}}/gi, moment().format('LL'));
    return content;
}

function getStoppingStrings(isImpersonate, addSpace) {
    const charString = `\n${name2}:`;
    const youString = `\nYou:`;
    const userString = `\n${name1}:`;
    const result = isImpersonate ? [charString] : [youString];

    result.push(userString);

    // Add other group members as the stopping strings
    if (selected_group) {
        const group = groups.find(x => x.id === selected_group);

        if (group && Array.isArray(group.members)) {
            const names = group.members
                .map(x => characters.find(y => y.avatar == x))
                .filter(x => x && x.name !== name2)
                .map(x => `\n${x.name}:`);
            result.push(...names);
        }
    }

    // Cohee: oobabooga's textgen always appends newline before the sequence as a stopping string
    // But it's a problem for Metharme which doesn't use newlines to separate them.
    const wrap = (s) => power_user.instruct.wrap ? '\n' + s : s;

    if (power_user.instruct.enabled) {
        if (power_user.instruct.input_sequence) {
            result.push(substituteParams(wrap(power_user.instruct.input_sequence), name1, name2));
        }
        if (power_user.instruct.output_sequence) {
            result.push(substituteParams(wrap(power_user.instruct.output_sequence), name1, name2));
        }
    }

    return addSpace ? result.map(x => `${x} `) : result;
}

function processCommands(message, type) {
    if (type == "regenerate" || type == "swipe" || type == 'quiet') {
        return null;
    }

    const result = executeSlashCommands(message);
    $("#send_textarea").val(result.newText).trigger('input');

    // interrupt generation if the input was nothing but a command
    if (message.length > 0 && result.newText.length === 0) {
        return true;
    }

    return result.interrupt;
}

function sendSystemMessage(type, text, extra = {}) {
    const systemMessage = system_messages[type];

    if (!systemMessage) {
        return;
    }

    const newMessage = { ...systemMessage, send_date: humanizedDateTime() };

    if (text) {
        newMessage.mes = text;
    }

    if (type == system_message_types.HELP) {
        newMessage.mes += getSlashCommandsHelp();
    }

    if (!newMessage.extra) {
        newMessage.extra = {};
    }

    newMessage.extra = Object.assign(newMessage.extra, extra);
    newMessage.extra.type = type;

    chat.push(newMessage);
    addOneMessage(newMessage);
    is_send_press = false;
}

export function extractMessageBias(message) {
    if (!message) {
        return null;
    }

    const found = [];
    const rxp = /{{(\*?.+\*?)}}/g;
    //const rxp = /{([^}]+)}/g;
    let curMatch;

    while ((curMatch = rxp.exec(message))) {
        found.push(curMatch[1].trim());
    }

    let biasString = '';

    if (found.length) {
        biasString = ` ${found.join(" ")}`
    }

    return biasString;
}

function cleanGroupMessage(getMessage) {
    const group = groups.find((x) => x.id == selected_group);

    if (group && Array.isArray(group.members) && group.members) {
        for (let member of group.members) {
            const character = characters.find(x => x.avatar == member);

            if (!character) {
                continue;
            }

            const name = character.name;

            // Skip current speaker.
            if (name === name2) {
                continue;
            }

            const indexOfMember = getMessage.indexOf(`${name}:`);
            if (indexOfMember != -1) {
                getMessage = getMessage.substr(0, indexOfMember);
            }
        }
    }
    return getMessage;
}

function getAllExtensionPrompts() {
    const value = Object
        .values(extension_prompts)
        .filter(x => x.value)
        .map(x => x.value.trim())
        .join('\n');

    return value.length ? substituteParams(value) : '';
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
    if (extension_prompt.length) {
        extension_prompt = substituteParams(extension_prompt);
    }
    return extension_prompt;
}

function baseChatReplace(value, name1, name2) {
    if (value !== undefined && value.length > 0) {
        if (is_pygmalion) {
            value = value.replace(/{{user}}:/gi, 'You:');
            value = value.replace(/<USER>:/gi, 'You:');
        }

        value = substituteParams(value, name1, name2);

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

function isStreamingEnabled() {
    return ((main_api == 'openai' && oai_settings.stream_openai)
        || (main_api == 'poe' && poe_settings.streaming)
        || (main_api == 'textgenerationwebui' && textgenerationwebui_settings.streaming))
        && !isMultigenEnabled(); // Multigen has a quasi-streaming mode which breaks the real streaming
}

function showStopButton() {
    $('#mes_stop').css({ 'display': 'flex' });
}

function hideStopButton() {
    $('#mes_stop').css({ 'display': 'none' });
}

class StreamingProcessor {
    showMessageButtons(messageId) {
        if (messageId == -1) {
            return;
        }

        showStopButton();
        $(`#chat .mes[mesid="${messageId}"] .mes_buttons`).css({ 'display': 'none' });
    }

    hideMessageButtons(messageId) {
        if (messageId == -1) {
            return;
        }

        hideStopButton();
        $(`#chat .mes[mesid="${messageId}"] .mes_buttons`).css({ 'display': 'flex' });
    }

    onStartStreaming(text) {
        let messageId = -1;

        if (this.type == "impersonate") {
            $('#send_textarea').val('').trigger('input');
        }
        else {
            saveReply(this.type, text);
            messageId = count_view_mes - 1;
            this.showMessageButtons(messageId);
        }

        hideSwipeButtons();
        scrollChatToBottom();
        return messageId;
    }

    removePrefix(text) {
        const name1Marker = `${name1}: `;
        const name2Marker = `${name2}: `;

        if (text) {
            if (text.startsWith(name1Marker)) {
                text = text.replace(name1Marker, '');
            }
            if (text.startsWith(name2Marker)) {
                text = text.replace(name2Marker, '');
            }
        }
        return text;
    }

    onProgressStreaming(messageId, text, isFinal) {
        const isImpersonate = this.type == "impersonate";
        text = this.removePrefix(text);
        let processedText = cleanUpMessage(text, isImpersonate, !isFinal);
        let result = extractNameFromMessage(processedText, this.force_name2, isImpersonate);
        let isName = result.this_mes_is_name;
        processedText = result.getMessage;

        // Predict unbalanced asterisks during streaming
        if (!isFinal && isOdd(countOccurrences(processedText, '*'))) {
            // Add asterisk at the end to balance it
            processedText = processedText.trimEnd() + '*';
        }

        if (isImpersonate) {
            $('#send_textarea').val(processedText).trigger('input');
        }
        else {
            let currentTime = new Date();
            const timePassed = formatGenerationTimer(this.timeStarted, currentTime);
            chat[messageId]['is_name'] = isName;
            chat[messageId]['mes'] = processedText;
            chat[messageId]['gen_started'] = this.timeStarted;
            chat[messageId]['gen_finished'] = currentTime;

            if (this.type == 'swipe' && Array.isArray(chat[messageId]['swipes'])) {
                chat[messageId]['swipes'][chat[messageId]['swipe_id']] = processedText;
            }

            let formattedText = messageFormatting(
                processedText,
                chat[messageId].name,
                chat[messageId].is_system,
                chat[messageId].is_user,
            );
            const mesText = $(`#chat .mes[mesid="${messageId}"] .mes_text`);
            mesText.html(formattedText);
            $(`#chat .mes[mesid="${messageId}"] .mes_timer`).text(timePassed.timerValue).attr('title', timePassed.timerTitle);
            this.setFirstSwipe(messageId);
        }

        scrollChatToBottom();
    }

    onFinishStreaming(messageId, text) {
        this.hideMessageButtons(this.messageId);
        this.onProgressStreaming(messageId, text, true);
        addCopyToCodeBlocks($(`#chat .mes[mesid="${messageId}"]`));
        saveChatConditional();
        activateSendButtons();
        showSwipeButtons();
        setGenerationProgress(0);
        $('.mes_buttons:last').show();
        generatedPromtCache = '';

        //console.log("Generated text size:", text.length, text)

        if (power_user.auto_swipe) {
            function containsBlacklistedWords(str, blacklist, threshold) {
                const regex = new RegExp(`\\b(${blacklist.join('|')})\\b`, 'gi');
                const matches = str.match(regex) || [];
                return matches.length >= threshold;
            }

            const generatedTextFiltered = (text) => {
                if (text) {
                    if (power_user.auto_swipe_minimum_length) {
                        if (text.length < power_user.auto_swipe_minimum_length && text.length !== 0) {
                            console.log("Generated text size too small")
                            return true
                        }
                    }
                    if (power_user.auto_swipe_blacklist_threshold) {
                        if (containsBlacklistedWords(text, power_user.auto_swipe_blacklist, power_user.auto_swipe_blacklist_threshold)) {
                            console.log("Generated text has blacklisted words")
                            return true
                        }
                    }
                }
                return false
            }

            if (generatedTextFiltered(text)) {
                swipe_right()
                return
            }
        }
        playMessageSound();

        const eventType = this.type !== 'impersonate' ? event_types.MESSAGE_RECEIVED : event_types.IMPERSONATE_READY;
        const eventData = this.type !== 'impersonate' ? this.messageId : text;
        eventSource.emit(eventType, eventData);
    }

    onErrorStreaming() {
        this.hideMessageButtons(this.messageId);
        $("#send_textarea").removeAttr('disabled');
        is_send_press = false;
        activateSendButtons();
        setGenerationProgress(0);
        showSwipeButtons();
    }

    setFirstSwipe(messageId) {
        if (this.type !== 'swipe' && this.type !== 'impersonate') {
            if (Array.isArray(chat[messageId]['swipes']) && chat[messageId]['swipes'].length === 1 && chat[messageId]['swipe_id'] === 0) {
                chat[messageId]['swipes'][0] = chat[messageId]['mes'];
            }
        }
    }

    onStopStreaming() {
        this.onErrorStreaming();
    }

    nullStreamingGeneration() {
        throw new Error('Generation function for streaming is not hooked up');
    }

    constructor(type, force_name2) {
        this.result = "";
        this.messageId = -1;
        this.type = type;
        this.force_name2 = force_name2;
        this.isStopped = false;
        this.isFinished = false;
        this.generator = this.nullStreamingGeneration;
        this.abortController = new AbortController();
        this.firstMessageText = '...';
        this.timeStarted = new Date();
    }

    async generate() {
        if (this.messageId == -1) {
            this.messageId = this.onStartStreaming(this.firstMessageText);
            await delay(1); // delay for message to be rendered
        }

        for await (const text of this.generator()) {
            if (this.isStopped) {
                this.onStopStreaming();
                return;
            }

            try {
                this.result = text;
                this.onProgressStreaming(this.messageId, message_already_generated + text);
            }
            catch (err) {
                console.error(err);
                this.onErrorStreaming();
                this.isStopped = true;
                return;
            }
        }

        this.isFinished = true;
        return this.result;
    }
}

async function Generate(type, { automatic_trigger, force_name2, resolve, reject, quiet_prompt, force_chid, signal } = {}) {
    //console.log('Generate entered');
    setGenerationProgress(0);
    tokens_already_generated = 0;
    generation_started = new Date();

    // Don't recreate abort controller if signal is passed
    if (!(abortController && signal)) {
        abortController = new AbortController();
    }

    // OpenAI doesn't need instruct mode. Use OAI main prompt instead.
    const isInstruct = power_user.instruct.enabled && main_api !== 'openai';
    const isImpersonate = type == "impersonate";

    message_already_generated = isImpersonate ? `${name1}: ` : `${name2}: `;
    // Name for the multigen prefix
    const magName = isImpersonate ? (is_pygmalion ? 'You' : name1) : name2;

    if (isInstruct) {
        message_already_generated = formatInstructModePrompt(magName, isImpersonate, false, name1, name2);
    } else {
        message_already_generated = `${magName}: `;
    }

    // To trim after multigen ended
    const magFirst = message_already_generated;

    const interruptedByCommand = processCommands($("#send_textarea").val(), type);

    if (interruptedByCommand) {
        $("#send_textarea").val('').trigger('input');
        is_send_press = false;
        return;
    }

    if (main_api == 'textgenerationwebui' && textgenerationwebui_settings.streaming && !textgenerationwebui_settings.streaming_url) {
        toastr.error('Streaming URL is not set. Look it up in the console window when starting TextGen Web UI');
        is_send_press = false;
        return;
    }

    if (isHordeGenerationNotAllowed()) {
        is_send_press = false;
        return;
    }

    // Hide swipes on either multigen or real streaming
    if (isStreamingEnabled() || isMultigenEnabled()) {
        hideSwipeButtons();
    }

    // Set empty promise resolution functions
    if (typeof resolve !== 'function') {
        resolve = () => { };
    }
    if (typeof reject !== 'function') {
        reject = () => { };
    }

    if (selected_group && !is_group_generating) {
        generateGroupWrapper(false, type, { resolve, reject, quiet_prompt, force_chid, signal: abortController.signal });
        return;
    }

    if (online_status != 'no_connection' && this_chid != undefined && this_chid !== 'invalid-safety-id') {
        let textareaText;
        if (type !== 'regenerate' && type !== "swipe" && type !== 'quiet' && !isImpersonate) {
            is_send_press = true;
            textareaText = $("#send_textarea").val();
            $("#send_textarea").val('').trigger('input');
        } else {
            textareaText = "";
            if (chat.length && chat[chat.length - 1]['is_user']) {
                //do nothing? why does this check exist?
            }
            else if (type !== 'quiet' && type !== "swipe" && !isImpersonate) {
                chat.length = chat.length - 1;
                count_view_mes -= 1;
                $('#chat').children().last().hide(500, function () {
                    $(this).remove();
                });
                eventSource.emit(event_types.MESSAGE_DELETED, chat.length);
            }
        }

        deactivateSendButtons();

        let { messageBias, promptBias } = getBiasStrings(textareaText);

        //*********************************
        //PRE FORMATING STRING
        //*********************************

        //for normal messages sent from user..
        if (textareaText != "" && !automatic_trigger && type !== 'quiet') {
            // If user message contains no text other than bias - send as a system message
            if (messageBias && replaceBiasMarkup(textareaText).trim().length === 0) {
                sendSystemMessage(system_message_types.GENERIC, ' ', { bias: messageBias });
            }
            else {
                await sendMessageAsUser(textareaText, messageBias);
            }
        }
        ////////////////////////////////////
        const scenarioText = chat_metadata['scenario'] || characters[this_chid].scenario;
        let charDescription = baseChatReplace(characters[this_chid].description.trim(), name1, name2);
        let charPersonality = baseChatReplace(characters[this_chid].personality.trim(), name1, name2);
        let Scenario = baseChatReplace(scenarioText.trim(), name1, name2);
        let mesExamples = baseChatReplace(characters[this_chid].mes_example.trim(), name1, name2);

        // Parse example messages
        if (!mesExamples.startsWith('<START>')) {
            mesExamples = '<START>\n' + mesExamples.trim();
        }
        if (mesExamples.replace(/<START>/gi, '').trim().length === 0) {
            mesExamples = '';
        }
        const blockHeading =
            main_api === 'openai' ? '<START>' : // OpenAI handler always expects it
                power_user.custom_chat_separator ? power_user.custom_chat_separator :
                    power_user.disable_examples_formatting ? '' :
                        is_pygmalion ? '<START>' : `This is how ${name2} should talk`;
        let mesExamplesArray = mesExamples.split(/<START>/gi).slice(1).map(block => `${blockHeading}\n${block.trim()}\n`);

        // First message in fresh 1-on-1 chat reacts to user/character settings changes
        if (chat.length) {
            chat[0].mes = substituteParams(chat[0].mes);
        }

        // Collect messages with usable content
        let coreChat = chat.filter(x => !x.is_system);
        if (type === 'swipe') {
            coreChat.pop();
        }

        if (extension_settings.chromadb.n_results !== 0) {
            await runGenerationInterceptors(coreChat);
            console.log(`Core/all messages: ${coreChat.length}/${chat.length}`);
        }

        if (main_api === 'openai') {
            message_already_generated = ''; // OpenAI doesn't have multigen
            setOpenAIMessages(coreChat);
            setOpenAIMessageExamples(mesExamplesArray);
        }

        let storyString = "";

        if (is_pygmalion) {
            storyString += appendToStoryString(charDescription, power_user.disable_description_formatting ? '' : name2 + "'s Persona: ");
            storyString += appendToStoryString(charPersonality, power_user.disable_personality_formatting ? '' : 'Personality: ');
            storyString += appendToStoryString(Scenario, power_user.disable_scenario_formatting ? '' : 'Scenario: ');
        } else {
            storyString += appendToStoryString(charDescription, '');
            storyString += appendToStoryString(charPersonality, power_user.disable_personality_formatting ? '' : name2 + "'s personality: ");
            storyString += appendToStoryString(Scenario, power_user.disable_scenario_formatting ? '' : 'Circumstances and context of the dialogue: ');
        }

        if (promptBias || power_user.always_force_name2 || is_pygmalion) {
            force_name2 = true;
        }

        if (isImpersonate) {
            force_name2 = false;
        }

        if (isInstruct) {
            storyString = formatInstructStoryString(storyString);
        }

        //////////////////////////////////

        let chat2 = [];
        for (let i = coreChat.length - 1, j = 0; i >= 0; i--, j++) {
            // For OpenAI it's only used in WI
            if (main_api == 'openai' && !world_info) {
                console.log('No WI, skipping chat2 for OAI');
                break;
            }

            chat2[i] = formatMessageHistoryItem(coreChat[j], isInstruct);
        }

        // Determine token limit
        let this_max_context = getMaxContextSize();

        // Adjust token limit for Horde
        let adjustedParams;
        if (main_api == 'koboldhorde' && (horde_settings.auto_adjust_context_length || horde_settings.auto_adjust_response_length)) {
            try {
                adjustedParams = await adjustHordeGenerationParams(max_context, amount_gen);
            }
            catch {
                activateSendButtons();
                return;
            }
            if (horde_settings.auto_adjust_context_length) {
                this_max_context = (adjustedParams.maxContextLength - adjustedParams.maxLength);
            }
        }

        // Extension added strings
        let allAnchors = getAllExtensionPrompts();
        const afterScenarioAnchor = getExtensionPrompt(extension_prompt_types.AFTER_SCENARIO);
        let zeroDepthAnchor = getExtensionPrompt(extension_prompt_types.IN_CHAT, 0, ' ');
        let { worldInfoString, worldInfoBefore, worldInfoAfter } = getWorldInfoPrompt(chat2);

        // Moved here to not overflow the Poe context with added prompt bits
        if (main_api == 'poe') {
            allAnchors = appendPoeAnchors(type, allAnchors);
            zeroDepthAnchor = appendPoeAnchors(type, zeroDepthAnchor);
        }

        // hack for regeneration of the first message
        if (chat2.length == 0) {
            chat2.push('');
        }

        let examplesString = '';
        let chatString = '';
        function canFitMessages() {
            const encodeString = [
                worldInfoString,
                storyString,
                examplesString,
                chatString,
                allAnchors,
                quiet_prompt,
            ].join('').replace(/\r/gm, '');
            return getTokenCount(encodeString, power_user.token_padding) < this_max_context;
        }

        // Force pinned examples into the context
        let pinExmString;
        if (power_user.pin_examples) {
            pinExmString = examplesString = mesExamplesArray.join('');
        }

        // Collect enough messages to fill the context
        let arrMes = [];
        for (let item of chat2) {
            // not needed for OAI prompting
            if (main_api == 'openai') {
                break;
            }

            chatString = item + chatString;
            if (canFitMessages()) {
                arrMes[arrMes.length] = item;
            } else {
                break;
            }

            // Prevent UI thread lock on tokenization
            await delay(1);
        }

        if (main_api !== 'openai') {
            setInContextMessages(arrMes.length, type);
        }

        // Estimate how many unpinned example messages fit in the context
        let count_exm_add = 0;
        if (!power_user.pin_examples) {
            for (let example of mesExamplesArray) {
                examplesString += example;
                if (canFitMessages()) {
                    count_exm_add++;
                } else {
                    break;
                }
                await delay(1);
            }
        }

        let mesSend = [];
        console.log('calling runGenerate');
        streamingProcessor = isStreamingEnabled() ? new StreamingProcessor(type, force_name2) : false;
        runGenerate();

        async function runGenerate(cycleGenerationPromt = '') {
            is_send_press = true;

            generatedPromtCache += cycleGenerationPromt;
            if (generatedPromtCache.length == 0) {
                if (main_api === 'openai') {
                    generateOpenAIPromptCache();
                }

                console.log('generating prompt');
                chatString = "";
                arrMes = arrMes.reverse();
                arrMes.forEach(function (item, i, arr) {//For added anchors and others
                    // OAI doesn't need all of this
                    if (main_api === 'openai') {
                        return;
                    }

                    if (i === arrMes.length - 1 && !item.trim().startsWith(name1 + ":")) {
                        if (textareaText == "") {
                            // Cohee: I think this was added to allow the model to continue
                            // where it left off by removing the trailing newline at the end
                            // that was added by chat2 generator. This causes problems with
                            // instruct mode that could not have a trailing newline. So we're
                            // removing a newline ONLY at the end of the string if it exists.
                            item = item.replace(/\n?$/, '');
                            //item = item.substr(0, item.length - 1);
                        }
                    }
                    if (is_pygmalion && !isInstruct) {
                        if (item.trim().startsWith(name1)) {
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

            let mesExmString = '';
            let mesSendString = '';

            function setPromtString() {
                if (main_api == 'openai') {
                    return;
                }

                console.log('--setting Prompt string');
                mesExmString = pinExmString ?? mesExamplesArray.slice(0, count_exm_add).join('');
                mesSendString = '';
                for (let j = 0; j < mesSend.length; j++) {
                    const isBottom = j === mesSend.length - 1;
                    mesSendString += mesSend[j];

                    if (isBottom) {
                        mesSendString = modifyLastPromptLine(mesSendString);
                    }
                }
            }

            function modifyLastPromptLine(mesSendString) {
                // Add quiet generation prompt at depth 0
                if (quiet_prompt && quiet_prompt.length) {
                    const name = is_pygmalion ? 'You' : name1;
                    const quietAppend = isInstruct ? formatInstructModeChat(name, quiet_prompt, false, true, false, name1, name2) : `\n${name}: ${quiet_prompt}`;
                    mesSendString += quietAppend;
                }

                // Get instruct mode line
                if (isInstruct && tokens_already_generated === 0) {
                    const name = isImpersonate ? (is_pygmalion ? 'You' : name1) : name2;
                    mesSendString += formatInstructModePrompt(name, isImpersonate, promptBias, name1, name2);
                }

                // Get non-instruct impersonation line
                if (!isInstruct && isImpersonate && tokens_already_generated === 0) {
                    const name = is_pygmalion ? 'You' : name1;
                    if (!mesSendString.endsWith('\n')) {
                        mesSendString += '\n';
                    }
                    mesSendString += name + ':';
                }

                // Add character's name
                if (!isInstruct && force_name2 && tokens_already_generated === 0) {
                    if (!mesSendString.endsWith('\n')) {
                        mesSendString += '\n';
                    }
                    mesSendString += (`${name2}:${promptBias || ''}`);
                }

                return mesSendString;
            }

            function checkPromtSize() {
                console.log('---checking Prompt size');
                setPromtString();
                const prompt = [
                    worldInfoString,
                    storyString,
                    mesExmString,
                    mesSendString,
                    generatedPromtCache,
                    allAnchors,
                    quiet_prompt,
                ].join('').replace(/\r/gm, '');
                let thisPromtContextSize = getTokenCount(prompt, power_user.token_padding);

                if (thisPromtContextSize > this_max_context) {        //if the prepared prompt is larger than the max context size...
                    if (count_exm_add > 0) {                            // ..and we have example mesages..
                        count_exm_add--;                            // remove the example messages...
                        checkPromtSize();                            // and try agin...
                    } else if (mesSend.length > 0) {                    // if the chat history is longer than 0
                        mesSend.shift();                            // remove the first (oldest) chat entry..
                        checkPromtSize();                            // and check size again..
                    } else {
                        //end
                        console.log(`---mesSend.length = ${mesSend.length}`);
                    }
                }
            }

            if (generatedPromtCache.length > 0 && main_api !== 'openai') {
                console.log('---Generated Prompt Cache length: ' + generatedPromtCache.length);
                checkPromtSize();
            } else {
                console.log('---calling setPromtString ' + generatedPromtCache.length)
                setPromtString();
            }

            // add a custom dingus (if defined)
            mesSendString = adjustChatsSeparator(mesSendString);

            let finalPromt =
                worldInfoBefore +
                storyString +
                worldInfoAfter +
                afterScenarioAnchor +
                mesExmString +
                mesSendString +
                generatedPromtCache;

            if (zeroDepthAnchor && zeroDepthAnchor.length) {
                if (!isMultigenEnabled() || tokens_already_generated == 0) {
                    finalPromt = appendZeroDepthAnchor(force_name2, zeroDepthAnchor, finalPromt);
                }
            }

            finalPromt = finalPromt.replace(/\r/gm, '');

            if (power_user.collapse_newlines) {
                finalPromt = collapseNewlines(finalPromt);
            }
            let this_amount_gen = parseInt(amount_gen); // how many tokens the AI will be requested to generate
            let this_settings = koboldai_settings[koboldai_setting_names[preset_settings]];

            if (isMultigenEnabled() && type !== 'quiet') {
                // if nothing has been generated yet..
                this_amount_gen = getMultigenAmount();
            }

            let thisPromptBits = [];

            if (main_api == 'koboldhorde' && horde_settings.auto_adjust_response_length) {
                this_amount_gen = Math.min(this_amount_gen, adjustedParams.maxLength);
                this_amount_gen = Math.max(this_amount_gen, MIN_AMOUNT_GEN); // prevent validation errors
            }

            let generate_data;
            if (main_api == 'koboldhorde' || main_api == 'kobold') {
                generate_data = {
                    prompt: finalPromt,
                    gui_settings: true,
                    max_length: amount_gen,
                    temperature: kai_settings.temp,
                    max_context_length: max_context,
                    singleline: kai_settings.single_line,
                };

                if (preset_settings != 'gui') {
                    const maxContext = (adjustedParams && horde_settings.auto_adjust_context_length) ? adjustedParams.maxContextLength : max_context;
                    generate_data = getKoboldGenerationData(finalPromt, this_settings, this_amount_gen, maxContext, isImpersonate);
                }
            }
            else if (main_api == 'textgenerationwebui') {
                generate_data = getTextGenGenerationData(finalPromt, this_amount_gen, isImpersonate);
            }
            else if (main_api == 'novel') {
                const this_settings = novelai_settings[novelai_setting_names[nai_settings.preset_settings_novel]];
                generate_data = getNovelGenerationData(finalPromt, this_settings, this_amount_gen);
            }
            else if (main_api == 'openai') {
                let [prompt, counts] = await prepareOpenAIMessages(name2, storyString, worldInfoBefore, worldInfoAfter, afterScenarioAnchor, promptBias, type, quiet_prompt);
                generate_data = { prompt: prompt };

                // counts will return false if the user has not enabled the token breakdown feature
                if (counts) {
                    parseTokenCounts(counts, thisPromptBits);
                }

                setInContextMessages(openai_messages_count, type);
            } else if (main_api == 'poe') {
                generate_data = { prompt: finalPromt };
            }

            if (power_user.console_log_prompts) {

                console.log(generate_data.prompt);
            }

            let generate_url = getGenerateUrl();
            console.log('rungenerate calling API');

            showStopButton();

            if (main_api == 'openai') {
                if (isStreamingEnabled() && type !== 'quiet') {
                    streamingProcessor.generator = await sendOpenAIRequest(type, generate_data.prompt, streamingProcessor.abortController.signal);
                }
                else {
                    sendOpenAIRequest(type, generate_data.prompt, abortController.signal).then(onSuccess).catch(onError);
                }
            }
            else if (main_api == 'koboldhorde') {
                generateHorde(finalPromt, generate_data, abortController.signal).then(onSuccess).catch(onError);
            }
            else if (main_api == 'poe') {
                if (isStreamingEnabled() && type !== 'quiet') {
                    streamingProcessor.generator = await generatePoe(type, finalPromt, streamingProcessor.abortController.signal);
                }
                else {
                    generatePoe(type, finalPromt, abortController.signal).then(onSuccess).catch(onError);
                }
            }
            else if (main_api == 'textgenerationwebui' && isStreamingEnabled() && type !== 'quiet') {
                streamingProcessor.generator = await generateTextGenWithStreaming(generate_data, streamingProcessor.abortController.signal);
            }
            else {
                try {
                    const response = await fetch(generate_url, {
                        method: 'POST',
                        headers: getRequestHeaders(),
                        cache: 'no-cache',
                        body: JSON.stringify(generate_data),
                        signal: abortController.signal,
                    });

                    if (!response.ok) {
                        throw new Error(response.status);
                    }

                    const data = await response.json();
                    onSuccess(data);
                } catch (error) {
                    onError(error);
                }
            }

            //set array object for prompt token itemization of this message
            let currentArrayEntry = Number(thisPromptBits.length - 1);
            let additionalPromptStuff = {
                ...thisPromptBits[currentArrayEntry],
                rawPrompt: generate_data.prompt,
                mesId: type == 'swipe' ? Number(count_view_mes - 1) : Number(count_view_mes),
                worldInfoBefore: worldInfoBefore,
                allAnchors: allAnchors,
                summarizeString: (extension_prompts['1_memory']?.value || ''),
                authorsNoteString: (extension_prompts['2_floating_prompt']?.value || ''),
                worldInfoString: worldInfoString,
                storyString: storyString,
                worldInfoAfter: worldInfoAfter,
                afterScenarioAnchor: afterScenarioAnchor,
                examplesString: examplesString,
                mesSendString: mesSendString,
                generatedPromtCache: generatedPromtCache,
                promptBias: promptBias,
                finalPromt: finalPromt,
                charDescription: charDescription,
                charPersonality: charPersonality,
                scenarioText: scenarioText,
                this_max_context: this_max_context,
                padding: power_user.token_padding,
                main_api: main_api,
            };

            thisPromptBits = additionalPromptStuff;

            //console.log(thisPromptBits);

            itemizedPrompts.push(thisPromptBits);
            //console.log(`pushed prompt bits to itemizedPrompts array. Length is now: ${itemizedPrompts.length}`);

            if (isStreamingEnabled() && type !== 'quiet') {
                hideSwipeButtons();
                let getMessage = await streamingProcessor.generate();

                if (streamingProcessor && !streamingProcessor.isStopped && streamingProcessor.isFinished) {
                    streamingProcessor.onFinishStreaming(streamingProcessor.messageId, getMessage);
                    streamingProcessor = null;
                }
            }

            async function onSuccess(data) {
                hideStopButton();
                is_send_press = false;
                if (!data.error) {
                    //const getData = await response.json();
                    let getMessage = extractMessageFromData(data);
                    let title = extractTitleFromData(data);

                    //Pygmalion run again
                    // to make it continue generating so long as it's under max_amount and hasn't signaled
                    // an end to the character's response via typing "You:" or adding "<endoftext>"
                    if (isMultigenEnabled() && type !== 'quiet') {
                        message_already_generated += getMessage;
                        promptBias = '';

                        let this_mes_is_name;
                        ({ this_mes_is_name, getMessage } = extractNameFromMessage(getMessage, force_name2, isImpersonate));

                        if (!isImpersonate) {
                            if (tokens_already_generated == 0) {
                                console.log("New message");
                                ({ type, getMessage } = saveReply(type, getMessage, this_mes_is_name, title));
                            }
                            else {
                                console.log("Should append message");
                                ({ type, getMessage } = saveReply('append', getMessage, this_mes_is_name, title));
                            }
                        } else {
                            let chunk = cleanUpMessage(message_already_generated, true, true);
                            let extract = extractNameFromMessage(chunk, force_name2, isImpersonate);
                            $('#send_textarea').val(extract.getMessage).trigger('input');
                        }

                        if (shouldContinueMultigen(getMessage, isImpersonate, isInstruct)) {
                            hideSwipeButtons();
                            tokens_already_generated += this_amount_gen;            // add new gen amt to any prev gen counter..
                            getMessage = message_already_generated;

                            // if any tokens left to generate
                            if (getMultigenAmount() > 0) {
                                runGenerate(getMessage);
                                console.log('returning to make generate again');
                                return;
                            }
                        }

                        tokens_already_generated = 0;
                        generatedPromtCache = "";
                        getMessage = message_already_generated.substring(magFirst.length);
                    }

                    //Formating
                    getMessage = cleanUpMessage(getMessage, isImpersonate);

                    let this_mes_is_name;
                    ({ this_mes_is_name, getMessage } = extractNameFromMessage(getMessage, force_name2, isImpersonate));
                    if (getMessage.length > 0) {
                        if (isImpersonate) {
                            $('#send_textarea').val(getMessage).trigger('input');
                            generatedPromtCache = "";
                            eventSource.emit(event_types.IMPERSONATE_READY, getMessage);
                        }
                        else if (type == 'quiet') {
                            resolve(getMessage);
                        }
                        else {
                            if (!isMultigenEnabled()) {
                                ({ type, getMessage } = saveReply(type, getMessage, this_mes_is_name, title));
                            }
                            else {
                                ({ type, getMessage } = saveReply('appendFinal', getMessage, this_mes_is_name, title));
                            }
                            await eventSource.emit(event_types.MESSAGE_RECEIVED, (chat.length - 1));
                        }
                        activateSendButtons();

                        if (type !== 'quiet') {
                            playMessageSound();
                        }

                        generate_loop_counter = 0;
                    } else {
                        ++generate_loop_counter;

                        if (generate_loop_counter > MAX_GENERATION_LOOPS) {
                            throwCircuitBreakerError();
                        }

                        // regenerate with character speech reenforced
                        // to make sure we leave on swipe type while also adding the name2 appendage
                        setTimeout(() => {
                            Generate(type, { automatic_trigger, force_name2: true, resolve, reject, quiet_prompt, force_chid });
                        }, generate_loop_counter * 1000);
                    }

                    if (power_user.auto_swipe) {
                        console.log('checking for autoswipeblacklist on non-streaming message');
                        function containsBlacklistedWords(getMessage, blacklist, threshold) {
                            console.log('checking blacklisted words');
                            const regex = new RegExp(`\\b(${blacklist.join('|')})\\b`, 'gi');
                            const matches = getMessage.match(regex) || [];
                            return matches.length >= threshold;
                        }

                        const generatedTextFiltered = (getMessage) => {
                            if (power_user.auto_swipe_blacklist_threshold) {
                                if (containsBlacklistedWords(getMessage, power_user.auto_swipe_blacklist, power_user.auto_swipe_blacklist_threshold)) {
                                    console.log("Generated text has blacklisted words")
                                    return true
                                }
                            }

                            return false
                        }
                        if (generatedTextFiltered(getMessage)) {
                            console.log('swiping right automatically');
                            swipe_right();
                            return
                        }
                    }
                } else {
                    generatedPromtCache = '';
                    activateSendButtons();
                    //console.log('runGenerate calling showSwipeBtns');
                    showSwipeButtons();
                }
                console.log('/savechat called by /Generate');

                saveChatConditional();
                activateSendButtons();
                showSwipeButtons();
                setGenerationProgress(0);
                $('.mes_buttons:last').show();

                if (type !== 'quiet') {
                    resolve();
                }
            };

            function onError(exception) {
                reject(exception);
                $("#send_textarea").removeAttr('disabled');
                is_send_press = false;
                activateSendButtons();
                showSwipeButtons();
                setGenerationProgress(0);
                $('.mes_buttons:last').show();
                console.log(exception);
            };

        } //rungenerate ends
    } else {    //generate's primary loop ends, after this is error handling for no-connection or safety-id
        if (this_chid === undefined || this_chid === 'invalid-safety-id') {
            toastr.warning('Сharacter is not selected');
        }
        is_send_press = false;
    }
    //console.log('generate ending');
} //generate ends

export function getBiasStrings(textareaText) {
    let promptBias = '';
    let messageBias = extractMessageBias(textareaText);

    // gets bias of the latest message where it was applied
    for (let mes of chat.slice().reverse()) {
        if (mes && mes.extra && (mes.is_user || mes.is_system || mes.extra.type === system_message_types.NARRATOR)) {
            if (mes.extra.bias && mes.extra.bias.trim().length > 0) {
                promptBias = mes.extra.bias;
            }
            break;
        }
    }

    promptBias = messageBias || promptBias || '';
    return { messageBias, promptBias };
}

function formatMessageHistoryItem(chatItem, isInstruct) {
    const isNarratorType = chatItem?.extra?.type === system_message_types.NARRATOR;
    const characterName = (selected_group || chatItem.force_avatar) ? chatItem.name : name2;
    const itemName = chatItem.is_user ? chatItem['name'] : characterName;
    const shouldPrependName = (chatItem.is_name || chatItem.force_avatar || selected_group) && !isNarratorType;

    let textResult = shouldPrependName ? `${itemName}: ${chatItem.mes}\n` : `${chatItem.mes}\n`;

    if (isInstruct) {
        textResult = formatInstructModeChat(itemName, chatItem.mes, chatItem.is_user, isNarratorType, chatItem.force_avatar, name1, name2);
    }

    textResult = replaceBiasMarkup(textResult);

    return textResult;
}

export function replaceBiasMarkup(str) {
    return (str ?? '').replace(/{{(\*?.*\*?)}}/g, '');
}

export async function sendMessageAsUser(textareaText, messageBias) {
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

    addOneMessage(chat[chat.length - 1]);
    // Wait for all handlers to finish before continuing with the prompt
    await eventSource.emit(event_types.MESSAGE_SENT, (chat.length - 1));
    console.log('message sent as user');
}

function getMaxContextSize() {
    let this_max_context = 1487;
    if (main_api == 'kobold' || main_api == 'koboldhorde' || main_api == 'textgenerationwebui') {
        this_max_context = (max_context - amount_gen);
    }
    if (main_api == 'novel') {
        if (novel_tier === 1) {
            this_max_context = 1024;
        } else {
            this_max_context = Number(max_context);
            if (nai_settings.model_novel == 'krake-v2') {
                this_max_context -= 160;
            }
            if (nai_settings.model_novel == 'clio-v1') {
                // Clio has a max context of 8192
                // TODO: Evaluate the relevance of nerdstash-v1 tokenizer, changes quite a bit.
                this_max_context = 8192 - 60 - 160;
            }
        }
    }
    if (main_api == 'openai') {
        this_max_context = oai_settings.openai_max_context;
    }
    if (main_api == 'poe') {
        this_max_context = Number(max_context);
    }
    return this_max_context;
}

function parseTokenCounts(counts, thisPromptBits) {
    const total = Object.values(counts).filter(x => !Number.isNaN(x)).reduce((acc, val) => acc + val, 0);

    thisPromptBits.push({
        oaiStartTokens: Object.entries(counts)[0][1],
        oaiPromptTokens: Object.entries(counts)[1][1],
        oaiBiasTokens: Object.entries(counts)[2][1],
        oaiNudgeTokens: Object.entries(counts)[3][1],
        oaiJailbreakTokens: Object.entries(counts)[4][1],
        oaiImpersonateTokens: Object.entries(counts)[5][1],
        oaiExamplesTokens: Object.entries(counts)[6][1],
        oaiConversationTokens: Object.entries(counts)[7][1],
        oaiTotalTokens: total,
    });
}

function adjustChatsSeparator(mesSendString) {
    if (power_user.custom_chat_separator && power_user.custom_chat_separator.length) {
        mesSendString = power_user.custom_chat_separator + '\n' + mesSendString;
    }

    // if chat start formatting is disabled
    else if (power_user.disable_start_formatting) {
        mesSendString = mesSendString;
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

    return mesSendString;
}

function appendZeroDepthAnchor(force_name2, zeroDepthAnchor, finalPromt) {
    const trimBothEnds = !force_name2 && !is_pygmalion;
    let trimmedPrompt = (trimBothEnds ? zeroDepthAnchor.trim() : zeroDepthAnchor.trimEnd());

    if (trimBothEnds && !finalPromt.endsWith('\n')) {
        finalPromt += '\n';
    }

    finalPromt += trimmedPrompt;

    if (force_name2 || is_pygmalion) {
        finalPromt += ' ';
    }

    return finalPromt;
}

function getMultigenAmount() {
    let this_amount_gen = parseInt(amount_gen);

    if (tokens_already_generated === 0) {
        // if the max gen setting is > 50...(
        if (parseInt(amount_gen) >= power_user.multigen_first_chunk) {
            // then only try to make 50 this cycle..
            this_amount_gen = power_user.multigen_first_chunk;
        }
        else {
            // otherwise, make as much as the max amount request.
            this_amount_gen = parseInt(amount_gen);
        }
    }
    // if we already received some generated text...
    else {
        // if the remaining tokens to be made is less than next potential cycle count
        if (parseInt(amount_gen) - tokens_already_generated < power_user.multigen_next_chunks) {
            // subtract already generated amount from the desired max gen amount
            this_amount_gen = parseInt(amount_gen) - tokens_already_generated;
        }
        else {
            // otherwise make the standard cycle amount (first 50, and 30 after that)
            this_amount_gen = power_user.multigen_next_chunks;
        }
    }
    return this_amount_gen;
}

function promptItemize(itemizedPrompts, requestedMesId) {
    var incomingMesId = Number(requestedMesId);
    console.log(`looking for MesId ${incomingMesId}`);
    var thisPromptSet = undefined;

    for (var i = 0; i < itemizedPrompts.length; i++) {
        if (itemizedPrompts[i].mesId === incomingMesId) {
            thisPromptSet = i;
            PromptArrayItemForRawPromptDisplay = Number(i);
        }
    }

    if (thisPromptSet === undefined) {
        console.log(`couldnt find the right mesId. looked for ${incomingMesId}`);
        console.log(itemizedPrompts);
        return null;
    }

    //these happen regardless of API
    var charPersonalityTokens = getTokenCount(itemizedPrompts[thisPromptSet].charPersonality);
    var charDescriptionTokens = getTokenCount(itemizedPrompts[thisPromptSet].charDescription);
    var scenarioTextTokens = getTokenCount(itemizedPrompts[thisPromptSet].scenarioText);
    var allAnchorsTokens = getTokenCount(itemizedPrompts[thisPromptSet].allAnchors);
    var summarizeStringTokens = getTokenCount(itemizedPrompts[thisPromptSet].summarizeString);
    var authorsNoteStringTokens = getTokenCount(itemizedPrompts[thisPromptSet].authorsNoteString);
    var afterScenarioAnchorTokens = getTokenCount(itemizedPrompts[thisPromptSet].afterScenarioAnchor);
    var zeroDepthAnchorTokens = getTokenCount(itemizedPrompts[thisPromptSet].afterScenarioAnchor);
    var worldInfoStringTokens = getTokenCount(itemizedPrompts[thisPromptSet].worldInfoString);
    var thisPrompt_max_context = itemizedPrompts[thisPromptSet].this_max_context;
    var thisPrompt_padding = itemizedPrompts[thisPromptSet].padding;
    var promptBiasTokens = getTokenCount(itemizedPrompts[thisPromptSet].promptBias);
    var this_main_api = itemizedPrompts[thisPromptSet].main_api;

    if (this_main_api == 'openai') {
        //for OAI API
        //console.log('-- Counting OAI Tokens');

        //var finalPromptTokens = itemizedPrompts[thisPromptSet].oaiTotalTokens;
        var oaiStartTokens = itemizedPrompts[thisPromptSet].oaiStartTokens;
        var oaiPromptTokens = itemizedPrompts[thisPromptSet].oaiPromptTokens;
        var ActualChatHistoryTokens = itemizedPrompts[thisPromptSet].oaiConversationTokens;
        var examplesStringTokens = itemizedPrompts[thisPromptSet].oaiExamplesTokens;
        var oaiBiasTokens = itemizedPrompts[thisPromptSet].oaiBiasTokens;
        var oaiJailbreakTokens = itemizedPrompts[thisPromptSet].oaiJailbreakTokens;
        var oaiNudgeTokens = itemizedPrompts[thisPromptSet].oaiNudgeTokens;
        var oaiImpersonateTokens = itemizedPrompts[thisPromptSet].oaiImpersonateTokens;
        var finalPromptTokens =
            oaiStartTokens +
            oaiPromptTokens +
            oaiBiasTokens +
            oaiImpersonateTokens +
            oaiJailbreakTokens +
            oaiNudgeTokens +
            ActualChatHistoryTokens +
            //charDescriptionTokens +
            //charPersonalityTokens +
            //allAnchorsTokens +
            //worldInfoStringTokens +
            examplesStringTokens;
        // OAI doesn't use padding
        thisPrompt_padding = 0;
        // Max context size - max completion tokens
        thisPrompt_max_context = (oai_settings.openai_max_context - oai_settings.openai_max_tokens);
    } else {
        //for non-OAI APIs
        //console.log('-- Counting non-OAI Tokens');
        var finalPromptTokens = getTokenCount(itemizedPrompts[thisPromptSet].finalPromt);
        var storyStringTokens = getTokenCount(itemizedPrompts[thisPromptSet].storyString);
        var examplesStringTokens = getTokenCount(itemizedPrompts[thisPromptSet].examplesString);
        var mesSendStringTokens = getTokenCount(itemizedPrompts[thisPromptSet].mesSendString)
        var ActualChatHistoryTokens = mesSendStringTokens - allAnchorsTokens + power_user.token_padding;

        var totalTokensInPrompt =
            storyStringTokens +     //chardefs total
            worldInfoStringTokens +
            ActualChatHistoryTokens +  //chat history
            allAnchorsTokens +      // AN and/or legacy anchors
            //afterScenarioAnchorTokens +       //only counts if AN is set to 'after scenario'
            //zeroDepthAnchorTokens +           //same as above, even if AN not on 0 depth
            promptBiasTokens;       //{{}}
        //- thisPrompt_padding;  //not sure this way of calculating is correct, but the math results in same value as 'finalPromt'
    }

    if (this_main_api == 'openai') {
        //console.log('-- applying % on OAI tokens');
        var oaiStartTokensPercentage = ((oaiStartTokens / (finalPromptTokens)) * 100).toFixed(2);
        var storyStringTokensPercentage = ((oaiPromptTokens / (finalPromptTokens)) * 100).toFixed(2);
        var ActualChatHistoryTokensPercentage = ((ActualChatHistoryTokens / (finalPromptTokens)) * 100).toFixed(2);
        var promptBiasTokensPercentage = ((oaiBiasTokens / (finalPromptTokens)) * 100).toFixed(2);
        var worldInfoStringTokensPercentage = ((worldInfoStringTokens / (finalPromptTokens)) * 100).toFixed(2);
        var allAnchorsTokensPercentage = ((allAnchorsTokens / (finalPromptTokens)) * 100).toFixed(2);
        var selectedTokenizer = `tiktoken (${oai_settings.openai_model})`;
        var oaiSystemTokens = oaiImpersonateTokens + oaiJailbreakTokens + oaiNudgeTokens + oaiStartTokens;
        var oaiSystemTokensPercentage = ((oaiSystemTokens / (finalPromptTokens)) * 100).toFixed(2);

    } else {
        //console.log('-- applying % on non-OAI tokens');
        var storyStringTokensPercentage = ((storyStringTokens / (totalTokensInPrompt)) * 100).toFixed(2);
        var ActualChatHistoryTokensPercentage = ((ActualChatHistoryTokens / (totalTokensInPrompt)) * 100).toFixed(2);
        var promptBiasTokensPercentage = ((promptBiasTokens / (totalTokensInPrompt)) * 100).toFixed(2);
        var worldInfoStringTokensPercentage = ((worldInfoStringTokens / (totalTokensInPrompt)) * 100).toFixed(2);
        var allAnchorsTokensPercentage = ((allAnchorsTokens / (totalTokensInPrompt)) * 100).toFixed(2);
        var selectedTokenizer = $("#tokenizer").find(':selected').text();
    }

    if (this_main_api == 'openai') {
        //console.log('-- calling popup for OAI tokens');
        callPopup(
            `
        <h3>Prompt Itemization</h3>
        Tokenizer: TikToken<br>
        API Used: ${this_main_api}<br>
        <span class="tokenItemizingSubclass">
            Only the white numbers really matter. All numbers are estimates.
            Grey color items may not have been included in the context due to certain prompt format settings.
        </span>
        <div id="showRawPrompt" class="fa-solid fa-square-poll-horizontal menu_button"></div>
        <hr>
        <div class="justifyLeft">
            <div class="flex-container">
                <div class="flex-container flex1 flexFlowColumns flexNoGap wide50p tokenGraph">
                <div class="wide100p" style="background-color: grey; height: ${oaiSystemTokensPercentage}%;"></div>
                    <div class="wide100p" style="background-color: salmon; height: ${oaiStartTokensPercentage}%;"></div>
                    <div class="wide100p" style="background-color: indianred; height: ${storyStringTokensPercentage}%;"></div>
                    <div class="wide100p" style="background-color: gold; height: ${worldInfoStringTokensPercentage}%;"></div>
                    <div class="wide100p" style="background-color: palegreen; height: ${ActualChatHistoryTokensPercentage}%;"></div>
                    <div class="wide100p" style="background-color: cornflowerblue; height: ${allAnchorsTokensPercentage}%;"></div>
                    <div class="wide100p" style="background-color: mediumpurple; height: ${promptBiasTokensPercentage}%;"></div>
                </div>
                <div class="flex-container wide50p">
                    <div class="wide100p flex-container flexNoGap flexFlowColumn">
                        <div class="flex-container wide100p">
                            <div class="flex1" style="color: grey;">System Info:</div>
                            <div  class=""> ${oaiSystemTokens}</div>
                        </div>
                        <div class="flex-container ">
                            <div  class=" flex1 tokenItemizingSubclass">-- Chat Start: </div>
                            <div  class="tokenItemizingSubclass"> ${oaiStartTokens}</div>
                        </div>
                        <div class="flex-container ">
                            <div  class=" flex1 tokenItemizingSubclass">-- Jailbreak: </div>
                            <div  class="tokenItemizingSubclass">${oaiJailbreakTokens}</div>
                        </div>
                        <div class="flex-container ">
                            <div  class=" flex1 tokenItemizingSubclass">-- NSFW: </div>
                            <div  class="tokenItemizingSubclass">??</div>
                        </div>
                        <div class="flex-container ">
                            <div  class=" flex1 tokenItemizingSubclass">-- Nudge: </div>
                            <div  class="tokenItemizingSubclass">${oaiNudgeTokens}</div>
                        </div>
                        <div class="flex-container ">
                            <div  class=" flex1 tokenItemizingSubclass">-- Impersonate: </div>
                            <div  class="tokenItemizingSubclass">${oaiImpersonateTokens}</div>
                        </div>
                    </div>
                    <div class="wide100p flex-container flexNoGap flexFlowColumn">
                        <div class="flex-container wide100p">
                            <div class="flex1" style="color: indianred;">Prompt Tokens:</div>
                            <div  class=""> ${oaiPromptTokens}</div>
                        </div>
                        <div class="flex-container ">
                            <div  class=" flex1 tokenItemizingSubclass">-- Description: </div>
                            <div  class="tokenItemizingSubclass">${charDescriptionTokens}</div>
                        </div>
                        <div class="flex-container ">
                            <div  class=" flex1 tokenItemizingSubclass">-- Personality:</div>
                            <div  class="tokenItemizingSubclass"> ${charPersonalityTokens}</div>
                        </div>
                        <div class="flex-container ">
                            <div  class=" flex1 tokenItemizingSubclass">-- Scenario: </div>
                            <div  class="tokenItemizingSubclass">${scenarioTextTokens}</div>
                        </div>
                        <div class="flex-container ">
                            <div  class=" flex1 tokenItemizingSubclass">-- Examples:</div>
                            <div  class="tokenItemizingSubclass"> ${examplesStringTokens}</div>
                        </div>
                    </div>
                    <div class="wide100p flex-container">
                        <div  class="flex1" style="color: gold;">World Info:</div>
                        <div  class="">${worldInfoStringTokens}</div>
                    </div>
                    <div class="wide100p flex-container">
                        <div  class="flex1" style="color: palegreen;">Chat History:</div>
                        <div  class=""> ${ActualChatHistoryTokens}</div>
                    </div>
                    <div class="wide100p flex-container flexNoGap flexFlowColumn">
                        <div class="wide100p flex-container">
                            <div  class="flex1" style="color: cornflowerblue;">Extensions:</div>
                            <div  class="">${allAnchorsTokens}</div>
                        </div>
                        <div class="flex-container ">
                            <div  class=" flex1 tokenItemizingSubclass">-- Summarize: </div>
                            <div  class="tokenItemizingSubclass">${summarizeStringTokens}</div>
                        </div>
                        <div class="flex-container ">
                            <div  class=" flex1 tokenItemizingSubclass">-- Author's Note:</div>
                            <div  class="tokenItemizingSubclass"> ${authorsNoteStringTokens}</div>
                        </div>
                    </div>
                    <div class="wide100p flex-container">
                        <div  class="flex1" style="color: mediumpurple;">{{}} Bias:</div><div  class="">${oaiBiasTokens}</div>
                    </div>
                </div>

            </div>
            <hr>
            <div class="wide100p flex-container flexFlowColumns">
                <div class="flex-container wide100p">
                    <div  class="flex1">Total Tokens in Prompt:</div><div  class=""> ${finalPromptTokens}</div>
                </div>
                <div class="flex-container wide100p">
                    <div  class="flex1">Max Context (Context Size - Response Length):</div><div  class="">${thisPrompt_max_context}</div>
                </div>
            </div>
        </div>
        <hr>
        `, 'text'
        );

    } else {
        //console.log('-- calling popup for non-OAI tokens');
        callPopup(
            `
        <h3>Prompt Itemization</h3>
        Tokenizer: ${selectedTokenizer}<br>
        API Used: ${this_main_api}<br>
        <span class="tokenItemizingSubclass">
            Only the white numbers really matter. All numbers are estimates.
            Grey color items may not have been included in the context due to certain prompt format settings.
        </span>
        <div id="showRawPrompt" class="fa-solid fa-square-poll-horizontal menu_button"></div>
        <hr>
        <div class="justifyLeft">
            <div class="flex-container">
                <div class="flex-container flex1 flexFlowColumns flexNoGap wide50p tokenGraph">
                    <div class="wide100p" style="background-color: indianred; height: ${storyStringTokensPercentage}%;"></div>
                    <div class="wide100p" style="background-color: gold; height: ${worldInfoStringTokensPercentage}%;"></div>
                    <div class="wide100p" style="background-color: palegreen; height: ${ActualChatHistoryTokensPercentage}%;"></div>
                    <div class="wide100p" style="background-color: cornflowerblue; height: ${allAnchorsTokensPercentage}%;"></div>
                    <div class="wide100p" style="background-color: mediumpurple; height: ${promptBiasTokensPercentage}%;"></div>
                </div>
                <div class="flex-container wide50p">
                    <div class="wide100p flex-container flexNoGap flexFlowColumn">
                        <div class="flex-container wide100p">
                            <div class="flex1" style="color: indianred;"> Character Definitions:</div>
                            <div  class=""> ${storyStringTokens}</div>
                        </div>
                        <div class="flex-container ">
                            <div  class=" flex1 tokenItemizingSubclass">-- Description: </div>
                            <div  class="tokenItemizingSubclass">${charDescriptionTokens}</div>
                        </div>
                        <div class="flex-container ">
                            <div  class=" flex1 tokenItemizingSubclass">-- Personality:</div>
                            <div  class="tokenItemizingSubclass"> ${charPersonalityTokens}</div>
                        </div>
                        <div class="flex-container ">
                            <div  class=" flex1 tokenItemizingSubclass">-- Scenario: </div>
                            <div  class="tokenItemizingSubclass">${scenarioTextTokens}</div>
                        </div>
                        <div class="flex-container ">
                            <div  class=" flex1 tokenItemizingSubclass">-- Examples:</div>
                            <div  class="tokenItemizingSubclass"> ${examplesStringTokens}</div>
                        </div>
                    </div>
                    <div class="wide100p flex-container">
                        <div  class="flex1" style="color: gold;">World Info:</div>
                        <div  class="">${worldInfoStringTokens}</div>
                    </div>
                    <div class="wide100p flex-container">
                        <div  class="flex1" style="color: palegreen;">Chat History:</div>
                        <div  class=""> ${ActualChatHistoryTokens}</div>
                    </div>
                    <div class="wide100p flex-container flexNoGap flexFlowColumn">
                        <div class="wide100p flex-container">
                            <div  class="flex1" style="color: cornflowerblue;">Extensions:</div>
                            <div  class="">${allAnchorsTokens}</div>
                        </div>
                        <div class="flex-container ">
                            <div  class=" flex1 tokenItemizingSubclass">-- Summarize: </div>
                            <div  class="tokenItemizingSubclass">${summarizeStringTokens}</div>
                        </div>
                        <div class="flex-container ">
                            <div  class=" flex1 tokenItemizingSubclass">-- Author's Note:</div>
                            <div  class="tokenItemizingSubclass"> ${authorsNoteStringTokens}</div>
                        </div>
                    </div>
                    <div class="wide100p flex-container">
                        <div  class="flex1" style="color: mediumpurple;">{{}} Bias:</div><div  class="">${promptBiasTokens}</div>
                    </div>
                </div>

            </div>
            <hr>
            <div class="wide100p flex-container flexFlowColumns">
                <div class="flex-container wide100p">
                    <div  class="flex1">Total Tokens in Prompt:</div><div  class=""> ${totalTokensInPrompt}</div>
                </div>
                    <!-- <div  class="flex1">finalPromt:</div><div  class=""> ${finalPromptTokens}</div> -->
                <div class="flex-container wide100p">
                    <div  class="flex1">Max Context:</div><div  class="">${thisPrompt_max_context}</div>
                </div>
                <div class="flex-container wide100p">
                    <div  class="flex1">- Padding:</div><div  class=""> ${thisPrompt_padding}</div>
                </div>
                <div class="flex-container wide100p">
                    <div  class="flex1">Actual Max Context Allowed:</div><div  class="">${thisPrompt_max_context - thisPrompt_padding}</div>
                </div>
            </div>
        </div>
        <hr>
        `, 'text'
        );
    }
}

function setInContextMessages(lastmsg, type) {
    $("#chat .mes").removeClass('lastInContext');

    if (type === 'swipe' || type === 'regenerate') {
        lastmsg++;
    }

    $('#chat .mes:not([is_system="true"])').eq(-lastmsg).addClass('lastInContext');
}

function getGenerateUrl() {
    let generate_url = '';
    if (main_api == 'kobold') {
        generate_url = '/generate';
    } else if (main_api == 'textgenerationwebui') {
        generate_url = '/generate_textgenerationwebui';
    } else if (main_api == 'novel') {
        generate_url = '/generate_novelai';
    }
    return generate_url;
}

function shouldContinueMultigen(getMessage, isImpersonate, isInstruct) {
    if (isInstruct && power_user.instruct.stop_sequence) {
        if (message_already_generated.indexOf(power_user.instruct.stop_sequence) !== -1) {
            return false;
        }
    }

    // stopping name string
    const nameString = isImpersonate ? `${name2}:` : (is_pygmalion ? 'You:' : `${name1}:`);
    // if there is no 'You:' in the response msg
    const doesNotContainName = message_already_generated.indexOf(nameString) === -1;
    //if there is no <endoftext> stamp in the response msg
    const isNotEndOfText = message_already_generated.indexOf('<|endoftext|>') === -1;
    //if the gen'd msg is less than the max response length..
    const notReachedMax = tokens_already_generated < parseInt(amount_gen);
    //if we actually have gen'd text at all...
    const msgHasText = getMessage.length > 0;
    return doesNotContainName && isNotEndOfText && notReachedMax && msgHasText;
}

function extractNameFromMessage(getMessage, force_name2, isImpersonate) {
    const nameToTrim = isImpersonate ? name1 : name2;
    let this_mes_is_name = true;
    if (getMessage.startsWith(nameToTrim + ":")) {
        getMessage = getMessage.replace(nameToTrim + ':', '');
        getMessage = getMessage.trimStart();
    } else {
        this_mes_is_name = false;
    }
    // Like OAI, Poe is very unlikely to send you an incomplete message.
    // But it doesn't send "name:" either, so we assume that we always have a name
    // prepend to have clearer logs when building up a prompt context.
    // Instruct mode needs to have it on to make sure you won't have names lost
    // if disable in a middle of a solo chat.
    if (force_name2 || main_api == 'poe' || power_user.instruct.enabled)
        this_mes_is_name = true;

    if (isImpersonate) {
        getMessage = getMessage.trim();
    }

    return { this_mes_is_name, getMessage };
}

function throwCircuitBreakerError() {
    callPopup(`Could not extract reply in ${MAX_GENERATION_LOOPS} attempts. Try generating again`, 'text');
    generate_loop_counter = 0;
    $("#send_textarea").removeAttr('disabled');
    is_send_press = false;
    activateSendButtons();
    setGenerationProgress(0);
    showSwipeButtons();
    $('.mes_buttons:last').show();
    throw new Error('Generate circuit breaker interruption');
}

function extractTitleFromData(data) {
    if (main_api == 'koboldhorde') {
        return data.workerName;
    }

    return undefined;
}

function extractMessageFromData(data) {
    let getMessage = "";

    if (main_api == 'kobold') {
        getMessage = data.results[0].text;
    }

    if (main_api == 'koboldhorde') {
        getMessage = data.text;
    }

    if (main_api == 'textgenerationwebui') {
        getMessage = data.results[0].text;
    }

    if (main_api == 'novel') {
        getMessage = data.output;
    }

    if (main_api == 'openai' || main_api == 'poe') {
        getMessage = data;
    }

    return getMessage;
}

function cleanUpMessage(getMessage, isImpersonate, displayIncompleteSentences = false) {
    if (!displayIncompleteSentences && power_user.trim_sentences) {
        getMessage = end_trim_to_sentence(getMessage, power_user.include_newline);
    }

    if (power_user.collapse_newlines) {
        getMessage = collapseNewlines(getMessage);
    }

    getMessage = $.trim(getMessage);
    // trailing invisible whitespace before every newlines, on a multiline string
    // "trailing whitespace on newlines       \nevery line of the string    \n?sample text" ->
    // "trailing whitespace on newlines\nevery line of the string\nsample text"
    getMessage = getMessage.replace(/[^\S\r\n]+$/gm, "");
    if (is_pygmalion) {
        getMessage = getMessage.replace(/<USER>/g, name1);
        getMessage = getMessage.replace(/<BOT>/g, name2);
        getMessage = getMessage.replace(/You:/g, name1 + ':');
    }

    let nameToTrim = isImpersonate ? name2 : name1;

    if (isImpersonate) {
        nameToTrim = power_user.allow_name2_display ? '' : name2;
    }
    else {
        nameToTrim = power_user.allow_name1_display ? '' : name1;
    }

    if (nameToTrim && getMessage.indexOf(`${nameToTrim}:`) == 0) {
        getMessage = getMessage.substr(0, getMessage.indexOf(`${nameToTrim}:`));
    }
    if (nameToTrim && getMessage.indexOf(`\n${nameToTrim}:`) > 0) {
        getMessage = getMessage.substr(0, getMessage.indexOf(`\n${nameToTrim}:`));
    }
    if (getMessage.indexOf('<|endoftext|>') != -1) {
        getMessage = getMessage.substr(0, getMessage.indexOf('<|endoftext|>'));
    }
    const isInstruct = power_user.instruct.enabled && main_api !== 'openai';
    if (isInstruct && power_user.instruct.stop_sequence) {
        if (getMessage.indexOf(power_user.instruct.stop_sequence) != -1) {
            getMessage = getMessage.substring(0, getMessage.indexOf(power_user.instruct.stop_sequence));
        }
    }
    if (isInstruct && power_user.instruct.input_sequence && isImpersonate) {
        getMessage = getMessage.replaceAll(power_user.instruct.input_sequence, '');
    }
    if (isInstruct && power_user.instruct.output_sequence && !isImpersonate) {
        getMessage = getMessage.replaceAll(power_user.instruct.output_sequence, '');
    }
    // clean-up group message from excessive generations
    if (selected_group) {
        getMessage = cleanGroupMessage(getMessage);
    }

    if (isImpersonate) {
        getMessage = getMessage.trim();
    }

    const stoppingStrings = getStoppingStrings(isImpersonate, false);
    //console.log('stopping on these strings: ');
    //console.log(stoppingStrings);

    for (const stoppingString of stoppingStrings) {
        if (stoppingString.length) {
            for (let j = stoppingString.length - 1; j > 0; j--) {
                if (getMessage.slice(-j) === stoppingString.slice(0, j)) {
                    getMessage = getMessage.slice(0, -j);
                    break;
                }
            }
        }
    }
    if (power_user.auto_fix_generated_markdown) {
        getMessage = fixMarkdown(getMessage);
    }
    return getMessage;
}

function saveReply(type, getMessage, this_mes_is_name, title) {
    if (type != 'append' && type != 'appendFinal' && chat.length && (chat[chat.length - 1]['swipe_id'] === undefined ||
        chat[chat.length - 1]['is_user'])) {
        type = 'normal';
    }

    const generationFinished = new Date();
    const img = extractImageFromMessage(getMessage);
    getMessage = img.getMessage;

    if (type === 'swipe') {
        chat[chat.length - 1]['swipes'].length++;
        if (chat[chat.length - 1]['swipe_id'] === chat[chat.length - 1]['swipes'].length - 1) {
            chat[chat.length - 1]['title'] = title;
            chat[chat.length - 1]['mes'] = getMessage;
            chat[chat.length - 1]['gen_started'] = generation_started;
            chat[chat.length - 1]['gen_finished'] = generationFinished;
            addOneMessage(chat[chat.length - 1], { type: 'swipe' });
        } else {
            chat[chat.length - 1]['mes'] = getMessage;
        }
    } else if (type === 'append') {
        console.log("Trying to append.")
        chat[chat.length - 1]['title'] = title;
        chat[chat.length - 1]['mes'] += getMessage;
        chat[chat.length - 1]['gen_started'] = generation_started;
        chat[chat.length - 1]['gen_finished'] = generationFinished;
        addOneMessage(chat[chat.length - 1], { type: 'swipe' });
    } else if (type === 'appendFinal') {
        console.log("Trying to appendFinal.")
        chat[chat.length - 1]['title'] = title;
        chat[chat.length - 1]['mes'] = getMessage;
        chat[chat.length - 1]['gen_started'] = generation_started;
        chat[chat.length - 1]['gen_finished'] = generationFinished;
        addOneMessage(chat[chat.length - 1], { type: 'swipe' });

    } else {
        console.log('entering chat update routine for non-swipe post');
        chat[chat.length] = {};
        chat[chat.length - 1]['extra'] = {};
        chat[chat.length - 1]['name'] = name2;
        chat[chat.length - 1]['is_user'] = false;
        chat[chat.length - 1]['is_name'] = this_mes_is_name;
        chat[chat.length - 1]['send_date'] = humanizedDateTime();
        getMessage = $.trim(getMessage);
        chat[chat.length - 1]['mes'] = getMessage;
        chat[chat.length - 1]['title'] = title;
        chat[chat.length - 1]['gen_started'] = generation_started;
        chat[chat.length - 1]['gen_finished'] = generationFinished;

        if (selected_group) {
            console.log('entering chat update for groups');
            let avatarImg = 'img/ai4.png';
            if (characters[this_chid].avatar != 'none') {
                avatarImg = getThumbnailUrl('avatar', characters[this_chid].avatar);
            }
            chat[chat.length - 1]['is_name'] = true;
            chat[chat.length - 1]['force_avatar'] = avatarImg;
            chat[chat.length - 1]['original_avatar'] = characters[this_chid].avatar;
            chat[chat.length - 1]['extra']['gen_id'] = group_generation_id;
        }

        saveImageToMessage(img, chat[chat.length - 1]);
        addOneMessage(chat[chat.length - 1]);
    }

    const item = chat[chat.length - 1];
    if (item['swipe_id'] !== undefined) {
        item['swipes'][item['swipes'].length - 1] = item['mes'];
    } else {
        item['swipe_id'] = 0;
        item['swipes'] = [];
        item['swipes'][0] = chat[chat.length - 1]['mes'];
    }

    return { type, getMessage };
}

function saveImageToMessage(img, mes) {
    if (mes && img.image) {
        if (typeof mes.extra !== 'object') {
            mes.extra = {};
        }
        mes.extra.image = img.image;
        mes.extra.title = img.title;
    }
}

function extractImageFromMessage(getMessage) {
    const regex = /<img src="(.*?)".*?alt="(.*?)".*?>/g;
    const results = regex.exec(getMessage);
    const image = results ? results[1] : '';
    const title = results ? results[2] : '';
    getMessage = getMessage.replace(regex, '');
    return { getMessage, image, title };
}

export function isMultigenEnabled() {
    return power_user.multigen && (main_api == 'textgenerationwebui' || main_api == 'kobold' || main_api == 'koboldhorde' || main_api == 'novel');
}

export function activateSendButtons() {
    is_send_press = false;
    $("#send_but").css("display", "flex");
    $("#send_textarea").attr("disabled", false);
    hideStopButton();
}

export function deactivateSendButtons() {
    $("#send_but").css("display", "none");
    showStopButton();
}

function resetChatState() {
    //unsets expected chid before reloading (related to getCharacters/printCharacters from using old arrays)
    this_chid = "invalid-safety-id";
    // replaces deleted charcter name with system user since it will be displayed next.
    name2 = systemUserName;
    // sets up system user to tell user about having deleted a character
    chat = [...safetychat];
    // resets chat metadata
    chat_metadata = {};
    // resets the characters array, forcing getcharacters to reset
    characters.length = 0;
}

export function setMenuType(value) {
    menu_type = value;
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

async function renameCharacter() {
    const oldAvatar = characters[this_chid].avatar;
    const newValue = await callPopup('<h3>New name:</h3>', 'input', characters[this_chid].name);

    if (newValue && newValue !== characters[this_chid].name) {
        const body = JSON.stringify({ avatar_url: oldAvatar, new_name: newValue });
        const response = await fetch('/renamecharacter', {
            method: 'POST',
            headers: getRequestHeaders(),
            body,
        });

        try {
            if (response.ok) {
                const data = await response.json();
                const newAvatar = data.avatar;

                // Replace tags list
                renameTagKey(oldAvatar, newAvatar);

                // Reload characters list
                await getCharacters();

                // Find newly renamed character
                const newChId = characters.findIndex(c => c.avatar == data.avatar);

                if (newChId !== -1) {
                    // Select the character after the renaming
                    this_chid = -1;
                    $(`.character_select[chid="${newChId}"]`).click();

                    // Async delay to update UI
                    await delay(1);

                    if (this_chid === -1) {
                        throw new Error('New character not selected');
                    }

                    // Also rename as a group member
                    await renameGroupMember(oldAvatar, newAvatar, newValue);
                    callPopup('<h3>Character renamed!</h3>Sprites folder (if any) should be renamed manually.', 'text');
                }
                else {
                    throw new Error('Newly renamed character was lost?');
                }
            }
            else {
                throw new Error('Could not rename the character');
            }
        }
        catch {
            // Reloading to prevent data corruption
            await callPopup('Something went wrong. The page will be reloaded.', 'text');
            location.reload();
        }
    }
}

async function saveChat(chat_name, withMetadata) {
    const metadata = { ...chat_metadata, ...(withMetadata || {}) };
    let file_name = chat_name ?? characters[this_chid].chat;
    characters[this_chid]['date_last_chat'] = Date.now();
    sortCharactersList();
    chat.forEach(function (item, i) {
        if (item["is_group"]) {
            toastr.error('Trying to save group chat with regular saveChat function. Aborting to prevent corruption.');
            throw new Error('Group chat saved from saveChat');
        }
        /*
        if (item.is_user) {
            //var str = item.mes.replace(`${name1}:`, `${name1}:`);
            //chat[i].mes = str;
            //chat[i].name = name1;
        } else if (i !== chat.length - 1 && chat[i].swipe_id !== undefined) {
            //  delete chat[i].swipes;
            //  delete chat[i].swipe_id;
        }
        */
    });
    var save_chat = [
        {
            user_name: name1,
            character_name: name2,
            create_date: chat_create_date,
            chat_metadata: metadata,
        },
        ...chat,
    ];
    return jQuery.ajax({
        type: "POST",
        url: "/savechat",
        data: JSON.stringify({
            ch_name: characters[this_chid].name,
            file_name: file_name,
            chat: save_chat,
            avatar_url: characters[this_chid].avatar,
        }),
        beforeSend: function () {

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

async function read_avatar_load(input) {
    if (input.files && input.files[0]) {
        if (selected_button == "create") {
            create_save_avatar = input.files;
        }

        const e = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = resolve;
            reader.onerror = reject;
            reader.readAsDataURL(input.files[0]);
        })

        $('#dialogue_popup').addClass('large_dialogue_popup wide_dialogue_popup');

        const croppedImage = await callPopup(getCropPopup(e.target.result), 'avatarToCrop');

        $("#avatar_load_preview").attr("src", croppedImage || e.target.result);

        if (menu_type == "create") {
            return;
        }

        $("#create_button").trigger('click');

        const formData = new FormData($("#form_create").get(0));

        $(".mes").each(async function () {
            if ($(this).attr("is_system") == 'true') {
                return;
            }
            if ($(this).attr("is_user") == 'true') {
                return;
            }
            if ($(this).attr("ch_name") == formData.get('ch_name')) {
                const previewSrc = $("#avatar_load_preview").attr("src");
                const avatar = $(this).find(".avatar img");
                avatar.attr('src', default_avatar);
                await delay(1);
                avatar.attr('src', previewSrc);
            }
        });

        await delay(durationSaveEdit);
        await fetch(getThumbnailUrl('avatar', formData.get('avatar_url')), {
            method: 'GET',
            cache: 'no-cache',
            headers: {
                'pragma': 'no-cache',
                'cache-control': 'no-cache',
            }
        });
        console.log('Avatar refreshed');

    }
}

function getCropPopup(src) {
    return `<h3>Set the crop position of the avatar image and click Ok to confirm.</h3>
            <div id='avatarCropWrap'>
                <img id='avatarToCrop' src='${src}'>
            </div>`;
}

function getThumbnailUrl(type, file) {
    return `/thumbnail?type=${type}&file=${encodeURIComponent(file)}`;
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
            chat_metadata = chat[0]['chat_metadata'] ?? {};
            chat.shift();
        } else {
            chat_create_date = humanizedDateTime();
        }
        await getChatResult();
        await saveChat();
        setTimeout(function () {
            $('#send_textarea').click();
            $('#send_textarea').focus();
        }, 200);
    } catch (error) {
        await getChatResult();
        console.log(error);
    }
}

async function getChatResult() {
    name2 = characters[this_chid].name;
    if (chat.length === 0) {
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

    if (chat.length === 1) {
        await eventSource.emit(event_types.MESSAGE_RECEIVED, (chat.length - 1));
    }
}

async function openCharacterChat(file_name) {
    characters[this_chid]["chat"] = file_name;
    clearChat();
    chat.length = 0;
    chat_metadata = {};
    await getChat();
    $("#selected_chat_pole").val(file_name);
    $("#create_button").click();
}

////////// OPTIMZED MAIN API CHANGE FUNCTION ////////////

function changeMainAPI() {
    const selectedVal = $("#main_api").val();
    //console.log(selectedVal);
    const apiElements = {
        "koboldhorde": {
            apiSettings: $("#kobold_api-settings"),
            apiConnector: $("#kobold_horde"),
            apiPresets: $('#kobold_api-presets'),
            apiRanges: $("#range_block"),
            maxContextElem: $("#max_context_block"),
            amountGenElem: $("#amount_gen_block"),
            softPromptElem: $("#softprompt_block")
        },
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
            apiPresets: $("#poe_api-presets"),
            apiRanges: $("#range_block_poe"),
            maxContextElem: $("#max_context_block"),
            amountGenElem: $("#amount_gen_block"),
            softPromptElem: $("#softprompt_block"),
        }
    };
    //console.log('--- apiElements--- ');
    //console.log(apiElements);

    //first, disable everything so the old elements stop showing
    for (const apiName in apiElements) {
        const apiObj = apiElements[apiName];
        //do not hide items to then proceed to immediately show them.
        if (selectedVal === apiName) {
            continue;
        }
        apiObj.apiSettings.css("display", "none");
        apiObj.apiConnector.css("display", "none");
        apiObj.apiRanges.css("display", "none");
        apiObj.apiPresets.css("display", "none");
    }

    //then, find and enable the active item.
    //This is split out of the loop so that different apis can share settings divs
    let activeItem = apiElements[selectedVal];

    activeItem.apiSettings.css("display", "block");
    activeItem.apiConnector.css("display", "block");
    activeItem.apiRanges.css("display", "block");
    activeItem.apiPresets.css("display", "block");

    if (selectedVal === "openai") {
        activeItem.apiPresets.css("display", "flex");
    }

    if (selectedVal === "kobold" || selectedVal === 'koboldhorde') {
        //console.log("enabling SP for kobold");
        $("#softprompt_block").css("display", "block");
    }

    if (selectedVal === "textgenerationwebui" || selectedVal === "novel") {
        console.log("enabling amount_gen for ooba/novel");
        activeItem.amountGenElem.find('input').prop("disabled", false);
        activeItem.amountGenElem.css("opacity", 1.0);
    }

    // Hide common settings for OpenAI
    console.log('value?', selectedVal);
    if (selectedVal == "openai") {
        console.log('hiding settings?');
        $("#common-gen-settings-block").css("display", "none");
    } else {
        $("#common-gen-settings-block").css("display", "block");
    }
    // Hide amount gen for poe
    if (selectedVal == "poe") {
        $("#amount_gen_block").css("display", "none");
    } else {
        $("#amount_gen_block").css("display", "flex");
    }

    main_api = selectedVal;
    online_status = "no_connection";

    if (main_api == 'openai' && oai_settings.use_window_ai) {
        $('#api_button_openai').trigger('click');
    }

    if (main_api == "koboldhorde") {
        is_get_status = true;
        getStatus();
        getHordeModels();
    }
}

////////////////////////////////////////////////////

async function getUserAvatars() {
    $("#user_avatar_block").html(""); //RossAscends: necessary to avoid doubling avatars each refresh.
    $("#user_avatar_block").append('<div class="avatar_upload">+</div>');
    const response = await fetch("/getuseravatars", {
        method: "POST",
        headers: getRequestHeaders(),
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
    $("#user_avatar_block").append(
        `<div imgfile="${name}" class="avatar">
            <img src="User Avatars/${name}"
        </div>`
    );
    highlightSelectedAvatar();
}

function reloadUserAvatar() {
    $(".mes").each(function () {
        if ($(this).attr("is_user") == 'true') {
            $(this)
                .find(".avatar img")
                .attr("src", `User Avatars/${user_avatar}`);
        }
    });
}

//***************SETTINGS****************//
///////////////////////////////////////////
async function getSettings(type) {
    const response = await fetch("/getsettings", {
        method: "POST",
        headers: getRequestHeaders(),
        body: JSON.stringify({}),
        cache: "no-cache",
    });

    if (!response.ok) {
        toastr.error('Settings could not be loaded. Try reloading the page.');
        throw new Error('Error getting settings');
    }

    const data = await response.json();

    if (data.result != "file not find" && data.settings) {
        settings = JSON.parse(data.settings);
        if (settings.username !== undefined) {
            if (settings.username !== "") {
                name1 = settings.username;
                $("#your_name").val(name1);
            }
        }

        //Load KoboldAI settings
        koboldai_setting_names = data.koboldai_setting_names;
        koboldai_settings = data.koboldai_settings;
        koboldai_settings.forEach(function (item, i, arr) {
            koboldai_settings[i] = JSON.parse(item);
        });

        let arr_holder = {};

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

        if (preset_settings == "gui") {
            selectKoboldGuiPreset();
        } else {
            if (typeof koboldai_setting_names[preset_settings] !== "undefined") {
                $(`#settings_perset option[value=${koboldai_setting_names[preset_settings]}]`)
                    .attr("selected", "true");
            } else {
                preset_settings = "gui";
                selectKoboldGuiPreset();
            }
        }

        novelai_setting_names = data.novelai_setting_names;
        novelai_settings = data.novelai_settings;
        novelai_settings.forEach(function (item, i, arr) {
            novelai_settings[i] = JSON.parse(item);
        });
        arr_holder = {};

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

        //Load AI model config settings

        amount_gen = settings.amount_gen;
        if (settings.max_context !== undefined)
            max_context = parseInt(settings.max_context);

        swipes = settings.swipes !== undefined ? !!settings.swipes : true;  // enable swipes by default
        $('#swipes-checkbox').prop('checked', swipes); /// swipecode
        hideSwipeButtons();
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
        loadPowerUserSettings(settings, data);

        // Load character tags
        loadTagsSettings(settings);

        // Load context templates
        loadContextTemplatesFromSettings(data, settings);

        // Set context size after loading power user (may override the max value)
        $("#max_context").val(max_context);
        $("#max_context_counter").text(`${max_context}`);

        $("#amount_gen").val(amount_gen);
        $("#amount_gen_counter").text(`${amount_gen}`);

        //Load which API we are using
        if (settings.main_api != undefined) {
            main_api = settings.main_api;
            $('#main_api').val(main_api);
            $("#main_api option[value=" + main_api + "]").attr(
                "selected",
                "true"
            );
            changeMainAPI();
        }

        //Load User's Name and Avatar

        user_avatar = settings.user_avatar;
        reloadUserAvatar();
        highlightSelectedAvatar();

        //Load the API server URL from settings
        api_server = settings.api_server;
        $("#api_url_text").val(api_server);

        setWorldInfoSettings(settings, data);

        api_server_textgenerationwebui =
            settings.api_server_textgenerationwebui;
        $("#textgenerationwebui_api_url_text").val(
            api_server_textgenerationwebui
        );

        selected_button = settings.selected_button;

        if (data.enable_extensions) {
            await loadExtensionSettings(settings);
        }
    }

    if (!is_checked_colab) isColab();
}

function selectKoboldGuiPreset() {
    $("#settings_perset option[value=gui]")
        .attr("selected", "true")
        .trigger("change");
}

async function saveSettings(type) {
    //console.log('Entering settings with name1 = '+name1);
    return jQuery.ajax({
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
            main_api: main_api,
            world_info: world_info,
            world_info_depth: world_info_depth,
            world_info_budget: world_info_budget,
            world_info_recursive: world_info_recursive,
            world_info_case_sensitive: world_info_case_sensitive,
            textgenerationwebui_settings: textgenerationwebui_settings,
            swipes: swipes,
            horde_settings: horde_settings,
            power_user: power_user,
            poe_settings: poe_settings,
            extension_settings: extension_settings,
            context_settings: context_settings,
            tags: tags,
            tag_map: tag_map,
            ...nai_settings,
            ...kai_settings,
            ...oai_settings,
        }, null, 4),
        beforeSend: function () {
            if (type == "change_name") {
                //let nameBeforeChange = name1;
                name1 = $("#your_name").val();
                //$(`.mes[ch_name="${nameBeforeChange}"]`).attr('ch_name' === name1);
                //console.log('beforeSend name1 = ' + nameBeforeChange);
                //console.log('new name: ' + name1);
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
            toastr.error('Check the server connection and reload the page to prevent data loss.', 'Settings could not be saved');
            console.log(exception);
            console.log(jqXHR);
        },
    });
}

function setCharacterBlockHeight() {
    const $children = $("#rm_print_characters_block").children();
    const originalHeight = $children.length * $children.find(':visible').first().outerHeight();
    $("#rm_print_characters_block").css('height', originalHeight);
    //show and hide charlist divs on pageload (causes load lag)
    //$children.each(function () { setCharListVisible($(this)) });


    //delay timer to allow for charlist to populate,
    //should be set to an onload for rm_print_characters or windows?
}

// Common code for message editor done and auto-save
function updateMessage(div) {
    const mesBlock = div.closest(".mes_block");
    const text = mesBlock.find(".edit_textarea").val().trim();
    const bias = extractMessageBias(text);
    const mes = chat[this_edit_mes_id];
    mes["mes"] = text;
    if (mes["swipe_id"] !== undefined) {
        mes["swipes"][mes["swipe_id"]] = text;
    }

    // editing old messages
    if (!mes.extra) {
        mes.extra = {};
    }

    if (mes.is_system || mes.is_user || mes.extra.type === system_message_types.NARRATOR) {
        mes.extra.bias = bias ?? null;
    } else {
        mes.extra.bias = null;
    }

    return { mesBlock, text, mes, bias };
}

function messageEditAuto(div) {
    const { mesBlock, text, mes } = updateMessage(div);

    mesBlock.find(".mes_text").val('');
    mesBlock.find(".mes_text").val(messageFormatting(
        text,
        this_edit_mes_chname,
        mes.is_system,
        mes.is_user,
    ));
    saveChatDebounced();
}

async function messageEditDone(div) {
    const { mesBlock, text, mes, bias } = updateMessage(div);

    mesBlock.find(".mes_text").empty();
    mesBlock.find(".mes_edit_buttons").css("display", "none");
    mesBlock.find(".mes_buttons").css("display", "");
    mesBlock.find(".mes_text").append(
        messageFormatting(
            text,
            this_edit_mes_chname,
            mes.is_system,
            mes.is_user,
        )
    );
    mesBlock.find(".mes_bias").empty();
    mesBlock.find(".mes_bias").append(messageFormatting(bias));
    appendImageToMessage(mes, div.closest(".mes"));
    addCopyToCodeBlocks(div.closest(".mes"));
    await eventSource.emit(event_types.MESSAGE_EDITED, this_edit_mes_id);

    this_edit_mes_id = undefined;
    await saveChatConditional();
}

async function getPastCharacterChats() {
    const response = await fetch("/getallchatsofcharacter", {
        method: 'POST',
        body: JSON.stringify({ avatar_url: characters[this_chid].avatar }),
        headers: getRequestHeaders(),
    });

    if (!response.ok) {
        return;
    }

    let data = await response.json();
    data = Object.values(data);
    data = data.sort((a, b) => a["file_name"].localeCompare(b["file_name"])).reverse();
    return data;
}

export async function displayPastChats() {
    $("#select_chat_div").empty();

    const group = selected_group ? groups.find(x => x.id === selected_group) : null;
    const data = await (selected_group ? getGroupPastChats(selected_group) : getPastCharacterChats());
    const currentChat = selected_group ? group?.chat_id : characters[this_chid]["chat"];
    const displayName = selected_group ? group?.name : characters[this_chid].name;
    const avatarImg = selected_group ? group?.avatar_url : getThumbnailUrl('avatar', characters[this_chid]['avatar']);

    // Sort by last message date descending
    data.sort((a, b) => sortMoments(timestampToMoment(a.last_mes), timestampToMoment(b.last_mes)));

    $("#load_select_chat_div").css("display", "none");
    $("#ChatHistoryCharName").text(displayName);
    for (const key in data) {
        let strlen = 300;
        let mes = data[key]["mes"];

        if (mes !== undefined) {
            if (mes.length > strlen) {
                mes = "..." + mes.substring(mes.length - strlen);
            }
            const chat_items = data[key]["chat_items"];
            const file_size = data[key]["file_size"];
            const fileName = data[key]['file_name'];
            const timestamp = timestampToMoment(data[key]['last_mes']).format('LL LT');
            const template = $('#past_chat_template .select_chat_block_wrapper').clone();
            template.find('.select_chat_block').attr('file_name', fileName);
            template.find('.avatar img').attr('src', avatarImg);
            template.find('.select_chat_block_filename').text(fileName);
            template.find('.chat_file_size').text(" (" + file_size + ")");
            template.find('.chat_messages_num').text(" (" + chat_items + " messages)");
            template.find('.select_chat_block_mes').text(mes);
            template.find('.PastChat_cross').attr('file_name', fileName);
            template.find('.chat_messages_date').text(timestamp);

            if (selected_group) {
                template.find('.avatar img').replaceWith(getGroupAvatar(group));
            }

            $("#select_chat_div").append(template);

            if (currentChat === fileName.toString().replace(".jsonl", "")) {
                $("#select_chat_div").find(".select_chat_block:last").attr("highlight", true);
            }
        }
    }
}

//************************************************************
//************************Novel.AI****************************
//************************************************************
async function getStatusNovel() {
    if (is_get_status_novel) {
        const data = {};

        jQuery.ajax({
            type: "POST", //
            url: "/getstatus_novelai", //
            data: JSON.stringify(data),
            beforeSend: function () {

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
                duration: animation_duration,
                easing: animation_easing,
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

function select_rm_info(type, charId, previousCharId = null) {
    if (!type) {
        toastr.error(`Invalid process (no 'type')`);
        return;
    }
    if (type !== 'group_create') {
        var displayName = String(charId).replace('.png', '');
    }

    if (type === 'char_delete') {
        toastr.warning(`Character Deleted: ${displayName}`);
    }
    if (type === 'char_create') {
        toastr.success(`Character Created: ${displayName}`);
    }
    if (type === 'group_create') {
        toastr.success(`Group Created`);
    }
    if (type === 'group_delete') {
        toastr.warning(`Group Deleted`);
    }

    if (type === 'char_import') {
        toastr.success(`Character Imported: ${displayName}`);
    }

    getCharacters();
    selectRightMenuWithAnimation('rm_characters_block');

    setTimeout(function () {
        if (type === 'char_import' || type === 'char_create') {
            const element = $(`#rm_characters_block [title="${charId}"]`).parent().get(0);
            console.log(element);
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });

            try {
                if (element !== undefined || element !== null) {
                    $(element).addClass('flash animated');
                    setTimeout(function () {
                        $(element).removeClass('flash animated');
                    }, 5000);
                } else { console.log('didnt find the element'); }
            } catch (e) {
                console.error(e);
            }
        }

        if (type === 'group_create') {
            //for groups, ${charId} = data.id from group-chats.js createGroup()
            const element = $(`#rm_characters_block [grid="${charId}"]`).get(0);
            element.scrollIntoView({ behavior: 'smooth', block: 'start' });
            try {
                if (element !== undefined || element !== null) {
                    $(element).addClass('flash animated');
                    setTimeout(function () {
                        $(element).removeClass('flash animated');
                    }, 5000);
                } else { console.log('didnt find the element'); }
            } catch (e) {
                console.error(e);
            }
        }
    }, 100);
    setRightTabSelectedClass();

    if (previousCharId) {
        const newId = characters.findIndex((x) => x.avatar == previousCharId);
        if (newId >= 0) {
            this_chid = newId;
        }
    }
}

export function select_selected_character(chid) {
    //character select
    //console.log('select_selected_character() -- starting with input of -- '+chid+' (name:'+characters[chid].name+')');
    select_rm_create();
    menu_type = "character_edit";
    $("#delete_button").css("display", "flex");
    $("#export_button").css("display", "flex");
    setRightTabSelectedClass('rm_button_selected_ch');
    var display_name = characters[chid].name;

    //create text poles
    $("#rm_button_back").css("display", "none");
    //$("#character_import_button").css("display", "none");
    $("#create_button").attr("value", "Save");              // what is the use case for this?
    $("#dupe_button").show();
    $("#create_button_label").css("display", "none");

    // Don't update the navbar name if we're peeking the group member defs
    if (!selected_group) {
        $("#rm_button_selected_ch").children("h2").text(display_name);
    }

    $("#add_avatar_button").val("");

    $("#character_popup_text_h3").text(characters[chid].name);
    $("#character_name_pole").val(characters[chid].name);
    $("#description_textarea").val(characters[chid].description);
    $("#creatorcomment_textarea").val(characters[chid].creatorcomment);
    $("#personality_textarea").val(characters[chid].personality);
    $("#firstmessage_textarea").val(characters[chid].first_mes);
    $("#scenario_pole").val(characters[chid].scenario);
    $("#talkativeness_slider").val(characters[chid].talkativeness ?? talkativeness_default);
    $("#mes_example_textarea").val(characters[chid].mes_example);
    $("#selected_chat_pole").val(characters[chid].chat);
    $("#create_date_pole").val(characters[chid].create_date);
    $("#avatar_url_pole").val(characters[chid].avatar);
    $("#chat_import_avatar_url").val(characters[chid].avatar);
    $("#chat_import_character_name").val(characters[chid].name);
    let this_avatar = default_avatar;
    if (characters[chid].avatar != "none") {
        this_avatar = getThumbnailUrl('avatar', characters[chid].avatar);
    }

    updateFavButtonState(characters[chid].fav == "true");

    $("#avatar_load_preview").attr("src", this_avatar);
    $("#name_div").removeClass('displayBlock');
    $("#name_div").addClass('displayNone');
    $("#renameCharButton").css("display", "");

    $("#form_create").attr("actiontype", "editcharacter");
    saveSettingsDebounced();
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
    $("#create_button_label").css("display", "");
    $("#create_button").attr("value", "Create");
    $("#dupe_button").hide();

    //create text poles
    $("#rm_button_back").css("display", "");
    $("#character_import_button").css("display", "");
    $("#character_popup_text_h3").text("Create character");
    $("#character_name_pole").val(create_save_name);
    $("#description_textarea").val(create_save_description);
    $("#creatorcomment_textarea").val(create_save_creatorcomment);
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
    $("#renameCharButton").css('display', 'none');
    $("#name_div").removeClass('displayNone');
    $("#name_div").addClass('displayBlock');
    updateFavButtonState(false);

    $("#form_create").attr("actiontype", "createcharacter");
}

function select_rm_characters() {
    menu_type = "characters";
    selectRightMenuWithAnimation('rm_characters_block');
    setRightTabSelectedClass('rm_button_characters');
    updateVisibleDivs();
}

function setExtensionPrompt(key, value, position, depth) {
    extension_prompts[key] = { value, position, depth };
}

function updateChatMetadata(newValues, reset) {
    chat_metadata = reset ? { ...newValues } : { ...chat_metadata, ...newValues };
}

function updateFavButtonState(state) {
    fav_ch_checked = state;
    $("#fav_checkbox").val(fav_ch_checked);
    $("#favorite_button").toggleClass('fav_on', fav_ch_checked);
    $("#favorite_button").toggleClass('fav_off', !fav_ch_checked);
}

function callPopup(text, type, inputValue = '') {
    if (type) {
        popup_type = type;
    }

    $("#dialogue_popup_cancel").css("display", "inline-block");
    switch (popup_type) {
        case "avatarToCrop":
            $("#dialogue_popup_ok").text("Ok");
            $("#dialogue_popup_cancel").css("display", "none");
        case "text":
        case "char_not_selected":
            $("#dialogue_popup_ok").text("Ok");
            $("#dialogue_popup_cancel").css("display", "none");
            break;
        case "world_imported":
        case "new_chat":
        case "confirm":
            $("#dialogue_popup_ok").text("Yes");
            break;
        case "del_world":
        case "del_group":
        case "rename_chat":
        case "del_chat":
        default:
            $("#dialogue_popup_ok").text("Delete");
    }

    $("#dialogue_popup_input").val(inputValue);

    if (popup_type == 'input') {
        $("#dialogue_popup_input").css("display", "block");
        $("#dialogue_popup_ok").text("Save");
    }
    else {
        $("#dialogue_popup_input").css("display", "none");
    }

    $("#dialogue_popup_text").empty().append(text);
    $("#shadow_popup").css("display", "block");
    if (popup_type == 'input') {
        $("#dialogue_popup_input").focus();
    }
    if (popup_type == 'avatarToCrop') {
        // unset existing data
        crop_data = undefined;

        $('#avatarToCrop').cropper({
            aspectRatio: 2 / 3,
            autoCropArea: 1,
            viewMode: 2,
            rotatable: false,
            crop: function (event) {
                crop_data = event.detail;
            }
        });
    }
    $("#shadow_popup").transition({
        opacity: 1,
        duration: 200,
        easing: animation_easing,
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

                },
                cache: false,
                contentType: false,
                processData: false,
                success: function (html) {
                    setBackground(html);
                    $("#bg1").css(
                        "background-image",
                        `url("${e.target.result}")`
                    );
                    $("#form_bg_download").after(
                        `<div class="bg_example" bgfile="${html}" style="background-image: url('${getThumbnailUrl('bg', html)}');">
                            <div class="bg_example_cross fa-solid fa-circle-xmark"></div>
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
    if (chat.length === 0) {
        return;
    }

    if (
        chat[chat.length - 1].is_system ||
        !swipes ||
        $('.mes:last').attr('mesid') <= 0 ||
        chat[chat.length - 1].is_user ||
        chat[chat.length - 1].extra?.image ||
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
    //only show right when generate is off, or when next right swipe would not make a generate happen
    if (is_send_press === false || chat[chat.length - 1].swipes.length >= swipeId) {
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
    $("#chat").children().filter(`[mesid="${count_view_mes - 1}"]`).children('.swipe_right').css('display', 'none');
    $("#chat").children().filter(`[mesid="${count_view_mes - 1}"]`).children('.swipe_left').css('display', 'none');
}

async function saveMetadata() {
    if (selected_group) {
        await editGroup(selected_group, true, false);
    }
    else {
        await saveChat();
    }
}

export async function saveChatConditional() {
    if (selected_group) {
        await saveGroupChat(selected_group, true);
    }
    else {
        await saveChat();
    }
}

async function importCharacterChat(formData) {
    await jQuery.ajax({
        type: "POST",
        url: "/importchat",
        data: formData,
        beforeSend: function () {
        },
        cache: false,
        contentType: false,
        processData: false,
        success: async function (data) {
            if (data.res) {
                await displayPastChats();
            }
        },
        error: function () {
            $("#create_button").removeAttr("disabled");
        },
    });
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
        $('#send_textarea').css({ 'background': '', 'transition': '' });
    }
    else {
        $('#send_textarea').css({
            'background': `linear-gradient(90deg, #008000d6 ${progress}%, transparent ${progress}%)`,
            'transition': '0.25s ease-in-out'
        });
    }
}

function isHordeGenerationNotAllowed() {
    if (main_api == "koboldhorde" && preset_settings == "gui") {
        toastr.error('GUI Settings preset is not supported for Horde. Please select another preset.');
        return true;
    }

    return false;
}

export function cancelTtsPlay() {
    if ('speechSynthesis' in window) {
        speechSynthesis.cancel();
    }
}

async function deleteMessageImage() {
    const value = await callPopup("<h3>Delete image from message?<br>This action can't be undone.</h3>", 'confirm');

    if (!value) {
        return;
    }

    const mesBlock = $(this).closest('.mes');
    const mesId = mesBlock.attr('mesid');
    const message = chat[mesId];
    delete message.extra.image;
    delete message.extra.inline_image;
    mesBlock.find('.mes_img_container').removeClass('img_extra');
    mesBlock.find('.mes_img').attr('src', '');
    saveChatConditional();
}

function enlargeMessageImage() {
    const mesBlock = $(this).closest('.mes');
    const mesId = mesBlock.attr('mesid');
    const message = chat[mesId];
    const imgSrc = message?.extra?.image;

    if (!imgSrc) {
        return;
    }

    const img = document.createElement('img');
    img.classList.add('img_enlarged');
    img.src = imgSrc;
    $('#dialogue_popup').addClass('wide_dialogue_popup');
    callPopup(img.outerHTML, 'text');
}

window["SillyTavern"].getContext = function () {
    return {
        chat: chat,
        characters: characters,
        groups: groups,
        worldInfo: world_info_data,
        name1: name1,
        name2: name2,
        characterId: this_chid,
        groupId: selected_group,
        chatId: selected_group
            ? groups.find(x => x.id == selected_group)?.chat_id
            : (this_chid && characters[this_chid] && characters[this_chid].chat),
        onlineStatus: online_status,
        maxContext: Number(max_context),
        chatMetadata: chat_metadata,
        streamingProcessor,
        eventSource: eventSource,
        event_types: event_types,
        addOneMessage: addOneMessage,
        generate: Generate,
        getTokenCount: getTokenCount,
        extensionPrompts: extension_prompts,
        setExtensionPrompt: setExtensionPrompt,
        updateChatMetadata: updateChatMetadata,
        saveChat: saveChatConditional,
        saveMetadata: saveMetadata,
        sendSystemMessage: sendSystemMessage,
        activateSendButtons,
        deactivateSendButtons,
        saveReply,
        registerSlashCommand: registerSlashCommand,
    };
};

function swipe_left() {      // when we swipe left..but no generation.
    if (chat.length - 1 === Number(this_edit_mes_id)) {
        closeMessageEditor();
    }

    if (isStreamingEnabled() && streamingProcessor) {
        streamingProcessor.isStopped = true;
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
        if (chat[chat.length - 1].extra) {
            // if message has memory attached - remove it to allow regen
            if (chat[chat.length - 1].extra.memory) {
                delete chat[chat.length - 1].extra.memory;
            }
            // ditto for display text
            if (chat[chat.length - 1].extra.display_text) {
                delete chat[chat.length - 1].extra.display_text;
            }
        }
        $(this).parent().children('.mes_block').transition({
            x: swipe_range,
            duration: swipe_duration,
            easing: animation_easing,
            queue: false,
            complete: function () {
                const is_animation_scroll = ($('#chat').scrollTop() >= ($('#chat').prop("scrollHeight") - $('#chat').outerHeight()) - 10);
                //console.log('on left swipe click calling addOneMessage');
                addOneMessage(chat[chat.length - 1], { type: 'swipe' });
                let new_height = this_mes_div_height - (this_mes_block_height - this_mes_block[0].scrollHeight);
                if (new_height < 103) new_height = 103;
                this_mes_div.animate({ height: new_height + 'px' }, {
                    duration: 0, //used to be 100
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
                    easing: animation_easing,
                    queue: false,
                    complete: function () {
                        $(this).parent().children('.mes_block').transition({
                            x: '0px',
                            duration: swipe_duration,
                            easing: animation_easing,
                            queue: false,
                            complete: function () {
                                eventSource.emit(event_types.MESSAGE_SWIPED, (chat.length - 1));
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
            easing: animation_easing,
            queue: false,
            complete: function () {
                $(this).parent().children('.avatar').transition({
                    x: '-' + swipe_range,
                    duration: 0,
                    easing: animation_easing,
                    queue: false,
                    complete: function () {
                        $(this).parent().children('.avatar').transition({
                            x: '0px',
                            duration: swipe_duration,
                            easing: animation_easing,
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
}

// when we click swipe right button
const swipe_right = () => {
    if (chat.length - 1 === Number(this_edit_mes_id)) {
        closeMessageEditor();
    }

    if (isHordeGenerationNotAllowed()) {
        return;
    }

    const swipe_duration = 200;
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
    if (chat[chat.length - 1].extra) {
        // if message has memory attached - remove it to allow regen
        if (chat[chat.length - 1].extra.memory) {
            delete chat[chat.length - 1].extra.memory;
        }
        // ditto for display text
        if (chat[chat.length - 1].extra.display_text) {
            delete chat[chat.length - 1].extra.display_text;
        }
    }
    //console.log(chat[chat.length-1]['swipes']);
    if (parseInt(chat[chat.length - 1]['swipe_id']) === chat[chat.length - 1]['swipes'].length) { //if swipe id of last message is the same as the length of the 'swipes' array
        delete chat[chat.length - 1].gen_started;
        delete chat[chat.length - 1].gen_finished;
        run_generate = true;
    } else if (parseInt(chat[chat.length - 1]['swipe_id']) < chat[chat.length - 1]['swipes'].length) { //otherwise, if the id is less than the number of swipes
        chat[chat.length - 1]['mes'] = chat[chat.length - 1]['swipes'][chat[chat.length - 1]['swipe_id']]; //load the last mes box with the latest generation
        run_swipe_right = true; //then prepare to do normal right swipe to show next message
    }

    const currentMessage = $("#chat").children().filter(`[mesid="${count_view_mes - 1}"]`);
    let this_div = currentMessage.children('.swipe_right');
    let this_mes_div = this_div.parent();

    if (chat[chat.length - 1]['swipe_id'] > chat[chat.length - 1]['swipes'].length) { //if we swipe right while generating (the swipe ID is greater than what we are viewing now)
        chat[chat.length - 1]['swipe_id'] = chat[chat.length - 1]['swipes'].length; //show that message slot (will be '...' while generating)
    }
    if (run_generate) {               //hide swipe arrows while generating
        this_div.css('display', 'none');
    }
    // handles animated transitions when swipe right, specifically height transitions between messages
    if (run_generate || run_swipe_right) {
        let this_mes_block = this_mes_div.children('.mes_block').children('.mes_text');
        const this_mes_div_height = this_mes_div[0].scrollHeight;
        const this_mes_block_height = this_mes_block[0].scrollHeight;

        this_mes_div.children('.swipe_left').css('display', 'flex');
        this_mes_div.children('.mes_block').transition({        // this moves the div back and forth
            x: '-' + swipe_range,
            duration: swipe_duration,
            easing: animation_easing,
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
                    $("#chat")
                        .find('[mesid="' + (count_view_mes - 1) + '"]')
                        .find('.mes_text')
                        .html('...');  //shows "..." while generating
                    $("#chat")
                        .find('[mesid="' + (count_view_mes - 1) + '"]')
                        .find('.mes_timer')
                        .html('');     // resets the timer
                    /* } */
                } else {
                    //console.log('showing previously generated swipe candidate, or "..."');
                    //console.log('onclick right swipe calling addOneMessage');
                    addOneMessage(chat[chat.length - 1], { type: 'swipe' });
                }
                let new_height = this_mes_div_height - (this_mes_block_height - this_mes_block[0].scrollHeight);
                if (new_height < 103) new_height = 103;


                this_mes_div.animate({ height: new_height + 'px' }, {
                    duration: 0, //used to be 100
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
                    easing: animation_easing,
                    queue: false,
                    complete: function () {
                        this_mes_div.children('.mes_block').transition({
                            x: '0px',
                            duration: swipe_duration,
                            easing: animation_easing,
                            queue: false,
                            complete: function () {
                                eventSource.emit(event_types.MESSAGE_SWIPED, (chat.length - 1));
                                if (run_generate && !is_send_press && parseInt(chat[chat.length - 1]['swipe_id']) === chat[chat.length - 1]['swipes'].length) {
                                    console.log('caught here 2');
                                    is_send_press = true;
                                    $('.mes_buttons:last').hide();
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
        this_mes_div.children('.avatar').transition({ // moves avatar along with swipe
            x: '-' + swipe_range,
            duration: swipe_duration,
            easing: animation_easing,
            queue: false,
            complete: function () {
                this_mes_div.children('.avatar').transition({
                    x: swipe_range,
                    duration: 0,
                    easing: animation_easing,
                    queue: false,
                    complete: function () {
                        this_mes_div.children('.avatar').transition({
                            x: '0px',
                            duration: swipe_duration,
                            easing: animation_easing,
                            queue: false,
                            complete: function () {

                            }
                        });
                    }
                });
            }
        });
    }
}

function updateVisibleDivs() {

    var $container = $('#rm_print_characters_block');
    var $children = $container.children();
    var totalHeight = 0;
    $children.each(function () {
        totalHeight += $(this).outerHeight();
    });
    $container.css({
        height: totalHeight,
    });
    //var scrollTop = $container.scrollTop();
    var containerTop = $container.offset().top;
    //var containerBottom = containerTop + $container.height();
    //console.log(`${scrollTop},${containerTop},${containerBottom}`);
    var firstVisibleIndex = null;
    var lastVisibleIndex = null;
    $children.each(function (index) {
        var $child = $(this);
        var childTop = $child.offset().top - containerTop;
        var childBottom = childTop + $child.outerHeight();
        if (childTop <= $container.height() && childBottom >= 0) {
            if (firstVisibleIndex === null) {
                firstVisibleIndex = index;
            }
            lastVisibleIndex = index;
        }
        $child.toggleClass('hiddenByCharListScroll', childTop > $container.height() || childBottom < 0);
    });
    //var visibleStart = firstVisibleIndex !== null ? firstVisibleIndex : 0;
    //var visibleEnd = lastVisibleIndex !== null ? lastVisibleIndex + 1 : 0;
    //console.log(`${visibleStart},${visibleEnd}`);
}


function importCharacter(file) {
    const ext = file.name.match(/\.(\w+)$/);
    if (
        !ext ||
        (ext[1].toLowerCase() != "json" && ext[1].toLowerCase() != "png" && ext[1] != "webp")
    ) {
        return;
    }

    const format = ext[1].toLowerCase();
    $("#character_import_file_type").val(format);
    const formData = new FormData();
    formData.append('avatar', file);
    formData.append('file_type', format);

    jQuery.ajax({
        type: "POST",
        url: "/importcharacter",
        data: formData,
        async: false,
        beforeSend: function () {
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
                    oldSelectedChar = characters[this_chid].avatar;
                }

                await getCharacters();
                select_rm_info(`char_import`, data.file_name, oldSelectedChar);
                $("#rm_info_block").transition({ opacity: 1, duration: 1000 });
            }
        },
        error: function (jqXHR, exception) {
            $("#create_button").removeAttr("disabled");
        },
    });
}

$(document).ready(function () {
    //////////INPUT BAR FOCUS-KEEPING LOGIC/////////////

    setTimeout(function () {
        $("#groupControlsToggle").trigger('click');
        $("#groupCurrentMemberListToggle .inline-drawer-icon").trigger('click');
    }, 200);


    $("#rm_print_characters_block").on('scroll',
        debounce(updateVisibleDivs, 5));

    let S_TAFocused = false;
    let S_TAPreviouslyFocused = false;
    $('#send_textarea').on('focusin focus click', () => {
        S_TAFocused = true;
        S_TAPreviouslyFocused = true;
    });
    $('#send_textarea').on('focusout blur', () => S_TAFocused = false);
    $('#options_button, #send_but, #option_regenerate').on('click', () => {
        if (S_TAPreviouslyFocused) {
            $('#send_textarea').focus();
            S_TAFocused = true;
        }
    });
    $(document).click(event => {
        if ($(':focus').attr('id') !== 'send_textarea') {
            if (!$(event.target.id).is("#options_button, #send_but, #send_textarea, #option_regenerate")) {
                S_TAFocused = false;
                S_TAPreviouslyFocused = false;
            }
        } else {
            S_TAFocused = true;
            S_TAPreviouslyFocused = true;
        }
    });

    /////////////////

    $('#swipes-checkbox').change(function () {
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

    $(document).on('click', '.swipe_right', swipe_right);

    $(document).on('click', '.swipe_left', swipe_left);

    $("#character_search_bar").on("input", function () {
        const selector = ['#rm_print_characters_block .character_select', '#rm_print_characters_block .group_select'].join(',');
        const searchValue = $(this).val().trim().toLowerCase();

        if (!searchValue) {
            $(selector).removeClass('hiddenBySearch');
            updateVisibleDivs();
        } else {
            $(selector).each(function () {
                const isValidSearch = $(this)
                    .find(".ch_name")
                    .text()
                    .toLowerCase()
                    .includes(searchValue);

                $(this).toggleClass('hiddenBySearch', !isValidSearch);
            });
            updateVisibleDivs();
        }

    });

    $("#send_but").click(function () {
        if (is_send_press == false) {
            is_send_press = true;
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
        $("#character_search_bar").val("").trigger("input");
    });

    $(document).on("click", ".character_select", function () {
        if (selected_group && is_group_generating) {
            return;
        }

        if (this_chid !== $(this).attr("chid")) {
            //if clicked on a different character from what was currently selected
            if (!is_send_press) {
                cancelTtsPlay();
                resetSelectedGroup();
                this_edit_mes_id = undefined;
                selected_button = "character_edit";
                this_chid = $(this).attr("chid");
                clearChat();
                chat.length = 0;
                chat_metadata = {};
                getChat();
            }
        } else {
            //if clicked on character that was already selected
            selected_button = "character_edit";
            select_selected_character(this_chid);
        }
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

    $(document).on("click", ".mes", function () {
        //when a 'delete message' parent div is clicked
        // and we are in delete mode and del_checkbox is visible
        if (!is_delete_mode || !$(this).children('.del_checkbox').is(':visible')) {
            return;
        }
        $(".mes").children(".del_checkbox").each(function () {
            $(this).prop("checked", false);
            $(this).parent().css("background", css_mes_bg);
        });
        $(this).css("background", "#600"); //sets the bg of the mes selected for deletion
        var i = $(this).attr("mesid"); //checks the message ID in the chat
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
        reloadUserAvatar();
        saveSettingsDebounced();
        highlightSelectedAvatar();
    });
    $(document).on("click", "#user_avatar_block .avatar_upload", function () {
        $("#avatar_upload_file").click();
    });
    $("#avatar_upload_file").on("change", async function (e) {
        const file = e.target.files[0];

        if (!file) {
            return;
        }

        const formData = new FormData($("#form_upload_avatar").get(0));

        const dataUrl = await new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = resolve;
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });

        $('#dialogue_popup').addClass('large_dialogue_popup wide_dialogue_popup');
        await callPopup(getCropPopup(dataUrl.target.result), 'avatarToCrop');

        let url = "/uploaduseravatar";

        if (crop_data !== undefined) {
            url += `?crop=${encodeURIComponent(JSON.stringify(crop_data))}`;
        }

        jQuery.ajax({
            type: "POST",
            url: url,
            data: formData,
            beforeSend: () => { },
            cache: false,
            contentType: false,
            processData: false,
            success: function (data) {
                if (data.path) {
                    appendUserAvatar(data.path);
                }
                crop_data = undefined;
            },
            error: (jqXHR, exception) => { },
        });

        // Will allow to select the same file twice in a row
        $("#form_upload_avatar").trigger("reset");
    });

    $(document).on("click", ".bg_example", async function () {
        //when user clicks on a BG thumbnail...
        const this_bgfile = $(this).attr("bgfile"); // this_bgfile = whatever they clicked

        const customBg = window.getComputedStyle(document.getElementById('bg_custom')).backgroundImage;

        // custom background is set. Do not override the layer below
        if (customBg !== 'none') {
            return;
        }

        // if clicked on upload button
        if (!this_bgfile) {
            return;
        }

        const backgroundUrl = `backgrounds/${this_bgfile}`;

        // fetching to browser memory to reduce flicker
        fetch(backgroundUrl).then(() => {
            $("#bg1").css(
                "background-image",
                `url("${backgroundUrl}")`
            );
            setBackground(this_bgfile);
        }).catch(() => {
            console.log('Background could not be set: ' + backgroundUrl);
        });

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
            $("#character_popup").css("display", "flex");
            $("#character_popup").css("opacity", 0.0);
            $("#character_popup").transition({
                opacity: 1.0,
                duration: animation_duration,
                easing: animation_easing,
            });
        } else {
            is_advanced_char_open = false;
            $("#character_popup").css("display", "none");
        }
    });
    $("#character_cross").click(function () {
        is_advanced_char_open = false;
        $("#character_popup").transition({
            opacity: 0,
            duration: 200,
            easing: animation_easing,
        });
        setTimeout(function () { $("#character_popup").css("display", "none"); }, 200);
        //$("#character_popup").css("display", "none");
    });
    $("#character_popup_ok").click(function () {
        is_advanced_char_open = false;
        $("#character_popup").css("display", "none");
    });
    $("#dialogue_popup_ok").click(async function (e) {
        $("#shadow_popup").transition({
            opacity: 0,
            duration: 200,
            easing: animation_easing,
        });
        setTimeout(function () {
            $("#shadow_popup").css("display", "none");
            $("#dialogue_popup").removeClass('large_dialogue_popup');
            $("#dialogue_popup").removeClass('wide_dialogue_popup');
        }, 200);

        //      $("#shadow_popup").css("opacity:", 0.0);

        if (popup_type == 'avatarToCrop') {
            dialogueResolve($("#avatarToCrop").data('cropper').getCroppedCanvas().toDataURL('image/jpeg'));
        };

        if (popup_type == "del_bg") {
            delBackground(bg_file_for_del.attr("bgfile"));
            bg_file_for_del.parent().remove();
        }
        if (popup_type == "del_chat") {
            //close past chat popup
            $("#select_chat_cross").click();

            if (selected_group) {
                await deleteGroupChat(selected_group, chat_file_for_del);
            } else {
                await delChat(chat_file_for_del);
            }

            //open the history view again after 100ms
            //hide option popup menu
            setTimeout(function () {
                $("#option_select_chat").click();
                $("#options").hide();
            }, 200);
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
                    select_rm_info("char_delete", characters[this_chid].name);
                },
                data: msg,
                cache: false,
                success: function (html) {
                    //RossAscends: New handling of character deletion that avoids page refreshes and should have
                    // fixed char corruption due to cache problems.
                    //due to how it is handled with 'popup_type', i couldn't find a way to make my method completely
                    // modular, so keeping it in TAI-main.js as a new default.
                    //this allows for dynamic refresh of character list after deleting a character.
                    // closes advanced editing popup
                    $("#character_cross").click();
                    // unsets expected chid before reloading (related to getCharacters/printCharacters from using old arrays)
                    this_chid = "invalid-safety-id";
                    // resets the characters array, forcing getcharacters to reset
                    characters.length = 0;
                    name2 = systemUserName; // replaces deleted charcter name with system user since she will be displayed next.
                    chat = [...safetychat]; // sets up system user to tell user about having deleted a character
                    chat_metadata = {}; // resets chat metadata
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
            (selected_group || this_chid !== undefined) &&
            menu_type != "create"
        ) {
            //Fix it; New chat doesn't create while open create character menu
            clearChat();
            chat.length = 0;

            if (selected_group) {
                createNewGroupChat(selected_group);
            }
            else {
                //RossAscends: added character name to new chat filenames and replaced Date.now() with humanizedDateTime;
                chat_metadata = {};
                characters[this_chid].chat = name2 + " - " + humanizedDateTime();
                $("#selected_chat_pole").val(characters[this_chid].chat);
                saveCharacterDebounced();
                getChat();
            }
        }

        rawPromptPopper.update();
        $('#rawPromptPopup').hide();

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
        $("#shadow_popup").transition({
            opacity: 0,
            duration: 200,
            easing: animation_easing,
        });
        setTimeout(function () {
            $("#shadow_popup").css("display", "none");
            $("#dialogue_popup").removeClass('large_dialogue_popup');
        }, 200);

        //$("#shadow_popup").css("opacity:", 0.0);
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
        formData.set('fav', fav_ch_checked);
        if ($("#form_create").attr("actiontype") == "createcharacter") {
            if ($("#character_name_pole").val().length > 0) {
                //if the character name text area isn't empty (only posible when creating a new character)
                let url = "/createcharacter";

                if (crop_data != undefined) {
                    url += `?crop=${encodeURIComponent(JSON.stringify(crop_data))}`;
                }

                jQuery.ajax({
                    type: "POST",
                    url: url,
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
                        $("#creatorcomment_textarea").val("");
                        create_save_creatorcomment = "";
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
                        let oldSelectedChar = null;
                        if (this_chid != undefined && this_chid != "invalid-safety-id") {
                            oldSelectedChar = characters[this_chid].avatar;
                        }

                        console.log(`new avatar id: ${html}`);
                        createTagMapFromList("#tagList", html);
                        await getCharacters();

                        $("#rm_info_block").transition({ opacity: 0, duration: 0 });
                        var $prev_img = $("#avatar_div_div").clone();
                        $("#rm_info_avatar").append($prev_img);
                        select_rm_info(`char_create`, html, oldSelectedChar);

                        $("#rm_info_block").transition({ opacity: 1.0, duration: 2000 });
                        crop_data = undefined;
                    },
                    error: function (jqXHR, exception) {
                        $("#create_button").removeAttr("disabled");
                    },
                });
            } else {
                $("#result_info").html("Name not entered");
            }
        } else {
            let url = '/editcharacter';

            if (crop_data != undefined) {
                url += `?crop=${encodeURIComponent(JSON.stringify(crop_data))}`;
            }

            jQuery.ajax({
                type: "POST",
                url: url,
                data: formData,
                beforeSend: function () {
                    $("#create_button").attr("disabled", true);
                    $("#create_button").attr("value", "Save");
                },
                cache: false,
                contentType: false,
                processData: false,
                success: async function (html) {
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
                            await eventSource.emit(event_types.MESSAGE_RECEIVED, (chat.length - 1));
                        }
                    }
                    $("#create_button").removeAttr("disabled");
                    await getCharacters();

                    $("#add_avatar_button").replaceWith(
                        $("#add_avatar_button").val("").clone(true)
                    );
                    $("#create_button").attr("value", "Save");
                    crop_data = undefined;
                },
                error: function (jqXHR, exception) {
                    $("#create_button").removeAttr("disabled");
                    $("#result_info").html("<font color=red>Error: no connection</font>");
                    console.log('Error! Either a file with the same name already existed, or the image file provided was in an invalid format. Double check that the image is not a webp.');
                    toastr.error('Something went wrong while saving the character, or the image file provided was in an invalid format. Double check that the image is not a webp.');
                },
            });
        }
    });

    $("#delete_button").click(function () {
        popup_type = "del_ch";
        callPopup(`
            <h3>Delete the character?</h3>
            <b>THIS IS PERMANENT!<br><br>
            THIS WILL ALSO DELETE ALL<br>
            OF THE CHARACTER'S CHAT FILES.<br><br></b>`
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

    $("#description_textarea, #creatorcomment_textarea, #personality_textarea, #scenario_pole, #mes_example_textarea, #firstmessage_textarea")
        .on("input", function () {
            if (menu_type == "create") {
                create_save_description = $("#description_textarea").val();
                create_save_creatorcomment = $("#creatorcomment_textarea").val();
                create_save_personality = $("#personality_textarea").val();
                create_save_scenario = $("#scenario_pole").val();
                create_save_mes_example = $("#mes_example_textarea").val();
                create_save_first_message = $("#firstmessage_textarea").val();
                create_fav_chara = $("#fav_checkbox").val();
            } else {
                saveCharacterDebounced();
            }
        });

    $("#favorite_button").on('click', function () {
        updateFavButtonState(!fav_ch_checked);
        if (menu_type != "create") {
            saveCharacterDebounced();

        }
    });

    $("#renameCharButton").on('click', renameCharacter);

    $(document).on("click", ".renameChatButton", async function () {
        const old_filenamefull = $(this).closest('.select_chat_block_wrapper').find('.select_chat_block_filename').text();
        const old_filename = old_filenamefull.replace('.jsonl', '');

        const popupText = `<h3>Enter the new name for the chat:<h3>
        <small>!!Using an existing filename will produce an error!!<br>
        This will break the link between bookmark chats.<br>
        No need to add '.jsonl' at the end.<br>
        </small>`;
        const newName = await callPopup(popupText, 'input', old_filename);

        if (!newName || newName == old_filename) {
            console.log('no new name found, aborting');
            return;
        }

        const body = {
            is_group: !!selected_group,
            avatar_url: characters[this_chid]?.avatar,
            original_file: `${old_filename}.jsonl`,
            renamed_file: `${newName}.jsonl`,
        }

        try {
            const response = await fetch('/renamechat', {
                method: 'POST',
                body: JSON.stringify(body),
                headers: getRequestHeaders(),
            });

            if (!response.ok) {
                throw new Error('Unsuccessful request.');
            }

            const data = response.json();

            if (data.error) {
                throw new Error('Server returned an error.');
            }

            if (selected_group) {
                await renameGroupChat(selected_group, old_filename, newName);
            }
            else {
                if (characters[this_chid].chat == old_filename) {
                    characters[this_chid].chat = newName;
                    saveCharacterDebounced();
                }
            }

            reloadCurrentChat();

            await delay(250);
            $("#option_select_chat").trigger('click');
            $("#options").hide();
        } catch {
            await delay(500);
            await callPopup('An error has occurred. Chat was not renamed.', 'text');
        }
    });

    $(document).on("click", ".exportChatButton", async function () {
        await saveChatConditional();
        const filenamefull = $(this).closest('.select_chat_block_wrapper').find('.select_chat_block_filename').text();
        const filename = filenamefull.replace('.jsonl', '');
        const body = {
            is_group: !!selected_group,
            avatar_url: characters[this_chid]?.avatar,
            file: `${filename}.jsonl`,
            exportfilename: `${filename}.txt`,
        }
        console.log(body);
        try {
            const response = await fetch('/exportchat', {
                method: 'POST',
                body: JSON.stringify(body),
                headers: getRequestHeaders(),
            });
            const data = await response.json();
            if (!response.ok) {
                // display error message
                console.log(data.message);
                await delay(250);
                toastr.error(`Error: ${data.message}`);
                return;
            } else {
                // success, handle response data
                console.log(data);
                await delay(250);
                toastr.success(data.message);
                download(data.result, body.exportfilename, 'text/plain');
            }
        } catch (error) {
            // display error message
            console.log(`An error has occurred: ${error.message}`);
            await delay(250);
            toastr.error(`Error: ${error.message}`);
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
        if ($("#api_url_text").val() != "") {
            let value = formatKoboldUrl($.trim($("#api_url_text").val()));

            if (!value) {
                toastr.error('Please enter a valid URL.');
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
    });

    $("#api_button_textgenerationwebui").click(function (e) {
        e.stopPropagation();
        if ($("#textgenerationwebui_api_url_text").val() != "") {
            let value = formatKoboldUrl($("#textgenerationwebui_api_url_text").val().trim());

            if (!value) {
                callPopup('Please enter a valid URL.', 'text');
                return;
            }

            $("#textgenerationwebui_api_url_text").val(value);
            $("#api_loading_textgenerationwebui").css("display", "inline-block");
            $("#api_button_textgenerationwebui").css("display", "none");
            api_server_textgenerationwebui = value;
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
                duration: 100, //animation_duration,
                easing: animation_easing,
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
                easing: animation_easing,
                complete: function () { optionsPopper.update(); },
            });
        }
    });

    ///////////// OPTIMIZED LISTENERS FOR LEFT SIDE OPTIONS POPUP MENU //////////////////////

    $("#options [id]").on("click", function () {
        var id = $(this).attr("id");

        if (id == "option_toggle_AN") {
            if (selected_group || this_chid) {
                if ($("#floatingPrompt").css("display") !== 'flex') {
                    $("#floatingPrompt").css("display", "flex");
                    $("#floatingPrompt").css("opacity", 0.0);
                    $("#floatingPrompt").transition({
                        opacity: 1.0,
                        duration: 250,
                        easing: animation_easing,
                    });

                    if ($("#ANBlockToggle")
                        .siblings('.inline-drawer-content')
                        .css('display') !== 'block') {
                        $("#ANBlockToggle").click();
                    }
                } else {
                    $("#floatingPrompt").transition({
                        opacity: 0.0,
                        duration: 250,
                        easing: animation_easing,
                    });
                    setTimeout(function () {
                        $("#floatingPrompt").hide();
                    }, 250);

                }
            }
        }

        if (id == "option_select_chat") {
            if ((selected_group && !is_group_generating) || (this_chid !== undefined && !is_send_press)) {
                displayPastChats();
                $("#shadow_select_chat_popup").css("display", "block");
                $("#shadow_select_chat_popup").css("opacity", 0.0);
                $("#shadow_select_chat_popup").transition({
                    opacity: 1.0,
                    duration: animation_duration,
                    easing: animation_easing,
                });
            }
        }

        else if (id == "option_start_new_chat") {
            if ((selected_group || this_chid !== undefined) && !is_send_press) {
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

        else if (id == "option_impersonate") {
            if (is_send_press == false) {
                is_send_press = true;
                Generate("impersonate");
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
            is_delete_mode = true;
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
        is_delete_mode = false;
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
            eventSource.emit(event_types.MESSAGE_DELETED, chat.length);
        }
        this_del_mes = 0;
        $('#chat .mes').last().addClass('last_mes');
        $('#chat .mes').eq(-2).removeClass('last_mes');
        console.log('confirmed del msgs, calling showswipesbtns');
        showSwipeButtons();
        is_delete_mode = false;
    });

    $("#settings_perset").change(function () {
        if ($("#settings_perset").find(":selected").val() != "gui") {
            preset_settings = $("#settings_perset").find(":selected").text();
            const preset = koboldai_settings[koboldai_setting_names[preset_settings]];
            loadKoboldSettings(preset);

            amount_gen = preset.genamt;
            $("#amount_gen").val(amount_gen);
            $("#amount_gen_counter").text(`${amount_gen}`);

            max_context = preset.max_length;
            $("#max_context").val(max_context);
            $("#max_context_counter").text(`${max_context}`);

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
        amount_gen = parseInt($("#amount_gen").val());
        max_context = parseInt($("#max_context").val());

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
            headers: getRequestHeaders(),
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
            format: (val) => `${val}`,
            setValue: (val) => { amount_gen = Number(val); },
        },
        {
            sliderId: "#max_context",
            counterId: "#max_context_counter",
            format: (val) => `${val}`,
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

    $("#select_chat_cross").click(function () {
        $("#shadow_select_chat_popup").transition({
            opacity: 0,
            duration: 200,
            easing: animation_easing,
        });
        setTimeout(function () { $("#shadow_select_chat_popup").css("display", "none"); }, 200);
        //$("#shadow_select_chat_popup").css("display", "none");
        $("#load_select_chat_div").css("display", "block");
    });

    if (navigator.clipboard === undefined) {
        // No clipboard support
        $(".mes_copy").remove();
    }
    else {
        $(document).on("pointerup", ".mes_copy", function () {
            if (this_chid !== undefined || selected_group) {
                const message = $(this).closest(".mes");

                if (message.data("isSystem")) {
                    return;
                }
                try {
                    var edit_mes_id = $(this).closest(".mes").attr("mesid");
                    var text = chat[edit_mes_id]["mes"];
                    navigator.clipboard.writeText(text);
                    toastr.info('Copied!', '', { timeOut: 2000 });
                } catch (err) {
                    console.error('Failed to copy: ', err);
                }
            }
        });
    }

    $(document).on("pointerup", ".mes_prompt", function () {
        let mesIdForItemization = $(this).closest('.mes').attr('mesId');
        if (itemizedPrompts.length !== undefined && itemizedPrompts.length !== 0) {
            promptItemize(itemizedPrompts, mesIdForItemization);
        }
    })

    $(document).on("pointerup", "#showRawPrompt", function () {
        //console.log(itemizedPrompts[PromptArrayItemForRawPromptDisplay].rawPrompt);
        console.log(itemizedPrompts[PromptArrayItemForRawPromptDisplay].rawPrompt);

        let rawPrompt = itemizedPrompts[PromptArrayItemForRawPromptDisplay].rawPrompt;
        let rawPromptValues = rawPrompt;

        if (Array.isArray(rawPrompt)) {
            rawPromptValues = rawPrompt.map(x => x.content).join('\n');
        }

        //let DisplayStringifiedPrompt = JSON.stringify(itemizedPrompts[PromptArrayItemForRawPromptDisplay].rawPrompt).replace(/\n+/g, '<br>');
        $("#rawPromptWrapper").text(rawPromptValues);
        rawPromptPopper.update();
        $('#rawPromptPopup').toggle();
    })


    //********************
    //***Message Editor***
    $(document).on("click", ".mes_edit", async function () {
        if (this_chid !== undefined || selected_group) {
            // Previously system messages we're allowed to be edited
            /*const message = $(this).closest(".mes");

            if (message.data("isSystem")) {
                return;
            }*/

            let chatScrollPosition = $("#chat").scrollTop();
            if (this_edit_mes_id !== undefined) {
                let mes_edited = $(`#chat [mesid="${this_edit_mes_id}"]`).find(".mes_edit_done");
                if (Number(edit_mes_id) == count_view_mes - 1) { //if the generating swipe (...)
                    if (chat[edit_mes_id]['swipe_id'] !== undefined) {
                        if (chat[edit_mes_id]['swipes'].length === chat[edit_mes_id]['swipe_id']) {
                            run_edit = false;
                        }
                    }
                    if (run_edit) {
                        hideSwipeButtons();
                    }
                }
                await messageEditDone(mes_edited);
            }
            $(this).closest(".mes_block").find(".mes_text").empty();
            $(this).closest(".mes_block").find(".mes_buttons").css("display", "none");
            $(this).closest(".mes_block").find(".mes_edit_buttons").css("display", "inline-flex");
            var edit_mes_id = $(this).closest(".mes").attr("mesid");
            this_edit_mes_id = edit_mes_id;

            var text = chat[edit_mes_id]["mes"];
            if (chat[edit_mes_id]["is_user"]) {
                this_edit_mes_chname = name1;
            } else if (chat[edit_mes_id]["force_avatar"]) {
                this_edit_mes_chname = chat[edit_mes_id]["name"];
            } else {
                this_edit_mes_chname = name2;
            }
            text = text.trim();
            $(this)
                .closest(".mes_block")
                .find(".mes_text")
                .append(
                    `<textarea id='curEditTextarea' class='edit_textarea' style='max-width:auto; '>${text}</textarea>`
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

    $(document).on('input', '#curEditTextarea', function () {
        if (power_user.auto_save_msg_edits === true) {
            messageEditAuto($(this));
        }
    })

    $(document).on("click", ".mes_edit_cancel", function () {
        let text = chat[this_edit_mes_id]["mes"];

        $(this).closest(".mes_block").find(".mes_text").empty();
        $(this).closest(".mes_edit_buttons").css("display", "none");
        $(this).closest(".mes_block").find(".mes_buttons").css("display", "");
        $(this)
            .closest(".mes_block")
            .find(".mes_text")
            .append(messageFormatting(
                text,
                this_edit_mes_chname,
                chat[this_edit_mes_id].is_system,
                chat[this_edit_mes_id].is_user,
            ));
        appendImageToMessage(chat[this_edit_mes_id], $(this).closest(".mes"));
        addCopyToCodeBlocks($(this).closest(".mes"));
        this_edit_mes_id = undefined;
    });

    $(document).on("click", ".mes_edit_up", function () {
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

    $(document).on("click", ".mes_edit_copy", async function () {
        const confirmation = await callPopup('Create a copy of this message?', 'confirm');
        if (!confirmation) {
            return;
        }

        hideSwipeButtons();
        let oldScroll = $('#chat')[0].scrollTop;
        const clone = JSON.parse(JSON.stringify(chat[this_edit_mes_id])); // quick and dirty clone
        clone.send_date = Date.now();
        clone.mes = $(this).closest(".mes").find('.edit_textarea').val().trim();

        chat.splice(Number(this_edit_mes_id) + 1, 0, clone);
        addOneMessage(clone, { insertAfter: this_edit_mes_id });

        updateViewMessageIds();
        saveChatConditional();
        $('#chat')[0].scrollTop = oldScroll;
        showSwipeButtons();
    });


    $(document).on("click", ".mes_edit_delete", async function () {
        const confirmation = await callPopup("Are you sure you want to delete this message?", 'confirm');
        if (!confirmation) {
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

    $(document).on("click", ".mes_edit_done", async function () {
        await messageEditDone($(this));
    });

    $("#your_name_button").click(function () {
        if (!is_send_press) {
            name1 = $("#your_name").val();
            if (name1 === undefined || name1 == "") name1 = default_user_name;
            console.log(name1);
            toastr.success(`Your messages will now be sent as ${name1}`, 'User Name updated');
            saveSettings("change_name");
        }
    });

    $('#sync_name_button').on('click', async function () {
        const confirmation = await callPopup(`<h3>Are you sure?</h3>All user-sent messages in this chat will be attributed to ${name1}.`, 'confirm');

        if (!confirmation) {
            return;
        }

        for (const mes of chat) {
            if (mes.is_user) {
                mes.name = name1;
            }
        }

        await saveChatConditional();
        await reloadCurrentChat();
    });
    //Select chat

    $("#api_button_novel").on('click', async function (e) {
        e.stopPropagation();
        const api_key_novel = $("#api_key_novel").val().trim();

        if (api_key_novel.length) {
            await writeSecret(SECRET_KEYS.NOVEL, api_key_novel);
        }

        if (!secret_state[SECRET_KEYS.NOVEL]) {
            console.log('No secret key saved for NovelAI');
            return;
        }

        $("#api_loading_novel").css("display", "inline-block");
        $("#api_button_novel").css("display", "none");
        is_get_status_novel = true;
        is_api_button_press_novel = true;
        // Check near immediately rather than waiting for up to 90s
        setTimeout(getStatusNovel, 10);
    });

    //**************************CHARACTER IMPORT EXPORT*************************//
    $("#character_import_button").click(function () {
        $("#character_import_file").click();
    });
    $("#character_import_file").on("change", function (e) {
        $("#rm_info_avatar").html("");
        if (!e.target.files.length) {
            return;
        }

        for (const file of e.target.files) {
            importCharacter(file);
        }
    });
    $("#export_button").click(function (e) {
        $('#export_format_popup').toggle();
        exportPopper.update();
    });
    $(document).on('click', '.export_format', async function () {
        const format = $(this).data('format');

        if (!format) {
            return;
        }

        const body = { format, avatar_url: characters[this_chid].avatar };

        const response = await fetch('/exportcharacter', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(body),
        });

        if (response.ok) {
            const filename = characters[this_chid].avatar.replace('.png', `.${format}`);
            const blob = await response.blob();
            const a = document.createElement("a");
            a.href = URL.createObjectURL(blob);
            a.setAttribute("download", filename);
            document.body.appendChild(a);
            a.click();
            document.body.removeChild(a);
        }


        $('#export_format_popup').hide();
    });
    //**************************CHAT IMPORT EXPORT*************************//
    $("#chat_import_button").click(function () {
        $("#chat_import_file").click();
    });

    $("#chat_import_file").on("change", async function (e) {
        var file = e.target.files[0];

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

        if (selected_group && file.name.endsWith('.json')) {
            toastr.warning("Only SillyTavern's own format is supported for group chat imports. Sorry!");
            return;
        }

        var format = ext[1].toLowerCase();
        $("#chat_import_file_type").val(format);

        var formData = new FormData($("#form_import_chat").get(0));
        formData.append('user_name', name1);
        $("#select_chat_div").html("");
        $("#load_select_chat_div").css("display", "block");

        if (selected_group) {
            await importGroupChat(formData);
        } else {
            await importCharacterChat(formData);
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

    $("#dupe_button").click(async function () {

        const body = { avatar_url: characters[this_chid].avatar };
        const response = await fetch('/dupecharacter', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(body),
        });
        if (response.ok) {
            toastr.success("Character Duplicated");
            getCharacters();
        }
    });

    $(document).on("click", ".select_chat_block, .bookmark_link, .mes_bookmark", async function () {
        let file_name = $(this).hasClass('mes_bookmark')
            ? $(this).closest('.mes').attr('bookmark_link')
            : $(this).attr("file_name").replace(".jsonl", "");

        if (!file_name) {
            return;
        }

        if (selected_group) {
            await openGroupChat(selected_group, file_name);
        } else {
            await openCharacterChat(file_name);
        }

        $("#shadow_select_chat_popup").css("display", "none");
        $("#load_select_chat_div").css("display", "block");
    });

    $(document).on("click", ".mes_stop", function () {
        if (streamingProcessor) {
            streamingProcessor.abortController.abort();
            streamingProcessor.isStopped = true;
            streamingProcessor.onStopStreaming();
            streamingProcessor = null;
        }
        if (abortController) {
            abortController.abort();
            hideStopButton();
        }
    });

    $('.drawer-toggle').click(function () {
        var icon = $(this).find('.drawer-icon');
        var drawer = $(this).parent().find('.drawer-content');
        var drawerWasOpenAlready = $(this).parent().find('.drawer-content').hasClass('openDrawer');
        let targetDrawerID = $(this).parent().find('.drawer-content').attr('id');
        const pinnedDrawerClicked = drawer.hasClass('pinnedOpen');

        if (!drawerWasOpenAlready) {
            $('.openDrawer').not('.pinnedOpen').slideToggle(200, "swing");
            $('.openIcon').toggleClass('closedIcon openIcon');
            $('.openDrawer').not('.pinnedOpen').toggleClass('closedDrawer openDrawer');
            icon.toggleClass('openIcon closedIcon');
            drawer.toggleClass('openDrawer closedDrawer');

            //console.log(targetDrawerID);
            if (targetDrawerID === 'right-nav-panel') {
                $(this).closest('.drawer').find('.drawer-content').slideToggle({
                    duration: 200,
                    easing: "swing",
                    start: function () {
                        jQuery(this).css('display', 'flex');
                    },
                    complete: function () {
                        $("#rm_print_characters_block").trigger("scroll");
                    }
                })
            } else {
                $(this).closest('.drawer').find('.drawer-content').slideToggle(200, "swing");
            }


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

        if ($('#export_format_popup').is(':visible')
            && clickTarget.closest('#export_button').length == 0
            && clickTarget.closest('#export_format_popup').length == 0) {
            $('#export_format_popup').hide();
        }

        const forbiddenTargets = [
            '#character_cross',
            '#avatar-and-name-block',
            '#shadow_popup',
            '#world_popup',
            '.ui-widget',
            '.text_pole',
        ];
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

    $(document).on('click', '.inline-drawer-toggle', function (e) {
        if ($(e.target).hasClass('text_pole')) {
            return;
        };
        var icon = $(this).find('.inline-drawer-icon');
        icon.toggleClass('down up');
        icon.toggleClass('fa-circle-chevron-down fa-circle-chevron-up');
        $(this).closest('.inline-drawer').find('.inline-drawer-content').slideToggle();
    });

    $(document).on('click', '.mes .avatar', function () {

        //if (window.innerWidth > 1000 || $('body').hasClass('waifuMode')) {

        let thumbURL = $(this).children('img').attr('src');
        let charsPath = '/characters/'
        let targetAvatarImg = thumbURL.substring(thumbURL.lastIndexOf("=") + 1);

        let avatarSrc = charsPath + targetAvatarImg;
        console.log(avatarSrc);
        if ($(this).parent().parent().attr('is_user') == 'true') { //handle user avatars
            $("#zoomed_avatar").attr('src', thumbURL);
        } else if ($(this).parent().parent().attr('is_system') == 'true') { //handle system avatars
            $("#zoomed_avatar").attr('src', thumbURL);
        } else if ($(this).parent().parent().attr('is_user') == 'false') { //handle char avatars
            $("#zoomed_avatar").attr('src', avatarSrc);
        }
        $('#avatar_zoom_popup').toggle();

        //} else { return; }
    });

    $(document).on('click', '#OpenAllWIEntries', function () {
        $("#world_popup_entries_list").children().find('.down').click()
    });
    $(document).on('click', '#CloseAllWIEntries', function () {
        $("#world_popup_entries_list").children().find('.up').click()
    });

    $(document).keyup(function (e) {
        if (e.key === "Escape") {
            if (power_user.auto_save_msg_edits === false) {
                closeMessageEditor();
                $("#send_textarea").focus();
            }
            if (power_user.auto_save_msg_edits === true) {
                $(`#chat .mes[mesid="${this_edit_mes_id}"] .mes_edit_done`).click()
                $("#send_textarea").focus();
            }
            if (!this_edit_mes_id && $('#mes_stop').is(':visible')) {
                $('#mes_stop').trigger('click');
                if (chat.length && Array.isArray(chat[chat.length - 1].swipes) && chat[chat.length - 1].swipe_id == chat[chat.length - 1].swipes.length) {
                    $('.last_mes .swipe_left').trigger('click');
                }
            }
        }
    });

    $("#bg-filter").on("input", function () {
        const filterValue = $(this).val().toLowerCase();
        $("#bg_menu_content > div").each(function () {
            const $bgContent = $(this);
            if ($bgContent.attr("title").toLowerCase().includes(filterValue)) {
                $bgContent.show();
            } else {
                $bgContent.hide();
            }
        });
    });

    $(document).on('click', '.mes_img_enlarge', enlargeMessageImage);
    $(document).on('click', '.mes_img_delete', deleteMessageImage);

    $(window).on('beforeunload', () => {
        cancelTtsPlay();
        if (streamingProcessor) {
            console.log('Page reloaded. Aborting streaming...');
            streamingProcessor.abortController.abort();
        }
    });

    $(document).on('input', '.range-block-counter div[contenteditable="true"]', function () {
        const caretPosition = saveCaretPosition($(this).get(0));
        const myText = $(this).text().trim();
        $(this).text(myText); // trim line breaks and spaces
        const masterSelector = $(this).data('for');
        const masterElement = document.getElementById(masterSelector);

        if (masterElement == null) {
            console.error('Master input element not found for the editable label', masterSelector);
            return;
        }

        const myValue = Number(myText);

        if (Number.isNaN(myValue)) {
            console.warn('Label input is not a valid number. Resetting the value', myText);
            $(masterElement).trigger('input');
            restoreCaretPosition($(this).get(0), caretPosition);
            return;
        }

        const masterMin = Number($(masterElement).attr('min'));
        const masterMax = Number($(masterElement).attr('max'));

        if (myValue < masterMin) {
            console.warn('Label input is less than minimum.', myText, '<', masterMin);
            restoreCaretPosition($(this).get(0), caretPosition);
            return;
        }

        if (myValue > masterMax) {
            console.warn('Label input is more than maximum.', myText, '>', masterMax);
            restoreCaretPosition($(this).get(0), caretPosition);
            return;
        }

        console.log('Label value OK, setting to the master input control', myText);
        $(masterElement).val(myValue).trigger('input');
        restoreCaretPosition($(this).get(0), caretPosition);
    });

    const $dropzone = $(document.body);

    $dropzone.on('dragover', (event) => {
        event.preventDefault();
        event.stopPropagation();
        $dropzone.addClass('dragover');
    });

    $dropzone.on('dragleave', (event) => {
        event.preventDefault();
        event.stopPropagation();
        $dropzone.removeClass('dragover');
    });

    $dropzone.on('drop', (event) => {
        event.preventDefault();
        event.stopPropagation();
        $dropzone.removeClass('dragover');

        const files = event.originalEvent.dataTransfer.files;
        processDroppedFiles(files);
    });

    function processDroppedFiles(files) {
        const allowedMimeTypes = [
            'application/json',
            'image/png',
            'image/webp',
        ];

        for (const file of files) {
            if (allowedMimeTypes.includes(file.type)) {
                importCharacter(file);
            } else {
                toastr.warning('Unsupported file type: ' + file.name);
            }
        }
    }
})
