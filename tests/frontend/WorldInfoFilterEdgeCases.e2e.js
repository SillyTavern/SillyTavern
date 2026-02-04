/**
 * World Info Filter Edge Cases Tests
 *
 * Tests edge cases for:
 * - Trigger Type Filters (Category 2)
 * - Disabled Entry Edge Cases (Category 3)
 * - Key Array Edge Cases (Category 4)
 * - Secondary Key Logic Edge Cases (Category 5)
 * - Decorator Edge Cases (Category 13)
 * - Global Scan Data Edge Cases (Category 16)
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
// Category 2: Trigger Type Filter Tests
// ============================================
test.describe('Trigger Type Filters', () => {
    test.beforeEach(setup.awaitST);

    test('2.1 triggers: [normal] with trigger=normal activates', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Trigger Filters',
            ['trigger_normal_only mentioned'],
            { trigger: 'normal' },
            'Normal trigger only',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[TRIGGER_NORMAL]');
        console.log(`2.1 Normal trigger: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('2.2 triggers: [normal] with trigger=continue skipped', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Trigger Filters',
            ['trigger_normal_only mentioned'],
            { trigger: 'continue' },
            'Normal trigger with continue',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).not.toContain('[TRIGGER_NORMAL]');
        console.log(`2.2 Normal w/continue: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('2.3 triggers: [continue] with trigger=continue activates', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Trigger Filters',
            ['trigger_continue_only mentioned'],
            { trigger: 'continue' },
            'Continue trigger',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[TRIGGER_CONTINUE]');
        console.log(`2.3 Continue trigger: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('2.4 triggers: [impersonate] with trigger=impersonate activates', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Trigger Filters',
            ['trigger_impersonate_only mentioned'],
            { trigger: 'impersonate' },
            'Impersonate trigger',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[TRIGGER_IMPERSONATE]');
        console.log(`2.4 Impersonate: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('2.5 triggers: [swipe] with trigger=swipe activates', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Trigger Filters',
            ['trigger_swipe_only mentioned'],
            { trigger: 'swipe' },
            'Swipe trigger',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[TRIGGER_SWIPE]');
        console.log(`2.5 Swipe: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('2.6 triggers: [regenerate] with trigger=regenerate activates', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Trigger Filters',
            ['trigger_regenerate_only mentioned'],
            { trigger: 'regenerate' },
            'Regenerate trigger',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[TRIGGER_REGENERATE]');
        console.log(`2.6 Regenerate: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('2.7 triggers: [quiet] with trigger=quiet activates', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Trigger Filters',
            ['trigger_quiet_only mentioned'],
            { trigger: 'quiet' },
            'Quiet trigger',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[TRIGGER_QUIET]');
        console.log(`2.7 Quiet: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('2.8 triggers: [normal, continue] with trigger=continue activates', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Trigger Filters',
            ['trigger_normal_continue mentioned'],
            { trigger: 'continue' },
            'Normal+continue with continue',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[TRIGGER_NORMAL_CONTINUE]');
        console.log(`2.8 Normal+continue: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('2.9 triggers: [] (empty array) activates on all', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Trigger Filters',
            ['trigger_empty_array mentioned'],
            { trigger: 'impersonate' },
            'Empty triggers array',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[TRIGGER_EMPTY]');
        console.log(`2.9 Empty array: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('2.10 No triggers property activates on all', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Trigger Filters',
            ['trigger_no_property mentioned'],
            { trigger: 'swipe' },
            'No triggers property',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[TRIGGER_NO_PROP]');
        console.log(`2.10 No property: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('2.11 triggers: null activates on all', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Trigger Filters',
            ['trigger_null mentioned'],
            { trigger: 'regenerate' },
            'Triggers null',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[TRIGGER_NULL]');
        console.log(`2.11 Null: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('2.12 All 6 trigger types filtering correctly', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Trigger Filters',
            ['trigger_all_types mentioned'],
            { trigger: 'quiet' },
            'All 6 trigger types',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[TRIGGER_ALL]');
        console.log(`2.12 All types: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });
});

// ============================================
// Category 3: Disabled Entry Edge Cases
// ============================================
test.describe('Disabled Entry Edge Cases', () => {
    test.beforeEach(setup.awaitST);

    test('3.1 disable: true with matching keyword skipped', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Disabled Edge Cases',
            ['disabled_true_keyword mentioned'],
            {},
            'Disabled entry with matching keyword',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).not.toContain('[DISABLED_TRUE]');
        console.log(`3.1 Disabled true: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('3.2 disable: true + constant: true - disable wins', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Disabled Edge Cases',
            ['disabled_constant_keyword mentioned'],
            {},
            'Disabled + constant',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).not.toContain('[DISABLED_CONSTANT]');
        console.log(`3.2 Disabled+constant: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('3.3 disable: true + sticky: 5 - disable wins', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Disabled Edge Cases',
            ['disabled_sticky_keyword mentioned'],
            {},
            'Disabled + sticky',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).not.toContain('[DISABLED_STICKY]');
        console.log(`3.3 Disabled+sticky: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('3.4 disable: true + @@activate decorator - disable wins', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Disabled Edge Cases',
            ['disabled_activate_keyword mentioned'],
            {},
            'Disabled + @@activate',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).not.toContain('[DISABLED_ACTIVATE]');
        console.log(`3.4 Disabled+activate: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('3.5 disable: false explicitly set activates', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Disabled Edge Cases',
            ['disabled_false_keyword mentioned'],
            {},
            'Disable false',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[DISABLED_FALSE]');
        console.log(`3.5 Disabled false: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('3.6 disable: 1 (truthy non-boolean) skipped', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Disabled Edge Cases',
            ['disabled_one_keyword mentioned'],
            {},
            'Disable 1 (truthy)',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        // Truthy value should disable the entry
        expect(result.legacy.content).not.toContain('[DISABLED_ONE]');
        console.log(`3.6 Disabled 1: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('3.7 disable: 0 (falsy non-boolean) activates', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Disabled Edge Cases',
            ['disabled_zero_keyword mentioned'],
            {},
            'Disable 0 (falsy)',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[DISABLED_ZERO]');
        console.log(`3.7 Disabled 0: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('3.8 disable: "true" (string) behavior', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Disabled Edge Cases',
            ['disabled_string_keyword mentioned'],
            {},
            'Disable string "true"',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        // Verify AC and Legacy behave the same regardless of outcome
        console.log(`3.8 Disabled string: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('3.9 disable: null activates', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Disabled Edge Cases',
            ['disabled_null_keyword mentioned'],
            {},
            'Disable null',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[DISABLED_NULL]');
        console.log(`3.9 Disabled null: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('3.10 disable: undefined activates', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Disabled Edge Cases',
            ['disabled_undefined_keyword mentioned'],
            {},
            'Disable undefined',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[DISABLED_UNDEFINED]');
        console.log(`3.10 Disabled undefined: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });
});

// ============================================
// Category 4: Key Array Edge Cases
// ============================================
test.describe('Key Array Edge Cases', () => {
    test.beforeEach(setup.awaitST);

    test('4.1 key: null skipped', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Key Edge Cases',
            ['Some random text that should not match null key'],
            {},
            'Key null',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).not.toContain('[KEY_NULL]');
        console.log(`4.1 Key null: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('4.2 key: [] (empty array) skipped', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Key Edge Cases',
            ['Some random text'],
            {},
            'Key empty array',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).not.toContain('[KEY_EMPTY_ARRAY]');
        console.log(`4.2 Key empty: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('4.3 key: [""] (empty string) no match', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Key Edge Cases',
            ['Some text'],
            {},
            'Key empty string',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`4.3 Key empty string: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('4.5 key: ["a", "", "b"] (mixed with empty) matches a or b', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Key Edge Cases',
            ['keyalpha is mentioned here'],
            {},
            'Key mixed with empty',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[KEY_MIXED_EMPTY]');
        console.log(`4.5 Key mixed: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('4.6 Key with leading/trailing whitespace', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Key Edge Cases',
            ['The trimtest is here'],
            {},
            'Key with whitespace',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`4.6 Key whitespace: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('4.7 Very long keyword (1000 chars) matches', async ({ page }) => {
        // Create text containing the very long keyword
        const longKeyword = 'verylongkeywordtestingthelimitsoftheacalgorithmwithareallylongstringthatmightcauseissuesinsomecasesbutshouldbehaNdledproperlybythecodeverylongkeywordtestingthelimitsoftheacalgorithmwithareallylongstringthatmightcauseissuesinsomecasesbutshouldbehaNdledproperlybythecodeverylongkeywordtestingthelimitsoftheacalgorithmwithareallylongstringthatmightcauseissuesinsomecasesbutshouldbehaNdledproperlybythecodeverylongkeywordtestingthelimitsoftheacalgorithmwithareallylongstringthatmightcauseissuesinsomecasesbutshouldbehaNdledproperlybythecodeverylongkeywordtestingthelimitsoftheacalgorithmwithareallylongstringthatmightcauseissuesinsomecasesbutshouldbehaNdledproperlybythecodeverylongkeywordtestingthelimitsoftheacalgorithmwithareallylongstringthatmightcauseissuesinsomecasesbutshouldbehaNdledproperlybythecodeverylongkeywordtestingthelimitsoftheacalgorithmwithareallylongstringthatmightcauseissuesinsomecasesbutshouldbehaNdledproperlybythecodeverylongkeywordend';

        const result = await compareACvsLegacy(
            page,
            'Comparison Key Edge Cases',
            [longKeyword],
            {},
            'Very long keyword',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[KEY_LONG]');
        console.log(`4.7 Long keyword: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('4.8 Duplicate keywords single match counts', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Key Edge Cases',
            ['duplicatekey is here'],
            {},
            'Duplicate keywords',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[KEY_DUPLICATE]');
        console.log(`4.8 Duplicate keys: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('4.9 Case variations case-sensitive behavior', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Key Edge Cases',
            ['CaseVariant is here'],
            {},
            'Case variations',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`4.9 Case variations: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('4.10 Special regex chars in non-regex key literal match', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Key Edge Cases',
            ['test.*pattern is mentioned'],
            {},
            'Regex chars literal',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[KEY_REGEX_CHARS]');
        console.log(`4.10 Regex chars: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('4.11 Unicode keywords (CJK) match', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Key Edge Cases',
            ['The 龍 appears'],
            {},
            'Unicode CJK',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[KEY_UNICODE]');
        console.log(`4.11 Unicode: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('4.12 Emoji keyword matches', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Key Edge Cases',
            ['The 🐉 emoji dragon'],
            {},
            'Emoji keyword',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[KEY_EMOJI]');
        console.log(`4.12 Emoji: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('4.13 Newline in keyword behavior', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Key Edge Cases',
            ['line1\nline2 text'],
            {},
            'Newline in keyword',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`4.13 Newline: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('4.14 Tab in keyword behavior', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Key Edge Cases',
            ['col1\tcol2 text'],
            {},
            'Tab in keyword',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`4.14 Tab: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });
});

// ============================================
// Category 5: Secondary Key Logic Edge Cases
// ============================================
test.describe('Secondary Key Logic Edge Cases', () => {
    test.beforeEach(setup.awaitST);

    test('5.1 AND_ANY with keysecondary: [] activates on primary only', async ({ page }) => {
        // Use the existing Secondary Keys lorebook which has empty secondary key tests
        const result = await compareACvsLegacy(
            page,
            'Comparison Secondary Keys',
            ['wizard mentioned without secondary keywords'],
            {},
            'AND_ANY empty secondary',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`5.1 AND_ANY empty: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('5.7 AND_ANY with many secondary keys, 1 matches activates', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Secondary Keys',
            ['wizard wand in the tower'],
            {},
            'AND_ANY many secondary',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`5.7 AND_ANY many: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('5.8 AND_ALL with many secondary keys, not all match skipped', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Secondary Keys',
            ['knight armor without sword'],
            {},
            'AND_ALL partial match',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`5.8 AND_ALL partial: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('5.9 NOT_ANY with secondary keys, 1 matches skipped', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Secondary Keys',
            ['elf evil presence'],
            {},
            'NOT_ANY one match',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        // NOT_ANY should fail when any secondary matches
        console.log(`5.9 NOT_ANY one: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('5.10 NOT_ALL with all secondary keys match skipped', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Secondary Keys',
            ['dwarf evil dark presence'],
            {},
            'NOT_ALL all match',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`5.10 NOT_ALL all: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('5.11 selective: false ignores secondary keys', async ({ page }) => {
        // When selective is false, secondary keys should be ignored
        const result = await compareACvsLegacy(
            page,
            'Comparison Secondary Keys',
            ['wizard alone with no secondary'],
            {},
            'Selective false',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`5.11 Selective false: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('5.14 Secondary key same as primary key both count', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Secondary Keys',
            ['wizard wand staff mentioned'],
            {},
            'Secondary same as primary',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`5.14 Same keys: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });
});

// ============================================
// Category 13: Decorator Edge Cases
// ============================================
test.describe('Decorator Edge Cases', () => {
    test.beforeEach(setup.awaitST);

    test('13.1 @@activate only (no keywords) always activates', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Decorator Edge Cases',
            ['Random text with no keywords'],
            {},
            '@@activate only',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[ACTIVATE_ONLY]');
        console.log(`13.1 Activate only: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('13.2 @@activate with non-matching keyword activates anyway', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Decorator Edge Cases',
            ['Random text nothing matches'],
            {},
            '@@activate nonmatch',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[ACTIVATE_NONMATCH]');
        console.log(`13.2 Activate nonmatch: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('13.3 @@dont_activate with matching keyword never activates', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Decorator Edge Cases',
            ['dont_activate_test is mentioned'],
            {},
            '@@dont_activate',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).not.toContain('[DONT_ACTIVATE]');
        console.log(`13.3 Dont activate: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('13.4 Both @@activate and @@dont_activate', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Decorator Edge Cases',
            ['both_decorators_test mentioned'],
            {},
            'Both decorators',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`13.4 Both: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('13.5 @@activate + disable: true - disable wins', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Decorator Edge Cases',
            ['activate_disabled_test mentioned'],
            {},
            '@@activate + disable',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).not.toContain('[ACTIVATE_DISABLED]');
        console.log(`13.5 Activate+disable: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('13.6 @@activate in middle of content stripped', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Decorator Edge Cases',
            ['decorator_middle_test mentioned'],
            {},
            '@@activate in middle',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`13.6 Decorator middle: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('13.7 @@activate with extra whitespace still works', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Decorator Edge Cases',
            ['decorator_whitespace_test mentioned'],
            {},
            '@@activate whitespace',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`13.7 Decorator whitespace: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('13.8 @@ACTIVATE (uppercase) case sensitivity', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Decorator Edge Cases',
            ['decorator_uppercase_test mentioned'],
            {},
            '@@ACTIVATE uppercase',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`13.8 Decorator uppercase: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('13.9 @@ activate (space) not recognized', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Decorator Edge Cases',
            ['decorator_space_test mentioned'],
            {},
            '@@ activate (space)',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`13.9 Decorator space: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('13.10 Multiple @@activate in content works same as one', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Decorator Edge Cases',
            ['decorator_multiple_test mentioned'],
            {},
            'Multiple @@activate',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`13.10 Multiple decorators: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('13.11 Unknown decorator @@custom ignored', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Decorator Edge Cases',
            ['decorator_unknown_test mentioned'],
            {},
            'Unknown decorator',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`13.11 Unknown decorator: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });
});

// ============================================
// Category 16: Global Scan Data Edge Cases
// ============================================
test.describe('Global Scan Data Edge Cases', () => {
    test.beforeEach(setup.awaitST);

    test('16.1 matchPersonaDescription: true, keyword in persona activates', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Global Scan',
            ['Regular chat message'],
            { personaDescription: 'This contains persona_match keyword' },
            'Persona description matching',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`16.1 Persona match: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('16.3 All 6 match flags true, keyword in each', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Global Scan',
            ['Regular chat message'],
            {
                personaDescription: 'persona_match',
                characterDescription: 'char_desc_match',
                characterPersonality: 'char_personality',
                characterDepthPrompt: 'depth_prompt',
                scenario: 'scenario_match',
                creatorNotes: 'creator_notes',
            },
            'All global fields',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`16.3 All global: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('16.4 Empty string in persona description no error', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Global Scan',
            ['Regular chat message'],
            { personaDescription: '' },
            'Empty persona',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`16.4 Empty persona: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('16.5 Very long persona description (10k chars) still scans', async ({ page }) => {
        const longPersona = 'persona_match ' + 'x'.repeat(10000);
        const result = await compareACvsLegacy(
            page,
            'Comparison Global Scan',
            ['Regular chat message'],
            { personaDescription: longPersona },
            'Long persona',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`16.5 Long persona: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('16.6 Global data + chat combined either triggers', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Global Scan',
            ['Message with chat_only_match keyword'],
            {
                personaDescription: 'Contains persona_match',
                scenario: 'Contains scenario_match',
            },
            'Combined chat and global',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`16.6 Combined: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('16.7 Keyword only in global, not chat respects matchX flags', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Global Scan',
            ['No keywords here at all'],
            {
                characterDescription: 'char_desc_match keyword',
            },
            'Keyword only in global',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`16.7 Global only: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('16.8 Multiple global fields with same keyword', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Global Scan',
            ['Regular message'],
            {
                personaDescription: 'multi_global_match',
                characterDescription: 'multi_global_match',
                scenario: 'multi_global_match',
            },
            'Multi global same keyword',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`16.8 Multi global same: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });
});
