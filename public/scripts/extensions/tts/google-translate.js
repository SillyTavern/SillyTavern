import { getRequestHeaders } from '../../../script.js';
import { splitRecursive } from '../../utils.js';
import { getPreviewString, saveTtsProviderSettings } from './index.js';
export { GoogleTranslateTtsProvider };

class GoogleTranslateTtsProvider {
    settings;
    voices = [];
    separator = ' . ';
    audioElement = document.createElement('audio');

    defaultSettings = {
        region: '',
        voiceMap: {},
    };

    get settingsHtml() {
        return '';
    }

    onSettingsChange() {
        this.voices = [];
        saveTtsProviderSettings();
    }

    async loadSettings(settings) {
        // Populate Provider UI given input settings
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

        try {
            await this.checkReady();
            console.debug('Google Translate TTS: Settings loaded');
        } catch {
            console.debug('Google Translate TTS: Settings loaded, but not ready');
        }
    }

    // Perform a simple readiness check by trying to fetch voiceIds
    async checkReady() {
        await this.fetchTtsVoiceObjects();
    }

    async onRefreshClick() {
        await this.checkReady();
    }

    //#################//
    //  TTS Interfaces //
    //#################//

    async getVoice(voiceName) {
        if (this.voices.length == 0) {
            this.voices = await this.fetchTtsVoiceObjects();
        }
        const match = this.voices.filter(
            voice => voice.name == voiceName || voice.voice_id == voiceName,
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
        const response = await fetch('/api/google/list-voices', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({}),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        let responseJson = await response.json();
        responseJson = Object.entries(responseJson)
            .sort((a, b) => a[1].localeCompare(b[1]))
            .map(x => ({ name: x[1], voice_id: x[0], preview_url: false, lang: x[0] }));
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

    async fetchTtsGeneration(text, voiceId) {
        const response = await fetch('/api/google/generate-voice', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                text: splitRecursive(text, 200),
                voice: voiceId,
            }),
        });

        if (!response.ok) {
            toastr.error(response.statusText, 'TTS Generation Failed');
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        return response;
    }
}
