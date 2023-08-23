/*
TODO:
 - Check failed install file (0kb size ?)
*/
//const DEBUG_TONY_SAMA_FORK_MODE = false

import { saveSettingsDebounced } from "../../../script.js";
import { getContext, getApiUrl, extension_settings, doExtrasFetch, ModuleWorkerWrapper, modules } from "../../extensions.js";
export { MODULE_NAME };

const MODULE_NAME = 'Assets';
const DEBUG_PREFIX = "<Assets module> ";
const UPDATE_INTERVAL = 1000;
let ASSETS_JSON_URL = "https://raw.githubusercontent.com/SillyTavern/SillyTavern-Content/main/index.json"

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

function loadSettings() {
    updateCurrentAssets().then(function(){
    fetch(ASSETS_JSON_URL)
        .then(response => response.json())
        .then(json => {
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
                    let element = $('<input />', { type: 'checkbox', id: elemId})
    
                    //if (DEBUG_TONY_SAMA_FORK_MODE)
                    //    assetUrl = assetUrl.replace("https://github.com/SillyTavern/","https://github.com/Tony-sama/"); // DBG
    
                    console.debug(DEBUG_PREFIX,"Checking asset",asset["id"], asset["url"]);
    
                    if (isAssetInstalled(assetType, asset["id"])) {
                        console.debug(DEBUG_PREFIX,"installed, checked")
                        element.prop("disabled",true);
                        element.prop("checked",true);
                    }
                    else {
                        console.debug(DEBUG_PREFIX,"not installed, unchecked")
                        element.prop("checked",false);
                        element.on("click", function(){
                            installAsset(asset["url"], assetType, asset["id"]);
                            element.prop("disabled",true);
                            element.off("click");
                        })
                    }
    
                    console.debug(DEBUG_PREFIX,"Created element for BGM",asset["id"])
    
                    $(`<i></i>`)
                    .append(element)
                    .append(`<p>${asset["id"]}</p>`)
                    .appendTo(assetTypeMenu);
                }
                assetTypeMenu.appendTo("#assets_menu");
            }
        });
    });
}

$(document).ready(function () {
    function addExtensionControls() {
        const settingsHtml = `
        <div id="audio_settings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>Assets</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content" id="assets_menu">
                </div>
            </div>
        </div>
        `;
        $('#extensions_settings').append(settingsHtml);
    }
    
    addExtensionControls(); // No init dependencies
    loadSettings(); // Depends on Extension Controls
    

    //const wrapper = new ModuleWorkerWrapper(moduleWorker);
    //setInterval(wrapper.update.bind(wrapper), UPDATE_INTERVAL);
    //moduleWorker();
})

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
    const save_path = "public/assets/"+assetType+"/"+filename;
    try {
        const result = await fetch(`/asset_download?url=${url}&save_path=${save_path}`);
        let assets = result.ok ? (await result.json()) : [];
        return assets;
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
        const result = await fetch(`/get_assets`);
        currentAssets = result.ok ? (await result.json()) : {};
    }
    catch (err) {
        console.log(err);
    }
    console.debug(DEBUG_PREFIX,"Current assets found:",currentAssets)
}


//#############################//
//  Module Worker              //
//#############################//
