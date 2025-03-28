/**
 * Common debounce timeout values to use with `debounce` calls.
 * @enum {number}
 */
export const debounce_timeout = {
    /** [100 ms] For ultra-fast responses, typically for keypresses or executions that might happen multiple times in a loop or recursion. */
    quick: 100,
    /** [200 ms] Slightly slower than quick, but still very responsive. */
    short: 200,
    /** [300 ms] Default time for general use, good balance between responsiveness and performance. */
    standard: 300,
    /** [1.000 ms] For situations where the function triggers more intensive tasks. */
    relaxed: 1000,
    /** [5 sec] For delayed tasks, like auto-saving or completing batch operations that need a significant pause. */
    extended: 5000,
};

/**
 * Used as an ephemeral key in message extra metadata.
 * When set, the message will be excluded from generation
 * prompts without affecting the number of chat messages,
 * which is needed to preserve world info timed effects.
 */
export const IGNORE_SYMBOL = Symbol.for('ignore');
