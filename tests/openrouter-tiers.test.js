import { describe, expect, test } from '@jest/globals';
import { getOpenRouterServiceTierStates, OPENROUTER_SERVICE_TIERS } from '../public/scripts/openrouter-tiers.js';

/**
 * @param {string} provider Provider name
 * @param {string} tier Service tier
 * @param {boolean} [online] Whether the endpoint is available
 */
function endpoint(provider, tier, online = true) {
    return { provider, tier, online };
}

/**
 * @param {{tier: string}[]} states Tier states
 * @param {string} tier Tier to look up
 */
function stateOf(states, tier) {
    const state = states.find(candidate => candidate.tier === tier);
    if (!state) {
        throw new Error(`No state for tier ${tier}`);
    }
    return state;
}

describe('OpenRouter service tier availability', () => {
    test('offers every tier while endpoint data is unknown', () => {
        const states = getOpenRouterServiceTierStates(null, {
            selectedProviders: ['Google'],
            allowFallbacks: false,
        });

        expect(states.map(state => state.tier)).toEqual(OPENROUTER_SERVICE_TIERS);
        for (const state of states) {
            expect(state.available).toBe(true);
            expect(state.onlyFromFallback).toBe(false);
            expect(state.partiallySupported).toBe(false);
        }
    });

    test('reflects the model tiers when no provider is selected', () => {
        const states = getOpenRouterServiceTierStates([
            endpoint('Google', 'standard'),
            endpoint('Together', 'flex'),
            endpoint('Google', 'priority'),
        ]);

        expect(stateOf(states, 'flex').available).toBe(true);
        expect(stateOf(states, 'flex').providers).toEqual(['Together']);
        expect(stateOf(states, 'flex').onlyFromFallback).toBe(false);
        expect(stateOf(states, 'flex').partiallySupported).toBe(false);
    });

    test('hides a tier the selected providers cannot serve without fallbacks', () => {
        const states = getOpenRouterServiceTierStates([
            endpoint('Google', 'standard'),
            endpoint('Together', 'flex'),
        ], {
            selectedProviders: ['Google'],
            allowFallbacks: false,
        });

        expect(stateOf(states, 'standard').available).toBe(true);
        expect(stateOf(states, 'flex').available).toBe(false);
        expect(stateOf(states, 'flex').onlyFromFallback).toBe(false);
    });

    test('marks a tier as fallback-only when fallbacks are allowed', () => {
        const states = getOpenRouterServiceTierStates([
            endpoint('Google', 'standard'),
            endpoint('Together', 'flex'),
        ], {
            selectedProviders: ['Google'],
            allowFallbacks: true,
        });

        expect(stateOf(states, 'flex').available).toBe(true);
        expect(stateOf(states, 'flex').onlyFromFallback).toBe(true);
        expect(stateOf(states, 'flex').partiallySupported).toBe(false);
        expect(stateOf(states, 'flex').providers).toEqual(['Together']);
    });

    test('reports which selected provider serves a partially covered tier', () => {
        const states = getOpenRouterServiceTierStates([
            endpoint('Google', 'standard'),
            endpoint('Google', 'flex'),
            endpoint('Together', 'standard'),
        ], {
            selectedProviders: ['Google', 'Together'],
            allowFallbacks: false,
        });

        const flex = stateOf(states, 'flex');
        expect(flex.available).toBe(true);
        expect(flex.partiallySupported).toBe(true);
        expect(flex.selectedProviders).toEqual(['Google']);
        expect(flex.onlyFromFallback).toBe(false);
    });

    test('treats a fully covered tier as fully supported', () => {
        const states = getOpenRouterServiceTierStates([
            endpoint('Google', 'flex'),
            endpoint('Together', 'flex'),
        ], {
            selectedProviders: ['Google', 'Together'],
            allowFallbacks: false,
        });

        const flex = stateOf(states, 'flex');
        expect(flex.available).toBe(true);
        expect(flex.partiallySupported).toBe(false);
        expect(flex.selectedProviders).toEqual(['Google', 'Together']);
    });

    test('ignores endpoints that are offline', () => {
        const states = getOpenRouterServiceTierStates([
            endpoint('Google', 'flex', false),
            endpoint('Together', 'standard'),
        ], {
            selectedProviders: ['Google'],
            allowFallbacks: false,
        });

        expect(stateOf(states, 'flex').available).toBe(false);
    });

    test('keeps a saved tier selectable even when the model never reports it', () => {
        const states = getOpenRouterServiceTierStates([], { selectedTier: 'batch' });

        const batch = stateOf(states, 'batch');
        expect(batch.available).toBe(false);
        expect(states.map(state => state.tier)).toEqual([...OPENROUTER_SERVICE_TIERS, 'batch']);
    });

    test('surfaces tiers the UI does not know about yet', () => {
        const states = getOpenRouterServiceTierStates([endpoint('Google', 'scale')]);

        expect(stateOf(states, 'scale').available).toBe(true);
        expect(stateOf(states, 'scale').providers).toEqual(['Google']);
    });
});
