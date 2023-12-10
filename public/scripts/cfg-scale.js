import {
    chat_metadata,
    substituteParams,
    this_chid,
    eventSource,
    event_types,
    saveSettingsDebounced,
    animation_duration,
} from '../script.js';
import { extension_settings, saveMetadataDebounced } from './extensions.js';
import { selected_group } from './group-chats.js';
import { getCharaFilename, delay } from './utils.js';
import { power_user } from './power-user.js';

const extensionName = 'cfg';
const defaultSettings = {
    global: {
        'guidance_scale': 1,
        'negative_prompt': '',
    },
    chara: [],
};
const settingType = {
    guidance_scale: 0,
    negative_prompt: 1,
    positive_prompt: 2,
};

// Used for character and chat CFG values
function updateSettings() {
    saveSettingsDebounced();
    loadSettings();
}

function setCharCfg(tempValue, setting) {
    const avatarName = getCharaFilename();

    // Assign temp object
    let tempCharaCfg = {
        name: avatarName,
    };

    switch(setting) {
        case settingType.guidance_scale:
            tempCharaCfg['guidance_scale'] = Number(tempValue);
            break;
        case settingType.negative_prompt:
            tempCharaCfg['negative_prompt'] = tempValue;
            break;
        case settingType.positive_prompt:
            tempCharaCfg['positive_prompt'] = tempValue;
            break;
        default:
            return false;
    }

    let existingCharaCfgIndex;
    let existingCharaCfg;

    if (extension_settings.cfg.chara) {
        existingCharaCfgIndex = extension_settings.cfg.chara.findIndex((e) => e.name === avatarName);
        existingCharaCfg = extension_settings.cfg.chara[existingCharaCfgIndex];
    }

    if (extension_settings.cfg.chara && existingCharaCfg) {
        const tempAssign = Object.assign(existingCharaCfg, tempCharaCfg);

        // If both values are default, remove the entry
        if (!existingCharaCfg.useChara &&
            (tempAssign.guidance_scale ?? 1.00) === 1.00 &&
            (tempAssign.negative_prompt?.length ?? 0) === 0 &&
            (tempAssign.positive_prompt?.length ?? 0) === 0)
        {
            extension_settings.cfg.chara.splice(existingCharaCfgIndex, 1);
        }
    } else if (avatarName && tempValue.length > 0) {
        if (!extension_settings.cfg.chara) {
            extension_settings.cfg.chara = [];
        }

        extension_settings.cfg.chara.push(tempCharaCfg);
    } else {
        console.debug('Character CFG error: No avatar name key could be found.');

        // Don't save settings if something went wrong
        return false;
    }

    updateSettings();

    return true;
}

function setChatCfg(tempValue, setting) {
    switch(setting) {
        case settingType.guidance_scale:
            chat_metadata[metadataKeys.guidance_scale] = tempValue;
            break;
        case settingType.negative_prompt:
            chat_metadata[metadataKeys.negative_prompt] = tempValue;
            break;
        case settingType.positive_prompt:
            chat_metadata[metadataKeys.positive_prompt] = tempValue;
            break;
        default:
            return false;
    }

    saveMetadataDebounced();

    return true;
}

// TODO: Only change CFG when character is selected
function onCfgMenuItemClick() {
    if (selected_group || this_chid) {
        //show CFG config if it's hidden
        if ($('#cfgConfig').css('display') !== 'flex') {
            $('#cfgConfig').addClass('resizing');
            $('#cfgConfig').css('display', 'flex');
            $('#cfgConfig').css('opacity', 0.0);
            $('#cfgConfig').transition({
                opacity: 1.0,
                duration: animation_duration,
            }, async function () {
                await delay(50);
                $('#cfgConfig').removeClass('resizing');
            });

            //auto-open the main AN inline drawer
            if ($('#CFGBlockToggle')
                .siblings('.inline-drawer-content')
                .css('display') !== 'block') {
                $('#floatingPrompt').addClass('resizing');
                $('#CFGBlockToggle').click();
            }
        } else {
            //hide AN if it's already displayed
            $('#cfgConfig').addClass('resizing');
            $('#cfgConfig').transition({
                opacity: 0.0,
                duration: animation_duration,
            },
            async function () {
                await delay(50);
                $('#cfgConfig').removeClass('resizing');
            });
            setTimeout(function () {
                $('#cfgConfig').hide();
            }, animation_duration);

        }
        //duplicate options menu close handler from script.js
        //because this listener takes priority
        $('#options').stop().fadeOut(animation_duration);
    } else {
        toastr.warning('Select a character before trying to configure CFG', '', { timeOut: 2000 });
    }
}

async function onChatChanged() {
    loadSettings();
    await modifyCharaHtml();
}

// Rearrange the panel if a group chat is present
async function modifyCharaHtml() {
    if (selected_group) {
        $('#chara_cfg_container').hide();
        $('#groupchat_cfg_use_chara_container').show();
    } else {
        $('#chara_cfg_container').show();
        $('#groupchat_cfg_use_chara_container').hide();
        // TODO: Remove chat checkbox here
    }
}

// Reloads chat-specific settings
function loadSettings() {
    // Set chat CFG if it exists
    $('#chat_cfg_guidance_scale').val(chat_metadata[metadataKeys.guidance_scale] ?? 1.0.toFixed(2));
    $('#chat_cfg_guidance_scale_counter').val(chat_metadata[metadataKeys.guidance_scale]?.toFixed(2) ?? 1.0.toFixed(2));
    $('#chat_cfg_negative_prompt').val(chat_metadata[metadataKeys.negative_prompt] ?? '');
    $('#chat_cfg_positive_prompt').val(chat_metadata[metadataKeys.positive_prompt] ?? '');
    $('#groupchat_cfg_use_chara').prop('checked', chat_metadata[metadataKeys.groupchat_individual_chars] ?? false);
    if (chat_metadata[metadataKeys.prompt_combine]?.length > 0) {
        chat_metadata[metadataKeys.prompt_combine].forEach((element) => {
            $(`input[name="cfg_prompt_combine"][value="${element}"]`)
                .prop('checked', true);
        });
    }

    // Display the negative separator in quotes if not quoted already
    let promptSeparatorDisplay = [];
    const promptSeparator = chat_metadata[metadataKeys.prompt_separator];
    if (promptSeparator) {
        promptSeparatorDisplay.push(promptSeparator);
        if (!promptSeparator.startsWith('"')) {
            promptSeparatorDisplay.unshift('"');
        }

        if (!promptSeparator.endsWith('"')) {
            promptSeparatorDisplay.push('"');
        }
    }

    $('#cfg_prompt_separator').val(promptSeparatorDisplay.length === 0 ? '' : promptSeparatorDisplay.join(''));

    $('#cfg_prompt_insertion_depth').val(chat_metadata[metadataKeys.prompt_insertion_depth] ?? 1);

    // Set character CFG if it exists
    if (!selected_group) {
        const charaCfg = extension_settings.cfg.chara.find((e) => e.name === getCharaFilename());
        $('#chara_cfg_guidance_scale').val(charaCfg?.guidance_scale ?? 1.00);
        $('#chara_cfg_guidance_scale_counter').val(charaCfg?.guidance_scale?.toFixed(2) ?? 1.0.toFixed(2));
        $('#chara_cfg_negative_prompt').val(charaCfg?.negative_prompt ?? '');
        $('#chara_cfg_positive_prompt').val(charaCfg?.positive_prompt ?? '');
    }
}

// Load initial extension settings
async function initialLoadSettings() {
    // Create the settings if they don't exist
    extension_settings[extensionName] = extension_settings[extensionName] || {};
    if (Object.keys(extension_settings[extensionName]).length === 0) {
        Object.assign(extension_settings[extensionName], defaultSettings);
        saveSettingsDebounced();
    }

    // Set global CFG values on load
    $('#global_cfg_guidance_scale').val(extension_settings.cfg.global.guidance_scale);
    $('#global_cfg_guidance_scale_counter').val(extension_settings.cfg.global.guidance_scale.toFixed(2));
    $('#global_cfg_negative_prompt').val(extension_settings.cfg.global.negative_prompt);
    $('#global_cfg_positive_prompt').val(extension_settings.cfg.global.positive_prompt);
}

function migrateSettings() {
    let performSettingsSave = false;
    let performMetaSave = false;

    if (power_user.guidance_scale) {
        extension_settings.cfg.global.guidance_scale = power_user.guidance_scale;
        delete power_user['guidance_scale'];
        performSettingsSave = true;
    }

    if (power_user.negative_prompt) {
        extension_settings.cfg.global.negative_prompt = power_user.negative_prompt;
        delete power_user['negative_prompt'];
        performSettingsSave = true;
    }

    if (chat_metadata['cfg_negative_combine']) {
        chat_metadata[metadataKeys.prompt_combine] = chat_metadata['cfg_negative_combine'];
        chat_metadata['cfg_negative_combine'] = undefined;
        performMetaSave = true;
    }

    if (chat_metadata['cfg_negative_insertion_depth']) {
        chat_metadata[metadataKeys.prompt_insertion_depth] = chat_metadata['cfg_negative_insertion_depth'];
        chat_metadata['cfg_negative_insertion_depth'] = undefined;
        performMetaSave = true;
    }

    if (chat_metadata['cfg_negative_separator']) {
        chat_metadata[metadataKeys.prompt_separator] = chat_metadata['cfg_negative_separator'];
        chat_metadata['cfg_negative_separator'] = undefined;
        performMetaSave = true;
    }

    if (performSettingsSave) {
        saveSettingsDebounced();
    }

    if (performMetaSave) {
        saveMetadataDebounced();
    }
}

// This function is called when the extension is loaded
export function initCfg() {
    $('#CFGClose').on('click', function () {
        $('#cfgConfig').transition({
            opacity: 0,
            duration: animation_duration,
            easing: 'ease-in-out',
        });
        setTimeout(function () { $('#cfgConfig').hide(); }, animation_duration);
    });

    $('#chat_cfg_guidance_scale').on('input', function() {
        const numberValue = Number($(this).val());
        const success = setChatCfg(numberValue, settingType.guidance_scale);
        if (success) {
            $('#chat_cfg_guidance_scale_counter').val(numberValue.toFixed(2));
        }
    });

    $('#chat_cfg_negative_prompt').on('input', function() {
        setChatCfg($(this).val(), settingType.negative_prompt);
    });

    $('#chat_cfg_positive_prompt').on('input', function() {
        setChatCfg($(this).val(), settingType.positive_prompt);
    });

    $('#chara_cfg_guidance_scale').on('input', function() {
        const value = $(this).val();
        const success = setCharCfg(value, settingType.guidance_scale);
        if (success) {
            $('#chara_cfg_guidance_scale_counter').val(Number(value).toFixed(2));
        }
    });

    $('#chara_cfg_negative_prompt').on('input', function() {
        setCharCfg($(this).val(), settingType.negative_prompt);
    });

    $('#chara_cfg_positive_prompt').on('input', function() {
        setCharCfg($(this).val(), settingType.positive_prompt);
    });

    $('#global_cfg_guidance_scale').on('input', function() {
        extension_settings.cfg.global.guidance_scale = Number($(this).val());
        $('#global_cfg_guidance_scale_counter').val(extension_settings.cfg.global.guidance_scale.toFixed(2));
        saveSettingsDebounced();
    });

    $('#global_cfg_negative_prompt').on('input', function() {
        extension_settings.cfg.global.negative_prompt = $(this).val();
        saveSettingsDebounced();
    });

    $('#global_cfg_positive_prompt').on('input', function() {
        extension_settings.cfg.global.positive_prompt = $(this).val();
        saveSettingsDebounced();
    });

    $('input[name="cfg_prompt_combine"]').on('input', function() {
        const values = $('#cfgConfig').find('input[name="cfg_prompt_combine"]')
            .filter(':checked')
            .map(function() { return Number($(this).val()); })
            .get()
            .filter((e) => !Number.isNaN(e)) || [];

        chat_metadata[metadataKeys.prompt_combine] = values;
        saveMetadataDebounced();
    });

    $('#cfg_prompt_insertion_depth').on('input', function() {
        chat_metadata[metadataKeys.prompt_insertion_depth] = Number($(this).val());
        saveMetadataDebounced();
    });

    $('#cfg_prompt_separator').on('input', function() {
        chat_metadata[metadataKeys.prompt_separator] = $(this).val();
        saveMetadataDebounced();
    });

    $('#groupchat_cfg_use_chara').on('input', function() {
        const checked = !!$(this).prop('checked');
        chat_metadata[metadataKeys.groupchat_individual_chars] = checked;

        if (checked) {
            toastr.info('You can edit character CFG values in their respective character chats.');
        }

        saveMetadataDebounced();
    });

    initialLoadSettings();

    if (extension_settings.cfg) {
        migrateSettings();
    }

    $('#option_toggle_CFG').on('click', onCfgMenuItemClick);

    // Hook events
    eventSource.on(event_types.CHAT_CHANGED, async () => {
        await onChatChanged();
    });
}

export const cfgType = {
    chat: 0,
    chara: 1,
    global: 2,
};

export const metadataKeys = {
    guidance_scale: 'cfg_guidance_scale',
    negative_prompt: 'cfg_negative_prompt',
    positive_prompt: 'cfg_positive_prompt',
    prompt_combine: 'cfg_prompt_combine',
    groupchat_individual_chars: 'cfg_groupchat_individual_chars',
    prompt_insertion_depth: 'cfg_prompt_insertion_depth',
    prompt_separator: 'cfg_prompt_separator',
};

// Gets the CFG guidance scale
// If the guidance scale is 1, ignore the CFG prompt(s) since it won't be used anyways
export function getGuidanceScale() {
    if (!extension_settings.cfg) {
        console.warn('CFG extension is not enabled. Skipping CFG guidance.');
        return;
    }

    const charaCfg = extension_settings.cfg.chara?.find((e) => e.name === getCharaFilename(this_chid));
    const chatGuidanceScale = chat_metadata[metadataKeys.guidance_scale];
    const groupchatCharOverride = chat_metadata[metadataKeys.groupchat_individual_chars] ?? false;

    if (chatGuidanceScale && chatGuidanceScale !== 1 && !groupchatCharOverride) {
        return {
            type: cfgType.chat,
            value: chatGuidanceScale,
        };
    }

    if ((!selected_group && charaCfg || groupchatCharOverride) && charaCfg?.guidance_scale !== 1) {
        return {
            type: cfgType.chara,
            value: charaCfg.guidance_scale,
        };
    }

    if (extension_settings.cfg.global && extension_settings.cfg.global?.guidance_scale !== 1) {
        return {
            type: cfgType.global,
            value: extension_settings.cfg.global.guidance_scale,
        };
    }
}

/**
 * Gets the CFG prompt separator.
 * @returns {string} The CFG prompt separator
 */
function getCustomSeparator() {
    const defaultSeparator = '\n';

    try {
        if (chat_metadata[metadataKeys.prompt_separator]) {
            return JSON.parse(chat_metadata[metadataKeys.prompt_separator]);
        }

        return defaultSeparator;
    } catch {
        console.warn('Invalid JSON detected for prompt separator. Using default separator.');
        return defaultSeparator;
    }
}

// Gets the CFG prompt
export function getCfgPrompt(guidanceScale, isNegative) {
    let splitCfgPrompt = [];

    const cfgPromptCombine = chat_metadata[metadataKeys.prompt_combine] ?? [];
    if (guidanceScale.type === cfgType.chat || cfgPromptCombine.includes(cfgType.chat)) {
        splitCfgPrompt.unshift(
            substituteParams(
                chat_metadata[isNegative ? metadataKeys.negative_prompt : metadataKeys.positive_prompt],
            ),
        );
    }

    const charaCfg = extension_settings.cfg.chara?.find((e) => e.name === getCharaFilename(this_chid));
    if (guidanceScale.type === cfgType.chara || cfgPromptCombine.includes(cfgType.chara)) {
        splitCfgPrompt.unshift(
            substituteParams(
                isNegative ? charaCfg.negative_prompt : charaCfg.positive_prompt,
            ),
        );
    }

    if (guidanceScale.type === cfgType.global || cfgPromptCombine.includes(cfgType.global)) {
        splitCfgPrompt.unshift(
            substituteParams(
                isNegative ? extension_settings.cfg.global.negative_prompt : extension_settings.cfg.global.positive_prompt,
            ),
        );
    }

    const customSeparator = getCustomSeparator();
    const combinedCfgPrompt = splitCfgPrompt.filter((e) => e.length > 0).join(customSeparator);
    const insertionDepth = chat_metadata[metadataKeys.prompt_insertion_depth] ?? 1;
    console.log(`Setting CFG with guidance scale: ${guidanceScale.value}, negatives: ${combinedCfgPrompt}`);

    return {
        value: combinedCfgPrompt,
        depth: insertionDepth,
    };
}
