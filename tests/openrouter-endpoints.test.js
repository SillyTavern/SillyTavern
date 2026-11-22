import { beforeAll, describe, expect, jest, test } from '@jest/globals';

// Importing the endpoint module pulls in the secret storage, which needs the server config.
jest.unstable_mockModule('../src/endpoints/secrets.js', () => ({
    readSecret: jest.fn(),
    SECRET_KEYS: { OPENROUTER: 'api_key_openrouter' },
}));

let buildOpenRouterProviderPayload;
let getOpenRouterEndpointTier;

beforeAll(async () => {
    ({ buildOpenRouterProviderPayload, getOpenRouterEndpointTier } = await import('../src/endpoints/openrouter.js'));
});

describe('OpenRouter service tier mapping', () => {
    test('maps endpoint tags to service tiers', () => {
        expect(getOpenRouterEndpointTier('openai')).toBe('standard');
        expect(getOpenRouterEndpointTier('google-vertex/global/flex')).toBe('flex');
        expect(getOpenRouterEndpointTier('openai/priority')).toBe('priority');
        // `fast` is OpenRouter's alias for the priority tier.
        expect(getOpenRouterEndpointTier('fireworks/fast')).toBe('priority');
        expect(getOpenRouterEndpointTier(undefined)).toBe('standard');
    });

    // Tags as returned by the live endpoints API, including the quantisation, region and zero data
    // retention suffixes that must not be mistaken for a tier.
    test.each([
        ['openai', 'standard'],
        ['openai/flex', 'flex'],
        ['openai/fast', 'priority'],
        ['anthropic', 'standard'],
        ['anthropic/fast', 'priority'],
        ['openai/priority', 'priority'],
        ['google-ai-studio/flex', 'flex'],
        ['google-ai-studio/priority', 'priority'],
        ['google-vertex/global', 'standard'],
        ['google-vertex/global/flex', 'flex'],
        ['google-vertex/global/priority', 'priority'],
        ['xai/priority', 'priority'],
        ['xai/zdr/priority', 'priority'],
        ['xai/zdr', 'standard'],
        ['mistral/zdr', 'standard'],
        ['azure/global', 'standard'],
        ['amazon-bedrock/us-west-2', 'standard'],
        ['claude-on-aws', 'standard'],
        ['deepinfra/bf16', 'standard'],
        ['novita/nvfp4', 'standard'],
    ])('maps the tag %s to the %s tier', (tag, tier) => {
        expect(getOpenRouterEndpointTier(tag)).toBe(tier);
    });

    test('reports every provider, whether or not it is online', () => {
        const payload = buildOpenRouterProviderPayload([
            { provider_name: 'Google', tag: 'google-vertex/global', status: 0 },
            { provider_name: 'Together', tag: 'together', status: -1 },
        ]);

        expect(payload.providers).toEqual(['Google', 'Together']);
    });

    test('carries the tier and availability of every endpoint', () => {
        const payload = buildOpenRouterProviderPayload([
            { provider_name: 'Google', tag: 'google-vertex/global', status: 0 },
            { provider_name: 'Google', tag: 'google-vertex/global/flex', status: 0 },
            { provider_name: 'Together', tag: 'together/fast', status: -2 },
        ]);

        expect(payload.endpoints).toEqual([
            { provider: 'Google', tier: 'standard', online: true },
            { provider: 'Google', tier: 'flex', online: true },
            { provider: 'Together', tier: 'priority', online: false },
        ]);
    });

    test('returns an empty payload for a model without endpoints', () => {
        expect(buildOpenRouterProviderPayload([])).toEqual({ providers: [], endpoints: [] });
    });
});
