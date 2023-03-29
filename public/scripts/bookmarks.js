import {
    characters,
    saveChat,
    sendSystemMessage,
    token,
    system_messages,
    system_message_types,
    this_chid,
    openCharacterChat,
} from "../script.js";
import { selected_group } from "./group-chats.js";

import {
    stringFormat,
} from "./utils.js";

export {
    showBookmarksButtons,
}

const bookmarkNameToken = 'Bookmark #';

async function getExistingChatNames() {
    const response = await fetch("/getallchatsofcharacter", {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            "X-CSRF-Token": token,
        },
        body: JSON.stringify({ avatar_url: characters[this_chid].avatar })
    });

    if (response.ok) {
        const data = await response.json();
        return Object.values(data).map(x => x.file_name.replace('.jsonl', ''));
    }
}

async function getBookmarkName(currentChat) {
    const chatNames = await getExistingChatNames();
    let mainChat = getMainChatName(currentChat);
    let newChat = Date.now();
    let friendlyName = '';

    for (let i = 0; i < 1000; i++) {
        friendlyName = `${bookmarkNameToken}${i}`;
        newChat = `${mainChat} ${friendlyName}`;
        if (!chatNames.includes(newChat)) {
            break;
        }
    }
    return { newChat, friendlyName };
}

function getMainChatName(currentChat) {
    if (currentChat.includes(bookmarkNameToken)) {
        currentChat = currentChat.substring(0, currentChat.lastIndexOf(bookmarkNameToken)).trim();
    }
    return currentChat;
}

function showBookmarksButtons() {
    // In groups or without an active chat
    if (selected_group || !characters[this_chid].chat) {
        $("#option_back_to_main").hide();
        $("#option_new_bookmark").hide();
    }
    // In main chat
    else if (!characters[this_chid].chat.includes(bookmarkNameToken)) {
        $("#option_back_to_main").hide();
        $("#option_new_bookmark").show();

    }
    // In bookmark chat
    else {
        $("#option_back_to_main").show();
        $("#option_new_bookmark").show();
    }
}

$(document).ready(function () {
    $('#option_new_bookmark').on('click', async function () {
        if (selected_group) {
            alert('Chat bookmarks unsupported for groups');
            throw new Error();
        }

        let { newChat, friendlyName } = await getBookmarkName(characters[this_chid].chat);

        saveChat(newChat);
        let mainMessage = stringFormat(system_messages[system_message_types.BOOKMARK_CREATED].mes, newChat, friendlyName);
        sendSystemMessage(system_message_types.BOOKMARK_CREATED, mainMessage);
        saveChat();
    });

    $('#option_back_to_main').on('click', async function() {
        const mainChatName = getMainChatName(characters[this_chid].chat);
        const allChats = await getExistingChatNames();

        if (allChats.includes(mainChatName)) {
            openCharacterChat(mainChatName);
        }
    });
});
