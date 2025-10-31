// sw.js

const METADATA_CACHE_NAME = 'pwa-metadata-cache-v1';
const DATA_CACHE_NAME = 'pwa-data-cache-v1';

const LOG_PREFIX = '[Service Worker]';

/**
 * clean cache for path prefix
 * 
 * @param {string} pathPrefix path prefix
 */
async function clearCacheForPath(pathPrefix) {
    console.log(`${LOG_PREFIX} Clearing cache for path: ${pathPrefix}`);
    try {
        const dataCache = await caches.open(DATA_CACHE_NAME);
        const cachedRequests = await dataCache.keys();
        const deletePromises = cachedRequests
            .filter(req => new URL(req.url).pathname.startsWith(pathPrefix))
            .map(req => {
                console.log(`${LOG_PREFIX} Deleting from cache: ${req.url}`);
                return dataCache.delete(req);
            });
        await Promise.all(deletePromises);
        console.log(`${LOG_PREFIX} Cache cleared for path: ${pathPrefix}`);
    } catch (error) {
        console.error(`${LOG_PREFIX} Error clearing cache for path ${pathPrefix}:`, error);
    }
}

self.addEventListener('install', (event) => {
    console.log(`${LOG_PREFIX} Install event`);
    event.waitUntil(self.skipWaiting());
});

self.addEventListener('activate', (event) => {
    console.log(`${LOG_PREFIX} Activate event`);
    event.waitUntil(
        (async () => {
            await self.clients.claim();
            try {
                const response = await fetch('/version');
                if (!response.ok) throw new Error(`Failed to fetch /version: ${response.statusText}`);

                const versionInfo = await response.json();
                const newGlobalVersion = versionInfo.gitRevision;
                if (!newGlobalVersion) {
                    console.warn(`${LOG_PREFIX} gitRevision not found in /version response.`);
                    return;
                }

                const globalVersionCacheKey = new URL('/pwa-metadata/global-version', self.location.origin).href;

                const metadataCache = await caches.open(METADATA_CACHE_NAME);
                const oldVersionResponse = await metadataCache.match(globalVersionCacheKey);
                const oldGlobalVersion = oldVersionResponse ? await oldVersionResponse.text() : null;

                console.log(`${LOG_PREFIX} New global version: ${newGlobalVersion}, Old global version: ${oldGlobalVersion}`);

                if (newGlobalVersion !== oldGlobalVersion) {
                    console.log(`${LOG_PREFIX} Global version mismatch. Clearing ALL caches.`);
                    const cacheNames = await caches.keys();
                    await Promise.all(cacheNames.map(name => caches.delete(name)));

                    const newMetadataCache = await caches.open(METADATA_CACHE_NAME);
                    await newMetadataCache.put(globalVersionCacheKey, new Response(newGlobalVersion));
                    console.log(`${LOG_PREFIX} All caches cleared and new global version stored.`);
                } else {
                    console.log(`${LOG_PREFIX} Global version is up to date.`);
                }
            } catch (error) {
                console.error(`${LOG_PREFIX} Error during global version check:`, error);
            }
        })()
    );
});

self.addEventListener('fetch', (event) => {
    if (event.request.method !== 'GET') return;

    const url = new URL(event.request.url);

    if (!url.protocol.startsWith('http')) return;
    if (url.pathname.startsWith('/api/')) return;
    if (url.pathname.startsWith('/thumbnail')) return;
    if (url.pathname.startsWith('/csrf-token')) return;
    if (url.pathname.startsWith('/version')) return;

    if (url.pathname.endsWith('/manifest.json')) {
        event.respondWith(handleManifestRequest(event));
        return;
    }

    event.respondWith(
        caches.match(event.request).then((cachedResponse) => {
            if (cachedResponse) return cachedResponse;

            return fetch(event.request).then((networkResponse) => {
                if (!networkResponse || !networkResponse.ok || networkResponse.type !== 'basic') {
                    return networkResponse;
                }

                const responseToCache = networkResponse.clone();
                caches.open(DATA_CACHE_NAME).then((cache) => {
                    cache.put(event.request, responseToCache);
                });
                return networkResponse;
            }).catch(error => {
                console.error(`${LOG_PREFIX} Fetch failed for ${event.request.url}:`, error);
            });
        })
    );
});

/**
 * Parse the extentions manifest.json file to check for updates.
 * 
 * @param {FetchEvent} event request event
 */
async function handleManifestRequest(event) {
    console.log(`${LOG_PREFIX} Handling manifest request: ${event.request.url}`);
    try {
        const networkResponse = await fetch(event.request);
        const responseForClient = networkResponse.clone();
        const responseForSW = networkResponse.clone();

        const manifestData = await responseForSW.json();
        const newExtensionVersion = manifestData.version;

        if (!newExtensionVersion) {
            console.warn(`${LOG_PREFIX} 'version' field not found in ${event.request.url}`);
            return responseForClient;
        }

        const extensionPath = new URL(event.request.url).pathname.replace(/manifest\.json$/, '');

        const versionCacheKey = new URL(`/pwa-metadata/versions${extensionPath}`, self.location.origin).href;

        const metadataCache = await caches.open(METADATA_CACHE_NAME);
        const oldVersionResponse = await metadataCache.match(versionCacheKey);
        const oldExtensionVersion = oldVersionResponse ? await oldVersionResponse.text() : null;

        console.log(`${LOG_PREFIX} Extension at '${extensionPath}': New version=${newExtensionVersion}, Old version=${oldExtensionVersion}`);

        if (newExtensionVersion !== oldExtensionVersion) {
            console.log(`${LOG_PREFIX} Version mismatch for extension at '${extensionPath}'. Clearing its cache.`);
            await clearCacheForPath(extensionPath);
            await metadataCache.put(versionCacheKey, new Response(newExtensionVersion));
            console.log(`${LOG_PREFIX} Updated version for '${extensionPath}' to ${newExtensionVersion}.`);
        }

        return responseForClient;
    } catch (error) {
        console.error(`${LOG_PREFIX} Error handling manifest request for ${event.request.url}:`, error);
        return fetch(event.request);
    }
}