import {
    Generate,
    UNIQUE_APIS,
    activateSendButtons,
    addOneMessage,
    api_server,
    callPopup,
    characters,
    chat,
    chat_metadata,
    comment_avatar,
    deactivateSendButtons,
    default_avatar,
    deleteSwipe,
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
    name2,
    neutralCharacterName,
    reloadCurrentChat,
    removeMacros,
    renameCharacter,
    saveChatConditional,
    sendMessageAsUser,
    sendSystemMessage,
    setActiveCharacter,
    setActiveGroup,
    setCharacterId,
    setCharacterName,
    setExtensionPrompt,
    setUserName,
    stopGeneration,
    substituteParams,
    system_avatar,
    system_message_types,
    this_chid,
} from '../script.js';
import { SlashCommandParser } from './slash-commands/SlashCommandParser.js';
import { SlashCommandParserError } from './slash-commands/SlashCommandParserError.js';
import { getMessageTimeStamp } from './RossAscends-mods.js';
import { hideChatMessageRange } from './chats.js';
import { getContext, saveMetadataDebounced } from './extensions.js';
import { getRegexedString, regex_placement } from './extensions/regex/engine.js';
import { findGroupMemberId, groups, is_group_generating, openGroupById, resetSelectedGroup, saveGroupChat, selected_group } from './group-chats.js';
import { chat_completion_sources, oai_settings, setupChatCompletionPromptManager } from './openai.js';
import { autoSelectPersona, retriggerFirstMessageOnEmptyChat, setPersonaLockState, togglePersonaLock, user_avatar } from './personas.js';
import { addEphemeralStoppingString, chat_styles, flushEphemeralStoppingStrings, power_user } from './power-user.js';
import { SERVER_INPUTS, textgen_types, textgenerationwebui_settings } from './textgen-settings.js';
import { decodeTextTokens, getAvailableTokenizers, getFriendlyTokenizerName, getTextTokens, getTokenCountAsync, selectTokenizer } from './tokenizers.js';
import { debounce, delay, isFalseBoolean, isTrueBoolean, showFontAwesomePicker, stringToRange, trimToEndSentence, trimToStartSentence, waitUntilCondition } from './utils.js';
import { registerVariableCommands, resolveVariable } from './variables.js';
import { background_settings } from './backgrounds.js';
import { SlashCommandClosure } from './slash-commands/SlashCommandClosure.js';
import { SlashCommandClosureResult } from './slash-commands/SlashCommandClosureResult.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from './slash-commands/SlashCommandArgument.js';
import { AutoComplete } from './autocomplete/AutoComplete.js';
import { SlashCommand } from './slash-commands/SlashCommand.js';
import { SlashCommandAbortController } from './slash-commands/SlashCommandAbortController.js';
import { SlashCommandNamedArgumentAssignment } from './slash-commands/SlashCommandNamedArgumentAssignment.js';
import { SlashCommandEnumValue, enumTypes } from './slash-commands/SlashCommandEnumValue.js';
import { POPUP_TYPE, Popup, callGenericPopup } from './popup.js';
import { commonEnumProviders, enumIcons } from './slash-commands/SlashCommandCommonEnumsProvider.js';
import { SlashCommandDebugController } from './slash-commands/SlashCommandDebugController.js';
import { SlashCommandBreakController } from './slash-commands/SlashCommandBreakController.js';
import { SlashCommandExecutionError } from './slash-commands/SlashCommandExecutionError.js';
export {
    executeSlashCommands, executeSlashCommandsWithOptions, getSlashCommandsHelp, registerSlashCommand,
};

export const parser = new SlashCommandParser();
/**
 * @deprecated Use SlashCommandParser.addCommandObject() instead
 */
const registerSlashCommand = SlashCommandParser.addCommand.bind(SlashCommandParser);
const getSlashCommandsHelp = parser.getHelpString.bind(parser);

export function initDefaultSlashCommands() {
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: '?',
        callback: helpCommandCallback,
        aliases: ['help'],
        unnamedArgumentList: [SlashCommandArgument.fromProps({
            description: 'help topic',
            typeList: [ARGUMENT_TYPE.STRING],
            enumList: [
                new SlashCommandEnumValue('slash', 'slash commands (STscript)', enumTypes.command, '/'),
                new SlashCommandEnumValue('macros', '{{macros}} (text replacement)', enumTypes.macro, enumIcons.macro),
                new SlashCommandEnumValue('format', 'chat/text formatting', enumTypes.name, '★'),
                new SlashCommandEnumValue('hotkeys', 'keyboard shortcuts', enumTypes.enum, '⏎'),
            ],
        })],
        helpString: 'Get help on macros, chat formatting and commands.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'persona',
        callback: setNameCallback,
        aliases: ['name'],
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'mode', 'The mode for persona selection. ("lookup" = search for existing persona, "temp" = create a temporary name, set a temporary name, "all" = allow both in the same command)',
                [ARGUMENT_TYPE.STRING], false, false, 'all', ['lookup', 'temp', 'all'],
            ),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'persona name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: commonEnumProviders.personas,
            }),
        ],
        helpString: 'Selects the given persona with its name and avatar (by name or avatar url). If no matching persona exists, applies a temporary name.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'sync',
        callback: syncCallback,
        helpString: 'Syncs the user persona in user-attributed messages in the current chat.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'lock',
        callback: lockPersonaCallback,
        aliases: ['bind'],
        helpString: 'Locks/unlocks a persona (name and avatar) to the current chat',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'state',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                defaultValue: 'toggle',
                enumProvider: commonEnumProviders.boolean('onOffToggle'),
            }),
        ],
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'bg',
        callback: setBackgroundCallback,
        aliases: ['background'],
        returns: 'the current background',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'background filename',
                typeList: [ARGUMENT_TYPE.STRING],
                enumProvider: () => [...document.querySelectorAll('.bg_example')]
                    .map(it => new SlashCommandEnumValue(it.getAttribute('bgfile')))
                    .filter(it => it.value?.length),
            }),
        ],
        helpString: `
        <div>
            Sets a background according to the provided filename. Partial names allowed.
        </div>
        <div>
            If no background is provided, this will return the currently selected background.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code>/bg beach.jpg</code></pre>
                </li>
                <li>
                    <pre><code>/bg</code></pre>
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'sendas',
        callback: sendMessageAs,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'name',
                description: 'Character name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: commonEnumProviders.characters('character'),
                forceEnum: false,
            }),
            new SlashCommandNamedArgument(
                'compact', 'Use compact layout', [ARGUMENT_TYPE.BOOLEAN], false, false, 'false',
            ),
            SlashCommandNamedArgument.fromProps({
                name: 'at',
                description: 'position to insert the message (index-based, corresponding to message id). If not set, the message will be inserted at the end of the chat.\nNegative values are accepted and will work similarly to how \'depth\' usually works. For example, -1 will insert the message right before the last message in chat.',
                typeList: [ARGUMENT_TYPE.NUMBER],
                enumProvider: commonEnumProviders.messages({ allowIdAfter: true }),
            }),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'text', [ARGUMENT_TYPE.STRING], true,
            ),
        ],
        helpString: `
        <div>
            Sends a message as a specific character. Uses the character avatar if it exists in the characters list.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code>/sendas name="Chloe" Hello, guys!</code></pre>
                    will send "Hello, guys!" from "Chloe".
                </li>
            </ul>
        </div>
        <div>
            If "compact" is set to true, the message is sent using a compact layout.
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'sys',
        callback: sendNarratorMessage,
        aliases: ['nar'],
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'compact',
                'compact layout',
                [ARGUMENT_TYPE.BOOLEAN],
                false,
                false,
                'false',
            ),
            SlashCommandNamedArgument.fromProps({
                name: 'at',
                description: 'position to insert the message (index-based, corresponding to message id). If not set, the message will be inserted at the end of the chat.\nNegative values are accepted and will work similarly to how \'depth\' usually works. For example, -1 will insert the message right before the last message in chat.',
                typeList: [ARGUMENT_TYPE.NUMBER],
                enumProvider: commonEnumProviders.messages({ allowIdAfter: true }),
            }),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'text', [ARGUMENT_TYPE.STRING], true,
            ),
        ],
        helpString: `
        <div>
            Sends a message as a system narrator.
        </div>
        <div>
            If <code>compact</code> is set to <code>true</code>, the message is sent using a compact layout.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code>/sys The sun sets in the west.</code></pre>
                </li>
                <li>
                    <pre><code>/sys compact=true A brief note.</code></pre>
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'sysname',
        callback: setNarratorName,
        unnamedArgumentList: [
            new SlashCommandArgument(
                'name', [ARGUMENT_TYPE.STRING], false,
            ),
        ],
        helpString: 'Sets a name for future system narrator messages in this chat (display only). Default: System. Leave empty to reset.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'comment',
        callback: sendCommentMessage,
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'compact',
                'Whether to use a compact layout',
                [ARGUMENT_TYPE.BOOLEAN],
                false,
                false,
                'false',
            ),
            SlashCommandNamedArgument.fromProps({
                name: 'at',
                description: 'position to insert the message (index-based, corresponding to message id). If not set, the message will be inserted at the end of the chat.\nNegative values are accepted and will work similarly to how \'depth\' usually works. For example, -1 will insert the message right before the last message in chat.',
                typeList: [ARGUMENT_TYPE.NUMBER],
                enumProvider: commonEnumProviders.messages({ allowIdAfter: true }),
            }),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'text',
                [ARGUMENT_TYPE.STRING],
                true,
            ),
        ],
        helpString: `
        <div>
            Adds a note/comment message not part of the chat.
        </div>
        <div>
            If <code>compact</code> is set to <code>true</code>, the message is sent using a compact layout.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code>/comment This is a comment</code></pre>
                </li>
                <li>
                    <pre><code>/comment compact=true This is a compact comment</code></pre>
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'single',
        callback: setStoryModeCallback,
        aliases: ['story'],
        helpString: 'Sets the message style to single document mode without names or avatars visible.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'bubble',
        callback: setBubbleModeCallback,
        aliases: ['bubbles'],
        helpString: 'Sets the message style to bubble chat mode.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'flat',
        callback: setFlatModeCallback,
        aliases: ['default'],
        helpString: 'Sets the message style to flat chat mode.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'continue',
        callback: continueChatCallback,
        aliases: ['cont'],
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'await',
                'Whether to await for the continued generation before proceeding',
                [ARGUMENT_TYPE.BOOLEAN],
                false,
                false,
                'false',
            ),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'prompt', [ARGUMENT_TYPE.STRING], false,
            ),
        ],
        helpString: `
        <div>
            Continues the last message in the chat, with an optional additional prompt.
        </div>
        <div>
            If <code>await=true</code> named argument is passed, the command will await for the continued generation before proceeding.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code>/continue</code></pre>
                    Continues the chat with no additional prompt and immediately proceeds to the next command.
                </li>
                <li>
                    <pre><code>/continue await=true Let's explore this further...</code></pre>
                    Continues the chat with the provided prompt and waits for the generation to finish.
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'go',
        callback: goToCharacterCallback,
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: commonEnumProviders.characters('all'),
            }),
        ],
        helpString: 'Opens up a chat with the character or group by its name',
        aliases: ['char'],
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'rename-char',
        /** @param {{silent: string, chats: string}} options @param {string} name */
        callback: async ({ silent = 'true', chats = null }, name) => {
            const renamed = await renameCharacter(name, { silent: isTrueBoolean(silent), renameChats: chats !== null ? isTrueBoolean(chats) : null });
            return String(renamed);
        },
        returns: 'true/false - Whether the rename was successful',
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'silent', 'Hide any blocking popups. (if false, the name is optional. If not supplied, a popup asking for it will appear)', [ARGUMENT_TYPE.BOOLEAN], false, false, 'true',
            ),
            new SlashCommandNamedArgument(
                'chats', 'Rename char in all previous chats', [ARGUMENT_TYPE.BOOLEAN], false, false, '<null>',
            ),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'new char name', [ARGUMENT_TYPE.STRING], true,
            ),
        ],
        helpString: 'Renames the current character.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'sysgen',
        callback: generateSystemMessage,
        unnamedArgumentList: [
            new SlashCommandArgument(
                'prompt', [ARGUMENT_TYPE.STRING], true,
            ),
        ],
        helpString: 'Generates a system message using a specified prompt.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'ask',
        callback: askCharacter,
        returns: 'the generated text',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'name',
                description: 'character name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: commonEnumProviders.characters('character'),
            }),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'prompt', [ARGUMENT_TYPE.STRING], false, false,
            ),
        ],
        helpString: 'Asks a specified character card a prompt. Character name must be provided in a named argument.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'delname',
        callback: deleteMessagesByNameCallback,
        namedArgumentList: [],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: commonEnumProviders.characters('character'),
            }),
        ],
        aliases: ['cancel'],
        helpString: `
        <div>
            Deletes all messages attributed to a specified name.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code>/delname John</code></pre>
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'send',
        callback: sendUserMessageCallback,
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'compact',
                'whether to use a compact layout',
                [ARGUMENT_TYPE.BOOLEAN],
                false,
                false,
                'false',
            ),
            SlashCommandNamedArgument.fromProps({
                name: 'at',
                description: 'position to insert the message (index-based, corresponding to message id). If not set, the message will be inserted at the end of the chat.\nNegative values are accepted and will work similarly to how \'depth\' usually works. For example, -1 will insert the message right before the last message in chat.',
                typeList: [ARGUMENT_TYPE.NUMBER],
                enumProvider: commonEnumProviders.messages({ allowIdAfter: true }),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'name',
                description: 'display name',
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: '{{user}}',
                enumProvider: commonEnumProviders.personas,
            }),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'text',
                [ARGUMENT_TYPE.STRING],
                true,
            ),
        ],
        helpString: `
        <div>
            Adds a user message to the chat log without triggering a generation.
        </div>
        <div>
            If <code>compact</code> is set to <code>true</code>, the message is sent using a compact layout.
        </div>
        <div>
            If <code>name</code> is set, it will be displayed as the message sender. Can be an empty for no name.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code>/send Hello there!</code></pre>
                </li>
                <li>
                    <pre><code>/send compact=true Hi</code></pre>
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'trigger',
        callback: triggerGenerationCallback,
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'await',
                'Whether to await for the triggered generation before continuing',
                [ARGUMENT_TYPE.BOOLEAN],
                false,
                false,
                'false',
            ),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'group member index (starts with 0) or name',
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.STRING],
                isRequired: false,
                enumProvider: commonEnumProviders.groupMembers(),
            }),
        ],
        helpString: `
        <div>
            Triggers a message generation. If in group, can trigger a message for the specified group member index or name.
        </div>
        <div>
            If <code>await=true</code> named argument is passed, the command will await for the triggered generation before continuing.
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'hide',
        callback: hideMessageCallback,
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'message index (starts with 0) or range',
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.RANGE],
                isRequired: true,
                enumProvider: commonEnumProviders.messages(),
            }),
        ],
        helpString: 'Hides a chat message from the prompt.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'unhide',
        callback: unhideMessageCallback,
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'message index (starts with 0) or range',
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.RANGE],
                isRequired: true,
                enumProvider: commonEnumProviders.messages(),
            }),
        ],
        helpString: 'Unhides a message from the prompt.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'member-disable',
        callback: disableGroupMemberCallback,
        aliases: ['disable', 'disablemember', 'memberdisable'],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'member index (starts with 0) or name',
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: commonEnumProviders.groupMembers(),
            }),
        ],
        helpString: 'Disables a group member from being drafted for replies.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'member-enable',
        aliases: ['enable', 'enablemember', 'memberenable'],
        callback: enableGroupMemberCallback,
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'member index (starts with 0) or name',
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: commonEnumProviders.groupMembers(),
            }),
        ],
        helpString: 'Enables a group member to be drafted for replies.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'member-add',
        callback: addGroupMemberCallback,
        aliases: ['addmember', 'memberadd'],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'character name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: () => selected_group ? commonEnumProviders.characters('character')() : [],
            }),
        ],
        helpString: `
        <div>
            Adds a new group member to the group chat.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code>/member-add John Doe</code></pre>
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'member-remove',
        callback: removeGroupMemberCallback,
        aliases: ['removemember', 'memberremove'],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'member index (starts with 0) or name',
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: commonEnumProviders.groupMembers(),
            }),
        ],
        helpString: `
        <div>
            Removes a group member from the group chat.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code>/member-remove 2</code></pre>
                    <pre><code>/member-remove John Doe</code></pre>
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'member-up',
        callback: moveGroupMemberUpCallback,
        aliases: ['upmember', 'memberup'],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'member index (starts with 0) or name',
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: commonEnumProviders.groupMembers(),
            }),
        ],
        helpString: 'Moves a group member up in the group chat list.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'member-down',
        callback: moveGroupMemberDownCallback,
        aliases: ['downmember', 'memberdown'],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'member index (starts with 0) or name',
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: commonEnumProviders.groupMembers(),
            }),
        ],
        helpString: 'Moves a group member down in the group chat list.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'peek',
        callback: peekCallback,
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'member index (starts with 0) or name',
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: commonEnumProviders.groupMembers(),
            }),
        ],
        helpString: `
        <div>
            Shows a group member character card without switching chats.
        </div>
        <div>
            <strong>Examples:</strong>
            <ul>
                <li>
                    <pre><code>/peek Gloria</code></pre>
                    Shows the character card for the character named "Gloria".
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'delswipe',
        callback: deleteSwipeCallback,
        returns: 'the new, currently selected swipe id',
        aliases: ['swipedel'],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: '1-based swipe id',
                typeList: [ARGUMENT_TYPE.NUMBER],
                isRequired: true,
                enumProvider: () => Array.isArray(chat[chat.length - 1]?.swipes) ?
                    chat[chat.length - 1].swipes.map((/** @type {string} */ swipe, /** @type {number} */ i) => new SlashCommandEnumValue(String(i + 1), swipe, enumTypes.enum, enumIcons.message))
                    : [],
            }),
        ],
        helpString: `
        <div>
            Deletes a swipe from the last chat message. If swipe id is not provided, it deletes the current swipe.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code>/delswipe</code></pre>
                    Deletes the current swipe.
                </li>
                <li>
                    <pre><code>/delswipe 2</code></pre>
                    Deletes the second swipe from the last chat message.
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'echo',
        callback: echoCallback,
        returns: 'the text',
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'title', 'title of the toast message', [ARGUMENT_TYPE.STRING], false,
            ),
            SlashCommandNamedArgument.fromProps({
                name: 'severity',
                description: 'severity level of the toast message',
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: 'info',
                enumProvider: () => [
                    new SlashCommandEnumValue('info', 'info', enumTypes.macro, 'ℹ️'),
                    new SlashCommandEnumValue('warning', 'warning', enumTypes.enum, '⚠️'),
                    new SlashCommandEnumValue('error', 'error', enumTypes.enum, '❗'),
                    new SlashCommandEnumValue('success', 'success', enumTypes.enum, '✅'),
                ],
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'timeout',
                description: 'time in milliseconds to display the toast message. Set this and \'extendedTimeout\' to 0 to show indefinitely until dismissed.',
                typeList: [ARGUMENT_TYPE.NUMBER],
                defaultValue: `${toastr.options.timeOut}`,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'extendedTimeout',
                description: 'time in milliseconds to display the toast message. Set this and \'timeout\' to 0 to show indefinitely until dismissed.',
                typeList: [ARGUMENT_TYPE.NUMBER],
                defaultValue: `${toastr.options.extendedTimeOut}`,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'preventDuplicates',
                description: 'prevent duplicate toasts with the same message from being displayed.',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'false',
                enumList: commonEnumProviders.boolean('trueFalse')(),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'awaitDismissal',
                description: 'wait for the toast to be dismissed before continuing.',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'false',
                enumList: commonEnumProviders.boolean('trueFalse')(),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'cssClass',
                description: 'additional CSS class to add to the toast message (e.g. for custom styling)',
                typeList: [ARGUMENT_TYPE.STRING],
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'color',
                description: 'custom CSS color of the toast message. Accepts all valid CSS color values (e.g. \'red\', \'#FF0000\', \'rgb(255, 0, 0)\').<br />>Can be more customizable with the \'cssClass\' argument and custom classes.',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'escapeHtml',
                description: 'whether to escape HTML in the toast message.',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'true',
                enumList: commonEnumProviders.boolean('trueFalse')(),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'onClick',
                description: 'a closure to call when the toast is clicked. This executed closure receives scope as provided in the script. Careful about possible side effects when manipulating variables and more.',
                typeList: [ARGUMENT_TYPE.CLOSURE],
            }),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'text', [ARGUMENT_TYPE.STRING], true,
            ),
        ],
        helpString: `
        <div>
            Echoes the provided text to a toast message. Can be used to display informational messages or for pipes debugging.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code>/echo title="My Message" severity=warning This is a warning message</code></pre>
                </li>
                <li>
                    <pre><code>/echo color=purple This message is purple</code></pre>
                </li>
                <li>
                    <pre><code>/echo onClick={: /echo escapeHtml=false color=transparent cssClass=wider_dialogue_popup &lt;img src="/img/five.png" /&gt; :} timeout=5000 Clicking on this message within 5 seconds will open the image.</code></pre>
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'gen',
        callback: generateCallback,
        returns: 'generated text',
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'lock', 'lock user input during generation', [ARGUMENT_TYPE.BOOLEAN], false, false, null, commonEnumProviders.boolean('onOff')(),
            ),
            SlashCommandNamedArgument.fromProps({
                name: 'name',
                description: 'in-prompt name for instruct mode',
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: 'System',
                enumProvider: () => [...commonEnumProviders.characters('character')(), new SlashCommandEnumValue('System', null, enumTypes.enum, enumIcons.assistant)],
                forceEnum: false,
            }),
            new SlashCommandNamedArgument(
                'length', 'API response length in tokens', [ARGUMENT_TYPE.NUMBER], false,
            ),
            SlashCommandNamedArgument.fromProps({
                name: 'as',
                description: 'role of the output prompt',
                typeList: [ARGUMENT_TYPE.STRING],
                enumList: [
                    new SlashCommandEnumValue('system', null, enumTypes.enum, enumIcons.assistant),
                    new SlashCommandEnumValue('char', null, enumTypes.enum, enumIcons.character),
                ],
            }),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'prompt', [ARGUMENT_TYPE.STRING], true,
            ),
        ],
        helpString: `
        <div>
            Generates text using the provided prompt and passes it to the next command through the pipe, optionally locking user input while generating and allowing to configure the in-prompt name for instruct mode (default = "System").
        </div>
        <div>
            "as" argument controls the role of the output prompt: system (default) or char. If "length" argument is provided as a number in tokens, allows to temporarily override an API response length.
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'genraw',
        callback: generateRawCallback,
        returns: 'generated text',
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'lock', 'lock user input during generation', [ARGUMENT_TYPE.BOOLEAN], false, false, null, commonEnumProviders.boolean('onOff')(),
            ),
            new SlashCommandNamedArgument(
                'instruct', 'use instruct mode', [ARGUMENT_TYPE.BOOLEAN], false, false, 'on', commonEnumProviders.boolean('onOff')(),
            ),
            new SlashCommandNamedArgument(
                'stop', 'one-time custom stop strings', [ARGUMENT_TYPE.LIST], false,
            ),
            SlashCommandNamedArgument.fromProps({
                name: 'as',
                description: 'role of the output prompt',
                typeList: [ARGUMENT_TYPE.STRING],
                enumList: [
                    new SlashCommandEnumValue('system', null, enumTypes.enum, enumIcons.assistant),
                    new SlashCommandEnumValue('char', null, enumTypes.enum, enumIcons.character),
                ],
            }),
            new SlashCommandNamedArgument(
                'system', 'system prompt at the start', [ARGUMENT_TYPE.STRING], false,
            ),
            new SlashCommandNamedArgument(
                'length', 'API response length in tokens', [ARGUMENT_TYPE.NUMBER], false,
            ),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'prompt', [ARGUMENT_TYPE.STRING], true,
            ),
        ],
        helpString: `
        <div>
            Generates text using the provided prompt and passes it to the next command through the pipe, optionally locking user input while generating. Does not include chat history or character card.
        </div>
        <div>
            Use instruct=off to skip instruct formatting, e.g. <pre><code>/genraw instruct=off Why is the sky blue?</code></pre>
        </div>
        <div>
            Use stop=... with a JSON-serialized array to add one-time custom stop strings, e.g. <pre><code>/genraw stop=["\\n"] Say hi</code></pre>
        </div>
        <div>
            "as" argument controls the role of the output prompt: system (default) or char. "system" argument adds an (optional) system prompt at the start.
        </div>
        <div>
            If "length" argument is provided as a number in tokens, allows to temporarily override an API response length.
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'addswipe',
        callback: addSwipeCallback,
        returns: 'the new swipe id',
        aliases: ['swipeadd'],
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'switch',
                description: 'switch to the new swipe',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                enumList: commonEnumProviders.boolean()(),
            }),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'text', [ARGUMENT_TYPE.STRING], true,
            ),
        ],
        helpString: `
        <div>
            Adds a swipe to the last chat message.
        </div>
        <div>
            Use switch=true to switch to directly switch to the new swipe.
        </div>`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'stop',
        callback: () => {
            const stopped = stopGeneration();
            return String(stopped);
        },
        returns: 'true/false, whether the generation was running and got stopped',
        helpString: `
            <div>
                Stops the generation and any streaming if it is currently running.
            </div>
            <div>
                Note: This command cannot be executed from the chat input, as sending any message or script from there is blocked during generation.
                But it can be executed via automations or QR scripts/buttons.
            </div>
        `,
        aliases: ['generate-stop'],
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'abort',
        callback: abortCallback,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'quiet',
                description: 'Whether to suppress the toast message notifying about the /abort call.',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'true',
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'The reason for aborting command execution. Shown when quiet=false',
                typeList: [ARGUMENT_TYPE.STRING],
            }),
        ],
        helpString: 'Aborts the slash command batch execution.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'fuzzy',
        callback: fuzzyCallback,
        returns: 'matching item',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'list',
                description: 'list of items to match against',
                acceptsMultiple: false,
                isRequired: true,
                typeList: [ARGUMENT_TYPE.LIST, ARGUMENT_TYPE.VARIABLE_NAME],
                enumProvider: commonEnumProviders.variables('all'),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'threshold',
                description: 'fuzzy match threshold (0.0 to 1.0)',
                typeList: [ARGUMENT_TYPE.NUMBER],
                isRequired: false,
                defaultValue: '0.4',
                acceptsMultiple: false,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'mode',
                description: 'fuzzy match mode',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                defaultValue: 'first',
                acceptsMultiple: false,
                enumList: [
                    new SlashCommandEnumValue('first', 'first match below the threshold', enumTypes.enum, enumIcons.default),
                    new SlashCommandEnumValue('best', 'best match below the threshold', enumTypes.enum, enumIcons.default),
                ],
            }),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'text to search', [ARGUMENT_TYPE.STRING], true,
            ),
        ],
        helpString: `
        <div>
            Performs a fuzzy match of each item in the <code>list</code> against the <code>text to search</code>.
            If any item matches, then its name is returned. If no item matches the text, no value is returned.
        </div>
        <div>
            The optional <code>threshold</code> (default is 0.4) allows control over the match strictness.
            A low value (min 0.0) means the match is very strict.
            At 1.0 (max) the match is very loose and will match anything.
        </div>
        <div>
            The optional <code>mode</code> argument allows to control the behavior when multiple items match the text.
            <ul>
                <li><code>first</code> (default) returns the first match below the threshold.</li>
                <li><code>best</code> returns the best match below the threshold.</li>
            </ul>
        </div>
        <div>
            The returned value passes to the next command through the pipe.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code>/fuzzy list=["a","b","c"] threshold=0.4 abc</code></pre>
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'pass',
        callback: (_, arg) => {
            // We do not support arrays of closures. Arrays of strings will be send as JSON
            if (Array.isArray(arg) && arg.some(x => x instanceof SlashCommandClosure)) throw new Error('Command /pass does not support multiple closures');
            if (Array.isArray(arg)) return JSON.stringify(arg);
            return arg;
        },
        returns: 'the provided value',
        unnamedArgumentList: [
            new SlashCommandArgument(
                'text', [ARGUMENT_TYPE.STRING, ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.BOOLEAN, ARGUMENT_TYPE.LIST, ARGUMENT_TYPE.DICTIONARY, ARGUMENT_TYPE.CLOSURE], true,
            ),
        ],
        aliases: ['return'],
        helpString: `
        <div>
            <pre><span class="monospace">/pass (text)</span> – passes the text to the next command through the pipe.</pre>
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li><pre><code>/pass Hello world</code></pre></li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'delay',
        callback: delayCallback,
        aliases: ['wait', 'sleep'],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'milliseconds', [ARGUMENT_TYPE.NUMBER], true,
            ),
        ],
        helpString: `
        <div>
            Delays the next command in the pipe by the specified number of milliseconds.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code>/delay 1000</code></pre>
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'input',
        aliases: ['prompt'],
        callback: inputCallback,
        returns: 'user input',
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'default', 'default value of the input field', [ARGUMENT_TYPE.STRING], false, false, '"string"',
            ),
            new SlashCommandNamedArgument(
                'large', 'show large input field', [ARGUMENT_TYPE.BOOLEAN], false, false, 'off', commonEnumProviders.boolean('onOff')(),
            ),
            new SlashCommandNamedArgument(
                'wide', 'show wide input field', [ARGUMENT_TYPE.BOOLEAN], false, false, 'off', commonEnumProviders.boolean('onOff')(),
            ),
            new SlashCommandNamedArgument(
                'okButton', 'text for the ok button', [ARGUMENT_TYPE.STRING], false,
            ),
            new SlashCommandNamedArgument(
                'rows', 'number of rows for the input field', [ARGUMENT_TYPE.NUMBER], false,
            ),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'text to display', [ARGUMENT_TYPE.STRING], false,
            ),
        ],
        helpString: `
        <div>
            Shows a popup with the provided text and an input field.
            The <code>default</code> argument is the default value of the input field, and the text argument is the text to display.
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'run',
        aliases: ['call', 'exec'],
        callback: runCallback,
        returns: 'result of the executed closure of QR',
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'args', 'named arguments', [ARGUMENT_TYPE.STRING, ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.BOOLEAN, ARGUMENT_TYPE.LIST, ARGUMENT_TYPE.DICTIONARY], false, true,
            ),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'scoped variable or qr label',
                typeList: [ARGUMENT_TYPE.VARIABLE_NAME, ARGUMENT_TYPE.STRING, ARGUMENT_TYPE.CLOSURE],
                isRequired: true,
                enumProvider: (executor, scope) => [
                    ...commonEnumProviders.variables('scope')(executor, scope),
                    ...(typeof window['qrEnumProviderExecutables'] === 'function') ? window['qrEnumProviderExecutables']() : [],
                ],
            }),
        ],
        helpString: `
        <div>
            Runs a closure from a scoped variable, or a Quick Reply with the specified name from a currently active preset or from another preset.
            Named arguments can be referenced in a QR with <code>{{arg::key}}</code>.
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'messages',
        callback: getMessagesCallback,
        aliases: ['message'],
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'names', 'show message author names', [ARGUMENT_TYPE.BOOLEAN], false, false, 'off', commonEnumProviders.boolean('onOff')(),
            ),
            new SlashCommandNamedArgument(
                'hidden', 'include hidden messages', [ARGUMENT_TYPE.BOOLEAN], false, false, 'on', commonEnumProviders.boolean('onOff')(),
            ),
            SlashCommandNamedArgument.fromProps({
                name: 'role',
                description: 'filter messages by role',
                typeList: [ARGUMENT_TYPE.STRING],
                enumList: [
                    new SlashCommandEnumValue('system', null, enumTypes.enum, enumIcons.system),
                    new SlashCommandEnumValue('assistant', null, enumTypes.enum, enumIcons.assistant),
                    new SlashCommandEnumValue('user', null, enumTypes.enum, enumIcons.user),
                ],
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'message index (starts with 0) or range',
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.RANGE],
                isRequired: true,
                enumProvider: commonEnumProviders.messages(),
            }),
        ],
        returns: 'the specified message or range of messages as a string',
        helpString: `
        <div>
            Returns the specified message or range of messages as a string.
        </div>
        <div>
            Use the <code>hidden=off</code> argument to exclude hidden messages.
        </div>
        <div>
            Use the <code>role</code> argument to filter messages by role. Possible values are: system, assistant, user.
        </div>
        <div>
            <strong>Examples:</strong>
            <ul>
                <li>
                    <pre><code>/messages 10</code></pre>
                    Returns the 10th message.
                </li>
                <li>
                    <pre><code>/messages names=on 5-10</code></pre>
                    Returns messages 5 through 10 with author names.
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'setinput',
        callback: setInputCallback,
        unnamedArgumentList: [
            new SlashCommandArgument(
                'text', [ARGUMENT_TYPE.STRING], true,
            ),
        ],
        helpString: `
        <div>
            Sets the user input to the specified text and passes it to the next command through the pipe.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code>/setinput Hello world</code></pre>
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'popup',
        callback: popupCallback,
        returns: 'popup text',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'large',
                description: 'show large popup',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                enumList: commonEnumProviders.boolean('trueFalse')(),
                defaultValue: 'false',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'wide',
                description: 'show wide popup',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                enumList: commonEnumProviders.boolean('trueFalse')(),
                defaultValue: 'false',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'wider',
                description: 'show wider popup',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                enumList: commonEnumProviders.boolean('trueFalse')(),
                defaultValue: 'false',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'transparent',
                description: 'show transparent popup',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                enumList: commonEnumProviders.boolean('trueFalse')(),
                defaultValue: 'false',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'okButton',
                description: 'text for the OK button',
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: 'OK',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'cancelButton',
                description: 'text for the Cancel button',
                typeList: [ARGUMENT_TYPE.STRING],
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'result',
                description: 'if enabled, returns the popup result (as an integer) instead of the popup text. Resolves to 1 for OK and 0 cancel button, empty string for exiting out.',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                enumList: commonEnumProviders.boolean('trueFalse')(),
                defaultValue: 'false',
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'popup text',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
            }),
        ],
        helpString: `
        <div>
            Shows a blocking popup with the specified text and buttons.
            Returns the popup text.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code>/popup large=on wide=on okButton="Confirm" Please confirm this action.</code></pre>
                </li>
                <li>
                    <pre><code>/popup okButton="Left" cancelButton="Right" result=true Do you want to go left or right? | /echo 0 means right, 1 means left. Choice: {{pipe}}</code></pre>
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'buttons',
        callback: buttonsCallback,
        returns: 'clicked button label',
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'labels', 'button labels', [ARGUMENT_TYPE.LIST], true,
            ),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'text', [ARGUMENT_TYPE.STRING], true,
            ),
        ],
        helpString: `
        <div>
            Shows a blocking popup with the specified text and buttons.
            Returns the clicked button label into the pipe or empty string if canceled.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code>/buttons labels=["Yes","No"] Do you want to continue?</code></pre>
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'trimtokens',
        callback: trimTokensCallback,
        returns: 'trimmed text',
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'limit', 'number of tokens to keep', [ARGUMENT_TYPE.NUMBER], true,
            ),
            SlashCommandNamedArgument.fromProps({
                name: 'direction',
                description: 'trim direction',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumList: [
                    new SlashCommandEnumValue('start', null, enumTypes.enum, '⏪'),
                    new SlashCommandEnumValue('end', null, enumTypes.enum, '⏩'),
                ],
            }),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'text', [ARGUMENT_TYPE.STRING], false,
            ),
        ],
        helpString: `
        <div>
            Trims the start or end of text to the specified number of tokens.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code>/trimtokens limit=5 direction=start This is a long sentence with many words</code></pre>
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'trimstart',
        callback: trimStartCallback,
        returns: 'trimmed text',
        unnamedArgumentList: [
            new SlashCommandArgument(
                'text', [ARGUMENT_TYPE.STRING], true,
            ),
        ],
        helpString: `
        <div>
            Trims the text to the start of the first full sentence.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code>/trimstart This is a sentence. And here is another sentence.</code></pre>
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'trimend',
        callback: trimEndCallback,
        returns: 'trimmed text',
        unnamedArgumentList: [
            new SlashCommandArgument(
                'text', [ARGUMENT_TYPE.STRING], true,
            ),
        ],
        helpString: 'Trims the text to the end of the last full sentence.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'inject',
        callback: injectCallback,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'id',
                description: 'injection ID or variable name pointing to ID',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: commonEnumProviders.injects,
            }),
            new SlashCommandNamedArgument(
                'position', 'injection position', [ARGUMENT_TYPE.STRING], false, false, 'after', ['before', 'after', 'chat', 'none'],
            ),
            new SlashCommandNamedArgument(
                'depth', 'injection depth', [ARGUMENT_TYPE.NUMBER], false, false, '4',
            ),
            new SlashCommandNamedArgument(
                'scan', 'include injection content into World Info scans', [ARGUMENT_TYPE.BOOLEAN], false, false, 'false',
            ),
            SlashCommandNamedArgument.fromProps({
                name: 'role',
                description: 'role for in-chat injections',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                enumList: [
                    new SlashCommandEnumValue('system', null, enumTypes.enum, enumIcons.system),
                    new SlashCommandEnumValue('assistant', null, enumTypes.enum, enumIcons.assistant),
                    new SlashCommandEnumValue('user', null, enumTypes.enum, enumIcons.user),
                ],
            }),
            new SlashCommandNamedArgument(
                'ephemeral', 'remove injection after generation', [ARGUMENT_TYPE.BOOLEAN], false, false, 'false',
            ),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'text', [ARGUMENT_TYPE.STRING], false,
            ),
        ],
        helpString: 'Injects a text into the LLM prompt for the current chat. Requires a unique injection ID. Positions: "before" main prompt, "after" main prompt, in-"chat", hidden with "none" (default: after). Depth: injection depth for the prompt (default: 4). Role: role for in-chat injections (default: system). Scan: include injection content into World Info scans (default: false). Hidden injects in "none" position are not inserted into the prompt but can be used for triggering WI entries.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'listinjects',
        callback: listInjectsCallback,
        helpString: 'Lists all script injections for the current chat. Displays injects in a popup by default. Use the <code>format</code> argument to change the output format.',
        returns: 'JSON object of script injections',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'format',
                description: 'output format',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                forceEnum: true,
                enumList: [
                    new SlashCommandEnumValue('popup', 'Show injects in a popup.', enumTypes.enum, enumIcons.default),
                    new SlashCommandEnumValue('chat', 'Post a system message to the chat.', enumTypes.enum, enumIcons.default),
                    new SlashCommandEnumValue('none', 'Just return the injects as a JSON object.', enumTypes.enum, enumIcons.default),
                ],
            }),
        ],
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'flushinject',
        aliases: ['flushinjects'],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'injection ID or a variable name pointing to ID',
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: '',
                enumProvider: commonEnumProviders.injects,
            }),
        ],
        callback: flushInjectsCallback,
        helpString: 'Removes a script injection for the current chat. If no ID is provided, removes all script injections.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'tokens',
        callback: (_, text) => {
            if (text instanceof SlashCommandClosure || Array.isArray(text)) throw new Error('Unnamed argument cannot be a closure for command /tokens');
            return getTokenCountAsync(text).then(count => String(count));
        },
        returns: 'number of tokens',
        unnamedArgumentList: [
            new SlashCommandArgument(
                'text', [ARGUMENT_TYPE.STRING], true,
            ),
        ],
        helpString: 'Counts the number of tokens in the provided text.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'model',
        callback: modelCallback,
        returns: 'current model',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'quiet',
                description: 'suppress the toast message on model change',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'false',
                enumList: commonEnumProviders.boolean('trueFalse')(),
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'model name',
                typeList: [ARGUMENT_TYPE.STRING],
                enumProvider: () => getModelOptions(true)?.options?.map(option => new SlashCommandEnumValue(option.value, option.value !== option.text ? option.text : null)) ?? [],
            }),
        ],
        helpString: 'Sets the model for the current API. Gets the current model name if no argument is provided.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'setpromptentry',
        aliases: ['setpromptentries'],
        callback: setPromptEntryCallback,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'identifier',
                description: 'Prompt entry identifier(s) to target',
                typeList: [ARGUMENT_TYPE.STRING, ARGUMENT_TYPE.LIST],
                acceptsMultiple: true,
                enumProvider: () => {
                    const promptManager = setupChatCompletionPromptManager(oai_settings);
                    const prompts = promptManager.serviceSettings.prompts;
                    return prompts.map(prompt => new SlashCommandEnumValue(prompt.identifier, prompt.name, enumTypes.enum));
                },
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'name',
                description: 'Prompt entry name(s) to target',
                typeList: [ARGUMENT_TYPE.STRING, ARGUMENT_TYPE.LIST],
                acceptsMultiple: true,
                enumProvider: () => {
                    const promptManager = setupChatCompletionPromptManager(oai_settings);
                    const prompts = promptManager.serviceSettings.prompts;
                    return prompts.map(prompt => new SlashCommandEnumValue(prompt.name, prompt.identifier, enumTypes.enum));
                },
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Set entry/entries on or off',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                acceptsMultiple: false,
                defaultValue: 'toggle', // unnamed arguments don't support default values yet
                enumList: commonEnumProviders.boolean('onOffToggle')(),
            }),
        ],
        helpString: 'Sets the specified prompt manager entry/entries on or off.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'pick-icon',
        callback: async () => ((await showFontAwesomePicker()) ?? false).toString(),
        returns: 'The chosen icon name or false if cancelled.',
        helpString: `
                <div>Opens a popup with all the available Font Awesome icons and returns the selected icon's name.</div>
                <div>
                    <strong>Example:</strong>
                    <ul>
                        <li>
                            <pre><code>/pick-icon |\n/if left={{pipe}} rule=eq right=false\n\telse={: /echo chosen icon: "{{pipe}}" :}\n\t{: /echo cancelled icon selection :}\n|</code></pre>
                        </li>
                    </ul>
                </div>
            `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'api-url',
        callback: setApiUrlCallback,
        returns: 'the current API url',
        aliases: ['server'],
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'api',
                description: 'API to set/get the URL for - if not provided, current API is used',
                typeList: [ARGUMENT_TYPE.STRING],
                enumList: [
                    new SlashCommandEnumValue('custom', 'custom OpenAI-compatible', enumTypes.getBasedOnIndex(UNIQUE_APIS.findIndex(x => x === 'openai')), 'O'),
                    new SlashCommandEnumValue('kobold', 'KoboldAI Classic', enumTypes.getBasedOnIndex(UNIQUE_APIS.findIndex(x => x === 'kobold')), 'K'),
                    ...Object.values(textgen_types).map(api => new SlashCommandEnumValue(api, null, enumTypes.getBasedOnIndex(UNIQUE_APIS.findIndex(x => x === 'textgenerationwebui')), 'T')),
                ],
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'connect',
                description: 'Whether to auto-connect to the API after setting the URL',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'true',
                enumList: commonEnumProviders.boolean('trueFalse')(),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'quiet',
                description: 'suppress the toast message on API change',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'false',
                enumList: commonEnumProviders.boolean('trueFalse')(),
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'API url to connect to',
                typeList: [ARGUMENT_TYPE.STRING],
            }),
        ],
        helpString: `
            <div>
                Set the API url / server url for the currently selected API, including the port. If no argument is provided, it will return the current API url.
            </div>
            <div>
                If a manual API is provided to <b>set</b> the URL, make sure to set <code>connect=false</code>, as auto-connect only works for the currently selected API,
                or consider switching to it with <code>/api</code> first.
            </div>
            <div>
                This slash command works for most of the Text Completion sources, KoboldAI Classic, and also Custom OpenAI compatible for the Chat Completion sources. If unsure which APIs are supported,
                check the auto-completion of the optional <code>api</code> argument of this command.
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'tokenizer',
        callback: selectTokenizerCallback,
        returns: 'current tokenizer',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'tokenizer name',
                typeList: [ARGUMENT_TYPE.STRING],
                enumList: getAvailableTokenizers().map(tokenizer =>
                    new SlashCommandEnumValue(tokenizer.tokenizerKey, tokenizer.tokenizerName, enumTypes.enum, enumIcons.default)),
            }),
        ],
        helpString: `
            <div>
                Selects tokenizer by name. Gets the current tokenizer if no name is provided.
            </div>
            <div>
                <strong>Available tokenizers:</strong>
                <pre><code>${getAvailableTokenizers().map(t => t.tokenizerKey).join(', ')}</code></pre>
            </div>
        `,
    }));

    registerVariableCommands();
}

const NARRATOR_NAME_KEY = 'narrator_name';
const NARRATOR_NAME_DEFAULT = 'System';
export const COMMENT_NAME_DEFAULT = 'Note';
const SCRIPT_PROMPT_KEY = 'script_inject_';

function injectCallback(args, value) {
    const positions = {
        'before': extension_prompt_types.BEFORE_PROMPT,
        'after': extension_prompt_types.IN_PROMPT,
        'chat': extension_prompt_types.IN_CHAT,
        'none': extension_prompt_types.NONE,
    };
    const roles = {
        'system': extension_prompt_roles.SYSTEM,
        'user': extension_prompt_roles.USER,
        'assistant': extension_prompt_roles.ASSISTANT,
    };

    const id = args?.id;
    const ephemeral = isTrueBoolean(args?.ephemeral);

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

    if (value) {
        const inject = { value, position, depth, scan, role };
        chat_metadata.script_injects[id] = inject;
    } else {
        delete chat_metadata.script_injects[id];
    }

    setExtensionPrompt(prefixedId, value, position, depth, scan, role);
    saveMetadataDebounced();

    if (ephemeral) {
        let deleted = false;
        const unsetInject = () => {
            if (deleted) {
                return;
            }
            console.log('Removing ephemeral script injection', id);
            delete chat_metadata.script_injects[id];
            setExtensionPrompt(prefixedId, '', position, depth, scan, role);
            saveMetadataDebounced();
            deleted = true;
        };
        eventSource.once(event_types.GENERATION_ENDED, unsetInject);
        eventSource.once(event_types.GENERATION_STOPPED, unsetInject);
    }

    return '';
}

async function listInjectsCallback(args) {
    const type = String(args?.format).toLowerCase().trim();
    if (!chat_metadata.script_injects || !Object.keys(chat_metadata.script_injects).length) {
        type !== 'none' && toastr.info('No script injections for the current chat');
        return JSON.stringify({});
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

    switch (type) {
        case 'none':
            break;
        case 'chat':
            sendSystemMessage(system_message_types.GENERIC, htmlMessage);
            break;
        case 'popup':
        default:
            await callGenericPopup(htmlMessage, POPUP_TYPE.TEXT);
            break;
    }

    return JSON.stringify(chat_metadata.script_injects);
}

/**
 * Flushes script injections for the current chat.
 * @param {import('./slash-commands/SlashCommand.js').NamedArguments} _ Named arguments
 * @param {string} value Unnamed argument
 * @returns {string} Empty string
 */
function flushInjectsCallback(_, value) {
    if (!chat_metadata.script_injects) {
        return '';
    }

    const idArgument = value;

    for (const [id, inject] of Object.entries(chat_metadata.script_injects)) {
        if (idArgument && id !== idArgument) {
            continue;
        }

        const prefixedId = `${SCRIPT_PROMPT_KEY}${id}`;
        setExtensionPrompt(prefixedId, '', inject.position, inject.depth, inject.scan, inject.role);
        delete chat_metadata.script_injects[id];
    }

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
    $('#send_textarea').val(value || '')[0].dispatchEvent(new Event('input', { bubbles: true }));
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
        /** @type {string[]} */
        const buttons = JSON.parse(resolveVariable(args?.labels));

        if (!Array.isArray(buttons) || !buttons.length) {
            console.warn('WARN: Invalid labels provided for /buttons command');
            return '';
        }

        // Map custom buttons to results. Start at 2 because 1 and 0 are reserved for ok and cancel
        const resultToButtonMap = new Map(buttons.map((button, index) => [index + 2, button]));

        return new Promise(async (resolve) => {
            const safeValue = DOMPurify.sanitize(text || '');

            /** @type {Popup} */
            let popup;

            const buttonContainer = document.createElement('div');
            buttonContainer.classList.add('flex-container', 'flexFlowColumn', 'wide100p', 'm-t-1');

            for (const [result, button] of resultToButtonMap) {
                const buttonElement = document.createElement('div');
                buttonElement.classList.add('menu_button', 'result-control', 'wide100p');
                buttonElement.dataset.result = String(result);
                buttonElement.addEventListener('click', async () => {
                    await popup.complete(result);
                });
                buttonElement.innerText = button;
                buttonContainer.appendChild(buttonElement);
            }

            const popupContainer = document.createElement('div');
            popupContainer.innerHTML = safeValue;
            popupContainer.appendChild(buttonContainer);

            popup = new Popup(popupContainer, POPUP_TYPE.TEXT, '', { okButton: 'Cancel' });
            popup.show()
                .then((result => resolve(typeof result === 'number' ? resultToButtonMap.get(result) ?? '' : '')))
                .catch(() => resolve(''));
        });
    } catch {
        return '';
    }
}

async function popupCallback(args, value) {
    const safeBody = DOMPurify.sanitize(value || '');
    const safeHeader = args?.header && typeof args?.header === 'string' ? DOMPurify.sanitize(args.header) : null;
    const requestedResult = isTrueBoolean(args?.result);

    /** @type {import('./popup.js').PopupOptions} */
    const popupOptions = {
        large: isTrueBoolean(args?.large),
        wide: isTrueBoolean(args?.wide),
        wider: isTrueBoolean(args?.wider),
        transparent: isTrueBoolean(args?.transparent),
        okButton: args?.okButton !== undefined && typeof args?.okButton === 'string' ? args.okButton : 'Ok',
        cancelButton: args?.cancelButton !== undefined && typeof args?.cancelButton === 'string' ? args.cancelButton : null,
    };
    const result = await Popup.show.text(safeHeader, safeBody, popupOptions);
    return String(requestedResult ? result ?? '' : value);
}

async function getMessagesCallback(args, value) {
    const includeNames = !isFalseBoolean(args?.names);
    const includeHidden = isTrueBoolean(args?.hidden);
    const role = args?.role;
    const range = stringToRange(value, 0, chat.length - 1);

    if (!range) {
        console.warn(`WARN: Invalid range provided for /messages command: ${value}`);
        return '';
    }

    const filterByRole = (mes) => {
        if (!role) {
            return true;
        }

        const isNarrator = mes.extra?.type === system_message_types.NARRATOR;

        if (role === 'system') {
            return isNarrator && !mes.is_user;
        }

        if (role === 'assistant') {
            return !isNarrator && !mes.is_user;
        }

        if (role === 'user') {
            return !isNarrator && mes.is_user;
        }

        throw new Error(`Invalid role provided. Expected one of: system, assistant, user. Got: ${role}`);
    };

    const processMessage = async (mesId) => {
        const msg = chat[mesId];
        if (!msg) {
            console.warn(`WARN: No message found with ID ${mesId}`);
            return null;
        }

        if (role && !filterByRole(msg)) {
            console.debug(`/messages: Skipping message with ID ${mesId} due to role filter`);
            return null;
        }

        if (!includeHidden && msg.is_system) {
            console.debug(`/messages: Skipping hidden message with ID ${mesId}`);
            return null;
        }

        return includeNames ? `${msg.name}: ${msg.mes}` : msg.mes;
    };

    const messagePromises = [];

    for (let rInd = range.start; rInd <= range.end; ++rInd)
        messagePromises.push(processMessage(rInd));

    const messages = await Promise.all(messagePromises);

    return messages.filter(m => m !== null).join('\n\n');
}

async function runCallback(args, name) {
    if (!name) {
        throw new Error('No name provided for /run command');
    }

    if (name instanceof SlashCommandClosure) {
        name.breakController = new SlashCommandBreakController();
        return (await name.execute())?.pipe;
    }

    /**@type {SlashCommandScope} */
    const scope = args._scope;
    if (scope.existsVariable(name)) {
        const closure = scope.getVariable(name);
        if (!(closure instanceof SlashCommandClosure)) {
            throw new Error(`"${name}" is not callable.`);
        }
        closure.scope.parent = scope;
        closure.breakController = new SlashCommandBreakController();
        if (args._debugController && !closure.debugController) {
            closure.debugController = args._debugController;
        }
        while (closure.providedArgumentList.pop());
        closure.argumentList.forEach(arg => {
            if (Object.keys(args).includes(arg.name)) {
                const providedArg = new SlashCommandNamedArgumentAssignment();
                providedArg.name = arg.name;
                providedArg.value = args[arg.name];
                closure.providedArgumentList.push(providedArg);
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
        /**@type {ExecuteSlashCommandsOptions} */
        const options = {
            abortController: args._abortController,
            debugController: args._debugController,
        };
        return await window['executeQuickReplyByName'](name, args, options);
    } catch (error) {
        throw new Error(`Error running Quick Reply "${name}": ${error.message}`);
    }
}

/**
 *
 * @param {import('./slash-commands/SlashCommand.js').NamedArguments} param0
 * @param {string} [reason]
 */
function abortCallback({ _abortController, quiet }, reason) {
    if (quiet instanceof SlashCommandClosure) throw new Error('argument \'quiet\' cannot be a closure for command /abort');
    _abortController.abort((reason ?? '').toString().length == 0 ? '/abort command executed' : reason, !isFalseBoolean(quiet ?? 'true'));
    return '';
}

async function delayCallback(_, amount) {
    if (!amount) {
        console.warn('WARN: No amount provided for /delay command');
        return '';
    }

    amount = Number(amount);
    if (isNaN(amount)) {
        amount = 0;
    }

    await delay(amount);
    return '';
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
    const result = await callGenericPopup(safeValue, POPUP_TYPE.INPUT, defaultInput, popupOptions);
    await delay(1);
    return String(result || '');
}

/**
 * Each item in "args.list" is searched within "search_item" using fuzzy search. If any matches it returns the matched "item".
 * @param {FuzzyCommandArgs} args - arguments containing "list" (JSON array) and optionaly "threshold" (float between 0.0 and 1.0)
 * @param {string} searchInValue - the string where items of list are searched
 * @returns {string} - the matched item from the list
 * @typedef {{list: string, threshold: string, mode:string}} FuzzyCommandArgs - arguments for /fuzzy command
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
            params.threshold = parseFloat(args.threshold);
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

        function getFirstMatch() {
            const fuse = new Fuse([searchInValue], params);
            // each item in the "list" is searched within "search_item", if any matches it returns the matched "item"
            for (const searchItem of list) {
                const result = fuse.search(searchItem);
                console.debug('/fuzzy: result', result);
                if (result.length > 0) {
                    console.info('/fuzzy: first matched', searchItem);
                    return searchItem;
                }
            }

            console.info('/fuzzy: no match');
            return '';
        }

        function getBestMatch() {
            const fuse = new Fuse(list, params);
            const result = fuse.search(searchInValue);
            console.debug('/fuzzy: result', result);
            if (result.length > 0) {
                console.info('/fuzzy: best matched', result[0].item);
                return result[0].item;
            }

            console.info('/fuzzy: no match');
            return '';
        }

        switch (String(args.mode).trim().toLowerCase()) {
            case 'best':
                return getBestMatch();
            case 'first':
            default:
                return getFirstMatch();
        }
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
        return '';
    }

    // Prevent generate recursion
    $('#send_textarea').val('')[0].dispatchEvent(new Event('input', { bubbles: true }));
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
    } catch (err) {
        console.error('Error on /genraw generation', err);
        toastr.error(err.message, 'API Error', { preventDuplicates: true });
    } finally {
        if (lock) {
            activateSendButtons();
        }
        flushEphemeralStoppingStrings();
    }
    return '';
}

/**
 * Callback for the /gen command
 * @param {object} args Named arguments
 * @param {string} value Unnamed argument
 * @returns {Promise<string>} The generated text
 */
async function generateCallback(args, value) {
    // Prevent generate recursion
    $('#send_textarea').val('')[0].dispatchEvent(new Event('input', { bubbles: true }));
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
    } catch (err) {
        console.error('Error on /gen generation', err);
        toastr.error(err.message, 'API Error', { preventDuplicates: true });
    } finally {
        if (lock) {
            activateSendButtons();
        }
        flushEphemeralStoppingStrings();
    }
    return '';
}

/**
 *
 * @param {{title?: string, severity?: string, timeout?: string, extendedTimeout?: string, preventDuplicates?: string, awaitDismissal?: string, cssClass?: string, color?: string, escapeHtml?: string, onClick?: SlashCommandClosure}} args - named arguments from the slash command
 * @param {string} value - The string to echo (unnamed argument from the slash command)
 * @returns {Promise<string>} The text that was echoed
 */
async function echoCallback(args, value) {
    // Note: We don't need to sanitize input, as toastr is set up by default to escape HTML via toastr options
    if (value === '') {
        console.warn('WARN: No argument provided for /echo command');
        return '';
    }

    if (args.severity && !['error', 'warning', 'success', 'info'].includes(args.severity)) {
        toastr.warning(`Invalid severity provided for /echo command: ${args.severity}`);
        args.severity = null;
    }

    // Make sure that the value is a string
    value = String(value);

    let title = args.title ? args.title : undefined;
    const severity = args.severity ? args.severity : 'info';

    /** @type {ToastrOptions} */
    const options = {};
    if (args.timeout && !isNaN(parseInt(args.timeout))) options.timeOut = parseInt(args.timeout);
    if (args.extendedTimeout && !isNaN(parseInt(args.extendedTimeout))) options.extendedTimeOut = parseInt(args.extendedTimeout);
    if (isTrueBoolean(args.preventDuplicates)) options.preventDuplicates = true;
    if (args.cssClass) options.toastClass = args.cssClass;
    options.escapeHtml = args.escapeHtml !== undefined ? isTrueBoolean(args.escapeHtml) : true;

    // Prepare possible await handling
    let awaitDismissal = isTrueBoolean(args.awaitDismissal);
    let resolveToastDismissal;

    if (awaitDismissal) {
        options.onHidden = () => resolveToastDismissal(value);
    }
    if (args.onClick) {
        if (args.onClick instanceof SlashCommandClosure) {
            options.onclick = async () => {
                // Execute the slash command directly, with its internal scope and everything. Clear progress handler so it doesn't interfere with command execution progress.
                args.onClick.onProgress = null;
                await args.onClick.execute();
            };
        } else {
            toastr.warning('Invalid onClick provided for /echo command. This is not a closure');
        }
    }

    // If we allow HTML, we need to sanitize it to prevent security risks
    if (!options.escapeHtml) {
        if (title) title = DOMPurify.sanitize(title, { FORBID_TAGS: ['style'] });
        value = DOMPurify.sanitize(value, { FORBID_TAGS: ['style'] });
    }

    let toast;
    switch (severity) {
        case 'error':
            toast = toastr.error(value, title, options);
            break;
        case 'warning':
            toast = toastr.warning(value, title, options);
            break;
        case 'success':
            toast = toastr.success(value, title, options);
            break;
        case 'info':
        default:
            toast = toastr.info(value, title, options);
            break;
    }

    if (args.color) {
        toast.css('background-color', args.color);
    }

    if (awaitDismissal) {
        return new Promise((resolve) => {
            resolveToastDismissal = resolve;
        });
    } else {
        return value;
    }
}

/**
 * @param {{switch?: string}} args - named arguments
 * @param {string} value - The swipe text to add (unnamed argument)
 */
async function addSwipeCallback(args, value) {
    const lastMessage = chat[chat.length - 1];

    if (!lastMessage) {
        toastr.warning('No messages to add swipes to.');
        return '';
    }

    if (!value) {
        console.warn('WARN: No argument provided for /addswipe command');
        return '';
    }

    if (lastMessage.is_user) {
        toastr.warning('Can\'t add swipes to user messages.');
        return '';
    }

    if (lastMessage.is_system) {
        toastr.warning('Can\'t add swipes to system messages.');
        return '';
    }

    if (lastMessage.extra?.image) {
        toastr.warning('Can\'t add swipes to message containing an image.');
        return '';
    }

    if (!Array.isArray(lastMessage.swipes)) {
        lastMessage.swipes = [lastMessage.mes];
        lastMessage.swipe_info = [{}];
        lastMessage.swipe_id = 0;
    }
    if (!Array.isArray(lastMessage.swipe_info)) {
        lastMessage.swipe_info = lastMessage.swipes.map(() => ({}));
    }

    lastMessage.swipes.push(value);
    lastMessage.swipe_info.push({
        send_date: getMessageTimeStamp(),
        gen_started: null,
        gen_finished: null,
        extra: {
            bias: extractMessageBias(value),
            gen_id: Date.now(),
            api: 'manual',
            model: 'slash command',
        },
    });

    const newSwipeId = lastMessage.swipes.length - 1;

    if (isTrueBoolean(args.switch)) {
        lastMessage.swipe_id = newSwipeId;
        lastMessage.mes = lastMessage.swipes[newSwipeId];
    }

    await saveChatConditional();
    await reloadCurrentChat();

    return String(newSwipeId);
}

async function deleteSwipeCallback(_, arg) {
    // Take the provided argument. Null if none provided, which will target the current swipe.
    const swipeId = arg && !isNaN(Number(arg)) ? (Number(arg) - 1) : null;

    const newSwipeId = await deleteSwipe(swipeId);

    return String(newSwipeId);
}

async function askCharacter(args, text) {
    // Prevent generate recursion
    $('#send_textarea').val('')[0].dispatchEvent(new Event('input', { bubbles: true }));

    // Not supported in group chats
    // TODO: Maybe support group chats?
    if (selected_group) {
        toastr.error('Cannot run /ask command in a group chat!');
        return '';
    }

    let name = '';

    if (args?.name) {
        name = args.name.trim();

        if (!name) {
            toastr.warning('You must specify a name of the character to ask.');
            return '';
        }
    }

    const prevChId = this_chid;

    // Find the character
    const chId = characters.findIndex((e) => e.name === name || e.avatar === name);
    if (!characters[chId] || chId === -1) {
        toastr.error('Character not found.');
        return '';
    }

    if (text) {
        const mesText = getRegexedString(text.trim(), regex_placement.SLASH_COMMAND);
        // Sending a message implicitly saves the chat, so this needs to be done before changing the character
        // Otherwise, a corruption will occur
        await sendMessageAsUser(mesText, '');
    }

    // Override character and send a user message
    setCharacterId(String(chId));

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

    const restoreCharacter = () => {
        if (String(this_chid) !== String(chId)) {
            return;
        }

        setCharacterId(prevChId);
        setCharacterName(characters[prevChId].name);

        // Only force the new avatar if the character name is the same
        // This skips if an error was fired
        const lastMessage = chat[chat.length - 1];
        if (lastMessage && lastMessage?.name === character.name) {
            lastMessage.force_avatar = force_avatar;
            lastMessage.original_avatar = original_avatar;
        }
    };

    let askResult = '';

    // Run generate and restore previous character
    try {
        eventSource.once(event_types.MESSAGE_RECEIVED, restoreCharacter);
        toastr.info(`Asking ${character.name} something...`);
        askResult = await Generate('ask_command');
    } catch (error) {
        restoreCharacter();
        console.error('Error running /ask command', error);
    } finally {
        if (String(this_chid) === String(prevChId)) {
            await saveChatConditional();
        } else {
            toastr.error('It is strongly recommended to reload the page.', 'Something went wrong');
        }
    }

    return askResult;
}

async function hideMessageCallback(_, arg) {
    if (!arg) {
        console.warn('WARN: No argument provided for /hide command');
        return '';
    }

    const range = stringToRange(arg, 0, chat.length - 1);

    if (!range) {
        console.warn(`WARN: Invalid range provided for /hide command: ${arg}`);
        return '';
    }

    await hideChatMessageRange(range.start, range.end, false);
    return '';
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
            outerResolve(Promise.resolve(''));
            return '';
        }

        // Prevent generate recursion
        $('#send_textarea').val('')[0].dispatchEvent(new Event('input', { bubbles: true }));

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
/**
 * Find persona by name.
 * @param {string} name Name to search for
 * @returns {string} Persona name
 */
function findPersonaByName(name) {
    if (!name) {
        return null;
    }

    for (const persona of Object.entries(power_user.personas)) {
        if (persona[1].toLowerCase() === name.toLowerCase()) {
            return persona[0];
        }
    }
    return null;
}

async function sendUserMessageCallback(args, text) {
    if (!text) {
        console.warn('WARN: No text provided for /send command');
        return;
    }

    text = text.trim();
    const compact = isTrueBoolean(args?.compact);
    const bias = extractMessageBias(text);

    let insertAt = Number(args?.at);

    // Convert possible depth parameter to index
    if (!isNaN(insertAt) && (insertAt < 0 || insertAt === Number(-0))) {
        // Negative value means going back from current chat length. (E.g.: 8 messages, Depth 1 means insert at index 7)
        insertAt = chat.length + insertAt;
    }

    if ('name' in args) {
        const name = args.name || '';
        const avatar = findPersonaByName(name) || user_avatar;
        await sendMessageAsUser(text, bias, insertAt, compact, name, avatar);
    }
    else {
        await sendMessageAsUser(text, bias, insertAt, compact);
    }

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

async function continueChatCallback(args, prompt) {
    const shouldAwait = isTrueBoolean(args?.await);

    const outerPromise = new Promise(async (resolve, reject) => {
        try {
            await waitUntilCondition(() => !is_send_press && !is_group_generating, 10000, 100);
        } catch {
            console.warn('Timeout waiting for generation unlock');
            toastr.warning('Cannot run /continue command while the reply is being generated.');
            return reject();
        }

        try {
            // Prevent infinite recursion
            $('#send_textarea').val('')[0].dispatchEvent(new Event('input', { bubbles: true }));

            const options = prompt?.trim() ? { quiet_prompt: prompt.trim(), quietToLoud: true } : {};
            await Generate('continue', options);

            resolve();
        } catch (error) {
            console.error('Error running /continue command:', error);
            reject();
        }
    });

    if (shouldAwait) {
        await outerPromise;
    }

    return '';
}

export async function generateSystemMessage(_, prompt) {
    $('#send_textarea').val('')[0].dispatchEvent(new Event('input', { bubbles: true }));

    if (!prompt) {
        console.warn('WARN: No prompt provided for /sysgen command');
        toastr.warning('You must provide a prompt for the system message');
        return '';
    }

    // Generate and regex the output if applicable
    toastr.info('Please wait', 'Generating...');
    let message = await generateQuietPrompt(prompt, false, false);
    message = getRegexedString(message, regex_placement.SLASH_COMMAND);

    sendNarratorMessage(_, message);
    return '';
}

function syncCallback() {
    $('#sync_name_button').trigger('click');
    return '';
}

async function lockPersonaCallback(_args, value) {
    if (['toggle', 't', ''].includes(value.trim().toLowerCase())) {
        await togglePersonaLock();
        return '';
    }

    if (isTrueBoolean(value)) {
        await setPersonaLockState(true);
        return '';
    }

    if (isFalseBoolean(value)) {
        await setPersonaLockState(false);
        return '';

    }

    return '';
}

function setStoryModeCallback() {
    $('#chat_display').val(chat_styles.DOCUMENT).trigger('change');
    return '';
}

function setBubbleModeCallback() {
    $('#chat_display').val(chat_styles.BUBBLES).trigger('change');
    return '';
}

function setFlatModeCallback() {
    $('#chat_display').val(chat_styles.DEFAULT).trigger('change');
    return '';
}

/**
 * Sets a persona name and optionally an avatar.
 * @param {{mode: 'lookup' | 'temp' | 'all'}} namedArgs Named arguments
 * @param {string} name Name to set
 * @returns {string}
 */
function setNameCallback({ mode = 'all' }, name) {
    if (!name) {
        toastr.warning('You must specify a name to change to');
        return '';
    }

    if (!['lookup', 'temp', 'all'].includes(mode)) {
        toastr.warning('Mode must be one of "lookup", "temp" or "all"');
        return '';
    }

    name = name.trim();

    // If the name matches a persona avatar, or a name, auto-select it
    if (['lookup', 'all'].includes(mode)) {
        let persona = Object.entries(power_user.personas).find(([avatar, _]) => avatar === name)?.[1];
        if (!persona) persona = Object.entries(power_user.personas).find(([_, personaName]) => personaName.toLowerCase() === name.toLowerCase())?.[1];
        if (persona) {
            autoSelectPersona(persona);
            retriggerFirstMessageOnEmptyChat();
            return '';
        } else if (mode === 'lookup') {
            toastr.warning(`Persona ${name} not found`);
            return '';
        }
    }

    if (['temp', 'all'].includes(mode)) {
        // Otherwise, set just the name
        setUserName(name); //this prevented quickReply usage
        retriggerFirstMessageOnEmptyChat();
    }

    return '';
}

async function setNarratorName(_, text) {
    const name = text || NARRATOR_NAME_DEFAULT;
    chat_metadata[NARRATOR_NAME_KEY] = name;
    toastr.info(`System narrator name set to ${name}`);
    await saveChatConditional();
    return '';
}

export async function sendMessageAs(args, text) {
    if (!text) {
        return '';
    }

    let name;
    let mesText;

    if (args.name) {
        name = args.name.trim();

        if (!name && !text) {
            toastr.warning('You must specify a name and text to send as');
            return '';
        }
    } else {
        const namelessWarningKey = 'sendAsNamelessWarningShown';
        if (localStorage.getItem(namelessWarningKey) !== 'true') {
            toastr.warning('To avoid confusion, please use /sendas name="Character Name"', 'Name defaulted to {{char}}', { timeOut: 10000 });
            localStorage.setItem(namelessWarningKey, 'true');
        }
        name = name2;
        if (!text) {
            toastr.warning('You must specify text to send as');
            return '';
        }
    }

    mesText = text.trim();

    // Requires a regex check after the slash command is pushed to output
    mesText = getRegexedString(mesText, regex_placement.SLASH_COMMAND, { characterOverride: name });

    // Messages that do nothing but set bias will be hidden from the context
    const bias = extractMessageBias(mesText);
    const isSystem = bias && !removeMacros(mesText).length;
    const compact = isTrueBoolean(args?.compact);

    const character = characters.find(x => x.avatar === name) ?? characters.find(x => x.name === name);
    let force_avatar, original_avatar;

    const chatCharacter = this_chid !== undefined ? characters[this_chid] : null;
    const isNeutralCharacter = !chatCharacter && name2 === neutralCharacterName && name === neutralCharacterName;

    if (chatCharacter === character || isNeutralCharacter) {
        // If the targeted character is the currently selected one in a solo chat, we don't need to force any avatars
    }
    else if (character && character.avatar !== 'none') {
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
            api: 'manual',
            model: 'slash command',
        },
    };

    message.swipe_id = 0;
    message.swipes = [message.mes];
    message.swipes_info = [{
        send_date: message.send_date,
        gen_started: null,
        gen_finished: null,
        extra: {
            bias: message.extra.bias,
            gen_id: message.extra.gen_id,
            isSmallSys: compact,
            api: 'manual',
            model: 'slash command',
        },
    }];

    let insertAt = Number(args.at);

    // Convert possible depth parameter to index
    if (!isNaN(insertAt) && (insertAt < 0 || insertAt === Number(-0))) {
        // Negative value means going back from current chat length. (E.g.: 8 messages, Depth 1 means insert at index 7)
        insertAt = chat.length + insertAt;
    }

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

    return '';
}

export async function sendNarratorMessage(args, text) {
    if (!text) {
        return '';
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
            api: 'manual',
            model: 'slash command',
        },
    };

    let insertAt = Number(args.at);

    // Convert possible depth parameter to index
    if (!isNaN(insertAt) && (insertAt < 0 || insertAt === Number(-0))) {
        // Negative value means going back from current chat length. (E.g.: 8 messages, Depth 1 means insert at index 7)
        insertAt = chat.length + insertAt;
    }

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

    return '';
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

    let reply = await generateQuietPrompt(text, true, false);
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
            api: 'manual',
            model: 'slash command',
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
        return '';
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
            api: 'manual',
            model: 'slash command',
        },
    };

    let insertAt = Number(args.at);

    // Convert possible depth parameter to index
    if (!isNaN(insertAt) && (insertAt < 0 || insertAt === Number(-0))) {
        // Negative value means going back from current chat length. (E.g.: 8 messages, Depth 1 means insert at index 7)
        insertAt = chat.length + insertAt;
    }

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

    return '';
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

    return '';
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
        return '';
    }

    const bgElement = result[0].item.element;

    if (bgElement instanceof HTMLElement) {
        bgElement.click();
    }

    return '';
}

/**
 * Retrieves the available model options based on the currently selected main API and its subtype
 * @param {boolean} quiet - Whether to suppress toasts
 *
 * @returns {{control: HTMLSelectElement, options: HTMLOptionElement[]}?} An array of objects representing the available model options, or null if not supported
 */
function getModelOptions(quiet) {
    const nullResult = { control: null, options: null };
    const modelSelectMap = [
        { id: 'model_togetherai_select', api: 'textgenerationwebui', type: textgen_types.TOGETHERAI },
        { id: 'openrouter_model', api: 'textgenerationwebui', type: textgen_types.OPENROUTER },
        { id: 'model_infermaticai_select', api: 'textgenerationwebui', type: textgen_types.INFERMATICAI },
        { id: 'model_dreamgen_select', api: 'textgenerationwebui', type: textgen_types.DREAMGEN },
        { id: 'mancer_model', api: 'textgenerationwebui', type: textgen_types.MANCER },
        { id: 'vllm_model', api: 'textgenerationwebui', type: textgen_types.VLLM },
        { id: 'aphrodite_model', api: 'textgenerationwebui', type: textgen_types.APHRODITE },
        { id: 'ollama_model', api: 'textgenerationwebui', type: textgen_types.OLLAMA },
        { id: 'tabby_model', api: 'textgenerationwebui', type: textgen_types.TABBY },
        { id: 'model_openai_select', api: 'openai', type: chat_completion_sources.OPENAI },
        { id: 'model_claude_select', api: 'openai', type: chat_completion_sources.CLAUDE },
        { id: 'model_windowai_select', api: 'openai', type: chat_completion_sources.WINDOWAI },
        { id: 'model_openrouter_select', api: 'openai', type: chat_completion_sources.OPENROUTER },
        { id: 'model_ai21_select', api: 'openai', type: chat_completion_sources.AI21 },
        { id: 'model_google_select', api: 'openai', type: chat_completion_sources.MAKERSUITE },
        { id: 'model_mistralai_select', api: 'openai', type: chat_completion_sources.MISTRALAI },
        { id: 'model_custom_select', api: 'openai', type: chat_completion_sources.CUSTOM },
        { id: 'model_cohere_select', api: 'openai', type: chat_completion_sources.COHERE },
        { id: 'model_perplexity_select', api: 'openai', type: chat_completion_sources.PERPLEXITY },
        { id: 'model_groq_select', api: 'openai', type: chat_completion_sources.GROQ },
        { id: 'model_01ai_select', api: 'openai', type: chat_completion_sources.ZEROONEAI },
        { id: 'model_blockentropy_select', api: 'openai', type: chat_completion_sources.BLOCKENTROPY },
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
                return nullResult;
        }
    }

    const apiSubType = getSubType();
    const modelSelectItem = modelSelectMap.find(x => x.api == main_api && x.type == apiSubType)?.id;

    if (!modelSelectItem) {
        !quiet && toastr.info('Setting a model for your API is not supported or not implemented yet.');
        return nullResult;
    }

    const modelSelectControl = document.getElementById(modelSelectItem);

    if (!(modelSelectControl instanceof HTMLSelectElement)) {
        !quiet && toastr.error(`Model select control not found: ${main_api}[${apiSubType}]`);
        return nullResult;
    }

    const options = Array.from(modelSelectControl.options).filter(x => x.value);
    return { control: modelSelectControl, options };
}

/**
 * Sets a model for the current API.
 * @param {object} args Named arguments
 * @param {string} model New model name
 * @returns {string} New or existing model name
 */
function modelCallback(args, model) {
    const quiet = isTrueBoolean(args?.quiet);
    const { control: modelSelectControl, options } = getModelOptions(quiet);

    // If no model was found, the reason was already logged, we just return here
    if (options === null) {
        return '';
    }

    if (!options.length) {
        !quiet && toastr.warning('No model options found. Check your API settings.');
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
        !quiet && toastr.success(`Model set to "${newSelectedOption.text}"`);
        return newSelectedOption.value;
    } else {
        !quiet && toastr.warning(`No model found with name "${model}"`);
        return '';
    }
}

/**
 * Sets state of prompt entries (toggles) either via identifier/uuid or name.
 * @param {object} args Object containing arguments
 * @param {string} args.identifier Select prompt entry using an identifier (uuid)
 * @param {string} args.name Select prompt entry using name
 * @param {string} targetState The targeted state of the entry/entries
 * @returns {String} empty string
 */
function setPromptEntryCallback(args, targetState) {
    // needs promptManager to manipulate prompt entries
    const promptManager = setupChatCompletionPromptManager(oai_settings);
    const prompts = promptManager.serviceSettings.prompts;

    function parseArgs(arg) {
        const list = [];
        try {
            const parsedArg = JSON.parse(arg);
            list.push(...Array.isArray(parsedArg) ? parsedArg : [arg]);
        } catch {
            list.push(arg);
        }
        return list;
    }

    let identifiersList = parseArgs(args.identifier);
    let nameList = parseArgs(args.name);

    // Check if identifiers exists in prompt, else remove from list
    if (identifiersList.length !== 0) {
        identifiersList = identifiersList.filter(identifier => prompts.some(prompt => prompt.identifier === identifier));
    }

    if (nameList.length !== 0) {
        nameList.forEach(name => {
            // one name could potentially have multiple entries, find all identifiers that match given name
            let identifiers = [];
            prompts.forEach(entry => {
                if (entry.name === name) {
                    identifiers.push(entry.identifier);
                }
            });
            identifiersList = identifiersList.concat(identifiers);
        });
    }

    // Remove duplicates to allow consistent 'toggle'
    identifiersList = [...new Set(identifiersList)];
    if (identifiersList.length === 0) return '';

    // logic adapted from PromptManager.js, handleToggle
    const getPromptOrderEntryState = (promptOrderEntry) => {
        if (['toggle', 't', ''].includes(targetState.trim().toLowerCase())) {
            return !promptOrderEntry.enabled;
        }

        if (isTrueBoolean(targetState)) {
            return true;
        }

        if (isFalseBoolean(targetState)) {
            return false;
        }

        return promptOrderEntry.enabled;
    };

    identifiersList.forEach(promptID => {
        const promptOrderEntry = promptManager.getPromptOrderEntry(promptManager.activeCharacter, promptID);
        const counts = promptManager.tokenHandler.getCounts();

        counts[promptID] = null;
        promptOrderEntry.enabled = getPromptOrderEntryState(promptOrderEntry);
    });

    // no need to render for each identifier
    promptManager.render();
    promptManager.saveServiceSettings();
    return '';
}

/**
 * Sets the API URL and triggers the text generation web UI button click.
 *
 * @param {object} args - named args
 * @param {string?} [args.api=null] - the API name to set/get the URL for
 * @param {string?} [args.connect=true] - whether to connect to the API after setting
 * @param {string?} [args.quiet=false] - whether to suppress toasts
 * @param {string} url - the API URL to set
 * @returns {Promise<string>}
 */
async function setApiUrlCallback({ api = null, connect = 'true', quiet = 'false' }, url) {
    const isQuiet = isTrueBoolean(quiet);
    const autoConnect = isTrueBoolean(connect);

    // Special handling for Chat Completion Custom OpenAI compatible, that one can also support API url handling
    const isCurrentlyCustomOpenai = main_api === 'openai' && oai_settings.chat_completion_source === chat_completion_sources.CUSTOM;
    if (api === chat_completion_sources.CUSTOM || (!api && isCurrentlyCustomOpenai)) {
        if (!url) {
            return oai_settings.custom_url ?? '';
        }

        if (!isCurrentlyCustomOpenai && autoConnect) {
            toastr.warning('Custom OpenAI API is not the currently selected API, so we cannot do an auto-connect. Consider switching to it via /api beforehand.');
            return '';
        }

        $('#custom_api_url_text').val(url).trigger('input');

        if (autoConnect) {
            $('#api_button_openai').trigger('click');
        }

        return url;
    }

    // Special handling for Kobold Classic API
    const isCurrentlyKoboldClassic = main_api === 'kobold';
    if (api === 'kobold' || (!api && isCurrentlyKoboldClassic)) {
        if (!url) {
            return api_server ?? '';
        }

        if (!isCurrentlyKoboldClassic && autoConnect) {
            toastr.warning('Kobold Classic API is not the currently selected API, so we cannot do an auto-connect. Consider switching to it via /api beforehand.');
            return '';
        }

        $('#api_url_text').val(url).trigger('input');
        // trigger blur debounced, so we hide the autocomplete menu
        setTimeout(() => $('#api_url_text').trigger('blur'), 1);

        if (autoConnect) {
            $('#api_button').trigger('click');
        }

        return api_server ?? '';
    }

    // Do some checks and get the api type we are targeting with this command
    if (api && !Object.values(textgen_types).includes(api)) {
        !isQuiet && toastr.warning(`API '${api}' is not a valid text_gen API.`);
        return '';
    }
    if (!api && !Object.values(textgen_types).includes(textgenerationwebui_settings.type)) {
        !isQuiet && toastr.warning(`API '${textgenerationwebui_settings.type}' is not a valid text_gen API.`);
        return '';
    }
    if (!api && main_api !== 'textgenerationwebui') {
        !isQuiet && toastr.warning(`API type '${main_api}' does not support setting the server URL.`);
        return '';
    }
    if (api && url && autoConnect && api !== textgenerationwebui_settings.type) {
        !isQuiet && toastr.warning(`API '${api}' is not the currently selected API, so we cannot do an auto-connect. Consider switching to it via /api beforehand.`);
        return '';
    }
    const type = api || textgenerationwebui_settings.type;

    const inputSelector = SERVER_INPUTS[type];
    if (!inputSelector) {
        !isQuiet && toastr.warning(`API '${type}' does not have a server url input.`);
        return '';
    }

    // If no url was provided, return the current one
    if (!url) {
        return textgenerationwebui_settings.server_urls[type] ?? '';
    }

    // else, we want to actually set the url
    $(inputSelector).val(url).trigger('input');
    // trigger blur debounced, so we hide the autocomplete menu
    setTimeout(() => $(inputSelector).trigger('blur'), 1);

    // Trigger the auto connect via connect button, if requested
    if (autoConnect) {
        $('#api_button_textgenerationwebui').trigger('click');
    }

    // We still re-acquire the value, as it might have been modified by the validation on connect
    return textgenerationwebui_settings.server_urls[type] ?? '';
}

async function selectTokenizerCallback(_, name) {
    if (!name) {
        return getAvailableTokenizers().find(tokenizer => tokenizer.tokenizerId === power_user.tokenizer)?.tokenizerKey ?? '';
    }

    const tokenizers = getAvailableTokenizers();
    const fuse = new Fuse(tokenizers, { keys: ['tokenizerKey', 'tokenizerName'] });
    const result = fuse.search(name);

    if (result.length === 0) {
        toastr.warning(`Tokenizer "${name}" not found`);
        return '';
    }

    /** @type {import('./tokenizers.js').Tokenizer} */
    const foundTokenizer = result[0].item;
    selectTokenizer(foundTokenizer.tokenizerId);

    return foundTokenizer.tokenizerKey;
}

export let isExecutingCommandsFromChatInput = false;
export let commandsFromChatInputAbortController;

/**
 * Show command execution pause/stop buttons next to chat input.
 */
export function activateScriptButtons() {
    document.querySelector('#form_sheld').classList.add('isExecutingCommandsFromChatInput');
}

/**
 * Hide command execution pause/stop buttons next to chat input.
 */
export function deactivateScriptButtons() {
    document.querySelector('#form_sheld').classList.remove('isExecutingCommandsFromChatInput');
}

/**
 * Toggle pause/continue command execution. Only for commands executed via chat input.
 */
export function pauseScriptExecution() {
    if (commandsFromChatInputAbortController) {
        if (commandsFromChatInputAbortController.signal.paused) {
            commandsFromChatInputAbortController.continue('Clicked pause button');
            document.querySelector('#form_sheld').classList.remove('script_paused');
        } else {
            commandsFromChatInputAbortController.pause('Clicked pause button');
            document.querySelector('#form_sheld').classList.add('script_paused');
        }
    }
}

/**
 * Stop command execution. Only for commands executed via chat input.
 */
export function stopScriptExecution() {
    commandsFromChatInputAbortController?.abort('Clicked stop button');
}

/**
 * Clear up command execution progress bar above chat input.
 * @returns Promise<void>
 */
async function clearCommandProgress() {
    if (isExecutingCommandsFromChatInput) return;
    document.querySelector('#send_textarea').style.setProperty('--progDone', '1');
    await delay(250);
    if (isExecutingCommandsFromChatInput) return;
    document.querySelector('#send_textarea').style.transition = 'none';
    await delay(1);
    document.querySelector('#send_textarea').style.setProperty('--prog', '0%');
    document.querySelector('#send_textarea').style.setProperty('--progDone', '0');
    document.querySelector('#form_sheld').classList.remove('script_success');
    document.querySelector('#form_sheld').classList.remove('script_error');
    document.querySelector('#form_sheld').classList.remove('script_aborted');
    await delay(1);
    document.querySelector('#send_textarea').style.transition = null;
}
/**
 * Debounced version of clearCommandProgress.
 */
const clearCommandProgressDebounced = debounce(clearCommandProgress);

/**
 * @typedef ExecuteSlashCommandsOptions
 * @prop {boolean} [handleParserErrors] (true) Whether to handle parser errors (show toast on error) or throw.
 * @prop {SlashCommandScope} [scope] (null) The scope to be used when executing the commands.
 * @prop {boolean} [handleExecutionErrors] (false) Whether to handle execution errors (show toast on error) or throw
 * @prop {{[id:PARSER_FLAG]:boolean}} [parserFlags] (null) Parser flags to apply
 * @prop {SlashCommandAbortController} [abortController] (null) Controller used to abort or pause command execution
 * @prop {SlashCommandDebugController} [debugController] (null) Controller used to control debug execution
 * @prop {(done:number, total:number)=>void} [onProgress] (null) Callback to handle progress events
 * @prop {string} [source] (null) String indicating where the code come from (e.g., QR name)
 */

/**
 * @typedef ExecuteSlashCommandsOnChatInputOptions
 * @prop {SlashCommandScope} [scope] (null) The scope to be used when executing the commands.
 * @prop {{[id:PARSER_FLAG]:boolean}} [parserFlags] (null) Parser flags to apply
 * @prop {boolean} [clearChatInput] (false) Whether to clear the chat input textarea
 * @prop {string} [source] (null) String indicating where the code come from (e.g., QR name)
 */

/**
 * Execute slash commands while showing progress indicator and pause/stop buttons on
 * chat input.
 * @param {string} text Slash command text
 * @param {ExecuteSlashCommandsOnChatInputOptions} options
 */
export async function executeSlashCommandsOnChatInput(text, options = {}) {
    if (isExecutingCommandsFromChatInput) return null;

    options = Object.assign({
        scope: null,
        parserFlags: null,
        clearChatInput: false,
        source: null,
    }, options);

    isExecutingCommandsFromChatInput = true;
    commandsFromChatInputAbortController?.abort('processCommands was called');
    activateScriptButtons();

    /**@type {HTMLTextAreaElement}*/
    const ta = document.querySelector('#send_textarea');

    if (options.clearChatInput) {
        ta.value = '';
        ta.dispatchEvent(new Event('input', { bubbles: true }));
    }

    document.querySelector('#send_textarea').style.setProperty('--prog', '0%');
    document.querySelector('#send_textarea').style.setProperty('--progDone', '0');
    document.querySelector('#form_sheld').classList.remove('script_success');
    document.querySelector('#form_sheld').classList.remove('script_error');
    document.querySelector('#form_sheld').classList.remove('script_aborted');

    /**@type {SlashCommandClosureResult} */
    let result = null;
    let currentProgress = 0;
    try {
        commandsFromChatInputAbortController = new SlashCommandAbortController();
        result = await executeSlashCommandsWithOptions(text, {
            abortController: commandsFromChatInputAbortController,
            onProgress: (done, total) => {
                const newProgress = done / total;
                if (newProgress > currentProgress) {
                    currentProgress = newProgress;
                    ta.style.setProperty('--prog', `${newProgress * 100}%`);
                }
            },
            parserFlags: options.parserFlags,
            scope: options.scope,
            source: options.source,
        });
        if (commandsFromChatInputAbortController.signal.aborted) {
            document.querySelector('#form_sheld').classList.add('script_aborted');
        } else {
            document.querySelector('#form_sheld').classList.add('script_success');
        }
    } catch (e) {
        document.querySelector('#form_sheld').classList.add('script_error');
        result = new SlashCommandClosureResult();
        result.isError = true;
        result.errorMessage = e.message || 'An unknown error occurred';
        if (e.cause !== 'abort') {
            if (e instanceof SlashCommandExecutionError) {
                /**@type {SlashCommandExecutionError}*/
                const ex = e;
                const toast = `
                    <div>${ex.message}</div>
                    <div>Line: ${ex.line} Column: ${ex.column}</div>
                    <pre style="text-align:left;">${ex.hint}</pre>
                    `;
                const clickHint = '<p>Click to see details</p>';
                toastr.error(
                    `${toast}${clickHint}`,
                    'SlashCommandExecutionError',
                    { escapeHtml: false, timeOut: 10000, onclick: () => callPopup(toast, 'text') },
                );
            } else {
                toastr.error(result.errorMessage);
            }
        }
    } finally {
        delay(1000).then(() => clearCommandProgressDebounced());

        commandsFromChatInputAbortController = null;
        deactivateScriptButtons();
        isExecutingCommandsFromChatInput = false;
    }
    return result;
}

/**
 *
 * @param {string} text Slash command text
 * @param {ExecuteSlashCommandsOptions} [options]
 * @returns {Promise<SlashCommandClosureResult>}
 */
async function executeSlashCommandsWithOptions(text, options = {}) {
    if (!text) {
        return null;
    }
    options = Object.assign({
        handleParserErrors: true,
        scope: null,
        handleExecutionErrors: false,
        parserFlags: null,
        abortController: null,
        debugController: null,
        onProgress: null,
        source: null,
    }, options);

    let closure;
    try {
        closure = parser.parse(text, true, options.parserFlags, options.abortController ?? new SlashCommandAbortController());
        closure.scope.parent = options.scope;
        closure.onProgress = options.onProgress;
        closure.debugController = options.debugController;
        closure.source = options.source;
    } catch (e) {
        if (options.handleParserErrors && e instanceof SlashCommandParserError) {
            /**@type {SlashCommandParserError}*/
            const ex = e;
            const toast = `
                <div>${ex.message}</div>
                <div>Line: ${ex.line} Column: ${ex.column}</div>
                <pre style="text-align:left;">${ex.hint}</pre>
                `;
            const clickHint = '<p>Click to see details</p>';
            toastr.error(
                `${toast}${clickHint}`,
                'SlashCommandParserError',
                { escapeHtml: false, timeOut: 10000, onclick: () => callPopup(toast, 'text') },
            );
            const result = new SlashCommandClosureResult();
            return result;
        } else {
            throw e;
        }
    }

    try {
        const result = await closure.execute();
        if (result.isAborted && !result.isQuietlyAborted) {
            toastr.warning(result.abortReason, 'Command execution aborted');
            closure.abortController.signal.isQuiet = true;
        }
        return result;
    } catch (e) {
        if (options.handleExecutionErrors) {
            if (e instanceof SlashCommandExecutionError) {
                /**@type {SlashCommandExecutionError}*/
                const ex = e;
                const toast = `
                    <div>${ex.message}</div>
                    <div>Line: ${ex.line} Column: ${ex.column}</div>
                    <pre style="text-align:left;">${ex.hint}</pre>
                    `;
                const clickHint = '<p>Click to see details</p>';
                toastr.error(
                    `${toast}${clickHint}`,
                    'SlashCommandExecutionError',
                    { escapeHtml: false, timeOut: 10000, onclick: () => callPopup(toast, 'text') },
                );
            } else {
                toastr.error(e.message);
            }
            const result = new SlashCommandClosureResult();
            result.isError = true;
            result.errorMessage = e.message;
            return result;
        } else {
            throw e;
        }
    }
}
/**
 * Executes slash commands in the provided text
 * @deprecated Use executeSlashCommandWithOptions instead
 * @param {string} text Slash command text
 * @param {boolean} handleParserErrors Whether to handle parser errors (show toast on error) or throw
 * @param {SlashCommandScope} scope The scope to be used when executing the commands.
 * @param {boolean} handleExecutionErrors Whether to handle execution errors (show toast on error) or throw
 * @param {{[id:PARSER_FLAG]:boolean}} parserFlags Parser flags to apply
 * @param {SlashCommandAbortController} abortController Controller used to abort or pause command execution
 * @param {(done:number, total:number)=>void} onProgress Callback to handle progress events
 * @returns {Promise<SlashCommandClosureResult>}
 */
async function executeSlashCommands(text, handleParserErrors = true, scope = null, handleExecutionErrors = false, parserFlags = null, abortController = null, onProgress = null) {
    return executeSlashCommandsWithOptions(text, {
        handleParserErrors,
        scope,
        handleExecutionErrors,
        parserFlags,
        abortController,
        onProgress,
    });
}

/**
 *
 * @param {HTMLTextAreaElement} textarea The textarea to receive autocomplete
 * @param {Boolean} isFloating Whether to show the auto complete as a floating window (e.g., large QR editor)
 * @returns {Promise<AutoComplete>}
 */
export async function setSlashCommandAutoComplete(textarea, isFloating = false) {
    function canUseNegativeLookbehind() {
        try {
            new RegExp('(?<!_)');
            return true;
        } catch (e) {
            return false;
        }
    }

    if (!canUseNegativeLookbehind()) {
        console.warn('Cannot use negative lookbehind in this browser');
        return;
    }

    const parser = new SlashCommandParser();
    const ac = new AutoComplete(
        textarea,
        () => ac.text[0] == '/',
        async (text, index) => await parser.getNameAt(text, index),
        isFloating,
    );
    return ac;
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
