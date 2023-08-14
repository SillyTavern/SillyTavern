/*
TODO:
 - Hide voice map its just confusing
 - Delete useless call
*/

import { saveSettingsDebounced } from "../../../script.js"
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

function updateCharactersList() {
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
                    <select id="coqui_model_origin">gpu_mode
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

                        <div id="coqui_api_model_settings">
                            <select id="coqui_api_model_settings_language">
                                <!-- Populated by JS and request -->
                            </select>
                            <select id="coqui_api_model_settings_speaker">
                                <!-- Populated by JS and request -->
                            </select>
                        </div>
                        <span id="coqui_api_model_install_status">Model installed on extras server</span>
                        <input id="coqui_api_model_install_button" class="menu_button" type="button" value="Install" />
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

        this.updateVoiceMap(); // Overide any manual modification

        $("#coqui_api_model_div").hide();
        $("#coqui_api_model_name").hide();
        $("#coqui_api_model_settings").hide();
        $("#coqui_api_model_install_status").hide();
        $("#coqui_api_model_install_button").hide();

        $("#coqui_model_origin").on("change",this.onModelOriginChange);
        $("#coqui_api_language").on("change",this.onModelLanguageChange);
        $("#coqui_api_model_name").on("change",this.onModelNameChange);

        // Load characters list
        $('#coqui_character_select')
            .find('option')
            .remove()
            .end()
            .append('<option value="none">Select Character</option>')
            .val('none')
            
        for(const charName of charactersList) {
            $("#coqui_character_select").append(new Option(charName,charName));
        }

        // Load coqui-api settings from json file
        fetch("/scripts/extensions/tts/coqui_api_models_settings.json")
        .then(response => response.json())
        .then(json => {
            coquiApiModels = json;
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
        });
    }

    updateVoiceMap(){
        this.settings.voiceMap = "";
        for(let i in this.settings.voiceMapDict) {
            const voice_settings = this.settings.voiceMapDict[i];
            this.settings.voiceMap += i + ":" + voice_settings["model_id"];

            if (voice_settings["model_language"] != null)
                this.settings.voiceMap += "[" + voice_settings["model_language"] + "]";

            if (voice_settings["model_speaker"] != null)
                this.settings.voiceMap += "[" + voice_settings["model_speaker"] + "]";

            this.settings.voiceMap += ",";
        }
        $("#tts_voice_map").val(this.settings.voiceMap);
        extension_settings.tts.Coqui = this.settings;
    }
    
    onSettingsChange() {
        console.debug(DEBUG_PREFIX,"Settings changes",this.settings);
        extension_settings.tts.Coqui = this.settings;
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
            this.updateVoiceMap(); // Overide any manual modification
            return;
        }

        if (model_origin == "none") {
            toastr.error(`Origin not selected, please select one.`, DEBUG_PREFIX+" voice mapping origin", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
            this.updateVoiceMap(); // Overide any manual modification
            return;
        }

        if (model_origin == "local") {
            throwLocalOrigin();
            this.updateVoiceMap(); // Overide any manual modification
            return;
        }

        if (model_language == "none") {
            toastr.error(`Language not selected, please select one.`, DEBUG_PREFIX+" voice mapping language", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
            this.updateVoiceMap(); // Overide any manual modification
            return;
        }

        if (model_name == "none") {
            toastr.error(`Model not selected, please select one.`, DEBUG_PREFIX+" voice mapping model", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
            this.updateVoiceMap(); // Overide any manual modification
            return;
        }

        if (model_setting_language == "none")
            model_setting_language = null;
        
        if (model_setting_speaker == "none")
            model_setting_speaker = null;
        
        const tokens = $('#coqui_api_model_name').val().split("/");
        const model_dataset = tokens[0];
        const model_label = tokens[1];
        const model_id = "tts_models/" + model_language + "/" + model_dataset + "/" + model_label

        if (model_setting_language == null & "languages" in coquiApiModels[model_language][model_dataset][model_label]) {
            toastr.error(`Model language not selected, please select one.`, DEBUG_PREFIX+" voice mapping model language", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
            return;
        }

        if (model_setting_speaker == null & "speakers" in coquiApiModels[model_language][model_dataset][model_label]) {
            toastr.error(`Model speaker not selected, please select one.`, DEBUG_PREFIX+" voice mapping model speaker", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
            return;
        }

        console.debug(DEBUG_PREFIX,"Current voice map: ",this.settings.voiceMap);

        this.settings.voiceMapDict[character] = {model_id: model_id, model_language:model_setting_language, model_speaker:model_setting_speaker};

        console.debug(DEBUG_PREFIX,"Registered new voice map: ",character,":",this.settings.voiceMapDict[character]);

        this.updateVoiceMap();

        let successMsg = character+":"+model_id;
        if (model_setting_language != null)
            successMsg += "[" + model_setting_language + "]";
        if (model_setting_speaker != null)
            successMsg += "[" + model_setting_speaker + "]";
        toastr.info(successMsg, DEBUG_PREFIX+" voice map updated", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
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
                const model_id = model_dataset + "/" + model_name
                const model_label = model_name + " ("+model_dataset+" dataset)"
                $("#coqui_api_model_name").append(new Option(model_label,model_id));
        }
    }

    async onModelNameChange() {
        throwIfModuleMissing();
        resetModelSettings();
        $("#coqui_api_model_settings").hide();

        // No model selected
        if ($('#coqui_api_model_name').val() == "none") {
            $("#coqui_api_model_install_button").off('click');
            $("#coqui_api_model_install_button").hide();
            return;
        }

        // Get languages and speakers options
        const model_language = $('#coqui_api_language').val();
        const tokens = $('#coqui_api_model_name').val().split("/");
        const model_dataset = tokens[0];
        const model_name = tokens[1];

        const model_settings = coquiApiModels[model_language][model_dataset][model_name]

        if ("languages" in model_settings) {
            $("#coqui_api_model_settings").show();
            $("#coqui_api_model_settings_language").show();
            $('#coqui_api_model_settings_language')
            .find('option')
            .remove()
            .end()
            .append('<option value="none">Select language</option>')
            .val('none');

            for(var i = 0; i < model_settings["languages"].length; i++) {
                const language_label = JSON.stringify(model_settings["languages"][i]).replaceAll("\"","");
                $("#coqui_api_model_settings_language").append(new Option(language_label,i));
            }
        }
        else {
            $("#coqui_api_model_settings_language").hide();
        }

        if ("speakers" in model_settings) {
            $("#coqui_api_model_settings").show();
            $("#coqui_api_model_settings_speaker").show();
            $('#coqui_api_model_settings_speaker')
            .find('option')
            .remove()
            .end()
            .append('<option value="none">Select speaker</option>')
            .val('none');

            for(var i = 0; i < model_settings["speakers"].length;i++) {
                const speaker_label = JSON.stringify(model_settings["speakers"][i]).replaceAll("\"","");
                $("#coqui_api_model_settings_speaker").append(new Option(speaker_label,i));
            }
        }
        else {
            $("#coqui_api_model_settings_speaker").hide();
        }

        $("#coqui_api_model_install_status").text("Requesting model to extras server...");
        $("#coqui_api_model_install_status").show();

        // Check if already installed and propose to do it otherwise
        const model_id = coquiApiModels[model_language][model_dataset][model_name]["id"]
        console.debug(DEBUG_PREFIX,"Check if model is already installed",model_id);
        let result = await CoquiTtsProvider.checkmodel_state(model_id);
        result = await result.json();
        const model_state = result["model_state"];

        console.debug(DEBUG_PREFIX," Model state:", model_state)

        if (model_state == "installed") {
            $("#coqui_api_model_install_status").text("Model already installed on extras server");
            $("#coqui_api_model_install_button").hide();
        }
        else {
            let action = "download"
            if (model_state == "corrupted") {
                action = "repare"
                //toastr.error("Click install button to reinstall the model "+$("#coqui_api_model_name").find(":selected").text(), DEBUG_PREFIX+" corrupted model install", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
                $("#coqui_api_model_install_status").text("Model found but incomplete try install again (maybe still downloading)"); // (remove and download again)
            }
            else {
                toastr.info("Click download button to install the model "+$("#coqui_api_model_name").find(":selected").text(), DEBUG_PREFIX+" model not installed", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
                $("#coqui_api_model_install_status").text("Model not found on extras server");
            }

            const onModelNameChange_pointer = this.onModelNameChange;

            $("#coqui_api_model_install_button").off("click").on("click", async function (){
                try {
                    $("#coqui_api_model_install_status").text("Downloading model...");
                    $("#coqui_api_model_install_button").hide();
                    //toastr.info("For model "+model_id, DEBUG_PREFIX+" Started "+action, { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
                    let apiResult = await CoquiTtsProvider.installModel(model_id, action);
                    apiResult = await apiResult.json();

                    console.debug(DEBUG_PREFIX,"Response:",apiResult);

                    if (apiResult["status"] == "done") {
                        $("#coqui_api_model_install_status").text("Model installed and ready to use!");
                        $("#coqui_api_model_install_button").hide();
                        onModelNameChange_pointer();
                    }
                    
                    if (apiResult["status"] == "downloading") {
                        toastr.error("Check extras console for progress", DEBUG_PREFIX+" already downloading", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
                        $("#coqui_api_model_install_status").text("Already downloading a model, check extras console!");
                        $("#coqui_api_model_install_button").show();
                    }
                } catch (error) {
                    console.error(error)
                    toastr.error(error, DEBUG_PREFIX+" error with model download", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
                    onModelNameChange_pointer();
                }
                 // will refresh model status
            });
            
            $("#coqui_api_model_install_button").show();
            return;
        }
        
    }
    

    //#############################//
    //  API Calls                  //
    //#############################//

    /*
        Check model installation state, return one of ["installed", "corrupted", "absent"]
    */
    static async checkmodel_state(model_id) {
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
                "model_id": model_id,
            })
        });

        if (!apiResult.ok) {
            toastr.error(apiResult.statusText, DEBUG_PREFIX+' Check model state request failed');
            throw new Error(`HTTP ${apiResult.status}: ${await apiResult.text()}`);
        }

        return apiResult
    }

    static async installModel(model_id, action) {
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
                "model_id": model_id,
                "action": action
            })
        });

        if (!apiResult.ok) {
            toastr.error(apiResult.statusText, DEBUG_PREFIX+' Install model '+model_id+' request failed');
            throw new Error(`HTTP ${apiResult.status}: ${await apiResult.text()}`);
        }

        return apiResult
    }

    // Get speakers


    // Expect voiceId format to be like:
    // tts_models/multilingual/multi-dataset/your_tts[2][1]
    // tts_models/en/ljspeech/glow-tts
    // ts_models/ja/kokoro/tacotron2-DDC
    async generateTts(text, voiceId) {
        throwIfModuleMissing()
        const url = new URL(getApiUrl());
        url.pathname = '/api/text-to-speech/coqui/generate-tts';

        let language = "none"
        let speaker = "none"
        const tokens = voiceId.replaceAll("]","").replaceAll("\"","").split("[");
        const model_id = tokens[0]

        console.debug(DEBUG_PREFIX,"Preparing TTS request for",tokens)

        // First option
        if (tokens.length > 1) {
            const option1 = tokens[1]

            if (model_id.includes("multilingual"))
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
                "model_id": model_id,
                "language_id": parseInt(language),
                "speaker_id": parseInt(speaker)
            })
        });

        if (!apiResult.ok) {
            toastr.error(apiResult.statusText, 'TTS Generation Failed');
            throw new Error(`HTTP ${apiResult.status}: ${await apiResult.text()}`);
        }

        return apiResult
    }

    // Dirty hack to say not implemented
    async fetchTtsVoiceIds() {
        return [{name:"Voice samples not implemented for coqui TTS yet, search for the model samples online", voice_id:"",lang:"",}]
    }

    // Do nothing
    previewTtsVoice(id) {
        return 
    }

    async fetchTtsFromHistory(history_item_id) {
        return Promise.resolve(history_item_id);
    }
}

//#############################//
//  Module Worker              //
//#############################//

async function moduleWorker() {
    updateCharactersList();
}

$(document).ready(function () {
    const wrapper = new ModuleWorkerWrapper(moduleWorker);
    setInterval(wrapper.update.bind(wrapper), UPDATE_INTERVAL);
    moduleWorker();
})