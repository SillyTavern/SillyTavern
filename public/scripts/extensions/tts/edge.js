import { getRequestHeaders } from '../../../script.js';
import { getApiUrl } from '../../extensions.js';
import { doExtrasFetch, modules } from '../../extensions.js';
import { getPreviewString } from './index.js';
import { saveTtsProviderSettings } from './index.js';

export { EdgeTtsProvider };

const EDGE_TTS_PROVIDER = {
    extras: 'extras',
    plugin: 'plugin',
};

class EdgeTtsProvider {
    //########//
    // Config //
    //########//

    settings;
    voices = [];
    separator = ' . ';
    audioElement = document.createElement('audio');

    defaultSettings = {
        voiceMap: {},
        rate: 0,
        provider: EDGE_TTS_PROVIDER.extras,
    };

    get settingsHtml() {
        let html = `Microsoft Edge TTS<br>
        <label for="edge_tts_provider">Provider</label>
        <select id="edge_tts_provider">
            <option value="${EDGE_TTS_PROVIDER.extras}">Extras</option>
            <option value="${EDGE_TTS_PROVIDER.plugin}">Plugin</option>
        </select>
        <label for="edge_tts_rate">Rate: <span id="edge_tts_rate_output"></span></label>
        <input id="edge_tts_rate" type="range" value="${this.defaultSettings.rate}" min="-100" max="100" step="1" />
        `;
        return html;
    }

    onSettingsChange() {
        this.settings.rate = Number($('#edge_tts_rate').val());
        $('#edge_tts_rate_output').text(this.settings.rate);
        this.settings.provider = String($('#edge_tts_provider').val());
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

        $('#edge_tts_rate').val(this.settings.rate || 0);
        $('#edge_tts_rate_output').text(this.settings.rate || 0);
        $('#edge_tts_rate').on('input', () => { this.onSettingsChange(); });
        $('#edge_tts_provider').val(this.settings.provider || EDGE_TTS_PROVIDER.extras);
        $('#edge_tts_provider').on('change', () => { this.onSettingsChange(); });
        await this.checkReady();

        console.debug('EdgeTTS: Settings loaded');
    }

    /**
    * Perform a simple readiness check by trying to fetch voiceIds
    */
    async checkReady() {
        await this.throwIfModuleMissing();
        await this.fetchTtsVoiceObjects();
    }

    async onRefreshClick() {
        return;
    }

    //#################//
    //  TTS Interfaces //
    //#################//

    /**
     * Get a voice from the TTS provider.
     * @param {string} voiceName Voice name to get
     * @returns {Promise<Object>} Voice object
     */
    async getVoice(voiceName) {
        if (this.voices.length == 0) {
            this.voices = await this.fetchTtsVoiceObjects();
        }
        const match = this.voices.filter(
            voice => voice.name == voiceName,
        )[0];
        if (!match) {
            throw `TTS Voice name ${voiceName} not found`;
        }
        return match;
    }

    /**
     * Generate TTS for a given text.
     * @param {string} text Text to generate TTS for
     * @param {string} voiceId Voice ID to use
     * @returns {Promise<Response>} Fetch response
     */
    async generateTts(text, voiceId) {
        const response = await this.fetchTtsGeneration(text, voiceId);
        return response;
    }

    //###########//
    // API CALLS //
    //###########//
    async fetchTtsVoiceObjects() {
        await this.throwIfModuleMissing();

        const url = this.getVoicesUrl();
        const response = await this.doFetch(url);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        let responseJson = await response.json();
        responseJson = responseJson
            .sort((a, b) => a.Locale.localeCompare(b.Locale) || a.ShortName.localeCompare(b.ShortName))
            .map(x => ({ name: x.ShortName, voice_id: x.ShortName, preview_url: false, lang: x.Locale }));
        return responseJson;
    }

    /**
     * Preview TTS for a given voice ID.
     * @param {string} id Voice ID
     */
    async previewTtsVoice(id) {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
        const voice = await this.getVoice(id);
        const text = getPreviewString(voice.lang);
        const response = await this.fetchTtsGeneration(text, id);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        const audio = await response.blob();
        const url = URL.createObjectURL(audio);
        this.audioElement.src = url;
        this.audioElement.play();
        this.audioElement.onended = () => URL.revokeObjectURL(url);
    }

    /**
     * Fetch TTS generation from the API.
     * @param {string} inputText Text to generate TTS for
     * @param {string} voiceId Voice ID to use
     * @returns {Promise<Response>} Fetch response
     */
    async fetchTtsGeneration(inputText, voiceId) {
        await this.throwIfModuleMissing();

        console.info(`Generating new TTS for voice_id ${voiceId}`);
        const url = this.getGenerateUrl();
        const response = await this.doFetch(url,
            {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({
                    'text': inputText,
                    'voice': voiceId,
                    'rate': Number(this.settings.rate),
                }),
            },
        );
        if (!response.ok) {
            toastr.error(response.statusText, 'TTS Generation Failed');
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        return response;
    }

    /**
     * Perform a fetch request using the configured provider.
     * @param {string} url URL string
     * @param {any} options Request options
     * @returns {Promise<Response>} Fetch response
     */
    doFetch(url, options) {
        if (this.settings.provider === EDGE_TTS_PROVIDER.extras) {
            return doExtrasFetch(url, options);
        }

        if (this.settings.provider === EDGE_TTS_PROVIDER.plugin) {
            return fetch(url, options);
        }

        throw new Error('Invalid TTS Provider');
    }

    /**
     * Get the URL for the TTS generation endpoint.
     * @returns {string} URL string
     */
    getGenerateUrl() {
        if (this.settings.provider === EDGE_TTS_PROVIDER.extras) {
            const url = new URL(getApiUrl());
            url.pathname = '/api/edge-tts/generate';
            return url.toString();
        }

        if (this.settings.provider === EDGE_TTS_PROVIDER.plugin) {
            return '/api/plugins/edge-tts/generate';
        }

        throw new Error('Invalid TTS Provider');
    }

    /**
     * Get the URL for the TTS voices endpoint.
     * @returns {string} URL object or string
     */
    getVoicesUrl() {
        if (this.settings.provider === EDGE_TTS_PROVIDER.extras) {
            const url = new URL(getApiUrl());
            url.pathname = '/api/edge-tts/list';
            return url.toString();
        }

        if (this.settings.provider === EDGE_TTS_PROVIDER.plugin) {
            return '/api/plugins/edge-tts/list';
        }

        throw new Error('Invalid TTS Provider');
    }

    async throwIfModuleMissing() {
        if (this.settings.provider === EDGE_TTS_PROVIDER.extras && !modules.includes('edge-tts')) {
            const message = 'Edge TTS module not loaded. Add edge-tts to enable-modules and restart the Extras API.';
            // toastr.error(message)
            throw new Error(message);
        }

        if (this.settings.provider === EDGE_TTS_PROVIDER.plugin && !this.isPluginAvailable()) {
            const message = 'Edge TTS Server plugin not loaded. Install it from https://github.com/SillyTavern/SillyTavern-EdgeTTS-Plugin and restart the SillyTavern server.';
            // toastr.error(message)
            throw new Error(message);
        }
    }

    async isPluginAvailable() {
        try {
            const result = await fetch('/api/plugins/edge-tts/probe', {
                method: 'POST',
                headers: getRequestHeaders(),
            });
            return result.ok;
        } catch (e) {
            return false;
        }
    }
}

