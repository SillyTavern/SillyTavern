import { test, expect } from '@playwright/test';
import { testSetup } from './frontent-test-utils.js';

test.describe('Saving while a chat is loading', () => {
    test.beforeEach(testSetup.awaitST);

    test('does not overwrite the chat file', async ({ page }) => {
        const result = await page.evaluate(async () => {
            const script = await import('./script.js');
            const groupChats = await import('./scripts/group-chats.js');
            const context = SillyTavern.getContext();
            const headers = script.getRequestHeaders();
            const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
            const post = (url, body) => fetch(url, { method: 'POST', headers, cache: 'no-cache', body: JSON.stringify(body) });

            // A fresh account runs onboarding on load: dismiss its popup.
            for (let i = 0; i < 10; i++) {
                const okButton = document.querySelector('.popup:popover-open .popup-button-ok, dialog[open] .popup-button-ok');
                if (!okButton) break;
                okButton.click();
                await delay(300);
            }

            // Holds the next chat download, as a large chat or a slow connection would.
            const holdNextDownload = (endpoint) => {
                const realFetch = window.fetch;
                window.fetch = async (input, init) => {
                    if (String(input).endsWith(endpoint)) {
                        window.fetch = realFetch;
                        await delay(1000);
                    }
                    return realFetch(input, init);
                };
            };
            const addMessages = (count) => {
                for (let i = 0; i < count; i++) {
                    context.chat.push({ name: 'User', is_user: true, is_system: false, send_date: new Date().toISOString(), mes: `Message ${i}`, extra: {} });
                }
            };
            const countMessages = async (url, body) => {
                const data = await (await post(url, body)).json();
                return Array.isArray(data) ? data.length - 1 : 0;
            };

            const characterId = context.characters.findIndex(x => x.avatar);
            const character = context.characters[characterId];
            const countCharacterChat = (fileName) => countMessages('/api/chats/get', { ch_name: character.name, file_name: fileName, avatar_url: character.avatar });

            await script.selectCharacterById(characterId);
            await script.doNewChat();
            addMessages(3);
            await context.saveChat();
            const chatA = context.getCurrentChatId();
            const savedA = await countCharacterChat(chatA);

            // A save made while the chat reloads
            holdNextDownload('/api/chats/get');
            const reload = context.reloadCurrentChat();
            await delay(300);
            await context.saveChat();
            await reload;
            const afterReload = await countCharacterChat(chatA);

            // A save made while another chat is opened: the chat being opened must survive
            await script.doNewChat();
            const chatB = context.getCurrentChatId();
            holdNextDownload('/api/chats/get');
            const open = script.openCharacterChat(chatA);
            await delay(300);
            await context.saveChat();
            await open;
            const afterSwitch = await countCharacterChat(chatA);

            // Saving works again once the chat is loaded
            addMessages(1);
            await context.saveChat();
            const afterLoad = await countCharacterChat(chatA);

            // The same for a group chat reload
            const group = await (await post('/api/groups/create', { name: 'Save during load test', members: [character.avatar] })).json();
            await groupChats.getGroups();
            await groupChats.openGroupById(group.id);
            addMessages(2);
            await context.saveChat();
            const countGroupChat = () => countMessages('/api/chats/group/get', { id: group.chat_id });
            const savedGroup = await countGroupChat();
            holdNextDownload('/api/chats/group/get');
            const groupReload = context.reloadCurrentChat();
            await delay(300);
            await context.saveChat();
            await groupReload;
            const afterGroupReload = await countGroupChat();
            addMessages(1);
            await context.saveChat();
            const afterGroupLoad = await countGroupChat();

            await script.closeCurrentChat();
            await post('/api/groups/delete', { id: group.id });
            for (const chatfile of [chatA, chatB]) {
                await post('/api/chats/delete', { chatfile: `${chatfile}.jsonl`, avatar_url: character.avatar });
            }

            return { savedA, afterReload, afterSwitch, afterLoad, savedGroup, afterGroupReload, afterGroupLoad };
        });

        expect(result.afterReload).toBe(result.savedA);
        expect(result.afterSwitch).toBe(result.savedA);
        expect(result.afterLoad).toBe(result.savedA + 1);
        expect(result.afterGroupReload).toBe(result.savedGroup);
        expect(result.afterGroupLoad).toBe(result.savedGroup + 1);
    });
});
