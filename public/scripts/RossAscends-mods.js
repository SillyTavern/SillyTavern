esversion: 6

import {
    Generate,
    this_chid,
    characters,
    online_status,
    main_api,
    api_server,
    nai_settings,
    api_server_textgenerationwebui,
    is_send_press,
    getTokenCount,
    selected_button,

} from "../script.js";

import {
    power_user,
} from "./power-user.js";

import { LoadLocal, SaveLocal, ClearLocal, CheckLocal, LoadLocalBool } from "./f-localStorage.js";
import { selected_group, is_group_generating } from "./group-chats.js";
import { oai_settings } from "./openai.js";
import { poe_settings } from "./poe.js";

var NavToggle = document.getElementById("nav-toggle");
var RPanelPin = document.getElementById("rm_button_panel_pin");
var LPanelPin = document.getElementById("lm_button_panel_pin");
var SelectedCharacterTab = document.getElementById("rm_button_selected_ch");
var RightNavPanel = document.getElementById("right-nav-panel");
var LeftNavPanel = document.getElementById("left-nav-panel")
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
var retry_delay = 100;
var RA_AC_retries = 1;

let isVirtualKB = false;
let lastKeyDownTime = 0;
let lastKeyUpTime = 0;

const observerConfig = { childList: true, subtree: true };

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

waitForElement("#expression-image", 10000).then(function () {

    dragElement(document.getElementById("expression-holder"));
}).catch(() => {
    console.log("expression holder not loaded yet");
});


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
$("#rm_ch_create_block").on("input", function () { RA_CountCharTokens(); });
//when any input is made to the advanced editing popup textareas
$("#character_popup").on("input", function () { RA_CountCharTokens(); });
//function:
function RA_CountCharTokens() {
    $("#result_info").html("");
    //console.log('RA_TC -- starting with this_chid = ' + this_chid);
    if (selected_button === "create") {            //if new char
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
        } else { console.log("RA_TC -- no valid char found, closing."); }                // if neither, probably safety char or some error in loading
    }
    // display the counted tokens
    if (count_tokens < 1024 && perm_tokens < 1024) {
        $("#result_info").html(count_tokens + " Tokens (" + perm_tokens + " Permanent Tokens)");      //display normal if both counts are under 1024
    } else {
        $("#result_info").html(`
        <span class="neutral_warning">${count_tokens}</span>&nbsp;Tokens (<span class="neutral_warning">${perm_tokens}</span><span>&nbsp;Permanent Tokens)
        <br>
        <div id="chartokenwarning" class="menu_button whitespacenowrap"><a href="/notes#charactertokens" target="_blank">Learn More About Token 'Limits'</a></div>`);
    } //warn if either are over 1024
}
//Auto Load Last Charcter -- (fires when active_character is defined and auto_load_chat is true)
async function RA_autoloadchat() {
    if (document.getElementById('CharID0') !== null) {
        //console.log('char list loaded! clicking activeChar');
        var CharToAutoLoad = document.getElementById('CharID' + LoadLocal('ActiveChar'));
        //console.log(CharToAutoLoad);
        let autoLoadGroup = document.querySelector(`.group_select[grid="${LoadLocal('ActiveGroup')}"]`);
        //console.log(autoLoadGroup);
        if (CharToAutoLoad != null) {


            // console.log('--ALC - clicking character');
            CharToAutoLoad.click();
            CharToAutoLoad.click();

        }
        else if (autoLoadGroup != null) {
            //console.log('--ALC - clicking group');
            autoLoadGroup.click();
            autoLoadGroup.click();
        }
        else {
            console.log(CharToAutoLoad + ' ActiveChar local var - not found: ' + LoadLocal('ActiveChar'));
        }
        RestoreNavTab();
    } else {
        //console.log('no char list yet..');
        setTimeout(RA_autoloadchat, 100);            // if the charcter list hadn't been loaded yet, try again. 
    }
}
//only triggers when AutoLoadChat is enabled, consider adding this as an independent feature later. 
function RestoreNavTab() {
    if ($('#rm_button_selected_ch').children("h2").text() !== '') {        //check for a change in the character edit tab name
        //console.log('detected ALC char finished loaded, proceeding to restore tab.');
        $(SelectedNavTab).click();                                     //click to restore saved tab when name has changed (signalling char load is done)
    } else {
        setTimeout(RestoreNavTab, 100);                                //if not changed yet, check again after 100ms
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
            $("#send_textarea").attr("placeholder", "Type a message..."); //on connect, placeholder tells user to type message
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
    if (online_status === undefined) {
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
                if (nai_settings.api_key_novel) {
                    $("#api_button_novel").click();

                }
                break;
            case 'textgenerationwebui':
                if (api_server_textgenerationwebui && isUrlOrAPIKey(api_server_textgenerationwebui)) {
                    $("#api_button_textgenerationwebui").click();
                }
                break;
            case 'openai':
                if (oai_settings.api_key_openai) {
                    $("#api_button_openai").click();
                }
                break;
            case 'poe':
                if (poe_settings.token) {
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
    //auto-open R nav if locked and previously open
    if (LoadLocalBool("NavLockOn") == true && LoadLocalBool("NavOpened") == true) {
        console.log("RA -- clicking right nav to open");
        $("#rightNavDrawerIcon").click();
    } else {
        /*         console.log('didnt see reason to open right nav on load: R-nav locked? ' +
                    LoadLocalBool("NavLockOn")
                    + ' R-nav was open before? ' +
                    LoadLocalBool("NavOpened" == true)); */
    }

    //auto-open L nav if locked and previously open

    if (LoadLocalBool("LNavLockOn") == true && LoadLocalBool("LNavOpened") == true) {
        console.log("RA -- clicking left nav to open");
        $("#leftNavDrawerIcon").click();
    } else {
        /*         console.log('didnt see reason to open left nav on load: L-Nav Locked? ' +
                    LoadLocalBool("LNavLockOn")
                    + ' L-nav was open before? ' +
                    LoadLocalBool("LNavOpened" == true)); */
    }
}


// Make the DIV element draggable:
dragElement(document.getElementById("sheld"));
dragElement(document.getElementById("left-nav-panel"));
dragElement(document.getElementById("right-nav-panel"));



function dragElement(elmnt) {
    var pos1 = 0, pos2 = 0, pos3 = 0, pos4 = 0;
    if (document.getElementById(elmnt.id + "header")) { //ex: id="sheldheader"
        // if present, the header is where you move the DIV from, but this overrides everything else:
        document.getElementById(elmnt.id + "header").onmousedown = dragMouseDown;
    } else {
        // otherwise, move the DIV from anywhere inside the DIV, b:
        elmnt.onmousedown = dragMouseDown;
    }

    function dragMouseDown(e) {
        e = e || window.event;
        e.preventDefault();
        // get the mouse cursor position at startup:
        pos3 = e.clientX; //mouse X at click
        pos4 = e.clientY; //mouse Y at click
        document.onmouseup = closeDragElement;
        // call a function whenever the cursor moves:
        document.onmousemove = elementDrag;
    }

    function elementDrag(e) {
        //disable scrollbars when dragging to prevent jitter
        $("body").css("overflow", "hidden");


        //get window size
        let winWidth = window.innerWidth;
        let winHeight = window.innerHeight;

        //get necessary data for calculating element footprint
        let draggableHeight = parseInt(getComputedStyle(elmnt).getPropertyValue('height').slice(0, -2));
        let draggableWidth = parseInt(getComputedStyle(elmnt).getPropertyValue('width').slice(0, -2));
        let draggableTop = parseInt(getComputedStyle(elmnt).getPropertyValue('top').slice(0, -2));
        let draggableLeft = parseInt(getComputedStyle(elmnt).getPropertyValue('left').slice(0, -2));
        let sheldWidth = parseInt(getComputedStyle(document.documentElement).getPropertyValue('--sheldWidth').slice(0, -2));
        let topBarFirstX = (winWidth - sheldWidth) / 2;
        let topBarLastX = topBarFirstX + sheldWidth;

        //set the lowest and most-right pixel the element touches
        let maxX = (draggableWidth + draggableLeft);
        let maxY = (draggableHeight + draggableTop);

        // calculate the new cursor position:
        e = e || window.event;
        e.preventDefault();

        pos1 = pos3 - e.clientX;    //X change amt
        pos2 = pos4 - e.clientY;    //Y change amt
        pos3 = e.clientX;   //new mouse X
        pos4 = e.clientY;   //new mouse Y



        //fix over/underflows:

        setTimeout(function () {
            if (elmnt.offsetTop < 40) {
                /* console.log('6'); */
                if (maxX > topBarFirstX && maxX < topBarLastX) {
                    /* console.log('maxX inside topBar!'); */
                    elmnt.style.top = "42px";
                }
                if (elmnt.offsetLeft < topBarLastX && elmnt.offsetLeft > topBarFirstX) {
                    /* console.log('offsetLeft inside TopBar!'); */
                    elmnt.style.top = "42px";
                }
            }

            if (elmnt.offsetTop - pos2 <= 0) {
                /* console.log('1'); */
                //prevent going out of window top + 42px barrier for TopBar (can hide grabber)
                elmnt.style.top = "0px";
            }

            if (elmnt.offsetLeft - pos1 <= 0) {
                /* console.log('2'); */
                //prevent moving out of window left
                elmnt.style.left = "0px";
            }

            if (maxX >= winWidth) {
                /* console.log('3'); */
                //bounce off right
                elmnt.style.left = elmnt.offsetLeft - 10 + "px";
            }

            if (maxY >= winHeight) {
                /* console.log('4'); */
                //bounce off bottom
                elmnt.style.top = elmnt.offsetTop - 10 + "px";
                if (elmnt.offsetTop - pos2 <= 40) {
                    /* console.log('5'); */
                    //prevent going out of window top + 42px barrier for TopBar (can hide grabber)
                    /* console.log('caught Y bounce to <40Y top'); */
                    elmnt.style.top = "20px";
                }
            }
            // if no problems, set element's new position
            /* console.log('7'); */

            elmnt.style.left = (elmnt.offsetLeft - pos1) + "px";
            elmnt.style.top = (elmnt.offsetTop - pos2) + "px";
            $(elmnt).css("bottom", "unset");
            $(elmnt).css("right", "unset");

            /*             console.log(`
                                        offsetLeft: ${elmnt.offsetLeft}, offsetTop: ${elmnt.offsetTop}
                                        winWidth: ${winWidth}, winHeight: ${winHeight}
                                        sheldWidth: ${sheldWidth}
                                        X: ${elmnt.style.left} 
                                        Y: ${elmnt.style.top} 
                                        MaxX: ${maxX}, MaxY: ${maxY} 
                                        Topbar 1st X: ${((winWidth - sheldWidth) / 2)} 
                                        TopBar lastX: ${((winWidth - sheldWidth) / 2) + sheldWidth}
                                            `); */



        }, 50)

        /* console.log("left/top: " + (elmnt.offsetLeft - pos1) + "/" + (elmnt.offsetTop - pos2) +
            ", win: " + winWidth + "/" + winHeight +
            ", max X / Y: " + maxX + " / " + maxY); */

    }

    function closeDragElement() {
        // stop moving when mouse button is released:
        document.onmouseup = null;
        document.onmousemove = null;
        //revert scrolling to normal after drag to allow recovery of vastly misplaced elements
        $("body").css("overflow", "auto");

    }
}

// ---------------------------------------------------

$("document").ready(function () {

    // initial status check
    setTimeout(RA_checkOnlineStatus, 100);

    // read the state of AutoConnect and AutoLoadChat.
    $(AutoConnectCheckbox).prop("checked", LoadLocalBool("AutoConnectEnabled"));
    $(AutoLoadChatCheckbox).prop("checked", LoadLocalBool("AutoLoadChatEnabled"));

    if (LoadLocalBool('AutoLoadChatEnabled') == true) { RA_autoloadchat(); }
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
            console.log('adding pin class to right nav');
            $(RightNavPanel).addClass('pinnedOpen');
        } else {
            console.log('removing pin class from right nav');
            $(RightNavPanel).removeClass('pinnedOpen');

            if ($(RightNavPanel).hasClass('openDrawer') && $('.openDrawer').length > 1) {
                $(RightNavPanel).slideToggle(200, "swing");
                $(rightNavDrawerIcon).toggleClass('openIcon closedIcon');
                $(RightNavPanel).toggleClass('openDrawer closedDrawer');
            }
        }
    });
    $(LPanelPin).on("click", function () {
        SaveLocal("LNavLockOn", $(LPanelPin).prop("checked"));
        if ($(LPanelPin).prop("checked") == true) {
            console.log('adding pin class to Left nav');
            $(LeftNavPanel).addClass('pinnedOpen');
        } else {
            console.log('removing pin class from Left nav');
            $(LeftNavPanel).removeClass('pinnedOpen');

            if ($(LeftNavPanel).hasClass('openDrawer') && $('.openDrawer').length > 1) {
                $(LeftNavPanel).slideToggle(200, "swing");
                $(leftNavDrawerIcon).toggleClass('openIcon closedIcon');
                $(LeftNavPanel).toggleClass('openDrawer closedDrawer');
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
        console.log('setting pin class via checkbox state');
        $(RightNavPanel).addClass('pinnedOpen');
    }
    // read the state of left Nav Lock and apply to leftnav classlist
    $(LPanelPin).prop('checked', LoadLocalBool("LNavLockOn"));
    if (LoadLocalBool("LNavLockOn") == true) {
        //console.log('setting pin class via local var');
        $(LeftNavPanel).addClass('pinnedOpen');
    }
    if ($(LPanelPin).prop('checked' == true)) {
        console.log('setting pin class via checkbox state');
        $(LeftNavPanel).addClass('pinnedOpen');
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
    $("#rm_button_characters").click(function () {            //if char list is clicked, in addition to saving it...
        SaveLocal('SelectedNavTab', 'rm_button_characters');
        characters.sort(Intl.Collator().compare);            // we sort the list    
    });

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
        if (focused.is('input') || focused.is('textarea')) {
            if (focused.attr('id') === 'send_textarea') {
                return false;
            }
            return true;
        }
        return false;
    }

    document.addEventListener("keydown", () => {
        lastKeyDownTime = new Date().getTime();
    })

    document.addEventListener('keyup', (event) => {
        lastKeyUpTime = new Date().getTime();
        isVirtualKeyboard(event);
    })


    function isVirtualKeyboard(event) {
        var keyTiming = lastKeyUpTime - lastKeyDownTime;                   // array to store times
        if (keyTiming <= 40) {
            console.log(`detected VKB (${keyTiming}ms)`);
            return;
        }
        if (keyTiming > 40) {
            console.log(`detected PhysKB (${keyTiming}ms)`);
            processHotkeys(event);
        }
    }

    //Additional hotkeys CTRL+ENTER and CTRL+UPARROW
    function processHotkeys(event) {
        //Enter to send when send_textarea in focus
        if ($(':focus').attr('id') === 'send_textarea') {
            if (!event.shiftKey && !event.ctrlKey && event.key == "Enter" && is_send_press == false) {
                event.preventDefault();
                Generate();
            }
        }

        if (event.ctrlKey && event.key == "Enter") {
            // Ctrl+Enter for Regeneration Last Response
            if (is_send_press == false) {
                $('#option_regenerate').click();
                $('#options').hide();
            }
        }

        if (event.ctrlKey && event.key == "ArrowLeft") {        //for debug, show all local stored vars
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
            console.log('got ctrl+uparrow input');
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
            console.log('got uparrow input');
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

