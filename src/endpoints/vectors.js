import path from 'node:path';
import fs from 'node:fs';

import express from 'express';
import sanitize from 'sanitize-filename';

import { getConfigValue } from '../util.js';

import { getNomicAIBatchVector, getNomicAIVector } from '../vectors/nomicai-vectors.js';
import { getOpenAIVector, getOpenAIBatchVector } from '../vectors/openai-vectors.js';
import { getTransformersVector, getTransformersBatchVector } from '../vectors/embedding.js';
import { getExtrasVector, getExtrasBatchVector } from '../vectors/extras-vectors.js';
import { getMakerSuiteVector, getMakerSuiteBatchVector } from '../vectors/google-vectors.js';
import { getVertexVector, getVertexBatchVector } from '../vectors/google-vectors.js';
import { getCohereVector, getCohereBatchVector } from '../vectors/cohere-vectors.js';
import { getLlamaCppVector, getLlamaCppBatchVector } from '../vectors/llamacpp-vectors.js';
import { getVllmVector, getVllmBatchVector } from '../vectors/vllm-vectors.js';
import { getOllamaVector, getOllamaBatchVector } from '../vectors/ollama-vectors.js';
import { withVectorWorker, purgeVectorWorker } from '../vectors/disk-worker-client.js';

// Don't forget to add new sources to the SOURCES array
const SOURCES = [
    'transformers',
    'mistral',
    'openai',
    'extras',
    'palm',
    'togetherai',
    'nomicai',
    'cohere',
    'ollama',
    'llamacpp',
    'vllm',
    'webllm',
    'koboldcpp',
    'vertexai',
    'electronhub',
    'openrouter',
    'chutes',
    'nanogpt',
    'siliconflow',
    'workers_ai',
];

/**
 * Gets the vector for the given text from the given source.
 * @param {string} source - The source of the vector
 * @param {Object} sourceSettings - Settings for the source, if it needs any
 * @param {string} text - The text to get the vector for
 * @param {boolean} isQuery - If the text is a query for embedding search
 * @param {import('../users.js').UserDirectoryList} directories - The directories object for the user
 * @returns {Promise<number[]>} - The vector for the text
 */
async function getVector(source, sourceSettings, text, isQuery, directories) {
    switch (source) {
        case 'nomicai':
            return getNomicAIVector(text, source, directories);
        case 'togetherai':
        case 'mistral':
        case 'openai':
            return getOpenAIVector(text, source, directories, sourceSettings.model);
        case 'electronhub':
            return getOpenAIVector(text, source, directories, sourceSettings.model);
        case 'openrouter':
            return getOpenAIVector(text, source, directories, sourceSettings.model);
        case 'transformers':
            return getTransformersVector(text);
        case 'extras':
            return getExtrasVector(text, sourceSettings.extrasUrl, sourceSettings.extrasKey);
        case 'palm':
            return getMakerSuiteVector(text, sourceSettings.model, sourceSettings.request);
        case 'vertexai':
            return getVertexVector(text, sourceSettings.model, sourceSettings.request);
        case 'cohere':
            return getCohereVector(text, isQuery, directories, sourceSettings.model);
        case 'llamacpp':
            return getLlamaCppVector(text, sourceSettings.apiUrl, directories);
        case 'vllm':
            return getVllmVector(text, sourceSettings.apiUrl, sourceSettings.model, directories);
        case 'ollama':
            return getOllamaVector(text, sourceSettings.apiUrl, sourceSettings.model, sourceSettings.keep, directories);
        case 'webllm':
            return sourceSettings.embeddings[text];
        case 'koboldcpp':
            return sourceSettings.embeddings[text];
        case 'chutes':
            return getOpenAIVector(text, source, directories, sourceSettings.model);
        case 'nanogpt':
            return getOpenAIVector(text, source, directories, sourceSettings.model);
        case 'siliconflow':
            return getOpenAIVector(text, source, directories, sourceSettings.model, sourceSettings.urlOverride);
        case 'workers_ai':
            return getOpenAIVector(text, source, directories, sourceSettings.model, sourceSettings.urlOverride);
    }

    throw new Error(`Unknown vector source ${source}`);
}

/**
 * Gets the vector for the given text batch from the given source.
 * @param {string} source - The source of the vector
 * @param {Object} sourceSettings - Settings for the source, if it needs any
 * @param {string[]} texts - The array of texts to get the vector for
 * @param {boolean} isQuery - If the text is a query for embedding search
 * @param {import('../users.js').UserDirectoryList} directories - The directories object for the user
 * @returns {Promise<number[][]>} - The array of vectors for the texts
 */
async function getBatchVector(source, sourceSettings, texts, isQuery, directories) {
    const batchSize = 10;
    const batches = Array(Math.ceil(texts.length / batchSize)).fill(undefined).map((_, i) => texts.slice(i * batchSize, i * batchSize + batchSize));

    let results = [];
    for (let batch of batches) {
        switch (source) {
            case 'nomicai':
                results.push(...await getNomicAIBatchVector(batch, source, directories));
                break;
            case 'togetherai':
            case 'mistral':
            case 'openai':
                results.push(...await getOpenAIBatchVector(batch, source, directories, sourceSettings.model));
                break;
            case 'electronhub':
                results.push(...await getOpenAIBatchVector(batch, source, directories, sourceSettings.model));
                break;
            case 'openrouter':
                results.push(...await getOpenAIBatchVector(batch, source, directories, sourceSettings.model));
                break;
            case 'transformers':
                results.push(...await getTransformersBatchVector(batch));
                break;
            case 'extras':
                results.push(...await getExtrasBatchVector(batch, sourceSettings.extrasUrl, sourceSettings.extrasKey));
                break;
            case 'palm':
                results.push(...await getMakerSuiteBatchVector(batch, sourceSettings.model, sourceSettings.request));
                break;
            case 'vertexai':
                results.push(...await getVertexBatchVector(batch, sourceSettings.model, sourceSettings.request));
                break;
            case 'cohere':
                results.push(...await getCohereBatchVector(batch, isQuery, directories, sourceSettings.model));
                break;
            case 'llamacpp':
                results.push(...await getLlamaCppBatchVector(batch, sourceSettings.apiUrl, directories));
                break;
            case 'vllm':
                results.push(...await getVllmBatchVector(batch, sourceSettings.apiUrl, sourceSettings.model, directories));
                break;
            case 'ollama':
                results.push(...await getOllamaBatchVector(batch, sourceSettings.apiUrl, sourceSettings.model, sourceSettings.keep, directories));
                break;
            case 'webllm':
                results.push(...batch.map(x => sourceSettings.embeddings[x]));
                break;
            case 'koboldcpp':
                results.push(...batch.map(x => sourceSettings.embeddings[x]));
                break;
            case 'chutes':
                results.push(...await getOpenAIBatchVector(batch, source, directories, sourceSettings.model));
                break;
            case 'nanogpt':
                results.push(...await getOpenAIBatchVector(batch, source, directories, sourceSettings.model));
                break;
            case 'siliconflow':
                results.push(...await getOpenAIBatchVector(batch, source, directories, sourceSettings.model, sourceSettings.urlOverride));
                break;
            case 'workers_ai':
                results.push(...await getOpenAIBatchVector(batch, source, directories, sourceSettings.model, sourceSettings.urlOverride));
                break;
            default:
                throw new Error(`Unknown vector source ${source}`);
        }
    }

    return results;
}

/**
 * Extracts settings for the vectorization sources from the HTTP request headers.
 * @param {string} source - Which source to extract settings for.
 * @param {object} request - The HTTP request object.
 * @returns {object} - An object that can be used as `sourceSettings` in functions that take that parameter.
 */
function getSourceSettings(source, request) {
    switch (source) {
        case 'togetherai':
            return {
                model: String(request.body.model),
            };
        case 'openai':
            return {
                model: String(request.body.model),
            };
        case 'electronhub':
            return {
                model: String(request.body.model || 'text-embedding-3-small'),
            };
        case 'openrouter':
            return {
                model: String(request.body.model) || 'openai/text-embedding-3-large',
            };
        case 'cohere':
            return {
                model: String(request.body.model),
            };
        case 'llamacpp':
            return {
                apiUrl: String(request.body.apiUrl),
            };
        case 'vllm':
            return {
                apiUrl: String(request.body.apiUrl),
                model: String(request.body.model),
            };
        case 'ollama':
            return {
                apiUrl: String(request.body.apiUrl),
                model: String(request.body.model),
                keep: Boolean(request.body.keep),
            };
        case 'extras':
            return {
                extrasUrl: String(request.body.extrasUrl),
                extrasKey: String(request.body.extrasKey),
            };
        case 'transformers':
            return {
                model: getConfigValue('extensions.models.embedding', ''),
            };
        case 'palm':
        case 'vertexai':
            return {
                model: String(request.body.model || 'text-embedding-005'),
                request: request, // Pass the request object to get API key and URL
            };
        case 'mistral':
            return {
                model: 'mistral-embed',
            };
        case 'nomicai':
            return {
                model: 'nomic-embed-text-v1.5',
            };
        case 'webllm':
            return {
                model: String(request.body.model),
                embeddings: request.body.embeddings ?? {},
            };
        case 'koboldcpp':
            return {
                model: String(request.body.model),
                embeddings: request.body.embeddings ?? {},
            };
        case 'chutes':
            return {
                model: String(request.body.model || 'chutes-qwen-qwen3-embedding-8b'),
            };
        case 'nanogpt':
            return {
                model: String(request.body.model || 'text-embedding-3-small'),
            };
        case 'siliconflow':
            return {
                model: String(request.body.model || 'Qwen/Qwen3-Embedding-0.6B'),
                urlOverride: request.body.siliconflow_endpoint === 'cn'
                    ? 'https://api.siliconflow.cn/v1' : null,
            };
        case 'workers_ai': {
            const accountId = String(request.body.workers_ai_account_id || '').trim();
            return {
                model: String(request.body.model || '@cf/baai/bge-m3'),
                urlOverride: accountId
                    ? `https://api.cloudflare.com/client/v4/accounts/${encodeURIComponent(accountId)}/ai/v1`
                    : null,
            };
        }
        default:
            return {};
    }
}

/** Only embedding identity belongs in a disk index scope; credentials never do. */
function getProfile(sourceSettings, requestProfile = '') {
    return {
        model: sourceSettings.model || '',
        apiUrl: sourceSettings.apiUrl || sourceSettings.extrasUrl || sourceSettings.urlOverride || '',
        transform: String(requestProfile || ''),
    };
}

async function useIndex(directories, collectionId, source, sourceSettings, profile, callback) {
    return withVectorWorker(directories.vectors, collectionId, source, getProfile(sourceSettings, profile), callback);
}

async function insertVectorItems(directories, collectionId, source, sourceSettings, items, profile) {
    if (items.length > 500) throw new RangeError('At most 500 vector chunks per request');
    const vectors = await getBatchVector(source, sourceSettings, items.map(x => x.text), false, directories);
    if (vectors.length !== items.length) throw new Error('Embedding provider returned an incomplete batch');
    return useIndex(directories, collectionId, source, sourceSettings, profile,
        store => store.upsert(items.map((item, i) => ({ ...item, vector: vectors[i] }))));
}

async function queryCollection(directories, collectionId, source, sourceSettings, vector, topK, threshold, profile, metadataOnly) {
    return useIndex(directories, collectionId, source, sourceSettings, profile, async store => {
        const metadata = await store.query(vector, topK, threshold);
        if (!metadataOnly && metadata.length) {
            const bodies = new Map((await store.bodies(metadata.map(x => x.id))).map(x => [x.id, x.text]));
            for (const item of metadata) item.text = bodies.get(item.id);
        }
        return { metadata, hashes: metadata.map(x => x.hash) };
    });
}

function vectorError(res, error) {
    console.error('Vector storage request failed:', error);
    return res.status(error instanceof TypeError || error instanceof RangeError ? 400 : 500).json({ error: error.message });
}

export const router = express.Router();

router.post('/query', async (req, res) => {
    try {
        if (!req.body.collectionId || !req.body.searchText) {
            return res.sendStatus(400);
        }

        const collectionId = String(req.body.collectionId);
        const searchText = String(req.body.searchText);
        const topK = Number(req.body.topK) || 10;
        const threshold = Number(req.body.threshold) || 0.0;
        const source = String(req.body.source || 'transformers');
        const sourceSettings = getSourceSettings(source, req);

        const vector = await getVector(source, sourceSettings, searchText, true, req.user.directories);
        const results = await queryCollection(req.user.directories, collectionId, source, sourceSettings, vector, topK, threshold, req.body.profile, Boolean(req.body.metadataOnly));
        return res.json(results);
    } catch (error) {
        return vectorError(res, error);
    }
});

router.post('/query-multi', async (req, res) => {
    try {
        if (!Array.isArray(req.body.collectionIds) || !req.body.searchText) {
            return res.sendStatus(400);
        }

        const collectionIds = req.body.collectionIds.map(x => String(x));
        const searchText = String(req.body.searchText);
        const topK = Number(req.body.topK) || 10;
        const threshold = Number(req.body.threshold) || 0.0;
        const source = String(req.body.source || 'transformers');
        const sourceSettings = getSourceSettings(source, req);

        if (collectionIds.length > 100) return res.sendStatus(400);
        const vector = await getVector(source, sourceSettings, searchText, true, req.user.directories);
        const candidates = [];
        for (const collectionId of collectionIds) {
            const results = await queryCollection(req.user.directories, collectionId, source, sourceSettings, vector, topK, threshold, req.body.profile, true);
            candidates.push(...results.metadata.map(item => ({ collectionId, ...item })));
        }
        const selected = candidates.sort((a, b) => b.score - a.score).slice(0, Math.min(500, Math.max(1, topK)));
        const results = {};
        for (const item of selected) {
            const group = results[item.collectionId] ||= { hashes: [], metadata: [] };
            group.hashes.push(item.hash);
            group.metadata.push(item);
        }
        if (!req.body.metadataOnly) {
            for (const [collectionId, group] of Object.entries(results)) {
                const bodies = await useIndex(req.user.directories, collectionId, source, sourceSettings, req.body.profile,
                    store => store.bodies(group.metadata.map(x => x.id)));
                const byId = new Map(bodies.map(x => [x.id, x.text]));
                for (const item of group.metadata) item.text = byId.get(item.id);
            }
        }
        return res.json(results);
    } catch (error) {
        return vectorError(res, error);
    }
});

router.post('/insert', async (req, res) => {
    try {
        if (!Array.isArray(req.body.items) || !req.body.collectionId) {
            return res.sendStatus(400);
        }

        const collectionId = String(req.body.collectionId);
        const items = req.body.items.map(x => ({
            hash: x.hash, text: String(x.text ?? ''), index: x.index, chunk: x.chunk,
            messageId: x.messageId, version: x.version, swipeId: x.swipeId,
        }));
        const source = String(req.body.source || 'transformers');
        const sourceSettings = getSourceSettings(source, req);

        await insertVectorItems(req.user.directories, collectionId, source, sourceSettings, items, req.body.profile);
        return res.sendStatus(200);
    } catch (error) {
        return vectorError(res, error);
    }
});

router.post('/list', async (req, res) => {
    try {
        if (!req.body.collectionId) {
            return res.sendStatus(400);
        }

        const collectionId = String(req.body.collectionId);
        const source = String(req.body.source || 'transformers');
        const sourceSettings = getSourceSettings(source, req);

        const hashes = await useIndex(req.user.directories, collectionId, source, sourceSettings, req.body.profile, store => store.hashes());
        return res.json(hashes);
    } catch (error) {
        return vectorError(res, error);
    }
});

router.post('/delete', async (req, res) => {
    try {
        if (!Array.isArray(req.body.hashes) || !req.body.collectionId) {
            return res.sendStatus(400);
        }

        const collectionId = String(req.body.collectionId);
        const hashes = req.body.hashes.map(x => Number(x));
        const source = String(req.body.source || 'transformers');
        const sourceSettings = getSourceSettings(source, req);

        await useIndex(req.user.directories, collectionId, source, sourceSettings, req.body.profile, store => store.deleteHashes(hashes));
        return res.sendStatus(200);
    } catch (error) {
        return vectorError(res, error);
    }
});

router.post('/purge-all', async (req, res) => {
    try {
        await purgeVectorWorker(req.user.directories.vectors);
        for (const source of SOURCES) {
            const sourcePath = path.join(req.user.directories.vectors, sanitize(source));
            if (!fs.existsSync(sourcePath)) {
                continue;
            }
            await fs.promises.rm(sourcePath, { recursive: true });
            console.info(`Deleted vector source store at ${sourcePath}`);
        }

        return res.sendStatus(200);
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});

router.post('/purge', async (req, res) => {
    try {
        if (!req.body.collectionId) {
            return res.sendStatus(400);
        }

        const collectionId = String(req.body.collectionId);
        await purgeVectorWorker(req.user.directories.vectors, collectionId);

        for (const source of SOURCES) {
            const sourcePath = path.join(req.user.directories.vectors, sanitize(source), sanitize(collectionId));
            if (!fs.existsSync(sourcePath)) {
                continue;
            }
            await fs.promises.rm(sourcePath, { recursive: true });
            console.info(`Deleted vector index at ${sourcePath}`);
        }

        return res.sendStatus(200);
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});

// Bounded metadata reconciliation: absence from a loaded chat window never deletes history.
router.post('/state', async (req, res) => {
    try {
        if (!req.body.collectionId || !Array.isArray(req.body.messageIds) || req.body.messageIds.length > 500) return res.sendStatus(400);
        const source = String(req.body.source || 'transformers');
        const settings = getSourceSettings(source, req);
        const items = await useIndex(req.user.directories, String(req.body.collectionId), source, settings, req.body.profile,
            store => store.messageState(req.body.messageIds));
        return res.json({ items });
    } catch (error) {
        return vectorError(res, error);
    }
});

router.post('/bodies', async (req, res) => {
    try {
        if (!req.body.collectionId || !Array.isArray(req.body.ids) || req.body.ids.length > 500) return res.sendStatus(400);
        const source = String(req.body.source || 'transformers');
        const settings = getSourceSettings(source, req);
        const items = await useIndex(req.user.directories, String(req.body.collectionId), source, settings, req.body.profile,
            store => store.bodies(req.body.ids));
        return res.json({ items });
    } catch (error) {
        return vectorError(res, error);
    }
});

router.post('/delete-messages', async (req, res) => {
    try {
        if (!req.body.collectionId || !Array.isArray(req.body.messageIds) || req.body.messageIds.length > 500) return res.sendStatus(400);
        const source = String(req.body.source || 'transformers');
        const settings = getSourceSettings(source, req);
        await useIndex(req.user.directories, String(req.body.collectionId), source, settings, req.body.profile,
            store => store.deleteMessages(req.body.messageIds));
        return res.sendStatus(200);
    } catch (error) {
        return vectorError(res, error);
    }
});
