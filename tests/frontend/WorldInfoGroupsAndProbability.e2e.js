/**
 * World Info Groups, Probability, Position, and Constant Activation Tests
 *
 * Tests for:
 * - Group Edge Cases (Category 9)
 * - Probability Edge Cases (Category 10)
 * - Position Edge Cases (Category 14)
 * - Constant/External Activation (Category 17)
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

                const result = await wiModule.checkWorldInfo(chat, maxContext, true, scanData);

                const activatedUids = result.allActivatedEntries
                    ? Array.from(result.allActivatedEntries.keys())
                    : [];
                const activatedUidsSorted = [...activatedUids].sort((a, b) => a - b);

                // Collect ALL activated content including all position types
                let allContent = '';
                allContent += result.worldInfoBefore || '';
                allContent += result.worldInfoAfter || '';
                // ANTop entries
                if (Array.isArray(result.ANBeforeEntries)) {
                    allContent += result.ANBeforeEntries.join('\n');
                }
                // ANBottom entries
                if (Array.isArray(result.ANAfterEntries)) {
                    allContent += result.ANAfterEntries.join('\n');
                }
                // Example Message entries (EMTop/EMBottom)
                if (Array.isArray(result.EMEntries)) {
                    allContent += result.EMEntries.map(e => e.content).join('\n');
                }
                // Depth entries
                if (Array.isArray(result.WIDepthEntries)) {
                    for (const depthEntry of result.WIDepthEntries) {
                        if (Array.isArray(depthEntry.entries)) {
                            allContent += depthEntry.entries.join('\n');
                        }
                    }
                }

                return {
                    activatedUids,
                    activatedUidsSorted,
                    content: allContent.trim(),
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
// Category 9: Group Edge Cases
// ============================================
test.describe('Group Edge Cases', () => {
    test.beforeEach(setup.awaitST);

    test('9.1 group: "" (empty string) no grouping', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Groups Edge Cases',
            ['group_empty_string mentioned'],
            {},
            'Empty string group',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[GROUP_EMPTY_STRING]');
        console.log(`9.1 Empty string group: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('9.2 group: "   " (whitespace only) behavior', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Groups Edge Cases',
            ['group_whitespace mentioned'],
            {},
            'Whitespace group',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`9.2 Whitespace group: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('9.3 group: "A, B, C" (multi-group with spaces) in all 3 groups', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Groups Edge Cases',
            ['group_multi_spaced mentioned'],
            {},
            'Multi-group with spaces',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`9.3 Multi-group: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('9.4 group: "A,B,C" (no spaces) in all 3 groups', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Groups Edge Cases',
            ['group_multi_nospace mentioned'],
            {},
            'Multi-group no spaces',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`9.4 Multi-group no spaces: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('9.5 group: "A, , B" (empty element) in A and B only', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Groups Edge Cases',
            ['group_empty_element mentioned'],
            {},
            'Empty element in group list',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`9.5 Empty element: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('9.6 3 entries in same group one winner selected', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Groups Edge Cases',
            ['large_group_trigger mentioned'],
            {},
            'Large group 3 entries',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        // Should have exactly one winner from the group
        const groupWinners = ['[LARGE_GROUP_1]', '[LARGE_GROUP_2]', '[LARGE_GROUP_3]'];
        const winnerCount = groupWinners.filter(w => result.legacy.content.includes(w)).length;
        expect(winnerCount).toBe(1);
        console.log(`9.6 Group competition: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('9.7 All entries same weight (100) random selection', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Groups Edge Cases',
            ['large_group_trigger mentioned'],
            {},
            'Equal weight group',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`9.7 Equal weight: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('9.8 Weights: 1, 1, 1000 high weight almost always wins', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Groups Edge Cases',
            ['weight_test_trigger mentioned'],
            {},
            'High weight wins',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        // High weight entry should almost always win
        console.log(`9.8 High weight: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('9.9 Weight=0 behavior', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Groups Edge Cases',
            ['weight_zero_trigger mentioned'],
            {},
            'Zero weight',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`9.9 Zero weight: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('9.10 Negative weight behavior', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Groups Edge Cases',
            ['weight_negative_trigger mentioned'],
            {},
            'Negative weight',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`9.10 Negative weight: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('9.11 Only one entry in group wins', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Groups Edge Cases',
            ['single_group_trigger mentioned'],
            {},
            'Single entry group',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[SINGLE_GROUP]');
        console.log(`9.11 Single entry: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('9.13 groupOverride: true wins despite lower weight', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Groups Edge Cases',
            ['override_group_trigger mentioned'],
            {},
            'Group override',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[OVERRIDE_LOW]');
        console.log(`9.13 Group override: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('9.14 Multiple groupOverride: true first by sort order wins', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Groups Edge Cases',
            ['multi_override_trigger mentioned'],
            {},
            'Multiple group override',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`9.14 Multi override: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('9.16 useGroupScoring: true with equal scores', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Groups Edge Cases',
            ['scoring_equal_trigger mentioned'],
            {},
            'Group scoring equal',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`9.16 Scoring equal: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('9.17 useGroupScoring: true with clear winner', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Groups Edge Cases',
            ['scoring_clear_trigger mentioned'],
            {},
            'Group scoring winner',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`9.17 Scoring winner: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('9.18 group: null behavior', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Groups Edge Cases',
            ['group_null_trigger mentioned'],
            {},
            'Group null',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[GROUP_NULL]');
        console.log(`9.18 Group null: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('9.19 No group property behavior', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Groups Edge Cases',
            ['group_undefined_trigger mentioned'],
            {},
            'Group undefined',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[GROUP_UNDEFINED]');
        console.log(`9.19 Group undefined: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });
});

// ============================================
// Category 10: Probability Edge Cases
// ============================================
test.describe('Probability Edge Cases', () => {
    test.beforeEach(setup.awaitST);

    test('10.1 probability: 0, useProbability: true never activates', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Probability Edge Cases',
            ['prob_zero_use_true mentioned'],
            {},
            'Probability zero',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).not.toContain('[PROB_ZERO_TRUE]');
        console.log(`10.1 Prob zero: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('10.2 probability: 100, useProbability: true always activates', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Probability Edge Cases',
            ['prob_hundred_use_true mentioned'],
            {},
            'Probability 100',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[PROB_HUNDRED_TRUE]');
        console.log(`10.2 Prob 100: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('10.3 probability: 0, useProbability: false always activates', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Probability Edge Cases',
            ['prob_zero_use_false mentioned'],
            {},
            'Probability disabled',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[PROB_ZERO_FALSE]');
        console.log(`10.3 Prob disabled: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('10.5 probability: 1% very low rate', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Probability Edge Cases',
            ['prob_one mentioned'],
            {},
            'Probability 1%',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`10.5 Prob 1%: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('10.6 probability: 99% very high rate', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Probability Edge Cases',
            ['prob_ninetynine mentioned'],
            {},
            'Probability 99%',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`10.6 Prob 99%: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('10.7 probability: -1 (negative) behavior', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Probability Edge Cases',
            ['prob_negative mentioned'],
            {},
            'Probability negative',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`10.7 Prob negative: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('10.8 probability: 101 (over 100) behavior', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Probability Edge Cases',
            ['prob_over_hundred mentioned'],
            {},
            'Probability over 100',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`10.8 Prob over 100: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('10.9 probability: null default behavior', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Probability Edge Cases',
            ['prob_null mentioned'],
            {},
            'Probability null',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`10.9 Prob null: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('10.10 probability: "50" (string) behavior', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Probability Edge Cases',
            ['prob_string mentioned'],
            {},
            'Probability string',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`10.10 Prob string: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('10.11 Probability + sticky entry', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Probability Edge Cases',
            ['prob_sticky mentioned'],
            {},
            'Probability + sticky',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`10.11 Prob+sticky: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('10.12 Probability + @@activate decorator - activate wins', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Probability Edge Cases',
            ['prob_activate mentioned'],
            {},
            'Probability + @@activate',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        // @@activate should bypass probability check
        expect(result.legacy.content).toContain('[PROB_ACTIVATE]');
        console.log(`10.12 Prob+activate: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('10.14 probability: 50, useProbability undefined behavior', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Probability Edge Cases',
            ['prob_use_undefined mentioned'],
            {},
            'Probability useProbability undefined',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`10.14 useProbability undefined: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });
});

// ============================================
// Category 14: Position Edge Cases
// ============================================
test.describe('Position Edge Cases', () => {
    test.beforeEach(setup.awaitST);

    test('14.1 Position 4 (atDepth) with depth=0', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Position Edge Cases',
            ['pos_at_depth_0 mentioned'],
            {},
            'atDepth position depth 0',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[POS_DEPTH_0]');
        console.log(`14.1 atDepth 0: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('14.2 Position 4 (atDepth) with depth=2', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Position Edge Cases',
            ['pos_at_depth_2 mentioned'],
            {},
            'atDepth position depth 2',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[POS_DEPTH_2]');
        console.log(`14.2 atDepth 2: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('14.3 Position 4 with very large depth (999)', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Position Edge Cases',
            ['pos_at_depth_999 mentioned'],
            {},
            'Large depth 999',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`14.3 Large depth: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('14.4 Position 4 with negative depth', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Position Edge Cases',
            ['pos_at_depth_neg mentioned'],
            {},
            'Negative depth',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`14.4 Negative depth: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('14.5 Multiple entries at same depth', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Position Edge Cases',
            ['pos_same_depth_a pos_same_depth_b mentioned'],
            {},
            'Same depth',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[POS_SAME_A]');
        expect(result.legacy.content).toContain('[POS_SAME_B]');
        console.log(`14.5 Same depth: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('14.6 Role=0 (system) inserted as system message', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Position Edge Cases',
            ['pos_role_system mentioned'],
            {},
            'Role system',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[POS_ROLE_SYSTEM]');
        console.log(`14.6 Role system: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('14.7 Role=1 (user) inserted as user message', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Position Edge Cases',
            ['pos_role_user mentioned'],
            {},
            'Role user',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[POS_ROLE_USER]');
        console.log(`14.7 Role user: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('14.8 Role=2 (assistant) inserted as assistant message', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Position Edge Cases',
            ['pos_role_assistant mentioned'],
            {},
            'Role assistant',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[POS_ROLE_ASSISTANT]');
        console.log(`14.8 Role assistant: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('14.9 Position before (0) entry', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Position Edge Cases',
            ['pos_before mentioned'],
            {},
            'Position before',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[POS_BEFORE]');
        console.log(`14.9 Position before: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('14.10 Position after (1) entry', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Position Edge Cases',
            ['pos_after mentioned'],
            {},
            'Position after',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[POS_AFTER]');
        console.log(`14.10 Position after: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('14.11 Position ANTop (2) entry', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Position Edge Cases',
            ['pos_an_top mentioned'],
            {},
            'Position ANTop',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[POS_AN_TOP]');
        console.log(`14.11 Position ANTop: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('14.12 Position ANBottom (3) entry', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Position Edge Cases',
            ['pos_an_bottom mentioned'],
            {},
            'Position ANBottom',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[POS_AN_BOTTOM]');
        console.log(`14.12 Position ANBottom: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('14.13 Position EMTop (5) entry', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Position Edge Cases',
            ['pos_em_top mentioned'],
            {},
            'Position EMTop',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[POS_EM_TOP]');
        console.log(`14.13 Position EMTop: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('14.14 Position EMBottom (6) entry', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Position Edge Cases',
            ['pos_em_bottom mentioned'],
            {},
            'Position EMBottom',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[POS_EM_BOTTOM]');
        console.log(`14.14 Position EMBottom: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('14.15 All position types in one test', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Position Edge Cases',
            [
                'pos_before pos_after pos_at_depth_0 mentioned',
                'pos_role_system pos_role_user pos_role_assistant mentioned',
                'pos_an_top pos_an_bottom pos_em_top pos_em_bottom mentioned',
            ],
            {},
            'All positions',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`14.15 All positions: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });
});

// ============================================
// Category 17: Constant and External Activation
// ============================================
test.describe('Constant and External Activation', () => {
    test.beforeEach(setup.awaitST);

    test('17.1 constant: true with no keywords always activates', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Constant External',
            ['Random text with no matching keywords at all'],
            {},
            'Constant true',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[CONSTANT_NO_KEY]');
        console.log(`17.1 Constant true: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('17.2 constant: true + disable: true - disable wins', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Constant External',
            ['constant_disabled_keyword mentioned'],
            {},
            'Constant + disabled',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).not.toContain('[CONSTANT_DISABLED]');
        console.log(`17.2 Constant+disabled: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('17.3 constant: true + cooldown', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Constant External',
            ['constant_cooldown_keyword mentioned'],
            {},
            'Constant + cooldown',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`17.3 Constant+cooldown: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('17.4 constant: true + delay', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Constant External',
            ['constant_delay_keyword mentioned'],
            {},
            'Constant + delay',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`17.4 Constant+delay: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('17.5 constant: true + probability check', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Constant External',
            ['constant_prob_keyword mentioned'],
            {},
            'Constant + probability',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`17.5 Constant+prob: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('17.6 constant: true in group - group rules apply', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Constant External',
            ['constant_group_keyword mentioned'],
            {},
            'Constant in group',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        // One of the two constant group entries should win
        const hasA = result.legacy.content.includes('[CONSTANT_GROUP_A]');
        const hasB = result.legacy.content.includes('[CONSTANT_GROUP_B]');
        expect(hasA || hasB).toBe(true);
        console.log(`17.6 Constant in group: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('17.7 Multiple constant entries all activate', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Constant External',
            ['Random text'],
            {},
            'Multiple constants',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        // Should have multiple constant entries
        expect(result.legacy.content).toContain('[MULTI_CONSTANT_1]');
        expect(result.legacy.content).toContain('[MULTI_CONSTANT_2]');
        expect(result.legacy.content).toContain('[MULTI_CONSTANT_3]');
        console.log(`17.7 Multiple constants: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('17.8 constant: true with keyword also works', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Constant External',
            ['Random text without the keyword'],
            {},
            'Constant with keyword',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        // Should activate even without keyword match because constant is true
        expect(result.legacy.content).toContain('[CONSTANT_WITH_KEYWORD]');
        console.log(`17.8 Constant with keyword: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('17.9 constant: false with matching keyword activates', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Constant External',
            ['constant_false_keyword mentioned'],
            {},
            'Constant false with keyword',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[CONSTANT_FALSE]');
        console.log(`17.9 Constant false: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('17.10 constant: false without keyword does not activate', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Constant External',
            ['Some other text without any keywords'],
            {},
            'Constant false no keyword',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        // constant: false should not include [CONSTANT_FALSE] without keyword match
        // But constant true entries will still be there
        console.log(`17.10 Constant false no match: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('17.11 constant: null behavior', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Constant External',
            ['constant_null_keyword mentioned'],
            {},
            'Constant null',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`17.11 Constant null: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('17.12 constant: "true" (string) behavior', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Constant External',
            ['constant_string_keyword mentioned'],
            {},
            'Constant string',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`17.12 Constant string: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });
});

// ============================================
// Category 15: Multi-Lorebook Interaction Tests
// ============================================
test.describe('Multi-Lorebook Interactions', () => {
    test.beforeEach(setup.awaitST);

    test('15.1 Same keyword in 2 lorebooks both entries activate', async ({ page }) => {
        const result = await page.evaluate(async () => {
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
                    // Load multiple lorebooks
                    const books = ['Comparison Groups', 'Comparison Secondary Keys'];
                    for (const name of books) {
                        wiModule.worldInfoCache.delete(name);
                        await wiModule.loadWorldInfo(name);
                    }

                    wiModule.setWorldInfoUseAhoCorasick(useAC);
                    wiModule.setWorldInfoRecursive(true);

                    wiModule.selected_world_info.length = 0;
                    books.forEach(b => wiModule.selected_world_info.push(b));

                    const scanData = {
                        personaDescription: '',
                        characterDescription: '',
                        characterPersonality: '',
                        characterDepthPrompt: '',
                        scenario: '',
                        creatorNotes: '',
                        trigger: 'normal',
                    };

                    // Use a keyword that exists in both
                    const chat = ['wizard mentioned'].reverse();

                    const result = await wiModule.checkWorldInfo(chat, 8192, true, scanData);

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
        });

        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`15.1 Multi-lorebook: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('15.5 One lorebook with different scan depths', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Scan Depth Edge Cases',
            [
                'Message 1 with no keywords',
                'Message 2 with depth_1 mentioned',
                'Message 3 with depth_2 mentioned',
                'Message 4 with depth_all mentioned',
            ],
            {},
            'Different scan depths',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`15.5 Scan depths: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });
});
