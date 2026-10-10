import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

function deferred() {
    let resolve;
    const promise = new Promise(done => { resolve = done; });
    return { promise, resolve };
}

async function holdFirstSave(page, endpoint) {
    const entered = deferred();
    const release = deferred();
    const requests = [];
    const pattern = `**${endpoint}`;
    await page.route(pattern, async route => {
        requests.push(route.request().postDataJSON());
        if (requests.length === 1) {
            entered.resolve();
            await release.promise;
        }
        await route.continue();
    });
    return { entered: entered.promise, release: release.resolve, requests, pattern };
}

test('queued normal/group edits survive switching and failed checkpoints do not report success', async ({ page }) => {
    const errors = [];
    const modelRequests = [];
    page.on('pageerror', error => errors.push(error.message));
    await page.route('**/api/**/generate', route => {
        modelRequests.push(route.request().url());
        return route.abort();
    });
    await testSetup.awaitST({ page });
    const ids = await page.evaluate(async () => {
        const st = await import('/script.js');
        const groups = await import('/scripts/group-chats.js');
        const stamp = Date.now();
        const characterId = st.characters.findIndex(character => character.avatar === 'default_Seraphina.png');
        if (characterId < 0) throw new Error('This test needs the isolated default character fixture');
        await st.selectCharacterById(characterId);
        await st.openCharacterChat(`chat-save-${stamp}`);
        const response = await fetch('/api/groups/create', {
            method: 'POST', headers: st.getRequestHeaders(), body: JSON.stringify({ name: `Save test ${stamp}`, members: [] }),
        });
        if (!response.ok) throw new Error('Could not create group fixture');
        const group = await response.json();
        await fetch('/api/chats/group/save', {
            method: 'POST', headers: st.getRequestHeaders(),
            body: JSON.stringify({ id: group.chat_id, chat: [
                { chat_metadata: { integrity: group.id, tainted: true }, user_name: 'unused', character_name: 'unused' },
                { name: 'User', is_user: true, mes: 'group fixture', extra: {} },
            ] }),
        });
        await groups.getGroups();
        window.chatSaveTest = { st, groups, characterId, groupId: group.id };
        return { characterId, groupId: group.id, stamp };
    });

    const normal = await holdFirstSave(page, '/api/chats/save');
    try {
        await page.evaluate(() => {
            const { st } = window.chatSaveTest;
            st.chat.splice(0, st.chat.length, { name: 'User', is_user: true, mes: 'normal original', extra: {} });
            st.chat_metadata.tainted = true;
            window.chatSaveTest.first = st.saveChatConditional();
        });
        await normal.entered;
        const debounceFired = page.waitForEvent('console', message => message.text() === 'Chat save timeout triggered');
        const switched = await page.evaluate(async () => {
            const { st, groups, groupId } = window.chatSaveTest;
            st.chat[0].mes = 'normal latest';
            st.saveChatDebounced();
            return await groups.openGroupById(groupId);
        });
        expect(switched).toBe(false);
        await debounceFired;
        expect(normal.requests).toHaveLength(1);
        normal.release();
        await expect.poll(() => page.evaluate(() => window.chatSaveTest.st.isChatSaving)).toBe(false);
        expect(normal.requests.map(body => body.chat[1].mes)).toEqual(['normal original', 'normal latest']);
    } finally {
        normal.release();
        await page.unroute(normal.pattern);
    }

    await page.evaluate(async () => {
        const { groups, groupId } = window.chatSaveTest;
        await groups.openGroupById(groupId);
    });
    const group = await holdFirstSave(page, '/api/chats/group/save');
    try {
        await page.evaluate(() => {
            const { st } = window.chatSaveTest;
            st.chat[0].mes = 'group original';
            window.chatSaveTest.first = st.saveChatConditional();
        });
        await group.entered;
        const stillSelected = await page.evaluate(async () => {
            const { st, groups, characterId } = window.chatSaveTest;
            st.chat[0].mes = 'group latest';
            window.chatSaveTest.second = st.saveChatConditional();
            await st.selectCharacterById(characterId);
            return groups.selected_group;
        });
        expect(stillSelected).toBe(ids.groupId);
        expect(group.requests).toHaveLength(1);
        group.release();
        await page.evaluate(() => Promise.all([window.chatSaveTest.first, window.chatSaveTest.second]));
        expect(group.requests.map(body => body.chat[1].mes)).toEqual(['group original', 'group latest']);
    } finally {
        group.release();
        await page.unroute(group.pattern);
    }

    const reloaded = await page.evaluate(async () => {
        const { st, groups, characterId, groupId } = window.chatSaveTest;
        await st.selectCharacterById(characterId);
        const normal = st.chat[0].mes;
        await groups.openGroupById(groupId);
        return { normal, group: st.chat[0].mes, saving: st.isChatSaving };
    });
    expect(reloaded).toEqual({ normal: 'normal latest', group: 'group latest', saving: false });
    await expect(page.locator('#chat')).toContainText('group latest');

    await page.route('**/api/chats/group/save', route => route.fulfill({ status: 503, json: { error: true } }));
    const failed = await page.evaluate(async name => {
        const { st, groups, groupId } = window.chatSaveTest;
        const { createNewBookmark } = await import('/scripts/bookmarks.js');
        const result = await createNewBookmark(0, { forceName: name });
        return { result, registered: groups.groups.find(group => group.id === groupId).chats.includes(name), linked: st.chat[0].extra?.bookmark_link ?? null, saving: st.isChatSaving };
    }, `failed-checkpoint-${ids.stamp}`);
    expect(failed).toEqual({ result: null, registered: false, linked: null, saving: false });
    await page.unroute('**/api/chats/group/save');

    const checkpoint = await page.evaluate(async name => {
        const { st } = window.chatSaveTest;
        const { createNewBookmark } = await import('/scripts/bookmarks.js');
        const result = await createNewBookmark(0, { forceName: name });
        const response = await fetch('/api/chats/group/get', { method: 'POST', headers: st.getRequestHeaders(), body: JSON.stringify({ id: result }) });
        return { name: result, saved: await response.json(), saving: st.isChatSaving };
    }, `checkpoint-${ids.stamp}`);
    expect(checkpoint.name).toBe(`checkpoint-${ids.stamp}`);
    expect(checkpoint.saved[1].mes).toBe('group latest');
    expect(checkpoint.saving).toBe(false);
    expect(errors).toEqual([]);
    expect(modelRequests).toEqual([]);
});
