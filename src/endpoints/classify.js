const express = require('express');
const { jsonParser } = require('../express-common');

const TASK = 'text-classification';

const router = express.Router();

/**
 * @type {Map<string, object>} Cache for classification results
 */
const cacheObject = new Map();

router.post('/labels', jsonParser, async (req, res) => {
    try {
        const module = await import('../transformers.mjs');
        const pipe = await module.default.getPipeline(TASK);
        const result = Object.keys(pipe.model.config.label2id);
        return res.json({ labels: result });
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});

router.post('/', jsonParser, async (req, res) => {
    try {
        const { text } = req.body;

        /**
         * Get classification result for a given text
         * @param {string} text Text to classify
         * @returns {Promise<object>} Classification result
         */
        async function getResult(text) {
            if (cacheObject.has(text)) {
                return cacheObject.get(text);
            } else {
                const module = await import('../transformers.mjs');
                const pipe = await module.default.getPipeline(TASK);
                const result = await pipe(text, { topk: 5 });
                result.sort((a, b) => b.score - a.score);
                cacheObject.set(text, result);
                return result;
            }
        }

        console.log('Classify input:', text);
        const result = await getResult(text);
        console.log('Classify output:', result);

        return res.json({ classification: result });
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});

module.exports = { router };
