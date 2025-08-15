import { getPresetManager } from './preset-manager.js';
import { extractJsonFromData, extractMessageFromData, getGenerateUrl, getRequestHeaders } from '../script.js';
import { getTextGenServer } from './textgen-settings.js';
import { extractReasoningFromData } from './reasoning.js';
import { formatInstructModeChat, formatInstructModePrompt, getInstructStoppingSequences, names_behavior_types } from './instruct-mode.js';
import { getStreamingReply, tryParseStreamingError } from './openai.js';
import EventSourceStream from './sse-stream.js';

// #region Type Definitions
/**
 * @typedef {Object} TextCompletionRequestBase
 * @property {boolean?} [stream=false] - Whether to stream the response
 * @property {number} max_tokens - Maximum number of tokens to generate
 * @property {string} [model] - Optional model name
 * @property {string} api_type - Type of API to use
 * @property {string} [api_server] - Optional API server URL
 * @property {number} [temperature] - Optional temperature parameter
 * @property {number} [min_p] - Optional min_p parameter
 */

/**
 * @typedef {Object} TextCompletionPayloadBase
 * @property {boolean?} [stream=false] - Whether to stream the response
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
 * @property {boolean?} [stream=false] - Whether to stream the response
 * @property {ChatCompletionMessage[]} messages - Array of chat messages
 * @property {string} [model] - Optional model name to use for completion
 * @property {string} chat_completion_source - Source provider
 * @property {number} max_tokens - Maximum number of tokens to generate
 * @property {number} [temperature] - Optional temperature parameter for response randomness
 * @property {string} [custom_url] - Optional custom URL
 * @property {string} [reverse_proxy] - Optional reverse proxy URL
 * @property {string} [proxy_password] - Optional proxy password
 */

/** @typedef {Record<string, any> & ChatCompletionPayloadBase} ChatCompletionPayload */

/**
 * @typedef {Object} ExtractedData
 * @property {string} content - Extracted content.
 * @property {string} reasoning - Extracted reasoning.
 */

/**
 * @typedef {Object} StreamResponse
 * @property {string} text - Generated text.
 * @property {string[]} swipes - Generated swipes
 * @property {Object} state - Generated state
 * @property {string?} [state.reasoning] - Generated reasoning
 * @property {string?} [state.image] - Generated image
 */

// #endregion

/**
 * Creates & sends a text completion request.
 */
export class TextCompletionService {
    static TYPE = 'textgenerationwebui';

    /**
     * @param {Record<string, any> & TextCompletionRequestBase & {prompt: string}} custom
     * @returns {TextCompletionPayload}
     */
    static createRequestData({ stream = false, prompt, max_tokens, model, api_type, api_server, temperature, min_p, ...props }) {
        const payload = {
            stream,
            prompt,
            max_tokens,
            max_new_tokens: max_tokens,
            model,
            api_type,
            api_server: api_server ?? getTextGenServer(api_type),
            temperature,
            min_p,
            ...props,
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
     * @param {AbortSignal?} signal
     * @returns {Promise<ExtractedData | (() => AsyncGenerator<StreamResponse>)>} If not streaming, returns extracted data; if streaming, returns a function that creates an AsyncGenerator
     * @throws {Error}
     */
    static async sendRequest(data, extractData = true, signal = null) {
        if (!data.stream) {
            const response = await fetch(getGenerateUrl(this.TYPE), {
                method: 'POST',
                headers: getRequestHeaders(),
                cache: 'no-cache',
                body: JSON.stringify(data),
                signal: signal ?? new AbortController().signal,
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

        const response = await fetch('/api/backends/text-completions/generate', {
            method: 'POST',
            headers: getRequestHeaders(),
            cache: 'no-cache',
            body: JSON.stringify(data),
            signal: signal ?? new AbortController().signal,
        });

        if (!response.ok) {
            const text = await response.text();
            tryParseStreamingError(response, text, { quiet: true });

            throw new Error(`Got response status ${response.status}`);
        }

        const eventStream = new EventSourceStream();
        response.body.pipeThrough(eventStream);
        const reader = eventStream.readable.getReader();
        return async function* streamData() {
            let text = '';
            const swipes = [];
            const state = { reasoning: '' };
            while (true) {
                const { done, value } = await reader.read();
                if (done) return;
                if (value.data === '[DONE]') return;

                tryParseStreamingError(response, value.data, { quiet: true });

                let data = JSON.parse(value.data);

                if (data?.choices?.[0]?.index > 0) {
                    const swipeIndex = data.choices[0].index - 1;
                    swipes[swipeIndex] = (swipes[swipeIndex] || '') + data.choices[0].text;
                } else {
                    const newText = data?.choices?.[0]?.text || data?.content || '';
                    text += newText;
                    state.reasoning += data?.choices?.[0]?.reasoning ?? '';
                }

                yield { text, swipes, state };
            }
        };
    }

    /**
     * Process and send a text completion request with optional preset & instruct
     * @param {Record<string, any> & TextCompletionRequestBase & {prompt: (ChatCompletionMessage & {ignoreInstruct?: boolean})[] |string}} custom
     * @param {Object} options - Configuration options
     * @param {string?} [options.presetName] - Name of the preset to use for generation settings
     * @param {string?} [options.instructName] - Name of instruct preset for message formatting
     * @param {Partial<InstructSettings>?} [options.instructSettings] - Override instruct settings
     * @param {boolean} extractData - Whether to extract structured data from response
     * @param {AbortSignal?} [signal]
     * @returns {Promise<ExtractedData | (() => AsyncGenerator<StreamResponse>)>} If not streaming, returns extracted data; if streaming, returns a function that creates an AsyncGenerator
     * @throws {Error}
     */
    static async processRequest(
        custom,
        options = {},
        extractData = true,
        signal = null,
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


        /** @type {InstructSettings | undefined} */
        let instructPreset;
        // Handle instruct formatting if requested
        if (Array.isArray(prompt) && instructName) {
            const instructPresetManager = getPresetManager('instruct');
            instructPreset = instructPresetManager?.getCompletionPresetByName(instructName);
            if (instructPreset) {
                // Clone the preset to avoid modifying the original
                instructPreset = structuredClone(instructPreset);
                instructPreset.names_behavior = names_behavior_types.NONE;
                if (options.instructSettings) {
                    Object.assign(instructPreset, options.instructSettings);
                }

                // Format messages using instruct formatting
                const formattedMessages = [];
                const prefillActive = prompt.length > 0 ? prompt[prompt.length - 1].role === 'assistant' : false;
                for (const message of prompt) {
                    let messageContent = message.content;
                    if (!message.ignoreInstruct) {
                        const isLastMessage = message === prompt[prompt.length - 1];

                        // This complicated logic means:
                        // 1. If prefill is not active, format all messages
                        // 2. If prefill is active, format all messages except the last one
                        if (!isLastMessage || !prefillActive) {
                            messageContent = formatInstructModeChat(
                                message.role,
                                message.content,
                                message.role === 'user',
                                message.role === 'system',
                                undefined,
                                undefined,
                                undefined,
                                undefined,
                                instructPreset,
                            );
                        }

                        // Add prompt formatting for the last message.
                        if (isLastMessage) {
                            if (!prefillActive) { // e.g. "<|im_start|>user:"
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
                            } else { // e.g. "<|im_start|>assistant: Hello, my name is"
                                const overriddenInstructPreset = structuredClone(instructPreset);
                                overriddenInstructPreset.output_suffix = '';
                                overriddenInstructPreset.wrap = false;
                                messageContent = formatInstructModeChat(
                                    message.role,
                                    message.content,
                                    false, // since it is assistant
                                    false,
                                    undefined,
                                    undefined,
                                    undefined,
                                    undefined,
                                    overriddenInstructPreset,
                                );
                            }
                        }
                    }
                    formattedMessages.push(messageContent);
                }
                requestData.prompt = formattedMessages.join('');
                const stoppingStrings = getInstructStoppingSequences({ customInstruct: instructPreset, useStopStrings: false });
                requestData.stop = stoppingStrings;
                requestData.stopping_strings = stoppingStrings;
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

        const response = await this.sendRequest(data, extractData, signal);
        // Remove stopping strings from the end
        if (!data.stream && extractData) {
            /** @type {ExtractedData} */
            // @ts-ignore
            const extractedData = response;

            let message = extractedData.content;

            message = message.replace(/[^\S\r\n]+$/gm, '');

            if (requestData.stopping_strings) {
                for (const stoppingString of requestData.stopping_strings) {
                    if (stoppingString.length) {
                        for (let j = stoppingString.length; j > 0; j--) {
                            if (message.slice(-j) === stoppingString.slice(0, j)) {
                                message = message.slice(0, -j);
                                break;
                            }
                        }
                    }
                }
            }

            if (instructPreset) {
                [
                    instructPreset.stop_sequence,
                    instructPreset.input_sequence,
                ].forEach(sequence => {
                    if (sequence?.trim()) {
                        const index = message.indexOf(sequence);
                        if (index !== -1) {
                            message = message.substring(0, index);
                        }
                    }
                });

                [
                    instructPreset.output_sequence,
                    instructPreset.last_output_sequence,
                ].forEach(sequences => {
                    if (sequences) {
                        sequences.split('\n')
                            .filter(line => line.trim() !== '')
                            .forEach(line => {
                                message = message.replaceAll(line, '');
                            });
                    }
                });
            }

            extractedData.content = message;
        }

        return response;
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
            'temperature': settings.temp >= 0 ? Number(settings.temp) : undefined,
            'min_p': settings.min_p >= 0 ? Number(settings.min_p) : undefined,
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
 * Creates & sends a chat completion request.
 */
export class ChatCompletionService {
    static TYPE = 'openai';

    /**
     * @param {ChatCompletionPayload} custom
     * @returns {ChatCompletionPayload}
     */
    static createRequestData({ stream = false, messages, model, chat_completion_source, max_tokens, temperature, custom_url, reverse_proxy, proxy_password, ...props }) {
        const payload = {
            stream,
            messages,
            model,
            chat_completion_source,
            max_tokens,
            temperature,
            custom_url,
            reverse_proxy,
            proxy_password,
            use_makersuite_sysprompt: true,
            claude_use_sysprompt: true,
            ...props,
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
     * @param {AbortSignal?} signal Abort signal
     * @returns {Promise<ExtractedData | (() => AsyncGenerator<StreamResponse>)>} If not streaming, returns extracted data; if streaming, returns a function that creates an AsyncGenerator
     * @throws {Error}
     */
    static async sendRequest(data, extractData = true, signal = null) {
        const response = await fetch('/api/backends/chat-completions/generate', {
            method: 'POST',
            headers: getRequestHeaders(),
            cache: 'no-cache',
            body: JSON.stringify(data),
            signal: signal ?? new AbortController().signal,
        });

        if (!data.stream) {
            const json = await response.json();
            if (!response.ok || json.error) {
                throw json;
            }

            if (!extractData) {
                return json;
            }

            const result = {
                content: extractMessageFromData(json, this.TYPE),
                reasoning: extractReasoningFromData(json, {
                    mainApi: this.TYPE,
                    textGenType: data.chat_completion_source,
                    ignoreShowThoughts: true,
                }),
            };
            // Try parse JSON
            if (data.json_schema) {
                result.content = JSON.parse(extractJsonFromData(json, { mainApi: this.TYPE, chatCompletionSource: data.chat_completion_source }));
            }
            return result;
        }

        if (!response.ok) {
            const text = await response.text();
            tryParseStreamingError(response, text, { quiet: true });

            throw new Error(`Got response status ${response.status}`);
        }

        const eventStream = new EventSourceStream();
        response.body.pipeThrough(eventStream);
        const reader = eventStream.readable.getReader();
        return async function* streamData() {
            let text = '';
            const swipes = [];
            const state = { reasoning: '', image: '' };
            while (true) {
                const { done, value } = await reader.read();
                if (done) return;
                const rawData = value.data;
                if (rawData === '[DONE]') return;
                tryParseStreamingError(response, rawData, { quiet: true });
                const parsed = JSON.parse(rawData);

                const reply = getStreamingReply(parsed, state, {
                    chatCompletionSource: data.chat_completion_source,
                    overrideShowThoughts: true,
                });
                if (Array.isArray(parsed?.choices) && parsed?.choices?.[0]?.index > 0) {
                    const swipeIndex = parsed.choices[0].index - 1;
                    swipes[swipeIndex] = (swipes[swipeIndex] || '') + reply;
                } else {
                    text += reply;
                }

                yield { text, swipes: swipes, state };
            }
        };
    }

    /**
     * Process and send a chat completion request with optional preset
     * @param {ChatCompletionPayload} custom
     * @param {Object} options - Configuration options
     * @param {string?} [options.presetName] - Name of the preset to use for generation settings
     * @param {boolean} [extractData=true] - Whether to extract structured data from response
     * @param {AbortSignal?} [signal] - Abort signal
     * @returns {Promise<ExtractedData | (() => AsyncGenerator<StreamResponse>)>} If not streaming, returns extracted data; if streaming, returns a function that creates an AsyncGenerator
     * @throws {Error}
     */
    static async processRequest(custom, options, extractData = true, signal = null) {
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

        return await this.sendRequest(data, extractData, signal);
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
            temperature: settings.temperature >= 0 ? Number(settings.temperature) : undefined,
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
