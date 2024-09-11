// Polyfills for old Safari versions
if (!Object.hasOwn) {
    Object.hasOwn = function (obj, prop) { return obj.hasOwnProperty(prop); }
}

if (!Array.prototype.findLastIndex) {
    Array.prototype.findLastIndex = function (callback, thisArg) {
        for (let i = this.length - 1; i >= 0; i--) {
            if (callback.call(thisArg, this[i], i, this)) return i;
        }
        return -1;
    };
}

if (!Array.prototype.toSorted) {
    Array.prototype.toSorted = function (compareFunction) {
        return this.slice().sort(compareFunction);
    };
}
