import {
    substituteParams,
    saveSettingsDebounced,
    systemUserName,
    hideSwipeButtons,
    showSwipeButtons
} from "../../../script.js";
import { getApiUrl, getContext, extension_settings, defaultRequestArgs } from "../../extensions.js";
import { stringFormat, initScrollHeight, resetScrollHeight } from "../../utils.js";
export { MODULE_NAME };

// Wraps a string into monospace font-face span
const m = x => `<span class="monospace">${x}</span>`;
// Joins an array of strings with ' / '
const j = a => a.join(' / ');
// Wraps a string into paragraph block
const p = a => `<p>${a}</p>`

const MODULE_NAME = 'sd';
const UPDATE_INTERVAL = 1000;

const postHeaders = {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'bypass',
};

const generationMode = {
    CHARACTER: 0,
    USER: 1,
    SCENARIO: 2,
    FREE: 3,
    NOW: 4,
    FACE: 5,
}

const triggerWords = {
    [generationMode.CHARACTER]: ['you'],
    [generationMode.USER]: ['me'],
    [generationMode.SCENARIO]: ['scene'],
    [generationMode.NOW]: ['last'],
    [generationMode.FACE]: ['face'],

}

const quietPrompts = {
    //face-specific prompt
    [generationMode.FACE]: "[In the next response I want you to provide only a detailed comma-delimited list of keywords and phrases which describe {{char}}. The list must include all of the following items in this order: name, species and race, gender, age, facial features and expressions, occupation, hair and hair accessories (if any), what they are wearing on their upper body (if anything). Do not describe anything below their neck. Do not include descriptions of non-visual qualities such as personality, movements, scents, mental traits, or anything which could not be seen in a still photograph. Do not write in full sentences. Prefix your description with the phrase 'close up facial portrait:']",
    //prompt for only the last message
    [generationMode.NOW]: "[Pause your roleplay and provide a brief description of the last chat message. Focus on visual details, clothing, actions. Ignore the emotions and thoughts of {{char}} and {{user}} as well as any spoken dialog. Do not roleplay as {{char}} while writing this description. Do not continue the roleplay story.]",

    [generationMode.CHARACTER]: "[In the next response I want you to provide only a detailed comma-delimited list of keywords and phrases which describe {{char}}. The list must include all of the following items in this order: name, species and race, gender, age, clothing, occupation, physical features and appearances. Do not include descriptions of non-visual qualities such as personality, movements, scents, mental traits, or anything which could not be seen in a still photograph. Do not write in full sentences. Prefix your description with the phrase 'full body portrait:']",

    /*OLD:     [generationMode.CHARACTER]: "Pause your roleplay and provide comma-delimited list of phrases and keywords which describe {{char}}'s physical appearance and clothing. Ignore {{char}}'s personality traits, and chat history when crafting this description. End your response once the comma-delimited list is complete. Do not roleplay when writing this description, and do not attempt to continue the story.", */

    [generationMode.USER]: "[Pause your roleplay and provide a detailed description of {{user}}'s appearance from the perspective of {{char}} in the form of a comma-delimited list of keywords and phrases. Ignore the rest of the story when crafting this description. Do not roleplay as {{char}}}} when writing this description, and do not attempt to continue the story.]",
    [generationMode.SCENARIO]: "[Pause your roleplay and provide a detailed description for all of the following: a brief recap of recent events in the story, {{char}}'s appearance, and {{char}}'s surroundings. Do not roleplay while writing this description.]",
    [generationMode.FREE]: "[Pause your roleplay and provide ONLY an echo this string back to me verbatim: {0}. Do not write anything after the string. Do not roleplay at all in your response.]",
}

const helpString = [
    `${m('(argument)')} – requests SD to make an image. Supported arguments:`,
    '<ul>',
    `<li>${m(j(triggerWords[generationMode.CHARACTER]))} – AI character full body selfie</li>`,
    `<li>${m(j(triggerWords[generationMode.FACE]))} – AI character face-only selfie</li>`,
    `<li>${m(j(triggerWords[generationMode.USER]))} – user character full body selfie</li>`,
    `<li>${m(j(triggerWords[generationMode.SCENARIO]))} – visual recap of the whole chat scenario</li>`,
    `<li>${m(j(triggerWords[generationMode.NOW]))} – visual recap of the last chat message</li>`,
    '</ul>',
    `Anything else would trigger a "free mode" to make SD generate whatever you prompted.<Br> 
    example: '/sd apple tree' would generate a picture of an apple tree.`,
].join('<br>');

const defaultSettings = {
    // CFG Scale
    scale_min: 1,
    scale_max: 30,
    scale_step: 0.5,
    scale: 7,

    // Sampler steps
    steps_min: 1,
    steps_max: 150,
    steps_step: 1,
    steps: 20,

    // Image dimensions (Width & Height)
    dimension_min: 64,
    dimension_max: 2048,
    dimension_step: 64,
    width: 512,
    height: 512,

    prompt_prefix: 'best quality, absurdres, masterpiece, detailed, intricate, colorful,',
    negative_prompt: 'lowres, bad anatomy, bad hands, text, error, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry',
    sampler: 'DDIM',
    model: '',
}

async function loadSettings() {
    if (Object.keys(extension_settings.sd).length === 0) {
        Object.assign(extension_settings.sd, defaultSettings);
    }

    $('#sd_scale').val(extension_settings.sd.scale).trigger('input');
    $('#sd_steps').val(extension_settings.sd.steps).trigger('input');
    $('#sd_prompt_prefix').val(extension_settings.sd.prompt_prefix).trigger('input');
    $('#sd_negative_prompt').val(extension_settings.sd.negative_prompt).trigger('input');
    $('#sd_width').val(extension_settings.sd.width).trigger('input');
    $('#sd_height').val(extension_settings.sd.height).trigger('input');


    await Promise.all([loadSamplers(), loadModels()]);


}

function onScaleInput() {
    extension_settings.sd.scale = Number($('#sd_scale').val());
    $('#sd_scale_value').text(extension_settings.sd.scale.toFixed(1));
    saveSettingsDebounced();
}

function onStepsInput() {
    extension_settings.sd.steps = Number($('#sd_steps').val());
    $('#sd_steps_value').text(extension_settings.sd.steps);
    saveSettingsDebounced();
}

function onPromptPrefixInput() {
    extension_settings.sd.prompt_prefix = $('#sd_prompt_prefix').val();
    resetScrollHeight($(this));
    saveSettingsDebounced();
}

function onNegativePromptInput() {
    extension_settings.sd.negative_prompt = $('#sd_negative_prompt').val();
    resetScrollHeight($(this));
    saveSettingsDebounced();
}

function onSamplerChange() {
    extension_settings.sd.sampler = $('#sd_sampler').find(':selected').val();
    saveSettingsDebounced();
}

function onWidthInput() {
    extension_settings.sd.width = Number($('#sd_width').val());
    $('#sd_width_value').text(extension_settings.sd.width);
    saveSettingsDebounced();
}

function onHeightInput() {
    extension_settings.sd.height = Number($('#sd_height').val());
    $('#sd_height_value').text(extension_settings.sd.height);
    saveSettingsDebounced();
}

async function onModelChange() {
    extension_settings.sd.model = $('#sd_model').find(':selected').val();
    saveSettingsDebounced();

    const url = new URL(getApiUrl());
    url.pathname = '/api/image/model';
    const getCurrentModelResult = await fetch(url, {
        method: 'POST',
        headers: postHeaders,
        body: JSON.stringify({ model: extension_settings.sd.model }),
    });

    if (getCurrentModelResult.ok) {
        console.log('Model successfully updated on SD remote.');
    }
}

async function loadSamplers() {
    const url = new URL(getApiUrl());
    url.pathname = '/api/image/samplers';
    const result = await fetch(url, defaultRequestArgs);

    if (result.ok) {
        const data = await result.json();
        const samplers = data.samplers;

        for (const sampler of samplers) {
            const option = document.createElement('option');
            option.innerText = sampler;
            option.value = sampler;
            option.selected = sampler === extension_settings.sd.sampler;
            $('#sd_sampler').append(option);
        }
    }
}

async function loadModels() {
    const url = new URL(getApiUrl());
    url.pathname = '/api/image/model';
    const getCurrentModelResult = await fetch(url, defaultRequestArgs);

    if (getCurrentModelResult.ok) {
        const data = await getCurrentModelResult.json();
        extension_settings.sd.model = data.model;
    }

    url.pathname = '/api/image/models';
    const getModelsResult = await fetch(url, defaultRequestArgs);

    if (getModelsResult.ok) {
        const data = await getModelsResult.json();
        const models = data.models;

        for (const model of models) {
            const option = document.createElement('option');
            option.innerText = model;
            option.value = model;
            option.selected = model === extension_settings.sd.model;
            $('#sd_model').append(option);
        }
    }
}

function getGenerationType(prompt) {
    for (const [key, values] of Object.entries(triggerWords)) {
        for (const value of values) {
            if (value.toLowerCase() === prompt.toLowerCase().trim()) {
                return key;
            }
        }
    }

    return generationMode.FREE;
}

function getQuietPrompt(mode, trigger) {
    return substituteParams(stringFormat(quietPrompts[mode], trigger));
}

function processReply(str) {
    str = str.replaceAll('"', '')
    str = str.replaceAll('“', '')
    str = str.replaceAll('\n', ', ')
    str = str.replace(/[^a-zA-Z0-9,:]+/g, ' ') // Replace everything except alphanumeric characters and commas with spaces
    str = str.replace(/\s+/g, ' '); // Collapse multiple whitespaces into one
    str = str.trim();

    str = str
        .split(',') // list split by commas
        .map(x => x.trim()) // trim each entry
        .filter(x => x) // remove empty entries
        .join(', '); // join it back with proper spacing

    return str;
}

async function generatePicture(_, trigger) {
    if (!trigger || trigger.trim().length === 0) {
        console.log('Trigger word empty, aborting');
        return;
    }

    trigger = trigger.trim();
    const generationMode = getGenerationType(trigger);
    console.log('Generation mode', generationMode, 'triggered with', trigger);
    const quiet_prompt = getQuietPrompt(generationMode, trigger);
    const context = getContext();

    try {
        const prompt = processReply(await new Promise(
            async function promptPromise(resolve, reject) {
                try {
                    await context.generate('quiet', { resolve, reject, quiet_prompt, force_name2: true, });
                }
                catch {
                    reject();
                }
            }));

        context.deactivateSendButtons();
        hideSwipeButtons();

        console.log('Processed Stable Diffusion prompt:', prompt);

        const url = new URL(getApiUrl());
        url.pathname = '/api/image';
        const result = await fetch(url, {
            method: 'POST',
            headers: postHeaders,
            body: JSON.stringify({
                prompt: prompt,
                sampler: extension_settings.sd.sampler,
                steps: extension_settings.sd.steps,
                scale: extension_settings.sd.scale,
                width: extension_settings.sd.width,
                height: extension_settings.sd.height,
                prompt_prefix: extension_settings.sd.prompt_prefix,
                negative_prompt: extension_settings.sd.negative_prompt,
                restore_faces: true,
                face_restoration_model: 'GFPGAN',

            }),
        });

        if (result.ok) {
            const data = await result.json();
            const base64Image = `data:image/jpeg;base64,${data.image}`;
            sendMessage(prompt, base64Image);
        }
    } catch (err) {
        console.trace(err);
        throw new Error('SD prompt text generation failed.')
    }
    finally {
        context.activateSendButtons();
        showSwipeButtons();
    }
}

async function sendMessage(prompt, image) {
    const context = getContext();
    const messageText = `[${context.name2} sends a picture that contains: ${prompt}]`;
    const message = {
        name: context.groupId ? systemUserName : context.name2,
        is_system: context.groupId ? true : false,
        is_user: false,
        is_name: true,
        send_date: Date.now(),
        mes: context.groupId ? p(messageText) : messageText,
        extra: {
            image: image,
            title: prompt,
        },
    };
    context.chat.push(message);
    context.addOneMessage(message);
    context.saveChat();
}

function addSDGenButtons() {
    const buttonHtml = `
        <div id="sd_gen" class="fa-solid fa-paintbrush" /></div>
        `;

    const waitButtonHtml = `
        <div id="sd_gen_wait" class="fa-solid fa-hourglass-half" /></div>
    `
    const dropdownHtml = `
    <div id="sd_dropdown">
    <span>Send me a picture of:</span>
        <ul class="list-group">
            <li class="list-group-item" id="sd_you" data-value="you">Yourself</li>
            <li class="list-group-item" id="sd_face" data-value="face">Your Face</li>
            <li class="list-group-item" id="sd_me" data-value="me">Me</li>
            <li class="list-group-item" id="sd_world" data-value="world">The Whole Story</li>
            <li class="list-group-item" id="sd_last" data-value="last">The Last Message</li>
        </ul>
    </div>`;

    $('#send_but_sheld').prepend(buttonHtml);
    $('#send_but_sheld').prepend(waitButtonHtml);
    $(document.body).append(dropdownHtml)

    const button = $('#sd_gen');
    const waitButton = $("#sd_gen_wait");
    const dropdown = $('#sd_dropdown');
    waitButton.hide();
    dropdown.hide();
    button.hide();

    let popper = Popper.createPopper(button.get(0), dropdown.get(0), {
        placement: 'top-start',
    });

    $(document).on('click touchend', function (e) {
        const target = $(e.target);
        if (target.is(dropdown)) return;
        if (target.is(button) && !dropdown.is(":visible") && $("#send_but").css('display') === 'flex') {
            e.preventDefault();

            dropdown.show(200);
            popper.update();
        } else {
            dropdown.hide(200);
        }
    });
}

async function moduleWorker() {
    const context = getContext();

    /*     if (context.onlineStatus === 'no_connection') {
            $('#sd_gen').hide(200);
        } else if ($("#send_but").css('display') === 'flex') {
            $('#sd_gen').show(200);
            $("#sd_gen_wait").hide(200);
        } else {
            $('#sd_gen').hide(200);
            $("#sd_gen_wait").show(200);
        } */

    context.onlineStatus === 'no_connection'
        ? $('#sd_gen').hide(200)
        : $('#sd_gen').show(200)
}

addSDGenButtons();
setInterval(moduleWorker, UPDATE_INTERVAL);

$("#sd_dropdown [id]").on("click", function () {
    var id = $(this).attr("id");
    if (id == "sd_you") {
        console.log("doing /sd you");
        generatePicture('sd', 'you');
    }

    else if (id == "sd_face") {
        console.log("doing /sd face");
        generatePicture('sd', 'face');
    }

    else if (id == "sd_me") {
        console.log("doing /sd me");
        generatePicture('sd', 'me');
    }

    else if (id == "sd_world") {
        console.log("doing /sd scene");
        generatePicture('sd', 'scene');
    }

    else if (id == "sd_last") {
        console.log("doing /sd last");
        generatePicture('sd', 'last');
    }
});

jQuery(async () => {
    getContext().registerSlashCommand('sd', generatePicture, [], helpString, true, true);

    const settingsHtml = `
    <div class="sd_settings">
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
            <b>Stable Diffusion</b>
            <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
        </div>
        <div class="inline-drawer-content">
            <small><i>Use slash commands to generate images. Type <span class="monospace">/help</span> in chat for more details</i></small>
            <label for="sd_scale">CFG Scale (<span id="sd_scale_value"></span>)</label>
            <input id="sd_scale" type="range" min="${defaultSettings.scale_min}" max="${defaultSettings.scale_max}" step="${defaultSettings.scale_step}" value="${defaultSettings.scale}" />
            <label for="sd_steps">Sampling steps (<span id="sd_steps_value"></span>)</label>
            <input id="sd_steps" type="range" min="${defaultSettings.steps_min}" max="${defaultSettings.steps_max}" step="${defaultSettings.steps_step}" value="${defaultSettings.steps}" />
            <label for="sd_width">Width (<span id="sd_width_value"></span>)</label>
            <input id="sd_width" type="range" max="${defaultSettings.dimension_max}" min="${defaultSettings.dimension_min}" step="${defaultSettings.dimension_step}" value="${defaultSettings.width}" />
            <label for="sd_height">Height (<span id="sd_height_value"></span>)</label>
            <input id="sd_height" type="range" max="${defaultSettings.dimension_max}" min="${defaultSettings.dimension_min}" step="${defaultSettings.dimension_step}" value="${defaultSettings.height}" />
            <label for="sd_model">Stable Diffusion model</label>
            <select id="sd_model"></select>
            <label for="sd_sampler">Sampling method</label>
            <select id="sd_sampler"></select>
            <label for="sd_prompt_prefix">Generated prompt prefix</label>
            <textarea id="sd_prompt_prefix" class="text_pole textarea_compact" rows="2"></textarea>
            <label for="sd_negative_prompt">Negative prompt</label>
            <textarea id="sd_negative_prompt" class="text_pole textarea_compact" rows="2"></textarea>
        </div>
    </div>`;

    $('#extensions_settings').append(settingsHtml);
    $('#sd_scale').on('input', onScaleInput);
    $('#sd_steps').on('input', onStepsInput);
    $('#sd_model').on('change', onModelChange);
    $('#sd_sampler').on('change', onSamplerChange);
    $('#sd_prompt_prefix').on('input', onPromptPrefixInput);
    $('#sd_negative_prompt').on('input', onNegativePromptInput);
    $('#sd_width').on('input', onWidthInput);
    $('#sd_height').on('input', onHeightInput);

    $('.sd_settings .inline-drawer-toggle').on('click', function () {
        initScrollHeight($("#sd_prompt_prefix"));
        initScrollHeight($("#sd_negative_prompt"));
    })

    await loadSettings();

});