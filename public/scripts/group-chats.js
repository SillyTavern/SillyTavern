import {
    shuffle,
    onlyUnique,
    debounce,
    delay,
    isDataURL,
    createThumbnail,
    extractAllWords,
    saveBase64AsFile,
    PAGINATION_TEMPLATE,
    getBase64Async,
} from './utils.js';
import { RA_CountCharTokens, humanizedDateTime, dragElement, favsToHotswap, getMessageTimeStamp } from './RossAscends-mods.js';
import { loadMovingUIState, sortEntitiesList } from './power-user.js';

import {
    chat,
    sendSystemMessage,
    printMessages,
    substituteParams,
    characters,
    default_avatar,
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
    default_ch_mes,
    deleteLastMessage,
    showSwipeButtons,
    hideSwipeButtons,
    chat_metadata,
    updateChatMetadata,
    isStreamingEnabled,
    getThumbnailUrl,
    getRequestHeaders,
    setMenuType,
    menu_type,
    select_selected_character,
    cancelTtsPlay,
    displayPastChats,
    sendMessageAsUser,
    getBiasStrings,
    saveChatConditional,
    deactivateSendButtons,
    activateSendButtons,
    eventSource,
    event_types,
    getCurrentChatId,
    setScenarioOverride,
    getCropPopup,
    system_avatar,
    isChatSaving,
    setExternalAbortController,
    baseChatReplace,
    depth_prompt_depth_default,
    loadItemizedPrompts,
    animation_duration,
} from '../script.js';
import { appendTagToList, createTagMapFromList, getTagsList, applyTagsOnCharacterSelect, tag_map } from './tags.js';
import { FILTER_TYPES, FilterHelper } from './filters.js';

export {
    selected_group,
    is_group_automode_enabled,
    hideMutedSprites,
    is_group_generating,
    group_generation_id,
    groups,
    saveGroupChat,
    generateGroupWrapper,
    deleteGroup,
    getGroupAvatar,
    getGroups,
    regenerateGroup,
    resetSelectedGroup,
    select_group_chats,
    getGroupChatNames,
};

let is_group_generating = false; // Group generation flag
let is_group_automode_enabled = false;
let hideMutedSprites = true;
let groups = [];
let selected_group = null;
let group_generation_id = null;
let fav_grp_checked = false;
let openGroupId = null;
let newGroupMembers = [];

export const group_activation_strategy = {
    NATURAL: 0,
    LIST: 1,
};

export const group_generation_mode = {
    SWAP: 0,
    APPEND: 1,
    APPEND_DISABLED: 2,
};

const DEFAULT_AUTO_MODE_DELAY = 5;

export const groupCandidatesFilter = new FilterHelper(debounce(printGroupCandidates, 100));
let autoModeWorker = null;
const saveGroupDebounced = debounce(async (group, reload) => await _save(group, reload), 500);

function setAutoModeWorker() {
    clearInterval(autoModeWorker);
    const autoModeDelay = groups.find(x => x.id === selected_group)?.auto_mode_delay ?? DEFAULT_AUTO_MODE_DELAY;
    autoModeWorker = setInterval(groupChatAutoModeWorker, autoModeDelay * 1000);
}

async function _save(group, reload = true) {
    await fetch('/api/groups/edit', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(group),
    });
    if (reload) {
        await getCharacters();
    }
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

        await deleteLastMessage();
    }

    const abortController = new AbortController();
    setExternalAbortController(abortController);
    generateGroupWrapper(false, 'normal', { signal: abortController.signal });
}

async function loadGroupChat(chatId) {
    const response = await fetch('/api/chats/group/get', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ id: chatId }),
    });

    if (response.ok) {
        const data = await response.json();
        return data;
    }

    return [];
}

export async function getGroupChat(groupId) {
    const group = groups.find((x) => x.id === groupId);
    const chat_id = group.chat_id;
    const data = await loadGroupChat(chat_id);

    await loadItemizedPrompts(getCurrentChatId());

    if (Array.isArray(data) && data.length) {
        data[0].is_group = true;
        for (let key of data) {
            chat.push(key);
        }
        await printMessages();
    } else {
        sendSystemMessage(system_message_types.GROUP, '', { isSmallSys: true });
        if (group && Array.isArray(group.members)) {
            for (let member of group.members) {
                const character = characters.find(x => x.avatar === member || x.name === member);

                if (!character) {
                    continue;
                }

                const mes = getFirstCharacterMessage(character);
                chat.push(mes);
                addOneMessage(mes);
            }
        }
        await saveGroupChat(groupId, false);
    }

    if (group) {
        let metadata = group.chat_metadata ?? {};
        updateChatMetadata(metadata, true);
    }

    await eventSource.emit(event_types.CHAT_CHANGED, getCurrentChatId());
}

/**
 * Finds the character ID for a group member.
 * @param {string} arg 1-based member index or character name
 * @returns {number} 0-based character ID
 */
export function findGroupMemberId(arg) {
    arg = arg?.trim();

    if (!arg) {
        console.warn('WARN: No argument provided for findGroupMemberId');
        return;
    }

    const group = groups.find(x => x.id == selected_group);

    if (!group || !Array.isArray(group.members)) {
        console.warn('WARN: No group found for selected group ID');
        return;
    }

    // Index is 1-based
    const index = parseInt(arg) - 1;
    const searchByName = isNaN(index);

    if (searchByName) {
        const memberNames = group.members.map(x => ({ name: characters.find(y => y.avatar === x)?.name, index: characters.findIndex(y => y.avatar === x) }));
        const fuse = new Fuse(memberNames, { keys: ['name'] });
        const result = fuse.search(arg);

        if (!result.length) {
            console.warn(`WARN: No group member found with name ${arg}`);
            return;
        }

        const chid = result[0].item.index;

        if (chid === -1) {
            console.warn(`WARN: No character found for group member ${arg}`);
            return;
        }

        console.log(`Triggering group member ${chid} (${arg}) from search result`, result[0]);
        return chid;
    } else {
        const memberAvatar = group.members[index];

        if (memberAvatar === undefined) {
            console.warn(`WARN: No group member found at index ${index}`);
            return;
        }

        const chid = characters.findIndex(x => x.avatar === memberAvatar);

        if (chid === -1) {
            console.warn(`WARN: No character found for group member ${memberAvatar} at index ${index}`);
            return;
        }

        console.log(`Triggering group member ${memberAvatar} at index ${index}`);
        return chid;
    }
}

/**
 * Gets depth prompts for group members.
 * @param {string} groupId Group ID
 * @param {number} characterId Current Character ID
 * @returns {{depth: number, text: string}[]} Array of depth prompts
 */
export function getGroupDepthPrompts(groupId, characterId) {
    if (!groupId) {
        return [];
    }

    console.debug('getGroupDepthPrompts entered for group: ', groupId);
    const group = groups.find(x => x.id === groupId);

    if (!group || !Array.isArray(group.members) || !group.members.length) {
        return [];
    }

    if (group.generation_mode === group_generation_mode.SWAP) {
        return [];
    }

    const depthPrompts = [];

    for (const member of group.members) {
        const index = characters.findIndex(x => x.avatar === member);
        const character = characters[index];

        if (index === -1 || !character) {
            console.debug(`Skipping missing member: ${member}`);
            continue;
        }

        if (group.disabled_members.includes(member) && characterId !== index) {
            console.debug(`Skipping disabled group member: ${member}`);
            continue;
        }

        const depthPromptText = baseChatReplace(character.data?.extensions?.depth_prompt?.prompt?.trim(), name1, character.name) || '';
        const depthPromptDepth = character.data?.extensions?.depth_prompt?.depth ?? depth_prompt_depth_default;

        if (depthPromptText) {
            depthPrompts.push({ text: depthPromptText, depth: depthPromptDepth });
        }
    }

    return depthPrompts;
}

/**
 * Combines group members cards into a single string. Only for groups with generation mode set to APPEND or APPEND_DISABLED.
 * @param {string} groupId Group ID
 * @param {number} characterId Current Character ID
 * @returns {{description: string, personality: string, scenario: string, mesExamples: string}} Group character cards combined
 */
export function getGroupCharacterCards(groupId, characterId) {
    console.debug('getGroupCharacterCards entered for group: ', groupId);
    const group = groups.find(x => x.id === groupId);

    if (!group || !group?.generation_mode || !Array.isArray(group.members) || !group.members.length) {
        return null;
    }

    const scenarioOverride = chat_metadata['scenario'];

    let descriptions = [];
    let personalities = [];
    let scenarios = [];
    let mesExamplesArray = [];

    for (const member of group.members) {
        const index = characters.findIndex(x => x.avatar === member);
        const character = characters[index];

        if (index === -1 || !character) {
            console.debug(`Skipping missing member: ${member}`);
            continue;
        }

        if (group.disabled_members.includes(member) && characterId !== index && group.generation_mode !== group_generation_mode.APPEND_DISABLED) {
            console.debug(`Skipping disabled group member: ${member}`);
            continue;
        }

        descriptions.push(baseChatReplace(character.description.trim(), name1, character.name));
        personalities.push(baseChatReplace(character.personality.trim(), name1, character.name));
        scenarios.push(baseChatReplace(character.scenario.trim(), name1, character.name));
        mesExamplesArray.push(baseChatReplace(character.mes_example.trim(), name1, character.name));
    }

    const description = descriptions.join('\n');
    const personality = personalities.join('\n');
    const scenario = scenarioOverride?.trim() || scenarios.join('\n');
    const mesExamples = mesExamplesArray.join('\n');

    return { description, personality, scenario, mesExamples };
}

function getFirstCharacterMessage(character) {
    let messageText = character.first_mes;

    // if there are alternate greetings, pick one at random
    if (Array.isArray(character.data?.alternate_greetings)) {
        const messageTexts = [character.first_mes, ...character.data.alternate_greetings].filter(x => x);
        messageText = messageTexts[Math.floor(Math.random() * messageTexts.length)];
    }

    const mes = {};
    mes['is_user'] = false;
    mes['is_system'] = false;
    mes['name'] = character.name;
    mes['send_date'] = getMessageTimeStamp();
    mes['original_avatar'] = character.avatar;
    mes['extra'] = { 'gen_id': Date.now() * Math.random() * 1000000 };
    mes['mes'] = messageText
        ? substituteParams(messageText.trim(), name1, character.name)
        : default_ch_mes;
    mes['force_avatar'] =
        character.avatar != 'none'
            ? getThumbnailUrl('avatar', character.avatar)
            : default_avatar;
    return mes;
}

function resetSelectedGroup() {
    selected_group = null;
    is_group_generating = false;
}

async function saveGroupChat(groupId, shouldSaveGroup) {
    const group = groups.find(x => x.id == groupId);
    const chat_id = group.chat_id;
    group['date_last_chat'] = Date.now();
    const response = await fetch('/api/chats/group/save', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ id: chat_id, chat: [...chat] }),
    });

    if (shouldSaveGroup && response.ok) {
        await editGroup(groupId, false, false);
    }
}

export async function renameGroupMember(oldAvatar, newAvatar, newName) {
    // Scan every group for our renamed character
    for (const group of groups) {
        try {
            // Try finding the member by old avatar link
            const memberIndex = group.members.findIndex(x => x == oldAvatar);

            // Character was not present in the group...
            if (memberIndex == -1) {
                continue;
            }

            // Replace group member avatar id and save the changes
            group.members[memberIndex] = newAvatar;
            await editGroup(group.id, true, false);
            console.log(`Renamed character ${newName} in group: ${group.name}`);

            // Load all chats from this group
            for (const chatId of group.chats) {
                const messages = await loadGroupChat(chatId);

                // Only save the chat if there were any changes to the chat content
                let hadChanges = false;
                // Chat shouldn't be empty
                if (Array.isArray(messages) && messages.length) {
                    // Iterate over every chat message
                    for (const message of messages) {
                        // Only look at character messages
                        if (message.is_user || message.is_system) {
                            continue;
                        }

                        // Message belonged to the old-named character:
                        // Update name, avatar thumbnail URL and original avatar link
                        if (message.force_avatar && message.force_avatar.indexOf(encodeURIComponent(oldAvatar)) !== -1) {
                            message.name = newName;
                            message.force_avatar = message.force_avatar.replace(encodeURIComponent(oldAvatar), encodeURIComponent(newAvatar));
                            message.original_avatar = newAvatar;
                            hadChanges = true;
                        }
                    }

                    if (hadChanges) {
                        const saveChatResponse = await fetch('/api/chats/group/save', {
                            method: 'POST',
                            headers: getRequestHeaders(),
                            body: JSON.stringify({ id: chatId, chat: [...messages] }),
                        });

                        if (saveChatResponse.ok) {
                            console.log(`Renamed character ${newName} in group chat: ${chatId}`);
                        }
                    }
                }
            }
        }
        catch (error) {
            console.log(`An error during renaming the character ${newName} in group: ${group.name}`);
            console.error(error);
        }
    }
}

async function getGroups() {
    const response = await fetch('/api/groups/all', {
        method: 'POST',
        headers: getRequestHeaders(),
    });

    if (response.ok) {
        const data = await response.json();
        groups = data.sort((a, b) => a.id - b.id);

        // Convert groups to new format
        for (const group of groups) {
            if (typeof group.id === 'number') {
                group.id = String(group.id);
            }
            if (group.disabled_members == undefined) {
                group.disabled_members = [];
            }
            if (group.chat_id == undefined) {
                group.chat_id = group.id;
                group.chats = [group.id];
                group.members = group.members
                    .map(x => characters.find(y => y.name == x)?.avatar)
                    .filter(x => x)
                    .filter(onlyUnique);
            }
            if (group.past_metadata == undefined) {
                group.past_metadata = {};
            }
            if (typeof group.chat_id === 'number') {
                group.chat_id = String(group.chat_id);
            }
            if (Array.isArray(group.chats) && group.chats.some(x => typeof x === 'number')) {
                group.chats = group.chats.map(x => String(x));
            }
        }
    }
}

export function getGroupBlock(group) {
    const template = $('#group_list_template .group_select').clone();
    template.data('id', group.id);
    template.attr('grid', group.id);
    template.find('.ch_name').text(group.name);
    template.find('.group_fav_icon').css('display', 'none');
    template.addClass(group.fav ? 'is_fav' : '');
    template.find('.ch_fav').val(group.fav);

    // Display inline tags
    const tags = getTagsList(group.id);
    const tagsElement = template.find('.tags');
    tags.forEach(tag => appendTagToList(tagsElement, tag, {}));

    const avatar = getGroupAvatar(group);
    if (avatar) {
        $(template).find('.avatar').replaceWith(avatar);
    }

    return template;
}

function updateGroupAvatar(group) {
    $('#group_avatar_preview').empty().append(getGroupAvatar(group));

    $('.group_select').each(function () {
        if ($(this).data('id') == group.id) {
            $(this).find('.avatar').replaceWith(getGroupAvatar(group));
        }
    });
}

// check if isDataURLor if it's a valid local file url
function isValidImageUrl(url) {
    // check if empty dict
    if (Object.keys(url).length === 0) {
        return false;
    }
    return isDataURL(url) || (url && url.startsWith('user'));
}

function getGroupAvatar(group) {
    if (!group) {
        return $(`<div class="avatar"><img src="${default_avatar}"></div>`);
    }
    // if isDataURL or if it's a valid local file url
    if (isValidImageUrl(group.avatar_url)) {
        return $(`<div class="avatar"><img src="${group.avatar_url}"></div>`);
    }

    const memberAvatars = [];
    if (group && Array.isArray(group.members) && group.members.length) {
        for (const member of group.members) {
            const charIndex = characters.findIndex(x => x.avatar === member);
            if (charIndex !== -1 && characters[charIndex].avatar !== 'none') {
                const avatar = getThumbnailUrl('avatar', characters[charIndex].avatar);
                memberAvatars.push(avatar);
            }
            if (memberAvatars.length === 4) {
                break;
            }
        }
    }

    const avatarCount = memberAvatars.length;

    if (avatarCount >= 1 && avatarCount <= 4) {
        const groupAvatar = $(`#group_avatars_template .collage_${avatarCount}`).clone();

        for (let i = 0; i < avatarCount; i++) {
            groupAvatar.find(`.img_${i + 1}`).attr('src', memberAvatars[i]);
        }

        return groupAvatar;
    }

    // default avatar
    const groupAvatar = $('#group_avatars_template .collage_1').clone();
    groupAvatar.find('.img_1').attr('src', group.avatar_url || system_avatar);
    return groupAvatar;
}

function getGroupChatNames(groupId) {
    const group = groups.find(x => x.id === groupId);

    if (!group) {
        return [];
    }

    const names = [];
    for (const chatId of group.chats) {
        names.push(chatId);
    }
    return names;
}

async function generateGroupWrapper(by_auto_mode, type = null, params = {}) {
    function throwIfAborted() {
        if (params.signal instanceof AbortSignal && params.signal.aborted) {
            throw new Error('AbortSignal was fired. Group generation stopped');
        }
    }

    if (online_status === 'no_connection') {
        is_group_generating = false;
        setSendButtonState(false);
        return Promise.resolve();
    }

    if (is_group_generating) {
        return Promise.resolve();
    }

    // Auto-navigate back to group menu
    if (menu_type !== 'group_edit') {
        select_group_chats(selected_group);
        await delay(1);
    }

    const group = groups.find((x) => x.id === selected_group);
    let typingIndicator = $('#chat .typing_indicator');
    let textResult = '';

    if (!group || !Array.isArray(group.members) || !group.members.length) {
        sendSystemMessage(system_message_types.EMPTY, '', { isSmallSys: true });
        return Promise.resolve();
    }

    try {
        throwIfAborted();
        hideSwipeButtons();
        is_group_generating = true;
        setCharacterName('');
        setCharacterId(undefined);
        const userInput = String($('#send_textarea').val());

        if (typingIndicator.length === 0 && !isStreamingEnabled()) {
            typingIndicator = $(
                '#typing_indicator_template .typing_indicator',
            ).clone();
            typingIndicator.hide();
            $('#chat').append(typingIndicator);
        }

        // id of this specific batch for regeneration purposes
        group_generation_id = Date.now();
        const lastMessage = chat[chat.length - 1];
        let activationText = '';
        let isUserInput = false;

        if (userInput?.length && !by_auto_mode) {
            isUserInput = true;
            activationText = userInput;
        } else {
            if (lastMessage && !lastMessage.is_system) {
                activationText = lastMessage.mes;
            }
        }

        const activationStrategy = Number(group.activation_strategy ?? group_activation_strategy.NATURAL);
        const enabledMembers = group.members.filter(x => !group.disabled_members.includes(x));
        let activatedMembers = [];

        if (params && typeof params.force_chid == 'number') {
            activatedMembers = [params.force_chid];
        } else if (type === 'quiet') {
            activatedMembers = activateSwipe(group.members);

            if (activatedMembers.length === 0) {
                activatedMembers = activateListOrder(group.members.slice(0, 1));
            }
        }
        else if (type === 'swipe' || type === 'continue') {
            activatedMembers = activateSwipe(group.members);

            if (activatedMembers.length === 0) {
                toastr.warning('Deleted group member swiped. To get a reply, add them back to the group.');
                throw new Error('Deleted group member swiped');
            }
        }
        else if (type === 'impersonate') {
            $('#send_textarea').attr('disabled', true);
            activatedMembers = activateImpersonate(group.members);
        }
        else if (activationStrategy === group_activation_strategy.NATURAL) {
            activatedMembers = activateNaturalOrder(enabledMembers, activationText, lastMessage, group.allow_self_responses, isUserInput);
        }
        else if (activationStrategy === group_activation_strategy.LIST) {
            activatedMembers = activateListOrder(enabledMembers);
        }

        if (activatedMembers.length === 0) {
            //toastr.warning('All group members are disabled. Enable at least one to get a reply.');

            // Send user message as is
            const bias = getBiasStrings(userInput, type);
            await sendMessageAsUser(userInput, bias.messageBias);
            await saveChatConditional();
            $('#send_textarea').val('').trigger('input');
        }

        // now the real generation begins: cycle through every activated character
        for (const chId of activatedMembers) {
            throwIfAborted();
            deactivateSendButtons();
            const generateType = type == 'swipe' || type == 'impersonate' || type == 'quiet' || type == 'continue' ? type : 'group_chat';
            setCharacterId(chId);
            setCharacterName(characters[chId].name);
            await eventSource.emit(event_types.GROUP_MEMBER_DRAFTED, chId);

            if (type !== 'swipe' && type !== 'impersonate' && !isStreamingEnabled()) {
                // update indicator and scroll down
                typingIndicator
                    .find('.typing_indicator_name')
                    .text(characters[chId].name);
                typingIndicator.show();
            }

            // Wait for generation to finish
            const generateFinished = await Generate(generateType, { automatic_trigger: by_auto_mode, ...(params || {}) });
            textResult = await generateFinished;
        }
    } finally {
        typingIndicator.hide();

        is_group_generating = false;
        $('#send_textarea').attr('disabled', false);
        setSendButtonState(false);
        setCharacterId(undefined);
        setCharacterName('');
        activateSendButtons();
        showSwipeButtons();
    }

    return Promise.resolve(textResult);
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
    const activatedMembers = [members[randomIndex]];
    const memberIds = activatedMembers
        .map((x) => characters.findIndex((y) => y.avatar === x))
        .filter((x) => x !== -1);
    return memberIds;
}

/**
 * Activates a group member based on the last message.
 * @param {string[]} members Array of group member avatar ids
 * @returns {number[]} Array of character ids
 */
function activateSwipe(members) {
    let activatedNames = [];
    const lastMessage = chat[chat.length - 1];

    if (lastMessage.is_user || lastMessage.is_system || lastMessage.extra?.type === system_message_types.NARRATOR) {
        for (const message of chat.slice().reverse()) {
            if (message.is_user || message.is_system || message.extra?.type === system_message_types.NARRATOR) {
                continue;
            }

            if (message.original_avatar) {
                activatedNames.push(message.original_avatar);
                break;
            }
        }

        if (activatedNames.length === 0) {
            activatedNames.push(shuffle(members.slice())[0]);
        }
    }

    // pre-update group chat swipe
    if (!lastMessage.original_avatar) {
        const matches = characters.filter(x => x.name == lastMessage.name);

        for (const match of matches) {
            if (members.includes(match.avatar)) {
                activatedNames.push(match.avatar);
                break;
            }
        }
    }
    else {
        activatedNames.push(lastMessage.original_avatar);
    }

    const memberIds = activatedNames
        .map((x) => characters.findIndex((y) => y.avatar === x))
        .filter((x) => x !== -1);
    return memberIds;
}

function activateListOrder(members) {
    let activatedMembers = members.filter(onlyUnique);

    // map to character ids
    const memberIds = activatedMembers
        .map((x) => characters.findIndex((y) => y.avatar === x))
        .filter((x) => x !== -1);
    return memberIds;
}

function activateNaturalOrder(members, input, lastMessage, allowSelfResponses, isUserInput) {
    let activatedMembers = [];

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
                const character = characters.find(x => x.avatar === member);

                if (!character || character.name === bannedUser) {
                    continue;
                }

                if (extractAllWords(character.name).includes(inputWord)) {
                    activatedMembers.push(member);
                    break;
                }
            }
        }
    }

    // activation by talkativeness (in shuffled order, except banned)
    const shuffledMembers = shuffle([...members]);
    for (let member of shuffledMembers) {
        const character = characters.find((x) => x.avatar === member);

        if (!character || character.name === bannedUser) {
            continue;
        }

        const rollValue = Math.random();
        let talkativeness = Number(character.talkativeness);
        talkativeness = Number.isNaN(talkativeness)
            ? talkativeness_default
            : talkativeness;
        if (talkativeness >= rollValue) {
            activatedMembers.push(member);
        }
    }

    // pick 1 at random if no one was activated
    let retries = 0;
    while (activatedMembers.length === 0 && ++retries <= members.length) {
        const randomIndex = Math.floor(Math.random() * members.length);
        const character = characters.find((x) => x.avatar === members[randomIndex]);

        if (!character) {
            continue;
        }

        activatedMembers.push(members[randomIndex]);
    }

    // de-duplicate array of character avatars
    activatedMembers = activatedMembers.filter(onlyUnique);

    // map to character ids
    const memberIds = activatedMembers
        .map((x) => characters.findIndex((y) => y.avatar === x))
        .filter((x) => x !== -1);
    return memberIds;
}

async function deleteGroup(id) {
    const group = groups.find((x) => x.id === id);

    const response = await fetch('/api/groups/delete', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ id: id }),
    });

    if (group && Array.isArray(group.chats)) {
        for (const chatId of group.chats) {
            await eventSource.emit(event_types.GROUP_CHAT_DELETED, chatId);
        }
    }

    if (response.ok) {
        await clearChat();
        selected_group = null;
        delete tag_map[id];
        resetChatState();
        await printMessages();
        await getCharacters();

        select_rm_info('group_delete', id);

        $('#rm_button_selected_ch').children('h2').text('');
    }
}

export async function editGroup(id, immediately, reload = true) {
    let group = groups.find((x) => x.id === id);

    if (!group) {
        return;
    }

    group['chat_metadata'] = chat_metadata;

    if (immediately) {
        return await _save(group, reload);
    }

    saveGroupDebounced(group, reload);
}

let groupAutoModeAbortController = null;

async function groupChatAutoModeWorker() {
    if (!is_group_automode_enabled || online_status === 'no_connection') {
        return;
    }

    if (!selected_group || is_send_press || is_group_generating) {
        return;
    }

    const group = groups.find((x) => x.id === selected_group);

    if (!group || !Array.isArray(group.members) || !group.members.length) {
        return;
    }

    groupAutoModeAbortController = new AbortController();
    await generateGroupWrapper(true, 'auto', { signal: groupAutoModeAbortController.signal });
}

async function modifyGroupMember(chat_id, groupMember, isDelete) {
    const id = groupMember.data('id');
    const thisGroup = groups.find((x) => x.id == chat_id);
    const membersArray = thisGroup?.members ?? newGroupMembers;

    if (isDelete) {
        const index = membersArray.findIndex((x) => x === id);
        if (index !== -1) {
            membersArray.splice(membersArray.indexOf(id), 1);
        }
    } else {
        membersArray.unshift(id);
    }

    if (openGroupId) {
        await editGroup(openGroupId, false, false);
        updateGroupAvatar(thisGroup);
    }

    printGroupCandidates();
    printGroupMembers();

    const groupHasMembers = getGroupCharacters({ doFilter: false, onlyMembers: true }).length > 0;
    $('#rm_group_submit').prop('disabled', !groupHasMembers);
}

async function reorderGroupMember(chat_id, groupMember, direction) {
    const id = groupMember.data('id');
    const thisGroup = groups.find((x) => x.id == chat_id);
    const memberArray = thisGroup?.members ?? newGroupMembers;

    const indexOf = memberArray.indexOf(id);
    if (direction == 'down') {
        const next = memberArray[indexOf + 1];
        if (next) {
            memberArray[indexOf + 1] = memberArray[indexOf];
            memberArray[indexOf] = next;
        }
    }
    if (direction == 'up') {
        const prev = memberArray[indexOf - 1];
        if (prev) {
            memberArray[indexOf - 1] = memberArray[indexOf];
            memberArray[indexOf] = prev;
        }
    }

    printGroupMembers();

    // Existing groups need to modify members list
    if (openGroupId) {
        await editGroup(chat_id, false, false);
        updateGroupAvatar(thisGroup);
    }
}

async function onGroupActivationStrategyInput(e) {
    if (openGroupId) {
        let _thisGroup = groups.find((x) => x.id == openGroupId);
        _thisGroup.activation_strategy = Number(e.target.value);
        await editGroup(openGroupId, false, false);
    }
}

async function onGroupGenerationModeInput(e) {
    if (openGroupId) {
        let _thisGroup = groups.find((x) => x.id == openGroupId);
        _thisGroup.generation_mode = Number(e.target.value);
        await editGroup(openGroupId, false, false);
    }
}

async function onGroupAutoModeDelayInput(e) {
    if (openGroupId) {
        let _thisGroup = groups.find((x) => x.id == openGroupId);
        _thisGroup.auto_mode_delay = Number(e.target.value);
        await editGroup(openGroupId, false, false);
        setAutoModeWorker();
    }
}

async function onGroupNameInput() {
    if (openGroupId) {
        let _thisGroup = groups.find((x) => x.id == openGroupId);
        _thisGroup.name = $(this).val();
        $('#rm_button_selected_ch').children('h2').text(_thisGroup.name);
        await editGroup(openGroupId);
    }
}

function isGroupMember(group, avatarId) {
    if (group && Array.isArray(group.members)) {
        return group.members.includes(avatarId);
    } else {
        return newGroupMembers.includes(avatarId);
    }
}

function getGroupCharacters({ doFilter, onlyMembers } = {}) {
    function sortMembersFn(a, b) {
        const membersArray = thisGroup?.members ?? newGroupMembers;
        const aIndex = membersArray.indexOf(a.item.avatar);
        const bIndex = membersArray.indexOf(b.item.avatar);
        return aIndex - bIndex;
    }

    const thisGroup = openGroupId && groups.find((x) => x.id == openGroupId);
    let candidates = characters
        .filter((x) => isGroupMember(thisGroup, x.avatar) == onlyMembers)
        .map((x, index) => ({ item: x, id: index, type: 'character' }));

    if (onlyMembers) {
        candidates.sort(sortMembersFn);
    } else {
        sortEntitiesList(candidates);
    }

    if (doFilter) {
        candidates = groupCandidatesFilter.applyFilters(candidates);
    }

    return candidates;
}

function printGroupCandidates() {
    const storageKey = 'GroupCandidates_PerPage';
    $('#rm_group_add_members_pagination').pagination({
        dataSource: getGroupCharacters({ doFilter: true, onlyMembers: false }),
        pageRange: 1,
        position: 'top',
        showPageNumbers: false,
        prevText: '<',
        nextText: '>',
        formatNavigator: PAGINATION_TEMPLATE,
        showNavigator: true,
        showSizeChanger: true,
        pageSize: Number(localStorage.getItem(storageKey)) || 5,
        sizeChangerOptions: [5, 10, 25, 50, 100, 200, 500, 1000],
        afterSizeSelectorChange: function (e) {
            localStorage.setItem(storageKey, e.target.value);
        },
        callback: function (data) {
            $('#rm_group_add_members').empty();
            for (const i of data) {
                $('#rm_group_add_members').append(getGroupCharacterBlock(i.item));
            }
        },
    });
}

function printGroupMembers() {
    const storageKey = 'GroupMembers_PerPage';
    $('.rm_group_members_pagination').each(function () {
        $(this).pagination({
            dataSource: getGroupCharacters({ doFilter: false, onlyMembers: true }),
            pageRange: 1,
            position: 'top',
            showPageNumbers: false,
            prevText: '<',
            nextText: '>',
            formatNavigator: PAGINATION_TEMPLATE,
            showNavigator: true,
            showSizeChanger: true,
            pageSize: Number(localStorage.getItem(storageKey)) || 5,
            sizeChangerOptions: [5, 10, 25, 50, 100, 200, 500, 1000],
            afterSizeSelectorChange: function (e) {
                localStorage.setItem(storageKey, e.target.value);
            },
            callback: function (data) {
                $('.rm_group_members').empty();
                for (const i of data) {
                    $('.rm_group_members').append(getGroupCharacterBlock(i.item));
                }
            },
        });
    });
}

function getGroupCharacterBlock(character) {
    const avatar = getThumbnailUrl('avatar', character.avatar);
    const template = $('#group_member_template .group_member').clone();
    const isFav = character.fav || character.fav == 'true';
    template.data('id', character.avatar);
    template.find('.avatar img').attr({ 'src': avatar, 'title': character.avatar });
    template.find('.ch_name').text(character.name);
    template.attr('chid', characters.indexOf(character));
    template.find('.ch_fav').val(isFav);
    template.toggleClass('is_fav', isFav);
    template.toggleClass('disabled', isGroupMemberDisabled(character.avatar));

    // Display inline tags
    const tags = getTagsList(character.avatar);
    const tagsElement = template.find('.tags');
    tags.forEach(tag => appendTagToList(tagsElement, tag, {}));

    if (!openGroupId) {
        template.find('[data-action="speak"]').hide();
        template.find('[data-action="enable"]').hide();
        template.find('[data-action="disable"]').hide();
    }

    return template;
}

function isGroupMemberDisabled(avatarId) {
    const thisGroup = openGroupId && groups.find((x) => x.id == openGroupId);
    return Boolean(thisGroup && thisGroup.disabled_members.includes(avatarId));
}

function onDeleteGroupClick() {
    if (is_group_generating) {
        toastr.warning('Not so fast! Wait for the characters to stop typing before deleting the group.');
        return;
    }

    $('#dialogue_popup').data('group_id', openGroupId);
    callPopup('<h3>Delete the group?</h3><p>This will also delete all your chats with that group. If you want to delete a single conversation, select a "View past chats" option in the lower left menu.</p>', 'del_group');
}

async function onFavoriteGroupClick() {
    updateFavButtonState(!fav_grp_checked);
    if (openGroupId) {
        let _thisGroup = groups.find((x) => x.id == openGroupId);
        _thisGroup.fav = fav_grp_checked;
        await editGroup(openGroupId, false, false);
        favsToHotswap();
    }
}

async function onGroupSelfResponsesClick() {
    if (openGroupId) {
        let _thisGroup = groups.find((x) => x.id == openGroupId);
        const value = $(this).prop('checked');
        _thisGroup.allow_self_responses = value;
        await editGroup(openGroupId, false, false);
    }
}

async function onHideMutedSpritesClick(value) {
    if (openGroupId) {
        let _thisGroup = groups.find((x) => x.id == openGroupId);
        _thisGroup.hideMutedSprites = value;
        console.log(`_thisGroup.hideMutedSprites = ${_thisGroup.hideMutedSprites}`);
        await editGroup(openGroupId, false, false);
    }
}

function select_group_chats(groupId, skipAnimation) {
    openGroupId = groupId;
    newGroupMembers = [];
    const group = openGroupId && groups.find((x) => x.id == openGroupId);
    const groupName = group?.name ?? '';
    const replyStrategy = Number(group?.activation_strategy ?? group_activation_strategy.NATURAL);
    const generationMode = Number(group?.generation_mode ?? group_generation_mode.SWAP);

    setMenuType(group ? 'group_edit' : 'group_create');
    $('#group_avatar_preview').empty().append(getGroupAvatar(group));
    $('#rm_group_restore_avatar').toggle(!!group && isValidImageUrl(group.avatar_url));
    $('#rm_group_filter').val('').trigger('input');
    $('#rm_group_activation_strategy').val(replyStrategy);
    $(`#rm_group_activation_strategy option[value="${replyStrategy}"]`).prop('selected', true);
    $('#rm_group_generation_mode').val(generationMode);
    $(`#rm_group_generation_mode option[value="${generationMode}"]`).prop('selected', true);
    $('#rm_group_chat_name').val(groupName);

    if (!skipAnimation) {
        selectRightMenuWithAnimation('rm_group_chats_block');
    }

    // render characters list
    printGroupCandidates();
    printGroupMembers();

    const groupHasMembers = !!$('#rm_group_members').children().length;
    $('#rm_group_submit').prop('disabled', !groupHasMembers);
    $('#rm_group_allow_self_responses').prop('checked', group && group.allow_self_responses);
    $('#rm_group_hidemutedsprites').prop('checked', group && group.hideMutedSprites);
    $('#rm_group_automode_delay').val(group?.auto_mode_delay ?? DEFAULT_AUTO_MODE_DELAY);

    // bottom buttons
    if (openGroupId) {
        $('#rm_group_submit').hide();
        $('#rm_group_delete').show();
        $('#rm_group_scenario').show();
        $('#group-metadata-controls .chat_lorebook_button').removeClass('disabled').prop('disabled', false);
    } else {
        $('#rm_group_submit').show();
        if ($('#groupAddMemberListToggle .inline-drawer-content').css('display') !== 'block') {
            $('#groupAddMemberListToggle').trigger('click');
        }
        $('#rm_group_delete').hide();
        $('#rm_group_scenario').hide();
        $('#group-metadata-controls .chat_lorebook_button').addClass('disabled').prop('disabled', true);
    }

    updateFavButtonState(group?.fav ?? false);
    setAutoModeWorker();

    // top bar
    if (group) {
        $('#rm_group_automode_label').show();
        $('#rm_button_selected_ch').children('h2').text(groupName);
    }
    else {
        $('#rm_group_automode_label').hide();
    }

    eventSource.emit('groupSelected', { detail: { id: openGroupId, group: group } });
}

/**
 * Handles the upload and processing of a group avatar.
 * The selected image is read, cropped using a popup, processed into a thumbnail,
 * and then uploaded to the server.
 *
 * @param {Event} event - The event triggered by selecting a file input, containing the image file to upload.
 *
 * @returns {Promise<void>} - A promise that resolves when the processing and upload is complete.
 */
async function uploadGroupAvatar(event) {
    const file = event.target.files[0];

    if (!file) {
        return;
    }

    const result = await getBase64Async(file);

    $('#dialogue_popup').addClass('large_dialogue_popup wide_dialogue_popup');

    const croppedImage = await callPopup(getCropPopup(result), 'avatarToCrop');

    if (!croppedImage) {
        return;
    }

    let thumbnail = await createThumbnail(croppedImage, 200, 300);
    //remove data:image/whatever;base64
    thumbnail = thumbnail.replace(/^data:image\/[a-z]+;base64,/, '');
    let _thisGroup = groups.find((x) => x.id == openGroupId);
    // filename should be group id + human readable timestamp
    const filename = _thisGroup ? `${_thisGroup.id}_${humanizedDateTime()}` : humanizedDateTime();
    let thumbnailUrl = await saveBase64AsFile(thumbnail, String(openGroupId ?? ''), filename, 'jpg');
    if (!openGroupId) {
        $('#group_avatar_preview img').attr('src', thumbnailUrl);
        $('#rm_group_restore_avatar').show();
        return;
    }

    _thisGroup.avatar_url = thumbnailUrl;
    $('#group_avatar_preview').empty().append(getGroupAvatar(_thisGroup));
    $('#rm_group_restore_avatar').show();
    await editGroup(openGroupId, true, true);
}

async function restoreGroupAvatar() {
    const confirm = await callPopup('<h3>Are you sure you want to restore the group avatar?</h3> Your custom image will be deleted, and a collage will be used instead.', 'confirm');

    if (!confirm) {
        return;
    }

    if (!openGroupId) {
        $('#group_avatar_preview img').attr('src', default_avatar);
        $('#rm_group_restore_avatar').hide();
        return;
    }

    let _thisGroup = groups.find((x) => x.id == openGroupId);
    _thisGroup.avatar_url = '';
    $('#group_avatar_preview').empty().append(getGroupAvatar(_thisGroup));
    $('#rm_group_restore_avatar').hide();
    await editGroup(openGroupId, true, true);
}

async function onGroupActionClick(event) {
    event.stopPropagation();
    const action = $(this).data('action');
    const member = $(this).closest('.group_member');

    if (action === 'remove') {
        await modifyGroupMember(openGroupId, member, true);
    }

    if (action === 'add') {
        await modifyGroupMember(openGroupId, member, false);
    }

    if (action === 'enable') {
        member.removeClass('disabled');
        const _thisGroup = groups.find(x => x.id === openGroupId);
        const index = _thisGroup.disabled_members.indexOf(member.data('id'));
        if (index !== -1) {
            _thisGroup.disabled_members.splice(index, 1);
        }
        await editGroup(openGroupId, false, false);
    }

    if (action === 'disable') {
        member.addClass('disabled');
        const _thisGroup = groups.find(x => x.id === openGroupId);
        _thisGroup.disabled_members.push(member.data('id'));
        await editGroup(openGroupId, false, false);
    }

    if (action === 'up' || action === 'down') {
        await reorderGroupMember(openGroupId, member, action);
    }

    if (action === 'view') {
        openCharacterDefinition(member);
    }

    if (action === 'speak') {
        const chid = Number(member.attr('chid'));
        if (Number.isInteger(chid)) {
            Generate('normal', { force_chid: chid });
        }
    }

    await eventSource.emit(event_types.GROUP_UPDATED);
}

function updateFavButtonState(state) {
    fav_grp_checked = state;
    $('#rm_group_fav').val(fav_grp_checked);
    $('#group_favorite_button').toggleClass('fav_on', fav_grp_checked);
    $('#group_favorite_button').toggleClass('fav_off', !fav_grp_checked);
}

export async function openGroupById(groupId) {
    if (isChatSaving) {
        toastr.info('Please wait until the chat is saved before switching characters.', 'Your chat is still saving...');
        return;
    }

    if (!groups.find(x => x.id === groupId)) {
        console.log('Group not found', groupId);
        return;
    }

    if (!is_send_press && !is_group_generating) {
        if (selected_group !== groupId) {
            await clearChat();
            cancelTtsPlay();
            selected_group = groupId;
            setCharacterId(undefined);
            setCharacterName('');
            setEditedMessageId(undefined);
            updateChatMetadata({}, true);
            chat.length = 0;
            await getGroupChat(groupId);
        }

        select_group_chats(groupId);
    }
}

function openCharacterDefinition(characterSelect) {
    if (is_group_generating) {
        toastr.warning('Can\'t peek a character while group reply is being generated');
        console.warn('Can\'t peek a character def while group reply is being generated');
        return;
    }

    const chid = characterSelect.attr('chid');

    if (chid === null || chid === undefined) {
        return;
    }

    setCharacterId(chid);
    select_selected_character(chid);
    // Gentle nudge to recalculate tokens
    RA_CountCharTokens();
    // Do a little tomfoolery to spoof the tag selector
    applyTagsOnCharacterSelect.call(characterSelect);
}

function filterGroupMembers() {
    const searchValue = String($(this).val()).toLowerCase();
    groupCandidatesFilter.setFilterData(FILTER_TYPES.SEARCH, searchValue);
}

async function createGroup() {
    let name = $('#rm_group_chat_name').val();
    let allowSelfResponses = !!$('#rm_group_allow_self_responses').prop('checked');
    let activationStrategy = Number($('#rm_group_activation_strategy').find(':selected').val()) ?? group_activation_strategy.NATURAL;
    let generationMode = Number($('#rm_group_generation_mode').find(':selected').val()) ?? group_generation_mode.SWAP;
    let autoModeDelay = Number($('#rm_group_automode_delay').val()) ?? DEFAULT_AUTO_MODE_DELAY;
    const members = newGroupMembers;
    const memberNames = characters.filter(x => members.includes(x.avatar)).map(x => x.name).join(', ');

    if (!name) {
        name = `Group: ${memberNames}`;
    }

    const avatar_url = $('#group_avatar_preview img').attr('src');

    const chatName = humanizedDateTime();
    const chats = [chatName];

    const createGroupResponse = await fetch('/api/groups/create', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            name: name,
            members: members,
            avatar_url: isValidImageUrl(avatar_url) ? avatar_url : default_avatar,
            allow_self_responses: allowSelfResponses,
            hideMutedSprites: hideMutedSprites,
            activation_strategy: activationStrategy,
            generation_mode: generationMode,
            disabled_members: [],
            chat_metadata: {},
            fav: fav_grp_checked,
            chat_id: chatName,
            chats: chats,
            auto_mode_delay: autoModeDelay,
        }),
    });

    if (createGroupResponse.ok) {
        newGroupMembers = [];
        const data = await createGroupResponse.json();
        createTagMapFromList('#groupTagList', data.id);
        await getCharacters();
        select_rm_info('group_create', data.id);
    }
}

export async function createNewGroupChat(groupId) {
    const group = groups.find(x => x.id === groupId);

    if (!group) {
        return;
    }

    const oldChatName = group.chat_id;
    const newChatName = humanizedDateTime();

    if (typeof group.past_metadata !== 'object') {
        group.past_metadata = {};
    }

    await clearChat();
    chat.length = 0;
    if (oldChatName) {
        group.past_metadata[oldChatName] = Object.assign({}, chat_metadata);
    }
    group.chats.push(newChatName);
    group.chat_id = newChatName;
    group.chat_metadata = {};
    updateChatMetadata(group.chat_metadata, true);

    await editGroup(group.id, true, false);
    await getGroupChat(group.id);
}

export async function getGroupPastChats(groupId) {
    const group = groups.find(x => x.id === groupId);

    if (!group) {
        return [];
    }

    const chats = [];

    try {
        for (const chatId of group.chats) {
            const messages = await loadGroupChat(chatId);
            let this_chat_file_size = (JSON.stringify(messages).length / 1024).toFixed(2) + 'kb';
            let chat_items = messages.length;
            const lastMessage = messages.length ? messages[messages.length - 1].mes : '[The chat is empty]';
            const lastMessageDate = messages.length ? (messages[messages.length - 1].send_date || Date.now()) : Date.now();
            chats.push({
                'file_name': chatId,
                'mes': lastMessage,
                'last_mes': lastMessageDate,
                'file_size': this_chat_file_size,
                'chat_items': chat_items,
            });
        }
    } catch (err) {
        console.error(err);
    }
    return chats;
}

export async function openGroupChat(groupId, chatId) {
    const group = groups.find(x => x.id === groupId);

    if (!group || !group.chats.includes(chatId)) {
        return;
    }

    await clearChat();
    chat.length = 0;
    const previousChat = group.chat_id;
    group.past_metadata[previousChat] = Object.assign({}, chat_metadata);
    group.chat_id = chatId;
    group.chat_metadata = group.past_metadata[chatId] || {};
    group['date_last_chat'] = Date.now();
    updateChatMetadata(group.chat_metadata, true);

    await editGroup(groupId, true, false);
    await getGroupChat(groupId);
}

export async function renameGroupChat(groupId, oldChatId, newChatId) {
    const group = groups.find(x => x.id === groupId);

    if (!group || !group.chats.includes(oldChatId)) {
        return;
    }

    if (group.chat_id === oldChatId) {
        group.chat_id = newChatId;
    }

    group.chats.splice(group.chats.indexOf(oldChatId), 1);
    group.chats.push(newChatId);
    group.past_metadata[newChatId] = (group.past_metadata[oldChatId] || {});
    delete group.past_metadata[oldChatId];

    await editGroup(groupId, true, true);
}

export async function deleteGroupChat(groupId, chatId) {
    const group = groups.find(x => x.id === groupId);

    if (!group || !group.chats.includes(chatId)) {
        return;
    }

    group.chats.splice(group.chats.indexOf(chatId), 1);
    group.chat_metadata = {};
    group.chat_id = '';
    delete group.past_metadata[chatId];
    updateChatMetadata(group.chat_metadata, true);

    const response = await fetch('/api/chats/group/delete', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ id: chatId }),
    });

    if (response.ok) {
        if (group.chats.length) {
            await openGroupChat(groupId, group.chats[0]);
        } else {
            await createNewGroupChat(groupId);
        }

        await eventSource.emit(event_types.GROUP_CHAT_DELETED, chatId);
    }
}

export async function importGroupChat(formData) {
    await jQuery.ajax({
        type: 'POST',
        url: '/api/chats/group/import',
        data: formData,
        beforeSend: function () {
        },
        cache: false,
        contentType: false,
        processData: false,
        success: async function (data) {
            if (data.res) {
                const chatId = data.res;
                const group = groups.find(x => x.id == selected_group);

                if (group) {
                    group.chats.push(chatId);
                    await editGroup(selected_group, true, true);
                    await displayPastChats();
                }
            }
        },
        error: function () {
            $('#create_button').removeAttr('disabled');
        },
    });
}

export async function saveGroupBookmarkChat(groupId, name, metadata, mesId) {
    const group = groups.find(x => x.id === groupId);

    if (!group) {
        return;
    }

    group.past_metadata[name] = { ...chat_metadata, ...(metadata || {}) };
    group.chats.push(name);

    const trimmed_chat = (mesId !== undefined && mesId >= 0 && mesId < chat.length)
        ? chat.slice(0, parseInt(mesId) + 1)
        : chat;

    await editGroup(groupId, true, false);

    await fetch('/api/chats/group/save', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ id: name, chat: [...trimmed_chat] }),
    });
}

function onSendTextareaInput() {
    if (is_group_automode_enabled) {
        // Wait for current automode generation to finish
        is_group_automode_enabled = false;
        $('#rm_group_automode').prop('checked', false);
    }
}

function stopAutoModeGeneration() {
    if (groupAutoModeAbortController) {
        groupAutoModeAbortController.abort();
    }

    is_group_automode_enabled = false;
    $('#rm_group_automode').prop('checked', false);
}

function doCurMemberListPopout() {
    //repurposes the zoomed avatar template to server as a floating group member list
    if ($('#groupMemberListPopout').length === 0) {
        console.debug('did not see popout yet, creating');
        const memberListClone = $(this).parent().parent().find('.inline-drawer-content').html();
        const template = $('#zoomed_avatar_template').html();
        const controlBarHtml = `<div class="panelControlBar flex-container">
        <div id="groupMemberListPopoutheader" class="fa-solid fa-grip drag-grabber hoverglow"></div>
        <div id="groupMemberListPopoutClose" class="fa-solid fa-circle-xmark hoverglow"></div>
    </div>`;
        const newElement = $(template);

        newElement.attr('id', 'groupMemberListPopout')
            .removeClass('zoomed_avatar')
            .addClass('draggable')
            .empty()
            .append(controlBarHtml)
            .append(memberListClone);

        // Remove pagination from popout
        newElement.find('.group_pagination').empty();

        $('body').append(newElement);
        loadMovingUIState();
        $('#groupMemberListPopout').fadeIn(animation_duration);
        dragElement(newElement);
        $('#groupMemberListPopoutClose').off('click').on('click', function () {
            $('#groupMemberListPopout').fadeOut(animation_duration, () => { $('#groupMemberListPopout').remove(); });
        });

        // Re-add pagination not working in popout
        printGroupMembers();
    } else {
        console.debug('saw existing popout, removing');
        $('#groupMemberListPopout').fadeOut(animation_duration, () => { $('#groupMemberListPopout').remove(); });
    }
}

jQuery(() => {
    $(document).on('click', '.group_select', function () {
        const groupId = $(this).data('id');
        openGroupById(groupId);
    });
    $('#rm_group_filter').on('input', filterGroupMembers);
    $('#rm_group_submit').on('click', createGroup);
    $('#rm_group_scenario').on('click', setScenarioOverride);
    $('#rm_group_automode').on('input', function () {
        const value = $(this).prop('checked');
        is_group_automode_enabled = value;
        eventSource.once(event_types.GENERATION_STOPPED, stopAutoModeGeneration);
    });
    $('#rm_group_hidemutedsprites').on('input', function () {
        const value = $(this).prop('checked');
        hideMutedSprites = value;
        onHideMutedSpritesClick(value);

    });
    $('#send_textarea').on('keyup', onSendTextareaInput);
    $('#groupCurrentMemberPopoutButton').on('click', doCurMemberListPopout);
    $('#rm_group_chat_name').on('input', onGroupNameInput);
    $('#rm_group_delete').off().on('click', onDeleteGroupClick);
    $('#group_favorite_button').on('click', onFavoriteGroupClick);
    $('#rm_group_allow_self_responses').on('input', onGroupSelfResponsesClick);
    $('#rm_group_activation_strategy').on('change', onGroupActivationStrategyInput);
    $('#rm_group_generation_mode').on('change', onGroupGenerationModeInput);
    $('#rm_group_automode_delay').on('input', onGroupAutoModeDelayInput);
    $('#group_avatar_button').on('input', uploadGroupAvatar);
    $('#rm_group_restore_avatar').on('click', restoreGroupAvatar);
    $(document).on('click', '.group_member .right_menu_button', onGroupActionClick);
});
