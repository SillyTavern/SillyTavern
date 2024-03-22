const { TEXTGEN_TYPES, OPENROUTER_HEADERS } = require('./constants');
const { SECRET_KEYS, readSecret } = require('./endpoints/secrets');
const { getConfigValue } = require('./util');

function getMancerHeaders() {
    const apiKey = readSecret(SECRET_KEYS.MANCER);

    return apiKey ? ({
        'X-API-KEY': apiKey,
        'Authorization': `Bearer ${apiKey}`,
    }) : {};
}

function getTogetherAIHeaders() {
    const apiKey = readSecret(SECRET_KEYS.TOGETHERAI);

    return apiKey ? ({
        'Authorization': `Bearer ${apiKey}`,
    }) : {};
}

function getInfermaticAIHeaders() {
    const apiKey = readSecret(SECRET_KEYS.INFERMATICAI);

    return apiKey ? ({
        'Authorization': `Bearer ${apiKey}`,
    }) : {};
}

function getDreamGenHeaders() {
    const apiKey = readSecret(SECRET_KEYS.DREAMGEN);

    return apiKey ? ({
        'Authorization': `Bearer ${apiKey}`,
    }) : {};
}

function getOpenRouterHeaders() {
    const apiKey = readSecret(SECRET_KEYS.OPENROUTER);
    const baseHeaders = { ...OPENROUTER_HEADERS };

    return apiKey ? Object.assign(baseHeaders, { 'Authorization': `Bearer ${apiKey}` }) : baseHeaders;
}

function getAphroditeHeaders() {
    const apiKey = readSecret(SECRET_KEYS.APHRODITE);

    return apiKey ? ({
        'X-API-KEY': apiKey,
        'Authorization': `Bearer ${apiKey}`,
    }) : {};
}

function getTabbyHeaders() {
    const apiKey = readSecret(SECRET_KEYS.TABBY);

    return apiKey ? ({
        'x-api-key': apiKey,
        'Authorization': `Bearer ${apiKey}`,
    }) : {};
}

function getOobaHeaders() {
    const apiKey = readSecret(SECRET_KEYS.OOBA);

    return apiKey ? ({
        'Authorization': `Bearer ${apiKey}`,
    }) : {};
}

function getKoboldCppHeaders() {
    const apiKey = readSecret(SECRET_KEYS.KOBOLDCPP);

    return apiKey ? ({
        'Authorization': `Bearer ${apiKey}`,
    }) : {};
}

function getOverrideHeaders(urlHost) {
    const requestOverrides = getConfigValue('requestOverrides', []);
    const overrideHeaders = requestOverrides?.find((e) => e.hosts?.includes(urlHost))?.headers;
    if (overrideHeaders && urlHost) {
        return overrideHeaders;
    } else {
        return {};
    }
}

/**
 * Sets additional headers for the request.
 * @param {object} request Original request body
 * @param {object} args New request arguments
 * @param {string|null} server API server for new request
 */
function setAdditionalHeaders(request, args, server) {
    let headers;

    switch (request.body.api_type) {
        case TEXTGEN_TYPES.MANCER:
            headers = getMancerHeaders();
            break;
        case TEXTGEN_TYPES.APHRODITE:
            headers = getAphroditeHeaders();
            break;
        case TEXTGEN_TYPES.TABBY:
            headers = getTabbyHeaders();
            break;
        case TEXTGEN_TYPES.TOGETHERAI:
            headers = getTogetherAIHeaders();
            break;
        case TEXTGEN_TYPES.OOBA:
            headers = getOobaHeaders();
            break;
        case TEXTGEN_TYPES.INFERMATICAI:
            headers = getInfermaticAIHeaders();
            break;
        case TEXTGEN_TYPES.DREAMGEN:
            headers = getDreamGenHeaders();
            break;
        case TEXTGEN_TYPES.OPENROUTER:
            headers = getOpenRouterHeaders();
            break;
        case TEXTGEN_TYPES.KOBOLDCPP:
            headers = getKoboldCppHeaders();
            break;
        default:
            headers = {};
            break;
    }

    if (typeof server === 'string' && server.length > 0) {
        try {
            const url = new URL(server);
            const overrideHeaders =  getOverrideHeaders(url.host);

            if (overrideHeaders && Object.keys(overrideHeaders).length > 0) {
                Object.assign(headers, overrideHeaders);
            }
        } catch {
            // Do nothing
        }
    }

    Object.assign(args.headers, headers);
}

module.exports = {
    getOverrideHeaders,
    setAdditionalHeaders,
};
