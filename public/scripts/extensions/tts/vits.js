import { getPreviewString, saveTtsProviderSettings } from './index.js';

export { VITSTtsProvider };

class VITSTtsProvider {
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
        return text;
    }

    audioFormats = ['wav', 'ogg', 'silk', 'mp3', 'flac'];

    languageLabels = {
        'Auto': 'auto',
        'Chinese': 'zh',
        'English': 'en',
        'Japanese': 'ja',
        'Korean': 'ko',
    };

    langKey2LangCode = {
        'zh': 'zh-CN',
        'en': 'en-US',
        'ja': 'ja-JP',
        'ko': 'ko-KR',
    };

    modelTypes = {
        VITS: 'VITS',
        W2V2_VITS: 'W2V2-VITS',
        BERT_VITS2: 'BERT-VITS2',
    };

    defaultSettings = {
        provider_endpoint: 'http://localhost:23456',
        format: 'wav',
        lang: 'auto',
        length: 1.0,
        noise: 0.33,
        noisew: 0.4,
        segment_size: 50,
        streaming: false,
        dim_emotion: 0,
        sdp_ratio: 0.2,
        emotion: 0,
        text_prompt: '',
        style_text: '',
        style_weight: 1,
    };

    get settingsHtml() {
        let html = `
        <label for="vits_lang">Text Language</label>
        <select id="vits_lang">`;

        for (let language in this.languageLabels) {
            if (this.languageLabels[language] == this.settings?.lang) {
                html += `<option value="${this.languageLabels[language]}" selected="selected">${language}</option>`;
                continue;
            }
            html += `<option value="${this.languageLabels[language]}">${language}</option>`;
        }

        html += `
        </select>
        <label>VITS / W2V2-VITS / Bert-VITS2 Settings:</label><br/>
        <label for="vits_endpoint">Provider Endpoint:</label>
        <input id="vits_endpoint" type="text" class="text_pole" maxlength="250" value="${this.defaultSettings.provider_endpoint}"/>
        <span>Use <a target="_blank" href="https://github.com/Artrajz/vits-simple-api">vits-simple-api</a>.</span><br/>

        <label for="vits_format">Audio format:</label>
        <select id="vits_format">`;

        for (let format of this.audioFormats) {
            if (format == this.settings?.format) {
                html += `<option value="${format}" selected="selected">${format}</option>`;
                continue;
            }
            html += `<option value="${format}">${format}</option>`;
        }

        html += `
        </select>
        <label for="vits_length">Audio length: <span id="vits_length_output">${this.defaultSettings.length}</span></label>
        <input id="vits_length" type="range" value="${this.defaultSettings.length}" min="0.0" max="5" step="0.01" />

        <label for="vits_noise">Noise: <span id="vits_noise_output">${this.defaultSettings.noise}</span></label>
        <input id="vits_noise" type="range" value="${this.defaultSettings.noise}" min="0.1" max="2" step="0.01" />

        <label for="vits_noisew">SDP noise: <span id="vits_noisew_output">${this.defaultSettings.noisew}</span></label>
        <input id="vits_noisew" type="range" value="${this.defaultSettings.noisew}" min="0.1" max="2" step="0.01" />

        <label for="vits_segment_size">Segment Size: <span id="vits_segment_size_output">${this.defaultSettings.segment_size}</span></label>
        <input id="vits_segment_size" type="range" value="${this.defaultSettings.segment_size}" min="0" max="1000" step="1" />

        <label for="vits_streaming" class="checkbox_label">
            <input id="vits_streaming" type="checkbox" />
            <span>Streaming</span>
        </label>

        <label>W2V2-VITS Settings:</label><br/>
        <label for="vits_dim_emotion">Dimensional emotion:</label>
        <input id="vits_dim_emotion" type="number" class="text_pole" min="0" max="5457" step="1" value="${this.defaultSettings.dim_emotion}"/>

        <label>BERT-VITS2 Settings:</label><br/>
        <label for="vits_sdp_ratio">sdp_ratio: <span id="vits_sdp_ratio_output">${this.defaultSettings.sdp_ratio}</span></label>
        <input id="vits_sdp_ratio" type="range" value="${this.defaultSettings.sdp_ratio}" min="0.0" max="1" step="0.01" />

        <label for="vits_emotion">emotion: <span id="vits_emotion_output">${this.defaultSettings.emotion}</span></label>
        <input id="vits_emotion" type="range" value="${this.defaultSettings.emotion}" min="0" max="9" step="1" />

        <label for="vits_text_prompt">Text Prompt:</label>
        <input id="vits_text_prompt" type="text" class="text_pole" maxlength="512" value="${this.defaultSettings.text_prompt}"/>

        <label for="vits_style_text">Style text:</label>
        <input id="vits_style_text" type="text" class="text_pole" maxlength="512" value="${this.defaultSettings.style_text}"/>

        <label for="vits_style_weight">Style weight <span id="vits_style_weight_output">${this.defaultSettings.style_weight}</span></label>
        <input id="vits_style_weight" type="range" value="${this.defaultSettings.style_weight}" min="0" max="1" step="0.01" />
        `;

        return html;
    }

    onSettingsChange() {
        // Used when provider settings are updated from UI
        this.settings.provider_endpoint = $('#vits_endpoint').val();
        this.settings.lang = $('#vits_lang').val();
        this.settings.format = $('#vits_format').val();
        this.settings.dim_emotion = $('#vits_dim_emotion').val();
        this.settings.text_prompt = $('#vits_text_prompt').val();
        this.settings.style_text = $('#vits_style_text').val();

        // Update the default TTS settings based on input fields
        this.settings.length = $('#vits_length').val();
        this.settings.noise = $('#vits_noise').val();
        this.settings.noisew = $('#vits_noisew').val();
        this.settings.segment_size = $('#vits_segment_size').val();
        this.settings.streaming = $('#vits_streaming').is(':checked');
        this.settings.sdp_ratio = $('#vits_sdp_ratio').val();
        this.settings.emotion = $('#vits_emotion').val();
        this.settings.style_weight = $('#vits_style_weight').val();

        // Update the UI to reflect changes
        $('#vits_length_output').text(this.settings.length);
        $('#vits_noise_output').text(this.settings.noise);
        $('#vits_noisew_output').text(this.settings.noisew);
        $('#vits_segment_size_output').text(this.settings.segment_size);
        $('#vits_sdp_ratio_output').text(this.settings.sdp_ratio);
        $('#vits_emotion_output').text(this.settings.emotion);
        $('#vits_style_weight_output').text(this.settings.style_weight);

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
        $('#vits_endpoint').val(this.settings.provider_endpoint);
        $('#vits_lang').val(this.settings.lang);
        $('#vits_format').val(this.settings.format);
        $('#vits_length').val(this.settings.length);
        $('#vits_noise').val(this.settings.noise);
        $('#vits_noisew').val(this.settings.noisew);
        $('#vits_segment_size').val(this.settings.segment_size);
        $('#vits_streaming').prop('checked', this.settings.streaming);
        $('#vits_dim_emotion').val(this.settings.dim_emotion);
        $('#vits_sdp_ratio').val(this.settings.sdp_ratio);
        $('#vits_emotion').val(this.settings.emotion);
        $('#vits_text_prompt').val(this.settings.text_prompt);
        $('#vits_style_text').val(this.settings.style_text);
        $('#vits_style_weight').val(this.settings.style_weight);

        // Update the UI to reflect changes
        $('#vits_length_output').text(this.settings.length);
        $('#vits_noise_output').text(this.settings.noise);
        $('#vits_noisew_output').text(this.settings.noisew);
        $('#vits_segment_size_output').text(this.settings.segment_size);
        $('#vits_sdp_ratio_output').text(this.settings.sdp_ratio);
        $('#vits_emotion_output').text(this.settings.emotion);
        $('#vits_style_weight_output').text(this.settings.style_weight);

        // Register input/change event listeners to update settings on user interaction
        $('#vits_endpoint').on('input', () => { this.onSettingsChange(); });
        $('#vits_lang').on('change', () => { this.onSettingsChange(); });
        $('#vits_format').on('change', () => { this.onSettingsChange(); });
        $('#vits_length').on('change', () => { this.onSettingsChange(); });
        $('#vits_noise').on('change', () => { this.onSettingsChange(); });
        $('#vits_noisew').on('change', () => { this.onSettingsChange(); });
        $('#vits_segment_size').on('change', () => { this.onSettingsChange(); });
        $('#vits_streaming').on('change', () => { this.onSettingsChange(); });
        $('#vits_dim_emotion').on('change', () => { this.onSettingsChange(); });
        $('#vits_sdp_ratio').on('change', () => { this.onSettingsChange(); });
        $('#vits_emotion').on('change', () => { this.onSettingsChange(); });
        $('#vits_text_prompt').on('change', () => { this.onSettingsChange(); });
        $('#vits_style_text').on('change', () => { this.onSettingsChange(); });
        $('#vits_style_weight').on('change', () => { this.onSettingsChange(); });

        await this.checkReady();

        console.info('VITS: Settings loaded');
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

    async getVoiceById(voiceId) {
        if (this.voices.length == 0) {
            this.voices = await this.fetchTtsVoiceObjects();
        }
        const match = this.voices.filter(
            v => v.voice_id == voiceId,
        )[0];
        if (!match) {
            throw `TTS Voice id ${voiceId} not found`;
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
        const response = await fetch(`${this.settings.provider_endpoint}/voice/speakers`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.json()}`);
        }
        const jsonData = await response.json();
        const voices = [];

        const addVoices = (modelType) => {
            jsonData[modelType].forEach(voice => {
                voices.push({
                    name: `[${modelType}] ${voice.name} (${voice.lang})`,
                    voice_id: `${modelType}&${voice.id}`,
                    preview_url: false,
                    lang: voice.lang,
                });
            });
        };
        for (const key in this.modelTypes) {
            addVoices(this.modelTypes[key]);
        }

        this.voices = voices; // Assign to the class property
        return voices; // Also return this list
    }

    // Each time a parameter is changed, we change the configuration
    async changeTTSSettings() {
    }

    /**
     * Fetch TTS generation from the API.
     * @param {string} inputText Text to generate TTS for
     * @param {string} voiceId Voice ID to use (model_type&speaker_id))
     * @returns {Promise<Response|string>} Fetch response
     */
    async fetchTtsGeneration(inputText, voiceId, lang = null, forceNoStreaming = false) {
        console.info(`Generating new TTS for voice_id ${voiceId}`);

        const streaming = !forceNoStreaming && this.settings.streaming;
        const [model_type, speaker_id] = voiceId.split('&');
        const params = new URLSearchParams();
        params.append('text', inputText);
        params.append('id', speaker_id);
        if (streaming) {
            params.append('streaming', streaming);
            // Streaming response only supports MP3
        }
        else {
            params.append('format', this.settings.format);
        }
        params.append('lang', lang ?? this.settings.lang);
        params.append('length', this.settings.length);
        params.append('noise', this.settings.noise);
        params.append('noisew', this.settings.noisew);
        params.append('segment_size', this.settings.segment_size);

        if (model_type == this.modelTypes.W2V2_VITS) {
            params.append('emotion', this.settings.dim_emotion);
        }
        else if (model_type == this.modelTypes.BERT_VITS2) {
            params.append('sdp_ratio', this.settings.sdp_ratio);
            params.append('emotion', this.settings.emotion);
            if (this.settings.text_prompt) {
                params.append('text_prompt', this.settings.text_prompt);
            }
            if (this.settings.style_text) {
                params.append('style_text', this.settings.style_text);
                params.append('style_weight', this.settings.style_weight);
            }
        }

        const url = `${this.settings.provider_endpoint}/voice/${model_type.toLowerCase()}`;

        if (streaming) {
            return url + `?${params.toString()}`;
        }

        const response = await fetch(
            url,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: params,
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
        const voice = await this.getVoiceById(id);
        const lang = voice.lang.includes(this.settings.lang) ? this.settings.lang : voice.lang[0];

        let lang_code = this.langKey2LangCode[lang];
        const text = getPreviewString(lang_code);
        const response = await this.fetchTtsGeneration(text, id, lang, true);
        if (typeof response != 'string') {
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }
            const audio = await response.blob();
            const url = URL.createObjectURL(audio);
            this.audioElement.src = url;
            this.audioElement.play();
        }
    }

    // Interface not used
    async fetchTtsFromHistory(history_item_id) {
        return Promise.resolve(history_item_id);
    }
}
