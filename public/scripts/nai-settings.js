import {
    getRequestHeaders,
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
    rep_pen_slope_novel: 0,
    rep_pen_freq_novel: 0,
    rep_pen_presence_novel: 0,
    tail_free_sampling_novel: 0.68,
    model_novel: "euterpe-v2",
    preset_settings_novel: "Classic-Euterpe",
    streaming_novel: false,
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
    $("#amount_gen").val(preset.max_length);
    $("#amount_gen_counter").text(`${preset.max_length}`);
    if (((preset.max_context > 2048) && (!$("#max_context_unlocked")[0].checked)) ||
        ((preset.max_context <= 2048) && ($("#max_context_unlocked")[0].checked))) {
        $("#max_context_unlocked").click();
    }
    $("#max_context").val(preset.max_context);
    $("#max_context_counter").text(`${preset.max_context}`);
    $("#rep_pen_size_novel").attr('max', preset.max_context);

    nai_settings.temp_novel = preset.temperature;
    nai_settings.rep_pen_novel = preset.repetition_penalty;
    nai_settings.rep_pen_size_novel = preset.repetition_penalty_range;
    nai_settings.rep_pen_slope_novel = preset.repetition_penalty_slope;
    nai_settings.rep_pen_freq_novel = preset.repetition_penalty_frequency;
    nai_settings.rep_pen_presence_novel = preset.repetition_penalty_presence;
    nai_settings.tail_free_sampling_novel = preset.tail_free_sampling;
    loadNovelSettingsUi(nai_settings);
}

function loadNovelSettings(settings) {
    //load the rest of the Novel settings without any checks
    nai_settings.model_novel = settings.model_novel;
    $(`#model_novel_select option[value=${nai_settings.model_novel}]`).attr("selected", true);

    nai_settings.temp_novel = settings.temp_novel;
    nai_settings.rep_pen_novel = settings.rep_pen_novel;
    nai_settings.rep_pen_size_novel = settings.rep_pen_size_novel;
    nai_settings.rep_pen_slope_novel = settings.rep_pen_slope_novel;
    nai_settings.rep_pen_freq_novel = settings.rep_pen_freq_novel;
    nai_settings.rep_pen_presence_novel = settings.rep_pen_presence_novel;
    nai_settings.tail_free_sampling_novel = settings.tail_free_sampling_novel;
    nai_settings.streaming_novel = !!settings.streaming_novel;
    loadNovelSettingsUi(nai_settings);
}

function loadNovelSettingsUi(ui_settings) {
    $("#temp_novel").val(ui_settings.temp_novel);
    $("#temp_counter_novel").text(Number(ui_settings.temp_novel).toFixed(2));
    $("#rep_pen_novel").val(ui_settings.rep_pen_novel);
    $("#rep_pen_counter_novel").text(Number(ui_settings.rep_pen_novel).toFixed(2));
    $("#rep_pen_size_novel").val(ui_settings.rep_pen_size_novel);
    $("#rep_pen_size_counter_novel").text(Number(ui_settings.rep_pen_size_novel).toFixed(0));
    $("#rep_pen_slope_novel").val(ui_settings.rep_pen_slope_novel);
    $("#rep_pen_slope_counter_novel").text(Number(`${ui_settings.rep_pen_slope_novel}`).toFixed(2));
    $("#rep_pen_freq_novel").val(ui_settings.rep_pen_freq_novel);
    $("#rep_pen_freq_counter_novel").text(Number(ui_settings.rep_pen_freq_novel).toFixed(5));
    $("#rep_pen_presence_novel").val(ui_settings.rep_pen_presence_novel);
    $("#rep_pen_presence_counter_novel").text(Number(ui_settings.rep_pen_presence_novel).toFixed(3));
    $("#tail_free_sampling_novel").val(ui_settings.tail_free_sampling_novel);
    $("#tail_free_sampling_counter_novel").text(Number(ui_settings.tail_free_sampling_novel).toFixed(3));
    $("#streaming_novel").prop('checked', ui_settings.streaming_novel);
}

const sliders = [
    {
        sliderId: "#temp_novel",
        counterId: "#temp_counter_novel",
        format: (val) => Number(val).toFixed(2),
        setValue: (val) => { nai_settings.temp_novel = Number(val).toFixed(2); },
    },
    {
        sliderId: "#rep_pen_novel",
        counterId: "#rep_pen_counter_novel",
        format: (val) => Number(val).toFixed(2),
        setValue: (val) => { nai_settings.rep_pen_novel = Number(val).toFixed(2); },
    },
    {
        sliderId: "#rep_pen_size_novel",
        counterId: "#rep_pen_size_counter_novel",
        format: (val) => `${val}`,
        setValue: (val) => { nai_settings.rep_pen_size_novel = Number(val).toFixed(0); },
    },
    {
        sliderId: "#rep_pen_slope_novel",
        counterId: "#rep_pen_slope_counter_novel",
        format: (val) => `${val}`,
        setValue: (val) => { nai_settings.rep_pen_slope_novel = Number(val).toFixed(2); },
    },
    {
        sliderId: "#rep_pen_freq_novel",
        counterId: "#rep_pen_freq_counter_novel",
        format: (val) => `${val}`,
        setValue: (val) => { nai_settings.rep_pen_freq_novel = Number(val).toFixed(5); },
    },
    {
        sliderId: "#rep_pen_presence_novel",
        counterId: "#rep_pen_presence_counter_novel",
        format: (val) => `${val}`,
        setValue: (val) => { nai_settings.rep_pen_presence_novel = Number(val).toFixed(3); },
    },
    {
        sliderId: "#tail_free_sampling_novel",
        counterId: "#tail_free_sampling_counter_novel",
        format: (val) => `${val}`,
        setValue: (val) => { nai_settings.tail_free_sampling_novel = Number(val).toFixed(3); },
    },
];

export function getNovelGenerationData(finalPromt, this_settings, this_amount_gen) {
    return {
        "input": finalPromt,
        "model": nai_settings.model_novel,
        "use_string": true,
        "temperature": parseFloat(nai_settings.temp_novel),
        "max_length": this_amount_gen, // this_settings.max_length, // <= why?
        "min_length": this_settings.min_length,
        "tail_free_sampling": parseFloat(nai_settings.tail_free_sampling_novel),
        "repetition_penalty": parseFloat(nai_settings.rep_pen_novel),
        "repetition_penalty_range": parseInt(nai_settings.rep_pen_size_novel),
        "repetition_penalty_slope": parseFloat(nai_settings.rep_pen_slope_novel),
        "repetition_penalty_frequency": parseFloat(nai_settings.rep_pen_freq_novel),
        "repetition_penalty_presence": parseFloat(nai_settings.rep_pen_presence_novel),
        "top_a": this_settings.top_a,
        "top_p": this_settings.top_p,
        "top_k": this_settings.top_k,
        "typical_p": this_settings.typical_p,
        //"stop_sequences": {{187}},
        //bad_words_ids = {{50256}, {0}, {1}};
        "generate_until_sentence": true,
        "use_cache": false,
        "use_string": true,
        "return_full_text": false,
        "prefix": "vanilla",
        "order": this_settings.order,
        "streaming": nai_settings.streaming_novel,
    };
}

export async function generateNovelWithStreaming(generate_data, signal) {
    const response = await fetch('/generate_novelai', {
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

    $('#streaming_novel').on('input', function () {
        const value = !!$(this).prop('checked');
        nai_settings.streaming_novel = value;
        saveSettingsDebounced();
    });

    $("#model_novel_select").change(function () {
        nai_settings.model_novel = $("#model_novel_select").find(":selected").val();
        saveSettingsDebounced();
    });
});
