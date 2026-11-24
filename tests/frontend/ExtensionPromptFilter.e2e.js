import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

test.describe('Extension prompt filter', () => {
    test.beforeEach(testSetup.awaitST);

    test('a prompt whose filter returns false is left out', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { setExtensionPrompt, getExtensionPrompt, extension_prompts, extension_prompt_types, extension_prompt_roles } = await import('./script.js');
            const keys = ['filter_test_sync_true', 'filter_test_sync_false', 'filter_test_async_true', 'filter_test_async_false', 'filter_test_none'];
            const depth = 9000;
            const role = extension_prompt_roles.SYSTEM;

            try {
                setExtensionPrompt(keys[0], 'sync-true', extension_prompt_types.IN_CHAT, depth, false, role, () => true);
                setExtensionPrompt(keys[1], 'sync-false', extension_prompt_types.IN_CHAT, depth, false, role, () => false);
                setExtensionPrompt(keys[2], 'async-true', extension_prompt_types.IN_CHAT, depth, false, role, async () => true);
                setExtensionPrompt(keys[3], 'async-false', extension_prompt_types.IN_CHAT, depth, false, role, async () => false);
                setExtensionPrompt(keys[4], 'no-filter', extension_prompt_types.IN_CHAT, depth, false, role);

                return await getExtensionPrompt(extension_prompt_types.IN_CHAT, depth, '\n', role, false);
            } finally {
                for (const key of keys) {
                    delete extension_prompts[key];
                }
            }
        });

        expect(result.split('\n')).toEqual(['async-true', 'no-filter', 'sync-true']);
    });
});
