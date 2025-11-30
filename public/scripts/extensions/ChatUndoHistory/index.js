import { chat, clearChat, event_types, eventSource, printMessages, saveChatDebounced } from '../../../script.js';
import { extension_settings } from '/scripts/extensions.js';
import { t } from '/scripts/i18n.js';
import { addButtons, addSettings } from './ui.js';
import { applyDiff, diff, lodash } from '/lib.js';

export const extensionName = 'ChatUndoHistory';
export const defaultChunkSize = 20;
export const defaultMaxHistoryChunks = 20;
export const defaultMaxChatLength = 512;

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
        this.fullHistoryInterval = extension_settings[extensionName]?.chunk_size ?? defaultChunkSize;

        //Reset chatHistory when the chat has changed.
        eventSource.on(event_types.CHAT_CHANGED,  async () => await this.resetChatSnapshots(false));
    }
    /**
     * Resets chatHistory, and set's the first entry.
     * @param {boolean} toast toast that the has been cleared.
     */
    async resetChatSnapshots(toast){
        this.chatHistory.length = 0;
        //The history interval size can be safely updated.
        this.fullHistoryInterval = extension_settings[extensionName]?.chunk_size ?? defaultChunkSize;

        this.saveChatSnapshot(false);
        toast && toastr.warning(t`Success, You now have ${this.chatHistory.length} saved chats.`);
    }

    /**
     * Save a copy of chatData to chatHistory.
     * @param {boolean} toast toast that the chat has saved.
     */
    async saveChatSnapshot(toast){
        const t1 = performance.now();
        const max_chunks = extension_settings[extensionName]?.max_chunks ?? defaultMaxHistoryChunks;
        const max_history = max_chunks * this.fullHistoryInterval;
        const max_length = extension_settings[extensionName]?.max_length ?? defaultMaxChatLength;

        //Enforce the maximum chat length.
        if (Array.isArray(this.chatData) && this.chatData.length >= max_length) {
            toast && toastr.error(t`It's in 'Extensions > Chat Undo History > Max chat length'`, t`You cannot save the chat because it's ${this.chatData.length - max_length} messages longer than your max chat length limit (${max_length}). (Check Settings.)`);
            return;
        }

        //Max chunks cannot be less than zero.
        if (0 >= max_chunks) {
            toast && toastr.error(t`It's in 'Extensions > Chat Undo History > Max Undo History Chunks'`, t`You cannot save the chat because your Max Chunks is set to ${max_chunks}. (Check Settings.)`);
            return;
        }

        //Only save changed chats.
        if (this.fullHistoryInterval !== 1 && lodash.isEqual(this.chatData, this.getChatSnapshot(this.chatHistoryIndex))) {
            toast && toastr.warning(t`The chat is unchanged. You still have ${this.chatHistory.length} saved chats.`);
            return;
        }

        //Overwrite history that has been undone.
        this.chatHistory.splice(this.chatHistoryIndex + 1);

        //Enforce max_history in intervals.
        if ((this.chatHistoryIndex % this.fullHistoryInterval) === 0) {
            this.chatHistory.splice(0, this.chatHistory.length - max_history);
        }

        //Set the index to the new location.
        this.chatHistoryIndex = this.chatHistory.length;
        const fullChatOffset = (this.chatHistoryIndex % this.fullHistoryInterval);

        let resultingChat;
        //Save the full history.
        if (fullChatOffset === 0) {
            resultingChat = structuredClone(this.chatData);
        }
        //Save the history diff.
        else {
            //The most recent full chat snapshot.
            const recentFullChat = this.chatHistory[this.chatHistoryIndex - fullChatOffset];
            //Save a partial history.
            resultingChat = diff(recentFullChat, this.chatData);
        }

        this.chatHistory.push(resultingChat);
        toast && toastr.success(t`Success, You now have ${this.chatHistory.length} saved chats.`);
        console.debug(`Saved a chat snapshot in ${(performance.now() - t1) / 1000} seconds.`);
    }

    /**
     * Returns the full chat history at index.
     * @param {number} index
     * @returns
     */
    getChatSnapshot(index) {
        let chat;
        // Return the full snapshot.
        if ((index % this.fullHistoryInterval) == 0) {
            chat = this.chatHistory[index];
        }
        //Create the full snapshot.
        else {
            //The most recent full history snapshot.
            const recentFullChatIndex = (index - (index % this.fullHistoryInterval));
            const recentFullChat = this.chatHistory[recentFullChatIndex];

            const chatDiff = this.chatHistory[index];

            //Return the resulting full history snapshot.
            chat = applyDiff(recentFullChat, chatDiff);
        }
        return structuredClone(chat);
    }

    /**
     * Load a chat from chatHistory.
     * @param {number} index The chatHistory index to load.
     */
    async loadChatSnapshot(index) {
        const t1 = performance.now();
        const maximumChatLength = extension_settings[extensionName]?.max_length ?? 512;

        //Don't overwrite chats that are longer than maximumChatLength.
        if (chat.length >= maximumChatLength) {
            toastr.error(t`It's in 'Extensions > Chat Undo History > Max chat length'`, t`You cannot load the chat because it's ${chat.length - maximumChatLength} messages longer than your max chat length limit (${maximumChatLength}). (Check Settings.)`);
            return;
        }

        if (typeof(this.chatHistory[index]) !== 'undefined') {
            this.chatHistoryIndex = index;

            const newChat = this.getChatSnapshot(this.chatHistoryIndex);
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
        console.debug(`Loaded a chat snapshot in ${(performance.now() - t1) / 1000} seconds.`);
    }
    async loadPreviousSnapshot() {
        await this.loadChatSnapshot(this.chatHistoryIndex - 1);
    }
    async loadNextSnapshot() {
        await this.loadChatSnapshot(this.chatHistoryIndex + 1);
    }
}

export const chatHistory = new ChatHistory(chat);

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
