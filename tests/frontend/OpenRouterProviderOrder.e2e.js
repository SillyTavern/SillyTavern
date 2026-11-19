import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

test.describe('OpenRouter provider order', () => {
    test.beforeEach(testSetup.awaitST);

    const cases = [
        {
            name: 'Chat Completion',
            selector: '#openrouter_providers_chat',
            module: './scripts/openai.js',
            settings: 'oai_settings',
        },
        {
            name: 'Text Completion',
            selector: '#openrouter_providers_text',
            module: './scripts/textgen-settings.js',
            settings: 'textgenerationwebui_settings',
        },
    ];

    for (const { name, selector, module, settings: settingsExport } of cases) {
        test(`should keep the chosen provider order for ${name}`, async ({ page }) => {
            const result = await page.evaluate(async ({ selector, module, settingsExport }) => {
                const settings = (await import(module))[settingsExport];
                const $select = $(selector);
                const options = $select.find('option').toArray().map(option => option.value);
                const originalProviders = settings.openrouter_providers;

                // Deliberately not in the dropdown's order, so a list read back from the DOM would differ
                const chosen = [options[options.length - 1], options[0], options[Math.floor(options.length / 2)]];
                const added = options[1];

                try {
                    // Same path as loading saved settings or a preset: set the value, then fire change
                    settings.openrouter_providers = [...chosen];
                    $select.val(chosen).trigger('change');
                    const afterLoad = [...settings.openrouter_providers];

                    $select.val([...chosen, added]).trigger('change');
                    const afterAdd = [...settings.openrouter_providers];

                    $select.val([chosen[0], chosen[2], added]).trigger('change');
                    const afterRemove = [...settings.openrouter_providers];

                    return { chosen, added, afterLoad, afterAdd, afterRemove };
                } finally {
                    settings.openrouter_providers = originalProviders;
                    $select.val(originalProviders);
                }
            }, { selector, module, settingsExport });

            expect(result.afterLoad).toEqual(result.chosen);
            expect(result.afterAdd).toEqual([...result.chosen, result.added]);
            expect(result.afterRemove).toEqual([result.chosen[0], result.chosen[2], result.added]);
        });
    }
});
