import { DOMPurify, Popper } from '../lib.js';

import { eventSource, event_types, saveSettings, saveSettingsDebounced, getRequestHeaders, animation_duration } from '../script.js';
import { showLoader } from './loader.js';
import { POPUP_RESULT, POPUP_TYPE, Popup, callGenericPopup } from './popup.js';
import { renderTemplate, renderTemplateAsync } from './templates.js';
import { delay, isSubsetOf, sanitizeSelector, setValueByPath } from './utils.js';
import { getContext } from './st-context.js';
import { isAdmin } from './user.js';
import { t } from './i18n.js';
import { debounce_timeout } from './constants.js';
import { accountStorage } from './util/AccountStorage.js';

export {
    getContext,
    getApiUrl,
};

/** @type {string[]} */
export let extensionNames = [];

/**
 * Holds the type of each extension.
 * Don't use this directly, use getExtensionType instead!
 * @type {Record<string, string>}
 */
export let extensionTypes = {};

/**
 * A list of active modules provided by the Extras API.
 * @type {string[]}
 */
export let modules = [];

/**
 * A set of active extensions.
 * @type {Set<string>}
 */
let activeExtensions = new Set();

const getApiUrl = () => extension_settings.apiUrl;
const sortManifestsByOrder = (a, b) => parseInt(a.loading_order) - parseInt(b.loading_order) || String(a.display_name).localeCompare(String(b.display_name));
const sortManifestsByName = (a, b) => String(a.display_name).localeCompare(String(b.display_name)) || parseInt(a.loading_order) - parseInt(b.loading_order);
let connectedToApi = false;

/**
 * Holds manifest data for each extension.
 * @type {Record<string, object>}
 */
let manifests = {};

/**
 * Default URL for the Extras API.
 */
const defaultUrl = 'http://localhost:5100';

let requiresReload = false;
let stateChanged = false;
let saveMetadataTimeout = null;

export function saveMetadataDebounced() {
    const context = getContext();
    const groupId = context.groupId;
    const characterId = context.characterId;

    if (saveMetadataTimeout) {
        clearTimeout(saveMetadataTimeout);
    }

    saveMetadataTimeout = setTimeout(async () => {
        const newContext = getContext();

        if (groupId !== newContext.groupId) {
            console.warn('Group changed, not saving metadata');
            return;
        }

        if (characterId !== newContext.characterId) {
            console.warn('Character changed, not saving metadata');
            return;
        }

        console.debug('Saving metadata...');
        await newContext.saveMetadata();
        console.debug('Saved metadata...');
    }, debounce_timeout.relaxed);
}

/**
 * Provides an ability for extensions to render HTML templates synchronously.
 * Templates sanitation and localization is forced.
 * @param {string} extensionName Extension name
 * @param {string} templateId Template ID
 * @param {object} templateData Additional data to pass to the template
 * @returns {string} Rendered HTML
 *
 * @deprecated Use renderExtensionTemplateAsync instead.
 */
export function renderExtensionTemplate(extensionName, templateId, templateData = {}, sanitize = true, localize = true) {
    return renderTemplate(`scripts/extensions/${extensionName}/${templateId}.html`, templateData, sanitize, localize, true);
}

/**
 * Provides an ability for extensions to render HTML templates asynchronously.
 * Templates sanitation and localization is forced.
 * @param {string} extensionName Extension name
 * @param {string} templateId Template ID
 * @param {object} templateData Additional data to pass to the template
 * @returns {Promise<string>} Rendered HTML
 */
export function renderExtensionTemplateAsync(extensionName, templateId, templateData = {}, sanitize = true, localize = true) {
    return renderTemplateAsync(`scripts/extensions/${extensionName}/${templateId}.html`, templateData, sanitize, localize, true);
}

// Disables parallel updates
export class ModuleWorkerWrapper {
    constructor(callback) {
        this.isBusy = false;
        this.callback = callback;
    }

    // Called by the extension
    async update(...args) {
        // Don't touch me I'm busy...
        if (this.isBusy) {
            return;
        }

        // I'm free. Let's update!
        try {
            this.isBusy = true;
            await this.callback(...args);
        }
        finally {
            this.isBusy = false;
        }
    }
}

export const extension_settings = {
    apiUrl: defaultUrl,
    apiKey: '',
    autoConnect: false,
    notifyUpdates: false,
    disabledExtensions: [],
    expressionOverrides: [],
    memory: {},
    note: {
        default: '',
        chara: [],
        wiAddition: [],
    },
    caption: {
        refine_mode: false,
    },
    expressions: {
        /** @type {string[]} */
        custom: [],
    },
    connectionManager: {
        selectedProfile: '',
        /** @type {import('./extensions/connection-manager/index.js').ConnectionProfile[]} */
        profiles: [],
    },
    dice: {},
    /** @type {import('./char-data.js').RegexScriptData[]} */
    regex: [],
    character_allowed_regex: [],
    tts: {},
    sd: {
        prompts: {},
        character_prompts: {},
        character_negative_prompts: {},
    },
    chromadb: {},
    translate: {},
    objective: {},
    quickReply: {},
    randomizer: {
        controls: [],
        fluctuation: 0.1,
        enabled: false,
    },
    speech_recognition: {},
    rvc: {},
    hypebot: {},
    vectors: {},
    variables: {
        global: {},
    },
    /**
     * @type {import('./chats.js').FileAttachment[]}
     */
    attachments: [],
    /**
     * @type {Record<string, import('./chats.js').FileAttachment[]>}
     */
    character_attachments: {},
    /**
     * @type {string[]}
     */
    disabled_attachments: [],
};

function showHideExtensionsMenu() {
    // Get the number of menu items that are not hidden
    const hasMenuItems = $('#extensionsMenu').children().filter((_, child) => $(child).css('display') !== 'none').length > 0;

    // We have menu items, so we can stop checking
    if (hasMenuItems) {
        clearInterval(menuInterval);
    }

    // Show or hide the menu button
    $('#extensionsMenuButton').toggle(hasMenuItems);
}

// Periodically check for new extensions
const menuInterval = setInterval(showHideExtensionsMenu, 1000);

/**
 * Gets the type of an extension based on its external ID.
 * @param {string} externalId External ID of the extension (excluding or including the leading 'third-party/')
 * @returns {string} Type of the extension (global, local, system, or empty string if not found)
 */
function getExtensionType(externalId) {
    const id = Object.keys(extensionTypes).find(id => id === externalId || (id.startsWith('third-party') && id.endsWith(externalId)));
    return id ? extensionTypes[id] : '';
}

/**
 * Performs a fetch of the Extras API.
 * @param {string|URL} endpoint Extras API endpoint
 * @param {RequestInit} args Request arguments
 * @returns {Promise<Response>} Response from the fetch
 */
export async function doExtrasFetch(endpoint, args = {}) {
    if (!args) {
        args = {};
    }

    if (!args.method) {
        Object.assign(args, { method: 'GET' });
    }

    if (!args.headers) {
        args.headers = {};
    }

    if (extension_settings.apiKey) {
        Object.assign(args.headers, {
            'Authorization': `Bearer ${extension_settings.apiKey}`,
        });
    }

    return await fetch(endpoint, args);
}

/**
 * Discovers extensions from the API.
 * @returns {Promise<{name: string, type: string}[]>}
 */
async function discoverExtensions() {
    try {
        const response = await fetch('/api/extensions/discover');

        if (response.ok) {
            const extensions = await response.json();
            return extensions;
        }
        else {
            return [];
        }
    }
    catch (err) {
        console.error(err);
        return [];
    }
}

function onDisableExtensionClick() {
    const name = $(this).data('name');
    disableExtension(name, false);
}

function onEnableExtensionClick() {
    const name = $(this).data('name');
    enableExtension(name, false);
}

/**
 * Enables an extension by name.
 * @param {string} name Extension name
 * @param {boolean} [reload=true] If true, reload the page after enabling the extension
 */
export async function enableExtension(name, reload = true) {
    extension_settings.disabledExtensions = extension_settings.disabledExtensions.filter(x => x !== name);
    stateChanged = true;
    await saveSettings();
    if (reload) {
        location.reload();
    } else {
        requiresReload = true;
    }
}

/**
 * Disables an extension by name.
 * @param {string} name Extension name
 * @param {boolean} [reload=true] If true, reload the page after disabling the extension
 */
export async function disableExtension(name, reload = true) {
    extension_settings.disabledExtensions.push(name);
    stateChanged = true;
    await saveSettings();
    if (reload) {
        location.reload();
    } else {
        requiresReload = true;
    }
}

/**
 * Loads manifest.json files for extensions.
 * @param {string[]} names Array of extension names
 * @returns {Promise<Record<string, object>>} Object with extension names as keys and their manifests as values
 */
async function getManifests(names) {
    const obj = {};
    const promises = [];

    for (const name of names) {
        const promise = new Promise((resolve, reject) => {
            fetch(`/scripts/extensions/${name}/manifest.json`).then(async response => {
                if (response.ok) {
                    const json = await response.json();
                    obj[name] = json;
                    resolve();
                } else {
                    reject();
                }
            }).catch(err => {
                reject();
                console.log('Could not load manifest.json for ' + name, err);
            });
        });

        promises.push(promise);
    }

    await Promise.allSettled(promises);
    return obj;
}

/**
 * Tries to activate all available extensions that are not already active.
 * @returns {Promise<void>}
 */
async function activateExtensions() {
    const extensions = Object.entries(manifests).sort((a, b) => sortManifestsByOrder(a[1], b[1]));
    const promises = [];

    for (let entry of extensions) {
        const name = entry[0];
        const manifest = entry[1];

        if (activeExtensions.has(name)) {
            continue;
        }

        const meetsModuleRequirements = !Array.isArray(manifest.requires) || isSubsetOf(modules, manifest.requires);
        const isDisabled = extension_settings.disabledExtensions.includes(name);

        if (meetsModuleRequirements && !isDisabled) {
            try {
                console.debug('Activating extension', name);
                const promise = Promise.all([addExtensionScript(name, manifest), addExtensionStyle(name, manifest)]);
                await promise
                    .then(() => activeExtensions.add(name))
                    .catch(err => console.log('Could not activate extension', name, err));
                promises.push(promise);
            }
            catch (error) {
                console.error('Could not activate extension', name);
                console.error(error);
            }
        }
    }

    await Promise.allSettled(promises);
}

async function connectClickHandler() {
    const baseUrl = String($('#extensions_url').val());
    extension_settings.apiUrl = baseUrl;
    const testApiKey = $('#extensions_api_key').val();
    extension_settings.apiKey = String(testApiKey);
    saveSettingsDebounced();
    await connectToApi(baseUrl);
}

function autoConnectInputHandler() {
    const value = $(this).prop('checked');
    extension_settings.autoConnect = !!value;

    if (value && !connectedToApi) {
        $('#extensions_connect').trigger('click');
    }

    saveSettingsDebounced();
}

async function addExtensionsButtonAndMenu() {
    const buttonHTML = await renderTemplateAsync('wandButton');
    const extensionsMenuHTML = await renderTemplateAsync('wandMenu');

    $(document.body).append(extensionsMenuHTML);
    $('#leftSendForm').append(buttonHTML);

    const button = $('#extensionsMenuButton');
    const dropdown = $('#extensionsMenu');
    let isDropdownVisible = false;

    let popper = Popper.createPopper(button.get(0), dropdown.get(0), {
        placement: 'top-start',
    });

    $(button).on('click', function () {
        if (isDropdownVisible) {
            dropdown.fadeOut(animation_duration);
            isDropdownVisible = false;
        } else {
            dropdown.fadeIn(animation_duration);
            isDropdownVisible = true;
        }
        popper.update();
    });

    $('html').on('click', function (e) {
        if (!isDropdownVisible) return;
        const clickTarget = $(e.target);
        const noCloseTargets = ['#sd_gen', '#extensionsMenuButton', '#roll_dice'];
        if (!noCloseTargets.some(id => clickTarget.closest(id).length > 0)) {
            dropdown.fadeOut(animation_duration);
            isDropdownVisible = false;
        }
    });
}

function notifyUpdatesInputHandler() {
    extension_settings.notifyUpdates = !!$('#extensions_notify_updates').prop('checked');
    saveSettingsDebounced();

    if (extension_settings.notifyUpdates) {
        checkForExtensionUpdates(true);
    }
}

/**
 * Connects to the Extras API.
 * @param {string} baseUrl Extras API base URL
 * @returns {Promise<void>}
 */
async function connectToApi(baseUrl) {
    if (!baseUrl) {
        return;
    }

    const url = new URL(baseUrl);
    url.pathname = '/api/modules';

    try {
        const getExtensionsResult = await doExtrasFetch(url);

        if (getExtensionsResult.ok) {
            const data = await getExtensionsResult.json();
            modules = data.modules;
            await activateExtensions();
            await eventSource.emit(event_types.EXTRAS_CONNECTED, modules);
        }

        updateStatus(getExtensionsResult.ok);
    }
    catch {
        updateStatus(false);
    }
}

/**
 * Updates the status of Extras API connection.
 * @param {boolean} success Whether the connection was successful
 */
function updateStatus(success) {
    connectedToApi = success;
    const _text = success ? t`Connected to API` : t`Could not connect to API`;
    const _class = success ? 'success' : 'failure';
    $('#extensions_status').text(_text);
    $('#extensions_status').attr('class', _class);
}

/**
 * Adds a CSS file for an extension.
 * @param {string} name Extension name
 * @param {object} manifest Extension manifest
 * @returns {Promise<void>} When the CSS is loaded
 */
function addExtensionStyle(name, manifest) {
    if (!manifest.css) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        const url = `/scripts/extensions/${name}/${manifest.css}`;
        const id = sanitizeSelector(`${name}-css`);

        if ($(`link[id="${id}"]`).length === 0) {
            const link = document.createElement('link');
            link.id = id;
            link.rel = 'stylesheet';
            link.type = 'text/css';
            link.href = url;
            link.onload = function () {
                resolve();
            };
            link.onerror = function (e) {
                reject(e);
            };
            document.head.appendChild(link);
        }
    });
}

/**
 * Loads a JS file for an extension.
 * @param {string} name Extension name
 * @param {object} manifest Extension manifest
 * @returns {Promise<void>} When the script is loaded
 */
function addExtensionScript(name, manifest) {
    if (!manifest.js) {
        return Promise.resolve();
    }

    return new Promise((resolve, reject) => {
        const url = `/scripts/extensions/${name}/${manifest.js}`;
        const id = sanitizeSelector(`${name}-js`);
        let ready = false;

        if ($(`script[id="${id}"]`).length === 0) {
            const script = document.createElement('script');
            script.id = id;
            script.type = 'module';
            script.src = url;
            script.async = true;
            script.onerror = function (err) {
                reject(err);
            };
            script.onload = function () {
                if (!ready) {
                    ready = true;
                    resolve();
                }
            };
            document.body.appendChild(script);
        }
    });
}

/**
 * Generates HTML string for displaying an extension in the UI.
 *
 * @param {string} name - The name of the extension.
 * @param {object} manifest - The manifest of the extension.
 * @param {boolean} isActive - Whether the extension is active or not.
 * @param {boolean} isDisabled - Whether the extension is disabled or not.
 * @param {boolean} isExternal - Whether the extension is external or not.
 * @param {string} checkboxClass - The class for the checkbox HTML element.
 * @return {string} - The HTML string that represents the extension.
 */
function generateExtensionHtml(name, manifest, isActive, isDisabled, isExternal, checkboxClass) {
    function getExtensionIcon() {
        const type = getExtensionType(name);
        switch (type) {
            case 'global':
                return '<i class="fa-sm fa-fw fa-solid fa-server" data-i18n="[title]ext_type_global" title="This is a global extension, available for all users."></i>';
            case 'local':
                return '<i class="fa-sm fa-fw fa-solid fa-user" data-i18n="[title]ext_type_local" title="This is a local extension, available only for you."></i>';
            case 'system':
                return '<i class="fa-sm fa-fw fa-solid fa-cog" data-i18n="[title]ext_type_system" title="This is a built-in extension. It cannot be deleted and updates with the app."></i>';
            default:
                return '<i class="fa-sm fa-fw fa-solid fa-question" title="Unknown extension type."></i>';
        }
    }

    const isUserAdmin = isAdmin();
    const extensionIcon = getExtensionIcon();
    const displayName = manifest.display_name;
    const displayVersion = manifest.version || '';
    const externalId = name.replace('third-party', '');
    let originHtml = '';
    if (isExternal) {
        originHtml = '<a>';
    }

    let toggleElement = isActive || isDisabled ?
        `<input type="checkbox" title="Click to toggle" data-name="${name}" class="${isActive ? 'toggle_disable' : 'toggle_enable'} ${checkboxClass}" ${isActive ? 'checked' : ''}>` :
        `<input type="checkbox" title="Cannot enable extension" data-name="${name}" class="extension_missing ${checkboxClass}" disabled>`;

    let deleteButton = isExternal ? `<button class="btn_delete menu_button" data-name="${externalId}" title="Delete"><i class="fa-fw fa-solid fa-trash-can"></i></button>` : '';
    let updateButton = isExternal ? `<button class="btn_update menu_button displayNone" data-name="${externalId}" title="Update available"><i class="fa-solid fa-download fa-fw"></i></button>` : '';
    let moveButton = isExternal && isUserAdmin ? `<button class="btn_move menu_button" data-name="${externalId}" title="Move"><i class="fa-solid fa-folder-tree fa-fw"></i></button>` : '';
    let modulesInfo = '';

    if (isActive && Array.isArray(manifest.optional)) {
        const optional = new Set(manifest.optional);
        modules.forEach(x => optional.delete(x));
        if (optional.size > 0) {
            const optionalString = DOMPurify.sanitize([...optional].join(', '));
            modulesInfo = `<div class="extension_modules">Optional modules: <span class="optional">${optionalString}</span></div>`;
        }
    } else if (!isDisabled) { // Neither active nor disabled
        const requirements = new Set(manifest.requires);
        modules.forEach(x => requirements.delete(x));
        if (requirements.size > 0) {
            const requirementsString = DOMPurify.sanitize([...requirements].join(', '));
            modulesInfo = `<div class="extension_modules">Missing modules: <span class="failure">${requirementsString}</span></div>`;
        }
    }

    // if external, wrap the name in a link to the repo

    let extensionHtml = `
        <div class="extension_block" data-name="${externalId}">
            <div class="extension_toggle">
                ${toggleElement}
            </div>
            <div class="extension_icon">
                ${extensionIcon}
            </div>
            <div class="flexGrow extension_text_block">
                ${originHtml}
                <span class="${isActive ? 'extension_enabled' : isDisabled ? 'extension_disabled' : 'extension_missing'}">
                    <span class="extension_name">${DOMPurify.sanitize(displayName)}</span>
                    <span class="extension_version">${DOMPurify.sanitize(displayVersion)}</span>
                    ${modulesInfo}
                </span>
                ${isExternal ? '</a>' : ''}
            </div>

            <div class="extension_actions flex-container alignItemsCenter">
                ${updateButton}
                ${moveButton}
                ${deleteButton}
            </div>
        </div>`;

    return extensionHtml;
}

/**
 * Gets extension data and generates the corresponding HTML for displaying the extension.
 *
 * @param {Array} extension - An array where the first element is the extension name and the second element is the extension manifest.
 * @return {object} - An object with 'isExternal' indicating whether the extension is external, and 'extensionHtml' for the extension's HTML string.
 */
function getExtensionData(extension) {
    const name = extension[0];
    const manifest = extension[1];
    const isActive = activeExtensions.has(name);
    const isDisabled = extension_settings.disabledExtensions.includes(name);
    const isExternal = name.startsWith('third-party');

    const checkboxClass = isDisabled ? 'checkbox_disabled' : '';

    const extensionHtml = generateExtensionHtml(name, manifest, isActive, isDisabled, isExternal, checkboxClass);

    return { isExternal, extensionHtml };
}


/**
 * Gets the module information to be displayed.
 *
 * @return {string} - The HTML string for the module information.
 */
function getModuleInformation() {
    let moduleInfo = modules.length ? `<p>${DOMPurify.sanitize(modules.join(', '))}</p>` : '<p class="failure">' + t`Not connected to the API!` + '</p>';
    return `
        <h3>` + t`Modules provided by your Extras API:` + `</h3>
        ${moduleInfo}
    `;
}

/**
 * Generates the HTML strings for all extensions and displays them in a popup.
 */
async function showExtensionsDetails() {
    const abortController = new AbortController();
    let popupPromise;
    try {
        // If we are updating an extension, the "old" popup is still active. We should close that.
        let initialScrollTop = 0;
        const oldPopup = Popup.util.popups.find(popup => popup.content.querySelector('.extensions_info'));
        if (oldPopup) {
            initialScrollTop = oldPopup.content.scrollTop;
            await oldPopup.completeCancelled();
        }
        const htmlDefault = $('<div class="marginBot10"><h3 class="textAlignCenter">' + t`Built-in Extensions:` + '</h3></div>');
        const htmlExternal = $('<div class="marginBot10"><h3 class="textAlignCenter">' + t`Installed Extensions:` + '</h3></div>');
        const htmlLoading = $(`<div class="flex-container alignItemsCenter justifyCenter marginTop10 marginBot5">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <span>` + t`Loading third-party extensions... Please wait...` + `</span>
        </div>`);

        htmlExternal.append(htmlLoading);

        const sortOrderKey = 'extensions_sortByName';
        const sortByName = accountStorage.getItem(sortOrderKey) === 'true';
        const sortFn = sortByName ? sortManifestsByName : sortManifestsByOrder;
        const extensions = Object.entries(manifests).sort((a, b) => sortFn(a[1], b[1])).map(getExtensionData);

        extensions.forEach(value => {
            const { isExternal, extensionHtml } = value;
            const container = isExternal ? htmlExternal : htmlDefault;
            container.append(extensionHtml);
        });

        const html = $('<div></div>')
            .addClass('extensions_info')
            .append(htmlDefault)
            .append(htmlExternal)
            .append(getModuleInformation());

        /** @type {import('./popup.js').CustomPopupButton} */
        const updateAllButton = {
            text: t`Update all`,
            action: async () => {
                requiresReload = true;
                await autoUpdateExtensions(true);
                await popup.complete(POPUP_RESULT.AFFIRMATIVE);
            },
        };

        /** @type {import('./popup.js').CustomPopupButton} */
        const sortOrderButton = {
            text: sortByName ? t`Sort: Display Name` : t`Sort: Loading Order`,
            action: async () => {
                abortController.abort();
                accountStorage.setItem(sortOrderKey, sortByName ? 'false' : 'true');
                await showExtensionsDetails();
            },
        };

        let waitingForSave = false;

        const popup = new Popup(html, POPUP_TYPE.TEXT, '', {
            okButton: t`Close`,
            wide: true,
            large: true,
            customButtons: [sortOrderButton, updateAllButton],
            allowVerticalScrolling: true,
            onClosing: async () => {
                if (waitingForSave) {
                    return false;
                }
                if (stateChanged) {
                    waitingForSave = true;
                    const toast = toastr.info(t`The page will be reloaded shortly...`, t`Extensions state changed`);
                    await saveSettings();
                    toastr.clear(toast);
                    waitingForSave = false;
                    requiresReload = true;
                }
                return true;
            },
        });
        popupPromise = popup.show();
        popup.content.scrollTop = initialScrollTop;
        checkForUpdatesManual(sortFn, abortController.signal).finally(() => htmlLoading.remove());
    } catch (error) {
        toastr.error(t`Error loading extensions. See browser console for details.`);
        console.error(error);
    }
    if (popupPromise) {
        await popupPromise;
        abortController.abort();
    }
    if (requiresReload) {
        showLoader();
        location.reload();
    }
}

/**
 * Handles the click event for the update button of an extension.
 * This function makes a POST request to '/api/extensions/update' with the extension's name.
 * If the extension is already up to date, it displays a success message.
 * If the extension is not up to date, it updates the extension and displays a success message with the new commit hash.
 */
async function onUpdateClick() {
    const isCurrentUserAdmin = isAdmin();
    const extensionName = $(this).data('name');
    const isGlobal = getExtensionType(extensionName) === 'global';
    if (isGlobal && !isCurrentUserAdmin) {
        toastr.error(t`You don't have permission to update global extensions.`);
        return;
    }

    const icon = $(this).find('i');
    icon.addClass('fa-spin');
    await updateExtension(extensionName, false);
    // updateExtension eats the error, but we can at least stop the spinner
    icon.removeClass('fa-spin');
}

/**
 * Updates a third-party extension via the API.
 * @param {string} extensionName Extension folder name
 * @param {boolean} quiet If true, don't show a success message
 */
async function updateExtension(extensionName, quiet) {
    try {
        const response = await fetch('/api/extensions/update', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                extensionName,
                global: getExtensionType(extensionName) === 'global',
            }),
        });

        if (!response.ok) {
            const text = await response.text();
            toastr.error(text || response.statusText, t`Extension update failed`, { timeOut: 5000 });
            console.error('Extension update failed', response.status, response.statusText, text);
            return;
        }

        const data = await response.json();

        if (!quiet) {
            void showExtensionsDetails();
        }

        if (data.isUpToDate) {
            if (!quiet) {
                toastr.success('Extension is already up to date');
            }
        } else {
            toastr.success(t`Extension ${extensionName} updated to ${data.shortCommitHash}`, t`Reload the page to apply updates`);
        }
    } catch (error) {
        console.error('Error:', error);
    }
}

/**
 * Handles the click event for the delete button of an extension.
 * This function makes a POST request to '/api/extensions/delete' with the extension's name.
 * If the extension is deleted, it displays a success message.
 * Creates a popup for the user to confirm before delete.
 */
async function onDeleteClick() {
    const extensionName = $(this).data('name');
    const isCurrentUserAdmin = isAdmin();
    const isGlobal = getExtensionType(extensionName) === 'global';
    if (isGlobal && !isCurrentUserAdmin) {
        toastr.error(t`You don't have permission to delete global extensions.`);
        return;
    }

    // use callPopup to create a popup for the user to confirm before delete
    const confirmation = await callGenericPopup(t`Are you sure you want to delete ${extensionName}?`, POPUP_TYPE.CONFIRM, '', {});
    if (confirmation === POPUP_RESULT.AFFIRMATIVE) {
        await deleteExtension(extensionName);
    }
}

async function onMoveClick() {
    const extensionName = $(this).data('name');
    const isCurrentUserAdmin = isAdmin();
    const isGlobal = getExtensionType(extensionName) === 'global';
    if (isGlobal && !isCurrentUserAdmin) {
        toastr.error(t`You don't have permission to move extensions.`);
        return;
    }

    const source = getExtensionType(extensionName);
    const destination = source === 'global' ? 'local' : 'global';

    const confirmationHeader = t`Move extension`;
    const confirmationText = source == 'global'
        ? t`Are you sure you want to move ${extensionName} to your local extensions? This will make it available only for you.`
        : t`Are you sure you want to move ${extensionName} to the global extensions? This will make it available for all users.`;

    const confirmation = await Popup.show.confirm(confirmationHeader, confirmationText);

    if (!confirmation) {
        return;
    }

    $(this).find('i').addClass('fa-spin');
    await moveExtension(extensionName, source, destination);
}

/**
 * Moves an extension via the API.
 * @param {string} extensionName Extension name
 * @param {string} source Source type
 * @param {string} destination Destination type
 * @returns {Promise<void>}
 */
async function moveExtension(extensionName, source, destination) {
    try {
        const result = await fetch('/api/extensions/move', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                extensionName,
                source,
                destination,
            }),
        });

        if (!result.ok) {
            const text = await result.text();
            toastr.error(text || result.statusText, t`Extension move failed`, { timeOut: 5000 });
            console.error('Extension move failed', result.status, result.statusText, text);
            return;
        }

        toastr.success(t`Extension ${extensionName} moved.`);
        await loadExtensionSettings({}, false, false);
        void showExtensionsDetails();
    } catch (error) {
        console.error('Error:', error);
    }
}

/**
 * Deletes an extension via the API.
 * @param {string} extensionName Extension name to delete
 */
export async function deleteExtension(extensionName) {
    try {
        await fetch('/api/extensions/delete', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                extensionName,
                global: getExtensionType(extensionName) === 'global',
            }),
        });
    } catch (error) {
        console.error('Error:', error);
    }

    toastr.success(t`Extension ${extensionName} deleted`);
    delay(1000).then(() => location.reload());
}

/**
 * Fetches the version details of a specific extension.
 *
 * @param {string} extensionName - The name of the extension.
 * @param {AbortSignal} [abortSignal] - The signal to abort the operation.
 * @return {Promise<object>} - An object containing the extension's version details.
 * This object includes the currentBranchName, currentCommitHash, isUpToDate, and remoteUrl.
 * @throws {error} - If there is an error during the fetch operation, it logs the error to the console.
 */
async function getExtensionVersion(extensionName, abortSignal) {
    try {
        const response = await fetch('/api/extensions/version', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                extensionName,
                global: getExtensionType(extensionName) === 'global',
            }),
            signal: abortSignal,
        });

        const data = await response.json();
        return data;
    } catch (error) {
        console.error('Error:', error);
    }
}

/**
 * Installs a third-party extension via the API.
 * @param {string} url Extension repository URL
 * @param {boolean} global Is the extension global?
 * @returns {Promise<void>}
 */
export async function installExtension(url, global) {
    console.debug('Extension installation started', url);

    toastr.info(t`Please wait...`, t`Installing extension`);

    const request = await fetch('/api/extensions/install', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({
            url,
            global,
        }),
    });

    if (!request.ok) {
        const text = await request.text();
        toastr.warning(text || request.statusText, t`Extension installation failed`, { timeOut: 5000 });
        console.error('Extension installation failed', request.status, request.statusText, text);
        return;
    }

    const response = await request.json();
    toastr.success(t`Extension '${response.display_name}' by ${response.author} (version ${response.version}) has been installed successfully!`, t`Extension installation successful`);
    console.debug(`Extension "${response.display_name}" has been installed successfully at ${response.extensionPath}`);
    await loadExtensionSettings({}, false, false);
    await eventSource.emit(event_types.EXTENSION_SETTINGS_LOADED);
}

/**
 * Loads extension settings from the app settings.
 * @param {object} settings App Settings
 * @param {boolean} versionChanged Is this a version change?
 * @param {boolean} enableAutoUpdate Enable auto-update
 */
export async function loadExtensionSettings(settings, versionChanged, enableAutoUpdate) {
    if (settings.extension_settings) {
        Object.assign(extension_settings, settings.extension_settings);
    }

    $('#extensions_url').val(extension_settings.apiUrl);
    $('#extensions_api_key').val(extension_settings.apiKey);
    $('#extensions_autoconnect').prop('checked', extension_settings.autoConnect);
    $('#extensions_notify_updates').prop('checked', extension_settings.notifyUpdates);

    // Activate offline extensions
    await eventSource.emit(event_types.EXTENSIONS_FIRST_LOAD);
    const extensions = await discoverExtensions();
    extensionNames = extensions.map(x => x.name);
    extensionTypes = Object.fromEntries(extensions.map(x => [x.name, x.type]));
    manifests = await getManifests(extensionNames);

    if (versionChanged && enableAutoUpdate) {
        await autoUpdateExtensions(false);
    }

    await activateExtensions();
    if (extension_settings.autoConnect && extension_settings.apiUrl) {
        connectToApi(extension_settings.apiUrl);
    }
}

export function doDailyExtensionUpdatesCheck() {
    setTimeout(() => {
        if (extension_settings.notifyUpdates) {
            checkForExtensionUpdates(false);
        }
    }, 1);
}

const concurrencyLimit = 5;
let activeRequestsCount = 0;
const versionCheckQueue = [];

function enqueueVersionCheck(fn) {
    return new Promise((resolve, reject) => {
        versionCheckQueue.push(() => fn().then(resolve).catch(reject));
        processVersionCheckQueue();
    });
}

function processVersionCheckQueue() {
    if (activeRequestsCount >= concurrencyLimit || versionCheckQueue.length === 0) {
        return;
    }
    activeRequestsCount++;
    const fn = versionCheckQueue.shift();
    fn().finally(() => {
        activeRequestsCount--;
        processVersionCheckQueue();
    });
}

/**
 * Performs a manual check for updates on all 3rd-party extensions.
 * @param {function} sortFn Sort function
 * @param {AbortSignal} abortSignal Signal to abort the operation
 * @returns {Promise<any[]>}
 */
async function checkForUpdatesManual(sortFn, abortSignal) {
    const promises = [];
    for (const id of Object.keys(manifests).filter(x => x.startsWith('third-party')).sort((a, b) => sortFn(manifests[a], manifests[b]))) {
        const externalId = id.replace('third-party', '');
        const promise = enqueueVersionCheck(async () => {
            try {
                const data = await getExtensionVersion(externalId, abortSignal);
                const extensionBlock = document.querySelector(`.extension_block[data-name="${externalId}"]`);
                if (extensionBlock && data) {
                    if (data.isUpToDate === false) {
                        const buttonElement = extensionBlock.querySelector('.btn_update');
                        if (buttonElement) {
                            buttonElement.classList.remove('displayNone');
                        }
                        const nameElement = extensionBlock.querySelector('.extension_name');
                        if (nameElement) {
                            nameElement.classList.add('update_available');
                        }
                    }
                    let branch = data.currentBranchName;
                    let commitHash = data.currentCommitHash;
                    let origin = data.remoteUrl;

                    const originLink = extensionBlock.querySelector('a');
                    if (originLink) {
                        try {
                            const url = new URL(origin);
                            if (!['https:', 'http:'].includes(url.protocol)) {
                                throw new Error('Invalid protocol');
                            }
                            originLink.href = url.href;
                            originLink.target = '_blank';
                            originLink.rel = 'noopener noreferrer';
                        } catch (error) {
                            console.log('Error setting origin link', originLink, error);
                        }
                    }

                    const versionElement = extensionBlock.querySelector('.extension_version');
                    if (versionElement) {
                        versionElement.textContent += ` (${branch}-${commitHash.substring(0, 7)})`;
                    }
                }
            } catch (error) {
                console.error('Error checking for extension updates', error);
            }
        });
        promises.push(promise);
    }
    return Promise.allSettled(promises);
}

/**
 * Checks if there are updates available for 3rd-party extensions.
 * @param {boolean} force Skip nag check
 * @returns {Promise<any>}
 */
async function checkForExtensionUpdates(force) {
    if (!force) {
        const STORAGE_NAG_KEY = 'extension_update_nag';
        const currentDate = new Date().toDateString();

        // Don't nag more than once a day
        if (accountStorage.getItem(STORAGE_NAG_KEY) === currentDate) {
            return;
        }

        accountStorage.setItem(STORAGE_NAG_KEY, currentDate);
    }

    const isCurrentUserAdmin = isAdmin();
    const updatesAvailable = [];
    const promises = [];

    for (const [id, manifest] of Object.entries(manifests)) {
        const isGlobal = getExtensionType(id) === 'global';
        if (isGlobal && !isCurrentUserAdmin) {
            console.debug(`Skipping global extension: ${manifest.display_name} (${id}) for non-admin user`);
            continue;
        }

        if (manifest.auto_update && id.startsWith('third-party')) {
            const promise = enqueueVersionCheck(async () => {
                try {
                    const data = await getExtensionVersion(id.replace('third-party', ''));
                    if (!data.isUpToDate) {
                        updatesAvailable.push(manifest.display_name);
                    }
                } catch (error) {
                    console.error('Error checking for extension updates', error);
                }
            });
            promises.push(promise);
        }
    }

    await Promise.allSettled(promises);

    if (updatesAvailable.length > 0) {
        toastr.info(`${updatesAvailable.map(x => `• ${x}`).join('\n')}`, t`Extension updates available`);
    }
}

/**
 * Updates all 3rd-party extensions that have auto-update enabled.
 * @param {boolean} forceAll Force update all even if not auto-updating
 * @returns {Promise<void>}
 */
async function autoUpdateExtensions(forceAll) {
    if (!Object.values(manifests).some(x => x.auto_update)) {
        return;
    }

    const banner = toastr.info(t`Auto-updating extensions. This may take several minutes.`, t`Please wait...`, { timeOut: 10000, extendedTimeOut: 10000 });
    const isCurrentUserAdmin = isAdmin();
    const promises = [];
    for (const [id, manifest] of Object.entries(manifests)) {
        const isGlobal = getExtensionType(id) === 'global';
        if (isGlobal && !isCurrentUserAdmin) {
            console.debug(`Skipping global extension: ${manifest.display_name} (${id}) for non-admin user`);
            continue;
        }
        if ((forceAll || manifest.auto_update) && id.startsWith('third-party')) {
            console.debug(`Auto-updating 3rd-party extension: ${manifest.display_name} (${id})`);
            promises.push(updateExtension(id.replace('third-party', ''), true));
        }
    }
    await Promise.allSettled(promises);
    toastr.clear(banner);
}

/**
 * Runs the generate interceptors for all extensions.
 * @param {any[]} chat Chat array
 * @param {number} contextSize Context size
 * @param {string} type Generation type
 * @returns {Promise<boolean>} True if generation should be aborted
 */
export async function runGenerationInterceptors(chat, contextSize, type) {
    let aborted = false;
    let exitImmediately = false;

    const abort = (/** @type {boolean} */ immediately) => {
        aborted = true;
        exitImmediately = immediately;
    };

    for (const manifest of Object.values(manifests).filter(x => x.generate_interceptor).sort((a, b) => sortManifestsByOrder(a, b))) {
        const interceptorKey = manifest.generate_interceptor;
        if (typeof globalThis[interceptorKey] === 'function') {
            try {
                await globalThis[interceptorKey](chat, contextSize, abort, type);
            } catch (e) {
                console.error(`Failed running interceptor for ${manifest.display_name}`, e);
            }
        }

        if (exitImmediately) {
            break;
        }
    }

    return aborted;
}

/**
 * Writes a field to the character's data extensions object.
 * @param {number} characterId Index in the character array
 * @param {string} key Field name
 * @param {any} value Field value
 * @returns {Promise<void>} When the field is written
 */
export async function writeExtensionField(characterId, key, value) {
    const context = getContext();
    const character = context.characters[characterId];
    if (!character) {
        console.warn('Character not found', characterId);
        return;
    }
    const path = `data.extensions.${key}`;
    setValueByPath(character, path, value);

    // Process JSON data
    if (character.json_data) {
        const jsonData = JSON.parse(character.json_data);
        setValueByPath(jsonData, path, value);
        character.json_data = JSON.stringify(jsonData);

        // Make sure the data doesn't get lost when saving the current character
        if (Number(characterId) === Number(context.characterId)) {
            $('#character_json_data').val(character.json_data);
        }
    }

    // Save data to the server
    const saveDataRequest = {
        avatar: character.avatar,
        data: {
            extensions: {
                [key]: value,
            },
        },
    };
    const mergeResponse = await fetch('/api/characters/merge-attributes', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify(saveDataRequest),
    });

    if (!mergeResponse.ok) {
        console.error('Failed to save extension field', mergeResponse.statusText);
    }
}

/**
 * Prompts the user to enter the Git URL of the extension to import.
 * After obtaining the Git URL, makes a POST request to '/api/extensions/install' to import the extension.
 * If the extension is imported successfully, a success message is displayed.
 * If the extension import fails, an error message is displayed and the error is logged to the console.
 * After successfully importing the extension, the extension settings are reloaded and a 'EXTENSION_SETTINGS_LOADED' event is emitted.
 * @param {string} [suggestUrl] Suggested URL to install
 * @returns {Promise<void>}
 */
export async function openThirdPartyExtensionMenu(suggestUrl = '') {
    const isCurrentUserAdmin = isAdmin();
    const html = await renderTemplateAsync('installExtension', { isCurrentUserAdmin });
    const okButton = isCurrentUserAdmin ? t`Install just for me` : t`Install`;

    let global = false;
    const installForAllButton = {
        text: t`Install for all users`,
        appendAtEnd: false,
        action: async () => {
            global = true;
            await popup.complete(POPUP_RESULT.AFFIRMATIVE);
        },
    };

    const customButtons = isCurrentUserAdmin ? [installForAllButton] : [];
    const popup = new Popup(html, POPUP_TYPE.INPUT, suggestUrl ?? '', { okButton, customButtons });
    const input = await popup.show();

    if (!input) {
        console.debug('Extension install cancelled');
        return;
    }

    const url = String(input).trim();
    await installExtension(url, global);
}

export async function initExtensions() {
    await addExtensionsButtonAndMenu();
    $('#extensionsMenuButton').css('display', 'flex');

    $('#extensions_connect').on('click', connectClickHandler);
    $('#extensions_autoconnect').on('input', autoConnectInputHandler);
    $('#extensions_details').on('click', showExtensionsDetails);
    $('#extensions_notify_updates').on('input', notifyUpdatesInputHandler);
    $(document).on('click', '.extensions_info .extension_block .toggle_disable', onDisableExtensionClick);
    $(document).on('click', '.extensions_info .extension_block .toggle_enable', onEnableExtensionClick);
    $(document).on('click', '.extensions_info .extension_block .btn_update', onUpdateClick);
    $(document).on('click', '.extensions_info .extension_block .btn_delete', onDeleteClick);
    $(document).on('click', '.extensions_info .extension_block .btn_move', onMoveClick);

    /**
     * Handles the click event for the third-party extension import button.
     *
     * @listens #third_party_extension_button#click - The click event of the '#third_party_extension_button' element.
     */
    $('#third_party_extension_button').on('click', () => openThirdPartyExtensionMenu());
}
