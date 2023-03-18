import {
    saveSettingsDebounced,
} from "../script.js";

export {
    kai_settings,
    loadKoboldSettings,
};

const kai_settings = {
    top_p: 1,
    top_a: 1,
    top_k: 0,
    typical: 1,
    tfs: 1,
    rep_pen_slope: 0.9,
};

function loadKoboldSettings(preset) {
    for (const name of Object.keys(kai_settings)) {
        kai_settings[name] = preset[name];
        $(`#${name}`).val(kai_settings[name]);
        $(`#${name}_counter`).text(kai_settings[name]);
    }
}

// Cohee's TODO: Merge with sliders block in script.js
const sliders = [
    {
        sliderId: "#top_p",
        counterId: "#top_p_counter",
        format: (val) => val,
        setValue: (val) => { kai_settings.top_p = Number(val); },
    },
    {
        sliderId: "#top_a",
        counterId: "#top_a_counter",
        format: (val) => val,
        setValue: (val) => { kai_settings.top_a = Number(val); },
    },
    {
        sliderId: "#top_k",
        counterId: "#top_k_counter",
        format: (val) => val,
        setValue: (val) => { kai_settings.top_k = Number(val); },
    },
    {
        sliderId: "#typical",
        counterId: "#typical_counter",
        format: (val) => val,
        setValue: (val) => { kai_settings.typical = Number(val); },
    },
    {
        sliderId: "#tfs",
        counterId: "#tfs_counter",
        format: (val) => val,
        setValue: (val) => { kai_settings.tfs = Number(val); },
    },
    {
        sliderId: "#rep_pen_slope",
        counterId: "#rep_pen_slope_counter",
        format: (val) => val,
        setValue: (val) => { kai_settings.rep_pen_slope = Number(val); },
    },
];

$(document).ready(function () {
    $('.drawer-toggle').click(function () {
        var icon = $(this).find('.drawer-icon');
        icon.toggleClass('down up');
        $(this).closest('.drawer').find('.drawer-content').slideToggle();
    });

    sliders.forEach(slider => {
        $(document).on("input", slider.sliderId, function () {
            const value = $(this).val();
            const formattedValue = slider.format(value);
            slider.setValue(value);
            $(slider.counterId).html(formattedValue);
            saveSettingsDebounced();
        });
    });
});