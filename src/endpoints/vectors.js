const vectra = require('vectra');
const path = require('path');
const express = require('express');
const sanitize = require('sanitize-filename');
const { jsonParser } = require('../express-common');

/**
 * Gets the vector for the given text from the given source.
 * @param {string} source - The source of the vector
 * @param {Object} sourceSettings - Settings for the source, if it needs any
 * @param {string} text - The text to get the vector for
 * @returns {Promise<number[]>} - The vector for the text
 */
async function getVector(source, sourceSettings, text) {
    switch (source) {
        case 'mistral':
        case 'openai':
            return require('../openai-vectors').getOpenAIVector(text, source);
        case 'transformers':
            return require('../embedding').getTransformersVector(text);
        case 'extras':
            return require('../extras-vectors').getExtrasVector(text, sourceSettings.extrasUrl, sourceSettings.extrasKey);
        case 'palm':
            return require('../makersuite-vectors').getMakerSuiteVector(text);
    }

    throw new Error(`Unknown vector source ${source}`);
}

/**
 * Gets the vector for the given text batch from the given source.
 * @param {string} source - The source of the vector
 * @param {Object} sourceSettings - Settings for the source, if it needs any
 * @param {string[]} texts - The array of texts to get the vector for
 * @returns {Promise<number[][]>} - The array of vectors for the texts
 */
async function getBatchVector(source, sourceSettings, texts) {
    const batchSize = 10;
    const batches = Array(Math.ceil(texts.length / batchSize)).fill(undefined).map((_, i) => texts.slice(i * batchSize, i * batchSize + batchSize));

    let results = [];
    for (let batch of batches) {
        switch (source) {
            case 'mistral':
            case 'openai':
                results.push(...await require('../openai-vectors').getOpenAIBatchVector(batch, source));
                break;
            case 'transformers':
                results.push(...await require('../embedding').getTransformersBatchVector(batch));
                break;
            case 'extras':
                results.push(...await require('../extras-vectors').getExtrasBatchVector(batch, sourceSettings.extrasUrl, sourceSettings.extrasKey));
                break;
            case 'palm':
                results.push(...await require('../makersuite-vectors').getMakerSuiteBatchVector(batch));
                break;
            default:
                throw new Error(`Unknown vector source ${source}`);
        }
    }

    return results;
}

/**
 * Gets the index for the vector collection
 * @param {string} collectionId - The collection ID
 * @param {string} source - The source of the vector
 * @param {boolean} create - Whether to create the index if it doesn't exist
 * @returns {Promise<vectra.LocalIndex>} - The index for the collection
 */
async function getIndex(collectionId, source, create = true) {
    const store = new vectra.LocalIndex(path.join(process.cwd(), 'vectors', sanitize(source), sanitize(collectionId)));

    if (create && !await store.isIndexCreated()) {
        await store.createIndex();
    }

    return store;
}

/**
 * Inserts items into the vector collection
 * @param {string} collectionId - The collection ID
 * @param {string} source - The source of the vector
 * @param {Object} sourceSettings - Settings for the source, if it needs any
 * @param {{ hash: number; text: string; index: number; }[]} items - The items to insert
 */
async function insertVectorItems(collectionId, source, sourceSettings, items) {
    const store = await getIndex(collectionId, source);

    await store.beginUpdate();

    const vectors = await getBatchVector(source, sourceSettings, items.map(x => x.text));

    for (let i = 0; i < items.length; i++) {
        const item = items[i];
        const vector = vectors[i];
        await store.upsertItem({ vector: vector, metadata: { hash: item.hash, text: item.text, index: item.index } });
    }

    await store.endUpdate();
}

/**
 * Gets the hashes of the items in the vector collection
 * @param {string} collectionId - The collection ID
 * @param {string} source - The source of the vector
 * @returns {Promise<number[]>} - The hashes of the items in the collection
 */
async function getSavedHashes(collectionId, source) {
    const store = await getIndex(collectionId, source);

    const items = await store.listItems();
    const hashes = items.map(x => Number(x.metadata.hash));

    return hashes;
}

/**
 * Deletes items from the vector collection by hash
 * @param {string} collectionId - The collection ID
 * @param {string} source - The source of the vector
 * @param {number[]} hashes - The hashes of the items to delete
 */
async function deleteVectorItems(collectionId, source, hashes) {
    const store = await getIndex(collectionId, source);
    const items = await store.listItemsByMetadata({ hash: { '$in': hashes } });

    await store.beginUpdate();

    for (const item of items) {
        await store.deleteItem(item.id);
    }

    await store.endUpdate();
}

/**
 * Gets the hashes of the items in the vector collection that match the search text
 * @param {string} collectionId - The collection ID
 * @param {string} source - The source of the vector
 * @param {Object} sourceSettings - Settings for the source, if it needs any
 * @param {string} searchText - The text to search for
 * @param {number} topK - The number of results to return
 * @returns {Promise<{hashes: number[], metadata: object[]}>} - The metadata of the items that match the search text
 */
async function queryCollection(collectionId, source, sourceSettings, searchText, topK) {
    const store = await getIndex(collectionId, source);
    const vector = await getVector(source, sourceSettings, searchText);

    const result = await store.queryItems(vector, topK);
    const metadata = result.map(x => x.item.metadata);
    const hashes = result.map(x => Number(x.item.metadata.hash));
    return { metadata, hashes };
}

/**
 * Extracts settings for the vectorization sources from the HTTP request headers.
 * @param {string} source - Which source to extract settings for.
 * @param {object} request - The HTTP request object.
 * @returns {object} - An object that can be used as `sourceSettings` in functions that take that parameter.
 */
function getSourceSettings(source, request) {
    // Extras API settings to connect to the Extras embeddings provider
    let extrasUrl = '';
    let extrasKey = '';
    if (source === 'extras') {
        extrasUrl = String(request.headers['x-extras-url']);
        extrasKey = String(request.headers['x-extras-key']);
    }

    const sourceSettings = {
        extrasUrl: extrasUrl,
        extrasKey: extrasKey,
    };
    return sourceSettings;
}

const router = express.Router();

router.post('/query', jsonParser, async (req, res) => {
    try {
        if (!req.body.collectionId || !req.body.searchText) {
            return res.sendStatus(400);
        }

        const collectionId = String(req.body.collectionId);
        const searchText = String(req.body.searchText);
        const topK = Number(req.body.topK) || 10;
        const source = String(req.body.source) || 'transformers';
        const sourceSettings = getSourceSettings(source, req);

        const results = await queryCollection(collectionId, source, sourceSettings, searchText, topK);
        return res.json(results);
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
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

        await insertVectorItems(collectionId, source, sourceSettings, items);
        return res.sendStatus(200);
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});

router.post('/list', jsonParser, async (req, res) => {
    try {
        if (!req.body.collectionId) {
            return res.sendStatus(400);
        }

        const collectionId = String(req.body.collectionId);
        const source = String(req.body.source) || 'transformers';

        const hashes = await getSavedHashes(collectionId, source);
        return res.json(hashes);
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
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

        await deleteVectorItems(collectionId, source, hashes);
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

        const sources = ['transformers', 'openai', 'palm'];
        for (const source of sources) {
            const index = await getIndex(collectionId, source, false);

            const exists = await index.isIndexCreated();

            if (!exists) {
                continue;
            }

            const path = index.folderPath;
            await index.deleteIndex();
            console.log(`Deleted vector index at ${path}`);
        }

        return res.sendStatus(200);
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});

module.exports = { router };
