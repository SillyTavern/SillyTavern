import {
    characters,
    chat,
    chat_metadata,
    default_avatar,
    eventSource,
    event_types,
    getRequestHeaders,
    getThumbnailUrl,
    name1,
    reloadCurrentChat,
    saveChatConditional,
    saveMetadata,
    saveSettingsDebounced,
    setUserName,
    this_chid,
} from '../script.js';
import { persona_description_positions, power_user } from './power-user.js';
import { getTokenCountAsync } from './tokenizers.js';
import { PAGINATION_TEMPLATE, debounce, delay, download, ensureImageFormatSupported, flashHighlight, getBase64Async, parseJsonFile } from './utils.js';
import { debounce_timeout } from './constants.js';
import { FILTER_TYPES, FilterHelper } from './filters.js';
import { selected_group } from './group-chats.js';
import { POPUP_RESULT, POPUP_TYPE, Popup } from './popup.js';

let savePersonasPage = 0;
const GRID_STORAGE_KEY = 'Personas_GridView';
const DEFAULT_DEPTH = 2;
const DEFAULT_ROLE = 0;
export let user_avatar = '';
export const personasFilter = new FilterHelper(debounce(getUserAvatars, debounce_timeout.quick));

function switchPersonaGridView() {
    const state = localStorage.getItem(GRID_STORAGE_KEY) === 'true';
    $('#user_avatar_block').toggleClass('gridView', state);
}

/**
 * Returns the URL of the avatar for the given user avatar Id.
 * @param {string} avatarImg User avatar Id
 * @returns {string} User avatar URL
 */
export function getUserAvatar(avatarImg) {
    return `User Avatars/${avatarImg}`;
}

export function initUserAvatar(avatar) {
    user_avatar = avatar;
    reloadUserAvatar();
    highlightSelectedAvatar();
}

/**
 * Sets a user avatar file
 * @param {string} imgfile Link to an image file
 */
export function setUserAvatar(imgfile) {
    user_avatar = imgfile && typeof imgfile === 'string' ? imgfile : $(this).attr('imgfile');
    reloadUserAvatar();
    highlightSelectedAvatar();
    selectCurrentPersona();
    saveSettingsDebounced();
    $('.zoomed_avatar[forchar]').remove();
}

function highlightSelectedAvatar() {
    $('#user_avatar_block .avatar-container').removeClass('selected');
    $(`#user_avatar_block .avatar-container[imgfile="${user_avatar}"]`).addClass('selected');
}

function reloadUserAvatar(force = false) {
    $('.mes').each(function () {
        const avatarImg = $(this).find('.avatar img');
        if (force) {
            avatarImg.attr('src', avatarImg.attr('src'));
        }

        if ($(this).attr('is_user') == 'true' && $(this).attr('force_avatar') == 'false') {
            avatarImg.attr('src', getUserAvatar(user_avatar));
        }
    });
}

/**
 * Sort the given personas
 * @param {string[]} personas - The persona names to sort
 * @returns {string[]} The sorted persona names arrray, same reference as passed in
 */
function sortPersonas(personas) {
    const option = $('#persona_sort_order').find(':selected');
    if (option.attr('value') === 'search') {
        personas.sort((a, b) => {
            const aScore = personasFilter.getScore(FILTER_TYPES.PERSONA_SEARCH, a);
            const bScore = personasFilter.getScore(FILTER_TYPES.PERSONA_SEARCH, b);
            return (aScore - bScore);
        });
    } else {
        personas.sort((a, b) => {
            const aName = String(power_user.personas[a] || a);
            const bName = String(power_user.personas[b] || b);
            return power_user.persona_sort_order === 'asc' ? aName.localeCompare(bName) : bName.localeCompare(aName);
        });
    }

    return personas;
}

/** Checks the state of the current search, and adds/removes the search sorting option accordingly */
function verifyPersonaSearchSortRule() {
    const searchTerm = personasFilter.getFilterData(FILTER_TYPES.PERSONA_SEARCH);
    const searchOption = $('#persona_sort_order option[value="search"]');
    const selector = $('#persona_sort_order');
    const isHidden = searchOption.attr('hidden') !== undefined;

    // If we have a search term, we are displaying the sorting option for it
    if (searchTerm && isHidden) {
        searchOption.removeAttr('hidden');
        selector.val(searchOption.attr('value'));
        flashHighlight(selector);
    }
    // If search got cleared, we make sure to hide the option and go back to the one before
    if (!searchTerm) {
        searchOption.attr('hidden', '');
        selector.val(power_user.persona_sort_order);
    }
}

/**
 * Gets a rendered avatar block.
 * @param {string} name Avatar file name
 * @returns {JQuery<HTMLElement>} Avatar block
 */
function getUserAvatarBlock(name) {
    const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
    const template = $('#user_avatar_template .avatar-container').clone();
    const personaName = power_user.personas[name];
    const personaDescription = power_user.persona_descriptions[name]?.description;
    template.find('.ch_name').text(personaName || '[Unnamed Persona]');
    template.find('.ch_description').text(personaDescription || $('#user_avatar_block').attr('no_desc_text')).toggleClass('text_muted', !personaDescription);
    template.attr('imgfile', name);
    template.find('.avatar').attr('imgfile', name).attr('title', name);
    template.toggleClass('default_persona', name === power_user.default_persona);
    let avatarUrl = getUserAvatar(name);
    if (isFirefox) {
        avatarUrl += '?t=' + Date.now();
    }
    template.find('img').attr('src', avatarUrl);
    $('#user_avatar_block').append(template);
    return template;
}

/**
 * Gets a list of user avatars.
 * @param {boolean} doRender Whether to render the list
 * @param {string} openPageAt Item to be opened at
 * @returns {Promise<string[]>} List of avatar file names
 */
export async function getUserAvatars(doRender = true, openPageAt = '') {
    const response = await fetch('/api/avatars/get', {
        method: 'POST',
        headers: getRequestHeaders(),
    });
    if (response.ok) {
        const allEntities = await response.json();

        if (!Array.isArray(allEntities)) {
            return [];
        }

        if (!doRender) {
            return allEntities;
        }

        // Before printing the personas, we check if we should enable/disable search sorting
        verifyPersonaSearchSortRule();

        let entities = personasFilter.applyFilters(allEntities);
        entities = sortPersonas(entities);

        const storageKey = 'Personas_PerPage';
        const listId = '#user_avatar_block';
        const perPage = Number(localStorage.getItem(storageKey)) || 5;

        $('#persona_pagination_container').pagination({
            dataSource: entities,
            pageSize: perPage,
            sizeChangerOptions: [5, 10, 25, 50, 100, 250, 500, 1000],
            pageRange: 1,
            pageNumber: savePersonasPage || 1,
            position: 'top',
            showPageNumbers: false,
            showSizeChanger: true,
            prevText: '<',
            nextText: '>',
            formatNavigator: PAGINATION_TEMPLATE,
            showNavigator: true,
            callback: function (data) {
                $(listId).empty();
                for (const item of data) {
                    $(listId).append(getUserAvatarBlock(item));
                }
                highlightSelectedAvatar();
            },
            afterSizeSelectorChange: function (e) {
                localStorage.setItem(storageKey, e.target.value);
            },
            afterPaging: function (e) {
                savePersonasPage = e;
            },
            afterRender: function () {
                $(listId).scrollTop(0);
            },
        });

        if (openPageAt) {
            const avatarIndex = entities.indexOf(openPageAt);
            const page = Math.floor(avatarIndex / perPage) + 1;

            if (avatarIndex !== -1) {
                $('#persona_pagination_container').pagination('go', page);
            }
        }

        return allEntities;
    }
}

/**
 * Uploads an avatar file to the server
 * @param {string} url URL for the avatar file
 * @param {string} [name] Optional name for the avatar file
 * @returns {Promise} Promise object representing the AJAX request
 */
async function uploadUserAvatar(url, name) {
    const fetchResult = await fetch(url);
    const blob = await fetchResult.blob();
    const file = new File([blob], 'avatar.png', { type: 'image/png' });
    const formData = new FormData();
    formData.append('avatar', file);

    if (name) {
        formData.append('overwrite_name', name);
    }

    return jQuery.ajax({
        type: 'POST',
        url: '/api/avatars/upload',
        data: formData,
        beforeSend: () => { },
        cache: false,
        contentType: false,
        processData: false,
        success: async function () {
            await getUserAvatars(true, name);
        },
    });
}

async function changeUserAvatar(e) {
    const form = document.getElementById('form_upload_avatar');

    if (!(form instanceof HTMLFormElement)) {
        console.error('Form not found');
        return;
    }

    const file = e.target.files[0];

    if (!file) {
        form.reset();
        return;
    }

    const formData = new FormData(form);
    const dataUrl = await getBase64Async(file);
    let url = '/api/avatars/upload';

    if (!power_user.never_resize_avatars) {
        const dlg = new Popup('Set the crop position of the avatar image', POPUP_TYPE.CROP, '', { cropImage: dataUrl });
        const result = await dlg.show();

        if (!result) {
            return;
        }

        if (dlg.cropData !== undefined) {
            url += `?crop=${encodeURIComponent(JSON.stringify(dlg.cropData))}`;
        }
    }

    const rawFile = formData.get('avatar');
    if (rawFile instanceof File) {
        const convertedFile = await ensureImageFormatSupported(rawFile);
        formData.set('avatar', convertedFile);
    }

    jQuery.ajax({
        type: 'POST',
        url: url,
        data: formData,
        beforeSend: () => { },
        cache: false,
        contentType: false,
        processData: false,
        success: async function (data) {
            // If the user uploaded a new avatar, we want to make sure it's not cached
            const name = formData.get('overwrite_name');
            if (name) {
                await fetch(getUserAvatar(String(name)), { cache: 'no-cache' });
                reloadUserAvatar(true);
            }

            if (!name && data.path) {
                await getUserAvatars();
                await delay(500);
                await createPersona(data.path);
            }

            await getUserAvatars(true, name || data.path);
        },
        error: (jqXHR, exception) => { },
    });

    // Will allow to select the same file twice in a row
    form.reset();
}

/**
 * Prompts the user to create a persona for the uploaded avatar.
 * @param {string} avatarId User avatar id
 * @returns {Promise} Promise that resolves when the persona is set
 */
export async function createPersona(avatarId) {
    const personaName = await Popup.show.input('Enter a name for this persona:', 'Cancel if you\'re just uploading an avatar.', '');

    if (!personaName) {
        console.debug('User cancelled creating a persona');
        return;
    }

    const personaDescription = await Popup.show.input('Enter a description for this persona:', 'You can always add or change it later.', '', { rows: 4 });

    initPersona(avatarId, personaName, personaDescription);
    if (power_user.persona_show_notifications) {
        toastr.success(`You can now pick ${personaName} as a persona in the Persona Management menu.`, 'Persona Created');
    }
}

async function createDummyPersona() {
    const personaName = await Popup.show.input('Enter a name for this persona:', null);

    if (!personaName) {
        console.debug('User cancelled creating dummy persona');
        return;
    }

    // Date + name (only ASCII) to make it unique
    const avatarId = `${Date.now()}-${personaName.replace(/[^a-zA-Z0-9]/g, '')}.png`;
    initPersona(avatarId, personaName, '');
    await uploadUserAvatar(default_avatar, avatarId);
}

/**
 * Initializes a persona for the given avatar id.
 * @param {string} avatarId User avatar id
 * @param {string} personaName Name for the persona
 * @param {string} personaDescription Optional description for the persona
 * @returns {void}
 */
export function initPersona(avatarId, personaName, personaDescription) {
    power_user.personas[avatarId] = personaName;
    power_user.persona_descriptions[avatarId] = {
        description: personaDescription || '',
        position: persona_description_positions.IN_PROMPT,
        depth: DEFAULT_DEPTH,
        role: DEFAULT_ROLE,
    };

    saveSettingsDebounced();
}

export async function convertCharacterToPersona(characterId = null) {
    if (null === characterId) characterId = this_chid;

    const avatarUrl = characters[characterId]?.avatar;
    if (!avatarUrl) {
        console.log('No avatar found for this character');
        return;
    }

    const name = characters[characterId]?.name;
    let description = characters[characterId]?.description;
    const overwriteName = `${name} (Persona).png`;

    if (overwriteName in power_user.personas) {
        const confirm = await Popup.show.confirm('Overwrite Existing Persona', 'This character exists as a persona already. Do you want to overwrite it?');
        if (!confirm) {
            console.log('User cancelled the overwrite of the persona');
            return;
        }
    }

    if (description.includes('{{char}}') || description.includes('{{user}}')) {
        const confirm = await Popup.show.confirm('Persona Description Macros', 'This character has a description that uses <code>{{char}}</code> or <code>{{user}}</code> macros. Do you want to swap them in the persona description?');
        if (confirm) {
            description = description.replace(/{{char}}/gi, '{{personaChar}}').replace(/{{user}}/gi, '{{personaUser}}');
            description = description.replace(/{{personaUser}}/gi, '{{char}}').replace(/{{personaChar}}/gi, '{{user}}');
        }
    }

    const thumbnailAvatar = getThumbnailUrl('avatar', avatarUrl);
    await uploadUserAvatar(thumbnailAvatar, overwriteName);

    power_user.personas[overwriteName] = name;
    power_user.persona_descriptions[overwriteName] = {
        description: description,
        position: persona_description_positions.IN_PROMPT,
        depth: DEFAULT_DEPTH,
        role: DEFAULT_ROLE,
    };

    // If the user is currently using this persona, update the description
    if (user_avatar === overwriteName) {
        power_user.persona_description = description;
    }

    saveSettingsDebounced();

    console.log('Persona for character created');
    toastr.success(`You can now select ${name} as a persona in the Persona Management menu.`, 'Persona Created');

    // Refresh the persona selector
    await getUserAvatars(true, overwriteName);
    // Reload the persona description
    setPersonaDescription();
}

/**
 * Counts the number of tokens in a persona description.
 */
const countPersonaDescriptionTokens = debounce(async () => {
    const description = String($('#persona_description').val());
    const count = await getTokenCountAsync(description);
    $('#persona_description_token_count').text(String(count));
}, debounce_timeout.relaxed);

export function setPersonaDescription() {
    if (power_user.persona_description_position === persona_description_positions.AFTER_CHAR) {
        power_user.persona_description_position = persona_description_positions.IN_PROMPT;
    }

    $('#persona_depth_position_settings').toggle(power_user.persona_description_position === persona_description_positions.AT_DEPTH);
    $('#persona_description').val(power_user.persona_description);
    $('#persona_depth_value').val(power_user.persona_description_depth ?? DEFAULT_DEPTH);
    $('#persona_description_position')
        .val(power_user.persona_description_position)
        .find(`option[value="${power_user.persona_description_position}"]`)
        .attr('selected', String(true));
    $('#persona_depth_role')
        .val(power_user.persona_description_role)
        .find(`option[value="${power_user.persona_description_role}"]`)
        .prop('selected', String(true));
    countPersonaDescriptionTokens();
}

export function autoSelectPersona(name) {
    for (const [key, value] of Object.entries(power_user.personas)) {
        if (value === name) {
            console.log(`Auto-selecting persona ${key} for name ${name}`);
            setUserAvatar(key);
            return;
        }
    }
}

/**
 * Updates the name of a persona if it exists.
 * @param {string} avatarId User avatar id
 * @param {string} newName New name for the persona
 */
async function updatePersonaNameIfExists(avatarId, newName) {
    if (avatarId in power_user.personas) {
        power_user.personas[avatarId] = newName;
        console.log(`Updated persona name for ${avatarId} to ${newName}`);
    } else {
        power_user.personas[avatarId] = newName;
        power_user.persona_descriptions[avatarId] = {
            description: '',
            position: persona_description_positions.IN_PROMPT,
            depth: DEFAULT_DEPTH,
            role: DEFAULT_ROLE,
        };
        console.log(`Created persona name for ${avatarId} as ${newName}`);
    }

    await getUserAvatars(true, avatarId);
    saveSettingsDebounced();
}

async function bindUserNameToPersona(e) {
    e?.stopPropagation();
    const avatarId = $(this).closest('.avatar-container').find('.avatar').attr('imgfile');

    if (!avatarId) {
        console.warn('No avatar id found');
        return;
    }

    let personaUnbind = false;
    const existingPersona = power_user.personas[avatarId];
    const personaName = await Popup.show.input(
        'Enter a name for this persona:',
        '(If empty name is provided, this will unbind the name from this avatar)',
        existingPersona || '',
        { onClose: (p) => { personaUnbind = p.value === '' && p.result === POPUP_RESULT.AFFIRMATIVE; } });

    // If the user clicked cancel, don't do anything
    if (personaName === null && !personaUnbind) {
        return;
    }

    if (personaName && personaName.length > 0) {
        // If the user clicked ok and entered a name, bind the name to the persona
        console.log(`Binding persona ${avatarId} to name ${personaName}`);
        power_user.personas[avatarId] = personaName;
        const descriptor = power_user.persona_descriptions[avatarId];
        const isCurrentPersona = avatarId === user_avatar;

        // Create a description object if it doesn't exist
        if (!descriptor) {
            // If the user is currently using this persona, set the description to the current description
            power_user.persona_descriptions[avatarId] = {
                description: isCurrentPersona ? power_user.persona_description : '',
                position: isCurrentPersona ? power_user.persona_description_position : persona_description_positions.IN_PROMPT,
                depth: isCurrentPersona ? power_user.persona_description_depth : DEFAULT_DEPTH,
                role: isCurrentPersona ? power_user.persona_description_role : DEFAULT_ROLE,
            };
        }

        // If the user is currently using this persona, update the name
        if (isCurrentPersona) {
            console.log(`Auto-updating user name to ${personaName}`);
            setUserName(personaName);
        }
    } else {
        // If the user clicked ok, but didn't enter a name, delete the persona
        console.log(`Unbinding persona ${avatarId}`);
        delete power_user.personas[avatarId];
        delete power_user.persona_descriptions[avatarId];
    }

    saveSettingsDebounced();
    await getUserAvatars(true, avatarId);
    setPersonaDescription();
}

function selectCurrentPersona() {
    const personaName = power_user.personas[user_avatar];
    if (personaName) {
        const lockedPersona = chat_metadata['persona'];
        if (lockedPersona && lockedPersona !== user_avatar && power_user.persona_show_notifications) {
            toastr.info(
                `To permanently set "${personaName}" as the selected persona, unlock and relock it using the "Lock" button. Otherwise, the selection resets upon reloading the chat.`,
                `This chat is locked to a different persona (${power_user.personas[lockedPersona]}).`,
                { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true },
            );
        }

        if (personaName !== name1) {
            console.log(`Auto-updating user name to ${personaName}`);
            setUserName(personaName);
        }

        const descriptor = power_user.persona_descriptions[user_avatar];

        if (descriptor) {
            power_user.persona_description = descriptor.description ?? '';
            power_user.persona_description_position = descriptor.position ?? persona_description_positions.IN_PROMPT;
            power_user.persona_description_depth = descriptor.depth ?? DEFAULT_DEPTH;
            power_user.persona_description_role = descriptor.role ?? DEFAULT_ROLE;
        } else {
            power_user.persona_description = '';
            power_user.persona_description_position = persona_description_positions.IN_PROMPT;
            power_user.persona_description_depth = DEFAULT_DEPTH;
            power_user.persona_description_role = DEFAULT_ROLE;
            power_user.persona_descriptions[user_avatar] = { description: '', position: persona_description_positions.IN_PROMPT, depth: DEFAULT_DEPTH, role: DEFAULT_ROLE };
        }

        setPersonaDescription();
    }
}

/**
 * Checks if the persona is locked for the current chat.
 * @returns {boolean} Whether the persona is locked
 */
function isPersonaLocked() {
    return !!chat_metadata['persona'];
}

/**
 * Locks or unlocks the persona for the current chat.
 * @param {boolean} state Desired lock state
 * @returns {Promise<void>}
 */
export async function setPersonaLockState(state) {
    return state ? await lockPersona() : await unlockPersona();
}

/**
 * Toggle the persona lock state for the current chat.
 * @returns {Promise<void>}
 */
export async function togglePersonaLock() {
    return isPersonaLocked()
        ? await unlockPersona()
        : await lockPersona();
}

/**
 * Unlock the persona for the current chat.
 */
async function unlockPersona() {
    if (chat_metadata['persona']) {
        console.log(`Unlocking persona for this chat ${chat_metadata['persona']}`);
        delete chat_metadata['persona'];
        await saveMetadata();
        if (power_user.persona_show_notifications) {
            toastr.info('User persona is now unlocked for this chat. Click the "Lock" again to revert.', 'Persona unlocked');
        }
        updateUserLockIcon();
    }
}

/**
 * Lock the persona for the current chat.
 */
async function lockPersona() {
    if (!(user_avatar in power_user.personas)) {
        console.log(`Creating a new persona ${user_avatar}`);
        if (power_user.persona_show_notifications) {
            toastr.info(
                'Creating a new persona for currently selected user name and avatar...',
                'Persona not set for this avatar',
                { timeOut: 10000, extendedTimeOut: 20000 },
            );
        }
        power_user.personas[user_avatar] = name1;
        power_user.persona_descriptions[user_avatar] = {
            description: '',
            position: persona_description_positions.IN_PROMPT,
            depth: DEFAULT_DEPTH,
            role: DEFAULT_ROLE,
        };
    }

    chat_metadata['persona'] = user_avatar;
    await saveMetadata();
    saveSettingsDebounced();
    console.log(`Locking persona for this chat ${user_avatar}`);
    if (power_user.persona_show_notifications) {
        toastr.success(`User persona is locked to ${name1} in this chat`);
    }
    updateUserLockIcon();
}


async function deleteUserAvatar(e) {
    e?.stopPropagation();
    const avatarId = $(this).closest('.avatar-container').find('.avatar').attr('imgfile');

    if (!avatarId) {
        console.warn('No avatar id found');
        return;
    }

    if (avatarId == user_avatar) {
        console.warn(`User tried to delete their current avatar ${avatarId}`);
        toastr.warning('You cannot delete the avatar you are currently using', 'Warning');
        return;
    }

    const confirm = await Popup.show.confirm('Are you sure you want to delete this avatar?', 'All information associated with its linked persona will be lost.');

    if (!confirm) {
        console.debug('User cancelled deleting avatar');
        return;
    }

    const request = await fetch('/api/avatars/delete', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            'avatar': avatarId,
        }),
    });

    if (request.ok) {
        console.log(`Deleted avatar ${avatarId}`);
        delete power_user.personas[avatarId];
        delete power_user.persona_descriptions[avatarId];

        if (avatarId === power_user.default_persona) {
            toastr.warning('The default persona was deleted. You will need to set a new default persona.', 'Default persona deleted');
            power_user.default_persona = null;
        }

        if (avatarId === chat_metadata['persona']) {
            toastr.warning('The locked persona was deleted. You will need to set a new persona for this chat.', 'Persona deleted');
            delete chat_metadata['persona'];
            await saveMetadata();
        }

        saveSettingsDebounced();
        await getUserAvatars();
        updateUserLockIcon();
    }
}

function onPersonaDescriptionInput() {
    power_user.persona_description = String($('#persona_description').val());
    countPersonaDescriptionTokens();

    if (power_user.personas[user_avatar]) {
        let object = power_user.persona_descriptions[user_avatar];

        if (!object) {
            object = {
                description: power_user.persona_description,
                position: Number($('#persona_description_position').find(':selected').val()),
                depth: Number($('#persona_depth_value').val()),
                role: Number($('#persona_depth_role').find(':selected').val()),
            };
            power_user.persona_descriptions[user_avatar] = object;
        }

        object.description = power_user.persona_description;
    }

    $(`.avatar-container[imgfile="${user_avatar}"] .ch_description`)
        .text(power_user.persona_description || $('#user_avatar_block').attr('no_desc_text'))
        .toggleClass('text_muted', !power_user.persona_description);
    saveSettingsDebounced();
}

function onPersonaDescriptionDepthValueInput() {
    power_user.persona_description_depth = Number($('#persona_depth_value').val());

    if (power_user.personas[user_avatar]) {
        const object = getOrCreatePersonaDescriptor();
        object.depth = power_user.persona_description_depth;
    }

    saveSettingsDebounced();
}

function onPersonaDescriptionDepthRoleInput() {
    power_user.persona_description_role = Number($('#persona_depth_role').find(':selected').val());

    if (power_user.personas[user_avatar]) {
        const object = getOrCreatePersonaDescriptor();
        object.role = power_user.persona_description_role;
    }

    saveSettingsDebounced();
}

function onPersonaDescriptionPositionInput() {
    power_user.persona_description_position = Number(
        $('#persona_description_position').find(':selected').val(),
    );

    if (power_user.personas[user_avatar]) {
        const object = getOrCreatePersonaDescriptor();
        object.position = power_user.persona_description_position;
    }

    saveSettingsDebounced();
    $('#persona_depth_position_settings').toggle(power_user.persona_description_position === persona_description_positions.AT_DEPTH);
}

function getOrCreatePersonaDescriptor() {
    let object = power_user.persona_descriptions[user_avatar];

    if (!object) {
        object = {
            description: power_user.persona_description,
            position: power_user.persona_description_position,
            depth: power_user.persona_description_depth,
            role: power_user.persona_description_role,
        };
        power_user.persona_descriptions[user_avatar] = object;
    }
    return object;
}

async function setDefaultPersona(e) {
    e?.stopPropagation();
    const avatarId = $(this).closest('.avatar-container').find('.avatar').attr('imgfile');

    if (!avatarId) {
        console.warn('No avatar id found');
        return;
    }

    const currentDefault = power_user.default_persona;

    if (power_user.personas[avatarId] === undefined) {
        console.warn(`No persona name found for avatar ${avatarId}`);
        toastr.warning('You must bind a name to this persona before you can set it as the default.', 'Persona name not set');
        return;
    }

    const personaName = power_user.personas[avatarId];

    if (avatarId === currentDefault) {
        const confirm = await Popup.show.confirm('Are you sure you want to remove the default persona?', personaName);

        if (!confirm) {
            console.debug('User cancelled removing default persona');
            return;
        }

        console.log(`Removing default persona ${avatarId}`);
        if (power_user.persona_show_notifications) {
            toastr.info('This persona will no longer be used by default when you open a new chat.', 'Default persona removed');
        }
        delete power_user.default_persona;
    } else {
        const confirm = await Popup.show.confirm(`Are you sure you want to set "${personaName}" as the default persona?`, 'This name and avatar will be used for all new chats, as well as existing chats where the user persona is not locked.');

        if (!confirm) {
            console.debug('User cancelled setting default persona');
            return;
        }

        power_user.default_persona = avatarId;
        if (power_user.persona_show_notifications) {
            toastr.success('This persona will be used by default when you open a new chat.', `Default persona set to ${personaName}`);
        }
    }

    saveSettingsDebounced();
    await getUserAvatars(true, avatarId);
}

function updateUserLockIcon() {
    const hasLock = !!chat_metadata['persona'];
    $('#lock_user_name').toggleClass('fa-unlock', !hasLock);
    $('#lock_user_name').toggleClass('fa-lock', hasLock);
}

async function setChatLockedPersona() {
    // Define a persona for this chat
    let chatPersona = '';

    if (chat_metadata['persona']) {
        // If persona is locked in chat metadata, select it
        console.log(`Using locked persona ${chat_metadata['persona']}`);
        chatPersona = chat_metadata['persona'];
    } else if (power_user.default_persona) {
        // If default persona is set, select it
        console.log(`Using default persona ${power_user.default_persona}`);
        chatPersona = power_user.default_persona;
    }

    // No persona set: user current settings
    if (!chatPersona) {
        console.debug('No default or locked persona set for this chat');
        return;
    }

    // Find the avatar file
    const userAvatars = await getUserAvatars(false);

    // Avatar missing (persona deleted)
    if (chat_metadata['persona'] && !userAvatars.includes(chatPersona)) {
        console.warn('Persona avatar not found, unlocking persona');
        delete chat_metadata['persona'];
        updateUserLockIcon();
        return;
    }

    // Default persona missing
    if (power_user.default_persona && !userAvatars.includes(power_user.default_persona)) {
        console.warn('Default persona avatar not found, clearing default persona');
        power_user.default_persona = null;
        saveSettingsDebounced();
        return;
    }

    // Persona avatar found, select it
    setUserAvatar(chatPersona);
    updateUserLockIcon();
}

function onBackupPersonas() {
    const timestamp = new Date().toISOString().split('T')[0].replace(/-/g, '');
    const filename = `personas_${timestamp}.json`;
    const data = JSON.stringify({
        'personas': power_user.personas,
        'persona_descriptions': power_user.persona_descriptions,
        'default_persona': power_user.default_persona,
    }, null, 2);

    const blob = new Blob([data], { type: 'application/json' });
    download(blob, filename, 'application/json');
}

async function onPersonasRestoreInput(e) {
    const file = e.target.files[0];

    if (!file) {
        console.debug('No file selected');
        return;
    }

    const data = await parseJsonFile(file);

    if (!data) {
        toastr.warning('Invalid file selected', 'Persona Management');
        console.debug('Invalid file selected');
        return;
    }

    if (!data.personas || !data.persona_descriptions || typeof data.personas !== 'object' || typeof data.persona_descriptions !== 'object') {
        toastr.warning('Invalid file format', 'Persona Management');
        console.debug('Invalid file selected');
        return;
    }

    const avatarsList = await getUserAvatars(false);
    const warnings = [];

    // Merge personas with existing ones
    for (const [key, value] of Object.entries(data.personas)) {
        if (key in power_user.personas) {
            warnings.push(`Persona "${key}" (${value}) already exists, skipping`);
            continue;
        }

        power_user.personas[key] = value;

        // If the avatar is missing, upload it
        if (!avatarsList.includes(key)) {
            warnings.push(`Persona image "${key}" (${value}) is missing, uploading default avatar`);
            await uploadUserAvatar(default_avatar, key);
        }
    }

    // Merge persona descriptions with existing ones
    for (const [key, value] of Object.entries(data.persona_descriptions)) {
        if (key in power_user.persona_descriptions) {
            warnings.push(`Persona description for "${key}" (${power_user.personas[key]}) already exists, skipping`);
            continue;
        }

        if (!power_user.personas[key]) {
            warnings.push(`Persona for "${key}" does not exist, skipping`);
            continue;
        }

        power_user.persona_descriptions[key] = value;
    }

    if (data.default_persona) {
        if (data.default_persona in power_user.personas) {
            power_user.default_persona = data.default_persona;
        } else {
            warnings.push(`Default persona "${data.default_persona}" does not exist, skipping`);
        }
    }

    if (warnings.length) {
        toastr.success('Personas restored with warnings. Check console for details.');
        console.warn(`PERSONA RESTORE REPORT\n====================\n${warnings.join('\n')}`);
    } else {
        toastr.success('Personas restored successfully.');
    }

    await getUserAvatars();
    setPersonaDescription();
    saveSettingsDebounced();
    $('#personas_restore_input').val('');
}

async function syncUserNameToPersona() {
    const confirmation = await Popup.show.confirm('Are you sure?', `All user-sent messages in this chat will be attributed to ${name1}.`);

    if (!confirmation) {
        return;
    }

    for (const mes of chat) {
        if (mes.is_user) {
            mes.name = name1;
            mes.force_avatar = getUserAvatar(user_avatar);
        }
    }

    await saveChatConditional();
    await reloadCurrentChat();
}

export function retriggerFirstMessageOnEmptyChat() {
    if (this_chid >= 0 && !selected_group && chat.length === 1) {
        $('#firstmessage_textarea').trigger('input');
    }
}

/**
 * Duplicates a persona.
 * @param {string} avatarId
 * @returns {Promise<void>}
 */
async function duplicatePersona(avatarId) {
    const personaName = power_user.personas[avatarId];

    if (!personaName) {
        toastr.warning('Chosen avatar is not a persona');
        return;
    }

    const confirm = await Popup.show.confirm('Are you sure you want to duplicate this persona?', personaName);

    if (!confirm) {
        console.debug('User cancelled duplicating persona');
        return;
    }

    const newAvatarId = `${Date.now()}-${personaName.replace(/[^a-zA-Z0-9]/g, '')}.png`;
    const descriptor = power_user.persona_descriptions[avatarId];

    power_user.personas[newAvatarId] = personaName;
    power_user.persona_descriptions[newAvatarId] = {
        description: descriptor?.description ?? '',
        position: descriptor?.position ?? persona_description_positions.IN_PROMPT,
        depth: descriptor?.depth ?? DEFAULT_DEPTH,
        role: descriptor?.role ?? DEFAULT_ROLE,
    };

    await uploadUserAvatar(getUserAvatar(avatarId), newAvatarId);
    await getUserAvatars(true, newAvatarId);
    saveSettingsDebounced();
}

export function initPersonas() {
    $(document).on('click', '.bind_user_name', bindUserNameToPersona);
    $(document).on('click', '.set_default_persona', setDefaultPersona);
    $(document).on('click', '.delete_avatar', deleteUserAvatar);
    $('#lock_user_name').on('click', togglePersonaLock);
    $('#create_dummy_persona').on('click', createDummyPersona);
    $('#persona_description').on('input', onPersonaDescriptionInput);
    $('#persona_description_position').on('input', onPersonaDescriptionPositionInput);
    $('#persona_depth_value').on('input', onPersonaDescriptionDepthValueInput);
    $('#persona_depth_role').on('input', onPersonaDescriptionDepthRoleInput);
    $('#personas_backup').on('click', onBackupPersonas);
    $('#personas_restore').on('click', () => $('#personas_restore_input').trigger('click'));
    $('#personas_restore_input').on('change', onPersonasRestoreInput);
    $('#persona_sort_order').val(power_user.persona_sort_order).on('input', function () {
        const value = String($(this).val());
        // Save sort order, but do not save search sorting, as this is a temporary sorting option
        if (value !== 'search') power_user.persona_sort_order = value;
        getUserAvatars(true, user_avatar);
        saveSettingsDebounced();
    });
    $('#persona_grid_toggle').on('click', () => {
        const state = localStorage.getItem(GRID_STORAGE_KEY) === 'true';
        localStorage.setItem(GRID_STORAGE_KEY, String(!state));
        switchPersonaGridView();
    });

    const debouncedPersonaSearch = debounce((searchQuery) => {
        personasFilter.setFilterData(FILTER_TYPES.PERSONA_SEARCH, searchQuery);
    });

    $('#persona_search_bar').on('input', function () {
        const searchQuery = String($(this).val());
        debouncedPersonaSearch(searchQuery);
    });

    $('#sync_name_button').on('click', syncUserNameToPersona);
    $('#avatar_upload_file').on('change', changeUserAvatar);

    $(document).on('click', '#user_avatar_block .avatar-container', function () {
        const imgfile = $(this).attr('imgfile');
        setUserAvatar(imgfile);

        // force firstMes {{user}} update on persona switch
        retriggerFirstMessageOnEmptyChat();
    });

    $('#your_name_button').click(async function () {
        const userName = String($('#your_name').val()).trim();
        setUserName(userName);
        await updatePersonaNameIfExists(user_avatar, userName);
        retriggerFirstMessageOnEmptyChat();
    });

    $(document).on('click', '#user_avatar_block .avatar_upload', function () {
        $('#avatar_upload_overwrite').val('');
        $('#avatar_upload_file').trigger('click');
    });

    $(document).on('click', '#user_avatar_block .duplicate_persona', function (e) {
        e.stopPropagation();
        const avatarId = $(this).closest('.avatar-container').find('.avatar').attr('imgfile');

        if (!avatarId) {
            console.log('no imgfile');
            return;
        }

        duplicatePersona(avatarId);
    });

    $(document).on('click', '#user_avatar_block .set_persona_image', function (e) {
        e.stopPropagation();
        const avatarId = $(this).closest('.avatar-container').find('.avatar').attr('imgfile');

        if (!avatarId) {
            console.log('no imgfile');
            return;
        }

        $('#avatar_upload_overwrite').val(avatarId);
        $('#avatar_upload_file').trigger('click');
    });

    eventSource.on('charManagementDropdown', (target) => {
        if (target === 'convert_to_persona') {
            convertCharacterToPersona();
        }
    });
    eventSource.on(event_types.CHAT_CHANGED, setChatLockedPersona);
    switchPersonaGridView();
}
