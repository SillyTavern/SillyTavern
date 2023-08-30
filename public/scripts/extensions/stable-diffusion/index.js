import {
    saveSettingsDebounced,
    systemUserName,
    hideSwipeButtons,
    showSwipeButtons,
    callPopup,
    getRequestHeaders,
    event_types,
    eventSource,
    appendImageToMessage,
    generateQuietPrompt,
    this_chid,
} from "../../../script.js";
import { getApiUrl, getContext, extension_settings, doExtrasFetch, modules } from "../../extensions.js";
import { selected_group } from "../../group-chats.js";
import { stringFormat, initScrollHeight, resetScrollHeight, timestampToMoment, getCharaFilename, saveBase64AsFile } from "../../utils.js";
import { getMessageTimeStamp, humanizedDateTime } from "../../RossAscends-mods.js";
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
    RAW_LAST: 3,
    NOW: 4,
    FACE: 5,
    FREE: 6,
    BACKGROUND: 7,
}

const modeLabels = {
    [generationMode.CHARACTER]: 'Character ("Yourself")',
    [generationMode.FACE]: 'Portrait ("Your Face")',
    [generationMode.USER]: 'User ("Me")',
    [generationMode.SCENARIO]: 'Scenario ("The Whole Story")',
    [generationMode.NOW]: 'Last Message',
    [generationMode.RAW_LAST]: 'Raw Last Message',
    [generationMode.BACKGROUND]: 'Background',
}

const triggerWords = {
    [generationMode.CHARACTER]: ['you'],
    [generationMode.USER]: ['me'],
    [generationMode.SCENARIO]: ['scene'],
    [generationMode.RAW_LAST]: ['raw_last'],
    [generationMode.NOW]: ['last'],
    [generationMode.FACE]: ['face'],
    [generationMode.BACKGROUND]: ['background'],
}

const promptTemplates = {
    /*OLD:     [generationMode.CHARACTER]: "Pause your roleplay and provide comma-delimited list of phrases and keywords which describe {{char}}'s physical appearance and clothing. Ignore {{char}}'s personality traits, and chat history when crafting this description. End your response once the comma-delimited list is complete. Do not roleplay when writing this description, and do not attempt to continue the story.", */
    [generationMode.CHARACTER]: "[In the next response I want you to provide only a detailed comma-delimited list of keywords and phrases which describe {{char}}. The list must include all of the following items in this order: name, species and race, gender, age, clothing, occupation, physical features and appearances. Do not include descriptions of non-visual qualities such as personality, movements, scents, mental traits, or anything which could not be seen in a still photograph. Do not write in full sentences. Prefix your description with the phrase 'full body portrait,']",
    //face-specific prompt
    [generationMode.FACE]: "[In the next response I want you to provide only a detailed comma-delimited list of keywords and phrases which describe {{char}}. The list must include all of the following items in this order: name, species and race, gender, age, facial features and expressions, occupation, hair and hair accessories (if any), what they are wearing on their upper body (if anything). Do not describe anything below their neck. Do not include descriptions of non-visual qualities such as personality, movements, scents, mental traits, or anything which could not be seen in a still photograph. Do not write in full sentences. Prefix your description with the phrase 'close up facial portrait,']",
    //prompt for only the last message
    [generationMode.USER]: "[Pause your roleplay and provide a detailed description of {{user}}'s physical appearance from the perspective of {{char}} in the form of a comma-delimited list of keywords and phrases. The list must include all of the following items in this order: name, species and race, gender, age, clothing, occupation, physical features and appearances. Do not include descriptions of non-visual qualities such as personality, movements, scents, mental traits, or anything which could not be seen in a still photograph. Do not write in full sentences. Prefix your description with the phrase 'full body portrait,'. Ignore the rest of the story when crafting this description. Do not roleplay as {{char}} when writing this description, and do not attempt to continue the story.]",
    [generationMode.SCENARIO]: "[Pause your roleplay and provide a detailed description for all of the following: a brief recap of recent events in the story, {{char}}'s appearance, and {{char}}'s surroundings. Do not roleplay while writing this description.]",

    [generationMode.NOW]: `[Pause your roleplay. Your next response must be formatted as a single comma-delimited list of concise keywords.  The list will describe of the visual details included in the last chat message.

    Only mention characters by using pronouns ('he','his','she','her','it','its') or neutral nouns ('male', 'the man', 'female', 'the woman').

    Ignore non-visible things such as feelings, personality traits, thoughts, and spoken dialog.

    Add keywords in this precise order:
    a keyword to describe the location of the scene,
    a keyword to mention how many characters of each gender or type are present in the scene (minimum of two characters:
    {{user}} and {{char}}, example: '2 men ' or '1 man 1 woman ', '1 man 3 robots'),

    keywords to describe the relative physical positioning of the characters to each other (if a commonly known term for the positioning is known use it instead of describing the positioning in detail) + 'POV',

    a single keyword or phrase to describe the primary act taking place in the last chat message,

    keywords to describe {{char}}'s physical appearance and facial expression,
    keywords to describe {{char}}'s actions,
    keywords to describe {{user}}'s physical appearance and actions.

    If character actions involve direct physical interaction with another character, mention specifically which body parts interacting and how.

    A correctly formatted example response would be:
    '(location),(character list by gender),(primary action), (relative character position) POV, (character 1's description and actions), (character 2's description and actions)']`,

    [generationMode.RAW_LAST]: "[Pause your roleplay and provide ONLY the last chat message string back to me verbatim. Do not write anything after the string. Do not roleplay at all in your response. Do not continue the roleplay story.]",
    [generationMode.BACKGROUND]: "[Pause your roleplay and provide a detailed description of {{char}}'s surroundings in the form of a comma-delimited list of keywords and phrases. The list must include all of the following items in this order: location, time of day, weather, lighting, and any other relevant details. Do not include descriptions of characters and non-visual qualities such as names, personality, movements, scents, mental traits, or anything which could not be seen in a still photograph. Do not write in full sentences. Prefix your description with the phrase 'background,'. Ignore the rest of the story when crafting this description. Do not roleplay as {{user}} when writing this description, and do not attempt to continue the story.]",
}

const helpString = [
    `${m('(argument)')} – requests SD to make an image. Supported arguments:`,
    '<ul>',
    `<li>${m(j(triggerWords[generationMode.CHARACTER]))} – AI character full body selfie</li>`,
    `<li>${m(j(triggerWords[generationMode.FACE]))} – AI character face-only selfie</li>`,
    `<li>${m(j(triggerWords[generationMode.USER]))} – user character full body selfie</li>`,
    `<li>${m(j(triggerWords[generationMode.SCENARIO]))} – visual recap of the whole chat scenario</li>`,
    `<li>${m(j(triggerWords[generationMode.NOW]))} – visual recap of the last chat message</li>`,
    `<li>${m(j(triggerWords[generationMode.RAW_LAST]))} – visual recap of the last chat message with no summary</li>`,
    `<li>${m(j(triggerWords[generationMode.BACKGROUND]))} – generate a background for this chat based on the chat's context</li>`,
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

    prompt_prefix: 'best quality, absurdres, masterpiece,',
    negative_prompt: 'lowres, bad anatomy, bad hands, text, error, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry',
    sampler: 'DDIM',
    model: '',

    // Automatic1111/Horde exclusives
    restore_faces: false,
    enable_hr: false,

    // Horde settings
    horde: false,
    horde_nsfw: false,
    horde_karras: true,

    // Refine mode
    refine_mode: false,

    prompts: promptTemplates,
}

async function loadSettings() {
    if (Object.keys(extension_settings.sd).length === 0) {
        Object.assign(extension_settings.sd, defaultSettings);
    }

    if (extension_settings.sd.prompts === undefined) {
        extension_settings.sd.prompts = promptTemplates;
    }

    // Insert missing templates
    for (const [key, value] of Object.entries(promptTemplates)) {
        if (extension_settings.sd.prompts[key] === undefined) {
            extension_settings.sd.prompts[key] = value;
        }
    }

    if (extension_settings.sd.character_prompts === undefined) {
        extension_settings.sd.character_prompts = {};
    }

    $('#sd_scale').val(extension_settings.sd.scale).trigger('input');
    $('#sd_steps').val(extension_settings.sd.steps).trigger('input');
    $('#sd_prompt_prefix').val(extension_settings.sd.prompt_prefix).trigger('input');
    $('#sd_negative_prompt').val(extension_settings.sd.negative_prompt).trigger('input');
    $('#sd_width').val(extension_settings.sd.width).trigger('input');
    $('#sd_height').val(extension_settings.sd.height).trigger('input');
    $('#sd_horde').prop('checked', extension_settings.sd.horde);
    $('#sd_horde_nsfw').prop('checked', extension_settings.sd.horde_nsfw);
    $('#sd_horde_karras').prop('checked', extension_settings.sd.horde_karras);
    $('#sd_restore_faces').prop('checked', extension_settings.sd.restore_faces);
    $('#sd_enable_hr').prop('checked', extension_settings.sd.enable_hr);
    $('#sd_refine_mode').prop('checked', extension_settings.sd.refine_mode);

    addPromptTemplates();

    await Promise.all([loadSamplers(), loadModels()]);
}

function addPromptTemplates() {
    $('#sd_prompt_templates').empty();

    for (const [name, prompt] of Object.entries(extension_settings.sd.prompts)) {
        const label = $('<label></label>')
            .text(modeLabels[name])
            .attr('for', `sd_prompt_${name}`);
        const textarea = $('<textarea></textarea>')
            .addClass('textarea_compact text_pole')
            .attr('id', `sd_prompt_${name}`)
            .attr('rows', 6)
            .val(prompt).on('input', () => {
                extension_settings.sd.prompts[name] = textarea.val();
                saveSettingsDebounced();
            });
        const button = $('<button></button>')
            .addClass('menu_button fa-solid fa-undo')
            .attr('title', 'Restore default')
            .on('click', () => {
                textarea.val(promptTemplates[name]);
                extension_settings.sd.prompts[name] = promptTemplates[name];
                saveSettingsDebounced();
            });
        const container = $('<div></div>')
            .addClass('title_restorable')
            .append(label)
            .append(button)
        $('#sd_prompt_templates').append(container);
        $('#sd_prompt_templates').append(textarea);
    }
}

async function refinePrompt(prompt) {
    if (extension_settings.sd.refine_mode) {
        const refinedPrompt = await callPopup('<h3>Review and edit the prompt:</h3>Press "Cancel" to abort the image generation.', 'input', prompt, { rows: 5, okButton: 'Generate' });

        if (refinedPrompt) {
            return refinedPrompt;
        } else {
            throw new Error('Generation aborted by user.');
        }
    }

    return prompt;
}

function onChatChanged() {
    if (this_chid === undefined || selected_group) {
        $('#sd_character_prompt_block').hide();
        return;
    }

    $('#sd_character_prompt_block').show();
    const key = getCharaFilename(this_chid);
    $('#sd_character_prompt').val(key ? (extension_settings.sd.character_prompts[key] || '') : '');
}

function onCharacterPromptInput() {
    const key = getCharaFilename(this_chid);
    extension_settings.sd.character_prompts[key] = $('#sd_character_prompt').val();
    resetScrollHeight($(this));
    saveSettingsDebounced();
}

function getCharacterPrefix() {
    if (selected_group) {
        return '';
    }

    const key = getCharaFilename(this_chid);

    if (key) {
        return extension_settings.sd.character_prompts[key] || '';
    }

    return '';
}

function combinePrefixes(str1, str2) {
    if (!str2) {
        return str1;
    }

    // Remove leading/trailing white spaces and commas from the strings
    str1 = str1.trim().replace(/^,|,$/g, '');
    str2 = str2.trim().replace(/^,|,$/g, '');

    // Combine the strings with a comma between them
    var result = `${str1}, ${str2},`;

    return result;
}

function onRefineModeInput() {
    extension_settings.sd.refine_mode = !!$('#sd_refine_mode').prop('checked');
    saveSettingsDebounced();
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

async function onHordeInput() {
    extension_settings.sd.model = null;
    extension_settings.sd.sampler = null;
    extension_settings.sd.horde = !!$(this).prop('checked');
    saveSettingsDebounced();
    await Promise.all([loadModels(), loadSamplers()]);
}

async function onHordeNsfwInput() {
    extension_settings.sd.horde_nsfw = !!$(this).prop('checked');
    saveSettingsDebounced();
}

async function onHordeKarrasInput() {
    extension_settings.sd.horde_karras = !!$(this).prop('checked');
    saveSettingsDebounced();
}

function onRestoreFacesInput() {
    extension_settings.sd.restore_faces = !!$(this).prop('checked');
    saveSettingsDebounced();
}

function onHighResFixInput() {
    extension_settings.sd.enable_hr = !!$(this).prop('checked');
    saveSettingsDebounced();
}

async function onModelChange() {
    extension_settings.sd.model = $('#sd_model').find(':selected').val();
    saveSettingsDebounced();

    if (!extension_settings.sd.horde) {
        await updateExtrasRemoteModel();
    }
}

async function updateExtrasRemoteModel() {
    const url = new URL(getApiUrl());
    url.pathname = '/api/image/model';
    const getCurrentModelResult = await doExtrasFetch(url, {
        method: 'POST',
        headers: postHeaders,
        body: JSON.stringify({ model: extension_settings.sd.model }),
    });

    if (getCurrentModelResult.ok) {
        console.log('Model successfully updated on SD remote.');
    }
}

async function loadSamplers() {
    $('#sd_sampler').empty();
    let samplers = [];

    if (extension_settings.sd.horde) {
        samplers = await loadHordeSamplers();
    } else {
        samplers = await loadExtrasSamplers();
    }

    for (const sampler of samplers) {
        const option = document.createElement('option');
        option.innerText = sampler;
        option.value = sampler;
        option.selected = sampler === extension_settings.sd.sampler;
        $('#sd_sampler').append(option);
    }
}

async function loadHordeSamplers() {
    const result = await fetch('/horde_samplers', {
        method: 'POST',
        headers: getRequestHeaders(),
    });

    if (result.ok) {
        const data = await result.json();
        return data;
    }

    return [];
}

async function loadExtrasSamplers() {
    if (!modules.includes('sd')) {
        return [];
    }

    const url = new URL(getApiUrl());
    url.pathname = '/api/image/samplers';
    const result = await doExtrasFetch(url);

    if (result.ok) {
        const data = await result.json();
        return data.samplers;
    }

    return [];
}

async function loadModels() {
    $('#sd_model').empty();
    let models = [];

    if (extension_settings.sd.horde) {
        models = await loadHordeModels();
    } else {
        models = await loadExtrasModels();
    }

    for (const model of models) {
        const option = document.createElement('option');
        option.innerText = model.text;
        option.value = model.value;
        option.selected = model.value === extension_settings.sd.model;
        $('#sd_model').append(option);
    }
}

async function loadHordeModels() {
    const result = await fetch('/horde_models', {
        method: 'POST',
        headers: getRequestHeaders(),
    });


    if (result.ok) {
        const data = await result.json();
        data.sort((a, b) => b.count - a.count);
        const models = data.map(x => ({ value: x.name, text: `${x.name} (ETA: ${x.eta}s, Queue: ${x.queued}, Workers: ${x.count})` }));
        return models;
    }

    return [];
}

async function loadExtrasModels() {
    if (!modules.includes('sd')) {
        return [];
    }

    const url = new URL(getApiUrl());
    url.pathname = '/api/image/model';
    const getCurrentModelResult = await doExtrasFetch(url);

    if (getCurrentModelResult.ok) {
        const data = await getCurrentModelResult.json();
        extension_settings.sd.model = data.model;
    }

    url.pathname = '/api/image/models';
    const getModelsResult = await doExtrasFetch(url);

    if (getModelsResult.ok) {
        const data = await getModelsResult.json();
        const view_models = data.models.map(x => ({ value: x, text: x }));
        return view_models;
    }

    return [];
}

function getGenerationType(prompt) {
    for (const [key, values] of Object.entries(triggerWords)) {
        for (const value of values) {
            if (value.toLowerCase() === prompt.toLowerCase().trim()) {
                return Number(key);
            }
        }
    }

    return generationMode.FREE;
}

function getQuietPrompt(mode, trigger) {
    if (mode === generationMode.FREE) {
        return trigger;
    }

    return stringFormat(extension_settings.sd.prompts[mode], trigger);
}

function processReply(str) {
    if (!str) {
        return '';
    }

    str = str.replaceAll('"', '')
    str = str.replaceAll('“', '')
    str = str.replaceAll('.', ',')
    str = str.replaceAll('\n', ', ')
    str = str.replace(/[^a-zA-Z0-9,:()]+/g, ' ') // Replace everything except alphanumeric characters and commas with spaces
    str = str.replace(/\s+/g, ' '); // Collapse multiple whitespaces into one
    str = str.trim();

    str = str
        .split(',') // list split by commas
        .map(x => x.trim()) // trim each entry
        .filter(x => x) // remove empty entries
        .join(', '); // join it back with proper spacing

    return str;
}


function getRawLastMessage() {
    const getLastUsableMessage = () => {
        for (const message of context.chat.slice().reverse()) {
            if (message.is_system) {
                continue;
            }

            return message.mes;
        }

        toastr.warning('No usable messages found.', 'Stable Diffusion');
        throw new Error('No usable messages found.');
    }

    const context = getContext();
    const lastMessage = getLastUsableMessage(),
        characterDescription = context.characters[context.characterId].description,
        situation = context.characters[context.characterId].scenario;
    return `((${processReply(lastMessage)})), (${processReply(situation)}:0.7), (${processReply(characterDescription)}:0.5)`
}

async function generatePicture(_, trigger, message, callback) {
    if (!trigger || trigger.trim().length === 0) {
        console.log('Trigger word empty, aborting');
        return;
    }

    if (!modules.includes('sd') && !extension_settings.sd.horde) {
        toastr.warning("Extensions API is not connected or doesn't provide SD module. Enable Stable Horde to generate images.");
        return;
    }

    extension_settings.sd.sampler = $('#sd_sampler').find(':selected').val();
    extension_settings.sd.model = $('#sd_model').find(':selected').val();

    trigger = trigger.trim();
    const generationType = getGenerationType(trigger);
    console.log('Generation mode', generationType, 'triggered with', trigger);
    const quiet_prompt = getQuietPrompt(generationType, trigger);
    const context = getContext();

    // if context.characterId is not null, then we get context.characters[context.characterId].avatar, else we get groupId and context.groups[groupId].id
    // sadly, groups is not an array, but is a dict with keys being index numbers, so we have to filter it
    const characterName = context.characterId ? context.characters[context.characterId].name : context.groups[Object.keys(context.groups).filter(x => context.groups[x].id === context.groupId)[0]].id.toString();

    const prevSDHeight = extension_settings.sd.height;
    const prevSDWidth = extension_settings.sd.width;
    const aspectRatio = extension_settings.sd.width / extension_settings.sd.height;

    // Face images are always portrait (pun intended)
    if (generationType == generationMode.FACE && aspectRatio >= 1) {
        // Round to nearest multiple of 64
        extension_settings.sd.height = Math.round(extension_settings.sd.width * 1.5 / 64) * 64;
    }

    // Background images are always landscape
    if (generationType == generationMode.BACKGROUND && aspectRatio <= 1) {
        // Round to nearest multiple of 64
        extension_settings.sd.width = Math.round(extension_settings.sd.height * 1.8 / 64) * 64;
        const callbackOriginal = callback;
        callback = async function (prompt, base64Image) {
            const imagePath = base64Image;
            const imgUrl = `url('${encodeURIComponent(base64Image)}')`;

            if ('forceSetBackground' in window) {
                forceSetBackground(imgUrl);
            } else {
                toastr.info('Background image will not be preserved.', '"Chat backgrounds" extension is disabled.');
                $('#bg_custom').css('background-image', imgUrl);
            }

            if (typeof callbackOriginal === 'function') {
                callbackOriginal(prompt, imagePath);
            } else {
                sendMessage(prompt, imagePath);
            }
        }
    }

    try {
        const prompt = await getPrompt(generationType, message, trigger, quiet_prompt);
        console.log('Processed Stable Diffusion prompt:', prompt);

        context.deactivateSendButtons();
        hideSwipeButtons();

        await sendGenerationRequest(generationType, prompt, characterName, callback);
    } catch (err) {
        console.trace(err);
        throw new Error('SD prompt text generation failed.')
    }
    finally {
        extension_settings.sd.height = prevSDHeight;
        extension_settings.sd.width = prevSDWidth;
        context.activateSendButtons();
        showSwipeButtons();
    }
}

async function getPrompt(generationType, message, trigger, quiet_prompt) {
    let prompt;

    switch (generationType) {
        case generationMode.RAW_LAST:
            prompt = message || getRawLastMessage();
            break;
        case generationMode.FREE:
            prompt = trigger.trim();
            break;
        default:
            prompt = await generatePrompt(quiet_prompt);
            break;
    }

    if (generationType !== generationMode.FREE) {
        prompt = await refinePrompt(prompt);
    }

    return prompt;
}

async function generatePrompt(quiet_prompt) {
    const reply = await generateQuietPrompt(quiet_prompt);
    return processReply(reply);
}

async function sendGenerationRequest(generationType, prompt, characterName = null, callback) {
    const prefix = generationType !== generationMode.BACKGROUND
        ? combinePrefixes(extension_settings.sd.prompt_prefix, getCharacterPrefix())
        : extension_settings.sd.prompt_prefix;

    if (extension_settings.sd.horde) {
        await generateHordeImage(prompt, prefix, characterName, callback);
    } else {
        await generateExtrasImage(prompt, prefix, characterName, callback);
    }
}

/**
 * Generates an "extras" image using a provided prompt and other settings,
 * then saves the generated image and either invokes a callback or sends a message with the image.
 *
 * @param {string} prompt - The main instruction used to guide the image generation.
 * @param {string} prefix - Additional context or prefix to guide the image generation.
 * @param {string} characterName - The name used to determine the sub-directory for saving.
 * @param {function} [callback] - Optional callback function invoked with the prompt and saved image.
 *                                If not provided, `sendMessage` is called instead.
 *
 * @returns {Promise<void>} - A promise that resolves when the image generation and processing are complete.
 */
async function generateExtrasImage(prompt, prefix, characterName, callback) {
    console.debug(extension_settings.sd);
    const url = new URL(getApiUrl());
    url.pathname = '/api/image';
    const result = await doExtrasFetch(url, {
        method: 'POST',
        headers: postHeaders,
        body: JSON.stringify({
            prompt: prompt,
            sampler: extension_settings.sd.sampler,
            steps: extension_settings.sd.steps,
            scale: extension_settings.sd.scale,
            width: extension_settings.sd.width,
            height: extension_settings.sd.height,
            prompt_prefix: prefix,
            negative_prompt: extension_settings.sd.negative_prompt,
            restore_faces: !!extension_settings.sd.restore_faces,
            enable_hr: !!extension_settings.sd.enable_hr,
            karras: !!extension_settings.sd.horde_karras,
        }),
    });

    if (result.ok) {
        const data = await result.json();
        //filename should be character name + human readable timestamp + generation mode
        const filename = `${characterName}_${humanizedDateTime()}`;
        const base64Image = await saveBase64AsFile(data.image, characterName, filename, "jpg");
        callback ? callback(prompt, base64Image) : sendMessage(prompt, base64Image);
    } else {
        callPopup('Image generation has failed. Please try again.', 'text');
    }
}

/**
 * Generates a "horde" image using the provided prompt and configuration settings,
 * then saves the generated image and either invokes a callback or sends a message with the image.
 *
 * @param {string} prompt - The main instruction used to guide the image generation.
 * @param {string} prefix - Additional context or prefix to guide the image generation.
 * @param {string} characterName - The name used to determine the sub-directory for saving.
 * @param {function} [callback] - Optional callback function invoked with the prompt and saved image.
 *                                If not provided, `sendMessage` is called instead.
 *
 * @returns {Promise<void>} - A promise that resolves when the image generation and processing are complete.
 */
async function generateHordeImage(prompt, prefix, characterName, callback) {
    const result = await fetch('/horde_generateimage', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            prompt: prompt,
            sampler: extension_settings.sd.sampler,
            steps: extension_settings.sd.steps,
            scale: extension_settings.sd.scale,
            width: extension_settings.sd.width,
            height: extension_settings.sd.height,
            prompt_prefix: prefix,
            negative_prompt: extension_settings.sd.negative_prompt,
            model: extension_settings.sd.model,
            nsfw: extension_settings.sd.horde_nsfw,
            restore_faces: !!extension_settings.sd.restore_faces,
            enable_hr: !!extension_settings.sd.enable_hr,
        }),
    });

    if (result.ok) {
        const data = await result.text();
        const filename = `${characterName}_${humanizedDateTime()}`;
        const base64Image = await saveBase64AsFile(data, characterName, filename, "webp");
        callback ? callback(prompt, base64Image) : sendMessage(prompt, base64Image);
    } else {
        toastr.error('Image generation has failed. Please try again.');
    }
}

async function sendMessage(prompt, image) {
    const context = getContext();
    const messageText = `[${context.name2} sends a picture that contains: ${prompt}]`;
    const message = {
        name: context.groupId ? systemUserName : context.name2,
        is_user: false,
        is_system: true,
        is_name: true,
        send_date: getMessageTimeStamp(),
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
    <div id="sd_gen" class="list-group-item flex-container flexGap5">
        <div class="fa-solid fa-paintbrush extensionsMenuExtensionButton" title="Trigger Stable Diffusion" /></div>
        Stable Diffusion
    </div>
        `;

    const waitButtonHtml = `
        <div id="sd_gen_wait" class="fa-solid fa-hourglass-half" /></div>
    `
    const dropdownHtml = `
    <div id="sd_dropdown">
        <ul class="list-group">
        <span>Send me a picture of:</span>
            <li class="list-group-item" id="sd_you" data-value="you">Yourself</li>
            <li class="list-group-item" id="sd_face" data-value="face">Your Face</li>
            <li class="list-group-item" id="sd_me" data-value="me">Me</li>
            <li class="list-group-item" id="sd_world" data-value="world">The Whole Story</li>
            <li class="list-group-item" id="sd_last" data-value="last">The Last Message</li>
            <li class="list-group-item" id="sd_raw_last" data-value="raw_last">Raw Last Message</li>
            <li class="list-group-item" id="sd_background" data-value="background">Background</li>
        </ul>
    </div>`;

    $('#extensionsMenu').prepend(buttonHtml);
    $('#extensionsMenu').prepend(waitButtonHtml);
    $(document.body).append(dropdownHtml);

    const messageButton = $('.sd_message_gen');
    const button = $('#sd_gen');
    const waitButton = $("#sd_gen_wait");
    const dropdown = $('#sd_dropdown');
    waitButton.hide();
    dropdown.hide();
    button.hide();
    messageButton.hide();

    let popper = Popper.createPopper(button.get(0), dropdown.get(0), {
        placement: 'top',
    });

    $(document).on('click', '.sd_message_gen', sdMessageButton);

    $(document).on('click touchend', function (e) {
        const target = $(e.target);
        if (target.is(dropdown)) return;
        if (target.is(button) && !dropdown.is(":visible") && $("#send_but").is(":visible")) {
            e.preventDefault();

            dropdown.fadeIn(250);
            popper.update();
        } else {
            dropdown.fadeOut(250);
        }
    });
}

function isConnectedToExtras() {
    return modules.includes('sd');
}

async function moduleWorker() {
    if (isConnectedToExtras() || extension_settings.sd.horde) {
        $('#sd_gen').show();
        $('.sd_message_gen').show();
    }
    else {
        $('#sd_gen').hide();
        $('.sd_message_gen').hide();
    }
}

addSDGenButtons();
setInterval(moduleWorker, UPDATE_INTERVAL);

async function sdMessageButton(e) {
    function setBusyIcon(isBusy) {
        $icon.toggleClass('fa-paintbrush', !isBusy);
        $icon.toggleClass(busyClass, isBusy);
    }

    const busyClass = 'fa-hourglass';
    const context = getContext();
    const $icon = $(e.currentTarget);
    const $mes = $icon.closest('.mes');
    const message_id = $mes.attr('mesid');
    const message = context.chat[message_id];
    const characterName = message?.name || context.name2;
    const messageText = message?.mes;
    const hasSavedImage = message?.extra?.image && message?.extra?.title;

    if ($icon.hasClass(busyClass)) {
        console.log('Previous image is still being generated...');
        return;
    }

    try {
        setBusyIcon(true);
        if (hasSavedImage) {
            const prompt = await refinePrompt(message.extra.title);
            message.extra.title = prompt;

            console.log('Regenerating an image, using existing prompt:', prompt);
            await sendGenerationRequest(generationMode.FREE, prompt, characterName, saveGeneratedImage);
        }
        else {
            console.log("doing /sd raw last");
            await generatePicture('sd', 'raw_last', `${characterName} said: ${messageText}`, saveGeneratedImage);
        }
    }
    catch (error) {
        console.error('Could not generate inline image: ', error);
    }
    finally {
        setBusyIcon(false);
    }

    function saveGeneratedImage(prompt, image) {
        // Some message sources may not create the extra object
        if (typeof message.extra !== 'object') {
            message.extra = {};
        }

        // If already contains an image and it's not inline - leave it as is
        message.extra.inline_image = message.extra.image && !message.extra.inline_image ? false : true;
        message.extra.image = image;
        message.extra.title = prompt;
        appendImageToMessage(message, $mes);

        context.saveChat();
    }
};

$("#sd_dropdown [id]").on("click", function () {
    const id = $(this).attr("id");
    const idParamMap = {
        "sd_you": "you",
        "sd_face": "face",
        "sd_me": "me",
        "sd_world": "scene",
        "sd_last": "last",
        "sd_raw_last": "raw_last",
        "sd_background": "background"
    };

    const param = idParamMap[id];

    if (param) {
        console.log("doing /sd " + param)
        generatePicture('sd', param);
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
                <small><i>Use slash commands or the bottom Paintbrush button to generate images. Type <span class="monospace">/help</span> in chat for more details</i></small>
                <br>
                <small><i>Hint: Save an API key in Horde KoboldAI API settings to use it here.</i></small>
                <label for="sd_refine_mode" class="checkbox_label" title="Allow to edit prompts manually before sending them to generation API">
                    <input id="sd_refine_mode" type="checkbox" />
                    Edit prompts before generation
                </label>
                <div class="flex-container flexGap5 marginTop10 margin-bot-10px">
                    <label class="checkbox_label">
                        <input id="sd_horde" type="checkbox" />
                        Use Stable Horde
                    </label>
                    <label style="margin-left:1em;" class="checkbox_label">
                        <input id="sd_horde_nsfw" type="checkbox" />
                        Allow NSFW images from Horde
                    </label>
                </div>
                <label for="sd_scale">CFG Scale (<span id="sd_scale_value"></span>)</label>
                <input id="sd_scale" type="range" min="${defaultSettings.scale_min}" max="${defaultSettings.scale_max}" step="${defaultSettings.scale_step}" value="${defaultSettings.scale}" />
                <label for="sd_steps">Sampling steps (<span id="sd_steps_value"></span>)</label>
                <input id="sd_steps" type="range" min="${defaultSettings.steps_min}" max="${defaultSettings.steps_max}" step="${defaultSettings.steps_step}" value="${defaultSettings.steps}" />
                <label for="sd_width">Width (<span id="sd_width_value"></span>)</label>
                <input id="sd_width" type="range" max="${defaultSettings.dimension_max}" min="${defaultSettings.dimension_min}" step="${defaultSettings.dimension_step}" value="${defaultSettings.width}" />
                <label for="sd_height">Height (<span id="sd_height_value"></span>)</label>
                <input id="sd_height" type="range" max="${defaultSettings.dimension_max}" min="${defaultSettings.dimension_min}" step="${defaultSettings.dimension_step}" value="${defaultSettings.height}" />
                <div><small>Only for Horde or remote Stable Diffusion Web UI:</small></div>
                <div class="flex-container marginTop10 margin-bot-10px">
                    <label class="flex1 checkbox_label">
                        <input id="sd_restore_faces" type="checkbox" />
                        Restore Faces
                    </label>
                    <label class="flex1 checkbox_label">
                        <input id="sd_enable_hr" type="checkbox" />
                        Hires. Fix
                    </label>
                </div>
                <label for="sd_model">Stable Diffusion model</label>
                <select id="sd_model"></select>
                <label for="sd_sampler">Sampling method</label>
                <select id="sd_sampler"></select>
                <div class="flex-container flexGap5 margin-bot-10px">
                    <label class="checkbox_label">
                        <input id="sd_horde_karras" type="checkbox" />
                        Karras (only for Horde, not all samplers supported)
                    </label>
                </div>
                <label for="sd_prompt_prefix">Common prompt prefix</label>
                <textarea id="sd_prompt_prefix" class="text_pole textarea_compact" rows="3"></textarea>
                <div id="sd_character_prompt_block">
                    <label for="sd_character_prompt">Character-specific prompt prefix</label>
                    <small>Won't be used in groups.</small>
                    <textarea id="sd_character_prompt" class="text_pole textarea_compact" rows="3" placeholder="Any characteristics that describe the currently selected character. Will be added after a common prefix.&#10;Example: female, green eyes, brown hair, pink shirt"></textarea>
                </div>
                <label for="sd_negative_prompt">Negative prompt</label>
                <textarea id="sd_negative_prompt" class="text_pole textarea_compact" rows="3"></textarea>
            </div>
        </div>
        <div class="inline-drawer">
            <div class="inline-drawer-toggle inline-drawer-header">
                <b>SD Prompt Templates</b>
                <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
            </div>
            <div id="sd_prompt_templates" class="inline-drawer-content">
            </div>
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
    $('#sd_horde').on('input', onHordeInput);
    $('#sd_horde_nsfw').on('input', onHordeNsfwInput);
    $('#sd_horde_karras').on('input', onHordeKarrasInput);
    $('#sd_restore_faces').on('input', onRestoreFacesInput);
    $('#sd_enable_hr').on('input', onHighResFixInput);
    $('#sd_refine_mode').on('input', onRefineModeInput);
    $('#sd_character_prompt').on('input', onCharacterPromptInput);
    $('#sd_character_prompt_block').hide();

    $('.sd_settings .inline-drawer-toggle').on('click', function () {
        initScrollHeight($("#sd_prompt_prefix"));
        initScrollHeight($("#sd_negative_prompt"));
        initScrollHeight($("#sd_character_prompt"));
    })

    eventSource.on(event_types.EXTRAS_CONNECTED, async () => {
        await Promise.all([loadSamplers(), loadModels()]);
    });

    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);

    await loadSettings();
    $('body').addClass('sd');
});
