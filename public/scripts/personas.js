import {
    callPopup,
    characters,
    chat_metadata,
    default_avatar,
    eventSource,
    event_types,
    getRequestHeaders,
    getThumbnailUrl,
    getUserAvatars,
    name1,
    saveMetadata,
    saveSettingsDebounced,
    setUserName,
    this_chid,
    user_avatar,
} from '../script.js';
import { getContext } from './extensions.js';
import { persona_description_positions, power_user } from './power-user.js';
import { getTokenCount } from './tokenizers.js';
import { debounce, delay, download, parseJsonFile } from './utils.js';

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
        url: '/uploaduseravatar',
        data: formData,
        beforeSend: () => { },
        cache: false,
        contentType: false,
        processData: false,
        success: async function () {
            await getUserAvatars();
        },
    });
}

/**
 * Prompts the user to create a persona for the uploaded avatar.
 * @param {string} avatarId User avatar id
 * @returns {Promise} Promise that resolves when the persona is set
 */
export async function createPersona(avatarId) {
    const personaName = await callPopup('<h3>Enter a name for this persona:</h3>Cancel if you\'re just uploading an avatar.', 'input', '');

    if (!personaName) {
        console.debug('User cancelled creating a persona');
        return;
    }

    await delay(500);
    const personaDescription = await callPopup('<h3>Enter a description for this persona:</h3>You can always add or change it later.', 'input', '', { rows: 4 });

    initPersona(avatarId, personaName, personaDescription);
    if (power_user.persona_show_notifications) {
        toastr.success(`You can now pick ${personaName} as a persona in the Persona Management menu.`, 'Persona Created');
    }
}

async function createDummyPersona() {
    const personaName = await callPopup('<h3>Enter a name for this persona:</h3>', 'input', '');

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
        const confirmation = await callPopup('This character exists as a persona already. Are you sure want to overwrite it?', 'confirm', '', { okButton: 'Yes' });

        if (confirmation === false) {
            console.log('User cancelled the overwrite of the persona');
            return;
        }
    }

    if (description.includes('{{char}}') || description.includes('{{user}}')) {
        await delay(500);
        const confirmation = await callPopup('This character has a description that uses {{char}} or {{user}} macros. Do you want to swap them in the persona description?', 'confirm', '', { okButton: 'Yes' });

        if (confirmation) {
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
    };

    // If the user is currently using this persona, update the description
    if (user_avatar === overwriteName) {
        power_user.persona_description = description;
    }

    saveSettingsDebounced();

    console.log('Persona for character created');
    toastr.success(`You can now select ${name} as a persona in the Persona Management menu.`, 'Persona Created');

    // Refresh the persona selector
    await getUserAvatars();
    // Reload the persona description
    setPersonaDescription();
}

/**
 * Counts the number of tokens in a persona description.
 */
const countPersonaDescriptionTokens = debounce(() => {
    const description = String($('#persona_description').val());
    const count = getTokenCount(description);
    $('#persona_description_token_count').text(String(count));
}, 1000);

export function setPersonaDescription() {
    if (power_user.persona_description_position === persona_description_positions.AFTER_CHAR) {
        power_user.persona_description_position = persona_description_positions.IN_PROMPT;
    }

    $('#persona_description').val(power_user.persona_description);
    $('#persona_description_position')
        .val(power_user.persona_description_position)
        .find(`option[value='${power_user.persona_description_position}']`)
        .attr('selected', String(true));
    countPersonaDescriptionTokens();
}

export function autoSelectPersona(name) {
    for (const [key, value] of Object.entries(power_user.personas)) {
        if (value === name) {
            console.log(`Auto-selecting persona ${key} for name ${name}`);
            $(`.avatar[imgfile="${key}"]`).trigger('click');
            return;
        }
    }
}

/**
 * Updates the name of a persona if it exists.
 * @param {string} avatarId User avatar id
 * @param {string} newName New name for the persona
 */
export async function updatePersonaNameIfExists(avatarId, newName) {
    if (avatarId in power_user.personas) {
        power_user.personas[avatarId] = newName;
        await getUserAvatars();
        saveSettingsDebounced();
        console.log(`Updated persona name for ${avatarId} to ${newName}`);
    } else {
        console.log(`Persona name ${avatarId} was not updated because it does not exist`);
    }
}

async function bindUserNameToPersona() {
    const avatarId = $(this).closest('.avatar-container').find('.avatar').attr('imgfile');

    if (!avatarId) {
        console.warn('No avatar id found');
        return;
    }

    const existingPersona = power_user.personas[avatarId];
    const personaName = await callPopup('<h3>Enter a name for this persona:</h3>(If empty name is provided, this will unbind the name from this avatar)', 'input', existingPersona || '');

    // If the user clicked cancel, don't do anything
    if (personaName === false) {
        return;
    }

    if (personaName.length > 0) {
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
    await getUserAvatars();
    setPersonaDescription();
}

export function selectCurrentPersona() {
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
            power_user.persona_description = descriptor.description;
            power_user.persona_description_position = descriptor.position;
        } else {
            power_user.persona_description = '';
            power_user.persona_description_position = persona_description_positions.IN_PROMPT;
            power_user.persona_descriptions[user_avatar] = { description: '', position: persona_description_positions.IN_PROMPT };
        }

        setPersonaDescription();

        // force firstMes {{user}} update on persona switch
        const context = getContext();
        if (context.characterId >= 0 && !context.groupId && context.chat.length === 1) {
            $('#firstmessage_textarea').trigger('input');
        }
    }
}

async function lockUserNameToChat() {
    if (chat_metadata['persona']) {
        console.log(`Unlocking persona for this chat ${chat_metadata['persona']}`);
        delete chat_metadata['persona'];
        await saveMetadata();
        if (power_user.persona_show_notifications) {
            toastr.info('User persona is now unlocked for this chat. Click the "Lock" again to revert.', 'Persona unlocked');
        }
        updateUserLockIcon();
        return;
    }

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
        power_user.persona_descriptions[user_avatar] = { description: '', position: persona_description_positions.IN_PROMPT };
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

async function deleteUserAvatar() {
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

    const confirm = await callPopup('<h3>Are you sure you want to delete this avatar?</h3>All information associated with its linked persona will be lost.', 'confirm');

    if (!confirm) {
        console.debug('User cancelled deleting avatar');
        return;
    }

    const request = await fetch('/deleteuseravatar', {
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
            };
            power_user.persona_descriptions[user_avatar] = object;
        }

        object.description = power_user.persona_description;
    }

    saveSettingsDebounced();
}

function onPersonaDescriptionPositionInput() {
    power_user.persona_description_position = Number(
        $('#persona_description_position').find(':selected').val(),
    );

    if (power_user.personas[user_avatar]) {
        let object = power_user.persona_descriptions[user_avatar];

        if (!object) {
            object = {
                description: power_user.persona_description,
                position: power_user.persona_description_position,
            };
            power_user.persona_descriptions[user_avatar] = object;
        }

        object.position = power_user.persona_description_position;
    }

    saveSettingsDebounced();
}

async function setDefaultPersona() {
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
        const confirm = await callPopup('Are you sure you want to remove the default persona?', 'confirm');

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
        const confirm = await callPopup(`<h3>Are you sure you want to set "${personaName}" as the default persona?</h3>
        This name and avatar will be used for all new chats, as well as existing chats where the user persona is not locked.`, 'confirm');

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
    await getUserAvatars();
}

function updateUserLockIcon() {
    const hasLock = !!chat_metadata['persona'];
    $('#lock_user_name').toggleClass('fa-unlock', !hasLock);
    $('#lock_user_name').toggleClass('fa-lock', hasLock);
}

function setChatLockedPersona() {
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
    const personaAvatar = $(`.avatar[imgfile="${chatPersona}"]`).trigger('click');

    // Avatar missing (persona deleted)
    if (chat_metadata['persona'] && personaAvatar.length == 0) {
        console.warn('Persona avatar not found, unlocking persona');
        delete chat_metadata['persona'];
        updateUserLockIcon();
        return;
    }

    // Default persona missing
    if (power_user.default_persona && personaAvatar.length == 0) {
        console.warn('Default persona avatar not found, clearing default persona');
        power_user.default_persona = null;
        saveSettingsDebounced();
        return;
    }

    // Persona avatar found, select it
    personaAvatar.trigger('click');
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

    const avatarsList = await getUserAvatars();
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

export function initPersonas() {
    $(document).on('click', '.bind_user_name', bindUserNameToPersona);
    $(document).on('click', '.set_default_persona', setDefaultPersona);
    $(document).on('click', '.delete_avatar', deleteUserAvatar);
    $('#lock_user_name').on('click', lockUserNameToChat);
    $('#create_dummy_persona').on('click', createDummyPersona);
    $('#persona_description').on('input', onPersonaDescriptionInput);
    $('#persona_description_position').on('input', onPersonaDescriptionPositionInput);
    $('#personas_backup').on('click', onBackupPersonas);
    $('#personas_restore').on('click', () => $('#personas_restore_input').trigger('click'));
    $('#personas_restore_input').on('change', onPersonasRestoreInput);

    eventSource.on('charManagementDropdown', (target) => {
        if (target === 'convert_to_persona') {
            convertCharacterToPersona();
        }
    });
    eventSource.on(event_types.CHAT_CHANGED, setChatLockedPersona);
}
