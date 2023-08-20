/*
TODO:
 - Emotion-based BGM
    - per character bgms OK
    - simple fade out/in when switching OK
    - cross fading ?
 - Background based ambient sounds
    - global sounds OK
    - global overides ?
    - import option on background UI ?
 - One UI with different mixing options OK
 - Allow background music edition using background menu
    - https://fontawesome.com/icons/music?f=classic&s=solid
    - https://codepen.io/noirsociety/pen/rNQxQwm
    - https://codepen.io/xrocker/pen/abdKVGy
*/

import { saveSettingsDebounced } from "../../../script.js";
import { getContext, getApiUrl, extension_settings, doExtrasFetch, ModuleWorkerWrapper, modules } from "../../extensions.js";
export { MODULE_NAME };

const MODULE_NAME = 'Audio';
const DEBUG_PREFIX = "<Audio module> ";
const UPDATE_INTERVAL = 1000;

const MUSIC_FALLBACK = "default"
const EXPRESSIONS_LIST = ["default","anger","fear","joy","love","sadness","surprise"];
const SPRITE_DOM_ID = "#expression-image"
const AMBIENT_FOLDER = "backgrounds/audio/default/"

let characterMusics = {}; // Updated with module worker
let ambientMusics = []; // Initialized only once

let currentCharacter = null;
let currentExpression = "default";
let currentBackground = "default"

//#############################//
//  Extension UI and Settings  //
//#############################//

const defaultSettings = {
    enabled: false,
    bgm_muted: false,
    ambient_muted: false,
    bgm_volume: 50,
    ambient_volume: 50,
}

function loadSettings() {
    if (Object.keys(extension_settings.audio).length === 0) {
        Object.assign(extension_settings.audio, defaultSettings)
    }
    $("#audio_enabled").prop('checked', extension_settings.audio.enabled);

    $("#audio_character_bgm_volume").text(extension_settings.audio.bgm_volume);
    $("#audio_ambient_volume").text(extension_settings.audio.ambient_volume);

    $("#audio_character_bgm_volume_slider").val(extension_settings.audio.bgm_volume);
    $("#audio_ambient_volume_slider").val(extension_settings.audio.ambient_volume);
    
    if (extension_settings.audio.bgm_muted) {
        $("#audio_character_bgm_mute_icon").toggleClass("fa-volume-high");
        $("#audio_character_bgm_mute_icon").toggleClass("fa-volume-mute");
        $("#audio_character_bgm").prop("muted", true);
    }

    if (extension_settings.audio.ambient_muted) {
        $("#audio_ambient_mute_icon").toggleClass("fa-volume-high");
        $("#audio_ambient_mute_icon").toggleClass("fa-volume-mute");
        $("#audio_ambient").prop("muted", true);
    }
}

async function onEnabledClick() {
    extension_settings.audio.enabled = $('#audio_enabled').is(':checked');
    if (extension_settings.audio.enabled) {
        $("#audio_character_bgm").play();
        $("#audio_ambient").play();
    } else {
        $("#audio_character_bgm").pause();
        $("#audio_ambient").pause();
    }
    saveSettingsDebounced();
}

async function onBGMMuteClick() {
    extension_settings.audio.bgm_muted = !extension_settings.audio.bgm_muted;
    $("#audio_character_bgm_mute_icon").toggleClass("fa-volume-high");
    $("#audio_character_bgm_mute_icon").toggleClass("fa-volume-mute");
    $("#audio_character_bgm").prop("muted", !$("#audio_character_bgm").prop("muted"));
    saveSettingsDebounced();
}

async function onAmbientMuteClick() {
    extension_settings.audio.ambient_muted = !extension_settings.audio.ambient_muted;
    $("#audio_ambient_mute_icon").toggleClass("fa-volume-high");
    $("#audio_ambient_mute_icon").toggleClass("fa-volume-mute");
    $("#audio_ambient").prop("muted", !$("#audio_ambient").prop("muted"));
    saveSettingsDebounced();
}

async function onBGMVolumeChange() {
    extension_settings.audio.bgm_volume = ~~($("#audio_character_bgm_volume_slider").val());
    $("#audio_character_bgm").prop("volume",extension_settings.audio.bgm_volume * 0.01);
    $("#audio_character_bgm_volume").text(extension_settings.audio.bgm_volume);
    saveSettingsDebounced();
    console.debug(DEBUG_PREFIX,"UPDATED BGM MAX TO",extension_settings.audio.bgm_volume)
}

async function onAmbientVolumeChange() {
    extension_settings.audio.ambient_volume = ~~($("#audio_ambient_volume_slider").val());
    $("#audio_ambient").prop("volume",extension_settings.audio.ambient_volume * 0.01);
    $("#audio_ambient_volume").text(extension_settings.audio.ambient_volume);
    saveSettingsDebounced();
    console.debug(DEBUG_PREFIX,"UPDATED Ambient MAX TO",extension_settings.audio.ambient_volume)
}


$(document).ready(function () {
    function addExtensionControls() {
        const settingsHtml = `
        <div id="audio_settings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>Audio</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <div>
                        <label class="checkbox_label" for="audio_enabled">
                            <input type="checkbox" id="audio_enabled" name="audio_enabled">
                            <small>Enabled</small>
                        </label>
                        <label class="checkbox_label" for="audio_debug">
                            <input type="checkbox" id="audio_debug" name="audio_debug">
                            <small>Debug</small>
                        </label>
                    </div>
                    <div>
                        <div>
                            <label for="audio_character_bgm_volume_slider">Music <span id="audio_character_bgm_volume"></span></label>
                            <div class="mixer-div">
                                <div id="audio_character_bgm_mute" class="menu_button audio-mute-button">
                                    <i class="fa-solid fa-volume-high fa-lg" id="audio_character_bgm_mute_icon"></i>
                                </div>
                                <input type="range" class ="slider" id ="audio_character_bgm_volume_slider" value = "0" maxlength ="100">
                            </div>
                            <audio id="audio_character_bgm" controls src="">
                        </div>
                        <div>
                            <label for="audio_ambient_volume_slider">Ambient <span id="audio_ambient_volume"></span></label>
                            <div class="mixer-div">
                                <div id="audio_character_ambient_mute" class="menu_button audio-mute-button">
                                    <i class="fa-solid fa-volume-high fa-lg" id="audio_ambient_mute_icon"></i>
                                </div>
                                <input type="range" class ="slider" id ="audio_ambient_volume_slider" value = "0" maxlength ="100">
                            </div>
                            <audio id="audio_ambient" controls src="">
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
    
    $("#audio_character_bgm").attr("loop",true);
    $("#audio_ambient").attr("loop",true);

    $("#audio_character_bgm").hide();
    $("#audio_ambient").hide();
    $("#audio_character_bgm_mute").on("click",onBGMMuteClick);
    $("#audio_character_ambient_mute").on("click",onAmbientMuteClick);

    $("#audio_enabled").on("click", onEnabledClick);
    $("#audio_character_bgm_volume_slider").on("input", onBGMVolumeChange);
    $("#audio_ambient_volume_slider").on("input", onAmbientVolumeChange);

    // DBG
    $("#audio_debug").on("click",function() {
        if($("#audio_debug").is(':checked')) {
            $("#audio_character_bgm").show();
            $("#audio_ambient").show();
        }
        else {
            $("#audio_character_bgm").hide();
            $("#audio_ambient").hide();
        }
    });
    //

    const wrapper = new ModuleWorkerWrapper(moduleWorker);
    setInterval(wrapper.update.bind(wrapper), UPDATE_INTERVAL);
    moduleWorker();
})

//#############################//
//  API Calls                  //
//#############################//

async function getMusicsList(name) {
    console.debug(DEBUG_PREFIX, "getting bgm list for", name);

    try {
        const result = await fetch(`/get_character_background_musics?name=${encodeURIComponent(name)}`);
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

/*
    - Update character BGM
    - Update ambient sound
*/
async function moduleWorker() {
    const moduleEnabled = extension_settings.audio.enabled;

    //console.debug(DEBUG_PREFIX, getContext());

    if (moduleEnabled) {

        // Update ambient audio
        let newBackground = $("#bg1").css("background-image");
        newBackground = newBackground.substring(newBackground.lastIndexOf("/")+1).replace(/\.[^/.]+$/, "");

        console.debug(DEBUG_PREFIX,"Current backgroung:",newBackground);

        if (currentBackground !== newBackground & newBackground != "none") {
            currentBackground = newBackground;

            console.debug(DEBUG_PREFIX,"Changing ambient audio");
            updateAmbient();
        }

        const newCharacter = getContext().name2;

        // Case 1: character changed (new chat or group chat)
        if (currentCharacter !== newCharacter) {
            currentCharacter = newCharacter;

            console.debug(DEBUG_PREFIX,"Updated current character to",currentCharacter);
            
            // 1.1) First time character appear, load its music folder
            if (characterMusics[currentCharacter] === undefined) {
                const audio_file_paths = await getMusicsList(currentCharacter);
                console.debug(DEBUG_PREFIX, "Recieved", audio_file_paths);
                
                // Initialise expression/files mapping
                characterMusics[currentCharacter] = {};
                for(const e of EXPRESSIONS_LIST)
                    characterMusics[currentCharacter][e] = [];

                for(const i of audio_file_paths) {
                    //console.debug(DEBUG_PREFIX,"File found:",i);
                    for(const e of EXPRESSIONS_LIST)
                        if (i["label"].includes(e))
                            characterMusics[currentCharacter][e].push(i["path"]);
                }
                console.debug(DEBUG_PREFIX,"Updated BGM map of",currentCharacter,"to",characterMusics[currentCharacter]);
            }
            
            // Character changed require BGM/ambient update whatever the expression
            currentExpression = "default";
            updateBGM();
            return;
        }

        let newExpression = MUSIC_FALLBACK; 

        if (!$(SPRITE_DOM_ID).length) {
            console.error(DEBUG_PREFIX,"ERROR: expression sprite does not exist, cannot extract expression from ",SPRITE_DOM_ID)
        }

        // HACK: use sprite file name as expression detection
        const spriteFile = $("#expression-image").attr("src");
        newExpression = spriteFile.substring(spriteFile.lastIndexOf("/")+1).replace(/\.[^/.]+$/, "");
        console.debug(DEBUG_PREFIX,"Current expression",newExpression);

        if (!EXPRESSIONS_LIST.includes(newExpression)) {
            console.debug(DEBUG_PREFIX,"Not a valid expression, ignored");
            return;
        }

        // Case 2: Same character but different expression
        if (currentExpression !== newExpression) {
            currentExpression = newExpression;
            console.debug(DEBUG_PREFIX,"Updated current character expression to",currentExpression);
            updateBGM();
            return;
        }

        // Case 3: Same character/expression keep playing same BGM
    }
}

async function updateBGM() {
    const audio_files = characterMusics[currentCharacter][currentExpression];
    const audio_file_path = audio_files[Math.floor(Math.random() * audio_files.length)]; // random pick
    console.log("<MUSIC module> Checking audio file",audio_file_path)
    fetch(audio_file_path)
    .then(response => {
        if (!response.ok) {
            console.log("<MUSIC module> File not found!")
        }
        else {
            console.log("<MUSIC module> Playing emotion",currentExpression)
            const audio = $("#audio_character_bgm");

            audio.animate({volume: 0.0}, 2000, function() {
                audio.attr("src",audio_file_path);
                audio[0].play();
                audio.volume = extension_settings.audio.bgm_volume * 0.01;
                audio.animate({volume: extension_settings.audio.bgm_volume * 0.01}, 2000);
            })
        }
    });
}

async function updateAmbient() {
    const audio_file_path = AMBIENT_FOLDER+currentBackground+".mp3";
    console.log("<MUSIC module> Changing ambient audio for",audio_file_path)
    fetch(audio_file_path)
    .then(response => {
        if (!response.ok) {
            console.log("<MUSIC module> File not found!")
        }
        else {
            console.log("<MUSIC module> Changing ambient audio for",currentBackground)
            const audio = $("#audio_ambient");

            audio.animate({volume: 0.0}, 2000, function() {
                audio.attr("src",audio_file_path);
                audio[0].play();
                audio.volume = extension_settings.audio.ambient_volume * 0.01;
                audio.animate({volume: extension_settings.audio.ambient_volume * 0.01}, 2000);
            })
        }
    });
}