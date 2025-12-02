import { chat } from '../script.js';
import { eventSource, event_types } from './events.js';
import { t } from './i18n.js';
import { Popup } from './popup.js';
import { power_user } from './power-user.js';
import { accountStorage } from './util/AccountStorage.js';

// https://codegolf.stackexchange.com/a/141220 console.log((f=_=>eval(`try{-~f()}catch(e){}`))())
// The stack limit differs per browser, 3000 is safe.
export const stackLimit = 3000;
export const warnInterval = 10;
export const warnLimit = stackLimit - 100;

const limitKey = 'chatTreeStackLimitNoticeShown';

let seenLimitToast = false;

//Show the notice once per chat.
eventSource.on(event_types.CHAT_CHANGED, ()=> {
    seenLimitToast = false;
});

export class Tree {
    /**
     *
     * @param {ChatTree} tree The initial chatTree.
     * @param {boolean} active If true, events will effect the tree.
     */
    constructor(tree = {}, active = true) {
        /** @type {ChatTree} */
        this.chatTree = tree;
        this.active = active;

        if (this.active) {
            eventSource.on(event_types.MESSAGE_SWIPE_DELETED, async ({ messageId, swipeId, newSwipeId }) => {
                if (this.enabled()) {
                    messageId = Number(messageId);
                    swipeId = Number(swipeId);
                    newSwipeId = Number(newSwipeId);
                    await this.deleteBranch(chat, messageId, swipeId, newSwipeId);
                }
            });
            //Warn the user if the chatTree will be disabled soon.
            eventSource.on(event_types.MESSAGE_SENT, () => this.handleMessage.call(this));
            eventSource.on(event_types.MESSAGE_RECEIVED, () => this.handleMessage.call(this));
        }
    }

    /**
     * Show the limit popups once.
     */
    limitPopup() {
        let seenLimitPopup = accountStorage.getItem(limitKey);
        if (!seenLimitToast) {
            toastr.error(t`'Swiping on all messages' has been disabled.`,`The message limit of ${stackLimit} has been reached.`);
            seenLimitToast = true;
        }
        if (!seenLimitPopup) {
            Popup.show.text(t`Swiping on all messages has been disabled due to the browser stack limit.`, t`Your old branches still exist. you may delete messages, or fork the chat to access them. If you encounter this limit often, let us know.`);
            seenLimitPopup = 'true';
            accountStorage.setItem(limitKey, seenLimitPopup);
        }
    }
    /**
     * Warn the user before showing a popup.
     */
    handleMessage() {
        if (this.active && this.toggled()) {
            if (chat.length >= stackLimit) {
                this.limitPopup();
            }
            //Show the warn limit once every 10 messages.
            else if (chat.length >= warnLimit && (chat.length % warnInterval == 0)) {
                toastr.warning(t`Soon, only the last message will be swipeable.`,t`You are nearing the 'Show Swipes for all messages' limit of ${stackLimit}.`);
            }
        }
    }

    /**
     * Returns power_user.enable_chat_tree if this is an active chatTree.
     * See renameGroupMember.
     * @returns {boolean}
     */
    toggled() {
        return !this.active || power_user.enable_chat_tree;
    }
    /**
     * Returns true if the the chatTree is enabled, or it's not active.
     * @returns {boolean}
     */
    enabled() {
        return !this.active || ( this.toggled() && chat.length <= stackLimit);
    }

    /**
     * Sets the chatTree if (power_user.enable_chat_tree == true).
     * @param {ChatTree} newTree
     * @returns {ChatTree}
     */
    setChatTree(newTree) {
        //This is allowed regardless of the stackLimit.
        if (this.toggled()) {
            this.chatTree = newTree;
            return this.chatTree;
        }
    }

    /**
     * Save the Chat to the chatTree.
     * @param {ChatMessage[]} chat
     * @param {Object} [params={}] - Optional parameters.
     * @param {number} [params.start=0] The first message to save. Modifying start may cause an invalid tree.
     * @param {object} [params.end=chat.length] The last message to save, Everything below will be deleted.
     */
    async saveChatToTree(chat, { start = 0, end = chat.length - 1 } = {}) {

        this.chatTree ??= this.setChatTree({});

        //Track the current branch
        let branch = this.chatTree;

        function addMessage(branch, branch_id, message)
        {
            branch['branch'][branch_id] ??= {};
            Object.assign(branch['branch'][branch_id], message);
        }

        const startTime = performance.now();
        const partialChat = chat.slice(0, end + 1);
        // Traverse the tree following the chat's path.
        for (const chatMessage of partialChat) { //This will cause all branches after end to be deleted.
            console.assert(typeof branch !== 'undefined', 'The branch must exist.');

            //Default to the first swipe.
            let branch_id = Number(chatMessage['swipe_id'] ?? 0);
            console.assert(typeof branch_id !== 'undefined', 'The branch_id must exist.');
            branch['branch_id'] = branch_id;

            branch['branch'] ??= [];

            //Save only the messages between start and end.
            if (start <= chat.indexOf(chatMessage)) {

                // eslint-disable-next-line no-unused-vars
                const { swipes:_s, swipe_info:_si, swipe_id:_sid, ...swipelessMessage } = { ...chatMessage };

                //There must be at least as many messages as branch_id
                console.assert(branch_id <= (chatMessage['swipes']?.length ?? 0), 'There must be at least as many messages as branch_id');

                //For each swipe, update a branch. This may run zero times.
                chatMessage?.['swipes']?.forEach((swipe, i) => {

                    // There must be at least a message for every swipe_info.
                    console.assert((chatMessage['swipe_info']?.length ?? 0) <= (chatMessage['swipes']?.length ?? 0), 'There must be at least a message for every swipe_info.');

                    //branch = Full Message < swipe_info < Swipe message.
                    addMessage(branch, i, { ...swipelessMessage, ...chatMessage?.swipe_info?.[i], mes: swipe });
                });

                //Set the full message while preserving branches.
                addMessage(branch, branch_id, { ...swipelessMessage });
            }

            //Follow the branch.
            branch = branch['branch'][branch_id];
        }

        //Prune deleted branch, A branch cannot be empty.
        if (typeof(branch['branch_id']) == 'number') {
            console.log('Pruning deleted branch.', branch);
            delete branch['branch_id'];
            delete branch['branch'];
        }

        const endTime = performance.now();
        console.log(`Saved ${chat.length} messages to chatTree in ${(endTime - startTime) / 1000} seconds`);
    }

    /**
     * Returns the chat after a given index, following swipe_id.
     * @param {ChatMessage[]} chat
     * @param {number} index - The starting index in the chat array
     * @returns {Promise<Array>} - A stick is a stripped branch. The flattened chat array after the index.
     */
    async getStick(chat, index) {

        //Accumulates messages.
        const stick = [];

        //Track current branch
        let branch = this.chatTree;

        // Traverse the tree following the chat's path.

        let i = 0;
        while (branch['branch']?.length  >= 1) {

            //Follow messages's swipe_id before index, then the branch's branch_id, then the first swipe.
            let branch_id;
            branch_id = Number(((i <= index) ? chat[i]?.['swipe_id'] : branch?.['branch_id']) ?? 0);

            //If the branch exists.
            if (branch['branch']?.[branch_id]) {

                //Add all messages after index to chatBranch.
                if (i >= index) {

                    //Push the message without it's branches.
                    // eslint-disable-next-line no-unused-vars
                    let { branch: _b, branch_id: _bi, ...message } = branch['branch'][branch_id];

                    //Decompress swipe.
                    message['swipes'] = branch['branch'].map((m) => m.mes);
                    message['swipe_id'] = branch_id;
                    message['swipe_info'] = branch['branch'].map((m) =>
                    {
                        return {
                            'send_date': m['send_date'],
                            'gen_started': m['gen_started'],
                            'gen_finished': m['gen_finished'],
                            'extra': m['extra'],
                        };
                    });

                    stick.push(message);
                }

                //Follow the branch.
                branch = branch['branch'][branch_id];
                i++;
            }
            else {
                console.warn(`The expected branch #${branch_id} does not exist.`, branch);
                break;
            }
        }
        return stick;
    }


    /**
     * Update each message in the chatTree. Used for renaming characters.
     * @param {function} updateFunction The function to run on each message.
     * @param {string} attr The attribute for logging.
     */
    async updateMessages(updateFunction, attr = 'value'){

        if (typeof this.chatTree?.['branch_id'] === 'number') {
            const startTime = performance.now();
            let count = 0;

            function updateBranch(branch) {
                if (branch?.length > 0 ) {
                    branch.forEach((m) => {
                        if (updateFunction(m)) { count++; }
                        updateBranch(m['branch']);
                    });
                }
            }

            //Recursively update the chatTree.
            updateBranch(this.chatTree['branch']);
            const endTime = performance.now();
            if (count) {
                console.log(`Updated ${attr} in ${count} of chatTree's messages within ${(endTime - startTime) / 1000} seconds`);
            }
        }
    }


    /**
     * Deletes a branch if it exists.
     * @param {number} mesId
     * @param {number} swipeId
     * @param {number} newSwipeId sets mesId's branch_id.
     */
    async deleteBranch(chat, mesId, swipeId, newSwipeId) {

        //Track current branch
        let branch = this.chatTree;

        let i = 0;
        while (branch['branch']?.length  >= 1) {

            //Follow messages's swipe_id, then the first swipe.
            let branch_id = Number(chat[i]?.['swipe_id'] ?? 0);

            //If the branch exists.
            if (branch['branch']?.[branch_id]) {

                //Add all messages after index to chatBranch.
                if (i == mesId) {

                    console.log(`Deleting branch #${swipeId} at depth ${i}`, branch['branch'][swipeId]);
                    branch['branch'].splice(swipeId, 1);
                    branch['branch_id'] = newSwipeId;
                    break;
                }

                //Follow the branch.
                branch = branch['branch'][branch_id];
                i++;
            }
            else {
                console.warn(`The expected branch #${branch_id} does not exist.`, branch);
                break;
            }
        }
    }
}

/**
 * Splices a branch into the chat.
 * @param {Array} stick
 * @param {Array} chat
 * @param {number} index
 */
export async function spliceStickToChat(stick, chat, index = 0) {
    //This will break references after index.
    chat.splice(index, chat.length - index, ...stick);

    eventSource.emit(event_types.MESSAGE_DELETED, chat.length);
}

export const tree = new Tree({}, true);
