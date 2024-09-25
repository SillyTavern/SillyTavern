import { characters, main_api, api_server, nai_settings, online_status, this_chid } from '../script.js';
import { power_user, registerDebugFunction } from './power-user.js';
import { chat_completion_sources, model_list, oai_settings } from './openai.js';
import { groups, selected_group } from './group-chats.js';
import { getStringHash } from './utils.js';
import { kai_flags } from './kai-settings.js';
import { textgen_types, textgenerationwebui_settings as textgen_settings, getTextGenServer, getTextGenModel } from './textgen-settings.js';
import { getCurrentDreamGenModelTokenizer, getCurrentOpenRouterModelTokenizer, openRouterModels } from './textgen-models.js';

const { OOBA, TABBY, KOBOLDCPP, VLLM, APHRODITE, LLAMACPP, OPENROUTER, DREAMGEN } = textgen_types;

export const CHARACTERS_PER_TOKEN_RATIO = 3.35;
export const TOKENIZER_WARNING_KEY = 'tokenizationWarningShown';
export const TOKENIZER_SUPPORTED_KEY = 'tokenizationSupported';

export const tokenizers = {
    NONE: 0,
    GPT2: 1,
    OPENAI: 2,
    LLAMA: 3,
    NERD: 4,
    NERD2: 5,
    API_CURRENT: 6,
    MISTRAL: 7,
    YI: 8,
    API_TEXTGENERATIONWEBUI: 9,
    API_KOBOLD: 10,
    CLAUDE: 11,
    LLAMA3: 12,
    GEMMA: 13,
    JAMBA: 14,
    QWEN2: 15,
    COMMAND_R: 16,
    NEMO: 17,
    BEST_MATCH: 99,
};

// A list of local tokenizers that support encoding and decoding token ids.
export const ENCODE_TOKENIZERS = [
    tokenizers.LLAMA,
    tokenizers.MISTRAL,
    tokenizers.YI,
    tokenizers.LLAMA3,
    tokenizers.GEMMA,
    tokenizers.JAMBA,
    tokenizers.QWEN2,
    tokenizers.COMMAND_R,
    tokenizers.NEMO,
    // uncomment when NovelAI releases Kayra and Clio weights, lol
    //tokenizers.NERD,
    //tokenizers.NERD2,
];

// A list of Text Completion sources that support remote tokenization.
export const TEXTGEN_TOKENIZERS = [OOBA, TABBY, KOBOLDCPP, LLAMACPP, VLLM, APHRODITE];

const TOKENIZER_URLS = {
    [tokenizers.GPT2]: {
        encode: '/api/tokenizers/gpt2/encode',
        decode: '/api/tokenizers/gpt2/decode',
        count: '/api/tokenizers/gpt2/encode',
    },
    [tokenizers.OPENAI]: {
        encode: '/api/tokenizers/openai/encode',
        decode: '/api/tokenizers/openai/decode',
        count: '/api/tokenizers/openai/encode',
    },
    [tokenizers.LLAMA]: {
        encode: '/api/tokenizers/llama/encode',
        decode: '/api/tokenizers/llama/decode',
        count: '/api/tokenizers/llama/encode',
    },
    [tokenizers.NERD]: {
        encode: '/api/tokenizers/nerdstash/encode',
        decode: '/api/tokenizers/nerdstash/decode',
        count: '/api/tokenizers/nerdstash/encode',
    },
    [tokenizers.NERD2]: {
        encode: '/api/tokenizers/nerdstash_v2/encode',
        decode: '/api/tokenizers/nerdstash_v2/decode',
        count: '/api/tokenizers/nerdstash_v2/encode',
    },
    [tokenizers.API_KOBOLD]: {
        count: '/api/tokenizers/remote/kobold/count',
        encode: '/api/tokenizers/remote/kobold/count',
    },
    [tokenizers.MISTRAL]: {
        encode: '/api/tokenizers/mistral/encode',
        decode: '/api/tokenizers/mistral/decode',
        count: '/api/tokenizers/mistral/encode',
    },
    [tokenizers.YI]: {
        encode: '/api/tokenizers/yi/encode',
        decode: '/api/tokenizers/yi/decode',
        count: '/api/tokenizers/yi/encode',
    },
    [tokenizers.CLAUDE]: {
        encode: '/api/tokenizers/claude/encode',
        decode: '/api/tokenizers/claude/decode',
        count: '/api/tokenizers/claude/encode',
    },
    [tokenizers.LLAMA3]: {
        encode: '/api/tokenizers/llama3/encode',
        decode: '/api/tokenizers/llama3/decode',
        count: '/api/tokenizers/llama3/encode',
    },
    [tokenizers.GEMMA]: {
        encode: '/api/tokenizers/gemma/encode',
        decode: '/api/tokenizers/gemma/decode',
        count: '/api/tokenizers/gemma/encode',
    },
    [tokenizers.JAMBA]: {
        encode: '/api/tokenizers/jamba/encode',
        decode: '/api/tokenizers/jamba/decode',
        count: '/api/tokenizers/jamba/encode',
    },
    [tokenizers.QWEN2]: {
        encode: '/api/tokenizers/qwen2/encode',
        decode: '/api/tokenizers/qwen2/decode',
        count: '/api/tokenizers/qwen2/encode',
    },
    [tokenizers.COMMAND_R]: {
        encode: '/api/tokenizers/command-r/encode',
        decode: '/api/tokenizers/command-r/decode',
        count: '/api/tokenizers/command-r/encode',
    },
    [tokenizers.NEMO]: {
        encode: '/api/tokenizers/nemo/encode',
        decode: '/api/tokenizers/nemo/decode',
        count: '/api/tokenizers/nemo/encode',
    },
    [tokenizers.API_TEXTGENERATIONWEBUI]: {
        encode: '/api/tokenizers/remote/textgenerationwebui/encode',
        count: '/api/tokenizers/remote/textgenerationwebui/encode',
    },
};

const objectStore = new localforage.createInstance({ name: 'SillyTavern_ChatCompletions' });

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
        console.debug('Chat Completions: loading token cache');
        tokenCache = await objectStore.getItem('tokenCache') || {};
    } catch (e) {
        console.log('Chat Completions: unable to load token cache, using default value', e);
        tokenCache = {};
    }
}

export async function saveTokenCache() {
    try {
        console.debug('Chat Completions: saving token cache');
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
 * @typedef {object} Tokenizer
 * @property {number} tokenizerId - The id of the tokenizer option
 * @property {string} tokenizerKey - Internal name/key of the tokenizer
 * @property {string} tokenizerName - Human-readable detailed name of the tokenizer (as displayed in the UI)
 */

/**
 * Gets all tokenizers available to the user.
 * @returns {Tokenizer[]} Tokenizer info.
 */
export function getAvailableTokenizers() {
    const tokenizerOptions = $('#tokenizer').find('option').toArray();
    return tokenizerOptions.map(tokenizerOption => ({
        tokenizerId: Number(tokenizerOption.value),
        tokenizerKey: Object.entries(tokenizers).find(([_, value]) => value === Number(tokenizerOption.value))[0].toLocaleLowerCase(),
        tokenizerName: tokenizerOption.text,
    }));
}

/**
 * Selects tokenizer if not already selected.
 * @param {number} tokenizerId Tokenizer ID.
 */
export function selectTokenizer(tokenizerId) {
    if (tokenizerId !== power_user.tokenizer) {
        const tokenizer = getAvailableTokenizers().find(tokenizer => tokenizer.tokenizerId === tokenizerId);
        if (!tokenizer) {
            console.warn('Failed to find tokenizer with id', tokenizerId);
            return;
        }
        $('#tokenizer').val(tokenizer.tokenizerId).trigger('change');
        toastr.info(`Tokenizer: "${tokenizer.tokenizerName}" selected`);
    }
}

/**
 * Gets the friendly name of the current tokenizer.
 * @param {string} forApi API to get the tokenizer for. Defaults to the main API.
 * @returns {Tokenizer} Tokenizer info
 */
export function getFriendlyTokenizerName(forApi) {
    if (!forApi) {
        forApi = main_api;
    }

    const tokenizerOption = $('#tokenizer').find(':selected');
    let tokenizerId = Number(tokenizerOption.val());
    let tokenizerName = tokenizerOption.text();

    if (forApi !== 'openai' && tokenizerId === tokenizers.BEST_MATCH) {
        tokenizerId = getTokenizerBestMatch(forApi);

        switch (tokenizerId) {
            case tokenizers.API_KOBOLD:
                tokenizerName = 'API (KoboldAI Classic)';
                break;
            case tokenizers.API_TEXTGENERATIONWEBUI:
                tokenizerName = 'API (Text Completion)';
                break;
            default:
                tokenizerName = $(`#tokenizer option[value="${tokenizerId}"]`).text();
                break;
        }
    }

    tokenizerName = forApi == 'openai'
        ? getTokenizerModel()
        : tokenizerName;

    tokenizerId = forApi == 'openai'
        ? tokenizers.OPENAI
        : tokenizerId;

    const tokenizerKey = Object.entries(tokenizers).find(([_, value]) => value === tokenizerId)[0].toLocaleLowerCase();

    return { tokenizerName, tokenizerKey, tokenizerId };
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
        if (nai_settings.model_novel.includes('erato')) {
            return tokenizers.LLAMA3;
        }
    }
    if (forApi === 'kobold' || forApi === 'textgenerationwebui' || forApi === 'koboldhorde') {
        // Try to use the API tokenizer if possible:
        // - API must be connected
        // - Kobold must pass a version check
        // - Tokenizer haven't reported an error previously
        const hasTokenizerError = sessionStorage.getItem(TOKENIZER_WARNING_KEY);
        const hasValidEndpoint = sessionStorage.getItem(TOKENIZER_SUPPORTED_KEY);
        const isConnected = online_status !== 'no_connection';
        const isTokenizerSupported = TEXTGEN_TOKENIZERS.includes(textgen_settings.type) && (textgen_settings.type !== OOBA || hasValidEndpoint);

        if (!hasTokenizerError && isConnected) {
            if (forApi === 'kobold' && kai_flags.can_use_tokenization) {
                return tokenizers.API_KOBOLD;
            }

            if (forApi === 'textgenerationwebui' && isTokenizerSupported) {
                return tokenizers.API_TEXTGENERATIONWEBUI;
            }
            if (forApi === 'textgenerationwebui' && textgen_settings.type === OPENROUTER) {
                return getCurrentOpenRouterModelTokenizer();
            }
            if (forApi === 'textgenerationwebui' && textgen_settings.type === DREAMGEN) {
                return getCurrentDreamGenModelTokenizer();
            }
        }

        if (forApi === 'textgenerationwebui') {
            const model = String(getTextGenModel() || online_status).toLowerCase();
            if (model.includes('llama3') || model.includes('llama-3')) {
                return tokenizers.LLAMA3;
            }
            if (model.includes('mistral') || model.includes('mixtral')) {
                return tokenizers.MISTRAL;
            }
            if (model.includes('gemma')) {
                return tokenizers.GEMMA;
            }
            if (model.includes('yi')) {
                return tokenizers.YI;
            }
            if (model.includes('jamba')) {
                return tokenizers.JAMBA;
            }
            if (model.includes('command-r')) {
                return tokenizers.COMMAND_R;
            }
            if (model.includes('qwen2')) {
                return tokenizers.QWEN2;
            }
        }

        return tokenizers.LLAMA;
    }

    return tokenizers.NONE;
}

// Get the current remote tokenizer API based on the current text generation API.
function currentRemoteTokenizerAPI() {
    switch (main_api) {
        case 'kobold':
            return tokenizers.API_KOBOLD;
        case 'textgenerationwebui':
            return tokenizers.API_TEXTGENERATIONWEBUI;
        default:
            return tokenizers.NONE;
    }
}

/**
 * Calls the underlying tokenizer model to the token count for a string.
 * @param {number} type Tokenizer type.
 * @param {string} str String to tokenize.
 * @returns {number} Token count.
 */
function callTokenizer(type, str) {
    if (type === tokenizers.NONE) return guesstimate(str);

    switch (type) {
        case tokenizers.API_CURRENT:
            return callTokenizer(currentRemoteTokenizerAPI(), str);
        case tokenizers.API_KOBOLD:
            return countTokensFromKoboldAPI(str);
        case tokenizers.API_TEXTGENERATIONWEBUI:
            return countTokensFromTextgenAPI(str);
        default: {
            const endpointUrl = TOKENIZER_URLS[type]?.count;
            if (!endpointUrl) {
                console.warn('Unknown tokenizer type', type);
                return apiFailureTokenCount(str);
            }
            return countTokensFromServer(endpointUrl, str);
        }
    }
}

/**
 * Calls the underlying tokenizer model to the token count for a string.
 * @param {number} type Tokenizer type.
 * @param {string} str String to tokenize.
 * @returns {Promise<number>} Token count.
 */
function callTokenizerAsync(type, str) {
    return new Promise(resolve => {
        if (type === tokenizers.NONE) {
            return resolve(guesstimate(str));
        }

        switch (type) {
            case tokenizers.API_CURRENT:
                return callTokenizerAsync(currentRemoteTokenizerAPI(), str).then(resolve);
            case tokenizers.API_KOBOLD:
                return countTokensFromKoboldAPI(str, resolve);
            case tokenizers.API_TEXTGENERATIONWEBUI:
                return countTokensFromTextgenAPI(str, resolve);
            default: {
                const endpointUrl = TOKENIZER_URLS[type]?.count;
                if (!endpointUrl) {
                    console.warn('Unknown tokenizer type', type);
                    return resolve(apiFailureTokenCount(str));
                }
                return countTokensFromServer(endpointUrl, str, resolve);
            }
        }
    });
}

/**
 * Gets the token count for a string using the current model tokenizer.
 * @param {string} str String to tokenize
 * @param {number | undefined} padding Optional padding tokens. Defaults to 0.
 * @returns {Promise<number>} Token count.
 */
export async function getTokenCountAsync(str, padding = undefined) {
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
            return counterWrapperOpenAIAsync(str);
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

    const result = (await callTokenizerAsync(tokenizerType, str)) + padding;

    if (isNaN(result)) {
        console.warn('Token count calculation returned NaN');
        return 0;
    }

    cacheObject[cacheKey] = result;
    return result;
}

/**
 * Gets the token count for a string using the current model tokenizer.
 * @param {string} str String to tokenize
 * @param {number | undefined} padding Optional padding tokens. Defaults to 0.
 * @returns {number} Token count.
 * @deprecated Use getTokenCountAsync instead.
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

    const result = callTokenizer(tokenizerType, str) + padding;

    if (isNaN(result)) {
        console.warn('Token count calculation returned NaN');
        return 0;
    }

    cacheObject[cacheKey] = result;
    return result;
}

/**
 * Gets the token count for a string using the OpenAI tokenizer.
 * @param {string} text Text to tokenize.
 * @returns {number} Token count.
 * @deprecated Use counterWrapperOpenAIAsync instead.
 */
function counterWrapperOpenAI(text) {
    const message = { role: 'system', content: text };
    return countTokensOpenAI(message, true);
}

/**
 * Gets the token count for a string using the OpenAI tokenizer.
 * @param {string} text Text to tokenize.
 * @returns {Promise<number>} Token count.
 */
function counterWrapperOpenAIAsync(text) {
    const message = { role: 'system', content: text };
    return countTokensOpenAIAsync(message, true);
}

export function getTokenizerModel() {
    // OpenAI models always provide their own tokenizer
    if (oai_settings.chat_completion_source == chat_completion_sources.OPENAI) {
        return oai_settings.openai_model;
    }

    const turbo0301Tokenizer = 'gpt-3.5-turbo-0301';
    const turboTokenizer = 'gpt-3.5-turbo';
    const gpt4Tokenizer = 'gpt-4';
    const gpt4oTokenizer = 'gpt-4o';
    const gpt2Tokenizer = 'gpt2';
    const claudeTokenizer = 'claude';
    const llamaTokenizer = 'llama';
    const llama3Tokenizer = 'llama3';
    const mistralTokenizer = 'mistral';
    const yiTokenizer = 'yi';
    const gemmaTokenizer = 'gemma';
    const jambaTokenizer = 'jamba';
    const qwen2Tokenizer = 'qwen2';
    const commandRTokenizer = 'command-r';
    const nemoTokenizer = 'nemo';

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
    if (main_api == 'openai' && oai_settings.chat_completion_source == chat_completion_sources.OPENROUTER && oai_settings.openrouter_model ||
        main_api == 'textgenerationwebui' && textgen_settings.type === OPENROUTER && textgen_settings.openrouter_model) {
        const model = main_api == 'openai'
            ? model_list.find(x => x.id === oai_settings.openrouter_model)
            : openRouterModels.find(x => x.id === textgen_settings.openrouter_model);

        if (model?.architecture?.tokenizer === 'Llama2') {
            return llamaTokenizer;
        }
        else if (model?.architecture?.tokenizer === 'Llama3') {
            return llama3Tokenizer;
        }
        else if (model?.architecture?.tokenizer === 'Mistral') {
            return mistralTokenizer;
        }
        else if (model?.architecture?.tokenizer === 'Yi') {
            return yiTokenizer;
        }
        else if (model?.architecture?.tokenizer === 'Gemini') {
            return gemmaTokenizer;
        }
        else if (model?.architecture?.tokenizer === 'Qwen') {
            return qwen2Tokenizer;
        }
        else if (model?.architecture?.tokenizer === 'Cohere') {
            return commandRTokenizer;
        }
        else if (oai_settings.openrouter_model.includes('gpt-4o')) {
            return gpt4oTokenizer;
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
        else if (oai_settings.openrouter_model.includes('jamba')) {
            return jambaTokenizer;
        }
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.COHERE) {
        return commandRTokenizer;
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.MAKERSUITE) {
        return gemmaTokenizer;
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.AI21) {
        return jambaTokenizer;
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.CLAUDE) {
        return claudeTokenizer;
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.MISTRALAI) {
        if (oai_settings.mistralai_model.includes('nemo') || oai_settings.mistralai_model.includes('pixtral')) {
            return nemoTokenizer;
        }
        return mistralTokenizer;
    }

    if (oai_settings.chat_completion_source == chat_completion_sources.CUSTOM) {
        return oai_settings.custom_model;
    }

    if (oai_settings.chat_completion_source === chat_completion_sources.PERPLEXITY)  {
        if (oai_settings.perplexity_model.includes('llama-3') || oai_settings.perplexity_model.includes('llama3')) {
            return llama3Tokenizer;
        }
        if (oai_settings.perplexity_model.includes('llama')) {
            return llamaTokenizer;
        }
        if (oai_settings.perplexity_model.includes('mistral') || oai_settings.perplexity_model.includes('mixtral')) {
            return mistralTokenizer;
        }
    }

    if (oai_settings.chat_completion_source === chat_completion_sources.GROQ) {
        if (oai_settings.groq_model.includes('llama-3') || oai_settings.groq_model.includes('llama3')) {
            return llama3Tokenizer;
        }
        if (oai_settings.groq_model.includes('mistral') || oai_settings.groq_model.includes('mixtral')) {
            return mistralTokenizer;
        }
        if (oai_settings.groq_model.includes('gemma')) {
            return gemmaTokenizer;
        }
    }

    if (oai_settings.chat_completion_source === chat_completion_sources.ZEROONEAI) {
        return yiTokenizer;
    }

    if (oai_settings.chat_completion_source === chat_completion_sources.BLOCKENTROPY)  {
        if (oai_settings.blockentropy_model.includes('llama3')) {
            return llama3Tokenizer;
        }
        if (oai_settings.blockentropy_model.includes('miqu') || oai_settings.blockentropy_model.includes('mixtral')) {
            return mistralTokenizer;
        }
    }

    // Default to Turbo 3.5
    return turboTokenizer;
}

/**
 * @param {any[] | Object} messages
 * @deprecated Use countTokensOpenAIAsync instead.
 */
export function countTokensOpenAI(messages, full = false) {
    const tokenizerEndpoint = `/api/tokenizers/openai/count?model=${getTokenizerModel()}`;
    const cacheObject = getTokenCacheObject();

    if (!Array.isArray(messages)) {
        messages = [messages];
    }

    let token_count = -1;

    for (const message of messages) {
        const model = getTokenizerModel();

        if (model === 'claude') {
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
                url: tokenizerEndpoint,
                data: JSON.stringify([message]),
                dataType: 'json',
                contentType: 'application/json',
                success: function (data) {
                    token_count += Number(data.token_count);
                    cacheObject[cacheKey] = Number(data.token_count);
                },
            });
        }
    }

    if (!full) token_count -= 2;

    return token_count;
}

/**
 * Returns the token count for a message using the OpenAI tokenizer.
 * @param {object[]|object} messages
 * @param {boolean} full
 * @returns {Promise<number>} Token count.
 */
export async function countTokensOpenAIAsync(messages, full = false) {
    const tokenizerEndpoint = `/api/tokenizers/openai/count?model=${getTokenizerModel()}`;
    const cacheObject = getTokenCacheObject();

    if (!Array.isArray(messages)) {
        messages = [messages];
    }

    let token_count = -1;

    for (const message of messages) {
        const model = getTokenizerModel();

        if (model === 'claude') {
            full = true;
        }

        const hash = getStringHash(JSON.stringify(message));
        const cacheKey = `${model}-${hash}`;
        const cachedCount = cacheObject[cacheKey];

        if (typeof cachedCount === 'number') {
            token_count += cachedCount;
        }

        else {
            const data = await jQuery.ajax({
                async: true,
                type: 'POST', //
                url: tokenizerEndpoint,
                data: JSON.stringify([message]),
                dataType: 'json',
                contentType: 'application/json',
            });

            token_count += Number(data.token_count);
            cacheObject[cacheKey] = Number(data.token_count);
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

/**
 * Count tokens using the server API.
 * @param {string} endpoint API endpoint.
 * @param {string} str String to tokenize.
 * @param {function} [resolve] Promise resolve function.s
 * @returns {number} Token count.
 */
function countTokensFromServer(endpoint, str, resolve) {
    const isAsync = typeof resolve === 'function';
    let tokenCount = 0;

    jQuery.ajax({
        async: isAsync,
        type: 'POST',
        url: endpoint,
        data: JSON.stringify({ text: str }),
        dataType: 'json',
        contentType: 'application/json',
        success: function (data) {
            if (typeof data.count === 'number') {
                tokenCount = data.count;
            } else {
                tokenCount = apiFailureTokenCount(str);
            }

            isAsync && resolve(tokenCount);
        },
    });

    return tokenCount;
}

/**
 * Count tokens using the AI provider's API.
 * @param {string} str String to tokenize.
 * @param {function} [resolve] Promise resolve function.
 * @returns {number} Token count.
 */
function countTokensFromKoboldAPI(str, resolve) {
    const isAsync = typeof resolve === 'function';
    let tokenCount = 0;

    jQuery.ajax({
        async: isAsync,
        type: 'POST',
        url: TOKENIZER_URLS[tokenizers.API_KOBOLD].count,
        data: JSON.stringify({
            text: str,
            url: api_server,
        }),
        dataType: 'json',
        contentType: 'application/json',
        success: function (data) {
            if (typeof data.count === 'number') {
                tokenCount = data.count;
            } else {
                tokenCount = apiFailureTokenCount(str);
            }

            isAsync && resolve(tokenCount);
        },
    });

    return tokenCount;
}

function getTextgenAPITokenizationParams(str) {
    return {
        text: str,
        api_type: textgen_settings.type,
        url: getTextGenServer(),
        legacy_api: textgen_settings.legacy_api && textgen_settings.type === OOBA,
        vllm_model: textgen_settings.vllm_model,
        aphrodite_model: textgen_settings.aphrodite_model,
    };
}

/**
 * Count tokens using the AI provider's API.
 * @param {string} str String to tokenize.
 * @param {function} [resolve] Promise resolve function.
 * @returns {number} Token count.
 */
function countTokensFromTextgenAPI(str, resolve) {
    const isAsync = typeof resolve === 'function';
    let tokenCount = 0;

    jQuery.ajax({
        async: isAsync,
        type: 'POST',
        url: TOKENIZER_URLS[tokenizers.API_TEXTGENERATIONWEBUI].count,
        data: JSON.stringify(getTextgenAPITokenizationParams(str)),
        dataType: 'json',
        contentType: 'application/json',
        success: function (data) {
            if (typeof data.count === 'number') {
                tokenCount = data.count;
            } else {
                tokenCount = apiFailureTokenCount(str);
            }

            isAsync && resolve(tokenCount);
        },
    });

    return tokenCount;
}

function apiFailureTokenCount(str) {
    console.error('Error counting tokens');
    let shouldTryAgain = false;

    if (!sessionStorage.getItem(TOKENIZER_WARNING_KEY)) {
        const bestMatchBefore = getTokenizerBestMatch(main_api);
        sessionStorage.setItem(TOKENIZER_WARNING_KEY, String(true));
        const bestMatchAfter = getTokenizerBestMatch(main_api);
        if ([tokenizers.API_TEXTGENERATIONWEBUI, tokenizers.API_KOBOLD].includes(bestMatchBefore) && bestMatchBefore !== bestMatchAfter) {
            shouldTryAgain = true;
        }
    }

    // Only try again if we guarantee not to be looped by the same error
    if (shouldTryAgain && power_user.tokenizer === tokenizers.BEST_MATCH) {
        return getTokenCount(str);
    }

    return guesstimate(str);
}

/**
 * Calls the underlying tokenizer model to encode a string to tokens.
 * @param {string} endpoint API endpoint.
 * @param {string} str String to tokenize.
 * @param {function} [resolve] Promise resolve function.
 * @returns {number[]} Array of token ids.
 */
function getTextTokensFromServer(endpoint, str, resolve) {
    const isAsync = typeof resolve === 'function';
    let ids = [];
    jQuery.ajax({
        async: isAsync,
        type: 'POST',
        url: endpoint,
        data: JSON.stringify({ text: str }),
        dataType: 'json',
        contentType: 'application/json',
        success: function (data) {
            ids = data.ids;

            // Don't want to break reverse compatibility, so sprinkle in some of the JS magic
            if (Array.isArray(data.chunks)) {
                Object.defineProperty(ids, 'chunks', { value: data.chunks });
            }

            isAsync && resolve(ids);
        },
    });
    return ids;
}

/**
 * Calls the AI provider's tokenize API to encode a string to tokens.
 * @param {string} str String to tokenize.
 * @param {function} [resolve] Promise resolve function.
 * @returns {number[]} Array of token ids.
 */
function getTextTokensFromTextgenAPI(str, resolve) {
    const isAsync = typeof resolve === 'function';
    let ids = [];
    jQuery.ajax({
        async: isAsync,
        type: 'POST',
        url: TOKENIZER_URLS[tokenizers.API_TEXTGENERATIONWEBUI].encode,
        data: JSON.stringify(getTextgenAPITokenizationParams(str)),
        dataType: 'json',
        contentType: 'application/json',
        success: function (data) {
            ids = data.ids;
            isAsync && resolve(ids);
        },
    });
    return ids;
}

/**
 * Calls the AI provider's tokenize API to encode a string to tokens.
 * @param {string} str String to tokenize.
 * @param {function} [resolve] Promise resolve function.
 * @returns {number[]} Array of token ids.
 */
function getTextTokensFromKoboldAPI(str, resolve) {
    const isAsync = typeof resolve === 'function';
    let ids = [];

    jQuery.ajax({
        async: isAsync,
        type: 'POST',
        url: TOKENIZER_URLS[tokenizers.API_KOBOLD].encode,
        data: JSON.stringify({
            text: str,
            url: api_server,
        }),
        dataType: 'json',
        contentType: 'application/json',
        success: function (data) {
            ids = data.ids;
            isAsync && resolve(ids);
        },
    });

    return ids;
}

/**
 * Calls the underlying tokenizer model to decode token ids to text.
 * @param {string} endpoint API endpoint.
 * @param {number[]} ids Array of token ids
 * @param {function} [resolve] Promise resolve function.
 * @returns {({ text: string, chunks?: string[] })} Decoded token text as a single string and individual chunks (if available).
 */
function decodeTextTokensFromServer(endpoint, ids, resolve) {
    const isAsync = typeof resolve === 'function';
    let text = '';
    let chunks = [];
    jQuery.ajax({
        async: isAsync,
        type: 'POST',
        url: endpoint,
        data: JSON.stringify({ ids: ids }),
        dataType: 'json',
        contentType: 'application/json',
        success: function (data) {
            text = data.text;
            chunks = data.chunks;
            isAsync && resolve({ text, chunks });
        },
    });
    return { text, chunks };
}

/**
 * Encodes a string to tokens using the server API.
 * @param {number} tokenizerType Tokenizer type.
 * @param {string} str String to tokenize.
 * @returns {number[]} Array of token ids.
 */
export function getTextTokens(tokenizerType, str) {
    switch (tokenizerType) {
        case tokenizers.API_CURRENT:
            return getTextTokens(currentRemoteTokenizerAPI(), str);
        case tokenizers.API_TEXTGENERATIONWEBUI:
            return getTextTokensFromTextgenAPI(str);
        case tokenizers.API_KOBOLD:
            return getTextTokensFromKoboldAPI(str);
        default: {
            const tokenizerEndpoints = TOKENIZER_URLS[tokenizerType];
            if (!tokenizerEndpoints) {
                apiFailureTokenCount(str);
                console.warn('Unknown tokenizer type', tokenizerType);
                return [];
            }
            let endpointUrl = tokenizerEndpoints.encode;
            if (!endpointUrl) {
                apiFailureTokenCount(str);
                console.warn('This tokenizer type does not support encoding', tokenizerType);
                return [];
            }
            if (tokenizerType === tokenizers.OPENAI) {
                endpointUrl += `?model=${getTokenizerModel()}`;
            }
            return getTextTokensFromServer(endpointUrl, str);
        }
    }
}

/**
 * Decodes token ids to text using the server API.
 * @param {number} tokenizerType Tokenizer type.
 * @param {number[]} ids Array of token ids
 * @returns {({ text: string, chunks?: string[] })} Decoded token text as a single string and individual chunks (if available).
 */
export function decodeTextTokens(tokenizerType, ids) {
    // Currently, neither remote API can decode, but this may change in the future. Put this guard here to be safe
    if (tokenizerType === tokenizers.API_CURRENT) {
        return decodeTextTokens(tokenizers.NONE, ids);
    }
    const tokenizerEndpoints = TOKENIZER_URLS[tokenizerType];
    if (!tokenizerEndpoints) {
        console.warn('Unknown tokenizer type', tokenizerType);
        return { text: '', chunks: [] };
    }
    let endpointUrl = tokenizerEndpoints.decode;
    if (!endpointUrl) {
        console.warn('This tokenizer type does not support decoding', tokenizerType);
        return { text: '', chunks: [] };
    }
    if (tokenizerType === tokenizers.OPENAI) {
        endpointUrl += `?model=${getTokenizerModel()}`;
    }
    return decodeTextTokensFromServer(endpointUrl, ids);
}

export async function initTokenizers() {
    await loadTokenCache();
    registerDebugFunction('resetTokenCache', 'Reset token cache', 'Purges the calculated token counts. Use this if you want to force a full re-tokenization of all chats or suspect the token counts are wrong.', resetTokenCache);
}
