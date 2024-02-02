import { getContext } from './extensions.js';
import { getRequestHeaders } from '../script.js';
import { isMobile } from './RossAscends-mods.js';
import { collapseNewlines } from './power-user.js';

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
 * Creates a debounced function that delays invoking func until after wait milliseconds have elapsed since the last time the debounced function was invoked.
 * @param {function} func The function to debounce.
 * @param {number} [timeout=300] The timeout in milliseconds.
 * @returns {function} The debounced function.
 */
export function debounce(func, timeout = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
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
 * Checks if an element is in the viewport.
 * @param {Element} el The element to check.
 * @returns {boolean} True if the element is in the viewport, false otherwise.
 */
export function isElementInViewport(el) {
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
 * @param {boolean} include_newline Whether to include a newline character in the trimmed string.
 * @returns {string} The trimmed string.
 * @example
 * trimToEndSentence('Hello, world! I am from'); // 'Hello, world!'
 */
export function trimToEndSentence(input, include_newline = false) {
    const punctuation = new Set(['.', '!', '?', '*', '"', ')', '}', '`', ']', '$', '。', '！', '？', '”', '）', '】', '’', '」']); // extend this as you see fit
    let last = -1;

    for (let i = input.length - 1; i >= 0; i--) {
        const char = input[i];

        if (punctuation.has(char)) {
            if (i > 0 && /[\s\n]/.test(input[i - 1])) {
                last = i - 1;
            } else {
                last = i;
            }
            break;
        }

        if (include_newline && char === '\n') {
            last = i;
            break;
        }
    }

    if (last === -1) {
        return input.trimEnd();
    }

    return input.substring(0, last + 1).trimEnd();
}

export function trimToStartSentence(input) {
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

export function timestampToMoment(timestamp) {
    if (!timestamp) {
        return moment.invalid();
    }

    // Unix time (legacy TAI / tags)
    if (typeof timestamp === 'number') {
        return moment(timestamp);
    }

    // ST "humanized" format pattern
    const pattern1 = /(\d{4})-(\d{1,2})-(\d{1,2}) @(\d{1,2})h (\d{1,2})m (\d{1,2})s (\d{1,3})ms/;
    const replacement1 = (match, year, month, day, hour, minute, second, millisecond) => {
        return `${year.padStart(4, '0')}-${month.padStart(2, '0')}-${day.padStart(2, '0')}T${hour.padStart(2, '0')}:${minute.padStart(2, '0')}:${second.padStart(2, '0')}.${millisecond.padStart(3, '0')}Z`;
    };
    const isoTimestamp1 = timestamp.replace(pattern1, replacement1);
    if (moment(isoTimestamp1).isValid()) {
        return moment(isoTimestamp1);
    }

    // New format pattern: "June 19, 2023 4:13pm"
    const pattern2 = /(\w+)\s(\d{1,2}),\s(\d{4})\s(\d{1,2}):(\d{1,2})(am|pm)/i;
    const replacement2 = (match, month, day, year, hour, minute, meridiem) => {
        const monthNum = moment().month(month).format('MM');
        const hour24 = meridiem.toLowerCase() === 'pm' ? (parseInt(hour, 10) % 12) + 12 : parseInt(hour, 10) % 12;
        return `${year}-${monthNum}-${day.padStart(2, '0')}T${hour24.toString().padStart(2, '0')}:${minute.padStart(2, '0')}:00`;
    };
    const isoTimestamp2 = timestamp.replace(pattern2, replacement2);
    if (moment(isoTimestamp2).isValid()) {
        return moment(isoTimestamp2);
    }

    // If none of the patterns match, return an invalid moment object
    return moment.invalid();
}

/**
 * Compare two moment objects for sorting.
 * @param {*} a The first moment object.
 * @param {*} b The second moment object.
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
    const delim = delimiters[0] ?? '';
    const parts = input.split(delim);

    const flatParts = parts.flatMap(p => {
        if (p.length < length) return p;
        return splitRecursive(input, length, delimiters.slice(1));
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

export function getCharaFilename(chid) {
    const context = getContext();
    const fileName = context.characters[chid ?? context.characterId].avatar;

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
        filename: filename,
    };

    // Send the data URL to your backend using fetch
    const response = await fetch('/uploadimage', {
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
 * Creates a thumbnail from a data URL.
 * @param {string} dataUrl The data URL encoded data of the image.
 * @param {number} maxWidth The maximum width of the thumbnail.
 * @param {number} maxHeight The maximum height of the thumbnail.
 * @param {string} [type='image/jpeg'] The type of the thumbnail.
 * @returns {Promise<string>} A promise that resolves to the thumbnail data URL.
 */
export function createThumbnail(dataUrl, maxWidth, maxHeight, type = 'image/jpeg') {
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
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function postProcessText(text) {
    // Collapse multiple newlines into one
    text = collapseNewlines(text);
    // Trim leading and trailing whitespace, and remove empty lines
    text = text.split('\n').map(l => l.trim()).filter(Boolean).join('\n');
    // Remove carriage returns
    text = text.replace(/\r/g, '');
    // Normalize unicode spaces
    text = text.replace(/\u00A0/g, ' ');
    // Collapse multiple spaces into one (except for newlines)
    text = text.replace(/ {2,}/g, ' ');
    // Remove leading and trailing spaces
    text = text.trim();
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
    const elements = document.querySelectorAll(textSelector);
    const rawText = Array.from(elements).map(e => e.textContent).join('\n');
    const text = postProcessText(rawText);
    return text;
}

/**
 * Use showdown to load and parse text from Markdown
 * @param {Blob} blob Markdown content blob
 * @returns {Promise<string>} A promise that resolves to the parsed text.
 */
export async function extractTextFromMarkdown(blob) {
    const markdown = await blob.text();
    const converter = new showdown.Converter();
    const html = converter.makeHtml(markdown);
    const domParser = new DOMParser();
    const document = domParser.parseFromString(DOMPurify.sanitize(html), 'text/html');
    const text = postProcessText(document.body.textContent);
    return text;
}
