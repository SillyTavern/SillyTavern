import { DOMPurify, Bowser } from '../lib.js';

import {
    characters,
    online_status,
    main_api,
    api_server,
    is_send_press,
    max_context,
    saveSettingsDebounced,
    active_group,
    active_character,
    setActiveGroup,
    setActiveCharacter,
    getEntitiesList,
    buildAvatarList,
    selectCharacterById,
    eventSource,
    menu_type,
    substituteParams,
    sendTextareaMessage,
    doNavbarIconClick,
} from '../script.js';

import {
    power_user,
    send_on_enter_options,
} from './power-user.js';

import { selected_group, is_group_generating, openGroupById } from './group-chats.js';
import { getTagKeyForEntity, applyTagsOnCharacterSelect } from './tags.js';
import {
    SECRET_KEYS,
    secret_state,
} from './secrets.js';
import { debounce, getStringHash, isValidUrl } from './utils.js';
import { chat_completion_sources, oai_settings } from './openai.js';
import { getTokenCountAsync } from './tokenizers.js';
import { textgen_types, textgenerationwebui_settings as textgen_settings, getTextGenServer } from './textgen-settings.js';
import { debounce_timeout } from './constants.js';

import { Popup } from './popup.js';
import { accountStorage } from './util/AccountStorage.js';
import { getCurrentUserHandle } from './user.js';

var RPanelPin = document.getElementById('rm_button_panel_pin');
var LPanelPin = document.getElementById('lm_button_panel_pin');
var WIPanelPin = document.getElementById('WI_panel_pin');

var RightNavPanel = document.getElementById('right-nav-panel');
var RightNavDrawerIcon = document.getElementById('rightNavDrawerIcon');
var LeftNavPanel = document.getElementById('left-nav-panel');
var LeftNavDrawerIcon = document.getElementById('leftNavDrawerIcon');
var WorldInfo = document.getElementById('WorldInfo');
var WIDrawerIcon = document.getElementById('WIDrawerIcon');

var SelectedCharacterTab = document.getElementById('rm_button_selected_ch');

var connection_made = false;
var retry_delay = 500;
let counterNonce = Date.now();

const observerConfig = { childList: true, subtree: true };
const countTokensDebounced = debounce(RA_CountCharTokens, debounce_timeout.relaxed);
const countTokensShortDebounced = debounce(RA_CountCharTokens, debounce_timeout.short);
const checkStatusDebounced = debounce(RA_checkOnlineStatus, debounce_timeout.short);

const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
        if (!(mutation.target instanceof HTMLElement)) {
            return;
        }
        if (mutation.target.classList.contains('online_status_text')) {
            checkStatusDebounced();
        } else if (mutation.target.parentNode === SelectedCharacterTab) {
            countTokensShortDebounced();
        } else if (mutation.target.classList.contains('mes_text')) {
            for (const element of mutation.target.getElementsByTagName('math')) {
                element.childNodes.forEach(function (child) {
                    if (child.nodeType === Node.TEXT_NODE) {
                        child.textContent = '';
                    }
                });
            }
        }
    });
});

observer.observe(document.documentElement, observerConfig);


/**
 * Converts generation time from milliseconds to a human-readable format.
 *
 * The function takes total generation time as an input, then converts it to a format
 * of "_ Days, _ Hours, _ Minutes, _ Seconds". If the generation time does not exceed a
 * particular measure (like days or hours), that measure will not be included in the output.
 *
 * @param {number} total_gen_time - The total generation time in milliseconds.
 * @returns {string} - A human-readable string that represents the time spent generating characters.
 */
export function humanizeGenTime(total_gen_time) {

    //convert time_spent to humanized format of "_ Hours, _ Minutes, _ Seconds" from milliseconds
    let time_spent = total_gen_time || 0;
    time_spent = Math.floor(time_spent / 1000);
    let seconds = time_spent % 60;
    time_spent = Math.floor(time_spent / 60);
    let minutes = time_spent % 60;
    time_spent = Math.floor(time_spent / 60);
    let hours = time_spent % 24;
    time_spent = Math.floor(time_spent / 24);
    let days = time_spent;
    time_spent = '';
    if (days > 0) { time_spent += `${days} Days, `; }
    if (hours > 0) { time_spent += `${hours} Hours, `; }
    if (minutes > 0) { time_spent += `${minutes} Minutes, `; }
    time_spent += `${seconds} Seconds`;
    return time_spent;
}

/**
 * DON'T OPTIMIZE, don't change this to a const or let, it needs to be a var.
 */
var parsedUA = null;

export function getParsedUA() {
    if (!parsedUA) {
        try {
            parsedUA = Bowser.parse(navigator.userAgent);
        } catch {
            // In case the user agent is an empty string or Bowser can't parse it for some other reason
        }
    }

    return parsedUA;
}

/**
 * Checks if the device is a mobile device.
 * @returns {boolean} - True if the device is a mobile device, false otherwise.
 */
export function isMobile() {
    const mobileTypes = ['mobile', 'tablet'];

    return mobileTypes.includes(getParsedUA()?.platform?.type);
}

export function shouldSendOnEnter() {
    if (!power_user) {
        return false;
    }

    switch (power_user.send_on_enter) {
        case send_on_enter_options.DISABLED:
            return false;
        case send_on_enter_options.AUTO:
            return !isMobile();
        case send_on_enter_options.ENABLED:
            return true;
    }
}

//RossAscends: Added function to format dates used in files and chat timestamps to a humanized format.
//Mostly I wanted this to be for file names, but couldn't figure out exactly where the filename save code was as everything seemed to be connected.
//Does not break old characters/chats, as the code just uses whatever timestamp exists in the chat.
//New chats made with characters will use this new formatting.
export function humanizedDateTime() {
    const now = new Date(Date.now());
    const dt = {
        year: now.getFullYear(), month: now.getMonth() + 1, day: now.getDate(),
        hour: now.getHours(), minute: now.getMinutes(), second: now.getSeconds(),
    };
    for (const key in dt) {
        dt[key] = dt[key].toString().padStart(2, '0');
    }
    return `${dt.year}-${dt.month}-${dt.day}@${dt.hour}h${dt.minute}m${dt.second}s`;
}

//this is a common format version to display a timestamp on each chat message
//returns something like: June 19, 2023 2:20pm
export function getMessageTimeStamp() {
    const date = Date.now();
    const months = ['January', 'February', 'March', 'April', 'May', 'June', 'July', 'August', 'September', 'October', 'November', 'December'];
    const d = new Date(date);
    const month = months[d.getMonth()];
    const day = d.getDate();
    const year = d.getFullYear();
    let hours = d.getHours();
    const minutes = ('0' + d.getMinutes()).slice(-2);
    let meridiem = 'am';
    if (hours >= 12) {
        meridiem = 'pm';
        hours -= 12;
    }
    if (hours === 0) {
        hours = 12;
    }
    const formattedDate = month + ' ' + day + ', ' + year + ' ' + hours + ':' + minutes + meridiem;
    return formattedDate;
}


// triggers:
$('#rm_button_create').on('click', function () {                 //when "+New Character" is clicked
    $(SelectedCharacterTab).children('h2').html('');        // empty nav's 3rd panel tab
});
//when any input is made to the create/edit character form textareas
$('#rm_ch_create_block').on('input', function () { countTokensDebounced(); });
//when any input is made to the advanced editing popup textareas
$('#character_popup').on('input', function () { countTokensDebounced(); });
//function:
export async function RA_CountCharTokens() {
    counterNonce = Date.now();
    const counterNonceLocal = counterNonce;
    let total_tokens = 0;
    let permanent_tokens = 0;

    const tokenCounters = document.querySelectorAll('[data-token-counter]');
    for (const tokenCounter of tokenCounters) {
        if (counterNonceLocal !== counterNonce) {
            return;
        }

        const counter = $(tokenCounter);
        const input = $(document.getElementById(counter.data('token-counter')));
        const isPermanent = counter.data('token-permanent') === true;
        const value = String(input.val());

        if (input.length === 0) {
            counter.text('Invalid input reference');
            continue;
        }

        if (!value) {
            input.data('last-value-hash', '');
            counter.text(0);
            continue;
        }

        const valueHash = getStringHash(value);

        if (input.data('last-value-hash') === valueHash) {
            total_tokens += Number(counter.text());
            permanent_tokens += isPermanent ? Number(counter.text()) : 0;
        } else {
            // We substitute macro for existing characters, but not for the character being created
            const valueToCount = menu_type === 'create' ? value : substituteParams(value);
            const tokens = await getTokenCountAsync(valueToCount);

            if (counterNonceLocal !== counterNonce) {
                return;
            }

            counter.text(tokens);
            total_tokens += tokens;
            permanent_tokens += isPermanent ? tokens : 0;
            input.data('last-value-hash', valueHash);
        }
    }

    // Warn if total tokens exceeds the limit of half the max context
    const tokenLimit = Math.max(((main_api !== 'openai' ? max_context : oai_settings.openai_max_context) / 2), 1024);
    const showWarning = (total_tokens > tokenLimit);
    $('#result_info_total_tokens').text(total_tokens);
    $('#result_info_permanent_tokens').text(permanent_tokens);
    $('#result_info_text').toggleClass('neutral_warning', showWarning);
    $('#chartokenwarning').toggle(showWarning);
}
/**
 * Auto load chat with the last active character or group.
 * Fires when active_character is defined and auto_load_chat is true.
 * The function first tries to find a character with a specific ID from the global settings.
 * If it doesn't exist, it tries to find a group with a specific grid from the global settings.
 * If the character list hadn't been loaded yet, it calls itself again after 100ms delay.
 * The character or group is selected (clicked) if it is found.
 */
async function RA_autoloadchat() {
    if (document.querySelector('#rm_print_characters_block .character_select') !== null) {
        // active character is the name, we should look it up in the character list and get the id
        if (active_character !== null && active_character !== undefined) {
            const active_character_id = characters.findIndex(x => getTagKeyForEntity(x) === active_character);
            if (active_character_id !== -1) {
                await selectCharacterById(active_character_id);

                // Do a little tomfoolery to spoof the tag selector
                const selectedCharElement = $(`#rm_print_characters_block .character_select[chid="${active_character_id}"]`);
                applyTagsOnCharacterSelect.call(selectedCharElement);
            } else {
                setActiveCharacter(null);
                saveSettingsDebounced();
                console.warn(`Currently active character with ID ${active_character} not found. Resetting to no active character.`);
            }
        }

        if (active_group !== null && active_group !== undefined) {
            if (active_character) {
                console.warn('Active character and active group are both set. Only active character will be loaded. Resetting active group.');
                setActiveGroup(null);
                saveSettingsDebounced();
            } else {
                const result = await openGroupById(String(active_group));
                if (!result) {
                    setActiveGroup(null);
                    saveSettingsDebounced();
                    console.warn(`Currently active group with ID ${active_group} not found. Resetting to no active group.`);
                }
            }
        }

        // if the character list hadn't been loaded yet, try again.
    } else { setTimeout(RA_autoloadchat, 100); }
}

export async function favsToHotswap() {
    const entities = getEntitiesList({ doFilter: false });
    const container = $('#right-nav-panel .hotswap');

    // Hard limit is required because even if all hotswaps don't fit the screen, their images would still be loaded
    // 25 is roughly calculated as the maximum number of favs that can fit an ultrawide monitor with the default theme
    const FAVS_LIMIT = 25;
    const favs = entities.filter(x => x.item.fav || x.item.fav == 'true').slice(0, FAVS_LIMIT);

    //helpful instruction message if no characters are favorited
    if (favs.length == 0) {
        container.html(`<small><span><i class="fa-solid fa-star"></i>&nbsp;${DOMPurify.sanitize(container.attr('no_favs'))}</span></small>`);
        return;
    }

    buildAvatarList(container, favs, { interactable: true, highlightFavs: false });
}

//changes input bar and send button display depending on connection status
function RA_checkOnlineStatus() {
    if (online_status == 'no_connection') {
        const send_textarea = $('#send_textarea');
        send_textarea.attr('placeholder', send_textarea.attr('no_connection_text')); //Input bar placeholder tells users they are not connected
        $('#send_form').addClass('no-connection');
        $('#send_but').addClass('displayNone'); //send button is hidden when not connected;
        $('#mes_continue').addClass('displayNone'); //continue button is hidden when not connected;
        $('#mes_impersonate').addClass('displayNone'); //continue button is hidden when not connected;
        $('#API-status-top').removeClass('fa-plug');
        $('#API-status-top').addClass('fa-plug-circle-exclamation redOverlayGlow');
        connection_made = false;
    } else {
        if (online_status !== undefined && online_status !== 'no_connection') {
            const send_textarea = $('#send_textarea');
            send_textarea.attr('placeholder', send_textarea.attr('connected_text')); //on connect, placeholder tells user to type message
            $('#send_form').removeClass('no-connection');
            $('#API-status-top').removeClass('fa-plug-circle-exclamation redOverlayGlow');
            $('#API-status-top').addClass('fa-plug');
            connection_made = true;
            retry_delay = 100;

            if (!is_send_press && !(selected_group && is_group_generating)) {
                $('#send_but').removeClass('displayNone'); //on connect, send button shows
                $('#mes_continue').removeClass('displayNone'); //continue button is shown when connected
                $('#mes_impersonate').removeClass('displayNone'); //continue button is shown when connected
            }
        }
    }
}
//Auto-connect to API (when set to kobold, API URL exists, and auto_connect is true)

function RA_autoconnect(PrevApi) {
    // secrets.js or script.js not loaded
    if (SECRET_KEYS === undefined || online_status === undefined) {
        setTimeout(RA_autoconnect, 100);
        return;
    }
    if (online_status === 'no_connection' && power_user.auto_connect) {
        switch (main_api) {
            case 'kobold':
                if (api_server && isValidUrl(api_server)) {
                    $('#api_button').trigger('click');
                }
                break;
            case 'novel':
                if (secret_state[SECRET_KEYS.NOVEL]) {
                    $('#api_button_novel').trigger('click');
                }
                break;
            case 'textgenerationwebui':
                if ((textgen_settings.type === textgen_types.MANCER && secret_state[SECRET_KEYS.MANCER])
                    || (textgen_settings.type === textgen_types.TOGETHERAI && secret_state[SECRET_KEYS.TOGETHERAI])
                    || (textgen_settings.type === textgen_types.INFERMATICAI && secret_state[SECRET_KEYS.INFERMATICAI])
                    || (textgen_settings.type === textgen_types.DREAMGEN && secret_state[SECRET_KEYS.DREAMGEN])
                    || (textgen_settings.type === textgen_types.OPENROUTER && secret_state[SECRET_KEYS.OPENROUTER])
                    || (textgen_settings.type === textgen_types.FEATHERLESS && secret_state[SECRET_KEYS.FEATHERLESS])
                ) {
                    $('#api_button_textgenerationwebui').trigger('click');
                }
                else if (isValidUrl(getTextGenServer())) {
                    $('#api_button_textgenerationwebui').trigger('click');
                }
                break;
            case 'openai':
                if (((secret_state[SECRET_KEYS.OPENAI] || oai_settings.reverse_proxy) && oai_settings.chat_completion_source == chat_completion_sources.OPENAI)
                    || ((secret_state[SECRET_KEYS.CLAUDE] || oai_settings.reverse_proxy) && oai_settings.chat_completion_source == chat_completion_sources.CLAUDE)
                    || ((secret_state[SECRET_KEYS.SCALE] || secret_state[SECRET_KEYS.SCALE_COOKIE]) && oai_settings.chat_completion_source == chat_completion_sources.SCALE)
                    || (oai_settings.chat_completion_source == chat_completion_sources.WINDOWAI)
                    || (secret_state[SECRET_KEYS.OPENROUTER] && oai_settings.chat_completion_source == chat_completion_sources.OPENROUTER)
                    || (secret_state[SECRET_KEYS.AI21] && oai_settings.chat_completion_source == chat_completion_sources.AI21)
                    || (secret_state[SECRET_KEYS.MAKERSUITE] && oai_settings.chat_completion_source == chat_completion_sources.MAKERSUITE)
                    || (secret_state[SECRET_KEYS.VERTEXAI] && oai_settings.chat_completion_source == chat_completion_sources.VERTEXAI && oai_settings.vertexai_auth_mode === 'express')
                    || (secret_state[SECRET_KEYS.VERTEXAI_SERVICE_ACCOUNT] && oai_settings.chat_completion_source == chat_completion_sources.VERTEXAI && oai_settings.vertexai_auth_mode === 'full')
                    || (secret_state[SECRET_KEYS.MISTRALAI] && oai_settings.chat_completion_source == chat_completion_sources.MISTRALAI)
                    || (secret_state[SECRET_KEYS.COHERE] && oai_settings.chat_completion_source == chat_completion_sources.COHERE)
                    || (secret_state[SECRET_KEYS.PERPLEXITY] && oai_settings.chat_completion_source == chat_completion_sources.PERPLEXITY)
                    || (secret_state[SECRET_KEYS.GROQ] && oai_settings.chat_completion_source == chat_completion_sources.GROQ)
                    || (secret_state[SECRET_KEYS.ZEROONEAI] && oai_settings.chat_completion_source == chat_completion_sources.ZEROONEAI)
                    || (secret_state[SECRET_KEYS.NANOGPT] && oai_settings.chat_completion_source == chat_completion_sources.NANOGPT)
                    || (secret_state[SECRET_KEYS.DEEPSEEK] && oai_settings.chat_completion_source == chat_completion_sources.DEEPSEEK)
                    || (secret_state[SECRET_KEYS.XAI] && oai_settings.chat_completion_source == chat_completion_sources.XAI)
                    || (secret_state[SECRET_KEYS.AIMLAPI] && oai_settings.chat_completion_source == chat_completion_sources.AIMLAPI)
                    || (oai_settings.chat_completion_source === chat_completion_sources.POLLINATIONS)
                    || (isValidUrl(oai_settings.custom_url) && oai_settings.chat_completion_source == chat_completion_sources.CUSTOM)
                ) {
                    $('#api_button_openai').trigger('click');
                }
                break;
        }

        if (!connection_made) {
            retry_delay = Math.min(retry_delay * 2, 30000); // double retry delay up to to 30 secs
            // console.log('connection attempts: ' + RA_AC_retries + ' delay: ' + (retry_delay / 1000) + 's');
            // setTimeout(RA_autoconnect, retry_delay);
        }
    }
}

function OpenNavPanels() {
    if (!isMobile()) {
        //auto-open R nav if locked and previously open
        if (accountStorage.getItem('NavLockOn') == 'true' && accountStorage.getItem('NavOpened') == 'true') {
            //console.log("RA -- clicking right nav to open");
            $('#rightNavDrawerIcon').click();
        }

        //auto-open L nav if locked and previously open
        if (accountStorage.getItem('LNavLockOn') == 'true' && accountStorage.getItem('LNavOpened') == 'true') {
            console.debug('RA -- clicking left nav to open');
            $('#leftNavDrawerIcon').click();
        }

        //auto-open WI if locked and previously open
        if (accountStorage.getItem('WINavLockOn') == 'true' && accountStorage.getItem('WINavOpened') == 'true') {
            console.debug('RA -- clicking WI to open');
            $('#WIDrawerIcon').click();
        }
    }
}

const getUserInputKey = () => getCurrentUserHandle() + '_userInput';

function restoreUserInput() {
    if (!power_user.restore_user_input) {
        console.debug('restoreUserInput disabled');
        return;
    }

    const userInput = localStorage.getItem(getUserInputKey());
    if (userInput) {
        $('#send_textarea').val(userInput)[0].dispatchEvent(new Event('input', { bubbles: true }));
    }
}

function saveUserInput() {
    const userInput = String($('#send_textarea').val());
    localStorage.setItem(getUserInputKey(), userInput);
    console.debug('User Input -- ', userInput);
}
const saveUserInputDebounced = debounce(saveUserInput);

// Make the DIV element draggable:

/**
 * Make the given element draggable. This is used for Moving UI.
 * @param {JQuery} $elmnt - The element to make draggable.
 */
export function dragElement($elmnt) {
    let actionType = null; // "drag" or "resize"
    let isMouseDown = false;

    let pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    let height, width, top, left, right, bottom,
        maxX, maxY, winHeight, winWidth,
        topbar, topBarFirstX, topBarLastY;

    const elmntName = $elmnt.attr('id');
    const elmntNameEscaped = $.escapeSelector(elmntName);
    const $elmntHeader = $(`#${elmntNameEscaped}header`);

    // Helper: Save position/size to state and emit events
    function savePositionAndSize() {
        if (!power_user.movingUIState[elmntName]) power_user.movingUIState[elmntName] = {};
        power_user.movingUIState[elmntName].top = top;
        power_user.movingUIState[elmntName].left = left;
        power_user.movingUIState[elmntName].right = right;
        power_user.movingUIState[elmntName].bottom = bottom;
        power_user.movingUIState[elmntName].margin = 'unset';
        if (actionType === 'resize') {
            power_user.movingUIState[elmntName].width = width;
            power_user.movingUIState[elmntName].height = height;
            eventSource.emit('resizeUI', elmntName);
        }
        saveSettingsDebounced();
    }

    // Helper: Clamp element within viewport
    function clampToViewport() {
        if (top <= 0) $elmnt.css('top', '0px');
        else if (maxY >= winHeight) $elmnt.css('top', winHeight - maxY + top - 1 + 'px');
        if (left <= 0) $elmnt.css('left', '0px');
        else if (maxX >= winWidth) $elmnt.css('left', winWidth - maxX + left - 1 + 'px');
    }

    // Observer for style changes (position/size)
    const observer = new MutationObserver((mutations) => {
        const $target = $(mutations[0].target);
        if (
            !$target.is(':visible') ||
            $target.hasClass('resizing') ||
            $target.height() < 50 ||
            $target.width() < 50 ||
            power_user.movingUI === false ||
            isMobile() ||
            !isMouseDown
        ) {
            observer.disconnect();
            return;
        }

        const style = getComputedStyle($target[0]);
        height = parseInt(style.height);
        width = parseInt(style.width);
        top = parseInt(style.top);
        left = parseInt(style.left);
        right = parseInt(style.right);
        bottom = parseInt(style.bottom);
        maxX = width + left;
        maxY = height + top;
        winWidth = window.innerWidth;
        winHeight = window.innerHeight;

        topbar = document.getElementById('top-bar');
        const topbarstyle = getComputedStyle(topbar);
        topBarFirstX = parseInt(topbarstyle.marginInline);
        topBarLastY = parseInt(topbarstyle.height);

        // Prepare state object if missing
        if (!power_user.movingUIState[elmntName]) power_user.movingUIState[elmntName] = {};

        if (actionType === 'resize') {
            let containerAspectRatio = height / width;
            if ($elmnt.attr('id').startsWith('zoomFor_')) {
                const zoomedAvatarImage = $elmnt.find('.zoomed_avatar_img');
                const imgHeight = zoomedAvatarImage.height();
                const imgWidth = zoomedAvatarImage.width();
                const imageAspectRatio = imgHeight / imgWidth;
                if (containerAspectRatio !== imageAspectRatio) {
                    $elmnt.css('width', $elmnt.width());
                    $elmnt.css('height', $elmnt.width() * imageAspectRatio);
                }
                if (top + $elmnt.height() >= winHeight) {
                    $elmnt.css('height', winHeight - top - 1 + 'px');
                    $elmnt.css('width', (winHeight - top - 1) / imageAspectRatio + 'px');
                }
                if (left + $elmnt.width() >= winWidth) {
                    $elmnt.css('width', winWidth - left - 1 + 'px');
                    $elmnt.css('height', (winWidth - left - 1) * imageAspectRatio + 'px');
                }
            } else {
                if (top + $elmnt.height() >= winHeight) $elmnt.css('height', winHeight - top - 1 + 'px');
                if (left + $elmnt.width() >= winWidth) $elmnt.css('width', winWidth - left - 1 + 'px');
            }
            if (top < topBarLastY && maxX >= topBarFirstX && left <= topBarFirstX) {
                $elmnt.css('width', width - 1 + 'px');
            }
            $elmnt.css({ left, top });
            $elmnt.off('mouseup').on('mouseup', () => {
                if (
                    power_user.movingUIState[elmntName].width === $elmnt.width() &&
                    power_user.movingUIState[elmntName].height === $elmnt.height()
                ) return;
                savePositionAndSize();
                observer.disconnect();
            });
        } else if (actionType === 'drag') {
            clampToViewport();
        }

        // Always update position in state
        savePositionAndSize();
    });

    // Mouse event handlers
    function dragMouseDown(e) {
        if (e) {
            actionType = 'drag';
            isMouseDown = true;
            e.preventDefault();
            pos3 = e.clientX;
            pos4 = e.clientY;
        }
        $(document).on('mouseup', closeDragElement);
        $(document).on('mousemove', elementDrag);
    }

    function elementDrag(e) {
        if (!power_user.movingUIState[elmntName]) power_user.movingUIState[elmntName] = {};
        e.preventDefault();
        pos1 = pos3 - e.clientX;
        pos2 = pos4 - e.clientY;
        pos3 = e.clientX;
        pos4 = e.clientY;
        $elmnt.attr('data-dragged', 'true');
        $elmnt.css('left', ($elmnt.offset().left - pos1) + 'px');
        $elmnt.css('top', ($elmnt.offset().top - pos2) + 'px');
        $elmnt.css('margin', 'unset');
        $elmnt.css('height', height);
        $elmnt.css('width', width);
    }

    function closeDragElement() {
        isMouseDown = false;
        actionType = null;
        $(document).off('mouseup', closeDragElement);
        $(document).off('mousemove', elementDrag);
        $elmnt.attr('data-dragged', 'false');
        observer.disconnect();
        savePositionAndSize();
    }

    // Setup event listeners
    if ($elmntHeader.length) {
        $elmntHeader.off('mousedown').on('mousedown', (e) => {
            if ($(e.target).hasClass('drag-grabber')) {
                actionType = 'drag';
                isMouseDown = true;
                observer.observe($elmnt[0], { attributes: true, attributeFilter: ['style'] });
                dragMouseDown(e);
            }
        });
    }

    $elmnt.off('mousedown').on('mousedown', (e) => {
        const rect = $elmnt[0].getBoundingClientRect();
        const resizeMargin = 16;
        const isNearRight = e.clientX > rect.right - resizeMargin;
        const isNearBottom = e.clientY > rect.bottom - resizeMargin;
        if (isNearRight && isNearBottom) {
            actionType = 'resize';
            isMouseDown = true;
            observer.observe($elmnt[0], { attributes: true, attributeFilter: ['style'] });
        }
    });

    $elmnt.off('mouseup').on('mouseup', () => {
        isMouseDown = false;
        actionType = null;
        observer.disconnect();
    });
}

export async function initMovingUI() {
    if (!isMobile() && power_user.movingUI === true) {
        console.debug('START MOVING UI');
        dragElement($('#sheld'));
        dragElement($('#left-nav-panel'));
        dragElement($('#right-nav-panel'));
        dragElement($('#WorldInfo'));
        dragElement($('#floatingPrompt'));
        dragElement($('#logprobsViewer'));
        dragElement($('#cfgConfig'));
    }
}

/**@type {HTMLTextAreaElement} */
const sendTextArea = document.querySelector('#send_textarea');
const chatBlock = document.getElementById('chat');
const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;

/**
 * this makes the chat input text area resize vertically to match the text size (limited by CSS at 50% window height)
 */
function autoFitSendTextArea() {
    const originalScrollBottom = chatBlock.scrollHeight - (chatBlock.scrollTop + chatBlock.offsetHeight);

    sendTextArea.style.height = '1px'; // Reset height to 1px to force recalculation of scrollHeight
    const newHeight = sendTextArea.scrollHeight;
    sendTextArea.style.height = `${newHeight}px`;

    if (!isFirefox) {
        chatBlock.scrollTop = chatBlock.scrollHeight - (chatBlock.offsetHeight + originalScrollBottom);
    }
}
export const autoFitSendTextAreaDebounced = debounce(autoFitSendTextArea, debounce_timeout.short);

// ---------------------------------------------------

export function initRossMods() {
    // initial status check
    checkStatusDebounced();

    if (power_user.auto_load_chat) {
        RA_autoloadchat();
    }

    if (power_user.auto_connect) {
        RA_autoconnect();
    }

    $('#main_api').change(function () {
        var PrevAPI = main_api;
        setTimeout(() => RA_autoconnect(PrevAPI), 100);
    });

    $('#api_button').on('click', () => checkStatusDebounced());

    //toggle pin class when lock toggle clicked
    $(RPanelPin).on('click', function () {
        accountStorage.setItem('NavLockOn', $(RPanelPin).prop('checked'));
        if ($(RPanelPin).prop('checked') == true) {
            //console.log('adding pin class to right nav');
            $(RightNavPanel).addClass('pinnedOpen');
            $(RightNavDrawerIcon).addClass('drawerPinnedOpen');
        } else {
            //console.log('removing pin class from right nav');
            $(RightNavPanel).removeClass('pinnedOpen');
            $(RightNavDrawerIcon).removeClass('drawerPinnedOpen');

            if ($(RightNavPanel).hasClass('openDrawer') && $('.openDrawer').length > 1) {
                const toggle = $('#unimportantYes');
                doNavbarIconClick.call(toggle);
            }
        }
    });
    $(LPanelPin).on('click', function () {
        accountStorage.setItem('LNavLockOn', $(LPanelPin).prop('checked'));
        if ($(LPanelPin).prop('checked') == true) {
            //console.log('adding pin class to Left nav');
            $(LeftNavPanel).addClass('pinnedOpen');
            $(LeftNavDrawerIcon).addClass('drawerPinnedOpen');
        } else {
            //console.log('removing pin class from Left nav');
            $(LeftNavPanel).removeClass('pinnedOpen');
            $(LeftNavDrawerIcon).removeClass('drawerPinnedOpen');

            if ($(LeftNavPanel).hasClass('openDrawer') && $('.openDrawer').length > 1) {
                const toggle = $('#ai-config-button>.drawer-toggle');
                doNavbarIconClick.call(toggle);
            }
        }
    });

    $(WIPanelPin).on('click', async function () {
        accountStorage.setItem('WINavLockOn', $(WIPanelPin).prop('checked'));
        if ($(WIPanelPin).prop('checked') == true) {
            console.debug('adding pin class to WI');
            $(WorldInfo).addClass('pinnedOpen');
            $(WIDrawerIcon).addClass('drawerPinnedOpen');
        } else {
            console.debug('removing pin class from WI');
            $(WorldInfo).removeClass('pinnedOpen');
            $(WIDrawerIcon).removeClass('drawerPinnedOpen');

            if ($(WorldInfo).hasClass('openDrawer') && $('.openDrawer').length > 1) {
                console.debug('closing WI after lock removal');
                const toggle = $('#WI-SP-button>.drawer-toggle');
                doNavbarIconClick.call(toggle);
            }
        }
    });

    // read the state of right Nav Lock and apply to rightnav classlist
    $(RPanelPin).prop('checked', accountStorage.getItem('NavLockOn') == 'true');
    if (accountStorage.getItem('NavLockOn') == 'true') {
        //console.log('setting pin class via local var');
        $(RightNavPanel).addClass('pinnedOpen');
        $(RightNavDrawerIcon).addClass('drawerPinnedOpen');
    }
    if ($(RPanelPin).prop('checked')) {
        console.debug('setting pin class via checkbox state');
        $(RightNavPanel).addClass('pinnedOpen');
        $(RightNavDrawerIcon).addClass('drawerPinnedOpen');
    }
    // read the state of left Nav Lock and apply to leftnav classlist
    $(LPanelPin).prop('checked', accountStorage.getItem('LNavLockOn') === 'true');
    if (accountStorage.getItem('LNavLockOn') == 'true') {
        //console.log('setting pin class via local var');
        $(LeftNavPanel).addClass('pinnedOpen');
        $(LeftNavDrawerIcon).addClass('drawerPinnedOpen');
    }
    if ($(LPanelPin).prop('checked')) {
        console.debug('setting pin class via checkbox state');
        $(LeftNavPanel).addClass('pinnedOpen');
        $(LeftNavDrawerIcon).addClass('drawerPinnedOpen');
    }

    // read the state of left Nav Lock and apply to leftnav classlist
    $(WIPanelPin).prop('checked', accountStorage.getItem('WINavLockOn') === 'true');
    if (accountStorage.getItem('WINavLockOn') == 'true') {
        //console.log('setting pin class via local var');
        $(WorldInfo).addClass('pinnedOpen');
        $(WIDrawerIcon).addClass('drawerPinnedOpen');
    }

    if ($(WIPanelPin).prop('checked')) {
        console.debug('setting pin class via checkbox state');
        $(WorldInfo).addClass('pinnedOpen');
        $(WIDrawerIcon).addClass('drawerPinnedOpen');
    }

    //save state of Right nav being open or closed
    $('#rightNavDrawerIcon').on('click', function () {
        if (!$('#rightNavDrawerIcon').hasClass('openIcon')) {
            accountStorage.setItem('NavOpened', 'true');
        } else { accountStorage.setItem('NavOpened', 'false'); }
    });

    //save state of Left nav being open or closed
    $('#leftNavDrawerIcon').on('click', function () {
        if (!$('#leftNavDrawerIcon').hasClass('openIcon')) {
            accountStorage.setItem('LNavOpened', 'true');
        } else { accountStorage.setItem('LNavOpened', 'false'); }
    });

    //save state of Left nav being open or closed
    $('#WorldInfo').on('click', function () {
        if (!$('#WorldInfo').hasClass('openIcon')) {
            accountStorage.setItem('WINavOpened', 'true');
        } else { accountStorage.setItem('WINavOpened', 'false'); }
    });

    var chatbarInFocus = false;
    $('#send_textarea').focus(function () {
        chatbarInFocus = true;
    });

    $('#send_textarea').blur(function () {
        chatbarInFocus = false;
    });

    setTimeout(() => {
        OpenNavPanels();
    }, 300);

    $(SelectedCharacterTab).click(function () { accountStorage.setItem('SelectedNavTab', 'rm_button_selected_ch'); });
    $('#rm_button_characters').click(function () { accountStorage.setItem('SelectedNavTab', 'rm_button_characters'); });

    // when a char is selected from the list, save them as the auto-load character for next page load

    // when a char is selected from the list, save their name as the auto-load character for next page load
    $(document).on('click', '.character_select', function () {
        const characterId = $(this).attr('data-chid');
        setActiveCharacter(characterId);
        setActiveGroup(null);
        saveSettingsDebounced();
    });

    $(document).on('click', '.group_select', function () {
        const groupId = $(this).attr('data-chid') || $(this).attr('data-grid');
        setActiveCharacter(null);
        setActiveGroup(groupId);
        saveSettingsDebounced();
    });

    const cssAutofit = CSS.supports('field-sizing', 'content');

    if (cssAutofit) {
        let lastHeight = chatBlock.offsetHeight;
        const chatBlockResizeObserver = new ResizeObserver((entries) => {
            for (const entry of entries) {
                if (entry.target !== chatBlock) {
                    continue;
                }

                const threshold = 1;
                const newHeight = chatBlock.offsetHeight;
                const deltaHeight = newHeight - lastHeight;
                const isScrollAtBottom = Math.abs(chatBlock.scrollHeight - chatBlock.scrollTop - newHeight) <= threshold;

                if (!isScrollAtBottom && Math.abs(deltaHeight) > threshold) {
                    chatBlock.scrollTop -= deltaHeight;
                }
                lastHeight = newHeight;
            }
        });

        chatBlockResizeObserver.observe(chatBlock);
    }

    sendTextArea.addEventListener('input', () => {
        saveUserInputDebounced();

        if (cssAutofit) {
            // Unset modifications made with a manual resize
            sendTextArea.style.height = 'auto';
            return;
        }

        const hasContent = sendTextArea.value !== '';
        const fitsCurrentSize = sendTextArea.scrollHeight <= sendTextArea.offsetHeight;
        const isScrollbarShown = sendTextArea.clientWidth < sendTextArea.offsetWidth;
        const isHalfScreenHeight = sendTextArea.offsetHeight >= window.innerHeight / 2;
        const needsDebounce = hasContent && (fitsCurrentSize || (isScrollbarShown && isHalfScreenHeight));
        if (needsDebounce) autoFitSendTextAreaDebounced();
        else autoFitSendTextArea();
    });

    restoreUserInput();

    // Swipe gestures (see: https://www.npmjs.com/package/swiped-events)
    document.addEventListener('swiped-left', function (e) {
        if (power_user.gestures === false) {
            return;
        }
        if (Popup.util.isPopupOpen()) {
            return;
        }
        if (!$(e.target).closest('#sheld').length) {
            return;
        }
        if ($('#curEditTextarea').length) {
            // Don't swipe while in text edit mode
            // the ios selection gestures get picked up
            // as swipe gestures
            return;
        }
        var SwipeButR = $('.swipe_right:last');
        var SwipeTargetMesClassParent = $(e.target).closest('.last_mes');
        if (SwipeTargetMesClassParent !== null) {
            if (SwipeButR.css('display') === 'flex') {
                SwipeButR.click();
            }
        }
    });
    document.addEventListener('swiped-right', function (e) {
        if (power_user.gestures === false) {
            return;
        }
        if (Popup.util.isPopupOpen()) {
            return;
        }
        if (!$(e.target).closest('#sheld').length) {
            return;
        }
        if ($('#curEditTextarea').length) {
            // Don't swipe while in text edit mode
            // the ios selection gestures get picked up
            // as swipe gestures
            return;
        }
        var SwipeButL = $('.swipe_left:last');
        var SwipeTargetMesClassParent = $(e.target).closest('.last_mes');
        if (SwipeTargetMesClassParent !== null) {
            if (SwipeButL.css('display') === 'flex') {
                SwipeButL.click();
            }
        }
    });


    function isInputElementInFocus() {
        //return $(document.activeElement).is(":input");
        var focused = $(':focus');
        if (focused.is('input') || focused.is('textarea') || focused.prop('contenteditable') == 'true') {
            if (focused.attr('id') === 'send_textarea') {
                return false;
            }
            return true;
        }
        return false;
    }

    function isModifiedKeyboardEvent(event) {
        return (event instanceof KeyboardEvent &&
            event.shiftKey ||
            event.ctrlKey ||
            event.altKey ||
            event.metaKey);
    }

    $(document).on('keydown', async function (event) {
        await processHotkeys(event.originalEvent);
    });

    const hotkeyTargets = {
        'send_textarea': sendTextArea,
        'dialogue_popup_input': document.querySelector('#dialogue_popup_input'),
    };

    //Additional hotkeys CTRL+ENTER and CTRL+UPARROW
    /**
     * @param {KeyboardEvent} event
     */
    async function processHotkeys(event) {
        // Default hotkeys and shortcuts shouldn't work if any popup is currently open
        if (Popup.util.isPopupOpen()) {
            return;
        }

        //Enter to send when send_textarea in focus
        if (document.activeElement == hotkeyTargets['send_textarea']) {
            const sendOnEnter = shouldSendOnEnter();
            if (!event.isComposing && !event.shiftKey && !event.ctrlKey && !event.altKey && event.key == 'Enter' && sendOnEnter) {
                event.preventDefault();
                sendTextareaMessage();
                return;
            }
        }
        if (document.activeElement == hotkeyTargets['dialogue_popup_input'] && !isMobile()) {
            if (!event.shiftKey && !event.ctrlKey && event.key == 'Enter') {
                event.preventDefault();
                $('#dialogue_popup_ok').trigger('click');
                return;
            }
        }
        //ctrl+shift+up to scroll to context line
        if (event.shiftKey && event.ctrlKey && event.key == 'ArrowUp') {
            event.preventDefault();
            let contextLine = $('.lastInContext');
            if (contextLine.length !== 0) {
                $('#chat').animate({
                    scrollTop: contextLine.offset().top - $('#chat').offset().top + $('#chat').scrollTop(),
                }, 300);
            } else { toastr.warning('Context line not found, send a message first!'); }
            return;
        }
        //ctrl+shift+down to scroll to bottom of chat
        if (event.shiftKey && event.ctrlKey && event.key == 'ArrowDown') {
            event.preventDefault();
            $('#chat').animate({
                scrollTop: $('#chat').prop('scrollHeight'),
            }, 300);
            return;
        }

        // Alt+Enter or AltGr+Enter to Continue
        if ((event.altKey || (event.altKey && event.ctrlKey)) && event.key == 'Enter') {
            if (is_send_press == false) {
                console.debug('Continuing with Alt+Enter');
                $('#option_continue').trigger('click');
                return;
            }
        }

        // Ctrl+Enter for Regeneration Last Response. If editing, accept the edits instead
        if (event.ctrlKey && event.key == 'Enter') {
            const editMesDone = $('.mes_edit_done:visible');
            const reasoningMesDone = $('.mes_reasoning_edit_done:visible');
            if (editMesDone.length > 0) {
                console.debug('Accepting edits with Ctrl+Enter');
                $('#send_textarea').trigger('focus');
                editMesDone.trigger('click');
                return;
            } else if (reasoningMesDone.length > 0) {
                console.debug('Accepting edits with Ctrl+Enter');
                $('#send_textarea').trigger('focus');
                reasoningMesDone.trigger('click');
                return;
            }
            else if (is_send_press == false) {
                const skipConfirmKey = 'RegenerateWithCtrlEnter';
                const skipConfirm = accountStorage.getItem(skipConfirmKey) === 'true';
                function doRegenerate() {
                    console.debug('Regenerating with Ctrl+Enter');
                    $('#option_regenerate').trigger('click');
                    $('#options').hide();
                }
                if (skipConfirm) {
                    doRegenerate();
                } else {
                    let regenerateWithCtrlEnter = false;
                    const result = await Popup.show.confirm('Regenerate Message', 'Are you sure you want to regenerate the latest message?', {
                        customInputs: [{ id: 'regenerateWithCtrlEnter', label: 'Don\'t ask again' }],
                        onClose: (popup) => {
                            regenerateWithCtrlEnter = Boolean(popup.inputResults.get('regenerateWithCtrlEnter') ?? false);
                        },
                    });
                    if (!result) {
                        return;
                    }

                    accountStorage.setItem(skipConfirmKey, String(regenerateWithCtrlEnter));
                    doRegenerate();
                }
                return;
            } else {
                console.debug('Ctrl+Enter ignored');
            }
        }

        // Helper function to check if nanogallery2's lightbox is active
        function isNanogallery2LightboxActive() {
            // Check if the body has the 'nGY2On' class, adjust this based on actual behavior
            return document.body.classList.contains('nGY2_body_scrollbar');
        }

        if (event.key == 'ArrowLeft') {        //swipes left
            if (
                !isNanogallery2LightboxActive() &&  // Check if lightbox is NOT active
                $('.swipe_left:last').css('display') === 'flex' &&
                $('#send_textarea').val() === '' &&
                $('#character_popup').css('display') === 'none' &&
                $('#shadow_select_chat_popup').css('display') === 'none' &&
                !isInputElementInFocus() &&
                !isModifiedKeyboardEvent(event)
            ) {
                $('.swipe_left:last').trigger('click', { source: 'keyboard', repeated: event.repeat });
                return;
            }
        }
        if (event.key == 'ArrowRight') { //swipes right
            if (
                !isNanogallery2LightboxActive() &&  // Check if lightbox is NOT active
                $('.swipe_right:last').css('display') === 'flex' &&
                $('#send_textarea').val() === '' &&
                $('#character_popup').css('display') === 'none' &&
                $('#shadow_select_chat_popup').css('display') === 'none' &&
                !isInputElementInFocus() &&
                !isModifiedKeyboardEvent(event)
            ) {
                $('.swipe_right:last').trigger('click', { source: 'keyboard', repeated: event.repeat });
                return;
            }
        }


        if (event.ctrlKey && event.key == 'ArrowUp') { //edits last USER message if chatbar is empty and focused
            if (
                hotkeyTargets['send_textarea'].value === '' &&
                chatbarInFocus === true &&
                ($('.swipe_right:last').css('display') === 'flex' || $('.last_mes').attr('is_system') === 'true') &&
                $('#character_popup').css('display') === 'none' &&
                $('#shadow_select_chat_popup').css('display') === 'none'
            ) {
                const isUserMesList = document.querySelectorAll('div[is_user="true"]');
                const lastIsUserMes = isUserMesList[isUserMesList.length - 1];
                const editMes = lastIsUserMes.querySelector('.mes_block .mes_edit');
                if (editMes !== null) {
                    $(editMes).trigger('click');
                    return;
                }
            }
        }

        if (event.key == 'ArrowUp') { //edits last message if chatbar is empty and focused
            console.log('got uparrow input');
            if (
                hotkeyTargets['send_textarea'].value === '' &&
                chatbarInFocus === true &&
                //$('.swipe_right:last').css('display') === 'flex' &&
                $('.last_mes .mes_buttons').is(':visible') &&
                $('#character_popup').css('display') === 'none' &&
                $('#shadow_select_chat_popup').css('display') === 'none'
            ) {
                const lastMes = document.querySelector('.last_mes');
                const editMes = lastMes.querySelector('.mes_block .mes_edit');
                if (editMes !== null) {
                    $(editMes).click();
                    return;
                }
            }
        }

        if (event.key == 'Escape') { //closes various panels
            //dont override Escape hotkey functions from script.js
            //"close edit box" and "cancel stream generation".
            if ($('#curEditTextarea').is(':visible') || $('#mes_stop').is(':visible')) {
                console.debug('escape key, but deferring to script.js routines');
                return;
            }

            if ($('#dialogue_popup').is(':visible')) {
                if ($('#dialogue_popup_cancel').is(':visible')) {
                    $('#dialogue_popup_cancel').trigger('click');
                    return;
                } else {
                    $('#dialogue_popup_ok').trigger('click');
                    return;
                }
            }

            if ($('#select_chat_popup').is(':visible')) {
                $('#select_chat_cross').trigger('click');
                return;
            }

            if ($('#character_popup').is(':visible')) {
                $('#character_cross').trigger('click');
                return;
            }

            if ($('#dialogue_del_mes_cancel').is(':visible')) {
                $('#dialogue_del_mes_cancel').trigger('click');
                return;
            }

            if ($('.drawer-content')
                .not('#WorldInfo')
                .not('#left-nav-panel')
                .not('#right-nav-panel')
                .not('#floatingPrompt')
                .not('#cfgConfig')
                .not('#logprobsViewer')
                .not('#movingDivs > div')
                .is(':visible')) {
                let visibleDrawerContent = $('.drawer-content:visible')
                    .not('#WorldInfo')
                    .not('#left-nav-panel')
                    .not('#right-nav-panel')
                    .not('#floatingPrompt')
                    .not('#cfgConfig')
                    .not('#logprobsViewer')
                    .not('#movingDivs > div');
                $(visibleDrawerContent).parent().find('.drawer-icon').trigger('click');
                return;
            }

            if ($('#floatingPrompt').is(':visible')) {
                $('#ANClose').trigger('click');
                return;
            }

            if ($('#WorldInfo').is(':visible')) {
                $('#WIDrawerIcon').trigger('click');
                return;
            }

            if ($('#cfgConfig').is(':visible')) {
                $('#CFGClose').trigger('click');
                return;
            }

            if ($('#logprobsViewer').is(':visible')) {
                $('#logprobsViewerClose').trigger('click');
                return;
            }

            $('#movingDivs > div').each(function () {
                if ($(this).is(':visible')) {
                    $('#movingDivs > div .floating_panel_close').trigger('click');
                    return;
                }
            });

            if ($('#left-nav-panel').is(':visible') &&
                $(LPanelPin).prop('checked') === false) {
                $('#leftNavDrawerIcon').trigger('click');
                return;
            }

            if ($('#right-nav-panel').is(':visible') &&
                $(RPanelPin).prop('checked') === false) {
                $('#rightNavDrawerIcon').trigger('click');
                return;
            }
            if ($('.draggable').is(':visible')) {
                // Remove the first matched element
                $('.draggable:first').remove();
                return;
            }
        }




        if (event.ctrlKey && /^[1-9]$/.test(event.key)) {
            // This will eventually be to trigger quick replies
            // event.preventDefault();
            console.log('Ctrl +' + event.key + ' pressed!');
        }
    }
}
