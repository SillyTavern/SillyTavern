import {
    shuffle,
    onlyUnique,
    debounce,
    delay,
} from './utils.js';
import { humanizedDateTime } from "./RossAscends-mods.js";
import { sortCharactersList } from './power-user.js';

import {
    chat,
    sendSystemMessage,
    printMessages,
    substituteParams,
    characters,
    default_avatar,
    token,
    addOneMessage,
    callPopup,
    clearChat,
    Generate,
    select_rm_info,
    setCharacterId,
    setCharacterName,
    setEditedMessageId,
    is_send_press,
    name1,
    resetChatState,
    setSendButtonState,
    getCharacters,
    system_message_types,
    online_status,
    talkativeness_default,
    selectRightMenuWithAnimation,
    setRightTabSelectedClass,
    default_ch_mes,
    deleteLastMessage,
    showSwipeButtons,
    hideSwipeButtons,
    chat_metadata,
    updateChatMetadata,
    isStreamingEnabled,
    getThumbnailUrl,
    streamingProcessor,
} from "../script.js";

export {
    selected_group,
    is_group_automode_enabled,
    is_group_generating,
    group_generation_id,
    groups,
    saveGroupChat,
    generateGroupWrapper,
    deleteGroup,
    getGroupAvatar,
    getGroups,
    printGroups,
    regenerateGroup,
    resetSelectedGroup,
    select_group_chats,
}

let is_group_generating = false; // Group generation flag
let is_group_automode_enabled = false;
let groups = [];
let selected_group = null;
let group_generation_id = null;

const group_activation_strategy = {
    NATURAL: 0,
    LIST: 1,
};

const groupAutoModeInterval = setInterval(groupChatAutoModeWorker, 5000);
const saveGroupDebounced = debounce(async (group) => await _save(group), 500);

async function _save(group) {
    await fetch("/editgroup", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": token,
        },
        body: JSON.stringify(group),
    });
    await getCharacters();
}


// Group chats
async function regenerateGroup() {
    let generationId = getLastMessageGenerationId();

    while (chat.length > 0) {
        const lastMes = chat[chat.length - 1];
        const this_generationId = lastMes.extra?.gen_id;

        // for new generations after the update
        if ((generationId && this_generationId) && generationId !== this_generationId) {
            break;
        }
        // legacy for generations before the update
        else if (lastMes.is_user || lastMes.is_system) {
            break;
        }

        deleteLastMessage();
    }

    generateGroupWrapper();
}

async function getGroupChat(id) {
    const response = await fetch("/getgroupchat", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": token,
        },
        body: JSON.stringify({ id: id }),
    });

    if (response.ok) {
        const data = await response.json();
        const group = groups.find((x) => x.id === id);
        if (Array.isArray(data) && data.length) {
            data[0].is_group = true;
            for (let key of data) {
                chat.push(key);
            }
            printMessages();
        } else {
            sendSystemMessage(system_message_types.GROUP);
            if (group && Array.isArray(group.members)) {
                for (let name of group.members) {
                    const character = characters.find((x) => x.name === name);

                    if (!character) {
                        continue;
                    }

                    const mes = getFirstCharacterMessage(character);
                    chat.push(mes);
                    addOneMessage(mes);
                }
            }
        }

        if (group) {
            let metadata = group.chat_metadata ?? {};
            updateChatMetadata(metadata, true);
        }

        await saveGroupChat(id, true);
    }
}

function getFirstCharacterMessage(character) {
    const mes = {};
    mes["is_user"] = false;
    mes["is_system"] = false;
    mes["name"] = character.name;
    mes["is_name"] = true;
    mes["send_date"] = humanizedDateTime();
    mes["mes"] = character.first_mes
        ? substituteParams(character.first_mes.trim(), name1, character.name)
        : default_ch_mes;
    mes["force_avatar"] =
        character.avatar != "none"
            ? getThumbnailUrl('avatar', character.avatar)
            : default_avatar;
    return mes;
}

function resetSelectedGroup() {
    selected_group = null;
    is_group_generating = false;
}

async function saveGroupChat(id, shouldSaveGroup) {
    const response = await fetch("/savegroupchat", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": token,
        },
        body: JSON.stringify({ id: id, chat: [...chat] }),
    });

    if (shouldSaveGroup && response.ok) {
        await editGroup(id);
    }
}

async function getGroups() {
    const response = await fetch("/getgroups", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": token,
        },
    });

    if (response.ok) {
        const data = await response.json();
        groups = data.sort((a, b) => a.id - b.id);
    }
}


function printGroups() {
    for (let group of groups) {
        const template = $("#group_list_template .group_select").clone();
        template.data("id", group.id);
        template.attr("grid", group.id);
        template.find(".ch_name").html(group.name);
        template.find('.group_fav_icon').css("display", 'none');
        template.find('.group_fav_icon').addClass(group.fav ? 'is_fav' : '');
        //group.fav ? template.find(".group_fav_icon").show() : template.find(".group_fav_icon").hide();
        template.find(".ch_fav").val(group.fav);
        $("#rm_print_characters_block").prepend(template);
        updateGroupAvatar(group);
    }
}
function updateGroupAvatar(group) {
    $("#rm_print_characters_block .group_select").each(function () {
        if ($(this).data("id") == group.id) {
            const avatar = getGroupAvatar(group);
            if (avatar) {
                $(this).find(".avatar").replaceWith(avatar);
            }
        }
    });
}

function getGroupAvatar(group) {
    const memberAvatars = [];
    if (group && Array.isArray(group.members) && group.members.length) {
        for (const member of group.members) {
            const charIndex = characters.findIndex((x) => x.name === member);
            if (charIndex !== -1 && characters[charIndex].avatar !== "none") {
                const avatar = getThumbnailUrl('avatar', characters[charIndex].avatar);
                memberAvatars.push(avatar);
            }
            if (memberAvatars.length === 4) {
                break;
            }
        }
    }

    // Cohee: there's probably a smarter way to do this..
    if (memberAvatars.length === 1) {
        const groupAvatar = $("#group_avatars_template .collage_1").clone();
        groupAvatar.find(".img_1").attr("src", memberAvatars[0]);
        return groupAvatar;
    }

    if (memberAvatars.length === 2) {
        const groupAvatar = $("#group_avatars_template .collage_2").clone();
        groupAvatar.find(".img_1").attr("src", memberAvatars[0]);
        groupAvatar.find(".img_2").attr("src", memberAvatars[1]);
        return groupAvatar;
    }

    if (memberAvatars.length === 3) {
        const groupAvatar = $("#group_avatars_template .collage_3").clone();
        groupAvatar.find(".img_1").attr("src", memberAvatars[0]);
        groupAvatar.find(".img_2").attr("src", memberAvatars[1]);
        groupAvatar.find(".img_3").attr("src", memberAvatars[2]);
        return groupAvatar;
    }

    if (memberAvatars.length === 4) {
        const groupAvatar = $("#group_avatars_template .collage_4").clone();
        groupAvatar.find(".img_1").attr("src", memberAvatars[0]);
        groupAvatar.find(".img_2").attr("src", memberAvatars[1]);
        groupAvatar.find(".img_3").attr("src", memberAvatars[2]);
        groupAvatar.find(".img_4").attr("src", memberAvatars[3]);
        return groupAvatar;
    }

    // default avatar
    const groupAvatar = $("#group_avatars_template .collage_1").clone();
    groupAvatar.find(".img_1").attr("src", group.avatar_url);
    return groupAvatar;
}


async function generateGroupWrapper(by_auto_mode, type = null) {
    if (online_status === "no_connection") {
        is_group_generating = false;
        setSendButtonState(false);
        return;
    }

    if (is_group_generating) {
        return false;
    }

    const group = groups.find((x) => x.id === selected_group);

    if (!group || !Array.isArray(group.members) || !group.members.length) {
        sendSystemMessage(system_message_types.EMPTY);
        return;
    }

    try {
        hideSwipeButtons();
        is_group_generating = true;
        setCharacterName('');
        setCharacterId(undefined);
        const userInput = $("#send_textarea").val();

        let typingIndicator = $("#chat .typing_indicator");

        if (typingIndicator.length === 0 && !isStreamingEnabled()) {
            typingIndicator = $(
                "#typing_indicator_template .typing_indicator"
            ).clone();
            typingIndicator.hide();
            $("#chat").append(typingIndicator);
        }

        // id of this specific batch for regeneration purposes
        group_generation_id = Date.now();
        const lastMessage = chat[chat.length - 1];
        let messagesBefore = chat.length;
        let lastMessageText = lastMessage.mes;
        let activationText = "";
        let isUserInput = false;

        if (userInput && userInput.length && !by_auto_mode) {
            isUserInput = true;
            activationText = userInput;
            messagesBefore++;
        } else {
            if (lastMessage && !lastMessage.is_system) {
                activationText = lastMessage.mes;
            }
        }

        const activationStrategy = Number(group.activation_strategy ?? group_activation_strategy.NATURAL);
        let activatedMembers = [];

        if (type === "swipe") {
            activatedMembers = activateSwipe(group.members);

            if (activatedMembers.length === 0) {
                callPopup('<h3>Deleted group member swiped. To get a reply, add them back to the group.</h3>', 'text');
                throw new Error('Deleted group member swiped');
            }
        }
        else if (type === "impersonate") {
            $("#send_textarea").attr("disabled", true);
            activatedMembers = activateImpersonate(group.members);
        }
        else if (activationStrategy === group_activation_strategy.NATURAL) {
            activatedMembers = activateNaturalOrder(group.members, activationText, lastMessage, group.allow_self_responses, isUserInput);
        }
        else if (activationStrategy === group_activation_strategy.LIST) {
            activatedMembers = activateListOrder(group.members);
        }

        // now the real generation begins: cycle through every character
        for (const chId of activatedMembers) {
            const generateType = type == "swipe" || type == "impersonate" ? type : "group_chat";
            setCharacterId(chId);
            setCharacterName(characters[chId].name)

            await Generate(generateType, by_auto_mode);

            if (type !== "swipe" && type !== "impersonate") {
                // update indicator and scroll down
                typingIndicator
                    .find(".typing_indicator_name")
                    .text(characters[chId].name);
                $("#chat").append(typingIndicator);
                typingIndicator.show(250, function () {
                    typingIndicator.get(0).scrollIntoView({ behavior: "smooth" });
                });
            }

            while (true) {
                // if not swipe - check if message generated already
                if (type !== "swipe" && chat.length == messagesBefore) {
                    await delay(100);
                }
                // if swipe - see if message changed
                else if (type === "swipe") {
                    if (isStreamingEnabled()) {
                        if (streamingProcessor && !streamingProcessor.isFinished) {
                            await delay(100);
                        }
                        else {
                            break;
                        }
                    }
                    else {
                        if (lastMessageText === chat[chat.length - 1].mes) {
                            await delay(100);
                        }
                        else {
                            break;
                        }
                    }
                }
                else if (type === "impersonate") {
                    if (isStreamingEnabled()) {
                        if (streamingProcessor && !streamingProcessor.isFinished) {
                            await delay(100);
                        }
                        else {
                            break;
                        }
                    }
                    else {
                        if (!$("#send_textarea").val() || $("#send_textarea").val() == userInput) {
                            await delay(100);
                        }
                        else {
                            break;
                        }
                    }
                }
                else {
                    messagesBefore++;
                    break;
                }
            }

            // hide and reapply the indicator to the bottom of the list
            typingIndicator.hide(250);
            $("#chat").append(typingIndicator);
        }
    } finally {
        is_group_generating = false;
        $("#send_textarea").attr("disabled", false);
        setSendButtonState(false);
        setCharacterId(undefined);
        setCharacterName('');
        showSwipeButtons();
    }
}

function getLastMessageGenerationId() {
    let generationId = null;
    if (chat.length > 0) {
        const lastMes = chat[chat.length - 1];
        if (!lastMes.is_user && !lastMes.is_system && lastMes.extra) {
            generationId = lastMes.extra.gen_id;
        }
    }
    return generationId;
}

function activateImpersonate(members) {
    const randomIndex = Math.floor(Math.random() * members.length);
    const activatedNames = [members[randomIndex]];
    const memberIds = activatedNames
        .map((x) => characters.findIndex((y) => y.name === x))
        .filter((x) => x !== -1);
    return memberIds;
}

function activateSwipe(members) {
    const name = chat[chat.length - 1].name;
    const activatedNames = members.includes(name) ? [name] : [];
    const memberIds = activatedNames
        .map((x) => characters.findIndex((y) => y.name === x))
        .filter((x) => x !== -1);
    return memberIds;
}

function activateListOrder(members) {
    let activatedNames = members.filter(onlyUnique);

    // map to character ids
    const memberIds = activatedNames
        .map((x) => characters.findIndex((y) => y.name === x))
        .filter((x) => x !== -1);
    return memberIds;
}

function activateNaturalOrder(members, input, lastMessage, allowSelfResponses, isUserInput) {
    let activatedNames = [];

    // prevents the same character from speaking twice
    let bannedUser = !isUserInput && lastMessage && !lastMessage.is_user && lastMessage.name;

    // ...unless allowed to do so
    if (allowSelfResponses) {
        bannedUser = undefined;
    }

    // find mentions (excluding self)
    if (input && input.length) {
        for (let inputWord of extractAllWords(input)) {
            for (let member of members) {
                if (member === bannedUser) {
                    continue;
                }

                if (extractAllWords(member).includes(inputWord)) {
                    activatedNames.push(member);
                    break;
                }
            }
        }
    }

    // activation by talkativeness (in shuffled order, except banned)
    const shuffledMembers = shuffle([...members]);
    for (let member of shuffledMembers) {
        if (member === bannedUser) {
            continue;
        }

        const character = characters.find((x) => x.name === member);

        if (!character) {
            continue;
        }

        const rollValue = Math.random();
        let talkativeness = Number(character.talkativeness);
        talkativeness = Number.isNaN(talkativeness)
            ? talkativeness_default
            : talkativeness;
        if (talkativeness >= rollValue) {
            activatedNames.push(member);
        }
    }

    // pick 1 at random if no one was activated
    if (activatedNames.length === 0) {
        const randomIndex = Math.floor(Math.random() * members.length);
        activatedNames.push(members[randomIndex]);
    }

    // de-duplicate array of names
    activatedNames = activatedNames.filter(onlyUnique);

    // map to character ids
    const memberIds = activatedNames
        .map((x) => characters.findIndex((y) => y.name === x))
        .filter((x) => x !== -1);
    return memberIds;
}

function extractAllWords(value) {
    const words = [];

    if (!value) {
        return words;
    }

    const matches = value.matchAll(/\b\w+\b/gim);
    for (let match of matches) {
        words.push(match[0].toLowerCase());
    }
    return words;
}


async function deleteGroup(id) {
    const response = await fetch("/deletegroup", {
        method: "POST",
        headers: {
            "Content-Type": "application/json",
            "X-CSRF-Token": token,
        },
        body: JSON.stringify({ id: id }),
    });

    if (response.ok) {
        selected_group = null;
        resetChatState();
        clearChat();
        printMessages();
        await getCharacters();

        $("#rm_info_avatar").html("");
        $("#rm_info_block").transition({ opacity: 0, duration: 0 });
        select_rm_info("Group deleted!");
        $("#rm_info_block").transition({ opacity: 1.0, duration: 2000 });

        $("#rm_button_selected_ch").children("h2").text('');
        setRightTabSelectedClass();
    }
}

async function editGroup(id, immediately) {
    let group = groups.find((x) => x.id == id);
    group = { ...group, chat_metadata };

    if (!group) {
        return;
    }

    if (immediately) {
        return await _save(group);
    }

    saveGroupDebounced(group);
}

async function groupChatAutoModeWorker() {
    if (!is_group_automode_enabled || online_status === "no_connection") {
        return;
    }

    if (!selected_group || is_send_press || is_group_generating) {
        return;
    }

    const group = groups.find((x) => x.id === selected_group);

    if (!group || !Array.isArray(group.members) || !group.members.length) {
        return;
    }

    await generateGroupWrapper(true);
}

async function modifyGroupMember(chat_id, groupMember, isDelete) {
    const id = groupMember.data("id");

    const template = groupMember.clone();
    let _thisGroup = groups.find((x) => x.id == chat_id);
    template.data("id", id);

    if (isDelete) {
        $("#rm_group_add_members").prepend(template);
    } else {
        $("#rm_group_members").prepend(template);
    }

    if (_thisGroup) {
        if (isDelete) {
            const index = _thisGroup.members.findIndex((x) => x === id);
            if (index !== -1) {
                _thisGroup.members.splice(index, 1);
            }
        } else {
            _thisGroup.members.push(id);
            template.css({ 'order': _thisGroup.members.length });
        }
        await editGroup(selected_group);
        updateGroupAvatar(_thisGroup);
    }
    else {
        template.css({ 'order': 'unset' });
    }

    groupMember.remove();
    const groupHasMembers = !!$("#rm_group_members").children().length;
    $("#rm_group_submit").prop("disabled", !groupHasMembers);
}

async function reorderGroupMember(chat_id, groupMember, direction) {
    const id = groupMember.data("id");
    const group = groups.find((x) => x.id == chat_id);

    // Existing groups need to modify members list
    if (group && group.members.length > 1) {
        const indexOf = group.members.indexOf(id);
        if (direction == 'down') {
            const next = group.members[indexOf + 1];
            if (next) {
                group.members[indexOf + 1] = group.members[indexOf];
                group.members[indexOf] = next;
            }
        }
        if (direction == 'up') {
            const prev = group.members[indexOf - 1];
            if (prev) {
                group.members[indexOf - 1] = group.members[indexOf];
                group.members[indexOf] = prev;
            }
        }

        await editGroup(chat_id);
        updateGroupAvatar(group);
        // stupid but lifts the manual reordering
        select_group_chats(chat_id, true);
    }
    // New groups just can't be DOM-ordered
    else {
        if (direction == 'down') {
            groupMember.insertAfter(groupMember.next());
        }
        if (direction == 'up') {
            groupMember.insertBefore(groupMember.prev());
        }
    }
}

function select_group_chats(chat_id, skipAnimation) {
    const group = chat_id && groups.find((x) => x.id == chat_id);
    const groupName = group?.name ?? "";
    $("#rm_group_chat_name").val(groupName);
    $("#rm_group_chat_name").off();
    $("#rm_group_chat_name").on("input", async function () {
        if (chat_id) {
            let _thisGroup = groups.find((x) => x.id == chat_id);
            _thisGroup.name = $(this).val();
            $("#rm_button_selected_ch").children("h2").text(_thisGroup.name);
            await editGroup(chat_id);
        }
    });
    $("#rm_group_filter").val("").trigger("input");

    $('input[name="rm_group_activation_strategy"]').off();
    $('input[name="rm_group_activation_strategy"]').on("input", async function (e) {
        if (chat_id) {
            let _thisGroup = groups.find((x) => x.id == chat_id);
            _thisGroup.activation_strategy = Number(e.target.value);
            await editGroup(chat_id);
        }
    });
    $(`input[name="rm_group_activation_strategy"][value="${Number(group?.activation_strategy ?? group_activation_strategy.NATURAL)}"]`).prop('checked', true);

    if (!skipAnimation) {
        selectRightMenuWithAnimation('rm_group_chats_block');
    }

    // render characters list
    $("#rm_group_add_members").empty();
    $("#rm_group_members").empty();
    for (let character of characters) {
        const avatar =
            character.avatar != "none"
                ? getThumbnailUrl('avatar', character.avatar)
                : default_avatar;
        const template = $("#group_member_template .group_member").clone();
        template.data("id", character.name);
        template.find(".avatar img").attr("src", avatar);
        template.find(".ch_name").text(character.name);
        template.attr("chid", characters.indexOf(character));

        if (
            group &&
            Array.isArray(group.members) &&
            group.members.includes(character.name)
        ) {
            template.css({ 'order': group.members.indexOf(character.name) });
            $("#rm_group_members").append(template);
        } else {
            $("#rm_group_add_members").append(template);
        }
    }

    sortCharactersList("#rm_group_add_members .group_member");

    const groupHasMembers = !!$("#rm_group_members").children().length;
    $("#rm_group_submit").prop("disabled", !groupHasMembers);
    $("#rm_group_allow_self_responses").prop("checked", group && group.allow_self_responses);
    $("#rm_group_fav").prop("checked", group && group.fav);

    // bottom buttons
    if (chat_id) {
        $("#rm_group_submit").hide();
        $("#rm_group_delete").show();
    } else {
        $("#rm_group_submit").show();
        $("#rm_group_delete").hide();
    }

    $("#rm_group_delete").off();
    $("#rm_group_delete").on("click", function () {
        if (is_group_generating) {
            callPopup('<h3>Not so fast! Wait for the characters to stop typing before deleting the group.</h3>', 'text');
            return;
        }

        $("#dialogue_popup").data("group_id", chat_id);
        callPopup("<h3>Delete the group?</h3>", "del_group");
    });

    $("#rm_group_fav").off();
    $("#rm_group_fav").on("input", async function () {
        if (group) {
            let _thisGroup = groups.find((x) => x.id == chat_id);
            const value = $(this).prop("checked");
            _thisGroup.fav = value;
            await editGroup(chat_id);
        }
    });

    $("#rm_group_allow_self_responses").off();
    $("#rm_group_allow_self_responses").on("input", async function () {
        if (group) {
            let _thisGroup = groups.find((x) => x.id == chat_id);
            const value = $(this).prop("checked");
            _thisGroup.allow_self_responses = value;
            await editGroup(chat_id);
        }
    });

    // top bar
    if (group) {
        $("#rm_group_automode_label").show();
        $("#rm_button_selected_ch").children("h2").text(groupName);
        setRightTabSelectedClass('rm_button_selected_ch');
    }
    else {
        $("#rm_group_automode_label").hide();
    }

    $(document).off("click", ".group_member .right_menu_button");
    $(document).on("click", ".group_member .right_menu_button", async function (event) {
        event.stopPropagation();
        const action = $(this).data('action');
        const member = $(this).closest('.group_member');

        if (action == 'remove') {
            await modifyGroupMember(chat_id, member, true);
        }

        if (action == 'add') {
            await modifyGroupMember(chat_id, member, false);
        }

        if (action == 'up' || action == 'down') {
            await reorderGroupMember(chat_id, member, action);
        }

        sortCharactersList("#rm_group_add_members .group_member");
    });
}

$(document).ready(() => {
    $(document).on("click", ".group_select", async function () {
        const id = $(this).data("id");

        if (!is_send_press && !is_group_generating) {
            if (selected_group !== id) {
                selected_group = id;
                setCharacterId(undefined);
                setCharacterName('');
                setEditedMessageId(undefined);
                clearChat();
                updateChatMetadata({}, true);
                chat.length = 0;
                await getGroupChat(id);
                //to avoid the filter being lit up yellow and left at true while the list of character and group reseted.
                $("#filter_by_fav").removeClass("fav_on");
                filterByFav = false;
            }

            select_group_chats(id);
        }
    });

    $("#rm_group_filter").on("input", function () {
        const searchValue = $(this).val().trim().toLowerCase();

        if (!searchValue) {
            $("#rm_group_add_members .group_member").show();
        } else {
            $("#rm_group_add_members .group_member").each(function () {
                $(this).children(".ch_name").text().toLowerCase().includes(searchValue)
                    ? $(this).show()
                    : $(this).hide();
            });
        }
    });

    $("#rm_group_submit").click(async function () {
        let name = $("#rm_group_chat_name").val();
        let allow_self_responses = !!$("#rm_group_allow_self_responses").prop("checked");
        let fav = $("#rm_group_fav").prop("checked");
        let activation_strategy = $('input[name="rm_group_activation_strategy"]:checked').val() ?? group_activation_strategy.NATURAL;
        const members = $("#rm_group_members .group_member")
            .map((_, x) => $(x).data("id"))
            .toArray();

        if (!name) {
            name = `Chat with ${members.join(", ")}`;
        }

        // placeholder
        const avatar_url = 'img/five.png';

        const createGroupResponse = await fetch("/creategroup", {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-CSRF-Token": token,
            },
            body: JSON.stringify({
                name: name,
                members: members,
                avatar_url: avatar_url,
                allow_self_responses: allow_self_responses,
                activation_strategy: activation_strategy,
                chat_metadata: {},
                fav: fav,
            }),
        });

        if (createGroupResponse.ok) {
            await getCharacters();
            $("#rm_info_avatar").html("");
            const avatar = $("#avatar_div_div").clone();
            avatar.find("img").attr("src", avatar_url);
            $("#rm_info_avatar").append(avatar);
            $("#rm_info_block").transition({ opacity: 0, duration: 0 });
            select_rm_info("Group chat created");
            $("#rm_info_block").transition({ opacity: 1.0, duration: 2000 });
        }
    });

    $("#rm_group_automode").on("input", function () {
        const value = $(this).prop("checked");
        is_group_automode_enabled = value;
    });
});