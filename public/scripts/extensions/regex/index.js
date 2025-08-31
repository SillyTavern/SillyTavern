import { characters, eventSource, event_types, getCurrentChatId, messageFormatting, reloadCurrentChat, saveSettingsDebounced, this_chid } from '../../../script.js';
import { extension_settings, renderExtensionTemplateAsync, writeExtensionField } from '../../extensions.js';
import { selected_group } from '../../group-chats.js';
import { callGenericPopup, POPUP_TYPE } from '../../popup.js';
import { SlashCommand } from '../../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from '../../slash-commands/SlashCommandArgument.js';
import { commonEnumProviders, enumIcons } from '../../slash-commands/SlashCommandCommonEnumsProvider.js';
import { SlashCommandEnumValue, enumTypes } from '../../slash-commands/SlashCommandEnumValue.js';
import { SlashCommandParser } from '../../slash-commands/SlashCommandParser.js';
import { download, equalsIgnoreCaseAndAccents, getFileText, getSortableDelay, isFalseBoolean, isTrueBoolean, regexFromString, setInfoBlock, uuidv4, escapeHtml } from '../../utils.js';
import { regex_placement, runRegexScript, substitute_find_regex } from './engine.js';
import { t } from '../../i18n.js';
import { accountStorage } from '../../util/AccountStorage.js';

const sanitizeFileName = name => name.replace(/[\s.<>:"/\\|?*\x00-\x1F\x7F]/g, '_').toLowerCase();

/**
 * @typedef {import('../../char-data.js').RegexScriptData} RegexScript
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
    // If not editing
    const array = (isScoped ? characters[this_chid]?.data?.extensions?.regex_scripts : extension_settings.regex) ?? [];

    // Assign a UUID if it doesn't exist
    if (!regexScript.id) {
        regexScript.id = uuidv4();
    }

    // Is the script name undefined or empty?
    if (!regexScript.scriptName) {
        toastr.error(t`Could not save regex script: The script name was undefined or empty!`);
        return;
    }

    // Is a find regex present?
    if (regexScript.findRegex.length === 0) {
        toastr.warning(t`This regex script will not work, but was saved anyway: A find regex isn't present.`);
    }

    // Is there someplace to place results?
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

    const debuggerPopup = $('#regex_debugger_popup');
    if (debuggerPopup.length) {
        populateDebuggerRuleList(debuggerPopup.parent());
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
    setToggleAllIcon(false);

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
            const confirm = await callGenericPopup(t`Are you sure you want to move this regex script to global?`, POPUP_TYPE.CONFIRM);

            if (!confirm) {
                return;
            }

            await deleteRegexScript({ id: script.id, isScoped: true });
            await saveRegexScript(script, -1, false);
        });
        scriptHtml.find('.move_to_scoped').on('click', async function () {
            if (this_chid === undefined) {
                toastr.error(t`No character selected.`);
                return;
            }

            if (selected_group) {
                toastr.error(t`Cannot edit scoped scripts in group chats.`);
                return;
            }

            const confirm = await callGenericPopup(t`Are you sure you want to move this regex script to scoped?`, POPUP_TYPE.CONFIRM);

            if (!confirm) {
                return;
            }

            await deleteRegexScript({ id: script.id, isScoped: false });
            await saveRegexScript(script, -1, true);
        });
        scriptHtml.find('.export_regex').on('click', async function () {
            const fileName = `regex-${sanitizeFileName(script.scriptName)}.json`;
            const fileData = JSON.stringify(script, null, 4);
            download(fileData, fileName, 'application/json');
        });
        scriptHtml.find('.delete_regex').on('click', async function () {
            const confirm = await callGenericPopup(t`Are you sure you want to delete this regex script?`, POPUP_TYPE.CONFIRM);

            if (!confirm) {
                return;
            }

            await deleteRegexScript({ id: script.id, isScoped });
            await reloadCurrentChat();
        });
        scriptHtml.find('.regex_bulk_checkbox').on('change', function () {
            const checkboxes = $('#regex_container .regex_bulk_checkbox');
            const allAreChecked = checkboxes.length === checkboxes.filter(':checked').length;
            setToggleAllIcon(allAreChecked);
        });

        $(container).append(scriptHtml);
    }

    extension_settings?.regex?.forEach((script, index) => renderScript('#saved_regex_scripts', script, false, index));
    characters[this_chid]?.data?.extensions?.regex_scripts?.forEach((script, index) => renderScript('#saved_scoped_scripts', script, true, index));

    const isAllowed = extension_settings?.character_allowed_regex?.includes(characters?.[this_chid]?.avatar);
    $('#regex_scoped_toggle').prop('checked', isAllowed);

    // Load presets UI
    loadRegexPresetsUI();
}

/**
 * Loads and populates the regex presets UI
 */
function loadRegexPresetsUI() {
    const presets = getRegexPresets();
    const select = $('#regex_preset_select');
    const currentPreset = extension_settings.selected_regex_preset;

    // Clear existing options except the first one
    select.find('option:not(:first)').remove();

    // Add preset options
    presets.forEach(preset => {
        const option = $('<option></option>')
            .attr('value', preset.name)
            .text(preset.name);

        // Create tooltip with global/scoped distinction
        let tooltip = '';
        const globalScripts = preset.globalScripts ?? [];
        const scopedScripts = preset.scopedScripts ?? [];

        if (globalScripts.length > 0) {
            tooltip += `Global: ${globalScripts.join(', ')}`;
        }
        if (scopedScripts.length > 0) {
            if (tooltip) tooltip += '\n';
            tooltip += `Scoped: ${scopedScripts.join(', ')}`;
        }
        if (!tooltip) {
            tooltip = 'No scripts in preset';
        }

        // Add exclusive info to tooltip
        if (preset.exclusive) {
            tooltip += '\n[EXCLUSIVE - disables others when applied]';
        }

        option.attr('title', tooltip);
        select.append(option);
    });

    // Set current selection
    if (currentPreset) {
        select.val(currentPreset);
        
        // Update exclusive checkbox based on current preset
        const preset = presets.find(p => equalsIgnoreCaseAndAccents(p.name, currentPreset));
        $('#regex_preset_exclusive').prop('checked', preset?.exclusive || false);
    } else {
        select.val('');
        $('#regex_preset_exclusive').prop('checked', false);
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
            disabled: false,
            promptOnly: false,
            markdownOnly: false,
            runOnEdit: false,
            minDepth: null,
            maxDepth: null,
            placement: null,
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
 * Builds an HTML string for a replacement, highlighting literal parts in green
 * and keeping back-referenced parts plain.
 * @param {RegExpMatchArray} match The match object from `matchAll`.
 * @param {string} pattern The replacement pattern string (e.g., "new text $1").
 * @returns {string} The constructed HTML string.
 */
function buildReplacementHtml(match, pattern) {
    const container = document.createDocumentFragment();
    let lastIndex = 0;
    const backrefRegex = /\$\$|\$&|\$`|\$'|\$(\d{1,2})/g;

    let reMatch;
    while ((reMatch = backrefRegex.exec(pattern)) !== null) {
        // Part of the pattern before the back-reference is a literal.
        const literalPart = pattern.substring(lastIndex, reMatch.index);
        if (literalPart) {
            const mark = document.createElement('mark');
            mark.className = 'green_hl';
            mark.innerText = literalPart;
            container.appendChild(mark);
        }

        const backref = reMatch[0];
        if (backref === '$$') {
            container.appendChild(document.createTextNode('$'));
        } else if (backref === '$&') {
            const mark = document.createElement('mark');
            mark.className = 'yellow_hl';
            mark.innerText = match[0];
            container.appendChild(mark);
        } else if (backref === '$`') {
            container.appendChild(document.createTextNode(match.input.substring(0, match.index)));
        } else if (backref === '$\'') {
            container.appendChild(document.createTextNode(match.input.substring(match.index + match[0].length)));
        } else { // It's a numbered capture group, $n.
            const groupIndex = parseInt(reMatch[1], 10);
            if (groupIndex > 0 && groupIndex < match.length && match[groupIndex] !== undefined) {
                const mark = document.createElement('mark');
                mark.className = 'yellow_hl';
                mark.innerText = match[groupIndex];
                container.appendChild(mark);
            } else {
                // Not a valid group index, treat it as a literal.
                const mark = document.createElement('mark');
                mark.className = 'green_hl';
                mark.innerText = backref;
                container.appendChild(mark);
            }
        }
        lastIndex = backrefRegex.lastIndex;
    }

    // The final part of the pattern after the last back-reference.
    const finalLiteralPart = pattern.substring(lastIndex);
    if (finalLiteralPart) {
        const mark = document.createElement('mark');
        mark.className = 'green_hl';
        mark.innerText = finalLiteralPart;
        container.appendChild(mark);
    }

    // To get the HTML content, we need a temporary parent element.
    const tempDiv = document.createElement('div');
    tempDiv.appendChild(container);
    return tempDiv.innerHTML;
}

function executeRegexScriptForDebugging(script, text) {
    let err;
    let originalRegex;

    try {
        originalRegex = regexFromString(script.findRegex);
        if (!originalRegex) throw new Error('Invalid regex string');
    } catch (e) {
        err = `Compile error: ${e.message}`;
        return { output: text, highlightedOutput: text, error: err, charsCaptured: 0, charsAdded: 0, charsRemoved: 0 };
    }

    const globalRegex = new RegExp(originalRegex.source, originalRegex.flags.includes('g') ? originalRegex.flags : originalRegex.flags + 'g');
    const matches = [...text.matchAll(globalRegex)];

    if (matches.length === 0) {
        return { output: text, highlightedOutput: escapeHtml(text), error: null, charsCaptured: 0, charsAdded: 0, charsRemoved: 0 };
    }

    let outputText = '';
    let highlightedOutput = ''; // This will now be our "diff view"
    let lastIndex = 0;
    let totalCharsCaptured = 0;
    let totalCharsAdded = 0;
    let totalCharsRemoved = 0;

    try {
        for (const match of matches) {
            const originalMatchText = match[0];
            totalCharsCaptured += originalMatchText.length;

            // Append text between matches (this part is unchanged)
            const precedingText = text.substring(lastIndex, match.index);
            outputText += precedingText;
            highlightedOutput += escapeHtml(precedingText);

            // --- Start of new diff and statistics logic ---
            let charsAddedInMatch = 0;
            let charsKeptFromMatch = 0;
            const backrefRegex = /\$\$|\$&|\$`|\$'|\$(\d{1,2})/g;
            let lastPatternIndex = 0;
            let reMatch;
            let replacementForPlainText = '';

            // This loop calculates the stats accurately
            while ((reMatch = backrefRegex.exec(script.replaceString)) !== null) {
                const literalPart = script.replaceString.substring(lastPatternIndex, reMatch.index);
                charsAddedInMatch += literalPart.length;
                replacementForPlainText += literalPart;
                const backref = reMatch[0];
                if (backref === '$$') {
                    replacementForPlainText += '$';
                } else if (backref === '$&') {
                    charsKeptFromMatch += (match[0] || '').length; replacementForPlainText += (match[0] || '');
                } else if (backref === '$`') {
                    const part = match.input.substring(0, match.index); charsKeptFromMatch += part.length; replacementForPlainText += part;
                } else if (backref === '$\'') {
                    const part = match.input.substring(match.index + match[0].length); charsKeptFromMatch += part.length; replacementForPlainText += part;
                } else {
                    const groupIndex = parseInt(reMatch[1], 10);
                    if (groupIndex > 0 && groupIndex < match.length && match[groupIndex] !== undefined) {
                        charsKeptFromMatch += match[groupIndex].length;
                        replacementForPlainText += match[groupIndex];
                    }
                }
                lastPatternIndex = backrefRegex.lastIndex;
            }
            const finalLiteralPart = script.replaceString.substring(lastPatternIndex);
            charsAddedInMatch += finalLiteralPart.length;
            replacementForPlainText += finalLiteralPart;

            totalCharsAdded += charsAddedInMatch;
            totalCharsRemoved += (originalMatchText.length - charsKeptFromMatch);

            outputText += replacementForPlainText;
            // --- End of statistics logic ---

            // --- Build the new Diff View HTML ---
            // 1. Show the entire original match as "removed" (red strikethrough)
            highlightedOutput += `<mark class='red_hl'>${escapeHtml(originalMatchText)}</mark>`;
            // 2. Add an arrow to signify transformation
            highlightedOutput += ' → ';
            // 3. Build the replacement string with green (added) and yellow (kept) parts
            highlightedOutput += buildReplacementHtml(match, script.replaceString);

            lastIndex = match.index + originalMatchText.length;
        }

        // Append text after the last match
        const trailingText = text.substring(lastIndex);
        outputText += trailingText;
        highlightedOutput += escapeHtml(trailingText);

    } catch (e) {
        err = (err ? err + '; ' : '') + `Replace error: ${e.message}`;
        outputText = text; // Fallback
        highlightedOutput = escapeHtml(text);
    }

    return {
        output: outputText,
        highlightedOutput: highlightedOutput,
        error: err,
        charsCaptured: totalCharsCaptured,
        charsAdded: totalCharsAdded,
        charsRemoved: totalCharsRemoved,
    };
}

function populateDebuggerRuleList(container) {
    const rulesContainer = container.find('#regex_debugger_rules');
    const ruleTemplate = container.find('#regex_debugger_rule_template');
    if (!rulesContainer.length || !ruleTemplate.length) {
        console.error('Regex Debugger: Could not find rule list or template in the DOM.');
        return;
    }

    rulesContainer.empty();

    const allScripts = getRegexScripts();
    if (!allScripts || allScripts.length === 0) {
        rulesContainer.append('<div class="regex-debugger-no-rules">No regex rules found.</div>');
        return;
    }

    const globalScriptIds = new Set((extension_settings.regex ?? []).map(s => s.id));
    const globalScripts = [];
    const scopedScripts = [];

    allScripts.forEach(script => {
        const scriptCopy = structuredClone(script); // Use structuredClone for deep copy
        if (globalScriptIds.has(script.id)) {
            // @ts-ignore
            scriptCopy.isScoped = false;
            globalScripts.push(scriptCopy);
        } else {
            // @ts-ignore
            scriptCopy.isScoped = true;
            scopedScripts.push(scriptCopy);
        }
    });

    container.data('allScripts', [...globalScripts, ...scopedScripts]);

    const renderRule = (script) => {
        if (!script.id) script.id = uuidv4();
        const ruleElementContent = $(ruleTemplate.prop('content')).clone();
        const ruleElement = ruleElementContent.find('.regex-debugger-rule');

        ruleElement.attr('data-id', script.id);
        // @ts-ignore
        ruleElement.find('.rule-name').text(script.scriptName);
        ruleElement.find('.rule-regex').text(script.findRegex);
        // @ts-ignore
        ruleElement.find('.rule-scope').text(script.isScoped ? 'Scoped' : 'Global');
        ruleElement.find('.rule-enabled').prop('checked', !script.disabled);
        // @ts-ignore
        ruleElement.find('.edit_rule').on('click', () => onRegexEditorOpenClick(script.id, script.isScoped));

        ruleElement.on('click', function (event) {
            if ($(event.target).is('input, .menu_button, .menu_button i')) {
                return;
            }
            const scriptId = $(this).data('id');
            const stepElement = $(`#step-result-${scriptId}`);
            const container = $('#regex_debugger_steps_output');

            if (stepElement.length && container.length) {
                // Replace scrollIntoView with scrollTop animation
                const targetTop = stepElement.position().top;
                const containerScrollTop = container.scrollTop();
                const containerHeight = container.height();

                // Center the element if possible
                let scrollTo = containerScrollTop + targetTop - (containerHeight / 2) + (stepElement.height() / 2);

                container.animate({ scrollTop: scrollTo }, 300); // 300ms smooth scroll

                stepElement.css('transition', 'background-color 0.5s').css('background-color', 'var(--highlight_color)');
                setTimeout(() => stepElement.css('background-color', ''), 1000);
            }
        });

        return ruleElementContent;
    };

    if (globalScripts.length > 0) {
        rulesContainer.append('<div class="list-header regex-debugger-list-header">Global Rules</div>');
        const globalList = $('<ul id="regex_debugger_rules_global" class="sortable-list"></ul>');
        globalScripts.forEach(script => globalList.append(renderRule(script)));
        rulesContainer.append(globalList);
    }

    if (scopedScripts.length > 0) {
        rulesContainer.append('<div class="list-header regex-debugger-list-header">Scoped Rules</div>');
        const scopedList = $('<ul id="regex_debugger_rules_scoped" class="sortable-list"></ul>');
        scopedScripts.forEach(script => scopedList.append(renderRule(script)));
        rulesContainer.append(scopedList);
    }
}

/**
 * Opens the regex debugger.
 * @returns {Promise<void>}
 */
async function onRegexDebuggerOpenClick() {
    const templateContent = await renderExtensionTemplateAsync('regex', 'debugger');
    const debuggerHtml = $('<div>').html(templateContent);

    const stepTemplate = debuggerHtml.find('#regex_debugger_step_template');

    populateDebuggerRuleList(debuggerHtml);

    // @ts-ignore
    debuggerHtml.find('#regex_debugger_rules_global').sortable({ delay: getSortableDelay() }).disableSelection();
    // @ts-ignore
    debuggerHtml.find('#regex_debugger_rules_scoped').sortable({ delay: getSortableDelay() }).disableSelection();

    debuggerHtml.find('#regex_debugger_run_test').on('click', function () {
        const allScripts = debuggerHtml.data('allScripts');
        const orderedRuleIds = [
            ...$('#regex_debugger_rules_global').find('li.regex-debugger-rule').map((i, el) => $(el).data('id')).get(),
            ...$('#regex_debugger_rules_scoped').find('li.regex-debugger-rule').map((i, el) => $(el).data('id')).get(),
        ];

        const rawInput = String($('#regex_debugger_raw_input').val());
        const stepsOutput = $('#regex_debugger_steps_output');
        const finalOutput = $('#regex_debugger_final_output');

        if (!stepsOutput.length || !finalOutput.length) return;

        const displayMode = $('input[name="display_mode"]:checked').val();
        stepsOutput.empty();
        finalOutput.empty();
        $('#regex_debugger_final_summary').remove();

        if (!allScripts) return;
        let textForNextStep = rawInput;
        let totalCharsCaptured = 0;
        let totalCharsAdded = 0;
        let totalCharsRemoved = 0;

        orderedRuleIds.forEach(scriptId => {
            const ruleElement = $(`#regex_debugger_rules [data-id="${scriptId}"]`);
            if (!ruleElement.find('.rule-enabled').is(':checked')) return;

            const script = allScripts.find(s => s.id === scriptId);

            if (script) {
                const result = executeRegexScriptForDebugging(script, textForNextStep);
                totalCharsCaptured += result.charsCaptured;
                totalCharsAdded += result.charsAdded;
                totalCharsRemoved += result.charsRemoved;

                const stepElement = $(stepTemplate.prop('content')).clone();
                // Set the ID on the TOP-LEVEL element that is being appended.
                stepElement.find('>:first-child').attr('id', `step-result-${script.id}`);
                const stepHeader = stepElement.find('.step-header');
                stepHeader.find('strong').text(`After: ${script.scriptName}`);

                const metricsHtml = `<span class="step-metrics">Captured: ${result.charsCaptured}, Added: +${result.charsAdded}, Removed: -${result.charsRemoved}</span>`;
                stepHeader.append(metricsHtml);

                if (displayMode === 'highlight') {
                    stepElement.find('.step-output').html(result.highlightedOutput);
                } else {
                    stepElement.find('.step-output').text(result.output);
                }

                if (result.error) {
                    stepHeader.append($(`<div class='warning_text text_rose-500'>${result.error}</div>`));
                }

                stepsOutput.append(stepElement);
                textForNextStep = result.output;
            }
        });

        const summaryHtml = `
            <div id="regex_debugger_final_summary" class="regex-debugger-summary">
                <strong>Total Captured:</strong> ${totalCharsCaptured} | <strong>Total Added:</strong> +${totalCharsAdded} | <strong>Total Removed:</strong> -${totalCharsRemoved}
            </div>
        `;
        finalOutput.before(summaryHtml);

        const renderMode = $('#regex_debugger_render_mode').val();
        if (renderMode === 'message') {
            const formattedHtml = messageFormatting(textForNextStep, 'Debugger', true, false, null);
            const messageBlock = $('<div class="mes"><div class="mes_text"></div></div>');
            messageBlock.find('.mes_text').html(formattedHtml);
            finalOutput.append(messageBlock);
        } else {
            finalOutput.text(textForNextStep);
        }
    });

    debuggerHtml.find('#regex_debugger_save_order').on('click', async function () {
        const allKnownScripts = getRegexScripts();
        const newGlobalScripts = $('#regex_debugger_rules_global').children('li').map((_, el) => allKnownScripts.find(s => s.id === $(el).data('id'))).get().filter(Boolean);
        const newScopedScripts = $('#regex_debugger_rules_scoped').children('li').map((_, el) => allKnownScripts.find(s => s.id === $(el).data('id'))).get().filter(Boolean);

        extension_settings.regex = newGlobalScripts;
        if (this_chid !== undefined) {
            await writeExtensionField(this_chid, 'regex_scripts', newScopedScripts);
        }

        saveSettingsDebounced();
        await loadRegexScripts();
        toastr.success(t`Regex script order saved!`);

        const currentPopupContent = $('div:has(> #regex_debugger_rules)');
        populateDebuggerRuleList(currentPopupContent);
        // @ts-ignore
        currentPopupContent.find('#regex_debugger_rules_global').sortable({ delay: getSortableDelay() }).disableSelection();
        // @ts-ignore
        currentPopupContent.find('#regex_debugger_rules_scoped').sortable({ delay: getSortableDelay() }).disableSelection();
    });

    debuggerHtml.find('#regex_debugger_expand_steps').on('click', function () {
        const popupContainer = $('<div class="expanded-regex-container"></div>');
        const navPanel = $('<div class="expanded-regex-nav"><h4>Steps</h4></div>');
        const contentPanel = $('<div class="expanded-regex-content"></div>');

        const content = $('#regex_debugger_steps_output').clone().html();
        contentPanel.html(content);

        $('#regex_debugger_rules .regex-debugger-rule').each(function () {
            const ruleElement = $(this);
            const scriptId = ruleElement.data('id');
            const scriptName = ruleElement.find('.rule-name').text();

            const link = $(`<a href="#">${escapeHtml(scriptName)}</a>`);
            link.data('target-id', `step-result-${scriptId}`);

            link.on('click', function (e) {
                e.preventDefault();
                navPanel.find('a').removeClass('active');
                $(this).addClass('active');

                const targetId = $(this).data('target-id');
                // The selector is now correct for the structure.
                const targetElement = contentPanel.find(`#${targetId}`);

                if (targetElement.length) {
                    const scrollTo = contentPanel.scrollTop() + targetElement.position().top;
                    contentPanel.animate({ scrollTop: scrollTo }, 300);

                    targetElement.css('transition', 'background-color 0.5s').css('background-color', 'var(--highlight_color)');
                    setTimeout(() => targetElement.css('background-color', ''), 1000);
                }
            });

            navPanel.append(link);
        });

        popupContainer.append(navPanel).append(contentPanel);
        callGenericPopup(popupContainer, POPUP_TYPE.TEXT, 'Step-by-step Transformation', { wide: true, allowVerticalScrolling: false });
    });

    debuggerHtml.find('#regex_debugger_expand_final').on('click', function () {
        const content = $('#regex_debugger_final_output').html();
        const popupContent = $('<div style="height: 70vh; overflow-y: auto;"></div>').html(content);
        callGenericPopup(popupContent, POPUP_TYPE.TEXT, 'Final Output', { wide: true, allowVerticalScrolling: true });
    });

    await callGenericPopup(debuggerHtml.children(), POPUP_TYPE.TEXT, '', { wide: true, allowVerticalScrolling: true });
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

    // Clear the info block if the find regex is empty
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

        if (!Array.isArray(script.placement)) {
            script.placement = [];
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

    if (!extension_settings.regex_presets) {
        extension_settings.regex_presets = [];
        performSave = true;
    }

    if (!extension_settings.selected_regex_preset) {
        extension_settings.selected_regex_preset = null;
        performSave = true;
    }

    if (performSave) {
        saveSettingsDebounced();
    }
}

/**
 * Gets the list of regex presets
 * @returns {Array} List of regex presets
 */
export function getRegexPresets() {
    return extension_settings.regex_presets ?? [];
}

/**
 * Creates a regex preset from currently enabled scripts
 * @param {string} name Preset name
 * @param {boolean} includeContent Whether to include full script content
 * @param {boolean} exclusive Whether this preset should be exclusive (disable others when applied)
 * @returns {Promise<string>} The created preset name
 */
async function createRegexPreset(name, includeContent = false, exclusive = false) {
    if (!name || typeof name !== 'string') {
        throw new Error('Preset name is required and must be a string');
    }

    const globalScriptObjects = (extension_settings.regex ?? [])
        .filter(script => !script.disabled);

    const scopedScriptObjects = (characters[this_chid]?.data?.extensions?.regex_scripts ?? [])
        .filter(script => !script.disabled);

    const preset = {
        id: uuidv4(),
        name: name,
        created: new Date().toISOString(),
        includesContent: includeContent,
        exclusive: exclusive,
    };

    if (includeContent) {
        // Include full script content
        preset.globalScriptsContent = globalScriptObjects.map(script => ({
            ...script,
            // Ensure we have all required fields
            id: script.id || uuidv4(),
            scriptName: script.scriptName,
            findRegex: script.findRegex || '',
            replaceString: script.replaceString || '',
            trimStrings: script.trimStrings || [],
            placement: script.placement || [],
            disabled: false, // Always save as enabled in preset
            markdownOnly: script.markdownOnly || false,
            promptOnly: script.promptOnly || false,
            runOnEdit: script.runOnEdit || false,
            substituteRegex: script.substituteRegex || 0,
            minDepth: script.minDepth || null,
            maxDepth: script.maxDepth || null,
        }));

        preset.scopedScriptsContent = scopedScriptObjects.map(script => ({
            ...script,
            id: script.id || uuidv4(),
            scriptName: script.scriptName,
            findRegex: script.findRegex || '',
            replaceString: script.replaceString || '',
            trimStrings: script.trimStrings || [],
            placement: script.placement || [],
            disabled: false,
            markdownOnly: script.markdownOnly || false,
            promptOnly: script.promptOnly || false,
            runOnEdit: script.runOnEdit || false,
            substituteRegex: script.substituteRegex || 0,
            minDepth: script.minDepth || null,
            maxDepth: script.maxDepth || null,
        }));

        // For compatibility, also include names
        preset.globalScripts = globalScriptObjects.map(s => s.scriptName);
        preset.scopedScripts = scopedScriptObjects.map(s => s.scriptName);
    } else {
        // Only include script names (reference mode)
        preset.globalScripts = globalScriptObjects.map(script => script.scriptName);
        preset.scopedScripts = scopedScriptObjects.map(script => script.scriptName);
    }

    const presets = getRegexPresets();
    const existingIndex = presets.findIndex(p => equalsIgnoreCaseAndAccents(p.name, name));

    if (existingIndex !== -1) {
        presets[existingIndex] = preset;
    } else {
        presets.push(preset);
    }

    extension_settings.regex_presets = presets;
    saveSettingsDebounced();

    return name;
}

/**
 * Saves current script states to a preset (overwrites if exists)
 * @param {string} name Preset name
 * @param {boolean} includeContent Whether to include full script content
 * @param {boolean} exclusive Whether this preset should be exclusive (disable others when applied)
 * @returns {Promise<string>} The saved preset name
 */
async function saveCurrentStateToPreset(name, includeContent = false, exclusive = false) {
    if (!name || typeof name !== 'string') {
        throw new Error('Preset name is required and must be a string');
    }

    // Get current enabled scripts from both global and scoped
    const globalScripts = (extension_settings.regex ?? [])
        .filter(script => !script.disabled)
        .map(script => script.scriptName);

    const scopedScripts = (characters[this_chid]?.data?.extensions?.regex_scripts ?? [])
        .filter(script => !script.disabled)
        .map(script => script.scriptName);

    const preset = {
        id: uuidv4(),
        name: name,
        globalScripts: globalScripts,
        scopedScripts: scopedScripts,
        exclusive: exclusive,
        created: new Date().toISOString(),
    };

    const presets = getRegexPresets();
    const existingIndex = presets.findIndex(p => equalsIgnoreCaseAndAccents(p.name, name));

    if (existingIndex !== -1) {
        // Preserve the original ID and creation date if updating
        preset.id = presets[existingIndex].id;
        preset.created = presets[existingIndex].created;
        preset.updated = new Date().toISOString();
        presets[existingIndex] = preset;
    } else {
        presets.push(preset);
    }

    extension_settings.regex_presets = presets;
    extension_settings.selected_regex_preset = name;
    saveSettingsDebounced();

    return name;
}

/**
 * Applies a regex preset by enabling/disabling scripts
 * @param {string} presetName Name of the preset to apply
 * @param {boolean} othersOff Whether to disable all other scripts
 * @returns {Promise<string>} The applied preset name
 */
async function applyRegexPreset(presetName, othersOff = false) {
    if (!presetName || typeof presetName !== 'string') {
        throw new Error('Preset name is required and must be a string');
    }

    const presets = getRegexPresets();
    const preset = presets.find(p => equalsIgnoreCaseAndAccents(p.name, presetName));

    if (!preset) {
        throw new Error(`Regex preset "${presetName}" not found`);
    }

    // If preset is exclusive, automatically enable othersOff (equivalent to others=off)
    if (preset.exclusive) {
        othersOff = true;
    }

    let changesCount = 0;

    const globalScriptsToEnable = preset.globalScripts ?? [];
    const scopedScriptsToEnable = preset.scopedScripts ?? [];

    // Handle global scripts
    const globalScripts = extension_settings.regex ?? [];
    for (const script of globalScripts) {
        const shouldBeEnabled = globalScriptsToEnable.some(name =>
            equalsIgnoreCaseAndAccents(name, script.scriptName));

        const currentlyEnabled = !script.disabled;

        if (othersOff) {
            // In othersOff mode, enable only scripts in preset, disable all others
            const shouldEnable = shouldBeEnabled;
            if (currentlyEnabled !== shouldEnable) {
                script.disabled = !shouldEnable;
                changesCount++;
            }
        } else {
            // In normal mode, only enable scripts in preset, don't disable others
            if (shouldBeEnabled && !currentlyEnabled) {
                script.disabled = false;
                changesCount++;
            }
        }
    }

    // Handle scoped scripts
    const scopedScripts = characters[this_chid]?.data?.extensions?.regex_scripts ?? [];
    if (scopedScripts.length > 0) {
        for (const script of scopedScripts) {
            const shouldBeEnabled = scopedScriptsToEnable.some(name =>
                equalsIgnoreCaseAndAccents(name, script.scriptName));

            const currentlyEnabled = !script.disabled;

            if (othersOff) {
                // In othersOff mode, enable only scripts in preset, disable all others
                const shouldEnable = shouldBeEnabled;
                if (currentlyEnabled !== shouldEnable) {
                    script.disabled = !shouldEnable;
                    changesCount++;
                }
            } else {
                // In normal mode, only enable scripts in preset, don't disable others
                if (shouldBeEnabled && !currentlyEnabled) {
                    script.disabled = false;
                    changesCount++;
                }
            }
        }
    }

    // Save changes
    if (changesCount > 0) {
        if (scopedScripts.length > 0) {
            await writeExtensionField(this_chid, 'regex_scripts', scopedScripts);
        }

        saveSettingsDebounced();
        await loadRegexScripts();
        await reloadCurrentChat();
    }

    extension_settings.selected_regex_preset = presetName;
    saveSettingsDebounced();

    return presetName;
}

/**
 * Deletes a regex preset
 * @param {string} presetName Name of the preset to delete
 * @returns {Promise<boolean>} Success status
 */
async function deleteRegexPreset(presetName) {
    if (!presetName || typeof presetName !== 'string') {
        throw new Error('Preset name is required and must be a string');
    }

    const presets = getRegexPresets();
    const index = presets.findIndex(p => equalsIgnoreCaseAndAccents(p.name, presetName));

    if (index === -1) {
        throw new Error(`Regex preset "${presetName}" not found`);
    }

    presets.splice(index, 1);
    extension_settings.regex_presets = presets;

    if (extension_settings.selected_regex_preset === presetName) {
        extension_settings.selected_regex_preset = null;
    }

    saveSettingsDebounced();
    return true;
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

/**
 * /regex-toggle slash command callback
 * @param {{state: string, quiet: string}} args Named arguments
 * @param {string} scriptName The name of the script to toggle
 * @returns {Promise<string>} The name of the script
 */
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
        case 'enable':
            script.disabled = false;
            break;
        case 'disable':
            script.disabled = true;
            break;
        default:
            script.disabled = !script.disabled;
            break;
    }

    const isScoped = characters[this_chid]?.data?.extensions?.regex_scripts?.some(s => s.id === script.id);
    const index = isScoped ? characters[this_chid]?.data?.extensions?.regex_scripts?.indexOf(script) : scripts.indexOf(script);

    await saveRegexScript(script, index, isScoped);
    if (script.disabled) {
        !quiet && toastr.success(t`Regex script '${scriptName}' has been disabled.`);
    } else {
        !quiet && toastr.success(t`Regex script '${scriptName}' has been enabled.`);
    }

    return script.scriptName || '';
}

/**
 * /regex-preset slash command callback
 *
 * Supports flexible parameter parsing to accommodate various usage patterns:
 * - Standard named parameters: action=edit preset scripts=a,b
 * - Mixed syntax: action=edit MyPreset scripts=a,b (common user input)
 * - Array format: scripts=["a","b"] or ["a","b"] others=off
 * - Legacy comma format: a,b,c others=off
 *
 * @param {{action: string, others: string, quiet: string, scripts: string, exclusive: string}} args Named arguments
 * @param {string} presetNameOrScripts Preset name or comma-separated script names
 * @returns {Promise<string>} Result message
 */
async function regexPresetCallback(args, presetNameOrScripts) {
    const quiet = isTrueBoolean(args?.quiet);
    const action = args?.action || 'apply';
    const othersOff = args?.others === 'off';
    const exclusive = isTrueBoolean(args?.exclusive);

    // Handle scripts parameter - support both string and JSON array formats
    let scriptsList = args?.scripts;

    // For better user experience, support parsing scripts from unnamed argument
    // This is a temporary solution until we can improve the command structure
    if (!scriptsList && presetNameOrScripts && presetNameOrScripts.includes('scripts=')) {
        const scriptsMatch = presetNameOrScripts.match(/scripts=([^&\s]+)/);
        if (scriptsMatch) {
            scriptsList = decodeURIComponent(scriptsMatch[1]);
            presetNameOrScripts = presetNameOrScripts.replace(/\s*scripts=[^&\s]+/, '').trim();
        }
    }

    // Support parsing others=off from unnamed argument
    let actualPresetName = presetNameOrScripts;
    let parsedOthersOff = othersOff;
    if (presetNameOrScripts && presetNameOrScripts.includes('others=off')) {
        const parts = presetNameOrScripts.split(/\s+/);
        actualPresetName = parts[0];
        parsedOthersOff = true;
    }

    // Process scripts parameter format
    if (typeof scriptsList === 'string' && scriptsList.trim().startsWith('[')) {
        try {
            const parsed = JSON.parse(scriptsList);
            if (Array.isArray(parsed)) {
                scriptsList = parsed.join(',');
            }
        } catch (e) {
            // If JSON parsing fails, treat as comma-separated string
        }
    }

    try {
        switch (action.toLowerCase()) {
            case 'create':
                if (!actualPresetName) {
                    throw new Error('Preset name is required for create action');
                }
                const includeContent = args?.content === 'true' || args?.content === true;
                await createRegexPreset(actualPresetName, includeContent, exclusive);
                const contentMsg = includeContent ? ' (with content)' : '';
                const exclusiveMsg = exclusive ? ' (exclusive)' : '';
                !quiet && toastr.success(t`Regex preset "${actualPresetName}" created${contentMsg}${exclusiveMsg}.`);
                return actualPresetName;

            case 'save':
                if (!actualPresetName) {
                    throw new Error('Preset name is required for save action');
                }
                const saveIncludeContent = args?.content === 'true' || args?.content === true;
                await saveCurrentStateToPreset(actualPresetName, saveIncludeContent, exclusive);
                loadRegexPresetsUI();
                const saveContentMsg = saveIncludeContent ? ' (with content)' : '';
                const saveExclusiveMsg = exclusive ? ' (exclusive)' : '';
                !quiet && toastr.success(t`Current state saved to preset "${actualPresetName}"${saveContentMsg}${saveExclusiveMsg}.`);
                return actualPresetName;

            case 'delete':
                if (!actualPresetName) {
                    throw new Error('Preset name is required for delete action');
                }
                await deleteRegexPreset(actualPresetName);
                !quiet && toastr.success(t`Regex preset "${actualPresetName}" deleted.`);
                return actualPresetName;

            case 'list':
                const availablePresets = getRegexPresets();
                const presetNames = availablePresets.map(p => p.name).join(', ');
                const currentPreset = extension_settings.selected_regex_preset;
                const result = presetNames || 'No presets found';
                !quiet && toastr.info(`Available presets: ${result}${currentPreset ? `\nCurrent: ${currentPreset}` : ''}`);
                return result;

            case 'show':
                if (!actualPresetName) {
                    throw new Error('Preset name is required for show action');
                }
                return await showPresetContents(actualPresetName, quiet);

            case 'edit':
                if (!actualPresetName) {
                    throw new Error('Preset name is required for edit action');
                }
                if (!scriptsList) {
                    throw new Error('scripts parameter is required for edit action (comma-separated script names)');
                }
                return await editPresetScripts(actualPresetName, scriptsList, quiet);

            case 'add':
                if (!actualPresetName) {
                    throw new Error('Preset name is required for add action');
                }
                if (!scriptsList) {
                    throw new Error('scripts parameter is required for add action (comma-separated script names)');
                }
                return await addScriptsToPreset(actualPresetName, scriptsList, quiet);

            case 'remove':
                if (!actualPresetName) {
                    throw new Error('Preset name is required for remove action');
                }
                if (!scriptsList) {
                    throw new Error('scripts parameter is required for remove action (comma-separated script names)');
                }
                return await removeScriptsFromPreset(actualPresetName, scriptsList, quiet);

            case 'apply':
            default:
                if (!actualPresetName) {
                    // Return current preset if no name provided
                    const current = extension_settings.selected_regex_preset || 'None';
                    !quiet && toastr.info(t`Current regex preset: ${current}`);
                    return current;
                }

                // Check if actualPresetName is a JSON array format
                if (actualPresetName.trim().startsWith('[')) {
                    try {
                        const scriptArray = JSON.parse(actualPresetName);
                        if (Array.isArray(scriptArray)) {
                            await applyScriptNames(scriptArray, othersOff);
                            !quiet && toastr.success(t`Applied regex scripts: ${scriptArray.join(', ')}${othersOff ? ' (others disabled)' : ''}`);
                            return scriptArray.join(', ');
                        }
                    } catch (e) {
                        // Fall through to other checks
                    }
                }

                // First check if it's an existing preset name
                const allPresets = getRegexPresets();
                const existingPreset = allPresets.find(p => equalsIgnoreCaseAndAccents(p.name, actualPresetName));

                if (existingPreset) {
                    // Apply named preset
                    const result = await applyRegexPreset(actualPresetName, othersOff);
                    // Update UI to reflect changes
                    loadRegexPresetsUI();
                    !quiet && toastr.success(t`Applied regex preset: ${result}${othersOff ? ' (others disabled)' : ''}`);
                    return result;
                } else if (actualPresetName.includes(',')) {
                    // Check if it's a comma-separated list of script names (direct activation)
                    const scriptNames = actualPresetName.split(',').map(s => s.trim()).filter(s => s);
                    await applyScriptNames(scriptNames, othersOff);
                    !quiet && toastr.success(t`Applied regex scripts: ${scriptNames.join(', ')}`);
                    return scriptNames.join(', ');
                } else {
                    // Try as single script name (direct activation)
                    const allScripts = getRegexScripts();
                    const scriptExists = allScripts.some(script =>
                        equalsIgnoreCaseAndAccents(script.scriptName, actualPresetName));

                    if (scriptExists) {
                        await applyScriptNames([actualPresetName], othersOff);
                        !quiet && toastr.success(t`Applied regex script: ${actualPresetName}${othersOff ? ' (others disabled)' : ''}`);
                        return actualPresetName;
                    } else {
                        throw new Error(`Neither preset nor script named "${actualPresetName}" found`);
                    }
                }
        }
    } catch (error) {
        const errorMsg = error.message || 'Unknown error occurred';
        !quiet && toastr.error(errorMsg);
        throw new Error(errorMsg);
    }
}

/**
 * Applies script names directly (for /regex-preset with comma-separated names)
 * @param {string[]} scriptNames Array of script names to enable
 * @param {boolean} othersOff Whether to disable all other scripts
 * @returns {Promise<void>}
 */
async function applyScriptNames(scriptNames, othersOff = false) {
    const scripts = getRegexScripts();
    let changesCount = 0;

    for (const script of scripts) {
        const shouldBeEnabled = scriptNames.some(name =>
            equalsIgnoreCaseAndAccents(name, script.scriptName));

        const currentlyEnabled = !script.disabled;

        if (othersOff) {
            const shouldEnable = shouldBeEnabled;
            if (currentlyEnabled !== shouldEnable) {
                script.disabled = !shouldEnable;
                changesCount++;
            }
        } else {
            if (shouldBeEnabled && !currentlyEnabled) {
                script.disabled = false;
                changesCount++;
            }
        }
    }

    if (changesCount > 0) {
        // Save changes for both global and scoped scripts
        const globalScriptIds = new Set((extension_settings.regex ?? []).map(s => s.id));
        const scopedScriptIds = new Set((characters[this_chid]?.data?.extensions?.regex_scripts ?? []).map(s => s.id));

        // Update global scripts
        for (const script of scripts) {
            if (globalScriptIds.has(script.id)) {
                const index = extension_settings.regex.findIndex(s => s.id === script.id);
                if (index !== -1) {
                    extension_settings.regex[index] = script;
                }
            }
        }

        // Update scoped scripts
        if (characters[this_chid]?.data?.extensions?.regex_scripts) {
            for (const script of scripts) {
                if (scopedScriptIds.has(script.id)) {
                    const scopedArray = characters[this_chid].data.extensions.regex_scripts;
                    const index = scopedArray.findIndex(s => s.id === script.id);
                    if (index !== -1) {
                        scopedArray[index] = script;
                    }
                }
            }
            await writeExtensionField(this_chid, 'regex_scripts', characters[this_chid].data.extensions.regex_scripts);
        }

        saveSettingsDebounced();
        await loadRegexScripts();
        await reloadCurrentChat();
    }
}

/**
 * Shows the contents of a preset
 * @param {string} presetName Name of the preset to show
 * @param {boolean} quiet Suppress toast messages
 * @returns {Promise<string>} Preset contents
 */
async function showPresetContents(presetName, quiet = false) {
    const presets = getRegexPresets();
    const preset = presets.find(p => equalsIgnoreCaseAndAccents(p.name, presetName));

    if (!preset) {
        throw new Error(`Regex preset "${presetName}" not found`);
    }

    let result = `Preset "${preset.name}":`;

    const globalScripts = preset.globalScripts ?? [];
    const scopedScripts = preset.scopedScripts ?? [];

    if (globalScripts.length > 0) {
        result += `\nGlobal: ${globalScripts.join(', ')}`;
    }

    if (scopedScripts.length > 0) {
        result += `\nScoped: ${scopedScripts.join(', ')}`;
    }

    if (globalScripts.length === 0 && scopedScripts.length === 0) {
        result += '\nNo scripts in preset';
    }

    !quiet && toastr.info(result);
    return result;
}

/**
 * Edits a preset to contain only specified scripts
 * @param {string} presetName Name of the preset to edit
 * @param {string} scriptsList Comma-separated list of script names
 * @param {boolean} quiet Suppress toast messages
 * @returns {Promise<string>} Result message
 */
async function editPresetScripts(presetName, scriptsList, quiet = false) {
    const presets = getRegexPresets();
    const presetIndex = presets.findIndex(p => equalsIgnoreCaseAndAccents(p.name, presetName));

    if (presetIndex === -1) {
        throw new Error(`Regex preset "${presetName}" not found`);
    }

    const scriptNames = scriptsList.split(',').map(s => s.trim()).filter(s => s);
    const allScripts = getRegexScripts();

    // Validate script names exist
    const invalidScripts = scriptNames.filter(name =>
        !allScripts.some(script => equalsIgnoreCaseAndAccents(script.scriptName, name)));

    if (invalidScripts.length > 0) {
        throw new Error(`Script(s) not found: ${invalidScripts.join(', ')}`);
    }

    // Update preset with new scripts
    const preset = presets[presetIndex];
    const globalScripts = [];
    const scopedScripts = [];

    // Separate global and scoped scripts
    for (const scriptName of scriptNames) {
        const script = allScripts.find(s => equalsIgnoreCaseAndAccents(s.scriptName, scriptName));
        if (script) {
            const isGlobal = (extension_settings.regex || []).some(s => s.id === script.id);
            if (isGlobal) {
                globalScripts.push(scriptName);
            } else {
                scopedScripts.push(scriptName);
            }
        }
    }

    preset.globalScripts = globalScripts;
    preset.scopedScripts = scopedScripts;
    extension_settings.regex_presets = presets;
    saveSettingsDebounced();
    loadRegexPresetsUI();

    const result = `Updated preset "${presetName}" to contain: ${scriptNames.join(', ')}`;
    !quiet && toastr.success(result);
    return result;
}

/**
 * Adds scripts to an existing preset
 * @param {string} presetName Name of the preset to modify
 * @param {string} scriptsList Comma-separated list of script names to add
 * @param {boolean} quiet Suppress toast messages
 * @returns {Promise<string>} Result message
 */
async function addScriptsToPreset(presetName, scriptsList, quiet = false) {
    const presets = getRegexPresets();
    const presetIndex = presets.findIndex(p => equalsIgnoreCaseAndAccents(p.name, presetName));

    if (presetIndex === -1) {
        throw new Error(`Regex preset "${presetName}" not found`);
    }

    const scriptNames = scriptsList.split(',').map(s => s.trim()).filter(s => s);
    const allScripts = getRegexScripts();

    // Validate script names exist
    const invalidScripts = scriptNames.filter(name =>
        !allScripts.some(script => equalsIgnoreCaseAndAccents(script.scriptName, name)));

    if (invalidScripts.length > 0) {
        throw new Error(`Script(s) not found: ${invalidScripts.join(', ')}`);
    }

    // Add new scripts (avoid duplicates)
    const preset = presets[presetIndex];
    const addedScripts = [];

    // Initialize arrays if they don't exist
    preset.globalScripts = preset.globalScripts || [];
    preset.scopedScripts = preset.scopedScripts || [];

    scriptNames.forEach(name => {
        const script = allScripts.find(s => equalsIgnoreCaseAndAccents(s.scriptName, name));
        if (script) {
            const isGlobal = (extension_settings.regex || []).some(s => s.id === script.id);
            const targetArray = isGlobal ? preset.globalScripts : preset.scopedScripts;
            
            if (!targetArray.some(existing => equalsIgnoreCaseAndAccents(existing, name))) {
                targetArray.push(name);
                addedScripts.push(name);
            }
        }
    });

    extension_settings.regex_presets = presets;
    saveSettingsDebounced();
    loadRegexPresetsUI();

    const result = addedScripts.length > 0
        ? `Added ${addedScripts.join(', ')} to preset "${presetName}"`
        : `No new scripts added to preset "${presetName}" (already contained)`;

    !quiet && toastr.success(result);
    return result;
}

/**
 * Removes scripts from an existing preset
 * @param {string} presetName Name of the preset to modify
 * @param {string} scriptsList Comma-separated list of script names to remove
 * @param {boolean} quiet Suppress toast messages
 * @returns {Promise<string>} Result message
 */
async function removeScriptsFromPreset(presetName, scriptsList, quiet = false) {
    const presets = getRegexPresets();
    const presetIndex = presets.findIndex(p => equalsIgnoreCaseAndAccents(p.name, presetName));

    if (presetIndex === -1) {
        throw new Error(`Regex preset "${presetName}" not found`);
    }

    const scriptNames = scriptsList.split(',').map(s => s.trim()).filter(s => s);
    const preset = presets[presetIndex];
    const removedScripts = [];

    // Remove scripts from both global and scoped arrays
    preset.globalScripts = preset.globalScripts || [];
    preset.scopedScripts = preset.scopedScripts || [];
    
    // Remove from global scripts
    const newGlobalScripts = preset.globalScripts.filter(existing => {
        const shouldRemove = scriptNames.some(name => equalsIgnoreCaseAndAccents(existing, name));
        if (shouldRemove) {
            removedScripts.push(existing);
        }
        return !shouldRemove;
    });
    
    // Remove from scoped scripts
    const newScopedScripts = preset.scopedScripts.filter(existing => {
        const shouldRemove = scriptNames.some(name => equalsIgnoreCaseAndAccents(existing, name));
        if (shouldRemove && !removedScripts.includes(existing)) {
            removedScripts.push(existing);
        }
        return !shouldRemove;
    });
    
    preset.globalScripts = newGlobalScripts;
    preset.scopedScripts = newScopedScripts;

    extension_settings.regex_presets = presets;
    saveSettingsDebounced();
    loadRegexPresetsUI();

    const result = removedScripts.length > 0
        ? `Removed ${removedScripts.join(', ')} from preset "${presetName}"`
        : `No scripts removed from preset "${presetName}" (not found in preset)`;

    !quiet && toastr.success(result);
    return result;
}

/**
 * Performs the import of the regex object.
 * @param {Object} regexScript Input object
 * @param {boolean} isScoped Is the script scoped to a character?
 */
async function onRegexImportObjectChange(regexScript, isScoped) {
    try {
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
        toastr.success(t`Regex script "${regexScript.scriptName}" imported.`);
    } catch (error) {
        console.log(error);
        toastr.error(t`Invalid regex object.`);
        return;
    }
}

/**
 * Imports a regex preset from parsed JSON data.
 * @param {Object} data Parsed JSON data
 * @returns {Promise<boolean>} True if preset was imported, false otherwise
 */
async function importRegexPreset(data) {
    if (!data.name || (!data.globalScripts && !data.scopedScripts)) {
        return false;
    }

    const existingPresets = getRegexPresets();
    const existingIndex = existingPresets.findIndex(p =>
        equalsIgnoreCaseAndAccents(p.name, data.name));

    const newPreset = {
        id: uuidv4(),
        name: data.name,
        created: new Date().toISOString(),
    };

    newPreset.includesContent = data.includesContent || false;
    newPreset.exclusive = data.exclusive || false;

    let scriptsCreated = 0;

    // Handle content-based presets
    if (data.globalScriptsContent || data.scopedScriptsContent) {
        // Import actual script content and create missing scripts
        const globalScriptsContent = data.globalScriptsContent || [];
        const scopedScriptsContent = data.scopedScriptsContent || [];

        // Create missing global scripts
        for (const scriptContent of globalScriptsContent) {
            const existingGlobal = (extension_settings.regex || [])
                .find(s => equalsIgnoreCaseAndAccents(s.scriptName, scriptContent.scriptName));

            if (!existingGlobal) {
                // Create new global script
                const newScript = {
                    ...scriptContent,
                    id: uuidv4(), // Generate new ID
                    disabled: true, // Create as disabled initially
                };
                extension_settings.regex = extension_settings.regex || [];
                extension_settings.regex.push(newScript);
                scriptsCreated++;
            }
        }

        // Create missing scoped scripts
        if (characters[this_chid]?.data?.extensions) {
            for (const scriptContent of scopedScriptsContent) {
                const existingScoped = (characters[this_chid].data.extensions.regex_scripts || [])
                    .find(s => equalsIgnoreCaseAndAccents(s.scriptName, scriptContent.scriptName));

                if (!existingScoped) {
                    // Create new scoped script
                    const newScript = {
                        ...scriptContent,
                        id: uuidv4(),
                        disabled: true,
                    };
                    characters[this_chid].data.extensions.regex_scripts =
                        characters[this_chid].data.extensions.regex_scripts || [];
                    characters[this_chid].data.extensions.regex_scripts.push(newScript);
                    scriptsCreated++;
                }
            }

            if (scopedScriptsContent.length > 0) {
                await writeExtensionField(this_chid, 'regex_scripts',
                    characters[this_chid].data.extensions.regex_scripts);
            }
        }

        // Store content in preset
        newPreset.globalScriptsContent = globalScriptsContent;
        newPreset.scopedScriptsContent = scopedScriptsContent;
        newPreset.globalScripts = globalScriptsContent.map(s => s.scriptName);
        newPreset.scopedScripts = scopedScriptsContent.map(s => s.scriptName);
    }
    // Handle reference-based presets
    else if (data.globalScripts || data.scopedScripts) {
        newPreset.globalScripts = data.globalScripts || [];
        newPreset.scopedScripts = data.scopedScripts || [];
    }

    if (existingIndex !== -1) {
        // Preserve original creation date when updating
        newPreset.created = existingPresets[existingIndex].created;
        newPreset.updated = new Date().toISOString();
        existingPresets[existingIndex] = newPreset;
    } else {
        existingPresets.push(newPreset);
    }

    extension_settings.regex_presets = existingPresets;
    saveSettingsDebounced();

    if (scriptsCreated > 0) {
        await loadRegexScripts();
    }

    loadRegexPresetsUI();

    let message = `Imported regex preset "${data.name}"`;
    if (scriptsCreated > 0) {
        message += ` and created ${scriptsCreated} new script(s)`;
    }
    toastr.success(t`${message}.`);
    
    return true;
}

/**
 * Performs the import of a single regex preset file.
 * @param {File} file Input file
 */
async function onRegexImportPresetFileChange(file) {
    if (!file) {
        toastr.error('No file provided.');
        return;
    }

    try {
        const data = JSON.parse(await getFileText(file));

        if (!await importRegexPreset(data)) {
            toastr.error('Invalid preset file format. Expected a single regex preset.');
        }
    } catch (error) {
        console.log(error);
        toastr.error('Invalid JSON file.');
        return;
    }
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
        const data = JSON.parse(await getFileText(file));

        // Check if this is a single preset file
        if (await importRegexPreset(data)) {
            return;
        }

        // Handle regular script imports
        if (Array.isArray(data)) {
            for (const regexScript of data) {
                await onRegexImportObjectChange(regexScript, isScoped);
            }
        } else {
            await onRegexImportObjectChange(data, isScoped);
        }
    } catch (error) {
        console.log(error);
        toastr.error('Invalid JSON file.');
        return;
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
    $('#open_regex_debugger').on('click', onRegexDebuggerOpenClick);
    $('#open_scoped_editor').on('click', function () {
        if (this_chid === undefined) {
            toastr.error(t`No character selected.`);
            return;
        }

        if (selected_group) {
            toastr.error(t`Cannot edit scoped scripts in group chats.`);
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

    // Preset import button handler
    $('#regex_preset_import').on('click', function () {
        $('#import_regex_preset_file').trigger('click');
    });

    $('#import_regex_preset_file').on('change', async function () {
        const inputElement = this instanceof HTMLInputElement && this;
        if (!inputElement.files || inputElement.files.length === 0) return;

        for (const file of inputElement.files) {
            await onRegexImportPresetFileChange(file);
        }
        inputElement.value = '';
    });

    // Regex preset UI event handlers
    $('#regex_preset_select').on('change', async function () {
        const presetName = $(this).val();
        if (presetName) {
            try {
                await applyRegexPreset(presetName);
                // Refresh UI to show updated script states
                await loadRegexScripts();
                loadRegexPresetsUI();
                toastr.success(t`Applied regex preset: ${presetName}`);
            } catch (error) {
                toastr.error(error.message);
                // Reset select to previous value
                $(this).val(extension_settings.selected_regex_preset || '');
            }
        } else {
            extension_settings.selected_regex_preset = null;
            $('#regex_preset_exclusive').prop('checked', false);
            saveSettingsDebounced();
            loadRegexPresetsUI();
        }
    });

    // Handle exclusive checkbox changes
    $('#regex_preset_exclusive').on('change', async function () {
        const presetName = $('#regex_preset_select').val();
        if (!presetName) return;

        const isExclusive = $(this).prop('checked');
        const presets = getRegexPresets();
        const presetIndex = presets.findIndex(p => equalsIgnoreCaseAndAccents(p.name, presetName));

        if (presetIndex !== -1) {
            presets[presetIndex].exclusive = isExclusive;
            extension_settings.regex_presets = presets;
            saveSettingsDebounced();
            loadRegexPresetsUI();
            
            const msg = isExclusive ? 'enabled' : 'disabled';
            toastr.success(t`Exclusive mode ${msg} for preset "${presetName}"`);
        }
    });

    $('#regex_preset_create').on('click', async function () {
        const name = await callGenericPopup('Enter preset name:', POPUP_TYPE.INPUT);
        if (!name) return;

        const isExclusive = $('#regex_preset_exclusive').prop('checked');
        
        try {
            await createRegexPreset(name, false, isExclusive);
            loadRegexPresetsUI();
            $('#regex_preset_select').val(name);
            const exclusiveText = isExclusive ? ' (exclusive)' : '';
            toastr.success(t`Created regex preset: ${name}${exclusiveText}`);
        } catch (error) {
            toastr.error(error.message);
        }
    });

    $('#regex_preset_delete').on('click', async function () {
        const presetName = $('#regex_preset_select').val();
        if (!presetName) {
            toastr.warning('No preset selected to delete');
            return;
        }

        const confirm = await callGenericPopup(`Delete regex preset "${presetName}"?`, POPUP_TYPE.CONFIRM);
        if (!confirm) return;

        try {
            await deleteRegexPreset(presetName);
            loadRegexPresetsUI();
            toastr.success(t`Deleted regex preset: ${presetName}`);
        } catch (error) {
            toastr.error(error.message);
        }
    });

    $('#regex_preset_save').on('click', async function () {
        const currentPreset = $('#regex_preset_select').val();
        let name = currentPreset;

        if (!name) {
            name = await callGenericPopup('Enter preset name to save current state:', POPUP_TYPE.INPUT);
        } else {
            const confirm = await callGenericPopup(`Save current state to preset "${name}"? This will overwrite the existing preset.`, POPUP_TYPE.CONFIRM);
            if (!confirm) {
                name = await callGenericPopup('Enter new preset name:', POPUP_TYPE.INPUT);
            }
        }

        if (!name) return;

        const isExclusive = $('#regex_preset_exclusive').prop('checked');

        try {
            await saveCurrentStateToPreset(name, false, isExclusive);
            loadRegexPresetsUI();
            $('#regex_preset_select').val(name);
            const exclusiveText = isExclusive ? ' (exclusive)' : '';
            toastr.success(t`Current state saved to preset: ${name}${exclusiveText}`);
        } catch (error) {
            toastr.error(error.message);
        }
    });

    // Export preset (references only)
    $('#regex_preset_export').on('click', async function () {
        const presetName = $('#regex_preset_select').val();
        if (!presetName) {
            toastr.warning('No preset selected to export');
            return;
        }

        const presets = getRegexPresets();
        const preset = presets.find(p => equalsIgnoreCaseAndAccents(p.name, presetName));
        
        if (!preset) {
            toastr.error('Preset not found');
            return;
        }

        const exportData = {
            name: preset.name,
            globalScripts: preset.globalScripts || [],
            scopedScripts: preset.scopedScripts || [],
            exclusive: preset.exclusive || false,
            created: preset.created,
            updated: preset.updated,
            exported: new Date().toISOString(),
            version: '1.0',
            type: 'references',
        };

        const fileName = `regex-preset-${sanitizeFileName(preset.name)}-ref.json`;
        const fileData = JSON.stringify(exportData, null, 4);
        download(fileData, fileName, 'application/json');
        toastr.success(`Exported regex preset "${preset.name}" (references only)`);
    });

    // Export preset with full content
    $('#regex_preset_export_content').on('click', async function () {
        const presetName = $('#regex_preset_select').val();
        if (!presetName) {
            toastr.warning('No preset selected to export');
            return;
        }

        const presets = getRegexPresets();
        const preset = presets.find(p => equalsIgnoreCaseAndAccents(p.name, presetName));
        
        if (!preset) {
            toastr.error('Preset not found');
            return;
        }

        // Create content-based preset
        const contentPreset = {
            name: preset.name,
            created: preset.created,
            updated: preset.updated,
            includesContent: true,
            exclusive: preset.exclusive || false,
            exported: new Date().toISOString(),
            version: '1.0',
            type: 'content',
        };

        // Get full content for global scripts
        const globalScripts = preset.globalScripts || [];
        contentPreset.globalScriptsContent = globalScripts
            .map(scriptName => {
                const script = (extension_settings.regex || [])
                    .find(s => equalsIgnoreCaseAndAccents(s.scriptName, scriptName));
                return script ? {
                    ...script,
                    disabled: false, // Export as enabled in preset
                } : null;
            })
            .filter(script => script !== null);

        // Get full content for scoped scripts
        const scopedScripts = preset.scopedScripts || [];
        contentPreset.scopedScriptsContent = scopedScripts
            .map(scriptName => {
                const script = (characters[this_chid]?.data?.extensions?.regex_scripts || [])
                    .find(s => equalsIgnoreCaseAndAccents(s.scriptName, scriptName));
                return script ? {
                    ...script,
                    disabled: false,
                } : null;
            })
            .filter(script => script !== null);

        // Keep references for compatibility
        contentPreset.globalScripts = globalScripts;
        contentPreset.scopedScripts = scopedScripts;

        const fileName = `regex-preset-${sanitizeFileName(preset.name)}-full.json`;
        const fileData = JSON.stringify(contentPreset, null, 4);
        download(fileData, fileName, 'application/json');
        toastr.success(`Exported regex preset "${preset.name}" with full content`);
    });

    function getSelectedScripts() {
        const scripts = getRegexScripts();
        const selector = '#regex_container .regex-script-label:has(.regex_bulk_checkbox:checked)';
        const selectedIds = Array.from(document.querySelectorAll(selector)).map(e => e.getAttribute('id')).filter(id => id);
        return scripts.filter(script => selectedIds.includes(script.id));
    }

    $('#bulk_select_all_toggle').on('click', async function () {
        const checkboxes = $('#regex_container .regex_bulk_checkbox');
        if (checkboxes.length === 0) {
            return;
        }

        const allAreChecked = checkboxes.length === checkboxes.filter(':checked').length;
        const newState = !allAreChecked; // true if we just checked all, false if we just unchecked all

        checkboxes.prop('checked', newState);
        setToggleAllIcon(newState);
    });

    $('#bulk_enable_regex').on('click', async function () {
        const scripts = getSelectedScripts().filter(script => script.disabled);
        if (scripts.length === 0) {
            toastr.warning(t`No regex scripts selected for enabling.`);
            return;
        }
        for (const script of scripts) {
            script.disabled = false;
        }
        saveSettingsDebounced();
        await loadRegexScripts();
    });

    $('#bulk_disable_regex').on('click', async function () {
        const scripts = getSelectedScripts().filter(script => !script.disabled);
        if (scripts.length === 0) {
            toastr.warning(t`No regex scripts selected for disabling.`);
            return;
        }
        for (const script of scripts) {
            script.disabled = true;
        }
        saveSettingsDebounced();
        await loadRegexScripts();
    });

    $('#bulk_delete_regex').on('click', async function () {
        const scripts = getSelectedScripts();
        if (scripts.length === 0) {
            toastr.warning(t`No regex scripts selected for deletion.`);
            return;
        }
        const confirm = await callGenericPopup('Are you sure you want to delete the selected regex scripts?', POPUP_TYPE.CONFIRM);
        if (!confirm) {
            return;
        }
        for (const script of scripts) {
            const isScoped = characters[this_chid]?.data?.extensions?.regex_scripts?.some(s => s.id === script.id);
            await deleteRegexScript({ id: script.id, isScoped: isScoped });
        }
        await reloadCurrentChat();
        saveSettingsDebounced();
    });

    $('#bulk_export_regex').on('click', async function () {
        const scripts = getSelectedScripts();
        if (scripts.length === 0) {
            toastr.warning(t`No regex scripts selected for export.`);
            return;
        }
        const fileName = `regex-${new Date().toISOString()}.json`;
        const fileData = JSON.stringify(scripts, null, 4);
        download(fileData, fileName, 'application/json');
        await loadRegexScripts();
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
        // @ts-ignore
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
            toastr.error(t`No character selected.`);
            return;
        }

        if (selected_group) {
            toastr.error(t`Cannot edit scoped scripts in group chats.`);
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
    // @ts-ignore
    $('#saved_regex_scripts').sortable('enable');

    const localEnumProviders = {
        regexScripts: () => getRegexScripts().map(script => {
            const isGlobal = extension_settings.regex?.some(x => x.scriptName === script.scriptName);
            return new SlashCommandEnumValue(script.scriptName, `${enumIcons.getStateIcon(!script.disabled)} [${isGlobal ? 'global' : 'scoped'}] ${script.findRegex}`,
                isGlobal ? enumTypes.enum : enumTypes.name, isGlobal ? 'G' : 'S');
        }),
        regexPresets: () => getRegexPresets().map(preset => {
            let description = '';
            const globalScripts = preset.globalScripts ?? [];
            const scopedScripts = preset.scopedScripts ?? [];

            if (globalScripts.length > 0) {
                description += `G:${globalScripts.join(',')}`;
            }
            if (scopedScripts.length > 0) {
                if (description) description += ' ';
                description += `S:${scopedScripts.join(',')}`;
            }
            if (!description) {
                description = 'Empty preset';
            }

            // Add exclusive indicator
            if (preset.exclusive) {
                description += ' [EXCL]';
            }

            return new SlashCommandEnumValue(preset.name, description, enumTypes.enum, 'P');
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
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'regex-toggle',
        callback: toggleRegexCallback,
        returns: 'The name of the script that was toggled',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'state',
                description: 'Explicitly set the state of the script (\'on\' to enable, \'off\' to disable). If not provided, the state will be toggled to the opposite of the current state.',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'toggle',
                enumList: commonEnumProviders.boolean('onOffToggle')(),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'quiet',
                description: 'Suppress the toast message script toggled',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'false',
                enumList: commonEnumProviders.boolean('trueFalse')(),
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'script name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: localEnumProviders.regexScripts,
            }),
        ],
        helpString: `
            <div>
                Toggles the state of a specified regex script.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/regex-toggle MyScript</code></pre>
                    </li>
                    <li>
                        <pre><code class="language-stscript">/regex-toggle state=off Character-specific Script</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'regex-preset',
        callback: regexPresetCallback,
        returns: 'Preset name or result message',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'action',
                description: 'Action to perform: apply (default), create, save, delete, list, show, edit, add, remove',
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: 'apply',
                enumList: [
                    new SlashCommandEnumValue('apply', 'Apply a preset or script names', enumTypes.enum),
                    new SlashCommandEnumValue('create', 'Create a new preset from current enabled scripts', enumTypes.enum),
                    new SlashCommandEnumValue('save', 'Save current UI state to preset (overwrites)', enumTypes.enum),
                    new SlashCommandEnumValue('delete', 'Delete an existing preset', enumTypes.enum),
                    new SlashCommandEnumValue('list', 'List all available presets', enumTypes.enum),
                    new SlashCommandEnumValue('show', 'Show contents of a preset', enumTypes.enum),
                    new SlashCommandEnumValue('edit', 'Replace preset contents with specified scripts', enumTypes.enum),
                    new SlashCommandEnumValue('add', 'Add scripts to existing preset', enumTypes.enum),
                    new SlashCommandEnumValue('remove', 'Remove scripts from existing preset', enumTypes.enum),
                ],
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'scripts',
                description: 'Comma-separated list of script names (for edit/add/remove actions)',
                typeList: [ARGUMENT_TYPE.STRING],
                enumProvider: localEnumProviders.regexScripts,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'exclusive',
                description: 'Make preset exclusive (auto-disable others when applied)',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'false',
                enumList: commonEnumProviders.boolean('trueFalse')(),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'content',
                description: 'Include full script content when creating/saving presets',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'false',
                enumList: [
                    new SlashCommandEnumValue('true', 'Include full script content in preset', enumTypes.enum),
                    new SlashCommandEnumValue('false', 'Only include script names (references)', enumTypes.enum),
                ],
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'others',
                description: 'When applying preset, set to "off" to disable all other scripts',
                typeList: [ARGUMENT_TYPE.STRING],
                enumList: [
                    new SlashCommandEnumValue('off', 'Disable all other scripts when applying preset', enumTypes.enum),
                ],
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'quiet',
                description: 'Suppress toast messages',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'false',
                enumList: commonEnumProviders.boolean('trueFalse')(),
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Preset name or comma-separated script names',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                enumProvider: localEnumProviders.regexPresets,
            }),
        ],
        helpString: `
            <div>
                Manages regex presets - groups of enabled/disabled regex scripts.
            </div>
            <div>
                <strong>Examples:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/regex-preset MyPreset</code></pre>
                        <small>Apply a saved preset</small>
                    </li>
                    <li>
                        <pre><code class="language-stscript">/regex-preset ["script1", "script2"] others=off</code></pre>
                        <small>Enable specific scripts using array format and disable all others</small>
                    </li>
                    <li>
                        <pre><code class="language-stscript">/regex-preset script1,script2,script3 others=off</code></pre>
                        <small>Enable specific scripts using comma format and disable all others</small>
                    </li>
                    <li>
                        <pre><code class="language-stscript">/regex-preset action=create MyPreset</code></pre>
                        <small>Create a preset from currently enabled scripts (references only)</small>
                    </li>
                    <li>
                        <pre><code class="language-stscript">/regex-preset action=create MyPreset content=true</code></pre>
                        <small>Create a preset with full script content</small>
                    </li>
                    <li>
                        <pre><code class="language-stscript">/regex-preset action=save MyPreset content=true</code></pre>
                        <small>Save current UI state with full content (overwrites existing)</small>
                    </li>
                    <li>
                        <pre><code class="language-stscript">/regex-preset action=show MyPreset</code></pre>
                        <small>Show which scripts are in a preset</small>
                    </li>
                    <li>
                        <pre><code class="language-stscript">/regex-preset action=edit MyPreset scripts=["script1", "script2"]</code></pre>
                        <small>Replace preset contents with specified scripts (array format)</small>
                    </li>
                    <li>
                        <pre><code class="language-stscript">/regex-preset action=edit MyPreset scripts=script1,script2</code></pre>
                        <small>Replace preset contents with specified scripts (comma format)</small>
                    </li>
                    <li>
                        <pre><code class="language-stscript">/regex-preset action=add MyPreset scripts=newScript</code></pre>
                        <small>Add scripts to existing preset</small>
                    </li>
                    <li>
                        <pre><code class="language-stscript">/regex-preset action=remove MyPreset scripts=oldScript</code></pre>
                        <small>Remove scripts from existing preset</small>
                    </li>
                    <li>
                        <pre><code class="language-stscript">/regex-preset action=list</code></pre>
                        <small>List all available presets</small>
                    </li>
                </ul>
            </div>
        `,
    }));

    eventSource.on(event_types.CHAT_CHANGED, checkEmbeddedRegexScripts);
    eventSource.on(event_types.CHARACTER_DELETED, purgeEmbeddedRegexScripts);
});
