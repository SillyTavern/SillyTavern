import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

test.describe.configure({ mode: 'serial', timeout: 120000 });

test('connection profiles restore independent OpenRouter provider selections', async ({ page }) => {
    await page.route('**/api/openrouter/models/providers', route => route.fulfill({ json: ['Novita', 'OpenInference'] }));
    await testSetup.awaitST({ page });

    const result = await page.evaluate(async () => {
        const { SlashCommandParser } = await import('./scripts/slash-commands/SlashCommandParser.js');
        const { oai_settings } = await import('./scripts/openai.js');
        const { extension_settings } = await import('./scripts/extensions.js');
        const { ConnectionManagerRequestService } = await import('./scripts/extensions/shared.js');
        const commands = SlashCommandParser.commands;
        const profiles = extension_settings.connectionManager.profiles;
        const names = ['A', 'B', 'EMPTY'].map(suffix => `PROVIDER_TEST_${crypto.randomUUID()}_${suffix}`);
        const selections = [['Novita'], ['OpenInference'], []];
        const originalProfiles = structuredClone(profiles);
        const originalSelected = extension_settings.connectionManager.selectedProfile;
        const originalProviders = [...oai_settings.openrouter_providers];
        const service = SillyTavern.getContext().ChatCompletionService;
        const originalProcess = service.processRequest;

        try {
            await commands.api.callback({ quiet: 'true' }, 'openrouter');
            for (let i = 0; i < names.length; i++) {
                $('#openrouter_providers_chat option').prop('disabled', false);
                $('#openrouter_providers_chat').val(selections[i]).trigger('change');
                await commands['profile-create'].callback({}, names[i]);
            }

            const stored = names.map(name => profiles.find(p => p.name === name)['openrouter-providers']);
            const restored = [];
            for (const name of names) {
                await commands.profile.callback({ timeout: '0' }, name);
                restored.push([...oai_settings.openrouter_providers]);
            }

            await commands.profile.callback({ timeout: '0' }, names[0]);
            $('#openrouter_providers_chat').val(['OpenInference']).trigger('change');
            await commands['profile-update'].callback({});
            await commands.profile.callback({ timeout: '0' }, names[2]);
            await commands.profile.callback({ timeout: '0' }, names[0]);
            const updated = [...oai_settings.openrouter_providers];

            service.processRequest = async payload => payload;
            const saved = profiles.find(p => p.name === names[1]);
            oai_settings.openrouter_providers = ['Novita'];
            const payload = await ConnectionManagerRequestService.sendRequest(saved.id, 'Test', 1);
            delete saved['openrouter-providers'];
            const legacyPayload = await ConnectionManagerRequestService.sendRequest(saved.id, 'Test', 1);
            return { stored, restored, updated, provider: payload.provider, legacyHasProvider: Object.hasOwn(legacyPayload, 'provider') };
        } finally {
            service.processRequest = originalProcess;
            profiles.splice(0, profiles.length, ...originalProfiles);
            extension_settings.connectionManager.selectedProfile = originalSelected;
            oai_settings.openrouter_providers = originalProviders;
            $('#openrouter_providers_chat').val(originalProviders).trigger('change.select2');
        }
    });

    expect(result.restored).toEqual([['Novita'], ['OpenInference'], []]);
    expect(result.stored).toEqual(['["Novita"]', '["OpenInference"]', '[]']);
    expect(result.updated).toEqual(['OpenInference']);
    expect(result.provider).toEqual(['OpenInference']);
    expect(result.legacyHasProvider).toBe(false);
});

test('provider command preserves disabled selections and rejects invalid values', async ({ page }) => {
    await testSetup.awaitST({ page });
    const result = await page.evaluate(async () => {
        const { executeSlashCommandsWithOptions } = await import('./scripts/slash-commands.js');
        const { SlashCommandParser } = await import('./scripts/slash-commands/SlashCommandParser.js');
        const { oai_settings } = await import('./scripts/openai.js');
        const originalProviders = [...oai_settings.openrouter_providers];
        const option = document.querySelector('#openrouter_providers_chat option[value="Novita"]');
        const originalDisabled = option.disabled;
        try {
            option.disabled = true;
            await executeSlashCommandsWithOptions('/openrouter-providers ["Novita"]');
            const stored = (await executeSlashCommandsWithOptions('/openrouter-providers')).pipe;
            const selected = option.selected;
            let rejected = false;
            try {
                SlashCommandParser.commands['openrouter-providers'].callback({}, '[42]');
            } catch {
                rejected = true;
            }
            const afterInvalid = [...oai_settings.openrouter_providers];
            await executeSlashCommandsWithOptions('/openrouter-providers []');
            return { stored, selected, rejected, afterInvalid, cleared: [...oai_settings.openrouter_providers] };
        } finally {
            option.disabled = originalDisabled;
            oai_settings.openrouter_providers = originalProviders;
            $('#openrouter_providers_chat').val(originalProviders).trigger('change.select2');
        }
    });
    expect(result.stored).toBe('["Novita"]');
    expect(result.selected).toBe(true);
    expect(result.rejected).toBe(true);
    expect(result.afterInvalid).toEqual(['Novita']);
    expect(result.cleared).toEqual([]);
});
