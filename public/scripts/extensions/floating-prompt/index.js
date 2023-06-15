import {
    chat_metadata,
    eventSource,
    event_types,
    getTokenCount,
    saveSettingsDebounced,
    this_chid,
} from "../../../script.js";
import { selected_group } from "../../group-chats.js";
import { ModuleWorkerWrapper, extension_settings, getContext, saveMetadataDebounced } from "../../extensions.js";
import { registerSlashCommand } from "../../slash-commands.js";
import { getCharaFilename, debounce } from "../../utils.js";
export { MODULE_NAME };

const MODULE_NAME = '2_floating_prompt'; // <= Deliberate, for sorting lower than memory
const UPDATE_INTERVAL = 1000;

const DEFAULT_DEPTH = 4;
const DEFAULT_POSITION = 1;
const DEFAULT_INTERVAL = 1;

const metadata_keys = {
    prompt: 'note_prompt',
    interval: 'note_interval',
    depth: 'note_depth',
    position: 'note_position',
}

function setNoteTextCommand(_, text) {
    $('#extension_floating_prompt').val(text).trigger('input');
    toastr.success("Author's Note text updated");
}

function setNoteDepthCommand(_, text) {
    const value = Number(text);

    if (Number.isNaN(value)) {
        toastr.error('Not a valid number');
        return;
    }

    $('#extension_floating_depth').val(Math.abs(value)).trigger('input');
    toastr.success("Author's Note depth updated");
}

function setNoteIntervalCommand(_, text) {
    const value = Number(text);

    if (Number.isNaN(value)) {
        toastr.error('Not a valid number');
        return;
    }

    $('#extension_floating_interval').val(Math.abs(value)).trigger('input');
    toastr.success("Author's Note frequency updated");
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
    toastr.info("Author's Note position updated");
}

const setMainPromptTokenCounterDebounced = debounce((value) => $('#extension_floating_prompt_token_counter').text(getTokenCount(value)), 1000);
const setCharaPromptTokenCounterDebounced = debounce((value) => $('#extension_floating_chara_token_counter').text(getTokenCount(value)), 1000);
const setDefaultPromptTokenCounterDebounced = debounce((value) => $('#extension_floating_default_token_counter').text(getTokenCount(value)), 1000);

async function onExtensionFloatingPromptInput() {
    chat_metadata[metadata_keys.prompt] = $(this).val();
    setMainPromptTokenCounterDebounced(chat_metadata[metadata_keys.prompt]);
    saveMetadataDebounced();
}

async function onExtensionFloatingIntervalInput() {
    chat_metadata[metadata_keys.interval] = Number($(this).val());
    saveMetadataDebounced();
}

async function onExtensionFloatingDepthInput() {
    let value = Number($(this).val());

    if (value < 0) {
        value = Math.abs(value);
        $(this).val(value);
    }

    chat_metadata[metadata_keys.depth] = value;
    saveMetadataDebounced();
}

async function onExtensionFloatingPositionInput(e) {
    chat_metadata[metadata_keys.position] = e.target.value;
    saveMetadataDebounced();
}

function onExtensionFloatingCharaPromptInput() {
    const tempPrompt = $(this).val();
    const avatarName = getCharaFilename();
    let tempCharaNote = {
        name: avatarName,
        prompt: tempPrompt
    }

    setCharaPromptTokenCounterDebounced(tempPrompt);

    let existingCharaNoteIndex;
    let existingCharaNote;

    if (extension_settings.note.chara) {
        existingCharaNoteIndex = extension_settings.note.chara.findIndex((e) => e.name === avatarName);
        existingCharaNote = extension_settings.note.chara[existingCharaNoteIndex]
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
            extension_settings.note.chara = []
        }
        Object.assign(tempCharaNote, { useChara: false })

        extension_settings.note.chara.push(tempCharaNote);
    } else {
        console.log("Character author's note error: No avatar name key could be found.");
        toastr.error("Something went wrong. Could not save character's author's note.");

        // Don't save settings if something went wrong
        return;
    }

    saveSettingsDebounced();
}

function onExtensionFloatingCharaCheckboxChanged() {
    const value = !!$(this).prop('checked');
    const charaNote = extension_settings.note.chara.find((e) => e.name === getCharaFilename());

    if (charaNote) {
        charaNote.useChara = value;

        saveSettingsDebounced();
    }
}

function onExtensionFloatingDefaultInput() {
    extension_settings.note.default = $(this).val();
    setDefaultPromptTokenCounterDebounced(extension_settings.note.default);
    saveSettingsDebounced();
}

function loadSettings() {
    chat_metadata[metadata_keys.prompt] = chat_metadata[metadata_keys.prompt] ?? extension_settings.note.default ?? '';
    chat_metadata[metadata_keys.interval] = chat_metadata[metadata_keys.interval] ?? DEFAULT_INTERVAL;
    chat_metadata[metadata_keys.position] = chat_metadata[metadata_keys.position] ?? DEFAULT_POSITION;
    chat_metadata[metadata_keys.depth] = chat_metadata[metadata_keys.depth] ?? DEFAULT_DEPTH;
    $('#extension_floating_prompt').val(chat_metadata[metadata_keys.prompt]);
    $('#extension_floating_interval').val(chat_metadata[metadata_keys.interval]);
    $('#extension_floating_depth').val(chat_metadata[metadata_keys.depth]);
    $(`input[name="extension_floating_position"][value="${chat_metadata[metadata_keys.position]}"]`).prop('checked', true);

    if (extension_settings.note.chara) {
        const charaNote = extension_settings.note.chara.find((e) => e.name === getCharaFilename());

        $('#extension_floating_chara').val(charaNote ? charaNote.prompt : '');
        $('#extension_use_floating_chara').prop('checked', charaNote ? charaNote.useChara : false);
    }

    $('#extension_floating_default').val(extension_settings.note.default);
}

async function moduleWorker() {
    const context = getContext();

    if (!context.groupId && context.characterId === undefined) {
        return;
    }

    loadSettings();

    // take the count of messages
    let lastMessageNumber = Array.isArray(context.chat) && context.chat.length ? context.chat.filter(m => m.is_user).length : 0;

    // interval 1 should be inserted no matter what
    if (chat_metadata[metadata_keys.interval] === 1) {
        lastMessageNumber = 1;
    }

    if (lastMessageNumber <= 0 || chat_metadata[metadata_keys.interval] <= 0) {
        context.setExtensionPrompt(MODULE_NAME, '');
        $('#extension_floating_counter').text('(disabled)');
        return;
    }

    const messagesTillInsertion = lastMessageNumber >= chat_metadata[metadata_keys.interval]
        ? (lastMessageNumber % chat_metadata[metadata_keys.interval])
        : (chat_metadata[metadata_keys.interval] - lastMessageNumber);
    const shouldAddPrompt = messagesTillInsertion == 0;

    let prompt = shouldAddPrompt ? $('#extension_floating_prompt').val() : '';
    if (shouldAddPrompt && extension_settings.note.chara) {
        const charaNote = extension_settings.note.chara.find((e) => e.name === getCharaFilename());

        // Only replace with the chara note if the user checked the box
        if (charaNote && charaNote.useChara) {
            prompt = charaNote.prompt;
        }
    }

    context.setExtensionPrompt(MODULE_NAME, prompt, chat_metadata[metadata_keys.position], chat_metadata[metadata_keys.depth]);
    $('#extension_floating_counter').text(shouldAddPrompt ? '0' : messagesTillInsertion);
}

function onANMenuItemClick() {
    if (selected_group || this_chid) {
        if ($("#floatingPrompt").css("display") !== 'flex') {
            $("#floatingPrompt").css("display", "flex");
            $("#floatingPrompt").css("opacity", 0.0);
            $("#floatingPrompt").transition({
                opacity: 1.0,
                duration: 250,
            });

            if ($("#ANBlockToggle")
                .siblings('.inline-drawer-content')
                .css('display') !== 'block') {
                $("#ANBlockToggle").click();
            }
        } else {
            $("#floatingPrompt").transition({
                opacity: 0.0,
                duration: 250,
            });
            setTimeout(function () {
                $("#floatingPrompt").hide();
            }, 250);

        }
        //duplicate options menu close handler from script.js
        //because this listener takes priority
        $("#options").stop().fadeOut(250);
    } else {
        toastr.warning(`Select a character before trying to use Author's Note`, '', { timeOut: 2000 });
    }
}

function onChatChanged() {
    const tokenCounter1 = chat_metadata[metadata_keys.prompt] ? getTokenCount(chat_metadata[metadata_keys.prompt]) : 0;
    $('#extension_floating_prompt_token_counter').text(tokenCounter1);

    let tokenCounter2;
    if (extension_settings.note.chara) {
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

(function () {
    function addExtensionsSettings() {
        const settingsHtml = `
        <div id="floatingPrompt" class="drawer-content flexGap5">
            <div class="panelControlBar flex-container">
                <div id="floatingPromptheader" class="fa-solid fa-grip drag-grabber"></div>
                <div id="ANClose" class="fa-solid fa-circle-xmark"></div>
            </div>
            <div name="floatingPromptHolder">
                <div class="inline-drawer">
                    <div id="ANBlockToggle" class="inline-drawer-toggle inline-drawer-header">
                        <b>Author's Note</b>
                        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>

                </div>
                <div class="inline-drawer-content">
                    <small>
                        <b>Unique to this chat</b>.<br>
                        Bookmarks inherit the Note from their parent, and can be changed individually after that.<br>
                    </small>

                    <textarea id="extension_floating_prompt" class="text_pole" rows="8" maxlength="10000"></textarea>
                    <div class="extension_token_counter">Tokens: <span id="extension_floating_prompt_token_counter">0</small></div>

                    <div class="floating_prompt_radio_group">
                        <label>
                            <input type="radio" name="extension_floating_position" value="0" />
                            After scenario
                        </label>
                        <label>
                            <input type="radio" name="extension_floating_position" value="1" />
                            In-chat @ Depth <input id="extension_floating_depth" class="text_pole widthUnset" type="number" min="0" max="99" />
                        </label>
                    </div>
                    <!--<label for="extension_floating_interval">In-Chat Insertion Depth</label>-->

                    <label for="extension_floating_interval">Insertion Frequency</label>

                    <input id="extension_floating_interval" class="text_pole widthUnset" type="number" min="0" max="999"  /><small> (0 = Disable, 1 = Always)</small>
                    <br>

                    <span>User inputs until next insertion: <span id="extension_floating_counter">(disabled)</span></span>

                    </div>
                </div>
                <hr class="sysHR">
                <div class="inline-drawer">
                    <div id="charaANBlockToggle" class="inline-drawer-toggle inline-drawer-header">
                        <b>Character Author's Note</b>
                        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                    </div>
                    <div class="inline-drawer-content">
                    <small>Will be automatically added as the author's note for this character.</small>

                        <textarea id="extension_floating_chara" class="text_pole" rows="8" maxlength="10000"
                        placeholder="Example:\n[Scenario: wacky adventures; Genre: romantic comedy; Style: verbose, creative]"></textarea>
                        <div class="extension_token_counter">Tokens: <span id="extension_floating_chara_token_counter">0</small></div>

                        <label for="extension_use_floating_chara">
                            <input id="extension_use_floating_chara" type="checkbox" />
                        <span data-i18n="Use character author's note">Use character author's note</span>
                    </label>
                    </div>
                </div>
                <hr class="sysHR">
                <div class="inline-drawer">
                    <div id="defaultANBlockToggle" class="inline-drawer-toggle inline-drawer-header">
                        <b>Default Author's Note</b>
                        <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                    </div>
                    <div class="inline-drawer-content">
                    <small>Will be automatically added as the Author's Note for all new chats.</small>

                        <textarea id="extension_floating_default" class="text_pole" rows="8" maxlength="10000"
                        placeholder="Example:\n[Scenario: wacky adventures; Genre: romantic comedy; Style: verbose, creative]"></textarea>
                        <div class="extension_token_counter">Tokens: <span id="extension_floating_default_token_counter">0</small></div>
                    </div>
                </div>
            </div>
        </div>
        `;

        const ANButtonHtml = `
        <a id="option_toggle_AN">
           <i class="fa-lg fa-solid fa-note-sticky"></i>
           <span data-i18n="Author's Note">Author's Note</span>
        </a>
    `;
        $('#options .options-content').prepend(ANButtonHtml);
        $('#movingDivs').append(settingsHtml);
        $('#extension_floating_prompt').on('input', onExtensionFloatingPromptInput);
        $('#extension_floating_interval').on('input', onExtensionFloatingIntervalInput);
        $('#extension_floating_depth').on('input', onExtensionFloatingDepthInput);
        $('#extension_floating_chara').on('input', onExtensionFloatingCharaPromptInput);
        $('#extension_use_floating_chara').on('input', onExtensionFloatingCharaCheckboxChanged);
        $('#extension_floating_default').on('input', onExtensionFloatingDefaultInput);
        $('input[name="extension_floating_position"]').on('change', onExtensionFloatingPositionInput);
        $('#ANClose').on('click', function () {
            $("#floatingPrompt").transition({
                opacity: 0,
                duration: 200,
                easing: 'ease-in-out',
            });
            setTimeout(function () { $('#floatingPrompt').hide() }, 200);
        })
        $("#option_toggle_AN").on('click', onANMenuItemClick);
    }

    addExtensionsSettings();
    const wrapper = new ModuleWorkerWrapper(moduleWorker);
    setInterval(wrapper.update.bind(wrapper), UPDATE_INTERVAL);
    registerSlashCommand('note', setNoteTextCommand, [], "<span class='monospace'>(text)</span> – sets an author's note for the currently selected chat", true, true);
    registerSlashCommand('depth', setNoteDepthCommand, [], "<span class='monospace'>(number)</span> – sets an author's note depth for in-chat positioning", true, true);
    registerSlashCommand('freq', setNoteIntervalCommand, ['interval'], "<span class='monospace'>(number)</span> – sets an author's note insertion frequency", true, true);
    registerSlashCommand('pos', setNotePositionCommand, ['position'], "(<span class='monospace'>chat</span> or <span class='monospace'>scenario</span>) – sets an author's note position", true, true);
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
})();
