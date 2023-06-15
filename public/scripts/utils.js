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
    // Unix time (legacy TAI)
    if (typeof timestamp === 'number') {
        return moment(timestamp);
    }

    // ST "humanized" format pattern
    const pattern = /(\d{4})-(\d{1,2})-(\d{1,2}) @(\d{1,2})h (\d{1,2})m (\d{1,2})s (\d{1,3})ms/;
    const replacement = (match, year, month, day, hour, minute, second, millisecond) => {
        return `${year.padStart(4, "0")}-${month.padStart(2, "0")}-${day.padStart(2, "0")}T${hour.padStart(2, "0")}:${minute.padStart(2, "0")}:${second.padStart(2, "0")}.${millisecond.padStart(3, "0")}Z`;
    };
    const isoTimestamp = timestamp.replace(pattern, replacement);
    return moment(isoTimestamp);
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

export function getCharaFilename() {
    const context = getContext();
    const fileName = context.characters[context.characterId].avatar;

    if (fileName) {
        return fileName.replace(/\.[^/.]+$/, "")
    }
}

export function escapeRegex(string) {
    return string.replace(/[/\-\\^$*+?.()|[\]{}]/g, '\\$&');
}
