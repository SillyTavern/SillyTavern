import { getPresetManager } from './preset-manager.js';
import { extractMessageFromData, getGenerateUrl, getRequestHeaders } from '../script.js';
import { getTextGenServer } from './textgen-settings.js';

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

        const data = this.createRequestData({ ...preset, ...custom });

        return await this.sendRequest(data, extractData);
    }
}
