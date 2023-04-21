import {
    saveSettingsDebounced,
    scrollChatToBottom,
    characters,
    callPopup,
    token,
    getStatus,
} from "../script.js";
import { delay } from "./utils.js";


export {
    loadPowerUserSettings,
    collapseNewlines,
    playMessageSound,
    sortCharactersList,
    power_user,
    pygmalion_options,
};

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

let power_user = {
    collapse_newlines: false,
    pygmalion_formatting: pygmalion_options.AUTO,
    pin_examples: false,
    disable_description_formatting: false,
    disable_scenario_formatting: false,
    disable_personality_formatting: false,
    disable_examples_formatting: false,
    disable_start_formatting: false,
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
    font_scale: 1,
    blur_strength: 10,

    main_text_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeBodyColor').trim()}`,
    italics_text_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeEmColor').trim()}`,
    fastui_bg_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeFastUIBGColor').trim()}`,
    blur_tint_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeBlurTintColor').trim()}`,

    waifuMode: false,
    movingUI: false,
    theme: 'Default (Dark)',
};

let themes = [];

const storage_keys = {
    fast_ui_mode: "TavernAI_fast_ui_mode",
    avatar_style: "TavernAI_avatar_style",
    chat_display: "TavernAI_chat_display",
    sheld_width: "TavernAI_sheld_width",
    font_scale: "TavernAI_font_scale",

    main_text_color: "TavernAI_main_text_color",
    italics_text_color: "TavernAI_italics_text_color",
    fastui_bg_color: "TavernAI_fastui_bg_color",
    blur_tint_color: "TavernAI_blur_tint_color",
    blur_strength: "TavernAI_blur_strength",

    waifuMode: "TavernAI_waifuMode",
    movingUI: "TavernAI_movingUI",
};

const chat = document.getElementById('chat');
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

function switchUiMode() {
    const fastUi = localStorage.getItem(storage_keys.fast_ui_mode);
    power_user.fast_ui_mode = fastUi === null ? true : fastUi == "true";
    $("body").toggleClass("no-blur", power_user.fast_ui_mode);
}

function switchWaifuMode() {
    const waifuMode = localStorage.getItem(storage_keys.waifuMode);
    power_user.waifuMode = waifuMode === null ? false : waifuMode == "true";
    $("body").toggleClass("waifuMode", power_user.waifuMode);
    scrollChatToBottom();
}

function switchMovingUI() {
    const movingUI = localStorage.getItem(storage_keys.movingUI);
    power_user.movingUI = movingUI === null ? false : movingUI == "true";
    $("body").toggleClass("movingUI", power_user.movingUI);
    scrollChatToBottom();
}

function applyAvatarStyle() {
    power_user.avatar_style = Number(localStorage.getItem(storage_keys.avatar_style) ?? avatar_styles.ROUND);
    $("body").toggleClass("big-avatars", power_user.avatar_style === avatar_styles.RECTANGULAR);
}

function applyChatDisplay() {
    power_user.chat_display = Number(localStorage.getItem(storage_keys.chat_display) ?? chat_styles.DEFAULT);
    $("body").toggleClass("bubblechat", power_user.chat_display === chat_styles.BUBBLES);
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
}

async function applyThemeColor(type) {
    if (type === 'main') {
        document.documentElement.style.setProperty('--SmartThemeBodyColor', power_user.main_text_color);
    }
    if (type === 'italics') {
        document.documentElement.style.setProperty('--SmartThemeEmColor', power_user.italics_text_color);
    }
    if (type === 'fastUIBG') {
        document.documentElement.style.setProperty('--SmartThemeFastUIBGColor', power_user.fastui_bg_color);
    }
    if (type === 'blurTint') {
        document.documentElement.style.setProperty('--SmartThemeBlurTintColor', power_user.blur_tint_color);
    }
}

async function applyBlurStrength() {
    power_user.blur_strength = Number(localStorage.getItem(storage_keys.blur_strength) ?? 1);
    document.documentElement.style.setProperty('--blurStrength', power_user.blur_strength);
    $("#blur_strength_counter").text(power_user.blur_strength);

}


async function applyFontScale() {
    power_user.font_scale = Number(localStorage.getItem(storage_keys.font_scale) ?? 1);
    document.documentElement.style.setProperty('--fontScale', power_user.font_scale);
    $("#font_scale_counter").text(power_user.font_scale);
}

async function applyTheme(name) {
    const theme = themes.find(x => x.name == name);

    if (!theme) {
        return;
    }

    const themeProperties = [
        { key: 'main_text_color', selector: '#main-text-color-picker', type: 'main' },
        { key: 'italics_text_color', selector: '#italics-color-picker', type: 'italics' },
        { key: 'fastui_bg_color', selector: '#fastui-bg-color-picker', type: 'fastUIBG' },
        { key: 'blur_tint_color', selector: '#blur-tint-color-picker', type: 'blurTint' },
        {
            key: 'blur_strength',
            action: async () => {
                localStorage.setItem(storage_keys.blur_strength, power_user.blur_strength);
                await applyBlurStrength();
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
applyChatDisplay();
switchWaifuMode()
switchMovingUI();

function loadPowerUserSettings(settings, data) {
    // Load from settings.json
    if (settings.power_user !== undefined) {
        Object.assign(power_user, settings.power_user);
    }

    if (data.themes !== undefined) {
        themes = data.themes;
    }

    // These are still local storage
    const fastUi = localStorage.getItem(storage_keys.fast_ui_mode);
    const waifuMode = localStorage.getItem(storage_keys.waifuMode);
    const movingUI = localStorage.getItem(storage_keys.movingUI);
    power_user.fast_ui_mode = fastUi === null ? true : fastUi == "true";
    power_user.waifuMode = waifuMode === null ? false : waifuMode == "true";
    power_user.movingUI = movingUI === null ? false : movingUI == "true";
    power_user.avatar_style = Number(localStorage.getItem(storage_keys.avatar_style) ?? avatar_styles.ROUND);
    power_user.chat_display = Number(localStorage.getItem(storage_keys.chat_display) ?? chat_styles.DEFAULT);
    power_user.sheld_width = Number(localStorage.getItem(storage_keys.sheld_width) ?? sheld_width.DEFAULT);
    power_user.font_scale = Number(localStorage.getItem(storage_keys.font_scale) ?? 1);
    power_user.blur_strength = Number(localStorage.getItem(storage_keys.blur_strength) ?? 10);

    $(`#pygmalion_formatting option[value=${power_user.pygmalion_formatting}]`).attr("selected", true);
    $("#collapse-newlines-checkbox").prop("checked", power_user.collapse_newlines);
    $("#pin-examples-checkbox").prop("checked", power_user.pin_examples);
    $("#disable-description-formatting-checkbox").prop("checked", power_user.disable_description_formatting);
    $("#disable-scenario-formatting-checkbox").prop("checked", power_user.disable_scenario_formatting);
    $("#disable-personality-formatting-checkbox").prop("checked", power_user.disable_personality_formatting);
    $("#always-force-name2-checkbox").prop("checked", power_user.always_force_name2);
    $("#disable-examples-formatting-checkbox").prop("checked", power_user.disable_examples_formatting);
    $('#disable-start-formatting-checkbox').prop("checked", power_user.disable_start_formatting);
    $("#custom_chat_separator").val(power_user.custom_chat_separator);
    $("#fast_ui_mode").prop("checked", power_user.fast_ui_mode);
    $("#waifuMode").prop("checked", power_user.waifuMode);
    $("#movingUImode").prop("checked", power_user.movingUI);
    $("#multigen").prop("checked", power_user.multigen);
    $("#multigen_first_chunk").val(power_user.multigen_first_chunk);
    $("#multigen_next_chunks").val(power_user.multigen_next_chunks);
    $("#play_message_sound").prop("checked", power_user.play_message_sound);
    $("#play_sound_unfocused").prop("checked", power_user.play_sound_unfocused);
    $("#auto_save_msg_edits").prop("checked", power_user.auto_save_msg_edits);
    $(`input[name="avatar_style"][value="${power_user.avatar_style}"]`).prop("checked", true);
    $(`input[name="chat_display"][value="${power_user.chat_display}"]`).prop("checked", true);
    $(`input[name="sheld_width"][value="${power_user.sheld_width}"]`).prop("checked", true);
    $("#font_scale").val(power_user.font_scale);
    $("#font_scale_counter").text(power_user.font_scale);

    $("#blur_strength").val(power_user.blur_strength);
    $("#blur_strength_counter").text(power_user.blur_strength);

    $("#main-text-color-picker").attr('color', power_user.main_text_color);
    $("#italics-color-picker").attr('color', power_user.italics_text_color);
    $("#fastui-bg-color-picker").attr('color', power_user.fastui_bg_color);
    $("#blur-tint-color-picker").attr('color', power_user.blur_tint_color);

    for (const theme of themes) {
        const option = document.createElement('option');
        option.value = theme.name;
        option.innerText = theme.name;
        option.selected = theme.name == power_user.theme;
        $("#themes").append(option);
    }

    $(`#character_sort_order option[data-order="${power_user.sort_order}"][data-field="${power_user.sort_field}"]`).prop("selected", true);
    sortCharactersList();
}

function sortCharactersList(selector = '.character_select') {
    const sortFunc = (a, b) => power_user.sort_order == 'asc' ? compareFunc(a, b) : compareFunc(b, a);
    const compareFunc = (first, second) => typeof first[power_user.sort_field] == "string"
        ? first[power_user.sort_field].localeCompare(second[power_user.sort_field])
        : first[power_user.sort_field] - second[power_user.sort_field];

    if (power_user.sort_field == undefined || characters.length === 0) {
        return;
    }

    let orderedList = characters.slice().sort(sortFunc);

    for (let i = 0; i < characters.length; i++) {
        $(`${selector}[chid="${i}"]`).css({ 'order': orderedList.indexOf(characters[i]) });
    }
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

    $("#movingUIreset").on('click', function () {

        document.getElementById("sheld").style.top = '';
        document.getElementById("sheld").style.left = '';
        document.getElementById("sheld").style.height = '';
        document.getElementById("sheld").style.width = '';

        document.getElementById("left-nav-panel").style.top = '';
        document.getElementById("left-nav-panel").style.left = '';
        document.getElementById("left-nav-panel").style.height = '';
        document.getElementById("left-nav-panel").style.width = '';

        document.getElementById("right-nav-panel").style.top = '';
        document.getElementById("right-nav-panel").style.left = '';
        document.getElementById("right-nav-panel").style.right = '';
        document.getElementById("right-nav-panel").style.height = '';
        document.getElementById("right-nav-panel").style.width = '';

        document.getElementById("expression-holder").style.top = '';
        document.getElementById("expression-holder").style.left = '';
        document.getElementById("expression-holder").style.right = '';
        document.getElementById("expression-holder").style.bottom = '';
        document.getElementById("expression-holder").style.height = '';
        document.getElementById("expression-holder").style.width = '';

    })

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
        console.log("sheld width changing now");
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

    $("#themes").on('change', function () {
        const themeSelected = $(this).find(':selected').val();
        power_user.theme = themeSelected;
        applyTheme(themeSelected);
        saveSettingsDebounced();
    });

    $("#ui-preset-save-button").on('click', async function () {
        const name = await callPopup('Enter a theme preset name:', 'input');

        if (!name) {
            return;
        }

        const theme = {
            name,
            blur_strength: power_user.blur_strength,
            main_text_color: power_user.main_text_color,
            italics_text_color: power_user.italics_text_color,
            fastui_bg_color: power_user.fastui_bg_color,
            blur_tint_color: power_user.blur_tint_color,
        };

        const response = await fetch('/savetheme', {
            method: 'POST', headers: {
                'X-CSRF-Token': token,
                'Content-Type': 'application/json',
            },
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
        sortCharactersList();
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

    $(window).on('focus', function () {
        browser_has_focus = true;
    });

    $(window).on('blur', function () {
        browser_has_focus = false;
    });
});
