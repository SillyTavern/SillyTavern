import {
    chat_metadata,
    eventSource,
    event_types,
    saveSettingsDebounced,
    this_chid,
} from "../../../script.js";
import { selected_group } from "../../group-chats.js";
import { extension_settings, saveMetadataDebounced } from "../../extensions.js";
import { getCharaFilename, delay } from "../../utils.js";
import { power_user } from "../../power-user.js";
import { metadataKeys } from "./util.js";

// Keep track of where your extension is located, name should match repo name
const extensionName = "cfg";
const extensionFolderPath = `scripts/extensions/${extensionName}`;
const defaultSettings = {
    global: {
        "guidance_scale": 1,
        "negative_prompt": ''
    },
    chara: []
};
const settingType = {
    guidance_scale: 0,
    negative_prompt: 1
}

// Used for character and chat CFG values
function updateSettings() {
    saveSettingsDebounced();
    loadSettings();
}

function setCharCfg(tempValue, setting) {
    const avatarName = getCharaFilename();

    // Assign temp object
    let tempCharaCfg;
    switch(setting) {
        case settingType.guidance_scale:
            tempCharaCfg = {
                "name": avatarName,
                "guidance_scale": Number(tempValue)
            }
            break;
        case settingType.negative_prompt:
            tempCharaCfg = {
                "name": avatarName,
                "negative_prompt": tempValue
            }
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
        if (!existingCharaCfg.useChara && (tempAssign.guidance_scale ?? 1.00) === 1.00 && (tempAssign.negative_prompt?.length ?? 0) === 0) {
            extension_settings.cfg.chara.splice(existingCharaCfgIndex, 1);
        }
    } else if (avatarName && tempValue.length > 0) {
        if (!extension_settings.cfg.chara) {
            extension_settings.cfg.chara = []
        }

        extension_settings.cfg.chara.push(tempCharaCfg);
    } else {
        console.debug("Character CFG error: No avatar name key could be found.");

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
        if ($("#cfgConfig").css("display") !== 'flex') {
            $("#cfgConfig").addClass('resizing')
            $("#cfgConfig").css("display", "flex");
            $("#cfgConfig").css("opacity", 0.0);
            $("#cfgConfig").transition({
                opacity: 1.0,
                duration: 250,
            }, async function () {
                await delay(50);
                $("#cfgConfig").removeClass('resizing')
            });

            //auto-open the main AN inline drawer
            if ($("#CFGBlockToggle")
                .siblings('.inline-drawer-content')
                .css('display') !== 'block') {
                $("#floatingPrompt").addClass('resizing')
                $("#CFGBlockToggle").click();
            }
        } else {
            //hide AN if it's already displayed
            $("#cfgConfig").addClass('resizing')
            $("#cfgConfig").transition({
                opacity: 0.0,
                duration: 250,
            },
                async function () {
                    await delay(50);
                    $("#cfgConfig").removeClass('resizing')
                });
            setTimeout(function () {
                $("#cfgConfig").hide();
            }, 250);

        }
        //duplicate options menu close handler from script.js
        //because this listener takes priority
        $("#options").stop().fadeOut(250);
    } else {
        toastr.warning(`Select a character before trying to configure CFG`, '', { timeOut: 2000 });
    }
}

async function onChatChanged() {
    loadSettings();
    await modifyCharaHtml();
}

// Rearrange the panel if a group chat is present
async function modifyCharaHtml() {
    if (selected_group) {
        $("#chara_cfg_container").hide();
        $("#groupchat_cfg_use_chara_container").show();
    } else {
        $("#chara_cfg_container").show();
        $("#groupchat_cfg_use_chara_container").hide();
        // TODO: Remove chat checkbox here
    }
}

// Reloads chat-specific settings
function loadSettings() {
    // Set chat CFG if it exists
    $('#chat_cfg_guidance_scale').val(chat_metadata[metadataKeys.guidance_scale] ?? 1.0.toFixed(2));
    $('#chat_cfg_guidance_scale_counter').text(chat_metadata[metadataKeys.guidance_scale]?.toFixed(2) ?? 1.0.toFixed(2));
    $('#chat_cfg_negative_prompt').val(chat_metadata[metadataKeys.negative_prompt] ?? '');
    $('#groupchat_cfg_use_chara').prop('checked', chat_metadata[metadataKeys.groupchat_individual_chars] ?? false);
    if (chat_metadata[metadataKeys.negative_combine]?.length > 0) {
        chat_metadata[metadataKeys.negative_combine].forEach((element) => {
            $(`input[name="cfg_negative_combine"][value="${element}"]`)
                .prop("checked", true);
        });
    }

    // Set character CFG if it exists
    if (!selected_group) {
        const charaCfg = extension_settings.cfg.chara.find((e) => e.name === getCharaFilename());
        $('#chara_cfg_guidance_scale').val(charaCfg?.guidance_scale ?? 1.00);
        $('#chara_cfg_guidance_scale_counter').text(charaCfg?.guidance_scale?.toFixed(2) ?? 1.0.toFixed(2));
        $('#chara_cfg_negative_prompt').val(charaCfg?.negative_prompt ?? '');
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
    $('#global_cfg_guidance_scale_counter').text(extension_settings.cfg.global.guidance_scale.toFixed(2));
    $('#global_cfg_negative_prompt').val(extension_settings.cfg.global.negative_prompt);
}

function migrateSettings() {
    let performSave = false;

    if (power_user.guidance_scale) {
        extension_settings.cfg.global.guidance_scale = power_user.guidance_scale;
        delete power_user['guidance_scale'];
        performSave = true;
    }

    if (power_user.negative_prompt) {
        extension_settings.cfg.global.negative_prompt = power_user.negative_prompt;
        delete power_user['negative_prompt'];
        performSave = true;
    }

    if (performSave) {
        saveSettingsDebounced();
    }
}

// This function is called when the extension is loaded
jQuery(async () => {
    // This is an example of loading HTML from a file
    const windowHtml = $(await $.get(`${extensionFolderPath}/window.html`));

    // Append settingsHtml to extensions_settings
    // extension_settings and extensions_settings2 are the left and right columns of the settings menu
    // Left should be extensions that deal with system functions and right should be visual/UI related 
    windowHtml.find('#CFGClose').on('click', function () {
        $("#cfgConfig").transition({
            opacity: 0,
            duration: 200,
            easing: 'ease-in-out',
        });
        setTimeout(function () { $('#cfgConfig').hide() }, 200);
    });

    windowHtml.find('#chat_cfg_guidance_scale').on('input', function() {
        const numberValue = Number($(this).val());
        const success = setChatCfg(numberValue, settingType.guidance_scale);
        if (success) {
            $('#chat_cfg_guidance_scale_counter').text(numberValue.toFixed(2));
        }
    });

    windowHtml.find('#chat_cfg_negative_prompt').on('input', function() {
        setChatCfg($(this).val(), settingType.negative_prompt);
    });

    windowHtml.find('#chara_cfg_guidance_scale').on('input', function() {
        const value = $(this).val();
        const success = setCharCfg(value, settingType.guidance_scale);
        if (success) {
            $('#chara_cfg_guidance_scale_counter').text(Number(value).toFixed(2));
        }
    });

    windowHtml.find('#chara_cfg_negative_prompt').on('input', function() {
        setCharCfg($(this).val(), settingType.negative_prompt);
    });

    windowHtml.find('#global_cfg_guidance_scale').on('input', function() {
        extension_settings.cfg.global.guidance_scale = Number($(this).val());
        $('#global_cfg_guidance_scale_counter').text(extension_settings.cfg.global.guidance_scale.toFixed(2));
        saveSettingsDebounced();
    });

    windowHtml.find('#global_cfg_negative_prompt').on('input', function() {
        extension_settings.cfg.global.negative_prompt = $(this).val();
        saveSettingsDebounced();
    });

    windowHtml.find(`input[name="cfg_negative_combine"]`).on('input', function() {
        const values = windowHtml.find(`input[name="cfg_negative_combine"]`)
            .filter(":checked")
            .map(function() { return parseInt($(this).val()) })
            .get()
            .filter((e) => e !== NaN) || [];

        chat_metadata[metadataKeys.negative_combine] = values;
        saveMetadataDebounced();
    });

    windowHtml.find('#groupchat_cfg_use_chara').on('input', function() {
        const checked = !!$(this).prop('checked');
        chat_metadata[metadataKeys.groupchat_individual_chars] = checked

        if (checked) {
            toastr.info("You can edit character CFG values in their respective character chats.");
        }

        saveMetadataDebounced();
    });

    $("#movingDivs").append(windowHtml);

    initialLoadSettings();

    if (extension_settings.cfg) {
        migrateSettings();
    }

    const buttonHtml = $(await $.get(`${extensionFolderPath}/menuButton.html`));
    buttonHtml.on('click', onCfgMenuItemClick)
    buttonHtml.insertAfter("#option_toggle_AN");

    // Hook events
    eventSource.on(event_types.CHAT_CHANGED, async () => {
        await onChatChanged();
    });
});
