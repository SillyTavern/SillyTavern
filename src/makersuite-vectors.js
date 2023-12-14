const fetch = require('node-fetch').default;
const { SECRET_KEYS, readSecret } = require('./endpoints/secrets');

/**
 * Gets the vector for the given text from PaLM gecko model
 * @param {string} text - The text to get the vector for
 * @returns {Promise<number[]>} - The vector for the text
 */
async function getMakerSuiteVector(text) {
    const key = readSecret(SECRET_KEYS.MAKERSUITE);

    if (!key) {
        console.log('No MakerSuite key found');
        throw new Error('No MakerSuite key found');
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta/models/embedding-gecko-001:embedText?key=${key}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            text: text,
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        console.log('MakerSuite request failed', response.statusText, text);
        throw new Error('MakerSuite request failed');
    }

    const data = await response.json();

    // Access the "value" dictionary
    const vector = data.embedding.value;

    return vector;
}

module.exports = {
    getMakerSuiteVector,
};
