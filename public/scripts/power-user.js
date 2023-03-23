export {
    collapseNewlines,
    collapse_newlines,
    force_pygmalion_formatting,
    pin_examples,
    disable_description_formatting,
    disable_scenario_formatting,
    disable_personality_formatting,
    always_force_name2,
    custom_chat_separator,
};

let collapse_newlines = false;
let force_pygmalion_formatting = false;
let pin_examples = false;
let disable_description_formatting = false;
let disable_scenario_formatting = false;
let disable_personality_formatting = false;
let always_force_name2 = false;
let custom_chat_separator = '';

const storage_keys = {
    collapse_newlines: "TavernAI_collapse_newlines",
    force_pygmalion_formatting: "TavernAI_force_pygmalion_formatting",
    pin_examples: "TavernAI_pin_examples",
    disable_description_formatting: "TavernAI_disable_description_formatting",
    disable_scenario_formatting: "TavernAI_disable_scenario_formatting",
    disable_personality_formatting: "TavernAI_disable_personality_formatting",
    always_force_name2: "TavernAI_always_force_name2",
    custom_chat_separator: "TavernAI_custom_chat_separator",
};

function collapseNewlines(x) {
    return x.replaceAll(/\n+/g, "\n");
}

function loadPowerUserSettings() {
    collapse_newlines = localStorage.getItem(storage_keys.collapse_newlines) == "true";
    force_pygmalion_formatting = localStorage.getItem(storage_keys.force_pygmalion_formatting) == "true";
    pin_examples = localStorage.getItem(storage_keys.pin_examples) == "true";
    disable_description_formatting = localStorage.getItem(storage_keys.disable_description_formatting) == "true";
    disable_scenario_formatting = localStorage.getItem(storage_keys.disable_scenario_formatting) == "true";
    disable_personality_formatting = localStorage.getItem(storage_keys.disable_personality_formatting) == "true";
    always_force_name2 = localStorage.getItem(storage_keys.always_force_name2) == "true";
    custom_chat_separator = localStorage.getItem(storage_keys.custom_chat_separator);

    $("#force-pygmalion-formatting-checkbox").prop("checked", force_pygmalion_formatting);
    $("#collapse-newlines-checkbox").prop("checked", collapse_newlines);
    $("#pin-examples-checkbox").prop("checked", pin_examples);
    $("#disable-description-formatting-checkbox").prop("checked", disable_description_formatting);
    $("#disable-scenario-formatting-checkbox").prop("checked", disable_scenario_formatting);
    $("#disable-personality-formatting-checkbox").prop("checked", disable_personality_formatting);
    $("#always-force-name2-checkbox").prop("checked", always_force_name2);
    $("#custom_chat_separator").val(custom_chat_separator);
}

$(document).ready(() => {
    // Auto-load from local storage
    loadPowerUserSettings();

    $("#collapse-newlines-checkbox").change(function () {
        collapse_newlines = !!$(this).prop("checked");
        localStorage.setItem(storage_keys.collapse_newlines, collapse_newlines);
    });

    $("#force-pygmalion-formatting-checkbox").change(function () {
        force_pygmalion_formatting = !!$(this).prop("checked");
        localStorage.setItem(storage_keys.force_pygmalion_formatting, force_pygmalion_formatting);
    });

    $("#pin-examples-checkbox").change(function () {
        pin_examples = !!$(this).prop("checked");
        localStorage.setItem(storage_keys.force_pygmalion_formatting, pin_examples);
    });

    $("#disable-description-formatting-checkbox").change(function () {
        disable_description_formatting = !!$(this).prop('checked');
        localStorage.setItem(storage_keys.disable_description_formatting, disable_description_formatting);
    })

    $("#disable-scenario-formatting-checkbox").change(function () {
        disable_scenario_formatting = !!$(this).prop('checked');
        localStorage.setItem(storage_keys.disable_scenario_formatting, disable_scenario_formatting);
    });

    $("#disable-personality-formatting-checkbox").change(function () {
        disable_personality_formatting = !!$(this).prop('checked');
        localStorage.setItem(storage_keys.disable_personality_formatting, disable_personality_formatting);
    });

    $("#always-force-name2-checkbox").change(function () {
        always_force_name2 = !!$(this).prop("checked");
        localStorage.setItem(storage_keys.always_force_name2, always_force_name2);
    });

    $("#custom_chat_separator").on('input', function() {
        custom_chat_separator = $(this).val();
        localStorage.setItem(storage_keys.custom_chat_separator, custom_chat_separator);
    });
});