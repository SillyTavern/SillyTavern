import { event_types, eventSource, getRequestHeaders } from '../../../script.js';
import { SECRET_KEYS, secret_state } from '../../secrets.js';
import { getPreviewString, saveTtsProviderSettings } from './index.js';

export { GandrTtsProvider };

class GandrTtsProvider {
    settings;
    voices = [];
    separator = ' . ';

    audioElement = document.createElement('audio');

    defaultSettings = {
        voiceMap: {},
        model: 'tts-1',
        speed: 1,
    };

    get settingsHtml() {
        let html = `
        <div class="flex-container alignItemsCenter">
            <div class="flex1">Gandr TTS API</div>
            <div id="gandr_tts_key" class="menu_button menu_button_icon manage-api-keys" data-key="api_key_gandr">
                <i class="fa-solid fa-key"></i>
                <span>API Key</span>
            </div>
        </div>
        <div class="flex-container flexFlowColumn">
            <div class="flex1">
                <label for="gandr_tts_model">Model</label>
                <select id="gandr_tts_model" class="text_pole"></select>
            </div>
            <div>
                <label for="gandr_tts_speed">Speed <span id="gandr_tts_speed_output"></span></label>
                <input type="range" id="gandr_tts_speed" value="1" min="0.25" max="4" step="0.05">
            </div>
        </div>`;
        return html;
    }

    constructor() {
        this.handler = async function (/** @type {string} */ key) {
            if (key !== SECRET_KEYS.GANDR) return;
            $('#gandr_tts_key').toggleClass('success', !!secret_state[SECRET_KEYS.GANDR]);
            await this.onRefreshClick();
        }.bind(this);
    }

    dispose() {
        [event_types.SECRET_WRITTEN, event_types.SECRET_DELETED, event_types.SECRET_ROTATED].forEach(event => {
            eventSource.removeListener(event, this.handler);
        });
    }

    onSettingsChange() {
        this.settings.model = $('#gandr_tts_model').val();
        this.settings.speed = Number($('#gandr_tts_speed').val());
        saveTtsProviderSettings();
    }

    async loadSettings(settings) {
        if (Object.keys(settings).length === 0) {
            Object.assign(settings, this.defaultSettings);
        }

        this.settings = settings;

        if (!this.settings.voiceMap) {
            this.settings.voiceMap = {};
        }

        // Update UI
        $('#gandr_tts_model').val(this.settings.model);
        $('#gandr_tts_speed').val(this.settings.speed);
        $('#gandr_tts_speed_output').text(this.settings.speed);

        $('#gandr_tts_key').toggleClass('success', !!secret_state[SECRET_KEYS.GANDR]);
        [event_types.SECRET_WRITTEN, event_types.SECRET_DELETED, event_types.SECRET_ROTATED].forEach(event => {
            eventSource.on(event, this.handler);
        });

        await this.checkReady();

        $('#gandr_tts_model').on('change', () => this.onSettingsChange());
        $('#gandr_tts_speed').on('input', () => {
            const value = $('#gandr_tts_speed').val();
            $('#gandr_tts_speed_output').text(String(value));
            this.onSettingsChange();
        });
    }

    async checkReady() {
        await this.updateModels();
        await this.updateVoices();
    }

    async onRefreshClick() {
        return await this.checkReady();
    }

    async updateModels() {
        // Gandr currently exposes a single OpenAI compatible speech model.
        $('#gandr_tts_model').empty();
        $('#gandr_tts_model').append($('<option>').val('tts-1').text('tts-1'));
        $('#gandr_tts_model').val('tts-1');

        this.settings.model = 'tts-1';
    }

    async updateVoices() {
        const gandrVoices = [
            { id: 'gandr-mia', name: 'Mia' },
            { id: 'gandr-ava', name: 'Ava' },
            { id: 'gandr-jenny', name: 'Jenny' },
            { id: 'gandr-dane', name: 'Dane' },
            { id: 'gandr-leo', name: 'Leo' },
            { id: 'gandr-lewis', name: 'Lewis' },
        ];

        this.voices = gandrVoices.map(v => ({
            name: v.name,
            voice_id: v.id,
            lang: 'en-US',
        }));
    }

    async getVoice(voiceName) {
        if (this.voices.length === 0) {
            await this.updateVoices();
        }
        const voice = this.voices.find(v => v.name === voiceName || v.voice_id === voiceName);
        return voice || this.voices.find(v => v.voice_id === 'gandr-mia');
    }

    async generateTts(text, voiceId) {
        const response = await this.fetchTtsGeneration(text, voiceId);
        return response;
    }

    async fetchTtsGeneration(text, voiceId) {
        if (!secret_state[SECRET_KEYS.GANDR]) {
            throw new Error('No Gandr API key found');
        }

        const response = await fetch('/api/openai/gandr/generate-voice', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                model: this.settings.model || 'tts-1',
                input: text,
                voice: voiceId || 'gandr-mia',
                speed: this.settings.speed || 1,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Gandr TTS failed: ${error}`);
        }

        return response;
    }

    async fetchTtsVoiceObjects() {
        if (this.voices.length === 0) {
            await this.updateVoices();
        }

        return this.voices.map(voice => ({ name: voice.name, voice_id: voice.voice_id, preview_url: false }));
    }

    async previewTtsVoice(voiceId) {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;

        const text = getPreviewString('en-US');
        const response = await this.fetchTtsGeneration(text, voiceId);

        const audio = await response.blob();
        const url = URL.createObjectURL(audio);
        this.audioElement.src = url;
        this.audioElement.play();
        this.audioElement.onended = () => URL.revokeObjectURL(url);
    }
}
