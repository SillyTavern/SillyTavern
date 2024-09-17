import { saveSettingsDebounced } from '../script.js';
import { power_user } from './power-user.js';
import { resetScrollHeight } from './utils.js';

export let system_prompts = [];

const $enabled = $('#sysprompt_enabled');
const $select = $('#sysprompt_select');
const $content = $('#sysprompt_content');
const $contentBlock = $('#SystemPromptBlock');

function migrateSystemPromptFromInstructMode() {
    if ('system_prompt' in power_user.instruct) {
        power_user.sysprompt.enabled = power_user.instruct.enabled;
        power_user.sysprompt.content = String(power_user.instruct.system_prompt);
        delete power_user.instruct.system_prompt;

        if (system_prompts.some(x => x.name === power_user.instruct.preset)) {
            power_user.sysprompt.name = power_user.instruct.preset;
        }

        saveSettingsDebounced();
        toastr.info('System prompt settings have been moved from the Instruct Mode.', 'Migration notice', { timeOut: 5000 });
    }
}

/**
 * Loads sysprompt settings from the given data object.
 * @param {object} data Settings data object.
 */
export async function loadSystemPrompts(data) {
    if (data.instruct !== undefined) {
        system_prompts = data.sysprompt;
    }

    migrateSystemPromptFromInstructMode();
    toggleSyspromptDisabledControls();

    for (const prompt of system_prompts) {
        $('<option>').val(prompt.name).text(prompt.name).appendTo($select);
    }

    $enabled.prop('checked', power_user.sysprompt.enabled);
    $select.val(power_user.sysprompt.name);
    $content.val(power_user.sysprompt.content);
    if (!CSS.supports('field-sizing', 'content')) {
        await resetScrollHeight($content);
    }
}

function toggleSyspromptDisabledControls() {
    $enabled.parent().find('i').toggleClass('toggleEnabled', !!power_user.sysprompt.enabled);
    $contentBlock.toggleClass('disabled', !power_user.sysprompt.enabled);
}

jQuery(function () {
    $enabled.on('input', function () {
        power_user.sysprompt.enabled = !!$(this).prop('checked');
        toggleSyspromptDisabledControls();
        saveSettingsDebounced();
    });

    $select.on('input', async function () {
        const name = String($(this).val());
        const prompt = system_prompts.find(p => p.name === name);
        if (prompt) {
            $content.val(prompt.content);
            if (!CSS.supports('field-sizing', 'content')) {
                await resetScrollHeight($content);
            }

            power_user.sysprompt.name = name;
            power_user.sysprompt.content = prompt.content;
        }
        saveSettingsDebounced();
    });

    $content.on('input', function () {
        power_user.sysprompt.content = String($(this).val());
        saveSettingsDebounced();
    });
});
