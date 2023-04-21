import { callPopup, saveSettingsDebounced } from "../../../script.js";
import { extension_settings, getContext } from "../../extensions.js";
import { getStringHash } from "../../utils.js";

const UPDATE_INTERVAL = 1000;
let API_KEY

let voiceMap = {} // {charName:voiceid, charName2:voiceid2}
let elevenlabsTtsVoices = []
let audioControl


let lastCharacterId = null;
let lastGroupId = null;
let lastChatId = null;
let lastMessageHash = null;


async function moduleWorker() {
    // Primarily determinign when to add new chat to the TTS queue
    const enabled = $("#elevenlabs_enabled").is(':checked');
    if (!enabled) {
        return;
    }

    const context = getContext()
    const chat = context.chat;

    processTtsQueue();
    processAudioJobQueue();
    updateUiAudioPlayState();

    // no characters or group selected 
    if (!context.groupId && !context.characterId) {
        return;
    }

    // Chat/character/group changed
    if ((context.groupId && lastGroupId !== context.groupId) || (context.characterId !== lastCharacterId) || (context.chatId !== lastChatId)) {
        currentMessageNumber = context.chat.length ? context.chat.length : 0
        saveLastValues();
        return;
    }

    // take the count of messages
    let lastMessageNumber = context.chat.length ? context.chat.length : 0;

    // There's no new messages
    let diff = lastMessageNumber - currentMessageNumber;
    let hashNew = getStringHash((chat.length && chat[chat.length - 1].mes) ?? '');

    if (diff == 0 && hashNew === lastMessageHash) {
        return;
    }

    const message = chat[chat.length - 1];

    // We're currently swiping or streaming. Don't generate voice
    if (message.mes === '...' || (context.streamingProcessor && !context.streamingProcessor.isFinished)) {
        return;
    }

    // New messages, add new chat to history
    lastMessageHash = hashNew;
    currentMessageNumber = lastMessageNumber;

    console.debug(`Adding message from ${message.name} for TTS processing: "${message.mes}"`);
    ttsJobQueue.push(message);
}


//#################//
//  TTS API Calls  //
//#################//

async function fetchTtsVoiceIds() {
    const headers = {
        'xi-api-key': API_KEY
    };
    const response = await fetch(`https://api.elevenlabs.io/v1/voices`, {
        headers: headers
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.json()}`);
    }
    const responseJson = await response.json();
    return responseJson.voices;
}

async function fetchTtsVoiceSettings() {
    const headers = {
        'xi-api-key': API_KEY
    };
    const response = await fetch(`https://api.elevenlabs.io/v1/voices/settings/default`, {
        headers: headers
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.json()}`);
    }
    return response.json();
}

async function fetchTtsGeneration(text, voiceId) {
    console.info(`Generating new TTS for voice_id ${voiceId}`);
    const response = await fetch(`https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`, {
        method: 'POST',
        headers: {
            'xi-api-key': API_KEY,
            'Content-Type': 'application/json'
        },
        body: JSON.stringify({ text: text })
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.json()}`);
    }
    return response;
}

async function fetchTtsFromHistory(history_item_id) {
    console.info(`Fetched existing TTS with history_item_id ${history_item_id}`);
    const response = await fetch(`https://api.elevenlabs.io/v1/history/${history_item_id}/audio`, {
        headers: {
            'xi-api-key': API_KEY
        }
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.json()}`);
    }
    return response;
}

async function fetchTtsHistory() {
    const headers = {
        'xi-api-key': API_KEY
    };
    const response = await fetch(`https://api.elevenlabs.io/v1/history`, {
        headers: headers
    });
    if (!response.ok) {
        throw new Error(`HTTP ${response.status}: ${await response.json()}`);
    }
    const responseJson = await response.json();
    return responseJson.history;
}


async function findTtsGenerationInHistory(message, voiceId) {
    const ttsHistory = await fetchTtsHistory();
    for (const history of ttsHistory) {
        const text = history.text;
        const itemId = history.history_item_id;
        if (message === text && history.voice_id == voiceId) {
            console.info(`Existing TTS history item ${itemId} found: ${text} `)
            return itemId;
        }
    }
    return ''
}

//##################//
//   Audio Control  //
//##################//

let audioElement = new Audio()

let audioJobQueue = []
let currentAudioJob
let audioPaused = false
let queueProcessorReady = true

let lastAudioPosition = 0


async function playAudioData(audioBlob) {
    const reader = new FileReader();
    reader.onload = function (e) {
        const srcUrl = e.target.result;
        audioElement.src = srcUrl;
    };
    reader.readAsDataURL(audioBlob);
    audioElement.addEventListener('ended', completeCurrentAudioJob)
    audioElement.addEventListener('canplay', () => {
        console.debug(`Starting TTS playback`)
        audioElement.play()
    })
}

window['elevenlabsPreview'] = function(id) {
    const audio = document.getElementById(id);
    audio.play();
}

async function onElevenlabsVoicesClick() {
    let popupText = '';

    try {
        const voiceIds = await fetchTtsVoiceIds();

        for (const voice of voiceIds) {
            popupText += `<div class="voice_preview"><b>${voice.name}</b> <i onclick="elevenlabsPreview('${voice.voice_id}')" class="fa-solid fa-play"></i></div>`;
            popupText += `<audio id="${voice.voice_id}" src="${voice.preview_url}"></audio>`;
        }
    }
    catch {
        popupText = 'Could not load voices list. Check your API key.'
    }


    callPopup(popupText, 'text');
}

function completeCurrentAudioJob() {
    queueProcessorReady = true
    lastAudioPosition = 0
    // updateUiPlayState();
}

/**
 * Accepts an HTTP response containing audio/mpeg data, and puts the data as a Blob() on the queue for playback
 * @param {*} response 
 */
async function addAudioJob(response) {
    const audioData = await response.blob()
    if (audioData.type != "audio/mpeg") {
        throw `TTS received HTTP response with invalid data format. Expecting audio/mpeg, got ${audioData.type}`
    }
    audioJobQueue.push(audioData)
    console.debug("Pushed audio job to queue.")
}

async function processAudioJobQueue() {
    // Nothing to do, audio not completed, or audio paused - stop processing.
    if (audioJobQueue.length == 0 || !queueProcessorReady || audioPaused) {
        return;
    }
    try {
        queueProcessorReady = false
        currentAudioJob = audioJobQueue.pop()
        playAudioData(currentAudioJob)
    } catch (error) {
        console.error(error)
        queueProcessorReady = true
    }
}


//################//
//  TTS Control   //
//################//

let ttsJobQueue = []
let currentTtsJob
let currentMessageNumber = 0

function completeTtsJob() {
    console.info(`Current TTS job for ${currentTtsJob.name} completed.`)
    currentTtsJob = null
}

function saveLastValues() {
    const context = getContext()
    lastGroupId = context.groupId;
    lastCharacterId = context.characterId;
    lastChatId = context.chatId;
    lastMessageHash = getStringHash((context.chat.length && context.chat[context.chat.length - 1].mes) ?? '');
}

async function tts(text, voiceId) {
    const historyId = await findTtsGenerationInHistory(text, voiceId);

    let response;
    if (historyId) {
        console.debug(`Found existing TTS generation with id ${historyId}`)
        response = await fetchTtsFromHistory(historyId);
    } else {
        console.debug(`No existing TTS generation found, requesting new generation`)
        response = await fetchTtsGeneration(text, voiceId);
    }
    addAudioJob(response)
    completeTtsJob()
}

async function processTtsQueue() {
    // Called each moduleWorker iteration to pull chat messages from queue
    if (currentTtsJob || ttsJobQueue.length <= 0 || audioPaused) {
        return;
    }

    console.debug("New message found, running TTS")
    currentTtsJob = ttsJobQueue.shift()
    const text = currentTtsJob.mes.replaceAll('*', '...');
    const char = currentTtsJob.name

    try {
        if (!voiceMap[char]) {
            throw `${char} not in voicemap. Configure character in extension settings voice map`
        }
        const voice = await getTtsVoice(voiceMap[char])
        const voiceId = voice.voice_id
        if (voiceId == null) {
            throw (`Unable to attain voiceId for ${char}`)
        }
        tts(text, voiceId)
    } catch (error) {
        console.error(error)
        currentTtsJob = null
    }

}

// Secret function for now
async function playFullConversation() {
    const context = getContext()
    const chat = context.chat;
    ttsJobQueue = chat
}
window.playFullConversation = playFullConversation

//#############################//
//  Extension UI and Settings  //
//#############################//

function loadSettings() {
    const context = getContext()
    if (Object.keys(extension_settings.elevenlabstts).length === 0) {
        Object.assign(extension_settings.elevenlabstts, defaultSettings);
    }

    $('#elevenlabs_api_key').val(extension_settings.elevenlabstts.elevenlabsApiKey);
    $('#elevenlabs_voice_map').val(extension_settings.elevenlabstts.elevenlabsVoiceMap);
    $('#elevenlabs_enabled').prop('checked', extension_settings.elevenlabstts.enabled);
    onElevenlabsApplyClick()
}

const defaultSettings = {
    elevenlabsApiKey: "",
    elevenlabsVoiceMap: "",
    elevenlabsEnabed: false
};


function setElevenLabsStatus(status, success) {
    $('#elevenlabs_status').text(status)
    if (success) {
        $("#elevenlabs_status").removeAttr("style");
    } else {
        $('#elevenlabs_status').css('color', 'red');
    }
}

async function updateApiKey() {
    const context = getContext();
    const value = $('#elevenlabs_api_key').val();

    // Using this call to validate API key
    API_KEY = String(value)
    await fetchTtsVoiceIds().catch((error => {
        API_KEY = null
        throw `ElevenLabs TTS API key invalid`
    }))

    extension_settings.elevenlabstts.elevenlabsApiKey = String(value);
    console.debug(`Saved new API_KEY: ${value}`);
    saveSettingsDebounced();
}

function parseVoiceMap(voiceMapString) {
    let parsedVoiceMap = {}
    for (const [charName, voiceId] of voiceMapString.split(",").map(s => s.split(":"))) {
        if (charName && voiceId) {
            parsedVoiceMap[charName.trim()] = voiceId.trim();
        }
    }
    return parsedVoiceMap
}

async function getTtsVoice(name) {
    // We're caching the list of voice_ids. This might cause trouble if the user creates a new voice without restarting
    if (elevenlabsTtsVoices.length == 0) {
        elevenlabsTtsVoices = await fetchTtsVoiceIds();
    }
    const match = elevenlabsTtsVoices.filter((elevenVoice) => elevenVoice.name == name)[0];
    if (!match) {
        throw `TTS Voice name ${name} not found in ElevenLabs account`;
    }
    return match;
}

async function voicemapIsValid(parsedVoiceMap) {
    let valid = true
    for (const characterName in parsedVoiceMap) {
        const parsedVoiceName = parsedVoiceMap[characterName];
        try {
            await getTtsVoice(parsedVoiceName);
        } catch (error) {
            console.error(error)
            valid = false;
        }
    }
    return valid
}

async function updateVoiceMap() {
    let isValidResult = false
    const context = getContext();
    // console.debug("onElevenlabsVoiceMapSubmit");
    const value = $('#elevenlabs_voice_map').val();
    const parsedVoiceMap = parseVoiceMap(value);
    isValidResult = await voicemapIsValid(parsedVoiceMap);
    if (isValidResult) {
        extension_settings.elevenlabstts.elevenlabsVoiceMap = String(value);
        context.elevenlabsVoiceMap = String(value)
        voiceMap = parsedVoiceMap
        console.debug(`Saved new voiceMap: ${value}`)
        saveSettingsDebounced();
    } else {
        throw "Voice map is invalid, check console for errors"
    }
}

function onElevenlabsApplyClick() {
    Promise.all([updateApiKey(), updateVoiceMap()])
        .then(([result1, result2]) => {
            updateUiAudioPlayState()
            setElevenLabsStatus("Successfully applied settings", true)
        })
        .catch((error) => {
            setElevenLabsStatus(error, false)
        });
}

function onElevenlabsEnableClick() {
    extension_settings.elevenlabstts.enabled = $("#elevenlabs_enabled").is(':checked');
    updateUiAudioPlayState()
    saveSettingsDebounced();
}

function updateUiAudioPlayState() {
    if (extension_settings.elevenlabstts.enabled == true) {
        audioControl.style.display = 'flex'
        const img = !audioElement.paused ? "fa-solid fa-circle-pause" : "fa-solid fa-circle-play"
        audioControl.className = img
    } else {
        audioControl.style.display = 'none'
    }
}

function onAudioControlClicked() {
    audioElement.paused ? audioElement.play() : audioElement.pause()
    updateUiAudioPlayState()
}

function addAudioControl() {
    $('#send_but_sheld').prepend('<div id="tts_media_control"/>')
    $('#send_but_sheld').on('click', onAudioControlClicked)
    audioControl = document.getElementById('tts_media_control');
    updateUiAudioPlayState();
}

$(document).ready(function () {
    function addExtensionControls() {
        const settingsHtml = `
        <div id="eleven_labs_settings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>ElevenLabs TTS</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <label>API Key</label>
                    <input id="elevenlabs_api_key" type="text" class="text_pole" placeholder="<API Key>"/>
                    <label>Voice Map</label>
                    <textarea id="elevenlabs_voice_map" type="text" class="text_pole textarea_compact" rows="4"
                        placeholder="Enter comma separated map of charName:ttsName. Example: \nAqua:Bella,\nYou:Josh,"></textarea>
                    <div class="elevenlabs_buttons">
                        <input id="elevenlabs_apply" class="menu_button" type="submit" value="Apply" />
                        <input id="elevenlabs_voices" class="menu_button" type="submit" value="Available voices" />
                    </div>
                    <div>
                        <label class="checkbox_label" for="elevenlabs_enabled">
                            <input type="checkbox" id="elevenlabs_enabled" name="elevenlabs_enabled">
                            Enabled
                        </label>
                    </div>
                    <div id="elevenlabs_status">
                    </div>
                </div>
            </div>
        </div>
        `;
        $('#extensions_settings').append(settingsHtml);
        $('#elevenlabs_apply').on('click', onElevenlabsApplyClick);
        $('#elevenlabs_enabled').on('click', onElevenlabsEnableClick);
        $('#elevenlabs_voices').on('click', onElevenlabsVoicesClick);
    }
    addAudioControl();
    addExtensionControls();
    loadSettings();
    setInterval(moduleWorker, UPDATE_INTERVAL);
}); 