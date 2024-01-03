import {
    animation_duration,
    chat_metadata,
    eventSource,
    event_types,
    saveSettingsDebounced,
    this_chid,
} from '../script.js';
import { selected_group } from './group-chats.js';
import { extension_settings, getContext, saveMetadataDebounced } from './extensions.js';
import { registerSlashCommand } from './slash-commands.js';
import { getCharaFilename, debounce, delay } from './utils.js';
import { getTokenCount } from './tokenizers.js';
export { MODULE_NAME as NOTE_MODULE_NAME };

const MODULE_NAME = '2_floating_prompt'; // <= Deliberate, for sorting lower than memory

export var shouldWIAddPrompt = false;

export const metadata_keys = {
    prompt: 'note_prompt',
    interval: 'note_interval',
    depth: 'note_depth',
    position: 'note_position',
};

const chara_note_position = {
    replace: 0,
    before: 1,
    after: 2,
};

function setNoteTextCommand(_, text) {
    $('#extension_floating_prompt').val(text).trigger('input');
    toastr.success('Author\'s Note text updated');
}

function setNoteDepthCommand(_, text) {
    const value = Number(text);

    if (Number.isNaN(value)) {
        toastr.error('Not a valid number');
        return;
    }

    $('#extension_floating_depth').val(Math.abs(value)).trigger('input');
    toastr.success('Author\'s Note depth updated');
}

function setNoteIntervalCommand(_, text) {
    const value = Number(text);

    if (Number.isNaN(value)) {
        toastr.error('Not a valid number');
        return;
    }

    $('#extension_floating_interval').val(Math.abs(value)).trigger('input');
    toastr.success('Author\'s Note frequency updated');
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
}

function updateSettings() {
    saveSettingsDebounced();
    loadSettings();
    setFloatingPrompt();
}

const setMainPromptTokenCounterDebounced = debounce((value) => $('#extension_floating_prompt_token_counter').text(getTokenCount(value)), 1000);
const setCharaPromptTokenCounterDebounced = debounce((value) => $('#extension_floating_chara_token_counter').text(getTokenCount(value)), 1000);
const setDefaultPromptTokenCounterDebounced = debounce((value) => $('#extension_floating_default_token_counter').text(getTokenCount(value)), 1000);

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
    chat_metadata[metadata_keys.position] = e.target.value;
    updateSettings();
    saveMetadataDebounced();
}

async function onDefaultPositionInput(e) {
    extension_settings.note.defaultPosition = e.target.value;
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

    if (extension_settings.note.defaultPosition === undefined) {
        extension_settings.note.defaultPosition = DEFAULT_POSITION;
    }

    if (extension_settings.note.defaultDepth === undefined) {
        extension_settings.note.defaultDepth = DEFAULT_DEPTH;
    }

    if (extension_settings.note.defaultInterval === undefined) {
        extension_settings.note.defaultInterval = DEFAULT_INTERVAL;
    }

    chat_metadata[metadata_keys.prompt] = chat_metadata[metadata_keys.prompt] ?? extension_settings.note.default ?? '';
    chat_metadata[metadata_keys.interval] = chat_metadata[metadata_keys.interval] ?? extension_settings.note.defaultInterval ?? DEFAULT_INTERVAL;
    chat_metadata[metadata_keys.position] = chat_metadata[metadata_keys.position] ?? extension_settings.note.defaultPosition ?? DEFAULT_POSITION;
    chat_metadata[metadata_keys.depth] = chat_metadata[metadata_keys.depth] ?? extension_settings.note.defaultDepth ?? DEFAULT_DEPTH;
    $('#extension_floating_prompt').val(chat_metadata[metadata_keys.prompt]);
    $('#extension_floating_interval').val(chat_metadata[metadata_keys.interval]);
    $('#extension_floating_allow_wi_scan').prop('checked', extension_settings.note.allowWIScan ?? false);
    $('#extension_floating_depth').val(chat_metadata[metadata_keys.depth]);
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
    context.setExtensionPrompt(MODULE_NAME, prompt, chat_metadata[metadata_keys.position], chat_metadata[metadata_keys.depth], extension_settings.note.allowWIScan);
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

function onChatChanged() {
    loadSettings();
    setFloatingPrompt();
    const context = getContext();

    // Disable the chara note if in a group
    $('#extension_floating_chara').prop('disabled', context.groupId ? true : false);

    const tokenCounter1 = chat_metadata[metadata_keys.prompt] ? getTokenCount(chat_metadata[metadata_keys.prompt]) : 0;
    $('#extension_floating_prompt_token_counter').text(tokenCounter1);

    let tokenCounter2;
    if (extension_settings.note.chara && context.characterId) {
        const charaNote = extension_settings.note.chara.find((e) => e.name === getCharaFilename());

        if (charaNote) {
            tokenCounter2 = getTokenCount(charaNote.prompt);
        }
    }

    if (tokenCounter2) {
        $('#extension_floating_chara_token_counter').text(tokenCounter2);
    }

    const tokenCounter3 = extension_settings.note.default ? getTokenCount(extension_settings.note.default) : 0;
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

    registerSlashCommand('note', setNoteTextCommand, [], '<span class=\'monospace\'>(text)</span> – sets an author\'s note for the currently selected chat', true, true);
    registerSlashCommand('depth', setNoteDepthCommand, [], '<span class=\'monospace\'>(number)</span> – sets an author\'s note depth for in-chat positioning', true, true);
    registerSlashCommand('freq', setNoteIntervalCommand, ['interval'], '<span class=\'monospace\'>(number)</span> – sets an author\'s note insertion frequency', true, true);
    registerSlashCommand('pos', setNotePositionCommand, ['position'], '(<span class=\'monospace\'>chat</span> or <span class=\'monospace\'>scenario</span>) – sets an author\'s note position', true, true);
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
}
