/**
 * Storage provider registry for external storage backends.
 * When no provider is registered, all operations fall through to
 * the default filesystem-based storage.
 * @module storage-provider
 */

/** @type {import('./storage-provider-types').StorageProvider|null} */
let provider = null;

/**
 * Registers an external storage provider.
 * @param {import('./storage-provider-types').StorageProvider} p The storage provider to register
 */
export function registerStorageProvider(p) {
    provider = p;
    console.log('[StorageProvider] External storage provider registered');
}

/**
 * Returns the currently registered storage provider, or null if none.
 * @returns {import('./storage-provider-types').StorageProvider|null}
 */
export function getStorageProvider() {
    return provider;
}
