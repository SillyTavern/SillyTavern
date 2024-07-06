const fs = require('fs');
const path = require('path');
const express = require('express');
const { SentencePieceProcessor } = require('@agnai/sentencepiece-js');
const tiktoken = require('tiktoken');
const { Tokenizer } = require('@agnai/web-tokenizers');
const { convertClaudePrompt, convertGooglePrompt } = require('../prompt-converters');
const { readSecret, SECRET_KEYS } = require('./secrets');
const { TEXTGEN_TYPES } = require('../constants');
const { jsonParser } = require('../express-common');
const { setAdditionalHeaders } = require('../additional-headers');

const API_MAKERSUITE = 'https://generativelanguage.googleapis.com';

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
const TEXT_COMPLETION_MODELS = [
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
     * Creates a new Sentencepiece tokenizer.
     * @param {string} model Path to the tokenizer model
     */
    constructor(model) {
        this.#model = model;
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
            this.#instance = new SentencePieceProcessor();
            await this.#instance.load(this.#model);
            console.log('Instantiated the tokenizer for', path.parse(this.#model).name);
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
     * Creates a new Web tokenizer.
     * @param {string} model Path to the tokenizer model
     */
    constructor(model) {
        this.#model = model;
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
            const arrayBuffer = fs.readFileSync(this.#model).buffer;
            this.#instance = await Tokenizer.fromJSON(arrayBuffer);
            console.log('Instantiated the tokenizer for', path.parse(this.#model).name);
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
const claude_tokenizer = new WebTokenizer('src/tokenizers/claude.json');
const llama3_tokenizer = new WebTokenizer('src/tokenizers/llama3.json');

const sentencepieceTokenizers = [
    'llama',
    'nerdstash',
    'nerdstash_v2',
    'mistral',
    'yi',
];

/**
 * Gets the Sentencepiece tokenizer by the model name.
 * @param {string} model Sentencepiece model name
 * @returns {SentencePieceTokenizer|null} Sentencepiece tokenizer
 */
function getSentencepiceTokenizer(model) {
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
function getTokenizerModel(requestModel) {
    if (requestModel.includes('gpt-4o')) {
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

    if (requestModel.includes('gemini')) {
        return 'gpt-4o';
    }

    // default
    return 'gpt-3.5-turbo';
}

function getTiktokenTokenizer(model) {
    if (tokenizersCache[model]) {
        return tokenizersCache[model];
    }

    const tokenizer = tiktoken.encoding_for_model(model);
    console.log('Instantiated the tokenizer for', model);
    tokenizersCache[model] = tokenizer;
    return tokenizer;
}

/**
 * Counts the tokens for the given messages using the WebTokenizer and Claude prompt conversion.
 * @param {Tokenizer} tokenizer Web tokenizer
 * @param {object[]} messages Array of messages
 * @returns {number} Number of tokens
 */
function countWebTokenizerTokens(tokenizer, messages) {
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
            console.log(error);
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
            console.log(error);
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
            console.log(error);
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
            console.log(error);
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
            console.log(error);
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
            console.log(error);
            return response.send({ text: '', chunks: [] });
        }
    };
}

const router = express.Router();

router.post('/ai21/count', jsonParser, async function (req, res) {
    if (!req.body) return res.sendStatus(400);
    const key = readSecret(req.user.directories, SECRET_KEYS.AI21);
    const options = {
        method: 'POST',
        headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            Authorization: `Bearer ${key}`,
        },
        body: JSON.stringify({ text: req.body[0].content }),
    };

    try {
        const response = await fetch('https://api.ai21.com/studio/v1/tokenize', options);
        const data = await response.json();
        return res.send({ 'token_count': data?.tokens?.length || 0 });
    } catch (err) {
        console.error(err);
        return res.send({ 'token_count': 0 });
    }
});

router.post('/google/count', jsonParser, async function (req, res) {
    if (!req.body) return res.sendStatus(400);
    const options = {
        method: 'POST',
        headers: {
            accept: 'application/json',
            'content-type': 'application/json',
        },
        body: JSON.stringify({ contents: convertGooglePrompt(req.body, String(req.query.model)).contents }),
    };
    try {
        const reverseProxy = req.query.reverse_proxy?.toString() || '';
        const proxyPassword = req.query.proxy_password?.toString() || '';
        const apiKey = reverseProxy ? proxyPassword : readSecret(req.user.directories, SECRET_KEYS.MAKERSUITE);
        const apiUrl = new URL(reverseProxy || API_MAKERSUITE);
        const response = await fetch(`${apiUrl.origin}/v1beta/models/${req.query.model}:countTokens?key=${apiKey}`, options);
        const data = await response.json();
        return res.send({ 'token_count': data?.totalTokens || 0 });
    } catch (err) {
        console.error(err);
        return res.send({ 'token_count': 0 });
    }
});

router.post('/llama/encode', jsonParser, createSentencepieceEncodingHandler(spp_llama));
router.post('/nerdstash/encode', jsonParser, createSentencepieceEncodingHandler(spp_nerd));
router.post('/nerdstash_v2/encode', jsonParser, createSentencepieceEncodingHandler(spp_nerd_v2));
router.post('/mistral/encode', jsonParser, createSentencepieceEncodingHandler(spp_mistral));
router.post('/yi/encode', jsonParser, createSentencepieceEncodingHandler(spp_yi));
router.post('/gpt2/encode', jsonParser, createTiktokenEncodingHandler('gpt2'));
router.post('/claude/encode', jsonParser, createWebTokenizerEncodingHandler(claude_tokenizer));
router.post('/llama3/encode', jsonParser, createWebTokenizerEncodingHandler(llama3_tokenizer));
router.post('/llama/decode', jsonParser, createSentencepieceDecodingHandler(spp_llama));
router.post('/nerdstash/decode', jsonParser, createSentencepieceDecodingHandler(spp_nerd));
router.post('/nerdstash_v2/decode', jsonParser, createSentencepieceDecodingHandler(spp_nerd_v2));
router.post('/mistral/decode', jsonParser, createSentencepieceDecodingHandler(spp_mistral));
router.post('/yi/decode', jsonParser, createSentencepieceDecodingHandler(spp_yi));
router.post('/gpt2/decode', jsonParser, createTiktokenDecodingHandler('gpt2'));
router.post('/claude/decode', jsonParser, createWebTokenizerDecodingHandler(claude_tokenizer));
router.post('/llama3/decode', jsonParser, createWebTokenizerDecodingHandler(llama3_tokenizer));

router.post('/openai/encode', jsonParser, async function (req, res) {
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

        const model = getTokenizerModel(queryModel);
        const handler = createTiktokenEncodingHandler(model);
        return handler(req, res);
    } catch (error) {
        console.log(error);
        return res.send({ ids: [], count: 0, chunks: [] });
    }
});

router.post('/openai/decode', jsonParser, async function (req, res) {
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

        const model = getTokenizerModel(queryModel);
        const handler = createTiktokenDecodingHandler(model);
        return handler(req, res);
    } catch (error) {
        console.log(error);
        return res.send({ text: '' });
    }
});

router.post('/openai/count', jsonParser, async function (req, res) {
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

router.post('/remote/kobold/count', jsonParser, async function (request, response) {
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
            console.log(`API returned error: ${result.status} ${result.statusText}`);
            return response.send({ error: true });
        }

        const data = await result.json();
        const count = data['value'];
        const ids = data['ids'] ?? [];
        return response.send({ count, ids });
    } catch (error) {
        console.log(error);
        return response.send({ error: true });
    }
});

router.post('/remote/textgenerationwebui/encode', jsonParser, async function (request, response) {
    if (!request.body) {
        return response.sendStatus(400);
    }
    const text = String(request.body.text) || '';
    const baseUrl = String(request.body.url);
    const legacyApi = Boolean(request.body.legacy_api);
    const vllmModel = String(request.body.vllm_model) || '';

    try {
        const args = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
        };

        setAdditionalHeaders(request, args, baseUrl);

        // Convert to string + remove trailing slash + /v1 suffix
        let url = String(baseUrl).replace(/\/$/, '').replace(/\/v1$/, '');

        if (legacyApi) {
            url += '/v1/token-count';
            args.body = JSON.stringify({ 'prompt': text });
        } else {
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
                    args.body = JSON.stringify({ 'prompt': text });
                    break;
                default:
                    url += '/v1/internal/encode';
                    args.body = JSON.stringify({ 'text': text });
                    break;
            }
        }

        const result = await fetch(url, args);

        if (!result.ok) {
            console.log(`API returned error: ${result.status} ${result.statusText}`);
            return response.send({ error: true });
        }

        const data = await result.json();
        const count = legacyApi ? data?.results[0]?.tokens : (data?.length ?? data?.count ?? data?.value ?? data?.tokens?.length);
        const ids = legacyApi ? [] : (data?.tokens ?? data?.ids ?? []);

        return response.send({ count, ids });
    } catch (error) {
        console.log(error);
        return response.send({ error: true });
    }
});

module.exports = {
    TEXT_COMPLETION_MODELS,
    getTokenizerModel,
    getTiktokenTokenizer,
    countWebTokenizerTokens,
    getSentencepiceTokenizer,
    sentencepieceTokenizers,
    router,
};
