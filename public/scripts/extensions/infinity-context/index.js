import { saveSettingsDebounced, getCurrentChatId, system_message_types, eventSource, event_types } from "../../../script.js";
import { humanizedDateTime } from "../../RossAscends-mods.js";
import { getApiUrl, extension_settings, getContext, doExtrasFetch } from "../../extensions.js";
import { getFileText, onlyUnique, splitRecursive, IndexedDBStore } from "../../utils.js";
export { MODULE_NAME };

const MODULE_NAME = 'chromadb';
const dbStore = new IndexedDBStore('SillyTavern', MODULE_NAME);

const defaultSettings = {
    strategy: 'original',

    keep_context: 10,
    keep_context_min: 1,
    keep_context_max: 500,
    keep_context_step: 1,

    n_results: 20,
    n_results_min: 0,
    n_results_max: 500,
    n_results_step: 1,

    split_length: 384,
    split_length_min: 64,
    split_length_max: 4096,
    split_length_step: 64,

    file_split_length: 1024,
    file_split_length_min: 512,
    file_split_length_max: 4096,
    file_split_length_step: 128,
};

const postHeaders = {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'bypass',
};

async function invalidateMessageSyncState(messageId) {
    console.log('CHROMADB: invalidating message sync state', messageId);
    const state = await getChatSyncState();
    state[messageId] = 0;
    await dbStore.put(getCurrentChatId(), state);
}

async function getChatSyncState() {
    const currentChatId = getCurrentChatId();
    if (!checkChatId(currentChatId)) {
        return;
    }

    const context = getContext();
    const chatState = (await dbStore.get(currentChatId)) || [];

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
    await dbStore.put(currentChatId, chatState);

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
    $('#chromadb_keep_context').val(extension_settings.chromadb.keep_context).trigger('input');
    $('#chromadb_n_results').val(extension_settings.chromadb.n_results).trigger('input');
    $('#chromadb_split_length').val(extension_settings.chromadb.split_length).trigger('input');
    $('#chromadb_file_split_length').val(extension_settings.chromadb.file_split_length).trigger('input');
    $('#chromadb_freeze').prop('checked', extension_settings.chromadb.freeze);
}

function onStrategyChange() {
    console.debug('changing chromadb strat');
    extension_settings.chromadb.strategy = $('#chromadb_strategy').val();

    //$('#chromadb_strategy').select(extension_settings.chromadb.strategy);
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
    await dbStore.put(getCurrentChatId(), syncState);

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
        await dbStore.delete(chat_id);
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
        toastr.error('An error occurred while attempting to download the data');
    }
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

        const split = splitRecursive(text, extension_settings.chromadb.file_split_length).filter(onlyUnique);
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

window.chromadb_interceptGeneration = async (chat) => {
    const currentChatId = getCurrentChatId();
    const selectedStrategy = extension_settings.chromadb.strategy;
    if (currentChatId) {
        const messagesToStore = chat.slice(0, -extension_settings.chromadb.keep_context);

        if (messagesToStore.length > 0 || extension_settings.chromadb.freeze) {
            await addMessages(currentChatId, messagesToStore);

            const lastMessage = chat[chat.length - 1];

            if (lastMessage) {
                const queriedMessages = await queryMessages(currentChatId, lastMessage.mes);

                queriedMessages.sort((a, b) => a.date - b.date);

                const newChat = [];

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

                if (selectedStrategy === 'original') {
                    //removes .length # messages from the start of 'kept messages'
                    //replaces them with chromaDB results (with no separator)
                    newChat.push(...queriedMessages.map(m => m.meta).filter(onlyUnique).map(JSON.parse));
                    chat.splice(0, messagesToStore.length, ...newChat);

                }
                console.log('ChromaDB chat after injection', chat);
            }
        }
    }
}

function onFreezeInput() {
    extension_settings.chromadb.freeze = $('#chromadb_freeze').is(':checked');
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
            </select>
            <label for="chromadb_keep_context"><small>How many original chat messages to keep: (<span id="chromadb_keep_context_value"></span>) messages</small></label>
            <input id="chromadb_keep_context" type="range" min="${defaultSettings.keep_context_min}" max="${defaultSettings.keep_context_max}" step="${defaultSettings.keep_context_step}" value="${defaultSettings.keep_context}" />
            <label for="chromadb_n_results"><small>Maximum number of ChromaDB 'memories' to inject: (<span id="chromadb_n_results_value"></span>) messages</small></label>
            <input id="chromadb_n_results" type="range" min="${defaultSettings.n_results_min}" max="${defaultSettings.n_results_max}" step="${defaultSettings.n_results_step}" value="${defaultSettings.n_results}" />
            <label for="chromadb_split_length"><small>Max length for each 'memory' pulled from the current chat history: (<span id="chromadb_split_length_value"></span>) characters</small></label>
            <input id="chromadb_split_length" type="range" min="${defaultSettings.split_length_min}" max="${defaultSettings.split_length_max}" step="${defaultSettings.split_length_step}" value="${defaultSettings.split_length}" />
            <label for="chromadb_file_split_length"><small>Max length for each 'memory' pulled from imported text files: (<span id="chromadb_file_split_length_value"></span>) characters</small></label>
            <input id="chromadb_file_split_length" type="range" min="${defaultSettings.file_split_length_min}" max="${defaultSettings.file_split_length_max}" step="${defaultSettings.file_split_length_step}" value="${defaultSettings.file_split_length}" />
            <label class="checkbox_label" for="chromadb_freeze" title="Pauses the automatic synchronization of new messages with ChromaDB. Older messages and injections will still be pulled as usual." >
                <input type="checkbox" id="chromadb_freeze" />
                <span>Freeze ChromaDB state</span>
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
    $('#chromadb_keep_context').on('input', onKeepContextInput);
    $('#chromadb_n_results').on('input', onNResultsInput);
    $('#chromadb_split_length').on('input', onSplitLengthInput);
    $('#chromadb_file_split_length').on('input', onFileSplitLengthInput);
    $('#chromadb_inject').on('click', () => $('#chromadb_inject_file').trigger('click'));
    $('#chromadb_import').on('click', () => $('#chromadb_import_file').trigger('click'));
    $('#chromadb_inject_file').on('change', onSelectInjectFile);
    $('#chromadb_import_file').on('change', onSelectImportFile);
    $('#chromadb_purge').on('click', onPurgeClick);
    $('#chromadb_export').on('click', onExportClick);
    $('#chromadb_freeze').on('input', onFreezeInput);
    await loadSettings();

    // Not sure if this is needed, but it's here just in case
    eventSource.on(event_types.MESSAGE_DELETED, getChatSyncState);
    eventSource.on(event_types.MESSAGE_RECEIVED, getChatSyncState);
    eventSource.on(event_types.MESSAGE_SENT, getChatSyncState);
    // Will make the sync state update when a message is edited or swiped
    eventSource.on(event_types.MESSAGE_EDITED, invalidateMessageSyncState);
    eventSource.on(event_types.MESSAGE_SWIPED, invalidateMessageSyncState);
});

