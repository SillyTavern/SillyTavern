import { eventSource, event_types, getCurrentChatId, getRequestHeaders, saveSettingsDebounced } from "../../../script.js";
import { ModuleWorkerWrapper, extension_settings, getContext, renderExtensionTemplate } from "../../extensions.js";
import { collapseNewlines } from "../../power-user.js";
import { debounce, getStringHash as calculateHash } from "../../utils.js";

const MODULE_NAME = 'vectors';
const MIN_TO_LEAVE = 5;
const QUERY_AMOUNT = 2;
const LEAVE_RATIO = 0.5;

const settings = {
    enabled: false,
};

const moduleWorker = new ModuleWorkerWrapper(synchronizeChat);

async function synchronizeChat() {
    try {
        if (!settings.enabled) {
            return;
        }

        const context = getContext();
        const chatId = getCurrentChatId();

        if (!chatId || !Array.isArray(context.chat)) {
            console.debug('Vectors: No chat selected');
            return;
        }

        const hashedMessages = context.chat.filter(x => !x.is_system).map(x => ({ text: String(x.mes), hash: getStringHash(x.mes) }));
        const hashesInCollection = await getSavedHashes(chatId);

        const newVectorItems = hashedMessages.filter(x => !hashesInCollection.includes(x.hash));
        const deletedHashes = hashesInCollection.filter(x => !hashedMessages.some(y => y.hash === x));

        if (newVectorItems.length > 0) {
            await insertVectorItems(chatId, newVectorItems);
            console.log(`Vectors: Inserted ${newVectorItems.length} new items`);
        }

        if (deletedHashes.length > 0) {
            await deleteVectorItems(chatId, deletedHashes);
            console.log(`Vectors: Deleted ${deletedHashes.length} old hashes`);
        }
    } catch (error) {
        console.error('Vectors: Failed to synchronize chat', error);
    }
}

// Cache object for storing hash values
const hashCache = {};

/**
 * Gets the hash value for a given string
 * @param {string} str Input string
 * @returns {number} Hash value
 */
function getStringHash(str) {
  // Check if the hash is already in the cache
  if (hashCache.hasOwnProperty(str)) {
    return hashCache[str];
  }

  // Calculate the hash value
  const hash = calculateHash(str);

  // Store the hash in the cache
  hashCache[str] = hash;

  return hash;
}

/**
 * Rearranges the chat based on the relevance of recent messages
 * @param {object[]} chat Array of chat messages
 */
async function rearrangeChat(chat) {
    try {
        if (!settings.enabled) {
            return;
        }

        const chatId = getCurrentChatId();

        if (!chatId || !Array.isArray(chat)) {
            console.debug('Vectors: No chat selected');
            return;
        }

        if (chat.length < MIN_TO_LEAVE) {
            console.debug(`Vectors: Not enough messages to rearrange (less than ${MIN_TO_LEAVE})`);
            return;
        }

        const queryText = getQueryText(chat);

        if (queryText.length === 0) {
            console.debug('Vectors: No text to query');
            return;
        }

        const queryHashes = await queryCollection(chatId, queryText);

        // Sorting logic
        // 1. 50% of messages at the end stay in the same place (minimum 5)
        // 2. Messages that are in the query are rearranged to match the query order
        // 3. Messages that are not in the query and are not in the top 50% stay in the same place
        const queriedMessages = [];
        const remainingMessages = [];

        // Leave the last N messages intact
        const retainMessagesCount = Math.max(Math.floor(chat.length * LEAVE_RATIO), MIN_TO_LEAVE);
        const lastNMessages = chat.slice(-retainMessagesCount);

        // Splitting messages into queried and remaining messages
        for (const message of chat) {
            if (lastNMessages.includes(message)) {
                continue;
            }

            if (message.mes && queryHashes.includes(getStringHash(message.mes))) {
                queriedMessages.push(message);
            } else {
                remainingMessages.push(message);
            }
        }

        // Rearrange queried messages to match query order
        // Order is reversed because more relevant are at the lower indices
        queriedMessages.sort((a, b) => {
            return queryHashes.indexOf(getStringHash(b.mes)) - queryHashes.indexOf(getStringHash(a.mes));
        });

        // Construct the final rearranged chat
        const rearrangedChat = [...remainingMessages, ...queriedMessages, ...lastNMessages];

        if (rearrangedChat.length !== chat.length) {
            console.error('Vectors: Rearranged chat length does not match original chat length! This should not happen.');
            return;
        }

        // Update the original chat array in-place
        chat.splice(0, chat.length, ...rearrangedChat);
    } catch (error) {
        console.error('Vectors: Failed to rearrange chat', error);
    }
}

window['vectors_rearrangeChat'] = rearrangeChat;

const onChatEvent = debounce(async () => await moduleWorker.update(), 500);

function getQueryText(chat) {
    let queryText = '';
    let i = 0;

    for (const message of chat.slice().reverse()) {
        if (message.mes) {
            queryText += message.mes + '\n';
            i++;
        }

        if (i === QUERY_AMOUNT) {
            break;
        }
    }

    return collapseNewlines(queryText).trim();
}

/**
 * Gets the saved hashes for a collection
* @param {string} collectionId
* @returns {Promise<number[]>} Saved hashes
*/
async function getSavedHashes(collectionId) {
    const response = await fetch('/api/vector/list', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ collectionId }),
    });

    if (!response.ok) {
        throw new Error(`Failed to get saved hashes for collection ${collectionId}`);
    }

    const hashes = await response.json();
    return hashes;
}

/**
 * Inserts vector items into a collection
 * @param {string} collectionId - The collection to insert into
 * @param {{ hash: number, text: string }[]} items - The items to insert
 * @returns {Promise<void>}
 */
async function insertVectorItems(collectionId, items) {
    const response = await fetch('/api/vector/insert', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ collectionId, items }),
    });

    if (!response.ok) {
        throw new Error(`Failed to insert vector items for collection ${collectionId}`);
    }
}

/**
 * Deletes vector items from a collection
 * @param {string} collectionId - The collection to delete from
 * @param {number[]} hashes - The hashes of the items to delete
 * @returns {Promise<void>}
 */
async function deleteVectorItems(collectionId, hashes) {
    const response = await fetch('/api/vector/delete', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ collectionId, hashes }),
    });

    if (!response.ok) {
        throw new Error(`Failed to delete vector items for collection ${collectionId}`);
    }
}

/**
 * @param {string} collectionId - The collection to query
 * @param {string} searchText - The text to query
 * @returns {Promise<number[]>} - Hashes of the results
 */
async function queryCollection(collectionId, searchText) {
    const response = await fetch('/api/vector/query', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ collectionId, searchText }),
    });

    if (!response.ok) {
        throw new Error(`Failed to query collection ${collectionId}`);
    }

    const results = await response.json();
    return results;
}

jQuery(async () => {
    if (!extension_settings.vectors) {
        extension_settings.vectors = settings;
    }

    Object.assign(settings, extension_settings.vectors);
    $('#extensions_settings2').append(renderExtensionTemplate(MODULE_NAME, 'settings'));
    $('#vectors_enabled').prop('checked', settings.enabled).on('input', () => {
        settings.enabled = $('#vectors_enabled').prop('checked');
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });

    eventSource.on(event_types.CHAT_CHANGED, onChatEvent);
    eventSource.on(event_types.MESSAGE_DELETED, onChatEvent);
    eventSource.on(event_types.MESSAGE_EDITED, onChatEvent);
    eventSource.on(event_types.MESSAGE_SENT, onChatEvent);
    eventSource.on(event_types.MESSAGE_RECEIVED, onChatEvent);
    eventSource.on(event_types.MESSAGE_SWIPED, onChatEvent);
});
