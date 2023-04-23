import { callPopup, saveSettingsDebounced } from '../../../script.js'
import { extension_settings, getContext } from '../../extensions.js'
import { getStringHash } from '../../utils.js'
import { ElevenLabsTtsProvider } from './elevenlabs.js'

const UPDATE_INTERVAL = 1000

let voiceMap = {} // {charName:voiceid, charName2:voiceid2}
let audioControl

let lastCharacterId = null
let lastGroupId = null
let lastChatId = null
let lastMessageHash = null


let ttsProviders = {
    elevenLabs: ElevenLabsTtsProvider
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
    if (audioData.type != 'audio/mpeg') {
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
    const historyId = await ttsProvider.findTtsGenerationInHistory(text, voiceId)

    let response
    if (historyId) {
        console.debug(`Found existing TTS generation with id ${historyId}`)
        response = await ttsProvider.fetchTtsFromHistory(historyId)
    } else {
        console.debug(`No existing TTS generation found, requesting new generation`)
        response = await ttsProvider.fetchTtsGeneration(text, voiceId)
    }
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
    const context = getContext()
    if (!ttsProviderName in extension_settings.tts){
        extension_settings.tts[ttsProviderName] = {}
    }
    if (Object.keys(extension_settings.tts[ttsProviderName]).length === 0) {
        Object.assign(extension_settings.tts[ttsProviderName], defaultSettings)
    }

    $('#tts_api_key').val(
        extension_settings.tts[ttsProviderName].apiKey
    )
    $('#tts_voice_map').val(
        extension_settings.tts[ttsProviderName].voiceMap
    )
    $('#tts_enabled').prop(
        'checked',
        extension_settings.tts.enabled
    )
    ttsProvider.updateSettings(extension_settings.tts[ttsProviderName].settings)
    onApplyClick()
}

const defaultSettings = {
    apiKey: '',
    voiceMap: '',
    ttsEnabled: false
}

function setTtsStatus(status, success) {
    $('#tts_status').text(status)
    if (success) {
        $('#tts_status').removeAttr('style')
    } else {
        $('#tts_status').css('color', 'red')
    }
}

async function updateApiKey() {
    const value = $('#tts_api_key').val()

    // Using this call to validate API key
    ttsProvider.API_KEY = String(value)
    await ttsProvider.fetchTtsVoiceIds().catch(error => {
        ttsProvider.API_KEY = null
        throw `TTS API key invalid`
    })

    extension_settings.tts[ttsProviderName].apiKey = String(value)
    console.debug(`Saved new API_KEY: ${value}`)
    saveSettingsDebounced()
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
    // console.debug("onvoiceMapSubmit");
    const value = $('#tts_voice_map').val()
    const parsedVoiceMap = parseVoiceMap(value)
    isValidResult = await voicemapIsValid(parsedVoiceMap)
    if (isValidResult) {
        extension_settings.tts[ttsProviderName].voiceMap = String(value)
        context.voiceMap = String(value)
        voiceMap = parsedVoiceMap
        console.debug(`Saved new voiceMap: ${value}`)
        saveSettingsDebounced()
    } else {
        throw 'Voice map is invalid, check console for errors'
    }
}

function onApplyClick() {
    Promise.all([updateApiKey(), updateVoiceMap()])
        .then(([result1, result2]) => {
            updateUiAudioPlayState()
            setTtsStatus('Successfully applied settings', true)
        })
        .catch(error => {
            setTtsStatus(error, false)
        })
}

function onEnableClick() {
    extension_settings.tts.enabled = $('#tts_enabled').is(
        ':checked'
    )
    updateUiAudioPlayState()
    saveSettingsDebounced()
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

function addUiTtsProviderConfig() {
    $('#tts_provider_settings').append(ttsProvider.settingsHtml)
    ttsProvider.onSettingsChange()
}

function loadTtsProvider(provider){
    // Set up provider references. No init dependencies
    extension_settings.tts.currentProvider = provider
    ttsProviderName = provider
    ttsProvider = new ttsProviders[provider]
    saveSettingsDebounced()
}

function onTtsProviderSettingsInput(){
    ttsProvider.onSettingsChange()
    extension_settings.tts[ttsProviderName].settings = ttsProvider.settings
    saveSettingsDebounced()
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
                    <label>API Key</label>
                    <input id="tts_api_key" type="text" class="text_pole" placeholder="<API Key>"/>
                    <label>Voice Map</label>
                    <textarea id="tts_voice_map" type="text" class="text_pole textarea_compact" rows="4"
                        placeholder="Enter comma separated map of charName:ttsName. Example: \nAqua:Bella,\nYou:Josh,"></textarea>
                    <div class="tts_buttons">
                        <input id="tts_apply" class="menu_button" type="submit" value="Apply" />
                        <input id="tts_voices" class="menu_button" type="submit" value="Available voices" />
                    </div>
                    <div>
                        <label class="checkbox_label" for="tts_enabled">
                            <input type="checkbox" id="tts_enabled" name="tts_enabled">
                            Enabled
                        </label>
                    </div>
                    <div id="tts_status">
                    </div>
                    
                    <div class="inline-drawer">
                    <div class="inline-drawer-toggle inline-drawer-header">
                        <b>TTS Config</b>
                        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                    </div>
                        <form id="tts_provider_settings" class="inline-drawer-content">
                        </form>
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
    }
    loadTtsProvider("elevenLabs") // No init dependencies
    addExtensionControls() // No init dependencies
    addUiTtsProviderConfig() // Depends on ttsProvider being loaded
    loadSettings() // Depends on Extension Controls and ttsProvider
    addAudioControl() // Depends on Extension Controls
    setInterval(moduleWorker, UPDATE_INTERVAL) // Init depends on all the things
})
