import { callPopup } from "../script.js";
import { isSubsetOf } from "./utils.js";
export {
    getContext,
    getApiUrl,
    defaultRequestArgs,
    modules,
};

const extensionNames = ['caption', 'dice', 'expressions', 'floating-prompt', 'memory', 'poe'];
const manifests = await getManifests(extensionNames);
const extensions_urlKey = 'extensions_url';
const extensions_autoConnectKey = 'extensions_autoconnect';
const extensions_disabledKey = 'extensions_disabled';

let modules = [];
let disabledExtensions = getDisabledExtensions();
let activeExtensions = new Set();

const getContext = () => window['TavernAI'].getContext();
const getApiUrl = () => localStorage.getItem('extensions_url');
const defaultUrl = "http://localhost:5100";
const defaultRequestArgs = { method: 'GET', headers: { 'Bypass-Tunnel-Reminder': 'bypass' } };
let connectedToApi = false;

function getDisabledExtensions() {
    const value = localStorage.getItem(extensions_disabledKey);
    return value ? JSON.parse(value) : [];
}

function onDisableExtensionClick() {
    const name = $(this).data('name');
    disableExtension(name);
}

function onEnableExtensionClick() {
    const name = $(this).data('name');
    enableExtension(name);
}

function enableExtension(name) {
    disabledExtensions = disabledExtensions.filter(x => x !== name);
    localStorage.setItem(extensions_disabledKey, JSON.stringify(disabledExtensions));
    location.reload();
}

function disableExtension(name) {
    disabledExtensions.push(name);
    localStorage.setItem(extensions_disabledKey, JSON.stringify(disabledExtensions));
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

        if (activeExtensions.has(name)) {
            continue;
        }

        // all required modules are active (offline extensions require none)
        if (isSubsetOf(modules, manifest.requires)) {
            try {
                const isDisabled = disabledExtensions.includes(name);
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
    localStorage.setItem(extensions_urlKey, baseUrl);
    await connectToApi(baseUrl);
}

function autoConnectInputHandler() {
    const value = $(this).prop('checked');
    localStorage.setItem(extensions_autoConnectKey, value.toString());

    if (value && !connectedToApi) {
        $("#extensions_connect").trigger('click');
    }
}

async function connectToApi(baseUrl) {
    const url = new URL(baseUrl);
    url.pathname = '/api/modules';

    try {
        const getExtensionsResult = await fetch(url, defaultRequestArgs);

        if (getExtensionsResult.ok) {
            const data = await getExtensionsResult.json();
            modules = data.modules;
            activateExtensions();
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
            html += `<p class="success">Extension is active. <a href="javascript:void" data-name="${name}" class="disable_extension">Disable</a></p>`;
            if (Array.isArray(manifest.optional)) {
                const optional = new Set(manifest.optional);
                modules.forEach(x => optional.delete(x));
                if (optional.size > 0) {
                    const optionalString = DOMPurify.sanitize([...optional].join(', '));
                    html += `<p>Optional modules: <span class="optional">${optionalString}</span></p>`;
                }
            }
        }
        else if (disabledExtensions.includes(name)) {
            html += `<p class="disabled">Extension is disabled. <a href="javascript:void" data-name=${name} class="enable_extension">Enable</a></p>`;
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

$(document).ready(async function () {
    const url = localStorage.getItem(extensions_urlKey) ?? defaultUrl;
    const autoConnect = localStorage.getItem(extensions_autoConnectKey) == 'true';
    $("#extensions_url").val(url);
    $("#extensions_connect").on('click', connectClickHandler);
    $("#extensions_autoconnect").on('input', autoConnectInputHandler);
    $("#extensions_autoconnect").prop('checked', autoConnect).trigger('input');
    $("#extensions_details").on('click', showExtensionsDetails);
    $(document).on('click', '.disable_extension', onDisableExtensionClick);
    $(document).on('click', '.enable_extension', onEnableExtensionClick);

    // Activate offline extensions
    activateExtensions();
});