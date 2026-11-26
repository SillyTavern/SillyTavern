import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

test.describe('Google AI Studio max temperature', () => {
    test.beforeEach(testSetup.awaitST);

    test('Gemma models keep the full temperature range before the model list loads', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { oai_settings, chat_completion_sources } = await import('./scripts/openai.js');
            const originalSource = oai_settings.chat_completion_source;
            const originalModel = oai_settings.google_model;
            const originalTemp = oai_settings.temp_openai;
            const select = $('#model_google_select');
            const maxTempFor = (model) => {
                if (!select.find(`option[value="${model}"]`).length) {
                    select.append(new Option(model, model));
                }
                select.val(model).trigger('change');
                return Number($('#temp_openai').attr('max'));
            };

            try {
                oai_settings.chat_completion_source = chat_completion_sources.MAKERSUITE;
                oai_settings.temp_openai = 1.5;
                return {
                    gemma: maxTempFor('gemma-4-31b-it'),
                    gemini: maxTempFor('gemini-2.5-pro'),
                    vision: maxTempFor('gemini-pro-vision'),
                };
            } finally {
                oai_settings.chat_completion_source = originalSource;
                oai_settings.google_model = originalModel;
                oai_settings.temp_openai = originalTemp;
            }
        });

        expect(result.gemma).toBe(2);
        expect(result.gemini).toBe(2);
        expect(result.vision).toBe(1);
    });
});
