import { getRequestHeaders } from "../../script.js";
import { extension_settings } from "../extensions.js";

/**
 * Generates a caption for an image using a multimodal model.
 * @param {string} base64Img Base64 encoded image
 * @param {string} prompt Prompt to use for captioning
 * @returns {Promise<string>} Generated caption
 */
export async function getMultimodalCaption(base64Img, prompt) {
    const apiResult = await fetch('/api/openai/caption-image', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            image: base64Img,
            prompt: prompt,
            api: extension_settings.caption.multimodal_api || 'openai',
            model: extension_settings.caption.multimodal_model || 'gpt-4-vision-preview',
        }),
    });

    if (!apiResult.ok) {
        throw new Error('Failed to caption image via OpenAI.');
    }

    const { caption } = await apiResult.json();
    return caption;
}
