import { Buffer } from 'node:buffer';
import fetch from 'node-fetch';
import express from 'express';
import { speak, languages } from 'google-translate-api-x';
import crypto from 'node:crypto';

import { readSecret, SECRET_KEYS } from './secrets.js';
import { GEMINI_SAFETY } from '../constants.js';
import { trimTrailingSlash } from '../util.js';

const API_MAKERSUITE = 'https://generativelanguage.googleapis.com';
const API_VERTEX_AI = 'https://us-central1-aiplatform.googleapis.com';

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

export const router = express.Router();

router.post('/caption-image', async (request, response) => {
    try {
        const mimeType = request.body.image.split(';')[0].split(':')[1];
        const base64Data = request.body.image.split(',')[1];
        const useVertexAi = request.body.api === 'vertexai';
        const apiName = useVertexAi ? 'Google Vertex AI' : 'Google AI Studio';
        const model = request.body.model || 'gemini-2.0-flash';

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
                const apiUrl = trimTrailingSlash(request.body.reverse_proxy || API_VERTEX_AI);
                url = `${apiUrl}/v1/publishers/google/models/${model}:generateContent?key=${keyParam}`;
            } else if (authType === 'full') {
                // Full mode: use project-specific URL with Authorization header
                // Get project ID from Service Account JSON
                const serviceAccountJson = readSecret(request.user.directories, SECRET_KEYS.VERTEXAI_SERVICE_ACCOUNT);
                if (!serviceAccountJson) {
                    console.warn('Vertex AI Service Account JSON is missing.');
                    return response.status(400).send({ error: true });
                }

                let projectId;
                try {
                    const serviceAccount = JSON.parse(serviceAccountJson);
                    projectId = getProjectIdFromServiceAccount(serviceAccount);
                } catch (error) {
                    console.error('Failed to extract project ID from Service Account JSON:', error);
                    return response.status(400).send({ error: true });
                }
                const region = request.body.vertexai_region || 'us-central1';
                // Handle global region differently - no region prefix in hostname
                if (region === 'global') {
                    url = `https://aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent`;
                } else {
                    url = `https://${region}-aiplatform.googleapis.com/v1/projects/${projectId}/locations/${region}/publishers/google/models/${model}:generateContent`;
                }
                headers['Authorization'] = authHeader;
            } else {
                // Proxy mode: use Authorization header
                const apiUrl = trimTrailingSlash(request.body.reverse_proxy || API_VERTEX_AI);
                url = `${apiUrl}/v1/publishers/google/models/${model}:generateContent`;
                headers['Authorization'] = authHeader;
            }
        } else {
            // Google AI Studio
            const apiKey = request.body.reverse_proxy ? request.body.proxy_password : readSecret(request.user.directories, SECRET_KEYS.MAKERSUITE);
            const apiUrl = trimTrailingSlash(request.body.reverse_proxy || API_MAKERSUITE);
            url = `${apiUrl}/v1beta/models/${model}:generateContent?key=${apiKey}`;
        }
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
