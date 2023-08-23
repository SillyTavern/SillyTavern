import {
    getRequestHeaders,
    getStoppingStrings,
    max_context,
    saveSettingsDebounced,
    setGenerationParamsFromPreset,
} from "../script.js";

import {
    power_user,
} from "./power-user.js";

export {
    textgenerationwebui_settings,
    loadTextGenSettings,
    generateTextGenWithStreaming,
    formatTextGenURL,
}

const textgenerationwebui_settings = {
    temp: 0.7,
    top_p: 0.5,
    top_k: 40,
    top_a: 0,
    tfs: 1,
    epsilon_cutoff: 0,
    eta_cutoff: 0,
    typical_p: 1,
    rep_pen: 1.2,
    rep_pen_range: 0,
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
    add_bos_token: true,
    stopping_strings: [],
    truncation_length: 2048,
    ban_eos_token: false,
    skip_special_tokens: true,
    streaming: false,
    streaming_url: 'ws://127.0.0.1:5005/api/v1/stream',
    mirostat_mode: 0,
    mirostat_tau: 5,
    mirostat_eta: 0.1,
    guidance_scale: 1,
    negative_prompt: '',
};

export let textgenerationwebui_presets = [];
export let textgenerationwebui_preset_names = [];

const setting_names = [
    "temp",
    "rep_pen",
    "rep_pen_range",
    "no_repeat_ngram_size",
    "top_k",
    "top_p",
    "top_a",
    "tfs",
    "epsilon_cutoff",
    "eta_cutoff",
    "typical_p",
    "penalty_alpha",
    "num_beams",
    "length_penalty",
    "min_length",
    "encoder_rep_pen",
    "do_sample",
    "early_stopping",
    "seed",
    "add_bos_token",
    "ban_eos_token",
    "skip_special_tokens",
    "streaming",
    "streaming_url",
    "mirostat_mode",
    "mirostat_tau",
    "mirostat_eta",
    "guidance_scale",
    "negative_prompt",
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
    setGenerationParamsFromPreset(preset);
    saveSettingsDebounced();
}

function formatTextGenURL(value, use_mancer) {
    try {
        const url = new URL(value);
        if (!power_user.relaxed_api_urls) {
            if (use_mancer) { // If Mancer is in use, only require the URL to *end* with `/api`.
                if (!url.pathname.endsWith('/api')) {
                    return null;
                }
            } else {
                url.pathname = '/api';
            }
        }
        return url.toString();
    } catch { } // Just using URL as a validation check
    return null;
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
            const isText = $(this).attr('type') == 'text' || $(this).is('textarea');
            const id = $(this).attr("x-setting-id");

            if (isCheckbox) {
                const value = $(this).prop('checked');
                textgenerationwebui_settings[id] = value;
            }
            else if (isText) {
                const value = $(this).val();
                textgenerationwebui_settings[id] = value;
            }
            else {
                const value = Number($(this).val());
                $(`#${id}_counter_textgenerationwebui`).text(value.toFixed(2));
                textgenerationwebui_settings[id] = value;
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
    const isText = $(`#${i}_textgenerationwebui`).attr('type') == 'text' || $(`#${i}_textgenerationwebui`).is('textarea');
    if (isCheckbox) {
        const val = Boolean(value);
        $(`#${i}_textgenerationwebui`).prop('checked', val);
    }
    else if (isText) {
        $(`#${i}_textgenerationwebui`).val(value);
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

async function generateTextGenWithStreaming(generate_data, signal) {
    const response = await fetch('/generate_textgenerationwebui', {
        headers: {
            ...getRequestHeaders(),
            'X-Response-Streaming': String(true),
            'X-Streaming-URL': textgenerationwebui_settings.streaming_url,
        },
        body: JSON.stringify(generate_data),
        method: 'POST',
        signal: signal,
    });

    return async function* streamData() {
        const decoder = new TextDecoder();
        const reader = response.body.getReader();
        let getMessage = '';
        while (true) {
            const { done, value } = await reader.read();
            let response = decoder.decode(value);
            getMessage += response;

            if (done) {
                return;
            }

            yield getMessage;
        }
    }
}

export function getTextGenGenerationData(finalPrompt, this_amount_gen, isImpersonate, cfgValues) {
    return {
        'prompt': finalPrompt,
        'max_new_tokens': this_amount_gen,
        'do_sample': textgenerationwebui_settings.do_sample,
        'temperature': textgenerationwebui_settings.temp,
        'top_p': textgenerationwebui_settings.top_p,
        'typical_p': textgenerationwebui_settings.typical_p,
        'repetition_penalty': textgenerationwebui_settings.rep_pen,
        'repetition_penalty_range': textgenerationwebui_settings.rep_pen_range,
        'encoder_repetition_penalty': textgenerationwebui_settings.encoder_rep_pen,
        'top_k': textgenerationwebui_settings.top_k,
        'min_length': textgenerationwebui_settings.min_length,
        'no_repeat_ngram_size': textgenerationwebui_settings.no_repeat_ngram_size,
        'num_beams': textgenerationwebui_settings.num_beams,
        'penalty_alpha': textgenerationwebui_settings.penalty_alpha,
        'length_penalty': textgenerationwebui_settings.length_penalty,
        'early_stopping': textgenerationwebui_settings.early_stopping,
        'guidance_scale': cfgValues?.guidanceScale?.value ?? textgenerationwebui_settings.guidance_scale ?? 1,
        'negative_prompt': cfgValues?.negativePrompt ?? textgenerationwebui_settings.negative_prompt ?? '',
        'seed': textgenerationwebui_settings.seed,
        'add_bos_token': textgenerationwebui_settings.add_bos_token,
        'stopping_strings': getStoppingStrings(isImpersonate, false),
        'truncation_length': max_context,
        'ban_eos_token': textgenerationwebui_settings.ban_eos_token,
        'skip_special_tokens': textgenerationwebui_settings.skip_special_tokens,
        'top_a': textgenerationwebui_settings.top_a,
        'tfs': textgenerationwebui_settings.tfs,
        'epsilon_cutoff': textgenerationwebui_settings.epsilon_cutoff,
        'eta_cutoff': textgenerationwebui_settings.eta_cutoff,
        'mirostat_mode': textgenerationwebui_settings.mirostat_mode,
        'mirostat_tau': textgenerationwebui_settings.mirostat_tau,
        'mirostat_eta': textgenerationwebui_settings.mirostat_eta,
    };
}
