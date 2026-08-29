/**
 * Pure utility functions with no dependency on SillyTavern application state, the DOM,
 * or third-party libraries. Everything in this module can be imported and unit tested
 * in a plain Node.js environment.
 *
 * These functions are re-exported from utils.js for backwards compatibility. Do not
 * add app-dependent code to this file; new DOM- or app-dependent helpers belong in utils.js.
 */
import { debounce_timeout } from './constants.js';

export const shiftUpByOne = (e, i, a) => a[i] = e + 1;

export const shiftDownByOne = (e, i, a) => a[i] = e - 1;

/**
 * Pagination status string template.
 * @type {string}
 */
export const PAGINATION_TEMPLATE = '<%= rangeStart %>-<%= rangeEnd %> .. <%= totalNumber %>';

/**
 * Checks if the current environment supports negative lookbehind in regular expressions.
 * @type {{ (): boolean; result?: boolean }} Defines the function as a memoized object with a cached result.
 * @returns {boolean} True if negative lookbehind is supported, false otherwise.
 */
export function canUseNegativeLookbehind() {
    /**
     * A reference to the function itself, typed as a callable object with a cache property.
     * @type {{ (): boolean; result?: boolean }}
     */
    const fn = canUseNegativeLookbehind;
    let result = fn.result;
    if (typeof result !== 'boolean') {
        try {
            new RegExp('(?<!_)');
            result = true;
        } catch (e) {
            result = false;
        }
        fn.result = result;
    }
    return result;
}

/**
 * Navigation options for pagination.
 * @enum {number}
 */
export const navigation_option = {
    none: -2000,
    previous: -1000,
};

/**
 * Determines if a value is an object.
 * @param {any} item The item to check.
 * @returns {boolean} True if the item is an object, false otherwise.
 */
export function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

/**
 * Merges properties of two objects. If the property is an object, it will be merged recursively.
 * @param {object} target The target object
 * @param {object} source The source object
 * @returns {object} Merged object
 */
export function deepMerge(target, source) {
    let output = Object.assign({}, target);
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target))
                    Object.assign(output, { [key]: source[key] });
                else
                    output[key] = deepMerge(target[key], source[key]);
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
}

/**
 * Ensures that the provided object is a plain object.
 * @param {object} obj Object to ensure is a plain object
 * @return {object} A plain object, or an empty object if the input is not an object.
 */
export function ensurePlainObject(obj) {
    if (typeof obj !== 'object' || obj === null || Array.isArray(obj)) {
        return {};
    }

    return obj;
}

/**
 * Escapes text for safe HTML rendering.
 * @param {string?} str
 * @returns {string}
 */
export function escapeHtml(str) {
    return String(str ?? '')
        .replace(/&/g, '&amp;')
        .replace(/</g, '&lt;')
        .replace(/>/g, '&gt;')
        .replace(/"/g, '&quot;')
        .replace(/'/g, '&#39;');
}

/**
 * Make string safe for use as a CSS selector.
 * @param {string} str String to sanitize
 * @param {string} replacement Replacement for invalid characters
 * @returns {string} Sanitized string
 */
export function sanitizeSelector(str, replacement = '_') {
    return String(str).replace(/[^a-z0-9_-]/ig, replacement);
}

export function isValidUrl(value) {
    try {
        new URL(value);
        return true;
    } catch (_) {
        return false;
    }
}

/**
 * Checks if a string is a valid UUID (version 1-5).
 * @param {string} value String to check
 * @returns {boolean} True if the string is a valid UUID, false otherwise.
 */
export function isUuid(value) {
    // Regular expression to match UUIDs
    const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
    return uuidRegex.test(value);
}

/**
 * Parses ranges like 10-20 or 10.
 * Range is inclusive. Start must be less than end.
 * Returns null if invalid.
 * @param {string} input The input string.
 * @param {number} min The minimum value.
 * @param {number} max The maximum value.
 * @returns {{ start: number, end: number }} The parsed range.
 */
export function stringToRange(input, min, max) {
    let start, end;

    if (typeof input !== 'string') {
        input = String(input);
    }

    if (input.includes('-')) {
        const parts = input.split('-');
        start = parts[0] ? parseInt(parts[0], 10) : NaN;
        end = parts[1] ? parseInt(parts[1], 10) : NaN;
    } else {
        start = end = parseInt(input, 10);
    }

    if (isNaN(start) || isNaN(end) || start > end || start < min || end > max) {
        return null;
    }

    return { start, end };
}

/**
 * Determines if a value is unique in an array.
 * @param {any} value Current value.
 * @param {number} index Current index.
 * @param {any} array The array being processed.
 * @returns {boolean} True if the value is unique, false otherwise.
 */
export function onlyUnique(value, index, array) {
    return array.indexOf(value) === index;
}

/**
 * Determines if a value is unique in an array of objects.
 * @param {any} value Current value.
 * @param {number} index Current index.
 * @param {any[]} array The array being processed.
 * @returns {boolean} True if the value is unique, false otherwise.
 */
export function onlyUniqueJson(value, index, array) {
    return array.map(v => JSON.stringify(v)).indexOf(JSON.stringify(value)) === index;
}

/**
 * Removes the first occurrence of a specified item from an array
 *
 * @param {*[]} array - The array from which to remove the item
 * @param {*} item - The item to remove from the array
 * @returns {boolean} - Returns true if the item was successfully removed, false otherwise.
 */
export function removeFromArray(array, item) {
    const index = array.indexOf(item);
    if (index === -1) return false;
    array.splice(index, 1);
    return true;
}

/**
 * Normalizes an array by removing duplicates, trimming strings, and filtering out empty values.
 * @param {any[]} arr - The array to normalize.
 * @returns {any[]} The normalized array.
 */
export function normalizeArray(arr) {
    return [...new Set((arr ?? []).map(s => typeof s === 'string' ? s.trim() : s).filter(Boolean))];
}

/**
 * Checks if a string only contains digits.
 * @param {string} str The string to check.
 * @returns {boolean} True if the string only contains digits, false otherwise.
 * @example
 * isDigitsOnly('123'); // true
 * isDigitsOnly('abc'); // false
 */
export function isDigitsOnly(str) {
    return /^\d+$/.test(str);
}

/**
 * Rearranges an array in a random order.
 * @param {any[]} array The array to shuffle.
 * @returns {any[]} The shuffled array.
 * @example
 * shuffle([1, 2, 3]); // [2, 3, 1]
 */
export function shuffle(array) {
    let currentIndex = array.length,
        randomIndex;

    while (currentIndex != 0) {
        randomIndex = Math.floor(Math.random() * currentIndex);
        currentIndex--;
        [array[currentIndex], array[randomIndex]] = [
            array[randomIndex],
            array[currentIndex],
        ];
    }
    return array;
}

/**
 * Fuzzily compares two files for equality. Only checks attributes, not contents.
 * @param {File} a First file
 * @param {File} b Second file
 * @returns {boolean} True if the files are probably the same, false otherwise.
 */
export function isSameFile(a, b) {
    return a.lastModified === b.lastModified && a.name === b.name && a.size === b.size && a.type === b.type;
}

/**
 * Calculates a hash code for a string.
 * cyrb53 (c) 2018 bryc ({@link https://github.com/bryc/code/blob/master/jshash/experimental/cyrb53.js|github.com/bryc})
 * License: Public domain (or MIT if needed). Attribution appreciated.
 * A fast and simple 53-bit string hash function with decent collision resistance.
 * Largely inspired by MurmurHash2/3, but with a focus on speed/simplicity.
 * @param {string} str The string to hash.
 * @param {number} [seed=0] The seed to use for the hash.
 * @returns {number} The hash code.
 */
export function getStringHash(str, seed = 0) {
    if (typeof str !== 'string') {
        return 0;
    }

    let h1 = 0xdeadbeef ^ seed,
        h2 = 0x41c6ce57 ^ seed;
    for (let i = 0, ch; i < str.length; i++) {
        ch = str.charCodeAt(i);
        h1 = Math.imul(h1 ^ ch, 2654435761);
        h2 = Math.imul(h2 ^ ch, 1597334677);
    }

    h1 = Math.imul(h1 ^ (h1 >>> 16), 2246822507) ^ Math.imul(h2 ^ (h2 >>> 13), 3266489909);
    h2 = Math.imul(h2 ^ (h2 >>> 16), 2246822507) ^ Math.imul(h1 ^ (h1 >>> 13), 3266489909);

    return 4294967296 * (2097151 & h2) + (h1 >>> 0);
}

/**
 * Map of debounced functions to their timers.
 * Weak map is used to avoid memory leaks.
 * @type {WeakMap<function, any>}
 */
const debounceMap = new WeakMap();

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds have elapsed since the last time the debounced function was invoked.
 * @param {function} func The function to debounce.
 * @param {debounce_timeout|number} [timeout=debounce_timeout.default] The timeout based on the common enum values, or in milliseconds.
 * @returns {function} The debounced function.
 */
export function debounce(func, timeout = debounce_timeout.standard) {
    let timer;
    let fn = (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
        debounceMap.set(func, timer);
        debounceMap.set(fn, timer);
    };

    return fn;
}

/**
 * Creates a debounced function that delays invoking func until after wait milliseconds have elapsed since the last time the debounced function was invoked.
 * @param {Function} func The function to debounce.
 * @param {Number} [timeout=300] The timeout in milliseconds.
 * @returns {Function} The debounced function.
 */
export function debounceAsync(func, timeout = debounce_timeout.standard) {
    let timer;
    /**@type {Promise}*/
    let debouncePromise;
    /**@type {Function}*/
    let debounceResolver;
    return (...args) => {
        clearTimeout(timer);
        if (!debouncePromise) {
            debouncePromise = new Promise(resolve => {
                debounceResolver = resolve;
            });
        }
        timer = setTimeout(() => {
            debounceResolver(func.apply(this, args));
            debouncePromise = null;
        }, timeout);
        return debouncePromise;
    };
}

/**
 * Cancels a scheduled debounced function.
 * Does nothing if the function is not debounced or not scheduled.
 * @param {function} func The function to cancel. Either the original or the debounced function.
 */
export function cancelDebounce(func) {
    if (debounceMap.has(func)) {
        clearTimeout(debounceMap.get(func));
        debounceMap.delete(func);
    }
}

/**
 * Creates a throttled function that only invokes func at most once per every limit milliseconds.
 * @param {function} func The function to throttle.
 * @param {number} [limit=300] The limit in milliseconds.
 * @returns {function} The throttled function.
 */
export function throttle(func, limit = 300) {
    let lastCall;
    return (...args) => {
        const now = Date.now();
        if (!lastCall || (now - lastCall) >= limit) {
            lastCall = now;
            func.apply(this, args);
        }
    };
}

/**
 * Creates a debounced throttle function that only invokes func at most once per every limit milliseconds.
 * @param {function} func The function to throttle.
 * @param {number} [limit=300] The limit in milliseconds.
 * @returns {function} The throttled function.
 */
export function debouncedThrottle(func, limit = 300) {
    let last, deferTimer;
    let db = debounce(func);

    return function () {
        let now = +new Date, args = arguments;
        if (!last || (last && now < last + limit)) {
            clearTimeout(deferTimer);
            db.apply(this, args);
            deferTimer = setTimeout(function () {
                last = now;
                func.apply(this, args);
            }, limit);
        } else {
            last = now;
            func.apply(this, args);
        }
    };
}

/**
 * Returns a name that is unique among the names that exist.
 * @param {string} baseName The name to check.
 * @param {{ (name: string): boolean; }} exists Function to check if name exists.
 * @param {Object} [options] The options.
 * @param {((baseName: string, i: number) => string)|null} [options.nameBuilder=null] Function to build the name.
 *        Starts with the index provided by `startIndex` (default is 0). If not provided, uses `baseName` for index 0 and "${baseName} (${i})" for higher indices.
 * @param {number} [options.maxTries=1000] The maximum number of tries to find a unique name. Default is 1000.
 * @param {number} [options.startIndex=0] The index to start with when building the name. Default is 0.
 * @returns {string|null} A unique name. Null if no unique name could be found in `maxTries`.
 */
export function getUniqueName(baseName, exists, { nameBuilder = null, maxTries = 1000, startIndex = 0 } = {}) {
    nameBuilder ??= (baseName, i) => i === 0 ? baseName : `${baseName} (${i})`;
    let i = startIndex;
    let name;
    while (i < maxTries + startIndex) {
        name = nameBuilder(baseName, i);
        if (!exists(name)) {
            return name;
        }
        i++;
    }
    return null;
}

/**
 * Returns a promise that resolves after the specified number of milliseconds.
 * @param {number} ms The number of milliseconds to wait.
 * @returns {Promise<void>} A promise that resolves after the specified number of milliseconds.
 */
export function delay(ms) {
    return new Promise((res) => setTimeout(res, ms));
}

/**
 * Checks if an array is a subset of another array.
 * @param {any[]} a Array A
 * @param {any[]} b Array B
 * @returns {boolean} True if B is a subset of A, false otherwise.
 */
export function isSubsetOf(a, b) {
    return (Array.isArray(a) && Array.isArray(b)) ? b.every(val => a.includes(val)) : false;
}

/**
 * Increments the trailing number in a string.
 * @param {string} str The string to process.
 * @returns {string} The string with the trailing number incremented by 1.
 * @example
 * incrementString('Hello, world! 1'); // 'Hello, world! 2'
 */
export function incrementString(str) {
    // Find the trailing number or it will match the empty string
    const count = str.match(/\d*$/);

    // Take the substring up until where the integer was matched
    // Concatenate it to the matched count incremented by 1
    return str.substring(0, count.index) + (Number(count[0]) + 1);
}

/**
 * Formats a string using the specified arguments.
 * @param {string} format The format string.
 * @returns {string} The formatted string.
 * @example
 * stringFormat('Hello, {0}!', 'world'); // 'Hello, world!'
 */
export function stringFormat(format) {
    const args = Array.prototype.slice.call(arguments, 1);
    return format.replace(/{(\d+)}/g, function (match, number) {
        return typeof args[number] != 'undefined'
            ? args[number]
            : match;
    });
}

/**
 * Trims a string to the end of a nearest sentence.
 * @param {string} input The string to trim.
 * @returns {string} The trimmed string.
 * @example
 * trimToEndSentence('Hello, world! I am from'); // 'Hello, world!'
 */
export function trimToEndSentence(input) {
    if (!input) {
        return '';
    }

    const isEmoji = x => /(\p{Emoji_Presentation}|\p{Extended_Pictographic})/gu.test(x);
    const punctuation = new Set(['.', '!', '?', '*', '"', ')', '}', '`', ']', '$', '。', '！', '？', '”', '）', '】', '’', '」', '_']); // extend this as you see fit
    let last = -1;

    const characters = Array.from(input);
    for (let i = characters.length - 1; i >= 0; i--) {
        const char = characters[i];
        const emoji = isEmoji(char);

        if (punctuation.has(char) || emoji) {
            if (!emoji && i > 0 && /[\s\n]/.test(characters[i - 1])) {
                last = i - 1;
            } else {
                last = i;
            }
            break;
        }
    }

    if (last === -1) {
        return input.trimEnd();
    }

    return characters.slice(0, last + 1).join('').trimEnd();
}

export function trimToStartSentence(input) {
    if (!input) {
        return '';
    }

    let p1 = input.indexOf('.');
    let p2 = input.indexOf('!');
    let p3 = input.indexOf('?');
    let p4 = input.indexOf('\n');
    let first = p1;
    let skip1 = false;
    if (p2 > 0 && p2 < first) { first = p2; }
    if (p3 > 0 && p3 < first) { first = p3; }
    if (p4 > 0 && p4 < first) { first = p4; skip1 = true; }
    if (first > 0) {
        if (skip1) {
            return input.substring(first + 1);
        } else {
            return input.substring(first + 2);
        }
    }
    return input;
}

/**
 * Format bytes as human-readable text.
 *
 * @param bytes Number of bytes.
 * @param si True to use metric (SI) units, aka powers of 1000. False to use
 *           binary (IEC), aka powers of 1024.
 * @param dp Number of decimal places to display.
 *
 * @return Formatted string.
 */
export function humanFileSize(bytes, si = false, dp = 1) {
    const thresh = si ? 1000 : 1024;

    if (Math.abs(bytes) < thresh) {
        return bytes + ' B';
    }

    const units = si
        ? ['kB', 'MB', 'GB', 'TB', 'PB', 'EB', 'ZB', 'YB']
        : ['KiB', 'MiB', 'GiB', 'TiB', 'PiB', 'EiB', 'ZiB', 'YiB'];
    let u = -1;
    const r = 10 ** dp;

    do {
        bytes /= thresh;
        ++u;
    } while (Math.round(Math.abs(bytes) * r) / r >= thresh && u < units.length - 1);


    return bytes.toFixed(dp) + ' ' + units[u];
}

/**
 * Formats time in seconds to MM:SS format
 * @param {number} seconds - Time in seconds
 * @returns {string} Formatted time string
 */
export function formatTime(seconds) {
    if (!isFinite(seconds) || isNaN(seconds)) {
        return '0:00';
    }

    const minutes = Math.floor(seconds / 60);
    const secs = Math.floor(seconds % 60);
    return `${minutes}:${secs.toString().padStart(2, '0')}`;
}

/**
 * Counts the number of occurrences of a character in a string.
 * @param {string} string The string to count occurrences in.
 * @param {string} character The character to count occurrences of.
 * @returns {number} The number of occurrences of the character in the string.
 * @example
 * countOccurrences('Hello, world!', 'l'); // 3
 * countOccurrences('Hello, world!', 'x'); // 0
 */
export function countOccurrences(string, character) {
    let count = 0;

    for (let i = 0; i < string.length; i++) {
        if (string.substring(i, i + character.length) === character) {
            count++;
        }
    }

    return count;
}

/**
 * Checks if a string is "true" value.
 * @param {string} arg String to check
 * @returns {boolean} True if the string is true, false otherwise.
 */
export function isTrueBoolean(arg) {
    return ['on', 'true', '1'].includes(arg?.trim()?.toLowerCase());
}

/**
 * Checks if a string is "false" value.
 * @param {string} arg String to check
 * @returns {boolean} True if the string is false, false otherwise.
 */
export function isFalseBoolean(arg) {
    return ['off', 'false', '0'].includes(arg?.trim()?.toLowerCase());
}

/**
 * Parses an array either as a comma-separated string or as a JSON array.
 * @param {string} value String to parse
 * @returns {string[]} The parsed array.
 */
export function parseStringArray(value) {
    if (!value || typeof value !== 'string') return [];

    try {
        const parsedValue = JSON.parse(value);
        if (!Array.isArray(parsedValue)) {
            throw new Error('Not an array');
        }
        return parsedValue.map(x => String(x));
    } catch (e) {
        return value.split(',').map(x => x.trim()).filter(x => x);
    }
}

/**
 * Checks if a number is odd.
 * @param {number} number The number to check.
 * @returns {boolean} True if the number is odd, false otherwise.
 * @example
 * isOdd(3); // true
 * isOdd(4); // false
 */
export function isOdd(number) {
    return number % 2 !== 0;
}

/**
 * Compare two moment objects for sorting.
 * @param {import('moment').Moment} a The first moment object.
 * @param {import('moment').Moment} b The second moment object.
 * @returns {number} A negative number if a is before b, a positive number if a is after b, or 0 if they are equal.
 */
export function sortMoments(a, b) {
    if (a.isBefore(b)) {
        return 1;
    } else if (a.isAfter(b)) {
        return -1;
    } else {
        return 0;
    }
}

/** Split string to parts no more than length in size.
 * @param {string} input The string to split.
 * @param {number} length The maximum length of each part.
 * @param {string[]} delimiters The delimiters to use when splitting the string.
 * @returns {string[]} The split string.
 * @example
 * splitRecursive('Hello, world!', 3); // ['Hel', 'lo,', 'wor', 'ld!']
*/
export function splitRecursive(input, length, delimiters = ['\n\n', '\n', ' ', '']) {
    // Invalid length
    if (length <= 0) {
        return [input];
    }

    const delim = delimiters[0] ?? '';
    const parts = input.split(delim);

    const flatParts = parts.flatMap(p => {
        if (p.length < length) return p;
        return splitRecursive(p, length, delimiters.slice(1));
    });

    // Merge short chunks
    const result = [];
    let currentChunk = '';
    for (let i = 0; i < flatParts.length;) {
        currentChunk = flatParts[i];
        let j = i + 1;
        while (j < flatParts.length) {
            const nextChunk = flatParts[j];
            if (currentChunk.length + nextChunk.length + delim.length <= length) {
                currentChunk += delim + nextChunk;
            } else {
                break;
            }
            j++;
        }
        i = j;
        result.push(currentChunk);
    }
    return result;
}

/**
 * Checks if a string is a valid data URL.
 * @param {string} str The string to check.
 * @returns {boolean} True if the string is a valid data URL, false otherwise.
 * @example
 * isDataURL('data:image/png;base64,iVBORw0KGgoAAAANSUhEUgAAAAUA...'); // true
 */
export function isDataURL(str) {
    const regex = /^data:([a-z]+\/[a-z0-9-+.]+(;[a-z-]+=[a-z0-9-]+)*;?)?(base64)?,([a-z0-9!$&',()*+;=\-_%.~:@/?#]+)?$/i;
    return typeof str === 'string' && regex.test(str);
}

/**
 * Calculates the thumbnail size for a media element while maintaining aspect ratio.
 * @param {number} width Media width
 * @param {number} height Media height
 * @param {number?} maxWidth Max width (null = no limit)
 * @param {number?} maxHeight Max height (null = no limit)
 * @returns {{ thumbnailWidth: number, thumbnailHeight: number }} Thumbnail size
 */
export function calculateThumbnailSize(width, height, maxWidth, maxHeight) {
    // Calculate the thumbnail dimensions while maintaining the aspect ratio
    const aspectRatio = width / height;
    let thumbnailWidth = maxWidth;
    let thumbnailHeight = maxHeight;

    if (maxWidth === null) {
        thumbnailWidth = width;
        maxWidth = width;
    }

    if (maxHeight === null) {
        thumbnailHeight = height;
        maxHeight = height;
    }

    // Do not upscale if image is already smaller than max dimensions
    if (width <= maxWidth && height <= maxHeight) {
        thumbnailWidth = width;
        thumbnailHeight = height;
    } else {
        if (width > height) {
            thumbnailHeight = maxWidth / aspectRatio;
        } else {
            thumbnailWidth = maxHeight * aspectRatio;
        }
    }

    return { thumbnailWidth: Math.round(thumbnailWidth), thumbnailHeight: Math.round(thumbnailHeight) };
}

/**
 * Extracts words from a string.
 * @param {string} value The string to extract words from.
 * @returns {string[]} The extracted words.
 * @example
 * extractAllWords('Hello, world!'); // ['hello', 'world']
 */
export function extractAllWords(value) {
    const words = [];

    if (!value) {
        return words;
    }

    const matches = value.matchAll(/\b\w+\b/gim);
    for (let match of matches) {
        words.push(match[0].toLowerCase());
    }
    return words;
}

/**
 * Escapes a string for use in a regular expression.
 * @param {string} string The string to escape.
 * @returns {string} The escaped string.
 * @example
 * escapeRegex('^Hello$'); // '\\^Hello\\$'
 */
export function escapeRegex(string) {
    return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}

/**
 * Instantiates a regular expression from a string.
 * @param {string} input The input string.
 * @returns {RegExp} The regular expression instance.
 * @copyright Originally from: https://github.com/IonicaBizau/regex-parser.js/blob/master/lib/index.js
 */
export function regexFromString(input) {
    try {
        // Parse input
        var m = input.match(/(\/?)(.+)\1([a-z]*)/i);

        // Invalid flags
        if (m[3] && !/^(?!.*?(.).*?\1)[gmixXsuUAJ]+$/.test(m[3])) {
            return RegExp(input);
        }

        // Create the regular expression
        return new RegExp(m[2], m[3]);
    } catch {
        return;
    }
}

export class Stopwatch {
    /**
     * Initializes a Stopwatch class.
     * @param {number} interval Update interval in milliseconds. Must be a finite number above zero.
     */
    constructor(interval) {
        if (isNaN(interval) || !isFinite(interval) || interval <= 0) {
            console.warn('Invalid interval for Stopwatch, setting to 1');
            interval = 1;
        }

        this.interval = interval;
        this.lastAction = Date.now();
    }

    /**
     * Executes a function if the interval passed.
     * @param {(arg0: any) => any} action Action function
     * @returns Promise<void>
     */
    async tick(action) {
        const passed = (Date.now() - this.lastAction);

        if (passed < this.interval) {
            return;
        }

        await action();
        this.lastAction = Date.now();
    }
}

/**
 * Provides an interface for rate limiting function calls.
 */
export class RateLimiter {
    /**
     * Creates a new RateLimiter.
     * @param {number} interval The interval in milliseconds.
     * @example
     * const rateLimiter = new RateLimiter(1000);
     * rateLimiter.waitForResolve().then(() => {
     *    console.log('Waited 1000ms');
     * });
     */
    constructor(interval) {
        this.interval = interval;
        this.lastResolveTime = 0;
        this.pendingResolve = Promise.resolve();
    }

    /**
     * Waits for the remaining time in the interval.
     * @param {AbortSignal} abortSignal An optional AbortSignal to abort the wait.
     * @returns {Promise<void>} A promise that resolves when the remaining time has elapsed.
     */
    _waitRemainingTime(abortSignal) {
        const currentTime = Date.now();
        const elapsedTime = currentTime - this.lastResolveTime;
        const remainingTime = Math.max(0, this.interval - elapsedTime);

        return new Promise((resolve, reject) => {
            const timeoutId = setTimeout(() => {
                resolve();
            }, remainingTime);

            if (abortSignal) {
                abortSignal.addEventListener('abort', () => {
                    clearTimeout(timeoutId);
                    reject(new Error('Aborted'));
                });
            }
        });
    }

    /**
     * Waits for the next interval to elapse.
     * @param {AbortSignal} abortSignal An optional AbortSignal to abort the wait.
     * @returns {Promise<void>} A promise that resolves when the next interval has elapsed.
     */
    async waitForResolve(abortSignal) {
        await this.pendingResolve;
        this.pendingResolve = this._waitRemainingTime(abortSignal);

        // Update the last resolve time
        this.lastResolveTime = Date.now() + this.interval;
        console.debug(`RateLimiter.waitForResolve() ${this.lastResolveTime}`);
    }
}

/**
 * Extracts a JSON object from a PNG file.
 * Taken from https://github.com/LostRuins/lite.koboldai.net/blob/main/index.html
 * Adapted from png-chunks-extract under MIT license
 * @param {Uint8Array} data The PNG data to extract the JSON from.
 * @param {string} identifier The identifier to look for in the PNG tEXT data.
 * @returns {object} The extracted JSON object.
 */
export function extractDataFromPng(data, identifier = 'chara') {
    console.log('Attempting PNG import...');
    let uint8 = new Uint8Array(4);
    let uint32 = new Uint32Array(uint8.buffer);

    //check if png header is valid
    if (!data || data[0] !== 0x89 || data[1] !== 0x50 || data[2] !== 0x4E || data[3] !== 0x47 || data[4] !== 0x0D || data[5] !== 0x0A || data[6] !== 0x1A || data[7] !== 0x0A) {
        console.log('PNG header invalid');
        return null;
    }

    let ended = false;
    let chunks = [];
    let idx = 8;

    while (idx < data.length) {
        // Read the length of the current chunk,
        // which is stored as a Uint32.
        uint8[3] = data[idx++];
        uint8[2] = data[idx++];
        uint8[1] = data[idx++];
        uint8[0] = data[idx++];

        // Chunk includes name/type for CRC check (see below).
        let length = uint32[0] + 4;
        let chunk = new Uint8Array(length);
        chunk[0] = data[idx++];
        chunk[1] = data[idx++];
        chunk[2] = data[idx++];
        chunk[3] = data[idx++];

        // Get the name in ASCII for identification.
        let name = (
            String.fromCharCode(chunk[0]) +
            String.fromCharCode(chunk[1]) +
            String.fromCharCode(chunk[2]) +
            String.fromCharCode(chunk[3])
        );

        // The IHDR header MUST come first.
        if (!chunks.length && name !== 'IHDR') {
            console.log('Warning: IHDR header missing');
        }

        // The IEND header marks the end of the file,
        // so on discovering it break out of the loop.
        if (name === 'IEND') {
            ended = true;
            chunks.push({
                name: name,
                data: new Uint8Array(0),
            });
            break;
        }

        // Read the contents of the chunk out of the main buffer.
        for (let i = 4; i < length; i++) {
            chunk[i] = data[idx++];
        }

        // Read out the CRC value for comparison.
        // It's stored as an Int32.
        uint8[3] = data[idx++];
        uint8[2] = data[idx++];
        uint8[1] = data[idx++];
        uint8[0] = data[idx++];


        // The chunk data is now copied to remove the 4 preceding
        // bytes used for the chunk name/type.
        let chunkData = new Uint8Array(chunk.buffer.slice(4));

        chunks.push({
            name: name,
            data: chunkData,
        });
    }

    if (!ended) {
        console.log('.png file ended prematurely: no IEND header was found');
    }

    //find the chunk with the chara name, just check first and last letter
    let found = chunks.filter(x => (
        x.name == 'tEXt'
        && x.data.length > identifier.length
        && x.data.slice(0, identifier.length).every((v, i) => String.fromCharCode(v) == identifier[i])));

    if (found.length == 0) {
        console.log('PNG Image contains no data');
        return null;
    } else {
        try {
            let b64buf = '';
            let bytes = found[0].data; //skip the chara
            for (let i = identifier.length + 1; i < bytes.length; i++) {
                b64buf += String.fromCharCode(bytes[i]);
            }
            let decoded = JSON.parse(atob(b64buf));
            console.log(decoded);
            return decoded;
        } catch (e) {
            console.log('Error decoding b64 in image: ' + e);
            return null;
        }
    }
}

/**
 * Gets the file extension from a File object.
 * @param {File} file The file to get the extension from
 * @returns {string} The file extension of the given file
 */
export function getFileExtension(file) {
    return file.name.substring((file.name.lastIndexOf('.') + file.name.length) % file.name.length + 1).toLowerCase().trim();
}

/**
 * Waits for a condition to be true. Throws an error if the condition is not true within the timeout.
 * @param {{ (): boolean; }} condition The condition to wait for.
 * @param {number} [timeout=1000] The timeout in milliseconds.
 * @param {number} [interval=100] The interval in milliseconds.
 * @param {object} [options] Options object
 * @param {boolean} [options.rejectOnTimeout=true] Whether to reject the promise on timeout or resolve it.
 * @returns {Promise<void>} A promise that resolves when the condition is true.
 */
export async function waitUntilCondition(condition, timeout = 1000, interval = 100, options = {}) {
    const { rejectOnTimeout = true } = options;

    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            clearInterval(intervalId);
            const timeoutFn = rejectOnTimeout ? reject : resolve;
            timeoutFn(new Error('Timed out waiting for condition to be true'));
        }, timeout);

        const intervalId = setInterval(() => {
            if (condition()) {
                clearTimeout(timeoutId);
                clearInterval(intervalId);
                resolve();
            }
        }, interval);
    });
}

/**
 * Returns a UUID v4 string.
 * @returns {string} A UUID v4 string.
 * @example
 * uuidv4(); // '3e2fd9e1-0a7a-4f6d-9aaf-8a7a4babe7eb'
 */
export function uuidv4() {
    if ('randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

/**
 * Collapses multiple spaces in a strings into one.
 * @param {string} s String to process
 * @returns {string} String with collapsed spaces
 */
export function collapseSpaces(s) {
    return s.replace(/\s+/g, ' ').trim();
}

/**
 * Sets a value in an object by a path.
 * @param {object} obj Object to set value in
 * @param {string} path Key path
 * @param {any} value Value to set
 * @returns {void}
 */
export function setValueByPath(obj, path, value) {
    const keyParts = path.split('.');
    let currentObject = obj;

    for (let i = 0; i < keyParts.length - 1; i++) {
        const part = keyParts[i];

        if (!Object.hasOwn(currentObject, part)) {
            currentObject[part] = {};
        }

        currentObject = currentObject[part];
    }

    currentObject[keyParts[keyParts.length - 1]] = value;
}

/**
 * Deletes a value from a nested object at the given dot-separated path.
 * @param {object} obj Object to delete from
 * @param {string} path Dot-separated key path (e.g. "data.extensions.myKey")
 */
export function deleteValueByPath(obj, path) {
    const keyParts = path.split('.');
    let current = obj;
    for (let i = 0; i < keyParts.length - 1; i++) {
        if (!current || typeof current !== 'object') return;
        current = current[keyParts[i]];
    }
    if (current && typeof current === 'object') {
        delete current[keyParts[keyParts.length - 1]];
    }
}

/**
 * A common base function for case-insensitive and accent-insensitive string comparisons.
 *
 * @param {string} a - The first string to compare.
 * @param {string} b - The second string to compare.
 * @param {(a:string,b:string)=>T} comparisonFunction - The function to use for the comparison.
 * @returns {T} - The result of the comparison.
 * @template T
 */
export function compareIgnoreCaseAndAccents(a, b, comparisonFunction) {
    if (!a || !b) return comparisonFunction(a, b); // Return the comparison result if either string is empty

    // Normalize and remove diacritics, then convert to lower case
    const normalizedA = a.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();
    const normalizedB = b.normalize('NFD').replace(/[\u0300-\u036f]/g, '').toLowerCase();

    // Check if the normalized strings are equal
    return comparisonFunction(normalizedA, normalizedB);
}

/**
 * Performs a case-insensitive and accent-insensitive substring search.
 * This function normalizes the strings to remove diacritical marks and converts them to lowercase to ensure the search is insensitive to case and accents.
 *
 * @param {string} text - The text in which to search for the substring
 * @param {string} searchTerm - The substring to search for in the text
 * @returns {boolean} true if the searchTerm is found within the text, otherwise returns false
 */
export function includesIgnoreCaseAndAccents(text, searchTerm) {
    return compareIgnoreCaseAndAccents(text, searchTerm, (a, b) => a?.includes(b) === true);
}

/**
 * Performs a case-insensitive and accent-insensitive equality check.
 * This function normalizes the strings to remove diacritical marks and converts them to lowercase to ensure the search is insensitive to case and accents.
 *
 * @param {string} a - The first string to compare
 * @param {string} b - The second string to compare
 * @returns {boolean} true if the strings are equal, otherwise returns false
 */
export function equalsIgnoreCaseAndAccents(a, b) {
    return compareIgnoreCaseAndAccents(a, b, (a, b) => a === b);
}

/**
 * Performs a case-insensitive and accent-insensitive sort.
 * @param {string} a - The first string to compare
 * @param {string} b - The second string to compare
 * @returns {number} -1 if a < b, 1 if a > b, 0 if a === b
 */
export function sortIgnoreCaseAndAccents(a, b) {
    return compareIgnoreCaseAndAccents(a, b, (a, b) => a?.localeCompare(b));
}

/**
 * Applies syntax highlighting to a given regex string by generating HTML with classes
 *
 * @param {string} regexStr - The javascript compatible regex string
 * @returns {string} The html representation of the highlighted regex
 */
export function highlightRegex(regexStr) {
    // Function to escape special characters for safety or readability
    const escape = (str) => str.replace(/[&<>"'\x01]/g, match => ({
        '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', '\'': '&#39;', '\x01': '\\x01',
    })[match]);

    // Replace special characters with their escaped forms
    regexStr = escape(regexStr);

    // Patterns that we want to highlight only if they are not escaped
    function getPatterns() {
        try {
            return {
                brackets: new RegExp('(?<!\\\\)\\[.*?\\]', 'g'),  // Non-escaped square brackets
                quantifiers: new RegExp('(?<!\\\\)[*+?{}]', 'g'),  // Non-escaped quantifiers
                operators: new RegExp('(?<!\\\\)[|.^$()]', 'g'),  // Non-escaped operators like | and ()
                specialChars: new RegExp('\\\\.', 'g'),
                flags: new RegExp('(?<=\\/)([gimsuy]*)$', 'g'),  // Match trailing flags
                delimiters: new RegExp('^\\/|(?<![\\\\<])\\/', 'g'),  // Match leading or trailing delimiters
            };
        } catch (error) {
            return {
                brackets: new RegExp('(\\\\)?\\[.*?\\]', 'g'),  // Non-escaped square brackets
                quantifiers: new RegExp('(\\\\)?[*+?{}]', 'g'),  // Non-escaped quantifiers
                operators: new RegExp('(\\\\)?[|.^$()]', 'g'),  // Non-escaped operators like | and ()
                specialChars: new RegExp('\\\\.', 'g'),
                flags: new RegExp('/([gimsuy]*)$', 'g'),  // Match trailing flags
                delimiters: new RegExp('^/|[^\\\\](/)', 'g'),  // Match leading or trailing delimiters
            };
        }
    }

    const patterns = getPatterns();

    // Function to replace each pattern with a highlighted HTML span
    const wrapPattern = (pattern, className) => {
        regexStr = regexStr.replace(pattern, match => `<span class="${className}">${match}</span>`);
    };

    // Apply highlighting patterns
    wrapPattern(patterns.brackets, 'regex-brackets');
    wrapPattern(patterns.quantifiers, 'regex-quantifier');
    wrapPattern(patterns.operators, 'regex-operator');
    wrapPattern(patterns.specialChars, 'regex-special');
    wrapPattern(patterns.flags, 'regex-flags');
    wrapPattern(patterns.delimiters, 'regex-delimiter');

    return `<span class="regex-highlight">${regexStr}</span>`;
}

/**
 * Generates a free name by appending a counter to the given name if it already exists in the list
 *
 * @param {string} name - The original name to check for existence in the list
 * @param {string[]} list - The list of names to check for existence
 * @param {(n: number) => string} [numberFormatter=(n) => ` #${n}`] - The function used to format the counter
 * @returns {string} The generated free name
 */
export function getFreeName(name, list, numberFormatter = (n) => ` #${n}`) {
    if (!list.includes(name)) {
        return name;
    }
    let counter = 1;
    while (list.includes(`${name} #${counter}`)) {
        counter++;
    }
    return `${name}${numberFormatter(counter)}`;
}

/**
 * Compares two arrays for equality
 * @param {any[]} a - The first array
 * @param {any[]} b - The second array
 * @returns {boolean} True if the arrays are equal, false otherwise
 */
export function arraysEqual(a, b) {
    if (a === b) return true;
    if (a == null || b == null) return false;
    if (a.length !== b.length) return false;

    for (let i = 0; i < a.length; i++) {
        if (a[i] !== b[i]) return false;
    }
    return true;
}

/**
 * Compares two version numbers, returning true if srcVersion >= minVersion
 * @param {string} srcVersion The current version.
 * @param {string} minVersion The target version number to test against
 * @returns {boolean} True if srcVersion >= minVersion, false if not
 */
export function versionCompare(srcVersion, minVersion) {
    return (srcVersion || '0.0.0').localeCompare(minVersion, undefined, { numeric: true, sensitivity: 'base' }) > -1;
}

/**
 * Logs a warning to the console for slash command executions.
 * Strips internal arguments (starting with '_') from the args object for cleaner logging.
 * @param {string} message - The warning message to log.
 * @param {Object} args - The arguments object from the slash command, including named arguments and internal values.
 * @param {{[unnamedArgName: string]: string}} [valueObj=null] - The user-built object containing context for the warning (e.g., { uid: uid }).
 * @returns {void}
 */
export function logSlashCommandWarn(message, args, valueObj = null) {
    if (valueObj !== null && valueObj !== undefined) {
        console.warn(message, valueObj, stripInternalArgs(args));
    } else {
        console.warn(message, stripInternalArgs(args));
    }
    return;
    function stripInternalArgs(args) {
        // strip all args/properties that start with an underscore
        const result = {};
        for (const [key, value] of Object.entries(args)) {
            if (!key.startsWith('_')) {
                result[key] = value;
            }
        }
        return result;
    }
}

/**
 * If value is less than min, it's set to min.
 * If value is greater than max, it's set to max.
 * @param {number} value The target value.
 * @param {number} min The minimum for value.
 * @param {number} max The maximum for value.
 * @returns {number} The clamped value.
 */
export const clamp = (value, min, max) => Math.min(Math.max(value, min), max);

/**
 * Creates a promise that rejects after a specified delay.
 * Used for Promise.race fallbacks.
 * @param {number} ms The delay in milliseconds.
 * @param {string?} [errorMessage='']
 * @returns {Promise<never>} A promise that rejects.
 */
export function createTimeout(ms, errorMessage = '') {
    errorMessage ??= `Operation timed out after ${ms}ms.`;
    return new Promise((_, reject) => {
        setTimeout(() => reject(new Error(errorMessage)), ms);
    });
}
