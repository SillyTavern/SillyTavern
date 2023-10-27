import {
    getRequestHeaders,
    saveSettingsDebounced,
    getStoppingStrings,
    substituteParams,
} from "../script.js";

import {
    power_user,
} from "./power-user.js";
import { getSortableDelay } from "./utils.js";

export const kai_settings = {
    temp: 1,
    rep_pen: 1,
    rep_pen_range: 0,
    top_p: 1,
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
    grammar: "",
    seed: -1,
};

export const kai_flags = {
    can_use_tokenization: false,
    can_use_stop_sequence: false,
    can_use_streaming: false,
    can_use_default_badwordsids: false,
    can_use_mirostat: false,
    can_use_grammar: false,
};

const defaultValues = Object.freeze(structuredClone(kai_settings));

const MIN_STOP_SEQUENCE_VERSION = '1.2.2';
const MIN_UNBAN_VERSION = '1.2.4';
const MIN_STREAMING_KCPPVERSION = '1.30';
const MIN_TOKENIZATION_KCPPVERSION = '1.41';
const MIN_MIROSTAT_KCPPVERSION = '1.35';
const MIN_GRAMMAR_KCPPVERSION = '1.44';
const KOBOLDCPP_ORDER = [6, 0, 1, 3, 4, 2, 5];

export function formatKoboldUrl(value) {
    try {
        const url = new URL(value);
        if (!power_user.relaxed_api_urls) {
            url.pathname = '/api';
        }
        return url.toString();
    } catch { } // Just using URL as a validation check
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

    if (preset.hasOwnProperty('streaming_kobold')) {
        kai_settings.streaming_kobold = preset.streaming_kobold;
        $('#streaming_kobold').prop('checked', kai_settings.streaming_kobold);
    }
    if (preset.hasOwnProperty('use_default_badwordsids')) {
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
        typical: kai_settings.typical,
        s1: sampler_order[0],
        s2: sampler_order[1],
        s3: sampler_order[2],
        s4: sampler_order[3],
        s5: sampler_order[4],
        s6: sampler_order[5],
        s7: sampler_order[6],
        use_world_info: false,
        singleline: false,
        stop_sequence: (kai_flags.can_use_stop_sequence || isHorde) ? getStoppingStrings(isImpersonate) : undefined,
        streaming: kai_settings.streaming_kobold && kai_flags.can_use_streaming && type !== 'quiet',
        can_abort: kai_flags.can_use_streaming,
        mirostat: kai_flags.can_use_mirostat ? kai_settings.mirostat : undefined,
        mirostat_tau: kai_flags.can_use_mirostat ? kai_settings.mirostat_tau : undefined,
        mirostat_eta: kai_flags.can_use_mirostat ? kai_settings.mirostat_eta : undefined,
        use_default_badwordsids: kai_flags.can_use_default_badwordsids ? kai_settings.use_default_badwordsids : undefined,
        grammar: kai_flags.can_use_grammar ? substituteParams(kai_settings.grammar) : undefined,
        sampler_seed: kai_settings.seed >= 0 ? kai_settings.seed : undefined,
    };
    return generate_data;
}

export async function generateKoboldWithStreaming(generate_data, signal) {
    const response = await fetch('/generate', {
        headers: getRequestHeaders(),
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
            let response = decoder.decode(value);
            let eventList = [];

            // ReadableStream's buffer is not guaranteed to contain full SSE messages as they arrive in chunks
            // We need to buffer chunks until we have one or more full messages (separated by double newlines)
            messageBuffer += response;
            eventList = messageBuffer.split("\n\n");
            // Last element will be an empty string or a leftover partial message
            messageBuffer = eventList.pop();

            for (let event of eventList) {
                for (let subEvent of event.split('\n')) {
                    if (subEvent.startsWith("data")) {
                        let data = JSON.parse(subEvent.substring(5));
                        getMessage += (data?.token || '');
                        yield getMessage;
                    }
                }
            }

            if (done) {
                return;
            }
        }
    }
}

const sliders = [
    {
        name: "temp",
        sliderId: "#temp",
        counterId: "#temp_counter",
        format: (val) => Number(val).toFixed(2),
        setValue: (val) => { kai_settings.temp = Number(val); },
    },
    {
        name: "rep_pen",
        sliderId: "#rep_pen",
        counterId: "#rep_pen_counter",
        format: (val) => Number(val).toFixed(2),
        setValue: (val) => { kai_settings.rep_pen = Number(val); },
    },
    {
        name: "rep_pen_range",
        sliderId: "#rep_pen_range",
        counterId: "#rep_pen_range_counter",
        format: (val) => val,
        setValue: (val) => { kai_settings.rep_pen_range = Number(val); },
    },
    {
        name: "top_p",
        sliderId: "#top_p",
        counterId: "#top_p_counter",
        format: (val) => val,
        setValue: (val) => { kai_settings.top_p = Number(val); },
    },
    {
        name: "top_a",
        sliderId: "#top_a",
        counterId: "#top_a_counter",
        format: (val) => val,
        setValue: (val) => { kai_settings.top_a = Number(val); },
    },
    {
        name: "top_k",
        sliderId: "#top_k",
        counterId: "#top_k_counter",
        format: (val) => val,
        setValue: (val) => { kai_settings.top_k = Number(val); },
    },
    {
        name: "typical",
        sliderId: "#typical",
        counterId: "#typical_counter",
        format: (val) => val,
        setValue: (val) => { kai_settings.typical = Number(val); },
    },
    {
        name: "tfs",
        sliderId: "#tfs",
        counterId: "#tfs_counter",
        format: (val) => val,
        setValue: (val) => { kai_settings.tfs = Number(val); },
    },
    {
        name: "rep_pen_slope",
        sliderId: "#rep_pen_slope",
        counterId: "#rep_pen_slope_counter",
        format: (val) => val,
        setValue: (val) => { kai_settings.rep_pen_slope = Number(val); },
    },
    {
        name: "sampler_order",
        sliderId: "#no_op_selector",
        counterId: "#no_op_selector",
        format: (val) => val,
        setValue: (val) => { sortItemsByOrder(val); kai_settings.sampler_order = val; },
    },
    {
        name: "mirostat",
        sliderId: "#mirostat_mode_kobold",
        counterId: "#mirostat_mode_counter_kobold",
        format: (val) => val,
        setValue: (val) => { kai_settings.mirostat = Number(val); },
    },
    {
        name: "mirostat_tau",
        sliderId: "#mirostat_tau_kobold",
        counterId: "#mirostat_tau_counter_kobold",
        format: (val) => val,
        setValue: (val) => { kai_settings.mirostat_tau = Number(val); },
    },
    {
        name: "mirostat_eta",
        sliderId: "#mirostat_eta_kobold",
        counterId: "#mirostat_eta_counter_kobold",
        format: (val) => val,
        setValue: (val) => { kai_settings.mirostat_eta = Number(val); },
    },
    {
        name: "grammar",
        sliderId: "#grammar",
        counterId: "#grammar_counter_kobold",
        format: (val) => val,
        setValue: (val) => { kai_settings.grammar = val; },
    },
    {
        name: "seed",
        sliderId: "#seed_kobold",
        counterId: "#seed_counter_kobold",
        format: (val) => val,
        setValue: (val) => { kai_settings.seed = Number(val); },
    },
];

export function setKoboldFlags(version, koboldVersion) {
    kai_flags.can_use_stop_sequence = canUseKoboldStopSequence(version);
    kai_flags.can_use_streaming = canUseKoboldStreaming(koboldVersion);
    kai_flags.can_use_tokenization = canUseKoboldTokenization(koboldVersion);
    kai_flags.can_use_default_badwordsids = canUseDefaultBadwordIds(version);
    kai_flags.can_use_mirostat = canUseMirostat(koboldVersion);
    kai_flags.can_use_grammar = canUseGrammar(koboldVersion);
}

/**
 * Determines if the Kobold stop sequence can be used with the given version.
 * @param {string} version KoboldAI version to check.
 * @returns {boolean} True if the Kobold stop sequence can be used, false otherwise.
 */
function canUseKoboldStopSequence(version) {
    return (version || '0.0.0').localeCompare(MIN_STOP_SEQUENCE_VERSION, undefined, { numeric: true, sensitivity: 'base' }) > -1;
}

/**
 * Determines if the Kobold default badword ids can be used with the given version.
 * @param {string} version KoboldAI version to check.
 * @returns {boolean} True if the Kobold default badword ids can be used, false otherwise.
 */
function canUseDefaultBadwordIds(version) {
    return (version || '0.0.0').localeCompare(MIN_UNBAN_VERSION, undefined, { numeric: true, sensitivity: 'base' }) > -1;
}

/**
 * Determines if the Kobold streaming API can be used with the given version.
 * @param {{ result: string; version: string; }} koboldVersion KoboldAI version object.
 * @returns {boolean} True if the Kobold streaming API can be used, false otherwise.
 */
function canUseKoboldStreaming(koboldVersion) {
    if (koboldVersion && koboldVersion.result == 'KoboldCpp') {
        return (koboldVersion.version || '0.0').localeCompare(MIN_STREAMING_KCPPVERSION, undefined, { numeric: true, sensitivity: 'base' }) > -1;
    } else return false;
}

/**
 * Determines if the Kobold tokenization API can be used with the given version.
 * @param {{ result: string; version: string; }} koboldVersion KoboldAI version object.
 * @returns {boolean} True if the Kobold tokenization API can be used, false otherwise.
 */
function canUseKoboldTokenization(koboldVersion) {
    if (koboldVersion && koboldVersion.result == 'KoboldCpp') {
        return (koboldVersion.version || '0.0').localeCompare(MIN_TOKENIZATION_KCPPVERSION, undefined, { numeric: true, sensitivity: 'base' }) > -1;
    } else return false;
}

/**
 * Determines if the Kobold mirostat can be used with the given version.
 * @param {{result: string; version: string;}} koboldVersion KoboldAI version object.
 * @returns {boolean} True if the Kobold mirostat API can be used, false otherwise.
 */
function canUseMirostat(koboldVersion) {
    if (koboldVersion && koboldVersion.result == 'KoboldCpp') {
        return (koboldVersion.version || '0.0').localeCompare(MIN_MIROSTAT_KCPPVERSION, undefined, { numeric: true, sensitivity: 'base' }) > -1;
    } else return false;
}

/**
 * Determines if the Kobold grammar can be used with the given version.
 * @param {{result: string; version:string;}} koboldVersion KoboldAI version object.
 * @returns {boolean} True if the Kobold grammar can be used, false otherwise.
 */
function canUseGrammar(koboldVersion) {
    if (koboldVersion && koboldVersion.result == 'KoboldCpp') {
        return (koboldVersion.version || '0.0').localeCompare(MIN_GRAMMAR_KCPPVERSION, undefined, { numeric: true, sensitivity: 'base' }) > -1;
    } else return false;
}

/**
 * Sorts the sampler items by the given order.
 * @param {any[]} orderArray Sampler order array.
 */
function sortItemsByOrder(orderArray) {
    console.debug('Preset samplers order: ' + orderArray);
    const $draggableItems = $("#kobold_order");

    for (let i = 0; i < orderArray.length; i++) {
        const index = orderArray[i];
        const $item = $draggableItems.find(`[data-id="${index}"]`).detach();
        $draggableItems.append($item);
    }
}

jQuery(function () {
    sliders.forEach(slider => {
        $(document).on("input", slider.sliderId, function () {
            const value = $(this).val();
            const formattedValue = slider.format(value);
            slider.setValue(value);
            $(slider.counterId).val(formattedValue);
            saveSettingsDebounced();
        });
    });

    $('#streaming_kobold').on("input", function () {
        const value = !!$(this).prop('checked');
        kai_settings.streaming_kobold = value;
        saveSettingsDebounced();
    });

    $('#use_default_badwordsids').on("input", function () {
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
