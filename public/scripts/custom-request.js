import { getPresetManager } from './preset-manager.js';
import { extractMessageFromData, getGenerateUrl, getRequestHeaders } from '../script.js';
import { APHRODITE_DEFAULT_ORDER, getTextGenServer, textgen_types } from './textgen-settings.js';
import { chat_completion_sources } from './openai.js';
import { arraysEqual, onlyUnique } from './utils.js';

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
        const payload = {
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

        const payload = this.presetToGeneratePayload(preset, {}, custom);

        const data = this.createRequestData({ ...payload, ...custom });

        return await this.sendRequest(data, extractData);
    }

    /**
     * Converts a preset to a valid text completion payload.
     * @param {Object} preset - The preset configuration
     * @param {Object} customPreset - Additional parameters to override preset values
     * @param {TextCompletionRequestBase} custom
     * @returns {Object} - Formatted payload for text completion API
     */
    static presetToGeneratePayload(preset, customPreset = {}, { prompt, model, api_type, max_tokens, api_server, temperature }) {
        if (!preset || typeof preset !== 'object') {
            throw new Error('Invalid preset: must be an object');
        }

        // Merge preset with custom parameters
        const settings = { ...preset, ...customPreset };

        if (!api_type) {
            throw new Error('API type cannot be empty');
        }

        const dynatemp = Boolean(settings.dynatemp);
        const maxTokens = max_tokens || settings.genamt || 150; // Or should we throw an error?
        const { banned_tokens_array, banned_tokens_string, banned_strings } = this.getBannedTokens(settings.banned_tokens);

        // Initialize base payload with common parameters
        let payload = {
            'prompt': prompt || '',
            'model': model,
            'max_new_tokens': maxTokens,
            'max_tokens': maxTokens,
            'temperature': temperature ?? dynatemp ? (settings.min_temp + settings.max_temp) / 2 : settings.temp,
            'top_p': settings.top_p,
            'typical_p': settings.typical_p,
            'typical': settings.typical_p,
            'sampler_seed': settings.seed >= 0 ? settings.seed : undefined,
            'min_p': settings.min_p,
            'repetition_penalty': settings.rep_pen,
            'frequency_penalty': settings.freq_pen,
            'presence_penalty': settings.presence_pen,
            'top_k': settings.top_k,
            'top_a': settings.top_a,
            'tfs': settings.tfs,
            'skew': settings.skew,
            'min_length': api_type === textgen_types.OOBA ? settings.min_length : undefined,
            'min_tokens': settings.min_length,
            'max_length': settings.max_length,
            'num_beams': api_type === textgen_types.OOBA ? settings.num_beams : undefined,
            'length_penalty': api_type === textgen_types.OOBA ? settings.length_penalty : undefined,
            'early_stopping': api_type === textgen_types.OOBA ? settings.early_stopping : undefined,
            'add_bos_token': settings.add_bos_token,
            'dynamic_temperature': dynatemp ? true : undefined,
            'dynatemp_low': dynatemp ? settings.min_temp : undefined,
            'dynatemp_high': dynatemp ? settings.max_temp : undefined,
            'dynatemp_range': dynatemp ? (settings.max_temp - settings.min_temp) / 2 : undefined,
            'dynatemp_exponent': dynatemp ? settings.dynatemp_exponent : undefined,
            'smoothing_factor': settings.smoothing_factor,
            'smoothing_curve': settings.smoothing_curve,
            'dry_allowed_length': settings.dry_allowed_length,
            'dry_multiplier': settings.dry_multiplier,
            'dry_base': settings.dry_base,
            'dry_sequence_breakers': settings.dry_sequence_breakers,
            'dry_penalty_last_n': settings.dry_penalty_last_n,
            'max_tokens_second': settings.max_tokens_second,
            'sampler_priority': api_type === textgen_types.OOBA ? settings.sampler_priority : undefined,
            'samplers': api_type === textgen_types.LLAMACPP ? settings.samplers : undefined,
            'ban_eos_token': settings.ban_eos_token,
            'skip_special_tokens': settings.skip_special_tokens,
            'include_reasoning': settings.include_reasoning,
            'epsilon_cutoff': [textgen_types.OOBA, textgen_types.MANCER].includes(api_type) ? settings.epsilon_cutoff : undefined,
            'eta_cutoff': [textgen_types.OOBA, textgen_types.MANCER].includes(api_type) ? settings.eta_cutoff : undefined,
            'mirostat_mode': settings.mirostat_mode,
            'mirostat_tau': settings.mirostat_tau,
            'mirostat_eta': settings.mirostat_eta,
            'custom_token_bans': [textgen_types.APHRODITE, textgen_types.MANCER].includes(settings.type) ? banned_tokens_array : banned_tokens_string,
            'banned_strings': banned_strings,
            'api_type': api_type,
            'api_server': api_server,
            'sampler_order': api_type === textgen_types.KOBOLDCPP ? settings.sampler_order : undefined,
            'xtc_threshold': settings.xtc_threshold,
            'xtc_probability': settings.xtc_probability,
            'nsigma': settings.nsigma,
            'stream': Boolean(settings.streaming),
            'bypass_status_check': Boolean(settings.bypass_status_check),
            'rep_pen_size': settings.rep_pen_size
        };

        // Create non-Aphrodite parameter set
        const nonAphroditeParams = {
            'rep_pen': settings.rep_pen,
            'rep_pen_range': settings.rep_pen_range,
            'repetition_decay': api_type === textgen_types.TABBY ? settings.rep_pen_decay : undefined,
            'repetition_penalty_range': settings.rep_pen_range,
            'encoder_repetition_penalty': api_type === textgen_types.OOBA ? settings.encoder_rep_pen : undefined,
            'no_repeat_ngram_size': api_type === textgen_types.OOBA ? settings.no_repeat_ngram_size : undefined,
            'penalty_alpha': api_type === textgen_types.OOBA ? settings.penalty_alpha : undefined,
            'temperature_last': (api_type === textgen_types.OOBA || api_type === textgen_types.APHRODITE || api_type === textgen_types.TABBY) ? settings.temperature_last : undefined,
            'speculative_ngram': api_type === textgen_types.TABBY ? settings.speculative_ngram : undefined,
            'do_sample': api_type === textgen_types.OOBA ? settings.do_sample : undefined,
            'seed': settings.seed >= 0 ? settings.seed : undefined,
            'guidance_scale': settings.guidance_scale || 1,
            'grammar_string': settings.grammar_string,
            'json_schema': [textgen_types.TABBY, textgen_types.LLAMACPP].includes(api_type) ? settings.json_schema : undefined,
            // llama.cpp aliases
            'repeat_penalty': settings.rep_pen,
            'tfs_z': settings.tfs,
            'repeat_last_n': settings.rep_pen_range,
            'n_predict': maxTokens,
            'num_predict': maxTokens,
            'mirostat': settings.mirostat_mode,
            'ignore_eos': settings.ban_eos_token,
            'rep_pen_slope': settings.rep_pen_slope,
        };

        // Create VLLM parameter set
        const vllmParams = {
            'n': settings.n > 1 ? settings.n : 1,
            'ignore_eos': settings.ignore_eos_token,
            'spaces_between_special_tokens': settings.spaces_between_special_tokens,
            'seed': settings.seed >= 0 ? settings.seed : undefined,
        };

        // Create Aphrodite parameter set
        const aphroditeParams = {
            'n': settings.n > 1 ? settings.n : 1,
            'frequency_penalty': settings.freq_pen,
            'presence_penalty': settings.presence_pen,
            'repetition_penalty': settings.rep_pen,
            'seed': settings.seed >= 0 ? settings.seed : undefined,
            'stop': payload.stop,
            'temperature': payload.temperature,
            'temperature_last': settings.temperature_last,
            'top_p': settings.top_p,
            'top_k': settings.top_k,
            'top_a': settings.top_a,
            'min_p': settings.min_p,
            'tfs': settings.tfs,
            'eta_cutoff': settings.eta_cutoff,
            'epsilon_cutoff': settings.epsilon_cutoff,
            'typical_p': settings.typical_p,
            'smoothing_factor': settings.smoothing_factor,
            'smoothing_curve': settings.smoothing_curve,
            'ignore_eos': settings.ignore_eos_token,
            'min_tokens': settings.min_length,
            'skip_special_tokens': settings.skip_special_tokens,
            'spaces_between_special_tokens': settings.spaces_between_special_tokens,
            'guided_grammar': settings.grammar_string,
            'guided_json': settings.json_schema,
            'early_stopping': false, // hardcoded as per legacy code
            'include_stop_str_in_output': false,
            'dynatemp_min': dynatemp ? settings.min_temp : undefined,
            'dynatemp_max': dynatemp ? settings.max_temp : undefined,
            'dynatemp_exponent': dynatemp ? settings.dynatemp_exponent : undefined,
            'xtc_threshold': settings.xtc_threshold,
            'xtc_probability': settings.xtc_probability,
            'nsigma': settings.nsigma,
            'custom_token_bans': banned_tokens_array,
            'no_repeat_ngram_size': settings.no_repeat_ngram_size,
            'sampler_priority': api_type === textgen_types.APHRODITE && !arraysEqual(
                settings.samplers_priorities,
                APHRODITE_DEFAULT_ORDER)
                ? settings.samplers_priorities
                : undefined,
        };

        // API-specific adjustments

        // OPENROUTER
        if (api_type === textgen_types.OPENROUTER) {
            payload.provider = settings.openrouter_providers;
            payload.allow_fallbacks = settings.openrouter_allow_fallbacks;
        }

        // KOBOLDCPP
        if (api_type === textgen_types.KOBOLDCPP) {
            payload.grammar = settings.grammar_string;
            payload.trim_stop = true;
        }

        // HUGGINGFACE
        if (api_type === textgen_types.HUGGINGFACE) {
            payload.top_p = Math.min(Math.max(Number(payload.top_p), 0.0), 0.999);
            payload.stop = Array.isArray(payload.stop) ? payload.stop.slice(0, 4) : [];
            nonAphroditeParams.seed = settings.seed >= 0 ? settings.seed : Math.floor(Math.random() * Math.pow(2, 32));
        }

        // MANCER
        if (api_type === textgen_types.MANCER) {
            payload.n = settings.n > 1 ? settings.n : 1;
            if (typeof payload.epsilon_cutoff === 'number') {
                payload.epsilon_cutoff /= 1000;
            }
            if (typeof payload.eta_cutoff === 'number') {
                payload.eta_cutoff /= 1000;
            }
            payload.dynatemp_mode = payload.dynamic_temperature ? 1 : 0;
            payload.dynatemp_min = payload.dynatemp_low;
            payload.dynatemp_max = payload.dynatemp_high;
            delete payload.dynatemp_low;
            delete payload.dynatemp_high;
        }

        // TABBY
        if (api_type === textgen_types.TABBY) {
            payload.n = settings.n > 1 ? settings.n : 1;
        }

        // Merge appropriate parameter sets based on API type
        switch (api_type) {
            case textgen_types.VLLM:
            case textgen_types.INFERMATICAI:
                payload = Object.assign(payload, vllmParams);
                break;

            case textgen_types.APHRODITE:
                payload = Object.assign(payload, aphroditeParams);
                break;

            default:
                payload = Object.assign(payload, nonAphroditeParams);
                break;
        }

        // Handle logit bias
        if (Array.isArray(settings.logit_bias) && settings.logit_bias.length > 0) {
            payload.logit_bias = settings.logit_bias;
        }

        // Special handling for LLAMACPP/OLLAMA
        if (api_type === textgen_types.LLAMACPP || api_type === textgen_types.OLLAMA) {
            // Convert bias and token bans to array of arrays
            const logitBiasArray = (payload.logit_bias && typeof payload.logit_bias === 'object' && Object.keys(payload.logit_bias).length > 0)
                ? Object.entries(payload.logit_bias).map(([key, value]) => [Number(key), value])
                : [];

            const tokenBans = banned_tokens_array;
            if (tokenBans.length > 0) {
                logitBiasArray.push(...tokenBans.map(x => [Number(x), false]));
            }

            // Parse dry_sequence_breakers
            let sequenceBreakers;
            try {
                if (typeof payload.dry_sequence_breakers === 'string') {
                    sequenceBreakers = JSON.parse(payload.dry_sequence_breakers);
                }
            } catch {
                if (typeof payload.dry_sequence_breakers === 'string') {
                    sequenceBreakers = payload.dry_sequence_breakers.split(',');
                }
            }

            const llamaCppParams = {
                'logit_bias': logitBiasArray.length > 0 ? logitBiasArray : undefined,
                'grammar': settings.grammar_string,
                'cache_prompt': true,
                'dry_sequence_breakers': sequenceBreakers,
            };

            payload = Object.assign(payload, llamaCppParams);

            if (!sequenceBreakers || (Array.isArray(sequenceBreakers) && sequenceBreakers.length === 0)) {
                delete payload.dry_sequence_breakers;
            }
        }

        // Handle grammar vs json_schema conflict for LLAMACPP
        if (api_type === textgen_types.LLAMACPP) {
            if (payload.json_schema && Object.keys(payload.json_schema).length > 0) {
                delete payload.grammar_string;
                delete payload.grammar;
            } else {
                delete payload.json_schema;
            }
        }

        // Remove undefined values to avoid API errors
        Object.keys(payload).forEach(key => {
            if (payload[key] === undefined) {
                delete payload[key];
            }
        });

        return payload;
    }

    /**
     * Quote and number arrays are supported.
     * @param {string} value
     * @returns {{banned_tokens_array: number[], banned_tokens_string: string, banned_strings: string[]}} {[1,2,3], "1,2,3", ["text"]}
     */
    static getBannedTokens(value) {
        if (!value) {
            return { banned_tokens_array: [], banned_tokens_string: '', banned_strings: [] };
        }

        const lines = value.split('\n');
        const banned_tokens_array = [];
        const banned_strings = [];
        for (const line of lines) {
            if (line.startsWith('[') && line.endsWith(']')) {
                try {
                    const tokens = JSON.parse(line);
                    banned_tokens_array.push(...tokens);
                } catch (error) {
                    console.log('Error parsing banned tokens:', line, error);
                }
            } else if (line.startsWith('"') && line.endsWith('"')) {
                banned_strings.push(line.slice(1, -1));
            }
        }

        const banned_tokens_string = banned_tokens_array.filter(onlyUnique).join(',');
        return { banned_tokens_array, banned_tokens_string, banned_strings };
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

        const payload = this.presetToGeneratePayload(preset, custom);

        const data = this.createRequestData({ ...payload, ...custom });

        return await this.sendRequest(data, extractData);
    }

    /**
     * Converts a preset to a valid chat completion payload
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

        // Remove undefined values to avoid API errors
        Object.keys(payload).forEach(key => {
            if (payload[key] === undefined) {
                delete payload[key];
            }
        });

        return payload;
    }
}
