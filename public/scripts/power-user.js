import {
    saveSettingsDebounced,
    scrollChatToBottom,
    characters,
    callPopup,
    reloadMarkdownProcessor,
    reloadCurrentChat,
    getRequestHeaders,
    substituteParams,
    eventSource,
    event_types,
    getCurrentChatId,
    printCharacters,
    setCharacterId,
    setEditedMessageId,
    renderTemplate,
    chat,
    getFirstDisplayedMessageId,
    showMoreMessages,
    saveSettings,
    saveChatConditional,
    setAnimationDuration,
    ANIMATION_DURATION_DEFAULT,
} from '../script.js';
import { isMobile, initMovingUI, favsToHotswap } from './RossAscends-mods.js';
import {
    groups,
    resetSelectedGroup,
} from './group-chats.js';
import {
    instruct_presets,
    loadInstructMode,
    selectInstructPreset,
} from './instruct-mode.js';

import { registerSlashCommand } from './slash-commands.js';
import { tags } from './tags.js';
import { tokenizers } from './tokenizers.js';
import { BIAS_CACHE } from './logit-bias.js';

import { countOccurrences, debounce, delay, isOdd, resetScrollHeight, shuffle, sortMoments, stringToRange, timestampToMoment } from './utils.js';

export {
    loadPowerUserSettings,
    loadMovingUIState,
    collapseNewlines,
    playMessageSound,
    sortEntitiesList,
    fixMarkdown,
    power_user,
    send_on_enter_options,
    getContextSettings,
};

export const MAX_CONTEXT_DEFAULT = 8192;
export const MAX_RESPONSE_DEFAULT = 2048;
const MAX_CONTEXT_UNLOCKED = 200 * 1024;
const MAX_RESPONSE_UNLOCKED = 16 * 1024;
const unlockedMaxContextStep = 512;
const maxContextMin = 512;
const maxContextStep = 64;

const defaultStoryString = '{{#if system}}{{system}}\n{{/if}}{{#if description}}{{description}}\n{{/if}}{{#if personality}}{{char}}\'s personality: {{personality}}\n{{/if}}{{#if scenario}}Scenario: {{scenario}}\n{{/if}}{{#if persona}}{{persona}}\n{{/if}}';
const defaultExampleSeparator = '***';
const defaultChatStart = '***';

export const ui_mode = {
    SIMPLE: 0,
    POWER: 1,
};

const avatar_styles = {
    ROUND: 0,
    RECTANGULAR: 1,
    SQUARE: 2,
};

export const chat_styles = {
    DEFAULT: 0,
    BUBBLES: 1,
    DOCUMENT: 2,
};

const send_on_enter_options = {
    DISABLED: -1,
    AUTO: 0,
    ENABLED: 1,
};

export const persona_description_positions = {
    IN_PROMPT: 0,
    /**
     * @deprecated Use persona_description_positions.IN_PROMPT instead.
     */
    AFTER_CHAR: 1,
    TOP_AN: 2,
    BOTTOM_AN: 3,
};

let power_user = {
    tokenizer: tokenizers.BEST_MATCH,
    token_padding: 64,
    collapse_newlines: false,
    pin_examples: false,
    strip_examples: false,
    trim_sentences: false,
    include_newline: false,
    always_force_name2: false,
    user_prompt_bias: '',
    show_user_prompt_bias: true,
    auto_continue: {
        enabled: false,
        allow_chat_completions: false,
        target_length: 400,
    },
    markdown_escape_strings: '',
    chat_truncation: 100,
    streaming_fps: 30,

    ui_mode: ui_mode.POWER,
    fast_ui_mode: true,
    avatar_style: avatar_styles.ROUND,
    chat_display: chat_styles.DEFAULT,
    chat_width: 50,
    never_resize_avatars: false,
    show_card_avatar_urls: false,
    play_message_sound: false,
    play_sound_unfocused: true,
    auto_save_msg_edits: false,
    confirm_message_delete: true,

    sort_field: 'name',
    sort_order: 'asc',
    sort_rule: null,
    font_scale: 1,
    blur_strength: 10,
    shadow_width: 2,

    main_text_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeBodyColor').trim()}`,
    italics_text_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeEmColor').trim()}`,
    quote_text_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeQuoteColor').trim()}`,
    blur_tint_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeBlurTintColor').trim()}`,
    chat_tint_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeChatTintColor').trim()}`,
    user_mes_blur_tint_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeUserMesBlurTintColor').trim()}`,
    bot_mes_blur_tint_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeBotMesBlurTintColor').trim()}`,
    shadow_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeShadowColor').trim()}`,
    border_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeBorderColor').trim()}`,

    custom_css: '',

    waifuMode: false,
    movingUI: false,
    movingUIState: {},
    movingUIPreset: '',
    noShadows: false,
    theme: 'Default (Dark) 1.7.1',

    gestures: true,
    auto_swipe: false,
    auto_swipe_minimum_length: 0,
    auto_swipe_blacklist: [],
    auto_swipe_blacklist_threshold: 2,
    auto_scroll_chat_to_bottom: true,
    auto_fix_generated_markdown: true,
    send_on_enter: send_on_enter_options.AUTO,
    console_log_prompts: false,
    render_formulas: false,
    allow_name1_display: false,
    allow_name2_display: false,
    hotswap_enabled: true,
    timer_enabled: true,
    timestamps_enabled: true,
    timestamp_model_icon: false,
    mesIDDisplay_enabled: false,
    max_context_unlocked: false,
    message_token_count_enabled: false,
    expand_message_actions: false,
    enableZenSliders: false,
    enableLabMode: false,
    prefer_character_prompt: true,
    prefer_character_jailbreak: true,
    quick_continue: false,
    continue_on_send: false,
    trim_spaces: true,
    relaxed_api_urls: false,
    world_import_dialog: true,
    disable_group_trimming: false,
    single_line: false,

    default_instruct: '',
    instruct: {
        enabled: false,
        preset: 'Alpaca',
        system_prompt: 'Below is an instruction that describes a task. Write a response that appropriately completes the request.\n\nWrite {{char}}\'s next reply in a fictional roleplay chat between {{user}} and {{char}}.\n',
        input_sequence: '### Instruction:',
        output_sequence: '### Response:',
        first_output_sequence: '',
        last_output_sequence: '',
        system_sequence_prefix: '',
        system_sequence_suffix: '',
        stop_sequence: '',
        separator_sequence: '',
        wrap: true,
        macro: true,
        names: false,
        names_force_groups: true,
        activation_regex: '',
        bind_to_context: false,
    },

    default_context: 'Default',
    context: {
        preset: 'Default',
        story_string: defaultStoryString,
        chat_start: defaultChatStart,
        example_separator: defaultExampleSeparator,
        use_stop_strings: true,
    },

    personas: {},
    default_persona: null,
    persona_descriptions: {},

    persona_description: '',
    persona_description_position: persona_description_positions.IN_PROMPT,
    persona_show_notifications: true,

    custom_stopping_strings: '',
    custom_stopping_strings_macro: true,
    fuzzy_search: false,
    encode_tags: false,
    servers: [],
    bogus_folders: false,
    aux_field: 'character_version',
    restore_user_input: true,
    reduced_motion: false,
    compact_input_area: true,
    auto_connect: false,
    auto_load_chat: false,
};

let themes = [];
let movingUIPresets = [];
export let context_presets = [];

const storage_keys = {
    fast_ui_mode: 'TavernAI_fast_ui_mode',
    avatar_style: 'TavernAI_avatar_style',
    chat_display: 'TavernAI_chat_display',
    chat_width: 'chat_width',
    font_scale: 'TavernAI_font_scale',

    main_text_color: 'TavernAI_main_text_color',
    italics_text_color: 'TavernAI_italics_text_color',
    quote_text_color: 'TavernAI_quote_text_color',
    blur_tint_color: 'TavernAI_blur_tint_color',
    chat_tint_color: 'TavernAI_chat_tint_color',
    user_mes_blur_tint_color: 'TavernAI_user_mes_blur_tint_color',
    bot_mes_blur_tint_color: 'TavernAI_bot_mes_blur_tint_color',
    blur_strength: 'TavernAI_blur_strength',
    shadow_color: 'TavernAI_shadow_color',
    shadow_width: 'TavernAI_shadow_width',
    border_color: 'TavernAI_border_color',

    custom_css: 'TavernAI_custom_css',

    waifuMode: 'TavernAI_waifuMode',
    movingUI: 'TavernAI_movingUI',
    noShadows: 'TavernAI_noShadows',

    hotswap_enabled: 'HotswapEnabled',
    timer_enabled: 'TimerEnabled',
    timestamps_enabled: 'TimestampsEnabled',
    timestamp_model_icon: 'TimestampModelIcon',
    mesIDDisplay_enabled: 'mesIDDisplayEnabled',
    message_token_count_enabled: 'MessageTokenCountEnabled',
    expand_message_actions: 'ExpandMessageActions',
    enableZenSliders: 'enableZenSliders',
    enableLabMode: 'enableLabMode',
    reduced_motion: 'reduced_motion',
    compact_input_area: 'compact_input_area',
    auto_connect_legacy: 'AutoConnectEnabled',
    auto_load_chat_legacy: 'AutoLoadChatEnabled',
};

const contextControls = [
    // Power user context scoped settings
    { id: 'context_story_string', property: 'story_string', isCheckbox: false, isGlobalSetting: false },
    { id: 'context_example_separator', property: 'example_separator', isCheckbox: false, isGlobalSetting: false },
    { id: 'context_chat_start', property: 'chat_start', isCheckbox: false, isGlobalSetting: false },
    { id: 'context_use_stop_strings', property: 'use_stop_strings', isCheckbox: true, isGlobalSetting: false, defaultValue: false },

    // Existing power user settings
    { id: 'always-force-name2-checkbox', property: 'always_force_name2', isCheckbox: true, isGlobalSetting: true, defaultValue: true },
    { id: 'trim_sentences_checkbox', property: 'trim_sentences', isCheckbox: true, isGlobalSetting: true, defaultValue: false },
    { id: 'include_newline_checkbox', property: 'include_newline', isCheckbox: true, isGlobalSetting: true, defaultValue: false },
    { id: 'single_line', property: 'single_line', isCheckbox: true, isGlobalSetting: true, defaultValue: false },
];

let browser_has_focus = true;
const debug_functions = [];

const setHotswapsDebounced = debounce(favsToHotswap, 500);

export function switchSimpleMode() {
    $('[data-newbie-hidden]').each(function () {
        $(this).toggleClass('displayNone', power_user.ui_mode === ui_mode.SIMPLE);
    });
}

function playMessageSound() {
    if (!power_user.play_message_sound) {
        return;
    }

    if (power_user.play_sound_unfocused && browser_has_focus) {
        return;
    }

    const audio = document.getElementById('audio_message_sound');
    if (audio instanceof HTMLAudioElement) {
        audio.volume = 0.8;
        audio.pause();
        audio.currentTime = 0;
        audio.play();
    }
}

/**
 * Replaces consecutive newlines with a single newline.
 * @param {string} x String to be processed.
 * @returns {string} Processed string.
 * @example
 * collapseNewlines("\n\n\n"); // "\n"
 */
function collapseNewlines(x) {
    return x.replaceAll(/\n+/g, '\n');
}

/**
 * Fix formatting problems in markdown.
 * @param {string} text Text to be processed.
 * @param {boolean} forDisplay Whether the text is being processed for display.
 * @returns {string} Processed text.
 * @example
 * "^example * text*\n" // "^example *text*\n"
 *  "^*example * text\n"// "^*example* text\n"
 * "^example *text *\n" // "^example *text*\n"
 * "^* example * text\n" // "^*example* text\n"
 * // take note that the side you move the asterisk depends on where its pairing is
 * // i.e. both of the following strings have the same broken asterisk ' * ',
 * // but you move the first to the left and the second to the right, to match the non-broken asterisk
 * "^example * text*\n" // "^*example * text\n"
 * // and you HAVE to handle the cases where multiple pairs of asterisks exist in the same line
 * "^example * text* * harder problem *\n" // "^example *text* *harder problem*\n"
 */
function fixMarkdown(text, forDisplay) {
    // Find pairs of formatting characters and capture the text in between them
    const format = /([*_]{1,2})([\s\S]*?)\1/gm;
    let matches = [];
    let match;
    while ((match = format.exec(text)) !== null) {
        matches.push(match);
    }

    // Iterate through the matches and replace adjacent spaces immediately beside formatting characters
    let newText = text;
    for (let i = matches.length - 1; i >= 0; i--) {
        let matchText = matches[i][0];
        let replacementText = matchText.replace(/(\*|_)([\t \u00a0\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff]+)|([\t \u00a0\u1680\u2000-\u200a\u202f\u205f\u3000\ufeff]+)(\*|_)/g, '$1$4');
        newText = newText.slice(0, matches[i].index) + replacementText + newText.slice(matches[i].index + matchText.length);
    }

    // Don't auto-fix asterisks if this is a message clean-up procedure.
    // It botches the continue function. Apply this to display only.
    if (!forDisplay) {
        return newText;
    }

    const splitText = newText.split('\n');

    // Fix asterisks, and quotes that are not paired
    for (let index = 0; index < splitText.length; index++) {
        const line = splitText[index];
        const charsToCheck = ['*', '"'];
        for (const char of charsToCheck) {
            if (line.includes(char) && isOdd(countOccurrences(line, char))) {
                splitText[index] = line.trimEnd() + char;
            }
        }
    }

    newText = splitText.join('\n');

    return newText;
}

function switchHotswap() {
    const value = localStorage.getItem(storage_keys.hotswap_enabled);
    power_user.hotswap_enabled = value === null ? true : value == 'true';
    $('body').toggleClass('no-hotswap', !power_user.hotswap_enabled);
    $('#hotswapEnabled').prop('checked', power_user.hotswap_enabled);
}

function switchTimer() {
    const value = localStorage.getItem(storage_keys.timer_enabled);
    power_user.timer_enabled = value === null ? true : value == 'true';
    $('body').toggleClass('no-timer', !power_user.timer_enabled);
    $('#messageTimerEnabled').prop('checked', power_user.timer_enabled);
}

function switchTimestamps() {
    const value = localStorage.getItem(storage_keys.timestamps_enabled);
    power_user.timestamps_enabled = value === null ? true : value == 'true';
    $('body').toggleClass('no-timestamps', !power_user.timestamps_enabled);
    $('#messageTimestampsEnabled').prop('checked', power_user.timestamps_enabled);
}

function switchIcons() {
    const value = localStorage.getItem(storage_keys.timestamp_model_icon);
    power_user.timestamp_model_icon = value === null ? true : value == 'true';
    $('body').toggleClass('no-modelIcons', !power_user.timestamp_model_icon);
    $('#messageModelIconEnabled').prop('checked', power_user.timestamp_model_icon);
}

function switchTokenCount() {
    const value = localStorage.getItem(storage_keys.message_token_count_enabled);
    power_user.message_token_count_enabled = value === null ? false : value == 'true';
    $('body').toggleClass('no-tokenCount', !power_user.message_token_count_enabled);
    $('#messageTokensEnabled').prop('checked', power_user.message_token_count_enabled);
}

function switchMesIDDisplay() {
    const value = localStorage.getItem(storage_keys.mesIDDisplay_enabled);
    power_user.mesIDDisplay_enabled = value === null ? true : value == 'true';
    /*     console.log(`
        localstorage value:${value},
        poweruser before:${before},
        poweruser after:${power_user.mesIDDisplay_enabled}`) */
    $('body').toggleClass('no-mesIDDisplay', !power_user.mesIDDisplay_enabled);
    $('#mesIDDisplayEnabled').prop('checked', power_user.mesIDDisplay_enabled);
}

function switchMessageActions() {
    const value = localStorage.getItem(storage_keys.expand_message_actions);
    power_user.expand_message_actions = value === null ? false : value == 'true';
    $('body').toggleClass('expandMessageActions', power_user.expand_message_actions);
    $('#expandMessageActions').prop('checked', power_user.expand_message_actions);
    $('.extraMesButtons, .extraMesButtonsHint').removeAttr('style');
}

function switchReducedMotion() {
    const value = localStorage.getItem(storage_keys.reduced_motion);
    power_user.reduced_motion = value === null ? false : value == 'true';
    jQuery.fx.off = power_user.reduced_motion;
    const overrideDuration = power_user.reduced_motion ? 0 : ANIMATION_DURATION_DEFAULT;
    setAnimationDuration(overrideDuration);
    $('#reduced_motion').prop('checked', power_user.reduced_motion);
}

function switchCompactInputArea() {
    const value = localStorage.getItem(storage_keys.compact_input_area);
    power_user.compact_input_area = value === null ? true : value == 'true';
    $('#send_form').toggleClass('compact', power_user.compact_input_area);
    $('#compact_input_area').prop('checked', power_user.compact_input_area);
}

var originalSliderValues = [];

async function switchLabMode() {

    /*     if (power_user.enableZenSliders && power_user.enableLabMode) {
            toastr.warning("Can't start Lab Mode while Zen Sliders are active")
            return
            //$("#enableZenSliders").trigger('click')
        }
     */
    await delay(100);
    const value = localStorage.getItem(storage_keys.enableLabMode);
    power_user.enableLabMode = value === null ? false : value == 'true';
    $('body').toggleClass('enableLabMode', power_user.enableLabMode);
    $('#enableLabMode').prop('checked', power_user.enableLabMode);

    if (power_user.enableLabMode) {
        //save all original slider values into an array
        $('#advanced-ai-config-block input').each(function () {
            let id = $(this).attr('id');
            let min = $(this).attr('min');
            let max = $(this).attr('max');
            let step = $(this).attr('step');
            originalSliderValues.push({ id, min, max, step });
        });
        //console.log(originalSliderValues)
        //remove limits on all inputs and hide sliders
        $('#advanced-ai-config-block input')
            .attr('min', '-99999')
            .attr('max', '99999')
            .attr('step', '0.001');
        $('#labModeWarning').removeClass('displayNone');
        //$("#advanced-ai-config-block input[type='range']").hide()

    } else {
        //re apply the original sliders values to each input
        originalSliderValues.forEach(function (slider) {
            $('#' + slider.id)
                .attr('min', slider.min)
                .attr('max', slider.max)
                .attr('step', slider.step)
                .trigger('input');
        });
        $('#advanced-ai-config-block input[type=\'range\']').show();
        $('#labModeWarning').addClass('displayNone');
    }
}

async function switchZenSliders() {
    await delay(100);
    const value = localStorage.getItem(storage_keys.enableZenSliders);
    power_user.enableZenSliders = value === null ? false : value == 'true';
    $('body').toggleClass('enableZenSliders', power_user.enableZenSliders);
    $('#enableZenSliders').prop('checked', power_user.enableZenSliders);

    if (power_user.enableZenSliders) {
        $('#clickSlidersTips').hide();
        $('#pro-settings-block input[type=\'number\']').hide();
        //hide number inputs that are not 'seed' inputs
        $(`#textgenerationwebui_api-settings :input[type='number']:not([id^='seed']):not([id^='n_']),
            #kobold_api-settings :input[type='number']:not([id^='seed'])`).hide();
        //hide original sliders
        $(`#textgenerationwebui_api-settings input[type='range'],
            #kobold_api-settings input[type='range'],
            #pro-settings-block input[type='range']:not(#max_context)`) //exclude max context because its creation is handled by switchMaxContext()
            .hide()
            .each(function () {
                //make a zen slider for each original slider
                CreateZenSliders($(this));
            });
        //this is for when zensliders is toggled after pageload
        switchMaxContextSize();
    } else {
        $('#clickSlidersTips').show();
        revertOriginalSliders();
    }

    function revertOriginalSliders() {
        $('#pro-settings-block input[type=\'number\']').show();
        $(`#textgenerationwebui_api-settings input[type='number'],
            #kobold_api-settings input[type='number']`).show();
        $(`#textgenerationwebui_api-settings input[type='range'],
            #kobold_api-settings input[type='range'],
            #pro-settings-block input[type='range']`).each(function () {
            $(this).show();
        });
        $('div[id$="_zenslider"]').remove();
    }

}
async function CreateZenSliders(elmnt) {
    var originalSlider = elmnt;
    var sliderID = originalSlider.attr('id');
    var sliderMin = Number(originalSlider.attr('min'));
    var sliderMax = Number(originalSlider.attr('max'));
    var sliderValue = originalSlider.val();
    var sliderRange = sliderMax - sliderMin;
    var numSteps = 20;
    var decimals = 2;
    var offVal, allVal;
    var stepScale;
    var steps;
    if (sliderID == 'amount_gen') {
        decimals = 0;
        steps = [16, 50, 100, 150, 200, 256, 300, 400, 512, 1024];
        sliderMin = 0;
        sliderMax = steps.length - 1;
        stepScale = 1;
        numSteps = 10;
        sliderValue = steps.indexOf(Number(sliderValue));
        if (sliderValue === -1) { sliderValue = 4; } // default to '200' if origSlider has value we can't use
    }
    if (sliderID == 'rep_pen_range_textgenerationwebui') {
        if (power_user.max_context_unlocked) {
            steps = [0, 256, 512, 768, 1024, 2048, 4096, 8192, 16355, 24576, 32768, 49152, 65536, -1];
            numSteps = 13;
            allVal = 13;
        } else {
            steps = [0, 256, 512, 768, 1024, 2048, 4096, 8192, -1];
            numSteps = 8;
            allVal = 8;
        }
        decimals = 0;
        offVal = 0;
        sliderMin = 0;
        sliderMax = steps.length - 1;
        stepScale = 1;
        sliderValue = steps.indexOf(Number(sliderValue));
        if (sliderValue === -1) { sliderValue = allVal; } // default to allValue if origSlider has value we can't use
    }
    //customize decimals
    if (sliderID == 'max_context' ||
        sliderID == 'mirostat_mode_textgenerationwebui' ||
        sliderID == 'mirostat_tau_textgenerationwebui' ||
        sliderID == 'top_k_textgenerationwebui' ||
        sliderID == 'num_beams_textgenerationwebui' ||
        sliderID == 'no_repeat_ngram_size_textgenerationwebui' ||
        sliderID == 'min_length_textgenerationwebui' ||
        sliderID == 'top_k' ||
        sliderID == 'mirostat_mode_kobold' ||
        sliderID == 'rep_pen_range') {
        decimals = 0;
    }
    if (sliderID == 'min_temp_textgenerationwebui' ||
        sliderID == 'max_temp_textgenerationwebui') {
        decimals = 2;
    }
    if (sliderID == 'eta_cutoff_textgenerationwebui' ||
        sliderID == 'epsilon_cutoff_textgenerationwebui') {
        numSteps = 50;
        decimals = 1;
    }
    //customize steps
    if (sliderID == 'mirostat_mode_textgenerationwebui' ||
        sliderID == 'mirostat_mode_kobold') {
        numSteps = 2;
    }
    if (sliderID == 'encoder_rep_pen_textgenerationwebui') {
        numSteps = 14;
    }
    if (sliderID == 'max_context') {
        numSteps = 15;
    }
    if (sliderID == 'mirostat_tau_textgenerationwebui' ||
        sliderID == 'top_k_textgenerationwebui' ||
        sliderID == 'num_beams_textgenerationwebui' ||
        sliderID == 'no_repeat_ngram_size_textgenerationwebui' ||
        sliderID == 'epsilon_cutoff_textgenerationwebui' ||
        sliderID == 'tfs_textgenerationwebui' ||
        sliderID == 'min_p_textgenerationwebui' ||
        sliderID == 'temp_textgenerationwebui' ||
        sliderID == 'temp') {
        numSteps = 20;
    }
    if (sliderID == 'mirostat_eta_textgenerationwebui' ||
        sliderID == 'penalty_alpha_textgenerationwebui' ||
        sliderID == 'length_penalty_textgenerationwebui' ||
        sliderID == 'min_temp_textgenerationwebui' ||
        sliderID == 'max_temp_textgenerationwebui') {
        numSteps = 50;
    }
    //customize off values
    if (sliderID == 'presence_pen_textgenerationwebui' ||
        sliderID == 'freq_pen_textgenerationwebui' ||
        sliderID == 'mirostat_mode_textgenerationwebui' ||
        sliderID == 'mirostat_mode_kobold' ||
        sliderID == 'mirostat_tau_textgenerationwebui' ||
        sliderID == 'mirostat_tau_kobold' ||
        sliderID == 'mirostat_eta_textgenerationwebui' ||
        sliderID == 'mirostat_eta_kobold' ||
        sliderID == 'min_p_textgenerationwebui' ||
        sliderID == 'min_p' ||
        sliderID == 'no_repeat_ngram_size_textgenerationwebui' ||
        sliderID == 'penalty_alpha_textgenerationwebui' ||
        sliderID == 'length_penalty_textgenerationwebui' ||
        sliderID == 'epsilon_cutoff_textgenerationwebui' ||
        sliderID == 'rep_pen_range' ||
        sliderID == 'eta_cutoff_textgenerationwebui' ||
        sliderID == 'top_a_textgenerationwebui' ||
        sliderID == 'top_a' ||
        sliderID == 'top_k_textgenerationwebui' ||
        sliderID == 'top_k' ||
        sliderID == 'rep_pen_slope' ||
        sliderID == 'min_length_textgenerationwebui') {
        offVal = 0;
    }
    if (sliderID == 'rep_pen_textgenerationwebui' ||
        sliderID == 'rep_pen' ||
        sliderID == 'tfs_textgenerationwebui' ||
        sliderID == 'tfs' ||
        sliderID == 'top_p_textgenerationwebui' ||
        sliderID == 'top_p' ||
        sliderID == 'typical_p_textgenerationwebui' ||
        sliderID == 'typical_p' ||
        sliderID == 'encoder_rep_pen_textgenerationwebui' ||
        sliderID == 'temp_textgenerationwebui' ||
        sliderID == 'temp' ||
        sliderID == 'guidance_scale_textgenerationwebui' ||
        sliderID == 'guidance_scale') {
        offVal = 1;
    }
    if (sliderID == 'guidance_scale_textgenerationwebui') {
        numSteps = 78;
    }
    //customize amt gen steps
    if (sliderID !== 'amount_gen' && sliderID !== 'rep_pen_range_textgenerationwebui') {
        stepScale = sliderRange / numSteps;
    }
    var newSlider = $('<div>')
        .attr('id', `${sliderID}_zenslider`)
        .css('width', '100%')
        .insertBefore(originalSlider);
    newSlider.slider({
        value: sliderValue,
        step: stepScale,
        min: sliderMin,
        max: sliderMax,
        create: async function () {
            await delay(100);
            var handle = $(this).find('.ui-slider-handle');
            var handleText, stepNumber, leftMargin;

            //handling creation of amt_gen
            if (newSlider.attr('id') == 'amount_gen_zenslider') {
                handleText = steps[sliderValue];
                stepNumber = sliderValue;
                leftMargin = ((stepNumber) / numSteps) * 50 * -1;
                handle.text(handleText)
                    .css('margin-left', `${leftMargin}px`);
                //console.log(`${newSlider.attr('id')} initial value:${handleText}, stepNum:${stepNumber}, numSteps:${numSteps}, left-margin:${leftMargin}`)
            }
            //handling creation of rep_pen_range for ooba
            else if (newSlider.attr('id') == 'rep_pen_range_textgenerationwebui_zenslider') {
                if ($('#rep_pen_range_textgenerationwebui_zensliders').length !== 0) {
                    $('#rep_pen_range_textgenerationwebui_zensliders').remove();
                }
                handleText = steps[sliderValue];
                stepNumber = sliderValue;
                leftMargin = ((stepNumber) / numSteps) * 50 * -1;
                if (sliderValue === offVal) {
                    handleText = 'Off';
                    handle.css('color', 'rgba(128,128,128,0.5');
                }
                else if (sliderValue === allVal) { handleText = 'All'; }
                else { handle.css('color', ''); }
                handle.text(handleText)
                    .css('margin-left', `${leftMargin}px`);
                //console.log(sliderValue, handleText, offVal, allVal)
                //console.log(`${newSlider.attr('id')} sliderValue = ${sliderValue}, handleText:${handleText}, stepNum:${stepNumber}, numSteps:${numSteps}, left-margin:${leftMargin}`)
                originalSlider.val(steps[sliderValue]);
            }
            //create all other sliders
            else {
                var numVal = Number(sliderValue).toFixed(decimals);
                offVal = Number(offVal).toFixed(decimals);
                if (numVal === offVal) {
                    handle.text('Off').css('color', 'rgba(128,128,128,0.5');
                } else {
                    handle.text(numVal).css('color', '');
                }
                stepNumber = ((sliderValue - sliderMin) / stepScale);
                leftMargin = (stepNumber / numSteps) * 50 * -1;
                originalSlider.val(numVal)
                    .data('newSlider', newSlider);
                //console.log(`${newSlider.attr('id')} sliderValue = ${sliderValue}, handleText:${handleText, numVal}, stepNum:${stepNumber}, numSteps:${numSteps}, left-margin:${leftMargin}`)
                var isManualInput = false;
                var valueBeforeManualInput;
                handle.css('margin-left', `${leftMargin}px`)

                    .attr('contenteditable', 'true')
                    //these sliders need listeners for manual inputs
                    .on('click', function () {
                        //this just selects all the text in the handle so user can overwrite easily
                        //needed because JQUery UI uses left/right arrow keys as well as home/end to move the slider..
                        valueBeforeManualInput = newSlider.val();
                        console.log(valueBeforeManualInput);
                        let handleElement = handle.get(0);
                        let range = document.createRange();
                        range.selectNodeContents(handleElement);
                        let selection = window.getSelection();
                        selection.removeAllRanges();
                        selection.addRange(range);
                    })
                    .on('keyup', function (e) {
                        valueBeforeManualInput = numVal;
                        //console.log(valueBeforeManualInput, numVal, handleText);
                        isManualInput = true;
                        //allow enter to trigger slider update
                        if (e.key === 'Enter') {
                            e.preventDefault;
                            handle.trigger('blur');
                        }
                    })
                    //trigger slider changes when user clicks away
                    .on('mouseup blur', function () {
                        let manualInput = parseFloat(handle.text()).toFixed(decimals);
                        if (isManualInput) {
                            //disallow manual inputs outside acceptable range
                            if (manualInput >= sliderMin && manualInput <= sliderMax) {
                                //if value is ok, assign to slider and update handle text and position
                                newSlider.val(manualInput);
                                handleSlideEvent.call(newSlider, null, { value: parseFloat(manualInput) }, 'manual');
                                valueBeforeManualInput = manualInput;
                            } else {
                                //if value not ok, warn and reset to last known valid value
                                toastr.warning(`Invalid value. Must be between ${sliderMin} and ${sliderMax}`);
                                console.log(valueBeforeManualInput);
                                newSlider.val(valueBeforeManualInput);
                                handle.text(valueBeforeManualInput);
                                handleSlideEvent.call(newSlider, null, { value: parseFloat(valueBeforeManualInput) }, 'manual');
                            }
                        }
                        isManualInput = false;
                    });
            }
            //zenSlider creation done, hide the original
            originalSlider.hide();
        },
        slide: handleSlideEvent,
    });

    function handleSlideEvent(event, ui, type) {
        var handle = $(this).find('.ui-slider-handle');
        var numVal = Number(ui.value).toFixed(decimals);
        offVal = Number(offVal).toFixed(decimals);
        allVal = Number(allVal).toFixed(decimals);
        console.log(numVal, sliderMin, sliderMax, numVal > sliderMax, numVal < sliderMin);
        if (numVal > sliderMax) { numVal = sliderMax; }
        if (numVal < sliderMin) { numVal = sliderMin; }
        var stepNumber = ((ui.value - sliderMin) / stepScale).toFixed(0);
        var handleText = (ui.value);
        var leftMargin = (stepNumber / numSteps) * 50 * -1;
        var perStepPercent = 1 / numSteps; //how far in % each step should be on the slider
        var leftPos = newSlider.width() * (stepNumber * perStepPercent); //how big of a left margin to give the slider for manual inputs
        /*         console.log(`
                numVal: ${numVal},
                sliderMax: ${sliderMax}
                sliderMin: ${sliderMin}
                sliderValRange: ${sliderValRange}
                stepScale: ${stepScale}
                Step: ${stepNumber} of ${numSteps}
                offVal: ${offVal}
                allVal = ${allVal}
                initial value: ${handleText}
                left-margin: ${leftMargin}
                width: ${newSlider.width()}
                percent of max: ${percentOfMax}
                left: ${leftPos}`) */
        //special handling for response length slider, pulls text aliases for step values from an array
        if (newSlider.attr('id') == 'amount_gen_zenslider') {
            handleText = steps[stepNumber];
            handle.text(handleText);
            newSlider.val(stepNumber);
            numVal = steps[stepNumber];
        }
        //special handling for TextCompletion rep pen range slider, pulls text aliases for step values from an array
        else if (newSlider.attr('id') == 'rep_pen_range_textgenerationwebui_zenslider') {
            handleText = steps[stepNumber];
            handle.text(handleText);
            newSlider.val(stepNumber);
            if (numVal === offVal) { handle.text('Off').css('color', 'rgba(128,128,128,0.5'); }
            else if (numVal === allVal) { handle.text('All'); }
            else { handle.css('color', ''); }
            numVal = steps[stepNumber];
        }
        //everything else uses the flat slider value
        //also note: the above sliders are not custom inputtable due to the array aliasing
        else {
            //show 'off' if disabled value is set
            if (numVal === offVal) { handle.text('Off').css('color', 'rgba(128,128,128,0.5'); }
            else { handle.text(ui.value.toFixed(decimals)).css('color', ''); }
            newSlider.val(handleText);
        }
        //for manually typed-in values we must adjust left position because JQUI doesn't do it for us
        handle.css('left', leftPos);
        //adjust a negative left margin to avoid overflowing right side of slider body
        handle.css('margin-left', `${leftMargin}px`);
        originalSlider.val(numVal);
        originalSlider.trigger('input');
        originalSlider.trigger('change');
    }
}
function switchUiMode() {
    const fastUi = localStorage.getItem(storage_keys.fast_ui_mode);
    power_user.fast_ui_mode = fastUi === null ? true : fastUi == 'true';
    $('body').toggleClass('no-blur', power_user.fast_ui_mode);
    $('#fast_ui_mode').prop('checked', power_user.fast_ui_mode);
    if (power_user.fast_ui_mode) {
        $('#blur-strength-block').css('opacity', '0.2');
        $('#blur_strength').prop('disabled', true);
    } else {
        $('#blur-strength-block').css('opacity', '1');
        $('#blur_strength').prop('disabled', false);
    }
}

function toggleWaifu() {
    $('#waifuMode').trigger('click');
}

function switchWaifuMode() {
    $('body').toggleClass('waifuMode', power_user.waifuMode);
    $('#waifuMode').prop('checked', power_user.waifuMode);
    scrollChatToBottom();
}

function switchSpoilerMode() {
    if (power_user.spoiler_free_mode) {
        $('#description_div').hide();
        $('#description_textarea').hide();
        $('#firstmessage_textarea').hide();
        $('#first_message_div').hide();
        $('#spoiler_free_desc').show();
    }
    else {
        $('#description_div').show();
        $('#description_textarea').show();
        $('#firstmessage_textarea').show();
        $('#first_message_div').show();
        $('#spoiler_free_desc').hide();
    }
}

function peekSpoilerMode() {
    $('#description_div').toggle();
    $('#description_textarea').toggle();
    $('#firstmessage_textarea').toggle();
    $('#first_message_div').toggle();

}


function switchMovingUI() {
    const movingUI = localStorage.getItem(storage_keys.movingUI);
    power_user.movingUI = movingUI === null ? false : movingUI == 'true';
    $('body').toggleClass('movingUI', power_user.movingUI);
    if (power_user.movingUI === true) {
        initMovingUI();
        if (power_user.movingUIState) {
            loadMovingUIState();
        }
    }
}

function noShadows() {
    const noShadows = localStorage.getItem(storage_keys.noShadows);
    power_user.noShadows = noShadows === null ? false : noShadows == 'true';
    $('body').toggleClass('noShadows', power_user.noShadows);
    $('#noShadowsmode').prop('checked', power_user.noShadows);
    if (power_user.noShadows) {
        $('#shadow-width-block').css('opacity', '0.2');
        $('#shadow_width').prop('disabled', true);
    } else {
        $('#shadow-width-block').css('opacity', '1');
        $('#shadow_width').prop('disabled', false);
    }
    scrollChatToBottom();
}

function applyAvatarStyle() {
    power_user.avatar_style = Number(localStorage.getItem(storage_keys.avatar_style) ?? avatar_styles.ROUND);
    $('body').toggleClass('big-avatars', power_user.avatar_style === avatar_styles.RECTANGULAR);
    $('body').toggleClass('square-avatars', power_user.avatar_style === avatar_styles.SQUARE);
    $('#avatar_style').val(power_user.avatar_style).prop('selected', true);
    //$(`input[name="avatar_style"][value="${power_user.avatar_style}"]`).prop("checked", true);

}

function applyChatDisplay() {

    if (!power_user.chat_display === (null || undefined)) {
        console.debug('applyChatDisplay: saw no chat display type defined');
        return;
    }
    console.debug(`poweruser.chat_display ${power_user.chat_display}`);
    $('#chat_display').val(power_user.chat_display).prop('selected', true);

    switch (power_user.chat_display) {
        case 0: {
            console.log('applying default chat');
            $('body').removeClass('bubblechat');
            $('body').removeClass('documentstyle');
            break;
        }
        case 1: {
            console.log('applying bubblechat');
            $('body').addClass('bubblechat');
            $('body').removeClass('documentstyle');
            break;
        }
        case 2: {
            console.log('applying document style');
            $('body').removeClass('bubblechat');
            $('body').addClass('documentstyle');
            break;
        }
    }
}

function applyChatWidth(type) {
    power_user.chat_width = Number(localStorage.getItem(storage_keys.chat_width) ?? 50);

    if (type === 'forced') {
        let r = document.documentElement;
        r.style.setProperty('--sheldWidth', `${power_user.chat_width}vw`);
        $('#chat_width_slider').val(power_user.chat_width);
        //document.documentElement.style.setProperty('--sheldWidth', power_user.chat_width);
    } else {
        //this is to prevent the slider from updating page in real time
        $('#chat_width_slider').off('mouseup touchend').on('mouseup touchend', async () => {
            // This is a hack for Firefox to let it render before applying the block width.
            // Otherwise it takes the incorrect slider position with the new value AFTER the resizing.
            await delay(1);
            document.documentElement.style.setProperty('--sheldWidth', `${power_user.chat_width}vw`);
            await delay(1);
        });
    }

    $('#chat_width_slider_counter').val(power_user.chat_width);
}

async function applyThemeColor(type) {
    if (type === 'main') {
        document.documentElement.style.setProperty('--SmartThemeBodyColor', power_user.main_text_color);
        const color = power_user.main_text_color.split('(')[1].split(')')[0].split(',');
        document.documentElement.style.setProperty('--SmartThemeCheckboxBgColorR', color[0]);
        document.documentElement.style.setProperty('--SmartThemeCheckboxBgColorG', color[1]);
        document.documentElement.style.setProperty('--SmartThemeCheckboxBgColorB', color[2]);
        document.documentElement.style.setProperty('--SmartThemeCheckboxBgColorA', color[3]);
    }
    if (type === 'italics') {
        document.documentElement.style.setProperty('--SmartThemeEmColor', power_user.italics_text_color);
    }
    if (type === 'quote') {
        document.documentElement.style.setProperty('--SmartThemeQuoteColor', power_user.quote_text_color);
    }
    /*     if (type === 'fastUIBG') {
            document.documentElement.style.setProperty('--SmartThemeFastUIBGColor', power_user.fastui_bg_color);
        } */
    if (type === 'blurTint') {
        document.documentElement.style.setProperty('--SmartThemeBlurTintColor', power_user.blur_tint_color);
    }
    if (type === 'chatTint') {
        document.documentElement.style.setProperty('--SmartThemeChatTintColor', power_user.chat_tint_color);
    }
    if (type === 'userMesBlurTint') {
        document.documentElement.style.setProperty('--SmartThemeUserMesBlurTintColor', power_user.user_mes_blur_tint_color);
    }
    if (type === 'botMesBlurTint') {
        document.documentElement.style.setProperty('--SmartThemeBotMesBlurTintColor', power_user.bot_mes_blur_tint_color);
    }
    if (type === 'shadow') {
        document.documentElement.style.setProperty('--SmartThemeShadowColor', power_user.shadow_color);
    }
    if (type === 'border') {
        document.documentElement.style.setProperty('--SmartThemeBorderColor', power_user.border_color);
    }
}

async function applyCustomCSS() {
    power_user.custom_css = String(localStorage.getItem(storage_keys.custom_css) ?? '');

    if (power_user.custom_css.includes('@import')) {
        var removeImport = /@import[^;]+;/gm;
        power_user.custom_css = power_user.custom_css.replace(removeImport, '');
        localStorage.setItem(storage_keys.custom_css, power_user.custom_css);
        toastr.warning('@import not allowed in Custom CSS. @import lines removed.');
    }

    $('#customCSS').val(power_user.custom_css);
    var styleId = 'custom-style';
    var style = document.getElementById(styleId);
    if (!style) {
        style = document.createElement('style');
        style.setAttribute('type', 'text/css');
        style.setAttribute('id', styleId);
        document.head.appendChild(style);
    }
    style.innerHTML = power_user.custom_css;
}

async function applyBlurStrength() {
    power_user.blur_strength = Number(localStorage.getItem(storage_keys.blur_strength) ?? 1);
    document.documentElement.style.setProperty('--blurStrength', power_user.blur_strength);
    $('#blur_strength_counter').val(power_user.blur_strength);
    $('#blur_strength').val(power_user.blur_strength);


}

async function applyShadowWidth() {
    power_user.shadow_width = Number(localStorage.getItem(storage_keys.shadow_width) ?? 2);
    document.documentElement.style.setProperty('--shadowWidth', power_user.shadow_width);
    $('#shadow_width_counter').val(power_user.shadow_width);
    $('#shadow_width').val(power_user.shadow_width);

}

async function applyFontScale(type) {

    power_user.font_scale = Number(localStorage.getItem(storage_keys.font_scale) ?? 1);
    //this is to allow forced setting on page load, theme swap, etc
    if (type === 'forced') {
        document.documentElement.style.setProperty('--fontScale', power_user.font_scale);
    } else {
        //this is to prevent the slider from updating page in real time
        $('#font_scale').off('mouseup touchend').on('mouseup touchend', () => {
            document.documentElement.style.setProperty('--fontScale', power_user.font_scale);
        });
    }

    $('#font_scale_counter').val(power_user.font_scale);
    $('#font_scale').val(power_user.font_scale);
}

async function applyTheme(name) {
    const theme = themes.find(x => x.name == name);

    if (!theme) {
        return;
    }

    const themeProperties = [
        { key: 'main_text_color', selector: '#main-text-color-picker', type: 'main' },
        { key: 'italics_text_color', selector: '#italics-color-picker', type: 'italics' },
        { key: 'quote_text_color', selector: '#quote-color-picker', type: 'quote' },
        { key: 'blur_tint_color', selector: '#blur-tint-color-picker', type: 'blurTint' },
        { key: 'chat_tint_color', selector: '#chat-tint-color-picker', type: 'chatTint' },
        { key: 'user_mes_blur_tint_color', selector: '#user-mes-blur-tint-color-picker', type: 'userMesBlurTint' },
        { key: 'bot_mes_blur_tint_color', selector: '#bot-mes-blur-tint-color-picker', type: 'botMesBlurTint' },
        { key: 'shadow_color', selector: '#shadow-color-picker', type: 'shadow' },
        { key: 'border_color', selector: '#border-color-picker', type: 'border' },
        {
            key: 'blur_strength',
            action: async () => {
                localStorage.setItem(storage_keys.blur_strength, power_user.blur_strength);
                await applyBlurStrength();
            },
        },
        {
            key: 'custom_css',
            action: async () => {
                localStorage.setItem(storage_keys.custom_css, power_user.custom_css);
                await applyCustomCSS();
            },
        },
        {
            key: 'shadow_width',
            action: async () => {
                localStorage.setItem(storage_keys.shadow_width, power_user.shadow_width);
                await applyShadowWidth();
            },
        },
        {
            key: 'font_scale',
            action: async () => {
                localStorage.setItem(storage_keys.font_scale, power_user.font_scale);
                await applyFontScale('forced');
            },
        },
        {
            key: 'fast_ui_mode',
            action: async () => {
                localStorage.setItem(storage_keys.fast_ui_mode, power_user.fast_ui_mode);
                switchUiMode();
            },
        },
        {
            key: 'waifuMode',
            action: async () => {
                localStorage.setItem(storage_keys.waifuMode, power_user.waifuMode);
                switchWaifuMode();
            },
        },
        {
            key: 'chat_display',
            action: async () => {
                localStorage.setItem(storage_keys.chat_display, power_user.chat_display);
                applyChatDisplay();
            },
        },
        {
            key: 'avatar_style',
            action: async () => {
                localStorage.setItem(storage_keys.avatar_style, power_user.avatar_style);
                applyAvatarStyle();
            },
        },
        {
            key: 'noShadows',
            action: async () => {
                localStorage.setItem(storage_keys.noShadows, power_user.noShadows);
                noShadows();
            },
        },
        {
            key: 'chat_width',
            action: async () => {
                // If chat width is not set, set it to 50
                if (!power_user.chat_width) {
                    power_user.chat_width = 50;
                }

                localStorage.setItem(storage_keys.chat_width, String(power_user.chat_width));
                applyChatWidth('forced');
            },
        },
        {
            key: 'timer_enabled',
            action: async () => {
                localStorage.setItem(storage_keys.timer_enabled, Boolean(power_user.timer_enabled));
                switchTimer();
            },
        },
        {
            key: 'timestamps_enabled',
            action: async () => {
                localStorage.setItem(storage_keys.timestamps_enabled, Boolean(power_user.timestamps_enabled));
                switchTimestamps();
            },
        },
        {
            key: 'timestamp_model_icon',
            action: async () => {
                localStorage.setItem(storage_keys.timestamp_model_icon, Boolean(power_user.timestamp_model_icon));
                switchIcons();
            },
        },
        {
            key: 'message_token_count_enabled',
            action: async () => {
                localStorage.setItem(storage_keys.message_token_count_enabled, Boolean(power_user.message_token_count_enabled));
                switchTokenCount();
            },
        },
        {
            key: 'mesIDDisplay_enabled',
            action: async () => {
                localStorage.setItem(storage_keys.mesIDDisplay_enabled, Boolean(power_user.mesIDDisplay_enabled));
                switchMesIDDisplay();
            },
        },
        {
            key: 'expand_message_actions',
            action: async () => {
                localStorage.setItem(storage_keys.expand_message_actions, Boolean(power_user.expand_message_actions));
                switchMessageActions();
            },
        },
        {
            key: 'enableZenSliders',
            action: async () => {
                localStorage.setItem(storage_keys.enableZenSliders, Boolean(power_user.enableZenSliders));
                switchMessageActions();
            },
        },
        {
            key: 'enableLabMode',
            action: async () => {
                localStorage.setItem(storage_keys.enableLabMode, Boolean(power_user.enableLabMode));
                switchMessageActions();
            },
        },
        {
            key: 'hotswap_enabled',
            action: async () => {
                localStorage.setItem(storage_keys.hotswap_enabled, Boolean(power_user.hotswap_enabled));
                switchHotswap();
            },
        },
        {
            key: 'bogus_folders',
            action: async () => {
                $('#bogus_folders').prop('checked', power_user.bogus_folders);
                await printCharacters(true);
            },
        },
        {
            key: 'reduced_motion',
            action: async () => {
                localStorage.setItem(storage_keys.reduced_motion, String(power_user.reduced_motion));
                $('#reduced_motion').prop('checked', power_user.reduced_motion);
                switchReducedMotion();
            },
        },
        {
            key: 'compact_input_area',
            action: async () => {
                localStorage.setItem(storage_keys.compact_input_area, String(power_user.compact_input_area));
                $('#compact_input_area').prop('checked', power_user.compact_input_area);
                switchCompactInputArea();
            },
        },
    ];

    for (const { key, selector, type, action } of themeProperties) {
        if (theme[key] !== undefined) {
            power_user[key] = theme[key];
            if (selector) $(selector).attr('color', power_user[key]);
            if (type) await applyThemeColor(type);
            if (action) await action();
        } else {
            if (selector) { $(selector).attr('color', 'rgba(0,0,0,0)'); }
            console.debug(`Empty theme key: ${key}`);
            power_user[key] = '';
        }
    }

    console.log('theme applied: ' + name);
}

async function applyMovingUIPreset(name) {
    resetMovablePanels('quiet');
    const movingUIPreset = movingUIPresets.find(x => x.name == name);

    if (!movingUIPreset) {
        return;
    }

    power_user.movingUIState = movingUIPreset.movingUIState;


    console.log('MovingUI Preset applied: ' + name);
    loadMovingUIState();
}

/**
 * Register a function to be executed when the debug menu is opened.
 * @param {string} functionId Unique ID for the function.
 * @param {string} name Name of the function.
 * @param {string} description Description of the function.
 * @param {function} func Function to be executed.
 */
export function registerDebugFunction(functionId, name, description, func) {
    debug_functions.push({ functionId, name, description, func });
}

function showDebugMenu() {
    const template = renderTemplate('debug', { functions: debug_functions });
    callPopup(template, 'text', '', { wide: true, large: true });
}

switchUiMode();
applyFontScale('forced');
applyThemeColor();
applyChatWidth('forced');
applyAvatarStyle();
applyBlurStrength();
applyShadowWidth();
applyCustomCSS();
switchMovingUI();
noShadows();
switchHotswap();
switchTimer();
switchTimestamps();
switchIcons();
switchMesIDDisplay();
switchTokenCount();
switchMessageActions();

function getExampleMessagesBehavior() {
    if (power_user.strip_examples) {
        return 'strip';
    }

    if (power_user.pin_examples) {
        return 'keep';
    }

    return 'normal';
}

function loadPowerUserSettings(settings, data) {
    // Load from settings.json
    if (settings.power_user !== undefined) {
        Object.assign(power_user, settings.power_user);
    }

    if (data.themes !== undefined) {
        themes = data.themes;
    }

    if (data.movingUIPresets !== undefined) {
        movingUIPresets = data.movingUIPresets;
    }


    if (data.context !== undefined) {
        context_presets = data.context;
    }

    // These are still local storage
    const fastUi = localStorage.getItem(storage_keys.fast_ui_mode);
    const movingUI = localStorage.getItem(storage_keys.movingUI);
    const noShadows = localStorage.getItem(storage_keys.noShadows);
    const hotswap = localStorage.getItem(storage_keys.hotswap_enabled);
    const timer = localStorage.getItem(storage_keys.timer_enabled);
    const timestamps = localStorage.getItem(storage_keys.timestamps_enabled);
    const mesIDDisplay = localStorage.getItem(storage_keys.mesIDDisplay_enabled);
    const expandMessageActions = localStorage.getItem(storage_keys.expand_message_actions);
    const enableZenSliders = localStorage.getItem(storage_keys.enableZenSliders);
    const enableLabMode = localStorage.getItem(storage_keys.enableLabMode);
    const autoLoadChat = localStorage.getItem(storage_keys.auto_load_chat_legacy);
    const autoConnect = localStorage.getItem(storage_keys.auto_connect_legacy);

    if (autoLoadChat) {
        power_user.auto_load_chat = autoLoadChat === 'true';
        localStorage.removeItem(storage_keys.auto_load_chat_legacy);
    }

    if (autoConnect) {
        power_user.auto_connect = autoConnect === 'true';
        localStorage.removeItem(storage_keys.auto_connect_legacy);
    }

    power_user.fast_ui_mode = fastUi === null ? true : fastUi == 'true';
    power_user.movingUI = movingUI === null ? false : movingUI == 'true';
    power_user.noShadows = noShadows === null ? false : noShadows == 'true';
    power_user.hotswap_enabled = hotswap === null ? true : hotswap == 'true';
    power_user.timer_enabled = timer === null ? true : timer == 'true';
    power_user.timestamps_enabled = timestamps === null ? true : timestamps == 'true';
    power_user.mesIDDisplay_enabled = mesIDDisplay === null ? true : mesIDDisplay == 'true';
    power_user.expand_message_actions = expandMessageActions === null ? true : expandMessageActions == 'true';
    power_user.enableZenSliders = enableZenSliders === null ? false : enableZenSliders == 'true';
    power_user.enableLabMode = enableLabMode === null ? false : enableLabMode == 'true';
    power_user.avatar_style = Number(localStorage.getItem(storage_keys.avatar_style) ?? avatar_styles.ROUND);
    //power_user.chat_display = Number(localStorage.getItem(storage_keys.chat_display) ?? chat_styles.DEFAULT);
    power_user.chat_width = Number(localStorage.getItem(storage_keys.chat_width) ?? 50);
    power_user.font_scale = Number(localStorage.getItem(storage_keys.font_scale) ?? 1);
    power_user.blur_strength = Number(localStorage.getItem(storage_keys.blur_strength) ?? 10);

    if (power_user.chat_display === '') {
        power_user.chat_display = chat_styles.DEFAULT;
    }

    if (power_user.waifuMode === '') {
        power_user.waifuMode = false;
    }

    if (power_user.chat_width === '') {
        power_user.chat_width = 50;
    }

    if (power_user.tokenizer === tokenizers.LEGACY) {
        power_user.tokenizer = tokenizers.GPT2;
    }

    $('#single_line').prop('checked', power_user.single_line);
    $('#relaxed_api_urls').prop('checked', power_user.relaxed_api_urls);
    $('#world_import_dialog').prop('checked', power_user.world_import_dialog);
    $('#trim_spaces').prop('checked', power_user.trim_spaces);
    $('#continue_on_send').prop('checked', power_user.continue_on_send);
    $('#quick_continue').prop('checked', power_user.quick_continue);
    $('#mes_continue').css('display', power_user.quick_continue ? '' : 'none');
    $('#gestures-checkbox').prop('checked', power_user.gestures);
    $('#auto_swipe').prop('checked', power_user.auto_swipe);
    $('#auto_swipe_minimum_length').val(power_user.auto_swipe_minimum_length);
    $('#auto_swipe_blacklist').val(power_user.auto_swipe_blacklist.join(', '));
    $('#auto_swipe_blacklist_threshold').val(power_user.auto_swipe_blacklist_threshold);
    $('#custom_stopping_strings').val(power_user.custom_stopping_strings);
    $('#custom_stopping_strings_macro').prop('checked', power_user.custom_stopping_strings_macro);
    $('#fuzzy_search_checkbox').prop('checked', power_user.fuzzy_search);
    $('#persona_show_notifications').prop('checked', power_user.persona_show_notifications);
    $('#encode_tags').prop('checked', power_user.encode_tags);
    $('#example_messages_behavior').val(getExampleMessagesBehavior());
    $(`#example_messages_behavior option[value="${getExampleMessagesBehavior()}"]`).prop('selected', true);

    $('#console_log_prompts').prop('checked', power_user.console_log_prompts);
    $('#auto_fix_generated_markdown').prop('checked', power_user.auto_fix_generated_markdown);
    $('#auto_scroll_chat_to_bottom').prop('checked', power_user.auto_scroll_chat_to_bottom);
    $('#bogus_folders').prop('checked', power_user.bogus_folders);
    $(`#tokenizer option[value="${power_user.tokenizer}"]`).attr('selected', true);
    $(`#send_on_enter option[value=${power_user.send_on_enter}]`).attr('selected', true);
    $('#import_card_tags').prop('checked', power_user.import_card_tags);
    $('#confirm_message_delete').prop('checked', power_user.confirm_message_delete !== undefined ? !!power_user.confirm_message_delete : true);
    $('#spoiler_free_mode').prop('checked', power_user.spoiler_free_mode);
    $('#collapse-newlines-checkbox').prop('checked', power_user.collapse_newlines);
    $('#always-force-name2-checkbox').prop('checked', power_user.always_force_name2);
    $('#trim_sentences_checkbox').prop('checked', power_user.trim_sentences);
    $('#include_newline_checkbox').prop('checked', power_user.include_newline);
    $('#render_formulas').prop('checked', power_user.render_formulas);
    $('#disable_group_trimming').prop('checked', power_user.disable_group_trimming);
    $('#markdown_escape_strings').val(power_user.markdown_escape_strings);
    $('#fast_ui_mode').prop('checked', power_user.fast_ui_mode);
    $('#waifuMode').prop('checked', power_user.waifuMode);
    $('#movingUImode').prop('checked', power_user.movingUI);
    $('#noShadowsmode').prop('checked', power_user.noShadows);
    $('#start_reply_with').val(power_user.user_prompt_bias);
    $('#chat-show-reply-prefix-checkbox').prop('checked', power_user.show_user_prompt_bias);
    $('#auto_continue_enabled').prop('checked', power_user.auto_continue.enabled);
    $('#auto_continue_allow_chat_completions').prop('checked', power_user.auto_continue.allow_chat_completions);
    $('#auto_continue_target_length').val(power_user.auto_continue.target_length);
    $('#play_message_sound').prop('checked', power_user.play_message_sound);
    $('#play_sound_unfocused').prop('checked', power_user.play_sound_unfocused);
    $('#never_resize_avatars').prop('checked', power_user.never_resize_avatars);
    $('#show_card_avatar_urls').prop('checked', power_user.show_card_avatar_urls);
    $('#auto_save_msg_edits').prop('checked', power_user.auto_save_msg_edits);
    $('#allow_name1_display').prop('checked', power_user.allow_name1_display);
    $('#allow_name2_display').prop('checked', power_user.allow_name2_display);
    //$("#removeXML").prop("checked", power_user.removeXML);
    $('#hotswapEnabled').prop('checked', power_user.hotswap_enabled);
    $('#messageTimerEnabled').prop('checked', power_user.timer_enabled);
    $('#messageTimestampsEnabled').prop('checked', power_user.timestamps_enabled);
    $('#messageModelIconEnabled').prop('checked', power_user.timestamp_model_icon);
    $('#mesIDDisplayEnabled').prop('checked', power_user.mesIDDisplay_enabled);
    $('#prefer_character_prompt').prop('checked', power_user.prefer_character_prompt);
    $('#prefer_character_jailbreak').prop('checked', power_user.prefer_character_jailbreak);
    $('#enableZenSliders').prop('checked', power_user.enableZenSliders).trigger('input');
    $('#enableLabMode').prop('checked', power_user.enableLabMode).trigger('input');
    $(`input[name="avatar_style"][value="${power_user.avatar_style}"]`).prop('checked', true);
    $(`#chat_display option[value=${power_user.chat_display}]`).attr('selected', true).trigger('change');
    $('#chat_width_slider').val(power_user.chat_width);
    $('#token_padding').val(power_user.token_padding);
    $('#aux_field').val(power_user.aux_field);
    $('#restore_user_input').prop('checked', power_user.restore_user_input);

    $('#chat_truncation').val(power_user.chat_truncation);
    $('#chat_truncation_counter').val(power_user.chat_truncation);

    $('#streaming_fps').val(power_user.streaming_fps);
    $('#streaming_fps_counter').val(power_user.streaming_fps);

    $('#font_scale').val(power_user.font_scale);
    $('#font_scale_counter').val(power_user.font_scale);

    $('#blur_strength').val(power_user.blur_strength);
    $('#blur_strength_counter').val(power_user.blur_strength);

    $('#shadow_width').val(power_user.shadow_width);
    $('#shadow_width_counter').val(power_user.shadow_width);

    $('#main-text-color-picker').attr('color', power_user.main_text_color);
    $('#italics-color-picker').attr('color', power_user.italics_text_color);
    $('#quote-color-picker').attr('color', power_user.quote_text_color);
    $('#blur-tint-color-picker').attr('color', power_user.blur_tint_color);
    $('#chat-tint-color-picker').attr('color', power_user.chat_tint_color);
    $('#user-mes-blur-tint-color-picker').attr('color', power_user.user_mes_blur_tint_color);
    $('#bot-mes-blur-tint-color-picker').attr('color', power_user.bot_mes_blur_tint_color);
    $('#shadow-color-picker').attr('color', power_user.shadow_color);
    $('#border-color-picker').attr('color', power_user.border_color);
    $('#ui_mode_select').val(power_user.ui_mode).find(`option[value="${power_user.ui_mode}"]`).attr('selected', true);
    $('#reduced_motion').prop('checked', power_user.reduced_motion);
    $('#auto-connect-checkbox').prop('checked', power_user.auto_connect);
    $('#auto-load-chat-checkbox').prop('checked', power_user.auto_load_chat);

    for (const theme of themes) {
        const option = document.createElement('option');
        option.value = theme.name;
        option.innerText = theme.name;
        option.selected = theme.name == power_user.theme;
        $('#themes').append(option);
    }

    for (const movingUIPreset of movingUIPresets) {
        const option = document.createElement('option');
        option.value = movingUIPreset.name;
        option.innerText = movingUIPreset.name;
        option.selected = movingUIPreset.name == power_user.movingUIPreset;
        $('#movingUIPresets').append(option);
    }


    $(`#character_sort_order option[data-order="${power_user.sort_order}"][data-field="${power_user.sort_field}"]`).prop('selected', true);
    switchReducedMotion();
    switchCompactInputArea();
    reloadMarkdownProcessor(power_user.render_formulas);
    loadInstructMode(data);
    loadContextSettings();
    loadMaxContextUnlocked();
    switchWaifuMode();
    switchSpoilerMode();
    loadMovingUIState();
    loadCharListState();
    switchSimpleMode();
}

async function loadCharListState() {
    if (document.querySelector('.character_select') !== null) {
        console.debug('setting charlist state to...');
        if (power_user.charListGrid === true) {
            console.debug('..to grid');
            $('#charListGridToggle').trigger('click');
        } else { console.debug('..to list'); }
    } else {
        console.debug('charlist not ready yet');
        await delay(100);
        loadCharListState();
    }
}

function loadMovingUIState() {
    if (!isMobile()
        && power_user.movingUIState
        && power_user.movingUI === true) {
        console.debug('loading movingUI state');
        for (var elmntName of Object.keys(power_user.movingUIState)) {
            var elmntState = power_user.movingUIState[elmntName];
            try {
                var elmnt = $('#' + $.escapeSelector(elmntName));
                if (elmnt.length) {
                    console.debug(`loading state for ${elmntName}`);
                    elmnt.css(elmntState);
                } else {
                    console.debug(`skipping ${elmntName} because it doesn't exist in the DOM`);
                }
            } catch (err) {
                console.debug(`error occurred while processing ${elmntName}: ${err}`);
            }
        }
    } else {
        console.debug('skipping movingUI state load');
        return;
    }
}

function loadMaxContextUnlocked() {
    $('#max_context_unlocked').prop('checked', power_user.max_context_unlocked);
    $('#max_context_unlocked').on('change', function () {
        power_user.max_context_unlocked = !!$(this).prop('checked');
        switchMaxContextSize();
        saveSettingsDebounced();
    });
    switchMaxContextSize();
}

function switchMaxContextSize() {
    const elements = [$('#max_context'), $('#max_context_counter'), $('#rep_pen_range'), $('#rep_pen_range_counter'), $('#rep_pen_range_textgenerationwebui'), $('#rep_pen_range_counter_textgenerationwebui')];
    const maxValue = power_user.max_context_unlocked ? MAX_CONTEXT_UNLOCKED : MAX_CONTEXT_DEFAULT;
    const minValue = power_user.max_context_unlocked ? maxContextMin : maxContextMin;
    const steps = power_user.max_context_unlocked ? unlockedMaxContextStep : maxContextStep;
    $('#rep_pen_range_textgenerationwebui_zenslider').remove(); //unsure why, but this is necessary.
    for (const element of elements) {
        const id = element.attr('id');
        element.attr('max', maxValue);

        if (typeof id === 'string' && id?.indexOf('max_context') !== -1) {
            element.attr('min', minValue);
            element.attr('step', steps); //only change setps for max context, because rep pen range needs step of 1 due to important values of -1 and 0
        }
        const value = Number(element.val());

        if (value >= maxValue) {
            element.val(maxValue).trigger('input');
        }
    }

    const maxAmountGen = power_user.max_context_unlocked ? MAX_RESPONSE_UNLOCKED : MAX_RESPONSE_DEFAULT;
    $('#amount_gen').attr('max', maxAmountGen);
    $('#amount_gen_counter').attr('max', maxAmountGen);

    if (Number($('#amount_gen').val()) >= maxAmountGen) {
        $('#amount_gen').val(maxAmountGen).trigger('input');
    }

    if (power_user.enableZenSliders) {
        $('#max_context_zenslider').remove();
        CreateZenSliders($('#max_context'));
        $('#rep_pen_range_textgenerationwebui_zenslider').remove();
        CreateZenSliders($('#rep_pen_range_textgenerationwebui'));
    }
}

// Fetch a compiled object of all preset settings
function getContextSettings() {
    let compiledSettings = {};

    contextControls.forEach((control) => {
        let value = control.isGlobalSetting ? power_user[control.property] : power_user.context[control.property];

        // Force to a boolean if the setting is a checkbox
        if (control.isCheckbox) {
            value = !!value;
        }

        compiledSettings[control.property] = value;
    });

    return compiledSettings;
}

// TODO: Maybe add a refresh button to reset settings to preset
// TODO: Add "global state" if a preset doesn't set the power_user checkboxes
function loadContextSettings() {
    contextControls.forEach(control => {
        const $element = $(`#${control.id}`);

        if (control.isGlobalSetting) {
            return;
        }

        if (control.defaultValue !== undefined && power_user.context[control.property] === undefined) {
            power_user.context[control.property] = control.defaultValue;
        }

        if (control.isCheckbox) {
            $element.prop('checked', power_user.context[control.property]);
        } else {
            $element.val(power_user.context[control.property]);
        }

        // If the setting already exists, no need to duplicate it
        // TODO: Maybe check the power_user object for the setting instead of a flag?
        $element.on('input', function () {
            const value = control.isCheckbox ? !!$(this).prop('checked') : $(this).val();
            if (control.isGlobalSetting) {
                power_user[control.property] = value;
            } else {
                power_user.context[control.property] = value;
            }

            saveSettingsDebounced();
            if (!control.isCheckbox) {
                resetScrollHeight($element);
            }
        });
    });

    context_presets.forEach((preset) => {
        const name = preset.name;
        const option = document.createElement('option');
        option.value = name;
        option.innerText = name;
        option.selected = name === power_user.context.preset;
        $('#context_presets').append(option);
    });

    $('#context_presets').on('change', function () {
        const name = String($(this).find(':selected').val());
        const preset = context_presets.find(x => x.name === name);

        if (!preset) {
            return;
        }

        power_user.context.preset = name;
        contextControls.forEach(control => {
            const presetValue = preset[control.property] ?? control.defaultValue;

            if (presetValue !== undefined) {
                if (control.isGlobalSetting) {
                    power_user[control.property] = presetValue;
                } else {
                    power_user.context[control.property] = presetValue;
                }

                const $element = $(`#${control.id}`);

                if (control.isCheckbox) {
                    $element
                        .prop('checked', control.isGlobalSetting ? power_user[control.property] : power_user.context[control.property])
                        .trigger('input');
                } else {
                    $element
                        .val(control.isGlobalSetting ? power_user[control.property] : power_user.context[control.property])
                        .trigger('input');
                }
            }
        });

        if (power_user.instruct.bind_to_context) {
            // Select matching instruct preset
            for (const instruct_preset of instruct_presets) {
                // If instruct preset matches the context template
                if (instruct_preset.name === name) {
                    selectInstructPreset(instruct_preset.name);
                    break;
                }
            }
        }

        highlightDefaultContext();
        saveSettingsDebounced();
    });

    $('#context_set_default').on('click', function () {
        if (power_user.context.preset !== power_user.default_context) {
            power_user.default_context = power_user.context.preset;
            $(this).addClass('default');
            toastr.info(`Default context template set to ${power_user.default_context}`);

            highlightDefaultContext();

            saveSettingsDebounced();
        }
    });

    highlightDefaultContext();
}

function highlightDefaultContext() {
    $('#context_set_default').toggleClass('default', power_user.default_context === power_user.context.preset);
    $('#context_set_default').toggleClass('disabled', power_user.default_context === power_user.context.preset);
    $('#context_delete_preset').toggleClass('disabled', power_user.default_context === power_user.context.preset);
}

export function fuzzySearchCharacters(searchValue) {
    const fuse = new Fuse(characters, {
        keys: [
            { name: 'data.name', weight: 8 },
            { name: 'data.description', weight: 3 },
            { name: 'data.mes_example', weight: 3 },
            { name: 'data.scenario', weight: 2 },
            { name: 'data.personality', weight: 2 },
            { name: 'data.first_mes', weight: 2 },
            { name: 'data.creator_notes', weight: 2 },
            { name: 'data.creator', weight: 1 },
            { name: 'data.tags', weight: 1 },
            { name: 'data.alternate_greetings', weight: 1 },
        ],
        includeScore: true,
        ignoreLocation: true,
        threshold: 0.2,
    });

    const results = fuse.search(searchValue);
    console.debug('Characters fuzzy search results for ' + searchValue, results);
    const indices = results.map(x => x.refIndex);
    return indices;
}

export function fuzzySearchWorldInfo(data, searchValue) {
    const fuse = new Fuse(data, {
        keys: [
            { name: 'key', weight: 3 },
            { name: 'content', weight: 3 },
            { name: 'comment', weight: 2 },
            { name: 'keysecondary', weight: 2 },
            { name: 'uid', weight: 1 },
        ],
        includeScore: true,
        ignoreLocation: true,
        threshold: 0.2,
    });

    const results = fuse.search(searchValue);
    console.debug('World Info fuzzy search results for ' + searchValue, results);
    return results.map(x => x.item?.uid);
}

export function fuzzySearchTags(searchValue) {
    const fuse = new Fuse(tags, {
        keys: [
            { name: 'name', weight: 1 },
        ],
        includeScore: true,
        ignoreLocation: true,
        threshold: 0.2,
    });

    const results = fuse.search(searchValue);
    console.debug('Tags fuzzy search results for ' + searchValue, results);
    const ids = results.map(x => String(x.item?.id)).filter(x => x);
    return ids;
}

export function fuzzySearchGroups(searchValue) {
    const fuse = new Fuse(groups, {
        keys: [
            { name: 'name', weight: 3 },
            { name: 'members', weight: 1 },
        ],
        includeScore: true,
        ignoreLocation: true,
        threshold: 0.2,
    });

    const results = fuse.search(searchValue);
    console.debug('Groups fuzzy search results for ' + searchValue, results);
    const ids = results.map(x => String(x.item?.id)).filter(x => x);
    return ids;
}

/**
 * Renders a story string template with the given parameters.
 * @param {object} params Template parameters.
 * @returns {string} The rendered story string.
 */
export function renderStoryString(params) {
    try {
        // compile the story string template into a function, with no HTML escaping
        const compiledTemplate = Handlebars.compile(power_user.context.story_string, { noEscape: true });

        // render the story string template with the given params
        let output = compiledTemplate(params);

        // substitute {{macro}} params that are not defined in the story string
        output = substituteParams(output, params.user, params.char);

        // remove leading newlines
        output = output.replace(/^\n+/, '');

        // add a newline to the end of the story string if it doesn't have one
        if (output.length > 0 && !output.endsWith('\n')) {
            output += '\n';
        }

        return output;
    } catch (e) {
        toastr.error('Check the story string template for validity', 'Error rendering story string');
        console.error('Error rendering story string', e);
        throw e; // rethrow the error
    }
}

const sortFunc = (a, b) => power_user.sort_order == 'asc' ? compareFunc(a, b) : compareFunc(b, a);
const compareFunc = (first, second) => {
    const a = first[power_user.sort_field];
    const b = second[power_user.sort_field];

    if (power_user.sort_field === 'create_date') {
        return sortMoments(timestampToMoment(b), timestampToMoment(a));
    }

    switch (power_user.sort_rule) {
        case 'boolean':
            if (a === true || a === 'true') return 1;  // Prioritize 'true' or true
            if (b === true || b === 'true') return -1; // Prioritize 'true' or true
            if (a && !b) return -1;        // Move truthy values to the end
            if (!a && b) return 1;         // Move falsy values to the beginning
            if (a === b) return 0;         // Sort equal values normally
            return a < b ? -1 : 1;         // Sort non-boolean values normally
        default:
            return typeof a == 'string'
                ? a.localeCompare(b)
                : a - b;
    }
};

/**
 * Sorts an array of entities based on the current sort settings
 * @param {any[]} entities An array of objects with an `item` property
 */
function sortEntitiesList(entities) {
    if (power_user.sort_field == undefined || entities.length === 0) {
        return;
    }

    if (power_user.sort_order === 'random') {
        shuffle(entities);
        return;
    }

    entities.sort((a, b) => {
        if (a.type === 'tag' && b.type !== 'tag') {
            return -1;
        }

        if (a.type !== 'tag' && b.type === 'tag') {
            return 1;
        }

        return sortFunc(a.item, b.item);
    });
}

/**
 * Updates the current UI theme file.
 */
async function updateTheme() {
    await saveTheme(power_user.theme);
    toastr.success('Theme saved.');
}

/**
 * Saves the current theme to the server.
 * @param {string|undefined} name Theme name. If undefined, a popup will be shown to enter a name.
 * @returns {Promise<void>} A promise that resolves when the theme is saved.
 */
async function saveTheme(name = undefined) {
    if (typeof name !== 'string') {
        name = await callPopup('Enter a theme preset name:', 'input', power_user.theme);

        if (!name) {
            return;
        }
    }

    const theme = {
        name,
        blur_strength: power_user.blur_strength,
        main_text_color: power_user.main_text_color,
        italics_text_color: power_user.italics_text_color,
        quote_text_color: power_user.quote_text_color,
        blur_tint_color: power_user.blur_tint_color,
        chat_tint_color: power_user.chat_tint_color,
        user_mes_blur_tint_color: power_user.user_mes_blur_tint_color,
        bot_mes_blur_tint_color: power_user.bot_mes_blur_tint_color,
        shadow_color: power_user.shadow_color,
        shadow_width: power_user.shadow_width,
        border_color: power_user.border_color,
        font_scale: power_user.font_scale,
        fast_ui_mode: power_user.fast_ui_mode,
        waifuMode: power_user.waifuMode,
        avatar_style: power_user.avatar_style,
        chat_display: power_user.chat_display,
        noShadows: power_user.noShadows,
        chat_width: power_user.chat_width,
        timer_enabled: power_user.timer_enabled,
        timestamps_enabled: power_user.timestamps_enabled,
        timestamp_model_icon: power_user.timestamp_model_icon,

        mesIDDisplay_enabled: power_user.mesIDDisplay_enabled,
        message_token_count_enabled: power_user.message_token_count_enabled,
        expand_message_actions: power_user.expand_message_actions,
        enableZenSliders: power_user.enableZenSliders,
        enableLabMode: power_user.enableLabMode,
        hotswap_enabled: power_user.hotswap_enabled,
        custom_css: power_user.custom_css,
        bogus_folders: power_user.bogus_folders,
        reduced_motion: power_user.reduced_motion,
        compact_input_area: power_user.compact_input_area,
    };

    const response = await fetch('/savetheme', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(theme),
    });

    if (response.ok) {
        const themeIndex = themes.findIndex(x => x.name == name);

        if (themeIndex == -1) {
            themes.push(theme);
            const option = document.createElement('option');
            option.selected = true;
            option.value = name;
            option.innerText = name;
            $('#themes').append(option);
        }
        else {
            themes[themeIndex] = theme;
            $(`#themes option[value="${name}"]`).attr('selected', true);
        }

        power_user.theme = name;
        saveSettingsDebounced();
    }
}

async function saveMovingUI() {
    const name = await callPopup('Enter a name for the MovingUI Preset:', 'input');

    if (!name) {
        return;
    }

    const movingUIPreset = {
        name,
        movingUIState: power_user.movingUIState,
    };
    console.log(movingUIPreset);

    const response = await fetch('/savemovingui', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(movingUIPreset),
    });

    if (response.ok) {
        const movingUIPresetIndex = movingUIPresets.findIndex(x => x.name == name);

        if (movingUIPresetIndex == -1) {
            movingUIPresets.push(movingUIPreset);
            const option = document.createElement('option');
            option.selected = true;
            option.value = name;
            option.innerText = name;
            $('#movingUIPresets').append(option);
        }
        else {
            movingUIPresets[movingUIPresetIndex] = movingUIPreset;
            $(`#movingUIPresets option[value="${name}"]`).attr('selected', true);
        }

        power_user.movingUIPreset = name;
        saveSettingsDebounced();
    } else {
        toastr.warning('failed to save MovingUI state.');
    }
}

async function resetMovablePanels(type) {
    const panelIds = [
        'sheld',
        'left-nav-panel',
        'right-nav-panel',
        'WorldInfo',
        'floatingPrompt',
        'expression-holder',
        'groupMemberListPopout',
        'summaryExtensionPopout',
        'gallery',
    ];

    const panelStyles = ['top', 'left', 'right', 'bottom', 'height', 'width', 'margin'];

    panelIds.forEach((id) => {
        console.log(id);
        const panel = document.getElementById(id);

        if (panel) {
            $(panel).addClass('resizing');
            panelStyles.forEach((style) => {
                panel.style[style] = '';
            });
        }
    });

    const zoomedAvatars = document.querySelectorAll('.zoomed_avatar');
    if (zoomedAvatars.length > 0) {
        zoomedAvatars.forEach((avatar) => {
            avatar.classList.add('resizing');
            panelStyles.forEach((style) => {
                avatar.style[style] = '';
            });
        });
    }

    $('[data-dragged="true"]').removeAttr('data-dragged');
    await delay(50);

    power_user.movingUIState = {};

    //if user manually resets panels, deselect the current preset
    if (type !== 'quiet' && type !== 'resize') {
        power_user.movingUIPreset = 'Default';
        $('#movingUIPresets option[value="Default"]').prop('selected', true);
    }

    saveSettingsDebounced();
    eventSource.emit(event_types.MOVABLE_PANELS_RESET);

    eventSource.once(event_types.SETTINGS_UPDATED, () => {
        $('.resizing').removeClass('resizing');
        //if happening as part of preset application, do it quietly.
        if (type === 'quiet') {
            return;
            //if happening due to resize, tell user.
        } else if (type === 'resize') {
            toastr.warning('Panel positions reset due to zoom/resize');
            //if happening due to manual button press
        } else {
            toastr.success('Panel positions reset');
        }
    });
}

function doNewChat() {
    setTimeout(() => {
        $('#option_start_new_chat').trigger('click');
    }, 1);
    //$("#dialogue_popup").hide();
    setTimeout(() => {
        $('#dialogue_popup_ok').trigger('click');
    }, 1);
}

async function doRandomChat() {
    resetSelectedGroup();
    const characterId = Math.floor(Math.random() * characters.length).toString();
    setCharacterId(characterId);
    await delay(1);
    await reloadCurrentChat();
    return characters[characterId]?.name;
}

/**
 * Loads the chat until the given message ID is displayed.
 * @param {number} mesId
 * @returns JQuery<HTMLElement>
 */
async function loadUntilMesId(mesId) {
    let target;

    while (getFirstDisplayedMessageId() > mesId && getFirstDisplayedMessageId() !== 0) {
        showMoreMessages();
        await delay(1);
        target = $('#chat').find(`.mes[mesid=${mesId}]`);

        if (target.length) {
            break;
        }
    }

    if (!target.length) {
        toastr.error(`Could not find message with ID: ${mesId}`);
        return target;
    }

    return target;
}

async function doMesCut(_, text) {
    console.debug(`was asked to cut message id #${text}`);
    const range = stringToRange(text, 0, chat.length - 1);

    //reject invalid args or no args
    if (!range) {
        toastr.warning('Must provide a Message ID or a range to cut.');
        return;
    }

    let totalMesToCut = (range.end - range.start) + 1;
    let mesIDToCut = range.start;

    for (let i = 0; i < totalMesToCut; i++) {
        let done = false;
        let mesToCut = $('#chat').find(`.mes[mesid=${mesIDToCut}]`);

        if (!mesToCut.length) {
            mesToCut = await loadUntilMesId(mesIDToCut);

            if (!mesToCut || !mesToCut.length) {
                return;
            }
        }

        setEditedMessageId(mesIDToCut);
        eventSource.once(event_types.MESSAGE_DELETED, () => {
            done = true;
        });
        mesToCut.find('.mes_edit_delete').trigger('click', { fromSlashCommand: true });
        while (!done) {
            await delay(1);
        }
    }
}

async function doDelMode(_, text) {
    //first enter delmode
    $('#option_delete_mes').trigger('click', { fromSlashCommand: true });

    //reject invalid args
    if (text && isNaN(text)) {
        toastr.warning('Must enter a number or nothing.');
        await delay(300); //unsure why 300 is neccessary here, but any shorter and it wont see the delmode UI
        $('#dialogue_del_mes_cancel').trigger('click');
        return;
    }

    //parse valid args
    if (text) {
        await delay(300); //same as above, need event signal for 'entered del mode'
        console.debug('parsing msgs to del');
        let numMesToDel = Number(text);
        let lastMesID = Number($('#chat .mes').last().attr('mesid'));
        let oldestMesIDToDel = lastMesID - numMesToDel + 1;

        if (oldestMesIDToDel < 0) {
            toastr.warning(`Cannot delete more than ${chat.length} messages.`);
            return;
        }

        let oldestMesToDel = $('#chat').find(`.mes[mesid=${oldestMesIDToDel}]`);

        if (!oldestMesIDToDel) {
            oldestMesToDel = await loadUntilMesId(oldestMesIDToDel);

            if (!oldestMesToDel || !oldestMesToDel.length) {
                return;
            }
        }

        let oldestDelMesCheckbox = $(oldestMesToDel).find('.del_checkbox');
        let newLastMesID = oldestMesIDToDel - 1;
        console.debug(`DelMesReport -- numMesToDel:  ${numMesToDel}, lastMesID: ${lastMesID}, oldestMesIDToDel:${oldestMesIDToDel}, newLastMesID: ${newLastMesID}`);
        oldestDelMesCheckbox.trigger('click');
        let trueNumberOfDeletedMessage = lastMesID - oldestMesIDToDel + 1;

        //await delay(1)
        $('#dialogue_del_mes_ok').trigger('click');
        toastr.success(`Deleted ${trueNumberOfDeletedMessage} messages.`);
        return;
    }
}

function doResetPanels() {
    $('#movingUIreset').trigger('click');
}

function setAvgBG() {
    const bgimg = new Image();
    bgimg.src = $('#bg1')
        .css('background-image')
        .replace(/^url\(['"]?/, '')
        .replace(/['"]?\)$/, '');

    /*     const charAvatar = new Image()
        charAvatar.src = $("#avatar_load_preview")
            .attr('src')
            .replace(/^url\(['"]?/, '')
            .replace(/['"]?\)$/, '');

        const userAvatar = new Image()
        userAvatar.src = $("#user_avatar_block .avatar.selected img")
            .attr('src')
            .replace(/^url\(['"]?/, '')
            .replace(/['"]?\)$/, ''); */


    bgimg.onload = function () {
        var rgb = getAverageRGB(bgimg);
        //console.log(`average color of the bg is:`)
        //console.log(rgb);
        $('#blur-tint-color-picker').attr('color', 'rgb(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ')');

        const backgroundColorString = $('#blur-tint-color-picker').attr('color')
            .replace('rgba', '')
            .replace('rgb', '')
            .replace('(', '[')
            .replace(')', ']');   //[50, 120, 200, 1]; // Example background color
        const backgroundColorArray = JSON.parse(backgroundColorString); //[200, 200, 200, 1]
        console.log(backgroundColorArray);
        $('#main-text-color-picker').attr('color', getReadableTextColor(backgroundColorArray));
        console.log($('#main-text-color-picker').attr('color')); // Output: 'rgba(0, 47, 126, 1)'
    };

    /*     charAvatar.onload = function () {
            var rgb = getAverageRGB(charAvatar);
            //console.log(`average color of the AI avatar is:`);
            //console.log(rgb);
            $("#bot-mes-blur-tint-color-picker").attr('color', 'rgb(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ')');
        }

        userAvatar.onload = function () {
            var rgb = getAverageRGB(userAvatar);
            //console.log(`average color of the user avatar is:`);
            //console.log(rgb);
            $("#user-mes-blur-tint-color-picker").attr('color', 'rgb(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ')');
        } */

    function getAverageRGB(imgEl) {

        var blockSize = 5, // only visit every 5 pixels
            defaultRGB = { r: 0, g: 0, b: 0 }, // for non-supporting envs
            canvas = document.createElement('canvas'),
            context = canvas.getContext && canvas.getContext('2d'),
            data, width, height,
            i = -4,
            length,
            rgb = { r: 0, g: 0, b: 0 },
            count = 0;

        if (!context) {
            return defaultRGB;
        }

        height = canvas.height = imgEl.naturalHeight || imgEl.offsetHeight || imgEl.height;
        width = canvas.width = imgEl.naturalWidth || imgEl.offsetWidth || imgEl.width;
        context.drawImage(imgEl, 0, 0);

        try {
            data = context.getImageData(0, 0, width, height);
        } catch (e) {
            /* security error, img on diff domain */alert('x');
            return defaultRGB;
        }

        length = data.data.length;
        while ((i += blockSize * 4) < length) {
            ++count;
            rgb.r += data.data[i];
            rgb.g += data.data[i + 1];
            rgb.b += data.data[i + 2];
        }

        // ~~ used to floor values
        rgb.r = ~~(rgb.r / count);
        rgb.g = ~~(rgb.g / count);
        rgb.b = ~~(rgb.b / count);

        return rgb;

    }

    /**
     * Converts an HSL color value to RGB.
     * @param {number} h Hue value
     * @param {number} s Saturation value
     * @param {number} l Luminance value
     * @return {Array} The RGB representation
     */
    function hslToRgb(h, s, l) {
        const hueToRgb = (p, q, t) => {
            if (t < 0) t += 1;
            if (t > 1) t -= 1;
            if (t < 1 / 6) return p + (q - p) * 6 * t;
            if (t < 1 / 2) return q;
            if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
            return p;
        };

        if (s === 0) {
            return [l, l, l];
        }

        const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        const p = 2 * l - q;
        const r = hueToRgb(p, q, h + 1 / 3);
        const g = hueToRgb(p, q, h);
        const b = hueToRgb(p, q, h - 1 / 3);

        return [r * 255, g * 255, b * 255];
    }

    //this version keeps BG and main text in same hue
    /* function getReadableTextColor(rgb) {
         const [r, g, b] = rgb;

         // Convert RGB to HSL
         const rgbToHsl = (r, g, b) => {
             const max = Math.max(r, g, b);
             const min = Math.min(r, g, b);
             const d = max - min;
             const l = (max + min) / 2;

             if (d === 0) return [0, 0, l];

             const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
             const h = (() => {
                 switch (max) {
                     case r:
                         return (g - b) / d + (g < b ? 6 : 0);
                     case g:
                         return (b - r) / d + 2;
                     case b:
                         return (r - g) / d + 4;
                 }
             })() / 6;

             return [h, s, l];
         };
         const [h, s, l] = rgbToHsl(r / 255, g / 255, b / 255);

         // Calculate appropriate text color based on background color
         const targetLuminance = l > 0.5 ? 0.2 : 0.8;
         const targetSaturation = s > 0.5 ? s - 0.2 : s + 0.2;
         const [rNew, gNew, bNew] = hslToRgb(h, targetSaturation, targetLuminance);

         // Return the text color in RGBA format
         return `rgba(${rNew.toFixed(0)}, ${gNew.toFixed(0)}, ${bNew.toFixed(0)}, 1)`;
     }*/

    //this version makes main text complimentary color to BG color
    function getReadableTextColor(rgb) {
        const [r, g, b] = rgb;

        // Convert RGB to HSL
        const rgbToHsl = (r, g, b) => {
            const max = Math.max(r, g, b);
            const min = Math.min(r, g, b);
            const d = max - min;
            const l = (max + min) / 2;

            if (d === 0) return [0, 0, l];

            const s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
            const h = (() => {
                switch (max) {
                    case r:
                        return (g - b) / d + (g < b ? 6 : 0);
                    case g:
                        return (b - r) / d + 2;
                    case b:
                        return (r - g) / d + 4;
                }
            })() / 6;

            return [h, s, l];
        };
        const [h, s, l] = rgbToHsl(r / 255, g / 255, b / 255);

        // Calculate complementary color based on background color
        const complementaryHue = (h + 0.5) % 1;
        const complementarySaturation = s > 0.5 ? s - 0.6 : s + 0.6;
        const complementaryLuminance = l > 0.5 ? 0.2 : 0.8;

        // Convert complementary color back to RGB
        const [rNew, gNew, bNew] = hslToRgb(complementaryHue, complementarySaturation, complementaryLuminance);

        // Return the text color in RGBA format
        return `rgba(${rNew.toFixed(0)}, ${gNew.toFixed(0)}, ${bNew.toFixed(0)}, 1)`;
    }


}

async function setThemeCallback(_, text) {
    const fuse = new Fuse(themes, {
        keys: [
            { name: 'name', weight: 1 },
        ],
    });

    const results = fuse.search(text);
    console.debug('Theme fuzzy search results for ' + text, results);
    const theme = results[0]?.item;

    if (!theme) {
        toastr.warning(`Could not find theme with name: ${text}`);
        return;
    }

    power_user.theme = theme.name;
    applyTheme(theme.name);
    $('#themes').val(theme.name);
    saveSettingsDebounced();
}

async function setmovingUIPreset(_, text) {
    const fuse = new Fuse(movingUIPresets, {
        keys: [
            { name: 'name', weight: 1 },
        ],
    });

    const results = fuse.search(text);
    console.debug('movingUI preset fuzzy search results for ' + text, results);
    const preset = results[0]?.item;

    if (!preset) {
        toastr.warning(`Could not find preset with name: ${text}`);
        return;
    }

    power_user.movingUIPreset = preset.name;
    applyMovingUIPreset(preset.name);
    $('#movingUIPresets').val(preset.name);
    saveSettingsDebounced();
}

const EPHEMERAL_STOPPING_STRINGS = [];

/**
 * Adds a stopping string to the list of stopping strings that are only used for the next generation.
 * @param {string} value The stopping string to add
 */
export function addEphemeralStoppingString(value) {
    if (!EPHEMERAL_STOPPING_STRINGS.includes(value)) {
        console.debug('Adding ephemeral stopping string:', value);
        EPHEMERAL_STOPPING_STRINGS.push(value);
    }
}

export function flushEphemeralStoppingStrings() {
    if (EPHEMERAL_STOPPING_STRINGS.length === 0) {
        return;
    }

    console.debug('Flushing ephemeral stopping strings:', EPHEMERAL_STOPPING_STRINGS);
    EPHEMERAL_STOPPING_STRINGS.splice(0, EPHEMERAL_STOPPING_STRINGS.length);
}

/**
 * Gets the custom stopping strings from the power user settings.
 * @param {number | undefined} limit Number of strings to return. If 0 or undefined, returns all strings.
 * @returns {string[]} An array of custom stopping strings
 */
export function getCustomStoppingStrings(limit = undefined) {
    function getPermanent() {
        try {
            // If there's no custom stopping strings, return an empty array
            if (!power_user.custom_stopping_strings) {
                return [];
            }

            // Parse the JSON string
            let strings = JSON.parse(power_user.custom_stopping_strings);

            // Make sure it's an array
            if (!Array.isArray(strings)) {
                return [];
            }

            // Make sure all the elements are strings and non-empty.
            strings = strings.filter(s => typeof s === 'string' && s.length > 0);

            // Substitute params if necessary
            if (power_user.custom_stopping_strings_macro) {
                strings = strings.map(x => substituteParams(x));
            }

            return strings;
        } catch (error) {
            // If there's an error, return an empty array
            console.warn('Error parsing custom stopping strings:', error);
            return [];
        }
    }

    const permanent = getPermanent();
    const ephemeral = EPHEMERAL_STOPPING_STRINGS;
    const strings = [...permanent, ...ephemeral];

    // Apply the limit. If limit is 0, return all strings.
    if (limit > 0) {
        return strings.slice(0, limit);
    }

    return strings;
}

$(document).ready(() => {

    $(window).on('resize', async () => {
        if (isMobile()) {
            return;
        }

        //console.log('Window resized!');
        const zoomLevel = Number(window.devicePixelRatio).toFixed(2);
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;
        console.debug(`Zoom: ${zoomLevel}, X:${winWidth}, Y:${winHeight}`);
        if (Object.keys(power_user.movingUIState).length > 0) {
            resetMovablePanels('resize');
        }
        // Adjust layout and styling here
        setHotswapsDebounced();
    });

    // Settings that go to settings.json
    $('#collapse-newlines-checkbox').change(function () {
        power_user.collapse_newlines = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    // include newline is the child of trim sentences
    // if include newline is checked, trim sentences must be checked
    // if trim sentences is unchecked, include newline must be unchecked
    $('#trim_sentences_checkbox').change(function () {
        power_user.trim_sentences = !!$(this).prop('checked');
        if (!$(this).prop('checked')) {
            $('#include_newline_checkbox').prop('checked', false);
            power_user.include_newline = false;
        }
        saveSettingsDebounced();
    });

    $('#include_newline_checkbox').change(function () {
        power_user.include_newline = !!$(this).prop('checked');
        if ($(this).prop('checked')) {
            $('#trim_sentences_checkbox').prop('checked', true);
            power_user.trim_sentences = true;
        }
        saveSettingsDebounced();
    });

    $('#single_line').on('input', function () {
        const value = !!$(this).prop('checked');
        power_user.single_line = value;
        saveSettingsDebounced();
    });

    $('#always-force-name2-checkbox').change(function () {
        power_user.always_force_name2 = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#markdown_escape_strings').on('input', function () {
        power_user.markdown_escape_strings = String($(this).val());
        saveSettingsDebounced();
        reloadMarkdownProcessor(power_user.render_formulas);
    });

    $('#start_reply_with').on('input', function () {
        power_user.user_prompt_bias = String($(this).val());
        saveSettingsDebounced();
    });

    $('#chat-show-reply-prefix-checkbox').change(function () {
        power_user.show_user_prompt_bias = !!$(this).prop('checked');
        reloadCurrentChat();
        saveSettingsDebounced();
    });

    $('#auto_continue_enabled').on('change', function () {
        power_user.auto_continue.enabled = $(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#auto_continue_allow_chat_completions').on('change', function () {
        power_user.auto_continue.allow_chat_completions = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#auto_continue_target_length').on('input', function () {
        power_user.auto_continue.target_length = Number($(this).val());
        saveSettingsDebounced();
    });

    $('#example_messages_behavior').on('change', function () {
        const selectedOption = String($(this).find(':selected').val());
        console.log('Setting example messages behavior to', selectedOption);

        switch (selectedOption) {
            case 'normal':
                power_user.pin_examples = false;
                power_user.strip_examples = false;
                break;
            case 'keep':
                power_user.pin_examples = true;
                power_user.strip_examples = false;
                break;
            case 'strip':
                power_user.pin_examples = false;
                power_user.strip_examples = true;
                break;
        }

        console.debug('power_user.pin_examples', power_user.pin_examples);
        console.debug('power_user.strip_examples', power_user.strip_examples);

        saveSettingsDebounced();
    });

    // Settings that go to local storage
    $('#fast_ui_mode').change(function () {
        power_user.fast_ui_mode = $(this).prop('checked');
        localStorage.setItem(storage_keys.fast_ui_mode, power_user.fast_ui_mode);
        switchUiMode();
        saveSettingsDebounced();
    });

    $('#waifuMode').on('change', () => {
        power_user.waifuMode = $('#waifuMode').prop('checked');
        switchWaifuMode();
        saveSettingsDebounced();
    });

    $('#customCSS').on('change', () => {
        power_user.custom_css = $('#customCSS').val();
        localStorage.setItem(storage_keys.custom_css, power_user.custom_css);
        saveSettingsDebounced();
        applyCustomCSS();
    });

    $('#movingUImode').change(function () {
        power_user.movingUI = $(this).prop('checked');
        localStorage.setItem(storage_keys.movingUI, power_user.movingUI);
        switchMovingUI();
        saveSettingsDebounced();
    });

    $('#noShadowsmode').change(function () {
        power_user.noShadows = $(this).prop('checked');
        localStorage.setItem(storage_keys.noShadows, power_user.noShadows);
        noShadows();
        saveSettingsDebounced();
    });

    $('#movingUIreset').on('click', resetMovablePanels);

    $('#avatar_style').on('change', function () {
        const value = $(this).find(':selected').val();
        power_user.avatar_style = Number(value);
        localStorage.setItem(storage_keys.avatar_style, power_user.avatar_style);
        applyAvatarStyle();
        saveSettingsDebounced();
    });

    $('#chat_display').on('change', function () {
        const value = $(this).find(':selected').val();
        power_user.chat_display = Number(value);
        localStorage.setItem(storage_keys.chat_display, power_user.chat_display);
        applyChatDisplay();
        saveSettingsDebounced();

    });

    $('#chat_width_slider').on('input', function (e) {
        power_user.chat_width = Number(e.target.value);
        localStorage.setItem(storage_keys.chat_width, power_user.chat_width);
        applyChatWidth();
        setHotswapsDebounced();
    });

    $('#chat_truncation').on('input', function () {
        power_user.chat_truncation = Number($('#chat_truncation').val());
        $('#chat_truncation_counter').val(power_user.chat_truncation);
        saveSettingsDebounced();
    });

    $('#streaming_fps').on('input', function () {
        power_user.streaming_fps = Number($('#streaming_fps').val());
        $('#streaming_fps_counter').val(power_user.streaming_fps);
        saveSettingsDebounced();
    });

    $('input[name="font_scale"]').on('input', async function (e) {
        power_user.font_scale = Number(e.target.value);
        $('#font_scale_counter').val(power_user.font_scale);
        localStorage.setItem(storage_keys.font_scale, power_user.font_scale);
        await applyFontScale();
        saveSettingsDebounced();
    });

    $('input[name="blur_strength"]').on('input', async function (e) {
        power_user.blur_strength = Number(e.target.value);
        $('#blur_strength_counter').val(power_user.blur_strength);
        localStorage.setItem(storage_keys.blur_strength, power_user.blur_strength);
        await applyBlurStrength();
        saveSettingsDebounced();
    });

    $('input[name="shadow_width"]').on('input', async function (e) {
        power_user.shadow_width = Number(e.target.value);
        $('#shadow_width_counter').val(power_user.shadow_width);
        localStorage.setItem(storage_keys.shadow_width, power_user.shadow_width);
        await applyShadowWidth();
        saveSettingsDebounced();
    });

    $('#main-text-color-picker').on('change', (evt) => {
        power_user.main_text_color = evt.detail.rgba;
        applyThemeColor('main');
        saveSettingsDebounced();
    });

    $('#italics-color-picker').on('change', (evt) => {
        power_user.italics_text_color = evt.detail.rgba;
        applyThemeColor('italics');
        saveSettingsDebounced();
    });

    $('#quote-color-picker').on('change', (evt) => {
        power_user.quote_text_color = evt.detail.rgba;
        applyThemeColor('quote');
        saveSettingsDebounced();
    });

    $('#blur-tint-color-picker').on('change', (evt) => {
        power_user.blur_tint_color = evt.detail.rgba;
        applyThemeColor('blurTint');
        saveSettingsDebounced();
    });

    $('#chat-tint-color-picker').on('change', (evt) => {
        power_user.chat_tint_color = evt.detail.rgba;
        applyThemeColor('chatTint');
        saveSettingsDebounced();
    });

    $('#user-mes-blur-tint-color-picker').on('change', (evt) => {
        power_user.user_mes_blur_tint_color = evt.detail.rgba;
        applyThemeColor('userMesBlurTint');
        saveSettingsDebounced();
    });

    $('#bot-mes-blur-tint-color-picker').on('change', (evt) => {
        power_user.bot_mes_blur_tint_color = evt.detail.rgba;
        applyThemeColor('botMesBlurTint');
        saveSettingsDebounced();
    });

    $('#shadow-color-picker').on('change', (evt) => {
        power_user.shadow_color = evt.detail.rgba;
        applyThemeColor('shadow');
        saveSettingsDebounced();
    });

    $('#border-color-picker').on('change', (evt) => {
        power_user.border_color = evt.detail.rgba;
        applyThemeColor('border');
        saveSettingsDebounced();
    });

    $('#themes').on('change', function () {
        const themeSelected = String($(this).find(':selected').val());
        power_user.theme = themeSelected;
        applyTheme(themeSelected);
        saveSettingsDebounced();
    });

    $('#movingUIPresets').on('change', async function () {
        console.log('saw MUI preset change');
        const movingUIPresetSelected = String($(this).find(':selected').val());
        power_user.movingUIPreset = movingUIPresetSelected;
        applyMovingUIPreset(movingUIPresetSelected);
        saveSettingsDebounced();
    });

    $('#ui-preset-save-button').on('click', () => saveTheme());
    $('#ui-preset-update-button').on('click', () => updateTheme());
    $('#movingui-preset-save-button').on('click', saveMovingUI);

    $('#never_resize_avatars').on('input', function () {
        power_user.never_resize_avatars = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#show_card_avatar_urls').on('input', function () {
        power_user.show_card_avatar_urls = !!$(this).prop('checked');
        printCharacters();
        saveSettingsDebounced();
    });

    $('#play_message_sound').on('input', function () {
        power_user.play_message_sound = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#play_sound_unfocused').on('input', function () {
        power_user.play_sound_unfocused = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#auto_save_msg_edits').on('input', function () {
        power_user.auto_save_msg_edits = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#character_sort_order').on('change', function () {
        power_user.sort_field = $(this).find(':selected').data('field');
        power_user.sort_order = $(this).find(':selected').data('order');
        power_user.sort_rule = $(this).find(':selected').data('rule');
        printCharacters();
        saveSettingsDebounced();
    });

    $('#gestures-checkbox').on('change', function () {
        power_user.gestures = !!$('#gestures-checkbox').prop('checked');
        saveSettingsDebounced();
    });

    $('#auto_swipe').on('input', function () {
        power_user.auto_swipe = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#auto_swipe_blacklist').on('input', function () {
        power_user.auto_swipe_blacklist = String($(this).val())
            .split(',')
            .map(str => str.trim())
            .filter(str => str);
        console.log('power_user.auto_swipe_blacklist', power_user.auto_swipe_blacklist);
        saveSettingsDebounced();
    });

    $('#auto_swipe_minimum_length').on('input', function () {
        const number = Number($(this).val());
        if (!isNaN(number)) {
            power_user.auto_swipe_minimum_length = number;
            saveSettingsDebounced();
        }
    });

    $('#auto_swipe_blacklist_threshold').on('input', function () {
        const number = Number($(this).val());
        if (!isNaN(number)) {
            power_user.auto_swipe_blacklist_threshold = number;
            saveSettingsDebounced();
        }
    });

    $('#auto_fix_generated_markdown').on('input', function () {
        power_user.auto_fix_generated_markdown = !!$(this).prop('checked');
        reloadCurrentChat();
        saveSettingsDebounced();
    });

    $('#console_log_prompts').on('input', function () {
        power_user.console_log_prompts = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#auto_scroll_chat_to_bottom').on('input', function () {
        power_user.auto_scroll_chat_to_bottom = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#tokenizer').on('change', function () {
        const value = $(this).find(':selected').val();
        power_user.tokenizer = Number(value);
        BIAS_CACHE.clear();
        saveSettingsDebounced();

        // Trigger character editor re-tokenize
        $('#rm_ch_create_block').trigger('input');
        $('#character_popup').trigger('input');
    });

    $('#send_on_enter').on('change', function () {
        const value = $(this).find(':selected').val();
        power_user.send_on_enter = Number(value);
        saveSettingsDebounced();
    });

    $('#import_card_tags').on('input', function () {
        power_user.import_card_tags = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#confirm_message_delete').on('input', function () {
        power_user.confirm_message_delete = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#render_formulas').on('input', function () {
        power_user.render_formulas = !!$(this).prop('checked');
        reloadMarkdownProcessor(power_user.render_formulas);
        reloadCurrentChat();
        saveSettingsDebounced();
    });

    $('#reload_chat').on('click', async function () {
        const currentChatId = getCurrentChatId();
        if (currentChatId !== undefined && currentChatId !== null) {
            await saveSettings();
            await saveChatConditional();
            await reloadCurrentChat();
        }
    });

    $('#allow_name1_display').on('input', function () {
        power_user.allow_name1_display = !!$(this).prop('checked');
        reloadCurrentChat();
        saveSettingsDebounced();
    });

    $('#allow_name2_display').on('input', function () {
        power_user.allow_name2_display = !!$(this).prop('checked');
        reloadCurrentChat();
        saveSettingsDebounced();
    });

    $('#token_padding').on('input', function () {
        power_user.token_padding = Number($(this).val());
        saveSettingsDebounced();
    });

    $('#messageTimerEnabled').on('input', function () {
        const value = !!$(this).prop('checked');
        power_user.timer_enabled = value;
        localStorage.setItem(storage_keys.timer_enabled, Boolean(power_user.timer_enabled));
        switchTimer();
    });

    $('#messageTimestampsEnabled').on('input', function () {
        const value = !!$(this).prop('checked');
        power_user.timestamps_enabled = value;
        localStorage.setItem(storage_keys.timestamps_enabled, Boolean(power_user.timestamps_enabled));
        switchTimestamps();
    });

    $('#messageModelIconEnabled').on('input', function () {
        const value = !!$(this).prop('checked');
        power_user.timestamp_model_icon = value;
        localStorage.setItem(storage_keys.timestamp_model_icon, Boolean(power_user.timestamp_model_icon));
        switchIcons();
    });

    $('#messageTokensEnabled').on('input', function () {
        const value = !!$(this).prop('checked');
        power_user.message_token_count_enabled = value;
        localStorage.setItem(storage_keys.message_token_count_enabled, Boolean(power_user.message_token_count_enabled));
        switchTokenCount();
    });

    $('#expandMessageActions').on('input', function () {
        const value = !!$(this).prop('checked');
        power_user.expand_message_actions = value;
        localStorage.setItem(storage_keys.expand_message_actions, Boolean(power_user.expand_message_actions));
        switchMessageActions();
    });

    $('#enableZenSliders').on('input', function () {
        const value = !!$(this).prop('checked');
        if (power_user.enableLabMode === true && value === true) {
            //disallow zenSliders while Lab Mode is active
            toastr.warning('Disable Mad Lab Mode before enabling Zen Sliders');
            $(this).prop('checked', false).trigger('input');
            return;
        }
        power_user.enableZenSliders = value;
        localStorage.setItem(storage_keys.enableZenSliders, Boolean(power_user.enableZenSliders));
        saveSettingsDebounced();
        switchZenSliders();
    });

    $('#enableLabMode').on('input', function () {
        const value = !!$(this).prop('checked');
        if (power_user.enableZenSliders === true && value === true) {
            //disallow Lab Mode if ZenSliders are active
            toastr.warning('Disable Zen Sliders before enabling Mad Lab Mode');
            $(this).prop('checked', false).trigger('input');
            return;
        }

        power_user.enableLabMode = value;
        localStorage.setItem(storage_keys.enableLabMode, Boolean(power_user.enableLabMode));
        saveSettingsDebounced();
        switchLabMode();
    });

    $('#mesIDDisplayEnabled').on('input', function () {
        const value = !!$(this).prop('checked');
        power_user.mesIDDisplay_enabled = value;
        localStorage.setItem(storage_keys.mesIDDisplay_enabled, Boolean(power_user.mesIDDisplay_enabled));
        switchMesIDDisplay();
    });

    $('#hotswapEnabled').on('input', function () {
        const value = !!$(this).prop('checked');
        power_user.hotswap_enabled = value;
        localStorage.setItem(storage_keys.hotswap_enabled, Boolean(power_user.hotswap_enabled));
        switchHotswap();
    });

    $('#prefer_character_prompt').on('input', function () {
        const value = !!$(this).prop('checked');
        power_user.prefer_character_prompt = value;
        saveSettingsDebounced();
    });

    $('#prefer_character_jailbreak').on('input', function () {
        const value = !!$(this).prop('checked');
        power_user.prefer_character_jailbreak = value;
        saveSettingsDebounced();
    });

    $('#continue_on_send').on('input', function () {
        const value = !!$(this).prop('checked');
        power_user.continue_on_send = value;
        saveSettingsDebounced();
    });

    $('#quick_continue').on('input', function () {
        const value = !!$(this).prop('checked');
        power_user.quick_continue = value;
        $('#mes_continue').css('display', value ? '' : 'none');
        saveSettingsDebounced();
    });

    $('#trim_spaces').on('input', function () {
        const value = !!$(this).prop('checked');
        power_user.trim_spaces = value;
        saveSettingsDebounced();
    });

    $('#relaxed_api_urls').on('input', function () {
        const value = !!$(this).prop('checked');
        power_user.relaxed_api_urls = value;
        saveSettingsDebounced();
    });

    $('#world_import_dialog').on('input', function () {
        const value = !!$(this).prop('checked');
        power_user.world_import_dialog = value;
        saveSettingsDebounced();
    });

    $('#spoiler_free_mode').on('input', function () {
        power_user.spoiler_free_mode = !!$(this).prop('checked');
        switchSpoilerMode();
        saveSettingsDebounced();
    });

    $('#spoiler_free_desc_button').on('click', function () {
        peekSpoilerMode();
        $(this).toggleClass('fa-eye fa-eye-slash');
    });

    $('#custom_stopping_strings').on('input', function () {
        power_user.custom_stopping_strings = String($(this).val());
        saveSettingsDebounced();
    });

    $('#custom_stopping_strings_macro').change(function () {
        power_user.custom_stopping_strings_macro = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#fuzzy_search_checkbox').on('input', function () {
        power_user.fuzzy_search = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#persona_show_notifications').on('input', function () {
        power_user.persona_show_notifications = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#encode_tags').on('input', async function () {
        power_user.encode_tags = !!$(this).prop('checked');
        await reloadCurrentChat();
        saveSettingsDebounced();
    });

    $('#disable_group_trimming').on('input', function () {
        power_user.disable_group_trimming = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#debug_menu').on('click', function () {
        showDebugMenu();
    });

    $('#ui_mode_select').on('change', function () {
        const value = $(this).find(':selected').val();
        power_user.ui_mode = Number(value);
        saveSettingsDebounced();
        switchSimpleMode();
    });

    $('#bogus_folders').on('input', function () {
        const value = !!$(this).prop('checked');
        power_user.bogus_folders = value;
        saveSettingsDebounced();
        printCharacters(true);
    });

    $('#aux_field').on('change', function () {
        const value = $(this).find(':selected').val();
        power_user.aux_field = String(value);
        saveSettingsDebounced();
        printCharacters(false);
    });

    $('#restore_user_input').on('input', function () {
        power_user.restore_user_input = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#reduced_motion').on('input', function () {
        power_user.reduced_motion = !!$(this).prop('checked');
        localStorage.setItem(storage_keys.reduced_motion, String(power_user.reduced_motion));
        switchReducedMotion();
        saveSettingsDebounced();
    });

    $('#compact_input_area').on('input', function () {
        power_user.compact_input_area = !!$(this).prop('checked');
        localStorage.setItem(storage_keys.compact_input_area, String(power_user.compact_input_area));
        switchCompactInputArea();
        saveSettingsDebounced();
    });

    $('#auto-connect-checkbox').on('input', function () {
        power_user.auto_connect = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#auto-load-chat-checkbox').on('input', function () {
        power_user.auto_load_chat = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $(document).on('click', '#debug_table [data-debug-function]', function () {
        const functionId = $(this).data('debug-function');
        const functionRecord = debug_functions.find(f => f.functionId === functionId);

        if (functionRecord) {
            functionRecord.func();
        } else {
            console.warn(`Debug function ${functionId} not found`);
        }
    });

    $(window).on('focus', function () {
        browser_has_focus = true;
    });

    $(window).on('blur', function () {
        browser_has_focus = false;
    });

    registerSlashCommand('vn', toggleWaifu, [], '– swaps Visual Novel Mode On/Off', false, true);
    registerSlashCommand('newchat', doNewChat, [], '– start a new chat with current character', true, true);
    registerSlashCommand('random', doRandomChat, [], '– start a new chat with a random character', true, true);
    registerSlashCommand('delmode', doDelMode, ['del'], '<span class="monospace">(optional number)</span> – enter message deletion mode, and auto-deletes last N messages if numeric argument is provided', true, true);
    registerSlashCommand('cut', doMesCut, [], '<span class="monospace">(number or range)</span> – cuts the specified message or continuous chunk from the chat, e.g. <tt>/cut 0-10</tt>. Ranges are inclusive!', true, true);
    registerSlashCommand('resetpanels', doResetPanels, ['resetui'], '– resets UI panels to original state.', true, true);
    registerSlashCommand('bgcol', setAvgBG, [], '– WIP test of auto-bg avg coloring', true, true);
    registerSlashCommand('theme', setThemeCallback, [], '<span class="monospace">(name)</span> – sets a UI theme by name', true, true);
    registerSlashCommand('movingui', setmovingUIPreset, [], '<span class="monospace">(name)</span> – activates a movingUI preset by name', true, true);
});
