const fetch = require('node-fetch').default;
const { setAdditionalHeadersByType } = require('../additional-headers');
const { TEXTGEN_TYPES } = require('../constants');

/**
 * Gets the vector for the given text from VLLM
 * @param {string[]} texts - The array of texts to get the vectors for
 * @param {string} apiUrl - The API URL
 * @param {string} model - The model to use
 * @param {import('../users').UserDirectoryList} directories - The directories object for the user
 * @returns {Promise<number[][]>} - The array of vectors for the texts
 */
async function getVllmBatchVector(texts, apiUrl, model, directories) {
    const url = new URL(apiUrl);
    url.pathname = '/v1/embeddings';

    const headers = {};
    setAdditionalHeadersByType(headers, TEXTGEN_TYPES.VLLM, apiUrl, directories);

    const response = await fetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            ...headers,
        },
        body: JSON.stringify({ input: texts, model }),
    });

    if (!response.ok) {
        const responseText = await response.text();
        throw new Error(`VLLM: Failed to get vector for text: ${response.statusText} ${responseText}`);
    }

    const data = await response.json();

    if (!Array.isArray(data?.data)) {
        throw new Error('API response was not an array');
    }

    // Sort data by x.index to ensure the order is correct
    data.data.sort((a, b) => a.index - b.index);

    const vectors = data.data.map(x => x.embedding);
    return vectors;
}

/**
 * Gets the vector for the given text from VLLM
 * @param {string} text - The text to get the vector for
 * @param {string} apiUrl - The API URL
 * @param {string} model - The model to use
 * @param {import('../users').UserDirectoryList} directories - The directories object for the user
 * @returns {Promise<number[]>} - The vector for the text
 */
async function getVllmVector(text, apiUrl, model, directories) {
    const vectors = await getVllmBatchVector([text], apiUrl, model, directories);
    return vectors[0];
}

module.exports = {
    getVllmBatchVector,
    getVllmVector,
};
