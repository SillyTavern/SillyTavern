/**
 * World Info Character Filter Tests
 *
 * Tests character-based filtering logic including include/exclude by name and tag.
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

/**
 * Helper function to compare AC vs Legacy matching results with character context.
 */
async function compareACvsLegacy(page, lorebookName, chatMessages, globalScanData = {}, description = '') {
    return await page.evaluate(async ({ name, messages, data, desc }) => {
        const wiModule = await import('/scripts/world-info.js');

        // Create a seeded random function for deterministic group selection
        function seededRandom(seed) {
            let t = seed += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }

        function mockRandomWithSeed(seed) {
            let currentSeed = seed;
            const originalRandom = Math.random;
            Math.random = function() {
                currentSeed++;
                return seededRandom(currentSeed);
            };
            return () => {
                Math.random = originalRandom;
            };
        }

        async function runWithAC(useAC) {
            const restoreRandom = mockRandomWithSeed(12345);
            const savedSelectedWorldInfo = [...wiModule.selected_world_info];

            try {
                wiModule.worldInfoCache.delete(name);
                const lorebookData = await wiModule.loadWorldInfo(name);

                if (!lorebookData) {
                    return { error: `Failed to load lorebook: ${name}` };
                }

                wiModule.setWorldInfoUseAhoCorasick(useAC);
                wiModule.setWorldInfoRecursive(true);

                wiModule.selected_world_info.length = 0;
                wiModule.selected_world_info.push(name);

                const scanData = {
                    personaDescription: data.personaDescription || '',
                    characterDescription: data.characterDescription || '',
                    characterPersonality: data.characterPersonality || '',
                    characterDepthPrompt: data.characterDepthPrompt || '',
                    scenario: data.scenario || '',
                    creatorNotes: data.creatorNotes || '',
                    trigger: data.trigger || 'normal',
                };

                const chat = [...messages].reverse();
                const maxContext = data.maxContext || 8192;

                const result = await wiModule.checkWorldInfo(chat, maxContext, true, scanData);

                const activatedUids = result.allActivatedEntries
                    ? Array.from(result.allActivatedEntries.keys())
                    : [];
                const activatedUidsSorted = [...activatedUids].sort((a, b) => a - b);

                return {
                    activatedUids,
                    activatedUidsSorted,
                    content: (result.worldInfoBefore + result.worldInfoAfter).trim(),
                    activatedCount: activatedUids.length,
                };
            } finally {
                restoreRandom();
                wiModule.selected_world_info.length = 0;
                savedSelectedWorldInfo.forEach(x => wiModule.selected_world_info.push(x));
            }
        }

        try {
            const legacyResult = await runWithAC(false);
            const acResult = await runWithAC(true);

            const sameSet = legacyResult.activatedUidsSorted.join(',') === acResult.activatedUidsSorted.join(',');
            const sameOrder = legacyResult.activatedUids.join(',') === acResult.activatedUids.join(',');

            return {
                legacy: legacyResult,
                ac: acResult,
                match: sameSet,
                orderMatch: sameOrder,
                contentMatch: legacyResult.content === acResult.content,
                description: desc,
            };
        } catch (e) {
            return { error: e.message, stack: e.stack };
        }
    }, { name: lorebookName, messages: chatMessages, data: globalScanData, desc: description });
}

// ============================================
// Character Filter Tests - Include by Name
// ============================================
test.describe('Character Filters: Include by Name', () => {
    test.beforeEach(setup.awaitST);

    test('1.1 Include by name - matching character should activate', async ({ page }) => {
        // Note: Character filter tests require proper character context setup
        // These tests verify AC vs Legacy consistency for character filter logic
        const result = await compareACvsLegacy(
            page,
            'Comparison Character Filters',
            ['charfilter_include_name mentioned'],
            {},
            'Include by name - matching character',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`1.1 Include by name match: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('1.2 Include by name - different character skipped', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Character Filters',
            ['charfilter_include_name OtherChar context'],
            {},
            'Include by name - different character',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`1.2 Include by name diff: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });
});

// ============================================
// Character Filter Tests - Exclude by Name
// ============================================
test.describe('Character Filters: Exclude by Name', () => {
    test.beforeEach(setup.awaitST);

    test('1.3 Exclude by name - matching character skipped', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Character Filters',
            ['charfilter_exclude_name with TestChar'],
            {},
            'Exclude by name - matching character',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`1.3 Exclude by name match: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('1.4 Exclude by name - different character activates', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Character Filters',
            ['charfilter_exclude_name with different context'],
            {},
            'Exclude by name - different character',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`1.4 Exclude by name diff: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });
});

// ============================================
// Character Filter Tests - Include by Tag
// ============================================
test.describe('Character Filters: Include by Tag', () => {
    test.beforeEach(setup.awaitST);

    test('1.5 Include by tag - character has tag activates', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Character Filters',
            ['charfilter_include_tag with fantasy tag'],
            {},
            'Include by tag - character has tag',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`1.5 Include by tag match: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('1.6 Include by tag - character lacks tag skipped', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Character Filters',
            ['charfilter_include_tag scifi context'],
            {},
            'Include by tag - character lacks tag',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`1.6 Include by tag lack: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });
});

// ============================================
// Character Filter Tests - Exclude by Tag
// ============================================
test.describe('Character Filters: Exclude by Tag', () => {
    test.beforeEach(setup.awaitST);

    test('1.7 Exclude by tag - character has tag skipped', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Character Filters',
            ['charfilter_exclude_tag fantasy context'],
            {},
            'Exclude by tag - character has tag',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`1.7 Exclude by tag has: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('1.8 Exclude by tag - character lacks tag activates', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Character Filters',
            ['charfilter_exclude_tag different context'],
            {},
            'Exclude by tag - character lacks tag',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`1.8 Exclude by tag lack: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });
});

// ============================================
// Character Filter Tests - Empty Arrays
// ============================================
test.describe('Character Filters: Empty Arrays', () => {
    test.beforeEach(setup.awaitST);

    test('1.9 Empty names array activates (no filter)', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Character Filters',
            ['charfilter_empty_names mentioned'],
            {},
            'Empty names array',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        // Entry with empty names array should activate
        expect(result.legacy.content).toContain('[EMPTY_NAMES]');
        console.log(`1.9 Empty names: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('1.10 Empty tags array activates (no filter)', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Character Filters',
            ['charfilter_empty_tags mentioned'],
            {},
            'Empty tags array',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        expect(result.legacy.content).toContain('[EMPTY_TAGS]');
        console.log(`1.10 Empty tags: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });
});

// ============================================
// Character Filter Tests - Combined Names+Tags
// ============================================
test.describe('Character Filters: Combined', () => {
    test.beforeEach(setup.awaitST);

    test('1.11 Names + tags combined (both match) activates', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Character Filters',
            ['charfilter_both_match in context'],
            {},
            'Names + tags combined - both match',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`1.11 Both match: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('1.12 Names + tags combined (name matches, tag doesnt)', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Character Filters',
            ['charfilter_name_match_tag_no context'],
            {},
            'Names + tags - name matches, tag doesnt',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`1.12 Name yes tag no: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('1.12b Exclude: name matches, tag doesnt', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Character Filters',
            ['charfilter_exclude_name_match_tag_no context'],
            {},
            'Exclude - name matches, tag doesnt',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`1.12b Exclude name yes tag no: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });
});

// ============================================
// Character Filter Tests - No Tags Character
// ============================================
test.describe('Character Filters: No Tags', () => {
    test.beforeEach(setup.awaitST);

    test('1.13 Character with no tags (tagMapEntry undefined)', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Character Filters',
            ['charfilter_no_tags_char mentioned'],
            {},
            'Character with no tags',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`1.13 No tags: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('1.14 Character with empty tag array', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Character Filters',
            ['charfilter_empty_tag_array mentioned'],
            {},
            'Character with empty tag array',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`1.14 Empty tag array: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });
});

// ============================================
// Character Filter Tests - Multiple Names/Tags
// ============================================
test.describe('Character Filters: Multiple', () => {
    test.beforeEach(setup.awaitST);

    test('1.15 Multiple names in filter - one matches activates', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Character Filters',
            ['charfilter_multi_names with TestChar'],
            {},
            'Multiple names in filter',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`1.15 Multi names: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('1.16 Multiple tags in filter - one matches activates', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Character Filters',
            ['charfilter_multi_tags with fantasy'],
            {},
            'Multiple tags in filter',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`1.16 Multi tags: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('No character filter defined activates for all', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Character Filters',
            ['charfilter_no_filter mentioned'],
            {},
            'No character filter',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        expect(result.legacy.content).toContain('[NO_FILTER]');
        console.log(`No filter: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('Exclude multiple names', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Character Filters',
            ['charfilter_exclude_multi_names mentioned'],
            {},
            'Exclude multiple names',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`Exclude multi names: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('Exclude multiple tags', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Character Filters',
            ['charfilter_exclude_multi_tags mentioned'],
            {},
            'Exclude multiple tags',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`Exclude multi tags: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });
});
