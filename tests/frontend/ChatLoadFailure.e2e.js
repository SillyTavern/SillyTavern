import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

test.describe('chat load failures fail closed', () => {
    test.beforeEach(testSetup.awaitST);

    test('does not save a character chat after a failed read', async ({ page }) => {
        let saveRequests = 0;
        page.on('request', request => {
            if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/chats/save') {
                saveRequests++;
            }
        });
        await page.route('**/api/chats/get', route => route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Chat could not be loaded.' }),
        }));

        await page.evaluate(async () => {
            const script = await import('./script.js');
            const characterId = script.characters.push({
                name: 'Load Failure Test',
                avatar: 'load-failure.png',
                chat: 'load-failure',
                first_mes: 'This greeting must not be saved.',
            }) - 1;
            script.chat.splice(0, script.chat.length);
            script.setCharacterId(characterId);
            void script.getChat();
        });

        const errorDialog = page.getByRole('dialog').filter({
            has: page.getByRole('heading', { name: 'Chat could not be loaded', exact: true }),
        });
        await expect(errorDialog).toBeVisible();
        await new Promise(resolve => setTimeout(resolve, 200));
        expect(saveRequests).toBe(0);

        const navigation = page.waitForEvent('framenavigated', frame => frame === page.mainFrame());
        await errorDialog.locator('.popup-button-ok').click();
        await navigation;
        expect(saveRequests).toBe(0);
    });

    test('does not save a group chat after a failed read', async ({ page }) => {
        let saveRequests = 0;
        page.on('request', request => {
            if (request.method() === 'POST' && new URL(request.url()).pathname === '/api/chats/group/save') {
                saveRequests++;
            }
        });
        await page.route('**/api/chats/group/get', route => route.fulfill({
            status: 500,
            contentType: 'application/json',
            body: JSON.stringify({ error: 'Chat could not be loaded.' }),
        }));

        await page.evaluate(async () => {
            const script = await import('./script.js');
            const groupChats = await import('./scripts/group-chats.js');
            groupChats.groups.push({
                id: 'load-failure-group',
                name: 'Load Failure Group',
                chat_id: 'load-failure-chat',
                chats: ['load-failure-chat'],
                members: [],
                disabled_members: [],
            });
            script.chat.splice(0, script.chat.length);
            void groupChats.getGroupChat('load-failure-group');
        });

        const errorDialog = page.getByRole('dialog').filter({
            has: page.getByRole('heading', { name: 'Group chat could not be loaded', exact: true }),
        });
        await expect(errorDialog).toBeVisible();
        await new Promise(resolve => setTimeout(resolve, 200));
        expect(saveRequests).toBe(0);

        const navigation = page.waitForEvent('framenavigated', frame => frame === page.mainFrame());
        await errorDialog.locator('.popup-button-ok').click();
        await navigation;
        expect(saveRequests).toBe(0);
    });
});
