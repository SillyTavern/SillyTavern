import { Worker } from 'node:worker_threads';

let worker;
let sequence = 0;
const pending = new Map();

function getWorker() {
    if (worker) return worker;
    const instance = new Worker(new URL('./disk-worker.js', import.meta.url));
    worker = instance;
    instance.on('message', ({ id, result, error, started }) => {
        const request = pending.get(id);
        if (!request) return;
        if (started) { request.onStarted?.(); return; }
        pending.delete(id);
        if (error) {
            const ErrorType = error.name === 'TypeError' ? TypeError : error.name === 'RangeError' ? RangeError : Error;
            request.reject(new ErrorType(error.message));
        } else request.resolve(result);
        if (!pending.size) instance.unref();
    });
    const fail = error => {
        if (worker !== instance) return;
        worker = undefined;
        for (const request of pending.values()) request.reject(error);
        pending.clear();
    };
    instance.on('error', fail);
    instance.on('exit', code => fail(new Error(`Vector storage worker exited (${code})`)));
    return instance;
}

export function vectorOperation(request, { onStarted } = {}) {
    if (pending.size >= 64) {
        const error = new Error('Vector storage is busy; retry this request');
        error.code = 'VECTOR_STORAGE_BUSY';
        return Promise.reject(error);
    }
    const instance = getWorker();
    const id = ++sequence;
    instance.ref();
    return new Promise((resolve, reject) => {
        pending.set(id, { resolve, reject, onStarted });
        try {
            instance.postMessage({ ...request, id });
        } catch (error) {
            pending.delete(id);
            if (!pending.size) instance.unref();
            reject(error);
        }
    });
}

/** Native libSQL indexing/search runs on one bounded worker, outside the HTTP event loop. */
export async function withVectorWorker(root, collectionId, source, profile, callback) {
    const proxy = {};
    for (const method of ['upsert', 'query', 'bodies', 'hashes', 'stats', 'messageState', 'deleteHashes', 'deleteMessages']) {
        proxy[method] = (...args) => vectorOperation({ root, collectionId, source, profile, method, args });
    }
    return callback(proxy);
}

export function purgeVectorWorker(root, collectionId) {
    return vectorOperation({ root, collectionId, method: 'purge' });
}

export async function closeVectorWorker() {
    const instance = worker;
    if (!instance) return;
    if (pending.size) throw new Error('Cannot terminate vector storage while requests are pending');
    worker = undefined;
    await instance.terminate();
}
