import express from 'express';
import { jsonParser } from '../express-common.js';
import { getPipeline, getRawImage } from '../transformers.js';

const TASK = 'image-to-text';

export const router = express.Router();

router.post('/', jsonParser, async (req, res) => {
    try {
        const { image } = req.body;

        const rawImage = await getRawImage(image);

        if (!rawImage) {
            console.log('Failed to parse captioned image');
            return res.sendStatus(400);
        }

        const pipe = await getPipeline(TASK);
        const result = await pipe(rawImage);
        const text = result[0].generated_text;
        console.log('Image caption:', text);

        return res.json({ caption: text });
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});
