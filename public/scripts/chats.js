// Move chat functions here from script.js (eventually)

import css from '../lib/css-parser.mjs';
import {
    addCopyToCodeBlocks,
    appendMediaToMessage,
    callPopup,
    chat,
    eventSource,
    event_types,
    getCurrentChatId,
    getRequestHeaders,
    hideSwipeButtons,
    name2,
    saveChatDebounced,
    showSwipeButtons,
} from '../script.js';
import {
    extractTextFromHTML,
    extractTextFromMarkdown,
    extractTextFromPDF,
    getBase64Async,
    getStringHash,
    humanFileSize,
    saveBase64AsFile,
} from './utils.js';

const fileSizeLimit = 1024 * 1024 * 10; // 10 MB

const converters = {
    'application/pdf': extractTextFromPDF,
    'text/html': extractTextFromHTML,
    'text/markdown': extractTextFromMarkdown,
};

function isConvertible(type) {
    return Object.keys(converters).includes(type);
}

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
 * @returns {Promise<void>} A promise that resolves when file is uploaded.
 */
export async function populateFileAttachment(message, inputId = 'file_form_input') {
    try {
        if (!message) return;
        if (!message.extra) message.extra = {};
        const fileInput = document.getElementById(inputId);
        if (!(fileInput instanceof HTMLInputElement)) return;
        const file = fileInput.files[0];
        if (!file) return;

        const fileBase64 = await getBase64Async(file);
        let base64Data = fileBase64.split(',')[1];

        // If file is image
        if (file.type.startsWith('image/')) {
            const extension = file.type.split('/')[1];
            const imageUrl = await saveBase64AsFile(base64Data, name2, file.name, extension);
            message.extra.image = imageUrl;
            message.extra.inline_image = true;
        } else {
            const slug = getStringHash(file.name);
            const uniqueFileName = `${Date.now()}_${slug}.txt`;

            if (isConvertible(file.type)) {
                try {
                    const converter = converters[file.type];
                    const fileText = await converter(file);
                    base64Data = window.btoa(unescape(encodeURIComponent(fileText)));
                } catch (error) {
                    toastr.error(String(error), 'Could not convert file');
                    console.error('Could not convert file', error);
                }
            }

            const fileUrl = await uploadFileAttachment(uniqueFileName, base64Data);

            if (!fileUrl) {
                return;
            }

            message.extra.file = {
                url: fileUrl,
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
 * Uploads file to the server.
 * @param {string} fileName
 * @param {string} base64Data
 * @returns {Promise<string>} File URL
 */
export async function uploadFileAttachment(fileName, base64Data) {
    try {
        const result = await fetch('/api/files/upload', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                name: fileName,
                data: base64Data,
            }),
        });

        if (!result.ok) {
            const error = await result.text();
            throw new Error(error);
        }

        const responseData = await result.json();
        return responseData.path;
    } catch (error) {
        toastr.error(String(error), 'Could not upload file');
        console.error('Could not upload file', error);
    }
}

/**
 * Downloads file from the server.
 * @param {string} url File URL
 * @returns {Promise<string>} File text
 */
export async function getFileAttachment(url) {
    try {
        const result = await fetch(url, {
            method: 'GET',
            cache: 'force-cache',
            headers: getRequestHeaders(),
        });

        if (!result.ok) {
            const error = await result.text();
            throw new Error(error);
        }

        const text = await result.text();
        return text;
    } catch (error) {
        toastr.error(error, 'Could not download file');
        console.error('Could not download file', error);
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
    if (isBinary && !isImage && !isConvertible(file.type)) {
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
    const messageFile = chat[messageId]?.extra?.file;

    if (!messageFile) {
        console.debug('Message has no file or it is empty');
        return;
    }

    const fileText = messageFile.text || (await getFileAttachment(messageFile.url));

    const modalTemplate = $('<div><pre><code></code></pre></div>');
    modalTemplate.find('code').addClass('txt').text(fileText);
    modalTemplate.addClass('file_modal');
    addCopyToCodeBlocks(modalTemplate);

    callPopup(modalTemplate, 'text', '', { wide: true, large: true });
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

/**
 * Appends file content to the message text.
 * @param {object} message Message object
 * @param {string} messageText Message text
 * @returns {Promise<string>} Message text with file content appended.
 */
export async function appendFileContent(message, messageText) {
    if (message.extra?.file) {
        const fileText = message.extra.file.text || (await getFileAttachment(message.extra.file.url));

        if (fileText) {
            const fileWrapped = `\`\`\`\n${fileText}\n\`\`\`\n\n`;
            message.extra.fileLength = fileWrapped.length;
            messageText = fileWrapped + messageText;
        }
    }
    return messageText;
}

/**
 * Replaces style tags in the message text with custom tags with encoded content.
 * @param {string} text
 * @returns {string} Encoded message text
 * @copyright https://github.com/kwaroran/risuAI
 */
export function encodeStyleTags(text) {
    const styleRegex = /<style>(.+?)<\/style>/gms;
    return text.replaceAll(styleRegex, (_, match) => {
        return `<custom-style>${escape(match)}</custom-style>`;
    });
}

/**
 * Sanitizes custom style tags in the message text to prevent DOM pollution.
 * @param {string} text Message text
 * @returns {string} Sanitized message text
 * @copyright https://github.com/kwaroran/risuAI
 */
export function decodeStyleTags(text) {
    const styleDecodeRegex = /<custom-style>(.+?)<\/custom-style>/gms;

    return text.replaceAll(styleDecodeRegex, (_, style) => {
        try {
            const ast = css.parse(unescape(style));
            const rules = ast?.stylesheet?.rules;
            if (rules) {
                for (const rule of rules) {

                    if (rule.type === 'rule') {
                        if (rule.selectors) {
                            for (let i = 0; i < rule.selectors.length; i++) {
                                let selector = rule.selectors[i];
                                if (selector) {
                                    let selectors = (selector.split(' ') ?? []).map((v) => {
                                        if (v.startsWith('.')) {
                                            return '.custom-' + v.substring(1);
                                        }
                                        return v;
                                    }).join(' ');

                                    rule.selectors[i] = '.mes_text ' + selectors;
                                }
                            }
                        }
                    }
                }
            }
            return `<style>${css.stringify(ast)}</style>`;
        } catch (error) {
            return `CSS ERROR: ${error}`;
        }
    });
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

    $(document).on('click', '.editor_maximize', function () {
        const broId = $(this).attr('data-for');
        const bro = $(`#${broId}`);
        const withTab = $(this).attr('data-tab');

        if (!bro.length) {
            console.error('Could not find editor with id', broId);
            return;
        }

        const wrapper = document.createElement('div');
        wrapper.classList.add('height100p', 'wide100p', 'flex-container');
        wrapper.classList.add('flexFlowColumn', 'justifyCenter', 'alignitemscenter');
        const textarea = document.createElement('textarea');
        textarea.value = String(bro.val());
        textarea.classList.add('height100p', 'wide100p');
        textarea.addEventListener('input', function () {
            bro.val(textarea.value).trigger('input');
        });
        wrapper.appendChild(textarea);

        if (withTab) {
            textarea.addEventListener('keydown', (evt) => {
                if (evt.key == 'Tab' && !evt.shiftKey && !evt.ctrlKey && !evt.altKey) {
                    evt.preventDefault();
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    if (end - start > 0 && textarea.value.substring(start, end).includes('\n')) {
                        const lineStart = textarea.value.lastIndexOf('\n', start);
                        const count = textarea.value.substring(lineStart, end).split('\n').length - 1;
                        textarea.value = `${textarea.value.substring(0, lineStart)}${textarea.value.substring(lineStart, end).replace(/\n/g, '\n\t')}${textarea.value.substring(end)}`;
                        textarea.selectionStart = start + 1;
                        textarea.selectionEnd = end + count;
                    } else {
                        textarea.value = `${textarea.value.substring(0, start)}\t${textarea.value.substring(end)}`;
                        textarea.selectionStart = start + 1;
                        textarea.selectionEnd = end + 1;
                    }
                } else if (evt.key == 'Tab' && evt.shiftKey && !evt.ctrlKey && !evt.altKey) {
                    evt.preventDefault();
                    const start = textarea.selectionStart;
                    const end = textarea.selectionEnd;
                    const lineStart = textarea.value.lastIndexOf('\n', start);
                    const count = textarea.value.substring(lineStart, end).split('\n\t').length - 1;
                    textarea.value = `${textarea.value.substring(0, lineStart)}${textarea.value.substring(lineStart, end).replace(/\n\t/g, '\n')}${textarea.value.substring(end)}`;
                    textarea.selectionStart = start - 1;
                    textarea.selectionEnd = end - count;
                }
            });
        }

        callPopup(wrapper, 'text', '', { wide: true, large: true });
    });

    $(document).on('click', 'body.documentstyle .mes .mes_text', function () {
        if ($('.edit_textarea').length) return;
        $(this).closest('.mes').find('.mes_edit').trigger('click');
    });

    $('#file_form_input').on('change', onFileAttach);
    $('#file_form').on('reset', function () {
        $('#file_form').addClass('displayNone');
    });
});
