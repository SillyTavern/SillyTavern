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
    setActiveGroup,
    getCurrentChatDetails,
} from '../script.js';
import { humanizedDateTime } from './RossAscends-mods.js';
import {
    DEFAULT_AUTO_MODE_DELAY,
    group_activation_strategy,
    group_generation_mode,
    groups,
    openGroupById,
    openGroupChat,
    saveGroupBookmarkChat,
    selected_group,
} from './group-chats.js';
import { hideLoader, showLoader } from './loader.js';
import { getLastMessageId } from './macros.js';
import { Popup, POPUP_TYPE } from './popup.js';
import { SlashCommand } from './slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from './slash-commands/SlashCommandArgument.js';
import { commonEnumProviders } from './slash-commands/SlashCommandCommonEnumsProvider.js';
import { SlashCommandParser } from './slash-commands/SlashCommandParser.js';
import { createTagMapFromList } from './tags.js';
import { renderTemplateAsync } from './templates.js';
import { compressRequest } from './request-compression.js';
import { t } from './i18n.js';

import {
    getUniqueName,
    isTrueBoolean,
    timestampToMoment,
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
    const mainChatName = (getCurrentChatDetails()).sessionName;

    function buildCheckpointName(name, i) {
        // Strip off existing suffixes, then build new name
        let cleanName = name.replace(new RegExp(` - ${bookmarkNameToken}\\d+$`), '');
        // Strip off legacy old name prefix too
        cleanName = cleanName.replace(new RegExp(`^${bookmarkNameToken}\\d+ - `), '');
        return `${cleanName} - ${bookmarkNameToken}${i}`;
    }
    const existingChats = await getExistingChatNames();
    const suggestedName = getUniqueName(mainChatName, (x) => existingChats.includes(x), { nameBuilder: buildCheckpointName });

    const body = await renderTemplateAsync('createCheckpoint', { isReplace: isReplace, suggestedName: suggestedName });
    let name = forceName ?? await Popup.show.input('Create Checkpoint', body, suggestedName);
    // Special handling for confirmed empty input (=> auto-generate name)
    if (name === '') {
        name = suggestedName;
    }
    if (!name) {
        return null;
    }

    return name;
}

function getMainChatName() {
    if (chat_metadata) {
        if (chat_metadata.main_chat) {
            return chat_metadata.main_chat;
        } else if (selected_group) {
            // groups didn't support bookmarks before chat metadata was introduced
            return null;
        } else if (characters[this_chid].chat && characters[this_chid].chat.includes(bookmarkNameToken)) {
            const tokenIndex = characters[this_chid].chat.lastIndexOf(bookmarkNameToken);
            chat_metadata.main_chat = characters[this_chid].chat.substring(0, tokenIndex).trim();
            return chat_metadata.main_chat;
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

        if (chat_metadata.main_chat) {
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
    } catch {
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
    const mainChatName = (getCurrentChatDetails()).sessionName;
    const newMetadata = { main_chat: mainChatName };

    function buildBranchName(name, i) {
        // Strip off existing suffixes, then build new name
        let cleanName = name.replace(/ - Branch #\d+$/, '');
        // Strip off legacy old name prefix too
        cleanName = cleanName.replace(/^Branch #\d+ - /, '');
        return `${cleanName} - Branch #${i}`;
    }
    const existingChats = await getExistingChatNames();
    const name = getUniqueName(mainChatName, (x) => existingChats.includes(x), { nameBuilder: buildBranchName });
    if (!name) {
        console.error('Could not generate a unique branch name.');
        toastr.error('Could not generate a unique branch name.', 'Branch creation failed');
        return;
    }

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
    if (typeof lastMes.extra.branches !== 'object') {
        lastMes.extra.branches = [];
    }
    lastMes.extra.branches.push(name);
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

    lastMes.extra.bookmark_link = name;

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
    const favChecked = character.fav || character.fav == 'true';
    /** @type {ChatMetadata} */
    const metadata = Object.assign({}, chat_metadata);
    delete metadata.main_chat;
    /** @type {ChatHeader} */
    const chatHeader = {
        chat_metadata: metadata,
        user_name: 'unused',
        character_name: 'unused',
    };
    /** @type {Omit<Group, 'id'>} */
    const groupCreateModel = {
        name: name,
        members: members,
        avatar_url: avatar,
        allow_self_responses: false,
        activation_strategy: group_activation_strategy.NATURAL,
        disabled_members: [],
        fav: favChecked,
        chat_id: chatName,
        chats: chats,
        hideMutedSprites: false,
        generation_mode: group_generation_mode.SWAP,
        auto_mode_delay: DEFAULT_AUTO_MODE_DELAY,
    };

    const createGroupResponse = await fetch('/api/groups/create', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(groupCreateModel),
    });

    if (!createGroupResponse.ok) {
        console.error('Group creation unsuccessful');
        return;
    }

    /** @type {Group} */
    const group = await createGroupResponse.json();

    // Convert tags list and assign to group
    createTagMapFromList('#tagList', group.id);

    // Update chars list
    await getCharacters();

    // Convert chat to group format
    const groupChat = [...chat].map(m => structuredClone(m));
    const genIdFirst = Date.now();

    for (let index = 0; index < groupChat.length; index++) {
        const message = groupChat[index];

        // Skip messages we don't care about
        if (message.is_user || message.is_system || message.extra?.type === system_message_types.NARRATOR || message.force_avatar !== undefined) {
            continue;
        }

        if (!message.extra || typeof message.extra !== 'object') {
            message.extra = {};
        }

        // Set force fields for solo character
        message.name = character.name;
        message.original_avatar = character.avatar;
        message.force_avatar = getThumbnailUrl('avatar', character.avatar);
        // Allow regens of a single message in group
        message.extra.gen_id = genIdFirst + index;
    }

    // Save group chat
    const createChatRequest = await compressRequest({
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ id: chatName, chat: [chatHeader, ...groupChat] }),
    });
    const createChatResponse = await fetch('/api/chats/group/save', createChatRequest);

    if (!createChatResponse.ok) {
        console.error('Group chat creation unsuccessful');
        toastr.error('Group chat creation unsuccessful');
        return;
    }

    // Click on the freshly selected group to open it
    setActiveGroup(group.id);
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

    // Save the parent chat to persist the branches array
    await saveChatConditional();

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

/**
 * Shows a popup with a list of branch chats for a given message.
 * @param {number} mesId - The message ID that has branches
 */
async function showBranchList(mesId) {
    const message = chat[mesId];
    if (!message?.extra?.branches || !Array.isArray(message.extra.branches) || message.extra.branches.length === 0) {
        await Popup.show.text('No branches found', 'This message has no branch chats.');
        return;
    }

    const branchNames = message.extra.branches;

    try {
        showLoader();

        // Fetch all chats to get info about the branches
        const response = await fetch('/api/chats/search', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                query: '',
                avatar_url: selected_group ? null : characters[this_chid]?.avatar,
                group_id: selected_group || null,
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to fetch chat list');
        }

        const allChats = await response.json();

        // Filter to only the branches we care about
        const branchChats = allChats.filter(chat => branchNames.includes(chat.file_name));

        if (branchChats.length === 0) {
            await Popup.show.text('No branches found', 'All branch chats appear to have been deleted.');
            return;
        }

        // Sort by last message date (most recent first)
        branchChats.sort((a, b) => {
            const momentA = timestampToMoment(a.last_mes);
            const momentB = timestampToMoment(b.last_mes);
            return momentB.valueOf() - momentA.valueOf();
        });

        // Build the HTML for the branch list
        let branchListHTML = '<div class="branch-list">';
        for (const branch of branchChats) {
            const momentDate = timestampToMoment(branch.last_mes);
            const formattedDate = momentDate.isValid() ? momentDate.format('lll') : 'Unknown date';
            const preview = branch.preview_message || '(No messages)';
            const messageCount = branch.message_count || 0;

            branchListHTML += `
                <div class="branch-list-item" data-file-name="${branch.file_name}">
                    <div class="branch-list-item-header">
                        <span class="branch-list-item-name"><i class="fa-solid fa-code-branch"></i> ${branch.file_name}</span>
                        <small class="branch-list-item-date">${formattedDate}</small>
                    </div>
                    <div class="branch-list-item-preview">${messageCount} messages • ${preview}</div>
                </div>
            `;
        }
        branchListHTML += '</div>';

        // Show the popup
        const popup = new Popup(branchListHTML, POPUP_TYPE.TEXT, '', { okButton: false, cancelButton: 'Close' });

        // Add click handlers to the branch items (use one-time handler to avoid duplicates)
        const handleBranchClick = async function () {
            const fileName = $(this).attr('data-file-name');
            if (!fileName) return;

            try {
                showLoader();
                // Close the popup
                popup.completeAffirmative();

                // Remove the event handler to prevent memory leaks
                $(document).off('click', '.branch-list-item', handleBranchClick);

                if (selected_group) {
                    await openGroupChat(selected_group, fileName);
                } else {
                    await openCharacterChat(fileName);
                }
            } finally {
                await hideLoader();
            }
        };

        $(document).on('click', '.branch-list-item', handleBranchClick);

        await popup.show();
    } catch (error) {
        console.error('Error showing branch list:', error);
        await Popup.show.text('Error', 'Failed to load branch list. Please try again.');
    } finally {
        await hideLoader();
    }
}

/**
 * Builds a tree of all related chats (parents and children) and displays it in a graph.
 */
async function showBranchGraph() {
    try {
        showLoader();

        const currentChatName = (getCurrentChatDetails()).sessionName;

        if (!currentChatName) {
            await Popup.show.text('No chat loaded', 'Please open a chat first.');
            return;
        }

        // Fetch all chats to get basic info
        const response = await fetch('/api/chats/search', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                query: '',
                avatar_url: selected_group ? null : characters[this_chid]?.avatar,
                group_id: selected_group || null,
            }),
        });

        if (!response.ok) {
            throw new Error('Failed to fetch chat list');
        }

        const allChats = await response.json();
        const chatMap = new Map(allChats.map(chat => [chat.file_name, chat]));

        // Helper to fetch chat metadata (parent and branches)
        async function fetchChatMetadata(chatName) {
            try {
                const metaResponse = await fetch('/api/chats/get', {
                    method: 'POST',
                    headers: getRequestHeaders(),
                    body: JSON.stringify({
                        ch_name: selected_group ? null : characters[this_chid]?.name,
                        file_name: chatName,
                        avatar_url: selected_group ? null : characters[this_chid]?.avatar,
                    }),
                });

                if (!metaResponse.ok) {
                    return null;
                }

                const chatData = await metaResponse.json();

                // The API returns an array where the first element is metadata + user/character names
                // and the rest are messages
                let chat_metadata = null;
                let messages = [];

                if (Array.isArray(chatData)) {
                    if (chatData.length > 0) {
                        // First line contains chat_metadata
                        chat_metadata = chatData[0].chat_metadata;
                        // Rest are messages
                        messages = chatData.slice(1);
                    }
                } else {
                    // Fallback for different API response format
                    chat_metadata = chatData.chat_metadata;
                    messages = chatData.chat || [];
                }

                const branches = [];

                // Extract branches from all messages
                if (Array.isArray(messages)) {
                    for (const message of messages) {
                        if (message?.extra?.branches && Array.isArray(message.extra.branches)) {
                            branches.push(...message.extra.branches);
                        }
                    }
                }

                const metadata = {
                    main_chat: chat_metadata?.main_chat,
                    branches: [...new Set(branches)], // Remove duplicates
                };

                return metadata;
            } catch (err) {
                console.error('[BranchGraph] Error fetching metadata for', chatName, ':', err);
                return null;
            }
        }

        // Traverse to find root and collect all related chats
        const relatedChats = new Set([currentChatName]);
        const metadataCache = new Map();

        // Find root by going up the parent chain
        let rootChatName = currentChatName;
        let current = currentChatName;
        const visited = new Set();

        while (current && !visited.has(current)) {
            visited.add(current);
            relatedChats.add(current);

            const metadata = await fetchChatMetadata(current);
            if (metadata) {
                metadataCache.set(current, metadata);
                const parent = metadata.main_chat;

                if (parent && chatMap.has(parent)) {
                    rootChatName = parent;
                    current = parent;
                } else {
                    break;
                }
            } else {
                break;
            }
        }

        // Now traverse down from root to collect all children
        async function collectChildren(chatName, visitedInPath = new Set()) {
            // Prevent circular references
            if (visitedInPath.has(chatName)) {
                return;
            }

            visitedInPath.add(chatName);

            if (!metadataCache.has(chatName)) {
                const metadata = await fetchChatMetadata(chatName);
                if (metadata) {
                    metadataCache.set(chatName, metadata);
                }
            }

            const metadata = metadataCache.get(chatName);

            if (metadata?.branches) {
                for (const branchName of metadata.branches) {
                    if (chatMap.has(branchName) && !relatedChats.has(branchName)) {
                        relatedChats.add(branchName);
                        await collectChildren(branchName, new Set(visitedInPath));
                    }
                }
            }
        }

        await collectChildren(rootChatName);

        // Build tree structure
        function buildTree(chatName, depth = 0) {
            const chat = chatMap.get(chatName);
            if (!chat) {
                return null;
            }

            const metadata = metadataCache.get(chatName);
            const children = (metadata?.branches || [])
                .filter(childName => chatMap.has(childName))
                .map(childName => buildTree(childName, depth + 1))
                .filter(Boolean);

            return {
                name: chatName,
                chat: chat,
                children: children,
                depth: depth,
            };
        }

        const tree = buildTree(rootChatName);

        if (!tree) {
            await Popup.show.text('Error', 'Failed to build branch graph.');
            return;
        }

        // Remove duplicate nodes from the tree
        function removeDuplicates(node, seen = new Set()) {
            if (seen.has(node.name)) {
                return null;
            }
            seen.add(node.name);

            // Recursively process children
            node.children = node.children
                .map(child => removeDuplicates(child, new Set(seen)))
                .filter(Boolean);

            return node;
        }

        const cleanTree = removeDuplicates(tree);

        // Calculate layout positions for each node
        function calculateLayout(node, depth = 0, leftOffset = 0) {
            // Calculate width needed for this subtree
            function getSubtreeWidth(n) {
                if (n.children.length === 0) return 1;
                return n.children.reduce((sum, child) => sum + getSubtreeWidth(child), 0);
            }

            const subtreeWidth = getSubtreeWidth(node);

            // Position this node
            node.layout = {
                depth: depth,
                leftOffset: leftOffset,
                width: subtreeWidth,
                x: leftOffset + (subtreeWidth - 1) / 2, // Center position
            };

            // Position children
            let childOffset = leftOffset;
            for (const child of node.children) {
                calculateLayout(child, depth + 1, childOffset);
                childOffset += getSubtreeWidth(child);
            }

            return node;
        }

        calculateLayout(cleanTree);

        // Organize nodes by depth level with proper positioning
        function organizeByLevelsWithLayout(node, levels = []) {
            if (!levels[node.layout.depth]) {
                levels[node.layout.depth] = [];
            }
            levels[node.layout.depth].push(node);

            for (const child of node.children) {
                organizeByLevelsWithLayout(child, levels);
            }

            return levels;
        }

        const levels = organizeByLevelsWithLayout(cleanTree);

        // Render the tree as HTML with proper alignment and connections
        function renderGraph(levels) {
            const nodeWidth = 280;
            const nodeHeight = 120;
            const horizontalGap = 20;
            const verticalGap = 60;

            // Calculate total width needed
            const maxWidth = Math.max(...levels.map(level =>
                Math.max(...level.map(node => node.layout.x)),
            )) + 1;

            const totalWidth = maxWidth * (nodeWidth + horizontalGap);
            const totalHeight = levels.length * (nodeHeight + verticalGap);

            // Create a single container with relative positioning
            let html = `<div style="position: relative; width: ${totalWidth}px; height: ${totalHeight}px;">`;

            // Draw SVG with connection lines (relative positioned, not absolute)
            html += `<svg width="${totalWidth}" height="${totalHeight}" style="position: absolute; top: 0; left: 0; pointer-events: none;">`;

            // Draw connection lines
            for (const level of levels) {
                for (const node of level) {
                    const parentX = node.layout.x * (nodeWidth + horizontalGap) + nodeWidth / 2;
                    const parentY = node.layout.depth * (nodeHeight + verticalGap) + nodeHeight;

                    for (const child of node.children) {
                        const childX = child.layout.x * (nodeWidth + horizontalGap) + nodeWidth / 2;
                        const childY = child.layout.depth * (nodeHeight + verticalGap);

                        // Draw line from parent to child
                        html += `<line x1="${parentX}" y1="${parentY}" x2="${childX}" y2="${childY}"
                                 stroke="var(--SmartThemeBorderColor)" stroke-width="2"/>`;
                    }
                }
            }

            html += '</svg>';

            // Render nodes as HTML elements positioned absolutely within the same container
            for (const level of levels) {
                for (const node of level) {
                    const isCurrentChat = node.name === currentChatName;
                    const momentDate = timestampToMoment(node.chat.last_mes);
                    const formattedDate = momentDate.isValid() ? momentDate.format('lll') : 'Unknown date';
                    const messageCount = node.chat.message_count || 0;
                    const preview = node.chat.preview_message || '(No messages)';

                    const x = node.layout.x * (nodeWidth + horizontalGap);
                    const y = node.layout.depth * (nodeHeight + verticalGap);

                    html += `
                        <div class="branch-graph-node ${isCurrentChat ? 'current-chat' : ''}"
                             data-file-name="${node.name}"
                             style="position: absolute; left: ${x}px; top: ${y}px; width: ${nodeWidth}px;">
                            <div class="branch-graph-node-name">
                                <i class="fa-solid fa-${isCurrentChat ? 'circle-dot' : 'circle'}"></i>
                                ${node.name}
                            </div>
                            <div class="branch-graph-node-info">
                                ${messageCount} messages • ${formattedDate}
                            </div>
                            <div class="branch-graph-node-preview">${preview}</div>
                        </div>
                    `;
                }
            }

            html += '</div>';

            return html;
        }

        const graphHTML = `<div class="branch-graph-container">${renderGraph(levels)}</div>`;

        // Show the popup with large size
        const popup = new Popup(graphHTML, POPUP_TYPE.TEXT, '', {
            okButton: false,
            cancelButton: 'Close',
            wide: true,
            large: true,
            onClose: () => {
                // Clean up event handler when popup closes
                $(document).off('click', '.branch-graph-node', handleNodeClick);
            },
        });

        // Add click handlers to the nodes
        const handleNodeClick = async function () {
            const fileName = $(this).attr('data-file-name');
            if (!fileName || fileName === currentChatName) return;

            // Close the popup FIRST
            popup.completeAffirmative();

            // Remove the event handler
            $(document).off('click', '.branch-graph-node', handleNodeClick);

            try {
                showLoader();
                // Save current chat before switching
                await saveChatConditional();

                if (selected_group) {
                    await openGroupChat(selected_group, fileName);
                } else {
                    await openCharacterChat(fileName);
                }
            } finally {
                await hideLoader();
            }
        };

        $(document).on('click', '.branch-graph-node', handleNodeClick);

        // Show and wait for popup to complete
        await popup.show();
    } catch (error) {
        console.error('[BranchGraph] Error showing branch graph:', error);
        await Popup.show.text('Error', 'Failed to load branch graph. Please try again.');
    } finally {
        await hideLoader();
    }
}

export function initBookmarks() {
    $('#option_new_bookmark').on('click', saveBookmarkMenu);
    $('#option_back_to_main').on('click', backToMainChat);
    $('#option_convert_to_group').on('click', convertSoloToGroupChat);
    $('#option_branch_graph').on('click', showBranchGraph);

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
            : $(this).attr('file_name');

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

    $(document).on('click', '.mes_branches', async function () {
        const mesId = $(this).closest('.mes').attr('mesid');
        if (mesId !== undefined) {
            await showBranchList(Number(mesId));
        }
    });

    registerBookmarksSlashCommands();
}
