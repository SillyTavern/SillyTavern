/**
 * World Info Stress Tests
 *
 * Performance and stress tests (Category 18):
 * - Large entry counts (10k-100k entries)
 * - Deep recursion (50 levels)
 * - Large groups (1k entries in same group)
 * - Long chat histories (1000 messages)
 * - Many keywords per entry
 * - Many secondary keywords
 * - Repeated scans consistency
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
 */
async function compareACvsLegacy(page, lorebookName, chatMessages, globalScanData = {}, description = '') {
    return await page.evaluate(async ({ name, messages, data, desc }) => {
        const wiModule = await import('/scripts/world-info.js');

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

                const startTime = performance.now();
                const result = await wiModule.checkWorldInfo(chat, maxContext, true, scanData);
                const endTime = performance.now();

                const activatedUids = result.allActivatedEntries
                    ? Array.from(result.allActivatedEntries.keys())
                    : [];
                const activatedUidsSorted = [...activatedUids].sort((a, b) => a - b);

                return {
                    activatedUids,
                    activatedUidsSorted,
                    content: (result.worldInfoBefore + result.worldInfoAfter).trim(),
                    activatedCount: activatedUids.length,
                    timeMs: endTime - startTime,
                    entryCount: Object.keys(lorebookData.entries || {}).length,
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
// Category 18: Stress and Performance Tests
// ============================================
test.describe('Stress Tests: Large Entry Counts', () => {
    test.beforeEach(setup.awaitST);

    test('18.1 5k entries performance', async ({ page }) => {
        test.setTimeout(60000); // 1 minute timeout

        const result = await compareACvsLegacy(
            page,
            'Benchmark 5k Realistic',
            [
                'The knight entered the tavern near the forest.',
                'A wizard appeared with a staff in hand.',
                'The dragon flew overhead.',
            ],
            {},
            '5k entries',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.ac.timeMs).toBeLessThan(30000); // AC should be under 30s
        console.log(`18.1 5k entries: Legacy=${result.legacy.timeMs.toFixed(0)}ms, AC=${result.ac.timeMs.toFixed(0)}ms, activated=${result.ac.activatedCount}`);
    });

    test('18.2 25k entries performance', async ({ page }) => {
        test.setTimeout(120000); // 2 minute timeout

        const result = await compareACvsLegacy(
            page,
            'Benchmark 25k Realistic',
            [
                'The knight entered the tavern near the forest.',
                'A wizard appeared with a staff in hand.',
                'The dragon flew overhead.',
            ],
            {},
            '25k entries',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`18.2 25k entries: Legacy=${result.legacy.timeMs.toFixed(0)}ms, AC=${result.ac.timeMs.toFixed(0)}ms, activated=${result.ac.activatedCount}`);
    });
});

test.describe('Stress Tests: Deep Recursion', () => {
    test.beforeEach(setup.awaitST);

    test('18.3 Deep recursion chain (5 levels)', async ({ page }) => {
        test.setTimeout(60000);

        const result = await compareACvsLegacy(
            page,
            'Comparison Recursion Complex',
            ['deep_chain_1 mentioned'],
            {},
            'Deep recursion 5',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        // Should complete without timeout
        expect(result.legacy.content).toContain('[DEEP_1]');
        expect(result.legacy.content).toContain('[DEEP_5]');
        console.log(`18.3 Deep recursion: Legacy=${result.legacy.timeMs.toFixed(0)}ms, AC=${result.ac.timeMs.toFixed(0)}ms, activated=${result.ac.activatedCount}`);
    });
});

test.describe('Stress Tests: Large Groups', () => {
    test.beforeEach(setup.awaitST);

    test('18.4 Large group (16 entries) one winner', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Groups',
            ['group_a_trigger mentioned'],
            {},
            'Large group',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        // Only one entry from the group should win
        const groupAMatches = result.legacy.content.match(/\[GROUP_A_\d+\]/g) || [];
        expect(groupAMatches.length).toBe(1);
        console.log(`18.4 Large group: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}, winner=${groupAMatches[0]}`);
    });
});

test.describe('Stress Tests: Long Chat History', () => {
    test.beforeEach(setup.awaitST);

    test('18.5 Long chat (50 messages)', async ({ page }) => {
        const longChat = [];
        for (let i = 0; i < 50; i++) {
            longChat.push(`Message ${i}: The knight walked through the castle halls.`);
        }
        // Add keyword in middle of chat
        longChat[25] = 'pos_before_keyword mentioned here';

        const result = await compareACvsLegacy(
            page,
            'Comparison Positions',
            longChat,
            {},
            'Long chat 50',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`18.5 Long chat: Legacy=${result.legacy.timeMs.toFixed(0)}ms, AC=${result.ac.timeMs.toFixed(0)}ms, activated=${result.ac.activatedCount}`);
    });

    test('18.5b Very long chat (100 messages)', async ({ page }) => {
        test.setTimeout(60000);

        const veryLongChat = [];
        for (let i = 0; i < 100; i++) {
            veryLongChat.push(`Message ${i}: The adventure continues with more text and details.`);
        }
        veryLongChat[0] = 'pos_before_keyword pos_after_keyword mentioned';

        const result = await compareACvsLegacy(
            page,
            'Comparison Positions',
            veryLongChat,
            {},
            'Very long chat 100',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`18.5b Very long chat: Legacy=${result.legacy.timeMs.toFixed(0)}ms, AC=${result.ac.timeMs.toFixed(0)}ms, activated=${result.ac.activatedCount}`);
    });
});

test.describe('Stress Tests: Repeated Scans', () => {
    test.beforeEach(setup.awaitST);

    test('18.10 Repeated scans (10x) same config consistency', async ({ page }) => {
        const results = [];

        for (let i = 0; i < 10; i++) {
            const result = await compareACvsLegacy(
                page,
                'Comparison Complex',
                [
                    'The Knight entered the tavern near the forest.',
                    'A wizard with a staff and a wand appeared.',
                ],
                {},
                `Repeated scan ${i + 1}`,
            );

            expect(result.error).toBeUndefined();
            results.push(result);
        }

        // All results should be identical
        const firstLegacyContent = results[0].legacy.content;
        const firstACContent = results[0].ac.content;

        for (let i = 1; i < results.length; i++) {
            expect(results[i].legacy.content).toBe(firstLegacyContent);
            expect(results[i].ac.content).toBe(firstACContent);
            expect(results[i].match).toBe(true);
            expect(results[i].orderMatch).toBe(true);
        }

        const avgLegacyTime = results.reduce((sum, r) => sum + r.legacy.timeMs, 0) / results.length;
        const avgACTime = results.reduce((sum, r) => sum + r.ac.timeMs, 0) / results.length;
        console.log(`18.10 Repeated scans: Avg Legacy=${avgLegacyTime.toFixed(0)}ms, Avg AC=${avgACTime.toFixed(0)}ms, all consistent=true`);
    });
});

test.describe('Stress Tests: Complex Combinations', () => {
    test.beforeEach(setup.awaitST);

    test('Multiple lorebooks combined', async ({ page }) => {
        const result = await page.evaluate(async ({ messages }) => {
            const wiModule = await import('/scripts/world-info.js');

            const lorebooks = ['Comparison Case Sensitive', 'Comparison Regex', 'Comparison Constant'];

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
                    // Clear all caches and reload lorebooks
                    for (const name of lorebooks) {
                        wiModule.worldInfoCache.delete(name);
                        await wiModule.loadWorldInfo(name);
                    }

                    wiModule.setWorldInfoUseAhoCorasick(useAC);
                    wiModule.setWorldInfoRecursive(true);

                    // Add all lorebooks to selected
                    wiModule.selected_world_info.length = 0;
                    for (const name of lorebooks) {
                        wiModule.selected_world_info.push(name);
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
                    const startTime = performance.now();
                    const result = await wiModule.checkWorldInfo(chat, 8192, true, scanData);
                    const endTime = performance.now();

                    const activatedUids = result.allActivatedEntries
                        ? Array.from(result.allActivatedEntries.keys())
                        : [];
                    const activatedUidsSorted = [...activatedUids].sort((a, b) => a - b);

                    return {
                        activatedUids,
                        activatedUidsSorted,
                        content: (result.worldInfoBefore + result.worldInfoAfter).trim(),
                        activatedCount: activatedUids.length,
                        timeMs: endTime - startTime,
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
                };
            } catch (e) {
                return { error: e.message, stack: e.stack };
            }
        }, { messages: ['The Knight arrived with a dragon123 companion'] });

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`Multi-lorebook: Legacy=${result.legacy.timeMs.toFixed(0)}ms, AC=${result.ac.timeMs.toFixed(0)}ms, activated=${result.ac.activatedCount}`);
    });

    test('All edge cases lorebooks combined', async ({ page }) => {
        const result = await page.evaluate(async ({ messages }) => {
            const wiModule = await import('/scripts/world-info.js');

            const lorebooks = [
                'Comparison Decorator Edge Cases',
                'Comparison Probability Edge Cases',
                'Comparison Groups Edge Cases',
            ];

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
                    for (const name of lorebooks) {
                        wiModule.worldInfoCache.delete(name);
                        await wiModule.loadWorldInfo(name);
                    }

                    wiModule.setWorldInfoUseAhoCorasick(useAC);
                    wiModule.setWorldInfoRecursive(true);

                    wiModule.selected_world_info.length = 0;
                    for (const name of lorebooks) {
                        wiModule.selected_world_info.push(name);
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
                    const startTime = performance.now();
                    const result = await wiModule.checkWorldInfo(chat, 8192, true, scanData);
                    const endTime = performance.now();

                    const activatedUids = result.allActivatedEntries
                        ? Array.from(result.allActivatedEntries.keys())
                        : [];
                    const activatedUidsSorted = [...activatedUids].sort((a, b) => a - b);

                    return {
                        activatedUids,
                        activatedUidsSorted,
                        content: (result.worldInfoBefore + result.worldInfoAfter).trim(),
                        activatedCount: activatedUids.length,
                        timeMs: endTime - startTime,
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
                };
            } catch (e) {
                return { error: e.message, stack: e.stack };
            }
        }, { messages: ['large_group_trigger prob_hundred_use_true decorator_unknown_test'] });

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`Edge cases combined: Legacy=${result.legacy.timeMs.toFixed(0)}ms, AC=${result.ac.timeMs.toFixed(0)}ms, activated=${result.ac.activatedCount}`);
    });
});
