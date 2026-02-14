import fs from 'node:fs';
import { Buffer } from 'node:buffer';

import fetch from 'node-fetch';
import FormData from 'form-data';
import express from 'express';

import { getConfigValue, mergeObjectWithYaml, excludeKeysByYaml, trimV1, delay } from '../util.js';
import { setAdditionalHeaders } from '../additional-headers.js';
import { readSecret, SECRET_KEYS } from './secrets.js';
import { AIMLAPI_HEADERS, OPENROUTER_HEADERS, ZAI_ENDPOINT } from '../constants.js';

export const router = express.Router();

router.post('/caption-image', async (request, response) => {
    try {
        let key = '';
        let headers = {};
        let bodyParams = {};

        if (request.body.api === 'openai' && !request.body.reverse_proxy) {
            key = readSecret(request.user.directories, SECRET_KEYS.OPENAI);
        }

        if (request.body.api === 'xai' && !request.body.reverse_proxy) {
            key = readSecret(request.user.directories, SECRET_KEYS.XAI);
        }

        if (request.body.api === 'mistral' && !request.body.reverse_proxy) {
            key = readSecret(request.user.directories, SECRET_KEYS.MISTRALAI);
        }

        if (request.body.reverse_proxy && request.body.proxy_password) {
            key = request.body.proxy_password;
        }

        if (request.body.api === 'custom') {
            key = readSecret(request.user.directories, SECRET_KEYS.CUSTOM);
            mergeObjectWithYaml(bodyParams, request.body.custom_include_body);
            mergeObjectWithYaml(headers, request.body.custom_include_headers);
        }

        if (request.body.api === 'openrouter') {
            key = readSecret(request.user.directories, SECRET_KEYS.OPENROUTER);
        }

        if (request.body.api === 'ooba') {
            key = readSecret(request.user.directories, SECRET_KEYS.OOBA);
            bodyParams.temperature = 0.1;
        }

        if (request.body.api === 'koboldcpp') {
            key = readSecret(request.user.directories, SECRET_KEYS.KOBOLDCPP);
        }

        if (request.body.api === 'llamacpp') {
            key = readSecret(request.user.directories, SECRET_KEYS.LLAMACPP);
        }

        if (request.body.api === 'vllm') {
            key = readSecret(request.user.directories, SECRET_KEYS.VLLM);
        }

        if (request.body.api === 'aimlapi') {
            key = readSecret(request.user.directories, SECRET_KEYS.AIMLAPI);
        }

        if (request.body.api === 'groq') {
            key = readSecret(request.user.directories, SECRET_KEYS.GROQ);
        }

        if (request.body.api === 'cohere') {
            key = readSecret(request.user.directories, SECRET_KEYS.COHERE);
        }

        if (request.body.api === 'moonshot' && !request.body.reverse_proxy) {
            key = readSecret(request.user.directories, SECRET_KEYS.MOONSHOT);
        }

        if (request.body.api === 'nanogpt') {
            key = readSecret(request.user.directories, SECRET_KEYS.NANOGPT);
        }

        if (request.body.api === 'chutes') {
            key = readSecret(request.user.directories, SECRET_KEYS.CHUTES);
        }

        if (request.body.api === 'electronhub') {
            key = readSecret(request.user.directories, SECRET_KEYS.ELECTRONHUB);
        }

        if (request.body.api === 'zai' && !request.body.reverse_proxy) {
            key = readSecret(request.user.directories, SECRET_KEYS.ZAI);
        }

        if (request.body.api === 'zai') {
            bodyParams.max_tokens = 4096; // default is 1024
        }

        if (request.body.api === 'pollinations') {
            key = readSecret(request.user.directories, SECRET_KEYS.POLLINATIONS);
            bodyParams.seed = Math.floor(Math.random() * Math.pow(2, 32));
        }

        const noKeyTypes = ['custom', 'ooba', 'koboldcpp', 'vllm', 'llamacpp'];
        if (!key && !request.body.reverse_proxy && !noKeyTypes.includes(request.body.api)) {
            console.warn('No key found for API', request.body.api);
            return response.sendStatus(400);
        }

        const body = {
            model: request.body.model,
            messages: [
                {
                    role: 'user',
                    content: [
                        { type: 'text', text: request.body.prompt },
                        { type: 'image_url', image_url: { 'url': request.body.image } },
                    ],
                },
            ],
            ...bodyParams,
        };

        const captionSystemPrompt = getConfigValue('openai.captionSystemPrompt');
        if (captionSystemPrompt) {
            body.messages.unshift({
                role: 'system',
                content: captionSystemPrompt,
            });
        }

        if (request.body.api === 'custom') {
            excludeKeysByYaml(body, request.body.custom_exclude_body);
        }

        let apiUrl = '';

        if (request.body.api === 'openrouter') {
            apiUrl = 'https://openrouter.ai/api/v1/chat/completions';
            Object.assign(headers, OPENROUTER_HEADERS);
        }

        if (request.body.api === 'openai') {
            apiUrl = 'https://api.openai.com/v1/chat/completions';
        }

        if (request.body.reverse_proxy) {
            apiUrl = `${request.body.reverse_proxy}/chat/completions`;
        }

        if (request.body.api === 'custom') {
            apiUrl = `${request.body.server_url}/chat/completions`;
        }

        if (request.body.api === 'aimlapi') {
            apiUrl = 'https://api.aimlapi.com/v1/chat/completions';
            Object.assign(headers, AIMLAPI_HEADERS);
        }

        if (request.body.api === 'groq') {
            apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
            if (body.messages?.[0]?.role === 'system') {
                body.messages[0].role = 'user';
            }
        }

        if (request.body.api === 'mistral') {
            apiUrl = 'https://api.mistral.ai/v1/chat/completions';
        }

        if (request.body.api === 'cohere') {
            apiUrl = 'https://api.cohere.ai/v2/chat';
        }

        if (request.body.api === 'xai') {
            apiUrl = 'https://api.x.ai/v1/chat/completions';
        }

        if (request.body.api === 'pollinations') {
            apiUrl = 'https://gen.pollinations.ai/v1/chat/completions';
        }

        if (request.body.api === 'moonshot' && !request.body.reverse_proxy) {
            apiUrl = 'https://api.moonshot.ai/v1/chat/completions';
        }

        if (request.body.api === 'nanogpt') {
            apiUrl = 'https://nano-gpt.com/api/v1/chat/completions';
        }

        if (request.body.api === 'chutes') {
            apiUrl = 'https://llm.chutes.ai/v1/chat/completions';
        }

        if (request.body.api === 'electronhub') {
            apiUrl = 'https://api.electronhub.ai/v1/chat/completions';
        }

        if (request.body.api === 'zai' && !request.body.reverse_proxy) {
            apiUrl = request.body.zai_endpoint === ZAI_ENDPOINT.CODING
                ? 'https://api.z.ai/api/coding/paas/v4/chat/completions'
                : 'https://api.z.ai/api/paas/v4/chat/completions';
        }

        // Handle video inlining for Z.AI
        if (request.body.api === 'zai' && /data:video\/\w+;base64,/.test(request.body.image)) {
            const message = body.messages.find(msg => Array.isArray(msg.content));
            if (message) {
                const imgContent = message.content.find(c => c.type === 'image_url');
                if (imgContent) {
                    imgContent.type = 'video_url';
                    imgContent.video_url = imgContent.image_url;
                    delete imgContent.image_url;
                }
            }
        }

        if (['koboldcpp', 'vllm', 'llamacpp', 'ooba'].includes(request.body.api)) {
            apiUrl = `${trimV1(request.body.server_url)}/v1/chat/completions`;
        }

        if (request.body.api === 'ooba') {
            const imgMessage = body.messages.pop();
            body.messages.push({
                role: 'user',
                content: imgMessage?.content?.[0]?.text,
            });
            body.messages.push({
                role: 'user',
                content: [],
                image_url: imgMessage?.content?.[1]?.image_url?.url,
            });
        }

        setAdditionalHeaders(request, { headers }, apiUrl);
        console.debug('Multimodal captioning request', body);

        const result = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${key}`,
                ...headers,
            },
            body: JSON.stringify(body),
        });

        if (!result.ok) {
            const text = await result.text();
            console.warn('Multimodal captioning request failed', result.statusText, text);
            return response.status(500).send(text);
        }

        /** @type {any} */
        const data = await result.json();
        console.info('Multimodal captioning response', data);
        const caption = data?.choices?.[0]?.message?.content ?? data?.message?.content?.[0]?.text;

        if (!caption) {
            return response.status(500).send('No caption found');
        }

        return response.json({ caption });
    }
    catch (error) {
        console.error(error);
        response.status(500).send('Internal server error');
    }
});

router.post('/generate-voice', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.OPENAI);

        if (!key) {
            console.warn('No OpenAI key found');
            return response.sendStatus(400);
        }

        const requestBody = {
            input: request.body.text,
            response_format: 'mp3',
            voice: request.body.voice ?? 'alloy',
            speed: request.body.speed ?? 1,
            model: request.body.model ?? 'tts-1',
        };

        if (request.body.instructions) {
            requestBody.instructions = request.body.instructions;
        }

        console.debug('OpenAI TTS request', requestBody);

        const result = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify(requestBody),
        });

        if (!result.ok) {
            const text = await result.text();
            console.warn('OpenAI request failed', result.statusText, text);
            return response.status(500).send(text);
        }

        const buffer = await result.arrayBuffer();
        response.setHeader('Content-Type', 'audio/mpeg');
        return response.send(Buffer.from(buffer));
    } catch (error) {
        console.error('OpenAI TTS generation failed', error);
        response.status(500).send('Internal server error');
    }
});

// ElectronHub TTS proxy
router.post('/electronhub/generate-voice', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.ELECTRONHUB);

        if (!key) {
            console.warn('No ElectronHub key found');
            return response.sendStatus(400);
        }

        const requestBody = {
            input: request.body.input,
            voice: request.body.voice,
            speed: request.body.speed ?? 1,
            temperature: request.body.temperature ?? undefined,
            model: request.body.model || 'tts-1',
            response_format: 'mp3',
        };

        // Optional provider-specific params
        if (request.body.instructions) requestBody.instructions = request.body.instructions;
        if (request.body.speaker_transcript) requestBody.speaker_transcript = request.body.speaker_transcript;
        if (Number.isFinite(request.body.cfg_scale)) requestBody.cfg_scale = Number(request.body.cfg_scale);
        if (Number.isFinite(request.body.cfg_filter_top_k)) requestBody.cfg_filter_top_k = Number(request.body.cfg_filter_top_k);
        if (Number.isFinite(request.body.speech_rate)) requestBody.speech_rate = Number(request.body.speech_rate);
        if (Number.isFinite(request.body.pitch_adjustment)) requestBody.pitch_adjustment = Number(request.body.pitch_adjustment);
        if (request.body.emotional_style) requestBody.emotional_style = request.body.emotional_style;

        // Handle dynamic parameters sent from the frontend
        const knownParams = new Set(Object.keys(requestBody));
        for (const key in request.body) {
            if (!knownParams.has(key) && request.body[key] !== undefined) {
                requestBody[key] = request.body[key];
            }
        }

        // Clean undefineds
        Object.keys(requestBody).forEach(k => requestBody[k] === undefined && delete requestBody[k]);

        console.debug('ElectronHub TTS request', requestBody);

        const result = await fetch('https://api.electronhub.ai/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify(requestBody),
        });

        if (!result.ok) {
            const text = await result.text();
            console.warn('ElectronHub TTS request failed', result.statusText, text);
            return response.status(500).send(text);
        }

        const contentType = result.headers.get('content-type') || 'audio/mpeg';
        const buffer = await result.arrayBuffer();
        response.setHeader('Content-Type', contentType);
        return response.send(Buffer.from(buffer));
    } catch (error) {
        console.error('ElectronHub TTS generation failed', error);
        response.status(500).send('Internal server error');
    }
});

// ElectronHub model list
router.post('/electronhub/models', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.ELECTRONHUB);

        if (!key) {
            console.warn('No ElectronHub key found');
            return response.sendStatus(400);
        }

        const result = await fetch('https://api.electronhub.ai/v1/models', {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${key}`,
            },
        });

        if (!result.ok) {
            const text = await result.text();
            console.warn('ElectronHub models request failed', result.statusText, text);
            return response.status(500).send(text);
        }
        /** @type {any} */
        const data = await result.json();
        const models = data && Array.isArray(data.data) ? data.data : [];
        return response.json(models);
    } catch (error) {
        console.error('ElectronHub models fetch failed', error);
        response.status(500).send('Internal server error');
    }
});

// Chutes TTS
router.post('/chutes/generate-voice', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.CHUTES);

        if (!key) {
            console.warn('No Chutes key found');
            return response.sendStatus(400);
        }

        const requestBody = {
            text: request.body.input,
            voice: request.body.voice || 'af_heart',
            speed: request.body.speed || 1,
        };

        console.debug('Chutes TTS request', requestBody);

        const result = await fetch('https://chutes-kokoro.chutes.ai/speak', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify(requestBody),
        });

        if (!result.ok) {
            const text = await result.text();
            console.warn('Chutes TTS request failed', result.statusText, text);
            return response.status(500).send(text);
        }

        const contentType = result.headers.get('content-type') || 'audio/mpeg';
        const buffer = await result.arrayBuffer();
        response.setHeader('Content-Type', contentType);
        return response.send(Buffer.from(buffer));
    } catch (error) {
        console.error('Chutes TTS generation failed', error);
        response.status(500).send('Internal server error');
    }
});

router.post('/chutes/models/embedding', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.CHUTES);

        if (!key) {
            console.warn('No Chutes key found');
            return response.sendStatus(400);
        }

        const result = await fetch('https://api.chutes.ai/chutes/?template=embedding&include_public=true&limit=999', {
            method: 'GET',
            headers: {
                Authorization: `Bearer ${key}`,
            },
        });

        if (!result.ok) {
            const text = await result.text();
            console.warn('Chutes embedding models request failed', result.statusText, text);
            return response.status(500).send(text);
        }

        /** @type {any} */
        const data = await result.json();

        if (!Array.isArray(data?.items)) {
            console.warn('Chutes embedding models response invalid', data);
            return response.sendStatus(500);
        }
        return response.json(data.items);
    } catch (error) {
        console.error('Chutes embedding models fetch failed', error);
        response.sendStatus(500);
    }
});

router.post('/nanogpt/models/embedding', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.NANOGPT);

        if (!key) {
            console.warn('No NanoGPT key found');
            return response.sendStatus(400);
        }

        const result = await fetch('https://nano-gpt.com/api/v1/embedding-models', {
            method: 'GET',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Accept-Encoding': 'identity',
            },
        });

        if (!result.ok) {
            const text = await result.text();
            console.warn('NanoGPT embedding models request failed', result.statusText, text);
            return response.status(500).send(text);
        }

        /** @type {any} */
        const data = await result.json();

        if (!Array.isArray(data?.data)) {
            console.warn('NanoGPT embedding models response invalid', data);
            return response.sendStatus(500);
        }
        return response.json(data.data);
    } catch (error) {
        console.error('NanoGPT embedding models fetch failed', error);
        response.sendStatus(500);
    }
});

router.post('/generate-image', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.OPENAI);

        if (!key) {
            console.warn('No OpenAI key found');
            return response.sendStatus(400);
        }

        console.debug('OpenAI request', request.body);

        const result = await fetch('https://api.openai.com/v1/images/generations', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify(request.body),
        });

        if (!result.ok) {
            const text = await result.text();
            console.warn('OpenAI request failed', result.statusText, text);
            return response.status(500).send(text);
        }

        const data = await result.json();
        return response.json(data);
    } catch (error) {
        console.error(error);
        response.status(500).send('Internal server error');
    }
});

router.post('/generate-video', async (request, response) => {
    try {
        const controller = new AbortController();
        request.socket.removeAllListeners('close');
        request.socket.on('close', function () {
            controller.abort();
        });

        const key = readSecret(request.user.directories, SECRET_KEYS.OPENAI);

        if (!key) {
            console.warn('No OpenAI key found');
            return response.sendStatus(400);
        }

        console.debug('OpenAI video generation request', request.body);

        const videoJobResponse = await fetch('https://api.openai.com/v1/videos', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`,
            },
            body: JSON.stringify({
                prompt: request.body.prompt,
                model: request.body.model || 'sora-2',
                size: request.body.size || '720x1280',
                seconds: request.body.seconds || '8',
            }),
        });

        if (!videoJobResponse.ok) {
            const text = await videoJobResponse.text();
            console.warn('OpenAI video generation request failed', videoJobResponse.statusText, text);
            return response.status(500).send(text);
        }

        /** @type {any} */
        const videoJob = await videoJobResponse.json();

        if (!videoJob || !videoJob.id) {
            console.warn('OpenAI video generation returned no job ID', videoJob);
            return response.status(500).send('No video job ID returned');
        }

        // Poll for video generation completion
        for (let attempt = 0; attempt < 30; attempt++) {
            if (controller.signal.aborted) {
                console.info('OpenAI video generation aborted by client');
                return response.status(500).send('Video generation aborted by client');
            }

            await delay(5000 + attempt * 1000);
            console.debug(`Polling OpenAI video job ${videoJob.id}, attempt ${attempt + 1}`);

            const pollResponse = await fetch(`https://api.openai.com/v1/videos/${videoJob.id}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${key}`,
                },
            });

            if (!pollResponse.ok) {
                const text = await pollResponse.text();
                console.warn('OpenAI video job polling failed', pollResponse.statusText, text);
                return response.status(500).send(text);
            }

            /** @type {any} */
            const pollResult = await pollResponse.json();
            console.debug(`OpenAI video job status: ${pollResult.status}, progress: ${pollResult.progress}`);

            if (pollResult.status === 'failed') {
                console.warn('OpenAI video generation failed', pollResult);
                return response.status(500).send('Video generation failed');
            }

            if (pollResult.status === 'completed') {
                const contentResponse = await fetch(`https://api.openai.com/v1/videos/${videoJob.id}/content`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${key}`,
                    },
                });

                if (!contentResponse.ok) {
                    const text = await contentResponse.text();
                    console.warn('OpenAI video content fetch failed', contentResponse.statusText, text);
                    return response.status(500).send(text);
                }

                const contentBuffer = await contentResponse.arrayBuffer();
                return response.send({ format: 'mp4', data: Buffer.from(contentBuffer).toString('base64') });
            }
        }
    } catch (error) {
        console.error('OpenAI video generation failed', error);
        response.status(500).send('Internal server error');
    }
});

const custom = express.Router();

custom.post('/generate-voice', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.CUSTOM_OPENAI_TTS);
        const { input, provider_endpoint, response_format, voice, speed, model } = request.body;

        if (!provider_endpoint) {
            console.warn('No OpenAI-compatible TTS provider endpoint provided');
            return response.sendStatus(400);
        }

        const result = await fetch(provider_endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${key ?? ''}`,
            },
            body: JSON.stringify({
                input: input ?? '',
                response_format: response_format ?? 'mp3',
                voice: voice ?? 'alloy',
                speed: speed ?? 1,
                model: model ?? 'tts-1',
            }),
        });

        if (!result.ok) {
            const text = await result.text();
            console.warn('OpenAI request failed', result.statusText, text);
            return response.status(500).send(text);
        }

        const buffer = await result.arrayBuffer();
        response.setHeader('Content-Type', 'audio/mpeg');
        return response.send(Buffer.from(buffer));
    } catch (error) {
        console.error('OpenAI TTS generation failed', error);
        response.status(500).send('Internal server error');
    }
});

router.use('/custom', custom);

/**
 * Creates a transcribe-audio endpoint handler for a given provider.
 * @param {object} config - Provider configuration
 * @param {string} config.secretKey - The SECRET_KEYS enum value for the provider
 * @param {string} config.apiUrl - The transcription API endpoint URL
 * @param {string} config.providerName - Display name for logging
 * @returns {import('express').RequestHandler} Express request handler
 */
function createTranscribeHandler({ secretKey, apiUrl, providerName }) {
    return async (request, response) => {
        try {
            const key = readSecret(request.user.directories, secretKey);

            if (!key) {
                console.warn(`No ${providerName} key found`);
                return response.sendStatus(400);
            }

            if (!request.file) {
                console.warn('No audio file found');
                return response.sendStatus(400);
            }

            console.info(`Processing audio file with ${providerName}`, request.file.path);
            const formData = new FormData();
            formData.append('file', fs.createReadStream(request.file.path), { filename: 'audio.wav', contentType: 'audio/wav' });
            formData.append('model', request.body.model);

            if (request.body.language) {
                formData.append('language', request.body.language);
            }

            const result = await fetch(apiUrl, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${key}`,
                    ...formData.getHeaders(),
                },
                body: formData,
            });

            if (!result.ok) {
                const text = await result.text();
                console.warn(`${providerName} request failed`, result.statusText, text);
                return response.status(500).send(text);
            }

            fs.unlinkSync(request.file.path);
            const data = await result.json();
            console.debug(`${providerName} transcription response`, data);
            return response.json(data);
        } catch (error) {
            console.error(`${providerName} transcription failed`, error);
            response.status(500).send('Internal server error');
        }
    };
}

router.post('/transcribe-audio', createTranscribeHandler({
    secretKey: SECRET_KEYS.OPENAI,
    apiUrl: 'https://api.openai.com/v1/audio/transcriptions',
    providerName: 'OpenAI',
}));

router.post('/groq/transcribe-audio', createTranscribeHandler({
    secretKey: SECRET_KEYS.GROQ,
    apiUrl: 'https://api.groq.com/openai/v1/audio/transcriptions',
    providerName: 'Groq',
}));

router.post('/mistral/transcribe-audio', createTranscribeHandler({
    secretKey: SECRET_KEYS.MISTRALAI,
    apiUrl: 'https://api.mistral.ai/v1/audio/transcriptions',
    providerName: 'MistralAI',
}));

router.post('/zai/transcribe-audio', createTranscribeHandler({
    secretKey: SECRET_KEYS.ZAI,
    apiUrl: 'https://api.z.ai/api/paas/v4/audio/transcriptions',
    providerName: 'Z.AI',
}));

router.post('/chutes/transcribe-audio', async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.CHUTES);

        if (!key) {
            console.warn('No Chutes key found');
            return response.sendStatus(400);
        }

        if (!request.file) {
            console.warn('No audio file found');
            return response.sendStatus(400);
        }

        console.info('Processing audio file with Chutes', request.file.path);
        const audioBase64 = fs.readFileSync(request.file.path).toString('base64');

        const result = await fetch(`https://${request.body.model}.chutes.ai/transcribe`, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                audio_b64: audioBase64,
            }),
        });

        if (!result.ok) {
            const text = await result.text();
            console.warn('Chutes request failed', result.statusText, text);
            return response.status(500).send(text);
        }

        fs.unlinkSync(request.file.path);
        const data = await result.json();
        console.debug('Chutes transcription response', data);

        if (!Array.isArray(data)) {
            console.warn('Chutes transcription response invalid', data);
            return response.sendStatus(500);
        }

        const fullText = data.map(chunk => chunk.text || '').join('').trim();
        return response.json({ text: fullText });
    } catch (error) {
        console.error('Chutes transcription failed', error);
        response.status(500).send('Internal server error');
    }
});
