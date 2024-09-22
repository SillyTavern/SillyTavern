import {
    eventSource,
    event_types,
    extension_prompt_types,
    extension_prompt_roles,
    getCurrentChatId,
    getRequestHeaders,
    is_send_press,
    saveSettingsDebounced,
    setExtensionPrompt,
    substituteParams,
    generateRaw,
    substituteParamsExtended,
} from '../../../script.js';
import {
    ModuleWorkerWrapper,
    extension_settings,
    getContext,
    modules,
    renderExtensionTemplateAsync,
    doExtrasFetch, getApiUrl,
} from '../../extensions.js';
import { collapseNewlines, registerDebugFunction } from '../../power-user.js';
import { SECRET_KEYS, secret_state, writeSecret } from '../../secrets.js';
import { getDataBankAttachments, getDataBankAttachmentsForSource, getFileAttachment } from '../../chats.js';
import { debounce, getStringHash as calculateHash, waitUntilCondition, onlyUnique, splitRecursive, trimToStartSentence, trimToEndSentence } from '../../utils.js';
import { debounce_timeout } from '../../constants.js';
import { getSortedEntries } from '../../world-info.js';
import { textgen_types, textgenerationwebui_settings } from '../../textgen-settings.js';
import { SlashCommandParser } from '../../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from '../../slash-commands/SlashCommandArgument.js';
import { callGenericPopup, POPUP_RESULT, POPUP_TYPE } from '../../popup.js';
import { generateWebLlmChatPrompt, isWebLlmSupported } from '../shared.js';

/**
 * @typedef {object} HashedMessage
 * @property {string} text - The hashed message text
 */

const MODULE_NAME = 'vectors';

export const EXTENSION_PROMPT_TAG = '3_vectors';
export const EXTENSION_PROMPT_TAG_DB = '4_vectors_data_bank';

const settings = {
    // For both
    source: 'transformers',
    include_wi: false,
    togetherai_model: 'togethercomputer/m2-bert-80M-32k-retrieval',
    openai_model: 'text-embedding-ada-002',
    cohere_model: 'embed-english-v3.0',
    ollama_model: 'mxbai-embed-large',
    ollama_keep: false,
    vllm_model: '',
    summarize: false,
    summarize_sent: false,
    summary_source: 'main',
    summary_prompt: 'Ignore previous instructions. Summarize the most important parts of the message. Limit yourself to 250 words or less. Your response should include nothing but the summary.',
    force_chunk_delimiter: '',

    // For chats
    enabled_chats: false,
    template: 'Past events:\n{{text}}',
    depth: 2,
    position: extension_prompt_types.IN_PROMPT,
    protect: 5,
    insert: 3,
    query: 2,
    message_chunk_size: 400,
    score_threshold: 0.25,

    // For files
    enabled_files: false,
    translate_files: false,
    size_threshold: 10,
    chunk_size: 5000,
    chunk_count: 2,
    overlap_percent: 0,

    // For Data Bank
    size_threshold_db: 5,
    chunk_size_db: 2500,
    chunk_count_db: 5,
    overlap_percent_db: 0,
    file_template_db: 'Related information:\n{{text}}',
    file_position_db: extension_prompt_types.IN_PROMPT,
    file_depth_db: 4,
    file_depth_role_db: extension_prompt_roles.SYSTEM,

    // For World Info
    enabled_world_info: false,
    enabled_for_all: false,
    max_entries: 5,
};

const moduleWorker = new ModuleWorkerWrapper(synchronizeChat);

/**
 * Gets the Collection ID for a file embedded in the chat.
 * @param {string} fileUrl URL of the file
 * @returns {string} Collection ID
 */
function getFileCollectionId(fileUrl) {
    return `file_${getStringHash(fileUrl)}`;
}

async function onVectorizeAllClick() {
    try {
        if (!settings.enabled_chats) {
            return;
        }

        const chatId = getCurrentChatId();

        if (!chatId) {
            toastr.info('No chat selected', 'Vectorization aborted');
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
                toastr.info('Message generation is in progress.', 'Vectorization aborted');
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
    } finally {
        $('#vectorize_progress').hide();
    }
}

let syncBlocked = false;

/**
 * Gets the chunk delimiters for splitting text.
 * @returns {string[]} Array of chunk delimiters
 */
function getChunkDelimiters() {
    const delimiters = ['\n\n', '\n', ' ', ''];

    if (settings.force_chunk_delimiter) {
        delimiters.unshift(settings.force_chunk_delimiter);
    }

    return delimiters;
}

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
        const chunks = splitRecursive(item.text, settings.message_chunk_size, getChunkDelimiters());
        for (const chunk of chunks) {
            const chunkedItem = { ...item, text: chunk };
            chunkedItems.push(chunkedItem);
        }
    }

    return chunkedItems;
}

/**
 * Summarizes messages using the Extras API method.
 * @param {HashedMessage[]} hashedMessages Array of hashed messages
 * @returns {Promise<HashedMessage[]>} Summarized messages
 */
async function summarizeExtra(hashedMessages) {
    for (const element of hashedMessages) {
        try {
            const url = new URL(getApiUrl());
            url.pathname = '/api/summarize';

            const apiResult = await doExtrasFetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Bypass-Tunnel-Reminder': 'bypass',
                },
                body: JSON.stringify({
                    text: element.text,
                    params: {},
                }),
            });

            if (apiResult.ok) {
                const data = await apiResult.json();
                element.text = data.summary;
            }
        }
        catch (error) {
            console.log(error);
        }
    }

    return hashedMessages;
}

/**
 * Summarizes messages using the main API method.
 * @param {HashedMessage[]} hashedMessages Array of hashed messages
 * @returns {Promise<HashedMessage[]>} Summarized messages
 */
async function summarizeMain(hashedMessages) {
    for (const element of hashedMessages) {
        element.text = await generateRaw(element.text, '', false, false, settings.summary_prompt);
    }

    return hashedMessages;
}

/**
 * Summarizes messages using WebLLM.
 * @param {HashedMessage[]} hashedMessages Array of hashed messages
 * @returns {Promise<HashedMessage[]>} Summarized messages
 */
async function summarizeWebLLM(hashedMessages) {
    if (!isWebLlmSupported()) {
        console.warn('Vectors: WebLLM is not supported');
        return hashedMessages;
    }

    for (const element of hashedMessages) {
        const messages = [{ role:'system', content: settings.summary_prompt }, { role:'user', content: element.text }];
        element.text = await generateWebLlmChatPrompt(messages);
    }

    return hashedMessages;
}

/**
 * Summarizes messages using the chosen method.
 * @param {HashedMessage[]} hashedMessages Array of hashed messages
 * @param {string} endpoint Type of endpoint to use
 * @returns {Promise<HashedMessage[]>} Summarized messages
 */
async function summarize(hashedMessages, endpoint = 'main') {
    switch (endpoint) {
        case 'main':
            return await summarizeMain(hashedMessages);
        case 'extras':
            return await summarizeExtra(hashedMessages);
        case 'webllm':
            return await summarizeWebLLM(hashedMessages);
        default:
            console.error('Unsupported endpoint', endpoint);
    }
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

        let hashedMessages = context.chat.filter(x => !x.is_system).map(x => ({ text: String(substituteParams(x.mes)), hash: getStringHash(substituteParams(x.mes)), index: context.chat.indexOf(x) }));
        const hashesInCollection = await getSavedHashes(chatId);

        if (settings.summarize) {
            hashedMessages = await summarize(hashedMessages, settings.summary_source);
        }

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
                case 'api_url_missing':
                    return 'API URL missing. Save it in the "API Connections" panel.';
                case 'api_model_missing':
                    return 'Vectorization Source Model is required, but not set.';
                case 'extras_module_missing':
                    return 'Extras API must provide an "embeddings" module.';
                default:
                    return 'Check server console for more details';
            }
        }

        console.error('Vectors: Failed to synchronize chat', error);

        const message = getErrorMessage(error.cause);
        toastr.error(message, 'Vectorization failed', { preventDuplicates: true });
        return -1;
    } finally {
        syncBlocked = false;
    }
}

/**
 * @type {Map<string, number>} Cache object for storing hash values
 */
const hashCache = new Map();

/**
 * Gets the hash value for a given string
 * @param {string} str Input string
 * @returns {number} Hash value
 */
function getStringHash(str) {
    // Check if the hash is already in the cache
    if (hashCache.has(str)) {
        return hashCache.get(str);
    }

    // Calculate the hash value
    const hash = calculateHash(str);

    // Store the hash in the cache
    hashCache.set(str, hash);

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

        const dataBankCollectionIds = await ingestDataBankAttachments();

        if (dataBankCollectionIds.length) {
            const queryText = await getQueryText(chat, 'file');
            await injectDataBankChunks(queryText, dataBankCollectionIds);
        }

        for (const message of chat) {
            // Message has no file
            if (!message?.extra?.file) {
                continue;
            }

            // Trim file inserted by the script
            const fileText = String(message.mes)
                .substring(0, message.extra.fileLength).trim();

            // Convert kilobytes to string length
            const thresholdLength = settings.size_threshold * 1024;

            // File is too small
            if (fileText.length < thresholdLength) {
                continue;
            }

            message.mes = message.mes.substring(message.extra.fileLength);

            const fileName = message.extra.file.name;
            const fileUrl = message.extra.file.url;
            const collectionId = getFileCollectionId(fileUrl);
            const hashesInCollection = await getSavedHashes(collectionId);

            // File is already in the collection
            if (!hashesInCollection.length) {
                await vectorizeFile(fileText, fileName, collectionId, settings.chunk_size, settings.overlap_percent);
            }

            const queryText = await getQueryText(chat, 'file');
            const fileChunks = await retrieveFileChunks(queryText, collectionId);

            message.mes = `${fileChunks}\n\n${message.mes}`;
        }
    } catch (error) {
        console.error('Vectors: Failed to retrieve files', error);
    }
}

/**
 * Ensures that data bank attachments are ingested and inserted into the vector index.
 * @param {string} [source] Optional source filter for data bank attachments.
 * @returns {Promise<string[]>} Collection IDs
 */
async function ingestDataBankAttachments(source) {
    // Exclude disabled files
    const dataBank = source ? getDataBankAttachmentsForSource(source, false) : getDataBankAttachments(false);
    const dataBankCollectionIds = [];

    for (const file of dataBank) {
        const collectionId = getFileCollectionId(file.url);
        const hashesInCollection = await getSavedHashes(collectionId);
        dataBankCollectionIds.push(collectionId);

        // File is already in the collection
        if (hashesInCollection.length) {
            continue;
        }

        // Download and process the file
        file.text = await getFileAttachment(file.url);
        console.log(`Vectors: Retrieved file ${file.name} from Data Bank`);
        // Convert kilobytes to string length
        const thresholdLength = settings.size_threshold_db * 1024;
        // Use chunk size from settings if file is larger than threshold
        const chunkSize = file.size > thresholdLength ? settings.chunk_size_db : -1;
        await vectorizeFile(file.text, file.name, collectionId, chunkSize, settings.overlap_percent_db);
    }

    return dataBankCollectionIds;
}

/**
 * Inserts file chunks from the Data Bank into the prompt.
 * @param {string} queryText Text to query
 * @param {string[]} collectionIds File collection IDs
 * @returns {Promise<void>}
 */
async function injectDataBankChunks(queryText, collectionIds) {
    try {
        const queryResults = await queryMultipleCollections(collectionIds, queryText, settings.chunk_count_db, settings.score_threshold);
        console.debug(`Vectors: Retrieved ${collectionIds.length} Data Bank collections`, queryResults);
        let textResult = '';

        for (const collectionId in queryResults) {
            console.debug(`Vectors: Processing Data Bank collection ${collectionId}`, queryResults[collectionId]);
            const metadata = queryResults[collectionId].metadata?.filter(x => x.text)?.sort((a, b) => a.index - b.index)?.map(x => x.text)?.filter(onlyUnique) || [];
            textResult += metadata.join('\n') + '\n\n';
        }

        if (!textResult) {
            console.debug('Vectors: No Data Bank chunks found');
            return;
        }

        const insertedText = substituteParamsExtended(settings.file_template_db, { text: textResult });
        setExtensionPrompt(EXTENSION_PROMPT_TAG_DB, insertedText, settings.file_position_db, settings.file_depth_db, settings.include_wi, settings.file_depth_role_db);
    } catch (error) {
        console.error('Vectors: Failed to insert Data Bank chunks', error);
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
 * Vectorizes a file and inserts it into the vector index.
 * @param {string} fileText File text
 * @param {string} fileName File name
 * @param {string} collectionId File collection ID
 * @param {number} chunkSize Chunk size
 * @param {number} overlapPercent Overlap size (in %)
 * @returns {Promise<boolean>} True if successful, false if not
 */
async function vectorizeFile(fileText, fileName, collectionId, chunkSize, overlapPercent) {
    try {
        if (settings.translate_files && typeof window['translate'] === 'function') {
            console.log(`Vectors: Translating file ${fileName} to English...`);
            const translatedText = await window['translate'](fileText, 'en');
            fileText = translatedText;
        }

        const toast = toastr.info('Vectorization may take some time, please wait...', `Ingesting file ${fileName}`);
        const overlapSize = Math.round(chunkSize * overlapPercent / 100);
        const delimiters = getChunkDelimiters();
        // Overlap should not be included in chunk size. It will be later compensated by overlapChunks
        chunkSize = overlapSize > 0 ? (chunkSize - overlapSize) : chunkSize;
        const chunks = splitRecursive(fileText, chunkSize, delimiters).map((x, y, z) => overlapSize > 0 ? overlapChunks(x, y, z, overlapSize) : x);
        console.debug(`Vectors: Split file ${fileName} into ${chunks.length} chunks with ${overlapPercent}% overlap`, chunks);

        const items = chunks.map((chunk, index) => ({ hash: getStringHash(chunk), text: chunk, index: index }));
        await insertVectorItems(collectionId, items);

        toastr.clear(toast);
        console.log(`Vectors: Inserted ${chunks.length} vector items for file ${fileName} into ${collectionId}`);
        return true;
    } catch (error) {
        toastr.error(String(error), 'Failed to vectorize file', { preventDuplicates: true });
        console.error('Vectors: Failed to vectorize file', error);
        return false;
    }
}

/**
 * Removes the most relevant messages from the chat and displays them in the extension prompt
 * @param {object[]} chat Array of chat messages
 */
async function rearrangeChat(chat) {
    try {
        // Clear the extension prompt
        setExtensionPrompt(EXTENSION_PROMPT_TAG, '', settings.position, settings.depth, settings.include_wi);
        setExtensionPrompt(EXTENSION_PROMPT_TAG_DB, '', settings.file_position_db, settings.file_depth_db, settings.include_wi, settings.file_depth_role_db);

        if (settings.enabled_files) {
            await processFiles(chat);
        }

        if (settings.enabled_world_info) {
            await activateWorldInfo(chat);
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

        const queryText = await getQueryText(chat, 'chat');

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
            const hash = getStringHash(substituteParams(message.mes));
            if (queryHashes.includes(hash) && !insertedHashes.has(hash)) {
                queriedMessages.push(message);
                insertedHashes.add(hash);
            }
        }

        // Rearrange queried messages to match query order
        // Order is reversed because more relevant are at the lower indices
        queriedMessages.sort((a, b) => queryHashes.indexOf(getStringHash(substituteParams(b.mes))) - queryHashes.indexOf(getStringHash(substituteParams(a.mes))));

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
        toastr.error('Generation interceptor aborted. Check browser console for more details.', 'Vector Storage');
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
    return substituteParamsExtended(settings.template, { text: queriedText });
}

/**
 * Modifies text chunks to include overlap with adjacent chunks.
 * @param {string} chunk Current item
 * @param {number} index Current index
 * @param {string[]} chunks List of chunks
 * @param {number} overlapSize Size of the overlap
 * @returns {string} Overlapped chunks, with overlap trimmed to sentence boundaries
 */
function overlapChunks(chunk, index, chunks, overlapSize) {
    const halfOverlap = Math.floor(overlapSize / 2);
    const nextChunk = chunks[index + 1];
    const prevChunk = chunks[index - 1];

    const nextOverlap = trimToEndSentence(nextChunk?.substring(0, halfOverlap)) || '';
    const prevOverlap = trimToStartSentence(prevChunk?.substring(prevChunk.length - halfOverlap)) || '';
    const overlappedChunk = [prevOverlap, chunk, nextOverlap].filter(x => x).join(' ');

    return overlappedChunk;
}

window['vectors_rearrangeChat'] = rearrangeChat;

const onChatEvent = debounce(async () => await moduleWorker.update(), debounce_timeout.relaxed);

/**
 * Gets the text to query from the chat
 * @param {object[]} chat Chat messages
 * @param {'file'|'chat'|'world-info'} initiator Initiator of the query
 * @returns {Promise<string>} Text to query
 */
async function getQueryText(chat, initiator) {
    let queryText = '';
    let i = 0;

    let hashedMessages = chat.map(x => ({ text: String(substituteParams(x.mes)) }));

    if (initiator === 'chat' && settings.enabled_chats && settings.summarize && settings.summarize_sent) {
        hashedMessages = await summarize(hashedMessages, settings.summary_source);
    }

    for (const message of hashedMessages.slice().reverse()) {
        if (message.text) {
            queryText += message.text + '\n';
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
        headers: getVectorHeaders(),
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

function getVectorHeaders() {
    const headers = getRequestHeaders();
    switch (settings.source) {
        case 'extras':
            Object.assign(headers, {
                'X-Extras-Url': extension_settings.apiUrl,
                'X-Extras-Key': extension_settings.apiKey,
            });
            break;
        case 'togetherai':
            Object.assign(headers, {
                'X-Togetherai-Model': extension_settings.vectors.togetherai_model,
            });
            break;
        case 'openai':
            Object.assign(headers, {
                'X-OpenAI-Model': extension_settings.vectors.openai_model,
            });
            break;
        case 'cohere':
            Object.assign(headers, {
                'X-Cohere-Model': extension_settings.vectors.cohere_model,
            });
            break;
        case 'ollama':
            Object.assign(headers, {
                'X-Ollama-Model': extension_settings.vectors.ollama_model,
                'X-Ollama-URL': textgenerationwebui_settings.server_urls[textgen_types.OLLAMA],
                'X-Ollama-Keep': !!extension_settings.vectors.ollama_keep,
            });
            break;
        case 'llamacpp':
            Object.assign(headers, {
                'X-LlamaCpp-URL': textgenerationwebui_settings.server_urls[textgen_types.LLAMACPP],
            });
            break;
        case 'vllm':
            Object.assign(headers, {
                'X-Vllm-URL': textgenerationwebui_settings.server_urls[textgen_types.VLLM],
                'X-Vllm-Model': extension_settings.vectors.vllm_model,
            });
            break;
        default:
            break;
    }
    return headers;
}

/**
 * Inserts vector items into a collection
 * @param {string} collectionId - The collection to insert into
 * @param {{ hash: number, text: string }[]} items - The items to insert
 * @returns {Promise<void>}
 */
async function insertVectorItems(collectionId, items) {
    throwIfSourceInvalid();

    const headers = getVectorHeaders();

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
 * Throws an error if the source is invalid (missing API key or URL, or missing module)
 */
function throwIfSourceInvalid() {
    if (settings.source === 'openai' && !secret_state[SECRET_KEYS.OPENAI] ||
        settings.source === 'palm' && !secret_state[SECRET_KEYS.MAKERSUITE] ||
        settings.source === 'mistral' && !secret_state[SECRET_KEYS.MISTRALAI] ||
        settings.source === 'togetherai' && !secret_state[SECRET_KEYS.TOGETHERAI] ||
        settings.source === 'nomicai' && !secret_state[SECRET_KEYS.NOMICAI] ||
        settings.source === 'cohere' && !secret_state[SECRET_KEYS.COHERE]) {
        throw new Error('Vectors: API key missing', { cause: 'api_key_missing' });
    }

    if (settings.source === 'ollama' && !textgenerationwebui_settings.server_urls[textgen_types.OLLAMA] ||
        settings.source === 'vllm' && !textgenerationwebui_settings.server_urls[textgen_types.VLLM] ||
        settings.source === 'llamacpp' && !textgenerationwebui_settings.server_urls[textgen_types.LLAMACPP]) {
        throw new Error('Vectors: API URL missing', { cause: 'api_url_missing' });
    }

    if (settings.source === 'ollama' && !settings.ollama_model || settings.source === 'vllm' && !settings.vllm_model) {
        throw new Error('Vectors: API model missing', { cause: 'api_model_missing' });
    }

    if (settings.source === 'extras' && !modules.includes('embeddings')) {
        throw new Error('Vectors: Embeddings module missing', { cause: 'extras_module_missing' });
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
        headers: getVectorHeaders(),
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
    const headers = getVectorHeaders();

    const response = await fetch('/api/vector/query', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            collectionId: collectionId,
            searchText: searchText,
            topK: topK,
            source: settings.source,
            threshold: settings.score_threshold,
        }),
    });

    if (!response.ok) {
        throw new Error(`Failed to query collection ${collectionId}`);
    }

    return await response.json();
}

/**
 * Queries multiple collections for a given text.
 * @param {string[]} collectionIds - Collection IDs to query
 * @param {string} searchText - Text to query
 * @param {number} topK - Number of results to return
 * @param {number} threshold - Score threshold
 * @returns {Promise<Record<string, { hashes: number[], metadata: object[] }>>} - Results mapped to collection IDs
 */
async function queryMultipleCollections(collectionIds, searchText, topK, threshold) {
    const headers = getVectorHeaders();

    const response = await fetch('/api/vector/query-multi', {
        method: 'POST',
        headers: headers,
        body: JSON.stringify({
            collectionIds: collectionIds,
            searchText: searchText,
            topK: topK,
            source: settings.source,
            threshold: threshold ?? settings.score_threshold,
        }),
    });

    if (!response.ok) {
        throw new Error('Failed to query multiple collections');
    }

    return await response.json();
}

/**
 * Purges the vector index for a file.
 * @param {string} fileUrl File URL to purge
 */
async function purgeFileVectorIndex(fileUrl) {
    try {
        if (!settings.enabled_files) {
            return;
        }

        console.log(`Vectors: Purging file vector index for ${fileUrl}`);
        const collectionId = getFileCollectionId(fileUrl);

        const response = await fetch('/api/vector/purge', {
            method: 'POST',
            headers: getVectorHeaders(),
            body: JSON.stringify({
                collectionId: collectionId,
            }),
        });

        if (!response.ok) {
            throw new Error(`Could not delete vector index for collection ${collectionId}`);
        }

        console.log(`Vectors: Purged vector index for collection ${collectionId}`);
    } catch (error) {
        console.error('Vectors: Failed to purge file', error);
    }
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
            headers: getVectorHeaders(),
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

/**
 * Purges all vector indexes.
 */
async function purgeAllVectorIndexes() {
    try {
        const response = await fetch('/api/vector/purge-all', {
            method: 'POST',
            headers: getVectorHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to purge all vector indexes');
        }

        console.log('Vectors: Purged all vector indexes');
        toastr.success('All vector indexes purged', 'Purge successful');
    } catch (error) {
        console.error('Vectors: Failed to purge all', error);
        toastr.error('Failed to purge all vector indexes', 'Purge failed');
    }
}

async function isModelScopesEnabled() {
    try {
        const response = await fetch('/api/vector/scopes-enabled', {
            method: 'GET',
            headers: getVectorHeaders(),
        });

        if (!response.ok) {
            return false;
        }

        const data = await response.json();
        return data?.enabled ?? false;
    } catch (error) {
        console.error('Vectors: Failed to check model scopes', error);
        return false;
    }
}

function toggleSettings() {
    $('#vectors_files_settings').toggle(!!settings.enabled_files);
    $('#vectors_chats_settings').toggle(!!settings.enabled_chats);
    $('#vectors_world_info_settings').toggle(!!settings.enabled_world_info);
    $('#together_vectorsModel').toggle(settings.source === 'togetherai');
    $('#openai_vectorsModel').toggle(settings.source === 'openai');
    $('#cohere_vectorsModel').toggle(settings.source === 'cohere');
    $('#ollama_vectorsModel').toggle(settings.source === 'ollama');
    $('#llamacpp_vectorsModel').toggle(settings.source === 'llamacpp');
    $('#vllm_vectorsModel').toggle(settings.source === 'vllm');
    $('#nomicai_apiKey').toggle(settings.source === 'nomicai');
}

async function onPurgeClick() {
    const chatId = getCurrentChatId();
    if (!chatId) {
        toastr.info('No chat selected', 'Purge aborted');
        return;
    }
    if (await purgeVectorIndex(chatId)) {
        toastr.success('Vector index purged', 'Purge successful');
    } else {
        toastr.error('Failed to purge vector index', 'Purge failed');
    }
}

async function onViewStatsClick() {
    const chatId = getCurrentChatId();
    if (!chatId) {
        toastr.info('No chat selected');
        return;
    }

    const hashesInCollection = await getSavedHashes(chatId);
    const totalHashes = hashesInCollection.length;
    const uniqueHashes = hashesInCollection.filter(onlyUnique).length;

    toastr.info(`Total hashes: <b>${totalHashes}</b><br>
    Unique hashes: <b>${uniqueHashes}</b><br><br>
    I'll mark collected messages with a green circle.`,
    `Stats for chat ${chatId}`,
    { timeOut: 10000, escapeHtml: false },
    );

    const chat = getContext().chat;
    for (const message of chat) {
        if (hashesInCollection.includes(getStringHash(substituteParams(message.mes)))) {
            const messageElement = $(`.mes[mesid="${chat.indexOf(message)}"]`);
            messageElement.addClass('vectorized');
        }
    }

}

async function onVectorizeAllFilesClick() {
    try {
        const dataBank = getDataBankAttachments();
        const chatAttachments = getContext().chat.filter(x => x.extra?.file).map(x => x.extra.file);
        const allFiles = [...dataBank, ...chatAttachments];

        /**
         * Gets the chunk size for a file attachment.
         * @param file {import('../../chats.js').FileAttachment} File attachment
         * @returns {number} Chunk size for the file
         */
        function getChunkSize(file) {
            if (chatAttachments.includes(file)) {
                // Convert kilobytes to string length
                const thresholdLength = settings.size_threshold * 1024;
                return file.size > thresholdLength ? settings.chunk_size : -1;
            }

            if (dataBank.includes(file)) {
                // Convert kilobytes to string length
                const thresholdLength = settings.size_threshold_db * 1024;
                // Use chunk size from settings if file is larger than threshold
                return file.size > thresholdLength ? settings.chunk_size_db : -1;
            }

            return -1;
        }

        /**
         * Gets the overlap percent for a file attachment.
         * @param file {import('../../chats.js').FileAttachment} File attachment
         * @returns {number} Overlap percent for the file
         */
        function getOverlapPercent(file) {
            if (chatAttachments.includes(file)) {
                return settings.overlap_percent;
            }

            if (dataBank.includes(file)) {
                return settings.overlap_percent_db;
            }

            return 0;
        }

        let allSuccess = true;

        for (const file of allFiles) {
            const text = await getFileAttachment(file.url);
            const collectionId = getFileCollectionId(file.url);
            const hashes = await getSavedHashes(collectionId);

            if (hashes.length) {
                console.log(`Vectors: File ${file.name} is already vectorized`);
                continue;
            }

            const chunkSize = getChunkSize(file);
            const overlapPercent = getOverlapPercent(file);
            const result = await vectorizeFile(text, file.name, collectionId, chunkSize, overlapPercent);

            if (!result) {
                allSuccess = false;
            }
        }

        if (allSuccess) {
            toastr.success('All files vectorized', 'Vectorization successful');
        } else {
            toastr.warning('Some files failed to vectorize. Check browser console for more details.', 'Vector Storage');
        }
    } catch (error) {
        console.error('Vectors: Failed to vectorize all files', error);
        toastr.error('Failed to vectorize all files', 'Vectorization failed');
    }
}

async function onPurgeFilesClick() {
    try {
        const dataBank = getDataBankAttachments();
        const chatAttachments = getContext().chat.filter(x => x.extra?.file).map(x => x.extra.file);
        const allFiles = [...dataBank, ...chatAttachments];

        for (const file of allFiles) {
            await purgeFileVectorIndex(file.url);
        }

        toastr.success('All files purged', 'Purge successful');
    } catch (error) {
        console.error('Vectors: Failed to purge all files', error);
        toastr.error('Failed to purge all files', 'Purge failed');
    }
}

async function activateWorldInfo(chat) {
    if (!settings.enabled_world_info) {
        console.debug('Vectors: Disabled for World Info');
        return;
    }

    const entries = await getSortedEntries();

    if (!Array.isArray(entries) || entries.length === 0) {
        console.debug('Vectors: No WI entries found');
        return;
    }

    // Group entries by "world" field
    const groupedEntries = {};

    for (const entry of entries) {
        // Skip orphaned entries. Is it even possible?
        if (!entry.world) {
            console.debug('Vectors: Skipped orphaned WI entry', entry);
            continue;
        }

        // Skip disabled entries
        if (entry.disable) {
            console.debug('Vectors: Skipped disabled WI entry', entry);
            continue;
        }

        // Skip entries without content
        if (!entry.content) {
            console.debug('Vectors: Skipped WI entry without content', entry);
            continue;
        }

        // Skip non-vectorized entries
        if (!entry.vectorized && !settings.enabled_for_all) {
            console.debug('Vectors: Skipped non-vectorized WI entry', entry);
            continue;
        }

        if (!Object.hasOwn(groupedEntries, entry.world)) {
            groupedEntries[entry.world] = [];
        }

        groupedEntries[entry.world].push(entry);
    }

    const collectionIds = [];

    if (Object.keys(groupedEntries).length === 0) {
        console.debug('Vectors: No WI entries to synchronize');
        return;
    }

    // Synchronize collections
    for (const world in groupedEntries) {
        const collectionId = `world_${getStringHash(world)}`;
        const hashesInCollection = await getSavedHashes(collectionId);
        const newEntries = groupedEntries[world].filter(x => !hashesInCollection.includes(getStringHash(x.content)));
        const deletedHashes = hashesInCollection.filter(x => !groupedEntries[world].some(y => getStringHash(y.content) === x));

        if (newEntries.length > 0) {
            console.log(`Vectors: Found ${newEntries.length} new WI entries for world ${world}`);
            await insertVectorItems(collectionId, newEntries.map(x => ({ hash: getStringHash(x.content), text: x.content, index: x.uid })));
        }

        if (deletedHashes.length > 0) {
            console.log(`Vectors: Deleted ${deletedHashes.length} old hashes for world ${world}`);
            await deleteVectorItems(collectionId, deletedHashes);
        }

        collectionIds.push(collectionId);
    }

    // Perform a multi-query
    const queryText = await getQueryText(chat, 'world-info');

    if (queryText.length === 0) {
        console.debug('Vectors: No text to query for WI');
        return;
    }

    const queryResults = await queryMultipleCollections(collectionIds, queryText, settings.max_entries, settings.score_threshold);
    const activatedHashes = Object.values(queryResults).flatMap(x => x.hashes).filter(onlyUnique);
    const activatedEntries = [];

    // Activate entries found in the query results
    for (const entry of entries) {
        const hash = getStringHash(entry.content);

        if (activatedHashes.includes(hash)) {
            activatedEntries.push(entry);
        }
    }

    if (activatedEntries.length === 0) {
        console.debug('Vectors: No activated WI entries found');
        return;
    }

    console.log(`Vectors: Activated ${activatedEntries.length} WI entries`, activatedEntries);
    await eventSource.emit(event_types.WORLDINFO_FORCE_ACTIVATE, activatedEntries);
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
    const scopesEnabled = await isModelScopesEnabled();

    // Migrate from TensorFlow to Transformers
    settings.source = settings.source !== 'local' ? settings.source : 'transformers';
    const template = await renderExtensionTemplateAsync(MODULE_NAME, 'settings');
    $('#vectors_container').append(template);
    $('#vectors_enabled_chats').prop('checked', settings.enabled_chats).on('input', () => {
        settings.enabled_chats = $('#vectors_enabled_chats').prop('checked');
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
        toggleSettings();
    });
    $('#vectors_modelWarning').hide();
    $('#vectors_enabled_files').prop('checked', settings.enabled_files).on('input', () => {
        settings.enabled_files = $('#vectors_enabled_files').prop('checked');
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
        toggleSettings();
    });
    $('#vectors_source').val(settings.source).on('change', () => {
        settings.source = String($('#vectors_source').val());
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
        toggleSettings();
    });
    $('#api_key_nomicai').on('click', async () => {
        const popupText = 'NomicAI API Key:';
        const key = await callGenericPopup(popupText, POPUP_TYPE.INPUT, '', {
            customButtons: [{
                text: 'Remove Key',
                appendAtEnd: true,
                result: POPUP_RESULT.NEGATIVE,
                action: async () => {
                    await writeSecret(SECRET_KEYS.NOMICAI, '');
                    toastr.success('API Key removed');
                    $('#api_key_nomicai').toggleClass('success', !!secret_state[SECRET_KEYS.NOMICAI]);
                    saveSettingsDebounced();
                },
            }],
        });

        if (!key) {
            return;
        }

        await writeSecret(SECRET_KEYS.NOMICAI, String(key));
        $('#api_key_nomicai').toggleClass('success', !!secret_state[SECRET_KEYS.NOMICAI]);

        toastr.success('API Key saved');
        saveSettingsDebounced();
    });
    $('#vectors_togetherai_model').val(settings.togetherai_model).on('change', () => {
        !scopesEnabled && $('#vectors_modelWarning').show();
        settings.togetherai_model = String($('#vectors_togetherai_model').val());
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });
    $('#vectors_openai_model').val(settings.openai_model).on('change', () => {
        !scopesEnabled && $('#vectors_modelWarning').show();
        settings.openai_model = String($('#vectors_openai_model').val());
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });
    $('#vectors_cohere_model').val(settings.cohere_model).on('change', () => {
        !scopesEnabled && $('#vectors_modelWarning').show();
        settings.cohere_model = String($('#vectors_cohere_model').val());
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });
    $('#vectors_ollama_model').val(settings.ollama_model).on('input', () => {
        !scopesEnabled && $('#vectors_modelWarning').show();
        settings.ollama_model = String($('#vectors_ollama_model').val());
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });
    $('#vectors_vllm_model').val(settings.vllm_model).on('input', () => {
        !scopesEnabled && $('#vectors_modelWarning').show();
        settings.vllm_model = String($('#vectors_vllm_model').val());
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });
    $('#vectors_ollama_keep').prop('checked', settings.ollama_keep).on('input', () => {
        settings.ollama_keep = $('#vectors_ollama_keep').prop('checked');
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
    $('#vectors_files_vectorize_all').on('click', onVectorizeAllFilesClick);
    $('#vectors_files_purge').on('click', onPurgeFilesClick);

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

    $('#vectors_summarize').prop('checked', settings.summarize).on('input', () => {
        settings.summarize = !!$('#vectors_summarize').prop('checked');
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });

    $('#vectors_summarize_user').prop('checked', settings.summarize_sent).on('input', () => {
        settings.summarize_sent = !!$('#vectors_summarize_user').prop('checked');
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });

    $('#vectors_summary_source').val(settings.summary_source).on('change', () => {
        settings.summary_source = String($('#vectors_summary_source').val());
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });

    $('#vectors_summary_prompt').val(settings.summary_prompt).on('input', () => {
        settings.summary_prompt = String($('#vectors_summary_prompt').val());
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });

    $('#vectors_message_chunk_size').val(settings.message_chunk_size).on('input', () => {
        settings.message_chunk_size = Number($('#vectors_message_chunk_size').val());
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });

    $('#vectors_size_threshold_db').val(settings.size_threshold_db).on('input', () => {
        settings.size_threshold_db = Number($('#vectors_size_threshold_db').val());
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });

    $('#vectors_chunk_size_db').val(settings.chunk_size_db).on('input', () => {
        settings.chunk_size_db = Number($('#vectors_chunk_size_db').val());
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });

    $('#vectors_chunk_count_db').val(settings.chunk_count_db).on('input', () => {
        settings.chunk_count_db = Number($('#vectors_chunk_count_db').val());
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });

    $('#vectors_overlap_percent').val(settings.overlap_percent).on('input', () => {
        settings.overlap_percent = Number($('#vectors_overlap_percent').val());
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });

    $('#vectors_overlap_percent_db').val(settings.overlap_percent_db).on('input', () => {
        settings.overlap_percent_db = Number($('#vectors_overlap_percent_db').val());
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });

    $('#vectors_file_template_db').val(settings.file_template_db).on('input', () => {
        settings.file_template_db = String($('#vectors_file_template_db').val());
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });

    $(`input[name="vectors_file_position_db"][value="${settings.file_position_db}"]`).prop('checked', true);
    $('input[name="vectors_file_position_db"]').on('change', () => {
        settings.file_position_db = Number($('input[name="vectors_file_position_db"]:checked').val());
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });

    $('#vectors_file_depth_db').val(settings.file_depth_db).on('input', () => {
        settings.file_depth_db = Number($('#vectors_file_depth_db').val());
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });

    $('#vectors_file_depth_role_db').val(settings.file_depth_role_db).on('input', () => {
        settings.file_depth_role_db = Number($('#vectors_file_depth_role_db').val());
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });

    $('#vectors_translate_files').prop('checked', settings.translate_files).on('input', () => {
        settings.translate_files = !!$('#vectors_translate_files').prop('checked');
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });

    $('#vectors_enabled_world_info').prop('checked', settings.enabled_world_info).on('input', () => {
        settings.enabled_world_info = !!$('#vectors_enabled_world_info').prop('checked');
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
        toggleSettings();
    });

    $('#vectors_enabled_for_all').prop('checked', settings.enabled_for_all).on('input', () => {
        settings.enabled_for_all = !!$('#vectors_enabled_for_all').prop('checked');
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });

    $('#vectors_max_entries').val(settings.max_entries).on('input', () => {
        settings.max_entries = Number($('#vectors_max_entries').val());
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });

    $('#vectors_score_threshold').val(settings.score_threshold).on('input', () => {
        settings.score_threshold = Number($('#vectors_score_threshold').val());
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });

    $('#vectors_force_chunk_delimiter').prop('checked', settings.force_chunk_delimiter).on('input', () => {
        settings.force_chunk_delimiter = String($('#vectors_force_chunk_delimiter').val());
        Object.assign(extension_settings.vectors, settings);
        saveSettingsDebounced();
    });

    $('#vectors_ollama_pull').on('click', (e) => {
        const presetModel = extension_settings.vectors.ollama_model || '';
        e.preventDefault();
        $('#ollama_download_model').trigger('click');
        $('#dialogue_popup_input').val(presetModel);
    });

    $('#api_key_nomicai').toggleClass('success', !!secret_state[SECRET_KEYS.NOMICAI]);

    toggleSettings();
    eventSource.on(event_types.MESSAGE_DELETED, onChatEvent);
    eventSource.on(event_types.MESSAGE_EDITED, onChatEvent);
    eventSource.on(event_types.MESSAGE_SENT, onChatEvent);
    eventSource.on(event_types.MESSAGE_RECEIVED, onChatEvent);
    eventSource.on(event_types.MESSAGE_SWIPED, onChatEvent);
    eventSource.on(event_types.CHAT_DELETED, purgeVectorIndex);
    eventSource.on(event_types.GROUP_CHAT_DELETED, purgeVectorIndex);
    eventSource.on(event_types.FILE_ATTACHMENT_DELETED, purgeFileVectorIndex);

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'db-ingest',
        callback: async () => {
            await ingestDataBankAttachments();
            return '';
        },
        aliases: ['databank-ingest', 'data-bank-ingest'],
        helpString: 'Force the ingestion of all Data Bank attachments.',
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'db-purge',
        callback: async () => {
            const dataBank = getDataBankAttachments();

            for (const file of dataBank) {
                await purgeFileVectorIndex(file.url);
            }

            return '';
        },
        aliases: ['databank-purge', 'data-bank-purge'],
        helpString: 'Purge the vector index for all Data Bank attachments.',
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'db-search',
        callback: async (args, query) => {
            const clamp = (v) => Number.isNaN(v) ? null : Math.min(1, Math.max(0, v));
            const threshold = clamp(Number(args?.threshold ?? settings.score_threshold));
            const source = String(args?.source ?? '');
            const attachments = source ? getDataBankAttachmentsForSource(source, false) : getDataBankAttachments(false);
            const collectionIds = await ingestDataBankAttachments(String(source));
            const queryResults = await queryMultipleCollections(collectionIds, String(query), settings.chunk_count_db, threshold);

            // Map collection IDs to file URLs
            const urls = Object
                .keys(queryResults)
                .map(x => attachments.find(y => getFileCollectionId(y.url) === x))
                .filter(x => x)
                .map(x => x.url);

            return JSON.stringify(urls);
        },
        aliases: ['databank-search', 'data-bank-search'],
        helpString: 'Search the Data Bank for a specific query using vector similarity. Returns a list of file URLs with the most relevant content.',
        namedArgumentList: [
            new SlashCommandNamedArgument('threshold', 'Threshold for the similarity score in the [0, 1] range. Uses the global config value if not set.', ARGUMENT_TYPE.NUMBER, false, false, ''),
            new SlashCommandNamedArgument('source', 'Optional filter for the attachments by source.', ARGUMENT_TYPE.STRING, false, false, '', ['global', 'character', 'chat']),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument('Query to search by.', ARGUMENT_TYPE.STRING, true, false),
        ],
        returns: ARGUMENT_TYPE.LIST,
    }));

    registerDebugFunction('purge-everything', 'Purge all vector indices', 'Obliterate all stored vectors for all sources. No mercy.', async () => {
        if (!confirm('Are you sure?')) {
            return;
        }
        await purgeAllVectorIndexes();
    });
});
