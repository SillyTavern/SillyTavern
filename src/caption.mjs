import { pipeline, env, RawImage } from 'sillytavern-transformers';
import path from 'path';
import { getConfig } from './util.js';

// Limit the number of threads to 1 to avoid issues on Android
env.backends.onnx.wasm.numThreads = 1;

class PipelineAccessor {
    /**
     * @type {import("sillytavern-transformers").ImageToTextPipeline}
     */
    pipe;

    async get() {
        if (!this.pipe) {
            const cache_dir = path.join(process.cwd(), 'cache');
            const model = this.getCaptioningModel();
            this.pipe = await pipeline('image-to-text', model, { cache_dir, quantized: true });
        }

        return this.pipe;
    }

    getCaptioningModel() {
        const DEFAULT_MODEL = 'Xenova/vit-gpt2-image-captioning';

        try {
            const config = getConfig();
            const model = config?.extras?.captioningModel;
            return model || DEFAULT_MODEL;
        } catch (error) {
            console.warn('Failed to read config.conf, using default captioning model.');
            return DEFAULT_MODEL;
        }
    }
}

/**
 * @param {import("express").Express} app
 * @param {any} jsonParser
 */
function registerEndpoints(app, jsonParser) {
    const pipelineAccessor = new PipelineAccessor();

    app.post('/api/extra/caption', jsonParser, async (req, res) => {
        try {
            const { image } = req.body;

            // base64 string to blob
            const buffer = Buffer.from(image, 'base64');
            const byteArray = new Uint8Array(buffer);
            const blob = new Blob([byteArray]);

            const rawImage = await RawImage.fromBlob(blob);
            const pipe = await pipelineAccessor.get();
            const result = await pipe(rawImage);
            const text = result[0].generated_text;
            console.log('Image caption:', text);

            return res.json({ caption: text });
        } catch (error) {
            console.error(error);
            return res.sendStatus(500);
        }
    });
}

export default {
    registerEndpoints,
};
