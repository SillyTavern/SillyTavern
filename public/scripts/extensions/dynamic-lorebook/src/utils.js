/**
 * Dynamic Lorebook Manager — shared utilities
 */

/**
 * Generates a unique ID with an optional prefix.
 * @param {string} [prefix='id']
 * @returns {string}
 */
export function generateId(prefix = 'id') {
    return `${prefix}_${Date.now()}_${Math.random().toString(36).slice(2, 9)}`;
}

/**
 * Returns a debounced version of `fn`.
 * @param {Function} fn
 * @param {number} delay - ms
 * @returns {Function}
 */
export function debounce(fn, delay) {
    let timer = null;
    return function (...args) {
        clearTimeout(timer);
        timer = setTimeout(() => fn.apply(this, args), delay);
    };
}

/**
 * Deep-clones a value via structuredClone.
 * @param {any} obj
 * @returns {any}
 */
export function deepClone(obj) {
    return structuredClone(obj);
}

/**
 * Escapes HTML special characters to prevent XSS in innerHTML assignments.
 * @param {string} str
 * @returns {string}
 */
export function escapeHtml(str) {
    const div = document.createElement('div');
    div.appendChild(document.createTextNode(String(str)));
    return div.innerHTML;
}

/**
 * Truncates a string to `maxLen` characters, appending '…' if cut.
 * @param {string} str
 * @param {number} maxLen
 * @returns {string}
 */
export function truncate(str, maxLen) {
    if (!str || str.length <= maxLen) return str;
    return str.slice(0, maxLen - 1) + '…';
}

/**
 * Fast non-cryptographic hash — used for cache keys.
 * @param {string} str
 * @returns {string}
 */
export function simpleHash(str) {
    let hash = 0;
    for (let i = 0; i < str.length; i++) {
        const char = str.charCodeAt(i);
        hash = ((hash << 5) - hash) + char;
        hash = hash | 0; // convert to 32-bit int
    }
    return Math.abs(hash).toString(36);
}

/**
 * Clamps `value` between `min` and `max`.
 * @param {number} value
 * @param {number} min
 * @param {number} max
 * @returns {number}
 */
export function clamp(value, min, max) {
    return Math.min(Math.max(value, min), max);
}

/**
 * Formats a Unix timestamp as a relative human-readable string ("2 minutes ago").
 * @param {number} timestamp - ms since epoch
 * @returns {string}
 */
export function timeAgo(timestamp) {
    const seconds = Math.floor((Date.now() - timestamp) / 1000);
    if (seconds < 60) return 'just now';
    const minutes = Math.floor(seconds / 60);
    if (minutes < 60) return `${minutes} minute${minutes !== 1 ? 's' : ''} ago`;
    const hours = Math.floor(minutes / 60);
    if (hours < 24) return `${hours} hour${hours !== 1 ? 's' : ''} ago`;
    const days = Math.floor(hours / 24);
    return `${days} day${days !== 1 ? 's' : ''} ago`;
}
