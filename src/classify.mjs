import { pipeline, env } from 'sillytavern-transformers';
import path from 'path';
import { getConfig } from './util.js';

// Limit the number of threads to 1 to avoid issues on Android
env.backends.onnx.wasm.numThreads = 1;

class PipelineAccessor {
    /**
     * @type {import("sillytavern-transformers").TextClassificationPipeline}
     */
    pipe;

    async get() {
        if (!this.pipe) {
            const cache_dir = path.join(process.cwd(), 'cache');
            const model = this.getClassificationModel();
            this.pipe = await pipeline('text-classification', model, { cache_dir, quantized: true });
        }

        return this.pipe;
    }

    getClassificationModel() {
        const DEFAULT_MODEL = 'Cohee/distilbert-base-uncased-go-emotions-onnx';

        try {
            const config = getConfig();
            const model = config?.extras?.classificationModel;
            return model || DEFAULT_MODEL;
        } catch (error) {
            console.warn('Failed to read config.conf, using default classification model.');
            return DEFAULT_MODEL;
        }
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
        try {
            const pipe = await pipelineAccessor.get();
            const result = Object.keys(pipe.model.config.label2id);
            return res.json({ labels: result });
        } catch (error) {
            console.error(error);
            return res.sendStatus(500);
        }
    });

    app.post('/api/extra/classify', jsonParser, async (req, res) => {
        try {
            const { text } = req.body;

            async function getResult(text) {
                if (cacheObject.hasOwnProperty(text)) {
                    return cacheObject[text];
                } else {
                    const pipe = await pipelineAccessor.get();
                    const result = await pipe(text, { topk: 5 });
                    result.sort((a, b) => b.score - a.score);
                    cacheObject[text] = result;
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
}

export default {
    registerEndpoints,
};
