import { getContext } from "../../extensions.js";
export { MODULE_NAME };

const MODULE_NAME = '2_floating_prompt'; // <= Deliberate, for sorting lower than memory
const UPDATE_INTERVAL = 1000;

let lastMessageNumber = null;
let promptInsertionInterval = 1;
let promptInsertionPosition = 1;
let promptInsertionDepth = 0;

function onExtensionFloatingPromptInput() {
    saveSettings();
}

function onExtensionFloatingIntervalInput() {
    promptInsertionInterval = Number($(this).val());
    saveSettings();
}

function onExtensionFloatingDepthInput() {
    let value = Number($(this).val());

    if (promptInsertionDepth < 0) {
        value = Math.abs(value);
        $(this).val(value);
    }

    promptInsertionDepth = value;
    saveSettings();
}

function onExtensionFloatingPositionInput(e) {
    promptInsertionPosition = e.target.value;
    saveSettings();
}

function getLocalStorageKeys() {
    const context = getContext();
    const keySuffix = context.groupId ? context.groupId : `${context.characters[context.characterId].name}_${context.chatId}`;
    return {
        prompt: `extensions_floating_prompt_${keySuffix}`,
        interval: `extensions_floating_interval_${keySuffix}`,
        depth: `extensions_floating_depth_${keySuffix}`,
        position: `extensions_floating_position_${keySuffix}`,
     };
}

function loadSettings() {
    const keys = getLocalStorageKeys();
    const prompt = localStorage.getItem(keys.prompt) ?? '';
    const interval = localStorage.getItem(keys.interval) ?? 1;
    const position = localStorage.getItem(keys.position) ?? 1;
    const depth = localStorage.getItem(keys.depth) ?? 0;
    $('#extension_floating_prompt').val(prompt).trigger('input');
    $('#extension_floating_interval').val(interval).trigger('input');
    $('#extension_floating_depth').val(depth).trigger('input');
    $(`input[name="extension_floating_position"][value="${position}"]`).prop('checked', true).trigger('change');
}

function saveSettings() {
    const keys = getLocalStorageKeys();
    localStorage.setItem(keys.prompt, $('#extension_floating_prompt').val());
    localStorage.setItem(keys.interval, $('#extension_floating_interval').val());
    localStorage.setItem(keys.depth, $('#extension_floating_depth').val());
    localStorage.setItem(keys.position, $('input:radio[name="extension_floating_position"]:checked').val());
}

async function moduleWorker() {
    const context = getContext();

    if (!context.groupId && !context.characterId) {
        return;
    }

    loadSettings();

    // take the count of messages
    lastMessageNumber = Array.isArray(context.chat) && context.chat.length ? context.chat.filter(m => m.is_user).length : 0;

    // special case for new chat
    if (Array.isArray(context.chat) && context.chat.length === 1) {
        lastMessageNumber = 1;
    }

    if (lastMessageNumber <= 0 || promptInsertionInterval <= 0) {
        $('#extension_floating_counter').text('No');
        return;
    }

    const messagesTillInsertion = lastMessageNumber >= promptInsertionInterval
        ? (lastMessageNumber % promptInsertionInterval)
        : (promptInsertionInterval - lastMessageNumber);
    const shouldAddPrompt = messagesTillInsertion == 0;
    const prompt = shouldAddPrompt ? $('#extension_floating_prompt').val() : '';
    context.setExtensionPrompt(MODULE_NAME, prompt, promptInsertionPosition, promptInsertionDepth);
    $('#extension_floating_counter').text(shouldAddPrompt ? 'This' : messagesTillInsertion);
}

(function() {
    function addExtensionsSettings() {
        const settingsHtml = `
        <h4>Author's Note / Character Bias</h4>
        <div class="floating_prompt_settings">
            <label for="extension_floating_prompt">Append the following text:</label>
            <textarea id="extension_floating_prompt" class="text_pole" rows="2"></textarea>
            <label>
                <input type="radio" name="extension_floating_position" value="0" />
                After scenario
            </label>
            <label>
                <input type="radio" name="extension_floating_position" value="1" />
                In-chat
            </label>
            <label for="extension_floating_interval">Every N messages <b>you</b> send (set to 0 to disable):</label>
            <input id="extension_floating_interval" class="text_pole" type="number" min="0" max="999" />
            <label for="extension_floating_interval">Insertion depth (for in-chat positioning):</label>
            <input id="extension_floating_depth" class="text_pole" type="number" min="0" max="99" />
            <span>Appending to the prompt in next: <span id="extension_floating_counter">No</span> message(s)</span>
        </div>
        `;

        $('#extensions_settings').append(settingsHtml);
        $('#extension_floating_prompt').on('input', onExtensionFloatingPromptInput);
        $('#extension_floating_interval').on('input', onExtensionFloatingIntervalInput);
        $('#extension_floating_depth').on('input', onExtensionFloatingDepthInput);
        $('input[name="extension_floating_position"]').on('change', onExtensionFloatingPositionInput);
    }

    addExtensionsSettings();
    setInterval(moduleWorker, UPDATE_INTERVAL);
})();