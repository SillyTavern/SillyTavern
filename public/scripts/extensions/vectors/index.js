import { eventSource, event_types, extension_prompt_types, getCurrentChatId, getRequestHeaders, saveSettingsDebounced, setExtensionPrompt } from "../../../script.js";
import { ModuleWorkerWrapper, extension_settings, getContext, renderExtensionTemplate } from "../../extensions.js";
import { collapseNewlines } from "../../power-user.js";
import { debounce, getStringHash as calculateHash } from "../../utils.js";

const MODULE_NAME = 'vectors';
const AMOUNT_TO_LEAVE = 5;
const INSERT_AMOUNT = 3;
const QUERY_TEXT_AMOUNT = 2;

export const EXTENSION_PROMPT_TAG = '3_vectors';

const settings = {
    enabled: false,
    source: 'local',
};

const moduleWorker = new ModuleWorkerWrapper(synchronizeChat);

async function onVectorizeAllClick() {
    try {
        if (!settings.enabled) {
            return;
        }

        const chatId = getCurrentChatId();
        const batchSize = 5;
        const elapsedLog = [];
        let finished = false;
        $('#vectorize_progress').show();
        $('#vectorize_progress_percent').text('0');
        $('#vectorize_progress_eta').text('...');

        while (!finished) {
            const startTime = Date.now();
            const remaining = await synchronizeChat(batchSize);
            const elapsed = Date.now() - startTime;
            elapsedLog.push(elapsed);
            finished = remaining <= 0;

            const total = getContext().chat.length;
            const processed = total - remaining;
            const processedPercent = Math.round((processed / total) * 100); // percentage of the work done
            const averageElapsed = elapsedLog.slice(-5).reduce((a, b) => a + b, 0) / elapsedLog.length; // average time needed to process one item
            const pace = averageElapsed / batchSize; // time needed to process one item
            const remainingTime = Math.round(pace * remaining / 1000);

            $('#vectorize_progress_percent').text(processedPercent);
            $('#vectorize_progress_eta').text(remainingTime);

            if (chatId !== getCurrentChatId()) {
                throw new Error('Chat changed');
            }
        }
    } catch (error) {
        console.error('Vectors: Failed to vectorize all', error);
    } finally {
        $('#vectorize_progress').hide();
    }
}

async function synchronizeChat(batchSize = 5) {
    try {
        if (!settings.enabled) {
            return -1;
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
            await insertVectorItems(chatId, newVectorItems.slice(0, batchSize));
            console.log(`Vectors: Inserted ${newVectorItems.length} new items`);
        }

        if (deletedHashes.length > 0) {
            await deleteVectorItems(chatId, deletedHashes);
            console.log(`Vectors: Deleted ${deletedHashes.length} old hashes`);
        }

        return newVectorItems.length - batchSize;
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
 * Removes the most relevant messages from the chat and displays them in the extension prompt
 * @param {object[]} chat Array of chat messages
 */
async function rearrangeChat(chat) {
    try {
        // Clear the extension prompt
        setExtensionPrompt(EXTENSION_PROMPT_TAG, '', extension_prompt_types.IN_PROMPT, 0);

        if (!settings.enabled) {
            return;
        }

        const chatId = getCurrentChatId();

        if (!chatId || !Array.isArray(chat)) {
            console.debug('Vectors: No chat selected');
            return;
        }

        if (chat.length < AMOUNT_TO_LEAVE) {
            console.debug(`Vectors: Not enough messages to rearrange (less than ${AMOUNT_TO_LEAVE})`);
            return;
        }

        const queryText = getQueryText(chat);

        if (queryText.length === 0) {
            console.debug('Vectors: No text to query');
            return;
        }

        // Get the most relevant messages, excluding the last few
        const queryHashes = await queryCollection(chatId, queryText, INSERT_AMOUNT);
        const queriedMessages = [];
        const retainMessages = chat.slice(-AMOUNT_TO_LEAVE);

        for (const message of chat) {
            if (retainMessages.includes(message)) {
                continue;
            }
            if (message.mes && queryHashes.includes(getStringHash(message.mes))) {
                queriedMessages.push(message);
            }
        }

        // Rearrange queried messages to match query order
        // Order is reversed because more relevant are at the lower indices
        queriedMessages.sort((a, b) => queryHashes.indexOf(getStringHash(b.mes)) - queryHashes.indexOf(getStringHash(a.mes)));

        // Remove queried messages from the original chat array
        for (const message of chat) {
            if (queriedMessages.includes(message)) {
                chat.splice(chat.indexOf(message), 1);
            }
        }

        if (queriedMessages.length === 0) {
            console.debug('Vectors: No relevant messages found');
            return;
        }

        // Format queried messages into a single string
        const queriedText = queriedMessages.map(x => collapseNewlines(`${x.name}: ${x.mes}`).trim()).join('\n\n');
        console.log('Vectors: relevant past messages found.\n', queriedText);
        const insertedText = `Past events: ${queriedText}`;
        setExtensionPrompt(EXTENSION_PROMPT_TAG, insertedText, extension_prompt_types.IN_PROMPT, 0);
    } catch (error) {
        console.error('Vectors: Failed to rearrange chat', error);
    }
}

window['vectors_rearrangeChat'] = rearrangeChat;

const onChatEvent = debounce(async () => await moduleWorker.update(), 500);

/**
 * Gets the text to query from the chat
 * @param {object[]} chat Chat messages
 * @returns {string} Text to query
 */
function getQueryText(chat) {
    let queryText = '';
    let i = 0;

    for (const message of chat.slice().reverse()) {
        if (message.mes) {
            queryText += message.mes + '\n';
            i++;
        }

        if (i === QUERY_TEXT_AMOUNT) {
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
        body: JSON.stringify({
            collectionId: collectionId,
            source: settings.source,
        }),
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
        body: JSON.stringify({
            collectionId: collectionId,
            items: items,
            source: settings.source,
        }),
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
        body: JSON.stringify({
            collectionId: collectionId,
            hashes: hashes,
            source: settings.source,
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to delete vector items for collection ${collectionId}`);
    }
}

/**
 * @param {string} collectionId - The collection to query
 * @param {string} searchText - The text to query
 * @param {number} topK - The number of results to return
 * @returns {Promise<number[]>} - Hashes of the results
 */
async function queryCollection(collectionId, searchText, topK) {
    const response = await fetch('/api/vector/query', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            collectionId: collectionId,
            searchText: searchText,
            topK: topK,
            source: settings.source,
        }),
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
    $('#vectors_source').val(settings.source).on('change', () => {
        settings.source = String($('#vectors_source').val());
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });
    $('#vectors_vectorize_all').on('click', onVectorizeAllClick);

    eventSource.on(event_types.CHAT_CHANGED, onChatEvent);
    eventSource.on(event_types.MESSAGE_DELETED, onChatEvent);
    eventSource.on(event_types.MESSAGE_EDITED, onChatEvent);
    eventSource.on(event_types.MESSAGE_SENT, onChatEvent);
    eventSource.on(event_types.MESSAGE_RECEIVED, onChatEvent);
    eventSource.on(event_types.MESSAGE_SWIPED, onChatEvent);
});
