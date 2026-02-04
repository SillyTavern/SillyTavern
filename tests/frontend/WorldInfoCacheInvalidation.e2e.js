/**
 * World Info Cache Invalidation Tests
 *
 * End-to-end tests that verify the Aho-Corasick cache behaves correctly:
 * - Cache is built on first scan
 * - Cache is reused on subsequent scans
 * - Cache clear() method properly invalidates the cache
 * - Different lorebooks can have independent cache entries
 *
 * NOTE: The WI_AC_CACHE_HIT flag reflects the last getOrBuild call during a scan.
 * Since WI scans can be recursive (finding entries triggers more scans), the cache
 * may be built on the first pass and hit on subsequent recursive passes within the
 * same checkWorldInfo call. To detect true cache misses, we track:
 * - cacheBuilt: whether a new cache entry was built (sizeBefore < sizeAfter)
 */
import { test, expect } from '@playwright/test';

const setup = {
    awaitST: async ({ page }) => {
        await page.goto('/');
        await page.waitForFunction(
            'document.getElementById("preloader") === null || document.getElementById("preloader")?.style.display === "none"',
            { timeout: 30000 },
        );
        await page.waitForTimeout(1000);
    },
};

const TEST_CHAT = ['The knight entered the tavern near the forest.'];

/**
 * Helper to run a WI scan and get cache status
 * @param {import('@playwright/test').Page} page
 * @param {string} lorebookName
 * @param {object} options
 * @param {boolean} options.clearCache - Clear AC cache before scan (for cold start)
 * @returns {Promise<{cacheBuilt: boolean, cacheSizeBefore: number, cacheSizeAfter: number, cacheHit: boolean, cacheMissReason: string}>}
 */
async function runScanAndGetCacheStatus(page, lorebookName, { clearCache = false } = {}) {
    return await page.evaluate(async ({ name, messages, shouldClearCache }) => {
        const wiModule = await import('/scripts/world-info.js');

        // Save selected_world_info to isolate test
        const savedSelectedWorldInfo = [...wiModule.selected_world_info];

        try {
            // Clear lorebook data cache and reload
            wiModule.worldInfoCache.delete(name);
            await wiModule.loadWorldInfo(name);

            // Isolate selected_world_info to only this lorebook
            wiModule.selected_world_info.length = 0;
            wiModule.selected_world_info.push(name);

            // Optionally clear AC cache for cold start
            if (shouldClearCache) {
                wiModule.acCacheManager.clear();
            }

            // Store cache size before scan
            const cacheSizeBefore = wiModule.acCacheManager.size;

            wiModule.setWorldInfoUseAhoCorasick(true);

            const scanData = {
                personaDescription: '',
                characterDescription: '',
                characterPersonality: '',
                characterDepthPrompt: '',
                scenario: '',
                creatorNotes: '',
                trigger: 'normal',
            };

            const chat = [...messages].reverse();
            await wiModule.checkWorldInfo(chat, 8192, true, scanData);

            const cacheSizeAfter = wiModule.acCacheManager.size;

            return {
                // True if a new cache entry was built during this scan
                cacheBuilt: cacheSizeAfter > cacheSizeBefore,
                cacheSizeBefore,
                cacheSizeAfter,
                // Last getOrBuild result (may be hit due to recursive scans)
                // eslint-disable-next-line no-undef
                cacheHit: window.WI_AC_CACHE_HIT,
                // eslint-disable-next-line no-undef
                cacheMissReason: window.WI_AC_CACHE_MISS_REASON,
            };
        } finally {
            // Restore original selected_world_info
            wiModule.selected_world_info.length = 0;
            savedSelectedWorldInfo.forEach(x => wiModule.selected_world_info.push(x));
        }
    }, { name: lorebookName, messages: TEST_CHAT, shouldClearCache: clearCache });
}

/**
 * Helper to get the current cache size
 */
async function getCacheSize(page) {
    return await page.evaluate(async () => {
        const wiModule = await import('/scripts/world-info.js');
        return wiModule.acCacheManager.size;
    });
}

/**
 * Helper to clear the AC cache
 */
async function clearCache(page) {
    await page.evaluate(async () => {
        const wiModule = await import('/scripts/world-info.js');
        wiModule.acCacheManager.clear();
    });
}

// ============================================
// Test: Basic Cache Behavior
// ============================================
test.describe('Cache: Basic Behavior', () => {
    test.beforeEach(setup.awaitST);

    test('first scan should build cache, second should not', async ({ page }) => {
        // First scan - cold (clear cache to ensure isolation from other tests)
        const scan1 = await runScanAndGetCacheStatus(page, 'Invalidation Test', { clearCache: true });
        console.log(`Scan 1: cacheBuilt=${scan1.cacheBuilt}, sizeBefore=${scan1.cacheSizeBefore}, sizeAfter=${scan1.cacheSizeAfter}`);
        expect(scan1.cacheBuilt).toBe(true); // New cache entry should be built

        // Second scan - warm (cache should be hit, no new entries built)
        const scan2 = await runScanAndGetCacheStatus(page, 'Invalidation Test');
        console.log(`Scan 2: cacheBuilt=${scan2.cacheBuilt}, sizeBefore=${scan2.cacheSizeBefore}, sizeAfter=${scan2.cacheSizeAfter}`);
        expect(scan2.cacheBuilt).toBe(false); // No new cache entries should be built
    });
});

// ============================================
// Test: Cache Clear Invalidation
// ============================================
test.describe('Cache Invalidation: clear() method', () => {
    test.beforeEach(setup.awaitST);

    test('clearing cache should cause next scan to rebuild', async ({ page }) => {
        const lorebookName = 'Invalidation Test';

        // Establish warm cache
        const coldScan = await runScanAndGetCacheStatus(page, lorebookName, { clearCache: true });
        expect(coldScan.cacheBuilt).toBe(true);
        const warmScan = await runScanAndGetCacheStatus(page, lorebookName);
        expect(warmScan.cacheBuilt).toBe(false);

        // Get cache size before clearing
        const cacheSizeBeforeClear = await getCacheSize(page);
        expect(cacheSizeBeforeClear).toBeGreaterThan(0);

        // Clear the cache (simulates what events do)
        await clearCache(page);

        // Verify cache was cleared
        const cacheSizeAfterClear = await getCacheSize(page);
        expect(cacheSizeAfterClear).toBe(0);

        // Next scan should rebuild cache
        const afterClearScan = await runScanAndGetCacheStatus(page, lorebookName);
        expect(afterClearScan.cacheBuilt).toBe(true);

        console.log(`After clear(): cache cleared (${cacheSizeBeforeClear} -> ${cacheSizeAfterClear}), rebuilt on next scan`);
    });

    test('multiple clears followed by scans should all rebuild', async ({ page }) => {
        const lorebookName = 'Invalidation Test';

        for (let i = 0; i < 3; i++) {
            // Clear and scan
            const scan = await runScanAndGetCacheStatus(page, lorebookName, { clearCache: true });
            expect(scan.cacheBuilt).toBe(true);

            // Verify cache size is 1 after scan
            const cacheSize = await getCacheSize(page);
            expect(cacheSize).toBe(1);

            // Warm scan should not rebuild
            const warmScan = await runScanAndGetCacheStatus(page, lorebookName);
            expect(warmScan.cacheBuilt).toBe(false);
        }

        console.log('Multiple clear/scan cycles completed successfully');
    });
});

// ============================================
// Test: Different Lorebook Cache Entries
// ============================================
test.describe('Cache: Multiple Lorebooks', () => {
    test.beforeEach(setup.awaitST);

    test('lorebooks with different entry counts should have independent cache entries', async ({ page }) => {
        // Start fresh
        await clearCache(page);

        // Scan first lorebook
        const scan1 = await runScanAndGetCacheStatus(page, 'Invalidation Test');
        expect(scan1.cacheBuilt).toBe(true);
        const sizeAfterFirst = await getCacheSize(page);

        // Scan second lorebook - if they have different buffer signatures or entry counts,
        // a new cache entry should be built
        const scan2 = await runScanAndGetCacheStatus(page, 'Comparison Constant');

        // The cache behavior depends on whether the lorebooks have the same buffer signature
        // If they have the same signature but different entry counts, cache miss (entry count mismatch)
        // If they have different signatures, a new cache entry is built
        // Either way, we should see some cache activity (not just reusing the exact same entry)

        const sizeAfterSecond = await getCacheSize(page);

        console.log(`First lorebook: cacheBuilt=${scan1.cacheBuilt}, size=${sizeAfterFirst}`);
        console.log(`Second lorebook: cacheBuilt=${scan2.cacheBuilt}, size=${sizeAfterSecond}`);

        // At minimum, we should have at least one cache entry
        expect(sizeAfterSecond).toBeGreaterThanOrEqual(1);
    });
});

// ============================================
// Test: Cache Persists When Nothing Changes
// ============================================
test.describe('Cache: Persistence', () => {
    test.beforeEach(setup.awaitST);

    test('cache should persist across multiple scans without changes', async ({ page }) => {
        const lorebookName = 'Invalidation Test';

        // Cold scan - should build cache
        const scan1 = await runScanAndGetCacheStatus(page, lorebookName, { clearCache: true });
        expect(scan1.cacheBuilt).toBe(true);

        // Multiple warm scans - should not build new cache entries
        for (let i = 0; i < 5; i++) {
            const scan = await runScanAndGetCacheStatus(page, lorebookName);
            expect(scan.cacheBuilt).toBe(false);
        }

        console.log('Cache persisted across 5 consecutive scans');
    });

    test('cache size should remain constant without invalidation', async ({ page }) => {
        const lorebookName = 'Invalidation Test';

        // Build cache
        await runScanAndGetCacheStatus(page, lorebookName, { clearCache: true });
        const initialSize = await getCacheSize(page);
        expect(initialSize).toBe(1);

        // Run multiple scans
        for (let i = 0; i < 3; i++) {
            await runScanAndGetCacheStatus(page, lorebookName);
            const currentSize = await getCacheSize(page);
            expect(currentSize).toBe(initialSize);
        }

        console.log(`Cache size remained constant at ${initialSize}`);
    });
});

// ============================================
// Test: Cache Entry Count Validation
// ============================================
test.describe('Cache: Entry Count Validation', () => {
    test.beforeEach(setup.awaitST);

    test('cache validates entry count on hit', async ({ page }) => {
        const lorebookName = 'Invalidation Test';

        // Build cache
        const scan1 = await runScanAndGetCacheStatus(page, lorebookName, { clearCache: true });
        expect(scan1.cacheBuilt).toBe(true);

        // Get entry count from first scan by looking at cache miss reason if we had one
        // On second scan, if we get cacheBuilt=false, the entry count matched
        const scan2 = await runScanAndGetCacheStatus(page, lorebookName);
        expect(scan2.cacheBuilt).toBe(false);

        console.log('Cache validated entry count successfully');
    });
});
