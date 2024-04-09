import { callPopup, getRequestHeaders, renderTemplate } from '../script.js';

/**
 * @type {import('../../src/users.js').User} Logged in user
 */
export let currentUser = null;

/**
 * Enable or disable user account controls in the UI.
 * @param {boolean} isEnabled User account controls enabled
 * @returns {Promise<void>}
 */
export async function setUserControls(isEnabled) {
    if (!isEnabled) {
        $('#account_controls').hide();
        return;
    }

    $('#account_controls').show();
    await getCurrentUser();
}

/**
 * Check if the current user is an admin.
 * @returns {boolean} True if the current user is an admin
 */
function isAdmin() {
    if (!currentUser) {
        return false;
    }

    return Boolean(currentUser.admin);
}

/**
 * Get the current user.
 * @returns {Promise<void>}
 */
async function getCurrentUser() {
    try {
        const response = await fetch('/api/users/me', {
            headers: getRequestHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to get current user');
        }

        currentUser = await response.json();
        $('#admin_button').toggle(isAdmin());
    } catch (error) {
        console.error('Error getting current user:', error);
    }
}

async function getUsers() {
    try {
        const response = await fetch('/api/users/get', {
            method: 'POST',
            headers: getRequestHeaders(),
        });

        if (!response.ok) {
            throw new Error('Failed to get users');
        }

        return response.json();
    } catch (error) {
        console.error('Error getting users:', error);
    }
}

/**
 * Enable a user account.
 * @param {string} handle User handle
 * @param {function} callback Success callback
 * @returns {Promise<void>}
 */
async function enableUser(handle, callback) {
    try {
        const response = await fetch('/api/users/enable', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ handle }),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to enable user');
            throw new Error('Failed to enable user');
        }

        callback();
    } catch (error) {
        console.error('Error enabling user:', error);
    }
}

async function disableUser(handle, callback) {
    try {
        const response = await fetch('/api/users/disable', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ handle }),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data?.error || 'Unknown error', 'Failed to disable user');
            throw new Error('Failed to disable user');
        }

        callback();
    } catch (error) {
        console.error('Error disabling user:', error);
    }
}

/**
 * Promote a user to admin.
 * @param {string} handle User handle
 * @param {function} callback Success callback
 * @returns {Promise<void>}
 */
async function promoteUser(handle, callback) {
    try {
        const response = await fetch('/api/users/promote', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ handle }),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to promote user');
            throw new Error('Failed to promote user');
        }

        callback();
    } catch (error) {
        console.error('Error promoting user:', error);
    }
}

/**
 * Demote a user from admin.
 * @param {string} handle User handle
 * @param {function} callback Success callback
 */
async function demoteUser(handle, callback) {
    try {
        const response = await fetch('/api/users/demote', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ handle }),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to demote user');
            throw new Error('Failed to demote user');
        }

        callback();
    } catch (error) {
        console.error('Error demoting user:', error);
    }
}

/**
 * Create a new user.
 * @param {HTMLFormElement} form Form element
 */
async function createUser(form, callback) {
    const errors = [];
    const formData = new FormData(form);

    if (!formData.get('handle')) {
        errors.push('Handle is required');
    }

    if (formData.get('password') !== formData.get('confirm')) {
        errors.push('Passwords do not match');
    }

    if (errors.length) {
        toastr.error(errors.join(', '), 'Failed to create user');
        return;
    }

    const body = {};
    formData.forEach(function (value, key) {
        if (key === 'confirm') {
            return;
        }
        if (key.startsWith('_')) {
            key = key.substring(1);
        }
        body[key] = value;
    });

    try {
        const response = await fetch('/api/users/create', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to create user');
            throw new Error('Failed to create user');
        }

        form.reset();
        callback();
    } catch (error) {
        console.error('Error creating user:', error);
    }
}

/**
 * Backup a user's data.
 * @param {string} handle Handle of the user to backup
 * @param {function} callback Success callback
 * @returns {Promise<void>}
 */
async function backupUserData(handle, callback) {
    try {
        toastr.info('Please wait for the download to start.', 'Backup Requested');
        const response = await fetch('/api/users/backup', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ handle }),
        });

        if (!response.ok) {
            const data = await response.json();
            toastr.error(data.error || 'Unknown error', 'Failed to backup user data');
            throw new Error('Failed to backup user data');
        }

        const blob = await response.blob();
        const header = response.headers.get('Content-Disposition');
        const parts = header.split(';');
        const filename = parts[1].split('=')[1].replaceAll('"', '');
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = filename;
        a.click();
        URL.revokeObjectURL(url);
        callback();
    } catch (error) {
        console.error('Error backing up user data:', error);
    }
}

async function openAdminPanel() {
    async function renderUsers() {
        const users = await getUsers();
        template.find('.usersList').empty();
        for (const user of users) {
            const userBlock = template.find('.userAccountTemplate .userAccount').clone();
            userBlock.find('.userName').text(user.name);
            userBlock.find('.userHandle').text(user.handle);
            userBlock.find('.userStatus').text(user.enabled ? 'Enabled' : 'Disabled');
            userBlock.find('.userRole').text(user.admin ? 'Admin' : 'User');
            userBlock.find('.avatar img').attr('src', user.avatar);
            userBlock.find('.hasPassword').toggle(user.password);
            userBlock.find('.noPassword').toggle(!user.password);
            userBlock.find('.userCreated').text(new Date(user.created).toLocaleString());
            userBlock.find('.userEnableButton').toggle(!user.enabled).on('click', () => enableUser(user.handle, renderUsers));
            userBlock.find('.userDisableButton').toggle(user.enabled).on('click', () => disableUser(user.handle, renderUsers));
            userBlock.find('.userPromoteButton').toggle(!user.admin).on('click', () => promoteUser(user.handle, renderUsers));
            userBlock.find('.userDemoteButton').toggle(user.admin).on('click', () => demoteUser(user.handle, renderUsers));
            userBlock.find('.userBackupButton').on('click', function () {
                $(this).addClass('disabled').off('click');
                backupUserData(user.handle, renderUsers);
            });
            template.find('.usersList').append(userBlock);
        }
    }

    const template = $(renderTemplate('admin'));

    template.find('.adminNav > button').on('click', function () {
        const target = String($(this).data('target-tab'));
        template.find('.navTab').each(function () {
            $(this).toggle(this.classList.contains(target));
        });
    });

    template.find('.userCreateForm').on('submit', function (event) {
        if (!(event.target instanceof HTMLFormElement)) {
            return;
        }

        event.preventDefault();
        createUser(event.target, () => {
            template.find('.manageUsersButton').trigger('click');
            renderUsers();
        });
    });

    callPopup(template, 'text', '', { okButton: 'Close', wide: true, large: true, allowVerticalScrolling: true, allowHorizontalScrolling: false });
    renderUsers();
}

/**
 * Log out the current user.
 * @returns {Promise<void>}
 */
async function logout() {
    await fetch('/api/users/logout', {
        method: 'POST',
        headers: getRequestHeaders(),
    });

    window.location.reload();
}

jQuery(() => {
    $('#logout_button').on('click', () => {
        logout();
    });
    $('#admin_button').on('click', () => {
        openAdminPanel();
    });
});
