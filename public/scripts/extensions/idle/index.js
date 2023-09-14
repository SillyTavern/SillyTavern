import {
    eventSource,
    this_chid,
    characters,
    getRequestHeaders,
    settings,
    saveSettingsDebounced,
} from "../../../script.js";
import { selected_group } from "../../group-chats.js";
import { loadFileToDocument } from "../../utils.js";
import { loadMovingUIState } from '../../power-user.js';
import { dragElement } from '../../RossAscends-mods.js';
import { sendMessageAsQuiet } from "../../slash-commands.js";
import { extension_settings } from "../../extensions.js";

const extensionName = "idle";
const extensionFolderPath = `scripts/extensions/${extensionName}/`;

let idleTimer = null;
let repeatCount = 0;

let defaultSettings = {
    enabled: false,
    timer: 30000,
    prompts: [
        "*{{user}} stands silently, looking deep in thought*",
        "*{{user}} pauses, eyes wandering over the surroundings*",
        "*{{user}} hesitates, appearing lost for a moment*",
        "*{{user}} takes a deep breath, collecting their thoughts*",
        "*{{user}} gazes into the distance, seemingly distracted*",
        "*{{user}} remains still, absorbing the ambiance*",
        "*{{user}} lingers in silence, a contemplative look on their face*",
        "*{{user}} stops, fingers brushing against an old memory*",
        "*{{user}} seems to drift into a momentary daydream*",
        "*{{user}} waits quietly, allowing the weight of the moment to settle*",
    ],
    useContinuation: true,
    repeats: 2, // 0 = infinite
    
};

async function loadSettings() {
    // Ensure extension_settings.idle exists
    if (!extension_settings.idle) {
        console.log("Creating extension_settings.idle");
        extension_settings.idle = {};
    }

    // Check and merge each default setting if it doesn't exist
    for (const [key, value] of Object.entries(defaultSettings)) {
        if (!extension_settings.idle.hasOwnProperty(key)) {
            console.log(`Setting default for: ${key}`);
            extension_settings.idle[key] = value;
        }
    }

    // Update UI components
    $("#idle_timer").val(extension_settings.idle.timer).trigger("input");
    //Turn our array into a newline separated string
    $("#idle_Prompts").val(extension_settings.idle.prompts.join("\n")).trigger("input");
    $("#idle_use_continuation").prop("checked", extension_settings.idle.useContinuation).trigger("input");
    $("#idle_enabled").prop("checked", extension_settings.idle.enabled).trigger("input");
    $("#idle_repeats").val(extension_settings.idle.repeats).trigger("input");

}


// Function to reset the timer
function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(sendIdlePrompt, extension_settings.idle.timer);
}

// Function to send a random idle prompt to the AI
async function sendIdlePrompt() {
    console.debug(extension_settings.idle.repeats, repeatCount);
    if(!extension_settings.idle.enabled) return;

    if(extension_settings.idle.repeats > 0 && repeatCount >= extension_settings.idle.repeats) return;

    const prompts = extension_settings.idle.prompts;
    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
    //pause the timer
    clearTimeout(idleTimer);
    //stop listening for send_textarea input
    $("#send_textarea").off("input");
    if (extension_settings.idle.useContinuation) {
        $('#option_continue').trigger('click');
        console.log("Sending idle prompt with continuation");
    }
    else {
        console.log("Sending idle prompt");
        sendMessageAsQuiet("", randomPrompt);
    }
    repeatCount++;
    resetIdleTimer();
    // Re-register the event listener
    $("#send_textarea").on("input", function () {
        console.log("send_textarea input");
        repeatCount = 0;
        resetIdleTimer();
    }
    );
}


jQuery(async () => {
    const settingsHtml = await $.get("scripts/extensions/idle/dropdown.html");
    $("#extensions_settings2").append(settingsHtml);
    loadSettings();

    //listen for send_textarea input
    $("#send_textarea").on("input", function () {
        console.log("send_textarea input");
        repeatCount = 0;
        resetIdleTimer();
    });
    // listen for clicks or keypresses anywhere on the page
    $(document).on("click keypress", function () {
        repeatCount = 0;
        resetIdleTimer();
    });
    
    $('#idle_timer').on('input', function () {
        extension_settings.idle.timer = $(this).val();
        saveSettingsDebounced();
    });
    $('#idle_Prompts').on('input', function () {
        extension_settings.idle.prompts = $(this).val().split("\n");
        saveSettingsDebounced();
    });
    $('#idle_use_continuation').on('input', function () {
        extension_settings.idle.useContinuation = $(this).prop('checked');
        saveSettingsDebounced();
    });
    $('#idle_enabled').on('input', function () {
        extension_settings.idle.enabled = $(this).prop('checked');
        saveSettingsDebounced();
    });
    $('#idle_repeats').on('input', function () {
        extension_settings.idle.repeats = $(this).val();
        saveSettingsDebounced();
    });




    document.addEventListener('keydown', function (e) {
        repeatCount = 0;
        resetIdleTimer();
    });


    // Call it once initially to start the timer
    resetIdleTimer();
});