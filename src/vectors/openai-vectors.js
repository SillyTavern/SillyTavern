import fetch from 'node-fetch';
import { SECRET_KEYS, readSecret } from '../endpoints/secrets.js';
import { OPENROUTER_HEADERS } from '../constants.js';

const SOURCES = {
    'togetherai': {
        secretKey: SECRET_KEYS.TOGETHERAI,
        url: 'https://api.together.xyz/v1',
        model: 'togethercomputer/m2-bert-80M-32k-retrieval',
        headers: {},
        processBody: () => {},
    },
    'mistral': {
        secretKey: SECRET_KEYS.MISTRALAI,
        url: 'https://api.mistral.ai/v1',
        model: 'mistral-embed',
        headers: {},
        processBody: () => {},
    },
    'openai': {
        secretKey: SECRET_KEYS.OPENAI,
        url: 'https://api.openai.com/v1',
        model: 'text-embedding-ada-002',
        headers: {},
        processBody: () => {},
    },
    'electronhub': {
        secretKey: SECRET_KEYS.ELECTRONHUB,
        url: 'https://api.electronhub.ai/v1',
        model: 'text-embedding-3-small',
        headers: {},
        processBody: () => {},
    },
    'openrouter': {
        secretKey: SECRET_KEYS.OPENROUTER,
        url: 'https://openrouter.ai/api/v1',
        model: 'openai/text-embedding-3-large',
        headers: { ...OPENROUTER_HEADERS },
        processBody: () => {},
    },
    'chutes': {
        secretKey: SECRET_KEYS.CHUTES,
        url: 'https://{{MODEL}}.chutes.ai/v1',
        model: 'chutes-qwen-qwen3-embedding-8b',
        headers: {},
        processBody: (body) => {
            body.model = null;
        },
    },
    'nanogpt': {
        secretKey: SECRET_KEYS.NANOGPT,
        url: 'https://nano-gpt.com/api/v1',
        model: 'text-embedding-3-small',
        headers: {},
        processBody: () => {},
    },
};

/**
 * Gets the vector for the given text batch from an OpenAI compatible endpoint.
 * @param {string[]} texts - The array of texts to get the vector for
 * @param {string} source - The source of the vector
 * @param {import('../users.js').UserDirectoryList} directories - The directories object for the user
 * @param {string} model - The model to use for the embedding
 * @returns {Promise<number[][]>} - The array of vectors for the texts
 */
export async function getOpenAIBatchVector(texts, source, directories, model = '') {
    const config = SOURCES[source];

    if (!config) {
        console.error('Unknown source', source);
        throw new Error('Unknown source');
    }

    const key = readSecret(directories, config.secretKey);

    if (!key) {
        console.warn('No API key found');
        throw new Error('No API key found');
    }

    const modelName = model || config.model;
    const url = config.url.replace('{{MODEL}}', modelName);
    const body = {
        input: texts,
        model: modelName,
    };

    if (typeof config.processBody === 'function') {
        config.processBody(body);
    }

    const response = await fetch(`${url}/embeddings`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${key}`,
            ...config.headers,
        },
        body: JSON.stringify(body),
    });

    if (!response.ok) {
        const text = await response.text();
        console.warn('API request failed', response.statusText, text);
        throw new Error('API request failed');
    }

    /** @type {any} */
    const data = await response.json();

    if (!Array.isArray(data?.data)) {
        console.warn('API response was not an array');
        throw new Error('API response was not an array');
    }

    // Sort data by x.index to ensure the order is correct
    data.data.sort((a, b) => a.index - b.index);

    const vectors = data.data.map(x => x.embedding);
    return vectors;
}

/**
 * Gets the vector for the given text from an OpenAI compatible endpoint.
 * @param {string} text - The text to get the vector for
 * @param {string} source - The source of the vector
 * @param {import('../users.js').UserDirectoryList} directories - The directories object for the user
 * @param {string} model - The model to use for the embedding
 * @returns {Promise<number[]>} - The vector for the text
 */
export async function getOpenAIVector(text, source, directories, model = '') {
    const vectors = await getOpenAIBatchVector([text], source, directories, model);
    return vectors[0];
}
