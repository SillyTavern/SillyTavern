import {
    chat_metadata,
    eventSource,
    event_types,
    getTokenCount,
    saveSettingsDebounced,
    this_chid,
} from "../../../script.js";
import { selected_group } from "../../group-chats.js";
import { extension_settings, getContext, saveMetadataDebounced, loadExtensionSettings } from "../../extensions.js";
import { getCharaFilename, debounce, waitUntilCondition, delay } from "../../utils.js";
import { power_user } from "../../power-user.js";

// Keep track of where your extension is located, name should match repo name
const extensionName = "cfg";
const extensionFolderPath = `scripts/extensions/${extensionName}`;
const defaultSettings = {
    "global": {
        "guidance_scale": 1,
        "negative_prompt": ''
    },
    "chara": []
};

function updateSettings() {
    saveSettingsDebounced();
    loadSettings();
    //setFloatingPrompt();
}

function setCharCfgNegative() {
    
}

function setCharCfgScale() {

}

function setChatCfgNegative() {

}

function setChatCfgScale() {

}

// TODO: Only change CFG when character is selected
function onCfgMenuItemClick() {
    //if (selected_group || this_chid) {
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
        /*
    } else {
        toastr.warning(`Select a character before trying to configure CFG`, '', { timeOut: 2000 });
    }
        */
}

// TODO: Load character-specific settings here and set the relevant HTML
function onChatChanged() {
    console.log("Chat changed");
}
 
// Loads the extension settings if they exist, otherwise initializes them to the defaults.
async function loadSettings() {
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
    })

    windowHtml.find('#global_cfg_guidance_scale').on('input', function() {
        extension_settings.cfg.global.guidance_scale = Number($(this).val());
        $('#global_cfg_guidance_scale_counter').text(extension_settings.cfg.global.guidance_scale.toFixed(2));
        console.log(extension_settings.cfg.global.guidance_scale)
        saveSettingsDebounced();
    });

    windowHtml.find('#global_cfg_negative_prompt').on('input', function() {
        extension_settings.cfg.global.negative_prompt = $(this).val();
        saveSettingsDebounced();
    });

    $("#movingDivs").append(windowHtml);

    // Load settings when starting things up (if you have any)
    loadSettings();

    if (extension_settings.cfg) {
        migrateSettings();
    }

    const buttonHtml = $(await $.get(`${extensionFolderPath}/menuButton.html`));
    buttonHtml.on('click', onCfgMenuItemClick)
    buttonHtml.insertAfter("#option_toggle_AN");

    // Hook events
    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);
});
