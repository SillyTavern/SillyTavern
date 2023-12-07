const path = require('path');
const fs = require('fs');
const commandExistsSync = require('command-exists').sync;
const _ = require('lodash');
const yauzl = require('yauzl');
const mime = require('mime-types');
const yaml = require('yaml');
const { default: simpleGit } = require('simple-git');

const { DIRECTORIES } = require('./constants');

/**
 * Returns the config object from the config.yaml file.
 * @returns {object} Config object
 */
function getConfig() {
    function getNewConfig() {
        try {
            const config = yaml.parse(fs.readFileSync(path.join(process.cwd(), './config.yaml'), 'utf8'));
            return config;
        } catch (error) {
            console.warn('Failed to read config.yaml');
            return {};
        }
    }

    function getLegacyConfig() {
        try {
            console.log(color.yellow('WARNING: config.conf is deprecated. Please run "npm run postinstall" to convert to config.yaml'));
            const config = require(path.join(process.cwd(), './config.conf'));
            return config;
        } catch (error) {
            console.warn('Failed to read config.conf');
            return {};
        }
    }

    if (fs.existsSync('./config.yaml')) {
        return getNewConfig();
    }

    if (fs.existsSync('./config.conf')) {
        return getLegacyConfig();
    }

    console.error(color.red('No config file found. Please create a config.yaml file. The default config file can be found in the /default folder.'));
    console.error(color.red('The program will now exit.'));
    process.exit(1);
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

const color = {
    byNum: (mess, fgNum) => {
        mess = mess || '';
        fgNum = fgNum === undefined ? 31 : fgNum;
        return '\u001b[' + fgNum + 'm' + mess + '\u001b[39m';
    },
    black: (mess) => color.byNum(mess, 30),
    red: (mess) => color.byNum(mess, 31),
    green: (mess) => color.byNum(mess, 32),
    yellow: (mess) => color.byNum(mess, 33),
    blue: (mess) => color.byNum(mess, 34),
    magenta: (mess) => color.byNum(mess, 35),
    cyan: (mess) => color.byNum(mess, 36),
    white: (mess) => color.byNum(mess, 37),
};

function uuidv4() {
    return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, function (c) {
        const r = Math.random() * 16 | 0;
        const v = c === 'x' ? r : (r & 0x3 | 0x8);
        return v.toString(16);
    });
}

function humanizedISO8601DateTime(date) {
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

function tryParse(str) {
    try {
        return JSON.parse(str);
    } catch {
        return undefined;
    }
}

/**
 * Takes a path to a client-accessible file in the `public` folder and converts it to a relative URL segment that the
 * client can fetch it from. This involves stripping the `public/` prefix and always using `/` as the separator.
 * @param {string} inputPath The path to be converted.
 * @returns The relative URL path from which the client can access the file.
 */
function clientRelativePath(inputPath) {
    return path.normalize(inputPath).split(path.sep).slice(1).join('/');
}

/**
 * Strip the last file extension from a given file name. If there are multiple extensions, only the last is removed.
 * @param {string} filename The file name to remove the extension from.
 * @returns The file name, sans extension
 */
function removeFileExtension(filename) {
    return filename.replace(/\.[^.]+$/, '');
}

function generateTimestamp() {
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
 * @param {string} prefix
 */
function removeOldBackups(prefix) {
    const MAX_BACKUPS = 25;

    let files = fs.readdirSync(DIRECTORIES.backups).filter(f => f.startsWith(prefix));
    if (files.length > MAX_BACKUPS) {
        files = files.map(f => path.join(DIRECTORIES.backups, f));
        files.sort((a, b) => fs.statSync(a).mtimeMs - fs.statSync(b).mtimeMs);

        fs.rmSync(files[0]);
    }
}

function getImages(path) {
    return fs
        .readdirSync(path)
        .filter(file => {
            const type = mime.lookup(file);
            return type && type.startsWith('image/');
        })
        .sort(Intl.Collator().compare);
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
    color,
    uuidv4,
    humanizedISO8601DateTime,
    tryParse,
    clientRelativePath,
    removeFileExtension,
    generateTimestamp,
    removeOldBackups,
    getImages,
};
