import {
    substituteParams,
    saveSettingsDebounced,
    systemUserName,
    hideSwipeButtons,
    showSwipeButtons,
    callPopup,
    getRequestHeaders,
    event_types,
    eventSource,
    appendImageToMessage
} from "../../../script.js";
import { getApiUrl, getContext, extension_settings, doExtrasFetch, modules } from "../../extensions.js";
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
    RAW_LAST: 3,
    NOW: 4,
    FACE: 5,
    FREE: 6,
}

const triggerWords = {
    [generationMode.CHARACTER]: ['you'],
    [generationMode.USER]: ['me'],
    [generationMode.SCENARIO]: ['scene'],
    [generationMode.RAW_LAST]: ['raw_last'],
    [generationMode.NOW]: ['last'],
    [generationMode.FACE]: ['face'],
}

const quietPrompts = {
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
    $('#sd_horde').prop('checked', extension_settings.sd.horde);
    $('#sd_horde_nsfw').prop('checked', extension_settings.sd.horde_nsfw);
    $('#sd_horde_karras').prop('checked', extension_settings.sd.horde_karras);
    $('#sd_restore_faces').prop('checked', extension_settings.sd.restore_faces);
    $('#sd_enable_hr').prop('checked', extension_settings.sd.enable_hr);

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

    return substituteParams(stringFormat(quietPrompts[mode], trigger));
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
    const context = getContext();
    const lastMessage = context.chat.slice(-1)[0].mes,
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

    const prevSDHeight = extension_settings.sd.height;
    if (generationType == generationMode.FACE) {
        extension_settings.sd.height = extension_settings.sd.width * 1.5;
    }

    try {
        const prompt = await getPrompt(generationType, message, trigger, quiet_prompt);
        console.log('Processed Stable Diffusion prompt:', prompt);

        context.deactivateSendButtons();
        hideSwipeButtons();

        await sendGenerationRequest(prompt, callback);
    } catch (err) {
        console.trace(err);
        throw new Error('SD prompt text generation failed.')
    }
    finally {
        extension_settings.sd.height = prevSDHeight;
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

    return prompt;
}

async function generatePrompt(quiet_prompt) {
    return processReply(await new Promise(
        async function promptPromise(resolve, reject) {
            try {
                await getContext().generate('quiet', { resolve, reject, quiet_prompt, force_name2: true, });
            }
            catch {
                reject();
            }
        }));
}

async function sendGenerationRequest(prompt, callback) {
    if (extension_settings.sd.horde) {
        await generateHordeImage(prompt, callback);
    } else {
        await generateExtrasImage(prompt, callback);
    }
}

async function generateExtrasImage(prompt, callback) {
    console.log(extension_settings.sd);
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
            prompt_prefix: extension_settings.sd.prompt_prefix,
            negative_prompt: extension_settings.sd.negative_prompt,
            restore_faces: !!extension_settings.sd.restore_faces,
            enable_hr: !!extension_settings.sd.enable_hr,
            karras: !!extension_settings.sd.horde_karras,
        }),
    });

    if (result.ok) {
        const data = await result.json();
        const base64Image = `data:image/jpeg;base64,${data.image}`;
        callback ? callback(prompt, base64Image) : sendMessage(prompt, base64Image);
    } else {
        callPopup('Image generation has failed. Please try again.', 'text');
    }
}

async function generateHordeImage(prompt, callback) {
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
            prompt_prefix: extension_settings.sd.prompt_prefix,
            negative_prompt: extension_settings.sd.negative_prompt,
            model: extension_settings.sd.model,
            nsfw: extension_settings.sd.horde_nsfw,
            restore_faces: !!extension_settings.sd.restore_faces,
            enable_hr: !!extension_settings.sd.enable_hr,
        }),
    });

    if (result.ok) {
        const data = await result.text();
        const base64Image = `data:image/webp;base64,${data}`;
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
        if (target.is(button) && !dropdown.is(":visible") && $("#send_but").css('display') === 'flex') {
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
    const messageText = substituteParams(message?.mes);
    const hasSavedImage = message?.extra?.image && message?.extra?.title;

    if ($icon.hasClass(busyClass)) {
        console.log('Previous image is still being generated...');
        return;
    }

    try {
        setBusyIcon(true);
        if (hasSavedImage) {
            const prompt = message?.extra?.title;
            console.log('Regenerating an image, using existing prompt:', prompt);
            await sendGenerationRequest(prompt, saveGeneratedImage);
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

    else if (id == "sd_raw_last") {
        console.log("doing /sd raw last");
        generatePicture('sd', 'raw_last');
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
    $('#sd_horde').on('input', onHordeInput);
    $('#sd_horde_nsfw').on('input', onHordeNsfwInput);
    $('#sd_horde_karras').on('input', onHordeKarrasInput);
    $('#sd_restore_faces').on('input', onRestoreFacesInput);
    $('#sd_enable_hr').on('input', onHighResFixInput);

    $('.sd_settings .inline-drawer-toggle').on('click', function () {
        initScrollHeight($("#sd_prompt_prefix"));
        initScrollHeight($("#sd_negative_prompt"));
    })

    eventSource.on(event_types.EXTRAS_CONNECTED, async () => {
        await Promise.all([loadSamplers(), loadModels()]);
    });

    await loadSettings();
    $('body').addClass('sd');
});
