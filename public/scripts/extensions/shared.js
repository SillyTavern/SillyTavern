import { CONNECT_API_MAP, getRequestHeaders } from '../../script.js';
import { extension_settings, openThirdPartyExtensionMenu } from '../extensions.js';
import { t } from '../i18n.js';
import { oai_settings, proxies } from '../openai.js';
import { SECRET_KEYS, secret_state } from '../secrets.js';
import { textgen_types, textgenerationwebui_settings } from '../textgen-settings.js';
import { getTokenCountAsync } from '../tokenizers.js';
import { createThumbnail, isValidUrl } from '../utils.js';

/**
 * Generates a caption for an image using a multimodal model.
 * @param {string} base64Img Base64 encoded image
 * @param {string} prompt Prompt to use for captioning
 * @returns {Promise<string>} Generated caption
 */
export async function getMultimodalCaption(base64Img, prompt) {
    const useReverseProxy =
        (['openai', 'anthropic', 'google', 'mistral', 'vertexai', 'xai'].includes(extension_settings.caption.multimodal_api))
        && extension_settings.caption.allow_reverse_proxy
        && oai_settings.reverse_proxy
        && isValidUrl(oai_settings.reverse_proxy);

    throwIfInvalidModel(useReverseProxy);

    const noPrefix = ['ollama'].includes(extension_settings.caption.multimodal_api);

    if (noPrefix && base64Img.startsWith('data:image/')) {
        base64Img = base64Img.split(',')[1];
    }

    // OpenRouter has a payload limit of ~2MB. Google is 4MB, but we love democracy.
    // Ooba requires all images to be JPEGs. Koboldcpp just asked nicely.
    const isOllama = extension_settings.caption.multimodal_api === 'ollama';
    const isLlamaCpp = extension_settings.caption.multimodal_api === 'llamacpp';
    const isCustom = extension_settings.caption.multimodal_api === 'custom';
    const isOoba = extension_settings.caption.multimodal_api === 'ooba';
    const isKoboldCpp = extension_settings.caption.multimodal_api === 'koboldcpp';
    const isVllm = extension_settings.caption.multimodal_api === 'vllm';
    const base64Bytes = base64Img.length * 0.75;
    const compressionLimit = 2 * 1024 * 1024;
    const thumbnailNeeded = ['google', 'openrouter', 'mistral', 'groq', 'vertexai'].includes(extension_settings.caption.multimodal_api);
    if ((thumbnailNeeded && base64Bytes > compressionLimit) || isOoba || isKoboldCpp) {
        const maxSide = 1024;
        base64Img = await createThumbnail(base64Img, maxSide, maxSide, 'image/jpeg');
    }

    const proxyUrl = useReverseProxy ? oai_settings.reverse_proxy : '';
    const proxyPassword = useReverseProxy ? oai_settings.proxy_password : '';

    const requestBody = {
        image: base64Img,
        prompt: prompt,
        reverse_proxy: proxyUrl,
        proxy_password: proxyPassword,
        api: extension_settings.caption.multimodal_api || 'openai',
        model: extension_settings.caption.multimodal_model || 'gpt-4-turbo',
    };

    // Add Vertex AI specific parameters if using Vertex AI
    if (extension_settings.caption.multimodal_api === 'vertexai') {
        requestBody.vertexai_auth_mode = oai_settings.vertexai_auth_mode;
        requestBody.vertexai_region = oai_settings.vertexai_region;
        requestBody.vertexai_express_project_id = oai_settings.vertexai_express_project_id;
    }

    if (isOllama) {
        if (extension_settings.caption.multimodal_model === 'ollama_current') {
            requestBody.model = textgenerationwebui_settings.ollama_model;
        }

        requestBody.server_url = extension_settings.caption.alt_endpoint_enabled
            ? extension_settings.caption.alt_endpoint_url
            : textgenerationwebui_settings.server_urls[textgen_types.OLLAMA];
    }

    if (isVllm) {
        if (extension_settings.caption.multimodal_model === 'vllm_current') {
            requestBody.model = textgenerationwebui_settings.vllm_model;
        }

        requestBody.server_url = extension_settings.caption.alt_endpoint_enabled
            ? extension_settings.caption.alt_endpoint_url
            : textgenerationwebui_settings.server_urls[textgen_types.VLLM];
    }

    if (isLlamaCpp) {
        requestBody.server_url = extension_settings.caption.alt_endpoint_enabled
            ? extension_settings.caption.alt_endpoint_url
            : textgenerationwebui_settings.server_urls[textgen_types.LLAMACPP];
    }

    if (isOoba) {
        requestBody.server_url = extension_settings.caption.alt_endpoint_enabled
            ? extension_settings.caption.alt_endpoint_url
            : textgenerationwebui_settings.server_urls[textgen_types.OOBA];
    }

    if (isKoboldCpp) {
        requestBody.server_url = extension_settings.caption.alt_endpoint_enabled
            ? extension_settings.caption.alt_endpoint_url
            : textgenerationwebui_settings.server_urls[textgen_types.KOBOLDCPP];
    }

    if (isCustom) {
        requestBody.server_url = oai_settings.custom_url;
        requestBody.model = oai_settings.custom_model || 'gpt-4-turbo';
        requestBody.custom_include_headers = oai_settings.custom_include_headers;
        requestBody.custom_include_body = oai_settings.custom_include_body;
        requestBody.custom_exclude_body = oai_settings.custom_exclude_body;
    }

    function getEndpointUrl() {
        switch (extension_settings.caption.multimodal_api) {
            case 'google':
            case 'vertexai':
                return '/api/google/caption-image';
            case 'anthropic':
                return '/api/anthropic/caption-image';
            case 'ollama':
                return '/api/backends/text-completions/ollama/caption-image';
            default:
                return '/api/openai/caption-image';
        }
    }

    const apiResult = await fetch(getEndpointUrl(), {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(requestBody),
    });

    if (!apiResult.ok) {
        throw new Error('Failed to caption image via Multimodal API.');
    }

    const { caption } = await apiResult.json();
    return String(caption).trim();
}

function throwIfInvalidModel(useReverseProxy) {
    const altEndpointEnabled = extension_settings.caption.alt_endpoint_enabled;
    const altEndpointUrl = extension_settings.caption.alt_endpoint_url;
    const multimodalModel = extension_settings.caption.multimodal_model;
    const multimodalApi = extension_settings.caption.multimodal_api;

    if (altEndpointEnabled && ['llamacpp', 'ooba', 'koboldcpp', 'vllm', 'ollama'].includes(multimodalApi) && !altEndpointUrl) {
        throw new Error('Secondary endpoint URL is not set.');
    }

    if (multimodalApi === 'openai' && !secret_state[SECRET_KEYS.OPENAI] && !useReverseProxy) {
        throw new Error('OpenAI API key is not set.');
    }

    if (multimodalApi === 'openrouter' && !secret_state[SECRET_KEYS.OPENROUTER]) {
        throw new Error('OpenRouter API key is not set.');
    }

    if (multimodalApi === 'anthropic' && !secret_state[SECRET_KEYS.CLAUDE] && !useReverseProxy) {
        throw new Error('Anthropic (Claude) API key is not set.');
    }

    if (multimodalApi === 'zerooneai' && !secret_state[SECRET_KEYS.ZEROONEAI]) {
        throw new Error('01.AI API key is not set.');
    }

    if (multimodalApi === 'groq' && !secret_state[SECRET_KEYS.GROQ]) {
        throw new Error('Groq API key is not set.');
    }

    if (multimodalApi === 'google' && !secret_state[SECRET_KEYS.MAKERSUITE] && !useReverseProxy) {
        throw new Error('Google AI Studio API key is not set.');
    }

    if (multimodalApi === 'vertexai' && !useReverseProxy) {
        // Check based on authentication mode
        const authMode = oai_settings.vertexai_auth_mode || 'express';

        if (authMode === 'express') {
            // Express mode requires API key
            if (!secret_state[SECRET_KEYS.VERTEXAI]) {
                throw new Error('Google Vertex AI API key is not set for Express mode.');
            }
        } else if (authMode === 'full') {
            // Full mode requires Service Account JSON and region settings
            if (!secret_state[SECRET_KEYS.VERTEXAI_SERVICE_ACCOUNT]) {
                throw new Error('Service Account JSON is required for Vertex AI Full mode. Please validate and save your Service Account JSON.');
            }
            if (!oai_settings.vertexai_region) {
                throw new Error('Region is required for Vertex AI Full mode.');
            }
        }
    }

    if (multimodalApi === 'mistral' && !secret_state[SECRET_KEYS.MISTRALAI] && !useReverseProxy) {
        throw new Error('Mistral AI API key is not set.');
    }

    if (multimodalApi === 'cohere' && !secret_state[SECRET_KEYS.COHERE]) {
        throw new Error('Cohere API key is not set.');
    }

    if (multimodalApi === 'xai' && !secret_state[SECRET_KEYS.XAI] && !useReverseProxy) {
        throw new Error('xAI API key is not set.');
    }

    if (multimodalApi === 'ollama' && !textgenerationwebui_settings.server_urls[textgen_types.OLLAMA] && !altEndpointEnabled) {
        throw new Error('Ollama server URL is not set.');
    }

    if (multimodalApi === 'ollama' && multimodalModel === 'ollama_current' && !textgenerationwebui_settings.ollama_model) {
        throw new Error('Ollama model is not set.');
    }

    if (multimodalApi === 'llamacpp' && !textgenerationwebui_settings.server_urls[textgen_types.LLAMACPP] && !altEndpointEnabled) {
        throw new Error('LlamaCPP server URL is not set.');
    }

    if (multimodalApi === 'ooba' && !textgenerationwebui_settings.server_urls[textgen_types.OOBA] && !altEndpointEnabled) {
        throw new Error('Text Generation WebUI server URL is not set.');
    }

    if (multimodalApi === 'koboldcpp' && !textgenerationwebui_settings.server_urls[textgen_types.KOBOLDCPP] && !altEndpointEnabled) {
        throw new Error('KoboldCpp server URL is not set.');
    }

    if (multimodalApi === 'vllm' && !textgenerationwebui_settings.server_urls[textgen_types.VLLM] && !altEndpointEnabled) {
        throw new Error('vLLM server URL is not set.');
    }

    if (multimodalApi === 'vllm' && multimodalModel === 'vllm_current' && !textgenerationwebui_settings.vllm_model) {
        throw new Error('vLLM model is not set.');
    }

    if (multimodalApi === 'custom' && !oai_settings.custom_url) {
        throw new Error('Custom API URL is not set.');
    }

    if (multimodalApi === 'aimlapi' && !secret_state[SECRET_KEYS.AIMLAPI]) {
        throw new Error('AI/ML API key is not set.');
    }
}

/**
 * Check if the WebLLM extension is installed and supported.
 * @returns {boolean} Whether the extension is installed and supported
 */
export function isWebLlmSupported() {
    if (!('gpu' in navigator)) {
        const warningKey = 'webllm_browser_warning_shown';
        if (!sessionStorage.getItem(warningKey)) {
            toastr.error('Your browser does not support the WebGPU API. Please use a different browser.', 'WebLLM', {
                preventDuplicates: true,
                timeOut: 0,
                extendedTimeOut: 0,
            });
            sessionStorage.setItem(warningKey, '1');
        }
        return false;
    }

    if (!('llm' in SillyTavern)) {
        const warningKey = 'webllm_extension_warning_shown';
        if (!sessionStorage.getItem(warningKey)) {
            toastr.error('WebLLM extension is not installed. Click here to install it.', 'WebLLM', {
                timeOut: 0,
                extendedTimeOut: 0,
                preventDuplicates: true,
                onclick: () => openThirdPartyExtensionMenu('https://github.com/SillyTavern/Extension-WebLLM'),
            });
            sessionStorage.setItem(warningKey, '1');
        }
        return false;
    }

    return true;
}

/**
 * Generates text in response to a chat prompt using WebLLM.
 * @param {any[]} messages Messages to use for generating
 * @param {object} params Additional parameters
 * @returns {Promise<string>} Generated response
 */
export async function generateWebLlmChatPrompt(messages, params = {}) {
    if (!isWebLlmSupported()) {
        throw new Error('WebLLM extension is not installed.');
    }

    console.debug('WebLLM chat completion request:', messages, params);
    const engine = SillyTavern.llm;
    const response = await engine.generateChatPrompt(messages, params);
    console.debug('WebLLM chat completion response:', response);
    return response;
}

/**
 * Counts the number of tokens in the provided text using WebLLM's default model.
 * Fallbacks to the current model's tokenizer if WebLLM token count fails.
 * @param {string} text Text to count tokens in
 * @returns {Promise<number>} Number of tokens in the text
 */
export async function countWebLlmTokens(text) {
    if (!isWebLlmSupported()) {
        throw new Error('WebLLM extension is not installed.');
    }

    try {
        const engine = SillyTavern.llm;
        const response = await engine.countTokens(text);
        return response;
    } catch (error) {
        // Fallback to using current model's tokenizer
        return await getTokenCountAsync(text);
    }
}

/**
 * Gets the size of the context in the WebLLM's default model.
 * @returns {Promise<number>} Size of the context in the WebLLM model
 */
export async function getWebLlmContextSize() {
    if (!isWebLlmSupported()) {
        throw new Error('WebLLM extension is not installed.');
    }

    const engine = SillyTavern.llm;
    await engine.loadModel();
    const model = await engine.getCurrentModelInfo();
    return model?.context_size;
}

/**
 * It uses the profiles to send a generate request to the API.
 */
export class ConnectionManagerRequestService {
    static defaultSendRequestParams = {
        stream: false,
        signal: null,
        extractData: true,
        includePreset: true,
        includeInstruct: true,
        instructSettings: {},
    };

    static getAllowedTypes() {
        return {
            openai: t`Chat Completion`,
            textgenerationwebui: t`Text Completion`,
        };
    }

    /**
     * @param {string} profileId
     * @param {string | (import('../custom-request.js').ChatCompletionMessage & {ignoreInstruct?: boolean})[]} prompt
     * @param {number} maxTokens
     * @param {Object} custom
     * @param {boolean?} [custom.stream=false]
     * @param {AbortSignal?} [custom.signal]
     * @param {boolean?} [custom.extractData=true]
     * @param {boolean?} [custom.includePreset=true]
     * @param {boolean?} [custom.includeInstruct=true]
     * @param {Partial<InstructSettings>?} [custom.instructSettings] Override instruct settings
     * @param {Record<string, any>} [overridePayload] - Override payload for the request
     * @returns {Promise<import('../custom-request.js').ExtractedData | (() => AsyncGenerator<import('../custom-request.js').StreamResponse>)>} If not streaming, returns extracted data; if streaming, returns a function that creates an AsyncGenerator
     */
    static async sendRequest(profileId, prompt, maxTokens, custom = this.defaultSendRequestParams, overridePayload = {}) {
        const { stream, signal, extractData, includePreset, includeInstruct, instructSettings } = { ...this.defaultSendRequestParams, ...custom };

        const context = SillyTavern.getContext();
        if (context.extensionSettings.disabledExtensions.includes('connection-manager')) {
            throw new Error('Connection Manager is not available');
        }

        const profile = context.extensionSettings.connectionManager.profiles.find((p) => p.id === profileId);
        const selectedApiMap = this.validateProfile(profile);

        try {
            switch (selectedApiMap.selected) {
                case 'openai': {
                    if (!selectedApiMap.source) {
                        throw new Error(`API type ${selectedApiMap.selected} does not support chat completions`);
                    }

                    const proxyPreset = proxies.find((p) => p.name === profile.proxy);

                    const messages = Array.isArray(prompt) ? prompt : [{ role: 'user', content: prompt }];
                    return await context.ChatCompletionService.processRequest({
                        stream,
                        messages,
                        max_tokens: maxTokens,
                        model: profile.model,
                        chat_completion_source: selectedApiMap.source,
                        custom_url: profile['api-url'],
                        reverse_proxy: proxyPreset?.url,
                        proxy_password: proxyPreset?.password,
                        ...overridePayload,
                    }, {
                        presetName: includePreset ? profile.preset : undefined,
                    }, extractData, signal);
                }
                case 'textgenerationwebui': {
                    if (!selectedApiMap.type) {
                        throw new Error(`API type ${selectedApiMap.selected} does not support text completions`);
                    }

                    return await context.TextCompletionService.processRequest({
                        stream,
                        prompt,
                        max_tokens: maxTokens,
                        model: profile.model,
                        api_type: selectedApiMap.type,
                        api_server: profile['api-url'],
                        ...overridePayload,
                    }, {
                        instructName: includeInstruct ? profile.instruct : undefined,
                        presetName: includePreset ? profile.preset : undefined,
                        instructSettings: includeInstruct ? instructSettings : undefined,
                    }, extractData, signal);
                }
                default: {
                    throw new Error(`Unknown API type ${selectedApiMap.selected}`);
                }
            }
        } catch (error) {
            throw new Error('API request failed', { cause: error });
        }
    }

    /**
     * Respects allowed types.
     * @returns {import('./connection-manager/index.js').ConnectionProfile[]}
     */
    static getSupportedProfiles() {
        const context = SillyTavern.getContext();
        if (context.extensionSettings.disabledExtensions.includes('connection-manager')) {
            throw new Error('Connection Manager is not available');
        }

        const profiles = context.extensionSettings.connectionManager.profiles;
        return profiles.filter((p) => this.isProfileSupported(p));
    }

    /**
     * @param {import('./connection-manager/index.js').ConnectionProfile?} [profile]
     * @returns {boolean}
     */
    static isProfileSupported(profile) {
        if (!profile || !profile.api) {
            return false;
        }

        const apiMap = CONNECT_API_MAP[profile.api];
        if (!Object.hasOwn(this.getAllowedTypes(), apiMap.selected)) {
            return false;
        }

        // Some providers not need model, like koboldcpp. But I don't want to check by provider.
        switch (apiMap.selected) {
            case 'openai':
                return !!apiMap.source;
            case 'textgenerationwebui':
                return !!apiMap.type;
        }

        return false;
    }

    /**
     * @param {import('./connection-manager/index.js').ConnectionProfile?} [profile]
     * @return {import('../../script.js').ConnectAPIMap}
     * @throws {Error}
     */
    static validateProfile(profile) {
        if (!profile) {
            throw new Error('Could not find profile.');
        }
        if (!profile.api) {
            throw new Error('Select a connection profile that has an API');
        }

        const context = SillyTavern.getContext();
        const selectedApiMap = context.CONNECT_API_MAP[profile.api];
        if (!selectedApiMap) {
            throw new Error(`Unknown API type ${profile.api}`);
        }
        if (!Object.hasOwn(this.getAllowedTypes(), selectedApiMap.selected)) {
            throw new Error(`API type ${selectedApiMap.selected} is not supported. Supported types: ${Object.values(this.getAllowedTypes()).join(', ')}`);
        }

        return selectedApiMap;
    }

    /**
     * Create profiles dropdown and updates select element accordingly. Use onChange, onCreate, unUpdate, onDelete callbacks for custom behaviour. e.g updating extension settings.
     * @param {string} selector
     * @param {string} initialSelectedProfileId
     * @param {(profile?: import('./connection-manager/index.js').ConnectionProfile) => Promise<void> | void} onChange - 3 cases. 1- When user selects new profile. 2- When user deletes selected profile. 3- When user updates selected profile.
     * @param {(profile: import('./connection-manager/index.js').ConnectionProfile) => Promise<void> | void} onCreate
     * @param {(oldProfile: import('./connection-manager/index.js').ConnectionProfile, newProfile: import('./connection-manager/index.js').ConnectionProfile) => Promise<void> | void} unUpdate
     * @param {(profile: import('./connection-manager/index.js').ConnectionProfile) => Promise<void> | void} onDelete
     */
    static handleDropdown(
        selector,
        initialSelectedProfileId,
        onChange = () => { },
        onCreate = () => { },
        unUpdate = () => { },
        onDelete = () => { },
    ) {
        const context = SillyTavern.getContext();
        if (context.extensionSettings.disabledExtensions.includes('connection-manager')) {
            throw new Error('Connection Manager is not available');
        }

        /**
         * @type {JQuery<HTMLSelectElement>}
         */
        const dropdown = $(selector);

        if (!dropdown || !dropdown.length) {
            throw new Error(`Could not find dropdown with selector ${selector}`);
        }

        dropdown.empty();

        // Create default option using document.createElement
        const defaultOption = document.createElement('option');
        defaultOption.value = '';
        defaultOption.textContent = 'Select a Connection Profile';
        defaultOption.dataset.i18n = 'Select a Connection Profile';
        dropdown.append(defaultOption);

        const profiles = context.extensionSettings.connectionManager.profiles;

        // Create optgroups using document.createElement
        const groups = {};
        for (const [apiType, groupLabel] of Object.entries(this.getAllowedTypes())) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = groupLabel;
            groups[apiType] = optgroup;
        }

        const sortedProfilesByGroup = {};
        for (const apiType of Object.keys(this.getAllowedTypes())) {
            sortedProfilesByGroup[apiType] = [];
        }

        for (const profile of profiles) {
            if (this.isProfileSupported(profile)) {
                const apiMap = CONNECT_API_MAP[profile.api];
                if (sortedProfilesByGroup[apiMap.selected]) {
                    sortedProfilesByGroup[apiMap.selected].push(profile);
                }
            }
        }

        // Sort each group alphabetically and add to dropdown
        for (const [apiType, groupProfiles] of Object.entries(sortedProfilesByGroup)) {
            if (groupProfiles.length === 0) continue;

            groupProfiles.sort((a, b) => a.name.localeCompare(b.name));

            const group = groups[apiType];
            for (const profile of groupProfiles) {
                const option = document.createElement('option');
                option.value = profile.id;
                option.textContent = profile.name;
                group.appendChild(option);
            }
        }

        for (const group of Object.values(groups)) {
            if (group.children.length > 0) {
                dropdown.append(group);
            }
        }

        const selectedProfile = profiles.find((p) => p.id === initialSelectedProfileId);
        if (selectedProfile) {
            dropdown.val(selectedProfile.id);
        }

        context.eventSource.on(context.eventTypes.CONNECTION_PROFILE_CREATED, async (profile) => {
            const isSupported = this.isProfileSupported(profile);
            if (!isSupported) {
                return;
            }

            const group = groups[CONNECT_API_MAP[profile.api].selected];
            const option = document.createElement('option');
            option.value = profile.id;
            option.textContent = profile.name;
            group.appendChild(option);

            await onCreate(profile);
        });

        context.eventSource.on(context.eventTypes.CONNECTION_PROFILE_UPDATED, async (oldProfile, newProfile) => {
            const currentSelected = dropdown.val();
            const isSelectedProfile = currentSelected === oldProfile.id;
            await unUpdate(oldProfile, newProfile);

            if (!this.isProfileSupported(newProfile)) {
                if (isSelectedProfile) {
                    dropdown.val('');
                    dropdown.trigger('change');
                }
                return;
            }

            const group = groups[CONNECT_API_MAP[newProfile.api].selected];
            const oldOption = group.querySelector(`option[value="${oldProfile.id}"]`);
            if (oldOption) {
                oldOption.remove();
            }

            const option = document.createElement('option');
            option.value = newProfile.id;
            option.textContent = newProfile.name;
            group.appendChild(option);

            if (isSelectedProfile) {
                // Ackchyually, we don't need to reselect but what if id changes? It is not possible for now I couldn't stop myself.
                dropdown.val(newProfile.id);
                dropdown.trigger('change');
            }
        });

        context.eventSource.on(context.eventTypes.CONNECTION_PROFILE_DELETED, async (profile) => {
            const currentSelected = dropdown.val();
            const isSelectedProfile = currentSelected === profile.id;
            if (!this.isProfileSupported(profile)) {
                return;
            }

            const group = groups[CONNECT_API_MAP[profile.api].selected];
            const optionToRemove = group.querySelector(`option[value="${profile.id}"]`);
            if (optionToRemove) {
                optionToRemove.remove();
            }

            if (isSelectedProfile) {
                dropdown.val('');
                dropdown.trigger('change');
            }

            await onDelete(profile);
        });

        dropdown.on('change', async () => {
            const profileId = dropdown.val();
            const profile = context.extensionSettings.connectionManager.profiles.find((p) => p.id === profileId);
            await onChange(profile);
        });
    }
}
