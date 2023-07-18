esversion: 6

import {
    Generate,
    this_chid,
    characters,
    online_status,
    main_api,
    api_server,
    api_server_textgenerationwebui,
    is_send_press,
    getTokenCount,
    menu_type,
    max_context,
    saveSettingsDebounced,
} from "../script.js";


import {
    power_user,
    send_on_enter_options,
} from "./power-user.js";

import { LoadLocal, SaveLocal, CheckLocal, LoadLocalBool } from "./f-localStorage.js";
import { selected_group, is_group_generating, getGroupAvatar, groups } from "./group-chats.js";
import {
    SECRET_KEYS,
    secret_state,
} from "./secrets.js";
import { sortByCssOrder, debounce, delay } from "./utils.js";
import { chat_completion_sources, oai_settings } from "./openai.js";

var NavToggle = document.getElementById("nav-toggle");

var RPanelPin = document.getElementById("rm_button_panel_pin");
var LPanelPin = document.getElementById("lm_button_panel_pin");
var WIPanelPin = document.getElementById("WI_panel_pin");

var RightNavPanel = document.getElementById("right-nav-panel");
var LeftNavPanel = document.getElementById("left-nav-panel");
var WorldInfo = document.getElementById("WorldInfo");

var SelectedCharacterTab = document.getElementById("rm_button_selected_ch");
var AdvancedCharDefsPopup = document.getElementById("character_popup");
var ConfirmationPopup = document.getElementById("dialogue_popup");
var AutoConnectCheckbox = document.getElementById("auto-connect-checkbox");
var AutoLoadChatCheckbox = document.getElementById("auto-load-chat-checkbox");
var SelectedNavTab = ("#" + LoadLocal('SelectedNavTab'));

var create_save_name;
var create_save_description;
var create_save_personality;
var create_save_first_message;
var create_save_scenario;
var create_save_mes_example;
var count_tokens;
var perm_tokens;

var connection_made = false;
var retry_delay = 500;
var RA_AC_retries = 1;

const observerConfig = { childList: true, subtree: true };
const countTokensDebounced = debounce(RA_CountCharTokens, 1000);

const observer = new MutationObserver(function (mutations) {
    mutations.forEach(function (mutation) {
        if (mutation.target.id === "online_status_text2" ||
            mutation.target.id === "online_status_text3" ||
            mutation.target.classList.contains("online_status_text4")) {
            RA_checkOnlineStatus();
        } else if (mutation.target.parentNode === SelectedCharacterTab) {
            setTimeout(RA_CountCharTokens, 200);
        }
    });
});

observer.observe(document.documentElement, observerConfig);

/**
 * Wait for an element before resolving a promise
 * @param {String} querySelector - Selector of element to wait for
 * @param {Integer} timeout - Milliseconds to wait before timing out, or 0 for no timeout
 */
function waitForElement(querySelector, timeout) {
    return new Promise((resolve, reject) => {
        var timer = false;
        if (document.querySelectorAll(querySelector).length) return resolve();
        const observer = new MutationObserver(() => {
            if (document.querySelectorAll(querySelector).length) {
                observer.disconnect();
                if (timer !== false) clearTimeout(timer);
                return resolve();
            }
        });
        observer.observe(document.body, {
            childList: true,
            subtree: true
        });
        if (timeout) timer = setTimeout(() => {
            observer.disconnect();
            reject();
        }, timeout);
    });
}


// Device detection
export const deviceInfo = await getDeviceInfo();

async function getDeviceInfo() {
    try {
        const deviceInfo = await (await fetch('/deviceinfo')).json();
        console.log("Device type: " + deviceInfo?.device?.type);
        return deviceInfo;
    }
    catch {
        console.log("Couldn't load device info. Defaulting to desktop");
        return { device: { type: 'desktop' } };
    }
}

export function isMobile() {
    const mobileTypes = ['smartphone', 'tablet', 'phablet', 'feature phone', 'portable media player'];
    return mobileTypes.includes(deviceInfo?.device?.type);
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
    let humanHour = (baseDate.getHours() < 10 ? "0" : "") + baseDate.getHours();
    let humanMinute =
        (baseDate.getMinutes() < 10 ? "0" : "") + baseDate.getMinutes();
    let humanSecond =
        (baseDate.getSeconds() < 10 ? "0" : "") + baseDate.getSeconds();
    let humanMillisecond =
        (baseDate.getMilliseconds() < 10 ? "0" : "") + baseDate.getMilliseconds();
    let HumanizedDateTime =
        humanYear + "-" + humanMonth + "-" + humanDate + " @" + humanHour + "h " + humanMinute + "m " + humanSecond + "s " + humanMillisecond + "ms";
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
$("#rm_button_create").on("click", function () {                 //when "+New Character" is clicked
    $(SelectedCharacterTab).children("h2").html('');        // empty nav's 3rd panel tab

    //empty temp vars to store new char data for counting
    create_save_name = "";
    create_save_description = "";
    create_save_personality = "";
    create_save_first_message = "";
    create_save_scenario = "";
    create_save_mes_example = "";
    $("#result_info").html('Type to start counting tokens!');
});
//when any input is made to the create/edit character form textareas
$("#rm_ch_create_block").on("input", function () { countTokensDebounced(); });
//when any input is made to the advanced editing popup textareas
$("#character_popup").on("input", function () { countTokensDebounced(); });
//function:
export function RA_CountCharTokens() {
    $("#result_info").html("");
    //console.log('RA_TC -- starting with this_chid = ' + this_chid);
    if (menu_type === "create") {            //if new char
        function saveFormVariables() {
            create_save_name = $("#character_name_pole").val();
            create_save_description = $("#description_textarea").val();
            create_save_first_message = $("#firstmessage_textarea").val();
        }

        function savePopupVariables() {
            create_save_personality = $("#personality_textarea").val();
            create_save_scenario = $("#scenario_pole").val();
            create_save_mes_example = $("#mes_example_textarea").val();
        }

        saveFormVariables();
        savePopupVariables();

        //count total tokens, including those that will be removed from context once chat history is long
        let count_string = [
            create_save_name,
            create_save_description,
            create_save_personality,
            create_save_scenario,
            create_save_first_message,
            create_save_mes_example,
        ].join('\n').replace(/\r/gm, '').trim();
        count_tokens = getTokenCount(count_string);

        //count permanent tokens that will never get flushed out of context
        let perm_string = [
            create_save_name,
            create_save_description,
            create_save_personality,
            create_save_scenario,
            // add examples to permanent if they are pinned
            (power_user.pin_examples ? create_save_mes_example : ''),
        ].join('\n').replace(/\r/gm, '').trim();
        perm_tokens = getTokenCount(perm_string);

    } else {
        if (this_chid !== undefined && this_chid !== "invalid-safety-id") {    // if we are counting a valid pre-saved char

            //same as above, all tokens including temporary ones
            let count_string = [
                characters[this_chid].description,
                characters[this_chid].personality,
                characters[this_chid].scenario,
                characters[this_chid].first_mes,
                characters[this_chid].mes_example,
            ].join('\n').replace(/\r/gm, '').trim();
            count_tokens = getTokenCount(count_string);

            //permanent tokens count
            let perm_string = [
                characters[this_chid].name,
                characters[this_chid].description,
                characters[this_chid].personality,
                characters[this_chid].scenario,
                // add examples to permanent if they are pinned
                (power_user.pin_examples ? characters[this_chid].mes_example : ''),
            ].join('\n').replace(/\r/gm, '').trim();
            perm_tokens = getTokenCount(perm_string);
            // if neither, probably safety char or some error in loading
        } else { console.debug("RA_TC -- no valid char found, closing."); }
    }
    // display the counted tokens
    const tokenLimit = Math.max(((main_api !== 'openai' ? max_context : oai_settings.openai_max_context) / 2), 1024);
    if (count_tokens < tokenLimit && perm_tokens < tokenLimit) {
        $("#result_info").html(`<small>${count_tokens} Tokens (${perm_tokens} Permanent)</small>`);
    } else {
        $("#result_info").html(`
        <div class="flex-container alignitemscenter">
            <div class="flex-container flexnowrap flexNoGap">
                <small class="flex-container flexnowrap flexNoGap">
                    <div class="neutral_warning">${count_tokens}</div>&nbsp;Tokens (<div class="neutral_warning">${perm_tokens}</div><div>&nbsp;Permanent)</div>
                </small>
            </div>
            <div id="chartokenwarning" class="menu_button margin0 whitespacenowrap"><a href="https://docs.sillytavern.app/usage/core-concepts/characterdesign/#character-tokens" target="_blank">About Token 'Limits'</a></div>
        </div>`);
    } //warn if either are over 1024
}
//Auto Load Last Charcter -- (fires when active_character is defined and auto_load_chat is true)
async function RA_autoloadchat() {
    if (document.getElementById('CharID0') !== null) {
        var charToAutoLoad = document.getElementById('CharID' + LoadLocal('ActiveChar'));
        let groupToAutoLoad = document.querySelector(`.group_select[grid="${LoadLocal('ActiveGroup')}"]`);
        if (charToAutoLoad != null) {
            $(charToAutoLoad).click();
        }
        else if (groupToAutoLoad != null) {
            $(groupToAutoLoad).click();
        }

        // if the charcter list hadn't been loaded yet, try again.
    } else { setTimeout(RA_autoloadchat, 100); }
}

export async function favsToHotswap() {
    const selector = ['#rm_print_characters_block .character_select', '#rm_print_characters_block .group_select'].join(',');
    const container = $('#right-nav-panel .hotswap');
    const template = $('#hotswap_template .hotswapAvatar');
    container.empty();
    const maxCount = 6;
    let count = 0;

    $(selector).sort(sortByCssOrder).each(function () {
        if ($(this).hasClass('is_fav') && count < maxCount) {
            const isCharacter = $(this).hasClass('character_select');
            const isGroup = $(this).hasClass('group_select');
            const grid = Number($(this).attr('grid'));
            const chid = Number($(this).attr('chid'));
            let thisHotSwapSlot = template.clone();
            thisHotSwapSlot.toggleClass('character_select', isCharacter);
            thisHotSwapSlot.toggleClass('group_select', isGroup);
            thisHotSwapSlot.attr('grid', isGroup ? grid : '');
            thisHotSwapSlot.attr('chid', isCharacter ? chid : '');
            thisHotSwapSlot.data('id', isGroup ? grid : chid);

            if (isGroup) {
                const group = groups.find(x => x.id === grid);
                const avatar = getGroupAvatar(group);
                $(thisHotSwapSlot).find('img').replaceWith(avatar);
            }

            if (isCharacter) {
                const avatarUrl = $(this).find('img').attr('src');
                $(thisHotSwapSlot).find('img').attr('src', avatarUrl);
            }

            $(thisHotSwapSlot).css('cursor', 'pointer');
            container.append(thisHotSwapSlot);
            count++;
        }
    });

    //console.log('about to check for leftover selectors...')
    // there are 6 slots in total,
    if (count < maxCount) { //if any are left over
        let leftOverSlots = maxCount - count;
        for (let i = 1; i <= leftOverSlots; i++) {
            container.append(template.clone());
        }
    } else {
        //console.log(`count was ${count} so no need to knock off any selectors!`);
    }
}

//changes input bar and send button display depending on connection status
function RA_checkOnlineStatus() {
    if (online_status == "no_connection") {
        $("#send_textarea").attr("placeholder", "Not connected to API!"); //Input bar placeholder tells users they are not connected
        $("#send_form").addClass('no-connection'); //entire input form area is red when not connected
        $("#send_but").css("display", "none"); //send button is hidden when not connected;
        $("#API-status-top").removeClass("fa-plug");
        $("#API-status-top").addClass("fa-plug-circle-exclamation redOverlayGlow");
        connection_made = false;
    } else {
        if (online_status !== undefined && online_status !== "no_connection") {
            $("#send_textarea").attr("placeholder", `Type a message, or /? for command list`); //on connect, placeholder tells user to type message
            $('#send_form').removeClass("no-connection");
            $("#API-status-top").removeClass("fa-plug-circle-exclamation redOverlayGlow");
            $("#API-status-top").addClass("fa-plug");
            connection_made = true;
            retry_delay = 100;
            RA_AC_retries = 1;

            if (!is_send_press && !(selected_group && is_group_generating)) {
                $("#send_but").css("display", "flex"); //on connect, send button shows
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
    if (online_status === "no_connection" && LoadLocalBool('AutoConnectEnabled')) {
        switch (main_api) {
            case 'kobold':
                if (api_server && isUrlOrAPIKey(api_server)) {
                    $("#api_button").click();
                }
                break;
            case 'novel':
                if (secret_state[SECRET_KEYS.NOVEL]) {
                    $("#api_button_novel").click();
                }
                break;
            case 'textgenerationwebui':
                if (api_server_textgenerationwebui && isUrlOrAPIKey(api_server_textgenerationwebui)) {
                    $("#api_button_textgenerationwebui").click();
                }
                break;
            case 'openai':
                if ((secret_state[SECRET_KEYS.OPENAI] && oai_settings.chat_completion_source == chat_completion_sources.OPENAI)
                    || (secret_state[SECRET_KEYS.CLAUDE] && oai_settings.chat_completion_source == chat_completion_sources.CLAUDE)
                    || (secret_state[SECRET_KEYS.SCALE] && oai_settings.chat_completion_source == chat_completion_sources.SCALE)
                    || (oai_settings.chat_completion_source == chat_completion_sources.WINDOWAI)
                    || (secret_state[SECRET_KEYS.OPENROUTER] && oai_settings.chat_completion_source == chat_completion_sources.OPENROUTER)
                ) {
                    $("#api_button_openai").click();
                }
                break;
            case 'poe':
                if (secret_state[SECRET_KEYS.POE]) {
                    $("#poe_connect").click();
                }
                break;
        }

        if (!connection_made) {
            RA_AC_retries++;
            retry_delay = Math.min(retry_delay * 2, 30000); // double retry delay up to to 30 secs
            //console.log('connection attempts: ' + RA_AC_retries + ' delay: ' + (retry_delay / 1000) + 's');
            setTimeout(RA_autoconnect, retry_delay);
        }
    }
}

function isUrlOrAPIKey(string) {
    try {
        new URL(string);
        return true;
    } catch (_) {
        //          return pattern.test(string);
    }
}

function OpenNavPanels() {

    if (deviceInfo.device.type === 'desktop') {
        //auto-open R nav if locked and previously open
        if (LoadLocalBool("NavLockOn") == true && LoadLocalBool("NavOpened") == true) {
            //console.log("RA -- clicking right nav to open");
            $("#rightNavDrawerIcon").click();
        }

        //auto-open L nav if locked and previously open
        if (LoadLocalBool("LNavLockOn") == true && LoadLocalBool("LNavOpened") == true) {
            console.debug("RA -- clicking left nav to open");
            $("#leftNavDrawerIcon").click();
        }

        //auto-open WI if locked and previously open
        if (LoadLocalBool("WINavLockOn") == true && LoadLocalBool("WINavOpened") == true) {
            console.debug("RA -- clicking WI to open");
            $("#WIDrawerIcon").click();
        }
    }
}


// Make the DIV element draggable:

// THIRD UPDATE, prevent resize window breaks and smartly handle saving

export function dragElement(elmnt) {
    var hasBeenDraggedByUser = false;
    var isMouseDown = false;

    var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    var height, width, top, left, right, bottom,
        maxX, maxY, winHeight, winWidth,
        topbar, topbarWidth, topBarFirstX, topBarLastX, sheldWidth;

    var elmntName = elmnt.attr('id');

    const elmntNameEscaped = $.escapeSelector(elmntName);
    const elmntHeader = $(`#${elmntNameEscaped}header`);

    if (elmntHeader.length) {
        elmntHeader.off('mousedown').on('mousedown', (e) => {

            dragMouseDown(e);
        });
        $(elmnt).off('mousedown').on('mousedown', () => { isMouseDown = true })
    } else {
        elmnt.off('mousedown').on('mousedown', dragMouseDown);
    }

    const observer = new MutationObserver((mutations) => {
        const target = mutations[0].target;
        if (!$(target).is(':visible')
            || $(target).hasClass('resizing')
            || Number((String(target.height).replace('px', ''))) < 50
            || Number((String(target.width).replace('px', ''))) < 50
            || power_user.movingUI === false
            || isMobile() === true
        ) {
            console.debug('aborting mutator')
            return
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
        sheldWidth = parseInt($('html').css('--sheldWidth').slice(0, -2));

        topbar = document.getElementById("top-bar")
        const topbarstyle = getComputedStyle(topbar)
        topBarFirstX = parseInt(topbarstyle.marginInline)
        topbarWidth = parseInt(topbarstyle.width)
        topBarLastX = topBarFirstX + topbarWidth;

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
            console.debug(`adding config property for ${elmntName}`)
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
            console.debug('saw resize, NOT header drag')

            //prevent resizing offscreen
            if (top + elmnt.height() >= winHeight) {
                console.debug('resizing height to prevent offscreen')
                elmnt.css('height', winHeight - top - 1 + "px");
            }

            if (left + elmnt.width() >= winWidth) {
                console.debug('resizing width to prevent offscreen')
                elmnt.css('width', winWidth - left - 1 + "px");
            }

            //prevent resizing from top left into the top bar
            if (top <= 40 && maxX >= topBarFirstX && left <= topBarFirstX
            ) {
                console.debug('prevent topbar underlap resize')
                elmnt.css('width', width - 1 + "px");
            }

            //set css to prevent weird resize behavior (does not save)
            elmnt.css('left', left)
            elmnt.css('top', top)

            //set a listener for mouseup to save new width/height
            elmnt.off('mouseup').on('mouseup', () => {
                console.debug(`Saving ${elmntName} Height/Width`)
                power_user.movingUIState[elmntName].width = width;
                power_user.movingUIState[elmntName].height = height;
                saveSettingsDebounced();
            })
        }

        //handle dragging hit detection
        if (hasBeenDraggedByUser && isMouseDown) {
            //prevent dragging offscreen
            if (top <= 0) {
                elmnt.css('top', '0px');
            } else if (maxY >= winHeight) {
                elmnt.css('top', winHeight - maxY + top - 1 + "px");
            }

            if (left <= 0) {
                elmnt.css('left', '0px');
            } else if (maxX >= winWidth) {
                elmnt.css('left', winWidth - maxX + left - 1 + "px");
            }

            //prevent underlap with topbar div
            if (top < 40
                && (maxX >= topBarFirstX && left <= topBarFirstX //elmnt is hitting topbar from left side
                    || left <= topBarLastX && maxX >= topBarLastX //elmnt is hitting topbar from right side
                    || left >= topBarFirstX && maxX <= topBarLastX) //elmnt hitting topbar in the middle
            ) {
                console.debug('topbar hit')
                elmnt.css('top', top + 1 + "px");
            }
        }

        // Check if the element header exists and set the listener on the grabber
        if (elmntHeader.length) {
            elmntHeader.off('mousedown').on('mousedown', (e) => {
                console.debug('listener started from header')
                dragMouseDown(e);
            });
        } else {
            elmnt.off('mousedown').on('mousedown', dragMouseDown);
        }
    });

    observer.observe(elmnt.get(0), { attributes: true, attributeFilter: ['style'] });

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
        elmnt.css('left', (elmnt.offset().left) + "px");
        elmnt.css("top", (elmnt.offset().top) + "px");

        //then update element position styles to account for drag changes
        elmnt.css('margin', 'unset');
        elmnt.css('left', (elmnt.offset().left - pos1) + "px");
        elmnt.css("top", (elmnt.offset().top - pos2) + "px");
        elmnt.css("right", ((winWidth - maxX) + "px"));
        elmnt.css("bottom", ((winHeight - maxY) + "px"));

        // Height/Width here are for visuals only, and are not saved to settings
        // required because some divs do hot have a set width/height..
        // and will defaults to shrink to min value of 100px set in CSS file
        elmnt.css('height', height)
        elmnt.css('width', width)
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

        return
    }

    function closeDragElement() {
        console.debug('drag finished')
        hasBeenDraggedByUser = false;
        isMouseDown = false;
        $(document).off('mouseup', closeDragElement);
        $(document).off('mousemove', elementDrag);
        $("body").css("overflow", "");
        // Clear the "data-dragged" attribute
        elmnt.attr('data-dragged', 'false');
        console.debug(`Saving ${elmntName} UI position`)
        saveSettingsDebounced();

    }
}

export async function initMovingUI() {
    if (isMobile() === false && power_user.movingUI === true) {
        console.debug('START MOVING UI')
        dragElement($("#sheld"));
        dragElement($("#left-nav-panel"));
        dragElement($("#right-nav-panel"));
        dragElement($("#WorldInfo"));
        await delay(1000)
        console.debug('loading AN draggable function')
        dragElement($("#floatingPrompt"))
    }
}

// ---------------------------------------------------

$("document").ready(function () {

    // initial status check
    setTimeout(() => {
        RA_checkOnlineStatus();
    }, 100);

    // read the state of AutoConnect and AutoLoadChat.
    $(AutoConnectCheckbox).prop("checked", LoadLocalBool("AutoConnectEnabled"));
    $(AutoLoadChatCheckbox).prop("checked", LoadLocalBool("AutoLoadChatEnabled"));

    setTimeout(function () {
        if (LoadLocalBool('AutoLoadChatEnabled') == true) { RA_autoloadchat(); }
    }, 200);


    //Autoconnect on page load if enabled, or when api type is changed
    if (LoadLocalBool("AutoConnectEnabled") == true) { RA_autoconnect(); }
    $("#main_api").change(function () {
        var PrevAPI = main_api;
        setTimeout(() => RA_autoconnect(PrevAPI), 100);
    });
    $("#api_button").click(function () { setTimeout(RA_checkOnlineStatus, 100); });

    //toggle pin class when lock toggle clicked
    $(RPanelPin).on("click", function () {
        SaveLocal("NavLockOn", $(RPanelPin).prop("checked"));
        if ($(RPanelPin).prop("checked") == true) {
            //console.log('adding pin class to right nav');
            $(RightNavPanel).addClass('pinnedOpen');
        } else {
            //console.log('removing pin class from right nav');
            $(RightNavPanel).removeClass('pinnedOpen');

            if ($(RightNavPanel).hasClass('openDrawer') && $('.openDrawer').length > 1) {
                $(RightNavPanel).slideToggle(200, "swing");
                //$(rightNavDrawerIcon).toggleClass('openIcon closedIcon');
                $(RightNavPanel).toggleClass('openDrawer closedDrawer');
            }
        }
    });
    $(LPanelPin).on("click", function () {
        SaveLocal("LNavLockOn", $(LPanelPin).prop("checked"));
        if ($(LPanelPin).prop("checked") == true) {
            //console.log('adding pin class to Left nav');
            $(LeftNavPanel).addClass('pinnedOpen');
        } else {
            //console.log('removing pin class from Left nav');
            $(LeftNavPanel).removeClass('pinnedOpen');

            if ($(LeftNavPanel).hasClass('openDrawer') && $('.openDrawer').length > 1) {
                $(LeftNavPanel).slideToggle(200, "swing");
                //$(leftNavDrawerIcon).toggleClass('openIcon closedIcon');
                $(LeftNavPanel).toggleClass('openDrawer closedDrawer');
            }
        }
    });

    $(WIPanelPin).on("click", function () {
        SaveLocal("WINavLockOn", $(WIPanelPin).prop("checked"));
        if ($(WIPanelPin).prop("checked") == true) {
            console.debug('adding pin class to WI');
            $(WorldInfo).addClass('pinnedOpen');
        } else {
            console.debug('removing pin class from WI');
            $(WorldInfo).removeClass('pinnedOpen');

            if ($(WorldInfo).hasClass('openDrawer') && $('.openDrawer').length > 1) {
                console.debug('closing WI after lock removal');
                $(WorldInfo).slideToggle(200, "swing");
                //$(WorldInfoDrawerIcon).toggleClass('openIcon closedIcon');
                $(WorldInfo).toggleClass('openDrawer closedDrawer');
            }
        }
    });

    // read the state of right Nav Lock and apply to rightnav classlist
    $(RPanelPin).prop('checked', LoadLocalBool("NavLockOn"));
    if (LoadLocalBool("NavLockOn") == true) {
        //console.log('setting pin class via local var');
        $(RightNavPanel).addClass('pinnedOpen');
    }
    if ($(RPanelPin).prop('checked' == true)) {
        console.debug('setting pin class via checkbox state');
        $(RightNavPanel).addClass('pinnedOpen');
    }
    // read the state of left Nav Lock and apply to leftnav classlist
    $(LPanelPin).prop('checked', LoadLocalBool("LNavLockOn"));
    if (LoadLocalBool("LNavLockOn") == true) {
        //console.log('setting pin class via local var');
        $(LeftNavPanel).addClass('pinnedOpen');
    }
    if ($(LPanelPin).prop('checked' == true)) {
        console.debug('setting pin class via checkbox state');
        $(LeftNavPanel).addClass('pinnedOpen');
    }

    // read the state of left Nav Lock and apply to leftnav classlist
    $(WIPanelPin).prop('checked', LoadLocalBool("WINavLockOn"));
    if (LoadLocalBool("WINavLockOn") == true) {
        //console.log('setting pin class via local var');
        $(WorldInfo).addClass('pinnedOpen');
    }

    if ($(WIPanelPin).prop('checked' == true)) {
        console.debug('setting pin class via checkbox state');
        $(WorldInfo).addClass('pinnedOpen');
    }

    //save state of Right nav being open or closed
    $("#rightNavDrawerIcon").on("click", function () {
        if (!$("#rightNavDrawerIcon").hasClass('openIcon')) {
            SaveLocal('NavOpened', 'true');
        } else { SaveLocal('NavOpened', 'false'); }
    });

    //save state of Left nav being open or closed
    $("#leftNavDrawerIcon").on("click", function () {
        if (!$("#leftNavDrawerIcon").hasClass('openIcon')) {
            SaveLocal('LNavOpened', 'true');
        } else { SaveLocal('LNavOpened', 'false'); }
    });

    //save state of Left nav being open or closed
    $("#WorldInfo").on("click", function () {
        if (!$("#WorldInfo").hasClass('openIcon')) {
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

    //save AutoConnect and AutoLoadChat prefs
    $(AutoConnectCheckbox).on("change", function () { SaveLocal("AutoConnectEnabled", $(AutoConnectCheckbox).prop("checked")); });
    $(AutoLoadChatCheckbox).on("change", function () { SaveLocal("AutoLoadChatEnabled", $(AutoLoadChatCheckbox).prop("checked")); });

    $(SelectedCharacterTab).click(function () { SaveLocal('SelectedNavTab', 'rm_button_selected_ch'); });
    $("#rm_button_characters").click(function () { SaveLocal('SelectedNavTab', 'rm_button_characters'); });

    // when a char is selected from the list, save them as the auto-load character for next page load
    $(document).on("click", ".character_select", function () {
        SaveLocal('ActiveChar', $(this).attr('chid'));
        SaveLocal('ActiveGroup', null);
    });

    $(document).on("click", ".group_select", function () {
        SaveLocal('ActiveChar', null);
        SaveLocal('ActiveGroup', $(this).data('id'));
    });

    //this makes the chat input text area resize vertically to match the text size (limited by CSS at 50% window height)
    $('#send_textarea').on('input', function () {
        this.style.height = '40px';
        this.style.height = (this.scrollHeight) + 'px';
    });

    //Regenerate if user swipes on the last mesage in chat

    document.addEventListener('swiped-left', function (e) {
        var SwipeButR = $('.swipe_right:last');
        var SwipeTargetMesClassParent = e.target.closest('.last_mes');
        if (SwipeTargetMesClassParent !== null) {
            if (SwipeButR.css('display') === 'flex') {
                SwipeButR.click();
            }
        }
    });
    document.addEventListener('swiped-right', function (e) {
        var SwipeButL = $('.swipe_left:last');
        var SwipeTargetMesClassParent = e.target.closest('.last_mes');
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
        processHotkeys(event);
    });

    //Additional hotkeys CTRL+ENTER and CTRL+UPARROW
    function processHotkeys(event) {
        //Enter to send when send_textarea in focus
        if ($(':focus').attr('id') === 'send_textarea') {
            const sendOnEnter = shouldSendOnEnter();
            if (!event.shiftKey && !event.ctrlKey && event.key == "Enter" && is_send_press == false && sendOnEnter) {
                event.preventDefault();
                Generate();
            }
        }
        //ctrl+shift+up to scroll to context line
        if (event.shiftKey && event.ctrlKey && event.key == "ArrowUp") {
            event.preventDefault();
            let contextLine = $('.lastInContext');
            if (contextLine.length !== 0) {
                $('#chat').animate({
                    scrollTop: contextLine.offset().top - $('#chat').offset().top + $('#chat').scrollTop()
                }, 300);
            } else { toastr.warning('Context line not found, send a message first!'); }
        }
        //ctrl+shift+down to scroll to bottom of chat
        if (event.shiftKey && event.ctrlKey && event.key == "ArrowDown") {
            event.preventDefault();
            $('#chat').animate({
                scrollTop: $('#chat').prop('scrollHeight')
            }, 300);
        }

        // Ctrl+Enter for Regeneration Last Response. If editing, accept the edits instead
        if (event.ctrlKey && event.key == "Enter") {
            const editMesDone = $(".mes_edit_done:visible");
            if (editMesDone.length > 0) {
                console.debug("Accepting edits with Ctrl+Enter");
                editMesDone.trigger('click');
            } else if (is_send_press == false) {
                console.debug("Regenerating with Ctrl+Enter");
                $('#option_regenerate').click();
                $('#options').hide();
            } else {
                console.debug("Ctrl+Enter ignored");
            }
        }
        //ctrl+left to show all local stored vars (debug)
        if (event.ctrlKey && event.key == "ArrowLeft") {
            CheckLocal();
        }

        if (event.key == "ArrowLeft") {        //swipes left
            if (
                $(".swipe_left:last").css('display') === 'flex' &&
                $("#send_textarea").val() === '' &&
                $("#character_popup").css("display") === "none" &&
                $("#shadow_select_chat_popup").css("display") === "none" &&
                !isInputElementInFocus()
            ) {
                $('.swipe_left:last').click();
            }
        }
        if (event.key == "ArrowRight") { //swipes right
            if (
                $(".swipe_right:last").css('display') === 'flex' &&
                $("#send_textarea").val() === '' &&
                $("#character_popup").css("display") === "none" &&
                $("#shadow_select_chat_popup").css("display") === "none" &&
                !isInputElementInFocus()
            ) {
                $('.swipe_right:last').click();
            }
        }

        if (event.ctrlKey && event.key == "ArrowUp") { //edits last USER message if chatbar is empty and focused
            console.debug('got ctrl+uparrow input');
            if (
                $("#send_textarea").val() === '' &&
                chatbarInFocus === true &&
                $(".swipe_right:last").css('display') === 'flex' &&
                $("#character_popup").css("display") === "none" &&
                $("#shadow_select_chat_popup").css("display") === "none"
            ) {
                const isUserMesList = document.querySelectorAll('div[is_user="true"]');
                const lastIsUserMes = isUserMesList[isUserMesList.length - 1];
                const editMes = lastIsUserMes.querySelector('.mes_block .mes_edit');
                if (editMes !== null) {
                    $(editMes).click();
                }
            }
        }

        if (event.key == "ArrowUp") { //edits last message if chatbar is empty and focused
            //console.log('got uparrow input');
            if (
                $("#send_textarea").val() === '' &&
                chatbarInFocus === true &&
                $(".swipe_right:last").css('display') === 'flex' &&
                $("#character_popup").css("display") === "none" &&
                $("#shadow_select_chat_popup").css("display") === "none"
            ) {
                const lastMes = document.querySelector('.last_mes');
                const editMes = lastMes.querySelector('.mes_block .mes_edit');
                if (editMes !== null) {
                    $(editMes).click();
                }
            }
        }
    }
});
