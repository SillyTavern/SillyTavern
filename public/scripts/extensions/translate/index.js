export { translate };

import {
    callPopup,
    eventSource,
    event_types,
    getRequestHeaders,
    reloadCurrentChat,
    saveSettingsDebounced,
    substituteParams,
    updateMessageBlock,
} from '../../../script.js';
import { extension_settings, getContext } from '../../extensions.js';
import { secret_state, writeSecret } from '../../secrets.js';
import { splitRecursive } from '../../utils.js';

export const autoModeOptions = {
    NONE: 'none',
    RESPONSES: 'responses',
    INPUT: 'inputs',
    BOTH: 'both',
};

const incomingTypes = [autoModeOptions.RESPONSES, autoModeOptions.BOTH];
const outgoingTypes = [autoModeOptions.INPUT, autoModeOptions.BOTH];

const defaultSettings = {
    target_language: 'en',
    internal_language: 'en',
    provider: 'google',
    auto_mode: autoModeOptions.NONE,
};

const languageCodes = {
    'Afrikaans': 'af',
    'Albanian': 'sq',
    'Amharic': 'am',
    'Arabic': 'ar',
    'Armenian': 'hy',
    'Azerbaijani': 'az',
    'Basque': 'eu',
    'Belarusian': 'be',
    'Bengali': 'bn',
    'Bosnian': 'bs',
    'Bulgarian': 'bg',
    'Catalan': 'ca',
    'Cebuano': 'ceb',
    'Chinese (Simplified)': 'zh-CN',
    'Chinese (Traditional)': 'zh-TW',
    'Corsican': 'co',
    'Croatian': 'hr',
    'Czech': 'cs',
    'Danish': 'da',
    'Dutch': 'nl',
    'English': 'en',
    'Esperanto': 'eo',
    'Estonian': 'et',
    'Finnish': 'fi',
    'French': 'fr',
    'Frisian': 'fy',
    'Galician': 'gl',
    'Georgian': 'ka',
    'German': 'de',
    'Greek': 'el',
    'Gujarati': 'gu',
    'Haitian Creole': 'ht',
    'Hausa': 'ha',
    'Hawaiian': 'haw',
    'Hebrew': 'iw',
    'Hindi': 'hi',
    'Hmong': 'hmn',
    'Hungarian': 'hu',
    'Icelandic': 'is',
    'Igbo': 'ig',
    'Indonesian': 'id',
    'Irish': 'ga',
    'Italian': 'it',
    'Japanese': 'ja',
    'Javanese': 'jw',
    'Kannada': 'kn',
    'Kazakh': 'kk',
    'Khmer': 'km',
    'Korean': 'ko',
    'Kurdish': 'ku',
    'Kyrgyz': 'ky',
    'Lao': 'lo',
    'Latin': 'la',
    'Latvian': 'lv',
    'Lithuanian': 'lt',
    'Luxembourgish': 'lb',
    'Macedonian': 'mk',
    'Malagasy': 'mg',
    'Malay': 'ms',
    'Malayalam': 'ml',
    'Maltese': 'mt',
    'Maori': 'mi',
    'Marathi': 'mr',
    'Mongolian': 'mn',
    'Myanmar (Burmese)': 'my',
    'Nepali': 'ne',
    'Norwegian': 'no',
    'Nyanja (Chichewa)': 'ny',
    'Pashto': 'ps',
    'Persian': 'fa',
    'Polish': 'pl',
    'Portuguese (Portugal, Brazil)': 'pt',
    'Punjabi': 'pa',
    'Romanian': 'ro',
    'Russian': 'ru',
    'Samoan': 'sm',
    'Scots Gaelic': 'gd',
    'Serbian': 'sr',
    'Sesotho': 'st',
    'Shona': 'sn',
    'Sindhi': 'sd',
    'Sinhala (Sinhalese)': 'si',
    'Slovak': 'sk',
    'Slovenian': 'sl',
    'Somali': 'so',
    'Spanish': 'es',
    'Sundanese': 'su',
    'Swahili': 'sw',
    'Swedish': 'sv',
    'Tagalog (Filipino)': 'tl',
    'Tajik': 'tg',
    'Tamil': 'ta',
    'Telugu': 'te',
    'Thai': 'th',
    'Turkish': 'tr',
    'Ukrainian': 'uk',
    'Urdu': 'ur',
    'Uzbek': 'uz',
    'Vietnamese': 'vi',
    'Welsh': 'cy',
    'Xhosa': 'xh',
    'Yiddish': 'yi',
    'Yoruba': 'yo',
    'Zulu': 'zu',
};

const KEY_REQUIRED = ['deepl', 'libre'];
const LOCAL_URL = ['libre', 'oneringtranslator', 'deeplx'];

function showKeysButton() {
    const providerRequiresKey = KEY_REQUIRED.includes(extension_settings.translate.provider);
    const providerOptionalUrl = LOCAL_URL.includes(extension_settings.translate.provider);
    $('#translate_key_button').toggle(providerRequiresKey);
    $('#translate_key_button').toggleClass('success', Boolean(secret_state[extension_settings.translate.provider]));
    $('#translate_url_button').toggle(providerOptionalUrl);
    $('#translate_url_button').toggleClass('success', Boolean(secret_state[extension_settings.translate.provider + '_url']));
}

function loadSettings() {
    for (const key in defaultSettings) {
        if (!Object.hasOwn(extension_settings.translate, key)) {
            extension_settings.translate[key] = defaultSettings[key];
        }
    }

    $(`#translation_provider option[value="${extension_settings.translate.provider}"]`).attr('selected', true);
    $(`#translation_target_language option[value="${extension_settings.translate.target_language}"]`).attr('selected', true);
    $(`#translation_auto_mode option[value="${extension_settings.translate.auto_mode}"]`).attr('selected', true);
    showKeysButton();
}

async function translateImpersonate(text) {
    const translatedText = await translate(text, extension_settings.translate.target_language);
    $('#send_textarea').val(translatedText);
}

async function translateIncomingMessage(messageId) {
    const context = getContext();
    const message = context.chat[messageId];

    if (typeof message.extra !== 'object') {
        message.extra = {};
    }

    // New swipe is being generated. Don't translate that
    if ($(`#chat .mes[mesid="${messageId}"] .mes_text`).text() == '...') {
        return;
    }

    const textToTranslate = substituteParams(message.mes, context.name1, message.name);
    const translation = await translate(textToTranslate, extension_settings.translate.target_language);
    message.extra.display_text = translation;

    updateMessageBlock(messageId, message);
}

async function translateProviderOneRing(text, lang) {
    let from_lang = lang == extension_settings.translate.internal_language
        ? extension_settings.translate.target_language
        : extension_settings.translate.internal_language;

    const response = await fetch('/api/translate/onering', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ text: text, from_lang: from_lang, to_lang: lang }),
    });

    if (response.ok) {
        const result = await response.text();
        return result;
    }

    throw new Error(response.statusText);
}

/**
 * Translates text using the LibreTranslate API
 * @param {string} text Text to translate
 * @param {string} lang Target language code
 * @returns {Promise<string>} Translated text
 */
async function translateProviderLibre(text, lang) {
    const response = await fetch('/api/translate/libre', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ text: text, lang: lang }),
    });

    if (response.ok) {
        const result = await response.text();
        return result;
    }

    throw new Error(response.statusText);
}

/**
 * Translates text using the Google Translate API
 * @param {string} text Text to translate
 * @param {string} lang Target language code
 * @returns {Promise<string>} Translated text
 */
async function translateProviderGoogle(text, lang) {
    const response = await fetch('/api/translate/google', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ text: text, lang: lang }),
    });

    if (response.ok) {
        const result = await response.text();
        return result;
    }

    throw new Error(response.statusText);
}

/**
 * Translates text using the DeepL API
 * @param {string} text Text to translate
 * @param {string} lang Target language code
 * @returns {Promise<string>} Translated text
 */
async function translateProviderDeepl(text, lang) {
    if (!secret_state.deepl) {
        throw new Error('No DeepL API key');
    }

    const response = await fetch('/api/translate/deepl', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ text: text, lang: lang }),
    });

    if (response.ok) {
        const result = await response.text();
        return result;
    }

    throw new Error(response.statusText);
}

/**
 * Translates text using the DeepLX API
 * @param {string} text Text to translate
 * @param {string} lang Target language code
 * @returns {Promise<string>} Translated text
 */
async function translateProviderDeepLX(text, lang) {
    const response = await fetch('/api/translate/deeplx', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ text: text, lang: lang }),
    });

    if (response.ok) {
        const result = await response.text();
        return result;
    }

    throw new Error(response.statusText);
}

/**
 * Translates text using the Bing API
 * @param {string} text Text to translate
 * @param {string} lang Target language code
 * @returns {Promise<string>} Translated text
 */
async function translateProviderBing(text, lang) {
    const response = await fetch('/api/translate/bing', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ text: text, lang: lang }),
    });

    if (response.ok) {
        const result = await response.text();
        return result;
    }

    throw new Error(response.statusText);
}

/**
 * Splits text into chunks and translates each chunk separately
 * @param {string} text Text to translate
 * @param {string} lang Target language code
 * @param {(text: string, lang: string) => Promise<string>} translateFn Function to translate a single chunk (must return a Promise)
 * @param {number} chunkSize Maximum chunk size
 * @returns {Promise<string>} Translated text
 */
async function chunkedTranslate(text, lang, translateFn, chunkSize = 5000) {
    if (text.length <= chunkSize) {
        return await translateFn(text, lang);
    }

    const chunks = splitRecursive(text, chunkSize);

    let result = '';
    for (const chunk of chunks) {
        result += await translateFn(chunk, lang);
    }
    return result;
}

/**
 * Translates text using the selected translation provider
 * @param {string} text Text to translate
 * @param {string} lang Target language code
 * @returns {Promise<string>} Translated text
 */
async function translate(text, lang) {
    try {
        if (text == '') {
            return '';
        }

        switch (extension_settings.translate.provider) {
            case 'libre':
                return await translateProviderLibre(text, lang);
            case 'google':
                return await chunkedTranslate(text, lang, translateProviderGoogle, 5000);
            case 'deepl':
                return await translateProviderDeepl(text, lang);
            case 'deeplx':
                return await chunkedTranslate(text, lang, translateProviderDeepLX, 1500);
            case 'oneringtranslator':
                return await translateProviderOneRing(text, lang);
            case 'bing':
                return await chunkedTranslate(text, lang, translateProviderBing, 1000);
            default:
                console.error('Unknown translation provider', extension_settings.translate.provider);
                return text;
        }
    } catch (error) {
        console.log(error);
        toastr.error(String(error), 'Failed to translate message');
    }
}

async function translateOutgoingMessage(messageId) {
    const context = getContext();
    const message = context.chat[messageId];

    if (typeof message.extra !== 'object') {
        message.extra = {};
    }

    const originalText = message.mes;
    message.extra.display_text = originalText;
    message.mes = await translate(originalText, extension_settings.translate.internal_language);
    updateMessageBlock(messageId, message);

    console.log('translateOutgoingMessage', messageId);
}

function shouldTranslate(types) {
    return types.includes(extension_settings.translate.auto_mode);
}

function createEventHandler(translateFunction, shouldTranslateFunction) {
    return async (data) => {
        if (shouldTranslateFunction()) {
            await translateFunction(data);
        }
    };
}

// Prevents the chat from being translated in parallel
let translateChatExecuting = false;

async function onTranslateChatClick() {
    if (translateChatExecuting) {
        return;
    }

    try {
        translateChatExecuting = true;
        const context = getContext();
        const chat = context.chat;

        toastr.info(`${chat.length} message(s) queued for translation.`, 'Please wait...');

        for (let i = 0; i < chat.length; i++) {
            await translateIncomingMessage(i);
        }

        await context.saveChat();
    } catch (error) {
        console.log(error);
        toastr.error('Failed to translate chat');
    } finally {
        translateChatExecuting = false;
    }
}

async function onTranslationsClearClick() {
    const confirm = await callPopup('<h3>Are you sure?</h3>This will remove translated text from all messages in the current chat. This action cannot be undone.', 'confirm');

    if (!confirm) {
        return;
    }

    const context = getContext();
    const chat = context.chat;

    for (const mes of chat) {
        if (mes.extra) {
            delete mes.extra.display_text;
        }
    }

    await context.saveChat();
    await reloadCurrentChat();
}

async function translateMessageEdit(messageId) {
    const context = getContext();
    const chat = context.chat;
    const message = chat[messageId];

    if (message.is_system || extension_settings.translate.auto_mode == autoModeOptions.NONE) {
        return;
    }

    if ((message.is_user && shouldTranslate(outgoingTypes)) || (!message.is_user && shouldTranslate(incomingTypes))) {
        await translateIncomingMessage(messageId);
    }
}

async function onMessageTranslateClick() {
    const context = getContext();
    const messageId = $(this).closest('.mes').attr('mesid');
    const message = context.chat[messageId];

    // If the message is already translated, revert it back to the original text
    if (message?.extra?.display_text) {
        delete message.extra.display_text;
        updateMessageBlock(messageId, message);
    }
    // If the message is not translated, translate it
    else {
        await translateIncomingMessage(messageId);
    }

    await context.saveChat();
}

const handleIncomingMessage = createEventHandler(translateIncomingMessage, () => shouldTranslate(incomingTypes));
const handleOutgoingMessage = createEventHandler(translateOutgoingMessage, () => shouldTranslate(outgoingTypes));
const handleImpersonateReady = createEventHandler(translateImpersonate, () => shouldTranslate(incomingTypes));
const handleMessageEdit = createEventHandler(translateMessageEdit, () => true);

jQuery(() => {
    const html = `
    <div class="translation_settings">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>Chat Translation</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <label for="translation_auto_mode" class="checkbox_label">Auto-mode</label>
                <select id="translation_auto_mode">
                    <option value="none">None</option>
                    <option value="responses">Translate responses</option>
                    <option value="inputs">Translate inputs</option>
                    <option value="both">Translate both</option>
                </select>
                <label for="translation_provider">Provider</label>
                <div class="flex-container gap5px flexnowrap marginBot5">
                    <select id="translation_provider" name="provider" class="margin0">
                        <option value="libre">Libre</option>
                        <option value="google">Google</option>
                        <option value="deepl">DeepL</option>
                        <option value="deeplx">DeepLX</option>
                        <option value="bing">Bing</option>
                        <option value="oneringtranslator">OneRingTranslator</option>
                    <select>
                    <div id="translate_key_button" class="menu_button fa-solid fa-key margin0"></div>
                    <div id="translate_url_button" class="menu_button fa-solid fa-link margin0"></div>
                </div>
                <label for="translation_target_language">Target Language</label>
                <select id="translation_target_language" name="target_language"></select>
                <div id="translation_clear" class="menu_button">
                    <i class="fa-solid fa-trash-can"></i>
                    <span>Clear Translations</span>
                </div>
            </div>
        </div>
    </div>`;

    const buttonHtml = `
        <div id="translate_chat" class="list-group-item flex-container flexGap5">
            <div class="fa-solid fa-language extensionsMenuExtensionButton" /></div>
            Translate Chat
        </div>`;
    $('#extensionsMenu').append(buttonHtml);
    $('#extensions_settings2').append(html);
    $('#translate_chat').on('click', onTranslateChatClick);
    $('#translation_clear').on('click', onTranslationsClearClick);

    for (const [key, value] of Object.entries(languageCodes)) {
        $('#translation_target_language').append(`<option value="${value}">${key}</option>`);
    }

    $('#translation_auto_mode').on('change', (event) => {
        extension_settings.translate.auto_mode = event.target.value;
        saveSettingsDebounced();
    });
    $('#translation_provider').on('change', (event) => {
        extension_settings.translate.provider = event.target.value;
        showKeysButton();
        saveSettingsDebounced();
    });
    $('#translation_target_language').on('change', (event) => {
        extension_settings.translate.target_language = event.target.value;
        saveSettingsDebounced();
    });
    $(document).on('click', '.mes_translate', onMessageTranslateClick);
    $('#translate_key_button').on('click', async () => {
        const optionText = $('#translation_provider option:selected').text();
        const key = await callPopup(`<h3>${optionText} API Key</h3>`, 'input');

        if (key == false) {
            return;
        }

        await writeSecret(extension_settings.translate.provider, key);
        toastr.success('API Key saved');
        $('#translate_key_button').addClass('success');
    });
    $('#translate_url_button').on('click', async () => {
        const optionText = $('#translation_provider option:selected').text();
        const exampleURLs = {
            'libre': 'http://127.0.0.1:5000/translate',
            'oneringtranslator': 'http://127.0.0.1:4990/translate',
            'deeplx': 'http://127.0.0.1:1188/translate',
        };
        const popupText = `<h3>${optionText} API URL</h3><i>Example: <tt>${String(exampleURLs[extension_settings.translate.provider])}</tt></i>`;
        const url = await callPopup(popupText, 'input');

        if (url == false) {
            return;
        }

        await writeSecret(extension_settings.translate.provider + '_url', url);
        toastr.success('API URL saved');
        $('#translate_url_button').addClass('success');
    });

    loadSettings();

    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, handleIncomingMessage);
    eventSource.on(event_types.MESSAGE_SWIPED, handleIncomingMessage);
    eventSource.on(event_types.USER_MESSAGE_RENDERED, handleOutgoingMessage);
    eventSource.on(event_types.IMPERSONATE_READY, handleImpersonateReady);
    eventSource.on(event_types.MESSAGE_EDITED, handleMessageEdit);

    document.body.classList.add('translate');
});
