import { main_api, saveSettingsDebounced } from '../../../script.js';
import { extension_settings, renderExtensionTemplateAsync } from '../../extensions.js';
import { callGenericPopup, Popup, POPUP_TYPE } from '../../popup.js';
import { executeSlashCommandsWithOptions } from '../../slash-commands.js';

const MODULE_NAME = 'connection-manager';

const DEFAULT_SETTINGS = {
    profiles: [],
    selectedProfile: null,
};

const COMMON_COMMANDS = [
    'api',
    'preset',
    'model',
];

const CC_COMMANDS = [
    ...COMMON_COMMANDS,
    'proxy',
];

const TC_COMMANDS = [
    ...COMMON_COMMANDS,
    'instruct',
    'context',
    'instruct-state',
    'tokenizer',
];

const FANCY_NAMES = {
    'api': 'API',
    'preset': 'Settings Preset',
    'model': 'Model',
    'proxy': 'Proxy Preset',
    'instruct-state': 'Instruct Mode',
    'instruct': 'Instruct Template',
    'context': 'Context Template',
    'tokenizer': 'Tokenizer',
};

/**
 * @typedef {Object} ConnectionProfile
 * @property {string} id Unique identifier
 * @property {string} mode Mode of the connection profile
 * @property {string} [name] Name of the connection profile
 * @property {string} [api] API
 * @property {string} [preset] Settings Preset
 * @property {string} [model] Model
 * @property {string} [proxy] Proxy Preset
 * @property {string} [instruct] Instruct Template
 * @property {string} [context] Context Template
 * @property {string} [instruct-state] Instruct Mode
 * @property {string} [tokenizer] Tokenizer
 */

const escapeArgument = (a) => a.replace(/"/g, '\\"').replace(/\|/g, '\\|');

/**
 * Reads the connection profile from the commands.
 * @param {string} mode Mode of the connection profile
 * @param {ConnectionProfile} profile Connection profile
 * @param {boolean} [cleanUp] Whether to clean up the profile
 */
async function readProfileFromCommands(mode, profile, cleanUp = false) {
    const commands = mode === 'cc' ? CC_COMMANDS : TC_COMMANDS;
    const opposingCommands = mode === 'cc' ? TC_COMMANDS : CC_COMMANDS;
    for (const command of commands) {
        const commandText = `/${command} quiet=true`;
        try {
            const result = await executeSlashCommandsWithOptions(commandText, { handleParserErrors: false, handleExecutionErrors: false });
            if (result.pipe) {
                profile[command] = result.pipe;
                continue;
            }
        } catch (error) {
            console.warn(`Failed to execute command: ${commandText}`, error);
        }
    }

    if (cleanUp) {
        for (const command of opposingCommands) {
            if (commands.includes(command)) {
                continue;
            }

            delete profile[command];
        }
    }
}

/**
 * Creates a new connection profile.
 * @returns {Promise<ConnectionProfile>} Created connection profile
 */
async function createConnectionProfile() {
    const mode = main_api === 'openai' ? 'cc' : 'tc';
    const id = 'profile-' + Math.random().toString(36).substring(2);
    const profile = {
        id,
        mode,
    };

    await readProfileFromCommands(mode, profile);

    const profileForDisplay = makeFancyProfile(profile);
    const template = await renderExtensionTemplateAsync(MODULE_NAME, 'profile', { profile: profileForDisplay });
    const suggestedName = `${profile.api} ${profile.model} - ${profile.preset}`;
    const name = await callGenericPopup(template, POPUP_TYPE.INPUT, suggestedName, { rows: 2 });

    if (!name) {
        return;
    }

    profile.name = name;
    return profile;
}

/**
 * Deletes the selected connection profile.
 * @returns {Promise<void>}
 */
async function deleteConnectionProfile() {
    const selectedProfile = extension_settings.connectionManager.selectedProfile;
    if (!selectedProfile) {
        return;
    }

    const index = extension_settings.connectionManager.profiles.findIndex(p => p.id === selectedProfile);
    if (index === -1) {
        return;
    }

    const confirm = await Popup.show.confirm('Are you sure you want to delete the selected profile?', null);

    if (!confirm) {
        return;
    }

    extension_settings.connectionManager.profiles.splice(index, 1);
    extension_settings.connectionManager.selectedProfile = null;
    saveSettingsDebounced();
}

/**
 * Formats the connection profile for display.
 * @param {ConnectionProfile} profile Connection profile
 * @returns {Object} Fancy profile
 */
function makeFancyProfile(profile) {
    return Object.entries(FANCY_NAMES).reduce((acc, [key, value]) => {
        if (!profile[key]) return acc;
        acc[value] = profile[key];
        return acc;
    }, {});
}

/**
 * Applies the connection profile.
 * @param {ConnectionProfile} profile Connection profile
 * @returns {Promise<void>}
 */
async function applyConnectionProfile(profile) {
    if (!profile) {
        return;
    }

    const mode = profile.mode;
    const commands = mode === 'cc' ? CC_COMMANDS : TC_COMMANDS;

    for (const command of commands) {
        const argument = profile[command];
        if (!argument) {
            continue;
        }
        const commandText = `/${command} quiet=true ${escapeArgument(argument)}`;
        try {
            await executeSlashCommandsWithOptions(commandText, { handleParserErrors: false, handleExecutionErrors: false });
        } catch (error) {
            console.warn(`Failed to execute command: ${commandText}`, error);
        }
    }
}

/**
 * Updates the selected connection profile.
 * @returns {Promise<void>}
 */
async function updateConnectionProfile() {
    const selectedProfile = extension_settings.connectionManager.selectedProfile;
    const profile = extension_settings.connectionManager.profiles.find(p => p.id === selectedProfile);
    if (!profile) {
        console.log('No profile selected');
        return;
    }

    profile.mode = main_api === 'openai' ? 'cc' : 'tc';
    await readProfileFromCommands(profile.mode, profile, true);
}

/**
 * Renders the connection profile details.
 * @param {HTMLSelectElement} profiles Select element containing connection profiles
 */
function renderConnectionProfiles(profiles) {
    profiles.innerHTML = '';
    const noneOption = document.createElement('option');

    noneOption.value = '';
    noneOption.textContent = '<None>';
    noneOption.selected = !extension_settings.connectionManager.selectedProfile;
    profiles.appendChild(noneOption);

    for (const profile of extension_settings.connectionManager.profiles) {
        const option = document.createElement('option');
        option.value = profile.id;
        option.textContent = profile.name;
        option.selected = profile.id === extension_settings.connectionManager.selectedProfile;
        profiles.appendChild(option);
    }
}

/**
 * Renders the content of the details element.
 * @param {HTMLDetailsElement} details Details element
 * @param {HTMLElement} detailsContent Content element of the details
 */
async function renderDetailsContent(details, detailsContent) {
    detailsContent.innerHTML = '';
    if (details.open) {
        const selectedProfile = extension_settings.connectionManager.selectedProfile;
        const profile = extension_settings.connectionManager.profiles.find(p => p.id === selectedProfile);
        if (profile) {
            const profileForDisplay = makeFancyProfile(profile);
            const template = await renderExtensionTemplateAsync(MODULE_NAME, 'view', { profile: profileForDisplay });
            detailsContent.innerHTML = template;
        } else {
            detailsContent.textContent = 'No profile selected';
        }
    }
}

(async function () {
    extension_settings.connectionManager = extension_settings.connectionManager || structuredClone(DEFAULT_SETTINGS);

    for (const key of Object.keys(DEFAULT_SETTINGS)) {
        if (extension_settings.connectionManager[key] === undefined) {
            extension_settings.connectionManager[key] = DEFAULT_SETTINGS[key];
        }
    }

    const container = document.getElementById('rm_api_block');
    const settings = await renderExtensionTemplateAsync(MODULE_NAME, 'settings');
    container.insertAdjacentHTML('afterbegin', settings);

    /** @type {HTMLSelectElement} */
    // @ts-ignore
    const profiles = document.getElementById('connection_profiles');
    renderConnectionProfiles(profiles);

    profiles.addEventListener('change', async function () {
        const selectedProfile = profiles.selectedOptions[0];
        if (!selectedProfile) {
            return;
        }

        const profileId = selectedProfile.value;
        extension_settings.connectionManager.selectedProfile = profileId;
        saveSettingsDebounced();
        await renderDetailsContent(details, detailsContent);

        const profile = extension_settings.connectionManager.profiles.find(p => p.id === profileId);

        if (!profile) {
            console.log(`Profile not found: ${profileId}`);
            return;
        }

        await applyConnectionProfile(profile);
    });

    const reloadButton = document.getElementById('reload_connection_profile');
    reloadButton.addEventListener('click', async () => {
        const selectedProfile = extension_settings.connectionManager.selectedProfile;
        const profile = extension_settings.connectionManager.profiles.find(p => p.id === selectedProfile);
        if (!profile) {
            console.log('No profile selected');
            return;
        }
        await applyConnectionProfile(profile);
        await renderDetailsContent(details, detailsContent);
        toastr.success('Connection profile reloaded', '', { timeOut: 1500 });
    });

    const createButton = document.getElementById('create_connection_profile');
    createButton.addEventListener('click', async () => {
        const profile = await createConnectionProfile();
        extension_settings.connectionManager.profiles.push(profile);
        extension_settings.connectionManager.selectedProfile = profile.id;
        saveSettingsDebounced();
        renderConnectionProfiles(profiles);
        await renderDetailsContent(details, detailsContent);
    });

    const updateButton = document.getElementById('update_connection_profile');
    updateButton.addEventListener('click', async () => {
        await updateConnectionProfile();
        await renderDetailsContent(details, detailsContent);
        saveSettingsDebounced();
        toastr.success('Connection profile updated', '', { timeOut: 1500 });
    });

    const deleteButton = document.getElementById('delete_connection_profile');
    deleteButton.addEventListener('click', async () => {
        await deleteConnectionProfile();
        renderConnectionProfiles(profiles);
        await renderDetailsContent(details, detailsContent);
    });

    /** @type {HTMLDetailsElement} */
    // @ts-ignore
    const details = document.getElementById('connection_profile_details');
    const detailsContent = document.getElementById('connection_profile_details_content');
    details.addEventListener('toggle', () => renderDetailsContent(details, detailsContent));
})();
