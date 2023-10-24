const fs = require('fs');
const { SentencePieceProcessor } = require("@agnai/sentencepiece-js");
const tiktoken = require('@dqbd/tiktoken');
const { Tokenizer } = require('@agnai/web-tokenizers');
const { convertClaudePrompt } = require('./chat-completion');
const { readSecret, SECRET_KEYS } = require('./secrets');

/**
 * @type {{[key: string]: import("@dqbd/tiktoken").Tiktoken}} Tokenizers cache
 */
const tokenizersCache = {};

/**
 * @type {string[]}
 */
const TEXT_COMPLETION_MODELS = [
    "gpt-3.5-turbo-instruct",
    "gpt-3.5-turbo-instruct-0914",
    "text-davinci-003",
    "text-davinci-002",
    "text-davinci-001",
    "text-curie-001",
    "text-babbage-001",
    "text-ada-001",
    "code-davinci-002",
    "code-davinci-001",
    "code-cushman-002",
    "code-cushman-001",
    "text-davinci-edit-001",
    "code-davinci-edit-001",
    "text-embedding-ada-002",
    "text-similarity-davinci-001",
    "text-similarity-curie-001",
    "text-similarity-babbage-001",
    "text-similarity-ada-001",
    "text-search-davinci-doc-001",
    "text-search-curie-doc-001",
    "text-search-babbage-doc-001",
    "text-search-ada-doc-001",
    "code-search-babbage-code-001",
    "code-search-ada-code-001",
];

const CHARS_PER_TOKEN = 3.35;

let spp_llama;
let spp_nerd;
let spp_nerd_v2;
let claude_tokenizer;

async function loadSentencepieceTokenizer(modelPath) {
    try {
        const spp = new SentencePieceProcessor();
        await spp.load(modelPath);
        return spp;
    } catch (error) {
        console.error("Sentencepiece tokenizer failed to load: " + modelPath, error);
        return null;
    }
};

async function countSentencepieceTokens(spp, text) {
    // Fallback to strlen estimation
    if (!spp) {
        return {
            ids: [],
            count: Math.ceil(text.length / CHARS_PER_TOKEN)
        };
    }

    let cleaned = text; // cleanText(text); <-- cleaning text can result in an incorrect tokenization

    let ids = spp.encodeIds(cleaned);
    return {
        ids,
        count: ids.length
    };
}

/**
 * Gets the tokenizer model by the model name.
 * @param {string} requestModel Models to use for tokenization
 * @returns {string} Tokenizer model to use
 */
function getTokenizerModel(requestModel) {
    if (requestModel.includes('claude')) {
        return 'claude';
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

async function loadClaudeTokenizer(modelPath) {
    try {
        const arrayBuffer = fs.readFileSync(modelPath).buffer;
        const instance = await Tokenizer.fromJSON(arrayBuffer);
        return instance;
    } catch (error) {
        console.error("Claude tokenizer failed to load: " + modelPath, error);
        return null;
    }
}

function countClaudeTokens(tokenizer, messages) {
    const convertedPrompt = convertClaudePrompt(messages, false, false);

    // Fallback to strlen estimation
    if (!tokenizer) {
        return Math.ceil(convertedPrompt.length / CHARS_PER_TOKEN);
    }

    const count = tokenizer.encode(convertedPrompt).length;
    return count;
}

/**
 * Creates an API handler for encoding Sentencepiece tokens.
 * @param {function} getTokenizerFn Tokenizer provider function
 * @returns {any} Handler function
 */
function createSentencepieceEncodingHandler(getTokenizerFn) {
    return async function (request, response) {
        try {
            if (!request.body) {
                return response.sendStatus(400);
            }

            const text = request.body.text || '';
            const tokenizer = getTokenizerFn();
            const { ids, count } = await countSentencepieceTokens(tokenizer, text);
            return response.send({ ids, count });
        } catch (error) {
            console.log(error);
            return response.send({ ids: [], count: 0 });
        }
    };
}

/**
 * Creates an API handler for decoding Sentencepiece tokens.
 * @param {function} getTokenizerFn Tokenizer provider function
 * @returns {any} Handler function
 */
function createSentencepieceDecodingHandler(getTokenizerFn) {
    return async function (request, response) {
        try {
            if (!request.body) {
                return response.sendStatus(400);
            }

            const ids = request.body.ids || [];
            const tokenizer = getTokenizerFn();
            const text = await tokenizer.decodeIds(ids);
            return response.send({ text });
        } catch (error) {
            console.log(error);
            return response.send({ text: '' });
        }
    };
}

/**
 * Creates an API handler for encoding Tiktoken tokens.
 * @param {string} modelId Tiktoken model ID
 * @returns {any} Handler function
 */
function createTiktokenEncodingHandler(modelId) {
    return async function (request, response) {
        try {
            if (!request.body) {
                return response.sendStatus(400);
            }

            const text = request.body.text || '';
            const tokenizer = getTiktokenTokenizer(modelId);
            const tokens = Object.values(tokenizer.encode(text));
            return response.send({ ids: tokens, count: tokens.length });
        } catch (error) {
            console.log(error);
            return response.send({ ids: [], count: 0 });
        }
    }
}

/**
 * Creates an API handler for decoding Tiktoken tokens.
 * @param {string} modelId Tiktoken model ID
 * @returns {any} Handler function
 */
function createTiktokenDecodingHandler(modelId) {
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
    }
}

/**
 * Loads the model tokenizers.
 * @returns {Promise<void>} Promise that resolves when the tokenizers are loaded
 */
async function loadTokenizers() {
    [spp_llama, spp_nerd, spp_nerd_v2, claude_tokenizer] = await Promise.all([
        loadSentencepieceTokenizer('src/sentencepiece/tokenizer.model'),
        loadSentencepieceTokenizer('src/sentencepiece/nerdstash.model'),
        loadSentencepieceTokenizer('src/sentencepiece/nerdstash_v2.model'),
        loadClaudeTokenizer('src/claude.json'),
    ]);
}

/**
 * Registers the tokenization endpoints.
 * @param {import('express').Express} app Express app
 * @param {any} jsonParser JSON parser middleware
 */
function registerEndpoints(app, jsonParser) {
    app.post("/api/tokenize/ai21", jsonParser, async function (req, res) {
        if (!req.body) return res.sendStatus(400);
        const options = {
            method: 'POST',
            headers: {
                accept: 'application/json',
                'content-type': 'application/json',
                Authorization: `Bearer ${readSecret(SECRET_KEYS.AI21)}`
            },
            body: JSON.stringify({ text: req.body[0].content })
        };

        try {
            const response = await fetch('https://api.ai21.com/studio/v1/tokenize', options);
            const data = await response.json();
            return res.send({ "token_count": data?.tokens?.length || 0 });
        } catch (err) {
            console.error(err);
            return res.send({ "token_count": 0 });
        }
    });

    app.post("/api/tokenize/llama", jsonParser, createSentencepieceEncodingHandler(() => spp_llama));
    app.post("/api/tokenize/nerdstash", jsonParser, createSentencepieceEncodingHandler(() => spp_nerd));
    app.post("/api/tokenize/nerdstash_v2", jsonParser, createSentencepieceEncodingHandler(() => spp_nerd_v2));
    app.post("/api/tokenize/gpt2", jsonParser, createTiktokenEncodingHandler('gpt2'));
    app.post("/api/decode/llama", jsonParser, createSentencepieceDecodingHandler(() => spp_llama));
    app.post("/api/decode/nerdstash", jsonParser, createSentencepieceDecodingHandler(() => spp_nerd));
    app.post("/api/decode/nerdstash_v2", jsonParser, createSentencepieceDecodingHandler(() => spp_nerd_v2));
    app.post("/api/decode/gpt2", jsonParser, createTiktokenDecodingHandler('gpt2'));

    app.post("/api/tokenize/openai", jsonParser, function (req, res) {
        if (!req.body) return res.sendStatus(400);

        let num_tokens = 0;
        const queryModel = String(req.query.model || '');
        const model = getTokenizerModel(queryModel);

        if (model == 'claude') {
            num_tokens = countClaudeTokens(claude_tokenizer, req.body);
            return res.send({ "token_count": num_tokens });
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
                    if (key == "name") {
                        num_tokens += tokensPerName;
                    }
                }
            } catch {
                console.warn("Error tokenizing message:", msg);
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

        res.send({ "token_count": num_tokens });
    });
}

module.exports = {
    TEXT_COMPLETION_MODELS,
    getTokenizerModel,
    getTiktokenTokenizer,
    loadSentencepieceTokenizer,
    loadClaudeTokenizer,
    countSentencepieceTokens,
    countClaudeTokens,
    loadTokenizers,
    registerEndpoints,
}
