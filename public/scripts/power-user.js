export {
    collapse_newlines,
    force_pygmalion_formatting,
};

let collapse_newlines = false;
let force_pygmalion_formatting = false;

const storage_keys = {
    collapse_newlines: "TavernAI_collapse_newlines",
    force_pygmalion_formatting: "TavernAI_force_pygmalion_formatting",
};

function loadPowerUserSettings() {
    collapse_newlines = localStorage.getItem(storage_keys.collapse_newlines) == "true";
    force_pygmalion_formatting = localStorage.getItem(storage_keys.force_pygmalion_formatting) == "true";

    $("#force-pygmalion-formatting-checkbox").prop("checked", force_pygmalion_formatting);
    $("#collapse-newlines-checkbox").prop("checked", collapse_newlines);
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
});