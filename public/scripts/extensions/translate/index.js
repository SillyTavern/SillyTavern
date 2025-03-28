export { translate };

import {
    eventSource,
    event_types,
    getRequestHeaders,
    reloadCurrentChat,
    saveSettingsDebounced,
    substituteParams,
    updateMessageBlock,
} from '../../../script.js';
import { extension_settings, getContext, renderExtensionTemplateAsync } from '../../extensions.js';
import { POPUP_RESULT, POPUP_TYPE, callGenericPopup } from '../../popup.js';
import { updateReasoningUI } from '../../reasoning.js';
import { findSecret, secret_state, writeSecret } from '../../secrets.js';
import { SlashCommand } from '../../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from '../../slash-commands/SlashCommandArgument.js';
import { enumIcons } from '../../slash-commands/SlashCommandCommonEnumsProvider.js';
import { enumTypes, SlashCommandEnumValue } from '../../slash-commands/SlashCommandEnumValue.js';
import { SlashCommandParser } from '../../slash-commands/SlashCommandParser.js';
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
    deepl_endpoint: 'free',
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
    'Portuguese (Portugal)': 'pt-PT',
    'Portuguese (Brazil)': 'pt-BR',
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
const LOCAL_URL = ['libre', 'oneringtranslator', 'deeplx', 'lingva'];

function showKeysButton() {
    const providerRequiresKey = KEY_REQUIRED.includes(extension_settings.translate.provider);
    const providerOptionalUrl = LOCAL_URL.includes(extension_settings.translate.provider);
    $('#translate_key_button').toggle(providerRequiresKey);
    $('#translate_key_button').toggleClass('success', Boolean(secret_state[extension_settings.translate.provider]));
    $('#translate_url_button').toggle(providerOptionalUrl);
    $('#translate_url_button').toggleClass('success', Boolean(secret_state[extension_settings.translate.provider + '_url']));
    $('#deepl_api_endpoint').toggle(extension_settings.translate.provider === 'deepl');
}

function loadSettings() {
    for (const key in defaultSettings) {
        if (!Object.hasOwn(extension_settings.translate, key)) {
            extension_settings.translate[key] = defaultSettings[key];
        }
    }

    $(`#translation_provider option[value="${extension_settings.translate.provider}"]`).attr('selected', 'true');
    $(`#translation_target_language option[value="${extension_settings.translate.target_language}"]`).attr('selected', 'true');
    $(`#translation_auto_mode option[value="${extension_settings.translate.auto_mode}"]`).attr('selected', 'true');
    $('#deepl_api_endpoint').val(extension_settings.translate.deepl_endpoint).toggle(extension_settings.translate.provider === 'deepl');
    showKeysButton();
}

/**
 * Check if the swipe is being generated for a message.
 * @param {string|number} messageId Message ID
 * @returns {boolean} Whether the swipe is being generated
 */
function isGeneratingSwipe(messageId) {
    return $(`#chat .mes[mesid="${messageId}"] .mes_text`).text() === '...';
}

async function translateImpersonate(text) {
    const translatedText = await translate(text, extension_settings.translate.target_language);
    $('#send_textarea').val(translatedText);
}

/**
 * Translates the contents of an incoming message.
 * @param {string | number} messageId Message ID
 * @returns {Promise<void>}
 */
async function translateIncomingMessage(messageId) {
    const context = getContext();
    const message = context.chat[messageId];

    if (!message) {
        return;
    }

    if (typeof message.extra !== 'object') {
        message.extra = {};
    }

    if (isGeneratingSwipe(messageId)) {
        return;
    }

    const textToTranslate = substituteParams(message.mes, context.name1, message.name);
    const translation = await translate(textToTranslate, extension_settings.translate.target_language);
    message.extra.display_text = translation;

    updateMessageBlock(Number(messageId), message);
}

/**
 * Translates the reasoning of an incoming message.
 * @param {string | number} messageId
 * @returns {Promise<boolean>} translated or not
 */
async function translateIncomingMessageReasoning(messageId) {
    const context = getContext();
    const message = context.chat[messageId];

    if (!message) {
        return false;
    }

    if (typeof message.extra !== 'object') {
        message.extra = {};
    }

    if (!message.extra.reasoning || isGeneratingSwipe(messageId)) {
        return false;
    }

    const textToTranslate = substituteParams(message.extra.reasoning, context.name1, message.name);
    const translation = await translate(textToTranslate, extension_settings.translate.target_language);
    message.extra.reasoning_display_text = translation;

    updateReasoningUI(Number(messageId));
    return true;
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
 * Translates text using an instance of the Lingva Translate
 * @param {string} text Text to translate
 * @param {string} lang Target language code
 * @returns {Promise<string>} Translated text
 */
async function translateProviderLingva(text, lang) {
    const response = await fetch('/api/translate/lingva', {
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

    const endpoint = extension_settings.translate.deepl_endpoint || 'free';
    const response = await fetch('/api/translate/deepl', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ text: text, lang: lang, endpoint: endpoint }),
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
 * Translates text using the Yandex Translate API
 * @param {string} text Text to translate
 * @param {string} lang Target language code
 * @returns {Promise<string>} Translated text
 */
async function translateProviderYandex(text, lang) {
    let chunks = [];
    const chunkSize = 5000;
    if (text.length <= chunkSize) {
        chunks.push(text);
    } else {
        chunks = splitRecursive(text, chunkSize);
    }
    const response = await fetch('/api/translate/yandex', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ chunks: chunks, lang: lang }),
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
 * @param {string} provider Translation provider to use
 * @returns {Promise<string>} Translated text
 */
async function translate(text, lang, provider = null) {
    try {
        if (text == '') {
            return '';
        }

        if (!lang) {
            lang = extension_settings.translate.target_language;
        }

        if (!provider) {
            provider = extension_settings.translate.provider;
        }

        // split text by embedded images links
        const chunks = text.split(/!\[.*?]\([^)]*\)/);
        const links = [...text.matchAll(/!\[.*?]\([^)]*\)/g)];

        let result = '';
        for (let i = 0; i < chunks.length; i++) {
            result += await translateInner(chunks[i], lang, provider);
            if (i < links.length) result += links[i][0];
        }

        return result;
    } catch (error) {
        console.log(error);
        toastr.error(String(error), 'Failed to translate message');
    }
}

/**
 * Common translation function that handles the translation logic
 * @param {string} text Text to translate
 * @param {string} lang Target language code
 * @param {string} provider Translation provider to use
 * @returns {Promise<string>} Translated text
 */
async function translateInner(text, lang, provider) {
    if (text == '') {
        return '';
    }
    if (!provider) {
        provider = extension_settings.translate.provider;
    }
    switch (provider) {
        case 'libre':
            return await translateProviderLibre(text, lang);
        case 'google':
            return await chunkedTranslate(text, lang, translateProviderGoogle, 5000);
        case 'lingva':
            return await chunkedTranslate(text, lang, translateProviderLingva, 5000);
        case 'deepl':
            return await translateProviderDeepl(text, lang);
        case 'deeplx':
            return await chunkedTranslate(text, lang, translateProviderDeepLX, 1500);
        case 'oneringtranslator':
            return await translateProviderOneRing(text, lang);
        case 'bing':
            return await chunkedTranslate(text, lang, translateProviderBing, 1000);
        case 'yandex':
            return await translateProviderYandex(text, lang);
        default:
            console.error('Unknown translation provider', provider);
            return text;
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

async function onTranslateInputMessageClick() {
    const textarea = document.getElementById('send_textarea');

    if (!(textarea instanceof HTMLTextAreaElement)) {
        return;
    }

    if (!textarea.value) {
        toastr.warning('Enter a message first');
        return;
    }

    const toast = toastr.info('Input Message is translating', 'Please wait...');
    const translatedText = await translate(textarea.value, extension_settings.translate.internal_language);
    textarea.value = translatedText;
    textarea.dispatchEvent(new Event('input', { bubbles: true }));
    toastr.clear(toast);
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
            await translateIncomingMessageReasoning(i);
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
    const popupHtml = await renderExtensionTemplateAsync('translate', 'deleteConfirmation');
    const confirm = await callGenericPopup(popupHtml, POPUP_TYPE.CONFIRM);

    if (!confirm) {
        return;
    }

    const context = getContext();
    const chat = context.chat;

    for (const mes of chat) {
        if (mes.extra) {
            delete mes.extra.display_text;
            delete mes.extra.reasoning_display_text;
        }
    }

    await context.saveChat();
    await reloadCurrentChat();
}

async function translateMessageEdit(messageId) {
    const context = getContext();
    const chat = context.chat;
    const message = chat[messageId];

    let anyChange = false;
    if (message.is_system || (extension_settings.translate.auto_mode == autoModeOptions.NONE && message.extra?.display_text)) {
        delete message.extra.display_text;
        updateMessageBlock(messageId, message);
        anyChange = true;
    } else if ((message.is_user && shouldTranslate(outgoingTypes)) || (!message.is_user && shouldTranslate(incomingTypes))) {
        await translateIncomingMessage(messageId);
        anyChange = true;
    }

    if (anyChange) {
        await context.saveChat();
    }
}

async function translateMessageReasoningEdit(messageId) {
    const context = getContext();
    const chat = context.chat;
    const message = chat[messageId];

    let anyChange = false;
    if (message.is_system || (extension_settings.translate.auto_mode == autoModeOptions.NONE && message.extra?.reasoning_display_text)) {
        delete message.extra.reasoning_display_text;
        updateReasoningUI(Number(messageId));
        anyChange = true;
    } else if ((message.is_user && shouldTranslate(outgoingTypes)) || (!message.is_user && shouldTranslate(incomingTypes))) {
        anyChange = await translateIncomingMessageReasoning(messageId);
    }

    if (anyChange) {
        await context.saveChat();
    }
}

async function removeReasoningDisplayText(messageId) {
    const context = getContext();
    const message = context.chat[messageId];
    if (message.extra?.reasoning_display_text) {
        delete message.extra.reasoning_display_text;
        updateReasoningUI(Number(messageId));
        await context.saveChat();
    }
}

async function onMessageTranslateClick() {
    const context = getContext();
    const messageId = $(this).closest('.mes').attr('mesid');
    const message = context.chat[messageId];

    // If the message is already translated, revert it back to the original text
    let alreadyTranslated = false;
    if (message?.extra?.display_text) {
        delete message.extra.display_text;
        updateMessageBlock(Number(messageId), message);
        alreadyTranslated = true;
    }
    if (message?.extra?.reasoning_display_text) {
        delete message.extra.reasoning_display_text;
        updateReasoningUI(Number(messageId));
        alreadyTranslated = true;
    }

    // If the message is not translated, translate it
    if (!alreadyTranslated) {
        await translateIncomingMessageReasoning(messageId);
        await translateIncomingMessage(messageId);
    }

    await context.saveChat();
}

const handleIncomingMessage = createEventHandler(async (messageId) => {
    await translateIncomingMessageReasoning(messageId);
    await translateIncomingMessage(messageId);
}, () => shouldTranslate(incomingTypes));
const handleOutgoingMessage = createEventHandler(translateOutgoingMessage, () => shouldTranslate(outgoingTypes));
const handleImpersonateReady = createEventHandler(translateImpersonate, () => shouldTranslate(incomingTypes));
const handleMessageEdit = createEventHandler(translateMessageEdit, () => true);
const handleMessageReasoningEdit = createEventHandler(translateMessageReasoningEdit, () => true);
const handleMessageReasoningDelete = createEventHandler(removeReasoningDisplayText, () => true);

globalThis.translate = translate;

jQuery(async () => {
    const html = await renderExtensionTemplateAsync('translate', 'index');
    const buttonHtml = await renderExtensionTemplateAsync('translate', 'buttons');

    $('#translate_wand_container').append(buttonHtml);
    $('#translation_container').append(html);
    $('#translate_chat').on('click', onTranslateChatClick);
    $('#translate_input_message').on('click', onTranslateInputMessageClick);
    $('#translation_clear').on('click', onTranslationsClearClick);

    for (const [key, value] of Object.entries(languageCodes)) {
        $('#translation_target_language').append(`<option value="${value}">${key}</option>`);
    }

    $('#translation_auto_mode').on('change', (event) => {
        if (!(event.target instanceof HTMLSelectElement)) {
            return;
        }
        extension_settings.translate.auto_mode = event.target.value;
        saveSettingsDebounced();
    });
    $('#translation_provider').on('change', (event) => {
        if (!(event.target instanceof HTMLSelectElement)) {
            return;
        }
        extension_settings.translate.provider = event.target.value;
        showKeysButton();
        saveSettingsDebounced();
    });
    $('#translation_target_language').on('change', (event) => {
        if (!(event.target instanceof HTMLSelectElement)) {
            return;
        }
        extension_settings.translate.target_language = event.target.value;
        saveSettingsDebounced();
    });
    $('#deepl_api_endpoint').on('change', (event) => {
        if (!(event.target instanceof HTMLSelectElement)) {
            return;
        }
        extension_settings.translate.deepl_endpoint = event.target.value;
        saveSettingsDebounced();
    });
    $(document).on('click', '.mes_translate', onMessageTranslateClick);
    $('#translate_key_button').on('click', async () => {
        const optionText = $('#translation_provider option:selected').text();
        const key = await callGenericPopup(`<h3>${optionText} API Key</h3>`, POPUP_TYPE.INPUT, '', {
            customButtons: [{
                text: 'Remove Key',
                appendAtEnd: true,
                result: POPUP_RESULT.NEGATIVE,
                action: async () => {
                    await writeSecret(extension_settings.translate.provider, '');
                    toastr.success('API Key removed');
                    $('#translate_key_button').toggleClass('success', !!secret_state[extension_settings.translate.provider]);
                },
            }],
        });

        if (!key) {
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
            'lingva': 'https://lingva.ml/api/v1',
            'oneringtranslator': 'http://127.0.0.1:4990/translate',
            'deeplx': 'http://127.0.0.1:1188/translate',
        };
        const popupText = `<h3>${optionText} API URL</h3><i>Example: <tt>${String(exampleURLs[extension_settings.translate.provider])}</tt></i>`;

        const secretKey = extension_settings.translate.provider + '_url';
        const savedUrl = secret_state[secretKey] ? await findSecret(secretKey) : '';

        const url = await callGenericPopup(popupText, POPUP_TYPE.INPUT, savedUrl, {
            customButtons: [{
                text: 'Remove URL',
                appendAtEnd: true,
                result: POPUP_RESULT.NEGATIVE,
                action: async () => {
                    await writeSecret(secretKey, '');
                    toastr.success('API URL removed');
                    $('#translate_url_button').toggleClass('success', !!secret_state[secretKey]);
                },
            }],
        });

        if (!url) {
            return;
        }

        await writeSecret(secretKey, url);

        toastr.success('API URL saved');
        $('#translate_url_button').addClass('success');
    });

    loadSettings();

    eventSource.makeFirst(event_types.CHARACTER_MESSAGE_RENDERED, handleIncomingMessage);
    eventSource.makeFirst(event_types.USER_MESSAGE_RENDERED, handleOutgoingMessage);
    eventSource.on(event_types.MESSAGE_SWIPED, handleIncomingMessage);
    eventSource.on(event_types.IMPERSONATE_READY, handleImpersonateReady);
    eventSource.on(event_types.MESSAGE_UPDATED, handleMessageEdit);
    eventSource.on(event_types.MESSAGE_REASONING_EDITED, handleMessageReasoningEdit);
    eventSource.on(event_types.MESSAGE_REASONING_DELETED, handleMessageReasoningDelete);

    document.body.classList.add('translate');

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'translate',
        helpString: 'Translate text to a target language. If target language is not provided, the value from the extension settings will be used.',
        namedArgumentList: [
            new SlashCommandNamedArgument('target', 'The target language code to translate to', ARGUMENT_TYPE.STRING, false, false, '', Object.values(languageCodes)),
            SlashCommandNamedArgument.fromProps({
                name: 'provider',
                description: 'The translation provider to use. If not provided, the value from the extension settings will be used.',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                acceptsMultiple: false,
                enumProvider: () => Array.from(document.getElementById('translation_provider').querySelectorAll('option')).map((option) => new SlashCommandEnumValue(option.value, option.text, enumTypes.name, enumIcons.server)),
            }),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument('The text to translate', ARGUMENT_TYPE.STRING, true, false, ''),
        ],
        callback: async (args, value) => {
            const target = args?.target && Object.values(languageCodes).includes(String(args.target))
                ? String(args.target)
                : extension_settings.translate.target_language;
            const provider = args?.provider || extension_settings.translate.provider;
            return await translate(String(value), target, provider);
        },
        returns: ARGUMENT_TYPE.STRING,
    }));
});
