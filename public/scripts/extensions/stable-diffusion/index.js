import {
    saveSettingsDebounced,
    systemUserName,
    hideSwipeButtons,
    showSwipeButtons,
    getRequestHeaders,
    event_types,
    eventSource,
    generateQuietPrompt,
    this_chid,
    getCurrentChatId,
    animation_duration,
    appendMediaToMessage,
    getUserAvatar,
    user_avatar,
    getCharacterAvatar,
    formatCharacterAvatar,
    substituteParams,
    substituteParamsExtended,
} from '../../../script.js';
import { getApiUrl, getContext, extension_settings, doExtrasFetch, modules, renderExtensionTemplateAsync, writeExtensionField } from '../../extensions.js';
import { selected_group } from '../../group-chats.js';
import { stringFormat, initScrollHeight, resetScrollHeight, getCharaFilename, saveBase64AsFile, getBase64Async, delay, isTrueBoolean, debounce } from '../../utils.js';
import { getMessageTimeStamp, humanizedDateTime } from '../../RossAscends-mods.js';
import { SECRET_KEYS, secret_state, writeSecret } from '../../secrets.js';
import { getNovelUnlimitedImageGeneration, getNovelAnlas, loadNovelSubscriptionData } from '../../nai-settings.js';
import { getMultimodalCaption } from '../shared.js';
import { SlashCommandParser } from '../../slash-commands/SlashCommandParser.js';
import { SlashCommand } from '../../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from '../../slash-commands/SlashCommandArgument.js';
import { debounce_timeout } from '../../constants.js';
import { SlashCommandEnumValue } from '../../slash-commands/SlashCommandEnumValue.js';
import { POPUP_RESULT, POPUP_TYPE, Popup, callGenericPopup } from '../../popup.js';
export { MODULE_NAME };

const MODULE_NAME = 'sd';
const UPDATE_INTERVAL = 1000;
// This is a 1x1 transparent PNG
const PNG_PIXEL = 'iVBORw0KGgoAAAANSUhEUgAAAAEAAAABCAQAAAC1HAwCAAAAC0lEQVR42mNkYAAAAAYAAjCB0C8AAAAASUVORK5CYII=';
const CUSTOM_STOP_EVENT = 'sd_stop_generation';

const sources = {
    extras: 'extras',
    horde: 'horde',
    auto: 'auto',
    novel: 'novel',
    vlad: 'vlad',
    openai: 'openai',
    comfy: 'comfy',
    togetherai: 'togetherai',
    drawthings: 'drawthings',
    pollinations: 'pollinations',
    stability: 'stability',
    blockentropy: 'blockentropy',
    huggingface: 'huggingface',
};

const initiators = {
    command: 'command',
    action: 'action',
    interactive: 'interactive',
    wand: 'wand',
    swipe: 'swipe',
};

const generationMode = {
    MESSAGE: -1,
    CHARACTER: 0,
    USER: 1,
    SCENARIO: 2,
    RAW_LAST: 3,
    NOW: 4,
    FACE: 5,
    FREE: 6,
    BACKGROUND: 7,
    CHARACTER_MULTIMODAL: 8,
    USER_MULTIMODAL: 9,
    FACE_MULTIMODAL: 10,
    FREE_EXTENDED: 11,
};

const multimodalMap = {
    [generationMode.CHARACTER]: generationMode.CHARACTER_MULTIMODAL,
    [generationMode.USER]: generationMode.USER_MULTIMODAL,
    [generationMode.FACE]: generationMode.FACE_MULTIMODAL,
};

const modeLabels = {
    [generationMode.MESSAGE]: 'Chat Message Template',
    [generationMode.CHARACTER]: 'Character ("Yourself")',
    [generationMode.FACE]: 'Portrait ("Your Face")',
    [generationMode.USER]: 'User ("Me")',
    [generationMode.SCENARIO]: 'Scenario ("The Whole Story")',
    [generationMode.NOW]: 'Last Message',
    [generationMode.RAW_LAST]: 'Raw Last Message',
    [generationMode.BACKGROUND]: 'Background',
    [generationMode.CHARACTER_MULTIMODAL]: 'Character (Multimodal Mode)',
    [generationMode.FACE_MULTIMODAL]: 'Portrait (Multimodal Mode)',
    [generationMode.USER_MULTIMODAL]: 'User (Multimodal Mode)',
    [generationMode.FREE_EXTENDED]: 'Free Mode (LLM-Extended)',
};

const triggerWords = {
    [generationMode.CHARACTER]: ['you'],
    [generationMode.USER]: ['me'],
    [generationMode.SCENARIO]: ['scene'],
    [generationMode.RAW_LAST]: ['raw_last'],
    [generationMode.NOW]: ['last'],
    [generationMode.FACE]: ['face'],
    [generationMode.BACKGROUND]: ['background'],
};

const messageTrigger = {
    activationRegex: /\b(send|mail|imagine|generate|make|create|draw|paint|render|show)\b.{0,10}\b(pic|picture|image|drawing|painting|photo|photograph)\b(?:\s+of)?(?:\s+(?:a|an|the|this|that|those|your)?)?(.+)/i,
    specialCases: {
        [generationMode.CHARACTER]: ['you', 'yourself'],
        [generationMode.USER]: ['me', 'myself'],
        [generationMode.SCENARIO]: ['story', 'scenario', 'whole story'],
        [generationMode.NOW]: ['last message'],
        [generationMode.FACE]: ['your face', 'your portrait', 'your selfie'],
        [generationMode.BACKGROUND]: ['background', 'scene background', 'scene', 'scenery', 'surroundings', 'environment'],
    },
};

const promptTemplates = {
    // Not really a prompt template, rather an outcome message template
    [generationMode.MESSAGE]: '[{{char}} sends a picture that contains: {{prompt}}].',
    [generationMode.CHARACTER]: 'In the next response I want you to provide only a detailed comma-delimited list of keywords and phrases which describe {{char}}. The list must include all of the following items in this order: name, species and race, gender, age, clothing, occupation, physical features and appearances. Do not include descriptions of non-visual qualities such as personality, movements, scents, mental traits, or anything which could not be seen in a still photograph. Do not write in full sentences. Prefix your description with the phrase \'full body portrait,\'',
    //face-specific prompt
    [generationMode.FACE]: 'In the next response I want you to provide only a detailed comma-delimited list of keywords and phrases which describe {{char}}. The list must include all of the following items in this order: name, species and race, gender, age, facial features and expressions, occupation, hair and hair accessories (if any), what they are wearing on their upper body (if anything). Do not describe anything below their neck. Do not include descriptions of non-visual qualities such as personality, movements, scents, mental traits, or anything which could not be seen in a still photograph. Do not write in full sentences. Prefix your description with the phrase \'close up facial portrait,\'',
    //prompt for only the last message
    [generationMode.USER]: 'Ignore previous instructions and provide a detailed description of {{user}}\'s physical appearance from the perspective of {{char}} in the form of a comma-delimited list of keywords and phrases. The list must include all of the following items in this order: name, species and race, gender, age, clothing, occupation, physical features and appearances. Do not include descriptions of non-visual qualities such as personality, movements, scents, mental traits, or anything which could not be seen in a still photograph. Do not write in full sentences. Prefix your description with the phrase \'full body portrait,\'. Ignore the rest of the story when crafting this description. Do not reply as {{char}} when writing this description, and do not attempt to continue the story.',
    [generationMode.SCENARIO]: 'Ignore previous instructions and provide a detailed description for all of the following: a brief recap of recent events in the story, {{char}}\'s appearance, and {{char}}\'s surroundings. Do not reply as {{char}} while writing this description.',

    [generationMode.NOW]: `Ignore previous instructions. Your next response must be formatted as a single comma-delimited list of concise keywords.  The list will describe of the visual details included in the last chat message.

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
    '(location),(character list by gender),(primary action), (relative character position) POV, (character 1's description and actions), (character 2's description and actions)'`,

    [generationMode.RAW_LAST]: 'Ignore previous instructions and provide ONLY the last chat message string back to me verbatim. Do not write anything after the string. Do not reply as {{char}} when writing this description, and do not attempt to continue the story.',
    [generationMode.BACKGROUND]: 'Ignore previous instructions and provide a detailed description of {{char}}\'s surroundings in the form of a comma-delimited list of keywords and phrases. The list must include all of the following items in this order: location, time of day, weather, lighting, and any other relevant details. Do not include descriptions of characters and non-visual qualities such as names, personality, movements, scents, mental traits, or anything which could not be seen in a still photograph. Do not write in full sentences. Prefix your description with the phrase \'background,\'. Ignore the rest of the story when crafting this description. Do not reply as {{char}} when writing this description, and do not attempt to continue the story.',
    [generationMode.FACE_MULTIMODAL]: 'Provide an exhaustive comma-separated list of tags describing the appearance of the character on this image in great detail. Start with "close-up portrait".',
    [generationMode.CHARACTER_MULTIMODAL]: 'Provide an exhaustive comma-separated list of tags describing the appearance of the character on this image in great detail. Start with "full body portrait".',
    [generationMode.USER_MULTIMODAL]: 'Provide an exhaustive comma-separated list of tags describing the appearance of the character on this image in great detail. Start with "full body portrait".',
    [generationMode.FREE_EXTENDED]: 'Ignore previous instructions and provide an exhaustive comma-separated list of tags describing the appearance of "{0}" in great detail. Start with {{charPrefix}} (sic) if the subject is associated with {{char}}.',
};

const defaultPrefix = 'best quality, absurdres, aesthetic,';
const defaultNegative = 'lowres, bad anatomy, bad hands, text, error, cropped, worst quality, low quality, normal quality, jpeg artifacts, signature, watermark, username, blurry';

const defaultStyles = [
    {
        name: 'Default',
        negative: defaultNegative,
        prefix: defaultPrefix,
    },
];

const placeholderVae = 'Automatic';

const defaultSettings = {
    source: sources.extras,

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

    // Scheduler
    scheduler: 'normal',

    // Image dimensions (Width & Height)
    dimension_min: 64,
    dimension_max: 2048,
    dimension_step: 64,
    width: 512,
    height: 512,

    prompt_prefix: defaultPrefix,
    negative_prompt: defaultNegative,
    sampler: 'DDIM',
    model: '',
    vae: '',
    seed: -1,

    // Automatic1111/Horde exclusives
    restore_faces: false,
    enable_hr: false,

    // Horde settings
    horde: false,
    horde_nsfw: false,
    horde_karras: true,
    horde_sanitize: true,

    // Refine mode
    refine_mode: false,
    expand: false,
    interactive_mode: false,
    multimodal_captioning: false,
    snap: false,
    free_extend: false,

    prompts: promptTemplates,

    // AUTOMATIC1111 settings
    auto_url: 'http://localhost:7860',
    auto_auth: '',

    vlad_url: 'http://localhost:7860',
    vlad_auth: '',

    drawthings_url: 'http://localhost:7860',
    drawthings_auth: '',

    hr_upscaler: 'Latent',
    hr_scale: 2.0,
    hr_scale_min: 1.0,
    hr_scale_max: 4.0,
    hr_scale_step: 0.1,
    denoising_strength: 0.7,
    denoising_strength_min: 0.0,
    denoising_strength_max: 1.0,
    denoising_strength_step: 0.01,
    hr_second_pass_steps: 0,
    hr_second_pass_steps_min: 0,
    hr_second_pass_steps_max: 150,
    hr_second_pass_steps_step: 1,

    // CLIP skip
    clip_skip_min: 1,
    clip_skip_max: 12,
    clip_skip_step: 1,
    clip_skip: 1,

    // NovelAI settings
    novel_upscale_ratio_min: 1.0,
    novel_upscale_ratio_max: 4.0,
    novel_upscale_ratio_step: 0.1,
    novel_upscale_ratio: 1.0,
    novel_anlas_guard: false,
    novel_sm: false,
    novel_sm_dyn: false,
    novel_decrisper: false,

    // OpenAI settings
    openai_style: 'vivid',
    openai_quality: 'standard',

    style: 'Default',
    styles: defaultStyles,

    // ComyUI settings
    comfy_url: 'http://127.0.0.1:8188',
    comfy_workflow: 'Default_Comfy_Workflow.json',

    // Pollinations settings
    pollinations_enhance: false,

    // Visibility toggles
    wand_visible: false,
    command_visible: false,
    interactive_visible: false,

    // Stability AI settings
    stability_style_preset: 'anime',
};

const writePromptFieldsDebounced = debounce(writePromptFields, debounce_timeout.relaxed);

function processTriggers(chat, _, abort) {
    if (!extension_settings.sd.interactive_mode) {
        return;
    }

    const lastMessage = chat[chat.length - 1];

    if (!lastMessage) {
        return;
    }

    const message = lastMessage.mes;
    const isUser = lastMessage.is_user;

    if (!message || !isUser) {
        return;
    }

    const messageLower = message.toLowerCase();

    try {
        const activationRegex = new RegExp(messageTrigger.activationRegex, 'i');
        const activationMatch = messageLower.match(activationRegex);

        if (!activationMatch) {
            return;
        }

        let subject = activationMatch[3].trim();

        if (!subject) {
            return;
        }

        console.log(`SD: Triggered by "${message}", detected subject: ${subject}"`);

        outer: for (const [specialMode, triggers] of Object.entries(messageTrigger.specialCases)) {
            for (const trigger of triggers) {
                if (subject === trigger) {
                    subject = triggerWords[specialMode][0];
                    console.log(`SD: Detected special case "${trigger}", switching to mode ${specialMode}`);
                    break outer;
                }
            }
        }

        abort(true);
        setTimeout(() => generatePicture(initiators.interactive, {}, subject, message), 1);
    } catch {
        console.log('SD: Failed to process triggers.');
        return;
    }
}

window['SD_ProcessTriggers'] = processTriggers;

function getSdRequestBody() {
    switch (extension_settings.sd.source) {
        case sources.vlad:
            return { url: extension_settings.sd.vlad_url, auth: extension_settings.sd.vlad_auth };
        case sources.auto:
            return { url: extension_settings.sd.auto_url, auth: extension_settings.sd.auto_auth };
        case sources.drawthings:
            return { url: extension_settings.sd.drawthings_url, auth: extension_settings.sd.drawthings_auth };
        default:
            throw new Error('Invalid SD source.');
    }
}

function toggleSourceControls() {
    $('.sd_settings [data-sd-source]').each(function () {
        const source = $(this).data('sd-source').split(',');
        $(this).toggle(source.includes(extension_settings.sd.source));
    });
}

async function loadSettings() {
    // Initialize settings
    if (Object.keys(extension_settings.sd).length === 0) {
        Object.assign(extension_settings.sd, defaultSettings);
    }

    // Insert missing settings
    for (const [key, value] of Object.entries(defaultSettings)) {
        if (extension_settings.sd[key] === undefined) {
            extension_settings.sd[key] = value;
        }
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

    if (extension_settings.sd.character_negative_prompts === undefined) {
        extension_settings.sd.character_negative_prompts = {};
    }

    if (!Array.isArray(extension_settings.sd.styles)) {
        extension_settings.sd.styles = defaultStyles;
    }

    $('#sd_source').val(extension_settings.sd.source);
    $('#sd_scale').val(extension_settings.sd.scale).trigger('input');
    $('#sd_steps').val(extension_settings.sd.steps).trigger('input');
    $('#sd_prompt_prefix').val(extension_settings.sd.prompt_prefix).trigger('input');
    $('#sd_negative_prompt').val(extension_settings.sd.negative_prompt).trigger('input');
    $('#sd_width').val(extension_settings.sd.width).trigger('input');
    $('#sd_height').val(extension_settings.sd.height).trigger('input');
    $('#sd_hr_scale').val(extension_settings.sd.hr_scale).trigger('input');
    $('#sd_denoising_strength').val(extension_settings.sd.denoising_strength).trigger('input');
    $('#sd_hr_second_pass_steps').val(extension_settings.sd.hr_second_pass_steps).trigger('input');
    $('#sd_novel_upscale_ratio').val(extension_settings.sd.novel_upscale_ratio).trigger('input');
    $('#sd_novel_anlas_guard').prop('checked', extension_settings.sd.novel_anlas_guard);
    $('#sd_novel_sm').prop('checked', extension_settings.sd.novel_sm);
    $('#sd_novel_sm_dyn').prop('checked', extension_settings.sd.novel_sm_dyn);
    $('#sd_novel_sm_dyn').prop('disabled', !extension_settings.sd.novel_sm);
    $('#sd_novel_decrisper').prop('checked', extension_settings.sd.novel_decrisper);
    $('#sd_pollinations_enhance').prop('checked', extension_settings.sd.pollinations_enhance);
    $('#sd_horde').prop('checked', extension_settings.sd.horde);
    $('#sd_horde_nsfw').prop('checked', extension_settings.sd.horde_nsfw);
    $('#sd_horde_karras').prop('checked', extension_settings.sd.horde_karras);
    $('#sd_horde_sanitize').prop('checked', extension_settings.sd.horde_sanitize);
    $('#sd_restore_faces').prop('checked', extension_settings.sd.restore_faces);
    $('#sd_enable_hr').prop('checked', extension_settings.sd.enable_hr);
    $('#sd_refine_mode').prop('checked', extension_settings.sd.refine_mode);
    $('#sd_expand').prop('checked', extension_settings.sd.expand);
    $('#sd_multimodal_captioning').prop('checked', extension_settings.sd.multimodal_captioning);
    $('#sd_auto_url').val(extension_settings.sd.auto_url);
    $('#sd_auto_auth').val(extension_settings.sd.auto_auth);
    $('#sd_vlad_url').val(extension_settings.sd.vlad_url);
    $('#sd_vlad_auth').val(extension_settings.sd.vlad_auth);
    $('#sd_drawthings_url').val(extension_settings.sd.drawthings_url);
    $('#sd_drawthings_auth').val(extension_settings.sd.drawthings_auth);
    $('#sd_interactive_mode').prop('checked', extension_settings.sd.interactive_mode);
    $('#sd_openai_style').val(extension_settings.sd.openai_style);
    $('#sd_openai_quality').val(extension_settings.sd.openai_quality);
    $('#sd_comfy_url').val(extension_settings.sd.comfy_url);
    $('#sd_comfy_prompt').val(extension_settings.sd.comfy_prompt);
    $('#sd_snap').prop('checked', extension_settings.sd.snap);
    $('#sd_clip_skip').val(extension_settings.sd.clip_skip);
    $('#sd_clip_skip_value').val(extension_settings.sd.clip_skip);
    $('#sd_seed').val(extension_settings.sd.seed);
    $('#sd_free_extend').prop('checked', extension_settings.sd.free_extend);
    $('#sd_wand_visible').prop('checked', extension_settings.sd.wand_visible);
    $('#sd_command_visible').prop('checked', extension_settings.sd.command_visible);
    $('#sd_interactive_visible').prop('checked', extension_settings.sd.interactive_visible);
    $('#sd_stability_style_preset').val(extension_settings.sd.stability_style_preset);
    $('#sd_huggingface_model_id').val(extension_settings.sd.huggingface_model_id);

    for (const style of extension_settings.sd.styles) {
        const option = document.createElement('option');
        option.value = style.name;
        option.text = style.name;
        option.selected = style.name === extension_settings.sd.style;
        $('#sd_style').append(option);
    }

    const resolutionId = getClosestKnownResolution();
    $('#sd_resolution').val(resolutionId);

    toggleSourceControls();
    addPromptTemplates();

    await loadSettingOptions();
}

/**
 * Find a closest resolution option match for the current width and height.
 */
function getClosestKnownResolution() {
    let resolutionId = null;
    let minTotalDiff = Infinity;

    const targetAspect = extension_settings.sd.width / extension_settings.sd.height;
    const targetResolution = extension_settings.sd.width * extension_settings.sd.height;

    const diffs = Object.entries(resolutionOptions).map(([id, resolution]) => {
        const aspectDiff = Math.abs((resolution.width / resolution.height) - targetAspect) / targetAspect;
        const resolutionDiff = Math.abs(resolution.width * resolution.height - targetResolution) / targetResolution;
        return { id, totalDiff: aspectDiff + resolutionDiff };
    });

    for (const { id, totalDiff } of diffs) {
        if (totalDiff < minTotalDiff) {
            minTotalDiff = totalDiff;
            resolutionId = id;
        }
    }

    return resolutionId;
}

async function loadSettingOptions() {
    return Promise.all([
        loadSamplers(),
        loadModels(),
        loadSchedulers(),
        loadVaes(),
        loadComfyWorkflows(),
    ]);
}

function addPromptTemplates() {
    $('#sd_prompt_templates').empty();

    for (const [name, prompt] of Object.entries(extension_settings.sd.prompts).sort((a, b) => Number(a[0]) - Number(b[0]))) {
        const label = $('<label></label>')
            .text(modeLabels[name])
            .attr('for', `sd_prompt_${name}`)
            .attr('data-i18n', `sd_prompt_${name}`);
        const textarea = $('<textarea></textarea>')
            .addClass('textarea_compact text_pole')
            .attr('id', `sd_prompt_${name}`)
            .attr('rows', 3)
            .val(prompt).on('input', () => {
                extension_settings.sd.prompts[name] = textarea.val();
                saveSettingsDebounced();
            });
        const button = $('<button></button>')
            .addClass('menu_button fa-solid fa-undo')
            .attr('title', 'Restore default')
            .attr('data-i18n', 'Restore default')
            .on('click', () => {
                textarea.val(promptTemplates[name]);
                extension_settings.sd.prompts[name] = promptTemplates[name];
                saveSettingsDebounced();
            });
        const container = $('<div></div>')
            .addClass('title_restorable')
            .append(label)
            .append(button);
        $('#sd_prompt_templates').append(container);
        $('#sd_prompt_templates').append(textarea);
    }
}

function onInteractiveModeInput() {
    extension_settings.sd.interactive_mode = !!$(this).prop('checked');
    saveSettingsDebounced();
}

function onMultimodalCaptioningInput() {
    extension_settings.sd.multimodal_captioning = !!$(this).prop('checked');
    saveSettingsDebounced();
}

function onSnapInput() {
    extension_settings.sd.snap = !!$(this).prop('checked');
    saveSettingsDebounced();
}

function onStyleSelect() {
    const selectedStyle = String($('#sd_style').find(':selected').val());
    const styleObject = extension_settings.sd.styles.find(x => x.name === selectedStyle);

    if (!styleObject) {
        console.warn(`Could not find style object for ${selectedStyle}`);
        return;
    }

    $('#sd_prompt_prefix').val(styleObject.prefix).trigger('input');
    $('#sd_negative_prompt').val(styleObject.negative).trigger('input');
    extension_settings.sd.style = selectedStyle;
    saveSettingsDebounced();
}

async function onDeleteStyleClick() {
    const selectedStyle = String($('#sd_style').find(':selected').val());
    const styleObject = extension_settings.sd.styles.find(x => x.name === selectedStyle);

    if (!styleObject) {
        return;
    }

    const confirmed = await callGenericPopup(`Are you sure you want to delete the style "${selectedStyle}"?`, POPUP_TYPE.CONFIRM, '', { okButton: 'Delete', cancelButton: 'Cancel' });

    if (!confirmed) {
        return;
    }

    const index = extension_settings.sd.styles.indexOf(styleObject);

    if (index === -1) {
        return;
    }

    extension_settings.sd.styles.splice(index, 1);
    $('#sd_style').find(`option[value="${selectedStyle}"]`).remove();

    if (extension_settings.sd.styles.length > 0) {
        extension_settings.sd.style = extension_settings.sd.styles[0].name;
        $('#sd_style').val(extension_settings.sd.style).trigger('change');
    } else {
        extension_settings.sd.style = '';
        $('#sd_prompt_prefix').val('').trigger('input');
        $('#sd_negative_prompt').val('').trigger('input');
        $('#sd_style').val('');
    }

    saveSettingsDebounced();
}

async function onSaveStyleClick() {
    const userInput = await callGenericPopup('Enter style name:', POPUP_TYPE.INPUT);

    if (!userInput) {
        return;
    }

    const name = String(userInput).trim();
    const prefix = String($('#sd_prompt_prefix').val());
    const negative = String($('#sd_negative_prompt').val());

    const existingStyle = extension_settings.sd.styles.find(x => x.name === name);

    if (existingStyle) {
        existingStyle.prefix = prefix;
        existingStyle.negative = negative;
        $('#sd_style').val(name);
        saveSettingsDebounced();
        return;
    }

    const styleObject = {
        name: name,
        prefix: prefix,
        negative: negative,
    };

    extension_settings.sd.styles.push(styleObject);
    const option = document.createElement('option');
    option.value = styleObject.name;
    option.text = styleObject.name;
    option.selected = true;
    $('#sd_style').append(option);
    $('#sd_style').val(styleObject.name);
    saveSettingsDebounced();
}

async function expandPrompt(prompt) {
    try {
        const response = await fetch('/api/sd/expand', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ prompt: prompt }),
        });

        if (!response.ok) {
            throw new Error('API returned an error.');
        }

        const data = await response.json();
        return data.prompt;
    } catch {
        return prompt;
    }
}

/**
 * Modifies prompt based on auto-expansion and user inputs.
 * @param {string} prompt Prompt to refine
 * @param {boolean} allowExpand Whether to allow auto-expansion
 * @param {boolean} isNegative Whether the prompt is a negative one
 * @returns {Promise<string>} Refined prompt
 */
async function refinePrompt(prompt, allowExpand, isNegative = false) {
    if (allowExpand && extension_settings.sd.expand) {
        prompt = await expandPrompt(prompt);
    }

    if (extension_settings.sd.refine_mode) {
        const text = isNegative ? '<h3>Review and edit the <i>negative</i> prompt:</h3>' : '<h3>Review and edit the prompt:</h3>';
        const refinedPrompt = await callGenericPopup(text + 'Press "Cancel" to abort the image generation.', POPUP_TYPE.INPUT, prompt.trim(), { rows: 5, okButton: 'Continue' });

        if (refinedPrompt) {
            return String(refinedPrompt);
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
    let characterPrompt = key ? (extension_settings.sd.character_prompts[key] || '') : '';
    let negativePrompt = key ? (extension_settings.sd.character_negative_prompts[key] || '') : '';

    const context = getContext();
    const sharedPromptData = context?.characters[this_chid]?.data?.extensions?.sd_character_prompt;
    const hasSharedData = sharedPromptData && typeof sharedPromptData === 'object';

    if (typeof sharedPromptData?.positive === 'string' && !characterPrompt && sharedPromptData.positive) {
        characterPrompt = sharedPromptData.positive;
        extension_settings.sd.character_prompts[key] = characterPrompt;
    }
    if (typeof sharedPromptData?.negative === 'string' && !negativePrompt && sharedPromptData.negative) {
        negativePrompt = sharedPromptData.negative;
        extension_settings.sd.character_negative_prompts[key] = negativePrompt;
    }

    $('#sd_character_prompt').val(characterPrompt);
    $('#sd_character_negative_prompt').val(negativePrompt);
    $('#sd_character_prompt_share').prop('checked', hasSharedData);
    adjustElementScrollHeight();
}

async function adjustElementScrollHeight() {
    if (CSS.supports('field-sizing', 'content') || !$('.sd_settings').is(':visible')) {
        return;
    }

    await resetScrollHeight($('#sd_prompt_prefix'));
    await resetScrollHeight($('#sd_negative_prompt'));
    await resetScrollHeight($('#sd_character_prompt'));
    await resetScrollHeight($('#sd_character_negative_prompt'));
}

async function onCharacterPromptInput() {
    const key = getCharaFilename(this_chid);
    extension_settings.sd.character_prompts[key] = $('#sd_character_prompt').val();
    saveSettingsDebounced();
    writePromptFieldsDebounced(this_chid);
    if (CSS.supports('field-sizing', 'content')) return;
    await resetScrollHeight($(this));
}

async function onCharacterNegativePromptInput() {
    const key = getCharaFilename(this_chid);
    extension_settings.sd.character_negative_prompts[key] = $('#sd_character_negative_prompt').val();
    saveSettingsDebounced();
    writePromptFieldsDebounced(this_chid);
    if (CSS.supports('field-sizing', 'content')) return;
    await resetScrollHeight($(this));
}

function getCharacterPrefix() {
    if (!this_chid || selected_group) {
        return '';
    }

    const key = getCharaFilename(this_chid);

    if (key) {
        return extension_settings.sd.character_prompts[key] || '';
    }

    return '';
}

function getCharacterNegativePrefix() {
    if (!this_chid || selected_group) {
        return '';
    }

    const key = getCharaFilename(this_chid);

    if (key) {
        return extension_settings.sd.character_negative_prompts[key] || '';
    }

    return '';
}

/**
 * Combines two prompt prefixes into one.
 * @param {string} str1 Base string
 * @param {string} str2 Secondary string
 * @param {string} macro Macro to replace with the secondary string
 * @returns {string} Combined string with a comma between them
 */
function combinePrefixes(str1, str2, macro = '') {
    // Remove leading/trailing white spaces and commas from the strings
    const process = (s) => s.trim().replace(/^,|,$/g, '').trim();

    if (!str2) {
        return str1;
    }

    str1 = process(str1);
    str2 = process(str2);

    // Combine the strings with a comma between them)
    const result = macro && str1.includes(macro) ? str1.replace(macro, str2) : `${str1}, ${str2},`;
    return process(result);
}

function onExpandInput() {
    extension_settings.sd.expand = !!$(this).prop('checked');
    saveSettingsDebounced();
}

function onRefineModeInput() {
    extension_settings.sd.refine_mode = !!$('#sd_refine_mode').prop('checked');
    saveSettingsDebounced();
}

function onFreeExtendInput() {
    extension_settings.sd.free_extend = !!$('#sd_free_extend').prop('checked');
    saveSettingsDebounced();
}

function onWandVisibleInput() {
    extension_settings.sd.wand_visible = !!$('#sd_wand_visible').prop('checked');
    saveSettingsDebounced();
}

function onCommandVisibleInput() {
    extension_settings.sd.command_visible = !!$('#sd_command_visible').prop('checked');
    saveSettingsDebounced();
}

function onInteractiveVisibleInput() {
    extension_settings.sd.interactive_visible = !!$('#sd_interactive_visible').prop('checked');
    saveSettingsDebounced();
}

function onClipSkipInput() {
    extension_settings.sd.clip_skip = Number($('#sd_clip_skip').val());
    $('#sd_clip_skip_value').val(extension_settings.sd.clip_skip);
    saveSettingsDebounced();
}

function onSeedInput() {
    extension_settings.sd.seed = Number($('#sd_seed').val());
    saveSettingsDebounced();
}

function onScaleInput() {
    extension_settings.sd.scale = Number($('#sd_scale').val());
    $('#sd_scale_value').val(extension_settings.sd.scale.toFixed(1));
    saveSettingsDebounced();
}

function onStepsInput() {
    extension_settings.sd.steps = Number($('#sd_steps').val());
    $('#sd_steps_value').val(extension_settings.sd.steps);
    saveSettingsDebounced();
}

async function onPromptPrefixInput() {
    extension_settings.sd.prompt_prefix = $('#sd_prompt_prefix').val();
    saveSettingsDebounced();
    if (CSS.supports('field-sizing', 'content')) return;
    await resetScrollHeight($(this));
}

async function onNegativePromptInput() {
    extension_settings.sd.negative_prompt = $('#sd_negative_prompt').val();
    saveSettingsDebounced();
    if (CSS.supports('field-sizing', 'content')) return;
    await resetScrollHeight($(this));
}

function onSamplerChange() {
    extension_settings.sd.sampler = $('#sd_sampler').find(':selected').val();
    saveSettingsDebounced();
}

const resolutionOptions = {
    sd_res_512x512: { width: 512, height: 512, name: '512x512 (1:1, icons, profile pictures)' },
    sd_res_600x600: { width: 600, height: 600, name: '600x600 (1:1, icons, profile pictures)' },
    sd_res_512x768: { width: 512, height: 768, name: '512x768 (2:3, vertical character card)' },
    sd_res_768x512: { width: 768, height: 512, name: '768x512 (3:2, horizontal 35-mm movie film)' },
    sd_res_960x540: { width: 960, height: 540, name: '960x540 (16:9, horizontal wallpaper)' },
    sd_res_540x960: { width: 540, height: 960, name: '540x960 (9:16, vertical wallpaper)' },
    sd_res_1920x1088: { width: 1920, height: 1088, name: '1920x1088 (16:9, 1080p, horizontal wallpaper)' },
    sd_res_1088x1920: { width: 1088, height: 1920, name: '1088x1920 (9:16, 1080p, vertical wallpaper)' },
    sd_res_1280x720: { width: 1280, height: 720, name: '1280x720 (16:9, 720p, horizontal wallpaper)' },
    sd_res_720x1280: { width: 720, height: 1280, name: '720x1280 (9:16, 720p, vertical wallpaper)' },
    sd_res_1024x1024: { width: 1024, height: 1024, name: '1024x1024 (1:1, SDXL)' },
    sd_res_1152x896: { width: 1152, height: 896, name: '1152x896 (9:7, SDXL)' },
    sd_res_896x1152: { width: 896, height: 1152, name: '896x1152 (7:9, SDXL)' },
    sd_res_1216x832: { width: 1216, height: 832, name: '1216x832 (19:13, SDXL)' },
    sd_res_832x1216: { width: 832, height: 1216, name: '832x1216 (13:19, SDXL)' },
    sd_res_1344x768: { width: 1344, height: 768, name: '1344x768 (4:3, SDXL)' },
    sd_res_768x1344: { width: 768, height: 1344, name: '768x1344 (3:4, SDXL)' },
    sd_res_1536x640: { width: 1536, height: 640, name: '1536x640 (24:10, SDXL)' },
    sd_res_640x1536: { width: 640, height: 1536, name: '640x1536 (10:24, SDXL)' },
};

function onResolutionChange() {
    const selectedOption = $('#sd_resolution').val();
    const selectedResolution = resolutionOptions[selectedOption];

    if (!selectedResolution) {
        console.warn(`Could not find resolution option for ${selectedOption}`);
        return;
    }

    $('#sd_height').val(selectedResolution.height).trigger('input');
    $('#sd_width').val(selectedResolution.width).trigger('input');
}

function onSchedulerChange() {
    extension_settings.sd.scheduler = $('#sd_scheduler').find(':selected').val();
    saveSettingsDebounced();
}

function onWidthInput() {
    extension_settings.sd.width = Number($('#sd_width').val());
    $('#sd_width_value').val(extension_settings.sd.width);
    saveSettingsDebounced();
}

function onHeightInput() {
    extension_settings.sd.height = Number($('#sd_height').val());
    $('#sd_height_value').val(extension_settings.sd.height);
    saveSettingsDebounced();
}

function onSwapDimensionsClick() {
    const w = extension_settings.sd.height;
    const h = extension_settings.sd.width;
    extension_settings.sd.width = w;
    extension_settings.sd.height = h;
    $('#sd_width').val(w).trigger('input');
    $('#sd_height').val(h).trigger('input');
    saveSettingsDebounced();
}

async function onSourceChange() {
    extension_settings.sd.source = $('#sd_source').find(':selected').val();
    extension_settings.sd.model = null;
    extension_settings.sd.sampler = null;
    extension_settings.sd.scheduler = null;
    extension_settings.sd.vae = null;
    toggleSourceControls();
    saveSettingsDebounced();
    await loadSettingOptions();
}

async function onOpenAiStyleSelect() {
    extension_settings.sd.openai_style = String($('#sd_openai_style').find(':selected').val());
    saveSettingsDebounced();
}

async function onOpenAiQualitySelect() {
    extension_settings.sd.openai_quality = String($('#sd_openai_quality').find(':selected').val());
    saveSettingsDebounced();
}

async function onViewAnlasClick() {
    const result = await loadNovelSubscriptionData();

    if (!result) {
        toastr.warning('Are you subscribed?', 'Could not load NovelAI subscription data');
        return;
    }

    const anlas = getNovelAnlas();
    const unlimitedGeneration = getNovelUnlimitedImageGeneration();

    toastr.info(`Free image generation: ${unlimitedGeneration ? 'Yes' : 'No'}`, `Anlas: ${anlas}`);
}

function onNovelUpscaleRatioInput() {
    extension_settings.sd.novel_upscale_ratio = Number($('#sd_novel_upscale_ratio').val());
    $('#sd_novel_upscale_ratio_value').val(extension_settings.sd.novel_upscale_ratio.toFixed(1));
    saveSettingsDebounced();
}

function onNovelAnlasGuardInput() {
    extension_settings.sd.novel_anlas_guard = !!$('#sd_novel_anlas_guard').prop('checked');
    saveSettingsDebounced();
}

function onNovelSmInput() {
    extension_settings.sd.novel_sm = !!$('#sd_novel_sm').prop('checked');
    saveSettingsDebounced();

    if (!extension_settings.sd.novel_sm) {
        $('#sd_novel_sm_dyn').prop('checked', false).prop('disabled', true).trigger('input');
    } else {
        $('#sd_novel_sm_dyn').prop('disabled', false);
    }
}

function onNovelSmDynInput() {
    extension_settings.sd.novel_sm_dyn = !!$('#sd_novel_sm_dyn').prop('checked');
    saveSettingsDebounced();
}

function onNovelDecrisperInput() {
    extension_settings.sd.novel_decrisper = !!$('#sd_novel_decrisper').prop('checked');
    saveSettingsDebounced();
}

function onPollinationsEnhanceInput() {
    extension_settings.sd.pollinations_enhance = !!$('#sd_pollinations_enhance').prop('checked');
    saveSettingsDebounced();
}

function onHordeNsfwInput() {
    extension_settings.sd.horde_nsfw = !!$(this).prop('checked');
    saveSettingsDebounced();
}

function onHordeKarrasInput() {
    extension_settings.sd.horde_karras = !!$(this).prop('checked');
    saveSettingsDebounced();
}

function onHordeSanitizeInput() {
    extension_settings.sd.horde_sanitize = !!$(this).prop('checked');
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

function onAutoUrlInput() {
    extension_settings.sd.auto_url = $('#sd_auto_url').val();
    saveSettingsDebounced();
}

function onAutoAuthInput() {
    extension_settings.sd.auto_auth = $('#sd_auto_auth').val();
    saveSettingsDebounced();
}

function onVladUrlInput() {
    extension_settings.sd.vlad_url = $('#sd_vlad_url').val();
    saveSettingsDebounced();
}

function onVladAuthInput() {
    extension_settings.sd.vlad_auth = $('#sd_vlad_auth').val();
    saveSettingsDebounced();
}

function onDrawthingsUrlInput() {
    extension_settings.sd.drawthings_url = $('#sd_drawthings_url').val();
    saveSettingsDebounced();
}

function onDrawthingsAuthInput() {
    extension_settings.sd.drawthings_auth = $('#sd_drawthings_auth').val();
    saveSettingsDebounced();
}

function onHrUpscalerChange() {
    extension_settings.sd.hr_upscaler = $('#sd_hr_upscaler').find(':selected').val();
    saveSettingsDebounced();
}

function onHrScaleInput() {
    extension_settings.sd.hr_scale = Number($('#sd_hr_scale').val());
    $('#sd_hr_scale_value').val(extension_settings.sd.hr_scale.toFixed(1));
    saveSettingsDebounced();
}

function onDenoisingStrengthInput() {
    extension_settings.sd.denoising_strength = Number($('#sd_denoising_strength').val());
    $('#sd_denoising_strength_value').val(extension_settings.sd.denoising_strength.toFixed(2));
    saveSettingsDebounced();
}

function onHrSecondPassStepsInput() {
    extension_settings.sd.hr_second_pass_steps = Number($('#sd_hr_second_pass_steps').val());
    $('#sd_hr_second_pass_steps_value').val(extension_settings.sd.hr_second_pass_steps);
    saveSettingsDebounced();
}

function onComfyUrlInput() {
    extension_settings.sd.comfy_url = $('#sd_comfy_url').val();
    saveSettingsDebounced();
}

function onHFModelInput() {
    extension_settings.sd.huggingface_model_id = $('#sd_huggingface_model_id').val();
    saveSettingsDebounced();
}

function onComfyWorkflowChange() {
    extension_settings.sd.comfy_workflow = $('#sd_comfy_workflow').find(':selected').val();
    saveSettingsDebounced();
}

async function onStabilityKeyClick() {
    const popupText = 'Stability AI API Key:';
    const key = await callGenericPopup(popupText, POPUP_TYPE.INPUT, '', {
        customButtons: [{
            text: 'Remove Key',
            appendAtEnd: true,
            result: POPUP_RESULT.NEGATIVE,
            action: async () => {
                await writeSecret(SECRET_KEYS.STABILITY, '');
                toastr.success('API Key removed');
                await loadSettingOptions();
            },
        }],
    });

    if (!key) {
        return;
    }

    await writeSecret(SECRET_KEYS.STABILITY, String(key));

    toastr.success('API Key saved');
    await loadSettingOptions();
}

function onStabilityStylePresetChange() {
    extension_settings.sd.stability_style_preset = String($('#sd_stability_style_preset').val());
    saveSettingsDebounced();
}

async function changeComfyWorkflow(_, name) {
    name = name.replace(/(\.json)?$/i, '.json');
    if ($(`#sd_comfy_workflow > [value="${name}"]`).length > 0) {
        extension_settings.sd.comfy_workflow = name;
        $('#sd_comfy_workflow').val(extension_settings.sd.comfy_workflow);
        saveSettingsDebounced();
    } else {
        toastr.error(`ComfyUI Workflow "${name}" does not exist.`);
    }
    return '';
}

async function validateAutoUrl() {
    try {
        if (!extension_settings.sd.auto_url) {
            throw new Error('URL is not set.');
        }

        const result = await fetch('/api/sd/ping', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(getSdRequestBody()),
        });

        if (!result.ok) {
            throw new Error('SD WebUI returned an error.');
        }

        await loadSettingOptions();
        toastr.success('SD WebUI API connected.');
    } catch (error) {
        toastr.error(`Could not validate SD WebUI API: ${error.message}`);
    }
}

async function validateDrawthingsUrl() {
    try {
        if (!extension_settings.sd.drawthings_url) {
            throw new Error('URL is not set.');
        }

        const result = await fetch('/api/sd/drawthings/ping', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(getSdRequestBody()),
        });

        if (!result.ok) {
            throw new Error('SD Drawthings returned an error.');
        }

        await loadSettingOptions();
        toastr.success('SD Drawthings API connected.');
    } catch (error) {
        toastr.error(`Could not validate SD Drawthings API: ${error.message}`);
    }
}

async function validateVladUrl() {
    try {
        if (!extension_settings.sd.vlad_url) {
            throw new Error('URL is not set.');
        }

        const result = await fetch('/api/sd/ping', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(getSdRequestBody()),
        });

        if (!result.ok) {
            throw new Error('SD.Next returned an error.');
        }

        await loadSettingOptions();
        toastr.success('SD.Next API connected.');
    } catch (error) {
        toastr.error(`Could not validate SD.Next API: ${error.message}`);
    }
}

async function validateComfyUrl() {
    try {
        if (!extension_settings.sd.comfy_url) {
            throw new Error('URL is not set.');
        }

        const result = await fetch('/api/sd/comfy/ping', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                url: extension_settings.sd.comfy_url,
            }),
        });
        if (!result.ok) {
            throw new Error('ComfyUI returned an error.');
        }

        await loadSettingOptions();
        toastr.success('ComfyUI API connected.');
    } catch (error) {
        toastr.error(`Could not validate ComfyUI API: ${error.message}`);
    }
}

async function onModelChange() {
    extension_settings.sd.model = $('#sd_model').find(':selected').val();
    saveSettingsDebounced();

    const cloudSources = [
        sources.horde,
        sources.novel,
        sources.openai,
        sources.togetherai,
        sources.pollinations,
        sources.stability,
        sources.blockentropy,
        sources.huggingface,
    ];

    if (cloudSources.includes(extension_settings.sd.source)) {
        return;
    }

    toastr.info('Updating remote model...', 'Please wait');
    if (extension_settings.sd.source === sources.extras) {
        await updateExtrasRemoteModel();
    }
    if (extension_settings.sd.source === sources.auto || extension_settings.sd.source === sources.vlad) {
        await updateAutoRemoteModel();
    }
    toastr.success('Model successfully loaded!', 'Image Generation');
}

async function getAutoRemoteModel() {
    try {
        const result = await fetch('/api/sd/get-model', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(getSdRequestBody()),
        });

        if (!result.ok) {
            throw new Error('SD WebUI returned an error.');
        }

        const data = await result.text();
        return data;
    } catch (error) {
        console.error(error);
        return null;
    }
}

async function getDrawthingsRemoteModel() {
    try {
        const result = await fetch('/api/sd/drawthings/get-model', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(getSdRequestBody()),
        });

        if (!result.ok) {
            throw new Error('SD DrawThings API returned an error.');
        }

        const data = await result.text();

        return data;
    } catch (error) {
        console.error(error);
        return null;
    }
}

async function onVaeChange() {
    extension_settings.sd.vae = $('#sd_vae').find(':selected').val();
}

async function getAutoRemoteUpscalers() {
    try {
        const result = await fetch('/api/sd/upscalers', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(getSdRequestBody()),
        });

        if (!result.ok) {
            throw new Error('SD WebUI returned an error.');
        }

        const data = await result.json();
        return data;
    } catch (error) {
        console.error(error);
        return [extension_settings.sd.hr_upscaler];
    }
}

async function getAutoRemoteSchedulers() {
    try {
        const result = await fetch('/api/sd/schedulers', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(getSdRequestBody()),
        });

        if (!result.ok) {
            throw new Error('SD WebUI returned an error.');
        }

        const data = await result.json();
        return data;
    } catch (error) {
        console.error(error);
        return ['N/A'];
    }
}

async function getVladRemoteUpscalers() {
    try {
        const result = await fetch('/api/sd/sd-next/upscalers', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(getSdRequestBody()),
        });

        if (!result.ok) {
            throw new Error('SD.Next returned an error.');
        }

        const data = await result.json();
        return data;
    } catch (error) {
        console.error(error);
        return [extension_settings.sd.hr_upscaler];
    }
}

async function getDrawthingsRemoteUpscalers() {
    try {
        const result = await fetch('/api/sd/drawthings/get-upscaler', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(getSdRequestBody()),
        });

        if (!result.ok) {
            throw new Error('SD DrawThings API returned an error.');
        }

        const data = await result.text();

        return data ? [data] : ['N/A'];
    } catch (error) {
        console.error(error);
        return ['N/A'];
    }
}

async function updateAutoRemoteModel() {
    try {
        const result = await fetch('/api/sd/set-model', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ ...getSdRequestBody(), model: extension_settings.sd.model }),
        });

        if (!result.ok) {
            throw new Error('SD WebUI returned an error.');
        }

        console.log('Model successfully updated on SD WebUI remote.');
    } catch (error) {
        console.error(error);
        toastr.error(`Could not update SD WebUI model: ${error.message}`);
    }
}

async function updateExtrasRemoteModel() {
    const url = new URL(getApiUrl());
    url.pathname = '/api/image/model';
    const getCurrentModelResult = await doExtrasFetch(url, {
        method: 'POST',
        body: JSON.stringify({ model: extension_settings.sd.model }),
    });

    if (getCurrentModelResult.ok) {
        console.log('Model successfully updated on SD remote.');
    }
}

async function loadSamplers() {
    $('#sd_sampler').empty();
    let samplers = [];

    switch (extension_settings.sd.source) {
        case sources.extras:
            samplers = await loadExtrasSamplers();
            break;
        case sources.horde:
            samplers = await loadHordeSamplers();
            break;
        case sources.auto:
            samplers = await loadAutoSamplers();
            break;
        case sources.drawthings:
            samplers = await loadDrawthingsSamplers();
            break;
        case sources.novel:
            samplers = await loadNovelSamplers();
            break;
        case sources.vlad:
            samplers = await loadVladSamplers();
            break;
        case sources.openai:
            samplers = ['N/A'];
            break;
        case sources.comfy:
            samplers = await loadComfySamplers();
            break;
        case sources.togetherai:
            samplers = ['N/A'];
            break;
        case sources.pollinations:
            samplers = ['N/A'];
            break;
        case sources.stability:
            samplers = ['N/A'];
            break;
        case sources.blockentropy:
            samplers = ['N/A'];
            break;
        case sources.huggingface:
            samplers = ['N/A'];
            break;
    }

    for (const sampler of samplers) {
        const option = document.createElement('option');
        option.innerText = sampler;
        option.value = sampler;
        option.selected = sampler === extension_settings.sd.sampler;
        $('#sd_sampler').append(option);
    }

    if (!extension_settings.sd.sampler && samplers.length > 0) {
        extension_settings.sd.sampler = samplers[0];
        $('#sd_sampler').val(extension_settings.sd.sampler).trigger('change');
    }
}

async function loadHordeSamplers() {
    const result = await fetch('/api/horde/sd-samplers', {
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

async function loadAutoSamplers() {
    if (!extension_settings.sd.auto_url) {
        return [];
    }

    try {
        const result = await fetch('/api/sd/samplers', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(getSdRequestBody()),
        });

        if (!result.ok) {
            throw new Error('SD WebUI returned an error.');
        }

        const data = await result.json();
        return data;
    } catch (error) {
        return [];
    }
}

async function loadDrawthingsSamplers() {
    // The app developer doesn't provide an API to get these yet
    return [
        'UniPC',
        'DPM++ 2M Karras',
        'Euler a',
        'DPM++ SDE Karras',
        'PLMS',
        'DDIM',
        'LCM',
        'Euler A Substep',
        'DPM++ SDE Substep',
        'TCD',
    ];
}

async function loadVladSamplers() {
    if (!extension_settings.sd.vlad_url) {
        return [];
    }

    try {
        const result = await fetch('/api/sd/samplers', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(getSdRequestBody()),
        });

        if (!result.ok) {
            throw new Error('SD.Next returned an error.');
        }

        const data = await result.json();
        return data;
    } catch (error) {
        return [];
    }
}

async function loadNovelSamplers() {
    if (!secret_state[SECRET_KEYS.NOVEL]) {
        console.debug('NovelAI API key is not set.');
        return [];
    }

    return [
        'k_dpmpp_2m',
        'k_dpmpp_sde',
        'k_dpmpp_2s_ancestral',
        'k_euler',
        'k_euler_ancestral',
        'k_dpm_fast',
        'ddim',
    ];
}

async function loadComfySamplers() {
    if (!extension_settings.sd.comfy_url) {
        return [];
    }

    try {
        const result = await fetch('/api/sd/comfy/samplers', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                url: extension_settings.sd.comfy_url,
            }),
        });
        if (!result.ok) {
            throw new Error('ComfyUI returned an error.');
        }
        return await result.json();
    } catch (error) {
        return [];
    }
}

async function loadModels() {
    $('#sd_model').empty();
    let models = [];

    switch (extension_settings.sd.source) {
        case sources.extras:
            models = await loadExtrasModels();
            break;
        case sources.horde:
            models = await loadHordeModels();
            break;
        case sources.auto:
            models = await loadAutoModels();
            break;
        case sources.drawthings:
            models = await loadDrawthingsModels();
            break;
        case sources.novel:
            models = await loadNovelModels();
            break;
        case sources.vlad:
            models = await loadVladModels();
            break;
        case sources.openai:
            models = await loadOpenAiModels();
            break;
        case sources.comfy:
            models = await loadComfyModels();
            break;
        case sources.togetherai:
            models = await loadTogetherAIModels();
            break;
        case sources.pollinations:
            models = await loadPollinationsModels();
            break;
        case sources.stability:
            models = await loadStabilityModels();
            break;
        case sources.blockentropy:
            models = await loadBlockEntropyModels();
            break;
        case sources.huggingface:
            models = [{ value: '', text: '<Enter Model ID above>' }];
            break;
    }

    for (const model of models) {
        const option = document.createElement('option');
        option.innerText = model.text;
        option.value = model.value;
        option.selected = model.value === extension_settings.sd.model;
        $('#sd_model').append(option);
    }

    if (!extension_settings.sd.model && models.length > 0) {
        extension_settings.sd.model = models[0].value;
        $('#sd_model').val(extension_settings.sd.model).trigger('change');
    }
}

async function loadStabilityModels() {
    $('#sd_stability_key').toggleClass('success', !!secret_state[SECRET_KEYS.STABILITY]);

    return [
        { value: 'stable-image-ultra', text: 'Stable Image Ultra' },
        { value: 'stable-image-core', text: 'Stable Image Core' },
        { value: 'stable-diffusion-3', text: 'Stable Diffusion 3' },
    ];
}

async function loadPollinationsModels() {
    const result = await fetch('/api/sd/pollinations/models', {
        method: 'POST',
        headers: getRequestHeaders(),
    });

    if (result.ok) {
        const data = await result.json();
        return data;
    }

    return [];
}

async function loadTogetherAIModels() {
    if (!secret_state[SECRET_KEYS.TOGETHERAI]) {
        console.debug('TogetherAI API key is not set.');
        return [];
    }

    const result = await fetch('/api/sd/together/models', {
        method: 'POST',
        headers: getRequestHeaders(),
    });

    if (result.ok) {
        const data = await result.json();
        return data;
    }

    return [];
}

async function loadBlockEntropyModels() {
    if (!secret_state[SECRET_KEYS.BLOCKENTROPY]) {
        console.debug('Block Entropy API key is not set.');
        return [];
    }

    const result = await fetch('/api/sd/blockentropy/models', {
        method: 'POST',
        headers: getRequestHeaders(),
    });
    console.log(result);
    if (result.ok) {
        const data = await result.json();
        console.log(data);
        return data;
    }

    return [];
}

async function loadHordeModels() {
    const result = await fetch('/api/horde/sd-models', {
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

async function loadAutoModels() {
    if (!extension_settings.sd.auto_url) {
        return [];
    }

    try {
        const currentModel = await getAutoRemoteModel();

        if (currentModel) {
            extension_settings.sd.model = currentModel;
        }

        const result = await fetch('/api/sd/models', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(getSdRequestBody()),
        });

        if (!result.ok) {
            throw new Error('SD WebUI returned an error.');
        }

        const upscalers = await getAutoRemoteUpscalers();

        if (Array.isArray(upscalers) && upscalers.length > 0) {
            $('#sd_hr_upscaler').empty();

            for (const upscaler of upscalers) {
                const option = document.createElement('option');
                option.innerText = upscaler;
                option.value = upscaler;
                option.selected = upscaler === extension_settings.sd.hr_upscaler;
                $('#sd_hr_upscaler').append(option);
            }
        }

        const data = await result.json();
        return data;
    } catch (error) {
        return [];
    }
}

async function loadDrawthingsModels() {
    if (!extension_settings.sd.drawthings_url) {
        return [];
    }

    try {
        const currentModel = await getDrawthingsRemoteModel();

        if (currentModel) {
            extension_settings.sd.model = currentModel;
        }

        const data = [{ value: currentModel, text: currentModel }];


        const upscalers = await getDrawthingsRemoteUpscalers();

        if (Array.isArray(upscalers) && upscalers.length > 0) {
            $('#sd_hr_upscaler').empty();

            for (const upscaler of upscalers) {
                const option = document.createElement('option');
                option.innerText = upscaler;
                option.value = upscaler;
                option.selected = upscaler === extension_settings.sd.hr_upscaler;
                $('#sd_hr_upscaler').append(option);
            }
        }

        return data;
    } catch (error) {
        console.log('Error loading DrawThings API models:', error);
        return [];
    }
}

async function loadOpenAiModels() {
    return [
        { value: 'dall-e-3', text: 'DALL-E 3' },
        { value: 'dall-e-2', text: 'DALL-E 2' },
    ];
}

async function loadVladModels() {
    if (!extension_settings.sd.vlad_url) {
        return [];
    }

    try {
        const currentModel = await getAutoRemoteModel();

        if (currentModel) {
            extension_settings.sd.model = currentModel;
        }

        const result = await fetch('/api/sd/models', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(getSdRequestBody()),
        });

        if (!result.ok) {
            throw new Error('SD WebUI returned an error.');
        }

        const upscalers = await getVladRemoteUpscalers();

        if (Array.isArray(upscalers) && upscalers.length > 0) {
            $('#sd_hr_upscaler').empty();

            for (const upscaler of upscalers) {
                const option = document.createElement('option');
                option.innerText = upscaler;
                option.value = upscaler;
                option.selected = upscaler === extension_settings.sd.hr_upscaler;
                $('#sd_hr_upscaler').append(option);
            }
        }

        const data = await result.json();
        return data;
    } catch (error) {
        return [];
    }
}

async function loadNovelModels() {
    if (!secret_state[SECRET_KEYS.NOVEL]) {
        console.debug('NovelAI API key is not set.');
        return [];
    }

    return [
        {
            value: 'nai-diffusion-3',
            text: 'NAI Diffusion Anime V3',
        },
        {
            value: 'nai-diffusion-2',
            text: 'NAI Diffusion Anime V2',
        },
        {
            value: 'nai-diffusion',
            text: 'NAI Diffusion Anime V1 (Full)',
        },
        {
            value: 'safe-diffusion',
            text: 'NAI Diffusion Anime V1 (Curated)',
        },
        {
            value: 'nai-diffusion-furry-3',
            text: 'NAI Diffusion Furry V3',
        },
        {
            value: 'nai-diffusion-furry',
            text: 'NAI Diffusion Furry',
        },
    ];
}

async function loadComfyModels() {
    if (!extension_settings.sd.comfy_url) {
        return [];
    }

    try {
        const result = await fetch('/api/sd/comfy/models', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                url: extension_settings.sd.comfy_url,
            }),
        });
        if (!result.ok) {
            throw new Error('ComfyUI returned an error.');
        }
        return await result.json();
    } catch (error) {
        return [];
    }
}

async function loadSchedulers() {
    $('#sd_scheduler').empty();
    let schedulers = [];

    switch (extension_settings.sd.source) {
        case sources.extras:
            schedulers = ['N/A'];
            break;
        case sources.horde:
            schedulers = ['N/A'];
            break;
        case sources.auto:
            schedulers = await getAutoRemoteSchedulers();
            break;
        case sources.novel:
            schedulers = ['N/A'];
            break;
        case sources.vlad:
            schedulers = ['N/A'];
            break;
        case sources.drawthings:
            schedulers = ['N/A'];
            break;
        case sources.openai:
            schedulers = ['N/A'];
            break;
        case sources.togetherai:
            schedulers = ['N/A'];
            break;
        case sources.pollinations:
            schedulers = ['N/A'];
            break;
        case sources.comfy:
            schedulers = await loadComfySchedulers();
            break;
        case sources.stability:
            schedulers = ['N/A'];
            break;
        case sources.blockentropy:
            schedulers = ['N/A'];
            break;
        case sources.huggingface:
            schedulers = ['N/A'];
            break;
    }

    for (const scheduler of schedulers) {
        const option = document.createElement('option');
        option.innerText = scheduler;
        option.value = scheduler;
        option.selected = scheduler === extension_settings.sd.scheduler;
        $('#sd_scheduler').append(option);
    }

    if (!extension_settings.sd.scheduler && schedulers.length > 0 && schedulers[0] !== 'N/A') {
        extension_settings.sd.scheduler = schedulers[0];
        $('#sd_scheduler').val(extension_settings.sd.scheduler).trigger('change');
    }
}

async function loadComfySchedulers() {
    if (!extension_settings.sd.comfy_url) {
        return [];
    }

    try {
        const result = await fetch('/api/sd/comfy/schedulers', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                url: extension_settings.sd.comfy_url,
            }),
        });
        if (!result.ok) {
            throw new Error('ComfyUI returned an error.');
        }
        return await result.json();
    } catch (error) {
        return [];
    }
}

async function loadVaes() {
    $('#sd_vae').empty();
    let vaes = [];

    switch (extension_settings.sd.source) {
        case sources.extras:
            vaes = ['N/A'];
            break;
        case sources.horde:
            vaes = ['N/A'];
            break;
        case sources.auto:
            vaes = await loadAutoVaes();
            break;
        case sources.novel:
            vaes = ['N/A'];
            break;
        case sources.vlad:
            vaes = ['N/A'];
            break;
        case sources.drawthings:
            vaes = ['N/A'];
            break;
        case sources.openai:
            vaes = ['N/A'];
            break;
        case sources.togetherai:
            vaes = ['N/A'];
            break;
        case sources.pollinations:
            vaes = ['N/A'];
            break;
        case sources.comfy:
            vaes = await loadComfyVaes();
            break;
        case sources.stability:
            vaes = ['N/A'];
            break;
        case sources.blockentropy:
            vaes = ['N/A'];
            break;
        case sources.huggingface:
            vaes = ['N/A'];
            break;
    }

    for (const vae of vaes) {
        const option = document.createElement('option');
        option.innerText = vae;
        option.value = vae;
        option.selected = vae === extension_settings.sd.vae;
        $('#sd_vae').append(option);
    }

    if (!extension_settings.sd.vae && vaes.length > 0 && vaes[0] !== 'N/A') {
        extension_settings.sd.vae = vaes[0];
        $('#sd_vae').val(extension_settings.sd.vae).trigger('change');
    }
}

async function loadAutoVaes() {
    if (!extension_settings.sd.auto_url) {
        return ['N/A'];
    }

    try {
        const result = await fetch('/api/sd/vaes', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(getSdRequestBody()),
        });

        if (!result.ok) {
            throw new Error('SD WebUI returned an error.');
        }

        const data = await result.json();
        Array.isArray(data) && data.unshift(placeholderVae);
        return data;
    } catch (error) {
        return ['N/A'];
    }
}

async function loadComfyVaes() {
    if (!extension_settings.sd.comfy_url) {
        return [];
    }

    try {
        const result = await fetch('/api/sd/comfy/vaes', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                url: extension_settings.sd.comfy_url,
            }),
        });
        if (!result.ok) {
            throw new Error('ComfyUI returned an error.');
        }
        return await result.json();
    } catch (error) {
        return [];
    }
}

async function loadComfyWorkflows() {
    if (!extension_settings.sd.comfy_url) {
        return;
    }

    try {
        $('#sd_comfy_workflow').empty();
        const result = await fetch('/api/sd/comfy/workflows', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                url: extension_settings.sd.comfy_url,
            }),
        });
        if (!result.ok) {
            throw new Error('ComfyUI returned an error.');
        }
        const workflows = await result.json();
        for (const workflow of workflows) {
            const option = document.createElement('option');
            option.innerText = workflow;
            option.value = workflow;
            option.selected = workflow === extension_settings.sd.comfy_workflow;
            $('#sd_comfy_workflow').append(option);
        }
    } catch (error) {
        return;
    }
}

function getGenerationType(prompt) {
    let mode = generationMode.FREE;

    for (const [key, values] of Object.entries(triggerWords)) {
        for (const value of values) {
            if (value.toLowerCase() === prompt.toLowerCase().trim()) {
                mode = Number(key);
                break;
            }
        }
    }

    if (extension_settings.sd.multimodal_captioning && multimodalMap[mode] !== undefined) {
        mode = multimodalMap[mode];
    }

    if (mode === generationMode.FREE && extension_settings.sd.free_extend) {
        mode = generationMode.FREE_EXTENDED;
    }

    return mode;
}

function getQuietPrompt(mode, trigger) {
    if (mode === generationMode.FREE) {
        return trigger;
    }

    return stringFormat(extension_settings.sd.prompts[mode], trigger);
}

/**
 * Sanitizes generated prompt for image generation.
 * @param {string} str String to process
 * @returns {string} Processed reply
 */
function processReply(str) {
    if (!str) {
        return '';
    }

    str = str.replaceAll('"', '');
    str = str.replaceAll('“', '');
    str = str.replaceAll('.', ',');
    str = str.replaceAll('\n', ', ');
    str = str.normalize('NFD');
    str = str.replace(/[^a-zA-Z0-9,:_(){}<>[\]\-']+/g, ' ');
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

            return {
                mes: message.mes,
                original_avatar: message.original_avatar,
            };
        }

        toastr.warning('No usable messages found.', 'Image Generation');
        throw new Error('No usable messages found.');
    };

    const context = getContext();
    const lastMessage = getLastUsableMessage();
    const character = context.groupId
        ? context.characters.find(c => c.avatar === lastMessage.original_avatar)
        : context.characters[context.characterId];

    if (!character) {
        console.debug('Character not found, using raw message.');
        return processReply(lastMessage.mes);
    }

    return `((${processReply(lastMessage.mes)})), (${processReply(character.scenario)}:0.7), (${processReply(character.description)}:0.5)`;
}

/**
 * Generates an image based on the given trigger word.
 * @param {string} initiator The initiator of the image generation
 * @param {Record<string, object>} args Command arguments
 * @param {string} trigger Subject trigger word
 * @param {string} [message] Chat message
 * @param {function} [callback] Callback function
 * @returns {Promise<string>} Image path
 */
async function generatePicture(initiator, args, trigger, message, callback) {
    if (!trigger || trigger.trim().length === 0) {
        console.log('Trigger word empty, aborting');
        return;
    }

    if (!isValidState()) {
        toastr.warning('Image generation is not available. Check your settings and try again.');
        return;
    }

    extension_settings.sd.sampler = $('#sd_sampler').find(':selected').val();
    extension_settings.sd.model = $('#sd_model').find(':selected').val();

    trigger = trigger.trim();
    const generationType = getGenerationType(trigger);
    console.log('Generation mode', generationType, 'triggered with', trigger);
    const quietPrompt = getQuietPrompt(generationType, trigger);
    const context = getContext();

    const characterName = context.groupId
        ? context.groups[Object.keys(context.groups).filter(x => context.groups[x].id === context.groupId)[0]]?.id?.toString()
        : context.characters[context.characterId]?.name;

    if (generationType == generationMode.BACKGROUND) {
        const callbackOriginal = callback;
        callback = async function (prompt, imagePath, generationType) {
            const imgUrl = `url("${encodeURI(imagePath)}")`;
            eventSource.emit(event_types.FORCE_SET_BACKGROUND, { url: imgUrl, path: imagePath });

            if (typeof callbackOriginal === 'function') {
                callbackOriginal(prompt, imagePath, generationType, negativePromptPrefix, initiator);
            } else {
                sendMessage(prompt, imagePath, generationType, negativePromptPrefix, initiator);
            }
        };
    }

    if (isTrueBoolean(args?.quiet)) {
        callback = () => { };
    }

    const dimensions = setTypeSpecificDimensions(generationType);
    const abortController = new AbortController();
    const stopButton = document.getElementById('sd_stop_gen');
    let negativePromptPrefix = args?.negative || '';
    let imagePath = '';

    const stopListener = () => abortController.abort('Aborted by user');

    try {
        const combineNegatives = (prefix) => { negativePromptPrefix = combinePrefixes(negativePromptPrefix, prefix); };
        const prompt = await getPrompt(generationType, message, trigger, quietPrompt, combineNegatives);
        console.log('Processed image prompt:', prompt);

        $(stopButton).show();
        eventSource.once(CUSTOM_STOP_EVENT, stopListener);

        if (typeof args?._abortController?.addEventListener === 'function') {
            args._abortController.addEventListener('abort', stopListener);
        }

        imagePath = await sendGenerationRequest(generationType, prompt, negativePromptPrefix, characterName, callback, initiator, abortController.signal);
    } catch (err) {
        console.trace(err);
        toastr.error('SD prompt text generation failed. Reason: ' + err, 'Image Generation');
        throw new Error('SD prompt text generation failed. Reason: ' + err);
    }
    finally {
        $(stopButton).hide();
        restoreOriginalDimensions(dimensions);
        eventSource.removeListener(CUSTOM_STOP_EVENT, stopListener);
    }

    return imagePath;
}

function setTypeSpecificDimensions(generationType) {
    const prevSDHeight = extension_settings.sd.height;
    const prevSDWidth = extension_settings.sd.width;
    const aspectRatio = extension_settings.sd.width / extension_settings.sd.height;

    // Face images are always portrait (pun intended)
    if ((generationType == generationMode.FACE || generationType == generationMode.FACE_MULTIMODAL) && aspectRatio >= 1) {
        // Round to nearest multiple of 64
        extension_settings.sd.height = Math.round(extension_settings.sd.width * 1.5 / 64) * 64;
    }

    if (generationType == generationMode.BACKGROUND) {
        // Background images are always landscape
        if (aspectRatio <= 1) {
            // Round to nearest multiple of 64
            extension_settings.sd.width = Math.round(extension_settings.sd.height * 1.8 / 64) * 64;
        }
    }

    if (extension_settings.sd.snap) {
        // Force to use roughly the same pixel count as before rescaling
        const prevPixelCount = prevSDHeight * prevSDWidth;
        const newPixelCount = extension_settings.sd.height * extension_settings.sd.width;

        if (prevPixelCount !== newPixelCount) {
            const ratio = Math.sqrt(prevPixelCount / newPixelCount);
            extension_settings.sd.height = Math.round(extension_settings.sd.height * ratio / 64) * 64;
            extension_settings.sd.width = Math.round(extension_settings.sd.width * ratio / 64) * 64;
            console.log(`Pixel counts after rescaling: ${prevPixelCount} -> ${newPixelCount} (ratio: ${ratio})`);

            const resolution = resolutionOptions[getClosestKnownResolution()];
            if (resolution) {
                extension_settings.sd.height = resolution.height;
                extension_settings.sd.width = resolution.width;
                console.log('Snap to resolution', JSON.stringify(resolution));
            } else {
                console.warn('Snap to resolution failed, using custom dimensions');
            }
        }
    }

    return { height: prevSDHeight, width: prevSDWidth };
}

function restoreOriginalDimensions(savedParams) {
    extension_settings.sd.height = savedParams.height;
    extension_settings.sd.width = savedParams.width;
}

/**
 * Generates a prompt for image generation.
 * @param {number} generationType The type of image generation to perform.
 * @param {string} message A message text to use for the image generation.
 * @param {string} trigger A trigger string to use for the image generation.
 * @param {string} quietPrompt A quiet prompt to use for the image generation.
 * @param {function} combineNegatives A function that combines the negative prompt with other prompts.
 * @returns {Promise<string>} - A promise that resolves when the prompt generation completes.
 */
async function getPrompt(generationType, message, trigger, quietPrompt, combineNegatives) {
    let prompt;

    switch (generationType) {
        case generationMode.RAW_LAST:
            prompt = message || getRawLastMessage();
            break;
        case generationMode.FREE:
            prompt = generateFreeModePrompt(trigger.trim(), combineNegatives);
            break;
        case generationMode.FACE_MULTIMODAL:
        case generationMode.CHARACTER_MULTIMODAL:
        case generationMode.USER_MULTIMODAL:
            prompt = await generateMultimodalPrompt(generationType, quietPrompt);
            break;
        default:
            prompt = await generatePrompt(quietPrompt);
            break;
    }

    if (generationType === generationMode.FREE_EXTENDED) {
        prompt = generateFreeModePrompt(prompt.trim(), combineNegatives);
    }

    if (generationType !== generationMode.FREE) {
        prompt = await refinePrompt(prompt, true);
    }

    return prompt;
}

/**
 * Generates a free prompt with a character-specific prompt prefix support.
 * @param {string} trigger - The prompt to use for the image generation.
 * @param {function} combineNegatives - A function that combines the negative prompt with other prompts.
 * @returns {string}
 */
function generateFreeModePrompt(trigger, combineNegatives) {
    return trigger
        .replace(/(?:^char(\s|,)|\{\{charPrefix\}\})/gi, (_, suffix) => {
            const getLastCharacterKey = () => {
                if (typeof this_chid !== 'undefined') {
                    return getCharaFilename(this_chid);
                }
                const context = getContext();
                for (let i = context.chat.length - 1; i >= 0; i--) {
                    const message = context.chat[i];
                    if (message.is_user || message.is_system) {
                        continue;
                    } else if (typeof message.original_avatar === 'string') {
                        return message.original_avatar.replace(/\.[^/.]+$/, '');
                    }
                }
                throw new Error('No usable messages found.');
            };

            const key = getLastCharacterKey();
            const value = (extension_settings.sd.character_prompts[key] || '').trim();
            const negativeValue = (extension_settings.sd.character_negative_prompts[key] || '').trim();
            typeof combineNegatives === 'function' && negativeValue ? combineNegatives(negativeValue) : void 0;
            return value ? combinePrefixes(value, (suffix || '')) : '';
        });
}

/**
 * Generates a prompt using multimodal captioning.
 * @param {number} generationType - The type of image generation to perform.
 * @param {string} quietPrompt - The prompt to use for the image generation.
 */
async function generateMultimodalPrompt(generationType, quietPrompt) {
    let avatarUrl;

    if (generationType == generationMode.USER_MULTIMODAL) {
        avatarUrl = getUserAvatarUrl();
    }

    if (generationType == generationMode.CHARACTER_MULTIMODAL || generationType === generationMode.FACE_MULTIMODAL) {
        avatarUrl = getCharacterAvatarUrl();
    }

    try {
        const toast = toastr.info('Generating multimodal caption...', 'Image Generation');
        const response = await fetch(avatarUrl);

        if (!response.ok) {
            throw new Error('Could not fetch avatar image.');
        }

        const avatarBlob = await response.blob();
        const avatarBase64 = await getBase64Async(avatarBlob);

        const caption = await getMultimodalCaption(avatarBase64, quietPrompt);
        toastr.clear(toast);

        if (!caption) {
            throw new Error('No caption returned from the API.');
        }

        return caption;
    } catch (error) {
        console.error(error);
        toastr.error('Multimodal captioning failed. Please try again.', 'Image Generation');
        throw new Error('Multimodal captioning failed.');
    }
}

function getCharacterAvatarUrl() {
    const context = getContext();

    if (context.groupId) {
        const groupMembers = context.groups.find(x => x.id === context.groupId)?.members;
        const lastMessageAvatar = context.chat?.filter(x => !x.is_system && !x.is_user)?.slice(-1)[0]?.original_avatar;
        const randomMemberAvatar = Array.isArray(groupMembers) ? groupMembers[Math.floor(Math.random() * groupMembers.length)]?.avatar : null;
        const avatarToUse = lastMessageAvatar || randomMemberAvatar;
        return formatCharacterAvatar(avatarToUse);
    } else {
        return getCharacterAvatar(context.characterId);
    }
}

function getUserAvatarUrl() {
    return getUserAvatar(user_avatar);
}

/**
 * Generates a prompt using the main LLM API.
 * @param {string} quietPrompt - The prompt to use for the image generation.
 * @returns {Promise<string>} - A promise that resolves when the prompt generation completes.
 */
async function generatePrompt(quietPrompt) {
    const reply = await generateQuietPrompt(quietPrompt, false, false);
    const processedReply = processReply(reply);

    if (!processedReply) {
        toastr.error('Prompt generation produced no text. Make sure you\'re using a valid instruct template and try again', 'Image Generation');
        throw new Error('Prompt generation failed.');
    }

    return processedReply;
}

/**
 * Sends a request to image generation endpoint and processes the result.
 * @param {number} generationType Type of image generation
 * @param {string} prompt Prompt to be used for image generation
 * @param {string} additionalNegativePrefix Additional negative prompt to be used for image generation
 * @param {string} characterName Name of the character
 * @param {function} callback Callback function to be called after image generation
 * @param {string} initiator The initiator of the image generation
 * @param {AbortSignal} signal Abort signal to cancel the request
 * @returns
 */
async function sendGenerationRequest(generationType, prompt, additionalNegativePrefix, characterName, callback, initiator, signal) {
    const noCharPrefix = [generationMode.FREE, generationMode.BACKGROUND, generationMode.USER, generationMode.USER_MULTIMODAL, generationMode.FREE_EXTENDED];
    const prefix = noCharPrefix.includes(generationType)
        ? extension_settings.sd.prompt_prefix
        : combinePrefixes(extension_settings.sd.prompt_prefix, getCharacterPrefix());
    const negativePrefix = noCharPrefix.includes(generationType)
        ? extension_settings.sd.negative_prompt
        : combinePrefixes(extension_settings.sd.negative_prompt, getCharacterNegativePrefix());

    const prefixedPrompt = substituteParams(combinePrefixes(prefix, prompt, '{prompt}'));
    const negativePrompt = substituteParams(combinePrefixes(additionalNegativePrefix, negativePrefix));

    let result = { format: '', data: '' };
    const currentChatId = getCurrentChatId();

    try {
        switch (extension_settings.sd.source) {
            case sources.extras:
                result = await generateExtrasImage(prefixedPrompt, negativePrompt, signal);
                break;
            case sources.horde:
                result = await generateHordeImage(prefixedPrompt, negativePrompt, signal);
                break;
            case sources.vlad:
                result = await generateAutoImage(prefixedPrompt, negativePrompt, signal);
                break;
            case sources.drawthings:
                result = await generateDrawthingsImage(prefixedPrompt, negativePrompt, signal);
                break;
            case sources.auto:
                result = await generateAutoImage(prefixedPrompt, negativePrompt, signal);
                break;
            case sources.novel:
                result = await generateNovelImage(prefixedPrompt, negativePrompt, signal);
                break;
            case sources.openai:
                result = await generateOpenAiImage(prefixedPrompt, signal);
                break;
            case sources.comfy:
                result = await generateComfyImage(prefixedPrompt, negativePrompt, signal);
                break;
            case sources.togetherai:
                result = await generateTogetherAIImage(prefixedPrompt, negativePrompt, signal);
                break;
            case sources.pollinations:
                result = await generatePollinationsImage(prefixedPrompt, negativePrompt, signal);
                break;
            case sources.stability:
                result = await generateStabilityImage(prefixedPrompt, negativePrompt, signal);
                break;
            case sources.blockentropy:
                result = await generateBlockEntropyImage(prefixedPrompt, negativePrompt, signal);
                break;
            case sources.huggingface:
                result = await generateHuggingFaceImage(prefixedPrompt, signal);
                break;
        }

        if (!result.data) {
            throw new Error('Endpoint did not return image data.');
        }
    } catch (err) {
        console.error(err);
        toastr.error('Image generation failed. Please try again.' + '\n\n' + String(err), 'Image Generation');
        return;
    }

    if (currentChatId !== getCurrentChatId()) {
        console.warn('Chat changed, aborting SD result saving');
        toastr.warning('Chat changed, generated image discarded.', 'Image Generation');
        return;
    }

    const filename = `${characterName}_${humanizedDateTime()}`;
    const base64Image = await saveBase64AsFile(result.data, characterName, filename, result.format);
    callback ? callback(prompt, base64Image, generationType, additionalNegativePrefix, initiator) : sendMessage(prompt, base64Image, generationType, additionalNegativePrefix, initiator);
    return base64Image;
}

/**
 * Generates an image using the TogetherAI API.
 * @param {string} prompt - The main instruction used to guide the image generation.
 * @param {string} negativePrompt - The instruction used to restrict the image generation.
 * @param {AbortSignal} signal - An AbortSignal object that can be used to cancel the request.
 * @returns {Promise<{format: string, data: string}>} - A promise that resolves when the image generation and processing are complete.
 */
async function generateTogetherAIImage(prompt, negativePrompt, signal) {
    const result = await fetch('/api/sd/together/generate', {
        method: 'POST',
        headers: getRequestHeaders(),
        signal: signal,
        body: JSON.stringify({
            prompt: prompt,
            negative_prompt: negativePrompt,
            model: extension_settings.sd.model,
            steps: extension_settings.sd.steps,
            width: extension_settings.sd.width,
            height: extension_settings.sd.height,
            seed: extension_settings.sd.seed >= 0 ? extension_settings.sd.seed : undefined,
        }),
    });

    if (result.ok) {
        const data = await result.json();
        return { format: 'jpg', data: data?.output?.choices?.[0]?.image_base64 };
    } else {
        const text = await result.text();
        throw new Error(text);
    }
}

async function generateBlockEntropyImage(prompt, negativePrompt, signal) {
    const result = await fetch('/api/sd/blockentropy/generate', {
        method: 'POST',
        headers: getRequestHeaders(),
        signal: signal,
        body: JSON.stringify({
            prompt: prompt,
            negative_prompt: negativePrompt,
            model: extension_settings.sd.model,
            steps: extension_settings.sd.steps,
            width: extension_settings.sd.width,
            height: extension_settings.sd.height,
            seed: extension_settings.sd.seed >= 0 ? extension_settings.sd.seed : undefined,
        }),
    });

    if (result.ok) {
        const data = await result.json();

        // Default format is 'jpg'
        let format = 'jpg';

        // Check if a format is specified in the result
        if (data.format) {
            format = data.format.toLowerCase();
        }

        return { format: format, data: data.images[0] };
    } else {
        const text = await result.text();
        throw new Error(text);
    }
}

/**
 * Generates an image using the Pollinations API.
 * @param {string} prompt - The main instruction used to guide the image generation.
 * @param {string} negativePrompt - The instruction used to restrict the image generation.
 * @param {AbortSignal} signal - An AbortSignal object that can be used to cancel the request.
 * @returns {Promise<{format: string, data: string}>} - A promise that resolves when the image generation and processing are complete.
 */
async function generatePollinationsImage(prompt, negativePrompt, signal) {
    const result = await fetch('/api/sd/pollinations/generate', {
        method: 'POST',
        headers: getRequestHeaders(),
        signal: signal,
        body: JSON.stringify({
            prompt: prompt,
            negative_prompt: negativePrompt,
            model: extension_settings.sd.model,
            width: extension_settings.sd.width,
            height: extension_settings.sd.height,
            enhance: extension_settings.sd.pollinations_enhance,
            seed: extension_settings.sd.seed >= 0 ? extension_settings.sd.seed : undefined,
        }),
    });

    if (result.ok) {
        const data = await result.json();
        return { format: 'jpg', data: data?.image };
    } else {
        const text = await result.text();
        throw new Error(text);
    }
}

/**
 * Generates an "extras" image using a provided prompt and other settings.
 *
 * @param {string} prompt - The main instruction used to guide the image generation.
 * @param {string} negativePrompt - The instruction used to restrict the image generation.
 * @param {AbortSignal} signal - An AbortSignal object that can be used to cancel the request.
 * @returns {Promise<{format: string, data: string}>} - A promise that resolves when the image generation and processing are complete.
 */
async function generateExtrasImage(prompt, negativePrompt, signal) {
    const url = new URL(getApiUrl());
    url.pathname = '/api/image';
    const result = await doExtrasFetch(url, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/json',
        },
        signal: signal,
        body: JSON.stringify({
            prompt: prompt,
            sampler: extension_settings.sd.sampler,
            steps: extension_settings.sd.steps,
            scale: extension_settings.sd.scale,
            width: extension_settings.sd.width,
            height: extension_settings.sd.height,
            negative_prompt: negativePrompt,
            restore_faces: !!extension_settings.sd.restore_faces,
            enable_hr: !!extension_settings.sd.enable_hr,
            karras: !!extension_settings.sd.horde_karras,
            hr_upscaler: extension_settings.sd.hr_upscaler,
            hr_scale: extension_settings.sd.hr_scale,
            denoising_strength: extension_settings.sd.denoising_strength,
            hr_second_pass_steps: extension_settings.sd.hr_second_pass_steps,
            seed: extension_settings.sd.seed >= 0 ? extension_settings.sd.seed : undefined,
        }),
    });

    if (result.ok) {
        const data = await result.json();
        return { format: 'jpg', data: data.image };
    } else {
        const text = await result.text();
        throw new Error(text);
    }
}

/**
 * Gets an aspect ratio for Stability that is the closest to the given width and height.
 * @param {number} width Target width
 * @param {number} height Target height
 * @returns {string} Closest aspect ratio as a string
 */
function getClosestAspectRatio(width, height) {
    const aspectRatios = {
        '16:9': 16 / 9,
        '1:1': 1,
        '21:9': 21 / 9,
        '2:3': 2 / 3,
        '3:2': 3 / 2,
        '4:5': 4 / 5,
        '5:4': 5 / 4,
        '9:16': 9 / 16,
        '9:21': 9 / 21,
    };

    const aspectRatio = width / height;

    let closestAspectRatio = Object.keys(aspectRatios)[0];
    let minDiff = Math.abs(aspectRatio - aspectRatios[closestAspectRatio]);

    for (const key in aspectRatios) {
        const diff = Math.abs(aspectRatio - aspectRatios[key]);
        if (diff < minDiff) {
            minDiff = diff;
            closestAspectRatio = key;
        }
    }

    return closestAspectRatio;
}

/**
 * Generates an image using Stability AI.
 * @param {string} prompt - The main instruction used to guide the image generation.
 * @param {string} negativePrompt - The instruction used to restrict the image generation.
 * @param {AbortSignal} signal - An AbortSignal object that can be used to cancel the request.
 * @returns {Promise<{format: string, data: string}>} - A promise that resolves when the image generation and processing are complete.
 */
async function generateStabilityImage(prompt, negativePrompt, signal) {
    const IMAGE_FORMAT = 'png';
    const PROMPT_LIMIT = 10000;

    try {
        const response = await fetch('/api/sd/stability/generate', {
            method: 'POST',
            headers: getRequestHeaders(),
            signal: signal,
            body: JSON.stringify({
                model: extension_settings.sd.model,
                payload: {
                    prompt: prompt.slice(0, PROMPT_LIMIT),
                    negative_prompt: negativePrompt.slice(0, PROMPT_LIMIT),
                    aspect_ratio: getClosestAspectRatio(extension_settings.sd.width, extension_settings.sd.height),
                    seed: extension_settings.sd.seed >= 0 ? extension_settings.sd.seed : undefined,
                    style_preset: extension_settings.sd.stability_style_preset,
                    output_format: IMAGE_FORMAT,
                },
            }),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
        }

        const base64Image = await response.text();

        return {
            format: IMAGE_FORMAT,
            data: base64Image,
        };
    } catch (error) {
        console.error('Error generating image with Stability AI:', error);
        throw error;
    }
}

/**
 * Generates a "horde" image using the provided prompt and configuration settings.
 *
 * @param {string} prompt - The main instruction used to guide the image generation.
 * @param {string} negativePrompt - The instruction used to restrict the image generation.
 * @param {AbortSignal} signal - An AbortSignal object that can be used to cancel the request.
 * @returns {Promise<{format: string, data: string}>} - A promise that resolves when the image generation and processing are complete.
 */
async function generateHordeImage(prompt, negativePrompt, signal) {
    const result = await fetch('/api/horde/generate-image', {
        method: 'POST',
        headers: getRequestHeaders(),
        signal: signal,
        body: JSON.stringify({
            prompt: prompt,
            sampler: extension_settings.sd.sampler,
            steps: extension_settings.sd.steps,
            scale: extension_settings.sd.scale,
            width: extension_settings.sd.width,
            height: extension_settings.sd.height,
            negative_prompt: negativePrompt,
            model: extension_settings.sd.model,
            nsfw: extension_settings.sd.horde_nsfw,
            restore_faces: !!extension_settings.sd.restore_faces,
            enable_hr: !!extension_settings.sd.enable_hr,
            sanitize: !!extension_settings.sd.horde_sanitize,
            clip_skip: extension_settings.sd.clip_skip,
            seed: extension_settings.sd.seed >= 0 ? extension_settings.sd.seed : undefined,
        }),
    });

    if (result.ok) {
        const data = await result.text();
        return { format: 'webp', data: data };
    } else {
        const text = await result.text();
        throw new Error(text);
    }
}

/**
 * Generates an image in SD WebUI API using the provided prompt and configuration settings.
 *
 * @param {string} prompt - The main instruction used to guide the image generation.
 * @param {string} negativePrompt - The instruction used to restrict the image generation.
 * @param {AbortSignal} signal - An AbortSignal object that can be used to cancel the request.
 * @returns {Promise<{format: string, data: string}>} - A promise that resolves when the image generation and processing are complete.
 */
async function generateAutoImage(prompt, negativePrompt, signal) {
    const isValidVae = extension_settings.sd.vae && !['N/A', placeholderVae].includes(extension_settings.sd.vae);
    const result = await fetch('/api/sd/generate', {
        method: 'POST',
        headers: getRequestHeaders(),
        signal: signal,
        body: JSON.stringify({
            ...getSdRequestBody(),
            prompt: prompt,
            negative_prompt: negativePrompt,
            sampler_name: extension_settings.sd.sampler,
            scheduler: extension_settings.sd.scheduler,
            steps: extension_settings.sd.steps,
            cfg_scale: extension_settings.sd.scale,
            width: extension_settings.sd.width,
            height: extension_settings.sd.height,
            restore_faces: !!extension_settings.sd.restore_faces,
            enable_hr: !!extension_settings.sd.enable_hr,
            hr_upscaler: extension_settings.sd.hr_upscaler,
            hr_scale: extension_settings.sd.hr_scale,
            denoising_strength: extension_settings.sd.denoising_strength,
            hr_second_pass_steps: extension_settings.sd.hr_second_pass_steps,
            seed: extension_settings.sd.seed >= 0 ? extension_settings.sd.seed : undefined,
            // For AUTO1111
            override_settings: {
                CLIP_stop_at_last_layers: extension_settings.sd.clip_skip,
                sd_vae: isValidVae ? extension_settings.sd.vae : undefined,
            },
            override_settings_restore_afterwards: true,
            // For SD.Next
            clip_skip: extension_settings.sd.clip_skip,
            // Ensure generated img is saved to disk
            save_images: true,
            send_images: true,
            do_not_save_grid: false,
            do_not_save_samples: false,
        }),
    });

    if (result.ok) {
        const data = await result.json();
        return { format: 'png', data: data.images[0] };
    } else {
        const text = await result.text();
        throw new Error(text);
    }
}

/**
 * Generates an image in Drawthings API using the provided prompt and configuration settings.
 *
 * @param {string} prompt - The main instruction used to guide the image generation.
 * @param {string} negativePrompt - The instruction used to restrict the image generation.
 * @param {AbortSignal} signal - An AbortSignal object that can be used to cancel the request.
 * @returns {Promise<{format: string, data: string}>} - A promise that resolves when the image generation and processing are complete.
 */
async function generateDrawthingsImage(prompt, negativePrompt, signal) {
    const result = await fetch('/api/sd/drawthings/generate', {
        method: 'POST',
        headers: getRequestHeaders(),
        signal: signal,
        body: JSON.stringify({
            ...getSdRequestBody(),
            prompt: prompt,
            negative_prompt: negativePrompt,
            sampler_name: extension_settings.sd.sampler,
            steps: extension_settings.sd.steps,
            cfg_scale: extension_settings.sd.scale,
            width: extension_settings.sd.width,
            height: extension_settings.sd.height,
            restore_faces: !!extension_settings.sd.restore_faces,
            enable_hr: !!extension_settings.sd.enable_hr,
            denoising_strength: extension_settings.sd.denoising_strength,
            clip_skip: extension_settings.sd.clip_skip,
            upscaler_scale: extension_settings.sd.hr_scale,
            seed: extension_settings.sd.seed >= 0 ? extension_settings.sd.seed : undefined,
            // TODO: advanced API parameters: hr, upscaler
        }),
    });

    if (result.ok) {
        const data = await result.json();
        return { format: 'png', data: data.images[0] };
    } else {
        const text = await result.text();
        throw new Error(text);
    }
}

/**
 * Generates an image in NovelAI API using the provided prompt and configuration settings.
 *
 * @param {string} prompt - The main instruction used to guide the image generation.
 * @param {string} negativePrompt - The instruction used to restrict the image generation.
 * @param {AbortSignal} signal - An AbortSignal object that can be used to cancel the request.
 * @returns {Promise<{format: string, data: string}>} - A promise that resolves when the image generation and processing are complete.
 */
async function generateNovelImage(prompt, negativePrompt, signal) {
    const { steps, width, height, sm, sm_dyn } = getNovelParams();

    const result = await fetch('/api/novelai/generate-image', {
        method: 'POST',
        headers: getRequestHeaders(),
        signal: signal,
        body: JSON.stringify({
            prompt: prompt,
            model: extension_settings.sd.model,
            sampler: extension_settings.sd.sampler,
            steps: steps,
            scale: extension_settings.sd.scale,
            width: width,
            height: height,
            negative_prompt: negativePrompt,
            upscale_ratio: extension_settings.sd.novel_upscale_ratio,
            decrisper: extension_settings.sd.novel_decrisper,
            sm: sm,
            sm_dyn: sm_dyn,
            seed: extension_settings.sd.seed >= 0 ? extension_settings.sd.seed : undefined,
        }),
    });

    if (result.ok) {
        const data = await result.text();
        return { format: 'png', data: data };
    } else {
        const text = await result.text();
        throw new Error(text);
    }
}

/**
 * Adjusts extension parameters for NovelAI. Applies Anlas guard if needed.
 * @returns {{steps: number, width: number, height: number, sm: boolean, sm_dyn: boolean}} - A tuple of parameters for NovelAI API.
 */
function getNovelParams() {
    let steps = extension_settings.sd.steps;
    let width = extension_settings.sd.width;
    let height = extension_settings.sd.height;
    let sm = extension_settings.sd.novel_sm;
    let sm_dyn = extension_settings.sd.novel_sm_dyn;

    if (extension_settings.sd.sampler === 'ddim') {
        sm = false;
        sm_dyn = false;
    }

    // Don't apply Anlas guard if it's disabled.
    if (!extension_settings.sd.novel_anlas_guard) {
        return { steps, width, height, sm, sm_dyn };
    }

    const MAX_STEPS = 28;
    const MAX_PIXELS = 1024 * 1024;

    if (width * height > MAX_PIXELS) {
        const ratio = Math.sqrt(MAX_PIXELS / (width * height));

        // Calculate new width and height while maintaining aspect ratio.
        var newWidth = Math.round(width * ratio);
        var newHeight = Math.round(height * ratio);

        // Ensure new dimensions are multiples of 64. If not, reduce accordingly.
        if (newWidth % 64 !== 0) {
            newWidth = newWidth - newWidth % 64;
        }

        if (newHeight % 64 !== 0) {
            newHeight = newHeight - newHeight % 64;
        }

        // If total pixel count after rounding still exceeds MAX_PIXELS, decrease dimension size by 64 accordingly.
        while (newWidth * newHeight > MAX_PIXELS) {
            if (newWidth > newHeight) {
                newWidth -= 64;
            } else {
                newHeight -= 64;
            }
        }

        console.log(`Anlas Guard: Image size (${width}x${height}) > ${MAX_PIXELS}, reducing size to ${newWidth}x${newHeight}`);
        width = newWidth;
        height = newHeight;
    }

    if (steps > MAX_STEPS) {
        console.log(`Anlas Guard: Steps (${steps}) > ${MAX_STEPS}, reducing steps to ${MAX_STEPS}`);
        steps = MAX_STEPS;
    }

    return { steps, width, height, sm, sm_dyn };
}

/**
 * Generates an image in OpenAI API using the provided prompt and configuration settings.
 * @param {string} prompt - The main instruction used to guide the image generation.
 * @param {AbortSignal} signal - An AbortSignal object that can be used to cancel the request.
 * @returns {Promise<{format: string, data: string}>} - A promise that resolves when the image generation and processing are complete.
 */
async function generateOpenAiImage(prompt, signal) {
    const dalle2PromptLimit = 1000;
    const dalle3PromptLimit = 4000;

    const isDalle2 = extension_settings.sd.model === 'dall-e-2';
    const isDalle3 = extension_settings.sd.model === 'dall-e-3';

    if (isDalle2 && prompt.length > dalle2PromptLimit) {
        prompt = prompt.substring(0, dalle2PromptLimit);
    }

    if (isDalle3 && prompt.length > dalle3PromptLimit) {
        prompt = prompt.substring(0, dalle3PromptLimit);
    }

    let width = 1024;
    let height = 1024;
    let aspectRatio = extension_settings.sd.width / extension_settings.sd.height;

    if (isDalle3 && aspectRatio < 1) {
        height = 1792;
    }

    if (isDalle3 && aspectRatio > 1) {
        width = 1792;
    }

    if (isDalle2 && (extension_settings.sd.width <= 512 && extension_settings.sd.height <= 512)) {
        width = 512;
        height = 512;
    }

    const result = await fetch('/api/openai/generate-image', {
        method: 'POST',
        headers: getRequestHeaders(),
        signal: signal,
        body: JSON.stringify({
            prompt: prompt,
            model: extension_settings.sd.model,
            size: `${width}x${height}`,
            n: 1,
            quality: isDalle3 ? extension_settings.sd.openai_quality : undefined,
            style: isDalle3 ? extension_settings.sd.openai_style : undefined,
            response_format: 'b64_json',
        }),
    });

    if (result.ok) {
        const data = await result.json();
        return { format: 'png', data: data?.data[0]?.b64_json };
    } else {
        const text = await result.text();
        throw new Error(text);
    }
}

/**
 * Generates an image in ComfyUI using the provided prompt and configuration settings.
 *
 * @param {string} prompt - The main instruction used to guide the image generation.
 * @param {string} negativePrompt - The instruction used to restrict the image generation.
 * @param {AbortSignal} signal - An AbortSignal object that can be used to cancel the request.
 * @returns {Promise<{format: string, data: string}>} - A promise that resolves when the image generation and processing are complete.
 */
async function generateComfyImage(prompt, negativePrompt, signal) {
    const placeholders = [
        'model',
        'vae',
        'sampler',
        'scheduler',
        'steps',
        'scale',
        'width',
        'height',
        'clip_skip',
    ];

    const workflowResponse = await fetch('/api/sd/comfy/workflow', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            file_name: extension_settings.sd.comfy_workflow,
        }),
    });
    if (!workflowResponse.ok) {
        const text = await workflowResponse.text();
        toastr.error(`Failed to load workflow.\n\n${text}`);
    }
    let workflow = (await workflowResponse.json()).replaceAll('"%prompt%"', JSON.stringify(prompt));
    workflow = workflow.replaceAll('"%negative_prompt%"', JSON.stringify(negativePrompt));

    const seed = extension_settings.sd.seed >= 0 ? extension_settings.sd.seed : Math.round(Math.random() * Number.MAX_SAFE_INTEGER);
    workflow = workflow.replaceAll('"%seed%"', JSON.stringify(seed));
    placeholders.forEach(ph => {
        workflow = workflow.replaceAll(`"%${ph}%"`, JSON.stringify(extension_settings.sd[ph]));
    });
    (extension_settings.sd.comfy_placeholders ?? []).forEach(ph => {
        workflow = workflow.replaceAll(`"%${ph.find}%"`, JSON.stringify(substituteParams(ph.replace)));
    });
    if (/%user_avatar%/gi.test(workflow)) {
        const response = await fetch(getUserAvatarUrl());
        if (response.ok) {
            const avatarBlob = await response.blob();
            const avatarBase64 = await getBase64Async(avatarBlob);
            workflow = workflow.replaceAll('"%user_avatar%"', JSON.stringify(avatarBase64));
        } else {
            workflow = workflow.replaceAll('"%user_avatar%"', JSON.stringify(PNG_PIXEL));
        }
    }
    if (/%char_avatar%/gi.test(workflow)) {
        const response = await fetch(getCharacterAvatarUrl());
        if (response.ok) {
            const avatarBlob = await response.blob();
            const avatarBase64 = await getBase64Async(avatarBlob);
            workflow = workflow.replaceAll('"%char_avatar%"', JSON.stringify(avatarBase64));
        } else {
            workflow = workflow.replaceAll('"%char_avatar%"', JSON.stringify(PNG_PIXEL));
        }
    }
    console.log(`{
        "prompt": ${workflow}
    }`);
    const promptResult = await fetch('/api/sd/comfy/generate', {
        method: 'POST',
        headers: getRequestHeaders(),
        signal: signal,
        body: JSON.stringify({
            url: extension_settings.sd.comfy_url,
            prompt: `{
                "prompt": ${workflow}
            }`,
        }),
    });
    if (!promptResult.ok) {
        const text = await promptResult.text();
        throw new Error(text);
    }
    return { format: 'png', data: await promptResult.text() };
}


/**
 * Generates an image in Hugging Face Inference API using the provided prompt and configuration settings (model selected).
 * @param {string} prompt - The main instruction used to guide the image generation.
 * @param {AbortSignal} signal - An AbortSignal object that can be used to cancel the request.
 * @returns {Promise<{format: string, data: string}>} - A promise that resolves when the image generation and processing are complete.
 */
async function generateHuggingFaceImage(prompt, signal) {
    const result = await fetch('/api/sd/huggingface/generate', {
        method: 'POST',
        headers: getRequestHeaders(),
        signal: signal,
        body: JSON.stringify({
            model: extension_settings.sd.huggingface_model_id,
            prompt: prompt,
        }),
    });

    if (result.ok) {
        const data = await result.json();
        return { format: 'jpg', data: data.image };
    } else {
        const text = await result.text();
        throw new Error(text);
    }
}


async function onComfyOpenWorkflowEditorClick() {
    let workflow = await (await fetch('/api/sd/comfy/workflow', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            file_name: extension_settings.sd.comfy_workflow,
        }),
    })).json();
    const editorHtml = $(await $.get('scripts/extensions/stable-diffusion/comfyWorkflowEditor.html'));
    const saveValue = (/** @type {Popup} */ _popup) => {
        workflow = $('#sd_comfy_workflow_editor_workflow').val().toString();
        return true;
    };
    const popup = new Popup(editorHtml, POPUP_TYPE.CONFIRM, '', { okButton: 'Save', cancelButton: 'Cancel', wide: true, large: true, onClosing: saveValue });
    const popupResult = popup.show();
    const checkPlaceholders = () => {
        workflow = $('#sd_comfy_workflow_editor_workflow').val().toString();
        $('.sd_comfy_workflow_editor_placeholder_list > li[data-placeholder]').each(function (idx) {
            const key = this.getAttribute('data-placeholder');
            const found = workflow.search(`"%${key}%"`) != -1;
            this.classList[found ? 'remove' : 'add']('sd_comfy_workflow_editor_not_found');
        });
    };
    $('#sd_comfy_workflow_editor_name').text(extension_settings.sd.comfy_workflow);
    $('#sd_comfy_workflow_editor_workflow').val(workflow);
    const addPlaceholderDom = (placeholder) => {
        const el = $(`
            <li class="sd_comfy_workflow_editor_not_found" data-placeholder="${placeholder.find}">
                <span class="sd_comfy_workflow_editor_custom_remove" title="Remove custom placeholder">⊘</span>
                <span class="sd_comfy_workflow_editor_custom_final">"%${placeholder.find}%"</span><br>
                <input placeholder="find" title="find" type="text" class="text_pole sd_comfy_workflow_editor_custom_find" value=""><br>
                <input placeholder="replace" title="replace" type="text" class="text_pole sd_comfy_workflow_editor_custom_replace">
            </li>
        `);
        $('#sd_comfy_workflow_editor_placeholder_list_custom').append(el);
        el.find('.sd_comfy_workflow_editor_custom_find').val(placeholder.find);
        el.find('.sd_comfy_workflow_editor_custom_find').on('input', function () {
            if (!(this instanceof HTMLInputElement)) {
                return;
            }
            placeholder.find = this.value;
            el.find('.sd_comfy_workflow_editor_custom_final').text(`"%${this.value}%"`);
            el.attr('data-placeholder', `${this.value}`);
            checkPlaceholders();
            saveSettingsDebounced();
        });
        el.find('.sd_comfy_workflow_editor_custom_replace').val(placeholder.replace);
        el.find('.sd_comfy_workflow_editor_custom_replace').on('input', function () {
            if (!(this instanceof HTMLInputElement)) {
                return;
            }
            placeholder.replace = this.value;
            saveSettingsDebounced();
        });
        el.find('.sd_comfy_workflow_editor_custom_remove').on('click', () => {
            el.remove();
            extension_settings.sd.comfy_placeholders.splice(extension_settings.sd.comfy_placeholders.indexOf(placeholder));
            saveSettingsDebounced();
        });
    };
    $('#sd_comfy_workflow_editor_placeholder_add').on('click', () => {
        if (!extension_settings.sd.comfy_placeholders) {
            extension_settings.sd.comfy_placeholders = [];
        }
        const placeholder = {
            find: '',
            replace: '',
        };
        extension_settings.sd.comfy_placeholders.push(placeholder);
        addPlaceholderDom(placeholder);
        saveSettingsDebounced();
    });
    (extension_settings.sd.comfy_placeholders ?? []).forEach(placeholder => {
        addPlaceholderDom(placeholder);
    });
    checkPlaceholders();
    $('#sd_comfy_workflow_editor_workflow').on('input', checkPlaceholders);
    if (await popupResult) {
        const response = await fetch('/api/sd/comfy/save-workflow', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                file_name: extension_settings.sd.comfy_workflow,
                workflow: workflow,
            }),
        });
        if (!response.ok) {
            const text = await response.text();
            toastr.error(`Failed to save workflow.\n\n${text}`);
        }
    }
}

async function onComfyNewWorkflowClick() {
    let name = await callGenericPopup('Workflow name:', POPUP_TYPE.INPUT);
    if (!name) {
        return;
    }
    if (!String(name).toLowerCase().endsWith('.json')) {
        name += '.json';
    }
    extension_settings.sd.comfy_workflow = name;
    const response = await fetch('/api/sd/comfy/save-workflow', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            file_name: extension_settings.sd.comfy_workflow,
            workflow: '',
        }),
    });
    if (!response.ok) {
        const text = await response.text();
        toastr.error(`Failed to save workflow.\n\n${text}`);
    }
    saveSettingsDebounced();
    await loadComfyWorkflows();
    await delay(200);
    await onComfyOpenWorkflowEditorClick();
}

async function onComfyDeleteWorkflowClick() {
    const confirm = await callGenericPopup('Delete the workflow? This action is irreversible.', POPUP_TYPE.CONFIRM, '', { okButton: 'Delete', cancelButton: 'Cancel' });
    if (!confirm) {
        return;
    }
    const response = await fetch('/api/sd/comfy/delete-workflow', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            file_name: extension_settings.sd.comfy_workflow,
        }),
    });
    if (!response.ok) {
        const text = await response.text();
        toastr.error(`Failed to save workflow.\n\n${text}`);
    }
    await loadComfyWorkflows();
    onComfyWorkflowChange();
}

/**
 * Sends a chat message with the generated image.
 * @param {string} prompt Prompt used for the image generation
 * @param {string} image Base64 encoded image
 * @param {number} generationType Generation type of the image
 * @param {string} additionalNegativePrefix Additional negative prompt used for the image generation
 * @param {string} initiator The initiator of the image generation
 */
async function sendMessage(prompt, image, generationType, additionalNegativePrefix, initiator) {
    const context = getContext();
    const name = context.groupId ? systemUserName : context.name2;
    const template = extension_settings.sd.prompts[generationMode.MESSAGE] || '{{prompt}}';
    const messageText = substituteParamsExtended(template, { char: name, prompt: prompt });
    const message = {
        name: name,
        is_user: false,
        is_system: !getVisibilityByInitiator(initiator),
        send_date: getMessageTimeStamp(),
        mes: messageText,
        extra: {
            image: image,
            title: prompt,
            generationType: generationType,
            negative: additionalNegativePrefix,
            inline_image: false,
            image_swipes: [image],
        },
    };
    context.chat.push(message);
    const messageId = context.chat.length - 1;
    await eventSource.emit(event_types.MESSAGE_RECEIVED, messageId);
    context.addOneMessage(message);
    await eventSource.emit(event_types.CHARACTER_MESSAGE_RENDERED, messageId);
    await context.saveChat();
}

/**
 * Gets the visibility of the resulting message based on the initiator.
 * @param {string} initiator Generation initiator
 * @returns {boolean} Is resulting message visible
 */
function getVisibilityByInitiator(initiator) {
    switch (initiator) {
        case initiators.interactive:
            return !!extension_settings.sd.interactive_visible;
        case initiators.wand:
            return !!extension_settings.sd.wand_visible;
        case initiators.command:
            return !!extension_settings.sd.command_visible;
        default:
            return false;
    }
}

async function addSDGenButtons() {
    const buttonHtml = await renderExtensionTemplateAsync('stable-diffusion', 'button');
    const dropdownHtml = await renderExtensionTemplateAsync('stable-diffusion', 'dropdown');

    $('#sd_wand_container').append(buttonHtml);
    $(document.body).append(dropdownHtml);

    const messageButton = $('.sd_message_gen');
    const button = $('#sd_gen');
    const dropdown = $('#sd_dropdown');
    dropdown.hide();
    button.hide();
    messageButton.hide();

    let popper = Popper.createPopper(button.get(0), dropdown.get(0), {
        placement: 'top',
    });

    $(document).on('click', '.sd_message_gen', sdMessageButton);

    $(document).on('click touchend', function (e) {
        const target = $(e.target);
        if (target.is(dropdown) || target.closest(dropdown).length) return;
        if ((target.is(button) || target.closest(button).length) && !dropdown.is(':visible')) {
            e.preventDefault();

            dropdown.fadeIn(animation_duration);
            popper.update();
        } else {
            dropdown.fadeOut(animation_duration);
        }
    });

    $('#sd_dropdown [id]').on('click', function () {
        dropdown.fadeOut(animation_duration);
        const id = $(this).attr('id');
        const idParamMap = {
            'sd_you': 'you',
            'sd_face': 'face',
            'sd_me': 'me',
            'sd_world': 'scene',
            'sd_last': 'last',
            'sd_raw_last': 'raw_last',
            'sd_background': 'background',
        };

        const param = idParamMap[id];

        if (param) {
            console.log('doing /sd ' + param);
            generatePicture(initiators.wand, {}, param);
        }
    });

    const stopGenButton = $('#sd_stop_gen');
    stopGenButton.hide();
    stopGenButton.on('click', () => eventSource.emit(CUSTOM_STOP_EVENT));
}

function isValidState() {
    switch (extension_settings.sd.source) {
        case sources.extras:
            return modules.includes('sd');
        case sources.horde:
            return true;
        case sources.auto:
            return !!extension_settings.sd.auto_url;
        case sources.drawthings:
            return !!extension_settings.sd.drawthings_url;
        case sources.vlad:
            return !!extension_settings.sd.vlad_url;
        case sources.novel:
            return secret_state[SECRET_KEYS.NOVEL];
        case sources.openai:
            return secret_state[SECRET_KEYS.OPENAI];
        case sources.comfy:
            return true;
        case sources.togetherai:
            return secret_state[SECRET_KEYS.TOGETHERAI];
        case sources.pollinations:
            return true;
        case sources.stability:
            return secret_state[SECRET_KEYS.STABILITY];
        case sources.blockentropy:
            return secret_state[SECRET_KEYS.BLOCKENTROPY];
        case sources.huggingface:
            return secret_state[SECRET_KEYS.HUGGINGFACE];
    }
}

async function moduleWorker() {
    if (isValidState()) {
        $('#sd_gen').show();
        $('.sd_message_gen').show();
    }
    else {
        $('#sd_gen').hide();
        $('.sd_message_gen').hide();
    }
}

setInterval(moduleWorker, UPDATE_INTERVAL);
let buttonAbortController = null;

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
    const characterFileName = context.groupId
        ? context.groups[Object.keys(context.groups).filter(x => context.groups[x].id === context.groupId)[0]]?.id?.toString()
        : context.characters[context.characterId]?.name;
    const messageText = message?.mes;
    const hasSavedImage = message?.extra?.image && message?.extra?.title;
    const hasSavedNegative = message?.extra?.negative;

    if ($icon.hasClass(busyClass)) {
        buttonAbortController?.abort('Aborted by user');
        console.log('Previous image is still being generated...');
        return;
    }

    let dimensions = null;
    buttonAbortController = new AbortController();

    try {
        setBusyIcon(true);
        if (hasSavedImage) {
            const prompt = await refinePrompt(message.extra.title, false, false);
            const negative = hasSavedNegative ? await refinePrompt(message.extra.negative, false, true) : '';
            message.extra.title = prompt;

            const generationType = message?.extra?.generationType ?? generationMode.FREE;
            console.log('Regenerating an image, using existing prompt:', prompt);
            dimensions = setTypeSpecificDimensions(generationType);
            await sendGenerationRequest(generationType, prompt, negative, characterFileName, saveGeneratedImage, initiators.action, buttonAbortController?.signal);
        }
        else {
            console.log('doing /sd raw last');
            await generatePicture(initiators.action, {}, 'raw_last', messageText, saveGeneratedImage);
        }
    }
    catch (error) {
        console.error('Could not generate inline image: ', error);
    }
    finally {
        setBusyIcon(false);

        if (dimensions) {
            restoreOriginalDimensions(dimensions);
        }
    }

    function saveGeneratedImage(prompt, image, generationType, negative) {
        // Some message sources may not create the extra object
        if (typeof message.extra !== 'object' || message.extra === null) {
            message.extra = {};
        }

        // Add image to the swipe list if it's not already there
        if (!Array.isArray(message.extra.image_swipes)) {
            message.extra.image_swipes = [];
        }

        const swipes = message.extra.image_swipes;

        if (message.extra.image && !swipes.includes(message.extra.image)) {
            swipes.push(message.extra.image);
        }

        swipes.push(image);

        // If already contains an image and it's not inline - leave it as is
        message.extra.inline_image = message.extra.image && !message.extra.inline_image ? false : true;
        message.extra.image = image;
        message.extra.title = prompt;
        message.extra.generationType = generationType;
        message.extra.negative = negative;
        appendMediaToMessage(message, $mes);

        context.saveChat();
    }
}

async function onCharacterPromptShareInput() {
    // Not a valid state to share character prompt
    if (this_chid === undefined || selected_group) {
        return;
    }

    const shouldShare = !!$('#sd_character_prompt_share').prop('checked');

    if (shouldShare) {
        await writePromptFields(this_chid);
    } else {
        await writeExtensionField(this_chid, 'sd_character_prompt', null);
    }
}

async function writePromptFields(characterId) {
    const key = getCharaFilename(characterId);
    const promptPrefix = key ? (extension_settings.sd.character_prompts[key] || '') : '';
    const negativePromptPrefix = key ? (extension_settings.sd.character_negative_prompts[key] || '') : '';
    const promptObject = {
        positive: promptPrefix,
        negative: negativePromptPrefix,
    };
    await writeExtensionField(characterId, 'sd_character_prompt', promptObject);
}

/**
 * Switches an image to the next or previous one in the swipe list.
 * @param {object} args Event arguments
 * @param {any} args.message Message object
 * @param {JQuery<HTMLElement>} args.element Message element
 * @param {string} args.direction Swipe direction
 * @returns {Promise<void>}
 */
async function onImageSwiped({ message, element, direction }) {
    const context = getContext();
    const animationClass = 'fa-fade';
    const messageImg = element.find('.mes_img');

    // Current image is already animating
    if (messageImg.hasClass(animationClass)) {
        return;
    }

    const swipes = message?.extra?.image_swipes;

    if (!Array.isArray(swipes)) {
        console.warn('No image swipes found in the message');
        return;
    }

    const currentIndex = swipes.indexOf(message.extra.image);

    if (currentIndex === -1) {
        console.warn('Current image not found in the swipes');
        return;
    }

    // Switch to previous image or wrap around if at the beginning
    if (direction === 'left') {
        const newIndex = currentIndex === 0 ? swipes.length - 1 : currentIndex - 1;
        message.extra.image = swipes[newIndex];

        // Update the image in the message
        appendMediaToMessage(message, element, false);
    }

    // Switch to next image or generate a new one if at the end
    if (direction === 'right') {
        const newIndex = currentIndex === swipes.length - 1 ? swipes.length : currentIndex + 1;

        if (newIndex === swipes.length) {
            const abortController = new AbortController();
            const swipeControls = element.find('.mes_img_swipes');
            const stopButton = document.getElementById('sd_stop_gen');
            const stopListener = () => abortController.abort('Aborted by user');
            const generationType = message?.extra?.generationType ?? generationMode.FREE;
            const dimensions = setTypeSpecificDimensions(generationType);
            const originalSeed = extension_settings.sd.seed;
            extension_settings.sd.seed = Math.round(Math.random() * (Math.pow(2, 32) - 1));
            let imagePath = '';

            try {
                $(stopButton).show();
                eventSource.once(CUSTOM_STOP_EVENT, stopListener);
                const callback = () => { };
                const hasNegative = message.extra.negative;
                const prompt = await refinePrompt(message.extra.title, false, false);
                const negativePromptPrefix = hasNegative ? await refinePrompt(message.extra.negative, false, true) : '';
                const characterName = context.groupId
                    ? context.groups[Object.keys(context.groups).filter(x => context.groups[x].id === context.groupId)[0]]?.id?.toString()
                    : context.characters[context.characterId]?.name;

                messageImg.addClass(animationClass);
                swipeControls.hide();
                imagePath = await sendGenerationRequest(generationType, prompt, negativePromptPrefix, characterName, callback, initiators.swipe, abortController.signal);
            } finally {
                $(stopButton).hide();
                messageImg.removeClass(animationClass);
                swipeControls.show();
                eventSource.removeListener(CUSTOM_STOP_EVENT, stopListener);
                restoreOriginalDimensions(dimensions);
                extension_settings.sd.seed = originalSeed;
            }

            if (!imagePath) {
                return;
            }

            swipes.push(imagePath);
        }

        message.extra.image = swipes[newIndex];
        appendMediaToMessage(message, element, false);
    }

    await context.saveChat();
}

jQuery(async () => {
    await addSDGenButtons();

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'imagine',
        callback: (args, trigger) => generatePicture(initiators.command, args, String(trigger)),
        aliases: ['sd', 'img', 'image'],
        namedArgumentList: [
            new SlashCommandNamedArgument(
                'quiet', 'whether to post the generated image to chat', [ARGUMENT_TYPE.BOOLEAN], false, false, 'false',
            ),
            SlashCommandNamedArgument.fromProps({
                name: 'negative',
                description: 'negative prompt prefix',
                typeList: [ARGUMENT_TYPE.STRING],
            }),
        ],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'argument', [ARGUMENT_TYPE.STRING], false, false, null, Object.values(triggerWords).flat(),
            ),
        ],
        helpString: `
            <div>
                Requests to generate an image and posts it to chat (unless <code>quiet=true</code> argument is specified).
            </div>
            <div>
                Supported arguments: <code>${Object.values(triggerWords).flat().join(', ')}</code>.
            </div>
            <div>
                Anything else would trigger a "free mode" to make generate whatever you prompted. Example: <code>/imagine apple tree</code> would generate a picture of an apple tree. Returns a link to the generated image.
            </div>
        `,
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'imagine-comfy-workflow',
        callback: changeComfyWorkflow,
        aliases: ['icw'],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'workflow name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: () => Array.from(document.querySelectorAll('#sd_comfy_workflow > [value]')).map(x => x.getAttribute('value')).map(workflow => new SlashCommandEnumValue(workflow)),
            }),
        ],
        helpString: '(workflowName) - change the workflow to be used for image generation with ComfyUI, e.g. <pre><code>/imagine-comfy-workflow MyWorkflow</code></pre>',
    }));


    const template = await renderExtensionTemplateAsync('stable-diffusion', 'settings', defaultSettings);
    $('#sd_container').append(template);
    $('#sd_source').on('change', onSourceChange);
    $('#sd_scale').on('input', onScaleInput);
    $('#sd_steps').on('input', onStepsInput);
    $('#sd_model').on('change', onModelChange);
    $('#sd_vae').on('change', onVaeChange);
    $('#sd_sampler').on('change', onSamplerChange);
    $('#sd_resolution').on('change', onResolutionChange);
    $('#sd_scheduler').on('change', onSchedulerChange);
    $('#sd_prompt_prefix').on('input', onPromptPrefixInput);
    $('#sd_negative_prompt').on('input', onNegativePromptInput);
    $('#sd_width').on('input', onWidthInput);
    $('#sd_height').on('input', onHeightInput);
    $('#sd_horde_nsfw').on('input', onHordeNsfwInput);
    $('#sd_horde_karras').on('input', onHordeKarrasInput);
    $('#sd_horde_sanitize').on('input', onHordeSanitizeInput);
    $('#sd_restore_faces').on('input', onRestoreFacesInput);
    $('#sd_enable_hr').on('input', onHighResFixInput);
    $('#sd_refine_mode').on('input', onRefineModeInput);
    $('#sd_character_prompt').on('input', onCharacterPromptInput);
    $('#sd_character_negative_prompt').on('input', onCharacterNegativePromptInput);
    $('#sd_auto_validate').on('click', validateAutoUrl);
    $('#sd_auto_url').on('input', onAutoUrlInput);
    $('#sd_auto_auth').on('input', onAutoAuthInput);
    $('#sd_drawthings_validate').on('click', validateDrawthingsUrl);
    $('#sd_drawthings_url').on('input', onDrawthingsUrlInput);
    $('#sd_drawthings_auth').on('input', onDrawthingsAuthInput);
    $('#sd_vlad_validate').on('click', validateVladUrl);
    $('#sd_vlad_url').on('input', onVladUrlInput);
    $('#sd_vlad_auth').on('input', onVladAuthInput);
    $('#sd_hr_upscaler').on('change', onHrUpscalerChange);
    $('#sd_hr_scale').on('input', onHrScaleInput);
    $('#sd_denoising_strength').on('input', onDenoisingStrengthInput);
    $('#sd_hr_second_pass_steps').on('input', onHrSecondPassStepsInput);
    $('#sd_novel_upscale_ratio').on('input', onNovelUpscaleRatioInput);
    $('#sd_novel_anlas_guard').on('input', onNovelAnlasGuardInput);
    $('#sd_novel_view_anlas').on('click', onViewAnlasClick);
    $('#sd_novel_sm').on('input', onNovelSmInput);
    $('#sd_novel_sm_dyn').on('input', onNovelSmDynInput);
    $('#sd_novel_decrisper').on('input', onNovelDecrisperInput);
    $('#sd_pollinations_enhance').on('input', onPollinationsEnhanceInput);
    $('#sd_comfy_validate').on('click', validateComfyUrl);
    $('#sd_comfy_url').on('input', onComfyUrlInput);
    $('#sd_comfy_workflow').on('change', onComfyWorkflowChange);
    $('#sd_comfy_open_workflow_editor').on('click', onComfyOpenWorkflowEditorClick);
    $('#sd_comfy_new_workflow').on('click', onComfyNewWorkflowClick);
    $('#sd_comfy_delete_workflow').on('click', onComfyDeleteWorkflowClick);
    $('#sd_expand').on('input', onExpandInput);
    $('#sd_style').on('change', onStyleSelect);
    $('#sd_save_style').on('click', onSaveStyleClick);
    $('#sd_delete_style').on('click', onDeleteStyleClick);
    $('#sd_character_prompt_block').hide();
    $('#sd_interactive_mode').on('input', onInteractiveModeInput);
    $('#sd_openai_style').on('change', onOpenAiStyleSelect);
    $('#sd_openai_quality').on('change', onOpenAiQualitySelect);
    $('#sd_multimodal_captioning').on('input', onMultimodalCaptioningInput);
    $('#sd_snap').on('input', onSnapInput);
    $('#sd_clip_skip').on('input', onClipSkipInput);
    $('#sd_seed').on('input', onSeedInput);
    $('#sd_character_prompt_share').on('input', onCharacterPromptShareInput);
    $('#sd_free_extend').on('input', onFreeExtendInput);
    $('#sd_wand_visible').on('input', onWandVisibleInput);
    $('#sd_command_visible').on('input', onCommandVisibleInput);
    $('#sd_interactive_visible').on('input', onInteractiveVisibleInput);
    $('#sd_swap_dimensions').on('click', onSwapDimensionsClick);
    $('#sd_stability_key').on('click', onStabilityKeyClick);
    $('#sd_stability_style_preset').on('change', onStabilityStylePresetChange);
    $('#sd_huggingface_model_id').on('input', onHFModelInput);

    if (!CSS.supports('field-sizing', 'content')) {
        $('.sd_settings .inline-drawer-toggle').on('click', function () {
            initScrollHeight($('#sd_prompt_prefix'));
            initScrollHeight($('#sd_negative_prompt'));
            initScrollHeight($('#sd_character_prompt'));
            initScrollHeight($('#sd_character_negative_prompt'));
        });
    }

    for (const [key, value] of Object.entries(resolutionOptions)) {
        const option = document.createElement('option');
        option.value = key;
        option.text = value.name;
        $('#sd_resolution').append(option);
    }

    eventSource.on(event_types.EXTRAS_CONNECTED, async () => {
        if (extension_settings.sd.source === sources.extras) {
            await loadSettingOptions();
        }
    });

    eventSource.on(event_types.IMAGE_SWIPED, onImageSwiped);

    eventSource.on(event_types.CHAT_CHANGED, onChatChanged);

    await loadSettings();
    $('body').addClass('sd');
});
