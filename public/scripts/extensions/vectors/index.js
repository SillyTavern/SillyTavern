import { eventSource, event_types, extension_prompt_types, getCurrentChatId, getRequestHeaders, is_send_press, saveSettingsDebounced, setExtensionPrompt, substituteParams } from '../../../script.js';
import { ModuleWorkerWrapper, extension_settings, getContext, modules, renderExtensionTemplate } from '../../extensions.js';
import { collapseNewlines } from '../../power-user.js';
import { SECRET_KEYS, secret_state } from '../../secrets.js';
import { debounce, getStringHash as calculateHash, waitUntilCondition, onlyUnique, splitRecursive } from '../../utils.js';

const MODULE_NAME = 'vectors';

export const EXTENSION_PROMPT_TAG = '3_vectors';

const settings = {
    // For both
    source: 'transformers',
    include_wi: false,
    togetherai_model: 'togethercomputer/m2-bert-80M-32k-retrieval',

    // For chats
    enabled_chats: false,
    template: 'Past events: {{text}}',
    depth: 2,
    position: extension_prompt_types.IN_PROMPT,
    protect: 5,
    insert: 3,
    query: 2,
    message_chunk_size: 400,

    // For files
    enabled_files: false,
    science_mode: false,
    size_threshold: 10,
    chunk_size: 5000,
    chunk_count: 2,
};

const moduleWorker = new ModuleWorkerWrapper(synchronizeChat);

async function onVectorizeAllClick() {
    try {
        if (!settings.enabled_chats) {
            return;
        }

        const chatId = getCurrentChatId();

        if (!chatId) {
            toastr.info('No chat selected. Vectorization aborted.', 'Vector Storage');
            return;
        }

        const batchSize = 5;
        const elapsedLog = [];
        let finished = false;
        $('#vectorize_progress').show();
        $('#vectorize_progress_percent').text('0');
        $('#vectorize_progress_eta').text('...');

        while (!finished) {
            if (is_send_press) {
                toastr.info('Message generation is in progress. Vectorization aborted.', 'Vector Storage');
                throw new Error('Message generation is in progress.');
            }

            const startTime = Date.now();
            const remaining = await synchronizeChat(batchSize);
            const elapsed = Date.now() - startTime;
            elapsedLog.push(elapsed);
            finished = remaining <= 0;

            const total = getContext().chat.length;
            const processed = total - remaining;
            const processedPercent = Math.round((processed / total) * 100); // percentage of the work done
            const lastElapsed = elapsedLog.slice(-5); // last 5 elapsed times
            const averageElapsed = lastElapsed.reduce((a, b) => a + b, 0) / lastElapsed.length; // average time needed to process one item
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
        toastr.error(`Vectorize all failed. ${new String(error)}`, 'Vector Storage')
    } finally {
        $('#vectorize_progress').hide();
    }
}

let syncBlocked = false;

/**
 * Splits messages into chunks before inserting them into the vector index.
 * @param {object[]} items Array of vector items
 * @returns {object[]} Array of vector items (possibly chunked)
 */
function splitByChunks(items) {
    if (settings.message_chunk_size <= 0) {
        return items;
    }

    const chunkedItems = [];

    for (const item of items) {
        const chunks = splitRecursive(item.text, settings.message_chunk_size);
        for (const chunk of chunks) {
            const chunkedItem = { ...item, text: chunk };
            chunkedItems.push(chunkedItem);
        }
    }

    return chunkedItems;
}

async function synchronizeChat(batchSize = 5) {
    if (!settings.enabled_chats) {
        return -1;
    }

    try {
        await waitUntilCondition(() => !syncBlocked && !is_send_press, 1000);
    } catch {
        console.log('Vectors: Synchronization blocked by another process');
        return -1;
    }

    try {
        syncBlocked = true;
        const context = getContext();
        const chatId = getCurrentChatId();

        if (!chatId || !Array.isArray(context.chat)) {
            console.debug('Vectors: No chat selected');
            return -1;
        }

        const hashedMessages = context.chat.filter(x => !x.is_system).map(x => ({ text: String(x.mes), hash: getStringHash(x.mes), index: context.chat.indexOf(x) }));
        const hashesInCollection = await getSavedHashes(chatId);

        const newVectorItems = hashedMessages.filter(x => !hashesInCollection.includes(x.hash));
        const deletedHashes = hashesInCollection.filter(x => !hashedMessages.some(y => y.hash === x));

        if (newVectorItems.length > 0) {
            const chunkedBatch = splitByChunks(newVectorItems.slice(0, batchSize));
            console.log(`Vectors: Found ${newVectorItems.length} new items. Processing ${batchSize}...`);
            await insertVectorItems(chatId, chunkedBatch);
        }

        if (deletedHashes.length > 0) {
            await deleteVectorItems(chatId, deletedHashes);
            console.log(`Vectors: Deleted ${deletedHashes.length} old hashes`);
        }

        return newVectorItems.length - batchSize;
    } catch (error) {
        /**
         * Gets the error message for a given cause
         * @param {string} cause Error cause key
         * @returns {string} Error message
         */
        function getErrorMessage(cause) {
            switch (cause) {
                case 'api_key_missing':
                    return 'API key missing. Save it in the "API Connections" panel.';
                case 'extras_module_missing':
                    return 'Extras API must provide an "embeddings" module.';
                default:
                    return 'Check server console for more details.';
            }
        }

        console.error('Vectors: Failed to synchronize chat', error);

        const message = getErrorMessage(error.cause);
        toastr.error(`Vectorization failed. ${message}`, 'Vector Storage');
        return -1;
    } finally {
        syncBlocked = false;
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
    if (Object.hasOwn(hashCache, str)) {
        return hashCache[str];
    }

    // Calculate the hash value
    const hash = calculateHash(str);

    // Store the hash in the cache
    hashCache[str] = hash;

    return hash;
}

/**
 * Retrieves files from the chat and inserts them into the vector index.
 * @param {object[]} chat Array of chat messages
 * @returns {Promise<void>}
 */
async function processFiles(chat) {
    try {
        if (!settings.enabled_files) {
            return;
        }

        for (const message of chat) {
            // Message has no file
            if (!message?.extra?.file) {
                continue;
            }
            console.debug(`Vectors: processFiles: message ${message.index}: has a file attachment, processing.`)

            // Trim file inserted by the script
            const fileText = String(message.mes)
                .substring(0, message.extra.fileLength).trim()
                .replace(/^```/, '').replace(/```$/, '').trim();

            // Convert kilobytes to string length
            const thresholdLength = settings.size_threshold * 1024;

            // File is too small
            if (fileText.length < thresholdLength) {
                console.debug(`Vectors: processFiles: message ${message.index}: text of file "${message.extra.file.name}" shorter than vectorization threshold (${fileText.length} < ${thresholdLength} chars), keeping inlined.`)
                continue;
            }

            message.mes = message.mes.substring(message.extra.fileLength);

            const fileName = message.extra.file.name;
            const collectionId = `file_${getStringHash(fileName)}`;
            const hashesInCollection = await getSavedHashes(collectionId);

            // File is already in the collection
            if (!hashesInCollection.length) {
                console.debug(`Vectors: processFiles: message ${message.index}: file "${fileName}" not yet in collection, vectorizing.`)
                await vectorizeFile(fileText, fileName, collectionId);
            } else {
                console.debug(`Vectors: processFiles: message ${message.index}: file "${fileName}" found in collection.`)
            }

            console.debug(`Vectors: processFiles: message ${message.index}: querying vector DB.`)
            const queryText = getQueryText(chat);
            const fileChunks = await retrieveFileChunks(queryText, collectionId);
            console.debug(`Vectors: processFiles: message ${message.index}: retrieved ${fileChunks.length} chars.`);

            // Wrap it back in a code block
            message.mes = `\`\`\`\n${fileChunks}\n\`\`\`\n\n${message.mes}`;
        }
    } catch (error) {
        console.error('Vectors: Failed to retrieve files', error);
    }
}

/**
 * Retrieves file chunks from the vector index and inserts them into the chat.
 * @param {string} queryText Text to query
 * @param {string} collectionId File collection ID
 * @returns {Promise<string>} Retrieved file text
 */
async function retrieveFileChunks(queryText, collectionId) {
    console.debug(`Vectors: Retrieving file chunks for collection ${collectionId}`, queryText);
    const queryResults = await queryCollection(collectionId, queryText, settings.chunk_count);
    console.debug(`Vectors: Retrieved ${queryResults.hashes.length} file chunks for collection ${collectionId}`, queryResults);
    const metadata = queryResults.metadata.filter(x => x.text).sort((a, b) => a.index - b.index).map(x => x.text).filter(onlyUnique);
    const fileText = metadata.join('\n');

    return fileText;
}

/**
 * Sanitizes the text content of a scientific paper to obtain higher-quality text for vectorization.
 *
 * This is a really simplistic, classical regex-based algorithm. An LLM could likely do better, but that would be slow.
 * We hope to get a result that's not horribly broken and that won't include irrelevant RAG query poisoning stuff.
 *
 * Currently, we:
 *
 *   - Strip the reference list.
 *
 *     The reference list contains the highest concentration of keywords of any kind (in the titles of the cited studies),
 *     so it usually poisons RAG queries so that no matter what you search for, you'll only get chunks of the reference list.
 *     Omitting the reference list from the text to be vectorized, RAG will look for matches in the paper content only.
 *
 *   - F IX H EADINGS T HAT L OOK L IKE T HIS.
 *
 *     This is a rather common issue in text extraction from a PDF.
 *
 * @param {string} fileText The text to sanitize
 * @returns {string} The sanitized text
 */
function sanitizeScientificInput(fileText) {
    // Fix section headings
    //
    const brokenUppercaseWordsFinder = new RegExp(/(?<!\b[A-Z]\s+)\b([A-Z])\s+([A-Z]+)\b/, 'g');  // "H EADING", but not "C  H EADING" (appendix section)
    fileText = fileText.replaceAll(brokenUppercaseWordsFinder, '$1$2');
    const brokenAppendixHeadingFinder = new RegExp(/([A-Z])\s+([A-Z])\s+([A-Z]+)\b/, 'g');  // "C H EADING"
    fileText = fileText.replaceAll(brokenAppendixHeadingFinder, '$1 $2$3');  // -> "C HEADING"

    const brokenHeadingsFinder = new RegExp(/^\s*([A-Z])\s+([a-z]+)\s*$/, 'mg');  // "H eading", on its own line
    fileText = fileText.replaceAll(brokenHeadingsFinder, '$1$2');

    // Strip reference list (easier now that the headings are already fixed).
    //
    // Linefeeds are sometimes lost, so the references may begin in the middle of a line.
    // Since we can't trigger on any random mention of the word "References", we trigger in the middle of a line
    // only for an all-uppercase "REFERENCES".
    //
    const referencesFinder = new RegExp(/(^\s*References\s*$|^\s*REFERENCES\s*$|\bREFERENCES\s*)/, 'mg');
    const referencesMatches = [...fileText.matchAll(referencesFinder)];
    if (referencesMatches.length > 0) {  // Detected a reference list
        const appendixFinder = new RegExp(/(^\s*Appendi(x|ces)\s*$|^\s*A\s*PPENDI(X|CES)\s*$|\bAPPENDI(X|CES)\s*)/, 'mg');
        // Some documents just start appendices like "A  Some stuff..." without a heading, but there's not much we can do about that.
        // In those cases, we will simply ignore the appendices.
        const appendixMatches = [...fileText.matchAll(appendixFinder)];
        if (appendixMatches.length > 0) {  // Detected both a reference list and appendices
            fileText = fileText.substring(0, referencesMatches[0].index).trim() + fileText.substring(appendixMatches[0].index);
        } else {  // Detected only a reference list, no appendices
            fileText = fileText.substring(0, referencesMatches[0].index).trim();
        }
    }

    console.debug(fileText);
    return fileText;
}

/**
 * Vectorizes a file and inserts it into the vector index.
 * @param {string} fileText File text
 * @param {string} fileName File name
 * @param {string} collectionId File collection ID
 */
async function vectorizeFile(fileText, fileName, collectionId) {
    try {
        toastr.info(`Ingesting file ${fileName}. Vectorization may take some time, please wait...`, 'Vector Storage');

        if (settings.science_mode) {
            console.debug(`Vectors: Science mode is enabled. Sanitizing input ${fileName}.`);
            fileText = sanitizeScientificInput(fileText);
        }

        const chunks = splitRecursive(fileText, settings.chunk_size);
        console.debug(`Vectors: Split file ${fileName} into ${chunks.length} chunks`, chunks);

        const items = chunks.map((chunk, index) => ({ hash: getStringHash(chunk), text: chunk, index: index }));
        await insertVectorItems(collectionId, items);
        toastr.info(`Vectorization complete for ${fileName}.`, `Vector Storage`);

        console.log(`Vectors: Inserted ${chunks.length} vector items for file ${fileName} into ${collectionId}`);
    } catch (error) {
        console.error('Vectors: Failed to vectorize file', error);
        toastr.error(`Vectorization failed for ${fileName}. ${new String(error)}`, 'Vector Storage');
    }
}

/**
 * Removes the most relevant messages from the chat and displays them in the extension prompt
 * @param {object[]} chat Array of chat messages
 */
async function rearrangeChat(chat) {
    try {
        // Clear the extension prompt
        setExtensionPrompt(EXTENSION_PROMPT_TAG, '', extension_prompt_types.IN_PROMPT, 0, settings.include_wi);

        if (settings.enabled_files) {
            await processFiles(chat);
        }

        if (!settings.enabled_chats) {
            return;
        }

        const chatId = getCurrentChatId();

        if (!chatId || !Array.isArray(chat)) {
            console.debug('Vectors: No chat selected');
            return;
        }

        if (chat.length < settings.protect) {
            console.debug(`Vectors: Not enough messages to rearrange (less than ${settings.protect})`);
            return;
        }

        const queryText = getQueryText(chat);

        if (queryText.length === 0) {
            console.debug('Vectors: No text to query');
            return;
        }

        // Get the most relevant messages, excluding the last few
        const queryResults = await queryCollection(chatId, queryText, settings.insert);
        const queryHashes = queryResults.hashes.filter(onlyUnique);
        const queriedMessages = [];
        const insertedHashes = new Set();
        const retainMessages = chat.slice(-settings.protect);

        for (const message of chat) {
            if (retainMessages.includes(message) || !message.mes) {
                continue;
            }
            const hash = getStringHash(message.mes);
            if (queryHashes.includes(hash) && !insertedHashes.has(hash)) {
                queriedMessages.push(message);
                insertedHashes.add(hash);
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
        const insertedText = getPromptText(queriedMessages);
        setExtensionPrompt(EXTENSION_PROMPT_TAG, insertedText, settings.position, settings.depth, settings.include_wi);
    } catch (error) {
        console.error('Vectors: Failed to rearrange chat', error);
    }
}

/**
 * @param {any[]} queriedMessages
 * @returns {string}
 */
function getPromptText(queriedMessages) {
    const queriedText = queriedMessages.map(x => collapseNewlines(`${x.name}: ${x.mes}`).trim()).join('\n\n');
    console.log('Vectors: relevant past messages found.\n', queriedText);
    return substituteParams(settings.template.replace(/{{text}}/i, queriedText));
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

        if (i === settings.query) {
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
 * Add headers for the Extras API source.
 * @param {object} headers Headers object
 */
function addExtrasHeaders(headers) {
    console.log(`Vector source is extras, populating API URL: ${extension_settings.apiUrl}`);
    Object.assign(headers, {
        'X-Extras-Url': extension_settings.apiUrl,
        'X-Extras-Key': extension_settings.apiKey,
    });
}

/**
 * Add headers for the Extras API source.
 * @param {object} headers Headers object
 */
function addTogetherAiHeaders(headers) {
    Object.assign(headers, {
        'X-Togetherai-Model': extension_settings.vectors.togetherai_model,
    });
}

/**
 * Inserts vector items into a collection
 * @param {string} collectionId - The collection to insert into
 * @param {{ hash: number, text: string }[]} items - The items to insert
 * @returns {Promise<void>}
 */
async function insertVectorItems(collectionId, items) {
    if (settings.source === 'openai' && !secret_state[SECRET_KEYS.OPENAI] ||
        settings.source === 'palm' && !secret_state[SECRET_KEYS.MAKERSUITE] ||
        settings.source === 'mistral' && !secret_state[SECRET_KEYS.MISTRALAI] ||
        settings.source === 'togetherai' && !secret_state[SECRET_KEYS.TOGETHERAI]) {
        throw new Error('Vectors: API key missing', { cause: 'api_key_missing' });
    }

    if (settings.source === 'extras' && !modules.includes('embeddings')) {
        throw new Error('Vectors: Embeddings module missing', { cause: 'extras_module_missing' });
    }

    const headers = getRequestHeaders();
    if (settings.source === 'extras') {
        addExtrasHeaders(headers);
    } else if (settings.source === 'togetherai') {
        addTogetherAiHeaders(headers);
    }

    const response = await fetch('/api/vector/insert', {
        method: 'POST',
        headers: headers,
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
 * @returns {Promise<{ hashes: number[], metadata: object[]}>} - Hashes of the results
 */
async function queryCollection(collectionId, searchText, topK) {
    const headers = getRequestHeaders();
    if (settings.source === 'extras') {
        addExtrasHeaders(headers);
    } else if (settings.source === 'togetherai') {
        addTogetherAiHeaders(headers);
    }

    const response = await fetch('/api/vector/query', {
        method: 'POST',
        headers: headers,
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

    return await response.json();
}

/**
 * Purges the vector index for a collection.
 * @param {string} collectionId Collection ID to purge
 * @returns <Promise<boolean>> True if deleted, false if not
 */
async function purgeVectorIndex(collectionId) {
    try {
        if (!settings.enabled_chats) {
            return true;
        }

        const response = await fetch('/api/vector/purge', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                collectionId: collectionId,
            }),
        });

        if (!response.ok) {
            throw new Error(`Could not delete vector index for collection ${collectionId}`);
        }

        console.log(`Vectors: Purged vector index for collection ${collectionId}`);
        return true;
    } catch (error) {
        console.error('Vectors: Failed to purge', error);
        return false;
    }
}

function toggleSettings() {
    $('#vectors_files_settings').toggle(!!settings.enabled_files);
    $('#vectors_chats_settings').toggle(!!settings.enabled_chats);
    $('#together_vectorsModel').toggle(settings.source === 'togetherai');
}

async function onPurgeClick() {
    const chatId = getCurrentChatId();
    if (!chatId) {
        toastr.info('No chat selected. Purge aborted.', 'Vector Storage');
        return;
    }
    if (await purgeVectorIndex(chatId)) {
        toastr.success('Vector index purged successfully.', 'Vector Storage');
    } else {
        toastr.error('Failed to purge vector index', 'Vector Storage');
    }
}

async function onViewStatsClick() {
    const chatId = getCurrentChatId();
    if (!chatId) {
        toastr.info('No chat selected', 'Vector Storage');
        return;
    }

    const hashesInCollection = await getSavedHashes(chatId);
    const totalHashes = hashesInCollection.length;
    const uniqueHashes = hashesInCollection.filter(onlyUnique).length;

    toastr.info(`Total hashes: <b>${totalHashes}</b><br>
    Unique hashes: <b>${uniqueHashes}</b><br><br>
    I'll mark collected messages with a green circle.`,
    `Stats for chat ${chatId}`,
    { timeOut: 10000, escapeHtml: false });

    const chat = getContext().chat;
    for (const message of chat) {
        if (hashesInCollection.includes(getStringHash(message.mes))) {
            const messageElement = $(`.mes[mesid="${chat.indexOf(message)}"]`);
            messageElement.addClass('vectorized');
        }
    }

}

jQuery(async () => {
    if (!extension_settings.vectors) {
        extension_settings.vectors = settings;
    }

    // Migrate from old settings
    if (settings['enabled']) {
        settings.enabled_chats = true;
    }

    Object.assign(settings, extension_settings.vectors);

    // Migrate from TensorFlow to Transformers
    settings.source = settings.source !== 'local' ? settings.source : 'transformers';
    $('#extensions_settings2').append(renderExtensionTemplate(MODULE_NAME, 'settings'));
    $('#vectors_enabled_chats').prop('checked', settings.enabled_chats).on('input', () => {
        settings.enabled_chats = $('#vectors_enabled_chats').prop('checked');
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
        toggleSettings();
    });
    $('#vectors_enabled_files').prop('checked', settings.enabled_files).on('input', () => {
        settings.enabled_files = $('#vectors_enabled_files').prop('checked');
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
        toggleSettings();
    });
    $('#vectors_science_mode').prop('checked', settings.science_mode).on('input', () => {
        settings.science_mode = $('#vectors_science_mode').prop('checked');
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });
    $('#vectors_source').val(settings.source).on('change', () => {
        settings.source = String($('#vectors_source').val());
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
        toggleSettings();
    });

    $('#vectors_togetherai_model').val(settings.togetherai_model).on('change', () => {
        settings.togetherai_model = String($('#vectors_togetherai_model').val());
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });
    $('#vectors_template').val(settings.template).on('input', () => {
        settings.template = String($('#vectors_template').val());
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });
    $('#vectors_depth').val(settings.depth).on('input', () => {
        settings.depth = Number($('#vectors_depth').val());
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });
    $('#vectors_protect').val(settings.protect).on('input', () => {
        settings.protect = Number($('#vectors_protect').val());
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });
    $('#vectors_insert').val(settings.insert).on('input', () => {
        settings.insert = Number($('#vectors_insert').val());
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });
    $('#vectors_query').val(settings.query).on('input', () => {
        settings.query = Number($('#vectors_query').val());
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });
    $(`input[name="vectors_position"][value="${settings.position}"]`).prop('checked', true);
    $('input[name="vectors_position"]').on('change', () => {
        settings.position = Number($('input[name="vectors_position"]:checked').val());
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });
    $('#vectors_vectorize_all').on('click', onVectorizeAllClick);
    $('#vectors_purge').on('click', onPurgeClick);
    $('#vectors_view_stats').on('click', onViewStatsClick);

    $('#vectors_size_threshold').val(settings.size_threshold).on('input', () => {
        settings.size_threshold = Number($('#vectors_size_threshold').val());
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });

    $('#vectors_chunk_size').val(settings.chunk_size).on('input', () => {
        settings.chunk_size = Number($('#vectors_chunk_size').val());
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });

    $('#vectors_chunk_count').val(settings.chunk_count).on('input', () => {
        settings.chunk_count = Number($('#vectors_chunk_count').val());
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });

    $('#vectors_include_wi').prop('checked', settings.include_wi).on('input', () => {
        settings.include_wi = !!$('#vectors_include_wi').prop('checked');
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });

    $('#vectors_message_chunk_size').val(settings.message_chunk_size).on('input', () => {
        settings.message_chunk_size = Number($('#vectors_message_chunk_size').val());
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });

    toggleSettings();
    eventSource.on(event_types.MESSAGE_DELETED, onChatEvent);
    eventSource.on(event_types.MESSAGE_EDITED, onChatEvent);
    eventSource.on(event_types.MESSAGE_SENT, onChatEvent);
    eventSource.on(event_types.MESSAGE_RECEIVED, onChatEvent);
    eventSource.on(event_types.MESSAGE_SWIPED, onChatEvent);
    eventSource.on(event_types.CHAT_DELETED, purgeVectorIndex);
    eventSource.on(event_types.GROUP_CHAT_DELETED, purgeVectorIndex);
});
