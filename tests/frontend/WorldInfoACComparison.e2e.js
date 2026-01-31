/**
 * World Info AC vs Legacy Comparison Tests
 *
 * Verifies that Aho-Corasick matching produces identical results to legacy matching.
 * Each test runs with AC OFF then AC ON and compares results.
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
 * Helper function to compare AC vs Legacy matching results.
 * Runs checkWorldInfo with AC off, then with AC on, and verifies identical results.
 */
async function compareACvsLegacy(page, lorebookName, chatMessages, globalScanData = {}, description = '') {
    return await page.evaluate(async ({ name, messages, data, desc }) => {
        const wiModule = await import('/scripts/world-info.js');

        // Create a seeded random function for deterministic group selection
        // Uses mulberry32 PRNG algorithm
        function seededRandom(seed) {
            let t = seed += 0x6D2B79F5;
            t = Math.imul(t ^ t >>> 15, t | 1);
            t ^= t + Math.imul(t ^ t >>> 7, t | 61);
            return ((t ^ t >>> 14) >>> 0) / 4294967296;
        }

        // Mock Math.random with seeded version
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

        // Helper to run checkWorldInfo with given AC setting
        async function runWithAC(useAC) {
            // Mock Math.random with same seed for both runs
            const restoreRandom = mockRandomWithSeed(12345);

            // Save and clear selected_world_info to isolate test
            const savedSelectedWorldInfo = [...wiModule.selected_world_info];

            try {
                // Clear cache and reload lorebook
                wiModule.worldInfoCache.delete(name);
                const lorebookData = await wiModule.loadWorldInfo(name);

                if (!lorebookData) {
                    return { error: `Failed to load lorebook: ${name}` };
                }

                // Debug: log lorebook entry count
                const entryCount = Object.keys(lorebookData.entries || {}).length;
                console.log(`[DEBUG] Loaded lorebook ${name} with ${entryCount} entries`);

                // Set AC mode
                wiModule.setWorldInfoUseAhoCorasick(useAC);

                // Enable recursion for proper WI behavior
                wiModule.setWorldInfoRecursive(true);

                // Clear and set only our test lorebook
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

                // Get activated UIDs preserving insertion order (no sorting!)
                const activatedUids = result.allActivatedEntries
                    ? Array.from(result.allActivatedEntries.keys())
                    : [];

                // Also get sorted UIDs for set comparison (ignoring order)
                const activatedUidsSorted = [...activatedUids].sort((a, b) => a - b);

                return {
                    activatedUids,
                    activatedUidsSorted,
                    content: (result.worldInfoBefore + result.worldInfoAfter).trim(),
                    activatedCount: activatedUids.length,
                    lorebookEntryCount: Object.keys(lorebookData.entries || {}).length,
                    selectedWorldInfo: [...wiModule.selected_world_info],
                };
            } finally {
                // Restore original Math.random
                restoreRandom();
                // Restore original selected_world_info
                wiModule.selected_world_info.length = 0;
                savedSelectedWorldInfo.forEach(x => wiModule.selected_world_info.push(x));
            }
        }

        try {
            // Run with Legacy (AC off)
            const legacyResult = await runWithAC(false);

            // Run with AC (AC on)
            const acResult = await runWithAC(true);

            // Check if same entries activated (ignoring order)
            const sameSet = legacyResult.activatedUidsSorted.join(',') === acResult.activatedUidsSorted.join(',');

            // Check if order is also identical
            const sameOrder = legacyResult.activatedUids.join(',') === acResult.activatedUids.join(',');

            return {
                legacy: legacyResult,
                ac: acResult,
                match: sameSet,           // Same entries (backward compatible)
                orderMatch: sameOrder,     // Same order
                fullMatch: sameSet && sameOrder, // Both set and order match
                contentMatch: legacyResult.content === acResult.content,
                description: desc,
            };
        } catch (e) {
            return { error: e.message, stack: e.stack };
        }
    }, { name: lorebookName, messages: chatMessages, data: globalScanData, desc: description });
}

// ============================================
// Test: Constant Entries (bypass both paths)
// ============================================
test.describe('AC Comparison: Constant Entries', () => {
    test.beforeEach(setup.awaitST);

    test('constant entries should activate identically', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Constant',
            ['Random text with no keywords at all'],
            {},
            'Constant entries bypass keyword matching',
        );

        expect(result.error).toBeUndefined();
        expect(result.legacy.activatedCount).toBeGreaterThan(0);
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`Constant entries: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}, Order match: ${result.orderMatch ? '✓' : '✗'}`);
    });
});

// ============================================
// Test: Regex Entries (bypass AC, use legacy for both)
// ============================================
test.describe('AC Comparison: Regex Entries', () => {
    test.beforeEach(setup.awaitST);

    test('regex entries should match identically', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Regex',
            ['The dragon123 flew over test456 items'],
            {},
            'Regex patterns bypass AC path',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`Regex entries: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}, Order: ${result.orderMatch ? '✓' : '✗'}`);
    });

    test('mixed regex and plaintext should match identically', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Regex',
            ['The dragon attacks with fire123'],
            {},
            'Mixed regex and plaintext keywords',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
    });
});

// ============================================
// Test: Case Sensitive Primary Keys
// ============================================
test.describe('AC Comparison: Case Sensitive', () => {
    test.beforeEach(setup.awaitST);

    test('case sensitive match with correct case', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Case Sensitive',
            ['The Knight arrived at the Castle'],
            {},
            'Case sensitive with correct case',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`Case sensitive (correct): Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('case sensitive match with wrong case should not match', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Case Sensitive',
            ['the knight arrived at the castle'],
            {},
            'Case sensitive with wrong case',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        // Should have fewer matches than correct case test
        console.log(`Case sensitive (wrong): Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('case sensitive mixed case input', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Case Sensitive',
            ['The KNIGHT attacked the Knight at the castle'],
            {},
            'Mixed case variations',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
    });
});

// ============================================
// Test: Case Insensitive Primary Keys
// ============================================
test.describe('AC Comparison: Case Insensitive', () => {
    test.beforeEach(setup.awaitST);

    test('case insensitive should match any case', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Test Lorebook',
            ['ALICE went to the store with alice and Alice'],
            {},
            'Case insensitive matching',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        expect(result.legacy.activatedCount).toBeGreaterThan(0);
        console.log(`Case insensitive: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });
});

// ============================================
// Test: Secondary Keys - All Logic Types
// ============================================
test.describe('AC Comparison: Secondary Keys', () => {
    test.beforeEach(setup.awaitST);

    test('AND_ANY - primary + any secondary', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Secondary Keys',
            ['The wizard holds a wand in the tower'],
            {},
            'AND_ANY logic',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`AND_ANY: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('AND_ANY - primary only should not match', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Secondary Keys',
            ['The wizard stands alone without any tools'],
            {},
            'AND_ANY without secondary',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
    });

    test('AND_ALL - primary + all secondary', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Secondary Keys',
            ['The knight wears armor and carries a sword into battle'],
            {},
            'AND_ALL logic - all keys present',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`AND_ALL complete: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('AND_ALL - missing secondary should not match', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Secondary Keys',
            ['The knight wears armor but forgot his weapon'],
            {},
            'AND_ALL logic - missing secondary',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
    });

    test('NOT_ANY - primary without any secondary', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Secondary Keys',
            ['The elf appears gracefully from the forest'],
            {},
            'NOT_ANY logic - no secondary',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`NOT_ANY clean: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('NOT_ANY - with secondary should not match', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Secondary Keys',
            ['The evil elf lurks in the shadows'],
            {},
            'NOT_ANY logic - secondary present',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
    });

    test('NOT_ALL - partial secondary match should activate', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Secondary Keys',
            ['The evil dwarf crafts weapons'],
            {},
            'NOT_ALL logic - partial secondary',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`NOT_ALL partial: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('NOT_ALL - all secondary should not match', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Secondary Keys',
            ['The evil dark dwarf emerges from the cave'],
            {},
            'NOT_ALL logic - all secondary present',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
    });
});

// ============================================
// Test: Recursion Strategies
// ============================================
test.describe('AC Comparison: Recursion', () => {
    test.beforeEach(setup.awaitST);

    test('basic recursion chain', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Recursion',
            ['recursion_start begins here'],
            {},
            'Basic recursion chain',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`Recursion chain: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}, Order: ${result.orderMatch ? '✓' : '✗'}`);
    });

    test('excludeRecursion entry', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Recursion',
            ['exclude_recursion_trigger mentioned'],
            {},
            'Entry with excludeRecursion=true',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
    });

    test('preventRecursion entry', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Recursion',
            ['prevent_recursion_trigger test'],
            {},
            'Entry with preventRecursion=true',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
    });

    test('delayUntilRecursion entry', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Recursion',
            ['delay_recursion_trigger mentioned'],
            {},
            'Entry with delayUntilRecursion',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
    });

    test('excludeRecursion entry should not activate during recursion', async ({ page }) => {
        // Source activates on turn 1, its content contains target's keyword
        // Target has excludeRecursion=true, so it should NOT activate via recursion
        const result = await compareACvsLegacy(
            page,
            'Comparison Recursion',
            ['exclude_test_trigger mentioned'],
            {},
            'excludeRecursion behavior',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        // Source should activate (turn 1)
        expect(result.legacy.content).toContain('[EXCLUDE_TEST_SOURCE]');
        expect(result.ac.content).toContain('[EXCLUDE_TEST_SOURCE]');
        // Target should NOT activate (excludeRecursion=true prevents recursion activation)
        expect(result.legacy.content).not.toContain('[EXCLUDE_TEST_TARGET]');
        expect(result.ac.content).not.toContain('[EXCLUDE_TEST_TARGET]');
        console.log(`excludeRecursion: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('delayUntilRecursion should NOT activate on turn 1', async ({ page }) => {
        // Keyword directly in chat - entry should NOT activate because delayUntilRecursion=1
        const result = await compareACvsLegacy(
            page,
            'Comparison Recursion',
            ['delay_target_keyword is directly in chat'],
            {},
            'delayUntilRecursion turn 1',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        // Entry should NOT activate on turn 1
        expect(result.legacy.content).not.toContain('[DELAY_TARGET]');
        expect(result.ac.content).not.toContain('[DELAY_TARGET]');
        console.log(`delayUntilRecursion turn 1: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('delayUntilRecursion SHOULD activate on turn 2 via recursion', async ({ page }) => {
        // Source triggers the delayed entry's keyword via recursion
        const result = await compareACvsLegacy(
            page,
            'Comparison Recursion',
            ['delay_source_trigger activates'],
            {},
            'delayUntilRecursion turn 2',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        // Source should activate on turn 1
        expect(result.legacy.content).toContain('[DELAY_SOURCE]');
        expect(result.ac.content).toContain('[DELAY_SOURCE]');
        // Delayed entry SHOULD activate on turn 2 (triggered by source's content)
        expect(result.legacy.content).toContain('[DELAY_TARGET]');
        expect(result.ac.content).toContain('[DELAY_TARGET]');
        console.log(`delayUntilRecursion turn 2: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('delayUntilRecursion should NOT match original text even when other entries trigger recursion', async ({ page }) => {
        // Scenario: Chat contains both keywords, but the other entry's content doesn't mention delay keyword
        // Entry A: keyword "unrelated_recursion_trigger", content: "[UNRELATED_RECURSION] ... no delay keyword"
        // Entry B: keyword "delay_target_keyword", delayUntilRecursion=1
        // Expected: Entry A activates (turn 1), recursion happens, but Entry B should NOT activate
        // because its keyword only appears in original chat, not in Entry A's recursion content
        const result = await compareACvsLegacy(
            page,
            'Comparison Recursion',
            ['unrelated_recursion_trigger and delay_target_keyword both in chat'],
            {},
            'delayUntilRecursion vs unrelated recursion',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        // The unrelated entry SHOULD activate (its keyword is in chat)
        expect(result.legacy.content).toContain('[UNRELATED_RECURSION]');
        expect(result.ac.content).toContain('[UNRELATED_RECURSION]');
        // But delay_target_keyword entry should NOT activate - keyword is only in original chat,
        // not in the recursion buffer (unrelated entry's content)
        expect(result.legacy.content).not.toContain('[DELAY_TARGET]');
        expect(result.ac.content).not.toContain('[DELAY_TARGET]');
        console.log(`delayUntilRecursion vs unrelated: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('preventRecursion should stop chain', async ({ page }) => {
        // The prevent_recursion_trigger entry contains "prevent_next" in its content
        // but has preventRecursion=true, so prevent_next should NOT activate via recursion
        const result = await compareACvsLegacy(
            page,
            'Comparison Recursion',
            ['prevent_recursion_trigger mentioned'],
            {},
            'preventRecursion behavior',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        // Source activates, but chain should be stopped
        expect(result.legacy.content).toContain('[PREVENT_RECURSION_SOURCE]');
        expect(result.legacy.content).not.toContain('[PREVENT_NEXT]');
        expect(result.ac.content).toContain('[PREVENT_RECURSION_SOURCE]');
        expect(result.ac.content).not.toContain('[PREVENT_NEXT]');
    });
});

// ============================================
// Test: Decorators (@@activate, @@dont_activate)
// ============================================
test.describe('AC Comparison: Decorators', () => {
    test.beforeEach(setup.awaitST);

    test('@@activate decorator forces activation', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Decorators',
            ['Random text mentioning nothing special'],
            {},
            '@@activate decorator',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`@@activate: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('@@dont_activate decorator prevents activation', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Decorators',
            ['The dont_activate_keyword is here'],
            {},
            '@@dont_activate decorator',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
    });
});

// ============================================
// Test: Complex Lorebook (All Features Combined)
// ============================================
test.describe('AC Comparison: Complex Lorebook', () => {
    test.beforeEach(setup.awaitST);

    test('complex lorebook with all features', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Complex',
            [
                'The Knight entered the tavern near the forest.',
                'A wizard with a staff and a wand appeared.',
                'The graceful elf watched from the corner.',
                'A dragon123 was spotted near the village.',
            ],
            {},
            'Complex lorebook with all features',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`Complex lorebook: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}, Order: ${result.orderMatch ? '✓' : '✗'}`);
    });

    test('complex lorebook with long chat history', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Complex',
            [
                'The weary traveler pushed open the heavy oak door of the tavern.',
                'The knight stood at the entrance to the dungeon, sword drawn.',
                'In the heart of the mountain, the dwarf blacksmith hammered away.',
                'The necromancer\'s tower loomed against the stormy sky.',
                'A dragon was spotted flying over the kingdom.',
                'The wizard cast a powerful spell with his staff.',
                'The elf ranger tracked the enemy through the forest.',
            ],
            {},
            'Complex lorebook with realistic chat history',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`Complex realistic: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}, Order: ${result.orderMatch ? '✓' : '✗'}`);
    });
});

// ============================================
// Test: Multiple Active Lorebooks
// ============================================
test.describe('AC Comparison: Multiple Lorebooks', () => {
    test.beforeEach(setup.awaitST);

    test('multiple lorebooks produce identical combined results', async ({ page }) => {
        const result = await page.evaluate(async ({ messages }) => {
            const wiModule = await import('/scripts/world-info.js');

            const lorebooks = ['Comparison Case Sensitive', 'Comparison Regex', 'Comparison Constant'];

            async function runWithAC(useAC) {
                // Clear all caches and reload lorebooks
                for (const name of lorebooks) {
                    wiModule.worldInfoCache.delete(name);
                    await wiModule.loadWorldInfo(name);
                }

                wiModule.setWorldInfoUseAhoCorasick(useAC);

                // Add all lorebooks to selected
                for (const name of lorebooks) {
                    if (!wiModule.selected_world_info.includes(name)) {
                        wiModule.selected_world_info.push(name);
                    }
                }

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
                const result = await wiModule.checkWorldInfo(chat, 8192, true, scanData);

                // Cleanup
                wiModule.selected_world_info = wiModule.selected_world_info.filter(x => !lorebooks.includes(x));

                // Get activated UIDs preserving insertion order (no sorting!)
                const activatedUids = result.allActivatedEntries
                    ? Array.from(result.allActivatedEntries.keys())
                    : [];

                // Also get sorted UIDs for set comparison (ignoring order)
                const activatedUidsSorted = [...activatedUids].sort((a, b) => a - b);

                return {
                    activatedUids,
                    activatedUidsSorted,
                    content: (result.worldInfoBefore + result.worldInfoAfter).trim(),
                    activatedCount: activatedUids.length,
                };
            }

            try {
                const legacyResult = await runWithAC(false);
                const acResult = await runWithAC(true);

                // Check if same entries activated (ignoring order)
                const sameSet = legacyResult.activatedUidsSorted.join(',') === acResult.activatedUidsSorted.join(',');

                // Check if order is also identical
                const sameOrder = legacyResult.activatedUids.join(',') === acResult.activatedUids.join(',');

                return {
                    legacy: legacyResult,
                    ac: acResult,
                    match: sameSet,
                    orderMatch: sameOrder,
                    contentMatch: legacyResult.content === acResult.content,
                };
            } catch (e) {
                return { error: e.message, stack: e.stack };
            }
        }, { messages: ['The Knight arrived with a dragon123 companion'] });

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`Multiple lorebooks: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}, Order match: ${result.orderMatch ? '✓' : '✗'}`);
    });
});

// ============================================
// Test: Edge Cases
// ============================================
test.describe('AC Comparison: Edge Cases', () => {
    test.beforeEach(setup.awaitST);

    test('empty chat should produce identical results', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Constant',
            [],
            {},
            'Empty chat',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
    });

    test('very long message should produce identical results', async ({ page }) => {
        const longMessage = 'A'.repeat(5000) + ' Knight ' + 'B'.repeat(5000);
        const result = await compareACvsLegacy(
            page,
            'Comparison Case Sensitive',
            [longMessage],
            {},
            'Very long message',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
    });

    test('unicode keywords should produce identical results', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Test Lorebook',
            ['日本語のテストです'],
            {},
            'Unicode keywords',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
    });

    test('special characters in chat should produce identical results', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Test Lorebook',
            ['Testing $pecial characters & symbols!'],
            {},
            'Special characters',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
    });
});

// ============================================
// Test: Per-Entry Scan Depth
// ============================================
test.describe('AC Comparison: Scan Depth', () => {
    test.beforeEach(setup.awaitST);

    test('entries with different scan depths', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Scan Depth',
            [
                'Message at depth 0 with depth_1_keyword.',
                'Message at depth 1 with depth_2_keyword.',
                'Message at depth 2 with depth_3_keyword.',
                'Message at depth 3 with global_depth_keyword.',
            ],
            {},
            'Per-entry scan depths',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`Scan depth: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });
});

// ============================================
// Test: Timed Effects (sticky, cooldown, delay)
// ============================================
test.describe('AC Comparison: Timed Effects', () => {
    test.beforeEach(setup.awaitST);

    test('sticky entries should match identically', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Timed Effects',
            ['sticky_1_keyword and sticky_3_keyword mentioned'],
            {},
            'Sticky entries',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`Sticky: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('cooldown entries should match identically', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Timed Effects',
            ['cooldown_2_keyword mentioned here'],
            {},
            'Cooldown entries',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
    });

    test('delay entries should match identically', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Timed Effects',
            ['delay_1_keyword in the message'],
            {},
            'Delay entries',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
    });

    test('combined timed effects should match identically', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Timed Effects',
            ['sticky_cooldown_keyword is here'],
            {},
            'Combined sticky + cooldown',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
    });
});

// ============================================
// Test: Probability
// ============================================
test.describe('AC Comparison: Probability', () => {
    test.beforeEach(setup.awaitST);

    test('0% probability should never activate', async ({ page }) => {
        // Run multiple times to verify 0% never activates
        const results = await page.evaluate(async ({ messages }) => {
            const wiModule = await import('/scripts/world-info.js');
            const name = 'Comparison Probability';

            const scanData = {
                personaDescription: '', characterDescription: '', characterPersonality: '',
                characterDepthPrompt: '', scenario: '', creatorNotes: '', trigger: 'normal',
            };
            const chat = [...messages].reverse();

            const legacyResults = [];
            const acResults = [];

            for (let i = 0; i < 5; i++) {
                // Legacy
                wiModule.worldInfoCache.delete(name);
                await wiModule.loadWorldInfo(name);
                wiModule.setWorldInfoUseAhoCorasick(false);
                if (!wiModule.selected_world_info.includes(name)) {
                    wiModule.selected_world_info.push(name);
                }
                const legacyResult = await wiModule.checkWorldInfo(chat, 8192, true, scanData);
                const legacyContent = legacyResult.worldInfoBefore + legacyResult.worldInfoAfter;
                legacyResults.push(legacyContent.includes('[PROB_0]'));
                wiModule.selected_world_info = wiModule.selected_world_info.filter(x => x !== name);

                // AC
                wiModule.worldInfoCache.delete(name);
                await wiModule.loadWorldInfo(name);
                wiModule.setWorldInfoUseAhoCorasick(true);
                if (!wiModule.selected_world_info.includes(name)) {
                    wiModule.selected_world_info.push(name);
                }
                const acResult = await wiModule.checkWorldInfo(chat, 8192, true, scanData);
                const acContent = acResult.worldInfoBefore + acResult.worldInfoAfter;
                acResults.push(acContent.includes('[PROB_0]'));
                wiModule.selected_world_info = wiModule.selected_world_info.filter(x => x !== name);
            }

            return {
                legacyActivations: legacyResults.filter(x => x).length,
                acActivations: acResults.filter(x => x).length,
            };
        }, { messages: ['prob_zero_keyword is mentioned'] });

        expect(results.legacyActivations).toBe(0);
        expect(results.acActivations).toBe(0);
        console.log(`0% probability: Legacy=${results.legacyActivations}/5, AC=${results.acActivations}/5`);
    });

    test('100% probability should always activate', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Probability',
            ['prob_hundred_keyword mentioned'],
            {},
            '100% probability',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        expect(result.legacy.content).toContain('[PROB_100]');
        expect(result.ac.content).toContain('[PROB_100]');
    });

    test('useProbability false should always activate regardless of probability value', async ({ page }) => {
        // Test that when useProbability is false, the probability value is ignored
        // and entries always activate - both AC and legacy should behave the same
        const result = await compareACvsLegacy(
            page,
            'Comparison Probability',
            ['prob_disabled_zero prob_disabled_fifty prob_disabled_15 prob_disabled_16 prob_disabled_17'],
            {},
            'useProbability=false',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);

        // All these should activate because useProbability is false
        expect(result.legacy.content).toContain('[PROB_DISABLED_0]');
        expect(result.legacy.content).toContain('[PROB_DISABLED_50]');
        expect(result.ac.content).toContain('[PROB_DISABLED_0]');
        expect(result.ac.content).toContain('[PROB_DISABLED_50]');

        // Verify count matches
        console.log(`useProbability=false: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });
});

// ============================================
// Test: Groups and Group Weights
// ============================================
test.describe('AC Comparison: Groups', () => {
    test.beforeEach(setup.awaitST);

    test('group competition should produce identical results', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Groups',
            ['group_a_trigger is here'],
            {},
            'Group A competition',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        // Only one entry from the group should activate
        console.log(`Group A: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('multiple groups triggered should produce identical results', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Groups',
            ['group_a_trigger and group_b_trigger mentioned'],
            {},
            'Multiple groups',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`Multi-group: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('non-grouped entries should all activate', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Groups',
            ['no_group_trigger mentioned'],
            {},
            'Non-grouped entries',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        // All 3 non-grouped entries should activate
        expect(result.legacy.activatedCount).toBe(3);
        console.log(`Non-grouped: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('group scoring should produce identical results', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Groups',
            ['scoring_group_trigger here'],
            {},
            'Group scoring',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
    });
});

// ============================================
// Test: Insertion Positions
// ============================================
test.describe('AC Comparison: Positions', () => {
    test.beforeEach(setup.awaitST);

    test('position before and after should match identically', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Positions',
            ['pos_before_keyword and pos_after_keyword mentioned'],
            {},
            'Before/after positions',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`Before/After: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('AN positions should match identically', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Positions',
            ['pos_antop_keyword and pos_anbottom_keyword'],
            {},
            'AN positions',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
    });

    test('atDepth positions should match identically', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Positions',
            [
                'atdepth_0_keyword at depth 0',
                'atdepth_1_keyword at depth 1',
                'atdepth_2_keyword at depth 2',
            ],
            {},
            'At-depth positions',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
    });

    test('example message positions should match identically', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Positions',
            ['pos_emtop_keyword and pos_embottom_keyword'],
            {},
            'Example message positions',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
    });

    test('all position types combined', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Positions',
            ['pos_before_keyword pos_after_keyword pos_antop_keyword pos_atdepth_keyword'],
            {},
            'All positions',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`All positions: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });
});

// ============================================
// Test: Global Scan Data Matching
// ============================================
test.describe('AC Comparison: Global Scan Data', () => {
    test.beforeEach(setup.awaitST);

    test('persona description matching', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Global Scan',
            ['Regular chat message'],
            { personaDescription: 'This persona contains persona_match keyword' },
            'Persona description matching',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`Persona match: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('character description matching', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Global Scan',
            ['Regular chat message'],
            { characterDescription: 'Character with char_desc_match trait' },
            'Character description matching',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
    });

    test('scenario matching', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Global Scan',
            ['Regular chat message'],
            { scenario: 'A scenario with scenario_match setting' },
            'Scenario matching',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
    });

    test('chat only should not match global data', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Global Scan',
            ['Regular chat message without the keyword'],
            {
                personaDescription: 'Contains chat_only_match',
                characterDescription: 'Also contains chat_only_match',
            },
            'Chat only (no global matching)',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        // chat_only_match entry should NOT activate from global data
    });

    test('multiple global fields matching', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Global Scan',
            ['Regular chat message'],
            {
                personaDescription: 'Contains multi_global_match',
                characterDescription: 'Also has multi_global_match',
            },
            'Multiple global fields',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
    });

    test('combined chat and global data matching', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Global Scan',
            ['Message with chat_only_match keyword'],
            {
                personaDescription: 'Contains persona_match and multi_global_match',
                scenario: 'Has scenario_match',
            },
            'Combined chat and global',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`Combined: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });
});

// ============================================
// Large Scale Comparison Tests
// ============================================
test.describe('AC Comparison: Large Scale', () => {
    test.beforeEach(setup.awaitST);

    test('5k entries should produce identical results', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Benchmark 5k Realistic',
            [
                'The knight entered the tavern near the forest.',
                'A wizard appeared with a staff in hand.',
                'The dragon flew overhead.',
                'The castle loomed in the distance.',
            ],
            {},
            '5k entries comparison',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`5k entries: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}, Order: ${result.orderMatch ? '✓' : '✗'}`);
    });

    test('25k entries should produce identical results', async ({ page }) => {
        test.setTimeout(120000); // 2 minute timeout for large test

        const result = await compareACvsLegacy(
            page,
            'Benchmark 25k Realistic',
            [
                'The knight entered the tavern near the forest.',
                'A wizard appeared with a staff in hand.',
                'The dragon flew overhead.',
                'The castle loomed in the distance.',
            ],
            {},
            '25k entries comparison',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.contentMatch).toBe(true);
        console.log(`25k entries: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}, Order: ${result.orderMatch ? '✓' : '✗'}`);
    });
});
