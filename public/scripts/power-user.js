import {
    saveSettingsDebounced,
    scrollChatToBottom,
    characters,
    callPopup,
    token,
} from "../script.js";
import { delay } from "./utils.js";


export {
    loadPowerUserSettings,
    collapseNewlines,
    playMessageSound,
    sortCharactersList,
    power_user,
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

let power_user = {
    collapse_newlines: false,
    force_pygmalion_formatting: false,
    pin_examples: false,
    disable_description_formatting: false,
    disable_scenario_formatting: false,
    disable_personality_formatting: false,
    always_force_name2: false,
    multigen: false,
    custom_chat_separator: '',
    fast_ui_mode: true,
    avatar_style: avatar_styles.ROUND,
    chat_display: chat_styles.DEFAULT,
    sheld_width: sheld_width.DEFAULT,
    play_message_sound: false,
    play_sound_unfocused: true,
    sort_field: 'name',
    sort_order: 'asc',
    font_scale: 1,
    blur_strength: 10,

    main_text_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeBodyColor').trim()}`,
    italics_text_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeEmColor').trim()}`,
    fastui_bg_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeFastUIBGColor').trim()}`,
    blur_tint_color: `${getComputedStyle(document.documentElement).getPropertyValue('--SmartThemeBlurTintColor').trim()}`,

    waifuMode: false,
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
};

const chat = document.getElementById('chat');
const chatTransition = window.getComputedStyle(chat).transition;

//Updated at the bottom of this script document based on 'focus' and 'blur' events
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
    const $MainTextColorPicker = document.getElementById('main-text-color-picker');
    const $ItalicsTextColorPicker = document.getElementById('italics-color-picker');
    const $FastUIBGColorPicker = document.getElementById('fastui-bg-color-picker');
    const $BlurTintColorPicker = document.getElementById('blur-tint-color-picker');

    // temporarily unset transition from chat to not make the browser calculate the animation
    chat.style.transition = 'unset';

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

    // a small delay to let the browser do the layout redraw
    await delay(1);
    // set transition back to chat
    chat.style.transition = chatTransition;
}

async function applyBlurStrength() {
    power_user.blur_strength = Number(localStorage.getItem(storage_keys.blur_strength) ?? 1);

    // temporarily unset transition from chat to not make the browser calculate the animation
    chat.style.transition = 'unset';

    // now apply the blur strength to the document
    document.documentElement.style.setProperty('--blurStrength', power_user.blur_strength);
    $("#blur_strength_counter").text(power_user.blur_strength);

    // a small delay to let the browser do the layout redraw
    await delay(1);
    // set transition back to chat
    chat.style.transition = chatTransition;
}


async function applyFontScale() {
    power_user.font_scale = Number(localStorage.getItem(storage_keys.font_scale) ?? 1);

    // temporarily unset transition from chat to not make the browser calculate the animation
    chat.style.transition = 'unset';

    // now apply the font scale to the document
    document.documentElement.style.setProperty('--fontScale', power_user.font_scale);
    $("#font_scale_counter").text(power_user.font_scale);

    // a small delay to let the browser do the layout redraw
    await delay(1);
    // set transition back to chat
    chat.style.transition = chatTransition;
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
    power_user.fast_ui_mode = fastUi === null ? true : fastUi == "true";
    power_user.waifuMode = waifuMode === null ? false : waifuMode == "true";
    power_user.avatar_style = Number(localStorage.getItem(storage_keys.avatar_style) ?? avatar_styles.ROUND);
    power_user.chat_display = Number(localStorage.getItem(storage_keys.chat_display) ?? chat_styles.DEFAULT);
    power_user.sheld_width = Number(localStorage.getItem(storage_keys.sheld_width) ?? sheld_width.DEFAULT);
    power_user.font_scale = Number(localStorage.getItem(storage_keys.font_scale) ?? 1);
    power_user.blur_strength = Number(localStorage.getItem(storage_keys.blur_strength) ?? 10);

    $("#force-pygmalion-formatting-checkbox").prop("checked", power_user.force_pygmalion_formatting);
    $("#collapse-newlines-checkbox").prop("checked", power_user.collapse_newlines);
    $("#pin-examples-checkbox").prop("checked", power_user.pin_examples);
    $("#disable-description-formatting-checkbox").prop("checked", power_user.disable_description_formatting);
    $("#disable-scenario-formatting-checkbox").prop("checked", power_user.disable_scenario_formatting);
    $("#disable-personality-formatting-checkbox").prop("checked", power_user.disable_personality_formatting);
    $("#always-force-name2-checkbox").prop("checked", power_user.always_force_name2);
    $("#custom_chat_separator").val(power_user.custom_chat_separator);
    $("#fast_ui_mode").prop("checked", power_user.fast_ui_mode);
    $("#waifuMode").prop("checked", power_user.waifuMode);
    $("#multigen").prop("checked", power_user.multigen);
    $("#play_message_sound").prop("checked", power_user.play_message_sound);
    $("#play_sound_unfocused").prop("checked", power_user.play_sound_unfocused);
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

function sortCharactersList() {
    const sortFunc = (a, b) => power_user.sort_order == 'asc' ? compareFunc(a, b) : compareFunc(b, a);
    const compareFunc = (first, second) => typeof first[power_user.sort_field] == "string"
        ? first[power_user.sort_field].localeCompare(second[power_user.sort_field])
        : first[power_user.sort_field] - second[power_user.sort_field];

    if (power_user.sort_field == undefined || characters.length === 0) {
        return;
    }

    let orderedList = characters.slice().sort(sortFunc);

    for (let i = 0; i < characters.length; i++) {
        $(`.character_select[chid="${i}"]`).css({ 'order': orderedList.indexOf(characters[i]) });
    }
}

$(document).ready(() => {
    // Settings that go to settings.json
    $("#collapse-newlines-checkbox").change(function () {
        power_user.collapse_newlines = !!$(this).prop("checked");
        saveSettingsDebounced();
    });

    $("#force-pygmalion-formatting-checkbox").change(function () {
        power_user.force_pygmalion_formatting = !!$(this).prop("checked");
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

    $(`input[name="font_scale"]`).on('input', function (e) {
        power_user.font_scale = Number(e.target.value);
        $("#font_scale_counter").text(power_user.font_scale);
        localStorage.setItem(storage_keys.font_scale, power_user.font_scale);
        applyFontScale();
    });

    $(`input[name="blur_strength"]`).on('input', function (e) {
        power_user.blur_strength = Number(e.target.value);
        $("#blur_strength_counter").text(power_user.blur_strength);
        localStorage.setItem(storage_keys.blur_strength, power_user.blur_strength);
        applyBlurStrength();
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

    $("#character_sort_order").on('change', function () {
        power_user.sort_field = $(this).find(":selected").data('field');
        power_user.sort_order = $(this).find(":selected").data('order');
        sortCharactersList();
        saveSettingsDebounced();
    });

    $(window).on('focus', function () {
        browser_has_focus = true;
    });

    $(window).on('blur', function () {
        browser_has_focus = false;
    });
});
