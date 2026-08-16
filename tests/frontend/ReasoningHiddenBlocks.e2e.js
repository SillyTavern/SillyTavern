import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

function createEditableReasoningMessageHtml({ detailsAttributes = 'data-has-content="false"', includeMessageContainers = false, includeMessageEditControls = false } = {}) {
    const messageContainers = includeMessageContainers
        ? `
                        <div class="mes_text"></div>
                        <div class="mes_media_wrapper"></div>
                        <div class="mes_file_wrapper"></div>`
        : '';
    const messageEditControls = includeMessageEditControls
        ? `
                            <div class="mes_edit_done menu_button edit_button">Done message</div>
                            <div class="mes_edit_cancel menu_button edit_button">Cancel message</div>`
        : '';
    const messageButtons = includeMessageEditControls
        ? `
                        <div class="mes_buttons" style="display: flex;"></div>
                        <div class="mes_bias"></div>`
        : '';

    return `
                <div class="mes reasoning" mesid="0" data-reasoning-state="done">
                    <div class="mes_block">
                        ${messageButtons}
                        <div class="mes_edit_buttons" style="display: inline-flex;">
                            <div class="mes_edit_add_reasoning menu_button">Add reasoning</div>${messageEditControls}
                        </div>${messageContainers}
                        <details class="mes_reasoning_details"${detailsAttributes ? ` ${detailsAttributes}` : ''}>
                            <summary class="mes_reasoning_summary">
                                <div class="mes_reasoning_header">
                                    <span class="mes_reasoning_header_title">Thought for some time</span>
                                </div>
                                <div class="mes_reasoning_actions">
                                    <div class="mes_button edit_button mes_reasoning_edit">Edit</div>
                                    <div class="mes_reasoning_edit_done menu_button edit_button">Done</div>
                                    <div class="mes_reasoning_edit_cancel menu_button edit_button">Cancel</div>
                                </div>
                            </summary>
                            <div class="mes_reasoning"></div>
                        </details>
                    </div>
                </div>
            `;
}

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

    test('hides add reasoning button while hidden-like reasoning is being edited', async ({ page }) => {
        const addReasoningDisplay = await page.evaluate(() => {
            const chat = document.getElementById('chat');
            if (!chat) {
                throw new Error('Missing #chat container');
            }

            chat.removeAttribute('data-show-hidden-reasoning');
            chat.innerHTML = `
                <div class="mes reasoning" mesid="1" data-reasoning-state="done">
                    <div class="mes_block">
                        <div class="mes_edit_buttons" style="display: inline-flex;">
                            <button class="mes_edit_add_reasoning menu_button">Add reasoning</button>
                        </div>
                        <details class="mes_reasoning_details" data-has-content="false" open>
                            <summary class="mes_reasoning_summary">
                                <div class="mes_reasoning_header">
                                    <span class="mes_reasoning_header_title">Thought for some time</span>
                                </div>
                            </summary>
                            <div class="mes_reasoning_actions">
                                <button class="mes_button edit_button mes_reasoning_edit">Edit</button>
                            </div>
                            <textarea class="reasoning_edit_textarea">\n</textarea>
                            <div class="mes_reasoning"></div>
                        </details>
                    </div>
                </div>
            `;

            const addReasoning = chat.querySelector('.mes_edit_add_reasoning');
            if (!addReasoning) {
                throw new Error('Missing add reasoning button');
            }

            return getComputedStyle(addReasoning).display;
        });

        expect(addReasoningDisplay).toBe('none');
    });

    test('does not create duplicate reasoning editors when add is clicked repeatedly', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const reasoningModule = await import('/scripts/reasoning.js');
            reasoningModule.initReasoning();

            const context = window.SillyTavern.getContext();
            const chat = document.getElementById('chat');
            if (!chat) {
                throw new Error('Missing #chat container');
            }

            context.chat.length = 0;
            context.chat.push({ extra: { reasoning: '\n' }, name: 'Ilo', mes: 'Foo' });
            chat.removeAttribute('data-show-hidden-reasoning');
            chat.innerHTML = `
                <div class="mes reasoning" mesid="0" data-reasoning-state="done">
                    <div class="mes_block">
                        <div class="mes_edit_buttons" style="display: inline-flex;">
                            <div class="mes_edit_add_reasoning menu_button">Add reasoning</div>
                        </div>
                        <details class="mes_reasoning_details" data-has-content="false">
                            <summary class="mes_reasoning_summary">
                                <div class="mes_reasoning_header">
                                    <span class="mes_reasoning_header_title">Thought for some time</span>
                                </div>
                                <div class="mes_reasoning_actions">
                                    <div class="mes_button edit_button mes_reasoning_edit">Edit</div>
                                </div>
                            </summary>
                            <div class="mes_reasoning"></div>
                        </details>
                    </div>
                </div>
            `;

            const addReasoning = chat.querySelector('.mes_edit_add_reasoning');
            if (!addReasoning) {
                throw new Error('Missing add reasoning button');
            }

            addReasoning.click();
            addReasoning.click();
            await new Promise(resolve => setTimeout(resolve, 100));

            const textareas = chat.querySelectorAll('.reasoning_edit_textarea');
            return {
                addDisplay: getComputedStyle(addReasoning).display,
                detailsOpen: chat.querySelector('.mes_reasoning_details')?.open,
                textareaCount: textareas.length,
                textareaValue: textareas[0]?.value,
            };
        });

        expect(result.detailsOpen).toBe(true);
        expect(result.addDisplay).toBe('none');
        expect(result.textareaCount).toBe(1);
        expect(result.textareaValue).toBe('\n');
    });

    test('close all collapses stale open hidden-like reasoning details', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const reasoningModule = await import('/scripts/reasoning.js');
            reasoningModule.initReasoning();

            const chat = document.getElementById('chat');
            if (!chat) {
                throw new Error('Missing #chat container');
            }

            chat.setAttribute('data-show-hidden-reasoning', 'true');
            chat.innerHTML = `
                <button class="mes_reasoning_close_all">Close all</button>
                <div class="mes reasoning" mesid="0">
                    <details class="mes_reasoning_details" data-has-content="false" open>
                        <summary class="mes_reasoning_summary">
                            <div class="mes_reasoning_header">
                                <span class="mes_reasoning_header_title">Thought for some time</span>
                            </div>
                        </summary>
                        <div class="mes_reasoning"></div>
                    </details>
                </div>
                <div class="mes reasoning" mesid="1">
                    <details class="mes_reasoning_details" data-has-content="true" open>
                        <summary class="mes_reasoning_summary">
                            <div class="mes_reasoning_header">
                                <span class="mes_reasoning_header_title">Thought for some time</span>
                            </div>
                        </summary>
                        <div class="mes_reasoning">visible reasoning</div>
                    </details>
                </div>
            `;

            const hiddenDetails = chat.querySelector('[mesid="0"] .mes_reasoning_details');
            const visibleDetails = chat.querySelector('[mesid="1"] .mes_reasoning_details');
            const closeAll = chat.querySelector('.mes_reasoning_close_all');
            if (!hiddenDetails || !visibleDetails || !closeAll) {
                throw new Error('Missing close-all test elements');
            }

            const before = {
                hiddenOpen: hiddenDetails.open,
                visibleOpen: visibleDetails.open,
            };

            closeAll.click();
            await new Promise(resolve => setTimeout(resolve, 100));

            return {
                before,
                after: {
                    hiddenOpen: hiddenDetails.open,
                    visibleOpen: visibleDetails.open,
                },
            };
        });

        expect(result.before.hiddenOpen).toBe(true);
        expect(result.before.visibleOpen).toBe(true);
        expect(result.after.hiddenOpen).toBe(false);
        expect(result.after.visibleOpen).toBe(false);
    });

    test('collapses whitespace-only reasoning after confirming edit with show hidden enabled', async ({ page }) => {
        const result = await page.evaluate(async (messageHtml) => {
            const reasoningModule = await import('/scripts/reasoning.js');
            reasoningModule.initReasoning();

            const context = window.SillyTavern.getContext();
            const chat = document.getElementById('chat');
            if (!chat) {
                throw new Error('Missing #chat container');
            }

            context.chat.length = 0;
            context.chat.push({ extra: { reasoning: '\n' }, name: 'Ilo', mes: 'Foo' });
            chat.setAttribute('data-show-hidden-reasoning', 'true');
            chat.innerHTML = messageHtml;

            const addReasoning = chat.querySelector('.mes_edit_add_reasoning');
            if (!addReasoning) {
                throw new Error('Missing add reasoning button');
            }

            addReasoning.click();
            await new Promise(resolve => setTimeout(resolve, 100));
            const details = chat.querySelector('.mes_reasoning_details');
            const textarea = chat.querySelector('.reasoning_edit_textarea');
            const beforeDone = {
                detailsOpen: details?.open,
                textareaCount: chat.querySelectorAll('.reasoning_edit_textarea').length,
                textareaValue: textarea?.value,
            };

            chat.querySelector('.mes_reasoning_edit_done')?.click();
            await new Promise(resolve => setTimeout(resolve, 100));

            return {
                beforeDone,
                afterDone: {
                    detailsOpen: details?.open,
                    textareaCount: chat.querySelectorAll('.reasoning_edit_textarea').length,
                },
            };
        }, createEditableReasoningMessageHtml());

        expect(result.beforeDone.detailsOpen).toBe(true);
        expect(result.beforeDone.textareaCount).toBe(1);
        expect(result.beforeDone.textareaValue).toBe('\n');
        expect(result.afterDone.textareaCount).toBe(0);
        expect(result.afterDone.detailsOpen).toBe(false);
    });

    test('collapses whitespace-only reasoning after canceling edit with show hidden enabled', async ({ page }) => {
        const result = await page.evaluate(async (messageHtml) => {
            const reasoningModule = await import('/scripts/reasoning.js');
            reasoningModule.initReasoning();

            const context = window.SillyTavern.getContext();
            const chat = document.getElementById('chat');
            if (!chat) {
                throw new Error('Missing #chat container');
            }

            context.chat.length = 0;
            context.chat.push({ extra: { reasoning: '\n' }, name: 'Ilo', mes: 'Foo' });
            chat.setAttribute('data-show-hidden-reasoning', 'true');
            chat.innerHTML = messageHtml;

            const addReasoning = chat.querySelector('.mes_edit_add_reasoning');
            if (!addReasoning) {
                throw new Error('Missing add reasoning button');
            }

            addReasoning.click();
            await new Promise(resolve => setTimeout(resolve, 100));
            const details = chat.querySelector('.mes_reasoning_details');
            const beforeCancel = {
                detailsOpen: details?.open,
                textareaCount: chat.querySelectorAll('.reasoning_edit_textarea').length,
            };

            chat.querySelector('.mes_reasoning_edit_cancel')?.click();
            await new Promise(resolve => setTimeout(resolve, 100));

            return {
                beforeCancel,
                afterCancel: {
                    detailsOpen: details?.open,
                    textareaCount: chat.querySelectorAll('.reasoning_edit_textarea').length,
                },
            };
        }, createEditableReasoningMessageHtml());

        expect(result.beforeCancel.detailsOpen).toBe(true);
        expect(result.beforeCancel.textareaCount).toBe(1);
        expect(result.afterCancel.textareaCount).toBe(0);
        expect(result.afterCancel.detailsOpen).toBe(false);
    });

    test('collapses whitespace-only reasoning after confirming message edit with reasoning edit open', async ({ page }) => {
        const result = await page.evaluate(async (messageHtml) => {
            const [reasoningModule, scriptModule] = await Promise.all([
                import('/scripts/reasoning.js'),
                import('/script.js'),
            ]);
            reasoningModule.initReasoning();

            const context = window.SillyTavern.getContext();
            const chat = document.getElementById('chat');
            if (!chat) {
                throw new Error('Missing #chat container');
            }

            context.chat.length = 0;
            context.chat.push({ extra: { reasoning: '\n' }, name: 'Ilo', mes: 'Foo' });
            chat.setAttribute('data-show-hidden-reasoning', 'true');
            chat.innerHTML = messageHtml;

            chat.querySelector('.mes_edit_add_reasoning')?.click();
            await new Promise(resolve => setTimeout(resolve, 100));
            await scriptModule.messageEdit(0);
            await new Promise(resolve => setTimeout(resolve, 100));
            const editTextarea = chat.querySelector('#curEditTextarea');
            if (editTextarea) {
                editTextarea.value = 'Foo edited';
            }
            const beforeDone = {
                detailsOpen: chat.querySelector('.mes_reasoning_details')?.open,
                reasoningTextareaCount: chat.querySelectorAll('.reasoning_edit_textarea').length,
                messageTextareaCount: chat.querySelectorAll('#curEditTextarea').length,
            };

            chat.querySelector('.mes_edit_done')?.click();
            await new Promise(resolve => setTimeout(resolve, 100));

            return {
                beforeDone,
                afterDone: {
                    detailsOpen: chat.querySelector('.mes_reasoning_details')?.open,
                    reasoningTextareaCount: chat.querySelectorAll('.reasoning_edit_textarea').length,
                    messageTextareaCount: chat.querySelectorAll('#curEditTextarea').length,
                    messageValue: context.chat[0]?.mes,
                    reasoningValue: context.chat[0]?.extra?.reasoning,
                },
            };
        }, createEditableReasoningMessageHtml({ includeMessageContainers: true, includeMessageEditControls: true }));

        expect(result.beforeDone.detailsOpen).toBe(true);
        expect(result.beforeDone.reasoningTextareaCount).toBe(1);
        expect(result.beforeDone.messageTextareaCount).toBe(1);
        expect(result.afterDone.reasoningTextareaCount).toBe(0);
        expect(result.afterDone.messageTextareaCount).toBe(0);
        expect(result.afterDone.detailsOpen).toBe(false);
        expect(result.afterDone.messageValue).toBe('Foo edited');
        expect(result.afterDone.reasoningValue).toBe('\n');
    });

    test('collapses whitespace-only reasoning after canceling message edit with reasoning edit open', async ({ page }) => {
        const result = await page.evaluate(async (messageHtml) => {
            const [reasoningModule, scriptModule] = await Promise.all([
                import('/scripts/reasoning.js'),
                import('/script.js'),
            ]);
            reasoningModule.initReasoning();

            const context = window.SillyTavern.getContext();
            const chat = document.getElementById('chat');
            if (!chat) {
                throw new Error('Missing #chat container');
            }

            context.chat.length = 0;
            context.chat.push({ extra: { reasoning: '\n' }, name: 'Ilo', mes: 'Foo' });
            chat.setAttribute('data-show-hidden-reasoning', 'true');
            chat.innerHTML = messageHtml;

            chat.querySelector('.mes_edit_add_reasoning')?.click();
            await new Promise(resolve => setTimeout(resolve, 100));
            await scriptModule.messageEdit(0);
            await new Promise(resolve => setTimeout(resolve, 100));
            const editTextarea = chat.querySelector('#curEditTextarea');
            if (editTextarea) {
                editTextarea.value = 'Foo should cancel';
            }
            const beforeCancel = {
                detailsOpen: chat.querySelector('.mes_reasoning_details')?.open,
                reasoningTextareaCount: chat.querySelectorAll('.reasoning_edit_textarea').length,
                messageTextareaCount: chat.querySelectorAll('#curEditTextarea').length,
            };

            chat.querySelector('.mes_edit_cancel')?.click();
            await new Promise(resolve => setTimeout(resolve, 100));

            return {
                beforeCancel,
                afterCancel: {
                    detailsOpen: chat.querySelector('.mes_reasoning_details')?.open,
                    reasoningTextareaCount: chat.querySelectorAll('.reasoning_edit_textarea').length,
                    messageTextareaCount: chat.querySelectorAll('#curEditTextarea').length,
                    messageValue: context.chat[0]?.mes,
                    reasoningValue: context.chat[0]?.extra?.reasoning,
                },
            };
        }, createEditableReasoningMessageHtml({ includeMessageContainers: true, includeMessageEditControls: true }));

        expect(result.beforeCancel.detailsOpen).toBe(true);
        expect(result.beforeCancel.reasoningTextareaCount).toBe(1);
        expect(result.beforeCancel.messageTextareaCount).toBe(1);
        expect(result.afterCancel.reasoningTextareaCount).toBe(0);
        expect(result.afterCancel.messageTextareaCount).toBe(0);
        expect(result.afterCancel.detailsOpen).toBe(false);
        expect(result.afterCancel.messageValue).toBe('Foo');
        expect(result.afterCancel.reasoningValue).toBe('\n');
    });

    test('keeps whitespace-only reasoning collapsed when auto-expand is enabled', async ({ page }) => {
        const result = await page.evaluate(async (messageHtml) => {
            const [reasoningModule, powerUserModule] = await Promise.all([
                import('/scripts/reasoning.js'),
                import('/scripts/power-user.js'),
            ]);
            reasoningModule.initReasoning();
            reasoningModule.initReasoning();

            const context = window.SillyTavern.getContext();
            const chat = document.getElementById('chat');
            if (!chat) {
                throw new Error('Missing #chat container');
            }

            context.chat.length = 0;
            context.chat.push({ extra: { reasoning: '\n' }, name: 'Ilo', mes: 'Foo', gen_started: new Date().toISOString() });
            chat.setAttribute('data-show-hidden-reasoning', 'true');
            chat.innerHTML = messageHtml;

            const previousAutoExpand = powerUserModule.power_user.reasoning.auto_expand;
            powerUserModule.power_user.reasoning.auto_expand = true;
            try {
                reasoningModule.updateReasoningUI(chat.querySelector('.mes'));
            } finally {
                powerUserModule.power_user.reasoning.auto_expand = previousAutoExpand;
            }

            const details = chat.querySelector('.mes_reasoning_details');
            return {
                detailsOpen: details?.open,
                hasContent: details?.getAttribute('data-has-content'),
            };
        }, createEditableReasoningMessageHtml({ detailsAttributes: '' }));

        expect(result.hasContent).toBeNull();
        expect(result.detailsOpen).toBe(false);
    });

    test('treats whitespace-only reasoning as hidden-like when trim spaces is disabled', async ({ page }) => {
        const result = await page.evaluate(async (messageHtml) => {
            const [reasoningModule, powerUserModule] = await Promise.all([
                import('/scripts/reasoning.js'),
                import('/scripts/power-user.js'),
            ]);
            reasoningModule.initReasoning();

            const context = window.SillyTavern.getContext();
            const chat = document.getElementById('chat');
            if (!chat) {
                throw new Error('Missing #chat container');
            }

            context.chat.length = 0;
            context.chat.push({ extra: { reasoning: '\n' }, name: 'Ilo', mes: 'Foo', gen_started: new Date().toISOString() });
            chat.removeAttribute('data-show-hidden-reasoning');
            chat.innerHTML = messageHtml;

            const previousTrimSpaces = powerUserModule.power_user.trim_spaces;
            try {
                powerUserModule.power_user.trim_spaces = false;
                reasoningModule.updateReasoningUI(chat.querySelector('.mes'));
            } finally {
                powerUserModule.power_user.trim_spaces = previousTrimSpaces;
            }

            const details = chat.querySelector('.mes_reasoning_details');
            const beforeAddDisplay = details ? getComputedStyle(details).display : null;
            const addReasoning = chat.querySelector('.mes_edit_add_reasoning');
            addReasoning?.click();
            await new Promise(resolve => setTimeout(resolve, 100));
            const textarea = chat.querySelector('.reasoning_edit_textarea');
            return {
                beforeAddDisplay,
                afterAddDisplay: details ? getComputedStyle(details).display : null,
                detailsOpen: details?.open,
                hasContent: details?.getAttribute('data-has-content'),
                textareaCount: chat.querySelectorAll('.reasoning_edit_textarea').length,
                textareaValue: textarea?.value,
            };
        }, createEditableReasoningMessageHtml({ detailsAttributes: '' }));

        expect(result.hasContent).toBeNull();
        expect(result.beforeAddDisplay).toBe('none');
        expect(result.afterAddDisplay).not.toBe('none');
        expect(result.detailsOpen).toBe(true);
        expect(result.textareaCount).toBe(1);
        expect(result.textareaValue).toBe('\n');
    });

    test('does not expand whitespace-only reasoning through slash commands', async ({ page }) => {
        const result = await page.evaluate(async (messageHtml) => {
            const [reasoningModule, slashCommandsModule] = await Promise.all([
                import('/scripts/reasoning.js'),
                import('/scripts/slash-commands.js'),
            ]);
            reasoningModule.initReasoning();

            const context = window.SillyTavern.getContext();
            const chat = document.getElementById('chat');
            if (!chat) {
                throw new Error('Missing #chat container');
            }

            context.chat.length = 0;
            context.chat.push({ extra: { reasoning: '\n' }, name: 'Ilo', mes: 'Foo' });
            chat.setAttribute('data-show-hidden-reasoning', 'true');
            chat.innerHTML = messageHtml;

            const details = chat.querySelector('.mes_reasoning_details');
            await slashCommandsModule.executeSlashCommandsWithOptions('/reasoning-expand 0');
            const afterExpand = details?.open;
            await slashCommandsModule.executeSlashCommandsWithOptions('/reasoning-toggle 0');
            const afterToggle = details?.open;

            return {
                afterExpand,
                afterToggle,
                hasContent: details?.getAttribute('data-has-content'),
            };
        }, createEditableReasoningMessageHtml());

        expect(result.hasContent).toBe('false');
        expect(result.afterExpand).toBe(false);
        expect(result.afterToggle).toBe(false);
    });

    test('expands visible reasoning through slash commands', async ({ page }) => {
        const result = await page.evaluate(async (messageHtml) => {
            const [reasoningModule, slashCommandsModule] = await Promise.all([
                import('/scripts/reasoning.js'),
                import('/scripts/slash-commands.js'),
            ]);
            reasoningModule.initReasoning();

            const context = window.SillyTavern.getContext();
            const chat = document.getElementById('chat');
            if (!chat) {
                throw new Error('Missing #chat container');
            }

            context.chat.length = 0;
            context.chat.push({ extra: { reasoning: 'visible reasoning' }, name: 'Ilo', mes: 'Foo' });
            chat.innerHTML = messageHtml;

            const details = chat.querySelector('.mes_reasoning_details');
            await slashCommandsModule.executeSlashCommandsWithOptions('/reasoning-expand 0');
            const afterExpand = details?.open;
            await slashCommandsModule.executeSlashCommandsWithOptions('/reasoning-toggle 0');
            const afterToggleClosed = details?.open;
            await slashCommandsModule.executeSlashCommandsWithOptions('/reasoning-toggle 0');
            const afterToggleOpen = details?.open;

            return {
                afterExpand,
                afterToggleClosed,
                afterToggleOpen,
                hasContent: details?.getAttribute('data-has-content'),
            };
        }, createEditableReasoningMessageHtml({ detailsAttributes: 'data-has-content="true"' }));

        expect(result.hasContent).toBe('true');
        expect(result.afterExpand).toBe(true);
        expect(result.afterToggleClosed).toBe(false);
        expect(result.afterToggleOpen).toBe(true);
    });

    test('keeps reasoning expanded after changing whitespace-only reasoning to visible content', async ({ page }) => {
        const result = await page.evaluate(async (messageHtml) => {
            const reasoningModule = await import('/scripts/reasoning.js');
            reasoningModule.initReasoning();

            const context = window.SillyTavern.getContext();
            const chat = document.getElementById('chat');
            if (!chat) {
                throw new Error('Missing #chat container');
            }

            context.chat.length = 0;
            context.chat.push({ extra: { reasoning: '\n' }, name: 'Ilo', mes: 'Foo' });
            chat.setAttribute('data-show-hidden-reasoning', 'true');
            chat.innerHTML = messageHtml;

            chat.querySelector('.mes_edit_add_reasoning')?.click();
            await new Promise(resolve => setTimeout(resolve, 100));
            const textarea = chat.querySelector('.reasoning_edit_textarea');
            textarea.value = 'visible reasoning';
            chat.querySelector('.mes_reasoning_edit_done')?.click();
            await new Promise(resolve => setTimeout(resolve, 100));

            const details = chat.querySelector('.mes_reasoning_details');
            return {
                detailsOpen: details?.open,
                hasContent: details?.getAttribute('data-has-content'),
                textareaCount: chat.querySelectorAll('.reasoning_edit_textarea').length,
                reasoningText: chat.querySelector('.mes_reasoning')?.textContent,
            };
        }, createEditableReasoningMessageHtml({ includeMessageContainers: true }));

        expect(result.textareaCount).toBe(0);
        expect(result.hasContent).toBe('true');
        expect(result.detailsOpen).toBe(true);
        expect(result.reasoningText).toContain('visible reasoning');
    });

    test('collapses reasoning after changing whitespace-only reasoning to different whitespace', async ({ page }) => {
        const result = await page.evaluate(async (messageHtml) => {
            const reasoningModule = await import('/scripts/reasoning.js');
            reasoningModule.initReasoning();

            const context = window.SillyTavern.getContext();
            const chat = document.getElementById('chat');
            if (!chat) {
                throw new Error('Missing #chat container');
            }

            context.chat.length = 0;
            context.chat.push({ extra: { reasoning: '\n' }, name: 'Ilo', mes: 'Foo' });
            chat.setAttribute('data-show-hidden-reasoning', 'true');
            chat.innerHTML = messageHtml;

            chat.querySelector('.mes_edit_add_reasoning')?.click();
            await new Promise(resolve => setTimeout(resolve, 100));
            const textarea = chat.querySelector('.reasoning_edit_textarea');
            textarea.value = '   ';
            chat.querySelector('.mes_reasoning_edit_done')?.click();
            await new Promise(resolve => setTimeout(resolve, 100));

            const details = chat.querySelector('.mes_reasoning_details');
            return {
                detailsOpen: details?.open,
                hasContent: details?.getAttribute('data-has-content'),
                textareaCount: chat.querySelectorAll('.reasoning_edit_textarea').length,
            };
        }, createEditableReasoningMessageHtml({ includeMessageContainers: true }));

        expect(result.textareaCount).toBe(0);
        expect(result.hasContent).toBeNull();
        expect(result.detailsOpen).toBe(false);
    });
});
