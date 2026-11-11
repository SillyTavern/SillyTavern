/**
 * Gets the model whose behavior applies to a Chat Completion request.
 * A custom model ID can come with an optional `model_base` naming a known model whose behavior to copy. The request to the provider always uses `model`.
 * @param {object} body Request body
 * @returns {string} Model ID for capability checks
 */
export function getCapabilityModel(body) {
    return String(body?.model_base || body?.model || '');
}
