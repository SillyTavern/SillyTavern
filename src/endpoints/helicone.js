import express from 'express';
import fetch from 'node-fetch';

export const router = express.Router();
const API_HELICONE = 'https://api.helicone.ai/v1/public/model-registry/models';

router.get('/', async (_req, res) => {
    try {
        // Fetch all models from Helicone's public model registry
        const response = await fetch(API_HELICONE, {
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
        const models = data?.data?.models || [];

        // Transform to SillyTavern format
        const formattedModels = models.map(model => ({
            id: model.id,
            name: model.name || model.id,
            created: model.created || Date.now(),
            description: model.description || '',
            max_context_length: model.contextWindow || 4096,
            capabilities: {
                completion_chat: true,
                vision: model.inputModalities?.includes('image') || false,
                audio: model.inputModalities?.includes('audio') || false,
            },
        }));

        return res.json(formattedModels);
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});

router.post('/models/multimodal', async (_req, res) => {
    try {
        // The endpoint is available without authentication
        const response = await fetch(API_HELICONE, {
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
        const models = data?.models || [];

        // Filter for multimodal models based on image capability
        const multimodalModels = models
            .filter(m => {
                // Check if model has image capability in inputModalities or outputModalities
                const hasImageInput = m?.inputModalities?.includes('image');
                const hasImageOutput = m?.outputModalities?.includes('image');

                return hasImageInput || hasImageOutput;
            })
            .map(m => m.id);

        return res.json(multimodalModels);
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});
