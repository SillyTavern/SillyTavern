import { event_types, eventSource, getRequestHeaders } from '../../../script.js';
import { SECRET_KEYS, secret_state } from '../../secrets.js';
import { getPreviewString, saveTtsProviderSettings } from './index.js';

export { ChutesTtsProvider };

class ChutesTtsProvider {
    settings;
    voices = [];
    models = [];
    separator = ' . ';

    defaultSettings = {
        voiceMap: {},
        model: 'kokoro',
        speed: 1,
    };

    get settingsHtml() {
        let html = `
        <div class="flex-container alignItemsCenter">
            <div class="flex1">Chutes TTS API</div>
            <div id="chutes_tts_key" class="menu_button menu_button_icon manage-api-keys" data-key="api_key_chutes">
                <i class="fa-solid fa-key"></i>
                <span>API Key</span>
            </div>
        </div>
        <div class="flex-container flexFlowColumn">
            <div class="flex1">
                <label for="chutes_tts_model">Model</label>
                <select id="chutes_tts_model" class="text_pole"></select>
            </div>
            <div>
                <label for="chutes_tts_speed">Speed <span id="chutes_tts_speed_output"></span></label>
                <input type="range" id="chutes_tts_speed" value="1" min="0.25" max="3" step="0.05">
            </div>
        </div>`;
        return html;
    }

    constructor() {
        this.handler = async function (/** @type {string} */ key) {
            if (key !== SECRET_KEYS.CHUTES) return;
            $('#chutes_tts_key').toggleClass('success', !!secret_state[SECRET_KEYS.CHUTES]);
            await this.onRefreshClick();
        }.bind(this);
    }

    dispose() {
        [event_types.SECRET_WRITTEN, event_types.SECRET_DELETED, event_types.SECRET_ROTATED].forEach(event => {
            eventSource.removeListener(event, this.handler);
        });
    }

    onSettingsChange() {
        this.settings.model = $('#chutes_tts_model').val();
        this.settings.speed = Number($('#chutes_tts_speed').val());
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
        $('#chutes_tts_model').val(this.settings.model);
        $('#chutes_tts_speed').val(this.settings.speed);
        $('#chutes_tts_speed_output').text(this.settings.speed);

        $('#chutes_tts_key').toggleClass('success', !!secret_state[SECRET_KEYS.CHUTES]);
        [event_types.SECRET_WRITTEN, event_types.SECRET_DELETED, event_types.SECRET_ROTATED].forEach(event => {
            eventSource.on(event, this.handler);
        });

        await this.checkReady();

        $('#chutes_tts_model').on('change', () => this.onSettingsChange());
        $('#chutes_tts_speed').on('input', () => {
            const value = $('#chutes_tts_speed').val();
            $('#chutes_tts_speed_output').text(String(value));
            this.onSettingsChange();
        });
    }

    async checkReady() {
        await this.updateModels();
        if (this.models.length === 0) {
            // No models available
        }
        await this.updateVoices();
    }

    async onRefreshClick() {
        return await this.checkReady();
    }

    async updateModels() {
        // For Chutes TTS, we always use the Kokoro model currently.
        this.models = ['kokoro'];

        $('#chutes_tts_model').empty();
        $('#chutes_tts_model').append($('<option>').val('kokoro').text('Kokoro'));
        $('#chutes_tts_model').val('kokoro');

        this.settings.model = 'kokoro';
    }

    async updateVoices() {
        // Kokoro voices list
        const kokoroVoices = [
            { id: 'af_alloy', name: 'Alloy (Female)', lang: 'en-US' },
            { id: 'af_aoede', name: 'Aoede (Female)', lang: 'en-US' },
            { id: 'af_bella', name: 'Bella (Female)', lang: 'en-US' },
            { id: 'af_heart', name: 'Heart (Female) - Default', lang: 'en-US' },
            { id: 'af_jessica', name: 'Jessica (Female)', lang: 'en-US' },
            { id: 'af_kore', name: 'Kore (Female)', lang: 'en-US' },
            { id: 'af_nicole', name: 'Nicole (Female)', lang: 'en-US' },
            { id: 'af_nova', name: 'Nova (Female)', lang: 'en-US' },
            { id: 'af_river', name: 'River (Female)', lang: 'en-US' },
            { id: 'af_sarah', name: 'Sarah (Female)', lang: 'en-US' },
            { id: 'af_sky', name: 'Sky (Female)', lang: 'en-US' },
            { id: 'am_adam', name: 'Adam (Male)', lang: 'en-US' },
            { id: 'am_echo', name: 'Echo (Male)', lang: 'en-US' },
            { id: 'am_eric', name: 'Eric (Male)', lang: 'en-US' },
            { id: 'am_fenrir', name: 'Fenrir (Male)', lang: 'en-US' },
            { id: 'am_liam', name: 'Liam (Male)', lang: 'en-US' },
            { id: 'am_michael', name: 'Michael (Male)', lang: 'en-US' },
            { id: 'am_onyx', name: 'Onyx (Male)', lang: 'en-US' },
            { id: 'am_puck', name: 'Puck (Male)', lang: 'en-US' },
            { id: 'am_santa', name: 'Santa (Male)', lang: 'en-US' },
            { id: 'bf_alice', name: 'Alice (British Female)', lang: 'en-GB' },
            { id: 'bf_emma', name: 'Emma (British Female)', lang: 'en-GB' },
            { id: 'bf_isabella', name: 'Isabella (British Female)', lang: 'en-GB' },
            { id: 'bf_lily', name: 'Lily (British Female)', lang: 'en-GB' },
            { id: 'bm_daniel', name: 'Daniel (British Male)', lang: 'en-GB' },
            { id: 'bm_fable', name: 'Fable (British Male)', lang: 'en-GB' },
            { id: 'bm_george', name: 'George (British Male)', lang: 'en-GB' },
            { id: 'bm_lewis', name: 'Lewis (British Male)', lang: 'en-GB' },
            { id: 'ef_dora', name: 'Dora (European Female)', lang: 'es-ES' },
            { id: 'em_alex', name: 'Alex (European Male)', lang: 'es-ES' },
            { id: 'em_santa', name: 'Santa (European Male)', lang: 'es-ES' },
            { id: 'ff_siwis', name: 'Siwis (French Female)', lang: 'fr-FR' },
            { id: 'hf_alpha', name: 'Alpha (Hindi Female)', lang: 'hi-IN' },
            { id: 'hf_beta', name: 'Beta (Hindi Female)', lang: 'hi-IN' },
            { id: 'hm_omega', name: 'Omega (Hindi Male)', lang: 'hi-IN' },
            { id: 'hm_psi', name: 'Psi (Hindi Male)', lang: 'hi-IN' },
            { id: 'if_sara', name: 'Sara (Italian Female)', lang: 'it-IT' },
            { id: 'im_nicola', name: 'Nicola (Italian Male)', lang: 'it-IT' },
            { id: 'jf_alpha', name: 'Alpha (Japanese Female)', lang: 'ja-JP' },
            { id: 'jf_gongitsune', name: 'Gongitsune (Japanese Female)', lang: 'ja-JP' },
            { id: 'jf_nezumi', name: 'Nezumi (Japanese Female)', lang: 'ja-JP' },
            { id: 'jf_tebukuro', name: 'Tebukuro (Japanese Female)', lang: 'ja-JP' },
            { id: 'jm_kumo', name: 'Kumo (Japanese Male)', lang: 'ja-JP' },
            { id: 'pf_dora', name: 'Dora (Portuguese Female)', lang: 'pt-PT' },
            { id: 'pm_alex', name: 'Alex (Portuguese Male)', lang: 'pt-PT' },
            { id: 'pm_santa', name: 'Santa (Portuguese Male)', lang: 'pt-PT' },
            { id: 'zf_xiaobei', name: 'Xiaobei (Chinese Female)', lang: 'zh-CN' },
            { id: 'zf_xiaoni', name: 'Xiaoni (Chinese Female)', lang: 'zh-CN' },
            { id: 'zf_xiaoxiao', name: 'Xiaoxiao (Chinese Female)', lang: 'zh-CN' },
            { id: 'zf_xiaoyi', name: 'Xiaoyi (Chinese Female)', lang: 'zh-CN' },
            { id: 'zm_yunjian', name: 'Yunjian (Chinese Male)', lang: 'zh-CN' },
            { id: 'zm_yunxi', name: 'Yunxi (Chinese Male)', lang: 'zh-CN' },
            { id: 'zm_yunxia', name: 'Yunxia (Chinese Male)', lang: 'zh-CN' },
            { id: 'zm_yunyang', name: 'Yunyang (Chinese Male)', lang: 'zh-CN' },
        ];

        this.voices = kokoroVoices.map(v => ({
            name: v.name,
            voice_id: v.id,
            lang: v.lang,
        }));
    }

    async getVoice(voiceName) {
        if (this.voices.length === 0) {
            await this.updateVoices();
        }
        const voice = this.voices.find(v => v.name === voiceName || v.voice_id === voiceName);
        return voice || this.voices.find(v => v.voice_id === 'af_heart');
    }

    async generateTts(text, voiceId) {
        const response = await this.fetchTtsGeneration(text, voiceId);
        return response;
    }

    async fetchTtsGeneration(text, voiceId) {
        const apiKey = secret_state[SECRET_KEYS.CHUTES];

        if (!apiKey) {
            throw new Error('No Chutes API key found');
        }

        const response = await fetch('/api/openai/chutes/generate-voice', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                input: text,
                voice: voiceId || 'af_heart',
                speed: this.settings.speed || 1,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Chutes TTS failed: ${error}`);
        }

        return response;
    }

    async fetchTtsVoiceObjects() {
        if (this.voices.length === 0) {
            await this.updateVoices();
        }

        const voiceIds = this.voices
            .map(voice => ({ name: voice.name, voice_id: voice.voice_id, preview_url: false }));
        return voiceIds;
    }

    async previewTtsVoice(voiceId) {
        const text = getPreviewString(voiceId);
        await this.generateTts(text, voiceId);
    }
}
