// https://github.com/transformation-dev/blueprint/blob/master/packages/cloudflare-do-utils/src/apply-delta.js

/* eslint-disable no-param-reassign */
function innerApplyDelta(obj, delta) {
    const keys = Object.keys(delta);
    for (let i = keys.length - 1; i >= 0; i--) {
        const key = keys[i];
        if (Array.isArray(delta[key]) || delta[key] instanceof Set || delta[key] instanceof Map) {
            obj[key] = delta[key];
        } else if (delta[key] instanceof Object) {
            obj[key] = innerApplyDelta(obj[key] ?? {}, delta[key]);
        } else if (delta[key] === undefined) {
            if (Array.isArray(obj)) {
                obj.splice(Number(key), 1);
            } else {
                delete obj[key];
            }
        } else {
            obj[key] = delta[key];
        }
    }
    return obj;
}

export function applyDelta(obj, delta) {
    Object.freeze(obj.prototype); // This doesn't seem to hurt, but I'm not sure if it prevents prototype pollution
    return innerApplyDelta(obj, delta);
}
