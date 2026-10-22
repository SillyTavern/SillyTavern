import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

test('the chat send button uses the entered Vertex model and displays its reply', async ({ page }) => {
    const model = 'gemini-4-argon-chat-send-e2e';
    const prompt = 'Reply using the model ID I entered.';
    const reply = 'The custom Vertex model answered this chat.';
    const generations = [];
    await page.route('**/api/settings/get', async route => {
        const response = await route.fetch();
        const data = await response.json();
        const settings = JSON.parse(data.settings);
        settings.firstRun = false;
        settings.main_api = 'openai';
        settings.oai_settings = {
            ...settings.oai_settings,
            chat_completion_source: 'vertexai',
            vertexai_model: 'gemini-3.7-flash',
            vertexai_auth_mode: 'express',
            custom_model_ids: {},
            reverse_proxy: '',
            stream_openai: false,
        };
        data.settings = JSON.stringify(settings);
        data.request_compression = { enabled: false };
        await route.fulfill({ response, json: data });
    });
    await page.route('**/api/settings/save', route => route.fulfill({ json: { result: 'ok' } }));
    await page.route('**/api/chats/save', route => route.fulfill({ json: { result: 'ok' } }));
    await page.route('**/api/tokenizers/**', route => route.fulfill({ json: { count: 8, token_count: 8, ids: [1, 2, 3] } }));
    await page.route('**/api/backends/chat-completions/status', route => route.fulfill({ json: { data: [] } }));
    await page.route('**/api/backends/chat-completions/generate', async route => {
        generations.push(route.request().postDataJSON());
        await route.fulfill({ json: { choices: [{ message: { role: 'assistant', content: reply }, finish_reason: 'stop' }] } });
    });
    await testSetup.awaitST({ page });
    await page.evaluate(async () => {
        const st = await import('/script.js');
        const { secret_state, SECRET_KEYS } = await import('/scripts/secrets.js');
        const { power_user } = await import('/scripts/power-user.js');
        secret_state[SECRET_KEYS.VERTEXAI] = true;
        power_user.message_token_count_enabled = false;
        await st.newAssistantChat({ temporary: true });
        st.changeMainAPI('openai');
    });

    await page.locator('#API-status-top').click();
    await page.locator('#chat_completion_model_id').fill(model);
    await page.locator('#chat_completion_model_apply').click();
    await expect(page.locator('#model_vertexai_select')).toHaveValue(model);
    await page.locator('#api_button_openai').click();
    await expect.poll(() => page.evaluate(async () => (await import('/script.js')).online_status)).not.toBe('no_connection');
    await page.locator('#API-status-top').click();

    await page.locator('#send_textarea').fill(prompt);
    await page.locator('#send_but').click();
    await expect(page.locator('#chat .mes[is_user="true"] .mes_text').last()).toContainText(prompt);
    await expect(page.locator('#chat .mes[is_user="false"] .mes_text').last()).toContainText(reply);
    expect(generations).toHaveLength(1);
    expect(generations[0]).toMatchObject({ chat_completion_source: 'vertexai', model, stream: false });
    expect(generations[0].messages).toEqual(expect.arrayContaining([expect.objectContaining({ role: 'user', content: prompt })]));
});
