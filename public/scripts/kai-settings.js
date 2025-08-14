import {
    getRequestHeaders,
    saveSettingsDebounced,
    getStoppingStrings,
    substituteParams,
    setOnlineStatus,
    resultCheckStatus,
    main_api,
    online_status,
    abortStatusCheck,
    startStatusLoading,
    setGenerationParamsFromPreset,
    eventSource,
    event_types,
} from '../script.js';
import { t } from './i18n.js';
import { autoSelectInstructPreset } from './instruct-mode.js';

import {
    power_user,
} from './power-user.js';
import { getEventSourceStream } from './sse-stream.js';
import { getSortableDelay, versionCompare } from './utils.js';

export let koboldai_settings;
export let koboldai_setting_names;

export const kai_settings = {
    temp: 1,
    rep_pen: 1,
    rep_pen_range: 0,
    top_p: 1,
    min_p: 0,
    top_a: 1,
    top_k: 0,
    typical: 1,
    tfs: 1,
    rep_pen_slope: 0.9,
    streaming_kobold: false,
    sampler_order: [0, 1, 2, 3, 4, 5, 6],
    mirostat: 0,
    mirostat_tau: 5.0,
    mirostat_eta: 0.1,
    use_default_badwordsids: false,
    grammar: '',
    seed: -1,
    api_server: '',
    preset_settings: 'gui',
    extensions: {},
};

/**
 * Stable version of KoboldAI has a nasty payload validation.
 * It will reject any payload that has a key that is not in the whitelist.
 * @typedef {Object.<string, boolean>} kai_flags
 */
export const kai_flags = {
    can_use_tokenization: false,
    can_use_stop_sequence: false,
    can_use_streaming: false,
    can_use_default_badwordsids: false,
    can_use_mirostat: false,
    can_use_grammar: false,
    can_use_min_p: false,
};

const defaultValues = Object.freeze(structuredClone(kai_settings));

const MIN_STOP_SEQUENCE_VERSION = '1.2.2';
const MIN_UNBAN_VERSION = '1.2.4';
const MIN_STREAMING_KCPPVERSION = '1.30';
const MIN_TOKENIZATION_KCPPVERSION = '1.41';
const MIN_MIROSTAT_KCPPVERSION = '1.35';
const MIN_GRAMMAR_KCPPVERSION = '1.44';
const MIN_MIN_P_KCPPVERSION = '1.48';
const KOBOLDCPP_ORDER = [6, 0, 1, 3, 4, 2, 5];

export function formatKoboldUrl(value) {
    try {
        const url = new URL(value);
        if (!power_user.relaxed_api_urls) {
            url.pathname = '/api';
        }
        return url.toString();
    } catch {
        // Just using URL as a validation check
    }
    return null;
}

function selectKoboldGuiPreset() {
    $('#settings_preset option[value=gui]')
        .attr('selected', 'true')
        .trigger('change');
}

export function loadKoboldSettings(data, preset, settings) {
    koboldai_setting_names = data.koboldai_setting_names;
    koboldai_settings = data.koboldai_settings;
    koboldai_settings.forEach(function (item, i, arr) {
        koboldai_settings[i] = JSON.parse(item);
    });

    $('#settings_preset').empty();
    $('#settings_preset').append('<option value="gui">GUI KoboldAI Settings</option>');
    const names = {};
    koboldai_setting_names.forEach(function (item, i, arr) {
        names[item] = i;
        $('#settings_preset').append(`<option value=${i}>${item}</option>`);
    });
    koboldai_setting_names = names;

    kai_settings.preset_settings = preset.preset_settings ?? settings.preset_settings;
    kai_settings.api_server = preset.api_server ?? settings.api_server;

    if (kai_settings.preset_settings == 'gui') {
        selectKoboldGuiPreset();
    } else {
        if (typeof koboldai_setting_names[kai_settings.preset_settings] !== 'undefined') {
            $(`#settings_preset option[value=${koboldai_setting_names[kai_settings.preset_settings]}]`)
                .attr('selected', 'true');
        } else {
            kai_settings.preset_settings = 'gui';
            selectKoboldGuiPreset();
        }
    }

    loadKoboldSettingsFromPreset(preset);

    //Load the API server URL from settings
    $('#api_url_text').val(kai_settings.api_server);
}

function loadKoboldSettingsFromPreset(preset) {
    for (const name of Object.keys(kai_settings)) {
        if (name === 'extensions') {
            kai_settings.extensions = preset.extensions || {};
            continue;
        }

        const value = preset[name] ?? defaultValues[name];
        const slider = sliders.find(x => x.name === name);

        if (!slider) {
            continue;
        }

        const formattedValue = slider.format(value);
        slider.setValue(value);
        $(slider.sliderId).val(value);
        $(slider.counterId).val(formattedValue);
    }

    if (Object.hasOwn(preset, 'streaming_kobold')) {
        kai_settings.streaming_kobold = preset.streaming_kobold;
        $('#streaming_kobold').prop('checked', kai_settings.streaming_kobold);
    }
    if (Object.hasOwn(preset, 'use_default_badwordsids')) {
        kai_settings.use_default_badwordsids = preset.use_default_badwordsids;
        $('#use_default_badwordsids').prop('checked', kai_settings.use_default_badwordsids);
    }
}

/**
 * Gets the Kobold generation data.
 * @param {string} finalPrompt Final text prompt.
 * @param {object} settings Settings preset object.
 * @param {number} maxLength Maximum length.
 * @param {number} maxContextLength Maximum context length.
 * @param {boolean} isHorde True if the generation is for a horde, false otherwise.
 * @param {string} type Generation type.
 * @returns {object} Kobold generation data.
 */
export function getKoboldGenerationData(finalPrompt, settings, maxLength, maxContextLength, isHorde, type) {
    const isImpersonate = type === 'impersonate';
    const isContinue = type === 'continue';
    const sampler_order = kai_settings.sampler_order || settings.sampler_order;

    let generate_data = {
        prompt: finalPrompt,
        gui_settings: false,
        sampler_order: sampler_order,
        max_context_length: Number(maxContextLength),
        max_length: maxLength,
        rep_pen: Number(kai_settings.rep_pen),
        rep_pen_range: Number(kai_settings.rep_pen_range),
        rep_pen_slope: kai_settings.rep_pen_slope,
        temperature: Number(kai_settings.temp),
        tfs: kai_settings.tfs,
        top_a: kai_settings.top_a,
        top_k: kai_settings.top_k,
        top_p: kai_settings.top_p,
        min_p: (kai_flags.can_use_min_p || isHorde) ? kai_settings.min_p : undefined,
        typical: kai_settings.typical,
        use_world_info: false,
        singleline: false,
        stop_sequence: (kai_flags.can_use_stop_sequence || isHorde) ? getStoppingStrings(isImpersonate, isContinue) : undefined,
        streaming: kai_settings.streaming_kobold && kai_flags.can_use_streaming && type !== 'quiet',
        can_abort: kai_flags.can_use_streaming,
        mirostat: (kai_flags.can_use_mirostat || isHorde) ? kai_settings.mirostat : undefined,
        mirostat_tau: (kai_flags.can_use_mirostat || isHorde) ? kai_settings.mirostat_tau : undefined,
        mirostat_eta: (kai_flags.can_use_mirostat || isHorde) ? kai_settings.mirostat_eta : undefined,
        use_default_badwordsids: (kai_flags.can_use_default_badwordsids || isHorde) ? kai_settings.use_default_badwordsids : undefined,
        grammar: (kai_flags.can_use_grammar || isHorde) ? substituteParams(kai_settings.grammar) : undefined,
        sampler_seed: kai_settings.seed >= 0 ? kai_settings.seed : undefined,
        api_server: kai_settings.api_server,
    };
    return generate_data;
}

function tryParseStreamingError(response, decoded) {
    try {
        const data = JSON.parse(decoded);

        if (!data) {
            return;
        }

        if (data.error) {
            toastr.error(data.error.message || response.statusText, 'KoboldAI API');
            throw new Error(data);
        }
    }
    catch {
        // No JSON. Do nothing.
    }
}

export async function generateKoboldWithStreaming(generate_data, signal) {
    const response = await fetch('/api/backends/kobold/generate', {
        headers: getRequestHeaders(),
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
        while (true) {
            const { done, value } = await reader.read();
            if (done) return;

            const data = JSON.parse(value.data);
            if (data?.token) {
                text += data.token;
            }
            yield { text, swipes: [], toolCalls: [], state: {} };
        }
    };
}

const sliders = [
    {
        name: 'temp',
        sliderId: '#temp',
        counterId: '#temp_counter',
        format: (val) => Number(val).toFixed(2),
        setValue: (val) => { kai_settings.temp = Number(val); },
    },
    {
        name: 'rep_pen',
        sliderId: '#rep_pen',
        counterId: '#rep_pen_counter',
        format: (val) => Number(val).toFixed(2),
        setValue: (val) => { kai_settings.rep_pen = Number(val); },
    },
    {
        name: 'rep_pen_range',
        sliderId: '#rep_pen_range',
        counterId: '#rep_pen_range_counter',
        format: (val) => val,
        setValue: (val) => { kai_settings.rep_pen_range = Number(val); },
    },
    {
        name: 'top_p',
        sliderId: '#top_p',
        counterId: '#top_p_counter',
        format: (val) => val,
        setValue: (val) => { kai_settings.top_p = Number(val); },
    },
    {
        name: 'min_p',
        sliderId: '#min_p',
        counterId: '#min_p_counter',
        format: (val) => val,
        setValue: (val) => { kai_settings.min_p = Number(val); },
    },
    {
        name: 'top_a',
        sliderId: '#top_a',
        counterId: '#top_a_counter',
        format: (val) => val,
        setValue: (val) => { kai_settings.top_a = Number(val); },
    },
    {
        name: 'top_k',
        sliderId: '#top_k',
        counterId: '#top_k_counter',
        format: (val) => val,
        setValue: (val) => { kai_settings.top_k = Number(val); },
    },
    {
        name: 'typical',
        sliderId: '#typical_p',
        counterId: '#typical_p_counter',
        format: (val) => val,
        setValue: (val) => { kai_settings.typical = Number(val); },
    },
    {
        name: 'tfs',
        sliderId: '#tfs',
        counterId: '#tfs_counter',
        format: (val) => val,
        setValue: (val) => { kai_settings.tfs = Number(val); },
    },
    {
        name: 'rep_pen_slope',
        sliderId: '#rep_pen_slope',
        counterId: '#rep_pen_slope_counter',
        format: (val) => val,
        setValue: (val) => { kai_settings.rep_pen_slope = Number(val); },
    },
    {
        name: 'sampler_order',
        sliderId: '#no_op_selector',
        counterId: '#no_op_selector',
        format: (val) => val,
        setValue: (val) => { sortItemsByOrder(val); kai_settings.sampler_order = val; },
    },
    {
        name: 'mirostat',
        sliderId: '#mirostat_mode_kobold',
        counterId: '#mirostat_mode_counter_kobold',
        format: (val) => val,
        setValue: (val) => { kai_settings.mirostat = Number(val); },
    },
    {
        name: 'mirostat_tau',
        sliderId: '#mirostat_tau_kobold',
        counterId: '#mirostat_tau_counter_kobold',
        format: (val) => val,
        setValue: (val) => { kai_settings.mirostat_tau = Number(val); },
    },
    {
        name: 'mirostat_eta',
        sliderId: '#mirostat_eta_kobold',
        counterId: '#mirostat_eta_counter_kobold',
        format: (val) => val,
        setValue: (val) => { kai_settings.mirostat_eta = Number(val); },
    },
    {
        name: 'grammar',
        sliderId: '#grammar',
        counterId: '#grammar_counter_kobold',
        format: (val) => val,
        setValue: (val) => { kai_settings.grammar = val; },
    },
    {
        name: 'seed',
        sliderId: '#seed_kobold',
        counterId: '#seed_counter_kobold',
        format: (val) => val,
        setValue: (val) => { kai_settings.seed = Number(val); },
    },
];

/**
 * Sets the supported feature flags for the KoboldAI backend.
 * @param {string} koboldUnitedVersion Kobold United version
 * @param {string} koboldCppVersion KoboldCPP version
 */
export function setKoboldFlags(koboldUnitedVersion, koboldCppVersion) {
    kai_flags.can_use_stop_sequence = versionCompare(koboldUnitedVersion, MIN_STOP_SEQUENCE_VERSION);
    kai_flags.can_use_streaming = versionCompare(koboldCppVersion, MIN_STREAMING_KCPPVERSION);
    kai_flags.can_use_tokenization = versionCompare(koboldCppVersion, MIN_TOKENIZATION_KCPPVERSION);
    kai_flags.can_use_default_badwordsids = versionCompare(koboldUnitedVersion, MIN_UNBAN_VERSION);
    kai_flags.can_use_mirostat = versionCompare(koboldCppVersion, MIN_MIROSTAT_KCPPVERSION);
    kai_flags.can_use_grammar = versionCompare(koboldCppVersion, MIN_GRAMMAR_KCPPVERSION);
    kai_flags.can_use_min_p = versionCompare(koboldCppVersion, MIN_MIN_P_KCPPVERSION);
    const isKoboldCpp = versionCompare(koboldCppVersion, '1.0.0');
    $('#koboldcpp_hint').toggleClass('displayNone', !isKoboldCpp);
}

/**
 * Sorts the sampler items by the given order.
 * @param {any[]} orderArray Sampler order array.
 */
function sortItemsByOrder(orderArray) {
    console.debug('Preset samplers order: ' + orderArray);
    const $draggableItems = $('#kobold_order');

    for (let i = 0; i < orderArray.length; i++) {
        const index = orderArray[i];
        const $item = $draggableItems.find(`[data-id="${index}"]`).detach();
        $draggableItems.append($item);
    }
}

export async function getStatusKobold() {
    let endpoint = kai_settings.api_server;

    if (!endpoint) {
        console.warn('No endpoint for status check');
        setOnlineStatus('no_connection');
        return resultCheckStatus();
    }

    try {
        const response = await fetch('/api/backends/kobold/status', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                main_api,
                api_server: endpoint,
            }),
            signal: abortStatusCheck.signal,
        });

        const data = await response.json();

        setOnlineStatus(data?.model ?? 'no_connection');

        if (!data.koboldUnitedVersion) {
            throw new Error(`Missing mandatory Kobold version in data: ${JSON.stringify(data)}`);
        }

        // Determine instruct mode preset
        autoSelectInstructPreset(online_status);

        // determine if we can use stop sequence and streaming
        setKoboldFlags(data.koboldUnitedVersion, data.koboldCppVersion);

        // We didn't get a 200 status code, but the endpoint has an explanation. Which means it DID connect, but I digress.
        if (online_status === 'no_connection' && data.response) {
            toastr.error(data.response, t`API Error`, { timeOut: 5000, preventDuplicates: true });
        }
    } catch (err) {
        console.error('Error getting status', err);
        setOnlineStatus('no_connection');
    }

    return resultCheckStatus();
}

export function initKoboldSettings() {
    sliders.forEach(slider => {
        $(document).on('input', slider.sliderId, function () {
            const value = $(this).val();
            const formattedValue = slider.format(value);
            slider.setValue(value);
            $(slider.counterId).val(formattedValue);
            saveSettingsDebounced();
        });
    });

    $('#api_button').on('click', function (e) {
        if ($('#api_url_text').val() != '') {
            const value = formatKoboldUrl(String($('#api_url_text').val()).trim());

            if (!value) {
                toastr.error('Please enter a valid URL.');
                return;
            }

            $('#api_url_text').val(value);
            kai_settings.api_server = value;
            startStatusLoading();
            saveSettingsDebounced();
            getStatusKobold();
        }
    });

    $('#streaming_kobold').on('input', function () {
        const value = !!$(this).prop('checked');
        kai_settings.streaming_kobold = value;
        saveSettingsDebounced();
    });

    $('#use_default_badwordsids').on('input', function () {
        const value = !!$(this).prop('checked');
        kai_settings.use_default_badwordsids = value;
        saveSettingsDebounced();
    });

    $('#kobold_order').sortable({
        delay: getSortableDelay(),
        stop: function () {
            const order = [];
            $('#kobold_order').children().each(function () {
                order.push($(this).data('id'));
            });
            kai_settings.sampler_order = order;
            console.log('Samplers reordered:', kai_settings.sampler_order);
            saveSettingsDebounced();
        },
    });

    $('#samplers_order_recommended').on('click', function () {
        kai_settings.sampler_order = KOBOLDCPP_ORDER;
        sortItemsByOrder(kai_settings.sampler_order);
        saveSettingsDebounced();
    });

    $('#settings_preset').on('change', async function () {
        if ($('#settings_preset').find(':selected').val() != 'gui') {
            kai_settings.preset_settings = $('#settings_preset').find(':selected').text();
            const preset = koboldai_settings[koboldai_setting_names[kai_settings.preset_settings]];
            loadKoboldSettingsFromPreset(preset);
            setGenerationParamsFromPreset(preset);
            $('#kobold_api-settings').find('input').prop('disabled', false);
            $('#kobold_api-settings').css('opacity', 1.0);
            $('#kobold_order')
                .css('opacity', 1)
                .sortable('enable');
        } else {
            kai_settings.preset_settings = 'gui';

            $('#kobold_api-settings').find('input').prop('disabled', true);
            $('#kobold_api-settings').css('opacity', 0.5);

            $('#kobold_order')
                .css('opacity', 0.5)
                .sortable('disable');
        }
        saveSettingsDebounced();
        await eventSource.emit(event_types.PRESET_CHANGED, { apiId: 'kobold', name: kai_settings.preset_settings });
    });
}
