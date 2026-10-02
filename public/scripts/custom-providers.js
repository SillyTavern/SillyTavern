/**
 * Declarative setup helpers for Chat Completion / Custom, API version 1.
 * An extension registers in its activate hook and unregisters in disable/delete/clean.
 * Registration changes presentation and first-use/reset defaults only. It never selects,
 * persists, chooses a key, discovers models, or sends a request. Installed extensions are
 * trusted JavaScript; owner IDs provide lifetime cleanup, not an extension sandbox.
 * The six flat Custom settings remain the active execution values. Private settings and
 * Profiles preserve resolved snapshots and opaque core-vault references, never key values.
 */
import { eventSource, event_types } from './events.js';

export const CUSTOM_PROVIDER_API_VERSION = 1;
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

/** @typedef {{mode: 'discover'|'manual', suggestions?: {id: string, label?: string}[]}} ModelSetup */
/** @typedef {{mode: 'none'}|{mode: 'bearer', required: boolean}} AuthPolicy */
/** @typedef {{mode: 'unbound'}|{mode: 'none'}|{mode: 'reference', key: string, id: string, endpoint: string}|{mode: 'legacy-custom', id: string|null}} CredentialBinding */
/** @typedef {{provider: {id: string, label: string}|null, models: ModelSetup, auth: AuthPolicy, credential: CredentialBinding}} ConnectionMetadata */
/** @typedef {ConnectionMetadata & {version: 1, settings: Record<string, string>}} CustomConnectionSnapshot */
/** @typedef {{version: 1, active: ConnectionMetadata|null, manual: CustomConnectionSnapshot|null, drafts: Record<string, CustomConnectionSnapshot>}} CustomProviderState */
/** @typedef {{label: string, defaults: Record<string, string>, models: ModelSetup, auth: AuthPolicy, documentationUrl?: string, supportUrl?: string, note?: string}} CustomProviderDefinition */
/** @typedef {Readonly<{id: string, update: (definition: CustomProviderDefinition) => void, unregister: () => void}>} Registration */

const registrations = new Map();
const suspendedOwners = new Set();
const postProcessing = ['', 'merge', 'merge_tools', 'semi', 'semi_tools', 'strict', 'strict_tools', 'single'];
const copy = value => structuredClone(value);

function object(value, name, keys) {
    if (!value || typeof value !== 'object' || Array.isArray(value)) throw new Error(`${name} must be an object.`);
    if (Object.keys(value).some(key => !keys.includes(key))) throw new Error(`${name} contains an unsupported field.`);
}

function text(value, name, nonempty = false) {
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

function normalizeModels(value) {
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

function normalizeAuth(value) {
    object(value, 'auth', ['mode', 'required']);
    if (value.mode === 'none' && value.required === undefined) return { mode: 'none' };
    if (value.mode === 'bearer' && typeof value.required === 'boolean') return { mode: 'bearer', required: value.required };
    throw new Error('Use auth.mode none, or bearer with a boolean required flag.');
}

/** Copy the six active connection values, including deliberate empty strings. */
export function captureCustomFields(settings, legacy = false) {
    const result = Object.fromEntries(CUSTOM_CONNECTION_FIELDS.map(field => [field, text(settings[field] ?? '', field)]));
    if (legacy && result.custom_prompt_post_processing === 'claude') result.custom_prompt_post_processing = 'merge';
    if (!postProcessing.includes(result.custom_prompt_post_processing)) throw new Error('Unsupported Custom prompt post-processing.');
    return result;
}

function normalizeDefinition(value) {
    object(value, 'Provider definition', ['label', 'defaults', 'models', 'auth', 'documentationUrl', 'supportUrl', 'note']);
    object(value.defaults, 'Provider defaults', CUSTOM_CONNECTION_FIELDS);
    const defaults = captureCustomFields(value.defaults);
    defaults.custom_url = normalizeCustomEndpoint(defaults.custom_url);
    const result = { label: text(value.label, 'Provider label', true), defaults, models: normalizeModels(value.models), auth: normalizeAuth(value.auth) };
    for (const field of ['documentationUrl', 'supportUrl']) {
        if (value[field] !== undefined) {
            const url = new URL(text(value[field], field, true));
            if (!['http:', 'https:'].includes(url.protocol) || url.username || url.password) throw new Error(`${field} must be a safe HTTP(S) link.`);
            result[field] = url.toString();
        }
    }
    if (value.note !== undefined) result.note = text(value.note, 'Provider note');
    return result;
}

function notify(id, ownerExtension, operation) {
    // Data helpers are also consumed in Node; the application's emitter uses browser storage.
    if (typeof window === 'undefined') return;
    void eventSource.emit(event_types.CUSTOM_PROVIDER_REGISTRY_CHANGED, { id, ownerExtension, operation });
}

/**
 * Register declarative defaults. Duplicate IDs and suspended owners throw.
 * @param {string} ownerExtension Exact loader ID, including third-party/ where applicable
 * @param {string} localProviderId Stable lowercase slug, at most 64 characters
 * @param {CustomProviderDefinition} definition Complete descriptor; omitted connection fields are neutral
 * @returns {Registration} Owner handle; invalid updates are atomic and unregister is idempotent
 */
export function registerCustomProvider(ownerExtension, localProviderId, definition) {
    if (typeof ownerExtension !== 'string' || !/^(?:third-party\/)?[A-Za-z0-9][A-Za-z0-9._-]*$/.test(ownerExtension)) throw new Error('Use the exact extension loader ID.');
    if (typeof localProviderId !== 'string' || !/^[a-z0-9][a-z0-9._-]{0,63}$/.test(localProviderId)) throw new Error('Use a stable lowercase provider slug.');
    if (suspendedOwners.has(ownerExtension)) throw new Error('This extension lifetime is suspended.');
    const id = `${ownerExtension}:${localProviderId}`;
    if (registrations.has(id)) throw new Error(`Provider ${id} is already registered.`);
    const entry = { id, ownerExtension, definition: normalizeDefinition(definition) };
    registrations.set(id, entry);
    notify(id, ownerExtension, 'register');
    return Object.freeze({
        id,
        update(next) {
            if (registrations.get(id) !== entry) throw new Error('This registration handle is no longer current.');
            const normalized = normalizeDefinition(next);
            entry.definition = normalized;
            notify(id, ownerExtension, 'update');
        },
        unregister() {
            if (registrations.get(id) !== entry) return;
            registrations.delete(id);
            notify(id, ownerExtension, 'unregister');
        },
    });
}

/**
 * Return a detached definition; mutation cannot change the registration.
 * @param {string} id Opaque full provider ID
 * @returns {CustomProviderDefinition|undefined}
 */
export function getCustomProvider(id) { return registrations.has(id) ? copy(registrations.get(id).definition) : undefined; }
/**
 * List detached registrations in deterministic display order.
 * @returns {{id: string, ownerExtension: string, definition: CustomProviderDefinition}[]}
 */
export function listCustomProviders() {
    return [...registrations.values()].map(copy).sort((a, b) => a.definition.label.localeCompare(b.definition.label) || a.id.localeCompare(b.id));
}
/** Suspend before loader hooks so late activation cannot resurrect registrations. */
export function suspendCustomProviderOwner(owner) {
    suspendedOwners.add(owner);
    for (const [id, entry] of registrations) {
        if (entry.ownerExtension !== owner) continue;
        registrations.delete(id);
        notify(id, owner, 'unregister');
    }
}
/** Start a new activation lifetime, including the loader's pre-flag enable hook. */
export function resumeCustomProviderOwner(owner) { suspendedOwners.delete(owner); }

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
    return { version: 1, settings, provider: copy(value.provider), models, auth, credential };
}

/** Snapshot current execution fields, never a stale draft. */
export function captureCustomConnection(settings, legacySecretId = null) {
    const state = settings.custom_provider_state;
    if (state && state.version !== 1) throw new Error('Unsupported Custom provider state version.');
    const active = state?.active ?? { provider: null, models: { mode: 'discover', suggestions: [] }, auth: { mode: 'bearer', required: false }, credential: { mode: 'legacy-custom', id: legacySecretId } };
    return validateCustomSnapshot({ version: 1, settings: captureCustomFields(settings, true), ...copy(active) });
}

/** Ensure opted-in state. Untouched legacy settings are not migrated on load. */
export function ensureCustomProviderState(settings) {
    if (!settings.custom_provider_state) settings.custom_provider_state = { version: 1, active: null, manual: null, drafts: {} };
    if (settings.custom_provider_state.version !== 1) throw new Error('Unsupported Custom provider state version.');
    return settings.custom_provider_state;
}

function saveInactive(state, snapshot) {
    if (snapshot.provider) state.drafts[snapshot.provider.id] = snapshot;
    else state.manual = snapshot;
}

/** Restore one whole tuple. Registration is presentation, never restoration input. */
export function applyCustomSnapshot(settings, value, legacySecretId = null) {
    const snapshot = validateCustomSnapshot(value);
    const previous = captureCustomConnection(settings, legacySecretId);
    const state = ensureCustomProviderState(settings);
    saveInactive(state, previous);
    const metadata = { provider: snapshot.provider, models: snapshot.models, auth: snapshot.auth, credential: snapshot.credential };
    Object.assign(settings, snapshot.settings);
    state.active = metadata;
    if (metadata.provider) delete state.drafts[metadata.provider.id];
    else state.manual = null;
}

/** Select a saved slot or first-use descriptor, without inheriting the prior tuple. */
export function switchCustomProvider(settings, id, legacySecretId = null) {
    if (settings.custom_provider_state?.active?.provider?.id === id || id === null && settings.custom_provider_state?.active?.provider === null) return;
    const state = settings.custom_provider_state;
    if (state && state.version !== 1) throw new Error('Unsupported Custom provider state version.');
    let snapshot = id === null ? state?.manual : state?.drafts?.[id];
    if (!snapshot) {
        const definition = getCustomProvider(id);
        if (!definition) throw new Error('This provider has neither a registration nor a saved connection.');
        snapshot = { version: 1, settings: definition.defaults, provider: { id, label: definition.label }, models: definition.models, auth: definition.auth, credential: { mode: definition.auth.mode === 'bearer' && definition.auth.required ? 'unbound' : 'none' } };
    }
    applyCustomSnapshot(settings, snapshot, legacySecretId);
}

/** Build the backend envelope; exact endpoint approval is checked on every request. */
export function getCustomAuth(settings) {
    const state = settings.custom_provider_state;
    if (!state) return undefined;
    if (state.version !== 1) throw new Error('Unsupported Custom provider state version.');
    if (!state.active) return undefined;
    const snapshot = captureCustomConnection(settings);
    const credential = snapshot.credential;
    if (credential.mode === 'unbound' || snapshot.auth.mode === 'bearer' && snapshot.auth.required && credential.mode === 'none') throw new Error('Choose a stored key for this connection before connecting.');
    if (credential.mode === 'reference' && credential.endpoint !== normalizeCustomEndpoint(snapshot.settings.custom_url)) throw new Error('The API root changed. Select a key again to approve the new root.');
    return { version: 1, auth: snapshot.auth, credential };
}

/** Resolve the v1 profile group, retaining an explicit exclusion as a distinct format. */
export function getProfileCustomConnection(profile) {
    if (!Object.hasOwn(profile, 'custom-connection')) return undefined;
    const value = profile['custom-connection'];
    if (value?.version !== 1) throw new Error('Unsupported Custom profile version.');
    if (value.excluded === true) {
        object(value, 'Excluded Custom connection', ['version', 'excluded']);
        return null;
    }
    if (profile.api !== 'custom') throw new Error('A Custom snapshot requires profile.api custom.');
    return validateCustomSnapshot(value);
}

/** Resolve old Custom profiles from their own preset and remembered Manual baseline in mixed mode. */
export function resolveLegacyCustomConnection(settings, profile, preset = {}, legacySecretId = null) {
    const state = settings.custom_provider_state;
    if (!state?.active) return undefined;
    const baseline = state.active.provider ? state.manual : captureCustomConnection(settings, legacySecretId);
    if (!baseline) throw new Error('The remembered Manual connection is unavailable.');
    const snapshot = validateCustomSnapshot(baseline);
    const excluded = profile.exclude ?? [];
    for (const field of CUSTOM_CONNECTION_FIELDS) {
        if (preset[field] !== undefined && !excluded.includes('preset')) snapshot.settings[field] = text(preset[field], field);
    }
    for (const [command, field] of [['api-url', 'custom_url'], ['model', 'custom_model'], ['prompt-post-processing', 'custom_prompt_post_processing']]) {
        if (!excluded.includes(command) && profile[command] !== undefined) snapshot.settings[field] = text(profile[command], command);
    }
    if (!excluded.includes('secret-id') && profile['secret-id']) snapshot.credential = { mode: 'legacy-custom', id: profile['secret-id'] };
    else if (snapshot.settings.custom_url !== baseline.settings.custom_url && snapshot.credential.mode !== 'none') snapshot.credential = { mode: 'unbound' };
    return validateCustomSnapshot(snapshot);
}

/** Overlay an isolated request before generation parameter construction. */
export function settingsForCustomRequest(settings, snapshot, overrides = {}) {
    const value = validateCustomSnapshot(snapshot);
    if (overrides.chat_completion_source !== undefined && overrides.chat_completion_source !== 'custom') throw new Error('A Custom profile cannot override its source. Use the target profile instead.');
    const fields = { ...value.settings };
    for (const field of CUSTOM_CONNECTION_FIELDS) if (overrides[field] !== undefined) fields[field] = text(overrides[field], field);
    if (overrides.model !== undefined) fields.custom_model = text(overrides.model, 'model');
    const credential = overrides.custom_auth?.credential ?? value.credential;
    if (fields.custom_url !== value.settings.custom_url && !overrides.custom_auth) throw new Error('An API root override requires an explicit credential binding.');
    const result = { ...settings, ...fields, chat_completion_source: 'custom', custom_provider_state: { version: 1, active: { provider: value.provider, models: value.models, auth: overrides.custom_auth?.auth ?? value.auth, credential: copy(credential) }, manual: null, drafts: {} } };
    getCustomAuth(result);
    return result;
}
