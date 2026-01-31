/**
 * World Info Benchmark Tests
 *
 * Performance benchmarks for World Info scanning with various lorebook configurations.
 * Uses pre-generated benchmark lorebooks from tests/.test-data/default-user/worlds/
 *
 * To regenerate benchmark lorebooks:
 *   node tests/utils/generate-benchmark-lorebooks.js
 */
import { test, expect } from '@playwright/test';
import { generateLongRealisticChat } from '../utils/generate-benchmark-lorebooks.js';

// Pre-generate long chat for benchmarks
const LONG_REALISTIC_CHAT = generateLongRealisticChat(10000); // ~10k words

// Performance thresholds (in milliseconds)
const THRESHOLDS = {
    FAST: 500,        // Simple operations
    NORMAL: 1000,     // Standard matching
    COMPLEX: 2000,    // Recursion, groups
    HEAVY: 5000,      // Large datasets
};

// Realistic chat messages (~250 words each, containing keywords that will match)
const REALISTIC_CHAT = [
    'The weary traveler pushed open the heavy oak door of the tavern, immediately greeted by the warm glow of candlelight and the rich smell of roasting meat. The common room bustled with activity - merchants discussing trade routes, a group of soldiers sharing tales of battle, and in the corner, a hooded figure who seemed to watch everyone with keen interest. The traveler made their way to the bar, coins jingling in their pouch. "A room for the night and your finest ale," they said to the innkeeper, a stout woman with knowing eyes. Outside, the forest whispered with ancient secrets, and somewhere in the distance, a wolf howled at the rising moon. The village had seen better days, but there was still life here, still hope. Tomorrow would bring new challenges - perhaps a journey to the old castle on the hill, or maybe deeper into the wilderness where few dared to venture.',

    'The knight stood at the entrance to the dungeon, sword drawn and shield raised. Behind him, the wizard muttered incantations, arcane energy crackling between his fingers. They had traveled far to reach this forsaken place, following rumors of a dragon that had been terrorizing the kingdom for months. The princess herself had tasked them with this quest, promising treasure beyond imagination to whoever could slay the beast. Deep within the stone corridors, they could hear the scraping of claws and smell the sulfurous breath of their quarry. "Stay close," the knight whispered to their companion, a young ranger who had joined them in the village. "These caves are treacherous." The magic in the air was palpable, remnants of ancient spells cast by wizards long dead.',

    'In the heart of the mountain, the dwarf blacksmith hammered away at his forge, creating weapons of legendary quality. His armor gleamed in the firelight, a testament to his craft. Nearby, an elf healer tended to a wounded warrior, her gentle magic knitting flesh and bone back together. The temple above them had once been a place of great power, but now it lay in ruins, overrun by goblins and worse things. A merchant had warned them about the bridge being guarded by a troll, so they had taken the longer path through the cave. The potion master had given them vials of healing liquid, precious supplies for the journey ahead. Outside, a horse whinnied nervously, sensing the danger that lurked in the shadows.',

    'The necromancer\'s tower loomed against the stormy sky, lightning illuminating its twisted spires. Within its walls, dark rituals had been performed, raising an army of the dead to serve a malevolent purpose. A paladin had been sent to cleanse this evil, accompanied by a thief whose skills would be needed to bypass the magical wards. They spoke of demons and angels, of the eternal battle between light and darkness. An orc warband had been spotted near the river, adding another threat to their mission. The giant stone guardians at the tower\'s base remained motionless for now, but everyone knew they would awaken at the first sign of intrusion. A raven circled overhead, perhaps a spy for the dark lord within. The serpent cult had allies everywhere.',
];

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
 * Helper to run checkWorldInfo with a specific benchmark lorebook
 * @param {import('@playwright/test').Page} page
 * @param {string} lorebookName
 * @param {string[]} chatMessages
 * @param {{trigger?: string, maxContext?: number, returnProfiling?: boolean}} options
 */
async function runBenchmark(page, lorebookName, chatMessages, options = {}) {
    return await page.evaluate(async ({ name, messages, opts }) => {
        try {
            const wiModule = await import('/scripts/world-info.js');

            // Clear cache and load the benchmark lorebook
            wiModule.worldInfoCache.delete(name);
            const data = await wiModule.loadWorldInfo(name);

            if (!data) {
                return { error: `Failed to load lorebook: ${name}` };
            }

            // Add to selected world info if not already
            if (!wiModule.selected_world_info.includes(name)) {
                wiModule.selected_world_info.push(name);
            }

            const globalScanData = {
                personaDescription: '',
                characterDescription: '',
                characterPersonality: '',
                characterDepthPrompt: '',
                scenario: '',
                creatorNotes: '',
                trigger: opts.trigger || 'normal',
            };

            const chat = [...messages].reverse();
            const maxContext = opts.maxContext || 8192;
            const checkOptions = opts.returnProfiling ? { returnProfiling: true } : {};

            const startTime = performance.now();
            const result = await wiModule.checkWorldInfo(chat, maxContext, true, globalScanData, checkOptions);
            const endTime = performance.now();

            // Cleanup: remove from selected
            wiModule.selected_world_info = wiModule.selected_world_info.filter(x => x !== name);

            return {
                timeMs: endTime - startTime,
                activatedCount: result.allActivatedEntries?.size || 0,
                content: result.worldInfoBefore + result.worldInfoAfter,
                profiling: result.profiling || null,
            };
        } catch (e) {
            return { error: e.message, stack: e.stack };
        }
    }, { name: lorebookName, messages: chatMessages, opts: options });
}

// ============================================
// Benchmark: No Match Scenario
// ============================================
test.describe('Benchmark: No Match', () => {
    test.beforeEach(setup.awaitST);

    test('100 entries with no matches', async ({ page }) => {
        const result = await runBenchmark(page, 'Benchmark No Match', ['No keywords here at all']);

        console.log(`No Match (100 entries): ${result.timeMs?.toFixed(2)}ms, activated: ${result.activatedCount}`);

        expect(result.error).toBeUndefined();
        expect(result.timeMs).toBeLessThan(THRESHOLDS.FAST);
        expect(result.activatedCount).toBe(0);
    });

    test('regex patterns with no matches', async ({ page }) => {
        const result = await runBenchmark(page, 'Benchmark Regex', ['No regex patterns match here']);

        console.log(`Regex No Match (50 entries): ${result.timeMs?.toFixed(2)}ms, activated: ${result.activatedCount}`);

        expect(result.error).toBeUndefined();
        expect(result.timeMs).toBeLessThan(THRESHOLDS.NORMAL);
        expect(result.activatedCount).toBe(0);
    });
});

// ============================================
// Benchmark: Partial Match Scenario
// ============================================
test.describe('Benchmark: Partial Match', () => {
    test.beforeEach(setup.awaitST);

    test('100 entries with 10% match rate', async ({ page }) => {
        const result = await runBenchmark(page, 'Benchmark Partial Match', ['benchmark_match_key test']);

        console.log(`Partial Match (10/100): ${result.timeMs?.toFixed(2)}ms, activated: ${result.activatedCount}`);

        expect(result.error).toBeUndefined();
        expect(result.timeMs).toBeLessThan(THRESHOLDS.NORMAL);
        // Should activate 10 entries (the ones with benchmark_match_key)
        expect(result.activatedCount).toBe(10);
    });
});

// ============================================
// Benchmark: Recursion Chain
// ============================================
test.describe('Benchmark: Recursion', () => {
    test.beforeEach(setup.awaitST);

    test('20-deep recursion chain', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const wiModule = await import('/scripts/world-info.js');
            const name = 'Benchmark Recursion';

            wiModule.worldInfoCache.delete(name);
            const data = await wiModule.loadWorldInfo(name);

            if (!data) {
                return { error: 'Failed to load Benchmark Recursion' };
            }

            if (!wiModule.selected_world_info.includes(name)) {
                wiModule.selected_world_info.push(name);
            }

            const globalScanData = {
                personaDescription: '',
                characterDescription: '',
                characterPersonality: '',
                characterDepthPrompt: '',
                scenario: '',
                creatorNotes: '',
                trigger: 'normal',
            };

            const chat = ['chain_0 start'];
            const startTime = performance.now();
            const result = await wiModule.checkWorldInfo(chat.slice().reverse(), 16384, true, globalScanData);
            const endTime = performance.now();

            wiModule.selected_world_info = wiModule.selected_world_info.filter(x => x !== name);

            const content = result.worldInfoBefore + result.worldInfoAfter;

            return {
                timeMs: endTime - startTime,
                activatedCount: result.allActivatedEntries?.size || 0,
                hasChainEnd: content.includes('[CHAIN_END_'),
                hasChain0: content.includes('[CHAIN_0]'),
                recursiveEnabled: wiModule.world_info_recursive,
            };
        });

        console.log(`Recursion Chain: ${result.timeMs?.toFixed(2)}ms, activated: ${result.activatedCount}, recursive: ${result.recursiveEnabled}`);

        expect(result.error).toBeUndefined();
        expect(result.timeMs).toBeLessThan(THRESHOLDS.COMPLEX);
        expect(result.hasChain0).toBe(true);
        // If recursion is enabled, entire chain should activate
        if (result.recursiveEnabled) {
            expect(result.activatedCount).toBe(20);
            expect(result.hasChainEnd).toBe(true);
        }
    });
});

// ============================================
// Benchmark: Group Competition
// ============================================
test.describe('Benchmark: Groups', () => {
    test.beforeEach(setup.awaitST);

    test('10 groups with 5 entries each', async ({ page }) => {
        const result = await runBenchmark(page, 'Benchmark Groups', [
            'trigger_group_0 trigger_group_1 trigger_group_2 trigger_group_3 trigger_group_4',
        ]);

        console.log(`Groups (5 triggered): ${result.timeMs?.toFixed(2)}ms, activated: ${result.activatedCount}`);

        expect(result.error).toBeUndefined();
        expect(result.timeMs).toBeLessThan(THRESHOLDS.NORMAL);
        // Should have activated one entry per triggered group (5 groups triggered)
        expect(result.activatedCount).toBe(5);
    });

    test('all 10 groups triggered', async ({ page }) => {
        const triggers = Array.from({ length: 10 }, (_, i) => `trigger_group_${i}`).join(' ');
        const result = await runBenchmark(page, 'Benchmark Groups', [triggers]);

        console.log(`Groups (10 triggered): ${result.timeMs?.toFixed(2)}ms, activated: ${result.activatedCount}`);

        expect(result.error).toBeUndefined();
        expect(result.timeMs).toBeLessThan(THRESHOLDS.COMPLEX);
        // One entry per group
        expect(result.activatedCount).toBe(10);
    });
});

// ============================================
// Benchmark: Secondary Keys (AND_ALL)
// ============================================
test.describe('Benchmark: Secondary Keys', () => {
    test.beforeEach(setup.awaitST);

    test('AND_ALL with complete match', async ({ page }) => {
        // Match entry 0 completely
        const result = await runBenchmark(page, 'Benchmark Secondary', [
            'primary_0 secondary_a_0 secondary_b_0 test',
        ]);

        console.log(`Secondary AND_ALL: ${result.timeMs?.toFixed(2)}ms, activated: ${result.activatedCount}`);

        expect(result.error).toBeUndefined();
        expect(result.timeMs).toBeLessThan(THRESHOLDS.NORMAL);
        // Should activate exactly 1 entry
        expect(result.activatedCount).toBe(1);
        expect(result.content).toContain('[SECONDARY_0]');
    });

    test('AND_ALL with incomplete match (no secondary)', async ({ page }) => {
        // Only primary key, missing secondary
        const result = await runBenchmark(page, 'Benchmark Secondary', ['primary_0 test']);

        console.log(`Secondary AND_ALL incomplete: ${result.timeMs?.toFixed(2)}ms, activated: ${result.activatedCount}`);

        expect(result.error).toBeUndefined();
        expect(result.timeMs).toBeLessThan(THRESHOLDS.FAST);
        // AND_ALL requires all secondary keys, so should not activate
        expect(result.activatedCount).toBe(0);
    });
});

// ============================================
// Benchmark: Budget Overflow
// ============================================
test.describe('Benchmark: Budget', () => {
    test.beforeEach(setup.awaitST);

    test('50 matching entries with limited budget', async ({ page }) => {
        const result = await runBenchmark(
            page,
            'Benchmark Budget',
            ['budget_test_match trigger'],
            { maxContext: 500 },
        );

        console.log(`Budget Overflow: ${result.timeMs?.toFixed(2)}ms, activated: ${result.activatedCount}/50`);

        expect(result.error).toBeUndefined();
        expect(result.timeMs).toBeLessThan(THRESHOLDS.NORMAL);
        // Should have activated fewer entries than total due to budget
        expect(result.activatedCount).toBeLessThan(50);
        expect(result.activatedCount).toBeGreaterThan(0);
    });

    test('all entries with large budget', async ({ page }) => {
        const result = await runBenchmark(
            page,
            'Benchmark Budget',
            ['budget_test_match trigger'],
            { maxContext: 32768 },
        );

        console.log(`Large Budget: ${result.timeMs?.toFixed(2)}ms, activated: ${result.activatedCount}/50`);

        expect(result.error).toBeUndefined();
        expect(result.timeMs).toBeLessThan(THRESHOLDS.NORMAL);
        // With large budget, all should activate
        expect(result.activatedCount).toBe(50);
    });
});

// ============================================
// Benchmark: Combined Load Test
// ============================================
test.describe('Benchmark: Combined', () => {
    test.beforeEach(setup.awaitST);

    test('multiple lorebooks simultaneously', async ({ page }) => {
        // Load Test Lorebook which has 72 entries
        const result = await page.evaluate(async () => {
            const wiModule = await import('/scripts/world-info.js');

            // Load Test Lorebook
            wiModule.worldInfoCache.delete('Test Lorebook');
            await wiModule.loadWorldInfo('Test Lorebook');

            if (!wiModule.selected_world_info.includes('Test Lorebook')) {
                wiModule.selected_world_info.push('Test Lorebook');
            }

            const globalScanData = {
                personaDescription: '',
                characterDescription: '',
                characterPersonality: '',
                characterDepthPrompt: '',
                scenario: '',
                creatorNotes: '',
                trigger: 'normal',
            };

            // Trigger many entries at once
            const chat = [
                'Alice Bob Castle dragon wizard knight elf dwarf',
                'priority_high priority_low position_before position_after',
                'group_alpha sticky_entry cooldown_entry',
            ];

            const startTime = performance.now();
            const result = await wiModule.checkWorldInfo(chat.slice().reverse(), 16384, true, globalScanData);
            const endTime = performance.now();

            return {
                timeMs: endTime - startTime,
                activatedCount: result.allActivatedEntries?.size || 0,
            };
        });

        console.log(`Combined Load: ${result.timeMs?.toFixed(2)}ms, activated: ${result.activatedCount}`);

        expect(result.error).toBeUndefined();
        expect(result.timeMs).toBeLessThan(THRESHOLDS.COMPLEX);
        expect(result.activatedCount).toBeGreaterThan(5);
    });
});

// ============================================
// Realistic Benchmarks (4 messages x 250 words, 12 matches)
// Shows Legacy vs AC Cold vs AC Warm for each size
// ============================================
test.describe('Benchmark: Realistic Scenarios', () => {
    test.beforeEach(setup.awaitST);

    /**
     * Helper to run full Legacy vs AC comparison with profiling.
     * Also verifies that Legacy and AC produce identical results (same entries, same order).
     */
    async function runRealisticComparison(page, lorebookName, chatMessages) {
        return await page.evaluate(async ({ name, messages }) => {
            const wiModule = await import('/scripts/world-info.js');
            const { acCacheManager } = await import('/scripts/world-info/scanning/ACCacheManager.js');

            const globalScanData = {
                personaDescription: '', characterDescription: '', characterPersonality: '',
                characterDepthPrompt: '', scenario: '', creatorNotes: '', trigger: 'normal',
            };
            const chat = [...messages].reverse();
            const maxContext = 8192;

            // Helper to extract entry IDs in order
            function getEntryIds(result) {
                if (!result.allActivatedEntries) return [];
                return Array.from(result.allActivatedEntries).map(e => `${e.world}.${e.uid}`);
            }

            // Load lorebook
            wiModule.worldInfoCache.delete(name);
            await wiModule.loadWorldInfo(name);
            if (!wiModule.selected_world_info.includes(name)) {
                wiModule.selected_world_info.push(name);
            }

            // --- Legacy (AC off) ---
            wiModule.setWorldInfoUseAhoCorasick(false);
            const legacy1 = await wiModule.checkWorldInfo(chat, maxContext, true, globalScanData, { returnProfiling: true });
            const legacy2 = await wiModule.checkWorldInfo(chat, maxContext, true, globalScanData, { returnProfiling: true });
            const legacy3 = await wiModule.checkWorldInfo(chat, maxContext, true, globalScanData, { returnProfiling: true });
            const legacyEntryIds = getEntryIds(legacy1);

            // --- AC Cold (cache miss) ---
            wiModule.setWorldInfoUseAhoCorasick(true);
            acCacheManager.clear();
            const acCold = await wiModule.checkWorldInfo(chat, maxContext, true, globalScanData, { returnProfiling: true });
            const acColdEntryIds = getEntryIds(acCold);

            // --- AC Warm (cache hit) ---
            const acWarm1 = await wiModule.checkWorldInfo(chat, maxContext, true, globalScanData, { returnProfiling: true });
            const acWarm2 = await wiModule.checkWorldInfo(chat, maxContext, true, globalScanData, { returnProfiling: true });
            const acWarmEntryIds = getEntryIds(acWarm1);

            // Cleanup
            wiModule.selected_world_info = wiModule.selected_world_info.filter(x => x !== name);
            wiModule.setWorldInfoUseAhoCorasick(false);

            const avgLegacy = (legacy1.profiling.totalMs + legacy2.profiling.totalMs + legacy3.profiling.totalMs) / 3;
            const avgWarm = (acWarm1.profiling.totalMs + acWarm2.profiling.totalMs) / 2;

            // Compare entry IDs and order
            const legacyVsCold = JSON.stringify(legacyEntryIds) === JSON.stringify(acColdEntryIds);
            const legacyVsWarm = JSON.stringify(legacyEntryIds) === JSON.stringify(acWarmEntryIds);
            const coldVsWarm = JSON.stringify(acColdEntryIds) === JSON.stringify(acWarmEntryIds);

            return {
                legacy: {
                    avgMs: avgLegacy,
                    profiling: legacy1.profiling,
                    entryIds: legacyEntryIds,
                },
                acCold: {
                    totalMs: acCold.profiling.totalMs,
                    profiling: acCold.profiling,
                    entryIds: acColdEntryIds,
                },
                acWarm: {
                    avgMs: avgWarm,
                    profiling: acWarm1.profiling,
                    entryIds: acWarmEntryIds,
                },
                activatedCount: acWarm1.allActivatedEntries?.size || 0,
                speedup: avgLegacy / avgWarm,
                // Verification results
                resultsMatch: {
                    legacyVsCold,
                    legacyVsWarm,
                    coldVsWarm,
                    allMatch: legacyVsCold && legacyVsWarm && coldVsWarm,
                },
            };
        }, { name: lorebookName, messages: chatMessages });
    }

    test('100 entries: Legacy vs AC comparison', async ({ page }) => {
        const result = await runRealisticComparison(page, 'Benchmark 100 Realistic', REALISTIC_CHAT);

        console.log('\n=== 100 Entries Realistic ===');
        console.log(`Legacy:   ${result.legacy.avgMs.toFixed(1)}ms (search=${result.legacy.profiling.searchMs}ms, filter=${result.legacy.profiling.filterMs}ms)`);
        console.log(`AC Cold:  ${result.acCold.totalMs.toFixed(1)}ms (build=${result.acCold.profiling.buildMs}ms, search=${result.acCold.profiling.searchMs}ms)`);
        console.log(`AC Warm:  ${result.acWarm.avgMs.toFixed(1)}ms (build=${result.acWarm.profiling.buildMs}ms, search=${result.acWarm.profiling.searchMs}ms)`);
        console.log(`Speedup:  ${result.speedup.toFixed(2)}x`);
        console.log(`Activated: ${result.activatedCount}, Rounds: ${result.legacy.profiling.recursionRounds}`);
        console.log(`Results match: ${result.resultsMatch.allMatch ? '✓ YES' : '✗ NO'}`);
        if (!result.resultsMatch.allMatch) {
            console.log(`  Legacy entries: ${result.legacy.entryIds.join(', ')}`);
            console.log(`  AC entries:     ${result.acWarm.entryIds.join(', ')}`);
        }
        console.log('=============================\n');

        expect(result.activatedCount).toBeGreaterThanOrEqual(10);
        expect(result.resultsMatch.allMatch).toBe(true);
    });

    test('5000 entries: Legacy vs AC comparison', async ({ page }) => {
        const result = await runRealisticComparison(page, 'Benchmark 5k Realistic', REALISTIC_CHAT);

        console.log('\n=== 5k Entries Realistic ===');
        console.log(`Legacy:   ${result.legacy.avgMs.toFixed(1)}ms (search=${result.legacy.profiling.searchMs}ms, filter=${result.legacy.profiling.filterMs}ms)`);
        console.log(`AC Cold:  ${result.acCold.totalMs.toFixed(1)}ms (build=${result.acCold.profiling.buildMs}ms, search=${result.acCold.profiling.searchMs}ms)`);
        console.log(`AC Warm:  ${result.acWarm.avgMs.toFixed(1)}ms (build=${result.acWarm.profiling.buildMs}ms, search=${result.acWarm.profiling.searchMs}ms)`);
        console.log(`Speedup:  ${result.speedup.toFixed(2)}x`);
        console.log(`Activated: ${result.activatedCount}, Rounds: ${result.legacy.profiling.recursionRounds}`);
        console.log(`Results match: ${result.resultsMatch.allMatch ? '✓ YES' : '✗ NO'}`);
        console.log('============================\n');

        expect(result.activatedCount).toBeGreaterThanOrEqual(10);
        expect(result.resultsMatch.allMatch).toBe(true);
    });

    test('25000 entries: Legacy vs AC comparison', async ({ page }) => {
        test.setTimeout(180000);
        const result = await runRealisticComparison(page, 'Benchmark 25k Realistic', REALISTIC_CHAT);

        console.log('\n=== 25k Entries Realistic ===');
        console.log(`Legacy:   ${result.legacy.avgMs.toFixed(1)}ms (search=${result.legacy.profiling.searchMs}ms, filter=${result.legacy.profiling.filterMs}ms)`);
        console.log(`AC Cold:  ${result.acCold.totalMs.toFixed(1)}ms (build=${result.acCold.profiling.buildMs}ms, search=${result.acCold.profiling.searchMs}ms)`);
        console.log(`AC Warm:  ${result.acWarm.avgMs.toFixed(1)}ms (build=${result.acWarm.profiling.buildMs}ms, search=${result.acWarm.profiling.searchMs}ms)`);
        console.log(`Speedup:  ${result.speedup.toFixed(2)}x`);
        console.log(`Activated: ${result.activatedCount}, Rounds: ${result.legacy.profiling.recursionRounds}`);
        console.log(`Results match: ${result.resultsMatch.allMatch ? '✓ YES' : '✗ NO'}`);
        console.log('=============================\n');

        expect(result.activatedCount).toBeGreaterThanOrEqual(10);
        expect(result.resultsMatch.allMatch).toBe(true);
    });

    test('100000 entries: Legacy vs AC comparison', async ({ page }) => {
        test.setTimeout(600000);
        const result = await runRealisticComparison(page, 'Benchmark 100k Realistic', REALISTIC_CHAT);

        console.log('\n=== 100k Entries Realistic ===');
        console.log(`Legacy:   ${result.legacy.avgMs.toFixed(1)}ms (search=${result.legacy.profiling.searchMs}ms, filter=${result.legacy.profiling.filterMs}ms)`);
        console.log(`AC Cold:  ${result.acCold.totalMs.toFixed(1)}ms (build=${result.acCold.profiling.buildMs}ms, search=${result.acCold.profiling.searchMs}ms)`);
        console.log(`AC Warm:  ${result.acWarm.avgMs.toFixed(1)}ms (build=${result.acWarm.profiling.buildMs}ms, search=${result.acWarm.profiling.searchMs}ms)`);
        console.log(`Speedup:  ${result.speedup.toFixed(2)}x`);
        console.log(`Activated: ${result.activatedCount}, Rounds: ${result.legacy.profiling.recursionRounds}`);
        console.log(`Results match: ${result.resultsMatch.allMatch ? '✓ YES' : '✗ NO'}`);
        console.log('==============================\n');

        expect(result.activatedCount).toBeGreaterThanOrEqual(10);
        expect(result.resultsMatch.allMatch).toBe(true);
    });
});

// ============================================
// No-Match Baseline Benchmarks
// ============================================
test.describe('Benchmark: No-Match Baseline', () => {
    test.beforeEach(setup.awaitST);

    test('5000 entries, no matches (baseline)', async ({ page }) => {
        const result = await runBenchmark(page, 'Benchmark 5k No Match', REALISTIC_CHAT);

        console.log(`5k No Match: ${result.timeMs?.toFixed(2)}ms, activated: ${result.activatedCount}`);

        expect(result.error).toBeUndefined();
        expect(result.timeMs).toBeLessThan(THRESHOLDS.HEAVY);
        expect(result.activatedCount).toBe(0);
    });

    test('25000 entries, no matches (baseline)', async ({ page }) => {
        const result = await runBenchmark(page, 'Benchmark 25k No Match', REALISTIC_CHAT);

        console.log(`25k No Match: ${result.timeMs?.toFixed(2)}ms, activated: ${result.activatedCount}`);
        console.log(`  [PERF] 25k no-match: ${(result.timeMs / 1000).toFixed(2)}s`);

        expect(result.error).toBeUndefined();
        expect(result.activatedCount).toBe(0);
    });

    test('100000 entries, no matches (baseline)', async ({ page }) => {
        const result = await runBenchmark(page, 'Benchmark 100k No Match', REALISTIC_CHAT);

        console.log(`100k No Match: ${result.timeMs?.toFixed(2)}ms, activated: ${result.activatedCount}`);
        console.log(`  [PERF] 100k no-match: ${(result.timeMs / 1000).toFixed(2)}s`);

        expect(result.error).toBeUndefined();
        expect(result.activatedCount).toBe(0);
        expect(result.timeMs).toBeLessThan(60000);
    });
});

// ============================================
// Realistic Vocabulary Benchmarks (proper prefix sharing)
// ============================================
test.describe('Benchmark: Realistic Vocabulary', () => {
    test.beforeEach(setup.awaitST);

    test('10k entries with real words (3-8 keywords each)', async ({ page }) => {
        const result = await runBenchmark(page, 'Benchmark 10k Realistic Words', REALISTIC_CHAT);

        console.log(`10k Real Words: ${result.timeMs?.toFixed(2)}ms, activated: ${result.activatedCount}`);
        console.log(`  [PERF] 10k real words: ${(result.timeMs / 1000).toFixed(2)}s`);

        expect(result.error).toBeUndefined();
        // Many entries should match since we use real fantasy words
        expect(result.activatedCount).toBeGreaterThan(0);
    });

    test('25k entries with real words (3-8 keywords each)', async ({ page }) => {
        const result = await runBenchmark(page, 'Benchmark 25k Realistic Words', REALISTIC_CHAT);

        console.log(`25k Real Words: ${result.timeMs?.toFixed(2)}ms, activated: ${result.activatedCount}`);
        console.log(`  [PERF] 25k real words: ${(result.timeMs / 1000).toFixed(2)}s`);

        expect(result.error).toBeUndefined();
        expect(result.activatedCount).toBeGreaterThan(0);
    });
});

// ============================================
// Performance Summary
// ============================================
test.describe('Performance Summary', () => {
    test.beforeEach(setup.awaitST);

    test('all benchmarks within thresholds', async ({ page }) => {
        const results = [];

        // No match test
        const noMatch = await runBenchmark(page, 'Benchmark No Match', ['No keywords']);
        results.push({ name: 'No Match (100)', time: noMatch.timeMs, threshold: THRESHOLDS.FAST, passed: noMatch.timeMs < THRESHOLDS.FAST });

        // Partial match test
        const partial = await runBenchmark(page, 'Benchmark Partial Match', ['benchmark_match_key']);
        results.push({ name: 'Partial Match (10/100)', time: partial.timeMs, threshold: THRESHOLDS.NORMAL, passed: partial.timeMs < THRESHOLDS.NORMAL });

        // Group test
        const groups = await runBenchmark(page, 'Benchmark Groups', ['trigger_group_0 trigger_group_1']);
        results.push({ name: 'Groups (2/10)', time: groups.timeMs, threshold: THRESHOLDS.NORMAL, passed: groups.timeMs < THRESHOLDS.NORMAL });

        // Regex test
        const regex = await runBenchmark(page, 'Benchmark Regex', ['No match']);
        results.push({ name: 'Regex (50)', time: regex.timeMs, threshold: THRESHOLDS.NORMAL, passed: regex.timeMs < THRESHOLDS.NORMAL });

        console.log('\n=== Performance Summary ===');
        for (const r of results) {
            const status = r.passed ? '✓' : '✗';
            console.log(`  ${status} ${r.name}: ${r.time?.toFixed(2)}ms (< ${r.threshold}ms)`);
        }
        console.log('===========================\n');

        // All tests should pass
        const allPassed = results.every(r => r.passed);
        expect(allPassed).toBe(true);
    });
});

// ============================================
// Multi-Turn Benchmarks: Legacy vs AC Cold vs AC Warm
// ============================================
test.describe('Benchmark: Multi-Turn (AC vs Legacy)', () => {
    test.beforeEach(setup.awaitST);

    /**
     * Helper to run multi-turn comparison benchmark.
     * Compares Legacy (no cache), AC Cold (cache miss), and AC Warm (cache hit).
     */
    async function runMultiTurnBenchmark(page, lorebookName, chatMessages) {
        return await page.evaluate(async ({ name, messages }) => {
            const wiModule = await import('/scripts/world-info.js');
            const { acCacheManager } = await import('/scripts/world-info/scanning/ACCacheManager.js');

            const globalScanData = {
                personaDescription: '',
                characterDescription: '',
                characterPersonality: '',
                characterDepthPrompt: '',
                scenario: '',
                creatorNotes: '',
                trigger: 'normal',
            };
            const chat = [...messages].reverse();
            const maxContext = 8192;

            // Run a scan and track cache behavior using cache size changes
            // Note: cacheHit reflects the LAST getOrBuild call during a scan.
            // Due to recursive scans, the first pass may miss but subsequent passes hit.
            // cacheBuilt accurately tracks whether a new cache entry was created.
            async function runScan(useAC) {
                const cacheSizeBefore = acCacheManager.size;
                const startTime = performance.now();
                const result = await wiModule.checkWorldInfo(chat, maxContext, true, globalScanData);
                const endTime = performance.now();
                const cacheSizeAfter = acCacheManager.size;

                return {
                    timeMs: endTime - startTime,
                    activatedCount: result.allActivatedEntries?.size || 0,
                    // eslint-disable-next-line no-undef
                    cacheHit: window.WI_AC_CACHE_HIT,
                    cacheBuilt: cacheSizeAfter > cacheSizeBefore, // True if new cache entry built
                    // eslint-disable-next-line no-undef
                    timing: window.WI_AC_TIMING ? { ...window.WI_AC_TIMING } : null,
                };
            }

            try {
                // Clear cache and load lorebook
                wiModule.worldInfoCache.delete(name);
                await wiModule.loadWorldInfo(name);

                if (!wiModule.selected_world_info.includes(name)) {
                    wiModule.selected_world_info.push(name);
                }

                // --- Legacy (AC off) ---
                wiModule.setWorldInfoUseAhoCorasick(false);
                const legacy1 = await runScan(false);
                const legacy2 = await runScan(false);
                const legacy3 = await runScan(false);

                // --- AC Cold (cache miss) ---
                wiModule.setWorldInfoUseAhoCorasick(true);
                // Clear the AC cache to ensure cold start
                acCacheManager.clear();

                const acCold = await runScan(true);

                // --- AC Warm (cache hit) ---
                const acWarm1 = await runScan(true);
                const acWarm2 = await runScan(true);

                // Cleanup
                wiModule.selected_world_info = wiModule.selected_world_info.filter(x => x !== name);
                wiModule.setWorldInfoUseAhoCorasick(false);

                return {
                    legacy: {
                        turn0: legacy1,
                        turn1: legacy2,
                        turn2: legacy3,
                        avgMs: (legacy1.timeMs + legacy2.timeMs + legacy3.timeMs) / 3,
                    },
                    acCold: acCold,
                    acWarm: {
                        turn1: acWarm1,
                        turn2: acWarm2,
                        avgMs: (acWarm1.timeMs + acWarm2.timeMs) / 2,
                    },
                };
            } catch (e) {
                return { error: e.message, stack: e.stack };
            }
        }, { name: lorebookName, messages: chatMessages });
    }

    test('10k entries: Legacy vs AC Cold vs AC Warm', async ({ page }) => {
        test.setTimeout(120000); // 2 minute timeout

        const result = await runMultiTurnBenchmark(page, 'Benchmark 10k Realistic Words', REALISTIC_CHAT);

        expect(result.error).toBeUndefined();

        // Verify cache behavior using cacheBuilt (cache size changes)
        // acCold should build cache (cache was cleared), warm scans should not
        expect(result.acCold.cacheBuilt).toBe(true);
        expect(result.acWarm.turn1.cacheBuilt).toBe(false);
        expect(result.acWarm.turn2.cacheBuilt).toBe(false);

        console.log('\n=== 10k Multi-Turn Benchmark ===');
        console.log(`Legacy (avg 3 turns): ${result.legacy.avgMs.toFixed(1)}ms`);
        console.log(`AC Cold (turn 0):     ${result.acCold.timeMs.toFixed(1)}ms (cache miss)`);
        console.log(`AC Warm (avg 2 turns): ${result.acWarm.avgMs.toFixed(1)}ms (cache hit)`);
        console.log(`Speedup (warm vs legacy): ${(result.legacy.avgMs / result.acWarm.avgMs).toFixed(2)}x`);
        console.log('================================\n');
    });

    test('25k entries: Legacy vs AC Cold vs AC Warm', async ({ page }) => {
        test.setTimeout(180000); // 3 minute timeout

        const result = await runMultiTurnBenchmark(page, 'Benchmark 25k Realistic', REALISTIC_CHAT);

        expect(result.error).toBeUndefined();

        // Verify cache behavior using cacheBuilt (cache size changes)
        // acCold should build cache (cache was cleared), warm scans should not
        expect(result.acCold.cacheBuilt).toBe(true);
        expect(result.acWarm.turn1.cacheBuilt).toBe(false);
        expect(result.acWarm.turn2.cacheBuilt).toBe(false);

        console.log('\n=== 25k Multi-Turn Benchmark ===');
        console.log(`Legacy (avg 3 turns): ${result.legacy.avgMs.toFixed(1)}ms`);
        console.log(`AC Cold (turn 0):     ${result.acCold.timeMs.toFixed(1)}ms (cache miss)`);
        console.log(`AC Warm (avg 2 turns): ${result.acWarm.avgMs.toFixed(1)}ms (cache hit)`);
        console.log(`Speedup (warm vs legacy): ${(result.legacy.avgMs / result.acWarm.avgMs).toFixed(2)}x`);
        console.log('================================\n');
    });

    test('100k entries: Legacy vs AC Cold vs AC Warm', async ({ page }) => {
        test.setTimeout(600000); // 10 minute timeout for 100k

        const result = await runMultiTurnBenchmark(page, 'Benchmark 100k Realistic', REALISTIC_CHAT);

        expect(result.error).toBeUndefined();

        // Verify cache behavior using cacheBuilt (cache size changes)
        // acCold should build cache (cache was cleared), warm scans should not
        expect(result.acCold.cacheBuilt).toBe(true);
        expect(result.acWarm.turn1.cacheBuilt).toBe(false);

        console.log('\n=== 100k Multi-Turn Benchmark ===');
        console.log(`Legacy (avg 3 turns): ${result.legacy.avgMs.toFixed(1)}ms`);
        console.log(`AC Cold (turn 0):     ${result.acCold.timeMs.toFixed(1)}ms (cache miss)`);
        console.log(`AC Warm (avg 2 turns): ${result.acWarm.avgMs.toFixed(1)}ms (cache hit)`);
        console.log(`Speedup (warm vs legacy): ${(result.legacy.avgMs / result.acWarm.avgMs).toFixed(2)}x`);
        console.log('=================================\n');
    });

    test('5k entries: Verify warm cache is faster', async ({ page }) => {
        const result = await runMultiTurnBenchmark(page, 'Benchmark 5k Realistic', REALISTIC_CHAT);

        expect(result.error).toBeUndefined();

        // AC warm should be faster than legacy for large lorebooks
        console.log('\n=== 5k Multi-Turn Summary ===');
        console.log(`Legacy avg: ${result.legacy.avgMs.toFixed(1)}ms`);
        console.log(`AC Cold:    ${result.acCold.timeMs.toFixed(1)}ms`);
        console.log(`AC Warm avg: ${result.acWarm.avgMs.toFixed(1)}ms`);

        // For 5k+ entries, AC warm should generally be faster than legacy
        // (this may vary based on system, so we just log the comparison)
        const speedup = result.legacy.avgMs / result.acWarm.avgMs;
        console.log(`Speedup ratio: ${speedup.toFixed(2)}x`);
        console.log('=============================\n');
    });
});

// ============================================
// Multi-Turn Cache Hit Rate Analysis
// ============================================
test.describe('Benchmark: Cache Hit Rate', () => {
    test.beforeEach(setup.awaitST);

    test('cache hit rate over 10 consecutive scans', async ({ page }) => {
        const result = await page.evaluate(async ({ messages }) => {
            const wiModule = await import('/scripts/world-info.js');
            const { acCacheManager } = await import('/scripts/world-info/scanning/ACCacheManager.js');

            const name = 'Benchmark 5k Realistic';

            wiModule.worldInfoCache.delete(name);
            await wiModule.loadWorldInfo(name);
            wiModule.setWorldInfoUseAhoCorasick(true);

            if (!wiModule.selected_world_info.includes(name)) {
                wiModule.selected_world_info.push(name);
            }

            // Clear AC cache to ensure clean start
            acCacheManager.clear();

            const globalScanData = {
                personaDescription: '',
                characterDescription: '',
                characterPersonality: '',
                characterDepthPrompt: '',
                scenario: '',
                creatorNotes: '',
                trigger: 'normal',
            };
            const chat = [...messages].reverse();

            const results = [];
            for (let i = 0; i < 10; i++) {
                const cacheSizeBefore = acCacheManager.size;
                const startTime = performance.now();
                await wiModule.checkWorldInfo(chat, 8192, true, globalScanData);
                const endTime = performance.now();
                const cacheSizeAfter = acCacheManager.size;

                results.push({
                    turn: i,
                    timeMs: endTime - startTime,
                    // eslint-disable-next-line no-undef
                    cacheHit: window.WI_AC_CACHE_HIT,
                    cacheBuilt: cacheSizeAfter > cacheSizeBefore, // True = cache miss (built), False = cache hit
                });
            }

            wiModule.selected_world_info = wiModule.selected_world_info.filter(x => x !== name);
            wiModule.setWorldInfoUseAhoCorasick(false);

            // Count cache hits by looking at cacheBuilt (not cacheHit which is unreliable due to recursion)
            // cacheBuilt=false means cache was reused, cacheBuilt=true means cache was built (miss)
            const hitCount = results.filter(r => !r.cacheBuilt).length;
            const hitRate = (hitCount / results.length) * 100;

            return {
                results,
                hitCount,
                hitRate,
            };
        }, { messages: REALISTIC_CHAT });

        // First scan should build cache (miss), rest should reuse (hit)
        expect(result.results[0].cacheBuilt).toBe(true); // First scan builds cache
        expect(result.hitCount).toBe(9); // 9 out of 10 should be hits (no build)
        expect(result.hitRate).toBe(90);

        console.log('\n=== Cache Hit Rate Analysis ===');
        console.log(`Scans: ${result.results.length}`);
        console.log(`Cache Hits: ${result.hitCount}`);
        console.log(`Hit Rate: ${result.hitRate}%`);
        console.log(`Timing: ${result.results.map(r => `${r.timeMs.toFixed(0)}ms`).join(', ')}`);
        console.log('===============================\n');
    });
});

// ============================================
// Long Chat Benchmarks (~10k words) - Legacy vs AC
// ============================================
test.describe('Benchmark: Long Chat (~10k words)', () => {
    test.beforeEach(setup.awaitST);

    /**
     * Helper to run full Legacy vs AC comparison with long chat.
     * Also verifies that Legacy and AC produce identical results.
     */
    async function runLongChatComparison(page, lorebookName) {
        return await page.evaluate(async ({ name, messages }) => {
            const wiModule = await import('/scripts/world-info.js');
            const { acCacheManager } = await import('/scripts/world-info/scanning/ACCacheManager.js');

            const globalScanData = {
                personaDescription: '', characterDescription: '', characterPersonality: '',
                characterDepthPrompt: '', scenario: '', creatorNotes: '', trigger: 'normal',
            };
            const chat = [...messages].reverse();
            const maxContext = 16384;

            // Helper to extract entry IDs in order
            function getEntryIds(result) {
                if (!result.allActivatedEntries) return [];
                return Array.from(result.allActivatedEntries).map(e => `${e.world}.${e.uid}`);
            }

            // Load lorebook
            wiModule.worldInfoCache.delete(name);
            await wiModule.loadWorldInfo(name);
            if (!wiModule.selected_world_info.includes(name)) {
                wiModule.selected_world_info.push(name);
            }

            // --- Legacy (AC off) ---
            wiModule.setWorldInfoUseAhoCorasick(false);
            const legacy = await wiModule.checkWorldInfo(chat, maxContext, true, globalScanData, { returnProfiling: true });
            const legacyEntryIds = getEntryIds(legacy);

            // --- AC Cold (cache miss) ---
            wiModule.setWorldInfoUseAhoCorasick(true);
            acCacheManager.clear();
            const acCold = await wiModule.checkWorldInfo(chat, maxContext, true, globalScanData, { returnProfiling: true });
            const acColdEntryIds = getEntryIds(acCold);

            // --- AC Warm (cache hit) ---
            const acWarm = await wiModule.checkWorldInfo(chat, maxContext, true, globalScanData, { returnProfiling: true });
            const acWarmEntryIds = getEntryIds(acWarm);

            // Cleanup
            wiModule.selected_world_info = wiModule.selected_world_info.filter(x => x !== name);
            wiModule.setWorldInfoUseAhoCorasick(false);

            // Compare results
            const legacyVsAC = JSON.stringify(legacyEntryIds) === JSON.stringify(acWarmEntryIds);
            const coldVsWarm = JSON.stringify(acColdEntryIds) === JSON.stringify(acWarmEntryIds);

            return {
                legacy: legacy.profiling,
                acCold: acCold.profiling,
                acWarm: acWarm.profiling,
                activatedCount: acWarm.allActivatedEntries?.size || 0,
                resultsMatch: {
                    legacyVsAC,
                    coldVsWarm,
                    allMatch: legacyVsAC && coldVsWarm,
                },
                legacyEntryIds,
                acWarmEntryIds,
            };
        }, { name: lorebookName, messages: LONG_REALISTIC_CHAT });
    }

    test('5k entries, 10k words: Legacy vs AC', async ({ page }) => {
        const result = await runLongChatComparison(page, 'Benchmark 5k Realistic');

        console.log('\n=== 5k Entries, 10k Words ===');
        console.log(`Legacy:   ${result.legacy.totalMs.toFixed(1)}ms (search=${result.legacy.searchMs.toFixed(1)}ms, filter=${result.legacy.filterMs.toFixed(1)}ms)`);
        console.log(`AC Cold:  ${result.acCold.totalMs.toFixed(1)}ms (build=${result.acCold.buildMs.toFixed(1)}ms, search=${result.acCold.searchMs.toFixed(1)}ms)`);
        console.log(`AC Warm:  ${result.acWarm.totalMs.toFixed(1)}ms (build=${result.acWarm.buildMs.toFixed(1)}ms, search=${result.acWarm.searchMs.toFixed(1)}ms)`);
        console.log(`Speedup:  ${(result.legacy.totalMs / result.acWarm.totalMs).toFixed(2)}x`);
        console.log(`Rounds: ${result.legacy.recursionRounds}, Activated: ${result.activatedCount}`);
        console.log(`Results match: ${result.resultsMatch.allMatch ? '✓ YES' : '✗ NO'}`);
        console.log('=============================\n');

        expect(result.activatedCount).toBeGreaterThan(0);
        expect(result.acWarm.searchMs).toBeLessThan(result.legacy.searchMs);
        expect(result.resultsMatch.allMatch).toBe(true);
    });

    test('25k entries, 10k words: Legacy vs AC', async ({ page }) => {
        test.setTimeout(180000);
        const result = await runLongChatComparison(page, 'Benchmark 25k Realistic');

        console.log('\n=== 25k Entries, 10k Words ===');
        console.log(`Legacy:   ${result.legacy.totalMs.toFixed(1)}ms (search=${result.legacy.searchMs.toFixed(1)}ms, filter=${result.legacy.filterMs.toFixed(1)}ms)`);
        console.log(`AC Cold:  ${result.acCold.totalMs.toFixed(1)}ms (build=${result.acCold.buildMs.toFixed(1)}ms, search=${result.acCold.searchMs.toFixed(1)}ms)`);
        console.log(`AC Warm:  ${result.acWarm.totalMs.toFixed(1)}ms (build=${result.acWarm.buildMs.toFixed(1)}ms, search=${result.acWarm.searchMs.toFixed(1)}ms)`);
        console.log(`Speedup:  ${(result.legacy.totalMs / result.acWarm.totalMs).toFixed(2)}x`);
        console.log(`Rounds: ${result.legacy.recursionRounds}, Activated: ${result.activatedCount}`);
        console.log(`Results match: ${result.resultsMatch.allMatch ? '✓ YES' : '✗ NO'}`);
        console.log('==============================\n');

        expect(result.activatedCount).toBeGreaterThan(0);
        expect(result.acWarm.searchMs).toBeLessThan(result.legacy.searchMs);
        expect(result.resultsMatch.allMatch).toBe(true);
    });

    test('100k entries, 10k words: Legacy vs AC', async ({ page }) => {
        test.setTimeout(600000);
        const result = await runLongChatComparison(page, 'Benchmark 100k Realistic');

        console.log('\n=== 100k Entries, 10k Words ===');
        console.log(`Legacy:   ${result.legacy.totalMs.toFixed(1)}ms (search=${result.legacy.searchMs.toFixed(1)}ms, filter=${result.legacy.filterMs.toFixed(1)}ms)`);
        console.log(`AC Cold:  ${result.acCold.totalMs.toFixed(1)}ms (build=${result.acCold.buildMs.toFixed(1)}ms, search=${result.acCold.searchMs.toFixed(1)}ms)`);
        console.log(`AC Warm:  ${result.acWarm.totalMs.toFixed(1)}ms (build=${result.acWarm.buildMs.toFixed(1)}ms, search=${result.acWarm.searchMs.toFixed(1)}ms)`);
        console.log(`Speedup:  ${(result.legacy.totalMs / result.acWarm.totalMs).toFixed(2)}x`);
        console.log(`Rounds: ${result.legacy.recursionRounds}, Activated: ${result.activatedCount}`);
        console.log(`Results match: ${result.resultsMatch.allMatch ? '✓ YES' : '✗ NO'}`);
        console.log('===============================\n');

        expect(result.activatedCount).toBeGreaterThan(0);
        expect(result.acWarm.searchMs).toBeLessThan(result.legacy.searchMs);
        expect(result.resultsMatch.allMatch).toBe(true);
    });
});

// ============================================
// Profiling Comparison: Cold vs Warm Cache
// ============================================
test.describe('Benchmark: Profiling Cold vs Warm', () => {
    test.beforeEach(setup.awaitST);

    test('25k entries: profiled cold vs warm comparison', async ({ page }) => {
        test.setTimeout(180000);

        const result = await page.evaluate(async ({ messages }) => {
            const wiModule = await import('/scripts/world-info.js');
            const { acCacheManager } = await import('/scripts/world-info/scanning/ACCacheManager.js');

            const name = 'Benchmark 25k Realistic';

            // Load lorebook once
            wiModule.worldInfoCache.delete(name);
            await wiModule.loadWorldInfo(name);
            if (!wiModule.selected_world_info.includes(name)) {
                wiModule.selected_world_info.push(name);
            }

            // Ensure AC is enabled
            wiModule.setWorldInfoUseAhoCorasick(true);
            // Clear AC cache for cold start
            acCacheManager.clear();

            const globalScanData = {
                personaDescription: '', characterDescription: '', characterPersonality: '',
                characterDepthPrompt: '', scenario: '', creatorNotes: '', trigger: 'normal',
            };
            const chat = [...messages].reverse();

            // Cold scan (cache miss)
            const coldResult = await wiModule.checkWorldInfo(chat, 8192, true, globalScanData, { returnProfiling: true });

            // Warm scan (cache hit)
            const warmResult = await wiModule.checkWorldInfo(chat, 8192, true, globalScanData, { returnProfiling: true });

            wiModule.selected_world_info = wiModule.selected_world_info.filter(x => x !== name);

            return {
                cold: coldResult.profiling,
                warm: warmResult.profiling,
                coldActivated: coldResult.allActivatedEntries?.size || 0,
                warmActivated: warmResult.allActivatedEntries?.size || 0,
            };
        }, { messages: REALISTIC_CHAT });

        console.log('\n=== 25k Profiling Comparison ===');
        console.log('COLD (cache miss):');
        console.log(`  Build: ${result.cold?.buildMs}ms, Search: ${result.cold?.searchMs}ms, Filter: ${result.cold?.filterMs}ms, Prompt: ${result.cold?.promptMs}ms`);
        console.log(`  Total: ${result.cold?.totalMs}ms, Rounds: ${result.cold?.recursionRounds}, Cache hit: ${result.cold?.cacheHit}`);

        console.log('WARM (cache hit):');
        console.log(`  Build: ${result.warm?.buildMs}ms, Search: ${result.warm?.searchMs}ms, Filter: ${result.warm?.filterMs}ms, Prompt: ${result.warm?.promptMs}ms`);
        console.log(`  Total: ${result.warm?.totalMs}ms, Rounds: ${result.warm?.recursionRounds}, Cache hit: ${result.warm?.cacheHit}`);

        if (result.cold && result.warm) {
            const buildSpeedup = result.cold.buildMs / (result.warm.buildMs || 1);
            console.log(`Build speedup: ${buildSpeedup.toFixed(1)}x`);
        }
        console.log('================================\n');

        // Warm build should be much faster than cold
        expect(result.warm?.buildMs).toBeLessThan(result.cold?.buildMs || 1);
    });
});

// ============================================
// Prebuild Test - Verifies automatic cache warming
// ============================================
test.describe('Benchmark: Prebuild Cache Warming', () => {
    test.beforeEach(setup.awaitST);

    test('prebuild warms cache for all trigger types', async ({ page }) => {
        test.setTimeout(180000);

        const result = await page.evaluate(async () => {
            const wiModule = await import('/scripts/world-info.js');
            const { acCacheManager } = await import('/scripts/world-info/scanning/ACCacheManager.js');

            const name = 'Benchmark 25k Realistic';

            // Load lorebook
            wiModule.worldInfoCache.delete(name);
            await wiModule.loadWorldInfo(name);
            if (!wiModule.selected_world_info.includes(name)) {
                wiModule.selected_world_info.push(name);
            }

            // Enable AC and clear cache
            wiModule.setWorldInfoUseAhoCorasick(true);
            acCacheManager.clear();

            const cacheSizeBefore = acCacheManager.size;

            // Manually trigger prebuild (simulates CHAT_CHANGED event)
            const prebuildStart = performance.now();
            await acCacheManager.prebuildAutomatons('test');
            const prebuildTime = performance.now() - prebuildStart;

            const cacheSizeAfter = acCacheManager.size;

            // Now run a scan - should be warm (fast)
            const globalScanData = {
                personaDescription: '', characterDescription: '', characterPersonality: '',
                characterDepthPrompt: '', scenario: '', creatorNotes: '', trigger: 'normal',
            };
            const chat = ['The knight entered the tavern near the forest.'].reverse();

            const scanStart = performance.now();
            const result = await wiModule.checkWorldInfo(chat, 8192, true, globalScanData, { returnProfiling: true });
            const scanTime = performance.now() - scanStart;

            wiModule.selected_world_info = wiModule.selected_world_info.filter(x => x !== name);

            return {
                cacheSizeBefore,
                cacheSizeAfter,
                prebuildTimeMs: prebuildTime,
                scanTimeMs: scanTime,
                profiling: result.profiling,
                activatedCount: result.allActivatedEntries?.size || 0,
            };
        });

        console.log('\n=== Prebuild Cache Warming Test ===');
        console.log(`Cache before: ${result.cacheSizeBefore}, after: ${result.cacheSizeAfter}`);
        console.log(`Prebuild time: ${result.prebuildTimeMs.toFixed(0)}ms`);
        console.log(`Scan time (post-prebuild): ${result.scanTimeMs.toFixed(0)}ms`);
        if (result.profiling) {
            console.log(`Build: ${result.profiling.buildMs}ms (should be ~0 if cache hit)`);
            console.log(`Cache hit: ${result.profiling.cacheHit}`);
        }
        console.log('====================================\n');

        // Cache should have been populated by prebuild
        expect(result.cacheSizeAfter).toBeGreaterThan(result.cacheSizeBefore);

        // Build time should be near zero (cache was warmed by prebuild)
        expect(result.profiling?.buildMs).toBeLessThan(10);

        // Scan should be fast
        expect(result.scanTimeMs).toBeLessThan(500);
    });
});

// ============================================
// Multi-Recursion Benchmarks
// ============================================
test.describe('Benchmark: Multi-Recursion', () => {
    test.beforeEach(setup.awaitST);

    test('recursion chain with profiling', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const wiModule = await import('/scripts/world-info.js');

            const name = 'Benchmark Recursion';

            wiModule.worldInfoCache.delete(name);
            await wiModule.loadWorldInfo(name);

            if (!wiModule.selected_world_info.includes(name)) {
                wiModule.selected_world_info.push(name);
            }

            const globalScanData = {
                personaDescription: '', characterDescription: '', characterPersonality: '',
                characterDepthPrompt: '', scenario: '', creatorNotes: '', trigger: 'normal',
            };

            const chat = ['chain_0 start'];
            const result = await wiModule.checkWorldInfo(chat.slice().reverse(), 16384, true, globalScanData, { returnProfiling: true });

            wiModule.selected_world_info = wiModule.selected_world_info.filter(x => x !== name);

            return {
                profiling: result.profiling,
                activatedCount: result.allActivatedEntries?.size || 0,
                content: result.worldInfoBefore + result.worldInfoAfter,
                recursiveEnabled: wiModule.world_info_recursive,
            };
        });

        console.log('\n=== Recursion Chain Profiling ===');
        console.log(`Activated: ${result.activatedCount}, Recursive enabled: ${result.recursiveEnabled}`);
        if (result.profiling) {
            console.log(`Build: ${result.profiling.buildMs}ms, Search: ${result.profiling.searchMs}ms, Filter: ${result.profiling.filterMs}ms, Prompt: ${result.profiling.promptMs}ms`);
            console.log(`Total: ${result.profiling.totalMs}ms, Recursion rounds: ${result.profiling.recursionRounds}`);
        }
        console.log('=================================\n');

        expect(result.error).toBeUndefined();
        if (result.recursiveEnabled) {
            expect(result.profiling?.recursionRounds).toBeGreaterThan(1);
        }
    });

    test('realistic lorebook with recursion chains, profiled', async ({ page }) => {
        // The realistic lorebook now has ~5% entries that trigger recursion
        const result = await runBenchmark(page, 'Benchmark 5k Realistic', REALISTIC_CHAT, { returnProfiling: true });

        expect(result.error).toBeUndefined();

        console.log('\n=== 5k Realistic with Recursion ===');
        console.log(`Total: ${result.timeMs?.toFixed(2)}ms, Activated: ${result.activatedCount}`);
        if (result.profiling) {
            console.log(`Build: ${result.profiling.buildMs}ms, Search: ${result.profiling.searchMs}ms, Filter: ${result.profiling.filterMs}ms`);
            console.log(`Recursion rounds: ${result.profiling.recursionRounds}`);
            console.log(`Entries: total=${result.profiling.entryCounts.total}, eligible=${result.profiling.entryCounts.eligible}, activated=${result.profiling.entryCounts.activated}`);
        }
        console.log('===================================\n');
    });
});
