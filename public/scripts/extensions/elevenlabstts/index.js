import { getStringHash, debounce } from "../../utils.js";
import { chat_metadata, saveSettingsDebounced } from "../../../script.js";
import { extension_settings, getContext } from "../../extensions.js";
export { MODULE_NAME };

const saveChatDebounced = debounce(async () => await getContext().saveChat(), 1000);

const MODULE_NAME = '3_elevenlabs_tts'; // <= Deliberate, for sorting lower than memory
const UPDATE_INTERVAL = 1000;
let API_KEY

let ttsJobQueue = []
let currentMessageNumber = 0
let voiceMap = {} // {charName:voiceid, charName2:voiceid2}
let currentTtsJob
let globalVoiceIds = []


//############//
//  TTS Code  //
//############//

function completeTtsJob(){
    console.info(`Current TTS job for ${currentTtsJob.name} completed.`)
    currentTtsJob = null
}

async function playAudioFromResponse(response) {
    const audioContext = new AudioContext();
    const audioBlob = await response.blob()
    if (audioBlob.type != "audio/mpeg"){
        throw `TTS received HTTP response with invalid data format. Expecting audio/mpeg, got ${audioBlob.type}`
    }
    const buffer = await audioContext.decodeAudioData(await audioBlob.arrayBuffer())
     // assuming the audio data is in the 'data' property of the response
    const source = new AudioBufferSourceNode(audioContext);
    source.onended = completeTtsJob
    source.buffer = buffer;
    source.connect(audioContext.destination);
    console.debug(`Starting TTS playback`)
    source.start(0);
}

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
    const v = responseJson.voices.map(voice => voice.voice_id)
    console.info(`Fetched voiceIds: ${v}`)
    return v;
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
        if (message === text) {
            console.info(`Existing TTS history item ${itemId} found: ${text} `)
            return itemId;
        }
    }
    return ''
}

/**
 * Plays text as ElevenLabs TTS using voiceId voice. Will check history for
 * previously generated speech just in case.
 * 
 * @param {*} voiceId 
 * @param {*} text 
 * @returns 
 */
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
    await playAudioFromResponse(response)
}

async function processTtsQueue() {
    if (currentTtsJob || ttsJobQueue.length <= 0) {
        return;
    }

    console.debug("New message found, running TTS")
    currentTtsJob = ttsJobQueue.shift()
    const text = currentTtsJob.mes.replaceAll('*','...'); 
    const char = currentTtsJob.name

    try {
        if (!voiceMap[char]) {
            throw `${char} not in voicemap. Configure character in extension settings voice map`
        }
        const voiceId = voiceMap[char]
        tts(text, voiceId)
    } catch (error) {
        console.error(error)
    }

}

//##################//
//  Extension Code  //
//##################//
const defaultSettings = {
    elevenlabsApiKey: "",
    elevenlabsVoiceMap: "",
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
    //TODO: Add validation for API key
    const context = getContext();
    // console.debug("onElevenlabsApiKeyChange");
    const value = $('#elevenlabs_api_key').val();
    extension_settings.elevenlabstts.elevenlabsApiKey = String(value);
    API_KEY = String(value)
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

async function voicemapIsValid(parsedVoiceMap) {
    let valid = true
    // We're caching the list of voice_ids. This might cause trouble.
    if (globalVoiceIds.length == 0) {
        globalVoiceIds = await fetchTtsVoiceIds()
    }
    for (const charName in parsedVoiceMap) {
        const parsedVoiceMapId = parsedVoiceMap[charName]
        if (!globalVoiceIds.includes(parsedVoiceMapId)) {
            console.error(`Voice of ${charName} with voice_id ${parsedVoiceMapId} is invalid`);
            valid = false
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

function onElevenlabsConnectClick() {
    Promise.all([updateApiKey(), updateVoiceMap()])
        .then(([result1, result2]) => {
            setElevenLabsStatus("Successfully applied settings", true)
        })
        .catch((error) => {
            setElevenLabsStatus(error, false)
        });
}

function loadSettings() {

    if (Object.keys(extension_settings.elevenlabstts).length === 0) {
        Object.assign(extension_settings.elevenlabstts, defaultSettings);
    }

    $('#elevenlabs_api_key').val(extension_settings.elevenlabstts.elevenlabsApiKey);
    $('#elevenlabs_voice_map').val(extension_settings.elevenlabstts.elevenlabsVoiceMap);
    onElevenlabsConnectClick()
}


async function moduleWorker() {
    const context = getContext()
    const chat = context.chat;

    processTtsQueue();

    // no characters or group selected 
    if (!context.groupId && !context.characterId) {
        return;
    }

    // take the count of messages
    let lastMessageNumber = Array.isArray(context.chat) && context.chat.length ? context.chat.length : 0;

    // special case for new chat
    if (Array.isArray(context.chat) && context.chat.length === 1) {
        lastMessageNumber = 1;
    }

    // There's no new messages
    let diff = lastMessageNumber - currentMessageNumber;
    if (diff == 0) {
        return;
    }

    // New messages add to history
    currentMessageNumber = lastMessageNumber;
    const message = chat[chat.length - 1]

    console.debug(`Adding message from ${message.name} for TTS processing: "${message.mes}"`);
    ttsJobQueue.push(message);
}

$(document).ready(function () {
    function addExtensionControls() {
        const settingsHtml = `
        <div id="eleven_labs_settings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <h4>ElevenLabs TTS</h4>
                    <div class="inline-drawer-icon down"></div>
                </div>
                <div class="inline-drawer-content">
                    <label>ElevenLabs TTS Server Config</label>
                    <input id="elevenlabs_api_key" type="text" class="text_pole" placeholder="<API Key>"/>
                    <textarea id="elevenlabs_voice_map" type="text" class="text_pole" 
                        placeholder="Create a mapping of Character to ElevenLabs Voice ID like so \nAqua:nNreVDVt8CWDzqZ55BWZ,\nYou:TxGEqnHWrfWFTfGW9XjX,"></textarea>
                    <input id="elevenlabs_connect" class="menu_button" type="submit" value="Connect" />
                    <div id="elevenlabs_status">
                    </div>
                </div>
            </div>
        </div>
        `;
        $('#extensions_settings').append(settingsHtml);
        $('#elevenlabs_connect').on('click', onElevenlabsConnectClick);
    }

    addExtensionControls();
    loadSettings();
    setInterval(moduleWorker, UPDATE_INTERVAL);
}); 