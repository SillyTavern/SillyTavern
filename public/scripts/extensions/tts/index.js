import { cancelTtsPlay, eventSource, event_types, getCurrentChatId, isStreamingEnabled, name2, saveSettingsDebounced, substituteParams } from '../../../script.js';
import { ModuleWorkerWrapper, doExtrasFetch, extension_settings, getApiUrl, getContext, modules, renderExtensionTemplateAsync } from '../../extensions.js';
import { delay, escapeRegex, getBase64Async, getStringHash, onlyUnique } from '../../utils.js';
import { EdgeTtsProvider } from './edge.js';
import { ElevenLabsTtsProvider } from './elevenlabs.js';
import { SileroTtsProvider } from './silerotts.js';
import { CoquiTtsProvider } from './coqui.js';
import { SystemTtsProvider } from './system.js';
import { NovelTtsProvider } from './novel.js';
import { power_user } from '../../power-user.js';
import { OpenAITtsProvider } from './openai.js';
import { OpenAICompatibleTtsProvider } from './openai-compatible.js';
import { XTTSTtsProvider } from './xtts.js';
import { VITSTtsProvider } from './vits.js';
import { GSVITtsProvider } from './gsvi.js';
import { SBVits2TtsProvider } from './sbvits2.js';
import { AllTalkTtsProvider } from './alltalk.js';
import { SpeechT5TtsProvider } from './speecht5.js';
import { AzureTtsProvider } from './azure.js';
import { SlashCommandParser } from '../../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from '../../slash-commands/SlashCommandArgument.js';
import { debounce_timeout } from '../../constants.js';
import { SlashCommandEnumValue, enumTypes } from '../../slash-commands/SlashCommandEnumValue.js';
import { enumIcons } from '../../slash-commands/SlashCommandCommonEnumsProvider.js';
import { POPUP_TYPE, callGenericPopup } from '../../popup.js';
export { talkingAnimation };

const UPDATE_INTERVAL = 1000;

let voiceMapEntries = [];
let voiceMap = {}; // {charName:voiceid, charName2:voiceid2}
let talkingHeadState = false;
let lastChatId = null;
let lastMessage = null;
let lastMessageHash = null;
let periodicMessageGenerationTimer = null;
let lastPositionOfParagraphEnd = -1;
let currentInitVoiceMapPromise = null;

const DEFAULT_VOICE_MARKER = '[Default Voice]';
const DISABLED_VOICE_MARKER = 'disabled';

export function getPreviewString(lang) {
    const previewStrings = {
        'en-US': 'The quick brown fox jumps over the lazy dog',
        'en-GB': 'Sphinx of black quartz, judge my vow',
        'fr-FR': 'Portez ce vieux whisky au juge blond qui fume',
        'de-DE': 'Victor jagt zwölf Boxkämpfer quer über den großen Sylter Deich',
        'it-IT': 'Pranzo d\'acqua fa volti sghembi',
        'es-ES': 'Quiere la boca exhausta vid, kiwi, piña y fugaz jamón',
        'es-MX': 'Fabio me exige, sin tapujos, que añada cerveza al whisky',
        'ru-RU': 'В чащах юга жил бы цитрус? Да, но фальшивый экземпляр!',
        'pt-BR': 'Vejo xá gritando que fez show sem playback.',
        'pt-PR': 'Todo pajé vulgar faz boquinha sexy com kiwi.',
        'uk-UA': 'Фабрикуймо гідність, лящім їжею, ґав хапаймо, з\'єднавці чаш!',
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
    };
    const fallbackPreview = 'Neque porro quisquam est qui dolorem ipsum quia dolor sit amet';

    return previewStrings[lang] ?? fallbackPreview;
}

const ttsProviders = {
    AllTalk: AllTalkTtsProvider,
    Azure: AzureTtsProvider,
    Coqui: CoquiTtsProvider,
    Edge: EdgeTtsProvider,
    ElevenLabs: ElevenLabsTtsProvider,
    GSVI: GSVITtsProvider,
    Novel: NovelTtsProvider,
    OpenAI: OpenAITtsProvider,
    'OpenAI Compatible': OpenAICompatibleTtsProvider,
    SBVits2: SBVits2TtsProvider,
    Silero: SileroTtsProvider,
    SpeechT5: SpeechT5TtsProvider,
    System: SystemTtsProvider,
    VITS: VITSTtsProvider,
    XTTSv2: XTTSTtsProvider,
};
let ttsProvider;
let ttsProviderName;


async function onNarrateOneMessage() {
    audioElement.src = '/sounds/silence.mp3';
    const context = getContext();
    const id = $(this).closest('.mes').attr('mesid');
    const message = context.chat[id];

    if (!message) {
        return;
    }

    resetTtsPlayback();
    ttsJobQueue.push(message);
    moduleWorker();
}

async function onNarrateText(args, text) {
    if (!text) {
        return '';
    }

    audioElement.src = '/sounds/silence.mp3';

    // To load all characters in the voice map, set unrestricted to true
    await initVoiceMap(true);

    const baseName = args?.voice || name2;
    const name = (baseName === 'SillyTavern System' ? DEFAULT_VOICE_MARKER : baseName) || DEFAULT_VOICE_MARKER;

    const voiceMapEntry = voiceMap[name] === DEFAULT_VOICE_MARKER
        ? voiceMap[DEFAULT_VOICE_MARKER]
        : voiceMap[name];

    if (!voiceMapEntry || voiceMapEntry === DISABLED_VOICE_MARKER) {
        toastr.info(`Specified voice for ${name} was not found. Check the TTS extension settings.`);
        return;
    }

    resetTtsPlayback();
    ttsJobQueue.push({ mes: text, name: name });
    await moduleWorker();

    // Return back to the chat voices
    await initVoiceMap(false);
    return '';
}

async function moduleWorker() {
    if (!extension_settings.tts.enabled) {
        return;
    }

    processTtsQueue();
    processAudioJobQueue();
    updateUiAudioPlayState();
}

function talkingAnimation(switchValue) {
    if (!modules.includes('talkinghead')) {
        console.debug('Talking Animation module not loaded');
        return;
    }

    const apiUrl = getApiUrl();
    const animationType = switchValue ? 'start' : 'stop';

    if (switchValue !== talkingHeadState) {
        try {
            console.log(animationType + ' Talking Animation');
            doExtrasFetch(`${apiUrl}/api/talkinghead/${animationType}_talking`);
            talkingHeadState = switchValue;
        } catch (error) {
            // Handle the error here or simply ignore it to prevent logging
        }
    }
    updateUiAudioPlayState();
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
    let processing = false;

    // Check job queues
    if (ttsJobQueue.length > 0 || audioJobQueue.length > 0) {
        processing = true;
    }
    // Check current jobs
    if (currentTtsJob != null || currentAudioJob != null) {
        processing = true;
    }
    return processing;
}

function debugTtsPlayback() {
    console.log(JSON.stringify(
        {
            'ttsProviderName': ttsProviderName,
            'voiceMap': voiceMap,
            'audioPaused': audioPaused,
            'audioJobQueue': audioJobQueue,
            'currentAudioJob': currentAudioJob,
            'audioQueueProcessorReady': audioQueueProcessorReady,
            'ttsJobQueue': ttsJobQueue,
            'currentTtsJob': currentTtsJob,
            'ttsConfig': extension_settings.tts,
        },
    ));
}
window['debugTtsPlayback'] = debugTtsPlayback;

//##################//
//   Audio Control  //
//##################//

let audioElement = new Audio();
audioElement.id = 'tts_audio';
audioElement.autoplay = true;

/**
 * @type AudioJob[] Audio job queue
 * @typedef {{audioBlob: Blob | string, char: string}} AudioJob Audio job object
 */
let audioJobQueue = [];
/**
 * @type AudioJob Current audio job
 */
let currentAudioJob;
let audioPaused = false;
let audioQueueProcessorReady = true;

/**
 * Play audio data from audio job object.
 * @param {AudioJob} audioJob Audio job object
 * @returns {Promise<void>} Promise that resolves when audio playback is started
 */
async function playAudioData(audioJob) {
    const { audioBlob, char } = audioJob;
    // Since current audio job can be cancelled, don't playback if it is null
    if (currentAudioJob == null) {
        console.log('Cancelled TTS playback because currentAudioJob was null');
    }
    if (audioBlob instanceof Blob) {
        const srcUrl = await getBase64Async(audioBlob);

        // VRM lip sync
        if (extension_settings.vrm?.enabled && typeof window['vrmLipSync'] === 'function') {
            await window['vrmLipSync'](audioBlob, char);
        }

        audioElement.src = srcUrl;
    } else if (typeof audioBlob === 'string') {
        audioElement.src = audioBlob;
    } else {
        throw `TTS received invalid audio data type ${typeof audioBlob}`;
    }
    audioElement.addEventListener('ended', completeCurrentAudioJob);
    audioElement.addEventListener('canplay', () => {
        console.debug('Starting TTS playback');
        audioElement.playbackRate = extension_settings.tts.playback_rate;
        audioElement.play();
    });
}

window['tts_preview'] = function (id) {
    const audio = document.getElementById(id);

    if (audio instanceof HTMLAudioElement && !$(audio).data('disabled')) {
        audio.play();
    }
    else {
        ttsProvider.previewTtsVoice(id);
    }
};

async function onTtsVoicesClick() {
    let popupText = '';

    try {
        const voiceIds = await ttsProvider.fetchTtsVoiceObjects();

        for (const voice of voiceIds) {
            popupText += `
            <div class="voice_preview">
                <span class="voice_lang">${voice.lang || ''}</span>
                <b class="voice_name">${voice.name}</b>
                <i onclick="tts_preview('${voice.voice_id}')" class="fa-solid fa-play"></i>
            </div>`;
            if (voice.preview_url) {
                popupText += `<audio id="${voice.voice_id}" src="${voice.preview_url}" data-disabled="${voice.preview_url == false}"></audio>`;
            }
        }
    } catch {
        popupText = 'Could not load voices list. Check your API key.';
    }

    callGenericPopup(popupText, POPUP_TYPE.TEXT, '', { allowVerticalScrolling: true });
}

function updateUiAudioPlayState() {
    if (extension_settings.tts.enabled == true) {
        $('#ttsExtensionMenuItem').show();
        let img;
        // Give user feedback that TTS is active by setting the stop icon if processing or playing
        if (!audioElement.paused || isTtsProcessing()) {
            img = 'fa-solid fa-stop-circle extensionsMenuExtensionButton';
        } else {
            img = 'fa-solid fa-circle-play extensionsMenuExtensionButton';
        }
        $('#tts_media_control').attr('class', img);
    } else {
        $('#ttsExtensionMenuItem').hide();
    }
}

function onAudioControlClicked() {
    audioElement.src = '/sounds/silence.mp3';
    let context = getContext();
    // Not pausing, doing a full stop to anything TTS is doing. Better UX as pause is not as useful
    if (!audioElement.paused || isTtsProcessing()) {
        resetTtsPlayback();
        talkingAnimation(false);
    } else {
        // Default play behavior if not processing or playing is to play the last message.
        ttsJobQueue.push(context.chat[context.chat.length - 1]);
    }
    updateUiAudioPlayState();
}

function addAudioControl() {
    $('#tts_wand_container').append(`
        <div id="ttsExtensionMenuItem" class="list-group-item flex-container flexGap5">
            <div id="tts_media_control" class="extensionsMenuExtensionButton "/></div>
            TTS Playback
        </div>`);
    $('#tts_wand_container').append(`
        <div id="ttsExtensionNarrateAll" class="list-group-item flex-container flexGap5">
            <div class="extensionsMenuExtensionButton fa-solid fa-radio"></div>
            Narrate All Chat
        </div>`);
    $('#ttsExtensionMenuItem').attr('title', 'TTS play/pause').on('click', onAudioControlClicked);
    $('#ttsExtensionNarrateAll').attr('title', 'Narrate all messages in the current chat. Includes user messages, excludes hidden comments.').on('click', playFullConversation);
    updateUiAudioPlayState();
}

function completeCurrentAudioJob() {
    audioQueueProcessorReady = true;
    currentAudioJob = null;
    talkingAnimation(false); //stop lip animation
    // updateUiPlayState();
}

/**
 * Accepts an HTTP response containing audio/mpeg data, and puts the data as a Blob() on the queue for playback
 * @param {Response} response
 */
async function addAudioJob(response, char) {
    if (typeof response === 'string') {
        audioJobQueue.push({ audioBlob: response, char: char });
    } else {
        const audioData = await response.blob();
        if (!audioData.type.startsWith('audio/')) {
            throw `TTS received HTTP response with invalid data format. Expecting audio/*, got ${audioData.type}`;
        }
        audioJobQueue.push({ audioBlob: audioData, char: char });
    }
    console.debug('Pushed audio job to queue.');
}

async function processAudioJobQueue() {
    // Nothing to do, audio not completed, or audio paused - stop processing.
    if (audioJobQueue.length == 0 || !audioQueueProcessorReady || audioPaused) {
        return;
    }
    try {
        audioQueueProcessorReady = false;
        currentAudioJob = audioJobQueue.shift();
        playAudioData(currentAudioJob);
        talkingAnimation(true);
    } catch (error) {
        toastr.error(error.toString());
        console.error(error);
        audioQueueProcessorReady = true;
    }
}

//################//
//  TTS Control   //
//################//

let ttsJobQueue = [];
let currentTtsJob; // Null if nothing is currently being processed

function completeTtsJob() {
    console.info(`Current TTS job for ${currentTtsJob?.name} completed.`);
    currentTtsJob = null;
}

async function tts(text, voiceId, char) {
    async function processResponse(response) {
        // RVC injection
        if (typeof window['rvcVoiceConversion'] === 'function' && extension_settings.rvc.enabled)
            response = await window['rvcVoiceConversion'](response, char, text);

        await addAudioJob(response, char);
    }

    let response = await ttsProvider.generateTts(text, voiceId);

    // If async generator, process every chunk as it comes in
    if (typeof response[Symbol.asyncIterator] === 'function') {
        for await (const chunk of response) {
            await processResponse(chunk);
        }
    } else {
        await processResponse(response);
    }

    completeTtsJob();
}

async function processTtsQueue() {
    // Called each moduleWorker iteration to pull chat messages from queue
    if (currentTtsJob || ttsJobQueue.length <= 0 || audioPaused) {
        return;
    }

    console.debug('New message found, running TTS');
    currentTtsJob = ttsJobQueue.shift();
    let text = extension_settings.tts.narrate_translated_only ? (currentTtsJob?.extra?.display_text || currentTtsJob.mes) : currentTtsJob.mes;

    // Substitute macros
    text = substituteParams(text);

    if (extension_settings.tts.skip_codeblocks) {
        text = text.replace(/^\s{4}.*$/gm, '').trim();
        text = text.replace(/```.*?```/gs, '').trim();
    }

    if (extension_settings.tts.skip_tags) {
        text = text.replace(/<.*?>.*?<\/.*?>/g, '').trim();
    }

    if (!extension_settings.tts.pass_asterisks) {
        text = extension_settings.tts.narrate_dialogues_only
            ? text.replace(/\*[^*]*?(\*|$)/g, '').trim() // remove asterisks content
            : text.replaceAll('*', '').trim(); // remove just the asterisks
    }

    if (extension_settings.tts.narrate_quoted_only) {
        const special_quotes = /[“”«»]/g; // Extend this regex to include other special quotes
        text = text.replace(special_quotes, '"');
        const matches = text.match(/".*?"/g); // Matches text inside double quotes, non-greedily
        const partJoiner = (ttsProvider?.separator || ' ... ');
        text = matches ? matches.join(partJoiner) : text;
    }

    if (typeof ttsProvider?.processText === 'function') {
        text = await ttsProvider.processText(text);
    }

    // Collapse newlines and spaces into single space
    text = text.replace(/\s+/g, ' ').trim();

    console.log(`TTS: ${text}`);
    const char = currentTtsJob.name;

    // Remove character name from start of the line if power user setting is disabled
    if (char && !power_user.allow_name2_display) {
        const escapedChar = escapeRegex(char);
        text = text.replace(new RegExp(`^${escapedChar}:`, 'gm'), '');
    }

    try {
        if (!text) {
            console.warn('Got empty text in TTS queue job.');
            completeTtsJob();
            return;
        }

        const voiceMapEntry = voiceMap[char] === DEFAULT_VOICE_MARKER ? voiceMap[DEFAULT_VOICE_MARKER] : voiceMap[char];

        if (!voiceMapEntry || voiceMapEntry === DISABLED_VOICE_MARKER) {
            throw `${char} not in voicemap. Configure character in extension settings voice map`;
        }
        const voice = await ttsProvider.getVoice(voiceMapEntry);
        const voiceId = voice.voice_id;
        if (voiceId == null) {
            toastr.error(`Specified voice for ${char} was not found. Check the TTS extension settings.`);
            throw `Unable to attain voiceId for ${char}`;
        }
        await tts(text, voiceId, char);
    } catch (error) {
        toastr.error(error.toString());
        console.error(error);
        currentTtsJob = null;
    }
}

async function playFullConversation() {
    resetTtsPlayback();

    if (!extension_settings.tts.enabled) {
        return toastr.warning('TTS is disabled. Please enable it in the extension settings.');
    }

    const context = getContext();
    const chat = context.chat.filter(x => !x.is_system && x.mes !== '...' && x.mes !== '');

    if (chat.length === 0) {
        return toastr.info('No messages to narrate.');
    }

    ttsJobQueue = chat;
}

window['playFullConversation'] = playFullConversation;

//#############################//
//  Extension UI and Settings  //
//#############################//

function loadSettings() {
    if (Object.keys(extension_settings.tts).length === 0) {
        Object.assign(extension_settings.tts, defaultSettings);
    }
    for (const key in defaultSettings) {
        if (!(key in extension_settings.tts)) {
            extension_settings.tts[key] = defaultSettings[key];
        }
    }
    $('#tts_provider').val(extension_settings.tts.currentProvider);
    $('#tts_enabled').prop(
        'checked',
        extension_settings.tts.enabled,
    );
    $('#tts_narrate_dialogues').prop('checked', extension_settings.tts.narrate_dialogues_only);
    $('#tts_narrate_quoted').prop('checked', extension_settings.tts.narrate_quoted_only);
    $('#tts_auto_generation').prop('checked', extension_settings.tts.auto_generation);
    $('#tts_periodic_auto_generation').prop('checked', extension_settings.tts.periodic_auto_generation);
    $('#tts_narrate_translated_only').prop('checked', extension_settings.tts.narrate_translated_only);
    $('#tts_narrate_user').prop('checked', extension_settings.tts.narrate_user);
    $('#tts_pass_asterisks').prop('checked', extension_settings.tts.pass_asterisks);
    $('#tts_skip_codeblocks').prop('checked', extension_settings.tts.skip_codeblocks);
    $('#tts_skip_tags').prop('checked', extension_settings.tts.skip_tags);
    $('#playback_rate').val(extension_settings.tts.playback_rate);
    $('#playback_rate_counter').val(Number(extension_settings.tts.playback_rate).toFixed(2));
    $('#playback_rate_block').toggle(extension_settings.tts.currentProvider !== 'System');

    $('body').toggleClass('tts', extension_settings.tts.enabled);
}

const defaultSettings = {
    voiceMap: '',
    ttsEnabled: false,
    currentProvider: 'ElevenLabs',
    auto_generation: true,
    narrate_user: false,
    playback_rate: 1,
};

function setTtsStatus(status, success) {
    $('#tts_status').text(status);
    if (success) {
        $('#tts_status').removeAttr('style');
    } else {
        $('#tts_status').css('color', 'red');
    }
}

function onRefreshClick() {
    Promise.all([
        ttsProvider.onRefreshClick(),
        // updateVoiceMap()
    ]).then(() => {
        extension_settings.tts[ttsProviderName] = ttsProvider.settings;
        saveSettingsDebounced();
        setTtsStatus('Successfully applied settings', true);
        console.info(`Saved settings ${ttsProviderName} ${JSON.stringify(ttsProvider.settings)}`);
        initVoiceMap();
        updateVoiceMap();
    }).catch(error => {
        toastr.error(error.toString());
        console.error(error);
        setTtsStatus(error, false);
    });
}

function onEnableClick() {
    extension_settings.tts.enabled = $('#tts_enabled').is(
        ':checked',
    );
    updateUiAudioPlayState();
    saveSettingsDebounced();
    $('body').toggleClass('tts', extension_settings.tts.enabled);
}


function onAutoGenerationClick() {
    extension_settings.tts.auto_generation = !!$('#tts_auto_generation').prop('checked');
    saveSettingsDebounced();
}


function onPeriodicAutoGenerationClick() {
    extension_settings.tts.periodic_auto_generation = !!$('#tts_periodic_auto_generation').prop('checked');
    saveSettingsDebounced();
}


function onNarrateDialoguesClick() {
    extension_settings.tts.narrate_dialogues_only = !!$('#tts_narrate_dialogues').prop('checked');
    saveSettingsDebounced();
}

function onNarrateUserClick() {
    extension_settings.tts.narrate_user = !!$('#tts_narrate_user').prop('checked');
    saveSettingsDebounced();
}

function onNarrateQuotedClick() {
    extension_settings.tts.narrate_quoted_only = !!$('#tts_narrate_quoted').prop('checked');
    saveSettingsDebounced();
}


function onNarrateTranslatedOnlyClick() {
    extension_settings.tts.narrate_translated_only = !!$('#tts_narrate_translated_only').prop('checked');
    saveSettingsDebounced();
}

function onSkipCodeblocksClick() {
    extension_settings.tts.skip_codeblocks = !!$('#tts_skip_codeblocks').prop('checked');
    saveSettingsDebounced();
}

function onSkipTagsClick() {
    extension_settings.tts.skip_tags = !!$('#tts_skip_tags').prop('checked');
    saveSettingsDebounced();
}

function onPassAsterisksClick() {
    extension_settings.tts.pass_asterisks = !!$('#tts_pass_asterisks').prop('checked');
    saveSettingsDebounced();
    console.log('setting pass asterisks', extension_settings.tts.pass_asterisks);
}

//##############//
// TTS Provider //
//##############//

async function loadTtsProvider(provider) {
    //Clear the current config and add new config
    $('#tts_provider_settings').html('');

    if (!provider) {
        return;
    }

    // Init provider references
    extension_settings.tts.currentProvider = provider;
    ttsProviderName = provider;
    ttsProvider = new ttsProviders[provider];

    // Init provider settings
    $('#tts_provider_settings').append(ttsProvider.settingsHtml);
    if (!(ttsProviderName in extension_settings.tts)) {
        console.warn(`Provider ${ttsProviderName} not in Extension Settings, initiatilizing provider in settings`);
        extension_settings.tts[ttsProviderName] = {};
    }
    await ttsProvider.loadSettings(extension_settings.tts[ttsProviderName]);
    await initVoiceMap();
}

function onTtsProviderChange() {
    const ttsProviderSelection = $('#tts_provider').val();
    extension_settings.tts.currentProvider = ttsProviderSelection;
    $('#playback_rate_block').toggle(extension_settings.tts.currentProvider !== 'System');
    loadTtsProvider(ttsProviderSelection);
}

// Ensure that TTS provider settings are saved to extension settings.
export function saveTtsProviderSettings() {
    extension_settings.tts[ttsProviderName] = ttsProvider.settings;
    updateVoiceMap();
    saveSettingsDebounced();
    console.info(`Saved settings ${ttsProviderName} ${JSON.stringify(ttsProvider.settings)}`);
}


//###################//
// voiceMap Handling //
//###################//

async function onChatChanged() {
    await onGenerationEnded();
    resetTtsPlayback();
    const voiceMapInit = initVoiceMap();
    await Promise.race([voiceMapInit, delay(debounce_timeout.relaxed)]);
    lastMessage = null;
}

async function onMessageEvent(messageId, lastCharIndex) {
    // If TTS is disabled, do nothing
    if (!extension_settings.tts.enabled) {
        return;
    }

    // Auto generation is disabled
    if (!extension_settings.tts.auto_generation) {
        return;
    }

    const context = getContext();

    // no characters or group selected
    if (!context.groupId && context.characterId === undefined) {
        return;
    }

    // Chat changed
    if (context.chatId !== lastChatId) {
        lastChatId = context.chatId;
        lastMessageHash = getStringHash(context.chat[messageId]?.mes ?? '');

        // Force to speak on the first message in the new chat
        if (context.chat.length === 1) {
            lastMessageHash = -1;
        }
    }

    // clone message object, as things go haywire if message object is altered below (it's passed by reference)
    const message = structuredClone(context.chat[messageId]);
    const hashNew = getStringHash(message?.mes ?? '');

    // Ignore prompt-hidden messages
    if (message.is_system) {
        return;
    }

    // if no new messages, or same message, or same message hash, do nothing
    if (hashNew === lastMessageHash) {
        return;
    }

    // if we only want to process part of the message
    if (lastCharIndex) {
        message.mes = message.mes.substring(0, lastCharIndex);
    }

    const isLastMessageInCurrent = () =>
        lastMessage &&
        typeof lastMessage === 'object' &&
        message.swipe_id === lastMessage.swipe_id &&
        message.name === lastMessage.name &&
        message.is_user === lastMessage.is_user &&
        message.mes.indexOf(lastMessage.mes) !== -1;

    // if last message within current message, message got extended. only send diff to TTS.
    if (isLastMessageInCurrent()) {
        const tmp = structuredClone(message);
        message.mes = message.mes.replace(lastMessage.mes, '');
        lastMessage = tmp;
    } else {
        lastMessage = structuredClone(message);
    }

    // We're currently swiping. Don't generate voice
    if (!message || message.mes === '...' || message.mes === '') {
        return;
    }

    // Don't generate if message doesn't have a display text
    if (extension_settings.tts.narrate_translated_only && !(message?.extra?.display_text)) {
        return;
    }

    // Don't generate if message is a user message and user message narration is disabled
    if (message.is_user && !extension_settings.tts.narrate_user) {
        return;
    }

    // New messages, add new chat to history
    lastMessageHash = hashNew;
    lastChatId = context.chatId;

    console.debug(`Adding message from ${message.name} for TTS processing: "${message.mes}"`);
    ttsJobQueue.push(message);
}

async function onMessageDeleted() {
    const context = getContext();

    // update internal references to new last message
    lastChatId = context.chatId;

    // compare against lastMessageHash. If it's the same, we did not delete the last chat item, so no need to reset tts queue
    const messageHash = getStringHash((context.chat.length && context.chat[context.chat.length - 1].mes) ?? '');
    if (messageHash === lastMessageHash) {
        return;
    }
    lastMessageHash = messageHash;
    lastMessage = context.chat.length ? structuredClone(context.chat[context.chat.length - 1]) : null;

    // stop any tts playback since message might not exist anymore
    resetTtsPlayback();
}

async function onGenerationStarted(generationType, _args, isDryRun) {
    // If dry running or quiet mode, do nothing
    if (isDryRun || ['quiet', 'impersonate'].includes(generationType)) {
        return;
    }

    // If TTS is disabled, do nothing
    if (!extension_settings.tts.enabled) {
        return;
    }

    // Auto generation is disabled
    if (!extension_settings.tts.auto_generation) {
        return;
    }

    // Periodic auto generation is disabled
    if (!extension_settings.tts.periodic_auto_generation) {
        return;
    }

    // If the reply is not being streamed
    if (!isStreamingEnabled()) {
        return;
    }

    // start the timer
    if (!periodicMessageGenerationTimer) {
        periodicMessageGenerationTimer = setInterval(onPeriodicMessageGenerationTick, UPDATE_INTERVAL);
    }
}

async function onGenerationEnded() {
    if (periodicMessageGenerationTimer) {
        clearInterval(periodicMessageGenerationTimer);
        periodicMessageGenerationTimer = null;
    }
    lastPositionOfParagraphEnd = -1;
}

async function onPeriodicMessageGenerationTick() {
    const context = getContext();

    // no characters or group selected
    if (!context.groupId && context.characterId === undefined) {
        return;
    }

    const lastMessageId = context.chat.length - 1;

    // the last message was from the user
    if (context.chat[lastMessageId].is_user) {
        return;
    }

    const lastMessage = structuredClone(context.chat[lastMessageId]);
    const lastMessageText = lastMessage?.mes ?? '';

    // look for double ending lines which should indicate the end of a paragraph
    let newLastPositionOfParagraphEnd = lastMessageText
        .indexOf('\n\n', lastPositionOfParagraphEnd + 1);
    // if not found, look for a single ending line which should indicate the end of a paragraph
    if (newLastPositionOfParagraphEnd === -1) {
        newLastPositionOfParagraphEnd = lastMessageText
            .indexOf('\n', lastPositionOfParagraphEnd + 1);
    }

    // send the message to the tts module if we found the new end of a paragraph
    if (newLastPositionOfParagraphEnd > -1) {
        onMessageEvent(lastMessageId, newLastPositionOfParagraphEnd);

        if (periodicMessageGenerationTimer) {
            lastPositionOfParagraphEnd = newLastPositionOfParagraphEnd;
        }
    }
}

/**
 * Get characters in current chat
 * @param {boolean} unrestricted - If true, will include all characters in voiceMapEntries, even if they are not in the current chat.
 * @returns {string[]} - Array of character names
 */
function getCharacters(unrestricted) {
    const context = getContext();

    if (unrestricted) {
        const names = context.characters.map(char => char.name);
        names.unshift(DEFAULT_VOICE_MARKER);
        return names.filter(onlyUnique);
    }

    let characters = [];
    if (context.groupId === null) {
        // Single char chat
        characters.push(DEFAULT_VOICE_MARKER);
        characters.push(context.name1);
        characters.push(context.name2);
    } else {
        // Group chat
        characters.push(DEFAULT_VOICE_MARKER);
        characters.push(context.name1);
        const group = context.groups.find(group => context.groupId == group.id);
        for (let member of group.members) {
            const character = context.characters.find(char => char.avatar == member);
            if (character) {
                characters.push(character.name);
            }
        }
    }
    return characters.filter(onlyUnique);
}

function sanitizeId(input) {
    // Remove any non-alphanumeric characters except underscore (_) and hyphen (-)
    let sanitized = encodeURIComponent(input).replace(/[^a-zA-Z0-9-_]/g, '');

    // Ensure first character is always a letter
    if (!/^[a-zA-Z]/.test(sanitized)) {
        sanitized = 'element_' + sanitized;
    }

    return sanitized;
}

function parseVoiceMap(voiceMapString) {
    let parsedVoiceMap = {};
    for (const [charName, voiceId] of voiceMapString
        .split(',')
        .map(s => s.split(':'))) {
        if (charName && voiceId) {
            parsedVoiceMap[charName.trim()] = voiceId.trim();
        }
    }
    return parsedVoiceMap;
}



/**
 * Apply voiceMap based on current voiceMapEntries
 */
function updateVoiceMap() {
    const tempVoiceMap = {};
    for (const voice of voiceMapEntries) {
        if (voice.voiceId === null) {
            continue;
        }
        tempVoiceMap[voice.name] = voice.voiceId;
    }
    if (Object.keys(tempVoiceMap).length !== 0) {
        voiceMap = tempVoiceMap;
        console.log(`Voicemap updated to ${JSON.stringify(voiceMap)}`);
    }
    if (!extension_settings.tts[ttsProviderName].voiceMap) {
        extension_settings.tts[ttsProviderName].voiceMap = {};
    }
    Object.assign(extension_settings.tts[ttsProviderName].voiceMap, voiceMap);
    saveSettingsDebounced();
}

class VoiceMapEntry {
    name;
    voiceId;
    selectElement;
    constructor(name, voiceId = DEFAULT_VOICE_MARKER) {
        this.name = name;
        this.voiceId = voiceId;
        this.selectElement = null;
    }

    addUI(voiceIds) {
        let sanitizedName = sanitizeId(this.name);
        let defaultOption = this.name === DEFAULT_VOICE_MARKER ?
            `<option>${DISABLED_VOICE_MARKER}</option>` :
            `<option>${DEFAULT_VOICE_MARKER}</option><option>${DISABLED_VOICE_MARKER}</option>`;
        let template = `
            <div class='tts_voicemap_block_char flex-container flexGap5'>
                <span id='tts_voicemap_char_${sanitizedName}'>${this.name}</span>
                <select id='tts_voicemap_char_${sanitizedName}_voice'>
                    ${defaultOption}
                </select>
            </div>
        `;
        $('#tts_voicemap_block').append(template);

        // Populate voice ID select list
        for (const voiceId of voiceIds) {
            const option = document.createElement('option');
            option.innerText = voiceId.name;
            option.value = voiceId.name;
            $(`#tts_voicemap_char_${sanitizedName}_voice`).append(option);
        }

        this.selectElement = $(`#tts_voicemap_char_${sanitizedName}_voice`);
        this.selectElement.on('change', args => this.onSelectChange(args));
        this.selectElement.val(this.voiceId);
    }

    onSelectChange(args) {
        this.voiceId = this.selectElement.find(':selected').val();
        updateVoiceMap();
    }
}

/**
 * Init voiceMapEntries for character select list.
 * If an initialization is already in progress, it returns the existing Promise instead of starting a new one.
 * @param {boolean} unrestricted - If true, will include all characters in voiceMapEntries, even if they are not in the current chat.
 * @returns {Promise} A promise that resolves when the initialization is complete.
 */
export async function initVoiceMap(unrestricted = false) {
    // Preventing parallel execution
    if (currentInitVoiceMapPromise) {
        return currentInitVoiceMapPromise;
    }

    currentInitVoiceMapPromise = (async () => {
        const initialChatId = getCurrentChatId();
        try {
            await initVoiceMapInternal(unrestricted);
        } finally {
            currentInitVoiceMapPromise = null;
        }
        const currentChatId = getCurrentChatId();

        if (initialChatId !== currentChatId) {
            // Chat changed during initialization, reinitialize
            await initVoiceMap(unrestricted);
        }
    })();

    return currentInitVoiceMapPromise;
}

/**
 * Init voiceMapEntries for character select list.
 * @param {boolean} unrestricted - If true, will include all characters in voiceMapEntries, even if they are not in the current chat.
 */
async function initVoiceMapInternal(unrestricted) {
    // Gate initialization if not enabled or TTS Provider not ready. Prevents error popups.
    const enabled = $('#tts_enabled').is(':checked');
    if (!enabled) {
        return;
    }

    // Keep errors inside extension UI rather than toastr. Toastr errors for TTS are annoying.
    try {
        await ttsProvider.checkReady();
    } catch (error) {
        const message = `TTS Provider not ready. ${error}`;
        setTtsStatus(message, false);
        return;
    }

    setTtsStatus('TTS Provider Loaded', true);

    // Clear existing voiceMap state
    $('#tts_voicemap_block').empty();
    voiceMapEntries = [];

    // Get characters in current chat
    const characters = getCharacters(unrestricted);

    // Get saved voicemap from provider settings, handling new and old representations
    let voiceMapFromSettings = {};
    if ('voiceMap' in extension_settings.tts[ttsProviderName]) {
        // Handle previous representation
        if (typeof extension_settings.tts[ttsProviderName].voiceMap === 'string') {
            voiceMapFromSettings = parseVoiceMap(extension_settings.tts[ttsProviderName].voiceMap);
            // Handle new representation
        } else if (typeof extension_settings.tts[ttsProviderName].voiceMap === 'object') {
            voiceMapFromSettings = extension_settings.tts[ttsProviderName].voiceMap;
        }
    }

    // Get voiceIds from provider
    let voiceIdsFromProvider;
    try {
        voiceIdsFromProvider = await ttsProvider.fetchTtsVoiceObjects();
    }
    catch {
        toastr.error('TTS Provider failed to return voice ids.');
    }

    // Build UI using VoiceMapEntry objects
    for (const character of characters) {
        if (character === 'SillyTavern System') {
            continue;
        }
        // Check provider settings for voiceIds
        let voiceId;
        if (character in voiceMapFromSettings) {
            voiceId = voiceMapFromSettings[character];
        } else if (character === DEFAULT_VOICE_MARKER) {
            voiceId = DISABLED_VOICE_MARKER;
        } else {
            voiceId = DEFAULT_VOICE_MARKER;
        }
        const voiceMapEntry = new VoiceMapEntry(character, voiceId);
        voiceMapEntry.addUI(voiceIdsFromProvider);
        voiceMapEntries.push(voiceMapEntry);
    }
    updateVoiceMap();
}

jQuery(async function () {
    async function addExtensionControls() {
        const settingsHtml = $(await renderExtensionTemplateAsync('tts', 'settings'));
        $('#tts_container').append(settingsHtml);
        $('#tts_refresh').on('click', onRefreshClick);
        $('#tts_enabled').on('click', onEnableClick);
        $('#tts_narrate_dialogues').on('click', onNarrateDialoguesClick);
        $('#tts_narrate_quoted').on('click', onNarrateQuotedClick);
        $('#tts_narrate_translated_only').on('click', onNarrateTranslatedOnlyClick);
        $('#tts_skip_codeblocks').on('click', onSkipCodeblocksClick);
        $('#tts_skip_tags').on('click', onSkipTagsClick);
        $('#tts_pass_asterisks').on('click', onPassAsterisksClick);
        $('#tts_auto_generation').on('click', onAutoGenerationClick);
        $('#tts_periodic_auto_generation').on('click', onPeriodicAutoGenerationClick);
        $('#tts_narrate_user').on('click', onNarrateUserClick);

        $('#playback_rate').on('input', function () {
            const value = $(this).val();
            const formattedValue = Number(value).toFixed(2);
            extension_settings.tts.playback_rate = value;
            $('#playback_rate_counter').val(formattedValue);
            saveSettingsDebounced();
        });

        $('#tts_voices').on('click', onTtsVoicesClick);
        for (const provider in ttsProviders) {
            $('#tts_provider').append($('<option />').val(provider).text(provider));
        }
        $('#tts_provider').on('change', onTtsProviderChange);
        $(document).on('click', '.mes_narrate', onNarrateOneMessage);
    }
    await addExtensionControls(); // No init dependencies
    loadSettings(); // Depends on Extension Controls and loadTtsProvider
    loadTtsProvider(extension_settings.tts.currentProvider); // No dependencies
    addAudioControl(); // Depends on Extension Controls
    const wrapper = new ModuleWorkerWrapper(moduleWorker);
    setInterval(wrapper.update.bind(wrapper), UPDATE_INTERVAL); // Init depends on all the things
    eventSource.on(event_types.MESSAGE_SWIPED, resetTtsPlayback);
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
    eventSource.on(event_types.MESSAGE_DELETED, onMessageDeleted);
    eventSource.on(event_types.GROUP_UPDATED, onChatChanged);
    eventSource.on(event_types.GENERATION_STARTED, onGenerationStarted);
    eventSource.on(event_types.GENERATION_ENDED, onGenerationEnded);
    eventSource.makeLast(event_types.CHARACTER_MESSAGE_RENDERED, onMessageEvent);
    eventSource.makeLast(event_types.USER_MESSAGE_RENDERED, onMessageEvent);
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'speak',
        callback: async (args, value) => {
            await onNarrateText(args, value);
            return '';
        },
        aliases: ['narrate', 'tts'],
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'voice',
                description: 'character voice name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                enumProvider: () => Object.keys(voiceMap).map(voiceName => new SlashCommandEnumValue(voiceName, null, enumTypes.enum, enumIcons.voice)),
            }),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'text', [ARGUMENT_TYPE.STRING], true,
            ),
        ],
        helpString: `
            <div>
                Narrate any text using currently selected character's voice.
            </div>
            <div>
                Use <code>voice="Character Name"</code> argument to set other voice from the voice map.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code>/speak voice="Donald Duck" Quack!</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));

    document.body.appendChild(audioElement);
});
