import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

test.beforeEach(async ({ page }) => {
    await testSetup.awaitST({ page });
    await page.waitForFunction(() => {
        const context = window.SillyTavern?.getContext();
        return context?.eventSource.autoFireLastArgs.has(context.eventTypes.APP_READY);
    });
    await page.evaluate(async () => {
        const { newAssistantChat, getCurrentChatId } = await import('/script.js');
        const { extension_settings } = await import('/scripts/extensions.js');
        const { power_user } = await import('/scripts/power-user.js');
        power_user.message_token_count_enabled = false;
        power_user.tokenizer = 0;
        await newAssistantChat();
        if (!getCurrentChatId()) throw new Error('Expected a persisted assistant chat');
        extension_settings.regex = [{
            id: 'preset-test-rule', scriptName: 'Preset test rule', disabled: true,
            findRegex: '/unused-fixture-pattern/g', replaceString: '', trimStrings: [], placement: [2],
            markdownOnly: true, promptOnly: false, runOnEdit: false, substituteRegex: 0,
        }];
        extension_settings.regex_presets = [
            { id: 'preset-before', name: 'Before', isSelected: true, global: [], scoped: [], preset: [] },
            { id: 'preset-after', name: 'After', isSelected: false, global: [{ id: 'preset-test-rule' }], scoped: [], preset: [] },
        ];
        document.getElementById('regex_presets').replaceChildren(
            new Option('Before', 'preset-before', true, true), new Option('After', 'preset-after'),
        );
    });
});

for (const preset of ['After', 'preset-after']) {
    test(`waits for preset ${preset} before subsequent send and delete commands`, async ({ page }) => {
        const result = await page.evaluate(async preset => {
            const { chat, eventSource, event_types } = await import('/script.js');
            const { executeSlashCommandsWithOptions } = await import('/scripts/slash-commands.js');
            const { extension_settings } = await import('/scripts/extensions.js');
            const before = chat.map(message => message.mes);
            const reloaded = new Promise(resolve => eventSource.once(event_types.CHAT_CHANGED, resolve));
            const execution = await executeSlashCommandsWithOptions(`/send abc | /regex-preset ${preset} | /send efg | /del 1`);
            await reloaded;
            return {
                before, messages: chat.map(message => message.mes), error: execution.isError,
                selected: extension_settings.regex_presets.find(item => item.isSelected)?.id,
                disabled: extension_settings.regex[0].disabled,
            };
        }, preset);
        expect(result.error).toBe(false);
        expect(result.messages).toEqual([...result.before, 'abc']);
        expect(result.selected).toBe('preset-after');
        expect(result.disabled).toBe(false);
    });
}

test('keeps getter and unknown-preset requests free of reloads', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const { eventSource, event_types } = await import('/script.js');
        const command = window.SillyTavern.getContext().SlashCommandParser.commands['regex-preset'];
        let reloads = 0;
        const onReload = () => { reloads++; };
        eventSource.on(event_types.CHAT_CHANGED, onReload);
        try {
            return {
                getter: await command.callback({}, ''),
                missing: await command.callback({ quiet: 'true' }, 'Missing preset'),
                selected: document.getElementById('regex_presets').value,
                reloads,
            };
        } finally {
            eventSource.removeListener(event_types.CHAT_CHANGED, onReload);
        }
    });
    expect(result).toEqual({ getter: 'preset-before', missing: '', selected: 'preset-before', reloads: 0 });
});

test('retains the UI unsaved-change prompt and bypasses it for slash commands', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const { extension_settings } = await import('/scripts/extensions.js');
        const { Popup } = await import('/scripts/popup.js');
        const { waitUntilCondition } = await import('/scripts/utils.js');
        const command = window.SillyTavern.getContext().SlashCommandParser.commands['regex-preset'];
        await command.callback({}, 'After');
        const confirm = Popup.show.confirm;
        let prompts = 0;
        Popup.show.confirm = async () => { prompts++; return false; };
        try {
            extension_settings.regex[0].disabled = true;
            await command.callback({}, 'Before');
            const slashPrompts = prompts;
            extension_settings.regex[0].disabled = false;
            const select = document.getElementById('regex_presets');
            select.value = 'preset-after';
            select.dispatchEvent(new Event('change'));
            await waitUntilCondition(() => extension_settings.regex_presets[1].isSelected, 5000, 10);
            return { slashPrompts, prompts, selected: select.value, disabled: extension_settings.regex[0].disabled };
        } finally {
            Popup.show.confirm = confirm;
        }
    });
    expect(result).toEqual({ slashPrompts: 0, prompts: 1, selected: 'preset-after', disabled: false });
});

test('propagates preset application failures before the command can return success', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const { reloadChatMutex } = await import('/script.js');
        const { extension_settings } = await import('/scripts/extensions.js');
        const command = window.SillyTavern.getContext().SlashCommandParser.commands['regex-preset'];
        const reload = reloadChatMutex.callback;
        reloadChatMutex.callback = async () => { throw new Error('Preset reload failed'); };
        let error;
        try {
            await command.callback({}, 'After');
        } catch (caught) {
            error = caught.message;
        } finally {
            reloadChatMutex.callback = reload;
        }
        return { error, selected: extension_settings.regex_presets.find(item => item.isSelected)?.id };
    });
    expect(result).toEqual({ error: 'Preset reload failed', selected: 'preset-before' });
});
