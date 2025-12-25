import { saveTtsProviderSettings } from './index.js';
import { getCharacters, getPreviewString } from './index.js';

export { GptSoVITSAdapterProvider };

/*
    This file is adapted from gpt-sovits-v2.js. It was created because the original file is no longer maintained.
    Some logic has been optimized and more functionality has been added.
*/

class GptSoVITSAdapterProvider {
    settings;
    ready = false;
    voices = [];
    separator = '. ';
    audioElement = document.createElement('audio');
    /*
        do not modify the text, adapter will handle it
    */
    processText(text) {
        return text;
    }

    audioFormats = ['wav', 'ogg', 'silk', 'mp3', 'flac'];

    langKey2LangCode = {
        'zh': 'zh-CN',
        'en': 'en-US',
        'ja': 'ja-JP',
        'ko': 'ko-KR',
    };

    defaultSettings = {
        provider_endpoint: 'http://localhost:9881',
        format: 'wav',
        lang: 'auto',
        streaming: false,
        text_lang: 'zh',
        media_type: 'auto',
    };

    textLangOptions = [
        { value: 'zh', label: 'Chinese' },
        { value: 'en', label: 'English' },
        { value: 'ja', label: 'Japanese' },
        { value: 'ko', label: 'Korean' },
    ];

    mediaTypeOptions = [
        { value: 'auto', label: 'Auto' },
        { value: 'wav', label: 'WAV' },
        { value: 'mp3', label: 'MP3' },
        { value: 'ogg', label: 'OGG' },
        { value: 'silk', label: 'SILK' },
        { value: 'flac', label: 'FLAC' },
    ];

    _generateOptions(options, currentSetting) {
        return options.map(opt => {
            const isSelected = opt.value === currentSetting ? 'selected' : '';
            return `<option value="${opt.value}" ${isSelected}>${opt.label}</option>`;
        }).join('');
    }
    get settingsHtml() {
        const currentSettings = this.settings || this.defaultSettings;

        let html = `
        <label for="gpt_sovits_adapter_tts_endpoint">Provider Endpoint:</label>
        <div class="flex1">
        <input id="gpt_sovits_adapter_tts_endpoint" type="text" class="text_pole" maxlength="250" height="300" value="${this.defaultSettings.provider_endpoint}"/>
        </div>
        <span>Use <a target="_blank" href="https://github.com/guoql666/GPT-SoVITS_sillytavern_adapter">GPT-SoVITS-adapter</a>.</span><br/>
        <label for="text_lang">Text Lang(Inference text language):</label>
        <select id="text_lang" class="text_pole">
            ${this._generateOptions(this.textLangOptions, currentSettings.text_lang)}
        </select>
        <label for="media_type">Media Type:</label>
        <select id="media_type" class="text_pole">
            ${this._generateOptions(this.mediaTypeOptions, currentSettings.media_type)}
        </select>
        <br/>
        `;

        return html;
    }

    onSettingsChange() {
        // Used when provider settings are updated from UI
        this.settings.provider_endpoint = $('#gpt_sovits_adapter_tts_endpoint').val();
        this.settings.text_lang = $('#text_lang').val();
        this.settings.media_type = $('#media_type').val();

        saveTtsProviderSettings();
        this.changeTTSSettings();
    }

    async loadSettings(settings) {
        // Populate Provider UI given input settings
        if (Object.keys(settings).length == 0) {
            console.info('Using default TTS Provider settings');
        }

        // Only accept keys defined in defaultSettings
        this.settings = this.defaultSettings;

        for (const key in settings) {
            if (key in this.settings) {
                this.settings[key] = settings[key];
            } else {
                console.debug(`Ignoring non-user-configurable setting: ${key}`);
            }
        }

        // Set initial values from the settings
        $('#tts_endpoint').val(this.settings.provider_endpoint).on('change', this.onSettingsChange.bind(this));
        $('#text_lang').val(this.settings.text_lang).on('change', this.onSettingsChange.bind(this));
        $('#media_type').val(this.settings.media_type).on('change', this.onSettingsChange.bind(this));
        await this.checkReady();
        console.info('ITS: Settings loaded');
    }

    // Perform a simple readiness check by trying to fetch voiceIds
    async checkReady() {
        await Promise.allSettled([this.fetchTtsVoiceObjects(), this.changeTTSSettings()]);
    }

    async onRefreshClick() {
        return await this.checkReady();
    }

    //#################//
    //  TTS Interfaces //
    //#################//

    async getVoice(voiceName) {
        if (this.voices.length == 0) {
            this.voices = await this.fetchTtsVoiceObjects();
        }

        const match = this.voices.filter(
            v => v.name == voiceName,
        )[0];
        if (!match) {
            throw `TTS Voice name ${voiceName} not found`;
        }
        return match;
    }

    async generateTts(text, voiceId) {
        const response = await this.fetchTtsGeneration(text, voiceId);
        return response;
    }

    //###########//
    // API CALLS //
    //###########//
    async fetchTtsVoiceObjects() {
        const response = await fetch(`${this.settings.provider_endpoint}/speakers`);
        console.info(response);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.json()}`);
        }
        const responseJson = await response.json();
        this.voices = responseJson;
        return responseJson;
    }

    // Each time a parameter is changed, we change the configuration
    async changeTTSSettings() {
    }

    /**
    * Preview TTS voice by generating a short sample.
    * @param {string} voiceId Voice ID to preview (model_type&speaker_id))
    */
    async previewTtsVoice(voiceId) {
        const langCode = this.langKey2LangCode[this.settings.text_lang] || 'zh-CN';
        const previewText = getPreviewString(langCode);
        const response = await this.fetchTtsGeneration(previewText, voiceId);

        const audio = await response.blob();
        const url = URL.createObjectURL(audio);
        this.audioElement.src = url;
        this.audioElement.play();
        this.audioElement.onended = () => URL.revokeObjectURL(url);
    }

    /**
     * Fetch TTS generation from the API.
     * @param {string} inputText Text to generate TTS for
     * @param {string} voiceId Voice ID to use (model_type&speaker_id))
     * @returns {Promise<Response>} Fetch response
     */
    async fetchTtsGeneration(inputText, voiceId, lang = null, forceNoStreaming = false) {
        console.info(`Generating new TTS for voice_id ${voiceId}`);

        const params = {
            text: inputText,
            card_name: getCharacters(false),
            use_st_adapter: true,
            target_voice: voiceId,
            text_lang: this.settings.text_lang,
            text_split_method: 'cut5',
            batch_size: 1,
            media_type: this.settings.media_type,
            streaming_mode: 'true',
        };

        const url = `${this.settings.provider_endpoint}/`;

        const response = await fetch(
            url,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(params),
            },
        );
        if (!response.ok) {
            toastr.error(response.statusText, 'TTS Generation Failed');
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        return response;
    }

    // Interface not used
    async fetchTtsFromHistory(history_item_id) {
        return Promise.resolve(history_item_id);
    }
}
