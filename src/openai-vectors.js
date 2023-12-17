const fetch = require('node-fetch').default;
const { SECRET_KEYS, readSecret } = require('./endpoints/secrets');

const SOURCES = {
    'mistral': {
        secretKey: SECRET_KEYS.MISTRAL,
        url: 'api.mistral.ai',
        model: 'mistral-embed',
    },
    'openai': {
        secretKey: SECRET_KEYS.OPENAI,
        url: 'api.openai.com',
        model: 'text-embedding-ada-002',
    },
};

/**
 * Gets the vector for the given text from an OpenAI compatible endpoint.
 * @param {string} text - The text to get the vector for
 * @param {string} source - The source of the vector
 * @returns {Promise<number[]>} - The vector for the text
 */
async function getOpenAIVector(text, source) {
    const config = SOURCES[source];

    if (!config) {
        console.log('Unknown source', source);
        throw new Error('Unknown source');
    }

    const key = readSecret(config.secretKey);

    if (!key) {
        console.log('No API key found');
        throw new Error('No API key found');
    }

    const url = config.url;
    const response = await fetch(`https://${url}/v1/embeddings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
            input: text,
            model: config.model,
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        console.log('API request failed', response.statusText, text);
        throw new Error('API request failed');
    }

    const data = await response.json();
    const vector = data?.data[0]?.embedding;

    if (!Array.isArray(vector)) {
        console.log('API response was not an array');
        throw new Error('API response was not an array');
    }

    return vector;
}

module.exports = {
    getOpenAIVector,
};
