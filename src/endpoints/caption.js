const express = require('express');
const { jsonParser } = require('../express-common');

const TASK = 'image-to-text';

const router = express.Router();

router.post('/', jsonParser, async (req, res) => {
    try {
        const { image } = req.body;

        const module = await import('../transformers.mjs');
        const rawImage = await module.default.getRawImage(image);

        if (!rawImage) {
            console.log('Failed to parse captioned image');
            return res.sendStatus(400);
        }

        const pipe = await module.default.getPipeline(TASK);
        const result = await pipe(rawImage);
        const text = result[0].generated_text;
        console.log('Image caption:', text);

        return res.json({ caption: text });
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});

module.exports = { router };
