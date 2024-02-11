import { saveSettingsDebounced, getCurrentChatId, system_message_types, extension_prompt_types, eventSource, event_types, getRequestHeaders, substituteParams, } from "../../../script.js";
import { humanizedDateTime } from "../../RossAscends-mods.js";
import { getApiUrl, extension_settings, getContext, doExtrasFetch } from "../../extensions.js";
import { CHARACTERS_PER_TOKEN_RATIO } from "../../tokenizers.js";
import { getFileText, onlyUnique, splitRecursive } from "../../utils.js";
export { MODULE_NAME };

const MODULE_NAME = 'chromadb';
const dbStore = localforage.createInstance({ name: 'SillyTavern_ChromaDB' });

const defaultSettings = {
    strategy: 'original',
    sort_strategy: 'date',

    keep_context: 10,
    keep_context_min: 1,
    keep_context_max: 500,
    keep_context_step: 1,

    n_results: 20,
    n_results_min: 0,
    n_results_max: 500,
    n_results_step: 1,

    chroma_depth: 20,
    chroma_depth_min: -1,
    chroma_depth_max: 500,
    chroma_depth_step: 1,
    chroma_default_msg: "In a past conversation:  [{{memories}}]",
    chroma_default_hhaa_wrapper: "Previous messages exchanged between {{user}} and {{char}}:\n{{memories}}",
    chroma_default_hhaa_memory: "- {{name}}: {{message}}\n",
    hhaa_token_limit: 512,

    split_length: 384,
    split_length_min: 64,
    split_length_max: 4096,
    split_length_step: 64,

    file_split_length: 1024,
    file_split_length_min: 512,
    file_split_length_max: 4096,
    file_split_length_step: 128,

    keep_context_proportion: 0.5,
    keep_context_proportion_min: 0.0,
    keep_context_proportion_max: 1.0,
    keep_context_proportion_step: 0.05,

    auto_adjust: true,
    freeze: false,
    query_last_only: true,
};

const postHeaders = {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'bypass',
};

async function invalidateMessageSyncState(messageId) {
    console.log('CHROMADB: invalidating message sync state', messageId);
    const state = await getChatSyncState();
    state[messageId] = 0;
    await dbStore.setItem(getCurrentChatId(), state);
}

async function getChatSyncState() {
    const currentChatId = getCurrentChatId();
    if (!checkChatId(currentChatId)) {
        return;
    }

    const context = getContext();
    const chatState = (await dbStore.getItem(currentChatId)) || [];

    // if the chat length has decreased, it means that some messages were deleted
    if (chatState.length > context.chat.length) {
        for (let i = context.chat.length; i < chatState.length; i++) {
            // if the synced message was deleted, notify the user
            if (chatState[i]) {
                toastr.warning(
                    'Purge your ChromaDB to remove it from there too. See the "Smart Context" tab in the Extensions menu for more information.',
                    'Message deleted from chat, but it still exists inside the ChromaDB database.',
                    { timeOut: 0, extendedTimeOut: 0, preventDuplicates: true },
                );
                break;
            }
        }
    }

    chatState.length = context.chat.length;
    for (let i = 0; i < chatState.length; i++) {
        if (chatState[i] === undefined) {
            chatState[i] = 0;
        }
    }
    await dbStore.setItem(currentChatId, chatState);

    return chatState;
}

async function loadSettings() {
    if (Object.keys(extension_settings.chromadb).length === 0) {
        Object.assign(extension_settings.chromadb, defaultSettings);
    }

    console.debug(`loading chromadb strat:${extension_settings.chromadb.strategy}`);
    $("#chromadb_strategy option[value=" + extension_settings.chromadb.strategy + "]").attr(
        "selected",
        "true"
    );
    $("#chromadb_sort_strategy option[value=" + extension_settings.chromadb.sort_strategy + "]").attr(
        "selected",
        "true"
    );
    $('#chromadb_keep_context').val(extension_settings.chromadb.keep_context).trigger('input');
    $('#chromadb_n_results').val(extension_settings.chromadb.n_results).trigger('input');
    $('#chromadb_split_length').val(extension_settings.chromadb.split_length).trigger('input');
    $('#chromadb_file_split_length').val(extension_settings.chromadb.file_split_length).trigger('input');
    $('#chromadb_keep_context_proportion').val(extension_settings.chromadb.keep_context_proportion).trigger('input');
    $('#chromadb_custom_depth').val(extension_settings.chromadb.chroma_depth).trigger('input');
    $('#chromadb_custom_msg').val(extension_settings.chromadb.recall_msg).trigger('input');

    $('#chromadb_hhaa_wrapperfmt').val(extension_settings.chromadb.hhaa_wrapper_msg).trigger('input');
    $('#chromadb_hhaa_memoryfmt').val(extension_settings.chromadb.hhaa_memory_msg).trigger('input');
    $('#chromadb_hhaa_token_limit').val(extension_settings.chromadb.hhaa_token_limit).trigger('input');

    $('#chromadb_auto_adjust').prop('checked', extension_settings.chromadb.auto_adjust);
    $('#chromadb_freeze').prop('checked', extension_settings.chromadb.freeze);
    $('#chromadb_query_last_only').prop('checked', extension_settings.chromadb.query_last_only);
    enableDisableSliders();
    onStrategyChange();
}

function onStrategyChange() {
    console.debug('changing chromadb strat');
    extension_settings.chromadb.strategy = $('#chromadb_strategy').val();
    if (extension_settings.chromadb.strategy === "custom") {
        $('#chromadb_custom_depth').show();
        $('label[for="chromadb_custom_depth"]').show();
        $('#chromadb_custom_msg').show();
        $('label[for="chromadb_custom_msg"]').show();
    }
    else if(extension_settings.chromadb.strategy === "hh_aa"){
        $('#chromadb_hhaa_wrapperfmt').show();
        $('label[for="chromadb_hhaa_wrapperfmt"]').show();
        $('#chromadb_hhaa_memoryfmt').show();
        $('label[for="chromadb_hhaa_memoryfmt"]').show();
        $('#chromadb_hhaa_token_limit').show();
        $('label[for="chromadb_hhaa_token_limit"]').show();
    }
    saveSettingsDebounced();
}

function onRecallStrategyChange() {
    console.log('changing chromadb recall strat');
    extension_settings.chromadb.recall_strategy = $('#chromadb_recall_strategy').val();

    saveSettingsDebounced();
}

function onSortStrategyChange() {
    console.log('changing chromadb sort strat');
    extension_settings.chromadb.sort_strategy = $('#chromadb_sort_strategy').val();

    saveSettingsDebounced();
}

function onKeepContextInput() {
    extension_settings.chromadb.keep_context = Number($('#chromadb_keep_context').val());
    $('#chromadb_keep_context_value').text(extension_settings.chromadb.keep_context);
    saveSettingsDebounced();
}

function onNResultsInput() {
    extension_settings.chromadb.n_results = Number($('#chromadb_n_results').val());
    $('#chromadb_n_results_value').text(extension_settings.chromadb.n_results);
    saveSettingsDebounced();
}

function onChromaDepthInput() {
    extension_settings.chromadb.chroma_depth = Number($('#chromadb_custom_depth').val());
    $('#chromadb_custom_depth_value').text(extension_settings.chromadb.chroma_depth);
    saveSettingsDebounced();
}

function onChromaMsgInput() {
    extension_settings.chromadb.recall_msg = $('#chromadb_custom_msg').val();
    saveSettingsDebounced();
}

function onChromaHHAAWrapper() {
    extension_settings.chromadb.hhaa_wrapper_msg = $('#chromadb_hhaa_wrapperfmt').val();
    saveSettingsDebounced();
}
function onChromaHHAAMemory() {
    extension_settings.chromadb.hhaa_memory_msg = $('#chromadb_hhaa_memoryfmt').val();
    saveSettingsDebounced();
}
function onChromaHHAATokens() {
    extension_settings.chromadb.hhaa_token_limit = Number($('#chromadb_hhaa_token_limit').val());
    $('#chromadb_hhaa_token_limit_value').text(extension_settings.chromadb.hhaa_token_limit);
    saveSettingsDebounced();
}

function onSplitLengthInput() {
    extension_settings.chromadb.split_length = Number($('#chromadb_split_length').val());
    $('#chromadb_split_length_value').text(extension_settings.chromadb.split_length);
    saveSettingsDebounced();
}

function onFileSplitLengthInput() {
    extension_settings.chromadb.file_split_length = Number($('#chromadb_file_split_length').val());
    $('#chromadb_file_split_length_value').text(extension_settings.chromadb.file_split_length);
    saveSettingsDebounced();
}

function onChunkNLInput() {
    let shouldSplit = $('#onChunkNLInput').is(':checked');
    if (shouldSplit) {
        extension_settings.chromadb.file_split_type = "newline";
    } else {
        extension_settings.chromadb.file_split_type = "length";
    }
    saveSettingsDebounced();
}

function checkChatId(chat_id) {
    if (!chat_id || chat_id.trim() === '') {
        toastr.error('Please select a character and try again.');
        return false;
    }
    return true;
}

async function addMessages(chat_id, messages) {
    if (extension_settings.chromadb.freeze) {
        return { count: 0 };
    }

    const url = new URL(getApiUrl());
    url.pathname = '/api/chromadb';

    const messagesDeepCopy = JSON.parse(JSON.stringify(messages));
    let splitMessages = [];

    let id = 0;
    messagesDeepCopy.forEach((m, index) => {
        const split = splitRecursive(m.mes, extension_settings.chromadb.split_length);
        splitMessages.push(...split.map(text => ({
            ...m,
            mes: text,
            send_date: id,
            id: `msg-${id++}`,
            index: index,
            extra: undefined,
        })));
    });

    splitMessages = await filterSyncedMessages(splitMessages);

    // no messages to add
    if (splitMessages.length === 0) {
        return { count: 0 };
    }

    const transformedMessages = splitMessages.map((m) => ({
        id: m.id,
        role: m.is_user ? 'user' : 'assistant',
        content: m.mes,
        date: m.send_date,
        meta: JSON.stringify(m),
    }));

    const addMessagesResult = await doExtrasFetch(url, {
        method: 'POST',
        headers: postHeaders,
        body: JSON.stringify({ chat_id, messages: transformedMessages }),
    });

    if (addMessagesResult.ok) {
        const addMessagesData = await addMessagesResult.json();
        return addMessagesData; // { count: 1 }
    }

    return { count: 0 };
}

async function filterSyncedMessages(splitMessages) {
    const syncState = await getChatSyncState();
    const removeIndices = [];
    const syncedIndices = [];
    for (let i = 0; i < splitMessages.length; i++) {
        const index = splitMessages[i].index;

        if (syncState[index]) {
            removeIndices.push(i);
            continue;
        }

        syncedIndices.push(index);
    }

    for (const index of syncedIndices) {
        syncState[index] = 1;
    }

    console.debug('CHROMADB: sync state', syncState.map((v, i) => ({ id: i, synced: v })));
    await dbStore.setItem(getCurrentChatId(), syncState);

    // remove messages that are already synced
    return splitMessages.filter((_, i) => !removeIndices.includes(i));
}

async function onPurgeClick() {
    const chat_id = getCurrentChatId();
    if (!checkChatId(chat_id)) {
        return;
    }
    const url = new URL(getApiUrl());
    url.pathname = '/api/chromadb/purge';

    const purgeResult = await doExtrasFetch(url, {
        method: 'POST',
        headers: postHeaders,
        body: JSON.stringify({ chat_id }),
    });

    if (purgeResult.ok) {
        await dbStore.removeItem(chat_id);
        toastr.success('ChromaDB context has been successfully cleared');
    }
}

async function onExportClick() {
    const currentChatId = getCurrentChatId();
    if (!checkChatId(currentChatId)) {
        return;
    }
    const url = new URL(getApiUrl());
    url.pathname = '/api/chromadb/export';

    const exportResult = await doExtrasFetch(url, {
        method: 'POST',
        headers: postHeaders,
        body: JSON.stringify({ chat_id: currentChatId }),
    });

    if (exportResult.ok) {
        const data = await exportResult.json();
        const blob = new Blob([JSON.stringify(data, null, 2)], { type: 'application/json' });
        const href = URL.createObjectURL(blob);
        const link = document.createElement('a');
        link.href = href;
        link.download = currentChatId + '.json';
        document.body.appendChild(link);
        link.click();
        document.body.removeChild(link);
    } else {
        //Show the error from the result without the html, only what's in the body paragraph
        let parser = new DOMParser();
        let error = await exportResult.text();
        let doc = parser.parseFromString(error, 'text/html');
        let errorMessage = doc.querySelector('p').textContent;
        toastr.error(`An error occurred while attempting to download the data from ChromaDB: ${errorMessage}`);
    }
}

function tinyhash(text) {
    let hash = 0;
    for (let i = 0; i < text.length; ++i) {
        hash = ((hash<<5) - hash) + text.charCodeAt(i);
        hash = hash & hash; // Keeps it 32-bit allegedly.
    }
    return hash;
}

async function onSelectImportFile(e) {
    const file = e.target.files[0];
    const currentChatId = getCurrentChatId();
    if (!checkChatId(currentChatId)) {
        return;
    }

    if (!file) {
        return;
    }

    try {
        toastr.info('This may take some time, depending on the file size', 'Processing...');

        const text = await getFileText(file);
        const imported = JSON.parse(text);

        const id_salt = "-" + tinyhash(imported.chat_id).toString(36);
        for (let entry of imported.content) {
            entry.id = entry.id + id_salt;
        }

        imported.chat_id = currentChatId;

        const url = new URL(getApiUrl());
        url.pathname = '/api/chromadb/import';

        const importResult = await doExtrasFetch(url, {
            method: 'POST',
            headers: postHeaders,
            body: JSON.stringify(imported),
        });

        if (importResult.ok) {
            const importResultData = await importResult.json();

            toastr.success(`Number of chunks: ${importResultData.count}`, 'Injected successfully!');
            return importResultData;
        } else {
            throw new Error();
        }
    }
    catch (error) {
        console.log(error);
        toastr.error('Something went wrong while importing the data');
    }
    finally {
        e.target.form.reset();
    }
}

async function queryMessages(chat_id, query) {
    const url = new URL(getApiUrl());
    url.pathname = '/api/chromadb/query';

    const queryMessagesResult = await doExtrasFetch(url, {
        method: 'POST',
        headers: postHeaders,
        body: JSON.stringify({ chat_id, query, n_results: extension_settings.chromadb.n_results }),
    });

    if (queryMessagesResult.ok) {
        const queryMessagesData = await queryMessagesResult.json();

        return queryMessagesData;
    }

    return [];
}

async function queryMultiMessages(chat_id, query) {
    const context = getContext();
    const response = await fetch("/getallchatsofcharacter", {
        method: 'POST',
        body: JSON.stringify({ avatar_url: context.characters[context.characterId].avatar }),
        headers: getRequestHeaders(),
    });
    if (!response.ok) {
        return;
    }
    let data = await response.json();
    data = Object.values(data);
    let chat_list = data.sort((a, b) => a["file_name"].localeCompare(b["file_name"])).reverse();

    // Extracting chat_ids from the chat_list
    chat_list = chat_list.map(chat => chat.file_name.replace(/\.[^/.]+$/, ""));
    const url = new URL(getApiUrl());
    url.pathname = '/api/chromadb/multiquery';

    const queryMessagesResult = await fetch(url, {
        method: 'POST',
        body: JSON.stringify({ chat_list, query, n_results: extension_settings.chromadb.n_results }),
        headers: postHeaders,
    });

    if (queryMessagesResult.ok) {
        const queryMessagesData = await queryMessagesResult.json();
        return queryMessagesData;
    }

    return [];
}

async function onSelectInjectFile(e) {
    const file = e.target.files[0];
    const currentChatId = getCurrentChatId();
    if (!checkChatId(currentChatId)) {
        return;
    }
    if (!file) {
        return;
    }

    try {
        toastr.info('This may take some time, depending on the file size', 'Processing...');
        const text = await getFileText(file);
        extension_settings.chromadb.file_split_type = "newline";
        //allow splitting on newlines or splitrecursively
        let split = [];
        if (extension_settings.chromadb.file_split_type == "newline") {
            split = text.split(/\r?\n/).filter(onlyUnique);
        } else {
            split = splitRecursive(text, extension_settings.chromadb.file_split_length).filter(onlyUnique);
        }
        const baseDate = Date.now();

        const messages = split.map((m, i) => ({
            id: `${file.name}-${split.indexOf(m)}`,
            role: 'system',
            content: m,
            date: baseDate + i,
            meta: JSON.stringify({
                name: file.name,
                is_user: false,
                is_name: false,
                is_system: false,
                send_date: humanizedDateTime(),
                mes: m,
                extra: {
                    type: system_message_types.NARRATOR,
                }
            }),
        }));

        const url = new URL(getApiUrl());
        url.pathname = '/api/chromadb';

        const addMessagesResult = await doExtrasFetch(url, {
            method: 'POST',
            headers: postHeaders,
            body: JSON.stringify({ chat_id: currentChatId, messages: messages }),
        });

        if (addMessagesResult.ok) {
            const addMessagesData = await addMessagesResult.json();

            toastr.success(`Number of chunks: ${addMessagesData.count}`, 'Injected successfully!');
            return addMessagesData;
        } else {
            throw new Error();
        }
    }
    catch (error) {
        console.log(error);
        toastr.error('Something went wrong while injecting the data');
    }
    finally {
        e.target.form.reset();
    }
}

// Gets the length of character description in the current context
function getCharacterDataLength() {
    const context = getContext();
    const character = context.characters[context.characterId];

    if (typeof character?.data !== 'object') {
        return 0;
    }

    let characterDataLength = 0;

    for (const [key, value] of Object.entries(character.data)) {
        if (typeof value !== 'string') {
            continue;
        }

        if (['description', 'personality', 'scenario'].includes(key)) {
            characterDataLength += character.data[key].length;
        }
    }

    return characterDataLength;
}

/*
* Automatically adjusts the extension settings for the optimal number of messages to keep and query based
* on the chat history and a specified maximum context length.
*/
function doAutoAdjust(chat, maxContext) {
    // Only valid for chat injections strategy
    if (extension_settings.chromadb.recall_strategy !== 0) {
        return;
    }

    console.debug('CHROMADB: Auto-adjusting sliders (messages: %o, maxContext: %o)', chat.length, maxContext);
    // Get mean message length
    const meanMessageLength = chat.reduce((acc, cur) => acc + (cur?.mes?.length ?? 0), 0) / chat.length;

    if (Number.isNaN(meanMessageLength) || meanMessageLength === 0) {
        console.debug('CHROMADB: Mean message length is zero or NaN, aborting auto-adjust');
        return;
    }

    // Adjust max context for character defs length
    maxContext = Math.floor(maxContext - (getCharacterDataLength() / CHARACTERS_PER_TOKEN_RATIO));
    console.debug('CHROMADB: Max context adjusted for character defs: %o', maxContext);

    console.debug('CHROMADB: Mean message length (characters): %o', meanMessageLength);
    // Convert to number of "tokens"
    const meanMessageLengthTokens = Math.ceil(meanMessageLength / CHARACTERS_PER_TOKEN_RATIO);
    console.debug('CHROMADB: Mean message length (tokens): %o', meanMessageLengthTokens);
    // Get number of messages in context
    const contextMessages = Math.max(1, Math.ceil(maxContext / meanMessageLengthTokens));
    // Round up to nearest 5
    const contextMessagesRounded = Math.ceil(contextMessages / 5) * 5;
    console.debug('CHROMADB: Estimated context messages (rounded): %o', contextMessagesRounded);
    // Messages to keep (proportional, rounded to nearest 5, minimum 5, maximum 500)
    const messagesToKeep = Math.min(defaultSettings.keep_context_max, Math.max(5, Math.floor(contextMessagesRounded * extension_settings.chromadb.keep_context_proportion / 5) * 5));
    console.debug('CHROMADB: Estimated messages to keep: %o', messagesToKeep);
    // Messages to query (rounded, maximum 500)
    const messagesToQuery = Math.min(defaultSettings.n_results_max, contextMessagesRounded - messagesToKeep);
    console.debug('CHROMADB: Estimated messages to query: %o', messagesToQuery);
    // Set extension settings
    extension_settings.chromadb.keep_context = messagesToKeep;
    extension_settings.chromadb.n_results = messagesToQuery;
    // Update sliders
    $('#chromadb_keep_context').val(messagesToKeep);
    $('#chromadb_n_results').val(messagesToQuery);
    // Update labels
    $('#chromadb_keep_context_value').text(extension_settings.chromadb.keep_context);
    $('#chromadb_n_results_value').text(extension_settings.chromadb.n_results);
}

window.chromadb_interceptGeneration = async (chat, maxContext) => {
    if (extension_settings.chromadb.auto_adjust) {
        doAutoAdjust(chat, maxContext);
    }

    const currentChatId = getCurrentChatId();
    if (!currentChatId)
        return;

    //log the current settings
    console.debug("CHROMADB: Current settings: %o", extension_settings.chromadb);

    const selectedStrategy = extension_settings.chromadb.strategy;
    const recallStrategy = extension_settings.chromadb.recall_strategy;
    let recallMsg = extension_settings.chromadb.recall_msg || defaultSettings.chroma_default_msg;
    const chromaDepth = extension_settings.chromadb.chroma_depth;
    const chromaSortStrategy = extension_settings.chromadb.sort_strategy;
    const chromaQueryLastOnly = extension_settings.chromadb.query_last_only;
    const messagesToStore = chat.slice(0, -extension_settings.chromadb.keep_context);

    if (messagesToStore.length > 0 && !extension_settings.chromadb.freeze) {
        //log the messages to store
        console.debug("CHROMADB: Messages to store: %o", messagesToStore);
        //log the messages to store length vs keep context
        console.debug("CHROMADB: Messages to store length vs keep context: %o vs %o", messagesToStore.length, extension_settings.chromadb.keep_context);
        await addMessages(currentChatId, messagesToStore);
    }

    const lastMessage = chat[chat.length - 1];

    let queriedMessages;
    if (lastMessage) {
        let queryBlob = "";
        if (chromaQueryLastOnly) {
            queryBlob = lastMessage.mes;
        }
        else {
            for (let msg of chat.slice(-extension_settings.chromadb.keep_context)) {
                queryBlob += `${msg.mes}\n`
            }
        }
        console.debug("CHROMADB: Query text:", queryBlob);

        if (recallStrategy === 'multichat') {
            console.log("Utilizing multichat")
            queriedMessages = await queryMultiMessages(currentChatId, queryBlob);
        }
        else {
            queriedMessages = await queryMessages(currentChatId, queryBlob);
        }

        if (chromaSortStrategy === "date") {
            queriedMessages.sort((a, b) => a.date - b.date);
        }
        else {
            queriedMessages.sort((a, b) => b.distance - a.distance);
        }
        console.debug("CHROMADB: Query results: %o", queriedMessages);


        let newChat = [];

        if (selectedStrategy === 'ross') {
            //adds chroma to the end of chat and allows Generate() to cull old messages naturally.
            const context = getContext();
            const charname = context.name2;
            newChat.push(
                {
                    is_name: false,
                    is_user: false,
                    mes: `[Use these past chat exchanges to inform ${charname}'s next response:`,
                    name: "system",
                    send_date: 0,
                }
            );
            newChat.push(...queriedMessages.map(m => m.meta).filter(onlyUnique).map(JSON.parse));
            newChat.push(
                {
                    is_name: false,
                    is_user: false,
                    mes: `]\n`,
                    name: "system",
                    send_date: 0,
                }
            );
            chat.splice(chat.length, 0, ...newChat);
        }
        if (selectedStrategy === 'hh_aa') {
            // Insert chroma history messages as a list at the AFTER_SCENARIO anchor point
            const context = getContext();
            const chromaTokenLimit = extension_settings.chromadb.hhaa_token_limit;

            let wrapperMsg = extension_settings.chromadb.hhaa_wrapper_msg || defaultSettings.chroma_default_hhaa_wrapper;
            wrapperMsg = substituteParams(wrapperMsg, context.name1, context.name2);
            if (!wrapperMsg.includes("{{memories}}")) {
                wrapperMsg += " {{memories}}";
            }
            let memoryMsg = extension_settings.chromadb.hhaa_memory_msg || defaultSettings.chroma_default_hhaa_memory;
            memoryMsg = substituteParams(memoryMsg, context.name1, context.name2);
            if (!memoryMsg.includes("{{message}}")) {
                memoryMsg += " {{message}}";
            }

            // Reversed because we want the most 'important' messages at the bottom.
            let recalledMemories = queriedMessages.map(m => m.meta).filter(onlyUnique).map(JSON.parse).reverse();
            let tokenApprox = 0;
            let allMemoryBlob = "";
            let seenMemories = new Set(); // Why are there even duplicates in chromadb anyway?
            for (const msg of recalledMemories) {
                const memoryBlob = memoryMsg.replace('{{name}}', msg.name).replace('{{message}}', msg.mes);
                const memoryTokens = (memoryBlob.length / CHARACTERS_PER_TOKEN_RATIO);
                if (!seenMemories.has(memoryBlob) && tokenApprox + memoryTokens <= chromaTokenLimit) {
                    allMemoryBlob += memoryBlob;
                    tokenApprox += memoryTokens;
                    seenMemories.add(memoryBlob);
                }
            }

            // No memories? No prompt.
            const promptBlob = (tokenApprox == 0) ? "" : wrapperMsg.replace('{{memories}}', allMemoryBlob);
            console.debug("CHROMADB: prompt blob: %o", promptBlob);
            context.setExtensionPrompt(MODULE_NAME, promptBlob, extension_prompt_types.AFTER_SCENARIO);
        }
        if (selectedStrategy === 'custom') {
            const context = getContext();
            recallMsg = substituteParams(recallMsg, context.name1, context.name2);
            if (!recallMsg.includes("{{memories}}")) {
                recallMsg += " {{memories}}";
            }
            let recallStart = recallMsg.split('{{memories}}')[0]
            let recallEnd = recallMsg.split('{{memories}}')[1]

            newChat.push(
                {
                    is_name: false,
                    is_user: false,
                    mes: recallStart,
                    name: "system",
                    send_date: 0,
                }
            );
            newChat.push(...queriedMessages.map(m => m.meta).filter(onlyUnique).map(JSON.parse));
            newChat.push(
                {
                    is_name: false,
                    is_user: false,
                    mes: recallEnd + `\n`,
                    name: "system",
                    send_date: 0,
                }
            );

            //prototype chroma duplicate removal
            let chatset = new Set(chat.map(obj => obj.mes));
            newChat = newChat.filter(obj => !chatset.has(obj.mes));

            if(chromaDepth === -1) {
                chat.splice(chat.length, 0, ...newChat);
            }
            else {
                chat.splice(chromaDepth, 0, ...newChat);
            }
        }
        if (selectedStrategy === 'original') {
            //removes .length # messages from the start of 'kept messages'
            //replaces them with chromaDB results (with no separator)
            newChat.push(...queriedMessages.map(m => m.meta).filter(onlyUnique).map(JSON.parse));
            chat.splice(0, messagesToStore.length, ...newChat);

        }
    }
}


function onFreezeInput() {
    extension_settings.chromadb.freeze = $('#chromadb_freeze').is(':checked');
    saveSettingsDebounced();
}

function onAutoAdjustInput() {
    extension_settings.chromadb.auto_adjust = $('#chromadb_auto_adjust').is(':checked');
    enableDisableSliders();
    saveSettingsDebounced();
}
function onFullLogQuery() {
    extension_settings.chromadb.query_last_only = $('#chromadb_query_last_only').is(':checked');
    saveSettingsDebounced();
}

function enableDisableSliders() {
    const auto_adjust = extension_settings.chromadb.auto_adjust;
    $('label[for="chromadb_keep_context"]').prop('hidden', auto_adjust);
    $('#chromadb_keep_context').prop('hidden', auto_adjust)
    $('label[for="chromadb_n_results"]').prop('hidden', auto_adjust);
    $('#chromadb_n_results').prop('hidden', auto_adjust)
    $('label[for="chromadb_keep_context_proportion"]').prop('hidden', !auto_adjust);
    $('#chromadb_keep_context_proportion').prop('hidden', !auto_adjust)
}

function onKeepContextProportionInput() {
    extension_settings.chromadb.keep_context_proportion = $('#chromadb_keep_context_proportion').val();
    $('#chromadb_keep_context_proportion_value').text(Math.round(extension_settings.chromadb.keep_context_proportion * 100));
    saveSettingsDebounced();
}

jQuery(async () => {
    const settingsHtml = `
    <div class="chromadb_settings">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
            <b>Smart Context</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <small>This extension rearranges the messages in the current chat to keep more relevant information in the context. Adjust the sliders below based on average amount of messages in your prompt (refer to the chat cut-off line).</small>
            <span class="wide100p marginTopBot5 displayBlock">Memory Injection Strategy</span>
            <hr>
            <select id="chromadb_strategy">
                <option value="original">Replace non-kept chat items with memories</option>
                <option value="ross">Add memories after chat with a header tag</option>
                <option value="hh_aa">Add memory list to character description</option>
                <option value="custom">Add memories at custom depth with custom msg</option>
            </select>
            <label for="chromadb_custom_msg" hidden><small>Custom injection message:</small></label>
            <textarea id="chromadb_custom_msg" hidden class="text_pole textarea_compact" rows="2" placeholder="${defaultSettings.chroma_default_msg}" style="height: 61px; display: none;"></textarea>
            <label for="chromadb_custom_depth" hidden><small>How deep should the memory messages be injected?: (<span id="chromadb_custom_depth_value"></span>)</small></label>
            <input id="chromadb_custom_depth" type="range" min="${defaultSettings.chroma_depth_min}" max="${defaultSettings.chroma_depth_max}" step="${defaultSettings.chroma_depth_step}" value="${defaultSettings.chroma_depth}" hidden/>

            <label for="chromadb_hhaa_wrapperfmt" hidden><small>Custom wrapper format:</small></label>
            <textarea id="chromadb_hhaa_wrapperfmt" hidden class="text_pole textarea_compact" rows="2" placeholder="${defaultSettings.chroma_default_hhaa_wrapper}" style="height: 61px; display: none;"></textarea>
            <label for="chromadb_hhaa_memoryfmt" hidden><small>Custom memory format:</small></label>
            <textarea id="chromadb_hhaa_memoryfmt" hidden class="text_pole textarea_compact" rows="2" placeholder="${defaultSettings.chroma_default_hhaa_memory}" style="height: 61px; display: none;"></textarea>
            <label for="chromadb_hhaa_token_limit" hidden><small>Maximum tokens allowed for memories: (<span id="chromadb_hhaa_token_limit_value"></span>)</small></label>
            <input id="chromadb_hhaa_token_limit" type="range" min="0" max="2048" step="64" value="${defaultSettings.hhaa_token_limit}" hidden/>


            <span>Memory Recall Strategy</span>
            <select id="chromadb_recall_strategy">
                <option value="original">Recall only from this chat</option>
                <option value="multichat">Recall from all character chats (experimental)</option>
            </select>
            <span>Memory Sort Strategy</span>
            <select id="chromadb_sort_strategy">
                <option value="date">Sort memories by date</option>
                <option value="distance">Sort memories by relevance</option>
            </select>
            <label for="chromadb_keep_context"><small>How many original chat messages to keep: (<span id="chromadb_keep_context_value"></span>) messages</small></label>
            <input id="chromadb_keep_context" type="range" min="${defaultSettings.keep_context_min}" max="${defaultSettings.keep_context_max}" step="${defaultSettings.keep_context_step}" value="${defaultSettings.keep_context}" />
            <label for="chromadb_n_results"><small>Maximum number of ChromaDB 'memories' to inject: (<span id="chromadb_n_results_value"></span>) messages</small></label>
            <input id="chromadb_n_results" type="range" min="${defaultSettings.n_results_min}" max="${defaultSettings.n_results_max}" step="${defaultSettings.n_results_step}" value="${defaultSettings.n_results}" />

            <label for="chromadb_keep_context_proportion"><small>Keep (<span id="chromadb_keep_context_proportion_value"></span>%) of in-context chat messages; replace the rest with memories</small></label>
            <input id="chromadb_keep_context_proportion" type="range" min="${defaultSettings.keep_context_proportion_min}" max="${defaultSettings.keep_context_proportion_max}" step="${defaultSettings.keep_context_proportion_step}" value="${defaultSettings.keep_context_proportion}" />
            <label for="chromadb_split_length"><small>Max length for each 'memory' pulled from the current chat history: (<span id="chromadb_split_length_value"></span>) characters</small></label>
            <input id="chromadb_split_length" type="range" min="${defaultSettings.split_length_min}" max="${defaultSettings.split_length_max}" step="${defaultSettings.split_length_step}" value="${defaultSettings.split_length}" />
            <label for="chromadb_file_split_length"><small>Max length for each 'memory' pulled from imported text files: (<span id="chromadb_file_split_length_value"></span>) characters</small></label>
            <input id="chromadb_file_split_length" type="range" min="${defaultSettings.file_split_length_min}" max="${defaultSettings.file_split_length_max}" step="${defaultSettings.file_split_length_step}" value="${defaultSettings.file_split_length}" />
            <label class="checkbox_label" for="chromadb_freeze" title="Pauses the automatic synchronization of new messages with ChromaDB. Older messages and injections will still be pulled as usual." >
                <input type="checkbox" id="chromadb_freeze" />
                <span>Freeze ChromaDB state</span>
            </label>
            <label class="checkbox_label for="chromadb_auto_adjust" title="Automatically adjusts the number of messages to keep based on the average number of messages in the current chat and the chosen proportion.">
                <input type="checkbox" id="chromadb_auto_adjust" />
                <span>Use % strategy</span>
            </label>
            <label class="checkbox_label" for="chromadb_chunk_nl" title="Chunk injected documents on newline instead of at set character size." >
                <input type="checkbox" id="chromadb_chunk_nl" />
                <span>Chunk on Newlines</span>
            </label>
            <label class="checkbox_label for="chromadb_query_last_only" title="ChromaDB queries only use the most recent message. (Instead of using all messages still in the context.)">
                <input type="checkbox" id="chromadb_query_last_only" />
                <span>Query last message only</span>
            </label>
            <div class="flex-container spaceEvenly">
                <div id="chromadb_inject" title="Upload custom textual data to use in the context of the current chat" class="menu_button">
                    <i class="fa-solid fa-file-arrow-up"></i>
                    <span>Inject Data (TXT file)</span>
                </div>
                <div id="chromadb_export" title="Export all of the current chromadb data for this current chat" class="menu_button">
                    <i class="fa-solid fa-file-export"></i>
                    <span>Export</span>
                </div>
                <div id="chromadb_import" title="Import a full chromadb export for this current chat" class="menu_button">
                    <i class="fa-solid fa-file-import"></i>
                    <span>Import</span>
                </div>
                <div id="chromadb_purge" title="Force purge all the data related to the current chat from the database" class="menu_button">
                    <i class="fa-solid fa-broom"></i>
                    <span>Purge Chat from the DB</span>
                </div>
            </div>
            <small><i>Local ChromaDB now persists to disk by default. The default folder is .chroma_db, and you can set a different folder with the --chroma-folder argument. If you are using the Extras Colab notebook, you will need to inject the text data every time the Extras API server is restarted.</i></small>
        </div>
        <form><input id="chromadb_inject_file" type="file" accept="text/plain" hidden></form>
        <form><input id="chromadb_import_file" type="file" accept="application/json" hidden></form>
    </div>`;

    $('#extensions_settings2').append(settingsHtml);
    $('#chromadb_strategy').on('change', onStrategyChange);
    $('#chromadb_recall_strategy').on('change', onRecallStrategyChange);
    $('#chromadb_sort_strategy').on('change', onSortStrategyChange);
    $('#chromadb_keep_context').on('input', onKeepContextInput);
    $('#chromadb_n_results').on('input', onNResultsInput);
    $('#chromadb_custom_depth').on('input', onChromaDepthInput);
    $('#chromadb_custom_msg').on('input', onChromaMsgInput);

    $('#chromadb_hhaa_wrapperfmt').on('input', onChromaHHAAWrapper);
    $('#chromadb_hhaa_memoryfmt').on('input', onChromaHHAAMemory);
    $('#chromadb_hhaa_token_limit').on('input', onChromaHHAATokens);

    $('#chromadb_split_length').on('input', onSplitLengthInput);
    $('#chromadb_file_split_length').on('input', onFileSplitLengthInput);
    $('#chromadb_inject').on('click', () => $('#chromadb_inject_file').trigger('click'));
    $('#chromadb_import').on('click', () => $('#chromadb_import_file').trigger('click'));
    $('#chromadb_inject_file').on('change', onSelectInjectFile);
    $('#chromadb_import_file').on('change', onSelectImportFile);
    $('#chromadb_purge').on('click', onPurgeClick);
    $('#chromadb_export').on('click', onExportClick);
    $('#chromadb_freeze').on('input', onFreezeInput);
    $('#chromadb_chunk_nl').on('input', onChunkNLInput);
    $('#chromadb_auto_adjust').on('input', onAutoAdjustInput);
    $('#chromadb_query_last_only').on('input', onFullLogQuery);
    $('#chromadb_keep_context_proportion').on('input', onKeepContextProportionInput);
    await loadSettings();

    // Not sure if this is needed, but it's here just in case
    eventSource.on(event_types.MESSAGE_DELETED, getChatSyncState);
    eventSource.on(event_types.MESSAGE_RECEIVED, getChatSyncState);
    eventSource.on(event_types.MESSAGE_SENT, getChatSyncState);
    // Will make the sync state update when a message is edited or swiped
    eventSource.on(event_types.MESSAGE_EDITED, invalidateMessageSyncState);
    eventSource.on(event_types.MESSAGE_SWIPED, invalidateMessageSyncState);
});

