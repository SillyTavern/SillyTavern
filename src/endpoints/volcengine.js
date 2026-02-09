import fetch from 'node-fetch';
import { Router } from 'express';

import { readSecret, SECRET_KEYS } from './secrets.js';

export const router = Router();


router.post('/generate-voice', async (req, res) => {
    try {
        let provider_endpoint = req.body.provider_endpoint;
        if (!provider_endpoint) {
            console.warn('Volcengine endpoint not set, use default endpoint instead');
            provider_endpoint = 'https://openspeech.bytedance.com/api/v3/tts/unidirectional';
        }

        const appId = readSecret(req.user.directories, SECRET_KEYS.VOLCENGINE_APP_ID);
        const accessKey = readSecret(req.user.directories, SECRET_KEYS.VOLCENGINE_ACCESS_KEY);

        if (!appId || !accessKey) {
            console.warn('Volcengine generate-voice request missing required parameters appId or accessKey');
            return res.sendStatus(403);
        }

        const resourceId = req.body.resource_id;
        const text = req.body.text;
        const voice_speaker = req.body.voice_speaker;

        if (!resourceId || !text || !voice_speaker) {
            console.warn('Volcengine generate-voice request missing required parameters resourceId or text or voice_speaker');
            return res.sendStatus(400);
        }

        const response = await fetch(provider_endpoint, {
            method: 'POST',
            headers: {
                'X-Api-App-Id': appId || '',
                'X-Api-Access-Key': accessKey || '',
                'X-Api-Resource-Id': resourceId || '',
                'Content-Type': 'application/json',
            },
            body: JSON.stringify({
                'req_params': {
                    'text': text,
                    'speaker': voice_speaker,
                    'audio_params': {
                        'format': 'mp3',
                        'speech_rate': Number.parseInt(req.body.speed || '0'),
                    },
                    'additions': JSON.stringify({
                        'mute_cut_threshold': '400',
                        'mute_cut_remain_ms': '1',
                        'explicit_language': 'crosslingual',
                        'enable_language_detector': true,
                        'disable_markdown_filter': true,
                        'cache_config': {
                            'use_cache': true,
                            'text_type': 1,
                        },
                    }),
                },
            }),
        });

        if (!response.ok) {
            const logid = response.headers.get('X-Tt-Logid') || '';
            console.warn('Volcengine Request failed', response.status, response.statusText, logid);
            return res.header('X-Tt-Logid', logid).status(500).send(`TTS Generation Failed: ${response.statusText}`);
        }
        const decoder = new TextDecoder();

        const result = await new Promise((resolve, reject) => {
            let audioChunks_ = [];
            let buffer = '';
            if (!response.body) {
                reject(new Error('Response body is null'));
                return;
            }
            response.body.on('data', (chunk) => {
                buffer += decoder.decode(chunk, { stream: true });

                const lines = buffer.split('\n');
                buffer = lines.pop() || '';

                for (const line of lines) {
                    if (!line.trim()) continue;

                    try {
                        const { data, code, message } = JSON.parse(line);
                        if (code !== 0 && code !== 20000000) {
                            reject(`Volcengine TTS stream line code ${code}, ${message}`);
                            return;
                        }
                        if (data) {
                            const audioData = Buffer.from(data, 'base64');
                            audioChunks_.push(audioData);
                        }
                    } catch (e) {
                        console.error('Error parsing Volcengine TTS stream line:', e);
                    }
                }
            });

            response.body.on('end', () => {
                if (buffer.trim()) {
                    try {
                        const { code, data, message } = JSON.parse(buffer);
                        if (code !== 0 && code !== 20000000) {
                            reject(`Volcengine TTS stream line code ${code}, ${message}`);
                            return;
                        }
                        if (data) {
                            const audioData = Buffer.from(data, 'base64');
                            audioChunks_.push(audioData);
                        }
                    } catch (e) {
                        reject(`Error parsing final Volcengine TTS stream line: ${e}`);
                    }
                }
                resolve(audioChunks_);
            });

            response.body.on('error', (error) => {
                reject(`Error reading Volcengine TTS stream: ${error}`);
            });
        });

        const finalAudioData = Buffer.concat(result);

        res.set('Content-Type', 'audio/mpeg');
        res.status(200).send(finalAudioData);
    } catch (error) {
        console.error('Volcengine generate-voice fetch failed', error);
        res.status(500).send(`TTS Generation Failed: ${error}`);
    }
});
