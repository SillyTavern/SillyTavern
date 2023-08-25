/*
Ideas:
 - cross fading between bgm / start a different time
 - Background based ambient sounds
    - import option on background UI ?
 - Allow background music edition using background menu
    - https://fontawesome.com/icons/music?f=classic&s=solid
    - https://codepen.io/noirsociety/pen/rNQxQwm
    - https://codepen.io/xrocker/pen/abdKVGy
*/

import { saveSettingsDebounced, getRequestHeaders } from "../../../script.js";
import { getContext, extension_settings, ModuleWorkerWrapper } from "../../extensions.js";
import { isDataURL } from "../../utils.js";
export { MODULE_NAME };

const extensionName = "audio";
const extensionFolderPath = `scripts/extensions/${extensionName}`;

const MODULE_NAME = 'Audio';
const DEBUG_PREFIX = "<Audio module> ";
const UPDATE_INTERVAL = 1000;

const ASSETS_BGM_FOLDER = "bgm";
const ASSETS_AMBIENT_FOLDER = "ambient";
const CHARACTER_BGM_FOLDER = "bgm"

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
    enabled: false,
    bgm_muted: true,
    ambient_muted: true,
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

    $("#audio_bgm_volume").text(extension_settings.audio.bgm_volume);
    $("#audio_ambient_volume").text(extension_settings.audio.ambient_volume);

    $("#audio_bgm_volume_slider").val(extension_settings.audio.bgm_volume);
    $("#audio_ambient_volume_slider").val(extension_settings.audio.ambient_volume);

    if (extension_settings.audio.bgm_muted) {
        $("#audio_bgm_mute_icon").removeClass("fa-volume-high");
        $("#audio_bgm_mute_icon").addClass("fa-volume-mute");
        $("#audio_bgm_mute").addClass("redOverlayGlow");
        $("#audio_bgm").prop("muted", true);
    }
    else{
        $("#audio_bgm_mute_icon").addClass("fa-volume-high");
        $("#audio_bgm_mute_icon").removeClass("fa-volume-mute");
        $("#audio_bgm_mute").removeClass("redOverlayGlow");
        $("#audio_bgm").prop("muted", false);
    }

    if (extension_settings.audio.ambient_muted) {
        $("#audio_ambient_mute_icon").removeClass("fa-volume-high");
        $("#audio_ambient_mute_icon").addClass("fa-volume-mute");
        $("#audio_ambient_mute").addClass("redOverlayGlow");
        $("#audio_ambient").prop("muted", true);
    }
    else{
        $("#audio_ambient_mute_icon").addClass("fa-volume-high");
        $("#audio_ambient_mute_icon").removeClass("fa-volume-mute");
        $("#audio_ambient_mute").removeClass("redOverlayGlow");
        $("#audio_ambient").prop("muted", false);
    }

    $("#audio_bgm_cooldown").val(extension_settings.audio.bgm_cooldown);

    $("#audio_debug_div").hide(); // DBG
}

async function onEnabledClick() {
    extension_settings.audio.enabled = $('#audio_enabled').is(':checked');
    if (extension_settings.audio.enabled) {
        if ($("#audio_bgm").attr("src") != "")
            $("#audio_bgm")[0].play();
        if ($("#audio_ambient").attr("src") != "")
            $("#audio_ambient")[0].play();
    } else {
        $("#audio_bgm")[0].pause();
        $("#audio_ambient")[0].pause();
    }
    saveSettingsDebounced();
}

async function onBGMMuteClick() {
    extension_settings.audio.bgm_muted = !extension_settings.audio.bgm_muted;
    $("#audio_bgm_mute_icon").toggleClass("fa-volume-high");
    $("#audio_bgm_mute_icon").toggleClass("fa-volume-mute");
    $("#audio_bgm").prop("muted", !$("#audio_bgm").prop("muted"));
    $("#audio_bgm_mute").toggleClass("redOverlayGlow");
    saveSettingsDebounced();
}

async function onAmbientMuteClick() {
    extension_settings.audio.ambient_muted = !extension_settings.audio.ambient_muted;
    $("#audio_ambient_mute_icon").toggleClass("fa-volume-high");
    $("#audio_ambient_mute_icon").toggleClass("fa-volume-mute");
    $("#audio_ambient").prop("muted", !$("#audio_ambient").prop("muted"));
    $("#audio_ambient_mute").toggleClass("redOverlayGlow");
    saveSettingsDebounced();
}

async function onBGMVolumeChange() {
    extension_settings.audio.bgm_volume = ~~($("#audio_bgm_volume_slider").val());
    $("#audio_bgm").prop("volume", extension_settings.audio.bgm_volume * 0.01);
    $("#audio_bgm_volume").text(extension_settings.audio.bgm_volume);
    saveSettingsDebounced();
    //console.debug(DEBUG_PREFIX,"UPDATED BGM MAX TO",extension_settings.audio.bgm_volume);
}

async function onAmbientVolumeChange() {
    extension_settings.audio.ambient_volume = ~~($("#audio_ambient_volume_slider").val());
    $("#audio_ambient").prop("volume", extension_settings.audio.ambient_volume * 0.01);
    $("#audio_ambient_volume").text(extension_settings.audio.ambient_volume);
    saveSettingsDebounced();
    //console.debug(DEBUG_PREFIX,"UPDATED Ambient MAX TO",extension_settings.audio.ambient_volume);
}

async function onBGMCooldownInput() {
    extension_settings.audio.bgm_cooldown = ~~($("#audio_bgm_cooldown").val());
    cooldownBGM = extension_settings.audio.bgm_cooldown * 1000;
    saveSettingsDebounced();
    console.debug(DEBUG_PREFIX, "UPDATED BGM cooldown to", extension_settings.audio.bgm_cooldown);
}

//#############################//
//  API Calls                  //
//#############################//

async function getAssetsList(type) {
    console.debug(DEBUG_PREFIX, "getting assets of type", type);

    try {
        const result = await fetch(`/get_assets`, {
            method: 'POST',
            headers: getRequestHeaders(),
        });
        const assets = result.ok ? (await result.json()) : { type: [] };
        console.debug(DEBUG_PREFIX, "Found assets:", assets);
        return assets[type];
    }
    catch (err) {
        console.log(err);
        return [];
    }
}

async function getCharacterBgmList(name) {
    console.debug(DEBUG_PREFIX, "getting bgm list for", name);

    try {
        const result = await fetch(`/get_character_assets_list?name=${encodeURIComponent(name)}&category=${CHARACTER_BGM_FOLDER}`, {
            method: 'POST',
            headers: getRequestHeaders(),
        });
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

    if (moduleEnabled) {

        if (cooldownBGM > 0)
            cooldownBGM -= UPDATE_INTERVAL;

        if (fallback_BGMS == null) {
            console.debug(DEBUG_PREFIX, "Updating audio bgm assets...");
            fallback_BGMS = await getAssetsList(ASSETS_BGM_FOLDER);
            fallback_BGMS = fallback_BGMS.filter((filename) => filename != ".placeholder")
            console.debug(DEBUG_PREFIX, "Detected assets:", fallback_BGMS);
        }

        if (ambients == null) {
            console.debug(DEBUG_PREFIX, "Updating audio ambient assets...");
            ambients = await getAssetsList(ASSETS_AMBIENT_FOLDER);
            ambients = ambients.filter((filename) => filename != ".placeholder")
            console.debug(DEBUG_PREFIX, "Detected assets:", ambients);
        }

        // 1) Update ambient audio
        // ---------------------------
        let newBackground = $("#bg1").css("background-image");
        const custom_background = getContext()["chatMetadata"]["custom_background"];

        if (custom_background !== undefined)
            newBackground = custom_background

        if (!isDataURL(newBackground)) {
            newBackground = newBackground.substring(newBackground.lastIndexOf("/") + 1).replace(/\.[^/.]+$/, "").replaceAll("%20", "-").replaceAll(" ", "-"); // remove path and spaces

            //console.debug(DEBUG_PREFIX,"Current backgroung:",newBackground);

            if (currentBackground !== newBackground) {
                currentBackground = newBackground;

                console.debug(DEBUG_PREFIX, "Changing ambient audio for", currentBackground);
                updateAmbient();
            }
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
                await loadCharacterBGM(newCharacter);
                currentExpressionBGM = FALLBACK_EXPRESSION;
                //currentCharacterBGM = newCharacter;

                //updateBGM();
                //cooldownBGM = BGM_UPDATE_COOLDOWN;
                return;
            }

            // 1.2) Switched chat
            if (currentCharacterBGM !== newCharacter) {
                currentCharacterBGM = newCharacter;
                try {
                    await updateBGM();
                    cooldownBGM = extension_settings.audio.bgm_cooldown * 1000;
                }
                catch (error) {
                    console.debug(DEBUG_PREFIX, "Error while trying to update BGM character, will try again");
                    currentCharacterBGM = null
                }
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

                try {
                    await updateBGM();
                    cooldownBGM = extension_settings.audio.bgm_cooldown * 1000;
                    currentExpressionBGM = newExpression;
                    console.debug(DEBUG_PREFIX, "(SOLO) Updated current character expression to", currentExpressionBGM, "cooldown", cooldownBGM);
                }
                catch (error) {
                    console.debug(DEBUG_PREFIX, "Error while trying to update BGM expression, will try again");
                    currentCharacterBGM = null
                }
                return;
            }

            return;
        }

        // 2) Update BGM (group chat)
        // -----------------------------
        newCharacter = context.chat[context.chat.length - 1].name;
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

                try {
                    currentCharacterBGM = newCharacter;
                    await updateBGM();
                    cooldownBGM = extension_settings.audio.bgm_cooldown * 1000;
                    currentCharacterBGM = newCharacter;
                    currentExpressionBGM = FALLBACK_EXPRESSION;
                    console.debug(DEBUG_PREFIX, "(GROUP) Updated current character BGM to", currentExpressionBGM, "cooldown", cooldownBGM);
                }
                catch (error) {
                    console.debug(DEBUG_PREFIX, "Error while trying to update BGM group, will try again");
                    currentCharacterBGM = null
                }
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
    console.debug(DEBUG_PREFIX, "New character detected, loading BGM folder of", newCharacter);

    // 1.1) First time character appear, load its music folder
    const audio_file_paths = await getCharacterBgmList(newCharacter);
    //console.debug(DEBUG_PREFIX, "Recieved", audio_file_paths);

    // Initialise expression/files mapping
    characterMusics[newCharacter] = {};
    for (const e of DEFAULT_EXPRESSIONS)
        characterMusics[newCharacter][e] = [];

    for (const i of audio_file_paths) {
        //console.debug(DEBUG_PREFIX,"File found:",i);
        for (const e of DEFAULT_EXPRESSIONS)
            if (i.includes(e))
                characterMusics[newCharacter][e].push(i);
    }
    console.debug(DEBUG_PREFIX, "Updated BGM map of", newCharacter, "to", characterMusics[newCharacter]);
}

function getNewExpression() {
    let newExpression;

    // HACK: use sprite file name as expression detection
    if (!$(SPRITE_DOM_ID).length) {
        console.error(DEBUG_PREFIX, "ERROR: expression sprite does not exist, cannot extract expression from ", SPRITE_DOM_ID)
        return FALLBACK_EXPRESSION;
    }

    const spriteFile = $("#expression-image").attr("src");
    newExpression = spriteFile.substring(spriteFile.lastIndexOf("/") + 1).replace(/\.[^/.]+$/, "");
    //

    // No sprite to detect expression
    if (newExpression == "") {
        //console.info(DEBUG_PREFIX,"Warning: no expression extracted from sprite, switch to",FALLBACK_EXPRESSION);
        newExpression = FALLBACK_EXPRESSION;
    }

    if (!DEFAULT_EXPRESSIONS.includes(newExpression)) {
        console.info(DEBUG_PREFIX, "Warning:", newExpression, " is not a handled expression, expected one of", FALLBACK_EXPRESSION);
        return FALLBACK_EXPRESSION;
    }

    return newExpression;
}

async function updateBGM() {
    let audio_files = characterMusics[currentCharacterBGM][currentExpressionBGM];// Try char expression BGM

    if (audio_files === undefined || audio_files.length == 0) {
        console.debug(DEBUG_PREFIX, "No BGM for", currentCharacterBGM, currentExpressionBGM);
        audio_files = characterMusics[currentCharacterBGM][FALLBACK_EXPRESSION]; // Try char FALLBACK BGM
        if (audio_files === undefined || audio_files.length == 0) {
            console.debug(DEBUG_PREFIX, "No default BGM for", currentCharacterBGM, FALLBACK_EXPRESSION, "switch to ST BGM");
            audio_files = fallback_BGMS; // ST FALLBACK BGM

            if (audio_files.length == 0) {
                console.debug(DEBUG_PREFIX, "No default BGM file found, bgm folder may be empty.");
                return;
            }
        }
    }

    const audio_file_path = audio_files[Math.floor(Math.random() * audio_files.length)];
    console.log(DEBUG_PREFIX, "Updating BGM");
    console.log(DEBUG_PREFIX, "Checking file", audio_file_path);
    try {
        const response = await fetch(audio_file_path);

        if (!response.ok) {
            console.log(DEBUG_PREFIX, "File not found!")
        }
        else {
            console.log(DEBUG_PREFIX, "Switching BGM to", currentExpressionBGM)
            const audio = $("#audio_bgm");

            if (audio.attr("src") == audio_file_path) {
                console.log(DEBUG_PREFIX, "Already playing, ignored");
                return;
            }

            audio.animate({ volume: 0.0 }, 2000, function () {
                audio.attr("src", audio_file_path);
                audio[0].play();
                audio.volume = extension_settings.audio.bgm_volume * 0.01;
                audio.animate({ volume: extension_settings.audio.bgm_volume * 0.01 }, 2000);
            })
        }

    } catch (error) {
        console.log(DEBUG_PREFIX, "Error while trying to fetch", audio_file_path, ":", error);
    }
}

async function updateAmbient() {
    let audio_file_path = null;
    for (const i of ambients) {
        console.debug(i)
        if (i.includes(currentBackground)) {
            audio_file_path = i;
            break;
        }
    }

    if (audio_file_path === null) {
        console.debug(DEBUG_PREFIX, "No ambient file found for background", currentBackground);
        const audio = $("#audio_ambient");
        audio.attr("src", "");
        audio[0].pause();
        return;
    }

    //const audio_file_path = AMBIENT_FOLDER+currentBackground+".mp3";
    console.log(DEBUG_PREFIX, "Updating ambient");
    console.log(DEBUG_PREFIX, "Checking file", audio_file_path);

    const audio = $("#audio_ambient");
    audio.animate({ volume: 0.0 }, 2000, function () {
        audio.attr("src", audio_file_path);
        audio[0].play();
        audio.volume = extension_settings.audio.ambient_volume * 0.01;
        audio.animate({ volume: extension_settings.audio.ambient_volume * 0.01 }, 2000);
    });
}

//#############################//
//  Extension load             //
//#############################//

// This function is called when the extension is loaded
jQuery(async () => {
    // This is an example of loading HTML from a file
    const windowHtml = $(await $.get(`${extensionFolderPath}/window.html`));

    $('#extensions_settings').append(windowHtml);
    loadSettings();

    $("#audio_bgm").attr("loop", true);
    $("#audio_ambient").attr("loop", true);

    $("#audio_bgm").hide();
    $("#audio_ambient").hide();
    $("#audio_bgm_mute").on("click", onBGMMuteClick);
    $("#audio_ambient_mute").on("click", onAmbientMuteClick);

    $("#audio_enabled").on("click", onEnabledClick);
    $("#audio_bgm_volume_slider").on("input", onBGMVolumeChange);
    $("#audio_ambient_volume_slider").on("input", onAmbientVolumeChange);

    $("#audio_bgm_cooldown").on("input", onBGMCooldownInput);

    // Reset assets container, will be redected like if ST restarted
    $("#audio_refresh_assets").on("click", function(){
        console.debug(DEBUG_PREFIX,"Refreshing audio assets");
        fallback_BGMS = null;
        ambients = null;
        characterMusics = {};
        currentCharacterBGM = null;
        currentExpressionBGM = null;
        currentBackground = null;
    })

    // DBG
    $("#audio_debug").on("click", function () {
        if ($("#audio_debug").is(':checked')) {
            $("#audio_bgm").show();
            $("#audio_ambient").show();
        }
        else {
            $("#audio_bgm").hide();
            $("#audio_ambient").hide();
        }
    });
    //

    const wrapper = new ModuleWorkerWrapper(moduleWorker);
    setInterval(wrapper.update.bind(wrapper), UPDATE_INTERVAL);
    moduleWorker();
});
