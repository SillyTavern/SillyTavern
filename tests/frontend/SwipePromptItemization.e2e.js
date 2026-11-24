import { expect, test } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

test('Prompt Itemization opens the selected swipe’s saved preset and raw prompt', async ({ page }) => {
    // Skip the first-run welcome dialog on fresh test accounts; do not change the account on disk.
    await page.route('**/api/settings/get', async route => {
        const response = await route.fetch();
        const data = await response.json();
        if (data.settings) {
            data.settings = JSON.stringify({ ...JSON.parse(data.settings), firstRun: false });
        }
        await route.fulfill({ response, json: data });
    });
    await testSetup.awaitST({ page });
    await page.waitForFunction(() => window.SillyTavern?.getContext().eventSource.autoFireLastArgs.has('app_ready'));

    const messageId = await page.evaluate(async () => {
        const { chat, newAssistantChat, saveReply } = await import('./script.js');
        const { deleteItemizedPrompts, loadItemizedPrompts, saveItemizedPrompts } = await import('./scripts/itemized-prompts.js');
        await newAssistantChat({ temporary: true });

        const snapshot = presetName => ({
            main_api: 'openai',
            presetName,
            rawPrompt: [{ role: 'user', content: 'Prompt for ' + presetName }],
        });
        await saveReply({ type: 'normal', getMessage: 'First reply', itemizedPrompt: snapshot('AAAA') });
        const id = chat.length - 1;
        chat[id].swipe_id = 1;
        await saveReply({ type: 'swipe', getMessage: 'Second reply', itemizedPrompt: snapshot('BBBB') });

        // Round-trip the real IndexedDB cache, without writing to a user's chat.
        const key = 'test-itemization-' + crypto.randomUUID();
        await saveItemizedPrompts(key);
        await loadItemizedPrompts('');
        await loadItemizedPrompts(key);
        await deleteItemizedPrompts(key);
        return id;
    });

    for (const [swipeId, preset] of [[0, 'AAAA'], [1, 'BBBB']]) {
        await page.evaluate(async ({ messageId, swipeId }) => {
            const { addOneMessage, chat, syncSwipeToMes } = await import('./script.js');
            syncSwipeToMes(messageId, swipeId);
            addOneMessage(chat[messageId], { type: 'swipe' });
        }, { messageId, swipeId });

        await page.locator('.mes[mesid="' + messageId + '"] .mes_prompt').dispatchEvent('pointerup');
        const popup = page.locator('.popup').filter({ has: page.locator('#showRawPrompt') });
        await expect(popup.locator('small').filter({ has: page.locator('[data-i18n="Preset:"]') })).toContainText(preset);
        await popup.locator('#showRawPrompt').click();
        await expect(popup.locator('#rawPromptWrapper')).toHaveText('Prompt for ' + preset);
        await popup.locator('.popup-button-ok').click();
        await expect(popup).toHaveCount(0);
    }
});
