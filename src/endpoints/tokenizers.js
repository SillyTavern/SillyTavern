import fs from 'node:fs';
import path from 'node:path';
import { Buffer } from 'node:buffer';
import zlib from 'node:zlib';
import { promisify } from 'node:util';

import express from 'express';
import fetch from 'node-fetch';
import { sync as writeFileAtomicSync } from 'write-file-atomic';

import { Tokenizer } from '@agnai/web-tokenizers';
import { SentencePieceProcessor } from '@agnai/sentencepiece-js';
import tiktoken from 'tiktoken';

import { convertClaudePrompt } from '../prompt-converters.js';
import { TEXTGEN_TYPES } from '../constants.js';
import { setAdditionalHeaders } from '../additional-headers.js';
import { getConfigValue, isValidUrl } from '../util.js';

/**
 * @typedef { (req: import('express').Request, res: import('express').Response) => Promise<any> } TokenizationHandler
 */

/**
 * @type {{[key: string]: import('tiktoken').Tiktoken}} Tokenizers cache
 */
const tokenizersCache = {};

/**
 * @type {string[]}
 */
export const TEXT_COMPLETION_MODELS = [
    'gpt-3.5-turbo-instruct',
    'gpt-3.5-turbo-instruct-0914',
    'text-davinci-003',
    'text-davinci-002',
    'text-davinci-001',
    'text-curie-001',
    'text-babbage-001',
    'text-ada-001',
    'code-davinci-002',
    'code-davinci-001',
    'code-cushman-002',
    'code-cushman-001',
    'text-davinci-edit-001',
    'code-davinci-edit-001',
    'text-embedding-ada-002',
    'text-similarity-davinci-001',
    'text-similarity-curie-001',
    'text-similarity-babbage-001',
    'text-similarity-ada-001',
    'text-search-davinci-doc-001',
    'text-search-curie-doc-001',
    'text-search-babbage-doc-001',
    'text-search-ada-doc-001',
    'code-search-babbage-code-001',
    'code-search-ada-code-001',
];

const CHARS_PER_TOKEN = 3.35;
const IS_DOWNLOAD_ALLOWED = getConfigValue('enableDownloadableTokenizers', true, 'boolean');
const gunzip = promisify(zlib.gunzip);

/**
 * Gets a path to the tokenizer model. Downloads the model if it's a URL.
 * @param {string} model Model URL or path
 * @param {string|undefined} fallbackModel Fallback model path
 * @returns {Promise<string>} Path to the tokenizer model
 */
async function getPathToTokenizer(model, fallbackModel) {
    if (!isValidUrl(model)) {
        return model;
    }

    try {
        const url = new URL(model);

        if (!['https:', 'http:'].includes(url.protocol)) {
            throw new Error('Invalid URL protocol');
        }

        const fileName = url.pathname.split('/').pop();

        if (!fileName) {
            throw new Error('Failed to extract the file name from the URL');
        }

        const CACHE_PATH = path.join(globalThis.DATA_ROOT, '_cache');
        if (!fs.existsSync(CACHE_PATH)) {
            fs.mkdirSync(CACHE_PATH, { recursive: true });
        }

        // If an uncompressed version exists, return it
        const isCompressed = path.extname(fileName) === '.gz';
        const uncompressedName = path.basename(fileName, '.gz');
        const uncompressedPath = path.join(CACHE_PATH, uncompressedName);
        if (isCompressed && fs.existsSync(uncompressedPath)) {
            return uncompressedPath;
        }

        const cachedFile = path.join(CACHE_PATH, fileName);
        if (fs.existsSync(cachedFile)) {
            // If the file was downloaded manually
            if (isCompressed) {
                const compressedBuffer = await fs.promises.readFile(cachedFile);
                const decompressedBuffer = await gunzip(compressedBuffer);
                writeFileAtomicSync(uncompressedPath, decompressedBuffer);
                await fs.promises.unlink(cachedFile);
                return uncompressedPath;
            }
            return cachedFile;
        }

        if (!IS_DOWNLOAD_ALLOWED) {
            throw new Error('Downloading tokenizers is disabled, the model is not cached');
        }

        console.info('Downloading tokenizer model:', model);
        const response = await fetch(model);
        if (!response.ok) {
            throw new Error(`Failed to fetch the model: ${response.status} ${response.statusText}`);
        }

        const arrayBuffer = await response.arrayBuffer();
        if (isCompressed) {
            const decompressedBuffer = await gunzip(arrayBuffer);
            writeFileAtomicSync(uncompressedPath, decompressedBuffer);
            return uncompressedPath;
        }

        writeFileAtomicSync(cachedFile, Buffer.from(arrayBuffer));
        return cachedFile;
    } catch (error) {
        const getLastSegment = str => str?.split('/')?.pop() || '';
        if (fallbackModel) {
            console.error(`Could not get a tokenizer from ${getLastSegment(model)}. Reason: ${error.message}. Using a fallback model: ${getLastSegment(fallbackModel)}.`);
            return fallbackModel;
        }

        throw new Error(`Failed to instantiate a tokenizer and fallback is not provided. Reason: ${error.message}`);
    }
}

/**
 * Sentencepiece tokenizer for tokenizing text.
 */
class SentencePieceTokenizer {
    /**
     * @type {import('@agnai/sentencepiece-js').SentencePieceProcessor} Sentencepiece tokenizer instance
     */
    #instance;
    /**
     * @type {string} Path to the tokenizer model
     */
    #model;
    /**
     * @type {string|undefined} Path to the fallback model
     */
    #fallbackModel;

    /**
     * Creates a new Sentencepiece tokenizer.
     * @param {string} model Path to the tokenizer model
     * @param {string} [fallbackModel] Path to the fallback model
     */
    constructor(model, fallbackModel) {
        this.#model = model;
        this.#fallbackModel = fallbackModel;
    }

    /**
     * Gets the Sentencepiece tokenizer instance.
     * @returns {Promise<import('@agnai/sentencepiece-js').SentencePieceProcessor|null>} Sentencepiece tokenizer instance
     */
    async get() {
        if (this.#instance) {
            return this.#instance;
        }

        try {
            const pathToModel = await getPathToTokenizer(this.#model, this.#fallbackModel);
            this.#instance = new SentencePieceProcessor();
            await this.#instance.load(pathToModel);
            console.info('Instantiated the tokenizer for', path.parse(pathToModel).name);
            return this.#instance;
        } catch (error) {
            console.error('Sentencepiece tokenizer failed to load: ' + this.#model, error);
            return null;
        }
    }
}

/**
 * Web tokenizer for tokenizing text.
 */
class WebTokenizer {
    /**
     * @type {Tokenizer} Web tokenizer instance
     */
    #instance;
    /**
     * @type {string} Path to the tokenizer model
     */
    #model;
    /**
     * @type {string|undefined} Path to the fallback model
     */
    #fallbackModel;

    /**
     * Creates a new Web tokenizer.
     * @param {string} model Path to the tokenizer model
     * @param {string} [fallbackModel] Path to the fallback model
     */
    constructor(model, fallbackModel) {
        this.#model = model;
        this.#fallbackModel = fallbackModel;
    }

    /**
     * Gets the Web tokenizer instance.
     * @returns {Promise<Tokenizer|null>} Web tokenizer instance
     */
    async get() {
        if (this.#instance) {
            return this.#instance;
        }

        try {
            const pathToModel = await getPathToTokenizer(this.#model, this.#fallbackModel);
            const fileBuffer = await fs.promises.readFile(pathToModel);
            this.#instance = await Tokenizer.fromJSON(fileBuffer);
            console.info('Instantiated the tokenizer for', path.parse(pathToModel).name);
            return this.#instance;
        } catch (error) {
            console.error('Web tokenizer failed to load: ' + this.#model, error);
            return null;
        }
    }
}

const spp_llama = new SentencePieceTokenizer('src/tokenizers/llama.model');
const spp_nerd = new SentencePieceTokenizer('src/tokenizers/nerdstash.model');
const spp_nerd_v2 = new SentencePieceTokenizer('src/tokenizers/nerdstash_v2.model');
const spp_mistral = new SentencePieceTokenizer('src/tokenizers/mistral.model');
const spp_yi = new SentencePieceTokenizer('src/tokenizers/yi.model');
const spp_gemma = new SentencePieceTokenizer('src/tokenizers/gemma.model');
const spp_jamba = new SentencePieceTokenizer('src/tokenizers/jamba.model');
const claude_tokenizer = new WebTokenizer('src/tokenizers/claude.json');
const llama3_tokenizer = new WebTokenizer('src/tokenizers/llama3.json');
const commandRTokenizer = new WebTokenizer('https://github.com/SillyTavern/SillyTavern-Tokenizers/raw/main/command-r.json.gz', 'src/tokenizers/llama3.json');
const commandATokenizer = new WebTokenizer('https://github.com/SillyTavern/SillyTavern-Tokenizers/raw/main/command-a.json.gz', 'src/tokenizers/llama3.json');
const qwen2Tokenizer = new WebTokenizer('https://github.com/SillyTavern/SillyTavern-Tokenizers/raw/main/qwen2.json.gz', 'src/tokenizers/llama3.json');
const nemoTokenizer = new WebTokenizer('https://github.com/SillyTavern/SillyTavern-Tokenizers/raw/main/nemo.json.gz', 'src/tokenizers/llama3.json');
const deepseekTokenizer = new WebTokenizer('https://github.com/SillyTavern/SillyTavern-Tokenizers/raw/main/deepseek.json.gz', 'src/tokenizers/llama3.json');

export const sentencepieceTokenizers = [
    'llama',
    'nerdstash',
    'nerdstash_v2',
    'mistral',
    'yi',
    'gemma',
    'jamba',
];

export const webTokenizers = [
    'claude',
    'llama3',
    'command-r',
    'command-a',
    'qwen2',
    'nemo',
    'deepseek',
];

/**
 * Gets the Sentencepiece tokenizer by the model name.
 * @param {string} model Sentencepiece model name
 * @returns {SentencePieceTokenizer|null} Sentencepiece tokenizer
 */
export function getSentencepiceTokenizer(model) {
    if (model.includes('llama')) {
        return spp_llama;
    }

    if (model.includes('nerdstash')) {
        return spp_nerd;
    }

    if (model.includes('mistral')) {
        return spp_mistral;
    }

    if (model.includes('nerdstash_v2')) {
        return spp_nerd_v2;
    }

    if (model.includes('yi')) {
        return spp_yi;
    }

    if (model.includes('gemma')) {
        return spp_gemma;
    }

    if (model.includes('jamba')) {
        return spp_jamba;
    }

    return null;
}

/**
 * Gets the Web tokenizer by the model name.
 * @param {string} model Web tokenizer model name
 * @returns {WebTokenizer|null} Web tokenizer
 */
export function getWebTokenizer(model) {
    if (model.includes('llama3')) {
        return llama3_tokenizer;
    }

    if (model.includes('claude')) {
        return claude_tokenizer;
    }

    if (model.includes('command-r')) {
        return commandRTokenizer;
    }

    if (model.includes('command-a')) {
        return commandATokenizer;
    }

    if (model.includes('qwen2')) {
        return qwen2Tokenizer;
    }

    if (model.includes('nemo')) {
        return nemoTokenizer;
    }

    if (model.includes('deepseek')) {
        return deepseekTokenizer;
    }

    return null;
}

/**
 * Counts the token ids for the given text using the Sentencepiece tokenizer.
 * @param {SentencePieceTokenizer} tokenizer Sentencepiece tokenizer
 * @param {string} text Text to tokenize
 * @returns { Promise<{ids: number[], count: number}> } Tokenization result
 */
async function countSentencepieceTokens(tokenizer, text) {
    const instance = await tokenizer?.get();

    // Fallback to strlen estimation
    if (!instance) {
        return {
            ids: [],
            count: Math.ceil(text.length / CHARS_PER_TOKEN),
        };
    }

    let cleaned = text; // cleanText(text); <-- cleaning text can result in an incorrect tokenization

    let ids = instance.encodeIds(cleaned);
    return {
        ids,
        count: ids.length,
    };
}

/**
 * Counts the tokens in the given array of objects using the Sentencepiece tokenizer.
 * @param {SentencePieceTokenizer} tokenizer
 * @param {object[]} array Array of objects to tokenize
 * @returns {Promise<number>} Number of tokens
 */
async function countSentencepieceArrayTokens(tokenizer, array) {
    const jsonBody = array.flatMap(x => Object.values(x)).join('\n\n');
    const result = await countSentencepieceTokens(tokenizer, jsonBody);
    const num_tokens = result.count;
    return num_tokens;
}

async function getTiktokenChunks(tokenizer, ids) {
    const decoder = new TextDecoder();
    const chunks = [];

    for (let i = 0; i < ids.length; i++) {
        const id = ids[i];
        const chunkTextBytes = await tokenizer.decode(new Uint32Array([id]));
        const chunkText = decoder.decode(chunkTextBytes);
        chunks.push(chunkText);
    }

    return chunks;
}

/**
 * Gets the token chunks for the given token IDs using the Web tokenizer.
 * @param {Tokenizer} tokenizer Web tokenizer instance
 * @param {number[]} ids Token IDs
 * @returns {string[]} Token chunks
 */
function getWebTokenizersChunks(tokenizer, ids) {
    const chunks = [];

    for (let i = 0, lastProcessed = 0; i < ids.length; i++) {
        const chunkIds = ids.slice(lastProcessed, i + 1);
        const chunkText = tokenizer.decode(new Int32Array(chunkIds));
        if (chunkText === '�') {
            continue;
        }
        chunks.push(chunkText);
        lastProcessed = i + 1;
    }

    return chunks;
}

/**
 * Gets the tokenizer model by the model name.
 * @param {string} requestModel Models to use for tokenization
 * @returns {string} Tokenizer model to use
 */
export function getTokenizerModel(requestModel) {
    if (requestModel === 'o1' || requestModel.includes('o1-preview') || requestModel.includes('o1-mini') || requestModel.includes('o3-mini')) {
        return 'o1';
    }

    if (requestModel.includes('gpt-5') || requestModel.includes('o3') || requestModel.includes('o4-mini')) {
        return 'o1';
    }

    if (requestModel.includes('gpt-4o') || requestModel.includes('chatgpt-4o-latest')) {
        return 'gpt-4o';
    }

    if (requestModel.includes('gpt-4.1') || requestModel.includes('gpt-4.5')) {
        return 'gpt-4o';
    }

    if (requestModel.includes('gpt-4-32k')) {
        return 'gpt-4-32k';
    }

    if (requestModel.includes('gpt-4')) {
        return 'gpt-4';
    }

    if (requestModel.includes('gpt-3.5-turbo-0301')) {
        return 'gpt-3.5-turbo-0301';
    }

    if (requestModel.includes('gpt-3.5-turbo')) {
        return 'gpt-3.5-turbo';
    }

    if (TEXT_COMPLETION_MODELS.includes(requestModel)) {
        return requestModel;
    }

    if (requestModel.includes('claude')) {
        return 'claude';
    }

    if (requestModel.includes('llama3') || requestModel.includes('llama-3')) {
        return 'llama3';
    }

    if (requestModel.includes('llama')) {
        return 'llama';
    }

    if (requestModel.includes('mistral')) {
        return 'mistral';
    }

    if (requestModel.includes('yi')) {
        return 'yi';
    }

    if (requestModel.includes('deepseek')) {
        return 'deepseek';
    }

    if (requestModel.includes('gemma') || requestModel.includes('gemini') || requestModel.includes('learnlm')) {
        return 'gemma';
    }

    if (requestModel.includes('jamba')) {
        return 'jamba';
    }

    if (requestModel.includes('qwen2')) {
        return 'qwen2';
    }

    if (requestModel.includes('command-r')) {
        return 'command-r';
    }

    if (requestModel.includes('command-a')) {
        return 'command-a';
    }

    if (requestModel.includes('nemo')) {
        return 'nemo';
    }

    // default
    return 'gpt-3.5-turbo';
}

export function getTiktokenTokenizer(model) {
    if (tokenizersCache[model]) {
        return tokenizersCache[model];
    }

    const tokenizer = tiktoken.encoding_for_model(model);
    console.info('Instantiated the tokenizer for', model);
    tokenizersCache[model] = tokenizer;
    return tokenizer;
}

/**
 * Counts the tokens for the given messages using the WebTokenizer and Claude prompt conversion.
 * @param {Tokenizer} tokenizer Web tokenizer
 * @param {object[]} messages Array of messages
 * @returns {number} Number of tokens
 */
export function countWebTokenizerTokens(tokenizer, messages) {
    // Should be fine if we use the old conversion method instead of the messages API one i think?
    const convertedPrompt = convertClaudePrompt(messages, false, '', false, false, '', false);

    // Fallback to strlen estimation
    if (!tokenizer) {
        return Math.ceil(convertedPrompt.length / CHARS_PER_TOKEN);
    }

    const count = tokenizer.encode(convertedPrompt).length;
    return count;
}

/**
 * Creates an API handler for encoding Sentencepiece tokens.
 * @param {SentencePieceTokenizer} tokenizer Sentencepiece tokenizer
 * @returns {TokenizationHandler} Handler function
 */
function createSentencepieceEncodingHandler(tokenizer) {
    /**
     * Request handler for encoding Sentencepiece tokens.
     * @param {import('express').Request} request
     * @param {import('express').Response} response
     */
    return async function (request, response) {
        try {
            if (!request.body) {
                return response.sendStatus(400);
            }

            const text = request.body.text || '';
            const instance = await tokenizer?.get();
            const { ids, count } = await countSentencepieceTokens(tokenizer, text);
            const chunks = instance?.encodePieces(text);
            return response.send({ ids, count, chunks });
        } catch (error) {
            console.error(error);
            return response.send({ ids: [], count: 0, chunks: [] });
        }
    };
}

/**
 * Creates an API handler for decoding Sentencepiece tokens.
 * @param {SentencePieceTokenizer} tokenizer Sentencepiece tokenizer
 * @returns {TokenizationHandler} Handler function
 */
function createSentencepieceDecodingHandler(tokenizer) {
    /**
     * Request handler for decoding Sentencepiece tokens.
     * @param {import('express').Request} request
     * @param {import('express').Response} response
     */
    return async function (request, response) {
        try {
            if (!request.body) {
                return response.sendStatus(400);
            }

            const ids = request.body.ids || [];
            const instance = await tokenizer?.get();
            if (!instance) throw new Error('Failed to load the Sentencepiece tokenizer');
            const ops = ids.map(id => instance.decodeIds([id]));
            const chunks = await Promise.all(ops);
            const text = chunks.join('');
            return response.send({ text, chunks });
        } catch (error) {
            console.error(error);
            return response.send({ text: '', chunks: [] });
        }
    };
}

/**
 * Creates an API handler for encoding Tiktoken tokens.
 * @param {string} modelId Tiktoken model ID
 * @returns {TokenizationHandler} Handler function
 */
function createTiktokenEncodingHandler(modelId) {
    /**
     * Request handler for encoding Tiktoken tokens.
     * @param {import('express').Request} request
     * @param {import('express').Response} response
     */
    return async function (request, response) {
        try {
            if (!request.body) {
                return response.sendStatus(400);
            }

            const text = request.body.text || '';
            const tokenizer = getTiktokenTokenizer(modelId);
            const tokens = Object.values(tokenizer.encode(text));
            const chunks = await getTiktokenChunks(tokenizer, tokens);
            return response.send({ ids: tokens, count: tokens.length, chunks });
        } catch (error) {
            console.error(error);
            return response.send({ ids: [], count: 0, chunks: [] });
        }
    };
}

/**
 * Creates an API handler for decoding Tiktoken tokens.
 * @param {string} modelId Tiktoken model ID
 * @returns {TokenizationHandler} Handler function
 */
function createTiktokenDecodingHandler(modelId) {
    /**
     * Request handler for decoding Tiktoken tokens.
     * @param {import('express').Request} request
     * @param {import('express').Response} response
     */
    return async function (request, response) {
        try {
            if (!request.body) {
                return response.sendStatus(400);
            }

            const ids = request.body.ids || [];
            const tokenizer = getTiktokenTokenizer(modelId);
            const textBytes = tokenizer.decode(new Uint32Array(ids));
            const text = new TextDecoder().decode(textBytes);
            return response.send({ text });
        } catch (error) {
            console.error(error);
            return response.send({ text: '' });
        }
    };
}

/**
 * Creates an API handler for encoding WebTokenizer tokens.
 * @param {WebTokenizer} tokenizer WebTokenizer instance
 * @returns {TokenizationHandler} Handler function
 */
function createWebTokenizerEncodingHandler(tokenizer) {
    /**
     * Request handler for encoding WebTokenizer tokens.
     * @param {import('express').Request} request
     * @param {import('express').Response} response
     */
    return async function (request, response) {
        try {
            if (!request.body) {
                return response.sendStatus(400);
            }

            const text = request.body.text || '';
            const instance = await tokenizer?.get();
            if (!instance) throw new Error('Failed to load the Web tokenizer');
            const tokens = Array.from(instance.encode(text));
            const chunks = getWebTokenizersChunks(instance, tokens);
            return response.send({ ids: tokens, count: tokens.length, chunks });
        } catch (error) {
            console.error(error);
            return response.send({ ids: [], count: 0, chunks: [] });
        }
    };
}

/**
 * Creates an API handler for decoding WebTokenizer tokens.
 * @param {WebTokenizer} tokenizer WebTokenizer instance
 * @returns {TokenizationHandler} Handler function
 */
function createWebTokenizerDecodingHandler(tokenizer) {
    /**
     * Request handler for decoding WebTokenizer tokens.
     * @param {import('express').Request} request
     * @param {import('express').Response} response
     * @returns {Promise<any>}
     */
    return async function (request, response) {
        try {
            if (!request.body) {
                return response.sendStatus(400);
            }

            const ids = request.body.ids || [];
            const instance = await tokenizer?.get();
            if (!instance) throw new Error('Failed to load the Web tokenizer');
            const chunks = getWebTokenizersChunks(instance, ids);
            const text = instance.decode(new Int32Array(ids));
            return response.send({ text, chunks });
        } catch (error) {
            console.error(error);
            return response.send({ text: '', chunks: [] });
        }
    };
}

export const router = express.Router();

router.post('/llama/encode', createSentencepieceEncodingHandler(spp_llama));
router.post('/nerdstash/encode', createSentencepieceEncodingHandler(spp_nerd));
router.post('/nerdstash_v2/encode', createSentencepieceEncodingHandler(spp_nerd_v2));
router.post('/mistral/encode', createSentencepieceEncodingHandler(spp_mistral));
router.post('/yi/encode', createSentencepieceEncodingHandler(spp_yi));
router.post('/gemma/encode', createSentencepieceEncodingHandler(spp_gemma));
router.post('/jamba/encode', createSentencepieceEncodingHandler(spp_jamba));
router.post('/gpt2/encode', createTiktokenEncodingHandler('gpt2'));
router.post('/claude/encode', createWebTokenizerEncodingHandler(claude_tokenizer));
router.post('/llama3/encode', createWebTokenizerEncodingHandler(llama3_tokenizer));
router.post('/qwen2/encode', createWebTokenizerEncodingHandler(qwen2Tokenizer));
router.post('/command-r/encode', createWebTokenizerEncodingHandler(commandRTokenizer));
router.post('/command-a/encode', createWebTokenizerEncodingHandler(commandATokenizer));
router.post('/nemo/encode', createWebTokenizerEncodingHandler(nemoTokenizer));
router.post('/deepseek/encode', createWebTokenizerEncodingHandler(deepseekTokenizer));
router.post('/llama/decode', createSentencepieceDecodingHandler(spp_llama));
router.post('/nerdstash/decode', createSentencepieceDecodingHandler(spp_nerd));
router.post('/nerdstash_v2/decode', createSentencepieceDecodingHandler(spp_nerd_v2));
router.post('/mistral/decode', createSentencepieceDecodingHandler(spp_mistral));
router.post('/yi/decode', createSentencepieceDecodingHandler(spp_yi));
router.post('/gemma/decode', createSentencepieceDecodingHandler(spp_gemma));
router.post('/jamba/decode', createSentencepieceDecodingHandler(spp_jamba));
router.post('/gpt2/decode', createTiktokenDecodingHandler('gpt2'));
router.post('/claude/decode', createWebTokenizerDecodingHandler(claude_tokenizer));
router.post('/llama3/decode', createWebTokenizerDecodingHandler(llama3_tokenizer));
router.post('/qwen2/decode', createWebTokenizerDecodingHandler(qwen2Tokenizer));
router.post('/command-r/decode', createWebTokenizerDecodingHandler(commandRTokenizer));
router.post('/command-a/decode', createWebTokenizerDecodingHandler(commandATokenizer));
router.post('/nemo/decode', createWebTokenizerDecodingHandler(nemoTokenizer));
router.post('/deepseek/decode', createWebTokenizerDecodingHandler(deepseekTokenizer));

router.post('/openai/encode', async function (req, res) {
    try {
        const queryModel = String(req.query.model || '');

        if (queryModel.includes('llama3') || queryModel.includes('llama-3')) {
            const handler = createWebTokenizerEncodingHandler(llama3_tokenizer);
            return handler(req, res);
        }

        if (queryModel.includes('llama')) {
            const handler = createSentencepieceEncodingHandler(spp_llama);
            return handler(req, res);
        }

        if (queryModel.includes('mistral')) {
            const handler = createSentencepieceEncodingHandler(spp_mistral);
            return handler(req, res);
        }

        if (queryModel.includes('yi')) {
            const handler = createSentencepieceEncodingHandler(spp_yi);
            return handler(req, res);
        }

        if (queryModel.includes('claude')) {
            const handler = createWebTokenizerEncodingHandler(claude_tokenizer);
            return handler(req, res);
        }

        if (queryModel.includes('gemma') || queryModel.includes('gemini')) {
            const handler = createSentencepieceEncodingHandler(spp_gemma);
            return handler(req, res);
        }

        if (queryModel.includes('jamba')) {
            const handler = createSentencepieceEncodingHandler(spp_jamba);
            return handler(req, res);
        }

        if (queryModel.includes('qwen2')) {
            const handler = createWebTokenizerEncodingHandler(qwen2Tokenizer);
            return handler(req, res);
        }

        if (queryModel.includes('command-r')) {
            const handler = createWebTokenizerEncodingHandler(commandRTokenizer);
            return handler(req, res);
        }

        if (queryModel.includes('command-a')) {
            const handler = createWebTokenizerEncodingHandler(commandATokenizer);
            return handler(req, res);
        }

        if (queryModel.includes('nemo')) {
            const handler = createWebTokenizerEncodingHandler(nemoTokenizer);
            return handler(req, res);
        }

        if (queryModel.includes('deepseek')) {
            const handler = createWebTokenizerEncodingHandler(deepseekTokenizer);
            return handler(req, res);
        }

        const model = getTokenizerModel(queryModel);
        const handler = createTiktokenEncodingHandler(model);
        return handler(req, res);
    } catch (error) {
        console.error(error);
        return res.send({ ids: [], count: 0, chunks: [] });
    }
});

router.post('/openai/decode', async function (req, res) {
    try {
        const queryModel = String(req.query.model || '');

        if (queryModel.includes('llama3') || queryModel.includes('llama-3')) {
            const handler = createWebTokenizerDecodingHandler(llama3_tokenizer);
            return handler(req, res);
        }

        if (queryModel.includes('llama')) {
            const handler = createSentencepieceDecodingHandler(spp_llama);
            return handler(req, res);
        }

        if (queryModel.includes('mistral')) {
            const handler = createSentencepieceDecodingHandler(spp_mistral);
            return handler(req, res);
        }

        if (queryModel.includes('yi')) {
            const handler = createSentencepieceDecodingHandler(spp_yi);
            return handler(req, res);
        }

        if (queryModel.includes('claude')) {
            const handler = createWebTokenizerDecodingHandler(claude_tokenizer);
            return handler(req, res);
        }

        if (queryModel.includes('gemma') || queryModel.includes('gemini')) {
            const handler = createSentencepieceDecodingHandler(spp_gemma);
            return handler(req, res);
        }

        if (queryModel.includes('jamba')) {
            const handler = createSentencepieceDecodingHandler(spp_jamba);
            return handler(req, res);
        }

        if (queryModel.includes('qwen2')) {
            const handler = createWebTokenizerDecodingHandler(qwen2Tokenizer);
            return handler(req, res);
        }

        if (queryModel.includes('command-r')) {
            const handler = createWebTokenizerDecodingHandler(commandRTokenizer);
            return handler(req, res);
        }

        if (queryModel.includes('command-a')) {
            const handler = createWebTokenizerDecodingHandler(commandATokenizer);
            return handler(req, res);
        }

        if (queryModel.includes('nemo')) {
            const handler = createWebTokenizerDecodingHandler(nemoTokenizer);
            return handler(req, res);
        }

        if (queryModel.includes('deepseek')) {
            const handler = createWebTokenizerDecodingHandler(deepseekTokenizer);
            return handler(req, res);
        }

        const model = getTokenizerModel(queryModel);
        const handler = createTiktokenDecodingHandler(model);
        return handler(req, res);
    } catch (error) {
        console.error(error);
        return res.send({ text: '' });
    }
});

router.post('/openai/count', async function (req, res) {
    try {
        if (!req.body) return res.sendStatus(400);

        let num_tokens = 0;
        const queryModel = String(req.query.model || '');
        const model = getTokenizerModel(queryModel);

        if (model === 'claude') {
            const instance = await claude_tokenizer.get();
            if (!instance) throw new Error('Failed to load the Claude tokenizer');
            num_tokens = countWebTokenizerTokens(instance, req.body);
            return res.send({ 'token_count': num_tokens });
        }

        if (model === 'llama3' || model === 'llama-3') {
            const instance = await llama3_tokenizer.get();
            if (!instance) throw new Error('Failed to load the Llama3 tokenizer');
            num_tokens = countWebTokenizerTokens(instance, req.body);
            return res.send({ 'token_count': num_tokens });
        }

        if (model === 'llama') {
            num_tokens = await countSentencepieceArrayTokens(spp_llama, req.body);
            return res.send({ 'token_count': num_tokens });
        }

        if (model === 'mistral') {
            num_tokens = await countSentencepieceArrayTokens(spp_mistral, req.body);
            return res.send({ 'token_count': num_tokens });
        }

        if (model === 'yi') {
            num_tokens = await countSentencepieceArrayTokens(spp_yi, req.body);
            return res.send({ 'token_count': num_tokens });
        }

        if (model === 'gemma' || model === 'gemini') {
            num_tokens = await countSentencepieceArrayTokens(spp_gemma, req.body);
            return res.send({ 'token_count': num_tokens });
        }

        if (model === 'jamba') {
            num_tokens = await countSentencepieceArrayTokens(spp_jamba, req.body);
            return res.send({ 'token_count': num_tokens });
        }

        if (model === 'qwen2') {
            const instance = await qwen2Tokenizer.get();
            if (!instance) throw new Error('Failed to load the Qwen2 tokenizer');
            num_tokens = countWebTokenizerTokens(instance, req.body);
            return res.send({ 'token_count': num_tokens });
        }

        if (model === 'command-r') {
            const instance = await commandRTokenizer.get();
            if (!instance) throw new Error('Failed to load the Command-R tokenizer');
            num_tokens = countWebTokenizerTokens(instance, req.body);
            return res.send({ 'token_count': num_tokens });
        }

        if (model === 'command-a') {
            const instance = await commandATokenizer.get();
            if (!instance) throw new Error('Failed to load the Command-A tokenizer');
            num_tokens = countWebTokenizerTokens(instance, req.body);
            return res.send({ 'token_count': num_tokens });
        }

        if (model === 'nemo') {
            const instance = await nemoTokenizer.get();
            if (!instance) throw new Error('Failed to load the Nemo tokenizer');
            num_tokens = countWebTokenizerTokens(instance, req.body);
            return res.send({ 'token_count': num_tokens });
        }

        if (model === 'deepseek') {
            const instance = await deepseekTokenizer.get();
            if (!instance) throw new Error('Failed to load the DeepSeek tokenizer');
            num_tokens = countWebTokenizerTokens(instance, req.body);
            return res.send({ 'token_count': num_tokens });
        }

        const tokensPerName = queryModel.includes('gpt-3.5-turbo-0301') ? -1 : 1;
        const tokensPerMessage = queryModel.includes('gpt-3.5-turbo-0301') ? 4 : 3;
        const tokensPadding = 3;

        const tokenizer = getTiktokenTokenizer(model);

        for (const msg of req.body) {
            try {
                num_tokens += tokensPerMessage;
                for (const [key, value] of Object.entries(msg)) {
                    num_tokens += tokenizer.encode(value).length;
                    if (key == 'name') {
                        num_tokens += tokensPerName;
                    }
                }
            } catch {
                console.warn('Error tokenizing message:', msg);
            }
        }
        num_tokens += tokensPadding;

        // NB: Since 2023-10-14, the GPT-3.5 Turbo 0301 model shoves in 7-9 extra tokens to every message.
        // More details: https://community.openai.com/t/gpt-3-5-turbo-0301-showing-different-behavior-suddenly/431326/14
        if (queryModel.includes('gpt-3.5-turbo-0301')) {
            num_tokens += 9;
        }

        // not needed for cached tokenizers
        //tokenizer.free();

        res.send({ 'token_count': num_tokens });
    } catch (error) {
        console.error('An error counting tokens, using fallback estimation method', error);
        const jsonBody = JSON.stringify(req.body);
        const num_tokens = Math.ceil(jsonBody.length / CHARS_PER_TOKEN);
        res.send({ 'token_count': num_tokens });
    }
});

router.post('/remote/kobold/count', async function (request, response) {
    if (!request.body) {
        return response.sendStatus(400);
    }
    const text = String(request.body.text) || '';
    const baseUrl = String(request.body.url);

    try {
        const args = {
            method: 'POST',
            body: JSON.stringify({ 'prompt': text }),
            headers: { 'Content-Type': 'application/json' },
        };

        let url = String(baseUrl).replace(/\/$/, '');
        url += '/extra/tokencount';

        const result = await fetch(url, args);

        if (!result.ok) {
            console.warn(`API returned error: ${result.status} ${result.statusText}`);
            return response.send({ error: true });
        }

        /** @type {any} */
        const data = await result.json();
        const count = data['value'];
        const ids = data['ids'] ?? [];
        return response.send({ count, ids });
    } catch (error) {
        console.error(error);
        return response.send({ error: true });
    }
});

router.post('/remote/textgenerationwebui/encode', async function (request, response) {
    if (!request.body) {
        return response.sendStatus(400);
    }
    const text = String(request.body.text) || '';
    const baseUrl = String(request.body.url);
    const vllmModel = String(request.body.vllm_model) || '';
    const aphroditeModel = String(request.body.aphrodite_model) || '';

    try {
        const args = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        };

        setAdditionalHeaders(request, args, baseUrl);

        // Convert to string + remove trailing slash + /v1 suffix
        let url = String(baseUrl).replace(/\/$/, '').replace(/\/v1$/, '');

        switch (request.body.api_type) {
            case TEXTGEN_TYPES.TABBY:
                url += '/v1/token/encode';
                args.body = JSON.stringify({ 'text': text });
                break;
            case TEXTGEN_TYPES.KOBOLDCPP:
                url += '/api/extra/tokencount';
                args.body = JSON.stringify({ 'prompt': text });
                break;
            case TEXTGEN_TYPES.LLAMACPP:
                url += '/tokenize';
                args.body = JSON.stringify({ 'content': text });
                break;
            case TEXTGEN_TYPES.VLLM:
                url += '/tokenize';
                args.body = JSON.stringify({ 'model': vllmModel, 'prompt': text });
                break;
            case TEXTGEN_TYPES.APHRODITE:
                url += '/v1/tokenize';
                args.body = JSON.stringify({ 'model': aphroditeModel, 'prompt': text });
                break;
            default:
                url += '/v1/internal/encode';
                args.body = JSON.stringify({ 'text': text });
                break;
        }

        const result = await fetch(url, args);

        if (!result.ok) {
            console.warn(`API returned error: ${result.status} ${result.statusText}`);
            return response.send({ error: true });
        }

        /** @type {any} */
        const data = await result.json();
        const count = (data?.length ?? data?.count ?? data?.value ?? data?.tokens?.length);
        const ids = (data?.tokens ?? data?.ids ?? []);

        return response.send({ count, ids });
    } catch (error) {
        console.error(error);
        return response.send({ error: true });
    }
});
