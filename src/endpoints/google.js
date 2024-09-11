const { readSecret, SECRET_KEYS } = require('./secrets');
const fetch = require('node-fetch').default;
const express = require('express');
const { jsonParser } = require('../express-common');
const { GEMINI_SAFETY } = require('../constants');

const API_MAKERSUITE = 'https://generativelanguage.googleapis.com';

const router = express.Router();

router.post('/caption-image', jsonParser, async (request, response) => {
    try {
        const mimeType = request.body.image.split(';')[0].split(':')[1];
        const base64Data = request.body.image.split(',')[1];
        const apiKey = request.body.reverse_proxy ? request.body.proxy_password : readSecret(request.user.directories, SECRET_KEYS.MAKERSUITE);
        const apiUrl = new URL(request.body.reverse_proxy || API_MAKERSUITE);
        const model = request.body.model || 'gemini-pro-vision';
        const url = `${apiUrl.origin}/v1beta/models/${model}:generateContent?key=${apiKey}`;
        const body = {
            contents: [{
                parts: [
                    { text: request.body.prompt },
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Data,
                        },
                    }],
            }],
            safetySettings: GEMINI_SAFETY,
            generationConfig: { maxOutputTokens: 1000 },
        };

        console.log('Multimodal captioning request', model, body);

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
            console.log(`Google AI Studio API returned error: ${result.status} ${result.statusText}`, error);
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
