import { characters, eventSource, event_types, getCurrentChatId, reloadCurrentChat, saveSettingsDebounced, this_chid } from '../../../script.js';
import { extension_settings, renderExtensionTemplateAsync, writeExtensionField } from '../../extensions.js';
import { selected_group } from '../../group-chats.js';
import { callGenericPopup, POPUP_TYPE } from '../../popup.js';
import { SlashCommand } from '../../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from '../../slash-commands/SlashCommandArgument.js';
import { commonEnumProviders, enumIcons } from '../../slash-commands/SlashCommandCommonEnumsProvider.js';
import { SlashCommandEnumValue, enumTypes } from '../../slash-commands/SlashCommandEnumValue.js';
import { SlashCommandParser } from '../../slash-commands/SlashCommandParser.js';
import { download, equalsIgnoreCaseAndAccents, getFileText, getSortableDelay, isFalseBoolean, isTrueBoolean, regexFromString, setInfoBlock, uuidv4 } from '../../utils.js';
import { regex_placement, runRegexScript, substitute_find_regex } from './engine.js';
import { t } from '../../i18n.js';
import { accountStorage } from '../../util/AccountStorage.js';

const sanitizeFileName = name => name.replace(/[\s.<>:"/\\|?*\x00-\x1F\x7F]/g, '_').toLowerCase();

/**
 * @typedef {import('../../char-data.js').RegexScriptData} RegexScript
 */

/**
 * @typedef {object} RegexFolder
 * @property {string} id
 * @property {string} name
 * @property {string} description
 * @property {string[]} scriptIds
 * @property {boolean} isScoped
 * @property {boolean} isCollapsed
 */

function initializeData() {
    if (!extension_settings.regex) extension_settings.regex = [];
    if (!extension_settings.regex_folders) extension_settings.regex_folders = [];
    if (this_chid && !characters[this_chid]?.data?.extensions?.regex_scripts) {
        if (characters[this_chid]?.data) {
            if (!characters[this_chid].data.extensions) characters[this_chid].data.extensions = {};
            characters[this_chid].data.extensions.regex_scripts = [];
        }
    }
}


/**
 * Retrieves the list of regex scripts by combining the scripts from the extension settings and the character data
 *
 * @return {RegexScript[]} An array of regex scripts, where each script is an object containing the necessary information.
 */
export function getRegexScripts() {
    const globalScripts = extension_settings.regex ?? [];
    const scopedScripts = this_chid ? (characters[this_chid]?.data?.extensions?.regex_scripts ?? []) : [];
    return [...globalScripts, ...scopedScripts];
}

/**
 * Toggle the icon for the "select all" checkbox in the regex settings.
 * - Use `fa-check-double` when the checkbox is unchecked (indicating all scripts are not selected).
 * - Use `fa-minus` when the checkbox is checked (indicating all scripts are selected).
 * @param {boolean} allAreChecked Should the "select all" icon be in the checked state?
 */
function setToggleAllIcon(allAreChecked) {
    const selectAllIcon = $('#bulk_select_all_toggle').find('i');
    selectAllIcon.toggleClass('fa-check-double', !allAreChecked);
    selectAllIcon.toggleClass('fa-minus', allAreChecked);
}

/**
 * Saves a regex script to the extension settings or character data.
 * @param {import('../../char-data.js').RegexScriptData} regexScript
 * @param {number} existingScriptIndex Index of the existing script
 * @param {boolean} isScoped Is the script scoped to a character?
 * @returns {Promise<void>}
 */
async function saveRegexScript(regexScript, existingScriptIndex, isScoped) {
    const array = (isScoped && this_chid ? characters[this_chid]?.data?.extensions?.regex_scripts : extension_settings.regex) ?? [];

    if (!regexScript.id) {
        regexScript.id = uuidv4();
    }
    if (!regexScript.scriptName) {
        toastr.error(t`Could not save regex script: The script name was undefined or empty!`);
        return;
    }
    if (regexScript.findRegex.length === 0) {
        toastr.warning(t`This regex script will not work, but was saved anyway: A find regex isn't present.`);
    }
    if (regexScript.placement.length === 0) {
        toastr.warning(t`This regex script will not work, but was saved anyway: One "Affects" checkbox must be selected!`);
    }

    if (existingScriptIndex !== -1) {
        array[existingScriptIndex] = regexScript;
    } else {
        array.push(regexScript);
    }

    if (isScoped) {
        await writeExtensionField(this_chid, 'regex_scripts', array);
        if (!extension_settings.character_allowed_regex.includes(characters[this_chid].avatar)) {
            extension_settings.character_allowed_regex.push(characters[this_chid].avatar);
        }
    }

    saveSettingsDebounced();
    await loadRegexScripts();

    const currentChatId = getCurrentChatId();
    if (currentChatId !== undefined && currentChatId !== null) {
        await reloadCurrentChat();
    }
}

/**
 * Clones a regex script.
 * @param {{id: string, isScoped: boolean}} scriptInfo
 */
async function cloneRegexScript({ id, isScoped }) {
    const scriptList = isScoped ? characters[this_chid]?.data?.extensions?.regex_scripts : extension_settings.regex;
    const originalScript = scriptList?.find(script => script.id === id);

    if (!originalScript) {
        toastr.error(t`Could not find the original script to clone.`);
        return;
    }

    // Create a deep copy and give it a new ID and name
    const clonedScript = JSON.parse(JSON.stringify(originalScript));
    clonedScript.id = uuidv4();
    clonedScript.scriptName = `${originalScript.scriptName} (Copy)`;

    // Add the cloned script to the appropriate list
    if (isScoped) {
        characters[this_chid].data.extensions.regex_scripts.push(clonedScript);
        await writeExtensionField(this_chid, 'regex_scripts', characters[this_chid].data.extensions.regex_scripts);
    } else {
        extension_settings.regex.push(clonedScript);
    }

    saveSettingsDebounced();
    await loadRegexScripts();
    toastr.success(t`Script "${originalScript.scriptName}" cloned successfully.`);
}

async function deleteRegexScript({ id, isScoped }) {
    const scriptList = (isScoped && this_chid ? characters[this_chid]?.data?.extensions?.regex_scripts : extension_settings.regex) ?? [];
    const existingScriptIndex = scriptList.findIndex((script) => script.id === id);

    if (existingScriptIndex !== -1) {
        scriptList.splice(existingScriptIndex, 1);
        if (isScoped) {
            await writeExtensionField(this_chid, 'regex_scripts', scriptList);
        }
    }

    // Also remove from any folders
    const folders = extension_settings.regex_folders ?? [];
    folders.forEach(folder => {
        const scriptInFolderIndex = folder.scriptIds.indexOf(id);
        if (scriptInFolderIndex > -1) {
            folder.scriptIds.splice(scriptInFolderIndex, 1);
        }
    });


    saveSettingsDebounced();
    await loadRegexScripts();
}

async function loadRegexScripts() {
    $('#saved_regex_scripts').empty();
    $('#saved_scoped_scripts').empty();
    $('#regex_folders_container').empty();
    setToggleAllIcon(false);

    const scriptTemplate = $(await renderExtensionTemplateAsync('regex', 'scriptTemplate'));
    const folderTemplate = $(await renderExtensionTemplateAsync('regex', 'folderTemplate'));
    const allScripts = getRegexScripts();
    const globalScripts = extension_settings.regex ?? [];
    const scopedScripts = this_chid ? (characters[this_chid]?.data?.extensions?.regex_scripts ?? []) : [];

    function renderScript(container, script) {
        const isScoped = scopedScripts.some(s => s.id === script.id);
        const scriptHtml = scriptTemplate.clone();

        const save = () => {
            const array = isScoped ? scopedScripts : globalScripts;
            const index = array.findIndex(s => s.id === script.id);
            saveRegexScript(script, index, isScoped);
        };

        if (!script.id) script.id = uuidv4();

        scriptHtml.attr('id', script.id);
        scriptHtml.data('scriptId', script.id);
        scriptHtml.find('.regex_script_name').text(script.scriptName);
        scriptHtml.find('.disable_regex').prop('checked', script.disabled ?? false)
            .on('input', async function () {
                script.disabled = !!$(this).prop('checked');
                await save();
            });
        scriptHtml.find('.regex-toggle-on').on('click', () => scriptHtml.find('.disable_regex').prop('checked', true).trigger('input'));
        scriptHtml.find('.regex-toggle-off').on('click', () => scriptHtml.find('.disable_regex').prop('checked', false).trigger('input'));
        scriptHtml.find('.edit_existing_regex').on('click', () => onRegexEditorOpenClick(script.id, isScoped));

        scriptHtml.find('.move_to_global').toggle(isScoped).on('click', async function () {
            const confirm = await callGenericPopup(t`Are you sure you want to move this regex script to global?`, POPUP_TYPE.CONFIRM);
            if (!confirm) return;
            await deleteRegexScript({ id: script.id, isScoped: true });
            await saveRegexScript(script, -1, false);
        });

        scriptHtml.find('.move_to_scoped').toggle(!isScoped).on('click', async function () {
            if (this_chid === undefined) return toastr.error(t`No character selected.`);
            if (selected_group) return toastr.error(t`Cannot edit scoped scripts in group chats.`);
            const confirm = await callGenericPopup(t`Are you sure you want to move this regex script to scoped?`, POPUP_TYPE.CONFIRM);
            if (!confirm) return;
            await deleteRegexScript({ id: script.id, isScoped: false });
            await saveRegexScript(script, -1, true);
        });

        scriptHtml.find('.export_regex').on('click', () => {
            const fileName = `regex-${sanitizeFileName(script.scriptName)}.json`;
            download(JSON.stringify(script, null, 4), fileName, 'application/json');
        });
        scriptHtml.find('.clone_regex').on('click', () => cloneRegexScript({ id: script.id, isScoped }));
        scriptHtml.find('.delete_regex').on('click', async () => {
            const confirm = await callGenericPopup(t`Are you sure you want to delete this regex script?`, POPUP_TYPE.CONFIRM);
            if (!confirm) return;
            await deleteRegexScript({ id: script.id, isScoped });
            await reloadCurrentChat();
        });
        scriptHtml.find('.regex_bulk_checkbox').on('change', () => {
            const checkboxes = $('#regex_container .regex_bulk_checkbox');
            const allAreChecked = checkboxes.length > 0 && checkboxes.length === checkboxes.filter(':checked').length;
            setToggleAllIcon(allAreChecked);
        });

        $(container).append(scriptHtml);
    }

    function renderFolder(container, folder) {
        const folderHtml = folderTemplate.clone();
        const scriptsInFolder = getRegexScripts().filter(s => folder.scriptIds.includes(s.id));
        const allDisabled = scriptsInFolder.length > 0 && scriptsInFolder.every(s => s.disabled);

        folderHtml.attr('id', folder.id);
        folderHtml.data('folderId', folder.id);
        folderHtml.find('.folder-name').text(folder.name);
        folderHtml.find('.folder-script-count').text(`(${scriptsInFolder.length})`);
        if (folder.description) {
            folderHtml.find('.folder-description').text(folder.description);
        }

        if (folder.isCollapsed) {
            folderHtml.addClass('collapsed');
        }

        if (allDisabled) {
            folderHtml.addClass('all-disabled');
        }

        folderHtml.find('.folder-header').on('click', function (event) {
            if ($(event.target).closest('.folder-actions').length === 0 && $(event.target).closest('.drag-handle').length === 0) {
                folder.isCollapsed = !folder.isCollapsed;
                $(this).closest('.regex-folder').toggleClass('collapsed');
                saveSettingsDebounced();
            }
        });


        const toggleAction = async(enable) => {
            if (scriptsInFolder.length === 0) return;
            for (const script of scriptsInFolder) {
                script.disabled = !enable;
                const isScoped = scopedScripts.some(s => s.id === script.id);
                const array = isScoped ? scopedScripts : globalScripts;
                const scriptIndex = array.findIndex(s => s.id === script.id);
                if (scriptIndex > -1) {
                    array[scriptIndex] = script;
                    if (isScoped) await writeExtensionField(this_chid, 'regex_scripts', array);
                }
            }
            saveSettingsDebounced();
            await loadRegexScripts();
        };

        folderHtml.find('.toggle-folder-scripts-enable').on('click', () => toggleAction(true));
        folderHtml.find('.toggle-folder-scripts-disable').on('click', () => toggleAction(false));

        folderHtml.find('.edit-folder').on('click', () => onFolderEditorOpenClick(folder.id));

        folderHtml.find('.delete-folder').on('click', async function () {
            const confirm = await callGenericPopup(t`Are you sure you want to delete this folder? The scripts inside will NOT be deleted.`, POPUP_TYPE.CONFIRM);
            if (confirm) {
                const folderIndex = extension_settings.regex_folders.findIndex(f => f.id === folder.id);
                if (folderIndex > -1) {
                    extension_settings.regex_folders.splice(folderIndex, 1);
                    saveSettingsDebounced();
                    await loadRegexScripts();
                }
            }
        });

        const scriptContainer = folderHtml.find('.regex-script-container');
        folder.scriptIds.forEach(scriptId => {
            const script = allScripts.find(s => s.id === scriptId);
            if (script) {
                renderScript(scriptContainer, script);
            }
        });

        $(container).append(folderHtml);
    }

    const globalScriptsContainer = $('#saved_regex_scripts');
    const scopedScriptsContainer = $('#saved_scoped_scripts');
    const foldersContainer = $('#regex_folders_container');

    const allScriptIdsInFolders = (extension_settings.regex_folders ?? []).flatMap(f => f.scriptIds);

    (extension_settings.regex_folders ?? []).forEach(folder => renderFolder(foldersContainer, folder));

    globalScripts.filter(s => !allScriptIdsInFolders.includes(s.id)).forEach(script => renderScript(globalScriptsContainer, script));
    scopedScripts.filter(s => !allScriptIdsInFolders.includes(s.id)).forEach(script => renderScript(scopedScriptsContainer, script));

    const isAllowed = extension_settings?.character_allowed_regex?.includes(characters?.[this_chid]?.avatar);
    $('#regex_scoped_toggle').prop('checked', isAllowed);

    makeSortable();
}

/**
 * Opens a popup to create or edit a folder.
 * @param {string|null} [folderId=null] The ID of the folder to edit. If null, creates a new folder.
 */
async function onFolderEditorOpenClick(folderId = null) {
    const editorHtml = $(await renderExtensionTemplateAsync('regex', 'folderEditor'));
    const isEdit = folderId !== null;
    let folder = isEdit ? extension_settings.regex_folders.find(f => f.id === folderId) : null;

    if (isEdit && folder) {
        editorHtml.find('#folder_name_input').val(folder.name);
        editorHtml.find('#folder_description_input').val(folder.description);
    }

    const popupResult = await callGenericPopup(editorHtml, POPUP_TYPE.CONFIRM, '', { okButton: t`Save`, cancelButton: t`Cancel` });

    if (popupResult) {
        const name = editorHtml.find('#folder_name_input').val().trim();
        const description = editorHtml.find('#folder_description_input').val().trim();

        if (!name) {
            toastr.error(t`Folder name cannot be empty.`);
            return;
        }

        if (isEdit && folder) {
            folder.name = name;
            folder.description = description;
        } else {
            const newFolder = {
                id: uuidv4(),
                name: name,
                description: description,
                scriptIds: [],
                isScoped: false,
                isCollapsed: false,
            };
            extension_settings.regex_folders.push(newFolder);
        }

        saveSettingsDebounced();
        await loadRegexScripts();
    }
}


/**
 * Opens the regex editor.
 * @param {string|boolean} existingId Existing ID
 * @param {boolean} isScoped Is the script scoped to a character?
 * @returns {Promise<void>}
 */
async function onRegexEditorOpenClick(existingId, isScoped) {
    const editorHtml = $(await renderExtensionTemplateAsync('regex', 'editor'));
    const array = (isScoped && this_chid ? characters[this_chid]?.data?.extensions?.regex_scripts : extension_settings.regex) ?? [];

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
            editorHtml.find('select[name="substitute_regex"]').val(existingScript.substituteRegex ?? substitute_find_regex.NONE);
            editorHtml.find('input[name="min_depth"]').val(existingScript.minDepth ?? '');
            editorHtml.find('input[name="max_depth"]').val(existingScript.maxDepth ?? '');

            existingScript.placement.forEach((element) => {
                editorHtml
                    .find(`input[name="replace_position"][value="${element}"]`)
                    .prop('checked', true);
            });
        }
    } else {
        editorHtml.find('input[name="only_format_display"]').prop('checked', true);
        editorHtml.find('input[name="run_on_edit"]').prop('checked', true);
        editorHtml.find('input[name="replace_position"][value="1"]').prop('checked', true);
    }

    editorHtml.find('#regex_test_mode_toggle').on('click', function () {
        editorHtml.find('#regex_test_mode').toggleClass('displayNone');
        updateTestResult();
    });

    function updateTestResult() {
        updateInfoBlock(editorHtml);

        if (!editorHtml.find('#regex_test_mode').is(':visible')) {
            return;
        }

        const testScript = {
            id: uuidv4(),
            scriptName: editorHtml.find('.regex_script_name').val().toString(),
            findRegex: editorHtml.find('.find_regex').val().toString(),
            replaceString: editorHtml.find('.regex_replace_string').val().toString(),
            trimStrings: String(editorHtml.find('.regex_trim_strings').val()).split('\n').filter((e) => e.length !== 0) || [],
            substituteRegex: Number(editorHtml.find('select[name="substitute_regex"]').val()),
            disabled: false, promptOnly: false, markdownOnly: false, runOnEdit: false,
            minDepth: null, maxDepth: null, placement: null,
        };
        const rawTestString = String(editorHtml.find('#regex_test_input').val());
        const result = runRegexScript(testScript, rawTestString);
        editorHtml.find('#regex_test_output').text(result);
    }

    editorHtml.find('input, textarea, select').on('input', updateTestResult);
    updateInfoBlock(editorHtml);

    const popupResult = await callGenericPopup(editorHtml, POPUP_TYPE.CONFIRM, '', { okButton: t`Save`, cancelButton: t`Cancel`, allowVerticalScrolling: true });
    if (popupResult) {
        const newRegexScript = {
            id: existingId ? String(existingId) : uuidv4(),
            scriptName: String(editorHtml.find('.regex_script_name').val()),
            findRegex: String(editorHtml.find('.find_regex').val()),
            replaceString: String(editorHtml.find('.regex_replace_string').val()),
            trimStrings: String(editorHtml.find('.regex_trim_strings').val()).split('\n').filter((e) => e.length !== 0) || [],
            placement:
                editorHtml
                    .find('input[name="replace_position"]')
                    .filter(':checked')
                    .map(function () { return parseInt($(this).val().toString()); })
                    .get()
                    .filter((e) => !isNaN(e)) || [],
            disabled: editorHtml.find('input[name="disabled"]').prop('checked'),
            markdownOnly: editorHtml.find('input[name="only_format_display"]').prop('checked'),
            promptOnly: editorHtml.find('input[name="only_format_prompt"]').prop('checked'),
            runOnEdit: editorHtml.find('input[name="run_on_edit"]').prop('checked'),
            substituteRegex: Number(editorHtml.find('select[name="substitute_regex"]').val()),
            minDepth: parseInt(String(editorHtml.find('input[name="min_depth"]').val())),
            maxDepth: parseInt(String(editorHtml.find('input[name="max_depth"]').val())),
        };

        saveRegexScript(newRegexScript, existingScriptIndex, isScoped);
    }
}

/**
 * Updates the info block in the regex editor with hints regarding the find regex.
 * @param {JQuery<HTMLElement>} editorHtml The editor HTML
 */
function updateInfoBlock(editorHtml) {
    const infoBlock = editorHtml.find('.info-block').get(0);
    const infoBlockFlagsHint = editorHtml.find('#regex_info_block_flags_hint');
    const findRegex = String(editorHtml.find('.find_regex').val());

    infoBlockFlagsHint.hide();

    if (!findRegex) {
        setInfoBlock(infoBlock, t`Find Regex is empty`, 'info');
        return;
    }

    try {
        const regex = regexFromString(findRegex);
        if (!regex) {
            throw new Error(t`Invalid Find Regex`);
        }

        const flagInfo = [];
        flagInfo.push(regex.flags.includes('g') ? t`Applies to all matches` : t`Applies to the first match`);
        flagInfo.push(regex.flags.includes('i') ? t`Case insensitive` : t`Case sensitive`);

        setInfoBlock(infoBlock, flagInfo.join('. '), 'hint');
        infoBlockFlagsHint.show();
    } catch (error) {
        setInfoBlock(infoBlock, error.message, 'error');
    }
}

function migrateSettings() {
    let performSave = false;

    if (!extension_settings.regex) extension_settings.regex = [];
    if (!extension_settings.regex_folders) extension_settings.regex_folders = [];

    getRegexScripts().forEach((script) => {
        if (!script.id) {
            script.id = uuidv4();
            performSave = true;
        }

        if (!Array.isArray(script.placement)) {
            script.placement = [];
            performSave = true;
        }

        if (script.placement.includes(regex_placement.MD_DISPLAY)) {
            script.placement = script.placement.length === 1 ?
                Object.values(regex_placement).filter((e) => e !== regex_placement.MD_DISPLAY) :
                script.placement.filter((e) => e !== regex_placement.MD_DISPLAY);

            script.markdownOnly = true;
            script.promptOnly = true;
            performSave = true;
        }

        if (script.placement.includes(4)) {
            script.placement = script.placement.length === 1 ?
                [regex_placement.SLASH_COMMAND] :
                script.placement.filter((e) => e !== 4);
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
                toastr.warning(t`Regex script "${scriptName}" is disabled.`);
                return value;
            }

            console.debug(`Running regex callback for ${scriptName}`);
            return runRegexScript(script, value);
        }
    }

    toastr.warning(`Regex script "${scriptName}" not found.`);
    return value;
}

async function toggleRegexCallback(args, scriptName) {
    if (typeof scriptName !== 'string') throw new Error('Script name must be a string.');

    const quiet = isTrueBoolean(args?.quiet);
    const action = isTrueBoolean(args?.state) ? 'enable' :
        isFalseBoolean(args?.state) ? 'disable' :
            'toggle';

    const scripts = getRegexScripts();
    const script = scripts.find(s => equalsIgnoreCaseAndAccents(s.scriptName, scriptName));

    if (!script) {
        toastr.warning(t`Regex script '${scriptName}' not found.`);
        return '';
    }

    switch (action) {
        case 'enable': script.disabled = false; break;
        case 'disable': script.disabled = true; break;
        default: script.disabled = !script.disabled; break;
    }

    const isScoped = this_chid && characters[this_chid]?.data?.extensions?.regex_scripts?.some(s => s.id === script.id);
    const array = isScoped ? characters[this_chid].data.extensions.regex_scripts : extension_settings.regex;
    const index = array.findIndex(s => s.id === script.id);

    await saveRegexScript(script, index, isScoped);
    if (script.disabled) {
        !quiet && toastr.success(t`Regex script '${scriptName}' has been disabled.`);
    } else {
        !quiet && toastr.success(t`Regex script '${scriptName}' has been enabled.`);
    }

    return script.scriptName || '';
}

async function onRegexImportObjectChange(regexScript, isScoped) {
    try {
        if (!regexScript.scriptName) {
            throw new Error('No script name provided.');
        }

        regexScript.id = uuidv4();
        const array = (isScoped && this_chid ? characters[this_chid].data.extensions.regex_scripts : extension_settings.regex) ?? [];
        array.push(regexScript);

        if (isScoped) {
            await writeExtensionField(this_chid, 'regex_scripts', array);
        }

        saveSettingsDebounced();
        await loadRegexScripts();
        toastr.success(t`Regex script "${regexScript.scriptName}" imported.`);
    } catch (error) {
        console.log(error);
        toastr.error(t`Invalid regex object.`);
    }
}

async function onRegexImportFileChange(file, isScoped) {
    if (!file) {
        toastr.error('No file provided.');
        return;
    }

    try {
        const fileContent = await getFileText(file);
        if (!fileContent) return;
        const regexScripts = JSON.parse(fileContent);

        const scriptsToImport = Array.isArray(regexScripts) ? regexScripts : [regexScripts];
        for (const regexScript of scriptsToImport) {
            await onRegexImportObjectChange(regexScript, isScoped);
        }
    } catch (error) {
        console.log(error);
        toastr.error('Invalid JSON file.');
    }
}

function purgeEmbeddedRegexScripts({ character }) {
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
                if (!accountStorage.getItem(checkKey)) {
                    accountStorage.setItem(checkKey, 'true');
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

function makeSortable() {
    // Sortable for scripts
    $('.regex-script-container').sortable({
        delay: getSortableDelay(),
        handle: '.drag-handle',
        connectWith: '.regex-script-container',
        placeholder: 'sortable-placeholder',
        forcePlaceholderSize: true,
        stop: async function (event, ui) {
            const scriptId = ui.item.data('scriptId');
            const allFolders = extension_settings.regex_folders ?? [];
            const allGlobalScripts = extension_settings.regex ?? [];
            const allScopedScripts = (this_chid && characters[this_chid]?.data?.extensions?.regex_scripts) ? characters[this_chid].data.extensions.regex_scripts : [];

            allFolders.forEach(folder => {
                const index = folder.scriptIds.indexOf(scriptId);
                if (index > -1) {
                    folder.scriptIds.splice(index, 1);
                }
            });

            const newContainer = ui.item.parent();
            const newFolderId = newContainer.closest('.regex-folder').data('folderId');

            if (newFolderId) {
                const folder = allFolders.find(f => f.id === newFolderId);
                if (folder) {
                    const newScriptIds = newContainer.children().map(function () {
                        return $(this).data('scriptId');
                    }).get();
                    folder.scriptIds = newScriptIds;
                }
            } else {
                const allScripts = [...allGlobalScripts, ...allScopedScripts];

                const globalDomOrder = $('#saved_regex_scripts').children().map(function () { return $(this).data('scriptId'); }).get();
                const newGlobalOrder = globalDomOrder.map(id => allScripts.find(s => s.id === id)).filter(Boolean);
                const scriptsInGlobalFolders = allFolders.flatMap(f => f.scriptIds).map(id => allScripts.find(s => s.id === id)).filter(s => s && allGlobalScripts.includes(s));
                extension_settings.regex = [...scriptsInGlobalFolders, ...newGlobalOrder];

                if (this_chid) {
                    const scopedDomOrder = $('#saved_scoped_scripts').children().map(function () { return $(this).data('scriptId'); }).get();
                    const newScopedOrder = scopedDomOrder.map(id => allScripts.find(s => s.id === id)).filter(Boolean);
                    const scriptsInScopedFolders = allFolders.flatMap(f => f.scriptIds).map(id => allScripts.find(s => s.id === id)).filter(s => s && allScopedScripts.includes(s));
                    const finalScoped = [...scriptsInScopedFolders, ...newScopedOrder];
                    await writeExtensionField(this_chid, 'regex_scripts', finalScoped);
                }
            }

            saveSettingsDebounced();
            await loadRegexScripts();
        },
    }).disableSelection();

    // Sortable for folders (PERFORMANCE OPTIMIZED)
    $('#regex_folders_container').sortable({
        delay: getSortableDelay(),
        handle: '.drag-handle',
        placeholder: 'sortable-placeholder',
        forcePlaceholderSize: true,
        stop: function (event, ui) {
            const newOrder = $(this).sortable('toArray', { attribute: 'data-folderid' });
            extension_settings.regex_folders.sort((a, b) => {
                return newOrder.indexOf(a.id) - newOrder.indexOf(b.id);
            });
            saveSettingsDebounced();
        },
    }).disableSelection();
}


jQuery(async () => {
    // Initialize data once on extension load.
    initializeData();
    migrateSettings();

    if (extension_settings.disabledExtensions.includes('regex')) {
        return;
    }

    const settingsHtml = $(await renderExtensionTemplateAsync('regex', 'dropdown'));
    $('#regex_container').append(settingsHtml);
    $('#create_folder').on('click', () => onFolderEditorOpenClick());

    $('#regex_collapse_all').on('click', async() => {
        extension_settings.regex_folders.forEach(f => f.isCollapsed = true);
        saveSettingsDebounced();
        await loadRegexScripts();
    });
    $('#regex_expand_all').on('click', async() => {
        extension_settings.regex_folders.forEach(f => f.isCollapsed = false);
        saveSettingsDebounced();
        await loadRegexScripts();
    });


    $('#open_regex_editor').on('click', () => onRegexEditorOpenClick(false, false));
    $('#open_scoped_editor').on('click', () => {
        if (this_chid === undefined) return toastr.error(t`No character selected.`);
        if (selected_group) return toastr.error(t`Cannot edit scoped scripts in group chats.`);
        onRegexEditorOpenClick(false, true);
    });
    $('#import_regex_file').on('change', async function () {
        let target = 'global';
        const template = $(await renderExtensionTemplateAsync('regex', 'importTarget'));
        template.find('#regex_import_target_global').on('input', () => target = 'global');
        template.find('#regex_import_target_scoped').on('input', () => target = 'scoped');
        await callGenericPopup(template, POPUP_TYPE.TEXT);
        const inputElement = this instanceof HTMLInputElement && this;
        if (inputElement && inputElement.files) {
            for (const file of inputElement.files) {
                await onRegexImportFileChange(file, target === 'scoped');
            }
            inputElement.value = '';
        }
    });
    $('#import_regex').on('click', () => $('#import_regex_file').trigger('click'));

    function getSelectedScripts() {
        const scripts = getRegexScripts();
        const selector = '#regex_container .regex-script-label:has(.regex_bulk_checkbox:checked)';
        const selectedIds = Array.from(document.querySelectorAll(selector)).map(e => $(e).data('scriptId')).filter(id => id);
        return scripts.filter(script => selectedIds.includes(script.id));
    }

    $('#bulk_select_all_toggle').on('click', async () => {
        const checkboxes = $('#regex_container .regex_bulk_checkbox');
        if (checkboxes.length === 0) return;
        const allAreChecked = checkboxes.length === checkboxes.filter(':checked').length;
        const newState = !allAreChecked;
        checkboxes.prop('checked', newState);
        setToggleAllIcon(newState);
    });

    $('#bulk_enable_regex').on('click', async () => {
        const scripts = getSelectedScripts().filter(script => script.disabled);
        if (scripts.length === 0) return toastr.warning(t`No regex scripts selected for enabling.`);
        for (const script of scripts) script.disabled = false;
        saveSettingsDebounced();
        await loadRegexScripts();
    });

    $('#bulk_disable_regex').on('click', async () => {
        const scripts = getSelectedScripts().filter(script => !script.disabled);
        if (scripts.length === 0) return toastr.warning(t`No regex scripts selected for disabling.`);
        for (const script of scripts) script.disabled = true;
        saveSettingsDebounced();
        await loadRegexScripts();
    });

    $('#bulk_delete_regex').on('click', async () => {
        const scripts = getSelectedScripts();
        if (scripts.length === 0) return toastr.warning(t`No regex scripts selected for deletion.`);
        const confirm = await callGenericPopup('Are you sure you want to delete the selected regex scripts?', POPUP_TYPE.CONFIRM);
        if (!confirm) return;
        for (const script of scripts) {
            const isScoped = this_chid && characters[this_chid]?.data?.extensions?.regex_scripts?.some(s => s.id === script.id);
            await deleteRegexScript({ id: script.id, isScoped: isScoped });
        }
        await reloadCurrentChat();
        saveSettingsDebounced();
    });

    $('#bulk_export_regex').on('click', async () => {
        const scripts = getSelectedScripts();
        if (scripts.length === 0) return toastr.warning(t`No regex scripts selected for export.`);
        const fileName = `regex-${new Date().toISOString()}.json`;
        download(JSON.stringify(scripts, null, 4), fileName, 'application/json');
        await loadRegexScripts();
    });

    $('#regex_scoped_toggle').on('input', function () {
        if (this_chid === undefined) return toastr.error(t`No character selected.`);
        if (selected_group) return toastr.error(t`Cannot edit scoped scripts in group chats.`);
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

    const localEnumProviders = {
        regexScripts: () => getRegexScripts().map(script => {
            const isGlobal = (extension_settings.regex ?? []).some(x => x.id === script.id);
            return new SlashCommandEnumValue(script.scriptName, `${enumIcons.getStateIcon(!script.disabled)} [${isGlobal ? 'global' : 'scoped'}] ${script.findRegex}`,
                isGlobal ? enumTypes.enum : enumTypes.name, isGlobal ? 'G' : 'S');
        }),
    };

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'regex', callback: runRegexCallback, returns: 'replaced text',
        namedArgumentList: [SlashCommandNamedArgument.fromProps({ name: 'name', description: 'script name', typeList: [ARGUMENT_TYPE.STRING], isRequired: true, enumProvider: localEnumProviders.regexScripts })],
        unnamedArgumentList: [new SlashCommandArgument('input', [ARGUMENT_TYPE.STRING], false)],
        helpString: 'Runs a Regex extension script by name on the provided string. The script must be enabled.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'regex-toggle', callback: toggleRegexCallback, returns: 'The name of the script that was toggled',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({ name: 'state', description: 'Explicitly set the state of the script (\'on\' to enable, \'off\' to disable). If not provided, the state will be toggled to the opposite of the current state.', typeList: [ARGUMENT_TYPE.BOOLEAN], defaultValue: 'toggle', enumList: commonEnumProviders.boolean('onOffToggle')() }),
            SlashCommandNamedArgument.fromProps({ name: 'quiet', description: 'Suppress the toast message script toggled', typeList: [ARGUMENT_TYPE.BOOLEAN], defaultValue: 'false', enumList: commonEnumProviders.boolean('trueFalse')() }),
        ],
        unnamedArgumentList: [SlashCommandArgument.fromProps({ description: 'script name', typeList: [ARGUMENT_TYPE.STRING], isRequired: true, enumProvider: localEnumProviders.regexScripts })],
        helpString: '<div>Toggles the state of a specified regex script.</div><div><strong>Example:</strong><ul><li><pre><code class="language-stscript">/regex-toggle MyScript</code></pre></li><li><pre><code class="language-stscript">/regex-toggle state=off Character-specific Script</code></pre></li></ul></div>',
    }));

    eventSource.on(event_types.CHAT_CHANGED, checkEmbeddedRegexScripts);
    eventSource.on(event_types.CHARACTER_DELETED, purgeEmbeddedRegexScripts);
});
