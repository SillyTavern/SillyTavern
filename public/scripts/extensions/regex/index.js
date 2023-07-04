import { callPopup, eventSource, event_types, saveSettingsDebounced } from "../../../script.js";
import { extension_settings } from "../../extensions.js";
import { uuidv4 } from "../../utils.js";
export { REGEX_PLACEMENT }

const REGEX_PLACEMENT = {
    mdDisplay: 0,
    userInput: 1,
    aiOutput: 2,
    system: 3,
    sendas: 4
}

async function saveRegexScript(regexScript, existingScriptIndex) {
    // If the script index is undefined or already exists
    // Don't fire this if editing an existing script
    if (existingScriptIndex === -1) {
        if (!regexScript.scriptName) {
            toastr.error(`Could not save regex: The script name was undefined or empty!`);
            return;
        }
    
        if (extension_settings.regex.find((e) => e.scriptName === regexScript.scriptName)) {
            toastr.error(`Could not save regex: The name ${regexScript.scriptName} already exists.`);
            return;
        }
    }

    if (regexScript.placement.length === 0) {
        toastr.error(`Could not save regex: One placement checkbox must be selected!`);
        return;
    }

    if (existingScriptIndex !== -1) {
        extension_settings.regex[existingScriptIndex] = regexScript;
    } else {
        extension_settings.regex.push(regexScript);
    }

    saveSettingsDebounced();
    await loadRegexScripts();
}

async function deleteRegexScript({ existingId }) {
    let scriptName = $(`#${existingId}`).find('.regex_script_name').text();

    const existingScriptIndex = extension_settings.regex.findIndex((script) => script.scriptName === scriptName);
    if (!existingScriptIndex || existingScriptIndex !== -1) {
        extension_settings.regex.splice(existingScriptIndex, 1);

        saveSettingsDebounced();
        await loadRegexScripts();
    }
}

async function loadRegexScripts() {
    $("#saved_regex_scripts").empty();

    const scriptTemplate = $(await $.get("scripts/extensions/regex/scriptTemplate.html"));

    extension_settings.regex.forEach((script) => {
        // Have to clone here
        const scriptHtml = scriptTemplate.clone();
        scriptHtml.attr('id', uuidv4());
        scriptHtml.find('.regex_script_name').text(script.scriptName);
        scriptHtml.find('.edit_existing_regex').on('click', async function() {
            await onRegexEditorOpenClick(scriptHtml.attr("id"));
        });
        scriptHtml.find('.delete_regex').on('click', async function() {
            await deleteRegexScript({ existingId: scriptHtml.attr("id") });
        });

        $("#saved_regex_scripts").append(scriptHtml);
    });
}

async function onRegexEditorOpenClick(existingId) {
    const editorHtml = $(await $.get("scripts/extensions/regex/editor.html"));

    // If an ID exists, fill in all the values
    let existingScriptIndex = -1;
    if (existingId) {
        const existingScriptName = $(`#${existingId}`).find('.regex_script_name').text();
        existingScriptIndex = extension_settings.regex.findIndex((script) => script.scriptName === existingScriptName);
        if (existingScriptIndex !== -1) {
            const existingScript = extension_settings.regex[existingScriptIndex];
            editorHtml.find(`.regex_script_name`).val(existingScript.scriptName);
            editorHtml.find(`.find_regex`).val(existingScript.findRegex);
            editorHtml.find(`.regex_replace_string`).val(existingScript.replaceString);
            editorHtml
                .find(`input[name="disabled"]`)
                .prop("checked", existingScript.disabled);
            editorHtml
                .find(`input[name="run_on_edit"]`)
                .prop("checked", existingScript.runOnEdit);

            existingScript.placement.forEach((element) => {
                editorHtml
                    .find(`input[name="replace_position"][value="${element}"]`)
                    .prop("checked", true);
            });
        }
    } else {
        editorHtml
            .find(`input[name="run_on_edit"]`)
            .prop("checked", true);

        editorHtml
            .find(`input[name="replace_position"][value="0"]`)
            .prop("checked", true);
    }

    const popupResult = await callPopup(editorHtml, "confirm", undefined, "Save");
    if (popupResult) {
        const newRegexScript = {
            scriptName: editorHtml.find(".regex_script_name").val(),
            findRegex: editorHtml.find(".find_regex").val(),
            replaceString: editorHtml.find(".regex_replace_string").val(),
            placement:
                editorHtml
                    .find(`input[name="replace_position"]`)
                    .filter(":checked")
                    .map(function() { return parseInt($(this).val()) })
                    .get()
                    .filter((e) => e !== NaN) ?? [],
            disabled:
                editorHtml
                    .find(`input[name="disabled"]`)
                    .prop("checked"),
            runOnEdit:
                editorHtml
                    .find(`input[name="run_on_edit"]`)
                    .prop("checked")
        };

        saveRegexScript(newRegexScript, existingScriptIndex);
    }
}

function hookToEvents() {
    eventSource.on(event_types.SETTINGS_LOADED, async function () {
        await loadRegexScripts();
    });
}

jQuery(async () => {
    const settingsHtml = await $.get("scripts/extensions/regex/dropdown.html");
    $("#extensions_settings2").append(settingsHtml);
    $("#open_regex_editor").on("click", function() {
        onRegexEditorOpenClick(false);
    });

    // Listen to event source after 1ms
    setTimeout(() => hookToEvents(), 1)
});
