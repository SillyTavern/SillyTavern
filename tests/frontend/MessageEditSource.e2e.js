import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

const original = '<hidden>keep</hidden>\n\n**Original**\n\n\n_tail_';
const edited = '<hidden>keep</hidden>\n\n**Edited**\n\n\n_tail_';

async function openEditor(page, autoSave = false) {
    const id = await page.evaluate(async ({ original, autoSave }) => {
        const { addOneMessage, chat, messageEdit, newAssistantChat } = await import('/script.js');
        const { power_user } = await import('/scripts/power-user.js');
        const { extension_settings } = await import('/scripts/extensions.js');
        const { regex_placement } = await import('/scripts/extensions/regex/engine.js');
        power_user.auto_save_msg_edits = autoSave;
        power_user.trim_spaces = false;
        power_user.reasoning.auto_expand = true;
        extension_settings.disabledExtensions = [];
        extension_settings.regex = [{
            id: 'edit-source-test', scriptName: 'Hide metadata',
            findRegex: '/<hidden>.*?<\\/hidden>/gs', replaceString: '', trimStrings: [],
            placement: [regex_placement.AI_OUTPUT], markdownOnly: true, runOnEdit: true,
        }];
        await newAssistantChat({ temporary: true });
        const message = {
            name: 'Assistant', is_user: false, is_system: false, mes: original,
            extra: { reasoning: 'Original reasoning' }, swipe_id: 0, swipes: [original],
        };
        chat.push(message);
        const id = chat.length - 1;
        await addOneMessage(message);
        await messageEdit(id);
        return id;
    }, { original, autoSave });
    return { id, message: page.locator(`#chat .mes[mesid="${id}"]`) };
}

async function storedMessage(page, id) {
    return page.evaluate(id => {
        const message = window.SillyTavern.getContext().chat[id];
        return { text: message.mes, swipe: message.swipes[message.swipe_id] };
    }, id);
}

test.describe('Message edit source', () => {
    test.beforeEach(async ({ page }) => {
        await page.route('**/api/settings/get', async route => {
            const response = await route.fetch();
            const data = await response.json();
            data.settings = JSON.stringify({ ...JSON.parse(data.settings), firstRun: false });
            await route.fulfill({ response, json: data });
        });
        await testSetup.awaitST({ page });
    });

    for (const [name, value] of [
        ['metadata, Markdown and blank lines', edited],
        ['a deliberately removed tag', '**Edited**\n\n\n_tail_'],
        ['an empty body', ''],
    ]) {
        test(`completing a reasoning edit preserves ${name}`, async ({ page }) => {
            const { id, message } = await openEditor(page);
            await message.locator('.edit_textarea').fill(value);
            await message.locator('.reasoning_edit_textarea').fill('Edited reasoning');
            await message.locator('.mes_reasoning_edit_done').dispatchEvent('click');
            await expect(message.locator('.edit_textarea')).toHaveCount(0);
            expect(await storedMessage(page, id)).toEqual({ text: value, swipe: value });
            await expect(message.locator('.mes_text')).not.toContainText('keep');
            await expect(message.locator('.mes_reasoning')).toContainText('Edited reasoning');
            await page.evaluate(async id => (await import('/script.js')).messageEdit(id), id);
            await expect(message.locator('.edit_textarea')).toHaveValue(value);
        });
    }

    test('saving the body preserves its raw source and saves changed reasoning', async ({ page }) => {
        const { id, message } = await openEditor(page);
        await message.locator('.edit_textarea').fill(edited);
        await message.locator('.reasoning_edit_textarea').fill('Edited reasoning');
        await message.locator('.mes_edit_done').click();
        await expect(message.locator('.edit_textarea, .reasoning_edit_textarea')).toHaveCount(0);
        await expect(message.locator('.mes_reasoning')).toContainText('Edited reasoning');
        expect(await storedMessage(page, id)).toEqual({ text: edited, swipe: edited });
        expect(await page.evaluate(id => window.SillyTavern.getContext().chat[id].extra.reasoning, id)).toBe('Edited reasoning');
    });

    test('saving reasoning alone leaves the raw body intact', async ({ page }) => {
        const { id, message } = await openEditor(page);
        await message.locator('.mes_edit_cancel').click();
        await message.locator('.mes_reasoning_edit').click();
        await message.locator('.reasoning_edit_textarea').fill('Edited reasoning');
        await message.locator('.mes_reasoning_edit_done').click();
        await expect(message.locator('.mes_reasoning')).toContainText('Edited reasoning');
        await expect(message.locator('.mes_text')).not.toContainText('keep');
        expect(await storedMessage(page, id)).toEqual({ text: original, swipe: original });
    });

    test('does not save rendered text when the body textarea is missing', async ({ page }) => {
        const { id, message } = await openEditor(page);
        await page.evaluate(async id => {
            const { chat, updateMessageBlock } = await import('/script.js');
            updateMessageBlock(id, chat[id]);
        }, id);
        await expect(message.locator('.edit_textarea')).toHaveCount(0);
        await message.locator('.mes_edit_done').click();
        expect(await storedMessage(page, id)).toEqual({ text: original, swipe: original });
    });

    test('preserves raw text when autosaving and closing with Escape', async ({ page }) => {
        const { id, message } = await openEditor(page, true);
        await message.locator('.edit_textarea').fill(edited);
        await page.keyboard.press('Escape');
        await expect(message.locator('.edit_textarea')).toHaveCount(0);
        expect(await storedMessage(page, id)).toEqual({ text: edited, swipe: edited });
    });

    test('preserves raw text when switching directly to another message editor', async ({ page }) => {
        const { id, message } = await openEditor(page);
        await message.locator('.edit_textarea').fill(edited);
        const nextId = await page.evaluate(async () => {
            const { addOneMessage, chat } = await import('/script.js');
            const next = { name: 'Assistant', is_user: false, mes: 'Next message', extra: {} };
            chat.push(next);
            await addOneMessage(next);
            return chat.length - 1;
        });
        await page.locator(`#chat .mes[mesid="${nextId}"] .mes_edit`).click();
        await expect(page.locator(`#chat .mes[mesid="${nextId}"] .edit_textarea`)).toHaveValue('Next message');
        expect(await storedMessage(page, id)).toEqual({ text: edited, swipe: edited });
    });

    test('deleting reasoning keeps an unsaved body edit intact', async ({ page }) => {
        const { id, message } = await openEditor(page);
        await message.locator('.edit_textarea').fill(edited);
        await message.locator('.mes_reasoning_delete').dispatchEvent('click');
        await page.locator('.popup:popover-open .popup-button-ok, dialog[open] .popup-button-ok').click();
        await expect(message.locator('.reasoning_edit_textarea')).toHaveCount(0);
        await expect(message.locator('.edit_textarea')).toHaveValue(edited);
        await message.locator('.mes_edit_done').click();
        await expect(message.locator('.edit_textarea')).toHaveCount(0);
        expect(await storedMessage(page, id)).toEqual({ text: edited, swipe: edited });
    });
});
