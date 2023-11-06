const { readSecret, SECRET_KEYS } = require("./secrets");

/**
 * Registers the OpenAI endpoints.
 * @param {import("express").Express} app
 * @param {any} jsonParser
 */
function registerEndpoints(app, jsonParser) {
    app.post('/api/openai/generate-image', jsonParser, async (request, response) => {
        try {
            const key = readSecret(SECRET_KEYS.OPENAI);

            if (!key) {
                console.log('No OpenAI key found');
                return response.sendStatus(401);
            }

            console.log('OpenAI request', request.body);

            const result = await fetch('https://api.openai.com/v1/images/generations', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${key}`,
                },
                body: JSON.stringify(request.body),
            });

            if (!result.ok) {
                const text = await result.text();
                console.log('OpenAI request failed', result.statusText, text);
                return response.status(500).send(text);
            }

            const data = await result.json();
            return response.json(data);
        } catch (error) {
            console.error(error);
            response.status(500).send('Internal server error');
        }
    });
}

module.exports = {
    registerEndpoints,
};
