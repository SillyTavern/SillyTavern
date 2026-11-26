import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

test.describe('/prompt-post-processing', () => {
    test.beforeEach(testSetup.awaitST);

    test('an empty value only clears the setting when forced', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { SlashCommandParser } = await import('./scripts/slash-commands/SlashCommandParser.js');
            const { oai_settings } = await import('./scripts/openai.js');
            const command = SlashCommandParser.commands['prompt-post-processing'];
            const original = oai_settings.custom_prompt_post_processing;
            const mode = Array.from(document.querySelectorAll('#custom_prompt_post_processing option')).map(o => o.value).find(Boolean);

            try {
                await command.callback({}, mode);
                const getterWhenSet = await command.callback({}, '');
                const afterUnforcedEmpty = oai_settings.custom_prompt_post_processing;

                await command.callback({ force: 'true' }, '');
                const afterForcedEmpty = oai_settings.custom_prompt_post_processing;
                const getterWhenCleared = await command.callback({}, '');

                await command.callback({}, mode);
                await command.callback({}, 'none');
                const afterNone = oai_settings.custom_prompt_post_processing;

                return { mode, getterWhenSet, afterUnforcedEmpty, afterForcedEmpty, getterWhenCleared, afterNone };
            } finally {
                oai_settings.custom_prompt_post_processing = original;
                $('#custom_prompt_post_processing').val(original);
            }
        });

        expect(result.mode).toBeTruthy();
        expect(result.getterWhenSet).toBe(result.mode);
        expect(result.afterUnforcedEmpty).toBe(result.mode);
        expect(result.afterForcedEmpty).toBe('');
        expect(result.getterWhenCleared).toBe('none');
        expect(result.afterNone).toBe('');
    });
});
