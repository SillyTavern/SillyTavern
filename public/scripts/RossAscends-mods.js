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
    getThumbnailUrl,
    selectCharacterById,
    eventSource,
    menu_type,
    substituteParams,
    callPopup,
    sendTextareaMessage,
} from '../script.js';

import {
    power_user,
    send_on_enter_options,
} from './power-user.js';

import { LoadLocal, SaveLocal, LoadLocalBool } from './f-localStorage.js';
import { selected_group, is_group_generating, getGroupAvatar, groups, openGroupById } from './group-chats.js';
import {
    SECRET_KEYS,
    secret_state,
} from './secrets.js';
import { debounce, delay, getStringHash, isValidUrl } from './utils.js';
import { chat_completion_sources, oai_settings } from './openai.js';
import { getTokenCount } from './tokenizers.js';
import { textgen_types, textgenerationwebui_settings as textgen_settings, getTextGenServer } from './textgen-settings.js';

import Bowser from '../lib/bowser.min.js';

var RPanelPin = document.getElementById('rm_button_panel_pin');
var LPanelPin = document.getElementById('lm_button_panel_pin');
var WIPanelPin = document.getElementById('WI_panel_pin');

var RightNavPanel = document.getElementById('right-nav-panel');
var LeftNavPanel = document.getElementById('left-nav-panel');
var WorldInfo = document.getElementById('WorldInfo');

var SelectedCharacterTab = document.getElementById('rm_button_selected_ch');

var connection_made = false;
var retry_delay = 500;

const observerConfig = { childList: true, subtree: true };
const countTokensDebounced = debounce(RA_CountCharTokens, 1000);

const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
        if (mutation.target.classList.contains('online_status_text')) {
            RA_checkOnlineStatus();
        } else if (mutation.target.parentNode === SelectedCharacterTab) {
            setTimeout(RA_CountCharTokens, 200);
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

let parsedUA = null;
try {
    parsedUA = Bowser.parse(navigator.userAgent);
} catch {
    // In case the user agent is an empty string or Bowser can't parse it for some other reason
}


/**
 * Checks if the device is a mobile device.
 * @returns {boolean} - True if the device is a mobile device, false otherwise.
 */
export function isMobile() {
    const mobileTypes = ['mobile', 'tablet'];

    return mobileTypes.includes(parsedUA?.platform?.type);
}

function shouldSendOnEnter() {
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
    let baseDate = new Date(Date.now());
    let humanYear = baseDate.getFullYear();
    let humanMonth = baseDate.getMonth() + 1;
    let humanDate = baseDate.getDate();
    let humanHour = (baseDate.getHours() < 10 ? '0' : '') + baseDate.getHours();
    let humanMinute =
        (baseDate.getMinutes() < 10 ? '0' : '') + baseDate.getMinutes();
    let humanSecond =
        (baseDate.getSeconds() < 10 ? '0' : '') + baseDate.getSeconds();
    let HumanizedDateTime =
        humanYear + '-' + humanMonth + '-' + humanDate + '@' + humanHour + 'h' + humanMinute + 'm' + humanSecond + 's';
    return HumanizedDateTime;
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
export function RA_CountCharTokens() {
    let total_tokens = 0;
    let permanent_tokens = 0;

    $('[data-token-counter]').each(function () {
        const counter = $(this);
        const input = $(document.getElementById(counter.data('token-counter')));
        const isPermanent = counter.data('token-permanent') === true;
        const value = String(input.val());

        if (input.length === 0) {
            counter.text('Invalid input reference');
            return;
        }

        if (!value) {
            counter.text(0);
            return;
        }

        const valueHash = getStringHash(value);

        if (input.data('last-value-hash') === valueHash) {
            total_tokens += Number(counter.text());
            permanent_tokens += isPermanent ? Number(counter.text()) : 0;
        } else {
            // We substitute macro for existing characters, but not for the character being created
            const valueToCount = menu_type === 'create' ? value : substituteParams(value);
            const tokens = getTokenCount(valueToCount);
            counter.text(tokens);
            total_tokens += tokens;
            permanent_tokens += isPermanent ? tokens : 0;
            input.data('last-value-hash', valueHash);
        }
    });

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
        let active_character_id = Object.keys(characters).find(key => characters[key].avatar === active_character);

        if (active_character_id !== null) {
            await selectCharacterById(String(active_character_id));
        }

        if (active_group != null) {
            await openGroupById(String(active_group));
        }

        // if the character list hadn't been loaded yet, try again.
    } else { setTimeout(RA_autoloadchat, 100); }
}

export async function favsToHotswap() {
    const entities = getEntitiesList({ doFilter: false });
    const container = $('#right-nav-panel .hotswap');
    const template = $('#hotswap_template .hotswapAvatar');
    const DEFAULT_COUNT = 6;
    const WIDTH_PER_ITEM = 60; // 50px + 5px gap + 5px padding
    const containerWidth = container.outerWidth();
    const maxCount = containerWidth > 0 ? Math.floor(containerWidth / WIDTH_PER_ITEM) : DEFAULT_COUNT;
    let count = 0;

    const promises = [];
    const newContainer = container.clone();
    newContainer.empty();

    for (const entity of entities) {
        if (count >= maxCount) {
            break;
        }

        const isFavorite = entity.item.fav || entity.item.fav == 'true';

        if (!isFavorite) {
            continue;
        }

        const isCharacter = entity.type === 'character';
        const isGroup = entity.type === 'group';

        const grid = isGroup ? entity.id : '';
        const chid = isCharacter ? entity.id : '';

        let slot = template.clone();
        slot.toggleClass('character_select', isCharacter);
        slot.toggleClass('group_select', isGroup);
        slot.attr('grid', isGroup ? grid : '');
        slot.attr('chid', isCharacter ? chid : '');
        slot.data('id', isGroup ? grid : chid);

        if (isGroup) {
            const group = groups.find(x => x.id === grid);
            const avatar = getGroupAvatar(group);
            $(slot).find('img').replaceWith(avatar);
            $(slot).attr('title', group.name);
        }

        if (isCharacter) {
            const imgLoadPromise = new Promise((resolve) => {
                const avatarUrl = getThumbnailUrl('avatar', entity.item.avatar);
                $(slot).find('img').attr('src', avatarUrl).on('load', resolve);
                $(slot).attr('title', entity.item.avatar);
            });

            // if the image doesn't load in 500ms, resolve the promise anyway
            promises.push(Promise.race([imgLoadPromise, delay(500)]));
        }

        $(slot).css('cursor', 'pointer');
        newContainer.append(slot);
        count++;
    }

    // don't fill leftover spaces with avatar placeholders
    // just evenly space the selected avatars instead
    /*
   if (count < maxCount) { //if any space is left over
        let leftOverSlots = maxCount - count;
        for (let i = 1; i <= leftOverSlots; i++) {
            newContainer.append(template.clone());
        }
    }
    */

    await Promise.allSettled(promises);
    //helpful instruction message if no characters are favorited
    if (count === 0) { container.html('<small><span><i class="fa-solid fa-star"></i> Favorite characters to add them to HotSwaps</span></small>'); }
    //otherwise replace with fav'd characters
    if (count > 0) {
        container.replaceWith(newContainer);
    }
}

//changes input bar and send button display depending on connection status
function RA_checkOnlineStatus() {
    if (online_status == 'no_connection') {
        $('#send_textarea').attr('placeholder', 'Not connected to API!'); //Input bar placeholder tells users they are not connected
        $('#send_form').addClass('no-connection'); //entire input form area is red when not connected
        $('#send_but').addClass('displayNone'); //send button is hidden when not connected;
        $('#mes_continue').addClass('displayNone'); //continue button is hidden when not connected;
        $('#API-status-top').removeClass('fa-plug');
        $('#API-status-top').addClass('fa-plug-circle-exclamation redOverlayGlow');
        connection_made = false;
    } else {
        if (online_status !== undefined && online_status !== 'no_connection') {
            $('#send_textarea').attr('placeholder', 'Type a message, or /? for help'); //on connect, placeholder tells user to type message
            $('#send_form').removeClass('no-connection');
            $('#API-status-top').removeClass('fa-plug-circle-exclamation redOverlayGlow');
            $('#API-status-top').addClass('fa-plug');
            connection_made = true;
            retry_delay = 100;

            if (!is_send_press && !(selected_group && is_group_generating)) {
                $('#send_but').removeClass('displayNone'); //on connect, send button shows
                $('#mes_continue').removeClass('displayNone'); //continue button is shown when connected
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
                if ((textgen_settings.type === textgen_types.MANCER && secret_state[SECRET_KEYS.MANCER]) ||
                    (textgen_settings.type === textgen_types.TOGETHERAI && secret_state[SECRET_KEYS.TOGETHERAI])
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
                    || (secret_state[SECRET_KEYS.MISTRALAI] && oai_settings.chat_completion_source == chat_completion_sources.MISTRALAI)
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
        if (LoadLocalBool('NavLockOn') == true && LoadLocalBool('NavOpened') == true) {
            //console.log("RA -- clicking right nav to open");
            $('#rightNavDrawerIcon').click();
        }

        //auto-open L nav if locked and previously open
        if (LoadLocalBool('LNavLockOn') == true && LoadLocalBool('LNavOpened') == true) {
            console.debug('RA -- clicking left nav to open');
            $('#leftNavDrawerIcon').click();
        }

        //auto-open WI if locked and previously open
        if (LoadLocalBool('WINavLockOn') == true && LoadLocalBool('WINavOpened') == true) {
            console.debug('RA -- clicking WI to open');
            $('#WIDrawerIcon').click();
        }
    }
}

function restoreUserInput() {
    if (!power_user.restore_user_input) {
        console.debug('restoreUserInput disabled');
        return;
    }

    const userInput = LoadLocal('userInput');
    if (userInput) {
        $('#send_textarea').val(userInput).trigger('input');
    }
}

function saveUserInput() {
    const userInput = String($('#send_textarea').val());
    SaveLocal('userInput', userInput);
}

// Make the DIV element draggable:

// THIRD UPDATE, prevent resize window breaks and smartly handle saving

export function dragElement(elmnt) {
    var hasBeenDraggedByUser = false;
    var isMouseDown = false;

    var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    var height, width, top, left, right, bottom,
        maxX, maxY, winHeight, winWidth,
        topbar, topBarFirstX, topBarLastY;

    var elmntName = elmnt.attr('id');
    console.debug(`dragElement called for ${elmntName}`);
    const elmntNameEscaped = $.escapeSelector(elmntName);
    console.debug(`dragElement escaped name: ${elmntNameEscaped}`);
    const elmntHeader = $(`#${elmntNameEscaped}header`);

    if (elmntHeader.length) {
        elmntHeader.off('mousedown').on('mousedown', (e) => {
            hasBeenDraggedByUser = true;
            observer.observe(elmnt.get(0), { attributes: true, attributeFilter: ['style'] });
            dragMouseDown(e);
        });
        $(elmnt).off('mousedown').on('mousedown', () => {
            isMouseDown = true;
            observer.observe(elmnt.get(0), { attributes: true, attributeFilter: ['style'] });
        });
    }

    const observer = new MutationObserver((mutations) => {
        const target = mutations[0].target;
        if (!$(target).is(':visible')
            || $(target).hasClass('resizing')
            || Number((String(target.height).replace('px', ''))) < 50
            || Number((String(target.width).replace('px', ''))) < 50
            || power_user.movingUI === false
            || isMobile()
        ) {
            console.debug('aborting mutator');
            return;
        }
        //console.debug(left + width, winWidth, hasBeenDraggedByUser, isMouseDown)
        const style = getComputedStyle(target); //use computed values because not all CSS are set by default
        height = target.offsetHeight;
        width = target.offsetWidth;
        top = parseInt(style.top);
        left = parseInt(style.left);
        right = parseInt(style.right);
        bottom = parseInt(style.bottom);
        maxX = parseInt(width + left);
        maxY = parseInt(height + top);
        winWidth = window.innerWidth;
        winHeight = window.innerHeight;

        topbar = document.getElementById('top-bar');
        const topbarstyle = getComputedStyle(topbar);
        topBarFirstX = parseInt(topbarstyle.marginInline);
        topBarLastY = parseInt(topbarstyle.height);

        /*console.log(`
        winWidth: ${winWidth}, winHeight: ${winHeight}
        sheldWidth: ${sheldWidth}
        X: ${$(elmnt).css('left')}
        Y: ${$(elmnt).css('top')}
        MaxX: ${maxX}, MaxY: ${maxY}
        height: ${height}
        width: ${width}
        Topbar 1st X: ${topBarFirstX}
        TopBar lastX: ${topBarLastX}
        `);*/


        //prepare an empty poweruser object for the item being altered if we don't have one already
        if (!power_user.movingUIState[elmntName]) {
            console.debug(`adding config property for ${elmntName}`);
            power_user.movingUIState[elmntName] = {};
        }

        //only record position changes if caused by a user click-drag
        if (hasBeenDraggedByUser && isMouseDown) {
            power_user.movingUIState[elmntName].top = top;
            power_user.movingUIState[elmntName].left = left;
            power_user.movingUIState[elmntName].right = right;
            power_user.movingUIState[elmntName].bottom = bottom;
            power_user.movingUIState[elmntName].margin = 'unset';
        }

        //handle resizing
        if (!hasBeenDraggedByUser && isMouseDown) {
            console.debug('saw resize, NOT header drag');

            //prevent resizing offscreen
            if (top + elmnt.height() >= winHeight) {
                console.debug('resizing height to prevent offscreen');
                elmnt.css('height', winHeight - top - 1 + 'px');
            }

            if (left + elmnt.width() >= winWidth) {
                console.debug('resizing width to prevent offscreen');
                elmnt.css('width', winWidth - left - 1 + 'px');
            }

            //prevent resizing from top left into the top bar
            if (top < topBarLastY && maxX >= topBarFirstX && left <= topBarFirstX
            ) {
                console.debug('prevent topbar underlap resize');
                elmnt.css('width', width - 1 + 'px');
            }

            //set css to prevent weird resize behavior (does not save)
            elmnt.css('left', left);
            elmnt.css('top', top);

            //set a listener for mouseup to save new width/height
            elmnt.off('mouseup').on('mouseup', () => {
                console.debug(`Saving ${elmntName} Height/Width`);
                // check if the height or width actually changed
                if (power_user.movingUIState[elmntName].width === width && power_user.movingUIState[elmntName].height === height) {
                    console.debug('no change detected, aborting save');
                    return;
                }

                power_user.movingUIState[elmntName].width = width;
                power_user.movingUIState[elmntName].height = height;
                eventSource.emit('resizeUI', elmntName);
                saveSettingsDebounced();
            });
        }

        //handle dragging hit detection
        if (hasBeenDraggedByUser && isMouseDown) {
            //prevent dragging offscreen
            if (top <= 0) {
                elmnt.css('top', '0px');
            } else if (maxY >= winHeight) {
                elmnt.css('top', winHeight - maxY + top - 1 + 'px');
            }

            if (left <= 0) {
                elmnt.css('left', '0px');
            } else if (maxX >= winWidth) {
                elmnt.css('left', winWidth - maxX + left - 1 + 'px');
            }

            //prevent underlap with topbar div
            /*
            if (top < topBarLastY
                && (maxX >= topBarFirstX && left <= topBarFirstX //elmnt is hitting topbar from left side
                    || left <= topBarLastX && maxX >= topBarLastX //elmnt is hitting topbar from right side
                    || left >= topBarFirstX && maxX <= topBarLastX) //elmnt hitting topbar in the middle
            ) {
                console.debug('topbar hit')
                elmnt.css('top', top + 1 + "px");
            }
            */
        }

        // Check if the element header exists and set the listener on the grabber
        if (elmntHeader.length) {
            elmntHeader.off('mousedown').on('mousedown', (e) => {
                console.debug('listener started from header');
                dragMouseDown(e);
            });
        } else {
            elmnt.off('mousedown').on('mousedown', dragMouseDown);
        }
    });

    function dragMouseDown(e) {

        if (e) {
            hasBeenDraggedByUser = true;
            e.preventDefault();
            pos3 = e.clientX; //mouse X at click
            pos4 = e.clientY; //mouse Y at click
        }
        $(document).on('mouseup', closeDragElement);
        $(document).on('mousemove', elementDrag);
    }

    function elementDrag(e) {
        if (!power_user.movingUIState[elmntName]) {
            power_user.movingUIState[elmntName] = {};
        }

        e = e || window.event;
        e.preventDefault();

        pos1 = pos3 - e.clientX;    //X change amt (-1 or 1)
        pos2 = pos4 - e.clientY;    //Y change amt (-1 or 1)
        pos3 = e.clientX;   //new mouse X
        pos4 = e.clientY;   //new mouse Y

        elmnt.attr('data-dragged', 'true');

        //first set css to computed values to avoid CSS NaN results from 'auto', etc
        elmnt.css('left', (elmnt.offset().left) + 'px');
        elmnt.css('top', (elmnt.offset().top) + 'px');

        //then update element position styles to account for drag changes
        elmnt.css('margin', 'unset');
        elmnt.css('left', (elmnt.offset().left - pos1) + 'px');
        elmnt.css('top', (elmnt.offset().top - pos2) + 'px');
        elmnt.css('right', ((winWidth - maxX) + 'px'));
        elmnt.css('bottom', ((winHeight - maxY) + 'px'));

        // Height/Width here are for visuals only, and are not saved to settings
        // required because some divs do hot have a set width/height..
        // and will defaults to shrink to min value of 100px set in CSS file
        elmnt.css('height', height);
        elmnt.css('width', width);
        /*
                console.log(`
                             winWidth: ${winWidth}, winHeight: ${winHeight}
                             sheldWidth: ${sheldWidth}
                             X: ${$(elmnt).css('left')}
                             Y: ${$(elmnt).css('top')}
                             MaxX: ${maxX}, MaxY: ${maxY}
                             height: ${height}
                             width: ${width}
                             Topbar 1st X: ${topBarFirstX}
                             TopBar lastX: ${topBarLastX}
                             `);
                             */

        return;
    }

    function closeDragElement() {
        console.debug('drag finished');
        hasBeenDraggedByUser = false;
        isMouseDown = false;
        $(document).off('mouseup', closeDragElement);
        $(document).off('mousemove', elementDrag);
        $('body').css('overflow', '');
        // Clear the "data-dragged" attribute
        elmnt.attr('data-dragged', 'false');
        observer.disconnect();
        console.debug(`Saving ${elmntName} UI position`);
        saveSettingsDebounced();
    }
}

export async function initMovingUI() {
    if (!isMobile() && power_user.movingUI === true) {
        console.debug('START MOVING UI');
        dragElement($('#sheld'));
        dragElement($('#left-nav-panel'));
        dragElement($('#right-nav-panel'));
        dragElement($('#WorldInfo'));
        await delay(1000);
        console.debug('loading AN draggable function');
        dragElement($('#floatingPrompt'));
    }
}

// ---------------------------------------------------

export function initRossMods() {
    // initial status check
    setTimeout(() => {
        RA_checkOnlineStatus();
    }, 100);

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

    $('#api_button').click(function () { setTimeout(RA_checkOnlineStatus, 100); });

    //toggle pin class when lock toggle clicked
    $(RPanelPin).on('click', function () {
        SaveLocal('NavLockOn', $(RPanelPin).prop('checked'));
        if ($(RPanelPin).prop('checked') == true) {
            //console.log('adding pin class to right nav');
            $(RightNavPanel).addClass('pinnedOpen');
        } else {
            //console.log('removing pin class from right nav');
            $(RightNavPanel).removeClass('pinnedOpen');

            if ($(RightNavPanel).hasClass('openDrawer') && $('.openDrawer').length > 1) {
                $(RightNavPanel).slideToggle(200, 'swing');
                //$(rightNavDrawerIcon).toggleClass('openIcon closedIcon');
                $(RightNavPanel).toggleClass('openDrawer closedDrawer');
            }
        }
    });
    $(LPanelPin).on('click', function () {
        SaveLocal('LNavLockOn', $(LPanelPin).prop('checked'));
        if ($(LPanelPin).prop('checked') == true) {
            //console.log('adding pin class to Left nav');
            $(LeftNavPanel).addClass('pinnedOpen');
        } else {
            //console.log('removing pin class from Left nav');
            $(LeftNavPanel).removeClass('pinnedOpen');

            if ($(LeftNavPanel).hasClass('openDrawer') && $('.openDrawer').length > 1) {
                $(LeftNavPanel).slideToggle(200, 'swing');
                //$(leftNavDrawerIcon).toggleClass('openIcon closedIcon');
                $(LeftNavPanel).toggleClass('openDrawer closedDrawer');
            }
        }
    });

    $(WIPanelPin).on('click', function () {
        SaveLocal('WINavLockOn', $(WIPanelPin).prop('checked'));
        if ($(WIPanelPin).prop('checked') == true) {
            console.debug('adding pin class to WI');
            $(WorldInfo).addClass('pinnedOpen');
        } else {
            console.debug('removing pin class from WI');
            $(WorldInfo).removeClass('pinnedOpen');

            if ($(WorldInfo).hasClass('openDrawer') && $('.openDrawer').length > 1) {
                console.debug('closing WI after lock removal');
                $(WorldInfo).slideToggle(200, 'swing');
                //$(WorldInfoDrawerIcon).toggleClass('openIcon closedIcon');
                $(WorldInfo).toggleClass('openDrawer closedDrawer');
            }
        }
    });

    // read the state of right Nav Lock and apply to rightnav classlist
    $(RPanelPin).prop('checked', LoadLocalBool('NavLockOn'));
    if (LoadLocalBool('NavLockOn') == true) {
        //console.log('setting pin class via local var');
        $(RightNavPanel).addClass('pinnedOpen');
    }
    if ($(RPanelPin).prop('checked')) {
        console.debug('setting pin class via checkbox state');
        $(RightNavPanel).addClass('pinnedOpen');
    }
    // read the state of left Nav Lock and apply to leftnav classlist
    $(LPanelPin).prop('checked', LoadLocalBool('LNavLockOn'));
    if (LoadLocalBool('LNavLockOn') == true) {
        //console.log('setting pin class via local var');
        $(LeftNavPanel).addClass('pinnedOpen');
    }
    if ($(LPanelPin).prop('checked')) {
        console.debug('setting pin class via checkbox state');
        $(LeftNavPanel).addClass('pinnedOpen');
    }

    // read the state of left Nav Lock and apply to leftnav classlist
    $(WIPanelPin).prop('checked', LoadLocalBool('WINavLockOn'));
    if (LoadLocalBool('WINavLockOn') == true) {
        //console.log('setting pin class via local var');
        $(WorldInfo).addClass('pinnedOpen');
    }

    if ($(WIPanelPin).prop('checked')) {
        console.debug('setting pin class via checkbox state');
        $(WorldInfo).addClass('pinnedOpen');
    }

    //save state of Right nav being open or closed
    $('#rightNavDrawerIcon').on('click', function () {
        if (!$('#rightNavDrawerIcon').hasClass('openIcon')) {
            SaveLocal('NavOpened', 'true');
        } else { SaveLocal('NavOpened', 'false'); }
    });

    //save state of Left nav being open or closed
    $('#leftNavDrawerIcon').on('click', function () {
        if (!$('#leftNavDrawerIcon').hasClass('openIcon')) {
            SaveLocal('LNavOpened', 'true');
        } else { SaveLocal('LNavOpened', 'false'); }
    });

    //save state of Left nav being open or closed
    $('#WorldInfo').on('click', function () {
        if (!$('#WorldInfo').hasClass('openIcon')) {
            SaveLocal('WINavOpened', 'true');
        } else { SaveLocal('WINavOpened', 'false'); }
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

    $(SelectedCharacterTab).click(function () { SaveLocal('SelectedNavTab', 'rm_button_selected_ch'); });
    $('#rm_button_characters').click(function () { SaveLocal('SelectedNavTab', 'rm_button_characters'); });

    // when a char is selected from the list, save them as the auto-load character for next page load

    // when a char is selected from the list, save their name as the auto-load character for next page load
    $(document).on('click', '.character_select', function () {
        const characterId = $(this).find('.avatar').attr('title') || $(this).attr('title');
        setActiveCharacter(characterId);
        setActiveGroup(null);
        saveSettingsDebounced();
    });

    $(document).on('click', '.group_select', function () {
        const groupId = $(this).data('id') || $(this).attr('grid');
        setActiveCharacter(null);
        setActiveGroup(groupId);
        saveSettingsDebounced();
    });

    //this makes the chat input text area resize vertically to match the text size (limited by CSS at 50% window height)
    $('#send_textarea').on('input', function () {
        const isFirefox = navigator.userAgent.toLowerCase().indexOf('firefox') > -1;
        const chatBlock = $('#chat');
        const originalScrollBottom = chatBlock[0].scrollHeight - (chatBlock.scrollTop() + chatBlock.outerHeight());
        this.style.height = window.getComputedStyle(this).getPropertyValue('min-height');
        this.style.height = this.scrollHeight + 0.3 + 'px';

        if (!isFirefox) {
            const newScrollTop = Math.round(chatBlock[0].scrollHeight - (chatBlock.outerHeight() + originalScrollBottom));
            chatBlock.scrollTop(newScrollTop);
        }
        saveUserInput();
    });

    restoreUserInput();

    //Regenerate if user swipes on the last mesage in chat

    document.addEventListener('swiped-left', function (e) {
        if (power_user.gestures === false) {
            return;
        }
        if ($('.mes_edit_buttons, .drawer-content, #character_popup, #dialogue_popup, #WorldInfo, #right-nav-panel, #left-nav-panel, #select_chat_popup, #floatingPrompt').is(':visible')) {
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
        if ($('.mes_edit_buttons, .drawer-content, #character_popup, #dialogue_popup, #WorldInfo, #right-nav-panel, #left-nav-panel, #select_chat_popup, #floatingPrompt').is(':visible')) {
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

    $(document).on('keydown', function (event) {
        processHotkeys(event.originalEvent);
    });

    //Additional hotkeys CTRL+ENTER and CTRL+UPARROW
    /**
     * @param {KeyboardEvent} event
     */
    function processHotkeys(event) {
        //Enter to send when send_textarea in focus
        if ($(':focus').attr('id') === 'send_textarea') {
            const sendOnEnter = shouldSendOnEnter();
            if (!event.shiftKey && !event.ctrlKey && !event.altKey && event.key == 'Enter' && sendOnEnter) {
                event.preventDefault();
                sendTextareaMessage();
            }
        }
        if ($(':focus').attr('id') === 'dialogue_popup_input' && !isMobile()) {
            if (!event.shiftKey && !event.ctrlKey && event.key == 'Enter') {
                event.preventDefault();
                $('#dialogue_popup_ok').trigger('click');
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
        }
        //ctrl+shift+down to scroll to bottom of chat
        if (event.shiftKey && event.ctrlKey && event.key == 'ArrowDown') {
            event.preventDefault();
            $('#chat').animate({
                scrollTop: $('#chat').prop('scrollHeight'),
            }, 300);
        }

        // Alt+Enter or AltGr+Enter to Continue
        if ((event.altKey || (event.altKey && event.ctrlKey)) && event.key == 'Enter') {
            if (is_send_press == false) {
                console.debug('Continuing with Alt+Enter');
                $('#option_continue').trigger('click');
            }
        }

        // Ctrl+Enter for Regeneration Last Response. If editing, accept the edits instead
        if (event.ctrlKey && event.key == 'Enter') {
            const editMesDone = $('.mes_edit_done:visible');
            if (editMesDone.length > 0) {
                console.debug('Accepting edits with Ctrl+Enter');
                editMesDone.trigger('click');
            } else if (is_send_press == false) {
                const skipConfirmKey = 'RegenerateWithCtrlEnter';
                const skipConfirm = LoadLocalBool(skipConfirmKey);
                function doRegenerate() {
                    console.debug('Regenerating with Ctrl+Enter');
                    $('#option_regenerate').trigger('click');
                    $('#options').hide();
                }
                if (skipConfirm) {
                    doRegenerate();
                } else {
                    const popupText = `
                    <div class="marginBot10">Are you sure you want to regenerate the latest message?</div>
                    <label class="checkbox_label justifyCenter" for="regenerateWithCtrlEnter">
                        <input type="checkbox" id="regenerateWithCtrlEnter">
                        Don't ask again
                    </label>`;
                    callPopup(popupText, 'confirm').then(result =>{
                        if (!result) {
                            return;
                        }
                        const regenerateWithCtrlEnter = $('#regenerateWithCtrlEnter').prop('checked');
                        SaveLocal(skipConfirmKey, regenerateWithCtrlEnter);
                        doRegenerate();
                    });
                }
            } else {
                console.debug('Ctrl+Enter ignored');
            }
        }

        // Helper function to check if nanogallery2's lightbox is active
        function isNanogallery2LightboxActive() {
            // Check if the body has the 'nGY2On' class, adjust this based on actual behavior
            return $('body').hasClass('nGY2_body_scrollbar');
        }

        if (event.key == 'ArrowLeft') {        //swipes left
            if (
                !isNanogallery2LightboxActive() &&  // Check if lightbox is NOT active
                $('.swipe_left:last').css('display') === 'flex' &&
                $('#send_textarea').val() === '' &&
                $('#character_popup').css('display') === 'none' &&
                $('#shadow_select_chat_popup').css('display') === 'none' &&
                !isInputElementInFocus()
            ) {
                $('.swipe_left:last').click();
            }
        }
        if (event.key == 'ArrowRight') { //swipes right
            if (
                !isNanogallery2LightboxActive() &&  // Check if lightbox is NOT active
                $('.swipe_right:last').css('display') === 'flex' &&
                $('#send_textarea').val() === '' &&
                $('#character_popup').css('display') === 'none' &&
                $('#shadow_select_chat_popup').css('display') === 'none' &&
                !isInputElementInFocus()
            ) {
                $('.swipe_right:last').click();
            }
        }


        if (event.ctrlKey && event.key == 'ArrowUp') { //edits last USER message if chatbar is empty and focused
            if (
                $('#send_textarea').val() === '' &&
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
                }
            }
        }

        if (event.key == 'ArrowUp') { //edits last message if chatbar is empty and focused
            console.log('got uparrow input');
            if (
                $('#send_textarea').val() === '' &&
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

            if ($('.drawer-content')
                .not('#WorldInfo')
                .not('#left-nav-panel')
                .not('#right-nav-panel')
                .not('#floatingPrompt')
                .not('#cfgConfig')
                .is(':visible')) {
                let visibleDrawerContent = $('.drawer-content:visible')
                    .not('#WorldInfo')
                    .not('#left-nav-panel')
                    .not('#right-nav-panel')
                    .not('#floatingPrompt')
                    .not('#cfgConfig');
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
            event.preventDefault();
            console.log('Ctrl +' + event.key + ' pressed!');
        }
    }
}
