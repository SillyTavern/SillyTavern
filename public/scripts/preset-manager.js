import { Fuse } from '../lib.js';

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
import { openai_settings, openai_setting_names } from './openai.js';
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
import { download, equalsIgnoreCaseAndAccents, getSanitizedFilename, parseJsonFile, waitUntilCondition } from './utils.js';
import { t } from './i18n.js';
import { reasoning_templates } from './reasoning.js';

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
        'reasoning': {
            name: 'Reasoning Formatting',
            getData: () => {
                const manager = getPresetManager('reasoning');
                const name = manager.getSelectedPresetName();
                return manager.getPresetSettings(name);
            },
            setData: (data) => {
                const manager = getPresetManager('reasoning');
                const name = data.name;
                return manager.savePreset(name, data);
            },
            isValid: (data) => PresetManager.isPossiblyReasoningData(data),
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

    static isPossiblyReasoningData(data) {
        const reasoningProps = ['name', 'prefix', 'suffix', 'separator'];
        return data && reasoningProps.every(prop => Object.keys(data).includes(prop));
    }

    /**
     * Imports master settings from JSON data.
     * @param {object} data Data to import
     * @param {string} fileName File name
     * @returns {Promise<void>}
     */
    static async performMasterImport(data, fileName) {
        if (!data || typeof data !== 'object') {
            toastr.error(t`Invalid data provided for master import`);
            return;
        }

        // Check for legacy file imports
        // 1. Instruct Template
        if (this.isPossiblyInstructData(data)) {
            toastr.info(t`Importing instruct template...`, t`Instruct template detected`);
            return await getPresetManager('instruct').savePreset(data.name, data);
        }

        // 2. Context Template
        if (this.isPossiblyContextData(data)) {
            toastr.info(t`Importing as context template...`, t`Context template detected`);
            return await getPresetManager('context').savePreset(data.name, data);
        }

        // 3. System Prompt
        if (this.isPossiblySystemPromptData(data)) {
            toastr.info(t`Importing as system prompt...`, t`System prompt detected`);
            return await getPresetManager('sysprompt').savePreset(data.name, data);
        }

        // 4. Text Completion settings
        if (this.isPossiblyTextCompletionData(data)) {
            toastr.info(t`Importing as settings preset...`, t`Text Completion settings detected`);
            return await getPresetManager('textgenerationwebui').savePreset(fileName, data);
        }

        // 5. Reasoning Template
        if (this.isPossiblyReasoningData(data)) {
            toastr.info(t`Importing as reasoning template...`, t`Reasoning template detected`);
            return await getPresetManager('reasoning').savePreset(data.name, data);
        }

        const validSections = [];
        for (const [key, section] of Object.entries(this.masterSections)) {
            if (key in data && section.isValid(data[key])) {
                validSections.push(key);
            }
        }

        if (validSections.length === 0) {
            toastr.error(t`No valid sections found in imported data`);
            return;
        }

        const sectionNames = validSections.reduce((acc, key) => {
            acc[key] = { key: key, name: this.masterSections[key].name, preset: data[key]?.name || '' };
            return acc;
        }, {});

        const html = $(await renderTemplateAsync('masterImport', { sections: sectionNames }));
        const popup = new Popup(html, POPUP_TYPE.CONFIRM, '', {
            okButton: t`Import`,
            cancelButton: t`Cancel`,
        });

        const result = await popup.show();

        // Import cancelled
        if (result !== POPUP_RESULT.AFFIRMATIVE) {
            return;
        }

        const importedSections = [];
        const confirmedSections = html.find('input:checked').map((_, el) => el instanceof HTMLInputElement && el.value).get();

        if (confirmedSections.length === 0) {
            toastr.info(t`No sections selected for import`);
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

        toastr.success(t`Imported ${importedSections.length} settings: ${importedSections.join(', ')}`);
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
            okButton: t`Export`,
            cancelButton: t`Cancel`,
        });

        const result = await popup.show();

        // Export cancelled
        if (result !== POPUP_RESULT.AFFIRMATIVE) {
            return;
        }

        const confirmedSections = html.find('input:checked').map((_, el) => el instanceof HTMLInputElement && el.value).get();
        const data = {};

        if (confirmedSections.length === 0) {
            toastr.info(t`No sections selected for export`);
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
        return $(this.select).find('option').filter(function () {
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
        const option = $(this.select).filter(function () {
            return $(this).val() === value;
        });
        option.prop('selected', true);
        $(this.select).val(value).trigger('change');
    }

    async updatePreset() {
        const selected = $(this.select).find('option:selected');
        console.log(selected);

        if (selected.val() == 'gui') {
            toastr.info(t`Cannot update GUI preset`);
            return;
        }

        const name = selected.text();
        await this.savePreset(name);

        const successToast = !this.isAdvancedFormatting() ? t`Preset updated` : t`Template updated`;
        toastr.success(successToast);
    }

    async savePresetAs() {
        const inputValue = this.getSelectedPresetName();
        const popupText = !this.isAdvancedFormatting() ? '<h4>' + t`Hint: Use a character/group name to bind preset to a specific chat.` + '</h4>' : '';
        const headerText = !this.isAdvancedFormatting() ? t`Preset name:` : t`Template name:`;
        const name = await Popup.show.input(headerText, popupText, inputValue);
        if (!name) {
            console.log('Preset name not provided');
            return;
        }

        await this.savePreset(name);

        const successToast = !this.isAdvancedFormatting() ? t`Preset saved` : t`Template saved`;
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
            toastr.error(t`Check the server connection and reload the page to prevent data loss.`, t`Preset could not be saved`);
            console.error('Preset could not be saved', response);
            throw new Error('Preset could not be saved');
        }

        const data = await response.json();
        name = data.name;

        this.updateList(name, preset);
    }

    async renamePreset(newName) {
        const oldName = this.getSelectedPresetName();
        if (equalsIgnoreCaseAndAccents(oldName, newName)) {
            throw new Error('New name must be different from old name');
        }
        try {
            await this.savePreset(newName);
            await this.deletePreset(oldName);
        } catch (error) {
            toastr.error(t`Check the server connection and reload the page to prevent data loss.`, t`Preset could not be renamed`);
            console.error('Preset could not be renamed', error);
            throw new Error('Preset could not be renamed');
        }

    }

    getPresetList(api) {
        let presets = [];
        let preset_names = {};

        // If no API specified, use the current API
        if (api === undefined) {
            api = this.apiId;
        }

        switch (api) {
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
            case 'openai':
                presets = openai_settings;
                preset_names = openai_setting_names;
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
            case 'reasoning':
                presets = reasoning_templates;
                preset_names = reasoning_templates.map(x => x.name);
                break;
            default:
                console.warn(`Unknown API ID ${api}`);
        }

        return { presets, preset_names };
    }

    isKeyedApi() {
        return this.apiId == 'textgenerationwebui' || this.isAdvancedFormatting();
    }

    isAdvancedFormatting() {
        return  ['context', 'instruct', 'sysprompt', 'reasoning'].includes(this.apiId);
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
                case 'reasoning': {
                    const reasoning_preset = structuredClone(power_user.reasoning);
                    reasoning_preset['name'] = name || power_user.reasoning.preset;
                    return reasoning_preset;
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
            'derived',
            'generic_model',
            'include_reasoning',
            'global_banned_tokens',
            'send_banned_tokens',

            // Reasoning exclusions
            'auto_parse',
            'add_to_prompts',
            'auto_expand',
            'show_hidden',
            'max_additions',
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

    getCompletionPresetByName(name) {
        // Retrieve a completion preset by name. Return undefined if not found.
        let { presets, preset_names } = this.getPresetList();
        let preset;

        // Some APIs use an array of names, others use an object of {name: index}
        if (Array.isArray(preset_names)) {  // array of names
            if (preset_names.includes(name)) {
                preset = presets[preset_names.indexOf(name)];
            }
        } else {  // object of {names: index}
            if (preset_names[name] !== undefined) {
                preset = presets[preset_names[name]];
            }
        }

        if (preset === undefined) {
            console.error(`Preset ${name} not found`);
        }

        // if the preset isn't found, returns undefined
        return preset;
    }

    // pass no arguments to delete current preset
    async deletePreset(name) {
        const { preset_names, presets } = this.getPresetList();
        const value = name ? (this.isKeyedApi() ? this.findPreset(name) : name) : this.getSelectedPreset();
        const nameToDelete = name || this.getSelectedPresetName();

        if (value == 'gui') {
            toastr.info(t`Cannot delete GUI preset`);
            return;
        }

        if (this.isKeyedApi()) {
            $(this.select).find(`option[value="${value}"]`).remove();
            const index = preset_names.indexOf(nameToDelete);
            preset_names.splice(index, 1);
            presets.splice(index, 1);
        } else {
            const index = preset_names[nameToDelete];
            $(this.select).find(`option[value="${index}"]`).remove();
            delete preset_names[nameToDelete];
        }

        // switch in UI only when deleting currently selected preset
        const switchPresets = !name || this.getSelectedPresetName() == name;

        if (Object.keys(preset_names).length && switchPresets) {
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
            const errorToast = !this.isAdvancedFormatting() ? t`Failed to restore default preset` : t`Failed to restore default template`;
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
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'preset',
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

    $(document).on('click', '[data-preset-manager-rename]', async function () {
        const apiId = $(this).data('preset-manager-rename');
        const presetManager = getPresetManager(apiId);

        if (!presetManager) {
            console.warn(`Preset Manager not found for API: ${apiId}`);
            return;
        }

        const popupHeader = !presetManager.isAdvancedFormatting() ? t`Rename preset` : t`Rename template`;
        const oldName = presetManager.getSelectedPresetName();
        const newName = await getSanitizedFilename(await Popup.show.input(popupHeader, t`Enter a new name:`, oldName) || '');
        if (!newName || oldName === newName) {
            console.debug(!presetManager.isAdvancedFormatting() ? 'Preset rename cancelled' : 'Template rename cancelled');
            return;
        }
        if (equalsIgnoreCaseAndAccents(oldName, newName)) {
            toastr.warning(t`Name not accepted, as it is the same as before (ignoring case and accents).`, t`Rename Preset`);
            return;
        }

        await presetManager.renamePreset(newName);

        if (apiId === 'openai') {
            // This is a horrible mess, but prevents the renamed preset from being corrupted.
            $('#update_oai_preset').trigger('click');
            return;
        }

        const successToast = !presetManager.isAdvancedFormatting() ? t`Preset renamed` : t`Template renamed`;
        toastr.success(successToast);
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
        const successToast = !presetManager.isAdvancedFormatting() ? t`Preset imported` : t`Template imported`;
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

        const headerText = !presetManager.isAdvancedFormatting() ? t`Delete this preset?` : t`Delete this template?`;
        const confirm = await Popup.show.confirm(headerText, t`This action is irreversible and your current settings will be overwritten.`);
        if (!confirm) {
            return;
        }

        const result = await presetManager.deletePreset();

        if (result) {
            const successToast = !presetManager.isAdvancedFormatting() ? t`Preset deleted` : t`Template deleted`;
            toastr.success(successToast);
        } else {
            const warningToast = !presetManager.isAdvancedFormatting() ? t`Preset was not deleted from server` : t`Template was not deleted from server`;
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
            toastr.info(t`Cannot restore GUI preset`);
            return;
        }

        if (!data) {
            return;
        }

        if (data.isDefault) {
            if (Object.keys(data.preset).length === 0) {
                const errorToast = !presetManager.isAdvancedFormatting() ? t`Default preset cannot be restored` : t`Default template cannot be restored`;
                toastr.error(errorToast);
                return;
            }

            const confirmText = !presetManager.isAdvancedFormatting()
                ? t`Resetting a <b>default preset</b> will restore the default settings.`
                : t`Resetting a <b>default template</b> will restore the default settings.`;
            const confirm = await Popup.show.confirm(t`Are you sure?`, confirmText);
            if (!confirm) {
                return;
            }

            await presetManager.deletePreset();
            await presetManager.savePreset(name, data.preset);
            const option = presetManager.findPreset(name);
            presetManager.selectPreset(option);
            const successToast = !presetManager.isAdvancedFormatting() ? t`Default preset restored` : t`Default template restored`;
            toastr.success(successToast);
        } else {
            const confirmText = !presetManager.isAdvancedFormatting()
                ? t`Resetting a <b>custom preset</b> will restore to the last saved state.`
                : t`Resetting a <b>custom template</b> will restore to the last saved state.`;
            const confirm = await Popup.show.confirm(t`Are you sure?`, confirmText);
            if (!confirm) {
                return;
            }

            const option = presetManager.findPreset(name);
            presetManager.selectPreset(option);
            const successToast = !presetManager.isAdvancedFormatting() ? t`Preset restored` : t`Template restored`;
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
