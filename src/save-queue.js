import { getConfigValue } from './util.js';

const ENABLE_SAVE_QUEUE = !!getConfigValue('performance.saveQueue.enabled', true, 'boolean');
const SAVE_QUEUE_IDLE_TTL = 5 * 60 * 1000;
const SAVE_CLIENT_HEADER = 'x-st-save-client';
const SAVE_SERIAL_HEADER = 'x-st-save-serial';

const saveQueues = new Map();

function parseSaveSerial(value) {
    const serial = Number(value);
    return Number.isSafeInteger(serial) && serial > 0 ? serial : null;
}

function getSaveOrder(request) {
    const clientId = String(request.get(SAVE_CLIENT_HEADER) || '').trim().slice(0, 128);
    const serial = parseSaveSerial(request.get(SAVE_SERIAL_HEADER));

    return {
        clientId: clientId || null,
        serial,
    };
}

function getQueueState(key) {
    let state = saveQueues.get(key);

    if (!state) {
        state = {
            tail: Promise.resolve(),
            latestSerials: new Map(),
            cleanupTimer: null,
        };
        saveQueues.set(key, state);
    }

    if (state.cleanupTimer) {
        clearTimeout(state.cleanupTimer);
        state.cleanupTimer = null;
    }

    return state;
}

function scheduleCleanup(key, state) {
    state.cleanupTimer = setTimeout(() => {
        if (saveQueues.get(key) === state) {
            saveQueues.delete(key);
        }
    }, SAVE_QUEUE_IDLE_TTL);
    state.cleanupTimer.unref?.();
}

function isStaleSave(state, saveOrder) {
    if (!saveOrder.clientId || saveOrder.serial === null) {
        return false;
    }

    const latestSerial = state.latestSerials.get(saveOrder.clientId) ?? 0;
    return saveOrder.serial < latestSerial;
}

function rememberLatestSave(state, saveOrder) {
    if (!saveOrder.clientId || saveOrder.serial === null) {
        return;
    }

    const latestSerial = state.latestSerials.get(saveOrder.clientId) ?? 0;
    if (saveOrder.serial > latestSerial) {
        state.latestSerials.set(saveOrder.clientId, saveOrder.serial);
    }
}

/**
 * Serializes writes for the same save target and skips stale same-client writes.
 *
 * Requests without save-order headers are still serialized, but never skipped.
 * @param {string} key Stable target key, usually the absolute file path
 * @param {import('express').Request} request Express request
 * @param {() => Promise<any>|any} save Save callback
 * @returns {Promise<{ skipped: boolean, reason?: string, result?: any }>}
 */
export async function enqueueSave(key, request, save) {
    if (!ENABLE_SAVE_QUEUE) {
        return { skipped: false, result: await save() };
    }

    if (!key || typeof save !== 'function') {
        throw new Error('enqueueSave requires a save key and callback');
    }

    const state = getQueueState(key);
    const saveOrder = getSaveOrder(request);

    if (isStaleSave(state, saveOrder)) {
        return { skipped: true, reason: 'stale' };
    }

    rememberLatestSave(state, saveOrder);

    const run = state.tail.then(async () => {
        if (isStaleSave(state, saveOrder)) {
            return { skipped: true, reason: 'stale' };
        }

        return { skipped: false, result: await save() };
    });

    const tail = run.catch(() => {});
    state.tail = tail;
    tail.finally(() => {
        if (state.tail === tail) {
            scheduleCleanup(key, state);
        }
    });

    return run;
}
