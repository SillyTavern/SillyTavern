import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

test.describe('Reasoning hidden blocks', () => {
    test.beforeEach(testSetup.awaitST);

    test('keeps unrelated hidden reasoning blocks hidden while another block is being edited', async ({ page }) => {
        const result = await page.evaluate(() => {
            const chat = document.getElementById('chat');
            if (!chat) {
                throw new Error('Missing #chat container');
            }

            chat.removeAttribute('data-show-hidden-reasoning');
            chat.innerHTML = `
                <div class="mes reasoning" mesid="1">
                    <details class="mes_reasoning_details" data-has-content="false">
                        <summary class="mes_reasoning_summary">
                            <div class="mes_reasoning_header">
                                <span class="mes_reasoning_header_title">Thought for some time</span>
                            </div>
                        </summary>
                        <div class="mes_reasoning_actions">
                            <button class="mes_button edit_button mes_reasoning_edit">Edit</button>
                            <button class="mes_button mes_reasoning_edit_done">Done</button>
                            <button class="mes_button mes_reasoning_edit_cancel">Cancel</button>
                        </div>
                        <div class="mes_reasoning"></div>
                    </details>
                </div>
                <div class="mes reasoning" mesid="2">
                    <details class="mes_reasoning_details" data-has-content="false">
                        <summary class="mes_reasoning_summary">
                            <div class="mes_reasoning_header">
                                <span class="mes_reasoning_header_title">Thought for some time</span>
                            </div>
                        </summary>
                        <div class="mes_reasoning_actions">
                            <button class="mes_button edit_button mes_reasoning_edit">Edit</button>
                            <button class="mes_button mes_reasoning_edit_done">Done</button>
                            <button class="mes_button mes_reasoning_edit_cancel">Cancel</button>
                        </div>
                        <div class="mes_reasoning"></div>
                    </details>
                </div>
            `;

            const firstDetails = chat.querySelector('[mesid="1"] .mes_reasoning_details');
            const secondDetails = chat.querySelector('[mesid="2"] .mes_reasoning_details');
            if (!firstDetails || !secondDetails) {
                throw new Error('Missing reasoning blocks');
            }

            const before = {
                first: getComputedStyle(firstDetails).display,
                second: getComputedStyle(secondDetails).display,
            };

            const textarea = document.createElement('textarea');
            textarea.className = 'reasoning_edit_textarea';
            textarea.value = ' ';
            firstDetails.querySelector('.mes_reasoning').before(textarea);

            const after = {
                first: getComputedStyle(firstDetails).display,
                second: getComputedStyle(secondDetails).display,
                textarea: getComputedStyle(textarea).display,
            };

            return { before, after };
        });

        expect(result.before.first).toBe('none');
        expect(result.before.second).toBe('none');
        expect(result.after.first).not.toBe('none');
        expect(result.after.second).toBe('none');
        expect(result.after.textarea).not.toBe('none');
    });
});
