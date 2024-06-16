const { readSecret, SECRET_KEYS } = require('./secrets');
const fetch = require('node-fetch').default;
const express = require('express');
const { jsonParser } = require('../express-common');

const router = express.Router();

router.post('/caption-image', jsonParser, async (request, response) => {
    try {
        const mimeType = request.body.image.split(';')[0].split(':')[1];
        const base64Data = request.body.image.split(',')[1];
        const baseUrl = request.body.reverse_proxy ? request.body.reverse_proxy : 'https://api.anthropic.com/v1';
        const url = `${baseUrl}/messages`;
        const body = {
            model: request.body.model,
            messages: [
                {
                    'role': 'user', 'content': [
                        {
                            'type': 'image',
                            'source': {
                                'type': 'base64',
                                'media_type': mimeType,
                                'data': base64Data,
                            },
                        },
                        { 'type': 'text', 'text': request.body.prompt },
                    ],
                },
            ],
            max_tokens: 800,
        };

        console.log('Multimodal captioning request', body);

        const result = await fetch(url, {
            body: JSON.stringify(body),
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01',
                'x-api-key': request.body.reverse_proxy ? request.body.proxy_password : readSecret(request.user.directories, SECRET_KEYS.CLAUDE),
            },
            timeout: 0,
        });

        if (!result.ok) {
            const text = await result.text();
            console.log(`Claude API returned error: ${result.status} ${result.statusText}`, text);
            return response.status(result.status).send({ error: true });
        }

        const generateResponseJson = await result.json();
        const caption = generateResponseJson.content[0].text;
        console.log('Claude response:', generateResponseJson);

        if (!caption) {
            return response.status(500).send('No caption found');
        }

        return response.json({ caption });
    } catch (error) {
        console.error(error);
        response.status(500).send('Internal server error');
    }
});

module.exports = { router };
