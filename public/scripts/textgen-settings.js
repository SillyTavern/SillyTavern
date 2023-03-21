import {
    saveSettingsDebounced,
} from "../script.js";

export {
    textgenerationwebui_settings,
    loadTextGenSettings,
}

let textgenerationwebui_settings = {
    temp: 0.5,
    top_p: 0.9,
    top_k: 0,
    typical_p: 1,
    rep_pen: 1.1,
    rep_pen_size: 0,
    penalty_alpha: 0,
};

const setting_names = [
    "temp",
    "rep_pen",
    "rep_pen_size",
    "top_k",
    "top_p",
    "typical_p",
    "penalty_alpha",
];

function loadTextGenSettings(settings) {
    textgenerationwebui_settings = settings ? settings : textgenerationwebui_settings;

    for (const i of setting_names) {
        const val = parseFloat(textgenerationwebui_settings[i]);
        $(`#${i}_textgenerationwebui`).val(val);
        $(`#${i}_counter_textgenerationwebui`).text(val.toFixed(2));
    }
}

$(document).ready(function() {
    for (const i of setting_names) {
        $(`#${i}_textgenerationwebui`).attr("x-setting-id", i);
        $(document).on("input", `#${i}_textgenerationwebui`, function () {
            const id = $(this).attr("x-setting-id");
            const val = parseFloat($(this).val());
            $(`#${id}_counter_textgenerationwebui`).text(val.toFixed(2));
            textgenerationwebui_settings[id] = parseFloat(val);
            saveSettingsDebounced();
        });
    }
})