/*
TODO:
 - load RVC models list from extras
 - Settings per characters
*/

import { saveSettingsDebounced } from "../../../script.js";
import { getContext, getApiUrl, extension_settings, doExtrasFetch, ModuleWorkerWrapper, modules } from "../../extensions.js";
export { MODULE_NAME, rvcVoiceConversion };

const MODULE_NAME = 'RVC';
const DEBUG_PREFIX = "<RVC module> "
const UPDATE_INTERVAL = 1000

let charactersList = [] // Updated with module worker
let rvcModelsList = [] // Initialized only once
let rvcModelsReceived = false;

function updateVoiceMapText() {
    let voiceMapText = ""
    for (let i in extension_settings.rvc.voiceMap) {
        const voice_settings = extension_settings.rvc.voiceMap[i];
        voiceMapText += i + ":"
            + voice_settings["modelName"] + "("
            + voice_settings["pitchExtraction"] + ","
            + voice_settings["pitchOffset"] + ","
            + voice_settings["indexRate"] + ","
            + voice_settings["filterRadius"] + ","
            + voice_settings["rmsMixRate"] + ","
            + voice_settings["protect"]
            + "),\n"
    }

    extension_settings.rvc.voiceMapText = voiceMapText;
    $('#rvc_voice_map').val(voiceMapText);

    console.debug(DEBUG_PREFIX, "Updated voice map debug text to\n", voiceMapText)
}

//#############################//
//  Extension UI and Settings  //
//#############################//

const defaultSettings = {
    enabled: false,
    model: "",
    pitchOffset: 0,
    pitchExtraction: "dio",
    indexRate: 0.88,
    filterRadius: 3,
    rmsMixRate: 1,
    protect: 0.33,
    voicMapText: "",
    voiceMap: {}
}

function loadSettings() {
    if (extension_settings.rvc === undefined)
        extension_settings.rvc = {};

    if (Object.keys(extension_settings.rvc).length === 0) {
        Object.assign(extension_settings.rvc, defaultSettings)
    }
    $('#rvc_enabled').prop('checked', extension_settings.rvc.enabled);
    $('#rvc_model').val(extension_settings.rvc.model);

    $('#rvc_pitch_extraction').val(extension_settings.rvc.pitchExtraction);
    $('#rvc_pitch_extractiont_value').text(extension_settings.rvc.pitchExtraction);

    $('#rvc_index_rate').val(extension_settings.rvc.indexRate);
    $('#rvc_index_rate_value').text(extension_settings.rvc.indexRate);

    $('#rvc_filter_radius').val(extension_settings.rvc.filterRadius);
    $("#rvc_filter_radius_value").text(extension_settings.rvc.filterRadius);

    $('#rvc_pitch_offset').val(extension_settings.rvc.pitchOffset);
    $('#rvc_pitch_offset_value').text(extension_settings.rvc.pitchOffset);

    $('#rvc_rms_mix_rate').val(extension_settings.rvc.rmsMixRate);
    $("#rvc_rms_mix_rate_value").text(extension_settings.rvc.rmsMixRate);

    $('#rvc_protect').val(extension_settings.rvc.protect);
    $("#rvc_protect_value").text(extension_settings.rvc.protect);

    $('#rvc_voice_map').val(extension_settings.rvc.voiceMapText);

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

async function onRmsMixRateChange() {
    extension_settings.rvc.rmsMixRate = Number($('#rvc_rms_mix_rate').val());
    $("#rvc_rms_mix_rate_value").text(extension_settings.rvc.rmsMixRate)
    saveSettingsDebounced()
}

async function onProtectChange() {
    extension_settings.rvc.protect = Number($('#rvc_protect').val());
    $("#rvc_protect_value").text(extension_settings.rvc.protect)
    saveSettingsDebounced()
}

async function onApplyClick() {
    let error = false;
    const character = $("#rvc_character_select").val();
    const model_name = $("#rvc_model_select").val();
    const pitchExtraction = $("#rvc_pitch_extraction").val();
    const indexRate = $("#rvc_index_rate").val();
    const filterRadius = $("#rvc_filter_radius").val();
    const pitchOffset = $("#rvc_pitch_offset").val();
    const rmsMixRate = $("#rvc_rms_mix_rate").val();
    const protect = $("#rvc_protect").val();

    if (character === "none") {
        toastr.error("Character not selected.", DEBUG_PREFIX + " voice mapping apply", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
        return;
    }

    if (model_name == "none") {
        toastr.error("Model not selected.", DEBUG_PREFIX + " voice mapping apply", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
        return;
    }

    extension_settings.rvc.voiceMap[character] = {
        "modelName": model_name,
        "pitchExtraction": pitchExtraction,
        "indexRate": indexRate,
        "filterRadius": filterRadius,
        "pitchOffset": pitchOffset,
        "rmsMixRate": rmsMixRate,
        "protect": protect
    }

    updateVoiceMapText();

    console.debug(DEBUG_PREFIX, "Updated settings of ", character, ":", extension_settings.rvc.voiceMap[character])
    saveSettingsDebounced();
}

async function onDeleteClick() {
    const character = $("#rvc_character_select").val();

    if (character === "none") {
        toastr.error("Character not selected.", DEBUG_PREFIX + " voice mapping delete", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
        return;
    }

    delete extension_settings.rvc.voiceMap[character];
    console.debug(DEBUG_PREFIX, "Deleted settings of ", character);
    updateVoiceMapText();
    saveSettingsDebounced();
}

async function onChangeUploadFiles() {
    const url = new URL(getApiUrl());
    const inputFiles = $("#rvc_model_upload_files").get(0).files;
    let formData = new FormData();

    for (const file of inputFiles)
        formData.append(file.name, file);

    console.debug(DEBUG_PREFIX, "Sending files:", formData);
    url.pathname = '/api/voice-conversion/rvc/upload-models';

    const apiResult = await doExtrasFetch(url, {
        method: 'POST',
        body: formData
    });

    if (!apiResult.ok) {
        toastr.error(apiResult.statusText, DEBUG_PREFIX + ' Check extras console for errors log');
        throw new Error(`HTTP ${apiResult.status}: ${await apiResult.text()}`);
    }

    alert('The files have been uploaded successfully.');
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
                    <h4 class="center">Characters Voice Mapping</h4>
                    <div>
                        <label class="checkbox_label" for="rvc_enabled">
                            <input type="checkbox" id="rvc_enabled" name="rvc_enabled">
                            <small>Enabled</small>
                        </label>
                        <label>Voice Map (debug infos)</label>
                        <textarea id="rvc_voice_map" type="text" class="text_pole textarea_compact" rows="4"
                            placeholder="Voice map will appear here for debug purpose"></textarea>
                    </div>
                    <div>
                        <div class="background_controls">
                            <label for="rvc_character_select">Character:</label>
                            <select id="rvc_character_select">
                                <!-- Populated by JS -->
                            </select>
                            <div id="rvc_delete" class="menu_button">
                                <i class="fa-solid fa-times"></i>
                                Remove
                            </div>
                        </div>
                        <div class="background_controls">
                            <label for="rvc_model_select">Voice:</label>
                            <select id="rvc_model_select">
                                <!-- Populated by JS -->
                            </select>
                            <div id="rvc_model_refresh_button" class="menu_button">
                                <i class="fa-solid fa-refresh"></i>
                                <!-- Refresh -->
                            </div>
                            <div id="rvc_model_upload_select_button" class="menu_button">
                                    <i class="fa-solid fa-upload"></i>
                                    Upload
                                </div>
                                <input
                                    type="file"
                                    id="rvc_model_upload_files"
                                    accept=".zip,.rar,.7zip,.7z" multiple />
                            </div>
                        </div>
                        <div>
                            <small>
                                Upload one archive per model. With .pth and .index (optional) inside.<br/>
                                Supported format: .zip .rar .7zip .7z
                            </small>
                        </div>
                        <div>
                            <h4>Model Settings</h4>
                        </div>
                        <div>
                            <label for="rvc_pitch_extraction">
                                Pitch Extraction
                            </label>
                            <select id="rvc_pitch_extraction">
                                <option value="dio">dio</option>
                                <option value="pm">pm</option>
                                <option value="harvest">harvest</option>
                                <option value="torchcrepe">torchcrepe</option>
                                <option value="rmvpe">rmvpe</option>
                                <option value="">None</option>
                            </select>
                            <small>
                                Tips: dio and pm faster, harvest slower but good.<br/>
                                Torchcrepe and rmvpe are good but uses GPU.
                            </small>
                        </div>
                        <div>
                            <label for="rvc_index_rate">
                                Search feature ratio (<span id="rvc_index_rate_value"></span>)
                            </label>
                            <input id="rvc_index_rate" type="range" min="0" max="1" step="0.01" value="0.5" />
                            <small>
                                Controls accent strength, too high may produce artifact.
                            </small>
                        </div>
                        <div>
                            <label for="rvc_filter_radius">Filter radius (<span id="rvc_filter_radius_value"></span>)</label>
                            <input id="rvc_filter_radius" type="range" min="0" max="7" step="1" value="3" />
                            <small>
                                Higher can reduce breathiness but may increase run time.
                            </small>
                        </div>
                        <div>
                            <label for="rvc_pitch_offset">Pitch offset (<span id="rvc_pitch_offset_value"></span>)</label>
                            <input id="rvc_pitch_offset" type="range" min="-20" max="20" step="1" value="0" />
                            <small>
                                Recommended +12 key for male to female conversion and -12 key for female to male conversion.
                            </small>
                        </div>
                        <div>
                            <label for="rvc_rms_mix_rate">Mix rate (<span id="rvc_rms_mix_rate_value"></span>)</label>
                            <input id="rvc_rms_mix_rate" type="range" min="0" max="1" step="0.01" value="1" />
                            <small>
                            Closer to 0 is closer to TTS and 1 is closer to trained voice.
                            Can help mask noise and sound more natural when set relatively low.
                            </small>
                        </div>
                        <div>
                            <label for="rvc_protect">Protect amount (<span id="rvc_protect_value"></span>)</label>
                            <input id="rvc_protect" type="range" min="0" max="1" step="0.01" value="0.33" />
                            <small>
                                Avoid non voice sounds. Lower is more being ignored.
                            </small>
                        </div>
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
        $("#rvc_voice_map").attr("disabled", "disabled");;
        $('#rvc_pitch_extraction').on('change', onPitchExtractionChange);
        $('#rvc_index_rate').on('input', onIndexRateChange);
        $('#rvc_filter_radius').on('input', onFilterRadiusChange);
        $('#rvc_pitch_offset').on('input', onPitchOffsetChange);
        $('#rvc_rms_mix_rate').on('input', onRmsMixRateChange);
        $('#rvc_protect').on('input', onProtectChange);
        $("#rvc_apply").on("click", onApplyClick);
        $("#rvc_delete").on("click", onDeleteClick);

        $("#rvc_model_upload_files").hide();
        $("#rvc_model_upload_select_button").on("click", function() {$("#rvc_model_upload_files").click()});

        $("#rvc_model_upload_files").on("change", onChangeUploadFiles);
        //$("#rvc_model_upload_button").on("click", onClickUpload);
        $("#rvc_model_refresh_button").on("click", refreshVoiceList);

    }
    addExtensionControls(); // No init dependencies
    loadSettings(); // Depends on Extension Controls

    const wrapper = new ModuleWorkerWrapper(moduleWorker);
    setInterval(wrapper.update.bind(wrapper), UPDATE_INTERVAL);
    moduleWorker();
})

//#############################//
//  API Calls                  //
//#############################//

/*
    Check model installation state, return one of ["installed", "corrupted", "absent"]
*/
async function get_models_list(model_id) {
    const url = new URL(getApiUrl());
    url.pathname = '/api/voice-conversion/rvc/get-models-list';

    const apiResult = await doExtrasFetch(url, {
        method: 'POST'
    });

    if (!apiResult.ok) {
        toastr.error(apiResult.statusText, DEBUG_PREFIX + ' Check model state request failed');
        throw new Error(`HTTP ${apiResult.status}: ${await apiResult.text()}`);
    }

    return apiResult
}

/*
    Send an audio file to RVC to convert voice
*/
async function rvcVoiceConversion(response, character, text) {
    let apiResult

    // Check voice map
    if (extension_settings.rvc.voiceMap[character] === undefined) {
        //toastr.error("No model is assigned to character '"+character+"', check RVC voice map in the extension menu.", DEBUG_PREFIX+'RVC Voice map error', { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
        console.info(DEBUG_PREFIX, "No RVC model assign in voice map for current character " + character);
        return response;
    }

    const audioData = await response.blob()
    if (!audioData.type in ['audio/mpeg', 'audio/wav', 'audio/x-wav', 'audio/wave', 'audio/webm']) {
        throw `TTS received HTTP response with invalid data format. Expecting audio/mpeg, got ${audioData.type}`
    }
    console.log("Audio type received:", audioData.type)

    const voice_settings = extension_settings.rvc.voiceMap[character];

    var requestData = new FormData();
    requestData.append('AudioFile', audioData, 'record');
    requestData.append("json", JSON.stringify({
        "modelName": voice_settings["modelName"],
        "pitchExtraction": voice_settings["pitchExtraction"],
        "pitchOffset": voice_settings["pitchOffset"],
        "indexRate": voice_settings["indexRate"],
        "filterRadius": voice_settings["filterRadius"],
        "rmsMixRate": voice_settings["rmsMixRate"],
        "protect": voice_settings["protect"],
        "text": text
    }));

    console.log("Sending tts audio data to RVC on extras server",requestData)

    const url = new URL(getApiUrl());
    url.pathname = '/api/voice-conversion/rvc/process-audio';

    apiResult = await doExtrasFetch(url, {
        method: 'POST',
        body: requestData,
    });

    if (!apiResult.ok) {
        toastr.error(apiResult.statusText, DEBUG_PREFIX + ' RVC Voice Conversion Failed', { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
        throw new Error(`HTTP ${apiResult.status}: ${await apiResult.text()}`);
    }

    return apiResult;
}

//#############################//
//  Module Worker              //
//#############################//

async function refreshVoiceList() {
    let result = await get_models_list();
    result = await result.json();
    rvcModelsList = result["models_list"]

    $('#rvc_model_select')
        .find('option')
        .remove()
        .end()
        .append('<option value="none">Select Voice</option>')
        .val('none')

    for (const modelName of rvcModelsList) {
        $("#rvc_model_select").append(new Option(modelName, modelName));
    }

    rvcModelsReceived = true
    console.debug(DEBUG_PREFIX, "Updated model list to:", rvcModelsList);
}

async function moduleWorker() {
    updateCharactersList();

    if (modules.includes('rvc') && !rvcModelsReceived) {
        refreshVoiceList();
    }
}

function updateCharactersList() {
    let currentcharacters = new Set();
    const context = getContext();
    for (const i of context.characters) {
        currentcharacters.add(i.name);
    }

    currentcharacters = Array.from(currentcharacters);
    currentcharacters.unshift(context.name1);

    if (JSON.stringify(charactersList) !== JSON.stringify(currentcharacters)) {
        charactersList = currentcharacters

        $('#rvc_character_select')
            .find('option')
            .remove()
            .end()
            .append('<option value="none">Select Character</option>')
            .val('none')

        for (const charName of charactersList) {
            $("#rvc_character_select").append(new Option(charName, charName));
        }

        console.debug(DEBUG_PREFIX, "Updated character list to:", charactersList);
    }
}
