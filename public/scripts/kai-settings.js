import {
    getRequestHeaders,
    saveSettingsDebounced,
    getStoppingStrings,
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
    single_line: false,
    use_stop_sequence: false,
    can_use_tokenization: false,
    streaming_kobold: false,
    sampler_order: [0, 1, 2, 3, 4, 5, 6],
};

const MIN_STOP_SEQUENCE_VERSION = '1.2.2';
const MIN_STREAMING_KCPPVERSION = '1.30';
const MIN_TOKENIZATION_KCPPVERSION = '1.41';
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
        const value = preset[name];
        const slider = sliders.find(x => x.name === name);

        if (value === undefined || !slider) {
            continue;
        }

        const formattedValue = slider.format(value);
        slider.setValue(preset[name]);
        $(slider.sliderId).val(preset[name]);
        $(slider.counterId).text(formattedValue);
    }

    // TODO: refactor checkboxes (if adding any more)
    if (preset.hasOwnProperty('single_line')) {
        kai_settings.single_line = preset.single_line;
        $('#single_line').prop('checked', kai_settings.single_line);
    }
    if (preset.hasOwnProperty('streaming_kobold')) {
        kai_settings.streaming_kobold = preset.streaming_kobold;
        $('#streaming_kobold').prop('checked', kai_settings.streaming_kobold);
    }
}

export function getKoboldGenerationData(finalPrompt, this_settings, this_amount_gen, this_max_context, isImpersonate, type) {
    const sampler_order = kai_settings.sampler_order || this_settings.sampler_order;
    let generate_data = {
        prompt: finalPrompt,
        gui_settings: false,
        sampler_order: sampler_order,
        max_context_length: Number(this_max_context),
        max_length: this_amount_gen,
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
        singleline: kai_settings.single_line,
        stop_sequence: kai_settings.use_stop_sequence ? getStoppingStrings(isImpersonate, false) : undefined,
        streaming: kai_settings.streaming_kobold && kai_settings.can_use_streaming && type !== 'quiet',
        can_abort: kai_settings.can_use_streaming,
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
    }
];

/**
 * Determines if the Kobold stop sequence can be used with the given version.
 * @param {string} version KoboldAI version to check.
 * @returns {boolean} True if the Kobold stop sequence can be used, false otherwise.
 */
export function canUseKoboldStopSequence(version) {
    return (version || '0.0.0').localeCompare(MIN_STOP_SEQUENCE_VERSION, undefined, { numeric: true, sensitivity: 'base' }) > -1;
}

/**
 * Determines if the Kobold streaming API can be used with the given version.
 * @param {{ result: string; version: string; }} koboldVersion KoboldAI version object.
 * @returns {boolean} True if the Kobold streaming API can be used, false otherwise.
 */
export function canUseKoboldStreaming(koboldVersion) {
    if (koboldVersion && koboldVersion.result == 'KoboldCpp') {
        return (koboldVersion.version || '0.0').localeCompare(MIN_STREAMING_KCPPVERSION, undefined, { numeric: true, sensitivity: 'base' }) > -1;
    } else return false;
}

/**
 * Determines if the Kobold tokenization API can be used with the given version.
 * @param {{ result: string; version: string; }} koboldVersion KoboldAI version object.
 * @returns {boolean} True if the Kobold tokenization API can be used, false otherwise.
 */
export function canUseKoboldTokenization(koboldVersion) {
    if (koboldVersion && koboldVersion.result == 'KoboldCpp') {
        return (koboldVersion.version || '0.0').localeCompare(MIN_TOKENIZATION_KCPPVERSION, undefined, { numeric: true, sensitivity: 'base' }) > -1;
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
            $(slider.counterId).html(formattedValue);
            saveSettingsDebounced();
        });
    });

    $('#single_line').on("input", function () {
        const value = $(this).prop('checked');
        kai_settings.single_line = value;
        saveSettingsDebounced();
    });

    $('#streaming_kobold').on("input", function () {
        const value = $(this).prop('checked');
        kai_settings.streaming_kobold = value;
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
