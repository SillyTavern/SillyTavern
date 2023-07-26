/*
TODO:
 - send recorded audio to extras server
 - try pseudo streaming audio by just sending chunk every X seconds and asking VOSK if it is full text.
*/

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
    None: null,
    Browser: BrowserSttProvider,
    Whisper: WhisperSttProvider,
    Vosk: VoskSttProvider,
}

let sttProvider = null
let sttProviderName = "None"
//let sttProvider = new WhisperSttProvider
//let sttProviderName = "Whisper"

let audioRecording = false
const constraints = { audio: { sampleSize: 16, channelCount: 1, sampleRate: 16000 } };
let chunks = [];

async function processTranscript(transcript) {
    try {
        const transcriptOriginal =  transcript;
        let transcriptFormatted = transcriptOriginal.trim();

        if (transcriptFormatted.length > 0)
        {
            console.debug("<STT-module> recorded transcript: \""+transcriptFormatted+"\"");
            const messageMode = extension_settings.stt.messageMode;
            console.debug("<STT-module> mode: "+messageMode);

            let transcriptLower = transcriptFormatted.toLowerCase()
            // remove punctuation
            let transcriptRaw = transcriptLower.replace(/[^\w\s\']|_/g, "").replace(/\s+/g, " ");

            // Check message mapping
            if (extension_settings.stt.messageMappingEnabled) {
                console.debug("<STT-module> Start searching message mapping into:",transcriptRaw)
                for (const key in extension_settings.stt.messageMapping) {
                    console.debug("<STT-module> message mapping searching: ", key,"=>",extension_settings.stt.messageMapping[key]);
                    if (transcriptRaw.includes(key)) {
                        var message = extension_settings.stt.messageMapping[key];
                        console.debug("<STT-module> message mapping found: ", key,"=>",extension_settings.stt.messageMapping[key]);
                        $("#send_textarea").val(message);

                        if (messageMode == "auto_send") getContext().generate();
                        return;
                    }
                }
            }

            console.debug("<STT-module> no message mapping found, processing transcript as normal message");

            switch (messageMode) {
                case "auto_send":
                    $('#send_textarea').val("") // clear message area to avoid double message

                    console.debug("<STT-module> Sending message")
                    const context = getContext();
                    const messageText = transcriptFormatted;
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

                    $('#debug_output').text("<SST-module DEBUG>: message sent: \""+ transcriptFormatted +"\"");
                    break;

                case "replace":
                    console.debug("<STT-module> Replacing message")
                    $('#send_textarea').val(transcriptFormatted);
                    break;

                case "append":
                    console.debug("<STT-module> Appending message")
                    $('#send_textarea').val($('#send_textarea').val()+" "+transcriptFormatted);
                    break;

                default:
                    console.debug("<STT-module> Not supported stt message mode: "+messageMode)

            }
        }
        else
        {
            console.debug("<STT-module> Empty transcript, do nothing");
        }
    }
    catch (error) {
        console.debug(error);
    }
}

function loadNavigatorAudioRecording() {
    if (navigator.mediaDevices.getUserMedia) {
        console.log('<STT-module> getUserMedia supported by browser.');
      
        let onSuccess = function(stream) {
          const mediaRecorder = new MediaRecorder(stream);
      
          $("#microphone_button").off('click').on("click", function() {
            if (!audioRecording) {
                mediaRecorder.start();
                console.log(mediaRecorder.state);
                console.log("recorder started");
                audioRecording = true;
                $("#microphone_button").toggleClass('fa-microphone fa-microphone-slash');
            }
            else {
                mediaRecorder.stop();
                console.log(mediaRecorder.state);
                console.log("recorder stopped");
                audioRecording = false;
                $("#microphone_button").toggleClass('fa-microphone fa-microphone-slash');
            }
          });
      
          mediaRecorder.onstop = async function() {
            console.log("<STT-module> data available after MediaRecorder.stop() called: ", chunks.length, " chunks");
            const audioblob = new Blob(chunks, { type: "audio/wav" });
            chunks = [];
            var requestData = new FormData();
            requestData.append('AudioFile', audioblob, 'record.wav');
            
            const url = new URL(getApiUrl());
            url.pathname = '/api/stt/whisper/process-audio';

            if (extension_settings.stt.currentProvider == "Vosk") {
                
            url.pathname = '/api/stt/vosk/process-audio';
            }
        
            const apiResult = await doExtrasFetch(url, {
                method: 'POST',
                body: requestData,
            });

            if (!apiResult.ok) {
                toastr.error(apiResult.statusText, 'STT Generation Failed  (Whisper)', { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
                throw new Error(`HTTP ${apiResult.status}: ${await apiResult.text()}`);
            }
            
            const data = await apiResult.json();
            // TODO: lock and release recording while processing
            console.log("<STT-module> received transcript:", data.transcript);

            processTranscript(data.transcript);
          }
      
          mediaRecorder.ondataavailable = function(e) {
            chunks.push(e.data);
          }
        }
      
        let onError = function(err) {
          console.log('<STT-module> The following error occured: ' + err);
        }
      
        navigator.mediaDevices.getUserMedia(constraints).then(onSuccess, onError);
      
      } else {
         console.log('<STT-module> getUserMedia not supported on your browser!');
         toastr.error("getUserMedia not supported", '<STT-module> not supported for your browser.', { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
      }
}

//##############//
// STT Provider //
//##############//

function loadSttProvider(provider) {
    //Clear the current config and add new config
    $("#stt_provider_settings").html("");

    // Init provider references
    extension_settings.stt.currentProvider = provider;
    sttProviderName = provider;

    if (!(sttProviderName in extension_settings.stt)) {
        console.warn(`Provider ${sttProviderName} not in Extension Settings, initiatilizing provider in settings`)
        extension_settings.stt[sttProviderName] = {}
    }
    
    $('#stt_provider').val(sttProviderName)

    if (sttProviderName == "None") {
        $("#microphone_button").hide();
        $("#stt_enabled_div").hide();
        $("#stt_message_mode_div").hide();
        return;
    }
    else {
        $("#stt_enabled").show();
        $("#stt_message_mode_div").show();
    }

    sttProvider = new sttProviders[provider]

    // Init provider settings
    $('#stt_provider_settings').append(sttProvider.settingsHtml)
    sttProvider.loadSettings(extension_settings.stt[sttProviderName])

    // Use microphone button as push to talk
    if (sttProviderName != "Browser") {

        loadNavigatorAudioRecording();

        $("#microphone_button").show();
        $("#stt_message_mapping_div").show();

    }
    else {
        $("#stt_message_mapping_div").hide();
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
    currentProvider: "None",
    enabled: true,
    messageMode: "append",
    messageMappingText: "",
    messageMapping: [],
    messageMappingEnabled: false
}

function loadSettings() {
    if (Object.keys(extension_settings.stt).length === 0) {
        Object.assign(extension_settings.stt, defaultSettings)
    }
    $('#stt_enabled').prop('checked',extension_settings.stt.enabled);
    $('#stt_message_mode').val(extension_settings.stt.messageMode);

    if (extension_settings.stt.messageMappingText.length > 0) {
        $('#stt_message_mapping').val(extension_settings.stt.messageMappingText);
    }

    $('#stt_message_mapping_enabled').prop('checked',extension_settings.stt.messageMappingEnabled);
}

async function onEnableClick() {
    extension_settings.stt.enabled = $('#stt_enabled').is(':checked');
    if (!extension_settings.stt.enabled) $("#microphone_button").hide();
    else if (extension_settings.stt.currentProvider != "None") $("#microphone_button").show();
    saveSettingsDebounced()
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
                    <div id="stt_enabled_div">
                        <label class="checkbox_label" for="stt_enabled">
                            <input type="checkbox" id="stt_enabled" name="stt_enabled">
                            <small>Enabled</small>
                        </label>
                    </div>
                    <div id="stt_message_mode_div">
                        <span>Message mode</span> </br>
                        <select id="stt_message_mode">
                            <option value="append">Append</option>
                            <option value="replace">Replace</option>
                            <option value="auto_send">Auto send</option>
                        </select>
                    </div>
                    <div id="stt_message_mapping_div">
                        <span>Message mapping</span>
                        <textarea id="stt_message_mapping" class="text_pole textarea_compact" type="text" rows="4" placeholder="Enter comma separated phrases mapping, example:\ncommand delete = /del 2,\nslash delete = /del 2,\nsystem roll = /roll 2d6,\nhey continue = /continue"></textarea>
                        <span id="stt_message_mapping_status"></span>
                        <label class="checkbox_label" for="stt_message_mapping_enabled">
                            <input type="checkbox" id="stt_message_mapping_enabled" name="stt_message_mapping_enabled">
                            <small>Enable messages mapping</small>
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
        $('#stt_message_mapping').on('change', onMessageMappingChange);
        $('#stt_message_mapping_enabled').on('click', onMessageMappingEnabledClick);
        
        const $button = $('<div id="microphone_button" class="fa-solid fa-microphone speech-toggle" title="Click to speak"></div>');
        $('#send_but_sheld').prepend($button);

        if (!extension_settings.stt.enabled) $button.hide();
    }
    addExtensionControls(); // No init dependencies
    loadSettings(); // Depends on Extension Controls and loadTtsProvider
    loadSttProvider(extension_settings.stt.currentProvider); // No dependencies
    //const wrapper = new ModuleWorkerWrapper(moduleWorker);
    //setInterval(wrapper.update.bind(wrapper), UPDATE_INTERVAL); // Init depends on all the things
    //moduleWorker();
})
