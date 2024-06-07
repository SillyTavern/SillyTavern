import { doExtrasFetch, getApiUrl, modules } from '../../extensions.js';
import { saveTtsProviderSettings } from './index.js';

export { SileroTtsProvider };

class SileroTtsProvider {
    //########//
    // Config //
    //########//

    settings;
    ready = false;
    voices = [];
    separator = ' ';

    defaultSettings = {
        provider_endpoint: 'http://localhost:8001/tts',
        voiceMap: {},
    };

    get settingsHtml() {
        let html = `
        <label for="silero_tts_endpoint">Provider Endpoint:</label>
        <input id="silero_tts_endpoint" type="text" class="text_pole" maxlength="250" value="${this.defaultSettings.provider_endpoint}"/>
        <span>
        <span>Use <a target="_blank" href="https://github.com/SillyTavern/SillyTavern-extras">SillyTavern Extras API</a> or <a target="_blank" href="https://github.com/ouoertheo/silero-api-server">Silero TTS Server</a>.</span>
        `;
        return html;
    }

    onSettingsChange() {
        // Used when provider settings are updated from UI
        this.settings.provider_endpoint = $('#silero_tts_endpoint').val();
        saveTtsProviderSettings();
        this.refreshSession();
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
            if (modules.includes('tts') || modules.includes('silero-tts')) {
                const baseUrl = new URL(getApiUrl());
                baseUrl.pathname = '/api/tts';
                this.settings.provider_endpoint = baseUrl.toString();
                $('#silero_tts_endpoint').val(this.settings.provider_endpoint);
                clearInterval(apiCheckInterval);
            }
        }, 2000);

        $('#silero_tts_endpoint').val(this.settings.provider_endpoint);
        $('#silero_tts_endpoint').on('input', () => { this.onSettingsChange(); });
        this.refreshSession();

        await this.checkReady();

        console.debug('SileroTTS: Settings loaded');
    }

    // Perform a simple readiness check by trying to fetch voiceIds
    async checkReady() {
        await this.fetchTtsVoiceObjects();
    }

    async onRefreshClick() {
        return;
    }

    async refreshSession() {
        await this.initSession();
    }

    //#################//
    //  TTS Interfaces //
    //#################//

    async getVoice(voiceName) {
        if (this.voices.length == 0) {
            this.voices = await this.fetchTtsVoiceObjects();
        }
        const match = this.voices.filter(
            sileroVoice => sileroVoice.name == voiceName,
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

    async fetchTtsGeneration(inputText, voiceId) {
        console.info(`Generating new TTS for voice_id ${voiceId}`);
        const response = await doExtrasFetch(
            `${this.settings.provider_endpoint}/generate`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',  // Added this line to disable caching of file so new files are always played - Rolyat 7/7/23
                },
                body: JSON.stringify({
                    'text': inputText,
                    'speaker': voiceId,
                    'session': 'sillytavern',
                }),
            },
        );
        if (!response.ok) {
            toastr.error(response.statusText, 'TTS Generation Failed');
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        return response;
    }

    async initSession() {
        console.info('Silero TTS: requesting new session');
        try {
            const response = await doExtrasFetch(
                `${this.settings.provider_endpoint}/session`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/json',
                        'Cache-Control': 'no-cache',
                    },
                    body: JSON.stringify({
                        'path': 'sillytavern',
                    }),
                },
            );

            if (!response.ok && response.status !== 404) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }
        } catch (error) {
            console.info('Silero TTS: endpoint not available', error);
        }
    }

    // Interface not used by Silero TTS
    async fetchTtsFromHistory(history_item_id) {
        return Promise.resolve(history_item_id);
    }

}
