import { getContext } from "./extensions.js";

export function onlyUnique(value, index, array) {
    return array.indexOf(value) === index;
}

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

export function download(content, fileName, contentType) {
    const a = document.createElement("a");
    const file = new Blob([content], { type: contentType });
    a.href = URL.createObjectURL(file);
    a.download = fileName;
    a.click();
}

export async function urlContentToDataUri(url, params) {
    const response = await fetch(url, params);
    const blob = await response.blob();
    return await new Promise(callback => {
        let reader = new FileReader();
        reader.onload = function () { callback(this.result); };
        reader.readAsDataURL(blob);
    });
}

export function getFileText(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsText(file);
        reader.onload = function () {
            resolve(reader.result);
        };
        reader.onerror = function (error) {
            reject(error);
        };
    });
}

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

export function getBase64Async(file) {
    return new Promise((resolve, reject) => {
        const reader = new FileReader();
        reader.readAsDataURL(file);
        reader.onload = function () {
            resolve(reader.result);
        };
        reader.onerror = function (error) {
            reject(error);
        };
    });
}

export async function parseJsonFile(file) {
    return new Promise((resolve, reject) => {
        const fileReader = new FileReader();
        fileReader.onload = event => resolve(JSON.parse(event.target.result));
        fileReader.onerror = error => reject(error);
        fileReader.readAsText(file);
    });
}

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
};

export function debounce(func, timeout = 300) {
    let timer;
    return (...args) => {
        clearTimeout(timer);
        timer = setTimeout(() => { func.apply(this, args); }, timeout);
    };
}

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

export function isElementInViewport(el) {
    if (typeof jQuery === "function" && el instanceof jQuery) {
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

export function getUniqueName(name, exists) {
    let i = 1;
    let baseName = name;
    while (exists(name)) {
        name = `${baseName} (${i})`;
        i++;
    }
    return name;
}

export const delay = (ms) => new Promise((res) => setTimeout(res, ms));
export const isSubsetOf = (a, b) => (Array.isArray(a) && Array.isArray(b)) ? b.every(val => a.includes(val)) : false;

export function incrementString(str) {
    // Find the trailing number or it will match the empty string
    const count = str.match(/\d*$/);

    // Take the substring up until where the integer was matched
    // Concatenate it to the matched count incremented by 1
    return str.substr(0, count.index) + (++count[0]);
};

export function stringFormat(format) {
    const args = Array.prototype.slice.call(arguments, 1);
    return format.replace(/{(\d+)}/g, function (match, number) {
        return typeof args[number] != 'undefined'
            ? args[number]
            : match
            ;
    });
};

// Save the caret position in a contenteditable element
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
        end: range.endOffset
    };

    console.debug('Caret saved', position);

    return position;
}

// Restore the caret position in a contenteditable element
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

export async function initScrollHeight(element) {
    await delay(1);

    const curHeight = Number($(element).css("height").replace('px', ''));
    const curScrollHeight = Number($(element).prop("scrollHeight"));
    const diff = curScrollHeight - curHeight;

    if (diff < 3) { return } //happens when the div isn't loaded yet

    const newHeight = curHeight + diff + 3; //the +3 here is to account for padding/line-height on text inputs
    //console.log(`init height to ${newHeight}`);
    $(element).css("height", "");
    $(element).css("height", `${newHeight}px`);
    //resetScrollHeight(element);
}

export function sortByCssOrder(a, b) {
    const _a = Number($(a).css('order'));
    const _b = Number($(b).css('order'));
    return _a - _b;
}

export function end_trim_to_sentence(input, include_newline = false) {
    // inspired from https://github.com/kaihordewebui/kaihordewebui.github.io/blob/06b95e6b7720eb85177fbaf1a7f52955d7cdbc02/index.html#L4853-L4867

    const punctuation = new Set(['.', '!', '?', '*', '"', ')', '}', '`', ']', '$', '。', '！', '？', '”', '）', '】', '】', '’', '」', '】']); // extend this as you see fit
    let last = -1;

    for (let i = input.length - 1; i >= 0; i--) {
        const char = input[i];

        if (punctuation.has(char)) {
            last = i;
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

export function countOccurrences(string, character) {
    let count = 0;

    for (let i = 0; i < string.length; i++) {
        if (string[i] === character) {
            count++;
        }
    }

    return count;
}

export function isOdd(number) {
    return number % 2 !== 0;
}

export function timestampToMoment(timestamp) {
    if (!timestamp) {
        return moment.invalid();
    }

    // Unix time (legacy TAI)
    if (typeof timestamp === 'number') {
        return moment(timestamp);
    }

    // ST "humanized" format pattern
    const pattern1 = /(\d{4})-(\d{1,2})-(\d{1,2}) @(\d{1,2})h (\d{1,2})m (\d{1,2})s (\d{1,3})ms/;
    const replacement1 = (match, year, month, day, hour, minute, second, millisecond) => {
        return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:${second.padStart(2, "0")}.${millisecond.padStart(3, "0")}Z`;
    };
    const isoTimestamp1 = timestamp.replace(pattern1, replacement1);
    if (moment(isoTimestamp1).isValid()) {
        return moment(isoTimestamp1);
    }

    // New format pattern: "June 19, 2023 4:13pm"
    const pattern2 = /(\w+)\s(\d{1,2}),\s(\d{4})\s(\d{1,2}):(\d{1,2})(am|pm)/i;
    const replacement2 = (match, month, day, year, hour, minute, meridiem) => {
        const monthNum = moment().month(month).format("MM");
        const hour24 = meridiem.toLowerCase() === 'pm' ? (parseInt(hour, 10) % 12) + 12 : parseInt(hour, 10) % 12;
        return `${year}-${monthNum}-${day.padStart(2, "0")}T${hour24.toString().padStart(2, "0")}:${minute.padStart(2, "0")}:00`;
    };
    const isoTimestamp2 = timestamp.replace(pattern2, replacement2);
    if (moment(isoTimestamp2).isValid()) {
        return moment(isoTimestamp2);
    }

    // If none of the patterns match, return an invalid moment object
    return moment.invalid();
}

export function sortMoments(a, b) {
    if (a.isBefore(b)) {
        return 1;
    } else if (a.isAfter(b)) {
        return -1;
    } else {
        return 0;
    }
}

/** Split string to parts no more than length in size */
export function splitRecursive(input, length, delimitiers = ['\n\n', '\n', ' ', '']) {
    const delim = delimitiers[0] ?? '';
    const parts = input.split(delim);

    const flatParts = parts.flatMap(p => {
        if (p.length < length) return p;
        return splitRecursive(input, length, delimitiers.slice(1));
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

export class IndexedDBStore {
    constructor(dbName, storeName) {
        this.dbName = dbName;
        this.storeName = storeName;
        this.db = null;
    }

    async open() {
        return new Promise((resolve, reject) => {
            const request = indexedDB.open(this.dbName);

            request.onupgradeneeded = (event) => {
                const db = event.target.result;
                db.createObjectStore(this.storeName, { keyPath: null, autoIncrement: false });
            };

            request.onsuccess = (event) => {
                console.debug(`IndexedDBStore.open(${this.dbName})`);
                this.db = event.target.result;
                resolve(this.db);
            };

            request.onerror = (event) => {
                console.error(`IndexedDBStore.open(${this.dbName})`);
                reject(event.target.error);
            };
        });
    }

    async get(key) {
        if (!this.db) await this.open();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(this.storeName, "readonly");
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.get(key);

            request.onsuccess = (event) => {
                console.debug(`IndexedDBStore.get(${key})`);
                resolve(event.target.result);
            };

            request.onerror = (event) => {
                console.error(`IndexedDBStore.get(${key})`);
                reject(event.target.error);
            };
        });
    }

    async put(key, object) {
        if (!this.db) await this.open();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(this.storeName, "readwrite");
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.put(object, key);

            request.onsuccess = (event) => {
                console.debug(`IndexedDBStore.put(${key})`);
                resolve(event.target.result);
            };

            request.onerror = (event) => {
                console.error(`IndexedDBStore.put(${key})`);
                reject(event.target.error);
            };
        });
    }

    async delete(key) {
        if (!this.db) await this.open();

        return new Promise((resolve, reject) => {
            const transaction = this.db.transaction(this.storeName, "readwrite");
            const objectStore = transaction.objectStore(this.storeName);
            const request = objectStore.delete(key);

            request.onsuccess = (event) => {
                console.debug(`IndexedDBStore.delete(${key})`);
                resolve(event.target.result);
            };

            request.onerror = (event) => {
                console.error(`IndexedDBStore.delete(${key})`);
                reject(event.target.error);
            };
        });
    }
}

export function isDataURL(str) {
    const regex = /^data:([a-z]+\/[a-z0-9-+.]+(;[a-z-]+=[a-z0-9-]+)*;?)?(base64)?,([a-z0-9!$&',()*+;=\-_%.~:@\/?#]+)?$/i;
    return regex.test(str);
}

export function getCharaFilename(chid) {
    const context = getContext();
    const fileName = context.characters[chid ?? context.characterId].avatar;

    if (fileName) {
        return fileName.replace(/\.[^/.]+$/, "")
    }
}

export function escapeRegex(string) {
    return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}

export class RateLimiter {
    constructor(intervalMillis) {
        this._intervalMillis = intervalMillis;
        this._lastResolveTime = 0;
        this._pendingResolve = Promise.resolve();
    }

    _waitRemainingTime(abortSignal) {
        const currentTime = Date.now();
        const elapsedTime = currentTime - this._lastResolveTime;
        const remainingTime = Math.max(0, this._intervalMillis - elapsedTime);

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

    async waitForResolve(abortSignal) {
        await this._pendingResolve;
        this._pendingResolve = this._waitRemainingTime(abortSignal);

        // Update the last resolve time
        this._lastResolveTime = Date.now() + this._intervalMillis;
        console.debug(`RateLimiter.waitForResolve() ${this._lastResolveTime}`);
    }
}

// Taken from https://github.com/LostRuins/lite.koboldai.net/blob/main/index.html
//import tavern png data. adapted from png-chunks-extract under MIT license
//accepts png input data, and returns the extracted JSON
export function extractDataFromPng(data, identifier = 'chara') {
    console.log("Attempting PNG import...");
    let uint8 = new Uint8Array(4);
    let uint32 = new Uint32Array(uint8.buffer);

    //check if png header is valid
    if (!data || data[0] !== 0x89 || data[1] !== 0x50 || data[2] !== 0x4E || data[3] !== 0x47 || data[4] !== 0x0D || data[5] !== 0x0A || data[6] !== 0x1A || data[7] !== 0x0A) {
        console.log("PNG header invalid")
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
                data: new Uint8Array(0)
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
            data: chunkData
        });
    }

    if (!ended) {
        console.log('.png file ended prematurely: no IEND header was found');
    }

    //find the chunk with the chara name, just check first and last letter
    let found = chunks.filter(x => (
        x.name == "tEXt"
        && x.data.length > identifier.length
        && x.data.slice(0, identifier.length).every((v, i) => String.fromCharCode(v) == identifier[i])));

    if (found.length == 0) {
        console.log('PNG Image contains no data');
        return null;
    } else {
        try {
            let b64buf = "";
            let bytes = found[0].data; //skip the chara
            for (let i = identifier.length + 1; i < bytes.length; i++) {
                b64buf += String.fromCharCode(bytes[i]);
            }
            let decoded = JSON.parse(atob(b64buf));
            console.log(decoded);
            return decoded;
        } catch (e) {
            console.log("Error decoding b64 in image: " + e);
            return null;
        }
    }
}

export function createThumbnail(dataUrl, maxWidth, maxHeight) {
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
            const thumbnailDataUrl = canvas.toDataURL('image/jpeg');
            resolve(thumbnailDataUrl);
        };

        img.onerror = () => {
            reject(new Error('Failed to load the image.'));
        };
    });
}

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

export function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function deepClone(obj) {
    return JSON.parse(JSON.stringify(obj));
}
