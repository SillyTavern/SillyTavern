import {
    amount_gen,
    characters,
    eventSource,
    event_types,
    getRequestHeaders,
    koboldai_setting_names,
    koboldai_settings,
    main_api,
    max_context,
    nai_settings,
    novelai_setting_names,
    novelai_settings,
    online_status,
    saveSettingsDebounced,
    this_chid,
} from '../script.js';
import { groups, selected_group } from './group-chats.js';
import { instruct_presets } from './instruct-mode.js';
import { kai_settings } from './kai-settings.js';
import { convertNovelPreset } from './nai-settings.js';
import { Popup, POPUP_RESULT, POPUP_TYPE } from './popup.js';
import { context_presets, getContextSettings, power_user } from './power-user.js';
import { SlashCommand } from './slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument } from './slash-commands/SlashCommandArgument.js';
import { enumIcons } from './slash-commands/SlashCommandCommonEnumsProvider.js';
import { SlashCommandEnumValue, enumTypes } from './slash-commands/SlashCommandEnumValue.js';
import { SlashCommandParser } from './slash-commands/SlashCommandParser.js';
import { checkForSystemPromptInInstructTemplate, system_prompts } from './sysprompt.js';
import { renderTemplateAsync } from './templates.js';
import {
    textgenerationwebui_preset_names,
    textgenerationwebui_presets,
    textgenerationwebui_settings as textgen_settings,
} from './textgen-settings.js';
import { download, parseJsonFile, waitUntilCondition } from './utils.js';

const presetManagers = {};

/**
 * Automatically select a preset for current API based on character or group name.
 */
function autoSelectPreset() {
    const presetManager = getPresetManager();

    if (!presetManager) {
        console.debug(`Preset Manager not found for API: ${main_api}`);
        return;
    }

    const name = selected_group ? groups.find(x => x.id == selected_group)?.name : characters[this_chid]?.name;

    if (!name) {
        console.debug(`Preset candidate not found for API: ${main_api}`);
        return;
    }

    const preset = presetManager.findPreset(name);
    const selectedPreset = presetManager.getSelectedPreset();

    if (preset === selectedPreset) {
        console.debug(`Preset already selected for API: ${main_api}, name: ${name}`);
        return;
    }

    if (preset !== undefined && preset !== null) {
        console.log(`Preset found for API: ${main_api}, name: ${name}`);
        presetManager.selectPreset(preset);
    }
}

/**
 * Gets a preset manager by API id.
 * @param {string} apiId API id
 * @returns {PresetManager} Preset manager
 */
export function getPresetManager(apiId = '') {
    if (!apiId) {
        apiId = main_api == 'koboldhorde' ? 'kobold' : main_api;
    }

    if (!Object.keys(presetManagers).includes(apiId)) {
        return null;
    }

    return presetManagers[apiId];
}

/**
 * Registers preset managers for all select elements with data-preset-manager-for attribute.
 */
function registerPresetManagers() {
    $('select[data-preset-manager-for]').each((_, e) => {
        const forData = $(e).data('preset-manager-for');
        for (const apiId of forData.split(',')) {
            console.debug(`Registering preset manager for API: ${apiId}`);
            presetManagers[apiId] = new PresetManager($(e), apiId);
        }
    });
}

class PresetManager {
    constructor(select, apiId) {
        this.select = select;
        this.apiId = apiId;
    }

    static masterSections = {
        'instruct': {
            name: 'Instruct Template',
            getData: () => {
                const manager = getPresetManager('instruct');
                const name = manager.getSelectedPresetName();
                return manager.getPresetSettings(name);
            },
            setData: (data) => {
                const manager = getPresetManager('instruct');
                const name = data.name;
                return manager.savePreset(name, data);
            },
            isValid: (data) => PresetManager.isPossiblyInstructData(data),
        },
        'context': {
            name: 'Context Template',
            getData: () => {
                const manager = getPresetManager('context');
                const name = manager.getSelectedPresetName();
                return manager.getPresetSettings(name);
            },
            setData: (data) => {
                const manager = getPresetManager('context');
                const name = data.name;
                return manager.savePreset(name, data);
            },
            isValid: (data) => PresetManager.isPossiblyContextData(data),
        },
        'sysprompt': {
            name: 'System Prompt',
            getData: () => {
                const manager = getPresetManager('sysprompt');
                const name = manager.getSelectedPresetName();
                return manager.getPresetSettings(name);
            },
            setData: (data) => {
                const manager = getPresetManager('sysprompt');
                const name = data.name;
                return manager.savePreset(name, data);
            },
            isValid: (data) => PresetManager.isPossiblySystemPromptData(data),
        },
        'preset': {
            name: 'Text Completion Preset',
            getData: () => {
                const manager = getPresetManager('textgenerationwebui');
                const name = manager.getSelectedPresetName();
                const data = manager.getPresetSettings(name);
                data['name'] = name;
                return data;
            },
            setData: (data) => {
                const manager = getPresetManager('textgenerationwebui');
                const name = data.name;
                return manager.savePreset(name, data);
            },
            isValid: (data) => PresetManager.isPossiblyTextCompletionData(data),
        },
    };

    static isPossiblyInstructData(data) {
        const instructProps = ['name', 'input_sequence', 'output_sequence'];
        return data && instructProps.every(prop => Object.keys(data).includes(prop));
    }

    static isPossiblyContextData(data) {
        const contextProps = ['name', 'story_string'];
        return data && contextProps.every(prop => Object.keys(data).includes(prop));
    }

    static isPossiblySystemPromptData(data) {
        const sysPromptProps = ['name', 'content'];
        return data && sysPromptProps.every(prop => Object.keys(data).includes(prop));
    }

    static isPossiblyTextCompletionData(data) {
        const textCompletionProps = ['temp', 'top_k', 'top_p', 'rep_pen'];
        return data && textCompletionProps.every(prop => Object.keys(data).includes(prop));
    }

    /**
     * Imports master settings from JSON data.
     * @param {object} data Data to import
     * @param {string} fileName File name
     * @returns {Promise<void>}
     */
    static async performMasterImport(data, fileName) {
        if (!data || typeof data !== 'object') {
            toastr.error('Invalid data provided for master import');
            return;
        }

        // Check for legacy file imports
        // 1. Instruct Template
        if (this.isPossiblyInstructData(data)) {
            toastr.info('Importing instruct template...', 'Instruct template detected');
            return await getPresetManager('instruct').savePreset(data.name, data);
        }

        // 2. Context Template
        if (this.isPossiblyContextData(data)) {
            toastr.info('Importing as context template...', 'Context template detected');
            return await getPresetManager('context').savePreset(data.name, data);
        }

        // 3. System Prompt
        if (this.isPossiblySystemPromptData(data)) {
            toastr.info('Importing as system prompt...', 'System prompt detected');
            return await getPresetManager('sysprompt').savePreset(data.name, data);
        }

        // 4. Text Completion settings
        if (this.isPossiblyTextCompletionData(data)) {
            toastr.info('Importing as settings preset...', 'Text Completion settings detected');
            return await getPresetManager('textgenerationwebui').savePreset(fileName, data);
        }

        const validSections = [];
        for (const [key, section] of Object.entries(this.masterSections)) {
            if (key in data && section.isValid(data[key])) {
                validSections.push(key);
            }
        }

        if (validSections.length === 0) {
            toastr.error('No valid sections found in imported data');
            return;
        }

        const sectionNames = validSections.reduce((acc, key) => {
            acc[key] = { key: key, name: this.masterSections[key].name, preset: data[key]?.name || '' };
            return acc;
        }, {});

        const html = $(await renderTemplateAsync('masterImport', { sections: sectionNames }));
        const popup = new Popup(html, POPUP_TYPE.CONFIRM, '', {
            okButton: 'Import',
            cancelButton: 'Cancel',
        });

        const result = await popup.show();

        // Import cancelled
        if (result !== POPUP_RESULT.AFFIRMATIVE) {
            return;
        }

        const importedSections = [];
        const confirmedSections = html.find('input:checked').map((_, el) => el instanceof HTMLInputElement && el.value).get();

        if (confirmedSections.length === 0) {
            toastr.info('No sections selected for import');
            return;
        }

        for (const section of confirmedSections) {
            const sectionData = data[section];
            const masterSection = this.masterSections[section];
            if (sectionData && masterSection) {
                await masterSection.setData(sectionData);
                importedSections.push(masterSection.name);
            }
        }

        toastr.success(`Imported ${importedSections.length} settings: ${importedSections.join(', ')}`);
    }

    /**
     * Exports master settings to JSON data.
     * @returns {Promise<string>} JSON data
     */
    static async performMasterExport() {
        const sectionNames = Object.entries(this.masterSections).reduce((acc, [key, section]) => {
            acc[key] = { key: key, name: section.name, checked: key !== 'preset' };
            return acc;
        }, {});
        const html = $(await renderTemplateAsync('masterExport', { sections: sectionNames }));

        const popup = new Popup(html, POPUP_TYPE.CONFIRM, '', {
            okButton: 'Export',
            cancelButton: 'Cancel',
        });

        const result = await popup.show();

        // Export cancelled
        if (result !== POPUP_RESULT.AFFIRMATIVE) {
            return;
        }

        const confirmedSections = html.find('input:checked').map((_, el) => el instanceof HTMLInputElement && el.value).get();
        const data = {};

        if (confirmedSections.length === 0) {
            toastr.info('No sections selected for export');
            return;
        }

        for (const section of confirmedSections) {
            const masterSection = this.masterSections[section];
            if (masterSection) {
                data[section] = masterSection.getData();
            }
        }

        return JSON.stringify(data, null, 4);
    }

    /**
     * Gets all preset names.
     * @returns {string[]} List of preset names
     */
    getAllPresets() {
        return $(this.select).find('option').map((_, el) => el.text).toArray();
    }

    /**
     * Finds a preset by name.
     * @param {string} name Preset name
     * @returns {any} Preset value
     */
    findPreset(name) {
        return $(this.select).find('option').filter(function() {
            return $(this).text() === name;
        }).val();
    }

    /**
     * Gets the selected preset value.
     * @returns {any} Selected preset value
     */
    getSelectedPreset() {
        return $(this.select).find('option:selected').val();
    }

    /**
     * Gets the selected preset name.
     * @returns {string} Selected preset name
     */
    getSelectedPresetName() {
        return $(this.select).find('option:selected').text();
    }

    /**
     * Selects a preset by option value.
     * @param {string} value Preset option value
     */
    selectPreset(value) {
        const option = $(this.select).filter(function() {
            return $(this).val() === value;
        });
        option.prop('selected', true);
        $(this.select).val(value).trigger('change');
    }

    async updatePreset() {
        const selected = $(this.select).find('option:selected');
        console.log(selected);

        if (selected.val() == 'gui') {
            toastr.info('Cannot update GUI preset');
            return;
        }

        const name = selected.text();
        await this.savePreset(name);

        const successToast = !this.isAdvancedFormatting() ? 'Preset updated' : 'Template updated';
        toastr.success(successToast);
    }

    async savePresetAs() {
        const inputValue = this.getSelectedPresetName();
        const popupText = !this.isAdvancedFormatting() ? '<h4>Hint: Use a character/group name to bind preset to a specific chat.</h4>' : '';
        const headerText = !this.isAdvancedFormatting() ? 'Preset name:' : 'Template name:';
        const name = await Popup.show.input(headerText, popupText, inputValue);
        if (!name) {
            console.log('Preset name not provided');
            return;
        }

        await this.savePreset(name);

        const successToast = !this.isAdvancedFormatting() ? 'Preset saved' : 'Template saved';
        toastr.success(successToast);
    }

    async savePreset(name, settings) {
        if (this.apiId === 'instruct' && settings) {
            await checkForSystemPromptInInstructTemplate(name, settings);
        }

        if (this.apiId === 'novel' && settings) {
            settings = convertNovelPreset(settings);
        }

        const preset = settings ?? this.getPresetSettings(name);

        const response = await fetch('/api/presets/save', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ preset, name, apiId: this.apiId }),
        });

        if (!response.ok) {
            toastr.error('Check the server connection and reload the page to prevent data loss.', 'Preset could not be saved');
            console.error('Preset could not be saved', response);
            throw new Error('Preset could not be saved');
        }

        const data = await response.json();
        name = data.name;

        this.updateList(name, preset);
    }

    getPresetList() {
        let presets = [];
        let preset_names = {};

        switch (this.apiId) {
            case 'koboldhorde':
            case 'kobold':
                presets = koboldai_settings;
                preset_names = koboldai_setting_names;
                break;
            case 'novel':
                presets = novelai_settings;
                preset_names = novelai_setting_names;
                break;
            case 'textgenerationwebui':
                presets = textgenerationwebui_presets;
                preset_names = textgenerationwebui_preset_names;
                break;
            case 'context':
                presets = context_presets;
                preset_names = context_presets.map(x => x.name);
                break;
            case 'instruct':
                presets = instruct_presets;
                preset_names = instruct_presets.map(x => x.name);
                break;
            case 'sysprompt':
                presets = system_prompts;
                preset_names = system_prompts.map(x => x.name);
                break;
            default:
                console.warn(`Unknown API ID ${this.apiId}`);
        }

        return { presets, preset_names };
    }

    isKeyedApi() {
        return this.apiId == 'textgenerationwebui' || this.isAdvancedFormatting();
    }

    isAdvancedFormatting() {
        return this.apiId == 'context' || this.apiId == 'instruct' || this.apiId == 'sysprompt';
    }

    updateList(name, preset) {
        const { presets, preset_names } = this.getPresetList();
        const presetExists = this.isKeyedApi() ? preset_names.includes(name) : Object.keys(preset_names).includes(name);

        if (presetExists) {
            if (this.isKeyedApi()) {
                presets[preset_names.indexOf(name)] = preset;
                $(this.select).find(`option[value="${name}"]`).prop('selected', true);
                $(this.select).val(name).trigger('change');
            }
            else {
                const value = preset_names[name];
                presets[value] = preset;
                $(this.select).find(`option[value="${value}"]`).prop('selected', true);
                $(this.select).val(value).trigger('change');
            }
        }
        else {
            presets.push(preset);
            const value = presets.length - 1;

            if (this.isKeyedApi()) {
                preset_names[value] = name;
                const option = $('<option></option>', { value: name, text: name, selected: true });
                $(this.select).append(option);
                $(this.select).val(name).trigger('change');
            } else {
                preset_names[name] = value;
                const option = $('<option></option>', { value: value, text: name, selected: true });
                $(this.select).append(option);
                $(this.select).val(value).trigger('change');
            }
        }
    }

    getPresetSettings(name) {
        function getSettingsByApiId(apiId) {
            switch (apiId) {
                case 'koboldhorde':
                case 'kobold':
                    return kai_settings;
                case 'novel':
                    return nai_settings;
                case 'textgenerationwebui':
                    return textgen_settings;
                case 'context': {
                    const context_preset = getContextSettings();
                    context_preset['name'] = name || power_user.context.preset;
                    return context_preset;
                }
                case 'instruct': {
                    const instruct_preset = structuredClone(power_user.instruct);
                    instruct_preset['name'] = name || power_user.instruct.preset;
                    return instruct_preset;
                }
                case 'sysprompt': {
                    const sysprompt_preset = structuredClone(power_user.sysprompt);
                    sysprompt_preset['name'] = name || power_user.sysprompt.preset;
                    return sysprompt_preset;
                }
                default:
                    console.warn(`Unknown API ID ${apiId}`);
                    return {};
            }
        }

        const filteredKeys = [
            'preset',
            'streaming',
            'truncation_length',
            'n',
            'streaming_url',
            'stopping_strings',
            'can_use_tokenization',
            'can_use_streaming',
            'preset_settings_novel',
            'streaming_novel',
            'nai_preamble',
            'model_novel',
            'streaming_kobold',
            'enabled',
            'bind_to_context',
            'seed',
            'legacy_api',
            'mancer_model',
            'togetherai_model',
            'ollama_model',
            'vllm_model',
            'aphrodite_model',
            'server_urls',
            'type',
            'custom_model',
            'bypass_status_check',
            'infermaticai_model',
            'dreamgen_model',
            'openrouter_model',
            'featherless_model',
            'max_tokens_second',
            'openrouter_providers',
            'openrouter_allow_fallbacks',
            'tabby_model',
        ];
        const settings = Object.assign({}, getSettingsByApiId(this.apiId));

        for (const key of filteredKeys) {
            if (Object.hasOwn(settings, key)) {
                delete settings[key];
            }
        }

        if (!this.isAdvancedFormatting()) {
            settings['genamt'] = amount_gen;
            settings['max_length'] = max_context;
        }

        return settings;
    }

    async deleteCurrentPreset() {
        const { preset_names, presets } = this.getPresetList();
        const value = this.getSelectedPreset();
        const nameToDelete = this.getSelectedPresetName();

        if (value == 'gui') {
            toastr.info('Cannot delete GUI preset');
            return;
        }

        $(this.select).find(`option[value="${value}"]`).remove();

        if (this.isKeyedApi()) {
            const index = preset_names.indexOf(nameToDelete);
            preset_names.splice(index, 1);
            presets.splice(index, 1);
        } else {
            delete preset_names[nameToDelete];
        }

        if (Object.keys(preset_names).length) {
            const nextPresetName = Object.keys(preset_names)[0];
            const newValue = preset_names[nextPresetName];
            $(this.select).find(`option[value="${newValue}"]`).attr('selected', 'true');
            $(this.select).trigger('change');
        }

        const response = await fetch('/api/presets/delete', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ name: nameToDelete, apiId: this.apiId }),
        });

        return response.ok;
    }

    async getDefaultPreset(name) {
        const response = await fetch('/api/presets/restore', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ name, apiId: this.apiId }),
        });

        if (!response.ok) {
            const errorToast = !this.isAdvancedFormatting() ? 'Failed to restore default preset' : 'Failed to restore default template';
            toastr.error(errorToast);
            return;
        }

        return await response.json();
    }
}

/**
 * Selects a preset by name for current API.
 * @param {any} _ Named arguments
 * @param {string} name Unnamed arguments
 * @returns {Promise<string>} Selected or current preset name
 */
async function presetCommandCallback(_, name) {
    const shouldReconnect = online_status !== 'no_connection';
    const presetManager = getPresetManager();
    const allPresets = presetManager.getAllPresets();
    const currentPreset = presetManager.getSelectedPresetName();

    if (!presetManager) {
        console.debug(`Preset Manager not found for API: ${main_api}`);
        return '';
    }

    if (!name) {
        console.log('No name provided for /preset command, using current preset');
        return currentPreset;
    }

    if (!Array.isArray(allPresets) || allPresets.length === 0) {
        console.log(`No presets found for API: ${main_api}`);
        return currentPreset;
    }

    // Find exact match
    const exactMatch = allPresets.find(p => p.toLowerCase().trim() === name.toLowerCase().trim());

    if (exactMatch) {
        console.log('Found exact preset match', exactMatch);

        if (currentPreset !== exactMatch) {
            const presetValue = presetManager.findPreset(exactMatch);

            if (presetValue) {
                presetManager.selectPreset(presetValue);
                shouldReconnect && await waitForConnection();
            }
        }

        return exactMatch;
    } else {
        // Find fuzzy match
        const fuse = new Fuse(allPresets);
        const fuzzyMatch = fuse.search(name);

        if (!fuzzyMatch.length) {
            console.warn(`WARN: Preset found with name ${name}`);
            return currentPreset;
        }

        const fuzzyPresetName = fuzzyMatch[0].item;
        const fuzzyPresetValue = presetManager.findPreset(fuzzyPresetName);

        if (fuzzyPresetValue) {
            console.log('Found fuzzy preset match', fuzzyPresetName);

            if (currentPreset !== fuzzyPresetName) {
                presetManager.selectPreset(fuzzyPresetValue);
                shouldReconnect && await waitForConnection();
            }
        }

        return fuzzyPresetName;
    }
}

/**
 * Waits for API connection to be established.
 */
async function waitForConnection() {
    try {
        await waitUntilCondition(() => online_status !== 'no_connection', 10000, 100);
    } catch {
        console.log('Timeout waiting for API to connect');
    }
}

export async function initPresetManager() {
    eventSource.on(event_types.CHAT_CHANGED, autoSelectPreset);
    registerPresetManagers();
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'preset',
        callback: presetCommandCallback,
        returns: 'current preset',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'name',
                typeList: [ARGUMENT_TYPE.STRING],
                enumProvider: () => getPresetManager().getAllPresets().map(preset => new SlashCommandEnumValue(preset, null, enumTypes.enum, enumIcons.preset)),
            }),
        ],
        helpString: `
            <div>
                Sets a preset by name for the current API. Gets the current preset if no name is provided.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code>/preset myPreset</code></pre>
                    </li>
                    <li>
                        <pre><code>/preset</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));


    $(document).on('click', '[data-preset-manager-update]', async function () {
        const apiId = $(this).data('preset-manager-update');
        const presetManager = getPresetManager(apiId);

        if (!presetManager) {
            console.warn(`Preset Manager not found for API: ${apiId}`);
            return;
        }

        await presetManager.updatePreset();
    });

    $(document).on('click', '[data-preset-manager-new]', async function () {
        const apiId = $(this).data('preset-manager-new');
        const presetManager = getPresetManager(apiId);

        if (!presetManager) {
            console.warn(`Preset Manager not found for API: ${apiId}`);
            return;
        }

        await presetManager.savePresetAs();
    });

    $(document).on('click', '[data-preset-manager-export]', async function () {
        const apiId = $(this).data('preset-manager-export');
        const presetManager = getPresetManager(apiId);

        if (!presetManager) {
            console.warn(`Preset Manager not found for API: ${apiId}`);
            return;
        }

        const selected = $(presetManager.select).find('option:selected');
        const name = selected.text();
        const preset = presetManager.getPresetSettings(name);
        const data = JSON.stringify(preset, null, 4);
        download(data, `${name}.json`, 'application/json');
    });

    $(document).on('click', '[data-preset-manager-import]', async function () {
        const apiId = $(this).data('preset-manager-import');
        $(`[data-preset-manager-file="${apiId}"]`).trigger('click');
    });

    $(document).on('change', '[data-preset-manager-file]', async function (e) {
        const apiId = $(this).data('preset-manager-file');
        const presetManager = getPresetManager(apiId);

        if (!presetManager) {
            console.warn(`Preset Manager not found for API: ${apiId}`);
            return;
        }

        const file = e.target.files[0];

        if (!file) {
            return;
        }

        const fileName = file.name.replace('.json', '').replace('.settings', '');
        const data = await parseJsonFile(file);
        const name = data?.name ?? fileName;
        data['name'] = name;

        await presetManager.savePreset(name, data);
        const successToast = !presetManager.isAdvancedFormatting() ? 'Preset imported' : 'Template imported';
        toastr.success(successToast);
        e.target.value = null;
    });

    $(document).on('click', '[data-preset-manager-delete]', async function () {
        const apiId = $(this).data('preset-manager-delete');
        const presetManager = getPresetManager(apiId);

        if (!presetManager) {
            console.warn(`Preset Manager not found for API: ${apiId}`);
            return;
        }

        const headerText = !presetManager.isAdvancedFormatting() ? 'Delete this preset?' : 'Delete this template?';
        const confirm = await Popup.show.confirm(headerText, 'This action is irreversible and your current settings will be overwritten.');
        if (!confirm) {
            return;
        }

        const result = await presetManager.deleteCurrentPreset();

        if (result) {
            const successToast = !presetManager.isAdvancedFormatting() ? 'Preset deleted' : 'Template deleted';
            toastr.success(successToast);
        } else {
            const warningToast = !presetManager.isAdvancedFormatting() ? 'Preset was not deleted from server' : 'Template was not deleted from server';
            toastr.warning(warningToast);
        }

        saveSettingsDebounced();
    });

    $(document).on('click', '[data-preset-manager-restore]', async function () {
        const apiId = $(this).data('preset-manager-restore');
        const presetManager = getPresetManager(apiId);

        if (!presetManager) {
            console.warn(`Preset Manager not found for API: ${apiId}`);
            return;
        }

        const name = presetManager.getSelectedPresetName();
        const data = await presetManager.getDefaultPreset(name);

        if (name == 'gui') {
            toastr.info('Cannot restore GUI preset');
            return;
        }

        if (!data) {
            return;
        }

        if (data.isDefault) {
            if (Object.keys(data.preset).length === 0) {
                const errorToast = !presetManager.isAdvancedFormatting() ? 'Default preset cannot be restored' : 'Default template cannot be restored';
                toastr.error(errorToast);
                return;
            }

            const confirmText = !presetManager.isAdvancedFormatting()
                ? 'Resetting a <b>default preset</b> will restore the default settings.'
                : 'Resetting a <b>default template</b> will restore the default settings.';
            const confirm = await Popup.show.confirm('Are you sure?', confirmText);
            if (!confirm) {
                return;
            }

            await presetManager.deleteCurrentPreset();
            await presetManager.savePreset(name, data.preset);
            const option = presetManager.findPreset(name);
            presetManager.selectPreset(option);
            const successToast = !presetManager.isAdvancedFormatting() ? 'Default preset restored' : 'Default template restored';
            toastr.success(successToast);
        } else {
            const confirmText = !presetManager.isAdvancedFormatting()
                ? 'Resetting a <b>custom preset</b> will restore to the last saved state.'
                : 'Resetting a <b>custom template</b> will restore to the last saved state.';
            const confirm = await Popup.show.confirm('Are you sure?', confirmText);
            if (!confirm) {
                return;
            }

            const option = presetManager.findPreset(name);
            presetManager.selectPreset(option);
            const successToast = !presetManager.isAdvancedFormatting() ? 'Preset restored' : 'Template restored';
            toastr.success(successToast);
        }
    });

    $('#af_master_import').on('click', () => {
        $('#af_master_import_file').trigger('click');
    });

    $('#af_master_import_file').on('change', async function (e) {
        if (!(e.target instanceof HTMLInputElement)) {
            return;
        }
        const file = e.target.files[0];

        if (!file) {
            return;
        }

        const data = await parseJsonFile(file);
        const fileName = file.name.replace('.json', '');
        await PresetManager.performMasterImport(data, fileName);
        e.target.value = null;
    });

    $('#af_master_export').on('click', async () => {
        const data = await PresetManager.performMasterExport();

        if (!data) {
            return;
        }

        const shortDate = new Date().toISOString().split('T')[0];
        download(data, `ST-formatting-${shortDate}.json`, 'application/json');
    });
}
