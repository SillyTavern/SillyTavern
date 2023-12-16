const fetch = require('node-fetch').default;
const { SECRET_KEYS, readSecret } = require('./endpoints/secrets');

/**
 * Gets the vector for the given text from an OpenAI compatible endpoint.
 * @param {string} text - The text to get the vector for
 * @param {string} source - The source of the vector
 * @returns {Promise<number[]>} - The vector for the text
 */
async function getOpenAIVector(text, source) {

    // dictionary of sources to endpoints with source as key and endpoint, model and secret key as value
    const endpoints = {
        'togetherai': {
            endpoint: 'https://api.togetherai.xyz/v1/embeddings',  // is this correct?
            model: 'togethercomputer/GPT-NeoXT-Chat-Base-20B', 
            secret: SECRET_KEYS.TOGETHERAI,
        },
        'openai': {
            endpoint: 'https://api.openai.com/v1/embeddings',
            model: 'text-embedding-ada-002',
            secret: SECRET_KEYS.OPENAI,
        },
        'mistral': {
            endpoint: 'https://api.mistral.ai/v1/embeddings',
            model: 'mistral-embed',
            secret: SECRET_KEYS.MISTRAL,
        },
    };

    const key = readSecret(endpoints[source].secret);

    if (!key) {
        console.log('No %s key found.', source);
        throw new Error('No ${source} key found.');
    }

    const response = await fetch(endpoints[source].endpoint, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
            input: text,
            model: endpoints[source].model,
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        console.log('${source} request failed', response.statusText, text);
        throw new Error('${source} request failed');
    }

    const data = await response.json();
    const vector = data?.data[0]?.embedding;

    if (!Array.isArray(vector)) {
        console.log('${source} response was not an array');
        throw new Error('${source} response was not an array');
    }

    return vector;
}

module.exports = {
    getOpenAIVector,
};
