const fs = require('fs');
const path = require('path');
const express = require('express');
const { getConfigValue } = require('../util');
const writeFileAtomicSync = require('write-file-atomic').sync;
const { jsonParser } = require('../express-common');

const SECRETS_FILE = path.join(process.cwd(), './secrets.json');
const SECRET_KEYS = {
    HORDE: 'api_key_horde',
    MANCER: 'api_key_mancer',
    APHRODITE: 'api_key_aphrodite',
    TABBY: 'api_key_tabby',
    OPENAI: 'api_key_openai',
    NOVEL: 'api_key_novel',
    CLAUDE: 'api_key_claude',
    DEEPL: 'deepl',
    LIBRE: 'libre',
    LIBRE_URL: 'libre_url',
    LINGVA_URL: 'lingva_url',
    OPENROUTER: 'api_key_openrouter',
    SCALE: 'api_key_scale',
    AI21: 'api_key_ai21',
    SCALE_COOKIE: 'scale_cookie',
    ONERING_URL: 'oneringtranslator_url',
    DEEPLX_URL: 'deeplx_url',
    MAKERSUITE: 'api_key_makersuite',
    SERPAPI: 'api_key_serpapi',
    TOGETHERAI: 'api_key_togetherai',
    MISTRALAI: 'api_key_mistralai',
    CUSTOM: 'api_key_custom',
    OOBA: 'api_key_ooba',
};

/**
 * Writes a secret to the secrets file
 * @param {string} key Secret key
 * @param {string} value Secret value
 */
function writeSecret(key, value) {
    if (!fs.existsSync(SECRETS_FILE)) {
        const emptyFile = JSON.stringify({});
        writeFileAtomicSync(SECRETS_FILE, emptyFile, 'utf-8');
    }

    const fileContents = fs.readFileSync(SECRETS_FILE, 'utf-8');
    const secrets = JSON.parse(fileContents);
    secrets[key] = value;
    writeFileAtomicSync(SECRETS_FILE, JSON.stringify(secrets, null, 4), 'utf-8');
}

function deleteSecret(key) {
    if (!fs.existsSync(SECRETS_FILE)) {
        return;
    }

    const fileContents = fs.readFileSync(SECRETS_FILE, 'utf-8');
    const secrets = JSON.parse(fileContents);
    delete secrets[key];
    writeFileAtomicSync(SECRETS_FILE, JSON.stringify(secrets, null, 4), 'utf-8');
}

/**
 * Reads a secret from the secrets file
 * @param {string} key Secret key
 * @returns {string} Secret value
 */
function readSecret(key) {
    if (!fs.existsSync(SECRETS_FILE)) {
        return '';
    }

    const fileContents = fs.readFileSync(SECRETS_FILE, 'utf-8');
    const secrets = JSON.parse(fileContents);
    return secrets[key];
}

/**
 * Reads the secret state from the secrets file
 * @returns {object} Secret state
 */
function readSecretState() {
    if (!fs.existsSync(SECRETS_FILE)) {
        return {};
    }

    const fileContents = fs.readFileSync(SECRETS_FILE, 'utf8');
    const secrets = JSON.parse(fileContents);
    const state = {};

    for (const key of Object.values(SECRET_KEYS)) {
        state[key] = !!secrets[key]; // convert to boolean
    }

    return state;
}

/**
 * Migrates secrets from settings.json to secrets.json
 * @param {string} settingsFile Path to settings.json
 * @returns {void}
 */
function migrateSecrets(settingsFile) {
    const palmKey = readSecret('api_key_palm');
    if (palmKey) {
        console.log('Migrating Palm key...');
        writeSecret(SECRET_KEYS.MAKERSUITE, palmKey);
        deleteSecret('api_key_palm');
    }

    if (!fs.existsSync(settingsFile)) {
        console.log('Settings file does not exist');
        return;
    }

    try {
        let modified = false;
        const fileContents = fs.readFileSync(settingsFile, 'utf8');
        const settings = JSON.parse(fileContents);
        const oaiKey = settings?.api_key_openai;
        const hordeKey = settings?.horde_settings?.api_key;
        const novelKey = settings?.api_key_novel;

        if (typeof oaiKey === 'string') {
            console.log('Migrating OpenAI key...');
            writeSecret(SECRET_KEYS.OPENAI, oaiKey);
            delete settings.api_key_openai;
            modified = true;
        }

        if (typeof hordeKey === 'string') {
            console.log('Migrating Horde key...');
            writeSecret(SECRET_KEYS.HORDE, hordeKey);
            delete settings.horde_settings.api_key;
            modified = true;
        }

        if (typeof novelKey === 'string') {
            console.log('Migrating Novel key...');
            writeSecret(SECRET_KEYS.NOVEL, novelKey);
            delete settings.api_key_novel;
            modified = true;
        }

        if (modified) {
            console.log('Writing updated settings.json...');
            const settingsContent = JSON.stringify(settings, null, 4);
            writeFileAtomicSync(settingsFile, settingsContent, 'utf-8');
        }
    }
    catch (error) {
        console.error('Could not migrate secrets file. Proceed with caution.');
    }
}

/**
 * Reads all secrets from the secrets file
 * @returns {Record<string, string> | undefined} Secrets
 */
function getAllSecrets() {
    if (!fs.existsSync(SECRETS_FILE)) {
        console.log('Secrets file does not exist');
        return undefined;
    }

    const fileContents = fs.readFileSync(SECRETS_FILE, 'utf8');
    const secrets = JSON.parse(fileContents);
    return secrets;
}

const router = express.Router();

router.post('/write', jsonParser, (request, response) => {
    const key = request.body.key;
    const value = request.body.value;

    writeSecret(key, value);
    return response.send('ok');
});

router.post('/read', jsonParser, (_, response) => {
    try {
        const state = readSecretState();
        return response.send(state);
    } catch (error) {
        console.error(error);
        return response.send({});
    }
});

router.post('/view', jsonParser, async (_, response) => {
    const allowKeysExposure = getConfigValue('allowKeysExposure', false);

    if (!allowKeysExposure) {
        console.error('secrets.json could not be viewed unless the value of allowKeysExposure in config.yaml is set to true');
        return response.sendStatus(403);
    }

    try {
        const secrets = getAllSecrets();

        if (!secrets) {
            return response.sendStatus(404);
        }

        return response.send(secrets);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

router.post('/find', jsonParser, (request, response) => {
    const allowKeysExposure = getConfigValue('allowKeysExposure', false);

    if (!allowKeysExposure) {
        console.error('Cannot fetch secrets unless allowKeysExposure in config.yaml is set to true');
        return response.sendStatus(403);
    }

    const key = request.body.key;

    try {
        const secret = readSecret(key);

        if (!secret) {
            response.sendStatus(404);
        }

        return response.send({ value: secret });
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

module.exports = {
    writeSecret,
    readSecret,
    readSecretState,
    migrateSecrets,
    getAllSecrets,
    SECRET_KEYS,
    router,
};
