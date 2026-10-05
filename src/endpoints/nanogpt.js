import express from 'express';
import fetch from 'node-fetch';
import { readSecret, SECRET_KEYS } from './secrets.js';

export const router = express.Router();
const API_NANOGPT = 'https://nano-gpt.com/api';

/**
 * Parses a numeric API value, returning 0 for missing or invalid values.
 * @param {unknown} value Value to parse.
 * @returns {number}
 */
function parseNumber(value) {
    const number = Number(value);
    return Number.isFinite(number) ? number : 0;
}

/**
 * Normalizes a NanoGPT usage bucket.
 * @param {any} usage Usage bucket from NanoGPT.
 * @returns {{ used: number, remaining: number, percentUsed: number, resetAt: number } | null}
 */
function normalizeUsage(usage) {
    if (!usage || typeof usage !== 'object') {
        return null;
    }

    return {
        used: parseNumber(usage.used),
        remaining: parseNumber(usage.remaining),
        percentUsed: parseNumber(usage.percentUsed),
        resetAt: parseNumber(usage.resetAt),
    };
}

router.post('/credits', async (req, res) => {
    try {
        const key = readSecret(req.user.directories, SECRET_KEYS.NANOGPT);

        if (!key) {
            console.warn('NanoGPT API key not found');
            return res.sendStatus(400);
        }

        const headers = {
            'Accept': 'application/json',
            'x-api-key': key,
        };

        // Fetch both Pay-As-You-Go balance and subscription usage at the same time.
        const [balanceReq, subReq] = await Promise.allSettled([
            fetch(`${API_NANOGPT}/check-balance`, { method: 'POST', headers }),
            fetch(`${API_NANOGPT}/subscription/v1/usage`, { method: 'GET', headers }),
        ]);

        if (balanceReq.status !== 'fulfilled' || !balanceReq.value.ok) {
            console.warn('NanoGPT balance request failed', balanceReq.status === 'fulfilled' ? balanceReq.value.statusText : balanceReq.reason);
            return res.sendStatus(500);
        }

        /** @type {any} */
        const balanceData = await balanceReq.value.json();
        /** @type {any} */
        const result = {
            usd_balance: parseNumber(balanceData.usd_balance),
            nano_balance: parseNumber(balanceData.nano_balance),
            subscription: null,
        };

        if (subReq.status === 'fulfilled' && subReq.value.ok) {
            /** @type {any} */
            const subData = await subReq.value.json();
            if (subData.active) {
                result.subscription = {
                    active: true,
                    state: String(subData.state || ''),
                    allowOverage: Boolean(subData.allowOverage),
                    period: {
                        currentPeriodEnd: String(subData.period?.currentPeriodEnd || ''),
                    },
                    limits: {
                        weeklyInputTokens: parseNumber(subData.limits?.weeklyInputTokens),
                        dailyInputTokens: parseNumber(subData.limits?.dailyInputTokens),
                        dailyImages: parseNumber(subData.limits?.dailyImages),
                    },
                    weekly_tokens: normalizeUsage(subData.weeklyInputTokens),
                    daily_tokens: normalizeUsage(subData.dailyInputTokens),
                    daily_images: normalizeUsage(subData.dailyImages),
                };
            }
        } else if (subReq.status === 'fulfilled') {
            console.warn('NanoGPT subscription usage request failed', subReq.value.statusText);
        } else {
            console.warn('NanoGPT subscription usage request failed', subReq.reason);
        }

        return res.json(result);
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});

router.post('/models/providers', async (req, res) => {
    try {
        const { model } = req.body;

        if (!model) {
            return res.status(400).json({ supportsProviderSelection: false, providers: [] });
        }

        const encodedModel = encodeURIComponent(model);
        const response = await fetch(`${API_NANOGPT}/models/${encodedModel}/providers`, {
            method: 'GET',
            headers: {
                'Accept': 'application/json',
            },
        });

        if (!response.ok) {
            return res.json({ supportsProviderSelection: false, providers: [] });
        }

        /** @type {any} */
        const data = await response.json();
        const providers = Array.isArray(data?.providers)
            ? data.providers.filter(p => p?.available !== false).map(p => p.provider).filter(Boolean)
            : [];

        return res.json({
            supportsProviderSelection: Boolean(data?.supportsProviderSelection),
            providers,
        });
    } catch (error) {
        console.error(error);
        return res.sendStatus(500);
    }
});
