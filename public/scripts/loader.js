const ELEMENT_ID = 'loader';

import { delay } from "./utils.js";

export function showLoader() {
    const container = $('<div></div>').attr('id', ELEMENT_ID);
    const loader = $('<div></div>').attr('id', 'load-spinner').addClass('fa-solid fa-gear fa-spin fa-3x');
    container.append(loader);
    $('body').append(container);
}


//placeholder user data
const user1 =
{
    handle: 'user0',
    avatarSrc: 'https://cdn-icons-png.flaticon.com/256/147/147144.png',
    name: 'Admin',
    password: true
}

const user2 =
{
    handle: 'user1',
    avatarSrc: 'https://cdn.iconscout.com/icon/free/png-256/free-avatar-370-456322.png',
    name: 'Guest',
    password: true
}

const userSelectMessage = `
    <div class="flex-container flexFlowColumn alignItemsCenter">
        <h3>Select User</h3>
        <small>This is merely a test. <br> Click a user, and then click Login to proceed.</small>
        <div class="flex-container justifyCenter">
            <div id="userSelect-${user1.handle}" data-foruser="${user1.name}" class="userSelect menu_button flex-container flexFlowCol"><img class='avatar' src="${user1.avatarSrc}">${user1.name}</div>
            <div id="userSelect-${user2.handle}" data-foruser="${user2.name}" class="userSelect menu_button flex-container flexFlowCol"><img class='avatar' src="${user2.avatarSrc}">${user2.name}</div>
            <div id="registerNewUserButton" class="menu_button flex-container flexFlowCol">New User</div>
        </div>
        <div id="passwordEntryBlock" style="display:none;" class="flex-container flexFlowColumn alignItemsCenter">
            <h4 id="passwordHeaderText"></h4>
            <input id="userPassword" class="text_pole" type="password">
            <div id="loginButton" class='menu_button'>Login</div>
        </div>
    </div>
    `


export async function hideLoader() {
    //Sets up a 2-step animation. Spinner blurs/fades out, and then the loader shadow does the same.
    $('#load-spinner').on('transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd', function () {
        //$('#loader-spinner')
        $(`#${ELEMENT_ID}`)
            //only fade out the spinner and replace with login screen
            .animate({ opacity: 0 }, 300, function () {
                //dont remove the loader container just yet
                $(`#${ELEMENT_ID}`).remove();
            });
    });


    //console.log('BLURRING SPINNER')
    $('#load-spinner')
        .css({
            'filter': 'blur(15px)',
            'opacity': '0',
        });

    //add login screen
    //$('#loader').append(userSelectMessage)

    $(".userSelect").on("click", function () {
        let selectedUserName = $(this).data('foruser')
        $('.userSelect').removeClass('avatar-container selected')
        $(this).addClass('avatar-container selected')
        console.log(selectedUserName)
        $("#passwordHeaderText").text(`Enter password for ${selectedUserName}`)
        $("#passwordEntryBlock").show()
    })

    $("#loginButton").on('click', function () {
        $('#loader')
            .animate({ opacity: 0 }, 300, function () {

                //insert user handle/password verification code here

                //.finally:
                $('#loader').remove();
            });
    })



}


