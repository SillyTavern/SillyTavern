import { characters, main_api, nai_settings, this_chid } from "../script.js";
import { power_user } from "./power-user.js";
import { encode } from "../lib/gpt-2-3-tokenizer/mod.js";
import { GPT3BrowserTokenizer } from "../lib/gpt-3-tokenizer/gpt3-tokenizer.js";
import { chat_completion_sources, oai_settings } from "./openai.js";
import { groups, selected_group } from "./group-chats.js";
import { getStringHash } from "./utils.js";

export const CHARACTERS_PER_TOKEN_RATIO = 3.35;

export const tokenizers = {
    NONE: 0,
    GPT3: 1,
    CLASSIC: 2,
    LLAMA: 3,
    NERD: 4,
    NERD2: 5,
    API: 6,
    BEST_MATCH: 99,
};

const objectStore = new localforage.createInstance({ name: "SillyTavern_ChatCompletions" });
const gpt3 = new GPT3BrowserTokenizer({ type: 'gpt3' });

let tokenCache = {};

async function loadTokenCache() {
    try {
        console.debug('Chat Completions: loading token cache')
        tokenCache = await objectStore.getItem('tokenCache') || {};
    } catch (e) {
        console.log('Chat Completions: unable to load token cache, using default value', e);
        tokenCache = {};
    }
}

export async function saveTokenCache() {
    try {
        console.debug('Chat Completions: saving token cache')
        await objectStore.setItem('tokenCache', tokenCache);
    } catch (e) {
        console.log('Chat Completions: unable to save token cache', e);
    }
}

async function resetTokenCache() {
    try {
        console.debug('Chat Completions: resetting token cache');
        Object.keys(tokenCache).forEach(key => delete tokenCache[key]);
        await objectStore.removeItem('tokenCache');
    } catch (e) {
        console.log('Chat Completions: unable to reset token cache', e);
    }
}

window['resetTokenCache'] = resetTokenCache;

function getTokenizerBestMatch() {
    if (main_api === 'novel') {
        if (nai_settings.model_novel.includes('krake') || nai_settings.model_novel.includes('euterpe')) {
            return tokenizers.CLASSIC;
        }
        if (nai_settings.model_novel.includes('clio')) {
            return tokenizers.NERD;
        }
        if (nai_settings.model_novel.includes('kayra')) {
            return tokenizers.NERD2;
        }
    }
    if (main_api === 'kobold' || main_api === 'textgenerationwebui' || main_api === 'koboldhorde') {
        return tokenizers.LLAMA;
    }

    return tokenizers.NONE;
}

/**
 * Gets the token count for a string using the current model tokenizer.
 * @param {string} str String to tokenize
 * @param {number | undefined} padding Optional padding tokens. Defaults to 0.
 * @returns {number} Token count.
 */
export function getTokenCount(str, padding = undefined) {
    /**
     * Calculates the token count for a string.
     * @param {number} [type] Tokenizer type.
     * @returns {number} Token count.
     */
    function calculate(type) {
        switch (type) {
            case tokenizers.NONE:
                return Math.ceil(str.length / CHARACTERS_PER_TOKEN_RATIO) + padding;
            case tokenizers.GPT3:
                return gpt3.encode(str).bpe.length + padding;
            case tokenizers.CLASSIC:
                return encode(str).length + padding;
            case tokenizers.LLAMA:
                return countTokensRemote('/tokenize_llama', str, padding);
            case tokenizers.NERD:
                return countTokensRemote('/tokenize_nerdstash', str, padding);
            case tokenizers.NERD2:
                return countTokensRemote('/tokenize_nerdstash_v2', str, padding);
            case tokenizers.API:
                return countTokensRemote('/tokenize_via_api', str, padding);
            default:
                console.warn("Unknown tokenizer type", type);
                return calculate(tokenizers.NONE);
        }
    }

    if (typeof str !== 'string' || !str?.length) {
        return 0;
    }

    let tokenizerType = power_user.tokenizer;

    if (main_api === 'openai') {
        if (padding === power_user.token_padding) {
            // For main "shadow" prompt building
            tokenizerType = tokenizers.NONE;
        } else {
            // For extensions and WI
            return counterWrapperOpenAI(str);
        }
    }

    if (tokenizerType === tokenizers.BEST_MATCH) {
        tokenizerType = getTokenizerBestMatch();
    }

    if (padding === undefined) {
        padding = 0;
    }

    const cacheObject = getTokenCacheObject();
    const hash = getStringHash(str);
    const cacheKey = `${tokenizerType}-${hash}+${padding}`;

    if (typeof cacheObject[cacheKey] === 'number') {
        return cacheObject[cacheKey];
    }

    const result = calculate(tokenizerType);

    if (isNaN(result)) {
        console.warn("Token count calculation returned NaN");
        return 0;
    }

    cacheObject[cacheKey] = result;
    return result;
}

/**
 * Gets the token count for a string using the OpenAI tokenizer.
 * @param {string} text Text to tokenize.
 * @returns {number} Token count.
 */
function counterWrapperOpenAI(text) {
    const message = { role: 'system', content: text };
    return countTokensOpenAI(message, true);
}

export function getTokenizerModel() {
    // OpenAI models always provide their own tokenizer
    if (oai_settings.chat_completion_source == chat_completion_sources.OPENAI) {
        return oai_settings.openai_model;
    }

    const turboTokenizer = 'gpt-3.5-turbo';
    const gpt4Tokenizer = 'gpt-4';
    const gpt2Tokenizer = 'gpt2';
    const claudeTokenizer = 'claude';

    // Assuming no one would use it for different models.. right?
    if (oai_settings.chat_completion_source == chat_completion_sources.SCALE) {
        return gpt4Tokenizer;
    }

    // Select correct tokenizer for WindowAI proxies
    if (oai_settings.chat_completion_source == chat_completion_sources.WINDOWAI && oai_settings.windowai_model) {
        if (oai_settings.windowai_model.includes('gpt-4')) {
            return gpt4Tokenizer;
        }
        else if (oai_settings.windowai_model.includes('gpt-3.5-turbo')) {
            return turboTokenizer;
        }
        else if (oai_settings.windowai_model.includes('claude')) {
            return claudeTokenizer;
        }
        else if (oai_settings.windowai_model.includes('GPT-NeoXT')) {
            return gpt2Tokenizer;
        }
    }

    // And for OpenRouter (if not a site model, then it's impossible to determine the tokenizer)
    if (oai_settings.chat_completion_source == chat_completion_sources.OPENROUTER && oai_settings.openrouter_model) {
        if (oai_settings.openrouter_model.includes('gpt-4')) {
            return gpt4Tokenizer;
        }
        else if (oai_settings.openrouter_model.includes('gpt-3.5-turbo')) {
            return turboTokenizer;
        }
        else if (oai_settings.openrouter_model.includes('claude')) {
            return claudeTokenizer;
        }
        else if (oai_settings.openrouter_model.includes('GPT-NeoXT')) {
            return gpt2Tokenizer;
        }
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.CLAUDE) {
        return claudeTokenizer;
    }

    // Default to Turbo 3.5
    return turboTokenizer;
}

/**
 * @param {any[] | Object} messages
 */
export function countTokensOpenAI(messages, full = false) {
    const shouldTokenizeAI21 = oai_settings.chat_completion_source === chat_completion_sources.AI21 && oai_settings.use_ai21_tokenizer;
    const cacheObject = getTokenCacheObject();

    if (!Array.isArray(messages)) {
        messages = [messages];
    }

    let token_count = -1;

    for (const message of messages) {
        const model = getTokenizerModel();

        if (model === 'claude' || shouldTokenizeAI21) {
            full = true;
        }

        const hash = getStringHash(JSON.stringify(message));
        const cacheKey = `${model}-${hash}`;
        const cachedCount = cacheObject[cacheKey];

        if (typeof cachedCount === 'number') {
            token_count += cachedCount;
        }

        else {
            jQuery.ajax({
                async: false,
                type: 'POST', //
                url: shouldTokenizeAI21 ? '/tokenize_ai21' : `/tokenize_openai?model=${model}`,
                data: JSON.stringify([message]),
                dataType: "json",
                contentType: "application/json",
                success: function (data) {
                    token_count += Number(data.token_count);
                    cacheObject[cacheKey] = Number(data.token_count);
                }
            });
        }
    }

    if (!full) token_count -= 2;

    return token_count;
}

/**
 * Gets the token cache object for the current chat.
 * @returns {Object} Token cache object for the current chat.
 */
function getTokenCacheObject() {
    let chatId = 'undefined';

    try {
        if (selected_group) {
            chatId = groups.find(x => x.id == selected_group)?.chat_id;
        }
        else if (this_chid !== undefined) {
            chatId = characters[this_chid].chat;
        }
    } catch {
        console.log('No character / group selected. Using default cache item');
    }

    if (typeof tokenCache[chatId] !== 'object') {
        tokenCache[chatId] = {};
    }

    return tokenCache[String(chatId)];
}

function countTokensRemote(endpoint, str, padding) {
    let tokenCount = 0;
    jQuery.ajax({
        async: false,
        type: 'POST',
        url: endpoint,
        data: JSON.stringify({ text: str }),
        dataType: "json",
        contentType: "application/json",
        success: function (data) {
            tokenCount = data.count;
        }
    });
    return tokenCount + padding;
}

function getTextTokensRemote(endpoint, str) {
    let ids = [];
    jQuery.ajax({
        async: false,
        type: 'POST',
        url: endpoint,
        data: JSON.stringify({ text: str }),
        dataType: "json",
        contentType: "application/json",
        success: function (data) {
            ids = data.ids;
        }
    });
    return ids;
}

export function getTextTokens(tokenizerType, str) {
    switch (tokenizerType) {
        case tokenizers.LLAMA:
            return getTextTokensRemote('/tokenize_llama', str);
        case tokenizers.NERD:
            return getTextTokensRemote('/tokenize_nerdstash', str);
        case tokenizers.NERD2:
            return getTextTokensRemote('/tokenize_nerdstash_v2', str);
        default:
            console.warn("Calling getTextTokens with unsupported tokenizer type", tokenizerType);
            return [];
    }
}

jQuery(async () => {
    await loadTokenCache();
});
