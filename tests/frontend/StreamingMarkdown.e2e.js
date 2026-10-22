import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

test('streaming body caches unchanged Markdown while regexes, hooks, sanitization and final rendering stay live', async ({ page }) => {
    test.setTimeout(60000);
    await page.route('**/api/settings/save', route => route.fulfill({ json: { result: 'ok' } }));
    await page.route('**/api/chats/save', route => route.fulfill({ json: { result: 'ok' } }));
    await page.route('**/api/backends/chat-completions/status', route => route.fulfill({ json: { data: [] } }));
    await page.route('**/api/tokenizers/**', route => route.fulfill({ json: { count: 8, token_count: 8, ids: [1, 2, 3] } }));
    await testSetup.awaitST({ page });

    const result = await page.evaluate(async () => {
        const st = await import('/script.js');
        const { oai_settings } = await import('/scripts/openai.js');
        const { power_user } = await import('/scripts/power-user.js');
        const { extension_settings } = await import('/scripts/extensions.js');
        const { MessageFormatter } = await import('/scripts/message-formatter.js');
        const { showdown } = await import('/lib.js');

        await st.newAssistantChat({ temporary: true });
        st.changeMainAPI('openai');
        Object.assign(oai_settings, {
            chat_completion_source: 'custom', custom_url: 'https://example.invalid',
            custom_model: 'streaming-test', stream_openai: true,
        });
        Object.assign(power_user, {
            markdown_escape_strings: '', stream_fade_in: false,
            message_token_count_enabled: false, encode_tags: false,
        });
        st.setOnlineStatus('streaming-test');
        const userMessage = { name: 'User', is_user: true, is_system: false, mes: 'Begin a streamed answer.', extra: {} };
        st.chat.push(userMessage);
        await st.addOneMessage(userMessage);

        // Hold a real Generate request open after its first SSE delta, so the
        // application creates its own processor and message DOM naturally.
        const originalFetch = window.fetch;
        let streamController;
        window.fetch = (url, options) => {
            if (url !== '/api/backends/chat-completions/generate') return originalFetch(url, options);
            const stream = new ReadableStream({
                start(controller) {
                    streamController = controller;
                    controller.enqueue(new TextEncoder().encode('data: {"choices":[{"delta":{"content":"Paused answer"}}]}\n\n'));
                },
            });
            return Promise.resolve(new Response(stream, { headers: { 'Content-Type': 'text/event-stream' } }));
        };
        let generationError;
        const generation = st.Generate('normal', { automatic_trigger: true }).catch(error => { generationError = String(error); });
        for (let attempt = 0; attempt < 500; attempt++) {
            if (st.streamingProcessor?.messageId >= 0 && st.streamingProcessor?.result === 'Paused answer') break;
            if (generationError) throw new Error(generationError);
            await new Promise(resolve => setTimeout(resolve, 20));
        }
        const processor = st.streamingProcessor;
        if (!processor?.messageTextDom || !streamController) {
            throw new Error(`No live streaming processor: ${generationError ?? 'generation did not reach the mocked SSE stream'}`);
        }
        // Let the first stream tick finish before driving subsequent updates.
        await new Promise(resolve => setTimeout(resolve, 100));

        const conversions = [];
        const NativeConverter = showdown.Converter;
        // Instrument construction before native tracking, preserving the cache's
        // normal check that the tracked makeHtml function has not been replaced.
        showdown.Converter = function (...args) {
            const converter = new NativeConverter(...args);
            const makeHtml = converter.makeHtml;
            converter.makeHtml = function (text) {
                conversions.push(text);
                return makeHtml.call(this, text);
            };
            return converter;
        };
        const converter = st.reloadMarkdownProcessor();
        showdown.Converter = NativeConverter;
        const originalRegex = extension_settings.regex;
        extension_settings.regex = [];
        const body = '**STREAM_CACHE_MARKER** original';
        const bodyConversions = () => conversions.filter(text => text.includes('STREAM_CACHE_MARKER')).length;
        let hookRuns = 0;
        let hookEnabled = true;
        MessageFormatter.addHook((html, context) => {
            if (!hookEnabled || context.isReasoning || !html.includes('STREAM_CACHE_MARKER')) return html;
            hookRuns++;
            return html + `<span data-stream-hook="${hookRuns}">hook ${hookRuns}</span><img src="x" onerror="window.streamingUnsafe = true">`;
        }, { stage: MessageFormatter.stage.AFTER_MARKDOWN });

        try {
            await processor.onProgressStreaming(processor.messageId, body, false);
            const first = bodyConversions();
            for (let index = 0; index < 5; index++) {
                processor.reasoningHandler.updateReasoning(processor.messageId, `Reasoning changed ${index}`);
                await processor.onProgressStreaming(processor.messageId, body, false);
            }
            const repeated = bodyConversions();
            const repeatedHookRuns = hookRuns;
            const hookText = processor.messageTextDom.querySelector('[data-stream-hook]')?.textContent;
            const sanitized = !processor.messageTextDom.querySelector('[onerror]');

            extension_settings.regex = [{
                id: 'streaming-regex', scriptName: 'Streaming test', findRegex: '/original/g',
                replaceString: 'replacement', trimStrings: [], placement: [2],
                disabled: false, markdownOnly: true, promptOnly: false,
                runOnEdit: true, substituteRegex: 0, minDepth: null, maxDepth: null,
            }];
            await processor.onProgressStreaming(processor.messageId, body, false);
            const afterRegex = bodyConversions();
            const regexText = processor.messageTextDom.textContent;
            await processor.onProgressStreaming(processor.messageId, body, false);
            const repeatedRegex = bodyConversions();
            await processor.onProgressStreaming(processor.messageId, body, true);
            const final = bodyConversions();
            const bold = processor.messageTextDom.querySelector('strong')?.textContent;

            converter.listen('makehtml.before', (event, text) => text);
            await processor.onProgressStreaming(processor.messageId, body, false);
            await processor.onProgressStreaming(processor.messageId, body, false);
            const customListener = bodyConversions();
            return { first, repeated, repeatedHookRuns, hookText, sanitized, afterRegex, regexText, repeatedRegex, final, bold, customListener };
        } finally {
            hookEnabled = false;
            extension_settings.regex = originalRegex;
            window.fetch = originalFetch;
            processor.onStopStreaming();
            streamController.close();
            await generation;
        }
    });

    expect(result.first).toBe(1);
    expect(result.repeated).toBe(1);
    expect(result.repeatedHookRuns).toBe(6);
    expect(result.hookText).toBe('hook 6');
    expect(result.sanitized).toBe(true);
    expect(result.afterRegex).toBe(2);
    expect(result.regexText).toContain('replacement');
    expect(result.repeatedRegex).toBe(2);
    expect(result.final).toBe(3);
    expect(result.bold).toBe('STREAM_CACHE_MARKER');
    expect(result.customListener).toBe(5);
});
