const fetch = require('node-fetch').default;
const { SECRET_KEYS, readSecret } = require('./secrets');

/**
 * Gets the vector for the given text from OpenAI ada model
 * @param {string} text - The text to get the vector for
 * @returns {Promise<number[]>} - The vector for the text
 */
async function getOpenAIVector(text) {
    const key = readSecret(SECRET_KEYS.OPENAI);

    if (!key) {
        console.log('No OpenAI key found');
        throw new Error('No OpenAI key found');
    }

    const response = await fetch('https://api.openai.com/v1/embeddings', {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({
            input: text,
            model: 'text-embedding-ada-002',
        })
    });

    if (!response.ok) {
        const text = await response.text();
        console.log('OpenAI request failed', response.statusText, text);
        throw new Error('OpenAI request failed');
    }

    const data = await response.json();
    const vector = data?.data[0]?.embedding;

    if (!Array.isArray(vector)) {
        console.log('OpenAI response was not an array');
        throw new Error('OpenAI response was not an array');
    }

    return vector;
}

module.exports = {
    getOpenAIVector,
};
