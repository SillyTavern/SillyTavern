import { deleteAttachment, getDataBankAttachments, getDataBankAttachmentsForSource, getFileAttachment, uploadFileAttachmentToServer } from '../../chats.js';
import { renderExtensionTemplateAsync } from '../../extensions.js';
import { SlashCommand } from '../../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from '../../slash-commands/SlashCommandArgument.js';
import { SlashCommandParser } from '../../slash-commands/SlashCommandParser.js';

/**
 * List of attachment sources
 * @type {string[]}
 */
const TYPES = ['global', 'character', 'chat'];
const FIELDS = ['name', 'url'];

/**
 * Get attachments from the data bank
 * @param {string} [source] Source for the attachments
 * @returns {import('../../chats').FileAttachment[]} List of attachments
 */
function getAttachments(source) {
    if (!source || !TYPES.includes(source)) {
        return getDataBankAttachments(true);
    }

    return getDataBankAttachmentsForSource(source);
}

/**
 * Callback for listing attachments in the data bank.
 * @param {object} args Named arguments
 * @returns {string} JSON string of the list of attachments
 */
function listDataBankAttachments(args) {
    const attachments = getAttachments(args?.source);
    const field = args?.field;
    return JSON.stringify(attachments.map(a => FIELDS.includes(field) ? a[field] : a.url));
}

/**
 * Callback for getting text from an attachment in the data bank.
 * @param {object} args Named arguments
 * @param {string} value Name or URL of the attachment
 * @returns {Promise<string>} Content of the attachment
 */
async function getDataBankText(args, value) {
    if (!value) {
        toastr.warning('No attachment name or URL provided.');
        return;
    }

    const attachments = getAttachments(args?.source);
    const match = (a) => String(a).trim().toLowerCase() === String(value).trim().toLowerCase();
    const fullMatchByURL = attachments.find(it => match(it.url));
    const fullMatchByName = attachments.find(it => match(it.name));
    const attachment = fullMatchByURL || fullMatchByName;

    if (!attachment) {
        toastr.warning('Attachment not found.');
        return;
    }

    const content = await getFileAttachment(attachment.url);
    return content;
}

/**
 * Callback for adding an attachment to the data bank.
 * @param {object} args Named arguments
 * @param {string} value Content of the attachment
 * @returns {Promise<string>} URL of the attachment
 */
async function uploadDataBankAttachment(args, value) {
    const source = args?.source && TYPES.includes(args.source) ? args.source : 'chat';
    const name = args?.name || new Date().toLocaleString();
    const file = new File([value], name, { type: 'text/plain' });
    const url = await uploadFileAttachmentToServer(file, source);
    return url;
}

/**
 * Callback for updating an attachment in the data bank.
 * @param {object} args Named arguments
 * @param {string} value Content of the attachment
 * @returns {Promise<string>} URL of the attachment
 */
async function updateDataBankAttachment(args, value) {
    const source = args?.source && TYPES.includes(args.source) ? args.source : 'chat';
    const attachments = getAttachments(source);
    const fullMatchByURL = attachments.find(it =>  String(it.url).trim().toLowerCase() === String(args?.url).trim().toLowerCase());
    const fullMatchByName = attachments.find(it => String(it.name).trim().toLowerCase() === String(args?.name).trim().toLowerCase());
    const attachment = fullMatchByURL || fullMatchByName;

    if (!attachment) {
        toastr.warning('Attachment not found.');
        return '';
    }

    await deleteAttachment(attachment, source, () => { }, false);
    const file = new File([value], attachment.name, { type: 'text/plain' });
    const url = await uploadFileAttachmentToServer(file, source);
    return url;
}

/**
 * Callback for deleting an attachment from the data bank.
 * @param {object} args Named arguments
 * @param {string} value Name or URL of the attachment
 * @returns {Promise<string>} Empty string
 */
async function deleteDataBankAttachment(args, value) {
    const source = args?.source && TYPES.includes(args.source) ? args.source : 'chat';
    const attachments = getAttachments(source);
    const match = (a) => String(a).trim().toLowerCase() === String(value).trim().toLowerCase();
    const fullMatchByURL = attachments.find(it => match(it.url));
    const fullMatchByName = attachments.find(it => match(it.name));
    const attachment = fullMatchByURL || fullMatchByName;

    if (!attachment) {
        toastr.warning('Attachment not found.');
        return '';
    }

    await deleteAttachment(attachment, source, () => { }, false);
    return '';
}

jQuery(async () => {
    const buttons = await renderExtensionTemplateAsync('attachments', 'buttons', {});
    $('#extensionsMenu').prepend(buttons);

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'db',
        callback: () => document.getElementById('manageAttachments')?.click(),
        aliases: ['databank', 'data-bank'],
        helpString: 'Open the data bank',
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'db-list',
        callback: listDataBankAttachments,
        aliases: ['databank-list', 'data-bank-list'],
        helpString: 'List attachments in the Data Bank as a JSON-serialized array. Optionally, provide the source of the attachments and the field to list by.',
        namedArgumentList: [
            new SlashCommandNamedArgument('source', 'The source of the attachments.', ARGUMENT_TYPE.STRING, false, false, '', TYPES),
            new SlashCommandNamedArgument('field', 'The field to list by.', ARGUMENT_TYPE.STRING, false, false, 'url', FIELDS),
        ],
        returns: ARGUMENT_TYPE.LIST,
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'db-get',
        callback: getDataBankText,
        aliases: ['databank-get', 'data-bank-get'],
        helpString: 'Get attachment text from the Data Bank. Either provide the name or URL of the attachment. Optionally, provide the source of the attachment.',
        namedArgumentList: [
            new SlashCommandNamedArgument('source', 'The source of the attachment.', ARGUMENT_TYPE.STRING, false, false, '', TYPES),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument('The name or URL of the attachment.', ARGUMENT_TYPE.STRING, true, false),
        ],
        returns: ARGUMENT_TYPE.STRING,
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'db-add',
        callback: uploadDataBankAttachment,
        aliases: ['databank-add', 'data-bank-add'],
        helpString: 'Add an attachment to the Data Bank. If name is not provided, it will be generated automatically. Returns the URL of the attachment.',
        namedArgumentList: [
            new SlashCommandNamedArgument('source', 'The source for the attachment.', ARGUMENT_TYPE.STRING, false, false, 'chat', TYPES),
            new SlashCommandNamedArgument('name', 'The name of the attachment.', ARGUMENT_TYPE.STRING, false, false),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument('The content of the file attachment.', ARGUMENT_TYPE.STRING, true, false),
        ],
        returns: ARGUMENT_TYPE.STRING,
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'db-update',
        callback: updateDataBankAttachment,
        aliases: ['databank-update', 'data-bank-update'],
        helpString: 'Update an attachment in the Data Bank, preserving its name. Returns a new URL of the attachment.',
        namedArgumentList: [
            new SlashCommandNamedArgument('source', 'The source for the attachment.', ARGUMENT_TYPE.STRING, false, false, 'chat', TYPES),
            new SlashCommandNamedArgument('name', 'The name of the attachment.', ARGUMENT_TYPE.STRING, false, false),
            new SlashCommandNamedArgument('url', 'The URL of the attachment to update.', ARGUMENT_TYPE.STRING, false, false),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument('The content of the file attachment.', ARGUMENT_TYPE.STRING, true, false),
        ],
        returns: ARGUMENT_TYPE.STRING,
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'db-delete',
        callback: deleteDataBankAttachment,
        aliases: ['databank-delete', 'data-bank-delete'],
        helpString: 'Delete an attachment from the Data Bank.',
        namedArgumentList: [
            new SlashCommandNamedArgument('source', 'The source of the attachment.', ARGUMENT_TYPE.STRING, false, false, 'chat', TYPES),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument('The name or URL of the attachment.', ARGUMENT_TYPE.STRING, true, false),
        ],
    }));
});
