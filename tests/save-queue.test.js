import { beforeEach, describe, expect, jest, test } from '@jest/globals';

jest.unstable_mockModule('../src/util.js', () => ({
    getConfigValue: () => true,
}));

/** @type {import('../src/save-queue.js').enqueueSave} */
let enqueueSave;

beforeEach(async () => {
    jest.resetModules();
    ({ enqueueSave } = await import('../src/save-queue.js'));
});

function request(clientId, serial) {
    return {
        get(name) {
            const headers = {
                'x-st-save-client': clientId,
                'x-st-save-serial': serial === undefined ? undefined : String(serial),
            };
            return headers[name.toLowerCase()];
        },
    };
}

function deferred() {
    let resolve;
    const promise = new Promise(res => {
        resolve = res;
    });
    return { promise, resolve };
}

describe('save queue', () => {
    test('serializes writes for the same target', async () => {
        const first = deferred();
        const order = [];

        const firstResult = enqueueSave('target', request('client', 1), async () => {
            order.push('first:start');
            await first.promise;
            order.push('first:end');
        });

        await Promise.resolve();
        expect(order).toEqual(['first:start']);

        const secondResult = enqueueSave('target', request('client', 2), async () => {
            order.push('second');
        });

        first.resolve();
        await Promise.all([firstResult, secondResult]);

        expect(order).toEqual(['first:start', 'first:end', 'second']);
    });

    test('skips queued stale same-client saves for the same target', async () => {
        const saved = [];

        const firstResult = enqueueSave('target', request('client', 1), async () => {
            saved.push(1);
        });
        const secondResult = enqueueSave('target', request('client', 2), async () => {
            saved.push(2);
        });
        const staleResult = await enqueueSave('target', request('client', 1), async () => {
            saved.push('stale');
        });

        await Promise.all([firstResult, secondResult]);

        expect(staleResult).toEqual({ skipped: true, reason: 'stale' });
        await expect(firstResult).resolves.toEqual({ skipped: true, reason: 'stale' });
        expect(saved).toEqual([2]);
    });

    test('does not cancel stale saves that are already running', async () => {
        const first = deferred();
        const saved = [];

        const firstResult = enqueueSave('target', request('client', 1), async () => {
            saved.push(1);
            await first.promise;
        });

        await Promise.resolve();

        const secondResult = enqueueSave('target', request('client', 2), async () => {
            saved.push(2);
        });

        first.resolve();
        await Promise.all([firstResult, secondResult]);

        expect(saved).toEqual([1, 2]);
    });

    test('does not treat different clients as stale', async () => {
        const saved = [];

        await enqueueSave('target', request('client-a', 2), () => {
            saved.push('a2');
        });
        await enqueueSave('target', request('client-b', 1), () => {
            saved.push('b1');
        });

        expect(saved).toEqual(['a2', 'b1']);
    });

    test('serializes but does not skip requests without ordering headers', async () => {
        const saved = [];

        const firstResult = enqueueSave('target', request('', undefined), () => {
            saved.push('first');
        });
        const secondResult = enqueueSave('target', request('', undefined), () => {
            saved.push('second');
        });

        await Promise.all([firstResult, secondResult]);

        expect(saved).toEqual(['first', 'second']);
    });
});
