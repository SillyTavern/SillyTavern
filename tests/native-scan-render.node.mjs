import assert from 'node:assert/strict';
import { test, before, after } from 'node:test';

// Run against an isolated server with ST_BASE_URL set. No model requests are made.
const baseURL = process.env.ST_BASE_URL;
let browser;
before(async () => {
    if (!baseURL) return;
    const { chromium } = await import(process.env.ST_PLAYWRIGHT_MODULE || 'playwright');
    browser = await chromium.launch({ channel: process.env.ST_BROWSER_CHANNEL });
});
after(async () => { await browser?.close(); });

async function openPage(t) {
    const context = await browser.newContext();
    t.after(() => context.close());
    await context.route('**/*', route => new URL(route.request().url()).origin === new URL(baseURL).origin
        ? route.continue() : route.abort());
    const page = await context.newPage();
    await page.goto(baseURL);
    await page.waitForFunction(() => window.SillyTavern && !document.getElementById('preloader'));
    return page;
}

test('worldbook scan caching preserves context, recursion, keyword and score semantics', { skip: !baseURL }, async (t) => {
    const page = await openPage(t);
    const result = await page.evaluate(async () => {
        const { WorldInfoBuffer, scan_state, world_info_depth, world_info_logic } = await import('/scripts/world-info.js');
        const messages = ['  Latest ALPHA 魔女  ', 'second BETA', '', 'old GAMMA'];
        const data = {
            personaDescription: 'Persona', characterDescription: 'Description',
            characterPersonality: 'Personality', characterDepthPrompt: 'Depth',
            scenario: 'Scenario', creatorNotes: 'Notes',
        };
        const fields = [
            ['matchPersonaDescription', 'personaDescription'],
            ['matchCharacterDescription', 'characterDescription'],
            ['matchCharacterPersonality', 'characterPersonality'],
            ['matchCharacterDepthPrompt', 'characterDepthPrompt'],
            ['matchScenario', 'scenario'],
            ['matchCreatorNotes', 'creatorNotes'],
        ];
        const buffer = new WorldInfoBuffer(messages, data);
        let checks = 0;
        const verify = (actual, expected) => {
            if (actual !== expected) throw new Error(`Mismatch: ${JSON.stringify({ actual, expected })}`);
            checks++;
        };
        const injected = [];
        const recursive = [];
        let skew = 0;
        // Reference assembly keeps the original separator and sparse-message behavior.
        function reference(entry, state) {
            const depth = Math.min(entry.scanDepth ?? world_info_depth + skew, 1000);
            if (depth <= 0) return '';
            let text = '\x01' + messages.slice(0, depth).map(text => text.trim()).join('\n\x01');
            for (const [flag, field] of fields) {
                if (entry[flag] && data[field]) text += '\n\x01' + data[field];
            }
            if (injected.length) text += '\n\x01' + injected.join('\n\x01');
            if (recursive.length && state !== scan_state.MIN_ACTIVATIONS) text += '\n\x01' + recursive.join('\n\x01');
            return text;
        }
        function checkConfigurations() {
            for (let flags = 0; flags < 64; flags++) {
                const entry = Object.fromEntries(fields.map(([flag], index) => [flag, Boolean(flags & (1 << index))]));
                for (const depth of [0, 1, 2, 4, undefined]) {
                    entry.scanDepth = depth;
                    for (const state of [scan_state.INITIAL, scan_state.RECURSION, scan_state.MIN_ACTIVATIONS]) {
                        verify(buffer.get(entry, state), reference(entry, state));
                        verify(buffer.get({ ...entry }, state), reference(entry, state));
                    }
                }
            }
        }
        checkConfigurations();
        buffer.addInject('INJECT');
        injected.push('INJECT');
        buffer.addRecurse('RECURSE');
        recursive.push('RECURSE');
        checkConfigurations();
        buffer.advanceScan();
        skew++;
        data.personaDescription = 'Changed persona';
        checkConfigurations();
        const entry = { scanDepth: 2, key: ['alpha', '魔女'], keysecondary: ['beta'], selectiveLogic: world_info_logic.AND_ALL };
        const text = buffer.get(entry, scan_state.INITIAL);
        for (const [key, options, expected] of [
            ['alpha', {}, true], ['alpha', { caseSensitive: true }, false],
            ['ALPHA', { caseSensitive: true }, true], ['pha', { matchWholeWords: true }, false],
            ['alpha', { matchWholeWords: true }, true], ['魔女', {}, true],
            ['/ALPHA/', {}, true], ['/alpha/', {}, false], ['/alpha/i', {}, true],
            ['missing', {}, false],
        ]) {
            verify(buffer.matchKeys(text, key, options), expected);
        }
        verify(buffer.getScore(entry, scan_state.INITIAL), 3);
        entry.selectiveLogic = world_info_logic.NOT_ANY;
        verify(buffer.getScore(entry, scan_state.INITIAL), 2);
        const other = new WorldInfoBuffer(['different chat'], data);
        verify(other.matchKeys(other.get({ scanDepth: 2 }, scan_state.INITIAL), 'alpha', {}), false);

        // Count expensive operations for identical scans and different keywords.
        const fresh = new WorldInfoBuffer(messages, data);
        const join = Array.prototype.join;
        const lower = String.prototype.toLowerCase;
        let joins = 0;
        let folds = 0;
        let scanText;
        try {
            Array.prototype.join = function (separator) {
                if (separator === '\n\x01') joins++;
                return join.call(this, separator);
            };
            String.prototype.toLowerCase = function () {
                if (String(this) === scanText) folds++;
                return lower.call(this);
            };
            for (let i = 0; i < 100; i++) {
                scanText = fresh.get({ scanDepth: 2 }, scan_state.INITIAL);
                fresh.matchKeys(scanText, `missing-${i}`, {});
            }
        } finally {
            Array.prototype.join = join;
            String.prototype.toLowerCase = lower;
        }
        return { checks, joins, folds };
    });
    assert.ok(result.checks > 5000);
    assert.equal(result.joins, 1);
    assert.equal(result.folds, 1);
});

test('reasoning reuses Markdown while regex macros, display settings, hooks and sanitization stay live', { skip: !baseURL }, async (t) => {
    const page = await openPage(t);
    const result = await page.evaluate(async () => {
        const st = await import('/script.js');
        const { power_user } = await import('/scripts/power-user.js');
        const { extension_settings } = await import('/scripts/extensions.js');
        const { regex_placement } = await import('/scripts/extensions/regex/engine.js');
        const { ReasoningHandler } = await import('/scripts/reasoning.js');
        const { MessageFormatter } = await import('/scripts/message-formatter.js');
        const { trackMarkdownConverter } = await import('/scripts/util/markdown-cache.js');
        const verify = (condition, message) => { if (!condition) throw new Error(message); };
        power_user.markdown_escape_strings = '';
        power_user.stream_fade_in = false;
        st.reloadMarkdownProcessor();
        extension_settings.disabledExtensions = extension_settings.disabledExtensions.filter(name => name !== 'regex');
        extension_settings.regex = [{
            id: 'cache-regex', scriptName: 'Cache fixture', findRegex: '/TOKEN/g',
            replaceString: '{{getvar::cache_value}}', trimStrings: [],
            placement: [regex_placement.REASONING], markdownOnly: true, promptOnly: false,
            runOnEdit: true, substituteRegex: 0, minDepth: 0, maxDepth: 0,
        }];
        st.chat_metadata.variables = { cache_value: 'ALPHA' };
        st.chat.length = 0;
        st.chat.push({
            name: 'Character', mes: 'Body', is_user: false, is_system: false,
            send_date: '2026-01-01', extra: { reasoning: 'TOKEN **thought** <b>bold</b>\n\n```js\nconst x = 1 < 2;\n```' },
        });
        document.getElementById('chat').replaceChildren();
        st.addOneMessage(st.chat[0], { forceId: 0, scroll: false, showSwipes: false });
        let conversions = 0;
        const makeHtml = st.converter.makeHtml;
        st.converter.makeHtml = function (text) { conversions++; return makeHtml.call(this, text); };
        trackMarkdownConverter(st.converter);
        const handler = new ReasoningHandler();
        handler.initHandleMessage(0);
        const thought = document.querySelector('#chat .mes_reasoning');
        verify(thought.textContent.includes('ALPHA'), 'Initial regex macro did not run');
        const first = conversions;
        for (let i = 0; i < 100; i++) handler.updateDom(0);
        verify(conversions === first, 'Unchanged reasoning repeated Markdown conversion');
        handler.updateDom(0, { force: true });
        verify(conversions === first + 1, 'Final render did not refresh Markdown');
        st.chat_metadata.variables.cache_value = 'BETA';
        handler.updateDom(0);
        verify(thought.textContent.includes('BETA'), 'Macro change was cached');
        extension_settings.regex[0].replaceString = 'GAMMA';
        handler.updateDom(0);
        verify(thought.textContent.includes('GAMMA'), 'Regex change was cached');
        power_user.encode_tags = true;
        handler.updateDom(0);
        verify(thought.textContent.includes('<b>bold</b>'), 'Tag display setting was cached');
        handler.reasoningDisplayText = '**Translated**';
        handler.updateDom(0);
        verify(thought.textContent.includes('Translated'), 'Translated reasoning was cached');
        handler.reasoningDisplayText = null;
        handler.updateDom(0);
        verify(thought.textContent.includes('GAMMA'), 'Restored reasoning was cached');

        let beforeCalls = 0;
        let afterCalls = 0;
        MessageFormatter.addHook(text => { beforeCalls++; return text; }, { stage: MessageFormatter.stage.BEFORE_REGEX });
        MessageFormatter.addHook(text => text + `<span>version-${++afterCalls}</span><img src="bad" onerror="alert(1)"><script>alert(1)</script>`);
        const beforeHooks = conversions;
        handler.updateDom(0);
        handler.updateDom(0);
        verify(beforeCalls === 2 && afterCalls === 2, 'Formatter hooks were skipped');
        verify(conversions === beforeHooks, 'Hooks prevented reuse of unchanged Markdown');
        verify(thought.textContent.includes('version-2'), 'Dynamic hook output did not update');
        verify(!thought.querySelector('script, [onerror]'), 'Unsafe HTML survived sanitization');
        return { initialConversions: first, repeatedUpdates: 100, beforeCalls, afterCalls };
    });
    assert.equal(result.initialConversions, 1);
    assert.equal(result.beforeCalls, 2);
    assert.equal(result.afterCalls, 2);
});
