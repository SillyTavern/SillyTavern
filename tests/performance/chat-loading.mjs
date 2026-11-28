import fs from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import { parseArgs } from 'node:util';
import { chromium } from '@playwright/test';

const { values } = parseArgs({ options: {
    url: { type: 'string', default: 'http://127.0.0.1:18766' },
    output: { type: 'string' },
    executable: { type: 'string' },
    mode: { type: 'string', default: 'baseline' },
    fixture: { type: 'string', default: 'bench-heavy-9000rounds' },
    messages: { type: 'string', default: '18000' },
    page: { type: 'string', default: '100' },
    repeats: { type: 'string', default: '5' },
} });
if (!values.output) throw new Error('--output is required');
const browser = await chromium.launch({ headless: true, executablePath: values.executable });
const results = {
    environment: {
        mode: values.mode, fixture: values.fixture, expectedMessages: Number(values.messages),
        pageSize: Number(values.page), browser: browser.version(), node: process.version,
        platform: process.platform, arch: process.arch, cpu: os.cpus()[0]?.model,
        ramGiB: os.totalmem() / 2 ** 30, viewport: { width: 1440, height: 1000 },
        cache: 'Fresh browser context per trial; OS file cache is not flushed.',
        instrumentation: 'Real getChat(), no source overrides; resource/long-task/CDP heap metrics.',
    },
    trials: [],
};
await fs.mkdir(path.dirname(path.resolve(values.output)), { recursive: true });

async function persist() {
    await fs.writeFile(values.output, JSON.stringify(results, null, 2) + '\n');
}

try {
    for (let repetition = 1; repetition <= Number(values.repeats); repetition++) {
        const context = await browser.newContext({ viewport: results.environment.viewport, locale: 'zh-CN' });
        const page = await context.newPage();
        const errors = [];
        page.on('pageerror', error => errors.push(error.message));
        try {
            await page.goto(values.url, { waitUntil: 'load', timeout: 60000 });
            await page.waitForFunction(() => !document.getElementById('preloader'), null, { timeout: 60000 });
            await page.evaluate(async () => {
                const st = await import('/script.js');
                await new Promise(resolve => st.eventSource.on(st.event_types.APP_READY, resolve));
                for (const dialog of document.querySelectorAll('dialog[open]')) dialog.close();
            });
            const cdp = await context.newCDPSession(page);
            await cdp.send('Performance.enable');
            const sample = await page.evaluate(async ({ fixture, pageSize, mode, expectedMessages }) => {
                const st = await import('/script.js');
                const { power_user } = await import('/scripts/power-user.js');
                await st.clearChat({ clearData: true });
                const characterId = st.characters.findIndex(character => character.avatar === 'default_Seraphina.png');
                if (characterId < 0) throw new Error('Synthetic fixture character is missing');
                st.setCharacterId(characterId);
                st.characters[characterId].chat = fixture;
                power_user.chat_truncation = pageSize;
                power_user.reasoning.auto_expand = false;
                performance.clearResourceTimings();
                const tasks = [];
                const observer = new PerformanceObserver(list => tasks.push(...list.getEntries().map(x => ({ start: x.startTime, duration: x.duration }))));
                observer.observe({ type: 'longtask', buffered: false });
                const started = performance.now();
                await st.getChat();
                const returned = performance.now();
                await new Promise(resolve => requestAnimationFrame(() => requestAnimationFrame(resolve)));
                const painted = performance.now();
                await new Promise(resolve => setTimeout(resolve, 50));
                observer.disconnect();
                const requests = performance.getEntriesByType('resource')
                    .filter(entry => /\/api\/chats\/(get|page|messages|window)(?:\?|$)/.test(new URL(entry.name).pathname))
                    .map(entry => ({ path: new URL(entry.name).pathname, durationMs: entry.duration, transferBytes: entry.transferSize, decodedBytes: entry.decodedBodySize }));
                const renderedMessages = document.querySelectorAll('#chat > .mes').length;
                if (renderedMessages !== Math.min(pageSize, expectedMessages)) throw new Error(`Wrong render count: ${renderedMessages}`);
                if (mode === 'baseline' && st.chat.length !== expectedMessages) throw new Error(`Baseline did not load all messages: ${st.chat.length}`);
                if (mode !== 'baseline' && st.chat.length > pageSize * 3) throw new Error(`Paged mode loaded too many messages: ${st.chat.length}`);
                return {
                    loadUntilReturnedMs: returned - started, loadUntilTwoFramesMs: painted - started,
                    storedMessages: st.chat.length, renderedMessages,
                    elementNodes: document.querySelector('#chat').querySelectorAll('*').length,
                    maxLongTaskMs: Math.max(0, ...tasks.filter(x => x.start >= started && x.start <= painted).map(x => x.duration)),
                    requests, decodedChatBytes: requests.reduce((sum, r) => sum + r.decodedBytes, 0),
                    firstMessageChars: st.chat[0]?.mes?.length, lastMessageChars: st.chat.at(-1)?.mes?.length,
                    showMoreAvailable: !!document.getElementById('show_more_messages'),
                };
            }, { fixture: values.fixture, pageSize: Number(values.page), mode: values.mode, expectedMessages: Number(values.messages) });
            await cdp.send('HeapProfiler.collectGarbage');
            const metrics = await cdp.send('Performance.getMetrics');
            sample.retainedJsHeapMiB = metrics.metrics.find(x => x.name === 'JSHeapUsedSize').value / 2 ** 20;
            sample.domNodes = (await cdp.send('Memory.getDOMCounters')).nodes;
            results.trials.push({ repetition, ...sample, errors });
            console.log(JSON.stringify({ repetition, ...sample, errors }));
            if (repetition === 1) await page.screenshot({ path: values.output.replace(/\.json$/, '.png') });
        } catch (error) {
            results.trials.push({ repetition, error: String(error), errors });
            throw error;
        } finally {
            await context.close();
            await persist();
        }
    }
} finally {
    await browser.close();
    await persist();
}
