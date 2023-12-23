'use strict';

import { saveSettingsDebounced, substituteParams } from '../script.js';
import { selected_group } from './group-chats.js';
import {
    power_user,
    context_presets,
} from './power-user.js';
import { resetScrollHeight } from './utils.js';

/**
 * @type {any[]} Instruct mode presets.
 */
export let instruct_presets = [];

const controls = [
    { id: 'instruct_enabled', property: 'enabled', isCheckbox: true },
    { id: 'instruct_wrap', property: 'wrap', isCheckbox: true },
    { id: 'instruct_system_prompt', property: 'system_prompt', isCheckbox: false },
    { id: 'instruct_system_sequence_prefix', property: 'system_sequence_prefix', isCheckbox: false },
    { id: 'instruct_system_sequence_suffix', property: 'system_sequence_suffix', isCheckbox: false },
    { id: 'instruct_separator_sequence', property: 'separator_sequence', isCheckbox: false },
    { id: 'instruct_input_sequence', property: 'input_sequence', isCheckbox: false },
    { id: 'instruct_output_sequence', property: 'output_sequence', isCheckbox: false },
    { id: 'instruct_stop_sequence', property: 'stop_sequence', isCheckbox: false },
    { id: 'instruct_names', property: 'names', isCheckbox: true },
    { id: 'instruct_macro', property: 'macro', isCheckbox: true },
    { id: 'instruct_names_force_groups', property: 'names_force_groups', isCheckbox: true },
    { id: 'instruct_first_output_sequence', property: 'first_output_sequence', isCheckbox: false },
    { id: 'instruct_last_output_sequence', property: 'last_output_sequence', isCheckbox: false },
    { id: 'instruct_activation_regex', property: 'activation_regex', isCheckbox: false },
    { id: 'instruct_bind_to_context', property: 'bind_to_context', isCheckbox: true },
];

/**
 * Loads instruct mode settings from the given data object.
 * @param {object} data Settings data object.
 */
export function loadInstructMode(data) {
    if (data.instruct !== undefined) {
        instruct_presets = data.instruct;
    }

    if (power_user.instruct.names_force_groups === undefined) {
        power_user.instruct.names_force_groups = true;
    }

    controls.forEach(control => {
        const $element = $(`#${control.id}`);

        if (control.isCheckbox) {
            $element.prop('checked', power_user.instruct[control.property]);
        } else {
            $element.val(power_user.instruct[control.property]);
        }

        $element.on('input', function () {
            power_user.instruct[control.property] = control.isCheckbox ? !!$(this).prop('checked') : $(this).val();
            saveSettingsDebounced();
            if (!control.isCheckbox) {
                resetScrollHeight($element);
            }
        });
    });

    instruct_presets.forEach((preset) => {
        const name = preset.name;
        const option = document.createElement('option');
        option.value = name;
        option.innerText = name;
        option.selected = name === power_user.instruct.preset;
        $('#instruct_presets').append(option);
    });

    highlightDefaultPreset();
}

function highlightDefaultPreset() {
    $('#instruct_set_default').toggleClass('default', power_user.default_instruct === power_user.instruct.preset);
}

/**
 * Select context template if not already selected.
 * @param {string} preset Preset name.
 */
function selectContextPreset(preset) {
    // If context template is not already selected, select it
    if (preset !== power_user.context.preset) {
        $('#context_presets').val(preset).trigger('change');
        toastr.info(`Context Template: preset "${preset}" auto-selected`);
    }

    // If instruct mode is disabled, enable it, except for default context template
    if (!power_user.instruct.enabled && preset !== power_user.default_context) {
        power_user.instruct.enabled = true;
        $('#instruct_enabled').prop('checked', true).trigger('change');
        toastr.info('Instruct Mode enabled');
    }

    saveSettingsDebounced();
}

/**
 * Select instruct preset if not already selected.
 * @param {string} preset Preset name.
 */
export function selectInstructPreset(preset) {
    // If instruct preset is not already selected, select it
    if (preset !== power_user.instruct.preset) {
        $('#instruct_presets').val(preset).trigger('change');
        toastr.info(`Instruct Mode: preset "${preset}" auto-selected`);
    }

    // If instruct mode is disabled, enable it
    if (!power_user.instruct.enabled) {
        power_user.instruct.enabled = true;
        $('#instruct_enabled').prop('checked', true).trigger('change');
        toastr.info('Instruct Mode enabled');
    }

    saveSettingsDebounced();
}

/**
 * Automatically select instruct preset based on model id.
 * Otherwise, if default instruct preset is set, selects it.
 * @param {string} modelId Model name reported by the API.
 * @returns {boolean} True if instruct preset was activated by model id, false otherwise.
 */
export function autoSelectInstructPreset(modelId) {
    // If instruct mode is disabled, don't do anything
    if (!power_user.instruct.enabled) {
        return false;
    }

    // Select matching instruct preset
    let foundMatch = false;
    for (const instruct_preset of instruct_presets) {
        // If instruct preset matches the context template
        if (power_user.instruct.bind_to_context && instruct_preset.name === power_user.context.preset) {
            foundMatch = true;
            selectInstructPreset(instruct_preset.name);
            break;
        }
    }
    // If no match was found, auto-select instruct preset
    if (!foundMatch) {
        for (const preset of instruct_presets) {
            // If activation regex is set, check if it matches the model id
            if (preset.activation_regex) {
                try {
                    const regex = new RegExp(preset.activation_regex, 'i');

                    // Stop on first match so it won't cycle back and forth between presets if multiple regexes match
                    if (regex.test(modelId)) {
                        selectInstructPreset(preset.name);

                        return true;
                    }
                } catch {
                    // If regex is invalid, ignore it
                    console.warn(`Invalid instruct activation regex in preset "${preset.name}"`);
                }
            }
        }

        if (power_user.instruct.bind_to_context && power_user.default_instruct && power_user.instruct.preset !== power_user.default_instruct) {
            if (instruct_presets.some(p => p.name === power_user.default_instruct)) {
                console.log(`Instruct mode: default preset "${power_user.default_instruct}" selected`);
                $('#instruct_presets').val(power_user.default_instruct).trigger('change');
            }
        }
    }

    return false;
}

/**
 * Converts instruct mode sequences to an array of stopping strings.
 * @returns {string[]} Array of instruct mode stopping strings.
 */
export function getInstructStoppingSequences() {
    /**
     * Adds instruct mode sequence to the result array.
     * @param {string} sequence Sequence string.
     * @returns {void}
     */
    function addInstructSequence(sequence) {
        // Cohee: oobabooga's textgen always appends newline before the sequence as a stopping string
        // But it's a problem for Metharme which doesn't use newlines to separate them.
        const wrap = (s) => power_user.instruct.wrap ? '\n' + s : s;
        // Sequence must be a non-empty string
        if (typeof sequence === 'string' && sequence.length > 0) {
            // If sequence is just a whitespace or newline - we don't want to make it a stopping string
            // User can always add it as a custom stop string if really needed
            if (sequence.trim().length > 0) {
                const wrappedSequence = wrap(sequence);
                // Need to respect "insert macro" setting
                const stopString = power_user.instruct.macro ? substituteParams(wrappedSequence) : wrappedSequence;
                result.push(stopString);
            }
        }
    }

    const result = [];

    if (power_user.instruct.enabled) {
        const input_sequence = power_user.instruct.input_sequence;
        const output_sequence = power_user.instruct.output_sequence;
        const first_output_sequence = power_user.instruct.first_output_sequence;
        const last_output_sequence = power_user.instruct.last_output_sequence;

        const combined_sequence = `${input_sequence}\n${output_sequence}\n${first_output_sequence}\n${last_output_sequence}`;

        combined_sequence.split('\n').filter((line, index, self) => self.indexOf(line) === index).forEach(addInstructSequence);
    }

    if (power_user.context.use_stop_strings) {
        if (power_user.context.chat_start) {
            result.push(`\n${substituteParams(power_user.context.chat_start)}`);
        }

        if (power_user.context.example_separator) {
            result.push(`\n${substituteParams(power_user.context.example_separator)}`);
        }
    }

    return result;
}

export const force_output_sequence = {
    FIRST: 1,
    LAST: 2,
};

/**
 * Formats instruct mode chat message.
 * @param {string} name Character name.
 * @param {string} mes Message text.
 * @param {boolean} isUser Is the message from the user.
 * @param {boolean} isNarrator Is the message from the narrator.
 * @param {string} forceAvatar Force avatar string.
 * @param {string} name1 User name.
 * @param {string} name2 Character name.
 * @param {boolean|number} forceOutputSequence Force to use first/last output sequence (if configured).
 * @returns {string} Formatted instruct mode chat message.
 */
export function formatInstructModeChat(name, mes, isUser, isNarrator, forceAvatar, name1, name2, forceOutputSequence) {
    let includeNames = isNarrator ? false : power_user.instruct.names;

    if (!isNarrator && power_user.instruct.names_force_groups && (selected_group || forceAvatar)) {
        includeNames = true;
    }

    let sequence = (isUser || isNarrator) ? power_user.instruct.input_sequence : power_user.instruct.output_sequence;

    if (forceOutputSequence && sequence === power_user.instruct.output_sequence) {
        if (forceOutputSequence === force_output_sequence.FIRST && power_user.instruct.first_output_sequence) {
            sequence = power_user.instruct.first_output_sequence;
        } else if (forceOutputSequence === force_output_sequence.LAST && power_user.instruct.last_output_sequence) {
            sequence = power_user.instruct.last_output_sequence;
        }
    }

    if (power_user.instruct.macro) {
        sequence = substituteParams(sequence, name1, name2);
    }

    const separator = power_user.instruct.wrap ? '\n' : '';
    const separatorSequence = power_user.instruct.separator_sequence && !isUser
        ? power_user.instruct.separator_sequence
        : separator;
    const textArray = includeNames ? [sequence, `${name}: ${mes}` + separatorSequence] : [sequence, mes + separatorSequence];
    const text = textArray.filter(x => x).join(separator);
    return text;
}

/**
 * Formats instruct mode system prompt.
 * @param {string} systemPrompt System prompt string.
 * @returns {string} Formatted instruct mode system prompt.
 */
export function formatInstructModeSystemPrompt(systemPrompt){
    const separator = power_user.instruct.wrap ? '\n' : '';

    if (power_user.instruct.system_sequence_prefix) {
        systemPrompt = power_user.instruct.system_sequence_prefix + separator + systemPrompt;
    }

    if (power_user.instruct.system_sequence_suffix) {
        systemPrompt = systemPrompt + separator + power_user.instruct.system_sequence_suffix;
    }

    return systemPrompt;
}

/**
 * Formats example messages according to instruct mode settings.
 * @param {string} mesExamples Example messages string.
 * @param {string} name1 User name.
 * @param {string} name2 Character name.
 * @returns {string} Formatted example messages string.
 */
export function formatInstructModeExamples(mesExamples, name1, name2) {
    const includeNames = power_user.instruct.names || (!!selected_group && power_user.instruct.names_force_groups);

    let inputSequence = power_user.instruct.input_sequence;
    let outputSequence = power_user.instruct.output_sequence;

    if (power_user.instruct.macro) {
        inputSequence = substituteParams(inputSequence, name1, name2);
        outputSequence = substituteParams(outputSequence, name1, name2);
    }

    const separator = power_user.instruct.wrap ? '\n' : '';
    const separatorSequence = power_user.instruct.separator_sequence ? power_user.instruct.separator_sequence : separator;

    mesExamples = mesExamples.replace(new RegExp(`\n${name1}: `, 'gm'), separatorSequence + inputSequence + separator + (includeNames ? `${name1}: ` : ''));
    mesExamples = mesExamples.replace(new RegExp(`\n${name2}: `, 'gm'), separator + outputSequence + separator + (includeNames ? `${name2}: ` : ''));

    return mesExamples;
}

/**
 * Formats instruct mode last prompt line.
 * @param {string} name Character name.
 * @param {boolean} isImpersonate Is generation in impersonation mode.
 * @param {string} promptBias Prompt bias string.
 * @param {string} name1 User name.
 * @param {string} name2 Character name.
 * @returns {string} Formatted instruct mode last prompt line.
 */
export function formatInstructModePrompt(name, isImpersonate, promptBias, name1, name2) {
    const includeNames = power_user.instruct.names || (!!selected_group && power_user.instruct.names_force_groups);
    const getOutputSequence = () => power_user.instruct.last_output_sequence || power_user.instruct.output_sequence;
    let sequence = isImpersonate ? power_user.instruct.input_sequence : getOutputSequence();

    if (power_user.instruct.macro) {
        sequence = substituteParams(sequence, name1, name2);
    }

    const separator = power_user.instruct.wrap ? '\n' : '';
    let text = includeNames ? (separator + sequence + separator + `${name}:`) : (separator + sequence);

    if (!isImpersonate && promptBias) {
        text += (includeNames ? promptBias : (separator + promptBias));
    }

    return (power_user.instruct.wrap ? text.trimEnd() : text) + (includeNames ? '' : separator);
}

/**
 * Select context template matching instruct preset.
 * @param {string} name Preset name.
 */
function selectMatchingContextTemplate(name) {
    let foundMatch = false;
    for (const context_preset of context_presets) {
        // If context template matches the instruct preset
        if (context_preset.name === name) {
            foundMatch = true;
            selectContextPreset(context_preset.name);
            break;
        }
    }
    if (!foundMatch) {
        // If no match was found, select default context preset
        selectContextPreset(power_user.default_context);
    }
}

/**
 * Replaces instruct mode macros in the given input string.
 * @param {string} input Input string.
 * @returns {string} String with macros replaced.
 */
export function replaceInstructMacros(input) {
    if (!input) {
        return '';
    }

    input = input.replace(/{{instructSystem}}/gi, power_user.instruct.enabled ? power_user.instruct.system_prompt : '');
    input = input.replace(/{{instructSystemPrefix}}/gi, power_user.instruct.enabled ? power_user.instruct.system_sequence_prefix : '');
    input = input.replace(/{{instructSystemSuffix}}/gi, power_user.instruct.enabled ? power_user.instruct.system_sequence_suffix : '');
    input = input.replace(/{{instructInput}}/gi, power_user.instruct.enabled ? power_user.instruct.input_sequence : '');
    input = input.replace(/{{instructOutput}}/gi, power_user.instruct.enabled ? power_user.instruct.output_sequence : '');
    input = input.replace(/{{instructFirstOutput}}/gi, power_user.instruct.enabled ? (power_user.instruct.first_output_sequence || power_user.instruct.output_sequence) : '');
    input = input.replace(/{{instructLastOutput}}/gi, power_user.instruct.enabled ? (power_user.instruct.last_output_sequence || power_user.instruct.output_sequence) : '');
    input = input.replace(/{{instructSeparator}}/gi, power_user.instruct.enabled ? power_user.instruct.separator_sequence : '');
    input = input.replace(/{{instructStop}}/gi, power_user.instruct.enabled ? power_user.instruct.stop_sequence : '');
    input = input.replace(/{{exampleSeparator}}/gi, power_user.context.example_separator);
    input = input.replace(/{{chatStart}}/gi, power_user.context.chat_start);

    return input;
}

jQuery(() => {
    $('#instruct_set_default').on('click', function () {
        if (power_user.instruct.preset === power_user.default_instruct) {
            power_user.default_instruct = null;
            $(this).removeClass('default');
            toastr.info('Default instruct preset cleared');
        } else {
            power_user.default_instruct = power_user.instruct.preset;
            $(this).addClass('default');
            toastr.info(`Default instruct preset set to ${power_user.default_instruct}`);
        }

        saveSettingsDebounced();
    });

    $('#instruct_enabled').on('change', function () {
        if (!power_user.instruct.bind_to_context) {
            return;
        }

        // When instruct mode gets enabled, select context template matching selected instruct preset
        if (power_user.instruct.enabled) {
            selectMatchingContextTemplate(power_user.instruct.preset);
        // When instruct mode gets disabled, select default context preset
        } else {
            selectContextPreset(power_user.default_context);
        }
    });

    $('#instruct_presets').on('change', function () {
        const name = String($(this).find(':selected').val());
        const preset = instruct_presets.find(x => x.name === name);

        if (!preset) {
            return;
        }

        power_user.instruct.preset = String(name);
        controls.forEach(control => {
            if (preset[control.property] !== undefined) {
                power_user.instruct[control.property] = preset[control.property];
                const $element = $(`#${control.id}`);

                if (control.isCheckbox) {
                    $element.prop('checked', power_user.instruct[control.property]).trigger('input');
                } else {
                    $element.val(power_user.instruct[control.property]).trigger('input');
                }
            }
        });

        if (power_user.instruct.bind_to_context) {
            // Select matching context template
            selectMatchingContextTemplate(name);
        }

        highlightDefaultPreset();
    });
});
