import { getRequestHeaders } from '../../../script.js';
import { getPreviewString, saveTtsProviderSettings } from './index.js';

export { OpenAICompatibleTtsProvider };

class OpenAICompatibleTtsProvider {
    settings;
    voices = [];
    separator = ' . ';

    audioElement = document.createElement('audio');

    defaultSettings = {
        voiceMap: {},
        model: 'tts-1',
        speed: 1,
        available_voices: ['alloy', 'echo', 'fable', 'onyx', 'nova', 'shimmer'],
        provider_endpoint: 'http://127.0.0.1:8000/v1/audio/speech',
    };

    get settingsHtml() {
        let html = `
        <label for="openai_compatible_tts_endpoint">Provider Endpoint:</label>
        <input id="openai_compatible_tts_endpoint" type="text" class="text_pole" maxlength="250" value="${this.defaultSettings.provider_endpoint}"/>
        <label for="openai_compatible_model">Model:</label>
        <input id="openai_compatible_model" type="text" class="text_pole" maxlength="250" value="${this.defaultSettings.model}"/>
        <label for="openai_compatible_tts_voices">Available Voices (comma separated):</label>
        <input id="openai_compatible_tts_voices" type="text" class="text_pole" maxlength="250" value="${this.defaultSettings.available_voices.join()}"/>
        <label for="openai_compatible_tts_speed">Speed: <span id="openai_compatible_tts_speed_output"></span></label>
        <input type="range" id="openai_compatible_tts_speed" value="1" min="0.25" max="4" step="0.05">`;
        return html;
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
                throw `Invalid setting passed to TTS Provider: ${key}`;
            }
        }

        $('#openai_compatible_tts_endpoint').val(this.settings.provider_endpoint);
        $('#openai_compatible_tts_endpoint').on('input', () => { this.onSettingsChange(); });

        $('#openai_compatible_model').val(this.defaultSettings.model);
        $('#openai_compatible_model').on('input', () => { this.onSettingsChange(); });

        $('#openai_compatible_tts_voices').val(this.settings.available_voices.join());
        $('#openai_compatible_tts_voices').on('input', () => { this.onSettingsChange(); });

        $('#openai_compatible_tts_speed').val(this.settings.speed);
        $('#openai_compatible_tts_speed').on('input', () => {
            this.onSettingsChange();
        });

        $('#openai_compatible_tts_speed_output').text(this.settings.speed);

        this.refreshSession();

        await this.checkReady();

        console.debug('OpenAI Compatible TTS: Settings loaded');
    }

    onSettingsChange() {
        // Update dynamically
        this.settings.provider_endpoint = String($('#openai_compatible_tts_endpoint').val());
        this.settings.model = String($('#openai_compatible_model').val());
        this.settings.available_voices = $('#openai_compatible_tts_voices').val().split(',');
        this.settings.speed = Number($('#openai_compatible_tts_speed').val());
        $('#openai_compatible_tts_speed_output').text(this.settings.speed);
        saveTtsProviderSettings();
    }

    async checkReady() {
        await this.fetchTtsVoiceObjects();
    }

    async onRefreshClick() {
        return;
    }

    async getVoice(voiceName) {
        if (this.voices.length == 0) {
            this.voices = await this.fetchTtsVoiceObjects();
        }
        const match = this.voices.filter(
            oaicVoice => oaicVoice.name == voiceName,
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

    async fetchTtsVoiceObjects() {
        return this.settings.available_voices.map(v => {
            return { name: v, voice_id: v, lang: 'en-US' };
        });
    }

    async previewTtsVoice(voiceId) {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;

        const text = getPreviewString('en-US');
        const response = await this.fetchTtsGeneration(text, voiceId);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const audio = await response.blob();
        const url = URL.createObjectURL(audio);
        this.audioElement.src = url;
        this.audioElement.play();
        this.audioElement.onended = () => URL.revokeObjectURL(url);
    }

    async fetchTtsGeneration(inputText, voiceId) {
        console.info(`Generating new TTS for voice_id ${voiceId}`);
        const response = await fetch(this.settings.provider_endpoint, {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                'model': this.settings.model,
                'input': inputText,
                'voice': voiceId,
                'response_format': 'mp3',
                'speed': this.settings.speed,
            }),
        });

        if (!response.ok) {
            toastr.error(response.statusText, 'TTS Generation Failed');
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        return response;
    }
}
