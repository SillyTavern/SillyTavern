/*
TODO:
 - Hide voice map its just confusing
 - Delete useless call
*/

import { doExtrasFetch, extension_settings, getApiUrl, modules } from '../../extensions.js';
import { callPopup } from '../../../script.js';
import { initVoiceMap } from './index.js';

export { CoquiTtsProvider };

const DEBUG_PREFIX = '<Coqui TTS module> ';

let inApiCall = false;
let coquiApiModels = {}; // Initialized only once
let coquiApiModelsFull = {}; // Initialized only once
let coquiLocalModels = []; // Initialized only once
let coquiLocalModelsReceived = false;
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
    'multilingual': 'Multilingual',
    'en': 'English',
    'fr': 'French',
    'es': 'Spanish',
    'ja': 'Japanese',
};

function throwIfModuleMissing() {
    if (!modules.includes('coqui-tts')) {
        const message = 'Coqui TTS module not loaded. Add coqui-tts to enable-modules and restart the Extras API.';
        // toastr.error(message, { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
        throw new Error(DEBUG_PREFIX, message);
    }
}

function resetModelSettings() {
    $('#coqui_api_model_settings_language').val('none');
    $('#coqui_api_model_settings_speaker').val('none');
}

class CoquiTtsProvider {
    //#############################//
    //  Extension UI and Settings  //
    //#############################//

    settings;

    defaultSettings = {
        voiceMap: {},
        customVoices: {},
        voiceIds: [],
        voiceMapDict: {},
    };

    get settingsHtml() {
        let html = `
        <div class="flex wide100p flexGap10 alignitemscenter">
            <div>
                <div style="flex: 50%;">
                    <small>To use CoquiTTS, select the origin, language, and model, then click Add Voice. The voice will then be available to add to a character. Voices are saved globally. </small><br>
                    <label for="coqui_voicename_select">Select Saved Voice:</label>
                    <select id="coqui_voicename_select">
                        <!-- Populated by JS -->
                    </select>
                    <div class="tts_block">
                        <input id="coqui_remove_voiceId_mapping" class="menu_button" type="button" value="Remove Voice" />
                        <input id="coqui_add_voiceId_mapping" class="menu_button" type="button" value="Add Voice" />
                    </div>
                    <label for="coqui_model_origin">Models:</label>
                    <select id="coqui_model_origin">gpu_mode
                        <option value="none">Select Origin</option>
                        <option value="coqui-api">Coqui API (Tested)</option>
                        <option value="coqui-api-full">Coqui API (Experimental)</option>
                        <option value="local">My Models</option>
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

                    <div id="coqui_local_model_div">
                        <select id="coqui_local_model_name">
                            <!-- Populated by JS and request -->
                        </select>
                    </div>

                </div>
            </div>
        </div>
        `;
        return html;
    }

    async loadSettings(settings) {
        // Only accept keys defined in defaultSettings
        this.settings = this.defaultSettings;

        for (const key in settings) {
            if (key in this.settings) {
                this.settings[key] = settings[key];
            } else {
                throw DEBUG_PREFIX + `Invalid setting passed to extension: ${key}`;
            }
        }

        await initLocalModels();
        this.updateCustomVoices(); // Overide any manual modification

        $('#coqui_api_model_div').hide();
        $('#coqui_local_model_div').hide();

        $('#coqui_api_language').show();
        $('#coqui_api_model_name').hide();
        $('#coqui_api_model_settings').hide();
        $('#coqui_api_model_install_status').hide();
        $('#coqui_api_model_install_button').hide();

        let that = this;
        $('#coqui_model_origin').on('change', function () { that.onModelOriginChange(); });
        $('#coqui_api_language').on('change', function () { that.onModelLanguageChange(); });
        $('#coqui_api_model_name').on('change', function () { that.onModelNameChange(); });

        $('#coqui_remove_voiceId_mapping').on('click', function () { that.onRemoveClick(); });
        $('#coqui_add_voiceId_mapping').on('click', function () { that.onAddClick(); });

        // Load coqui-api settings from json file
        await fetch('/scripts/extensions/tts/coqui_api_models_settings.json')
            .then(response => response.json())
            .then(json => {
                coquiApiModels = json;
                console.debug(DEBUG_PREFIX,'initialized coqui-api model list to', coquiApiModels);
            /*
            $('#coqui_api_language')
                .find('option')
                .remove()
                .end()
                .append('<option value="none">Select model language</option>')
                .val('none');

            for(let language in coquiApiModels) {
                $("#coqui_api_language").append(new Option(languageLabels[language],language));
                console.log(DEBUG_PREFIX,"added language",language);
            }*/
            });

        // Load coqui-api FULL settings from json file
        await fetch('/scripts/extensions/tts/coqui_api_models_settings_full.json')
            .then(response => response.json())
            .then(json => {
                coquiApiModelsFull = json;
                console.debug(DEBUG_PREFIX,'initialized coqui-api full model list to', coquiApiModelsFull);
            /*
            $('#coqui_api_full_language')
                .find('option')
                .remove()
                .end()
                .append('<option value="none">Select model language</option>')
                .val('none');

            for(let language in coquiApiModelsFull) {
                $("#coqui_api_full_language").append(new Option(languageLabels[language],language));
                console.log(DEBUG_PREFIX,"added language",language);
            }*/
            });
    }

    // Perform a simple readiness check by trying to fetch voiceIds
    async checkReady(){
        throwIfModuleMissing();
        await this.fetchTtsVoiceObjects();
    }

    updateCustomVoices() {
        // Takes voiceMapDict and converts it to a string to save to voiceMap
        this.settings.customVoices = {};
        for (let voiceName in this.settings.voiceMapDict) {
            const voiceId = this.settings.voiceMapDict[voiceName];
            this.settings.customVoices[voiceName] = voiceId['model_id'];

            if (voiceId['model_language'] != null)
                this.settings.customVoices[voiceName] += '[' + voiceId['model_language'] + ']';

            if (voiceId['model_speaker'] != null)
                this.settings.customVoices[voiceName] += '[' + voiceId['model_speaker'] + ']';
        }

        // Update UI select list with voices
        $('#coqui_voicename_select').empty();
        $('#coqui_voicename_select')
            .find('option')
            .remove()
            .end()
            .append('<option value="none">Select Voice</option>')
            .val('none');
        for (const voiceName in this.settings.voiceMapDict) {
            $('#coqui_voicename_select').append(new Option(voiceName, voiceName));
        }

        this.onSettingsChange();
    }

    onSettingsChange() {
        console.debug(DEBUG_PREFIX, 'Settings changes', this.settings);
        extension_settings.tts.Coqui = this.settings;
    }

    async onRefreshClick() {
        this.checkReady();
    }

    async onAddClick() {
        if (inApiCall) {
            return; //TODO: block dropdown
        }

        // Ask user for voiceId name to save voice
        const voiceName = await callPopup('<h3>Name of Coqui voice to add to voice select dropdown:</h3>', 'input');

        const model_origin = $('#coqui_model_origin').val();
        const model_language = $('#coqui_api_language').val();
        const model_name = $('#coqui_api_model_name').val();
        let model_setting_language = $('#coqui_api_model_settings_language').val();
        let model_setting_speaker = $('#coqui_api_model_settings_speaker').val();


        if (!voiceName) {
            toastr.error('Voice name empty, please enter one.', DEBUG_PREFIX + ' voice mapping voice name', { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
            this.updateCustomVoices(); // Overide any manual modification
            return;
        }

        if (model_origin == 'none') {
            toastr.error('Origin not selected, please select one.', DEBUG_PREFIX + ' voice mapping origin', { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
            this.updateCustomVoices(); // Overide any manual modification
            return;
        }

        if (model_origin == 'local') {
            const model_id = $('#coqui_local_model_name').val();

            if (model_name == 'none') {
                toastr.error('Model not selected, please select one.', DEBUG_PREFIX + ' voice mapping model', { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
                this.updateCustomVoices(); // Overide any manual modification
                return;
            }

            this.settings.voiceMapDict[voiceName] = { model_type: 'local', model_id: 'local/' + model_id };
            console.debug(DEBUG_PREFIX, 'Registered new voice map: ', voiceName, ':', this.settings.voiceMapDict[voiceName]);
            this.updateCustomVoices(); // Overide any manual modification
            return;
        }

        if (model_language == 'none') {
            toastr.error('Language not selected, please select one.', DEBUG_PREFIX + ' voice mapping language', { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
            this.updateCustomVoices(); // Overide any manual modification
            return;
        }

        if (model_name == 'none') {
            toastr.error('Model not selected, please select one.', DEBUG_PREFIX + ' voice mapping model', { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
            this.updateCustomVoices(); // Overide any manual modification
            return;
        }

        if (model_setting_language == 'none')
            model_setting_language = null;

        if (model_setting_speaker == 'none')
            model_setting_speaker = null;

        const tokens = $('#coqui_api_model_name').val().split('/');
        const model_dataset = tokens[0];
        const model_label = tokens[1];
        const model_id = 'tts_models/' + model_language + '/' + model_dataset + '/' + model_label;

        let modelDict = coquiApiModels;
        if (model_origin == 'coqui-api-full')
            modelDict = coquiApiModelsFull;

        if (model_setting_language == null & 'languages' in modelDict[model_language][model_dataset][model_label]) {
            toastr.error('Model language not selected, please select one.', DEBUG_PREFIX + ' voice mapping model language', { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
            return;
        }

        if (model_setting_speaker == null & 'speakers' in modelDict[model_language][model_dataset][model_label]) {
            toastr.error('Model speaker not selected, please select one.', DEBUG_PREFIX + ' voice mapping model speaker', { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
            return;
        }

        console.debug(DEBUG_PREFIX, 'Current custom voices: ', this.settings.customVoices);

        this.settings.voiceMapDict[voiceName] = { model_type: 'coqui-api', model_id: model_id, model_language: model_setting_language, model_speaker: model_setting_speaker };

        console.debug(DEBUG_PREFIX, 'Registered new voice map: ', voiceName, ':', this.settings.voiceMapDict[voiceName]);

        this.updateCustomVoices();
        initVoiceMap(); // Update TTS extension voiceMap

        let successMsg = voiceName + ':' + model_id;
        if (model_setting_language != null)
            successMsg += '[' + model_setting_language + ']';
        if (model_setting_speaker != null)
            successMsg += '[' + model_setting_speaker + ']';
        toastr.info(successMsg, DEBUG_PREFIX + ' voice map updated', { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });

        return;
    }

    async getVoice(voiceName) {
        let match = await this.fetchTtsVoiceObjects();
        match = match.filter(
            voice => voice.name == voiceName,
        )[0];
        if (!match) {
            throw `TTS Voice name ${voiceName} not found in CoquiTTS Provider voice list`;
        }
        return match;
    }

    async onRemoveClick() {
        const voiceName = $('#coqui_voicename_select').val();

        if (voiceName === 'none') {
            toastr.error('Voice not selected, please select one.', DEBUG_PREFIX + ' voice mapping voiceId', { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
            return;
        }

        // Todo erase from voicemap
        delete (this.settings.voiceMapDict[voiceName]);
        this.updateCustomVoices();
        initVoiceMap(); // Update TTS extension voiceMap
    }

    async onModelOriginChange() {
        throwIfModuleMissing();
        resetModelSettings();
        const model_origin = $('#coqui_model_origin').val();

        if (model_origin == 'none') {
            $('#coqui_local_model_div').hide();
            $('#coqui_api_model_div').hide();
        }

        // show coqui model selected list (SAFE)
        if (model_origin == 'coqui-api') {
            $('#coqui_local_model_div').hide();

            $('#coqui_api_language')
                .find('option')
                .remove()
                .end()
                .append('<option value="none">Select model language</option>')
                .val('none');

            for(let language in coquiApiModels) {
                let languageLabel = language;
                if (language in languageLabels)
                    languageLabel = languageLabels[language];
                $('#coqui_api_language').append(new Option(languageLabel,language));
                console.log(DEBUG_PREFIX,'added language',languageLabel,'(',language,')');
            }

            $('#coqui_api_model_div').show();
        }

        // show coqui model full list (UNSAFE)
        if (model_origin == 'coqui-api-full') {
            $('#coqui_local_model_div').hide();

            $('#coqui_api_language')
                .find('option')
                .remove()
                .end()
                .append('<option value="none">Select model language</option>')
                .val('none');

            for(let language in coquiApiModelsFull) {
                let languageLabel = language;
                if (language in languageLabels)
                    languageLabel = languageLabels[language];
                $('#coqui_api_language').append(new Option(languageLabel,language));
                console.log(DEBUG_PREFIX,'added language',languageLabel,'(',language,')');
            }

            $('#coqui_api_model_div').show();
        }


        // show local model list
        if (model_origin == 'local') {
            $('#coqui_api_model_div').hide();
            $('#coqui_local_model_div').show();
        }
    }

    async onModelLanguageChange() {
        throwIfModuleMissing();
        resetModelSettings();
        $('#coqui_api_model_settings').hide();
        const model_origin = $('#coqui_model_origin').val();
        const model_language = $('#coqui_api_language').val();
        console.debug(model_language);

        if (model_language == 'none') {
            $('#coqui_api_model_name').hide();
            return;
        }

        $('#coqui_api_model_name').show();
        $('#coqui_api_model_name')
            .find('option')
            .remove()
            .end()
            .append('<option value="none">Select model</option>')
            .val('none');

        let modelDict = coquiApiModels;
        if (model_origin == 'coqui-api-full')
            modelDict = coquiApiModelsFull;

        for(let model_dataset in modelDict[model_language])
            for(let model_name in modelDict[model_language][model_dataset]) {
                const model_id = model_dataset + '/' + model_name;
                const model_label = model_name + ' (' + model_dataset + ' dataset)';
                $('#coqui_api_model_name').append(new Option(model_label, model_id));
            }
    }

    async onModelNameChange() {
        throwIfModuleMissing();
        resetModelSettings();
        $('#coqui_api_model_settings').hide();
        const model_origin = $('#coqui_model_origin').val();

        // No model selected
        if ($('#coqui_api_model_name').val() == 'none') {
            $('#coqui_api_model_install_button').off('click');
            $('#coqui_api_model_install_button').hide();
            return;
        }

        // Get languages and speakers options
        const model_language = $('#coqui_api_language').val();
        const tokens = $('#coqui_api_model_name').val().split('/');
        const model_dataset = tokens[0];
        const model_name = tokens[1];

        let modelDict = coquiApiModels;
        if (model_origin == 'coqui-api-full')
            modelDict = coquiApiModelsFull;

        const model_settings = modelDict[model_language][model_dataset][model_name];

        if ('languages' in model_settings) {
            $('#coqui_api_model_settings').show();
            $('#coqui_api_model_settings_language').show();
            $('#coqui_api_model_settings_language')
                .find('option')
                .remove()
                .end()
                .append('<option value="none">Select language</option>')
                .val('none');

            for (let i = 0; i < model_settings['languages'].length; i++) {
                const language_label = JSON.stringify(model_settings['languages'][i]).replaceAll('"', '');
                $('#coqui_api_model_settings_language').append(new Option(language_label, i));
            }
        }
        else {
            $('#coqui_api_model_settings_language').hide();
        }

        if ('speakers' in model_settings) {
            $('#coqui_api_model_settings').show();
            $('#coqui_api_model_settings_speaker').show();
            $('#coqui_api_model_settings_speaker')
                .find('option')
                .remove()
                .end()
                .append('<option value="none">Select speaker</option>')
                .val('none');

            for (let i = 0; i < model_settings['speakers'].length; i++) {
                const speaker_label = JSON.stringify(model_settings['speakers'][i]).replaceAll('"', '');
                $('#coqui_api_model_settings_speaker').append(new Option(speaker_label, i));
            }
        }
        else {
            $('#coqui_api_model_settings_speaker').hide();
        }

        $('#coqui_api_model_install_status').text('Requesting model to extras server...');
        $('#coqui_api_model_install_status').show();

        // Check if already installed and propose to do it otherwise
        const model_id = modelDict[model_language][model_dataset][model_name]['id'];
        console.debug(DEBUG_PREFIX,'Check if model is already installed',model_id);
        let result = await CoquiTtsProvider.checkmodel_state(model_id);
        result = await result.json();
        const model_state = result['model_state'];

        console.debug(DEBUG_PREFIX, ' Model state:', model_state);

        if (model_state == 'installed') {
            $('#coqui_api_model_install_status').text('Model already installed on extras server');
            $('#coqui_api_model_install_button').hide();
        }
        else {
            let action = 'download';
            if (model_state == 'corrupted') {
                action = 'repare';
                //toastr.error("Click install button to reinstall the model "+$("#coqui_api_model_name").find(":selected").text(), DEBUG_PREFIX+" corrupted model install", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
                $('#coqui_api_model_install_status').text('Model found but incomplete try install again (maybe still downloading)'); // (remove and download again)
            }
            else {
                toastr.info('Click download button to install the model ' + $('#coqui_api_model_name').find(':selected').text(), DEBUG_PREFIX + ' model not installed', { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
                $('#coqui_api_model_install_status').text('Model not found on extras server');
            }

            const onModelNameChange_pointer = this.onModelNameChange;

            $('#coqui_api_model_install_button').off('click').on('click', async function () {
                try {
                    $('#coqui_api_model_install_status').text('Downloading model...');
                    $('#coqui_api_model_install_button').hide();
                    //toastr.info("For model "+model_id, DEBUG_PREFIX+" Started "+action, { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
                    let apiResult = await CoquiTtsProvider.installModel(model_id, action);
                    apiResult = await apiResult.json();

                    console.debug(DEBUG_PREFIX, 'Response:', apiResult);

                    if (apiResult['status'] == 'done') {
                        $('#coqui_api_model_install_status').text('Model installed and ready to use!');
                        $('#coqui_api_model_install_button').hide();
                        onModelNameChange_pointer();
                    }

                    if (apiResult['status'] == 'downloading') {
                        toastr.error('Check extras console for progress', DEBUG_PREFIX + ' already downloading', { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
                        $('#coqui_api_model_install_status').text('Already downloading a model, check extras console!');
                        $('#coqui_api_model_install_button').show();
                    }
                } catch (error) {
                    console.error(error);
                    toastr.error(error, DEBUG_PREFIX + ' error with model download', { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
                    onModelNameChange_pointer();
                }
                // will refresh model status
            });

            $('#coqui_api_model_install_button').show();
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
        throwIfModuleMissing();
        const url = new URL(getApiUrl());
        url.pathname = '/api/text-to-speech/coqui/coqui-api/check-model-state';

        const apiResult = await doExtrasFetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
            },
            body: JSON.stringify({
                'model_id': model_id,
            }),
        });

        if (!apiResult.ok) {
            toastr.error(apiResult.statusText, DEBUG_PREFIX + ' Check model state request failed');
            throw new Error(`HTTP ${apiResult.status}: ${await apiResult.text()}`);
        }

        return apiResult;
    }

    static async installModel(model_id, action) {
        throwIfModuleMissing();
        const url = new URL(getApiUrl());
        url.pathname = '/api/text-to-speech/coqui/coqui-api/install-model';

        const apiResult = await doExtrasFetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
            },
            body: JSON.stringify({
                'model_id': model_id,
                'action': action,
            }),
        });

        if (!apiResult.ok) {
            toastr.error(apiResult.statusText, DEBUG_PREFIX + ' Install model ' + model_id + ' request failed');
            throw new Error(`HTTP ${apiResult.status}: ${await apiResult.text()}`);
        }

        return apiResult;
    }

    /*
        Retrieve user custom models
    */
    static async getLocalModelList() {
        throwIfModuleMissing();
        const url = new URL(getApiUrl());
        url.pathname = '/api/text-to-speech/coqui/local/get-models';

        const apiResult = await doExtrasFetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
            },
            body: JSON.stringify({
                'model_id': 'model_id',
                'action': 'action',
            }),
        });

        if (!apiResult.ok) {
            toastr.error(apiResult.statusText, DEBUG_PREFIX + ' Get local model list request failed');
            throw new Error(`HTTP ${apiResult.status}: ${await apiResult.text()}`);
        }

        return apiResult;
    }


    // Expect voiceId format to be like:
    // tts_models/multilingual/multi-dataset/your_tts[2][1]
    // tts_models/en/ljspeech/glow-tts
    // ts_models/ja/kokoro/tacotron2-DDC
    async generateTts(text, voiceId) {
        throwIfModuleMissing();
        voiceId = this.settings.customVoices[voiceId];

        const url = new URL(getApiUrl());
        url.pathname = '/api/text-to-speech/coqui/generate-tts';

        let language = 'none';
        let speaker = 'none';
        const tokens = voiceId.replaceAll(']', '').replaceAll('"', '').split('[');
        const model_id = tokens[0];

        console.debug(DEBUG_PREFIX, 'Preparing TTS request for', tokens);

        // First option
        if (tokens.length > 1) {
            const option1 = tokens[1];

            if (model_id.includes('multilingual'))
                language = option1;
            else
                speaker = option1;
        }

        // Second option
        if (tokens.length > 2)
            speaker = tokens[2];

        const apiResult = await doExtrasFetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Cache-Control': 'no-cache',
            },
            body: JSON.stringify({
                'text': text,
                'model_id': model_id,
                'language_id': parseInt(language),
                'speaker_id': parseInt(speaker),
            }),
        });

        if (!apiResult.ok) {
            toastr.error(apiResult.statusText, 'TTS Generation Failed');
            throw new Error(`HTTP ${apiResult.status}: ${await apiResult.text()}`);
        }

        return apiResult;
    }

    // Dirty hack to say not implemented
    async fetchTtsVoiceObjects() {
        const voiceIds = Object
            .keys(this.settings.voiceMapDict)
            .map(voice => ({ name: voice, voice_id: voice, preview_url: false }));
        return voiceIds;
    }

    // Do nothing
    previewTtsVoice(id) {
        return;
    }

    async fetchTtsFromHistory(history_item_id) {
        return Promise.resolve(history_item_id);
    }
}

async function initLocalModels() {
    if (!modules.includes('coqui-tts'))
        return;

    // Initialized local model once
    if (!coquiLocalModelsReceived) {
        let result = await CoquiTtsProvider.getLocalModelList();
        result = await result.json();

        coquiLocalModels = result['models_list'];

        $('#coqui_local_model_name').show();
        $('#coqui_local_model_name')
            .find('option')
            .remove()
            .end()
            .append('<option value="none">Select model</option>')
            .val('none');

        for (const model_dataset of coquiLocalModels)
            $('#coqui_local_model_name').append(new Option(model_dataset, model_dataset));

        coquiLocalModelsReceived = true;
    }
}
