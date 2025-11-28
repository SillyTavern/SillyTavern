import { chatHistoryIndex, extensionName, loadChatSnapshot, resetChatSnapshots, saveChatSnapshot, snapshotEvents } from './index.js';
import { eventSource, saveSettingsDebounced } from '/script.js';
import { debounce_timeout } from '/scripts/constants.js';
import { extension_settings, renderExtensionTemplateAsync } from '/scripts/extensions.js';
import { debounce } from '/scripts/utils.js';

/**
 * Displays buttons in the options menu.
 */
export async function addButtons() {
    //Creates the buttons.
    const buttonsHtml = await renderExtensionTemplateAsync(extensionName, 'buttons');

    //Places the buttons.
    $('#options .options-content').prepend(buttonsHtml);

    //Undo.
    $(document).on('click', '#option_undo_undo', () => loadChatSnapshot(chatHistoryIndex - 1));
    //Redo.
    $(document).on('click', '#option_undo_redo', () => loadChatSnapshot(chatHistoryIndex + 1));

    //Save.
    $(document).on('click', '#option_undo_save', () => saveChatSnapshot(true));
    //Discard.
    $(document).on('click', '#option_undo_discard', () => resetChatSnapshots(true));
}

/**
 * Creates the settings UI.
 */
export async function addSettings() {

    //Creates the settings layout.
    const settingsHtml = await renderExtensionTemplateAsync(extensionName, 'settings');

    //Places the settings layout.
    $('#extensions_settings2').prepend(settingsHtml);

    //Creates sliders.
    const historyElement = new rangeInput('max_history', 'Max Undo History', { defaultValue: 100 }).create();
    const lengthElement = new rangeInput('max_length', 'Max chat length', { defaultValue: 512 }).create();

    //Places the sliders.
    const undoOptions = $('#undo_options');
    undoOptions.append(historyElement);
    undoOptions.append(lengthElement);

    //Toggles visibility of undo_buttons and undo_save_options.
    const menuVisibility = (_, value) => {$('#undo_buttons').toggle(!value);};
    const saveVisibility = (_, value) => $('#undo_save_options').toggle(!value);

    //Setting that toggles menuVisibility and saveVisibility.
    const toggleMenuElement = new toggleInput('show_menu_buttons', 'Hide the Undo/Redo Buttons from the Options Menu.', { defaultValue: false, callback: menuVisibility }).create();
    const toggleSaveElement = new toggleInput('show_save_button', 'Hide the Save/Reset Buttons from the Options Menu.', { defaultValue: true, callback: saveVisibility }).create();

    //Places the settings.
    const undoToggles = $('#undo_toggles');
    undoToggles.append(toggleMenuElement);
    undoToggles.append(toggleSaveElement);

    const undoAdvanced = $('#undo_advanced_options');

    //Debounce duration.
    let saveChatSnapshotDebounced;
    function setDebounced(id, value) {
        saveChatSnapshotDebounced = debounce(() => saveChatSnapshot(false), value ?? debounce_timeout.short);
    }
    setDebounced(undefined, extension_settings[extensionName]?.debounce_duration ?? debounce_timeout.short);
    function getDebounced(_, source) {
        //Needed to prevent redundant saves. https://github.com/SillyTavern/SillyTavern/pull/4819#discussion_r2571515880
        if (source !== 'undo') { return saveChatSnapshotDebounced(); }
    }

    const debounceSlider = new rangeInput('debounce_duration', 'Snapshot Debounce Duration in Milliseconds. Higher will take snapshots more often. (The Save button is not debounced.)', { min: 0, max: 10000, step: 1, defaultValue: debounce_timeout.short, callback: setDebounced }).create();
    undoAdvanced.append(debounceSlider);

    //Allow each event to be separately toggled.
    const eventToggles = $('#undo_events');
    for (const snapShotEvent of snapshotEvents) {
        //This will be called while each toggle is being created.
        const toggleSnapshot = (id, enabled) => {
            //Toggle on.
            if (enabled) { eventSource.on(id, getDebounced); }
            //Toggle off.
            else { eventSource.removeListener(id, getDebounced); }
        };
        const toggleSnapshotEvent = new toggleInput(snapShotEvent, `Toggles saving the '${snapShotEvent}' event.`, { defaultValue: true, callback: toggleSnapshot }).create();
        eventToggles.append(toggleSnapshotEvent);
    }
}

/**
 * Creates a range input.
 */
class rangeInput {
    constructor( id, title, { dataStore = extension_settings[extensionName], callback = (id, value) => {}, category = extensionName, min = 0, max = 10000, step = 100, defaultValue = 1000 } = {}) {
        this.category = category;
        this.id = id;
        this.title = title;
        this.callback = callback;
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

        this.callback(this.id, value);
        return this.element;
    }
}

/**
 * Creates a toggle button.
 */
class toggleInput {
    constructor( id, title, { dataStore = extension_settings[extensionName], callback = (id, value) => {}, category = extensionName, defaultValue = true } = {}) {
        this.category = category;
        this.id = id;
        this.callback = callback;
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

        this.callback(this.id, value);
        return this.element;
    }
}
