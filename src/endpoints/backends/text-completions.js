import { Readable } from 'node:stream';
import fetch from 'node-fetch';
import express from 'express';
import _ from 'lodash';

import {
    TEXTGEN_TYPES,
    TOGETHERAI_KEYS,
    OLLAMA_KEYS,
    INFERMATICAI_KEYS,
    OPENROUTER_KEYS,
    VLLM_KEYS,
    FEATHERLESS_KEYS,
    OPENAI_KEYS,
} from '../../constants.js';
import { forwardFetchResponse, trimV1, getConfigValue } from '../../util.js';
import { setAdditionalHeaders } from '../../additional-headers.js';
import { createHash } from 'node:crypto';

export const router = express.Router();

/**
 * Special boy's steaming routine. Wrap this abomination into proper SSE stream.
 * @param {import('node-fetch').Response} jsonStream JSON stream
 * @param {import('express').Request} request Express request
 * @param {import('express').Response} response Express response
 * @returns {Promise<any>} Nothing valuable
 */
async function parseOllamaStream(jsonStream, request, response) {
    try {
        if (!jsonStream.body) {
            throw new Error('No body in the response');
        }

        let partialData = '';
        jsonStream.body.on('data', (data) => {
            const chunk = data.toString();
            partialData += chunk;
            while (true) {
                let json;
                try {
                    json = JSON.parse(partialData);
                } catch (e) {
                    break;
                }
                const text = json.response || '';
                const chunk = { choices: [{ text }] };
                response.write(`data: ${JSON.stringify(chunk)}\n\n`);
                partialData = '';
            }
        });

        request.socket.on('close', function () {
            if (jsonStream.body instanceof Readable) jsonStream.body.destroy();
            response.end();
        });

        jsonStream.body.on('end', () => {
            console.info('Streaming request finished');
            response.write('data: [DONE]\n\n');
            response.end();
        });
    } catch (error) {
        console.error('Error forwarding streaming response:', error);
        if (!response.headersSent) {
            return response.status(500).send({ error: true });
        } else {
            return response.end();
        }
    }
}

/**
 * Abort KoboldCpp generation request.
 * @param {string} url Server base URL
 * @returns {Promise<void>} Promise resolving when we are done
 */
async function abortKoboldCppRequest(url) {
    try {
        console.info('Aborting Kobold generation...');
        const abortResponse = await fetch(`${url}/api/extra/abort`, {
            method: 'POST',
        });

        if (!abortResponse.ok) {
            console.error('Error sending abort request to Kobold:', abortResponse.status, abortResponse.statusText);
        }
    } catch (error) {
        console.error(error);
    }
}

//************** Ooba/OpenAI text completions API
router.post('/status', async function (request, response) {
    if (!request.body) return response.sendStatus(400);

    try {
        if (request.body.api_server.indexOf('localhost') !== -1) {
            request.body.api_server = request.body.api_server.replace('localhost', '127.0.0.1');
        }

        console.debug('Trying to connect to API', request.body);
        const baseUrl = trimV1(request.body.api_server);

        const args = {
            headers: { 'Content-Type': 'application/json' },
        };

        setAdditionalHeaders(request, args, baseUrl);

        const apiType = request.body.api_type;
        let url = baseUrl;
        let result = '';

        switch (apiType) {
            case TEXTGEN_TYPES.GENERIC:
            case TEXTGEN_TYPES.OOBA:
            case TEXTGEN_TYPES.VLLM:
            case TEXTGEN_TYPES.APHRODITE:
            case TEXTGEN_TYPES.KOBOLDCPP:
            case TEXTGEN_TYPES.LLAMACPP:
            case TEXTGEN_TYPES.INFERMATICAI:
            case TEXTGEN_TYPES.OPENROUTER:
            case TEXTGEN_TYPES.FEATHERLESS:
                url += '/v1/models';
                break;
            case TEXTGEN_TYPES.DREAMGEN:
                url += '/api/openai/v1/models';
                break;
            case TEXTGEN_TYPES.MANCER:
                url += '/oai/v1/models';
                break;
            case TEXTGEN_TYPES.TABBY:
                url += '/v1/model/list';
                break;
            case TEXTGEN_TYPES.TOGETHERAI:
                url += '/api/models?&info';
                break;
            case TEXTGEN_TYPES.OLLAMA:
                url += '/api/tags';
                break;
            case TEXTGEN_TYPES.HUGGINGFACE:
                url += '/info';
                break;
        }

        const modelsReply = await fetch(url, args);
        const isPossiblyLmStudio = modelsReply.headers.get('x-powered-by') === 'Express';

        if (!modelsReply.ok) {
            console.error('Models endpoint is offline.');
            return response.sendStatus(400);
        }

        /** @type {any} */
        let data = await modelsReply.json();

        // Rewrap to OAI-like response
        if (apiType === TEXTGEN_TYPES.TOGETHERAI && Array.isArray(data)) {
            data = { data: data.map(x => ({ id: x.name, ...x })) };
        }

        if (apiType === TEXTGEN_TYPES.OLLAMA && Array.isArray(data.models)) {
            data = { data: data.models.map(x => ({ id: x.name, ...x })) };
        }

        if (apiType === TEXTGEN_TYPES.HUGGINGFACE) {
            data = { data: [] };
        }

        if (!Array.isArray(data.data)) {
            console.error('Models response is not an array.');
            return response.sendStatus(400);
        }

        const modelIds = data.data.map(x => x.id);
        console.info('Models available:', modelIds);

        // Set result to the first model ID
        result = modelIds[0] || 'Valid';

        if (apiType === TEXTGEN_TYPES.OOBA && !isPossiblyLmStudio) {
            try {
                const modelInfoUrl = baseUrl + '/v1/internal/model/info';
                const modelInfoReply = await fetch(modelInfoUrl, args);

                if (modelInfoReply.ok) {
                    /** @type {any} */
                    const modelInfo = await modelInfoReply.json();
                    console.debug('Ooba model info:', modelInfo);

                    const modelName = modelInfo?.model_name;
                    result = modelName || result;
                    response.setHeader('x-supports-tokenization', 'true');
                }
            } catch (error) {
                console.error(`Failed to get Ooba model info: ${error}`);
            }
        } else if (apiType === TEXTGEN_TYPES.TABBY) {
            try {
                const modelInfoUrl = baseUrl + '/v1/model';
                const modelInfoReply = await fetch(modelInfoUrl, args);

                if (modelInfoReply.ok) {
                    /** @type {any} */
                    const modelInfo = await modelInfoReply.json();
                    console.debug('Tabby model info:', modelInfo);

                    const modelName = modelInfo?.id;
                    result = modelName || result;
                } else {
                    // TabbyAPI returns an error 400 if a model isn't loaded

                    result = 'None';
                }
            } catch (error) {
                console.error(`Failed to get TabbyAPI model info: ${error}`);
            }
        }

        return response.send({ result, data: data.data });
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

router.post('/props', async function (request, response) {
    if (!request.body.api_server) return response.sendStatus(400);

    try {
        const baseUrl = trimV1(request.body.api_server);
        const args = {
            headers: {},
        };

        setAdditionalHeaders(request, args, baseUrl);

        const apiType = request.body.api_type;
        const propsUrl = baseUrl + '/props';
        const propsReply = await fetch(propsUrl, args);

        if (!propsReply.ok) {
            return response.sendStatus(400);
        }

        /** @type {any} */
        const props = await propsReply.json();
        // TEMPORARY: llama.cpp's /props endpoint has a bug which replaces the last newline with a \0
        if (apiType === TEXTGEN_TYPES.LLAMACPP && props['chat_template'].endsWith('\u0000')) {
            props['chat_template'] = props['chat_template'].slice(0, -1) + '\n';
        }
        props['chat_template_hash'] = createHash('sha256').update(props['chat_template']).digest('hex');
        console.debug(`Model properties: ${JSON.stringify(props)}`);
        return response.send(props);
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

router.post('/generate', async function (request, response) {
    if (!request.body) return response.sendStatus(400);

    try {
        if (request.body.api_server.indexOf('localhost') !== -1) {
            request.body.api_server = request.body.api_server.replace('localhost', '127.0.0.1');
        }

        const apiType = request.body.api_type;
        const baseUrl = request.body.api_server;
        console.debug(request.body);

        const controller = new AbortController();
        request.socket.removeAllListeners('close');
        request.socket.on('close', async function () {
            if (request.body.api_type === TEXTGEN_TYPES.KOBOLDCPP && !response.writableEnded) {
                await abortKoboldCppRequest(trimV1(baseUrl));
            }

            controller.abort();
        });

        let url = trimV1(baseUrl);

        switch (request.body.api_type) {
            case TEXTGEN_TYPES.GENERIC:
            case TEXTGEN_TYPES.VLLM:
            case TEXTGEN_TYPES.FEATHERLESS:
            case TEXTGEN_TYPES.APHRODITE:
            case TEXTGEN_TYPES.OOBA:
            case TEXTGEN_TYPES.TABBY:
            case TEXTGEN_TYPES.KOBOLDCPP:
            case TEXTGEN_TYPES.TOGETHERAI:
            case TEXTGEN_TYPES.INFERMATICAI:
            case TEXTGEN_TYPES.HUGGINGFACE:
                url += '/v1/completions';
                break;
            case TEXTGEN_TYPES.DREAMGEN:
                url += '/api/openai/v1/completions';
                break;
            case TEXTGEN_TYPES.MANCER:
                url += '/oai/v1/completions';
                break;
            case TEXTGEN_TYPES.LLAMACPP:
                url += '/completion';
                break;
            case TEXTGEN_TYPES.OLLAMA:
                url += '/api/generate';
                break;
            case TEXTGEN_TYPES.OPENROUTER:
                url += '/v1/chat/completions';
                break;
        }

        const args = {
            method: 'POST',
            body: JSON.stringify(request.body),
            headers: { 'Content-Type': 'application/json' },
            signal: controller.signal,
            timeout: 0,
        };

        setAdditionalHeaders(request, args, baseUrl);

        if (request.body.api_type === TEXTGEN_TYPES.TOGETHERAI) {
            request.body = _.pickBy(request.body, (_, key) => TOGETHERAI_KEYS.includes(key));
            args.body = JSON.stringify(request.body);
        }

        if (request.body.api_type === TEXTGEN_TYPES.INFERMATICAI) {
            request.body = _.pickBy(request.body, (_, key) => INFERMATICAI_KEYS.includes(key));
            args.body = JSON.stringify(request.body);
        }

        if (request.body.api_type === TEXTGEN_TYPES.FEATHERLESS) {
            request.body = _.pickBy(request.body, (_, key) => FEATHERLESS_KEYS.includes(key));
            args.body = JSON.stringify(request.body);
        }

        if (request.body.api_type === TEXTGEN_TYPES.DREAMGEN) {
            args.body = JSON.stringify(request.body);
        }

        if (request.body.api_type === TEXTGEN_TYPES.GENERIC) {
            request.body = _.pickBy(request.body, (_, key) => OPENAI_KEYS.includes(key));
            if (Array.isArray(request.body.stop)) { request.body.stop = request.body.stop.slice(0, 4); }
            args.body = JSON.stringify(request.body);
        }

        if (request.body.api_type === TEXTGEN_TYPES.OPENROUTER) {
            if (Array.isArray(request.body.provider) && request.body.provider.length > 0) {
                request.body.provider = {
                    allow_fallbacks: request.body.allow_fallbacks ?? true,
                    order: request.body.provider,
                };
            } else {
                delete request.body.provider;
            }
            request.body = _.pickBy(request.body, (_, key) => OPENROUTER_KEYS.includes(key));
            args.body = JSON.stringify(request.body);
        }

        if (request.body.api_type === TEXTGEN_TYPES.VLLM) {
            request.body = _.pickBy(request.body, (_, key) => VLLM_KEYS.includes(key));
            args.body = JSON.stringify(request.body);
        }

        if (request.body.api_type === TEXTGEN_TYPES.OLLAMA) {
            const keepAlive = Number(getConfigValue('ollama.keepAlive', -1, 'number'));
            const numBatch = Number(getConfigValue('ollama.batchSize', -1, 'number'));
            if (numBatch > 0) {
                request.body['num_batch'] = numBatch;
            }
            args.body = JSON.stringify({
                model: request.body.model,
                prompt: request.body.prompt,
                stream: request.body.stream ?? false,
                keep_alive: keepAlive,
                raw: true,
                options: _.pickBy(request.body, (_, key) => OLLAMA_KEYS.includes(key)),
            });
        }

        if (request.body.api_type === TEXTGEN_TYPES.OLLAMA && request.body.stream) {
            const stream = await fetch(url, args);
            parseOllamaStream(stream, request, response);
        } else if (request.body.stream) {
            const completionsStream = await fetch(url, args);
            // Pipe remote SSE stream to Express response
            forwardFetchResponse(completionsStream, response);
        }
        else {
            const completionsReply = await fetch(url, args);

            if (completionsReply.ok) {
                /** @type {any} */
                const data = await completionsReply.json();
                console.debug('Endpoint response:', data);

                // Map InfermaticAI response to OAI completions format
                if (apiType === TEXTGEN_TYPES.INFERMATICAI) {
                    data['choices'] = (data?.choices || []).map(choice => ({ text: choice?.message?.content || choice.text, logprobs: choice?.logprobs, index: choice?.index }));
                }

                return response.send(data);
            } else {
                const text = await completionsReply.text();
                const errorBody = { error: true, status: completionsReply.status, response: text };

                return !response.headersSent
                    ? response.send(errorBody)
                    : response.end();
            }
        }
    } catch (error) {
        const status = error?.status ?? error?.code ?? 'UNKNOWN';
        const text = error?.error ?? error?.statusText ?? error?.message ?? 'Unknown error on /generate endpoint';
        let value = { error: true, status: status, response: text };
        console.error('Endpoint error:', error);

        return !response.headersSent
            ? response.send(value)
            : response.end();
    }
});

const ollama = express.Router();

ollama.post('/download', async function (request, response) {
    try {
        if (!request.body.name || !request.body.api_server) return response.sendStatus(400);

        const name = request.body.name;
        const url = String(request.body.api_server).replace(/\/$/, '');
        console.debug('Pulling Ollama model:', name);

        const fetchResponse = await fetch(`${url}/api/pull`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                stream: false,
            }),
        });

        if (!fetchResponse.ok) {
            console.error('Download error:', fetchResponse.status, fetchResponse.statusText);
            return response.status(500).send({ error: true });
        }

        console.debug('Ollama pull response:', await fetchResponse.json());
        return response.send({ ok: true });
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

ollama.post('/caption-image', async function (request, response) {
    try {
        if (!request.body.server_url || !request.body.model) {
            return response.sendStatus(400);
        }

        console.debug('Ollama caption request:', request.body);
        const baseUrl = trimV1(request.body.server_url);

        const fetchResponse = await fetch(`${baseUrl}/api/generate`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                model: request.body.model,
                prompt: request.body.prompt,
                images: [request.body.image],
                stream: false,
            }),
        });

        if (!fetchResponse.ok) {
            console.error('Ollama caption error:', fetchResponse.status, fetchResponse.statusText);
            return response.status(500).send({ error: true });
        }

        /** @type {any} */
        const data = await fetchResponse.json();
        console.debug('Ollama caption response:', data);

        const caption = data?.response || '';

        if (!caption) {
            console.error('Ollama caption is empty.');
            return response.status(500).send({ error: true });
        }

        return response.send({ caption });
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

const llamacpp = express.Router();

llamacpp.post('/props', async function (request, response) {
    try {
        if (!request.body.server_url) {
            return response.sendStatus(400);
        }

        console.debug('LlamaCpp props request:', request.body);
        const baseUrl = trimV1(request.body.server_url);

        const fetchResponse = await fetch(`${baseUrl}/props`, {
            method: 'GET',
        });

        if (!fetchResponse.ok) {
            console.error('LlamaCpp props error:', fetchResponse.status, fetchResponse.statusText);
            return response.status(500).send({ error: true });
        }

        const data = await fetchResponse.json();
        console.debug('LlamaCpp props response:', data);

        return response.send(data);

    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

llamacpp.post('/slots', async function (request, response) {
    try {
        if (!request.body.server_url) {
            return response.sendStatus(400);
        }
        if (!/^(erase|info|restore|save)$/.test(request.body.action)) {
            return response.sendStatus(400);
        }

        console.debug('LlamaCpp slots request:', request.body);
        const baseUrl = trimV1(request.body.server_url);

        let fetchResponse;
        if (request.body.action === 'info') {
            fetchResponse = await fetch(`${baseUrl}/slots`, {
                method: 'GET',
            });
        } else {
            if (!/^\d+$/.test(request.body.id_slot)) {
                return response.sendStatus(400);
            }
            if (request.body.action !== 'erase' && !request.body.filename) {
                return response.sendStatus(400);
            }

            fetchResponse = await fetch(`${baseUrl}/slots/${request.body.id_slot}?action=${request.body.action}`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    filename: request.body.action !== 'erase' ? `${request.body.filename}` : undefined,
                }),
            });
        }

        if (!fetchResponse.ok) {
            console.error('LlamaCpp slots error:', fetchResponse.status, fetchResponse.statusText);
            return response.status(500).send({ error: true });
        }

        const data = await fetchResponse.json();
        console.debug('LlamaCpp slots response:', data);

        return response.send(data);

    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

const tabby = express.Router();

tabby.post('/download', async function (request, response) {
    try {
        const baseUrl = String(request.body.api_server).replace(/\/$/, '');

        const args = {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(request.body),
            timeout: 0,
        };

        setAdditionalHeaders(request, args, baseUrl);

        // Check key permissions
        const permissionResponse = await fetch(`${baseUrl}/v1/auth/permission`, {
            headers: args.headers,
        });

        if (permissionResponse.ok) {
            /** @type {any} */
            const permissionJson = await permissionResponse.json();

            if (permissionJson['permission'] !== 'admin') {
                return response.status(403).send({ error: true });
            }
        } else {
            console.error('API Permission error:', permissionResponse.status, permissionResponse.statusText);
            return response.status(500).send({ error: true });
        }

        const fetchResponse = await fetch(`${baseUrl}/v1/download`, args);

        if (!fetchResponse.ok) {
            console.error('Download error:', fetchResponse.status, fetchResponse.statusText);
            return response.status(500).send({ error: true });
        }

        return response.send({ ok: true });
    } catch (error) {
        console.error(error);
        return response.sendStatus(500);
    }
});

router.use('/ollama', ollama);
router.use('/llamacpp', llamacpp);
router.use('/tabby', tabby);
