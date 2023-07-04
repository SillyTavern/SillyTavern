import { callPopup, eventSource, event_types, getRequestHeaders, saveSettingsDebounced } from "../../../script.js";
import { dragElement, isMobile } from "../../RossAscends-mods.js";
import { getContext, getApiUrl, modules, extension_settings, ModuleWorkerWrapper, doExtrasFetch } from "../../extensions.js";
import { power_user } from "../../power-user.js";
import { onlyUnique, debounce, getCharaFilename } from "../../utils.js";
import { VoskSttProvider } from './vosk.js'
export { MODULE_NAME };

const MODULE_NAME = 'stt';
const UPDATE_INTERVAL = 2000;

let inApiCall = false;

let sttProviders = {
    Vosk: VoskSttProvider,
}

let sttProvider = new VoskSttProvider
let sttProviderName

async function moduleWorker() {
    const enabled = $('#stt_enabled').is(':checked')
    $('body').toggleClass('stt', enabled);
    if (!enabled) {
        return
    }

    // API is busy
    if (inApiCall) {
        return;
    }

    try {
        inApiCall = true;
        //await sttProvider.enabled(true)
        let user_message = await sttProvider.getUserMessage();

        console.debug("recorded transcript: \""+user_message+"\"")

        if (user_message.length > 0)
        {
            const context = getContext();
            const messageText = user_message;
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
        }
        else
        {
            console.debug("Empty record, do nothing")
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
    enabled: false,
}

function loadSettings() {
    if (Object.keys(extension_settings.stt).length === 0) {
        Object.assign(extension_settings.stt, defaultSettings)
    }
    $('#stt_enabled').prop(
        'checked',
        extension_settings.stt.enabled
    )
    $('body').toggleClass('stt', extension_settings.stt.enabled);
}

/*
function setSttStatus(status, success) {
    $('#stt_status').text(status)
    if (success) {
        $('#stt_status').removeAttr('style')
    } else {
        $('#stt_status').css('color', 'red')
    }
}

async function updateModelPath() {
    let isValidResult = false

    isValidResult = sttProvider.loadModel()
    if (isValidResult) {
        console.debug("STT model loaded")
    } else {
        throw 'STT model loading failed, check console for errors'
    }
}

function onApplyClick() {
    Promise.all([
        sttProvider.onApplyClick(),
        updateModelPath()
    ]).then(() => {
        extension_settings.stt[sttProviderName] = sttProvider.settings
        saveSettingsDebounced()
        setSttStatus('Successfully applied settings', true)
        console.info(`Saved settings ${sttProviderName} ${JSON.stringify(sttProvider.settings)}`)
    }).catch(error => {
        console.error(error)
        setSttStatus(error, false)
    })
}
*/

async function onEnableClick() {
    extension_settings.stt.enabled = $('#stt_enabled').is(
        ':checked'
    )
    saveSettingsDebounced()

    /*
    try {
        sttProvider.enabled(extension_settings.stt.enabled)
    }
    catch (error) {
        console.debug(error);
    }*/
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
                    <div id="stt_status">
                    </div>
                    <form id="stt_provider_settings" class="inline-drawer-content">
                    </form>
                </div>
            </div>
        </div>
        `
        $('#extensions_settings').append(settingsHtml)
        //$('#stt_apply').on('click', onApplyClick)
        $('#stt_enabled').on('click', onEnableClick)
        $('#stt_provider_settings').on('input', onSttProviderSettingsInput)
        for (const provider in sttProviders) {
            $('#stt_provider').append($("<option />").val(provider).text(provider))
            console.log("added option "+provider)
        }
        $('#stt_provider').on('change', onSttProviderChange)
    }
    addExtensionControls() // No init dependencies
    loadSettings() // Depends on Extension Controls and loadTtsProvider
    loadSttProvider(extension_settings.stt.currentProvider) // No dependencies
    const wrapper = new ModuleWorkerWrapper(moduleWorker);
    setInterval(wrapper.update.bind(wrapper), UPDATE_INTERVAL); // Init depends on all the things
    moduleWorker();
})