import {
    Generate,
    activateSendButtons,
    addOneMessage,
    callPopup,
    characters,
    chat,
    chat_metadata,
    comment_avatar,
    deactivateSendButtons,
    default_avatar,
    eventSource,
    event_types,
    extension_prompt_types,
    extractMessageBias,
    generateQuietPrompt,
    generateRaw,
    getThumbnailUrl,
    is_send_press,
    main_api,
    name1,
    reloadCurrentChat,
    removeMacros,
    saveChatConditional,
    sendMessageAsUser,
    sendSystemMessage,
    setCharacterId,
    setCharacterName,
    setExtensionPrompt,
    setUserName,
    substituteParams,
    system_avatar,
    system_message_types,
    this_chid,
} from '../script.js';
import { getMessageTimeStamp } from './RossAscends-mods.js';
import { hideChatMessage, unhideChatMessage } from './chats.js';
import { getContext, saveMetadataDebounced } from './extensions.js';
import { getRegexedString, regex_placement } from './extensions/regex/engine.js';
import { findGroupMemberId, groups, is_group_generating, resetSelectedGroup, saveGroupChat, selected_group } from './group-chats.js';
import { autoSelectPersona } from './personas.js';
import { addEphemeralStoppingString, chat_styles, flushEphemeralStoppingStrings, power_user } from './power-user.js';
import { decodeTextTokens, getFriendlyTokenizerName, getTextTokens, getTokenCount } from './tokenizers.js';
import { delay, isFalseBoolean, isTrueBoolean, stringToRange, trimToEndSentence, trimToStartSentence, waitUntilCondition } from './utils.js';
import { registerVariableCommands, resolveVariable } from './variables.js';
export {
    executeSlashCommands, getSlashCommandsHelp, registerSlashCommand,
};

class SlashCommandParser {
    constructor() {
        this.commands = {};
        this.helpStrings = {};
    }

    addCommand(command, callback, aliases, helpString = '', interruptsGeneration = false, purgeFromMessage = true) {
        const fnObj = { callback, helpString, interruptsGeneration, purgeFromMessage };

        if ([command, ...aliases].some(x => Object.hasOwn(this.commands, x))) {
            console.trace('WARN: Duplicate slash command registered!');
        }

        this.commands[command] = fnObj;

        if (Array.isArray(aliases)) {
            aliases.forEach((alias) => {
                this.commands[alias] = fnObj;
            });
        }

        let stringBuilder = `<span class="monospace">/${command}</span> ${helpString} `;
        if (Array.isArray(aliases) && aliases.length) {
            let aliasesString = `(alias: ${aliases.map(x => `<span class="monospace">/${x}</span>`).join(', ')})`;
            stringBuilder += aliasesString;
        }
        this.helpStrings[command] = stringBuilder;
    }

    parse(text) {
        const excludedFromRegex = ['sendas'];
        const firstSpace = text.indexOf(' ');
        const command = firstSpace !== -1 ? text.substring(1, firstSpace) : text.substring(1);
        const args = firstSpace !== -1 ? text.substring(firstSpace + 1) : '';
        const argObj = {};
        let unnamedArg;

        if (args.length > 0) {
            // Match named arguments
            const namedArgPattern = /(\w+)=("(?:\\.|[^"\\])*"|\S+)/g;
            let match;
            while ((match = namedArgPattern.exec(args)) !== null) {
                const key = match[1];
                const value = match[2];
                // Remove the quotes around the value, if any
                argObj[key] = value.replace(/(^")|("$)/g, '');
            }

            // Match unnamed argument
            const unnamedArgPattern = /(?:\w+=(?:"(?:\\.|[^"\\])*"|\S+)\s*)*(.*)/s;
            match = unnamedArgPattern.exec(args);
            if (match !== null) {
                unnamedArg = match[1].trim();
            }

            // Excluded commands format in their own function
            if (!excludedFromRegex.includes(command)) {
                unnamedArg = getRegexedString(
                    unnamedArg,
                    regex_placement.SLASH_COMMAND,
                );
            }
        }

        if (this.commands[command]) {
            return { command: this.commands[command], args: argObj, value: unnamedArg };
        }

        return false;
    }

    getHelpString() {
        const listItems = Object
            .entries(this.helpStrings)
            .sort((a, b) => a[0].localeCompare(b[0]))
            .map(x => x[1])
            .map(x => `<li>${x}</li>`)
            .join('\n');
        return `<p>Slash commands:</p><ol>${listItems}</ol>
        <small>Slash commands can be batched into a single input by adding a pipe character | at the end, and then writing a new slash command.</small>
        <ul><li><small>Example:</small><code>/cut 1 | /sys Hello, | /continue</code></li>
        <li>This will remove the first message in chat, send a system message that starts with 'Hello,', and then ask the AI to continue the message.</li></ul>`;
    }
}

const parser = new SlashCommandParser();
const registerSlashCommand = parser.addCommand.bind(parser);
const getSlashCommandsHelp = parser.getHelpString.bind(parser);

parser.addCommand('?', helpCommandCallback, ['help'], ' – get help on macros, chat formatting and commands', true, true);
parser.addCommand('name', setNameCallback, ['persona'], '<span class="monospace">(name)</span> – sets user name and persona avatar (if set)', true, true);
parser.addCommand('sync', syncCallback, [], ' – syncs user name in user-attributed messages in the current chat', true, true);
parser.addCommand('lock', bindCallback, ['bind'], ' – locks/unlocks a persona (name and avatar) to the current chat', true, true);
parser.addCommand('bg', setBackgroundCallback, ['background'], '<span class="monospace">(filename)</span> – sets a background according to filename, partial names allowed', false, true);
parser.addCommand('sendas', sendMessageAs, [], ' – sends message as a specific character. Uses character avatar if it exists in the characters list. Example that will send "Hello, guys!" from "Chloe": <tt>/sendas name="Chloe" Hello, guys!</tt>', true, true);
parser.addCommand('sys', sendNarratorMessage, ['nar'], '<span class="monospace">(text)</span> – sends message as a system narrator', false, true);
parser.addCommand('sysname', setNarratorName, [], '<span class="monospace">(name)</span> – sets a name for future system narrator messages in this chat (display only). Default: System. Leave empty to reset.', true, true);
parser.addCommand('comment', sendCommentMessage, [], '<span class="monospace">(text)</span> – adds a note/comment message not part of the chat', false, true);
parser.addCommand('single', setStoryModeCallback, ['story'], ' – sets the message style to single document mode without names or avatars visible', true, true);
parser.addCommand('bubble', setBubbleModeCallback, ['bubbles'], ' – sets the message style to bubble chat mode', true, true);
parser.addCommand('flat', setFlatModeCallback, ['default'], ' – sets the message style to flat chat mode', true, true);
parser.addCommand('continue', continueChatCallback, ['cont'], ' – continues the last message in the chat', true, true);
parser.addCommand('go', goToCharacterCallback, ['char'], '<span class="monospace">(name)</span> – opens up a chat with the character by its name', true, true);
parser.addCommand('sysgen', generateSystemMessage, [], '<span class="monospace">(prompt)</span> – generates a system message using a specified prompt', true, true);
parser.addCommand('ask', askCharacter, [], '<span class="monospace">(prompt)</span> – asks a specified character card a prompt', true, true);
parser.addCommand('delname', deleteMessagesByNameCallback, ['cancel'], '<span class="monospace">(name)</span> – deletes all messages attributed to a specified name', true, true);
parser.addCommand('send', sendUserMessageCallback, [], '<span class="monospace">(text)</span> – adds a user message to the chat log without triggering a generation', true, true);
parser.addCommand('trigger', triggerGenerationCallback, [], ' – triggers a message generation. If in group, can trigger a message for the specified group member index or name.', true, true);
parser.addCommand('hide', hideMessageCallback, [], '<span class="monospace">(message index or range)</span> – hides a chat message from the prompt', true, true);
parser.addCommand('unhide', unhideMessageCallback, [], '<span class="monospace">(message index or range)</span> – unhides a message from the prompt', true, true);
parser.addCommand('disable', disableGroupMemberCallback, [], '<span class="monospace">(member index or name)</span> – disables a group member from being drafted for replies', true, true);
parser.addCommand('enable', enableGroupMemberCallback, [], '<span class="monospace">(member index or name)</span> – enables a group member to be drafted for replies', true, true);
parser.addCommand('memberadd', addGroupMemberCallback, ['addmember'], '<span class="monospace">(character name)</span> – adds a new group member to the group chat', true, true);
parser.addCommand('memberremove', removeGroupMemberCallback, ['removemember'], '<span class="monospace">(member index or name)</span> – removes a group member from the group chat', true, true);
parser.addCommand('memberup', moveGroupMemberUpCallback, ['upmember'], '<span class="monospace">(member index or name)</span> – moves a group member up in the group chat list', true, true);
parser.addCommand('memberdown', moveGroupMemberDownCallback, ['downmember'], '<span class="monospace">(member index or name)</span> – moves a group member down in the group chat list', true, true);
parser.addCommand('peek', peekCallback, [], '<span class="monospace">(message index or range)</span> – shows a group member character card without switching chats', true, true);
parser.addCommand('delswipe', deleteSwipeCallback, ['swipedel'], '<span class="monospace">(optional 1-based id)</span> – deletes a swipe from the last chat message. If swipe id not provided - deletes the current swipe.', true, true);
parser.addCommand('echo', echoCallback, [], '<span class="monospace">(title=string severity=info/warning/error/success [text])</span> – echoes the text to toast message. Useful for pipes debugging.', true, true);
//parser.addCommand('#', (_, value) => '', [], ' – a comment, does nothing, e.g. <tt>/# the next three commands switch variables a and b</tt>', true, true);
parser.addCommand('gen', generateCallback, [], '<span class="monospace">(lock=on/off [prompt])</span> – generates text using the provided prompt and passes it to the next command through the pipe, optionally locking user input while generating.', true, true);
parser.addCommand('genraw', generateRawCallback, [], '<span class="monospace">(lock=on/off [prompt])</span> – generates text using the provided prompt and passes it to the next command through the pipe, optionally locking user input while generating. Does not include chat history or character card. Use instruct=off to skip instruct formatting, e.g. <tt>/genraw instruct=off Why is the sky blue?</tt>. Use stop=... with a JSON-serialized array to add one-time custom stop strings, e.g. <tt>/genraw stop=["\\n"] Say hi</tt>', true, true);
parser.addCommand('addswipe', addSwipeCallback, ['swipeadd'], '<span class="monospace">(text)</span> – adds a swipe to the last chat message.', true, true);
parser.addCommand('abort', abortCallback, [], ' – aborts the slash command batch execution', true, true);
parser.addCommand('fuzzy', fuzzyCallback, [], 'list=["a","b","c"] (search value) – performs a fuzzy match of the provided search using the provided list of value and passes the closest match to the next command through the pipe.', true, true);
parser.addCommand('pass', (_, arg) => arg, ['return'], '<span class="monospace">(text)</span> – passes the text to the next command through the pipe.', true, true);
parser.addCommand('delay', delayCallback, ['wait', 'sleep'], '<span class="monospace">(milliseconds)</span> – delays the next command in the pipe by the specified number of milliseconds.', true, true);
parser.addCommand('input', inputCallback, ['prompt'], '<span class="monospace">(default="string" large=on/off wide=on/off okButton="string" rows=number [text])</span> – Shows a popup with the provided text and an input field. The default argument is the default value of the input field, and the text argument is the text to display.', true, true);
parser.addCommand('run', runCallback, ['call', 'exec'], '<span class="monospace">(QR label)</span> – runs a Quick Reply with the specified name from the current preset.', true, true);
parser.addCommand('messages', getMessagesCallback, ['message'], '<span class="monospace">(names=off/on [message index or range])</span> – returns the specified message or range of messages as a string.', true, true);
parser.addCommand('setinput', setInputCallback, [], '<span class="monospace">(text)</span> – sets the user input to the specified text and passes it to the next command through the pipe.', true, true);
parser.addCommand('popup', popupCallback, [], '<span class="monospace">(large=on/off wide=on/off okButton="string" text)</span> – shows a blocking popup with the specified text and buttons. Returns the input value into the pipe or empty string if canceled.', true, true);
parser.addCommand('buttons', buttonsCallback, [], '<span class="monospace">labels=["a","b"] (text)</span> – shows a blocking popup with the specified text and buttons. Returns the clicked button label into the pipe or empty string if canceled.', true, true);
parser.addCommand('trimtokens', trimTokensCallback, [], '<span class="monospace">limit=number (direction=start/end [text])</span> – trims the start or end of text to the specified number of tokens.', true, true);
parser.addCommand('trimstart', trimStartCallback, [], '<span class="monospace">(text)</span> – trims the text to the start of the first full sentence.', true, true);
parser.addCommand('trimend', trimEndCallback, [], '<span class="monospace">(text)</span> – trims the text to the end of the last full sentence.', true, true);
parser.addCommand('inject', injectCallback, [], '<span class="monospace">id=injectId (position=before/after/chat depth=number [text])</span> – injects a text into the LLM prompt for the current chat. Requires a unique injection ID. Positions: "before" main prompt, "after" main prompt, in-"chat" (default: after). Depth: injection depth for the prompt (default: 4).', true, true);
parser.addCommand('listinjects', listInjectsCallback, [], ' – lists all script injections for the current chat.', true, true);
parser.addCommand('flushinjects', flushInjectsCallback, [], ' – removes all script injections for the current chat.', true, true);
parser.addCommand('tokens', (_, text) => getTokenCount(text), [], '<span class="monospace">(text)</span> – counts the number of tokens in the text.', true, true);
registerVariableCommands();

const NARRATOR_NAME_KEY = 'narrator_name';
const NARRATOR_NAME_DEFAULT = 'System';
export const COMMENT_NAME_DEFAULT = 'Note';
const SCRIPT_PROMPT_KEY = 'script_inject_';

function injectCallback(args, value) {
    const positions = {
        'before': extension_prompt_types.BEFORE_PROMPT,
        'after': extension_prompt_types.IN_PROMPT,
        'chat': extension_prompt_types.IN_CHAT,
    };

    const id = resolveVariable(args?.id);

    if (!id) {
        console.warn('WARN: No ID provided for /inject command');
        toastr.warning('No ID provided for /inject command');
        return '';
    }

    const defaultPosition = 'after';
    const defaultDepth = 4;
    const positionValue = args?.position ?? defaultPosition;
    const position = positions[positionValue] ?? positions[defaultPosition];
    const depthValue = Number(args?.depth) ?? defaultDepth;
    const depth = isNaN(depthValue) ? defaultDepth : depthValue;
    value = value || '';

    const prefixedId = `${SCRIPT_PROMPT_KEY}${id}`;

    if (!chat_metadata.script_injects) {
        chat_metadata.script_injects = {};
    }

    chat_metadata.script_injects[id] = {
        value,
        position,
        depth,
    };

    setExtensionPrompt(prefixedId, value, position, depth);
    saveMetadataDebounced();
    return '';
}

function listInjectsCallback() {
    if (!chat_metadata.script_injects) {
        toastr.info('No script injections for the current chat');
        return '';
    }

    const injects = Object.entries(chat_metadata.script_injects)
        .map(([id, inject]) => {
            const position = Object.entries(extension_prompt_types);
            const positionName = position.find(([_, value]) => value === inject.position)?.[0] ?? 'unknown';
            return `* **${id}**: <code>${inject.value}</code> (${positionName}, depth: ${inject.depth})`;
        })
        .join('\n');

    const converter = new showdown.Converter();
    const messageText = `### Script injections:\n${injects}`;
    const htmlMessage = DOMPurify.sanitize(converter.makeHtml(messageText));

    sendSystemMessage(system_message_types.GENERIC, htmlMessage);
}

function flushInjectsCallback() {
    if (!chat_metadata.script_injects) {
        return '';
    }

    for (const [id, inject] of Object.entries(chat_metadata.script_injects)) {
        const prefixedId = `${SCRIPT_PROMPT_KEY}${id}`;
        setExtensionPrompt(prefixedId, '', inject.position, inject.depth);
    }

    chat_metadata.script_injects = {};
    saveMetadataDebounced();
    return '';
}

export function processChatSlashCommands() {
    const context = getContext();

    if (!(context.chatMetadata.script_injects)) {
        return;
    }

    for (const id of Object.keys(context.extensionPrompts)) {
        if (!id.startsWith(SCRIPT_PROMPT_KEY)) {
            continue;
        }

        console.log('Removing script injection', id);
        delete context.extensionPrompts[id];
    }

    for (const [id, inject] of Object.entries(context.chatMetadata.script_injects)) {
        const prefixedId = `${SCRIPT_PROMPT_KEY}${id}`;
        console.log('Adding script injection', id);
        setExtensionPrompt(prefixedId, inject.value, inject.position, inject.depth);
    }
}

function setInputCallback(_, value) {
    $('#send_textarea').val(value || '').trigger('input');
    return value;
}

function trimStartCallback(_, value) {
    if (!value) {
        return '';
    }

    return trimToStartSentence(value);
}

function trimEndCallback(_, value) {
    if (!value) {
        return '';
    }

    return trimToEndSentence(value);
}

function trimTokensCallback(arg, value) {
    if (!value) {
        console.warn('WARN: No argument provided for /trimtokens command');
        return '';
    }

    const limit = Number(resolveVariable(arg.limit));

    if (isNaN(limit)) {
        console.warn(`WARN: Invalid limit provided for /trimtokens command: ${limit}`);
        return value;
    }

    if (limit <= 0) {
        return '';
    }

    const direction = arg.direction || 'end';
    const tokenCount = getTokenCount(value);

    // Token count is less than the limit, do nothing
    if (tokenCount <= limit) {
        return value;
    }

    const { tokenizerName, tokenizerId } = getFriendlyTokenizerName(main_api);
    console.debug('Requesting tokenization for /trimtokens command', tokenizerName);

    try {
        const textTokens = getTextTokens(tokenizerId, value);

        if (!Array.isArray(textTokens) || !textTokens.length) {
            console.warn('WARN: No tokens returned for /trimtokens command, falling back to estimation');
            const percentage = limit / tokenCount;
            const trimIndex = Math.floor(value.length * percentage);
            const trimmedText = direction === 'start' ? value.substring(trimIndex) : value.substring(0, value.length - trimIndex);
            return trimmedText;
        }

        const sliceTokens = direction === 'start' ? textTokens.slice(0, limit) : textTokens.slice(-limit);
        const decodedText = decodeTextTokens(tokenizerId, sliceTokens);
        return decodedText;
    } catch (error) {
        console.warn('WARN: Tokenization failed for /trimtokens command, returning original', error);
        return value;
    }
}

async function buttonsCallback(args, text) {
    try {
        const buttons = JSON.parse(resolveVariable(args?.labels));

        if (!Array.isArray(buttons) || !buttons.length) {
            console.warn('WARN: Invalid labels provided for /buttons command');
            return '';
        }

        return new Promise(async (resolve) => {
            const safeValue = DOMPurify.sanitize(text || '');

            const buttonContainer = document.createElement('div');
            buttonContainer.classList.add('flex-container', 'flexFlowColumn', 'wide100p', 'm-t-1');

            for (const button of buttons) {
                const buttonElement = document.createElement('div');
                buttonElement.classList.add('menu_button', 'wide100p');
                buttonElement.addEventListener('click', () => {
                    resolve(button);
                    $('#dialogue_popup_ok').trigger('click');
                });
                buttonElement.innerText = button;
                buttonContainer.appendChild(buttonElement);
            }

            const popupContainer = document.createElement('div');
            popupContainer.innerHTML = safeValue;
            popupContainer.appendChild(buttonContainer);
            callPopup(popupContainer, 'text', '', { okButton: 'Cancel' })
                .then(() => resolve(''))
                .catch(() => resolve(''));
        });
    } catch {
        return '';
    }
}

async function popupCallback(args, value) {
    const safeValue = DOMPurify.sanitize(value || '');
    const popupOptions = {
        large: isTrueBoolean(args?.large),
        wide: isTrueBoolean(args?.wide),
        okButton: args?.okButton !== undefined && typeof args?.okButton === 'string' ? args.okButton : 'Ok',
    };
    await delay(1);
    await callPopup(safeValue, 'text', '', popupOptions);
    await delay(1);
    return value;
}

function getMessagesCallback(args, value) {
    const includeNames = !isFalseBoolean(args?.names);
    const range = stringToRange(value, 0, chat.length - 1);

    if (!range) {
        console.warn(`WARN: Invalid range provided for /getmessages command: ${value}`);
        return '';
    }

    const messages = [];

    for (let messageId = range.start; messageId <= range.end; messageId++) {
        const message = chat[messageId];
        if (!message) {
            console.warn(`WARN: No message found with ID ${messageId}`);
            continue;
        }

        if (message.is_system) {
            continue;
        }

        if (includeNames) {
            messages.push(`${message.name}: ${message.mes}`);
        } else {
            messages.push(message.mes);
        }
    }

    return messages.join('\n\n');
}

async function runCallback(_, name) {
    if (!name) {
        toastr.warning('No name provided for /run command');
        return '';
    }

    if (typeof window['executeQuickReplyByName'] !== 'function') {
        toastr.warning('Quick Reply extension is not loaded');
        return '';
    }

    try {
        name = name.trim();
        return await window['executeQuickReplyByName'](name);
    } catch (error) {
        toastr.error(`Error running Quick Reply "${name}": ${error.message}`, 'Error');
        return '';
    }
}

function abortCallback() {
    $('#send_textarea').val('').trigger('input');
    throw new Error('/abort command executed');
}

async function delayCallback(_, amount) {
    if (!amount) {
        console.warn('WARN: No amount provided for /delay command');
        return;
    }

    amount = Number(amount);
    if (isNaN(amount)) {
        amount = 0;
    }

    await delay(amount);
}

async function inputCallback(args, prompt) {
    const safeValue = DOMPurify.sanitize(prompt || '');
    const defaultInput = args?.default !== undefined && typeof args?.default === 'string' ? args.default : '';
    const popupOptions = {
        large: isTrueBoolean(args?.large),
        wide: isTrueBoolean(args?.wide),
        okButton: args?.okButton !== undefined && typeof args?.okButton === 'string' ? args.okButton : 'Ok',
        rows: args?.rows !== undefined && typeof args?.rows === 'string' ? isNaN(Number(args.rows)) ? 4 : Number(args.rows) : 4,
    };
    // Do not remove this delay, otherwise the prompt will not show up
    await delay(1);
    const result = await callPopup(safeValue, 'input', defaultInput, popupOptions);
    await delay(1);
    return result || '';
}

function fuzzyCallback(args, value) {
    if (!value) {
        console.warn('WARN: No argument provided for /fuzzy command');
        return '';
    }

    if (!args.list) {
        console.warn('WARN: No list argument provided for /fuzzy command');
        return '';
    }

    try {
        const list = JSON.parse(resolveVariable(args.list));
        if (!Array.isArray(list)) {
            console.warn('WARN: Invalid list argument provided for /fuzzy command');
            return '';
        }

        const fuse = new Fuse(list, {
            includeScore: true,
            findAllMatches: true,
            ignoreLocation: true,
            threshold: 0.7,
        });
        const result = fuse.search(value);
        return result[0]?.item;
    } catch {
        console.warn('WARN: Invalid list argument provided for /fuzzy command');
        return '';
    }
}

function setEphemeralStopStrings(value) {
    if (typeof value === 'string' && value.length) {
        try {
            const stopStrings = JSON.parse(value);
            if (Array.isArray(stopStrings)) {
                stopStrings.forEach(stopString => addEphemeralStoppingString(stopString));
            }
        } catch {
            // Do nothing
        }
    }
}

async function generateRawCallback(args, value) {
    if (!value) {
        console.warn('WARN: No argument provided for /genraw command');
        return;
    }

    // Prevent generate recursion
    $('#send_textarea').val('').trigger('input');
    const lock = isTrueBoolean(args?.lock);

    try {
        if (lock) {
            deactivateSendButtons();
        }

        setEphemeralStopStrings(resolveVariable(args?.stop));
        const result = await generateRaw(value, '', isFalseBoolean(args?.instruct));
        return result;
    } finally {
        if (lock) {
            activateSendButtons();
        }
        flushEphemeralStoppingStrings();
    }
}

async function generateCallback(args, value) {
    if (!value) {
        console.warn('WARN: No argument provided for /gen command');
        return;
    }

    // Prevent generate recursion
    $('#send_textarea').val('').trigger('input');
    const lock = isTrueBoolean(args?.lock);

    try {
        if (lock) {
            deactivateSendButtons();
        }

        setEphemeralStopStrings(resolveVariable(args?.stop));
        const result = await generateQuietPrompt(value, false, false, '');
        return result;
    } finally {
        if (lock) {
            activateSendButtons();
        }
        flushEphemeralStoppingStrings();
    }
}

async function echoCallback(args, value) {
    const safeValue = DOMPurify.sanitize(String(value) || '');
    if (safeValue === '') {
        console.warn('WARN: No argument provided for /echo command');
        return;
    }
    const title = args?.title !== undefined && typeof args?.title === 'string' ? args.title : undefined;
    const severity = args?.severity !== undefined && typeof args?.severity === 'string' ? args.severity : 'info';
    switch (severity) {
        case 'error':
            toastr.error(safeValue, title);
            break;
        case 'warning':
            toastr.warning(safeValue, title);
            break;
        case 'success':
            toastr.success(safeValue, title);
            break;
        case 'info':
        default:
            toastr.info(safeValue, title);
            break;
    }
    return value;
}

async function addSwipeCallback(_, arg) {
    const lastMessage = chat[chat.length - 1];

    if (!lastMessage) {
        toastr.warning('No messages to add swipes to.');
        return;
    }

    if (!arg) {
        console.warn('WARN: No argument provided for /addswipe command');
        return;
    }

    if (lastMessage.is_user) {
        toastr.warning('Can\'t add swipes to user messages.');
        return;
    }

    if (lastMessage.is_system) {
        toastr.warning('Can\'t add swipes to system messages.');
        return;
    }

    if (lastMessage.extra?.image) {
        toastr.warning('Can\'t add swipes to message containing an image.');
        return;
    }

    if (!Array.isArray(lastMessage.swipes)) {
        lastMessage.swipes = [lastMessage.mes];
        lastMessage.swipe_info = [{}];
        lastMessage.swipe_id = 0;
    }

    lastMessage.swipes.push(arg);
    lastMessage.swipe_info.push({
        send_date: getMessageTimeStamp(),
        gen_started: null,
        gen_finished: null,
        extra: {
            bias: extractMessageBias(arg),
            gen_id: Date.now(),
            api: 'manual',
            model: 'slash command',
        },
    });

    await saveChatConditional();
    await reloadCurrentChat();
}

async function deleteSwipeCallback(_, arg) {
    const lastMessage = chat[chat.length - 1];

    if (!lastMessage || !Array.isArray(lastMessage.swipes) || !lastMessage.swipes.length) {
        toastr.warning('No messages to delete swipes from.');
        return;
    }

    if (lastMessage.swipes.length <= 1) {
        toastr.warning('Can\'t delete the last swipe.');
        return;
    }

    const swipeId = arg && !isNaN(Number(arg)) ? (Number(arg) - 1) : lastMessage.swipe_id;

    if (swipeId < 0 || swipeId >= lastMessage.swipes.length) {
        toastr.warning(`Invalid swipe ID: ${swipeId + 1}`);
        return;
    }

    lastMessage.swipes.splice(swipeId, 1);

    if (Array.isArray(lastMessage.swipe_info) && lastMessage.swipe_info.length) {
        lastMessage.swipe_info.splice(swipeId, 1);
    }

    const newSwipeId = Math.min(swipeId, lastMessage.swipes.length - 1);
    lastMessage.swipe_id = newSwipeId;
    lastMessage.mes = lastMessage.swipes[newSwipeId];

    await saveChatConditional();
    await reloadCurrentChat();
}

async function askCharacter(_, text) {
    // Prevent generate recursion
    $('#send_textarea').val('').trigger('input');

    // Not supported in group chats
    // TODO: Maybe support group chats?
    if (selected_group) {
        toastr.error('Cannot run this command in a group chat!');
        return;
    }

    if (!text) {
        console.warn('WARN: No text provided for /ask command');
    }

    const parts = text.split('\n');
    if (parts.length <= 1) {
        toastr.warning('Both character name and message are required. Separate them with a new line.');
        return;
    }

    // Grabbing the message
    const name = parts.shift().trim();
    let mesText = parts.join('\n').trim();
    const prevChId = this_chid;

    // Find the character
    const chId = characters.findIndex((e) => e.name === name);
    if (!characters[chId] || chId === -1) {
        toastr.error('Character not found.');
        return;
    }

    // Override character and send a user message
    setCharacterId(chId);

    // TODO: Maybe look up by filename instead of name
    const character = characters[chId];
    let force_avatar, original_avatar;

    if (character && character.avatar !== 'none') {
        force_avatar = getThumbnailUrl('avatar', character.avatar);
        original_avatar = character.avatar;
    }
    else {
        force_avatar = default_avatar;
        original_avatar = default_avatar;
    }

    setCharacterName(character.name);

    await sendMessageAsUser(mesText, '');

    const restoreCharacter = () => {
        setCharacterId(prevChId);
        setCharacterName(characters[prevChId].name);

        // Only force the new avatar if the character name is the same
        // This skips if an error was fired
        const lastMessage = chat[chat.length - 1];
        if (lastMessage && lastMessage?.name === character.name) {
            lastMessage.force_avatar = force_avatar;
            lastMessage.original_avatar = original_avatar;
        }

        // Kill this callback once the event fires
        eventSource.removeListener(event_types.CHARACTER_MESSAGE_RENDERED, restoreCharacter);
    };

    // Run generate and restore previous character on error
    try {
        toastr.info(`Asking ${character.name} something...`);
        await Generate('ask_command');
    } catch {
        restoreCharacter();
    }

    // Restore previous character once message renders
    // Hack for generate
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, restoreCharacter);
}

async function hideMessageCallback(_, arg) {
    if (!arg) {
        console.warn('WARN: No argument provided for /hide command');
        return;
    }

    const range = stringToRange(arg, 0, chat.length - 1);

    if (!range) {
        console.warn(`WARN: Invalid range provided for /hide command: ${arg}`);
        return;
    }

    for (let messageId = range.start; messageId <= range.end; messageId++) {
        const messageBlock = $(`.mes[mesid="${messageId}"]`);

        if (!messageBlock.length) {
            console.warn(`WARN: No message found with ID ${messageId}`);
            return;
        }

        await hideChatMessage(messageId, messageBlock);
    }
}

async function unhideMessageCallback(_, arg) {
    if (!arg) {
        console.warn('WARN: No argument provided for /unhide command');
        return '';
    }

    const range = stringToRange(arg, 0, chat.length - 1);

    if (!range) {
        console.warn(`WARN: Invalid range provided for /unhide command: ${arg}`);
        return '';
    }

    for (let messageId = range.start; messageId <= range.end; messageId++) {
        const messageBlock = $(`.mes[mesid="${messageId}"]`);

        if (!messageBlock.length) {
            console.warn(`WARN: No message found with ID ${messageId}`);
            return '';
        }

        await unhideChatMessage(messageId, messageBlock);
    }

    return '';
}

/**
 * Copium for running group actions when the member is offscreen.
 * @param {number} chid - character ID
 * @param {string} action - one of 'enable', 'disable', 'up', 'down', 'view', 'remove'
 * @returns {void}
 */
function performGroupMemberAction(chid, action) {
    const memberSelector = `.group_member[chid="${chid}"]`;
    // Do not optimize. Paginator gets recreated on every action
    const paginationSelector = '#rm_group_members_pagination';
    const pageSizeSelector = '#rm_group_members_pagination select';
    let wasOffscreen = false;
    let paginationValue = null;
    let pageValue = null;

    if ($(memberSelector).length === 0) {
        wasOffscreen = true;
        paginationValue = Number($(pageSizeSelector).val());
        pageValue = $(paginationSelector).pagination('getCurrentPageNum');
        $(pageSizeSelector).val($(pageSizeSelector).find('option').last().val()).trigger('change');
    }

    $(memberSelector).find(`[data-action="${action}"]`).trigger('click');

    if (wasOffscreen) {
        $(pageSizeSelector).val(paginationValue).trigger('change');
        if ($(paginationSelector).length) {
            $(paginationSelector).pagination('go', pageValue);
        }
    }
}

async function disableGroupMemberCallback(_, arg) {
    if (!selected_group) {
        toastr.warning('Cannot run /disable command outside of a group chat.');
        return '';
    }

    const chid = findGroupMemberId(arg);

    if (chid === undefined) {
        console.warn(`WARN: No group member found for argument ${arg}`);
        return '';
    }

    performGroupMemberAction(chid, 'disable');
    return '';
}

async function enableGroupMemberCallback(_, arg) {
    if (!selected_group) {
        toastr.warning('Cannot run /enable command outside of a group chat.');
        return '';
    }

    const chid = findGroupMemberId(arg);

    if (chid === undefined) {
        console.warn(`WARN: No group member found for argument ${arg}`);
        return '';
    }

    performGroupMemberAction(chid, 'enable');
    return '';
}

async function moveGroupMemberUpCallback(_, arg) {
    if (!selected_group) {
        toastr.warning('Cannot run /memberup command outside of a group chat.');
        return '';
    }

    const chid = findGroupMemberId(arg);

    if (chid === undefined) {
        console.warn(`WARN: No group member found for argument ${arg}`);
        return '';
    }

    performGroupMemberAction(chid, 'up');
    return '';
}

async function moveGroupMemberDownCallback(_, arg) {
    if (!selected_group) {
        toastr.warning('Cannot run /memberdown command outside of a group chat.');
        return '';
    }

    const chid = findGroupMemberId(arg);

    if (chid === undefined) {
        console.warn(`WARN: No group member found for argument ${arg}`);
        return '';
    }

    performGroupMemberAction(chid, 'down');
    return '';
}

async function peekCallback(_, arg) {
    if (!selected_group) {
        toastr.warning('Cannot run /peek command outside of a group chat.');
        return '';
    }

    if (is_group_generating) {
        toastr.warning('Cannot run /peek command while the group reply is generating.');
        return '';
    }

    const chid = findGroupMemberId(arg);

    if (chid === undefined) {
        console.warn(`WARN: No group member found for argument ${arg}`);
        return '';
    }

    performGroupMemberAction(chid, 'view');
    return '';
}

async function removeGroupMemberCallback(_, arg) {
    if (!selected_group) {
        toastr.warning('Cannot run /memberremove command outside of a group chat.');
        return '';
    }

    if (is_group_generating) {
        toastr.warning('Cannot run /memberremove command while the group reply is generating.');
        return '';
    }

    const chid = findGroupMemberId(arg);

    if (chid === undefined) {
        console.warn(`WARN: No group member found for argument ${arg}`);
        return '';
    }

    performGroupMemberAction(chid, 'remove');
    return '';
}

async function addGroupMemberCallback(_, arg) {
    if (!selected_group) {
        toastr.warning('Cannot run /memberadd command outside of a group chat.');
        return '';
    }

    if (!arg) {
        console.warn('WARN: No argument provided for /memberadd command');
        return '';
    }

    arg = arg.trim();
    const chid = findCharacterIndex(arg);

    if (chid === -1) {
        console.warn(`WARN: No character found for argument ${arg}`);
        return '';
    }

    const character = characters[chid];
    const group = groups.find(x => x.id === selected_group);

    if (!group || !Array.isArray(group.members)) {
        console.warn(`WARN: No group found for ID ${selected_group}`);
        return '';
    }

    const avatar = character.avatar;

    if (group.members.includes(avatar)) {
        toastr.warning(`${character.name} is already a member of this group.`);
        return '';
    }

    group.members.push(avatar);
    await saveGroupChat(selected_group, true);

    // Trigger to reload group UI
    $('#rm_button_selected_ch').trigger('click');
    return character.name;
}

async function triggerGenerationCallback(_, arg) {
    setTimeout(async () => {
        try {
            await waitUntilCondition(() => !is_send_press && !is_group_generating, 10000, 100);
        } catch {
            console.warn('Timeout waiting for generation unlock');
            toastr.warning('Cannot run /trigger command while the reply is being generated.');
            return '';
        }

        // Prevent generate recursion
        $('#send_textarea').val('').trigger('input');

        let chid = undefined;

        if (selected_group && arg) {
            chid = findGroupMemberId(arg);

            if (chid === undefined) {
                console.warn(`WARN: No group member found for argument ${arg}`);
            }
        }

        setTimeout(() => Generate('normal', { force_chid: chid }), 100);
    }, 1);

    return '';
}

async function sendUserMessageCallback(args, text) {
    if (!text) {
        console.warn('WARN: No text provided for /send command');
        return;
    }

    text = text.trim();
    const bias = extractMessageBias(text);
    const insertAt = Number(resolveVariable(args?.at));
    await sendMessageAsUser(text, bias, insertAt);
    return '';
}

async function deleteMessagesByNameCallback(_, name) {
    if (!name) {
        console.warn('WARN: No name provided for /delname command');
        return;
    }

    name = name.trim();

    const messagesToDelete = [];
    chat.forEach((value) => {
        if (value.name === name) {
            messagesToDelete.push(value);
        }
    });

    if (!messagesToDelete.length) {
        console.debug('/delname: Nothing to delete');
        return;
    }

    for (const message of messagesToDelete) {
        const index = chat.indexOf(message);
        if (index !== -1) {
            console.debug(`/delname: Deleting message #${index}`, message);
            chat.splice(index, 1);
        }
    }

    await saveChatConditional();
    await reloadCurrentChat();

    toastr.info(`Deleted ${messagesToDelete.length} messages from ${name}`);
    return '';
}

function findCharacterIndex(name) {
    const matchTypes = [
        (a, b) => a === b,
        (a, b) => a.startsWith(b),
        (a, b) => a.includes(b),
    ];

    for (const matchType of matchTypes) {
        const index = characters.findIndex(x => matchType(x.name.toLowerCase(), name.toLowerCase()));
        if (index !== -1) {
            return index;
        }
    }

    return -1;
}

async function goToCharacterCallback(_, name) {
    if (!name) {
        console.warn('WARN: No character name provided for /go command');
        return;
    }

    name = name.trim();
    const characterIndex = findCharacterIndex(name);

    if (characterIndex !== -1) {
        await openChat(new String(characterIndex));
        return characters[characterIndex]?.name;
    } else {
        console.warn(`No matches found for name "${name}"`);
        return '';
    }
}

async function openChat(id) {
    resetSelectedGroup();
    setCharacterId(id);
    await delay(1);
    await reloadCurrentChat();
}

function continueChatCallback() {
    setTimeout(async () => {
        try {
            await waitUntilCondition(() => !is_send_press && !is_group_generating, 10000, 100);
        } catch {
            console.warn('Timeout waiting for generation unlock');
            toastr.warning('Cannot run /continue command while the reply is being generated.');
        }

        // Prevent infinite recursion
        $('#send_textarea').val('').trigger('input');
        $('#option_continue').trigger('click', { fromSlashCommand: true });
    }, 1);

    return '';
}

export async function generateSystemMessage(_, prompt) {
    $('#send_textarea').val('').trigger('input');

    if (!prompt) {
        console.warn('WARN: No prompt provided for /sysgen command');
        toastr.warning('You must provide a prompt for the system message');
        return;
    }

    // Generate and regex the output if applicable
    toastr.info('Please wait', 'Generating...');
    let message = await generateQuietPrompt(prompt);
    message = getRegexedString(message, regex_placement.SLASH_COMMAND);

    sendNarratorMessage(_, message);
}

function syncCallback() {
    $('#sync_name_button').trigger('click');
}

function bindCallback() {
    $('#lock_user_name').trigger('click');
}

function setStoryModeCallback() {
    $('#chat_display').val(chat_styles.DOCUMENT).trigger('change');
}

function setBubbleModeCallback() {
    $('#chat_display').val(chat_styles.BUBBLES).trigger('change');
}

function setFlatModeCallback() {
    $('#chat_display').val(chat_styles.DEFAULT).trigger('change');
}

function setNameCallback(_, name) {
    if (!name) {
        toastr.warning('you must specify a name to change to');
        return;
    }

    name = name.trim();

    // If the name is a persona, auto-select it
    for (let persona of Object.values(power_user.personas)) {
        if (persona.toLowerCase() === name.toLowerCase()) {
            autoSelectPersona(name);
            return;
        }
    }

    // Otherwise, set just the name
    setUserName(name); //this prevented quickReply usage
}

async function setNarratorName(_, text) {
    const name = text || NARRATOR_NAME_DEFAULT;
    chat_metadata[NARRATOR_NAME_KEY] = name;
    toastr.info(`System narrator name set to ${name}`);
    await saveChatConditional();
}

export async function sendMessageAs(args, text) {
    if (!text) {
        return;
    }

    let name;
    let mesText;

    if (args.name) {
        name = args.name.trim();
        mesText = text.trim();

        if (!name && !text) {
            toastr.warning('You must specify a name and text to send as');
            return;
        }
    } else {
        const parts = text.split('\n');
        if (parts.length <= 1) {
            toastr.warning('Both character name and message are required. Separate them with a new line.');
            return;
        }

        name = parts.shift().trim();
        mesText = parts.join('\n').trim();
    }

    // Requires a regex check after the slash command is pushed to output
    mesText = getRegexedString(mesText, regex_placement.SLASH_COMMAND, { characterOverride: name });

    // Messages that do nothing but set bias will be hidden from the context
    const bias = extractMessageBias(mesText);
    const isSystem = bias && !removeMacros(mesText).length;

    const character = characters.find(x => x.name === name);
    let force_avatar, original_avatar;

    if (character && character.avatar !== 'none') {
        force_avatar = getThumbnailUrl('avatar', character.avatar);
        original_avatar = character.avatar;
    }
    else {
        force_avatar = default_avatar;
        original_avatar = default_avatar;
    }

    const message = {
        name: name,
        is_user: false,
        is_system: isSystem,
        send_date: getMessageTimeStamp(),
        mes: substituteParams(mesText),
        force_avatar: force_avatar,
        original_avatar: original_avatar,
        extra: {
            bias: bias.trim().length ? bias : null,
            gen_id: Date.now(),
        },
    };

    const insertAt = Number(resolveVariable(args.at));

    if (!isNaN(insertAt) && insertAt >= 0 && insertAt <= chat.length) {
        chat.splice(insertAt, 0, message);
        await saveChatConditional();
        await eventSource.emit(event_types.MESSAGE_RECEIVED, insertAt);
        await reloadCurrentChat();
        await eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, insertAt);
    } else {
        chat.push(message);
        await eventSource.emit(event_types.MESSAGE_RECEIVED, (chat.length - 1));
        addOneMessage(message);
        await eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, (chat.length - 1));
        await saveChatConditional();
    }
}

export async function sendNarratorMessage(args, text) {
    if (!text) {
        return;
    }

    const name = chat_metadata[NARRATOR_NAME_KEY] || NARRATOR_NAME_DEFAULT;
    // Messages that do nothing but set bias will be hidden from the context
    const bias = extractMessageBias(text);
    const isSystem = bias && !removeMacros(text).length;

    const message = {
        name: name,
        is_user: false,
        is_system: isSystem,
        send_date: getMessageTimeStamp(),
        mes: substituteParams(text.trim()),
        force_avatar: system_avatar,
        extra: {
            type: system_message_types.NARRATOR,
            bias: bias.trim().length ? bias : null,
            gen_id: Date.now(),
        },
    };

    const insertAt = Number(resolveVariable(args.at));

    if (!isNaN(insertAt) && insertAt >= 0 && insertAt <= chat.length) {
        chat.splice(insertAt, 0, message);
        await saveChatConditional();
        await eventSource.emit(event_types.MESSAGE_SENT, insertAt);
        await reloadCurrentChat();
        await eventSource.emit(event_types.USER_MESSAGE_RENDERED, insertAt);
    } else {
        chat.push(message);
        await eventSource.emit(event_types.MESSAGE_SENT, (chat.length - 1));
        addOneMessage(message);
        await eventSource.emit(event_types.USER_MESSAGE_RENDERED, (chat.length - 1));
        await saveChatConditional();
    }
}

export async function promptQuietForLoudResponse(who, text) {

    let character_id = getContext().characterId;
    if (who === 'sys') {
        text = 'System: ' + text;
    } else if (who === 'user') {
        text = name1 + ': ' + text;
    } else if (who === 'char') {
        text = characters[character_id].name + ': ' + text;
    } else if (who === 'raw') {
        // We don't need to modify the text
    }

    //text = `${text}${power_user.instruct.enabled ? '' : '\n'}${(power_user.always_force_name2 && who != 'raw') ? characters[character_id].name + ":" : ""}`

    let reply = await generateQuietPrompt(text, true);
    text = await getRegexedString(reply, regex_placement.SLASH_COMMAND);

    const message = {
        name: characters[character_id].name,
        is_user: false,
        is_name: true,
        is_system: false,
        send_date: getMessageTimeStamp(),
        mes: substituteParams(text.trim()),
        extra: {
            type: system_message_types.COMMENT,
            gen_id: Date.now(),
        },
    };

    chat.push(message);
    await eventSource.emit(event_types.MESSAGE_SENT, (chat.length - 1));
    addOneMessage(message);
    await eventSource.emit(event_types.USER_MESSAGE_RENDERED, (chat.length - 1));
    await saveChatConditional();

}

async function sendCommentMessage(args, text) {
    if (!text) {
        return;
    }

    const message = {
        name: COMMENT_NAME_DEFAULT,
        is_user: false,
        is_system: true,
        send_date: getMessageTimeStamp(),
        mes: substituteParams(text.trim()),
        force_avatar: comment_avatar,
        extra: {
            type: system_message_types.COMMENT,
            gen_id: Date.now(),
        },
    };

    const insertAt = Number(resolveVariable(args.at));

    if (!isNaN(insertAt) && insertAt >= 0 && insertAt <= chat.length) {
        chat.splice(insertAt, 0, message);
        await saveChatConditional();
        await eventSource.emit(event_types.MESSAGE_SENT, insertAt);
        await reloadCurrentChat();
        await eventSource.emit(event_types.USER_MESSAGE_RENDERED, insertAt);
    } else {
        chat.push(message);
        await eventSource.emit(event_types.MESSAGE_SENT, (chat.length - 1));
        addOneMessage(message);
        await eventSource.emit(event_types.USER_MESSAGE_RENDERED, (chat.length - 1));
        await saveChatConditional();
    }
}

/**
 * Displays a help message from the slash command
 * @param {any} _ Unused
 * @param {string} type Type of help to display
 */
function helpCommandCallback(_, type) {
    switch (type?.trim()?.toLowerCase()) {
        case 'slash':
        case 'commands':
        case 'slashes':
        case 'slash commands':
        case '1':
            sendSystemMessage(system_message_types.SLASH_COMMANDS);
            break;
        case 'format':
        case 'formatting':
        case 'formats':
        case 'chat formatting':
        case '2':
            sendSystemMessage(system_message_types.FORMATTING);
            break;
        case 'hotkeys':
        case 'hotkey':
        case '3':
            sendSystemMessage(system_message_types.HOTKEYS);
            break;
        case 'macros':
        case 'macro':
        case '4':
            sendSystemMessage(system_message_types.MACROS);
            break;
        default:
            sendSystemMessage(system_message_types.HELP);
            break;
    }
}

$(document).on('click', '[data-displayHelp]', function (e) {
    e.preventDefault();
    const page = String($(this).data('displayhelp'));
    helpCommandCallback(null, page);
});

function setBackgroundCallback(_, bg) {
    if (!bg) {
        return;
    }

    console.log('Set background to ' + bg);

    const bgElements = Array.from(document.querySelectorAll('.bg_example')).map((x) => ({ element: x, bgfile: x.getAttribute('bgfile') }));

    const fuse = new Fuse(bgElements, { keys: ['bgfile'] });
    const result = fuse.search(bg);

    if (!result.length) {
        toastr.error(`No background found with name "${bg}"`);
        return;
    }

    const bgElement = result[0].item.element;

    if (bgElement instanceof HTMLElement) {
        bgElement.click();
    }
}

/**
 * Executes slash commands in the provided text
 * @param {string} text Slash command text
 * @param {boolean} unescape Whether to unescape the batch separator
 * @returns {Promise<{interrupt: boolean, newText: string, pipe: string} | boolean>}
 */
async function executeSlashCommands(text, unescape = false) {
    if (!text) {
        return false;
    }

    // Unescape the pipe character and macro braces
    if (unescape) {
        text = text.replace(/\\\|/g, '|');
        text = text.replace(/\\\{/g, '{');
        text = text.replace(/\\\}/g, '}');
    }

    // Hack to allow multi-line slash commands
    // All slash command messages should begin with a slash
    const placeholder = '\u200B'; // Use a zero-width space as a placeholder
    const chars = text.split('');
    for (let i = 1; i < chars.length; i++) {
        if (chars[i] === '|' && chars[i - 1] !== '\\') {
            chars[i] = placeholder;
        }
    }
    const lines = chars.join('').split(placeholder).map(line => line.trim());
    const linesToRemove = [];

    let interrupt = false;
    let pipeResult = '';

    for (let index = 0; index < lines.length; index++) {
        const trimmedLine = lines[index].trim();

        if (!trimmedLine.startsWith('/')) {
            continue;
        }

        const result = parser.parse(trimmedLine);

        if (!result) {
            continue;
        }

        if (result.value && typeof result.value === 'string') {
            result.value = substituteParams(result.value.trim());
        }

        console.debug('Slash command executing:', result);
        let unnamedArg = result.value || pipeResult;

        if (typeof result.args === 'object') {
            for (let [key, value] of Object.entries(result.args)) {
                if (typeof value === 'string') {
                    value = substituteParams(value.trim());

                    if (/{{pipe}}/i.test(value)) {
                        value = value.replace(/{{pipe}}/i, pipeResult || '');
                    }

                    result.args[key] = value;
                }
            }
        }

        if (typeof unnamedArg === 'string' && /{{pipe}}/i.test(unnamedArg)) {
            unnamedArg = unnamedArg.replace(/{{pipe}}/i, pipeResult || '');
        }

        pipeResult = await result.command.callback(result.args, unnamedArg);

        if (result.command.interruptsGeneration) {
            interrupt = true;
        }

        if (result.command.purgeFromMessage) {
            linesToRemove.push(lines[index]);
        }
    }

    const newText = lines.filter(x => linesToRemove.indexOf(x) === -1).join('\n');

    return { interrupt, newText, pipe: pipeResult };
}

function setSlashCommandAutocomplete(textarea) {
    textarea.autocomplete({
        source: (input, output) => {
            // Only show for slash commands and if there's no space
            if (!input.term.startsWith('/') || input.term.includes(' ')) {
                output([]);
                return;
            }

            const slashCommand = input.term.toLowerCase().substring(1); // Remove the slash
            const result = Object
                .keys(parser.helpStrings) // Get all slash commands
                .filter(x => x.startsWith(slashCommand)) // Filter by the input
                .sort((a, b) => a.localeCompare(b)) // Sort alphabetically
                // .slice(0, 20) // Limit to 20 results
                .map(x => ({ label: parser.helpStrings[x], value: `/${x} ` })); // Map to the help string

            output(result); // Return the results
        },
        select: (e, u) => {
            // unfocus the input
            $(e.target).val(u.item.value);
        },
        minLength: 1,
        position: { my: 'left bottom', at: 'left top', collision: 'none' },
    });

    textarea.autocomplete('instance')._renderItem = function (ul, item) {
        const width = $(textarea).innerWidth();
        const content = $('<div></div>').html(item.label);
        return $('<li>').width(width).append(content).appendTo(ul);
    };
}

jQuery(function () {
    const textarea = $('#send_textarea');
    setSlashCommandAutocomplete(textarea);
});
