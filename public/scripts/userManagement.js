async function registerNewUser() {
    let handle = String($("#newUserHandle").val());
    let name = String($("#newUserName").val());
    let password = String($("#newUserPassword").val());
    let passwordConfirm = String($("#newUserPasswordConfirm").val());

    if (handle.length < 4) {
        alert('Username must be at least 4 characters long');
        return;
    }

    if (password.length < 8) {
        alert('Password must be at least 8 characters long');
        return;
    }

    if (password !== passwordConfirm) {
        alert("Passwords don't match!")
        return
    }

    const newUser = {
        handle: handle,
        name: name || 'Anonymous',
        password: password,
        enabled: true
    };

    try {
        const response = await $.ajax({
            url: '/api/users/create',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(newUser),
        });

        console.log(response);
        if (response.handle) {
            console.log('saw user created successfully')
            alert('New user created!')
            $("#userSelectBlock").empty()
            populateUserList()
            $("#userListBlock").show()
            $("#registerNewUserBlock").hide()
            $("#registerNewUserBlock input").val('')

        }
    } catch (error) {
        console.error('Error creating new user:', error);
        alert(error.responseText)
    }
}

async function loginUser() {
    const password = $("#userPassword").val();
    const handle = $('.userSelect.selected').data('foruser');
    const userInfo = {
        handle: handle,
        password: password,
    };

    try {
        const response = await $.ajax({
            url: '/api/users/login',
            type: 'POST',
            contentType: 'application/json',
            data: JSON.stringify(userInfo),
        });

        console.log(response);
        if (response.handle) {
            console.log('successfully logged in');
            alert(`logged in as ${handle}!`);
            $('#loader').animate({ opacity: 0 }, 300, function () {
                // Insert user handle/password verification code here
                // .finally:
                $('#loader').remove();
            });
        }
    } catch (error) {
        console.error('Error logging in:', error);
        alert(error.responseText);
    }
}

export async function populateUserList() {
    const userList = await getUserList();

    const registerNewUserButtonHTML = `<div id="registerNewUserButton" class="menu_button flex-container flexFlowCol">New User</div>`

    const newUserRegisterationHTML = `
        <div class="flex-container flexFlowColumn">
            Register New SillyTavern User
            <div class="flex-container">Username: <input id="newUserHandle" class="text_pole"></div>
            <div class="flex-container">Display Name: <input id="newUserName" class="text_pole"></div>
            <div class="flex-container">Password: <input id="newUserPassword" class="text_pole" type="password"></div>
            <div class="flex-container">Password confirm: <input id="newUserPasswordConfirm" class="text_pole" type="password"></div>
            This will create a new subfolder in the /data/ directory.
            <div class="flex-container">
                <div id="newUserRegisterFinalizeButton" class="menu_button">Register</div>
                <div id="newUserRegisterCancelButton" class="menu_button">Cancel</div>
            </div>
        </div>
    `

    const userSelectHTML = `

        <div id="registerNewUserBlock" style="display:none;">
           ${newUserRegisterationHTML}
        </div>
    </div>
  `;

    // Add login screen
    $('#loader').append(userSelectHTML);

    const parentDiv = $('#userList');

    userList.forEach(user => {
        const userDiv = $('<div></div>')
            .attr('id', `userSelect-${user.handle}`)
            .attr('data-foruser', user.name)
            .addClass('userSelect menu_button flex-container flexFlowCol');

        const avatarImg = $('<img>')
            .addClass('avatar')
            .attr('src', user.avatar);

        userDiv.append(avatarImg);

        const userName = $('<span></span>').text(user.name);
        userDiv.append(userName);

        parentDiv.append(userDiv);
    });

    parentDiv.append(registerNewUserButtonHTML)

    $(".userSelect").off('click').on("click", function () {
        let selectedUserName = $(this).data('foruser')
        $('.userSelect').removeClass('avatar-container selected')
        $(this).addClass('avatar-container selected')
        console.log(selectedUserName)
        $("#passwordHeaderText").text(`Enter password for ${selectedUserName}`)
        $("#passwordEntryBlock").show()
    });

    $("#registerNewUserButton").off('click').on('click', function () {
        $("#userListBlock").hide()
        $("#registerNewUserBlock").show()
    })

    $("#newUserRegisterFinalizeButton").off('click').on('click', registerNewUser)

    $("#newUserRegisterCancelButton").off('click').on('click', function () {
        $("#userListBlock").show()
        $("#registerNewUserBlock").hide()
    })

    $("#loginButton").off('click').on('click', loginUser)
}
