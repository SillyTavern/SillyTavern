import {
    saveSettingsDebounced,
    scrollChatToBottom,
    characters,
    reloadMarkdownProcessor,
    reloadCurrentChat,
    getRequestHeaders,
    substituteParams,
    eventSource,
    event_types,
    getCurrentChatId,
    printCharactersDebounced,
    setCharacterId,
    setEditedMessageId,
    chat,
    getFirstDisplayedMessageId,
    showMoreMessages,
    saveSettings,
    saveChatConditional,
    setAnimationDuration,
    ANIMATION_DURATION_DEFAULT,
    setActiveGroup,
    setActiveCharacter,
    entitiesFilter,
    doNewChat,
} from '../script.js';
import { isMobile, initMovingUI, favsToHotswap } from './RossAscends-mods.js';
import {
    groups,
    resetSelectedGroup,
} from './group-chats.js';
import {
    instruct_presets,
    loadInstructMode,
    names_behavior_types,
    selectInstructPreset,
} from './instruct-mode.js';

import { getTagsList, tag_import_setting, tag_map, tags } from './tags.js';
import { tokenizers } from './tokenizers.js';
import { BIAS_CACHE } from './logit-bias.js';
import { renderTemplateAsync } from './templates.js';

import { countOccurrences, debounce, delay, download, getFileText, getStringHash, isOdd, isTrueBoolean, onlyUnique, resetScrollHeight, shuffle, sortMoments, stringToRange, timestampToMoment } from './utils.js';
import { FILTER_TYPES } from './filters.js';
import { PARSER_FLAG, SlashCommandParser } from './slash-commands/SlashCommandParser.js';
import { SlashCommand } from './slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from './slash-commands/SlashCommandArgument.js';
import { AUTOCOMPLETE_SELECT_KEY, AUTOCOMPLETE_WIDTH } from './autocomplete/AutoComplete.js';
import { SlashCommandEnumValue, enumTypes } from './slash-commands/SlashCommandEnumValue.js';
import { commonEnumProviders, enumIcons } from './slash-commands/SlashCommandCommonEnumsProvider.js';
import { POPUP_TYPE, callGenericPopup } from './popup.js';
import { loadSystemPrompts } from './sysprompt.js';

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
    applyPowerUserSettings,
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
    AT_DEPTH: 4,
    NONE: 9,
};

let power_user = {
    charListGrid: false,
    tokenizer: tokenizers.BEST_MATCH,
    token_padding: 64,
    collapse_newlines: false,
    pin_examples: false,
    strip_examples: false,
    trim_sentences: false,
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
    smooth_streaming: false,
    smooth_streaming_speed: 50,

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
    underline_text_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeUnderlineColor').trim()}`,
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
    request_token_probabilities: false,
    show_group_chat_queue: false,
    render_formulas: false,
    allow_name1_display: false,
    allow_name2_display: false,
    hotswap_enabled: true,
    timer_enabled: true,
    timestamps_enabled: true,
    timestamp_model_icon: false,
    mesIDDisplay_enabled: false,
    hideChatAvatars_enabled: false,
    max_context_unlocked: false,
    message_token_count_enabled: false,
    expand_message_actions: false,
    enableZenSliders: false,
    enableLabMode: false,
    prefer_character_prompt: true,
    prefer_character_jailbreak: true,
    quick_continue: false,
    quick_impersonate: false,
    continue_on_send: false,
    trim_spaces: true,
    relaxed_api_urls: false,
    world_import_dialog: true,
    enable_auto_select_input: false,
    enable_md_hotkeys: false,
    tag_import_setting: tag_import_setting.ASK,
    disable_group_trimming: false,
    single_line: false,

    instruct: {
        enabled: false,
        preset: 'Alpaca',
        input_sequence: '### Instruction:',
        input_suffix: '',
        output_sequence: '### Response:',
        output_suffix: '',
        system_sequence: '',
        system_suffix: '',
        last_system_sequence: '',
        first_output_sequence: '',
        last_output_sequence: '',
        system_sequence_prefix: '',
        system_sequence_suffix: '',
        stop_sequence: '',
        wrap: true,
        macro: true,
        names_behavior: names_behavior_types.FORCE,
        activation_regex: '',
        bind_to_context: false,
        user_alignment_message: '',
        system_same_as_user: false,
        /** @deprecated Use output_suffix instead */
        separator_sequence: '',
    },

    context: {
        preset: 'Default',
        story_string: defaultStoryString,
        chat_start: defaultChatStart,
        example_separator: defaultExampleSeparator,
        use_stop_strings: true,
        allow_jailbreak: false,
        names_as_stop_strings: true,
    },

    sysprompt: {
        enabled: true,
        name: 'Neutral - Chat',
        content: 'Write {{char}}\'s next reply in a fictional chat between {{char}} and {{user}}.',
    },

    personas: {},
    default_persona: null,
    persona_descriptions: {},

    persona_description: '',
    persona_description_position: persona_description_positions.IN_PROMPT,
    persona_description_role: 0,
    persona_description_depth: 2,
    persona_show_notifications: true,
    persona_sort_order: 'asc',

    custom_stopping_strings: '',
    custom_stopping_strings_macro: true,
    fuzzy_search: false,
    encode_tags: false,
    servers: [],
    bogus_folders: false,
    zoomed_avatar_magnification: false,
    show_tag_filters: false,
    aux_field: 'character_version',
    stscript: {
        matching: 'fuzzy',
        autocomplete: {
            autoHide: false,
            style: 'theme',
            font: {
                scale: 0.8,
            },
            width: {
                left: AUTOCOMPLETE_WIDTH.CHAT,
                right: AUTOCOMPLETE_WIDTH.CHAT,
            },
            select: AUTOCOMPLETE_SELECT_KEY.TAB + AUTOCOMPLETE_SELECT_KEY.ENTER,
        },
        parser: {
            /**@type {Object.<PARSER_FLAG,boolean>} */
            flags: {},
        },
    },
    restore_user_input: true,
    reduced_motion: false,
    compact_input_area: true,
    auto_connect: false,
    auto_load_chat: false,
    forbid_external_media: true,
    external_media_allowed_overrides: [],
    external_media_forbidden_overrides: [],
};

let themes = [];
let movingUIPresets = [];
export let context_presets = [];

const storage_keys = {
    auto_connect_legacy: 'AutoConnectEnabled',
    auto_load_chat_legacy: 'AutoLoadChatEnabled',

    storyStringValidationCache: 'StoryStringValidationCache',
};

const contextControls = [
    // Power user context scoped settings
    { id: 'context_story_string', property: 'story_string', isCheckbox: false, isGlobalSetting: false },
    { id: 'context_example_separator', property: 'example_separator', isCheckbox: false, isGlobalSetting: false },
    { id: 'context_chat_start', property: 'chat_start', isCheckbox: false, isGlobalSetting: false },
    { id: 'context_use_stop_strings', property: 'use_stop_strings', isCheckbox: true, isGlobalSetting: false, defaultValue: false },
    { id: 'context_allow_jailbreak', property: 'allow_jailbreak', isCheckbox: true, isGlobalSetting: false, defaultValue: false },
    { id: 'context_names_as_stop_strings', property: 'names_as_stop_strings', isCheckbox: true, isGlobalSetting: false, defaultValue: true },

    // Existing power user settings
    { id: 'always-force-name2-checkbox', property: 'always_force_name2', isCheckbox: true, isGlobalSetting: true, defaultValue: true },
    { id: 'trim_sentences_checkbox', property: 'trim_sentences', isCheckbox: true, isGlobalSetting: true, defaultValue: false },
    { id: 'single_line', property: 'single_line', isCheckbox: true, isGlobalSetting: true, defaultValue: false },
];

let browser_has_focus = true;
const debug_functions = [];

const setHotswapsDebounced = debounce(favsToHotswap);

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
    $('body').toggleClass('no-hotswap', !power_user.hotswap_enabled);
    $('#hotswapEnabled').prop('checked', power_user.hotswap_enabled);
}

function switchTimer() {
    $('body').toggleClass('no-timer', !power_user.timer_enabled);
    $('#messageTimerEnabled').prop('checked', power_user.timer_enabled);
}

function switchTimestamps() {
    $('body').toggleClass('no-timestamps', !power_user.timestamps_enabled);
    $('#messageTimestampsEnabled').prop('checked', power_user.timestamps_enabled);
}

function switchIcons() {
    $('body').toggleClass('no-modelIcons', !power_user.timestamp_model_icon);
    $('#messageModelIconEnabled').prop('checked', power_user.timestamp_model_icon);
}

function switchTokenCount() {
    $('body').toggleClass('no-tokenCount', !power_user.message_token_count_enabled);
    $('#messageTokensEnabled').prop('checked', power_user.message_token_count_enabled);
}

function switchMesIDDisplay() {
    $('body').toggleClass('no-mesIDDisplay', !power_user.mesIDDisplay_enabled);
    $('#mesIDDisplayEnabled').prop('checked', power_user.mesIDDisplay_enabled);
}

function switchHideChatAvatars() {
    $('body').toggleClass('hideChatAvatars', power_user.hideChatAvatars_enabled);
    $('#hideChatAvatarsEnabled').prop('checked', power_user.hideChatAvatars_enabled);
}

function switchMessageActions() {
    $('body').toggleClass('expandMessageActions', power_user.expand_message_actions);
    $('#expandMessageActions').prop('checked', power_user.expand_message_actions);
    $('.extraMesButtons, .extraMesButtonsHint').removeAttr('style');
}

function switchReducedMotion() {
    jQuery.fx.off = power_user.reduced_motion;
    const overrideDuration = power_user.reduced_motion ? 0 : ANIMATION_DURATION_DEFAULT;
    setAnimationDuration(overrideDuration);
    $('#reduced_motion').prop('checked', power_user.reduced_motion);
    $('body').toggleClass('reduced-motion', power_user.reduced_motion);
}

function switchCompactInputArea() {
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

        $('#amount_gen').attr('min', '1')
            .attr('max', '99999')
            .attr('step', '1');


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

        $('#amount_gen').attr('min', '16')
            .attr('max', '2048')
            .attr('step', '1');
    }
}

async function switchZenSliders() {
    await delay(100);
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
        sliderID == 'rep_pen_range' ||
        sliderID == 'dry_allowed_length_textgenerationwebui' ||
        sliderID == 'rep_pen_decay_textgenerationwebui' ||
        sliderID == 'dry_penalty_last_n_textgenerationwebui' ||
        sliderID == 'max_tokens_second_textgenerationwebui') {
        decimals = 0;
    }
    if (sliderID == 'min_temp_textgenerationwebui' ||
        sliderID == 'max_temp_textgenerationwebui' ||
        sliderID == 'dynatemp_exponent_textgenerationwebui' ||
        sliderID == 'smoothing_curve_textgenerationwebui' ||
        sliderID == 'smoothing_factor_textgenerationwebui' ||
        sliderID == 'dry_multiplier_textgenerationwebui' ||
        sliderID == 'dry_base_textgenerationwebui') {
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
        sliderID == 'smoothing_factor_textgenerationwebui' ||
        sliderID == 'smoothing_curve_textgenerationwebui' ||
        sliderID == 'skew_textgenerationwebui' ||
        sliderID == 'dry_multiplier_textgenerationwebui' ||
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
        sliderID == 'min_temp_textgenerationwebui' ||
        sliderID == 'max_temp_textgenerationwebui' ||
        sliderID == 'dynatemp_exponent_textgenerationwebui' ||
        sliderID == 'guidance_scale_textgenerationwebui' ||
        sliderID == 'rep_pen_slope_textgenerationwebui' ||
        sliderID == 'guidance_scale') {
        offVal = 1;
    }
    if (sliderID == 'guidance_scale_textgenerationwebui') {
        numSteps = 78;
    }
    if (sliderID == 'top_k_textgenerationwebui') {
        sliderMin = 0;
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
                            e.preventDefault();
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
    return '';
}

function switchWaifuMode() {
    $('body').toggleClass('waifuMode', power_user.waifuMode);
    $('#waifuMode').prop('checked', power_user.waifuMode);
    scrollChatToBottom();
}

function switchSpoilerMode() {
    if (power_user.spoiler_free_mode) {
        $('#descriptionWrapper').hide();
        $('#firstMessageWrapper').hide();
        $('#spoiler_free_desc').addClass('flex1');
        $('#creator_notes_spoiler').show();
    }
    else {
        $('#descriptionWrapper').show();
        $('#firstMessageWrapper').show();
        $('#spoiler_free_desc').removeClass('flex1');
        $('#creator_notes_spoiler').hide();
    }
}

function peekSpoilerMode() {
    $('#descriptionWrapper').toggle();
    $('#firstMessageWrapper').toggle();
    $('#creator_notes_spoiler').toggle();
    $('#spoiler_free_desc').toggleClass('flex1');
}


function switchMovingUI() {
    $('.drawer-content.maximized').each(function () {
        $(this).find('.inline-drawer-maximize').trigger('click');
    });
    $('body').toggleClass('movingUI', power_user.movingUI);
    if (power_user.movingUI === true) {
        initMovingUI();
        if (power_user.movingUIState) {
            loadMovingUIState();
        }
    } else {
        if (Object.keys(power_user.movingUIState).length !== 0) {
            power_user.movingUIState = {};
            resetMovablePanels();
            saveSettingsDebounced();
        }
    }
}

function applyNoShadows() {
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
    $('body').toggleClass('big-avatars', power_user.avatar_style === avatar_styles.RECTANGULAR);
    $('body').toggleClass('square-avatars', power_user.avatar_style === avatar_styles.SQUARE);
    $('#avatar_style').val(power_user.avatar_style).prop('selected', true);
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
            console.debug('applying default chat');
            $('body').removeClass('bubblechat');
            $('body').removeClass('documentstyle');
            break;
        }
        case 1: {
            console.debug('applying bubblechat');
            $('body').addClass('bubblechat');
            $('body').removeClass('documentstyle');
            break;
        }
        case 2: {
            console.debug('applying document style');
            $('body').removeClass('bubblechat');
            $('body').addClass('documentstyle');
            break;
        }
    }
}

function applyChatWidth(type) {
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

function applyThemeColor(type) {
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
    if (type === 'underline') {
        document.documentElement.style.setProperty('--SmartThemeUnderlineColor', power_user.underline_text_color);
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

function applyCustomCSS() {
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

function applyBlurStrength() {
    document.documentElement.style.setProperty('--blurStrength', String(power_user.blur_strength));
    $('#blur_strength_counter').val(power_user.blur_strength);
    $('#blur_strength').val(power_user.blur_strength);
}

function applyShadowWidth() {
    document.documentElement.style.setProperty('--shadowWidth', String(power_user.shadow_width));
    $('#shadow_width_counter').val(power_user.shadow_width);
    $('#shadow_width').val(power_user.shadow_width);

}

function applyFontScale(type) {
    //this is to allow forced setting on page load, theme swap, etc
    if (type === 'forced') {
        document.documentElement.style.setProperty('--fontScale', String(power_user.font_scale));
    } else {
        //this is to prevent the slider from updating page in real time
        $('#font_scale').off('mouseup touchend').on('mouseup touchend', () => {
            document.documentElement.style.setProperty('--fontScale', String(power_user.font_scale));
        });
    }

    $('#font_scale_counter').val(power_user.font_scale);
    $('#font_scale').val(power_user.font_scale);
}

function applyTheme(name) {
    const theme = themes.find(x => x.name == name);

    if (!theme) {
        return;
    }

    const themeProperties = [
        { key: 'main_text_color', selector: '#main-text-color-picker', type: 'main' },
        { key: 'italics_text_color', selector: '#italics-color-picker', type: 'italics' },
        { key: 'underline_text_color', selector: '#underline-color-picker', type: 'underline' },
        { key: 'quote_text_color', selector: '#quote-color-picker', type: 'quote' },
        { key: 'blur_tint_color', selector: '#blur-tint-color-picker', type: 'blurTint' },
        { key: 'chat_tint_color', selector: '#chat-tint-color-picker', type: 'chatTint' },
        { key: 'user_mes_blur_tint_color', selector: '#user-mes-blur-tint-color-picker', type: 'userMesBlurTint' },
        { key: 'bot_mes_blur_tint_color', selector: '#bot-mes-blur-tint-color-picker', type: 'botMesBlurTint' },
        { key: 'shadow_color', selector: '#shadow-color-picker', type: 'shadow' },
        { key: 'border_color', selector: '#border-color-picker', type: 'border' },
        {
            key: 'blur_strength',
            action: () => {
                applyBlurStrength();
            },
        },
        {
            key: 'custom_css',
            action: () => {
                applyCustomCSS();
            },
        },
        {
            key: 'shadow_width',
            action: () => {
                applyShadowWidth();
            },
        },
        {
            key: 'font_scale',
            action: () => {
                applyFontScale('forced');
            },
        },
        {
            key: 'fast_ui_mode',
            action: () => {
                switchUiMode();
            },
        },
        {
            key: 'waifuMode',
            action: () => {
                switchWaifuMode();
            },
        },
        {
            key: 'chat_display',
            action: () => {
                applyChatDisplay();
            },
        },
        {
            key: 'avatar_style',
            action: () => {
                applyAvatarStyle();
            },
        },
        {
            key: 'noShadows',
            action: () => {
                applyNoShadows();
            },
        },
        {
            key: 'chat_width',
            action: () => {
                // If chat width is not set, set it to 50
                if (!power_user.chat_width) {
                    power_user.chat_width = 50;
                }
                applyChatWidth('forced');
            },
        },
        {
            key: 'timer_enabled',
            action: () => {
                switchTimer();
            },
        },
        {
            key: 'timestamps_enabled',
            action: () => {
                switchTimestamps();
            },
        },
        {
            key: 'timestamp_model_icon',
            action: () => {
                switchIcons();
            },
        },
        {
            key: 'message_token_count_enabled',
            action: () => {
                switchTokenCount();
            },
        },
        {
            key: 'mesIDDisplay_enabled',
            action: () => {
                switchMesIDDisplay();
            },
        },
        {
            key: 'hideChatAvatars_enabled',
            action: () => {
                switchHideChatAvatars();
            },
        },
        {
            key: 'expand_message_actions',
            action: () => {
                switchMessageActions();
            },
        },
        {
            key: 'enableZenSliders',
            action: () => {
                switchMessageActions();
            },
        },
        {
            key: 'enableLabMode',
            action: () => {
                switchMessageActions();
            },
        },
        {
            key: 'hotswap_enabled',
            action: () => {
                switchHotswap();
            },
        },
        {
            key: 'bogus_folders',
            action: () => {
                $('#bogus_folders').prop('checked', power_user.bogus_folders);
                printCharactersDebounced();
            },
        },
        {
            key: 'zoomed_avatar_magnification',
            action: () => {
                $('#zoomed_avatar_magnification').prop('checked', power_user.zoomed_avatar_magnification);
                printCharactersDebounced();
            },
        },
        {
            key: 'reduced_motion',
            action: () => {
                $('#reduced_motion').prop('checked', power_user.reduced_motion);
                switchReducedMotion();
            },
        },
        {
            key: 'compact_input_area',
            action: () => {
                $('#compact_input_area').prop('checked', power_user.compact_input_area);
                switchCompactInputArea();
            },
        },
    ];

    for (const { key, selector, type, action } of themeProperties) {
        if (theme[key] !== undefined) {
            power_user[key] = theme[key];
            if (selector) $(selector).attr('color', power_user[key]);
            if (type) applyThemeColor(type);
            if (action) action();
        } else {
            if (selector) { $(selector).attr('color', 'rgba(0,0,0,0)'); }
            console.debug(`Empty theme key: ${key}`);
            power_user[key] = '';
        }
    }

    console.log('theme applied: ' + name);
}

async function applyMovingUIPreset(name) {
    await resetMovablePanels('quiet');
    const movingUIPreset = movingUIPresets.find(x => x.name == name);

    if (!movingUIPreset) {
        return;
    }

    power_user.movingUIState = movingUIPreset.movingUIState;


    console.log('MovingUI Preset applied: ' + name);
    loadMovingUIState();
    saveSettingsDebounced();
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

async function showDebugMenu() {
    const template = await renderTemplateAsync('debug', { functions: debug_functions });
    callGenericPopup(template, POPUP_TYPE.TEXT, '', { wide: true, large: true, allowVerticalScrolling: true });
}

function applyPowerUserSettings() {
    switchUiMode();
    applyFontScale('forced');
    applyThemeColor();
    applyChatWidth('forced');
    applyAvatarStyle();
    applyBlurStrength();
    applyShadowWidth();
    applyCustomCSS();
    switchMovingUI();
    applyNoShadows();
    switchHotswap();
    switchTimer();
    switchTimestamps();
    switchIcons();
    switchMesIDDisplay();
    switchHideChatAvatars();
    switchTokenCount();
    switchMessageActions();
}

function getExampleMessagesBehavior() {
    if (power_user.strip_examples) {
        return 'strip';
    }

    if (power_user.pin_examples) {
        return 'keep';
    }

    return 'normal';
}

async function loadPowerUserSettings(settings, data) {
    const defaultStscript = JSON.parse(JSON.stringify(power_user.stscript));
    // Load from settings.json
    if (settings.power_user !== undefined) {
        Object.assign(power_user, settings.power_user);
    }

    if (power_user.stscript === undefined) {
        power_user.stscript = defaultStscript;
    } else {
        if (power_user.stscript.autocomplete === undefined) {
            power_user.stscript.autocomplete = defaultStscript.autocomplete;
        } else {
            if (power_user.stscript.autocomplete.width === undefined) {
                power_user.stscript.autocomplete.width = defaultStscript.autocomplete.width;
            }
            if (power_user.stscript.autocomplete.font === undefined) {
                power_user.stscript.autocomplete.font = defaultStscript.autocomplete.font;
            }
            if (power_user.stscript.autocomplete.style === undefined) {
                power_user.stscript.autocomplete.style = power_user.stscript.autocomplete_style || defaultStscript.autocomplete.style;
            }
            if (power_user.stscript.autocomplete.select === undefined) {
                power_user.stscript.autocomplete.select = defaultStscript.autocomplete.select;
            }
        }
        if (power_user.stscript.parser === undefined) {
            power_user.stscript.parser = defaultStscript.parser;
        } else if (power_user.stscript.parser.flags === undefined) {
            power_user.stscript.parser.flags = defaultStscript.parser.flags;
        }

        // Cleanup old flags
        delete power_user.stscript.autocomplete_style;
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

    // These are still local storage. Delete in 1.12.7
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

    // Clean up old/legacy settings
    if (power_user.import_card_tags !== undefined) {
        power_user.tag_import_setting = power_user.import_card_tags ? tag_import_setting.ASK : tag_import_setting.NONE;
        delete power_user.import_card_tags;
    }

    $('#single_line').prop('checked', power_user.single_line);
    $('#relaxed_api_urls').prop('checked', power_user.relaxed_api_urls);
    $('#world_import_dialog').prop('checked', power_user.world_import_dialog);
    $('#enable_auto_select_input').prop('checked', power_user.enable_auto_select_input);
    $('#enable_md_hotkeys').prop('checked', power_user.enable_md_hotkeys);
    $('#trim_spaces').prop('checked', power_user.trim_spaces);
    $('#continue_on_send').prop('checked', power_user.continue_on_send);
    $('#quick_continue').prop('checked', power_user.quick_continue);
    $('#quick_impersonate').prop('checked', power_user.quick_continue);
    $('#mes_continue').css('display', power_user.quick_continue ? '' : 'none');
    $('#mes_impersonate').css('display', power_user.quick_impersonate ? '' : 'none');
    $('#gestures-checkbox').prop('checked', power_user.gestures);
    $('#auto_swipe').prop('checked', power_user.auto_swipe);
    $('#auto_swipe_minimum_length').val(power_user.auto_swipe_minimum_length);
    $('#auto_swipe_blacklist').val(power_user.auto_swipe_blacklist.join(', '));
    $('#auto_swipe_blacklist_threshold').val(power_user.auto_swipe_blacklist_threshold);
    $('#custom_stopping_strings').text(power_user.custom_stopping_strings);
    $('#custom_stopping_strings_macro').prop('checked', power_user.custom_stopping_strings_macro);
    $('#fuzzy_search_checkbox').prop('checked', power_user.fuzzy_search);
    $('#persona_show_notifications').prop('checked', power_user.persona_show_notifications);
    $('#encode_tags').prop('checked', power_user.encode_tags);
    $('#example_messages_behavior').val(getExampleMessagesBehavior());
    $(`#example_messages_behavior option[value="${getExampleMessagesBehavior()}"]`).prop('selected', true);

    $('#console_log_prompts').prop('checked', power_user.console_log_prompts);
    $('#request_token_probabilities').prop('checked', power_user.request_token_probabilities);
    $('#show_group_chat_queue').prop('checked', power_user.show_group_chat_queue);
    $('#auto_fix_generated_markdown').prop('checked', power_user.auto_fix_generated_markdown);
    $('#auto_scroll_chat_to_bottom').prop('checked', power_user.auto_scroll_chat_to_bottom);
    $('#bogus_folders').prop('checked', power_user.bogus_folders);
    $('#zoomed_avatar_magnification').prop('checked', power_user.zoomed_avatar_magnification);
    $(`#tokenizer option[value="${power_user.tokenizer}"]`).attr('selected', true);
    $(`#send_on_enter option[value=${power_user.send_on_enter}]`).attr('selected', true);
    $('#confirm_message_delete').prop('checked', power_user.confirm_message_delete !== undefined ? !!power_user.confirm_message_delete : true);
    $('#spoiler_free_mode').prop('checked', power_user.spoiler_free_mode);
    $('#collapse-newlines-checkbox').prop('checked', power_user.collapse_newlines);
    $('#always-force-name2-checkbox').prop('checked', power_user.always_force_name2);
    $('#trim_sentences_checkbox').prop('checked', power_user.trim_sentences);
    $('#render_formulas').prop('checked', power_user.render_formulas);
    $('#disable_group_trimming').prop('checked', power_user.disable_group_trimming);
    $('#markdown_escape_strings').val(power_user.markdown_escape_strings);
    $('#fast_ui_mode').prop('checked', power_user.fast_ui_mode);
    $('#waifuMode').prop('checked', power_user.waifuMode);
    $('#movingUImode').prop('checked', power_user.movingUI);
    $('#noShadowsmode').prop('checked', power_user.noShadows);
    $('#start_reply_with').text(power_user.user_prompt_bias);
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
    $('#hideChatAvatarsEnabled').prop('checked', power_user.hideChatAvatars_enabled);
    $('#prefer_character_prompt').prop('checked', power_user.prefer_character_prompt);
    $('#prefer_character_jailbreak').prop('checked', power_user.prefer_character_jailbreak);
    $('#enableZenSliders').prop('checked', power_user.enableZenSliders).trigger('input');
    $('#enableLabMode').prop('checked', power_user.enableLabMode).trigger('input');
    $(`input[name="avatar_style"][value="${power_user.avatar_style}"]`).prop('checked', true);
    $(`#chat_display option[value=${power_user.chat_display}]`).attr('selected', true).trigger('change');
    $('#chat_width_slider').val(power_user.chat_width);
    $('#token_padding').val(power_user.token_padding);
    $('#aux_field').val(power_user.aux_field);
    $('#tag_import_setting').val(power_user.tag_import_setting);

    $('#stscript_autocomplete_autoHide').prop('checked', power_user.stscript.autocomplete.autoHide ?? false).trigger('input');
    $('#stscript_matching').val(power_user.stscript.matching ?? 'fuzzy');
    $('#stscript_autocomplete_style').val(power_user.stscript.autocomplete.style ?? 'theme');
    document.body.setAttribute('data-stscript-style', power_user.stscript.autocomplete.style);
    $('#stscript_autocomplete_select').val(power_user.stscript.autocomplete.select ?? (AUTOCOMPLETE_SELECT_KEY.TAB + AUTOCOMPLETE_SELECT_KEY.ENTER));
    $('#stscript_parser_flag_strict_escaping').prop('checked', power_user.stscript.parser.flags[PARSER_FLAG.STRICT_ESCAPING] ?? false);
    $('#stscript_parser_flag_replace_getvar').prop('checked', power_user.stscript.parser.flags[PARSER_FLAG.REPLACE_GETVAR] ?? false);
    $('#stscript_autocomplete_font_scale').val(power_user.stscript.autocomplete.font.scale ?? defaultStscript.autocomplete.font.scale);
    $('#stscript_autocomplete_font_scale_counter').val(power_user.stscript.autocomplete.font.scale ?? defaultStscript.autocomplete.font.scale);
    document.body.style.setProperty('--ac-font-scale', power_user.stscript.autocomplete.font.scale ?? defaultStscript.autocomplete.font.scale.toString());
    $('#stscript_autocomplete_width_left').val(power_user.stscript.autocomplete.width.left ?? AUTOCOMPLETE_WIDTH.CHAT);
    document.querySelector('#stscript_autocomplete_width_left').dispatchEvent(new Event('input', { bubbles: true }));
    $('#stscript_autocomplete_width_right').val(power_user.stscript.autocomplete.width.right ?? AUTOCOMPLETE_WIDTH.CHAT);
    document.querySelector('#stscript_autocomplete_width_right').dispatchEvent(new Event('input', { bubbles: true }));

    $('#restore_user_input').prop('checked', power_user.restore_user_input);

    $('#chat_truncation').val(power_user.chat_truncation);
    $('#chat_truncation_counter').val(power_user.chat_truncation);

    $('#streaming_fps').val(power_user.streaming_fps);
    $('#streaming_fps_counter').val(power_user.streaming_fps);

    $('#smooth_streaming').prop('checked', power_user.smooth_streaming);
    $('#smooth_streaming_speed').val(power_user.smooth_streaming_speed);

    $('#font_scale').val(power_user.font_scale);
    $('#font_scale_counter').val(power_user.font_scale);

    $('#blur_strength').val(power_user.blur_strength);
    $('#blur_strength_counter').val(power_user.blur_strength);

    $('#shadow_width').val(power_user.shadow_width);
    $('#shadow_width_counter').val(power_user.shadow_width);

    $('#main-text-color-picker').attr('color', power_user.main_text_color);
    $('#italics-color-picker').attr('color', power_user.italics_text_color);
    $('#underline-color-picker').attr('color', power_user.underline_text_color);
    $('#quote-color-picker').attr('color', power_user.quote_text_color);
    $('#blur-tint-color-picker').attr('color', power_user.blur_tint_color);
    $('#chat-tint-color-picker').attr('color', power_user.chat_tint_color);
    $('#user-mes-blur-tint-color-picker').attr('color', power_user.user_mes_blur_tint_color);
    $('#bot-mes-blur-tint-color-picker').attr('color', power_user.bot_mes_blur_tint_color);
    $('#shadow-color-picker').attr('color', power_user.shadow_color);
    $('#border-color-picker').attr('color', power_user.border_color);
    $('#reduced_motion').prop('checked', power_user.reduced_motion);
    $('#auto-connect-checkbox').prop('checked', power_user.auto_connect);
    $('#auto-load-chat-checkbox').prop('checked', power_user.auto_load_chat);
    $('#forbid_external_media').prop('checked', power_user.forbid_external_media);

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
    await loadInstructMode(data);
    await loadContextSettings();
    await loadSystemPrompts(data);
    loadMaxContextUnlocked();
    switchWaifuMode();
    switchSpoilerMode();
    loadMovingUIState();
    loadCharListState();
    toggleMDHotkeyIconDisplay();
}

function toggleMDHotkeyIconDisplay() {
    if (power_user.enable_md_hotkeys) {
        $('.mdhotkey_location').each(function () {
            $(this).parent().append('<i class="fa-brands fa-markdown mdhotkey_icon"></i>');
        });
    } else {
        $('.mdhotkey_icon').remove();
    }
}

function loadCharListState() {
    document.body.classList.toggle('charListGrid', power_user.charListGrid);
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
    const elements = [
        $('#max_context'),
        $('#max_context_counter'),
        $('#rep_pen_range'),
        $('#rep_pen_range_counter'),
        $('#rep_pen_range_textgenerationwebui'),
        $('#rep_pen_range_counter_textgenerationwebui'),
        $('#dry_penalty_last_n_textgenerationwebui'),
        $('#dry_penalty_last_n_counter_textgenerationwebui'),
        $('#rep_pen_decay_textgenerationwebui'),
        $('#rep_pen_decay_counter_textgenerationwebui'),
    ];
    const maxValue = power_user.max_context_unlocked ? MAX_CONTEXT_UNLOCKED : MAX_CONTEXT_DEFAULT;
    const minValue = power_user.max_context_unlocked ? maxContextMin : maxContextMin;
    const steps = power_user.max_context_unlocked ? unlockedMaxContextStep : maxContextStep;
    $('#rep_pen_range_textgenerationwebui_zenslider').remove(); //unsure why, but this is necessary.
    $('#dry_penalty_last_n_textgenerationwebui_zenslider').remove();
    $('#rep_pen_decay_textgenerationwebui_zenslider').remove();
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
        $('#dry_penalty_last_n_textgenerationwebui_zenslider').remove();
        CreateZenSliders($('#dry_penalty_last_n_textgenerationwebui'));
        $('#rep_pen_decay_textgenerationwebui_zenslider').remove();
        CreateZenSliders($('#rep_pen_decay_textgenerationwebui'));
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
async function loadContextSettings() {
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
        console.log(`Setting ${$element.prop('id')} to ${power_user.context[control.property]}`);

        // If the setting already exists, no need to duplicate it
        // TODO: Maybe check the power_user object for the setting instead of a flag?
        $element.on('input', async function () {
            const value = control.isCheckbox ? !!$(this).prop('checked') : $(this).val();
            if (control.isGlobalSetting) {
                power_user[control.property] = value;
            } else {
                power_user.context[control.property] = value;
            }
            console.log(`Setting ${$element.prop('id')} to ${value}`);
            if (!CSS.supports('field-sizing', 'content') && $(this).is('textarea')) {
                await resetScrollHeight($(this));
            }
            saveSettingsDebounced();
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
        const name = String($(this).find(':selected').text());
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
                    $element.val(control.isGlobalSetting ? power_user[control.property] : power_user.context[control.property]);
                    $element.trigger('input');
                }
            }
        });

        if (power_user.instruct.bind_to_context) {
            // Select matching instruct preset
            for (const instruct_preset of instruct_presets) {
                // If instruct preset matches the context template
                if (instruct_preset.name === name) {
                    selectInstructPreset(instruct_preset.name, { isAuto: true });
                    break;
                }
            }
        }

        saveSettingsDebounced();
    });
}

/**
 * Fuzzy search characters by a search term
 * @param {string} searchValue - The search term
 * @returns {FuseResult[]} Results as items with their score
 */
export function fuzzySearchCharacters(searchValue) {
    // @ts-ignore
    const fuse = new Fuse(characters, {
        keys: [
            { name: 'data.name', weight: 20 },
            { name: '#tags', weight: 10, getFn: (character) => getTagsList(character.avatar).map(x => x.name).join('||') },
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
        useExtendedSearch: true,
        threshold: 0.2,
    });

    const results = fuse.search(searchValue);
    console.debug('Characters fuzzy search results for ' + searchValue, results);
    return results;
}

/**
 * Fuzzy search world info entries by a search term
 * @param {*[]} data - WI items data array
 * @param {string} searchValue - The search term
 * @returns {FuseResult[]} Results as items with their score
 */
export function fuzzySearchWorldInfo(data, searchValue) {
    // @ts-ignore
    const fuse = new Fuse(data, {
        keys: [
            { name: 'key', weight: 20 },
            { name: 'group', weight: 15 },
            { name: 'comment', weight: 10 },
            { name: 'keysecondary', weight: 10 },
            { name: 'content', weight: 3 },
            { name: 'uid', weight: 1 },
            { name: 'automationId', weight: 1 },
        ],
        includeScore: true,
        ignoreLocation: true,
        useExtendedSearch: true,
        threshold: 0.2,
    });

    const results = fuse.search(searchValue);
    console.debug('World Info fuzzy search results for ' + searchValue, results);
    return results;
}

/**
 * Fuzzy search persona entries by a search term
 * @param {*[]} data - persona data array
 * @param {string} searchValue - The search term
 * @returns {FuseResult[]} Results as items with their score
 */
export function fuzzySearchPersonas(data, searchValue) {
    data = data.map(x => ({ key: x, name: power_user.personas[x] ?? '', description: power_user.persona_descriptions[x]?.description ?? '' }));
    // @ts-ignore
    const fuse = new Fuse(data, {
        keys: [
            { name: 'name', weight: 20 },
            { name: 'description', weight: 3 },
        ],
        includeScore: true,
        ignoreLocation: true,
        useExtendedSearch: true,
        threshold: 0.2,
    });

    const results = fuse.search(searchValue);
    console.debug('Personas fuzzy search results for ' + searchValue, results);
    return results;
}

/**
 * Fuzzy search tags by a search term
 * @param {string} searchValue - The search term
 * @returns {FuseResult[]} Results as items with their score
 */
export function fuzzySearchTags(searchValue) {
    // @ts-ignore
    const fuse = new Fuse(tags, {
        keys: [
            { name: 'name', weight: 1 },
        ],
        includeScore: true,
        ignoreLocation: true,
        useExtendedSearch: true,
        threshold: 0.2,
    });

    const results = fuse.search(searchValue);
    console.debug('Tags fuzzy search results for ' + searchValue, results);
    return results;
}

/**
 * Fuzzy search groups by a search term
 * @param {string} searchValue - The search term
 * @returns {FuseResult[]} Results as items with their score
 */
export function fuzzySearchGroups(searchValue) {
    // @ts-ignore
    const fuse = new Fuse(groups, {
        keys: [
            { name: 'name', weight: 20 },
            { name: 'members', weight: 15 },
            { name: '#tags', weight: 10, getFn: (group) => getTagsList(group.id).map(x => x.name).join('||') },
            { name: 'id', weight: 1 },
        ],
        includeScore: true,
        ignoreLocation: true,
        useExtendedSearch: true,
        threshold: 0.2,
    });

    const results = fuse.search(searchValue);
    console.debug('Groups fuzzy search results for ' + searchValue, results);
    return results;
}

/**
 * Renders a story string template with the given parameters.
 * @param {object} params Template parameters.
 * @returns {string} The rendered story string.
 */
export function renderStoryString(params) {
    try {
        // Validate and log possible warnings/errors
        validateStoryString(power_user.context.story_string, params);

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
            if (!power_user.instruct.enabled || power_user.instruct.wrap) {
                output += '\n';
            }
        }

        return output;
    } catch (e) {
        toastr.error('Check the story string template for validity', 'Error rendering story string');
        console.error('Error rendering story string', e);
        throw e; // rethrow the error
    }
}

/**
 * Validate the story string for possible warnings or issues
 *
 * @param {string} storyString - The story string
 * @param {Object} params - The story string parameters
 */
function validateStoryString(storyString, params) {
    /** @type {{hashCache: {[hash: string]: {fieldsWarned: {[key: string]: boolean}}}}} */
    const cache = JSON.parse(localStorage.getItem(storage_keys.storyStringValidationCache)) ?? { hashCache: {} };

    const hash = getStringHash(storyString);

    // Initialize the cache for the current hash if it doesn't exist
    if (!cache.hashCache[hash]) {
        cache.hashCache[hash] = { fieldsWarned: {} };
    }

    const currentCache = cache.hashCache[hash];
    const fieldsToWarn = [];

    function validateMissingField(field, fallbackLegacyField = null) {
        const contains = storyString.includes(`{{${field}}}`) || (!!fallbackLegacyField && storyString.includes(`{{${fallbackLegacyField}}}`));
        if (!contains && params[field]) {
            const wasLogged = currentCache.fieldsWarned[field];
            if (!wasLogged) {
                fieldsToWarn.push(field);
                currentCache.fieldsWarned[field] = true;
            }
            console.warn(`The story string does not contain {{${field}}}, but it would contain content:\n`, params[field]);
        }
    }

    validateMissingField('description');
    validateMissingField('personality');
    validateMissingField('persona');
    validateMissingField('scenario');
    // validateMissingField('system');
    validateMissingField('wiBefore', 'loreBefore');
    validateMissingField('wiAfter', 'loreAfter');

    if (fieldsToWarn.length > 0) {
        const fieldsList = fieldsToWarn.map(field => `{{${field}}}`).join(', ');
        toastr.warning(`The story string does not contain the following fields, but they would contain content: ${fieldsList}`, 'Story String Validation');
    }

    localStorage.setItem(storage_keys.storyStringValidationCache, JSON.stringify(cache));
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

    const isSearch = $('#character_sort_order option[data-field="search"]').is(':selected');

    entities.sort((a, b) => {
        // Sort tags/folders will always be at the top
        if (a.type === 'tag' && b.type !== 'tag') {
            return -1;
        }
        if (a.type !== 'tag' && b.type === 'tag') {
            return 1;
        }

        // If we have search sorting, we take scores and use those
        if (isSearch) {
            const aScore = entitiesFilter.getScore(FILTER_TYPES.SEARCH, `${a.type}.${a.id}`);
            const bScore = entitiesFilter.getScore(FILTER_TYPES.SEARCH, `${b.type}.${b.id}`);
            return (aScore - bScore);
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

async function deleteTheme() {
    const themeName = power_user.theme;

    if (!themeName) {
        toastr.info('No theme selected.');
        return;
    }

    const template = $(await renderTemplateAsync('themeDelete', { themeName }));
    const confirm = await callGenericPopup(template, POPUP_TYPE.CONFIRM);

    if (!confirm) {
        return;
    }

    const response = await fetch('/api/themes/delete', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ name: themeName }),
    });

    if (!response.ok) {
        toastr.error('Failed to delete theme. Check the console for more information.');
        return;
    }

    const themeIndex = themes.findIndex(x => x.name == themeName);

    if (themeIndex !== -1) {
        themes.splice(themeIndex, 1);
        $(`#themes option[value="${themeName}"]`).remove();
        power_user.theme = themes[0]?.name;
        saveSettingsDebounced();
        if (power_user.theme) {
            applyTheme(power_user.theme);
        }
        toastr.success('Theme deleted.');
    }
}

/**
 * Exports the current theme to a file.
 */
async function exportTheme() {
    const themeFile = await saveTheme(power_user.theme);
    const fileName = `${themeFile.name}.json`;
    download(JSON.stringify(themeFile, null, 4), fileName, 'application/json');
}

/**
 * Imports a theme from a file.
 * @param {File} file File to import.
 * @returns {Promise<void>} A promise that resolves when the theme is imported.
 */
async function importTheme(file) {
    if (!file) {
        return;
    }

    const fileText = await getFileText(file);
    const parsed = JSON.parse(fileText);

    if (!parsed.name) {
        throw new Error('Missing name');
    }

    if (themes.some(t => t.name === parsed.name)) {
        throw new Error('Theme with that name already exists');
    }

    if (typeof parsed.custom_css === 'string' && parsed.custom_css.includes('@import')) {
        const template = $(await renderTemplateAsync('themeImportWarning'));
        const confirm = await callGenericPopup(template, POPUP_TYPE.CONFIRM);
        if (!confirm) {
            throw new Error('Theme contains @import lines');
        }
    }

    themes.push(parsed);
    await saveTheme(parsed.name, getNewTheme(parsed));
    const option = document.createElement('option');
    option.selected = false;
    option.value = parsed.name;
    option.innerText = parsed.name;
    $('#themes').append(option);
    saveSettingsDebounced();
    toastr.success(parsed.name, 'Theme imported');
}

/**
 * Saves the current theme to the server.
 * @param {string|undefined} name Theme name. If undefined, a popup will be shown to enter a name.
 * @param {object|undefined} theme Theme object. If undefined, the current theme will be saved.
 * @returns {Promise<object>} A promise that resolves when the theme is saved.
 */
async function saveTheme(name = undefined, theme = undefined) {
    if (typeof name !== 'string') {
        const newName = await callGenericPopup('Enter a theme preset name:', POPUP_TYPE.INPUT, power_user.theme);

        if (!newName) {
            return;
        }

        name = String(newName);
    }

    if (typeof theme !== 'object') {
        theme = getThemeObject(name);
    }

    const response = await fetch('/api/themes/save', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(theme),
    });

    if (!response.ok) {
        toastr.error('Check the server connection and reload the page to prevent data loss.', 'Theme could not be saved');
        console.error('Theme could not be saved', response);
        throw new Error('Theme could not be saved');
    }

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

    return theme;
}

/**
 * Gets a snapshot of the current theme settings.
 * @param {string} name Name of the theme
 * @returns {object} Theme object
 */
function getThemeObject(name) {
    return {
        name,
        blur_strength: power_user.blur_strength,
        main_text_color: power_user.main_text_color,
        italics_text_color: power_user.italics_text_color,
        underline_text_color: power_user.underline_text_color,
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
        hideChatAvatars_enabled: power_user.hideChatAvatars_enabled,
        message_token_count_enabled: power_user.message_token_count_enabled,
        expand_message_actions: power_user.expand_message_actions,
        enableZenSliders: power_user.enableZenSliders,
        enableLabMode: power_user.enableLabMode,
        hotswap_enabled: power_user.hotswap_enabled,
        custom_css: power_user.custom_css,
        bogus_folders: power_user.bogus_folders,
        zoomed_avatar_magnification: power_user.zoomed_avatar_magnification,
        reduced_motion: power_user.reduced_motion,
        compact_input_area: power_user.compact_input_area,
    };
}

/**
 * Applies imported theme properties to the theme object.
 * @param {object} parsed Parsed object to get the theme from.
 * @returns {object} Theme assigned to the parsed object.
 */
function getNewTheme(parsed) {
    const theme = getThemeObject(parsed.name);
    for (const key in parsed) {
        if (Object.hasOwn(theme, key)) {
            theme[key] = parsed[key];
        }
    }
    return theme;
}

async function saveMovingUI() {
    const popupResult = await callGenericPopup('Enter a name for the MovingUI Preset:', POPUP_TYPE.INPUT);

    if (!popupResult) {
        return;
    }

    const name = String(popupResult);

    const movingUIPreset = {
        name,
        movingUIState: power_user.movingUIState,
    };
    console.log(movingUIPreset);

    const response = await fetch('/api/moving-ui/save', {
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
        toastr.error('Failed to save MovingUI state.');
        console.error('MovingUI could not be saved', response);
    }
}

/**
 * Resets the movable styles of the given element to their unset values.
 * @param {string} id Element ID
 */
export function resetMovableStyles(id) {
    const panelStyles = ['top', 'left', 'right', 'bottom', 'height', 'width', 'margin'];

    const panel = document.getElementById(id);

    if (panel) {
        panelStyles.forEach((style) => {
            panel.style[style] = '';
        });
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
        'logprobsViewer',
        'cfgConfig',
    ];

    /**
     * @type {HTMLElement[]} Generic panels that don't have a known ID
     */
    const draggedElements = Array.from(document.querySelectorAll('[data-dragged]'));
    const allDraggable = panelIds.map(id => document.getElementById(id)).concat(draggedElements).filter(onlyUnique);

    const panelStyles = ['top', 'left', 'right', 'bottom', 'height', 'width', 'margin'];
    allDraggable.forEach((panel) => {
        if (panel) {
            $(panel).addClass('resizing');
            panelStyles.forEach((style) => {
                panel.style[style] = '';
            });
        }
    });

    /**
     * @type {HTMLElement[]} Zoomed avatars that are currently being resized
     */
    const zoomedAvatars = Array.from(document.querySelectorAll('.zoomed_avatar'));
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

/**
 * Finds the ID of the tag with the given name.
 * @param {string} name
 * @returns {string} The ID of the tag with the given name.
 */
function findTagIdByName(name) {
    const matchTypes = [
        (a, b) => a === b,
        (a, b) => a.startsWith(b),
        (a, b) => a.includes(b),
    ];

    // Only get tags that contain at least one record in the tag_map
    const liveTagIds = new Set(Object.values(tag_map).flat());
    const liveTags = tags.filter(x => liveTagIds.has(x.id));

    const exactNameMatchIndex = liveTags.map(x => x.name.toLowerCase()).indexOf(name.toLowerCase());

    if (exactNameMatchIndex !== -1) {
        return liveTags[exactNameMatchIndex].id;
    }

    for (const matchType of matchTypes) {
        const index = liveTags.findIndex(x => matchType(x.name.toLowerCase(), name.toLowerCase()));
        if (index !== -1) {
            return liveTags[index].id;
        }
    }
}

async function doRandomChat(_, tagName) {
    /**
     * Gets the ID of a random character.
     * @returns {string} The order index of the randomly selected character.
     */
    function getRandomCharacterId() {
        if (!tagName) {
            return Math.floor(Math.random() * characters.length).toString();
        }

        const tagId = findTagIdByName(tagName);
        const taggedCharacters = Object.entries(tag_map)
            .filter(x => x[1].includes(tagId)) // Get only records that include the tag
            .map(x => x[0]) // Map the character avatar
            .filter(x => characters.find(y => y.avatar === x)); // Filter out characters that don't exist
        const randomCharacter = taggedCharacters[Math.floor(Math.random() * taggedCharacters.length)];
        const randomIndex = characters.findIndex(x => x.avatar === randomCharacter);
        if (randomIndex === -1) {
            return;
        }
        return randomIndex.toString();
    }

    resetSelectedGroup();
    const characterId = getRandomCharacterId();
    if (!characterId) {
        toastr.error('No characters found');
        return;
    }
    setCharacterId(characterId);
    setActiveCharacter(characters[characterId]?.avatar);
    setActiveGroup(null);
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
    let cutText = '';

    for (let i = 0; i < totalMesToCut; i++) {
        cutText += (chat[mesIDToCut]?.mes || '') + '\n';
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

    return cutText;
}

async function doDelMode(_, text) {
    //reject invalid args
    if (text && isNaN(text)) {
        toastr.warning('Must enter a number or nothing.');
        return '';
    }

    // Just enter the delete mode.
    if (!text) {
        $('#option_delete_mes').trigger('click', { fromSlashCommand: true });
        return '';
    }

    const count = Number(text);

    // Nothing to delete.
    if (count < 1) {
        return '';
    }

    if (count > chat.length) {
        toastr.warning(`Cannot delete more than ${chat.length} messages.`);
        return '';
    }

    const range = `${chat.length - count}-${chat.length - 1}`;
    return doMesCut(_, range);
}

function doResetPanels() {
    $('#movingUIreset').trigger('click');
    return '';
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

    return '';
}

async function setThemeCallback(_, themeName) {
    if (!themeName) {
        // allow reporting of the theme name if called without args
        // for use in ST Scripts via pipe
        return power_user.theme;
    }

    // @ts-ignore
    const fuse = new Fuse(themes, {
        keys: [
            { name: 'name', weight: 1 },
        ],
    });

    const results = fuse.search(themeName);
    console.debug('Theme fuzzy search results for ' + themeName, results);
    const theme = results[0]?.item;

    if (!theme) {
        toastr.warning(`Could not find theme with name: ${themeName}`);
        return;
    }

    power_user.theme = theme.name;
    applyTheme(theme.name);
    $('#themes').val(theme.name);
    saveSettingsDebounced();
    return '';
}

async function setmovingUIPreset(_, text) {
    // @ts-ignore
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
    return '';
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

export function forceCharacterEditorTokenize() {
    $('[data-token-counter]').each(function () {
        $(document.getElementById($(this).data('token-counter'))).data('last-value-hash', '');
    });
    $('#rm_ch_create_block').trigger('input');
    $('#character_popup').trigger('input');
}

$(document).ready(() => {
    const adjustAutocompleteDebounced = debounce(() => {
        $('.ui-autocomplete-input').each(function () {
            const isOpen = $(this).autocomplete('widget')[0].style.display !== 'none';
            if (isOpen) {
                $(this).autocomplete('search');
            }
        });
    });

    const reportZoomLevelDebounced = debounce(() => {
        const zoomLevel = Number(window.devicePixelRatio).toFixed(2) || 1;
        const winWidth = window.innerWidth;
        const winHeight = window.innerHeight;
        const originalWidth = winWidth * zoomLevel;
        const originalHeight = winHeight * zoomLevel;
        console.log(`Window resize: ${coreTruthWinWidth}x${coreTruthWinHeight} -> ${window.innerWidth}x${window.innerHeight}`);
        console.debug(`Zoom: ${zoomLevel}, X:${winWidth}, Y:${winHeight}, original: ${originalWidth}x${originalHeight} `);
        return zoomLevel;
    });

    var coreTruthWinWidth = window.innerWidth;
    var coreTruthWinHeight = window.innerHeight;

    $(window).on('resize', async () => {
        adjustAutocompleteDebounced();
        setHotswapsDebounced();

        if (isMobile()) {
            return;
        }

        reportZoomLevelDebounced();

        //attempt to scale movingUI elements naturally across window resizing/zooms
        //this will still break if the zoom level causes mobile styles to come into play.
        const scaleY = Number(window.innerHeight / coreTruthWinHeight).toFixed(4);
        const scaleX = Number(window.innerWidth / coreTruthWinWidth).toFixed(4);

        if (Object.keys(power_user.movingUIState).length > 0) {
            for (var elmntName of Object.keys(power_user.movingUIState)) {
                var elmntState = power_user.movingUIState[elmntName];
                var oldHeight = elmntState.height;
                var oldWidth = elmntState.width;
                var oldLeft = elmntState.left;
                var oldTop = elmntState.top;
                var oldBottom = elmntState.bottom;
                var oldRight = elmntState.right;
                var newHeight, newWidth, newTop, newBottom, newLeft, newRight;

                newHeight = Number(oldHeight * scaleY).toFixed(0);
                newWidth = Number(oldWidth * scaleX).toFixed(0);
                newLeft = Number(oldLeft * scaleX).toFixed(0);
                newTop = Number(oldTop * scaleY).toFixed(0);
                newBottom = Number(oldBottom * scaleY).toFixed(0);
                newRight = Number(oldRight * scaleX).toFixed(0);
                try {
                    var elmnt = $('#' + $.escapeSelector(elmntName));
                    if (elmnt.length) {
                        console.log(`scaling ${elmntName} by ${scaleX}x${scaleY} to ${newWidth}x${newHeight}`);
                        elmnt.css('height', newHeight);
                        elmnt.css('width', newWidth);
                        elmnt.css('inset', `${newTop}px ${newRight}px ${newBottom}px ${newLeft}px`);
                        power_user.movingUIState[elmntName].height = newHeight;
                        power_user.movingUIState[elmntName].width = newWidth;
                        power_user.movingUIState[elmntName].top = newTop;
                        power_user.movingUIState[elmntName].bottom = newBottom;
                        power_user.movingUIState[elmntName].left = newLeft;
                        power_user.movingUIState[elmntName].right = newRight;
                    } else {
                        console.log(`skipping ${elmntName} because it doesn't exist in the DOM`);
                    }
                } catch (err) {
                    console.log(`error occurred while processing ${elmntName}: ${err}`);
                }
            }
        } else {
            console.debug('aborting MUI reset', Object.keys(power_user.movingUIState).length);
        }
        saveSettingsDebounced();
        coreTruthWinWidth = window.innerWidth;
        coreTruthWinHeight = window.innerHeight;
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

    $('#fast_ui_mode').change(function () {
        power_user.fast_ui_mode = $(this).prop('checked');
        switchUiMode();
        saveSettingsDebounced();
    });

    $('#waifuMode').on('change', () => {
        power_user.waifuMode = $('#waifuMode').prop('checked');
        switchWaifuMode();
        saveSettingsDebounced();
    });

    $('#customCSS').on('input', () => {
        power_user.custom_css = String($('#customCSS').val());
        saveSettingsDebounced();
        applyCustomCSS();
    });

    $('#movingUImode').change(function () {
        power_user.movingUI = $(this).prop('checked');
        switchMovingUI();
        saveSettingsDebounced();
    });

    $('#noShadowsmode').change(function () {
        power_user.noShadows = $(this).prop('checked');
        applyNoShadows();
        saveSettingsDebounced();
    });

    $('#movingUIreset').on('click', resetMovablePanels);

    $('#avatar_style').on('change', function () {
        const value = $(this).find(':selected').val();
        power_user.avatar_style = Number(value);
        applyAvatarStyle();
        saveSettingsDebounced();
    });

    $('#chat_display').on('change', function () {
        const value = $(this).find(':selected').val();
        power_user.chat_display = Number(value);
        applyChatDisplay();
        saveSettingsDebounced();
    });

    $('#chat_width_slider').on('input', function (e, data) {
        const applyMode = data?.forced ? 'forced' : 'normal';
        power_user.chat_width = Number(e.target.value);
        applyChatWidth(applyMode);
        saveSettingsDebounced();
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

    $('#smooth_streaming').on('input', function () {
        power_user.smooth_streaming = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#smooth_streaming_speed').on('input', function () {
        power_user.smooth_streaming_speed = Number($('#smooth_streaming_speed').val());
        saveSettingsDebounced();
    });

    $('input[name="font_scale"]').on('input', async function (e, data) {
        const applyMode = data?.forced ? 'forced' : 'normal';
        power_user.font_scale = Number(e.target.value);
        $('#font_scale_counter').val(power_user.font_scale);
        applyFontScale(applyMode);
        saveSettingsDebounced();
    });

    $('input[name="blur_strength"]').on('input', async function (e) {
        power_user.blur_strength = Number(e.target.value);
        $('#blur_strength_counter').val(power_user.blur_strength);
        applyBlurStrength();
        saveSettingsDebounced();
    });

    $('input[name="shadow_width"]').on('input', async function (e) {
        power_user.shadow_width = Number(e.target.value);
        $('#shadow_width_counter').val(power_user.shadow_width);
        applyShadowWidth();
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

    $('#underline-color-picker').on('change', (evt) => {
        power_user.underline_text_color = evt.detail.rgba;
        applyThemeColor('underline');
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
    $('#ui-preset-delete-button').on('click', () => deleteTheme());
    $('#movingui-preset-save-button').on('click', saveMovingUI);

    $('#never_resize_avatars').on('input', function () {
        power_user.never_resize_avatars = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#show_card_avatar_urls').on('input', function () {
        power_user.show_card_avatar_urls = !!$(this).prop('checked');
        printCharactersDebounced();
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
        const field = String($(this).find(':selected').data('field'));
        // Save sort order, but do not save search sorting, as this is a temporary sorting option
        if (field !== 'search') {
            power_user.sort_field = field;
            power_user.sort_order = $(this).find(':selected').data('order');
            power_user.sort_rule = $(this).find(':selected').data('rule');
        }
        printCharactersDebounced();
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

    $('#request_token_probabilities').on('input', function () {
        power_user.request_token_probabilities = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#show_group_chat_queue').on('input', function () {
        power_user.show_group_chat_queue = !!$(this).prop('checked');
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
        forceCharacterEditorTokenize();
    });

    $('#send_on_enter').on('change', function () {
        const value = $(this).find(':selected').val();
        power_user.send_on_enter = Number(value);
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
        switchTimer();
        saveSettingsDebounced();
    });

    $('#messageTimestampsEnabled').on('input', function () {
        const value = !!$(this).prop('checked');
        power_user.timestamps_enabled = value;
        switchTimestamps();
        saveSettingsDebounced();
    });

    $('#messageModelIconEnabled').on('input', function () {
        const value = !!$(this).prop('checked');
        power_user.timestamp_model_icon = value;
        switchIcons();
        saveSettingsDebounced();
    });

    $('#messageTokensEnabled').on('input', function () {
        const value = !!$(this).prop('checked');
        power_user.message_token_count_enabled = value;
        switchTokenCount();
        saveSettingsDebounced();
    });

    $('#expandMessageActions').on('input', function () {
        const value = !!$(this).prop('checked');
        power_user.expand_message_actions = value;
        switchMessageActions();
        saveSettingsDebounced();
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
        switchZenSliders();
        saveSettingsDebounced();
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
        switchLabMode();
        saveSettingsDebounced();
    });

    $('#mesIDDisplayEnabled').on('input', function () {
        const value = !!$(this).prop('checked');
        power_user.mesIDDisplay_enabled = value;
        switchMesIDDisplay();
        saveSettingsDebounced();
    });

    $('#hideChatAvatarsEnabled').on('input', function () {
        const value = !!$(this).prop('checked');
        power_user.hideChatAvatars_enabled = value;
        switchHideChatAvatars();
        saveSettingsDebounced();
    });

    $('#hotswapEnabled').on('input', function () {
        const value = !!$(this).prop('checked');
        power_user.hotswap_enabled = value;
        switchHotswap();
        saveSettingsDebounced();
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

    $('#quick_impersonate').on('input', function () {
        const value = !!$(this).prop('checked');
        power_user.quick_impersonate = value;
        $('#mes_impersonate').css('display', value ? '' : 'none');
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

    $('#enable_auto_select_input').on('input', function () {
        const value = !!$(this).prop('checked');
        power_user.enable_auto_select_input = value;
        saveSettingsDebounced();
    });

    $('#enable_md_hotkeys').on('input', function () {
        const value = !!$(this).prop('checked');
        power_user.enable_md_hotkeys = value;
        toggleMDHotkeyIconDisplay();
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
        power_user.custom_stopping_strings = String($(this).val()).trim();
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

    $('#bogus_folders').on('input', function () {
        power_user.bogus_folders = !!$(this).prop('checked');
        printCharactersDebounced();
        saveSettingsDebounced();
    });

    $('#zoomed_avatar_magnification').on('input', function () {
        power_user.zoomed_avatar_magnification = !!$(this).prop('checked');
        printCharactersDebounced();
        saveSettingsDebounced();
    });

    $('#aux_field').on('change', function () {
        const value = $(this).find(':selected').val();
        power_user.aux_field = String(value);
        printCharactersDebounced();
        saveSettingsDebounced();
    });

    $('#tag_import_setting').on('change', function () {
        const value = $(this).find(':selected').val();
        power_user.tag_import_setting = Number(value);
        saveSettingsDebounced();
    });

    $('#stscript_autocomplete_autoHide').on('input', function () {
        power_user.stscript.autocomplete.autoHide = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#stscript_matching').on('change', function () {
        const value = $(this).find(':selected').val();
        power_user.stscript.matching = String(value);
        saveSettingsDebounced();
    });

    $('#stscript_autocomplete_style').on('change', function () {
        const value = $(this).find(':selected').val();
        power_user.stscript.autocomplete.style = String(value);
        document.body.setAttribute('data-stscript-style', power_user.stscript.autocomplete.style);
        saveSettingsDebounced();
    });

    $('#stscript_autocomplete_select').on('change', function () {
        const value = $(this).find(':selected').val();
        power_user.stscript.autocomplete.select = parseInt(String(value));
        saveSettingsDebounced();
    });

    $('#stscript_autocomplete_font_scale').on('input', function () {
        const value = $(this).val();
        $('#stscript_autocomplete_font_scale_counter').val(value);
        power_user.stscript.autocomplete.font.scale = Number(value);
        document.body.style.setProperty('--ac-font-scale', value.toString());
        window.dispatchEvent(new Event('resize', { bubbles: true }));
        saveSettingsDebounced();
    });
    $('#stscript_autocomplete_font_scale_counter').on('input', function () {
        const value = $(this).val();
        $('#stscript_autocomplete_font_scale').val(value);
        power_user.stscript.autocomplete.font.scale = Number(value);
        document.body.style.setProperty('--ac-font-scale', value.toString());
        window.dispatchEvent(new Event('resize', { bubbles: true }));
        saveSettingsDebounced();
    });

    $('#stscript_autocomplete_width_left').on('input', function () {
        const value = $(this).val();
        power_user.stscript.autocomplete.width.left = Number(value);
        /**@type {HTMLElement}*/(this.closest('.doubleRangeInputContainer')).style.setProperty('--value', value.toString());
        window.dispatchEvent(new Event('resize', { bubbles: true }));
        saveSettingsDebounced();
    });

    $('#stscript_autocomplete_width_right').on('input', function () {
        const value = $(this).val();
        power_user.stscript.autocomplete.width.right = Number(value);
        /**@type {HTMLElement}*/(this.closest('.doubleRangeInputContainer')).style.setProperty('--value', value.toString());
        window.dispatchEvent(new Event('resize', { bubbles: true }));
        saveSettingsDebounced();
    });

    $('#stscript_parser_flag_strict_escaping').on('click', function () {
        const value = $(this).prop('checked');
        power_user.stscript.parser.flags[PARSER_FLAG.STRICT_ESCAPING] = value;
        saveSettingsDebounced();
    });

    $('#stscript_parser_flag_replace_getvar').on('click', function () {
        const value = $(this).prop('checked');
        power_user.stscript.parser.flags[PARSER_FLAG.REPLACE_GETVAR] = value;
        saveSettingsDebounced();
    });

    $('#restore_user_input').on('input', function () {
        power_user.restore_user_input = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#reduced_motion').on('input', function () {
        power_user.reduced_motion = !!$(this).prop('checked');
        switchReducedMotion();
        saveSettingsDebounced();
    });

    $('#compact_input_area').on('input', function () {
        power_user.compact_input_area = !!$(this).prop('checked');
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

    $('#forbid_external_media').on('input', function () {
        power_user.forbid_external_media = !!$(this).prop('checked');
        saveSettingsDebounced();
        reloadCurrentChat();
    });

    $('#ui_preset_import_button').on('click', function () {
        $('#ui_preset_import_file').trigger('click');
    });

    $('#ui_preset_import_file').on('change', async function () {
        const inputElement = this instanceof HTMLInputElement && this;

        try {
            const file = inputElement?.files?.[0];
            await importTheme(file);
        } catch (error) {
            console.error('Error importing UI theme', error);
            toastr.error(String(error), 'Failed to import UI theme');
        } finally {
            if (inputElement) {
                inputElement.value = null;
            }
        }
    });

    $('#ui_preset_export_button').on('click', async function () {
        await exportTheme();
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

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'vn',
        callback: toggleWaifu,
        helpString: 'Swaps Visual Novel Mode On/Off',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'newchat',
        /** @type {(args: { delete: string?}, string) => Promise<''>} */
        callback: async (args, _) => {
            await doNewChat({ deleteCurrentChat: isTrueBoolean(args.delete) });
            return '';
        },
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'delete',
                description: 'delete the current chat',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'false',
                enumList: commonEnumProviders.boolean('trueFalse')(),
            }),
        ],
        helpString: 'Start a new chat with the current character',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'random',
        callback: doRandomChat,
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'optional tag name',
                typeList: [ARGUMENT_TYPE.STRING],
                enumProvider: () => tags.filter(tag => Object.values(tag_map).some(x => x.includes(tag.id))).map(tag => new SlashCommandEnumValue(tag.name, null, enumTypes.enum, enumIcons.tag)),
            }),
        ],
        helpString: 'Start a new chat with a random character. If an argument is provided, only considers characters that have the specified tag.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'delmode',
        callback: doDelMode,
        aliases: ['del'],
        unnamedArgumentList: [
            new SlashCommandArgument(
                'optional number', [ARGUMENT_TYPE.NUMBER], false,
            ),
        ],
        helpString: 'Enter message deletion mode, and auto-deletes last N messages if numeric argument is provided.',
        returns: 'The text of the deleted messages.',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'cut',
        callback: doMesCut,
        returns: 'the text of cut messages separated by a newline',
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'number or range',
                typeList: [ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.RANGE],
                isRequired: true,
                acceptsMultiple: true,
                enumProvider: commonEnumProviders.messages(),
            }),
        ],
        helpString: `
            <div>
                Cuts the specified message or continuous chunk from the chat.
            </div>
            <div>
                Ranges are inclusive!
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code>/cut 0-10</code></pre>
                    </li>
                </ul>
            </div>
        `,
        aliases: [],
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'resetpanels',
        callback: doResetPanels,
        helpString: 'resets UI panels to original state',
        aliases: ['resetui'],
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'bgcol',
        callback: setAvgBG,
        helpString: '– WIP test of auto-bg avg coloring',
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'theme',
        callback: setThemeCallback,
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'theme name',
                typeList: [ARGUMENT_TYPE.STRING],
                enumProvider: () => themes.map(theme => new SlashCommandEnumValue(theme.name)),
            }),
        ],
        helpString: `
        <div>
            Sets a UI theme by name.
        </div>
        <div>
            If no theme name is is provided, this will return the currently active theme.
        </div>
        <div>
            <strong>Example:</strong>
            <ul>
                <li>
                    <pre><code>/theme Cappuccino</code></pre>
                </li>
                <li>
                    <pre><code>/theme</code></pre>
                </li>
            </ul>
        </div>
    `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'movingui',
        callback: setmovingUIPreset,
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: () => movingUIPresets.map(preset => new SlashCommandEnumValue(preset.name)),
            }),
        ],
        helpString: 'activates a movingUI preset by name',
    }));
});
