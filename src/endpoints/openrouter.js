import express from 'express';

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

        const data = await response.json();
        const models = data?.data || [];
        const multimodalModels = models.filter(m => m?.architecture?.modality === 'text+image->text').map(m => m.id);

        return res.json(multimodalModels);
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});
