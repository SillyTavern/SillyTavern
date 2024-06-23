import {
    animation_duration,
    chat_metadata,
    eventSource,
    event_types,
    extension_prompt_roles,
    saveSettingsDebounced,
    this_chid,
} from '../script.js';
import { selected_group } from './group-chats.js';
import { extension_settings, getContext, saveMetadataDebounced } from './extensions.js';
import { getCharaFilename, debounce, delay } from './utils.js';
import { getTokenCountAsync } from './tokenizers.js';
import { debounce_timeout } from './constants.js';
import { SlashCommandParser } from './slash-commands/SlashCommandParser.js';
import { SlashCommand } from './slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument } from './slash-commands/SlashCommandArgument.js';
export { MODULE_NAME as NOTE_MODULE_NAME };

const MODULE_NAME = '2_floating_prompt'; // <= Deliberate, for sorting lower than memory

export var shouldWIAddPrompt = false;

export const metadata_keys = {
    prompt: 'note_prompt',
    interval: 'note_interval',
    depth: 'note_depth',
    position: 'note_position',
    role: 'note_role',
};

const chara_note_position = {
    replace: 0,
    before: 1,
    after: 2,
};

function setNoteTextCommand(_, text) {
    $('#extension_floating_prompt').val(text).trigger('input');
    toastr.success('Author\'s Note text updated');
    return '';
}

function setNoteDepthCommand(_, text) {
    const value = Number(text);

    if (Number.isNaN(value)) {
        toastr.error('Not a valid number');
        return;
    }

    $('#extension_floating_depth').val(Math.abs(value)).trigger('input');
    toastr.success('Author\'s Note depth updated');
    return '';
}

function setNoteIntervalCommand(_, text) {
    const value = Number(text);

    if (Number.isNaN(value)) {
        toastr.error('Not a valid number');
        return;
    }

    $('#extension_floating_interval').val(Math.abs(value)).trigger('input');
    toastr.success('Author\'s Note frequency updated');
    return '';
}

function setNotePositionCommand(_, text) {
    const validPositions = {
        'scenario': 0,
        'chat': 1,
    };

    const position = validPositions[text?.trim()];

    if (Number.isNaN(position)) {
        toastr.error('Not a valid position');
        return;
    }

    $(`input[name="extension_floating_position"][value="${position}"]`).prop('checked', true).trigger('input');
    toastr.info('Author\'s Note position updated');
    return '';
}

function updateSettings() {
    saveSettingsDebounced();
    loadSettings();
    setFloatingPrompt();
}

const setMainPromptTokenCounterDebounced = debounce(async (value) => $('#extension_floating_prompt_token_counter').text(await getTokenCountAsync(value)), debounce_timeout.relaxed);
const setCharaPromptTokenCounterDebounced = debounce(async (value) => $('#extension_floating_chara_token_counter').text(await getTokenCountAsync(value)), debounce_timeout.relaxed);
const setDefaultPromptTokenCounterDebounced = debounce(async (value) => $('#extension_floating_default_token_counter').text(await getTokenCountAsync(value)), debounce_timeout.relaxed);

async function onExtensionFloatingPromptInput() {
    chat_metadata[metadata_keys.prompt] = $(this).val();
    setMainPromptTokenCounterDebounced(chat_metadata[metadata_keys.prompt]);
    updateSettings();
    saveMetadataDebounced();
}

async function onExtensionFloatingIntervalInput() {
    chat_metadata[metadata_keys.interval] = Number($(this).val());
    updateSettings();
    saveMetadataDebounced();
}

async function onExtensionFloatingDepthInput() {
    let value = Number($(this).val());

    if (value < 0) {
        value = Math.abs(value);
        $(this).val(value);
    }

    chat_metadata[metadata_keys.depth] = value;
    updateSettings();
    saveMetadataDebounced();
}

async function onExtensionFloatingPositionInput(e) {
    chat_metadata[metadata_keys.position] = Number(e.target.value);
    updateSettings();
    saveMetadataDebounced();
}

async function onDefaultPositionInput(e) {
    extension_settings.note.defaultPosition = Number(e.target.value);
    saveSettingsDebounced();
}

async function onDefaultDepthInput() {
    let value = Number($(this).val());

    if (value < 0) {
        value = Math.abs(value);
        $(this).val(value);
    }

    extension_settings.note.defaultDepth = value;
    saveSettingsDebounced();
}

async function onDefaultIntervalInput() {
    extension_settings.note.defaultInterval = Number($(this).val());
    saveSettingsDebounced();
}

function onExtensionFloatingRoleInput(e) {
    chat_metadata[metadata_keys.role] = Number(e.target.value);
    updateSettings();
}

function onExtensionDefaultRoleInput(e) {
    extension_settings.note.defaultRole = Number(e.target.value);
    saveSettingsDebounced();
}

async function onExtensionFloatingCharPositionInput(e) {
    const value = e.target.value;
    const charaNote = extension_settings.note.chara.find((e) => e.name === getCharaFilename());

    if (charaNote) {
        charaNote.position = Number(value);
        updateSettings();
    }
}

function onExtensionFloatingCharaPromptInput() {
    const tempPrompt = $(this).val();
    const avatarName = getCharaFilename();
    let tempCharaNote = {
        name: avatarName,
        prompt: tempPrompt,
    };

    setCharaPromptTokenCounterDebounced(tempPrompt);

    let existingCharaNoteIndex;
    let existingCharaNote;

    if (extension_settings.note.chara) {
        existingCharaNoteIndex = extension_settings.note.chara.findIndex((e) => e.name === avatarName);
        existingCharaNote = extension_settings.note.chara[existingCharaNoteIndex];
    }

    if (tempPrompt.length === 0 &&
        extension_settings.note.chara &&
        existingCharaNote &&
        !existingCharaNote.useChara
    ) {
        extension_settings.note.chara.splice(existingCharaNoteIndex, 1);
    }
    else if (extension_settings.note.chara && existingCharaNote) {
        Object.assign(existingCharaNote, tempCharaNote);
    }
    else if (avatarName && tempPrompt.length > 0) {
        if (!extension_settings.note.chara) {
            extension_settings.note.chara = [];
        }
        Object.assign(tempCharaNote, { useChara: false, position: chara_note_position.replace });

        extension_settings.note.chara.push(tempCharaNote);
    } else {
        console.log('Character author\'s note error: No avatar name key could be found.');
        toastr.error('Something went wrong. Could not save character\'s author\'s note.');

        // Don't save settings if something went wrong
        return;
    }

    updateSettings();
}

function onExtensionFloatingCharaCheckboxChanged() {
    const value = !!$(this).prop('checked');
    const charaNote = extension_settings.note.chara.find((e) => e.name === getCharaFilename());

    if (charaNote) {
        charaNote.useChara = value;

        updateSettings();
    }
}

function onExtensionFloatingDefaultInput() {
    extension_settings.note.default = $(this).val();
    setDefaultPromptTokenCounterDebounced(extension_settings.note.default);
    updateSettings();
}

function loadSettings() {
    const DEFAULT_DEPTH = 4;
    const DEFAULT_POSITION = 1;
    const DEFAULT_INTERVAL = 1;
    const DEFAULT_ROLE = extension_prompt_roles.SYSTEM;

    if (extension_settings.note.defaultPosition === undefined) {
        extension_settings.note.defaultPosition = DEFAULT_POSITION;
    }

    if (extension_settings.note.defaultDepth === undefined) {
        extension_settings.note.defaultDepth = DEFAULT_DEPTH;
    }

    if (extension_settings.note.defaultInterval === undefined) {
        extension_settings.note.defaultInterval = DEFAULT_INTERVAL;
    }

    if (extension_settings.note.defaultRole === undefined) {
        extension_settings.note.defaultRole = DEFAULT_ROLE;
    }

    chat_metadata[metadata_keys.prompt] = chat_metadata[metadata_keys.prompt] ?? extension_settings.note.default ?? '';
    chat_metadata[metadata_keys.interval] = chat_metadata[metadata_keys.interval] ?? extension_settings.note.defaultInterval ?? DEFAULT_INTERVAL;
    chat_metadata[metadata_keys.position] = chat_metadata[metadata_keys.position] ?? extension_settings.note.defaultPosition ?? DEFAULT_POSITION;
    chat_metadata[metadata_keys.depth] = chat_metadata[metadata_keys.depth] ?? extension_settings.note.defaultDepth ?? DEFAULT_DEPTH;
    chat_metadata[metadata_keys.role] = chat_metadata[metadata_keys.role] ?? extension_settings.note.defaultRole ?? DEFAULT_ROLE;
    $('#extension_floating_prompt').val(chat_metadata[metadata_keys.prompt]);
    $('#extension_floating_interval').val(chat_metadata[metadata_keys.interval]);
    $('#extension_floating_allow_wi_scan').prop('checked', extension_settings.note.allowWIScan ?? false);
    $('#extension_floating_depth').val(chat_metadata[metadata_keys.depth]);
    $('#extension_floating_role').val(chat_metadata[metadata_keys.role]);
    $(`input[name="extension_floating_position"][value="${chat_metadata[metadata_keys.position]}"]`).prop('checked', true);

    if (extension_settings.note.chara && getContext().characterId) {
        const charaNote = extension_settings.note.chara.find((e) => e.name === getCharaFilename());

        $('#extension_floating_chara').val(charaNote ? charaNote.prompt : '');
        $('#extension_use_floating_chara').prop('checked', charaNote ? charaNote.useChara : false);
        $(`input[name="extension_floating_char_position"][value="${charaNote?.position ?? chara_note_position.replace}"]`).prop('checked', true);
    } else {
        $('#extension_floating_chara').val('');
        $('#extension_use_floating_chara').prop('checked', false);
        $(`input[name="extension_floating_char_position"][value="${chara_note_position.replace}"]`).prop('checked', true);
    }

    $('#extension_floating_default').val(extension_settings.note.default);
    $('#extension_default_depth').val(extension_settings.note.defaultDepth);
    $('#extension_default_interval').val(extension_settings.note.defaultInterval);
    $('#extension_default_role').val(extension_settings.note.defaultRole);
    $(`input[name="extension_default_position"][value="${extension_settings.note.defaultPosition}"]`).prop('checked', true);
}

export function setFloatingPrompt() {
    const context = getContext();
    if (!context.groupId && context.characterId === undefined) {
        console.debug('setFloatingPrompt: Not in a chat. Skipping.');
        shouldWIAddPrompt = false;
        return;
    }

    // take the count of messages
    let lastMessageNumber = Array.isArray(context.chat) && context.chat.length ? context.chat.filter(m => m.is_user).length : 0;

    console.debug(`
    setFloatingPrompt entered
    ------
    lastMessageNumber = ${lastMessageNumber}
    metadata_keys.interval = ${chat_metadata[metadata_keys.interval]}
    metadata_keys.position = ${chat_metadata[metadata_keys.position]}
    metadata_keys.depth = ${chat_metadata[metadata_keys.depth]}
    metadata_keys.role = ${chat_metadata[metadata_keys.role]}
    ------
    `);

    // interval 1 should be inserted no matter what
    if (chat_metadata[metadata_keys.interval] === 1) {
        lastMessageNumber = 1;
    }

    if (lastMessageNumber <= 0 || chat_metadata[metadata_keys.interval] <= 0) {
        context.setExtensionPrompt(MODULE_NAME, '');
        $('#extension_floating_counter').text('(disabled)');
        shouldWIAddPrompt = false;
        return;
    }

    const messagesTillInsertion = lastMessageNumber >= chat_metadata[metadata_keys.interval]
        ? (lastMessageNumber % chat_metadata[metadata_keys.interval])
        : (chat_metadata[metadata_keys.interval] - lastMessageNumber);
    const shouldAddPrompt = messagesTillInsertion == 0;
    shouldWIAddPrompt = shouldAddPrompt;

    let prompt = shouldAddPrompt ? $('#extension_floating_prompt').val() : '';
    if (shouldAddPrompt && extension_settings.note.chara && getContext().characterId) {
        const charaNote = extension_settings.note.chara.find((e) => e.name === getCharaFilename());

        // Only replace with the chara note if the user checked the box
        if (charaNote && charaNote.useChara) {
            switch (charaNote.position) {
                case chara_note_position.before:
                    prompt = charaNote.prompt + '\n' + prompt;
                    break;
                case chara_note_position.after:
                    prompt = prompt + '\n' + charaNote.prompt;
                    break;
                default:
                    prompt = charaNote.prompt;
                    break;
            }
        }
    }
    context.setExtensionPrompt(
        MODULE_NAME,
        prompt,
        chat_metadata[metadata_keys.position],
        chat_metadata[metadata_keys.depth],
        extension_settings.note.allowWIScan,
        chat_metadata[metadata_keys.role],
    );
    $('#extension_floating_counter').text(shouldAddPrompt ? '0' : messagesTillInsertion);
}

function onANMenuItemClick() {
    if (selected_group || this_chid) {
        //show AN if it's hidden
        if ($('#floatingPrompt').css('display') !== 'flex') {
            $('#floatingPrompt').addClass('resizing');
            $('#floatingPrompt').css('display', 'flex');
            $('#floatingPrompt').css('opacity', 0.0);
            $('#floatingPrompt').transition({
                opacity: 1.0,
                duration: animation_duration,
            }, async function () {
                await delay(50);
                $('#floatingPrompt').removeClass('resizing');
            });

            //auto-open the main AN inline drawer
            if ($('#ANBlockToggle')
                .siblings('.inline-drawer-content')
                .css('display') !== 'block') {
                $('#floatingPrompt').addClass('resizing');
                $('#ANBlockToggle').click();
            }
        } else {
            //hide AN if it's already displayed
            $('#floatingPrompt').addClass('resizing');
            $('#floatingPrompt').transition({
                opacity: 0.0,
                duration: animation_duration,
            },
            async function () {
                await delay(50);
                $('#floatingPrompt').removeClass('resizing');
            });
            setTimeout(function () {
                $('#floatingPrompt').hide();
            }, animation_duration);

        }
        //duplicate options menu close handler from script.js
        //because this listener takes priority
        $('#options').stop().fadeOut(animation_duration);
    } else {
        toastr.warning('Select a character before trying to use Author\'s Note', '', { timeOut: 2000 });
    }
}

async function onChatChanged() {
    loadSettings();
    setFloatingPrompt();
    const context = getContext();

    // Disable the chara note if in a group
    $('#extension_floating_chara').prop('disabled', context.groupId ? true : false);

    const tokenCounter1 = chat_metadata[metadata_keys.prompt] ? await getTokenCountAsync(chat_metadata[metadata_keys.prompt]) : 0;
    $('#extension_floating_prompt_token_counter').text(tokenCounter1);

    let tokenCounter2;
    if (extension_settings.note.chara && context.characterId) {
        const charaNote = extension_settings.note.chara.find((e) => e.name === getCharaFilename());

        if (charaNote) {
            tokenCounter2 = await getTokenCountAsync(charaNote.prompt);
        }
    }

    $('#extension_floating_chara_token_counter').text(tokenCounter2 || 0);

    const tokenCounter3 = extension_settings.note.default ? await getTokenCountAsync(extension_settings.note.default) : 0;
    $('#extension_floating_default_token_counter').text(tokenCounter3);
}

function onAllowWIScanCheckboxChanged() {
    extension_settings.note.allowWIScan = !!$(this).prop('checked');
    updateSettings();
}

/**
 * Inject author's note options and setup event listeners.
 */
// Inserts the extension first since it's statically imported
export function initAuthorsNote() {
    $('#extension_floating_prompt').on('input', onExtensionFloatingPromptInput);
    $('#extension_floating_interval').on('input', onExtensionFloatingIntervalInput);
    $('#extension_floating_depth').on('input', onExtensionFloatingDepthInput);
    $('#extension_floating_chara').on('input', onExtensionFloatingCharaPromptInput);
    $('#extension_use_floating_chara').on('input', onExtensionFloatingCharaCheckboxChanged);
    $('#extension_floating_default').on('input', onExtensionFloatingDefaultInput);
    $('#extension_default_depth').on('input', onDefaultDepthInput);
    $('#extension_default_interval').on('input', onDefaultIntervalInput);
    $('#extension_floating_allow_wi_scan').on('input', onAllowWIScanCheckboxChanged);
    $('#extension_floating_role').on('input', onExtensionFloatingRoleInput);
    $('#extension_default_role').on('input', onExtensionDefaultRoleInput);
    $('input[name="extension_floating_position"]').on('change', onExtensionFloatingPositionInput);
    $('input[name="extension_default_position"]').on('change', onDefaultPositionInput);
    $('input[name="extension_floating_char_position"]').on('change', onExtensionFloatingCharPositionInput);
    $('#ANClose').on('click', function () {
        $('#floatingPrompt').transition({
            opacity: 0,
            duration: animation_duration,
            easing: 'ease-in-out',
        });
        setTimeout(function () { $('#floatingPrompt').hide(); }, animation_duration);
    });
    $('#option_toggle_AN').on('click', onANMenuItemClick);

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'note',
        callback: setNoteTextCommand,
        unnamedArgumentList: [
            new SlashCommandArgument(
                'text', [ARGUMENT_TYPE.STRING], true,
            ),
        ],
        helpString: `
            <div>
                Sets an author's note for the currently selected chat.
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'depth',
        callback: setNoteDepthCommand,
        unnamedArgumentList: [
            new SlashCommandArgument(
                'number', [ARGUMENT_TYPE.NUMBER], true,
            ),
        ],
        helpString: `
            <div>
                Sets an author's note depth for in-chat positioning.
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'freq',
        callback: setNoteIntervalCommand,
        namedArgumentList: [],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'number', [ARGUMENT_TYPE.NUMBER], true,
            ),
        ],
        helpString: `
            <div>
                Sets an author's note insertion frequency.
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'pos',
        callback: setNotePositionCommand,
        namedArgumentList: [],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'position', [ARGUMENT_TYPE.STRING], true, false, null, ['chat', 'scenario'],
            ),
        ],
        helpString: `
            <div>
                Sets an author's note position.
            </div>
        `,
    }));
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
}
