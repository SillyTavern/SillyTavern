/**
 * Shape and validation of a Custom (OpenAI-compatible) connection, API version 1.
 * This module has no imports and touches no browser or Node API beyond URL and structuredClone,
 * because the server validates the same shapes with it (src/custom-auth.js). Keep it that way.
 * The registry and everything stateful lives in custom-providers.js.
 */

export const CUSTOM_CONNECTION_FIELDS = Object.freeze([
    'custom_url', 'custom_model', 'custom_include_headers', 'custom_include_body',
    'custom_exclude_body', 'custom_prompt_post_processing',
]);
// Scalar Chat Completion vault categories. Account documents and unrelated credentials are excluded.
export const CUSTOM_CREDENTIAL_KEYS = Object.freeze([
    'openai', 'claude', 'openrouter', 'ai21', 'makersuite', 'vertexai', 'mistralai',
    'custom', 'cohere', 'perplexity', 'groq', 'chutes', 'electronhub', 'nanogpt',
    'deepseek', 'aimlapi', 'xai', 'fireworks', 'minimax', 'moonshot', 'cometapi',
    'azure_openai', 'zai', 'siliconflow', 'pollinations', 'workers_ai',
].map(name => `api_key_${name}`));

const postProcessing = ['', 'merge', 'merge_tools', 'semi', 'semi_tools', 'strict', 'strict_tools', 'single'];
export const copy = value => structuredClone(value);

export function object(value, name, keys) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object.`);
    const unknown = Object.keys(value).find(key => !keys.includes(key));
    if (unknown !== undefined) throw new Error(`${name} contains an unsupported field "${unknown}".`);
}

export function text(value, name, nonempty = false) {
    if (typeof value !== 'string' || (nonempty && !value.trim())) throw new Error(`${name} must be ${nonempty ? 'nonempty ' : ''}text.`);
    return value;
}

/** Normalize an HTTP(S) API root without changing its path. */
export function normalizeCustomEndpoint(value) {
    const url = new URL(text(value, 'API root', true));
    if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password || url.search || url.hash) {
        throw new Error('Use an HTTP(S) API root without credentials, a query, or a fragment.');
    }
    if (/\/chat\/completions\/?$/i.test(url.pathname)) throw new Error('Use the API root, not the /chat/completions URL.');
    return url.toString().replace(/\/+$/, '');
}

export function normalizeModels(value) {
    object(value, 'models', ['mode', 'suggestions']);
    if (!['discover', 'manual'].includes(value.mode)) throw new Error('models.mode must be discover or manual.');
    const suggestions = value.suggestions ?? [];
    if (!Array.isArray(suggestions)) throw new Error('Model suggestions must be an array.');
    return { mode: value.mode, suggestions: suggestions.map(item => {
        object(item, 'Model suggestion', ['id', 'label']);
        const result = { id: text(item.id, 'Model ID', true) };
        if (item.label !== undefined) result.label = text(item.label, 'Model label');
        return result;
    }) };
}

/** Headers a provider may not use to carry its key: they belong to the transport or to the browser session. */
const RESERVED_KEY_HEADERS = /^(host|content-length|content-type|transfer-encoding|connection|accept|accept-encoding|user-agent|cookie|set-cookie|proxy-authorization)$/i;

export function normalizeAuth(value) {
    object(value, 'auth', ['mode', 'required', 'name']);
    if (value.mode === 'none' && value.required === undefined && value.name === undefined) return { mode: 'none' };
    if (value.mode === 'bearer' && typeof value.required === 'boolean' && value.name === undefined) return { mode: 'bearer', required: value.required };
    if (value.mode === 'header' && typeof value.required === 'boolean') {
        const name = text(value.name, 'auth.name', true);
        if (!/^[A-Za-z][A-Za-z0-9-]{0,63}$/.test(name) || RESERVED_KEY_HEADERS.test(name)) throw new Error('auth.name must be a plain header name such as x-api-key.');
        return { mode: 'header', name, required: value.required };
    }
    throw new Error('Use auth.mode none, bearer with a boolean required flag, or header with a header name and a boolean required flag.');
}

/** Copy the six active connection values, including deliberate empty strings. */
export function captureCustomFields(settings, legacy = false) {
    const result = Object.fromEntries(CUSTOM_CONNECTION_FIELDS.map(field => [field, text(settings[field] ?? '', field)]));
    if (legacy && result.custom_prompt_post_processing === 'claude') result.custom_prompt_post_processing = 'merge';
    if (!postProcessing.includes(result.custom_prompt_post_processing)) throw new Error('Unsupported Custom prompt post-processing.');
    return result;
}

/** Validate a persisted snapshot independently of registration availability. */
export function validateCustomSnapshot(value) {
    object(value, 'Custom connection', ['version', 'settings', 'provider', 'models', 'auth', 'credential']);
    if (value.version !== 1) throw new Error('Unsupported Custom connection version. Keep this record and use a supporting build.');
    object(value.settings, 'Custom connection settings', CUSTOM_CONNECTION_FIELDS);
    if (CUSTOM_CONNECTION_FIELDS.some(field => typeof value.settings[field] !== 'string')) throw new Error('A saved Custom connection requires all six explicit fields.');
    const settings = captureCustomFields(value.settings, true);
    if (value.provider !== null) {
        object(value.provider, 'Provider identity', ['id', 'label']);
        text(value.provider.id, 'Provider ID', true);
        text(value.provider.label, 'Provider label', true);
    }
    const models = normalizeModels(value.models);
    const auth = normalizeAuth(value.auth);
    const credential = copy(value.credential);
    object(credential, 'Credential binding', ['mode', 'key', 'id', 'endpoint']);
    if (credential.mode === 'reference') {
        if (!CUSTOM_CREDENTIAL_KEYS.includes(credential.key)) throw new Error('Choose an eligible Chat Completion key.');
        text(credential.id, 'Secret ID', true);
        credential.endpoint = normalizeCustomEndpoint(credential.endpoint);
    } else if (credential.mode === 'legacy-custom') {
        if (Object.keys(credential).some(key => !['mode', 'id'].includes(key))) throw new Error('Invalid captured Manual binding.');
        if (value.provider !== null || !(credential.id === null || typeof credential.id === 'string' && credential.id)) throw new Error('Legacy binding is only valid for a captured Manual connection.');
    } else if (!['unbound', 'none'].includes(credential.mode)) {
        throw new Error('Unsupported credential binding.');
    } else if (Object.keys(credential).length !== 1) throw new Error('A keyless binding cannot carry key fields.');
    if (auth.mode === 'none' && credential.mode !== 'none') throw new Error('A no-auth connection cannot carry a credential.');
    if (auth.mode !== 'none' && auth.required && credential.mode === 'none') throw new Error('Required authentication must be bound or unbound.');
    if (credential.mode === 'legacy-custom' && (auth.mode !== 'bearer' || auth.required)) throw new Error('A captured Manual binding requires optional bearer authentication.');
    if (credential.mode === 'reference' && credential.endpoint !== normalizeCustomEndpoint(settings.custom_url)) throw new Error('The key is not approved for this exact API root. Select it again.');
    return { version: 1, settings, provider: copy(value.provider), models, auth, credential };
}
