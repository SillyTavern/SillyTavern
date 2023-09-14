import { pipeline, env, RawImage } from 'sillytavern-transformers';
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
}

async function getRawImage(image) {
    const buffer = Buffer.from(image, 'base64');
    const byteArray = new Uint8Array(buffer);
    const blob = new Blob([byteArray]);

    const rawImage = await RawImage.fromBlob(blob);
    return rawImage;
}

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
