import express from 'express';
import fetch from 'node-fetch';
import { readSecret, SECRET_KEYS } from './secrets.js';

export const router = express.Router();

// Audio format MIME type mapping
const getAudioMimeType = (format) => {
    const mimeTypes = {
        'mp3': 'audio/mpeg',
        'wav': 'audio/wav',
        'pcm': 'audio/pcm',
        'flac': 'audio/flac',
        'aac': 'audio/aac',
    };
    return mimeTypes[format] || 'audio/mpeg';
};

router.post('/generate-voice', async (request, response) => {
    try {
        const {
            text,
            voiceId,
            apiHost = 'https://api.minimax.io',
            model = 'speech-02-hd',
            speed = 1.0,
            volume = 1.0,
            pitch = 1.0,
            audioSampleRate = 32000,
            bitrate = 128000,
            format = 'mp3',
            language,
        } = request.body;

        const apiKey = readSecret(request.user.directories, SECRET_KEYS.MINIMAX);
        const groupId = readSecret(request.user.directories, SECRET_KEYS.MINIMAX_GROUP_ID);

        // Validate required parameters
        if (!text || !voiceId || !apiKey || !groupId) {
            console.warn('MiniMax TTS: Missing required parameters');
            return response.status(400).json({ error: 'Missing required parameters: text, voiceId, apiKey, and groupId are required' });
        }

        const requestBody = {
            model: model,
            text: text,
            stream: false,
            voice_setting: {
                voice_id: voiceId,
                speed: Number(speed),
                vol: Number(volume),
                pitch: Number(pitch),
            },
            audio_setting: {
                sample_rate: Number(audioSampleRate),
                bitrate: Number(bitrate),
                format: format,
                channel: 1,
            },
        };

        // Add language parameter if provided
        if (language) {
            requestBody.lang = language;
        }

        const apiUrl = `${apiHost}/v1/t2a_v2?GroupId=${groupId}`;

        console.debug('MiniMax TTS Request:', {
            url: apiUrl,
            body: { ...requestBody, voice_setting: { ...requestBody.voice_setting, voice_id: '[REDACTED]' } },
        });

        const apiResponse = await fetch(apiUrl, {
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${apiKey}`,
                'Content-Type': 'application/json',
                'MM-API-Source': 'SillyTavern-TTS',
            },
            body: JSON.stringify(requestBody),
        });

        if (!apiResponse.ok) {
            let errorMessage = `HTTP ${apiResponse.status}`;

            try {
                // Try to parse JSON error response
                /** @type {any} */
                const errorData = await apiResponse.json();
                console.error('MiniMax TTS API error (JSON):', errorData);

                // Check for MiniMax specific error format
                const baseResp = errorData?.base_resp;
                if (baseResp && baseResp.status_code !== 0) {
                    if (baseResp.status_code === 1004) {
                        errorMessage = 'Authentication failed - Please check your API key and API host';
                    } else {
                        errorMessage = `API Error: ${baseResp.status_msg}`;
                    }
                } else {
                    errorMessage = errorData.error?.message || errorData.message || errorData.detail || `HTTP ${apiResponse.status}`;
                }
            } catch (jsonError) {
                // If not JSON, try to read text
                try {
                    const errorText = await apiResponse.text();
                    console.error('MiniMax TTS API error (Text):', errorText);
                    if (errorText && errorText.length > 500) {
                        errorMessage = `HTTP ${apiResponse.status}: Response too large (${errorText.length} characters)`;
                    } else {
                        errorMessage = errorText || `HTTP ${apiResponse.status}`;
                    }
                } catch (textError) {
                    console.error('MiniMax TTS: Failed to read error response:', textError);
                    errorMessage = `HTTP ${apiResponse.status}: Unable to read error details`;
                }
            }

            console.error('MiniMax TTS API request failed:', errorMessage);
            return response.status(500).json({ error: errorMessage });
        }

        // Parse the response
        /** @type {any} */
        let responseData;
        try {
            responseData = await apiResponse.json();
            console.debug('MiniMax TTS Response received');
        } catch (jsonError) {
            console.error('MiniMax TTS: Failed to parse response as JSON:', jsonError);
            return response.status(500).json({ error: 'Invalid response format from MiniMax API' });
        }

        // Check for API error codes in response data
        const baseResp = responseData?.base_resp;
        if (baseResp && baseResp.status_code !== 0) {
            let errorMessage;
            if (baseResp.status_code === 1004) {
                errorMessage = 'Authentication failed - Please check your API key and API host';
            } else {
                errorMessage = `API Error: ${baseResp.status_msg}`;
            }
            console.error('MiniMax TTS API error:', baseResp);
            return response.status(500).json({ error: errorMessage });
        }

        // Process the audio data
        if (responseData.data && responseData.data.audio) {
            // Process hex-encoded audio data
            const hexAudio = responseData.data.audio;

            if (!hexAudio || typeof hexAudio !== 'string') {
                console.error('MiniMax TTS: Invalid audio data format');
                return response.status(500).json({ error: 'Invalid audio data format' });
            }

            // Remove possible prefix and spaces
            const cleanHex = hexAudio.replace(/^0x/, '').replace(/\s/g, '');

            // Validate hex string format
            if (!/^[0-9a-fA-F]*$/.test(cleanHex)) {
                console.error('MiniMax TTS: Invalid hex string format');
                return response.status(500).json({ error: 'Invalid audio data format' });
            }

            // Ensure hex string length is even
            const paddedHex = cleanHex.length % 2 === 0 ? cleanHex : '0' + cleanHex;

            try {
                // Convert hex string to byte array
                const hexMatches = paddedHex.match(/.{1,2}/g);
                if (!hexMatches) {
                    console.error('MiniMax TTS: Failed to parse hex string');
                    return response.status(500).json({ error: 'Invalid hex string format' });
                }
                const audioBytes = new Uint8Array(hexMatches.map(byte => parseInt(byte, 16)));

                if (audioBytes.length === 0) {
                    console.error('MiniMax TTS: Audio conversion resulted in empty array');
                    return response.status(500).json({ error: 'Audio data conversion failed' });
                }

                console.debug(`MiniMax TTS: Converted ${paddedHex.length} hex characters to ${audioBytes.length} bytes`);

                // Set appropriate headers and send audio data
                const mimeType = getAudioMimeType(format);
                response.setHeader('Content-Type', mimeType);
                response.setHeader('Content-Length', audioBytes.length);

                return response.send(Buffer.from(audioBytes));

            } catch (conversionError) {
                console.error('MiniMax TTS: Audio conversion error:', conversionError);
                return response.status(500).json({ error: `Audio data conversion failed: ${conversionError.message}` });
            }
        } else if (responseData.data && responseData.data.url) {
            // Handle URL-based audio response
            console.debug('MiniMax TTS: Received audio URL:', responseData.data.url);

            try {
                const audioResponse = await fetch(responseData.data.url);
                if (!audioResponse.ok) {
                    console.error('MiniMax TTS: Failed to fetch audio from URL:', audioResponse.status);
                    return response.status(500).json({ error: `Failed to fetch audio from URL: ${audioResponse.status}` });
                }

                const audioBuffer = await audioResponse.arrayBuffer();
                const mimeType = getAudioMimeType(format);

                response.setHeader('Content-Type', mimeType);
                response.setHeader('Content-Length', audioBuffer.byteLength);

                return response.send(Buffer.from(audioBuffer));
            } catch (urlError) {
                console.error('MiniMax TTS: Error fetching audio from URL:', urlError);
                return response.status(500).json({ error: `Failed to fetch audio: ${urlError.message}` });
            }
        } else {
            // Handle error response
            const errorMessage = responseData.base_resp?.status_msg || responseData.error?.message || 'Unknown error';
            console.error('MiniMax TTS: No valid audio data in response:', responseData);
            return response.status(500).json({ error: `API Error: ${errorMessage}` });
        }

    } catch (error) {
        console.error('MiniMax TTS generation failed:', error);
        return response.status(500).json({ error: 'Internal server error' });
    }
});
