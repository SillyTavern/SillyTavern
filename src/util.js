const path = require('path');
const child_process = require('child_process');
const commandExistsSync = require('command-exists').sync;
const _ = require('lodash');

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
 * @returns {{agent: string, pkgVersion: string, gitRevision: string | null, gitBranch: string | null}} Version info object
 */
function getVersion() {
    let pkgVersion = 'UNKNOWN';
    let gitRevision = null;
    let gitBranch = null;
    try {
        const pkgJson = require(path.join(process.cwd(), './package.json'));
        pkgVersion = pkgJson.version;
        if (!process['pkg'] && commandExistsSync('git')) {
            gitRevision = child_process
                .execSync('git rev-parse --short HEAD', { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'ignore'] })
                .toString().trim();

            gitBranch = child_process
                .execSync('git rev-parse --abbrev-ref HEAD', { cwd: process.cwd(), stdio: ['ignore', 'pipe', 'ignore'] })
                .toString().trim();
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

module.exports = {
    getConfig,
    getConfigValue,
    getVersion,
    getBasicAuthHeader,
    delay,
};
