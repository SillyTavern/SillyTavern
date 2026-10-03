import express from 'express';
import fetch from 'node-fetch';
import mime from 'mime-types';
import { readSecret, SECRET_KEYS } from './secrets.js';
import { OPENROUTER_HEADERS } from '../constants.js';

export const router = express.Router();
const API_OPENROUTER = 'https://openrouter.ai/api/v1';

/** Quantization suffixes that already have their own OpenRouter picker. */
const QUANTIZATION_SUFFIXES = new Set([
    'int4', 'int8', 'fp4', 'mxfp4', 'nvfp4', 'fp6', 'fp8', 'mxfp8', 'fp16', 'bf16', 'fp32', 'unknown',
]);

/**
 * Turn an endpoint tag into an OpenRouter routing slug.
 * Strips trailing quantization segments; keeps region/tier suffixes.
 * @param {string} tag
 * @param {string} [providerName]
 * @returns {string}
 */
function routingSlugFromTag(tag, providerName = '') {
    if (typeof tag === 'string' && tag.trim()) {
        const parts = tag.trim().split('/').filter(Boolean);
        if (parts.length > 1 && QUANTIZATION_SUFFIXES.has(parts[parts.length - 1].toLowerCase())) {
            parts.pop();
        }
        return parts.join('/');
    }

    return String(providerName || '')
        .trim()
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/^-|-$/g, '');
}

/**
 * @param {string} name
 * @param {string} slug
 * @returns {string}
 */
function labelForProvider(name, slug) {
    const slash = String(slug || '').indexOf('/');
    if (slash === -1) {
        return name || slug;
    }
    return `${name} / ${slug.slice(slash + 1)}`;
}

/**
 * @param {{ slug: string, name: string, label: string }[]} items
 * @returns {{ slug: string, name: string, label: string }[]}
 */
function uniqueSortedProviders(items) {
    const bySlug = new Map();
    for (const item of items) {
        if (!item?.slug || bySlug.has(item.slug)) {
            continue;
        }
        bySlug.set(item.slug, item);
    }
    return [...bySlug.values()].sort((a, b) => {
        const byName = (a.name || '').localeCompare(b.name || '');
        return byName || a.slug.localeCompare(b.slug);
    });
}

router.post('/models/providers', async (req, res) => {
    try {
        const { model } = req.body;
        const response = await fetch(`${API_OPENROUTER}/models/${model}/endpoints`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            return res.json([]);
        }

        /** @type {any} */
        const data = await response.json();
        const endpoints = data?.data?.endpoints || [];
        const providers = uniqueSortedProviders(endpoints.map(endpoint => {
            const name = endpoint.provider_name || '';
            const slug = routingSlugFromTag(endpoint.tag, name);
            return {
                slug,
                name,
                label: labelForProvider(name, slug),
            };
        }));

        return res.json(providers);
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});

router.post('/providers', async (_req, res) => {
    try {
        const response = await fetch(`${API_OPENROUTER}/providers`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            return res.json([]);
        }

        /** @type {any} */
        const data = await response.json();
        const list = Array.isArray(data?.data) ? data.data : [];
        const providers = uniqueSortedProviders(list.map(provider => ({
            slug: provider.slug,
            name: provider.name,
            label: provider.name,
        })));

        return res.json(providers);
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});

/**
 * Fetches and filters models from OpenRouter API based on modality criteria.
 * @param {string} endpoint - The API endpoint to fetch from
 * @param {string} inputModality - Required input modality
 * @param {string} outputModality - Required output modality
 * @param {((model: any) => any) | null} [mapFn=null] - Optional mapping function to transform the results
 * @returns {Promise<any[]>} Filtered and/or mapped models
 */
async function fetchModelsByModality(endpoint, inputModality, outputModality, mapFn = null) {
    const response = await fetch(`${API_OPENROUTER}${endpoint}?output_modalities=${encodeURIComponent(outputModality)}`, {
        method: 'GET',
        headers: { 'Accept': 'application/json' },
    });

    if (!response.ok) {
        console.warn('OpenRouter API request failed', response.statusText);
        return [];
    }

    /** @type {any} */
    const data = await response.json();

    if (!Array.isArray(data?.data)) {
        console.warn('OpenRouter API response was not an array');
        return [];
    }

    const filtered = data.data
        .filter(m => Array.isArray(m?.architecture?.input_modalities))
        .filter(m => m.architecture.input_modalities.includes(inputModality))
        .filter(m => Array.isArray(m?.architecture?.output_modalities))
        .filter(m => m.architecture.output_modalities.includes(outputModality))
        .sort((a, b) => a?.id && b?.id ? a.id.localeCompare(b.id) : 0);

    return typeof mapFn === 'function' ? filtered.map(mapFn) : filtered;
}

router.post('/models/multimodal', async (_req, res) => {
    try {
        const models = await fetchModelsByModality('/models', 'image', 'text', m => m.id);
        return res.json(models);
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});

router.post('/models/embedding', async (_req, res) => {
    try {
        const models = await fetchModelsByModality('/models', 'text', 'embeddings', m => ({ id: m.id, name: m.name }));
        return res.json(models);
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});

router.post('/models/image', async (_req, res) => {
    try {
        const models = await fetchModelsByModality('/models', 'text', 'image', m => ({ value: m.id, text: m.name || m.id }));
        return res.json(models);
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});

router.post('/credits', async (req, res) => {
    try {
        const key = readSecret(req.user.directories, SECRET_KEYS.OPENROUTER);

        if (!key) {
            console.warn('OpenRouter API key not found');
            return res.sendStatus(400);
        }

        const response = await fetch(`${API_OPENROUTER}/credits`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
                'Authorization': `Bearer ${key}`,
            },
        });

        if (!response.ok) {
            console.warn('OpenRouter credits request failed', response.statusText);
            return res.sendStatus(500);
        }

        /** @type {any} */
        const data = await response.json();
        const totalCredits = data.data?.total_credits ?? 0;
        const totalUsage = data.data?.total_usage ?? 0;
        const remaining = totalCredits - totalUsage;

        return res.json({ remaining, total_credits: totalCredits, total_usage: totalUsage });
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});

router.post('/image/generate', async (req, res) => {
    try {
        const key = readSecret(req.user.directories, SECRET_KEYS.OPENROUTER);

        if (!key) {
            console.warn('OpenRouter API key not found');
            return res.status(400).json({ error: 'OpenRouter API key not found' });
        }

        console.debug('OpenRouter image generation request', req.body);

        const { model, prompt } = req.body;

        if (!model || !prompt) {
            return res.status(400).json({ error: 'Model and prompt are required' });
        }

        const response = await fetch(`${API_OPENROUTER}/chat/completions`, {
            method: 'POST',
            headers: {
                ...OPENROUTER_HEADERS,
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${key}`,
            },
            body: JSON.stringify({
                model: model,
                messages: [
                    {
                        role: 'user',
                        content: prompt,
                    },
                ],
                modalities: ['image'],
                image_config: {
                    aspect_ratio: req.body.aspect_ratio || '1:1',
                },
            }),
        });

        if (!response.ok) {
            console.warn('OpenRouter image generation failed', await response.text());
            return res.sendStatus(500);
        }

        /** @type {any} */
        const data = await response.json();

        const imageUrl = data?.choices?.[0]?.message?.images?.[0]?.image_url?.url;

        if (!imageUrl) {
            console.warn('No image URL found in OpenRouter response', data);
            return res.sendStatus(500);
        }

        const [mimeType, base64Data] = /^data:(.*);base64,(.*)$/.exec(imageUrl)?.slice(1) || [];

        if (!mimeType || !base64Data) {
            console.warn('Invalid image data format', imageUrl);
            return res.sendStatus(500);
        }

        const result = {
            format: mime.extension(mimeType) || 'png',
            image: base64Data,
        };

        return res.json(result);
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});
