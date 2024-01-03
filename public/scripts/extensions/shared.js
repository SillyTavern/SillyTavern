import { getRequestHeaders } from '../../script.js';
import { extension_settings } from '../extensions.js';
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
    throwIfInvalidModel();

    const noPrefix = ['google', 'ollama', 'llamacpp'].includes(extension_settings.caption.multimodal_api);

    if (noPrefix && base64Img.startsWith('data:image/')) {
        base64Img = base64Img.split(',')[1];
    }

    // OpenRouter has a payload limit of ~2MB. Google is 4MB, but we love democracy.
    // Ooba requires all images to be JPEGs.
    const isGoogle = extension_settings.caption.multimodal_api === 'google';
    const isOllama = extension_settings.caption.multimodal_api === 'ollama';
    const isLlamaCpp = extension_settings.caption.multimodal_api === 'llamacpp';
    const isCustom = extension_settings.caption.multimodal_api === 'custom';
    const isOoba = extension_settings.caption.multimodal_api === 'ooba';
    const base64Bytes = base64Img.length * 0.75;
    const compressionLimit = 2 * 1024 * 1024;
    if ((['google', 'openrouter'].includes(extension_settings.caption.multimodal_api) && base64Bytes > compressionLimit) || isOoba) {
        const maxSide = 1024;
        base64Img = await createThumbnail(base64Img, maxSide, maxSide, 'image/jpeg');

        if (isGoogle) {
            base64Img = base64Img.split(',')[1];
        }
    }

    const useReverseProxy =
        extension_settings.caption.multimodal_api === 'openai'
        && extension_settings.caption.allow_reverse_proxy
        && oai_settings.reverse_proxy
        && isValidUrl(oai_settings.reverse_proxy);

    const proxyUrl = useReverseProxy ? oai_settings.reverse_proxy : '';
    const proxyPassword = useReverseProxy ? oai_settings.proxy_password : '';

    const requestBody = {
        image: base64Img,
        prompt: prompt,
    };

    if (!isGoogle) {
        requestBody.api = extension_settings.caption.multimodal_api || 'openai';
        requestBody.model = extension_settings.caption.multimodal_model || 'gpt-4-vision-preview';
        requestBody.reverse_proxy = proxyUrl;
        requestBody.proxy_password = proxyPassword;
    }

    if (isOllama) {
        if (extension_settings.caption.multimodal_model === 'ollama_current') {
            requestBody.model = textgenerationwebui_settings.ollama_model;
        }

        requestBody.server_url = textgenerationwebui_settings.server_urls[textgen_types.OLLAMA];
    }

    if (isLlamaCpp) {
        requestBody.server_url = textgenerationwebui_settings.server_urls[textgen_types.LLAMACPP];
    }

    if (isOoba) {
        requestBody.server_url = textgenerationwebui_settings.server_urls[textgen_types.OOBA];
    }

    if (isCustom) {
        requestBody.server_url = oai_settings.custom_url;
        requestBody.model = oai_settings.custom_model || 'gpt-4-vision-preview';
        requestBody.custom_include_headers = oai_settings.custom_include_headers;
        requestBody.custom_include_body = oai_settings.custom_include_body;
        requestBody.custom_exclude_body = oai_settings.custom_exclude_body;
    }

    function getEndpointUrl() {
        switch (extension_settings.caption.multimodal_api) {
            case 'google':
                return '/api/google/caption-image';
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

function throwIfInvalidModel() {
    if (extension_settings.caption.multimodal_api === 'openai' && !secret_state[SECRET_KEYS.OPENAI]) {
        throw new Error('OpenAI API key is not set.');
    }

    if (extension_settings.caption.multimodal_api === 'openrouter' && !secret_state[SECRET_KEYS.OPENROUTER]) {
        throw new Error('OpenRouter API key is not set.');
    }

    if (extension_settings.caption.multimodal_api === 'google' && !secret_state[SECRET_KEYS.MAKERSUITE]) {
        throw new Error('MakerSuite API key is not set.');
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

    if (extension_settings.caption.multimodal_api === 'custom' && !oai_settings.custom_url) {
        throw new Error('Custom API URL is not set.');
    }
}
