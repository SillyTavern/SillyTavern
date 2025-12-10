import { chatHistory, defaultMaxChatLength, defaultMaxUndoSnapshots, defaultSaveDebounceDuration, defaultShowToasts, extensionName, snapshotEvents } from './index.js';
import { eventSource, saveSettingsDebounced } from '/script.js';
import { extension_settings, renderExtensionTemplateAsync } from '/scripts/extensions.js';
import { debounce, isInputElementInFocus } from '/scripts/utils.js';

/**
 * Displays buttons in the options menu.
 */
export async function addOptionsButtons() {
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

export async function addSettingsToggles() {
    //Toggles visibility of undo_buttons and undo_save_options.
    const menuVisibility = (_, value) => {$('#undo_buttons').toggle(value);};
    const saveVisibility = (_, value) => $('#undo_save_options').toggle(value);

    //Setting that toggles menuVisibility and saveVisibility.
    const toggleMenuElement = new ToggleInput('show_menu_buttons', 'Show Undo/Redo in ☰', { defaultValue: true, callback: menuVisibility }).create();
    const toggleSaveElement = new ToggleInput('show_save_button', 'Show Save/Reset in ☰', { defaultValue: false, callback: saveVisibility }).create();
    const toggleToastsElement = new ToggleInput('show_toasts', 'Show toasts on Undo/Redo.', { defaultValue: defaultShowToasts }).create();

    //Clicks all the toggles.
    const toggleExtension = (_, enabled) => {
        const buttons = [`#${extensionName}_show_menu_buttons`, `#${extensionName}_show_save_button`, `#${extensionName}_toggle_ctrl_z`, `#${extensionName}_show_toasts`];
        for (const snapShotEvent of snapshotEvents) {
            buttons.push(`#${extensionName}_${snapShotEvent}`);
        }
        // @ts-ignore
        $(buttons.join(', ')).filter(function() { return this.checked !== enabled; }).trigger('click');
        //Needed? chatHistory.chatHistory.length = 0
    };

    //When any setting is toggled, show the extension as enabled.
    eventSource.on(`extension_${extensionName}`, (setting, value) => {
        if ((['show_menu_buttons', 'show_save_button', 'toggle_ctrl_z', 'show_toasts'].includes(setting) || setting.includes('message_')) && value) {
            // @ts-ignore
            $(`#${extensionName}_enable_extension`)[0].checked = true;
            extension_settings[extensionName].enable_extension = true;
            saveSettingsDebounced();
        }
    });

    const enableExtension = new ToggleInput('enable_extension', 'Enable the extension.', { defaultValue: true, callback: toggleExtension, runCallbackOnLoad: false }).create();

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

    const toggleUndoHotkey = (_, enabled, __) => {
        //Toggle on.
        if (enabled) { document.addEventListener('keydown', processUndoHotkey); }
        //Toggle off.
        else { document.removeEventListener('keydown', processUndoHotkey); }
    };

    const toggleUndoHotkeyElement = new ToggleInput('toggle_ctrl_z', 'Enable the Ctrl+Z/Ctrl+Shift+Z hotkeys.', { defaultValue: false, callback: toggleUndoHotkey }).create();

    //Places the settings.
    const undoToggles = $('#undo_toggles');
    undoToggles.append(enableExtension);
    undoToggles.append(toggleMenuElement);
    undoToggles.append(toggleSaveElement);
    undoToggles.append(toggleToastsElement);
    undoToggles.append(toggleUndoHotkeyElement);

}

export async function addSettingsSliders() {
    //Creates sliders.
    //MaxChatHistory will apply next time a save occurs.
    const maxSnapshotsElement = new RangeInput('max_snapshots', 'Max Undo Snapshots', { defaultValue: defaultMaxUndoSnapshots }).create();
    const lengthElement = new RangeInput('max_length', 'Max Chat Length', { defaultValue: defaultMaxChatLength }).create();

    //Places the sliders.
    const undoOptions = $('#undo_options');
    undoOptions.append(maxSnapshotsElement);
    undoOptions.append(lengthElement);

}

export async function addSettingsAdvancedToggles() {
    //Debounce duration.
    //Needed to prevent redundant saves. https://github.com/SillyTavern/SillyTavern/pull/4819#discussion_r2571515880
    let saveChatSnapshotDebounced = debounce(() => chatHistory.saveChatSnapshot(false), extension_settings[extensionName]?.debounce_duration ?? defaultSaveDebounceDuration);


    const toggleEventFunction = (source, event, enabled, eventFunction) => {
        //Toggle on.
        if (enabled) { source.on(event, eventFunction); }
        //Toggle off.
        else { source.removeListener(event, eventFunction); }
    };

    //Allow each event to be separately toggled.
    const eventToggles = $('#undo_events');
    for (const snapShotEvent of snapshotEvents) {
        //This will be called while each toggle is being created.
        const toggleSnapshot = (id, enabled, _) => toggleEventFunction(eventSource, id, enabled, saveChatSnapshotDebounced);
        const toggleSnapshotEvent = new ToggleInput(`${snapShotEvent}`, `Toggles saving the '${snapShotEvent}' event.`, { defaultValue: true, callback: toggleSnapshot }).create();
        eventToggles.append(toggleSnapshotEvent);
    }
}
/**
 * Creates the settings UI.
 */
export async function addSettings() {

    //Creates the settings layout.
    const settingsHtml = await renderExtensionTemplateAsync(extensionName, 'settings');

    //Places the settings layout.
    $('#undo_container').append(settingsHtml);

    await addSettingsToggles();
    await addSettingsSliders();
    await addSettingsAdvancedToggles();
}

/**
 * Boilerplate.
 */
class UserInput {
    constructor( id, title, { dataStore = extension_settings[extensionName], callback = (id, value) => {}, category = extensionName, runCallbackOnLoad = true } = {}) {
        this.id = id;
        this.title = title;
        this.dataStore = dataStore;
        this.callback = callback;
        this.category = category;
        this.runCallbackOnLoad = runCallbackOnLoad;
        this.element = undefined;
    }
}


/**
 * Creates a toggle button.
 */
class ToggleInput extends UserInput {
    constructor( id, title, { dataStore = extension_settings[extensionName], callback = (id, value) => {}, category = extensionName, defaultValue = true, runCallbackOnLoad = true } = {}) {
        super(id, title, { dataStore, callback, category, runCallbackOnLoad });
        this.defaultValue = defaultValue;        this.element = undefined;
        this.html = `<label class="checkbox_label" for="${this.category}_${this.id}">
    <input id="${this.category}_${this.id}" type="checkbox" class="checkbox">
    <span data-i18n="${this.title}">${this.title}</span>
</label>`;
    }
    create() {
        this.element = $(this.html);

        const buttonInput = this.element.find(`#${this.category}_${this.id}`);

        const onElementInput = async () => {
            const value = buttonInput.prop('checked');
            this.dataStore[this.id] = value;
            saveSettingsDebounced();
            this.callback(this.id, value);
            await eventSource.emit(`extension_${extensionName}`, this.id, value);
        };
        const value = this.dataStore?.[this.id] ?? this.defaultValue;
        buttonInput.prop('checked', value);
        buttonInput.on('input', onElementInput);

        this.runCallbackOnLoad && this.callback(this.id, value);
        return this.element;
    }
}

/**
 * Creates a range input.
 */
class RangeInput extends UserInput {
    constructor( id, title, { dataStore = extension_settings[extensionName], callback = (id, value) => {}, category = extensionName, defaultValue = 1000, runCallbackOnLoad = true, min = 0, max = 10000, step = 10 } = {}) {
        super(id, title, { dataStore, callback, category, runCallbackOnLoad });
        this.defaultValue = defaultValue;
        this.min = min;
        this.max = max;
        this.step = step;
        this.element = undefined;
        this.html = `<div class="alignitemscenter flex-container flexFlowColumn flexGrow flexShrink gap0 flexBasis48p">
    <span data-i18n="${this.title}">${this.title}</span>
    <input class="neo-range-slider" type="range" id="${this.category}_${this.id}" name="${this.category}_${this.min}" min="${this.min}" max="${this.max}" step="${this.step}" value="${this.defaultValue}">
    <input class="neo-range-input" type="number" id="${this.category}_${this.id}_value" min="${this.min}" max="${this.max}" step="${this.step}" value="${this.defaultValue}">
</div>`;
    }
    create() {
        this.element = $(this.html);

        const sliderInput = this.element.find(`#${this.category}_${this.id}`);
        const textInput = this.element.find(`#${this.category}_${this.id}_value`);

        const handleInput = async (mainInput, syncedInput) => {
            const value = Number(mainInput.val());
            this.dataStore[this.id] = value;
            syncedInput?.val(value);
            saveSettingsDebounced();
            this.callback(this.id, value);
            await eventSource.emit(`extension_${extensionName}`, this.id, value);
        };
        const onSliderElementInput = async () => {
            handleInput(sliderInput, textInput);
        };

        const onTextElementInput = async () => {
            handleInput(textInput, sliderInput);
        };

        const value = this.dataStore?.[this.id] ?? this.defaultValue;
        sliderInput.val(value);
        textInput.val(value);
        sliderInput.on('input', onSliderElementInput);
        textInput.on('input', onTextElementInput);

        this.runCallbackOnLoad && this.callback(this.id, value);
        return this.element;
    }
}
