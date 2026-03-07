import { getPreviewString, initVoiceMap, saveTtsProviderSettings } from './index.js';
import { event_types, eventSource, getRequestHeaders } from '../../../script.js';
import { SECRET_KEYS, secret_state } from '../../secrets.js';
import { getBase64Async } from '../../utils.js';

export { CambAiTtsProvider };

class CambAiTtsProvider {
    settings;
    voices = [];
    separator = ' . ';
    audioElement = document.createElement('audio');

    defaultSettings = {
        voiceMap: {},
        model: 'mars-flash',
        language: 'en-us',
        format: 'mp3',
    };

    get settingsHtml() {
        return `
        <div class="cambai_tts_settings">
            <div class="tts_block justifyCenter">
                <div id="api_key_cambai" class="menu_button menu_button_icon manage-api-keys" data-key="api_key_cambai">
                    <i class="fa-solid fa-key"></i>
                    <span>Click to set API Key</span>
                </div>
            </div>
            <div class="tts_block">
                <label for="cambai_tts_model">Model</label>
                <select id="cambai_tts_model" class="text_pole">
                    <option value="mars-flash">MARS Flash (Fastest)</option>
                    <option value="mars-pro">MARS Pro (Balanced)</option>
                    <option value="mars-instruct">MARS Instruct (Most Expressive)</option>
                </select>
            </div>
            <div class="tts_block">
                <label for="cambai_tts_language">Language</label>
                <select id="cambai_tts_language" class="text_pole">
                    <option value="en-us">English (US)</option>
                    <option value="en-uk">English (UK)</option>
                    <option value="en-au">English (AU)</option>
                    <option value="en-in">English (IN)</option>
                    <option value="fr-fr">French</option>
                    <option value="fr-ca">French (CA)</option>
                    <option value="fr-be">French (BE)</option>
                    <option value="fr-ch">French (CH)</option>
                    <option value="de-de">German</option>
                    <option value="de-at">German (AT)</option>
                    <option value="de-ch">German (CH)</option>
                    <option value="es-es">Spanish</option>
                    <option value="es-mx">Spanish (MX)</option>
                    <option value="es-us">Spanish (US)</option>
                    <option value="it-it">Italian</option>
                    <option value="pt-br">Portuguese (BR)</option>
                    <option value="pt-pt">Portuguese (PT)</option>
                    <option value="nl-nl">Dutch</option>
                    <option value="nl-be">Dutch (BE)</option>
                    <option value="ja-jp">Japanese</option>
                    <option value="ko-kr">Korean</option>
                    <option value="zh-cn">Chinese (Simplified)</option>
                    <option value="zh-tw">Chinese (Traditional)</option>
                    <option value="zh-hk">Chinese (HK)</option>
                    <option value="hi-in">Hindi</option>
                    <option value="ru-ru">Russian</option>
                    <option value="tr-tr">Turkish</option>
                    <option value="pl-pl">Polish</option>
                    <option value="uk-ua">Ukrainian</option>
                    <option value="ro-ro">Romanian</option>
                    <option value="el-gr">Greek</option>
                    <option value="cs-cz">Czech</option>
                    <option value="fi-fi">Finnish</option>
                    <option value="th-th">Thai</option>
                    <option value="vi-vn">Vietnamese</option>
                    <option value="id-id">Indonesian</option>
                    <option value="ar-sa">Arabic (SA)</option>
                    <option value="ar-eg">Arabic (EG)</option>
                    <option value="bn-bd">Bengali (BD)</option>
                    <option value="bn-in">Bengali (IN)</option>
                    <option value="ta-in">Tamil</option>
                    <option value="te-in">Telugu</option>
                    <option value="ml-in">Malayalam</option>
                    <option value="mr-in">Marathi</option>
                    <option value="kn-in">Kannada</option>
                    <option value="pa-in">Punjabi</option>
                    <option value="as-in">Assamese</option>
                </select>
            </div>
            <div class="tts_block">
                <label for="cambai_tts_format">Audio Format</label>
                <select id="cambai_tts_format" class="text_pole">
                    <option value="mp3">MP3</option>
                    <option value="wav">WAV</option>
                    <option value="flac">FLAC</option>
                </select>
            </div>
            <div class="tts_block">
                <input id="cambai_refresh" class="menu_button" type="button" value="Refresh Voices" />
            </div>
        </div>
        `;
    }

    constructor() {
        this.handler = async function (/** @type {string} */ key) {
            if (key !== SECRET_KEYS.CAMBAI) return;
            $('#api_key_cambai').toggleClass('success', !!secret_state[SECRET_KEYS.CAMBAI]);
            await this.onRefreshClick();
        }.bind(this);
    }

    dispose() {
        [event_types.SECRET_WRITTEN, event_types.SECRET_DELETED, event_types.SECRET_ROTATED].forEach(event => {
            eventSource.removeListener(event, this.handler);
        });
    }

    onSettingsChange() {
        this.settings.model = $('#cambai_tts_model').val();
        this.settings.language = $('#cambai_tts_language').val() || 'en-us';
        this.settings.format = $('#cambai_tts_format').val();
        saveTtsProviderSettings();
    }

    async loadSettings(settings) {
        if (Object.keys(settings).length === 0) {
            console.info('Using default CAMB AI TTS Provider settings');
        }

        this.settings = { ...this.defaultSettings };
        for (const key in settings) {
            if (key in this.settings) {
                this.settings[key] = settings[key];
            }
        }

        $('#cambai_tts_model').val(this.settings.model);
        $('#cambai_tts_language').val(this.settings.language || 'en-us');
        $('#cambai_tts_format').val(this.settings.format);

        $('#cambai_tts_model').on('change', this.onSettingsChange.bind(this));
        $('#cambai_tts_language').on('change', this.onSettingsChange.bind(this));
        $('#cambai_tts_format').on('change', this.onSettingsChange.bind(this));
        $('#cambai_refresh').on('click', () => this.onRefreshClick());

        $('#api_key_cambai').toggleClass('success', !!secret_state[SECRET_KEYS.CAMBAI]);
        [event_types.SECRET_WRITTEN, event_types.SECRET_DELETED, event_types.SECRET_ROTATED].forEach(event => {
            eventSource.on(event, this.handler);
        });

        try {
            await initVoiceMap();
        } catch (error) {
            console.debug('CAMB AI: Voice map initialization failed, but continuing');
        }

        if (secret_state[SECRET_KEYS.CAMBAI]) {
            try {
                await this.checkReady();
                console.debug('CAMB AI TTS: Settings loaded and ready');
            } catch (error) {
                console.debug('CAMB AI TTS: Settings loaded, but not ready:', error);
            }
        }
    }

    async checkReady() {
        if (!secret_state[SECRET_KEYS.CAMBAI]) {
            throw new Error('CAMB AI API key is required');
        }
        await this.fetchTtsVoiceObjects();
    }

    async onRefreshClick() {
        try {
            this.voices = await this.fetchTtsVoiceObjects();
            await initVoiceMap();
            toastr.success('CAMB AI TTS: Voices refreshed successfully');
        } catch (error) {
            toastr.error(`CAMB AI TTS: Failed to refresh - ${error.message}`);
        }
    }

    async getVoice(voiceName) {
        if (!voiceName) {
            throw new Error('TTS Voice name not provided');
        }

        if (!this.voices || this.voices.length === 0) {
            this.voices = await this.fetchTtsVoiceObjects();
        }

        const voice = this.voices.find(v => v.voice_id === voiceName || v.name === voiceName);
        if (!voice) {
            throw new Error(`TTS Voice not found: ${voiceName}`);
        }

        return voice;
    }

    async generateTts(text, voiceId) {
        const response = await fetch('/api/cambai/generate-voice', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                text: text,
                voiceId: voiceId,
                model: this.settings.model,
                language: this.settings.language,
                format: this.settings.format,
            }),
        });

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}`;
            try {
                const errorData = await response.json();
                errorMessage = errorData.error || errorMessage;
            } catch {
                // ignore
            }
            toastr.error(errorMessage, 'CAMB AI TTS Generation Failed');
            throw new Error(errorMessage);
        }

        return response;
    }

    async fetchTtsVoiceObjects() {
        if (!secret_state[SECRET_KEYS.CAMBAI]) {
            return [];
        }

        const response = await fetch('/api/cambai/voices', {
            method: 'POST',
            headers: getRequestHeaders(),
        });

        if (!response.ok) {
            throw new Error(`Failed to fetch voices: HTTP ${response.status}`);
        }

        const data = await response.json();

        // Map API response to the expected format {name, voice_id, lang}
        if (Array.isArray(data)) {
            this.voices = data.map(voice => ({
                name: voice.voice_name || voice.name || `Voice ${voice.id}`,
                voice_id: String(voice.id || voice.voice_id),
                lang: voice.language || voice.lang || 'en-US',
            }));
        } else {
            this.voices = [];
        }

        return this.voices;
    }

    async previewTtsVoice(voiceId) {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;

        try {
            const voice = await this.getVoice(voiceId);
            const text = getPreviewString(voice.lang || 'en-US');
            const response = await this.generateTts(text, voiceId);
            const audio = await response.blob();
            const srcUrl = await getBase64Async(audio);

            this.audioElement.src = srcUrl;
            await this.audioElement.play();
        } catch (error) {
            console.error('CAMB AI TTS Preview Error:', error);
            toastr.error(`Could not generate preview: ${error.message}`);
        }
    }
}
