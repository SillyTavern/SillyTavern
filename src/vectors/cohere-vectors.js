const fetch = require('node-fetch').default;
const { SECRET_KEYS, readSecret } = require('../endpoints/secrets');

/**
 * Gets the vector for the given text batch from an OpenAI compatible endpoint.
 * @param {string[]} texts - The array of texts to get the vector for
 * @param {boolean} isQuery - If the text is a query for embedding search
 * @param {import('../users').UserDirectoryList} directories - The directories object for the user
 * @param {string} model - The model to use for the embedding
 * @returns {Promise<number[][]>} - The array of vectors for the texts
 */
async function getCohereBatchVector(texts, isQuery, directories, model) {
    const key = readSecret(directories, SECRET_KEYS.COHERE);

    if (!key) {
        console.log('No API key found');
        throw new Error('No API key found');
    }

    const response = await fetch('https://api.cohere.ai/v1/embed', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
            texts: texts,
            model: model,
            input_type: isQuery ? 'search_query' : 'search_document',
            truncate: 'END',
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        console.log('API request failed', response.statusText, text);
        throw new Error('API request failed');
    }

    const data = await response.json();
    if (!Array.isArray(data?.embeddings)) {
        console.log('API response was not an array');
        throw new Error('API response was not an array');
    }

    return data.embeddings;
}

/**
 * Gets the vector for the given text from an OpenAI compatible endpoint.
 * @param {string} text - The text to get the vector for
 * @param {boolean} isQuery - If the text is a query for embedding search
 * @param {import('../users').UserDirectoryList} directories - The directories object for the user
 * @param {string} model - The model to use for the embedding
 * @returns {Promise<number[]>} - The vector for the text
 */
async function getCohereVector(text, isQuery, directories, model) {
    const vectors = await getCohereBatchVector([text], isQuery, directories, model);
    return vectors[0];
}

module.exports = {
    getCohereBatchVector,
    getCohereVector,
};
