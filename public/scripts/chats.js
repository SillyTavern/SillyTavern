// Move chat functions here from script.js (eventually)

import {
    chat,
    getCurrentChatId,
    hideSwipeButtons,
    saveChatConditional,
    showSwipeButtons,
} from "../script.js";

/**
 * Mark message as hidden (system message).
 * @param {number} messageId Message ID
 * @param {JQuery<Element>} messageBlock Message UI element
 * @returns
 */
export async function hideChatMessage(messageId, messageBlock) {
    const chatId = getCurrentChatId();

    if (!chatId || isNaN(messageId)) return;

    const message = chat[messageId];

    if (!message) return;

    message.is_system = true;
    messageBlock.attr('is_system', String(true));

    // Reload swipes. Useful when a last message is hidden.
    hideSwipeButtons();
    showSwipeButtons();

    await saveChatConditional();
}

/**
 * Mark message as visible (non-system message).
 * @param {number} messageId Message ID
 * @param {JQuery<Element>} messageBlock Message UI element
 * @returns
 */
export async function unhideChatMessage(messageId, messageBlock) {
    const chatId = getCurrentChatId();

    if (!chatId || isNaN(messageId)) return;

    const message = chat[messageId];

    if (!message) return;

    message.is_system = false;
    messageBlock.attr('is_system', String(false));

    // Reload swipes. Useful when a last message is hidden.
    hideSwipeButtons();
    showSwipeButtons();

    await saveChatConditional();
}

jQuery(function() {
    $(document).on('click', '.mes_hide', async function() {
        const messageBlock = $(this).closest('.mes');
        const messageId = Number(messageBlock.attr('mesid'));
        await hideChatMessage(messageId, messageBlock);
    });

    $(document).on('click', '.mes_unhide', async function() {
        const messageBlock = $(this).closest('.mes');
        const messageId = Number(messageBlock.attr('mesid'));
        await unhideChatMessage(messageId, messageBlock);
    });
})
