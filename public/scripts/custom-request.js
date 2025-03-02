import { getPresetManager } from "./preset-manager.js";
import { getGenerateUrl, getRequestHeaders } from "../script.js";
import { getTextGenServer } from "./textgen-settings.js";

// #region Type Definitions
/**
 * @typedef {{prompt: string, max_tokens: number, model?: string, api_type: string, api_server?: string, temperature?: number, [key: string]: any}} TextCompletionRequest
 * @typedef {{prompt: string, max_tokens: number, max_new_tokens: number, model?: string, api_type: string, api_server: string, temperature?: number, [key: string]: any}} TextCompletionPayload
 */

/**
 * @typedef {{role: string, content: string}} ChatCompletionMessage
 * @typedef {{messages: ChatCompletionMessage[], model?: string, chat_completion_source: string, max_tokens: number, temperature?: number, [key: string]: any}} ChatCompletionPayload
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
