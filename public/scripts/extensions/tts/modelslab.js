import { event_types, eventSource, getRequestHeaders } from '../../../script.js';
import { SECRET_KEYS, secret_state } from '../../secrets.js';
import { getPreviewString, saveTtsProviderSettings } from './index.js';

export { ModelsLabTtsProvider };

class ModelsLabTtsProvider {
    settings;
    voices = [];
    separator = ' . ';

    audioElement = document.createElement('audio');

    defaultSettings = {
        voiceMap: {},
        voice_id: 'madison',
        language: 'american english',
        speed: 1,
        emotion: false,
    };

    get settingsHtml() {
        let html = `
        <div class="flex-container alignItemsCenter">
            <div class="flex1">ModelsLab TTS API</div>
            <div id="modelslab_tts_key" class="menu_button menu_button_icon manage-api-keys" data-key="${SECRET_KEYS.MODELSLAB_TTS}">
                <i class="fa-solid fa-key"></i>
                <span>API Key</span>
            </div>
        </div>
        <label for="modelslab_voice_id">Voice ID:</label>
        <input id="modelslab_voice_id" type="text" class="text_pole" maxlength="500" value="${this.defaultSettings.voice_id}" placeholder="e.g. madison"/>
        <label for="modelslab_language">Language:</label>
        <select id="modelslab_language" class="text_pole">
            <option value="american english">American English</option>
            <option value="british english">British English</option>
            <option value="spanish">Spanish</option>
            <option value="french">French</option>
            <option value="japanese">Japanese</option>
            <option value="mandarin chinese">Mandarin Chinese</option>
            <option value="hindi">Hindi</option>
            <option value="italian">Italian</option>
            <option value="brazilian portuguese">Brazilian Portuguese</option>
        </select>
        <label for="modelslab_tts_speed">Speed: <span id="modelslab_tts_speed_output">1</span></label>
        <input type="range" id="modelslab_tts_speed" value="1" min="0.5" max="2" step="0.1">
        <label>
            <input type="checkbox" id="modelslab_emotion">
            Enable Emotion Tags (English only)
        </label>
        <small>Supported tags: &lt;laugh&gt;, &lt;sigh&gt;, &lt;chuckle&gt;, &lt;cough&gt;, &lt;sniffle&gt;, &lt;groan&gt;, &lt;yawn&gt;, &lt;gasp&gt;</small>`;
        return html;
    }

    constructor() {
        this.handler = async function (/** @type {string} */ key) {
            if (key !== SECRET_KEYS.MODELSLAB_TTS) return;
            $('#modelslab_tts_key').toggleClass('success', !!secret_state[SECRET_KEYS.MODELSLAB_TTS]);
        }.bind(this);
    }

    dispose() {
        [event_types.SECRET_WRITTEN, event_types.SECRET_DELETED, event_types.SECRET_ROTATED].forEach(event => {
            eventSource.removeListener(event, this.handler);
        });
    }

    async loadSettings(settings) {
        if (Object.keys(settings).length === 0) {
            Object.assign(settings, this.defaultSettings);
        }

        this.settings = settings;

        if (!this.settings.voiceMap) {
            this.settings.voiceMap = {};
        }

        $('#modelslab_voice_id').val(this.settings.voice_id || this.defaultSettings.voice_id);
        $('#modelslab_language').val(this.settings.language || this.defaultSettings.language);
        $('#modelslab_tts_speed').val(this.settings.speed || 1);
        $('#modelslab_tts_speed_output').text(this.settings.speed || 1);
        $('#modelslab_emotion').prop('checked', !!this.settings.emotion);

        $('#modelslab_voice_id').on('input', () => this.onSettingsChange());
        $('#modelslab_language').on('change', () => this.onSettingsChange());
        $('#modelslab_tts_speed').on('input', () => {
            $('#modelslab_tts_speed_output').text($('#modelslab_tts_speed').val());
            this.onSettingsChange();
        });
        $('#modelslab_emotion').on('change', () => this.onSettingsChange());

        $('#modelslab_tts_key').toggleClass('success', !!secret_state[SECRET_KEYS.MODELSLAB_TTS]);
        [event_types.SECRET_WRITTEN, event_types.SECRET_DELETED, event_types.SECRET_ROTATED].forEach(event => {
            eventSource.on(event, this.handler);
        });

        await this.checkReady();
    }

    onSettingsChange() {
        this.settings.voice_id = String($('#modelslab_voice_id').val());
        this.settings.language = String($('#modelslab_language').val());
        this.settings.speed = parseFloat(String($('#modelslab_tts_speed').val()));
        this.settings.emotion = $('#modelslab_emotion').is(':checked');
        saveTtsProviderSettings();
    }

    async checkReady() {
        await this.fetchTtsVoiceObjects();
    }

    async onRefreshClick() {
        return await this.checkReady();
    }

    async getVoice(voiceName) {
        if (this.voices.length === 0) {
            this.voices = await this.fetchTtsVoiceObjects();
        }
        const match = this.voices.find(v => v.name === voiceName || v.voice_id === voiceName);
        if (!match) {
            throw `TTS Voice name ${voiceName} not found`;
        }
        return match;
    }

    async generateTts(text, voiceId) {
        return await this.fetchTtsGeneration(text, voiceId);
    }

    async fetchTtsVoiceObjects() {
        // Static voice list — ModelsLab does not have a voice listing endpoint
        this.voices = [
            { name: 'madison', voice_id: 'madison', lang: 'en-US', preview_url: false },
            { name: 'leigh', voice_id: 'leigh', lang: 'en-US', preview_url: false },
            { name: 'diana', voice_id: 'diana', lang: 'en-US', preview_url: false },
            { name: 'amy', voice_id: 'amy', lang: 'en-US', preview_url: false },
            { name: 'emma', voice_id: 'emma', lang: 'en-US', preview_url: false },
            { name: 'john', voice_id: 'john', lang: 'en-US', preview_url: false },
            { name: 'james', voice_id: 'james', lang: 'en-US', preview_url: false },
            { name: 'david', voice_id: 'david', lang: 'en-US', preview_url: false },
            { name: 'ryan', voice_id: 'ryan', lang: 'en-US', preview_url: false },
            { name: 'adam', voice_id: 'adam', lang: 'en-US', preview_url: false },
        ];
        return this.voices;
    }

    async previewTtsVoice(voiceId) {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
        const voice = await this.getVoice(voiceId);
        const text = getPreviewString(voice.lang);
        const response = await this.generateTts(text, voiceId);
        const audio = await response.blob();
        const url = URL.createObjectURL(audio);
        this.audioElement.src = url;
        this.audioElement.onended = () => URL.revokeObjectURL(url);
        this.audioElement.play();
    }

    async fetchTtsGeneration(text, voiceId) {
        if (!secret_state[SECRET_KEYS.MODELSLAB_TTS]) {
            throw new Error('ModelsLab API key is not set');
        }

        const response = await fetch('/api/modelslab/generate-voice', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                text: text,
                voice_id: voiceId || this.settings.voice_id,
                language: this.settings.language,
                speed: this.settings.speed,
                emotion: this.settings.emotion,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`ModelsLab TTS failed: ${error}`);
        }

        return response;
    }
}
