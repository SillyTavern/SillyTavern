/**
 * A stream which handles Server-Sent Events from a binary ReadableStream like you get from the fetch API.
 */
class EventSourceStream {
    constructor() {
        const decoder = new TextDecoderStream('utf-8');

        let streamBuffer = '';
        let lastEventId = '';

        function processChunk(controller) {
            // Events are separated by two newlines
            const events = streamBuffer.split(/\r\n\r\n|\r\r|\n\n/g);
            if (events.length === 0) return;

            // The leftover text to remain in the buffer is whatever doesn't have two newlines after it. If the buffer ended
            // with two newlines, this will be an empty string.
            streamBuffer = events.pop();

            for (const eventChunk of events) {
                let eventType = '';
                // Split up by single newlines.
                const lines = eventChunk.split(/\n|\r|\r\n/g);
                let eventData = '';
                for (const line of lines) {
                    const lineMatch = /([^:]+)(?:: ?(.*))?/.exec(line);
                    if (lineMatch) {
                        const field = lineMatch[1];
                        const value = lineMatch[2] || '';

                        switch (field) {
                            case 'event':
                                eventType = value;
                                break;
                            case 'data':
                                eventData += value;
                                eventData += '\n';
                                break;
                            case 'id':
                                // The ID field cannot contain null, per the spec
                                if (!value.includes('\0')) lastEventId = value;
                                break;
                            // We do nothing for the `delay` type, and other types are explicitly ignored
                        }
                    }
                }


                // https://html.spec.whatwg.org/multipage/server-sent-events.html#dispatchMessage
                // Skip the event if the data buffer is the empty string.
                if (eventData === '') continue;

                if (eventData[eventData.length - 1] === '\n') {
                    eventData = eventData.slice(0, -1);
                }

                // Trim the *last* trailing newline only.
                const event = new MessageEvent(eventType || 'message', { data: eventData, lastEventId });
                controller.enqueue(event);
            }
        }

        const sseStream = new TransformStream({
            transform(chunk, controller) {
                streamBuffer += chunk;
                processChunk(controller);
            },
        });

        decoder.readable.pipeThrough(sseStream);

        this.readable = sseStream.readable;
        this.writable = decoder.writable;
    }
}

export default EventSourceStream;
