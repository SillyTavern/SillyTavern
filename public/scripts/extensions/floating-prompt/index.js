import { chat_metadata, saveSettingsDebounced } from "../../../script.js";
import { extension_settings, getContext } from "../../extensions.js";
import { registerSlashCommand } from "../../slash-commands.js";
import { debounce } from "../../utils.js";
export { MODULE_NAME };

const saveMetadataDebounced = debounce(async () => await getContext().saveMetadata(), 1000);

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

async function onExtensionFloatingPromptInput() {
    chat_metadata[metadata_keys.prompt] = $(this).val();
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

function onExtensionFloatingDefaultInput() {
    extension_settings.note.default = $(this).val();
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
    $('#extension_floating_default').val(extension_settings.note.default);
}

let isWorkerBusy = false;

async function moduleWorkerWrapper() {
    // Don't touch me I'm busy...
    if (isWorkerBusy) {
        return;
    }

    // I'm free. Let's update!
    try {
        isWorkerBusy = true;
        await moduleWorker();
    }
    finally {
        isWorkerBusy = false;
    }
}

async function moduleWorker() {
    const context = getContext();

    if (!context.groupId && context.characterId === undefined) {
        return;
    }

    loadSettings();

    // take the count of messages
    let lastMessageNumber = Array.isArray(context.chat) && context.chat.length ? context.chat.filter(m => m.is_user).length : 0;

    // special case for new chat
    if (Array.isArray(context.chat) && context.chat.length === 1) {
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
    const prompt = shouldAddPrompt ? $('#extension_floating_prompt').val() : '';
    context.setExtensionPrompt(MODULE_NAME, prompt, chat_metadata[metadata_keys.position], chat_metadata[metadata_keys.depth]);
    $('#extension_floating_counter').text(shouldAddPrompt ? '0' : messagesTillInsertion);
}

(function () {
    function addExtensionsSettings() {
        const settingsHtml = `
        <div id="floatingPrompt" class="drawer-content flexGap5">
            <div id="floatingPromptheader" class="fa-solid fa-grip drag-grabber"></div>
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
                    
                    <input id="extension_floating_interval" class="text_pole widthUnset" type="number" min="0" max="999"  /><small> (0 = Disable)</small>
                    <br>

                    <span>User inputs until next insertion: <span id="extension_floating_counter">(disabled)</span></span>

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
                    </div>
                </div>
            </div>
        </div>
        `;

        $('#movingDivs').append(settingsHtml);
        $('#extension_floating_prompt').on('input', onExtensionFloatingPromptInput);
        $('#extension_floating_interval').on('input', onExtensionFloatingIntervalInput);
        $('#extension_floating_depth').on('input', onExtensionFloatingDepthInput);
        $('#extension_floating_default').on('input', onExtensionFloatingDefaultInput);
        $('input[name="extension_floating_position"]').on('change', onExtensionFloatingPositionInput);
    }

    addExtensionsSettings();
    setInterval(moduleWorkerWrapper, UPDATE_INTERVAL);
    registerSlashCommand('note', setNoteTextCommand, [], "<span class='monospace'>(text)</span> – sets an author's note for the currently selected chat", true, true);
    registerSlashCommand('depth', setNoteDepthCommand, [], "<span class='monospace'>(number)</span> – sets an author's note depth for in-chat positioning", true, true);
    registerSlashCommand('freq', setNoteIntervalCommand, ['interval'], "<span class='monospace'>(number)</span> – sets an author's note insertion frequency", true, true);
    registerSlashCommand('pos', setNotePositionCommand, ['position'], "(<span class='monospace'>chat</span> or <span class='monospace'>scenario</span>) – sets an author's note position", true, true);
})();