import path from 'node:path';
import fs from 'node:fs';

import vectra from 'vectra';
import express from 'express';
import sanitize from 'sanitize-filename';

import { jsonParser } from '../express-common.js';
import { getConfigValue } from '../util.js';

import { getNomicAIBatchVector, getNomicAIVector } from '../vectors/nomicai-vectors.js';
import { getOpenAIVector, getOpenAIBatchVector } from '../vectors/openai-vectors.js';
import { getTransformersVector, getTransformersBatchVector } from '../vectors/embedding.js';
import { getExtrasVector, getExtrasBatchVector } from '../vectors/extras-vectors.js';
import { getMakerSuiteVector, getMakerSuiteBatchVector } from '../vectors/makersuite-vectors.js';
import { getCohereVector, getCohereBatchVector } from '../vectors/cohere-vectors.js';
import { getLlamaCppVector, getLlamaCppBatchVector } from '../vectors/llamacpp-vectors.js';
import { getVllmVector, getVllmBatchVector } from '../vectors/vllm-vectors.js';
import { getOllamaVector, getOllamaBatchVector } from '../vectors/ollama-vectors.js';

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
        case 'transformers':
            return getTransformersVector(text);
        case 'extras':
            return getExtrasVector(text, sourceSettings.extrasUrl, sourceSettings.extrasKey);
        case 'palm':
            return getMakerSuiteVector(text, directories);
        case 'cohere':
            return getCohereVector(text, isQuery, directories, sourceSettings.model);
        case 'llamacpp':
            return getLlamaCppVector(text, sourceSettings.apiUrl, directories);
        case 'vllm':
            return getVllmVector(text, sourceSettings.apiUrl, sourceSettings.model, directories);
        case 'ollama':
            return getOllamaVector(text, sourceSettings.apiUrl, sourceSettings.model, sourceSettings.keep, directories);
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
            case 'transformers':
                results.push(...await getTransformersBatchVector(batch));
                break;
            case 'extras':
                results.push(...await getExtrasBatchVector(batch, sourceSettings.extrasUrl, sourceSettings.extrasKey));
                break;
            case 'palm':
                results.push(...await getMakerSuiteBatchVector(batch, directories));
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
                model: String(request.headers['x-togetherai-model']),
            };
        case 'openai':
            return {
                model: String(request.headers['x-openai-model']),
            };
        case 'cohere':
            return {
                model: String(request.headers['x-cohere-model']),
            };
        case 'llamacpp':
            return {
                apiUrl: String(request.headers['x-llamacpp-url']),
            };
        case 'vllm':
            return {
                apiUrl: String(request.headers['x-vllm-url']),
                model: String(request.headers['x-vllm-model']),
            };
        case 'ollama':
            return {
                apiUrl: String(request.headers['x-ollama-url']),
                model: String(request.headers['x-ollama-model']),
                keep: Boolean(request.headers['x-ollama-keep']),
            };
        case 'extras':
            return {
                extrasUrl: String(request.headers['x-extras-url']),
                extrasKey: String(request.headers['x-extras-key']),
            };
        case 'transformers':
            return {
                model: getConfigValue('extras.embeddingModel', ''),
            };
        case 'palm':
            return {
                // TODO: Add support for multiple models
                model: 'text-embedding-004',
            };
        case 'mistral':
            return {
                model: 'mistral-embed',
            };
        case 'nomicai':
            return {
                model: 'nomic-embed-text-v1.5',
            };
        default:
            return {};
    }
}

/**
 * Gets the model scope for the source.
 * @param {object} sourceSettings - The settings for the source
 * @returns {string} The model scope for the source
 */
function getModelScope(sourceSettings) {
    return (sourceSettings?.model || '');
}

/**
 * Gets the index for the vector collection
 * @param {import('../users.js').UserDirectoryList} directories - User directories
 * @param {string} collectionId - The collection ID
 * @param {string} source - The source of the vector
 * @param {object} sourceSettings - The model for the source
 * @returns {Promise<vectra.LocalIndex>} - The index for the collection
 */
async function getIndex(directories, collectionId, source, sourceSettings) {
    const model = getModelScope(sourceSettings);
    const pathToFile = path.join(directories.vectors, sanitize(source), sanitize(collectionId), sanitize(model));
    const store = new vectra.LocalIndex(pathToFile);

    if (!await store.isIndexCreated()) {
        await store.createIndex();
    }

    return store;
}

/**
 * Inserts items into the vector collection
 * @param {import('../users.js').UserDirectoryList} directories - User directories
 * @param {string} collectionId - The collection ID
 * @param {string} source - The source of the vector
 * @param {Object} sourceSettings - Settings for the source, if it needs any
 * @param {{ hash: number; text: string; index: number; }[]} items - The items to insert
 */
async function insertVectorItems(directories, collectionId, source, sourceSettings, items) {
    const store = await getIndex(directories, collectionId, source, sourceSettings);

    await store.beginUpdate();

    const vectors = await getBatchVector(source, sourceSettings, items.map(x => x.text), false, directories);

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const vector = vectors[i];
        await store.upsertItem({ vector: vector, metadata: { hash: item.hash, text: item.text, index: item.index } });
    }

    await store.endUpdate();
}

/**
 * Gets the hashes of the items in the vector collection
 * @param {import('../users.js').UserDirectoryList} directories - User directories
 * @param {string} collectionId - The collection ID
 * @param {string} source - The source of the vector
 * @param {Object} sourceSettings - Settings for the source, if it needs any
 * @returns {Promise<number[]>} - The hashes of the items in the collection
 */
async function getSavedHashes(directories, collectionId, source, sourceSettings) {
    const store = await getIndex(directories, collectionId, source, sourceSettings);

    const items = await store.listItems();
    const hashes = items.map(x => Number(x.metadata.hash));

    return hashes;
}

/**
 * Deletes items from the vector collection by hash
 * @param {import('../users.js').UserDirectoryList} directories - User directories
 * @param {string} collectionId - The collection ID
 * @param {string} source - The source of the vector
 * @param {Object} sourceSettings - Settings for the source, if it needs any
 * @param {number[]} hashes - The hashes of the items to delete
 */
async function deleteVectorItems(directories, collectionId, source, sourceSettings, hashes) {
    const store = await getIndex(directories, collectionId, source, sourceSettings);
    const items = await store.listItemsByMetadata({ hash: { '$in': hashes } });

    await store.beginUpdate();

    for (const item of items) {
        await store.deleteItem(item.id);
    }

    await store.endUpdate();
}

/**
 * Gets the hashes of the items in the vector collection that match the search text
 * @param {import('../users.js').UserDirectoryList} directories - User directories
 * @param {string} collectionId - The collection ID
 * @param {string} source - The source of the vector
 * @param {Object} sourceSettings - Settings for the source, if it needs any
 * @param {string} searchText - The text to search for
 * @param {number} topK - The number of results to return
 * @param {number} threshold - The threshold for the search
 * @returns {Promise<{hashes: number[], metadata: object[]}>} - The metadata of the items that match the search text
 */
async function queryCollection(directories, collectionId, source, sourceSettings, searchText, topK, threshold) {
    const store = await getIndex(directories, collectionId, source, sourceSettings);
    const vector = await getVector(source, sourceSettings, searchText, true, directories);

    const result = await store.queryItems(vector, topK);
    const metadata = result.filter(x => x.score >= threshold).map(x => x.item.metadata);
    const hashes = result.map(x => Number(x.item.metadata.hash));
    return { metadata, hashes };
}

/**
 * Queries multiple collections for the given search queries. Returns the overall top K results.
 * @param {import('../users.js').UserDirectoryList} directories - User directories
 * @param {string[]} collectionIds - The collection IDs to query
 * @param {string} source - The source of the vector
 * @param {Object} sourceSettings - Settings for the source, if it needs any
 * @param {string} searchText - The text to search for
 * @param {number} topK - The number of results to return
 * @param {number} threshold - The threshold for the search
 *
 * @returns {Promise<Record<string, { hashes: number[], metadata: object[] }>>} - The top K results from each collection
 */
async function multiQueryCollection(directories, collectionIds, source, sourceSettings, searchText, topK, threshold) {
    const vector = await getVector(source, sourceSettings, searchText, true, directories);
    const results = [];

    for (const collectionId of collectionIds) {
        const store = await getIndex(directories, collectionId, source, sourceSettings);
        const result = await store.queryItems(vector, topK);
        results.push(...result.map(result => ({ collectionId, result })));
    }

    // Sort results by descending similarity, apply threshold, and take top K
    const sortedResults = results
        .sort((a, b) => b.result.score - a.result.score)
        .filter(x => x.result.score >= threshold)
        .slice(0, topK);

    /**
     * Group the results by collection ID
     * @type {Record<string, { hashes: number[], metadata: object[] }>}
     */
    const groupedResults = {};
    for (const result of sortedResults) {
        if (!groupedResults[result.collectionId]) {
            groupedResults[result.collectionId] = { hashes: [], metadata: [] };
        }

        groupedResults[result.collectionId].hashes.push(Number(result.result.item.metadata.hash));
        groupedResults[result.collectionId].metadata.push(result.result.item.metadata);
    }

    return groupedResults;
}

/**
 * Performs a request to regenerate the index if it is corrupted.
 * @param {import('express').Request} req Express request object
 * @param {import('express').Response} res Express response object
 * @param {Error} error Error object
 * @returns {Promise<any>} Promise
 */
async function regenerateCorruptedIndexErrorHandler(req, res, error) {
    if (error instanceof SyntaxError && !req.query.regenerated) {
        const collectionId = String(req.body.collectionId);
        const source = String(req.body.source) || 'transformers';
        const sourceSettings = getSourceSettings(source, req);

        if (collectionId && source) {
            const index = await getIndex(req.user.directories, collectionId, source, sourceSettings);
            const exists = await index.isIndexCreated();

            if (exists) {
                const path = index.folderPath;
                console.error(`Corrupted index detected at ${path}, regenerating...`);
                await index.deleteIndex();
                return res.redirect(307, req.originalUrl + '?regenerated=true');
            }
        }
    }

    console.error(error);
    return res.sendStatus(500);
}

export const router = express.Router();

router.post('/query', jsonParser, async (req, res) => {
    try {
        if (!req.body.collectionId || !req.body.searchText) {
            return res.sendStatus(400);
        }

        const collectionId = String(req.body.collectionId);
        const searchText = String(req.body.searchText);
        const topK = Number(req.body.topK) || 10;
        const threshold = Number(req.body.threshold) || 0.0;
        const source = String(req.body.source) || 'transformers';
        const sourceSettings = getSourceSettings(source, req);

        const results = await queryCollection(req.user.directories, collectionId, source, sourceSettings, searchText, topK, threshold);
        return res.json(results);
    } catch (error) {
        return regenerateCorruptedIndexErrorHandler(req, res, error);
    }
});

router.post('/query-multi', jsonParser, async (req, res) => {
    try {
        if (!Array.isArray(req.body.collectionIds) || !req.body.searchText) {
            return res.sendStatus(400);
        }

        const collectionIds = req.body.collectionIds.map(x => String(x));
        const searchText = String(req.body.searchText);
        const topK = Number(req.body.topK) || 10;
        const threshold = Number(req.body.threshold) || 0.0;
        const source = String(req.body.source) || 'transformers';
        const sourceSettings = getSourceSettings(source, req);

        const results = await multiQueryCollection(req.user.directories, collectionIds, source, sourceSettings, searchText, topK, threshold);
        return res.json(results);
    } catch (error) {
        return regenerateCorruptedIndexErrorHandler(req, res, error);
    }
});

router.post('/insert', jsonParser, async (req, res) => {
    try {
        if (!Array.isArray(req.body.items) || !req.body.collectionId) {
            return res.sendStatus(400);
        }

        const collectionId = String(req.body.collectionId);
        const items = req.body.items.map(x => ({ hash: x.hash, text: x.text, index: x.index }));
        const source = String(req.body.source) || 'transformers';
        const sourceSettings = getSourceSettings(source, req);

        await insertVectorItems(req.user.directories, collectionId, source, sourceSettings, items);
        return res.sendStatus(200);
    } catch (error) {
        return regenerateCorruptedIndexErrorHandler(req, res, error);
    }
});

router.post('/list', jsonParser, async (req, res) => {
    try {
        if (!req.body.collectionId) {
            return res.sendStatus(400);
        }

        const collectionId = String(req.body.collectionId);
        const source = String(req.body.source) || 'transformers';
        const sourceSettings = getSourceSettings(source, req);

        const hashes = await getSavedHashes(req.user.directories, collectionId, source, sourceSettings);
        return res.json(hashes);
    } catch (error) {
        return regenerateCorruptedIndexErrorHandler(req, res, error);
    }
});

router.post('/delete', jsonParser, async (req, res) => {
    try {
        if (!Array.isArray(req.body.hashes) || !req.body.collectionId) {
            return res.sendStatus(400);
        }

        const collectionId = String(req.body.collectionId);
        const hashes = req.body.hashes.map(x => Number(x));
        const source = String(req.body.source) || 'transformers';
        const sourceSettings = getSourceSettings(source, req);

        await deleteVectorItems(req.user.directories, collectionId, source, sourceSettings, hashes);
        return res.sendStatus(200);
    } catch (error) {
        return regenerateCorruptedIndexErrorHandler(req, res, error);
    }
});

router.post('/purge-all', jsonParser, async (req, res) => {
    try {
        for (const source of SOURCES) {
            const sourcePath = path.join(req.user.directories.vectors, sanitize(source));
            if (!fs.existsSync(sourcePath)) {
                continue;
            }
            await fs.promises.rm(sourcePath, { recursive: true });
            console.log(`Deleted vector source store at ${sourcePath}`);
        }

        return res.sendStatus(200);
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});

router.post('/purge', jsonParser, async (req, res) => {
    try {
        if (!req.body.collectionId) {
            return res.sendStatus(400);
        }

        const collectionId = String(req.body.collectionId);

        for (const source of SOURCES) {
            const sourcePath = path.join(req.user.directories.vectors, sanitize(source), sanitize(collectionId));
            if (!fs.existsSync(sourcePath)) {
                continue;
            }
            await fs.promises.rm(sourcePath, { recursive: true });
            console.log(`Deleted vector index at ${sourcePath}`);
        }

        return res.sendStatus(200);
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});
