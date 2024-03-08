const fetch = require('node-fetch').default;
const { SECRET_KEYS, readSecret } = require('./endpoints/secrets');

const SOURCES = {
    'nomicai': {
        url: 'api-atlas.nomic.ai/v1/embedding/text',
        model: 'nomic-embed-text-v1.5',
    },
    'togetherai': {
        secretKey: SECRET_KEYS.TOGETHERAI,
        url: 'api.together.xyz',
        model: 'togethercomputer/m2-bert-80M-32k-retrieval',
    },
    'mistral': {
        secretKey: SECRET_KEYS.MISTRALAI,
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
 * Gets the vector for the given text batch from an OpenAI compatible endpoint.
 * @param {string[]} texts - The array of texts to get the vector for
 * @param {string} source - The source of the vector
 * @param {string} model - The model to use for the embedding
 * @param {string} apikey - The api key to use for the nomic ai
 * @returns {Promise<number[][]>} - The array of vectors for the texts
 */
async function getOpenAIBatchVector(texts, source, model = '', apikey = '') {
    const config = SOURCES[source];

    if (!config) {
        console.log('Unknown source', source);
        throw new Error('Unknown source');
    }

    const key = apikey || readSecret(config.secretKey);

    if (!key) {
        console.log('No API key found');
        throw new Error('No API key found');
    }

    const url = config.url;
    let response;
    if (source === 'nomicai') {
        response = await fetch(`https://${url}`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({
                texts: texts,
                model: model || config.model,
            }),
        });
    } else {
        response = await fetch(`https://${url}/v1/embeddings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({
                input: texts,
                model: model || config.model,
            }),
        });
    }

    if (!response.ok) {
        const text = await response.text();
        console.log('API request failed', response.statusText, text);
        throw new Error('API request failed');
    }

    const data = await response.json();

    if (source === 'nomicai') {
        if (!Array.isArray(data?.embeddings)) {
            console.log('API response was not an array');
            throw new Error('API response was not an array');
        }

        return data.embeddings;
    } else  {
        if (!Array.isArray(data?.data)) {
            console.log('API response was not an array');
            throw new Error('API response was not an array');
        }

        // Sort data by x.index to ensure the order is correct
        data.data.sort((a, b) => a.index - b.index);

        return data.data.map(x => x.embedding);
    }
}

/**
 * Gets the vector for the given text from an OpenAI compatible endpoint.
 * @param {string} text - The text to get the vector for
 * @param {string} source - The source of the vector
 * @param model
 * @param apikey
 * @returns {Promise<number[]>} - The vector for the text
 */
async function getOpenAIVector(text, source, model, apikey) {
    const vectors = await getOpenAIBatchVector([text], source, model, apikey);
    return vectors[0];
}

module.exports = {
    getOpenAIVector,
    getOpenAIBatchVector,
};
