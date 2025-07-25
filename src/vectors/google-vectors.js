import fetch from 'node-fetch';
import { getGoogleApiConfig } from '../endpoints/google.js';

/**
 * Gets the vector for the given text from Google AI Studio
 * @param {string[]} texts - The array of texts to get the vector for
 * @param {string} model - The model to use for embedding
 * @param {import('express').Request} request - The request object to get API key and URL
 * @returns {Promise<number[][]>} - The array of vectors for the texts
 */
export async function getMakerSuiteBatchVector(texts, model, request) {
    const { url, headers, apiName } = await getGoogleApiConfig(request, model, 'batchEmbedContents');

    const body = {
        requests: texts.map(text => ({
            model: `models/${model}`,
            content: { parts: [{ text }] },
        })),
    };

    const response = await fetch(url, {
        body: JSON.stringify(body),
        method: 'POST',
        headers: headers,
    });

    if (!response.ok) {
        const text = await response.text();
        console.warn(`${apiName} batch request failed`, response.statusText, text);
        throw new Error(`${apiName} batch request failed`);
    }

    /** @type {any} */
    const data = await response.json();
    if (!Array.isArray(data?.embeddings)) {
        throw new Error(`${apiName} did not return an array`);
    }

    const embeddings = data.embeddings.map(embedding => embedding.values);
    return embeddings;
}

/**
 * Gets the vector for the given text from Google Vertex AI
 * @param {string[]} texts - The array of texts to get the vector for
 * @param {string} model - The model to use for embedding
 * @param {import('express').Request} request - The request object to get API key and URL
 * @returns {Promise<number[][]>} - The array of vectors for the texts
 */
export async function getVertexBatchVector(texts, model, request) {
    const { url, headers, apiName } = await getGoogleApiConfig(request, model, 'predict');

    const body = {
        instances: texts.map(text => ({ content: text })),
    };

    const response = await fetch(url, {
        body: JSON.stringify(body),
        method: 'POST',
        headers: headers,
    });

    if (!response.ok) {
        const text = await response.text();
        console.warn(`${apiName} batch request failed`, response.statusText, text);
        throw new Error(`${apiName} batch request failed`);
    }

    /** @type {any} */
    const data = await response.json();
    if (!Array.isArray(data?.predictions)) {
        throw new Error(`${apiName} did not return an array`);
    }

    const embeddings = data.predictions.map(p => p.embeddings.values);
    return embeddings;
}

/**
 * Gets the vector for the given text from Google AI Studio
 * @param {string} text - The text to get the vector for
 * @param {string} model - The model to use for embedding
 * @param {import('express').Request} request - The request object to get API key and URL
 * @returns {Promise<number[]>} - The vector for the text
 */
export async function getMakerSuiteVector(text, model, request) {
    const [embedding] = await getMakerSuiteBatchVector([text], model, request);
    return embedding;
}

/**
 * Gets the vector for the given text from Google Vertex AI
 * @param {string} text - The text to get the vector for
 * @param {string} model - The model to use for embedding
 * @param {import('express').Request} request - The request object to get API key and URL
 * @returns {Promise<number[]>} - The vector for the text
 */
export async function getVertexVector(text, model, request) {
    const [embedding] = await getVertexBatchVector([text], model, request);
    return embedding;
}
