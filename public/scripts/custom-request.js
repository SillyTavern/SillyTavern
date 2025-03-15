import { getPresetManager } from './preset-manager.js';
import { extractMessageFromData, getGenerateUrl, getRequestHeaders } from '../script.js';
import { getTextGenServer } from './textgen-settings.js';
import { extractReasoningFromData } from './reasoning.js';
import { formatInstructModeChat, formatInstructModePrompt, names_behavior_types } from './instruct-mode.js';

// #region Type Definitions
/**
 * @typedef {Object} TextCompletionRequestBase
 * @property {number} max_tokens - Maximum number of tokens to generate
 * @property {string} [model] - Optional model name
 * @property {string} api_type - Type of API to use
 * @property {string} [api_server] - Optional API server URL
 * @property {number} [temperature] - Optional temperature parameter
 * @property {number} [min_p] - Optional min_p parameter
 */

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

/**
 * @typedef {Object} ExtractedData
 * @property {string} content - Extracted content.
 * @property {string} reasoning - Extracted reasoning.
 */

// #endregion

/**
 * Creates & sends a text completion request. Streaming is not supported.
 */
export class TextCompletionService {
    static TYPE = 'textgenerationwebui';

    /**
     * @param {Record<string, any> & TextCompletionRequestBase & {prompt: string}} custom
     * @returns {TextCompletionPayload}
     */
    static createRequestData({ prompt, max_tokens, model, api_type, api_server, temperature, min_p, ...props }) {
        const payload = {
            ...props,
            prompt,
            max_tokens,
            max_new_tokens: max_tokens,
            model,
            api_type,
            api_server: api_server ?? getTextGenServer(api_type),
            temperature,
            min_p,
            stream: false,
        };

        // Remove undefined values to avoid API errors
        Object.keys(payload).forEach(key => {
            if (payload[key] === undefined) {
                delete payload[key];
            }
        });

        return payload;
    }

    /**
     * Sends a text completion request to the specified server
     * @param {TextCompletionPayload} data Request data
     * @param {boolean?} extractData Extract message from the response. Default true
     * @returns {Promise<ExtractedData | any>} Extracted data or the raw response
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

        if (!extractData) {
            return json;
        }

        return {
            content: extractMessageFromData(json, this.TYPE),
            reasoning: extractReasoningFromData(json, {
                mainApi: this.TYPE,
                textGenType: data.api_type,
                ignoreShowThoughts: true,
            }),
        };
    }

    /**
     * Process and send a text completion request with optional preset & instruct
     * @param {Record<string, any> & TextCompletionRequestBase & {prompt: (ChatCompletionMessage & {ignoreInstruct?: boolean})[] |string}} custom
     * @param {Object} options - Configuration options
     * @param {string?} [options.presetName] - Name of the preset to use for generation settings
     * @param {string?} [options.instructName] - Name of instruct preset for message formatting
     * @param {boolean} extractData - Whether to extract structured data from response
     * @returns {Promise<ExtractedData | any>} Extracted data or the raw response
     * @throws {Error}
     */
    static async processRequest(
        custom,
        options = {},
        extractData = true,
    ) {
        const { presetName, instructName } = options;
        let requestData = { ...custom };
        const prompt = custom.prompt;

        // Apply generation preset if specified
        if (presetName) {
            const presetManager = getPresetManager(this.TYPE);
            if (presetManager) {
                const preset = presetManager.getCompletionPresetByName(presetName);
                if (preset) {
                    // Convert preset to payload and merge with custom parameters
                    const presetPayload = this.presetToGeneratePayload(preset, {});
                    requestData = { ...presetPayload, ...requestData };
                } else {
                    console.warn(`Preset "${presetName}" not found, continuing with default settings`);
                }
            } else {
                console.warn('Preset manager not found, continuing with default settings');
            }
        }

        // Handle instruct formatting if requested
        if (Array.isArray(prompt) && instructName) {
            const instructPresetManager = getPresetManager('instruct');
            let instructPreset = instructPresetManager?.getCompletionPresetByName(instructName);
            if (instructPreset) {
                // Clone the preset to avoid modifying the original
                instructPreset = structuredClone(instructPreset);
                instructPreset.macro = false;
                instructPreset.names_behavior = names_behavior_types.NONE;

                // Format messages using instruct formatting
                const formattedMessages = [];
                for (const message of prompt) {
                    let messageContent = message.content;
                    if (!message.ignoreInstruct) {
                        messageContent = formatInstructModeChat(
                            message.role,
                            message.content,
                            message.role === 'user',
                            false,
                            undefined,
                            undefined,
                            undefined,
                            undefined,
                            instructPreset,
                        );

                        // Add prompt formatting for the last message
                        if (message === prompt[prompt.length - 1]) {
                            messageContent += formatInstructModePrompt(
                                undefined,
                                false,
                                undefined,
                                undefined,
                                undefined,
                                false,
                                false,
                                instructPreset,
                            );
                        }
                    }
                    formattedMessages.push(messageContent);
                }
                requestData.prompt = formattedMessages.join('');
                if (instructPreset.output_suffix) {
                    requestData.stop = [instructPreset.output_suffix];
                    requestData.stopping_strings = [instructPreset.output_suffix];
                }
            } else {
                console.warn(`Instruct preset "${instructName}" not found, using basic formatting`);
                requestData.prompt = prompt.map(x => x.content).join('\n\n');
            }
        } else if (typeof prompt === 'string') {
            requestData.prompt = prompt;
        } else {
            requestData.prompt = prompt.map(x => x.content).join('\n\n');
        }

        // @ts-ignore
        const data = this.createRequestData(requestData);

        return await this.sendRequest(data, extractData);
    }

    /**
     * Converts a preset to a valid text completion payload.
     * Only supports temperature.
     * @param {Object} preset - The preset configuration
     * @param {Object} customPreset - Additional parameters to override preset values
     * @returns {Object} - Formatted payload for text completion API
     */
    static presetToGeneratePayload(preset, customPreset = {}) {
        if (!preset || typeof preset !== 'object') {
            throw new Error('Invalid preset: must be an object');
        }

        // Merge preset with custom parameters
        const settings = { ...preset, ...customPreset };

        // Initialize base payload with common parameters
        let payload = {
            'temperature': settings.temp ? Number(settings.temp) : undefined,
            'min_p': settings.min_p ? Number(settings.min_p) : undefined,
        };

        // Remove undefined values to avoid API errors
        Object.keys(payload).forEach(key => {
            if (payload[key] === undefined) {
                delete payload[key];
            }
        });

        return payload;
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
        const payload = {
            ...props,
            messages,
            model,
            chat_completion_source,
            max_tokens,
            temperature,
            stream: false,
        };

        // Remove undefined values to avoid API errors
        Object.keys(payload).forEach(key => {
            if (payload[key] === undefined) {
                delete payload[key];
            }
        });

        return payload;
    }

    /**
     * Sends a chat completion request
     * @param {ChatCompletionPayload} data Request data
     * @param {boolean?} extractData Extract message from the response. Default true
     * @returns {Promise<ExtractedData | any>} Extracted data or the raw response
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

        if (!extractData) {
            return json;
        }

        return {
            content: extractMessageFromData(json, this.TYPE),
            reasoning: extractReasoningFromData(json, {
                mainApi: this.TYPE,
                textGenType: data.chat_completion_source,
                ignoreShowThoughts: true,
            }),
        };
    }

    /**
     * Process and send a chat completion request with optional preset
     * @param {ChatCompletionPayload} custom
     * @param {Object} options - Configuration options
     * @param {string?} [options.presetName] - Name of the preset to use for generation settings
     * @param {boolean} extractData - Whether to extract structured data from response
     * @returns {Promise<ExtractedData | any>} Extracted data or the raw response
     * @throws {Error}
     */
    static async processRequest(custom, options, extractData = true) {
        const { presetName } = options;
        let requestData = { ...custom };

        // Apply generation preset if specified
        if (presetName) {
            const presetManager = getPresetManager(this.TYPE);
            if (presetManager) {
                const preset = presetManager.getCompletionPresetByName(presetName);
                if (preset) {
                    // Convert preset to payload and merge with custom parameters
                    const presetPayload = this.presetToGeneratePayload(preset, {});
                    requestData = { ...presetPayload, ...requestData };
                } else {
                    console.warn(`Preset "${presetName}" not found, continuing with default settings`);
                }
            } else {
                console.warn('Preset manager not found, continuing with default settings');
            }
        }

        const data = this.createRequestData(requestData);

        return await this.sendRequest(data, extractData);
    }

    /**
     * Converts a preset to a valid chat completion payload
     * Only supports temperature.
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
            temperature: settings.temperature ? Number(settings.temperature) : undefined,
        };

        // Remove undefined values to avoid API errors
        Object.keys(payload).forEach(key => {
            if (payload[key] === undefined) {
                delete payload[key];
            }
        });

        return payload;
    }
}
