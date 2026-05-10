const MAX_STRING_LENGTH = 256;
const MAX_ARRAY_LENGTH = 32;
const MAX_OBJECT_DEPTH = 4;
const SENSITIVE_KEY_PATTERN = /(?:account|team|payment|invoice|customer|email|api[_-]?key|secret|credential|wallet|balance|credit|subscription|organization|org_id)/i;

const TOTAL_COST_PATHS = [
    'amount',
    'cost',
    'total_cost',
    'totalCost',
    'cost_usd',
    'total_cost_usd',
];

const CACHE_COST_PATHS = [
    'cache_cost',
    'cacheCost',
    'cache_cost_usd',
    'cache_total_cost',
    'cacheTotalCost',
    'total_cache_cost',
    'totalCacheCost',
];

const INPUT_TOKEN_PATHS = [
    'prompt_tokens',
    'input_tokens',
];

const OUTPUT_TOKEN_PATHS = [
    'completion_tokens',
    'output_tokens',
];

const CACHE_READ_TOKEN_PATHS = [
    'readTokens',
    'cache_read_tokens',
    'cache_read_input_tokens',
    'cached_tokens',
    'prompt_tokens_details.cached_tokens',
    'input_tokens_details.cached_tokens',
];

const CACHE_WRITE_TOKEN_PATHS = [
    'writeTokens',
    'cache_write_tokens',
    'cache_write_input_tokens',
    'cache_creation_tokens',
    'cache_creation_input_tokens',
    'prompt_tokens_details.cache_creation_tokens',
    'input_tokens_details.cache_creation_tokens',
];

const PROVIDER_PATHS = [
    'provider',
    'provider_name',
    'providerName',
];

const MODEL_PATHS = [
    'model',
    'model_name',
    'modelName',
];

/**
 * Checks if a value is a plain object.
 * @param {unknown} value Value to test
 * @returns {value is Record<string, any>}
 */
function isPlainObject(value) {
    return Boolean(value) && typeof value === 'object' && !Array.isArray(value);
}

/**
 * Reads a dotted path from an object.
 * @param {Record<string, any>} source Source object
 * @param {string} path Dotted path
 * @returns {unknown}
 */
function readPath(source, path) {
    const parts = path.split('.');
    let value = source;

    for (const part of parts) {
        if (!isPlainObject(value) || !Object.hasOwn(value, part)) {
            return undefined;
        }

        value = value[part];
    }

    return value;
}

/**
 * Reads the first present value from a list of dotted paths.
 * @param {Record<string, any>} source Source object
 * @param {string[]} paths Dotted paths
 * @returns {unknown}
 */
function pickValue(source, paths) {
    if (!isPlainObject(source)) {
        return undefined;
    }

    for (const path of paths) {
        const value = readPath(source, path);
        if (value !== undefined && value !== null && value !== '') {
            return value;
        }
    }

    return undefined;
}

/**
 * Converts a value to a non-negative integer when exact enough to display.
 * @param {unknown} value Value to convert
 * @returns {number|null}
 */
function toTokenCount(value) {
    if (typeof value === 'number' && Number.isSafeInteger(value) && value >= 0) {
        return value;
    }

    if (typeof value === 'string' && /^\d+$/.test(value.trim())) {
        const parsed = Number(value.trim());
        return Number.isSafeInteger(parsed) ? parsed : null;
    }

    return null;
}

/**
 * Converts a value to a non-negative dollar cost.
 * @param {unknown} value Value to convert
 * @returns {number|null}
 */
function toCost(value) {
    if (typeof value !== 'number' && typeof value !== 'string') {
        return null;
    }

    const parsed = Number(String(value).trim());
    return Number.isFinite(parsed) && parsed >= 0 ? parsed : null;
}

/**
 * Checks if a pricing object is denominated in USD when it declares a currency.
 * @param {Record<string, any>} pricing Pricing metadata
 * @returns {boolean}
 */
function isUsdPricing(pricing) {
    const currency = toDisplayString(pricing.currency);
    return !currency || currency.toUpperCase() === 'USD';
}

/**
 * Converts a value to a bounded string.
 * @param {unknown} value Value to convert
 * @returns {string|null}
 */
function toDisplayString(value) {
    if (typeof value !== 'string' && typeof value !== 'number') {
        return null;
    }

    const stringValue = String(value).trim();
    return stringValue ? stringValue.slice(0, MAX_STRING_LENGTH) : null;
}

/**
 * Sanitizes a NanoGPT-returned metadata object for chat storage.
 * @param {unknown} value Value to sanitize
 * @param {number} [depth=0] Recursion depth
 * @returns {unknown}
 */
export function sanitizeNanoGptMetadata(value, depth = 0) {
    if (value === null || typeof value === 'boolean') {
        return value;
    }

    if (typeof value === 'number') {
        return Number.isFinite(value) ? value : undefined;
    }

    if (typeof value === 'string') {
        return value.slice(0, MAX_STRING_LENGTH);
    }

    if (depth >= MAX_OBJECT_DEPTH) {
        return undefined;
    }

    if (Array.isArray(value)) {
        const sanitized = value
            .slice(0, MAX_ARRAY_LENGTH)
            .map(item => sanitizeNanoGptMetadata(item, depth + 1))
            .filter(item => item !== undefined);

        return sanitized;
    }

    if (isPlainObject(value)) {
        const sanitized = {};

        for (const [key, item] of Object.entries(value)) {
            if (SENSITIVE_KEY_PATTERN.test(key)) {
                continue;
            }

            const sanitizedItem = sanitizeNanoGptMetadata(item, depth + 1);
            if (sanitizedItem !== undefined) {
                sanitized[key] = sanitizedItem;
            }
        }

        return sanitized;
    }

    return undefined;
}

/**
 * Extracts provider/model metadata from NanoGPT response data.
 * @param {Record<string, any>} data Response data
 * @param {Record<string, any>} pricing NanoGPT pricing metadata
 * @returns {{provider: string|null, model: string|null}}
 */
function extractProviderModel(data, pricing) {
    const provider = toDisplayString(pickValue(pricing, PROVIDER_PATHS) ?? pickValue(data, PROVIDER_PATHS));
    const model = toDisplayString(pickValue(pricing, MODEL_PATHS) ?? pickValue(data, MODEL_PATHS));

    return { provider, model };
}

/**
 * Builds a sanitized NanoGPT billing request entry from response data.
 * @param {unknown} data Response data
 * @param {string} [type='normal'] Generation type
 * @param {number} [createdAt=Date.now()] Creation timestamp
 * @returns {object|null}
 */
export function createNanoGptBillingEntryFromResponse(data, type = 'normal', createdAt = Date.now()) {
    if (!isPlainObject(data) || !isPlainObject(data.x_nanogpt_pricing) || !isPlainObject(data.usage)) {
        return null;
    }

    const totalCost = toCost(pickValue(data.x_nanogpt_pricing, TOTAL_COST_PATHS));
    const inputTokens = toTokenCount(pickValue(data.usage, INPUT_TOKEN_PATHS));
    const outputTokens = toTokenCount(pickValue(data.usage, OUTPUT_TOKEN_PATHS));

    if (totalCost === null || inputTokens === null || outputTokens === null || !isUsdPricing(data.x_nanogpt_pricing)) {
        return null;
    }

    const { provider, model } = extractProviderModel(data, data.x_nanogpt_pricing);
    const pricing = sanitizeNanoGptMetadata(data.x_nanogpt_pricing);
    const usage = sanitizeNanoGptMetadata(data.usage);
    const cache = isPlainObject(data.x_nanogpt_cache) ? sanitizeNanoGptMetadata(data.x_nanogpt_cache) : undefined;

    if (!isPlainObject(pricing) || !isPlainObject(usage)) {
        return null;
    }

    return sanitizeNanoGptBillingRequest({
        provider,
        model,
        pricing,
        usage,
        ...(isPlainObject(cache) ? { cache } : {}),
        created_at: Number.isFinite(createdAt) ? createdAt : Date.now(),
        type: typeof type === 'string' && type ? type : 'normal',
    });
}

/**
 * Sanitizes a stored NanoGPT billing request entry.
 * @param {unknown} request Request entry
 * @returns {object|null}
 */
export function sanitizeNanoGptBillingRequest(request) {
    if (!isPlainObject(request) || !isPlainObject(request.pricing) || !isPlainObject(request.usage)) {
        return null;
    }

    const totalCost = toCost(pickValue(request.pricing, TOTAL_COST_PATHS));
    const inputTokens = toTokenCount(pickValue(request.usage, INPUT_TOKEN_PATHS));
    const outputTokens = toTokenCount(pickValue(request.usage, OUTPUT_TOKEN_PATHS));

    if (totalCost === null || inputTokens === null || outputTokens === null || !isUsdPricing(request.pricing)) {
        return null;
    }

    const pricing = sanitizeNanoGptMetadata(request.pricing);
    const usage = sanitizeNanoGptMetadata(request.usage);
    const cache = isPlainObject(request.cache) ? sanitizeNanoGptMetadata(request.cache) : undefined;

    if (!isPlainObject(pricing) || !isPlainObject(usage)) {
        return null;
    }

    const createdAt = toTokenCount(request.created_at) ?? Date.now();

    return {
        provider: toDisplayString(request.provider),
        model: toDisplayString(request.model),
        pricing,
        usage,
        ...(isPlainObject(cache) ? { cache } : {}),
        created_at: createdAt,
        type: typeof request.type === 'string' && request.type ? request.type.slice(0, 64) : 'normal',
    };
}

/**
 * Appends or replaces NanoGPT billing metadata.
 * @param {unknown} existing Existing message.extra.nanogpt object
 * @param {unknown} request New request entry
 * @param {object} [options] Options
 * @param {boolean} [options.append=false] Whether to append to existing requests
 * @returns {{requests: object[]}|undefined}
 */
export function mergeNanoGptBillingMetadata(existing, request, { append = false } = {}) {
    const sanitizedRequest = sanitizeNanoGptBillingRequest(request);
    if (!sanitizedRequest) {
        return undefined;
    }

    const existingRequests = append && isPlainObject(existing) && Array.isArray(existing.requests)
        ? existing.requests.map(sanitizeNanoGptBillingRequest).filter(Boolean)
        : [];
    const incomplete = append && isPlainObject(existing) && existing.incomplete === true;

    return {
        requests: [...existingRequests, sanitizedRequest],
        ...(incomplete ? { incomplete } : {}),
    };
}

/**
 * Formats a USD value with the required fixed precision.
 * @param {number} value Dollar value
 * @returns {string}
 */
export function formatNanoGptUsd(value) {
    return `$${Number(value).toFixed(6)}`;
}

/**
 * Gets request metrics from a sanitized billing request.
 * @param {object} request Billing request
 * @returns {object|null}
 */
function getRequestMetrics(request) {
    const totalCost = toCost(pickValue(request.pricing, TOTAL_COST_PATHS));
    const inputTokens = toTokenCount(pickValue(request.usage, INPUT_TOKEN_PATHS));
    const outputTokens = toTokenCount(pickValue(request.usage, OUTPUT_TOKEN_PATHS));

    if (totalCost === null || inputTokens === null || outputTokens === null) {
        return null;
    }

    return {
        totalCost,
        inputTokens,
        outputTokens,
        cacheReadTokens: toTokenCount(pickValue(request.usage, CACHE_READ_TOKEN_PATHS) ?? pickValue(request.cache, CACHE_READ_TOKEN_PATHS)),
        cacheWriteTokens: toTokenCount(pickValue(request.usage, CACHE_WRITE_TOKEN_PATHS) ?? pickValue(request.cache, CACHE_WRITE_TOKEN_PATHS)),
        cacheCost: toCost(pickValue(request.pricing, CACHE_COST_PATHS)),
    };
}

/**
 * Accumulates NanoGPT billing metadata from message extra data.
 * @param {unknown} nanogptMetadata message.extra.nanogpt
 * @returns {object|null}
 */
export function accumulateNanoGptBilling(nanogptMetadata) {
    if (!isPlainObject(nanogptMetadata) || !Array.isArray(nanogptMetadata.requests)) {
        return null;
    }

    if (nanogptMetadata.incomplete === true) {
        return null;
    }

    const requests = nanogptMetadata.requests.map(sanitizeNanoGptBillingRequest).filter(Boolean);
    if (!requests.length) {
        return null;
    }

    const summary = {
        totalCost: 0,
        inputTokens: 0,
        outputTokens: 0,
        cacheReadTokens: 0,
        cacheWriteTokens: 0,
        cacheCost: 0,
        hasCacheCost: false,
        canShowCacheCost: true,
    };

    for (const request of requests) {
        const metrics = getRequestMetrics(request);

        if (!metrics) {
            continue;
        }

        summary.totalCost += metrics.totalCost;
        summary.inputTokens += metrics.inputTokens;
        summary.outputTokens += metrics.outputTokens;

        const cacheReadTokens = metrics.cacheReadTokens ?? 0;
        const cacheWriteTokens = metrics.cacheWriteTokens ?? 0;
        summary.cacheReadTokens += cacheReadTokens;
        summary.cacheWriteTokens += cacheWriteTokens;

        if (metrics.cacheCost !== null) {
            summary.cacheCost += metrics.cacheCost;
            summary.hasCacheCost = true;
        } else if (cacheReadTokens > 0 || cacheWriteTokens > 0) {
            summary.canShowCacheCost = false;
        }
    }

    if (!summary.canShowCacheCost || !summary.hasCacheCost) {
        summary.cacheCost = null;
    }

    return summary;
}

/**
 * Formats NanoGPT billing metadata for display.
 * @param {unknown} nanogptMetadata message.extra.nanogpt
 * @returns {object|null}
 */
export function formatNanoGptBillingDisplay(nanogptMetadata) {
    const summary = accumulateNanoGptBilling(nanogptMetadata);
    if (!summary) {
        return null;
    }

    const hasCacheTokens = summary.cacheReadTokens > 0 || summary.cacheWriteTokens > 0;
    const hasCacheCost = summary.cacheCost !== null && (summary.cacheCost > 0 || hasCacheTokens);
    const totalCost = formatNanoGptUsd(summary.totalCost);
    const cacheCost = hasCacheCost ? formatNanoGptUsd(summary.cacheCost) : null;
    const title = [`in/out: ${summary.inputTokens}t/${summary.outputTokens}t`];

    if (hasCacheTokens) {
        title.push(`cache: ${summary.cacheReadTokens}t/${summary.cacheWriteTokens}t`);
    }

    return {
        totalCost,
        cacheCost,
        title: title.join(' '),
    };
}
