import { getPreviewString, saveTtsProviderSettings } from './index.js';

export { SBVits2TtsProvider };

class SBVits2TtsProvider {
    //########//
    // Config //
    //########//

    settings;
    ready = false;
    voices = [];
    separator = '. ';
    audioElement = document.createElement('audio');

    /**
     * Perform any text processing before passing to TTS engine.
     * @param {string} text Input text
     * @returns {string} Processed text
     */
    processText(text) {
        // backup for auto_split
        text = text.replace(/\n+/g, '<br>');
        return text;
    }

    languageLabels = {
        'Chinese': 'ZH',
        'English': 'EN',
        'Japanese': 'JP',
    };

    langKey2LangCode = {
        'ZH': 'zh-CN',
        'EN': 'en-US',
        'JP': 'ja-JP',
    };

    defaultSettings = {
        provider_endpoint: 'http://localhost:5000',
        sdp_ratio: 0.2,
        noise: 0.6,
        noisew: 0.8,
        length: 1,
        language: 'JP',
        auto_split: true,
        split_interval: 0.5,
        assist_text: '',
        assist_text_weight: 1,
        style: 'Neutral',
        style_weight: 1,
        reference_audio_path: '',
    };

    get settingsHtml() {
        let html = `
        <label for="sbvits_api_language">Language</label>
        <select id="sbvits_api_language">`;

        for (let language in this.languageLabels) {
            if (this.languageLabels[language] == this.settings?.language) {
                html += `<option value="${this.languageLabels[language]}" selected="selected">${language}</option>`;
                continue;
            }

            html += `<option value="${this.languageLabels[language]}">${language}</option>`;
        }

        html += `
        </select>
        <label">SBVits2 Settings:</label><br/>
        <label for="sbvits_tts_endpoint">Provider Endpoint:</label>
        <input id="sbvits_tts_endpoint" type="text" class="text_pole" maxlength="250" value="${this.defaultSettings.provider_endpoint}"/>
        <span>Use <a target="_blank" href="https://github.com/litagin02/Style-Bert-VITS2">Style-Bert-VITS2 API Server</a>.</span><br/>

        <label for="sbvits_sdp_ratio">sdp_ratio: <span id="sbvits_sdp_ratio_output">${this.defaultSettings.sdp_ratio}</span></label>
        <input id="sbvits_sdp_ratio" type="range" value="${this.defaultSettings.sdp_ratio}" min="0.0" max="1" step="0.01" />

        <label for="sbvits_noise">noise: <span id="sbvits_noise_output">${this.defaultSettings.noise}</span></label>
        <input id="sbvits_noise" type="range" value="${this.defaultSettings.noise}" min="0.1" max="2" step="0.01" />

        <label for="sbvits_noisew">noisew: <span id="sbvits_noisew_output">${this.defaultSettings.noisew}</span></label>
        <input id="sbvits_noisew" type="range" value="${this.defaultSettings.noisew}" min="0.1" max="2" step="0.01" />

        <label for="sbvits_length">length: <span id="sbvits_length_output">${this.defaultSettings.length}</span></label>
        <input id="sbvits_length" type="range" value="${this.defaultSettings.length}" min="0.0" max="5" step="0.01" />

        <label for="sbvits_auto_split" class="checkbox_label">
            <input id="sbvits_auto_split" type="checkbox" ${this.defaultSettings.auto_split ? 'checked' : ''} />
            Enable Text Splitting
        </label>

        <label for="sbvits_split_interval">split_interval: <span id="sbvits_split_interval_output">${this.defaultSettings.split_interval}</span></label>
        <input id="sbvits_split_interval" type="range" value="${this.defaultSettings.split_interval}" min="0.0" max="5" step="0.01" />

        <label for="sbvits_assist_text">assist_text:</label>
        <input id="sbvits_assist_text" type="text" class="text_pole" maxlength="512" value="${this.defaultSettings.assist_text}"/>

        <label for="sbvits_assist_text_weight">assist_text_weight: <span id="sbvits_assist_text_weight_output">${this.defaultSettings.assist_text_weight}</span></label>
        <input id="sbvits_assist_text_weight" type="range" value="${this.defaultSettings.assist_text_weight}" min="0.0" max="1" step="0.01" />

        <label for="sbvits_style_weight">style_weight: <span id="sbvits_style_weight_output">${this.defaultSettings.style_weight}</span></label>
        <input id="sbvits_style_weight" type="range" value="${this.defaultSettings.style_weight}" min="0.0" max="20" step="0.01" />

        <label for="sbvits_reference_audio_path">reference_audio_path:</label>
        <input id="sbvits_reference_audio_path" type="text" class="text_pole" maxlength="512" value="${this.defaultSettings.reference_audio_path}"/>
        `;

        return html;
    }

    onSettingsChange() {
        // Used when provider settings are updated from UI
        this.settings.provider_endpoint = $('#sbvits_tts_endpoint').val();
        this.settings.language = $('#sbvits_api_language').val();
        this.settings.assist_text = $('#sbvits_assist_text').val();
        this.settings.reference_audio_path = $('#sbvits_reference_audio_path').val();

        // Update the default TTS settings based on input fields
        this.settings.sdp_ratio = $('#sbvits_sdp_ratio').val();
        this.settings.noise = $('#sbvits_noise').val();
        this.settings.noisew = $('#sbvits_noisew').val();
        this.settings.length = $('#sbvits_length').val();
        this.settings.auto_split = $('#sbvits_auto_split').is(':checked');
        this.settings.split_interval = $('#sbvits_split_interval').val();
        this.settings.assist_text_weight = $('#sbvits_assist_text_weight').val();
        this.settings.style_weight = $('#sbvits_style_weight').val();

        // Update the UI to reflect changes
        $('#sbvits_sdp_ratio_output').text(this.settings.sdp_ratio);
        $('#sbvits_noise_output').text(this.settings.noise);
        $('#sbvits_noisew_output').text(this.settings.noisew);
        $('#sbvits_length_output').text(this.settings.length);
        $('#sbvits_split_interval_output').text(this.settings.split_interval);
        $('#sbvits_assist_text_weight_output').text(this.settings.assist_text_weight);
        $('#sbvits_style_weight_output').text(this.settings.style_weight);

        saveTtsProviderSettings();
        this.changeTTSSettings();
    }

    async loadSettings(settings) {
        // Pupulate Provider UI given input settings
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
        $('#sbvits_tts_endpoint').val(this.settings.provider_endpoint);
        $('#sbvits_api_language').val(this.settings.language);
        $('#sbvits_assist_text').val(this.settings.assist_text);
        $('#sbvits_reference_audio_path').val(this.settings.reference_audio_path);
        $('#sbvits_sdp_ratio').val(this.settings.sdp_ratio);
        $('#sbvits_noise').val(this.settings.noise);
        $('#sbvits_noisew').val(this.settings.noisew);
        $('#sbvits_length').val(this.settings.length);
        $('#sbvits_auto_split').prop('checked', this.settings.auto_split);
        $('#sbvits_split_interval').val(this.settings.split_interval);
        $('#sbvits_assist_text_weight').val(this.settings.assist_text_weight);
        $('#sbvits_style_weight').val(this.settings.style_weight);

        // Update the UI to reflect changes
        $('#sbvits_sdp_ratio_output').text(this.settings.sdp_ratio);
        $('#sbvits_noise_output').text(this.settings.noise);
        $('#sbvits_noisew_output').text(this.settings.noisew);
        $('#sbvits_length_output').text(this.settings.length);
        $('#sbvits_split_interval_output').text(this.settings.split_interval);
        $('#sbvits_assist_text_weight_output').text(this.settings.assist_text_weight);
        $('#sbvits_style_weight_output').text(this.settings.style_weight);

        // Register input/change event listeners to update settings on user interaction
        $('#sbvits_tts_endpoint').on('input', () => { this.onSettingsChange(); });
        $('#sbvits_api_language').on('change', () => { this.onSettingsChange(); });
        $('#sbvits_assist_text').on('input', () => { this.onSettingsChange(); });
        $('#sbvits_reference_audio_path').on('input', () => { this.onSettingsChange(); });
        $('#sbvits_sdp_ratio').on('change', () => { this.onSettingsChange(); });
        $('#sbvits_noise').on('change', () => { this.onSettingsChange(); });
        $('#sbvits_noisew').on('change', () => { this.onSettingsChange(); });
        $('#sbvits_length').on('change', () => { this.onSettingsChange(); });
        $('#sbvits_auto_split').on('change', () => { this.onSettingsChange(); });
        $('#sbvits_split_interval').on('change', () => { this.onSettingsChange(); });
        $('#sbvits_assist_text_weight').on('change', () => { this.onSettingsChange(); });
        $('#sbvits_style_weight').on('change', () => { this.onSettingsChange(); });

        await this.checkReady();

        console.info('SBVits2: Settings loaded');
    }

    // Perform a simple readiness check by trying to fetch voiceIds
    async checkReady() {
        await Promise.allSettled([this.fetchTtsVoiceObjects(), this.changeTTSSettings()]);
    }

    async onRefreshClick() {
        return;
    }

    //#################//
    //  TTS Interfaces //
    //#################//

    /**
     * Get a voice from the TTS provider.
     * @param {string} voiceName Voice name to get
     * @returns {Promise<Object>} Voice object
     */
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
        const response = await fetch(`${this.settings.provider_endpoint}/models/info`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.json()}`);
        }
        const data = await response.json();
        const voices = Object.keys(data).flatMap(key => {
            const config = data[key];
            const spk2id = config.spk2id;
            const style2id = config.style2id;

            return Object.entries(spk2id).flatMap(([speaker, speaker_id]) => {
                return Object.entries(style2id).map(([style, styleId]) => {
                    return {
                        name: `${speaker} (${style})`,
                        voice_id: `${key}-${speaker_id}-${style}`,
                        preview_url: false,
                    };
                });
            });
        });

        this.voices = voices; // Assign to the class property
        return voices; // Also return this list
    }

    // Each time a parameter is changed, we change the configuration
    async changeTTSSettings() {
    }

    /**
     * Fetch TTS generation from the API.
     * @param {string} inputText Text to generate TTS for
     * @param {string} voiceId Voice ID to use (model_id-speaker_id-style)
     * @returns {Promise<Response>} Fetch response
     */
    async fetchTtsGeneration(inputText, voiceId) {
        console.info(`Generating new TTS for voice_id ${voiceId}`);

        const [model_id, speaker_id, ...rest] = voiceId.split('-');
        const style = rest.join('-');
        const params = new URLSearchParams();
        // restore for auto_split
        inputText = inputText.replaceAll('<br>', '\n');
        params.append('text', inputText);
        params.append('model_id', model_id);
        params.append('speaker_id', speaker_id);
        params.append('sdp_ratio', this.settings.sdp_ratio);
        params.append('noise', this.settings.noise);
        params.append('noisew', this.settings.noisew);
        params.append('length', this.settings.length);
        params.append('language', this.settings.language);
        params.append('auto_split', this.settings.auto_split);
        params.append('split_interval', this.settings.split_interval);
        if (this.settings.assist_text) {
            params.append('assist_text', this.settings.assist_text);
            params.append('assist_text_weight', this.settings.assist_text_weight);
        }
        params.append('style', style);
        params.append('style_weight', this.settings.style_weight);
        if (this.settings.reference_audio_path) {
            params.append('reference_audio_path', this.settings.reference_audio_path);
        }
        const url = `${this.settings.provider_endpoint}/voice?${params.toString()}`;

        const response = await fetch(
            url,
            {
                method: 'POST',
                headers: {
                },
            },
        );
        if (!response.ok) {
            toastr.error(response.statusText, 'TTS Generation Failed');
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        return response;
    }

    /**
     * Preview TTS for a given voice ID.
     * @param {string} id Voice ID
     */
    async previewTtsVoice(id) {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
        const lang_code = this.langKey2LangCode[this.settings.lang] ?? 'ja-JP';
        const text = getPreviewString(lang_code);
        const response = await this.fetchTtsGeneration(text, id);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        const audio = await response.blob();
        const url = URL.createObjectURL(audio);
        this.audioElement.src = url;
        this.audioElement.play();
    }

    // Interface not used
    async fetchTtsFromHistory(history_item_id) {
        return Promise.resolve(history_item_id);
    }
}
