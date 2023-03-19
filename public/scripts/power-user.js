export {
    collapseNewlines,
    collapse_newlines,
    force_pygmalion_formatting,
    pin_examples,
};

let collapse_newlines = false;
let force_pygmalion_formatting = false;
let pin_examples = false;

const storage_keys = {
    collapse_newlines: "TavernAI_collapse_newlines",
    force_pygmalion_formatting: "TavernAI_force_pygmalion_formatting",
    pin_examples: "TavernAI_pin_examples",
};

function collapseNewlines(x) {
    return x.replaceAll(/\n+/g, "\n");
}

function loadPowerUserSettings() {
    collapse_newlines = localStorage.getItem(storage_keys.collapse_newlines) == "true";
    force_pygmalion_formatting = localStorage.getItem(storage_keys.force_pygmalion_formatting) == "true";
    pin_examples =  localStorage.getItem(storage_keys.pin_examples) == "true";

    $("#force-pygmalion-formatting-checkbox").prop("checked", force_pygmalion_formatting);
    $("#collapse-newlines-checkbox").prop("checked", collapse_newlines);
    $("#pin-examples-checkbox").prop("checked", pin_examples);
}

$(document).ready(() => {
    // Auto-load from local storage
    loadPowerUserSettings();

    $("#collapse-newlines-checkbox").change(function () {
        collapse_newlines = !!$("#collapse-newlines-checkbox").prop("checked");
        localStorage.setItem(storage_keys.collapse_newlines, collapse_newlines);
    });

    $("#force-pygmalion-formatting-checkbox").change(function () {
        force_pygmalion_formatting = !!$("#force-pygmalion-formatting-checkbox").prop("checked");
        localStorage.setItem(storage_keys.force_pygmalion_formatting, force_pygmalion_formatting);
    });

    $("#pin-examples-checkbox").change(function () {
        pin_examples = !!$("#pin-examples-checkbox").prop("checked");
        localStorage.setItem(storage_keys.force_pygmalion_formatting, pin_examples);
    });
});