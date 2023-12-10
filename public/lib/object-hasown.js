// Polyfill for old Safari versions
if (!Object.hasOwn) {
    Object.hasOwn = function (obj, prop) { return obj.hasOwnProperty(prop); }
}
