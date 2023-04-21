import {
    saveSettingsDebounced,
    getStoppingStrings,
} from "../script.js";

export {
    kai_settings,
    loadKoboldSettings,
    formatKoboldUrl,
    getKoboldGenerationData,
    canUseKoboldStopSequence,
};

const kai_settings = {
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
};

const MIN_STOP_SEQUENCE_VERSION = '1.2.2';

function formatKoboldUrl(value) {
    try {
        const url = new URL(value);
        url.pathname = '/api';
        return url.toString();
    }
    catch {
        return null;
    }
}

function loadKoboldSettings(preset) {
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
}

function getKoboldGenerationData(finalPromt, this_settings, this_amount_gen, this_max_context, isImpersonate) {
    let generate_data = {
        prompt: finalPromt,
        gui_settings: false,
        sampler_order: this_settings.sampler_order,
        max_context_length: parseInt(this_max_context),
        max_length: this_amount_gen,
        rep_pen: parseFloat(kai_settings.rep_pen),
        rep_pen_range: parseInt(kai_settings.rep_pen_range),
        rep_pen_slope: kai_settings.rep_pen_slope,
        temperature: parseFloat(kai_settings.temp),
        tfs: kai_settings.tfs,
        top_a: kai_settings.top_a,
        top_k: kai_settings.top_k,
        top_p: kai_settings.top_p,
        typical: kai_settings.typical,
        s1: this_settings.sampler_order[0],
        s2: this_settings.sampler_order[1],
        s3: this_settings.sampler_order[2],
        s4: this_settings.sampler_order[3],
        s5: this_settings.sampler_order[4],
        s6: this_settings.sampler_order[5],
        s7: this_settings.sampler_order[6],
        use_world_info: false,
        singleline: kai_settings.single_line,
        stop_sequence: kai_settings.use_stop_sequence ? getStoppingStrings(isImpersonate, false) : undefined,
    };
    return generate_data;
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
];

function canUseKoboldStopSequence(version) {
    return (version || '0.0.0').localeCompare(MIN_STOP_SEQUENCE_VERSION, undefined, { numeric: true, sensitivity: 'base' }) > -1;
}

$(document).ready(function () {
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
});