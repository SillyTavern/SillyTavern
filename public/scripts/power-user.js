import {
    saveSettingsDebounced,
    scrollChatToBottom,
    characters,
    callPopup,
    getStatus,
    reloadMarkdownProcessor,
    reloadCurrentChat,
    getRequestHeaders,
    substituteParams,
    updateVisibleDivs,
    eventSource,
    event_types,
    getCurrentChatId,
    printCharacters,
    name1,
    name2,
    setCharacterId,
    setEditedMessageId
} from "../script.js";
import { favsToHotswap, isMobile, initMovingUI } from "./RossAscends-mods.js";
import {
    groups,
    resetSelectedGroup,
    selected_group,
} from "./group-chats.js";

import { registerSlashCommand } from "./slash-commands.js";

import { delay, debounce } from "./utils.js";

export {
    loadPowerUserSettings,
    loadMovingUIState,
    collapseNewlines,
    playMessageSound,
    sortGroupMembers,
    sortCharactersList,
    fixMarkdown,
    power_user,
    pygmalion_options,
    tokenizers,
    send_on_enter_options,
};

const MAX_CONTEXT_DEFAULT = 2048;
const MAX_CONTEXT_UNLOCKED = 65536;

const avatar_styles = {
    ROUND: 0,
    RECTANGULAR: 1,
}

export const chat_styles = {
    DEFAULT: 0,
    BUBBLES: 1,
    DOCUMENT: 2,
}

const pygmalion_options = {
    DISABLED: -1,
    AUTO: 0,
    ENABLED: 1,
}

const tokenizers = {
    NONE: 0,
    GPT3: 1,
    CLASSIC: 2,
    LLAMA: 3,
    NERD: 4,
    NERD2: 5,
    API: 6,
}

const send_on_enter_options = {
    DISABLED: -1,
    AUTO: 0,
    ENABLED: 1,
}

export const persona_description_positions = {
    BEFORE_CHAR: 0,
    AFTER_CHAR: 1,
    TOP_AN: 2,
    BOTTOM_AN: 3,
}

let power_user = {
    tokenizer: tokenizers.CLASSIC,
    token_padding: 64,
    collapse_newlines: false,
    pygmalion_formatting: pygmalion_options.AUTO,
    pin_examples: false,
    disable_description_formatting: false,
    disable_scenario_formatting: false,
    disable_personality_formatting: false,
    disable_examples_formatting: false,
    disable_start_formatting: false,
    trim_sentences: false,
    include_newline: false,
    always_force_name2: false,
    user_prompt_bias: '',
    show_user_prompt_bias: true,
    multigen: false,
    multigen_first_chunk: 50,
    multigen_next_chunks: 30,
    custom_chat_separator: '',
    markdown_escape_strings: '',

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
    user_mes_blur_tint_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeUserMesBlurTintColor').trim()}`,
    bot_mes_blur_tint_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeBotMesBlurTintColor').trim()}`,
    shadow_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeShadowColor').trim()}`,

    waifuMode: false,
    movingUI: false,
    movingUIState: {},
    movingUIPreset: '',
    noShadows: false,
    theme: 'Default (Dark) 1.7.1',


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
    //removeXML: false,
    hotswap_enabled: true,
    timer_enabled: true,
    timestamps_enabled: true,
    mesIDDisplay_enabled: false,
    max_context_unlocked: false,
    prefer_character_prompt: true,
    prefer_character_jailbreak: true,
    continue_on_send: false,
    trim_spaces: true,

    instruct: {
        enabled: false,
        wrap: true,
        names: false,
        system_prompt: "Below is an instruction that describes a task. Write a response that appropriately completes the request.\n\nWrite {{char}}'s next reply in a fictional roleplay chat between {{user}} and {{char}}. Write 1 reply only.",
        system_sequence: '',
        stop_sequence: '',
        input_sequence: '### Instruction:',
        output_sequence: '### Response:',
        preset: 'Alpaca',
        separator_sequence: '',
        macro: false,
    },

    personas: {},
    default_persona: null,
    persona_descriptions: {},

    persona_description: '',
    persona_description_position: persona_description_positions.BEFORE_CHAR,

    custom_stopping_strings: '',
};

let themes = [];
let movingUIPresets = [];
let instruct_presets = [];

const storage_keys = {
    fast_ui_mode: "TavernAI_fast_ui_mode",
    avatar_style: "TavernAI_avatar_style",
    chat_display: "TavernAI_chat_display",
    chat_width: "chat_width",
    font_scale: "TavernAI_font_scale",

    main_text_color: "TavernAI_main_text_color",
    italics_text_color: "TavernAI_italics_text_color",
    quote_text_color: "TavernAI_quote_text_color",
    blur_tint_color: "TavernAI_blur_tint_color",
    user_mes_blur_tint_color: "TavernAI_user_mes_blur_tint_color",
    bot_mes_blur_tint_color: "TavernAI_bot_mes_blur_tint_color",
    blur_strength: "TavernAI_blur_strength",
    shadow_color: "TavernAI_shadow_color",
    shadow_width: "TavernAI_shadow_width",

    waifuMode: "TavernAI_waifuMode",
    movingUI: "TavernAI_movingUI",
    noShadows: "TavernAI_noShadows",

    hotswap_enabled: 'HotswapEnabled',
    timer_enabled: 'TimerEnabled',
    timestamps_enabled: 'TimestampsEnabled',
    mesIDDisplay_enabled: 'mesIDDisplayEnabled',
};

let browser_has_focus = true;

function playMessageSound() {
    if (!power_user.play_message_sound) {
        return;
    }

    if (power_user.play_sound_unfocused && browser_has_focus) {
        return;
    }

    const audio = document.getElementById('audio_message_sound');
    audio.volume = 0.8;
    audio.pause();
    audio.currentTime = 0;
    audio.play();
}

function collapseNewlines(x) {
    return x.replaceAll(/\n+/g, "\n");
}

function fixMarkdown(text) {
    // fix formatting problems in markdown
    // e.g.:
    // "^example * text*\n" -> "^example *text*\n"
    // "^*example * text\n" -> "^*example* text\n"
    // "^example *text *\n" -> "^example *text*\n"
    // "^* example * text\n" -> "^*example* text\n"
    // take note that the side you move the asterisk depends on where its pairing is
    // i.e. both of the following strings have the same broken asterisk ' * ',
    // but you move the first to the left and the second to the right, to match the non-broken asterisk "^example * text*\n" "^*example * text\n"
    // and you HAVE to handle the cases where multiple pairs of asterisks exist in the same line
    // i.e. "^example * text* * harder problem *\n" -> "^example *text* *harder problem*\n"

    // Find pairs of formatting characters and capture the text in between them
    const format = /(\*|_|~){1,2}([\s\S]*?)\1{1,2}/gm;
    let matches = [];
    let match;
    while ((match = format.exec(text)) !== null) {
        matches.push(match);
    }

    // Iterate through the matches and replace adjacent spaces immediately beside formatting characters
    let newText = text;
    for (let i = matches.length - 1; i >= 0; i--) {
        let matchText = matches[i][0];
        let replacementText = matchText.replace(/(\*|_|~)(\s+)|(\s+)(\*|_|~)/g, '$1$4');
        newText = newText.slice(0, matches[i].index) + replacementText + newText.slice(matches[i].index + matchText.length);
    }

    return newText;
}

function switchHotswap() {
    const value = localStorage.getItem(storage_keys.hotswap_enabled);
    power_user.hotswap_enabled = value === null ? true : value == "true";
    $("body").toggleClass("no-hotswap", !power_user.hotswap_enabled);
    $("#hotswapEnabled").prop("checked", power_user.hotswap_enabled);
}

function switchTimer() {
    const value = localStorage.getItem(storage_keys.timer_enabled);
    power_user.timer_enabled = value === null ? true : value == "true";
    $("body").toggleClass("no-timer", !power_user.timer_enabled);
    $("#messageTimerEnabled").prop("checked", power_user.timer_enabled);
}

function switchTimestamps() {
    const value = localStorage.getItem(storage_keys.timestamps_enabled);
    power_user.timestamps_enabled = value === null ? true : value == "true";
    $("body").toggleClass("no-timestamps", !power_user.timestamps_enabled);
    $("#messageTimestampsEnabled").prop("checked", power_user.timestamps_enabled);
}

function switchMesIDDisplay() {
    const value = localStorage.getItem(storage_keys.mesIDDisplay_enabled);
    power_user.mesIDDisplay_enabled = value === null ? true : value == "true";
    $("body").toggleClass("no-mesIDDisplay", !power_user.mesIDDisplay_enabled);
    $("#MesIDDisplayEnabled").prop("checked", power_user.mesIDDisplay_enabled);
}

function switchUiMode() {
    const fastUi = localStorage.getItem(storage_keys.fast_ui_mode);
    power_user.fast_ui_mode = fastUi === null ? true : fastUi == "true";
    $("body").toggleClass("no-blur", power_user.fast_ui_mode);
    $("#fast_ui_mode").prop("checked", power_user.fast_ui_mode);
}

function toggleWaifu() {
    $("#waifuMode").trigger("click");
}

function switchWaifuMode() {
    $("body").toggleClass("waifuMode", power_user.waifuMode);
    $("#waifuMode").prop("checked", power_user.waifuMode);
    scrollChatToBottom();
}

function switchSpoilerMode() {
    if (power_user.spoiler_free_mode) {
        $("#description_div").hide();
        $("#description_textarea").hide();
        $("#firstmessage_textarea").hide();
        $("#first_message_div").hide();
        $("#spoiler_free_desc").show();
    }
    else {
        $("#description_div").show();
        $("#description_textarea").show();
        $("#firstmessage_textarea").show();
        $("#first_message_div").show();
        $("#spoiler_free_desc").hide();
    }
}

function peekSpoilerMode() {
    $("#description_div").toggle();
    $("#description_textarea").toggle();
    $("#firstmessage_textarea").toggle();
    $("#first_message_div").toggle();

}


function switchMovingUI() {
    const movingUI = localStorage.getItem(storage_keys.movingUI);
    power_user.movingUI = movingUI === null ? false : movingUI == "true";
    $("body").toggleClass("movingUI", power_user.movingUI);
    if (power_user.movingUI === true) {
        initMovingUI()
        if (power_user.movingUIState) {
            loadMovingUIState();
        }
    };
}

function noShadows() {
    const noShadows = localStorage.getItem(storage_keys.noShadows);
    power_user.noShadows = noShadows === null ? false : noShadows == "true";
    $("body").toggleClass("noShadows", power_user.noShadows);
    $("#noShadowsmode").prop("checked", power_user.noShadows);
    scrollChatToBottom();
}

function applyAvatarStyle() {
    power_user.avatar_style = Number(localStorage.getItem(storage_keys.avatar_style) ?? avatar_styles.ROUND);
    $("body").toggleClass("big-avatars", power_user.avatar_style === avatar_styles.RECTANGULAR);
    $(`input[name="avatar_style"][value="${power_user.avatar_style}"]`).prop("checked", true);

}

function applyChatDisplay() {

    if (!power_user.chat_display === (null || undefined)) {
        console.debug('applyChatDisplay: saw no chat display type defined')
        return
    }
    console.debug(`applyChatDisplay: applying ${power_user.chat_display}`)

    $(`#chat_display option[value=${power_user.chat_display}]`).attr("selected", true)

    switch (power_user.chat_display) {
        case 0: {
            console.log('applying default chat')
            $("body").removeClass("bubblechat");
            $("body").removeClass("documentstyle");
            break
        }
        case 1: {
            console.log('applying bubblechat')
            $("body").addClass("bubblechat");
            $("body").removeClass("documentstyle");
            break
        }
        case 2: {
            console.log('applying document style')
            $("body").removeClass("bubblechat");
            $("body").addClass("documentstyle");
            break
        }
    }
}

function applyChatWidth() {
    power_user.chat_width = Number(localStorage.getItem(storage_keys.chat_width) ?? 50);
    let r = document.documentElement;
    r.style.setProperty('--sheldWidth', `${power_user.chat_width}vw`);
    $('#chat_width_slider').val(power_user.chat_width);
}

async function applyThemeColor(type) {
    if (type === 'main') {
        document.documentElement.style.setProperty('--SmartThemeBodyColor', power_user.main_text_color);
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
    if (type === 'userMesBlurTint') {
        document.documentElement.style.setProperty('--SmartThemeUserMesBlurTintColor', power_user.user_mes_blur_tint_color);
    }
    if (type === 'botMesBlurTint') {
        document.documentElement.style.setProperty('--SmartThemeBotMesBlurTintColor', power_user.bot_mes_blur_tint_color);
    }
    if (type === 'shadow') {
        document.documentElement.style.setProperty('--SmartThemeShadowColor', power_user.shadow_color);
    }
}

async function applyBlurStrength() {
    power_user.blur_strength = Number(localStorage.getItem(storage_keys.blur_strength) ?? 1);
    document.documentElement.style.setProperty('--blurStrength', power_user.blur_strength);
    $("#blur_strength_counter").text(power_user.blur_strength);
    $("#blur_strength").val(power_user.blur_strength);

}

async function applyShadowWidth() {
    power_user.shadow_width = Number(localStorage.getItem(storage_keys.shadow_width) ?? 2);
    document.documentElement.style.setProperty('--shadowWidth', power_user.shadow_width);
    $("#shadow_width_counter").text(power_user.shadow_width);
    $("#shadow_width").val(power_user.shadow_width);

}

async function applyFontScale() {
    power_user.font_scale = Number(localStorage.getItem(storage_keys.font_scale) ?? 1);
    document.documentElement.style.setProperty('--fontScale', power_user.font_scale);
    $("#font_scale_counter").text(power_user.font_scale);
    $("#font_scale").val(power_user.font_scale);
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
        { key: 'user_mes_blur_tint_color', selector: '#user-mes-blur-tint-color-picker', type: 'userMesBlurTint' },
        { key: 'bot_mes_blur_tint_color', selector: '#bot-mes-blur-tint-color-picker', type: 'botMesBlurTint' },
        { key: 'shadow_color', selector: '#shadow-color-picker', type: 'shadow' },
        {
            key: 'blur_strength',
            action: async () => {
                localStorage.setItem(storage_keys.blur_strength, power_user.blur_strength);
                await applyBlurStrength();
            }
        },
        {
            key: 'shadow_width',
            action: async () => {
                localStorage.setItem(storage_keys.shadow_width, power_user.shadow_width);
                await applyShadowWidth();
            }
        },
        {
            key: 'font_scale',
            action: async () => {
                localStorage.setItem(storage_keys.font_scale, power_user.font_scale);
                await applyFontScale();
            }
        },
        {
            key: 'fast_ui_mode',
            action: async () => {
                localStorage.setItem(storage_keys.fast_ui_mode, power_user.fast_ui_mode);
                switchUiMode();
            }
        },
        {
            key: 'waifuMode',
            action: async () => {
                localStorage.setItem(storage_keys.waifuMode, power_user.waifuMode);
                switchWaifuMode();
            }
        },
        {
            key: 'chat_display',
            action: async () => {
                localStorage.setItem(storage_keys.chat_display, power_user.chat_display);
                applyChatDisplay();
            }
        },
        {
            key: 'avatar_style',
            action: async () => {
                localStorage.setItem(storage_keys.avatar_style, power_user.avatar_style);
                applyAvatarStyle();
            }
        },
        {
            key: 'noShadows',
            action: async () => {
                localStorage.setItem(storage_keys.noShadows, power_user.noShadows);
                noShadows();
            }
        },
        {
            key: 'chat_width',
            action: async () => {
                localStorage.setItem(storage_keys.chat_width, power_user.chat_width);
                applyChatWidth();
            }
        },
        {
            key: 'timer_enabled',
            action: async () => {
                localStorage.setItem(storage_keys.timer_enabled, power_user.timer_enabled);
                switchTimer();
            }
        },
        {
            key: 'timestamps_enabled',
            action: async () => {
                localStorage.setItem(storage_keys.timestamps_enabled, power_user.timestamps_enabled);
                switchTimestamps();
            }
        },
        {
            key: 'mesIDDisplay_enabled',
            action: async () => {
                localStorage.setItem(storage_keys.mesIDDisplay_enabled, power_user.mesIDDisplay_enabled);
                switchMesIDDisplay();
            }
        },
        {
            key: 'hotswap_enabled',
            action: async () => {
                localStorage.setItem(storage_keys.hotswap_enabled, power_user.hotswap_enabled);
                switchHotswap();
            }
        }
    ];

    for (const { key, selector, type, action } of themeProperties) {
        if (theme[key] !== undefined) {
            power_user[key] = theme[key];
            if (selector) $(selector).attr('color', power_user[key]);
            if (type) await applyThemeColor(type);
            if (action) await action();
        } else {
            if (selector) { $(selector).attr('color', 'rgba(0,0,0,0)') };
            console.debug(`Empty theme key: ${key}`);
            power_user[key] = '';
        }
    }

    console.log('theme applied: ' + name);
}

async function applyMovingUIPreset(name) {
    resetMovablePanels('quiet')
    const movingUIPreset = movingUIPresets.find(x => x.name == name);

    if (!movingUIPreset) {
        return;
    }

    power_user.movingUIState = movingUIPreset.movingUIState;


    console.log('MovingUI Preset applied: ' + name);
    loadMovingUIState()
}

switchUiMode();
applyFontScale();
applyThemeColor();
applyChatWidth();
applyAvatarStyle();
applyBlurStrength();
applyShadowWidth();
switchMovingUI();
noShadows();
switchHotswap();
switchTimer();
switchTimestamps();
switchMesIDDisplay();

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

    if (data.instruct !== undefined) {
        instruct_presets = data.instruct;
    }

    // These are still local storage
    const fastUi = localStorage.getItem(storage_keys.fast_ui_mode);
    const movingUI = localStorage.getItem(storage_keys.movingUI);
    const noShadows = localStorage.getItem(storage_keys.noShadows);
    const hotswap = localStorage.getItem(storage_keys.hotswap_enabled);
    const timer = localStorage.getItem(storage_keys.timer_enabled);
    const timestamps = localStorage.getItem(storage_keys.timestamps_enabled);
    const mesIDDisplay = localStorage.getItem(storage_keys.mesIDDisplay_enabled);
    power_user.fast_ui_mode = fastUi === null ? true : fastUi == "true";
    power_user.movingUI = movingUI === null ? false : movingUI == "true";
    power_user.noShadows = noShadows === null ? false : noShadows == "true";
    power_user.hotswap_enabled = hotswap === null ? true : hotswap == "true";
    power_user.timer_enabled = timer === null ? true : timer == "true";
    power_user.timestamps_enabled = timestamps === null ? true : timestamps == "true";
    power_user.mesIDDisplay_enabled = mesIDDisplay === null ? true : mesIDDisplay == "true";
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

    $('#trim_spaces').prop("checked", power_user.trim_spaces);
    $('#continue_on_send').prop("checked", power_user.continue_on_send);
    $('#auto_swipe').prop("checked", power_user.auto_swipe);
    $('#auto_swipe_minimum_length').val(power_user.auto_swipe_minimum_length);
    $('#auto_swipe_blacklist').val(power_user.auto_swipe_blacklist.join(", "));
    $('#auto_swipe_blacklist_threshold').val(power_user.auto_swipe_blacklist_threshold);
    $('#custom_stopping_strings').val(power_user.custom_stopping_strings);

    $("#console_log_prompts").prop("checked", power_user.console_log_prompts);
    $('#auto_fix_generated_markdown').prop("checked", power_user.auto_fix_generated_markdown);
    $('#auto_scroll_chat_to_bottom').prop("checked", power_user.auto_scroll_chat_to_bottom);
    $(`#tokenizer option[value="${power_user.tokenizer}"]`).attr('selected', true);
    $(`#pygmalion_formatting option[value=${power_user.pygmalion_formatting}]`).attr("selected", true);
    $(`#send_on_enter option[value=${power_user.send_on_enter}]`).attr("selected", true);
    $("#import_card_tags").prop("checked", power_user.import_card_tags);
    $("#confirm_message_delete").prop("checked", power_user.confirm_message_delete !== undefined ? !!power_user.confirm_message_delete : true);
    $("#spoiler_free_mode").prop("checked", power_user.spoiler_free_mode);
    $("#collapse-newlines-checkbox").prop("checked", power_user.collapse_newlines);
    $("#pin-examples-checkbox").prop("checked", power_user.pin_examples);
    $("#disable-description-formatting-checkbox").prop("checked", power_user.disable_description_formatting);
    $("#disable-scenario-formatting-checkbox").prop("checked", power_user.disable_scenario_formatting);
    $("#disable-personality-formatting-checkbox").prop("checked", power_user.disable_personality_formatting);
    $("#always-force-name2-checkbox").prop("checked", power_user.always_force_name2);
    $("#disable-examples-formatting-checkbox").prop("checked", power_user.disable_examples_formatting);
    $('#disable-start-formatting-checkbox').prop("checked", power_user.disable_start_formatting);
    $("#trim_sentences_checkbox").prop("checked", power_user.trim_sentences);
    $("#include_newline_checkbox").prop("checked", power_user.include_newline);
    $('#render_formulas').prop("checked", power_user.render_formulas);
    $("#custom_chat_separator").val(power_user.custom_chat_separator);
    $("#markdown_escape_strings").val(power_user.markdown_escape_strings);
    $("#fast_ui_mode").prop("checked", power_user.fast_ui_mode);
    $("#waifuMode").prop("checked", power_user.waifuMode);
    $("#movingUImode").prop("checked", power_user.movingUI);
    $("#noShadowsmode").prop("checked", power_user.noShadows);
    $("#start_reply_with").val(power_user.user_prompt_bias);
    $("#chat-show-reply-prefix-checkbox").prop("checked", power_user.show_user_prompt_bias);
    $("#multigen").prop("checked", power_user.multigen);
    $("#multigen_first_chunk").val(power_user.multigen_first_chunk);
    $("#multigen_next_chunks").val(power_user.multigen_next_chunks);
    $("#play_message_sound").prop("checked", power_user.play_message_sound);
    $("#play_sound_unfocused").prop("checked", power_user.play_sound_unfocused);
    $("#never_resize_avatars").prop("checked", power_user.never_resize_avatars);
    $("#show_card_avatar_urls").prop("checked", power_user.show_card_avatar_urls);
    $("#auto_save_msg_edits").prop("checked", power_user.auto_save_msg_edits);
    $("#allow_name1_display").prop("checked", power_user.allow_name1_display);
    $("#allow_name2_display").prop("checked", power_user.allow_name2_display);
    //$("#removeXML").prop("checked", power_user.removeXML);
    $("#hotswapEnabled").prop("checked", power_user.hotswap_enabled);
    $("#messageTimerEnabled").prop("checked", power_user.timer_enabled);
    $("#messageTimestampsEnabled").prop("checked", power_user.timestamps_enabled);
    $("#mesIDDisplayEnabled").prop("checked", power_user.mesIDDisplay_enabled);
    $("#prefer_character_prompt").prop("checked", power_user.prefer_character_prompt);
    $("#prefer_character_jailbreak").prop("checked", power_user.prefer_character_jailbreak);
    $(`input[name="avatar_style"][value="${power_user.avatar_style}"]`).prop("checked", true);
    $(`#chat_display option[value=${power_user.chat_display}]`).attr("selected", true).trigger('change');
    $('#chat_width_slider').val(power_user.chat_width);
    $("#token_padding").val(power_user.token_padding);

    $("#font_scale").val(power_user.font_scale);
    $("#font_scale_counter").text(power_user.font_scale);

    $("#blur_strength").val(power_user.blur_strength);
    $("#blur_strength_counter").text(power_user.blur_strength);

    $("#shadow_width").val(power_user.shadow_width);
    $("#shadow_width_counter").text(power_user.shadow_width);

    $("#main-text-color-picker").attr('color', power_user.main_text_color);
    $("#italics-color-picker").attr('color', power_user.italics_text_color);
    $("#quote-color-picker").attr('color', power_user.quote_text_color);
    //$("#fastui-bg-color-picker").attr('color', power_user.fastui_bg_color);
    $("#blur-tint-color-picker").attr('color', power_user.blur_tint_color);
    $("#user-mes-blur-tint-color-picker").attr('color', power_user.user_mes_blur_tint_color);
    $("#bot-mes-blur-tint-color-picker").attr('color', power_user.bot_mes_blur_tint_color);
    $("#shadow-color-picker").attr('color', power_user.shadow_color);

    for (const theme of themes) {
        const option = document.createElement('option');
        option.value = theme.name;
        option.innerText = theme.name;
        option.selected = theme.name == power_user.theme;
        $("#themes").append(option);
    }

    for (const movingUIPreset of movingUIPresets) {
        const option = document.createElement('option');
        option.value = movingUIPreset.name;
        option.innerText = movingUIPreset.name;
        option.selected = movingUIPreset.name == power_user.movingUIPreset;
        $("#movingUIPresets").append(option);
    }


    $(`#character_sort_order option[data-order="${power_user.sort_order}"][data-field="${power_user.sort_field}"]`).prop("selected", true);
    sortCharactersList();
    reloadMarkdownProcessor(power_user.render_formulas);
    loadInstructMode();
    loadMaxContextUnlocked();
    switchWaifuMode();
    switchSpoilerMode();
    loadMovingUIState();
    loadCharListState();

    //console.log(power_user)
}

async function loadCharListState() {
    if (document.getElementById('CharID0') !== null) {
        console.debug('setting charlist state to...')
        if (power_user.charListGrid === true) {
            console.debug('..to grid')
            $("#charListGridToggle").trigger('click')
        } else { console.debug('..to list') }
    } else {
        console.debug('charlist not ready yet')
        await delay(100)
        loadCharListState();
    }
}

function loadMovingUIState() {
    if (isMobile() === false
        && power_user.movingUIState
        && power_user.movingUI === true) {
        console.debug('loading movingUI state')
        for (var elmntName of Object.keys(power_user.movingUIState)) {
            var elmntState = power_user.movingUIState[elmntName];
            try {
                var elmnt = $('#' + $.escapeSelector(elmntName));
                if (elmnt.length) {
                    console.debug(`loading state for ${elmntName}`)
                    elmnt.css(elmntState);
                } else {
                    console.debug(`skipping ${elmntName} because it doesn't exist in the DOM`)
                }
            } catch (err) {
                console.debug(`error occurred while processing ${elmntName}: ${err}`)
            }
        }
    } else {
        console.debug('skipping movingUI state load')
        return
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
    const element = $('#max_context');
    const maxValue = power_user.max_context_unlocked ? MAX_CONTEXT_UNLOCKED : MAX_CONTEXT_DEFAULT;
    element.attr('max', maxValue);
    const value = Number(element.val());

    if (value >= maxValue) {
        element.val(maxValue).trigger('input');
    }
}

function loadInstructMode() {
    const controls = [
        { id: "instruct_enabled", property: "enabled", isCheckbox: true },
        { id: "instruct_wrap", property: "wrap", isCheckbox: true },
        { id: "instruct_system_prompt", property: "system_prompt", isCheckbox: false },
        { id: "instruct_system_sequence", property: "system_sequence", isCheckbox: false },
        { id: "instruct_separator_sequence", property: "separator_sequence", isCheckbox: false },
        { id: "instruct_input_sequence", property: "input_sequence", isCheckbox: false },
        { id: "instruct_output_sequence", property: "output_sequence", isCheckbox: false },
        { id: "instruct_stop_sequence", property: "stop_sequence", isCheckbox: false },
        { id: "instruct_names", property: "names", isCheckbox: true },
        { id: "instruct_macro", property: "macro", isCheckbox: true },
    ];

    controls.forEach(control => {
        const $element = $(`#${control.id}`);

        if (control.isCheckbox) {
            $element.prop('checked', power_user.instruct[control.property]);
        } else {
            $element.val(power_user.instruct[control.property]);
        }

        $element.on('input', function () {
            power_user.instruct[control.property] = control.isCheckbox ? $(this).prop('checked') : $(this).val();
            saveSettingsDebounced();
        });
    });

    instruct_presets.forEach((preset) => {
        const name = preset.name;
        const option = document.createElement('option');
        option.value = name;
        option.innerText = name;
        option.selected = name === power_user.instruct.preset;
        $('#instruct_presets').append(option);
    });

    $('#instruct_presets').on('change', function () {
        const name = $(this).find(':selected').val();
        const preset = instruct_presets.find(x => x.name === name);

        if (!preset) {
            return;
        }

        power_user.instruct.preset = name;
        controls.forEach(control => {
            if (preset[control.property] !== undefined) {
                power_user.instruct[control.property] = preset[control.property];
                const $element = $(`#${control.id}`);

                if (control.isCheckbox) {
                    $element.prop('checked', power_user.instruct[control.property]).trigger('input');
                } else {
                    $element.val(power_user.instruct[control.property]).trigger('input');
                }
            }
        });
    });
}

export function formatInstructModeChat(name, mes, isUser, isNarrator, forceAvatar, name1, name2) {
    const includeNames = isNarrator ? false : (power_user.instruct.names || !!selected_group || !!forceAvatar);
    let sequence = (isUser || isNarrator) ? power_user.instruct.input_sequence : power_user.instruct.output_sequence;

    if (power_user.instruct.macro) {
        sequence = substituteParams(sequence, name1, name2);
    }

    const separator = power_user.instruct.wrap ? '\n' : '';
    const separatorSequence = power_user.instruct.separator_sequence && !isUser
        ? power_user.instruct.separator_sequence
        : (power_user.instruct.wrap ? '\n' : '');
    const textArray = includeNames ? [sequence, `${name}: ${mes}`, separatorSequence] : [sequence, mes, separatorSequence];
    const text = textArray.filter(x => x).join(separator);
    return text;
}

export function formatInstructStoryString(story, systemPrompt) {
    // If the character has a custom system prompt AND user has it preferred, use that instead of the default
    systemPrompt = power_user.prefer_character_prompt && systemPrompt ? systemPrompt : power_user.instruct.system_prompt;
    const sequence = power_user.instruct.system_sequence || '';
    const prompt = substituteParams(systemPrompt, name1, name2, power_user.instruct.system_prompt) || '';
    const separator = power_user.instruct.wrap ? '\n' : '';
    const textArray = [sequence, prompt + '\n' + story];
    const text = textArray.filter(x => x).join(separator);
    return text;
}

export function formatInstructModePrompt(name, isImpersonate, promptBias, name1, name2) {
    const includeNames = power_user.instruct.names || !!selected_group;
    let sequence = isImpersonate ? power_user.instruct.input_sequence : power_user.instruct.output_sequence;

    if (power_user.instruct.macro) {
        sequence = substituteParams(sequence, name1, name2);
    }

    const separator = power_user.instruct.wrap ? '\n' : '';
    let text = includeNames ? (separator + sequence + separator + `${name}:`) : (separator + sequence);

    if (!isImpersonate && promptBias) {
        text += (includeNames ? promptBias : (separator + promptBias));
    }

    return text.trimEnd();
}

const sortFunc = (a, b) => power_user.sort_order == 'asc' ? compareFunc(a, b) : compareFunc(b, a);
const compareFunc = (first, second) => {
    if (power_user.sort_order == 'random') {
        return Math.random() > 0.5 ? 1 : -1;
    }

    switch (power_user.sort_rule) {
        case 'boolean':
            const a = first[power_user.sort_field];
            const b = second[power_user.sort_field];
            if (a === true || a === 'true') return 1;  // Prioritize 'true' or true
            if (b === true || b === 'true') return -1; // Prioritize 'true' or true
            if (a && !b) return -1;        // Move truthy values to the end
            if (!a && b) return 1;         // Move falsy values to the beginning
            if (a === b) return 0;         // Sort equal values normally
            return a < b ? -1 : 1;         // Sort non-boolean values normally
        default:
            return typeof first[power_user.sort_field] == "string"
                ? first[power_user.sort_field].localeCompare(second[power_user.sort_field])
                : first[power_user.sort_field] - second[power_user.sort_field];
    }
};

function sortCharactersList() {
    const arr1 = groups.map(x => ({
        item: x,
        id: x.id,
        selector: '.group_select',
        attribute: 'grid',
    }))
    const arr2 = characters.map((x, index) => ({
        item: x,
        id: index,
        selector: '.character_select',
        attribute: 'chid',
    }));

    const array = [...arr1, ...arr2];

    if (power_user.sort_field == undefined || array.length === 0) {
        return;
    }

    let orderedList = array.slice().sort((a, b) => sortFunc(a.item, b.item));

    for (const item of array) {
        $(`${item.selector}[${item.attribute}="${item.id}"]`).css({ 'order': orderedList.indexOf(item) });
    }
    updateVisibleDivs('#rm_print_characters_block', true);
}

function sortGroupMembers(selector) {
    if (power_user.sort_field == undefined || characters.length === 0) {
        return;
    }

    let orderedList = characters.slice().sort(sortFunc);

    for (let i = 0; i < characters.length; i++) {
        $(`${selector}[chid="${i}"]`).css({ 'order': orderedList.indexOf(characters[i]) });
    }
}

async function saveTheme() {
    const name = await callPopup('Enter a theme preset name:', 'input');

    if (!name) {
        return;
    }

    const theme = {
        name,
        blur_strength: power_user.blur_strength,
        main_text_color: power_user.main_text_color,
        italics_text_color: power_user.italics_text_color,
        quote_text_color: power_user.quote_text_color,
        //fastui_bg_color: power_user.fastui_bg_color,
        blur_tint_color: power_user.blur_tint_color,
        user_mes_blur_tint_color: power_user.user_mes_blur_tint_color,
        bot_mes_blur_tint_color: power_user.bot_mes_blur_tint_color,
        shadow_color: power_user.shadow_color,
        shadow_width: power_user.shadow_width,
        font_scale: power_user.font_scale,
        fast_ui_mode: power_user.fast_ui_mode,
        waifuMode: power_user.waifuMode,
        avatar_style: power_user.avatar_style,
        chat_display: power_user.chat_display,
        noShadows: power_user.noShadows,
        chat_width: power_user.chat_width,
        timer_enabled: power_user.timer_enabled,
        timestamps_enabled: power_user.timestamps_enabled,
        mesIDDisplay_enabled: power_user.mesIDDisplay_enabled,
        hotswap_enabled: power_user.hotswap_enabled,

    };

    const response = await fetch('/savetheme', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(theme)
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
        movingUIState: power_user.movingUIState
    }
    console.log(movingUIPreset)

    const response = await fetch('/savemovingui', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(movingUIPreset)
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
        toastr.warning('failed to save MovingUI state.')
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
        'groupMemberListPopout'
    ];

    const panelStyles = ['top', 'left', 'right', 'bottom', 'height', 'width', 'margin',];

    panelIds.forEach((id) => {
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
    await delay(50)

    power_user.movingUIState = {};

    //if user manually resets panels, deselect the current preset
    if (type !== 'quiet' && type !== 'resize') {
        power_user.movingUIPreset = 'Default'
        $(`#movingUIPresets option[value="Default"]`).prop('selected', true);
    }

    saveSettingsDebounced();
    eventSource.emit(event_types.MOVABLE_PANELS_RESET);

    eventSource.once(event_types.SETTINGS_UPDATED, () => {
        $(".resizing").removeClass('resizing');
        //if happening as part of preset application, do it quietly.
        if (type === 'quiet') {
            return
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
        $("#option_start_new_chat").trigger('click');
    }, 1);
    //$("#dialogue_popup").hide();
    setTimeout(() => {
        $("#dialogue_popup_ok").trigger('click');
    }, 1);
}

function doRandomChat() {
    resetSelectedGroup();
    setCharacterId(Math.floor(Math.random() * characters.length));
    setTimeout(() => {
        reloadCurrentChat();
    }, 1);

}

async function doMesCut(_, text) {
    console.debug(`was asked to cut message id #${text}`)
    //reject invalid args or no args
    if (text && isNaN(text) || !text) {
        toastr.error(`Must enter a single number only, non-number characters disallowed.`)
        return
    }

    //reject attempts to delete firstmes
    if (text === '0') {
        toastr.error('Cannot delete the First Message')
        return
    }

    let mesIDToCut = Number(text).toFixed(0)
    let mesToCut = $("#chat").find(`.mes[mesid=${mesIDToCut}]`)

    if (!mesToCut.length) {
        toastr.error(`Could not find message with ID: ${mesIDToCut}`)
        return
    }

    setEditedMessageId(mesIDToCut);
    mesToCut.find('.mes_edit_delete').trigger('click', { fromSlashCommand: true });
}


async function doDelMode(_, text) {

    //first enter delmode
    $("#option_delete_mes").trigger('click')

    //reject invalid args
    if (text && isNaN(text)) {
        toastr.warning('Must enter a number or nothing.')
        await delay(300) //unsure why 300 is neccessary here, but any shorter and it wont see the delmode UI
        $("#dialogue_del_mes_cancel").trigger('click');
        return
    }

    //parse valid args
    if (text) {
        await delay(300) //same as above, need event signal for 'entered del mode'
        console.debug('parsing msgs to del')
        let numMesToDel = Number(text).toFixed(0)
        let lastMesID = $('.last_mes').attr('mesid')
        let oldestMesIDToDel = lastMesID - numMesToDel + 1;

        //disallow targeting first message
        if (oldestMesIDToDel <= 0) {
            oldestMesIDToDel = 1
        }

        let oldestMesToDel = $('#chat').find(`.mes[mesid=${oldestMesIDToDel}]`)
        let oldestDelMesCheckbox = $(oldestMesToDel).find('.del_checkbox');
        let newLastMesID = oldestMesIDToDel - 1;
        console.debug(`DelMesReport -- numMesToDel:  ${numMesToDel}, lastMesID: ${lastMesID}, oldestMesIDToDel:${oldestMesIDToDel}, newLastMesID: ${newLastMesID}`)
        oldestDelMesCheckbox.trigger('click');
        let trueNumberOfDeletedMessage = lastMesID - oldestMesIDToDel + 1

        //await delay(1)
        $('#dialogue_del_mes_ok').trigger('click');
        toastr.success(`Deleted ${trueNumberOfDeletedMessage} messages.`)
        return
    }
}

function doResetPanels() {
    $("#movingUIreset").trigger('click');
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
        $("#blur-tint-color-picker").attr('color', 'rgb(' + rgb.r + ',' + rgb.g + ',' + rgb.b + ')');

        const backgroundColorString = $("#blur-tint-color-picker").attr('color')
            .replace('rgba', '')
            .replace('rgb', '')
            .replace('(', '[')
            .replace(')', ']');   //[50, 120, 200, 1]; // Example background color
        const backgroundColorArray = JSON.parse(backgroundColorString) //[200, 200, 200, 1]
        console.log(backgroundColorArray)
        $("#main-text-color-picker").attr('color', getReadableTextColor(backgroundColorArray));
        console.log($("#main-text-color-picker").attr('color')); // Output: 'rgba(0, 47, 126, 1)'
    }

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

    function rgbToLuminance(r, g, b) {
        console.log(r, g, b)
        const gammaCorrect = (color) => {
            return color <= 0.03928
                ? color / 12.92
                : Math.pow((color + 0.055) / 1.055, 2.4);
        };

        const rsRGB = r / 255;
        const gsRGB = g / 255;
        const bsRGB = b / 255;

        const rLuminance = gammaCorrect(rsRGB).toFixed(2);
        const gLuminance = gammaCorrect(gsRGB).toFixed(2);
        const bLuminance = gammaCorrect(bsRGB).toFixed(2);

        console.log(`rLum ${rLuminance}, gLum ${gLuminance}, bLum ${bLuminance}`)

        return 0.2126 * rLuminance + 0.7152 * gLuminance + 0.0722 * bLuminance;
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

export function getCustomStoppingStrings() {
    try {
        // Parse the JSON string
        const strings = JSON.parse(power_user.custom_stopping_strings);

        // Make sure it's an array
        if (!Array.isArray(strings)) {
            return [];
        }

        // Make sure all the elements are strings
        return strings.filter((s) => typeof s === 'string');
    } catch (error) {
        // If there's an error, return an empty array
        console.warn('Error parsing custom stopping strings:', error);
        return [];
    }
}

$(document).ready(() => {

    $(window).on('resize', async () => {
        if (isMobile()) {
            return
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
    });

    // Settings that go to settings.json
    $("#collapse-newlines-checkbox").change(function () {
        power_user.collapse_newlines = !!$(this).prop("checked");
        saveSettingsDebounced();
    });

    $("#pygmalion_formatting").change(function (e) {
        power_user.pygmalion_formatting = Number($(this).find(":selected").val());
        getStatus();
        saveSettingsDebounced();
    });

    $("#pin-examples-checkbox").change(function () {
        power_user.pin_examples = !!$(this).prop("checked");
        saveSettingsDebounced();
    });

    $("#disable-description-formatting-checkbox").change(function () {
        power_user.disable_description_formatting = !!$(this).prop('checked');
        saveSettingsDebounced();
    })

    $("#disable-scenario-formatting-checkbox").change(function () {
        power_user.disable_scenario_formatting = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $("#disable-personality-formatting-checkbox").change(function () {
        power_user.disable_personality_formatting = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $("#disable-examples-formatting-checkbox").change(function () {
        power_user.disable_examples_formatting = !!$(this).prop('checked');
        saveSettingsDebounced();
    })

    $("#disable-start-formatting-checkbox").change(function () {
        power_user.disable_start_formatting = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    // include newline is the child of trim sentences
    // if include newline is checked, trim sentences must be checked
    // if trim sentences is unchecked, include newline must be unchecked
    $("#trim_sentences_checkbox").change(function () {
        power_user.trim_sentences = !!$(this).prop("checked");
        if (!$(this).prop("checked")) {
            $("#include_newline_checkbox").prop("checked", false);
            power_user.include_newline = false;
        }
        saveSettingsDebounced();
    });

    $("#include_newline_checkbox").change(function () {
        power_user.include_newline = !!$(this).prop("checked");
        if ($(this).prop("checked")) {
            $("#trim_sentences_checkbox").prop("checked", true);
            power_user.trim_sentences = true;
        }
        saveSettingsDebounced();
    });

    $("#always-force-name2-checkbox").change(function () {
        power_user.always_force_name2 = !!$(this).prop("checked");
        saveSettingsDebounced();
    });

    $("#custom_chat_separator").on('input', function () {
        power_user.custom_chat_separator = $(this).val();
        saveSettingsDebounced();
        reloadMarkdownProcessor(power_user.render_formulas);
    });

    $("#markdown_escape_strings").on('input', function () {
        power_user.markdown_escape_strings = $(this).val();
        saveSettingsDebounced();
        reloadMarkdownProcessor(power_user.render_formulas);
    });

    $("#start_reply_with").on('input', function () {
        power_user.user_prompt_bias = $(this).val();
        saveSettingsDebounced();
    });

    $("#chat-show-reply-prefix-checkbox").change(function () {
        power_user.show_user_prompt_bias = !!$(this).prop("checked");
        reloadCurrentChat();
        saveSettingsDebounced();
    })

    $("#multigen").change(function () {
        power_user.multigen = $(this).prop("checked");
        saveSettingsDebounced();
    });

    // Settings that go to local storage
    $("#fast_ui_mode").change(function () {
        power_user.fast_ui_mode = $(this).prop("checked");
        localStorage.setItem(storage_keys.fast_ui_mode, power_user.fast_ui_mode);
        switchUiMode();
    });

    $("#waifuMode").on('change', () => {
        power_user.waifuMode = $('#waifuMode').prop("checked");
        saveSettingsDebounced();
        switchWaifuMode();
    });

    $("#movingUImode").change(function () {
        power_user.movingUI = $(this).prop("checked");
        localStorage.setItem(storage_keys.movingUI, power_user.movingUI);
        switchMovingUI();
    });

    $("#noShadowsmode").change(function () {
        power_user.noShadows = $(this).prop("checked");
        localStorage.setItem(storage_keys.noShadows, power_user.noShadows);
        noShadows();
    });

    $("#movingUIreset").on('click', resetMovablePanels);

    $(`input[name="avatar_style"]`).on('input', function (e) {
        power_user.avatar_style = Number(e.target.value);
        localStorage.setItem(storage_keys.avatar_style, power_user.avatar_style);
        applyAvatarStyle();
    });

    $("#chat_display").on('change', function () {
        console.debug('###CHAT DISPLAY SELECTOR CHANGE###')
        const value = $(this).find(':selected').val();
        power_user.chat_display = Number(value);
        saveSettingsDebounced();
        applyChatDisplay();

    });

    $('#chat_width_slider').on('input', function (e) {
        power_user.chat_width = Number(e.target.value);
        localStorage.setItem(storage_keys.chat_width, power_user.chat_width);
        applyChatWidth();
    });

    $(`input[name="font_scale"]`).on('input', async function (e) {
        power_user.font_scale = Number(e.target.value);
        $("#font_scale_counter").text(power_user.font_scale);
        localStorage.setItem(storage_keys.font_scale, power_user.font_scale);
        await applyFontScale();
    });

    $(`input[name="blur_strength"]`).on('input', async function (e) {
        power_user.blur_strength = Number(e.target.value);
        $("#blur_strength_counter").text(power_user.blur_strength);
        localStorage.setItem(storage_keys.blur_strength, power_user.blur_strength);
        await applyBlurStrength();
    });

    $(`input[name="shadow_width"]`).on('input', async function (e) {
        power_user.shadow_width = Number(e.target.value);
        $("#shadow_width_counter").text(power_user.shadow_width);
        localStorage.setItem(storage_keys.shadow_width, power_user.shadow_width);
        await applyShadowWidth();
    });

    $("#main-text-color-picker").on('change', (evt) => {
        power_user.main_text_color = evt.detail.rgba;
        applyThemeColor('main');
        saveSettingsDebounced();
    });

    $("#italics-color-picker").on('change', (evt) => {
        power_user.italics_text_color = evt.detail.rgba;
        applyThemeColor('italics');
        saveSettingsDebounced();
    });

    $("#quote-color-picker").on('change', (evt) => {
        power_user.quote_text_color = evt.detail.rgba;
        applyThemeColor('quote');
        saveSettingsDebounced();
    });

    $("#blur-tint-color-picker").on('change', (evt) => {
        power_user.blur_tint_color = evt.detail.rgba;
        applyThemeColor('blurTint');
        saveSettingsDebounced();
    });

    $("#user-mes-blur-tint-color-picker").on('change', (evt) => {
        power_user.user_mes_blur_tint_color = evt.detail.rgba;
        applyThemeColor('userMesBlurTint');
        saveSettingsDebounced();
    });

    $("#bot-mes-blur-tint-color-picker").on('change', (evt) => {
        power_user.bot_mes_blur_tint_color = evt.detail.rgba;
        applyThemeColor('botMesBlurTint');
        saveSettingsDebounced();
    });

    $("#shadow-color-picker").on('change', (evt) => {
        power_user.shadow_color = evt.detail.rgba;
        applyThemeColor('shadow');
        saveSettingsDebounced();
    });

    $("#themes").on('change', function () {
        const themeSelected = $(this).find(':selected').val();
        power_user.theme = themeSelected;
        applyTheme(themeSelected);
        saveSettingsDebounced();
    });

    $("#movingUIPresets").on('change', async function () {
        console.log('saw MUI preset change')
        const movingUIPresetSelected = $(this).find(':selected').val();
        power_user.movingUIPreset = movingUIPresetSelected;
        applyMovingUIPreset(movingUIPresetSelected);
        saveSettingsDebounced();

    });

    $("#ui-preset-save-button").on('click', saveTheme);
    $("#movingui-preset-save-button").on('click', saveMovingUI);

    $("#never_resize_avatars").on('input', function () {
        power_user.never_resize_avatars = !!$(this).prop('checked');
        saveSettingsDebounced();
    });
    $("#show_card_avatar_urls").on('input', function () {
        power_user.show_card_avatar_urls = !!$(this).prop('checked');
        printCharacters();
        saveSettingsDebounced();
    });

    $("#play_message_sound").on('input', function () {
        power_user.play_message_sound = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $("#play_sound_unfocused").on('input', function () {
        power_user.play_sound_unfocused = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $("#auto_save_msg_edits").on('input', function () {
        power_user.auto_save_msg_edits = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $("#character_sort_order").on('change', function () {
        power_user.sort_field = $(this).find(":selected").data('field');
        power_user.sort_order = $(this).find(":selected").data('order');
        power_user.sort_rule = $(this).find(":selected").data('rule');
        sortCharactersList();
        favsToHotswap();
        saveSettingsDebounced();
    });

    $("#multigen_first_chunk").on('input', function () {
        power_user.multigen_first_chunk = Number($(this).val());
        saveSettingsDebounced();
    });

    $("#multigen_next_chunks").on('input', function () {
        power_user.multigen_next_chunks = Number($(this).val());
        saveSettingsDebounced();
    });

    $('#auto_swipe').on('input', function () {
        power_user.auto_swipe = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#auto_swipe_blacklist').on('input', function () {
        power_user.auto_swipe_blacklist = $(this).val()
            .split(",")
            .map(str => str.trim())
            .filter(str => str);
        console.log("power_user.auto_swipe_blacklist", power_user.auto_swipe_blacklist)
        saveSettingsDebounced();
    });

    $('#auto_swipe_minimum_length').on('input', function () {
        const number = parseInt($(this).val());
        if (!isNaN(number)) {
            power_user.auto_swipe_minimum_length = number;
            saveSettingsDebounced();
        }
    });

    $('#auto_swipe_blacklist_threshold').on('input', function () {
        const number = parseInt($(this).val());
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

    $("#console_log_prompts").on('input', function () {
        power_user.console_log_prompts = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $('#auto_scroll_chat_to_bottom').on("input", function () {
        power_user.auto_scroll_chat_to_bottom = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $("#tokenizer").on('change', function () {
        const value = $(this).find(':selected').val();
        power_user.tokenizer = Number(value);
        saveSettingsDebounced();

        // Trigger character editor re-tokenize
        $("#rm_ch_create_block").trigger('input');
        $("#character_popup").trigger('input');
    });

    $("#send_on_enter").on('change', function () {
        const value = $(this).find(':selected').val();
        power_user.send_on_enter = Number(value);
        saveSettingsDebounced();
    });

    $("#import_card_tags").on('input', function () {
        power_user.import_card_tags = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $("#confirm_message_delete").on('input', function () {
        power_user.confirm_message_delete = !!$(this).prop('checked');
        saveSettingsDebounced();
    });

    $("#render_formulas").on("input", function () {
        power_user.render_formulas = !!$(this).prop('checked');
        reloadMarkdownProcessor(power_user.render_formulas);
        reloadCurrentChat();
        saveSettingsDebounced();
    });

    $("#reload_chat").on('click', function () {
        const currentChatId = getCurrentChatId();
        if (currentChatId !== undefined && currentChatId !== null) {
            reloadCurrentChat();
        }
    });

    $("#allow_name1_display").on("input", function () {
        power_user.allow_name1_display = !!$(this).prop('checked');
        reloadCurrentChat();
        saveSettingsDebounced();
    })

    $("#allow_name2_display").on("input", function () {
        power_user.allow_name2_display = !!$(this).prop('checked');
        reloadCurrentChat();
        saveSettingsDebounced();
    });

    /*     $("#removeXML").on("input", function () {
            power_user.removeXML = !!$(this).prop('checked');
            reloadCurrentChat();
            saveSettingsDebounced();
        }); */

    $("#token_padding").on("input", function () {
        power_user.token_padding = Number($(this).val());
        saveSettingsDebounced();
    });

    $("#messageTimerEnabled").on("input", function () {
        const value = !!$(this).prop('checked');
        power_user.timer_enabled = value;
        localStorage.setItem(storage_keys.timer_enabled, power_user.timer_enabled);
        switchTimer();
    });

    $("#messageTimestampsEnabled").on("input", function () {
        const value = !!$(this).prop('checked');
        power_user.timestamps_enabled = value;
        localStorage.setItem(storage_keys.timestamps_enabled, power_user.timestamps_enabled);
        switchTimestamps();
    });

    $("#mesIDDisplayEnabled").on("input", function () {
        const value = !!$(this).prop('checked');
        power_user.mesIDDisplay_enabled = value;
        localStorage.setItem(storage_keys.mesIDDisplay_enabled, power_user.mesIDDisplay_enabled);
        switchMesIDDisplay();
    });

    $("#hotswapEnabled").on("input", function () {
        const value = !!$(this).prop('checked');
        power_user.hotswap_enabled = value;
        localStorage.setItem(storage_keys.hotswap_enabled, power_user.hotswap_enabled);
        switchHotswap();
    });

    $("#prefer_character_prompt").on("input", function () {
        const value = !!$(this).prop('checked');
        power_user.prefer_character_prompt = value;
        saveSettingsDebounced();
    });

    $("#prefer_character_jailbreak").on("input", function () {
        const value = !!$(this).prop('checked');
        power_user.prefer_character_jailbreak = value;
        saveSettingsDebounced();
    });

    $("#continue_on_send").on("input", function () {
        const value = !!$(this).prop('checked');
        power_user.continue_on_send = value;
        saveSettingsDebounced();
    });

    $("#trim_spaces").on("input", function () {
        const value = !!$(this).prop('checked');
        power_user.trim_spaces = value;
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
        power_user.custom_stopping_strings = $(this).val();
        saveSettingsDebounced();
    });

    $(window).on('focus', function () {
        browser_has_focus = true;
    });

    $(window).on('blur', function () {
        browser_has_focus = false;
    });

    registerSlashCommand('vn', toggleWaifu, [], ' – swaps Visual Novel Mode On/Off', false, true);
    registerSlashCommand('newchat', doNewChat, ['newchat'], ' – start a new chat with current character', true, true);
    registerSlashCommand('random', doRandomChat, ['random'], ' – start a new chat with a random character', true, true);
    registerSlashCommand('delmode', doDelMode, ['del'], '<span class="monospace">(optional number)</span> – enter message deletion mode, and auto-deletes N messages if numeric argument is provided', true, true);
    registerSlashCommand('cut', doMesCut, [], ' <span class="monospace">(requred number)</span> – cuts the specified message from the chat', true, true);
    registerSlashCommand('resetpanels', doResetPanels, ['resetui'], ' – resets UI panels to original state.', true, true);
    registerSlashCommand('bgcol', setAvgBG, [], ' – WIP test of auto-bg avg coloring', true, true);
});
