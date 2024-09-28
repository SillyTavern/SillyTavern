import { getRequestHeaders } from '../../script.js';
import { extension_settings, openThirdPartyExtensionMenu } from '../extensions.js';
import { oai_settings } from '../openai.js';
import { SECRET_KEYS, secret_state } from '../secrets.js';
import { textgen_types, textgenerationwebui_settings } from '../textgen-settings.js';
import { createThumbnail, isValidUrl } from '../utils.js';

/**
 * Generates a caption for an image using a multimodal model.
 * @param {string} base64Img Base64 encoded image
 * @param {string} prompt Prompt to use for captioning
 * @returns {Promise<string>} Generated caption
 */
export async function getMultimodalCaption(base64Img, prompt) {
    const useReverseProxy =
        (['openai', 'anthropic', 'google', 'mistral'].includes(extension_settings.caption.multimodal_api))
        && extension_settings.caption.allow_reverse_proxy
        && oai_settings.reverse_proxy
        && isValidUrl(oai_settings.reverse_proxy);

    throwIfInvalidModel(useReverseProxy);

    const noPrefix = ['ollama', 'llamacpp'].includes(extension_settings.caption.multimodal_api);

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
    if ((['google', 'openrouter', 'mistral'].includes(extension_settings.caption.multimodal_api) && base64Bytes > compressionLimit) || isOoba || isKoboldCpp) {
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

    if (isOllama) {
        if (extension_settings.caption.multimodal_model === 'ollama_current') {
            requestBody.model = textgenerationwebui_settings.ollama_model;
        }

        requestBody.server_url = textgenerationwebui_settings.server_urls[textgen_types.OLLAMA];
    }

    if (isVllm) {
        if (extension_settings.caption.multimodal_model === 'vllm_current') {
            requestBody.model = textgenerationwebui_settings.vllm_model;
        }

        requestBody.server_url = textgenerationwebui_settings.server_urls[textgen_types.VLLM];
    }

    if (isLlamaCpp) {
        requestBody.server_url = textgenerationwebui_settings.server_urls[textgen_types.LLAMACPP];
    }

    if (isOoba) {
        requestBody.server_url = textgenerationwebui_settings.server_urls[textgen_types.OOBA];
    }

    if (isKoboldCpp) {
        requestBody.server_url = textgenerationwebui_settings.server_urls[textgen_types.KOBOLDCPP];
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
                return '/api/google/caption-image';
            case 'anthropic':
                return '/api/anthropic/caption-image';
            case 'llamacpp':
                return '/api/backends/text-completions/llamacpp/caption-image';
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
    if (extension_settings.caption.multimodal_api === 'openai' && !secret_state[SECRET_KEYS.OPENAI] && !useReverseProxy) {
        throw new Error('OpenAI API key is not set.');
    }

    if (extension_settings.caption.multimodal_api === 'openrouter' && !secret_state[SECRET_KEYS.OPENROUTER]) {
        throw new Error('OpenRouter API key is not set.');
    }

    if (extension_settings.caption.multimodal_api === 'anthropic' && !secret_state[SECRET_KEYS.CLAUDE] && !useReverseProxy) {
        throw new Error('Anthropic (Claude) API key is not set.');
    }

    if (extension_settings.caption.multimodal_api === 'zerooneai' && !secret_state[SECRET_KEYS.ZEROONEAI]) {
        throw new Error('01.AI API key is not set.');
    }

    if (extension_settings.caption.multimodal_api === 'google' && !secret_state[SECRET_KEYS.MAKERSUITE] && !useReverseProxy) {
        throw new Error('Google AI Studio API key is not set.');
    }

    if (extension_settings.caption.multi_modal_api === 'mistral' && !secret_state[SECRET_KEYS.MISTRALAI] && !useReverseProxy) {
        throw new Error('Mistral AI API key is not set.');
    }

    if (extension_settings.caption.multimodal_api === 'ollama' && !textgenerationwebui_settings.server_urls[textgen_types.OLLAMA]) {
        throw new Error('Ollama server URL is not set.');
    }

    if (extension_settings.caption.multimodal_api === 'ollama' && extension_settings.caption.multimodal_model === 'ollama_current' && !textgenerationwebui_settings.ollama_model) {
        throw new Error('Ollama model is not set.');
    }

    if (extension_settings.caption.multimodal_api === 'llamacpp' && !textgenerationwebui_settings.server_urls[textgen_types.LLAMACPP]) {
        throw new Error('LlamaCPP server URL is not set.');
    }

    if (extension_settings.caption.multimodal_api === 'ooba' && !textgenerationwebui_settings.server_urls[textgen_types.OOBA]) {
        throw new Error('Text Generation WebUI server URL is not set.');
    }

    if (extension_settings.caption.multimodal_api === 'koboldcpp' && !textgenerationwebui_settings.server_urls[textgen_types.KOBOLDCPP]) {
        throw new Error('KoboldCpp server URL is not set.');
    }

    if (extension_settings.caption.multimodal_api === 'vllm' && !textgenerationwebui_settings.server_urls[textgen_types.VLLM]) {
        throw new Error('vLLM server URL is not set.');
    }

    if (extension_settings.caption.multimodal_api === 'vllm' && extension_settings.caption.multimodal_model === 'vllm_current' && !textgenerationwebui_settings.vllm_model) {
        throw new Error('vLLM model is not set.');
    }

    if (extension_settings.caption.multimodal_api === 'custom' && !oai_settings.custom_url) {
        throw new Error('Custom API URL is not set.');
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
 * @param {string} text Text to count tokens in
 * @returns {Promise<number>} Number of tokens in the text
 */
export async function countWebLlmTokens(text) {
    if (!isWebLlmSupported()) {
        throw new Error('WebLLM extension is not installed.');
    }

    const engine = SillyTavern.llm;
    const response = await engine.countTokens(text);
    return response;
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
