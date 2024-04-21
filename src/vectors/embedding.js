const TASK = 'feature-extraction';

/**
 * Gets the vectorized text in form of an array of numbers.
 * @param {string} text - The text to vectorize
 * @returns {Promise<number[]>} - The vectorized text in form of an array of numbers
 */
async function getTransformersVector(text) {
    const module = await import('../transformers.mjs');
    const pipe = await module.default.getPipeline(TASK);
    const result = await pipe(text, { pooling: 'mean', normalize: true });
    const vector = Array.from(result.data);
    return vector;
}

/**
 * Gets the vectorized texts in form of an array of arrays of numbers.
 * @param {string[]} texts - The texts to vectorize
 * @returns {Promise<number[][]>} - The vectorized texts in form of an array of arrays of numbers
 */
async function getTransformersBatchVector(texts) {
    const result = [];
    for (const text of texts) {
        result.push(await getTransformersVector(text));
    }
    return result;
}

module.exports = {
    getTransformersVector,
    getTransformersBatchVector,
};
