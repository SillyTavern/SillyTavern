const fetch = require('node-fetch').default;

/**
 * Gets the vector for the given text from SillyTavern-extras
 * @param {string[]} texts - The array of texts to get the vectors for
 * @param {string} apiUrl - The Extras API URL
 * @param {string} apiKey - The Extras API key, or empty string if API key not enabled
 * @returns {Promise<number[][]>} - The array of vectors for the texts
 */
async function getExtrasBatchVector(texts, apiUrl, apiKey) {
    return getExtrasVectorImpl(texts, apiUrl, apiKey);
}

/**
 * Gets the vector for the given text from SillyTavern-extras
 * @param {string} text - The text to get the vector for
 * @param {string} apiUrl - The Extras API URL
 * @param {string} apiKey - The Extras API key, or empty string if API key not enabled
 * @returns {Promise<number[]>} - The vector for the text
 */
async function getExtrasVector(text, apiUrl, apiKey) {
    return getExtrasVectorImpl(text, apiUrl, apiKey);
}

/**
 * Gets the vector for the given text from SillyTavern-extras
 * @param {string|string[]} text - The text or texts to get the vector(s) for
 * @param {string} apiUrl - The Extras API URL
 * @param {string} apiKey - The Extras API key, or empty string if API key not enabled *
 * @returns {Promise<Array>} - The vector for a single text if input is string, or the array of vectors for multiple texts if input is string[]
 */
async function getExtrasVectorImpl(text, apiUrl, apiKey) {
    let url;
    try {
        url = new URL(apiUrl);
        url.pathname = '/api/embeddings/compute';
    }
    catch (error) {
        console.log('Failed to set up Extras API call:', error);
        console.log('Extras API URL given was:', apiUrl);
        throw error;
    }

    const headers = {
        'Content-Type': 'application/json',
    };

    // Include the Extras API key, if enabled
    if (apiKey && apiKey.length > 0) {
        Object.assign(headers, {
            'Authorization': `Bearer ${apiKey}`,
        });
    }

    const response = await fetch(url, {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            text: text,  // The backend accepts {string|string[]} for one or multiple text items, respectively.
        }),
    });

    if (!response.ok) {
        const text = await response.text();
        console.log('Extras request failed', response.statusText, text);
        throw new Error('Extras request failed');
    }

    const data = await response.json();
    const vector = data.embedding;  // `embedding`: number[] (one text item), or number[][] (multiple text items).

    return vector;
}

module.exports = {
    getExtrasVector,
    getExtrasBatchVector,
};
