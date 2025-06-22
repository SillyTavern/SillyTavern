import { getRequestHeaders } from '../../../script.js';
import { oai_settings } from '../../openai.js';
import { isValidUrl } from '../../utils.js';
import { getPreviewString, saveTtsProviderSettings } from './index.js';


export class GoogleNativeTtsProvider {
    settings;
    voices = [];
    separator = ' . ';
    audioElement = document.createElement('audio');

    defaultSettings = {
        voiceMap: {},
        model: 'gemini-2.5-flash-preview-tts',
        apiType: 'makersuite',
    };

    get settingsHtml() {
        return `
        <small>Hint: Save an API key in the Google AI Studio/Vertex AI connection settings</small>
        <div id="google-native-tts-settings">
            <div>
                <label for="google-tts-api-type">API Type:</label>
                <select id="google-tts-api-type">
                    <option value="makersuite">Google AI Studio (MakerSuite)</option>
                    <option value="vertexai" disabled>Google Vertex AI (unsupported)</option>
                </select>
            </div>
            <div>
                <label for="google-tts-model">Model:</label>
                <select id="google-tts-model">
                    <option value="gemini-2.5-flash-preview-tts">Gemini 2.5 Flash Preview TTS</option>
                    <option value="gemini-2.5-pro-preview-tts">Gemini 2.5 Pro Preview TTS</option>
                </select>
            </div>
        </div>`;
    }

    async loadSettings(settings) {
        if (Object.keys(settings).length === 0) {
            console.info('Using default Google TTS Provider settings');
        }

        this.settings = { ...this.defaultSettings, ...settings };

        $('#google-tts-api-type').val(this.settings.apiType);
        $('#google-tts-model').val(this.settings.model);

        $('#google-tts-api-type, #google-tts-model').on('change', () => this.onSettingsChange());

        try {
            await this.checkReady();
            console.debug('Google TTS: Settings loaded');
        } catch (err) {
            console.warn('Google TTS: Settings loaded, but not ready.', err.message);
        }
    }

    onSettingsChange() {
        this.settings.apiType = $('#google-tts-api-type').val();
        this.settings.model = $('#google-tts-model').val();

        this.voices = []; // Reset voices cache so it re-fetches
        saveTtsProviderSettings();
    }

    async checkReady() {
        await this.fetchTtsVoiceObjects();
    }

    async onRefreshClick() {
        await this.checkReady();
    }

    async getVoice(voiceName) {
        if (this.voices.length === 0) {
            this.voices = await this.fetchTtsVoiceObjects();
        }

        const match = this.voices.find(voice => voice.name === voiceName || voice.voice_id === voiceName);

        if (!match) {
            throw `TTS Voice name ${voiceName} not found`;
        }
        return match;
    }

    async generateTts(text, voiceId) {
        return await this.fetchNativeTtsGeneration(text, voiceId);
    }

    async fetchTtsVoiceObjects() {
        try {
            const response = await fetch('/api/google/list-native-voices', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({}),
            });

            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}: ${response.statusText}`;

                try {
                    const errorJson = await response.json();
                    if (errorJson.error) {
                        errorMessage = errorJson.error;
                    }
                } catch (parseError) {
                    // Response isn't valid JSON, use the HTTP error message
                    console.debug('Error response is not JSON:', parseError.message);
                }

                throw new Error(errorMessage);
            }

            const responseJson = await response.json();

            if (!responseJson.voices || !Array.isArray(responseJson.voices)) {
                throw new Error('Invalid response format: voices array not found');
            }

            this.voices = responseJson.voices;
            console.info(`Google TTS: Loaded ${this.voices.length} voices`);

            return this.voices;

        } catch (error) {
            console.error('Failed to fetch Google TTS voices:', error);
            throw error;
        }
    }

    async previewTtsVoice(id) {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;

        try {
            const voice = await this.getVoice(id);
            const text = getPreviewString(voice.lang || 'en-US');

            const response = await this.fetchNativeTtsGeneration(text, id);

            if (!response.ok) {
                // Error is handled inside the fetch function, but we still need to stop here
                return;
            }

            const audioBlob = await response.blob();
            const url = URL.createObjectURL(audioBlob);
            this.audioElement.src = url;
            this.audioElement.play();
            this.audioElement.onended = () => URL.revokeObjectURL(url);

        } catch (error) {
            console.error('TTS Preview Error:', error);
            toastr.error(`Could not generate preview: ${error.message}`);
        }
    }

    async fetchNativeTtsGeneration(text, voiceId) {
        console.info(`Generating native Google TTS for voice_id ${voiceId}`);
        const useReverseProxy = oai_settings.reverse_proxy && isValidUrl(oai_settings.reverse_proxy);

        const response = await fetch('/api/google/generate-native-tts', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                text: text,
                voice: voiceId,
                model: this.settings.model,
                api: this.settings.apiType,
                reverse_proxy: useReverseProxy ? oai_settings.reverse_proxy : '',
                proxy_password: useReverseProxy ? oai_settings.proxy_password : '',
                vertexai_auth_mode: oai_settings.vertexai_auth_mode,
                vertexai_region: oai_settings.vertexai_region,
                vertexai_express_project_id: oai_settings.vertexai_express_project_id,
            }),
        });

        if (!response.ok) {
            let errorMessage = `HTTP ${response.status}: ${response.statusText}`;
            try {
                const errorJson = await response.json();
                if (errorJson.error) {
                    errorMessage = errorJson.error;
                }
            } catch {
                // Not a JSON response, do nothing and keep the original http error
            }
            throw new Error(errorMessage);
        }
        return response;
    }
}
