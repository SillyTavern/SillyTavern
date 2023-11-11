import { characters, getAPIServerUrl, main_api, nai_settings, online_status, this_chid } from "../script.js";
import { power_user, registerDebugFunction } from "./power-user.js";
import { chat_completion_sources, model_list, oai_settings } from "./openai.js";
import { groups, selected_group } from "./group-chats.js";
import { getStringHash } from "./utils.js";
import { kai_flags } from "./kai-settings.js";
import { isMancer, textgenerationwebui_settings } from "./textgen-settings.js";

export const CHARACTERS_PER_TOKEN_RATIO = 3.35;
const TOKENIZER_WARNING_KEY = 'tokenizationWarningShown';

export const tokenizers = {
    NONE: 0,
    GPT2: 1,
    OPENAI: 2,
    LLAMA: 3,
    NERD: 4,
    NERD2: 5,
    API: 6,
    MISTRAL: 7,
    BEST_MATCH: 99,
};

const objectStore = new localforage.createInstance({ name: "SillyTavern_ChatCompletions" });

let tokenCache = {};

/**
 * Guesstimates the token count for a string.
 * @param {string} str String to tokenize.
 * @returns {number} Token count.
 */
export function guesstimate(str) {
    return Math.ceil(str.length / CHARACTERS_PER_TOKEN_RATIO);
}

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
        toastr.success('Token cache cleared. Please reload the chat to re-tokenize it.');
    } catch (e) {
        console.log('Chat Completions: unable to reset token cache', e);
    }
}

/**
 * Gets the friendly name of the current tokenizer.
 * @param {string} forApi API to get the tokenizer for. Defaults to the main API.
 * @returns { { tokenizerName: string, tokenizerId: number } } Tokenizer info
 */
export function getFriendlyTokenizerName(forApi) {
    if (!forApi) {
        forApi = main_api;
    }

    const tokenizerOption = $("#tokenizer").find(':selected');
    let tokenizerId = Number(tokenizerOption.val());
    let tokenizerName = tokenizerOption.text();

    if (forApi !== 'openai' && tokenizerId === tokenizers.BEST_MATCH) {
        tokenizerId = getTokenizerBestMatch(forApi);
        tokenizerName = $(`#tokenizer option[value="${tokenizerId}"]`).text();
    }

    tokenizerName = forApi == 'openai'
        ? getTokenizerModel()
        : tokenizerName;

    tokenizerId = forApi == 'openai'
        ? tokenizers.OPENAI
        : tokenizerId;

    return { tokenizerName, tokenizerId };
}

/**
 * Gets the best tokenizer for the current API.
 * @param {string} forApi API to get the tokenizer for. Defaults to the main API.
 * @returns {number} Tokenizer type.
 */
export function getTokenizerBestMatch(forApi) {
    if (!forApi) {
        forApi = main_api;
    }

    if (forApi === 'novel') {
        if (nai_settings.model_novel.includes('clio')) {
            return tokenizers.NERD;
        }
        if (nai_settings.model_novel.includes('kayra')) {
            return tokenizers.NERD2;
        }
    }
    if (forApi === 'kobold' || forApi === 'textgenerationwebui' || forApi === 'koboldhorde') {
        // Try to use the API tokenizer if possible:
        // - API must be connected
        // - Kobold must pass a version check
        // - Tokenizer haven't reported an error previously
        if (kai_flags.can_use_tokenization && !sessionStorage.getItem(TOKENIZER_WARNING_KEY) && online_status !== 'no_connection') {
            return tokenizers.API;
        }

        return tokenizers.LLAMA;
    }

    return tokenizers.NONE;
}

/**
 * Calls the underlying tokenizer model to the token count for a string.
 * @param {number} type Tokenizer type.
 * @param {string} str String to tokenize.
 * @param {number} padding Number of padding tokens.
 * @returns {number} Token count.
 */
function callTokenizer(type, str, padding) {
    switch (type) {
        case tokenizers.NONE:
            return guesstimate(str) + padding;
        case tokenizers.GPT2:
            return countTokensRemote('/api/tokenize/gpt2', str, padding);
        case tokenizers.LLAMA:
            return countTokensRemote('/api/tokenize/llama', str, padding);
        case tokenizers.NERD:
            return countTokensRemote('/api/tokenize/nerdstash', str, padding);
        case tokenizers.NERD2:
            return countTokensRemote('/api/tokenize/nerdstash_v2', str, padding);
        case tokenizers.MISTRAL:
            return countTokensRemote('/api/tokenize/mistral', str, padding);
        case tokenizers.API:
            return countTokensRemote('/tokenize_via_api', str, padding);
        default:
            console.warn("Unknown tokenizer type", type);
            return callTokenizer(tokenizers.NONE, str, padding);
    }
}

/**
 * Gets the token count for a string using the current model tokenizer.
 * @param {string} str String to tokenize
 * @param {number | undefined} padding Optional padding tokens. Defaults to 0.
 * @returns {number} Token count.
 */
export function getTokenCount(str, padding = undefined) {
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
        tokenizerType = getTokenizerBestMatch(main_api);
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

    const result = callTokenizer(tokenizerType, str, padding);

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

    const turbo0301Tokenizer = 'gpt-3.5-turbo-0301';
    const turboTokenizer = 'gpt-3.5-turbo';
    const gpt4Tokenizer = 'gpt-4';
    const gpt2Tokenizer = 'gpt2';
    const claudeTokenizer = 'claude';
    const llamaTokenizer = 'llama';
    const mistralTokenizer = 'mistral';

    // Assuming no one would use it for different models.. right?
    if (oai_settings.chat_completion_source == chat_completion_sources.SCALE) {
        return gpt4Tokenizer;
    }

    // Select correct tokenizer for WindowAI proxies
    if (oai_settings.chat_completion_source == chat_completion_sources.WINDOWAI && oai_settings.windowai_model) {
        if (oai_settings.windowai_model.includes('gpt-4')) {
            return gpt4Tokenizer;
        }
        else if (oai_settings.windowai_model.includes('gpt-3.5-turbo-0301')) {
            return turbo0301Tokenizer;
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
        const model = model_list.find(x => x.id === oai_settings.openrouter_model);

        if (model?.architecture?.tokenizer === 'Llama2') {
            return llamaTokenizer;
        }
        else if (model?.architecture?.tokenizer === 'Mistral') {
            return mistralTokenizer;
        }
        else if (oai_settings.openrouter_model.includes('gpt-4')) {
            return gpt4Tokenizer;
        }
        else if (oai_settings.openrouter_model.includes('gpt-3.5-turbo-0301')) {
            return turbo0301Tokenizer;
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
                url: shouldTokenizeAI21 ? '/api/tokenize/ai21' : `/api/tokenize/openai?model=${model}`,
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

function getRemoteTokenizationParams(str) {
    return {
        text: str,
        api: main_api,
        url: getAPIServerUrl(),
        legacy_api: main_api === 'textgenerationwebui' && textgenerationwebui_settings.legacy_api && !isMancer(),
    };
}

/**
 * Counts token using the remote server API.
 * @param {string} endpoint API endpoint.
 * @param {string} str String to tokenize.
 * @param {number} padding Number of padding tokens.
 * @returns {number} Token count with padding.
 */
function countTokensRemote(endpoint, str, padding) {
    let tokenCount = 0;

    jQuery.ajax({
        async: false,
        type: 'POST',
        url: endpoint,
        data: JSON.stringify(getRemoteTokenizationParams(str)),
        dataType: "json",
        contentType: "application/json",
        success: function (data) {
            if (typeof data.count === 'number') {
                tokenCount = data.count;
            } else {
                tokenCount = guesstimate(str);
                console.error("Error counting tokens");

                if (!sessionStorage.getItem(TOKENIZER_WARNING_KEY)) {
                    toastr.warning(
                        "Your selected API doesn't support the tokenization endpoint. Using estimated counts.",
                        "Error counting tokens",
                        { timeOut: 10000, preventDuplicates: true },
                    );

                    sessionStorage.setItem(TOKENIZER_WARNING_KEY, String(true));
                }
            }
        }
    });

    return tokenCount + padding;
}

/**
 * Calls the underlying tokenizer model to encode a string to tokens.
 * @param {string} endpoint API endpoint.
 * @param {string} str String to tokenize.
 * @param {string} model Tokenizer model.
 * @returns {number[]} Array of token ids.
 */
function getTextTokensRemote(endpoint, str, model = '') {
    if (model) {
        endpoint += `?model=${model}`;
    }

    let ids = [];
    jQuery.ajax({
        async: false,
        type: 'POST',
        url: endpoint,
        data: JSON.stringify(getRemoteTokenizationParams(str)),
        dataType: "json",
        contentType: "application/json",
        success: function (data) {
            ids = data.ids;

            // Don't want to break reverse compatibility, so sprinkle in some of the JS magic
            if (Array.isArray(data.chunks)) {
                Object.defineProperty(ids, 'chunks', { value: data.chunks });
            }
        }
    });
    return ids;
}

/**
 * Calls the underlying tokenizer model to decode token ids to text.
 * @param {string} endpoint API endpoint.
 * @param {number[]} ids Array of token ids
 */
function decodeTextTokensRemote(endpoint, ids) {
    let text = '';
    jQuery.ajax({
        async: false,
        type: 'POST',
        url: endpoint,
        data: JSON.stringify({ ids: ids }),
        dataType: "json",
        contentType: "application/json",
        success: function (data) {
            text = data.text;
        }
    });
    return text;
}

/**
 * Encodes a string to tokens using the remote server API.
 * @param {number} tokenizerType Tokenizer type.
 * @param {string} str String to tokenize.
 * @returns {number[]} Array of token ids.
 */
export function getTextTokens(tokenizerType, str) {
    switch (tokenizerType) {
        case tokenizers.GPT2:
            return getTextTokensRemote('/api/tokenize/gpt2', str);
        case tokenizers.LLAMA:
            return getTextTokensRemote('/api/tokenize/llama', str);
        case tokenizers.NERD:
            return getTextTokensRemote('/api/tokenize/nerdstash', str);
        case tokenizers.NERD2:
            return getTextTokensRemote('/api/tokenize/nerdstash_v2', str);
        case tokenizers.MISTRAL:
            return getTextTokensRemote('/api/tokenize/mistral', str);
        case tokenizers.OPENAI:
            const model = getTokenizerModel();
            return getTextTokensRemote('/api/tokenize/openai-encode', str, model);
        case tokenizers.API:
            return getTextTokensRemote('/tokenize_via_api', str);
        default:
            console.warn("Calling getTextTokens with unsupported tokenizer type", tokenizerType);
            return [];
    }
}

/**
 * Decodes token ids to text using the remote server API.
 * @param {number} tokenizerType Tokenizer type.
 * @param {number[]} ids Array of token ids
 */
export function decodeTextTokens(tokenizerType, ids) {
    switch (tokenizerType) {
        case tokenizers.GPT2:
            return decodeTextTokensRemote('/api/decode/gpt2', ids);
        case tokenizers.LLAMA:
            return decodeTextTokensRemote('/api/decode/llama', ids);
        case tokenizers.NERD:
            return decodeTextTokensRemote('/api/decode/nerdstash', ids);
        case tokenizers.NERD2:
            return decodeTextTokensRemote('/api/decode/nerdstash_v2', ids);
        case tokenizers.MISTRAL:
            return decodeTextTokensRemote('/api/decode/mistral', ids);
        default:
            console.warn("Calling decodeTextTokens with unsupported tokenizer type", tokenizerType);
            return '';
    }
}

export async function initTokenizers() {
    await loadTokenCache();
    registerDebugFunction('resetTokenCache', 'Reset token cache', 'Purges the calculated token counts. Use this if you want to force a full re-tokenization of all chats or suspect the token counts are wrong.', resetTokenCache);
}
