const express = require('express');
const vectra = require('vectra');
const path = require('path');
const sanitize = require('sanitize-filename');
require('@tensorflow/tfjs');
const encoder = require('@tensorflow-models/universal-sentence-encoder');

/**
 * Lazy loading class for the embedding model.
 */
class EmbeddingModel {
    /**
     * @type {encoder.UniversalSentenceEncoder} - The embedding model
     */
    model;

    async get() {
        if (!this.model) {
            this.model = await encoder.load();
        }

        return this.model;
    }
}

/**
 * Hard limit on the number of results to return from the vector search.
 */
const TOP_K = 100;
const model = new EmbeddingModel();

/**
 * Gets the index for the vector collection
 * @param {string} collectionId - The collection ID
 * @returns {Promise<vectra.LocalIndex>} - The index for the collection
 */
async function getIndex(collectionId) {
    const index = new vectra.LocalIndex(path.join(process.cwd(), 'vectors', sanitize(collectionId)));

    if (!await index.isIndexCreated()) {
        await index.createIndex();
    }

    return index;
}

/**
 * Inserts items into the vector collection
 * @param {string} collectionId - The collection ID
 * @param {{ hash: number; text: string; }[]} items - The items to insert
 */
async function insertVectorItems(collectionId, items) {
    const index = await getIndex(collectionId);
    const use = await model.get();

    await index.beginUpdate();

    for (const item of items) {
        const text = item.text;
        const hash = item.hash;
        const tensor = await use.embed(text);
        const vector = Array.from(await tensor.data());
        await index.upsertItem({ vector: vector, metadata: { hash, text } });
    }

    await index.endUpdate();
}

/**
 * Gets the hashes of the items in the vector collection
 * @param {string} collectionId - The collection ID
 * @returns {Promise<number[]>} - The hashes of the items in the collection
 */
async function getSavedHashes(collectionId) {
    const index = await getIndex(collectionId);

    const items = await index.listItems();
    const hashes = items.map(x => Number(x.metadata.hash));

    return hashes;
}

/**
 * Deletes items from the vector collection by hash
 * @param {string} collectionId - The collection ID
 * @param {number[]} hashes - The hashes of the items to delete
 */
async function deleteVectorItems(collectionId, hashes) {
    const index = await getIndex(collectionId);
    const items = await index.listItemsByMetadata({ hash: { '$in': hashes } });

    await index.beginUpdate();

    for (const item of items) {
        await index.deleteItem(item.id);
    }

    await index.endUpdate();
}

/**
 * Gets the hashes of the items in the vector collection that match the search text
 * @param {string} collectionId
 * @param {string} searchText
 * @returns {Promise<number[]>} - The hashes of the items that match the search text
 */
async function queryCollection(collectionId, searchText) {
    const index = await getIndex(collectionId);
    const use = await model.get();
    const tensor = await use.embed(searchText);
    const vector = Array.from(await tensor.data());

    const result = await index.queryItems(vector, TOP_K);
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

            const results = await queryCollection(collectionId, searchText);
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

            await insertVectorItems(collectionId, items);
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

            const hashes = await getSavedHashes(collectionId);
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

            await deleteVectorItems(collectionId, hashes);
            return res.sendStatus(200);
        } catch (error) {
            console.error(error);
            return res.sendStatus(500);
        }
    });
}

module.exports = { registerEndpoints };
