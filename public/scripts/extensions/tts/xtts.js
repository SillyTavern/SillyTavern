import { doExtrasFetch, getApiUrl, modules } from '../../extensions.js';
import { saveTtsProviderSettings } from './index.js';

export { XTTSTtsProvider };

class XTTSTtsProvider {
    //########//
    // Config //
    //########//

    settings;
    ready = false;
    voices = [];
    separator = '. ';

    /**
     * Perform any text processing before passing to TTS engine.
     * @param {string} text Input text
     * @returns {string} Processed text
     */
    processText(text) {
        // Replace fancy ellipsis with "..."
        text = text.replace(/…/g, '...');
        // Remove quotes
        text = text.replace(/["“”‘’]/g, '');
        // Replace multiple "." with single "."
        text = text.replace(/\.+/g, '.');
        return text;
    }

    languageLabels = {
        'Arabic': 'ar',
        'Brazilian Portuguese': 'pt',
        'Chinese': 'zh-cn',
        'Czech': 'cs',
        'Dutch': 'nl',
        'English': 'en',
        'French': 'fr',
        'German': 'de',
        'Italian': 'it',
        'Polish': 'pl',
        'Russian': 'ru',
        'Spanish': 'es',
        'Turkish': 'tr',
        'Japanese': 'ja',
        'Korean': 'ko',
        'Hungarian': 'hu',
        'Hindi': 'hi',
    };

    defaultSettings = {
        provider_endpoint: 'http://localhost:8020',
        language: 'en',
        temperature: 0.75,
        length_penalty: 1.0,
        repetition_penalty: 5.0,
        top_k: 50,
        top_p: 0.85,
        speed: 1,
        enable_text_splitting: true,
        stream_chunk_size: 100,
        voiceMap: {},
        streaming: false,
    };

    get settingsHtml() {
        let html = `
        <label for="xtts_api_language">Language</label>
        <select id="xtts_api_language">`;

        for (let language in this.languageLabels) {
            if (this.languageLabels[language] == this.settings?.language) {
                html += `<option value="${this.languageLabels[language]}" selected="selected">${language}</option>`;
                continue;
            }

            html += `<option value="${this.languageLabels[language]}">${language}</option>`;
        }

        html += `
        </select>
        <label">XTTS Settings:</label><br/>
        <label for="xtts_tts_endpoint">Provider Endpoint:</label>
        <input id="xtts_tts_endpoint" type="text" class="text_pole" maxlength="250" value="${this.defaultSettings.provider_endpoint}"/>
        <span>Use <a target="_blank" href="https://github.com/daswer123/xtts-api-server">XTTSv2 TTS Server</a>.</span>
        <label for="xtts_tts_streaming" class="checkbox_label">
            <input id="xtts_tts_streaming" type="checkbox" />
            <span>Streaming <small>(RVC not supported)</small></span>
        </label>
        <label for="xtts_speed">Speed: <span id="xtts_tts_speed_output">${this.defaultSettings.speed}</span></label>
        <input id="xtts_speed" type="range" value="${this.defaultSettings.speed}" min="0.5" max="2" step="0.01" />

        <label for="xtts_temperature">Temperature: <span id="xtts_tts_temperature_output">${this.defaultSettings.temperature}</span></label>
        <input id="xtts_temperature" type="range" value="${this.defaultSettings.temperature}" min="0.01" max="1" step="0.01" />

        <label for="xtts_length_penalty">Length Penalty: <span id="xtts_length_penalty_output">${this.defaultSettings.length_penalty}</span></label>
        <input id="xtts_length_penalty" type="range" value="${this.defaultSettings.length_penalty}" min="0.5" max="2" step="0.1" />

        <label for="xtts_repetition_penalty">Repetition Penalty: <span id="xtts_repetition_penalty_output">${this.defaultSettings.repetition_penalty}</span></label>
        <input id="xtts_repetition_penalty" type="range" value="${this.defaultSettings.repetition_penalty}" min="1" max="10" step="0.1" />

        <label for="xtts_top_k">Top K: <span id="xtts_top_k_output">${this.defaultSettings.top_k}</span></label>
        <input id="xtts_top_k" type="range" value="${this.defaultSettings.top_k}" min="0" max="100" step="1" />

        <label for="xtts_top_p">Top P: <span id="xtts_top_p_output">${this.defaultSettings.top_p}</span></label>
        <input id="xtts_top_p" type="range" value="${this.defaultSettings.top_p}" min="0" max="1" step="0.01" />

        <label for="xtts_stream_chunk_size">Stream Chunk Size: <span id="xtts_stream_chunk_size_output">${this.defaultSettings.stream_chunk_size}</span></label>
        <input id="xtts_stream_chunk_size" type="range" value="${this.defaultSettings.stream_chunk_size}" min="100" max="400" step="1" />

        <label for="xtts_enable_text_splitting" class="checkbox_label">
            <input id="xtts_enable_text_splitting" type="checkbox" ${this.defaultSettings.enable_text_splitting ? 'checked' : ''} />
            Enable Text Splitting
        </label>
        `;

        return html;
    }

    onSettingsChange() {
        // Used when provider settings are updated from UI
        this.settings.provider_endpoint = $('#xtts_tts_endpoint').val();
        this.settings.language = $('#xtts_api_language').val();

        // Update the default TTS settings based on input fields
        this.settings.speed = $('#xtts_speed').val();
        this.settings.temperature = $('#xtts_temperature').val();
        this.settings.length_penalty = $('#xtts_length_penalty').val();
        this.settings.repetition_penalty = $('#xtts_repetition_penalty').val();
        this.settings.top_k = $('#xtts_top_k').val();
        this.settings.top_p = $('#xtts_top_p').val();
        this.settings.stream_chunk_size = $('#xtts_stream_chunk_size').val();
        this.settings.enable_text_splitting = $('#xtts_enable_text_splitting').is(':checked');
        this.settings.streaming = $('#xtts_tts_streaming').is(':checked');

        // Update the UI to reflect changes
        $('#xtts_tts_speed_output').text(this.settings.speed);
        $('#xtts_tts_temperature_output').text(this.settings.temperature);
        $('#xtts_length_penalty_output').text(this.settings.length_penalty);
        $('#xtts_repetition_penalty_output').text(this.settings.repetition_penalty);
        $('#xtts_top_k_output').text(this.settings.top_k);
        $('#xtts_top_p_output').text(this.settings.top_p);
        $('#xtts_stream_chunk_size_output').text(this.settings.stream_chunk_size);

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
                throw `Invalid setting passed to TTS Provider: ${key}`;
            }
        }

        const apiCheckInterval = setInterval(() => {
            // Use Extras API if TTS support is enabled
            if (modules.includes('tts') || modules.includes('xtts-tts')) {
                const baseUrl = new URL(getApiUrl());
                baseUrl.pathname = '/api/tts';
                this.settings.provider_endpoint = baseUrl.toString();
                $('#xtts_tts_endpoint').val(this.settings.provider_endpoint);
                clearInterval(apiCheckInterval);
            }
        }, 2000);

        // Set initial values from the settings
        $('#xtts_tts_endpoint').val(this.settings.provider_endpoint);
        $('#xtts_api_language').val(this.settings.language);
        $('#xtts_speed').val(this.settings.speed);
        $('#xtts_temperature').val(this.settings.temperature);
        $('#xtts_length_penalty').val(this.settings.length_penalty);
        $('#xtts_repetition_penalty').val(this.settings.repetition_penalty);
        $('#xtts_top_k').val(this.settings.top_k);
        $('#xtts_top_p').val(this.settings.top_p);
        $('#xtts_enable_text_splitting').prop('checked', this.settings.enable_text_splitting);
        $('#xtts_stream_chunk_size').val(this.settings.stream_chunk_size);
        $('#xtts_tts_streaming').prop('checked', this.settings.streaming);

        // Update the UI to reflect changes
        $('#xtts_tts_speed_output').text(this.settings.speed);
        $('#xtts_tts_temperature_output').text(this.settings.temperature);
        $('#xtts_length_penalty_output').text(this.settings.length_penalty);
        $('#xtts_repetition_penalty_output').text(this.settings.repetition_penalty);
        $('#xtts_top_k_output').text(this.settings.top_k);
        $('#xtts_top_p_output').text(this.settings.top_p);
        $('#xtts_stream_chunk_size_output').text(this.settings.stream_chunk_size);

        // Register input/change event listeners to update settings on user interaction
        $('#xtts_tts_endpoint').on('input', () => { this.onSettingsChange(); });
        $('#xtts_api_language').on('change', () => { this.onSettingsChange(); });
        $('#xtts_speed').on('input', () => { this.onSettingsChange(); });
        $('#xtts_temperature').on('input', () => { this.onSettingsChange(); });
        $('#xtts_length_penalty').on('input', () => { this.onSettingsChange(); });
        $('#xtts_repetition_penalty').on('input', () => { this.onSettingsChange(); });
        $('#xtts_top_k').on('input', () => { this.onSettingsChange(); });
        $('#xtts_top_p').on('input', () => { this.onSettingsChange(); });
        $('#xtts_enable_text_splitting').on('change', () => { this.onSettingsChange(); });
        $('#xtts_stream_chunk_size').on('input', () => { this.onSettingsChange(); });
        $('#xtts_tts_streaming').on('change', () => { this.onSettingsChange(); });

        await this.checkReady();

        console.debug('XTTS: Settings loaded');
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
            XTTSVoice => XTTSVoice.name == voiceName,
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
        const response = await doExtrasFetch(`${this.settings.provider_endpoint}/speakers`);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.json()}`);
        }
        const responseJson = await response.json();
        return responseJson;
    }

    // Each time a parameter is changed, we change the configuration
    async changeTTSSettings() {
        if (!this.settings.provider_endpoint) {
            return;
        }

        const response = await doExtrasFetch(
            `${this.settings.provider_endpoint}/set_tts_settings`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',
                },
                body: JSON.stringify({
                    'temperature': this.settings.temperature,
                    'speed': this.settings.speed,
                    'length_penalty': this.settings.length_penalty,
                    'repetition_penalty': this.settings.repetition_penalty,
                    'top_p': this.settings.top_p,
                    'top_k': this.settings.top_k,
                    'enable_text_splitting': this.settings.enable_text_splitting,
                    'stream_chunk_size': this.settings.stream_chunk_size,
                }),
            },
        );
        return response;
    }

    async fetchTtsGeneration(inputText, voiceId) {
        console.info(`Generating new TTS for voice_id ${voiceId}`);

        if (this.settings.streaming) {
            const params = new URLSearchParams();
            params.append('text', inputText);
            params.append('speaker_wav', voiceId);
            params.append('language', this.settings.language);
            return `${this.settings.provider_endpoint}/tts_stream/?${params.toString()}`;
        }

        const response = await doExtrasFetch(
            `${this.settings.provider_endpoint}/tts_to_audio/`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',  // Added this line to disable caching of file so new files are always played - Rolyat 7/7/23
                },
                body: JSON.stringify({
                    'text': inputText,
                    'speaker_wav': voiceId,
                    'language': this.settings.language,
                }),
            },
        );
        if (!response.ok) {
            toastr.error(response.statusText, 'TTS Generation Failed');
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        return response;
    }

    // Interface not used by XTTS TTS
    async fetchTtsFromHistory(history_item_id) {
        return Promise.resolve(history_item_id);
    }

}
