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

let assetDictFormat = {
    "audio":{
        "ambient": [],
        "bgm":[],
    }};

let availableAssets = JSON.parse(JSON.stringify(assetDictFormat));
let currentAssets = JSON.parse(JSON.stringify(assetDictFormat));

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
                console.log(DEBUG_PREFIX,i)
                if (i["type"] == "ambient"){
                    availableAssets["audio"]["ambient"].push(i);
                }
                if (i["type"] == "bgm"){
                    availableAssets["audio"]["bgm"].push(i);
                }
            }

            console.debug(DEBUG_PREFIX,"Updated available assets to",availableAssets);

            // Audio

            // Ambient
            for(const i in availableAssets["audio"]["ambient"]) {
                const assetId = availableAssets["audio"]["ambient"][i]["id"]
                let assetUrl = availableAssets["audio"]["ambient"][i]["url"]
                const elemId = `assets_install_ambient_${i}`;
                let element = $('<input />', { type: 'checkbox', id: elemId})

                //if (DEBUG_TONY_SAMA_FORK_MODE)
                //    assetUrl = assetUrl.replace("https://github.com/SillyTavern/","https://github.com/Tony-sama/"); // DBG

                console.debug(DEBUG_PREFIX,"Checking asset",assetId, assetUrl);

                if (isAmbientInstalled(assetId)) {
                    console.debug(DEBUG_PREFIX,"installed, checked")
                    element.prop("disabled",true);
                    element.prop("checked",true);
                }
                else {
                    console.debug(DEBUG_PREFIX,"not installed, unchecked")
                    element.prop("checked",false);
                    element.on("click", function(){
                        installAmbient(assetUrl,assetId);
                        element.prop("disabled",true);
                        element.off("click");
                    })
                }

                console.debug(DEBUG_PREFIX,"Created element for BGM",assetId)

                $(`<i></i>`)
                .append(element)
                .append(`<p>${assetId}</p>`)
                .appendTo("#assets_audio_ambient_div");

            }

            // BGM
            for(const i in availableAssets["audio"]["bgm"]) {
                const assetId = availableAssets["audio"]["bgm"][i]["id"]
                let assetUrl = availableAssets["audio"]["bgm"][i]["url"]
                const elemId = `assets_install_bgm_${i}`;
                let element = $('<input />', { type: 'checkbox', id: elemId})

                //if (DEBUG_TONY_SAMA_FORK_MODE)
                //    assetUrl = assetUrl.replace("https://github.com/SillyTavern/","https://github.com/Tony-sama/"); // DBG

                console.debug(DEBUG_PREFIX,"Checking asset",assetId, assetUrl);

                if (isBgmInstalled(assetId)) {
                    console.debug(DEBUG_PREFIX,"installed, checked")
                    element.prop("disabled",true);
                    element.prop("checked",true);
                }
                else {
                    console.debug(DEBUG_PREFIX,"not installed, unchecked")
                    element.prop("checked",false);
                    element.on("click", function(){
                        installBgm(assetUrl,assetId);
                        element.prop("disabled",true);
                        element.off("click");
                    })
                }

                console.debug(DEBUG_PREFIX,"Created element for BGM",assetId)

                $(`<i></i>`)
                .append(element)
                .append(`<p>${assetId}</p>`)
                .appendTo("#assets_audio_bgm_div");

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
                    <div id="assets_audio_div">
                        <h3>Audio</h3>
                        <h4>Ambient</h4>
                        <div id="assets_audio_ambient_div" class="assets-list-div">
                        </div>
                        <h4>BGM</h4>
                        <div id="assets_audio_bgm_div" class="assets-list-div">
                        </div>
                    </div>
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

function isAmbientInstalled(filename) {
    for(const i of currentAssets["audio"]["ambient"]){
        console.debug(DEBUG_PREFIX,i,filename)
        if(i.includes(filename))
            return true;
    }

    return false;
}

function isBgmInstalled(filename) {
    for(const i of currentAssets["audio"]["bgm"]){
        console.debug(DEBUG_PREFIX,i,filename)
        if(i.includes(filename))
            return true;
    }

    return false;
}

async function installAmbient(url, filename) {
    console.debug(DEBUG_PREFIX,"Downloading ",url);
    const save_path = "public/assets/audio/ambient/"+filename;
    try {
        const result = await fetch(`/asset_download?url=${url}&save_path=${save_path}`);
        let musics = result.ok ? (await result.json()) : [];
        return musics;
    }
    catch (err) {
        console.log(err);
        return [];
    }
}

async function installBgm(url, filename) {
    console.debug(DEBUG_PREFIX,"Downloading ",url);
    const save_path = "public/assets/audio/bgm/"+filename;
    try {
        const result = await fetch(`/asset_download?url=${url}&save_path=${save_path}`);
        let musics = result.ok ? (await result.json()) : [];
        return musics;
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
    let assetList
    // Check Ambient list
    assetList = await getAmbientList();
    currentAssets["audio"]["ambient"] = assetList;
    
    // Check BGM list
    assetList = await getBgmList();
    currentAssets["audio"]["bgm"] = assetList;

    console.debug(DEBUG_PREFIX,"Current assets found:",currentAssets)
}

async function getAmbientList() {
    try {
        const result = await fetch(`/get_default_ambient_list`);
        let musics = result.ok ? (await result.json()) : [];
        return musics;
    }
    catch (err) {
        console.log(err);
        return [];
    }
}

async function getBgmList() {
    try {
        const result = await fetch(`/get_default_bgm_list`);
        let musics = result.ok ? (await result.json()) : [];
        return musics;
    }
    catch (err) {
        console.log(err);
        return [];
    }
}


//#############################//
//  Module Worker              //
//#############################//
