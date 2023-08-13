/*
TODO:
 - load/download models
 - load assign voice ids
 - handle apply/available voices button
*/

import { eventSource, event_types } from "../../../script.js"
import { doExtrasFetch, extension_settings, getApiUrl, getContext, modules, ModuleWorkerWrapper } from "../../extensions.js"

export { CoquiTtsProvider }

const DEBUG_PREFIX = "<Coqui TTS module> "
const UPDATE_INTERVAL = 1000

let inApiCall = false
let charactersList = [] // Updated with module worker
let coquiApiModels = {} // Initialized only once
/*
coquiApiModels format [language][dataset][name]:coqui-api-model-id, example:
{
    "en": {
        "vctk": {
            "vits": "tts_models/en/vctk/vits"
        }
    },
    "ja": {
        "kokoro": {
            "tacotron2-DDC": "tts_models/ja/kokoro/tacotron2-DDC"
        }
    }
}
*/
const languageLabels = {
    "multilingual": "Multilingual",
    "en" : "English",
    "fr" : "French",
    "es" : "Spanish",
    "ja" : "Japanese"
}

function throwIfModuleMissing() {
    if (!modules.includes('coqui-tts')) {
        toastr.error(`Add coqui-tts to enable-modules and restart the Extras API.`, "Coqui TTS module not loaded.", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
        throw new Error(DEBUG_PREFIX,`Coqui TTS module not loaded.`);
    }
}

function throwLocalOrigin() {
    toastr.info("coming soon, ready when ready, etc", DEBUG_PREFIX+' Custom models not supported yet', { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
    throw new Error(DEBUG_PREFIX,`requesting feature not implemented yet.`);
}

function resetModelSettings() {
    $("#coqui_api_model_settings_language").val("none");
    $("#coqui_api_model_settings_speaker").val("none");
}

class CoquiTtsProvider {
    //#############################//
    //  Extension UI and Settings  //
    //#############################//

    settings

    defaultSettings = {
        voiceMap: "",
        voiceMapDict : {}
    }

    get settingsHtml() {
        let html = `
        <div class="flex wide100p flexGap10 alignitemscenter">
            <div>
                <div style="flex: 50%;">
                    <label for="coqui_character_select">Character:</label>
                    <select id="coqui_character_select">
                        <!-- Populated by JS -->
                    </select>
                    <label for="coqui_model_origin">Models:</label>
                    <select id="coqui_model_origin">
                        <option value="none">Select Origin</option>
                        <option value="coqui-api">Coqui TTS</option>
                        <option value="local">My models</option>
                    </select>

                    <div id="coqui_api_model_div">
                        <select id="coqui_api_language">
                            <!-- Populated by JS and request -->
                        </select>

                        <select id="coqui_api_model_name">
                            <!-- Populated by JS and request -->
                        </select>

                        <input id="coqui_api_model_install_button" class="menu_button" type="submit" value="Install" />
                        
                        <span id="coqui_api_model_loading">Loading...</span>

                        <div id="coqui_api_model_settings">
                            <select id="coqui_api_model_settings_language">
                                <!-- Populated by JS and request -->
                            </select>
                            <select id="coqui_api_model_settings_speaker">
                                <!-- Populated by JS and request -->
                            </select>
                        </div>
                    </div>
                </div>
            </div>
        </div>
        `
        return html
    }

    loadSettings(settings) {
        // Only accept keys defined in defaultSettings
        this.settings = this.defaultSettings

        for (const key in settings){
            if (key in this.settings){
                this.settings[key] = settings[key]
            } else {
                throw DEBUG_PREFIX+`Invalid setting passed to extension: ${key}`
            }
        }

        $("#coqui_api_model_div").hide();
        $("#coqui_api_model_name").hide();
        $("#coqui_api_model_settings").hide();
        $("#coqui_api_model_loading").hide();
        $("#coqui_api_model_install_button").hide();
        $("#coqui_model_origin").on("change",this.onModelOriginChange);
        $("#coqui_api_language").on("change",this.onModelLanguageChange);
        $("#coqui_api_model_name").on("change",this.onModelNameChange);
    }
    
    onSettingsChange() {
    }

    async onApplyClick() {
        if (inApiCall) {
            return; // TOdo block dropdown
        }

        const character = $("#coqui_character_select").val();
        const model_origin = $("#coqui_model_origin").val();
        const model_language = $("#coqui_api_language").val();
        const model_name = $("#coqui_api_model_name").val();
        let model_setting_language = $("#coqui_api_model_settings_language").val();
        let model_setting_speaker = $("#coqui_api_model_settings_speaker").val();

        
        if (character === "none") {
            toastr.error(`Character not selected, please select one.`, DEBUG_PREFIX+" voice mapping character", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
            return;
        }

        if (model_origin == "none") {
            toastr.error(`Origin not selected, please select one.`, DEBUG_PREFIX+" voice mapping origin", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
            return;
        }

        if (model_origin == "local") {
            throwLocalOrigin();
            return;
        }

        if (model_language == "none") {
            toastr.error(`Language not selected, please select one.`, DEBUG_PREFIX+" voice mapping language", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
            return;
        }

        if (model_name == "none") {
            toastr.error(`Model not selected, please select one.`, DEBUG_PREFIX+" voice mapping model", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
            return;
        }

        if (model_setting_language == "none")
            model_setting_language = null;
        
        if (model_setting_speaker == "none")
            model_setting_speaker = null;

        console.debug(DEBUG_PREFIX,"Current voice map: ",this.settings.voiceMap);

        this.settings.voiceMapDict[character] = {model_id: model_name, model_language:model_setting_language, model_speaker:model_setting_speaker};
        
        console.debug(DEBUG_PREFIX,"Registered new voice map: ",character,":",this.settings.voiceMapDict[character]);

        this.settings.voiceMap = "";
        for(let i in this.settings.voiceMapDict) {
            const voice_settings = this.settings.voiceMapDict[i];
            this.settings.voiceMap += i + ":" + voice_settings["model_id"];

            if (model_setting_language != null)
                this.settings.voiceMap += "[" + voice_settings["model_language"] + "]";

            if (model_setting_speaker != null)
                this.settings.voiceMap += "[" + voice_settings["model_speaker"] + "]";

            this.settings.voiceMap += ",";
        }
        $("#tts_voice_map").val(this.settings.voiceMap);

        return
    }

    // DBG: assume voiceName is correct
    // TODO: check voice is correct
    async getVoice(voiceName) {
        console.log(DEBUG_PREFIX,"getVoice",voiceName);
        const output = {voice_id: voiceName};
        return output;
    }

    async onModelOriginChange() {
        throwIfModuleMissing()
        resetModelSettings();
        const model_origin = $('#coqui_model_origin').val();
        console.debug(model_origin);
        
        // TODO: show coqui model list
        if (model_origin == "coqui-api") {
            $("#coqui_api_model_div").show();
        }
        else
            $("#coqui_api_model_div").hide();

        // TODO show local model list
        if (model_origin == "local") {
            throwLocalOrigin();
        }
    }

    async onModelLanguageChange() {
        throwIfModuleMissing();
        resetModelSettings();
        $("#coqui_api_model_settings").hide();
        const model_origin = $('#coqui_model_origin').val();
        const model_language = $('#coqui_api_language').val();
        console.debug(model_language);
        
        if (model_language == "none") {
            $("#coqui_api_model_name").hide();
            return;
        }
        
        $("#coqui_api_model_name").show();
        $('#coqui_api_model_name')
            .find('option')
            .remove()
            .end()
            .append('<option value="none">Select model</option>')
            .val('none');

        for(let model_dataset in coquiApiModels[model_language])
            for(let model_name in coquiApiModels[model_language][model_dataset]) {
                const model_id = coquiApiModels[model_language][model_dataset][model_name]
                const model_label = model_name + " ("+model_dataset+" dataset)"
                $("#coqui_api_model_name").append(new Option(model_label,model_id));
        }
        
        // TODO: populate with corresponding dataset/model pairs got from initialization request

    }

    async onModelNameChange() {
        throwIfModuleMissing();
        resetModelSettings();
        $("#coqui_api_model_settings").hide();

        const modelId = $("#coqui_api_model_name").val();

        if (modelId == "none") {
            $("#coqui_api_model_install_button").off('click');
            $("#coqui_api_model_install_button").show();
            return;
        }

        $("#coqui_api_model_loading").show();
        
        // Check if already download and propose to do it
        console.debug(DEBUG_PREFIX,"Check if model is already installed",modelId);
        let result = await CoquiTtsProvider.checkModelState(modelId);
        result = await result.json();
        const modelState = result["model_state"];

        console.debug(DEBUG_PREFIX," Model state:", modelState)

        if (modelState != "installed") {
            $("#coqui_api_model_install_button").show();
            $("#coqui_api_model_install_button").on("click", function (){
                CoquiTtsProvider.installModel(modelId);
            });

            if (modelState == "corrupted") {
                toastr.error("Click repare button to reinstall the model "+$("#coqui_api_model_name").find(":selected").text(), DEBUG_PREFIX+" corrupted model install", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
                $("#coqui_api_model_install_button").val("Repare");
            }
            else {
                toastr.info("Click download button to install the model "+$("#coqui_api_model_name").find(":selected").text(), DEBUG_PREFIX+" model not installed", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
                $("#coqui_api_model_install_button").val("Download");
            }
            return;
        }

        console.debug(DEBUG_PREFIX,"Request model settings for",modelId);

        result = await CoquiTtsProvider.getModelSettings(modelId);
        const modelSettings = await result.json();
        $("#coqui_api_model_loading").hide();

        console.debug(DEBUG_PREFIX,modelSettings)


        if (modelSettings["languages"].length > 0) {
            $("#coqui_api_model_settings").show();
            $("#coqui_api_model_settings_language").show();
            $('#coqui_api_model_settings_language')
            .find('option')
            .remove()
            .end()
            .append('<option value="none">Select language</option>')
            .val('none');

            for(const language of modelSettings["languages"]) {
                $("#coqui_api_model_settings_language").append(new Option(language,language));
            }
        }
        else {
            $("#coqui_api_model_settings_language").hide();
        }

        if (modelSettings["speakers"].length > 0) {
            $("#coqui_api_model_settings").show();
            $("#coqui_api_model_settings_speaker").show();
            $('#coqui_api_model_settings_speaker')
            .find('option')
            .remove()
            .end()
            .append('<option value="none">Select speaker</option>')
            .val('none');

            for(const speaker of modelSettings["speakers"]) {
                $("#coqui_api_model_settings_speaker").append(new Option(speaker,speaker));
            }
        }
        else {
            $("#coqui_api_model_settings_speaker").hide();
        }

    }
    

    //#############################//
    //  API Calls                  //
    //#############################//

    static async getModelList(origin) {
        throwIfModuleMissing()
        const url = new URL(getApiUrl());

        if (origin == "coqui-api")
            url.pathname = '/api/text-to-speech/coqui/coqui-api/get-models';
        else
            url.pathname = '/api/text-to-speech/coqui/local/get-models';

        const apiResult = await doExtrasFetch(url, {method: 'POST'})

        if (!apiResult.ok) {
            toastr.error(apiResult.statusText, DEBUG_PREFIX+' Get models list request failed');
            throw new Error(`HTTP ${apiResult.status}: ${await apiResult.text()}`);
        }

        return apiResult
    }

    /*
        Check model installation state, return one of ["installed", "corrupted", "absent"]
    */
    static async checkModelState(modelId) {
        throwIfModuleMissing()
        const url = new URL(getApiUrl());
        url.pathname = '/api/text-to-speech/coqui/coqui-api/check-model-state';

        const apiResult = await doExtrasFetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                "model_id": modelId,
            })
        });

        if (!apiResult.ok) {
            toastr.error(apiResult.statusText, DEBUG_PREFIX+' Check model state request failed');
            throw new Error(`HTTP ${apiResult.status}: ${await apiResult.text()}`);
        }

        return apiResult
    }

    static async installModel(modelId) {
        throwIfModuleMissing()
        const url = new URL(getApiUrl());
        url.pathname = '/api/text-to-speech/coqui/coqui-api/install-model';

        const apiResult = await doExtrasFetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                "model_id": modelId,
            })
        });

        if (!apiResult.ok) {
            toastr.error(apiResult.statusText, DEBUG_PREFIX+' Install model '+modelId+' request failed');
            throw new Error(`HTTP ${apiResult.status}: ${await apiResult.text()}`);
        }

        return apiResult
    }

    static async getModelSettings(modelId) {
        throwIfModuleMissing()
        // API is busy
        inApiCall = true;

        try {
            const url = new URL(getApiUrl());
            url.pathname = '/api/text-to-speech/coqui/coqui-api/get-model-settings';

            const apiResult = await doExtrasFetch(url, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache'
                },
                body: JSON.stringify({
                    "model_id": modelId,
                })
            });

            if (!apiResult.ok) {
                toastr.error(apiResult.statusText, DEBUG_PREFIX+' Get model setting request failed for '+modelId);
                throw new Error(`HTTP ${apiResult.status}: ${await apiResult.text()}`);
            }

            return apiResult
        }
        catch (error) {
            console.debug(error);
        }
        finally {
            inApiCall = false;
        }
    }

    // Get speakers


    // Expect voiceId format to be like:
    // tts_models/multilingual/multi-dataset/your_tts[2][1]
    // tts_models/en/ljspeech/glow-tts
    // ts_models/ja/kokoro/tacotron2-DDC
    async generateTts(text, voiceId) {
        throwIfModuleMissing()
        const url = new URL(getApiUrl());
        url.pathname = '/api/text-to-speech/coqui/process-text';

        let language = "none"
        let speaker = "none"
        const tokens = voiceId.replaceAll("]","").split("[");
        const modelId = tokens[0]

        console.debug(DEBUG_PREFIX,"Preparing TTS request for",tokens)

        // First option
        if (tokens.length > 1) {
            const option1 = tokens[1]

            if (modelId.includes("multilingual"))
                language = option1
            else
                speaker = option1
        }

        // Second option
        if (tokens.length > 2)
            speaker = tokens[2];

        const apiResult = await doExtrasFetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                "text": text,
                "model_id": modelId,
                "language": language,
                "speaker": speaker
            })
        });

        if (!apiResult.ok) {
            toastr.error(apiResult.statusText, 'TTS Generation Failed');
            throw new Error(`HTTP ${apiResult.status}: ${await apiResult.text()}`);
        }

        return apiResult
    }

    //------------------------------------------------------------------------------------

    async fetchTtsFromHistory(history_item_id) {
        return Promise.resolve(history_item_id);
    }
}

//#############################//
//  Module Worker              //
//#############################//

async function moduleWorker() {
    // Skip if module not loaded
    if (!modules.includes('coqui-tts'))
        return;
    
    // 1) Update characters list
    //----------------------------
    let currentcharacters = new Set();
    for (const i of getContext().characters) {
        currentcharacters.add(i.name);
    }

    currentcharacters = Array.from(currentcharacters)
    
    if (JSON.stringify(charactersList) !== JSON.stringify(currentcharacters)) {
        charactersList = currentcharacters

        $('#coqui_character_select')
            .find('option')
            .remove()
            .end()
            .append('<option value="none">Select Character</option>')
            .val('none')
            
        for(const charName of charactersList) {
            $("#coqui_character_select").append(new Option(charName,charName));
        }

        console.debug(DEBUG_PREFIX,"Updated character list to:", charactersList);
    }

    // 2) Initialize TTS models lists
    //---------------------------------
    if (Object.keys(coquiApiModels).length === 0) {
        const result = await CoquiTtsProvider.getModelList("coqui-api");
        coquiApiModels = await result.json();
        console.debug(DEBUG_PREFIX,"initialized coqui-api model list to", coquiApiModels);

        $('#coqui_api_language')
            .find('option')
            .remove()
            .end()
            .append('<option value="none">Select model language</option>')
            .val('none');

        for(let language in coquiApiModels) {
            $("#coqui_api_language").append(new Option(languageLabels[language],language));
            console.log(DEBUG_PREFIX,"added language",language);
        }
    }
}

$(document).ready(function () {
    const wrapper = new ModuleWorkerWrapper(moduleWorker);
    setInterval(wrapper.update.bind(wrapper), UPDATE_INTERVAL);
    moduleWorker();
})