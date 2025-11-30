import { chat, clearChat, event_types, eventSource, printMessages, saveChatDebounced } from '../../../script.js';
import { extension_settings } from '/scripts/extensions.js';
import { t } from '/scripts/i18n.js';
import { addButtons, addSettings } from './ui.js';

export const extensionName = 'ChatUndoHistory';


/** @type {ChatMessage[][]} */
export let chatHistory = [];
export let chatHistoryIndex = 0;

class ChatHistory {
    /**
     *
     * @param {ChatMessage[]} chatData or ChatTree.
     */
    constructor(chatData) {
        //chatTree or chat.
        this.chatData = chatData;
        this.chatHistory = [];
        this.chatHistoryIndex = 0;
        this.fullHistoryInterval = 0;

        //Reset chatHistory when the chat has changed.
        eventSource.on(event_types.CHAT_CHANGED,  async () => await this.resetChatSnapshots(false));
    }
    /**
     * Resets chatHistory, and set's the first entry.
     * @param {boolean} toast toast that the has been cleared.
     */
    async resetChatSnapshots(toast){
        this.chatHistory.length = 0;
        this.saveChatSnapshot(false);
        toast && toastr.warning(t`Success, You now have ${this.chatHistory.length} saved chats.`);
    }

    /**
     * Save a copy of chatData to chatHistory.
     * @param {boolean} toast toast that the chat has saved.
     */
    saveChatSnapshot(toast){
        const maximumChatLength = extension_settings[extensionName]?.max_length ?? 512;
        const maximumChatHistoryItems = extension_settings[extensionName]?.max_history ?? 100;


        //Enforce the maximum chat length.
        if (Array.isArray(this.chatData) && this.chatData.length >= maximumChatLength) {
            toast && toastr.error(t`It's in 'Extensions > Chat Undo History > Max chat length'`, t`You cannot save the chat because it's ${this.chatData.length - maximumChatLength} messages longer than your max chat length limit (${maximumChatLength}). (Check Settings.)`);
            return;
        }

        //Enforce the maximum chat history length.
        if (0 >= maximumChatHistoryItems) {
            toast && toastr.error(t`It's in 'Extensions > Chat Undo History > Max Undo History'`, t`You cannot save the chat because your maximum history items is set to ${maximumChatHistoryItems}. (Check Settings.)`);
            return;
        }

        //Enforce the maximum chat History length.
        this.chatHistory.splice(0, this.chatHistory.length - maximumChatHistoryItems + 1);

        //Overwrite history that has been undone.
        this.chatHistory.splice(this.chatHistoryIndex + 1);
    chatHistory.splice(chatHistoryIndex + 1);

        const newFullChat = structuredClone(this.chatData);
        this.chatHistory.push(newFullChat);
    const newChat = structuredClone(chatData);
    chatHistory.push(newChat);
    chatHistoryIndex = chatHistory.length - 1;
    toast && toastr.success(t`Success, You now have ${chatHistory.length} saved chats.`);
        this.chatHistoryIndex = this.chatHistory.length - 1;
        toast && toastr.success(t`Success, You now have ${this.chatHistory.length} saved chats.`);
    }

    /**
     * Load a chat from chatHistory.
     * @param {number} index The chatHistory index to load.
     */
    async loadChatSnapshot(index) {
        const maximumChatLength = extension_settings[extensionName]?.max_length ?? 512;

        //Don't overwrite chats that are longer than maximumChatLength.
        if (chat.length >= maximumChatLength) {
            toastr.error(t`It's in 'Extensions > Chat Undo History > Max chat length'`, t`You cannot load the chat because it's ${chat.length - maximumChatLength} messages longer than your max chat length limit (${maximumChatLength}). (Check Settings.)`);
            return;
        }

        if (this.chatHistory[index]) {
            this.chatHistoryIndex = index;

            const newChat = structuredClone(this.chatHistory[this.chatHistoryIndex]);
            const oldChatLength = chat.length;

            //Replace the chat.
            chat.splice(0, oldChatLength, ...newChat);

            clearChat();
            printMessages();

            await eventSource.emit(event_types.CHAT_SNAPSHOT_LOADED, index);

            if (newChat.length > oldChatLength) { await eventSource.emit(event_types.MESSAGE_RECEIVED, undefined, 'undo'); }
            if (newChat.length < oldChatLength) { await eventSource.emit(event_types.MESSAGE_DELETED, undefined, 'undo'); }

            toastr.success(`Chat ${this.chatHistoryIndex + 1}/${this.chatHistory.length} has been loaded.`);

            saveChatDebounced();
        }
        else {
            toastr.error(`Chat ${index + 1}/${this.chatHistory.length} does not exist!`);
        }
    }
    async loadPreviousSnapshot() {
        await this.loadChatSnapshot(this.chatHistoryIndex - 1)
    }
    async loadNextSnapshot() {
        await this.loadChatSnapshot(this.chatHistoryIndex + 1)
    }
}

export const chatHistory = new ChatHistory(chat)

//Snapshot the chat when a message is modified.
export const snapshotEvents = [
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

jQuery(async () => {
    await addButtons();
    await addSettings();
});
