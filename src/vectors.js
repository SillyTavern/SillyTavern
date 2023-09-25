const express = require('express');
const vectra = require('vectra');
const path = require('path');
const sanitize = require('sanitize-filename');

/**
 * Gets the vector for the given text from the given source.
 * @param {string} source - The source of the vector
 * @param {string} text - The text to get the vector for
 * @returns {Promise<number[]>} - The vector for the text
 */
async function getVector(source, text) {
    switch (source) {
        case 'openai':
            return require('./openai-vectors').getOpenAIVector(text);
        case 'transformers':
            return require('./embedding').getTransformersVector(text);
        case 'palm':
            return require('./palm-vectors').getPaLMVector(text);
    }

    throw new Error(`Unknown vector source ${source}`);
}

/**
 * Gets the index for the vector collection
 * @param {string} collectionId - The collection ID
 * @param {string} source - The source of the vector
 * @param {boolean} create - Whether to create the index if it doesn't exist
 * @returns {Promise<vectra.LocalIndex>} - The index for the collection
 */
async function getIndex(collectionId, source, create = true) {
    const index = new vectra.LocalIndex(path.join(process.cwd(), 'vectors', sanitize(source), sanitize(collectionId)));

    if (create && !await index.isIndexCreated()) {
        await index.createIndex();
    }

    return index;
}

/**
 * Inserts items into the vector collection
 * @param {string} collectionId - The collection ID
 * @param {string} source - The source of the vector
 * @param {{ hash: number; text: string; }[]} items - The items to insert
 */
async function insertVectorItems(collectionId, source, items) {
    const index = await getIndex(collectionId, source);

    await index.beginUpdate();

    for (const item of items) {
        const text = item.text;
        const hash = item.hash;
        const vector = await getVector(source, text);
        await index.upsertItem({ vector: vector, metadata: { hash, text } });
    }

    await index.endUpdate();
}

/**
 * Gets the hashes of the items in the vector collection
 * @param {string} collectionId - The collection ID
 * @param {string} source - The source of the vector
 * @returns {Promise<number[]>} - The hashes of the items in the collection
 */
async function getSavedHashes(collectionId, source) {
    const index = await getIndex(collectionId, source);

    const items = await index.listItems();
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
    const index = await getIndex(collectionId, source);
    const items = await index.listItemsByMetadata({ hash: { '$in': hashes } });

    await index.beginUpdate();

    for (const item of items) {
        await index.deleteItem(item.id);
    }

    await index.endUpdate();
}

/**
 * Gets the hashes of the items in the vector collection that match the search text
 * @param {string} collectionId - The collection ID
 * @param {string} source - The source of the vector
 * @param {string} searchText - The text to search for
 * @param {number} topK - The number of results to return
 * @returns {Promise<number[]>} - The hashes of the items that match the search text
 */
async function queryCollection(collectionId, source, searchText, topK) {
    const index = await getIndex(collectionId, source);
    const vector = await getVector(source, searchText);

    const result = await index.queryItems(vector, topK);
    const hashes = result.map(x => Number(x.item.metadata.hash));
    return hashes;
}

/**
 * Registers the endpoints for the vector API
 * @param {express.Express} app - Express app
 * @param {any} jsonParser - Express JSON parser
 */
async function registerEndpoints(app, jsonParser) {
    app.post('/api/vector/query', jsonParser, async (req, res) => {
        try {
            if (!req.body.collectionId || !req.body.searchText) {
                return res.sendStatus(400);
            }

            const collectionId = String(req.body.collectionId);
            const searchText = String(req.body.searchText);
            const topK = Number(req.body.topK) || 10;
            const source = String(req.body.source) || 'transformers';

            const results = await queryCollection(collectionId, source, searchText, topK);
            return res.json(results);
        } catch (error) {
            console.error(error);
            return res.sendStatus(500);
        }
    });

    app.post('/api/vector/insert', jsonParser, async (req, res) => {
        try {
            if (!Array.isArray(req.body.items) || !req.body.collectionId) {
                return res.sendStatus(400);
            }

            const collectionId = String(req.body.collectionId);
            const items = req.body.items.map(x => ({ hash: x.hash, text: x.text }));
            const source = String(req.body.source) || 'transformers';

            await insertVectorItems(collectionId, source, items);
            return res.sendStatus(200);
        } catch (error) {
            console.error(error);
            return res.sendStatus(500);
        }
    });

    app.post('/api/vector/list', jsonParser, async (req, res) => {
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

    app.post('/api/vector/delete', jsonParser, async (req, res) => {
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

    app.post('/api/vector/purge', jsonParser, async (req, res) => {
        try {
            if (!req.body.collectionId) {
                return res.sendStatus(400);
            }

            const collectionId = String(req.body.collectionId);

            const sources = ['transformers', 'openai'];
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
}

module.exports = { registerEndpoints };
