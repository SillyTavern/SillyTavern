import { chat, clearChat, event_types, eventSource, printMessages } from '../../../script.js';

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
        //Replace the chat.
        chat.splice(0, chat.length, ...structuredClone(chatHistory[chatHistoryIndex]));

        clearChat();
        printMessages();

        // Is this needed?
        // await eventSource.emit(event_types.MESSAGE_DELETED, chat.length);
        // eventSource.emit(event_types.CHAT_CHANGED, getCurrentChatId());

        toastr.success(`Chat ${chatHistoryIndex + 1}/${chatHistory.length} has been loaded.`);

        //Should undo save the chat?
        // saveChat()
    }
    else {
        toastr.error(`Chat ${index + 1}/${chatHistory.length} does not exist!`);
    }
}

function isInputElementInFocus() {
    //return $(document.activeElement).is(":input");
    var focused = $(':focus');
    if (focused.is('input') || focused.is('textarea') || focused.prop('contenteditable') == 'true') {
        if (focused.attr('id') === 'send_textarea') {
            return false;
        }
        return true;
    }
    return false;
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
const snapshotEvents = [event_types.MESSAGE_DELETED, event_types.MESSAGE_EDITED, event_types.MESSAGE_SENT]; //Incomplete list.
snapshotEvents.forEach((type) => {
    eventSource.on(type, () => saveChatSnapshot(chat));
});
