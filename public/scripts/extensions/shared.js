import { getRequestHeaders } from '../../script.js';
import { extension_settings } from '../extensions.js';
import { SECRET_KEYS, secret_state } from '../secrets.js';
import { createThumbnail } from '../utils.js';

/**
 * Generates a caption for an image using a multimodal model.
 * @param {string} base64Img Base64 encoded image
 * @param {string} prompt Prompt to use for captioning
 * @returns {Promise<string>} Generated caption
 */
export async function getMultimodalCaption(base64Img, prompt) {
    if (extension_settings.caption.multimodal_api === 'openai' && !secret_state[SECRET_KEYS.OPENAI]) {
        throw new Error('OpenAI API key is not set.');
    }

    if (extension_settings.caption.multimodal_api === 'openrouter' && !secret_state[SECRET_KEYS.OPENROUTER]) {
        throw new Error('OpenRouter API key is not set.');
    }

    if (extension_settings.caption.multimodal_api === 'google' && !secret_state[SECRET_KEYS.MAKERSUITE]) {
        throw new Error('MakerSuite API key is not set.');
    }

    // OpenRouter has a payload limit of ~2MB. Google is 4MB, but we love democracy.
    const isGoogle = extension_settings.caption.multimodal_api === 'google';
    const base64Bytes = base64Img.length * 0.75;
    const compressionLimit = 2 * 1024 * 1024;
    if (['google', 'openrouter'].includes(extension_settings.caption.multimodal_api) && base64Bytes > compressionLimit) {
        const maxSide = 1024;
        base64Img = await createThumbnail(base64Img, maxSide, maxSide, 'image/jpeg');

        if (isGoogle) {
            base64Img = base64Img.split(',')[1];
        }
    }

    const apiResult = await fetch(`/api/${isGoogle ? 'google' : 'openai'}/caption-image`, {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            image: base64Img,
            prompt: prompt,
            ...(isGoogle
                ? {}
                : {
                    api: extension_settings.caption.multimodal_api || 'openai',
                    model: extension_settings.caption.multimodal_model || 'gpt-4-vision-preview',
                }),
        }),
    });

    if (!apiResult.ok) {
        throw new Error('Failed to caption image via OpenAI.');
    }

    const { caption } = await apiResult.json();
    return caption;
}
