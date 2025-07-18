import { getRequestHeaders } from '../../../script.js';
import { splitRecursive } from '../../utils.js';
import { getPreviewString, saveTtsProviderSettings } from './index.js';

export class PollinationsTtsProvider {
    settings;
    voices = [];
    separator = ' . ';
    audioElement = document.createElement('audio');

    defaultSettings = {
        // TODO: Make this configurable
        model: 'openai-audio',
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
            console.debug('Pollinations TTS: Settings loaded');
        } catch {
            console.debug('Pollinations TTS: Settings loaded, but not ready');
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

    /**
     * Generate TTS audio for the given text using the specified voice.
     * @param {string} text Text to generate
     * @param {string} voiceId Voice ID
     * @returns {AsyncGenerator<Response>} Audio response generator
     */
    generateTts(text, voiceId) {
        return this.fetchTtsGeneration(text, voiceId);
    }

    //###########//
    // API CALLS //
    //###########//
    async fetchTtsVoiceObjects() {
        const response = await fetch('/api/speech/pollinations/voices', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({ model: this.settings.model }),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        const responseJson = await response.json();
        return responseJson
            .sort()
            .map(x => ({ name: x, voice_id: x, preview_url: false, lang: 'en-US' }));
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
        for await (const response of this.generateTts(text, id)) {
            const audio = await response.blob();
            const url = URL.createObjectURL(audio);
            await new Promise(resolve => {
                const audioElement = new Audio();
                audioElement.src = url;
                audioElement.play();
                audioElement.onended = () => resolve();
            });
            URL.revokeObjectURL(url);
        }
    }

    async* fetchTtsGeneration(text, voiceId) {
        const MAX_LENGTH = 1000;
        console.info(`Generating new TTS for voice_id ${voiceId}`);
        const chunks = splitRecursive(text, MAX_LENGTH);
        for (const chunk of chunks) {
            const response = await fetch('/api/speech/pollinations/generate', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({
                    model: this.settings.model,
                    text: 'Say exactly this and nothing else:' + '\n' + chunk,
                    voice: voiceId,
                }),
            });

            if (!response.ok) {
                toastr.error(response.statusText, 'TTS Generation Failed');
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }

            yield response;
        }
    }
}
