/**
 * Utility functions that depend on the SillyTavern application state, the DOM,
 * or third-party libraries.
 *
 * Pure functions with no such dependencies live in utils-pure.js and are re-exported
 * from here for backwards compatibility. New pure functions should be added to
 * utils-pure.js instead, where they can be unit tested in a plain Node.js
 * environment without any mocks or shims.
 */
import {
    moment,
    DOMPurify,
    Readability,
    isProbablyReaderable,
    lodash,
} from '../lib.js';

import { getContext } from './extensions.js';
import { animation_duration, characters, getRequestHeaders, processDroppedFiles, this_chid, user_avatar } from '../script.js';
import { isMobile } from './RossAscends-mods.js';
import { collapseNewlines, power_user } from './power-user.js';
import { debounce_timeout } from './constants.js';
import { Popup, POPUP_RESULT, POPUP_TYPE } from './popup.js';
import { SlashCommandClosure } from './slash-commands/SlashCommandClosure.js';
import { getTagsList } from './tags.js';
import { groups, selected_group } from './group-chats.js';
import { getCurrentLocale, t } from './i18n.js';
import { importWorldInfo } from './world-info.js';

import {
    calculateThumbnailSize,
    compareIgnoreCaseAndAccents,
    debounce,
    delay,
    equalsIgnoreCaseAndAccents,
    escapeHtml,
    getStringHash,
    includesIgnoreCaseAndAccents,
    isTrueBoolean,
    isValidUrl,
} from './utils-pure.js';

// Re-export pure functions for backwards compatibility with extensions.
export * from './utils-pure.js';

export const localizePagination = function (container) {
    container.find('[title="Next page"]').attr('title', t`Next page`);
    container.find('[title="Previous page"]').attr('title', t`Previous page`);
    container.find('[title="First page"]').attr('title', t`First page`);
    container.find('[title="Last page"]').attr('title', t`Last page`);
};

/**
 * Renders a dropdown for selecting page size in pagination.
 * @param {number} pageSize Page size
 * @param {number[]} sizeChangerOptions Array of page size options
 * @returns {string} The rendered dropdown element as a string
 */
export const renderPaginationDropdown = function (pageSize, sizeChangerOptions) {
    const sizeSelect = document.createElement('select');
    sizeSelect.classList.add('J-paginationjs-size-select');

    if (sizeChangerOptions.indexOf(pageSize) === -1) {
        sizeChangerOptions.unshift(pageSize);
        sizeChangerOptions.sort((a, b) => a - b);
    }

    for (let i = 0; i < sizeChangerOptions.length; i++) {
        const option = document.createElement('option');
        option.value = `${sizeChangerOptions[i]}`;
        option.textContent = `${sizeChangerOptions[i]} ${t`/ page`}`;
        if (sizeChangerOptions[i] === pageSize) {
            option.setAttribute('selected', 'selected');
        }
        sizeSelect.appendChild(option);
    }

    return sizeSelect.outerHTML;
};

export const paginationDropdownChangeHandler = function (event, size) {
    let dropdown = $(event?.originalEvent?.currentTarget || event.delegateTarget).find('select');
    dropdown.find('[selected]').removeAttr('selected');
    dropdown.find(`[value=${size}]`).attr('selected', '');
};

/**
 * Checks if a URL is external to the current domain.
 * @param {string} url URL to check
 * @returns {boolean} True if the URL is external, false otherwise
 */
export function isExternalUrl(url) {
    return (url.indexOf('://') > 0 || url.indexOf('//') === 0) && !url.startsWith(window.location.origin);
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
 * Copy text to clipboard. Use navigator.clipboard.writeText if available, otherwise use document.execCommand.
 * @param {string} text - The text to copy to the clipboard.
 * @returns {Promise<void>} A promise that resolves when the text has been copied to the clipboard.
 */
export function copyText(text) {
    if (navigator.clipboard) {
        return navigator.clipboard.writeText(text);
    }

    const parent = document.querySelector('dialog[open]:last-of-type') ?? document.body;
    const textArea = document.createElement('textarea');
    textArea.value = text;
    parent.appendChild(textArea);
    textArea.focus();
    textArea.select();
    document.execCommand('copy');
    parent.removeChild(textArea);
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
 * Trims leading and trailing whitespace from the input string based on a configuration setting.
 * @param {string} input - The string to be trimmed
 * @returns {string} The trimmed string if trimming is enabled; otherwise, returns the original string
 */

export function trimSpaces(input) {
    if (!input || typeof input !== 'string') {
        return input;
    }
    return power_user.trim_spaces ? input.trim() : input;
}

const dateCache = new Map();

/**
 * Cached version of moment() to avoid re-parsing the same date strings.
 * Important: Moment objects are mutable, so use clone() before modifying them!
 * @param {MessageTimestamp} timestamp String or number representing a date.
 * @returns {import('moment').Moment} Moment object
 */
export function timestampToMoment(timestamp) {
    if (dateCache.has(timestamp)) {
        return dateCache.get(timestamp);
    }

    const iso8601 = parseTimestamp(timestamp);
    const objMoment = iso8601 ? moment(iso8601).locale(getCurrentLocale()) : moment.invalid();

    dateCache.set(timestamp, objMoment);
    return objMoment;
}

/**
 * Parses a timestamp and returns a moment object representing the parsed date and time.
 * @param {MessageTimestamp} timestamp - The timestamp to parse. It can be a string or a number.
 * @returns {string} - If the timestamp is valid, returns an ISO 8601 string.
 */
function parseTimestamp(timestamp) {
    if (!timestamp) return;

    // Date object
    if (timestamp instanceof Date) {
        return timestamp.toISOString();
    }

    // Unix time (legacy TAI / tags)
    if (typeof timestamp === 'number' || /^\d+$/.test(timestamp)) {
        const unixTime = Number(timestamp);
        const isValid = Number.isFinite(unixTime) && !Number.isNaN(unixTime) && unixTime >= 0;
        if (!isValid) return;
        return new Date(unixTime).toISOString();
    }

    // ISO 8601
    if (moment(timestamp, moment.ISO_8601, true).isValid()) {
        return timestamp;
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
    // 2024-07-12@01h31m37s123ms
    dtFmt.push({ callback: convertFromHumanized, pattern: /(\d{4})-(\d{1,2})-(\d{1,2})@(\d{1,2})h(\d{1,2})m(\d{1,2})s(\d{1,3})ms/ });
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

/**
 * Gets the duration of a video from a data URL.
 * @param {string} dataUrl Video data URL
 * @returns {Promise<number>} Duration in seconds
 */
export function getVideoDurationFromDataURL(dataUrl) {
    const video = document.createElement('video');
    video.src = dataUrl;
    return new Promise((resolve, reject) => {
        video.onloadedmetadata = function () {
            resolve(video.duration);
        };
        video.onerror = function () {
            reject(new Error('Failed to load video'));
        };
    });
}

/**
 * Gets a thumbnail image from a video URL.
 * @param {string} videoUrl URL of the video
 * @param {number|null} [maxWidth=null] Maximum width of the thumbnail
 * @param {number|null} [maxHeight=null] Maximum height of the thumbnail
 * @param {string} [type='image/jpeg'] MIME type of the thumbnail
 * @returns {Promise<string>} Promise that resolves to a data URL of the video thumbnail
 */
export function getVideoThumbnail(videoUrl, maxWidth = null, maxHeight = null, type = 'image/jpeg') {
    const video = document.createElement('video');
    video.src = videoUrl;
    return new Promise((resolve, reject) => {
        video.onloadeddata = function () {
            // Set the time to capture the thumbnail at the middle of the video
            video.currentTime = video.duration / 2;
        };
        video.onseeked = function () {
            // Create a canvas to draw the thumbnail
            const canvas = document.createElement('canvas');
            const ctx = canvas.getContext('2d');
            const { thumbnailWidth, thumbnailHeight } = calculateThumbnailSize(video.videoWidth, video.videoHeight, maxWidth, maxHeight);

            canvas.width = thumbnailWidth;
            canvas.height = thumbnailHeight;
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.fillStyle = 'black';
            ctx.fillRect(0, 0, thumbnailWidth, thumbnailHeight);
            ctx.drawImage(video, 0, 0, thumbnailWidth, thumbnailHeight);
            // Get the data URL of the thumbnail
            const dataUrl = canvas.toDataURL(type);
            resolve(dataUrl);
        };
        video.onerror = function () {
            reject(new Error('Failed to load video'));
        };
    });
}

/**
 * Gets the duration of an audio from a data URL.
 * @param {string} dataUrl Audio data URL
 * @returns {Promise<number>} Duration in seconds
 */
export function getAudioDurationFromDataURL(dataUrl) {
    const audio = document.createElement('audio');
    audio.src = dataUrl;
    return new Promise((resolve, reject) => {
        audio.onloadedmetadata = function () {
            resolve(audio.duration);
        };
        audio.onerror = function () {
            reject(new Error('Failed to load audio'));
        };
    });
}

/**
 * Gets the filename of the character avatar without extension
 * @param {string|number?} [chid=null] - Character ID. If not provided, uses the current character ID
 * @param {object} [options={}] - Options arguments
 * @param {string?} [options.manualAvatarKey=null] - Manually take the following avatar key, instead of using the chid to determine the name
 * @returns {string?} The filename of the character avatar without extension, or null if the character ID is invalid
 */
export function getCharaFilename(chid = null, { manualAvatarKey = null } = {}) {
    const context = getContext();
    const fileName = manualAvatarKey ?? context.characters[chid ?? context.characterId]?.avatar;

    return fileName?.replace(/\.[^/.]+$/, '') ?? null;
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
 * @param {string} subFolder - The character name to determine the sub-directory for saving.
 * @param {string} fileName - The name of the file to save the image as (without extension).
 * @param {string} extension - The file extension for the image (e.g., 'jpg', 'png', 'webp').
 *
 * @returns {Promise<string>} - Resolves to the saved image's path on the server.
 *                              Rejects with an error if the upload fails.
 */
export async function saveBase64AsFile(base64Data, subFolder, fileName, extension) {
    // Prepare the request body
    const requestBody = {
        image: base64Data,
        format: extension,
        ch_name: subFolder,
        filename: String(fileName).replace(/\./g, '_'),
    };

    // Send the data URL to your backend using fetch
    const response = await fetch('/api/images/upload', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(requestBody),
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
 * Converts UTF-8 string into Base64-encoded string.
 *
 * @param {string} text The UTF-8 string
 * @returns {string} The Base64-encoded string
 */
export function convertTextToBase64(text) {
    const encoder = new TextEncoder();
    const utf8Bytes = encoder.encode(text);
    /**
     * return `true` if `Uint8Array.prototype.toBase64` function is supported.
     * @see {@link https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Uint8Array/toBase64|MDN Reference}
     */
    if ('toBase64' in Uint8Array.prototype) {
        return utf8Bytes.toBase64();
    }
    // Creates binary string, where each character's code point directly matches the byte value (0-255).
    let binaryString = '';
    const chunkSize = 8192;
    for (let i = 0; i < utf8Bytes.length; i += chunkSize) {
        binaryString += String.fromCharCode(...utf8Bytes.subarray(i, i + chunkSize));
    }
    return window.btoa(binaryString);
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
 * Opens a file picker dialog for selecting an image.
 * @returns {Promise<string|null>} Base64 data URL of selected image, or null if cancelled
 */
export async function promptForAvatarFile() {
    return new Promise(resolve => {
        const input = document.createElement('input');
        input.type = 'file';
        input.accept = supportedImageMimeTypes.join(',');
        input.onchange = async (e) => {
            if (!(e.target instanceof HTMLInputElement)) {
                return '';
            }
            const file = e.target?.files?.[0];
            if (!file) {
                resolve(null);
                return;
            }
            try {
                const converted = await ensureImageFormatSupported(file);
                const base64 = await getBase64Async(converted);
                resolve(base64);
            } catch (error) {
                console.error('Error processing selected image:', error);
                toastr.error(t`Failed to process selected image: ${error.message}`);
                resolve(null);
            }
        };
        input.oncancel = () => resolve(null);
        input.click();
    });
}

/**
 * Resolves avatar data from various input formats (base64, local path, or prompt).
 * @param {string} input - "prompt" to open file picker, base64 data URL, or local file path
 * @returns {Promise<string|null>} Base64 data URL or null if invalid/cancelled
 */
export async function resolveAvatarData(input) {
    if (!input || typeof input !== 'string') {
        return null;
    }

    const trimmed = input.trim();

    // Special value "prompt" opens file picker
    if (trimmed.toLowerCase() === 'prompt') {
        return await promptForAvatarFile();
    }

    // Already a base64 data URL
    if (trimmed.startsWith('data:image/')) {
        return trimmed;
    }

    // External URLs are not supported
    if (isExternalUrl(trimmed)) {
        toastr.warning(t`External URLs are not supported for avatars. Use a local file path or "prompt" to select a file.`);
        return null;
    }
    // Local path or URL (e.g., characters/name.png) - fetch from ST server or same origin
    // Supported paths: /characters/*, /backgrounds/*, /User Avatars/*, /assets/*, /user/images/*
    // Also supports same-origin URLs (e.g., https://localhost:8000/characters/name.png)
    if (trimmed.includes('/') || trimmed.endsWith('.png')) {
        try {
            // Construct the URL to fetch the local file
            let url = trimmed.startsWith('/') ? trimmed : `/${trimmed}`;
            // Handle same-origin URLs
            if (trimmed.startsWith(window.location.origin)) {
                url = new URL(trimmed).pathname;
            }
            // If there is no subfolder, we guess this should be a character image
            if (!url.includes('/', 1)) {
                url = '/characters/' + trimmed;
            }

            const response = await fetch(url);
            if (!response.ok) {
                throw new Error(`File not found or inaccessible: ${response.status}`);
            }
            const blob = await response.blob();
            if (!blob.type.startsWith('image/')) {
                throw new Error('File is not an image');
            }
            const converted = await ensureImageFormatSupported(new File([blob], 'avatar.png', { type: blob.type }));
            return await getBase64Async(converted);
        } catch (error) {
            console.error('Error fetching local avatar:', error);
            toastr.warning(t`Failed to load avatar from path: ${error.message}`);
            return null;
        }
    }

    // Unknown format
    console.warn('Unknown avatar format:', trimmed.substring(0, 50));
    toastr.warning(t`Unknown avatar format. Use "prompt" to select a file, or provide a local file path.`);
    return null;
}

/**
 *  An array of all supported image MIME types.
 */
export const supportedImageMimeTypes = Object.freeze([
    'image/jpeg',
    'image/png',
    'image/bmp',
    'image/tiff',
    'image/gif',
    'image/apng',
    'image/webp',
    'image/avif',
]);

/**
 * Ensure that we can import war crime image formats like WEBP and AVIF.
 * @param {File} file Input file
 * @returns {Promise<File>} A promise that resolves to the supported file.
 */
export async function ensureImageFormatSupported(file) {
    if (supportedImageMimeTypes.includes(file.type) || !file.type.startsWith('image/')) {
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
            const { thumbnailWidth, thumbnailHeight } = calculateThumbnailSize(img.width, img.height, maxWidth, maxHeight);

            // Set the canvas dimensions and draw the resized image
            canvas.width = thumbnailWidth;
            canvas.height = thumbnailHeight;
            ctx.imageSmoothingEnabled = true;
            ctx.imageSmoothingQuality = 'high';
            ctx.fillStyle = 'white';
            ctx.fillRect(0, 0, thumbnailWidth, thumbnailHeight);
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
    if (!('pdfjsLib' in window)) {
        await import('../lib/pdf.min.mjs');
        await import('../lib/pdf.worker.min.mjs');
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
    if (!('ePub' in window)) {
        await import('../lib/jszip.min.js');
        await import('../lib/epub.min.js');
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
                headers: getRequestHeaders({ omitContentType: true }),
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
 * The action will be executed after the animation ends or after the timeout, whichever comes first.
 * @param {HTMLElement} control - The control element to listen for animation end event
 * @param {(control:*?) => void} callback - The callback function to be executed when the animation ends
 * @param {number} [timeout=500] - The timeout in milliseconds to wait for the animation to end before executing the callback
 */
export function runAfterAnimation(control, callback, timeout = 500) {
    if (hasAnimation(control)) {
        Promise.race([
            new Promise((r) => setTimeout(r, timeout)), // Fallback timeout
            new Promise((r) => control.addEventListener('animationend', r, { once: true })),
        ]).finally(() => callback(control));
    } else {
        callback(control);
    }
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

    const overwrite = interactive && await Popup.show.confirm(`${type} ${actionName}`, `<p>A ${type.toLowerCase()} with the same name already exists:<br />${escapeHtml(existing)}</p>Do you want to overwrite it?`);
    if (!overwrite) {
        toastr.warning(`${type} ${actionName.toLowerCase()} cancelled. A ${type.toLowerCase()} with the same name already exists:<br />${escapeHtml(existing)}`, `${type} ${actionName}`, { escapeHtml: false });
        return false;
    }

    toastr.info(`Overwriting Existing ${type}:<br />${escapeHtml(existing)}`, `${type} ${actionName}`, { escapeHtml: false });

    // If there is an action to delete the existing data, do it, as the name might be slightly different so file name would not be the same
    if (deleteAction) {
        deleteAction(existing);
    }

    return true;
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
    const icon = drawer.querySelector(':scope > .inline-drawer-header .inline-drawer-icon');
    /** @type {HTMLElement} */
    const content = drawer.querySelector(':scope > .inline-drawer-content');

    if (!icon || !content) {
        console.debug('toggleDrawer: No icon or content found in the drawer element.');
        return;
    }

    if (expand) {
        icon.classList.remove('down', 'fa-circle-chevron-down');
        icon.classList.add('up', 'fa-circle-chevron-up');
        content.style.display = 'block';
    } else {
        icon.classList.remove('up', 'fa-circle-chevron-up');
        icon.classList.add('down', 'fa-circle-chevron-down');
        content.style.display = 'none';
    }

    drawer.dispatchEvent(new CustomEvent('inline-drawer-toggle', { bubbles: true }));

    // Set the height of "autoSetHeight" textareas within the inline-drawer to their scroll height
    if (!CSS.supports('field-sizing', 'content')) {
        content.querySelectorAll('textarea.autoSetHeight').forEach(resetScrollHeight);
    }
}

/**
 * Sets or removes a dataset property on an HTMLElement
 *
 * Utility function to make it easier to reset dataset properties on null, without them being "null" as value.
 *
 * @param {HTMLElement} element - The element to modify
 * @param {string} name - The name of the dataset property
 * @param {string|null} value - The value to set - If null, the dataset property will be removed
 */
export function setDatasetProperty(element, name, value) {
    if (value === null) {
        delete element.dataset[name];
    } else {
        element.dataset[name] = value;
    }
}

export async function fetchFaFile(name) {
    const style = document.createElement('style');
    style.innerHTML = await (await fetch(`/css/${name}`)).text();
    document.head.append(style);
    const sheet = style.sheet;
    style.remove();
    return [...sheet.cssRules]
        .filter(rule => (rule instanceof CSSStyleRule && rule.style?.content))
        .map(rule => rule['selectorText'].split(/,\s*/).map(selector => selector.split('::').shift().slice(1)))
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

/**
 * Finds a persona by name, with optional filtering and precedence for avatars
 * @param {object} [options={}] - The options for the search
 * @param {string?} [options.name=null] - The name to search for
 * @param {boolean} [options.allowAvatar=true] - Whether to allow searching by avatar
 * @param {boolean} [options.insensitive=true] - Whether the search should be case insensitive
 * @param {boolean} [options.preferCurrentPersona=true] - Whether to prefer the current persona(s)
 * @param {boolean} [options.quiet=false] - Whether to suppress warnings
 * @returns {PersonaViewModel} The persona object
 * @typedef {object} PersonaViewModel
 * @property {string} avatar - The avatar of the persona
 * @property {string} name - The name of the persona
 */
export function findPersona({ name = null, allowAvatar = true, insensitive = true, preferCurrentPersona = true, quiet = false } = {}) {
    /** @type {PersonaViewModel[]} */
    const personas = Object.entries(power_user.personas).map(([avatar, name]) => ({ avatar, name }));
    const matches = (/** @type {PersonaViewModel} */ persona) => !name || (allowAvatar && persona.avatar === name) || (insensitive ? equalsIgnoreCaseAndAccents(persona.name, name) : persona.name === name);

    // If we have a current persona and prefer it, return that if it matches
    const currentPersona = personas.find(a => a.avatar === user_avatar);
    if (preferCurrentPersona && currentPersona && matches(currentPersona)) {
        return currentPersona;
    }

    // If allowAvatar is true, search by avatar first
    if (allowAvatar && name) {
        const personaByAvatar = personas.find(a => a.avatar === name);
        if (personaByAvatar && matches(personaByAvatar)) {
            return personaByAvatar;
        }
    }

    // Search for matching personas by name
    const matchingPersonas = personas.filter(a => matches(a));
    if (matchingPersonas.length > 1) {
        if (!quiet) toastr.warning(t`Multiple personas found for given conditions.`);
        else console.warn(t`Multiple personas found for given conditions. Returning the first match.`);
    }

    return matchingPersonas[0] || null;
}

/**
 * Finds a character by name, with optional filtering and precedence for avatars
 * @param {object} [options={}] - The options for the search
 * @param {string?} [options.name=null] - The name to search for
 * @param {boolean} [options.allowAvatar=true] - Whether to allow searching by avatar
 * @param {boolean} [options.insensitive=true] - Whether the search should be case insensitive
 * @param {string[]?} [options.filteredByTags=null] - Tags to filter characters by
 * @param {boolean} [options.preferCurrentChar=true] - Whether to prefer the current character(s)
 * @param {boolean} [options.quiet=false] - Whether to suppress warnings
 * @returns {Character?} - The found character or null if not found
 */
export function findChar({ name = null, allowAvatar = true, insensitive = true, filteredByTags = null, preferCurrentChar = true, quiet = false } = {}) {
    const matches = (char) => !name || (allowAvatar && char.avatar === name) || (insensitive ? equalsIgnoreCaseAndAccents(char.name, name) : char.name === name);

    // Filter characters by tags if provided
    let filteredCharacters = characters;
    if (filteredByTags) {
        filteredCharacters = characters.filter(char => {
            const charTags = getTagsList(char.avatar, false);
            return filteredByTags.every(tagName => charTags.some(x => x.name == tagName));
        });
    }

    // Get the current character(s)
    /** @type {any[]} */
    const currentChars = selected_group ? groups.find(group => group.id === selected_group)?.members.map(member => filteredCharacters.find(char => char.avatar === member))
        : filteredCharacters.filter(char => characters[this_chid]?.avatar === char.avatar);

    // If we have a current char and prefer it, return that if it matches
    if (preferCurrentChar) {
        const preferredCharSearch = currentChars.filter(matches);
        if (preferredCharSearch.length > 1) {
            if (!quiet) toastr.warning(t`Multiple characters found for given conditions.`);
            else console.warn(t`Multiple characters found for given conditions. Returning the first match.`);
        }
        if (preferredCharSearch.length) {
            return preferredCharSearch[0];
        }
    }

    // If allowAvatar is true, search by avatar first
    if (allowAvatar && name) {
        const characterByAvatar = filteredCharacters.find(char => char.avatar === name || (!name.endsWith('.png') && char.avatar === `${name}.png`));
        if (characterByAvatar) {
            return characterByAvatar;
        }
    }

    // Search for matching characters by name
    const matchingCharacters = name ? filteredCharacters.filter(matches) : filteredCharacters;
    if (matchingCharacters.length > 1) {
        if (!quiet) toastr.warning('Multiple characters found for given conditions.');
        else console.warn('Multiple characters found for given conditions. Returning the first match.');
    }

    return matchingCharacters[0] || null;
}

/**
 * Gets the index of a character based on the character object
 * @param {object} char - The character object to find the index for
 * @throws {Error} If the character is not found
 * @returns {number} The index of the character in the characters array
 */
export function getCharIndex(char) {
    if (!char) throw new Error('Character is undefined');
    const index = characters.findIndex(c => c.avatar === char.avatar);
    if (index === -1) throw new Error(`Character not found: ${char.avatar}`);
    return index;
}

/**
 * Updates the content and style of an information block
 * @param {string | HTMLElement} target - The CSS selector or the HTML element of the information block
 * @param {string | HTMLElement?} content - The message to display inside the information block (supports HTML) or an HTML element
 * @param {'hint' | 'info' | 'warning' | 'error'} [type='info'] - The type of message, which determines the styling of the information block
 * @param {object} [options={}] - Optional settings
 * @param {boolean} [options.animate=true] - Whether to animate the block sliding in when first shown
 */
export function setInfoBlock(target, content, type = 'info', { animate = true } = {}) {
    if (!content) {
        clearInfoBlock(target);
        return;
    }

    const infoBlock = typeof target === 'string' ? document.querySelector(target) : target;
    if (!infoBlock) return;

    const wasVisible = infoBlock.classList.contains('info-block');

    if (!wasVisible && animate) {
        $(infoBlock).hide();
    }

    infoBlock.className = `info-block ${type}`;
    if (typeof content === 'string') {
        infoBlock.innerHTML = content;
    } else {
        infoBlock.innerHTML = '';
        infoBlock.appendChild(content);
    }

    if (!wasVisible && animate) {
        $(infoBlock).slideDown(animation_duration * 1.5);
    }
}

/**
 * Clears the content and style of an information block.
 * @param {string | HTMLElement} target - The CSS selector or the HTML element of the information block
 * @param {object} [options={}] - Optional settings
 * @param {boolean} [options.animate=true] - Whether to animate the block fading out before clearing
 */
export function clearInfoBlock(target, { animate = true } = {}) {
    const infoBlock = typeof target === 'string' ? document.querySelector(target) : target;
    if (!infoBlock || !infoBlock.classList.contains('info-block')) return;

    if (animate) {
        $(infoBlock).slideUp(animation_duration * 1.5, () => {
            infoBlock.className = '';
            infoBlock.innerHTML = '';
            $(infoBlock).css('display', '');
        });
    } else {
        infoBlock.className = '';
        infoBlock.innerHTML = '';
    }
}

/**
 * Provides a matcher function for select2 that matches both the text and value of options.
 * @param {import('select2').SearchOptions} params
 * @param {import('select2').OptGroupData|import('select2').OptionData} data
 * @return {import('select2').OptGroupData|import('select2').OptionData|null}
 */
export function textValueMatcher(params, data) {
    // Always return the object if there is nothing to compare
    if (params.term == null || params.term.trim() === '') {
        return data;
    }

    // Do a recursive check for options with children
    if (data.children && data.children.length > 0) {
        // Clone the data object if there are children
        // This is required as we modify the object to remove any non-matches
        const match = $.extend(true, {}, data);

        // Check each child of the option
        for (let c = data.children.length - 1; c >= 0; c--) {
            const child = data.children[c];

            const matches = textValueMatcher(params, child);

            // If there wasn't a match, remove the object in the array
            if (matches == null) {
                match.children.splice(c, 1);
            }
        }

        // If any children matched, return the new object
        if (match.children.length > 0) {
            return match;
        }

        // If there were no matching children, check just the plain object
        return textValueMatcher(params, match);
    }

    const textMatch = compareIgnoreCaseAndAccents(data.text, params.term, (a, b) => a.indexOf(b) > -1);
    const valueMatch = data.element instanceof HTMLOptionElement && compareIgnoreCaseAndAccents(data.element.value, params.term, (a, b) => a.indexOf(b) > -1);

    if (textMatch || valueMatch) {
        return data;
    }

    // If it doesn't contain the term, don't return anything
    return null;
}

/**
 * Sets up the scroll-to-top button functionality.
 * @param {object} params Parameters object
 * @param {string} params.scrollContainerId Scrollable container element ID
 * @param {string} params.buttonId Button element ID
 * @param {string} params.drawerId Drawer element ID
 * @param {number} [params.visibilityThreshold] Scroll position (px) to show the button (default: 300)
 * @returns {() => void} Cleanup function to remove event listeners
 */
export function setupScrollToTop({ scrollContainerId, buttonId, drawerId, visibilityThreshold = 300 }) {
    const scrollContainer = document.getElementById(scrollContainerId);
    const btn = document.getElementById(buttonId);
    const drawer = document.getElementById(drawerId);

    if (!btn || !drawer) {
        // Not fatal; the drawer or button may not exist in some builds. Use debug level.
        console.debug('Scroll-to-top: button or drawer not found during setup.');
        return () => { /* noop cleanup */ };
    }

    if (!scrollContainer) {
        console.debug('Scroll-to-top: scroll container not found during setup.');
        return () => { /* noop cleanup */ };
    }

    const updateButtonVisibility = () => btn.classList.toggle('visible', scrollContainer.scrollTop > visibilityThreshold);
    const updateButtonVisibilityThrottled = lodash.throttle(updateButtonVisibility, debounce_timeout.standard, { leading: true, trailing: true });
    const onScroll = () => updateButtonVisibilityThrottled();
    scrollContainer.addEventListener('scroll', onScroll, { passive: true });

    // Scroll to top on click (button semantics provide keyboard activation natively)
    const onActivate = (/** @type {MouseEvent} */ e) => {
        e.preventDefault();
        e.stopPropagation();

        const userPrefersReduced = power_user.reduced_motion;
        scrollContainer.scrollTo({ top: 0, behavior: userPrefersReduced ? 'auto' : 'smooth' });
    };
    btn.addEventListener('click', onActivate);

    let frameHandle = null;
    const resizeObserver = new ResizeObserver(() => {
        if (frameHandle !== null) {
            cancelAnimationFrame(frameHandle);
        }
        frameHandle = requestAnimationFrame(() => {
            updateButtonVisibilityThrottled();
        });
    });
    resizeObserver.observe(drawer);

    // Initial state check
    updateButtonVisibility();

    // Return cleanup function for caller to hold and invoke when appropriate
    return () => {
        scrollContainer.removeEventListener('scroll', onScroll);
        btn.removeEventListener('click', onActivate);
        resizeObserver.disconnect();
    };
}

/**
 * Imports content from an external URL.
 * @param {string} url URL or UUID of the content to import.
 * @param {Object} [options={}] Options object.
 * @param {string|null} [options.preserveFileName=null] Optional file name to use for the imported content.
 * @returns {Promise<void>} A promise that resolves when the import is complete.
 */
export async function importFromExternalUrl(url, { preserveFileName = null } = {}) {
    let request;

    if (isValidUrl(url)) {
        console.debug('Custom content import started for URL: ', url);
        request = await fetch('/api/content/importURL', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ url }),
        });
    } else {
        console.debug('Custom content import started for Char UUID: ', url);
        request = await fetch('/api/content/importUUID', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ url }),
        });
    }

    if (!request.ok) {
        toastr.info(request.statusText, 'Custom content import failed');
        console.error('Custom content import failed', request.status, request.statusText);
        return;
    }

    const data = await request.blob();
    const customContentType = request.headers.get('X-Custom-Content-Type');
    let fileName = request.headers.get('Content-Disposition').split('filename=')[1].replace(/"/g, '');
    const file = new File([data], fileName, { type: data.type });

    const extraData = new Map();
    if (preserveFileName) {
        fileName = preserveFileName;
        extraData.set(file, preserveFileName);
    }

    switch (customContentType) {
        case 'character':
            await processDroppedFiles([file], extraData);
            break;
        case 'lorebook':
            await importWorldInfo(file);
            break;
        default:
            toastr.warning('Unknown content type');
            console.error('Unknown content type', customContentType);
            break;
    }
}

/**
 * Shakes the targetElement.
 * @param {HTMLElement|JQuery<HTMLElement>} targetElement
 * @param {number} distance Distance in pixels.
 * @param {number} duration Duration in milliseconds.
 * @param {string} easing CSS easing function.
 */
export function shakeElement(targetElement, distance = 10, duration = 100, easing = 'ease-in-out') {
    // Don't call the JQuery animation.
    // https://developer.mozilla.org/en-US/docs/Web/API/Element/animate
    if (targetElement instanceof jQuery) targetElement = targetElement[0];

    return targetElement.animate([
        { transform: 'translateX(0)' },
        { transform: `translateX(${distance}px)` },
        { transform: 'translateX(0)' },
    ], { duration, easing });
}

/**
 * Registers a long-press (touch hold) event as an alternative to modifier+click.
 * Supports event delegation for dynamically created elements.
 * @param {string} selector CSS selector for target elements
 * @param {(e: TouchEvent) => void} callback Callback to invoke on long-press, `this` is the matched element
 * @param {number} [delay=500] Long-press duration in ms
 */
export function addLongPressEvent(selector, callback, delay = 500) {
    let timer = null;
    let fired = false;
    let target = null;

    document.addEventListener('touchstart', function (event) {
        if (!(event.target instanceof Element)) return;
        const el = event.target.closest(selector);
        if (!el) return;
        target = el;
        fired = false;
        timer = setTimeout(() => {
            fired = true;
            event.preventDefault();
            callback.call(el, event);
        }, delay);
    }, { passive: false });

    document.addEventListener('touchend', cancelTimer);
    document.addEventListener('touchmove', cancelTimer);
    document.addEventListener('touchcancel', cancelTimer);

    document.addEventListener('click', function (event) {
        if (fired && target && target.contains(event.target)) {
            event.preventDefault();
            event.stopImmediatePropagation();
            fired = false;
            target = null;
        }
    }, true);

    function cancelTimer() {
        clearTimeout(timer);
        timer = null;
    }
}
