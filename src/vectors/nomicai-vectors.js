const fetch = require('node-fetch').default;
const { SECRET_KEYS, readSecret } = require('../endpoints/secrets');

const SOURCES = {
    'nomicai': {
        secretKey: SECRET_KEYS.NOMICAI,
        url: 'api-atlas.nomic.ai/v1/embedding/text',
        model: 'nomic-embed-text-v1.5',
    },
};

/**
 * Gets the vector for the given text batch from an OpenAI compatible endpoint.
 * @param {string[]} texts - The array of texts to get the vector for
 * @param {string} source - The source of the vector
 * @param {import('../users').UserDirectoryList} directories - The directories object for the user
 * @returns {Promise<number[][]>} - The array of vectors for the texts
 */
async function getNomicAIBatchVector(texts, source, directories) {
    const config = SOURCES[source];

    if (!config) {
        console.log('Unknown source', source);
        throw new Error('Unknown source');
    }

    const key = readSecret(directories, config.secretKey);

    if (!key) {
        console.log('No API key found');
        throw new Error('No API key found');
    }

    const url = config.url;
    let response;
    response = await fetch(`https://${url}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
            texts: texts,
            model: config.model,
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
 * @param {string} source - The source of the vector
 * @param {import('../users').UserDirectoryList} directories - The directories object for the user
 * @returns {Promise<number[]>} - The vector for the text
 */
async function getNomicAIVector(text, source, directories) {
    const vectors = await getNomicAIBatchVector([text], source, directories);
    return vectors[0];
}

module.exports = {
    getNomicAIVector,
    getNomicAIBatchVector,
};
