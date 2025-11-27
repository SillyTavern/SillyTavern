import { chat, clearChat, event_types, eventSource, printMessages, saveChatDebounced } from '../../../script.js';
import { debounce_timeout } from '/scripts/constants.js';
import { debounce, isInputElementInFocus } from '/scripts/utils.js';

/** @type {ChatMessage[][]} */
export let chatHistory = [];
export let chatHistoryIndex = 0;

/**
 * Resets chatHistory, and set's the first entry.
 * @param {ChatMessage[]} chatData
 */
export async function resetChatSnapshots(chatData = chat){
    chatHistory.length = 0;
    saveChatSnapshot(chatData);
}

/**
 * Save a copy of chatData to chatHistory.
 * @param {ChatMessage[]} chatData
 */
export function saveChatSnapshot(chatData = chat){
    //Overwrite history that has been undone.
    chatHistory.splice(chatHistoryIndex + 1);

    chatHistory.push(structuredClone(chatData));
    chatHistoryIndex = chatHistory.length - 1;
}

/**
 * Load a chat from chatHistory.
 * @param {number} index The chatHistory index to load.
 */
export async function loadChatSnapshot(index) {
    if (chatHistory[index]) {
        chatHistoryIndex = index;

        const newChat = structuredClone(chatHistory[chatHistoryIndex]);

        //Replace the chat.
        chat.splice(0, chat.length, ...newChat);

        clearChat();
        printMessages();

        await eventSource.emit(event_types.CHAT_SNAPSHOT_LOADED, index);

        if (newChat.length > chat.length) { await eventSource.emit(event_types.MESSAGE_RECEIVED); }
        if (newChat.length < chat.length) { await eventSource.emit(event_types.MESSAGE_DELETED); }

        toastr.success(`Chat ${chatHistoryIndex + 1}/${chatHistory.length} has been loaded.`);

        saveChatDebounced();
    }
    else {
        toastr.error(`Chat ${index + 1}/${chatHistory.length} does not exist!`);
    }
}

$(document).on('keydown', async function (event) {
    if (!isInputElementInFocus()) {
        if ((event.ctrlKey || event.metaKey) && !event.altKey) {
            //Undo.
            event.key === 'z' && await loadChatSnapshot(chatHistoryIndex - 1);
            //Redo.
            event.key === 'Z' && await loadChatSnapshot(chatHistoryIndex + 1);
        }
    }
});

//Reset chatHistory when the chat has changed.
eventSource.on(event_types.CHAT_CHANGED,  async () => await resetChatSnapshots(chat));

//Snapshot the chat when a message is modified.
const snapshotEvents = [
    // event_types.MESSAGE_SWIPE_ENDED, //Redundant? MESSAGE_RECEIVED is emitted after swipe generate.
    event_types.MESSAGE_SENT,
    event_types.MESSAGE_RECEIVED,
    event_types.MESSAGE_EDITED,
    event_types.MESSAGE_DELETED,
    event_types.MESSAGE_UPDATED,
    event_types.MESSAGE_FILE_EMBEDDED,
    event_types.MESSAGE_REASONING_EDITED,
    event_types.MESSAGE_REASONING_DELETED,
    event_types.MESSAGE_SWIPE_DELETED ];

const save = debounce(() => saveChatSnapshot(chat), debounce_timeout.short);
snapshotEvents.forEach((type) => {
    eventSource.on(type, save);
});
