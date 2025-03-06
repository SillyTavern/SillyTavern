import { getPresetManager } from './preset-manager.js';
import { extractMessageFromData, getGenerateUrl, getRequestHeaders } from '../script.js';
import { getTextGenServer } from './textgen-settings.js';
import { chat_completion_sources } from './openai.js';

// #region Type Definitions
/**
 * @typedef {Object} TextCompletionRequestBase
 * @property {string} prompt - The text prompt for completion
 * @property {number} max_tokens - Maximum number of tokens to generate
 * @property {string} [model] - Optional model name
 * @property {string} api_type - Type of API to use
 * @property {string} [api_server] - Optional API server URL
 * @property {number} [temperature] - Optional temperature parameter
 */

/** @typedef {Record<string, any> & TextCompletionRequestBase} TextCompletionRequest */

/**
 * @typedef {Object} TextCompletionPayloadBase
 * @property {string} prompt - The text prompt for completion
 * @property {number} max_tokens - Maximum number of tokens to generate
 * @property {number} max_new_tokens - Alias for max_tokens
 * @property {string} [model] - Optional model name
 * @property {string} api_type - Type of API to use
 * @property {string} api_server - API server URL
 * @property {number} [temperature] - Optional temperature parameter
 */

/** @typedef {Record<string, any> & TextCompletionPayloadBase} TextCompletionPayload */

/**
 * @typedef {Object} ChatCompletionMessage
 * @property {string} role - The role of the message author (e.g., "user", "assistant", "system")
 * @property {string} content - The content of the message
 */

/**
 * @typedef {Object} ChatCompletionPayloadBase
 * @property {ChatCompletionMessage[]} messages - Array of chat messages
 * @property {string} [model] - Optional model name to use for completion
 * @property {string} chat_completion_source - Source provider for chat completion
 * @property {number} max_tokens - Maximum number of tokens to generate
 * @property {number} [temperature] - Optional temperature parameter for response randomness
 */

/** @typedef {Record<string, any> & ChatCompletionPayloadBase} ChatCompletionPayload */
// #endregion

/**
 * Creates & sends a text completion request. Streaming is not supported.
 */
export class TextCompletionService {
    static TYPE = 'textgenerationwebui';

    /**
     * @param {TextCompletionRequest} custom
     * @returns {TextCompletionPayload}
     */
    static createRequestData({ prompt, max_tokens, model, api_type, api_server, temperature, ...props }) {
        return {
            ...props,
            prompt,
            max_tokens,
            max_new_tokens: max_tokens,
            model,
            api_type,
            api_server: api_server ?? getTextGenServer(api_type),
            temperature,
            stream: false,
        };
    }

    /**
     * Sends a text completion request to the specified server
     * @param {TextCompletionPayload} data Request data
     * @param {boolean?} extractData Extract message from the response. Default true
     * @returns {Promise<string | any>} Extracted data or the raw response
     * @throws {Error}
     */
    static async sendRequest(data, extractData = true) {
        const response = await fetch(getGenerateUrl(this.TYPE), {
            method: 'POST',
            headers: getRequestHeaders(),
            cache: 'no-cache',
            body: JSON.stringify(data),
            signal: new AbortController().signal,
        });

        const json = await response.json();
        if (!response.ok || json.error) {
            throw json;
        }

        return extractData ? extractMessageFromData(json, this.TYPE) : json;
    }

    /**
     * @param {string} presetName
     * @param {TextCompletionRequest} custom
     * @param {boolean?} extractData Extract message from the response. Default true
     * @returns {Promise<string | any>} Extracted data or the raw response
     * @throws {Error}
     */
    static async sendRequestWithPreset(presetName, custom, extractData = true) {
        const presetManager = getPresetManager(this.TYPE);
        if (!presetManager) {
            throw new Error('Preset manager not found');
        }

        const preset = presetManager.getCompletionPresetByName(presetName);
        if (!preset) {
            throw new Error('Preset not found');
        }

        const data = this.createRequestData({ ...preset, ...custom });

        return await this.sendRequest(data, extractData);
    }
}

/**
 * Creates & sends a chat completion request. Streaming is not supported.
 */
export class ChatCompletionService {
    static TYPE = 'openai';

    /**
     * @param {ChatCompletionPayload} custom
     * @returns {ChatCompletionPayload}
     */
    static createRequestData({ messages, model, chat_completion_source, max_tokens, temperature, ...props }) {
        return {
            ...props,
            messages,
            model,
            chat_completion_source,
            max_tokens,
            temperature,
            stream: false,
        };
    }

    /**
     * Sends a chat completion request
     * @param {ChatCompletionPayload} data Request data
     * @param {boolean?} extractData Extract message from the response. Default true
     * @returns {Promise<string | any>} Extracted data or the raw response
     * @throws {Error}
     */
    static async sendRequest(data, extractData = true) {
        const response = await fetch('/api/backends/chat-completions/generate', {
            method: 'POST',
            headers: getRequestHeaders(),
            cache: 'no-cache',
            body: JSON.stringify(data),
            signal: new AbortController().signal,
        });

        const json = await response.json();
        if (!response.ok || json.error) {
            throw json;
        }

        return extractData ? extractMessageFromData(json, this.TYPE) : json;
    }

    /**
     * @param {string} presetName
     * @param {ChatCompletionPayload} custom
     * @param {boolean} extractData Extract message from the response. Default true
     * @returns {Promise<string | any>} Extracted data or the raw response
     * @throws {Error}
     */
    static async sendRequestWithPreset(presetName, custom, extractData = true) {
        const presetManager = getPresetManager(this.TYPE);
        if (!presetManager) {
            throw new Error('Preset manager not found');
        }

        const preset = presetManager.getCompletionPresetByName(presetName);
        if (!preset) {
            throw new Error('Preset not found');
        }

        const payload = ChatCompletionService.presetToGeneratePayload(preset, custom);

        const data = this.createRequestData({ ...payload, ...custom });

        return await this.sendRequest(data, extractData);
    }

    /**
     * Converts a preset configuration into a valid chat completion payload
     * @param {Object} preset - The preset configuration
     * @param {Object} customParams - Additional parameters to override preset values
     * @returns {Object} - Formatted payload for chat completion API
     */
    static presetToGeneratePayload(preset, customParams = {}) {
        if (!preset || typeof preset !== 'object') {
            throw new Error('Invalid preset: must be an object');
        }

        // Merge preset with custom parameters
        const settings = { ...preset, ...customParams };

        // Initialize base payload with common parameters
        const payload = {
            messages: customParams.messages || [],
            chat_completion_source: settings.chat_completion_source,
            temperature: settings.temperature ? Number(settings.temperature) : undefined,
            frequency_penalty: Number(settings.frequency_penalty),
            presence_penalty: Number(settings.presence_penalty),
            top_p: Number(settings.top_p),
            max_tokens: settings.openai_max_tokens,
            stream: settings.stream_openai
        };

        // Determine model based on source
        const source = settings.chat_completion_source;
        switch (source) {
            case chat_completion_sources.OPENAI:
                payload.model = settings.openai_model;
                break;
            case chat_completion_sources.CLAUDE:
                payload.model = settings.claude_model;
                break;
            case chat_completion_sources.WINDOWAI:
                payload.model = settings.windowai_model;
                break;
            case chat_completion_sources.OPENROUTER:
                payload.model = settings.openrouter_model;
                break;
            case chat_completion_sources.MAKERSUITE:
                payload.model = settings.google_model;
                break;
            case chat_completion_sources.MISTRALAI:
                payload.model = settings.mistralai_model;
                break;
            case chat_completion_sources.COHERE:
                payload.model = settings.cohere_model;
                break;
            case chat_completion_sources.PERPLEXITY:
                payload.model = settings.perplexity_model;
                break;
            case chat_completion_sources.GROQ:
                payload.model = settings.groq_model;
                break;
            case chat_completion_sources.ZEROONEAI:
                payload.model = settings.zerooneai_model;
                break;
            case chat_completion_sources.BLOCKENTROPY:
                payload.model = settings.blockentropy_model;
                break;
            case chat_completion_sources.CUSTOM:
                payload.model = settings.custom_model;
                payload.custom_url = settings.custom_url;
                payload.custom_include_body = settings.custom_include_body;
                payload.custom_exclude_body = settings.custom_exclude_body;
                payload.custom_include_headers = settings.custom_include_headers;
                payload.custom_prompt_post_processing = settings.custom_prompt_post_processing;
                break;
            default:
                payload.model = settings.openai_model;
        }

        // Multiple completions support
        if (settings.n > 1 && [chat_completion_sources.OPENAI, chat_completion_sources.CUSTOM].includes(source)) {
            payload.n = settings.n;
        }

        // Handle model-specific parameters

        // For models that support top_k
        if ([chat_completion_sources.CLAUDE, chat_completion_sources.OPENROUTER,
        chat_completion_sources.MAKERSUITE, chat_completion_sources.COHERE,
        chat_completion_sources.PERPLEXITY].includes(source)) {
            payload.top_k = Number(settings.top_k || 0);
        }

        // OpenRouter specific parameters
        if (source === chat_completion_sources.OPENROUTER) {
            payload.min_p = Number(settings.min_p);
            payload.repetition_penalty = Number(settings.repetition_penalty);
            payload.top_a = Number(settings.top_a);
            payload.use_fallback = settings.openrouter_use_fallback;
            payload.provider = settings.openrouter_providers || [];
            payload.allow_fallbacks = settings.openrouter_allow_fallbacks;
            payload.middleout = settings.openrouter_middleout;
        }

        // Claude specific parameters
        if (source === chat_completion_sources.CLAUDE) {
            payload.claude_use_sysprompt = settings.claude_use_sysprompt;
            payload.assistant_prefill = settings.assistant_prefill;
        }

        // Google MakerSuite specific parameters
        if (source === chat_completion_sources.MAKERSUITE) {
            payload.use_makersuite_sysprompt = settings.use_makersuite_sysprompt;
        }

        // Cohere specific adjustments
        if (source === chat_completion_sources.COHERE) {
            // Clamp top_p to 0.01 -> 0.99
            payload.top_p = Math.min(Math.max(Number(settings.top_p), 0.01), 0.99);
            // Clamp penalties to 0 -> 1
            payload.frequency_penalty = Math.min(Math.max(Number(settings.frequency_penalty), 0), 1);
            payload.presence_penalty = Math.min(Math.max(Number(settings.presence_penalty), 0), 1);
        }

        // Perplexity specific adjustments
        if (source === chat_completion_sources.PERPLEXITY) {
            // Perplexity normalized frequency_penalty (1 = disabled)
            payload.frequency_penalty = Math.max(0, Number(settings.frequency_penalty)) + 1;
        }

        // Add reverse proxy settings where supported
        if (settings.reverse_proxy &&
            [chat_completion_sources.CLAUDE, chat_completion_sources.OPENAI,
            chat_completion_sources.MISTRALAI, chat_completion_sources.MAKERSUITE,
            chat_completion_sources.DEEPSEEK].includes(source)) {
            payload.reverse_proxy = settings.reverse_proxy;
            payload.proxy_password = settings.proxy_password || '';
        }

        // Add seed parameter where supported
        if ([chat_completion_sources.OPENAI, chat_completion_sources.OPENROUTER,
        chat_completion_sources.MISTRALAI, chat_completion_sources.CUSTOM,
        chat_completion_sources.COHERE].includes(source) &&
            settings.seed >= 0) {
            payload.seed = settings.seed;
        }

        // Add reasoning/thoughts parameters
        if (settings.show_thoughts) {
            payload.include_reasoning = true;
            payload.reasoning_effort = settings.reasoning_effort;
        }

        // Special handling for Claude O1/O3 models
        if (source === chat_completion_sources.OPENAI &&
            (payload.model.startsWith('o1') || payload.model.startsWith('o3'))) {
            // Convert system messages to user messages
            if (payload.messages) {
                payload.messages.forEach(msg => {
                    if (msg.role === 'system') msg.role = 'user';
                });
            }

            payload.max_completion_tokens = payload.max_tokens;
            // Remove unsupported parameters
            delete payload.max_tokens;
            delete payload.temperature;
            delete payload.top_p;
            delete payload.frequency_penalty;
            delete payload.presence_penalty;
            delete payload.stream;
            delete payload.n;
            delete payload.stop;
        }

        // Vision models and GPT-4.5 don't support certain parameters
        const isVisionModel =
            (source === chat_completion_sources.OPENAI && payload.model.includes('vision')) ||
            (source === chat_completion_sources.OPENROUTER && payload.model.includes('vision'));

        if (isVisionModel ||
            (source === chat_completion_sources.OPENAI && payload.model.includes('gpt-4.5-preview'))) {
            delete payload.logit_bias;
            delete payload.stop;
            delete payload.logprobs;
        }

        // Remove unsupported parameters for certain providers
        if ([chat_completion_sources.GROQ, chat_completion_sources.ZEROONEAI].includes(source)) {
            delete payload.logprobs;
            delete payload.logit_bias;
            delete payload.n;
            delete payload.frequency_penalty;
            delete payload.presence_penalty;
            delete payload.stop;
        }

        return payload;
    }
}
