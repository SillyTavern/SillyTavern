/*
TODO:
 - Check failed install file (0kb size ?)
*/
//const DEBUG_TONY_SAMA_FORK_MODE = false

import { saveSettingsDebounced, getRequestHeaders, callPopup } from "../../../script.js";
import { getContext, getApiUrl, extension_settings, doExtrasFetch, ModuleWorkerWrapper, modules } from "../../extensions.js";
export { MODULE_NAME };

const MODULE_NAME = 'Assets';
const DEBUG_PREFIX = "<Assets module> ";
const UPDATE_INTERVAL = 1000;
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
    updateCurrentAssets().then(function(){
    fetch(url)
        .then(response => response.json())
        .then(json => {
            
            availableAssets = {};
            $("#assets_menu").empty();

            console.debug(DEBUG_PREFIX,"Received assets dictionary", json);

            for(const i of json){
                //console.log(DEBUG_PREFIX,i)
                if (availableAssets[i["type"]] === undefined)
                    availableAssets[i["type"]] = [];
            
                availableAssets[i["type"]].push(i);
            }

            console.debug(DEBUG_PREFIX,"Updated available assets to",availableAssets);

            for (const assetType in availableAssets) {
                let assetTypeMenu = $('<div />', {id:"assets_audio_ambient_div", class:"assets-list-div"});
                assetTypeMenu.append(`<h3>${assetType}</h3>`)
                for (const i in availableAssets[assetType]) {
                    const asset = availableAssets[assetType][i];
                    const elemId = `assets_install_${assetType}_${i}`;
                    let element = $('<button />', { id:elemId, type:"button", class:"asset-download-button menu_button"})
                    const label = $("<i class=\"fa-solid fa-download fa-xl\"></i>");
                    element.append(label);
    
                    //if (DEBUG_TONY_SAMA_FORK_MODE)
                    //    assetUrl = assetUrl.replace("https://github.com/SillyTavern/","https://github.com/Tony-sama/"); // DBG
    
                    console.debug(DEBUG_PREFIX,"Checking asset",asset["id"], asset["url"]);
    
                    if (isAssetInstalled(assetType, asset["id"])) {
                        console.debug(DEBUG_PREFIX,"installed, checked");
                        label.toggleClass("fa-download");
                        label.toggleClass("fa-check");
                    }
                    else {
                        console.debug(DEBUG_PREFIX,"not installed, unchecked")
                        element.prop("checked",false);
                        element.on("click", async function(){
                            element.off("click");
                            label.toggleClass("fa-download");
                            this.classList.toggle('asset-download-button-loading');
                            await installAsset(asset["url"], assetType, asset["id"]);
                            label.toggleClass("fa-check");
                            this.classList.toggle('asset-download-button-loading');
                        })
                    }
    
                    console.debug(DEBUG_PREFIX,"Created element for BGM",asset["id"])
    
                    $(`<i></i>`)
                    .append(element)
                    .append(`<span>${asset["id"]}</span>`)
                    .appendTo(assetTypeMenu);
                }
                assetTypeMenu.appendTo("#assets_menu");
            }

            $("#assets_menu").show();
        })
        .catch((error) => {
            console.error(error);
            toastr.error("Problem with assets URL",DEBUG_PREFIX+"Cannot get assets list")
        });
    });
}

function isAssetInstalled(assetType,filename) {
    for(const i of currentAssets[assetType]){
        //console.debug(DEBUG_PREFIX,i,filename)
        if(i.includes(filename))
            return true;
    }

    return false;
}

async function installAsset(url, assetType, filename) {
    console.debug(DEBUG_PREFIX,"Downloading ",url);
    const category = assetType;
    try {
        const result = await fetch(`/asset_download?url=${url}&category=${category}&filename=${filename}`, {
            method: 'POST',
            headers: getRequestHeaders(),
        });
        if(result.ok) {
            console.debug(DEBUG_PREFIX,"Download success.")
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
    console.debug(DEBUG_PREFIX,"Checking installed assets...")
    try {
        const result = await fetch(`/get_assets`, {
            method: 'POST',
            headers: getRequestHeaders(),
        });
        currentAssets = result.ok ? (await result.json()) : {};
    }
    catch (err) {
        console.log(err);
    }
    console.debug(DEBUG_PREFIX,"Current assets found:",currentAssets)
}


//#############################//
//  Extension load             //
//#############################//

// This function is called when the extension is loaded
jQuery(async () => {
    // This is an example of loading HTML from a file
    const windowHtml = $(await $.get(`${extensionFolderPath}/window.html`));

    const assetsJsonUrl = windowHtml.find('#assets_json_url_field');
    assetsJsonUrl.val(ASSETS_JSON_URL);

    const connectButton = windowHtml.find('#assets_connect_button');
    connectButton.on("click", async function(){
        const confirmation = await callPopup(`Are you sure you want to connect to '${assetsJsonUrl.val()}'?`, 'confirm')
        if (confirmation) {
            try {
                console.debug(DEBUG_PREFIX,"Confimation, loading assets...");
                downloadAssetsList(assetsJsonUrl.val());
            } catch (error) {
                console.error('Error:', error);
                toastr.error(`Cannot get assets list from ${assetsJsonUrl.val()}`);
            }
        }
        else {
            console.debug(DEBUG_PREFIX,"Connection refused by user");
        }
    });

    $('#extensions_settings').append(windowHtml);
});