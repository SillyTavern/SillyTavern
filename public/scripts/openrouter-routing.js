import {
    chat_metadata,
    getCurrentChatId,
} from '../script.js';
import { getStringHash } from './utils.js';

/**
 * How the sticky routing key is sent to OpenRouter.
 * OpenRouter uses session_id directly as the routing key, and only falls back
 * to prompt_cache_key when session_id and the x-session-id header are absent.
 */
export const openrouter_routing_key_modes = {
    OFF: 'off',
    SESSION_ID: 'session_id',
    PROMPT_CACHE_KEY: 'prompt_cache_key',
};

/** Where the value of the routing key comes from. */
export const openrouter_routing_key_sources = {
    CHAT_ID: 'chat_id',
    CHAT_NAME: 'chat_name',
    CHAT_NAME_HASH: 'chat_name_hash',
};

/** OpenRouter's documented maximum length for session_id. */
const KEY_MAX_LENGTH = 256;

/**
 * Warnings already emitted, keyed by chat and reason, so a misconfiguration is
 * visible once instead of on every swipe.
 * @type {Set<string>}
 */
const warnedKeys = new Set();

/**
 * Resolve the routing key for the current chat.
 * @param {string} source One of openrouter_routing_key_sources.
 * @returns {{key: string, reason: string}} Key is empty when unavailable, in which case reason explains why.
 */
function resolveRoutingKey(source) {
    let raw = '';
    let reason = '';

    switch (source) {
        case openrouter_routing_key_sources.CHAT_ID:
            raw = chat_metadata?.integrity ?? '';
            reason = 'the chat has no integrity UUID yet';
            break;
        case openrouter_routing_key_sources.CHAT_NAME:
            raw = getCurrentChatId() ?? '';
            reason = 'there is no current chat';
            break;
        case openrouter_routing_key_sources.CHAT_NAME_HASH: {
            const chatId = getCurrentChatId() ?? '';
            raw = chatId ? getStringHash(chatId).toString(16) : '';
            reason = 'there is no current chat to hash';
            break;
        }
        default:
            reason = `unknown key source "${source}"`;
            break;
    }

    const key = String(raw ?? '').trim().slice(0, KEY_MAX_LENGTH);
    return { key, reason: key ? '' : reason };
}

/**
 * Warn about a missing routing key at most once per chat and reason.
 * @param {string} reason Why no key could be resolved.
 */
function warnOnce(reason) {
    const token = `${getCurrentChatId() ?? ''}::${reason}`;

    if (warnedKeys.has(token)) {
        return;
    }

    warnedKeys.add(token);
    console.warn(`OpenRouter routing key not sent: ${reason}.`);
}

/**
 * Add the OpenRouter sticky routing key to a request body, if one is configured
 * and available. Mutates the target in place.
 *
 * Pinning a conversation to one upstream provider is what makes prompt caching
 * pay off; without a key, OpenRouter derives one by hashing the first messages,
 * which changes whenever the top of the prompt does.
 * @param {object} target Request body to modify.
 * @param {string} mode One of openrouter_routing_key_modes.
 * @param {string} source One of openrouter_routing_key_sources.
 */
export function applyOpenRouterRoutingKey(target, mode, source) {
    if (!target || !mode || mode === openrouter_routing_key_modes.OFF) {
        return;
    }

    if (mode !== openrouter_routing_key_modes.SESSION_ID && mode !== openrouter_routing_key_modes.PROMPT_CACHE_KEY) {
        console.warn(`OpenRouter routing key not sent: unknown mode "${mode}".`);
        return;
    }

    const { key, reason } = resolveRoutingKey(source);

    if (!key) {
        warnOnce(reason);
        return;
    }

    target[mode] = key;
}
