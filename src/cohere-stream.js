const DATA_PREFIX = 'data:';

/**
 * Borrowed from Cohere SDK (MIT License)
 * https://github.com/cohere-ai/cohere-typescript/blob/main/src/core/streaming-fetcher/Stream.ts
 * Copyright (c) 2021 Cohere
 */
class CohereStream {
    /** @type {ReadableStream} */
    stream;
    /** @type {string} */
    prefix;
    /** @type {string} */
    messageTerminator;
    /** @type {string|undefined} */
    streamTerminator;
    /** @type {AbortController} */
    controller = new AbortController();

    constructor({ stream, eventShape }) {
        this.stream = stream;
        if (eventShape.type === 'sse') {
            this.prefix = DATA_PREFIX;
            this.messageTerminator = '\n';
            this.streamTerminator = eventShape.streamTerminator;
        } else {
            this.messageTerminator = eventShape.messageTerminator;
        }
    }

    async *iterMessages()  {
        const stream = readableStreamAsyncIterable(this.stream);
        let buf = '';
        let prefixSeen = false;
        let parsedAnyMessages = false;
        for await (const chunk of stream) {
            buf += this.decodeChunk(chunk);

            let terminatorIndex;
            // Parse the chunk into as many messages as possible
            while ((terminatorIndex = buf.indexOf(this.messageTerminator)) >= 0) {
                // Extract the line from the buffer
                let line = buf.slice(0, terminatorIndex + 1);
                buf = buf.slice(terminatorIndex + 1);

                // Skip empty lines
                if (line.length === 0) {
                    continue;
                }

                // Skip the chunk until the prefix is found
                if (!prefixSeen && this.prefix != null) {
                    const prefixIndex = line.indexOf(this.prefix);
                    if (prefixIndex === -1) {
                        continue;
                    }
                    prefixSeen = true;
                    line = line.slice(prefixIndex + this.prefix.length);
                }

                // If the stream terminator is present, return
                if (this.streamTerminator != null && line.includes(this.streamTerminator)) {
                    return;
                }

                // Otherwise, yield message from the prefix to the terminator
                const message = JSON.parse(line);
                yield message;
                prefixSeen = false;
                parsedAnyMessages = true;
            }
        }

        if (!parsedAnyMessages && buf.length > 0) {
            try {
                yield JSON.parse(buf);
            } catch (e) {
                console.error('Error parsing message:', e);
            }
        }
    }

    async *[Symbol.asyncIterator]() {
        for await (const message of this.iterMessages()) {
            yield message;
        }
    }

    decodeChunk(chunk) {
        const decoder = new TextDecoder('utf8');
        return decoder.decode(chunk);
    }
}

function readableStreamAsyncIterable(stream) {
    if (stream[Symbol.asyncIterator]) {
        return stream;
    }

    const reader = stream.getReader();
    return {
        async next() {
            try {
                const result = await reader.read();
                if (result?.done) {
                    reader.releaseLock();
                } // release lock when stream becomes closed
                return result;
            } catch (e) {
                reader.releaseLock(); // release lock when stream becomes errored
                throw e;
            }
        },
        async return() {
            const cancelPromise = reader.cancel();
            reader.releaseLock();
            await cancelPromise;
            return { done: true, value: undefined };
        },
        [Symbol.asyncIterator]() {
            return this;
        },
    };
}

module.exports = CohereStream;
