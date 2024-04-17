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
    extension_prompt_roles,
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
    retriggerFirstMessageOnEmptyChat,
    saveChatConditional,
    sendMessageAsUser,
    sendSystemMessage,
    setActiveCharacter,
    setActiveGroup,
    setCharacterId,
    setCharacterName,
    setExtensionPrompt,
    setUserName,
    substituteParams,
    system_avatar,
    system_message_types,
    this_chid,
} from '../script.js';
import { SlashCommandParser as NewSlashCommandParser } from './slash-commands/SlashCommandParser.js';
import { SlashCommandParserError } from './slash-commands/SlashCommandParserError.js';
import { SlashCommandExecutor } from './slash-commands/SlashCommandExecutor.js';
import { getMessageTimeStamp } from './RossAscends-mods.js';
import { hideChatMessageRange } from './chats.js';
import { getContext, saveMetadataDebounced } from './extensions.js';
import { getRegexedString, regex_placement } from './extensions/regex/engine.js';
import { findGroupMemberId, groups, is_group_generating, openGroupById, resetSelectedGroup, saveGroupChat, selected_group } from './group-chats.js';
import { chat_completion_sources, oai_settings } from './openai.js';
import { autoSelectPersona } from './personas.js';
import { addEphemeralStoppingString, chat_styles, flushEphemeralStoppingStrings, power_user } from './power-user.js';
import { textgen_types, textgenerationwebui_settings } from './textgen-settings.js';
import { decodeTextTokens, getFriendlyTokenizerName, getTextTokens, getTokenCountAsync } from './tokenizers.js';
import { debounce, delay, escapeRegex, isFalseBoolean, isTrueBoolean, stringToRange, trimToEndSentence, trimToStartSentence, waitUntilCondition } from './utils.js';
import { registerVariableCommands, resolveVariable } from './variables.js';
import { background_settings } from './backgrounds.js';
import { SlashCommandScope } from './slash-commands/SlashCommandScope.js';
import { SlashCommandClosure } from './slash-commands/SlashCommandClosure.js';
import { SlashCommandClosureResult } from './slash-commands/SlashCommandClosureResult.js';
import { NAME_RESULT_TYPE, SlashCommandParserNameResult } from './slash-commands/SlashCommandParserNameResult.js';
import { OPTION_TYPE, SlashCommandAutoCompleteOption, SlashCommandFuzzyScore } from './slash-commands/SlashCommandAutoCompleteOption.js';
export {
    executeSlashCommands, getSlashCommandsHelp, registerSlashCommand,
};

class SlashCommandParser {
    static COMMENT_KEYWORDS = ['#', '/'];
    static RESERVED_KEYWORDS = [
        ...this.COMMENT_KEYWORDS,
    ];

    constructor() {
        this.commands = {};
        this.helpStrings = {};
    }

    addCommand(command, callback, aliases, helpString = '', interruptsGeneration = false, purgeFromMessage = true) {
        const fnObj = { callback, helpString, interruptsGeneration, purgeFromMessage };

        if ([command, ...aliases].some(x => SlashCommandParser.RESERVED_KEYWORDS.includes(x))) {
            console.error('ERROR: Reserved slash command keyword used!');
            return;
        }

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

    /**
     * Parses a slash command to extract the command name, the (named) arguments and the remaining text
     * @param {string} text - Slash command text
     * @returns {{command: string, args: object, value: string}} - The parsed command, its arguments and the remaining text
     */
    parse(text) {
        // Parses a command even when spaces are present in arguments
        // /buttons labels=["OK","I do not accept"] some text
        // /fuzzy list=[ "red pink" , "yellow" ] threshold=" 0.6 " he yelled when the color was reddish and not pink | /echo
        const excludedFromRegex = ['sendas'];
        let command = '';
        const argObj = {};
        let unnamedArg = '';

        // extract the command " /fuzzy   " => "fuzzy"
        text = text.trim();
        let remainingText = '';
        const commandArgPattern = /^\/([^\s]+)\s*(.*)$/s;
        let match = commandArgPattern.exec(text);
        if (match !== null && match[1].length > 0) {
            command = match[1];
            remainingText = match[2];
            console.debug('command:' + command);
        }

        // parse the rest of the string to extract named arguments, the remainder is the "unnamedArg" which is usually text, like the prompt to send
        while (remainingText.length > 0) {
            // does the remaining text is like     nameArg=[value]   or  nameArg=[value,value] or  nameArg=[  value , value , value]
            // where value can be a string like   " this is some text "  , note previously it was not possible to have have spaces
            // where value can be a scalar like   AScalar
            // where value can be a number like   +9   -1005.44
            // where value can be a macro like    {{getvar::name}}
            const namedArrayArgPattern = /^(\w+)=\[\s*(((?<quote>["'])[^"]*(\k<quote>)|{{[^}]*}}|[+-]?\d*\.?\d+|\w*)\s*,?\s*)+\]/s;
            match = namedArrayArgPattern.exec(remainingText);
            if (match !== null && match[0].length > 0) {
                //console.log(`matching: ${match[0]}`);
                const posFirstEqual = match[0].indexOf('=');
                const key = match[0].substring(0, posFirstEqual).trim();
                const value = match[0].substring(posFirstEqual + 1).trim();

                // Remove the quotes around the value, if any
                argObj[key] = value.replace(/(^")|("$)/g, '');
                remainingText = remainingText.slice(match[0].length + 1).trim();
                continue;
            }

            // does the remaining text is like     nameArg=value
            // where value can be a string like   " this is some text "  , note previously it was not possible to have have spaces
            // where value can be a scalar like   AScalar
            // where value can be a number like   +9   -1005.44
            // where value can be a macro like    {{getvar::name}}
            const namedScalarArgPattern = /^(\w+)=(((?<quote>["'])[^"]*(\k<quote>)|{{[^}]*}}|[+-]?\d*\.?\d+|\w*))/s;
            match = namedScalarArgPattern.exec(remainingText);
            if (match !== null && match[0].length > 0) {
                //console.log(`matching: ${match[0]}`);
                const posFirstEqual = match[0].indexOf('=');
                const key = match[0].substring(0, posFirstEqual).trim();
                const value = match[0].substring(posFirstEqual + 1).trim();

                // Remove the quotes around the value, if any
                argObj[key] = value.replace(/(^")|("$)/g, '');
                remainingText = remainingText.slice(match[0].length + 1).trim();
                continue;
            }

            // the remainder that matches no named argument is the "unamedArg" previously mentioned
            unnamedArg = remainingText.trim();
            remainingText = '';
        }

        // Excluded commands format in their own function
        if (!excludedFromRegex.includes(command)) {
            console.debug(`parse: !excludedFromRegex.includes(${command}`);
            console.debug(`   parse: unnamedArg before: ${unnamedArg}`);
            unnamedArg = getRegexedString(
                unnamedArg,
                regex_placement.SLASH_COMMAND,
            );
            console.debug(`   parse: unnamedArg after: ${unnamedArg}`);
        }

        // your weird complex command is now transformed into a juicy tiny text or something useful :)
        if (this.commands[command]) {
            return { command: this.commands[command], args: argObj, value: unnamedArg };
        }

        return null;
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

export const parser = new NewSlashCommandParser();
const registerSlashCommand = parser.addCommand.bind(parser);
const getSlashCommandsHelp = parser.getHelpString.bind(parser);

parser.addCommand('?', helpCommandCallback, ['help'], ' – get help on macros, chat formatting and commands', true, true);
parser.addCommand('name', setNameCallback, ['persona'], '<span class="monospace">(name)</span> – sets user name and persona avatar (if set)', true, true);
parser.addCommand('sync', syncCallback, [], ' – syncs the user persona in user-attributed messages in the current chat', true, true);
parser.addCommand('lock', bindCallback, ['bind'], ' – locks/unlocks a persona (name and avatar) to the current chat', true, true);
parser.addCommand('bg', setBackgroundCallback, ['background'], '<span class="monospace">(filename)</span> – sets a background according to filename, partial names allowed', false, true);
parser.addCommand('sendas', sendMessageAs, [], '<span class="monospace">[name=CharName compact=true/false (text)] – sends message as a specific character. Uses character avatar if it exists in the characters list. Example that will send "Hello, guys!" from "Chloe": <tt>/sendas name="Chloe" Hello, guys!</tt>. If "compact" is set to true, the message is sent using a compact layout.', true, true);
parser.addCommand('sys', sendNarratorMessage, ['nar'], '<span class="monospace">[compact=true/false (text)]</span> – sends message as a system narrator. If "compact" is set to true, the message is sent using a compact layout.', false, true);
parser.addCommand('sysname', setNarratorName, [], '<span class="monospace">(name)</span> – sets a name for future system narrator messages in this chat (display only). Default: System. Leave empty to reset.', true, true);
parser.addCommand('comment', sendCommentMessage, [], '<span class="monospace">[compact=true/false (text)]</span> – adds a note/comment message not part of the chat. If "compact" is set to true, the message is sent using a compact layout.', false, true);
parser.addCommand('single', setStoryModeCallback, ['story'], ' – sets the message style to single document mode without names or avatars visible', true, true);
parser.addCommand('bubble', setBubbleModeCallback, ['bubbles'], ' – sets the message style to bubble chat mode', true, true);
parser.addCommand('flat', setFlatModeCallback, ['default'], ' – sets the message style to flat chat mode', true, true);
parser.addCommand('continue', continueChatCallback, ['cont'], '<span class="monospace">[prompt]</span> – continues the last message in the chat, with an optional additional prompt', true, true);
parser.addCommand('go', goToCharacterCallback, ['char'], '<span class="monospace">(name)</span> – opens up a chat with the character or group by its name', true, true);
parser.addCommand('sysgen', generateSystemMessage, [], '<span class="monospace">(prompt)</span> – generates a system message using a specified prompt', true, true);
parser.addCommand('ask', askCharacter, [], '<span class="monospace">(prompt)</span> – asks a specified character card a prompt', true, true);
parser.addCommand('delname', deleteMessagesByNameCallback, ['cancel'], '<span class="monospace">(name)</span> – deletes all messages attributed to a specified name', true, true);
parser.addCommand('send', sendUserMessageCallback, [], '<span class="monospace">[compact=true/false (text)]</span> – adds a user message to the chat log without triggering a generation. If "compact" is set to true, the message is sent using a compact layout.', true, true);
parser.addCommand('trigger', triggerGenerationCallback, [], ' <span class="monospace">await=true/false</span> – triggers a message generation. If in group, can trigger a message for the specified group member index or name. If <code>await=true</code> named argument passed, the command will await for the triggered generation before continuing.', true, true);
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
parser.addCommand('gen', generateCallback, [], '<span class="monospace">(lock=on/off name="System" length=123 [prompt])</span> – generates text using the provided prompt and passes it to the next command through the pipe, optionally locking user input while generating and allowing to configure the in-prompt name for instruct mode (default = "System"). "as" argument controls the role of the output prompt: system (default) or char. If "length" argument is provided as a number in tokens, allows to temporarily override an API response length.', true, true);
parser.addCommand('genraw', generateRawCallback, [], '<span class="monospace">(lock=on/off instruct=on/off stop=[] as=system/char system="system prompt" length=123 [prompt])</span> – generates text using the provided prompt and passes it to the next command through the pipe, optionally locking user input while generating. Does not include chat history or character card. Use instruct=off to skip instruct formatting, e.g. <tt>/genraw instruct=off Why is the sky blue?</tt>. Use stop=... with a JSON-serialized array to add one-time custom stop strings, e.g. <tt>/genraw stop=["\\n"] Say hi</tt>. "as" argument controls the role of the output prompt: system (default) or char. "system" argument adds an (optional) system prompt at the start. If "length" argument is provided as a number in tokens, allows to temporarily override an API response length.', true, true);
parser.addCommand('addswipe', addSwipeCallback, ['swipeadd'], '<span class="monospace">(text)</span> – adds a swipe to the last chat message.', true, true);
parser.addCommand('abort', abortCallback, [], ' – aborts the slash command batch execution', true, true);
parser.addCommand('fuzzy', fuzzyCallback, [], 'list=["a","b","c"] threshold=0.4 (text to search) – performs a fuzzy match of each items of list within the text to search. If any item matches then its name is returned. If no item list matches the text to search then no value is returned. The optional threshold (default is 0.4) allows some control over the matching. A low value (min 0.0) means the match is very strict. At 1.0 (max) the match is very loose and probably matches anything. The returned value passes to the next command through the pipe.', true, true); parser.addCommand('pass', (_, arg) => arg, ['return'], '<span class="monospace">(text)</span> – passes the text to the next command through the pipe.', true, true);
parser.addCommand('delay', delayCallback, ['wait', 'sleep'], '<span class="monospace">(milliseconds)</span> – delays the next command in the pipe by the specified number of milliseconds.', true, true);
parser.addCommand('input', inputCallback, ['prompt'], '<span class="monospace">(default="string" large=on/off wide=on/off okButton="string" rows=number [text])</span> – Shows a popup with the provided text and an input field. The default argument is the default value of the input field, and the text argument is the text to display.', true, true);
parser.addCommand('run', runCallback, ['call', 'exec'], '<span class="monospace">[key1=value key2=value ...] ([qrSet.]qrLabel)</span> – runs a Quick Reply with the specified name from a currently active preset or from another preset, named arguments can be referenced in a QR with {{arg::key}}.', true, true);
parser.addCommand('messages', getMessagesCallback, ['message'], '<span class="monospace">(names=off/on [message index or range])</span> – returns the specified message or range of messages as a string.', true, true);
parser.addCommand('setinput', setInputCallback, [], '<span class="monospace">(text)</span> – sets the user input to the specified text and passes it to the next command through the pipe.', true, true);
parser.addCommand('popup', popupCallback, [], '<span class="monospace">(large=on/off wide=on/off okButton="string" text)</span> – shows a blocking popup with the specified text and buttons. Returns the input value into the pipe or empty string if canceled.', true, true);
parser.addCommand('buttons', buttonsCallback, [], '<span class="monospace">labels=["a","b"] (text)</span> – shows a blocking popup with the specified text and buttons. Returns the clicked button label into the pipe or empty string if canceled.', true, true);
parser.addCommand('trimtokens', trimTokensCallback, [], '<span class="monospace">limit=number (direction=start/end [text])</span> – trims the start or end of text to the specified number of tokens.', true, true);
parser.addCommand('trimstart', trimStartCallback, [], '<span class="monospace">(text)</span> – trims the text to the start of the first full sentence.', true, true);
parser.addCommand('trimend', trimEndCallback, [], '<span class="monospace">(text)</span> – trims the text to the end of the last full sentence.', true, true);
parser.addCommand('inject', injectCallback, [], '<span class="monospace">id=injectId (position=before/after/chat depth=number scan=true/false role=system/user/assistant [text])</span> – injects a text into the LLM prompt for the current chat. Requires a unique injection ID. Positions: "before" main prompt, "after" main prompt, in-"chat" (default: after). Depth: injection depth for the prompt (default: 4). Role: role for in-chat injections (default: system). Scan: include injection content into World Info scans (default: false).', true, true);
parser.addCommand('listinjects', listInjectsCallback, [], ' – lists all script injections for the current chat.', true, true);
parser.addCommand('flushinjects', flushInjectsCallback, [], ' – removes all script injections for the current chat.', true, true);
parser.addCommand('tokens', (_, text) => getTokenCountAsync(text), [], '<span class="monospace">(text)</span> – counts the number of tokens in the text.', true, true);
parser.addCommand('model', modelCallback, [], '<span class="monospace">(model name)</span> – sets the model for the current API. Gets the current model name if no argument is provided.', true, true);
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
    const roles = {
        'system': extension_prompt_roles.SYSTEM,
        'user': extension_prompt_roles.USER,
        'assistant': extension_prompt_roles.ASSISTANT,
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
    const roleValue = typeof args?.role === 'string' ? args.role.toLowerCase().trim() : Number(args?.role ?? extension_prompt_roles.SYSTEM);
    const role = roles[roleValue] ?? roles[extension_prompt_roles.SYSTEM];
    const scan = isTrueBoolean(args?.scan);
    value = value || '';

    const prefixedId = `${SCRIPT_PROMPT_KEY}${id}`;

    if (!chat_metadata.script_injects) {
        chat_metadata.script_injects = {};
    }

    chat_metadata.script_injects[id] = {
        value,
        position,
        depth,
        scan,
        role,
    };

    setExtensionPrompt(prefixedId, value, position, depth, scan, role);
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
            return `* **${id}**: <code>${inject.value}</code> (${positionName}, depth: ${inject.depth}, scan: ${inject.scan ?? false}, role: ${inject.role ?? extension_prompt_roles.SYSTEM})`;
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
        setExtensionPrompt(prefixedId, '', inject.position, inject.depth, inject.scan, inject.role);
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
        setExtensionPrompt(prefixedId, inject.value, inject.position, inject.depth, inject.scan, inject.role);
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

async function trimTokensCallback(arg, value) {
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
    const tokenCount = await getTokenCountAsync(value);

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
        const { text } = decodeTextTokens(tokenizerId, sliceTokens);
        return text;
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

async function runCallback(args, name) {
    if (!name) {
        throw new Error('No name provided for /run command');
    }

    /**@type {SlashCommandScope} */
    const scope = args._scope;
    if (scope.existsVariable(name)) {
        const closure = scope.getVariable(name);
        if (!(closure instanceof SlashCommandClosure)) {
            throw new Error(`"${name}" is not callable.`);
        }
        closure.scope.parent = scope;
        Object.keys(closure.arguments).forEach(key=>{
            if (Object.keys(args).includes(key)) {
                closure.providedArguments[key] = args[key];
            }
        });
        const result = await closure.execute();
        return result.pipe;
    }

    if (typeof window['executeQuickReplyByName'] !== 'function') {
        throw new Error('Quick Reply extension is not loaded');
    }

    try {
        name = name.trim();
        return await window['executeQuickReplyByName'](name, args);
    } catch (error) {
        throw new Error(`Error running Quick Reply "${name}": ${error.message}`, 'Error');
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

/**
 * Each item in "args.list" is searched within "search_item" using fuzzy search. If any matches it returns the matched "item".
 * @param {FuzzyCommandArgs} args - arguments containing "list" (JSON array) and optionaly "threshold" (float between 0.0 and 1.0)
 * @param {string} searchInValue - the string where items of list are searched
 * @returns {string} - the matched item from the list
 * @typedef {{list: string, threshold: string}} FuzzyCommandArgs - arguments for /fuzzy command
 * @example /fuzzy list=["down","left","up","right"] "he looks up" | /echo // should return "up"
 * @link https://www.fusejs.io/
 */
function fuzzyCallback(args, searchInValue) {
    if (!searchInValue) {
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

        const params = {
            includeScore: true,
            findAllMatches: true,
            ignoreLocation: true,
            threshold: 0.4,
        };
        // threshold determines how strict is the match, low threshold value is very strict, at 1 (nearly?) everything matches
        if ('threshold' in args) {
            params.threshold = parseFloat(resolveVariable(args.threshold));
            if (isNaN(params.threshold)) {
                console.warn('WARN: \'threshold\' argument must be a float between 0.0 and 1.0 for /fuzzy command');
                return '';
            }
            if (params.threshold < 0) {
                params.threshold = 0;
            }
            if (params.threshold > 1) {
                params.threshold = 1;
            }
        }

        const fuse = new Fuse([searchInValue], params);
        // each item in the "list" is searched within "search_item", if any matches it returns the matched "item"
        for (const searchItem of list) {
            const result = fuse.search(searchItem);
            if (result.length > 0) {
                console.info('fuzzyCallback Matched: ' + searchItem);
                return searchItem;
            }
        }
        return '';
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
    const as = args?.as || 'system';
    const quietToLoud = as === 'char';
    const systemPrompt = resolveVariable(args?.system) || '';
    const length = Number(resolveVariable(args?.length) ?? 0) || 0;

    try {
        if (lock) {
            deactivateSendButtons();
        }

        setEphemeralStopStrings(resolveVariable(args?.stop));
        const result = await generateRaw(value, '', isFalseBoolean(args?.instruct), quietToLoud, systemPrompt, length);
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
    const as = args?.as || 'system';
    const quietToLoud = as === 'char';
    const length = Number(resolveVariable(args?.length) ?? 0) || 0;

    try {
        if (lock) {
            deactivateSendButtons();
        }

        setEphemeralStopStrings(resolveVariable(args?.stop));
        const name = args?.name;
        const result = await generateQuietPrompt(value, quietToLoud, false, '', name, length);
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

    await hideChatMessageRange(range.start, range.end, false);
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

    await hideChatMessageRange(range.start, range.end, true);
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

async function triggerGenerationCallback(args, value) {
    const shouldAwait = isTrueBoolean(args?.await);
    const outerPromise = new Promise((outerResolve) => setTimeout(async () => {
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

        if (selected_group && value) {
            chid = findGroupMemberId(value);

            if (chid === undefined) {
                console.warn(`WARN: No group member found for argument ${value}`);
            }
        }

        outerResolve(new Promise(innerResolve => setTimeout(() => innerResolve(Generate('normal', { force_chid: chid })), 100)));
    }, 1));

    if (shouldAwait) {
        const innerPromise = await outerPromise;
        await innerPromise;
    }

    return '';
}

async function sendUserMessageCallback(args, text) {
    if (!text) {
        console.warn('WARN: No text provided for /send command');
        return;
    }

    text = text.trim();
    const compact = isTrueBoolean(args?.compact);
    const bias = extractMessageBias(text);
    const insertAt = Number(resolveVariable(args?.at));
    await sendMessageAsUser(text, bias, insertAt, compact);
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

    const exactAvatarMatch = characters.findIndex(x => x.avatar === name);

    if (exactAvatarMatch !== -1) {
        return exactAvatarMatch;
    }

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
        setActiveCharacter(characters[characterIndex]?.avatar);
        setActiveGroup(null);
        return characters[characterIndex]?.name;
    } else {
        const group = groups.find(it => it.name.toLowerCase() == name.toLowerCase());
        if (group) {
            await openGroupById(group.id);
            setActiveCharacter(null);
            setActiveGroup(group.id);
            return group.name;
        } else {
            console.warn(`No matches found for name "${name}"`);
            return '';
        }
    }
}

async function openChat(id) {
    resetSelectedGroup();
    setCharacterId(id);
    await delay(1);
    await reloadCurrentChat();
}

function continueChatCallback(_, prompt) {
    setTimeout(async () => {
        try {
            await waitUntilCondition(() => !is_send_press && !is_group_generating, 10000, 100);
        } catch {
            console.warn('Timeout waiting for generation unlock');
            toastr.warning('Cannot run /continue command while the reply is being generated.');
        }

        // Prevent infinite recursion
        $('#send_textarea').val('').trigger('input');
        $('#option_continue').trigger('click', { fromSlashCommand: true, additionalPrompt: prompt });
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
            retriggerFirstMessageOnEmptyChat();
            return;
        }
    }

    // Otherwise, set just the name
    setUserName(name); //this prevented quickReply usage
    retriggerFirstMessageOnEmptyChat();
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
    const compact = isTrueBoolean(args?.compact);

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
            isSmallSys: compact,
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
    const compact = isTrueBoolean(args?.compact);

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
            isSmallSys: compact,
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

    const compact = isTrueBoolean(args?.compact);
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
            isSmallSys: compact,
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
        // allow reporting of the background name if called without args
        // for use in ST Scripts via pipe
        return background_settings.name;
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
 * Sets a model for the current API.
 * @param {object} _ Unused
 * @param {string} model New model name
 * @returns {string} New or existing model name
 */
function modelCallback(_, model) {
    const modelSelectMap = [
        { id: 'model_togetherai_select', api: 'textgenerationwebui', type: textgen_types.TOGETHERAI },
        { id: 'openrouter_model', api: 'textgenerationwebui', type: textgen_types.OPENROUTER },
        { id: 'model_infermaticai_select', api: 'textgenerationwebui', type: textgen_types.INFERMATICAI },
        { id: 'model_dreamgen_select', api: 'textgenerationwebui', type: textgen_types.DREAMGEN },
        { id: 'mancer_model', api: 'textgenerationwebui', type: textgen_types.MANCER },
        { id: 'aphrodite_model', api: 'textgenerationwebui', type: textgen_types.APHRODITE },
        { id: 'ollama_model', api: 'textgenerationwebui', type: textgen_types.OLLAMA },
        { id: 'model_openai_select', api: 'openai', type: chat_completion_sources.OPENAI },
        { id: 'model_claude_select', api: 'openai', type: chat_completion_sources.CLAUDE },
        { id: 'model_windowai_select', api: 'openai', type: chat_completion_sources.WINDOWAI },
        { id: 'model_openrouter_select', api: 'openai', type: chat_completion_sources.OPENROUTER },
        { id: 'model_ai21_select', api: 'openai', type: chat_completion_sources.AI21 },
        { id: 'model_google_select', api: 'openai', type: chat_completion_sources.MAKERSUITE },
        { id: 'model_mistralai_select', api: 'openai', type: chat_completion_sources.MISTRALAI },
        { id: 'model_custom_select', api: 'openai', type: chat_completion_sources.CUSTOM },
        { id: 'model_cohere_select', api: 'openai', type: chat_completion_sources.COHERE },
        { id: 'model_novel_select', api: 'novel', type: null },
        { id: 'horde_model', api: 'koboldhorde', type: null },
    ];

    function getSubType() {
        switch (main_api) {
            case 'textgenerationwebui':
                return textgenerationwebui_settings.type;
            case 'openai':
                return oai_settings.chat_completion_source;
            default:
                return null;
        }
    }

    const apiSubType = getSubType();
    const modelSelectItem = modelSelectMap.find(x => x.api == main_api && x.type == apiSubType)?.id;

    if (!modelSelectItem) {
        toastr.info('Setting a model for your API is not supported or not implemented yet.');
        return '';
    }

    const modelSelectControl = document.getElementById(modelSelectItem);

    if (!(modelSelectControl instanceof HTMLSelectElement)) {
        toastr.error(`Model select control not found: ${main_api}[${apiSubType}]`);
        return '';
    }

    const options = Array.from(modelSelectControl.options);

    if (!options.length) {
        toastr.warning('No model options found. Check your API settings.');
        return '';
    }

    model = String(model || '').trim();

    if (!model) {
        return modelSelectControl.value;
    }

    console.log('Set model to ' + model);

    let newSelectedOption = null;

    const fuse = new Fuse(options, { keys: ['text', 'value'] });
    const fuzzySearchResult = fuse.search(model);

    const exactValueMatch = options.find(x => x.value.trim().toLowerCase() === model.trim().toLowerCase());
    const exactTextMatch = options.find(x => x.text.trim().toLowerCase() === model.trim().toLowerCase());

    if (exactValueMatch) {
        newSelectedOption = exactValueMatch;
    } else if (exactTextMatch) {
        newSelectedOption = exactTextMatch;
    } else if (fuzzySearchResult.length) {
        newSelectedOption = fuzzySearchResult[0].item;
    }

    if (newSelectedOption) {
        modelSelectControl.value = newSelectedOption.value;
        $(modelSelectControl).trigger('change');
        toastr.success(`Model set to "${newSelectedOption.text}"`);
        return newSelectedOption.value;
    } else {
        toastr.warning(`No model found with name "${model}"`);
        return '';
    }
}

/**
 * Executes slash commands in the provided text
 * @param {string} text Slash command text
 * @param {boolean} handleParserErrors Whether to handle parser errors (show toast on error) or throw
 * @param {SlashCommandScope} scope The scope to be used when executing the commands.
 * @returns {Promise<SlashCommandClosureResult>}
 */
async function executeSlashCommands(text, handleParserErrors = true, scope = null, handleExecutionErrors = false) {
    if (!text) {
        return null;
    }

    let closure;
    try {
        closure = parser.parse(text);
        closure.scope.parent = scope;
    } catch (e) {
        if (handleParserErrors && e instanceof SlashCommandParserError) {
            /**@type {SlashCommandParserError}*/
            const ex = e;
            const toast = `
                <div>${ex.message}</div>
                <div>Line: ${ex.line} Column: ${ex.column}</div>
                <pre style="text-align:left;">${ex.hint}</pre>
            `;
            toastr.error(
                toast,
                'SlashCommandParserError',
                { escapeHtml:false, timeOut: 10000, onclick:()=>callPopup(toast, 'text') },
            );
            const result = new SlashCommandClosureResult();
            result.interrupt = true;
            return result;
        } else {
            throw e;
        }
    }

    try {
        return await closure.execute();
    } catch (e) {
        if (handleExecutionErrors) {
            toastr.error(e.message);
            const result = new SlashCommandClosureResult();
            result.interrupt = true;
            return result;
        } else {
            throw e;
        }
    }
}

/**
 *
 * @param {HTMLTextAreaElement} textarea The textarea to receive autocomplete
 * @param {Boolean} isFloating Whether to show the auto complete as a floating window (e.g., large QR editor)
 */
export async function setSlashCommandAutoComplete(textarea, isFloating = false) {
    const dom = document.createElement('ul'); {
        dom.classList.add('slashCommandAutoComplete');
    }
    let isReplacable = false;
    /**@type {SlashCommandAutoCompleteOption[]} */
    let result = [];
    let selectedItem = null;
    let isActive = false;
    let text;
    /**@type {SlashCommandParserNameResult}*/
    let parserResult;
    let clone;
    let startQuote;
    let endQuote;
    /**@type {Object.<string,HTMLElement>} */
    const items = {};
    let hasCache = false;
    let selectionStart;
    const makeItem = (key, typeIcon, noSlash, helpString = '', aliasList = []) => {
        const li = document.createElement('li'); {
            li.classList.add('item');
            const type = document.createElement('span'); {
                type.classList.add('type');
                type.classList.add('monospace');
                type.textContent = typeIcon;
                li.append(type);
            }
            const name = document.createElement('span'); {
                name.classList.add('name');
                name.classList.add('monospace');
                name.textContent = noSlash ? '' : '/';
                key.split('').forEach(char=>{
                    const span = document.createElement('span'); {
                        span.textContent = char;
                        name.append(span);
                    }
                });
                li.append(name);
            }
            li.append(' ');
            const help = document.createElement('span'); {
                help.classList.add('help');
                help.innerHTML = helpString;
                li.append(help);
            }
            if (aliasList.length > 0) {
                const aliases = document.createElement('span'); {
                    aliases.classList.add('aliases');
                    aliases.append(' (alias: ');
                    for (const aliasName of aliasList) {
                        const alias = document.createElement('span'); {
                            alias.classList.add('monospace');
                            alias.textContent = `/${aliasName}`;
                            aliases.append(alias);
                        }
                    }
                    aliases.append(')');
                    li.append(aliases);
                }
            }
            // gotta listen to pointerdown (happens before textarea-blur)
            li.addEventListener('pointerdown', ()=>{
                // gotta catch pointerup to restore focus to textarea (blurs after pointerdown)
                pointerup = new Promise(resolve=>{
                    const resolver = ()=>{
                        window.removeEventListener('pointerup', resolver);
                        resolve();
                    };
                    window.addEventListener('pointerup', resolver);
                });
                select();
            });
        }
        return li;
    };
    const hide = () => {
        dom?.remove();
        isActive = false;
    };
    const show = async(isInput = false, isForced = false) => {
        //TODO check if isInput and isForced are both required
        text = textarea.value;
        // only show with textarea in focus
        if (document.activeElement != textarea) return hide();
        // only show for slash commands
        if (text[0] != '/') return hide();

        if (!hasCache) {
            hasCache = true;
            // init by appending all command options
            Object.keys(parser.commands).forEach(key=>{
                const cmd = parser.commands[key];
                items[key] = makeItem(key, '/', false, cmd.helpString, [cmd.name, ...(cmd.aliases ?? [])].filter(it=>it != key));
            });
        }

        // request parser to get command executor (potentially "incomplete", i.e. not an actual existing command) for
        // cursor position
        parserResult = parser.getNameAt(text, textarea.selectionStart);
        switch (parserResult?.type) {
            case NAME_RESULT_TYPE.CLOSURE: {
                startQuote = text[parserResult.start - 2] == '"';
                endQuote = startQuote && text[parserResult.start - 2 + parserResult.name.length + 1] == '"';
                try {
                    const qrApi = (await import('./extensions/quick-reply/index.js')).quickReplyApi;
                    parserResult.optionList.push(...qrApi.listSets()
                        .map(set=>qrApi.listQuickReplies(set).map(qr=>`${set}.${qr}`))
                        .flat()
                        .map(qr=>new SlashCommandAutoCompleteOption(OPTION_TYPE.QUICK_REPLY, qr, qr)),
                    );
                } catch { /* empty */ }
                break;
            }
            case NAME_RESULT_TYPE.COMMAND: {
                parserResult.optionList.push(...Object.keys(parser.commands)
                    .map(key=>new SlashCommandAutoCompleteOption(OPTION_TYPE.COMMAND, parser.commands[key], key)),
                );
                break;
            }
            default: {
                // no result
                break;
            }
        }
        let slashCommand = parserResult?.name?.toLowerCase() ?? '';
        // do autocomplete if triggered by a user input and we either don't have an executor or the cursor is at the end
        // of the name part of the command
        switch (parserResult?.type) {
            case NAME_RESULT_TYPE.CLOSURE: {
                isReplacable = isInput && (!parserResult ? true : textarea.selectionStart == parserResult.start - 2 + parserResult.name.length + (startQuote ? 1 : 0));
                break;
            }
            default: // no result
            case NAME_RESULT_TYPE.COMMAND: {
                isReplacable = isInput && (!parserResult ? true : textarea.selectionStart == parserResult.start - 2 + parserResult.name.length);
                break;
            }
        }

        // if [forced (ctrl+space) or user input] and cursor is in the middle of the name part (not at the end)
        if (isForced || isInput) {
            switch (parserResult?.type) {
                case NAME_RESULT_TYPE.CLOSURE: {
                    if (textarea.selectionStart >= parserResult.start - 2 && textarea.selectionStart <= parserResult.start - 2 + parserResult.name.length + (startQuote ? 1 : 0)) {
                        slashCommand = slashCommand.slice(0, textarea.selectionStart - (parserResult.start - 2) - (startQuote ? 1 : 0));
                        parserResult.name = slashCommand;
                        isReplacable = true;
                    }
                    break;
                }
                case NAME_RESULT_TYPE.COMMAND: {
                    if (textarea.selectionStart >= parserResult.start - 2 && textarea.selectionStart <= parserResult.start - 2 + parserResult.name.length) {
                        slashCommand = slashCommand.slice(0, textarea.selectionStart - (parserResult.start - 2));
                        parserResult.name = slashCommand;
                        isReplacable = true;
                    }
                    break;
                }
                default: {
                    // no result
                    break;
                }
            }
        }

        const matchType = power_user.stscript?.matching ?? 'strict';
        const fuzzyRegex = new RegExp(`^(.*?)${slashCommand.split('').map(char=>`(${escapeRegex(char)})`).join('(.*?)')}(.*?)$`, 'i');
        const matchers = {
            'strict': (name) => name.toLowerCase().startsWith(slashCommand),
            'includes': (name) => name.toLowerCase().includes(slashCommand),
            'fuzzy': (name) => fuzzyRegex.test(name),
        };
        /**
         *
         * @param {SlashCommandAutoCompleteOption} option
         * @returns
         */
        const fuzzyScore = (option) => {
            const parts = fuzzyRegex.exec(option.name).slice(1, -1);
            let start = null;
            let consecutive = [];
            let current = '';
            let offset = 0;
            parts.forEach((part, idx) => {
                if (idx % 2 == 0) {
                    if (part.length > 0) {
                        if (current.length > 0) {
                            consecutive.push(current);
                        }
                        current = '';
                    }
                } else {
                    if (start === null) {
                        start = offset;
                    }
                    current += part;
                }
                offset += part.length;
            });
            if (current.length > 0) {
                consecutive.push(current);
            }
            consecutive.sort((a,b)=>b.length - a.length);
            option.score = new SlashCommandFuzzyScore(start, consecutive[0]?.length ?? 0);
            return option;
        };
        /**
         * @param {SlashCommandAutoCompleteOption} a
         * @param {SlashCommandAutoCompleteOption} b
         */
        const fuzzyScoreCompare = (a, b) => {
            if (a.score.start < b.score.start) return -1;
            if (a.score.start > b.score.start) return 1;
            if (a.score.longestConsecutive > b.score.longestConsecutive) return -1;
            if (a.score.longestConsecutive < b.score.longestConsecutive) return 1;
            return a.name.localeCompare(b.name);
        };
        /**
         *
         * @param {SlashCommandAutoCompleteOption} item
         */
        const updateName = (item) => {
            const chars = Array.from(item.dom.querySelector('.name').children);
            switch (matchType) {
                case 'strict': {
                    chars.forEach((it, idx)=>{
                        if (idx < item.name.length) {
                            it.classList.add('matched');
                        } else {
                            it.classList.remove('matched');
                        }
                    });
                    break;
                }
                case 'includes': {
                    const start = item.name.toLowerCase().search(slashCommand);
                    chars.forEach((it, idx)=>{
                        if (idx < start) {
                            it.classList.remove('matched');
                        } else if (idx < start + item.name.length) {
                            it.classList.add('matched');
                        } else {
                            it.classList.remove('matched');
                        }
                    });
                    break;
                }
                case 'fuzzy': {
                    item.name.replace(fuzzyRegex, (_, ...parts)=>{
                        parts.splice(-2, 2);
                        if (parts.length == 2) {
                            chars.forEach(c=>c.classList.remove('matched'));
                        } else {
                            let cIdx = 0;
                            parts.forEach((it, idx)=>{
                                if (it === null || it.length == 0) return '';
                                if (idx % 2 == 1) {
                                    chars.slice(cIdx, cIdx + it.length).forEach(c=>c.classList.add('matched'));
                                } else {
                                    chars.slice(cIdx, cIdx + it.length).forEach(c=>c.classList.remove('matched'));
                                }
                                cIdx += it.length;
                            });
                        }
                        return '';
                    });
                }
            }
            return item;
        };

        // don't show if no executor found, i.e. cursor's area is not a command
        if (!parserResult) return hide();
        else {
            let matchingOptions = parserResult.optionList
                .filter(it => isReplacable || it.name == '' ? matchers[matchType](it.name) : it.name.toLowerCase() == slashCommand) // Filter by the input
                .filter((it,idx,list) => list.findIndex(opt=>opt.value == it.value) == idx)
            ;
            result = matchingOptions
                .filter((it,idx) => matchingOptions.indexOf(it) == idx)
                .map(option => {
                    let li;
                    switch (option.type) {
                        case OPTION_TYPE.QUICK_REPLY: {
                            li = makeItem(option.name, 'QR', true);
                            break;
                        }
                        case OPTION_TYPE.VARIABLE_NAME: {
                            li = makeItem(option.name, '𝑥', true);
                            break;
                        }
                        case OPTION_TYPE.COMMAND: {
                            li = items[option.name];
                            break;
                        }
                    }
                    option.replacer = option.name.includes(' ') || startQuote || endQuote ? `"${option.name}"` : `${option.name}`;
                    option.dom = li;
                    if (matchType == 'fuzzy') fuzzyScore(option);
                    updateName(option);
                    return option;
                }) // Map to the help string and score
                .toSorted(matchType == 'fuzzy' ? fuzzyScoreCompare : (a, b) => a.name.localeCompare(b.name)) // sort by score (if fuzzy) or name
            ;
        }

        if (result.length == 0) {
            // no result and no input? hide autocomplete
            if (!isInput) {
                return hide();
            }
            // otherwise add "no match" notice
            switch (parserResult?.type) {
                case NAME_RESULT_TYPE.CLOSURE: {
                    const li = document.createElement('li'); {
                        li.textContent = slashCommand.length ?
                            `No matching variables in scope and no matching Quick Replies for "${slashCommand}"`
                            : 'No variables in scope and no Quick Replies found.';
                    }
                    result.push({
                        name: '',
                        value: null,
                        score: null,
                        li,
                    });
                    break;
                }
                case NAME_RESULT_TYPE.COMMAND: {
                    const li = document.createElement('li'); {
                        li.textContent = `No matching commands for "/${slashCommand}"`;
                    }
                    result.push({
                        name: '',
                        value: null,
                        score: null,
                        li,
                    });
                    break;
                }
            }
        } else if (result.length == 1 && parserResult && result[0].name == parserResult.name) {
            // only one result that is exactly the current value? just show hint, no autocomplete
            isReplacable = false;
        } else if (!isReplacable && result.length > 1) {
            return hide();
        }
        selectedItem = result[0];
        isActive = true;
        renderDebounced();
    };
    const render = ()=>{
        // render autocomplete list
        dom.innerHTML = '';
        dom.classList.remove('defaultDark');
        dom.classList.remove('defaultLight');
        dom.classList.remove('defaultThemed');
        switch (power_user.stscript.autocomplete_style ?? 'theme') {
            case 'dark': {
                dom.classList.add('defaultDark');
                break;
            }
            case 'light': {
                dom.classList.add('defaultLight');
                break;
            }
            case 'theme':
            default: {
                dom.classList.add('defaultThemed');
                break;
            }
        }
        const frag = document.createDocumentFragment();
        for (const item of result) {
            if (item == selectedItem) {
                item.dom.classList.add('selected');
            } else {
                item.dom.classList.remove('selected');
            }
            frag.append(item.dom);
        }
        dom.append(frag);
        updatePosition();
        document.body.append(dom);
        // prevType = parserResult.type;
    };
    const renderDebounced = debounce(render, 100);
    const updatePosition = () => {
        if (isFloating) {
            updateFloatingPosition();
        } else {
            const rect = textarea.getBoundingClientRect();
            dom.style.setProperty('--bottom', `${window.innerHeight - rect.top}px`);
            dom.style.bottom = `${window.innerHeight - rect.top}px`;
            dom.style.left = `${rect.left}px`;
            dom.style.right = `${window.innerWidth - rect.right}px`;
        }
    };
    const updateFloatingPosition = () => {
        const location = getCursorPosition();
        const rect = textarea.getBoundingClientRect();
        if (location.bottom < rect.top || location.top > rect.bottom || location.left < rect.left || location.left > rect.right) return hide();
        const left = Math.max(rect.left, location.left);
        if (location.top <= window.innerHeight / 2) {
            // if cursor is in lower half of window, show list above line
            dom.style.top = `${location.bottom}px`;
            dom.style.bottom = 'auto';
            dom.style.left = `${left}px`;
            dom.style.right = 'auto';
            dom.style.maxWidth = `calc(99vw - ${left}px)`;
            dom.style.maxHeight = `calc(${location.bottom}px - 1vh)`;
        } else {
            // if cursor is in upper half of window, show list below line
            dom.style.top = 'auto';
            dom.style.bottom = `calc(100vh - ${location.top}px)`;
            dom.style.left = `${left}px`;
            dom.style.right = 'auto';
            dom.style.maxWidth = `calc(99vw - ${left}px)`;
            dom.style.maxHeight = `calc(${location.top}px - 1vh)`;
        }
    };
    /**
     * Creates a temporary invisible clone of the textarea to determine cursor coordinates.
     * @returns {{left:Number, top:Number, bottom:Number}} cursor coordinates
     */
    const getCursorPosition = () => {
        const inputRect = textarea.getBoundingClientRect();
        // clone?.remove();
        const style = window.getComputedStyle(textarea);
        if (!clone) {
            clone = document.createElement('div');
            for (const key of style) {
                clone.style[key] = style[key];
            }
            clone.style.position = 'fixed';
            clone.style.visibility = 'hidden';
            document.body.append(clone);
            const mo = new MutationObserver(muts=>{
                if (muts.find(it=>Array.from(it.removedNodes).includes(textarea))) {
                    clone.remove();
                }
            });
            mo.observe(textarea.parentElement, { childList:true });
        }
        clone.style.height = `${inputRect.height}px`;
        clone.style.left = `${inputRect.left}px`;
        clone.style.top = `${inputRect.top}px`;
        clone.style.whiteSpace = style.whiteSpace;
        clone.style.tabSize = style.tabSize;
        const text = textarea.value;
        const before = text.slice(0, textarea.selectionStart);
        clone.textContent = before;
        const locator = document.createElement('span');
        locator.textContent = text[textarea.selectionStart];
        clone.append(locator);
        clone.append(text.slice(textarea.selectionStart + 1));
        clone.scrollTop = textarea.scrollTop;
        clone.scrollLeft = textarea.scrollLeft;
        const locatorRect = locator.getBoundingClientRect();
        const location = {
            left: locatorRect.left,
            top: locatorRect.top,
            bottom: locatorRect.bottom,
        };
        // clone.remove();
        return location;
    };
    let pointerup = Promise.resolve();
    const select = async() => {
        if (isReplacable && selectedItem.value !== null) {
            textarea.value = `${text.slice(0, parserResult.start - 2)}${selectedItem.replacer}${text.slice(parserResult.start - 2 + parserResult.name.length + (startQuote ? 1 : 0) + (endQuote ? 1 : 0))}`;
            await pointerup;
            textarea.focus();
            textarea.selectionStart = parserResult.start - 2 + selectedItem.replacer.length;
            textarea.selectionEnd = textarea.selectionStart;
            show();
        }
    };
    const showAutoCompleteDebounced = show;
    textarea.addEventListener('input', ()=>showAutoCompleteDebounced(true));
    textarea.addEventListener('click', ()=>showAutoCompleteDebounced());
    textarea.addEventListener('selectionchange', ()=>showAutoCompleteDebounced());
    textarea.addEventListener('keydown', async(evt)=>{
        // autocomplete is shown and cursor at end of current command name (or inside name and typed or forced)
        if (isActive && isReplacable) {
            switch (evt.key) {
                case 'ArrowUp': {
                    // select previous item
                    if (evt.ctrlKey || evt.altKey || evt.shiftKey) return;
                    evt.preventDefault();
                    evt.stopPropagation();
                    const idx = result.indexOf(selectedItem);
                    let newIdx;
                    if (idx == 0) newIdx = result.length - 1;
                    else newIdx = idx - 1;
                    selectedItem.dom.classList.remove('selected');
                    selectedItem = result[newIdx];
                    selectedItem.dom.classList.add('selected');
                    const rect = selectedItem.dom.getBoundingClientRect();
                    const rectParent = dom.getBoundingClientRect();
                    if (rect.top < rectParent.top || rect.bottom > rectParent.bottom ) {
                        selectedItem.dom.scrollIntoView();
                    }
                    return;
                }
                case 'ArrowDown': {
                    // select next item
                    if (evt.ctrlKey || evt.altKey || evt.shiftKey) return;
                    evt.preventDefault();
                    evt.stopPropagation();
                    const idx = result.indexOf(selectedItem);
                    const newIdx = (idx + 1) % result.length;
                    selectedItem.dom.classList.remove('selected');
                    selectedItem = result[newIdx];
                    selectedItem.dom.classList.add('selected');
                    const rect = selectedItem.dom.getBoundingClientRect();
                    const rectParent = dom.getBoundingClientRect();
                    if (rect.top < rectParent.top || rect.bottom > rectParent.bottom ) {
                        selectedItem.dom.scrollIntoView();
                    }
                    return;
                }
                case 'Enter':
                case 'Tab': {
                    // pick the selected item to autocomplete
                    if (evt.ctrlKey || evt.altKey || evt.shiftKey) return;
                    evt.preventDefault();
                    evt.stopImmediatePropagation();
                    select();
                    return;
                }
            }
        }
        // autocomplete is shown, cursor can be anywhere
        if (isActive) {
            switch (evt.key) {
                case 'Escape': {
                    // close autocomplete
                    if (evt.ctrlKey || evt.altKey || evt.shiftKey) return;
                    evt.preventDefault();
                    evt.stopPropagation();
                    hide();
                    return;
                }
                case 'Enter': {
                    // hide autocomplete on enter (send, execute, ...)
                    if (!evt.shiftKey) {
                        hide();
                        return;
                    }
                    break;
                }
            }
        }
        // autocomplete shown or not, cursor anywhere
        switch (evt.key) {
            case ' ': {
                if (evt.ctrlKey) {
                    // ctrl-space to force show autocomplete
                    showAutoCompleteDebounced(true, true);
                    return;
                }
                break;
            }
        }
        if (['Control', 'Shift', 'Alt'].includes(evt.key)) {
            // ignore keydown on modifier keys
            return;
        }
        switch (evt.key) {
            default:
            case 'ArrowUp':
            case 'ArrowDown':
            case 'ArrowRight':
            case 'ArrowLeft': {
                // keyboard navigation, wait for keyup to complete cursor move
                const oldText = textarea.value;
                await new Promise(resolve=>{
                    const keyUpListener = ()=>{
                        window.removeEventListener('keyup', keyUpListener);
                        resolve();
                    };
                    window.addEventListener('keyup', keyUpListener);
                });
                if (selectionStart != textarea.selectionStart) {
                    selectionStart = textarea.selectionStart;
                    showAutoCompleteDebounced(oldText != textarea.value);
                }
            }
        }
    });
    // textarea.addEventListener('blur', ()=>hide());
    if (isFloating) {
        textarea.addEventListener('scroll', debounce(updateFloatingPosition, 100));
    }
    window.addEventListener('resize', debounce(updatePosition, 100));
}
/**@type {HTMLTextAreaElement} */
const sendTextarea = document.querySelector('#send_textarea');
setSlashCommandAutoComplete(sendTextarea);
sendTextarea.addEventListener('input', () => {
    if (sendTextarea.value[0] == '/') {
        sendTextarea.style.fontFamily = 'monospace';
    } else {
        sendTextarea.style.fontFamily = null;
    }
});
