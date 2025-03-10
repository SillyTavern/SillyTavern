/* Polyfill indexOf. */
var indexOf;

if (typeof Array.prototype.indexOf === 'function') {
    indexOf = function (haystack, needle) {
        return haystack.indexOf(needle);
    };
} else {
    indexOf = function (haystack, needle) {
        var i = 0, length = haystack.length, idx = -1, found = false;

        while (i < length && !found) {
            if (haystack[i] === needle) {
                idx = i;
                found = true;
            }

            i++;
        }

        return idx;
    };
};


/* Polyfill EventEmitter. */
/**
 * Creates an event emitter.
 * @param {string[]} autoFireAfterEmit Auto-fire event names
 */
var EventEmitter = function (autoFireAfterEmit = []) {
    this.events = {};
    this.autoFireLastArgs = new Map();
    this.autoFireAfterEmit = new Set(autoFireAfterEmit);
};

/**
 * Adds a listener to an event.
 * @param {string} event Event name
 * @param {function} listener Event listener
 * @returns
 */
EventEmitter.prototype.on = function (event, listener) {
    // Unknown event used by external libraries?
    if (event === undefined) {
        console.trace('EventEmitter: Cannot listen to undefined event');
        return;
    }

    if (typeof this.events[event] !== 'object') {
        this.events[event] = [];
    }

    this.events[event].push(listener);

    if (this.autoFireAfterEmit.has(event) && this.autoFireLastArgs.has(event)) {
        listener.apply(this, this.autoFireLastArgs.get(event));
    }
};

/**
 * Makes the listener the last to be called when the event is emitted
 * @param {string} event Event name
 * @param {function} listener Event listener
 */
EventEmitter.prototype.makeLast = function (event, listener) {
    if (typeof this.events[event] !== 'object') {
        this.events[event] = [];
    }

    const events = this.events[event];
    const idx = events.indexOf(listener);

    if (idx > -1) {
        events.splice(idx, 1);
    }

    events.push(listener);

    if (this.autoFireAfterEmit.has(event) && this.autoFireLastArgs.has(event)) {
        listener.apply(this, this.autoFireLastArgs.get(event));
    }
}

/**
 * Makes the listener the first to be called when the event is emitted
 * @param {string} event Event name
 * @param {function} listener Event listener
 */
EventEmitter.prototype.makeFirst = function (event, listener) {
    if (typeof this.events[event] !== 'object') {
        this.events[event] = [];
    }

    const events = this.events[event];
    const idx = events.indexOf(listener);

    if (idx > -1) {
        events.splice(idx, 1);
    }

    events.unshift(listener);

    if (this.autoFireAfterEmit.has(event) && this.autoFireLastArgs.has(event)) {
        listener.apply(this, this.autoFireLastArgs.get(event));
    }
}

/**
 * Removes a listener from an event.
 * @param {string} event Event name
 * @param {function} listener Event listener
 */
EventEmitter.prototype.removeListener = function (event, listener) {
    var idx;

    if (typeof this.events[event] === 'object') {
        idx = indexOf(this.events[event], listener);

        if (idx > -1) {
            this.events[event].splice(idx, 1);
        }
    }
};

/**
 * Emits an event with optional arguments.
 * @param {string} event Event name
 */
EventEmitter.prototype.emit = async function (event) {
    let args = [].slice.call(arguments, 1);
    if (localStorage.getItem('eventTracing') === 'true') {
        console.trace('Event emitted: ' + event, args);
    } else {
        console.debug('Event emitted: ' + event);
    }

    let i, listeners, length;

    if (typeof this.events[event] === 'object') {
        listeners = this.events[event].slice();
        length = listeners.length;

        for (i = 0; i < length; i++) {
            try {
                await listeners[i].apply(this, args);
            }
            catch (err) {
                console.error(err);
                console.trace('Error in event listener');
            }
        }
    }

    if (this.autoFireAfterEmit.has(event)) {
        this.autoFireLastArgs.set(event, args);
    }
};

EventEmitter.prototype.emitAndWait = function (event) {
    let args = [].slice.call(arguments, 1);
    if (localStorage.getItem('eventTracing') === 'true') {
        console.trace('Event emitted: ' + event, args);
    } else {
        console.debug('Event emitted: ' + event);
    }

    let i, listeners, length;

    if (typeof this.events[event] === 'object') {
        listeners = this.events[event].slice();
        length = listeners.length;

        for (i = 0; i < length; i++) {
            try {
                listeners[i].apply(this, args);
            }
            catch (err) {
                console.error(err);
                console.trace('Error in event listener');
            }
        }
    }

    if (this.autoFireAfterEmit.has(event)) {
        this.autoFireLastArgs.set(event, args);
    }
};

EventEmitter.prototype.once = function (event, listener) {
    this.on(event, function g() {
        this.removeListener(event, g);
        listener.apply(this, arguments);
    });
};

export { EventEmitter }
