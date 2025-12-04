import { chatHistory, defaultChunkSize as defaultChunkSize, defaultMaxChatLength, defaultMaxHistoryChunks, extensionName, snapshotEvents } from './index.js';
import { eventSource, saveSettingsDebounced } from '/script.js';
import { debounce_timeout } from '/scripts/constants.js';
import { extension_settings, renderExtensionTemplateAsync } from '/scripts/extensions.js';
import { debounce, isInputElementInFocus } from '/scripts/utils.js';

/**
 * Displays buttons in the options menu.
 */
export async function addButtons() {
    //Creates the buttons.
    const buttonsHtml = await renderExtensionTemplateAsync(extensionName, 'buttons');

    //Places the buttons.
    $('#options .options-content').prepend(buttonsHtml);

    //Undo.
    $(document).on('click', '#option_undo_undo', async () => await chatHistory.loadPreviousSnapshot());
    //Redo.
    $(document).on('click', '#option_undo_redo', async () => await chatHistory.loadNextSnapshot());

    //Save.
    $(document).on('click', '#option_undo_save', async () => await chatHistory.saveChatSnapshot(true));
    //Discard.
    $(document).on('click', '#option_undo_discard', async () => await chatHistory.resetChatSnapshots(true));
}

/**
 * Creates the settings UI.
 */
export async function addSettings() {

    //Creates the settings layout.
    const settingsHtml = await renderExtensionTemplateAsync(extensionName, 'settings');

    //Places the settings layout.
    $('#undo_container').append(settingsHtml);

    //Creates sliders.
    const maxChunksElement = new RangeInput('max_chunks', 'Max Undo History Chunks.', { defaultValue: defaultMaxHistoryChunks }).create();
    const lengthElement = new RangeInput('max_length', 'Max chat length', { defaultValue: defaultMaxChatLength }).create();

    //Places the sliders.
    const undoOptions = $('#undo_options');
    undoOptions.append(maxChunksElement);
    undoOptions.append(lengthElement);

    //Toggles visibility of undo_buttons and undo_save_options.
    const menuVisibility = (_, value) => {$('#undo_buttons').toggle(value);};
    const saveVisibility = (_, value) => $('#undo_save_options').toggle(value);

    //Setting that toggles menuVisibility and saveVisibility.
    const toggleMenuElement = new ToggleInput('show_menu_buttons', 'Show Undo/Redo in ☰', { defaultValue: true, callback: menuVisibility }).create();
    const toggleSaveElement = new ToggleInput('show_save_button', 'Show Save/Reset in ☰', { defaultValue: false, callback: saveVisibility }).create();

    async function processUndoHotkey(event) {
        if (!isInputElementInFocus()) {
            if ((event.ctrlKey || event.metaKey) && !event.altKey) {
                //Undo.
                event.key === 'z' && await chatHistory.loadPreviousSnapshot();
                //Redo.
                event.key === 'Z' && await chatHistory.loadNextSnapshot();
            }
        }
    }

    const toggleEventFunction = (source, event, enabled, eventFunction) => {
        //Toggle on.
        if (enabled) { source.on(event, eventFunction); }
        //Toggle off.
        else { source.removeListener(event, eventFunction); }
    };

    const toggleUndoHotkey = (_, enabled, __) => {
        //Toggle on.
        if (enabled) { document.addEventListener('keydown', processUndoHotkey); }
        //Toggle off.
        else { document.removeEventListener('keydown', processUndoHotkey); }
    };

    const toggleUndoHotkeyElement = new ToggleInput('toggle_ctrl_z', 'Enable the ctrl-z/ctrl-Z hotkeys.', { defaultValue: false, callback: toggleUndoHotkey }).create();

    //Places the settings.
    const undoToggles = $('#undo_toggles');
    undoToggles.append(toggleMenuElement);
    undoToggles.append(toggleSaveElement);
    undoToggles.append(toggleUndoHotkeyElement);

    const undoAdvanced = $('#undo_advanced_options');

    //Debounce duration.
    let saveChatSnapshotDebounced;
    function setDebounced(id, value) {
        //This is not awaited so performance is less impacted.
        if (value > 0) {
            saveChatSnapshotDebounced = debounce(() => chatHistory.saveChatSnapshot(false), value ?? debounce_timeout.short);
        } else {
            saveChatSnapshotDebounced = () => chatHistory.saveChatSnapshot(false);
        }
    }
    setDebounced(undefined, extension_settings[extensionName]?.debounce_duration ?? debounce_timeout.short);
    function getDebounced(_, source) {
        //Needed to prevent redundant saves. https://github.com/SillyTavern/SillyTavern/pull/4819#discussion_r2571515880
        if (source !== 'undo') { return saveChatSnapshotDebounced(); }
    }

    const debounceSlider = new RangeInput('debounce_duration', 'Snapshot Debounce Duration in Milliseconds. Higher will take snapshots more often. (The Save button is not debounced.)', { min: 0, max: 10000, step: 10, defaultValue: debounce_timeout.short, callback: setDebounced }).create();

    //Resetting the chatHistory is necassary to update chunk_size.
    const resetDebounced = debounce(() => chatHistory.resetChatSnapshots(true), debounce_timeout.short);
    const chunkSizeElement = new RangeInput('chunk_size', 'History Chunk Size. ⚠️ This will ERASE your history! Higher will use more memory, lower will reduce performance.', { min: 1, max: 10000, step: 10, defaultValue: defaultChunkSize, callback: () => resetDebounced(), runCallbackOnLoad: false }).create();

    undoAdvanced.append(debounceSlider);
    undoAdvanced.append(chunkSizeElement);

    //Allow each event to be separately toggled.
    const eventToggles = $('#undo_events');
    for (const snapShotEvent of snapshotEvents) {
        //This will be called while each toggle is being created.
        const toggleSnapshot = (id, enabled, _) => toggleEventFunction(eventSource, id, enabled, getDebounced);
        const toggleSnapshotEvent = new ToggleInput(snapShotEvent, `Toggles saving the '${snapShotEvent}' event.`, { defaultValue: true, callback: toggleSnapshot }).create();
        eventToggles.append(toggleSnapshotEvent);
    }
}

/**
 * Creates a range input.
 */
class RangeInput {
    constructor( id, title, { dataStore = extension_settings[extensionName], callback = (id, value) => {}, category = extensionName, min = 0, max = 10000, step = 100, defaultValue = 1000, runCallbackOnLoad = true } = {}) {
        this.category = category;
        this.id = id;
        this.title = title;
        this.callback = callback;
        this.runCallbackOnLoad = runCallbackOnLoad;
        this.min = min;
        this.max = max;
        this.step = step;
        this.defaultValue = defaultValue;
        this.element = undefined;
    }
    create() {
        let html = `<div class="alignitemscenter flex-container flexFlowColumn flexGrow flexShrink gap0 flexBasis48p">
    <span data-i18n="${this.title}">${this.title}</span>
    <input class="neo-range-slider" type="range" id="${this.category}_${this.id}" name="${this.category}_${this.min}" min="${this.min}" max="${this.max}" step="${this.step}" value="${this.defaultValue}">
    <input class="neo-range-input" type="number" id="${this.category}_${this.id}_value" min="${this.min}" max="${this.max}" step="${this.step}" value="${this.defaultValue}">
</div>`;
        this.element = $(html);

        const sliderInput = this.element.find(`#${this.category}_${this.id}`);
        const textInput = this.element.find(`#${this.category}_${this.id}_value`);

        const onSliderElementInput = () => {
            const value = Number(sliderInput.val());
            extension_settings[extensionName][this.id] = value;
            textInput.val(value);
            saveSettingsDebounced();
            this.callback(this.id, value);
        };

        const onTextElementInput = () => {
            const value = Number(textInput.val());
            extension_settings[extensionName][this.id] = value;
            sliderInput.val(value);
            saveSettingsDebounced();
            this.callback(this.id, value);
        };

        const value = extension_settings[extensionName]?.[this.id] ?? this.defaultValue;
        sliderInput.val(value);
        textInput.val(value);
        sliderInput.on('input', onSliderElementInput);
        textInput.on('input', onTextElementInput);

        this.runCallbackOnLoad && this.callback(this.id, value);
        return this.element;
    }
}

/**
 * Creates a toggle button.
 */
class ToggleInput {
    constructor( id, title, { dataStore = extension_settings[extensionName], callback = (id, value) => {}, category = extensionName, defaultValue = true, runCallbackOnLoad = true } = {}) {
        this.category = category;
        this.id = id;
        this.callback = callback;
        this.runCallbackOnLoad = runCallbackOnLoad;
        this.title = title;
        this.defaultValue = defaultValue;
        this.element = undefined;
    }
    create() {
        let html = `<label class="checkbox_label" for="${this.category}_${this.id}">
    <input id="${this.category}_${this.id}" type="checkbox" class="checkbox">
    <span data-i18n="${this.title}">${this.title}</span>
</label>`;
        this.element = $(html);

        const buttonInput = this.element.find(`#${this.category}_${this.id}`);

        const onElementInput = () => {
            const value = buttonInput.prop('checked');
            extension_settings[extensionName][this.id] = value;
            saveSettingsDebounced();
            this.callback(this.id, value);
        };
        const value = extension_settings[extensionName]?.[this.id] ?? this.defaultValue;
        buttonInput.prop('checked', value);
        buttonInput.on('input', onElementInput);

        this.runCallbackOnLoad && this.callback(this.id, value);
        return this.element;
    }
}
