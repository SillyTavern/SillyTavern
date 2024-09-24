import { eventSource, event_types, saveSettings, saveSettingsDebounced, getRequestHeaders, animation_duration } from '../script.js';
import { hideLoader, showLoader } from './loader.js';
import { POPUP_RESULT, POPUP_TYPE, Popup, callGenericPopup } from './popup.js';
import { renderTemplate, renderTemplateAsync } from './templates.js';
import { isSubsetOf, setValueByPath } from './utils.js';
export {
    getContext,
    getApiUrl,
    loadExtensionSettings,
    runGenerationInterceptors,
    doExtrasFetch,
    modules,
    extension_settings,
    ModuleWorkerWrapper,
};

export let extensionNames = [];
let manifests = {};
const defaultUrl = 'http://localhost:5100';

let saveMetadataTimeout = null;

let requiresReload = false;
let stateChanged = false;

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
        newContext.saveMetadata();
        console.debug('Saved metadata...');
    }, 1000);
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
class ModuleWorkerWrapper {
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

const extension_settings = {
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

let modules = [];
let activeExtensions = new Set();

const getContext = () => window['SillyTavern'].getContext();
const getApiUrl = () => extension_settings.apiUrl;
let connectedToApi = false;

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

async function doExtrasFetch(endpoint, args) {
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

    const response = await fetch(endpoint, args);
    return response;
}

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

async function enableExtension(name, reload = true) {
    extension_settings.disabledExtensions = extension_settings.disabledExtensions.filter(x => x !== name);
    stateChanged = true;
    await saveSettings();
    if (reload) {
        location.reload();
    } else {
        requiresReload = true;
    }
}

async function disableExtension(name, reload = true) {
    extension_settings.disabledExtensions.push(name);
    stateChanged = true;
    await saveSettings();
    if (reload) {
        location.reload();
    } else {
        requiresReload = true;
    }
}

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

async function activateExtensions() {
    const extensions = Object.entries(manifests).sort((a, b) => a[1].loading_order - b[1].loading_order);
    const promises = [];

    for (let entry of extensions) {
        const name = entry[0];
        const manifest = entry[1];
        const elementExists = document.getElementById(name) !== null;

        if (elementExists || activeExtensions.has(name)) {
            continue;
        }

        // all required modules are active (offline extensions require none)
        if (isSubsetOf(modules, manifest.requires)) {
            try {
                const isDisabled = extension_settings.disabledExtensions.includes(name);
                const li = document.createElement('li');

                if (!isDisabled) {
                    const promise = Promise.all([addExtensionScript(name, manifest), addExtensionStyle(name, manifest)]);
                    await promise
                        .then(() => activeExtensions.add(name))
                        .catch(err => console.log('Could not activate extension: ' + name, err));
                    promises.push(promise);
                }
                else {
                    li.classList.add('disabled');
                }

                li.id = name;
                li.innerText = manifest.display_name;

                $('#extensions_list').append(li);
            }
            catch (error) {
                console.error(`Could not activate extension: ${name}`);
                console.error(error);
            }
        }
    }

    await Promise.allSettled(promises);
}

async function connectClickHandler() {
    const baseUrl = $('#extensions_url').val();
    extension_settings.apiUrl = String(baseUrl);
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
    //dropdown.hide();

    let popper = Popper.createPopper(button.get(0), dropdown.get(0), {
        placement: 'top-start',
    });

    $(button).on('click', function () {
        if (dropdown.is(':visible')) {
            dropdown.fadeOut(animation_duration);
        } else {
            dropdown.fadeIn(animation_duration);
        }
        popper.update();
    });

    $('html').on('click', function (e) {
        const clickTarget = $(e.target);
        const noCloseTargets = ['#sd_gen', '#extensionsMenuButton', '#roll_dice'];
        if (dropdown.is(':visible') && !noCloseTargets.some(id => clickTarget.closest(id).length > 0)) {
            $(dropdown).fadeOut(animation_duration);
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

/*     $(document).on('click', function (e) {
        const target = $(e.target);
        if (target.is(dropdown)) return;
        if (target.is(button) && dropdown.is(':hidden')) {
            dropdown.toggle(200);
            popper.update();
        }
        if (target !== dropdown &&
            target !== button &&
            dropdown.is(":visible")) {
            dropdown.hide(200);
        }
    });
} */

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
            eventSource.emit(event_types.EXTRAS_CONNECTED, modules);
        }

        updateStatus(getExtensionsResult.ok);
    }
    catch {
        updateStatus(false);
    }
}

function updateStatus(success) {
    connectedToApi = success;
    const _text = success ? 'Connected to API' : 'Could not connect to API';
    const _class = success ? 'success' : 'failure';
    $('#extensions_status').text(_text);
    $('#extensions_status').attr('class', _class);
}

function addExtensionStyle(name, manifest) {
    if (manifest.css) {
        return new Promise((resolve, reject) => {
            const url = `/scripts/extensions/${name}/${manifest.css}`;

            if ($(`link[id="${name}"]`).length === 0) {
                const link = document.createElement('link');
                link.id = name;
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

    return Promise.resolve();
}

function addExtensionScript(name, manifest) {
    if (manifest.js) {
        return new Promise((resolve, reject) => {
            const url = `/scripts/extensions/${name}/${manifest.js}`;
            let ready = false;

            if ($(`script[id="${name}"]`).length === 0) {
                const script = document.createElement('script');
                script.id = name;
                script.type = 'module';
                script.src = url;
                script.async = true;
                script.onerror = function (err) {
                    reject(err, script);
                };
                script.onload = script.onreadystatechange = function () {
                    // console.log(this.readyState); // uncomment this line to see which ready states are called.
                    if (!ready && (!this.readyState || this.readyState == 'complete')) {
                        ready = true;
                        resolve();
                    }
                };
                document.body.appendChild(script);
            }
        });
    }

    return Promise.resolve();
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
 * @return {Promise<string>} - The HTML string that represents the extension.
 */
async function generateExtensionHtml(name, manifest, isActive, isDisabled, isExternal, checkboxClass) {
    const displayName = manifest.display_name;
    let displayVersion = manifest.version ? ` v${manifest.version}` : '';
    let isUpToDate = true;
    let updateButton = '';
    let originHtml = '';
    if (isExternal) {
        let data = await getExtensionVersion(name.replace('third-party', ''));
        let branch = data.currentBranchName;
        let commitHash = data.currentCommitHash;
        let origin = data.remoteUrl;
        isUpToDate = data.isUpToDate;
        displayVersion = ` (${branch}-${commitHash.substring(0, 7)})`;
        updateButton = isUpToDate ?
            `<span class="update-button"><button class="btn_update menu_button" data-name="${name.replace('third-party', '')}" title="Up to date"><i class="fa-solid fa-code-commit fa-fw"></i></button></span>` :
            `<span class="update-button"><button class="btn_update menu_button" data-name="${name.replace('third-party', '')}" title="Update available"><i class="fa-solid fa-download fa-fw"></i></button></span>`;
        originHtml = `<a href="${origin}" target="_blank" rel="noopener noreferrer">`;
    }

    let toggleElement = isActive || isDisabled ?
        `<input type="checkbox" title="Click to toggle" data-name="${name}" class="${isActive ? 'toggle_disable' : 'toggle_enable'} ${checkboxClass}" ${isActive ? 'checked' : ''}>` :
        `<input type="checkbox" title="Cannot enable extension" data-name="${name}" class="extension_missing ${checkboxClass}" disabled>`;

    let deleteButton = isExternal ? `<span class="delete-button"><button class="btn_delete menu_button" data-name="${name.replace('third-party', '')}" title="Delete"><i class="fa-solid fa-trash-can"></i></button></span>` : '';

    // if external, wrap the name in a link to the repo

    let extensionHtml = `<hr>
        <h4>
            ${updateButton}
            ${deleteButton}
            ${originHtml}
            <span class="${isActive ? 'extension_enabled' : isDisabled ? 'extension_disabled' : 'extension_missing'}">
                ${DOMPurify.sanitize(displayName)}${displayVersion}
            </span>
            ${isExternal ? '</a>' : ''}

            <span style="float:right;">${toggleElement}</span>
        </h4>`;

    if (isActive && Array.isArray(manifest.optional)) {
        const optional = new Set(manifest.optional);
        modules.forEach(x => optional.delete(x));
        if (optional.size > 0) {
            const optionalString = DOMPurify.sanitize([...optional].join(', '));
            extensionHtml += `<p>Optional modules: <span class="optional">${optionalString}</span></p>`;
        }
    } else if (!isDisabled) { // Neither active nor disabled
        const requirements = new Set(manifest.requires);
        modules.forEach(x => requirements.delete(x));
        if (requirements.size > 0) {
            const requirementsString = DOMPurify.sanitize([...requirements].join(', '));
            extensionHtml += `<p>Missing modules: <span class="failure">${requirementsString}</span></p>`;
        }
    }

    return extensionHtml;
}

/**
 * Gets extension data and generates the corresponding HTML for displaying the extension.
 *
 * @param {Array} extension - An array where the first element is the extension name and the second element is the extension manifest.
 * @return {Promise<object>} - An object with 'isExternal' indicating whether the extension is external, and 'extensionHtml' for the extension's HTML string.
 */
async function getExtensionData(extension) {
    const name = extension[0];
    const manifest = extension[1];
    const isActive = activeExtensions.has(name);
    const isDisabled = extension_settings.disabledExtensions.includes(name);
    const isExternal = name.startsWith('third-party');

    const checkboxClass = isDisabled ? 'checkbox_disabled' : '';

    const extensionHtml = await generateExtensionHtml(name, manifest, isActive, isDisabled, isExternal, checkboxClass);

    return { isExternal, extensionHtml };
}


/**
 * Gets the module information to be displayed.
 *
 * @return {string} - The HTML string for the module information.
 */
function getModuleInformation() {
    let moduleInfo = modules.length ? `<p>${DOMPurify.sanitize(modules.join(', '))}</p>` : '<p class="failure">Not connected to the API!</p>';
    return `
        <h3>Modules provided by your Extras API:</h3>
        ${moduleInfo}
    `;
}

/**
 * Generates the HTML strings for all extensions and displays them in a popup.
 */
async function showExtensionsDetails() {
    let popupPromise;
    try {
        const htmlDefault = $('<h3>Built-in Extensions:</h3>');
        const htmlExternal = $('<h3>Installed Extensions:</h3>').addClass('opacity50p');
        const htmlLoading = $(`<h3 class="flex-container alignItemsCenter justifyCenter marginTop10 marginBot5">
            <i class="fa-solid fa-spinner fa-spin"></i>
            <span>Loading third-party extensions... Please wait...</span>
        </h3>`);

        /** @type {Promise<any>[]} */
        const promises = [];
        const extensions = Object.entries(manifests).sort((a, b) => a[1].loading_order - b[1].loading_order);

        for (const extension of extensions) {
            promises.push(getExtensionData(extension));
        }

        promises.forEach(promise => {
            promise.then(value => {
                const { isExternal, extensionHtml } = value;
                const container = isExternal ? htmlExternal : htmlDefault;
                container.append(extensionHtml);
            });
        });

        Promise.allSettled(promises).then(() => {
            htmlLoading.remove();
            htmlExternal.removeClass('opacity50p');
        });

        const html = $('<div></div>')
            .addClass('extensions_info')
            .append(getModuleInformation())
            .append(htmlDefault)
            .append(htmlLoading)
            .append(htmlExternal);

        /** @type {import('./popup.js').CustomPopupButton} */
        const updateAllButton = {
            text: 'Update all',
            appendAtEnd: true,
            action: async () => {
                requiresReload = true;
                await autoUpdateExtensions(true);
                await popup.complete(POPUP_RESULT.AFFIRMATIVE);
            },
        };

        // If we are updating an extension, the "old" popup is still active. We should close that.
        const oldPopup = Popup.util.popups.find(popup => popup.content.querySelector('.extensions_info'));
        if (oldPopup) {
            await oldPopup.complete(POPUP_RESULT.CANCELLED);
        }

        let waitingForSave = false;

        const popup = new Popup(html, POPUP_TYPE.TEXT, '', {
            okButton: 'Close',
            wide: true,
            large: true,
            customButtons: [updateAllButton],
            allowVerticalScrolling: true,
            onClosing: async () => {
                if (waitingForSave) {
                    return false;
                }
                if (stateChanged) {
                    waitingForSave = true;
                    const toast = toastr.info('The page will be reloaded shortly...', 'Extensions state changed');
                    await saveSettings();
                    toastr.clear(toast);
                    waitingForSave = false;
                    requiresReload = true;
                }
                return true;
            },
        });
        popupPromise = popup.show();
    } catch (error) {
        toastr.error('Error loading extensions. See browser console for details.');
        console.error(error);
    }
    if (popupPromise) {
        await popupPromise;
    }
    if (requiresReload) {
        showLoader();
        location.reload();
    }
}


/**
 * Handles the click event for the update button of an extension.
 * This function makes a POST request to '/update_extension' with the extension's name.
 * If the extension is already up to date, it displays a success message.
 * If the extension is not up to date, it updates the extension and displays a success message with the new commit hash.
 */
async function onUpdateClick() {
    const extensionName = $(this).data('name');
    $(this).find('i').addClass('fa-spin');
    await updateExtension(extensionName, false);
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
            body: JSON.stringify({ extensionName }),
        });

        const data = await response.json();

        if (!quiet) {
            showExtensionsDetails();
        }

        if (data.isUpToDate) {
            if (!quiet) {
                toastr.success('Extension is already up to date');
            }
        } else {
            toastr.success(`Extension ${extensionName} updated to ${data.shortCommitHash}`, 'Reload the page to apply updates');
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
    // use callPopup to create a popup for the user to confirm before delete
    const confirmation = await callGenericPopup(`Are you sure you want to delete ${extensionName}?`, POPUP_TYPE.CONFIRM, '', {});
    if (confirmation === POPUP_RESULT.AFFIRMATIVE) {
        await deleteExtension(extensionName);
    }
}

export async function deleteExtension(extensionName) {
    try {
        await fetch('/api/extensions/delete', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ extensionName }),
        });
    } catch (error) {
        console.error('Error:', error);
    }

    toastr.success(`Extension ${extensionName} deleted`);
    showExtensionsDetails();
    // reload the page to remove the extension from the list
    location.reload();
}

/**
 * Fetches the version details of a specific extension.
 *
 * @param {string} extensionName - The name of the extension.
 * @return {Promise<object>} - An object containing the extension's version details.
 * This object includes the currentBranchName, currentCommitHash, isUpToDate, and remoteUrl.
 * @throws {error} - If there is an error during the fetch operation, it logs the error to the console.
 */
async function getExtensionVersion(extensionName) {
    try {
        const response = await fetch('/api/extensions/version', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ extensionName }),
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
 * @returns {Promise<void>}
 */
export async function installExtension(url) {
    console.debug('Extension installation started', url);

    toastr.info('Please wait...', 'Installing extension');

    const request = await fetch('/api/extensions/install', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({ url }),
    });

    if (!request.ok) {
        const text = await request.text();
        toastr.warning(text || request.statusText, 'Extension installation failed', { timeOut: 5000 });
        console.error('Extension installation failed', request.status, request.statusText, text);
        return;
    }

    const response = await request.json();
    toastr.success(`Extension "${response.display_name}" by ${response.author} (version ${response.version}) has been installed successfully!`, 'Extension installation successful');
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
async function loadExtensionSettings(settings, versionChanged, enableAutoUpdate) {
    if (settings.extension_settings) {
        Object.assign(extension_settings, settings.extension_settings);
    }

    $('#extensions_url').val(extension_settings.apiUrl);
    $('#extensions_api_key').val(extension_settings.apiKey);
    $('#extensions_autoconnect').prop('checked', extension_settings.autoConnect);
    $('#extensions_notify_updates').prop('checked', extension_settings.notifyUpdates);

    // Activate offline extensions
    await eventSource.emit(event_types.EXTENSIONS_FIRST_LOAD);
    extensionNames = await discoverExtensions();
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
        if (localStorage.getItem(STORAGE_NAG_KEY) === currentDate) {
            return;
        }

        localStorage.setItem(STORAGE_NAG_KEY, currentDate);
    }

    const updatesAvailable = [];
    const promises = [];

    for (const [id, manifest] of Object.entries(manifests)) {
        if (manifest.auto_update && id.startsWith('third-party')) {
            const promise = new Promise(async (resolve, reject) => {
                try {
                    const data = await getExtensionVersion(id.replace('third-party', ''));
                    if (data.isUpToDate === false) {
                        updatesAvailable.push(manifest.display_name);
                    }
                    resolve();
                } catch (error) {
                    console.error('Error checking for extension updates', error);
                    reject();
                }
            });
            promises.push(promise);
        }
    }

    await Promise.allSettled(promises);

    if (updatesAvailable.length > 0) {
        toastr.info(`${updatesAvailable.map(x => `• ${x}`).join('\n')}`, 'Extension updates available');
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

    const banner = toastr.info('Auto-updating extensions. This may take several minutes.', 'Please wait...', { timeOut: 10000, extendedTimeOut: 10000 });
    const promises = [];
    for (const [id, manifest] of Object.entries(manifests)) {
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
 * @returns {Promise<boolean>} True if generation should be aborted
 */
async function runGenerationInterceptors(chat, contextSize) {
    let aborted = false;
    let exitImmediately = false;

    const abort = (/** @type {boolean} */ immediately) => {
        aborted = true;
        exitImmediately = immediately;
    };

    for (const manifest of Object.values(manifests).sort((a, b) => a.loading_order - b.loading_order)) {
        const interceptorKey = manifest.generate_interceptor;
        if (typeof window[interceptorKey] === 'function') {
            try {
                await window[interceptorKey](chat, contextSize, abort);
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
    const html = await renderTemplateAsync('installExtension');
    const input = await callGenericPopup(html, POPUP_TYPE.INPUT, suggestUrl ?? '');

    if (!input) {
        console.debug('Extension install cancelled');
        return;
    }

    const url = String(input).trim();
    await installExtension(url);
}

jQuery(async function () {
    await addExtensionsButtonAndMenu();
    $('#extensionsMenuButton').css('display', 'flex');

    $('#extensions_connect').on('click', connectClickHandler);
    $('#extensions_autoconnect').on('input', autoConnectInputHandler);
    $('#extensions_details').on('click', showExtensionsDetails);
    $('#extensions_notify_updates').on('input', notifyUpdatesInputHandler);
    $(document).on('click', '.toggle_disable', onDisableExtensionClick);
    $(document).on('click', '.toggle_enable', onEnableExtensionClick);
    $(document).on('click', '.btn_update', onUpdateClick);
    $(document).on('click', '.btn_delete', onDeleteClick);

    /**
     * Handles the click event for the third-party extension import button.
     *
     * @listens #third_party_extension_button#click - The click event of the '#third_party_extension_button' element.
     */
    $('#third_party_extension_button').on('click', () => openThirdPartyExtensionMenu());
});
