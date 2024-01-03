import { getRequestHeaders, callPopup } from '../../../script.js';
import { splitRecursive } from '../../utils.js';
import { getPreviewString, saveTtsProviderSettings } from './index.js';
import { initVoiceMap } from './index.js';

export { NovelTtsProvider };

class NovelTtsProvider {
    //########//
    // Config //
    //########//

    settings;
    voices = [];
    separator = ' . ';
    audioElement = document.createElement('audio');

    defaultSettings = {
        voiceMap: {},
        customVoices: [],
    };

    /**
     * Perform any text processing before passing to TTS engine.
     * @param {string} text Input text
     * @returns {string} Processed text
     */
    processText(text) {
        // Novel reads tilde as a word. Replace with full stop
        text = text.replace(/~/g, '.');
        return text;
    }

    get settingsHtml() {
        let html = `
        <div class="novel_tts_hints">
            <div>Use NovelAI's TTS engine.</div>
            <div>
                The default Voice IDs are only examples. Add custom voices and Novel will create a new random voice for it.
                Feel free to try different options!
            </div>
            <i>Hint: Save an API key in the NovelAI API settings to use it here.</i>
        </div>
        <label for="tts-novel-custom-voices-add">Custom Voices</label>
        <div class="tts_custom_voices">
            <select id="tts-novel-custom-voices-select"><select>
            <i id="tts-novel-custom-voices-add" class="tts-button fa-solid fa-plus fa-xl success" title="Add"></i>
            <i id="tts-novel-custom-voices-delete" class="tts-button fa-solid fa-xmark fa-xl failure" title="Delete"></i>
        </div>
        `;
        return html;
    }


    // Add a new Novel custom voice to provider
    async addCustomVoice() {
        const voiceName = await callPopup('<h3>Custom Voice name:</h3>', 'input');
        this.settings.customVoices.push(voiceName);
        this.populateCustomVoices();
        initVoiceMap(); // Update TTS extension voiceMap
        saveTtsProviderSettings();
    }

    // Delete selected custom voice from provider
    deleteCustomVoice() {
        const selected = $('#tts-novel-custom-voices-select').find(':selected').val();
        const voiceIndex = this.settings.customVoices.indexOf(selected);

        if (voiceIndex !== -1) {
            this.settings.customVoices.splice(voiceIndex, 1);
        }
        this.populateCustomVoices();
        initVoiceMap(); // Update TTS extension voiceMap
        saveTtsProviderSettings();
    }

    // Create the UI dropdown list of voices in provider
    populateCustomVoices() {
        let voiceSelect = $('#tts-novel-custom-voices-select');
        voiceSelect.empty();
        this.settings.customVoices.forEach(voice => {
            voiceSelect.append(`<option>${voice}</option>`);
        });
    }

    async loadSettings(settings) {
        // Populate Provider UI given input settings
        if (Object.keys(settings).length == 0) {
            console.info('Using default TTS Provider settings');
        }
        $('#tts-novel-custom-voices-add').on('click', () => (this.addCustomVoice()));
        $('#tts-novel-custom-voices-delete').on('click', () => (this.deleteCustomVoice()));

        // Only accept keys defined in defaultSettings
        this.settings = this.defaultSettings;

        for (const key in settings) {
            if (key in this.settings) {
                this.settings[key] = settings[key];
            } else {
                throw `Invalid setting passed to TTS Provider: ${key}`;
            }
        }

        this.populateCustomVoices();
        await this.checkReady();
        console.debug('NovelTTS: Settings loaded');
    }

    // Perform a simple readiness check by trying to fetch voiceIds
    // Doesnt really do much for Novel, not seeing a good way to test this at the moment.
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
        if (!voiceName) {
            throw 'TTS Voice name not provided';
        }

        return { name: voiceName, voice_id: voiceName, lang: 'en-US', preview_url: false };
    }

    async generateTts(text, voiceId) {
        const response = await this.fetchTtsGeneration(text, voiceId);
        return response;
    }

    //###########//
    // API CALLS //
    //###########//
    async fetchTtsVoiceObjects() {
        let voices = [
            { name: 'Ligeia', voice_id: 'Ligeia', lang: 'en-US', preview_url: false },
            { name: 'Aini', voice_id: 'Aini', lang: 'en-US', preview_url: false },
            { name: 'Orea', voice_id: 'Orea', lang: 'en-US', preview_url: false },
            { name: 'Claea', voice_id: 'Claea', lang: 'en-US', preview_url: false },
            { name: 'Lim', voice_id: 'Lim', lang: 'en-US', preview_url: false },
            { name: 'Aurae', voice_id: 'Aurae', lang: 'en-US', preview_url: false },
            { name: 'Naia', voice_id: 'Naia', lang: 'en-US', preview_url: false },
            { name: 'Aulon', voice_id: 'Aulon', lang: 'en-US', preview_url: false },
            { name: 'Elei', voice_id: 'Elei', lang: 'en-US', preview_url: false },
            { name: 'Ogma', voice_id: 'Ogma', lang: 'en-US', preview_url: false },
            { name: 'Raid', voice_id: 'Raid', lang: 'en-US', preview_url: false },
            { name: 'Pega', voice_id: 'Pega', lang: 'en-US', preview_url: false },
            { name: 'Lam', voice_id: 'Lam', lang: 'en-US', preview_url: false },
        ];

        // Add in custom voices to the map
        let addVoices = this.settings.customVoices.map(voice =>
            ({ name: voice, voice_id: voice, lang: 'en-US', preview_url: false }),
        );
        voices = voices.concat(addVoices);

        return voices;
    }


    async previewTtsVoice(id) {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;

        const text = getPreviewString('en-US');
        const response = await this.fetchTtsGeneration(text, id);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const audio = await response.blob();
        const url = URL.createObjectURL(audio);
        this.audioElement.src = url;
        this.audioElement.play();
    }

    async* fetchTtsGeneration(inputText, voiceId) {
        const MAX_LENGTH = 1000;
        console.info(`Generating new TTS for voice_id ${voiceId}`);
        const chunks = splitRecursive(inputText, MAX_LENGTH);
        for (const chunk of chunks) {
            const response = await fetch('/api/novelai/generate-voice',
                {
                    method: 'POST',
                    headers: getRequestHeaders(),
                    body: JSON.stringify({
                        'text': chunk,
                        'voice': voiceId,
                    }),
                },
            );
            if (!response.ok) {
                toastr.error(response.statusText, 'TTS Generation Failed');
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }
            yield response;
        }
    }
}
