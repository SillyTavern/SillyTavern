import {
    getRequestHeaders,
    saveSettingsDebounced,
    getStoppingStrings,
    substituteParams,
    api_server,
    main_api,
} from '../script.js';

import {
    power_user,
} from './power-user.js';
import EventSourceStream from './sse-stream.js';
import { getSortableDelay } from './utils.js';

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

export function loadKoboldSettings(preset) {
    for (const name of Object.keys(kai_settings)) {
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

        api_server,
        main_api,
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
    const eventStream = new EventSourceStream();
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
            yield { text, swipes: [] };
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

export function setKoboldFlags(koboldUnitedVersion, koboldCppVersion) {
    kai_flags.can_use_stop_sequence = versionCompare(koboldUnitedVersion, MIN_STOP_SEQUENCE_VERSION);
    kai_flags.can_use_streaming = versionCompare(koboldCppVersion, MIN_STREAMING_KCPPVERSION);
    kai_flags.can_use_tokenization = versionCompare(koboldCppVersion, MIN_TOKENIZATION_KCPPVERSION);
    kai_flags.can_use_default_badwordsids = versionCompare(koboldUnitedVersion, MIN_UNBAN_VERSION);
    kai_flags.can_use_mirostat = versionCompare(koboldCppVersion, MIN_MIROSTAT_KCPPVERSION);
    kai_flags.can_use_grammar = versionCompare(koboldCppVersion, MIN_GRAMMAR_KCPPVERSION);
    kai_flags.can_use_min_p = versionCompare(koboldCppVersion, MIN_MIN_P_KCPPVERSION);
}

/**
 * Compares two version numbers, returning true if srcVersion >= minVersion
 * @param {string} srcVersion The current version.
 * @param {string} minVersion The target version number to test against
 * @returns {boolean} True if srcVersion >= minVersion, false if not
 */
function versionCompare(srcVersion, minVersion) {
    return (srcVersion || '0.0.0').localeCompare(minVersion, undefined, { numeric: true, sensitivity: 'base' }) > -1;
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

jQuery(function () {
    sliders.forEach(slider => {
        $(document).on('input', slider.sliderId, function () {
            const value = $(this).val();
            const formattedValue = slider.format(value);
            slider.setValue(value);
            $(slider.counterId).val(formattedValue);
            saveSettingsDebounced();
        });
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
});
