// https://github.com/transformation-dev/blueprint/blob/master/packages/cloudflare-do-utils/src/apply-delta.js
// Originally written by Larry Maccherone.

/* eslint-disable no-param-reassign */
function innerApplyDelta(obj, delta) {
    const keys = Object.keys(delta);
    for (let i = keys.length - 1; i >= 0; i--) {
        const key = keys[i];

        //Prevent Prototype pollution. https://developer.mozilla.org/en-US/docs/Web/Security/Attacks/Prototype_pollution
        if (key === 'prototype' || key === '__proto__' || key === 'constructor') continue;

        if (Array.isArray(delta[key]) || delta[key] instanceof Set || delta[key] instanceof Map) {
            obj[key] = delta[key];
        } else if (delta[key] === undefined) {
            if (Array.isArray(obj)) {
                obj.splice(Number(key), 1);
            } else {
                delete obj[key];
            }
        } else if (typeof(delta[key]) === 'object' && delta[key] !== null) {
            obj[key] = innerApplyDelta(obj[key] ?? {}, delta[key]);
        } else {
            obj[key] = delta[key];
        }
    }
    return obj;
}

/**
 * This function is only intended for use in ChatHistory until it gets fixed upstream.
 * applyDelta has known issues, Don't use it.
 * https://github.com/SillyTavern/SillyTavern/pull/4819#discussion_r2595634539
 */
export function applyDelta(obj, delta) {
    return innerApplyDelta(obj, delta);
}
