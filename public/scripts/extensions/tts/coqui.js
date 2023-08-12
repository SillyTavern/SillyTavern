/*
TODO:
 - load/download models
 - load assign voice ids
 - handle apply/available voices button
*/

import { eventSource, event_types } from "../../../script.js"
import { doExtrasFetch, getApiUrl, modules } from "../../extensions.js"

export { CoquiTtsProvider }

const DEBUG_PREFIX = "<Coqui module> "

function throwIfModuleMissing() {
    if (!modules.includes('coqui-tts')) {
        toastr.error(`Coqui TTS module not loaded. Add coqui-tts to enable-modules and restart the Extras API.`)
        throw new Error(`Coqui TTS module not loaded.`)
    }
}

class CoquiTtsProvider {
    //#############################//
    //  Extension UI and Settings  //
    //#############################//

    settings
    voices = []
    separator = ' .. '

    defaultSettings = {
        voiceMap: {}
    }

    get settingsHtml() {
        let html = `
        <div class="flex wide100p flexGap10 alignitemscenter">
            <div>
                <div style="flex: 50%;">
                    <label for="coqui_character_select">Character:</label>
                    <select id="coqui_character_select">
                        <option value="none">Select Character</option>
                        <!-- Populated by JS -->
                    </select>
                    <label for="coqui_model_origin">Models:</label>
                    <select id="coqui_model_origin">
                        <option value="none">Select Origin</option>
                        <option value="coquiApi">Coqui TTS</option>
                        <option value="local">My models</option>
                    </select>

                    <div id="coqui_api_model_div">
                        <select id="coqui_api_language">
                            <option value="none">Select model language</option>
                            <option value="en">English</option>
                            <option value="fr">French</option>
                            <option value="ja">Japanese</option>
                            <!-- Populated by JS and request -->
                        </select>

                        <select id="coqui_api_model_name">
                            <!-- Populated by JS and request -->
                        </select>
                    </div>
                </div>
            </div>
        </div>
        `
        return html
    }

    loadSettings(settings) {
        $("#coqui_api_model_div").hide();
        $("#coqui_api_model_name").hide();
        $("#coqui_model_origin").on("change",this.onModelOriginChange);
        $("#coqui_api_language").on("change",this.onModelLanguageChange);
        
    }
    
    onSettingsChange() {
    }

    async onApplyClick() {
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
        const model_origin = $('#coqui_model_origin').val();
        console.debug(model_origin);
        
        // TODO: show coqui model list
        if (model_origin == "coquiApi") {
            $("#coqui_api_model_div").show();
        }
        else
            $("#coqui_api_model_div").hide();

        // TODO show local model list
        if (model_origin == "local") {
            toastr.info("coming soon, ready when ready, etc", DEBUG_PREFIX+' Custom models not supported yet');
        }
        
    }

    async onModelLanguageChange() {
        const model_language = $('#coqui_api_language').val();
        console.debug(model_language);
        
        if (model_language == "none") {
            $("#coqui_api_model_name").hide();
            return;
        }
        
        $("#coqui_api_model_name").show();
        
        // TODO: if model list not already load, request it from extras
        const result = await CoquiTtsProvider.getCoquiApiModels();
        const models = await result.json();
        console.debug(models,typeof(models));
        console.debug("models lists:", models[model_language]);

        $('#coqui_api_model_name')
            .find('option')
            .remove()
            .end()
            .append('<option value="none">Select model</option>')
            .val('whatever')

        for(let k in models[model_language]) {
            let model_name = k.split("/")
            model_name = model_name[0] + " ("+model_name[1]+" dataset)"
            $("#coqui_api_model_name").append(new Option(model_name,models[model_language][k]));
        }
        
        // TODO: populate with corresponding dataset/model pairs got from initialization request

    }
    

    //#############################//
    //  API Calls                  //
    //#############################//

    static async getCoquiApiModels() {
        const url = new URL(getApiUrl());
        url.pathname = '/api/text-to-speech/coqui/supported-models';

        const apiResult = await doExtrasFetch(url, {method: 'POST'})

        if (!apiResult.ok) {
            toastr.error(apiResult.statusText, DEBUG_PREFIX+' Get models list failed');
            throw new Error(`HTTP ${apiResult.status}: ${await apiResult.text()}`);
        }

        return apiResult
    }


    // Expect voiceId format to be like:
    // tts_models/multilingual/multi-dataset/your_tts[2][1]
    // tts_models/en/ljspeech/glow-tts
    // ts_models/ja/kokoro/tacotron2-DDC
    async generateTts(text, voiceId) {
        const url = new URL(getApiUrl());
        url.pathname = '/api/text-to-speech/coqui/process-text';

        const apiResult = await doExtrasFetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache'
            },
            body: JSON.stringify({
                "text": text,
                "voiceId": voiceId,
            })
        })

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
