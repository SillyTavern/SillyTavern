import express from 'express';
import fetch from 'node-fetch';

export const router = express.Router();
const API_HELICONE = 'https://ai-gateway.helicone.ai/v1';

router.post('/models', async (_req, res) => {
    try {
        // The endpoint is available without authentication
        const response = await fetch(`${API_HELICONE}/models`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            return res.json({ object: 'list', data: [] });
        }

        /** @type {any} */
        const data = await response.json();

        // Return verbatim OpenAI-compatible response
        return res.json(data);
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});

router.post('/models/multimodal', async (_req, res) => {
    try {
        // Use Helicone's dedicated multimodal endpoint
        const response = await fetch(`${API_HELICONE}/models/multimodal`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            return res.json([]);
        }

        /** @type {any} */
        const data = await response.json();

        // Return verbatim response from Helicone's multimodal endpoint
        return res.json(data);
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});