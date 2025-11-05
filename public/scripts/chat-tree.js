import { chat } from '../script.js';
import { eventSource, event_types } from './events.js';
import { power_user } from './power-user.js';

export let chatTree = {};
export function setChatTree(newChat) {
    if (power_user.enable_chat_tree) {
        chatTree = newChat;
        return chatTree;
    }
}


/**
 * Save the Chat to the chatTree.
 * @param {Array} chat
 * @param {object} chatTree
 * @param {Object} [params={}] - Optional parameters.
 * @param {number} [params.start=0] The first message to save. Modifying start may cause an invalid tree.
 * @param {object} [params.end=chat.length] The last message to save, Everything below will be deleted.
 */
export async function saveChatToTree(chat, chatTree, { start = 0, end = chat.length - 1 } = {}) {

    chatTree ??= setChatTree({});

    //Track the current branch
    let branch = chatTree;

    function addMessage(branch, branch_id, message)
    {
        branch['branch'][branch_id] ??= {};
        Object.assign(branch['branch'][branch_id], message);
    }

    const startTime = performance.now();
    // Traverse the tree following the chat's path.
    for (const chatMessage of chat.slice(0, end + 1)) { //This will cause all branches after end to be deleted.
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
            chatMessage['swipes']?.forEach((swipe, i) => {

                // There must be at least a message for every swipe_info.
                console.assert((chatMessage['swipe_info']?.length ?? 0) <= (chatMessage['swipes']?.length ?? 0), 'There must be at least a message for every swipe_info.');

                //branch = Full Message < swipe_info < Swipe message.
                addMessage(branch, i, { ...swipelessMessage, ...chatMessage?.swipe_info[i], mes: swipe });
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
 * @param {object} chatTree
 * @param {Array} chat
 * @param {number} index - The starting index in the chat array
 * @returns {Promise<Array>} - A stick is a stripped branch. The flattened chat array after the index.
 */
export async function getStickFromTree(chatTree, chat, index) {

    //Accumulates messages.
    const stick = [];

    //Track current branch
    let branch = chatTree;

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

/**
 * Update each message in the chatTree. Used for renaming characters.
 * @param {object} tree chatTree.
 * @param {function} updateFunction The function to run on each message.
 * @param {string} attr The attribute for logging.
 */
export async function updateChatTreeMessages(tree, updateFunction, attr = 'value'){

    if (typeof tree?.['branch_id'] === 'number') {
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
        updateBranch(tree['branch']);
        const endTime = performance.now();
        if (count) {
            console.log(`Updated ${attr} in ${count} of chatTree's messages within ${(endTime - startTime) / 1000} seconds`);
        }
    }
}

/**
 * Deletes a branch if it exists.
 * @param {object} tree
 * @param {number} mesId
 * @param {number} swipeId
 * @param {number} newSwipeId sets mesId's branch_id.
 */
export async function deleteBranch(tree, chat, mesId, swipeId, newSwipeId) {

    //Track current branch
    let branch = tree;

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

eventSource.on(event_types.MESSAGE_SWIPE_DELETED, async ({ messageId, swipeId, newSwipeId }) => {
    if (power_user.enable_chat_tree) {
        messageId = Number(messageId);
        swipeId = Number(swipeId);
        newSwipeId = Number(newSwipeId);
        await deleteBranch(chatTree, chat, messageId, swipeId, newSwipeId);
    }
});
