/*
TODO:
*/
//const DEBUG_TONY_SAMA_FORK_MODE = true

import { getRequestHeaders, callPopup } from "../../../script.js";
import { deleteExtension, extensionNames, installExtension, renderExtensionTemplate } from "../../extensions.js";
import { getStringHash, isValidUrl } from "../../utils.js";
export { MODULE_NAME };

const MODULE_NAME = 'assets';
const DEBUG_PREFIX = "<Assets module> ";
let previewAudio = null;
let ASSETS_JSON_URL = "https://raw.githubusercontent.com/SillyTavern/SillyTavern-Content/main/index.json"

const extensionName = "assets";
const extensionFolderPath = `scripts/extensions/${extensionName}`;

// DBG
//if (DEBUG_TONY_SAMA_FORK_MODE)
//    ASSETS_JSON_URL = "https://raw.githubusercontent.com/Tony-sama/SillyTavern-Content/main/index.json"
let availableAssets = {};
let currentAssets = {};

//#############################//
//  Extension UI and Settings  //
//#############################//

const defaultSettings = {
}

function downloadAssetsList(url) {
    updateCurrentAssets().then(function () {
        fetch(url, { cache: "no-cache" })
            .then(response => response.json())
            .then(json => {

                availableAssets = {};
                $("#assets_menu").empty();

                console.debug(DEBUG_PREFIX, "Received assets dictionary", json);

                for (const i of json) {
                    //console.log(DEBUG_PREFIX,i)
                    if (availableAssets[i["type"]] === undefined)
                        availableAssets[i["type"]] = [];

                    availableAssets[i["type"]].push(i);
                }

                console.debug(DEBUG_PREFIX, "Updated available assets to", availableAssets);
                // First extensions, then everything else
                const assetTypes = Object.keys(availableAssets).sort((a, b) => (a === 'extension') ? -1 : (b === 'extension') ? 1 : 0);

                for (const assetType of assetTypes) {
                    let assetTypeMenu = $('<div />', { id: "assets_audio_ambient_div", class: "assets-list-div" });
                    assetTypeMenu.append(`<h3>${assetType}</h3>`)

                    if (assetType == 'extension') {
                        assetTypeMenu.append(`
                        <div class="assets-list-git">
                            To download extensions from this page, you need to have <a href="https://git-scm.com/downloads" target="_blank">Git</a> installed.
                        </div>`);
                    }

                    for (const i in availableAssets[assetType]) {
                        const asset = availableAssets[assetType][i];
                        const elemId = `assets_install_${assetType}_${i}`;
                        let element = $('<button />', { id: elemId, type: "button", class: "asset-download-button menu_button" })
                        const label = $("<i class=\"fa-solid fa-download fa-xl\"></i>");
                        element.append(label);

                        //if (DEBUG_TONY_SAMA_FORK_MODE)
                        //    asset["url"] = asset["url"].replace("https://github.com/SillyTavern/","https://github.com/Tony-sama/"); // DBG

                        console.debug(DEBUG_PREFIX, "Checking asset", asset["id"], asset["url"]);

                        const assetInstall = async function () {
                            element.off("click");
                            label.removeClass("fa-download");
                            this.classList.add('asset-download-button-loading');
                            await installAsset(asset["url"], assetType, asset["id"]);
                            label.addClass("fa-check");
                            this.classList.remove('asset-download-button-loading');
                            element.on("click", assetDelete);
                            element.on("mouseenter", function () {
                                label.removeClass("fa-check");
                                label.addClass("fa-trash");
                                label.addClass("redOverlayGlow");
                            }).on("mouseleave", function () {
                                label.addClass("fa-check");
                                label.removeClass("fa-trash");
                                label.removeClass("redOverlayGlow");
                            });
                        };

                        const assetDelete = async function () {
                            element.off("click");
                            await deleteAsset(assetType, asset["id"]);
                            label.removeClass("fa-check");
                            label.removeClass("redOverlayGlow");
                            label.removeClass("fa-trash");
                            label.addClass("fa-download");
                            element.off("mouseenter").off("mouseleave");
                            element.on("click", assetInstall);
                        }

                        if (isAssetInstalled(assetType, asset["id"])) {
                            console.debug(DEBUG_PREFIX, "installed, checked");
                            label.toggleClass("fa-download");
                            label.toggleClass("fa-check");
                            element.on("click", assetDelete);
                            element.on("mouseenter", function () {
                                label.removeClass("fa-check");
                                label.addClass("fa-trash");
                                label.addClass("redOverlayGlow");
                            }).on("mouseleave", function () {
                                label.addClass("fa-check");
                                label.removeClass("fa-trash");
                                label.removeClass("redOverlayGlow");
                            });
                        }
                        else {
                            console.debug(DEBUG_PREFIX, "not installed, unchecked")
                            element.prop("checked", false);
                            element.on("click", assetInstall);
                        }

                        console.debug(DEBUG_PREFIX, "Created element for ", asset["id"])

                        const displayName = DOMPurify.sanitize(asset["name"] || asset["id"]);
                        const description = DOMPurify.sanitize(asset["description"] || "");
                        const url = isValidUrl(asset["url"]) ? asset["url"] : "";
                        const previewIcon = assetType == 'extension' ? 'fa-arrow-up-right-from-square' : 'fa-headphones-simple';

                        $(`<i></i>`)
                            .append(element)
                            .append(`<div class="flex-container flexFlowColumn">
                                        <span class="flex-container alignitemscenter">
                                            <b>${displayName}</b>
                                            <a class="asset_preview" href="${url}" target="_blank" title="Preview in browser">
                                                <i class="fa-solid fa-sm ${previewIcon}"></i>
                                            </a>
                                        </span>
                                        <span>${description}</span>
                                     </div>`)
                            .appendTo(assetTypeMenu);
                    }
                    assetTypeMenu.appendTo("#assets_menu");
                    assetTypeMenu.on('click', 'a.asset_preview', previewAsset);
                }

                $("#assets_menu").show();
            })
            .catch((error) => {
                console.error(error);
                toastr.error("Problem with assets URL", DEBUG_PREFIX + "Cannot get assets list");
                $('#assets-connect-button').addClass("fa-plug-circle-exclamation");
                $('#assets-connect-button').addClass("redOverlayGlow");
            });
    });
}

function previewAsset(e) {
    const href = $(this).attr('href');
    const audioExtensions = ['.mp3', '.ogg', '.wav'];

    if (audioExtensions.some(ext => href.endsWith(ext))) {
        e.preventDefault();

        if (previewAudio) {
            previewAudio.pause();

            if (previewAudio.src === href) {
                previewAudio = null;
                return;
            }
        }

        previewAudio = new Audio(href);
        previewAudio.play();
        return;
    }
}

function isAssetInstalled(assetType, filename) {
    let assetList = currentAssets[assetType];

    if (assetType == 'extension') {
        const thirdPartyMarker = "third-party/";
        assetList = extensionNames.filter(x => x.startsWith(thirdPartyMarker)).map(x => x.replace(thirdPartyMarker, ''));
    }

    for (const i of assetList) {
        //console.debug(DEBUG_PREFIX,i,filename)
        if (i.includes(filename))
            return true;
    }

    return false;
}

async function installAsset(url, assetType, filename) {
    console.debug(DEBUG_PREFIX, "Downloading ", url);
    const category = assetType;
    try {
        if (category === 'extension') {
            console.debug(DEBUG_PREFIX, "Installing extension ", url)
            await installExtension(url);
            console.debug(DEBUG_PREFIX, "Extension installed.")
            return;
        }

        const body = { url, category, filename };
        const result = await fetch('/api/assets/download', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(body),
            cache: 'no-cache',
        });
        if (result.ok) {
            console.debug(DEBUG_PREFIX, "Download success.")
        }
    }
    catch (err) {
        console.log(err);
        return [];
    }
}

async function deleteAsset(assetType, filename) {
    console.debug(DEBUG_PREFIX, "Deleting ", assetType, filename);
    const category = assetType;
    try {
        if (category === 'extension') {
            console.debug(DEBUG_PREFIX, "Deleting extension ", filename)
            await deleteExtension(filename);
            console.debug(DEBUG_PREFIX, "Extension deleted.")
        }

        const body = { category, filename };
        const result = await fetch('/api/assets/delete', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(body),
            cache: 'no-cache',
        });
        if (result.ok) {
            console.debug(DEBUG_PREFIX, "Deletion success.")
        }
    }
    catch (err) {
        console.log(err);
        return [];
    }
}

//#############################//
//  API Calls                  //
//#############################//

async function updateCurrentAssets() {
    console.debug(DEBUG_PREFIX, "Checking installed assets...")
    try {
        const result = await fetch(`/api/assets/get`, {
            method: 'POST',
            headers: getRequestHeaders(),
        });
        currentAssets = result.ok ? (await result.json()) : {};
    }
    catch (err) {
        console.log(err);
    }
    console.debug(DEBUG_PREFIX, "Current assets found:", currentAssets)
}


//#############################//
//  Extension load             //
//#############################//

// This function is called when the extension is loaded
jQuery(async () => {
    // This is an example of loading HTML from a file
    const windowHtml = $(renderExtensionTemplate(MODULE_NAME, 'window', {}));

    const assetsJsonUrl = windowHtml.find('#assets-json-url-field');
    assetsJsonUrl.val(ASSETS_JSON_URL);

    const connectButton = windowHtml.find('#assets-connect-button');
    connectButton.on("click", async function () {
        const url = String(assetsJsonUrl.val());
        const rememberKey = `Assets_SkipConfirm_${getStringHash(url)}`;
        const skipConfirm = localStorage.getItem(rememberKey) === 'true';

        const template = renderExtensionTemplate(MODULE_NAME, 'confirm', { url });
        const confirmation = skipConfirm || await callPopup(template, 'confirm');

        if (confirmation) {
            try {
                if (!skipConfirm) {
                    const rememberValue = Boolean($('#assets-remember').prop('checked'));
                    localStorage.setItem(rememberKey, String(rememberValue));
                }

                console.debug(DEBUG_PREFIX, "Confimation, loading assets...");
                downloadAssetsList(url);
                connectButton.removeClass("fa-plug-circle-exclamation");
                connectButton.removeClass("redOverlayGlow");
                connectButton.addClass("fa-plug-circle-check");
            } catch (error) {
                console.error('Error:', error);
                toastr.error(`Cannot get assets list from ${url}`);
                connectButton.removeClass("fa-plug-circle-check");
                connectButton.addClass("fa-plug-circle-exclamation");
                connectButton.removeClass("redOverlayGlow");
            }
        }
        else {
            console.debug(DEBUG_PREFIX, "Connection refused by user");
        }
    });

    $('#extensions_settings').append(windowHtml);
});
