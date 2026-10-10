import { afterAll, afterEach, beforeEach, describe, expect, jest, test } from '@jest/globals';
import { setImmediate } from 'node:timers/promises';
import { EventEmitter } from '../public/lib/eventemitter.js';
import { waitWithAbort } from '../public/scripts/util/abort.js';

const storageDescriptor = Object.getOwnPropertyDescriptor(global, 'localStorage');
Object.defineProperty(global, 'localStorage', { configurable: true, value: { getItem: () => null } });
afterAll(() => {
    if (storageDescriptor) Object.defineProperty(global, 'localStorage', storageDescriptor);
    else delete global.localStorage;
});
beforeEach(() => {
    for (const method of ['debug', 'error', 'trace']) jest.spyOn(console, method).mockImplementation(() => {});
});
afterEach(() => jest.restoreAllMocks());

function deferred() {
    let resolve, reject;
    const promise = new Promise((resolvePromise, rejectPromise) => {
        resolve = resolvePromise;
        reject = rejectPromise;
    });
    return { promise, resolve, reject };
}

describe.each(['emit', 'emitWithSignal'])('EventEmitter.%s', method => {
    const emit = (emitter, ...args) => method === 'emit'
        ? emitter.emit(...args)
        : emitter.emitWithSignal(new AbortController().signal, ...args);

    test('starts synchronously and awaits a snapshot of listeners in order with their context and arguments', async () => {
        const emitter = new EventEmitter();
        const gate = deferred();
        const calls = [];
        const second = jest.fn(() => calls.push('second'));
        const added = jest.fn();
        let context, args;
        emitter.on('event', async function (...values) {
            context = this;
            args = values;
            calls.push('first');
            emitter.removeListener('event', second);
            emitter.on('event', added);
            await gate.promise;
            calls.push('finished');
        });
        emitter.on('event', second);
        const pending = emit(emitter, 'event', 'value', 42);
        expect(calls).toEqual(['first']);
        gate.resolve();
        await pending;
        expect(calls).toEqual(['first', 'finished', 'second']);
        expect(context).toBe(emitter);
        expect(args).toEqual(['value', 42]);
        expect(added).not.toHaveBeenCalled();
    });

    test('logs listener failures and continues, then remembers auto-fire arguments', async () => {
        const emitter = new EventEmitter(['event']);
        const thrown = new Error('synchronous failure');
        const rejected = new Error('asynchronous failure');
        const last = jest.fn();
        emitter.on('event', () => { throw thrown; });
        emitter.on('event', () => Promise.reject(rejected));
        emitter.on('event', last);
        await emit(emitter, 'event', 'value', 42);
        expect(console.error).toHaveBeenNthCalledWith(1, thrown);
        expect(console.error).toHaveBeenNthCalledWith(2, rejected);
        expect(last).toHaveBeenCalledWith('value', 42);
        const added = jest.fn();
        emitter.on('event', added);
        expect(added).toHaveBeenCalledWith('value', 42);
        expect(added.mock.contexts[0]).toBe(emitter);
    });
});

describe('cancellable event dispatch', () => {
    for (const settle of ['resolve', 'reject']) {
        test(`stops a pending listener and ignores its late ${settle}`, async () => {
            const emitter = new EventEmitter(['event']);
            const controller = new AbortController();
            const remove = jest.spyOn(controller.signal, 'removeEventListener');
            const gate = deferred();
            const next = jest.fn();
            emitter.on('event', () => gate.promise);
            emitter.on('event', next);
            const pending = emitter.emitWithSignal(controller.signal, 'event', 'cancelled');
            controller.abort('stopped');
            await expect(pending).rejects.toBe('stopped');
            expect(remove).toHaveBeenCalledWith('abort', expect.any(Function));
            expect(next).not.toHaveBeenCalled();
            gate[settle](new Error('late result'));
            await setImmediate();
            expect(next).not.toHaveBeenCalled();
            expect(console.error).not.toHaveBeenCalled();
            const added = jest.fn();
            emitter.on('event', added);
            expect(added).not.toHaveBeenCalled();
        });
    }

    test('does not dispatch or remember a pre-aborted event', async () => {
        const emitter = new EventEmitter(['event']);
        const controller = new AbortController();
        const listener = jest.fn();
        emitter.on('event', listener);
        controller.abort('stopped');
        await expect(emitter.emitWithSignal(controller.signal, 'event')).rejects.toBe('stopped');
        expect(listener).not.toHaveBeenCalled();
        expect(emitter.autoFireLastArgs.has('event')).toBe(false);
    });
});

describe('waitWithAbort', () => {
    test('starts immediately without a signal and skips an already cancelled operation', async () => {
        const operation = jest.fn(() => 42);
        const pending = waitWithAbort(operation);
        expect(operation).toHaveBeenCalledTimes(1);
        await expect(pending).resolves.toBe(42);
        const controller = new AbortController();
        controller.abort('stopped');
        await expect(waitWithAbort(operation, controller.signal)).rejects.toBe('stopped');
        expect(operation).toHaveBeenCalledTimes(1);
    });

    for (const outcome of ['resolve', 'throw', 'reject']) {
        test(`removes its abort listener after operation ${outcome}`, async () => {
            const controller = new AbortController();
            const add = jest.spyOn(controller.signal, 'addEventListener');
            const remove = jest.spyOn(controller.signal, 'removeEventListener');
            const error = new Error('failed');
            const pending = waitWithAbort(() => {
                if (outcome === 'throw') throw error;
                return outcome === 'reject' ? Promise.reject(error) : 42;
            }, controller.signal);
            const result = await pending.then(value => ({ value }), error => ({ error }));
            expect(result).toEqual(outcome === 'resolve' ? { value: 42 } : { error });
            expect(remove).toHaveBeenCalledWith('abort', add.mock.calls[0][1]);
        });
    }

    for (const outcome of ['throw', 'reject']) {
        test(`handles operation ${outcome} after synchronously aborting`, async () => {
            const controller = new AbortController();
            const error = new Error('operation failure');
            const pending = waitWithAbort(() => {
                controller.abort('stopped');
                if (outcome === 'throw') throw error;
                return Promise.reject(error);
            }, controller.signal);
            await expect(pending).rejects.toBe('stopped');
            await setImmediate();
        });
    }
});
