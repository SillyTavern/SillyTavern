import { getContext } from './extensions.js';
import { getRequestHeaders } from '../script.js';
import { isMobile } from './RossAscends-mods.js';
import { collapseNewlines } from './power-user.js';
import { debounce_timeout } from './constants.js';
import { Popup, POPUP_RESULT, POPUP_TYPE } from './popup.js';
import { SlashCommandClosure } from './slash-commands/SlashCommandClosure.js';

/**
 * Pagination status string template.
 * @type {string}
 */
export const PAGINATION_TEMPLATE = '<%= rangeStart %>-<%= rangeEnd %> of <%= totalNumber %>';

/**
 * Navigation options for pagination.
 * @enum {number}
 */
export const navigation_option = {
    none: -2000,
    previous: -1000,
};

export function escapeHtml(str) {
    return String(str).replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;').replace(/"/g, '&quot;');
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
 * Converts string to a value of a given type. Includes pythonista-friendly aliases.
 * @param {string|SlashCommandClosure} value String value
 * @param {string} type Type to convert to
 * @returns {any} Converted value
 */
export function convertValueType(value, type) {
    if (value instanceof SlashCommandClosure || typeof type !== 'string') {
        return value;
    }

    switch (type.trim().toLowerCase()) {
        case 'string':
        case 'str':
            return String(value);

        case 'null':
            return null;

        case 'undefined':
        case 'none':
            return undefined;

        case 'number':
            return Number(value);

        case 'int':
            return parseInt(value, 10);

        case 'float':
            return parseFloat(value);

        case 'boolean':
        case 'bool':
            return isTrueBoolean(value);

        case 'list':
        case 'array':
            try {
                const parsedArray = JSON.parse(value);
                if (Array.isArray(parsedArray)) {
                    return parsedArray;
                }
                // The value is not an array
                return [];
            } catch {
                return [];
            }

        case 'object':
        case 'dict':
        case 'dictionary':
            try {
                const parsedObject = JSON.parse(value);
                if (typeof parsedObject === 'object') {
                    return parsedObject;
                }
                // The value is not an object
                return {};
            } catch {
                return {};
            }

        default:
            return value;
    }
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
 * Gets a drag delay for sortable elements. This is to prevent accidental drags when scrolling.
 * @returns {number} The delay in milliseconds. 50ms for desktop, 750ms for mobile.
 */
export function getSortableDelay() {
    return isMobile() ? 750 : 50;
}

export async function bufferToBase64(buffer) {
    // use a FileReader to generate a base64 data URI:
    const base64url = await new Promise(resolve => {
        const reader = new FileReader();
        reader.onload = () => resolve(reader.result);
        reader.readAsDataURL(new Blob([buffer]));
    });
    // remove the `data:...;base64,` part from the start
    return base64url.slice(base64url.indexOf(',') + 1);
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
 * Downloads a file to the user's devices.
 * @param {BlobPart} content File content to download.
 * @param {string} fileName File name.
 * @param {string} contentType File content type.
 */
export function download(content, fileName, contentType) {
    const a = document.createElement('a');
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(a.href);
}

/**
 * Fetches a file by URL and parses its contents as data URI.
 * @param {string} url The URL to fetch.
 * @param {any} params Fetch parameters.
 * @returns {Promise<string>} A promise that resolves to the data URI.
 */
export async function urlContentToDataUri(url, params) {
    const response = await fetch(url, params);
    const blob = await response.blob();
    return await new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.onload = function () {
            resolve(String(reader.result));
        };
        reader.onerror = function (error) {
            reject(error);
        };
        reader.readAsDataURL(blob);
    });
}

/**
 * Returns a promise that resolves to the file's text.
 * @param {Blob} file The file to read.
 * @returns {Promise<string>} A promise that resolves to the file's text.
 */
export function getFileText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsText(file);
        reader.onload = function () {
            resolve(String(reader.result));
        };
        reader.onerror = function (error) {
            reject(error);
        };
    });
}

/**
 * Returns a promise that resolves to the file's array buffer.
 * @param {Blob} file The file to read.
 */
export function getFileBuffer(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsArrayBuffer(file);
        reader.onload = function () {
            resolve(reader.result);
        };
        reader.onerror = function (error) {
            reject(error);
        };
    });
}

/**
 * Returns a promise that resolves to the base64 encoded string of a file.
 * @param {Blob} file The file to read.
 * @returns {Promise<string>} A promise that resolves to the base64 encoded string.
 */
export function getBase64Async(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function () {
            resolve(String(reader.result));
        };
        reader.onerror = function (error) {
            reject(error);
        };
    });
}

/**
 * Parses a file blob as a JSON object.
 * @param {Blob} file The file to read.
 * @returns {Promise<any>} A promise that resolves to the parsed JSON object.
 */
export async function parseJsonFile(file) {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.readAsText(file);
        fileReader.onload = event => resolve(JSON.parse(String(event.target.result)));
        fileReader.onerror = error => reject(error);
    });
}

/**
 * Calculates a hash code for a string.
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
 * Checks if an element is in the viewport.
 * @param {Element} el The element to check.
 * @returns {boolean} True if the element is in the viewport, false otherwise.
 */
export function isElementInViewport(el) {
    if (!el) {
        return false;
    }
    if (typeof jQuery === 'function' && el instanceof jQuery) {
        el = el[0];
    }
    var rect = el.getBoundingClientRect();
    return (
        rect.top >= 0 &&
        rect.left >= 0 &&
        rect.bottom <= (window.innerHeight || document.documentElement.clientHeight) && /* or $(window).height() */
        rect.right <= (window.innerWidth || document.documentElement.clientWidth) /* or $(window).width() */
    );
}

/**
 * Returns a name that is unique among the names that exist.
 * @param {string} name The name to check.
 * @param {{ (y: any): boolean; }} exists Function to check if name exists.
 * @returns {string} A unique name.
 */
export function getUniqueName(name, exists) {
    let i = 1;
    let baseName = name;
    while (exists(name)) {
        name = `${baseName} (${i})`;
        i++;
    }
    return name;
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
 * Save the caret position in a contenteditable element.
 * @param {Element} element The element to save the caret position of.
 * @returns {{ start: number, end: number }} An object with the start and end offsets of the caret.
 */
export function saveCaretPosition(element) {
    // Get the current selection
    const selection = window.getSelection();

    // If the selection is empty, return null
    if (selection.rangeCount === 0) {
        return null;
    }

    // Get the range of the current selection
    const range = selection.getRangeAt(0);

    // If the range is not within the specified element, return null
    if (!element.contains(range.commonAncestorContainer)) {
        return null;
    }

    // Return an object with the start and end offsets of the range
    const position = {
        start: range.startOffset,
        end: range.endOffset,
    };

    console.debug('Caret saved', position);

    return position;
}

/**
 * Restore the caret position in a contenteditable element.
 * @param {Element} element The element to restore the caret position of.
 * @param {{ start: any; end: any; }} position An object with the start and end offsets of the caret.
 */
export function restoreCaretPosition(element, position) {
    // If the position is null, do nothing
    if (!position) {
        return;
    }

    console.debug('Caret restored', position);

    // Create a new range object
    const range = new Range();

    // Set the start and end positions of the range within the element
    range.setStart(element.childNodes[0], position.start);
    range.setEnd(element.childNodes[0], position.end);

    // Create a new selection object and set the range
    const selection = window.getSelection();
    selection.removeAllRanges();
    selection.addRange(range);
}

export async function resetScrollHeight(element) {
    $(element).css('height', '0px');
    $(element).css('height', $(element).prop('scrollHeight') + 3 + 'px');
}

/**
 * Sets the height of an element to its scroll height.
 * @param {JQuery<HTMLElement>} element The element to initialize the scroll height of.
 * @returns {Promise<void>} A promise that resolves when the scroll height has been initialized.
 */
export async function initScrollHeight(element) {
    await delay(1);

    const curHeight = Number($(element).css('height').replace('px', ''));
    const curScrollHeight = Number($(element).prop('scrollHeight'));
    const diff = curScrollHeight - curHeight;

    if (diff < 3) { return; } //happens when the div isn't loaded yet

    const newHeight = curHeight + diff + 3; //the +3 here is to account for padding/line-height on text inputs
    //console.log(`init height to ${newHeight}`);
    $(element).css('height', '');
    $(element).css('height', `${newHeight}px`);
    //resetScrollHeight(element);
}

/**
 * Compares elements by their CSS order property. Used for sorting.
 * @param {any} a The first element.
 * @param {any} b The second element.
 * @returns {number} A negative number if a is before b, a positive number if a is after b, or 0 if they are equal.
 */
export function sortByCssOrder(a, b) {
    const _a = Number($(a).css('order'));
    const _b = Number($(b).css('order'));
    return _a - _b;
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

        if (punctuation.has(char) || isEmoji(char)) {
            if (i > 0 && /[\s\n]/.test(characters[i - 1])) {
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
 * @param {moment.Moment} a The first moment object.
 * @param {moment.Moment} b The second moment object.
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

const dateCache = new Map();

/**
 * Cached version of moment() to avoid re-parsing the same date strings.
 * Important: Moment objects are mutable, so use clone() before modifying them!
 * @param {string|number} timestamp String or number representing a date.
 * @returns {moment.Moment} Moment object
 */
export function timestampToMoment(timestamp) {
    if (dateCache.has(timestamp)) {
        return dateCache.get(timestamp);
    }

    const iso8601 = parseTimestamp(timestamp);
    const objMoment = iso8601 ? moment(iso8601) : moment.invalid();

    dateCache.set(timestamp, objMoment);
    return objMoment;
}

/**
 * Parses a timestamp and returns a moment object representing the parsed date and time.
 * @param {string|number} timestamp - The timestamp to parse. It can be a string or a number.
 * @returns {string} - If the timestamp is valid, returns an ISO 8601 string.
 */
function parseTimestamp(timestamp) {
    if (!timestamp) return;

    // Unix time (legacy TAI / tags)
    if (typeof timestamp === 'number' || /^\d+$/.test(timestamp)) {
        const unixTime = Number(timestamp);
        const isValid = Number.isFinite(unixTime) && !Number.isNaN(unixTime) && unixTime >= 0;
        if (!isValid) return;
        return new Date(unixTime).toISOString();
    }

    let dtFmt = [];

    // meridiem-based format
    const convertFromMeridiemBased = (_, month, day, year, hour, minute, meridiem) => {
        const monthNum = moment().month(month).format('MM');
        const hour24 = meridiem.toLowerCase() === 'pm' ? (parseInt(hour, 10) % 12) + 12 : parseInt(hour, 10) % 12;
        return `${year}-${monthNum}-${day.padStart(2, '0')}T${hour24.toString().padStart(2, '0')}:${minute.padStart(2, '0')}:00`;
    };
    // June 19, 2023 2:20pm
    dtFmt.push({ callback: convertFromMeridiemBased, pattern: /(\w+)\s(\d{1,2}),\s(\d{4})\s(\d{1,2}):(\d{1,2})(am|pm)/i });

    // ST "humanized" format patterns
    const convertFromHumanized = (_, year, month, day, hour, min, sec, ms) => {
        ms = typeof ms !== 'undefined' ? `.${ms.padStart(3, '0')}` : '';
        return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${min.padStart(2, '0')}:${sec.padStart(2, '0')}${ms}Z`;
    };
    // 2024-7-12@01h31m37s
    dtFmt.push({ callback: convertFromHumanized, pattern: /(\d{4})-(\d{1,2})-(\d{1,2})@(\d{1,2})h(\d{1,2})m(\d{1,2})s/ });
    // 2024-6-5 @14h 56m 50s 682ms
    dtFmt.push({ callback: convertFromHumanized, pattern: /(\d{4})-(\d{1,2})-(\d{1,2}) @(\d{1,2})h (\d{1,2})m (\d{1,2})s (\d{1,3})ms/ });

    for (const x of dtFmt) {
        let rgxMatch = timestamp.match(x.pattern);
        if (!rgxMatch) continue;
        return x.callback(...rgxMatch);
    }
    return;
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
    return regex.test(str);
}

/**
 * Gets the size of an image from a data URL.
 * @param {string} dataUrl Image data URL
 * @returns {Promise<{ width: number, height: number }>} Image size
 */
export function getImageSizeFromDataURL(dataUrl) {
    const image = new Image();
    image.src = dataUrl;
    return new Promise((resolve, reject) => {
        image.onload = function () {
            resolve({ width: image.width, height: image.height });
        };
        image.onerror = function () {
            reject(new Error('Failed to load image'));
        };
    });
}

export function getCharaFilename(chid) {
    const context = getContext();
    const fileName = context.characters[chid ?? context.characterId]?.avatar;

    if (fileName) {
        return fileName.replace(/\.[^/.]+$/, '');
    }
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
 * Sends a request to the server to sanitize a given filename
 *
 * @param {string} fileName - The name of the file to sanitize
 * @returns {Promise<string>} A Promise that resolves to the sanitized filename if successful, or rejects with an error message if unsuccessful
 */
export async function getSanitizedFilename(fileName) {
    try {
        const result = await fetch('/api/files/sanitize-filename', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                fileName: fileName,
            }),
        });

        if (!result.ok) {
            const error = await result.text();
            throw new Error(error);
        }

        const responseData = await result.json();
        return responseData.fileName;
    } catch (error) {
        toastr.error(String(error), 'Could not sanitize fileName');
        console.error('Could not sanitize fileName', error);
        throw error;
    }
}

/**
 * Sends a base64 encoded image to the backend to be saved as a file.
 *
 * @param {string} base64Data - The base64 encoded image data.
 * @param {string} characterName - The character name to determine the sub-directory for saving.
 * @param {string} ext - The file extension for the image (e.g., 'jpg', 'png', 'webp').
 *
 * @returns {Promise<string>} - Resolves to the saved image's path on the server.
 *                              Rejects with an error if the upload fails.
 */
export async function saveBase64AsFile(base64Data, characterName, filename = '', ext) {
    // Construct the full data URL
    const format = ext; // Extract the file extension (jpg, png, webp)
    const dataURL = `data:image/${format};base64,${base64Data}`;

    // Prepare the request body
    const requestBody = {
        image: dataURL,
        ch_name: characterName,
        filename: String(filename).replace(/\./g, '_'),
    };

    // Send the data URL to your backend using fetch
    const response = await fetch('/api/images/upload', {
        method: 'POST',
        body: JSON.stringify(requestBody),
        headers: {
            ...getRequestHeaders(),
            'Content-Type': 'application/json',
        },
    });

    // If the response is successful, get the saved image path from the server's response
    if (response.ok) {
        const responseData = await response.json();
        return responseData.path;
    } else {
        const errorData = await response.json();
        throw new Error(errorData.error || 'Failed to upload the image to the server');
    }
}

/**
 * Loads either a CSS or JS file and appends it to the appropriate document section.
 *
 * @param {string} url - The URL of the file to be loaded.
 * @param {string} type - The type of file to load: "css" or "js".
 * @returns {Promise} - Resolves when the file has loaded, rejects if there's an error or invalid type.
 */
export function loadFileToDocument(url, type) {
    return new Promise((resolve, reject) => {
        let element;

        if (type === 'css') {
            element = document.createElement('link');
            element.rel = 'stylesheet';
            element.href = url;
        } else if (type === 'js') {
            element = document.createElement('script');
            element.src = url;
        } else {
            reject('Invalid type specified');
            return;
        }

        element.onload = resolve;
        element.onerror = reject;

        type === 'css'
            ? document.head.appendChild(element)
            : document.body.appendChild(element);
    });
}

/**
 * Ensure that we can import war crime image formats like WEBP and AVIF.
 * @param {File} file Input file
 * @returns {Promise<File>} A promise that resolves to the supported file.
 */
export async function ensureImageFormatSupported(file) {
    const supportedTypes = [
        'image/jpeg',
        'image/png',
        'image/bmp',
        'image/tiff',
        'image/gif',
        'image/apng',
    ];

    if (supportedTypes.includes(file.type) || !file.type.startsWith('image/')) {
        return file;
    }

    return await convertImageFile(file, 'image/png');
}

/**
 * Converts an image file to a given format.
 * @param {File} inputFile File to convert
 * @param {string} type Target file type
 * @returns {Promise<File>} A promise that resolves to the converted file.
 */
export async function convertImageFile(inputFile, type = 'image/png') {
    const base64 = await getBase64Async(inputFile);
    const thumbnail = await createThumbnail(base64, null, null, type);
    const blob = await fetch(thumbnail).then(res => res.blob());
    const outputFile = new File([blob], inputFile.name, { type });
    return outputFile;
}

/**
 * Creates a thumbnail from a data URL.
 * @param {string} dataUrl The data URL encoded data of the image.
 * @param {number|null} maxWidth The maximum width of the thumbnail.
 * @param {number|null} maxHeight The maximum height of the thumbnail.
 * @param {string} [type='image/jpeg'] The type of the thumbnail.
 * @returns {Promise<string>} A promise that resolves to the thumbnail data URL.
 */
export function createThumbnail(dataUrl, maxWidth = null, maxHeight = null, type = 'image/jpeg') {
    // Someone might pass in a base64 encoded string without the data URL prefix
    if (!dataUrl.includes('data:')) {
        dataUrl = `data:image/jpeg;base64,${dataUrl}`;
    }

    return new Promise((resolve, reject) => {
        const img = new Image();
        img.src = dataUrl;
        img.onload = () => {
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');

            // Calculate the thumbnail dimensions while maintaining the aspect ratio
            const aspectRatio = img.width / img.height;
            let thumbnailWidth = maxWidth;
            let thumbnailHeight = maxHeight;

            if (maxWidth === null) {
                thumbnailWidth = img.width;
                maxWidth = img.width;
            }

            if (maxHeight === null) {
                thumbnailHeight = img.height;
                maxHeight = img.height;
            }

            if (img.width > img.height) {
                thumbnailHeight = maxWidth / aspectRatio;
            } else {
                thumbnailWidth = maxHeight * aspectRatio;
            }

            // Set the canvas dimensions and draw the resized image
            canvas.width = thumbnailWidth;
            canvas.height = thumbnailHeight;
            ctx.drawImage(img, 0, 0, thumbnailWidth, thumbnailHeight);

            // Convert the canvas to a data URL and resolve the promise
            const thumbnailDataUrl = canvas.toDataURL(type);
            resolve(thumbnailDataUrl);
        };

        img.onerror = () => {
            reject(new Error('Failed to load the image.'));
        };
    });
}

/**
 * Waits for a condition to be true. Throws an error if the condition is not true within the timeout.
 * @param {{ (): boolean; }} condition The condition to wait for.
 * @param {number} [timeout=1000] The timeout in milliseconds.
 * @param {number} [interval=100] The interval in milliseconds.
 * @returns {Promise<void>} A promise that resolves when the condition is true.
 */
export async function waitUntilCondition(condition, timeout = 1000, interval = 100) {
    return new Promise((resolve, reject) => {
        const timeoutId = setTimeout(() => {
            clearInterval(intervalId);
            reject(new Error('Timed out waiting for condition to be true'));
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

function postProcessText(text, collapse = true) {
    // Remove carriage returns
    text = text.replace(/\r/g, '');
    // Replace tabs with spaces
    text = text.replace(/\t/g, ' ');
    // Normalize unicode spaces
    text = text.replace(/\u00A0/g, ' ');
    // Collapse multiple newlines into one
    if (collapse) {
        text = collapseNewlines(text);
        // Trim leading and trailing whitespace, and remove empty lines
        text = text.split('\n').map(l => l.trim()).filter(Boolean).join('\n');
    } else {
        // Replace more than 4 newlines with 4 newlines
        text = text.replace(/\n{4,}/g, '\n\n\n\n');
        // Trim lines that contain nothing but whitespace
        text = text.split('\n').map(l => /^\s+$/.test(l) ? '' : l).join('\n');
    }
    // Collapse multiple spaces into one (except for newlines)
    text = text.replace(/ {2,}/g, ' ');
    // Remove leading and trailing spaces
    text = text.trim();
    return text;
}

/**
 * Uses Readability.js to parse the text from a web page.
 * @param {Document} document HTML document
 * @param {string} [textSelector='body'] The fallback selector for the text to parse.
 * @returns {Promise<string>} A promise that resolves to the parsed text.
 */
export async function getReadableText(document, textSelector = 'body') {
    if (isProbablyReaderable(document)) {
        const parser = new Readability(document);
        const article = parser.parse();
        return postProcessText(article.textContent, false);
    }

    const elements = document.querySelectorAll(textSelector);
    const rawText = Array.from(elements).map(e => e.textContent).join('\n');
    const text = postProcessText(rawText);
    return text;
}

/**
 * Use pdf.js to load and parse text from PDF pages
 * @param {Blob} blob PDF file blob
 * @returns {Promise<string>} A promise that resolves to the parsed text.
 */
export async function extractTextFromPDF(blob) {
    async function initPdfJs() {
        const promises = [];

        const workerPromise = new Promise((resolve, reject) => {
            const workerScript = document.createElement('script');
            workerScript.type = 'module';
            workerScript.async = true;
            workerScript.src = 'lib/pdf.worker.mjs';
            workerScript.onload = resolve;
            workerScript.onerror = reject;
            document.head.appendChild(workerScript);
        });

        promises.push(workerPromise);

        const pdfjsPromise = new Promise((resolve, reject) => {
            const pdfjsScript = document.createElement('script');
            pdfjsScript.type = 'module';
            pdfjsScript.async = true;
            pdfjsScript.src = 'lib/pdf.mjs';
            pdfjsScript.onload = resolve;
            pdfjsScript.onerror = reject;
            document.head.appendChild(pdfjsScript);
        });

        promises.push(pdfjsPromise);

        return Promise.all(promises);
    }

    if (!('pdfjsLib' in window)) {
        await initPdfJs();
    }

    const buffer = await getFileBuffer(blob);
    const pdf = await pdfjsLib.getDocument(buffer).promise;
    const pages = [];
    for (let i = 1; i <= pdf.numPages; i++) {
        const page = await pdf.getPage(i);
        const textContent = await page.getTextContent();
        const text = textContent.items.map(item => item.str).join(' ');
        pages.push(text);
    }
    return postProcessText(pages.join('\n'));
}

/**
 * Use DOMParser to load and parse text from HTML
 * @param {Blob} blob HTML content blob
 * @returns {Promise<string>} A promise that resolves to the parsed text.
 */
export async function extractTextFromHTML(blob, textSelector = 'body') {
    const html = await blob.text();
    const domParser = new DOMParser();
    const document = domParser.parseFromString(DOMPurify.sanitize(html), 'text/html');
    return await getReadableText(document, textSelector);
}

/**
 * Use showdown to load and parse text from Markdown
 * @param {Blob} blob Markdown content blob
 * @returns {Promise<string>} A promise that resolves to the parsed text.
 */
export async function extractTextFromMarkdown(blob) {
    const markdown = await blob.text();
    const text = postProcessText(markdown, false);
    return text;
}

export async function extractTextFromEpub(blob) {
    async function initEpubJs() {
        const epubScript = new Promise((resolve, reject) => {
            const epubScript = document.createElement('script');
            epubScript.async = true;
            epubScript.src = 'lib/epub.min.js';
            epubScript.onload = resolve;
            epubScript.onerror = reject;
            document.head.appendChild(epubScript);
        });

        const jszipScript = new Promise((resolve, reject) => {
            const jszipScript = document.createElement('script');
            jszipScript.async = true;
            jszipScript.src = 'lib/jszip.min.js';
            jszipScript.onload = resolve;
            jszipScript.onerror = reject;
            document.head.appendChild(jszipScript);
        });

        return Promise.all([epubScript, jszipScript]);
    }

    if (!('ePub' in window)) {
        await initEpubJs();
    }

    const book = ePub(blob);
    await book.ready;
    const sectionPromises = [];

    book.spine.each((section) => {
        const sectionPromise = (async () => {
            const chapter = await book.load(section.href);
            if (!(chapter instanceof Document) || !chapter.body?.textContent) {
                return '';
            }
            return chapter.body.textContent.trim();
        })();

        sectionPromises.push(sectionPromise);
    });

    const content = await Promise.all(sectionPromises);
    const text = content.filter(text => text);
    return postProcessText(text.join('\n'), false);
}

/**
 * Extracts text from an Office document using the server plugin.
 * @param {File} blob File to extract text from
 * @returns {Promise<string>} A promise that resolves to the extracted text.
 */
export async function extractTextFromOffice(blob) {
    async function checkPluginAvailability() {
        try {
            const result = await fetch('/api/plugins/office/probe', {
                method: 'POST',
                headers: getRequestHeaders(),
            });

            return result.ok;
        } catch (error) {
            return false;
        }
    }

    const isPluginAvailable = await checkPluginAvailability();

    if (!isPluginAvailable) {
        throw new Error('Importing Office documents requires a server plugin. Please refer to the documentation for more information.');
    }

    const base64 = await getBase64Async(blob);

    const response = await fetch('/api/plugins/office/parse', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ data: base64 }),
    });

    if (!response.ok) {
        throw new Error('Failed to parse the Office document');
    }

    const data = await response.text();
    return postProcessText(data, false);
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
 * Flashes the given HTML element via CSS flash animation for a defined period
 * @param {JQuery<HTMLElement>} element - The element to flash
 * @param {number} timespan - A number in milliseconds how the flash should last (default is 2000ms.  Multiples of 1000ms work best, as they end with the flash animation being at 100% opacity)
 */
export function flashHighlight(element, timespan = 2000) {
    const flashDuration = 2000; // Duration of a single flash cycle in milliseconds

    element.addClass('flash animated');
    element.css('--animation-duration', `${flashDuration}ms`);

    // Repeat the flash animation
    const intervalId = setInterval(() => {
        element.removeClass('flash animated');
        void element[0].offsetWidth; // Trigger reflow to restart animation
        element.addClass('flash animated');
    }, flashDuration);

    setTimeout(() => {
        clearInterval(intervalId);
        element.removeClass('flash animated');
        element.css('--animation-duration', '');
    }, timespan);
}


/**
 * Checks if the given control has an animation applied to it
 *
 * @param {HTMLElement} control - The control element to check for animation
 * @returns {boolean} Whether the control has an animation applied
 */
export function hasAnimation(control) {
    const animatioName = getComputedStyle(control, null)['animation-name'];
    return animatioName != 'none';
}

/**
 * Run an action once an animation on a control ends. If the control has no animation, the action will be executed immediately.
 *
 * @param {HTMLElement} control - The control element to listen for animation end event
 * @param {(control:*?) => void} callback - The callback function to be executed when the animation ends
 */
export function runAfterAnimation(control, callback) {
    if (hasAnimation(control)) {
        const onAnimationEnd = () => {
            control.removeEventListener('animationend', onAnimationEnd);
            callback(control);
        };
        control.addEventListener('animationend', onAnimationEnd);
    } else {
        callback(control);
    }
}

/**
 * A common base function for case-insensitive and accent-insensitive string comparisons.
 *
 * @param {string} a - The first string to compare.
 * @param {string} b - The second string to compare.
 * @param {(a:string,b:string)=>boolean} comparisonFunction - The function to use for the comparison.
 * @returns {*} - The result of the comparison.
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
 * @typedef {object} Select2Option The option object for select2 controls
 * @property {string} id - The unique ID inside this select
 * @property {string} text - The text for this option
 * @property {number?} [count] - Optionally show the count how often that option was chosen already
 */

/**
 * Returns a unique hash as ID for a select2 option text
 *
 * @param {string} option - The option
 * @returns {string} A hashed version of that option
 */
export function getSelect2OptionId(option) {
    return String(getStringHash(option));
}

/**
 * Modifies the select2 options by adding not existing one and optionally selecting them
 *
 * @param {JQuery<HTMLElement>} element - The "select" element to add the options to
 * @param {string[]|Select2Option[]} items - The option items to build, add or select
 * @param {object} [options] - Optional arguments
 * @param {boolean} [options.select=false] - Whether the options should be selected right away
 * @param {object} [options.changeEventArgs=null] - Optional event args being passed into the "change" event when its triggered because a new options is selected
 */
export function select2ModifyOptions(element, items, { select = false, changeEventArgs = null } = {}) {
    if (!items.length) return;
    /** @type {Select2Option[]} */
    const dataItems = items.map(x => typeof x === 'string' ? { id: getSelect2OptionId(x), text: x } : x);

    const optionsToSelect = [];
    const newOptions = [];

    dataItems.forEach(item => {
        // Set the value, creating a new option if necessary
        if (element.find('option[value=\'' + item.id + '\']').length) {
            if (select) optionsToSelect.push(item.id);
        } else {
            // Create a DOM Option and optionally pre-select by default
            var newOption = new Option(item.text, item.id, select, select);
            // Append it to the select
            newOptions.push(newOption);
            if (select) optionsToSelect.push(item.id);
        }
    });

    element.append(newOptions);
    if (optionsToSelect.length) element.val(optionsToSelect).trigger('change', changeEventArgs);
}

/**
 * Returns the ajax settings that can be used on the select2 ajax property to dynamically get the data.
 * Can be used on a single global array, querying data from the server or anything similar.
 *
 * @param {function():Select2Option[]} dataProvider - The provider/function to retrieve the data - can be as simple as "() => myData" for arrays
 * @return {{transport: (params, success, failure) => any}} The ajax object with the transport function to use on the select2 ajax property
 */
export function dynamicSelect2DataViaAjax(dataProvider) {
    function dynamicSelect2DataTransport(params, success, failure) {
        var items = dataProvider();
        // fitering if params.data.q available
        if (params.data && params.data.q) {
            items = items.filter(function (item) {
                return includesIgnoreCaseAndAccents(item.text, params.data.q);
            });
        }
        var promise = new Promise(function (resolve, reject) {
            resolve({ results: items });
        });
        promise.then(success);
        promise.catch(failure);
    }
    const ajax = {
        transport: dynamicSelect2DataTransport,
    };
    return ajax;
}

/**
 * Checks whether a given control is a select2 choice element - meaning one of the results being displayed in the select multi select box
 * @param {JQuery<HTMLElement>|HTMLElement} element - The element to check
 * @returns {boolean} Whether this is a choice element
 */
export function isSelect2ChoiceElement(element) {
    const $element = $(element);
    return ($element.hasClass('select2-selection__choice__display') || $element.parents('.select2-selection__choice__display').length > 0);
}

/**
 * Subscribes a 'click' event handler to the choice elements of a select2 multi-select control
 *
 * @param {JQuery<HTMLElement>} control The original control the select2 was applied to
 * @param {function(HTMLElement):void} action - The action to execute when a choice element is clicked
 * @param {object} options - Optional parameters
 * @param {boolean} [options.buttonStyle=false] - Whether the choices should be styles as a clickable button with color and hover transition, instead of just changed cursor
 * @param {boolean} [options.closeDrawer=false] - Whether the drawer should be closed and focus removed after the choice item was clicked
 * @param {boolean} [options.openDrawer=false] - Whether the drawer should be opened, even if this click would normally close it
 */
export function select2ChoiceClickSubscribe(control, action, { buttonStyle = false, closeDrawer = false, openDrawer = false } = {}) {
    // Add class for styling (hover color, changed cursor, etc)
    control.addClass('select2_choice_clickable');
    if (buttonStyle) control.addClass('select2_choice_clickable_buttonstyle');

    // Get the real container below and create a click handler on that one
    const select2Container = control.next('span.select2-container');
    select2Container.on('click', function (event) {
        const isChoice = isSelect2ChoiceElement(event.target);
        if (isChoice) {
            event.preventDefault();

            // select2 still bubbles the event to open the dropdown. So we close it here and remove focus if we want that
            if (closeDrawer) {
                control.select2('close');
                setTimeout(() => select2Container.find('textarea').trigger('blur'), debounce_timeout.quick);
            }
            if (openDrawer) {
                control.select2('open');
            }

            // Now execute the actual action that was subscribed
            action(event.target);
        }
    });
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
 * Confirms if the user wants to overwrite an existing data object (like character, world info, etc) if one exists.
 * If no data with the name exists, this simply returns true.
 *
 * @param {string} type - The type of the check ("World Info", "Character", etc)
 * @param {string[]} existingNames - The list of existing names to check against
 * @param {string} name - The new name
 * @param {object} options - Optional parameters
 * @param {boolean} [options.interactive=false] - Whether to show a confirmation dialog when needing to overwrite an existing data object
 * @param {string} [options.actionName='overwrite'] - The action name to display in the confirmation dialog
 * @param {(existingName:string)=>void} [options.deleteAction=null] - Optional action to execute wen deleting an existing data object on overwrite
 * @returns {Promise<boolean>} True if the user confirmed the overwrite or there is no overwrite needed, false otherwise
 */
export async function checkOverwriteExistingData(type, existingNames, name, { interactive = false, actionName = 'Overwrite', deleteAction = null } = {}) {
    const existing = existingNames.find(x => equalsIgnoreCaseAndAccents(x, name));
    if (!existing) {
        return true;
    }

    const overwrite = interactive && await Popup.show.confirm(`${type} ${actionName}`, `<p>A ${type.toLowerCase()} with the same name already exists:<br />${existing}</p>Do you want to overwrite it?`);
    if (!overwrite) {
        toastr.warning(`${type} ${actionName.toLowerCase()} cancelled. A ${type.toLowerCase()} with the same name already exists:<br />${existing}`, `${type} ${actionName}`, { escapeHtml: false });
        return false;
    }

    toastr.info(`Overwriting Existing ${type}:<br />${existing}`, `${type} ${actionName}`, { escapeHtml: false });

    // If there is an action to delete the existing data, do it, as the name might be slightly different so file name would not be the same
    if (deleteAction) {
        deleteAction(existing);
    }

    return true;
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
 * Toggles the visibility of a drawer by changing the display style of its content.
 * This function skips the usual drawer animation.
 *
 * @param {HTMLElement} drawer - The drawer element to toggle
 * @param {boolean} [expand=true] - Whether to expand or collapse the drawer
 */
export function toggleDrawer(drawer, expand = true) {
    /** @type {HTMLElement} */
    const icon = drawer.querySelector('.inline-drawer-icon');
    /** @type {HTMLElement} */
    const content = drawer.querySelector('.inline-drawer-content');

    if (expand) {
        icon.classList.remove('up', 'fa-circle-chevron-up');
        icon.classList.add('down', 'fa-circle-chevron-down');
        content.style.display = 'block';
    } else {
        icon.classList.remove('down', 'fa-circle-chevron-down');
        icon.classList.add('up', 'fa-circle-chevron-up');
        content.style.display = 'none';
    }

    // Set the height of "autoSetHeight" textareas within the inline-drawer to their scroll height
    if (!CSS.supports('field-sizing', 'content')) {
        content.querySelectorAll('textarea.autoSetHeight').forEach(resetScrollHeight);
    }
}

export async function fetchFaFile(name) {
    const style = document.createElement('style');
    style.innerHTML = await (await fetch(`/css/${name}`)).text();
    document.head.append(style);
    const sheet = style.sheet;
    style.remove();
    return [...sheet.cssRules]
        .filter(rule => rule.style?.content)
        .map(rule => rule.selectorText.split(/,\s*/).map(selector => selector.split('::').shift().slice(1)))
    ;
}
export async function fetchFa() {
    return [...new Set((await Promise.all([
        fetchFaFile('fontawesome.min.css'),
    ])).flat())];
}
/**
 * Opens a popup with all the available Font Awesome icons and returns the selected icon's name.
 * @prop {string[]} customList A custom list of Font Awesome icons to use instead of all available icons.
 * @returns {Promise<string>} The icon name (fa-pencil) or null if cancelled.
 */
export async function showFontAwesomePicker(customList = null) {
    const faList = customList ?? await fetchFa();
    const fas = {};
    const dom = document.createElement('div'); {
        dom.classList.add('faPicker-container');
        const search = document.createElement('div'); {
            search.classList.add('faQuery-container');
            const qry = document.createElement('input'); {
                qry.classList.add('text_pole');
                qry.classList.add('faQuery');
                qry.type = 'search';
                qry.placeholder = 'Filter icons';
                qry.autofocus = true;
                const qryDebounced = debounce(() => {
                    const result = faList.filter(fa => fa.find(className => className.includes(qry.value.toLowerCase())));
                    for (const fa of faList) {
                        if (!result.includes(fa)) {
                            fas[fa].classList.add('hidden');
                        } else {
                            fas[fa].classList.remove('hidden');
                        }
                    }
                });
                qry.addEventListener('input', () => qryDebounced());
                search.append(qry);
            }
            dom.append(search);
        }
        const grid = document.createElement('div'); {
            grid.classList.add('faPicker');
            for (const fa of faList) {
                const opt = document.createElement('div'); {
                    fas[fa] = opt;
                    opt.classList.add('menu_button');
                    opt.classList.add('fa-solid');
                    opt.classList.add(fa[0]);
                    opt.title = fa.map(it => it.slice(3)).join(', ');
                    opt.dataset.result = POPUP_RESULT.AFFIRMATIVE.toString();
                    opt.addEventListener('click', () => value = fa[0]);
                    grid.append(opt);
                }
            }
            dom.append(grid);
        }
    }
    let value = '';
    const picker = new Popup(dom, POPUP_TYPE.TEXT, null, { allowVerticalScrolling: true, okButton: 'No Icon', cancelButton: 'Cancel' });
    await picker.show();
    if (picker.result == POPUP_RESULT.AFFIRMATIVE) {
        return value;
    }
    return null;
}
