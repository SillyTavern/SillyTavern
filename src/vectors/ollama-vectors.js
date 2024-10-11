import fetch from 'node-fetch';
import { setAdditionalHeadersByType } from '../additional-headers.js';
import { TEXTGEN_TYPES } from '../constants.js';

/**
 * Gets the vector for the given text from Ollama
 * @param {string[]} texts - The array of texts to get the vectors for
 * @param {string} apiUrl - The API URL
 * @param {string} model - The model to use
 * @param {boolean} keep - Keep the model loaded in memory
 * @param {import('../users.js').UserDirectoryList} directories - The directories object for the user
 * @returns {Promise<number[][]>} - The array of vectors for the texts
 */
export async function getOllamaBatchVector(texts, apiUrl, model, keep, directories) {
    const result = [];
    for (const text of texts) {
        const vector = await getOllamaVector(text, apiUrl, model, keep, directories);
        result.push(vector);
    }
    return result;
}

/**
 * Gets the vector for the given text from Ollama
 * @param {string} text - The text to get the vector for
 * @param {string} apiUrl - The API URL
 * @param {string} model - The model to use
 * @param {boolean} keep - Keep the model loaded in memory
 * @param {import('../users.js').UserDirectoryList} directories - The directories object for the user
 * @returns {Promise<number[]>} - The vector for the text
 */
export async function getOllamaVector(text, apiUrl, model, keep, directories) {
    const url = new URL(apiUrl);
    url.pathname = '/api/embeddings';

    const headers = {};
    setAdditionalHeadersByType(headers, TEXTGEN_TYPES.OLLAMA, apiUrl, directories);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
        body: JSON.stringify({
            prompt: text,
            model: model,
            keep_alive: keep ? -1 : undefined,
        }),
    });

    if (!response.ok) {
        const responseText = await response.text();
        throw new Error(`Ollama: Failed to get vector for text: ${response.statusText} ${responseText}`);
    }

    /** @type {any} */
    const data = await response.json();

    if (!Array.isArray(data?.embedding)) {
        throw new Error('API response was not an array');
    }

    return data.embedding;
}
