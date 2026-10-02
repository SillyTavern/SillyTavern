import yaml from 'yaml';
import { readSecret, SECRET_KEYS } from './endpoints/secrets.js';
import { CUSTOM_CREDENTIAL_KEYS, captureCustomFields, normalizeCustomEndpoint, validateCustomSnapshot } from '../public/scripts/custom-providers.js';

/** A local configuration error: never retry using an ambient credential. */
export class CustomAuthError extends Error {
    constructor(message) { super(message); this.code = 'CUSTOM_AUTH'; }
}

/** Validate YAML before the existing merge/exclude helpers (which tolerate parse errors). */
function validateParameters(body, managed) {
    for (const field of ['custom_include_headers', 'custom_include_body', 'custom_exclude_body']) {
        if (body[field] === undefined || body[field] === '') continue;
        if (typeof body[field] !== 'string') throw new CustomAuthError(`${field} must be YAML text.`);
        let value;
        try { value = yaml.parse(body[field]); } catch { throw new CustomAuthError(`Invalid YAML in ${field}.`); }
        if (field === 'custom_exclude_body') {
            if (value === null || !['object', 'string'].includes(typeof value)) throw new CustomAuthError(`${field} must contain field names.`);
            continue;
        }
        const mappings = Array.isArray(value) ? value : [value];
        if (mappings.some(item => !item || typeof item !== 'object' || Array.isArray(item))) throw new CustomAuthError(`${field} must be a YAML mapping or an array of mappings.`);
        const keys = mappings.flatMap(item => Object.keys(item));
        if (managed && field === 'custom_include_headers' && keys.some(key => /^(authorization|proxy-authorization|x-api-key|api-key|cookie|set-cookie)$/i.test(key))) {
            throw new CustomAuthError('Credential headers are reserved for the core key picker.');
        }
        if (field === 'custom_include_body' && keys.some(key => ['custom_auth', 'custom_provider_state', 'custom-connection', 'credential', 'secret_id'].includes(key))) {
            throw new CustomAuthError('Local connection metadata cannot be included in the upstream body.');
        }
    }
}

/** Resolve a managed Custom request from this account's exact vault entry. No envelope means legacy behavior. */
export function resolveCustomAuth(directories, body, endpoint = body.custom_url) {
    if (body.custom_auth === undefined) return undefined;
    const envelope = body.custom_auth;
    try {
        if (!envelope || envelope.version !== 1 || Object.keys(envelope).some(key => !['version', 'auth', 'credential'].includes(key))) throw new CustomAuthError('Unsupported Custom authentication envelope.');
        const snapshot = validateCustomSnapshot({ version: 1, provider: envelope.credential?.mode === 'legacy-custom' ? null : { id: 'managed', label: 'Managed' }, settings: captureCustomFields({ custom_url: endpoint }), models: { mode: 'manual' }, auth: envelope.auth, credential: envelope.credential });
        const { credential, auth } = snapshot;
        const root = normalizeCustomEndpoint(endpoint);
        const legacy = credential.mode === 'legacy-custom';
        validateParameters(body, !legacy);
        let key = '';
        if (credential.mode === 'unbound' || auth.mode === 'bearer' && auth.required && credential.mode === 'none') throw new CustomAuthError('Choose a stored key before making this request.');
        if (credential.mode === 'reference') {
            if (!CUSTOM_CREDENTIAL_KEYS.includes(credential.key) || credential.endpoint !== root) throw new CustomAuthError('The key is not approved for this exact API root. Select it again.');
            if (auth.mode !== 'bearer') throw new CustomAuthError('This connection does not accept a bearer credential.');
            key = readSecret(directories, credential.key, credential.id);
            if (!key) throw new CustomAuthError('The selected key no longer exists. Choose a stored key.');
        } else if (legacy && credential.id !== null) {
            key = readSecret(directories, SECRET_KEYS.CUSTOM, credential.id);
            if (!key) throw new CustomAuthError('The captured Custom key no longer exists.');
        }
        return { key, endpoint: root, headers: key ? { Authorization: `Bearer ${key}` } : {}, redirect: key ? 'error' : 'follow' };
    } catch (error) {
        if (error instanceof CustomAuthError) throw error;
        throw new CustomAuthError(error.message);
    }
}
