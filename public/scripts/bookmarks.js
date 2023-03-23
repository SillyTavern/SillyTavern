import {
    characters,
    saveChat,
    sendSystemMessage,
    deleteLastMessage,
    token,
    system_messages,
    system_message_types,
    this_chid,
} from "../script.js";
import { selected_group } from "./group-chats.js";

import {
    stringFormat,
} from "./utils.js";

async function getExistingChatNames() {
    const response = await fetch("/getallchatsofcharacter", { 
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
            "X-CSRF-Token": token,
        },
        body: JSON.stringify({ avatar_url: characters[this_chid].avatar})
    });

    if (response.ok) {
        const data = await response.json();
        return Object.values(data).map(x => x.file_name.replace('.jsonl', ''));
    }
}

async function getBookmarkName(currentChat) {
    const nameToken = 'Bookmark #';
    if (currentChat.includes(nameToken)) {
        currentChat = currentChat.substring(0, currentChat.lastIndexOf(nameToken)).trim();
    }

    const chatNames = await getExistingChatNames();
    let newChat = Date.now();
    let friendlyName = '';

    for (let i = 0; i < 1000; i++) {
        friendlyName = `${nameToken}${i}`;
        newChat = `${currentChat} ${friendlyName}`;
        if (!chatNames.includes(newChat)) {
            break;
        }
    }
    return { newChat, friendlyName };
}

$(document).ready(function () {
    $('#option_new_bookmark').on('click', async function () {
        if (selected_group) {
            alert('Unsupported for groups');
            throw new Error('not yet implemented');
        }

        let { newChat, friendlyName } = await getBookmarkName(characters[this_chid].chat);

        saveChat(newChat);
        let mainMessage = stringFormat(system_messages[system_message_types.BOOKMARK_CREATED].mes, newChat, friendlyName);
        sendSystemMessage(system_message_types.BOOKMARK_CREATED, mainMessage);
        saveChat();
    });
});

