/*
TODO:
    - Fix special case of first message
    - Prevent swipe during streaming
    - Handle special text styling while streaming
Ideas:
    - Add same option as TTS text
*/

import { saveSettingsDebounced, addOneMessage, event_types, eventSource, deleteLastMessage } from "../../../script.js";
import { getContext, extension_settings, ModuleWorkerWrapper } from "../../extensions.js";
export { MODULE_NAME };

const extensionName = "blip";
const extensionFolderPath = `scripts/extensions/${extensionName}`;

const MODULE_NAME = 'BLip';
const DEBUG_PREFIX = "<Blip module> ";
const UPDATE_INTERVAL = 1000;

const BLIP_DURATION = 50;

const SPEED_SLOW = 0.009;
const SPEED_NORMAL = 0.006;
const SPEED_FAST = 0.004;

const COMMA_DELAY = 0.025;
const PHRASE_DELAY = 0.5;

let current_chat_id = 0;
let current_message = "";

//#############################//
//  Extension UI and Settings  //
//#############################//

const defaultSettings = {
    enabled: false,
}

function loadSettings() {
    if (extension_settings.blip === undefined)
        extension_settings.blip = {};

    if (Object.keys(extension_settings.blip).length === 0) {
        Object.assign(extension_settings.blip, defaultSettings)
    }

    $("#blip_enabled").prop('checked', extension_settings.blip.enabled);
}

async function onEnabledClick() {
    extension_settings.blip.enabled = $('#blip_enabled').is(':checked');
    saveSettingsDebounced();
}

//#############################//
//  API Calls                  //
//#############################//


//#############################//
//  Module Worker              //
//#############################//

const delay = s => new Promise(res => setTimeout(res, s*1000));

function playSound() {
    $("#blip_audio")[0].pause();
    $("#blip_audio")[0].currentTime = 0;
    $("#blip_audio")[0].play();
}

function hyjackMessage(chat_id) {
    if (!extension_settings.blip.enabled)
        return;

    // Ignore first message
    if (chat_id == 0)
        return;

    // Hyjack char message
    const message = getContext().chat[chat_id].mes;
    getContext().chat[chat_id].mes = "";
    const char = getContext().chat[chat_id].name;

    console.debug(DEBUG_PREFIX,"Hyjacked from",char,"message:", message);

    current_chat_id = chat_id;
    current_message = message;
}

async function processMessage(chat_id) {
    if (!extension_settings.blip.enabled)
        return;

    // Ignore first message
    if (chat_id == 0)
        return;

    // DBG
    if (chat_id !== current_chat_id) {
        console.error(DEBUG_PREFIX,"Message hyjacked chat id different from event one!");
        return;
    }

    const chat = getContext().chat;
    getContext().chat[chat_id].mes = current_message;

    const char = chat[chat_id].name
    const final_message = chat[chat_id];


    console.debug(DEBUG_PREFIX,"Streaming message:", current_message)

    const last_message_dom = $( ".last_mes").children(".mes_block").children(".mes_text");
    console.debug(DEBUG_PREFIX,last_message_dom);

    let blipDuration = SPEED_SLOW; //$("#audio_blip")[0].duration * 1000;
    for(const i in current_message) {
        const next_char = current_message[i]

        if (next_char == ' ') {
            playSound();
        }
        else if (next_char == ',') {
            playSound();
            await delay(COMMA_DELAY);
        }
        else if (["!","?","."].includes(next_char)) {
            playSound();
            if (blipDuration == SPEED_SLOW)
                blipDuration = SPEED_NORMAL;
            else
            if (blipDuration == SPEED_NORMAL)
                blipDuration = SPEED_FAST;
            else
                blipDuration = SPEED_SLOW;

            await delay(PHRASE_DELAY);

        }
        else {
            //playSound();
        }

        await delay(blipDuration);
        last_message_dom.text(last_message_dom.text()+current_message[i]);
    }

    deleteLastMessage();
    getContext().chat.push(final_message);
    addOneMessage(final_message);
    //await eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, (chat.length - 1));
    console.debug(DEBUG_PREFIX,getContext().chat);
}

async function moduleWorker() {
    const moduleEnabled = extension_settings.blip.enabled;

    if (moduleEnabled) {
    }
}

//#############################//
//  Extension load             //
//#############################//

// This function is called when the extension is loaded
jQuery(async () => {
    const windowHtml = $(await $.get(`${extensionFolderPath}/window.html`));

    $('#extensions_settings').append(windowHtml);
    loadSettings();

    $("#blip_enabled").on("click", onEnabledClick);
    $("#blip_audio").hide();

    $("#blip_audio").attr("src", "assets/blip/sfx-blipfemale.wav"); // DBG
    $("#blip_audio").prop("volume",0.1); // DBG

    // DBG
    $("#blip_debug").on("click", function () {
        if ($("#blip_debug").is(':checked')) {
            $("#blip_audio").show();
        }
        else {
            $("#blip_audio").hide();
        }
    });
    //

    eventSource.on(event_types.MESSAGE_RECEIVED, (chat_id) => hyjackMessage(chat_id));
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (chat_id) => processMessage(chat_id));

    const wrapper = new ModuleWorkerWrapper(moduleWorker);
    setInterval(wrapper.update.bind(wrapper), UPDATE_INTERVAL);
    moduleWorker();

    console.debug(DEBUG_PREFIX,"Finish loaded.");
});
