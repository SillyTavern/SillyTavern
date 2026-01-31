/**
 * World Info Recursion Complex Tests
 *
 * Tests complex recursion scenarios including:
 * - Timed Effects Edge Cases (Category 6)
 * - delayUntilRecursion Edge Cases (Category 7)
 * - Recursion Filter Combinations (Category 8)
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
// Category 6: Timed Effects Edge Cases
// ============================================
test.describe('Timed Effects Edge Cases', () => {
    test.beforeEach(setup.awaitST);

    test('6.7 Sticky=0 (explicitly zero) no sticky effect', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Timed Effects Edge Cases',
            ['sticky_zero_keyword mentioned'],
            {},
            'Sticky zero',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[STICKY_ZERO]');
        console.log(`6.7 Sticky zero: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('6.8 Cooldown=0 (explicitly zero) no cooldown effect', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Timed Effects Edge Cases',
            ['cooldown_zero_keyword mentioned'],
            {},
            'Cooldown zero',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[COOLDOWN_ZERO]');
        console.log(`6.8 Cooldown zero: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('6.9 Delay=0 (explicitly zero) no delay effect', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Timed Effects Edge Cases',
            ['delay_zero_keyword mentioned'],
            {},
            'Delay zero',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[DELAY_ZERO]');
        console.log(`6.9 Delay zero: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('6.10 Very long sticky (sticky=100) works correctly', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Timed Effects Edge Cases',
            ['sticky_long_keyword mentioned'],
            {},
            'Sticky long',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[STICKY_LONG]');
        console.log(`6.10 Sticky long: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('6.11 Sticky + probability (prob=50%, sticky active)', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Timed Effects Edge Cases',
            ['sticky_prob_keyword mentioned'],
            {},
            'Sticky + probability',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`6.11 Sticky+prob: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('6.6 Sticky + cooldown on same entry', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Timed Effects Edge Cases',
            ['sticky_cooldown_same_keyword mentioned'],
            {},
            'Sticky + cooldown same',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`6.6 Sticky+cooldown: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('Sticky with protection flag', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Timed Effects Edge Cases',
            ['sticky_protected_keyword mentioned'],
            {},
            'Sticky protected',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[STICKY_PROTECTED]');
        console.log(`Sticky protected: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('All timed effects together', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Timed Effects Edge Cases',
            ['all_timed_keyword mentioned'],
            {},
            'All timed effects',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`All timed: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('Negative sticky value', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Timed Effects Edge Cases',
            ['sticky_negative_keyword mentioned'],
            {},
            'Sticky negative',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`Sticky negative: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('Null sticky value', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Timed Effects Edge Cases',
            ['sticky_null_keyword mentioned'],
            {},
            'Sticky null',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`Sticky null: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('6.14 Multiple entries with same sticky duration', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Timed Effects Edge Cases',
            ['multi_sticky_a_keyword and multi_sticky_b_keyword mentioned'],
            {},
            'Multiple same sticky',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[MULTI_STICKY_A]');
        expect(result.legacy.content).toContain('[MULTI_STICKY_B]');
        console.log(`6.14 Multi sticky: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });
});

// ============================================
// Category 7: delayUntilRecursion Edge Cases
// ============================================
test.describe('delayUntilRecursion Edge Cases', () => {
    test.beforeEach(setup.awaitST);

    test('7.1 delayUntilRecursion: true activates on recursion level 1', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison DelayUntilRecursion',
            ['delay_recursion_source_trigger starts'],
            {},
            'delayUntilRecursion true',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`7.1 Delay true: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('7.2 delayUntilRecursion: 1 same as true', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison DelayUntilRecursion',
            ['delay_recursion_1_keyword in chat directly'],
            {},
            'delayUntilRecursion 1',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        // Direct keyword in chat should NOT activate with delay=1
        expect(result.legacy.content).not.toContain('[DELAY_RECURSION_1]');
        console.log(`7.2 Delay 1: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('7.3 delayUntilRecursion: 2 activates on level 2 only', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison DelayUntilRecursion',
            ['delay_recursion_2_keyword in chat'],
            {},
            'delayUntilRecursion 2',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        // Should not activate on level 0 (chat) or level 1
        expect(result.legacy.content).not.toContain('[DELAY_RECURSION_2]');
        console.log(`7.3 Delay 2: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('7.4 delayUntilRecursion: 3 activates on level 3 only', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison DelayUntilRecursion',
            ['delay_recursion_3_keyword in chat'],
            {},
            'delayUntilRecursion 3',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).not.toContain('[DELAY_RECURSION_3]');
        console.log(`7.4 Delay 3: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('7.6 delayUntilRecursion: 0 activates immediately (no delay)', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison DelayUntilRecursion',
            ['delay_recursion_0_keyword in chat'],
            {},
            'delayUntilRecursion 0',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        // delay=0 should activate immediately
        expect(result.legacy.content).toContain('[DELAY_RECURSION_0]');
        console.log(`7.6 Delay 0: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('7.7 delayUntilRecursion: -1 (negative) behavior', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison DelayUntilRecursion',
            ['delay_recursion_neg_keyword in chat'],
            {},
            'delayUntilRecursion negative',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`7.7 Delay negative: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('7.8 delayUntilRecursion: "1" (string) behavior', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison DelayUntilRecursion',
            ['delay_recursion_string_keyword in chat'],
            {},
            'delayUntilRecursion string',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`7.8 Delay string: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('7.5 delayUntilRecursion: 1 + sticky override activates immediately', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison DelayUntilRecursion',
            ['delay_recursion_sticky_keyword in chat'],
            {},
            'delayUntilRecursion + sticky',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`7.5 Delay+sticky: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('7.12 Deep delay (level 5+) with shallow recursion max', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison DelayUntilRecursion',
            ['delay_recursion_deep_keyword in chat'],
            {},
            'Deep delay',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        // Should not activate if recursion max is less than 5
        expect(result.legacy.content).not.toContain('[DELAY_RECURSION_DEEP]');
        console.log(`7.12 Deep delay: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('7.11 Multiple entries with different delay levels - staggered activation', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison DelayUntilRecursion',
            ['staggered_delay_a in chat'],
            {},
            'Staggered delay',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`7.11 Staggered: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('7.9-7.10 Keyword in both original and recursion', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison DelayUntilRecursion',
            ['delay_both_trigger and delay_recursion_only_keyword both in chat'],
            {},
            'Keyword both places',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`7.9-10 Both places: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });
});

// ============================================
// Category 8: Recursion Filter Combinations
// ============================================
test.describe('Recursion Filter Combinations', () => {
    test.beforeEach(setup.awaitST);

    test('8.1 excludeRecursion + delayUntilRecursion never activates', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Recursion Complex',
            ['exclude_and_delay_trigger mentioned'],
            {},
            'Exclude + delay',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        // This entry can never activate - excluded from recursion but delayed until recursion
        expect(result.legacy.content).not.toContain('[EXCLUDE_AND_DELAY]');
        console.log(`8.1 Exclude+delay: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('8.2 preventRecursion stops chain at level 2', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Recursion Complex',
            ['prevent_chain_start mentioned'],
            {},
            'Prevent chain',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        // Start and middle should activate, end should NOT
        expect(result.legacy.content).toContain('[PREVENT_CHAIN_START]');
        expect(result.legacy.content).toContain('[PREVENT_CHAIN_MIDDLE]');
        expect(result.legacy.content).not.toContain('[PREVENT_CHAIN_END]');
        console.log(`8.2 Prevent chain: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('8.3 Circular: A→B→A with preventRecursion on B stops at B', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Recursion Complex',
            ['circular_a_trigger mentioned'],
            {},
            'Circular with prevent',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[CIRCULAR_A]');
        expect(result.legacy.content).toContain('[CIRCULAR_B]');
        console.log(`8.3 Circular prevent: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('8.4 Circular: A→B→A without prevention activates A, B once each', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Recursion Complex',
            ['circular_no_prevent_a mentioned'],
            {},
            'Circular no prevent',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[CIRCULAR_NP_A]');
        expect(result.legacy.content).toContain('[CIRCULAR_NP_B]');
        console.log(`8.4 Circular no prevent: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('8.7 Branching: A triggers B and C - both activate', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Recursion Complex',
            ['branch_root_trigger mentioned'],
            {},
            'Branching',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[BRANCH_ROOT]');
        expect(result.legacy.content).toContain('[BRANCH_B]');
        expect(result.legacy.content).toContain('[BRANCH_C]');
        console.log(`8.7 Branching: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('8.8 Diamond: A→B, A→C, B→D, C→D - D activates once', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Recursion Complex',
            ['diamond_a_trigger mentioned'],
            {},
            'Diamond pattern',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[DIAMOND_A]');
        expect(result.legacy.content).toContain('[DIAMOND_B]');
        expect(result.legacy.content).toContain('[DIAMOND_C]');
        expect(result.legacy.content).toContain('[DIAMOND_D]');
        // D should only appear once even though triggered by both B and C
        const dCount = (result.legacy.content.match(/\[DIAMOND_D\]/g) || []).length;
        expect(dCount).toBe(1);
        console.log(`8.8 Diamond: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}, D count=${dCount}`);
    });

    test('8.9 Self-referencing: A content contains A key - no infinite loop', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Recursion Complex',
            ['self_ref_trigger mentioned'],
            {},
            'Self-reference',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        // Should activate once without infinite loop
        expect(result.legacy.content).toContain('[SELF_REF]');
        const selfCount = (result.legacy.content.match(/\[SELF_REF\]/g) || []).length;
        expect(selfCount).toBe(1);
        console.log(`8.9 Self-ref: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('8.10 excludeRecursion + sticky (sticky active) activates via sticky', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Recursion Complex',
            ['exclude_sticky_trigger mentioned'],
            {},
            'Exclude + sticky',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        // Should activate on first scan (not recursion) since keyword is in chat
        expect(result.legacy.content).toContain('[EXCLUDE_STICKY]');
        console.log(`8.10 Exclude+sticky: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('8.11 preventRecursion + delayUntilRecursion complex interaction', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Recursion Complex',
            ['prevent_and_delay_trigger mentioned'],
            {},
            'Prevent + delay',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`8.11 Prevent+delay: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('8.5 Deep chain: 5 entries, each triggers next - all 5 activate', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Recursion Complex',
            ['deep_chain_1 mentioned'],
            {},
            'Deep chain 5',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[DEEP_1]');
        expect(result.legacy.content).toContain('[DEEP_2]');
        expect(result.legacy.content).toContain('[DEEP_3]');
        expect(result.legacy.content).toContain('[DEEP_4]');
        expect(result.legacy.content).toContain('[DEEP_5]');
        console.log(`8.5 Deep chain: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('Recursion entry in group', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Recursion Complex',
            ['recursion_with_group mentioned'],
            {},
            'Recursion in group',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`Recursion group: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });
});

// ============================================
// Additional Recursion Tests from Existing File
// ============================================
test.describe('Recursion Additional Scenarios', () => {
    test.beforeEach(setup.awaitST);

    test('Basic recursion chain from existing lorebook', async ({ page }) => {
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
        console.log(`Basic recursion: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('excludeRecursion entry from existing lorebook', async ({ page }) => {
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
        console.log(`excludeRecursion: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('delayUntilRecursion should activate on recursion turn', async ({ page }) => {
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
        // Source should activate on turn 1
        expect(result.legacy.content).toContain('[DELAY_SOURCE]');
        // Delayed entry SHOULD activate on turn 2 (triggered by source's content)
        expect(result.legacy.content).toContain('[DELAY_TARGET]');
        console.log(`Delay turn 2: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('preventRecursion should stop chain', async ({ page }) => {
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
        // Source activates, but chain should be stopped
        expect(result.legacy.content).toContain('[PREVENT_RECURSION_SOURCE]');
        expect(result.legacy.content).not.toContain('[PREVENT_NEXT]');
        console.log(`preventRecursion: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });
});
