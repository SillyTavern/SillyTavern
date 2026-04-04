import express from 'express';
import fetch from 'node-fetch';

export const router = express.Router();
const API_OPENROUTER = 'https://openrouter.ai/api/v1';

router.post('/models/providers', async (req, res) => {
    try {
        const { model } = req.body;
        const response = await fetch(`${API_OPENROUTER}/models/${model}/endpoints`, {
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
        const endpoints = data?.data?.endpoints || [];
        const providerNames = endpoints.map(e => e.provider_name);

        return res.json(providerNames);
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});

router.post('/models/multimodal', async (_req, res) => {
    try {
        // The endpoint is available without authentication
        const response = await fetch(`${API_OPENROUTER}/models`, {
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

        if (!Array.isArray(data?.data)) {
            console.warn('OpenRouter API response was not an array');
            return res.json([]);
        }

        const multimodalModels = data.data
            .filter(m => Array.isArray(m?.architecture?.input_modalities))
            .filter(m => m.architecture.input_modalities.includes('image'))
            .filter(m => Array.isArray(m?.architecture?.output_modalities))
            .filter(m => m.architecture.output_modalities.includes('text'))
            .sort((a, b) => a?.id && b?.id && a.id.localeCompare(b.id))
            .map(m => m.id);

        return res.json(multimodalModels);
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});

router.post('/models/embedding', async (_req, res) => {
    try {
        // The endpoint is available without authentication
        const response = await fetch(`${API_OPENROUTER}/embeddings/models`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            console.warn('OpenRouter API request failed', response.statusText);
            return res.json([]);
        }

        /** @type {any} */
        const data = await response.json();

        if (!Array.isArray(data?.data)) {
            console.warn('OpenRouter API response was not an array');
            return res.json([]);
        }

        const embeddingModels = data.data
            .filter(m => Array.isArray(m?.architecture?.input_modalities))
            .filter(m => m.architecture.input_modalities.includes('text'))
            .filter(m => Array.isArray(m?.architecture?.output_modalities))
            .filter(m => m.architecture.output_modalities.includes('embeddings'))
            .sort((a, b) => a?.id && b?.id && a.id.localeCompare(b.id));

        return res.json(embeddingModels);
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});
