import { event_types, eventSource, getRequestHeaders } from '../../../script.js';
import { SECRET_KEYS, secret_state } from '../../secrets.js';
import { saveTtsProviderSettings } from './index.js';

export { VolcengineTtsProvider };

class VolcengineTtsProvider {
    settings;
    audioElement = document.createElement('audio');
    defaultSettings = {
        resource_id: '',
        voice: '',
        speed: 0,
        provider_endpoint: 'https://openspeech.bytedance.com/api/v3/tts/unidirectional',
    };

    processText(text) {
        return text;
    }

    constructor() {
        this.handler = async function (/** @type {string} */ key) {
            if (![SECRET_KEYS.VOLCENGINE_APP_ID, SECRET_KEYS.VOLCENGINE_ACCESS_KEY].includes(key)) return;
            $('#volcengine-tts-app-id').toggleClass('success', !!secret_state[SECRET_KEYS.VOLCENGINE_APP_ID]);
            $('#volcengine-tts-access-key').toggleClass('success', !!secret_state[SECRET_KEYS.VOLCENGINE_ACCESS_KEY]);
            await this.onRefreshClick();
        }.bind(this);
    }

    dispose() {
        [event_types.SECRET_WRITTEN, event_types.SECRET_DELETED, event_types.SECRET_ROTATED].forEach(event => {
            eventSource.removeListener(event, this.handler);
        });
    }

    async previewTtsVoice(_) {
        const text = 'Hello! Nice to meet you!';
        const audio = await this.generateTts(text, this.settings.voice);
        const audioElement = new Audio(URL.createObjectURL(await audio.blob()));
        audioElement.play().catch(e => console.error('Error playing audio:', e));
    }

    async fetchTtsVoiceObjects() {
        return [{
            name: this.settings.voice,
            voice_id: this.settings.voice,
            lang: 'cl',
        }];
    }

    get settingsHtml() {
        let html = `
            <div>Volcengine (Doubao) TTS Configuration.</div>
            <small>Hint: Volcengine (Doubao) TTS configuration items.</small>
            <small>Please refer to the <a href="https://www.volcengine.com/docs/6561/1598757" target="_blank">documentation</a> to obtain the configuration items.</small>
            <div class="flex-container alignItemsCenter">
                <div id="volcengine-tts-app-id" class="menu_button menu_button_icon manage-api-keys" data-key="volcengine_app_id">
                    <i class="fa-solid fa-key"></i>
                    <span>App ID</span>
                </div>
                <div id="volcengine-tts-access-key" class="menu_button menu_button_icon manage-api-keys" data-key="volcengine_access_key">
                    <i class="fa-solid fa-key"></i>
                    <span>Access Key</span>
                </div>
            </div>
            <div>
                <label for="volcengine-tts-resource-id">Resource ID:</label>
                <input type="text" class="text_pole" id="volcengine-tts-resource-id">
            </div>
            <div>
                <label data-i18n="volcengine-tts-voice" for="volcengine-tts-voice">Voice (Speaker):</label>
                <input type="text" class="text_pole" id="volcengine-tts-voice">
            </div>
            <div>
                <label for="volcengine-tts-speed">Speed:</label>
                <div class="flex-container">
                    <div class="range-block-range" style="flex: 5;">
                        <input type="range" id="volcengine-tts-speed" min="-50" max="100" step="1">
                    </div>
                    <div class="range-block-counter">
                        <input type="number" min="-50" max="100" step="1" data-for="volcengine-tts-speed" id="volcengine-tts-speed_counter" style="width: 80px;">
                    </div>
                </div>
            </div>
            <div>
                <label for="volcengine-tts-provider-endpoint">Provider Endpoint:</label>
                <input type="text" class="text_pole" id="volcengine-tts-provider-endpoint">
            </div>
        `;
        return html;
    }

    async getVoice(voiceName) {
        return {
            name: voiceName,
            voice_id: voiceName,
            lang: 'cl',
        };
    }

    async onRefreshClick() {
        return await this.checkReady();
    }

    onSettingsChange() {
        // Used when provider settings are updated from UI
        this.settings.resource_id = $('#volcengine-tts-resource-id').val();
        this.settings.voice = $('#volcengine-tts-voice').val();
        this.settings.speed = $('#volcengine-tts-speed').val();
        this.settings.provider_endpoint = $('#volcengine-tts-provider-endpoint').val();

        saveTtsProviderSettings();
        this.changeTTSSettings();
    }

    async changeTTSSettings() {
        const speed = this.settings.speed;
        $('#volcengine-tts-speed').val(speed);
        $('#volcengine-tts-speed_counter').val(speed);
    }

    async loadSettings(settings) {
        // Populate Provider UI given input settings
        if (Object.keys(settings).length == 0) {
            console.info('Using default TTS Provider settings');
        }
        // Only accept keys defined in defaultSettings
        this.settings = { ...this.defaultSettings, ...settings };

        // Set initial values from the settings
        $('#volcengine-tts-resource-id').val(this.settings.resource_id).on('change', this.onSettingsChange.bind(this));
        $('#volcengine-tts-voice').val(this.settings.voice).on('change', this.onSettingsChange.bind(this));

        // Speed control - range and number inputs
        const speedInput = $('#volcengine-tts-speed');
        const speedCounter = $('#volcengine-tts-speed_counter');

        speedInput.val(this.settings.speed).on('input change', (e) => {
            const value = $(e.target).val();
            speedCounter.val(value);
            this.settings.speed = value;
            saveTtsProviderSettings();
            this.changeTTSSettings();
        });

        speedCounter.val(this.settings.speed).on('input change', (e) => {
            const value = $(e.target).val();
            speedInput.val(value);
            this.settings.speed = value;
            saveTtsProviderSettings();
            this.changeTTSSettings();
        });

        $('#volcengine-tts-provider-endpoint').val(this.settings.provider_endpoint).on('change', this.onSettingsChange.bind(this));

        // Initialize secret keys UI
        $('#volcengine-tts-app-id').toggleClass('success', !!secret_state[SECRET_KEYS.VOLCENGINE_APP_ID]);
        $('#volcengine-tts-access-key').toggleClass('success', !!secret_state[SECRET_KEYS.VOLCENGINE_ACCESS_KEY]);
        [event_types.SECRET_WRITTEN, event_types.SECRET_DELETED, event_types.SECRET_ROTATED].forEach(event => {
            eventSource.on(event, this.handler);
        });

        await this.checkReady();

        console.info('Volcengine TTS: Settings loaded');
    }

    async checkReady() {
        await Promise.allSettled([this.changeTTSSettings()]);
    }

    async generateTts(text, speaker) {
        const response = await this.fetchTtsGeneration(text, speaker);
        return response;
    }
    async fetchTtsGeneration(text, voice_speaker) {
        console.info(`Generating new TTS for voice_id ${voice_speaker}`);
        const response = await fetch('/api/volcengine/generate-voice', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                'provider_endpoint': this.settings.provider_endpoint,
                'model': 'seed-tts-1.1',
                'resource_id': this.settings.resource_id,
                'text': text,
                'voice_speaker': voice_speaker,
                'speed': this.settings.speed,
            }),
        });
        if (!response.ok) {
            console.error(`HTTP ${response.status}: ${await response.json()}, logid: ${response.headers.get('X-Logid')}`);
            throw new Error(`HTTP ${response.status}: ${await response.json()}`);
        }
        return response;
    }
}
