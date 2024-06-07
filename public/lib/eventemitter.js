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
var EventEmitter = function () {
    this.events = {};
};

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
}

EventEmitter.prototype.removeListener = function (event, listener) {
    var idx;

    if (typeof this.events[event] === 'object') {
        idx = indexOf(this.events[event], listener);

        if (idx > -1) {
            this.events[event].splice(idx, 1);
        }
    }
};

EventEmitter.prototype.emit = async function (event) {
    if (localStorage.getItem('eventTracing') === 'true') {
        console.trace('Event emitted: ' + event, args);
    } else {
        console.debug('Event emitted: ' + event);
    }

    var i, listeners, length, args = [].slice.call(arguments, 1);

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
};

EventEmitter.prototype.emitAndWait = function (event) {
    if (localStorage.getItem('eventTracing') === 'true') {
        console.trace('Event emitted: ' + event, args);
    } else {
        console.debug('Event emitted: ' + event);
    }

    var i, listeners, length, args = [].slice.call(arguments, 1);

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
};

EventEmitter.prototype.once = function (event, listener) {
    this.on(event, function g () {
        this.removeListener(event, g);
        listener.apply(this, arguments);
    });
};

export { EventEmitter }
