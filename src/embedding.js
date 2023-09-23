const TASK = 'feature-extraction';

/**
 * @param {string} text - The text to vectorize
 * @returns {Promise<number[]>} - The vectorized text in form of an array of numbers
 */
async function getTransformersVector(text) {
    const module = await import('./transformers.mjs');
    const pipe = await module.default.getPipeline(TASK);
    const result = await pipe(text, { pooling: 'mean', normalize: true });
    const vector = Array.from(result.data);
    return vector;
}

module.exports = {
    getTransformersVector,
}
