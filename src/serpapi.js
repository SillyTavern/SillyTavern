const fetch = require('node-fetch').default;
const { readSecret, SECRET_KEYS } = require('./secrets');

/**
 * Registers the SerpApi endpoints.
 * @param {import("express").Express} app
 * @param {any} jsonParser
 */
function registerEndpoints(app, jsonParser) {
    app.post('/api/serpapi/search', jsonParser, async (request, response) => {
        try {
            const key = readSecret(SECRET_KEYS.SERPAPI);

            if (!key) {
                console.log('No SerpApi key found');
                return response.sendStatus(401);
            }

            const { query } = request.body;
            const result = await fetch(`https://serpapi.com/search.json?q=${encodeURIComponent(query)}&api_key=${key}`);

            if (!result.ok) {
                const text = await result.text();
                console.log('SerpApi request failed', result.statusText, text);
                return response.status(500).send(text);
            }

            const data = await result.json();
            return response.json(data);
        } catch (error) {
            console.log(error);
            return response.sendStatus(500);
        }
    });
}

module.exports = {
    registerEndpoints,
};
