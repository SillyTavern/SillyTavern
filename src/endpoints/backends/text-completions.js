const express = require('express');
const fetch = require('node-fetch').default;
const _ = require('lodash');
const Readable = require('stream').Readable;

const { jsonParser } = require('../../express-common');
const { TEXTGEN_TYPES, TOGETHERAI_KEYS, OLLAMA_KEYS, INFERMATICAI_KEYS, OPENROUTER_KEYS, VLLM_KEYS, DREAMGEN_KEYS, FEATHERLESS_KEYS } = require('../../constants');
const { forwardFetchResponse, trimV1, getConfigValue } = require('../../util');
const { setAdditionalHeaders } = require('../../additional-headers');

const router = express.Router();

/**
 * Special boy's steaming routine. Wrap this abomination into proper SSE stream.
 * @param {import('node-fetch').Response} jsonStream JSON stream
 * @param {import('express').Request} request Express request
 * @param {import('express').Response} response Express response
 * @returns {Promise<any>} Nothing valuable
 */
async function parseOllamaStream(jsonStream, request, response) {
    try {
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
            console.log('Streaming request finished');
            response.write('data: [DONE]\n\n');
            response.end();
        });
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
 * Abort KoboldCpp generation request.
 * @param {string} url Server base URL
 * @returns {Promise<void>} Promise resolving when we are done
 */
async function abortKoboldCppRequest(url) {
    try {
        console.log('Aborting Kobold generation...');
        const abortResponse = await fetch(`${url}/api/extra/abort`, {
            method: 'POST',
        });

        if (!abortResponse.ok) {
            console.log('Error sending abort request to Kobold:', abortResponse.status, abortResponse.statusText);
        }
    } catch (error) {
        console.log(error);
    }
}

//************** Ooba/OpenAI text completions API
router.post('/status', jsonParser, async function (request, response) {
    if (!request.body) return response.sendStatus(400);

    try {
        if (request.body.api_server.indexOf('localhost') !== -1) {
            request.body.api_server = request.body.api_server.replace('localhost', '127.0.0.1');
        }

        console.log('Trying to connect to API:', request.body);
        const baseUrl = trimV1(request.body.api_server);

        const args = {
            headers: { 'Content-Type': 'application/json' },
        };

        setAdditionalHeaders(request, args, baseUrl);

        const apiType = request.body.api_type;
        let url = baseUrl;
        let result = '';

        if (request.body.legacy_api) {
            url += '/v1/model';
        } else {
            switch (apiType) {
                case TEXTGEN_TYPES.OOBA:
                case TEXTGEN_TYPES.VLLM:
                case TEXTGEN_TYPES.APHRODITE:
                case TEXTGEN_TYPES.KOBOLDCPP:
                case TEXTGEN_TYPES.LLAMACPP:
                case TEXTGEN_TYPES.INFERMATICAI:
                case TEXTGEN_TYPES.OPENROUTER:
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
                case TEXTGEN_TYPES.FEATHERLESS:
                    url += '/v1/models';
                    break;
                case TEXTGEN_TYPES.HUGGINGFACE:
                    url += '/info';
                    break;
            }
        }

        const modelsReply = await fetch(url, args);
        const isPossiblyLmStudio = modelsReply.headers.get('x-powered-by') === 'Express';

        if (!modelsReply.ok) {
            console.log('Models endpoint is offline.');
            return response.status(400);
        }

        let data = await modelsReply.json();

        if (request.body.legacy_api) {
            console.log('Legacy API response:', data);
            return response.send({ result: data?.result });
        }

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
            console.log('Models response is not an array.');
            return response.status(400);
        }

        const modelIds = data.data.map(x => x.id);
        console.log('Models available:', modelIds);

        // Set result to the first model ID
        result = modelIds[0] || 'Valid';

        if (apiType === TEXTGEN_TYPES.OOBA && !isPossiblyLmStudio) {
            try {
                const modelInfoUrl = baseUrl + '/v1/internal/model/info';
                const modelInfoReply = await fetch(modelInfoUrl, args);

                if (modelInfoReply.ok) {
                    const modelInfo = await modelInfoReply.json();
                    console.log('Ooba model info:', modelInfo);

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
                    const modelInfo = await modelInfoReply.json();
                    console.log('Tabby model info:', modelInfo);

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
        return response.status(500);
    }
});

router.post('/generate', jsonParser, async function (request, response) {
    if (!request.body) return response.sendStatus(400);

    try {
        if (request.body.api_server.indexOf('localhost') !== -1) {
            request.body.api_server = request.body.api_server.replace('localhost', '127.0.0.1');
        }

        const apiType = request.body.api_type;
        const baseUrl = request.body.api_server;
        console.log(request.body);

        const controller = new AbortController();
        request.socket.removeAllListeners('close');
        request.socket.on('close', async function () {
            if (request.body.api_type === TEXTGEN_TYPES.KOBOLDCPP && !response.writableEnded) {
                await abortKoboldCppRequest(trimV1(baseUrl));
            }

            controller.abort();
        });

        let url = trimV1(baseUrl);

        if (request.body.legacy_api) {
            url += '/v1/generate';
        } else {
            switch (request.body.api_type) {
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
            request.body = _.pickBy(request.body, (_, key) => DREAMGEN_KEYS.includes(key));
            // NOTE: DreamGen sometimes get confused by the unusual formatting in the character cards.
            request.body.stop?.push('### User', '## User');
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
            const keepAlive = getConfigValue('ollama.keepAlive', -1);
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
                const data = await completionsReply.json();
                console.log('Endpoint response:', data);

                // Wrap legacy response to OAI completions format
                if (request.body.legacy_api) {
                    const text = data?.results[0]?.text;
                    data['choices'] = [{ text }];
                }

                // Map InfermaticAI response to OAI completions format
                if (apiType === TEXTGEN_TYPES.INFERMATICAI) {
                    data['choices'] = (data?.choices || []).map(choice => ({ text: choice?.message?.content || choice.text, logprobs: choice?.logprobs, index: choice?.index }));
                }

                return response.send(data);
            } else {
                const text = await completionsReply.text();
                const errorBody = { error: true, status: completionsReply.status, response: text };

                if (!response.headersSent) {
                    return response.send(errorBody);
                }

                return response.end();
            }
        }
    } catch (error) {
        const status = error?.status ?? error?.code ?? 'UNKNOWN';
        const text = error?.error ?? error?.statusText ?? error?.message ?? 'Unknown error on /generate endpoint';
        let value = { error: true, status: status, response: text };
        console.log('Endpoint error:', error);

        if (!response.headersSent) {
            return response.send(value);
        }

        return response.end();
    }
});

const ollama = express.Router();

ollama.post('/download', jsonParser, async function (request, response) {
    try {
        if (!request.body.name || !request.body.api_server) return response.sendStatus(400);

        const name = request.body.name;
        const url = String(request.body.api_server).replace(/\/$/, '');

        const fetchResponse = await fetch(`${url}/api/pull`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({
                name: name,
                stream: false,
            }),
            timeout: 0,
        });

        if (!fetchResponse.ok) {
            console.log('Download error:', fetchResponse.status, fetchResponse.statusText);
            return response.status(fetchResponse.status).send({ error: true });
        }

        return response.send({ ok: true });
    } catch (error) {
        console.error(error);
        return response.status(500);
    }
});

ollama.post('/caption-image', jsonParser, async function (request, response) {
    try {
        if (!request.body.server_url || !request.body.model) {
            return response.sendStatus(400);
        }

        console.log('Ollama caption request:', request.body);
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
            timeout: 0,
        });

        if (!fetchResponse.ok) {
            console.log('Ollama caption error:', fetchResponse.status, fetchResponse.statusText);
            return response.status(500).send({ error: true });
        }

        const data = await fetchResponse.json();
        console.log('Ollama caption response:', data);

        const caption = data?.response || '';

        if (!caption) {
            console.log('Ollama caption is empty.');
            return response.status(500).send({ error: true });
        }

        return response.send({ caption });
    } catch (error) {
        console.error(error);
        return response.status(500);
    }
});

const llamacpp = express.Router();

llamacpp.post('/caption-image', jsonParser, async function (request, response) {
    try {
        if (!request.body.server_url) {
            return response.sendStatus(400);
        }

        console.log('LlamaCpp caption request:', request.body);
        const baseUrl = trimV1(request.body.server_url);

        const fetchResponse = await fetch(`${baseUrl}/completion`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            timeout: 0,
            body: JSON.stringify({
                prompt: `USER:[img-1]${String(request.body.prompt).trim()}\nASSISTANT:`,
                image_data: [{ data: request.body.image, id: 1 }],
                temperature: 0.1,
                stream: false,
                stop: ['USER:', '</s>'],
            }),
        });

        if (!fetchResponse.ok) {
            console.log('LlamaCpp caption error:', fetchResponse.status, fetchResponse.statusText);
            return response.status(500).send({ error: true });
        }

        const data = await fetchResponse.json();
        console.log('LlamaCpp caption response:', data);

        const caption = data?.content || '';

        if (!caption) {
            console.log('LlamaCpp caption is empty.');
            return response.status(500).send({ error: true });
        }

        return response.send({ caption });

    } catch (error) {
        console.error(error);
        return response.status(500);
    }
});

llamacpp.post('/props', jsonParser, async function (request, response) {
    try {
        if (!request.body.server_url) {
            return response.sendStatus(400);
        }

        console.log('LlamaCpp props request:', request.body);
        const baseUrl = trimV1(request.body.server_url);

        const fetchResponse = await fetch(`${baseUrl}/props`, {
            method: 'GET',
            timeout: 0,
        });

        if (!fetchResponse.ok) {
            console.log('LlamaCpp props error:', fetchResponse.status, fetchResponse.statusText);
            return response.status(500).send({ error: true });
        }

        const data = await fetchResponse.json();
        console.log('LlamaCpp props response:', data);

        return response.send(data);

    } catch (error) {
        console.error(error);
        return response.status(500);
    }
});

llamacpp.post('/slots', jsonParser, async function (request, response) {
    try {
        if (!request.body.server_url) {
            return response.sendStatus(400);
        }
        if (!/^(erase|info|restore|save)$/.test(request.body.action)) {
            return response.sendStatus(400);
        }

        console.log('LlamaCpp slots request:', request.body);
        const baseUrl = trimV1(request.body.server_url);

        let fetchResponse;
        if (request.body.action === 'info') {
            fetchResponse = await fetch(`${baseUrl}/slots`, {
                method: 'GET',
                timeout: 0,
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
                timeout: 0,
                body: JSON.stringify({
                    filename: request.body.action !== 'erase' ? `${request.body.filename}` : undefined,
                }),
            });
        }

        if (!fetchResponse.ok) {
            console.log('LlamaCpp slots error:', fetchResponse.status, fetchResponse.statusText);
            return response.status(500).send({ error: true });
        }

        const data = await fetchResponse.json();
        console.log('LlamaCpp slots response:', data);

        return response.send(data);

    } catch (error) {
        console.error(error);
        return response.status(500);
    }
});

const tabby = express.Router();

tabby.post('/download', jsonParser, async function (request, response) {
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
            const permissionJson = await permissionResponse.json();

            if (permissionJson['permission'] !== 'admin') {
                return response.status(403).send({ error: true });
            }
        } else {
            console.log('API Permission error:', permissionResponse.status, permissionResponse.statusText);
            return response.status(permissionResponse.status).send({ error: true });
        }

        const fetchResponse = await fetch(`${baseUrl}/v1/download`, args);

        if (!fetchResponse.ok) {
            console.log('Download error:', fetchResponse.status, fetchResponse.statusText);
            return response.status(fetchResponse.status).send({ error: true });
        }

        return response.send({ ok: true });
    } catch (error) {
        console.error(error);
        return response.status(500);
    }
});

router.use('/ollama', ollama);
router.use('/llamacpp', llamacpp);
router.use('/tabby', tabby);

module.exports = { router };
