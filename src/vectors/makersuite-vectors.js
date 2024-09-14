const fetch = require('node-fetch').default;
const { SECRET_KEYS, readSecret } = require('../endpoints/secrets');
const API_MAKERSUITE = 'https://generativelanguage.googleapis.com';

/**
 * Gets the vector for the given text from gecko model
 * @param {string[]} texts - The array of texts to get the vector for
 * @param {import('../users').UserDirectoryList} directories - The directories object for the user
 * @returns {Promise<number[][]>} - The array of vectors for the texts
 */
async function getMakerSuiteBatchVector(texts, directories) {
    const promises = texts.map(text => getMakerSuiteVector(text, directories));
    return await Promise.all(promises);
}

/**
 * Gets the vector for the given text from Gemini API text-embedding-004 model
 * @param {string} text - The text to get the vector for
 * @param {import('../users').UserDirectoryList} directories - The directories object for the user
 * @returns {Promise<number[]>} - The vector for the text
 */
async function getMakerSuiteVector(text, directories) {
    const key = readSecret(directories, SECRET_KEYS.MAKERSUITE);

    if (!key) {
        console.log('No Google AI Studio key found');
        throw new Error('No Google AI Studio key found');
    }

    const apiUrl = new URL(API_MAKERSUITE);
    const model = 'text-embedding-004';
    const url = `${apiUrl.origin}/v1beta/models/${model}:embedContent?key=${key}`;
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
        headers: {
            'Content-Type': 'application/json',
        },
    });

    if (!response.ok) {
        const text = await response.text();
        console.log('Google AI Studio request failed', response.statusText, text);
        throw new Error('Google AI Studio request failed');
    }

    const data = await response.json();
    // noinspection JSValidateTypes
    return data['embedding']['values'];
}

module.exports = {
    getMakerSuiteVector,
    getMakerSuiteBatchVector,
};
