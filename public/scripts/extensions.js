import { isSubsetOf } from "./utils.js";
export {
    getContext,
    getApiUrl,
    defaultRequestArgs,
};

import * as captionManifest from "./extensions/caption/manifest.json" assert {type: 'json'};
import * as diceManifest from "./extensions/dice/manifest.json" assert {type: 'json'};
import * as expressionsManifest from "./extensions/expressions/manifest.json" assert {type: 'json'};
import * as floatingPromptManifest from "./extensions/floating-prompt/manifest.json" assert {type: 'json'};
import * as memoryManifest from "./extensions/memory/manifest.json" assert {type: 'json'};

const manifests = {
    'floating-prompt': floatingPromptManifest.default,
    'dice': diceManifest.default,
    'caption': captionManifest.default,
    'expressions': expressionsManifest.default,
    'memory': memoryManifest.default,
};

const extensions_urlKey = 'extensions_url';
const extensions_autoConnectKey = 'extensions_autoconnect';
let modules = [];
let activeExtensions = new Set();

const getContext = () => window['TavernAI'].getContext();
const getApiUrl = () => localStorage.getItem('extensions_url');
const defaultUrl = "http://localhost:5100";
const defaultRequestArgs = { method: 'GET', headers: { 'Bypass-Tunnel-Reminder': 'bypass' } };
let connectedToApi = false;

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
                await addExtensionScript(name, manifest);
                await addExtensionStyle(name, manifest);
                activeExtensions.add(name);
                $('#extensions_list').append(`<li id="${name}">${manifest.display_name}</li>`);
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

$(document).ready(async function () {
    const url = localStorage.getItem(extensions_urlKey) ?? defaultUrl;
    const autoConnect = localStorage.getItem(extensions_autoConnectKey) == 'true';
    $("#extensions_url").val(url);
    $("#extensions_connect").on('click', connectClickHandler);
    $("#extensions_autoconnect").on('input', autoConnectInputHandler);
    $("#extensions_autoconnect").prop('checked', autoConnect).trigger('input');

    // Activate offline extensions
    activateExtensions();
});