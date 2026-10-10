import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

test.beforeEach(async ({ page }) => {
    await testSetup.awaitST({ page });
    await expect.poll(() => page.evaluate(async () => {
        const st = await import('/script.js');
        const welcome = [...document.querySelectorAll('dialog[open]')].find(dialog => dialog.textContent.includes('Welcome to SillyTavern!'));
        welcome?.querySelector('.popup-button-ok')?.click();
        return st.eventSource.autoFireLastArgs.has(st.event_types.APP_READY);
    }), { timeout: 15000 }).toBe(true);
});

test('rejects provider error envelopes without treating normal message objects as errors', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const { tryParseStreamingError } = await import('/scripts/openai.js');
        const errors = [
            { error: { message: 'failed' } }, { error: 'failed' }, { message: 'failed' },
            { error: true, message: 'failed' }, { detail: { error: { message: 'failed' } } },
            { detail: 'failed' }, { quota_error: true, error: { message: 'failed' } },
        ];
        const messages = errors.map(data => {
            try { tryParseStreamingError(new Response(), JSON.stringify(data), { quiet: true }); }
            catch (error) { return error.message; }
            return null;
        });
        const normal = ['not JSON', '{"invalid":', 'null', JSON.stringify({ choices: [] }), JSON.stringify({ type: 'message_start', message: { role: 'assistant', content: [] } })];
        for (const data of normal) tryParseStreamingError(new Response(), data);
        return { messages, toasts: document.querySelectorAll('#toast-container .toast-error').length };
    });
    expect(result.messages).toEqual(Array(7).fill('failed'));
    expect(result.toasts).toBe(0);
});

for (const kind of ['normal', 'custom-chat', 'custom-text']) {
    for (const scenario of ['provider-error', 'malformed', 'done', 'eof', 'break', 'abort', 'http-error']) {
        test(`${kind} handles ${scenario} without leaving a live response`, async ({ page }) => {
            const result = await page.evaluate(async ({ kind, scenario }) => {
                const { sendOpenAIRequest, oai_settings } = await import('/scripts/openai.js');
                const { ChatCompletionService, TextCompletionService } = await import('/scripts/custom-request.js');
                const { power_user } = await import('/scripts/power-user.js');
                oai_settings.chat_completion_source = 'custom';
                oai_settings.stream_openai = true;
                power_user.smooth_streaming = false;
                const originalFetch = window.fetch;
                const abort = new AbortController();
                let canceled = 0;
                const chunks = [];
                let error = null;
                window.fetch = async (url, options) => {
                    if (!String(url).endsWith('/generate')) return originalFetch(url, options);
                    if (scenario === 'http-error') return new Response(JSON.stringify({ error: { message: 'provider failed' } }), { status: 429 });
                    const source = new ReadableStream({
                        start(controller) {
                            const delta = kind === 'custom-text' ? { text: 'partial' } : { delta: { content: 'partial' } };
                            const frames = [JSON.stringify({ choices: [{ index: 0, ...delta }] })];
                            if (scenario === 'provider-error') frames.push(JSON.stringify({ error: { message: 'provider failed' } }));
                            if (scenario === 'malformed') frames.push('{invalid');
                            if (scenario === 'done') frames.push('[DONE]');
                            controller.enqueue(new TextEncoder().encode(frames.map(frame => `data: ${frame}\n\n`).join('')));
                            if (scenario === 'eof') controller.close();
                            options.signal?.addEventListener('abort', () => controller.error(new DOMException('Aborted', 'AbortError')), { once: true });
                        },
                        cancel() { canceled++; },
                    });
                    return new Response(source);
                };
                try {
                    const factory = kind === 'normal' ? await sendOpenAIRequest('normal', [], abort.signal)
                        : await (kind === 'custom-chat' ? ChatCompletionService : TextCompletionService).sendRequest({ stream: true, chat_completion_source: 'custom' }, true, abort.signal);
                    for await (const chunk of factory()) {
                        chunks.push(chunk.text);
                        if (scenario === 'break') break;
                        if (scenario === 'abort') abort.abort();
                    }
                } catch (caught) {
                    error = caught.message;
                } finally {
                    window.fetch = originalFetch;
                }
                await new Promise(resolve => setTimeout(resolve, 0));
                return { chunks, canceled, error };
            }, { kind, scenario });
            expect(result.chunks).toEqual(scenario === 'http-error' ? [] : ['partial']);
            expect(result.canceled).toBe(['provider-error', 'malformed', 'done', 'break'].includes(scenario) ? 1 : 0);
            expect(Boolean(result.error)).toBe(['provider-error', 'malformed', 'abort', 'http-error'].includes(scenario));
            expect(['provider-error', 'http-error'].includes(scenario) ? result.error : 'provider failed').toBe('provider failed');
        });
    }
}

test('preserves an Anthropic stream from message_start through message_stop', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const { ChatCompletionService } = await import('/scripts/custom-request.js');
        const originalFetch = window.fetch;
        window.fetch = async () => new Response([
            { type: 'message_start', message: { role: 'assistant', content: [] } },
            { type: 'content_block_delta', delta: { type: 'text_delta', text: 'normal Claude text' } },
            { type: 'message_stop' },
        ].map(data => `data: ${JSON.stringify(data)}\n\n`).join(''));
        try {
            const factory = await ChatCompletionService.sendRequest({ stream: true, chat_completion_source: 'claude' });
            let text;
            for await (const chunk of factory()) text = chunk.text;
            return text;
        } finally { window.fetch = originalFetch; }
    });
    expect(result).toBe('normal Claude text');
});

test('a provider failure stops smooth generation instead of finishing it successfully', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const st = await import('/script.js');
        const { oai_settings } = await import('/scripts/openai.js');
        const { power_user } = await import('/scripts/power-user.js');
        st.changeMainAPI('openai');
        Object.assign(oai_settings, { chat_completion_source: 'custom', custom_url: 'http://127.0.0.1:1', custom_model: 'synthetic', stream_openai: true });
        power_user.tokenizer = 0;
        power_user.smooth_streaming = true;
        power_user.auto_continue.enabled = false;
        power_user.auto_swipe = false;
        st.setOnlineStatus('synthetic');
        await st.newAssistantChat({ temporary: true });
        const originalFetch = window.fetch;
        let requests = 0;
        window.fetch = async (url, options) => {
            if (!String(url).endsWith('/api/backends/chat-completions/generate')) return originalFetch(url, options);
            requests++;
            return new Response([
                { choices: [{ index: 0, delta: { content: 'partial' } }] },
                { error: { message: 'provider failed' } },
            ].map(data => `data: ${JSON.stringify(data)}\n\n`).join('') + 'data: [DONE]\n\n');
        };
        try {
            const value = await st.Generate('normal', { quiet_prompt: 'Synthetic prompt.' });
            return { returned: typeof value, requests, locked: st.is_send_press, stopped: st.streamingProcessor?.isStopped, finished: st.streamingProcessor?.isFinished };
        } finally { window.fetch = originalFetch; }
    });
    expect(result).toEqual({ returned: 'undefined', requests: 1, locked: false, stopped: true, finished: false });
});

for (const scenario of ['provider-before', 'provider-after', 'transport-after', 'reasoning-after', 'image-after', 'swipe-after', 'transport-before', 'normal', 'stop', 'fallback-stop', 'fallback-late']) {
    test(`/profile-genstream preserves retry and completion semantics for ${scenario}`, async ({ page }) => {
        const result = await page.evaluate(async scenario => {
            const { getContext } = await import('/scripts/extensions.js');
            const { ConnectionManagerRequestService } = await import('/scripts/extensions/shared.js');
            const { SlashCommandParser } = await import('/scripts/slash-commands/SlashCommandParser.js');
            const { SlashCommandClosure } = await import('/scripts/slash-commands/SlashCommandClosure.js');
            const { tryParseStreamingError } = await import('/scripts/openai.js');
            const settings = getContext().extensionSettings.connectionManager;
            const selected = settings.selectedProfile;
            const sendRequest = ConnectionManagerRequestService.sendRequest;
            const getIcon = ConnectionManagerRequestService.getProfileIcon;
            settings.selectedProfile = 'synthetic';
            let completed = 0;
            let fallbackAborted = false;
            const requests = [];
            const closure = new SlashCommandClosure();
            closure.getCopy = () => closure;
            closure.execute = async () => { completed++; };
            ConnectionManagerRequestService.getProfileIcon = () => null;
            ConnectionManagerRequestService.sendRequest = async (_id, _messages, _tokens, options) => {
                requests.push(options.stream);
                if (!options.stream) {
                    if (scenario.startsWith('fallback')) {
                        document.querySelector('.streaming-display-btn-stop').click();
                        fallbackAborted = options.signal?.aborted;
                        if (scenario === 'fallback-stop') options.signal.throwIfAborted();
                    }
                    return { content: 'fallback' };
                }
                return async function* () {
                    if (!scenario.endsWith('before') && !scenario.startsWith('fallback')) yield {
                        text: ['reasoning-after', 'image-after', 'swipe-after'].includes(scenario) ? '' : 'partial',
                        swipes: scenario === 'swipe-after' ? ['swipe'] : [],
                        state: { reasoning: scenario === 'reasoning-after' ? 'reasoning' : '', images: scenario === 'image-after' ? ['data:image/png;base64,YQ=='] : [] },
                    };
                    if (scenario.startsWith('provider')) tryParseStreamingError(new Response(), JSON.stringify({ error: 'provider failed' }), { quiet: true });
                    if (scenario === 'stop') {
                        document.querySelector('.streaming-display-btn-stop').click();
                        options.signal.throwIfAborted();
                    }
                    if (scenario !== 'normal') throw new TypeError('synthetic transport failure');
                };
            };
            try {
                const value = await SlashCommandParser.commands['profile-genstream'].callback({ onComplete: closure, delay: 'infinite' }, 'synthetic prompt');
                return { value, requests, completed, fallbackAborted, stopped: Boolean(document.querySelector('.streaming-display-stopped')) };
            } finally {
                settings.selectedProfile = selected;
                ConnectionManagerRequestService.sendRequest = sendRequest;
                ConnectionManagerRequestService.getProfileIcon = getIcon;
            }
        }, scenario);
        expect(result.requests).toEqual(['transport-before', 'fallback-stop', 'fallback-late'].includes(scenario) ? [true, false] : [true]);
        expect(result.completed).toBe(['transport-before', 'normal'].includes(scenario) ? 1 : 0);
        expect(result.fallbackAborted).toBe(scenario.startsWith('fallback'));
        expect(result.stopped).toBe(!['transport-before', 'normal'].includes(scenario));
        expect(result.value).toBe(scenario === 'transport-before' ? 'fallback' : ['normal', 'stop'].includes(scenario) ? 'partial' : '');
    });
}
