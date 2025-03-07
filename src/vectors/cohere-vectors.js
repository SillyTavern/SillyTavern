import fetch from 'node-fetch';
import { SECRET_KEYS, readSecret } from '../endpoints/secrets.js';

/**
 * Gets the vector for the given text batch from an OpenAI compatible endpoint.
 * @param {string[]} texts - The array of texts to get the vector for
 * @param {boolean} isQuery - If the text is a query for embedding search
 * @param {import('../users.js').UserDirectoryList} directories - The directories object for the user
 * @param {string} model - The model to use for the embedding
 * @returns {Promise<number[][]>} - The array of vectors for the texts
 */
export async function getCohereBatchVector(texts, isQuery, directories, model) {
    const key = readSecret(directories, SECRET_KEYS.COHERE);

    if (!key) {
        console.warn('No API key found');
        throw new Error('No API key found');
    }

    const response = await fetch('https://api.cohere.ai/v2/embed', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
            texts: texts,
            model: model,
            embedding_types: ['float'],
            input_type: isQuery ? 'search_query' : 'search_document',
            truncate: 'END',
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        console.warn('API request failed', response.statusText, text);
        throw new Error('API request failed');
    }

    /** @type {any} */
    const data = await response.json();
    if (!Array.isArray(data?.embeddings?.float)) {
        console.warn('API response was not an array');
        throw new Error('API response was not an array');
    }

    return data.embeddings.float;
}

/**
 * Gets the vector for the given text from an OpenAI compatible endpoint.
 * @param {string} text - The text to get the vector for
 * @param {boolean} isQuery - If the text is a query for embedding search
 * @param {import('../users.js').UserDirectoryList} directories - The directories object for the user
 * @param {string} model - The model to use for the embedding
 * @returns {Promise<number[]>} - The vector for the text
 */
export async function getCohereVector(text, isQuery, directories, model) {
    const vectors = await getCohereBatchVector([text], isQuery, directories, model);
    return vectors[0];
}

