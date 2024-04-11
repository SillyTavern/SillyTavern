import { getRequestHeaders } from '../../../script.js';
import { saveTtsProviderSettings } from './index.js';

export { OpenAITtsProvider };

class OpenAITtsProvider {
    static voices = [
        { name: 'Alloy', voice_id: 'alloy', lang: 'en-US', preview_url: 'https://cdn.openai.com/API/docs/audio/alloy.wav' },
        { name: 'Echo', voice_id: 'echo', lang: 'en-US', preview_url: 'https://cdn.openai.com/API/docs/audio/echo.wav' },
        { name: 'Fable', voice_id: 'fable', lang: 'en-US', preview_url: 'https://cdn.openai.com/API/docs/audio/fable.wav' },
        { name: 'Onyx', voice_id: 'onyx', lang: 'en-US', preview_url: 'https://cdn.openai.com/API/docs/audio/onyx.wav' },
        { name: 'Nova', voice_id: 'nova', lang: 'en-US', preview_url: 'https://cdn.openai.com/API/docs/audio/nova.wav' },
        { name: 'Shimmer', voice_id: 'shimmer', lang: 'en-US', preview_url: 'https://cdn.openai.com/API/docs/audio/shimmer.wav' },
    ];

    settings;
    voices = [];
    separator = ' . ';
    audioElement = document.createElement('audio');

    defaultSettings = {
        voiceMap: {},
        customVoices: [],
        model: 'tts-1',
        speed: 1,
    };

    get settingsHtml() {
        let html = `
        <div>Use OpenAI's TTS engine.</div>
        <small>Hint: Save an API key in the OpenAI API settings to use it here.</small>
        <div>
            <label for="openai-tts-model">Model:</label>
            <select id="openai-tts-model">
                <optgroup label="Latest">
                    <option value="tts-1">tts-1</option>
                    <option value="tts-1-hd">tts-1-hd</option>
                </optgroup>
                <optgroup label="Snapshots">
                    <option value="tts-1-1106">tts-1-1106</option>
                    <option value="tts-1-hd-1106">tts-1-hd-1106</option>
                </optgroup>
            <select>
        </div>
        <div>
            <label for="openai-tts-speed">Speed: <span id="openai-tts-speed-output"></span></label>
            <input type="range" id="openai-tts-speed" value="1" min="0.25" max="4" step="0.05">
        </div>`;
        return html;
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

        $('#openai-tts-model').val(this.settings.model);
        $('#openai-tts-model').on('change', () => {
            this.onSettingsChange();
        });

        $('#openai-tts-speed').val(this.settings.speed);
        $('#openai-tts-speed').on('input', () => {
            this.onSettingsChange();
        });

        $('#openai-tts-speed-output').text(this.settings.speed);

        await this.checkReady();
        console.debug('OpenAI TTS: Settings loaded');
    }

    onSettingsChange() {
        // Update dynamically
        this.settings.model = String($('#openai-tts-model').find(':selected').val());
        this.settings.speed = Number($('#openai-tts-speed').val());
        $('#openai-tts-speed-output').text(this.settings.speed);
        saveTtsProviderSettings();
    }

    async checkReady() {
        await this.fetchTtsVoiceObjects();
    }

    async onRefreshClick() {
        return;
    }

    async getVoice(voiceName) {
        if (!voiceName) {
            throw 'TTS Voice name not provided';
        }

        const voice = OpenAITtsProvider.voices.find(voice => voice.voice_id === voiceName || voice.name === voiceName);

        if (!voice) {
            throw `TTS Voice not found: ${voiceName}`;
        }

        return voice;
    }

    async generateTts(text, voiceId) {
        const response = await this.fetchTtsGeneration(text, voiceId);
        return response;
    }

    async fetchTtsVoiceObjects() {
        return OpenAITtsProvider.voices;
    }

    async previewTtsVoice(_) {
        return;
    }

    async fetchTtsGeneration(inputText, voiceId) {
        console.info(`Generating new TTS for voice_id ${voiceId}`);
        const response = await fetch('/api/openai/generate-voice', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                'text': inputText,
                'voice': voiceId,
                'model': this.settings.model,
                'speed': this.settings.speed,
            }),
        });

        if (!response.ok) {
            toastr.error(response.statusText, 'TTS Generation Failed');
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        return response;
    }
}
