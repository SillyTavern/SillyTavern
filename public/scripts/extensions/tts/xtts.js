import { doExtrasFetch, getApiUrl, modules } from '../../extensions.js';
import { saveTtsProviderSettings } from './index.js';

export { XTTSTtsProvider };

class XTTSTtsProvider {
    //########//
    // Config //
    //########//

    settings;
    ready = false;
    voices = [];
    separator = '. ';

    /**
     * Perform any text processing before passing to TTS engine.
     * @param {string} text Input text
     * @returns {string} Processed text
     */
    processText(text) {
        // Replace fancy ellipsis with "..."
        text = text.replace(/…/g, '...');
        // Remove quotes
        text = text.replace(/["“”‘’]/g, '');
        // Replace multiple "." with single "."
        text = text.replace(/\.+/g, '.');
        return text;
    }

    languageLabels = {
        'Arabic': 'ar',
        'Brazilian Portuguese': 'pt',
        'Chinese': 'zh-cn',
        'Czech': 'cs',
        'Dutch': 'nl',
        'English': 'en',
        'French': 'fr',
        'German': 'de',
        'Italian': 'it',
        'Polish': 'pl',
        'Russian': 'ru',
        'Spanish': 'es',
        'Turkish': 'tr',
        'Japanese': 'ja',
        'Korean': 'ko',
        'Hungarian': 'hu',
        'Hindi': 'hi',
    };

    defaultSettings = {
        provider_endpoint: 'http://localhost:8020',
        language: 'en',
        voiceMap: {},
    };

    get settingsHtml() {
        let html = `
        <label for="xtts_api_language">Language</label>
        <select id="xtts_api_language">`;


        for (let language in this.languageLabels) {

            if (this.languageLabels[language] == this.settings?.language) {
                html += `<option value="${this.languageLabels[language]}" selected="selected">${language}</option>`;
                continue;
            }

            html += `<option value="${this.languageLabels[language]}">${language}</option>`;
        }


        html += `
        </select>
        <label for="xtts_tts_endpoint">Provider Endpoint:</label>
        <input id="xtts_tts_endpoint" type="text" class="text_pole" maxlength="250" value="${this.defaultSettings.provider_endpoint}"/>

        `;

        html += `

        <span>
        <span>Use <a target="_blank" href="https://github.com/daswer123/xtts-api-server">XTTSv2 TTS Server</a>.</span>
        `;

        return html;
    }
    onSettingsChange() {
        // Used when provider settings are updated from UI
        this.settings.provider_endpoint = $('#xtts_tts_endpoint').val();
        this.settings.language = $('#xtts_api_language').val();
        saveTtsProviderSettings();
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
            if (modules.includes('tts') || modules.includes('xtts-tts')) {
                const baseUrl = new URL(getApiUrl());
                baseUrl.pathname = '/api/tts';
                this.settings.provider_endpoint = baseUrl.toString();
                $('#xtts_tts_endpoint').val(this.settings.provider_endpoint);
                clearInterval(apiCheckInterval);
            }
        }, 2000);

        $('#xtts_tts_endpoint').val(this.settings.provider_endpoint);
        $('#xtts_tts_endpoint').on('input', () => { this.onSettingsChange(); });
        $('#xtts_api_language').val(this.settings.language);
        $('#xtts_api_language').on('change', () => { this.onSettingsChange(); });

        await this.checkReady();

        console.debug('XTTS: Settings loaded');
    }

    // Perform a simple readiness check by trying to fetch voiceIds
    async checkReady() {
        await this.fetchTtsVoiceObjects();
    }

    async onRefreshClick() {
        return;
    }

    //#################//
    //  TTS Interfaces //
    //#################//

    async getVoice(voiceName) {
        if (this.voices.length == 0) {
            this.voices = await this.fetchTtsVoiceObjects();
        }
        const match = this.voices.filter(
            XTTSVoice => XTTSVoice.name == voiceName,
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
            `${this.settings.provider_endpoint}/tts_to_audio/`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',  // Added this line to disable caching of file so new files are always played - Rolyat 7/7/23
                },
                body: JSON.stringify({
                    'text': inputText,
                    'speaker_wav': voiceId,
                    'language': this.settings.language,
                }),
            },
        );
        if (!response.ok) {
            toastr.error(response.statusText, 'TTS Generation Failed');
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        return response;
    }

    // Interface not used by XTTS TTS
    async fetchTtsFromHistory(history_item_id) {
        return Promise.resolve(history_item_id);
    }

}
