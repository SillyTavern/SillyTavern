const { readSecret, SECRET_KEYS } = require("./secrets");
const fetch = require('node-fetch').default;

/**
 * Registers the OpenAI endpoints.
 * @param {import("express").Express} app
 * @param {any} jsonParser
 */
function registerEndpoints(app, jsonParser) {
    app.post('/api/openai/caption-image', jsonParser, async (request, response) => {
        try {
            const key = readSecret(SECRET_KEYS.OPENAI);

            if (!key) {
                console.log('No OpenAI key found');
                return response.sendStatus(401);
            }

            const body = {
                model: "gpt-4-vision-preview",
                messages: [
                    {
                        role: "user",
                        content: [
                            { type: "text", text: request.body.prompt },
                            { type: "image_url", image_url: { "url": request.body.image } }
                        ]
                    }
                ],
                max_tokens: 300
            };

            console.log('OpenAI request', body);
            const result = await fetch('https://api.openai.com/v1/chat/completions', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${key}`,
                },
                body: JSON.stringify(body),
                timeout: 0,
            });

            if (!result.ok) {
                const text = await result.text();
                console.log('OpenAI request failed', result.statusText, text);
                return response.status(500).send(text);
            }

            const data = await result.json();
            console.log('OpenAI response', data);
            const caption = data?.choices[0]?.message?.content;

            if (!caption) {
                return response.status(500).send('No caption found');
            }

            return response.json({ caption });
        }
        catch (error) {
            console.error(error);
            response.status(500).send('Internal server error');
        }
    });

    app.post('/api/openai/generate-voice', jsonParser, async (request, response) => {
        try {
            const key = readSecret(SECRET_KEYS.OPENAI);

            if (!key) {
                console.log('No OpenAI key found');
                return response.sendStatus(401);
            }

            const result = await fetch('https://api.openai.com/v1/audio/speech', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    Authorization: `Bearer ${key}`,
                },
                body: JSON.stringify({
                    input: request.body.text,
                    response_format: 'mp3',
                    voice: request.body.voice ?? 'alloy',
                    speed: request.body.speed ?? 1,
                    model: request.body.model ?? 'tts-1',
                }),
            });

            if (!result.ok) {
                const text = await result.text();
                console.log('OpenAI request failed', result.statusText, text);
                return response.status(500).send(text);
            }

            const buffer = await result.arrayBuffer();
            response.setHeader('Content-Type', 'audio/mpeg');
            return response.send(Buffer.from(buffer));
        } catch (error) {
            console.error('OpenAI TTS generation failed', error);
            response.status(500).send('Internal server error');
        }
    });

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
                timeout: 0,
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
