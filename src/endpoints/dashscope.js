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
            voiceDescription = null, // For Voice Design voices
        } = request.body;

        const apiKey = readSecret(request.user.directories, SECRET_KEYS.DASHSCOPE);

        if (!text || !voiceId || !apiKey) {
            console.warn('DashScope TTS: Missing required parameters');
            return response.status(400).json({ error: 'Missing required parameters: text, voiceId, and apiKey are required' });
        }

        const apiUrl = `${apiHost}/api/v1/services/aigc/multimodal-generation/generation`;

        // If voiceDescription is provided, this is a Voice Design voice
        let requestBody;
        if (voiceDescription) {
            console.debug('DashScope TTS: Using Voice Design with description');
            requestBody = {
                model: 'qwen3-tts-vd-realtime-2025-12-16',
                input: {
                    text,
                    voice_description: voiceDescription,
                    language_type: languageType,
                },
            };
        } else {
            // Regular system voice or Voice Clone
            requestBody = {
                model,
                input: {
                    text,
                    voice: voiceId,
                    language_type: languageType,
                },
            };
        }

        console.debug('DashScope TTS Request:', {
            url: apiUrl,
            hasDescription: !!voiceDescription,
            model: requestBody.model,
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

router.post('/test-connection', async (request, response) => {
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

        if (!apiKey) {
            console.warn('DashScope TTS: Missing API key');
            return response.status(400).json({ error: 'API key is required' });
        }

        // Use simple test text if not provided
        const testText = text || 'Test';

        const apiUrl = `${apiHost}/api/v1/services/aigc/multimodal-generation/generation`;

        const requestBody = {
            model,
            input: {
                text: testText,
                voice: voiceId || 'Cherry',
                language_type: languageType,
            },
        };

        console.debug('DashScope TTS Test Connection Request:', {
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
                console.error('DashScope TTS test connection API error (JSON):', errorData);
                errorMessage = errorData.error?.message || errorData.message || errorData.detail || errorMessage;
            } catch (jsonError) {
                try {
                    const errorText = await apiResponse.text();
                    console.error('DashScope TTS test connection API error (Text):', errorText);
                    errorMessage = errorText || errorMessage;
                } catch (textError) {
                    console.error('DashScope TTS: Failed to read test connection error response:', textError);
                }
            }
            return response.status(500).json({ error: errorMessage });
        }

        const responseData = await apiResponse.json();
        console.debug('DashScope TTS: Test connection successful');

        return response.json({
            success: true,
            message: 'Connection test successful',
            apiHost: apiHost,
        });
    } catch (error) {
        console.error('DashScope TTS test connection failed:', error);
        return response.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Voice Clone endpoint
router.post('/create-voice-clone', async (request, response) => {
    try {
        const {
            name,
            audioData, // base64 data URL: "data:audio/...;base64,..."
            apiHost = 'https://dashscope.aliyuncs.com',
        } = request.body;

        const apiKey = readSecret(request.user.directories, SECRET_KEYS.DASHSCOPE);

        if (!name || !audioData || !apiKey) {
            console.warn('DashScope Voice Clone: Missing required parameters');
            return response.status(400).json({ error: 'Missing required parameters: name, audioData, and apiKey are required' });
        }

        const apiUrl = `${apiHost}/api/v1/services/audio/tts/customization`;

        const requestBody = {
            model: 'qwen-voice-enrollment', // Fixed model name for voice enrollment
            input: {
                action: 'create',
                target_model: 'qwen3-tts-vc-realtime-2025-11-27',
                preferred_name: name,
                audio: {
                    data: audioData, // Already in data URL format
                },
            },
        };

        console.debug('DashScope Voice Clone Request:', {
            url: apiUrl,
            name: name,
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
                console.error('DashScope Voice Clone API error (JSON):', errorData);
                errorMessage = errorData.error?.message || errorData.message || errorData.code || errorMessage;
            } catch (jsonError) {
                const errorText = await apiResponse.text();
                console.error('DashScope Voice Clone API error (Text):', errorText);
                errorMessage = errorText || errorMessage;
            }
            return response.status(500).json({ error: errorMessage });
        }

        const responseData = await apiResponse.json();
        const voiceId = responseData?.output?.voice;

        if (!voiceId) {
            console.error('DashScope Voice Clone: No voice ID in response:', responseData);
            return response.status(500).json({ error: 'Failed to get voice ID from API response' });
        }

        console.info('DashScope Voice Clone: Successfully created voice:', name);
        return response.json({
            success: true,
            voiceId: voiceId,
            name: name,
        });
    } catch (error) {
        console.error('DashScope Voice Clone failed:', error);
        return response.status(500).json({ error: error.message || 'Internal server error' });
    }
});

// Voice Design endpoint
router.post('/create-voice-design', async (request, response) => {
    try {
        const {
            name,
            description,
        } = request.body;

        const apiKey = readSecret(request.user.directories, SECRET_KEYS.DASHSCOPE);

        if (!name || !description || !apiKey) {
            console.warn('DashScope Voice Design: Missing required parameters');
            return response.status(400).json({ error: 'Missing required parameters: name, description, and apiKey are required' });
        }

        // Voice Design doesn't create a persistent voice ID like Voice Clone
        // Instead, we generate a unique identifier and store the description client-side
        // The description will be sent with each TTS request
        const voiceId = `vd_${Date.now()}_${Math.random().toString(36).substring(7)}`;

        console.info('DashScope Voice Design: Created voice identifier:', name);
        return response.json({
            success: true,
            voiceId: voiceId,
            name: name,
            description: description,
        });
    } catch (error) {
        console.error('DashScope Voice Design failed:', error);
        return response.status(500).json({ error: error.message || 'Internal server error' });
    }
});

