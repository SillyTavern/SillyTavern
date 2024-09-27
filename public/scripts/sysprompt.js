import { saveSettingsDebounced } from '../script.js';
import { callGenericPopup, POPUP_TYPE } from './popup.js';
import { power_user } from './power-user.js';
import { getPresetManager } from './preset-manager.js';
import { SlashCommand } from './slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from './slash-commands/SlashCommandArgument.js';
import { commonEnumProviders, enumIcons } from './slash-commands/SlashCommandCommonEnumsProvider.js';
import { enumTypes, SlashCommandEnumValue } from './slash-commands/SlashCommandEnumValue.js';
import { SlashCommandParser } from './slash-commands/SlashCommandParser.js';
import { renderTemplateAsync } from './templates.js';
import { isTrueBoolean, resetScrollHeight } from './utils.js';

export let system_prompts = [];

const $enabled = $('#sysprompt_enabled');
const $select = $('#sysprompt_select');
const $content = $('#sysprompt_content');
const $contentBlock = $('#SystemPromptBlock');

async function migrateSystemPromptFromInstructMode() {
    if ('system_prompt' in power_user.instruct) {
        const prompt = String(power_user.instruct.system_prompt);
        delete power_user.instruct.system_prompt;
        power_user.sysprompt.enabled = power_user.instruct.enabled;
        power_user.sysprompt.content = prompt;

        const existingPromptName = system_prompts.find(x => x.content === prompt)?.name;

        if (existingPromptName) {
            power_user.sysprompt.name = existingPromptName;
        } else {
            const data = { name: `[Migrated] ${power_user.instruct.preset}`, content: prompt };
            await getPresetManager('sysprompt')?.savePreset(data.name, data);
            power_user.sysprompt.name = data.name;
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
    if (data.sysprompt !== undefined) {
        system_prompts = data.sysprompt;
    }

    await migrateSystemPromptFromInstructMode();
    toggleSystemPromptDisabledControls();

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

/**
 * Checks if the instruct template has a system prompt and prompts the user to save it as a system prompt.
 * @param {string} name Name of the instruct template
 * @param {object} template Instruct template object
 */
export async function checkForSystemPromptInInstructTemplate(name, template) {
    if (!template || !name || typeof name !== 'string' || typeof template !== 'object') {
        return;
    }
    if ('system_prompt' in template && template.system_prompt) {
        const existingName = system_prompts.find(x => x.content === template.system_prompt)?.name;
        const html = await renderTemplateAsync('migrateInstructPrompt', { prompt: template.system_prompt, existing: existingName });
        const confirm = await callGenericPopup(html, POPUP_TYPE.CONFIRM);
        if (confirm) {
            const migratedName = `[Migrated] ${name}`;
            const prompt = { name: migratedName, content: template.system_prompt };
            const presetManager = getPresetManager('sysprompt');
            await presetManager.savePreset(migratedName, prompt);
            toastr.success(`System prompt "${migratedName}" has been saved.`);
        } else {
            toastr.info('System prompt has been discarded.');
        }

        delete template.system_prompt;
    }
}

function toggleSystemPromptDisabledControls() {
    $enabled.parent().find('i').toggleClass('toggleEnabled', !!power_user.sysprompt.enabled);
    $contentBlock.toggleClass('disabled', !power_user.sysprompt.enabled);
}

/**
 * Sets the system prompt state.
 * @param {boolean} state System prompt state
 * @returns {string} Empty string
 */
function setSystemPromptStateCallback(state) {
    power_user.sysprompt.enabled = state;
    $enabled.prop('checked', state);
    toggleSystemPromptDisabledControls();
    saveSettingsDebounced();
    return '';
}

function toggleSystemPromptCallback(_args, state) {
    if (!state || typeof state !== 'string') {
        return String(power_user.sysprompt.enabled);
    }

    const newState = isTrueBoolean(state);
    setSystemPromptStateCallback(newState);
    return String(power_user.sysprompt.enabled);
}

function selectSystemPromptCallback(args, name) {
    if (!power_user.sysprompt.enabled && !isTrueBoolean(args.forceGet)) {
        return '';
    }

    if (!name) {
        return power_user.sysprompt.name ?? '';
    }

    const quiet = isTrueBoolean(args?.quiet);
    const systemPromptNames = system_prompts.map(preset => preset.name);
    let foundName = systemPromptNames.find(x => x.toLowerCase() === name.toLowerCase());

    if (!foundName) {
        const fuse = new Fuse(systemPromptNames);
        const result = fuse.search(name);

        if (result.length === 0) {
            !quiet && toastr.warning(`System prompt "${name}" not found`);
            return '';
        }

        foundName = result[0].item;
    }

    $select.val(foundName).trigger('change');
    !quiet && toastr.success(`System prompt "${foundName}" selected`);
    return foundName;
}

export function initSystemPrompts() {
    $enabled.on('input', function () {
        power_user.sysprompt.enabled = !!$(this).prop('checked');
        toggleSystemPromptDisabledControls();
        saveSettingsDebounced();
    });

    $select.on('change', async function () {
        if (!power_user.sysprompt.enabled) {
            $enabled.prop('checked', true).trigger('input');
        }

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

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'sysprompt',
        aliases: ['system-prompt'],
        callback: selectSystemPromptCallback,
        returns: 'current prompt name',
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'quiet',
                description: 'Suppress the toast message on prompt change',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'false',
                enumList: commonEnumProviders.boolean('trueFalse')(),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'forceGet',
                description: 'Force getting a name even if system prompt is disabled',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'false',
                enumList: commonEnumProviders.boolean('trueFalse')(),
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'system prompt name',
                typeList: [ARGUMENT_TYPE.STRING],
                enumProvider: () => system_prompts.map(x => new SlashCommandEnumValue(x.name, null, enumTypes.enum, enumIcons.preset)),
            }),
        ],
        helpString: `
            <div>
                Selects a system prompt by name, using fuzzy search to find the closest match.
                Gets the current system prompt if no name is provided and sysprompt is enabled or <code>forceGet=true</code> is passed.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/sysprompt </code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'sysprompt-on',
        aliases: ['sysprompt-enable'],
        callback: () => setSystemPromptStateCallback(true),
        helpString: 'Enables system prompt.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'sysprompt-off',
        aliases: ['sysprompt-disable'],
        callback: () => setSystemPromptStateCallback(false),
        helpString: 'Disables system prompt',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'sysprompt-state',
        aliases: ['sysprompt-toggle'],
        helpString: 'Gets the current system prompt state. If an argument is provided, it will set the system prompt state.',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'system prompt state',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                enumList: commonEnumProviders.boolean('trueFalse')(),
            }),
        ],
        callback: toggleSystemPromptCallback,
    }));
}
