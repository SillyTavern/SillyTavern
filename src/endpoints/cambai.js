import express from 'express';
import fetch from 'node-fetch';
import { readSecret, SECRET_KEYS } from './secrets.js';
import { forwardFetchResponse } from '../util.js';

export const router = express.Router();

router.post('/voices', async (request, response) => {
    try {
        const apiKey = readSecret(request.user.directories, SECRET_KEYS.CAMBAI) || process.env.CAMBAI_API_KEY || process.env.CAMB_API_KEY;

        if (!apiKey) {
            return response.status(400).json({ error: 'CAMB AI API key is required' });
        }

        const apiResponse = await fetch('https://client.camb.ai/apis/list-voices', {
            method: 'GET',
            headers: {
                'x-api-key': apiKey,
            },
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error('CAMB AI voices API error:', errorText);
            return response.status(500).json({ error: `Failed to fetch voices: HTTP ${apiResponse.status}` });
        }

        const voices = await apiResponse.json();
        return response.json(voices);
    } catch (error) {
        console.error('CAMB AI voices request failed:', error);
        return response.status(500).json({ error: 'Internal server error' });
    }
});

router.post('/generate-voice', async (request, response) => {
    try {
        const { text, voiceId, model, language, format } = request.body;
        const apiKey = readSecret(request.user.directories, SECRET_KEYS.CAMBAI) || process.env.CAMBAI_API_KEY || process.env.CAMB_API_KEY;

        if (!text || !voiceId || !apiKey) {
            return response.status(400).json({ error: 'Missing required parameters: text, voiceId, and API key are required' });
        }

        const requestBody = {
            text: text,
            voice_id: Number(voiceId),
            model: model || 'mars-flash',
            language: language || 'en-us',
            format: format || 'mp3',
        };

        const apiResponse = await fetch('https://client.camb.ai/apis/tts-stream', {
            method: 'POST',
            headers: {
                'x-api-key': apiKey,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error('CAMB AI TTS API error:', errorText);
            return response.status(500).json({ error: `TTS generation failed: HTTP ${apiResponse.status}` });
        }

        const mimeTypes = { mp3: 'audio/mpeg', wav: 'audio/wav', flac: 'audio/flac' };
        response.setHeader('Content-Type', mimeTypes[format] || 'audio/mpeg');
        forwardFetchResponse(apiResponse, response);
    } catch (error) {
        console.error('CAMB AI TTS generation failed:', error);
        return response.status(500).json({ error: 'Internal server error' });
    }
});
