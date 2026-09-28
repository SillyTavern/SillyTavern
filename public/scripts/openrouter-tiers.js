/**
 * Pure helpers for OpenRouter service tier availability.
 *
 * OpenRouter exposes every service tier as its own endpoint, so a tier can only be served when
 * the effective provider pool contains an online endpoint of that tier. Which providers are in
 * that pool depends on the user's provider selection and on whether fallbacks are allowed.
 *
 * This module intentionally has no DOM or settings dependencies so the rules stay testable.
 */

/**
 * Tiers that are always offered in the UI, in display order.
 * @type {string[]}
 */
export const OPENROUTER_SERVICE_TIERS = ['standard', 'flex', 'priority'];

/**
 * @typedef {Object} OpenRouterEndpoint
 * @property {string} provider Provider display name
 * @property {string} tier Service tier the endpoint serves
 * @property {boolean} [online] Whether the endpoint can currently serve requests
 */

/**
 * @typedef {Object} OpenRouterServiceTierState
 * @property {string} tier Tier identifier
 * @property {boolean} available Whether the effective provider pool can serve this tier
 * @property {string[]} providers Effective pool providers that serve this tier
 * @property {string[]} selectedProviders Selected providers that serve this tier
 * @property {boolean} onlyFromFallback Available, but none of the selected providers serves it
 * @property {boolean} partiallySupported Available from some, but not all, selected providers
 */

/**
 * Resolves the endpoints a request may be routed to.
 *
 * With no provider selection every provider is eligible. With a selection, fallbacks widen the
 * pool back to every provider, while disabling them restricts it to the selected providers.
 * @param {OpenRouterEndpoint[]} endpoints Online endpoints
 * @param {string[]} selectedProviders Selected provider names
 * @param {boolean} allowFallbacks Whether fallback providers may serve the request
 * @returns {OpenRouterEndpoint[]} Eligible endpoints
 */
function getEffectiveEndpoints(endpoints, selectedProviders, allowFallbacks) {
    if (selectedProviders.length === 0 || allowFallbacks) {
        return endpoints;
    }

    return endpoints.filter(endpoint => selectedProviders.includes(endpoint.provider));
}

/**
 * Computes the availability of every candidate service tier for the current provider selection.
 *
 * Pass `null`/`undefined` when no endpoint data is known (a model without endpoints, or a failed
 * lookup). Every tier is then reported as available, because availability is simply unknown and
 * the UI must not hide choices it cannot judge.
 * @param {OpenRouterEndpoint[] | null} [endpoints] Endpoints reported for the model
 * @param {Object} [options] Availability options
 * @param {string[]} [options.selectedProviders] Selected provider names
 * @param {boolean} [options.allowFallbacks] Whether fallback providers may serve the request
 * @param {string} [options.selectedTier] Saved tier, always included in the result
 * @returns {OpenRouterServiceTierState[]} Tier states in display order
 */
export function getOpenRouterServiceTierStates(endpoints, { selectedProviders = [], allowFallbacks = true, selectedTier = '' } = {}) {
    const isKnown = Array.isArray(endpoints);
    const knownEndpoints = isKnown ? endpoints : [];
    const onlineEndpoints = knownEndpoints.filter(endpoint => endpoint?.online !== false);
    const effectiveEndpoints = getEffectiveEndpoints(onlineEndpoints, selectedProviders, allowFallbacks);

    const tiers = [...OPENROUTER_SERVICE_TIERS];
    for (const endpoint of knownEndpoints) {
        if (endpoint?.tier && !tiers.includes(endpoint.tier)) {
            tiers.push(endpoint.tier);
        }
    }
    if (selectedTier && !tiers.includes(selectedTier)) {
        tiers.push(selectedTier);
    }

    return tiers.map(tier => {
        const providers = [...new Set(effectiveEndpoints.filter(endpoint => endpoint.tier === tier).map(endpoint => endpoint.provider))];
        const supportedBySelected = selectedProviders.filter(provider => providers.includes(provider));
        const available = !isKnown || providers.length > 0;

        return {
            tier,
            available,
            providers,
            selectedProviders: supportedBySelected,
            onlyFromFallback: isKnown && available && selectedProviders.length > 0 && supportedBySelected.length === 0,
            partiallySupported: isKnown && available && supportedBySelected.length > 0 && supportedBySelected.length < selectedProviders.length,
        };
    });
}
