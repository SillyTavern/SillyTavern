/*
TODO:
 - try pseudo streaming audio by just sending chunk every X seconds and asking VOSK if it is full text.
*/

import { saveSettingsDebounced } from "../../../script.js";
import { getContext, extension_settings, ModuleWorkerWrapper } from "../../extensions.js";
import { VoskSttProvider } from './vosk.js'
import { WhisperSttProvider } from './whisper.js'
import { BrowserSttProvider } from './browser.js'
import { StreamingSttProvider } from './streaming.js'
import { getMessageTimeStamp } from "../../RossAscends-mods.js";
export { MODULE_NAME };

const MODULE_NAME = 'Speech Recognition';
const DEBUG_PREFIX = "<Speech Recognition module> "
const UPDATE_INTERVAL = 100;

let inApiCall = false;

let sttProviders = {
    None: null,
    Browser: BrowserSttProvider,
    Whisper: WhisperSttProvider,
    Vosk: VoskSttProvider,
    Streaming: StreamingSttProvider,
}

let sttProvider = null
let sttProviderName = "None"

let audioRecording = false
const constraints = { audio: { sampleSize: 16, channelCount: 1, sampleRate: 16000 } };
let audioChunks = [];

async function moduleWorker() {
    if (sttProviderName != "Streaming") {
        return;
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
            console.debug(DEBUG_PREFIX+"recorded transcript: \""+userMessageFormatted+"\"");

            let userMessageLower = userMessageFormatted.toLowerCase();
            // remove punctuation
            let userMessageRaw = userMessageLower.replace(/[^\w\s\']|_/g, "").replace(/\s+/g, " ");

            console.debug(DEBUG_PREFIX+"raw transcript:",userMessageRaw);

            // Detect trigger words
            let messageStart = -1;

            if (extension_settings.speech_recognition.Streaming.triggerWordsEnabled) {

                for (const triggerWord of extension_settings.speech_recognition.Streaming.triggerWords) {
                    const triggerPos = userMessageRaw.indexOf(triggerWord.toLowerCase());

                    // Trigger word not found or not starting message and just a substring
                    if (triggerPos == -1){ // | (triggerPos > 0 & userMessageFormatted[triggerPos-1] != " ")) {
                        console.debug(DEBUG_PREFIX+"trigger word not found: ", triggerWord);
                    }
                    else {
                        console.debug(DEBUG_PREFIX+"Found trigger word: ", triggerWord, " at index ", triggerPos);
                        if (triggerPos < messageStart || messageStart == -1) { // & (triggerPos + triggerWord.length) < userMessageFormatted.length)) {
                            messageStart = triggerPos; // + triggerWord.length + 1;

                            if (!extension_settings.speech_recognition.Streaming.triggerWordsIncluded)
                                messageStart = triggerPos + triggerWord.length + 1;
                        }
                    }
                }
            } else {
                messageStart = 0;
            }

            if (messageStart == -1) {
                console.debug(DEBUG_PREFIX+"message ignored, no trigger word preceding a message. Voice transcript: \""+ userMessageOriginal +"\"");
                if (extension_settings.speech_recognition.Streaming.debug) {
                    toastr.info(
                        "No trigger word preceding a message. Voice transcript: \""+ userMessageOriginal +"\"",
                        DEBUG_PREFIX+"message ignored.",
                        { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true },
                    );
                }
            }
            else{
                userMessageFormatted = userMessageFormatted.substring(messageStart);
                // Trim non alphanumeric character from the start
                messageStart = 0;
                for(const i of userMessageFormatted) {
                    if(/^[a-z]$/i.test(i)) {
                        break;
                    }
                    messageStart += 1;
                }
                userMessageFormatted = userMessageFormatted.substring(messageStart);
                userMessageFormatted = userMessageFormatted.charAt(0).toUpperCase() + userMessageFormatted.substring(1);
                processTranscript(userMessageFormatted);
            }
        }
        else
        {
            console.debug(DEBUG_PREFIX+"Received empty transcript, ignored");
        }
    }
    catch (error) {
        console.debug(error);
    }
    finally {
        inApiCall = false;
    }
}

async function processTranscript(transcript) {
    try {
        const transcriptOriginal =  transcript;
        let transcriptFormatted = transcriptOriginal.trim();

        if (transcriptFormatted.length > 0)
        {
            console.debug(DEBUG_PREFIX+"recorded transcript: \""+transcriptFormatted+"\"");
            const messageMode = extension_settings.speech_recognition.messageMode;
            console.debug(DEBUG_PREFIX+"mode: "+messageMode);

            let transcriptLower = transcriptFormatted.toLowerCase()
            // remove punctuation
            let transcriptRaw = transcriptLower.replace(/[^\w\s\']|_/g, "").replace(/\s+/g, " ");

            // Check message mapping
            if (extension_settings.speech_recognition.messageMappingEnabled) {
                console.debug(DEBUG_PREFIX+"Start searching message mapping into:",transcriptRaw)
                for (const key in extension_settings.speech_recognition.messageMapping) {
                    console.debug(DEBUG_PREFIX+"message mapping searching: ", key,"=>",extension_settings.speech_recognition.messageMapping[key]);
                    if (transcriptRaw.includes(key)) {
                        var message = extension_settings.speech_recognition.messageMapping[key];
                        console.debug(DEBUG_PREFIX+"message mapping found: ", key,"=>",extension_settings.speech_recognition.messageMapping[key]);
                        $("#send_textarea").val(message);

                        if (messageMode == "auto_send") await getContext().generate();
                        return;
                    }
                }
            }

            console.debug(DEBUG_PREFIX+"no message mapping found, processing transcript as normal message");

            switch (messageMode) {
                case "auto_send":
                    $('#send_textarea').val("") // clear message area to avoid double message

                    console.debug(DEBUG_PREFIX+"Sending message")
                    const context = getContext();
                    const messageText = transcriptFormatted;
                    const message = {
                        name: context.name1,
                        is_user: true,
                        is_name: true,
                        send_date: getMessageTimeStamp(),
                        mes: messageText,
                    };
                    context.chat.push(message);
                    context.addOneMessage(message);

                    await context.generate();

                    $('#debug_output').text("<SST-module DEBUG>: message sent: \""+ transcriptFormatted +"\"");
                    break;

                case "replace":
                    console.debug(DEBUG_PREFIX+"Replacing message")
                    $('#send_textarea').val(transcriptFormatted);
                    break;

                case "append":
                    console.debug(DEBUG_PREFIX+"Appending message")
                    $('#send_textarea').val($('#send_textarea').val()+" "+transcriptFormatted);
                    break;

                default:
                    console.debug(DEBUG_PREFIX+"Not supported stt message mode: "+messageMode)

            }
        }
        else
        {
            console.debug(DEBUG_PREFIX+"Empty transcript, do nothing");
        }
    }
    catch (error) {
        console.debug(error);
    }
}

function loadNavigatorAudioRecording() {
    if (navigator.mediaDevices.getUserMedia) {
        console.debug(DEBUG_PREFIX+' getUserMedia supported by browser.');

        let onSuccess = function(stream) {
          const mediaRecorder = new MediaRecorder(stream);

          $("#microphone_button").off('click').on("click", function() {
            if (!audioRecording) {
                mediaRecorder.start();
                console.debug(mediaRecorder.state);
                console.debug("recorder started");
                audioRecording = true;
                $("#microphone_button").toggleClass('fa-microphone fa-microphone-slash');
            }
            else {
                mediaRecorder.stop();
                console.debug(mediaRecorder.state);
                console.debug("recorder stopped");
                audioRecording = false;
                $("#microphone_button").toggleClass('fa-microphone fa-microphone-slash');
            }
          });

          mediaRecorder.onstop = async function() {
            console.debug(DEBUG_PREFIX+"data available after MediaRecorder.stop() called: ", audioChunks.length, " chunks");
            const audioBlob = new Blob(audioChunks, { type: "audio/wav; codecs=0" });
            audioChunks = [];

            const transcript = await sttProvider.processAudio(audioBlob);

            // TODO: lock and release recording while processing?
            console.debug(DEBUG_PREFIX+"received transcript:", transcript);
            processTranscript(transcript);
          }

          mediaRecorder.ondataavailable = function(e) {
            audioChunks.push(e.data);
          }
        }

        let onError = function(err) {
          console.debug(DEBUG_PREFIX+"The following error occured: " + err);
        }

        navigator.mediaDevices.getUserMedia(constraints).then(onSuccess, onError);

      } else {
         console.debug(DEBUG_PREFIX+"getUserMedia not supported on your browser!");
         toastr.error("getUserMedia not supported", DEBUG_PREFIX+"not supported for your browser.", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
      }
}

//##############//
// STT Provider //
//##############//

function loadSttProvider(provider) {
    //Clear the current config and add new config
    $("#speech_recognition_provider_settings").html("");

    // Init provider references
    extension_settings.speech_recognition.currentProvider = provider;
    sttProviderName = provider;

    if (!(sttProviderName in extension_settings.speech_recognition)) {
        console.warn(`Provider ${sttProviderName} not in Extension Settings, initiatilizing provider in settings`);
        extension_settings.speech_recognition[sttProviderName] = {};
    }

    $('#speech_recognition_provider').val(sttProviderName);

    if (sttProviderName == "None") {
        $("#microphone_button").hide();
        $("#speech_recognition_message_mode_div").hide();
        $("#speech_recognition_message_mapping_div").hide();
        return;
    }

    $("#speech_recognition_message_mode_div").show();
    $("#speech_recognition_message_mapping_div").show();

    sttProvider = new sttProviders[sttProviderName]

    // Init provider settings
    $('#speech_recognition_provider_settings').append(sttProvider.settingsHtml);

    // Use microphone button as push to talk
    if (sttProviderName == "Browser") {
        sttProvider.processTranscriptFunction = processTranscript;
        sttProvider.loadSettings(extension_settings.speech_recognition[sttProviderName]);
        $("#microphone_button").show();
    }

    if (sttProviderName == "Vosk" | sttProviderName == "Whisper") {
        sttProvider.loadSettings(extension_settings.speech_recognition[sttProviderName]);
        loadNavigatorAudioRecording();
        $("#microphone_button").show();
    }

    if (sttProviderName == "Streaming") {
        sttProvider.loadSettings(extension_settings.speech_recognition[sttProviderName]);
        $("#microphone_button").off('click');
        $("#microphone_button").hide();
    }

}

function onSttProviderChange() {
    const sttProviderSelection = $('#speech_recognition_provider').val();
    loadSttProvider(sttProviderSelection);
    saveSettingsDebounced();
}

function onSttProviderSettingsInput() {
    sttProvider.onSettingsChange();

    // Persist changes to SillyTavern stt extension settings
    extension_settings.speech_recognition[sttProviderName] = sttProvider.settings;
    saveSettingsDebounced();
    console.info(`Saved settings ${sttProviderName} ${JSON.stringify(sttProvider.settings)}`);
}

//#############################//
//  Extension UI and Settings  //
//#############################//

const defaultSettings = {
    currentProvider: "None",
    messageMode: "append",
    messageMappingText: "",
    messageMapping: [],
    messageMappingEnabled: false,
}

function loadSettings() {
    if (Object.keys(extension_settings.speech_recognition).length === 0) {
        Object.assign(extension_settings.speech_recognition, defaultSettings)
    }
    $('#speech_recognition_enabled').prop('checked',extension_settings.speech_recognition.enabled);
    $('#speech_recognition_message_mode').val(extension_settings.speech_recognition.messageMode);

    if (extension_settings.speech_recognition.messageMappingText.length > 0) {
        $('#speech_recognition_message_mapping').val(extension_settings.speech_recognition.messageMappingText);
    }

    $('#speech_recognition_message_mapping_enabled').prop('checked',extension_settings.speech_recognition.messageMappingEnabled);
}

async function onMessageModeChange() {
    extension_settings.speech_recognition.messageMode = $('#speech_recognition_message_mode').val();

    if(sttProviderName != "Browser" & extension_settings.speech_recognition.messageMode == "auto_send") {
        $("#speech_recognition_wait_response_div").show()
    }
    else {
        $("#speech_recognition_wait_response_div").hide()
    }

    saveSettingsDebounced();
}

async function onMessageMappingChange() {
    let array = $('#speech_recognition_message_mapping').val().split(",");
    array = array.map(element => {return element.trim();});
    array = array.filter((str) => str !== '');
    extension_settings.speech_recognition.messageMapping = {};
    for (const text of array) {
        if (text.includes("=")) {
            const pair = text.toLowerCase().split("=")
            extension_settings.speech_recognition.messageMapping[pair[0].trim()] = pair[1].trim()
            console.debug(DEBUG_PREFIX+"Added mapping", pair[0],"=>", extension_settings.speech_recognition.messageMapping[pair[0]]);
        }
        else {
            console.debug(DEBUG_PREFIX+"Wrong syntax for message mapping, no '=' found in:", text);
        }
    }

    $("#speech_recognition_message_mapping_status").text("Message mapping updated to: "+JSON.stringify(extension_settings.speech_recognition.messageMapping))
    console.debug(DEBUG_PREFIX+"Updated message mapping", extension_settings.speech_recognition.messageMapping);
    extension_settings.speech_recognition.messageMappingText = $('#speech_recognition_message_mapping').val()
    saveSettingsDebounced();
}

async function onMessageMappingEnabledClick() {
    extension_settings.speech_recognition.messageMappingEnabled = $('#speech_recognition_message_mapping_enabled').is(':checked');
    saveSettingsDebounced()
}

$(document).ready(function () {
    function addExtensionControls() {
        const settingsHtml = `
        <div id="speech_recognition_settings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>Speech Recognition</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <div>
                        <span>Select Speech-to-text Provider</span> </br>
                        <select id="speech_recognition_provider">
                        </select>
                    </div>
                    <div id="speech_recognition_message_mode_div">
                        <span>Message Mode</span> </br>
                        <select id="speech_recognition_message_mode">
                            <option value="append">Append</option>
                            <option value="replace">Replace</option>
                            <option value="auto_send">Auto send</option>
                        </select>
                    </div>
                    <div id="speech_recognition_message_mapping_div">
                        <span>Message Mapping</span>
                        <textarea id="speech_recognition_message_mapping" class="text_pole textarea_compact" type="text" rows="4" placeholder="Enter comma separated phrases mapping, example:\ncommand delete = /del 2,\nslash delete = /del 2,\nsystem roll = /roll 2d6,\nhey continue = /continue"></textarea>
                        <span id="speech_recognition_message_mapping_status"></span>
                        <label class="checkbox_label" for="speech_recognition_message_mapping_enabled">
                            <input type="checkbox" id="speech_recognition_message_mapping_enabled" name="speech_recognition_message_mapping_enabled">
                            <small>Enable messages mapping</small>
                        </label>
                    </div>
                    <form id="speech_recognition_provider_settings" class="inline-drawer-content">
                    </form>
                </div>
            </div>
        </div>
        `;
        $('#extensions_settings').append(settingsHtml);
        $('#speech_recognition_provider_settings').on('input', onSttProviderSettingsInput);
        for (const provider in sttProviders) {
            $('#speech_recognition_provider').append($("<option />").val(provider).text(provider));
            console.debug(DEBUG_PREFIX+"added option "+provider);
        }
        $('#speech_recognition_provider').on('change', onSttProviderChange);
        $('#speech_recognition_message_mode').on('change', onMessageModeChange);
        $('#speech_recognition_message_mapping').on('change', onMessageMappingChange);
        $('#speech_recognition_message_mapping_enabled').on('click', onMessageMappingEnabledClick);

        const $button = $('<div id="microphone_button" class="fa-solid fa-microphone speech-toggle" title="Click to speak"></div>');
        $('#send_but_sheld').prepend($button);

    }
    addExtensionControls(); // No init dependencies
    loadSettings(); // Depends on Extension Controls and loadTtsProvider
    loadSttProvider(extension_settings.speech_recognition.currentProvider); // No dependencies
    const wrapper = new ModuleWorkerWrapper(moduleWorker);
    setInterval(wrapper.update.bind(wrapper), UPDATE_INTERVAL); // Init depends on all the things
    moduleWorker();
})
