const fetch = require('node-fetch').default;
const { SECRET_KEYS, readSecret } = require('./secrets');

/**
 * Gets the vector for the given text from OpenAI ada model
 * @param {string} text - The text to get the vector for
 * @returns {Promise<number[]>} - The vector for the text
 */
async function getPaLMVector(text) {
    const key = readSecret(SECRET_KEYS.PALM);

    if (!key) {
        console.log('No PaLM key found');
        throw new Error('No PaLM key found');
    }

    const response = await fetch(`https://generativelanguage.googleapis.com/v1beta2/models/embedding-gecko-001:embedText?key=${key}`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        body: JSON.stringify({
            text: text,
        })
    });

    if (!response.ok) {
        const text = await response.text();
        console.log('PaLM request failed', response.statusText, text);
        throw new Error('PaLM request failed');
    }

    const data = await response.json();
    const jsonifiedresp = JSON.parse(jsonString);
  
    // Access the "value" dictionary
    const vector = jsonifiedresp.embedding.value;

    return vector;
}

module.exports = {
    getOpenAIVector,
};
