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
} from "../script.js";
import { favsToHotswap } from "./RossAscends-mods.js";
import {
    groups,
    selected_group,
} from "./group-chats.js";

export {
    loadPowerUserSettings,
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

const chat_styles = {
    DEFAULT: 0,
    BUBBLES: 1,
}

const sheld_width = {
    DEFAULT: 0,
    w1000px: 1,
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
}

const send_on_enter_options = {
    DISABLED: -1,
    AUTO: 0,
    ENABLED: 1,
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
    multigen: false,
    multigen_first_chunk: 50,
    multigen_next_chunks: 30,
    custom_chat_separator: '',
    fast_ui_mode: true,
    avatar_style: avatar_styles.ROUND,
    chat_display: chat_styles.DEFAULT,
    sheld_width: sheld_width.DEFAULT,
    play_message_sound: false,
    play_sound_unfocused: true,
    auto_save_msg_edits: false,
    sort_field: 'name',
    sort_order: 'asc',
    sort_rule: null,
    font_scale: 1,
    blur_strength: 10,
    shadow_width: 2,

    main_text_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeBodyColor').trim()}`,
    italics_text_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeEmColor').trim()}`,
    quote_text_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeQuoteColor').trim()}`,
    fastui_bg_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeFastUIBGColor').trim()}`,
    blur_tint_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeBlurTintColor').trim()}`,
    shadow_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeShadowColor').trim()}`,

    waifuMode: false,
    movingUI: false,
    noShadows: false,
    theme: 'Default (Dark)',

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
    max_context_unlocked: false,

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
    }
};

let themes = [];
let instruct_presets = [];

const storage_keys = {
    fast_ui_mode: "TavernAI_fast_ui_mode",
    avatar_style: "TavernAI_avatar_style",
    chat_display: "TavernAI_chat_display",
    sheld_width: "TavernAI_sheld_width",
    font_scale: "TavernAI_font_scale",

    main_text_color: "TavernAI_main_text_color",
    italics_text_color: "TavernAI_italics_text_color",
    quote_text_color: "TavernAI_quote_text_color",
    fastui_bg_color: "TavernAI_fastui_bg_color",
    blur_tint_color: "TavernAI_blur_tint_color",
    blur_strength: "TavernAI_blur_strength",
    shadow_color: "TavernAI_shadow_color",
    shadow_width: "TavernAI_shadow_width",

    waifuMode: "TavernAI_waifuMode",
    movingUI: "TavernAI_movingUI",
    noShadows: "TavernAI_noShadows",

    hotswap_enabled: 'HotswapEnabled',
    timer_enabled: 'TimerEnabled',
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

function switchUiMode() {
    const fastUi = localStorage.getItem(storage_keys.fast_ui_mode);
    power_user.fast_ui_mode = fastUi === null ? true : fastUi == "true";
    $("body").toggleClass("no-blur", power_user.fast_ui_mode);
    $("#fast_ui_mode").prop("checked", power_user.fast_ui_mode);
}

function switchWaifuMode() {
    const waifuMode = localStorage.getItem(storage_keys.waifuMode);
    power_user.waifuMode = waifuMode === null ? false : waifuMode == "true";
    $("body").toggleClass("waifuMode", power_user.waifuMode);
    $("#waifuMode").prop("checked", power_user.waifuMode);
    scrollChatToBottom();
}

function switchMovingUI() {
    const movingUI = localStorage.getItem(storage_keys.movingUI);
    power_user.movingUI = movingUI === null ? false : movingUI == "true";
    $("body").toggleClass("movingUI", power_user.movingUI);
    scrollChatToBottom();
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
    power_user.chat_display = Number(localStorage.getItem(storage_keys.chat_display) ?? chat_styles.DEFAULT);
    $("body").toggleClass("bubblechat", power_user.chat_display === chat_styles.BUBBLES);
    $(`input[name="chat_display"][value="${power_user.chat_display}"]`).prop("checked", true);

}

function applySheldWidth() {
    power_user.sheld_width = Number(localStorage.getItem(storage_keys.sheld_width) ?? chat_styles.DEFAULT);
    $("body").toggleClass("w1000px", power_user.sheld_width === sheld_width.w1000px);
    let r = document.documentElement;
    if (power_user.sheld_width === 1) {
        r.style.setProperty('--sheldWidth', '1000px');
    } else {
        r.style.setProperty('--sheldWidth', '800px');
    }
    $(`input[name="sheld_width"][value="${power_user.sheld_width}"]`).prop("checked", true);
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
    if (type === 'fastUIBG') {
        document.documentElement.style.setProperty('--SmartThemeFastUIBGColor', power_user.fastui_bg_color);
    }
    if (type === 'blurTint') {
        document.documentElement.style.setProperty('--SmartThemeBlurTintColor', power_user.blur_tint_color);
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
        { key: 'fastui_bg_color', selector: '#fastui-bg-color-picker', type: 'fastUIBG' },
        { key: 'blur_tint_color', selector: '#blur-tint-color-picker', type: 'blurTint' },
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
            key: 'sheld_width',
            action: async () => {
                localStorage.setItem(storage_keys.sheld_width, power_user.sheld_width);
                applySheldWidth();
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
        }
    }

    console.log('theme applied: ' + name);
}

switchUiMode();
applyFontScale();
applyThemeColor();
applySheldWidth();
applyAvatarStyle();
applyBlurStrength();
applyShadowWidth();
applyChatDisplay();
switchWaifuMode()
switchMovingUI();
noShadows();
switchHotswap();
switchTimer();

function loadPowerUserSettings(settings, data) {
    // Load from settings.json
    if (settings.power_user !== undefined) {
        Object.assign(power_user, settings.power_user);
    }

    if (data.themes !== undefined) {
        themes = data.themes;
    }

    if (data.instruct !== undefined) {
        instruct_presets = data.instruct;
    }

    // These are still local storage
    const fastUi = localStorage.getItem(storage_keys.fast_ui_mode);
    const waifuMode = localStorage.getItem(storage_keys.waifuMode);
    const movingUI = localStorage.getItem(storage_keys.movingUI);
    const noShadows = localStorage.getItem(storage_keys.noShadows);
    const hotswap = localStorage.getItem(storage_keys.hotswap_enabled);
    const timer = localStorage.getItem(storage_keys.timer_enabled);
    power_user.fast_ui_mode = fastUi === null ? true : fastUi == "true";
    power_user.waifuMode = waifuMode === null ? false : waifuMode == "true";
    power_user.movingUI = movingUI === null ? false : movingUI == "true";
    power_user.noShadows = noShadows === null ? false : noShadows == "true";
    power_user.hotswap_enabled = hotswap === null ? true : hotswap == "true";
    power_user.timer_enabled = timer === null ? true : timer == "true";
    power_user.avatar_style = Number(localStorage.getItem(storage_keys.avatar_style) ?? avatar_styles.ROUND);
    power_user.chat_display = Number(localStorage.getItem(storage_keys.chat_display) ?? chat_styles.DEFAULT);
    power_user.sheld_width = Number(localStorage.getItem(storage_keys.sheld_width) ?? sheld_width.DEFAULT);
    power_user.font_scale = Number(localStorage.getItem(storage_keys.font_scale) ?? 1);
    power_user.blur_strength = Number(localStorage.getItem(storage_keys.blur_strength) ?? 10);

    $('#auto_swipe').prop("checked", power_user.auto_swipe);
    $('#auto_swipe_minimum_length').val(power_user.auto_swipe_minimum_length);
    $('#auto_swipe_blacklist').val(power_user.auto_swipe_blacklist.join(", "));
    $('#auto_swipe_blacklist_threshold').val(power_user.auto_swipe_blacklist_threshold);

    $("#console_log_prompts").prop("checked", power_user.console_log_prompts);
    $('#auto_fix_generated_markdown').prop("checked", power_user.auto_fix_generated_markdown);
    $('#auto_scroll_chat_to_bottom').prop("checked", power_user.auto_scroll_chat_to_bottom);
    $(`#tokenizer option[value="${power_user.tokenizer}"]`).attr('selected', true);
    $(`#pygmalion_formatting option[value=${power_user.pygmalion_formatting}]`).attr("selected", true);
    $(`#send_on_enter option[value=${power_user.send_on_enter}]`).attr("selected", true);
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
    $("#fast_ui_mode").prop("checked", power_user.fast_ui_mode);
    $("#waifuMode").prop("checked", power_user.waifuMode);
    $("#movingUImode").prop("checked", power_user.movingUI);
    $("#noShadowsmode").prop("checked", power_user.noShadows);
    $("#multigen").prop("checked", power_user.multigen);
    $("#multigen_first_chunk").val(power_user.multigen_first_chunk);
    $("#multigen_next_chunks").val(power_user.multigen_next_chunks);
    $("#play_message_sound").prop("checked", power_user.play_message_sound);
    $("#play_sound_unfocused").prop("checked", power_user.play_sound_unfocused);
    $("#auto_save_msg_edits").prop("checked", power_user.auto_save_msg_edits);
    $("#allow_name1_display").prop("checked", power_user.allow_name1_display);
    $("#allow_name2_display").prop("checked", power_user.allow_name2_display);
    $("#hotswapEnabled").prop("checked", power_user.hotswap_enabled);
    $("#messageTimerEnabled").prop("checked", power_user.timer_enabled);
    $(`input[name="avatar_style"][value="${power_user.avatar_style}"]`).prop("checked", true);
    $(`input[name="chat_display"][value="${power_user.chat_display}"]`).prop("checked", true);
    $(`input[name="sheld_width"][value="${power_user.sheld_width}"]`).prop("checked", true);
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
    $("#fastui-bg-color-picker").attr('color', power_user.fastui_bg_color);
    $("#blur-tint-color-picker").attr('color', power_user.blur_tint_color);
    $("#shadow-color-picker").attr('color', power_user.shadow_color);

    for (const theme of themes) {
        const option = document.createElement('option');
        option.value = theme.name;
        option.innerText = theme.name;
        option.selected = theme.name == power_user.theme;
        $("#themes").append(option);
    }

    $(`#character_sort_order option[data-order="${power_user.sort_order}"][data-field="${power_user.sort_field}"]`).prop("selected", true);
    sortCharactersList();
    reloadMarkdownProcessor(power_user.render_formulas);
    loadInstructMode();
    loadMaxContextUnlocked();
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
    const sequence = substituteParams(
        (isUser || isNarrator) ? power_user.instruct.input_sequence : power_user.instruct.output_sequence,
        name1,
        name2
    );

    const separator = power_user.instruct.wrap ? '\n' : '';
    const separatorSequence = power_user.instruct.separator_sequence && !isUser
        ? power_user.instruct.separator_sequence
        : (power_user.instruct.wrap ? '\n' : '');
    const textArray = includeNames ? [sequence, `${name}: ${mes}`, separatorSequence] : [sequence, mes, separatorSequence];
    const text = textArray.filter(x => x).join(separator);
    return text;
}

export function formatInstructStoryString(story) {
    const sequence = power_user.instruct.system_sequence || '';
    const prompt = substituteParams(power_user.instruct.system_prompt) || '';
    const separator = power_user.instruct.wrap ? '\n' : '';
    const textArray = [sequence, prompt, story, separator];
    const text = textArray.filter(x => x).join(separator);
    return text;
}

export function formatInstructModePrompt(name, isImpersonate, promptBias, name1, name2) {
    const includeNames = power_user.instruct.names || !!selected_group;
    const sequence = substituteParams(
        isImpersonate ? power_user.instruct.input_sequence : power_user.instruct.output_sequence,
        name1,
        name2
    );

    const separator = power_user.instruct.wrap ? '\n' : '';
    let text = includeNames ? (separator + sequence + separator + `${name}:`) : (separator + sequence);

    if (!isImpersonate && promptBias) {
        text += (includeNames ? promptBias : (separator + promptBias));
    }

    return text.trimEnd();
}

const sortFunc = (a, b) => power_user.sort_order == 'asc' ? compareFunc(a, b) : compareFunc(b, a);
const compareFunc = (first, second) => {
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
    updateVisibleDivs();
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
        fastui_bg_color: power_user.fastui_bg_color,
        blur_tint_color: power_user.blur_tint_color,
        shadow_color: power_user.shadow_color,
        shadow_width: power_user.shadow_width,
        font_scale: power_user.font_scale,
        fast_ui_mode: power_user.fast_ui_mode,
        waifuMode: power_user.waifuMode,
        avatar_style: power_user.avatar_style,
        chat_display: power_user.chat_display,
        noShadows: power_user.noShadows,
        sheld_width: power_user.sheld_width,
        timer_enabled: power_user.timer_enabled,
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

function resetMovablePanels() {
    document.getElementById("sheld").style.top = '';
    document.getElementById("sheld").style.left = '';
    document.getElementById("sheld").style.bottom = '';
    document.getElementById("sheld").style.right = '';
    document.getElementById("sheld").style.height = '';
    document.getElementById("sheld").style.width = '';
    document.getElementById("sheld").style.margin = '';


    document.getElementById("left-nav-panel").style.top = '';
    document.getElementById("left-nav-panel").style.left = '';
    document.getElementById("left-nav-panel").style.height = '';
    document.getElementById("left-nav-panel").style.width = '';
    document.getElementById("left-nav-panel").style.margin = '';

    document.getElementById("right-nav-panel").style.top = '';
    document.getElementById("right-nav-panel").style.left = '';
    document.getElementById("right-nav-panel").style.right = '';
    document.getElementById("right-nav-panel").style.height = '';
    document.getElementById("right-nav-panel").style.width = '';
    document.getElementById("right-nav-panel").style.margin = '';

    document.getElementById("expression-holder").style.top = '';
    document.getElementById("expression-holder").style.left = '';
    document.getElementById("expression-holder").style.right = '';
    document.getElementById("expression-holder").style.bottom = '';
    document.getElementById("expression-holder").style.height = '';
    document.getElementById("expression-holder").style.width = '';
    document.getElementById("expression-holder").style.margin = '';

    document.getElementById("avatar_zoom_popup").style.top = '';
    document.getElementById("avatar_zoom_popup").style.left = '';
    document.getElementById("avatar_zoom_popup").style.right = '';
    document.getElementById("avatar_zoom_popup").style.bottom = '';
    document.getElementById("avatar_zoom_popup").style.height = '';
    document.getElementById("avatar_zoom_popup").style.width = '';
    document.getElementById("avatar_zoom_popup").style.margin = '';

    document.getElementById("WorldInfo").style.top = '';
    document.getElementById("WorldInfo").style.left = '';
    document.getElementById("WorldInfo").style.right = '';
    document.getElementById("WorldInfo").style.bottom = '';
    document.getElementById("WorldInfo").style.height = '';
    document.getElementById("WorldInfo").style.width = '';
    document.getElementById("WorldInfo").style.margin = '';
}

$(document).ready(() => {
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
    });

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

    $("#waifuMode").change(function () {
        power_user.waifuMode = $(this).prop("checked");
        localStorage.setItem(storage_keys.waifuMode, power_user.waifuMode);
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

    $(`input[name="chat_display"]`).on('input', function (e) {
        power_user.chat_display = Number(e.target.value);
        localStorage.setItem(storage_keys.chat_display, power_user.chat_display);
        applyChatDisplay();
    });

    $(`input[name="sheld_width"]`).on('input', function (e) {
        power_user.sheld_width = Number(e.target.value);
        localStorage.setItem(storage_keys.sheld_width, power_user.sheld_width);
        //console.log("sheld width changing now");
        applySheldWidth();
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

    $("#fastui-bg-color-picker").on('change', (evt) => {
        power_user.fastui_bg_color = evt.detail.rgba;
        applyThemeColor('fastUIBG');
        saveSettingsDebounced();
    });

    $("#blur-tint-color-picker").on('change', (evt) => {
        power_user.blur_tint_color = evt.detail.rgba;
        applyThemeColor('blurTint');
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

    $("#ui-preset-save-button").on('click', saveTheme);

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

    $("#render_formulas").on("input", function () {
        power_user.render_formulas = !!$(this).prop('checked');
        reloadMarkdownProcessor(power_user.render_formulas);
        reloadCurrentChat();
        saveSettingsDebounced();
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

    $("#hotswapEnabled").on("input", function () {
        const value = !!$(this).prop('checked');
        power_user.hotswap_enabled = value;
        localStorage.setItem(storage_keys.hotswap_enabled, power_user.hotswap_enabled);
        switchHotswap();
    });

    $(window).on('focus', function () {
        browser_has_focus = true;
    });

    $(window).on('blur', function () {
        browser_has_focus = false;
    });
});
