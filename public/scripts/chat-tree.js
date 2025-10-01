import { saveChatConditional, saveChatDebounced, hideSwipeButtons, showSwipeButtons, updateViewMessageIds } from '../script.js';
import { eventSource, event_types } from './events.js';
import { power_user } from './power-user.js';

export let chatTree = {};
export function setChatTree(newChat) {
    if (power_user.show_swipes_for_all_messages) {
        chatTree = newChat;
    }
}


/**
 * Save the Chat to the chatTree.
 * @param {Array} chat
 */
export function saveChatToTree(chat) {

    if (typeof chatTree == 'undefined') {
        chatTree = {};
    }

    //Track the current branch
    let branch = chatTree;

    // Traverse the tree following the chat's path.
    for (const chatMessage of chat) {

        //Default to the first swipe.
        let branch_id = chatMessage['swipe_id'] ?? 0;
        branch['branch_id'] = branch_id;

        if (!Array.isArray(branch['branch'])) {
            branch['branch'] = [];
        }

        // eslint-disable-next-line no-unused-vars
        const { swipes:_s, swipe_info:_si, swipe_id:_sid, ...swipelessMessage } = { ...chatMessage };

        //There must be at least as many messages as branch_id
        console.assert(branch_id <= (chatMessage['swipes']?.length ?? 0), 'There must be at least as many messages as branch_id');

        //For each swipe, update a branch. This may run zero times.
        chatMessage['swipes']?.forEach((swipe, i) => {

            // There must be at least a message for every swipe_info.
            console.assert(chatMessage['swipe_info']?.length <= (chatMessage['swipes']?.length ?? 0), 'There must be at least a message for every swipe_info.');

            //branch = Full Message < swipe_info < Swipe message.
            if (!branch['branch'][i]) {branch['branch'][i] = {};}
            Object.assign(branch['branch'][i], { ...structuredClone(swipelessMessage), ...structuredClone(chatMessage?.swipe_info[i]), mes: swipe } );
        });

        //Set the full message while preserving branches.
        if (!branch['branch'][branch_id]) {branch['branch'][branch_id] = {};}
        Object.assign(branch['branch'][branch_id], {  ...structuredClone(swipelessMessage) });
        //Follow the branch.
        branch = branch['branch'][branch_id];
    }

    //Prune deleted branch.
    if (typeof(branch['branch_id']) == 'number') {
        console.log('Pruning deleted branch.', branch);
        delete branch['branch_id'];
        delete branch['branch'];
    }
}

/**
 * Returns the chat after a given index, following swipe_id.
 * @param {object} chatTree
 * @param {Array} chat
 * @param {number} index - The starting index in the chat array
 * @returns {Array} - A stick is a stripped branch. The flattened chat array after the index.
 */
export function getStickFromTree(chatTree, chat, index) {

    //Accumulates messages.
    const stick = [];

    //Debugging.
    // let branch_path = [];
    // let swipe_path = [];
    // let path = [];

    //Track current branch
    let branch = chatTree;

    // Traverse the tree following the chat's path.

    let i = 0;
    while (branch['branch']?.length  >= 1) {

        //Follow chatMessage's swipe_id, or the branch's swipe_id, or the first swipe.
        let branch_id = chat[i]?.['swipe_id'] ?? branch?.['branch_id'] ?? 0;

        //Debugging.
        // swipe_path.push(chat[i]?.['swipe_id'])
        // branch_path.push(branch?.['branch_id'])
        // path.push(branch_id)

        //If the branch exists.
        if (branch['branch']?.[branch_id]) {

            //Add all messages after index to chatBranch.
            if (i >= index) {

                //Push the message without it's branches.
                // eslint-disable-next-line no-unused-vars
                let { branch: _, ...message } = structuredClone(branch['branch'][branch_id]);

                //Deccompress swipe.
                message['swipes'] = branch['branch'].map((m) => m.mes);
                message['swipe_id'] = branch['branch_id'];
                message['swipe_info'] = branch['branch'].map((m) =>
                {
                    return {
                        'send_date': m['send_date'],
                        'gen_started': m['gen_started'],
                        'gen_finished': m['gen_finished'],
                        'extra': structuredClone(m['extra']),
                    };
                });

                stick.push(message);
            }

            //Follow the branch.
            branch = branch['branch'][branch_id];
            i++;
        }
        else {
            console.warn('The expected branch does not exist.', branch, branch_id);
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
    saveChatConditional();

    updateViewMessageIds(false);
    saveChatDebounced();

    hideSwipeButtons();
    showSwipeButtons();

    eventSource.emit(event_types.MESSAGE_DELETED, chat.length);
}
