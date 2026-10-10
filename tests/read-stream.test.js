import { describe, expect, jest, test } from '@jest/globals';
import { readStream } from '../public/scripts/util/read-stream.js';

describe('readStream', () => {
    test('preserves normal chunks and releases the reader after EOF', async () => {
        const cancel = jest.fn();
        const stream = new ReadableStream({ start(c) { c.enqueue('a'); c.enqueue('b'); c.close(); }, cancel });
        const chunks = [];
        for await (const chunk of readStream(stream)) chunks.push(chunk);
        expect(chunks).toEqual(['a', 'b']);
        expect(stream.locked).toBe(false);
        expect(cancel).not.toHaveBeenCalled();
    });

    test('cancels unfinished consumption when the caller breaks', async () => {
        const cancel = jest.fn();
        const stream = new ReadableStream({ start(c) { c.enqueue('a'); }, cancel });
        for await (const chunk of readStream(stream)) { expect(chunk).toBe('a'); break; }
        expect(cancel).toHaveBeenCalledTimes(1);
        expect(stream.locked).toBe(false);
    });

    test('preserves the consumer error when cancellation also fails', async () => {
        const error = new Error('provider failed');
        const stream = new ReadableStream({ start(c) { c.enqueue('a'); }, cancel() { throw new Error('cancel failed'); } });
        const consume = async () => { for await (const chunk of readStream(stream)) { expect(chunk).toBe('a'); throw error; } };
        await expect(consume()).rejects.toBe(error);
        expect(stream.locked).toBe(false);
    });

    test('preserves a failed read and releases its reader', async () => {
        const error = new Error('connection reset');
        const stream = new ReadableStream({ start(c) { c.error(error); } });
        await expect(readStream(stream).next()).rejects.toBe(error);
        expect(stream.locked).toBe(false);
    });
});
