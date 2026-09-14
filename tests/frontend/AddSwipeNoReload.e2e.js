import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

test.describe('/addswipe without chat reload', () => {
    test.beforeEach(testSetup.awaitST);

    test('adds swipes in place without reloading the chat', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const { newAssistantChat } = await import('./script.js');
            const ctx = window.SillyTavern.getContext();
            const commands = ctx.SlashCommandParser.commands;
            const args = { quiet: 'true' };
            const delay = ms => new Promise(resolve => setTimeout(resolve, ms));

            async function waitFor(condition, timeoutMs = 5000, intervalMs = 50) {
                const start = Date.now();
                while (Date.now() - start < timeoutMs) {
                    if (condition()) return true;
                    await delay(intervalMs);
                }
                throw new Error('Timed out waiting for condition');
            }

            // A fresh account runs onboarding on load: dismiss its popup and wait for the
            // welcome messages to finish arriving, so they don't land inside the test chat.
            for (let i = 0; i < 10; i++) {
                const okButton = document.querySelector('.popup:popover-open .popup-button-ok, dialog[open] .popup-button-ok');
                if (!okButton) break;
                okButton.click();
                await delay(300);
            }
            const chat = ctx.chat;
            let settledLength = -1;
            await waitFor(() => {
                const stable = chat.length === settledLength;
                settledLength = chat.length;
                return stable;
            }, 10000, 700);

            await newAssistantChat({ temporary: true });
            const message = {
                name: 'Assistant',
                is_user: false,
                is_system: false,
                send_date: new Date().toISOString(),
                mes: 'Original greeting',
                extra: {},
            };
            chat.push(message);
            await ctx.addOneMessage(message);
            const mesId = chat.length - 1;
            await waitFor(() => document.querySelector(`.mes[mesid="${mesId}"]`) !== null);
            const mesDiv = document.querySelector(`.mes[mesid="${mesId}"]`);
            // A full chat reload replaces the message elements, so element identity
            // and ad-hoc DOM state prove the chat was updated in place.
            mesDiv.dataset.tempUiState = 'alive';
            const domAlive = () => mesDiv.isConnected && mesDiv.dataset.tempUiState === 'alive';
            const counter = () => document.querySelector(`.mes[mesid="${mesId}"] .swipes-counter`)
                ?.textContent?.replace(/\u200b/g, '')?.trim();

            const noSwitch = { returned: await commands['addswipe'].callback({ ...args }, 'Added swipe A') };
            await delay(500);
            Object.assign(noSwitch, {
                swipes: chat[mesId].swipes.length,
                swipeId: chat[mesId].swipe_id,
                mes: chat[mesId].mes,
                domAlive: domAlive(),
                counter: counter(),
            });

            const warnings = [];
            const origWarning = window.toastr.warning;
            window.toastr.warning = (msg, ...rest) => { warnings.push(String(msg)); return origWarning.call(window.toastr, msg, ...rest); };
            const preSwitchState = { len: chat.length, last: { name: chat[chat.length - 1]?.name, is_user: chat[chat.length - 1]?.is_user, is_system: chat[chat.length - 1]?.is_system, mes: chat[chat.length - 1]?.mes?.slice(0, 30) } };
            const withSwitch = { returned: await commands['addswipe'].callback({ ...args, switch: 'true' }, 'Added swipe B') };
            window.toastr.warning = origWarning;
            withSwitch.debug = { preSwitchState, warnings };
            await delay(1000);
            Object.assign(withSwitch, {
                swipes: chat[mesId].swipes.length,
                swipeId: chat[mesId].swipe_id,
                mes: chat[mesId].mes,
                domAlive: domAlive(),
                counter: counter(),
                visibleText: document.querySelector(`.mes[mesid="${mesId}"] .mes_text`)?.textContent?.trim(),
            });

            return { noSwitch, withSwitch };
        });

        expect(result.noSwitch.returned).toBe('1');
        expect(result.noSwitch.swipes).toBe(2);
        expect(result.noSwitch.swipeId).toBe(0);
        expect(result.noSwitch.mes).toBe('Original greeting');
        expect(result.noSwitch.domAlive).toBe(true);
        expect(result.noSwitch.counter).toBe('1/2');

        expect(result.withSwitch.returned, JSON.stringify(result.withSwitch.debug)).toBe('2');
        expect(result.withSwitch.swipes).toBe(3);
        expect(result.withSwitch.swipeId).toBe(2);
        expect(result.withSwitch.mes).toBe('Added swipe B');
        expect(result.withSwitch.domAlive).toBe(true);
        expect(result.withSwitch.counter).toBe('3/3');
        expect(result.withSwitch.visibleText).toBe('Added swipe B');
    });
});
