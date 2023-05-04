import {
    substituteParams,
    saveSettingsDebounced,
    systemUserName,
    hideSwipeButtons,
    showSwipeButtons
} from "../../../script.js";
import { getApiUrl, getContext, extension_settings, defaultRequestArgs } from "../../extensions.js";
import { stringFormat } from "../../utils.js";

// Wraps a string into monospace font-face span
const m = x => `<span class="monospace">${x}</span>`;
// Joins an array of strings with ' / '
const j = a => a.join(' / ');
// Wraps a string into paragraph block
const p = a => `<p>${a}</p>`

const postHeaders = {
    'Content-Type': 'application/json',
    'Bypass-Tunnel-Reminder': 'bypass',
};

const generationMode = {
    CHARACTER: 0,
    USER: 1,
    SCENARIO: 2,
    FREE: 3,
}

const triggerWords = {
    [generationMode.CHARACTER]: ['yourself', 'you', 'bot', 'AI', 'character'],
    [generationMode.USER]: ['me', 'user', 'myself'],
    [generationMode.SCENARIO]: ['scenario', 'world', 'surroundings', 'scenery'],
}

const quietPrompts = {
    [generationMode.CHARACTER]: "[Please provide a detailed description of {{char}}'s appearance]",
    [generationMode.USER]: "[Please provide a detailed description of {{user}}'s appearance]",
    [generationMode.SCENARIO]: "[Provide a detailed description for all of the following: {{char}}'s appearance, {{char}}'s surroundings, a brief recap of recent events in the story.]",
    [generationMode.FREE]: "[Please provide a detailed and vivid description of {0}]",
}

const helpString = [
    `${m('what')} – requests an SD generation. Supported "what" arguments:`,
    '<ul>',
    `<li>${m(j(triggerWords[generationMode.CHARACTER]))} – AI character image</li>`,
    `<li>${m(j(triggerWords[generationMode.USER]))} – user character image</li>`,
    `<li>${m(j(triggerWords[generationMode.SCENARIO]))} – world scenario image</li>`,
    '</ul>',
    `Anything else would trigger a "free mode" with AI describing whatever you prompted.`,
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
    saveSettingsDebounced();
}

function onNegativePromptInput() {
    extension_settings.sd.negative_prompt = $('#sd_negative_prompt').val();
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
    str = str.replaceAll('\n', ' ')
    str = str.trim();

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
                    await context.generate('quiet', { resolve, reject, quiet_prompt });
                }
                catch {
                    reject();
                }
            }));

        context.deactivateSendButtons();
        hideSwipeButtons();

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
                model: extension_settings.sd.model,
                width: extension_settings.sd.width,
                height: extension_settings.sd.height,
                prompt_prefix: extension_settings.sd.prompt_prefix,
                negative_prompt: extension_settings.sd.negative_prompt,
            }),
        });

        if (result.ok) {
            const data = await result.json();
            const base64Image = `data:image/jpeg;base64,${data.image}`;
            sendMessage(prompt, base64Image);
        }
    } catch (err) {
        console.error(err);
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

jQuery(async () => {
    getContext().registerSlashCommand('sd', generatePicture, ['picture', 'image'], helpString, true, true);

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
            <textarea id="sd_prompt_prefix" class="text_pole textarea_compact" rows="1"></textarea>
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
    await loadSettings();
});