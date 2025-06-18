import {
    characters,
    saveChat,
    system_message_types,
    this_chid,
    openCharacterChat,
    chat_metadata,
    getRequestHeaders,
    getThumbnailUrl,
    getCharacters,
    chat,
    saveChatConditional,
    saveItemizedPrompts,
} from '../script.js';
import { humanizedDateTime } from './RossAscends-mods.js';
import {
    group_activation_strategy,
    groups,
    openGroupById,
    openGroupChat,
    saveGroupBookmarkChat,
    selected_group,
} from './group-chats.js';
import { hideLoader, showLoader } from './loader.js';
import { getLastMessageId } from './macros.js';
import { Popup } from './popup.js';
import { SlashCommand } from './slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from './slash-commands/SlashCommandArgument.js';
import { commonEnumProviders } from './slash-commands/SlashCommandCommonEnumsProvider.js';
import { SlashCommandParser } from './slash-commands/SlashCommandParser.js';
import { createTagMapFromList } from './tags.js';
import { renderTemplateAsync } from './templates.js';
import { t } from './i18n.js';

import {
    getUniqueName,
    isTrueBoolean,
} from './utils.js';

const bookmarkNameToken = 'Checkpoint #';

/**
 * Gets the names of existing chats for the current character or group.
 * @returns {Promise<string[]>} - Returns a promise that resolves to an array of existing chat names.
 */
async function getExistingChatNames() {
    if (selected_group) {
        const group = groups.find(x => x.id == selected_group);
        if (group && Array.isArray(group.chats)) {
            return [...group.chats];
        }

        return [];
    }

    if (this_chid === undefined) {
        return [];
    }

    const character = characters[this_chid];
    if (!character) {
        return [];
    }

    const response = await fetch('/api/characters/chats', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ avatar_url: character.avatar, simple: true }),
    });

    if (response.ok) {
        const data = await response.json();
        const chats = Object.values(data).map(x => x.file_name.replace('.jsonl', ''));
        return [...chats];
    }

    return [];
}

async function getBookmarkName({ isReplace = false, forceName = null } = {}) {
    const chatNames = await getExistingChatNames();

    const body = await renderTemplateAsync('createCheckpoint', { isReplace: isReplace });
    let name = forceName ?? await Popup.show.input('Create Checkpoint', body);
    // Special handling for confirmed empty input (=> auto-generate name)
    if (name === '') {
        for (let i = chatNames.length; i < 1000; i++) {
            name = bookmarkNameToken + i;
            if (!chatNames.includes(name)) {
                break;
            }
        }
    }
    if (!name) {
        return null;
    }

    return `${name} - ${humanizedDateTime()}`;
}

function getMainChatName() {
    if (chat_metadata) {
        if (chat_metadata['main_chat']) {
            return chat_metadata['main_chat'];
        }
        // groups didn't support bookmarks before chat metadata was introduced
        else if (selected_group) {
            return null;
        }
        else if (characters[this_chid].chat && characters[this_chid].chat.includes(bookmarkNameToken)) {
            const tokenIndex = characters[this_chid].chat.lastIndexOf(bookmarkNameToken);
            chat_metadata['main_chat'] = characters[this_chid].chat.substring(0, tokenIndex).trim();
            return chat_metadata['main_chat'];
        }
    }
    return null;
}

export function showBookmarksButtons() {
    try {
        if (selected_group) {
            $('#option_convert_to_group').hide();
        } else {
            $('#option_convert_to_group').show();
        }

        if (chat_metadata['main_chat']) {
            // In bookmark chat
            $('#option_back_to_main').show();
            $('#option_new_bookmark').show();
        } else if (!selected_group && !characters[this_chid].chat) {
            // No chat recorded on character
            $('#option_back_to_main').hide();
            $('#option_new_bookmark').hide();
        } else {
            // In main chat
            $('#option_back_to_main').hide();
            $('#option_new_bookmark').show();
        }
    }
    catch {
        $('#option_back_to_main').hide();
        $('#option_new_bookmark').hide();
        $('#option_convert_to_group').hide();
    }
}

async function saveBookmarkMenu() {
    if (!chat.length) {
        toastr.warning('The chat is empty.', 'Checkpoint creation failed');
        return;
    }

    return await createNewBookmark(chat.length - 1);
}

// Export is used by Timelines extension. Do not remove.
export async function createBranch(mesId) {
    if (!chat.length) {
        toastr.warning('The chat is empty.', 'Branch creation failed');
        return;
    }

    if (mesId < 0 || mesId >= chat.length) {
        toastr.warning('Invalid message ID.', 'Branch creation failed');
        return;
    }

    const lastMes = chat[mesId];
    const mainChat = selected_group ? groups?.find(x => x.id == selected_group)?.chat_id : characters[this_chid].chat;
    const newMetadata = { main_chat: mainChat };
    let name = `Branch #${mesId} - ${humanizedDateTime()}`;

    if (selected_group) {
        await saveGroupBookmarkChat(selected_group, name, newMetadata, mesId);
    } else {
        await saveChat({ chatName: name, withMetadata: newMetadata, mesId });
    }
    // append to branches list if it exists
    // otherwise create it
    if (typeof lastMes.extra !== 'object') {
        lastMes.extra = {};
    }
    if (typeof lastMes.extra['branches'] !== 'object') {
        lastMes.extra['branches'] = [];
    }
    lastMes.extra['branches'].push(name);
    return name;
}

/**
 * Creates a new bookmark for a message.
 *
 * @param {number} mesId - The ID of the message.
 * @param {Object} [options={}] - Optional parameters.
 * @param {string?} [options.forceName=null] - The name to force for the bookmark.
 * @returns {Promise<string?>} - A promise that resolves to the bookmark name when the bookmark is created.
 */
export async function createNewBookmark(mesId, { forceName = null } = {}) {
    if (this_chid === undefined && !selected_group) {
        toastr.info('No character selected.', 'Create Checkpoint');
        return null;
    }
    if (!chat.length) {
        toastr.warning('The chat is empty.', 'Create Checkpoint');
        return null;
    }
    if (!chat[mesId]) {
        toastr.warning('Invalid message ID.', 'Create Checkpoint');
        return null;
    }

    const lastMes = chat[mesId];

    if (typeof lastMes.extra !== 'object') {
        lastMes.extra = {};
    }

    const isReplace = lastMes.extra.bookmark_link;

    let name = await getBookmarkName({ isReplace: isReplace, forceName: forceName });
    if (!name) {
        return null;
    }

    const mainChat = selected_group ? groups?.find(x => x.id == selected_group)?.chat_id : characters[this_chid].chat;
    const newMetadata = { main_chat: mainChat };
    await saveItemizedPrompts(name);

    if (selected_group) {
        await saveGroupBookmarkChat(selected_group, name, newMetadata, mesId);
    } else {
        await saveChat({ chatName: name, withMetadata: newMetadata, mesId });
    }

    lastMes.extra['bookmark_link'] = name;

    const mes = $(`.mes[mesid="${mesId}"]`);
    updateBookmarkDisplay(mes, name);

    await saveChatConditional();
    toastr.success('Click the flag icon next to the message to open the checkpoint chat.', 'Create Checkpoint', { timeOut: 10000 });
    return name;
}


/**
 * Updates the display of the bookmark on a chat message.
 * @param {JQuery<HTMLElement>} mes - The message element
 * @param {string?} [newBookmarkLink=null] - The new bookmark link (optional)
 */
export function updateBookmarkDisplay(mes, newBookmarkLink = null) {
    newBookmarkLink && mes.attr('bookmark_link', newBookmarkLink);
    const bookmarkFlag = mes.find('.mes_bookmark');
    bookmarkFlag.attr('title', `Checkpoint\n${mes.attr('bookmark_link')}\n\n${bookmarkFlag.data('tooltip')}`);
}

async function backToMainChat() {
    const mainChatName = getMainChatName();
    const allChats = await getExistingChatNames();

    if (allChats.includes(mainChatName)) {
        if (selected_group) {
            await openGroupChat(selected_group, mainChatName);
        } else {
            await openCharacterChat(mainChatName);
        }
        return mainChatName;
    }

    return null;
}

export async function convertSoloToGroupChat() {
    if (selected_group) {
        console.log('Already in group. No need for conversion');
        return;
    }

    if (this_chid === undefined) {
        console.log('Need to have a character selected');
        return;
    }

    const confirm = await Popup.show.confirm(t`Convert to group chat`, t`Are you sure you want to convert this chat to a group chat?` + '<br />' + t`This cannot be reverted.`);
    if (!confirm) {
        return;
    }

    const character = characters[this_chid];

    // Populate group required fields
    const name = getUniqueName(`Group: ${character.name}`, y => groups.findIndex(x => x.name === y) !== -1);
    const avatar = getThumbnailUrl('avatar', character.avatar);
    const chatName = humanizedDateTime();
    const chats = [chatName];
    const members = [character.avatar];
    const activationStrategy = group_activation_strategy.NATURAL;
    const allowSelfResponses = false;
    const favChecked = character.fav || character.fav == 'true';
    /** @type {any} */
    const metadata = Object.assign({}, chat_metadata);
    delete metadata.main_chat;

    const createGroupResponse = await fetch('/api/groups/create', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            name: name,
            members: members,
            avatar_url: avatar,
            allow_self_responses: activationStrategy,
            activation_strategy: allowSelfResponses,
            disabled_members: [],
            chat_metadata: metadata,
            fav: favChecked,
            chat_id: chatName,
            chats: chats,
        }),
    });

    if (!createGroupResponse.ok) {
        console.error('Group creation unsuccessful');
        return;
    }

    const group = await createGroupResponse.json();

    // Convert tags list and assign to group
    createTagMapFromList('#tagList', group.id);

    // Update chars list
    await getCharacters();

    // Convert chat to group format
    const groupChat = chat.slice();
    const genIdFirst = Date.now();

    for (let index = 0; index < groupChat.length; index++) {
        const message = groupChat[index];

        // Save group-chat marker
        if (index == 0) {
            message.is_group = true;
        }

        // Skip messages we don't care about
        if (message.is_user || message.is_system || message.extra?.type === system_message_types.NARRATOR || message.force_avatar !== undefined) {
            continue;
        }

        // Set force fields for solo character
        message.name = character.name;
        message.original_avatar = character.avatar;
        message.force_avatar = getThumbnailUrl('avatar', character.avatar);

        // Allow regens of a single message in group
        if (typeof message.extra !== 'object') {
            message.extra = { gen_id: genIdFirst + index };
        }
    }

    // Save group chat
    const createChatResponse = await fetch('/api/chats/group/save', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ id: chatName, chat: groupChat }),
    });

    if (!createChatResponse.ok) {
        console.error('Group chat creation unsuccessful');
        toastr.error('Group chat creation unsuccessful');
        return;
    }

    // Click on the freshly selected group to open it
    await openGroupById(group.id);

    toastr.success(t`The chat has been successfully converted!`);
}

/**
 * Creates a new branch from the message with the given ID
 * @param {number} mesId Message ID
 * @returns {Promise<string?>} Branch file name
 */
export async function branchChat(mesId) {
    if (this_chid === undefined && !selected_group) {
        toastr.info('No character selected.', 'Create Branch');
        return null;
    }

    const fileName = await createBranch(mesId);
    await saveItemizedPrompts(fileName);

    if (selected_group) {
        await openGroupChat(selected_group, fileName);
    } else {
        await openCharacterChat(fileName);
    }

    return fileName;
}

function registerBookmarksSlashCommands() {
    /**
     * Validates a message ID. (Is a number, exists as a message)
     *
     * @param {number} mesId - The message ID to validate.
     * @param {string} context - The context of the slash command. Will be used as the title of any toasts.
     * @returns {boolean} - Returns true if the message ID is valid, otherwise false.
     */
    function validateMessageId(mesId, context) {
        if (isNaN(mesId)) {
            toastr.warning('Invalid message ID was provided', context);
            return false;
        }
        if (!chat[mesId]) {
            toastr.warning(`Message for id ${mesId} not found`, context);
            return false;
        }
        return true;
    }

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'branch-create',
        returns: 'Name of the new branch',
        callback: async (args, text) => {
            const mesId = Number(args.mesId ?? text ?? getLastMessageId());
            if (!validateMessageId(mesId, 'Create Branch')) return '';

            const branchName = await branchChat(mesId);
            return branchName ?? '';
        },
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Message ID',
                typeList: [ARGUMENT_TYPE.NUMBER],
                enumProvider: commonEnumProviders.messages(),
            }),
        ],
        helpString: `
        <div>
            Create a new branch from the selected message. If no message id is provided, will use the last message.
        </div>
        <div>
            Creating a branch will automatically choose a name for the branch.<br />
            After creating the branch, the branch chat will be automatically opened.
        </div>
        <div>
            Use Checkpoints and <code>/checkpoint-create</code> instead if you do not want to jump to the new chat.
        </div>`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'checkpoint-create',
        returns: 'Name of the new checkpoint',
        callback: async (args, text) => {
            const mesId = Number(args.mesId ?? getLastMessageId());
            if (!validateMessageId(mesId, 'Create Checkpoint')) return '';

            if (typeof text !== 'string') {
                toastr.warning('Checkpoint name must be a string or empty', 'Create Checkpoint');
                return '';
            }

            const checkPointName = await createNewBookmark(mesId, { forceName: text });
            return checkPointName ?? '';
        },
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'mesId',
                description: 'Message ID',
                typeList: [ARGUMENT_TYPE.NUMBER],
                enumProvider: commonEnumProviders.messages(),
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Checkpoint name',
                typeList: [ARGUMENT_TYPE.STRING],
            }),
        ],
        helpString: `
        <div>
            Create a new checkpoint for the selected message with the provided name. If no message id is provided, will use the last message.<br />
            Leave the checkpoint name empty to auto-generate one.
        </div>
        <div>
            A created checkpoint will be permanently linked with the message.<br />
            If a checkpoint already exists, the link to it will be overwritten.<br />
            After creating the checkpoint, the checkpoint chat can be opened with the checkpoint flag,
            using the <code>/go</code> command with the checkpoint name or the <code>/checkpoint-go</code> command on the message.
        </div>
        <div>
            Use Branches and <code>/branch-create</code> instead if you do want to jump to the new chat.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code>/checkpoint-create mes={{lastCharMessage}} Checkpoint for char reply | /setvar key=rememberCheckpoint {{pipe}}</code></pre>
                    Will create a new checkpoint to the latest message of the current character, and save it as a local variable for future use.
                </li>
            </ul>
        </div>`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'checkpoint-go',
        returns: 'Name of the checkpoint',
        callback: async (args, text) => {
            const mesId = Number(args.mesId ?? text ?? getLastMessageId());
            if (!validateMessageId(mesId, 'Open Checkpoint')) return '';

            const checkPointName = chat[mesId].extra?.bookmark_link;
            if (!checkPointName) {
                toastr.warning('No checkpoint is linked to the selected message', 'Open Checkpoint');
                return '';
            }

            if (selected_group) {
                await openGroupChat(selected_group, checkPointName);
            } else {
                await openCharacterChat(checkPointName);
            }

            return checkPointName;
        },
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Message ID',
                typeList: [ARGUMENT_TYPE.NUMBER],
                enumProvider: commonEnumProviders.messages(),
            }),
        ],
        helpString: `
        <div>
            Open the checkpoint linked to the selected message. If no message id is provided, will use the last message.
        </div>
        <div>
            Use <code>/checkpoint-get</code> if you want to make sure that the selected message has a checkpoint.
        </div>`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'checkpoint-exit',
        returns: 'The name of the chat exited to. Returns an empty string if not in a checkpoint chat.',
        callback: async () => {
            const mainChat = await backToMainChat();
            return mainChat ?? '';
        },
        helpString: 'Exit the checkpoint chat.<br />If not in a checkpoint chat, returns empty string.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'checkpoint-parent',
        returns: 'Name of the parent chat for this checkpoint',
        callback: async () => {
            const mainChatName = getMainChatName();
            return mainChatName ?? '';
        },
        helpString: 'Get the name of the parent chat for this checkpoint.<br />If not in a checkpoint chat, returns empty string.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'checkpoint-get',
        returns: 'Name of the chat',
        callback: async (args, text) => {
            const mesId = Number(args.mesId ?? text ?? getLastMessageId());
            if (!validateMessageId(mesId, 'Get Checkpoint')) return '';

            const checkPointName = chat[mesId].extra?.bookmark_link;
            return checkPointName ?? '';
        },
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Message ID',
                typeList: [ARGUMENT_TYPE.NUMBER],
                enumProvider: commonEnumProviders.messages(),
            }),
        ],
        helpString: `
        <div>
            Get the name of the checkpoint linked to the selected message. If no message id is provided, will use the last message.<br />
            If no checkpoint is linked, the result will be empty.
        </div>`,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'checkpoint-list',
        returns: 'JSON array of all existing checkpoints in this chat, as an array',
        /** @param {{links?: string}} args @returns {Promise<string>} */
        callback: async (args, _) => {
            const result = Object.entries(chat)
                .filter(([_, message]) => message.extra?.bookmark_link)
                .map(([mesId, message]) => isTrueBoolean(args.links) ? message.extra.bookmark_link : Number(mesId));
            return JSON.stringify(result);
        },
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'links',
                description: 'Get a list of all links / chat names of the checkpoints, instead of the message ids',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                enumList: commonEnumProviders.boolean('trueFalse')(),
                defaultValue: 'false',
            }),
        ],
        helpString: `
        <div>
            List all existing checkpoints in this chat.
        </div>
        <div>
            Returns a list of all message ids that have a checkpoint, or all checkpoint links if <code>links</code> is set to <code>true</code>.<br />
            The value will be a JSON array.
        </div>`,
    }));
}

export function initBookmarks() {
    $('#option_new_bookmark').on('click', saveBookmarkMenu);
    $('#option_back_to_main').on('click', backToMainChat);
    $('#option_convert_to_group').on('click', convertSoloToGroupChat);

    $(document).on('click', '.select_chat_block, .mes_bookmark', async function (e) {
        // If shift is held down, we are not following the bookmark, but creating a new one
        const mes = $(this).closest('.mes');
        if (e.shiftKey && mes.length) {
            const selectedMesId = mes.attr('mesid');
            await createNewBookmark(Number(selectedMesId));
            return;
        }

        const fileName = $(this).hasClass('mes_bookmark')
            ? $(this).closest('.mes').attr('bookmark_link')
            : $(this).attr('file_name').replace('.jsonl', '');

        if (!fileName) {
            return;
        }

        try {
            showLoader();
            if (selected_group) {
                await openGroupChat(selected_group, fileName);
            } else {
                await openCharacterChat(fileName);
            }
        } finally {
            await hideLoader();
        }

        $('#shadow_select_chat_popup').css('display', 'none');
    });

    $(document).on('click', '.mes_create_bookmark', async function () {
        const mesId = $(this).closest('.mes').attr('mesid');
        if (mesId !== undefined) {
            await createNewBookmark(Number(mesId));
        }
    });

    $(document).on('click', '.mes_create_branch', async function () {
        const mesId = $(this).closest('.mes').attr('mesid');
        if (mesId !== undefined) {
            await branchChat(Number(mesId));
        }
    });

    registerBookmarksSlashCommands();
}
