import {
    characters,
    saveChat,
    system_messages,
    system_message_types,
    this_chid,
    openCharacterChat,
    chat_metadata,
    callPopup,
    getRequestHeaders,
    getThumbnailUrl,
    getCharacters,
    chat,
    saveChatConditional,
    saveItemizedPrompts,
} from '../script.js';
import { humanizedDateTime, getMessageTimeStamp } from './RossAscends-mods.js';
import {
    getGroupPastChats,
    group_activation_strategy,
    groups,
    openGroupById,
    openGroupChat,
    saveGroupBookmarkChat,
    selected_group,
} from './group-chats.js';
import { hideLoader, showLoader } from './loader.js';
import { Popup } from './popup.js';
import { createTagMapFromList } from './tags.js';

import {
    delay,
    getUniqueName,
} from './utils.js';

export {
    createNewBookmark,
    showBookmarksButtons,
};

const bookmarkNameToken = 'Checkpoint #';

async function getExistingChatNames() {
    if (selected_group) {
        const data = await getGroupPastChats(selected_group);
        return data.map(x => x.file_name);
    } else {
        const response = await fetch('/api/characters/chats', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ avatar_url: characters[this_chid].avatar }),
        });

        if (response.ok) {
            const data = await response.json();
            return Object.values(data).map(x => x.file_name.replace('.jsonl', ''));
        }
    }
}

async function getBookmarkName() {
    const chatNames = await getExistingChatNames();

    let name = await Popup.show.input('Create Checkpoint', '<span class="margin-right-10px">Enter Checkpoint Name:</span><small>(Leave empty to auto-generate)</small>');
    if (name === null) {
        return null;
    }
    else if (name === '') {
        for (let i = chatNames.length; i < 1000; i++) {
            name = bookmarkNameToken + i;
            if (!chatNames.includes(name)) {
                break;
            }
        }
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

function showBookmarksButtons() {
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

    return createNewBookmark(chat.length - 1);
}

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
        await saveChat(name, newMetadata, mesId);
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

async function createNewBookmark(mesId) {
    if (this_chid === undefined && !selected_group) {
        toastr.info('No character selected.', 'Checkpoint creation aborted');
        return;
    }

    if (!chat.length) {
        toastr.warning('The chat is empty.', 'Checkpoint creation failed');
        return;
    }

    if (mesId < 0 || mesId >= chat.length) {
        toastr.warning('Invalid message ID.', 'Checkpoint creation failed');
        return;
    }

    const lastMes = chat[mesId];

    if (typeof lastMes.extra !== 'object') {
        lastMes.extra = {};
    }

    if (lastMes.extra.bookmark_link) {
        const confirm = await Popup.show.confirm('Replace Checkpoint', 'Checkpoint for the last message already exists.<br />Would you like to replace it?');
        if (!confirm) {
            return;
        }
    }

    let name = await getBookmarkName();
    if (!name) {
        return;
    }

    const mainChat = selected_group ? groups?.find(x => x.id == selected_group)?.chat_id : characters[this_chid].chat;
    const newMetadata = { main_chat: mainChat };
    await saveItemizedPrompts(name);

    if (selected_group) {
        await saveGroupBookmarkChat(selected_group, name, newMetadata, mesId);
    } else {
        await saveChat(name, newMetadata, mesId);
    }

    lastMes.extra['bookmark_link'] = name;

    const mes = $(`.mes[mesid="${mesId}"]`);
    updateBookmarkDisplay(mes, name);

    await saveChatConditional();
    toastr.success('Click the flag icon next to the message to open the checkpoint chat.', 'Checkpoint created', { timeOut: 10000 });
}


/**
 * Updates the display of the bookmark on a chat message.
 * @param {JQuery<HTMLElement>} mes - The message element
 * @param {string?} [newBookmarkLink=null] - The new bookmark link (optional)
 */
export function updateBookmarkDisplay(mes, newBookmarkLink = null) {
    newBookmarkLink && mes.attr('bookmark_link', newBookmarkLink);
    mes.find('.mes_bookmark').attr('title', `Checkpoint\n${mes.attr('bookmark_link')}\n\n${mes.find('.mes_bookmark').data('tooltip')}`);
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
    }
}

async function convertSoloToGroupChat() {
    if (selected_group) {
        console.log('Already in group. No need for conversion');
        return;
    }

    if (this_chid === undefined) {
        console.log('Need to have a character selected');
        return;
    }

    const confirm = await Popup.show.confirm('Convert to group chat', 'Are you sure you want to convert this chat to a group chat?<br />This cannot be reverted.');
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

    // Add something if the chat is empty
    if (groupChat.length === 0) {
        const newMessage = {
            ...system_messages[system_message_types.GROUP],
            send_date: getMessageTimeStamp(),
            extra: { type: system_message_types.GROUP },
        };
        groupChat.push(newMessage);
    }

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

    toastr.success('The chat has been successfully converted!');
}

/**
 * Creates a new branch from the message with the given ID
 * @param {number} mesId Message ID
 * @returns {Promise<string>} Branch file name
 */
async function branchChat(mesId) {
    if (this_chid === undefined && !selected_group) {
        toastr.info('No character selected.', 'Branch creation aborted');
        return;
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

jQuery(function () {
    $('#option_new_bookmark').on('click', saveBookmarkMenu);
    $('#option_back_to_main').on('click', backToMainChat);
    $('#option_convert_to_group').on('click', convertSoloToGroupChat);

    $(document).on('click', '.select_chat_block, .bookmark_link, .mes_bookmark', async function (e) {
        // If shift is held down, we are not following the bookmark, but creating a new one
        if (e.shiftKey) {
            var selectedMesId = $(this).closest('.mes').attr('mesid');
            createNewBookmark(selectedMesId);
            return;
        }

        let file_name = $(this).hasClass('mes_bookmark')
            ? $(this).closest('.mes').attr('bookmark_link')
            : $(this).attr('file_name').replace('.jsonl', '');

        if (!file_name) {
            return;
        }

        try {
            showLoader();
            if (selected_group) {
                await openGroupChat(selected_group, file_name);
            } else {
                await openCharacterChat(file_name);
            }
        } finally {
            hideLoader();
        }

        $('#shadow_select_chat_popup').css('display', 'none');
        $('#load_select_chat_div').css('display', 'block');
    });

    $(document).on('click', '.mes_create_bookmark', async function () {
        var selected_mes_id = $(this).closest('.mes').attr('mesid');
        if (selected_mes_id !== undefined) {
            createNewBookmark(selected_mes_id);
        }
    });

    $(document).on('click', '.mes_create_branch', async function () {
        var selected_mes_id = $(this).closest('.mes').attr('mesid');
        if (selected_mes_id !== undefined) {
            branchChat(Number(selected_mes_id));
        }
    });
});
