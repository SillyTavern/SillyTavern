// Move chat functions here from script.js (eventually)

import {
    addCopyToCodeBlocks,
    appendMediaToMessage,
    callPopup,
    chat,
    eventSource,
    event_types,
    getCurrentChatId,
    hideSwipeButtons,
    name2,
    saveChatDebounced,
    showSwipeButtons,
} from "../script.js";
import { getBase64Async, humanFileSize, saveBase64AsFile } from "./utils.js";

const fileSizeLimit = 1024 * 1024 * 1; // 1 MB

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

    saveChatDebounced();
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

    saveChatDebounced();
}

/**
 * Adds a file attachment to the message.
 * @param {object} message Message object
 * @returns {Promise<void>}
 */
export async function populateFileAttachment(message, inputId = 'file_form_input') {
    try {
        if (!message) return;
        if (!message.extra) message.extra = {};
        const fileInput = document.getElementById(inputId);
        if (!(fileInput instanceof HTMLInputElement)) return;
        const file = fileInput.files[0];
        if (!file) return;

        // If file is image
        if (file.type.startsWith('image/')) {
            const base64Img = await getBase64Async(file);
            const base64ImgData = base64Img.split(',')[1];
            const extension = file.type.split('/')[1];
            const imageUrl = await saveBase64AsFile(base64ImgData, name2, file.name, extension);
            message.extra.image = imageUrl;
            message.extra.inline_image = true;
        } else {
            const fileText = await file.text();
            message.extra.file = {
                text: fileText,
                size: file.size,
                name: file.name,
            };
        }

    } catch (error) {
        console.error('Could not upload file', error);
    } finally {
        $('#file_form').trigger('reset');
    }
}

/**
 * Validates file to make sure it is not binary or not image.
 * @param {File} file File object
 * @returns {Promise<boolean>} True if file is valid, false otherwise.
 */
async function validateFile(file) {
    const fileText = await file.text();
    const isImage = file.type.startsWith('image/');
    const isBinary = /^[\x00-\x08\x0E-\x1F\x7F-\xFF]*$/.test(fileText);

    if (!isImage && file.size > fileSizeLimit) {
        toastr.error(`File is too big. Maximum size is ${humanFileSize(fileSizeLimit)}.`);
        return false;
    }

    // If file is binary
    if (isBinary && !isImage) {
        toastr.error('Binary files are not supported. Select a text file or image.');
        return false;
    }

    return true;
}

export function hasPendingFileAttachment() {
    const fileInput = document.getElementById('file_form_input');
    if (!(fileInput instanceof HTMLInputElement)) return false;
    const file = fileInput.files[0];
    return !!file;
}

/**
 * Displays file information in the message sending form.
 * @returns {Promise<void>}
 */
async function onFileAttach() {
    const fileInput = document.getElementById('file_form_input');
    if (!(fileInput instanceof HTMLInputElement)) return;
    const file = fileInput.files[0];
    if (!file) return;

    const isValid = await validateFile(file);

    // If file is binary
    if (!isValid) {
        $('#file_form').trigger('reset');
        return;
    }

    $('#file_form .file_name').text(file.name);
    $('#file_form .file_size').text(humanFileSize(file.size));
    $('#file_form').removeClass('displayNone');

    // Reset form on chat change
    eventSource.once(event_types.CHAT_CHANGED, () => {
        $('#file_form').trigger('reset');
    });
}

/**
 * Deletes file from message.
 * @param {number} messageId Message ID
 */
async function deleteMessageFile(messageId) {
    const confirm = await callPopup('Are you sure you want to delete this file?', 'confirm');

    if (!confirm) {
        console.debug('Delete file cancelled');
        return;
    }

    const message = chat[messageId];

    if (!message?.extra?.file) {
        console.debug('Message has no file');
        return;
    }

    delete message.extra.file;
    $(`.mes[mesid="${messageId}"] .mes_file_container`).remove();
    saveChatDebounced();
}

/**
 * Opens file from message in a modal.
 * @param {number} messageId Message ID
 */
async function viewMessageFile(messageId) {
    const messageText = chat[messageId]?.extra?.file?.text;

    if (!messageText) {
        console.debug('Message has no file or it is empty');
        return;
    }

    const modalTemplate = $('<div><pre><code></code></pre></div>');
    modalTemplate.find('code').addClass('txt').text(messageText);
    modalTemplate.addClass('file_modal');
    addCopyToCodeBlocks(modalTemplate);

    callPopup(modalTemplate, 'text');
}


/**
 * Inserts a file embed into the message.
 * @param {number} messageId
 * @param {JQuery<HTMLElement>} messageBlock
 * @returns {Promise<void>}
 */
function embedMessageFile(messageId, messageBlock) {
    const message = chat[messageId];

    if (!message) {
        console.warn('Failed to find message with id', messageId);
        return;
    }

    $('#embed_file_input')
        .off('change')
        .on('change', parseAndUploadEmbed)
        .trigger('click');

    async function parseAndUploadEmbed(e) {
        const file = e.target.files[0];
        if (!file) return;

        const isValid = await validateFile(file);

        if (!isValid) {
            $('#file_form').trigger('reset');
            return;
        }

        await populateFileAttachment(message, 'embed_file_input');
        appendMediaToMessage(message, messageBlock);
        saveChatDebounced();
    }
}

jQuery(function () {
    $(document).on('click', '.mes_hide', async function () {
        const messageBlock = $(this).closest('.mes');
        const messageId = Number(messageBlock.attr('mesid'));
        await hideChatMessage(messageId, messageBlock);
    });

    $(document).on('click', '.mes_unhide', async function () {
        const messageBlock = $(this).closest('.mes');
        const messageId = Number(messageBlock.attr('mesid'));
        await unhideChatMessage(messageId, messageBlock);
    });

    $(document).on('click', '.mes_file_delete', async function () {
        const messageBlock = $(this).closest('.mes');
        const messageId = Number(messageBlock.attr('mesid'));
        await deleteMessageFile(messageId);
    });

    $(document).on('click', '.mes_file_open', async function () {
        const messageBlock = $(this).closest('.mes');
        const messageId = Number(messageBlock.attr('mesid'));
        await viewMessageFile(messageId);
    });

    // Do not change. #attachFile is added by extension.
    $(document).on('click', '#attachFile', function () {
        $('#file_form_input').trigger('click');
    });

    $(document).on('click', '.mes_embed', function () {
        const messageBlock = $(this).closest('.mes');
        const messageId = Number(messageBlock.attr('mesid'));
        embedMessageFile(messageId, messageBlock);
    });

    $('#file_form_input').on('change', onFileAttach);
    $('#file_form').on('reset', function () {
        $('#file_form').addClass('displayNone');
    });
})
