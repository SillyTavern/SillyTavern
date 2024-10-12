import fs from 'node:fs';
import { Buffer } from 'node:buffer';

import fetch from 'node-fetch';
import FormData from 'form-data';
import express from 'express';

import { jsonParser, urlencodedParser } from '../express-common.js';
import { getConfigValue, mergeObjectWithYaml, excludeKeysByYaml, trimV1 } from '../util.js';
import { setAdditionalHeaders } from '../additional-headers.js';
import { readSecret, SECRET_KEYS } from './secrets.js';
import { OPENROUTER_HEADERS } from '../constants.js';

export const router = express.Router();

router.post('/caption-image', jsonParser, async (request, response) => {
    try {
        let key = '';
        let headers = {};
        let bodyParams = {};

        if (request.body.api === 'openai' && !request.body.reverse_proxy) {
            key = readSecret(request.user.directories, SECRET_KEYS.OPENAI);
        }

        if (request.body.api === 'openrouter' && !request.body.reverse_proxy) {
            key = readSecret(request.user.directories, SECRET_KEYS.OPENROUTER);
        }

        if (request.body.reverse_proxy && request.body.proxy_password) {
            key = request.body.proxy_password;
        }

        if (request.body.api === 'custom') {
            key = readSecret(request.user.directories, SECRET_KEYS.CUSTOM);
            mergeObjectWithYaml(bodyParams, request.body.custom_include_body);
            mergeObjectWithYaml(headers, request.body.custom_include_headers);
        }

        if (request.body.api === 'ooba') {
            key = readSecret(request.user.directories, SECRET_KEYS.OOBA);
            bodyParams.temperature = 0.1;
        }

        if (request.body.api === 'koboldcpp') {
            key = readSecret(request.user.directories, SECRET_KEYS.KOBOLDCPP);
        }

        if (request.body.api === 'vllm') {
            key = readSecret(request.user.directories, SECRET_KEYS.VLLM);
        }

        if (request.body.api === 'zerooneai') {
            key = readSecret(request.user.directories, SECRET_KEYS.ZEROONEAI);
        }

        if (request.body.api === 'mistral') {
            key = readSecret(request.user.directories, SECRET_KEYS.MISTRALAI);
        }

        if (request.body.api === 'groq') {
            key = readSecret(request.user.directories, SECRET_KEYS.GROQ);
        }

        if (!key && !request.body.reverse_proxy && ['custom', 'ooba', 'koboldcpp', 'vllm'].includes(request.body.api) === false) {
            console.log('No key found for API', request.body.api);
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

        console.log('Multimodal captioning request', body);

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

        if (request.body.api === 'zerooneai') {
            apiUrl = 'https://api.01.ai/v1/chat/completions';
        }

        if (request.body.api === 'groq') {
            apiUrl = 'https://api.groq.com/openai/v1/chat/completions';
        }

        if (request.body.api === 'mistral') {
            apiUrl = 'https://api.mistral.ai/v1/chat/completions';
        }

        if (request.body.api === 'ooba') {
            apiUrl = `${trimV1(request.body.server_url)}/v1/chat/completions`;
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

        if (request.body.api === 'koboldcpp' || request.body.api === 'vllm') {
            apiUrl = `${trimV1(request.body.server_url)}/v1/chat/completions`;
        }

        setAdditionalHeaders(request, { headers }, apiUrl);

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
            console.log('Multimodal captioning request failed', result.statusText, text);
            return response.status(500).send(text);
        }

        /** @type {any} */
        const data = await result.json();
        console.log('Multimodal captioning response', data);
        const caption = data?.choices[0]?.message?.content;

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

router.post('/transcribe-audio', urlencodedParser, async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.OPENAI);

        if (!key) {
            console.log('No OpenAI key found');
            return response.sendStatus(400);
        }

        if (!request.file) {
            console.log('No audio file found');
            return response.sendStatus(400);
        }

        const formData = new FormData();
        console.log('Processing audio file', request.file.path);
        formData.append('file', fs.createReadStream(request.file.path), { filename: 'audio.wav', contentType: 'audio/wav' });
        formData.append('model', request.body.model);

        if (request.body.language) {
            formData.append('language', request.body.language);
        }

        const result = await fetch('https://api.openai.com/v1/audio/transcriptions', {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${key}`,
                ...formData.getHeaders(),
            },
            body: formData,
        });

        if (!result.ok) {
            const text = await result.text();
            console.log('OpenAI request failed', result.statusText, text);
            return response.status(500).send(text);
        }

        fs.rmSync(request.file.path);
        const data = await result.json();
        console.log('OpenAI transcription response', data);
        return response.json(data);
    } catch (error) {
        console.error('OpenAI transcription failed', error);
        response.status(500).send('Internal server error');
    }
});

router.post('/generate-voice', jsonParser, async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.OPENAI);

        if (!key) {
            console.log('No OpenAI key found');
            return response.sendStatus(400);
        }

        const result = await fetch('https://api.openai.com/v1/audio/speech', {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                Authorization: `Bearer ${key}`,
            },
            body: JSON.stringify({
                input: request.body.text,
                response_format: 'mp3',
                voice: request.body.voice ?? 'alloy',
                speed: request.body.speed ?? 1,
                model: request.body.model ?? 'tts-1',
            }),
        });

        if (!result.ok) {
            const text = await result.text();
            console.log('OpenAI request failed', result.statusText, text);
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

router.post('/generate-image', jsonParser, async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.OPENAI);

        if (!key) {
            console.log('No OpenAI key found');
            return response.sendStatus(400);
        }

        console.log('OpenAI request', request.body);

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
            console.log('OpenAI request failed', result.statusText, text);
            return response.status(500).send(text);
        }

        const data = await result.json();
        return response.json(data);
    } catch (error) {
        console.error(error);
        response.status(500).send('Internal server error');
    }
});

const custom = express.Router();

custom.post('/generate-voice', jsonParser, async (request, response) => {
    try {
        const key = readSecret(request.user.directories, SECRET_KEYS.CUSTOM_OPENAI_TTS);
        const { input, provider_endpoint, response_format, voice, speed, model } = request.body;

        if (!provider_endpoint) {
            console.log('No OpenAI-compatible TTS provider endpoint provided');
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
            console.log('OpenAI request failed', result.statusText, text);
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
