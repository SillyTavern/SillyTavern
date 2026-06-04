/**
 * Dynamic Lorebook Manager — LLM API Client
 *
 * Sends analysis requests to the currently configured SillyTavern backend.
 * Supports chat-completion APIs (OpenAI-family) and text-completion APIs
 * (KoboldAI / TextGen WebUI).
 */

import { getRequestHeaders, main_api } from '../../../../script.js';
import { oai_settings } from '../../../openai.js';

// Sources that accept response_format: {type: 'json_object'}
const JSON_MODE_SOURCES = new Set(['openai', 'azure_openai', 'custom', 'groq', 'mistralai', 'deepseek']);

const RETRY_DELAYS_MS = [1000, 2000, 4000];

/**
 * Sends an analysis request to the active (or overridden) LLM backend.
 * Retries up to 3 times with exponential backoff on failure.
 *
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {object|null} [profile] - Optional connection profile to use instead of the current chat API
 * @returns {Promise<string>} Raw text response from the LLM
 */
export async function sendAnalysisRequest(systemPrompt, userPrompt, profile = null) {
    let lastError;

    for (let attempt = 0; attempt <= RETRY_DELAYS_MS.length; attempt++) {
        try {
            return await dispatchRequest(systemPrompt, userPrompt, profile);
        } catch (err) {
            lastError = err;
            if (attempt < RETRY_DELAYS_MS.length) {
                console.warn(`[DLM] Analysis request failed (attempt ${attempt + 1}), retrying in ${RETRY_DELAYS_MS[attempt]}ms…`, err.message);
                await sleep(RETRY_DELAYS_MS[attempt]);
            }
        }
    }

    throw lastError;
}

/**
 * Routes the request to the appropriate backend handler.
 * If a connection profile is provided its mode field determines CC vs TC routing,
 * overriding the global main_api setting.
 *
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {object|null} profile
 * @returns {Promise<string>}
 */
async function dispatchRequest(systemPrompt, userPrompt, profile) {
    if (profile) {
        if (profile.mode === 'cc') {
            return sendChatCompletion(systemPrompt, userPrompt, profile);
        }
        if (profile.mode === 'tc') {
            const apiType = profile.api ?? 'textgenerationwebui';
            return sendTextCompletion(systemPrompt, userPrompt, apiType, profile);
        }
    }

    // Fall back to the currently active chat API
    const api = main_api;

    if (api === 'openai') {
        return sendChatCompletion(systemPrompt, userPrompt, null);
    }

    if (api === 'textgenerationwebui' || api === 'kobold' || api === 'koboldhorde') {
        return sendTextCompletion(systemPrompt, userPrompt, api, null);
    }

    throw new Error(`[DLM] Unsupported API type for analysis: "${api}". Use an OpenAI-compatible or text-completion backend.`);
}

/**
 * Sends a chat-completion request (OpenAI, Claude, etc.).
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {object|null} profile - Connection profile override (uses profile.api as source, profile.model if set)
 * @returns {Promise<string>}
 */
async function sendChatCompletion(systemPrompt, userPrompt, profile) {
    const source = profile?.api ?? oai_settings.chat_completion_source;

    const payload = {
        chat_completion_source: source,
        messages: [
            { role: 'system', content: systemPrompt },
            { role: 'user', content: userPrompt },
        ],
        max_tokens: 1500,
        temperature: 0.2,
        stream: false,
    };

    if (profile?.model) {
        payload.model = profile.model;
    }

    if (JSON_MODE_SOURCES.has(source)) {
        payload.response_format = { type: 'json_object' };
    }

    const response = await fetch('/api/backends/chat-completions/generate', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`[DLM] Chat completion failed (HTTP ${response.status}): ${text.slice(0, 300)}`);
    }

    const data = await response.json();

    // Normalise across provider response shapes
    const content = data?.choices?.[0]?.message?.content
        ?? data?.choices?.[0]?.text
        ?? data?.content?.[0]?.text
        ?? data?.completion
        ?? '';

    if (typeof content !== 'string' || content.trim() === '') {
        throw new Error('[DLM] Empty response from chat-completion API');
    }

    return content;
}

/**
 * Sends a text-completion request (KoboldAI / TextGen WebUI).
 * @param {string} systemPrompt
 * @param {string} userPrompt
 * @param {string} apiType
 * @param {object|null} profile - Connection profile override (uses profile.model if set)
 * @returns {Promise<string>}
 */
async function sendTextCompletion(systemPrompt, userPrompt, apiType, profile) {
    // Format as a single prompt block
    const prompt = [
        systemPrompt,
        '',
        userPrompt,
        '',
        'Response (JSON only):',
    ].join('\n');

    const payload = {
        prompt,
        max_tokens: 1500,
        temperature: 0.2,
        stream: false,
        api_type: apiType,
    };

    if (profile?.model) {
        payload.model = profile.model;
    }

    const response = await fetch('/api/backends/text-completions/generate', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(payload),
    });

    if (!response.ok) {
        const text = await response.text();
        throw new Error(`[DLM] Text completion failed (HTTP ${response.status}): ${text.slice(0, 300)}`);
    }

    const data = await response.json();
    const text = data?.results?.[0]?.text ?? data?.text ?? '';

    if (typeof text !== 'string' || text.trim() === '') {
        throw new Error('[DLM] Empty response from text-completion API');
    }

    return text;
}

/**
 * @param {number} ms
 * @returns {Promise<void>}
 */
function sleep(ms) {
    return new Promise(resolve => setTimeout(resolve, ms));
}
