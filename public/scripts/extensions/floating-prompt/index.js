import { getContext } from "../../extensions.js";
export { MODULE_NAME };

const MODULE_NAME = '2_floating_prompt'; // <= Deliberate, for sorting lower than memory
const PROMPT_KEY = 'extensions_floating_prompt';
const INTERVAL_KEY = 'extensions_floating_interval';
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

function loadSettings() {
    const prompt = localStorage.getItem(PROMPT_KEY);
    const interval = localStorage.getItem(INTERVAL_KEY);
    $('#extension_floating_prompt').val(prompt).trigger('input');
    $('#extension_floating_interval').val(interval).trigger('input');
}

function saveSettings() {
    localStorage.setItem(PROMPT_KEY, $('#extension_floating_prompt').val());
    localStorage.setItem(INTERVAL_KEY, $('#extension_floating_interval').val());
}

async function moduleWorker() {
    const context = getContext();

    // take the count of messages
    lastMessageNumber = Array.isArray(context.chat) && context.chat.length ? context.chat.filter(m => m.is_user).length : 0;

    if (lastMessageNumber <= 0 || promptInsertionInterval <= 0) {
        $('#extension_floating_counter').text('No');
        return;
    }

    const messagesTillInsertion = (lastMessageNumber % promptInsertionInterval);
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
    loadSettings();
    setInterval(moduleWorker, UPDATE_INTERVAL);
})();