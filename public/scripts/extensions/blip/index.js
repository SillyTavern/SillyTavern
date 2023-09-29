/*
TODO:
- Security
    - Prevent swipe during streaming OK
    - Handle special text styling while streaming OK
    - group mode break, need to make generation wait or queue OK
    - Detect regenerate call to stop animation
- Features
    - apply pitch change OK
    - generate sound with JS OK
    - volume option OK
    - add wait for end of audio option OK
    - change setting when selecting existing character voicemaps OK
    - Auto-save on change OK
    - Add user message management OK
    - Add same option as TTS text
*/

import { saveSettingsDebounced, event_types, eventSource, getRequestHeaders, hideSwipeButtons, showSwipeButtons, scrollChatToBottom, messageFormatting, isOdd, countOccurrences } from "../../../script.js";
import { getContext, extension_settings, ModuleWorkerWrapper } from "../../extensions.js";
export { MODULE_NAME };

const extensionName = "blip";
const extensionFolderPath = `scripts/extensions/${extensionName}`;

const MODULE_NAME = 'BLip';
const DEBUG_PREFIX = "<Blip extension> ";
const UPDATE_INTERVAL = 1000;

let current_chat_id = 0;

let characters_list = [] // Updated with module worker
let blip_assets = null; // Initialized only once with module workers

let is_in_text_animation = false;
let is_animation_pause = false;

let current_multiplier = 1.0;

let chat_buffer = {};
let chat_queue = [];

let abort_animation = false;

// Define a context for the Web Audio API
let audioContext = new (window.AudioContext || window.webkitAudioContext)();

let user_message_to_render = -1;

let is_text_to_blip = true;
let is_inside_asterisk = false;

//#############################//
//  Extension UI and Settings  //
//#############################//

const defaultSettings = {
    enabled: false,
    enableUser: false,
    onlyQuote: false,
    ignoreAsterisk: false,

    audioMuted: true,
    audioVolume: 50,

    minSpeedMultiplier: 1.0,
    maxSpeedMultiplier: 1.0,
    commaDelay: 0,
    phraseDelay: 0,

    textSpeed: 10,

    audioVolumeMultiplier: 100,
    audioSpeed: 80,
    audioPitch: 0,
    audioPlayFull: false,

    generatedFrequency: 440,
    
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
    $("#blip_enable_user").prop('checked', extension_settings.blip.enableUser);
    $("#blip_only_quoted").prop('checked', extension_settings.blip.onlyQuote);
    $("#blip_ignore_asterisks").prop('checked', extension_settings.blip.ignoreAsterisk);

    if (extension_settings.blip.audioMuted) {
        $("#blip_audio_mute_icon").removeClass("fa-volume-high");
        $("#blip_audio_mute_icon").addClass("fa-volume-mute");
        $("#blip_audio_mute").addClass("redOverlayGlow");
        $("#blip_audio").prop("muted", true);
    }
    else {
        $("#blip_audio_mute_icon").addClass("fa-volume-high");
        $("#blip_audio_mute_icon").removeClass("fa-volume-mute");
        $("#blip_audio_mute").removeClass("redOverlayGlow");
        $("#blip_audio").prop("muted", false);
    }

    $("#blip_audio_volume").text(extension_settings.blip.audioVolume);
    $("#blip_audio_volume_slider").val(extension_settings.blip.audioVolume);

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
    
    $('#blip_audio_volume_multiplier').val(extension_settings.blip.audioVolumeMultiplier);
    $('#blip_audio_volume_multiplier_value').text(extension_settings.blip.audioVolumeMultiplier);

    $('#blip_audio_speed').val(extension_settings.blip.audioSpeed);
    $('#blip_audio_speed_value').text(extension_settings.blip.audioSpeed);

    $('#blip_audio_pitch').val(extension_settings.blip.audioPitch);
    $('#blip_audio_pitch_value').text(extension_settings.blip.audioPitch);

    $("#blip_audio_play_full").prop('checked', extension_settings.blip.audioPlayFull);

    $('#blip_generated_frequency').val(extension_settings.blip.generatedFrequency);
    $('#blip_generated_frequency_value').text(extension_settings.blip.generatedFrequency);

    updateVoiceMapText();
}

function warningCharacterNotSelected() {
    toastr.warning("Character not selected.", DEBUG_PREFIX + " cannot apply change", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
}

async function onEnabledClick() {
    extension_settings.blip.enabled = $('#blip_enabled').is(':checked');
    saveSettingsDebounced();
}

async function onEnableUserClick() {
    extension_settings.blip.enableUser = $('#blip_enable_user').is(':checked');
    saveSettingsDebounced();
}

async function onOnlyQuotedClick() {
    extension_settings.blip.onlyQuote = $('#blip_only_quoted').is(':checked');
    saveSettingsDebounced();
}

async function onIgnoreAsteriskClick() {
    extension_settings.blip.ignoreAsterisk = $('#blip_ignore_asterisks').is(':checked');
    saveSettingsDebounced();
}


async function onAudioMuteClick() {
    extension_settings.blip.audioMuted = !extension_settings.blip.audioMuted;
    $("#blip_audio_mute_icon").toggleClass("fa-volume-high");
    $("#blip_audio_mute_icon").toggleClass("fa-volume-mute");
    $("#blip_audio").prop("muted", !$("#blip_audio").prop("muted"));
    $("#blip_audio_mute").toggleClass("redOverlayGlow");
    saveSettingsDebounced();
}

async function onAudioVolumeChange() {
    extension_settings.blip.audioVolume = ~~($("#blip_audio_volume_slider").val());
    $("#blip_audio").prop("volume", extension_settings.blip.audioVolume * 0.01);
    $("#blip_audio_volume").text(extension_settings.blip.audioVolume);
    saveSettingsDebounced();
}

async function onCharacterChange() {
    const character = $("#blip_character_select").val();

    if (character == "none") {
        loadSettings();
        return;
    }

    if (extension_settings.blip.voiceMap[character] === undefined) {
        applySetting();
        return;
    }

    const character_settings = extension_settings.blip.voiceMap[character]
    
    $('#blip_text_speed').val(character_settings.textSpeed);
    $('#blip_text_speed_value').text(character_settings.textSpeed);

    $('#blip_min_speed_multiplier').val(character_settings.minSpeedMultiplier);
    $('#blip_min_speed_multiplier_value').text(character_settings.minSpeedMultiplier);

    $('#blip_max_speed_multiplier').val(character_settings.maxSpeedMultiplier);
    $('#blip_max_speed_multiplier_value').text(character_settings.maxSpeedMultiplier);

    $('#blip_comma_delay').val(character_settings.commaDelay);
    $('#blip_comma_delay_value').text(character_settings.commaDelay);

    $('#blip_phrase_delay').val(character_settings.phraseDelay);
    $('#blip_phrase_delay_value').text(character_settings.phraseDelay);

    $('#blip_audio_volume_multiplier').val(character_settings.audioVolume);
    $('#blip_audio_volume_multiplier_value').text(character_settings.audioVolume);

    $('#blip_audio_speed').val(character_settings.audioSpeed);
    $('#blip_audio_speed_value').text(character_settings.audioSpeed);

    if (character_settings.audioOrigin == "file") {
        $("#blip_audio_origin").val("file");
        $("#blip_file_settings").show();
        $("#blip_generated_settings").hide();

        $("#blip_asset_select").val(character_settings.audioSettings.asset);

        $('#blip_audio_pitch').val(character_settings.audioSettings.pitch);
        $('#blip_audio_pitch_value').text(character_settings.audioSettings.pitch);
        $("#blip_audio_play_full").prop('checked', character_settings.audioSettings.wait);
    }

    if (character_settings.audioOrigin == "generated") {
        $("#blip_audio_origin").val("generated");
        $("#blip_file_settings").hide();
        $("#blip_generated_settings").show();

        $('#blip_generated_frequency').val(character_settings.generatedFrequency);
        $('#blip_generated_frequency_value').text(character_settings.generatedFrequency);
    }
}

async function onMinSpeedChange() {
    extension_settings.blip.minSpeedMultiplier = Number($('#blip_min_speed_multiplier').val());
    $("#blip_min_speed_multiplier_value").text(extension_settings.blip.minSpeedMultiplier);
    saveSettingsDebounced();

    const character = $('#blip_character_select').val();
    if (character == "none")
        warningCharacterNotSelected();
    else
        applySetting();
}

async function onMaxSpeedChange() {
    extension_settings.blip.maxSpeedMultiplier = Number($('#blip_max_speed_multiplier').val());
    $("#blip_max_speed_multiplier_value").text(extension_settings.blip.maxSpeedMultiplier)
    saveSettingsDebounced();
    
    const character = $('#blip_character_select').val();
    if (character == "none")
        warningCharacterNotSelected();
    else
        applySetting();
}

async function onCommaDelayChange() {
    extension_settings.blip.commaDelay = Number($('#blip_comma_delay').val());
    $("#blip_comma_delay_value").text(extension_settings.blip.commaDelay)
    saveSettingsDebounced();
    
    const character = $('#blip_character_select').val();
    if (character == "none")
        warningCharacterNotSelected();
    else
        applySetting();
}

async function onPhraseDelayChange() {
    extension_settings.blip.phraseDelay = Number($('#blip_phrase_delay').val());
    $("#blip_phrase_delay_value").text(extension_settings.blip.phraseDelay)
    saveSettingsDebounced();
    
    const character = $('#blip_character_select').val();
    if (character == "none")
        warningCharacterNotSelected();
    else
        applySetting();
}

async function onTextSpeedChange() {
    extension_settings.blip.textSpeed = Number($('#blip_text_speed').val());
    $("#blip_text_speed_value").text(extension_settings.blip.textSpeed)
    saveSettingsDebounced();
    
    const character = $('#blip_character_select').val();
    if (character == "none")
        warningCharacterNotSelected();
    else
        applySetting();
}

async function onOriginChange() {
    const origin = $("#blip_audio_origin").val();
    
    const character = $('#blip_character_select').val();
    if (character == "none")
        warningCharacterNotSelected();
    else
        applySetting();

    if (origin == "file") {
        $("#blip_file_settings").show();
        $("#blip_generated_settings").hide();
        return;
    }

    if (origin == "generated") {
        $("#blip_file_settings").hide();
        $("#blip_generated_settings").show();
        return;
    }
}

async function onGeneratedFrequencyChange() {
    extension_settings.blip.generatedFrequency = Number($('#blip_generated_frequency').val());
    $("#blip_generated_frequency_value").text(extension_settings.blip.generatedFrequency)
    saveSettingsDebounced();
    
    const character = $('#blip_character_select').val();
    if (character == "none")
        warningCharacterNotSelected();
    else
        applySetting();
}

async function onAudioVolumeMultiplierChange() {
    extension_settings.blip.audioVolumeMultiplier = Number($('#blip_audio_volume_multiplier').val());
    $("#blip_audio_volume_multiplier_value").text(extension_settings.blip.audioVolumeMultiplier)
    saveSettingsDebounced();
    
    const character = $('#blip_character_select').val();
    if (character == "none")
        warningCharacterNotSelected();
    else
        applySetting();
}

async function onAudioSpeedChange() {
    extension_settings.blip.audioSpeed = Number($('#blip_audio_speed').val());
    $("#blip_audio_speed_value").text(extension_settings.blip.audioSpeed)
    saveSettingsDebounced();
    
    const character = $('#blip_character_select').val();
    if (character == "none")
        warningCharacterNotSelected();
    else
        applySetting();
}

async function onAudioPitchChange() {
    extension_settings.blip.audioPitch = Number($('#blip_audio_pitch').val());
    $("#blip_audio_pitch_value").text(extension_settings.blip.audioPitch)
    saveSettingsDebounced();
    
    const character = $('#blip_character_select').val();
    if (character == "none")
        warningCharacterNotSelected();
    else
        applySetting();
}

async function onPlayFullClick() {
    extension_settings.blip.audioPlayFull = $('#blip_audio_play_full').is(':checked');
    saveSettingsDebounced();
    
    const character = $('#blip_character_select').val();
    if (character == "none")
        warningCharacterNotSelected();
    else
        applySetting();
}

async function applySetting() {
    let error = false;
    const character = $("#blip_character_select").val();
    const min_speed_multiplier = $("#blip_min_speed_multiplier").val();
    const max_speed_multiplier = $("#blip_max_speed_multiplier").val();
    const comma_delay = $("#blip_comma_delay").val();
    const phrase_delay = $("#blip_phrase_delay").val();
    const text_speed = $("#blip_text_speed").val();
    const audio_volume = $("#blip_audio_volume_multiplier").val();
    const audio_speed = $("#blip_audio_speed").val();
    const audio_origin = $("#blip_audio_origin").val();

    if (character === "none") {
        toastr.error("Character not selected.", DEBUG_PREFIX + " voice mapping apply", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
        return;
    }

    if (audio_origin == "none") {
        toastr.error("Model not selected.", DEBUG_PREFIX + " voice mapping apply", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
        return;
    }

    extension_settings.blip.voiceMap[character] = {
        "minSpeedMultiplier": Number(min_speed_multiplier),
        "maxSpeedMultiplier": Number(max_speed_multiplier),
        "commaDelay": Number(comma_delay),
        "phraseDelay": Number(phrase_delay),
        "textSpeed": Number(text_speed),
        "audioVolume": Number(audio_volume),
        "audioSpeed": Number(audio_speed),
        "audioOrigin": audio_origin
    }

    if (audio_origin == "file") {
        const asset_path = $("#blip_file_asset_select").val();
        const audio_pitch = $("#blip_audio_pitch").val();
        const audio_wait = $("#blip_audio_play_full").is(':checked');

        extension_settings.blip.voiceMap[character]["audioSettings"] = {
            "asset" : asset_path,
            "pitch": audio_pitch,
            "wait": audio_wait
        }
    }
    
    if (audio_origin == "generated") {
        const audio_frequency = $("#blip_generated_frequency").val();

        extension_settings.blip.voiceMap[character]["audioSettings"] = {
            "frequency" : Number(audio_frequency),
        }
    }
    
    updateVoiceMapText();
    console.debug(DEBUG_PREFIX, "Updated settings of ", character, ":", extension_settings.blip.voiceMap[character])
    saveSettingsDebounced();
    toastr.info("Saved Blip settings.", DEBUG_PREFIX + " saved setting for "+character, { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
}

async function onDeleteClick() {
    const character = $("#blip_character_select").val();

    if (character === "none") {
        toastr.error("Character not selected.", DEBUG_PREFIX + " voice mapping delete", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
        return;
    }

    $("#blip_character_select").val("none");

    delete extension_settings.blip.voiceMap[character];
    console.debug(DEBUG_PREFIX, "Deleted settings of ", character);
    updateVoiceMapText();
    saveSettingsDebounced();
    toastr.info("Deleted.", DEBUG_PREFIX + " delete "+character+" from voice map.", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
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
            + voice_settings["audioVolume"] + ","
            + voice_settings["audioSpeed"] + ","
            + voice_settings["audioOrigin"] + ",";

        if (voice_settings["audioOrigin"] == "file") {
            voiceMapText += voice_settings["audioSettings"]["asset"] + ","
            + voice_settings["audioSettings"]["pitch"] + ","
            + voice_settings["audioSettings"]["wait"]
            + "),\n"
        }

        if (voice_settings["audioOrigin"] == "generated") {
            voiceMapText += voice_settings["audioSettings"]["frequency"]
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

async function hyjackMessage(chat_id, is_user=false) {
    if (!extension_settings.blip.enabled)
        return;

    // Ignore first message
    if (chat_id == 0)
        return;

    const character = getContext().chat[chat_id].name

    if (extension_settings.blip.voiceMap[character] === undefined) {
        console.debug(DEBUG_PREFIX, "Character",character,"has no blip voice assigned in voicemap");
        return;
    }

    if (is_user && !extension_settings.blip.enableUser) {
        console.debug(DEBUG_PREFIX, "User blip is disable, nothing to do");
        return;
    }

    //eventSource.emit(event_types.MESSAGE_RECEIVED, 0);

    // Hyjack char message
    const message = getContext().chat[chat_id].mes;

    // Save message for rendering
    chat_buffer[chat_id] = message;

    const char = getContext().chat[chat_id].name;
    console.debug(DEBUG_PREFIX,"Hyjacked from",char,"message:", message);

    // Wait turn
    chat_queue.push(chat_id);

    while(is_in_text_animation || chat_queue[0] != chat_id) {
        console.debug(DEBUG_PREFIX,"A character is talking, waiting for turn of", chat_id, "in",chat_queue);
        await delay(1);
    }
    
    is_in_text_animation = true;
    console.debug(DEBUG_PREFIX,"Now turn of", chat_id, "in",chat_queue);
    chat_queue.shift();
    getContext().chat[chat_id].mes = ""; // Start rendered message empty
}

async function processMessage(chat_id) {
    if (!extension_settings.blip.enabled) {
        return;
    }

    // Ignore first message
    if (chat_id == 0)
        return;

    const current_message = chat_buffer[chat_id];
    const chat = getContext().chat;
    const character = chat[chat_id].name

    if (extension_settings.blip.voiceMap[character] === undefined) {
        console.debug(DEBUG_PREFIX, "Character",character,"has no blip voice assigned in voicemap");
        return;
    }

    getContext().chat[chat_id].mes = current_message;
    console.debug(DEBUG_PREFIX,"Streaming message:", chat_buffer[chat_id])

    const div_dom = $(".mes[mesid='"+chat_id+"'");
    const message_dom = $(div_dom).children(".mes_block").children(".mes_text"); //$( ".last_mes").children(".mes_block").children(".mes_text");
    console.debug(DEBUG_PREFIX,div_dom,message_dom);
    
    const only_quote = extension_settings.blip.onlyQuote;
    const ignore_asterisk = extension_settings.blip.ignoreAsterisk;

    console.debug(DEBUG_PREFIX, "Only quote:", only_quote, "Ignore asterisk:", ignore_asterisk)

    if (only_quote)
        is_text_to_blip = false;
    else
        is_text_to_blip = true;

    let text_speed = extension_settings.blip.voiceMap[character]["textSpeed"] / 1000;
    //is_in_text_animation = true;

    // TODO: manage different type of audio styles
    const min_speed_multiplier = extension_settings.blip.voiceMap[character]["minSpeedMultiplier"];
    const max_speed_multiplier = extension_settings.blip.voiceMap[character]["maxSpeedMultiplier"];
    const comma_delay = extension_settings.blip.voiceMap[character]["commaDelay"] / 1000;
    const phrase_delay = extension_settings.blip.voiceMap[character]["phraseDelay"] / 1000;
    const audio_volume = extension_settings.blip.voiceMap[character]["audioVolume"];
    const audio_speed = extension_settings.blip.voiceMap[character]["audioSpeed"] / 1000;
    const audio_origin = extension_settings.blip.voiceMap[character]["audioOrigin"];

    // Audio asset mode
    if (audio_origin == "file") {
        const audio_asset = extension_settings.blip.voiceMap[character]["audioSettings"]["asset"];
        const audio_pitch = extension_settings.blip.voiceMap[character]["audioSettings"]["pitch"];
        const audio_wait = extension_settings.blip.voiceMap[character]["audioSettings"]["wait"];
        $("#blip_audio").attr("src", audio_asset);
        
        // Wait for audio to load
        while (isNaN($("#blip_audio")[0].duration))
        await delay(0.1);

        playAudioFile(audio_volume, audio_speed, audio_pitch, audio_wait);
    }
    else { // Generate blip mode
        const audio_frequency = extension_settings.blip.voiceMap[character]["audioSettings"]["frequency"];
        playGeneratedBlip(audio_volume, audio_speed, audio_frequency);
    }
    let previous_char = "";
    let current_string = ""
    
    //scrollChatToBottom();
    is_animation_pause = false;
    is_inside_asterisk = false;
    for(const i in current_message) {

        // Finish animation by user abort click
        if (abort_animation)
        {
            message_dom.html(messageFormatting(current_message,character,false,false));
            break;
        }
        
        hideSwipeButtons();
        message_dom.closest(".mes_block").find(".mes_buttons").css("display", "none");
        const next_char = current_message[i]

        // Only quote mode
        if (next_char == '"' && only_quote) {
            if (!(is_inside_asterisk && ignore_asterisk))
                is_text_to_blip = !is_text_to_blip;
        }

        // Ignore asterisk mode
        if (next_char == "*")
            is_inside_asterisk = !is_inside_asterisk;
        
        if (is_inside_asterisk && ignore_asterisk) {
            is_text_to_blip = false;
        }

        // Change speed multiplier on end of phrase
        if (["!","?","."].includes(next_char) && previous_char != next_char) {
            current_multiplier = Math.random() * (max_speed_multiplier - min_speed_multiplier) + min_speed_multiplier;
            //console.debug(DEBUG_PREFIX,"New speed multiplier:",current_multiplier);
        }

        await delay(current_multiplier * text_speed);
        current_string += next_char;

        // Predict special character for continuous formating
        let predicted_string = current_string
        const charsToBalance = ['*', '"'];
        for (const char of charsToBalance) {
            if (isOdd(countOccurrences(current_string, char))) {
                // Add character at the end to balance it
                predicted_string = predicted_string.trimEnd() + char;
            }
        }

        message_dom.html(messageFormatting(predicted_string,character,false,false));
        previous_char = next_char;

        // comma pause
        if (comma_delay > 0 && [",",";"].includes(previous_char)){
            is_animation_pause = true;
            await delay(comma_delay);
            is_animation_pause = false;
        }

        // Phrase pause
        if (phrase_delay > 0 && ["!","?","."].includes(previous_char)){
            is_animation_pause = true;
            await delay(phrase_delay);
            is_animation_pause = false;
        }
    }
    abort_animation = false;

    message_dom.closest(".mes_block").find(".mes_buttons").css("display", "none");
    showSwipeButtons();
    scrollChatToBottom();
    
    is_in_text_animation = false;

    //$(".mes[mesid='" + chat_id + "']").remove();
    //messageEditDone(message_dom);
    //deleteLastMessage();
    //getContext().chat.push(final_message);
    //addOneMessage(final_message);
    //await eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, (chat.length - 1));
    //console.debug(DEBUG_PREFIX,getContext().chat);
}

async function playAudioFile(volume, speed, pitch, wait) {
    while (is_in_text_animation) {
        if (is_animation_pause || !is_text_to_blip) {
            //console.debug(DEBUG_PREFIX,"Animation pause, waiting")
            await delay(0.01);
            continue;
        }
        $("#blip_audio").prop("volume", extension_settings.blip.audioVolume * 0.01 * volume * 0.01);
        $("#blip_audio").prop("mozPreservesPitch ", false);
        $("#blip_audio").prop("playbackRate", pitch);
        $("#blip_audio")[0].pause();
        $("#blip_audio")[0].currentTime = 0;
        $("#blip_audio")[0].play();
        console.debug(DEBUG_PREFIX,"PITCH",pitch);
        let wait_time = current_multiplier * speed;
        if (wait)
            wait_time += $("#blip_audio")[0].duration;
        await delay(wait_time);
    }
    
    $("#blip_audio").prop("volume", extension_settings.blip.audioVolume * 0.01);
    $("#blip_audio").prop("playbackRate", 1.0);
}

async function playGeneratedBlip(volume, speed, frequency) {
    while (is_in_text_animation) {
        if (is_animation_pause || !is_text_to_blip) {
            await delay(0.01);
            continue;
        }
        playBlip(frequency);
        await delay(0.01 + current_multiplier * speed);
    }
}

// Function to play a sound with a certain pitch
function playBlip(pitch) {
    // Create an oscillator node
    let oscillator = audioContext.createOscillator();
  
    // Set the oscillator wave type
    oscillator.type = 'sine';
  
    // Set the frequency of the wave (controls the pitch)
    oscillator.frequency.value = pitch;
  
    // Create a gain node to control the volume
    let gainNode = audioContext.createGain();
    
    // Connect the oscillator to the gain node
    oscillator.connect(gainNode);
  
    // Connect the gain node to the audio output
    gainNode.connect(audioContext.destination);
  
    // Set the gain to 0
    gainNode.gain.value = 0;
  
    // Start the oscillator now
    oscillator.start(audioContext.currentTime);
  
    // Create an "attack" stage (volume ramp up)
    gainNode.gain.linearRampToValueAtTime(0.1, audioContext.currentTime + 0.01);
  
    // Create a "decay" stage (volume ramp down)
    gainNode.gain.exponentialRampToValueAtTime(0.00001, audioContext.currentTime + 0.1);
  
    // Stop the oscillator after 100 milliseconds
    oscillator.stop(audioContext.currentTime + 0.1);
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

        if (user_message_to_render != -1) {
            if (extension_settings.blip.enableUser)
                processMessage(user_message_to_render);
            user_message_to_render = -1;
        }
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
    $("#blip_enable_user").on("click", onEnableUserClick);
    $("#blip_only_quoted").on("click", onOnlyQuotedClick);
    $("#blip_ignore_asterisks").on("click", onIgnoreAsteriskClick);

    $("#blip_audio").hide();
    
    $("#blip_audio_mute").on("click", onAudioMuteClick);
    $("#blip_audio_volume_slider").on("input", onAudioVolumeChange);

    $("#blip_character_select").on("change", onCharacterChange);

    $("#blip_text_speed").on("input", onTextSpeedChange);

    $("#blip_min_speed_multiplier").on("input", onMinSpeedChange);
    $("#blip_max_speed_multiplier").on("input", onMaxSpeedChange);

    $("#blip_comma_delay").on("input", onCommaDelayChange);
    $("#blip_phrase_delay").on("input", onPhraseDelayChange);

    $("#blip_audio_volume_multiplier").on("input", onAudioVolumeMultiplierChange);
    $("#blip_audio_speed").on("input", onAudioSpeedChange);
    $("#blip_audio_pitch").on("input", onAudioPitchChange);
    $("#blip_audio_play_full").on("click", onPlayFullClick);
    
    $("#blip_audio_origin").on("change", onOriginChange);

    $("#blip_file_settings").hide();
    $("#blip_generated_frequency").on("input", onGeneratedFrequencyChange);
    
    //$("#blip_apply").on("click", onApplyClick);
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

    $("#mes_stop").on("click", function() {abort_animation = true;});

    eventSource.on(event_types.MESSAGE_RECEIVED, (chat_id) => hyjackMessage(chat_id));
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (chat_id) => processMessage(chat_id));

    eventSource.on(event_types.MESSAGE_SENT, (chat_id) => hyjackMessage(chat_id, true));
    eventSource.on(event_types.USER_MESSAGE_RENDERED, (chat_id) => {user_message_to_render = chat_id;});

    const wrapper = new ModuleWorkerWrapper(moduleWorker);
    setInterval(wrapper.update.bind(wrapper), UPDATE_INTERVAL);
    moduleWorker();

    console.debug(DEBUG_PREFIX,"Finish loaded.");
});