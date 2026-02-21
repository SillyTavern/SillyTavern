import express from 'express';
import fetch from 'node-fetch';
import { readSecret, SECRET_KEYS } from './secrets.js';

export const router = express.Router();

const MODELSLAB_TTS_URL = 'https://modelslab.com/api/v6/voice/text_to_speech';
const MODELSLAB_FETCH_URL = 'https://modelslab.com/api/v6/voice/fetch';
const MAX_POLL_ATTEMPTS = 10;
const POLL_INTERVAL_MS = 3000;

/**
 * Poll ModelsLab fetch endpoint until audio is ready.
 * @param {string} apiKey ModelsLab API key
 * @param {string|number} taskId Task ID returned by the generation request
 * @returns {Promise<string>} URL of the generated audio
 */
async function pollForAudio(apiKey, taskId) {
    for (let attempt = 0; attempt < MAX_POLL_ATTEMPTS; attempt++) {
        await new Promise(resolve => setTimeout(resolve, POLL_INTERVAL_MS));

        const fetchResponse = await fetch(MODELSLAB_FETCH_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ key: apiKey, request_id: String(taskId) }),
        });

        if (!fetchResponse.ok) {
            throw new Error(`ModelsLab fetch failed: HTTP ${fetchResponse.status}`);
        }

        const fetchData = await fetchResponse.json();

        if (fetchData.status === 'success' && fetchData.output && fetchData.output.length > 0) {
            return fetchData.output[0];
        }

        if (fetchData.status === 'failed' || fetchData.status === 'error') {
            throw new Error(`ModelsLab TTS failed: ${fetchData.message || 'Unknown error'}`);
        }

        // status === 'processing' → keep polling
    }

    throw new Error('ModelsLab TTS timed out waiting for audio');
}

router.post('/generate-voice', async (request, response) => {
    try {
        const { text, voice_id, language, speed, emotion } = request.body;

        const apiKey = readSecret(request.user.directories, SECRET_KEYS.MODELSLAB_TTS);

        if (!apiKey) {
            return response.status(401).json({ error: 'ModelsLab API key not configured' });
        }

        if (!text) {
            return response.status(400).json({ error: 'Missing required parameter: text' });
        }

        // ModelsLab TTS has a 2500 char limit
        const prompt = text.length > 2500 ? text.substring(0, 2500) : text;

        const requestBody = {
            key: apiKey,
            prompt: prompt,
            voice_id: voice_id || 'madison',
            language: language || 'american english',
            speed: Number(speed) || 1,
            emotion: Boolean(emotion),
        };

        console.debug('ModelsLab TTS: Generating audio', { voice_id, language, speed });

        const apiResponse = await fetch(MODELSLAB_TTS_URL, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody),
        });

        if (!apiResponse.ok) {
            const errorText = await apiResponse.text();
            console.error('ModelsLab TTS API error:', errorText);
            return response.status(apiResponse.status).json({ error: `ModelsLab API error: ${errorText}` });
        }

        const data = await apiResponse.json();

        let audioUrl;

        if (data.status === 'success' && data.output && data.output.length > 0) {
            audioUrl = data.output[0];
        } else if (data.status === 'processing' && data.id) {
            // Async generation — poll until ready
            audioUrl = await pollForAudio(apiKey, data.id);
        } else {
            const errorMsg = data.message || JSON.stringify(data);
            console.error('ModelsLab TTS unexpected response:', data);
            return response.status(500).json({ error: `Unexpected ModelsLab response: ${errorMsg}` });
        }

        // Proxy the audio file back to the client
        const audioResponse = await fetch(audioUrl);

        if (!audioResponse.ok) {
            return response.status(500).json({ error: 'Failed to download generated audio from ModelsLab' });
        }

        const contentType = audioResponse.headers.get('content-type') || 'audio/mpeg';
        response.setHeader('Content-Type', contentType);
        audioResponse.body.pipe(response);

    } catch (error) {
        console.error('ModelsLab TTS error:', error);
        response.status(500).json({ error: error.message });
    }
});
