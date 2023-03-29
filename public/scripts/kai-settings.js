import {
    saveSettingsDebounced,
} from "../script.js";

export {
    kai_settings,
    loadKoboldSettings,
    formatKoboldUrl,
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
};

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
        format: (val) => val + " Tokens",
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

    $('#single_line').on("input", function() {
        const value = $(this).prop('checked');
        kai_settings.single_line = value;
        saveSettingsDebounced();
    });
});