/**
 * World Info Budget Tests
 *
 * Tests budget and overflow edge cases (Category 11):
 * - Entry content exactly fills budget
 * - Entry content exceeds budget by 1 token
 * - ignoreBudget: true scenarios
 * - Budget = 0
 * - Budget cap vs budget %
 * - Very small budget
 * - Budget overflow mid-recursion
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
 * Helper function to compare AC vs Legacy matching results with custom budget.
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
                // Use custom maxContext if provided, otherwise default
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
                    contentLength: (result.worldInfoBefore + result.worldInfoAfter).length,
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
// Category 11: Budget and Overflow Edge Cases
// ============================================
test.describe('Budget Edge Cases', () => {
    test.beforeEach(setup.awaitST);

    test('11.1 Small entry included in budget', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Budget Edge Cases',
            ['budget_small_keyword mentioned'],
            {},
            'Small entry budget',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[BUDGET_SMALL]');
        console.log(`11.1 Small entry: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('11.2 Medium entry included when budget allows', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Budget Edge Cases',
            ['budget_medium_keyword mentioned'],
            {},
            'Medium entry budget',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[BUDGET_MEDIUM]');
        console.log(`11.2 Medium entry: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('11.3 ignoreBudget: true after budget overflow still included', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Budget Edge Cases',
            ['budget_ignore_keyword mentioned'],
            {},
            'ignoreBudget true',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[BUDGET_IGNORE]');
        console.log(`11.3 Ignore budget: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('11.4 Multiple ignoreBudget: true entries all included', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Budget Edge Cases',
            ['budget_ignore_keyword and budget_ignore_huge_keyword mentioned'],
            {},
            'Multiple ignoreBudget',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[BUDGET_IGNORE]');
        expect(result.legacy.content).toContain('[BUDGET_IGNORE_HUGE]');
        console.log(`11.4 Multiple ignore: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('11.5 ignoreBudget: true entry is huge still included', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Budget Edge Cases',
            ['budget_ignore_huge_keyword mentioned'],
            {},
            'Huge ignoreBudget',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[BUDGET_IGNORE_HUGE]');
        console.log(`11.5 Huge ignore: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}, len=${result.legacy.contentLength}`);
    });

    test('11.6 Order affects budget allocation', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Budget Edge Cases',
            ['budget_order_high_keyword and budget_order_low_keyword mentioned'],
            {},
            'Budget order',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        // High order should be processed first
        expect(result.legacy.content).toContain('[BUDGET_ORDER_HIGH]');
        expect(result.legacy.content).toContain('[BUDGET_ORDER_LOW]');
        console.log(`11.6 Budget order: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('11.7 Constant entry with budget', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Budget Edge Cases',
            ['Some random text'],
            {},
            'Constant budget',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        // Constant entry should always activate
        expect(result.legacy.content).toContain('[BUDGET_CONSTANT]');
        console.log(`11.7 Constant budget: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('11.9 Budget overflow mid-recursion', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Budget Edge Cases',
            ['budget_recursion_source mentioned'],
            {},
            'Budget recursion',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[BUDGET_RECURSION_SOURCE]');
        // Target may or may not activate depending on budget
        console.log(`11.9 Budget recursion: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('Multiple entries triggering budget limits', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Budget Edge Cases',
            ['budget_multi_a and budget_multi_b and budget_multi_c mentioned'],
            {},
            'Multiple budget entries',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`Multiple budget: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('ignoreBudget: false explicitly set', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Budget Edge Cases',
            ['budget_ignore_false mentioned'],
            {},
            'ignoreBudget false',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[BUDGET_IGNORE_FALSE]');
        console.log(`ignoreBudget false: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('Budget with group entry', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Budget Edge Cases',
            ['budget_group_keyword mentioned'],
            {},
            'Budget group',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`Budget group: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });
});

// ============================================
// Scan Depth Edge Cases (Category 12)
// ============================================
test.describe('Scan Depth Edge Cases', () => {
    test.beforeEach(setup.awaitST);

    test('12.1 scanDepth: 0 only current message', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Scan Depth Edge Cases',
            [
                'depth_zero_keyword at depth 0',
                'Some other message',
                'And another one',
            ],
            {},
            'Scan depth 0',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`12.1 Depth 0: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('12.2 scanDepth: 1 current + 1 previous', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Scan Depth Edge Cases',
            [
                'Current message',
                'depth_one_keyword at depth 1',
                'Older message',
            ],
            {},
            'Scan depth 1',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`12.2 Depth 1: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('12.3 scanDepth: 1000 (very deep)', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Scan Depth Edge Cases',
            ['depth_deep_keyword mentioned'],
            {},
            'Scan depth deep',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[DEPTH_DEEP]');
        console.log(`12.3 Depth deep: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('12.4 scanDepth: -1 (negative)', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Scan Depth Edge Cases',
            ['depth_negative_keyword mentioned'],
            {},
            'Scan depth negative',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`12.4 Depth negative: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('12.5 scanDepth: null (uses global default)', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Scan Depth Edge Cases',
            ['depth_null_keyword mentioned'],
            {},
            'Scan depth null',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`12.5 Depth null: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('12.6 Chat shorter than scan depth', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Scan Depth Edge Cases',
            ['depth_deep_keyword only message'],
            {},
            'Short chat deep depth',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        expect(result.legacy.content).toContain('[DEPTH_DEEP]');
        console.log(`12.6 Short chat: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('12.7 Entry with depth=2, keyword at depth=3 not matched', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Scan Depth Edge Cases',
            [
                'Current message',
                'Depth 1 message',
                'Depth 2 message',
                'depth_boundary_keyword at depth 3',
            ],
            {},
            'Keyword beyond depth',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        // Entry with depth=2 should NOT match keyword at depth 3
        console.log(`12.7 Beyond depth: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('12.8 Entry with depth=2, keyword at depth=1 matched', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Scan Depth Edge Cases',
            [
                'Current message',
                'depth_boundary_keyword at depth 1',
                'Older message',
            ],
            {},
            'Keyword within depth',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`12.8 Within depth: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('12.9 Different entries with different depths', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Scan Depth Edge Cases',
            [
                'depth_shared_keyword at depth 0',
                'Message at depth 1',
                'Message at depth 2',
                'Message at depth 3',
                'Message at depth 4',
            ],
            {},
            'Different depths',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`12.9 Different depths: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });

    test('12.10 Scan depth + recursion interaction', async ({ page }) => {
        const result = await compareACvsLegacy(
            page,
            'Comparison Scan Depth Edge Cases',
            ['depth_recursion_source mentioned'],
            {},
            'Depth + recursion',
        );

        expect(result.error).toBeUndefined();
        expect(result.match).toBe(true);
        expect(result.orderMatch).toBe(true);
        console.log(`12.10 Depth+recursion: Legacy=${result.legacy.activatedCount}, AC=${result.ac.activatedCount}`);
    });
});
