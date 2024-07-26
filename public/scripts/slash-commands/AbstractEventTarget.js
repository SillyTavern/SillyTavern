/**
 * @abstract
 * @implements {EventTarget}
 */
export class AbstractEventTarget {
    constructor() {
        this.listeners = {};
    }

    addEventListener(type, callback, _options) {
        if (!this.listeners[type]) {
            this.listeners[type] = [];
        }
        this.listeners[type].push(callback);
    }

    dispatchEvent(event) {
        if (!this.listeners[event.type] || this.listeners[event.type].length === 0) {
            return true;
        }
        this.listeners[event.type].forEach(listener => {
            listener(event);
        });
        return true;
    }

    removeEventListener(type, callback, _options) {
        if (!this.listeners[type]) {
            return;
        }
        const index = this.listeners[type].indexOf(callback);
        if (index !== -1) {
            this.listeners[type].splice(index, 1);
        }
    }
}
