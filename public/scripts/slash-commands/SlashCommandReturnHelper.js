import { sendSystemMessage, system_message_types } from '../../script.js';
import { callGenericPopup, POPUP_TYPE } from '../popup.js';
import { escapeHtml } from '../utils.js';
import { enumIcons } from './SlashCommandCommonEnumsProvider.js';
import { enumTypes, SlashCommandEnumValue } from './SlashCommandEnumValue.js';

/** @typedef {'pipe'|'object'|'chat-html'|'chat-text'|'popup-html'|'popup-text'|'toast-html'|'toast-text'|'console'|'none'} SlashCommandReturnType */

export const slashCommandReturnHelper = {
    /**
     * Gets/creates the enum list of types of return relevant for a slash command
     *
     * @param {object} [options={}] Options
     * @param {boolean} [options.allowPipe=true] Allow option to pipe the return value
     * @param {boolean} [options.allowObject=false] Allow option to return the value as an object
     * @param {boolean} [options.allowChat=false] Allow option to return the value as a chat message
     * @param {boolean} [options.allowPopup=false] Allow option to return the value as a popup
     * @returns {SlashCommandEnumValue[]} The enum list
     */
    enumList: ({ allowPipe = true, allowObject = false, allowChat = false, allowPopup = false } = {}) => [
        allowPipe && new SlashCommandEnumValue('pipe', 'Return to the pipe for the next command', enumTypes.name, '|'),
        allowObject && new SlashCommandEnumValue('object', 'Return as an object to the pipe for the next command', enumTypes.variable, enumIcons.dictionary),
        allowChat && new SlashCommandEnumValue('chat-html', 'Sending a chat message with the return value - Can display HTML', enumTypes.command, enumIcons.message),
        allowChat && new SlashCommandEnumValue('chat-text', 'Sending a chat message with the return value - Will only display as text', enumTypes.qr, enumIcons.message),
        new SlashCommandEnumValue('popup-html', 'Showing as a popup with the return value - Can display HTML', enumTypes.command, enumIcons.popup),
        new SlashCommandEnumValue('popup-text', 'Showing as a popup with the return value - Will only display as text', enumTypes.qr, enumIcons.popup),
        new SlashCommandEnumValue('toast-html', 'Show the return value as a toast notification - Can display HTML', enumTypes.command, 'ℹ️'),
        new SlashCommandEnumValue('toast-text', 'Show the return value as a toast notification - Will only display as text', enumTypes.qr, 'ℹ️'),
        new SlashCommandEnumValue('console', 'Log the return value to the console', enumTypes.enum, '>'),
        new SlashCommandEnumValue('none', 'No return value'),
    ].filter(x => !!x),

    /**
     * Handles the return value based on the specified type
     *
     * @param {SlashCommandReturnType} type The type of return
     * @param {object|number|string} value The value to return
     * @param {object} [options={}] Options
     * @param {(o: object) => string} [options.objectToStringFunc=null] Function to convert the object to a string, if object was provided and 'object' was not the chosen return type
     * @returns {Promise<*>} The processed return value
     */
    async doReturn(type, value, { objectToStringFunc = o => o?.toString() } = {}) {
        const stringValue = typeof value !== 'string' ? objectToStringFunc(value) : value;

        switch (type) {
            case 'popup-html':
            case 'popup-text':
            case 'chat-text':
            case 'chat-html':
            case 'toast-text':
            case 'toast-html': {
                const shouldHtml = type.endsWith('html');
                const makeHtml = (str) => (new showdown.Converter()).makeHtml(str);

                if (type.startsWith('popup')) await callGenericPopup(shouldHtml ? makeHtml(stringValue) : escapeHtml(stringValue), POPUP_TYPE.TEXT);
                if (type.startsWith('chat')) sendSystemMessage(system_message_types.GENERIC, shouldHtml ? makeHtml(stringValue) : escapeHtml(stringValue));
                if (type.startsWith('toast')) toastr.info(stringValue, null, { escapeHtml: !shouldHtml }); // Toastr handles HTML conversion internally already

                return '';
            }
            case 'pipe':
                return stringValue ?? '';
            case 'object':
                return JSON.stringify(value);
            case 'console':
                console.info(value);
                return '';
            case 'none':
                return '';
            default:
                throw new Error(`Unknown return type: ${type}`);
        }
    },
};
