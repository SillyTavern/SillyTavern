import { saveSettingsDebounced, getCurrentChatId } from "../../../script.js";
import { getApiUrl, extension_settings } from "../../extensions.js";
import { getFileText, getStringHash, splitRecursive } from "../../utils.js";
export { MODULE_NAME };

const MODULE_NAME = 'chromadb';

const fileSplitLength = 2048;

const defaultSettings = {
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
};

const postHeaders = {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'bypass',
};

async function loadSettings() {
    if (Object.keys(extension_settings.chromadb).length === 0) {
        Object.assign(extension_settings.chromadb, defaultSettings);
    }

    $('#chromadb_keep_context').val(extension_settings.chromadb.keep_context).trigger('input');
    $('#chromadb_n_results').val(extension_settings.chromadb.n_results).trigger('input');
    $('#chromadb_split_length').val(extension_settings.chromadb.split_length).trigger('input');
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
        const currentChatId = getCurrentChatId();
        const text = await getFileText(file);

        const split = splitRecursive(text, fileSplitLength);

        const messages = split.map(m => ({
            id: `${getStringHash(file.name)}-${getStringHash(m)}`,
            role: 'assistant', // probably need a system role?
            content: m,
            date: Date.now(),
            meta: file.name,
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

            toastr.info(`Number of chunks: ${addMessagesData.count}`, 'Injected successfully!');
            return addMessagesData;
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

    if (currentChatId) {
        const messagesToStore = chat.slice(0, -extension_settings.chromadb.keep_context);

        if (messagesToStore.length > 0) {
            await addMessages(currentChatId, messagesToStore);

            const lastMessage = chat[chat.length - 1];

            if (lastMessage) {
                const queriedMessages = await queryMessages(currentChatId, lastMessage.mes);

                queriedMessages.sort((a, b) => a.date - b.date);

                const newChat = queriedMessages.map(m => JSON.parse(m.meta));

                chat.splice(0, messagesToStore.length, ...newChat);

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
            <label for="chromadb_keep_context">How many messages to keep (<span id="chromadb_keep_context_value"></span>)</label>
            <input id="chromadb_keep_context" type="range" min="${defaultSettings.keep_context_min}" max="${defaultSettings.keep_context_max}" step="${defaultSettings.keep_context_step}" value="${defaultSettings.keep_context}" />
            <label for="chromadb_n_results">Max messages to inject (<span id="chromadb_n_results_value"></span>)</label>
            <input id="chromadb_n_results" type="range" min="${defaultSettings.n_results_min}" max="${defaultSettings.n_results_max}" step="${defaultSettings.n_results_step}" value="${defaultSettings.n_results}" />
            <label for="chromadb_split_length">Max length for message chunks (<span id="chromadb_split_length_value"></span>)</label>
            <input id="chromadb_split_length" type="range" min="${defaultSettings.split_length_min}" max="${defaultSettings.split_length_max}" step="${defaultSettings.split_length_step}" value="${defaultSettings.split_length}" />
            <div id="chromadb_inject" title="Upload custom textual data to use in the context of the current chat" class="menu_button">
                <i class="fa-solid fa-file-arrow-up"></i>
                <span>Inject data to the context (TXT file)</span>
            </div>
        </div>
        <form><input id="chromadb_inject_file" type="file" accept="text/plain" hidden></form>
    </div>`;

    $('#extensions_settings').append(settingsHtml);
    $('#chromadb_keep_context').on('input', onKeepContextInput);
    $('#chromadb_n_results').on('input', onNResultsInput);
    $('#chromadb_split_length').on('input', onSplitLengthInput);
    $('#chromadb_inject').on('click', () => $('#chromadb_inject_file').trigger('click'));
    $('#chromadb_inject_file').on('change', onSelectInjectFile);

    await loadSettings();
});
