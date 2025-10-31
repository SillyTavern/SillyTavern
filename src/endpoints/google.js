import { Buffer } from 'node:buffer';
import fetch from 'node-fetch';
import express from 'express';
import { speak, languages } from 'google-translate-api-x';
import crypto from 'node:crypto';

import { readSecret, SECRET_KEYS } from './secrets.js';
import { GEMINI_SAFETY } from '../constants.js';
import { getConfigValue, trimTrailingSlash } from '../util.js';

const API_MAKERSUITE = 'https://generativelanguage.googleapis.com';
const API_VERTEX_AI = 'https://us-central1-aiplatform.googleapis.com';

function createWavHeader(dataSize, sampleRate, numChannels = 1, bitsPerSample = 16) {
    const header = Buffer.alloc(44);
    header.write('RIFF', 0);
    header.writeUInt32LE(36 + dataSize, 4);
    header.write('WAVE', 8);
    header.write('fmt ', 12);
    header.writeUInt32LE(16, 16);
    header.writeUInt16LE(1, 20);
    header.writeUInt16LE(numChannels, 22);
    header.writeUInt32LE(sampleRate, 24);
    header.writeUInt32LE(sampleRate * numChannels * bitsPerSample / 8, 28);
    header.writeUInt16LE(numChannels * bitsPerSample / 8, 32);
    header.writeUInt16LE(bitsPerSample, 34);
    header.write('data', 36);
    header.writeUInt32LE(dataSize, 40);
    return header;
}

function createCompleteWavFile(pcmData, sampleRate) {
    const header = createWavHeader(pcmData.length, sampleRate);
    return Buffer.concat([header, pcmData]);
}

// Vertex AI authentication helper functions
export async function getVertexAIAuth(request) {
    const authMode = request.body.vertexai_auth_mode || 'express';

    if (request.body.reverse_proxy) {
        return {
            authHeader: `Bearer ${request.body.proxy_password}`,
            authType: 'proxy',
        };
    }

    if (authMode === 'express') {
        const apiKey = readSecret(request.user.directories, SECRET_KEYS.VERTEXAI);
        if (apiKey) {
            return {
                authHeader: `Bearer ${apiKey}`,
                authType: 'express',
            };
        }
        throw new Error('API key is required for Vertex AI Express mode');
    } else if (authMode === 'full') {
        // Get service account JSON from backend storage
        const serviceAccountJson = readSecret(request.user.directories, SECRET_KEYS.VERTEXAI_SERVICE_ACCOUNT);

        if (serviceAccountJson) {
            try {
                const serviceAccount = JSON.parse(serviceAccountJson);
                const jwtToken = await generateJWTToken(serviceAccount);
                const accessToken = await getAccessToken(jwtToken);
                return {
                    authHeader: `Bearer ${accessToken}`,
                    authType: 'full',
                };
            } catch (error) {
                console.error('Failed to authenticate with service account:', error);
                throw new Error(`Service account authentication failed: ${error.message}`);
            }
        }
        throw new Error('Service Account JSON is required for Vertex AI Full mode');
    }

    throw new Error(`Unsupported Vertex AI authentication mode: ${authMode}`);
}

/**
 * Generates a JWT token for Google Cloud authentication using service account credentials.
 * @param {object} serviceAccount Service account JSON object
 * @returns {Promise<string>} JWT token
 */
export async function generateJWTToken(serviceAccount) {
    const now = Math.floor(Date.now() / 1000);
    const expiry = now + 3600; // 1 hour

    const header = {
        alg: 'RS256',
        typ: 'JWT',
    };

    const payload = {
        iss: serviceAccount.client_email,
        scope: 'https://www.googleapis.com/auth/cloud-platform',
        aud: 'https://oauth2.googleapis.com/token',
        iat: now,
        exp: expiry,
    };

    const headerBase64 = Buffer.from(JSON.stringify(header)).toString('base64url');
    const payloadBase64 = Buffer.from(JSON.stringify(payload)).toString('base64url');
    const signatureInput = `${headerBase64}.${payloadBase64}`;

    // Create signature using private key
    const sign = crypto.createSign('RSA-SHA256');
    sign.update(signatureInput);
    const signature = sign.sign(serviceAccount.private_key, 'base64url');

    return `${signatureInput}.${signature}`;
}

export async function getAccessToken(jwtToken) {
    const response = await fetch('https://oauth2.googleapis.com/token', {
        method: 'POST',
        headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
        body: new URLSearchParams({
            grant_type: 'urn:ietf:params:oauth:grant-type:jwt-bearer',
            assertion: jwtToken,
        }),
    });

    if (!response.ok) {
        const error = await response.text();
        throw new Error(`Failed to get access token: ${error}`);
    }

    /** @type {any} */
    const data = await response.json();
    return data.access_token;
}

/**
 * Extracts the project ID from a Service Account JSON object.
 * @param {object} serviceAccount Service account JSON object
 * @returns {string} Project ID
 * @throws {Error} If project ID is not found in the service account
 */
export function getProjectIdFromServiceAccount(serviceAccount) {
    if (!serviceAccount || typeof serviceAccount !== 'object') {
        throw new Error('Invalid service account object');
    }

    const projectId = serviceAccount.project_id;
    if (!projectId || typeof projectId !== 'string') {
        throw new Error('Project ID not found in service account JSON');
    }

    return projectId;
}

/**
 * Generates Google API URL and headers based on request configuration
 * @param {express.Request} request Express request object
 * @param {string} model Model name to use
 * @param {string} endpoint API endpoint (default: 'generateContent')
 * @returns {Promise<{url: string, headers: object, apiName: string}>} URL, headers, and API name
 */
export async function getGoogleApiConfig(request, model, endpoint = 'generateContent') {
    const useVertexAi = request.body.api === 'vertexai';
    const region = request.body.vertexai_region || 'us-central1';
    const apiName = useVertexAi ? 'Google Vertex AI' : 'Google AI Studio';

    let url;
    let headers = {
        'Content-Type': 'application/json',
    };

    if (useVertexAi) {
        // Get authentication for Vertex AI
        const { authHeader, authType } = await getVertexAIAuth(request);

        if (authType === 'express') {
            // Express mode: use API key parameter
            const keyParam = authHeader.replace('Bearer ', '');
            const projectId = request.body.vertexai_express_project_id;
            const baseUrl = region === 'global'
                ? 'https://aiplatform.googleapis.com'
                : `https://${region}-aiplatform.googleapis.com`;
            url = projectId
                ? `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:${endpoint}?key=${keyParam}`
                : `${baseUrl}/v1/publishers/google/models/${model}:${endpoint}?key=${keyParam}`;
        } else if (authType === 'full') {
            // Full mode: use project-specific URL with Authorization header
            // Get project ID from Service Account JSON
            const serviceAccountJson = readSecret(request.user.directories, SECRET_KEYS.VERTEXAI_SERVICE_ACCOUNT);
            if (!serviceAccountJson) {
                throw new Error('Vertex AI Service Account JSON is missing.');
            }

            let projectId;
            try {
                const serviceAccount = JSON.parse(serviceAccountJson);
                projectId = getProjectIdFromServiceAccount(serviceAccount);
            } catch (error) {
                throw new Error('Failed to extract project ID from Service Account JSON.');
            }
            // Handle global region differently - no region prefix in hostname
            url = region === 'global'
                ? `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:${endpoint}`
                : `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:${endpoint}`;
            headers['Authorization'] = authHeader;
        } else {
            // Proxy mode: use Authorization header
            const apiUrl = trimTrailingSlash(request.body.reverse_proxy || API_VERTEX_AI);
            url = `${apiUrl}/v1/publishers/google/models/${model}:${endpoint}`;
            headers['Authorization'] = authHeader;
        }
    } else {
        // Google AI Studio
        const apiKey = request.body.reverse_proxy ? request.body.proxy_password : readSecret(request.user.directories, SECRET_KEYS.MAKERSUITE);
        const apiUrl = trimTrailingSlash(request.body.reverse_proxy || API_MAKERSUITE);
        const apiVersion = getConfigValue('gemini.apiVersion', 'v1beta');
        url = `${apiUrl}/${apiVersion}/models/${model}:${endpoint}?key=${apiKey}`;
    }

    return { url, headers, apiName };
}

export const router = express.Router();

router.post('/caption-image', async (request, response) => {
    try {
        const mimeType = request.body.image.split(';')[0].split(':')[1];
        const base64Data = request.body.image.split(',')[1];
        const model = request.body.model || 'gemini-2.0-flash';
        const { url, headers, apiName } = await getGoogleApiConfig(request, model);

        const body = {
            contents: [{
                role: 'user',
                parts: [
                    { text: request.body.prompt },
                    {
                        inlineData: {
                            mimeType: mimeType,
                            data: base64Data,
                        },
                    }],
            }],
            safetySettings: GEMINI_SAFETY,
        };

        console.debug(`${apiName} captioning request`, model, body);

        const result = await fetch(url, {
            body: JSON.stringify(body),
            method: 'POST',
            headers: headers,
        });

        if (!result.ok) {
            const error = await result.json();
            console.error(`${apiName} API returned error: ${result.status} ${result.statusText}`, error);
            return response.status(500).send({ error: true });
        }

        /** @type {any} */
        const data = await result.json();
        console.info(`${apiName} captioning response`, data);

        const candidates = data?.candidates;
        if (!candidates) {
            return response.status(500).send('No candidates found, image was most likely filtered.');
        }

        const caption = candidates[0].content.parts[0].text;
        if (!caption) {
            return response.status(500).send('No caption found');
        }

        return response.json({ caption });
    } catch (error) {
        console.error(error);
        response.status(500).send('Internal server error');
    }
});

router.post('/list-voices', (_, response) => {
    return response.json(languages);
});

router.post('/generate-voice', async (request, response) => {
    try {
        const text = request.body.text;
        const voice = request.body.voice ?? 'en';

        const result = await speak(text, { to: voice, forceBatch: false });
        const buffer = Array.isArray(result)
            ? Buffer.concat(result.map(x => new Uint8Array(Buffer.from(x.toString(), 'base64'))))
            : Buffer.from(result.toString(), 'base64');

        response.setHeader('Content-Type', 'audio/mpeg');
        return response.send(buffer);
    } catch (error) {
        console.error('Google Translate TTS generation failed', error);
        response.status(500).send('Internal server error');
    }
});

router.post('/list-native-voices', async (_, response) => {
    try {
        // Hardcoded Gemini native TTS voices from official documentation
        // Source: https://ai.google.dev/gemini-api/docs/speech-generation#voices
        const voices = [
            { name: 'Zephyr', voice_id: 'Zephyr', lang: 'en-US', description: 'Bright' },
            { name: 'Puck', voice_id: 'Puck', lang: 'en-US', description: 'Upbeat' },
            { name: 'Charon', voice_id: 'Charon', lang: 'en-US', description: 'Informative' },
            { name: 'Kore', voice_id: 'Kore', lang: 'en-US', description: 'Firm' },
            { name: 'Fenrir', voice_id: 'Fenrir', lang: 'en-US', description: 'Excitable' },
            { name: 'Leda', voice_id: 'Leda', lang: 'en-US', description: 'Youthful' },
            { name: 'Orus', voice_id: 'Orus', lang: 'en-US', description: 'Firm' },
            { name: 'Aoede', voice_id: 'Aoede', lang: 'en-US', description: 'Breezy' },
            { name: 'Callirhoe', voice_id: 'Callirhoe', lang: 'en-US', description: 'Easy-going' },
            { name: 'Autonoe', voice_id: 'Autonoe', lang: 'en-US', description: 'Bright' },
            { name: 'Enceladus', voice_id: 'Enceladus', lang: 'en-US', description: 'Breathy' },
            { name: 'Iapetus', voice_id: 'Iapetus', lang: 'en-US', description: 'Clear' },
            { name: 'Umbriel', voice_id: 'Umbriel', lang: 'en-US', description: 'Easy-going' },
            { name: 'Algieba', voice_id: 'Algieba', lang: 'en-US', description: 'Smooth' },
            { name: 'Despina', voice_id: 'Despina', lang: 'en-US', description: 'Smooth' },
            { name: 'Erinome', voice_id: 'Erinome', lang: 'en-US', description: 'Clear' },
            { name: 'Algenib', voice_id: 'Algenib', lang: 'en-US', description: 'Gravelly' },
            { name: 'Rasalgethi', voice_id: 'Rasalgethi', lang: 'en-US', description: 'Informative' },
            { name: 'Laomedeia', voice_id: 'Laomedeia', lang: 'en-US', description: 'Upbeat' },
            { name: 'Achernar', voice_id: 'Achernar', lang: 'en-US', description: 'Soft' },
            { name: 'Alnilam', voice_id: 'Alnilam', lang: 'en-US', description: 'Firm' },
            { name: 'Schedar', voice_id: 'Schedar', lang: 'en-US', description: 'Even' },
            { name: 'Gacrux', voice_id: 'Gacrux', lang: 'en-US', description: 'Mature' },
            { name: 'Pulcherrima', voice_id: 'Pulcherrima', lang: 'en-US', description: 'Forward' },
            { name: 'Achird', voice_id: 'Achird', lang: 'en-US', description: 'Friendly' },
            { name: 'Zubenelgenubi', voice_id: 'Zubenelgenubi', lang: 'en-US', description: 'Casual' },
            { name: 'Vindemiatrix', voice_id: 'Vindemiatrix', lang: 'en-US', description: 'Gentle' },
            { name: 'Sadachbia', voice_id: 'Sadachbia', lang: 'en-US', description: 'Lively' },
            { name: 'Sadaltager', voice_id: 'Sadaltager', lang: 'en-US', description: 'Knowledgeable' },
            { name: 'Sulafat', voice_id: 'Sulafat', lang: 'en-US', description: 'Warm' },
        ];
        return response.json({ voices });
    } catch (error) {
        console.error('Failed to return Google TTS voices:', error);
        response.sendStatus(500);
    }
});

router.post('/generate-native-tts', async (request, response) => {
    try {
        const { text, voice, model } = request.body;
        const { url, headers, apiName } = await getGoogleApiConfig(request, model);

        console.debug(`${apiName} TTS request`, { model, text, voice });

        const requestBody = {
            contents: [{
                role: 'user',
                parts: [{ text: text }],
            }],
            generationConfig: {
                responseModalities: ['AUDIO'],
                speechConfig: {
                    voiceConfig: {
                        prebuiltVoiceConfig: {
                            voiceName: voice,
                        },
                    },
                },
            },
            safetySettings: GEMINI_SAFETY,
        };

        const result = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody),
        });

        if (!result.ok) {
            const errorText = await result.text();
            console.error(`${apiName} TTS API error: ${result.status} ${result.statusText}`, errorText);
            const errorMessage = JSON.parse(errorText).error?.message || 'TTS generation failed.';
            return response.status(result.status).json({ error: errorMessage });
        }

        /** @type {any} */
        const data = await result.json();
        const audioPart = data?.candidates?.[0]?.content?.parts?.[0];
        const audioData = audioPart?.inlineData?.data;
        const mimeType = audioPart?.inlineData?.mimeType;

        if (!audioData) {
            return response.status(500).json({ error: 'No audio data found in response' });
        }

        const audioBuffer = Buffer.from(audioData, 'base64');

        //If the audio is raw PCM, wrap it in a WAV header and send it.
        if (mimeType && mimeType.toLowerCase().includes('audio/l16')) {
            const rateMatch = mimeType.match(/rate=(\d+)/);
            const sampleRate = rateMatch ? parseInt(rateMatch[1], 10) : 24000;
            const pcmData = audioBuffer;

            // Create a complete, playable WAV file buffer.
            const wavBuffer = createCompleteWavFile(pcmData, sampleRate);

            // Send the WAV file directly to the browser. This is much faster.
            response.setHeader('Content-Type', 'audio/wav');
            return response.send(wavBuffer);
        }

        // Fallback for any other audio format Google might send in the future.
        response.setHeader('Content-Type', mimeType || 'application/octet-stream');
        response.send(audioBuffer);
    } catch (error) {
        console.error('Google TTS generation failed:', error);
        if (!response.headersSent) {
            return response.status(500).json({ error: 'Internal server error during TTS generation' });
        }
        return response.end();
    }
});

router.post('/generate-image', async (request, response) => {
    try {
        const model = request.body.model || 'imagen-3.0-generate-002';
        const { url, headers, apiName } = await getGoogleApiConfig(request, model, 'predict');

        // AI Studio is stricter than Vertex AI.
        const isVertex = request.body.api === 'vertexai';
        // Is it even worth it?
        const isDeprecated = model.startsWith('imagegeneration');

        const requestBody = {
            instances: [{
                prompt: request.body.prompt || '',
            }],
            parameters: {
                sampleCount: 1,
                seed: isVertex ? Number(request.body.seed ?? Math.floor(Math.random() * 1000000)) : undefined,
                enhancePrompt: isVertex ? Boolean(request.body.enhance ?? false) : undefined,
                negativePrompt: isVertex ? (request.body.negative_prompt || undefined) : undefined,
                aspectRatio: String(request.body.aspect_ratio || '1:1'),
                personGeneration: !isDeprecated ? 'allow_all' : undefined,
                language: isVertex ? 'auto' : undefined,
                safetySetting: !isDeprecated ? (isVertex ? 'block_only_high' : 'block_low_and_above') : undefined,
                addWatermark: isVertex ? false : undefined,
                outputOptions: {
                    mimeType: 'image/jpeg',
                    compressionQuality: 100,
                },
            },
        };

        console.debug(`${apiName} image generation request:`, model, requestBody);

        const result = await fetch(url, {
            method: 'POST',
            headers: headers,
            body: JSON.stringify(requestBody),
        });

        if (!result.ok) {
            const errorText = await result.text();
            console.warn(`${apiName} image generation error: ${result.status} ${result.statusText}`, errorText);
            return response.sendStatus(500);
        }

        /** @type {any} */
        const data = await result.json();
        const imagePart = data?.predictions?.[0]?.bytesBase64Encoded;

        if (!imagePart) {
            console.warn(`${apiName} image generation error: No image data found in response`);
            return response.sendStatus(500);
        }

        return response.send({ image: imagePart });
    } catch (error) {
        console.error('Google Image generation failed:', error);
        if (!response.headersSent) {
            return response.sendStatus(500);
        }
        return response.end();
    }
});
