import { groups } from './group-chats.js';
import { t } from './i18n.js';
import { Popup } from './popup.js';
import { accountStorage } from './util/AccountStorage.js';
import { characters, getRequestHeaders } from '/script.js';

//This code is temporary, and will be removed before merging.
const key = 'migrateComplete';

/**
 * This asks the server to get the chat trees, triggering the migration.
 * @param {object} char
 * @param {object} group
 * @returns The number of read files.
 */
async function searchCharacter(char, group) {
    const response = await fetch('/api/chats/search', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            query: '',
            avatar_url: group?.id ? null : char.avatar,
            group_id: group?.id || null,
        }),
    });
    if (!response.ok) {
        throw new Error('Search failed');
    }
    const data = await response.json();
    return data.length;
}

/**
 * Attempts to migrate each character.
 */
async function migrate() {
    let count = 0;
    try {
        for (const group of groups) {
            count += await searchCharacter(null, group);
        }
        for (const char of characters) {
            count += await searchCharacter(char, null);
        }
        accountStorage.setItem(key, 'true');
        toastr.success(t`Up to ${count} characters have been migrated, check the server's console for logs for more information.`);
        await Popup.show.text(
            t`Success!`,
            t`Up to ${count} characters have been migrated, check the console for logs. After confirming you have not lost data, you can delete the files ending in '.migrated' from the chatTree folder.`,
        );
    }
    catch (error) {
        console.trace(error);
        toastr.error('Migration failed.');
        await Popup.show.text(
            t`The Migration may have failed.`,
            t`Restore from a backup and switch to staging, or ask for help here: https://github.com/SillyTavern/SillyTavern/pull/4573 Please provide both server and console logs.`,
        );
    }
}

/**
 * A warning popup. More information is on the linked PR.
 */
export async function migrateChatTreePopup() {
    const hasSeenNotice = accountStorage.getItem(key);
    if (!hasSeenNotice) {
        const result = await Popup.show.confirm(
            t`Warning: Clicking yes MAY ERASE your chat trees. Take a backup now.`,
            t`Your chatTree files must be migrated. Please see https://github.com/SillyTavern/SillyTavern/pull/4573#issuecomment-3600547058 for more information.`,
        );
        if (result) {
            await migrate();
        }
    }
}
