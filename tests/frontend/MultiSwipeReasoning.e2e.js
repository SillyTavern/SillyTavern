import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

for (const stream of [true, false]) {
    for (const { n, showThoughts, packed = false } of [{ n: 3, showThoughts: true }, { n: 1, showThoughts: true }, { n: 3, showThoughts: false }, { n: 3, showThoughts: true, packed: true }]) {
        test(`preserves independent reasoning: stream=${stream}, n=${n}, thoughts=${showThoughts}, packed=${packed}`, async ({ page }) => {
            await testSetup.awaitST({ page });
            await page.route('**/api/backends/chat-completions/generate', async route => {
                const request = route.request().postDataJSON();
                expect(request.n ?? 1).toBe(n);
                expect(request.stream).toBe(stream);
                const choices = Array.from({ length: n }, (_, index) => ({
                    index,
                    message: { content: `Answer ${index}`, [index % 2 ? 'reasoning' : 'reasoning_content']: `Reason ${index}` },
                }));
                const chunks = [];
                // Interleave choices, including multiple choices in a single event.
                for (const part of ['Reason ', '']) {
                    chunks.push({ choices: [...choices].reverse().map(({ index }) => ({
                        index, delta: { [index % 2 ? 'reasoning' : 'reasoning_content']: part || String(index) },
                    })) });
                }
                chunks.push({ choices: choices.map(({ index }) => ({ index, delta: { content: `Answer ${index}` } })) });
                await route.fulfill(stream ? {
                    contentType: 'text/event-stream',
                    body: (packed ? chunks : chunks.flatMap(chunk => chunk.choices.map(choice => ({ choices: [choice] }))))
                        .map(chunk => `data: ${JSON.stringify(chunk)}\n\n`).join('') + 'data: [DONE]\n\n',
                } : { json: { choices } });
            });

            const result = await page.evaluate(async ({ n, stream, showThoughts }) => {
                const { Generate, newAssistantChat, setOnlineStatus } = await import('./script.js');
                const { oai_settings, chat_completion_sources } = await import('./scripts/openai.js');
                const { power_user } = await import('./scripts/power-user.js');
                await newAssistantChat({ temporary: true });
                $('#main_api').val('openai').trigger('change');
                Object.assign(oai_settings, {
                    chat_completion_source: chat_completion_sources.CUSTOM,
                    custom_url: 'http://127.0.0.1:1', custom_model: 'test-model',
                    n, stream_openai: stream, show_thoughts: showThoughts,
                });
                power_user.reasoning.auto_parse = false;
                setOnlineStatus('Valid');
                await Generate('normal');
                const message = SillyTavern.getContext().chat.at(-1);
                return { swipes: message.swipes, reasoning: message.swipe_info.map(info => info.extra.reasoning || '') };
            }, { n, stream, showThoughts });

            expect(result.swipes).toEqual(Array.from({ length: n }, (_, i) => `Answer ${i}`));
            expect(result.reasoning).toEqual(Array.from({ length: n }, (_, i) => showThoughts ? `Reason ${i}` : ''));
            const message = page.locator('#chat .mes').last();
            for (let i = 0; i < n - 1; i++) {
                await expect(message.locator('.mes_reasoning')).toHaveText(showThoughts ? `Reason ${i}` : '');
                await expect(message.locator('.mes_reasoning_details')).toBeVisible({ visible: showThoughts });
                await message.locator('.swipe_right').click();
                await expect.poll(() => page.evaluate(async () => (await import('./script.js')).isSwipingAllowed())).toBe(true);
            }
            await expect(message.locator('.mes_reasoning')).toHaveText(showThoughts ? `Reason ${n - 1}` : '');
            await expect(message.locator('.mes_reasoning_details')).toBeVisible({ visible: showThoughts });
        });
    }
}

test('retains parsed reasoning as a fallback and keeps signatures independent', async ({ page }) => {
    await testSetup.awaitST({ page });
    const result = await page.evaluate(async () => {
        const { newAssistantChat, saveReply } = await import('./script.js');
        const { power_user } = await import('./scripts/power-user.js');
        await newAssistantChat({ temporary: true });
        Object.assign(power_user.reasoning, { auto_parse: true, prefix: '<think>', suffix: '</think>' });
        await saveReply({
            type: 'normal', getMessage: 'Answer 0', reasoning: 'Reason 0', reasoningSignature: 'Signature 0',
            swipes: ['<think>Parsed 1</think>Answer 1', 'Answer 2'],
            swipeStates: [{}, { reasoning: 'Reason 2', signature: 'Signature 2' }],
        });
        const message = SillyTavern.getContext().chat.at(-1);
        return { swipes: message.swipes, extras: message.swipe_info.map(info => info.extra) };
    });
    expect(result.swipes).toEqual(['Answer 0', 'Answer 1', 'Answer 2']);
    expect(result.extras[1]).toMatchObject({ reasoning: 'Parsed 1', reasoning_type: 'parsed' });
    expect(result.extras[1].reasoning_signature).toBeUndefined();
    expect(result.extras[2]).toMatchObject({
        reasoning: 'Reason 2', reasoning_type: 'model', reasoning_duration: null, reasoning_signature: 'Signature 2',
    });
});
