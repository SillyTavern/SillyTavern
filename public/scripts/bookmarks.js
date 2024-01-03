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
} from '../script.js';
import { humanizedDateTime } from './RossAscends-mods.js';
import {
    getGroupPastChats,
    group_activation_strategy,
    groups,
    openGroupById,
    openGroupChat,
    saveGroupBookmarkChat,
    selected_group,
} from './group-chats.js';
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
    const popupText = `<h3>Enter the checkpoint name:<h3>
    <small>Leave empty to auto-generate.</small>`;
    let name = await callPopup(popupText, 'input');

    if (name === false) {
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
        const confirm = await callPopup('Checkpoint for the last message already exists. Would you like to replace it?', 'confirm');

        if (!confirm) {
            return;
        }
    }

    await delay(250);
    let name = await getBookmarkName();

    if (!name) {
        return;
    }

    const mainChat = selected_group ? groups?.find(x => x.id == selected_group)?.chat_id : characters[this_chid].chat;
    const newMetadata = { main_chat: mainChat };

    if (selected_group) {
        await saveGroupBookmarkChat(selected_group, name, newMetadata, mesId);
    } else {
        await saveChat(name, newMetadata, mesId);
    }

    lastMes.extra['bookmark_link'] = name;
    $(`.mes[mesid="${mesId}"]`).attr('bookmark_link', name);

    await saveChatConditional();
    toastr.success('Click the flag icon in the last message to open the checkpoint chat.', 'Checkpoint created', { timeOut: 10000 });
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

    const confirm = await callPopup('Are you sure you want to convert this chat to a group chat?', 'confirm');

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
            send_date: humanizedDateTime(),
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
        return;
    }

    // Click on the freshly selected group to open it
    await openGroupById(group.id);

    toastr.success('The chat has been successfully converted!');
}

jQuery(function () {
    $('#option_new_bookmark').on('click', saveBookmarkMenu);
    $('#option_back_to_main').on('click', backToMainChat);
    $('#option_convert_to_group').on('click', convertSoloToGroupChat);
});
