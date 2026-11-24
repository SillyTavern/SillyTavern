import fetch from 'node-fetch';
import { Router } from 'express';

import { readSecret, SECRET_KEYS } from './secrets.js';

const API_URL = 'https://aniwaffle.com/v1';

export const router = Router();

/**
 * Calls the Aniwaffle API with the user's key.
 * @param {import('express').Request} req Express request
 * @param {string} path API path
 * @param {object} [body] JSON body; sends a GET when omitted
 * @returns {Promise<import('node-fetch').Response|null>} Response, or null when no key is set
 */
async function callAniwaffle(req, path, body) {
    const key = readSecret(req.user.directories, SECRET_KEYS.ANIWAFFLE);
    if (!key) {
        console.warn('Aniwaffle API key is not set');
        return null;
    }
    return fetch(`${API_URL}${path}`, {
        method: body ? 'POST' : 'GET',
        headers: { 'Authorization': `Bearer ${key}`, 'Content-Type': 'application/json' },
        body: body ? JSON.stringify(body) : undefined,
    });
}

for (const name of ['voices', 'models']) {
    router.post(`/${name}`, async (req, res) => {
        try {
            const result = await callAniwaffle(req, `/${name}`);
            if (!result) return res.sendStatus(400);
            if (!result.ok) {
                console.warn(`Aniwaffle ${name} request failed`, result.status, await result.text());
                return res.sendStatus(result.status);
            }
            const data = await result.json();
            return res.json(data[name]);
        } catch (error) {
            console.error(`Aniwaffle ${name} request failed`, error);
            return res.sendStatus(500);
        }
    });
}

router.post('/generate-voice', async (req, res) => {
    try {
        const { text, voice, model } = req.body;
        const result = await callAniwaffle(req, '/audio/speech', { input: text, voice, model, response_format: 'wav' });
        if (!result) return res.sendStatus(400);
        if (!result.ok) {
            const error = await result.text();
            console.warn('Aniwaffle TTS request failed', result.status, error);
            return res.status(result.status).send(error);
        }
        res.setHeader('Content-Type', 'audio/wav');
        return res.send(Buffer.from(await result.arrayBuffer()));
    } catch (error) {
        console.error('Aniwaffle TTS generation failed', error);
        return res.status(500).send('Internal server error');
    }
});
