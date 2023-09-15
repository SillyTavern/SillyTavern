import {
    eventSource,
    event_types,
    saveSettingsDebounced
} from "../../../script.js";
import { selected_group } from "../../group-chats.js";
import { debounce } from "../../utils.js";
import { loadMovingUIState } from '../../power-user.js';
import { dragElement } from '../../RossAscends-mods.js';
import { sendMessageAsQuiet } from "../../slash-commands.js";
import { extension_settings, getContext } from "../../extensions.js";

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
    sendAs : "User"
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
    $("#idle_sendAs").val(extension_settings.idle.sendAs).trigger("input");

}


// Function to reset the timer
function resetIdleTimer() {
    console.log("Resetting idle timer");
    if (idleTimer) clearTimeout(idleTimer);
    let context = getContext();
    console.debug(context);
    if (!context.characterId && !context.groupID) return;
    idleTimer = setTimeout(sendIdlePrompt, extension_settings.idle.timer);
}

// Function to send a random idle prompt to the AI
async function sendIdlePrompt() {
    console.debug(extension_settings.idle.repeats, repeatCount);
    if(!extension_settings.idle.enabled) return;

    if(extension_settings.idle.repeats > 0 && repeatCount >= extension_settings.idle.repeats) return;

    //If we are waiting for a response, don't send an idle prompt
    if ($('#mes_stop').is(':visible')) {
        console.log("Not sending idle prompt, waiting for response");
        resetIdleTimer();
        return;
    }

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
        sendMessageAsQuiet(extension_settings.idle.sendAs, randomPrompt);
    }
    repeatCount++;
    resetIdleTimer();
    // Re-register the event listener
    $("#send_textarea").on("input", function () {
        console.log("send_textarea input");
        resetIdleTimer();
    }
    );
}


async function loadSettingsHTML() {
    const settingsHtml = await $.get("scripts/extensions/idle/dropdown.html");
    $("#extensions_settings2").append(settingsHtml);
}

function updateSetting(elementId, property, isCheckbox = false) {
    let value = $(`#${elementId}`).val();
    if (isCheckbox) {
        value = $(`#${elementId}`).prop('checked');
    }

    if (property === "prompts") {
        value = value.split("\n");
    }

    extension_settings.idle[property] = value;
    saveSettingsDebounced();
}

function attachUpdateListener(elementId, property, isCheckbox = false) {
    $(`#${elementId}`).on('input', debounce(() => {
        updateSetting(elementId, property, isCheckbox);
    }, 250)); // Debounce with 250ms delay
}

function handleIdleEnabled() {
    if (!extension_settings.idle.enabled) {
        clearTimeout(idleTimer);
    } else {
        resetIdleTimer();
    }
}

function setupListeners() {
    // Attach listeners for settings
    attachUpdateListener('idle_timer', 'timer');
    attachUpdateListener('idle_Prompts', 'prompts');
    attachUpdateListener('idle_use_continuation', 'useContinuation', true);
    attachUpdateListener('idle_enabled', 'enabled', true);
    attachUpdateListener('idle_repeats', 'repeats');

    // Handle special case for idle_enabled
    $('#idle_enabled').on('input', debounce(handleIdleEnabled, 250));

    // Attach resetIdleTimer to multiple events
    $("#send_textarea, #send_but").on("input click", debounce(resetIdleTimer, 250));
    $(document).on("click keypress", debounce(resetIdleTimer, 250));
    document.addEventListener('keydown', debounce(resetIdleTimer, 250));

    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, debounce(function (e) {
        resetIdleTimer();
        repeatCount = 0;
    }, 250));
}

jQuery(async () => {
    await loadSettingsHTML();
    loadSettings();
    setupListeners();

    // Call it once initially to start the timer if enabled

    if (extension_settings.idle.enabled)
    {
        resetIdleTimer();
    }
});