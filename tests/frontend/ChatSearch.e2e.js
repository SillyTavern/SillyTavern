import { expect, test } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

// Search responses are controlled in-browser; no model requests are made.
test.beforeEach(async ({ page }) => {
    const baseURL = process.env.ST_BASE_URL || process.env.PLAYWRIGHT_BASE_URL || 'http://127.0.0.1:8000';
    await page.route('**/*', route => new URL(route.request().url()).origin === new URL(baseURL).origin
        ? route.continue() : route.abort());
    await testSetup.awaitST({ page });
    await page.evaluate(async () => {
        const st = await import('/script.js');
        const { resetSelectedGroup } = await import('/scripts/group-chats.js');
        const { debounce_timeout } = await import('/scripts/constants.js');
        resetSelectedGroup();
        const firstId = st.characters.length;
        st.characters.push(
            { name: 'Search A', avatar: 'search-a.png', chat: 'Selected chat A' },
            { name: 'Search B', avatar: 'search-b.png', chat: 'Selected chat B' },
        );
        st.setCharacterId(firstId);
        const requests = [];
        const fetch = window.fetch;
        window.fetch = (url, options) => {
            if (url !== '/api/chats/search') return fetch(url, options);
            // Deliberately ignore aborts: stale results must also be rejected after JSON decoding.
            return new Promise((resolve, reject) => requests.push({
                body: JSON.parse(options.body), signal: options.signal,
                resolve: data => resolve({ ok: true, json: async () => data }),
                reject,
            }));
        };
        const waitFor = async predicate => {
            for (let i = 0; i < 200; i++) {
                if (predicate()) return;
                await new Promise(resolve => setTimeout(resolve, 10));
            }
            throw new Error('Timed out waiting for search state');
        };
        const input = value => {
            const element = document.getElementById('select_chat_search');
            element.value = value;
            element.dispatchEvent(new Event('input', { bubbles: true }));
        };
        const row = (file_name, last_mes = '2026-01-01') => ({
            file_name, last_mes, file_size: '1 KB', message_count: 2, preview_message: `<b>${file_name}</b>`,
        });
        window.searchFixture = { st, requests, waitFor, input, row, firstId, debounce_timeout };
    });
});

test('chat search accepts input during initial loading and never paints an obsolete response', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const { st, requests, waitFor, input, row } = window.searchFixture;
        const initialLoad = st.displayPastChats();
        input('older query');
        const initialAborted = requests[0].signal.aborted;
        await waitFor(() => requests.length === 2);
        input('latest query');
        const olderAborted = requests[1].signal.aborted;
        await waitFor(() => requests.length === 3);
        requests[2].resolve([row('Latest result')]);
        await waitFor(() => document.querySelector('#select_chat_div .select_chat_block_filename')?.textContent === 'Latest result');
        requests[1].resolve([row('Obsolete result')]);
        requests[0].resolve([row('Obsolete initial list')]);
        await initialLoad;
        await new Promise(resolve => setTimeout(resolve, 0));
        return {
            initialAborted, olderAborted,
            queries: requests.map(request => request.body.query),
            filenames: [...document.querySelectorAll('#select_chat_div .select_chat_block_filename')].map(element => element.textContent),
            errors: document.querySelectorAll('.toast-error').length,
        };
    });
    expect(result.initialAborted).toBe(true);
    expect(result.olderAborted).toBe(true);
    expect(result.queries).toEqual(['', 'older query', 'latest query']);
    expect(result.filenames).toEqual(['Latest result']);
    expect(result.errors).toBe(0);
});

test('reopening for another character isolates requests, callbacks and error notifications', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const { st, requests, waitFor, input, row, firstId } = window.searchFixture;
        const firstLoad = st.displayPastChats();
        input('abandoned debounce');
        st.setCharacterId(firstId + 1);
        const secondLoad = st.displayPastChats();
        requests[1].resolve([row('Selected chat B')]);
        await secondLoad;
        requests[0].reject(new Error('Obsolete request failed'));
        await firstLoad;
        input('character B query');
        await waitFor(() => requests.length >= 3);
        requests[2].resolve([row('Selected chat B')]);
        await waitFor(() => document.querySelector('#select_chat_div .select_chat_block_filename')?.textContent === 'Selected chat B');
        return {
            requests: requests.map(request => request.body),
            selected: document.querySelector('#select_chat_div .select_chat_block')?.getAttribute('highlight'),
            errors: document.querySelectorAll('.toast-error').length,
        };
    });
    expect(result.requests).toEqual([
        { query: '', avatar_url: 'search-a.png', group_id: null },
        { query: '', avatar_url: 'search-b.png', group_id: null },
        { query: 'character B query', avatar_url: 'search-b.png', group_id: null },
    ]);
    expect(result.selected).toBe('true');
    expect(result.errors).toBe(0);
});

test('changing characters without reopening discards the old results and the current request still reports failures', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const { st, requests, row, firstId } = window.searchFixture;
        const firstLoad = st.displayPastChats();
        st.setCharacterId(firstId + 1);
        requests[0].resolve([row('Wrong character')]);
        await firstLoad;
        const rendered = document.querySelectorAll('#select_chat_div .select_chat_block').length;
        const secondLoad = st.displayPastChats();
        requests[1].reject(new Error('Current request failed'));
        await secondLoad;
        return { rendered, errors: document.querySelectorAll('.toast-error').length };
    });
    expect(result.rendered).toBe(0);
    expect(result.errors).toBe(1);
});

test('closing the chat browser cancels requests and pending debounce work', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const { st, requests, input, row, debounce_timeout } = window.searchFixture;
        const initialLoad = st.displayPastChats();
        input('never send');
        document.getElementById('select_chat_cross').click();
        requests[0].resolve([row('Must not render after closing')]);
        await initialLoad;
        await new Promise(resolve => setTimeout(resolve, debounce_timeout.standard + 100));
        return {
            count: requests.length,
            aborted: requests[0].signal.aborted,
            rendered: document.querySelectorAll('#select_chat_div .select_chat_block').length,
            errors: document.querySelectorAll('.toast-error').length,
        };
    });
    expect(result.count).toBe(1);
    expect(result.aborted).toBe(true);
    expect(result.rendered).toBe(0);
    expect(result.errors).toBe(0);
});

test('typing during initial loading is not interrupted by delayed autofocus and selection', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const { st, requests, input } = window.searchFixture;
        let selections = 0;
        $('#select_chat_search').on('select.autofocus-test', () => selections++);
        const initialLoad = st.displayPastChats();
        input('Keep typing this query');
        requests[0].resolve([]);
        await initialLoad;
        await new Promise(resolve => setTimeout(resolve, 350));
        $('#select_chat_search').off('select.autofocus-test');
        return { selections, query: document.getElementById('select_chat_search').value };
    });
    expect(result.selections).toBe(0);
    expect(result.query).toBe('Keep typing this query');
});

test('large chat lists are inserted in one batch while preserving dates, selection and escaped previews', async ({ page }) => {
    const result = await page.evaluate(async () => {
        const { st, requests, row } = window.searchFixture;
        const initialLoad = st.displayPastChats();
        const list = document.getElementById('select_chat_div');
        const records = [];
        const observer = new MutationObserver(mutations => records.push(...mutations));
        observer.observe(list, { childList: true });
        const rows = Array.from({ length: 200 }, (_, index) => row(`Chat ${index}`, 1700000000000 + index * 1000));
        rows.push(row('Selected chat A', '2026-01-01'));
        requests[0].resolve(rows);
        await initialLoad;
        observer.disconnect();
        return {
            addedBatches: records.filter(record => record.addedNodes.length > 0).length,
            addedRows: records.reduce((count, record) => count + record.addedNodes.length, 0),
            first: list.querySelector('.select_chat_block_filename')?.textContent,
            last: list.querySelector('.select_chat_block_wrapper:last-child .select_chat_block_filename')?.textContent,
            selected: list.querySelector('.select_chat_block[highlight="true"]')?.getAttribute('file_name'),
            preview: list.querySelector('.select_chat_block_mes')?.textContent,
            markup: list.querySelector('.select_chat_block_mes b') !== null,
        };
    });
    expect(result.addedBatches).toBe(1);
    expect(result.addedRows).toBe(201);
    expect(result.first).toBe('Selected chat A');
    expect(result.last).toBe('Chat 0');
    expect(result.selected).toBe('Selected chat A');
    expect(result.preview).toBe('<b>Selected chat A</b>');
    expect(result.markup).toBe(false);
});
