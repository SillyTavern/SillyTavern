import { describe, expect, test } from '@jest/globals';
import {
    createNanoGptBillingEntryFromResponse,
    formatNanoGptBillingDisplay,
    mergeNanoGptBillingMetadata,
} from '../public/scripts/nanogpt-billing.js';

function makeResponse({
    provider = 'Auto',
    model = 'moonshotai/kimi-k2.6',
    cost = 0.000001,
    promptTokens = 1234,
    completionTokens = 567,
    pricing = {},
    usage = {},
    cache = null,
} = {}) {
    const response = {
        model,
        x_nanogpt_pricing: {
            provider,
            model,
            cost,
            account_id: 'acct-secret',
            payment_id: 'pay-secret',
            ...pricing,
        },
        usage: {
            prompt_tokens: promptTokens,
            completion_tokens: completionTokens,
            team_id: 'team-secret',
            ...usage,
        },
    };

    if (cache) {
        response.x_nanogpt_cache = cache;
    }

    return response;
}

describe('NanoGPT billing metadata', () => {
    test('captures exact non-stream metadata and sanitizes identifiers', () => {
        const entry = createNanoGptBillingEntryFromResponse(makeResponse(), 'normal', 1760000000000);

        expect(entry).toMatchObject({
            provider: 'Auto',
            model: 'moonshotai/kimi-k2.6',
            created_at: 1760000000000,
            type: 'normal',
        });
        expect(entry.pricing.account_id).toBeUndefined();
        expect(entry.pricing.payment_id).toBeUndefined();
        expect(entry.usage.team_id).toBeUndefined();

        const display = formatNanoGptBillingDisplay({ requests: [entry] });
        expect(display).toEqual({
            totalCost: '$0.000001',
            cacheCost: null,
            title: 'in/out: 1234t/567t',
        });
    });

    test('captures final stream chunk metadata and ignores partial chunks', () => {
        expect(createNanoGptBillingEntryFromResponse({ choices: [{ delta: { content: 'hi' } }] }, 'normal')).toBeNull();

        const finalChunk = {
            choices: [],
            ...makeResponse({ cost: 0.000002, promptTokens: 10, completionTokens: 5 }),
        };
        const entry = createNanoGptBillingEntryFromResponse(finalChunk, 'normal', 1760000000001);

        expect(formatNanoGptBillingDisplay({ requests: [entry] }).totalCost).toBe('$0.000002');
    });

    test('formats cache cost and moves token details to title', () => {
        const entry = createNanoGptBillingEntryFromResponse(makeResponse({
            cost: 0.000003,
            pricing: {
                cache_cost: 0.000002,
                cache_ttl_seconds: 300,
            },
            usage: {
                cache_read_tokens: 1000,
                cache_write_tokens: 500,
            },
        }));

        const display = formatNanoGptBillingDisplay({ requests: [entry] });
        expect(display).toEqual({
            totalCost: '$0.000003',
            cacheCost: '$0.000002',
            title: 'in/out: 1234t/567t cache: 1000t/500t',
        });
    });

    test('captures NanoGPT amount pricing and cache metadata response shape', () => {
        const entry = createNanoGptBillingEntryFromResponse({
            id: 'msg_014QWSN7eHqs56h7QmP9ukjE',
            object: 'chat.completion',
            model: 'anthropic/claude-opus-4.6:thinking:medium',
            choices: [],
            usage: {
                prompt_tokens: 113,
                completion_tokens: 51,
                total_tokens: 164,
                cache_creation_input_tokens: 100,
                cache_read_input_tokens: 20,
                input_tokens: 113,
            },
            x_nanogpt_pricing: {
                amount: 0.001840131,
                currency: 'USD',
            },
            x_nanogpt_cache: {
                requested: true,
                enabledForDispatch: true,
                supported: true,
                status: 'requested_unknown',
                ttl: '5m',
                readTokens: 20,
                writeTokens: 100,
            },
        });

        expect(entry.pricing.amount).toBe(0.001840131);
        expect(entry.cache.ttl).toBe('5m');

        const display = formatNanoGptBillingDisplay({ requests: [entry] });
        expect(display.title).toBe('in/out: 113t/51t cache: 20t/100t');
    });

    test('omits missing and all-zero cache fields', () => {
        const noCache = createNanoGptBillingEntryFromResponse(makeResponse({
            pricing: { cache_cost: 0 },
            usage: { cache_read_tokens: 0, cache_write_tokens: 0 },
            cache: { ttl: '5m' },
        }));
        expect(formatNanoGptBillingDisplay({ requests: [noCache] }).cacheCost).toBeNull();

        const zeroCacheCost = createNanoGptBillingEntryFromResponse(makeResponse({
            pricing: { cache_cost: 0 },
            usage: { cache_read_tokens: 1000, cache_write_tokens: 500 },
        }));
        expect(formatNanoGptBillingDisplay({ requests: [zeroCacheCost] }).cacheCost).toBe('$0.000000');

        const missingCacheCost = createNanoGptBillingEntryFromResponse(makeResponse({
            usage: { cache_read_tokens: 1000, cache_write_tokens: 500 },
        }));
        const display = formatNanoGptBillingDisplay({ requests: [missingCacheCost] });

        expect(display.cacheCost).toBeNull();
        expect(display.title).toContain('cache: 1000t/500t');
    });

    test('returns no display for missing billing metadata', () => {
        expect(createNanoGptBillingEntryFromResponse({ usage: { prompt_tokens: 1, completion_tokens: 1 } })).toBeNull();
        expect(createNanoGptBillingEntryFromResponse({ x_nanogpt_pricing: { cost: 1 } })).toBeNull();
        expect(createNanoGptBillingEntryFromResponse(makeResponse({ pricing: { currency: 'EUR' } }))).toBeNull();
        expect(formatNanoGptBillingDisplay({ requests: [] })).toBeNull();
    });

    test('incomplete accumulated metadata preserves requests but shows nothing', () => {
        const first = createNanoGptBillingEntryFromResponse(makeResponse());
        const metadata = mergeNanoGptBillingMetadata(undefined, first);
        metadata.incomplete = true;

        expect(metadata.requests).toHaveLength(1);
        expect(formatNanoGptBillingDisplay(metadata)).toBeNull();
    });

    test('append/continue accumulates totals and token details', () => {
        const first = createNanoGptBillingEntryFromResponse(makeResponse({
            cost: 0.000001,
            promptTokens: 100,
            completionTokens: 20,
            pricing: { cache_ttl_seconds: 300 },
            usage: { cache_read_tokens: 1, cache_write_tokens: 2 },
        }), 'normal');
        const second = createNanoGptBillingEntryFromResponse(makeResponse({
            provider: 'Other',
            model: 'other/model',
            cost: 0.000002,
            promptTokens: 50,
            completionTokens: 30,
            pricing: { cache_ttl_seconds: 600 },
            usage: { cache_read_tokens: 3, cache_write_tokens: 4 },
        }), 'continue');

        let metadata = mergeNanoGptBillingMetadata(undefined, first);
        metadata = mergeNanoGptBillingMetadata(metadata, second, { append: true });

        const display = formatNanoGptBillingDisplay(metadata);
        expect(display.totalCost).toBe('$0.000003');
        expect(display.title).toBe('in/out: 150t/50t cache: 4t/6t');
    });

    test('selected swipe extra controls the displayed billing metadata', () => {
        const first = mergeNanoGptBillingMetadata(undefined, createNanoGptBillingEntryFromResponse(makeResponse({
            model: 'first/model',
            cost: 0.000001,
        })));
        const second = mergeNanoGptBillingMetadata(undefined, createNanoGptBillingEntryFromResponse(makeResponse({
            model: 'second/model',
            cost: 0.000002,
        })));
        const message = {
            swipe_id: 1,
            swipe_info: [
                { extra: { nanogpt: first } },
                { extra: { nanogpt: second } },
            ],
            extra: structuredClone(second),
        };

        message.extra = structuredClone(message.swipe_info[message.swipe_id].extra);

        const display = formatNanoGptBillingDisplay(message.extra.nanogpt);
        expect(display.totalCost).toBe('$0.000002');
    });
});
