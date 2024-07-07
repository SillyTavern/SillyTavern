import { callPopup, characters, eventSource, event_types, getCurrentChatId, reloadCurrentChat, saveSettingsDebounced, this_chid } from '../../../script.js';
import { extension_settings, renderExtensionTemplateAsync, writeExtensionField } from '../../extensions.js';
import { selected_group } from '../../group-chats.js';
import { callGenericPopup, POPUP_TYPE } from '../../popup.js';
import { SlashCommand } from '../../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from '../../slash-commands/SlashCommandArgument.js';
import { enumIcons } from '../../slash-commands/SlashCommandCommonEnumsProvider.js';
import { SlashCommandEnumValue, enumTypes } from '../../slash-commands/SlashCommandEnumValue.js';
import { SlashCommandParser } from '../../slash-commands/SlashCommandParser.js';
import { download, getFileText, getSortableDelay, uuidv4 } from '../../utils.js';
import { regex_placement, runRegexScript } from './engine.js';

/**
 * @typedef {object} RegexScript
 * @property {string} scriptName - The name of the script
 * @property {boolean} disabled - Whether the script is disabled
 * @property {string} replaceString - The replace string
 * @property {string[]} trimStrings - The trim strings
 * @property {string?} findRegex - The find regex
 * @property {string?} substituteRegex - The substitute regex
 */

/**
 * Retrieves the list of regex scripts by combining the scripts from the extension settings and the character data
 *
 * @return {RegexScript[]} An array of regex scripts, where each script is an object containing the necessary information.
 */
export function getRegexScripts() {
    return [...(extension_settings.regex ?? []), ...(characters[this_chid]?.data?.extensions?.regex_scripts ?? [])];
}

/**
 * Saves a regex script to the extension settings or character data.
 * @param {import('../../char-data.js').RegexScriptData} regexScript
 * @param {number} existingScriptIndex Index of the existing script
 * @param {boolean} isScoped Is the script scoped to a character?
 * @returns {Promise<void>}
 */
async function saveRegexScript(regexScript, existingScriptIndex, isScoped) {
    // If not editing
    const array = (isScoped ? characters[this_chid]?.data?.extensions?.regex_scripts : extension_settings.regex) ?? [];

    // Assign a UUID if it doesn't exist
    if (!regexScript.id) {
        regexScript.id = uuidv4();
    }

    // Is the script name undefined or empty?
    if (!regexScript.scriptName) {
        toastr.error('Could not save regex script: The script name was undefined or empty!');
        return;
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
        array[existingScriptIndex] = regexScript;
    } else {
        array.push(regexScript);
    }

    if (isScoped) {
        await writeExtensionField(this_chid, 'regex_scripts', array);

        // Add the character to the allowed list
        if (!extension_settings.character_allowed_regex.includes(characters[this_chid].avatar)) {
            extension_settings.character_allowed_regex.push(characters[this_chid].avatar);
        }
    }

    saveSettingsDebounced();
    await loadRegexScripts();

    // Reload the current chat to undo previous markdown
    const currentChatId = getCurrentChatId();
    if (currentChatId !== undefined && currentChatId !== null) {
        await reloadCurrentChat();
    }
}

async function deleteRegexScript({ id, isScoped }) {
    const array = (isScoped ? characters[this_chid]?.data?.extensions?.regex_scripts : extension_settings.regex) ?? [];

    const existingScriptIndex = array.findIndex((script) => script.id === id);
    if (!existingScriptIndex || existingScriptIndex !== -1) {
        array.splice(existingScriptIndex, 1);

        if (isScoped) {
            await writeExtensionField(this_chid, 'regex_scripts', array);
        }

        saveSettingsDebounced();
        await loadRegexScripts();
    }
}

async function loadRegexScripts() {
    $('#saved_regex_scripts').empty();
    $('#saved_scoped_scripts').empty();

    const scriptTemplate = $(await renderExtensionTemplateAsync('regex', 'scriptTemplate'));

    /**
     * Renders a script to the UI.
     * @param {string} container Container to render the script to
     * @param {import('../../char-data.js').RegexScriptData} script Script data
     * @param {boolean} isScoped Script is scoped to a character
     * @param {number} index Index of the script in the array
     */
    function renderScript(container, script, isScoped, index) {
        // Have to clone here
        const scriptHtml = scriptTemplate.clone();
        const save = () => saveRegexScript(script, index, isScoped);

        if (!script.id) {
            script.id = uuidv4();
        }

        scriptHtml.attr('id', script.id);
        scriptHtml.find('.regex_script_name').text(script.scriptName);
        scriptHtml.find('.disable_regex').prop('checked', script.disabled ?? false)
            .on('input', async function () {
                script.disabled = !!$(this).prop('checked');
                await save();
            });
        scriptHtml.find('.regex-toggle-on').on('click', function () {
            scriptHtml.find('.disable_regex').prop('checked', true).trigger('input');
        });
        scriptHtml.find('.regex-toggle-off').on('click', function () {
            scriptHtml.find('.disable_regex').prop('checked', false).trigger('input');
        });
        scriptHtml.find('.edit_existing_regex').on('click', async function () {
            await onRegexEditorOpenClick(scriptHtml.attr('id'), isScoped);
        });
        scriptHtml.find('.move_to_global').on('click', async function () {
            const confirm = await callGenericPopup('Are you sure you want to move this regex script to global?', POPUP_TYPE.CONFIRM);

            if (!confirm) {
                return;
            }

            await deleteRegexScript({ id: script.id, isScoped: true });
            await saveRegexScript(script, -1, false);
        });
        scriptHtml.find('.move_to_scoped').on('click', async function () {
            if (this_chid === undefined) {
                toastr.error('No character selected.');
                return;
            }

            if (selected_group) {
                toastr.error('Cannot edit scoped scripts in group chats.');
                return;
            }

            const confirm = await callGenericPopup('Are you sure you want to move this regex script to scoped?', POPUP_TYPE.CONFIRM);

            if (!confirm) {
                return;
            }

            await deleteRegexScript({ id: script.id, isScoped: false });
            await saveRegexScript(script, -1, true);
        });
        scriptHtml.find('.export_regex').on('click', async function () {
            const fileName = `${script.scriptName.replace(/[\s.<>:"/\\|?*\x00-\x1F\x7F]/g, '_').toLowerCase()}.json`;
            const fileData = JSON.stringify(script, null, 4);
            download(fileData, fileName, 'application/json');
        });
        scriptHtml.find('.delete_regex').on('click', async function () {
            const confirm = await callGenericPopup('Are you sure you want to delete this regex script?', POPUP_TYPE.CONFIRM);

            if (!confirm) {
                return;
            }

            await deleteRegexScript({ id: script.id, isScoped });
            await reloadCurrentChat();
        });

        $(container).append(scriptHtml);
    }

    extension_settings?.regex?.forEach((script, index, array) => renderScript('#saved_regex_scripts', script, false, index, array));
    characters[this_chid]?.data?.extensions?.regex_scripts?.forEach((script, index, array) => renderScript('#saved_scoped_scripts', script, true, index, array));

    const isAllowed = extension_settings?.character_allowed_regex?.includes(characters?.[this_chid]?.avatar);
    $('#regex_scoped_toggle').prop('checked', isAllowed);
}

/**
 * Opens the regex editor.
 * @param {string|boolean} existingId Existing ID
 * @param {boolean} isScoped Is the script scoped to a character?
 * @returns {Promise<void>}
 */
async function onRegexEditorOpenClick(existingId, isScoped) {
    const editorHtml = $(await renderExtensionTemplateAsync('regex', 'editor'));
    const array = (isScoped ? characters[this_chid]?.data?.extensions?.regex_scripts : extension_settings.regex) ?? [];

    // If an ID exists, fill in all the values
    let existingScriptIndex = -1;
    if (existingId) {
        existingScriptIndex = array.findIndex((script) => script.id === existingId);
        if (existingScriptIndex !== -1) {
            const existingScript = array[existingScriptIndex];
            if (existingScript.scriptName) {
                editorHtml.find('.regex_script_name').val(existingScript.scriptName);
            } else {
                toastr.error('This script doesn\'t have a name! Please delete it.');
                return;
            }

            editorHtml.find('.find_regex').val(existingScript.findRegex || '');
            editorHtml.find('.regex_replace_string').val(existingScript.replaceString || '');
            editorHtml.find('.regex_trim_strings').val(existingScript.trimStrings?.join('\n') || []);
            editorHtml.find('input[name="disabled"]').prop('checked', existingScript.disabled ?? false);
            editorHtml.find('input[name="only_format_display"]').prop('checked', existingScript.markdownOnly ?? false);
            editorHtml.find('input[name="only_format_prompt"]').prop('checked', existingScript.promptOnly ?? false);
            editorHtml.find('input[name="run_on_edit"]').prop('checked', existingScript.runOnEdit ?? false);
            editorHtml.find('input[name="substitute_regex"]').prop('checked', existingScript.substituteRegex ?? false);
            editorHtml.find('input[name="min_depth"]').val(existingScript.minDepth ?? '');
            editorHtml.find('input[name="max_depth"]').val(existingScript.maxDepth ?? '');

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
            id: uuidv4(),
            scriptName: editorHtml.find('.regex_script_name').val(),
            findRegex: editorHtml.find('.find_regex').val(),
            replaceString: editorHtml.find('.regex_replace_string').val(),
            trimStrings: String(editorHtml.find('.regex_trim_strings').val()).split('\n').filter((e) => e.length !== 0) || [],
            substituteRegex: editorHtml.find('input[name="substitute_regex"]').prop('checked'),
        };
        const rawTestString = String(editorHtml.find('#regex_test_input').val());
        const result = runRegexScript(testScript, rawTestString);
        editorHtml.find('#regex_test_output').text(result);
    }

    editorHtml.find('input, textarea, select').on('input', updateTestResult);

    const popupResult = await callPopup(editorHtml, 'confirm', undefined, { okButton: 'Save' });
    if (popupResult) {
        const newRegexScript = {
            id: existingId ? String(existingId) : uuidv4(),
            scriptName: String(editorHtml.find('.regex_script_name').val()),
            findRegex: String(editorHtml.find('.find_regex').val()),
            replaceString: String(editorHtml.find('.regex_replace_string').val()),
            trimStrings: editorHtml.find('.regex_trim_strings').val().split('\n').filter((e) => e.length !== 0) || [],
            placement:
                editorHtml
                    .find('input[name="replace_position"]')
                    .filter(':checked')
                    .map(function () { return parseInt($(this).val()); })
                    .get()
                    .filter((e) => !isNaN(e)) || [],
            disabled: editorHtml.find('input[name="disabled"]').prop('checked'),
            markdownOnly: editorHtml.find('input[name="only_format_display"]').prop('checked'),
            promptOnly: editorHtml.find('input[name="only_format_prompt"]').prop('checked'),
            runOnEdit: editorHtml.find('input[name="run_on_edit"]').prop('checked'),
            substituteRegex: editorHtml.find('input[name="substitute_regex"]').prop('checked'),
            minDepth: parseInt(String(editorHtml.find('input[name="min_depth"]').val())),
            maxDepth: parseInt(String(editorHtml.find('input[name="max_depth"]').val())),
        };

        saveRegexScript(newRegexScript, existingScriptIndex, isScoped);
    }
}

// Common settings migration function. Some parts will eventually be removed
// TODO: Maybe migrate placement to strings?
function migrateSettings() {
    let performSave = false;

    // Current: If MD Display is present in placement, remove it and add new placements/MD option
    extension_settings.regex.forEach((script) => {
        if (!script.id) {
            script.id = uuidv4();
            performSave = true;
        }

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

    if (!extension_settings.character_allowed_regex) {
        extension_settings.character_allowed_regex = [];
        performSave = true;
    }

    if (performSave) {
        saveSettingsDebounced();
    }
}

/**
 * /regex slash command callback
 * @param {{name: string}} args Named arguments
 * @param {string} value Unnamed argument
 * @returns {string} The regexed string
 */
function runRegexCallback(args, value) {
    if (!args.name) {
        toastr.warning('No regex script name provided.');
        return value;
    }

    const scriptName = args.name;
    const scripts = getRegexScripts();

    for (const script of scripts) {
        if (script.scriptName.toLowerCase() === scriptName.toLowerCase()) {
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

/**
 * Performs the import of the regex file.
 * @param {File} file Input file
 * @param {boolean} isScoped Is the script scoped to a character?
 */
async function onRegexImportFileChange(file, isScoped) {
    if (!file) {
        toastr.error('No file provided.');
        return;
    }

    try {
        const fileText = await getFileText(file);
        const regexScript = JSON.parse(fileText);
        if (!regexScript.scriptName) {
            throw new Error('No script name provided.');
        }

        // Assign a new UUID
        regexScript.id = uuidv4();

        const array = (isScoped ? characters[this_chid]?.data?.extensions?.regex_scripts : extension_settings.regex) ?? [];
        array.push(regexScript);

        if (isScoped) {
            await writeExtensionField(this_chid, 'regex_scripts', array);
        }

        saveSettingsDebounced();
        await loadRegexScripts();
        toastr.success(`Regex script "${regexScript.scriptName}" imported.`);
    } catch (error) {
        console.log(error);
        toastr.error('Invalid JSON file.');
        return;
    }
}

function purgeEmbeddedRegexScripts( { character }){
    const avatar = character?.avatar;

    if (avatar && extension_settings.character_allowed_regex?.includes(avatar)) {
        const index = extension_settings.character_allowed_regex.indexOf(avatar);
        if (index !== -1) {
            extension_settings.character_allowed_regex.splice(index, 1);
            saveSettingsDebounced();
        }
    }
}

async function checkEmbeddedRegexScripts() {
    const chid = this_chid;

    if (chid !== undefined && !selected_group) {
        const avatar = characters[chid]?.avatar;
        const scripts = characters[chid]?.data?.extensions?.regex_scripts;

        if (Array.isArray(scripts) && scripts.length > 0) {
            if (avatar && !extension_settings.character_allowed_regex.includes(avatar)) {
                const checkKey = `AlertRegex_${characters[chid].avatar}`;

                if (!localStorage.getItem(checkKey)) {
                    localStorage.setItem(checkKey, 'true');
                    const template = await renderExtensionTemplateAsync('regex', 'embeddedScripts', {});
                    const result = await callGenericPopup(template, POPUP_TYPE.CONFIRM, '', { okButton: 'Yes' });

                    if (result) {
                        extension_settings.character_allowed_regex.push(avatar);
                        await reloadCurrentChat();
                        saveSettingsDebounced();
                    }
                }
            }
        }
    }

    loadRegexScripts();
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

    const settingsHtml = $(await renderExtensionTemplateAsync('regex', 'dropdown'));
    $('#regex_container').append(settingsHtml);
    $('#open_regex_editor').on('click', function () {
        onRegexEditorOpenClick(false, false);
    });
    $('#open_scoped_editor').on('click', function () {
        if (this_chid === undefined) {
            toastr.error('No character selected.');
            return;
        }

        if (selected_group) {
            toastr.error('Cannot edit scoped scripts in group chats.');
            return;
        }

        onRegexEditorOpenClick(false, true);
    });
    $('#import_regex_file').on('change', async function () {
        let target = 'global';
        const template = $(await renderExtensionTemplateAsync('regex', 'importTarget'));
        template.find('#regex_import_target_global').on('input', () => target = 'global');
        template.find('#regex_import_target_scoped').on('input', () => target = 'scoped');

        await callGenericPopup(template, POPUP_TYPE.TEXT);

        const inputElement = this instanceof HTMLInputElement && this;
        for (const file of inputElement.files) {
            await onRegexImportFileChange(file, target === 'scoped');
        }
        inputElement.value = '';
    });
    $('#import_regex').on('click', function () {
        $('#import_regex_file').trigger('click');
    });

    let sortableDatas = [
        {
            selector: '#saved_regex_scripts',
            setter: x => extension_settings.regex = x,
            getter: () => extension_settings.regex ?? [],
        },
        {
            selector: '#saved_scoped_scripts',
            setter: x => writeExtensionField(this_chid, 'regex_scripts', x),
            getter: () => characters[this_chid]?.data?.extensions?.regex_scripts ?? [],
        },
    ];
    for (const { selector, setter, getter } of sortableDatas) {
        $(selector).sortable({
            delay: getSortableDelay(),
            stop: async function () {
                const oldScripts = getter();
                const newScripts = [];
                $(selector).children().each(function () {
                    const id = $(this).attr('id');
                    const existingScript = oldScripts.find((e) => e.id === id);
                    if (existingScript) {
                        newScripts.push(existingScript);
                    }
                });

                await setter(newScripts);
                saveSettingsDebounced();

                console.debug(`Regex scripts in ${selector} reordered`);
                await loadRegexScripts();
            },
        });
    }

    $('#regex_scoped_toggle').on('input', function () {
        if (this_chid === undefined) {
            toastr.error('No character selected.');
            return;
        }

        if (selected_group) {
            toastr.error('Cannot edit scoped scripts in group chats.');
            return;
        }

        const isEnable = !!$(this).prop('checked');
        const avatar = characters[this_chid].avatar;

        if (isEnable) {
            if (!extension_settings.character_allowed_regex.includes(avatar)) {
                extension_settings.character_allowed_regex.push(avatar);
            }
        } else {
            const index = extension_settings.character_allowed_regex.indexOf(avatar);
            if (index !== -1) {
                extension_settings.character_allowed_regex.splice(index, 1);
            }
        }

        saveSettingsDebounced();
        reloadCurrentChat();
    });

    await loadRegexScripts();
    $('#saved_regex_scripts').sortable('enable');

    const localEnumProviders = {
        regexScripts: () => getRegexScripts().map(script => {
            const isGlobal = extension_settings.regex?.some(x => x.scriptName === script.scriptName);
            return new SlashCommandEnumValue(script.scriptName, `${enumIcons.getStateIcon(!script.disabled)} [${isGlobal ? 'global' : 'scoped'}] ${script.findRegex}`,
                isGlobal ? enumTypes.enum : enumTypes.name, isGlobal ? 'G' : 'S');
        }),
    };

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'regex',
        callback: runRegexCallback,
        returns: 'replaced text',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'name',
                description: 'script name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: localEnumProviders.regexScripts,
            }),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'input', [ARGUMENT_TYPE.STRING], false,
            ),
        ],
        helpString: 'Runs a Regex extension script by name on the provided string. The script must be enabled.',
    }));

    eventSource.on(event_types.CHAT_CHANGED, checkEmbeddedRegexScripts);
    eventSource.on(event_types.CHARACTER_DELETED, purgeEmbeddedRegexScripts);
});
