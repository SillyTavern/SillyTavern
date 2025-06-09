import path from 'node:path';
import fs from 'node:fs';
import http2 from 'node:http2';
import process from 'node:process';
import { Readable } from 'node:stream';
import { createRequire } from 'node:module';
import { Buffer } from 'node:buffer';
import { promises as dnsPromise } from 'node:dns';
import os from 'node:os';
import crypto from 'node:crypto';

import yaml from 'yaml';
import { sync as commandExistsSync } from 'command-exists';
import _ from 'lodash';
import yauzl from 'yauzl';
import mime from 'mime-types';
import { default as simpleGit } from 'simple-git';
import chalk from 'chalk';
import bytes from 'bytes';
import { LOG_LEVELS } from './constants.js';
import { serverDirectory } from './server-directory.js';

/**
 * Parsed config object.
 */
let CACHED_CONFIG = null;
let CONFIG_PATH = null;

/**
 * Converts a configuration key to an environment variable key.
 * @param {string} key Configuration key
 * @returns {string} Environment variable key
 * @example keyToEnv('extensions.models.speechToText') // 'SILLYTAVERN_EXTENSIONS_MODELS_SPEECHTOTEXT'
 */
export const keyToEnv = (key) => 'SILLYTAVERN_' + String(key).toUpperCase().replace(/\./g, '_');

/**
 * Set the config file path.
 * @param {string} configFilePath Path to the config file
 */
export function setConfigFilePath(configFilePath) {
    if (CONFIG_PATH !== null) {
        console.error(color.red('Config file path already set. Please restart the server to change the config file path.'));
    }
    CONFIG_PATH = path.resolve(configFilePath);
}

/**
 * Returns the config object from the config.yaml file.
 * @returns {object} Config object
 */
export function getConfig() {
    if (CONFIG_PATH === null) {
        console.trace();
        console.error(color.red('No config file path set. Please set the config file path using setConfigFilePath().'));
        process.exit(1);
    }
    if (CACHED_CONFIG) {
        return CACHED_CONFIG;
    }
    if (!fs.existsSync(CONFIG_PATH)) {
        console.error(color.red('No config file found. Please create a config.yaml file. The default config file can be found in the /default folder.'));
        console.error(color.red('The program will now exit.'));
        process.exit(1);
    }

    try {
        const config = yaml.parse(fs.readFileSync(CONFIG_PATH, 'utf8'));
        CACHED_CONFIG = config;
        return config;
    } catch (error) {
        console.error(color.red('FATAL: Failed to read config.yaml. Please check the file for syntax errors.'));
        console.error(error.message);
        process.exit(1);
    }
}

/**
 * Returns the value for the given key from the config object.
 * @param {string} key - Key to get from the config object
 * @param {any} defaultValue - Default value to return if the key is not found
 * @param {'number'|'boolean'|null} typeConverter - Type to convert the value to
 * @returns {any} Value for the given key
 */
export function getConfigValue(key, defaultValue = null, typeConverter = null) {
    function _getValue() {
        const envKey = keyToEnv(key);
        if (envKey in process.env) {
            const needsJsonParse = defaultValue && typeof defaultValue === 'object';
            const envValue = process.env[envKey];
            return needsJsonParse ? (tryParse(envValue) ?? defaultValue) : envValue;
        }
        const config = getConfig();
        return _.get(config, key, defaultValue);
    }

    const value = _getValue();
    switch (typeConverter) {
        case 'number':
            return isNaN(parseFloat(value)) ? defaultValue : parseFloat(value);
        case 'boolean':
            return toBoolean(value);
        default:
            return value;
    }
}

/**
 * THIS FUNCTION IS DEPRECATED AND ONLY EXISTS FOR BACKWARDS COMPATIBILITY. DON'T USE IT.
 * @param {any} _key Unused
 * @param {any} _value Unused
 * @deprecated Configs are read-only. Use environment variables instead.
 */
export function setConfigValue(_key, _value) {
    console.trace(color.yellow('setConfigValue is deprecated and should not be used.'));
}

/**
 * Encodes the Basic Auth header value for the given user and password.
 * @param {string} auth username:password
 * @returns {string} Basic Auth header value
 */
export function getBasicAuthHeader(auth) {
    const encoded = Buffer.from(`${auth}`).toString('base64');
    return `Basic ${encoded}`;
}

/**
 * Returns the version of the running instance. Get the version from the package.json file and the git revision.
 * Also returns the agent string for the Horde API.
 * @returns {Promise<{agent: string, pkgVersion: string, gitRevision: string | null, gitBranch: string | null, commitDate: string | null, isLatest: boolean}>} Version info object
 */
export async function getVersion() {
    let pkgVersion = 'UNKNOWN';
    let gitRevision = null;
    let gitBranch = null;
    let commitDate = null;
    let isLatest = true;

    try {
        const require = createRequire(import.meta.url);
        const pkgJson = require(path.join(serverDirectory, './package.json'));
        pkgVersion = pkgJson.version;
        if (commandExistsSync('git')) {
            const git = simpleGit({ baseDir: serverDirectory });
            gitRevision = await git.revparse(['--short', 'HEAD']);
            gitBranch = await git.revparse(['--abbrev-ref', 'HEAD']);
            commitDate = await git.show(['-s', '--format=%ci', gitRevision]);

            const trackingBranch = await git.revparse(['--abbrev-ref', '@{u}']);

            // Might fail, but exception is caught. Just don't run anything relevant after in this block...
            const localLatest = await git.revparse(['HEAD']);
            const remoteLatest = await git.revparse([trackingBranch]);
            isLatest = localLatest === remoteLatest;
        }
    }
    catch {
        // suppress exception
    }

    const agent = `SillyTavern:${pkgVersion}:Cohee#1207`;
    return { agent, pkgVersion, gitRevision, gitBranch, commitDate: commitDate?.trim() ?? null, isLatest };
}

/**
 * Delays the current async function by the given amount of milliseconds.
 * @param {number} ms Milliseconds to wait
 * @returns {Promise<void>} Promise that resolves after the given amount of milliseconds
 */
export function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Generates a random hex string of the given length.
 * @param {number} length String length
 * @returns {string} Random hex string
 * @example getHexString(8) // 'a1b2c3d4'
 */
export function getHexString(length) {
    const chars = '0123456789abcdef';
    let result = '';
    for (let i = 0; i < length; i++) {
        result += chars[Math.floor(Math.random() * chars.length)];
    }
    return result;
}

/**
 * Formats a byte size into a human-readable string with units
 * @param {number} bytes - The size in bytes to format
 * @returns {string} The formatted string (e.g., "1.5 MB")
 */
export function formatBytes(bytes) {
    if (bytes === 0) return '0 B';

    const k = 1024;
    const sizes = ['B', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i];
}

/**
 * Extracts a file with given extension from an ArrayBuffer containing a ZIP archive.
 * @param {ArrayBufferLike} archiveBuffer Buffer containing a ZIP archive
 * @param {string} fileExtension File extension to look for
 * @returns {Promise<Buffer|null>} Buffer containing the extracted file. Null if the file was not found.
 */
export async function extractFileFromZipBuffer(archiveBuffer, fileExtension) {
    return await new Promise((resolve) => {
        try {
            yauzl.fromBuffer(Buffer.from(archiveBuffer), { lazyEntries: true }, (err, zipfile) => {
                if (err) {
                    console.warn(`Error opening ZIP file: ${err.message}`);
                    return resolve(null);
                }

                zipfile.readEntry();

                zipfile.on('entry', (entry) => {
                    if (entry.fileName.endsWith(fileExtension) && !entry.fileName.startsWith('__MACOSX')) {
                        console.info(`Extracting ${entry.fileName}`);
                        zipfile.openReadStream(entry, (err, readStream) => {
                            if (err) {
                                console.warn(`Error opening read stream: ${err.message}`);
                                return zipfile.readEntry();
                            } else {
                                const chunks = [];
                                readStream.on('data', (chunk) => {
                                    chunks.push(chunk);
                                });

                                readStream.on('end', () => {
                                    const buffer = Buffer.concat(chunks);
                                    resolve(buffer);
                                    zipfile.readEntry(); // Continue to the next entry
                                });

                                readStream.on('error', (err) => {
                                    console.warn(`Error reading stream: ${err.message}`);
                                    zipfile.readEntry();
                                });
                            }
                        });
                    } else {
                        zipfile.readEntry();
                    }
                });

                zipfile.on('error', (err) => {
                    console.warn('ZIP processing error', err);
                    resolve(null);
                });

                zipfile.on('end', () => resolve(null));
            });
        } catch (error) {
            console.warn('Failed to process ZIP buffer', error);
            resolve(null);
        }
    });
}

/**
 * Extracts all images from a ZIP archive.
 * @param {string} zipFilePath Path to the ZIP archive
 * @returns {Promise<[string, Buffer][]>} Array of image buffers
 */
export async function getImageBuffers(zipFilePath) {
    return new Promise((resolve, reject) => {
        // Check if the zip file exists
        if (!fs.existsSync(zipFilePath)) {
            reject(new Error('File not found'));
            return;
        }

        const imageBuffers = [];

        yauzl.open(zipFilePath, { lazyEntries: true }, (err, zipfile) => {
            if (err) {
                reject(err);
            } else {
                zipfile.readEntry();
                zipfile.on('entry', (entry) => {
                    const mimeType = mime.lookup(entry.fileName);
                    if (mimeType && mimeType.startsWith('image/') && !entry.fileName.startsWith('__MACOSX')) {
                        console.info(`Extracting ${entry.fileName}`);
                        zipfile.openReadStream(entry, (err, readStream) => {
                            if (err) {
                                reject(err);
                            } else {
                                const chunks = [];
                                readStream.on('data', (chunk) => {
                                    chunks.push(chunk);
                                });

                                readStream.on('end', () => {
                                    imageBuffers.push([path.parse(entry.fileName).base, Buffer.concat(chunks)]);
                                    zipfile.readEntry(); // Continue to the next entry
                                });
                            }
                        });
                    } else {
                        zipfile.readEntry(); // Continue to the next entry
                    }
                });

                zipfile.on('end', () => {
                    resolve(imageBuffers);
                });

                zipfile.on('error', (err) => {
                    reject(err);
                });
            }
        });
    });
}

/**
 * Gets all chunks of data from the given readable stream.
 * @param {any} readableStream Readable stream to read from
 * @returns {Promise<Buffer[]>} Array of chunks
 */
export async function readAllChunks(readableStream) {
    return new Promise((resolve, reject) => {
        // Consume the readable stream
        const chunks = [];
        readableStream.on('data', (chunk) => {
            chunks.push(chunk);
        });

        readableStream.on('end', () => {
            //console.log('Finished reading the stream.');
            resolve(chunks);
        });

        readableStream.on('error', (error) => {
            console.error('Error while reading the stream:', error);
            reject();
        });
    });
}

function isObject(item) {
    return (item && typeof item === 'object' && !Array.isArray(item));
}

export function deepMerge(target, source) {
    let output = Object.assign({}, target);
    if (isObject(target) && isObject(source)) {
        Object.keys(source).forEach(key => {
            if (isObject(source[key])) {
                if (!(key in target)) {
                    Object.assign(output, { [key]: source[key] });
                } else {
                    output[key] = deepMerge(target[key], source[key]);
                }
            } else {
                Object.assign(output, { [key]: source[key] });
            }
        });
    }
    return output;
}

export const color = chalk;

/**
 * Gets a random UUIDv4 string.
 * @returns {string} A UUIDv4 string
 */
export function uuidv4() {
    // Node v16.7.0+
    if ('crypto' in globalThis && 'randomUUID' in globalThis.crypto) {
        return globalThis.crypto.randomUUID();
    }
    // Node v14.17.0+
    if ('randomUUID' in crypto) {
        return crypto.randomUUID();
    }
    // Very insecure UUID generator, but it's better than nothing.
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

export function humanizedISO8601DateTime(date) {
    let baseDate = typeof date === 'number' ? new Date(date) : new Date();
    let humanYear = baseDate.getFullYear();
    let humanMonth = (baseDate.getMonth() + 1);
    let humanDate = baseDate.getDate();
    let humanHour = (baseDate.getHours() < 10 ? '0' : '') + baseDate.getHours();
    let humanMinute = (baseDate.getMinutes() < 10 ? '0' : '') + baseDate.getMinutes();
    let humanSecond = (baseDate.getSeconds() < 10 ? '0' : '') + baseDate.getSeconds();
    let humanMillisecond = (baseDate.getMilliseconds() < 10 ? '0' : '') + baseDate.getMilliseconds();
    let HumanizedDateTime = (humanYear + '-' + humanMonth + '-' + humanDate + ' @' + humanHour + 'h ' + humanMinute + 'm ' + humanSecond + 's ' + humanMillisecond + 'ms');
    return HumanizedDateTime;
}

export function tryParse(str) {
    try {
        return JSON.parse(str);
    } catch {
        return undefined;
    }
}

/**
 * Takes a path to a client-accessible file in the data folder and converts it to a relative URL segment that the
 * client can fetch it from. This involves stripping the data root path prefix and always using `/` as the separator.
 * @param {string} root The root directory of the user data folder.
 * @param {string} inputPath The path to be converted.
 * @returns The relative URL path from which the client can access the file.
 */
export function clientRelativePath(root, inputPath) {
    if (!inputPath.startsWith(root)) {
        throw new Error('Input path does not start with the root directory');
    }

    return inputPath.slice(root.length).split(path.sep).join('/');
}

/**
 * Strip the last file extension from a given file name. If there are multiple extensions, only the last is removed.
 * @param {string} filename The file name to remove the extension from.
 * @returns The file name, sans extension
 */
export function removeFileExtension(filename) {
    return filename.replace(/\.[^.]+$/, '');
}

export function generateTimestamp() {
    const now = new Date();
    const year = now.getFullYear();
    const month = String(now.getMonth() + 1).padStart(2, '0');
    const day = String(now.getDate()).padStart(2, '0');
    const hours = String(now.getHours()).padStart(2, '0');
    const minutes = String(now.getMinutes()).padStart(2, '0');
    const seconds = String(now.getSeconds()).padStart(2, '0');

    return `${year}${month}${day}-${hours}${minutes}${seconds}`;
}

/**
 * Remove old backups with the given prefix from a specified directory.
 * @param {string} directory The root directory to remove backups from.
 * @param {string} prefix File prefix to filter backups by.
 * @param {number?} limit Maximum number of backups to keep. If null, the limit is determined by the `backups.common.numberOfBackups` config value.
 */
export function removeOldBackups(directory, prefix, limit = null) {
    const MAX_BACKUPS = limit ?? Number(getConfigValue('backups.common.numberOfBackups', 50, 'number'));

    let files = fs.readdirSync(directory).filter(f => f.startsWith(prefix));
    if (files.length > MAX_BACKUPS) {
        files = files.map(f => path.join(directory, f));
        files.sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);

        while (files.length > MAX_BACKUPS) {
            const oldest = files.shift();
            if (!oldest) {
                break;
            }

            fs.unlinkSync(oldest);
        }
    }
}

/**
 * Get a list of images in a directory.
 * @param {string} directoryPath Path to the directory containing the images
 * @param {'name' | 'date'} sortBy Sort images by name or date
 * @returns {string[]} List of image file names
 */
export function getImages(directoryPath, sortBy = 'name') {
    function getSortFunction() {
        switch (sortBy) {
            case 'name':
                return Intl.Collator().compare;
            case 'date':
                return (a, b) => fs.statSync(path.join(directoryPath, a)).mtimeMs - fs.statSync(path.join(directoryPath, b)).mtimeMs;
            default:
                return (_a, _b) => 0;
        }
    }

    return fs
        .readdirSync(directoryPath)
        .filter(file => {
            const type = mime.lookup(file);
            return type && type.startsWith('image/');
        })
        .sort(getSortFunction());
}

/**
 * Pipe a fetch() response to an Express.js Response, including status code.
 * @param {import('node-fetch').Response} from The Fetch API response to pipe from.
 * @param {import('express').Response} to The Express response to pipe to.
 */
export function forwardFetchResponse(from, to) {
    let statusCode = from.status;
    let statusText = from.statusText;

    if (!from.ok) {
        console.warn(`Streaming request failed with status ${statusCode} ${statusText}`);
    }

    // Avoid sending 401 responses as they reset the client Basic auth.
    // This can produce an interesting artifact as "400 Unauthorized", but it's not out of spec.
    // https://www.rfc-editor.org/rfc/rfc9110.html#name-overview-of-status-codes
    // "The reason phrases listed here are only recommendations -- they can be replaced by local
    //  equivalents or left out altogether without affecting the protocol."
    if (statusCode === 401) {
        statusCode = 400;
    }

    to.statusCode = statusCode;
    to.statusMessage = statusText;

    if (from.body && to.socket) {
        from.body.pipe(to);

        to.socket.on('close', function () {
            if (from.body instanceof Readable) from.body.destroy(); // Close the remote stream

            to.end(); // End the Express response
        });

        from.body.on('end', function () {
            console.info('Streaming request finished');
            to.end();
        });
    } else {
        to.end();
    }
}

/**
 * Makes an HTTP/2 request to the specified endpoint.
 *
 * @deprecated Use `node-fetch` if possible.
 * @param {string} endpoint URL to make the request to
 * @param {string} method HTTP method to use
 * @param {string} body Request body
 * @param {object} headers Request headers
 * @returns {Promise<string>} Response body
 */
export function makeHttp2Request(endpoint, method, body, headers) {
    return new Promise((resolve, reject) => {
        try {
            const url = new URL(endpoint);
            const client = http2.connect(url.origin);

            const req = client.request({
                ':method': method,
                ':path': url.pathname,
                ...headers,
            });
            req.setEncoding('utf8');

            req.on('response', (headers) => {
                const status = Number(headers[':status']);

                if (status < 200 || status >= 300) {
                    reject(new Error(`Request failed with status ${status}`));
                }

                let data = '';

                req.on('data', (chunk) => {
                    data += chunk;
                });

                req.on('end', () => {
                    console.debug(data);
                    resolve(data);
                });
            });

            req.on('error', (err) => {
                reject(err);
            });

            if (body) {
                req.write(body);
            }

            req.end();
        } catch (e) {
            reject(e);
        }
    });
}

/**
 * Adds YAML-serialized object to the object.
 * @param {object} obj Object
 * @param {string} yamlString YAML-serialized object
 * @returns
 */
export function mergeObjectWithYaml(obj, yamlString) {
    if (!yamlString) {
        return;
    }

    try {
        const parsedObject = yaml.parse(yamlString);

        if (Array.isArray(parsedObject)) {
            for (const item of parsedObject) {
                if (typeof item === 'object' && item && !Array.isArray(item)) {
                    Object.assign(obj, item);
                }
            }
        }
        else if (parsedObject && typeof parsedObject === 'object') {
            Object.assign(obj, parsedObject);
        }
    } catch {
        // Do nothing
    }
}

/**
 * Removes keys from the object by YAML-serialized array.
 * @param {object} obj Object
 * @param {string} yamlString YAML-serialized array
 * @returns {void} Nothing
 */
export function excludeKeysByYaml(obj, yamlString) {
    if (!yamlString) {
        return;
    }

    try {
        const parsedObject = yaml.parse(yamlString);

        if (Array.isArray(parsedObject)) {
            parsedObject.forEach(key => {
                delete obj[key];
            });
        } else if (typeof parsedObject === 'object') {
            Object.keys(parsedObject).forEach(key => {
                delete obj[key];
            });
        } else if (typeof parsedObject === 'string') {
            delete obj[parsedObject];
        }
    } catch {
        // Do nothing
    }
}

/**
 * Removes trailing slash and /v1 from a string.
 * @param {string} str Input string
 * @returns {string} Trimmed string
 */
export function trimV1(str) {
    return String(str ?? '').replace(/\/$/, '').replace(/\/v1$/, '');
}

/**
 * Removes trailing slash from a string.
 * @param {string} str Input string
 * @returns {string} String with trailing slash removed
 */
export function trimTrailingSlash(str) {
    return String(str ?? '').replace(/\/$/, '');
}

/**
 * Simple TTL memory cache.
 */
export class Cache {
    /**
     * @param {number} ttl Time to live in milliseconds
     */
    constructor(ttl) {
        this.cache = new Map();
        this.ttl = ttl;
    }

    /**
     * Gets a value from the cache.
     * @param {string} key Cache key
     */
    get(key) {
        const value = this.cache.get(key);
        if (value?.expiry > Date.now()) {
            return value.value;
        }

        // Cache miss or expired, remove the key
        this.cache.delete(key);
        return null;
    }

    /**
     * Sets a value in the cache.
     * @param {string} key Key
     * @param {object} value Value
     */
    set(key, value) {
        this.cache.set(key, {
            value: value,
            expiry: Date.now() + this.ttl,
        });
    }

    /**
     * Removes a value from the cache.
     * @param {string} key Key
     */
    remove(key) {
        this.cache.delete(key);
    }

    /**
     * Clears the cache.
     */
    clear() {
        this.cache.clear();
    }
}

/**
 * Removes color formatting from a text string.
 * @param {string} text Text with color formatting
 * @returns {string} Text without color formatting
 */
export function removeColorFormatting(text) {
    // ANSI escape codes for colors are usually in the format \x1b[<codes>m
    return text.replace(/\x1b\[\d{1,2}(;\d{1,2})*m/g, '');
}

/**
 * Gets a separator string repeated n times.
 * @param {number} n Number of times to repeat the separator
 * @returns {string} Separator string
 */
export function getSeparator(n) {
    return '='.repeat(n);
}

/**
 * Checks if the string is a valid URL.
 * @param {string} url String to check
 * @returns {boolean} If the URL is valid
 */
export function isValidUrl(url) {
    try {
        new URL(url);
        return true;
    } catch (error) {
        return false;
    }
}

/**
 * removes starting `[` or ending `]` from hostname.
 * @param {string} hostname hostname to use
 * @returns {string} hostname plus the modifications
 */
export function urlHostnameToIPv6(hostname) {
    if (hostname.startsWith('[')) {
        hostname = hostname.slice(1);
    }
    if (hostname.endsWith(']')) {
        hostname = hostname.slice(0, -1);
    }
    return hostname;
}

/**
 * Test if can resolve a dns name.
 * @param {string} name Domain name to use
 * @param {boolean} useIPv6 If use IPv6
 * @param {boolean} useIPv4 If use IPv4
 * @returns Promise<boolean> If the URL is valid
 */
export async function canResolve(name, useIPv6 = true, useIPv4 = true) {
    try {
        let v6Resolved = false;
        let v4Resolved = false;

        if (useIPv6) {
            try {
                await dnsPromise.resolve6(name);
                v6Resolved = true;
            } catch (error) {
                v6Resolved = false;
            }
        }

        if (useIPv4) {
            try {
                await dnsPromise.resolve(name);
                v4Resolved = true;
            } catch (error) {
                v4Resolved = false;
            }
        }

        return v6Resolved || v4Resolved;

    } catch (error) {
        return false;
    }
}

/**
 * Checks the network interfaces to determine the presence of IPv6 and IPv4 addresses.
 *
 * @typedef {object} IPQueryResult
 * @property {boolean} hasIPv6Any - Whether the computer has any IPv6 address, including (`::1`).
 * @property {boolean} hasIPv4Any - Whether the computer has any IPv4 address, including (`127.0.0.1`).
 * @property {boolean} hasIPv6Local - Whether the computer has local IPv6 address (`::1`).
 * @property {boolean} hasIPv4Local - Whether the computer has local IPv4 address (`127.0.0.1`).
 * @returns {Promise<IPQueryResult>} A promise that resolves to an array containing:
 */
export async function getHasIP() {
    let hasIPv6Any = false;
    let hasIPv6Local = false;

    let hasIPv4Any = false;
    let hasIPv4Local = false;

    const interfaces = os.networkInterfaces();

    for (const iface of Object.values(interfaces)) {
        if (iface === undefined) {
            continue;
        }

        for (const info of iface) {
            if (info.family === 'IPv6') {
                hasIPv6Any = true;
                if (info.address === '::1') {
                    hasIPv6Local = true;
                }
            }

            if (info.family === 'IPv4') {
                hasIPv4Any = true;
                if (info.address === '127.0.0.1') {
                    hasIPv4Local = true;
                }
            }
            if (hasIPv6Any && hasIPv4Any && hasIPv6Local && hasIPv4Local) break;
        }
        if (hasIPv6Any && hasIPv4Any && hasIPv6Local && hasIPv4Local) break;
    }

    return { hasIPv6Any, hasIPv4Any, hasIPv6Local, hasIPv4Local };
}


/**
 * Converts various JavaScript primitives to boolean values.
 * Handles special case for "true"/"false" strings (case-insensitive)
 *
 * @param {any} value - The value to convert to boolean
 * @returns {boolean} - The boolean representation of the value
 */
export function toBoolean(value) {
    // Handle string values case-insensitively
    if (typeof value === 'string') {
        // Trim and convert to lowercase for case-insensitive comparison
        const trimmedLower = value.trim().toLowerCase();

        // Handle explicit "true"/"false" strings
        if (trimmedLower === 'true') return true;
        if (trimmedLower === 'false') return false;
    }

    // Handle all other JavaScript values based on their "truthiness"
    return Boolean(value);
}

/**
 * converts string to boolean accepts 'true' or 'false' else it returns the string put in
 * @param {string|null} str Input string or null
 * @returns {boolean|string|null} boolean else original input string or null if input is
 */
export function stringToBool(str) {
    if (String(str).trim().toLowerCase() === 'true') return true;
    if (String(str).trim().toLowerCase() === 'false') return false;
    return str;
}

/**
 * Setup the minimum log level
 */
export function setupLogLevel() {
    const logLevel = getConfigValue('logging.minLogLevel', LOG_LEVELS.DEBUG, 'number');

    globalThis.console.debug = logLevel <= LOG_LEVELS.DEBUG ? console.debug : () => { };
    globalThis.console.info = logLevel <= LOG_LEVELS.INFO ? console.info : () => { };
    globalThis.console.warn = logLevel <= LOG_LEVELS.WARN ? console.warn : () => { };
    globalThis.console.error = logLevel <= LOG_LEVELS.ERROR ? console.error : () => { };
}

/**
 * MemoryLimitedMap class that limits the memory usage of string values.
 */
export class MemoryLimitedMap {
    /**
     * Creates an instance of MemoryLimitedMap.
     * @param {string} cacheCapacity - Maximum memory usage in human-readable format (e.g., '1 GB').
     */
    constructor(cacheCapacity) {
        this.maxMemory = bytes.parse(cacheCapacity) ?? 0;
        this.currentMemory = 0;
        this.map = new Map();
        this.queue = [];
    }

    /**
     * Estimates the memory usage of a string in bytes.
     * Assumes each character occupies 2 bytes (UTF-16).
     * @param {string} str
     * @returns {number}
     */
    static estimateStringSize(str) {
        return str ? str.length * 2 : 0;
    }

    /**
     * Adds or updates a key-value pair in the map.
     * If adding the new value exceeds the memory limit, evicts oldest entries.
     * @param {string} key
     * @param {string} value
     */
    set(key, value) {
        if (this.maxMemory <= 0) {
            return;
        }

        if (typeof key !== 'string' || typeof value !== 'string') {
            return;
        }

        const newValueSize = MemoryLimitedMap.estimateStringSize(value);

        // If the new value itself exceeds the max memory, reject it
        if (newValueSize > this.maxMemory) {
            return;
        }

        // Check if the key already exists to adjust memory accordingly
        if (this.map.has(key)) {
            const oldValue = this.map.get(key);
            const oldValueSize = MemoryLimitedMap.estimateStringSize(oldValue);
            this.currentMemory -= oldValueSize;
            // Remove the key from its current position in the queue
            const index = this.queue.indexOf(key);
            if (index > -1) {
                this.queue.splice(index, 1);
            }
        }

        // Evict oldest entries until there's enough space
        while (this.currentMemory + newValueSize > this.maxMemory && this.queue.length > 0) {
            const oldestKey = this.queue.shift();
            const oldestValue = this.map.get(oldestKey);
            const oldestValueSize = MemoryLimitedMap.estimateStringSize(oldestValue);
            this.map.delete(oldestKey);
            this.currentMemory -= oldestValueSize;
        }

        // After eviction, check again if there's enough space
        if (this.currentMemory + newValueSize > this.maxMemory) {
            return;
        }

        // Add the new key-value pair
        this.map.set(key, value);
        this.queue.push(key);
        this.currentMemory += newValueSize;
    }

    /**
     * Retrieves the value associated with the given key.
     * @param {string} key
     * @returns {string | undefined}
     */
    get(key) {
        return this.map.get(key);
    }

    /**
     * Checks if the map contains the given key.
     * @param {string} key
     * @returns {boolean}
     */
    has(key) {
        return this.map.has(key);
    }

    /**
     * Deletes the key-value pair associated with the given key.
     * @param {string} key
     * @returns {boolean} - Returns true if the key was found and deleted, else false.
     */
    delete(key) {
        if (!this.map.has(key)) {
            return false;
        }
        const value = this.map.get(key);
        const valueSize = MemoryLimitedMap.estimateStringSize(value);
        this.map.delete(key);
        this.currentMemory -= valueSize;

        // Remove the key from the queue
        const index = this.queue.indexOf(key);
        if (index > -1) {
            this.queue.splice(index, 1);
        }

        return true;
    }

    /**
     * Clears all entries from the map.
     */
    clear() {
        this.map.clear();
        this.queue = [];
        this.currentMemory = 0;
    }

    /**
     * Returns the number of key-value pairs in the map.
     * @returns {number}
     */
    size() {
        return this.map.size;
    }

    /**
     * Returns the current memory usage in bytes.
     * @returns {number}
     */
    totalMemory() {
        return this.currentMemory;
    }

    /**
     * Returns an iterator over the keys in the map.
     * @returns {IterableIterator<string>}
     */
    keys() {
        return this.map.keys();
    }

    /**
     * Returns an iterator over the values in the map.
     * @returns {IterableIterator<string>}
     */
    values() {
        return this.map.values();
    }

    /**
     * Iterates over the map in insertion order.
     * @param {Function} callback - Function to execute for each element.
     */
    forEach(callback) {
        this.map.forEach((value, key) => {
            callback(value, key, this);
        });
    }

    /**
     * Makes the MemoryLimitedMap iterable.
     * @returns {Iterator} - Iterator over [key, value] pairs.
     */
    [Symbol.iterator]() {
        return this.map[Symbol.iterator]();
    }
}

/**
 * A 'safe' version of `fs.readFileSync()`. Returns the contents of a file if it exists, falling back to a default value if not.
 * @param {string} filePath Path of the file to be read.
 * @param {Parameters<typeof fs.readFileSync>[1]} options Options object to pass through to `fs.readFileSync()` (default: `{ encoding: 'utf-8' }`).
 * @returns The contents at `filePath` if it exists, or `null` if not.
 */
export function safeReadFileSync(filePath, options = { encoding: 'utf-8' }) {
    if (fs.existsSync(filePath)) return fs.readFileSync(filePath, options);
    return null;
}

/**
 * Set the title of the terminal window
 * @param {string} title Desired title for the window
 */
export function setWindowTitle(title) {
    if (process.platform === 'win32') {
        process.title = title;
    }
    else {
        process.stdout.write(`\x1b]2;${title}\x1b\x5c`);
    }
}

/**
 * Parses a JSON string and applies a mutation function to the parsed object.
 * @param {string} jsonString JSON string to parse
 * @param {function(any): void} mutation Mutation function to apply to the parsed JSON object
 * @returns {string} Mutated JSON string
 */
export function mutateJsonString(jsonString, mutation) {
    try {
        const json = JSON.parse(jsonString);
        mutation(json);
        return JSON.stringify(json);
    } catch (error) {
        console.error('Error parsing or mutating JSON:', error);
        return jsonString;
    }
}

/**
 * Sets the permissions of a file or directory to be writable.
 * @param {string} targetPath Path to the file or directory
 */
export function setPermissionsSync(targetPath) {
    /**
     * Appends writable permission to the file mode.
     * @param {string} filePath Path to the file
     * @param {fs.Stats} stats File stats
     */
    function appendWritablePermission(filePath, stats) {
        const currentMode = stats.mode;
        const newMode = currentMode | 0o200;
        if (newMode != currentMode) {
            fs.chmodSync(filePath, newMode);
        }
    }

    try {
        const stats = fs.statSync(targetPath);

        if (stats.isDirectory()) {
            appendWritablePermission(targetPath, stats);
            const files = fs.readdirSync(targetPath);

            files.forEach((file) => {
                setPermissionsSync(path.join(targetPath, file));
            });
        } else {
            appendWritablePermission(targetPath, stats);
        }
    } catch (error) {
        console.error(`Error setting write permissions for ${targetPath}:`, error);
    }
}

/**
 * Checks if a child path is under a parent path.
 * @param {string} parentPath Parent path
 * @param {string} childPath Child path
 * @returns {boolean} Returns true if the child path is under the parent path, false otherwise
 */
export function isPathUnderParent(parentPath, childPath) {
    const normalizedParent = path.normalize(parentPath);
    const normalizedChild = path.normalize(childPath);

    const relativePath = path.relative(normalizedParent, normalizedChild);

    return !relativePath.startsWith('..') && !path.isAbsolute(relativePath);
}

/**
 * Checks if the given request is a file URL.
 * @param {string | URL | Request} request The request to check
 * @return {boolean} Returns true if the request is a file URL, false otherwise
 */
export function isFileURL(request) {
    if (typeof request === 'string') {
        return request.startsWith('file://');
    }
    if (request instanceof URL) {
        return request.protocol === 'file:';
    }
    if (request instanceof Request) {
        return request.url.startsWith('file://');
    }
    return false;
}

/**
 * Gets the URL from the request.
 * @param {string | URL | Request} request The request to get the URL from
 * @return {string} The URL of the request
 */
export function getRequestURL(request) {
    if (typeof request === 'string') {
        return request;
    }
    if (request instanceof URL) {
        return request.href;
    }
    if (request instanceof Request) {
        return request.url;
    }
    throw new TypeError('Invalid request type');
}
