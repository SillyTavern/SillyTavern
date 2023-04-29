import { callPopup, saveSettingsDebounced } from '../../../script.js'
import { extension_settings, getContext } from '../../extensions.js'
import { getStringHash } from '../../utils.js'
import { ElevenLabsTtsProvider } from './elevenlabs.js'
import { SileroTtsProvider } from './silerotts.js'

const UPDATE_INTERVAL = 1000

let voiceMap = {} // {charName:voiceid, charName2:voiceid2}
let audioControl

let lastCharacterId = null
let lastGroupId = null
let lastChatId = null
let lastMessageHash = null


let ttsProviders = {
    ElevenLabs: ElevenLabsTtsProvider,
    Silero: SileroTtsProvider
}
let ttsProvider
let ttsProviderName

async function moduleWorker() {
    // Primarily determinign when to add new chat to the TTS queue
    const enabled = $('#tts_enabled').is(':checked')
    if (!enabled) {
        return
    }

    const context = getContext()
    const chat = context.chat

    processTtsQueue()
    processAudioJobQueue()
    updateUiAudioPlayState()

    // no characters or group selected
    if (!context.groupId && !context.characterId) {
        return
    }

    // Chat/character/group changed
    if (
        (context.groupId && lastGroupId !== context.groupId) ||
        context.characterId !== lastCharacterId ||
        context.chatId !== lastChatId
    ) {
        currentMessageNumber = context.chat.length ? context.chat.length : 0
        saveLastValues()
        return
    }

    // take the count of messages
    let lastMessageNumber = context.chat.length ? context.chat.length : 0

    // There's no new messages
    let diff = lastMessageNumber - currentMessageNumber
    let hashNew = getStringHash((chat.length && chat[chat.length - 1].mes) ?? '')

    if (diff == 0 && hashNew === lastMessageHash) {
        return
    }

    const message = chat[chat.length - 1]

    // We're currently swiping or streaming. Don't generate voice
    if (
        message.mes === '...' ||
        (context.streamingProcessor && !context.streamingProcessor.isFinished)
    ) {
        return
    }

    // New messages, add new chat to history
    lastMessageHash = hashNew
    currentMessageNumber = lastMessageNumber

    console.debug(
        `Adding message from ${message.name} for TTS processing: "${message.mes}"`
    )
    ttsJobQueue.push(message)
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
    const reader = new FileReader()
    reader.onload = function (e) {
        const srcUrl = e.target.result
        audioElement.src = srcUrl
    }
    reader.readAsDataURL(audioBlob)
    audioElement.addEventListener('ended', completeCurrentAudioJob)
    audioElement.addEventListener('canplay', () => {
        console.debug(`Starting TTS playback`)
        audioElement.play()
    })
}

window['tts_preview'] = function (id) {
    const audio = document.getElementById(id)
    audio.play()
}

async function onTtsVoicesClick() {
    let popupText = ''

    try {
        const voiceIds = await ttsProvider.fetchTtsVoiceIds()

        for (const voice of voiceIds) {
            popupText += `<div class="voice_preview"><b>${voice.name}</b> <i onclick="tts_preview('${voice.voice_id}')" class="fa-solid fa-play"></i></div>`
            popupText += `<audio id="${voice.voice_id}" src="${voice.preview_url}"></audio>`
        }
    } catch {
        popupText = 'Could not load voices list. Check your API key.'
    }

    callPopup(popupText, 'text')
}

function updateUiAudioPlayState() {
    if (extension_settings.tts.enabled == true) {
        audioControl.style.display = 'flex'
        const img = !audioElement.paused
            ? 'fa-solid fa-circle-pause'
            : 'fa-solid fa-circle-play'
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
    audioControl = document.getElementById('tts_media_control')
    updateUiAudioPlayState()
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
    if (!audioData.type in ['audio/mpeg', 'audio/wav']) {
        throw `TTS received HTTP response with invalid data format. Expecting audio/mpeg, got ${audioData.type}`
    }
    audioJobQueue.push(audioData)
    console.debug('Pushed audio job to queue.')
}

async function processAudioJobQueue() {
    // Nothing to do, audio not completed, or audio paused - stop processing.
    if (audioJobQueue.length == 0 || !queueProcessorReady || audioPaused) {
        return
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
    lastGroupId = context.groupId
    lastCharacterId = context.characterId
    lastChatId = context.chatId
    lastMessageHash = getStringHash(
        (context.chat.length && context.chat[context.chat.length - 1].mes) ?? ''
    )
}

async function tts(text, voiceId) {
    const response = await ttsProvider.generateTts(text, voiceId)
    addAudioJob(response)
    completeTtsJob()
}

async function processTtsQueue() {
    // Called each moduleWorker iteration to pull chat messages from queue
    if (currentTtsJob || ttsJobQueue.length <= 0 || audioPaused) {
        return
    }

    console.debug('New message found, running TTS')
    currentTtsJob = ttsJobQueue.shift()
    const text = currentTtsJob.mes.replaceAll('*', '...')
    const char = currentTtsJob.name

    try {
        if (!voiceMap[char]) {
            throw `${char} not in voicemap. Configure character in extension settings voice map`
        }
        const voice = await ttsProvider.getVoice((voiceMap[char]))
        const voiceId = voice.voice_id
        if (voiceId == null) {
            throw `Unable to attain voiceId for ${char}`
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
    const chat = context.chat
    ttsJobQueue = chat
}
window.playFullConversation = playFullConversation

//#############################//
//  Extension UI and Settings  //
//#############################//

function loadSettings() {
    if (Object.keys(extension_settings.tts).length === 0) {
        Object.assign(extension_settings.tts, defaultSettings)
    }
    $('#tts_enabled').prop(
        'checked',
        extension_settings.tts.enabled
    )
}

const defaultSettings = {
    voiceMap: '',
    ttsEnabled: false,
    currentProvider: "ElevenLabs"

}

function setTtsStatus(status, success) {
    $('#tts_status').text(status)
    if (success) {
        $('#tts_status').removeAttr('style')
    } else {
        $('#tts_status').css('color', 'red')
    }
}

function parseVoiceMap(voiceMapString) {
    let parsedVoiceMap = {}
    for (const [charName, voiceId] of voiceMapString
        .split(',')
        .map(s => s.split(':'))) {
        if (charName && voiceId) {
            parsedVoiceMap[charName.trim()] = voiceId.trim()
        }
    }
    return parsedVoiceMap
}

async function voicemapIsValid(parsedVoiceMap) {
    let valid = true
    for (const characterName in parsedVoiceMap) {
        const parsedVoiceName = parsedVoiceMap[characterName]
        try {
            await ttsProvider.getVoice(parsedVoiceName)
        } catch (error) {
            console.error(error)
            valid = false
        }
    }
    return valid
}

async function updateVoiceMap() {
    let isValidResult = false
    const context = getContext()

    const value = $('#tts_voice_map').val()
    const parsedVoiceMap = parseVoiceMap(value)

    isValidResult = await voicemapIsValid(parsedVoiceMap)
    if (isValidResult) {
        ttsProvider.settings.voiceMap = String(value)
        // console.debug(`ttsProvider.voiceMap: ${ttsProvider.settings.voiceMap}`)
        voiceMap = parsedVoiceMap
        console.debug(`Saved new voiceMap: ${value}`)
        saveSettingsDebounced()
    } else {
        throw 'Voice map is invalid, check console for errors'
    }
}

function onApplyClick() {
    Promise.all([
        ttsProvider.onApplyClick(),
        updateVoiceMap()
    ]).catch(error => {
        console.error(error)
        setTtsStatus(error, false)
    })
    
    extension_settings.tts[ttsProviderName] = ttsProvider.settings
    saveSettingsDebounced()
    setTtsStatus('Successfully applied settings', true)
    console.info(`Saved settings ${ttsProviderName} ${JSON.stringify(ttsProvider.settings)}`)
}

function onEnableClick() {
    extension_settings.tts.enabled = $('#tts_enabled').is(
        ':checked'
    )
    updateUiAudioPlayState()
    saveSettingsDebounced()
}


//##############//
// TTS Provider //
//##############//

function loadTtsProvider(provider) {
    //Clear the current config and add new config
    $("#tts_provider_settings").html("")

    if (!provider) {
        provider
    }
    // Init provider references
    extension_settings.tts.currentProvider = provider
    ttsProviderName = provider
    ttsProvider = new ttsProviders[provider]

    // Init provider settings
    $('#tts_provider_settings').append(ttsProvider.settingsHtml)
    if (!(ttsProviderName in extension_settings.tts)) {
        console.warn(`Provider ${ttsProviderName} not in Extension Settings, initiatilizing provider in settings`)
        extension_settings.tts[ttsProviderName] = {}
    }

    // Load voicemap settings
    let voiceMapFromSettings
    if ("voiceMap" in extension_settings.tts[ttsProviderName]) {
        voiceMapFromSettings = extension_settings.tts[ttsProviderName].voiceMap
        voiceMap = parseVoiceMap(voiceMapFromSettings)
    } else {
        voiceMapFromSettings = ""
        voiceMap = {}
    }
    $('#tts_voice_map').val(voiceMapFromSettings)
    $('#tts_provider').val(ttsProviderName)

    ttsProvider.loadSettings(extension_settings.tts[ttsProviderName])
}

function onTtsProviderChange() {
    const ttsProviderSelection = $('#tts_provider').val()
    loadTtsProvider(ttsProviderSelection)
}

function onTtsProviderSettingsInput() {
    ttsProvider.onSettingsChange()

    // Persist changes to SillyTavern tts extension settings
    
    extension_settings.tts[ttsProviderName] = ttsProvider.setttings
    saveSettingsDebounced()
    console.info(`Saved settings ${ttsProviderName} ${JSON.stringify(ttsProvider.settings)}`)
}



$(document).ready(function () {
    function addExtensionControls() {
        const settingsHtml = `
        <div id="tts_settings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>TTS</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <div>
                        <span>Select TTS Provider</span> </br>
                        <select id="tts_provider">
                        </select>
                    </div>
                    <div>
                        <label class="checkbox_label" for="tts_enabled">
                            <input type="checkbox" id="tts_enabled" name="tts_enabled">
                            Enabled
                        </label>
                    </div>
                    <label>Voice Map</label>
                    <textarea id="tts_voice_map" type="text" class="text_pole textarea_compact" rows="4"
                        placeholder="Enter comma separated map of charName:ttsName. Example: \nAqua:Bella,\nYou:Josh,"></textarea>

                    <div id="tts_status">
                    </div>
                    <form id="tts_provider_settings" class="inline-drawer-content">
                    </form>
                    <div class="tts_buttons">
                        <input id="tts_apply" class="menu_button" type="submit" value="Apply" />
                        <input id="tts_voices" class="menu_button" type="submit" value="Available voices" />
                    </div>
                    </div>
                </div>
            </div>
        </div>
        `
        $('#extensions_settings').append(settingsHtml)
        $('#tts_apply').on('click', onApplyClick)
        $('#tts_enabled').on('click', onEnableClick)
        $('#tts_voices').on('click', onTtsVoicesClick)
        $('#tts_provider_settings').on('input', onTtsProviderSettingsInput)
        for (const provider in ttsProviders) {
            $('#tts_provider').append($("<option />").val(provider).text(provider))
        }
        $('#tts_provider').on('change', onTtsProviderChange)
    }
    addExtensionControls() // No init dependencies
    loadSettings() // Depends on Extension Controls and loadTtsProvider
    loadTtsProvider(extension_settings.tts.currentProvider) // No dependencies
    addAudioControl() // Depends on Extension Controls
    setInterval(moduleWorker, UPDATE_INTERVAL) // Init depends on all the things
})
