import { pipeline, TextClassificationPipeline, env } from 'sillytavern-transformers';
import path from 'path';

env.backends.onnx.wasm.numThreads = 1;

class PipelineAccessor {
    /**
     * @type {TextClassificationPipeline}
     */
    pipe;

    async get() {
        if (!this.pipe) {
            const cache_dir = path.join(process.cwd(), 'cache');
            this.pipe = await pipeline('text-classification', 'Cohee/distilbert-base-uncased-go-emotions-onnx', { cache_dir, quantized: true });
        }

        return this.pipe;
    }
}

/**
 * @param {import("express").Express} app
 * @param {any} jsonParser
 */
function registerEndpoints(app, jsonParser) {
    const cacheObject = {};
    const pipelineAccessor = new PipelineAccessor();

    app.post('/api/extra/classify/labels', jsonParser, async (req, res) => {
        const pipe = await pipelineAccessor.get();
        const result = Object.keys(pipe.model.config.label2id);
        return res.json({ labels: result });
    });

    app.post('/api/extra/classify', jsonParser, async (req, res) => {
        const { text } = req.body;

        async function getResult(text) {
            if (cacheObject.hasOwnProperty(text)) {
                return cacheObject[text];
            } else {
                const pipe = await pipelineAccessor.get();
                const result = await pipe(text);
                cacheObject[text] = result;
                return result;
            }
        }

        console.log('Classify input:', text);
        const result = await getResult(text);
        console.log('Classify output:', result);

        return res.json({ classification: result });
    });
}

export default {
    registerEndpoints,
};
