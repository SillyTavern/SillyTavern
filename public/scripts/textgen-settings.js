import {
    getRequestHeaders,
    getStoppingStrings,
    max_context,
    online_status,
    saveSettingsDebounced,
    setGenerationParamsFromPreset,
    setOnlineStatus,
    substituteParams,
} from '../script.js';
import { BIAS_CACHE, createNewLogitBiasEntry, displayLogitBias, getLogitBiasListResult } from './logit-bias.js';

import { power_user, registerDebugFunction } from './power-user.js';
import EventSourceStream from './sse-stream.js';
import { SENTENCEPIECE_TOKENIZERS, TEXTGEN_TOKENIZERS, getTextTokens, tokenizers } from './tokenizers.js';
import { getSortableDelay, onlyUnique } from './utils.js';

export {
    settings as textgenerationwebui_settings,
    loadTextGenSettings,
    generateTextGenWithStreaming,
    formatTextGenURL,
};

export const textgen_types = {
    OOBA: 'ooba',
    MANCER: 'mancer',
    APHRODITE: 'aphrodite',
    TABBY: 'tabby',
    KOBOLDCPP: 'koboldcpp',
    TOGETHERAI: 'togetherai',
    LLAMACPP: 'llamacpp',
    OLLAMA: 'ollama',
};

const { MANCER, APHRODITE, TABBY, TOGETHERAI, OOBA, OLLAMA, LLAMACPP } = textgen_types;
const BIAS_KEY = '#textgenerationwebui_api-settings';

// Maybe let it be configurable in the future?
// (7 days later) The future has come.
const MANCER_SERVER_KEY = 'mancer_server';
const MANCER_SERVER_DEFAULT = 'https://neuro.mancer.tech';
let MANCER_SERVER = localStorage.getItem(MANCER_SERVER_KEY) ?? MANCER_SERVER_DEFAULT;
let TOGETHERAI_SERVER = 'https://api.together.xyz';

const SERVER_INPUTS = {
    [textgen_types.OOBA]: '#textgenerationwebui_api_url_text',
    [textgen_types.APHRODITE]: '#aphrodite_api_url_text',
    [textgen_types.TABBY]: '#tabby_api_url_text',
    [textgen_types.KOBOLDCPP]: '#koboldcpp_api_url_text',
    [textgen_types.LLAMACPP]: '#llamacpp_api_url_text',
    [textgen_types.OLLAMA]: '#ollama_api_url_text',
};

const KOBOLDCPP_ORDER = [6, 0, 1, 3, 4, 2, 5];
const settings = {
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
    dynatemp: false,
    min_temp: 0,
    max_temp: 2.0,
    dynatemp_exponent: 1.0,
    smoothing_factor: 0.0,
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
    ignore_eos_token_aphrodite: false,
    spaces_between_special_tokens_aphrodite: true,
    //logits_processors_aphrodite: [],
    //log_probs_aphrodite: 0,
    //prompt_log_probs_aphrodite: 0,
    type: textgen_types.OOBA,
    mancer_model: 'mytholite',
    togetherai_model: 'Gryphe/MythoMax-L2-13b',
    ollama_model: '',
    legacy_api: false,
    sampler_order: KOBOLDCPP_ORDER,
    logit_bias: [],
    n: 1,
    server_urls: {},
    custom_model: '',
    bypass_status_check: false,
};

export let textgenerationwebui_banned_in_macros = [];

export let textgenerationwebui_presets = [];
export let textgenerationwebui_preset_names = [];

const setting_names = [
    'temp',
    'temperature_last',
    'rep_pen',
    'rep_pen_range',
    'no_repeat_ngram_size',
    'top_k',
    'top_p',
    'top_a',
    'tfs',
    'epsilon_cutoff',
    'eta_cutoff',
    'typical_p',
    'min_p',
    'penalty_alpha',
    'num_beams',
    'length_penalty',
    'min_length',
    'dynatemp',
    'min_temp',
    'max_temp',
    'dynatemp_exponent',
    'smoothing_factor',
    'encoder_rep_pen',
    'freq_pen',
    'presence_pen',
    'do_sample',
    'early_stopping',
    'seed',
    'add_bos_token',
    'ban_eos_token',
    'skip_special_tokens',
    'streaming',
    'mirostat_mode',
    'mirostat_tau',
    'mirostat_eta',
    'guidance_scale',
    'negative_prompt',
    'grammar_string',
    'banned_tokens',
    'legacy_api',
    //'n_aphrodite',
    //'best_of_aphrodite',
    'ignore_eos_token_aphrodite',
    'spaces_between_special_tokens_aphrodite',
    //'logits_processors_aphrodite',
    //'log_probs_aphrodite',
    //'prompt_log_probs_aphrodite'
    'sampler_order',
    'n',
    'logit_bias',
    'custom_model',
    'bypass_status_check',
];

export function validateTextGenUrl() {
    const selector = SERVER_INPUTS[settings.type];

    if (!selector) {
        return;
    }

    const control = $(selector);
    const url = String(control.val()).trim();
    const formattedUrl = formatTextGenURL(url);

    if (!formattedUrl) {
        toastr.error('Enter a valid API URL', 'Text Completion API');
        return;
    }

    control.val(formattedUrl);
}

export function getTextGenServer() {
    if (settings.type === MANCER) {
        return MANCER_SERVER;
    }

    if (settings.type === TOGETHERAI) {
        return TOGETHERAI_SERVER;
    }

    return settings.server_urls[settings.type] ?? '';
}

async function selectPreset(name) {
    const preset = textgenerationwebui_presets[textgenerationwebui_preset_names.indexOf(name)];

    if (!preset) {
        return;
    }

    settings.preset = name;
    for (const name of setting_names) {
        const value = preset[name];
        setSettingByName(name, value, true);
    }
    setGenerationParamsFromPreset(preset);
    BIAS_CACHE.delete(BIAS_KEY);
    displayLogitBias(preset.logit_bias, BIAS_KEY);
    saveSettingsDebounced();
}

function formatTextGenURL(value) {
    try {
        // Mancer/Together doesn't need any formatting (it's hardcoded)
        if (settings.type === MANCER || settings.type === TOGETHERAI) {
            return value;
        }

        const url = new URL(value);
        if (url.pathname === '/api' && !settings.legacy_api) {
            toastr.info('Enable Legacy API or start Ooba with the OpenAI extension enabled.', 'Legacy API URL detected. Generation may fail.', { preventDuplicates: true, timeOut: 10000, extendedTimeOut: 20000 });
            url.pathname = '';
        }

        if (!power_user.relaxed_api_urls && settings.legacy_api) {
            url.pathname = '/api';
        }
        return url.toString();
    } catch {
        // Just using URL as a validation check
    }
    return null;
}

function convertPresets(presets) {
    return Array.isArray(presets) ? presets.map((p) => JSON.parse(p)) : [];
}

function getTokenizerForTokenIds() {
    if (power_user.tokenizer === tokenizers.API_CURRENT && TEXTGEN_TOKENIZERS.includes(settings.type)) {
        return tokenizers.API_CURRENT;
    }

    if (SENTENCEPIECE_TOKENIZERS.includes(power_user.tokenizer)) {
        return power_user.tokenizer;
    }

    return tokenizers.LLAMA;
}

/**
 * @returns {string} String with comma-separated banned token IDs
 */
function getCustomTokenBans() {
    if (!settings.banned_tokens && !textgenerationwebui_banned_in_macros.length) {
        return '';
    }

    const tokenizer = getTokenizerForTokenIds();
    const result = [];
    const sequences = settings.banned_tokens
        .split('\n')
        .concat(textgenerationwebui_banned_in_macros)
        .filter(x => x.length > 0)
        .filter(onlyUnique);

    //debug
    if (textgenerationwebui_banned_in_macros.length) {
        console.log('=== Found banned word sequences in the macros:', textgenerationwebui_banned_in_macros, 'Resulting array of banned sequences (will be used this generation turn):', sequences);
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
                const tokens = getTextTokens(tokenizer, line);
                result.push(...tokens);
            } catch {
                console.log(`Could not tokenize raw text: ${line}`);
            }
        }
    }

    return result.filter(onlyUnique).map(x => String(x)).join(',');
}

/**
 * Calculates logit bias object from the logit bias list.
 * @returns {object} Logit bias object
 */
function calculateLogitBias() {
    if (!Array.isArray(settings.logit_bias) || settings.logit_bias.length === 0) {
        return {};
    }

    const tokenizer = getTokenizerForTokenIds();
    const result = {};

    /**
     * Adds bias to the logit bias object.
     * @param {number} bias
     * @param {number[]} sequence
     * @returns {object} Accumulated logit bias object
     */
    function addBias(bias, sequence) {
        if (sequence.length === 0) {
            return;
        }

        for (const logit of sequence) {
            const key = String(logit);
            result[key] = bias;
        }

        return result;
    }

    getLogitBiasListResult(settings.logit_bias, tokenizer, addBias);

    return result;
}

function loadTextGenSettings(data, loadedSettings) {
    textgenerationwebui_presets = convertPresets(data.textgenerationwebui_presets);
    textgenerationwebui_preset_names = data.textgenerationwebui_preset_names ?? [];
    Object.assign(settings, loadedSettings.textgenerationwebui_settings ?? {});

    if (loadedSettings.api_server_textgenerationwebui) {
        for (const type of Object.keys(SERVER_INPUTS)) {
            settings.server_urls[type] = loadedSettings.api_server_textgenerationwebui;
        }
        delete loadedSettings.api_server_textgenerationwebui;
    }

    for (const [type, selector] of Object.entries(SERVER_INPUTS)) {
        const control = $(selector);
        control.val(settings.server_urls[type] ?? '').on('input', function () {
            settings.server_urls[type] = String($(this).val());
            saveSettingsDebounced();
        });
    }

    if (loadedSettings.api_use_mancer_webui) {
        settings.type = MANCER;
    }

    for (const name of textgenerationwebui_preset_names) {
        const option = document.createElement('option');
        option.value = name;
        option.innerText = name;
        $('#settings_preset_textgenerationwebui').append(option);
    }

    if (settings.preset) {
        $('#settings_preset_textgenerationwebui').val(settings.preset);
    }

    for (const i of setting_names) {
        const value = settings[i];
        setSettingByName(i, value);
    }

    $('#textgen_type').val(settings.type);
    showTypeSpecificControls(settings.type);
    BIAS_CACHE.delete(BIAS_KEY);
    displayLogitBias(settings.logit_bias, BIAS_KEY);
    //this is needed because showTypeSpecificControls() does not handle NOT declarations
    if (settings.type === textgen_types.APHRODITE) {
        $('[data-forAphro="False"]').each(function () {
            $(this).hide();
        });
    } else {
        $('[data-forAphro="False"]').each(function () {
            if ($(this).css('display') !== 'none') { //if it wasn't already hidden by showTypeSpecificControls
                $(this).show();
            }
        });
    }

    registerDebugFunction('change-mancer-url', 'Change Mancer base URL', 'Change Mancer API server base URL', () => {
        const result = prompt(`Enter Mancer base URL\nDefault: ${MANCER_SERVER_DEFAULT}`, MANCER_SERVER);

        if (result) {
            localStorage.setItem(MANCER_SERVER_KEY, result);
            MANCER_SERVER = result;
        }
    });
}

/**
 * Sorts the sampler items by the given order.
 * @param {any[]} orderArray Sampler order array.
 */
function sortItemsByOrder(orderArray) {
    console.debug('Preset samplers order: ' + orderArray);
    const $draggableItems = $('#koboldcpp_order');

    for (let i = 0; i < orderArray.length; i++) {
        const index = orderArray[i];
        const $item = $draggableItems.find(`[data-id="${index}"]`).detach();
        $draggableItems.append($item);
    }
}

jQuery(function () {
    $('#koboldcpp_order').sortable({
        delay: getSortableDelay(),
        stop: function () {
            const order = [];
            $('#koboldcpp_order').children().each(function () {
                order.push($(this).data('id'));
            });
            settings.sampler_order = order;
            console.log('Samplers reordered:', settings.sampler_order);
            saveSettingsDebounced();
        },
    });

    $('#koboldcpp_default_order').on('click', function () {
        settings.sampler_order = KOBOLDCPP_ORDER;
        sortItemsByOrder(settings.sampler_order);
        saveSettingsDebounced();
    });

    $('#textgen_type').on('change', function () {
        const type = String($(this).val());
        settings.type = type;

        if (settings.type === textgen_types.APHRODITE) {
            //this is needed because showTypeSpecificControls() does not handle NOT declarations
            $('[data-forAphro="False"]').each(function () {
                $(this).hide();
            });
            $('#mirostat_mode_textgenerationwebui').attr('step', 2); //Aphro disallows mode 1
            $('#do_sample_textgenerationwebui').prop('checked', true); //Aphro should always do sample; 'otherwise set temp to 0 to mimic no sample'
            $('#ban_eos_token_textgenerationwebui').prop('checked', false); //Aphro should not ban EOS, just ignore it; 'add token '2' to ban list do to this'
            //special handling for Aphrodite topK -1 disable state
            $('#top_k_textgenerationwebui').attr('min', -1);
            if ($('#top_k_textgenerationwebui').val() === '0' || settings['top_k'] === 0) {
                settings['top_k'] = -1;
                $('#top_k_textgenerationwebui').val('-1').trigger('input');
            }
        } else {
            //this is needed because showTypeSpecificControls() does not handle NOT declarations
            $('[data-forAphro="False"]').each(function () {
                $(this).show();
            });
            $('#mirostat_mode_textgenerationwebui').attr('step', 1);
            //undo special Aphrodite setup for topK
            $('#top_k_textgenerationwebui').attr('min', 0);
            if ($('#top_k_textgenerationwebui').val() === '-1' || settings['top_k'] === -1) {
                settings['top_k'] = 0;
                $('#top_k_textgenerationwebui').val('0').trigger('input');
            }
        }

        showTypeSpecificControls(type);
        setOnlineStatus('no_connection');
        BIAS_CACHE.delete(BIAS_KEY);

        $('#main_api').trigger('change');

        if (!SERVER_INPUTS[type] || settings.server_urls[type]) {
            $('#api_button_textgenerationwebui').trigger('click');
        }

        saveSettingsDebounced();
    });

    $('#settings_preset_textgenerationwebui').on('change', function () {
        const presetName = $(this).val();
        selectPreset(presetName);
    });

    $('#samplerResetButton').off('click').on('click', function () {
        const inputs = {
            'temp_textgenerationwebui': 1,
            'top_k_textgenerationwebui': 0,
            'top_p_textgenerationwebui': 1,
            'min_p_textgenerationwebui': 0,
            'rep_pen_textgenerationwebui': 1,
            'rep_pen_range_textgenerationwebui': 0,
            'dynatemp_textgenerationwebui': false,
            'seed_textgenerationwebui': -1,
            'ban_eos_token_textgenerationwebui': false,
            'do_sample_textgenerationwebui': true,
            'add_bos_token_textgenerationwebui': true,
            'temperature_last_textgenerationwebui': true,
            'skip_special_tokens_textgenerationwebui': true,
            'top_a_textgenerationwebui': 0,
            'top_a_counter_textgenerationwebui': 0,
            'mirostat_mode_textgenerationwebui': 0,
            'mirostat_tau_textgenerationwebui': 5,
            'mirostat_eta_textgenerationwebui': 0.1,
            'tfs_textgenerationwebui': 1,
            'epsilon_cutoff_textgenerationwebui': 0,
            'eta_cutoff_textgenerationwebui': 0,
            'encoder_rep_pen_textgenerationwebui': 1,
            'freq_pen_textgenerationwebui': 0,
            'presence_pen_textgenerationwebui': 0,
            'no_repeat_ngram_size_textgenerationwebui': 0,
            'min_length_textgenerationwebui': 0,
            'num_beams_textgenerationwebui': 1,
            'length_penalty_textgenerationwebui': 0,
            'penalty_alpha_textgenerationwebui': 0,
            'typical_p_textgenerationwebui': 1, // Added entry
            'guidance_scale_textgenerationwebui': 1,
        };

        for (const [id, value] of Object.entries(inputs)) {
            const inputElement = $(`#${id}`);
            if (inputElement.prop('type') === 'checkbox') {
                inputElement.prop('checked', value);
            } else if (inputElement.prop('type') === 'number') {
                inputElement.val(value).trigger('input');
            } else {
                inputElement.val(value).trigger('input');
                if (power_user.enableZenSliders) {
                    let masterElementID = inputElement.prop('id');
                    console.log(masterElementID);
                    let zenSlider = $(`#${masterElementID}_zenslider`).slider();
                    zenSlider.slider('option', 'value', value);
                    zenSlider.slider('option', 'slide')
                        .call(zenSlider, null, {
                            handle: $('.ui-slider-handle', zenSlider), value: value,
                        });
                }
            }
        }
    });

    for (const i of setting_names) {
        $(`#${i}_textgenerationwebui`).attr('x-setting-id', i);
        $(document).on('input', `#${i}_textgenerationwebui`, function () {
            const isCheckbox = $(this).attr('type') == 'checkbox';
            const isText = $(this).attr('type') == 'text' || $(this).is('textarea');
            const id = $(this).attr('x-setting-id');

            if (isCheckbox) {
                const value = $(this).prop('checked');
                settings[id] = value;
            }
            else if (isText) {
                const value = $(this).val();
                settings[id] = value;
            }
            else {
                const value = Number($(this).val());
                $(`#${id}_counter_textgenerationwebui`).val(value);
                settings[id] = value;
                //special handling for aphrodite using -1 as disabled instead of 0
                if ($(this).attr('id') === 'top_k_textgenerationwebui' &&
                    settings.type === textgen_types.APHRODITE &&
                    value === 0) {
                    settings[id] = -1;
                    $(this).val(-1);
                }
            }
            saveSettingsDebounced();
        });
    }

    $('#textgen_logit_bias_new_entry').on('click', () => createNewLogitBiasEntry(settings.logit_bias, BIAS_KEY));
});

function showTypeSpecificControls(type) {
    $('[data-tg-type]').each(function () {
        const tgTypes = $(this).attr('data-tg-type').split(',').map(x => x.trim());
        for (const tgType of tgTypes) {
            if (tgType === type || tgType == 'all') {
                $(this).show();
                return;
            } else {
                $(this).hide();
            }
        }
    });
}

function setSettingByName(setting, value, trigger) {
    if (value === null || value === undefined) {
        return;
    }

    if ('sampler_order' === setting) {
        value = Array.isArray(value) ? value : KOBOLDCPP_ORDER;
        sortItemsByOrder(value);
        settings.sampler_order = value;
        return;
    }

    if ('logit_bias' === setting) {
        settings.logit_bias = Array.isArray(value) ? value : [];
        return;
    }

    const isCheckbox = $(`#${setting}_textgenerationwebui`).attr('type') == 'checkbox';
    const isText = $(`#${setting}_textgenerationwebui`).attr('type') == 'text' || $(`#${setting}_textgenerationwebui`).is('textarea');
    if (isCheckbox) {
        const val = Boolean(value);
        $(`#${setting}_textgenerationwebui`).prop('checked', val);
    }
    else if (isText) {
        $(`#${setting}_textgenerationwebui`).val(value);
    }
    else {
        const val = parseFloat(value);
        $(`#${setting}_textgenerationwebui`).val(val);
        $(`#${setting}_counter_textgenerationwebui`).val(val);
        if (power_user.enableZenSliders) {
            let zenSlider = $(`#${setting}_textgenerationwebui_zenslider`).slider();
            zenSlider.slider('option', 'value', val);
            zenSlider.slider('option', 'slide')
                .call(zenSlider, null, {
                    handle: $('.ui-slider-handle', zenSlider), value: val,
                });
        }
    }

    if (trigger) {
        $(`#${setting}_textgenerationwebui`).trigger('input');
    }
}

async function generateTextGenWithStreaming(generate_data, signal) {
    generate_data.stream = true;

    const response = await fetch('/api/backends/text-completions/generate', {
        headers: {
            ...getRequestHeaders(),
        },
        body: JSON.stringify(generate_data),
        method: 'POST',
        signal: signal,
    });

    if (!response.ok) {
        tryParseStreamingError(response, await response.text());
        throw new Error(`Got response status ${response.status}`);
    }

    const eventStream = new EventSourceStream();
    response.body.pipeThrough(eventStream);
    const reader = eventStream.readable.getReader();

    return async function* streamData() {
        let text = '';
        /** @type {import('logprobs.js').TokenLogprobs | null} */
        let logprobs = null;
        const swipes = [];
        while (true) {
            const { done, value } = await reader.read();
            if (done) return;
            if (value.data === '[DONE]') return;

            tryParseStreamingError(response, value.data);

            let data = JSON.parse(value.data);

            if (data?.choices?.[0]?.index > 0) {
                const swipeIndex = data.choices[0].index - 1;
                swipes[swipeIndex] = (swipes[swipeIndex] || '') + data.choices[0].text;
            } else {
                const newText = data?.choices?.[0]?.text || data?.content || '';
                text += newText;
                logprobs = parseTextgenLogprobs(newText, data.choices?.[0]?.logprobs);
            }

            yield { text, swipes, logprobs };
        }
    };
}

/**
 * parseTextgenLogprobs converts a logprobs object returned from a textgen API
 * for a single token into a TokenLogprobs object used by the Token
 * Probabilities feature.
 * @param {string} token - the text of the token that the logprobs are for
 * @param {Object} logprobs - logprobs object returned from the API
 * @returns {import('logprobs.js').TokenLogprobs | null} - converted logprobs
 */
function parseTextgenLogprobs(token, logprobs) {
    if (!logprobs) {
        return null;
    }

    switch (settings.type) {
        case TABBY:
        case APHRODITE:
        case OOBA: {
            /** @type {Record<string, number>[]} */
            const topLogprobs = logprobs.top_logprobs;
            if (!topLogprobs?.length) {
                return null;
            }
            const candidates = Object.entries(topLogprobs[0]);
            return { token, topLogprobs: candidates };
        }
        default:
            return null;
    }
}

/**
 * Parses errors in streaming responses and displays them in toastr.
 * @param {Response} response - Response from the server.
 * @param {string} decoded - Decoded response body.
 * @returns {void} Nothing.
 */
function tryParseStreamingError(response, decoded) {
    let data = {};

    try {
        data = JSON.parse(decoded);
    } catch {
        // No JSON. Do nothing.
    }

    const message = data?.error?.message || data?.message;

    if (message) {
        toastr.error(message, 'Text Completion API');
        throw new Error(message);
    }
}

/**
 * Converts a string of comma-separated integers to an array of integers.
 * @param {string} string Input string
 * @returns {number[]} Array of integers
 */
function toIntArray(string) {
    if (!string) {
        return [];
    }

    return string.split(',').map(x => parseInt(x)).filter(x => !isNaN(x));
}

function getModel() {
    if (settings.type === OOBA && settings.custom_model) {
        return settings.custom_model;
    }

    if (settings.type === MANCER) {
        return settings.mancer_model;
    }

    if (settings.type === TOGETHERAI) {
        return settings.togetherai_model;
    }

    if (settings.type === APHRODITE) {
        return online_status;
    }

    if (settings.type === OLLAMA) {
        if (!settings.ollama_model) {
            toastr.error('No Ollama model selected.', 'Text Completion API');
            throw new Error('No Ollama model selected');
        }

        return settings.ollama_model;
    }

    return undefined;
}

export function getTextGenGenerationData(finalPrompt, maxTokens, isImpersonate, isContinue, cfgValues, type) {
    const canMultiSwipe = !isContinue && !isImpersonate && type !== 'quiet';
    let params = {
        'prompt': finalPrompt,
        'model': getModel(),
        'max_new_tokens': maxTokens,
        'max_tokens': maxTokens,
        'logprobs': power_user.request_token_probabilities ? 10 : undefined,
        'temperature': settings.dynatemp ? (settings.min_temp + settings.max_temp) / 2 : settings.temp,
        'top_p': settings.top_p,
        'typical_p': settings.typical_p,
        'typical': settings.typical_p,
        'sampler_seed': settings.seed,
        'min_p': settings.min_p,
        'repetition_penalty': settings.rep_pen,
        'frequency_penalty': settings.freq_pen,
        'presence_penalty': settings.presence_pen,
        'top_k': settings.top_k,
        'min_length': settings.type === OOBA ? settings.min_length : undefined,
        'min_tokens': settings.min_length,
        'num_beams': settings.type === OOBA ? settings.num_beams : undefined,
        'length_penalty': settings.length_penalty,
        'early_stopping': settings.early_stopping,
        'add_bos_token': settings.add_bos_token,
        'dynamic_temperature': settings.dynatemp,
        'dynatemp_low': settings.dynatemp ? settings.min_temp : 1,
        'dynatemp_high': settings.dynatemp ? settings.max_temp : 1,
        'dynatemp_range': settings.dynatemp ? (settings.max_temp - settings.min_temp) / 2 : 0,
        'dynatemp_exponent': settings.dynatemp ? settings.dynatemp_exponent : 1,
        'smoothing_factor': settings.smoothing_factor,
        'stopping_strings': getStoppingStrings(isImpersonate, isContinue),
        'stop': getStoppingStrings(isImpersonate, isContinue),
        'truncation_length': max_context,
        'ban_eos_token': settings.ban_eos_token,
        'skip_special_tokens': settings.skip_special_tokens,
        'top_a': settings.top_a,
        'tfs': settings.tfs,
        'epsilon_cutoff': settings.type === OOBA ? settings.epsilon_cutoff : undefined,
        'eta_cutoff': settings.type === OOBA ? settings.eta_cutoff : undefined,
        'mirostat_mode': settings.mirostat_mode,
        'mirostat_tau': settings.mirostat_tau,
        'mirostat_eta': settings.mirostat_eta,
        'custom_token_bans': settings.type === textgen_types.APHRODITE ?
            toIntArray(getCustomTokenBans()) :
            getCustomTokenBans(),
        'api_type': settings.type,
        'api_server': getTextGenServer(),
        'legacy_api': settings.legacy_api && (settings.type === OOBA || settings.type === APHRODITE),
        'sampler_order': settings.type === textgen_types.KOBOLDCPP ? settings.sampler_order : undefined,
    };
    const nonAphroditeParams = {
        'rep_pen': settings.rep_pen,
        'rep_pen_range': settings.rep_pen_range,
        'repetition_penalty_range': settings.rep_pen_range,
        'encoder_repetition_penalty': settings.type === OOBA ? settings.encoder_rep_pen : undefined,
        'no_repeat_ngram_size': settings.type === OOBA ? settings.no_repeat_ngram_size : undefined,
        'penalty_alpha': settings.type === OOBA ? settings.penalty_alpha : undefined,
        'temperature_last': (settings.type === OOBA || settings.type === APHRODITE || settings.type == TABBY) ? settings.temperature_last : undefined,
        'do_sample': settings.type === OOBA ? settings.do_sample : undefined,
        'seed': settings.seed,
        'guidance_scale': cfgValues?.guidanceScale?.value ?? settings.guidance_scale ?? 1,
        'negative_prompt': cfgValues?.negativePrompt ?? substituteParams(settings.negative_prompt) ?? '',
        'grammar_string': settings.grammar_string,
        // llama.cpp aliases. In case someone wants to use LM Studio as Text Completion API
        'repeat_penalty': settings.rep_pen,
        'tfs_z': settings.tfs,
        'repeat_last_n': settings.rep_pen_range,
        'n_predict': maxTokens,
        'mirostat': settings.mirostat_mode,
        'ignore_eos': settings.ban_eos_token,
    };
    const aphroditeParams = {
        'n': canMultiSwipe ? settings.n : 1,
        'best_of': canMultiSwipe ? settings.n : 1,
        'ignore_eos': settings.ignore_eos_token_aphrodite,
        'spaces_between_special_tokens': settings.spaces_between_special_tokens_aphrodite,
        'grammar': settings.grammar_string,
        //'logits_processors': settings.logits_processors_aphrodite,
        //'logprobs': settings.log_probs_aphrodite,
        //'prompt_logprobs': settings.prompt_log_probs_aphrodite,
    };
    if (settings.type === APHRODITE) {
        params = Object.assign(params, aphroditeParams);
    } else {
        params = Object.assign(params, nonAphroditeParams);
    }

    if (Array.isArray(settings.logit_bias) && settings.logit_bias.length) {
        const logitBias = BIAS_CACHE.get(BIAS_KEY) || calculateLogitBias();
        BIAS_CACHE.set(BIAS_KEY, logitBias);
        params.logit_bias = logitBias;
    }

    if (settings.type === LLAMACPP || settings.type === OLLAMA) {
        // Convert bias and token bans to array of arrays
        const logitBiasArray = (params.logit_bias && typeof params.logit_bias === 'object' && Object.keys(params.logit_bias).length > 0)
            ? Object.entries(params.logit_bias).map(([key, value]) => [Number(key), value])
            : [];
        const tokenBans = toIntArray(getCustomTokenBans());
        logitBiasArray.push(...tokenBans.map(x => [Number(x), false]));
        const llamaCppParams = {
            'logit_bias': logitBiasArray,
            // Conflicts with ooba's grammar_string
            'grammar': settings.grammar_string,
            'cache_prompt': true,
        };
        params = Object.assign(params, llamaCppParams);
    }

    return params;
}

