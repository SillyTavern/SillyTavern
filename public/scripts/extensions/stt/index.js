import { callPopup, eventSource, event_types, getRequestHeaders, saveSettingsDebounced } from "../../../script.js";
import { dragElement, isMobile } from "../../RossAscends-mods.js";
import { getContext, getApiUrl, modules, extension_settings, ModuleWorkerWrapper, doExtrasFetch } from "../../extensions.js";
import { power_user } from "../../power-user.js";
import { onlyUnique, debounce, getCharaFilename } from "../../utils.js";
import { VoskSttProvider } from './vosk.js'
import { WhisperSttProvider } from './whisper.js'
import { BrowserSttProvider } from './browser.js'
export { MODULE_NAME };

const MODULE_NAME = 'stt';
const UPDATE_INTERVAL = 100;

let inApiCall = false;

let sttProviders = {
    Browser: BrowserSttProvider,
    Whisper: WhisperSttProvider,
    Vosk: VoskSttProvider,
}

let sttProvider = new BrowserSttProvider
let sttProviderName = "Browser"
//let sttProvider = new WhisperSttProvider
//let sttProviderName = "Whisper"

let pushToTalkKeyDown = false

// WebRTC
let audioStream = null

async function moduleWorker() {
    const enabled = extension_settings.stt.enabled
    const record_mode = extension_settings.stt.recordMode

    if (!enabled | sttProviderName == "Browser") {
        return
    }

    if (record_mode == "push_to_talk" & !pushToTalkKeyDown) {
        return
    }

    // API is busy
    if (inApiCall) {
        return;
    }

    try {
        inApiCall = true;
        const userMessageOriginal =  await sttProvider.getUserMessage();
        let userMessageFormatted = userMessageOriginal.trim();

        if (userMessageFormatted.length > 0)
        {
            console.debug("<STT-module> recorded transcript: \""+userMessageFormatted+"\"");
            const messageMode = extension_settings.stt.messageMode;

            console.debug("<STT-module> mode: "+messageMode);

            // Prevent double message
            if (extension_settings.stt.waitResponse) {
                const chat_log = getContext().chat
                if (chat_log.length > 0) {
                    const last_message = chat_log[chat_log.length-1]
                    if (last_message.is_user) {
                        if (extension_settings.stt.debug) {
                            $('#debug_output').text("<SST-module DEBUG>: message ignored, waiting for AI message. Voice transcript: \""+ userMessageFormatted +"\"");
                            toastr.info(
                                "Waiting for character message. Voice transcript: \""+ userMessageFormatted +"\"",
                                "<SST-module DEBUG> message ignored",
                                { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true },
                            );
                        }
                        console.debug("<STT-module> Already waiting for response from last message, ignore message.");
                        return;
                    }
                }
            }

            let userMessageLower = userMessageFormatted.toLowerCase()
            // remove punctuation
            let userMessageRaw = userMessageLower.replace(/[^\w\s\']|_/g, "").replace(/\s+/g, " ");
            let commandDetected = false;

            // Check message mapping
            if (extension_settings.stt.messageMappingEnabled) {
                console.debug("<STT-module> Start searching message mapping into:",userMessageRaw)
                for (const key in extension_settings.stt.messageMapping) {
                    console.debug("<STT-module> message mapping searching: ", key,"=>",extension_settings.stt.messageMapping[key]);
                    if (userMessageRaw.includes(key)) {
                        userMessageFormatted = extension_settings.stt.messageMapping[key];
                        commandDetected = true;
                        console.debug("<STT-module> message mapping found: ", key,"=>",extension_settings.stt.messageMapping[key]);
                        $("#send_textarea").val(userMessageFormatted);
                        const context = getContext();
                        await context.generate();
                        break;
                    }
                }
            }

            if (!commandDetected) {
                console.debug("<STT-module> no message mapping found, processing normal message");

                switch (messageMode) {
                    case "auto_send":

                        // Detect trigger words
                        if (commandDetected == false & extension_settings.stt.triggerWordsEnabled & extension_settings.stt.triggerWords.length > 0 & extension_settings.stt.recordMode == "voice_detection") {
                            let messageStart = -1
                            
                            for (const triggerWord of extension_settings.stt.triggerWords) {
                                const triggerPos = userMessageLower.indexOf(triggerWord.toLowerCase());
                                
                                // Trigger word not found or not starting message and just a substring
                                if (triggerPos == -1 | (triggerPos > 0 & userMessageFormatted[triggerPos-1] != " ")) {
                                    console.debug("<STT-module> trigger word not found: ", triggerWord);
                                }
                                else {
                                    console.debug("<STT-module> Found trigger word: ", triggerWord, " at index ", triggerPos);
                                    if (triggerPos < messageStart | (messageStart == -1 & (triggerPos + triggerWord.length) < userMessageFormatted.length)) {
                                        messageStart = triggerPos + triggerWord.length + 1
                                    }
                                }
                            }

                            if (messageStart == -1) {
                                $('#debug_output').text("<SST-module DEBUG>: message ignored, no trigger word preceding a message. Voice transcript: \""+ userMessageOriginal +"\"");
                                if (extension_settings.stt.debug) {
                                    toastr.info(
                                        "No trigger word preceding a message. Voice transcript: \""+ userMessageOriginal +"\"",
                                        "<SST-module DEBUG>: message ignored.",
                                        { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true },
                                    );
                                }
                                return
                            }
                            else{
                                userMessageFormatted = userMessageFormatted.substring(messageStart)
                            }
                        }

                        $('#send_textarea').val("") // clear message area to avoid double message

                        console.debug("<STT-module> Sending message")
                        const context = getContext();
                        const messageText = userMessageFormatted;
                        const message = {
                            name: context.name1,
                            is_user: true,
                            is_name: true,
                            send_date: Date.now(),
                            mes: messageText,
                        };
                        context.chat.push(message);
                        context.addOneMessage(message);
                        
                        await context.generate();

                        $('#debug_output').text("<SST-module DEBUG>: message sent, cut using trigger word. Voice transcript: \""+ userMessageOriginal +"\"");
                        break;

                    case "replace":
                        console.debug("<STT-module> Replacing message")
                        $('#send_textarea').val(userMessageFormatted);
                        break;

                    case "append":
                        console.debug("<STT-module> Appending message")
                        $('#send_textarea').val($('#send_textarea').val()+" "+userMessageFormatted);
                        break;

                    default:
                        console.debug("<STT-module> Not supported stt message mode: "+messageMode)

                }
            }
        }
        else
        {
            //console.debug("<STT-module> Empty record, do nothing");
        }
    }
    catch (error) {
        console.debug(error);
    }
    finally {
        inApiCall = false;
    }
}

//##############//
// STT Provider //
//##############//

function loadSttProvider(provider) {
    //Clear the current config and add new config
    $("#stt_provider_settings").html("")

    // Init provider references
    extension_settings.stt.currentProvider = provider
    sttProviderName = provider
    sttProvider = new sttProviders[provider]

    // Init provider settings
    $('#stt_provider_settings').append(sttProvider.settingsHtml)
    if (!(sttProviderName in extension_settings.stt)) {
        console.warn(`Provider ${sttProviderName} not in Extension Settings, initiatilizing provider in settings`)
        extension_settings.stt[sttProviderName] = {}
    }

    $('#stt_provider').val(sttProviderName)

    sttProvider.loadSettings(extension_settings.stt[sttProviderName])

    // Use microphone button as push to talk
    if (sttProviderName != "Browser") {
        $("#microphone_button").show();
        $("#microphone_button").off('click').on("click", function () {
            if (!pushToTalkKeyDown) {
                console.debug("<STT-module> UI microphone button pressed (recording start).");
                pushToTalkKeyDown = true
                $("#microphone_button").toggleClass('fa-microphone fa-microphone-slash');
            } else {
                console.debug("<STT-module> UI microphone button pressed (recording end).");
                pushToTalkKeyDown = false
                $("#microphone_button").toggleClass('fa-microphone fa-microphone-slash');
            }
        });
        
        $("#stt_record_mode_div").show();
        $("#stt_push_to_talk_key_div").show();
        $("#stt_trigger_words_div").show();
        $("#stt_message_mapping_div").show();
        $("#stt_wait_response_div").show();

    }
    else {
        $("#stt_record_mode_div").hide();
        $("#stt_push_to_talk_key_div").hide();
        $("#stt_trigger_words_div").hide();
        $("#stt_message_mapping_div").hide();
        $("#stt_wait_response_div").hide();
    }
}

function onSttProviderChange() {
    const sttProviderSelection = $('#stt_provider').val()
    loadSttProvider(sttProviderSelection)
    saveSettingsDebounced();
}

function onSttProviderSettingsInput() {
    sttProvider.onSettingsChange();

    // Persist changes to SillyTavern stt extension settings
    extension_settings.stt[sttProviderName] = sttProvider.setttings;
    saveSettingsDebounced();
    console.info(`Saved settings ${sttProviderName} ${JSON.stringify(sttProvider.settings)}`);
}

//#############################//
//  Extension UI and Settings  //
//#############################//

const defaultSettings = {
    currentProvider: "Whisper",
    enabled: true,
    recordMode: "voice_detection",
    messageMode: "replace",
    waitResponse: true,
    pushToTalkKey: null,
    triggerWords: [],
    triggerWordsEnabled: false,
    messageMappingText: "",
    messageMapping: [],
    messageMappingEnabled: false,
    debug: false,
}

function loadSettings() {
    if (Object.keys(extension_settings.stt).length === 0) {
        Object.assign(extension_settings.stt, defaultSettings)
    }
    $('#stt_enabled').prop('checked',extension_settings.stt.enabled);
    //$('body').toggleClass('stt', extension_settings.stt.enabled);
    $('#stt_message_mode').val(extension_settings.stt.messageMode);
    $('#stt_record_mode').val(extension_settings.stt.recordMode);
    $('#stt_wait_response').prop('checked',extension_settings.stt.waitResponse);
    $('#stt_debug').prop('checked',extension_settings.stt.debug);

    if (extension_settings.stt.pushToTalkKey != null) {
        $('#stt_push_to_talk_key').val(extension_settings.stt.pushToTalkKey);
    }

    if (extension_settings.stt.triggerWords.length > 0) {
        $('#stt_trigger_words').val(extension_settings.stt.triggerWords);
    }
    
    $('#stt_trigger_words_enabled').prop('checked',extension_settings.stt.triggerWordsEnabled);

    if (extension_settings.stt.messageMappingText.length > 0) {
        $('#stt_message_mapping').val(extension_settings.stt.messageMappingText);
    }

    $('#stt_message_mapping_enabled').prop('checked',extension_settings.stt.messageMappingEnabled);
    
    if (extension_settings.stt.recordMode == "push_to_talk") {
        $("#stt_push_to_talk_key_div").show()
    }
    else {
        $("#stt_push_to_talk_key_div").hide()
    }

    if(extension_settings.stt.messageMode == "auto_send") {
        $("#stt_wait_response_div").show()
    }
    else {
        $("#stt_wait_response_div").hide()
    }
}

async function onEnableClick() {
    extension_settings.stt.enabled = $('#stt_enabled').is(':checked');
    if (!extension_settings.stt.enabled) $("#microphone_button").hide();
    else $("#microphone_button").show();
    saveSettingsDebounced()
}

async function onRecordModeChange() {
    extension_settings.stt.recordMode = $('#stt_record_mode').val();
    if (extension_settings.stt.recordMode == "push_to_talk") {
        $("#stt_push_to_talk_key_div").show()
    }
    else {
        $("#stt_push_to_talk_key_div").hide()
    }
    saveSettingsDebounced();
}

async function onMessageModeChange() {
    extension_settings.stt.messageMode = $('#stt_message_mode').val();

    if(sttProviderName != "Browser" & extension_settings.stt.messageMode == "auto_send") {
        $("#stt_wait_response_div").show()
    }
    else {
        $("#stt_wait_response_div").hide()
    }

    saveSettingsDebounced();
}

async function onWaitResponseClick() {
    extension_settings.stt.waitResponse = $('#stt_wait_response').is(':checked');
    saveSettingsDebounced()
}

async function onPushToTalkKeyChange() {
    extension_settings.stt.pushToTalkKey = $('#stt_push_to_talk_key').val();
    saveSettingsDebounced();
}

async function onTriggerWordsChange() {
    let array = $('#stt_trigger_words').val().split(",");
    array = array.map(element => {return element.trim().toLowerCase();});
    array = array.filter((str) => str !== '');
    $("#stt_trigger_words_status").text("Trigger words updated to: "+array)
    console.debug("<STT-module> Updated trigger words", array);
    extension_settings.stt.triggerWords = array;
    saveSettingsDebounced();
}

async function onTriggerWordsEnabledClick() {
    extension_settings.stt.triggerWordsEnabled = $('#stt_trigger_words_enabled').is(':checked');
    saveSettingsDebounced()
}

async function onMessageMappingChange() {
    let array = $('#stt_message_mapping').val().split(",");
    array = array.map(element => {return element.trim();});
    array = array.filter((str) => str !== '');
    extension_settings.stt.messageMapping = {};
    for (const text of array) {
        if (text.includes("=")) {
            const pair = text.toLowerCase().split("=")
            extension_settings.stt.messageMapping[pair[0].trim()] = pair[1].trim()
            console.debug("<STT-module> Added mapping", pair[0],"=>", extension_settings.stt.messageMapping[pair[0]]);
        }
        else {
            console.debug("<STT-module> Wrong syntax for message mapping, no '=' found in:", text);
        }
    }
    
    $("#stt_message_mapping_status").text("Message mapping updated to: "+JSON.stringify(extension_settings.stt.messageMapping))
    console.debug("<STT-module> Updated message mapping", extension_settings.stt.messageMapping);
    extension_settings.stt.messageMappingText = $('#stt_message_mapping').val()
    saveSettingsDebounced();
}

async function onMessageMappingEnabledClick() {
    extension_settings.stt.messageMappingEnabled = $('#stt_message_mapping_enabled').is(':checked');
    saveSettingsDebounced()
}

async function onDebugClick() {
    extension_settings.stt.debug = $('#stt_debug').is(':checked');
    saveSettingsDebounced()
}

$(document).ready(function () {
    function addExtensionControls() {
        const settingsHtml = `
        <div id="stt_settings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>STT</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <div>
                        <span>Select STT Provider</span> </br>
                        <select id="stt_provider">
                        </select>
                    </div>
                    <div>
                        <label class="checkbox_label" for="stt_enabled">
                            <input type="checkbox" id="stt_enabled" name="stt_enabled">
                            <small>Enabled</small>
                        </label>
                    </div>
                    <div id="stt_record_mode_div">
                        <span>Record mode</span> </br>
                        <select id="stt_record_mode">
                            <option value="voice_detection">Voice detection</option>
                            <option value="push_to_talk">Push to talk</option>
                        </select>
                    </div>
                    <div id="stt_push_to_talk_key_div">
                        <span>Push to talk key</span>
                        <input id="stt_push_to_talk_key" class="text_pole" placeholder="(click here and press key)">
                    </div>
                    <div id="stt_message_mode_div">
                        <span>Message mode</span> </br>
                        <select id="stt_message_mode">
                            <option value="append">Append</option>
                            <option value="replace">Replace</option>
                            <option value="auto_send">Auto send</option>
                        </select>
                    </div>
                    <div id="stt_wait_response_div">
                        <label class="checkbox_label" for="stt_wait_response">
                            <input type="checkbox" id="stt_wait_response" name="stt_wait_response">
                            <small>Wait for response</small>
                        </label>
                    </div>
                    <div id="stt_trigger_words_div">
                        <span>Trigger words</span>
                        <textarea id="stt_trigger_words" class="text_pole textarea_compact" type="text" rows="4" placeholder="Enter comma separated words that trigger new message, example:\nhey, hey aqua, record, listen"></textarea>
                        <span id="stt_trigger_words_status"></span>
                        <label class="checkbox_label" for="stt_trigger_words_enabled">
                            <input type="checkbox" id="stt_trigger_words_enabled" name="stt_trigger_words_enabled">
                            <small>Enable trigger words</small>
                        </label>
                    </div>
                    <div id="stt_message_mapping_div">
                        <span>Message mapping</span>
                        <textarea id="stt_message_mapping" class="text_pole textarea_compact" type="text" rows="4" placeholder="Enter comma separated phrases mapping, example:\ncommand delete = /del 1,\nslash delete = /del 1,\nsystem roll = /roll 2d6,\nhey continue = /continue"></textarea>
                        <span id="stt_message_mapping_status"></span>
                        <label class="checkbox_label" for="stt_message_mapping_enabled">
                            <input type="checkbox" id="stt_message_mapping_enabled" name="stt_message_mapping_enabled">
                            <small>Enable messages mapping</small>
                        </label>
                    </div>
                    <div>
                        <label class="checkbox_label" for="stt_debug">
                            <input type="checkbox" id="stt_debug" name="stt_debug">
                            <small>Debug pop up</small>
                        </label>
                    </div>
                    <form id="stt_provider_settings" class="inline-drawer-content">
                    </form>
                </div>
            </div>
        </div>
        `;
        $('#extensions_settings').append(settingsHtml);
        $('#stt_enabled').on('click', onEnableClick);
        $('#stt_provider_settings').on('input', onSttProviderSettingsInput);
        for (const provider in sttProviders) {
            $('#stt_provider').append($("<option />").val(provider).text(provider));
            console.debug("<STT-module> added option "+provider);
        }
        $('#stt_provider').on('change', onSttProviderChange);
        $('#stt_message_mode').on('change', onMessageModeChange);
        $('#stt_record_mode').on('change', onRecordModeChange);
        $('#stt_push_to_talk_key').on('change', onPushToTalkKeyChange);
        $('#stt_trigger_words').on('change', onTriggerWordsChange);
        $('#stt_trigger_words_enabled').on('click', onTriggerWordsEnabledClick);
        $('#stt_message_mapping').on('change', onMessageMappingChange);
        $('#stt_message_mapping_enabled').on('click', onMessageMappingEnabledClick);
        $('#stt_wait_response').on('click', onWaitResponseClick);
        $('#stt_debug').on('click', onDebugClick);
        $('#stt_status').hide();

        $("#stt_push_to_talk_key").attr('readonly','readonly');
        $("#stt_push_to_talk_key").on("keypress", function(e){
            $("#stt_push_to_talk_key").val(e.key);
            onPushToTalkKeyChange();
            console.debug("<STT-module> Changed push to talk key to: "+$("#stt_push_to_talk_key").val());
          });

        $("body").keydown(function(e) {
        //console.debug("<STT-module> Keydown: "+e.key);
        if (!pushToTalkKeyDown & e.key == extension_settings.stt.pushToTalkKey) {
            console.debug("<STT-module> Push to talk pressed");
            pushToTalkKeyDown = true
        };
        });
        
        $("body").keyup(function(e) {
        //console.debug("<STT-module> Keyup: "+e.key);
        if (pushToTalkKeyDown & e.key == extension_settings.stt.pushToTalkKey) {
            console.debug("<STT-module> Push to talk released");
            pushToTalkKeyDown = false
        };
        });

        
        const $button = $('<div id="microphone_button" class="fa-solid fa-microphone speech-toggle" title="Click to speak"></div>');
        $('#send_but_sheld').prepend($button);

        if (!extension_settings.stt.enabled) $button.hide();
    }
    addExtensionControls(); // No init dependencies
    loadSettings(); // Depends on Extension Controls and loadTtsProvider
    loadSttProvider(extension_settings.stt.currentProvider); // No dependencies
    const wrapper = new ModuleWorkerWrapper(moduleWorker);
    setInterval(wrapper.update.bind(wrapper), UPDATE_INTERVAL); // Init depends on all the things
    moduleWorker();

    /*/ DEBUG webRTC
    //--------------------
    // TODO
    // - retrieve audio recording
    // - send to extras server
    
    $("#microphone_button").off('click').on("click", function () {
        if(audioStream === null) {
            navigator.mediaDevices.getUserMedia({audio: true, video: false})
            .then(stream => {
                audioStream = stream
                const audioTracks = audioStream.getAudioTracks();
                console.log(`Using audio device: ${audioTracks[0].label}`);
                audioStream.onremovetrack = () => {
                console.log("Stream ended");
                };
            }).catch(error => {
                if (error.name === "NotAllowedError") {
                console.error(
                    "You need to grant this page permission to access your microphone.",
                );
                } else {
                console.error(`getUserMedia error: ${error.name}`, error);
                }
            });
        } else {
            console.log("Stream ended by button");
            audioStream.getAudioTracks()[0].stop();
            audioStream = null
        }
    });

    //--------------------*/
})