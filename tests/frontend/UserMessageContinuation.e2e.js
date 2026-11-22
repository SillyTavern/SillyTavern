import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

async function prepareChat(page, { streaming, isUser = true, instruct = true, original = 'Original sentence.' } = {}) {
    await page.evaluate(async ({ streaming, isUser, instruct, original }) => {
        const { addOneMessage, changeMainAPI, chat, newAssistantChat, setOnlineStatus } = await import('/script.js');
        const { power_user } = await import('/scripts/power-user.js');
        const { textgenerationwebui_settings: settings } = await import('/scripts/textgen-settings.js');
        await newAssistantChat({ temporary: true });
        changeMainAPI('textgenerationwebui');
        settings.type = 'ooba';
        settings.streaming = streaming;
        power_user.tokenizer = 0;
        power_user.message_token_count_enabled = false;
        power_user.streaming_fps = 1000;
        power_user.auto_continue.enabled = false;
        power_user.auto_swipe = false;
        power_user.trim_spaces = true;
        power_user.trim_sentences = false;
        power_user.allow_name1_display = false;
        power_user.allow_name2_display = false;
        Object.assign(power_user.instruct, {
            enabled: instruct, macro: false, wrap: false, sequences_as_stop_strings: true,
            input_sequence: '<|turn>user\n', output_sequence: '<|turn>model\n',
            first_output_sequence: '', last_output_sequence: '', stop_sequence: '<turn|>',
        });
        Object.assign(power_user.reasoning, { auto_parse: true, prefix: '<|channel>thought', suffix: '<channel|>' });
        if (!isUser) {
            const user = { name: 'User', is_user: true, mes: 'Earlier question.', extra: {} };
            chat.push(user);
            await addOneMessage(user);
        }
        const message = { name: isUser ? 'User' : 'Assistant', is_user: isUser, mes: original, extra: {} };
        chat.push(message);
        await addOneMessage(message);
        setOnlineStatus('Continuation test');
    }, { streaming, isUser, instruct, original });
}

async function respondWith(page, output, streaming) {
    await page.route('**/api/backends/text-completions/generate', route => {
        if (!streaming) return route.fulfill({ json: { choices: [{ text: output }] } });
        const body = output.match(/[\s\S]{1,7}/g).map(text => `data: ${JSON.stringify({ choices: [{ text }] })}\n\n`).join('');
        return route.fulfill({ contentType: 'text/event-stream', body: body + 'data: [DONE]\n\n' });
    });
}

async function generate(page, type = 'continue') {
    return page.evaluate(async type => {
        const { Generate, chat, eventSource, event_types } = await import('/script.js');
        const progress = [];
        const captureProgress = async () => {
            progress.push(chat.at(-1)?.mes);
            await new Promise(resolve => setTimeout(resolve, 2));
        };
        eventSource.on(event_types.STREAM_TOKEN_RECEIVED, captureProgress);
        try {
            await Generate(type);
        } finally {
            eventSource.removeListener(event_types.STREAM_TOKEN_RECEIVED, captureProgress);
        }
        const message = chat.at(-1);
        return {
            progress,
            message: JSON.parse(JSON.stringify(message)),
            visible: document.querySelector(`#chat .mes[mesid="${chat.length - 1}"] .mes_text`)?.textContent,
            input: document.querySelector('#send_textarea').value,
        };
    }, type);
}

test.describe('User message continuation', () => {
    test.beforeEach(async ({ page }) => {
        await page.route('**/api/settings/get', async route => {
            const response = await route.fetch();
            const data = await response.json();
            data.settings = JSON.stringify({ ...JSON.parse(data.settings), firstRun: false });
            await route.fulfill({ response, json: data });
        });
        await testSetup.awaitST({ page });
        await page.waitForFunction(() => window.SillyTavern?.getContext().eventSource.autoFireLastArgs.has('app_ready'));
    });

    for (const streaming of [false, true]) {
        test(`stops user continuation at the model turn (${streaming ? 'streaming' : 'non-streaming'})`, async ({ page }) => {
            await prepareChat(page, { streaming });
            await respondWith(page, ' More user text.\n<|turn>model\n<|channel>thought\n<channel|>Character response.', streaming);
            const result = await generate(page);
            expect(result.message.mes).toBe('Original sentence. More user text.');
            expect(result.visible).toBe('Original sentence. More user text.');
            expect(result.message.is_user).toBe(true);
            expect(Boolean(result.progress.length)).toBe(streaming);
            expect(result.progress.join('')).not.toContain('Character response.');
            expect(result.message).not.toHaveProperty('swipes');
            expect(result.message).not.toHaveProperty('swipe_id');
            expect(result.message).not.toHaveProperty('swipe_info');
        });

        test(`keeps assistant continuation and swipes (${streaming ? 'streaming' : 'non-streaming'})`, async ({ page }) => {
            await prepareChat(page, { streaming, isUser: false });
            await respondWith(page, ' More assistant text.\n<|turn>user\nUser response.', streaming);
            const { message } = await generate(page);
            expect(message.mes).toBe('Original sentence. More assistant text.');
            expect(message.is_user).toBe(false);
            expect(message.swipes[message.swipe_id]).toBe(message.mes);
            expect(message.swipe_info[message.swipe_id].extra).toEqual(message.extra);
        });

        test(`ignores existing model markers before regex cleanup (${streaming ? 'streaming' : 'non-streaming'})`, async ({ page }) => {
            await prepareChat(page, { streaming, original: 'LONG-PREFIX\n<|turn>model\nOriginal sentence.' });
            await page.evaluate(async () => {
                const { extension_settings } = await import('/scripts/extensions.js');
                const { regex_placement } = await import('/scripts/extensions/regex/engine.js');
                extension_settings.regex = [{
                    id: 'continuation-test', scriptName: 'Shorten prefix', findRegex: '/LONG-PREFIX/g',
                    replaceString: '', trimStrings: [], placement: [regex_placement.AI_OUTPUT],
                }];
            });
            await respondWith(page, ' More text.\n<|turn>model\nCharacter response.', streaming);
            expect((await generate(page)).message.mes).toBe('Original sentence. More text.');
        });
    }

    test('does not add swipes to an ordinary user continuation', async ({ page }) => {
        await prepareChat(page, { streaming: false });
        await respondWith(page, ' More user text.', false);
        const { message } = await generate(page);
        expect(message.mes).toBe('Original sentence. More user text.');
        expect(message).not.toHaveProperty('swipes');
        expect(message).not.toHaveProperty('swipe_id');
        expect(message).not.toHaveProperty('swipe_info');
    });

    test('preserves normal assistant generation after a user message', async ({ page }) => {
        await prepareChat(page, { streaming: false });
        await respondWith(page, 'Assistant response.\n<|turn>user\nUser response.', false);
        const { message } = await generate(page, 'normal');
        expect(message.mes).toBe('Assistant response.');
        expect(message.is_user).toBe(false);
        expect(message.swipes[message.swipe_id]).toBe(message.mes);
    });

    test('recognizes first, macro-expanded last and character-name stops', async ({ page }) => {
        await prepareChat(page, { streaming: false });
        const results = await page.evaluate(async () => {
            const { cleanUpMessage, name2 } = await import('/script.js');
            const { power_user } = await import('/scripts/power-user.js');
            Object.assign(power_user.instruct, {
                macro: true, first_output_sequence: '<|first|>', last_output_sequence: '<|{{char}}|>',
            });
            const results = ['<|first|>', `<|${name2}|>`].map(marker => cleanUpMessage({
                getMessage: `User text.\n${marker}\nCharacter response.`, isContinue: true,
            }));
            power_user.instruct.enabled = false;
            power_user.context.names_as_stop_strings = true;
            results.push(cleanUpMessage({ getMessage: `User text.\n${name2}: Character response.`, isContinue: true }));
            return results;
        });
        expect(results).toEqual(['User text.', 'User text.', 'User text.']);
    });

    test('does not strip an original stop exposed by truncating the continuation', async ({ page }) => {
        await prepareChat(page, { streaming: false, instruct: false });
        const result = await page.evaluate(async () => {
            const { cleanUpMessage } = await import('/script.js');
            const original = 'The word END';
            return cleanUpMessage({
                getMessage: original + 'STOP assistant prose', isContinue: true,
                continueFrom: original.length, stoppingStrings: ['STOP', 'END'],
            });
        });
        expect(result).toBe('The word END');
    });

    test('keeps impersonation in the input without changing the user message', async ({ page }) => {
        await prepareChat(page, { streaming: false });
        await respondWith(page, 'Impersonated user text.', false);
        const result = await generate(page, 'impersonate');
        expect(result.input).toBe('Impersonated user text.');
        expect(result.message.mes).toBe('Original sentence.');
        expect(result.message).not.toHaveProperty('swipes');
    });
});
