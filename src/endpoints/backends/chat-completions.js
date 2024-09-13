const express = require('express');
const fetch = require('node-fetch').default;

const { jsonParser } = require('../../express-common');
const { CHAT_COMPLETION_SOURCES, GEMINI_SAFETY, BISON_SAFETY, OPENROUTER_HEADERS } = require('../../constants');
const { forwardFetchResponse, getConfigValue, tryParse, uuidv4, mergeObjectWithYaml, excludeKeysByYaml, color } = require('../../util');
const { convertClaudeMessages, convertGooglePrompt, convertTextCompletionPrompt, convertCohereMessages, convertMistralMessages, convertCohereTools, convertAI21Messages } = require('../../prompt-converters');
const CohereStream = require('../../cohere-stream');

const { readSecret, SECRET_KEYS } = require('../secrets');
const { getTokenizerModel, getSentencepiceTokenizer, getTiktokenTokenizer, sentencepieceTokenizers, TEXT_COMPLETION_MODELS } = require('../tokenizers');

const API_OPENAI = 'https://api.openai.com/v1';
const API_CLAUDE = 'https://api.anthropic.com/v1';
const API_MISTRAL = 'https://api.mistral.ai/v1';
const API_COHERE = 'https://api.cohere.ai/v1';
const API_PERPLEXITY = 'https://api.perplexity.ai';
const API_GROQ = 'https://api.groq.com/openai/v1';
const API_MAKERSUITE = 'https://generativelanguage.googleapis.com';
const API_01AI = 'https://api.01.ai/v1';
const API_BLOCKENTROPY = 'https://api.blockentropy.ai/v1';
const API_AI21 = 'https://api.ai21.com/studio/v1';

/**
 * Applies a post-processing step to the generated messages.
 * @param {object[]} messages Messages to post-process
 * @param {string} type Prompt conversion type
 * @param {string} charName Character name
 * @param {string} userName User name
 * @returns
 */
function postProcessPrompt(messages, type, charName, userName) {
    switch (type) {
        case 'claude':
            return convertClaudeMessages(messages, '', false, '', charName, userName).messages;
        default:
            return messages;
    }
}

/**
 * Ollama strikes back. Special boy #2's steaming routine.
 * Wrap this abomination into proper SSE stream, again.
 * @param {Response} jsonStream JSON stream
 * @param {import('express').Request} request Express request
 * @param {import('express').Response} response Express response
 * @returns {Promise<any>} Nothing valuable
 */
async function parseCohereStream(jsonStream, request, response) {
    try {
        const stream = new CohereStream({ stream: jsonStream.body, eventShape: { type: 'json', messageTerminator: '\n' } });

        for await (const json of stream.iterMessages()) {
            if (json.message) {
                const message = json.message || 'Unknown error';
                const chunk = { error: { message: message } };
                response.write(`data: ${JSON.stringify(chunk)}\n\n`);
            } else if (json.event_type === 'text-generation') {
                const text = json.text || '';
                const chunk = { choices: [{ text }] };
                response.write(`data: ${JSON.stringify(chunk)}\n\n`);
            }
        }

        console.log('Streaming request finished');
        response.write('data: [DONE]\n\n');
        response.end();
    } catch (error) {
        console.log('Error forwarding streaming response:', error);
        if (!response.headersSent) {
            return response.status(500).send({ error: true });
        } else {
            return response.end();
        }
    }
}

/**
 * Sends a request to Claude API.
 * @param {express.Request} request Express request
 * @param {express.Response} response Express response
 */
async function sendClaudeRequest(request, response) {
    const apiUrl = new URL(request.body.reverse_proxy || API_CLAUDE).toString();
    const apiKey = request.body.reverse_proxy ? request.body.proxy_password : readSecret(request.user.directories, SECRET_KEYS.CLAUDE);
    const divider = '-'.repeat(process.stdout.columns);
    const enableSystemPromptCache = getConfigValue('claude.enableSystemPromptCache', false);

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
        const additionalHeaders = {};
        const useSystemPrompt = (request.body.model.startsWith('claude-2') || request.body.model.startsWith('claude-3')) && request.body.claude_use_sysprompt;
        const convertedPrompt = convertClaudeMessages(request.body.messages, request.body.assistant_prefill, useSystemPrompt, request.body.human_sysprompt_message, request.body.char_name, request.body.user_name);
        // Add custom stop sequences
        const stopSequences = [];
        if (Array.isArray(request.body.stop)) {
            stopSequences.push(...request.body.stop);
        }

        const requestBody = {
            messages: convertedPrompt.messages,
            model: request.body.model,
            max_tokens: request.body.max_tokens,
            stop_sequences: stopSequences,
            temperature: request.body.temperature,
            top_p: request.body.top_p,
            top_k: request.body.top_k,
            stream: request.body.stream,
        };
        if (useSystemPrompt) {
            requestBody.system = enableSystemPromptCache
                ? [{ type: 'text', text: convertedPrompt.systemPrompt, cache_control: { type: 'ephemeral' } }]
                : convertedPrompt.systemPrompt;
        }
        if (Array.isArray(request.body.tools) && request.body.tools.length > 0) {
            // Claude doesn't do prefills on function calls, and doesn't allow empty messages
            if (convertedPrompt.messages.length && convertedPrompt.messages[convertedPrompt.messages.length - 1].role === 'assistant') {
                convertedPrompt.messages.push({ role: 'user', content: '.' });
            }
            additionalHeaders['anthropic-beta'] = 'tools-2024-05-16';
            requestBody.tool_choice = { type: request.body.tool_choice === 'required' ? 'any' : 'auto' };
            requestBody.tools = request.body.tools
                .filter(tool => tool.type === 'function')
                .map(tool => tool.function)
                .map(fn => ({ name: fn.name, description: fn.description, input_schema: fn.parameters }));
        }
        if (enableSystemPromptCache) {
            additionalHeaders['anthropic-beta'] = 'prompt-caching-2024-07-31';
        }
        console.log('Claude request:', requestBody);

        const generateResponse = await fetch(apiUrl + '/messages', {
            method: 'POST',
            signal: controller.signal,
            body: JSON.stringify(requestBody),
            headers: {
                'Content-Type': 'application/json',
                'anthropic-version': '2023-06-01',
                'x-api-key': apiKey,
                ...additionalHeaders,
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
            const responseText = generateResponseJson.content[0].text;
            console.log('Claude response:', generateResponseJson);

            // Wrap it back to OAI format + save the original content
            const reply = { choices: [{ 'message': { 'content': responseText } }], content: generateResponseJson.content };
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
    const apiKey = readSecret(request.user.directories, SECRET_KEYS.SCALE);

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
            return response.status(500).send({ error: true });
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
    const apiUrl = new URL(request.body.reverse_proxy || API_MAKERSUITE);
    const apiKey = request.body.reverse_proxy ? request.body.proxy_password : readSecret(request.user.directories, SECRET_KEYS.MAKERSUITE);

    if (!request.body.reverse_proxy && !apiKey) {
        console.log('Google AI Studio API key is missing.');
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
        const should_use_system_prompt = (model.includes('gemini-1.5-flash') || model.includes('gemini-1.5-pro')) && request.body.use_makersuite_sysprompt;
        const prompt = convertGooglePrompt(request.body.messages, model, should_use_system_prompt, request.body.char_name, request.body.user_name);
        let body = {
            contents: prompt.contents,
            safetySettings: GEMINI_SAFETY,
            generationConfig: generationConfig,
        };

        if (should_use_system_prompt) {
            body.system_instruction = prompt.system_instruction;
        }

        return body;
    }

    function getBisonBody() {
        const prompt = isText
            ? ({ text: convertTextCompletionPrompt(request.body.messages) })
            : ({ messages: convertGooglePrompt(request.body.messages, model).contents });

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
    console.log('Google AI Studio request:', body);

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

        const generateResponse = await fetch(`${apiUrl.origin}/${apiVersion}/models/${model}:${responseType}?key=${apiKey}${stream ? '&alt=sse' : ''}`, {
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
                console.log(`Google AI Studio API returned error: ${generateResponse.status} ${generateResponse.statusText} ${await generateResponse.text()}`);
                return response.status(generateResponse.status).send({ error: true });
            }

            const generateResponseJson = await generateResponse.json();

            const candidates = generateResponseJson?.candidates;
            if (!candidates || candidates.length === 0) {
                let message = 'Google AI Studio API returned no candidate';
                console.log(message, generateResponseJson);
                if (generateResponseJson?.promptFeedback?.blockReason) {
                    message += `\nPrompt was blocked due to : ${generateResponseJson.promptFeedback.blockReason}`;
                }
                return response.send({ error: { message } });
            }

            const responseContent = candidates[0].content ?? candidates[0].output;
            const responseText = typeof responseContent === 'string' ? responseContent : responseContent?.parts?.[0]?.text;
            if (!responseText) {
                let message = 'Google AI Studio Candidate text empty';
                console.log(message, generateResponseJson);
                return response.send({ error: { message } });
            }

            console.log('Google AI Studio response:', responseText);

            // Wrap it back to OAI format
            const reply = { choices: [{ 'message': { 'content': responseText } }] };
            return response.send(reply);
        }
    } catch (error) {
        console.log('Error communicating with Google AI Studio API: ', error);
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
    const convertedPrompt = convertAI21Messages(request.body.messages, request.body.char_name, request.body.user_name);
    const body = {
        messages: convertedPrompt,
        model: request.body.model,
        max_tokens: request.body.max_tokens,
        temperature: request.body.temperature,
        top_p: request.body.top_p,
        stop: request.body.stop,
        stream: request.body.stream,
    };
    const options = {
        method: 'POST',
        headers: {
            accept: 'application/json',
            'content-type': 'application/json',
            Authorization: `Bearer ${readSecret(request.user.directories, SECRET_KEYS.AI21)}`,
        },
        body: JSON.stringify(body),
        signal: controller.signal,
    };

    console.log('AI21 request:', body);

    try {
        const generateResponse = await fetch(API_AI21 + '/chat/completions', options);
        if (request.body.stream) {
            forwardFetchResponse(generateResponse, response);
        } else {
            if (!generateResponse.ok) {
                const errorText = await generateResponse.text();
                console.log(`AI21 API returned error: ${generateResponse.status} ${generateResponse.statusText} ${errorText}`);
                const errorJson = tryParse(errorText) ?? { error: true };
                return response.status(500).send(errorJson);
            }
            const generateResponseJson = await generateResponse.json();
            console.log('AI21 response:', generateResponseJson);
            return response.send(generateResponseJson);
        }
    } catch (error) {
        console.log('Error communicating with AI21 API: ', error);
        if (!response.headersSent) {
            response.send({ error: true });
        } else {
            response.end();
        }
    }
}

/**
 * Sends a request to MistralAI API.
 * @param {express.Request} request Express request
 * @param {express.Response} response Express response
 */
async function sendMistralAIRequest(request, response) {
    const apiUrl = new URL(request.body.reverse_proxy || API_MISTRAL).toString();
    const apiKey = request.body.reverse_proxy ? request.body.proxy_password : readSecret(request.user.directories, SECRET_KEYS.MISTRALAI);

    if (!apiKey) {
        console.log('MistralAI API key is missing.');
        return response.status(400).send({ error: true });
    }

    try {
        const messages = convertMistralMessages(request.body.messages, request.body.char_name, request.body.user_name);
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

        if (Array.isArray(request.body.tools) && request.body.tools.length > 0) {
            requestBody['tools'] = request.body.tools;
            requestBody['tool_choice'] = request.body.tool_choice === 'required' ? 'any' : 'auto';
        }

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
                const errorText = await generateResponse.text();
                console.log(`MistralAI API returned error: ${generateResponse.status} ${generateResponse.statusText} ${errorText}`);
                const errorJson = tryParse(errorText) ?? { error: true };
                return response.status(500).send(errorJson);
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

/**
 * Sends a request to Cohere API.
 * @param {express.Request} request Express request
 * @param {express.Response} response Express response
 */
async function sendCohereRequest(request, response) {
    const apiKey = readSecret(request.user.directories, SECRET_KEYS.COHERE);
    const controller = new AbortController();
    request.socket.removeAllListeners('close');
    request.socket.on('close', function () {
        controller.abort();
    });

    if (!apiKey) {
        console.log('Cohere API key is missing.');
        return response.status(400).send({ error: true });
    }

    try {
        const convertedHistory = convertCohereMessages(request.body.messages, request.body.char_name, request.body.user_name);
        const connectors = [];
        const tools = [];

        const canDoWebSearch = !String(request.body.model).includes('c4ai-aya');
        if (request.body.websearch && canDoWebSearch) {
            connectors.push({
                id: 'web-search',
            });
        }

        if (Array.isArray(request.body.tools) && request.body.tools.length > 0) {
            tools.push(...convertCohereTools(request.body.tools));
            // Can't have both connectors and tools in the same request
            connectors.splice(0, connectors.length);
        }

        // https://docs.cohere.com/reference/chat
        const requestBody = {
            stream: Boolean(request.body.stream),
            model: request.body.model,
            message: convertedHistory.userPrompt,
            preamble: convertedHistory.systemPrompt,
            chat_history: convertedHistory.chatHistory,
            temperature: request.body.temperature,
            max_tokens: request.body.max_tokens,
            k: request.body.top_k,
            p: request.body.top_p,
            seed: request.body.seed,
            stop_sequences: request.body.stop,
            frequency_penalty: request.body.frequency_penalty,
            presence_penalty: request.body.presence_penalty,
            prompt_truncation: 'AUTO_PRESERVE_ORDER',
            connectors: connectors,
            documents: [],
            tools: tools,
            search_queries_only: false,
        };

        const canDoSafetyMode = String(request.body.model).endsWith('08-2024');
        if (canDoSafetyMode) {
            requestBody.safety_mode = 'NONE';
        }

        console.log('Cohere request:', requestBody);

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

        const apiUrl = API_COHERE + '/chat';

        if (request.body.stream) {
            const stream = await global.fetch(apiUrl, config);
            parseCohereStream(stream, request, response);
        } else {
            const generateResponse = await fetch(apiUrl, config);
            if (!generateResponse.ok) {
                const errorText = await generateResponse.text();
                console.log(`Cohere API returned error: ${generateResponse.status} ${generateResponse.statusText} ${errorText}`);
                const errorJson = tryParse(errorText) ?? { error: true };
                return response.status(500).send(errorJson);
            }
            const generateResponseJson = await generateResponse.json();
            console.log('Cohere response:', generateResponseJson);
            return response.send(generateResponseJson);
        }
    } catch (error) {
        console.log('Error communicating with Cohere API: ', error);
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
        api_key_openai = request.body.reverse_proxy ? request.body.proxy_password : readSecret(request.user.directories, SECRET_KEYS.OPENAI);
        headers = {};
    } else if (request.body.chat_completion_source === CHAT_COMPLETION_SOURCES.OPENROUTER) {
        api_url = 'https://openrouter.ai/api/v1';
        api_key_openai = readSecret(request.user.directories, SECRET_KEYS.OPENROUTER);
        // OpenRouter needs to pass the Referer and X-Title: https://openrouter.ai/docs#requests
        headers = { ...OPENROUTER_HEADERS };
    } else if (request.body.chat_completion_source === CHAT_COMPLETION_SOURCES.MISTRALAI) {
        api_url = new URL(request.body.reverse_proxy || API_MISTRAL).toString();
        api_key_openai = request.body.reverse_proxy ? request.body.proxy_password : readSecret(request.user.directories, SECRET_KEYS.MISTRALAI);
        headers = {};
    } else if (request.body.chat_completion_source === CHAT_COMPLETION_SOURCES.CUSTOM) {
        api_url = request.body.custom_url;
        api_key_openai = readSecret(request.user.directories, SECRET_KEYS.CUSTOM);
        headers = {};
        mergeObjectWithYaml(headers, request.body.custom_include_headers);
    } else if (request.body.chat_completion_source === CHAT_COMPLETION_SOURCES.COHERE) {
        api_url = API_COHERE;
        api_key_openai = readSecret(request.user.directories, SECRET_KEYS.COHERE);
        headers = {};
    } else if (request.body.chat_completion_source === CHAT_COMPLETION_SOURCES.ZEROONEAI) {
        api_url = API_01AI;
        api_key_openai = readSecret(request.user.directories, SECRET_KEYS.ZEROONEAI);
        headers = {};
    } else if (request.body.chat_completion_source === CHAT_COMPLETION_SOURCES.BLOCKENTROPY) {
        api_url = API_BLOCKENTROPY;
        api_key_openai = readSecret(request.user.directories, SECRET_KEYS.BLOCKENTROPY);
        headers = {};
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

            if (request.body.chat_completion_source === CHAT_COMPLETION_SOURCES.COHERE && Array.isArray(data?.models)) {
                data.data = data.models.map(model => ({ id: model.name, ...model }));
            }

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
            if (!instance) {
                console.warn('Tokenizer not initialized:', model);
                return response.send({});
            }
            encodeFunction = (text) => new Uint32Array(instance.encodeIds(text));
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
        case CHAT_COMPLETION_SOURCES.COHERE: return sendCohereRequest(request, response);
    }

    let apiUrl;
    let apiKey;
    let headers;
    let bodyParams;
    const isTextCompletion = Boolean(request.body.model && TEXT_COMPLETION_MODELS.includes(request.body.model)) || typeof request.body.messages === 'string';

    if (request.body.chat_completion_source === CHAT_COMPLETION_SOURCES.OPENAI) {
        apiUrl = new URL(request.body.reverse_proxy || API_OPENAI).toString();
        apiKey = request.body.reverse_proxy ? request.body.proxy_password : readSecret(request.user.directories, SECRET_KEYS.OPENAI);
        headers = {};
        bodyParams = {
            logprobs: request.body.logprobs,
            top_logprobs: undefined,
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
        apiKey = readSecret(request.user.directories, SECRET_KEYS.OPENROUTER);
        // OpenRouter needs to pass the Referer and X-Title: https://openrouter.ai/docs#requests
        headers = { ...OPENROUTER_HEADERS };
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

        if (Array.isArray(request.body.provider) && request.body.provider.length > 0) {
            bodyParams['provider'] = {
                allow_fallbacks: request.body.allow_fallbacks ?? true,
                order: request.body.provider ?? [],
            };
        }

        if (request.body.use_fallback) {
            bodyParams['route'] = 'fallback';
        }
    } else if (request.body.chat_completion_source === CHAT_COMPLETION_SOURCES.CUSTOM) {
        apiUrl = request.body.custom_url;
        apiKey = readSecret(request.user.directories, SECRET_KEYS.CUSTOM);
        headers = {};
        bodyParams = {
            logprobs: request.body.logprobs,
            top_logprobs: undefined,
        };

        // Adjust logprobs params for Chat Completions API, which expects { top_logprobs: number; logprobs: boolean; }
        if (!isTextCompletion && bodyParams.logprobs > 0) {
            bodyParams.top_logprobs = bodyParams.logprobs;
            bodyParams.logprobs = true;
        }

        mergeObjectWithYaml(bodyParams, request.body.custom_include_body);
        mergeObjectWithYaml(headers, request.body.custom_include_headers);

        if (request.body.custom_prompt_post_processing) {
            console.log('Applying custom prompt post-processing of type', request.body.custom_prompt_post_processing);
            request.body.messages = postProcessPrompt(
                request.body.messages,
                request.body.custom_prompt_post_processing,
                request.body.char_name,
                request.body.user_name);
        }
    } else if (request.body.chat_completion_source === CHAT_COMPLETION_SOURCES.PERPLEXITY) {
        apiUrl = API_PERPLEXITY;
        apiKey = readSecret(request.user.directories, SECRET_KEYS.PERPLEXITY);
        headers = {};
        bodyParams = {};
        request.body.messages = postProcessPrompt(request.body.messages, 'claude', request.body.char_name, request.body.user_name);
    } else if (request.body.chat_completion_source === CHAT_COMPLETION_SOURCES.GROQ) {
        apiUrl = API_GROQ;
        apiKey = readSecret(request.user.directories, SECRET_KEYS.GROQ);
        headers = {};
        bodyParams = {};

        // 'required' tool choice is not supported by Groq
        if (request.body.tool_choice === 'required') {
            if (Array.isArray(request.body.tools) && request.body.tools.length > 0) {
                request.body.tool_choice = request.body.tools.length > 1
                    ? 'auto' :
                    { type: 'function', function: { name: request.body.tools[0]?.function?.name } };

            } else {
                request.body.tool_choice = 'none';
            }
        }
    } else if (request.body.chat_completion_source === CHAT_COMPLETION_SOURCES.ZEROONEAI) {
        apiUrl = API_01AI;
        apiKey = readSecret(request.user.directories, SECRET_KEYS.ZEROONEAI);
        headers = {};
        bodyParams = {};
    } else if (request.body.chat_completion_source === CHAT_COMPLETION_SOURCES.BLOCKENTROPY) {
        apiUrl = API_BLOCKENTROPY;
        apiKey = readSecret(request.user.directories, SECRET_KEYS.BLOCKENTROPY);
        headers = {};
        bodyParams = {};
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

    if (!isTextCompletion) {
        bodyParams['tools'] = request.body.tools;
        bodyParams['tool_choice'] = request.body.tool_choice;
    }

    const requestBody = {
        'messages': isTextCompletion === false ? request.body.messages : undefined,
        'prompt': isTextCompletion === true ? textPrompt : undefined,
        'model': request.body.model,
        'temperature': request.body.temperature,
        'max_tokens': request.body.max_tokens,
        'max_completion_tokens': request.body.max_completion_tokens,
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
