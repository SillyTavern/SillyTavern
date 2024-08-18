const fs = require('fs');
const path = require('path');
const express = require('express');
const { getConfigValue } = require('../util');
const writeFileAtomicSync = require('write-file-atomic').sync;
const { jsonParser } = require('../express-common');

const SECRETS_FILE = 'secrets.json';
const SECRET_KEYS = {
    HORDE: 'api_key_horde',
    MANCER: 'api_key_mancer',
    VLLM: 'api_key_vllm',
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
    INFERMATICAI: 'api_key_infermaticai',
    DREAMGEN: 'api_key_dreamgen',
    NOMICAI: 'api_key_nomicai',
    KOBOLDCPP: 'api_key_koboldcpp',
    LLAMACPP: 'api_key_llamacpp',
    COHERE: 'api_key_cohere',
    PERPLEXITY: 'api_key_perplexity',
    GROQ: 'api_key_groq',
    AZURE_TTS: 'api_key_azure_tts',
    FEATHERLESS: 'api_key_featherless',
    ZEROONEAI: 'api_key_01ai',
    HUGGINGFACE: 'api_key_huggingface',
    STABILITY: 'api_key_stability',
    BLOCKENTROPY: 'api_key_blockentropy',
    CUSTOM_OPENAI_TTS: 'api_key_custom_openai_tts',
};

// These are the keys that are safe to expose, even if allowKeysExposure is false
const EXPORTABLE_KEYS = [
    SECRET_KEYS.LIBRE_URL,
    SECRET_KEYS.LINGVA_URL,
    SECRET_KEYS.ONERING_URL,
    SECRET_KEYS.DEEPLX_URL,
];

/**
 * Writes a secret to the secrets file
 * @param {import('../users').UserDirectoryList} directories User directories
 * @param {string} key Secret key
 * @param {string} value Secret value
 */
function writeSecret(directories, key, value) {
    const filePath = path.join(directories.root, SECRETS_FILE);

    if (!fs.existsSync(filePath)) {
        const emptyFile = JSON.stringify({});
        writeFileAtomicSync(filePath, emptyFile, 'utf-8');
    }

    const fileContents = fs.readFileSync(filePath, 'utf-8');
    const secrets = JSON.parse(fileContents);
    secrets[key] = value;
    writeFileAtomicSync(filePath, JSON.stringify(secrets, null, 4), 'utf-8');
}

/**
 * Deletes a secret from the secrets file
 * @param {import('../users').UserDirectoryList} directories User directories
 * @param {string} key Secret key
 * @returns
 */
function deleteSecret(directories, key) {
    const filePath = path.join(directories.root, SECRETS_FILE);

    if (!fs.existsSync(filePath)) {
        return;
    }

    const fileContents = fs.readFileSync(filePath, 'utf-8');
    const secrets = JSON.parse(fileContents);
    delete secrets[key];
    writeFileAtomicSync(filePath, JSON.stringify(secrets, null, 4), 'utf-8');
}

/**
 * Reads a secret from the secrets file
 * @param {import('../users').UserDirectoryList} directories User directories
 * @param {string} key Secret key
 * @returns {string} Secret value
 */
function readSecret(directories, key) {
    const filePath = path.join(directories.root, SECRETS_FILE);

    if (!fs.existsSync(filePath)) {
        return '';
    }

    const fileContents = fs.readFileSync(filePath, 'utf-8');
    const secrets = JSON.parse(fileContents);
    return secrets[key];
}

/**
 * Reads the secret state from the secrets file
 * @param {import('../users').UserDirectoryList} directories User directories
 * @returns {object} Secret state
 */
function readSecretState(directories) {
    const filePath = path.join(directories.root, SECRETS_FILE);

    if (!fs.existsSync(filePath)) {
        return {};
    }

    const fileContents = fs.readFileSync(filePath, 'utf8');
    const secrets = JSON.parse(fileContents);
    const state = {};

    for (const key of Object.values(SECRET_KEYS)) {
        state[key] = !!secrets[key]; // convert to boolean
    }

    return state;
}

/**
 * Reads all secrets from the secrets file
 * @param {import('../users').UserDirectoryList} directories User directories
 * @returns {Record<string, string> | undefined} Secrets
 */
function getAllSecrets(directories) {
    const filePath = path.join(directories.root, SECRETS_FILE);

    if (!fs.existsSync(filePath)) {
        console.log('Secrets file does not exist');
        return undefined;
    }

    const fileContents = fs.readFileSync(filePath, 'utf8');
    const secrets = JSON.parse(fileContents);
    return secrets;
}

const router = express.Router();

router.post('/write', jsonParser, (request, response) => {
    const key = request.body.key;
    const value = request.body.value;

    writeSecret(request.user.directories, key, value);
    return response.send('ok');
});

router.post('/read', jsonParser, (request, response) => {
    try {
        const state = readSecretState(request.user.directories);
        return response.send(state);
    } catch (error) {
        console.error(error);
        return response.send({});
    }
});

router.post('/view', jsonParser, async (request, response) => {
    const allowKeysExposure = getConfigValue('allowKeysExposure', false);

    if (!allowKeysExposure) {
        console.error('secrets.json could not be viewed unless the value of allowKeysExposure in config.yaml is set to true');
        return response.sendStatus(403);
    }

    try {
        const secrets = getAllSecrets(request.user.directories);

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
    const key = request.body.key;

    if (!allowKeysExposure && !EXPORTABLE_KEYS.includes(key)) {
        console.error('Cannot fetch secrets unless allowKeysExposure in config.yaml is set to true');
        return response.sendStatus(403);
    }

    try {
        const secret = readSecret(request.user.directories, key);

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
    deleteSecret,
    readSecretState,
    getAllSecrets,
    SECRET_KEYS,
    router,
};
