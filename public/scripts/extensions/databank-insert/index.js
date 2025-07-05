import {
    extension_prompt_types,
    extension_prompt_roles,
    saveSettingsDebounced,
    setExtensionPrompt,
    substituteParamsExtended,
} from '../../../script.js';
import {
    extension_settings,
    renderExtensionTemplateAsync,
} from '../../extensions.js';
import { getDataBankAttachments, getFileAttachment } from '../../chats.js';

const MODULE_NAME = 'databank-insert';

export const EXTENSION_PROMPT_TAG_DB = '5_databank_injection';
const settings = {
    enabled: false,
    include_wi: false,
    file_name_regex: '.*',

    injection_template: '<ATTACHED_FILES>\n{{text}}\n<END_OF_ATTACHED_FILES>',
    injection_position: extension_prompt_types.IN_PROMPT,
    injection_depth: 4,
    injection_role: extension_prompt_roles.SYSTEM,
};

async function processFiles() {
    try {
        if (!settings.enabled) {
            return;
        }

        // Fetch all non-disabled files.
        // Sort files by their file name, ascending
        const filter = new RegExp(settings.file_name_regex);
        const dataBank = getDataBankAttachments(false);
        const files = dataBank
            .sort((a, b) => a.name.localeCompare(b.name))
            .filter(file => filter.test(file.name));

        if (!files.length) {
            console.debug('Databank Insertion: No files found in Data Bank');
            return;
        }

        let fileContents = "";
        for (const file of files) {
            console.debug('Databank Insertion: Processing file', file);
            const fileText = await getFileAttachment(file.url);
            fileContents += fileText + '\n\n';
        }

        const insertedText = substituteParamsExtended(settings.injection_template, { text: fileContents });
        setExtensionPrompt(EXTENSION_PROMPT_TAG_DB, insertedText, settings.injection_position, settings.injection_depth, settings.include_wi, settings.injection_role);
    } catch (error) {
        console.error('Databank Insertion: Failed to retrieve files', error);
    }
}

/**
 * @param {object[]} _chat Array of chat messages
 * @param {number} _contextSize Context size (unused)
 * @param {function} _abort Abort function (unused)
 * @param {string} type Generation type
 */
async function inject(_chat, _contextSize, _abort, type) {
    try {
        if (type === 'quiet') {
            console.debug('Databank Insertion: Skipping quiet prompt');
            return;
        }

        // Clear the extension prompt
        setExtensionPrompt(EXTENSION_PROMPT_TAG_DB, '', settings.injection_position, settings.injection_depth, settings.include_wi, settings.injection_role);
        await processFiles();
    } catch (error) {
        console.error('Databank Insertion: Failed to insert files', error);
    }
}

window['databank_inject'] = inject;

function toggleSettings() {
    $('#full_settings').toggle(!!settings.enabled);
}

jQuery(async () => {
    if (!extension_settings.databank_injection) {
        extension_settings.databank_injection = settings;
    }

    Object.assign(settings, extension_settings.databank_injection);

    const template = await renderExtensionTemplateAsync(MODULE_NAME, 'settings');
    $('#extensions_settings2').append(template);

    $('#databank_insert_enable').prop('checked', settings.enabled).on('input', () => {
        settings.enabled = !!$('#databank_insert_enable').prop('checked');
        Object.assign(extension_settings.databank_injection, settings);
        saveSettingsDebounced();
        toggleSettings();
    });

    $('#file_name_regex').val(settings.file_name_regex).on('input', () => {
        settings.file_name_regex = String($('#file_name_regex').val());
        Object.assign(extension_settings.databank_injection, settings);
        saveSettingsDebounced();
    });

    $('#injection_template').val(settings.injection_template).on('input', () => {
        settings.injection_template = String($('#injection_template').val());
        Object.assign(extension_settings.databank_injection, settings);
        saveSettingsDebounced();
    });

    $(`input[name="injection_position"][value="${settings.injection_position}"]`).prop('checked', true);
    $('input[name="injection_position"]').on('change', () => {
        settings.injection_position = Number($('input[name="injection_position"]:checked').val());
        Object.assign(extension_settings.databank_injection, settings);
        saveSettingsDebounced();
    });

    $('#injection_depth').val(settings.injection_depth).on('input', () => {
        settings.injection_depth = Number($('#injection_depth').val());
        Object.assign(extension_settings.databank_injection, settings);
        saveSettingsDebounced();
    });

    $('#injection_role').val(settings.injection_role).on('input', () => {
        settings.injection_role = Number($('#injection_role').val());
        Object.assign(extension_settings.databank_injection, settings);
        saveSettingsDebounced();
    });

    $('#include_wi').prop('checked', settings.include_wi).on('input', () => {
        settings.include_wi = !!$('#include_wi').prop('checked');
        Object.assign(extension_settings.databank_injection, settings);
        saveSettingsDebounced();
    });

    toggleSettings();
});
