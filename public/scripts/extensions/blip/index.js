/*
TODO:
- Security
    - Prevent swipe during streaming
    - Handle special text styling while streaming
    - group mode break, need to make generation wait or queue
- Features
    - apply pitch change
    - generate sound with JS
    - volume option
    - change setting when selecting existing character voicemaps
    - Add feedback to apply button
Ideas:
    - Add same option as TTS text
*/

import { saveSettingsDebounced, addOneMessage, event_types, eventSource, deleteLastMessage, getRequestHeaders } from "../../../script.js";
import { getContext, extension_settings, ModuleWorkerWrapper } from "../../extensions.js";
export { MODULE_NAME };

const extensionName = "blip";
const extensionFolderPath = `scripts/extensions/${extensionName}`;

const MODULE_NAME = 'BLip';
const DEBUG_PREFIX = "<Blip extension> ";
const UPDATE_INTERVAL = 1000;

const COMMA_DELAY = 0.025;
const PHRASE_DELAY = 0.25;

let current_chat_id = 0;
let current_message = "";

let characters_list = [] // Updated with module worker
let blip_assets = null; // Initialized only once with module workers

let is_in_text_animation = false;
let is_animation_pause = false;

let current_multiplier = 1.0;

//#############################//
//  Extension UI and Settings  //
//#############################//

const defaultSettings = {
    enabled: false,

    minSpeedMultiplier: 1.0,
    maxSpeedMultiplier: 1.0,
    commaDelay: 0,
    phraseDelay: 0,

    textSpeed: 10,

    audioSpeed: 10,
    audioPitch: 0,
    
    voiceMap: {},
}

function loadSettings() {
    if (extension_settings.blip === undefined)
        extension_settings.blip = {};

    // Ensure good format
    if (Object.keys(extension_settings.blip).length === 0) {
        Object.assign(extension_settings.blip, defaultSettings)
    }

    $("#blip_enabled").prop('checked', extension_settings.blip.enabled);

    $('#blip_min_speed_multiplier').val(extension_settings.blip.minSpeedMultiplier);
    $('#blip_min_speed_multiplier_value').text(extension_settings.blip.minSpeedMultiplier);

    $('#blip_max_speed_multiplier').val(extension_settings.blip.maxSpeedMultiplier);
    $('#blip_max_speed_multiplier_value').text(extension_settings.blip.maxSpeedMultiplier);

    $('#blip_comma_delay').val(extension_settings.blip.commaDelay);
    $('#blip_comma_delay_value').text(extension_settings.blip.commaDelay);

    $('#blip_phrase_delay').val(extension_settings.blip.phraseDelay);
    $('#blip_phrase_delay_value').text(extension_settings.blip.phraseDelay);

    $('#blip_text_speed').val(extension_settings.blip.textSpeed);
    $('#blip_text_speed_value').text(extension_settings.blip.textSpeed);

    $('#blip_audio_speed').val(extension_settings.blip.audioSpeed);
    $('#blip_audio_speed_value').text(extension_settings.blip.audioSpeed);

    $('#blip_audio_pitch').val(extension_settings.blip.audioPitch);
    $('#blip_audio_pitch_value').text(extension_settings.blip.audioPitch);

    updateVoiceMapText();
}

async function onEnabledClick() {
    extension_settings.blip.enabled = $('#blip_enabled').is(':checked');
    saveSettingsDebounced();
}

async function onMinSpeedChange() {
    extension_settings.blip.minSpeedMultiplier = Number($('#blip_min_speed_multiplier').val());
    $("#blip_min_speed_multiplier_value").text(extension_settings.blip.minSpeedMultiplier)
    saveSettingsDebounced()
}

async function onMaxSpeedChange() {
    extension_settings.blip.maxSpeedMultiplier = Number($('#blip_max_speed_multiplier').val());
    $("#blip_max_speed_multiplier_value").text(extension_settings.blip.maxSpeedMultiplier)
    saveSettingsDebounced()
}

async function onCommaDelayChange() {
    extension_settings.blip.commaDelay = Number($('#blip_comma_delay').val());
    $("#blip_comma_delay_value").text(extension_settings.blip.commaDelay)
    saveSettingsDebounced()
}

async function onPhraseDelayChange() {
    extension_settings.blip.phraseDelay = Number($('#blip_phrase_delay').val());
    $("#blip_phrase_delay_value").text(extension_settings.blip.phraseDelay)
    saveSettingsDebounced()
}

async function onTextSpeedChange() {
    extension_settings.blip.textSpeed = Number($('#blip_text_speed').val());
    $("#blip_text_speed_value").text(extension_settings.blip.textSpeed)
    saveSettingsDebounced()
}

async function onOriginChange() {
    const origin = $("#blip_origin").val();

    if (origin == "none") {
        $("#blip_file_settings").hide();
        return;
    }

    if (origin == "file") {
        $("#blip_file_settings").show();
        return;
    }
}

async function onAudioSpeedChange() {
    extension_settings.blip.audioSpeed = Number($('#blip_audio_speed').val());
    $("#blip_audio_speed_value").text(extension_settings.blip.audioSpeed)
    saveSettingsDebounced()
}

async function onAudioPitchChange() {
    extension_settings.blip.audioPitch = Number($('#blip_audio_pitch').val());
    $("#blip_audio_pitch_value").text(extension_settings.blip.audioPitch)
    saveSettingsDebounced()
}

async function onApplyClick() {
    let error = false;
    const character = $("#blip_character_select").val();
    const min_speed_multiplier = $("#blip_min_speed_multiplier").val();
    const max_speed_multiplier = $("#blip_max_speed_multiplier").val();
    const comma_delay = $("#blip_comma_delay").val();
    const phrase_delay = $("#blip_phrase_delay").val();
    const text_speed = $("#blip_text_speed").val();
    const audio_origin = $("#blip_audio_origin").val();

    if (character === "none") {
        toastr.error("Character not selected.", DEBUG_PREFIX + " voice mapping apply", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
        return;
    }

    if (audio_origin == "none") {
        toastr.error("Model not selected.", DEBUG_PREFIX + " voice mapping apply", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
        return;
    }

    if (audio_origin == "file") {
        const asset_path = $("#blip_file_asset_select").val();
        const audio_speed = $("#blip_audio_speed").val();
        const audio_pitch = $("#blip_audio_pitch").val();

        extension_settings.blip.voiceMap[character] = {
            "minSpeedMultiplier": Number(min_speed_multiplier),
            "maxSpeedMultiplier": Number(max_speed_multiplier),
            "commaDelay": Number(comma_delay),
            "phraseDelay": Number(phrase_delay),
            "textSpeed": Number(text_speed),
            "audioOrigin": audio_origin,
            "audioSettings": {
                "asset" : asset_path,
                "speed" : audio_speed,
                "pitch": audio_pitch
            }
        }

        // TODO
    }

    
    updateVoiceMapText();
    console.debug(DEBUG_PREFIX, "Updated settings of ", character, ":", extension_settings.blip.voiceMap[character])
    saveSettingsDebounced();
}

async function onDeleteClick() {
    const character = $("#blip_character_select").val();

    if (character === "none") {
        toastr.error("Character not selected.", DEBUG_PREFIX + " voice mapping delete", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
        return;
    }

    delete extension_settings.blip.voiceMap[character];
    console.debug(DEBUG_PREFIX, "Deleted settings of ", character);
    updateVoiceMapText();
    saveSettingsDebounced();
}

function updateVoiceMapText() {
    let voiceMapText = ""
    for (let i in extension_settings.blip.voiceMap) {
        const voice_settings = extension_settings.blip.voiceMap[i];
        voiceMapText += i + ": ("
            + voice_settings["minSpeedMultiplier"] + ","
            + voice_settings["maxSpeedMultiplier"] + ","
            + voice_settings["commaDelay"] + ","
            + voice_settings["phraseDelay"] + ","
            + voice_settings["textSpeed"] + ","
            + voice_settings["audioOrigin"] + ",";

        if (voice_settings["audioOrigin"] == "file") {
            voiceMapText += voice_settings["audioSettings"]["asset"] + ","
            + voice_settings["audioSettings"]["speed"] + ","
            + voice_settings["audioSettings"]["pitch"]
            + "),\n"
        }
    }

    extension_settings.rvc.voiceMapText = voiceMapText;
    $('#blip_voice_map').val(voiceMapText);

    console.debug(DEBUG_PREFIX, "Updated voice map debug text to\n", voiceMapText)
}

//#############################//
//  Methods                    //
//#############################//


const delay = s => new Promise(res => setTimeout(res, s*1000));

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
    if (!extension_settings.blip.enabled) {
        return;
    }

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

    const character = chat[chat_id].name

    if (extension_settings.blip.voiceMap[character] === undefined) {
        console.debug(DEBUG_PREFIX, "Character",character,"has no blip voice assigned in voicemap");
        return;
    }

    const final_message = chat[chat_id];

    console.debug(DEBUG_PREFIX,"Streaming message:", current_message)

    const last_message_dom = $( ".last_mes").children(".mes_block").children(".mes_text");
    console.debug(DEBUG_PREFIX,last_message_dom);

    let text_speed = extension_settings.blip.voiceMap[character]["textSpeed"] / 1000;
    is_in_text_animation = true;

    // TODO: manage different type of audio styles
    const min_speed_multiplier = extension_settings.blip.voiceMap[character]["minSpeedMultiplier"];
    const max_speed_multiplier = extension_settings.blip.voiceMap[character]["maxSpeedMultiplier"];
    const comma_delay = extension_settings.blip.voiceMap[character]["commaDelay"] / 1000;
    const phrase_delay = extension_settings.blip.voiceMap[character]["phraseDelay"] / 1000;
    const audio_asset = extension_settings.blip.voiceMap[character]["audioSettings"]["asset"];
    const audio_speed = extension_settings.blip.voiceMap[character]["audioSettings"]["speed"] / 1000;
    const audio_pitch = extension_settings.blip.voiceMap[character]["audioSettings"]["pitch"];

    
    $("#blip_audio").attr("src", audio_asset);

    console.debug(DEBUG_PREFIX, "Normal mode")

    // Wait for audio to load
    while (isNaN($("#blip_audio")[0].duration))
        await delay(0.1);

    playAudioFile(audio_speed, audio_pitch);
    let previous_char = "";

    for(const i in current_message) {
        const next_char = current_message[i]

        // Change speed multiplier on end of phrase
        if (["!","?","."].includes(next_char) && previous_char != next_char) {
            current_multiplier = Math.random() * (max_speed_multiplier - min_speed_multiplier) + min_speed_multiplier;
            //console.debug(DEBUG_PREFIX,"New speed multiplier:",current_multiplier);
        }

        await delay(current_multiplier * text_speed);
        last_message_dom.text(last_message_dom.text()+current_message[i]);
        previous_char = next_char;

        // comma pause
        if ([",",";"].includes(previous_char)){
            is_animation_pause = true;
            await delay(comma_delay);
            is_animation_pause = false;
        }

        // Phrase pause
        if (["!","?","."].includes(previous_char)){
            is_animation_pause = true;
            await delay(phrase_delay);
            is_animation_pause = false;
        }
    }

    is_in_text_animation = false;

    deleteLastMessage();
    getContext().chat.push(final_message);
    addOneMessage(final_message);
    //await eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, (chat.length - 1));
    //console.debug(DEBUG_PREFIX,getContext().chat);
}

async function playAudioFile(speed, pitch) {
    while (is_in_text_animation) {
        if (is_animation_pause) {
            console.debug(DEBUG_PREFIX,"Animation pause, waiting")
            await delay(0.01);
            continue;
        }
        playSound();
        //console.debug(DEBUG_PREFIX,"duration", $("#blip_audio")[0].duration, " + ", current_multiplier * speed);
        await delay($("#blip_audio")[0].duration + current_multiplier * speed);
    }
}

function playSound() {
    $("#blip_audio")[0].pause();
    $("#blip_audio")[0].currentTime = 0;
    $("#blip_audio")[0].play();
}

//#############################//
//  API Calls                  //
//#############################//

async function getBlipAssetsList() {
    console.debug(DEBUG_PREFIX, "getting blip assets");

    try {
        const result = await fetch(`/api/assets/get`, {
            method: 'POST',
            headers: getRequestHeaders(),
        });
        const assets = result.ok ? (await result.json()) : { type: [] };
        console.debug(DEBUG_PREFIX, "Found assets:", assets);
        return assets["blip"];
    }
    catch (err) {
        console.log(err);
        return [];
    }
}

//#############################//
//  Module Worker              //
//#############################//

function updateCharactersList() {
    let current_characters = new Set();
    const context = getContext();
    for (const i of context.characters) {
        current_characters.add(i.name);
    }

    current_characters = Array.from(current_characters);
    current_characters.unshift(context.name1);

    if (JSON.stringify(characters_list) !== JSON.stringify(current_characters)) {
        characters_list = current_characters

        $('#blip_character_select')
            .find('option')
            .remove()
            .end()
            .append('<option value="none">Select Character</option>')
            .val('none')

        for (const charName of characters_list) {
            $("#blip_character_select").append(new Option(charName, charName));
        }

        console.debug(DEBUG_PREFIX, "Updated character list to:", characters_list);
    }
}

async function updateBlipAssetsList() {
    if (blip_assets !== null)
        return;

    blip_assets = await getBlipAssetsList();

    $("#blip_file_asset_select")
        .find('option')
        .remove()
        .append('<option value="none">Select asset</option>')
        .val('none');

    for (const file of blip_assets) {
        $('#blip_file_asset_select').append(new Option("asset: " + file.replace(/^.*[\\\/]/, '').replace(/\.[^/.]+$/, ""), file));
    }

    console.debug(DEBUG_PREFIX,"updated blip assets to",blip_assets)
}

async function moduleWorker() {
    const moduleEnabled = extension_settings.blip.enabled;

    if (moduleEnabled) {
        updateCharactersList();
        updateBlipAssetsList();
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

    $("#blip_text_speed").on("input", onTextSpeedChange);

    $("#blip_origin").on("change", onOriginChange);

    $("#blip_min_speed_multiplier").on("input", onMinSpeedChange);
    $("#blip_max_speed_multiplier").on("input", onMaxSpeedChange);

    $("#blip_comma_delay").on("input", onCommaDelayChange);
    $("#blip_phrase_delay").on("input", onPhraseDelayChange);

    $("#blip_audio_speed").on("input", onAudioSpeedChange);
    $("#blip_audio_pitch").on("input", onAudioPitchChange);
    
    $("#blip_apply").on("click", onApplyClick);
    $("#blip_delete").on("click", onDeleteClick);

    $("#blip_audio").attr("src", "assets/blip/sfx-blipfemale.wav"); // DBG
    $("#blip_audio").prop("volume",1); // DBG

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


// DBG
/*

async function animateText(chat_id) {
    if (!extension_settings.blip.enabled) {
        return;
    }

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
    is_in_text_animation = true;
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

    is_in_text_animation = false;

    deleteLastMessage();
    getContext().chat.push(final_message);
    addOneMessage(final_message);
    //await eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, (chat.length - 1));
    console.debug(DEBUG_PREFIX,getContext().chat);
}*/