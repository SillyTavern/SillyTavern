/*
TODO:
 - Emotion-based BGM
    - per character bgms OK
    - simple fade out/in when switching OK
    - cross fading ?
    - BGM switch cooldown
    - group chat
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

const FALLBACK_EXPRESSION = "neutral";
const DEFAULT_EXPRESSIONS = [
    //"talkinghead",
    "admiration",
    "amusement",
    "anger",
    "annoyance",
    "approval",
    "caring",
    "confusion",
    "curiosity",
    "desire",
    "disappointment",
    "disapproval",
    "disgust",
    "embarrassment",
    "excitement",
    "fear",
    "gratitude",
    "grief",
    "joy",
    "love",
    "nervousness",
    "optimism",
    "pride",
    "realization",
    "relief",
    "remorse",
    "sadness",
    "surprise",
    "neutral"
];
const SPRITE_DOM_ID = "#expression-image";

let fallback_BGMS = null; // Initialized only once with module workers
let ambients = null; // Initialized only once with module workers
let characterMusics = {}; // Updated with module workers

let currentCharacterBGM = null;
let currentExpressionBGM = null;
let currentBackground = null;

let cooldownBGM = 0;

//#############################//
//  Extension UI and Settings  //
//#############################//

const defaultSettings = {
    enabled: true,
    bgm_muted: false,
    ambient_muted: false,
    bgm_volume: 50,
    ambient_volume: 50,
    bgm_cooldown: 30
}

function loadSettings() {
    if (extension_settings.audio === undefined)
        extension_settings.audio = {};

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

    $("#audio_bgm_cooldown").val(extension_settings.audio.bgm_cooldown);
}

async function onEnabledClick() {
    extension_settings.audio.enabled = $('#audio_enabled').is(':checked');
    if (extension_settings.audio.enabled) {
        if ($("#audio_character_bgm").attr("src") != "")
            $("#audio_character_bgm")[0].play();
        if ($("#audio_ambient").attr("src") != "")
            $("#audio_ambient")[0].play();
    } else {
        $("#audio_character_bgm")[0].pause();
        $("#audio_ambient")[0].pause();
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
    console.debug(DEBUG_PREFIX,"UPDATED BGM MAX TO",extension_settings.audio.bgm_volume);
}

async function onAmbientVolumeChange() {
    extension_settings.audio.ambient_volume = ~~($("#audio_ambient_volume_slider").val());
    $("#audio_ambient").prop("volume",extension_settings.audio.ambient_volume * 0.01);
    $("#audio_ambient_volume").text(extension_settings.audio.ambient_volume);
    saveSettingsDebounced();
    console.debug(DEBUG_PREFIX,"UPDATED Ambient MAX TO",extension_settings.audio.ambient_volume);
}

async function onBGMCooldownInput() {
    extension_settings.audio.bgm_cooldown = ~~($("#audio_bgm_cooldown").val());
    cooldownBGM = extension_settings.audio.bgm_cooldown * 1000;
    saveSettingsDebounced();
    console.debug(DEBUG_PREFIX,"UPDATED BGM cooldown to",extension_settings.audio.bgm_cooldown);
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
                        <div>
                            <label for="audio_bgm_cooldown">Music update cooldown (in seconds)</label>
                            <input id="audio_bgm_cooldown" class="text_pole wide30p">
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

    $("#audio_bgm_cooldown").on("input", onBGMCooldownInput);

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

async function getAmbientList() {
    console.debug(DEBUG_PREFIX, "getting ambient audio files");

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

async function getDefaultBgmList() {
    console.debug(DEBUG_PREFIX, "getting default bgm files");

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

async function getCharacterBgmList(name) {
    console.debug(DEBUG_PREFIX, "getting bgm list for", name);

    try {
        const result = await fetch(`/get_character_bgm_list?name=${encodeURIComponent(name)}`);
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
    - Update ambient sound
    - Update character BGM
        - Solo dynamique expression
        - Group only neutral bgm
*/
async function moduleWorker() {
    const moduleEnabled = extension_settings.audio.enabled;

    //console.debug(DEBUG_PREFIX, getContext());

    if (moduleEnabled) {
        cooldownBGM -= UPDATE_INTERVAL;
        //console.debug(DEBUG_PREFIX,currentCharacterBGM,currentExpressionBGM);

        if (fallback_BGMS == null){
            fallback_BGMS = await getDefaultBgmList();
        }

        if (ambients == null){
            ambients = await getAmbientList();
        }

        // 1) Update ambient audio
        // ---------------------------
        let newBackground = $("#bg1").css("background-image");
        newBackground = newBackground.substring(newBackground.lastIndexOf("/")+1).replace(/\.[^/.]+$/, "");

        //console.debug(DEBUG_PREFIX,"Current backgroung:",newBackground);

        if (currentBackground !== newBackground) {
            currentBackground = newBackground;

            console.debug(DEBUG_PREFIX,"Changing ambient audio for",currentBackground);
            updateAmbient();
        }

        const context = getContext();
        //console.debug(DEBUG_PREFIX,context);

        if (context.chat.length == 0)
            return;

        let chatIsGroup = context.chat[0].is_group;
        let newCharacter = null;

        // 1) Update BGM (single chat)
        // -----------------------------
        if (!chatIsGroup) {
            newCharacter = context.name2;

            //console.log(DEBUG_PREFIX,"SOLO CHAT MODE"); // DBG

            // 1.1) First time loading chat
            if (characterMusics[newCharacter] === undefined) {
                await loadCharacterBGM(newCharacter)
                //currentExpressionBGM = FALLBACK_EXPRESSION;
                //currentCharacterBGM = newCharacter;
                
                //updateBGM();
                //cooldownBGM = BGM_UPDATE_COOLDOWN;
                return;
            }

            // 1.2) Switched chat
            if (currentCharacterBGM !== newCharacter) {
                currentCharacterBGM = newCharacter;
                updateBGM();
                cooldownBGM = extension_settings.audio.bgm_cooldown * 1000;
                return;
            }

            const newExpression = getNewExpression();

            // 1.3) Same character but different expression
            if (currentExpressionBGM !== newExpression) {
                
                // Check cooldown
                if (cooldownBGM > 0) {
                    //console.debug(DEBUG_PREFIX,"(SOLO) BGM switch on cooldown:",cooldownBGM);
                    return;
                }

                cooldownBGM = extension_settings.audio.bgm_cooldown * 1000;
                currentExpressionBGM = newExpression;
                console.debug(DEBUG_PREFIX,"(SOLO) Updated current character expression to",currentExpressionBGM);
                updateBGM();
                return;
            }

            return;
        }

        // 2) Update BGM (group chat)
        // -----------------------------
        newCharacter = context.chat[context.chat.length-1].name; 
        const userName = context.name1;
        
        if (newCharacter !== undefined && newCharacter != userName) {

            //console.log(DEBUG_PREFIX,"GROUP CHAT MODE"); // DBG

            // 2.1) First time character appear
            if (characterMusics[newCharacter] === undefined) {
                await loadCharacterBGM(newCharacter);
                return;
            }

            // 2.2) Switched chat
            if (currentCharacterBGM !== newCharacter) {
                // Check cooldown
                if (cooldownBGM > 0) {
                    //console.debug(DEBUG_PREFIX,"(GROUP) BGM switch on cooldown:",cooldownBGM);
                    return;
                }
                cooldownBGM = extension_settings.audio.cooldownBGM;
                currentCharacterBGM = newCharacter;
                currentExpressionBGM = FALLBACK_EXPRESSION;
                updateBGM();
                console.debug(DEBUG_PREFIX,"(GROUP) Updated current character BGM to",currentExpressionBGM);
                return;
            }

            /*
            const newExpression = getNewExpression();

            // 1.3) Same character but different expression
            if (currentExpressionBGM !== newExpression) {
                
                // Check cooldown
                if (cooldownBGM > 0) {
                    console.debug(DEBUG_PREFIX,"BGM switch on cooldown:",cooldownBGM);
                    return;
                }

                cooldownBGM = BGM_UPDATE_COOLDOWN;
                currentExpressionBGM = newExpression;
                console.debug(DEBUG_PREFIX,"Updated current character expression to",currentExpressionBGM);
                updateBGM();
                return;
            }

            return;*/

        }
            
        // Case 3: Same character/expression or BGM switch on cooldown keep playing same BGM
        //console.debug(DEBUG_PREFIX,"Nothing to do for",currentCharacterBGM, newCharacter, currentExpressionBGM, cooldownBGM);
    }
}

async function loadCharacterBGM(newCharacter) {
    console.debug(DEBUG_PREFIX,"New character detected, loading BGM folder of",newCharacter);
            
    // 1.1) First time character appear, load its music folder
    const audio_file_paths = await getCharacterBgmList(newCharacter);
    console.debug(DEBUG_PREFIX, "Recieved", audio_file_paths);
    
    // Initialise expression/files mapping
    characterMusics[newCharacter] = {};
    for(const e of DEFAULT_EXPRESSIONS)
        characterMusics[newCharacter][e] = [];

    for(const i of audio_file_paths) {
        //console.debug(DEBUG_PREFIX,"File found:",i);
        for(const e of DEFAULT_EXPRESSIONS)
            if (i["label"].includes(e))
                characterMusics[newCharacter][e].push(i["path"]);
    }
    console.debug(DEBUG_PREFIX,"Updated BGM map of",newCharacter,"to",characterMusics[newCharacter]);
}

function getNewExpression() {
    let newExpression; 
        
    // HACK: use sprite file name as expression detection
    if (!$(SPRITE_DOM_ID).length) {
        console.error(DEBUG_PREFIX,"ERROR: expression sprite does not exist, cannot extract expression from ",SPRITE_DOM_ID)
        return FALLBACK_EXPRESSION;
    }

    const spriteFile = $("#expression-image").attr("src");
    newExpression = spriteFile.substring(spriteFile.lastIndexOf("/")+1).replace(/\.[^/.]+$/, "");
    //

    // No sprite to detect expression
    if (newExpression == "") {
        //console.info(DEBUG_PREFIX,"Warning: no expression extracted from sprite, switch to",FALLBACK_EXPRESSION);
        newExpression = FALLBACK_EXPRESSION;
    }

    if (!DEFAULT_EXPRESSIONS.includes(newExpression)) {
        console.info(DEBUG_PREFIX,"Warning:",newExpression," is not a handled expression, expected one of",FALLBACK_EXPRESSION);
        return FALLBACK_EXPRESSION;
    }

    return newExpression;
}

async function updateBGM() {
    let audio_files = characterMusics[currentCharacterBGM][currentExpressionBGM];// Try char expression BGM

    if (audio_files === undefined || audio_files.length == 0) { 
        console.debug(DEBUG_PREFIX,"No BGM for", currentCharacterBGM,currentExpressionBGM);
        audio_files = characterMusics[currentCharacterBGM][FALLBACK_EXPRESSION]; // Try char FALLBACK BGM
        if (audio_files === undefined || audio_files.length == 0) {
            console.debug(DEBUG_PREFIX,"No default BGM for",currentCharacterBGM,FALLBACK_EXPRESSION, "switch to ST BGM");
            audio_files = fallback_BGMS; // ST FALLBACK BGM

            if(audio_files.length == 0) {
                console.debug(DEBUG_PREFIX,"No default BGM file found, bgm folder may be empty.");
                return;
            }
        }
    }

    const audio_file_path = audio_files[Math.floor(Math.random() * audio_files.length)];
    console.log(DEBUG_PREFIX,"Updating BGM");
    console.log(DEBUG_PREFIX,"Checking file",audio_file_path);
    try {
        const response = await fetch(audio_file_path);
        
        if (!response.ok) {
            console.log(DEBUG_PREFIX,"File not found!")
        }
        else {
            console.log(DEBUG_PREFIX,"Switching BGM to",currentExpressionBGM)
            const audio = $("#audio_character_bgm");

            if (audio.attr("src") == audio_file_path) {
                console.log(DEBUG_PREFIX,"Already playing, ignored");
                return;
            }

            audio.animate({volume: 0.0}, 2000, function() {
                audio.attr("src",audio_file_path);
                audio[0].play();
                audio.volume = extension_settings.audio.bgm_volume * 0.01;
                audio.animate({volume: extension_settings.audio.bgm_volume * 0.01}, 2000);
            })
        }

    } catch(error) {
        console.log(DEBUG_PREFIX,"Error while trying to fetch",audio_file_path,":",error);
    }
}

async function updateAmbient() {
    let audio_file_path = null;
    for(const i of ambients) {
        console.debug(i)
        if (i.includes(decodeURIComponent(currentBackground))) {
            audio_file_path = i;
            break;
        }
    }

    if (audio_file_path === null) {
        console.debug(DEBUG_PREFIX,"No ambient file found for background",currentBackground);
        return;
    }

    //const audio_file_path = AMBIENT_FOLDER+currentBackground+".mp3";
    console.log(DEBUG_PREFIX,"Updating ambient");
    console.log(DEBUG_PREFIX,"Checking file",audio_file_path);
 
    const audio = $("#audio_ambient");
    audio.animate({volume: 0.0}, 2000, function() {
        audio.attr("src",audio_file_path);
        audio[0].play();
        audio.volume = extension_settings.audio.ambient_volume * 0.01;
        audio.animate({volume: extension_settings.audio.ambient_volume * 0.01}, 2000);
    });
}