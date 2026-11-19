/**
 * Waits for an operation while allowing its caller to stop waiting on cancellation.
 * @template T
 * @param {() => T | PromiseLike<T>} operation Operation to start unless already aborted
 * @param {AbortSignal} [signal] Signal to cancel the wait
 * @returns {Promise<T>} The operation's result
 */
export async function waitWithAbort(operation, signal) {
    signal?.throwIfAborted();
    if (!signal) {
        return operation();
    }

    let onAbort;
    const aborted = new Promise((_, reject) => {
        onAbort = () => reject(signal.reason);
        signal.addEventListener('abort', onAbort, { once: true });
    });

    try {
        // Adopt the result even when the operation aborts synchronously, so late rejections are handled.
        const result = await Promise.race([aborted, new Promise(resolve => resolve(operation()))]);
        signal.throwIfAborted();
        return result;
    } finally {
        signal.removeEventListener('abort', onAbort);
    }
}
