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
import { CUSTOM_CONNECTION_FIELDS, CUSTOM_CREDENTIAL_KEYS, captureCustomFields, copy, normalizeAuth, normalizeCustomEndpoint, normalizeModels, object, text, validateCustomSnapshot } from './custom-connection.js';

export { CUSTOM_CONNECTION_FIELDS, CUSTOM_CREDENTIAL_KEYS, captureCustomFields, normalizeCustomEndpoint, validateCustomSnapshot };

export const CUSTOM_PROVIDER_API_VERSION = 1;

/**
 * The connection values a provider starts with. They fill the Custom (OpenAI-compatible) connection
 * when the user selects the provider, and "Reset provider defaults" restores them.
 * @typedef {object} CustomProviderDefaults
 * @property {string} custom_url The API root. HTTP or HTTPS, without `/chat/completions`, without credentials, a query
 * string or a fragment. Example: `https://api.example.com/v1`. Required.
 * @property {string} [custom_model] Model ID that is preselected. Leave it out to let the user choose.
 * @property {string} [custom_include_headers] Extra request headers, as YAML (`Name: value` lines). Not for keys:
 * `Authorization`, `x-api-key`, `api-key` and cookie headers are rejected, the key always comes from the user's key picker.
 * @property {string} [custom_include_body] Body fields the server adds to every request, or overwrites, as YAML.
 * Example: `max_completion_tokens: 4096`. Applied after SillyTavern built the request, so it wins over a setting.
 * @property {string} [custom_exclude_body] Body fields the server removes from every request, as a YAML list.
 * Example: `- max_tokens`. Use it for every parameter the service rejects.
 * @property {''|'merge'|'merge_tools'|'semi'|'semi_tools'|'strict'|'strict_tools'|'single'} [custom_prompt_post_processing]
 * How the prompt is reshaped before sending. Leave it out unless the service rejects SillyTavern's default message layout.
 */

/**
 * One model offered to the user before the first successful connection.
 * @typedef {object} CustomProviderModelSuggestion
 * @property {string} id Model ID as the service expects it
 * @property {string} [label] Name shown in the model dropdown. Defaults to the ID.
 */

/**
 * How the model list of a provider is obtained.
 * @typedef {object} ModelSetup
 * @property {'discover'|'manual'} mode `discover`: after connecting, the list is read from `<custom_url>/models`.
 * `manual`: the service has no model list; the user picks a suggestion or types an ID under "Advanced".
 * @property {CustomProviderModelSuggestion[]} [suggestions] Models offered before the first connection, and the whole
 * list in `manual` mode.
 */

/**
 * How the service authenticates. The key itself is never part of a definition: the user picks or enters it.
 * - `{ mode: 'bearer', required: true }`: a key is needed and is sent as `Authorization: Bearer <key>`.
 * - `{ mode: 'bearer', required: false }`: a key is optional; "No key" is offered.
 * - `{ mode: 'header', name: 'x-api-key', required: true }`: the key is sent as the bare value of the named header
 *   instead of `Authorization: Bearer`. Use it for services that expect `x-api-key`, `api-key` or similar.
 *   `required: false` makes the key optional.
 * - `{ mode: 'none' }`: the service takes no key at all, for example a local server. The key input is hidden.
 * @typedef {{mode: 'none'}|{mode: 'bearer', required: boolean}|{mode: 'header', name: string, required: boolean}} AuthPolicy
 */

/**
 * Name of a Chat Completion control a provider may show or hide. The full list is `CUSTOM_PROVIDER_CONTROLS`,
 * also available as `SillyTavern.getContext().customProviders.controls`.
 * @typedef {'temperature'|'top_p'|'top_k'|'top_a'|'min_p'|'repetition_penalty'|'frequency_penalty'|'presence_penalty'|'seed'|'n'|'logit_bias'|'reasoning_effort'|'verbosity'|'show_thoughts'|'function_calling'|'web_search'|'inline_media'|'inline_image_quality'|'request_images'|'system_prompt'} CustomProviderControl
 */

/**
 * Which Chat Completion controls are visible while the provider is the selected connection.
 * Controls that are not named keep the visibility of the Custom source.
 * @typedef {object} CustomProviderControls
 * @property {CustomProviderControl[]} [hide] Controls to hide. Hiding does not stop SillyTavern from sending the value:
 * also list the field in `defaults.custom_exclude_body`.
 * @property {CustomProviderControl[]} [show] Controls to show although the Custom source hides them. Showing does not make
 * SillyTavern send the value: add it to the request yourself in a `CHAT_COMPLETION_SETTINGS_READY` listener.
 */

/**
 * Second argument of the `CHAT_COMPLETION_SETTINGS_READY` event.
 * @typedef {object} ChatCompletionRequestContext
 * @property {string|null} customProviderId Full ID of the Custom provider this request was built for, fixed when
 * the request started. `null` for the Manual connection and for every other source. Compare it with your
 * registration's `id` before changing the request.
 */

/**
 * Everything that describes a Custom provider. Pass it to `customProviders.register()`.
 * A definition is data only: registering never selects the provider, connects, stores a key or sends a request.
 * Unknown fields are rejected with an error that names the field.
 * @typedef {object} CustomProviderDefinition
 * @property {string} label Name shown in the Chat Completion source list, in the "Custom Providers" group. Plain text.
 * @property {CustomProviderDefaults} defaults Connection values the provider starts with. Only `custom_url` is required.
 * @property {ModelSetup} models How the model list is obtained, and optional suggestions.
 * @property {AuthPolicy} auth Whether the service needs a key.
 * @property {CustomProviderControls} [controls] Chat Completion controls to show or hide while the provider is selected.
 * @property {string} [documentationUrl] HTTP(S) link shown as "Documentation" in the provider card.
 * @property {string} [supportUrl] HTTP(S) link shown as "Support" in the provider card.
 * @property {string} [note] One short hint shown in the provider card, for example where to get a key.
 */

/**
 * Handle returned by `customProviders.register()`. Keep it to update or remove the provider.
 * @typedef {object} Registration
 * @property {string} id Full provider ID, `<extension ID>:<provider ID>`. Compare it with `customProviders.active()`.
 * @property {(definition: CustomProviderDefinition) => void} update Replaces the definition. An invalid one throws and
 * leaves the current definition in place. Connections the user already saved keep their own values.
 * @property {() => void} unregister Removes the provider from the list. Safe to call more than once. Saved connections keep working.
 */

/**
 * The Custom provider API, `SillyTavern.getContext().customProviders`.
 * @typedef {object} CustomProvidersApi
 * @property {1} apiVersion Version of this API. Check it before registering.
 * @property {(providerId: string, definition: CustomProviderDefinition) => Registration} register Adds a provider for the
 * calling extension. `providerId` is a short stable slug (lowercase letters, digits, dashes, at most 64 characters);
 * saved connections refer to it, so do not change it after release. Call it from the extension's `activate` and
 * `enable` hooks and call `unregister()` on the handle in `disable`, `delete` and `clean`. Throws for an invalid
 * definition, a duplicate ID, or when the call does not come from an extension.
 * @property {(id: string) => CustomProviderDefinition|undefined} get Returns a copy of one registered definition by full ID.
 * @property {() => {id: string, ownerExtension: string, definition: CustomProviderDefinition}[]} list Returns copies of
 * all registered providers, sorted by label.
 * @property {(id: string|null) => Promise<void>} select Selects a provider by full ID, or the Manual connection with
 * `null`. Only works while Chat Completion with the Custom source is selected. Does not connect.
 * @property {() => string|null} active Returns the full ID of the provider that is the selected connection, or `null`
 * for Manual and for every other source. Use it for the interface, for example to show your own inputs.
 * Do not use it to decide whether a request is yours: `CHAT_COMPLETION_SETTINGS_READY` passes a second argument,
 * `{ customProviderId }`, with the provider the request was built for. The selection can change while a request is prepared.
 * @property {readonly CustomProviderControl[]} controls The control names accepted in `controls.show` and `controls.hide`.
 */

/** @typedef {{mode: 'unbound'}|{mode: 'none'}|{mode: 'reference', key: string, id: string, endpoint: string}|{mode: 'legacy-custom', id: string|null}} CredentialBinding */
/** @typedef {{provider: {id: string, label: string}|null, models: ModelSetup, auth: AuthPolicy, credential: CredentialBinding}} ConnectionMetadata */
/** @typedef {ConnectionMetadata & {version: 1, settings: Record<string, string>}} CustomConnectionSnapshot */
/** @typedef {{version: 1, active: ConnectionMetadata|null, manual: CustomConnectionSnapshot|null, drafts: Record<string, CustomConnectionSnapshot>}} CustomProviderState */

/**
 * Chat Completion controls a provider may show or hide while it is the selected connection.
 * Hiding a control does not stop its value from being sent: also remove the field with custom_exclude_body.
 * Showing a control does not make SillyTavern send its value: the extension adds it to the request itself.
 */
export const CUSTOM_PROVIDER_CONTROLS = /** @type {readonly CustomProviderControl[]} */ (Object.freeze([
    'temperature', 'top_p', 'top_k', 'top_a', 'min_p', 'repetition_penalty', 'frequency_penalty', 'presence_penalty',
    'seed', 'n', 'logit_bias', 'reasoning_effort', 'verbosity', 'show_thoughts', 'function_calling', 'web_search',
    'inline_media', 'inline_image_quality', 'request_images', 'system_prompt',
]));

const registrations = new Map();
const suspendedOwners = new Set();

function normalizeDefinition(value) {
    object(value, 'Provider definition', ['label', 'defaults', 'models', 'auth', 'controls', 'documentationUrl', 'supportUrl', 'note']);
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
    if (value.controls !== undefined) {
        object(value.controls, 'Provider controls', ['show', 'hide']);
        result.controls = {};
        for (const list of ['show', 'hide']) {
            const names = value.controls[list] ?? [];
            if (!Array.isArray(names) || names.some(name => !CUSTOM_PROVIDER_CONTROLS.includes(name))) throw new Error(`controls.${list} must list known control names: ${CUSTOM_PROVIDER_CONTROLS.join(', ')}.`);
            result.controls[list] = [...new Set(names)];
        }
        if (result.controls.show.some(name => result.controls.hide.includes(name))) throw new Error('A control cannot be both shown and hidden.');
    }
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
 * @param {string} localProviderId Stable slug: lowercase letters, digits and dashes, at most 64 characters
 * @param {CustomProviderDefinition} definition Complete descriptor; omitted connection fields are neutral
 * @returns {Registration} Owner handle; invalid updates are atomic and unregister is idempotent
 */
export function registerCustomProvider(ownerExtension, localProviderId, definition) {
    if (typeof ownerExtension !== 'string' || !/^(?:third-party\/)?[A-Za-z0-9][A-Za-z0-9._-]*$/.test(ownerExtension)) throw new Error('Use the exact extension loader ID.');
    if (typeof localProviderId !== 'string' || !/^[a-z0-9][a-z0-9-]{0,63}$/.test(localProviderId)) throw new Error('Use a stable provider ID: lowercase letters, digits and dashes, at most 64 characters.');
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


/** Reconcile a deliberate policy/root edit; persisted snapshots are validated, never silently repaired. */
export function reconcileCustomCredential(auth, credential, endpoint) {
    const policy = normalizeAuth(auth);
    if (policy.mode === 'none') return { mode: 'none' };
    if (credential.mode === 'reference') {
        try { if (credential.endpoint === normalizeCustomEndpoint(endpoint)) return copy(credential); } catch { /* An incomplete edited URL also loses its approval. */ }
        return { mode: 'unbound' };
    }
    if (credential.mode === 'none' && policy.required) return { mode: 'unbound' };
    if (credential.mode === 'legacy-custom' && policy.required) return { mode: 'unbound' };
    return copy(credential);
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
        snapshot = { version: 1, settings: definition.defaults, provider: { id, label: definition.label }, models: definition.models, auth: definition.auth, credential: { mode: definition.auth.mode !== 'none' && definition.auth.required ? 'unbound' : 'none' } };
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
    if (credential.mode === 'unbound' || snapshot.auth.mode !== 'none' && snapshot.auth.required && credential.mode === 'none') throw new Error('Choose a stored key for this connection before connecting.');
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
    else if (snapshot.credential.mode === 'reference' || snapshot.credential.mode === 'legacy-custom' && snapshot.credential.id !== null) {
        let sameRoot = snapshot.settings.custom_url === baseline.settings.custom_url;
        try {
            sameRoot = normalizeCustomEndpoint(snapshot.settings.custom_url) === normalizeCustomEndpoint(baseline.settings.custom_url);
        } catch { /* An incomplete or invalid changed root cannot retain credential approval. */ }
        if (!sameRoot) snapshot.credential = { mode: 'unbound' };
    }
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
