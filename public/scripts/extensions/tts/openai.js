import { getRequestHeaders, substituteParams } from '../../../script.js';
import { saveTtsProviderSettings, sanitizeId } from './index.js';

export { OpenAITtsProvider };

class OpenAITtsProvider {
    static voices = [
        { name: 'Alloy', voice_id: 'alloy', lang: 'en-US', preview_url: 'https://cdn.openai.com/API/docs/audio/alloy.wav' },
        { name: 'Ash', voice_id: 'ash', lang: 'en-US', preview_url: 'https://cdn.openai.com/API/docs/audio/ash.wav' },
        { name: 'Coral', voice_id: 'coral', lang: 'en-US', preview_url: 'https://cdn.openai.com/API/docs/audio/coral.wav' },
        { name: 'Echo', voice_id: 'echo', lang: 'en-US', preview_url: 'https://cdn.openai.com/API/docs/audio/echo.wav' },
        { name: 'Fable', voice_id: 'fable', lang: 'en-US', preview_url: 'https://cdn.openai.com/API/docs/audio/fable.wav' },
        { name: 'Onyx', voice_id: 'onyx', lang: 'en-US', preview_url: 'https://cdn.openai.com/API/docs/audio/onyx.wav' },
        { name: 'Nova', voice_id: 'nova', lang: 'en-US', preview_url: 'https://cdn.openai.com/API/docs/audio/nova.wav' },
        { name: 'Sage', voice_id: 'sage', lang: 'en-US', preview_url: 'https://cdn.openai.com/API/docs/audio/sage.wav' },
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
        characterInstructions: {},
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
                    <option value="gpt-4o-mini-tts">gpt-4o-mini-tts</option>
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
        // Initialize UI state based on current model (gpt-4o-mini-tts or other)
        this.updateInstructionsUI();
        // Look for voice map changes
        this.setupVoiceMapObserver();

        console.debug('OpenAI TTS: Settings loaded');
    }

    setupVoiceMapObserver() {
        if (this.voiceMapObserver) {
            this.voiceMapObserver.disconnect();
            this.voiceMapObserver = null;
        }

        const targetNode = document.getElementById('tts_voicemap_block');
        if (!targetNode) return;

        const observer = new MutationObserver(() => {
            if (this.settings.model === 'gpt-4o-mini-tts') {
                this.populateCharacterInstructions();
            }
        });

        observer.observe(targetNode, { childList: true, subtree: true });
        this.voiceMapObserver = observer;
    }

    onSettingsChange() {
        // Update dynamically
        this.settings.model = String($('#openai-tts-model').find(':selected').val());
        this.settings.speed = Number($('#openai-tts-speed').val());
        $('#openai-tts-speed-output').text(this.settings.speed);
        this.updateInstructionsUI();
        saveTtsProviderSettings();
    }

    updateInstructionsUI() {
        if (this.settings.model === 'gpt-4o-mini-tts') {
            this.createInstructionsContainer();
            $('#openai-instructions-container').show();
            this.populateCharacterInstructions();
        } else {
            $('#openai-instructions-container').hide();
            this.voiceMapObserver?.disconnect();
            this.voiceMapObserver = null;
        }
    }

    createInstructionsContainer() {
        if ($('#openai-instructions-container').length === 0) {
            const containerHtml = `
                <div id="openai-instructions-container" style="display: none;">
                    <span>Voice Instructions (GPT-4o Mini TTS)</span><br>
                    <small>Customize how each character speaks</small>
                    <div id="openai-character-instructions"></div>
                </div>
            `;
            $('#openai-tts-speed').parent().after(containerHtml);
        }
    }

    populateCharacterInstructions() {

        const currentCharacters = $('.tts_voicemap_block_char span').map((i, el) => $(el).text()).get();

        $('#openai-character-instructions').empty();

        for (const char of currentCharacters) {
            if (char === 'SillyTavern System' || char === '[Default Voice]') continue;

            const sanitizedName = sanitizeId(char);
            const savedInstructions = this.settings.characterInstructions?.[char] || '';

            const instructionBlock = document.createElement('div');
            const label = document.createElement('label');
            const textArea = document.createElement('textarea');
            instructionBlock.appendChild(label);
            instructionBlock.appendChild(textArea);
            instructionBlock.className = 'character-instructions';
            label.setAttribute('for', `openai_char_${sanitizedName}`);
            label.innerText = `${char}:`;
            textArea.id = `openai_char_${sanitizedName}`;
            textArea.placeholder = 'e.g., "Speak cheerfully and energetically"';
            textArea.className = 'textarea_compact autoSetHeight';
            textArea.value = savedInstructions;
            textArea.addEventListener('input', () => {
                this.saveCharacterInstructions(char, textArea.value);
            });

            $('#openai-character-instructions').append(instructionBlock);
        }
    }

    saveCharacterInstructions(characterName, instructions) {
        if (!this.settings.characterInstructions) {
            this.settings.characterInstructions = {};
        }
        this.settings.characterInstructions[characterName] = instructions;
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

    async generateTts(text, voiceId, characterName = null) {
        const response = await this.fetchTtsGeneration(text, voiceId, characterName);
        return response;
    }

    async fetchTtsVoiceObjects() {
        return OpenAITtsProvider.voices;
    }

    async previewTtsVoice(_) {
        return;
    }

    async fetchTtsGeneration(inputText, voiceId, characterName = null) {
        console.info(`Generating new TTS for voice_id ${voiceId}`);

        const requestBody = {
            'text': inputText,
            'voice': voiceId,
            'model': this.settings.model,
            'speed': this.settings.speed,
        };

        if (this.settings.model === 'gpt-4o-mini-tts' && characterName) {
            const instructions = this.settings.characterInstructions?.[characterName];
            if (instructions && instructions.trim()) {
                requestBody.instructions = substituteParams(instructions);
            }
        }

        const response = await fetch('/api/openai/generate-voice', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            toastr.error(response.statusText, 'TTS Generation Failed');
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        return response;
    }
}
