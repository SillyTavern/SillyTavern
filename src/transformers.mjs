import { pipeline, env, RawImage, Pipeline } from 'sillytavern-transformers';
import { getConfigValue } from './util.js';
import path from 'path';
import fs from 'fs';

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
        quantized: false,
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
};

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

async function migrateCacheToDataDir() {
    const oldCacheDir = path.join(process.cwd(), 'cache');
    const newCacheDir = path.join(global.DATA_ROOT, '_cache');

    if (!fs.existsSync(newCacheDir)) {
        fs.mkdirSync(newCacheDir, { recursive: true });
    }

    if (fs.existsSync(oldCacheDir) && fs.statSync(oldCacheDir).isDirectory()) {
        const files = fs.readdirSync(oldCacheDir);

        if (files.length === 0) {
            return;
        }

        console.log('Migrating model cache files to data directory. Please wait...');

        for (const file of files) {
            try {
                const oldPath = path.join(oldCacheDir, file);
                const newPath = path.join(newCacheDir, file);
                fs.cpSync(oldPath, newPath, { recursive: true, force: true });
                fs.rmSync(oldPath, { recursive: true, force: true });
            } catch (error) {
                console.warn('Failed to migrate cache file. The model will be re-downloaded.', error);
            }
        }
    }
}

/**
 * Gets the transformers.js pipeline for a given task.
 * @param {import('sillytavern-transformers').PipelineType} task The task to get the pipeline for
 * @param {string} forceModel The model to use for the pipeline, if any
 * @returns {Promise<Pipeline>} Pipeline for the task
 */
async function getPipeline(task, forceModel = '') {
    await migrateCacheToDataDir();

    if (tasks[task].pipeline) {
        if (forceModel === '' || tasks[task].currentModel === forceModel) {
            return tasks[task].pipeline;
        }
        console.log('Disposing transformers.js pipeline for for task', task, 'with model', tasks[task].currentModel);
        await tasks[task].pipeline.dispose();
    }

    const cacheDir = path.join(global.DATA_ROOT, '_cache');
    const model = forceModel || getModelForTask(task);
    const localOnly = getConfigValue('extras.disableAutoDownload', false);
    console.log('Initializing transformers.js pipeline for task', task, 'with model', model);
    const instance = await pipeline(task, model, { cache_dir: cacheDir, quantized: tasks[task].quantized ?? true, local_files_only: localOnly });
    tasks[task].pipeline = instance;
    tasks[task].currentModel = model;
    return instance;
}

export default {
    getPipeline,
    getRawImage,
};
