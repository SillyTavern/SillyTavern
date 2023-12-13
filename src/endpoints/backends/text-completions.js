const express = require('express');
const fetch = require('node-fetch').default;

const { jsonParser } = require('../../express-common');
const { TEXTGEN_TYPES } = require('../../constants');
const { forwardFetchResponse } = require('../../util');
const { setAdditionalHeaders } = require('../../additional-headers');

const router = express.Router();

//************** Ooba/OpenAI text completions API
router.post('/status', jsonParser, async function (request, response) {
    if (!request.body) return response.sendStatus(400);

    try {
        if (request.body.api_server.indexOf('localhost') !== -1) {
            request.body.api_server = request.body.api_server.replace('localhost', '127.0.0.1');
        }

        console.log('Trying to connect to API:', request.body);

        // Convert to string + remove trailing slash + /v1 suffix
        const baseUrl = String(request.body.api_server).replace(/\/$/, '').replace(/\/v1$/, '');

        const args = {
            headers: { 'Content-Type': 'application/json' },
        };

        setAdditionalHeaders(request, args, baseUrl);

        let url = baseUrl;
        let result = '';

        if (request.body.legacy_api) {
            url += '/v1/model';
        } else {
            switch (request.body.api_type) {
                case TEXTGEN_TYPES.OOBA:
                case TEXTGEN_TYPES.APHRODITE:
                case TEXTGEN_TYPES.KOBOLDCPP:
                    url += '/v1/models';
                    break;
                case TEXTGEN_TYPES.MANCER:
                    url += '/oai/v1/models';
                    break;
                case TEXTGEN_TYPES.TABBY:
                    url += '/v1/model/list';
                    break;
            }
        }

        const modelsReply = await fetch(url, args);

        if (!modelsReply.ok) {
            console.log('Models endpoint is offline.');
            return response.status(400);
        }

        const data = await modelsReply.json();

        if (request.body.legacy_api) {
            console.log('Legacy API response:', data);
            return response.send({ result: data?.result });
        }

        if (!Array.isArray(data.data)) {
            console.log('Models response is not an array.');
            return response.status(400);
        }

        const modelIds = data.data.map(x => x.id);
        console.log('Models available:', modelIds);

        // Set result to the first model ID
        result = modelIds[0] || 'Valid';

        if (request.body.api_type === TEXTGEN_TYPES.OOBA) {
            try {
                const modelInfoUrl = baseUrl + '/v1/internal/model/info';
                const modelInfoReply = await fetch(modelInfoUrl, args);

                if (modelInfoReply.ok) {
                    const modelInfo = await modelInfoReply.json();
                    console.log('Ooba model info:', modelInfo);

                    const modelName = modelInfo?.model_name;
                    result = modelName || result;
                }
            } catch (error) {
                console.error(`Failed to get Ooba model info: ${error}`);
            }
        } else if (request.body.api_type === TEXTGEN_TYPES.TABBY) {
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

router.post('/generate', jsonParser, async function (request, response_generate) {
    if (!request.body) return response_generate.sendStatus(400);

    try {
        if (request.body.api_server.indexOf('localhost') !== -1) {
            request.body.api_server = request.body.api_server.replace('localhost', '127.0.0.1');
        }

        const baseUrl = request.body.api_server;
        console.log(request.body);

        const controller = new AbortController();
        request.socket.removeAllListeners('close');
        request.socket.on('close', function () {
            controller.abort();
        });

        // Convert to string + remove trailing slash + /v1 suffix
        let url = String(baseUrl).replace(/\/$/, '').replace(/\/v1$/, '');

        if (request.body.legacy_api) {
            url += '/v1/generate';
        } else {
            switch (request.body.api_type) {
                case TEXTGEN_TYPES.APHRODITE:
                case TEXTGEN_TYPES.OOBA:
                case TEXTGEN_TYPES.TABBY:
                case TEXTGEN_TYPES.KOBOLDCPP:
                    url += '/v1/completions';
                    break;
                case TEXTGEN_TYPES.MANCER:
                    url += '/oai/v1/completions';
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

        if (request.body.stream) {
            const completionsStream = await fetch(url, args);
            // Pipe remote SSE stream to Express response
            forwardFetchResponse(completionsStream, response_generate);
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

                return response_generate.send(data);
            } else {
                const text = await completionsReply.text();
                const errorBody = { error: true, status: completionsReply.status, response: text };

                if (!response_generate.headersSent) {
                    return response_generate.send(errorBody);
                }

                return response_generate.end();
            }
        }
    } catch (error) {
        let value = { error: true, status: error?.status, response: error?.statusText };
        console.log('Endpoint error:', error);

        if (!response_generate.headersSent) {
            return response_generate.send(value);
        }

        return response_generate.end();
    }
});

module.exports = { router };
