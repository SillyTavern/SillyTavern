import { readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

test('switching to Google AI Studio finishes the new status check', async ({ page }) => {
    const settings = JSON.parse(readFileSync(new URL('../../default/content/settings.json', import.meta.url), 'utf8'));
    settings.firstRun = false;
    settings.main_api = 'openai';
    await page.route('**/api/settings/get', async route => {
        const response = await route.fetch();
        await route.fulfill({ response, json: { ...await response.json(), settings: JSON.stringify(settings) } });
    });
    await page.route('**/api/settings/save', route => route.fulfill({ json: {} }));
    await page.route('**/api/secrets/read', route => route.fulfill({
        json: { api_key_makersuite: [{ id: 'test', label: 'Test key', active: true }] },
    }));
    await page.route('**/api/backends/chat-completions/status', route => route.fulfill({
        json: { data: [{ id: 'test-google-model' }] },
    }));

    await testSetup.awaitST({ page });
    await page.locator('#API-status-top').click();
    const source = page.locator('#chat_completion_source');
    await expect(source).toHaveValue('openai');
    await source.selectOption('makersuite');

    await expect(page.locator('#api_button_openai')).not.toHaveClass(/disabled/);
    await expect(page.locator('#openai_api .online_status_indicator')).toHaveClass(/success/);
    await expect(page.locator('#google_other_models option')).toHaveText(['test-google-model']);
});
