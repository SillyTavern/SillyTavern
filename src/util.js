const path = require('path');
const fs = require('fs');
const commandExistsSync = require('command-exists').sync;
const _ = require('lodash');
const yauzl = require('yauzl');
const mime = require('mime-types');
const { default: simpleGit } = require('simple-git');

/**
 * Returns the config object from the config.conf file.
 * @returns {object} Config object
 */
function getConfig() {
    try {
        const config = require(path.join(process.cwd(), './config.conf'));
        return config;
    } catch (error) {
        console.warn('Failed to read config.conf');
        return {};
    }
}

/**
 * Returns the value for the given key from the config object.
 * @param {string} key - Key to get from the config object
 * @param {any} defaultValue - Default value to return if the key is not found
 * @returns {any} Value for the given key
 */
function getConfigValue(key, defaultValue = null) {
    const config = getConfig();
    return _.get(config, key, defaultValue);
}

/**
 * Encodes the Basic Auth header value for the given user and password.
 * @param {string} auth username:password
 * @returns {string} Basic Auth header value
 */
function getBasicAuthHeader(auth) {
    const encoded = Buffer.from(`${auth}`).toString('base64');
    return `Basic ${encoded}`;
}

/**
 * Returns the version of the running instance. Get the version from the package.json file and the git revision.
 * Also returns the agent string for the Horde API.
 * @returns {Promise<{agent: string, pkgVersion: string, gitRevision: string | null, gitBranch: string | null}>} Version info object
 */
async function getVersion() {
    let pkgVersion = 'UNKNOWN';
    let gitRevision = null;
    let gitBranch = null;
    try {
        const pkgJson = require(path.join(process.cwd(), './package.json'));
        pkgVersion = pkgJson.version;
        if (!process['pkg'] && commandExistsSync('git')) {
            const git = simpleGit();
            gitRevision = await git.cwd(process.cwd()).revparse(['--short', 'HEAD']);
            gitBranch = await git.cwd(process.cwd()).revparse(['--abbrev-ref', 'HEAD']);
        }
    }
    catch {
        // suppress exception
    }

    const agent = `SillyTavern:${pkgVersion}:Cohee#1207`;
    return { agent, pkgVersion, gitRevision, gitBranch };
}

/**
 * Delays the current async function by the given amount of milliseconds.
 * @param {number} ms Milliseconds to wait
 * @returns {Promise<void>} Promise that resolves after the given amount of milliseconds
 */
function delay(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}

/**
 * Extracts a file with given extension from an ArrayBuffer containing a ZIP archive.
 * @param {ArrayBuffer} archiveBuffer Buffer containing a ZIP archive
 * @param {string} fileExtension File extension to look for
 * @returns {Promise<Buffer>} Buffer containing the extracted file
 */
async function extractFileFromZipBuffer(archiveBuffer, fileExtension) {
    return await new Promise((resolve, reject) => yauzl.fromBuffer(Buffer.from(archiveBuffer), { lazyEntries: true }, (err, zipfile) => {
        if (err) {
            reject(err);
        }

        zipfile.readEntry();
        zipfile.on('entry', (entry) => {
            if (entry.fileName.endsWith(fileExtension)) {
                console.log(`Extracting ${entry.fileName}`);
                zipfile.openReadStream(entry, (err, readStream) => {
                    if (err) {
                        reject(err);
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
                    }
                });
            } else {
                zipfile.readEntry();
            }
        });
    }));
}

/**
 * Extracts all images from a ZIP archive.
 * @param {string} zipFilePath Path to the ZIP archive
 * @returns {Promise<[string, Buffer][]>} Array of image buffers
 */
async function getImageBuffers(zipFilePath) {
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
                        console.log(`Extracting ${entry.fileName}`);
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
async function readAllChunks(readableStream) {
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

function deepMerge(target, source) {
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

module.exports = {
    getConfig,
    getConfigValue,
    getVersion,
    getBasicAuthHeader,
    extractFileFromZipBuffer,
    getImageBuffers,
    readAllChunks,
    delay,
    deepMerge,
};
