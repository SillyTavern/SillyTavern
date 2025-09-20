import fetch from 'node-fetch';
import { SECRET_KEYS, readSecret } from '../endpoints/secrets.js';

/**
 * Gets the vectors for the given text batch from Electron Hub
 * @param {string[]} texts - The array of texts to get vectors for
 * @param {import('../users.js').UserDirectoryList} directories - The directories object for the user
 * @param {string} model - The model to use for embeddings
 * @returns {Promise<number[][]>} - The array of vectors for the texts
 */
export async function getElectronHubBatchVector(texts, directories, model) {
    const key = readSecret(directories, SECRET_KEYS.ELECTRONHUB);

    if (!key) {
        console.warn('Electron Hub: No API key found');
        throw new Error('No API key found');
    }

    const response = await fetch('https://api.electronhub.ai/v1/embeddings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
            input: texts,
            model: model,
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        console.warn('Electron Hub: API request failed', response.statusText, text);
        throw new Error(`API request failed: ${response.statusText} ${text}`);
    }

    /** @type {any} */
    const data = await response.json();
    if (!Array.isArray(data?.data)) {
        const message = 'Electron Hub: API response is not in the expected format.';
        console.warn(message, data);
        throw new Error(message);
    }

    // Ensure order by index
    data.data.sort((a, b) => a.index - b.index);
    const vectors = data.data.map(x => x.embedding);
    return vectors;
}

/**
 * Gets the vector for the given text from Electron Hub
 * @param {string} text - The text to get the vector for
 * @param {import('../users.js').UserDirectoryList} directories - The directories object for the user
 * @param {string} model - The model to use for embeddings
 * @returns {Promise<number[]>} - The vector for the text
 */
export async function getElectronHubVector(text, directories, model) {
    const vectors = await getElectronHubBatchVector([text], directories, model);
    return vectors[0];
}


