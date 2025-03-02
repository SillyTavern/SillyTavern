import { getPresetManager } from './preset-manager.js';
import { getGenerateUrl, getRequestHeaders } from '../script.js';
import { getTextGenServer } from './textgen-settings.js';

// #region Type Definitions
/**
 * @typedef {{[key: string]: any}} TextCompletionRequest
 * @property {string} prompt - The text prompt for completion
 * @property {number} max_tokens - Maximum number of tokens to generate
 * @property {string} [model] - Optional model name
 * @property {string} api_type - Type of API to use
 * @property {string} [api_server] - Optional API server URL
 * @property {number} [temperature] - Optional temperature parameter
 */

/**
 * @typedef {{[key: string]: any}} TextCompletionPayload
 * @property {string} prompt - The text prompt for completion
 * @property {number} max_tokens - Maximum number of tokens to generate
 * @property {number} max_new_tokens - Alias for max_tokens
 * @property {string} [model] - Optional model name
 * @property {string} api_type - Type of API to use
 * @property {string} api_server - API server URL
 * @property {number} [temperature] - Optional temperature parameter
 */

/**
 * @typedef {Object} ChatCompletionMessage
 * @property {string} role - The role of the message author (e.g., "user", "assistant", "system")
 * @property {string} content - The content of the message
 */

/**
 * @typedef {Object} ChatCompletionPayload
 * @property {ChatCompletionMessage[]} messages - Array of chat messages
 * @property {string} [model] - Optional model name to use for completion
 * @property {string} chat_completion_source - Source provider for chat completion
 * @property {number} max_tokens - Maximum number of tokens to generate
 * @property {number} [temperature] - Optional temperature parameter for response randomness
 * @property {boolean} [stream] - Whether to stream the response (false by default)
 * @property {any} [key] - Any additional properties
 */
// #endregion

/**
 * Creates & sends a text completion request. Streaming is not supported.
 */
export class TextCompletionService {
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
     */
    static async sendRequest(data) {
        const response = await fetch(getGenerateUrl('textgenerationwebui'), {
            method: 'POST',
            headers: getRequestHeaders(),
            cache: 'no-cache',
            body: JSON.stringify(data),
            signal: new AbortController().signal,
        });

        if (!response.ok) {
            throw await response.json();
        }

        return await response.json();
    }

    /**
     * @param {string} presetName
     * @param {TextCompletionRequest} custom
     * @returns {Promise<any | null>}
     * @throws {Error}
     */
    static async sendRequestWithPreset(presetName, custom) {
        const presetManager = getPresetManager('textgenerationwebui');
        if (!presetManager) {
            throw new Error('Preset manager not found');
        }

        const preset = presetManager.getCompletionPresetByName(presetName);
        if (!preset) {
            throw new Error('Preset not found');
        }

        const data = this.createRequestData({ ...preset, ...custom });

        return await this.sendRequest(data);
    }
}

/**
 * Creates & sends a chat completion request. Streaming is not supported.
 */
export class ChatCompletionService {
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
     */
    static async sendRequest(data) {
        const response = await fetch('/api/backends/chat-completions/generate', {
            method: 'POST',
            headers: getRequestHeaders(),
            cache: 'no-cache',
            body: JSON.stringify(data),
            signal: new AbortController().signal,
        });

        if (!response.ok) {
            throw await response.json();
        }

        return await response.json();
    }

    /**
     * @param {string} presetName
     * @param {ChatCompletionPayload} custom
     * @returns {Promise<any | null>}
     * @throws {Error}
     */
    static async sendRequestWithPreset(presetName, custom) {
        const presetManager = getPresetManager('openai');
        if (!presetManager) {
            throw new Error('Preset manager not found');
        }

        const preset = presetManager.getCompletionPresetByName(presetName);
        if (!preset) {
            throw new Error('Preset not found');
        }

        const data = this.createRequestData({ ...preset, ...custom });

        return await this.sendRequest(data);
    }
}
