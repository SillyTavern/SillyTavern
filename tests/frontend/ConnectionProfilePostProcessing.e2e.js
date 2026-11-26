import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

test.describe('Connection profile prompt post-processing', () => {
    test.beforeEach(testSetup.awaitST);

    test('"None" is stored as an empty value and restored when the profile is applied', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { executeSlashCommandsWithOptions } = await import('./scripts/slash-commands.js');
            const { extension_settings } = await import('./scripts/extensions.js');
            const { oai_settings } = await import('./scripts/openai.js');
            const name = 'e2e-ppp-none';
            const profiles = () => extension_settings.connectionManager.profiles;
            const originalProfiles = structuredClone(profiles());
            const originalSelected = extension_settings.connectionManager.selectedProfile;
            const originalSource = oai_settings.chat_completion_source;
            const originalPpp = oai_settings.custom_prompt_post_processing;
            const mode = Array.from(document.querySelectorAll('#custom_prompt_post_processing option')).map(o => o.value).find(Boolean);

            try {
                await executeSlashCommandsWithOptions('/api openai');
                await executeSlashCommandsWithOptions('/ppp none');
                await executeSlashCommandsWithOptions(`/profile-create ${name}`);
                const created = profiles().find(p => p.name === name);
                const stored = created?.['prompt-post-processing'];

                await executeSlashCommandsWithOptions(`/ppp ${mode}`);
                const beforeApply = oai_settings.custom_prompt_post_processing;
                await executeSlashCommandsWithOptions(`/profile await=true timeout=0 ${name}`);
                const afterApply = oai_settings.custom_prompt_post_processing;

                // A profile saved before the fix holds the getter's "none".
                created['prompt-post-processing'] = 'none';
                await executeSlashCommandsWithOptions(`/ppp ${mode}`);
                await executeSlashCommandsWithOptions(`/profile await=true timeout=0 ${name}`);
                const afterLegacyApply = oai_settings.custom_prompt_post_processing;

                return { mode, hasProfile: !!created, stored, beforeApply, afterApply, afterLegacyApply };
            } finally {
                extension_settings.connectionManager.profiles = originalProfiles;
                extension_settings.connectionManager.selectedProfile = originalSelected;
                oai_settings.chat_completion_source = originalSource;
                oai_settings.custom_prompt_post_processing = originalPpp;
            }
        });

        expect(result.hasProfile).toBe(true);
        expect(result.stored).toBe('');
        expect(result.beforeApply).toBe(result.mode);
        expect(result.afterApply).toBe('');
        expect(result.afterLegacyApply).toBe('');
    });
});
