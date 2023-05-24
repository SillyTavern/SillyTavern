import { saveSettingsDebounced, getCurrentChatId, system_message_types } from "../../../script.js";
import { humanizedDateTime } from "../../RossAscends-mods.js";
import { getApiUrl, extension_settings, getContext } from "../../extensions.js";
import { getFileText, onlyUnique, splitRecursive } from "../../utils.js";
export { MODULE_NAME };

const MODULE_NAME = 'chromadb';

const defaultSettings = {
    strategy: 'original',

    keep_context: 10,
    keep_context_min: 1,
    keep_context_max: 100,
    keep_context_step: 1,

    n_results: 20,
    n_results_min: 1,
    n_results_max: 100,
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

async function loadSettings() {
    if (Object.keys(extension_settings.chromadb).length === 0) {
        Object.assign(extension_settings.chromadb, defaultSettings);
    }

    console.log(`loading chromadb strat:${extension_settings.chromadb.strategy}`);
    $("#chromadb_strategy option[value=" + extension_settings.chromadb.strategy + "]").attr(
        "selected",
        "true"
    );
    $('#chromadb_keep_context').val(extension_settings.chromadb.keep_context).trigger('input');
    $('#chromadb_n_results').val(extension_settings.chromadb.n_results).trigger('input');
    $('#chromadb_split_length').val(extension_settings.chromadb.split_length).trigger('input');
    $('#chromadb_file_split_length').val(extension_settings.chromadb.file_split_length).trigger('input');
}

function onStrategyChange() {
    console.log('changing chromadb strat');
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

async function addMessages(chat_id, messages) {
    const url = new URL(getApiUrl());
    url.pathname = '/api/chromadb';

    const messagesDeepCopy = JSON.parse(JSON.stringify(messages));
    const splittedMessages = [];

    let id = 0;
    messagesDeepCopy.forEach(m => {
        const split = splitRecursive(m.mes, extension_settings.chromadb.split_length);
        splittedMessages.push(...split.map(text => ({
            ...m,
            mes: text,
            send_date: id,
            id: `msg-${id++}`,
        })));
    });

    const transformedMessages = splittedMessages.map((m) => ({
        id: m.id,
        role: m.is_user ? 'user' : 'assistant',
        content: m.mes,
        date: m.send_date,
        meta: JSON.stringify(m),
    }));

    const addMessagesResult = await fetch(url, {
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

async function onPurgeClick() {
    const chat_id = getCurrentChatId();
    const url = new URL(getApiUrl());
    url.pathname = '/api/chromadb/purge';

    const purgeResult = await fetch(url, {
        method: 'POST',
        headers: postHeaders,
        body: JSON.stringify({ chat_id }),
    });

    if (purgeResult.ok) {
        toastr.success('ChromaDB context has been successfully cleared');
    }
}

async function queryMessages(chat_id, query) {
    const url = new URL(getApiUrl());
    url.pathname = '/api/chromadb/query';

    const queryMessagesResult = await fetch(url, {
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

    if (!file) {
        return;
    }

    try {
        toastr.info('This may take some time, depending on the file size', 'Processing...');
        const currentChatId = getCurrentChatId();
        const text = await getFileText(file);

        const split = splitRecursive(text, extension_settings.chromadb.file_split_length).filter(onlyUnique);

        const messages = split.map(m => ({
            id: `${file.name}-${split.indexOf(m)}`,
            role: 'system',
            content: m,
            date: Date.now(),
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

        const addMessagesResult = await fetch(url, {
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

        if (messagesToStore.length > 0) {
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
                    newChat.push(...queriedMessages.map(m => JSON.parse(m.meta)));
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
                    newChat.push(...queriedMessages.map(m => JSON.parse(m.meta)));
                    chat.splice(0, messagesToStore.length, ...newChat);

                }
                console.log('ChromaDB chat after injection', chat);
            }
        }
    }
}

jQuery(async () => {
    const settingsHtml = `
    <div class="chromadb_settings">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
            <b>Infinity Context</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <span>Memory Injection Strategy</span>
            <select id="chromadb_strategy">
                <option value="original">Replace non-kept chat items with memories</option>
                <option value="ross">Add memories after chat with a header tag</option>
            </select>
            <label for="chromadb_keep_context">How many original chat messages to keep: (<span id="chromadb_keep_context_value"></span>) messages</label>
            <input id="chromadb_keep_context" type="range" min="${defaultSettings.keep_context_min}" max="${defaultSettings.keep_context_max}" step="${defaultSettings.keep_context_step}" value="${defaultSettings.keep_context}" />
            <label for="chromadb_n_results">Maximum number of ChromaDB 'memories' to inject: (<span id="chromadb_n_results_value"></span>) messages</label>
            <input id="chromadb_n_results" type="range" min="${defaultSettings.n_results_min}" max="${defaultSettings.n_results_max}" step="${defaultSettings.n_results_step}" value="${defaultSettings.n_results}" />
            <label for="chromadb_split_length">Max length for each 'memory' pulled from the current chat history: (<span id="chromadb_split_length_value"></span>) characters</label>
            <input id="chromadb_split_length" type="range" min="${defaultSettings.split_length_min}" max="${defaultSettings.split_length_max}" step="${defaultSettings.split_length_step}" value="${defaultSettings.split_length}" />
            <label for="chromadb_file_split_length">Max length for each 'memory' pulled from imported text files: (<span id="chromadb_file_split_length_value"></span>) characters</label>
            <input id="chromadb_file_split_length" type="range" min="${defaultSettings.file_split_length_min}" max="${defaultSettings.file_split_length_max}" step="${defaultSettings.file_split_length_step}" value="${defaultSettings.file_split_length}" />
            <div class="flex-container spaceEvenly">
                <div id="chromadb_inject" title="Upload custom textual data to use in the context of the current chat" class="menu_button">
                    <i class="fa-solid fa-file-arrow-up"></i>
                    <span>Inject Data to the Context (TXT file)</span>
                </div>
                <div id="chromadb_purge" title="Force purge all the data related to the current chat from the database" class="menu_button">
                    <i class="fa-solid fa-broom"></i>
                    <span>Purge Current Chat from the DB</span>
                </div>
            </div>
            <small><i>Since ChromaDB state is not persisted to disk by default, you'll need to inject text data every time the Extras API server is restarted.</i></small>
        </div>
        <form><input id="chromadb_inject_file" type="file" accept="text/plain" hidden></form>
    </div>`;

    $('#extensions_settings').append(settingsHtml);
    $('#chromadb_strategy').on('change', onStrategyChange);
    $('#chromadb_keep_context').on('input', onKeepContextInput);
    $('#chromadb_n_results').on('input', onNResultsInput);
    $('#chromadb_split_length').on('input', onSplitLengthInput);
    $('#chromadb_file_split_length').on('input', onFileSplitLengthInput);
    $('#chromadb_inject').on('click', () => $('#chromadb_inject_file').trigger('click'));
    $('#chromadb_inject_file').on('change', onSelectInjectFile);
    $('#chromadb_purge').on('click', onPurgeClick);

    await loadSettings();
});
