import {
    characters,
    saveChat,
    sendSystemMessage,
    token,
    system_messages,
    system_message_types,
    this_chid,
    openCharacterChat,
    chat_metadata,
    callPopup,
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

async function getBookmarkName() {
    const chatNames = await getExistingChatNames();
    const popupText = `<h3>Enter the bookmark name:<h3>
    <small>Using existing name will overwrite your bookmark chat.
    <br>Leave empty to auto-generate.</small>`;
    let name = await callPopup(popupText, 'input');

    if (name === false) {
        return null;
    }
    else if (name === '') {
        for (let i = 0; i < 1000; i++) {
            name = bookmarkNameToken + i;
            if (!chatNames.includes(name)) {
                break;
            }
        }
    }

    return name;
}

function getMainChatName() {
    if (chat_metadata) {
        if (chat_metadata['main_chat']) {
            return chat_metadata['main_chat'];
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
        // In groups or without an active chat
        if (selected_group || !characters[this_chid].chat) {
            $("#option_back_to_main").hide();
            $("#option_new_bookmark").hide();
        }
        // In main chat
        else if (!chat_metadata['main_chat']) {
            $("#option_back_to_main").hide();
            $("#option_new_bookmark").show();

        }
        // In bookmark chat
        else {
            $("#option_back_to_main").show();
            $("#option_new_bookmark").show();
        }
    }
    catch {
        $("#option_back_to_main").hide();
        $("#option_new_bookmark").hide();
    }
}

$(document).ready(function () {
    $('#option_new_bookmark').on('click', async function () {
        if (selected_group) {
            alert('Chat bookmarks unsupported for groups');
            throw new Error();
        }

        let name = await getBookmarkName(characters[this_chid].chat);

        if (!name) {
            return;
        }

        const newMetadata = { main_chat: characters[this_chid].chat };
        saveChat(name, newMetadata);
        let mainMessage = stringFormat(system_messages[system_message_types.BOOKMARK_CREATED].mes, name, name);
        sendSystemMessage(system_message_types.BOOKMARK_CREATED, mainMessage);
        saveChat();
    });

    $('#option_back_to_main').on('click', async function () {
        const mainChatName = getMainChatName(characters[this_chid].chat);
        const allChats = await getExistingChatNames();

        if (allChats.includes(mainChatName)) {
            openCharacterChat(mainChatName);
        }
    });
});
