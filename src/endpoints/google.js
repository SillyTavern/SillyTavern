const { readSecret, SECRET_KEYS } = require('./secrets');
const fetch = require('node-fetch').default;
const express = require('express');
const { jsonParser } = require('../express-common');
const { GEMINI_SAFETY } = require('../constants');

const router = express.Router();

router.post('/caption-image', jsonParser, async (request, response) => {
    try {
        const mimeType = request.body.image.split(';')[0].split(':')[1];
        const base64Data = request.body.image.split(',')[1];
        const url = `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro-vision:generateContent?key=${readSecret(SECRET_KEYS.MAKERSUITE)}`;
        const body = {
            contents: [{
                parts: [
                    { text: request.body.prompt },
                    {
                        inlineData: {
                            mimeType: 'image/png', // It needs to specify a MIME type in data if it's not a PNG
                            data: mimeType === 'image/png' ? base64Data : request.body.image,
                        },
                    }],
            }],
            safetySettings: GEMINI_SAFETY,
            generationConfig: { maxOutputTokens: 1000 },
        };

        console.log('Multimodal captioning request', body);

        const result = await fetch(url, {
            body: JSON.stringify(body),
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            timeout: 0,
        });

        if (!result.ok) {
            const error = await result.json();
            console.log(`MakerSuite API returned error: ${result.status} ${result.statusText}`, error);
            return response.status(result.status).send({ error: true });
        }

        const data = await result.json();
        console.log('Multimodal captioning response', data);

        const candidates = data?.candidates;
        if (!candidates) {
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
