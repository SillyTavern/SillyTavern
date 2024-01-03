const express = require('express');
const fetch = require('node-fetch').default;

const { jsonParser } = require('../../express-common');
const { forwardFetchResponse, delay } = require('../../util');
const { getOverrideHeaders, setAdditionalHeaders } = require('../../additional-headers');

const router = express.Router();

router.post('/generate', jsonParser, async function (request, response_generate) {
    if (!request.body) return response_generate.sendStatus(400);

    if (request.body.api_server.indexOf('localhost') != -1) {
        request.body.api_server = request.body.api_server.replace('localhost', '127.0.0.1');
    }

    const request_prompt = request.body.prompt;
    const controller = new AbortController();
    request.socket.removeAllListeners('close');
    request.socket.on('close', async function () {
        if (request.body.can_abort && !response_generate.writableEnded) {
            try {
                console.log('Aborting Kobold generation...');
                // send abort signal to koboldcpp
                const abortResponse = await fetch(`${request.body.api_server}/extra/abort`, {
                    method: 'POST',
                });

                if (!abortResponse.ok) {
                    console.log('Error sending abort request to Kobold:', abortResponse.status);
                }
            } catch (error) {
                console.log(error);
            }
        }
        controller.abort();
    });

    let this_settings = {
        prompt: request_prompt,
        use_story: false,
        use_memory: false,
        use_authors_note: false,
        use_world_info: false,
        max_context_length: request.body.max_context_length,
        max_length: request.body.max_length,
    };

    if (!request.body.gui_settings) {
        this_settings = {
            prompt: request_prompt,
            use_story: false,
            use_memory: false,
            use_authors_note: false,
            use_world_info: false,
            max_context_length: request.body.max_context_length,
            max_length: request.body.max_length,
            rep_pen: request.body.rep_pen,
            rep_pen_range: request.body.rep_pen_range,
            rep_pen_slope: request.body.rep_pen_slope,
            temperature: request.body.temperature,
            tfs: request.body.tfs,
            top_a: request.body.top_a,
            top_k: request.body.top_k,
            top_p: request.body.top_p,
            min_p: request.body.min_p,
            typical: request.body.typical,
            sampler_order: request.body.sampler_order,
            singleline: !!request.body.singleline,
            use_default_badwordsids: request.body.use_default_badwordsids,
            mirostat: request.body.mirostat,
            mirostat_eta: request.body.mirostat_eta,
            mirostat_tau: request.body.mirostat_tau,
            grammar: request.body.grammar,
            sampler_seed: request.body.sampler_seed,
        };
        if (request.body.stop_sequence) {
            this_settings['stop_sequence'] = request.body.stop_sequence;
        }
    }

    console.log(this_settings);
    const args = {
        body: JSON.stringify(this_settings),
        headers: Object.assign(
            { 'Content-Type': 'application/json' },
            getOverrideHeaders((new URL(request.body.api_server))?.host),
        ),
        signal: controller.signal,
    };

    const MAX_RETRIES = 50;
    const delayAmount = 2500;
    for (let i = 0; i < MAX_RETRIES; i++) {
        try {
            const url = request.body.streaming ? `${request.body.api_server}/extra/generate/stream` : `${request.body.api_server}/v1/generate`;
            const response = await fetch(url, { method: 'POST', timeout: 0, ...args });

            if (request.body.streaming) {
                // Pipe remote SSE stream to Express response
                forwardFetchResponse(response, response_generate);
                return;
            } else {
                if (!response.ok) {
                    const errorText = await response.text();
                    console.log(`Kobold returned error: ${response.status} ${response.statusText} ${errorText}`);

                    try {
                        const errorJson = JSON.parse(errorText);
                        const message = errorJson?.detail?.msg || errorText;
                        return response_generate.status(400).send({ error: { message } });
                    } catch {
                        return response_generate.status(400).send({ error: { message: errorText } });
                    }
                }

                const data = await response.json();
                console.log('Endpoint response:', data);
                return response_generate.send(data);
            }
        } catch (error) {
            // response
            switch (error?.status) {
                case 403:
                case 503: // retry in case of temporary service issue, possibly caused by a queue failure?
                    console.debug(`KoboldAI is busy. Retry attempt ${i + 1} of ${MAX_RETRIES}...`);
                    await delay(delayAmount);
                    break;
                default:
                    if ('status' in error) {
                        console.log('Status Code from Kobold:', error.status);
                    }
                    return response_generate.send({ error: true });
            }
        }
    }

    console.log('Max retries exceeded. Giving up.');
    return response_generate.send({ error: true });
});

router.post('/status', jsonParser, async function (request, response) {
    if (!request.body) return response.sendStatus(400);
    let api_server = request.body.api_server;
    if (api_server.indexOf('localhost') != -1) {
        api_server = api_server.replace('localhost', '127.0.0.1');
    }

    const args = {
        headers: { 'Content-Type': 'application/json' },
    };

    setAdditionalHeaders(request, args, api_server);

    const result = {};

    const [koboldUnitedResponse, koboldExtraResponse, koboldModelResponse] = await Promise.all([
        // We catch errors both from the response not having a successful HTTP status and from JSON parsing failing

        // Kobold United API version
        fetch(`${api_server}/v1/info/version`).then(response => {
            if (!response.ok) throw new Error(`Kobold API error: ${response.status, response.statusText}`);
            return response.json();
        }).catch(() => ({ result: '0.0.0' })),

        // KoboldCpp version
        fetch(`${api_server}/extra/version`).then(response => {
            if (!response.ok) throw new Error(`Kobold API error: ${response.status, response.statusText}`);
            return response.json();
        }).catch(() => ({ version: '0.0' })),

        // Current model
        fetch(`${api_server}/v1/model`).then(response => {
            if (!response.ok) throw new Error(`Kobold API error: ${response.status, response.statusText}`);
            return response.json();
        }).catch(() => null),
    ]);

    result.koboldUnitedVersion = koboldUnitedResponse.result;
    result.koboldCppVersion = koboldExtraResponse.result;
    result.model = !koboldModelResponse || koboldModelResponse.result === 'ReadOnly' ?
        'no_connection' :
        koboldModelResponse.result;

    response.send(result);
});

module.exports = { router };
