import { parentPort } from 'node:worker_threads';
import { withVectorStore, purgeVectorStores, deleteMessageProfiles } from './disk-index.js';

const methods = new Set(['upsert', 'query', 'bodies', 'hashes', 'stats', 'messageState', 'deleteHashes', 'deleteMessages']);
let queue = Promise.resolve();

async function execute({ id, root, collectionId, source, profile, method, args }) {
    try {
        let result;
        if (method === 'purge') result = await purgeVectorStores(root, collectionId);
        else if (method === 'deleteMessageProfiles') result = await deleteMessageProfiles(root, collectionId, args[0]);
        else {
            if (!methods.has(method)) throw new TypeError('Unsupported vector storage operation');
            result = await withVectorStore(root, collectionId, source, profile, store => {
                parentPort.postMessage({ id, started: true });
                return store[method](...args);
            }, { upgradeIndexes: true });
        }
        parentPort.postMessage({ id, result });
    } catch (error) {
        parentPort.postMessage({ id, error: { name: error.name, message: error.message } });
    }
}

parentPort.on('message', request => {
    // Includes purge: no operation can open another connection while a purge runs.
    queue = queue.catch(() => {}).then(() => execute(request));
});
