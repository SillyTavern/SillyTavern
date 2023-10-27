import { pipeline, env, RawImage, Pipeline } from 'sillytavern-transformers';
import { getConfigValue } from './util.js';
import path from 'path';
import _ from 'lodash';

configureTransformers();

function configureTransformers() {
    // Limit the number of threads to 1 to avoid issues on Android
    env.backends.onnx.wasm.numThreads = 1;
    // Use WASM from a local folder to avoid CDN connections
    env.backends.onnx.wasm.wasmPaths = path.join(process.cwd(), 'dist') + path.sep;
}

const tasks = {
    'text-classification': {
        defaultModel: 'Cohee/distilbert-base-uncased-go-emotions-onnx',
        pipeline: null,
        configField: 'extras.classificationModel',
    },
    'image-to-text': {
        defaultModel: 'Xenova/vit-gpt2-image-captioning',
        pipeline: null,
        configField: 'extras.captioningModel',
    },
    'feature-extraction': {
        defaultModel: 'Xenova/all-mpnet-base-v2',
        pipeline: null,
        configField: 'extras.embeddingModel',
    },
    'text-generation': {
        defaultModel: 'Cohee/fooocus_expansion-onnx',
        pipeline: null,
        configField: 'extras.promptExpansionModel',
    },
}

/**
 * Gets a RawImage object from a base64-encoded image.
 * @param {string} image Base64-encoded image
 * @returns {Promise<RawImage|null>} Object representing the image
 */
async function getRawImage(image) {
    try {
        const buffer = Buffer.from(image, 'base64');
        const byteArray = new Uint8Array(buffer);
        const blob = new Blob([byteArray]);

        const rawImage = await RawImage.fromBlob(blob);
        return rawImage;
    } catch {
        return null;
    }
}

/**
 * Gets the model to use for a given transformers.js task.
 * @param {string} task The task to get the model for
 * @returns {string} The model to use for the given task
 */
function getModelForTask(task) {
    const defaultModel = tasks[task].defaultModel;

    try {
        const model = getConfigValue(tasks[task].configField, null);
        return model || defaultModel;
    } catch (error) {
        console.warn('Failed to read config.conf, using default classification model.');
        return defaultModel;
    }
}

/**
 * Gets the transformers.js pipeline for a given task.
 * @param {string} task The task to get the pipeline for
 * @returns {Promise<Pipeline>} Pipeline for the task
 */
async function getPipeline(task) {
    if (tasks[task].pipeline) {
        return tasks[task].pipeline;
    }

    const cache_dir = path.join(process.cwd(), 'cache');
    const model = getModelForTask(task);
    const localOnly = getConfigValue('extras.disableAutoDownload', false);
    console.log('Initializing transformers.js pipeline for task', task, 'with model', model);
    const instance = await pipeline(task, model, { cache_dir, quantized: true, local_files_only: localOnly });
    tasks[task].pipeline = instance;
    return instance;
}

export default {
    getPipeline,
    getRawImage,
}
