import fs from 'node:fs';
import express from 'express';
import fetch from 'node-fetch';

import { forwardFetchResponse, delay } from '../../util.js';
import { getOverrideHeaders, setAdditionalHeaders, setAdditionalHeadersByType } from '../../additional-headers.js';
import { TEXTGEN_TYPES } from '../../constants.js';

export const router = express.Router();

router.post('/generate', async function (request, response_generate) {
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
                console.info('Aborting Kobold generation...');
                // send abort signal to koboldcpp
                const abortResponse = await fetch(`${request.body.api_server}/extra/abort`, {
                    method: 'POST',
                });

                if (!abortResponse.ok) {
                    console.error('Error sending abort request to Kobold:', abortResponse.status);
                }
            } catch (error) {
                console.error(error);
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

    console.debug(this_settings);
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
            const response = await fetch(url, { method: 'POST', ...args });

            if (request.body.streaming) {
                // Pipe remote SSE stream to Express response
                forwardFetchResponse(response, response_generate);
                return;
            } else {
                if (!response.ok) {
                    const errorText = await response.text();
                    console.warn(`Kobold returned error: ${response.status} ${response.statusText} ${errorText}`);

                    try {
                        const errorJson = JSON.parse(errorText);
                        const message = errorJson?.detail?.msg || errorText;
                        return response_generate.status(400).send({ error: { message } });
                    } catch {
                        return response_generate.status(400).send({ error: { message: errorText } });
                    }
                }

                const data = await response.json();
                console.debug('Endpoint response:', data);
                return response_generate.send(data);
            }
        } catch (error) {
            // response
            switch (error?.status) {
                case 403:
                case 503: // retry in case of temporary service issue, possibly caused by a queue failure?
                    console.warn(`KoboldAI is busy. Retry attempt ${i + 1} of ${MAX_RETRIES}...`);
                    await delay(delayAmount);
                    break;
                default:
                    if ('status' in error) {
                        console.error('Status Code from Kobold:', error.status);
                    }
                    return response_generate.send({ error: true });
            }
        }
    }

    console.error('Max retries exceeded. Giving up.');
    return response_generate.send({ error: true });
});

router.post('/status', async function (request, response) {
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

    /** @type {any} */
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

router.post('/transcribe-audio', async function (request, response) {
    try {
        const server = request.body.server;

        if (!server) {
            console.error('Server is not set');
            return response.sendStatus(400);
        }

        if (!request.file) {
            console.error('No audio file found');
            return response.sendStatus(400);
        }

        console.debug('Transcribing audio with KoboldCpp', server);

        const fileBase64 = fs.readFileSync(request.file.path).toString('base64');
        fs.unlinkSync(request.file.path);

        const headers = {};
        setAdditionalHeadersByType(headers, TEXTGEN_TYPES.KOBOLDCPP, server, request.user.directories);

        const url = new URL(server);
        url.pathname = '/api/extra/transcribe';

        const result = await fetch(url, {
            method: 'POST',
            headers: {
                ...headers,
            },
            body: JSON.stringify({
                prompt: '',
                audio_data: fileBase64,
            }),
        });

        if (!result.ok) {
            const text = await result.text();
            console.error('KoboldCpp request failed', result.statusText, text);
            return response.status(500).send(text);
        }

        const data = await result.json();
        console.debug('KoboldCpp transcription response', data);
        return response.json(data);
    } catch (error) {
        console.error('KoboldCpp transcription failed', error);
        response.status(500).send('Internal server error');
    }
});

router.post('/embed', async function (request, response) {
    try {
        const { server, items } = request.body;

        if (!server) {
            console.warn('KoboldCpp URL is not set');
            return response.sendStatus(400);
        }

        const headers = {};
        setAdditionalHeadersByType(headers, TEXTGEN_TYPES.KOBOLDCPP, server, request.user.directories);

        const embeddingsUrl = new URL(server);
        embeddingsUrl.pathname = '/api/extra/embeddings';

        const embeddingsResult = await fetch(embeddingsUrl, {
            method: 'POST',
            headers: {
                ...headers,
            },
            body: JSON.stringify({
                input: items,
            }),
        });

        /** @type {any} */
        const data = await embeddingsResult.json();

        if (!Array.isArray(data?.data)) {
            console.warn('KoboldCpp API response was not an array');
            return response.sendStatus(500);
        }

        const model = data.model || 'unknown';
        const embeddings = data.data.map(x => Array.isArray(x) ? x[0] : x).sort((a, b) => a.index - b.index).map(x => x.embedding);
        return response.json({ model, embeddings });
    } catch (error) {
        console.error('KoboldCpp embedding failed', error);
        response.status(500).send('Internal server error');
    }
});
