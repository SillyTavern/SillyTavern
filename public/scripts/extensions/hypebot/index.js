import { eventSource, event_types, getRequestHeaders, is_send_press, saveSettingsDebounced } from "../../../script.js";
import { extension_settings, getContext, renderExtensionTemplate } from "../../extensions.js";
import { SECRET_KEYS, secret_state } from "../../secrets.js";
import { collapseNewlines } from "../../power-user.js";
import { bufferToBase64, debounce } from "../../utils.js";
import { decodeTextTokens, getTextTokens, tokenizers } from "../../tokenizers.js";

const MODULE_NAME = 'hypebot';
const WAITING_VERBS = ['thinking', 'typing', 'brainstorming', 'cooking', 'conjuring'];
const MAX_PROMPT = 1024;
const MAX_LENGTH = 50;
const MAX_STRING_LENGTH = MAX_PROMPT * 4;

const settings = {
    enabled: false,
    name: 'Goose',
};

/**
 * Returns a random waiting verb
 * @returns {string} Random waiting verb
 */
function getWaitingVerb() {
    return WAITING_VERBS[Math.floor(Math.random() * WAITING_VERBS.length)];
}

/**
 * Returns a random verb based on the text
 * @param {string} text Text to generate a verb for
 * @returns {string} Random verb
 */
function getVerb(text) {
    let verbList = ['says', 'notes', 'states', 'whispers', 'murmurs', 'mumbles'];

    if (text.endsWith('!')) {
        verbList = ['proclaims', 'declares', 'salutes', 'exclaims', 'cheers'];
    }

    if (text.endsWith('?')) {
        verbList = ['asks', 'suggests', 'ponders', 'wonders', 'inquires', 'questions'];
    }

    return verbList[Math.floor(Math.random() * verbList.length)];
}

/**
 * Formats the HypeBot reply text
 * @param {string} text HypeBot output text
 * @returns {string} Formatted HTML text
 */
function formatReply(text) {
    return `<span class="hypebot_name">${settings.name} ${getVerb(text)}:</span>&nbsp;<span class="hypebot_text">${text}</span>`;
}

let hypeBotBar;
let abortController;

const generateDebounced = debounce(() => generateHypeBot(), 500);

/**
 * Sets the HypeBot text. Preserves scroll position of the chat.
 * @param {string} text Text to set
 */
function setHypeBotText(text) {
    const blockA = $('#chat');
    var originalScrollBottom = blockA[0].scrollHeight - (blockA.scrollTop() + blockA.outerHeight());
    hypeBotBar.html(DOMPurify.sanitize(text));
    var newScrollTop = blockA[0].scrollHeight - (blockA.outerHeight() + originalScrollBottom);
    blockA.scrollTop(newScrollTop);
}

/**
 * Called when a chat event occurs to generate a HypeBot reply.
 * @param {boolean} clear Clear the hypebot bar.
 */
function onChatEvent(clear) {
    if (clear) {
        setHypeBotText('');
    }

    abortController?.abort();
    generateDebounced();
};

/**
 * Generates a HypeBot reply.
 */
async function generateHypeBot() {
    if (!settings.enabled || is_send_press) {
        return;
    }

    if (!secret_state[SECRET_KEYS.NOVEL]) {
        setHypeBotText('<div class="hypebot_nokey">No API key found. Please enter your API key in the NovelAI API Settings to use the HypeBot.</div>');
        return;
    }

    console.debug('Generating HypeBot reply');
    setHypeBotText(`<span class="hypebot_name">${settings.name}</span> is ${getWaitingVerb()}...`);

    const context = getContext();
    const chat = context.chat.slice();
    let prompt = '';

    for (let index = chat.length - 1; index >= 0; index--) {
        const message = chat[index];

        if (message.is_system || !message.mes) {
            continue;
        }

        prompt = `\n${message.mes}\n${prompt}`;

        if (prompt.length >= MAX_STRING_LENGTH) {
            break;
        }
    }

    prompt = collapseNewlines(prompt.replaceAll(/[\*\[\]\{\}]/g, ''));

    if (!prompt) {
        return;
    }

    const sliceLength = MAX_PROMPT - MAX_LENGTH;
    const encoded = getTextTokens(tokenizers.GPT2, prompt).slice(-sliceLength);

    // Add a stop string token to the end of the prompt
    encoded.push(49527);

    const base64String = await bufferToBase64(new Uint16Array(encoded).buffer);

    const parameters = {
        input: base64String,
        model: "hypebot",
        streaming: false,
        temperature: 1,
        max_length: MAX_LENGTH,
        min_length: 1,
        top_k: 0,
        top_p: 1,
        tail_free_sampling: 0.95,
        repetition_penalty: 1,
        repetition_penalty_range: 2048,
        repetition_penalty_slope: 0.18,
        repetition_penalty_frequency: 0,
        repetition_penalty_presence: 0,
        phrase_rep_pen: "off",
        bad_words_ids: [],
        stop_sequences: [[48585]],
        generate_until_sentence: true,
        use_cache: false,
        use_string: false,
        return_full_text: false,
        prefix: "vanilla",
        logit_bias_exp: [],
        order: [0, 1, 2, 3],
    };

    abortController = new AbortController();

    const response = await fetch('/generate_novelai', {
        headers: getRequestHeaders(),
        body: JSON.stringify(parameters),
        method: 'POST',
        signal: abortController.signal,
    });

    if (response.ok) {
        const data = await response.json();
        const ids = Array.from(new Uint16Array(Uint8Array.from(atob(data.output), c => c.charCodeAt(0)).buffer));
        const output = decodeTextTokens(tokenizers.GPT2, ids).replace(/�/g, '').trim();

        setHypeBotText(formatReply(output));
    } else {
        setHypeBotText('<div class="hypebot_error">Something went wrong while generating a HypeBot reply. Please try again.</div>');
    }
}

jQuery(() => {
    if (!extension_settings.hypebot) {
        extension_settings.hypebot = settings;
    }

    Object.assign(settings, extension_settings.hypebot);
    $('#extensions_settings2').append(renderExtensionTemplate(MODULE_NAME, 'settings'));
    hypeBotBar = $(`<div id="hypeBotBar"></div>`).toggle(settings.enabled);
    $('#send_form').append(hypeBotBar);

    $('#hypebot_enabled').prop('checked', settings.enabled).on('input', () => {
        settings.enabled = $('#hypebot_enabled').prop('checked');
        hypeBotBar.toggle(settings.enabled);
        abortController?.abort();
        saveSettingsDebounced();
    });

    $('#hypebot_name').val(settings.name).on('input', () => {
        settings.name = String($('#hypebot_name').val());
        saveSettingsDebounced();
    });

    eventSource.on(event_types.CHAT_CHANGED, () => onChatEvent(true));
    eventSource.on(event_types.MESSAGE_DELETED, () => onChatEvent(true));
    eventSource.on(event_types.MESSAGE_EDITED, () => onChatEvent(true));
    eventSource.on(event_types.MESSAGE_SENT, () => onChatEvent(false));
    eventSource.on(event_types.MESSAGE_RECEIVED, () => onChatEvent(false));
    eventSource.on(event_types.MESSAGE_SWIPED, () => onChatEvent(false));
});
