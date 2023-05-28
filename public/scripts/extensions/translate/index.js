import { eventSource, event_types, getRequestHeaders, messageFormatting, saveSettingsDebounced } from "../../../script.js";
import { extension_settings, getContext } from "../../extensions.js";

const defaultSettings = {
    target_language: 'en',
    provider: 'google',
    auto: false,
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

function loadSettings() {
    if (Object.keys(extension_settings.translate).length === 0) {
        Object.assign(extension_settings.translate, defaultSettings);
    }

    $(`#translation_provider option[value="${extension_settings.translate.provider}"]`).attr('selected', true);
    $(`#translation_target_language option[value="${extension_settings.translate.target_language}"]`).attr('selected', true);
    $('#translation_auto').prop('checked', extension_settings.translate.auto);
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

    const translation = await translate(message.mes);
    message.extra.display_text = translation;

    $(`#chat .mes[mesid="${messageId}"] .mes_text`).html(messageFormatting(translation, message.name, message.is_system, message.is_user));

    context.saveChat();
}

async function translateProviderGoogle(text) {
    const response = await fetch('/google_translate', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ text: text, lang: extension_settings.translate.target_language }),
    });

    if (response.ok) {
        const result = await response.text();
        return result;
    }

    throw new Error(response.statusText);
}

async function translate(text) {
    try {
        switch (extension_settings.translate.provider) {
            case 'google':
                return await translateProviderGoogle(text);
            default:
                console.error('Unknown translation provider', extension_settings.translate.provider);
                return text;
        }
    } catch (error) {
        console.log(error);
        toastr.error('Failed to translate message');
    }
}

async function translateOutgoingMessage(messageId) {
    alert('translateOutgoingMessage', messageId);
}

jQuery(() => {
    const html = `
    <div class="translation_settings">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>Chat Translation</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <label for="translation_auto" class="checkbox_label">
                    <input type="checkbox" id="translation_auto" />
                    Auto-mode
                </label>
                <label for="translation_provider">Provider</label>
                <select id="translation_provider" name="provider">
                    <option value="google">Google</option>
                <select>
                <label for="translation_target_language">Target Language</label>
                <select id="translation_target_language" name="target_language"></select>
            </div>
        </div>
    </div>`;

    $('#extensions_settings').append(html);
    for (const [key, value] of Object.entries(languageCodes)) {
        $('#translation_target_language').append(`<option value="${value}">${key}</option>`);
    }

    loadSettings();
    eventSource.on(event_types.MESSAGE_RECEIVED, async (messageId) => {
        if (!extension_settings.translate.auto) {
            return;
        }
        await translateIncomingMessage(messageId);
    });
    eventSource.on(event_types.MESSAGE_SWIPED, async (messageId) => {
        if (!extension_settings.translate.auto) {
            return;
        }

        await translateIncomingMessage(messageId);
    });
    eventSource.on(event_types.MESSAGE_SENT, async (messageId) => {
        if (!extension_settings.translate.auto) {
            return;
        }

        await translateOutgoingMessage(messageId);
    });
    $('#translation_auto').on('input', (event) => {
        extension_settings.translate.auto = event.target.checked;
        saveSettingsDebounced();
    });
    $('#translation_provider').on('change', (event) => {
        extension_settings.translate.provider = event.target.value;
        saveSettingsDebounced();
    });
    $('#translation_target_language').on('change', (event) => {
        extension_settings.translate.target_language = event.target.value;
        saveSettingsDebounced();
    });
    $(document).on('click', '.mes_translate', function () {
        const messageId = $(this).closest('.mes').attr('mesid');
        translateIncomingMessage(messageId);
    });
    document.body.classList.add('translate');
});
