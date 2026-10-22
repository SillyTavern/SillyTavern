/** The existing settings fields are the single source of truth for model IDs. */
export const CHAT_COMPLETION_MODEL_SETTINGS = Object.freeze({
    openai: 'openai_model',
    claude: 'claude_model',
    openrouter: 'openrouter_model',
    ai21: 'ai21_model',
    makersuite: 'google_model',
    vertexai: 'vertexai_model',
    mistralai: 'mistralai_model',
    custom: 'custom_model',
    cohere: 'cohere_model',
    perplexity: 'perplexity_model',
    groq: 'groq_model',
    siliconflow: 'siliconflow_model',
    minimax: 'minimax_model',
    electronhub: 'electronhub_model',
    chutes: 'chutes_model',
    nanogpt: 'nanogpt_model',
    deepseek: 'deepseek_model',
    aimlapi: 'aimlapi_model',
    xai: 'xai_model',
    pollinations: 'pollinations_model',
    cometapi: 'cometapi_model',
    moonshot: 'moonshot_model',
    fireworks: 'fireworks_model',
    azure_openai: 'azure_openai_model',
    zai: 'zai_model',
    workers_ai: 'workers_ai_model',
});

const MAX_CUSTOM_MODELS = 50;

/**
 * Read bounded, per-source model history, including settings from older versions.
 * @param {object} settings Chat completion settings
 * @param {string} source API source
 * @returns {string[]} Previously entered model IDs
 */
export function getCustomModelIds(settings, source) {
    const models = settings.custom_model_ids?.[source];
    return Array.isArray(models)
        ? [...new Set(models.filter(model => typeof model === 'string' && model.trim()))].slice(0, MAX_CUSTOM_MODELS)
        : [];
}

/**
 * Remember an explicit model choice independently of connection presets.
 * @param {object} settings Chat completion settings
 * @param {string} source API source
 * @param {string} model Model ID
 */
export function rememberCustomModel(settings, source, model) {
    if (!Object.hasOwn(CHAT_COMPLETION_MODEL_SETTINGS, source) || typeof model !== 'string' || !model.trim()) {
        return;
    }
    const models = getCustomModelIds(settings, source);
    if (!settings.custom_model_ids || typeof settings.custom_model_ids !== 'object' || Array.isArray(settings.custom_model_ids)) {
        settings.custom_model_ids = {};
    }
    settings.custom_model_ids[source] = [model, ...models.filter(id => id !== model)].slice(0, MAX_CUSTOM_MODELS);
}

/**
 * Add an unlisted ID without inventing API capability or pricing metadata.
 * Uses textContent via Option so model IDs are never interpreted as markup.
 * @param {HTMLSelectElement} select Model selector
 * @param {string} model Model ID
 * @returns {boolean} Whether a new option was added
 */
export function ensureModelOption(select, model) {
    if (!select || typeof model !== 'string' || !model || Array.from(select.options).some(option => option.value === model)) {
        return false;
    }
    const option = new Option(model, model);
    option.dataset.customModel = 'true';
    select.add(option);
    return true;
}
