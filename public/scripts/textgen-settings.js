import {
    api_server_textgenerationwebui,
    getRequestHeaders,
    getStoppingStrings,
    max_context,
    online_status,
    saveSettingsDebounced,
    setGenerationParamsFromPreset,
    setOnlineStatus,
} from "../script.js";

import {
    power_user,
} from "./power-user.js";
import { getTextTokens, tokenizers } from "./tokenizers.js";
import { onlyUnique } from "./utils.js";

export {
    textgenerationwebui_settings,
    loadTextGenSettings,
    generateTextGenWithStreaming,
    formatTextGenURL,
}

export const textgen_types = {
    OOBA: 'ooba',
    MANCER: 'mancer',
    APHRODITE: 'aphrodite',
};

// Maybe let it be configurable in the future?
export const MANCER_SERVER = 'https://neuro.mancer.tech';

const textgenerationwebui_settings = {
    temp: 0.7,
    temperature_last: true,
    top_p: 0.5,
    top_k: 40,
    top_a: 0,
    tfs: 1,
    epsilon_cutoff: 0,
    eta_cutoff: 0,
    typical_p: 1,
    min_p: 0,
    rep_pen: 1.2,
    rep_pen_range: 0,
    no_repeat_ngram_size: 0,
    penalty_alpha: 0,
    num_beams: 1,
    length_penalty: 1,
    min_length: 0,
    encoder_rep_pen: 1,
    freq_pen: 0,
    presence_pen: 0,
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
    mirostat_mode: 0,
    mirostat_tau: 5,
    mirostat_eta: 0.1,
    guidance_scale: 1,
    negative_prompt: '',
    grammar_string: '',
    banned_tokens: '',
    //n_aphrodite: 1,
    //best_of_aphrodite: 1,
    //ignore_eos_token_aphrodite: false,
    //spaces_between_special_tokens_aphrodite: true,
    //logits_processors_aphrodite: [],
    //log_probs_aphrodite: 0,
    //prompt_log_probs_aphrodite: 0,
    type: textgen_types.OOBA,
    mancer_model: 'mytholite',
    legacy_api: false,
};

export let textgenerationwebui_banned_in_macros = [];

export let textgenerationwebui_presets = [];
export let textgenerationwebui_preset_names = [];

const setting_names = [
    "temp",
    "temperature_last",
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
    "min_p",
    "penalty_alpha",
    "num_beams",
    "length_penalty",
    "min_length",
    "encoder_rep_pen",
    "freq_pen",
    "presence_pen",
    "do_sample",
    "early_stopping",
    "seed",
    "add_bos_token",
    "ban_eos_token",
    "skip_special_tokens",
    "streaming",
    "mirostat_mode",
    "mirostat_tau",
    "mirostat_eta",
    "guidance_scale",
    "negative_prompt",
    "grammar_string",
    "banned_tokens",
    "legacy_api",
    //'n_aphrodite',
    //'best_of_aphrodite',
    //'ignore_eos_token_aphrodite',
    //'spaces_between_special_tokens_aphrodite',
    //'logits_processors_aphrodite',
    //'log_probs_aphrodite',
    //'prompt_log_probs_aphrodite'
];

async function selectPreset(name) {
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

function formatTextGenURL(value) {
    try {
        // Mancer doesn't need any formatting (it's hardcoded)
        if (isMancer()) {
            return value;
        }

        const url = new URL(value);
        if (url.pathname === '/api' && !textgenerationwebui_settings.legacy_api) {
            toastr.info(`Enable Legacy API or start Ooba with the OpenAI extension enabled.`, 'Legacy API URL detected. Generation may fail.', { preventDuplicates: true, timeOut: 10000, extendedTimeOut: 20000 });
            url.pathname = '';
        }

        if (!power_user.relaxed_api_urls && textgenerationwebui_settings.legacy_api) {
            url.pathname = '/api';
        }
        return url.toString();
    } catch { } // Just using URL as a validation check
    return null;
}

function convertPresets(presets) {
    return Array.isArray(presets) ? presets.map((p) => JSON.parse(p)) : [];
}

/**
 * @returns {string} String with comma-separated banned token IDs
 */
function getCustomTokenBans() {
    if (!textgenerationwebui_settings.banned_tokens && !textgenerationwebui_banned_in_macros.length) {
        return '';
    }

    const result = [];
    const sequences = textgenerationwebui_settings.banned_tokens
        .split('\n')
        .concat(textgenerationwebui_banned_in_macros)
        .filter(x => x.length > 0)
        .filter(onlyUnique);

    //debug
    if (textgenerationwebui_banned_in_macros.length) {
        console.log("=== Found banned word sequences in the macros:", textgenerationwebui_banned_in_macros, "Resulting array of banned sequences (will be used this generation turn):", sequences);
    }

    //clean old temporary bans found in macros before, for the next generation turn.
    textgenerationwebui_banned_in_macros = [];

    for (const line of sequences) {
        // Raw token ids, JSON serialized
        if (line.startsWith('[') && line.endsWith(']')) {
            try {
                const tokens = JSON.parse(line);

                if (Array.isArray(tokens) && tokens.every(t => Number.isInteger(t))) {
                    result.push(...tokens);
                } else {
                    throw new Error('Not an array of integers');
                }
            } catch (err) {
                console.log(`Failed to parse bad word token list: ${line}`, err);
            }
        } else {
            try {
                const tokens = getTextTokens(tokenizers.LLAMA, line);
                result.push(...tokens);
            } catch {
                console.log(`Could not tokenize raw text: ${line}`);
            }
        }
    }

    return result.filter(onlyUnique).map(x => String(x)).join(',');
}

function loadTextGenSettings(data, settings) {
    textgenerationwebui_presets = convertPresets(data.textgenerationwebui_presets);
    textgenerationwebui_preset_names = data.textgenerationwebui_preset_names ?? [];
    Object.assign(textgenerationwebui_settings, settings.textgenerationwebui_settings ?? {});

    if (settings.api_use_mancer_webui) {
        textgenerationwebui_settings.type = textgen_types.MANCER;
    }

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

    $('#textgen_type').val(textgenerationwebui_settings.type);
    showTypeSpecificControls(textgenerationwebui_settings.type);
}

export function isMancer() {
    return textgenerationwebui_settings.type === textgen_types.MANCER;
}

export function isAphrodite() {
    return textgenerationwebui_settings.type === textgen_types.APHRODITE;
}

export function isOoba() {
    return textgenerationwebui_settings.type === textgen_types.OOBA;
}

export function getTextGenUrlSourceId() {
    switch (textgenerationwebui_settings.type) {
        case textgen_types.OOBA:
            return "#textgenerationwebui_api_url_text";
        case textgen_types.APHRODITE:
            return "#aphrodite_api_url_text";
    }
}

jQuery(function () {
    $('#textgen_type').on('change', function () {
        const type = String($(this).val());
        textgenerationwebui_settings.type = type;

        /*         if (type === 'aphrodite') {
                    $('[data-forAphro=False]').each(function () {
                        $(this).hide()
                    })
                    $('[data-forAphro=True]').each(function () {
                        $(this).show()
                    })
                    $('#mirostat_mode_textgenerationwebui').attr('step', 2) //Aphro disallows mode 1
                    $("#do_sample_textgenerationwebui").prop('checked', true) //Aphro should always do sample; 'otherwise set temp to 0 to mimic no sample'
                    $("#ban_eos_token_textgenerationwebui").prop('checked', false) //Aphro should not ban EOS, just ignore it; 'add token '2' to ban list do to this'
                } else {
                    $('[data-forAphro=False]').each(function () {
                        $(this).show()
                    })
                    $('[data-forAphro=True]').each(function () {
                        $(this).hide()
                    })
                    $('#mirostat_mode_textgenerationwebui').attr('step', 1)
                } */

        showTypeSpecificControls(type);
        setOnlineStatus('no_connection');

        $('#main_api').trigger('change');
        $('#api_button_textgenerationwebui').trigger('click');

        saveSettingsDebounced();
    });

    $('#settings_preset_textgenerationwebui').on('change', function () {
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
                $(`#${id}_counter_textgenerationwebui`).val(value);
                textgenerationwebui_settings[id] = value;
            }

            saveSettingsDebounced();
        });
    }
})

function showTypeSpecificControls(type) {
    $('[data-tg-type]').each(function () {
        const tgType = $(this).attr('data-tg-type');
        if (tgType == type) {
            $(this).show();
        } else {
            $(this).hide();
        }
    });
}

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
        $(`#${i}_counter_textgenerationwebui`).val(val);
        if (power_user.enableZenSliders) {
            let zenSlider = $(`#${i}_textgenerationwebui_zenslider`).slider()
            zenSlider.slider('option', 'value', val)
            zenSlider.slider('option', 'slide')
                .call(zenSlider, null, {
                    handle: $('.ui-slider-handle', zenSlider), value: val
                });
        }
    }

    if (trigger) {
        $(`#${i}_textgenerationwebui`).trigger('input');
    }
}

async function generateTextGenWithStreaming(generate_data, signal) {
    generate_data.stream = true;

    const response = await fetch('/api/textgenerationwebui/generate', {
        headers: {
            ...getRequestHeaders(),
        },
        body: JSON.stringify(generate_data),
        method: 'POST',
        signal: signal,
    });

    return async function* streamData() {
        const decoder = new TextDecoder();
        const reader = response.body.getReader();
        let getMessage = '';
        let messageBuffer = "";
        while (true) {
            const { done, value } = await reader.read();
            // We don't want carriage returns in our messages
            let response = decoder.decode(value).replace(/\r/g, "");

            tryParseStreamingError(response);

            let eventList = [];

            messageBuffer += response;
            eventList = messageBuffer.split("\n\n");
            // Last element will be an empty string or a leftover partial message
            messageBuffer = eventList.pop();

            for (let event of eventList) {
                if (event.startsWith('event: completion')) {
                    event = event.split("\n")[1];
                }

                if (typeof event !== 'string' || !event.length)
                    continue;

                if (!event.startsWith("data"))
                    continue;
                if (event == "data: [DONE]") {
                    return;
                }
                let data = JSON.parse(event.substring(6));
                // the first and last messages are undefined, protect against that
                getMessage += data?.choices[0]?.text || '';
                yield getMessage;
            }

            if (done) {
                return;
            }
        }
    }
}

/**
 * Parses errors in streaming responses and displays them in toastr.
 * @param {string} response - Response from the server.
 * @returns {void} Nothing.
 */
function tryParseStreamingError(response) {
    let data = {};

    try {
        data = JSON.parse(response);
    } catch {
        // No JSON. Do nothing.
    }

    const message = data?.error?.message || data?.message;

    if (message) {
        toastr.error(message, 'API Error');
        throw new Error(message);
    }
}

function toIntArray(string) {
    if (!string) {
        return [];
    }

    return string.split(',').map(x => parseInt(x)).filter(x => !isNaN(x));
}

function getModel() {
    if (isMancer()) {
        return textgenerationwebui_settings.mancer_model;
    }

    if (isAphrodite()) {
        return online_status;
    }

    return undefined;
}

export function getTextGenGenerationData(finalPrompt, this_amount_gen, isImpersonate, cfgValues) {
    return {
        'prompt': finalPrompt,
        'model': getModel(),
        'max_new_tokens': this_amount_gen,
        'max_tokens': this_amount_gen,
        'do_sample': textgenerationwebui_settings.do_sample,
        'temperature': textgenerationwebui_settings.temp,
        'temperature_last': textgenerationwebui_settings.temperature_last,
        'top_p': textgenerationwebui_settings.top_p,
        'typical_p': textgenerationwebui_settings.typical_p,
        'min_p': textgenerationwebui_settings.min_p,
        'repetition_penalty': textgenerationwebui_settings.rep_pen,
        'repetition_penalty_range': textgenerationwebui_settings.rep_pen_range,
        'encoder_repetition_penalty': textgenerationwebui_settings.encoder_rep_pen,
        'frequency_penalty': textgenerationwebui_settings.freq_pen,
        'presence_penalty': textgenerationwebui_settings.presence_pen,
        'top_k': textgenerationwebui_settings.top_k,
        'min_length': textgenerationwebui_settings.min_length,
        'min_tokens': textgenerationwebui_settings.min_length,
        'no_repeat_ngram_size': textgenerationwebui_settings.no_repeat_ngram_size,
        'num_beams': textgenerationwebui_settings.num_beams,
        'penalty_alpha': textgenerationwebui_settings.penalty_alpha,
        'length_penalty': textgenerationwebui_settings.length_penalty,
        'early_stopping': textgenerationwebui_settings.early_stopping,
        'guidance_scale': cfgValues?.guidanceScale?.value ?? textgenerationwebui_settings.guidance_scale ?? 1,
        'negative_prompt': cfgValues?.negativePrompt ?? textgenerationwebui_settings.negative_prompt ?? '',
        'seed': textgenerationwebui_settings.seed,
        'add_bos_token': textgenerationwebui_settings.add_bos_token,
        'stopping_strings': getStoppingStrings(isImpersonate),
        'stop': getStoppingStrings(isImpersonate),
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
        'grammar_string': textgenerationwebui_settings.grammar_string,
        'custom_token_bans': isAphrodite() ? toIntArray(getCustomTokenBans()) : getCustomTokenBans(),
        'use_mancer': isMancer(),
        'use_aphrodite': isAphrodite(),
        'use_ooba': isOoba(),
        'api_server': isMancer() ? MANCER_SERVER : api_server_textgenerationwebui,
        'legacy_api': textgenerationwebui_settings.legacy_api && !isMancer(),
        //'n': textgenerationwebui_settings.n_aphrodite,
        //'best_of': textgenerationwebui_settings.n_aphrodite, //n must always == best_of and vice versa
        //'ignore_eos': textgenerationwebui_settings.ignore_eos_token_aphrodite,
        //'spaces_between_special_tokens': textgenerationwebui_settings.spaces_between_special_tokens_aphrodite,
        // 'logits_processors': textgenerationwebui_settings.logits_processors_aphrodite,
        //'logprobs': textgenerationwebui_settings.log_probs_aphrodite,
        //'prompt_logprobs': textgenerationwebui_settings.prompt_log_probs_aphrodite,
    };
}

