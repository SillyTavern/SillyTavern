import { getContext } from "../../extensions.js";
export { MODULE_NAME };

const MODULE_NAME = '2_floating_prompt'; // <= Deliberate, for sorting lower than memory
const UPDATE_INTERVAL = 1000;

let lastMessageNumber = null;
let promptInsertionInterval = 0;

function onExtensionFloatingPromptInput() {
    saveSettings();
}

function onExtensionFloatingIntervalInput() {
    promptInsertionInterval = Number($(this).val());
    saveSettings();
}

function getLocalStorageKeys() {
    const context = getContext();
    const keySuffix = context.groupId ? context.groupId : `${context.characters[context.characterId].name}_${context.chatId}`;
    return { prompt: `extensions_floating_prompt_${keySuffix}`, interval: `extensions_floating_interval_${keySuffix}` };
}

function loadSettings() {
    const keys = getLocalStorageKeys();
    const prompt = localStorage.getItem(keys.prompt) ?? '';
    const interval = localStorage.getItem(keys.interval) ?? 0;
    $('#extension_floating_prompt').val(prompt).trigger('input');
    $('#extension_floating_interval').val(interval).trigger('input');
}

function saveSettings() {
    const keys = getLocalStorageKeys();
    localStorage.setItem(keys.prompt, $('#extension_floating_prompt').val());
    localStorage.setItem(keys.interval, $('#extension_floating_interval').val());
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
    context.setExtensionPrompt(MODULE_NAME, prompt);
    $('#extension_floating_counter').text(shouldAddPrompt ? 'This' : messagesTillInsertion);
}

(function() {
    function addExtensionsSettings() {
        const settingsHtml = `
        <h4>Floating Prompt</h4>
        <div class="floating_prompt_settings">
            <label for="extension_floating_prompt">Append the following text to the scenario:</label>
            <textarea id="extension_floating_prompt" class="text_pole" rows="2"></textarea>
            <label for="extension_floating_interval">Every N messages <b>you</b> send (set to 0 to disable):</label>
            <input id="extension_floating_interval" class="text_pole" type="number" value="0" min="0" max="999" />
            <span>Appending the prompt in next: <span id="extension_floating_counter">No</span> message(s)</span>
        </div>
        `;

        $('#extensions_settings').append(settingsHtml);
        $('#extension_floating_prompt').on('input', onExtensionFloatingPromptInput);
        $('#extension_floating_interval').on('input', onExtensionFloatingIntervalInput);
    }

    addExtensionsSettings();
    setInterval(moduleWorker, UPDATE_INTERVAL);
})();