const { readSecret, SECRET_KEYS } = require('./secrets');
const fetch = require('node-fetch').default;
const express = require('express');
const { jsonParser } = require('../express-common');
const { MAKERSUITE_SAFETY } = require('../constants');

const router = express.Router();

router.post('/caption-image', jsonParser, async (request, response) => {
    try {
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${readSecret(SECRET_KEYS.MAKERSUITE)}`;
        const body = {
            contents: [{
                parts: [
                    { text: request.body.prompt },
                    { inlineData: {
                        mimeType: 'image/png', //jpg images seem to work fine even with this mimetype set?
                        data: request.body.image,
                    },
                    }],
            }],
            safetySettings: MAKERSUITE_SAFETY,
            generationConfig: { maxOutputTokens: 1000 },
        };

        const result = await fetch(url, {
            body: JSON.stringify(body),
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: 0,
        });

        console.log('Multimodal captioning request', body);

        if (!result.ok) {
            console.log(`MakerSuite API returned error: ${result.status} ${result.statusText} ${await result.text()}`);
            return response.status(result.status).send({ error: true });
        }

        const data = await result.json();
        console.log('Multimodal captioning response', data);

        const candidates = data?.candidates;
        if(!candidates) {
            return response.status(500).send('No candidates found, image was most likely filtered.');
        }

        const caption = candidates[0].content.parts[0].text;
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
