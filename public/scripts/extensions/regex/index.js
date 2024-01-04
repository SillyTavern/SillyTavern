import { callPopup, getCurrentChatId, reloadCurrentChat, saveSettingsDebounced } from '../../../script.js';
import { extension_settings } from '../../extensions.js';
import { registerSlashCommand } from '../../slash-commands.js';
import { getSortableDelay, uuidv4 } from '../../utils.js';
import { resolveVariable } from '../../variables.js';
import { regex_placement, runRegexScript } from './engine.js';

async function saveRegexScript(regexScript, existingScriptIndex) {
    // If not editing

    // Is the script name undefined or empty?
    if (!regexScript.scriptName) {
        toastr.error('Could not save regex script: The script name was undefined or empty!');
        return;
    }

    if (existingScriptIndex === -1) {
        // Does the script name already exist?
        if (extension_settings.regex.find((e) => e.scriptName === regexScript.scriptName)) {
            toastr.error(`Could not save regex script: A script with name ${regexScript.scriptName} already exists.`);
            return;
        }
    } else {
        // Does the script name already exist somewhere else?
        // (If this fails, make it a .filter().map() to index array)
        const foundIndex = extension_settings.regex.findIndex((e) => e.scriptName === regexScript.scriptName);
        if (foundIndex !== existingScriptIndex && foundIndex !== -1) {
            toastr.error(`Could not save regex script: A script with name ${regexScript.scriptName} already exists.`);
            return;
        }
    }

    // Is a find regex present?
    if (regexScript.findRegex.length === 0) {
        toastr.warning('This regex script will not work, but was saved anyway: A find regex isn\'t present.');
    }

    // Is there someplace to place results?
    if (regexScript.placement.length === 0) {
        toastr.warning('This regex script will not work, but was saved anyway: One "Affects" checkbox must be selected!');
    }

    if (existingScriptIndex !== -1) {
        extension_settings.regex[existingScriptIndex] = regexScript;
    } else {
        extension_settings.regex.push(regexScript);
    }

    saveSettingsDebounced();
    await loadRegexScripts();

    // Reload the current chat to undo previous markdown
    const currentChatId = getCurrentChatId();
    if (currentChatId !== undefined && currentChatId !== null) {
        await reloadCurrentChat();
    }
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
    $('#saved_regex_scripts').empty();

    const scriptTemplate = $(await $.get('scripts/extensions/regex/scriptTemplate.html'));

    extension_settings.regex.forEach((script) => {
        // Have to clone here
        const scriptHtml = scriptTemplate.clone();
        scriptHtml.attr('id', uuidv4());
        scriptHtml.find('.regex_script_name').text(script.scriptName);
        scriptHtml.find('.disable_regex').prop('checked', script.disabled ?? false)
            .on('input', function () {
                script.disabled = !!$(this).prop('checked');
                saveSettingsDebounced();
            });
        scriptHtml.find('.regex-toggle-on').on('click', function () {
            scriptHtml.find('.disable_regex').prop('checked', true).trigger('input');
        });
        scriptHtml.find('.regex-toggle-off').on('click', function () {
            scriptHtml.find('.disable_regex').prop('checked', false).trigger('input');
        });
        scriptHtml.find('.edit_existing_regex').on('click', async function () {
            await onRegexEditorOpenClick(scriptHtml.attr('id'));
        });
        scriptHtml.find('.delete_regex').on('click', async function () {
            const confirm = await callPopup('Are you sure you want to delete this regex script?', 'confirm');

            if (!confirm) {
                return;
            }

            await deleteRegexScript({ existingId: scriptHtml.attr('id') });
        });

        $('#saved_regex_scripts').append(scriptHtml);
    });
}

async function onRegexEditorOpenClick(existingId) {
    const editorHtml = $(await $.get('scripts/extensions/regex/editor.html'));

    // If an ID exists, fill in all the values
    let existingScriptIndex = -1;
    if (existingId) {
        const existingScriptName = $(`#${existingId}`).find('.regex_script_name').text();
        existingScriptIndex = extension_settings.regex.findIndex((script) => script.scriptName === existingScriptName);
        if (existingScriptIndex !== -1) {
            const existingScript = extension_settings.regex[existingScriptIndex];
            if (existingScript.scriptName) {
                editorHtml.find('.regex_script_name').val(existingScript.scriptName);
            } else {
                toastr.error('This script doesn\'t have a name! Please delete it.');
                return;
            }

            editorHtml.find('.find_regex').val(existingScript.findRegex || '');
            editorHtml.find('.regex_replace_string').val(existingScript.replaceString || '');
            editorHtml.find('.regex_trim_strings').val(existingScript.trimStrings?.join('\n') || []);
            editorHtml
                .find('input[name="disabled"]')
                .prop('checked', existingScript.disabled ?? false);
            editorHtml
                .find('input[name="only_format_display"]')
                .prop('checked', existingScript.markdownOnly ?? false);
            editorHtml
                .find('input[name="only_format_prompt"]')
                .prop('checked', existingScript.promptOnly ?? false);
            editorHtml
                .find('input[name="run_on_edit"]')
                .prop('checked', existingScript.runOnEdit ?? false);
            editorHtml
                .find('input[name="substitute_regex"]')
                .prop('checked', existingScript.substituteRegex ?? false);
            editorHtml
                .find('select[name="replace_strategy_select"]')
                .val(existingScript.replaceStrategy ?? 0);

            existingScript.placement.forEach((element) => {
                editorHtml
                    .find(`input[name="replace_position"][value="${element}"]`)
                    .prop('checked', true);
            });
        }
    } else {
        editorHtml
            .find('input[name="only_format_display"]')
            .prop('checked', true);

        editorHtml
            .find('input[name="run_on_edit"]')
            .prop('checked', true);

        editorHtml
            .find('input[name="replace_position"][value="1"]')
            .prop('checked', true);
    }

    editorHtml.find('#regex_test_mode_toggle').on('click', function () {
        editorHtml.find('#regex_test_mode').toggleClass('displayNone');
        updateTestResult();
    });

    function updateTestResult() {
        if (!editorHtml.find('#regex_test_mode').is(':visible')) {
            return;
        }

        const testScript = {
            scriptName: editorHtml.find('.regex_script_name').val(),
            findRegex: editorHtml.find('.find_regex').val(),
            replaceString: editorHtml.find('.regex_replace_string').val(),
            trimStrings: String(editorHtml.find('.regex_trim_strings').val()).split('\n').filter((e) => e.length !== 0) || [],
            substituteRegex: editorHtml.find('input[name="substitute_regex"]').prop('checked'),
            replaceStrategy: Number(editorHtml.find('select[name="replace_strategy_select"]').find(':selected').val()) ?? 0,
        };
        const rawTestString = String(editorHtml.find('#regex_test_input').val());
        const result = runRegexScript(testScript, rawTestString);
        editorHtml.find('#regex_test_output').text(result);
    }

    editorHtml.find('input, textarea, select').on('input', updateTestResult);

    const popupResult = await callPopup(editorHtml, 'confirm', undefined, { okButton: 'Save' });
    if (popupResult) {
        const newRegexScript = {
            scriptName: editorHtml.find('.regex_script_name').val(),
            findRegex: editorHtml.find('.find_regex').val(),
            replaceString: editorHtml.find('.regex_replace_string').val(),
            trimStrings: editorHtml.find('.regex_trim_strings').val().split('\n').filter((e) => e.length !== 0) || [],
            placement:
                editorHtml
                    .find('input[name="replace_position"]')
                    .filter(':checked')
                    .map(function () { return parseInt($(this).val()); })
                    .get()
                    .filter((e) => !isNaN(e)) || [],
            disabled:
                editorHtml
                    .find('input[name="disabled"]')
                    .prop('checked'),
            markdownOnly:
                editorHtml
                    .find('input[name="only_format_display"]')
                    .prop('checked'),
            promptOnly:
                editorHtml
                    .find('input[name="only_format_prompt"]')
                    .prop('checked'),
            runOnEdit:
                editorHtml
                    .find('input[name="run_on_edit"]')
                    .prop('checked'),
            substituteRegex:
                editorHtml
                    .find('input[name="substitute_regex"]')
                    .prop('checked'),
            replaceStrategy:
                parseInt(editorHtml
                    .find('select[name="replace_strategy_select"]')
                    .find(':selected')
                    .val()) ?? 0,
        };

        saveRegexScript(newRegexScript, existingScriptIndex);
    }
}

// Common settings migration function. Some parts will eventually be removed
// TODO: Maybe migrate placement to strings?
function migrateSettings() {
    let performSave = false;

    // Current: If MD Display is present in placement, remove it and add new placements/MD option
    extension_settings.regex.forEach((script) => {
        if (script.placement.includes(regex_placement.MD_DISPLAY)) {
            script.placement = script.placement.length === 1 ?
                Object.values(regex_placement).filter((e) => e !== regex_placement.MD_DISPLAY) :
                script.placement = script.placement.filter((e) => e !== regex_placement.MD_DISPLAY);

            script.markdownOnly = true;
            script.promptOnly = true;

            performSave = true;
        }

        // Old system and sendas placement migration
        // 4 - sendAs
        if (script.placement.includes(4)) {
            script.placement = script.placement.length === 1 ?
                [regex_placement.SLASH_COMMAND] :
                script.placement = script.placement.filter((e) => e !== 4);

            performSave = true;
        }
    });

    if (performSave) {
        saveSettingsDebounced();
    }
}

/**
 * /regex slash command callback
 * @param {object} args Named arguments
 * @param {string} value Unnamed argument
 * @returns {string} The regexed string
 */
function runRegexCallback(args, value) {
    if (!args.name) {
        toastr.warning('No regex script name provided.');
        return value;
    }

    const scriptName = String(resolveVariable(args.name));

    for (const script of extension_settings.regex) {
        if (String(script.scriptName).toLowerCase() === String(scriptName).toLowerCase()) {
            if (script.disabled) {
                toastr.warning(`Regex script "${scriptName}" is disabled.`);
                return value;
            }

            console.debug(`Running regex callback for ${scriptName}`);
            return runRegexScript(script, value);
        }
    }

    toastr.warning(`Regex script "${scriptName}" not found.`);
    return value;
}

// Workaround for loading in sequence with other extensions
// NOTE: Always puts extension at the top of the list, but this is fine since it's static
jQuery(async () => {
    if (extension_settings.regex) {
        migrateSettings();
    }

    // Manually disable the extension since static imports auto-import the JS file
    if (extension_settings.disabledExtensions.includes('regex')) {
        return;
    }

    const settingsHtml = await $.get('scripts/extensions/regex/dropdown.html');
    $('#extensions_settings2').append(settingsHtml);
    $('#open_regex_editor').on('click', function () {
        onRegexEditorOpenClick(false);
    });

    $('#saved_regex_scripts').sortable({
        delay: getSortableDelay(),
        stop: function () {
            let newScripts = [];
            $('#saved_regex_scripts').children().each(function () {
                const scriptName = $(this).find('.regex_script_name').text();
                const existingScript = extension_settings.regex.find((e) => e.scriptName === scriptName);
                if (existingScript) {
                    newScripts.push(existingScript);
                }
            });

            extension_settings.regex = newScripts;
            saveSettingsDebounced();

            console.debug('Regex scripts reordered');
            // TODO: Maybe reload regex scripts after move
        },
    });

    await loadRegexScripts();
    $('#saved_regex_scripts').sortable('enable');

    registerSlashCommand('regex', runRegexCallback, [], '(name=scriptName [input]) – runs a Regex extension script by name on the provided string. The script must be enabled.', true, true);
});
