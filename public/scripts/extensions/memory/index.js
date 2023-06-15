import { getStringHash, debounce } from "../../utils.js";
import { getContext, getApiUrl, extension_settings, ModuleWorkerWrapper, doExtrasFetch } from "../../extensions.js";
import { extension_prompt_types, is_send_press, saveSettingsDebounced } from "../../../script.js";
export { MODULE_NAME };

const MODULE_NAME = '1_memory';
const UPDATE_INTERVAL = 5000;

let lastCharacterId = null;
let lastGroupId = null;
let lastChatId = null;
let lastMessageHash = null;
let lastMessageId = null;
let inApiCall = false;

const formatMemoryValue = (value) => value ? `Context: ${value.trim()}` : '';
const saveChatDebounced = debounce(() => getContext().saveChat(), 2000);

const defaultSettings = {
    minLongMemory: 16,
    maxLongMemory: 1024,
    longMemoryLength: 128,
    shortMemoryLength: 512,
    minShortMemory: 128,
    maxShortMemory: 1024,
    shortMemoryStep: 16,
    longMemoryStep: 8,
    repetitionPenaltyStep: 0.05,
    repetitionPenalty: 1.2,
    maxRepetitionPenalty: 2.0,
    minRepetitionPenalty: 1.0,
    temperature: 1.0,
    minTemperature: 0.1,
    maxTemperature: 2.0,
    temperatureStep: 0.05,
    lengthPenalty: 1,
    minLengthPenalty: -4,
    maxLengthPenalty: 4,
    lengthPenaltyStep: 0.1,
    memoryFrozen: false,
};

function loadSettings() {
    if (Object.keys(extension_settings.memory).length === 0) {
        Object.assign(extension_settings.memory, defaultSettings);
    }

    $('#memory_long_length').val(extension_settings.memory.longMemoryLength).trigger('input');
    $('#memory_short_length').val(extension_settings.memory.shortMemoryLength).trigger('input');
    $('#memory_repetition_penalty').val(extension_settings.memory.repetitionPenalty).trigger('input');
    $('#memory_temperature').val(extension_settings.memory.temperature).trigger('input');
    $('#memory_length_penalty').val(extension_settings.memory.lengthPenalty).trigger('input');
    $('#memory_frozen').prop('checked', extension_settings.memory.memoryFrozen).trigger('input');
}

function onMemoryShortInput() {
    const value = $(this).val();
    extension_settings.memory.shortMemoryLength = Number(value);
    $('#memory_short_length_tokens').text(value);
    saveSettingsDebounced();

    // Don't let long buffer be bigger than short
    if (extension_settings.memory.longMemoryLength > extension_settings.memory.shortMemoryLength) {
        $('#memory_long_length').val(extension_settings.memory.shortMemoryLength).trigger('input');
    }
}

function onMemoryLongInput() {
    const value = $(this).val();
    extension_settings.memory.longMemoryLength = Number(value);
    $('#memory_long_length_tokens').text(value);
    saveSettingsDebounced();

    // Don't let long buffer be bigger than short
    if (extension_settings.memory.longMemoryLength > extension_settings.memory.shortMemoryLength) {
        $('#memory_short_length').val(extension_settings.memory.longMemoryLength).trigger('input');
    }
}

function onMemoryRepetitionPenaltyInput() {
    const value = $(this).val();
    extension_settings.memory.repetitionPenalty = Number(value);
    $('#memory_repetition_penalty_value').text(extension_settings.memory.repetitionPenalty.toFixed(2));
    saveSettingsDebounced();
}

function onMemoryTemperatureInput() {
    const value = $(this).val();
    extension_settings.memory.temperature = Number(value);
    $('#memory_temperature_value').text(extension_settings.memory.temperature.toFixed(2));
    saveSettingsDebounced();
}

function onMemoryLengthPenaltyInput() {
    const value = $(this).val();
    extension_settings.memory.lengthPenalty = Number(value);
    $('#memory_length_penalty_value').text(extension_settings.memory.lengthPenalty.toFixed(2));
    saveSettingsDebounced();
}

function onMemoryFrozenInput() {
    const value = Boolean($(this).prop('checked'));
    extension_settings.memory.memoryFrozen = value;
    saveSettingsDebounced();
}

function saveLastValues() {
    const context = getContext();
    lastGroupId = context.groupId;
    lastCharacterId = context.characterId;
    lastChatId = context.chatId;
    lastMessageId = context.chat?.length ?? null;
    lastMessageHash = getStringHash((context.chat.length && context.chat[context.chat.length - 1]['mes']) ?? '');
}

function getLatestMemoryFromChat(chat) {
    if (!Array.isArray(chat) || !chat.length) {
        return '';
    }

    const reversedChat = chat.slice().reverse();
    reversedChat.shift();
    for (let mes of reversedChat) {
        if (mes.extra && mes.extra.memory) {
            return mes.extra.memory;
        }
    }

    return '';
}

async function moduleWorker() {
    const context = getContext();
    const chat = context.chat;

    // no characters or group selected
    if (!context.groupId && context.characterId === undefined) {
        return;
    }

    // Generation is in progress, summary prevented
    if (is_send_press) {
        return;
    }

    // Chat/character/group changed
    if ((context.groupId && lastGroupId !== context.groupId) || (context.characterId !== lastCharacterId) || (context.chatId !== lastChatId)) {
        const latestMemory = getLatestMemoryFromChat(chat);
        setMemoryContext(latestMemory, false);
        saveLastValues();
        return;
    }

    // Currently summarizing or frozen state - skip
    if (inApiCall || extension_settings.memory.memoryFrozen) {
        return;
    }

    // No new messages - do nothing
    if (chat.length === 0 || (lastMessageId === chat.length && getStringHash(chat[chat.length - 1].mes) === lastMessageHash)) {
        return;
    }

    // Messages has been deleted - rewrite the context with the latest available memory
    if (chat.length < lastMessageId) {
        const latestMemory = getLatestMemoryFromChat(chat);
        setMemoryContext(latestMemory, false);
    }

    // Message has been edited / regenerated - delete the saved memory
    if (chat.length
        && chat[chat.length - 1].extra
        && chat[chat.length - 1].extra.memory
        && lastMessageId === chat.length
        && getStringHash(chat[chat.length - 1].mes) !== lastMessageHash) {
        delete chat[chat.length - 1].extra.memory;
    }

    try {
        await summarizeChat(context);
    }
    catch (error) {
        console.log(error);
    }
    finally {
        saveLastValues();
    }
}

async function summarizeChat(context) {
    function getMemoryString() {
        return (longMemory + '\n\n' + memoryBuffer.slice().reverse().join('\n\n')).trim();
    }

    const chat = context.chat;
    const longMemory = getLatestMemoryFromChat(chat);
    const reversedChat = chat.slice().reverse();
    reversedChat.shift();
    let memoryBuffer = [];

    for (let mes of reversedChat) {
        // we reached the point of latest memory
        if (longMemory && mes.extra && mes.extra.memory == longMemory) {
            break;
        }

        // don't care about system
        if (mes.is_system) {
            continue;
        }

        // determine the sender's name
        const name = mes.is_user ? (context.name1 ?? 'You') : (mes.force_avatar ? mes.name : context.name2);
        const entry = `${name}:\n${mes['mes']}`;
        memoryBuffer.push(entry);

        // check if token limit was reached
        if (context.getTokenCount(getMemoryString()) >= extension_settings.memory.shortMemoryLength) {
            break;
        }
    }

    const resultingString = getMemoryString();

    if (context.getTokenCount(resultingString) < extension_settings.memory.shortMemoryLength) {
        return;
    }

    // perform the summarization API call
    try {
        inApiCall = true;
        const url = new URL(getApiUrl());
        url.pathname = '/api/summarize';

        const apiResult = await doExtrasFetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Bypass-Tunnel-Reminder': 'bypass',
            },
            body: JSON.stringify({
                text: resultingString,
                params: {
                    min_length: extension_settings.memory.longMemoryLength * 0, // testing how it behaves 0 min length
                    max_length: extension_settings.memory.longMemoryLength,
                    repetition_penalty: extension_settings.memory.repetitionPenalty,
                    temperature: extension_settings.memory.temperature,
                    length_penalty: extension_settings.memory.lengthPenalty,
                }
            })
        });

        if (apiResult.ok) {
            const data = await apiResult.json();
            const summary = data.summary;

            const newContext = getContext();

            // something changed during summarization request
            if (newContext.groupId !== context.groupId
                || newContext.chatId !== context.chatId
                || (!newContext.groupId && (newContext.characterId !== context.characterId))) {
                console.log('Context changed, summary discarded');
                return;
            }

            setMemoryContext(summary, true);
        }
    }
    catch (error) {
        console.log(error);
    }
    finally {
        inApiCall = false;
    }
}

function onMemoryRestoreClick() {
    const context = getContext();
    const content = $('#memory_contents').val();
    const reversedChat = context.chat.slice().reverse();
    reversedChat.shift();

    for (let mes of reversedChat) {
        if (mes.extra && mes.extra.memory == content) {
            delete mes.extra.memory;
            break;
        }
    }

    const newContent = getLatestMemoryFromChat(context.chat);
    setMemoryContext(newContent, false);
}

function onMemoryContentInput() {
    const value = $(this).val();
    setMemoryContext(value, true);
}

function setMemoryContext(value, saveToMessage) {
    const context = getContext();
    context.setExtensionPrompt(MODULE_NAME, formatMemoryValue(value), extension_prompt_types.AFTER_SCENARIO);
    $('#memory_contents').val(value);

    if (saveToMessage && context.chat.length) {
        const idx = context.chat.length - 2;
        const mes = context.chat[idx < 0 ? 0 : idx];

        if (!mes.extra) {
            mes.extra = {};
        }

        mes.extra.memory = value;
        saveChatDebounced();
    }
}

$(document).ready(function () {
    function addExtensionControls() {
        const settingsHtml = `
        <div id="memory_settings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                <b>Summarize</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div class="inline-drawer-content">
                <label for="memory_contents">Current summary: </label>
                <textarea id="memory_contents" class="text_pole" rows="8" placeholder="Context will be generated here..."></textarea>
                <div class="memory_contents_controls">
                    <input id="memory_restore" class="menu_button" type="submit" value="Restore previous state" />
                    <label for="memory_frozen"><input id="memory_frozen" type="checkbox" />Stop summarization updates</label>
                </div>
            <!--</div>
            </div>
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>Summarization parameters</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">-->
                    <label for="memory_short_length">Chat to Summarize buffer length (<span id="memory_short_length_tokens"></span> tokens)</label>
                    <input id="memory_short_length" type="range" value="${defaultSettings.shortMemoryLength}" min="${defaultSettings.minShortMemory}" max="${defaultSettings.maxShortMemory}" step="${defaultSettings.shortMemoryStep}" />
                    <label for="memory_long_length">Summary output length (<span id="memory_long_length_tokens"></span> tokens)</label>
                    <input id="memory_long_length" type="range" value="${defaultSettings.longMemoryLength}" min="${defaultSettings.minLongMemory}" max="${defaultSettings.maxLongMemory}" step="${defaultSettings.longMemoryStep}" />
                    <label for="memory_temperature">Temperature (<span id="memory_temperature_value"></span>)</label>
                    <input id="memory_temperature" type="range" value="${defaultSettings.temperature}" min="${defaultSettings.minTemperature}" max="${defaultSettings.maxTemperature}" step="${defaultSettings.temperatureStep}" />
                    <label for="memory_repetition_penalty">Repetition penalty (<span id="memory_repetition_penalty_value"></span>)</label>
                    <input id="memory_repetition_penalty" type="range" value="${defaultSettings.repetitionPenalty}" min="${defaultSettings.minRepetitionPenalty}" max="${defaultSettings.maxRepetitionPenalty}" step="${defaultSettings.repetitionPenaltyStep}" />
                    <label for="memory_length_penalty">Length preference <small>[higher = longer summaries]</small> (<span id="memory_length_penalty_value"></span>)</label>
                    <input id="memory_length_penalty" type="range" value="${defaultSettings.lengthPenalty}" min="${defaultSettings.minLengthPenalty}" max="${defaultSettings.maxLengthPenalty}" step="${defaultSettings.lengthPenaltyStep}" />
                </div>
            </div>
        </div>
        `;
        $('#extensions_settings2').append(settingsHtml);
        $('#memory_restore').on('click', onMemoryRestoreClick);
        $('#memory_contents').on('input', onMemoryContentInput);
        $('#memory_long_length').on('input', onMemoryLongInput);
        $('#memory_short_length').on('input', onMemoryShortInput);
        $('#memory_repetition_penalty').on('input', onMemoryRepetitionPenaltyInput);
        $('#memory_temperature').on('input', onMemoryTemperatureInput);
        $('#memory_length_penalty').on('input', onMemoryLengthPenaltyInput);
        $('#memory_frozen').on('input', onMemoryFrozenInput);
    }

    addExtensionControls();
    loadSettings();
    const wrapper = new ModuleWorkerWrapper(moduleWorker);
    setInterval(wrapper.update.bind(wrapper), UPDATE_INTERVAL);
});
