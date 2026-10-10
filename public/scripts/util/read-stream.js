/**
 * Reads a stream while releasing its reader and canceling unfinished consumption.
 * @template T
 * @param {ReadableStream<T>} stream Stream to consume
 * @returns {AsyncGenerator<T>}
 */
export async function* readStream(stream) {
    const reader = stream.getReader();
    let finished = false;
    try {
        while (true) {
            const { done, value } = await reader.read();
            finished = done;
            if (done) return;
            yield value;
        }
    } finally {
        try {
            if (!finished) await reader.cancel();
        } catch {
            // An already failed stream can reject cancellation; preserve its original error.
        } finally {
            reader.releaseLock();
        }
    }
}
