import {
    saveSettingsDebounced,
} from "../script.js";

export {
    textgenerationwebui_settings,
    loadTextGenSettings,
}

let textgenerationwebui_settings = {
    temp: 0.7,
    top_p: 0.5,
    top_k: 40,
    typical_p: 1,
    rep_pen: 1.2,
    no_repeat_ngram_size: 0,
    penalty_alpha: 0,
    num_beams: 1,
    length_penalty: 1,
    min_length: 0,
    encoder_rep_pen: 1,
    do_sample: true,
    early_stopping: false,
    seed: -1,
    preset: 'Default',
};

let textgenerationwebui_presets = [];
let textgenerationwebui_preset_names = [];

const setting_names = [
    "temp",
    "rep_pen",
    "no_repeat_ngram_size",
    "top_k",
    "top_p",
    "typical_p",
    "penalty_alpha",
    "num_beams",
    "length_penalty",
    "min_length",
    "encoder_rep_pen",
    "do_sample",
    "early_stopping",
    "seed",
];

function selectPreset(name) {
    const preset = textgenerationwebui_presets[textgenerationwebui_preset_names.indexOf(name)];

    if (!preset) {
        return;
    }

    textgenerationwebui_settings.preset = name;
    for (const name of setting_names) {
        const value = preset[name];
        setSettingByName(name, value, true);
    }
    saveSettingsDebounced();
}

function convertPresets(presets) {
    return Array.isArray(presets) ? presets.map(JSON.parse) : [];
}

function loadTextGenSettings(data, settings) {
    textgenerationwebui_presets = convertPresets(data.textgenerationwebui_presets);
    textgenerationwebui_preset_names = data.textgenerationwebui_preset_names ?? [];
    Object.assign(textgenerationwebui_settings, settings.textgenerationwebui_settings ?? {});

    for (const name of textgenerationwebui_preset_names) {
        const option = document.createElement('option');
        option.value = name;
        option.innerText = name;
        $('#settings_preset_textgenerationwebui').append(option);
    }

    if (textgenerationwebui_settings.preset) {
        $('#settings_preset_textgenerationwebui').val(textgenerationwebui_settings.preset);
    }

    for (const i of setting_names) {
        const value = textgenerationwebui_settings[i];
        setSettingByName(i, value);
    }
}

$(document).ready(function () {
    $('#settings_preset_textgenerationwebui').on('change', function() {
        const presetName = $(this).val();
        selectPreset(presetName);
    });

    for (const i of setting_names) {
        $(`#${i}_textgenerationwebui`).attr("x-setting-id", i);
        $(document).on("input", `#${i}_textgenerationwebui`, function () {
            const isCheckbox = $(this).attr('type') == 'checkbox';
            const id = $(this).attr("x-setting-id");

            if (isCheckbox) {
                const value = $(this).prop('checked');
                textgenerationwebui_settings[id] = value;
            }
            else {
                const value = parseFloat($(this).val());
                $(`#${id}_counter_textgenerationwebui`).text(value.toFixed(2));
                textgenerationwebui_settings[id] = parseFloat(value);
            }

            saveSettingsDebounced();
        });
    }
})

function setSettingByName(i, value, trigger) {
    if (value === null || value === undefined) {
        return;
    }

    const isCheckbox = $(`#${i}_textgenerationwebui`).attr('type') == 'checkbox';
    if (isCheckbox) {
        const val = Boolean(value);
        $(`#${i}_textgenerationwebui`).prop('checked', val);
    }
    else {
        const val = parseFloat(value);
        $(`#${i}_textgenerationwebui`).val(val);
        $(`#${i}_counter_textgenerationwebui`).text(val.toFixed(2));
    }

    if (trigger) {
        $(`#${i}_textgenerationwebui`).trigger('input');
    }
}
