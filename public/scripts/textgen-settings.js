import {
    eventSource,
    event_types,
    getRequestHeaders,
    getStoppingStrings,
    main_api,
    max_context,
    saveSettingsDebounced,
    setGenerationParamsFromPreset,
    setOnlineStatus,
    substituteParams,
} from '../script.js';
import { BIAS_CACHE, createNewLogitBiasEntry, displayLogitBias, getLogitBiasListResult } from './logit-bias.js';

import { power_user, registerDebugFunction } from './power-user.js';
import { getEventSourceStream } from './sse-stream.js';
import { getCurrentDreamGenModelTokenizer, getCurrentOpenRouterModelTokenizer } from './textgen-models.js';
import { ENCODE_TOKENIZERS, TEXTGEN_TOKENIZERS, getTextTokens, tokenizers } from './tokenizers.js';
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
    VLLM: 'vllm',
    APHRODITE: 'aphrodite',
    TABBY: 'tabby',
    KOBOLDCPP: 'koboldcpp',
    TOGETHERAI: 'togetherai',
    LLAMACPP: 'llamacpp',
    OLLAMA: 'ollama',
    INFERMATICAI: 'infermaticai',
    DREAMGEN: 'dreamgen',
    OPENROUTER: 'openrouter',
    FEATHERLESS: 'featherless',
    HUGGINGFACE: 'huggingface',
};

const {
    MANCER,
    VLLM,
    APHRODITE,
    TABBY,
    TOGETHERAI,
    OOBA,
    OLLAMA,
    LLAMACPP,
    INFERMATICAI,
    DREAMGEN,
    OPENROUTER,
    KOBOLDCPP,
    HUGGINGFACE,
    FEATHERLESS,
} = textgen_types;

const LLAMACPP_DEFAULT_ORDER = [
    'top_k',
    'tfs_z',
    'typical_p',
    'top_p',
    'min_p',
    'temperature',
];
const OOBA_DEFAULT_ORDER = [
    'temperature',
    'dynamic_temperature',
    'quadratic_sampling',
    'top_k',
    'top_p',
    'typical_p',
    'epsilon_cutoff',
    'eta_cutoff',
    'tfs',
    'top_a',
    'min_p',
    'mirostat',
];
const BIAS_KEY = '#textgenerationwebui_api-settings';

// Maybe let it be configurable in the future?
// (7 days later) The future has come.
const MANCER_SERVER_KEY = 'mancer_server';
const MANCER_SERVER_DEFAULT = 'https://neuro.mancer.tech';
let MANCER_SERVER = localStorage.getItem(MANCER_SERVER_KEY) ?? MANCER_SERVER_DEFAULT;
let TOGETHERAI_SERVER = 'https://api.together.xyz';
let INFERMATICAI_SERVER = 'https://api.totalgpt.ai';
let DREAMGEN_SERVER = 'https://dreamgen.com';
let OPENROUTER_SERVER = 'https://openrouter.ai/api';
let FEATHERLESS_SERVER = 'https://api.featherless.ai/v1';

export const SERVER_INPUTS = {
    [textgen_types.OOBA]: '#textgenerationwebui_api_url_text',
    [textgen_types.VLLM]: '#vllm_api_url_text',
    [textgen_types.APHRODITE]: '#aphrodite_api_url_text',
    [textgen_types.TABBY]: '#tabby_api_url_text',
    [textgen_types.KOBOLDCPP]: '#koboldcpp_api_url_text',
    [textgen_types.LLAMACPP]: '#llamacpp_api_url_text',
    [textgen_types.OLLAMA]: '#ollama_api_url_text',
    [textgen_types.HUGGINGFACE]: '#huggingface_api_url_text',
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
    rep_pen_decay: 0,
    rep_pen_slope: 1,
    no_repeat_ngram_size: 0,
    penalty_alpha: 0,
    num_beams: 1,
    length_penalty: 1,
    min_length: 0,
    encoder_rep_pen: 1,
    freq_pen: 0,
    presence_pen: 0,
    skew: 0,
    do_sample: true,
    early_stopping: false,
    dynatemp: false,
    min_temp: 0,
    max_temp: 2.0,
    dynatemp_exponent: 1.0,
    smoothing_factor: 0.0,
    smoothing_curve: 1.0,
    dry_allowed_length: 2,
    dry_multiplier: 0.0,
    dry_base: 1.75,
    dry_sequence_breakers: '["\\n", ":", "\\"", "*"]',
    dry_penalty_last_n: 0,
    max_tokens_second: 0,
    seed: -1,
    preset: 'Default',
    add_bos_token: true,
    stopping_strings: [],
    //truncation_length: 2048,
    ban_eos_token: false,
    skip_special_tokens: true,
    streaming: false,
    mirostat_mode: 0,
    mirostat_tau: 5,
    mirostat_eta: 0.1,
    guidance_scale: 1,
    negative_prompt: '',
    grammar_string: '',
    json_schema: {},
    banned_tokens: '',
    sampler_priority: OOBA_DEFAULT_ORDER,
    samplers: LLAMACPP_DEFAULT_ORDER,
    ignore_eos_token: false,
    spaces_between_special_tokens: true,
    speculative_ngram: false,
    type: textgen_types.OOBA,
    mancer_model: 'mytholite',
    togetherai_model: 'Gryphe/MythoMax-L2-13b',
    infermaticai_model: '',
    ollama_model: '',
    openrouter_model: 'openrouter/auto',
    openrouter_providers: [],
    vllm_model: '',
    aphrodite_model: '',
    dreamgen_model: 'opus-v1-xl/text',
    tabby_model: '',
    legacy_api: false,
    sampler_order: KOBOLDCPP_ORDER,
    logit_bias: [],
    n: 1,
    server_urls: {},
    custom_model: '',
    bypass_status_check: false,
    openrouter_allow_fallbacks: true,
    xtc_threshold: 0.1,
    xtc_probability: 0,
};

export let textgenerationwebui_banned_in_macros = [];

export let textgenerationwebui_presets = [];
export let textgenerationwebui_preset_names = [];

export const setting_names = [
    'temp',
    'temperature_last',
    'rep_pen',
    'rep_pen_range',
    'rep_pen_decay',
    'rep_pen_slope',
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
    'smoothing_curve',
    'dry_allowed_length',
    'dry_multiplier',
    'dry_base',
    'dry_sequence_breakers',
    'dry_penalty_last_n',
    'max_tokens_second',
    'encoder_rep_pen',
    'freq_pen',
    'presence_pen',
    'skew',
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
    'json_schema',
    'banned_tokens',
    'legacy_api',
    'ignore_eos_token',
    'spaces_between_special_tokens',
    'speculative_ngram',
    'sampler_order',
    'sampler_priority',
    'samplers',
    'n',
    'logit_bias',
    'custom_model',
    'bypass_status_check',
    'openrouter_allow_fallbacks',
    'xtc_threshold',
    'xtc_probability',
];

const DYNATEMP_BLOCK = document.getElementById('dynatemp_block_ooba');

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
    switch (settings.type) {
        case FEATHERLESS:
            return FEATHERLESS_SERVER;
        case MANCER:
            return MANCER_SERVER;
        case TOGETHERAI:
            return TOGETHERAI_SERVER;
        case INFERMATICAI:
            return INFERMATICAI_SERVER;
        case DREAMGEN:
            return DREAMGEN_SERVER;
        case OPENROUTER:
            return OPENROUTER_SERVER;
        default:
            return settings.server_urls[settings.type] ?? '';
    }
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
        const noFormatTypes = [MANCER, TOGETHERAI, INFERMATICAI, DREAMGEN, OPENROUTER];
        const legacyApiTypes = [OOBA];
        if (noFormatTypes.includes(settings.type)) {
            return value;
        }

        const url = new URL(value);
        if (legacyApiTypes.includes(settings.type)) {
            if (url.pathname === '/api' && !settings.legacy_api) {
                toastr.info('Enable Legacy API or start Ooba with the OpenAI extension enabled.', 'Legacy API URL detected. Generation may fail.', { preventDuplicates: true, timeOut: 10000, extendedTimeOut: 20000 });
                url.pathname = '';
            }

            if (!power_user.relaxed_api_urls && settings.legacy_api) {
                url.pathname = '/api';
            }
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

    if (ENCODE_TOKENIZERS.includes(power_user.tokenizer)) {
        return power_user.tokenizer;
    }

    if (settings.type === OPENROUTER) {
        return getCurrentOpenRouterModelTokenizer();
    }

    if (settings.type === DREAMGEN) {
        return getCurrentDreamGenModelTokenizer();
    }

    return tokenizers.LLAMA;
}

/**
 * @typedef {{banned_tokens: string, banned_strings: string[]}} TokenBanResult
 * @returns {TokenBanResult} String with comma-separated banned token IDs
 */
function getCustomTokenBans() {
    if (!settings.banned_tokens && !textgenerationwebui_banned_in_macros.length) {
        return {
            banned_tokens: '',
            banned_strings: [],
        };
    }

    const tokenizer = getTokenizerForTokenIds();
    const banned_tokens = [];
    const banned_strings = [];
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
                    banned_tokens.push(...tokens);
                } else {
                    throw new Error('Not an array of integers');
                }
            } catch (err) {
                console.log(`Failed to parse bad word token list: ${line}`, err);
            }
        } else if (line.startsWith('"') && line.endsWith('"')) {
            // Remove the enclosing quotes

            banned_strings.push(line.slice(1, -1));
        } else {
            try {
                const tokens = getTextTokens(tokenizer, line);
                banned_tokens.push(...tokens);
            } catch {
                console.log(`Could not tokenize raw text: ${line}`);
            }
        }
    }

    return {
        banned_tokens: banned_tokens.filter(onlyUnique).map(x => String(x)).join(','),
        banned_strings: banned_strings,
    };
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
    $('#openrouter_providers_text').val(settings.openrouter_providers).trigger('change');
    showTypeSpecificControls(settings.type);
    BIAS_CACHE.delete(BIAS_KEY);
    displayLogitBias(settings.logit_bias, BIAS_KEY);

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
function sortKoboldItemsByOrder(orderArray) {
    console.debug('Preset samplers order: ' + orderArray);
    const $draggableItems = $('#koboldcpp_order');

    for (let i = 0; i < orderArray.length; i++) {
        const index = orderArray[i];
        const $item = $draggableItems.find(`[data-id="${index}"]`).detach();
        $draggableItems.append($item);
    }
}

function sortLlamacppItemsByOrder(orderArray) {
    console.debug('Preset samplers order: ', orderArray);
    const $container = $('#llamacpp_samplers_sortable');

    orderArray.forEach((name) => {
        const $item = $container.find(`[data-name="${name}"]`).detach();
        $container.append($item);
    });
}

function sortOobaItemsByOrder(orderArray) {
    console.debug('Preset samplers order: ', orderArray);
    const $container = $('#sampler_priority_container');

    orderArray.forEach((name) => {
        const $item = $container.find(`[data-name="${name}"]`).detach();
        $container.append($item);
    });
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
        sortKoboldItemsByOrder(settings.sampler_order);
        saveSettingsDebounced();
    });

    $('#llamacpp_samplers_sortable').sortable({
        delay: getSortableDelay(),
        stop: function () {
            const order = [];
            $('#llamacpp_samplers_sortable').children().each(function () {
                order.push($(this).data('name'));
            });
            settings.samplers = order;
            console.log('Samplers reordered:', settings.samplers);
            saveSettingsDebounced();
        },
    });

    $('#llamacpp_samplers_default_order').on('click', function () {
        sortLlamacppItemsByOrder(LLAMACPP_DEFAULT_ORDER);
        settings.samplers = LLAMACPP_DEFAULT_ORDER;
        console.log('Default samplers order loaded:', settings.samplers);
        saveSettingsDebounced();
    });

    $('#sampler_priority_container').sortable({
        delay: getSortableDelay(),
        stop: function () {
            const order = [];
            $('#sampler_priority_container').children().each(function () {
                order.push($(this).data('name'));
            });
            settings.sampler_priority = order;
            console.log('Samplers reordered:', settings.sampler_priority);
            saveSettingsDebounced();
        },
    });

    $('#tabby_json_schema').on('input', function () {
        const json_schema_string = String($(this).val());

        try {
            settings.json_schema = JSON.parse(json_schema_string || '{}');
        } catch {
            // Ignore errors from here
        }
        saveSettingsDebounced();
    });

    $('#textgenerationwebui_default_order').on('click', function () {
        sortOobaItemsByOrder(OOBA_DEFAULT_ORDER);
        settings.sampler_priority = OOBA_DEFAULT_ORDER;
        console.log('Default samplers order loaded:', settings.sampler_priority);
        saveSettingsDebounced();
    });

    $('#textgen_type').on('change', function () {
        const type = String($(this).val());
        settings.type = type;

        if ([VLLM, APHRODITE, INFERMATICAI].includes(settings.type)) {
            $('#mirostat_mode_textgenerationwebui').attr('step', 2); //Aphro disallows mode 1
            $('#do_sample_textgenerationwebui').prop('checked', true); //Aphro should always do sample; 'otherwise set temp to 0 to mimic no sample'
            $('#ban_eos_token_textgenerationwebui').prop('checked', false); //Aphro should not ban EOS, just ignore it; 'add token '2' to ban list do to this'
            //special handling for vLLM/Aphrodite topK -1 disable state
            $('#top_k_textgenerationwebui').attr('min', -1);
            if ($('#top_k_textgenerationwebui').val() === '0' || settings['top_k'] === 0) {
                settings['top_k'] = -1;
                $('#top_k_textgenerationwebui').val('-1').trigger('input');
            }
        } else {
            $('#mirostat_mode_textgenerationwebui').attr('step', 1);
            //undo special vLLM/Aphrodite setup for topK
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
            'top_k_textgenerationwebui': [INFERMATICAI, APHRODITE, VLLM].includes(settings.type) ? -1 : 0,
            'top_p_textgenerationwebui': 1,
            'min_p_textgenerationwebui': 0,
            'rep_pen_textgenerationwebui': 1,
            'rep_pen_range_textgenerationwebui': 0,
            'rep_pen_decay_textgenerationwebui': 0,
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
            'skew_textgenerationwebui': 0,
            'no_repeat_ngram_size_textgenerationwebui': 0,
            'speculative_ngram_textgenerationwebui': false,
            'min_length_textgenerationwebui': 0,
            'num_beams_textgenerationwebui': 1,
            'length_penalty_textgenerationwebui': 1,
            'penalty_alpha_textgenerationwebui': 0,
            'typical_p_textgenerationwebui': 1, // Added entry
            'guidance_scale_textgenerationwebui': 1,
            'smoothing_factor_textgenerationwebui': 0,
            'smoothing_curve_textgenerationwebui': 1,
            'dry_allowed_length_textgenerationwebui': 2,
            'dry_multiplier_textgenerationwebui': 0,
            'dry_base_textgenerationwebui': 1.75,
            'dry_penalty_last_n_textgenerationwebui': 0,
            'xtc_threshold_textgenerationwebui': 0.1,
            'xtc_probability_textgenerationwebui': 0,
        };

        for (const [id, value] of Object.entries(inputs)) {
            const inputElement = $(`#${id}`);
            if (inputElement.prop('type') === 'checkbox') {
                inputElement.prop('checked', value).trigger('input');
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
                //special handling for vLLM/Aphrodite using -1 as disabled instead of 0
                if ($(this).attr('id') === 'top_k_textgenerationwebui' && [INFERMATICAI, APHRODITE, VLLM].includes(settings.type) && value === 0) {
                    settings[id] = -1;
                    $(this).val(-1);
                }
            }
            saveSettingsDebounced();
        });
    }

    $('#textgen_logit_bias_new_entry').on('click', () => createNewLogitBiasEntry(settings.logit_bias, BIAS_KEY));

    $('#openrouter_providers_text').on('change', function () {
        const selectedProviders = $(this).val();

        // Not a multiple select?
        if (!Array.isArray(selectedProviders)) {
            return;
        }

        settings.openrouter_providers = selectedProviders;

        saveSettingsDebounced();
    });
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
        sortKoboldItemsByOrder(value);
        settings.sampler_order = value;
        return;
    }

    if ('sampler_priority' === setting) {
        value = Array.isArray(value) ? value : OOBA_DEFAULT_ORDER;
        sortOobaItemsByOrder(value);
        settings.sampler_priority = value;
        return;
    }

    if ('samplers' === setting) {
        value = Array.isArray(value) ? value : LLAMACPP_DEFAULT_ORDER;
        sortLlamacppItemsByOrder(value);
        settings.samplers = value;
        return;
    }

    if ('logit_bias' === setting) {
        settings.logit_bias = Array.isArray(value) ? value : [];
        return;
    }

    if ('json_schema' === setting) {
        settings.json_schema = value ?? {};
        $('#tabby_json_schema').val(JSON.stringify(settings.json_schema, null, 2));
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

    const eventStream = getEventSourceStream();
    response.body.pipeThrough(eventStream);
    const reader = eventStream.readable.getReader();

    return async function* streamData() {
        let text = '';
        /** @type {import('./logprobs.js').TokenLogprobs | null} */
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
                logprobs = parseTextgenLogprobs(newText, data.choices?.[0]?.logprobs || data?.completion_probabilities);
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
 * @returns {import('./logprobs.js').TokenLogprobs | null} - converted logprobs
 */
export function parseTextgenLogprobs(token, logprobs) {
    if (!logprobs) {
        return null;
    }

    switch (settings.type) {
        case TABBY:
        case VLLM:
        case APHRODITE:
        case MANCER:
        case INFERMATICAI:
        case OOBA: {
            /** @type {Record<string, number>[]} */
            const topLogprobs = logprobs.top_logprobs;
            if (!topLogprobs?.length) {
                return null;
            }
            const candidates = Object.entries(topLogprobs[0]);
            return { token, topLogprobs: candidates };
        }
        case LLAMACPP: {
            /** @type {Record<string, number>[]} */
            if (!logprobs?.length) {
                return null;
            }
            const candidates = logprobs[0].probs.map(x => [x.tok_str, x.prob]);
            return { token, topLogprobs: candidates };
        }
        default:
            return null;
    }
}

export function parseTabbyLogprobs(data) {
    const text = data?.choices?.[0]?.text;
    const offsets = data?.choices?.[0]?.logprobs?.text_offset;

    if (!text || !offsets) {
        return null;
    }

    // Convert string offsets list to tokens
    const tokens = offsets?.map((offset, index) => {
        const nextOffset = offsets[index + 1] || text.length;
        return text.substring(offset, nextOffset);
    });

    const topLogprobs = data?.choices?.[0]?.logprobs?.top_logprobs?.map(x => ({ top_logprobs: [x] }));
    return tokens?.map((token, index) => parseTextgenLogprobs(token, topLogprobs[index])) || null;
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

    const message = data?.error?.message || data?.message || data?.detail;

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

export function getTextGenModel() {
    switch (settings.type) {
        case OOBA:
            if (settings.custom_model) {
                return settings.custom_model;
            }
            break;
        case MANCER:
            return settings.mancer_model;
        case TOGETHERAI:
            return settings.togetherai_model;
        case INFERMATICAI:
            return settings.infermaticai_model;
        case DREAMGEN:
            return settings.dreamgen_model;
        case OPENROUTER:
            return settings.openrouter_model;
        case VLLM:
            return settings.vllm_model;
        case APHRODITE:
            return settings.aphrodite_model;
        case OLLAMA:
            if (!settings.ollama_model) {
                toastr.error('No Ollama model selected.', 'Text Completion API');
                throw new Error('No Ollama model selected');
            }
            return settings.ollama_model;
        case FEATHERLESS:
            return settings.featherless_model;
        case HUGGINGFACE:
            return 'tgi';
        case TABBY:
            if (settings.tabby_model) {
                return settings.tabby_model;
            }
            break;
        default:
            return undefined;
    }

    return undefined;
}

export function isJsonSchemaSupported() {
    return [TABBY, LLAMACPP].includes(settings.type) && main_api === 'textgenerationwebui';
}

function isDynamicTemperatureSupported() {
    return settings.dynatemp && DYNATEMP_BLOCK?.dataset?.tgType?.includes(settings.type);
}

function getLogprobsNumber() {
    if (settings.type === VLLM || settings.type === INFERMATICAI) {
        return 5;
    }

    return 10;
}

/**
 * Replaces {{macro}} in a comma-separated or serialized JSON array string.
 * @param {string} str Input string
 * @returns {string} Output string
 */
function replaceMacrosInList(str) {
    if (!str || typeof str !== 'string') {
        return str;
    }

    try {
        const array = JSON.parse(str);
        if (!Array.isArray(array)) {
            throw new Error('Not an array');
        }
        for (let i = 0; i < array.length; i++) {
            array[i] = substituteParams(array[i]);
        }
        return JSON.stringify(array);
    } catch {
        const array = str.split(',');
        for (let i = 0; i < array.length; i++) {
            array[i] = substituteParams(array[i]);
        }
        return array.join(',');
    }
}

export function getTextGenGenerationData(finalPrompt, maxTokens, isImpersonate, isContinue, cfgValues, type) {
    const canMultiSwipe = !isContinue && !isImpersonate && type !== 'quiet';
    const dynatemp = isDynamicTemperatureSupported();
    const { banned_tokens, banned_strings } = getCustomTokenBans();

    let params = {
        'prompt': finalPrompt,
        'model': getTextGenModel(),
        'max_new_tokens': maxTokens,
        'max_tokens': maxTokens,
        'logprobs': power_user.request_token_probabilities ? getLogprobsNumber() : undefined,
        'temperature': dynatemp ? (settings.min_temp + settings.max_temp) / 2 : settings.temp,
        'top_p': settings.top_p,
        'typical_p': settings.typical_p,
        'typical': settings.typical_p,
        'sampler_seed': settings.seed,
        'min_p': settings.min_p,
        'repetition_penalty': settings.rep_pen,
        'frequency_penalty': settings.freq_pen,
        'presence_penalty': settings.presence_pen,
        'top_k': settings.top_k,
        'skew': settings.skew,
        'min_length': settings.type === OOBA ? settings.min_length : undefined,
        'minimum_message_content_tokens': settings.type === DREAMGEN ? settings.min_length : undefined,
        'min_tokens': settings.min_length,
        'num_beams': settings.type === OOBA ? settings.num_beams : undefined,
        'length_penalty': settings.type === OOBA ? settings.length_penalty : undefined,
        'early_stopping': settings.type === OOBA ? settings.early_stopping : undefined,
        'add_bos_token': settings.add_bos_token,
        'dynamic_temperature': dynatemp ? true : undefined,
        'dynatemp_low': dynatemp ? settings.min_temp : undefined,
        'dynatemp_high': dynatemp ? settings.max_temp : undefined,
        'dynatemp_range': dynatemp ? (settings.max_temp - settings.min_temp) / 2 : undefined,
        'dynatemp_exponent': dynatemp ? settings.dynatemp_exponent : undefined,
        'smoothing_factor': settings.smoothing_factor,
        'smoothing_curve': settings.smoothing_curve,
        'dry_allowed_length': settings.dry_allowed_length,
        'dry_multiplier': settings.dry_multiplier,
        'dry_base': settings.dry_base,
        'dry_sequence_breakers': replaceMacrosInList(settings.dry_sequence_breakers),
        'dry_penalty_last_n': settings.dry_penalty_last_n,
        'max_tokens_second': settings.max_tokens_second,
        'sampler_priority': settings.type === OOBA ? settings.sampler_priority : undefined,
        'samplers': settings.type === LLAMACPP ? settings.samplers : undefined,
        'stopping_strings': getStoppingStrings(isImpersonate, isContinue),
        'stop': getStoppingStrings(isImpersonate, isContinue),
        'truncation_length': max_context,
        'ban_eos_token': settings.ban_eos_token,
        'skip_special_tokens': settings.skip_special_tokens,
        'top_a': settings.top_a,
        'tfs': settings.tfs,
        'epsilon_cutoff': [OOBA, MANCER].includes(settings.type) ? settings.epsilon_cutoff : undefined,
        'eta_cutoff': [OOBA, MANCER].includes(settings.type) ? settings.eta_cutoff : undefined,
        'mirostat_mode': settings.mirostat_mode,
        'mirostat_tau': settings.mirostat_tau,
        'mirostat_eta': settings.mirostat_eta,
        'custom_token_bans': [APHRODITE, MANCER].includes(settings.type) ?
            toIntArray(banned_tokens) :
            banned_tokens,
        'banned_strings': banned_strings,
        'api_type': settings.type,
        'api_server': getTextGenServer(),
        'legacy_api': settings.legacy_api && settings.type === OOBA,
        'sampler_order': settings.type === textgen_types.KOBOLDCPP ? settings.sampler_order : undefined,
        'xtc_threshold': settings.xtc_threshold,
        'xtc_probability': settings.xtc_probability,
    };
    const nonAphroditeParams = {
        'rep_pen': settings.rep_pen,
        'rep_pen_range': settings.rep_pen_range,
        'repetition_decay': settings.type === TABBY ? settings.rep_pen_decay : undefined,
        'repetition_penalty_range': settings.rep_pen_range,
        'encoder_repetition_penalty': settings.type === OOBA ? settings.encoder_rep_pen : undefined,
        'no_repeat_ngram_size': settings.type === OOBA ? settings.no_repeat_ngram_size : undefined,
        'penalty_alpha': settings.type === OOBA ? settings.penalty_alpha : undefined,
        'temperature_last': (settings.type === OOBA || settings.type === APHRODITE || settings.type == TABBY) ? settings.temperature_last : undefined,
        'speculative_ngram': settings.type === TABBY ? settings.speculative_ngram : undefined,
        'do_sample': settings.type === OOBA ? settings.do_sample : undefined,
        'seed': settings.seed,
        'guidance_scale': cfgValues?.guidanceScale?.value ?? settings.guidance_scale ?? 1,
        'negative_prompt': cfgValues?.negativePrompt ?? substituteParams(settings.negative_prompt) ?? '',
        'grammar_string': settings.grammar_string,
        'json_schema': [TABBY, LLAMACPP].includes(settings.type) ? settings.json_schema : undefined,
        // llama.cpp aliases. In case someone wants to use LM Studio as Text Completion API
        'repeat_penalty': settings.rep_pen,
        'tfs_z': settings.tfs,
        'repeat_last_n': settings.rep_pen_range,
        'n_predict': maxTokens,
        'num_predict': maxTokens,
        'num_ctx': max_context,
        'mirostat': settings.mirostat_mode,
        'ignore_eos': settings.ban_eos_token,
        'n_probs': power_user.request_token_probabilities ? 10 : undefined,
        'rep_pen_slope': settings.rep_pen_slope,
    };
    const vllmParams = {
        'n': canMultiSwipe ? settings.n : 1,
        'best_of': canMultiSwipe ? settings.n : 1,
        'ignore_eos': settings.ignore_eos_token,
        'spaces_between_special_tokens': settings.spaces_between_special_tokens,
        'seed': settings.seed >= 0 ? settings.seed : undefined,
    };
    const aphroditeParams = {
        'n': canMultiSwipe ? settings.n : 1,
        'frequency_penalty': settings.freq_pen,
        'presence_penalty': settings.presence_pen,
        'repetition_penalty': settings.rep_pen,
        'seed': settings.seed >= 0 ? settings.seed : undefined,
        'stop': getStoppingStrings(isImpersonate, isContinue),
        'temperature': dynatemp ? (settings.min_temp + settings.max_temp) / 2 : settings.temp,
        'temperature_last': settings.temperature_last,
        'top_p': settings.top_p,
        'top_k': settings.top_k,
        'top_a': settings.top_a,
        'min_p': settings.min_p,
        'tfs': settings.tfs,
        'eta_cutoff': settings.eta_cutoff,
        'epsilon_cutoff': settings.epsilon_cutoff,
        'typical_p': settings.typical_p,
        'smoothing_factor': settings.smoothing_factor,
        'smoothing_curve': settings.smoothing_curve,
        'ignore_eos': settings.ignore_eos_token,
        'min_tokens': settings.min_length,
        'skip_special_tokens': settings.skip_special_tokens,
        'spaces_between_special_tokens': settings.spaces_between_special_tokens,
        'guided_grammar': settings.grammar_string,
        'guided_json': settings.json_schema,
        'early_stopping': false, // hacks
        'include_stop_str_in_output': false,
        'dynatemp_min': dynatemp ? settings.min_temp : undefined,
        'dynatemp_max': dynatemp ? settings.max_temp : undefined,
        'dynatemp_exponent': dynatemp ? settings.dynatemp_exponent : undefined,
        'xtc_threshold': settings.xtc_threshold,
        'xtc_probability': settings.xtc_probability,
        'custom_token_bans': toIntArray(banned_tokens),
    };

    if (settings.type === OPENROUTER) {
        params.provider = settings.openrouter_providers;
        params.allow_fallbacks = settings.openrouter_allow_fallbacks;
    }

    if (settings.type === KOBOLDCPP) {
        params.grammar = settings.grammar_string;
    }

    if (settings.type === HUGGINGFACE) {
        params.top_p = Math.min(Math.max(Number(params.top_p), 0.0), 0.999);
        params.stop = Array.isArray(params.stop) ? params.stop.slice(0, 4) : [];
        nonAphroditeParams.seed = settings.seed >= 0 ? settings.seed : Math.floor(Math.random() * Math.pow(2, 32));
    }

    if (settings.type === MANCER) {
        params.n = canMultiSwipe ? settings.n : 1;
        params.epsilon_cutoff /= 1000;
        params.eta_cutoff /= 1000;
        params.dynatemp_mode = params.dynamic_temperature ? 1 : 0;
        params.dynatemp_min = params.dynatemp_low;
        params.dynatemp_max = params.dynatemp_high;
        delete params.dynatemp_low;
        delete params.dynatemp_high;
    }

    if (settings.type === TABBY) {
        params.n = canMultiSwipe ? settings.n : 1;
    }

    switch (settings.type) {
        case VLLM:
        case INFERMATICAI:
            params = Object.assign(params, vllmParams);
            break;

        case APHRODITE:
            // set params to aphroditeParams
            params = Object.assign(params, aphroditeParams);
            break;

        default:
            params = Object.assign(params, nonAphroditeParams);
            break;
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
        const tokenBans = toIntArray(banned_tokens);
        logitBiasArray.push(...tokenBans.map(x => [Number(x), false]));
        const llamaCppParams = {
            'logit_bias': logitBiasArray,
            // Conflicts with ooba's grammar_string
            'grammar': settings.grammar_string,
            'cache_prompt': true,
        };
        params = Object.assign(params, llamaCppParams);
    }

    eventSource.emitAndWait(event_types.TEXT_COMPLETION_SETTINGS_READY, params);

    // Grammar conflicts with with json_schema
    if (settings.type === LLAMACPP) {
        if (params.json_schema && Object.keys(params.json_schema).length > 0) {
            delete params.grammar_string;
            delete params.grammar;
        } else {
            delete params.json_schema;
        }
    }

    return params;
}
