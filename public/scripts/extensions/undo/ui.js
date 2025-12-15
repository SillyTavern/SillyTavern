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

export async function addSettingsToggles(toggles) {
    //Toggles visibility of undo_buttons and undo_save_options.
    const menuVisibility = (_, value) => {$('#undo_buttons').toggle(value);};
    const saveVisibility = (_, value) => $('#undo_save_options').toggle(value);


    //Clicks all the toggles.
    const toggleExtension = (_, enabled) => {
        if (enabled) chatHistory.resetChatSnapshots(true);
        else (chatHistory.chatHistory = []);
        //On disabled, toggle all buttons off.
        if (!enabled) toggles.forEach((toggle) => toggle.toggle(enabled) );
        //On enabled, reset all buttons.
        if (enabled) toggles.forEach((toggle) => toggle.reset() );
    };

    //When a setting is toggled, the enableExtension button may need to be enabled or disabled.
    eventSource.on(`extension_${extensionName}`, (setting, value) => {
        if ((['showMenuButtons', 'showSaveButtons', 'enableCtrlZ', 'showToasts'].includes(setting) || setting.includes('message_'))) {
            //When any setting is toggled, show the extension as enabled.
            if (value) {
                enableExtension.set(value);
            }
            //Or, If all settings are disabled, show the extension as disabled.
            else if (!(toggles.map((toggle) => toggle.toggled())).some((enabled) => { return enabled; })) {
                enableExtension.set(value);
            }
        }
    });


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

    const toggleUndoHotkeyEvent = (_, enabled, __) => {
        //Toggle on.
        if (enabled) { document.addEventListener('keydown', processUndoHotkey); }
        //Toggle off.
        else { document.removeEventListener('keydown', processUndoHotkey); }
    };


    //Places the settings.
    const undoToggles = $('#undo_toggles');
    //Setting that toggles menuVisibility and saveVisibility.
    const enableExtension = new ToggleInput('enable_extension', 'Enable the extension.', { parent: undoToggles, defaultValue: false, callback: toggleExtension, runCallbackOnLoad: false });
    const toggleMenu = new ToggleInput('showMenuButtons', 'Show Undo/Redo in ☰', { parent: undoToggles, defaultValue: true, callback: menuVisibility });
    const toggleSave = new ToggleInput('showSaveButtons', 'Show Save/Reset in ☰', { parent: undoToggles, defaultValue: false, callback: saveVisibility });
    const toggleToasts = new ToggleInput('showToasts', 'Show toasts on Undo/Redo.', { parent: undoToggles, defaultValue: defaultShowToasts });
    const toggleUndoHotkey = new ToggleInput('enableCtrlZ', 'Enable the Ctrl+Z/Ctrl+Shift+Z hotkeys.', { defaultValue: false, callback: toggleUndoHotkeyEvent });
    toggles.push(toggleMenu, toggleSave, toggleToasts, toggleUndoHotkey);
}

export async function addSettingsSliders(sliders) {
    //Creates sliders.
    //maxUndoSnapshots will apply next time a save occurs.

    //Places the sliders.
    const undoOptions = $('#undo_options');
    const maxSnapshots = new RangeInput('maxUndoSnapshots', 'Max Undo Snapshots', { parent: undoOptions, defaultValue: defaultMaxUndoSnapshots });
    const maxLength = new RangeInput('maxChatLength', 'Max Chat Length', { parent: undoOptions, defaultValue: defaultMaxChatLength });
    sliders = [maxSnapshots, maxLength];
}

export async function addSettingsAdvancedToggles(toggles) {
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
        //This will be called as each toggle is created.
        const toggleSnapshot = (id, enabled, _) => toggleEventFunction(eventSource, id, enabled, saveChatSnapshotDebounced);
        const toggleSnapshotEvent = new ToggleInput(`${snapShotEvent}`, `Toggles saving the '${snapShotEvent}' event.`, { parent: eventToggles, defaultValue: true, callback: toggleSnapshot });
        toggles.push(toggleSnapshotEvent);
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

    //This does not include the enableExtension toggle.
    let toggles = [];
    await addSettingsToggles(toggles);
    let sliders = [];
    await addSettingsSliders(sliders);
    await addSettingsAdvancedToggles(toggles);
}

/**
 * Boilerplate.
 */
class UserInput {
    constructor( id, title, { dataStore = extension_settings[extensionName], callback = (id, value) => {}, category = extensionName, runCallbackOnLoad = true, parent = undefined } = {}) {
        this.id = id;
        this.title = title;
        this.dataStore = dataStore;
        this.callback = callback;
        this.category = category;
        this.runCallbackOnLoad = runCallbackOnLoad;
        this.parent = parent;
        this.element = undefined;
    }
}


/**
 * Creates a toggle button.
 */
class ToggleInput extends UserInput {
    constructor( id, title, { dataStore = extension_settings[extensionName], callback = (id, value) => {}, category = extensionName, defaultValue = true, initialValue = false, runCallbackOnLoad = true, parent = undefined } = {}) {
        super(id, title, { dataStore, callback, category, runCallbackOnLoad, parent });
        this.defaultValue = defaultValue;
        this.initialValue = initialValue; //The initial value before the extension has been disabled.
        this.html = `<label class="undo_toggle checkbox_label" for="${this.category}_${this.id}">
    <input id="${this.category}_${this.id}" type="checkbox" class="checkbox">
    <span data-i18n="${this.title}">${this.title}</span>
</label>`;
        this.buttonElement = undefined;
        this.element = this.create();
    }
    create() {
        this.element = $(this.html);

        const buttonElement = this.element.find(`#${this.category}_${this.id}`);
        this.buttonElement = buttonElement;

        const onElementInput = async () => {
            const value = buttonElement.prop('checked');
            this.dataStore[this.id] = value;
            saveSettingsDebounced();
            this.callback(this.id, value);
            await eventSource.emit(`extension_${extensionName}`, this.id, value);
        };
        const value = this.dataStore?.[this.id] ?? this.initialValue;
        buttonElement.prop('checked', value);
        buttonElement.on('input', onElementInput);
        if(this.runCallbackOnLoad) this.callback(this.id, value);
        if (this.parent) {this.parent.append(this.element);}
        return this.element;
    }
    toggled() { return this.buttonElement[0].checked; }
    click() {return this.buttonElement.trigger('click'); }

    //Toggles the button on or off.
    toggle(enabled) {
        if(this.toggled() !== enabled ) this.click();
    }
    //Sets the button without clicking it.
    set(enabled) {
        this.buttonElement[0].checked = enabled;
        this.dataStore[this.id] = enabled;
        saveSettingsDebounced();
    }
    //Sets the button to it's default state without clicking it.
    setDefault() {
        this.buttonElement[0].checked = this.defaultValue;
        this.dataStore[this.id] = this.defaultValue;
        saveSettingsDebounced();
    }

    //Toggles the button to it's default state.
    reset() {
        if(this.toggled() !== this.defaultValue ) this.click();
    }
}

/**
 * Creates a range input.
 */
class RangeInput extends UserInput {
    constructor( id, title, { dataStore = extension_settings[extensionName], callback = (id, value) => {}, category = extensionName, defaultValue = 1000, runCallbackOnLoad = true, min = 0, max = 10000, step = 10, parent = undefined } = {}) {
        super(id, title, { dataStore, callback, category, runCallbackOnLoad, parent });
        this.defaultValue = defaultValue;
        this.min = min;
        this.max = max;
        this.step = step;
        this.html = `<div class="undo_slider alignitemscenter flex-container flexFlowColumn flexGrow flexShrink gap0 flexBasis48p">
    <span data-i18n="${this.title}">${this.title}</span>
    <input class="neo-range-slider" type="range" id="${this.category}_${this.id}" name="${this.category}_${this.min}" min="${this.min}" max="${this.max}" step="${this.step}" value="${this.defaultValue}">
    <input class="neo-range-input" type="number" id="${this.category}_${this.id}_value" min="${this.min}" max="${this.max}" step="${this.step}" value="${this.defaultValue}">
</div>`;
        this.sliderElement = undefined;
        this.textElement = undefined;
        this.element = this.create();
    }
    create() {
        this.element = $(this.html);

        const sliderInput = this.element.find(`#${this.category}_${this.id}`);
        const textInput = this.element.find(`#${this.category}_${this.id}_value`);
        this.sliderInput = sliderInput;
        this.textInput = textInput;

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

        if(this.runCallbackOnLoad) this.callback(this.id, value);
        if (this.parent) {this.parent.append(this.element);}
        return this.element;
    }
}
