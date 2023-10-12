import { openCharacterChat, addOneMessage, event_types, eventSource, } from "../../../../script.js";
import { power_user } from "../../../power-user.js";
import { createBranch } from "../../../bookmarks.js"
import { getTokenCount } from "../../../tokenizers.js";
import { getContext } from "../../../extensions.js";
import { debounce } from "../../../utils.js";


const saveChatDebounced = debounce(() => getContext().saveChat(), 2000);


/**
 * Navigates to a specific chat message in a chat session by adjusting the scroll position.
 * If the message is not initially visible, the function attempts to reveal it either by 
 * showing hidden messages or by triggering a button to load more messages.
 * Optionally, the function can create a new branch based on the message or navigate to 
 * a specific swipe associated with the message.
 * 
 * @param {string} chatSessionName - Name of the chat session file (can include .jsonl extension).
 * @param {number} messageId - ID of the message to navigate to.
 * @param {number} [swipeId=-1] - Optional ID of a swipe associated with the message. If provided and >= 0, 
 *                                the function navigates to the swipe after potentially creating a new branch.
 * @param {boolean} [branch=false] - If true, creates a new branch based on the message and navigates to it.
 * @returns {Promise<void>} Resolves once the navigation is complete.
 * 
 * Behavior:
 * 1. Opens the specified chat session.
 * 2. Attempts to find and scroll to the message with the given ID.
 * 3. If the message is not visible, reveals hidden messages or triggers loading of more messages.
 * 4. If the `branch` parameter is true, creates a new branch based on the message and navigates to it.
 * 5. If `swipeId` is provided and >= 0, navigates to the associated swipe after potentially creating a new branch.
 */

export async function navigateToMessage(chatSessionName, messageId, swipeId=-1, branch=false) {

    // Remove extension from file name
    chatSessionName = chatSessionName.replace('.jsonl', '');
    await openCharacterChat(chatSessionName);
    

    let message = $(`div[mesid=${messageId - 1}]`); // Select the message div by the messageId
    let chat = $("#chat");

    // Check if the message is not visible if not, check for show_more_messages button
    while (!message.is(':visible')) {

        console.log(`Message with id "${messageId}" is not visible.`)
        // Show hidden messages if they exist
        if (chat.children('.mes').not(':visible').length > 0) {
            console.log(`Showing hidden messages.`)
            const prevHeight = chat.prop('scrollHeight');
            chat.children('.mes').not(':visible').slice(-power_user.lazy_load).show();
            const newHeight = chat.prop('scrollHeight');
            chat.scrollTop(newHeight - prevHeight);

            // Re-select the message after showing hidden ones to see if it's now visible
            message = $(`div[mesid=${messageId - 1}]`);
        } else {
            // If no hidden messages exist, check for show_more_messages div anywhere in the page
            const showMoreBtn = $('#show_more_messages');
            if (showMoreBtn.length) {
                console.log(`Showing more messages.`)
                showMoreBtn.trigger('mouseup');
                // Re-select the message after showing more messages to see if it's now visible
                message = $(`div[mesid=${messageId - 1}]`);
            } else {
                // If no hidden messages exist and no show_more_messages button exists, the message is not visible
                console.log(`Message with id "${messageId}" not found.`);
                closeOpenDrawers();
                return;
            }
        }
    }
    if( branch ) {
        let name = await createBranch(messageId-1);
        await openCharacterChat(name);
        closeOpenDrawers();
        return
    }
    if (swipeId >= 0) {
        let name = await createBranch(messageId-1);
        await openCharacterChat(name);
        goToSwipe(swipeId, messageId-1);
        closeOpenDrawers();
        return
    }
    // If message is visible, adjust the scroll position to it
    if (message.length) {
        // calculate the position by adding the container's current scrollTop to the message's position().top
        let scrollPosition = chat.scrollTop() + message.position().top;
        chat.animate({ scrollTop: scrollPosition }, 500);  // scroll over half a second
    } else {
        console.log(`Message with id "${messageId}" not found.`);
    }
    closeOpenDrawers();
}

/**
 * Closes any open drawers that are not pinned.
 * It also toggles the display icons and manages the animation during the transition.
 */
export function closeOpenDrawers() {
    var openDrawers = $('.openDrawer').not('.pinnedOpen');

    openDrawers.addClass('resizing').slideToggle(200, "swing", function () {
        $(this).closest('.drawer-content').removeClass('resizing');
    });

    $('.openIcon').toggleClass('closedIcon openIcon');
    openDrawers.toggleClass('closedDrawer openDrawer');
}

/**
 * Close the modal with ID "myModal".
 * It ensures the modal is returned to its original position in the DOM when closed.
 */
export function closeModal() {
    let modal = document.getElementById("myModal");

    if (!modal) {
        console.error('Modal not found!');
        return;
    }

    // Append the modal back to its original parent when closed
    document.querySelector('.timeline-view-settings_block').appendChild(modal);
    modal.style.display = "none";
}

/**
 * Manages the display state and behavior of the modal with ID "myModal".
 * - Appends the modal to the body and shows it when called.
 * - Appends the modal back to its original parent in the DOM when it's closed.
 * - Closes the modal either by clicking its close button or clicking outside of it.
 */
export function handleModalDisplay() {
    let modal = document.getElementById("myModal");

    // Ensure that modal exists
    if (!modal) {
        console.error('Modal not found!');
        return;
    }

    let closeBtn = modal.getElementsByClassName("close")[0];

    // Ensure that close button exists
    if (!closeBtn) {
        console.error('Close button not found!');
        return;
    }
    

    function closeTippy() {
        // If Tippy uses a specific class or attribute, you can target it more precisely
        let tippyBoxes = document.querySelectorAll('.tippy-box');

        tippyBoxes.forEach(box => {
            let parent = box.parentElement;
            if (parent && parent._tippy) {
                parent._tippy.hide();
            }
        });
    }


    closeBtn.onclick = function () {
        // Append the modal back to its original parent when closed
        document.querySelector('.timeline-view-settings_block').appendChild(modal);
        modal.style.display = "none";
        closeTippy();  // Hide the Tippy tooltip
    }

    window.onclick = function (event) {
        if (event.target == modal) {
            // Append the modal back to its original parent when clicked outside
            document.querySelector('.timeline-view-settings_block').appendChild(modal);
            modal.style.display = "none";
            closeTippy();  // Hide the Tippy tooltip
        }
    }

    // Append the modal to the body when showing it
    document.body.appendChild(modal);
    modal.style.display = "block";
}

/**
 * Navigates to a specific swipe within a chat based on the given swipe ID and updates the chat data and UI accordingly.
 * 
 * This function adjusts the chat data to reflect the content of the specified swipe and updates the UI to display it.
 * It also handles edge cases such as swipe ID bounds and potential cleanup of extra properties.
 * 
 * @param {number} targetSwipeId - The ID of the swipe to navigate to.
 * @param {number} message_id - The ID of the message associated with the swipe.
 * @returns {Promise<void>} Resolves once the swipe navigation and associated updates are complete.
 * 
 * Behavior:
 * 1. Sets the desired swipe ID and validates its bounds.
 * 2. Adjusts the chat data to reflect the content of the specified swipe.
 * 3. Updates the UI to display the new message data.
 * 4. Optionally updates the token count for the message if enabled.
 * 5. Emits a 'MESSAGE_SWIPED' event and saves the chat data.
 */

async function goToSwipe(targetSwipeId, message_id) {
    let chat = getContext().chat;
 
    // Set the desired swipe ID
    chat[chat.length - 1]['swipe_id'] = targetSwipeId;

    // Validate swipe ID bounds
    if (chat[chat.length - 1]['swipe_id'] < 0) {
        chat[chat.length - 1]['swipe_id'] = chat[chat.length - 1]['swipes'].length - 1;
    }
    console.log(chat[chat.length - 1]);
    if (chat[chat.length - 1]['swipe_id'] >= chat[chat.length - 1]['swipes'].length) {
        chat[chat.length - 1]['swipe_id'] = 0; // Reset to first if exceeding bounds
    }

    // Update chat data based on the new swipe ID
    if (!Array.isArray(chat[chat.length - 1]['swipe_info'])) {
        chat[chat.length - 1]['swipe_info'] = [];
    }

    chat[chat.length - 1]['mes'] = chat[chat.length - 1]['swipes'][chat[chat.length - 1]['swipe_id']];
    chat[chat.length - 1]['send_date'] = chat[chat.length - 1].swipe_info[chat[chat.length - 1]['swipe_id']]?.send_date || chat[chat.length - 1].send_date;
    chat[chat.length - 1]['extra'] = JSON.parse(JSON.stringify(chat[chat.length - 1].swipe_info[chat[chat.length - 1]['swipe_id']]?.extra || chat[chat.length - 1].extra));

    // Clean up any extra properties if needed
    if (chat[chat.length - 1].extra) {
        if (chat[chat.length - 1].extra.memory) delete chat[chat.length - 1].extra.memory;
        if (chat[chat.length - 1].extra.display_text) delete chat[chat.length - 1].extra.display_text;
    }

    // Update UI with the new message data
    addOneMessage(chat[chat.length - 1], { type: 'swipe' });

    // Update token count if enabled
    if (power_user.message_token_count_enabled) {
        const swipeMessage = $("#chat").find(`[mesid="${message_id}"]`);
        const tokenCount = getTokenCount(chat[chat.length - 1].mes, 0);
        chat[chat.length - 1]['extra']['token_count'] = tokenCount;
        swipeMessage.find('.tokenCounterDisplay').text(`${tokenCount}t`);
    }
    await eventSource.emit(event_types.MESSAGE_SWIPED, (chat.length - 1));
    saveChatDebounced();
}