import { callPopup, eventSource, event_types, getRequestHeaders, saveSettingsDebounced } from "../../../script.js";
import { dragElement, isMobile } from "../../RossAscends-mods.js";
import { getContext, getApiUrl, modules, extension_settings, ModuleWorkerWrapper, doExtrasFetch } from "../../extensions.js";
import { power_user } from "../../power-user.js";
import { onlyUnique, debounce, getCharaFilename } from "../../utils.js";
import { VoskSttProvider } from './vosk.js'
export { MODULE_NAME };

const MODULE_NAME = 'stt';
const UPDATE_INTERVAL = 100;

let inApiCall = false;

let sttProviders = {
    Vosk: VoskSttProvider,
}

let sttProvider = new VoskSttProvider
let sttProviderName

let pushToTalkKeyDown = false

async function moduleWorker() {
    const enabled = extension_settings.stt.enabled
    const record_mode = extension_settings.stt.recordMode
    //const enabled = $('#stt_enabled').is(':checked')
    //$('body').toggleClass('stt', enabled);
    if (!enabled) {
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
        //await sttProvider.enabled(true)
        const userMessageOriginal = await sttProvider.getUserMessage()
        let userMessageFormatted = userMessageOriginal;

        console.debug("<STT-module> recorded transcript: \""+userMessageFormatted+"\"")

        if (userMessageFormatted.length > 0)
        {
            const messageMode = extension_settings.stt.messageMode

            console.debug("<STT-module> mode: "+messageMode)

            // Prevent double message
            const chat_log = getContext().chat
            if (chat_log.length > 0) {
                const last_message = chat_log[chat_log.length-1]
                if (last_message.is_user) {
                    if (extension_settings.stt.debug) {
                        $('#debug_output').text("<SST-module DEBUG>: message ignored, waiting for AI message. Voice transcript: \""+ userMessageFormatted +"\"");
                    }
                    console.debug("<STT-module> Already waiting for response from last message, ignore message.")
                    return;
                }
            }

            switch (messageMode) {
                case "auto_send":

                    // Detect trigger words
                    if (extension_settings.stt.triggerWords.length > 0) {
                        let messageStart = -1

                        for (const triggerWord of extension_settings.stt.triggerWords) {
                            const triggerPos = userMessageFormatted.indexOf(triggerWord);
                            
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
                            if (extension_settings.stt.debug) {
                                $('#debug_output').text("<SST-module DEBUG>: message ignored, no trigger word preceding a message. Voice transcript: \""+ userMessageOriginal +"\"");
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
                    if (extension_settings.stt.debug) {
                        $('#debug_output').text("<SST-module DEBUG>: message sent, cut using trigger word. Voice transcript: \""+ userMessageOriginal +"\"");
                    }
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
        else
        {
            console.debug("<STT-module> Empty record, do nothing");
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

    if (!provider) {
        provider
    }
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
}

function onSttProviderChange() {
    const sttProviderSelection = $('#stt_provider').val()
    loadSttProvider(sttProviderSelection)
}

function onSttProviderSettingsInput() {
    sttProvider.onSettingsChange()

    // Persist changes to SillyTavern stt extension settings

    extension_settings.stt[sttProviderName] = sttProvider.setttings
    saveSettingsDebounced()
    console.info(`Saved settings ${sttProviderName} ${JSON.stringify(sttProvider.settings)}`)
}

//#############################//
//  Extension UI and Settings  //
//#############################//

const defaultSettings = {
    currentProvider: "Vosk",
    enabled: true,
    recordMode: "voice_detection",
    messageMode: "replace",
    pushToTalkKey: null,
    triggerWords: [],
    debug: true,
}

function loadSettings() {
    if (Object.keys(extension_settings.stt).length === 0) {
        Object.assign(extension_settings.stt, defaultSettings)
    }
    $('#stt_enabled').prop('checked',extension_settings.stt.enabled);
    $('body').toggleClass('stt', extension_settings.stt.enabled);
    $('#stt_message_mode').val(extension_settings.stt.messageMode);
    $('#stt_record_mode').val(extension_settings.stt.recordMode);
    $('#stt_debug').prop('checked',extension_settings.stt.debug);

    if (extension_settings.stt.pushToTalkKey != null) {
        $('#stt_push_to_talk_key').val(extension_settings.stt.pushToTalkKey);
    }

    if (extension_settings.stt.triggerWords.length > 0) {
        $('#stt_trigger_words').val(extension_settings.stt.triggerWords);
    }

    if (extension_settings.stt.debug) {
        $('#stt_status').show()
    } else {
        $('#stt_status').hide()
    }
}

async function onEnableClick() {
    extension_settings.stt.enabled = $('#stt_enabled').is(':checked');
    saveSettingsDebounced()
}

async function onRecordModeChange() {
    extension_settings.stt.recordMode = $('#stt_record_mode').val();
    saveSettingsDebounced();
}

async function onMessageModeChange() {
    extension_settings.stt.messageMode = $('#stt_message_mode').val();
    saveSettingsDebounced();
}

async function onPushToTalkKeyChange() {
    extension_settings.stt.pushToTalkKey = $('#stt_push_to_talk_key').val();
    saveSettingsDebounced();
}

async function onTriggerWordsChange() {
    let array = $('#stt_trigger_words').val().split(",");
    array = array.map(element => {return element.trim();});
    array = array.filter((str) => str !== '');
    console.debug("<STT-module> Updated trigger words", array);
    extension_settings.stt.triggerWords = array;
    saveSettingsDebounced();
}

async function onDebugClick() {
    extension_settings.stt.debug = $('#stt_debug').is(':checked');
    if (extension_settings.stt.debug) {
        $('#stt_status').show();
    } else {
        $('#stt_status').hide();
    }
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
                    <div>
                        <span>Record mode</span> </br>
                        <select id="stt_record_mode">
                            <option value="voice_detection">Voice detection</option>
                            <option value="push_to_talk">Push to talk</option>
                        </select>
                    </div>
                    <div>
                        <span>Message mode</span> </br>
                        <select id="stt_message_mode">
                            <option value="append">Append</option>
                            <option value="replace">Replace</option>
                            <option value="auto_send">Auto send</option>
                        </select>
                    </div>
                    <div>
                        <span>Push to talk key</span>
                        <input id="stt_push_to_talk_key" class="text_pole" placeholder="(click here and press key)">
                    </div>
                    <div>
                        <span>Trigger words</span>
                        <textarea id="stt_trigger_words" class="text_pole textarea_compact" type="text" rows="4" placeholder="Enter comma separated words that trigger new message, example:\nhey, hey google, aqua, record, listen"></textarea>
                    </div>
                    <div>
                        <label class="checkbox_label" for="stt_debug">
                            <input type="checkbox" id="stt_debug" name="stt_debug">
                            <small>Debug</small>
                        </label>
                    </div>
                    <div id="stt_status">
                        <span>Debug output:</span><br />
                        <span id="debug_output">None</span>
                    </div>
                    <form id="stt_provider_settings" class="inline-drawer-content">
                    </form>
                </div>
            </div>
        </div>
        `;
        $('#extensions_settings').append(settingsHtml);
        //$('#stt_apply').on('click', onApplyClick);
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


    }
    addExtensionControls(); // No init dependencies
    loadSettings(); // Depends on Extension Controls and loadTtsProvider
    loadSttProvider(extension_settings.stt.currentProvider); // No dependencies
    const wrapper = new ModuleWorkerWrapper(moduleWorker);
    setInterval(wrapper.update.bind(wrapper), UPDATE_INTERVAL); // Init depends on all the things
    moduleWorker();
})