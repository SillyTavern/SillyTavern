
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

const model = new EmbeddingModel();

/**
 * @param {string} text
 */
async function getLocalVector(text) {
    const use = await model.get();
    const tensor = await use.embed(text);
    const vector = Array.from(await tensor.data());

    return vector;
}

module.exports = {
    getLocalVector,
};
