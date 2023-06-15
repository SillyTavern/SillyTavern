import { callPopup, cancelTtsPlay, eventSource, event_types, isMultigenEnabled, is_send_press, saveSettingsDebounced } from '../../../script.js'
import { ModuleWorkerWrapper, extension_settings, getContext } from '../../extensions.js'
import { escapeRegex, getStringHash } from '../../utils.js'
import { EdgeTtsProvider } from './edge.js'
import { ElevenLabsTtsProvider } from './elevenlabs.js'
import { SileroTtsProvider } from './silerotts.js'
import { SystemTtsProvider } from './system.js'
import { NovelTtsProvider } from './novel.js'
import { isMobile } from '../../RossAscends-mods.js'
import { power_user } from '../../power-user.js'

const UPDATE_INTERVAL = 1000

let voiceMap = {} // {charName:voiceid, charName2:voiceid2}
let audioControl

let lastCharacterId = null
let lastGroupId = null
let lastChatId = null
let lastMessageHash = null

export function getPreviewString(lang) {
    const previewStrings = {
        'en-US': 'The quick brown fox jumps over the lazy dog',
        'en-GB': 'Sphinx of black quartz, judge my vow',
        'fr-FR': 'Portez ce vieux whisky au juge blond qui fume',
        'de-DE': 'Victor jagt zwölf Boxkämpfer quer über den großen Sylter Deich',
        'it-IT': "Pranzo d'acqua fa volti sghembi",
        'es-ES': 'Quiere la boca exhausta vid, kiwi, piña y fugaz jamón',
        'es-MX': 'Fabio me exige, sin tapujos, que añada cerveza al whisky',
        'ru-RU': 'В чащах юга жил бы цитрус? Да, но фальшивый экземпляр!',
        'pt-BR': 'Vejo xá gritando que fez show sem playback.',
        'pt-PR': 'Todo pajé vulgar faz boquinha sexy com kiwi.',
        'uk-UA': "Фабрикуймо гідність, лящім їжею, ґав хапаймо, з'єднавці чаш!",
        'pl-PL': 'Pchnąć w tę łódź jeża lub ośm skrzyń fig',
        'cs-CZ': 'Příliš žluťoučký kůň úpěl ďábelské ódy',
        'sk-SK': 'Vyhŕňme si rukávy a vyprážajme čínske ryžové cestoviny',
        'hu-HU': 'Árvíztűrő tükörfúrógép',
        'tr-TR': 'Pijamalı hasta yağız şoföre çabucak güvendi',
        'nl-NL': 'De waard heeft een kalfje en een pinkje opgegeten',
        'sv-SE': 'Yxskaftbud, ge vårbygd, zinkqvarn',
        'da-DK': 'Quizdeltagerne spiste jordbær med fløde, mens cirkusklovnen Walther spillede på xylofon',
        'ja-JP': 'いろはにほへと　ちりぬるを　わかよたれそ　つねならむ　うゐのおくやま　けふこえて　あさきゆめみし　ゑひもせす',
        'ko-KR': '가나다라마바사아자차카타파하',
        'zh-CN': '我能吞下玻璃而不伤身体',
        'ro-RO': 'Muzicologă în bej vând whisky și tequila, preț fix',
        'bg-BG': 'Щъркелите се разпръснаха по цялото небе',
        'el-GR': 'Ταχίστη αλώπηξ βαφής ψημένη γη, δρασκελίζει υπέρ νωθρού κυνός',
        'fi-FI': 'Voi veljet, miksi juuri teille myin nämä vehkeet?',
        'he-IL': 'הקצינים צעקו: "כל הכבוד לצבא הצבאות!"',
        'id-ID': 'Jangkrik itu memang enak, apalagi kalau digoreng',
        'ms-MY': 'Muzik penyanyi wanita itu menggambarkan kehidupan yang penuh dengan duka nestapa',
        'th-TH': 'เป็นไงบ้างครับ ผมชอบกินข้าวผัดกระเพราหมูกรอบ',
        'vi-VN': 'Cô bé quàng khăn đỏ đang ngồi trên bãi cỏ xanh',
        'ar-SA': 'أَبْجَدِيَّة عَرَبِيَّة',
        'hi-IN': 'श्वेता ने श्वेता के श्वेते हाथों में श्वेता का श्वेता चावल पकड़ा',
    }
    const fallbackPreview = 'Neque porro quisquam est qui dolorem ipsum quia dolor sit amet'

    return  previewStrings[lang] ?? fallbackPreview;
}

let ttsProviders = {
    ElevenLabs: ElevenLabsTtsProvider,
    Silero: SileroTtsProvider,
    System: SystemTtsProvider,
    Edge: EdgeTtsProvider,
    Novel: NovelTtsProvider,
}
let ttsProvider
let ttsProviderName

async function onNarrateOneMessage() {
    audioElement.src = '/sounds/silence.mp3';
    const context = getContext();
    const id = $(this).closest('.mes').attr('mesid');
    const message = context.chat[id];

    if (!message) {
        return;
    }

    resetTtsPlayback()
    ttsJobQueue.push(message);
    moduleWorker();
}

async function moduleWorker() {
    // Primarily determining when to add new chat to the TTS queue
    const enabled = $('#tts_enabled').is(':checked')
    $('body').toggleClass('tts', enabled);
    if (!enabled) {
        return
    }

    const context = getContext()
    const chat = context.chat

    processTtsQueue()
    processAudioJobQueue()
    updateUiAudioPlayState()

    // Auto generation is disabled
    if (extension_settings.tts.auto_generation == false) {
        return
    }

    // no characters or group selected
    if (!context.groupId && context.characterId === undefined) {
        return
    }

    // Multigen message is currently being generated
    if (is_send_press && isMultigenEnabled()) {
        return;
    }

    // Chat changed
    if (
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
        !message ||
        message.mes === '...' ||
        message.mes === '' ||
        (context.streamingProcessor && !context.streamingProcessor.isFinished)
    ) {
        return
    }

    // Don't generate if message doesn't have a display text
    if (extension_settings.tts.narrate_translated_only && !(message?.extra?.display_text)) {
        return;
    }

    // New messages, add new chat to history
    lastMessageHash = hashNew
    currentMessageNumber = lastMessageNumber

    console.debug(
        `Adding message from ${message.name} for TTS processing: "${message.mes}"`
    )
    ttsJobQueue.push(message)
}


function resetTtsPlayback() {
    // Stop system TTS utterance
    cancelTtsPlay();

    // Clear currently processing jobs
    currentTtsJob = null;
    currentAudioJob = null;

    // Reset audio element
    audioElement.currentTime = 0;
    audioElement.src = '';

    // Clear any queue items
    ttsJobQueue.splice(0, ttsJobQueue.length);
    audioJobQueue.splice(0, audioJobQueue.length);

    // Set audio ready to process again
    audioQueueProcessorReady = true;
}

function isTtsProcessing() {
    let processing = false

    // Check job queues
    if (ttsJobQueue.length > 0 || audioJobQueue > 0) {
        processing = true
    }
    // Check current jobs
    if (currentTtsJob != null || currentAudioJob != null) {
        processing = true
    }
    return processing
}

function debugTtsPlayback() {
    console.log(JSON.stringify(
        {
            "ttsProviderName": ttsProviderName,
            "currentMessageNumber": currentMessageNumber,
            "isWorkerBusy": isWorkerBusy,
            "audioPaused": audioPaused,
            "audioJobQueue": audioJobQueue,
            "currentAudioJob": currentAudioJob,
            "audioQueueProcessorReady": audioQueueProcessorReady,
            "ttsJobQueue": ttsJobQueue,
            "currentTtsJob": currentTtsJob,
            "ttsConfig": extension_settings.tts
        }
    ))
}
window.debugTtsPlayback = debugTtsPlayback

//##################//
//   Audio Control  //
//##################//

let audioElement = new Audio()
audioElement.autoplay = true

let audioJobQueue = []
let currentAudioJob
let audioPaused = false
let audioQueueProcessorReady = true

let lastAudioPosition = 0

async function playAudioData(audioBlob) {
    // Since current audio job can be cancelled, don't playback if it is null
    if (currentAudioJob == null) {
        console.log("Cancelled TTS playback because currentAudioJob was null")
    }
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

    if (audio && !$(audio).data('disabled')) {
        audio.play()
    }
    else {
        ttsProvider.previewTtsVoice(id)
    }
}

async function onTtsVoicesClick() {
    let popupText = ''

    try {
        const voiceIds = await ttsProvider.fetchTtsVoiceIds()

        for (const voice of voiceIds) {
            popupText += `
            <div class="voice_preview">
                <span class="voice_lang">${voice.lang || ''}</span>
                <b class="voice_name">${voice.name}</b>
                <i onclick="tts_preview('${voice.voice_id}')" class="fa-solid fa-play"></i>
            </div>`
            if (voice.preview_url) {
                popupText += `<audio id="${voice.voice_id}" src="${voice.preview_url}" data-disabled="${voice.preview_url == false}"></audio>`
            }
        }
    } catch {
        popupText = 'Could not load voices list. Check your API key.'
    }

    callPopup(popupText, 'text')
}

function updateUiAudioPlayState() {
    if (extension_settings.tts.enabled == true) {
        $('#ttsExtensionMenuItem').show();
        let img
        // Give user feedback that TTS is active by setting the stop icon if processing or playing
        if (!audioElement.paused || isTtsProcessing()) {
            img = 'fa-solid fa-stop-circle extensionsMenuExtensionButton'
        } else {
            img = 'fa-solid fa-circle-play extensionsMenuExtensionButton'
        }
        $('#tts_media_control').attr('class', img);
    } else {
        $('#ttsExtensionMenuItem').hide();
    }
}

function onAudioControlClicked() {
    audioElement.src = '/sounds/silence.mp3';
    let context = getContext()
    // Not pausing, doing a full stop to anything TTS is doing. Better UX as pause is not as useful
    if (!audioElement.paused || isTtsProcessing()) {
        resetTtsPlayback()
    } else {
        // Default play behavior if not processing or playing is to play the last message.
        ttsJobQueue.push(context.chat[context.chat.length - 1])
    }
    updateUiAudioPlayState()
}

function addAudioControl() {

    $('#extensionsMenu').prepend(`
        <div id="ttsExtensionMenuItem" class="list-group-item flex-container flexGap5">
            <div id="tts_media_control" class="extensionsMenuExtensionButton "/></div>
            TTS Playback
        </div>`)
    $('#ttsExtensionMenuItem').attr('title', 'TTS play/pause').on('click', onAudioControlClicked)
    audioControl = document.getElementById('tts_media_control')
    updateUiAudioPlayState()
}

function completeCurrentAudioJob() {
    audioQueueProcessorReady = true
    currentAudioJob = null
    lastAudioPosition = 0
    // updateUiPlayState();
}

/**
 * Accepts an HTTP response containing audio/mpeg data, and puts the data as a Blob() on the queue for playback
 * @param {*} response
 */
async function addAudioJob(response) {
    const audioData = await response.blob()
    if (!audioData.type in ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/webm']) {
        throw `TTS received HTTP response with invalid data format. Expecting audio/mpeg, got ${audioData.type}`
    }
    audioJobQueue.push(audioData)
    console.debug('Pushed audio job to queue.')
}

async function processAudioJobQueue() {
    // Nothing to do, audio not completed, or audio paused - stop processing.
    if (audioJobQueue.length == 0 || !audioQueueProcessorReady || audioPaused) {
        return
    }
    try {
        audioQueueProcessorReady = false
        currentAudioJob = audioJobQueue.pop()
        playAudioData(currentAudioJob)
    } catch (error) {
        console.error(error)
        audioQueueProcessorReady = true
    }
}

//################//
//  TTS Control   //
//################//

let ttsJobQueue = []
let currentTtsJob // Null if nothing is currently being processed
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
    let text = extension_settings.tts.narrate_translated_only ? currentTtsJob?.extra?.display_text : currentTtsJob.mes
    text = extension_settings.tts.narrate_dialogues_only
        ? text.replace(/\*[^\*]*?(\*|$)/g, '').trim() // remove asterisks content
        : text.replaceAll('*', '').trim() // remove just the asterisks

    if (extension_settings.tts.narrate_quoted_only) {
        const special_quotes = /[“”]/g; // Extend this regex to include other special quotes
        text = text.replace(special_quotes, '"');
        const matches = text.match(/".*?"/g); // Matches text inside double quotes, non-greedily
        const partJoiner = (ttsProvider?.separator || ' ... ');
        text = matches ? matches.join(partJoiner) : text;
    }
    console.log(`TTS: ${text}`)
    const char = currentTtsJob.name

    // Remove character name from start of the line if power user setting is disabled
    if (char && !power_user.allow_name2_display) {
        const escapedChar = escapeRegex(char);
        text = text.replace(new RegExp(`^${escapedChar}:`, 'gm'), '');
    }

    try {
        if (!text) {
            console.warn('Got empty text in TTS queue job.');
            completeTtsJob()
            return;
        }

        if (!voiceMap[char]) {
            throw `${char} not in voicemap. Configure character in extension settings voice map`
        }
        const voice = await ttsProvider.getVoice((voiceMap[char]))
        const voiceId = voice.voice_id
        if (voiceId == null) {
            toastr.error(`Specified voice for ${char} was not found. Check the TTS extension settings.`)
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
    $('#tts_narrate_dialogues').prop('checked', extension_settings.tts.narrate_dialogues_only)
    $('#tts_narrate_quoted').prop('checked', extension_settings.tts.narrate_quoted_only)
    $('#tts_auto_generation').prop('checked', extension_settings.tts.auto_generation)
    $('#tts_narrate_translated_only').prop('checked', extension_settings.tts.narrate_translated_only);
    $('body').toggleClass('tts', extension_settings.tts.enabled);
}

const defaultSettings = {
    voiceMap: '',
    ttsEnabled: false,
    currentProvider: "ElevenLabs",
    auto_generation: true
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
    ]).then(() => {
        extension_settings.tts[ttsProviderName] = ttsProvider.settings
        saveSettingsDebounced()
        setTtsStatus('Successfully applied settings', true)
        console.info(`Saved settings ${ttsProviderName} ${JSON.stringify(ttsProvider.settings)}`)
    }).catch(error => {
        console.error(error)
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

function onAutoGenerationClick() {
    extension_settings.tts.auto_generation = $('#tts_auto_generation').prop('checked');
    saveSettingsDebounced()
}


function onNarrateDialoguesClick() {
    extension_settings.tts.narrate_dialogues_only = $('#tts_narrate_dialogues').prop('checked');
    saveSettingsDebounced()
}


function onNarrateQuotedClick() {
    extension_settings.tts.narrate_quoted_only = $('#tts_narrate_quoted').prop('checked');
    saveSettingsDebounced()
}


function onNarrateTranslatedOnlyClick() {
    extension_settings.tts.narrate_translated_only = $('#tts_narrate_translated_only').prop('checked');
    saveSettingsDebounced();
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
                        <label class="checkbox_label" for="tts_auto_generation">
                            <input type="checkbox" id="tts_auto_generation">
                            Auto Generation
                        </label>
                        <label class="checkbox_label" for="tts_narrate_dialogues">
                            <input type="checkbox" id="tts_narrate_dialogues">
                            Narrate dialogues only
                        </label>
                        <label class="checkbox_label" for="tts_narrate_quoted">
                            <input type="checkbox" id="tts_narrate_quoted">
                            Narrate quoted only
                        </label>
                        <label class="checkbox_label" for="tts_narrate_translated_only">
                            <input type="checkbox" id="tts_narrate_translated_only">
                            Narrate only the translated text
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
        $('#tts_narrate_dialogues').on('click', onNarrateDialoguesClick);
        $('#tts_narrate_quoted').on('click', onNarrateQuotedClick);
        $('#tts_narrate_translated_only').on('click', onNarrateTranslatedOnlyClick);
        $('#tts_auto_generation').on('click', onAutoGenerationClick);
        $('#tts_voices').on('click', onTtsVoicesClick)
        $('#tts_provider_settings').on('input', onTtsProviderSettingsInput)
        for (const provider in ttsProviders) {
            $('#tts_provider').append($("<option />").val(provider).text(provider))
        }
        $('#tts_provider').on('change', onTtsProviderChange)
        $(document).on('click', '.mes_narrate', onNarrateOneMessage);
    }
    addExtensionControls() // No init dependencies
    loadSettings() // Depends on Extension Controls and loadTtsProvider
    loadTtsProvider(extension_settings.tts.currentProvider) // No dependencies
    addAudioControl() // Depends on Extension Controls
    const wrapper = new ModuleWorkerWrapper(moduleWorker);
    setInterval(wrapper.update.bind(wrapper), UPDATE_INTERVAL) // Init depends on all the things
    eventSource.on(event_types.MESSAGE_SWIPED, resetTtsPlayback);
})
