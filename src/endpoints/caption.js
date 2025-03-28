import express from 'express';
import { getPipeline, getRawImage } from '../transformers.js';

export const router = express.Router();

const TASK = 'image-to-text';

router.post('/', async (req, res) => {
    try {
        const { image } = req.body;

        const rawImage = await getRawImage(image);

        if (!rawImage) {
            console.warn('Failed to parse captioned image');
            return res.sendStatus(400);
        }

        const pipe = await getPipeline(TASK);
        const result = await pipe(rawImage);
        const text = result[0].generated_text;
        console.info('Image caption:', text);

        return res.json({ caption: text });
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});
