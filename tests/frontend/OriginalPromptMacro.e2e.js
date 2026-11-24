import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

test.describe('Original prompt macro', () => {
    test.beforeEach(testSetup.awaitST);

    for (const hasBasePrompt of [true, false]) {
        test(`builds both Chat Completion overrides ${hasBasePrompt ? 'with' : 'without'} base prompts`, async ({ page }) => {
            const messages = await page.evaluate(async (hasBasePrompt) => {
                const { Generate, changeMainAPI, getCharacters, selectCharacterById, characters, eventSource } = await import('/script.js');
                const { event_types } = await import('/scripts/events.js');
                const { power_user } = await import('/scripts/power-user.js');
                const { promptManager } = await import('/scripts/openai.js');

                changeMainAPI('openai');
                await getCharacters();
                await selectCharacterById(0);
                power_user.experimental_macro_engine = true;
                power_user.prefer_character_prompt = true;
                power_user.prefer_character_jailbreak = true;

                characters[0].data.system_prompt = 'Start main [{{original}}] end main';
                characters[0].data.post_history_instructions = 'Start history [{{original}}] end history';
                for (const [id, base] of [['main', 'Base main'], ['jailbreak', 'Base history']]) {
                    const prompt = promptManager.getPromptById(id);
                    prompt.content = hasBasePrompt ? base : '';
                    prompt.forbid_overrides = false;
                    promptManager.getPromptOrderEntry(promptManager.activeCharacter, id).enabled = true;
                }

                let messages;
                eventSource.once(event_types.GENERATE_AFTER_DATA, data => { messages = data.prompt; });
                await Generate('normal', {}, true);
                return messages.map(message => message.content);
            }, hasBasePrompt);

            expect(messages).toEqual(expect.arrayContaining([
                `Start main [${hasBasePrompt ? 'Base main' : ''}] end main`,
                `Start history [${hasBasePrompt ? 'Base history' : ''}] end history`,
            ]));
        });
    }

    test('expands to empty in a standalone macro evaluation', async ({ page }) => {
        const output = await page.evaluate(async () => {
            const { substituteParams } = await import('/script.js');
            const { power_user } = await import('/scripts/power-user.js');
            power_user.experimental_macro_engine = true;
            return substituteParams('Before [{{original}}] after');
        });

        expect(output).toBe('Before [] after');
    });
});
