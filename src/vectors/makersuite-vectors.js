import fetch from 'node-fetch';
import { getGoogleApiConfig } from '../endpoints/google.js';

/**
 * Gets the vector for the given text from gecko model
 * @param {string[]} texts - The array of texts to get the vector for
 * @param {string} model - The model to use for embedding
 * @param {import('express').Request} request - The request object to get API key and URL
 * @returns {Promise<number[][]>} - The array of vectors for the texts
 */
export async function getMakerSuiteBatchVector(texts, model, request) {
    const promises = texts.map(text => getMakerSuiteVector(text, model, request));
    return await Promise.all(promises);
}

/**
 * Gets the vector for the given text from Gemini API text-embedding-004 model
 * @param {string} text - The text to get the vector for
 * @param {string} model - The model to use for embedding (default is 'text-embedding-004')
 * @param {import('express').Request} request - The request object to get API key and URL
 * @returns {Promise<number[]>} - The vector for the text
 */
export async function getMakerSuiteVector(text, model, request) {
    const { url, headers, apiName } = await getGoogleApiConfig(request, model, 'embedContent');

    const body = {
        content: {
            parts: [
                { text: text },
            ],
        },
    };

    const response = await fetch(url, {
        body: JSON.stringify(body),
        method: 'POST',
        headers: headers,
    });

    if (!response.ok) {
        const text = await response.text();
        console.warn(`${apiName} request failed`, response.statusText, text);
        throw new Error(`${apiName} request failed`);
    }

    /** @type {any} */
    const data = await response.json();
    // noinspection JSValidateTypes
    return data['embedding']['values'];
}
