import { chat, clearChat, event_types, eventSource, printMessages, saveChatDebounced } from '/script.js';
import { extension_settings } from '/scripts/extensions.js';
import { t } from '/scripts/i18n.js';
import { addOptionsButtons, addSettings } from './ui.js';
import { diff, lodash } from '/lib.js';
import { applyDelta } from './applyDelta.js';
import { debounce_timeout } from '/scripts/constants.js';

export const extensionName = 'undo';
export const defaultMaxUndoSnapshots = 10000;
export const defaultMaxChatLength = 500;
export const defaultSaveDebounceDuration = debounce_timeout.short;
export const defaultShowToasts = true;

class ChatHistory {
    /**
     * ChatHistory is meant to store an undo history, it's inefficient for most other purposes.
     * A read or write to the chatHistory scales at O(n) where n="distance from chatHistoryIndex".
     * Here, the offset is always 1.
     * During normal usage, The memory use of chatHistory will be 2*chat, regardless of how many undo history entries are stored.
     * In comparison, storing full copies of the chat would require much higher memory usage (historyLength*chat), but would scale at O(1).
     * Much lower memory use is easily worth the slightly higher read/write time.
     * @param {ChatMessage[]} chatData or ChatTree.
     */
    constructor(chatData) {
        //chatTree or chat.
        this.chatData = chatData;
        /** @type {ChatMessage[][]|object[]} Only the chat at indexChat is a chatMessage[], the rest are diffs. */
        this.chatHistory = [];
        /** This should only be set by stepIndex. */
        this.chatHistoryIndex = 0;
        /** @type {() => ChatMessage[]} Chat, or chatTree at the current Index */
        this.indexChat = () => {return this.chatHistory[this.chatHistoryIndex];};

        //Reset chatHistory when the chat has changed.
        eventSource.on(event_types.CHAT_CHANGED,  async () => await this.resetChatSnapshots(false));
    }
    /**
     * Regenerates the full chat of an adjacent diff.
     * @param {-1|1} offset index -1 or +1.
     * @param {object} [fullChat=this.indexChat()] this.indexChat() by default.
     * @param {number} [fullChatIndex=this.indexChat()] The id of fullChat, chatHistoryIndex by default.
     * @returns {object} The full chat at the offset, or nothing.
     */
    adjacentChat(offset = 1, fullChat = this.indexChat(), fullChatIndex = this.chatHistoryIndex) {
        const offsetId = fullChatIndex + offset;
        const offsetChatDiff = this.chatHistory[offsetId];
        if (typeof(offsetChatDiff) == 'object') {
            return applyDelta(structuredClone(fullChat), structuredClone(offsetChatDiff));
        }
    }

    /**
     * Steps, moving chatHistoryIndex. forwards or backwards.
     * In chatHistory, the chat at chatHistoryIndex is the only full copy.
     * When chatHistoryIndex moves, the adjacent diffs are recreated on the new index.
     * Returns the chat at offset, if it exists.
     * @param {-1|1} offset index -1 or +1.
     * @param {ChatMessage[]} newChatData This defaults to the chat at offset.
     * @returns {object} The new chat at offset.
     */
    stepIndex(offset = 1, newChatData = undefined) {

        //The next chat over must also be updated, it's based on the chat that's about to be written.
        const nextChat = this.adjacentChat(offset);
        newChatData ??= nextChat;
        if (typeof(newChatData) !== 'object') {
            //The diffs cannot be based upon nothing.
            throw new Error(t`Cannot step! Offset ${offset} from ${this.chatHistoryIndex} cannot be updated if the newChatData doesn't exist.`);
        }


        //The current indexChat will be replaced with it's diff.
        const currentChat = this.indexChat();
        const currentChatDiff = structuredClone(diff(newChatData, currentChat));

        this.chatHistory[this.chatHistoryIndex] = currentChatDiff;

        //This shifts the relative positions. e.g., nextChat is now indexChat, currentChat is now the previous chat..
        this.chatHistoryIndex += offset;

        //If the nextChat (now indexChat) as changed, then it's adjacentChat must be updated.
        if (typeof(nextChat) !== 'undefined' && !(nextChat === newChatData)) {
            //If the offset diff does not exist, this will do nothing.
            this.updateOffset(newChatData, offset, nextChat);
        }
        //Write the newChatData, both diffs are based upon this.
        this.chatHistory[this.chatHistoryIndex] = newChatData;
        return newChatData;
    }

    /**
     * Updates the previous or next chat with the newChatData, if it exists.
     * This does not update chatHistoryIndex or the indexChat.
     * Using this function without updating indexChat leaves the offsetChat ungettable.
     * @param {object} newChatData The offset diffs will be created against newChatData.
     * @param {-1|1} offset index -1 or +1.
     * @param {object} fullChat The full chat that the diff was originally created from.
     * @returns {object} The full chat at the offset, or nothing.
     */
    updateOffset(newChatData, offset = 1, fullChat = this.indexChat()) {
        if (typeof(fullChat) !== 'object') {
            throw new Error(t`The chat offset ${offset} from ${this.chatHistoryIndex} cannot be updated if the fullChat it was created with does not exist.`);
        }

        //Create the offsetChat from by updating the fullChat with the diff.
        const offsetChat = this.adjacentChat(offset, fullChat);
        if (typeof(offsetChat) == 'object') {
            //Create a diff from the newChatData and offsetChat, overwrite the old diff.
            const updatedPreviousDiff = structuredClone(diff(newChatData, offsetChat));
            this.chatHistory[this.chatHistoryIndex - offset] = updatedPreviousDiff;
            return offsetChat;
        }
    }

    /**
     * Resets chatHistory, and set's the first entry.
     * @param {boolean} showToast toast that the has been cleared.
     */
    async resetChatSnapshots(showToast){
        this.chatHistory.length = 0;
        this.chatHistoryIndex = 0;

        this.chatHistory = [structuredClone(this.chatData)];
        showToast && toastr.warning(t`You now have ${this.chatHistory.length} snapshots.`, t`Success.`, { preventDuplicates: true });
    }

    /**
     * Save a copy of chatData to chatHistory to chatHistoryIndex + 1.
     * @param {boolean} showToast toast that the chat has saved.
     */
    async saveChatSnapshot(showToast){
        const t1 = performance.now();
        const maxUndoSnapshots = extension_settings[extensionName]?.max_snapshots ?? defaultMaxUndoSnapshots;
        const maxChatLength = extension_settings[extensionName]?.max_length ?? defaultMaxChatLength;


        //Enforce the maximum chat length.
        if (Array.isArray(this.chatData) && this.chatData.length > maxChatLength) {
            showToast && toastr.error(t`It's in 'Extensions > Chat Undo History > Max chat length'`, t`You cannot save the chat because it's ${this.chatData.length - maxChatLength} messages longer than your max chat length limit (${maxChatLength}). (Check Settings.)`, { preventDuplicates: true });
            return;
        }

        //Max history cannot be less than zero.
        if (0 >= maxUndoSnapshots) {
            showToast && toastr.error(t`It's in 'Extensions > Chat Undo History > Max Undo Snapshots'`, t`You cannot save the chat because your Max Undo Snapshots is set to ${maxUndoSnapshots}. (Check Settings.)`, { preventDuplicates: true });
            return;
        }

        //Currently a full chat.
        const previousChat = this.indexChat();

        //Only save changed chats.
        if (lodash.isEqual(this.chatData, previousChat)) {
            showToast && toastr.warning(t`The chat is unchanged. You still have ${this.chatHistory.length} snapshots.`, t`Warning.`, { preventDuplicates: true });
            return;
        }

        //Overwrite history that has been undone.
        //e.g. If you undo, then start typing, you cannot redo.
        this.chatHistory.splice(this.chatHistoryIndex + 1);

        //Enforce maxChatHistory.
        this.chatHistory.splice(0, this.chatHistory.length - maxUndoSnapshots);

        //Save the full history.
        const currentChat = structuredClone(this.chatData);
        //Save the chat, and replace the previous chat with a diff.
        this.stepIndex(1, currentChat);

        showToast && toastr.success(t`You now have ${this.chatHistory.length} snapshots.`, t`Success.`, { preventDuplicates: true });
        console.debug(t`Saved a chat snapshot in ${(performance.now() - t1) / 1000} seconds.`);
    }

    /**
     * Load the previous or next snapshot.
     * @param {-1|1} offset index -1 or +1.
     * @returns
     */
    async loadChatSnapshot(offset) {
        const t1 = performance.now();
        const showUndoToast = (extension_settings[extensionName]?.show_toasts ?? defaultShowToasts);
        const index = this.chatHistoryIndex + offset;
        const maximumChatLength = extension_settings[extensionName]?.max_length ?? defaultMaxChatLength;

        //Don't overwrite chats that are longer than maximumChatLength.
        if (chat.length > maximumChatLength) {
            toastr.error(t`It's in 'Extensions > Chat Undo History > Max chat length'`, t`You cannot load the chat because it's ${chat.length - maximumChatLength} messages longer than your max chat length limit (${maximumChatLength}). (Check Settings.)`, { preventDuplicates: true });
            return;
        }

        if (typeof(this.chatHistory[index]) !== 'undefined') {

            const newChat = this.stepIndex(offset);
            const oldChatLength = chat.length;

            //Replace the chat.
            chat.splice(0, oldChatLength, ...newChat);

            clearChat();
            printMessages();

            await eventSource.emit(event_types.CHAT_SNAPSHOT_LOADED, index);

            if (newChat.length > oldChatLength) { await eventSource.emit(event_types.MESSAGE_RECEIVED, undefined, 'undo'); }
            if (newChat.length < oldChatLength) { await eventSource.emit(event_types.MESSAGE_DELETED, undefined, 'undo'); }

            showUndoToast && toastr.success(t`Snapshot ${this.chatHistoryIndex + 1}/${this.chatHistory.length} has been loaded.`, t`Success.`, { preventDuplicates: true });

            saveChatDebounced();
        }
        else {
            showUndoToast && toastr.error(t`Snapshot ${index + 1}/${this.chatHistory.length} does not exist!`, t`The snapshot cannot be loaded.`, { preventDuplicates: true });
        }
        console.debug(`Loaded a chat snapshot in ${(performance.now() - t1) / 1000} seconds.`);
    }
    async loadPreviousSnapshot() {
        await this.loadChatSnapshot(-1);
    }
    async loadNextSnapshot() {
        await this.loadChatSnapshot(1);
    }
}

export const chatHistory = new ChatHistory(chat);

//Snapshot the chat when a message is modified.
export const snapshotEvents = [
    // event_types.MESSAGE_SWIPE_ENDED, //Redundant. MESSAGE_RECEIVED is emitted after swipe generate.
    event_types.MESSAGE_SENT,
    event_types.MESSAGE_RECEIVED,
    event_types.MESSAGE_EDITED,
    event_types.MESSAGE_DELETED,
    // event_types.MESSAGE_UPDATED, //Redundant. https://github.com/SillyTavern/SillyTavern/pull/4819#discussion_r2578928658
    event_types.MESSAGE_FILE_EMBEDDED,
    event_types.MESSAGE_REASONING_EDITED,
    event_types.MESSAGE_REASONING_DELETED,
    event_types.MESSAGE_SWIPE_DELETED ];
    //If an event without 'message_' in the name is added, some UI code must be changed.

(async () => {
    await addOptionsButtons();
    await addSettings();
})();
