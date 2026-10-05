import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

test.describe('World Info Rename Chat Lore', () => {
    test.beforeEach(testSetup.awaitST);

    test('should retarget chat lore metadata after lorebook rename', async ({ page }) => {
        const oldName = 'STAGE_REPRO_ALPHA';
        const newName = 'STAGE_REPRO_BETA';

        const result = await page.evaluate(async ({ oldName, newName }) => {
            const { createNewWorldInfo, deleteWorldInfo, openWorldInfoEditor, METADATA_KEY, world_names } = await import('./scripts/world-info.js');
            const { chat_metadata } = await import('./script.js');
            const { Popup, POPUP_RESULT } = await import('./scripts/popup.js');

            async function waitFor(condition, timeoutMs = 5000, intervalMs = 50) {
                const start = Date.now();
                while (Date.now() - start < timeoutMs) {
                    if (condition()) return true;
                    await new Promise(resolve => setTimeout(resolve, intervalMs));
                }
                return false;
            }

            const originalInput = Popup.show.input;
            const originalConfirm = Popup.show.confirm;

            try {
                if (world_names.includes(oldName)) {
                    await deleteWorldInfo(oldName);
                }
                if (world_names.includes(newName)) {
                    await deleteWorldInfo(newName);
                }

                const created = await createNewWorldInfo(oldName, { interactive: false });
                if (!created) {
                    throw new Error(`Failed to create world info '${oldName}'`);
                }

                chat_metadata[METADATA_KEY] = oldName;

                await openWorldInfoEditor(oldName);

                Popup.show.input = async () => newName;
                Popup.show.confirm = async () => POPUP_RESULT.NEGATIVE;

                const renameButton = document.querySelector('#world_popup_name_button');
                if (!renameButton) {
                    throw new Error('Could not find #world_popup_name_button');
                }

                renameButton.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

                const renameApplied = await waitFor(() => {
                    const editorValue = String($('#world_editor_select').find(':selected').text());
                    const optionTexts = $('#world_editor_select option').map((_, option) => String($(option).text())).get();
                    return editorValue === newName && optionTexts.includes(newName) && !optionTexts.includes(oldName);
                });
                if (!renameApplied) {
                    throw new Error('Rename operation did not complete in time');
                }

                return {
                    metadataAfter: chat_metadata[METADATA_KEY],
                    hasOldWorld: $('#world_editor_select option').toArray().some(option => String($(option).text()) === oldName),
                    hasNewWorld: $('#world_editor_select option').toArray().some(option => String($(option).text()) === newName),
                };
            } finally {
                Popup.show.input = originalInput;
                Popup.show.confirm = originalConfirm;
            }
        }, { oldName, newName });

        expect(result.hasOldWorld).toBe(false);
        expect(result.hasNewWorld).toBe(true);
        expect(result.metadataAfter).toBe(newName);
    });
});
