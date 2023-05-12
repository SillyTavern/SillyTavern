import { callPopup, saveSettings, saveSettingsDebounced } from "../script.js";
import { isSubsetOf } from "./utils.js";
export {
    getContext,
    getApiUrl,
    loadExtensionSettings,
    defaultRequestArgs,
    modules,
    extension_settings,
};

let extensionNames = [];
let manifests = [];
const defaultUrl = "http://localhost:5100";

const extension_settings = {
    apiUrl: defaultUrl,
    autoConnect: false,
    disabledExtensions: [],
    memory: {},
    note: {
        default: '',
    },
    caption: {},
    expressions: {},
    dice: {},
    tts: {},
    sd: {},
};

let modules = [];
let activeExtensions = new Set();

const getContext = () => window['SillyTavern'].getContext();
const getApiUrl = () => extension_settings.apiUrl;
const defaultRequestArgs = { method: 'GET', headers: { 'Bypass-Tunnel-Reminder': 'bypass' } };
let connectedToApi = false;

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
    for (const name of names) {
        const response = await fetch(`/scripts/extensions/${name}/manifest.json`);

        if (response.ok) {
            const json = await response.json();
            obj[name] = json;
        }
    }
    return obj;
}

async function activateExtensions() {
    const extensions = Object.entries(manifests).sort((a, b) => a[1].loading_order - b[1].loading_order);

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
                    await addExtensionScript(name, manifest);
                    await addExtensionStyle(name, manifest);
                    activeExtensions.add(name);
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
}

async function connectClickHandler() {
    const baseUrl = $("#extensions_url").val();
    extension_settings.apiUrl = baseUrl;
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

async function connectToApi(baseUrl) {
    if (!baseUrl) {
        return;
    }

    const url = new URL(baseUrl);
    url.pathname = '/api/modules';

    try {
        const getExtensionsResult = await fetch(url, defaultRequestArgs);

        if (getExtensionsResult.ok) {
            const data = await getExtensionsResult.json();
            modules = data.modules;
            await activateExtensions();
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
    $("#extensions_autoconnect").prop('checked', extension_settings.autoConnect);

    // Activate offline extensions
    extensionNames = await discoverExtensions();
    manifests = await getManifests(extensionNames)
    await activateExtensions();
    if (extension_settings.autoConnect && extension_settings.apiUrl) {
        await connectToApi(extension_settings.apiUrl);
    }
}

$(document).ready(async function () {
    $("#extensions_connect").on('click', connectClickHandler);
    $("#extensions_autoconnect").on('input', autoConnectInputHandler);
    $("#extensions_details").on('click', showExtensionsDetails);
    $(document).on('click', '.disable_extension', onDisableExtensionClick);
    $(document).on('click', '.enable_extension', onEnableExtensionClick);
});