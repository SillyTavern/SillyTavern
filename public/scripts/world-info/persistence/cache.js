/**
 * World Info Cache
 * Contains the cache for loaded world info data.
 */

import { StructuredCloneMap } from '../../util/StructuredCloneMap.js';

/**
 * The cache of all world info data that was loaded from the backend.
 *
 * Calling `loadWorldInfo` will fill this cache and utilize this cache, so should be the preferred way to load any world info data.
 * Only use the cache directly if you need synchronous access.
 *
 * This will return a deep clone of the data, so no way to modify the data without actually saving it.
 * Should generally be only used for readonly access.
 *
 * @type {StructuredCloneMap<string,object>}
 * */
export const worldInfoCache = new StructuredCloneMap({ cloneOnGet: true, cloneOnSet: false });
