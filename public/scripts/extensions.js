import { callPopup, eventSource, event_types, saveSettings, saveSettingsDebounced } from "../script.js";
import { isSubsetOf, debounce } from "./utils.js";
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

let extensionNames = [];
let manifests = [];
const defaultUrl = "http://localhost:5100";
export const saveMetadataDebounced = debounce(async () => await getContext().saveMetadata(), 1000);

// Disables parallel updates
class ModuleWorkerWrapper {
    constructor(callback) {
        this.isBusy = false;
        this.callback = callback;
    }

    // Called by the extension
    async update() {
        // Don't touch me I'm busy...
        if (this.isBusy) {
            return;
        }

        // I'm free. Let's update!
        try {
            this.isBusy = true;
            await this.callback();
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
    disabledExtensions: [],
    expressionOverrides: [],
    memory: {},
    note: {
        default: '',
        chara: [],
    },
    caption: {},
    expressions: {},
    dice: {},
    tts: {},
    sd: {},
    chromadb: {},
    translate: {},
    objective: {},
    quickReply: {},
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
        args = {}
    }

    if (!args.method) {
        Object.assign(args, { method: 'GET' });
    }

    if (!args.headers) {
        args.headers = {}
    }
    Object.assign(args.headers, {
        'Authorization': `Bearer ${extension_settings.apiKey}`,
        'Bypass-Tunnel-Reminder': 'bypass'
    });

    const response = await fetch(endpoint, args);
    return response;
}

async function discoverExtensions() {
    try {
        const response = await fetch('/discover_extensions');

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
    disableExtension(name);
}

function onEnableExtensionClick() {
    const name = $(this).data('name');
    enableExtension(name);
}

async function enableExtension(name) {
    extension_settings.disabledExtensions = extension_settings.disabledExtensions.filter(x => x !== name);
    await saveSettings();
    location.reload();
}

async function disableExtension(name) {
    extension_settings.disabledExtensions.push(name);
    await saveSettings();
    location.reload();
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
                }
            }).catch(err => reject() && console.log('Could not load manifest.json for ' + name, err));
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
                    promise
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
    const baseUrl = $("#extensions_url").val();
    extension_settings.apiUrl = baseUrl;
    const testApiKey = $("#extensions_api_key").val();
    extension_settings.apiKey = testApiKey;
    saveSettingsDebounced();
    await connectToApi(baseUrl);
}

function autoConnectInputHandler() {
    const value = $(this).prop('checked');
    extension_settings.autoConnect = !!value;

    if (value && !connectedToApi) {
        $("#extensions_connect").trigger('click');
    }

    saveSettingsDebounced();
}

function addExtensionsButtonAndMenu() {
    const buttonHTML =
        `<div id="extensionsMenuButton" style="display: none;" class="fa-solid fa-magic-wand-sparkles" title="Extras Extensions" /></div>`;
    const extensionsMenuHTML = `<div id="extensionsMenu" class="options-content" style="display: none;"></div>`;

    $(document.body).append(extensionsMenuHTML);

    $('#send_but_sheld').prepend(buttonHTML);

    const button = $('#extensionsMenuButton');
    const dropdown = $('#extensionsMenu');
    //dropdown.hide();

    let popper = Popper.createPopper(button.get(0), dropdown.get(0), {
        placement: 'top-end',
    });

    $(button).on('click', function () {
        popper.update()
        dropdown.fadeIn(250);
    });

    $("html").on('touchstart mousedown', function (e) {
        let clickTarget = $(e.target);
        if (dropdown.is(':visible')
            && clickTarget.closest(button).length == 0
            && clickTarget.closest(dropdown).length == 0) {
            $(dropdown).fadeOut(250);
        }
    });
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
                link.rel = "stylesheet";
                link.type = "text/css";
                link.href = url;
                link.onload = function () {
                    resolve();
                }
                link.onerror = function (e) {
                    reject(e);
                }
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

function showExtensionsDetails() {
    let html = '<h3>Modules provided by your Extensions API:</h3>';
    html += modules.length ? DOMPurify.sanitize(modules.join(', ')) : '<p class="failure">Not connected to the API!</p>';
    html += '<h3>Available extensions:</h3>';

    Object.entries(manifests).sort((a, b) => a[1].loading_order - b[1].loading_order).forEach(extension => {
        const name = extension[0];
        const manifest = extension[1];
        html += `<h4>${DOMPurify.sanitize(manifest.display_name)}</h4>`;
        if (activeExtensions.has(name)) {
            html += `<p class="success">Extension is active. <a href="javascript:void" data-name="${name}" class="disable_extension">Click to Disable</a></p>`;
            if (Array.isArray(manifest.optional)) {
                const optional = new Set(manifest.optional);
                modules.forEach(x => optional.delete(x));
                if (optional.size > 0) {
                    const optionalString = DOMPurify.sanitize([...optional].join(', '));
                    html += `<p>Optional modules: <span class="optional">${optionalString}</span></p>`;
                }
            }
        }
        else if (extension_settings.disabledExtensions.includes(name)) {
            html += `<p class="disabled">Extension is disabled. <a href="javascript:void" data-name=${name} class="enable_extension">Click to Enable</a></p>`;
        }
        else {
            const requirements = new Set(manifest.requires);
            modules.forEach(x => requirements.delete(x));
            const requirementsString = DOMPurify.sanitize([...requirements].join(', '));
            html += `<p>Missing modules: <span class="failure">${requirementsString}</span></p>`
        }
    });

    callPopup(`<div class="extensions_info">${html}</div>`, 'text');
}

async function loadExtensionSettings(settings) {
    if (settings.extension_settings) {
        Object.assign(extension_settings, settings.extension_settings);
    }

    $("#extensions_url").val(extension_settings.apiUrl);
    $("#extensions_api_key").val(extension_settings.apiKey);
    $("#extensions_autoconnect").prop('checked', extension_settings.autoConnect);

    // Activate offline extensions
    extensionNames = await discoverExtensions();
    manifests = await getManifests(extensionNames)
    await activateExtensions();
    if (extension_settings.autoConnect && extension_settings.apiUrl) {
        connectToApi(extension_settings.apiUrl);
    }
}

async function runGenerationInterceptors(chat) {
    for (const manifest of Object.values(manifests)) {
        const interceptorKey = manifest.generate_interceptor;
        if (typeof window[interceptorKey] === 'function') {
            try {
                await window[interceptorKey](chat);
            } catch (e) {
                console.error(`Failed running interceptor for ${manifest.display_name}`, e);
            }
        }
    }
}

$(document).ready(async function () {
    setTimeout(function () {
        addExtensionsButtonAndMenu();
        $("#extensionsMenuButton").css("display", "flex");
    }, 100)

    $("#extensions_connect").on('click', connectClickHandler);
    $("#extensions_autoconnect").on('input', autoConnectInputHandler);
    $("#extensions_details").on('click', showExtensionsDetails);
    $(document).on('click', '.disable_extension', onDisableExtensionClick);
    $(document).on('click', '.enable_extension', onEnableExtensionClick);
});
