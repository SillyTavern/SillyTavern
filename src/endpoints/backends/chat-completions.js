const express = require('express');
const fetch = require('node-fetch').default;
const { Readable } = require('stream');

const { jsonParser } = require('../../express-common');
const { CHAT_COMPLETION_SOURCES, GEMINI_SAFETY, BISON_SAFETY } = require('../../constants');
const { forwardFetchResponse, getConfigValue, tryParse, uuidv4, mergeObjectWithYaml, excludeKeysByYaml, color } = require('../../util');
const { convertClaudePrompt, convertGooglePrompt, convertTextCompletionPrompt } = require('../prompt-converters');

const { readSecret, SECRET_KEYS } = require('../secrets');
const { getTokenizerModel, getSentencepiceTokenizer, getTiktokenTokenizer, sentencepieceTokenizers, TEXT_COMPLETION_MODELS } = require('../tokenizers');

const API_OPENAI = 'https://api.openai.com/v1';
const API_CLAUDE = 'https://api.anthropic.com/v1';
const API_MISTRAL = 'https://api.mistral.ai/v1';
/**
 * Sends a request to Claude API.
 * @param {express.Request} request Express request
 * @param {express.Response} response Express response
 */
async function sendClaudeRequest(request, response) {
    const apiUrl = new URL(request.body.reverse_proxy || API_CLAUDE).toString();
    const apiKey = request.body.reverse_proxy ? request.body.proxy_password : readSecret(SECRET_KEYS.CLAUDE);
    const divider = '-'.repeat(process.stdout.columns);

    if (!apiKey) {
        console.log(color.red(`Claude API key is missing.\n${divider}`));
        return response.status(400).send({ error: true });
    }

    try {
        const controller = new AbortController();
        request.socket.removeAllListeners('close');
        request.socket.on('close', function () {
            controller.abort();
        });

        const isSysPromptSupported = request.body.model === 'claude-2' || request.body.model === 'claude-2.1';
        const requestPrompt = convertClaudePrompt(request.body.messages, !request.body.exclude_assistant, request.body.assistant_prefill, isSysPromptSupported, request.body.claude_use_sysprompt, request.body.human_sysprompt_message, request.body.claude_exclude_prefixes);

        // Check Claude messages sequence and prefixes presence.
        let sequenceError = [];
        const sequence = requestPrompt.split('\n').filter(x => x.startsWith('Human:') || x.startsWith('Assistant:'));
        const humanFound = sequence.some(line => line.startsWith('Human:'));
        const assistantFound = sequence.some(line => line.startsWith('Assistant:'));
        let humanErrorCount = 0;
        let assistantErrorCount = 0;

        for (let i = 0; i < sequence.length - 1; i++) {
            if (sequence[i].startsWith(sequence[i + 1].split(':')[0])) {
                if (sequence[i].startsWith('Human:')) {
                    humanErrorCount++;
                } else if (sequence[i].startsWith('Assistant:')) {
                    assistantErrorCount++;
                }
            }
        }

        if (!humanFound) {
            sequenceError.push(`${divider}\nWarning: No 'Human:' prefix found in the prompt.\n${divider}`);
        }
        if (!assistantFound) {
            sequenceError.push(`${divider}\nWarning: No 'Assistant: ' prefix found in the prompt.\n${divider}`);
        }
        if (sequence[0] && !sequence[0].startsWith('Human:')) {
            sequenceError.push(`${divider}\nWarning: The messages sequence should start with 'Human:' prefix.\nMake sure you have '\\n\\nHuman:' prefix at the very beggining of the prompt, or after the system prompt.\n${divider}`);
        }
        if (humanErrorCount > 0 || assistantErrorCount > 0) {
            sequenceError.push(`${divider}\nWarning: Detected incorrect Prefix sequence(s).`);
            sequenceError.push(`Incorrect "Human:" prefix(es): ${humanErrorCount}.\nIncorrect "Assistant: " prefix(es): ${assistantErrorCount}.`);
            sequenceError.push('Check the prompt above and fix it in the SillyTavern.');
            sequenceError.push('\nThe correct sequence in the console should look like this:\n(System prompt msg) <-(for the sysprompt format only, else have \\n\\n above the first human\'s  message.)');
            sequenceError.push(`\\n +      <-----(Each message beginning with the "Assistant:/Human:" prefix must have \\n\\n before it.)\n\\n +\nHuman: \\n +\n\\n +\nAssistant: \\n +\n...\n\\n +\nHuman: \\n +\n\\n +\nAssistant: \n${divider}`);
        }

        // Add custom stop sequences
        const stopSequences = ['\n\nHuman:', '\n\nSystem:', '\n\nAssistant:'];
        if (Array.isArray(request.body.stop)) {
            stopSequences.push(...request.body.stop);
        }

        const requestBody = {
            prompt: requestPrompt,
            model: request.body.model,
            max_tokens_to_sample: request.body.max_tokens,
            stop_sequences: stopSequences,
            temperature: request.body.temperature,
            top_p: request.body.top_p,
            top_k: request.body.top_k,
            stream: request.body.stream,
        };

        console.log('Claude request:', requestBody);

        sequenceError.forEach(sequenceError => {
            console.log(color.red(sequenceError));
        });

        const generateResponse = await fetch(apiUrl + '/complete', {
            method: 'POST',
            signal: controller.signal,
            body: JSON.stringify(requestBody),
            headers: {
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01',
                'x-api-key': apiKey,
            },
            timeout: 0,
        });

        if (request.body.stream) {
            // Pipe remote SSE stream to Express response
            forwardFetchResponse(generateResponse, response);
        } else {
            if (!generateResponse.ok) {
                console.log(color.red(`Claude API returned error: ${generateResponse.status} ${generateResponse.statusText}\n${await generateResponse.text()}\n${divider}`));
                return response.status(generateResponse.status).send({ error: true });
            }

            const generateResponseJson = await generateResponse.json();
            const responseText = generateResponseJson.completion;
            console.log('Claude response:', generateResponseJson);

            // Wrap it back to OAI format
            const reply = { choices: [{ 'message': { 'content': responseText } }] };
            return response.send(reply);
        }
    } catch (error) {
        console.log(color.red(`Error communicating with Claude: ${error}\n${divider}`));
        if (!response.headersSent) {
            return response.status(500).send({ error: true });
        }
    }
}

/**
 * Sends a request to Scale Spellbook API.
 * @param {import("express").Request} request Express request
 * @param {import("express").Response} response Express response
 */
async function sendScaleRequest(request, response) {
    const apiUrl = new URL(request.body.api_url_scale).toString();
    const apiKey = readSecret(SECRET_KEYS.SCALE);

    if (!apiKey) {
        console.log('Scale API key is missing.');
        return response.status(400).send({ error: true });
    }

    const requestPrompt = convertTextCompletionPrompt(request.body.messages);
    console.log('Scale request:', requestPrompt);

    try {
        const controller = new AbortController();
        request.socket.removeAllListeners('close');
        request.socket.on('close', function () {
            controller.abort();
        });

        const generateResponse = await fetch(apiUrl, {
            method: 'POST',
            body: JSON.stringify({ input: { input: requestPrompt } }),
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Basic ${apiKey}`,
            },
            timeout: 0,
        });

        if (!generateResponse.ok) {
            console.log(`Scale API returned error: ${generateResponse.status} ${generateResponse.statusText} ${await generateResponse.text()}`);
            return response.status(generateResponse.status).send({ error: true });
        }

        const generateResponseJson = await generateResponse.json();
        console.log('Scale response:', generateResponseJson);

        const reply = { choices: [{ 'message': { 'content': generateResponseJson.output } }] };
        return response.send(reply);
    } catch (error) {
        console.log(error);
        if (!response.headersSent) {
            return response.status(500).send({ error: true });
        }
    }
}

/**
 * Sends a request to Google AI API.
 * @param {express.Request} request Express request
 * @param {express.Response} response Express response
 */
async function sendMakerSuiteRequest(request, response) {
    const apiKey = readSecret(SECRET_KEYS.MAKERSUITE);

    if (!apiKey) {
        console.log('MakerSuite API key is missing.');
        return response.status(400).send({ error: true });
    }

    const model = String(request.body.model);
    const isGemini = model.includes('gemini');
    const isText = model.includes('text');
    const stream = Boolean(request.body.stream) && isGemini;

    const generationConfig = {
        stopSequences: request.body.stop,
        candidateCount: 1,
        maxOutputTokens: request.body.max_tokens,
        temperature: request.body.temperature,
        topP: request.body.top_p,
        topK: request.body.top_k || undefined,
    };

    function getGeminiBody() {
        return {
            contents: convertGooglePrompt(request.body.messages, model),
            safetySettings: GEMINI_SAFETY,
            generationConfig: generationConfig,
        };
    }

    function getBisonBody() {
        const prompt = isText
            ? ({ text: convertTextCompletionPrompt(request.body.messages) })
            : ({ messages: convertGooglePrompt(request.body.messages, model) });

        /** @type {any} Shut the lint up */
        const bisonBody = {
            ...generationConfig,
            safetySettings: BISON_SAFETY,
            candidate_count: 1, // lewgacy spelling
            prompt: prompt,
        };

        if (!isText) {
            delete bisonBody.stopSequences;
            delete bisonBody.maxOutputTokens;
            delete bisonBody.safetySettings;

            if (Array.isArray(prompt.messages)) {
                for (const msg of prompt.messages) {
                    msg.author = msg.role;
                    msg.content = msg.parts[0].text;
                    delete msg.parts;
                    delete msg.role;
                }
            }
        }

        delete bisonBody.candidateCount;
        return bisonBody;
    }

    const body = isGemini ? getGeminiBody() : getBisonBody();
    console.log('MakerSuite request:', body);

    try {
        const controller = new AbortController();
        request.socket.removeAllListeners('close');
        request.socket.on('close', function () {
            controller.abort();
        });

        const apiVersion = isGemini ? 'v1beta' : 'v1beta2';
        const responseType = isGemini
            ? (stream ? 'streamGenerateContent' : 'generateContent')
            : (isText ? 'generateText' : 'generateMessage');

        const generateResponse = await fetch(`https://generativelanguage.googleapis.com/${apiVersion}/models/${model}:${responseType}?key=${apiKey}${stream ? '&alt=sse' : ''}`, {
            body: JSON.stringify(body),
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
            },
            signal: controller.signal,
            timeout: 0,
        });
        // have to do this because of their busted ass streaming endpoint
        if (stream) {
            try {
                // Pipe remote SSE stream to Express response
                forwardFetchResponse(generateResponse, response);
            } catch (error) {
                console.log('Error forwarding streaming response:', error);
                if (!response.headersSent) {
                    return response.status(500).send({ error: true });
                }
            }
        } else {
            if (!generateResponse.ok) {
                console.log(`MakerSuite API returned error: ${generateResponse.status} ${generateResponse.statusText} ${await generateResponse.text()}`);
                return response.status(generateResponse.status).send({ error: true });
            }

            const generateResponseJson = await generateResponse.json();

            const candidates = generateResponseJson?.candidates;
            if (!candidates || candidates.length === 0) {
                let message = 'MakerSuite API returned no candidate';
                console.log(message, generateResponseJson);
                if (generateResponseJson?.promptFeedback?.blockReason) {
                    message += `\nPrompt was blocked due to : ${generateResponseJson.promptFeedback.blockReason}`;
                }
                return response.send({ error: { message } });
            }

            const responseContent = candidates[0].content ?? candidates[0].output;
            const responseText = typeof responseContent === 'string' ? responseContent : responseContent?.parts?.[0]?.text;
            if (!responseText) {
                let message = 'MakerSuite Candidate text empty';
                console.log(message, generateResponseJson);
                return response.send({ error: { message } });
            }

            console.log('MakerSuite response:', responseText);

            // Wrap it back to OAI format
            const reply = { choices: [{ 'message': { 'content': responseText } }] };
            return response.send(reply);
        }
    } catch (error) {
        console.log('Error communicating with MakerSuite API: ', error);
        if (!response.headersSent) {
            return response.status(500).send({ error: true });
        }
    }
}

/**
 * Sends a request to AI21 API.
 * @param {express.Request} request Express request
 * @param {express.Response} response Express response
 */
async function sendAI21Request(request, response) {
    if (!request.body) return response.sendStatus(400);
    const controller = new AbortController();
    console.log(request.body.messages);
    request.socket.removeAllListeners('close');
    request.socket.on('close', function () {
        controller.abort();
    });
    const options = {
        method: 'POST',
        headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            Authorization: `Bearer ${readSecret(SECRET_KEYS.AI21)}`,
        },
        body: JSON.stringify({
            numResults: 1,
            maxTokens: request.body.max_tokens,
            minTokens: 0,
            temperature: request.body.temperature,
            topP: request.body.top_p,
            stopSequences: request.body.stop_tokens,
            topKReturn: request.body.top_k,
            frequencyPenalty: {
                scale: request.body.frequency_penalty * 100,
                applyToWhitespaces: false,
                applyToPunctuations: false,
                applyToNumbers: false,
                applyToStopwords: false,
                applyToEmojis: false,
            },
            presencePenalty: {
                scale: request.body.presence_penalty,
                applyToWhitespaces: false,
                applyToPunctuations: false,
                applyToNumbers: false,
                applyToStopwords: false,
                applyToEmojis: false,
            },
            countPenalty: {
                scale: request.body.count_pen,
                applyToWhitespaces: false,
                applyToPunctuations: false,
                applyToNumbers: false,
                applyToStopwords: false,
                applyToEmojis: false,
            },
            prompt: request.body.messages,
        }),
        signal: controller.signal,
    };

    fetch(`https://api.ai21.com/studio/v1/${request.body.model}/complete`, options)
        .then(r => r.json())
        .then(r => {
            if (r.completions === undefined) {
                console.log(r);
            } else {
                console.log(r.completions[0].data.text);
            }
            const reply = { choices: [{ 'message': { 'content': r.completions[0].data.text } }] };
            return response.send(reply);
        })
        .catch(err => {
            console.error(err);
            return response.send({ error: true });
        });

}

/**
 * Sends a request to MistralAI API.
 * @param {express.Request} request Express request
 * @param {express.Response} response Express response
 */
async function sendMistralAIRequest(request, response) {
    const apiUrl = new URL(request.body.reverse_proxy || API_MISTRAL).toString();
    const apiKey = request.body.reverse_proxy ? request.body.proxy_password : readSecret(SECRET_KEYS.MISTRALAI);

    if (!apiKey) {
        console.log('MistralAI API key is missing.');
        return response.status(400).send({ error: true });
    }

    try {
        //must send a user role as last message
        const messages = Array.isArray(request.body.messages) ? request.body.messages : [];
        const lastMsg = messages[messages.length - 1];
        if (messages.length > 0 && lastMsg && (lastMsg.role === 'system' || lastMsg.role === 'assistant')) {
            if (lastMsg.role === 'assistant' && lastMsg.name) {
                lastMsg.content = lastMsg.name + ': ' + lastMsg.content;
            } else if (lastMsg.role === 'system') {
                lastMsg.content = '[INST] ' + lastMsg.content + ' [/INST]';
            }
            lastMsg.role = 'user';
        }

        //system prompts can be stacked at the start, but any futher sys prompts after the first user/assistant message will break the model
        let encounteredNonSystemMessage = false;
        messages.forEach(msg => {
            if ((msg.role === 'user' || msg.role === 'assistant') && !encounteredNonSystemMessage) {
                encounteredNonSystemMessage = true;
            }

            if (encounteredNonSystemMessage && msg.role === 'system') {
                msg.role = 'user';
                //unsure if the instruct version is what they've deployed on their endpoints and if this will make a difference or not.
                //it should be better than just sending the message as a user role without context though
                msg.content = '[INST] ' + msg.content + ' [/INST]';
            }
        });
        const controller = new AbortController();
        request.socket.removeAllListeners('close');
        request.socket.on('close', function () {
            controller.abort();
        });

        const requestBody = {
            'model': request.body.model,
            'messages': messages,
            'temperature': request.body.temperature,
            'top_p': request.body.top_p,
            'max_tokens': request.body.max_tokens,
            'stream': request.body.stream,
            'safe_prompt': request.body.safe_prompt,
            'random_seed': request.body.seed === -1 ? undefined : request.body.seed,
        };

        const config = {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': 'Bearer ' + apiKey,
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal,
            timeout: 0,
        };

        console.log('MisralAI request:', requestBody);

        const generateResponse = await fetch(apiUrl + '/chat/completions', config);
        if (request.body.stream) {
            forwardFetchResponse(generateResponse, response);
        } else {
            if (!generateResponse.ok) {
                console.log(`MistralAI API returned error: ${generateResponse.status} ${generateResponse.statusText} ${await generateResponse.text()}`);
                // a 401 unauthorized response breaks the frontend auth, so return a 500 instead. prob a better way of dealing with this.
                // 401s are already handled by the streaming processor and dont pop up an error toast, that should probably be fixed too.
                return response.status(generateResponse.status === 401 ? 500 : generateResponse.status).send({ error: true });
            }
            const generateResponseJson = await generateResponse.json();
            console.log('MistralAI response:', generateResponseJson);
            return response.send(generateResponseJson);
        }
    } catch (error) {
        console.log('Error communicating with MistralAI API: ', error);
        if (!response.headersSent) {
            response.send({ error: true });
        } else {
            response.end();
        }
    }
}

const router = express.Router();

router.post('/status', jsonParser, async function (request, response_getstatus_openai) {
    if (!request.body) return response_getstatus_openai.sendStatus(400);

    let api_url;
    let api_key_openai;
    let headers;

    if (request.body.chat_completion_source === CHAT_COMPLETION_SOURCES.OPENAI) {
        api_url = new URL(request.body.reverse_proxy || API_OPENAI).toString();
        api_key_openai = request.body.reverse_proxy ? request.body.proxy_password : readSecret(SECRET_KEYS.OPENAI);
        headers = {};
    } else if (request.body.chat_completion_source === CHAT_COMPLETION_SOURCES.OPENROUTER) {
        api_url = 'https://openrouter.ai/api/v1';
        api_key_openai = readSecret(SECRET_KEYS.OPENROUTER);
        // OpenRouter needs to pass the referer: https://openrouter.ai/docs
        headers = { 'HTTP-Referer': request.headers.referer };
    } else if (request.body.chat_completion_source === CHAT_COMPLETION_SOURCES.MISTRALAI) {
        api_url = new URL(request.body.reverse_proxy || API_MISTRAL).toString();
        api_key_openai = request.body.reverse_proxy ? request.body.proxy_password : readSecret(SECRET_KEYS.MISTRALAI);
        headers = {};
    } else if (request.body.chat_completion_source === CHAT_COMPLETION_SOURCES.CUSTOM) {
        api_url = request.body.custom_url;
        api_key_openai = readSecret(SECRET_KEYS.CUSTOM);
        headers = {};
        mergeObjectWithYaml(headers, request.body.custom_include_headers);
    } else {
        console.log('This chat completion source is not supported yet.');
        return response_getstatus_openai.status(400).send({ error: true });
    }

    if (!api_key_openai && !request.body.reverse_proxy && request.body.chat_completion_source !== CHAT_COMPLETION_SOURCES.CUSTOM) {
        console.log('OpenAI API key is missing.');
        return response_getstatus_openai.status(400).send({ error: true });
    }

    try {
        const response = await fetch(api_url + '/models', {
            method: 'GET',
            headers: {
                'Authorization': 'Bearer ' + api_key_openai,
                ...headers,
            },
        });

        if (response.ok) {
            const data = await response.json();
            response_getstatus_openai.send(data);

            if (request.body.chat_completion_source === CHAT_COMPLETION_SOURCES.OPENROUTER && Array.isArray(data?.data)) {
                let models = [];

                data.data.forEach(model => {
                    const context_length = model.context_length;
                    const tokens_dollar = Number(1 / (1000 * model.pricing?.prompt));
                    const tokens_rounded = (Math.round(tokens_dollar * 1000) / 1000).toFixed(0);
                    models[model.id] = {
                        tokens_per_dollar: tokens_rounded + 'k',
                        context_length: context_length,
                    };
                });

                console.log('Available OpenRouter models:', models);
            } else if (request.body.chat_completion_source === CHAT_COMPLETION_SOURCES.MISTRALAI) {
                const models = data?.data;
                console.log(models);
            } else {
                const models = data?.data;

                if (Array.isArray(models)) {
                    const modelIds = models.filter(x => x && typeof x === 'object').map(x => x.id).sort();
                    console.log('Available OpenAI models:', modelIds);
                } else {
                    console.log('OpenAI endpoint did not return a list of models.');
                }
            }
        }
        else {
            console.log('OpenAI status check failed. Either Access Token is incorrect or API endpoint is down.');
            response_getstatus_openai.send({ error: true, can_bypass: true, data: { data: [] } });
        }
    } catch (e) {
        console.error(e);

        if (!response_getstatus_openai.headersSent) {
            response_getstatus_openai.send({ error: true });
        } else {
            response_getstatus_openai.end();
        }
    }
});

router.post('/bias', jsonParser, async function (request, response) {
    if (!request.body || !Array.isArray(request.body))
        return response.sendStatus(400);

    try {
        const result = {};
        const model = getTokenizerModel(String(request.query.model || ''));

        // no bias for claude
        if (model == 'claude') {
            return response.send(result);
        }

        let encodeFunction;

        if (sentencepieceTokenizers.includes(model)) {
            const tokenizer = getSentencepiceTokenizer(model);
            const instance = await tokenizer?.get();
            encodeFunction = (text) => new Uint32Array(instance?.encodeIds(text));
        } else {
            const tokenizer = getTiktokenTokenizer(model);
            encodeFunction = (tokenizer.encode.bind(tokenizer));
        }

        for (const entry of request.body) {
            if (!entry || !entry.text) {
                continue;
            }

            try {
                const tokens = getEntryTokens(entry.text, encodeFunction);

                for (const token of tokens) {
                    result[token] = entry.value;
                }
            } catch {
                console.warn('Tokenizer failed to encode:', entry.text);
            }
        }

        // not needed for cached tokenizers
        //tokenizer.free();
        return response.send(result);

        /**
         * Gets tokenids for a given entry
         * @param {string} text Entry text
         * @param {(string) => Uint32Array} encode Function to encode text to token ids
         * @returns {Uint32Array} Array of token ids
         */
        function getEntryTokens(text, encode) {
            // Get raw token ids from JSON array
            if (text.trim().startsWith('[') && text.trim().endsWith(']')) {
                try {
                    const json = JSON.parse(text);
                    if (Array.isArray(json) && json.every(x => typeof x === 'number')) {
                        return new Uint32Array(json);
                    }
                } catch {
                    // ignore
                }
            }

            // Otherwise, get token ids from tokenizer
            return encode(text);
        }
    } catch (error) {
        console.error(error);
        return response.send({});
    }
});


router.post('/generate', jsonParser, function (request, response) {
    if (!request.body) return response.status(400).send({ error: true });

    switch (request.body.chat_completion_source) {
        case CHAT_COMPLETION_SOURCES.CLAUDE: return sendClaudeRequest(request, response);
        case CHAT_COMPLETION_SOURCES.SCALE: return sendScaleRequest(request, response);
        case CHAT_COMPLETION_SOURCES.AI21: return sendAI21Request(request, response);
        case CHAT_COMPLETION_SOURCES.MAKERSUITE: return sendMakerSuiteRequest(request, response);
        case CHAT_COMPLETION_SOURCES.MISTRALAI: return sendMistralAIRequest(request, response);
    }

    let apiUrl;
    let apiKey;
    let headers;
    let bodyParams;
    const isTextCompletion = Boolean(request.body.model && TEXT_COMPLETION_MODELS.includes(request.body.model)) || typeof request.body.messages === 'string';

    if (request.body.chat_completion_source === CHAT_COMPLETION_SOURCES.OPENAI) {
        apiUrl = new URL(request.body.reverse_proxy || API_OPENAI).toString();
        apiKey = request.body.reverse_proxy ? request.body.proxy_password : readSecret(SECRET_KEYS.OPENAI);
        headers = {};
        bodyParams = {
            logprobs: request.body.logprobs,
        };

        // Adjust logprobs params for Chat Completions API, which expects { top_logprobs: number; logprobs: boolean; }
        if (!isTextCompletion && bodyParams.logprobs > 0) {
            bodyParams.top_logprobs = bodyParams.logprobs;
            bodyParams.logprobs = true;
        }

        if (getConfigValue('openai.randomizeUserId', false)) {
            bodyParams['user'] = uuidv4();
        }
    } else if (request.body.chat_completion_source === CHAT_COMPLETION_SOURCES.OPENROUTER) {
        apiUrl = 'https://openrouter.ai/api/v1';
        apiKey = readSecret(SECRET_KEYS.OPENROUTER);
        // OpenRouter needs to pass the referer: https://openrouter.ai/docs
        headers = { 'HTTP-Referer': request.headers.referer };
        bodyParams = { 'transforms': ['middle-out'] };

        if (request.body.min_p !== undefined) {
            bodyParams['min_p'] = request.body.min_p;
        }

        if (request.body.top_a !== undefined) {
            bodyParams['top_a'] = request.body.top_a;
        }

        if (request.body.repetition_penalty !== undefined) {
            bodyParams['repetition_penalty'] = request.body.repetition_penalty;
        }

        if (request.body.use_fallback) {
            bodyParams['route'] = 'fallback';
        }
    } else if (request.body.chat_completion_source === CHAT_COMPLETION_SOURCES.CUSTOM) {
        apiUrl = request.body.custom_url;
        apiKey = readSecret(SECRET_KEYS.CUSTOM);
        headers = {};
        bodyParams = {
            logprobs: request.body.logprobs,
        };

        // Adjust logprobs params for Chat Completions API, which expects { top_logprobs: number; logprobs: boolean; }
        if (!isTextCompletion && bodyParams.logprobs > 0) {
            bodyParams.top_logprobs = bodyParams.logprobs;
            bodyParams.logprobs = true;
        }

        mergeObjectWithYaml(bodyParams, request.body.custom_include_body);
        mergeObjectWithYaml(headers, request.body.custom_include_headers);
    } else {
        console.log('This chat completion source is not supported yet.');
        return response.status(400).send({ error: true });
    }

    if (!apiKey && !request.body.reverse_proxy && request.body.chat_completion_source !== CHAT_COMPLETION_SOURCES.CUSTOM) {
        console.log('OpenAI API key is missing.');
        return response.status(400).send({ error: true });
    }

    // Add custom stop sequences
    if (Array.isArray(request.body.stop) && request.body.stop.length > 0) {
        bodyParams['stop'] = request.body.stop;
    }

    const textPrompt = isTextCompletion ? convertTextCompletionPrompt(request.body.messages) : '';
    const endpointUrl = isTextCompletion && request.body.chat_completion_source !== CHAT_COMPLETION_SOURCES.OPENROUTER ?
        `${apiUrl}/completions` :
        `${apiUrl}/chat/completions`;

    const controller = new AbortController();
    request.socket.removeAllListeners('close');
    request.socket.on('close', function () {
        controller.abort();
    });

    const requestBody = {
        'messages': isTextCompletion === false ? request.body.messages : undefined,
        'prompt': isTextCompletion === true ? textPrompt : undefined,
        'model': request.body.model,
        'temperature': request.body.temperature,
        'max_tokens': request.body.max_tokens,
        'stream': request.body.stream,
        'presence_penalty': request.body.presence_penalty,
        'frequency_penalty': request.body.frequency_penalty,
        'top_p': request.body.top_p,
        'top_k': request.body.top_k,
        'stop': isTextCompletion === false ? request.body.stop : undefined,
        'logit_bias': request.body.logit_bias,
        'seed': request.body.seed,
        'n': request.body.n,
        ...bodyParams,
    };

    if (request.body.chat_completion_source === CHAT_COMPLETION_SOURCES.CUSTOM) {
        excludeKeysByYaml(requestBody, request.body.custom_exclude_body);
    }

    /** @type {import('node-fetch').RequestInit} */
    const config = {
        method: 'post',
        headers: {
            'Content-Type': 'application/json',
            'Authorization': 'Bearer ' + apiKey,
            ...headers,
        },
        body: JSON.stringify(requestBody),
        signal: controller.signal,
        timeout: 0,
    };

    console.log(requestBody);

    makeRequest(config, response, request);

    /**
     * Makes a fetch request to the OpenAI API endpoint.
     * @param {import('node-fetch').RequestInit} config Fetch config
     * @param {express.Response} response Express response
     * @param {express.Request} request Express request
     * @param {Number} retries Number of retries left
     * @param {Number} timeout Request timeout in ms
     */
    async function makeRequest(config, response, request, retries = 5, timeout = 5000) {
        try {
            const fetchResponse = await fetch(endpointUrl, config);

            if (request.body.stream) {
                console.log('Streaming request in progress');
                forwardFetchResponse(fetchResponse, response);
                return;
            }

            if (fetchResponse.ok) {
                let json = await fetchResponse.json();
                response.send(json);
                console.log(json);
                console.log(json?.choices?.[0]?.message);
            } else if (fetchResponse.status === 429 && retries > 0) {
                console.log(`Out of quota, retrying in ${Math.round(timeout / 1000)}s`);
                setTimeout(() => {
                    timeout *= 2;
                    makeRequest(config, response, request, retries - 1, timeout);
                }, timeout);
            } else {
                await handleErrorResponse(fetchResponse);
            }
        } catch (error) {
            console.log('Generation failed', error);
            if (!response.headersSent) {
                response.send({ error: true });
            } else {
                response.end();
            }
        }
    }

    /**
     * @param {import("node-fetch").Response} errorResponse
     */
    async function handleErrorResponse(errorResponse) {
        const responseText = await errorResponse.text();
        const errorData = tryParse(responseText);

        const statusMessages = {
            400: 'Bad request',
            401: 'Unauthorized',
            402: 'Credit limit reached',
            403: 'Forbidden',
            404: 'Not found',
            429: 'Too many requests',
            451: 'Unavailable for legal reasons',
            502: 'Bad gateway',
        };

        const message = errorData?.error?.message || statusMessages[errorResponse.status] || 'Unknown error occurred';
        const quota_error = errorResponse.status === 429 && errorData?.error?.type === 'insufficient_quota';
        console.log(message);

        if (!response.headersSent) {
            response.send({ error: { message }, quota_error: quota_error });
        } else if (!response.writableEnded) {
            response.write(errorResponse);
        } else {
            response.end();
        }
    }
});

module.exports = {
    router,
};
