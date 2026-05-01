const latestSaveQueues = new Map();

function getState(key) {
    let state = latestSaveQueues.get(key);
    if (!state) {
        state = {
            key,
            inFlightPromise: null,
            inFlightEntryPromise: null,
            inFlightFingerprint: null,
            pending: null,
            lastSavedFingerprint: null,
        };
        latestSaveQueues.set(key, state);
    }
    return state;
}

function createEntry({ key, fingerprint, item, save, onSkip }) {
    let resolveEntry;
    let rejectEntry;
    const promise = new Promise((resolve, reject) => {
        resolveEntry = resolve;
        rejectEntry = reject;
    });

    return {
        key,
        fingerprint,
        item,
        save,
        onSkip,
        promise,
        resolve: resolveEntry,
        reject: rejectEntry,
    };
}

function finishSkipped(entry, reason) {
    entry.onSkip?.({ key: entry.key, reason });
    entry.resolve({ status: 'skipped', key: entry.key, reason });
}

async function drainQueue(state, firstEntry) {
    let entry = firstEntry;

    while (entry) {
        state.inFlightFingerprint = entry.fingerprint;
        state.inFlightEntryPromise = entry.promise;

        try {
            const result = await entry.save(entry.item, {
                key: state.key,
                fingerprint: entry.fingerprint,
            });
            state.lastSavedFingerprint = entry.fingerprint;
            entry.resolve({ status: 'saved', key: state.key, result });
        } catch (error) {
            entry.reject(error);
        }

        entry = state.pending;
        state.pending = null;

        if (entry && entry.fingerprint === state.lastSavedFingerprint) {
            finishSkipped(entry, 'last_saved_after_drain');
            entry = null;
        }
    }
}

/**
 * Sets the saved fingerprint for a latest-wins save queue.
 * @param {string} key Queue key
 * @param {string|null|undefined} fingerprint Latest saved fingerprint
 */
export function setLatestSaveBaseline(key, fingerprint) {
    const state = getState(key);
    state.lastSavedFingerprint = fingerprint ?? null;
}

/**
 * Enqueues a save request, coalescing repeated saves by key and keeping only the latest pending payload.
 *
 * The save callback must throw on failed writes. Successful completion updates the queue baseline.
 * @param {object} options Options
 * @param {string} options.key Queue key
 * @param {string} options.fingerprint Stable payload fingerprint
 * @param {any} options.item Payload to pass to the save callback
 * @param {(item: any, context: { key: string, fingerprint: string }) => Promise<any>} options.save Save callback
 * @param {(context: { key: string, reason: string }) => void} [options.onSkip] Skip callback
 * @returns {Promise<{status: string, key: string, reason?: string, result?: any}>} Save result
 */
export function enqueueLatestSave({ key, fingerprint, item, save, onSkip }) {
    if (!key || typeof key !== 'string') {
        throw new Error('enqueueLatestSave requires a string key');
    }

    if (typeof save !== 'function') {
        throw new Error('enqueueLatestSave requires a save function');
    }

    const state = getState(key);

    if (fingerprint === state.lastSavedFingerprint) {
        onSkip?.({ key, reason: 'last_saved' });
        return Promise.resolve({ status: 'skipped', key, reason: 'last_saved' });
    }

    if (state.inFlightPromise && fingerprint === state.inFlightFingerprint) {
        return state.inFlightEntryPromise;
    }

    if (state.pending && fingerprint === state.pending.fingerprint) {
        return state.pending.promise;
    }

    const entry = createEntry({ key, fingerprint, item, save, onSkip });

    if (state.inFlightPromise) {
        if (state.pending) {
            state.pending.resolve({ status: 'superseded', key, reason: 'replaced_by_newer' });
        }
        state.pending = entry;
        return entry.promise;
    }

    state.inFlightPromise = drainQueue(state, entry).finally(() => {
        state.inFlightPromise = null;
        state.inFlightEntryPromise = null;
        state.inFlightFingerprint = null;
    });

    return entry.promise;
}
