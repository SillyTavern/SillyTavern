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

        let model = req.body.model;
        if (!model) {
            console.warn('Volcengine generate-voice request missing required parameter model, use default model instead');
            model = 'seed-tts-1.1';
        }

        const appId = readSecret(req.user.directories, SECRET_KEYS.VOLCENGINE_APP_ID);
        const accessKey = readSecret(req.user.directories, SECRET_KEYS.VOLCENGINE_ACCESS_KEY);

        if (!appId || !accessKey) {
            console.warn('Volcengine generate-voice request missing required parameters appId or accessKey');
            return res.sendStatus(403);
        }

        const resourceId = req.body.resource_id || '';
        let text = req.body.text || '';
        text = text.split('...').join('');
        const voice_speaker = req.body.voice_speaker || '';

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
                    'model': model,
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
            return res.sendStatus(500);
        }

        // 处理流式响应
        const decoder = new TextDecoder();
        let audioChunks = [];

        // 使用Node.js流事件处理
        await new Promise((resolve, reject) => {
            let buffer = '';
            if (!response.body) {
                reject(new Error('Response body is null'));
                return;
            }
            response.body.on('data', (chunk) => {
                // 解码并添加到缓冲区
                buffer += decoder.decode(chunk, { stream: true });

                // 按行分割
                const lines = buffer.split('\n');
                buffer = lines.pop() || ''; // 保留不完整的行到缓冲区

                // 处理每一行完整的JSON
                for (const line of lines) {
                    if (!line.trim()) continue;

                    try {
                        const { data } = JSON.parse(line);
                        if (data) {
                            // 提取base64音频数据并解码为二进制
                            const audioData = Buffer.from(data, 'base64');
                            audioChunks.push(audioData);
                        }
                    } catch (e) {
                        console.error('Error parsing Volcengine TTS stream line:', e);
                    }
                }
            });

            response.body.on('end', () => {
                // 处理最后可能剩余的缓冲区数据
                if (buffer.trim()) {
                    try {
                        const data = JSON.parse(buffer);
                        if (data.audio && data.audio.audio_data) {
                            const audioData = Buffer.from(data.audio.audio_data, 'base64');
                            audioChunks.push(audioData);
                        }
                    } catch (e) {
                        console.error('Error parsing final Volcengine TTS stream line:', e);
                    }
                }
                resolve(buffer);
            });

            response.body.on('error', (error) => {
                console.error('Error reading Volcengine TTS stream:', error);
                reject(error);
            });
        });

        // 合并所有音频块
        const finalAudioData = Buffer.concat(audioChunks);

        res.set('Content-Type', 'audio/mp3');
        res.status(200).send(finalAudioData);
    } catch (error) {
        console.error('Volcengine generate-voice fetch failed', error);
        res.status(500).send('Internal server error');
    }
});
