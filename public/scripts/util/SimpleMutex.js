/**
 * A simple mutex class to prevent concurrent updates.
 */
export class SimpleMutex {
    /**
     * @type {boolean}
     */
    isBusy = false;

    /**
     * @type {Function}
     */
    callback = () => {};

    /**
     * Constructs a SimpleMutex.
     * @param {Function} callback Callback function.
     */
    constructor(callback) {
        this.isBusy = false;
        this.callback = callback;
    }

    /**
     * Updates the mutex by calling the callback if not busy.
     * @param  {...any} args Callback args
     * @returns {Promise<void>}
     */
    async update(...args) {
        // Don't touch me I'm busy...
        if (this.isBusy) {
            return;
        }

        // I'm free. Let's update!
        try {
            this.isBusy = true;
            await this.callback(...args);
        }
        finally {
            this.isBusy = false;
        }
    }
}
