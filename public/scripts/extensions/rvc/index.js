/*
TODO:
 - Allow to upload RVC model to extras server ?
 - Settings per characters ?
*/

import { saveSettingsDebounced } from "../../../script.js";
import { getContext, getApiUrl, extension_settings, doExtrasFetch } from "../../extensions.js";
export { MODULE_NAME,  rvcVoiceConversion};

const MODULE_NAME = 'RVC';
const DEBUG_PREFIX = "<RVC module> "

// Send an audio file to RVC to convert voice
async function rvcVoiceConversion(response, character) {
    let apiResult

    // Check voice map
    if (extension_settings.rvc.voiceMap[character] === undefined) {
        toastr.error("No model is assigned to character '"+character+"', check RVC voice map in the extension menu.", DEBUG_PREFIX+'RVC Voice map error', { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
        console.error("No RVC model assign in voice map for current character "+character);
        return response;
    }

    // Load model if different from currently loaded
    //if (currentModel === null | currentModel != extension_settings.rvc.voiceMap[character])
    //    await rvcLoadModel(extension_settings.rvc.voiceMap[character]);

    const audioData = await response.blob()
    if (!audioData.type in ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/webm']) {
        throw `TTS received HTTP response with invalid data format. Expecting audio/mpeg, got ${audioData.type}`
    }
    console.log("Audio type received:",audioData.type)

    console.log("Sending tts audio data to RVC on extras server")

    var requestData = new FormData();
    requestData.append('AudioFile', audioData, 'record');
    requestData.append("json", JSON.stringify({
        "modelName": extension_settings.rvc.voiceMap[character],
        "pitchOffset": extension_settings.rvc.pitchOffset,
        "pitchExtraction": extension_settings.rvc.pitchExtraction,
        "indexRate": extension_settings.rvc.indexRate,
        "filterRadius": extension_settings.rvc.filterRadius,
        //"rmsMixRate": extension_settings.rvc.rmsMixRate,
        "protect": extension_settings.rvc.protect
    }));
    
    const url = new URL(getApiUrl());
    url.pathname = '/api/voice-conversion/rvc/process-audio';

    apiResult = await doExtrasFetch(url, {
        method: 'POST',
        body: requestData,
    });

    if (!apiResult.ok) {
        toastr.error(apiResult.statusText, DEBUG_PREFIX+' RVC Voice Conversion Failed', { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
        throw new Error(`HTTP ${apiResult.status}: ${await apiResult.text()}`);
    }

    return apiResult;
}

//#############################//
//  Extension UI and Settings  //
//#############################//

const defaultSettings = {
    enabled: false,
    model:"",
    pitchOffset:0,
    pitchExtraction:"dio",
    indexRate:0.88,
    filterRadius:3,
    //rmsMixRate:1,
    protect:0.33,
    voicMapText: "",
    voiceMap: {}
}

function loadSettings() {
    if (Object.keys(extension_settings.rvc).length === 0) {
        Object.assign(extension_settings.rvc, defaultSettings)
    }
    $('#rvc_enabled').prop('checked',extension_settings.rvc.enabled);
    $('#rvc_model').val(extension_settings.rvc.model);

    $('#rvc_pitch_offset').val(extension_settings.rvc.pitchOffset);
    $('#rvc_pitch_offset_value').text(extension_settings.rvc.pitchOffset);

    $('#rvc_pitch_extraction').val(extension_settings.rvc.pitchExtraction);
    $('#rvc_pitch_extractiont_value').text(extension_settings.rvc.pitchExtraction);

    $('#rvc_index_rate').val(extension_settings.rvc.indexRate);
    $('#rvc_index_rate_value').text(extension_settings.rvc.indexRate);

    $('#rvc_filter_radius').val(extension_settings.rvc.filterRadius);
    $("#rvc_filter_radius_value").text(extension_settings.rvc.filterRadius);

    //$('#rvc_mix_rate').val(extension_settings.rvc.rmsMixRate);
    $('#rvc_protect').val(extension_settings.rvc.protect);
    $("#rvc_protect_value").text(extension_settings.rvc.protect);

    $('#rvc_voice_map').val(extension_settings.rvc.voiceMapText);
}

async function onApplyClick() {
    let error = false;
    let array = $('#rvc_voice_map').val().split(",");
    array = array.map(element => {return element.trim();});
    array = array.filter((str) => str !== '');
    extension_settings.rvc.voiceMap = {};
    for (const text of array) {
        if (text.includes(":")) {
            const pair = text.split(":")
            extension_settings.rvc.voiceMap[pair[0].trim()] = pair[1].trim()
            console.debug(DEBUG_PREFIX+"Added mapping", pair[0],"=>", extension_settings.rvc.voiceMap[pair[0]]);
        }
        else {
            $("#rvc_status").text("Voice map is invalid, check console for errors");
            $("#rvc_status").css("color", "red");
            console.error(DEBUG_PREFIX,"Wrong syntax for message mapping, no ':' found in:", text);
            toastr.error("no ':' found in: '"+text+"'", DEBUG_PREFIX+' RVC Voice map error', { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
            error = true;
        }
    }
    
    if (!error) {
        $("#rvc_status").text("Successfully applied settings");
        $("#rvc_status").css("color", "green");
        console.debug(DEBUG_PREFIX+"Updated message mapping", extension_settings.rvc.voiceMap);
        toastr.info("New map:\n"+JSON.stringify(extension_settings.rvc.voiceMap).substring(0,200)+"...", DEBUG_PREFIX+"Updated message mapping", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
        extension_settings.rvc.voiceMapText = $('#rvc_voice_map').val();
        saveSettingsDebounced();
    }
}

async function onEnabledClick() {
    extension_settings.rvc.enabled = $('#rvc_enabled').is(':checked');
    saveSettingsDebounced()
}

async function onPitchExtractionChange() {
    extension_settings.rvc.pitchExtraction = $('#rvc_pitch_extraction').val();
    saveSettingsDebounced()
}

async function onIndexRateChange() {
    extension_settings.rvc.indexRate = Number($('#rvc_index_rate').val());
    $("#rvc_index_rate_value").text(extension_settings.rvc.indexRate)
    saveSettingsDebounced()
}

async function onFilterRadiusChange() {
    extension_settings.rvc.filterRadius = Number($('#rvc_filter_radius').val());
    $("#rvc_filter_radius_value").text(extension_settings.rvc.filterRadius)
    saveSettingsDebounced()
}

async function onPitchOffsetChange() {
    extension_settings.rvc.pitchOffset = Number($('#rvc_pitch_offset').val());
    $("#rvc_pitch_offset_value").text(extension_settings.rvc.pitchOffset)
    saveSettingsDebounced()
}

async function onProtectChange() {
    extension_settings.rvc.protect = Number($('#rvc_protect').val());
    $("#rvc_protect_value").text(extension_settings.rvc.protect)
    saveSettingsDebounced()
}

$(document).ready(function () {
    function addExtensionControls() {
        const settingsHtml = `
        <div id="rvc_settings">
            <div class="inline-drawer">
                <div class="inline-drawer-toggle inline-drawer-header">
                    <b>RVC</b>
                    <div class="inline-drawer-icon fa-solid fa-circle-chevron-down down"></div>
                </div>
                <div class="inline-drawer-content">
                    <div>
                        <label class="checkbox_label" for="rvc_enabled">
                            <input type="checkbox" id="rvc_enabled" name="rvc_enabled">
                            <small>Enabled</small>
                        </label>
                    </div>
                    <div>
                        <span>Select Pitch Extraction</span> </br>
                        <select id="rvc_pitch_extraction">
                            <option value="dio">dio</option>
                            <option value="pm">pm</option>
                            <option value="harvest">harvest</option>
                            <option value="torchcrepe">torchcrepe</option>
                            <option value="rmvpe">rmvpe</option>
                        </select>
                    </div>
                    <div>
                        <label for="rvc_index_rate">
                            Index rate for feature retrieval (<span id="rvc_index_rate_value"></span>)
                        </label>
                        <input id="rvc_index_rate" type="range" min="0" max="1" step="0.01" value="0.5" />

                        <label for="rvc_filter_radius">Filter radius (<span id="rvc_filter_radius_value"></span>)</label>
                        <input id="rvc_filter_radius" type="range" min="0" max="7" step="1" value="3" />

                        <label for="rvc_pitch_offset">Pitch offset (<span id="rvc_pitch_offset_value"></span>)</label>
                        <input id="rvc_pitch_offset" type="range" min="-100" max="100" step="1" value="0" />

                        <label for="rvc_protect">Protect amount (<span id="rvc_protect_value"></span>)</label>
                        <input id="rvc_protect" type="range" min="0" max="1" step="0.01" value="0.33" />
                        <label>Voice Map</label>
                        <textarea id="rvc_voice_map" type="text" class="text_pole textarea_compact" rows="4"
                            placeholder="Enter comma separated map of charName:rvcModel. Example: \nAqua:Bella,\nYou:Josh,"></textarea>
                        <div id="rvc_status">
                        </div>
                        <div class="rvc_buttons">
                            <input id="rvc_apply" class="menu_button" type="submit" value="Apply" />
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `;
        $('#extensions_settings').append(settingsHtml);
        $("#rvc_enabled").on("click", onEnabledClick);
        $('#rvc_pitch_extraction').on('change', onPitchExtractionChange);
        $('#rvc_index_rate').on('input', onIndexRateChange);
        $('#rvc_filter_radius').on('input', onFilterRadiusChange);
        $('#rvc_pitch_offset').on('input', onPitchOffsetChange);
        $('#rvc_protect').on('input', onProtectChange);
        $("#rvc_apply").on("click", onApplyClick);
        
    }
    addExtensionControls(); // No init dependencies
    loadSettings(); // Depends on Extension Controls
})
