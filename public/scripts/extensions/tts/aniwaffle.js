import { event_types, eventSource, getRequestHeaders } from '../../../script.js';
import { SECRET_KEYS, secret_state } from '../../secrets.js';
import { getPreviewString, saveTtsProviderSettings } from './index.js';

export { AniwaffleTtsProvider };

class AniwaffleTtsProvider {
    settings;
    voices = [];
    separator = ' . ';

    audioElement = document.createElement('audio');

    defaultSettings = {
        voiceMap: {},
        model: '',
    };

    get settingsHtml() {
        return `
        <div class="flex-container alignItemsCenter">
            <small class="flex1">Japanese speech. Get an API key at <a href="https://aniwaffle.com" target="_blank">aniwaffle.com</a>.</small>
            <div id="aniwaffle_tts_key" class="menu_button menu_button_icon manage-api-keys" data-key="api_key_aniwaffle">
                <i class="fa-solid fa-key"></i>
                <span>API Key</span>
            </div>
        </div>
        <label for="aniwaffle_tts_model">Model:</label>
        <select id="aniwaffle_tts_model"></select>`;
    }

    constructor() {
        this.handler = async function (/** @type {string} */ key) {
            if (key !== SECRET_KEYS.ANIWAFFLE) return;
            $('#aniwaffle_tts_key').toggleClass('success', !!secret_state[SECRET_KEYS.ANIWAFFLE]);
            await this.onRefreshClick();
        }.bind(this);
    }

    dispose() {
        [event_types.SECRET_WRITTEN, event_types.SECRET_DELETED, event_types.SECRET_ROTATED].forEach(event => {
            eventSource.removeListener(event, this.handler);
        });
    }

    async loadSettings(settings) {
        this.settings = { ...this.defaultSettings };
        for (const key in settings) {
            if (key in this.settings) {
                this.settings[key] = settings[key];
            } else {
                throw `Invalid setting passed to TTS Provider: ${key}`;
            }
        }

        $('#aniwaffle_tts_model').on('change', () => {
            this.settings.model = String($('#aniwaffle_tts_model').val());
            saveTtsProviderSettings();
        });

        $('#aniwaffle_tts_key').toggleClass('success', !!secret_state[SECRET_KEYS.ANIWAFFLE]);
        [event_types.SECRET_WRITTEN, event_types.SECRET_DELETED, event_types.SECRET_ROTATED].forEach(event => {
            eventSource.on(event, this.handler);
        });

        await this.checkReady();
    }

    async checkReady() {
        await this.onRefreshClick();
    }

    async onRefreshClick() {
        if (!secret_state[SECRET_KEYS.ANIWAFFLE]) return;
        const [voices, models] = await Promise.all([this.fetchList('voices'), this.fetchList('models')]);
        this.voices = voices.map(voice => ({ name: voice.name, voice_id: voice.id, lang: 'ja-JP' }));
        $('#aniwaffle_tts_model').empty().append(models.map(model => new Option(model.name, model.id)));
        if (!models.some(model => model.id === this.settings.model)) {
            this.settings.model = models[0]?.id ?? '';
        }
        $('#aniwaffle_tts_model').val(this.settings.model);
    }

    async fetchList(name) {
        const response = await fetch(`/api/aniwaffle/${name}`, { method: 'POST', headers: getRequestHeaders() });
        if (!response.ok) {
            throw new Error(`Failed to load Aniwaffle ${name}: HTTP ${response.status}`);
        }
        return response.json();
    }

    async fetchTtsVoiceObjects() {
        if (this.voices.length == 0) await this.onRefreshClick();
        return this.voices;
    }

    async getVoice(voiceName) {
        const match = (await this.fetchTtsVoiceObjects()).find(voice => voice.name == voiceName);
        if (!match) {
            throw `TTS Voice name ${voiceName} not found`;
        }
        return match;
    }

    async generateTts(text, voiceId) {
        return this.fetchTtsGeneration(text, voiceId);
    }

    async previewTtsVoice(voiceId) {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;

        const response = await this.fetchTtsGeneration(getPreviewString('ja-JP'), voiceId);
        const url = URL.createObjectURL(await response.blob());
        this.audioElement.src = url;
        this.audioElement.play();
        this.audioElement.onended = () => URL.revokeObjectURL(url);
    }

    async fetchTtsGeneration(text, voiceId) {
        const response = await fetch('/api/aniwaffle/generate-voice', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ text, voice: voiceId, model: this.settings.model }),
        });
        if (!response.ok) {
            toastr.error(response.statusText, 'TTS Generation Failed');
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        return response;
    }
}
