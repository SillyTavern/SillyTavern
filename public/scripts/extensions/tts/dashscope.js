import { getPreviewString, initVoiceMap, saveTtsProviderSettings } from './index.js';
import { event_types, eventSource, getRequestHeaders } from '../../../script.js';
import { SECRET_KEYS, secret_state } from '../../secrets.js';
import { getBase64Async } from '../../utils.js';

export { DashScopeTtsProvider };

class DashScopeTtsProvider {
    settings;
    voices = [];
    audioElement = document.createElement('audio');

    defaultSettings = {
        apiHost: 'https://dashscope.aliyuncs.com',
        model: 'qwen3-tts-flash',
        format: 'wav',
    };

    static defaultVoices = [
        { name: 'Cherry', voice_id: 'Cherry', lang: 'zh-CN', preview_url: null },
        { name: 'Ryan', voice_id: 'Ryan', lang: 'en-US', preview_url: null },
    ];

    get settingsHtml() {
        return `
        <div class="dashscope_tts_settings">
            <div class="tts_block justifyCenter">
                <div id="api_key_dashscope" class="menu_button menu_button_icon manage-api-keys" data-key="api_key_dashscope">
                    <i class="fa-solid fa-key"></i>
                    <span>Click to set API Key</span>
                </div>
            </div>
            <div class="tts_block">
                <label for="dashscope_tts_api_host">API Host</label>
                <select id="dashscope_tts_api_host" class="text_pole">
                    <option value="https://dashscope.aliyuncs.com">China (Beijing)</option>
                    <option value="https://dashscope-intl.aliyuncs.com">International (Singapore)</option>
                </select>
            </div>
            <div class="tts_block">
                <input id="dashscope_connect" class="menu_button" type="button" value="Test Connection" />
            </div>
            <div class="tts_block">
                <label for="dashscope_tts_model">Model</label>
                <select id="dashscope_tts_model" class="text_pole">
                    <option value="qwen3-tts-flash">qwen3-tts-flash</option>
                </select>
            </div>
            <div class="tts_block">
                <label for="dashscope_tts_format">Audio Format</label>
                <select id="dashscope_tts_format" class="text_pole">
                    <option value="wav">WAV</option>
                </select>
            </div>
        </div>
        `;
    }

    constructor() {
        this.handler = async function (/** @type {string} */ key) {
            if (key !== SECRET_KEYS.DASHSCOPE) return;
            $('#api_key_dashscope').toggleClass('success', !!secret_state[SECRET_KEYS.DASHSCOPE]);
        }.bind(this);
    }

    dispose() {
        [event_types.SECRET_WRITTEN, event_types.SECRET_DELETED, event_types.SECRET_ROTATED].forEach(event => {
            eventSource.removeListener(event, this.handler);
        });
    }

    onSettingsChange() {
        this.settings.apiHost = $('#dashscope_tts_api_host').val();
        this.settings.model = $('#dashscope_tts_model').find(':selected').val();
        this.settings.format = $('#dashscope_tts_format').find(':selected').val();
        saveTtsProviderSettings();
    }

    async loadSettings(settings) {
        if (Object.keys(settings).length === 0) {
            console.info('Using default DashScope TTS Provider settings');
        }

        this.settings = { ...this.defaultSettings };
        for (const key in settings) {
            if (key in this.settings) {
                this.settings[key] = settings[key];
            } else {
                console.warn(`Invalid setting passed to DashScope TTS Provider: ${key}`);
            }
        }

        $('#dashscope_tts_api_host').val(this.settings.apiHost || this.defaultSettings.apiHost);
        $('#dashscope_tts_model').val(this.settings.model || this.defaultSettings.model);
        $('#dashscope_tts_format').val(this.settings.format || this.defaultSettings.format);

        $('#dashscope_tts_api_host').on('change', this.onSettingsChange.bind(this));
        $('#dashscope_tts_model').on('change', this.onSettingsChange.bind(this));
        $('#dashscope_tts_format').on('change', this.onSettingsChange.bind(this));

        $('#dashscope_connect').on('click', () => {
            try {
                this.onTestConnectionClick();
            } catch (error) {
                console.error('DashScope TTS: Error in connect click handler:', error);
                toastr.error(`Connection test failed: ${error.message}`);
            }
        });

        $('#api_key_dashscope').toggleClass('success', !!secret_state[SECRET_KEYS.DASHSCOPE]);
        [event_types.SECRET_WRITTEN, event_types.SECRET_DELETED, event_types.SECRET_ROTATED].forEach(event => {
            eventSource.on(event, this.handler);
        });

        try {
            await initVoiceMap();
        } catch (error) {
            console.debug('DashScope: Voice map init failed, continuing');
        }
    }

    getAllVoices() {
        return [...DashScopeTtsProvider.defaultVoices];
    }

    async getVoice(voiceName) {
        const voices = this.getAllVoices();
        const voice = voices.find(v => v.voice_id === voiceName || v.name === voiceName);
        if (!voice) {
            const error = new Error(`TTS Voice not found: ${voiceName}`);
            console.error('DashScope TTS getVoice error:', error.message);
            throw error;
        }
        return voice;
    }

    mapLanguageToDashScopeType(lang) {
        const languageMap = {
            'zh-CN': 'Chinese',
            'zh-TW': 'Chinese',
            'en-US': 'English',
            'en-GB': 'English',
            'ja-JP': 'Japanese',
            'ko-KR': 'Korean',
            'fr-FR': 'French',
            'de-DE': 'German',
            'es-ES': 'Spanish',
            'pt-BR': 'Portuguese',
            'it-IT': 'Italian',
            'ru-RU': 'Russian',
        };
        return languageMap[lang] || 'Chinese';
    }

    async generateTts(text, voiceId) {
        // Determine language from voice or default
        let languageType = 'Chinese';
        try {
            const voice = await this.getVoice(voiceId);
            languageType = this.mapLanguageToDashScopeType(voice.lang || 'zh-CN');
        } catch (error) {
            console.debug('DashScope TTS: Could not determine voice language, using default');
        }

        return await this.fetchTtsGeneration(text, voiceId, languageType);
    }

    async fetchTtsGeneration(inputText, voiceId, languageType) {
        console.info(`Generating new DashScope TTS for voice ${voiceId}`);

        if (!secret_state[SECRET_KEYS.DASHSCOPE]) {
            const error = new Error('API Key is required');
            console.error('DashScope TTS fetchTtsGeneration error:', error.message);
            throw error;
        }

        const requestBody = {
            text: inputText,
            voiceId: voiceId,
            apiHost: this.settings.apiHost || this.defaultSettings.apiHost,
            model: this.settings.model || this.defaultSettings.model,
            format: this.settings.format || this.defaultSettings.format,
            languageType: languageType,
        };

        try {
            const response = await fetch('/api/dashscope/generate-voice', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                let errorText = await response.text();
                toastr.error(errorText, 'DashScope TTS Generation Failed');
                const error = new Error(errorText || `HTTP ${response.status}`);
                console.error('DashScope TTS fetchTtsGeneration error:', error.message);
                throw error;
            }

            return response;
        } catch (error) {
            console.error('Error in DashScope TTS generation:', error);
            throw error;
        }
    }

    async previewTtsVoice(voiceId) {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;

        try {
            const voice = await this.getVoice(voiceId);
            const previewLang = voice.lang || 'zh-CN';
            const text = getPreviewString(previewLang);
            const languageType = this.mapLanguageToDashScopeType(previewLang);

            const response = await this.fetchTtsGeneration(text, voiceId, languageType);
            if (!response.ok) {
                const errorText = await response.text();
                const error = new Error(`HTTP ${response.status}: ${errorText}`);
                console.error('DashScope TTS previewTtsVoice error:', error.message);
                throw error;
            }

            const audio = await response.blob();
            const srcUrl = await getBase64Async(audio);

            this.audioElement.onended = null;
            this.audioElement.onerror = null;
            this.audioElement.src = srcUrl;

            try {
                await this.audioElement.play();
                console.debug('DashScope TTS: Audio playback started');
            } catch (playError) {
                console.error('DashScope TTS: Play error:', playError);
                throw new Error(`Audio playback failed: ${playError.message}`);
            }

            this.audioElement.onended = () => {
                this.audioElement.onended = null;
                this.audioElement.onerror = null;
            };
        } catch (error) {
            console.error('DashScope TTS Preview Error:', error);
            toastr.error(`Could not generate preview: ${error.message}`);
        }
    }

    async onTestConnectionClick() {
        try {
            const apiHost = this.settings.apiHost || this.defaultSettings.apiHost;
            const model = this.settings.model || this.defaultSettings.model;
            const format = this.settings.format || this.defaultSettings.format;

            console.log(`DashScope TTS: Testing connection to ${apiHost}`);

            // Test by attempting to generate a short piece of audio
            const testText = 'Test';
            const response = await fetch('/api/dashscope/test-connection', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getRequestHeaders(),
                },
                body: JSON.stringify({
                    text: testText,
                    apiHost: apiHost,
                    model: model,
                    format: format,
                    voiceId: 'Cherry',
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorMsg;
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMsg = errorJson.error || `HTTP ${response.status}`;
                } catch (e) {
                    errorMsg = `HTTP ${response.status}: ${errorText}`;
                }

                console.error('DashScope TTS test connection error:', errorMsg);
                throw new Error(errorMsg);
            }

            const result = await response.json();
            const hostLabel = apiHost.includes('intl') ? 'International (Singapore)' : 'China (Beijing)';
            toastr.success(`DashScope TTS: Successfully connected to ${hostLabel}`);
            console.log('DashScope TTS: Connection test passed', result);
        } catch (error) {
            console.error('DashScope TTS: Connection test failed:', error);
            toastr.error(`DashScope TTS: ${error.message}`);
        }
    }
}

