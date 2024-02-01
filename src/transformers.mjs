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
        quantized: true,
    },
    'image-to-text': {
        defaultModel: 'Xenova/vit-gpt2-image-captioning',
        pipeline: null,
        configField: 'extras.captioningModel',
        quantized: true,
    },
    'feature-extraction': {
        defaultModel: 'Xenova/all-mpnet-base-v2',
        pipeline: null,
        configField: 'extras.embeddingModel',
        quantized: true,
    },
    'text-generation': {
        defaultModel: 'Cohee/fooocus_expansion-onnx',
        pipeline: null,
        configField: 'extras.promptExpansionModel',
        quantized: true,
    },
    'automatic-speech-recognition': {
        defaultModel: 'Xenova/whisper-small',
        pipeline: null,
        configField: 'extras.speechToTextModel',
        quantized: true,
    },
    'text-to-speech': {
        defaultModel: 'Xenova/speecht5_tts',
        pipeline: null,
        configField: 'extras.textToSpeechModel',
        quantized: false,
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
        console.warn('Failed to read config.yaml, using default classification model.');
        return defaultModel;
    }
}

/**
 * Gets the transformers.js pipeline for a given task.
 * @param {import('sillytavern-transformers').PipelineType} task The task to get the pipeline for
 * @param {string} forceModel The model to use for the pipeline, if any
 * @returns {Promise<Pipeline>} Pipeline for the task
 */
async function getPipeline(task, forceModel = '') {
    if (tasks[task].pipeline) {
        return tasks[task].pipeline;
    }

    const cache_dir = path.join(process.cwd(), 'cache');
    const model = forceModel || getModelForTask(task);
    const localOnly = getConfigValue('extras.disableAutoDownload', false);
    console.log('Initializing transformers.js pipeline for task', task, 'with model', model);
    const instance = await pipeline(task, model, { cache_dir, quantized: tasks[task].quantized ?? true, local_files_only: localOnly });
    tasks[task].pipeline = instance;
    return instance;
}

export default {
    getPipeline,
    getRawImage,
}
