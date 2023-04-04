esversion: 6
import { encode } from "../scripts/gpt-2-3-tokenizer/mod.js";

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

} from "../script.js";

import {
    power_user,
} from "./power-user.js";

import { LoadLocal, SaveLocal, ClearLocal, CheckLocal, LoadLocalBool } from "./f-localStorage.js";
import { selected_group, is_group_generating } from "./group-chats.js";
import { oai_settings } from "./openai.js";
import { poe_settings } from "./poe.js";

var NavToggle = document.getElementById("nav-toggle");
var PanelPin = document.getElementById("rm_button_panel_pin");
var SelectedCharacterTab = document.getElementById("rm_button_selected_ch");
var RightNavPanel = document.getElementById("right-nav-panel");
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
$("#rm_ch_create_block").on("input", function () { RA_CountCharTokens(); });                      //when any input is made to the create/edit character form textareas
$("#character_popup").on("input", function () { RA_CountCharTokens(); });                      //when any input is made to the advanced editing popup textareas
//function:
function RA_CountCharTokens() {
    $("#result_info").html("");
    //console.log('RA_TC -- starting with this_chid = ' + this_chid);
    if (document.getElementById('name_div').style.display == "block") {            //if new char

        $("#form_create").on("input", function () {                                    //fill temp vars with form_create values
            create_save_name = $("#character_name_pole").val();
            create_save_description = $("#description_textarea").val();
            create_save_first_message = $("#firstmessage_textarea").val();
        });
        $("#character_popup").on("input", function () {                                //fill temp vars with advanced popup values
            create_save_personality = $("#personality_textarea").val();
            create_save_scenario = $("#scenario_pole").val();
            create_save_mes_example = $("#mes_example_textarea").val();

        });

        //count total tokens, including those that will be removed from context once chat history is long
        count_tokens = encode(JSON.stringify(
            create_save_name +
            create_save_description +
            create_save_personality +
            create_save_scenario +
            create_save_first_message +
            create_save_mes_example
        )).length;

        //count permanent tokens that will never get flushed out of context
        perm_tokens = encode(JSON.stringify(
            create_save_name +
            create_save_description +
            create_save_personality +
            create_save_scenario
        )).length;

    } else {
        if (this_chid !== undefined && this_chid !== "invalid-safety-id") {    // if we are counting a valid pre-saved char

            //same as above, all tokens including temporary ones
            count_tokens = encode(
                JSON.stringify(
                    characters[this_chid].description +
                    characters[this_chid].personality +
                    characters[this_chid].scenario +
                    characters[this_chid].first_mes +
                    characters[this_chid].mes_example
                )).length;

            //permanent tokens count
            perm_tokens = encode(
                JSON.stringify(
                    characters[this_chid].name +
                    characters[this_chid].description +
                    characters[this_chid].personality +
                    characters[this_chid].scenario +
                    (power_user.pin_examples ? characters[this_chid].mes_example : '') // add examples to permanent if they are pinned
                )).length;
        } else { console.log("RA_TC -- no valid char found, closing."); }                // if neither, probably safety char or some error in loading
    }
    // display the counted tokens
    if (count_tokens < 1024 && perm_tokens < 1024) {
        $("#result_info").html(count_tokens + " Tokens (" + perm_tokens + " Permanent Tokens)");      //display normal if both counts are under 1024
    } else { $("#result_info").html("<font color=red>" + count_tokens + " Tokens (" + perm_tokens + " Permanent Tokens)(TOO MANY)</font>"); } //warn if either are over 1024
}
//Auto Load Last Charcter -- (fires when active_character is defined and auto_load_chat is true)
async function RA_autoloadchat() {
    if (document.getElementById('CharID0') !== null) {
        //console.log('char list loaded! clicking activeChar');
        var CharToAutoLoad = document.getElementById('CharID' + LoadLocal('ActiveChar'));
        let autoLoadGroup = document.querySelector(`.group_select[grid="${LoadLocal('ActiveGroup')}"]`);
        if (CharToAutoLoad != null) {
            CharToAutoLoad.click();
        }
        else if (autoLoadGroup != null) {
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
        $("#send_form").css("background-color", "rgba(100,0,0,0.5)"); //entire input form area is red when not connected
        $("#send_but").css("display", "none"); //send button is hidden when not connected;
        $("#API-status-top").addClass("redOverlayGlow");
        connection_made = false;
    } else {
        if (online_status !== undefined && online_status !== "no_connection") {
            $("#send_textarea").attr("placeholder", "Type a message..."); //on connect, placeholder tells user to type message
            const formColor = power_user.fast_ui_mode ? "var(--black90a)" : "var(--black60a)";
            $("#send_form").css("background-color", formColor); //on connect, form BG changes to transprent black
            $("#API-status-top").removeClass("redOverlayGlow");
            connection_made = true;
            retry_delay = 100;
            RA_AC_retries = 1;

            if (!is_send_press && !(selected_group && is_group_generating)) {
                $("#send_but").css("display", "inline"); //on connect, send button shows
            }
        }
    }
}
//Auto-connect to API (when set to kobold, API URL exists, and auto_connect is true)

function RA_autoconnect(PrevApi) {
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
        RA_autoconnect(PrevAPI);
    });
    $("#api_button").click(function () { setTimeout(RA_checkOnlineStatus, 100); });

    //toggle pin class when lock toggle clicked
    $(PanelPin).on("click", function () {
        SaveLocal("NavLockOn", $(PanelPin).prop("checked"));
        if ($(PanelPin).prop("checked") == true) {
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

    // read the state of Nav Lock and apply to rightnav classlist
    $(PanelPin).prop('checked', LoadLocalBool("NavLockOn"));
    if (LoadLocalBool("NavLockOn") == true) {
        //console.log('setting pin class via local var');
        $(RightNavPanel).addClass('pinnedOpen');
    }
    if ($(PanelPin).prop('checked' == true)) {
        console.log('setting pin class via checkbox state');
        $(RightNavPanel).addClass('pinnedOpen');
    }

    //save state of nav being open or closed
    $("#rightNavDrawerIcon").on("click", function () {
        if (!$("#rightNavDrawerIcon").hasClass('openIcon')) {
            SaveLocal('NavOpened', 'true');
        } else { SaveLocal('NavOpened', 'false'); }
    });

    if (LoadLocalBool("NavLockOn") == true && LoadLocalBool("NavOpened") == true) {
        $("#rightNavDrawerIcon").click();
    } else {
        console.log('didnt see reason to open nav on load: ' +
            LoadLocalBool("NavLockOn")
            + ' nav open pref' +
            LoadLocalBool("NavOpened" == true));
    }

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
        return $(document.activeElement).is(":input");
    }

    //Additional hotkeys CTRL+ENTER and CTRL+UPARROW
    document.addEventListener("keydown", (event) => {
        if (event.ctrlKey && event.key == "Enter") {
            // Ctrl+Enter for Regeneration Last Response
            if (is_send_press == false) {

                $('#option_regenerate').click();
                $('#options').hide();
                //setTimeout(function () { $('#chat').click(); }, 50) //needed to remove the options menu popping up..
                //Generate("regenerate");
            }
        }
        if (event.ctrlKey && event.key == "ArrowUp") {
            //Ctrl+UpArrow for Connect to last server
            console.log(main_api);
            if (online_status === "no_connection") {
                if (main_api == "kobold") {
                    document.getElementById("api_button").click();
                }
                if (main_api == "novel") {
                    document.getElementById("api_button_novel").click();
                }
                if (main_api == "textgenerationwebui") {
                    document.getElementById("api_button_textgenerationwebui").click();
                }
            }
        }
        if (event.ctrlKey && event.key == "ArrowLeft") {        //for debug, show all local stored vars
            CheckLocal();
        }
        /*
        if (event.ctrlKey && event.key == "ArrowRight") {        //for debug, empty local storage state
            ClearLocal();
        }
        */
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
    });
});
