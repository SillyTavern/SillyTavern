import {
    eventSource,
    this_chid,
    characters,
    getRequestHeaders,
} from "../../../script.js";
import { selected_group } from "../../group-chats.js";
import { loadFileToDocument } from "../../utils.js";
import { loadMovingUIState } from '../../power-user.js';
import { dragElement } from '../../RossAscends-mods.js';
import { registerSlashCommand } from "../../slash-commands.js";
import { extension_settings } from "../../extensions.js";

const extensionName = "idle";
const extensionFolderPath = `scripts/extensions/${extensionName}/`;

let idleTimer = null;


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
    useContinuation: false,
    
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
    $("#idle_Prompts").prop("checked", extension_settings.idle.prompts).trigger("input");
    $("#idle_use_continuation").prop("checked", extension_settings.idle.useContinuation).trigger("input");
    $("#idle_enabled").prop("checked", extension_settings.idle.enabled).trigger("input");

}


// Function to reset the timer
function resetIdleTimer() {
    if (idleTimer) clearTimeout(idleTimer);
    idleTimer = setTimeout(sendIdlePrompt, userSetTime);
}

// Function to send a random idle prompt to the AI
function sendIdlePrompt() {
    const prompts = userSetPrompts; // assuming this is an array of user-set prompts
    const randomPrompt = prompts[Math.floor(Math.random() * prompts.length)];
    // Your function to send the prompt to the AI should be called here
    sendPromptToAI(randomPrompt);
}






$(document).ready(function () {
    // Attach the resetIdleTimer function to relevant user activity events
    document.addEventListener('mousemove', resetIdleTimer);
    document.addEventListener('keydown', resetIdleTimer);
    // ... any other events that denote user activity

    // Call it once initially to start the timer
    resetIdleTimer();
});