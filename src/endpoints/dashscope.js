import express from 'express';
import fetch from 'node-fetch';
import { readSecret, SECRET_KEYS } from './secrets.js';

export const router = express.Router();

// Audio format MIME type mapping
const getAudioMimeType = (format) => {
    const mimeTypes = {
        'wav': 'audio/wav',
        'mp3': 'audio/mpeg',
        'aac': 'audio/aac',
        'flac': 'audio/flac',
    };
    return mimeTypes[format] || 'audio/wav';
};

router.post('/generate-voice', async (request, response) => {
    try {
        const {
            text,
            voiceId,
            apiHost = 'https://dashscope.aliyuncs.com',
            model = 'qwen3-tts-flash',
            languageType = 'Chinese',
            format = 'wav',
        } = request.body;

        const apiKey = readSecret(request.user.directories, SECRET_KEYS.DASHSCOPE);

        if (!text || !voiceId || !apiKey) {
            console.warn('DashScope TTS: Missing required parameters');
            return response.status(400).json({ error: 'Missing required parameters: text, voiceId, and apiKey are required' });
        }

        const apiUrl = `${apiHost}/api/v1/services/aigc/multimodal-generation/generation`;

        const requestBody = {
            model,
            input: {
                text,
                voice: voiceId,
                language_type: languageType,
            },
        };

        console.debug('DashScope TTS Request:', {
            url: apiUrl,
            body: { ...requestBody, input: { ...requestBody.input, voice: '[REDACTED]' } },
        });

        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
            },
            body: JSON.stringify(requestBody),
        });

        if (!apiResponse.ok) {
            let errorMessage = `HTTP ${apiResponse.status}`;
            try {
                const errorData = await apiResponse.json();
                console.error('DashScope TTS API error (JSON):', errorData);
                errorMessage = errorData.error?.message || errorData.message || errorData.detail || errorMessage;
            } catch (jsonError) {
                try {
                    const errorText = await apiResponse.text();
                    console.error('DashScope TTS API error (Text):', errorText);
                    errorMessage = errorText || errorMessage;
                } catch (textError) {
                    console.error('DashScope TTS: Failed to read error response:', textError);
                }
            }
            return response.status(500).json({ error: errorMessage });
        }

        /** @type {any} */
        let responseData;
        try {
            responseData = await apiResponse.json();
            console.debug('DashScope TTS Response received');
        } catch (jsonError) {
            console.error('DashScope TTS: Failed to parse response as JSON:', jsonError);
            return response.status(500).json({ error: 'Invalid response format from DashScope API' });
        }

        // Expected response: { output: { audio: { url: string } } } or audio bytes
        const audioUrl = responseData?.output?.audio?.url;
        if (audioUrl && typeof audioUrl === 'string') {
            try {
                const audioResponse = await fetch(audioUrl);
                if (!audioResponse.ok) {
                    console.error('DashScope TTS: Failed to fetch audio from URL:', audioResponse.status);
                    return response.status(500).json({ error: `Failed to fetch audio from URL: ${audioResponse.status}` });
                }

                const audioBuffer = await audioResponse.arrayBuffer();
                const mimeType = getAudioMimeType(format);
                response.setHeader('Content-Type', mimeType);
                response.setHeader('Content-Length', audioBuffer.byteLength);
                return response.send(Buffer.from(audioBuffer));
            } catch (urlError) {
                console.error('DashScope TTS: Error fetching audio from URL:', urlError);
                return response.status(500).json({ error: `Failed to fetch audio: ${urlError.message}` });
            }
        }

        // If audio bytes are directly returned (rare), attempt to handle
        const audioBytes = responseData?.output?.audio?.bytes;
        if (audioBytes && Array.isArray(audioBytes)) {
            const mimeType = getAudioMimeType(format);
            response.setHeader('Content-Type', mimeType);
            response.setHeader('Content-Length', audioBytes.length);
            return response.send(Buffer.from(new Uint8Array(audioBytes)));
        }

        const errorMessage = responseData?.error?.message || 'Unknown error: No audio in response';
        console.error('DashScope TTS: No valid audio data in response:', responseData);
        return response.status(500).json({ error: `API Error: ${errorMessage}` });
    } catch (error) {
        console.error('DashScope TTS generation failed:', error);
        return response.status(500).json({ error: 'Internal server error' });
    }
});
