/**
 * A stream which handles Server-Sent Events from a binary ReadableStream like you get from the fetch API.
 */
class EventSourceStream {
    constructor() {
        const decoder = new TextDecoderStream('utf-8', { ignoreBOM: true });

        let streamBuffer = '';

        let dataBuffer = '';
        let eventType = 'message';
        let lastEventId = '';

        // https://html.spec.whatwg.org/multipage/server-sent-events.html#parsing-an-event-stream Parses a line from the
        // event stream. This is hard to read, so here's how it works: The first group matches either a field (field
        // name, optional (colon, value)) or a comment (colon, text). That group is optional, and is followed by a group
        // which matches a newline. This means that: The only *capturing* groups are the field, field value, comment,
        // and newline. This lets us determine what the line is by which capture groups are filled in. The field and
        // value groups being present means it's a field, the comment group being present means it's a comment, and
        // neither means it's a blank line. This is best viewed in RegExr if you value your sanity.
        const parserRegex = /(?:(?:([^\r\n:]+)(?:: ?([^\r\n]*)?)?)|(:[^\r\n]*))?(\r\n|\r|\n)/y;

        function processChunk(controller, isLastChunk) {
            while (parserRegex.lastIndex < streamBuffer.length) {
                const lastLastIndex = parserRegex.lastIndex;
                const matchResult = parserRegex.exec(streamBuffer);
                // We need to wait for more data to come in
                if (!matchResult) {
                    if (lastLastIndex !== 0) {
                        // Slice off what we've successfully parsed so far. lastIndex is set to 0 if there's no match,
                        // so it'll be set to start off here.
                        streamBuffer = streamBuffer.slice(lastLastIndex);
                    }
                    return;
                }

                const field = matchResult[1];
                const value = matchResult[2];
                const comment = matchResult[3];
                const newline = matchResult[4];
                // Corner case: if the last character in the buffer is '\r', we need to wait for more data. These chunks
                // could be split up any which way, and it's entirely possible that the next chunk we receive will start
                // with '\n', and this trailing '\r' is actually part of a '\r\n' sequence.
                if (newline === '\r' && parserRegex.lastIndex === streamBuffer.length && !isLastChunk) {
                    // Trim off what we've parsed so far, and wait for more data
                    streamBuffer = streamBuffer.slice(lastLastIndex);
                    parserRegex.lastIndex = 0;
                    return;
                }

                // https://html.spec.whatwg.org/multipage/server-sent-events.html#processField
                if (typeof field === 'string') {
                    switch (field) {
                        case 'event':
                            eventType = value;
                            break;
                        case 'data':
                            // If the data field is empty, there won't be a match for the value. Just add a newline.
                            if (typeof value === 'string') dataBuffer += value;
                            dataBuffer += '\n';
                            break;
                        case 'id':
                            if (!value.includes('\0')) lastEventId = value;
                            break;
                        // We do nothing for the `delay` type, and other types are explicitly ignored
                    }
                } else if (typeof comment === 'string') {
                    continue;
                } else {
                    // https://html.spec.whatwg.org/multipage/server-sent-events.html#dispatchMessage
                    // Must be a newline. Dispatch the event.
                    // Skip the event if the data buffer is the empty string.
                    if (dataBuffer === '') continue;
                    // Trim the *last* trailing newline
                    if (dataBuffer[dataBuffer.length - 1] === '\n') {
                        dataBuffer = dataBuffer.slice(0, -1);
                    }
                    const event = new MessageEvent(eventType, { data: dataBuffer, lastEventId });
                    controller.enqueue(event);
                    dataBuffer = '';
                    eventType = 'message';
                }
            }
        }

        const sseStream = new TransformStream({
            transform(chunk, controller) {
                streamBuffer += chunk;
                processChunk(controller, false);
            },

            flush(controller) {
                // If it's the last chunk, trailing carriage returns are allowed
                processChunk(controller, true);
            },
        });

        decoder.readable.pipeThrough(sseStream);

        this.readable = sseStream.readable;
        this.writable = decoder.writable;
    }
}

export default EventSourceStream;
