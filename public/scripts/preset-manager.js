import {
    amount_gen,
    callPopup,
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
    saveSettingsDebounced,
    this_chid,
} from "../script.js";
import { groups, selected_group } from "./group-chats.js";
import { instruct_presets } from "./instruct-mode.js";
import { kai_settings } from "./kai-settings.js";
import { context_presets, getContextSettings, power_user } from "./power-user.js";
import {
    textgenerationwebui_preset_names,
    textgenerationwebui_presets,
    textgenerationwebui_settings,
} from "./textgen-settings.js";
import { download, parseJsonFile, waitUntilCondition } from "./utils.js";

const presetManagers = {};

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

function getPresetManager(apiId) {
    if (!apiId) {
        apiId = main_api == 'koboldhorde' ? 'kobold' : main_api;
    }

    if (!Object.keys(presetManagers).includes(apiId)) {
        return null;
    }

    return presetManagers[apiId];
}

function registerPresetManagers() {
    $('select[data-preset-manager-for]').each((_, e) => {
        const forData = $(e).data("preset-manager-for");
        for (const apiId of forData.split(",")) {
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

    findPreset(name) {
        return $(this.select).find(`option:contains(${name})`).val();
    }

    getSelectedPreset() {
        return $(this.select).find("option:selected").val();
    }

    getSelectedPresetName() {
        return $(this.select).find("option:selected").text();
    }

    selectPreset(preset) {
        $(this.select).find(`option[value=${preset}]`).prop('selected', true);
        $(this.select).val(preset).trigger("change");
    }

    async updatePreset() {
        const selected = $(this.select).find("option:selected");
        console.log(selected)

        if (selected.val() == 'gui') {
            toastr.info('Cannot update GUI preset');
            return;
        }

        const name = selected.text();
        await this.savePreset(name);
        toastr.success('Preset updated');
    }

    async savePresetAs() {
        const popupText = `
            <h3>Preset name:</h3>
            ${!this.isNonGenericApi() ? '<h4>Hint: Use a character/group name to bind preset to a specific chat.</h4>' : ''}`;
        const name = await callPopup(popupText, "input");

        if (!name) {
            console.log('Preset name not provided');
            return;
        }

        await this.savePreset(name);
        toastr.success('Preset saved');
    }

    async savePreset(name, settings) {
        const preset = settings ?? this.getPresetSettings(name);

        const res = await fetch(`/api/presets/save`, {
            method: "POST",
            headers: getRequestHeaders(),
            body: JSON.stringify({ preset, name, apiId: this.apiId })
        });

        if (!res.ok) {
            toastr.error('Failed to save preset');
        }

        const data = await res.json();
        name = data.name;

        this.updateList(name, preset);
    }

    getPresetList() {
        let presets = [];
        let preset_names = {};

        switch (this.apiId) {
            case "koboldhorde":
            case "kobold":
                presets = koboldai_settings;
                preset_names = koboldai_setting_names;
                break;
            case "novel":
                presets = novelai_settings;
                preset_names = novelai_setting_names;
                break;
            case "textgenerationwebui":
                presets = textgenerationwebui_presets;
                preset_names = textgenerationwebui_preset_names;
                break;
            case "context":
                presets = context_presets;
                preset_names = context_presets.map(x => x.name);
                break;
            case "instruct":
                presets = instruct_presets;
                preset_names = instruct_presets.map(x => x.name);
                break;
            default:
                console.warn(`Unknown API ID ${this.apiId}`);
        }

        return { presets, preset_names };
    }

    isKeyedApi() {
        return this.apiId == "textgenerationwebui" || this.apiId == "context" || this.apiId == "instruct";
    }

    isNonGenericApi() {
        return this.apiId == "context" || this.apiId == "instruct";
    }

    updateList(name, preset) {
        const { presets, preset_names } = this.getPresetList();
        const presetExists = this.isKeyedApi() ? preset_names.includes(name) : Object.keys(preset_names).includes(name);

        if (presetExists) {
            if (this.isKeyedApi()) {
                presets[preset_names.indexOf(name)] = preset;
                $(this.select).find(`option[value="${name}"]`).prop('selected', true);
                $(this.select).val(name).trigger("change");
            }
            else {
                const value = preset_names[name];
                presets[value] = preset;
                $(this.select).find(`option[value="${value}"]`).prop('selected', true);
                $(this.select).val(value).trigger("change");
            }
        }
        else {
            presets.push(preset);
            const value = presets.length - 1;

            if (this.isKeyedApi()) {
                preset_names[value] = name;
                const option = $('<option></option>', { value: name, text: name, selected: true });
                $(this.select).append(option);
                $(this.select).val(name).trigger("change");
            } else {
                preset_names[name] = value;
                const option = $('<option></option>', { value: value, text: name, selected: true });
                $(this.select).append(option);
                $(this.select).val(value).trigger("change");
            }
        }
    }

    getPresetSettings(name) {
        function getSettingsByApiId(apiId) {
            switch (apiId) {
                case "koboldhorde":
                case "kobold":
                    return kai_settings;
                case "novel":
                    return nai_settings;
                case "textgenerationwebui":
                    return textgenerationwebui_settings;
                case "context":
                    const context_preset = getContextSettings();
                    context_preset['name'] = name || power_user.context.preset;
                    return context_preset;
                case "instruct":
                    const instruct_preset = structuredClone(power_user.instruct);
                    instruct_preset['name'] = name || power_user.instruct.preset;
                    return instruct_preset;
                default:
                    console.warn(`Unknown API ID ${apiId}`);
                    return {};
            }
        }

        const filteredKeys = [
            'preset',
            'streaming_url',
            'stopping_strings',
            'can_use_tokenization',
            'can_use_streaming',
            'preset_settings_novel',
            'streaming_novel',
            'nai_preamble',
            'model_novel',
            'streaming_kobold',
            "enabled",
            'seed',
        ];
        const settings = Object.assign({}, getSettingsByApiId(this.apiId));

        for (const key of filteredKeys) {
            if (settings.hasOwnProperty(key)) {
                delete settings[key];
            }
        }

        if (!this.isNonGenericApi()) {
            settings['genamt'] = amount_gen;
            settings['max_length'] = max_context;
        }

        return settings;
    }

    async deleteCurrentPreset() {
        const { presets, preset_names } = this.getPresetList();
        const value = this.getSelectedPreset();
        const nameToDelete = this.getSelectedPresetName();

        if (value == 'gui') {
            toastr.info('Cannot delete GUI preset');
            return;
        }

        $(this.select).find(`option[value="${value}"]`).remove();

        if (this.isKeyedApi()) {
            preset_names.splice(preset_names.indexOf(value), 1);
        } else {
            delete preset_names[nameToDelete];
        }

        if (Object.keys(preset_names).length) {
            const nextPresetName = Object.keys(preset_names)[0];
            const newValue = preset_names[nextPresetName];
            $(this.select).find(`option[value="${newValue}"]`).attr('selected', true);
            $(this.select).trigger('change');
        }

        const response = await fetch('/api/presets/delete', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ name: nameToDelete, apiId: this.apiId }),
        });

        if (!response.ok) {
            toastr.warning('Preset was not deleted from server');
        } else {
            toastr.success('Preset deleted');
        }
    }
}

jQuery(async () => {
    await waitUntilCondition(() => eventSource !== undefined);

    eventSource.on(event_types.CHAT_CHANGED, autoSelectPreset);
    registerPresetManagers();
    $(document).on("click", "[data-preset-manager-update]", async function () {
        const apiId = $(this).data("preset-manager-update");
        const presetManager = getPresetManager(apiId);

        if (!presetManager) {
            console.warn(`Preset Manager not found for API: ${apiId}`);
            return;
        }

        await presetManager.updatePreset();
    });

    $(document).on("click", "[data-preset-manager-new]", async function () {
        const apiId = $(this).data("preset-manager-new");
        const presetManager = getPresetManager(apiId);

        if (!presetManager) {
            console.warn(`Preset Manager not found for API: ${apiId}`);
            return;
        }

        await presetManager.savePresetAs();
    });

    $(document).on("click", "[data-preset-manager-export]", async function () {
        const apiId = $(this).data("preset-manager-export");
        const presetManager = getPresetManager(apiId);

        if (!presetManager) {
            console.warn(`Preset Manager not found for API: ${apiId}`);
            return;
        }

        const selected = $(presetManager.select).find("option:selected");
        const name = selected.text();
        const preset = presetManager.getPresetSettings(name);
        const data = JSON.stringify(preset, null, 4);
        download(data, `${name}.json`, "application/json");
    });

    $(document).on("click", "[data-preset-manager-import]", async function () {
        const apiId = $(this).data("preset-manager-import");
        $(`[data-preset-manager-file="${apiId}"]`).trigger('click');
    });

    $(document).on("change", "[data-preset-manager-file]", async function (e) {
        const apiId = $(this).data("preset-manager-file");
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
        toastr.success('Preset imported');
        e.target.value = null;
    });

    $(document).on("click", "[data-preset-manager-delete]", async function () {
        const apiId = $(this).data("preset-manager-delete");
        const presetManager = getPresetManager(apiId);

        if (!presetManager) {
            console.warn(`Preset Manager not found for API: ${apiId}`);
            return;
        }

        // default context preset cannot be deleted
        if (apiId == "context" && power_user.default_context === power_user.context.preset) {
            return;
        }

        const confirm = await callPopup('Delete the preset? This action is irreversible and your current settings will be overwritten.', 'confirm');

        if (!confirm) {
            return;
        }

        await presetManager.deleteCurrentPreset();
        saveSettingsDebounced();
    });
})
