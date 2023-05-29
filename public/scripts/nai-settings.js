import {
    saveSettingsDebounced,
} from "../script.js";

export {
    nai_settings,
    loadNovelPreset,
    loadNovelSettings,
    getNovelTier,
};

const nai_settings = {
    temp_novel: 0.5,
    rep_pen_novel: 1,
    rep_pen_size_novel: 100,
    model_novel: "euterpe-v2",
    preset_settings_novel: "Classic-Euterpe",
};

const nai_tiers = {
    0: 'Paper',
    1: 'Tablet',
    2: 'Scroll',
    3: 'Opus',
};

function getNovelTier(tier) {
    return nai_tiers[tier] ?? 'no_connection';
}

function loadNovelPreset(preset) {
    nai_settings.temp_novel = preset.temperature;
    nai_settings.rep_pen_novel = preset.repetition_penalty;
    nai_settings.rep_pen_size_novel = preset.repetition_penalty_range;
    $("#temp_novel").val(nai_settings.temp_novel);
    $("#temp_counter_novel").html(nai_settings.temp_novel);

    $("#rep_pen_novel").val(nai_settings.rep_pen_novel);
    $("#rep_pen_counter_novel").html(nai_settings.rep_pen_novel);

    $("#rep_pen_size_novel").val(nai_settings.rep_pen_size_novel);
    $("#rep_pen_size_counter_novel").html(`${nai_settings.rep_pen_size_novel}`);
}

function loadNovelSettings(settings) {
    //load the rest of the Novel settings without any checks
    nai_settings.model_novel = settings.model_novel;
    $(`#model_novel_select option[value=${nai_settings.model_novel}]`).attr("selected", true);

    nai_settings.temp_novel = settings.temp_novel;
    nai_settings.rep_pen_novel = settings.rep_pen_novel;
    nai_settings.rep_pen_size_novel = settings.rep_pen_size_novel;

    $("#temp_novel").val(nai_settings.temp_novel);
    $("#temp_counter_novel").text(Number(nai_settings.temp_novel).toFixed(2));

    $("#rep_pen_novel").val(nai_settings.rep_pen_novel);
    $("#rep_pen_counter_novel").text(Number(nai_settings.rep_pen_novel).toFixed(2));

    $("#rep_pen_size_novel").val(nai_settings.rep_pen_size_novel);
    $("#rep_pen_size_counter_novel").text(`${nai_settings.rep_pen_size_novel}`);
}

const sliders = [
    {
        sliderId: "#temp_novel",
        counterId: "#temp_counter_novel",
        format: (val) => Number(val).toFixed(2),
        setValue: (val) => { nai_settings.temp_novel = Number(val); },
    },
    {
        sliderId: "#rep_pen_novel",
        counterId: "#rep_pen_counter_novel",
        format: (val) => Number(val).toFixed(2),
        setValue: (val) => { nai_settings.rep_pen_novel = Number(val); },
    },
    {
        sliderId: "#rep_pen_size_novel",
        counterId: "#rep_pen_size_counter_novel",
        format: (val) => `${val}`,
        setValue: (val) => { nai_settings.rep_pen_size_novel = Number(val); },
    },
];

$(document).ready(function () {
    sliders.forEach(slider => {
        $(document).on("input", slider.sliderId, function () {
            const value = $(this).val();
            const formattedValue = slider.format(value);
            slider.setValue(value);
            $(slider.counterId).html(formattedValue);
            console.log('saving');
            saveSettingsDebounced();
        });
    });

    $("#model_novel_select").change(function () {
        nai_settings.model_novel = $("#model_novel_select").find(":selected").val();
        saveSettingsDebounced();
    });
});