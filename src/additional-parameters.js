import yaml from 'yaml';
import { CHAT_COMPLETION_SOURCES } from './constants.js';

/**
 * Additional parameters of a Chat Completion connection: a power-user escape hatch.
 * The user's values are applied last and as they are. Nothing is validated against the provider's API:
 * if a value is wrong, the provider answers with an error.
 * @typedef {object} AdditionalParameters
 * @property {string} [include_body] YAML mapping (or list of mappings) merged deeply into the request body
 * @property {string} [exclude_body] YAML list of body fields to remove; a dotted path reaches into nested objects
 * @property {string} [include_headers] YAML mapping of request headers to add
 */

/** Headers that carry credentials or belong to the transport. A native source sets these itself. */
const RESERVED_HEADERS = /^(authorization|proxy-authorization|x-api-key|api-key|x-goog-api-key|cookie|set-cookie|host|content-length)$/i;

/** Keys that must never be written through a user-supplied path. */
const UNSAFE_KEYS = new Set(['__proto__', 'constructor', 'prototype']);

const isPlainObject = value => Boolean(value) && typeof value === 'object' && !Array.isArray(value);

/**
 * Parses YAML text, returning undefined for empty or invalid input.
 * @param {string} text YAML text
 * @param {string} field Name used in the warning
 * @returns {any} Parsed value
 */
function parseYaml(text, field) {
    if (typeof text !== 'string' || !text.trim()) {
        return undefined;
    }

    try {
        return yaml.parse(text);
    } catch (error) {
        console.warn(`Additional parameters: ${field} is not valid YAML and was ignored.`, error.message);
        return undefined;
    }
}

/**
 * Merges source into target. Objects are merged key by key, everything else (arrays included) replaces the target value.
 * @param {object} target Object to change
 * @param {object} source Values to merge in
 */
function mergeDeep(target, source) {
    for (const [key, value] of Object.entries(source)) {
        if (UNSAFE_KEYS.has(key)) {
            continue;
        }
        if (isPlainObject(value) && isPlainObject(target[key])) {
            mergeDeep(target[key], value);
        } else {
            target[key] = isPlainObject(value) || Array.isArray(value) ? structuredClone(value) : value;
        }
    }
}

/**
 * Removes a field by name or by dotted path. A key that itself contains a dot wins over the path reading.
 * @param {object} target Object to change
 * @param {string} path Field name or dotted path, e.g. `generationConfig.thinkingConfig`
 */
function removePath(target, path) {
    if (Object.hasOwn(target, path)) {
        delete target[path];
        return;
    }

    const segments = path.split('.');
    const last = segments.pop();
    let current = target;
    for (const segment of segments) {
        if (UNSAFE_KEYS.has(segment) || (!isPlainObject(current[segment]) && !Array.isArray(current[segment]))) {
            return;
        }
        current = current[segment];
    }
    if (!UNSAFE_KEYS.has(last)) {
        delete current[last];
    }
}

/**
 * Gets the additional parameters that apply to a generation request.
 * The Custom source keeps its own three settings; every other source sends `additional_parameters`.
 * @param {object} requestBody Body of the request the client sent to the server
 * @returns {AdditionalParameters} Additional parameters, possibly empty
 */
export function getAdditionalParameters(requestBody) {
    if (requestBody?.chat_completion_source === CHAT_COMPLETION_SOURCES.CUSTOM) {
        return {
            include_body: requestBody.custom_include_body,
            exclude_body: requestBody.custom_exclude_body,
            include_headers: requestBody.custom_include_headers,
        };
    }

    return isPlainObject(requestBody?.additional_parameters) ? requestBody.additional_parameters : {};
}

/**
 * Applies the user's body parameters to an outgoing request body: first the additions, then the removals.
 * @template {object} T
 * @param {T} body Outgoing request body. Changed in place.
 * @param {AdditionalParameters} parameters Additional parameters
 * @returns {T} The same body, for use inside an expression
 */
export function applyAdditionalBodyParameters(body, parameters) {
    if (!isPlainObject(body) || !isPlainObject(parameters)) {
        return body;
    }

    const included = parseYaml(parameters.include_body, 'include body');
    const additions = (Array.isArray(included) ? included : [included]).filter(isPlainObject);
    for (const addition of additions) {
        mergeDeep(body, addition);
    }

    const excluded = parseYaml(parameters.exclude_body, 'exclude body');
    const removals = Array.isArray(excluded) ? excluded : isPlainObject(excluded) ? Object.keys(excluded) : typeof excluded === 'string' ? [excluded] : [];
    for (const path of removals) {
        if (typeof path === 'string' && path) {
            removePath(body, path);
        }
    }

    if (additions.length || removals.length) {
        const added = additions.flatMap(item => Object.keys(item));
        console.info(`Additional parameters applied. Added or overwritten: ${added.join(', ') || 'none'}. Removed: ${removals.join(', ') || 'none'}.`);
    }

    return body;
}

/**
 * Gets the user's additional request headers for a native source.
 * Credential and transport headers are left out: the source sets those from the stored key.
 * @param {AdditionalParameters} parameters Additional parameters
 * @returns {Record<string, string>} Headers to add to the request
 */
export function getAdditionalHeaders(parameters) {
    const parsed = parseYaml(parameters?.include_headers, 'include headers');
    const mappings = (Array.isArray(parsed) ? parsed : [parsed]).filter(isPlainObject);

    /** @type {Record<string, string>} */
    const headers = {};
    for (const mapping of mappings) {
        for (const [name, value] of Object.entries(mapping)) {
            if (RESERVED_HEADERS.test(name)) {
                console.warn(`Additional parameters: the header "${name}" is set by SillyTavern and was ignored.`);
                continue;
            }
            if (value === null || value === undefined || typeof value === 'object') {
                continue;
            }
            headers[name] = String(value);
        }
    }

    return headers;
}
