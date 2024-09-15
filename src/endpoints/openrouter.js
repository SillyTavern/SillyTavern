const express = require('express');
const { jsonParser } = require('../express-common');

const router = express.Router();
const API_OPENROUTER = 'https://openrouter.ai/api/v1';

router.post('/models/multimodal', jsonParser, async (_req, res) => {
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

module.exports = { router };
