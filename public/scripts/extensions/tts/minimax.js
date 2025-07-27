import { getPreviewString, initVoiceMap, saveTtsProviderSettings } from './index.js';
import { event_types, eventSource, getRequestHeaders } from '../../../script.js';
import { SECRET_KEYS, secret_state } from '../../secrets.js';
import { getBase64Async } from '../../utils.js';

export { MiniMaxTtsProvider };

class MiniMaxTtsProvider {
    //########//
    // Config //
    //########//

    settings;
    voices = [];
    separator = ' . ';
    audioElement = document.createElement('audio');

    defaultSettings = {
        apiHost: 'https://api.minimax.io',
        model: 'speech-02-hd',
        voiceMap: {},
        speed: 1.0,
        volume: 1.0,
        pitch: 1.0,
        audioSampleRate: 32000,
        bitrate: 128000,
        format: 'mp3',
        customModels: [],
        customVoices: [],
        customVoiceId: '',
    };

    // MiniMax API doesn't provide a method to list user's cloned voices
    // so users need to manually input their custom cloned voice IDs
    static defaultVoices = [
        { name: 'Unrestrained Young Man', voice_id: 'Chinese (Mandarin)_Unrestrained_Young_Man', lang: 'zh-CN', preview_url: null },
    ];

    // default models (by MiniMax doc)
    static defaultModels = [
        { id: 'speech-02-hd', name: 'Speech-02-HD (High Quality)' },
        { id: 'speech-02-turbo', name: 'Speech-02-Turbo (Fast)' },
        { id: 'speech-01', name: 'Speech-01 (Legacy)' },
        { id: 'speech-01-240228', name: 'Speech-01-240228 (Legacy)' },
    ];

    availableModels = [];
    availableVoices = [];

    get settingsHtml() {
        return `
        <div class="minimax_tts_settings">
            <div class="tts_block justifyCenter">
                <div id="api_key_minimax" class="menu_button menu_button_icon manage-api-keys" data-key="api_key_minimax">
                    <i class="fa-solid fa-key"></i>
                    <span>Click to set API Key</span>
                </div>
                <div id="minimax_group_id" class="menu_button menu_button_icon manage-api-keys" data-key="minimax_group_id">
                    <i class="fa-solid fa-key"></i>
                    <span>Click to set Group ID</span>
                </div>
            </div>
            <div class="tts_block">
                <label for="minimax_tts_api_host">API Host</label>
                <select id="minimax_tts_api_host" class="text_pole">
                    <option value="https://api.minimax.io">Official (api.minimax.io)</option>
                    <option value="https://api.minimaxi.chat">Global (api.minimaxi.chat)</option>
                    <option value="https://api.minimax.chat">Mainland China (api.minimax.chat)</option>
                </select>
            </div>
            <div class="tts_block">
                <label for="minimax_tts_model">Model</label>
                <select id="minimax_tts_model" class="text_pole">
                    <option value="speech-02-hd">Speech-02-HD (High Quality)</option>
                    <option value="speech-02-turbo">Speech-02-Turbo (Fast)</option>
                    <option value="speech-01">Speech-01 (Legacy)</option>
                    <option value="speech-01-240228">Speech-01-240228 (Legacy)</option>
                </select>
            </div>
            <div class="tts_block">
                <input id="minimax_connect" class="menu_button" type="button" value="Connect" />
                <input id="minimax_refresh" class="menu_button" type="button" value="Refresh" />
            </div>

            <div class="tts_block">
                <label for="minimax_tts_speed">Speed: <span id="minimax_tts_speed_output"></span></label>
                <input id="minimax_tts_speed" type="range" value="${this.defaultSettings.speed}" min="0.5" max="2.0" step="0.1" />
            </div>
            <div class="tts_block">
                <label for="minimax_tts_volume">Volume: <span id="minimax_tts_volume_output"></span></label>
                <input id="minimax_tts_volume" type="range" value="${this.defaultSettings.volume}" min="0.1" max="2.0" step="0.1" />
            </div>
            <div class="tts_block">
                <label for="minimax_tts_pitch">Pitch: <span id="minimax_tts_pitch_output"></span></label>
                <input id="minimax_tts_pitch" type="range" value="${this.defaultSettings.pitch}" min="0.5" max="2.0" step="0.1" />
            </div>
            <div class="tts_block">
                <label for="minimax_tts_format">Audio Format</label>
                <select id="minimax_tts_format" class="text_pole">
                    <option value="mp3">MP3</option>
                    <option value="wav">WAV</option>
                    <option value="flac">FLAC</option>
                </select>
            </div>

            <hr>
            <div class="tts_block">
                <label for="minimax_tts_custom_voice_id">Custom Voice ID (for 'customVoice' option)</label>
                <input id="minimax_tts_custom_voice_id" type="text" class="text_pole" placeholder="Enter custom voice ID from MiniMax platform"/>
            </div>

            <hr>
            <div id="minimax_custom_voice_cloning" class="tts_block flexFlowColumn">
                <h4>Custom Voice Management</h4>
                <div class="tts_block wide100p">
                    <input id="minimax_custom_voice_name" type="text" class="text_pole" placeholder="Voice Name"/>
                </div>
                <div class="tts_block wide100p">
                    <input id="minimax_custom_voice_id" type="text" class="text_pole" placeholder="Voice ID (from MiniMax platform)"/>
                </div>
                <div class="tts_block wide100p">
                    <select id="minimax_custom_voice_lang" class="text_pole">
                        <option value="auto">Auto Detect</option>
                        <option value="Chinese">Chinese (中文)</option>
                        <option value="Chinese,Yue">Chinese, Yue (粤语)</option>
                        <option value="English">English</option>
                        <option value="Arabic">Arabic (العربية)</option>
                        <option value="Russian">Russian (Русский)</option>
                        <option value="Spanish">Spanish (Español)</option>
                        <option value="French">French (Français)</option>
                        <option value="Portuguese">Portuguese (Português)</option>
                        <option value="German">German (Deutsch)</option>
                        <option value="Turkish">Turkish (Türkçe)</option>
                        <option value="Dutch">Dutch (Nederlands)</option>
                        <option value="Ukrainian">Ukrainian (Українська)</option>
                        <option value="Vietnamese">Vietnamese (Tiếng Việt)</option>
                        <option value="Indonesian">Indonesian (Bahasa Indonesia)</option>
                        <option value="Japanese">Japanese (日本語)</option>
                        <option value="Italian">Italian (Italiano)</option>
                        <option value="Korean">Korean (한국어)</option>
                        <option value="Thai">Thai (ไทย)</option>
                        <option value="Polish">Polish (Polski)</option>
                        <option value="Romanian">Romanian (Română)</option>
                        <option value="Greek">Greek (Ελληνικά)</option>
                        <option value="Czech">Czech (Čeština)</option>
                        <option value="Finnish">Finnish (Suomi)</option>
                        <option value="Hindi">Hindi (हिन्दी)</option>
                    </select>
                </div>
                <div class="tts_block">
                    <input id="minimax_add_custom_voice" class="menu_button" type="button" value="Add Custom Voice">
                </div>
                <div id="minimax_custom_voices_list" style="margin-top: 10px;"></div>
            </div>

            <hr>
            <div id="minimax_custom_model_management" class="tts_block flexFlowColumn">
                <h4>Custom Model Management</h4>
                <div class="tts_block wide100p">
                    <input id="minimax_custom_model_id" type="text" class="text_pole" placeholder="Model ID"/>
                </div>
                <div class="tts_block wide100p">
                    <input id="minimax_custom_model_name" type="text" class="text_pole" placeholder="Model Name"/>
                </div>
                <div class="tts_block">
                    <input id="minimax_add_custom_model" class="menu_button" type="button" value="Add Custom Model">
                </div>
                <div id="minimax_custom_models_list" style="margin-top: 10px;"></div>
            </div>
        </div>
        `;
    }

    constructor() {
        this.handler = async function (/** @type {string} */ key) {
            if (![SECRET_KEYS.MINIMAX, SECRET_KEYS.MINIMAX_GROUP_ID].includes(key)) return;
            $('#api_key_minimax').toggleClass('success', !!secret_state[SECRET_KEYS.MINIMAX]);
            $('#minimax_group_id').toggleClass('success', !!secret_state[SECRET_KEYS.MINIMAX_GROUP_ID]);
            await this.onRefreshClick();
        }.bind(this);
    }

    dispose() {
        [event_types.SECRET_WRITTEN, event_types.SECRET_DELETED, event_types.SECRET_ROTATED].forEach(event => {
            eventSource.removeListener(event, this.handler);
        });
    }

    onSettingsChange() {
        this.settings.apiHost = $('#minimax_tts_api_host').val();
        this.settings.speed = parseFloat($('#minimax_tts_speed').val().toString());
        this.settings.volume = parseFloat($('#minimax_tts_volume').val().toString());
        this.settings.pitch = parseFloat($('#minimax_tts_pitch').val().toString());
        this.settings.model = $('#minimax_tts_model').find(':selected').val();
        this.settings.format = $('#minimax_tts_format').find(':selected').val();
        this.settings.customVoiceId = $('#minimax_tts_custom_voice_id').val();

        $('#minimax_tts_speed_output').text(this.settings.speed.toFixed(1));
        $('#minimax_tts_volume_output').text(this.settings.volume.toFixed(1));
        $('#minimax_tts_pitch_output').text(this.settings.pitch.toFixed(1));

        saveTtsProviderSettings();
    }

    addCustomModel() {
        const modelId = $('#minimax_custom_model_id').val().toString().trim();
        const modelName = $('#minimax_custom_model_name').val().toString().trim();

        if (!modelId || !modelName) {
            toastr.error('Please enter model ID and name');
            return;
        }

        // Check if already exists in custom models
        if (this.settings.customModels.find(m => m.id === modelId)) {
            toastr.error('Model ID already exists in custom models');
            return;
        }

        // Check if conflicts with default models
        if (MiniMaxTtsProvider.defaultModels.find(m => m.id === modelId)) {
            toastr.error('Model ID conflicts with default model. Please use a different model ID.');
            return;
        }

        // Check if conflicts with default model names
        if (MiniMaxTtsProvider.defaultModels.find(m => m.name === modelName)) {
            toastr.error('Model name conflicts with default model. Please use a different model name.');
            return;
        }

        this.settings.customModels.push({ id: modelId, name: modelName });
        $('#minimax_custom_model_id').val('');
        $('#minimax_custom_model_name').val('');

        this.updateCustomModelsDisplay();
        this.updateModelSelect(this.getAllModels());
        saveTtsProviderSettings();
        toastr.success('Model added successfully');
    }

    removeCustomModel(modelId) {
        this.settings.customModels = this.settings.customModels.filter(m => m.id !== modelId);
        this.updateCustomModelsDisplay();
        this.updateModelSelect(this.getAllModels());
        saveTtsProviderSettings();

        toastr.success('Model removed successfully');
    }

    addCustomVoice() {
        const voiceName = $('#minimax_custom_voice_name').val().toString().trim();
        const voiceId = $('#minimax_custom_voice_id').val().toString().trim();
        const voiceLang = $('#minimax_custom_voice_lang').val().toString().trim();

        if (!voiceName || !voiceId) {
            toastr.error('Please enter voice name and ID');
            return;
        }

        // Check if already exists in custom voices
        if (this.settings.customVoices.find(v => v.voice_id === voiceId)) {
            toastr.error('Voice ID already exists in custom voices');
            return;
        }

        // Check if conflicts with default voices
        if (MiniMaxTtsProvider.defaultVoices.find(v => v.voice_id === voiceId)) {
            toastr.error('Voice ID conflicts with default voice. Please use a different voice ID.');
            return;
        }

        // Check if conflicts with default voice names
        if (MiniMaxTtsProvider.defaultVoices.find(v => v.name === voiceName)) {
            toastr.error('Voice name conflicts with default voice. Please use a different voice name.');
            return;
        }

        // Convert display name to standard language code before saving
        const standardLangCode = this.convertDisplayNameToLanguageCode(voiceLang);

        this.settings.customVoices.push({
            name: voiceName,
            voice_id: voiceId,
            lang: standardLangCode,
            preview_url: null,
        });

        $('#minimax_custom_voice_name').val('');
        $('#minimax_custom_voice_id').val('');
        $('#minimax_custom_voice_lang').val('auto');

        this.updateCustomVoicesDisplay();
        initVoiceMap(); // Update TTS extension voiceMap
        saveTtsProviderSettings();
        toastr.success('Voice added successfully');
    }

    // Remove custom voice
    removeCustomVoice(voiceId) {
        this.settings.customVoices = this.settings.customVoices.filter(v => v.voice_id !== voiceId);
        this.updateCustomVoicesDisplay();
        initVoiceMap(); // Update TTS extension voiceMap
        saveTtsProviderSettings();
        toastr.success('Voice removed successfully');
    }

    // Helper function to escape HTML
    escapeHtml(text) {
        const div = document.createElement('div');
        div.textContent = text;
        return div.innerHTML;
    }

    // Update custom models display
    updateCustomModelsDisplay() {
        const container = $('#minimax_custom_models_list');
        container.empty();

        if (this.settings.customModels.length === 0) {
            container.append('<div class="minimax-empty-list">No custom models added</div>');
            return;
        }

        this.settings.customModels.forEach(model => {
            const modelDiv = $('<div></div>').addClass('minimax-custom-item');

            const modelInfo = $('<div></div>').addClass('minimax-custom-item-info');
            const modelName = $('<div></div>').addClass('minimax-custom-item-name').text(model.name);
            const modelId = $('<div></div>').addClass('minimax-custom-item-details').text(`(${model.id})`);
            modelInfo.append(modelName).append(modelId);

            const removeBtn = $('<button></button>')
                .addClass('menu_button minimax-custom-item-remove')
                .text('Remove')
                .on('click', () => {
                    try {
                        this.removeCustomModel(model.id);
                    } catch (error) {
                        console.error('MiniMax TTS: Error removing custom model:', error);
                        toastr.error(`Failed to remove custom model: ${error.message}`);
                    }
                });

            modelDiv.append(modelInfo).append(removeBtn);
            container.append(modelDiv);
        });
    }

    // Update custom voices display
    updateCustomVoicesDisplay() {
        const container = $('#minimax_custom_voices_list');
        container.empty();

        if (this.settings.customVoices.length === 0) {
            container.append('<div class="minimax-empty-list">No custom voices added</div>');
            return;
        }

        this.settings.customVoices.forEach(voice => {
            const voiceDiv = $('<div></div>').addClass('minimax-custom-item');

            const voiceInfo = $('<div></div>').addClass('minimax-custom-item-info');
            const voiceName = $('<div></div>').addClass('minimax-custom-item-name').text(voice.name);
            const voiceDetails = $('<div></div>').addClass('minimax-custom-item-details').text(`(${voice.voice_id}) - ${voice.lang}`);
            voiceInfo.append(voiceName).append(voiceDetails);

            const removeBtn = $('<button></button>')
                .addClass('menu_button minimax-custom-item-remove')
                .text('Remove')
                .on('click', () => {
                    try {
                        this.removeCustomVoice(voice.voice_id);
                    } catch (error) {
                        console.error('MiniMax TTS: Error removing custom voice:', error);
                        toastr.error(`Failed to remove custom voice: ${error.message}`);
                    }
                });

            voiceDiv.append(voiceInfo).append(removeBtn);
            container.append(voiceDiv);
        });
    }

    // Get all models (default + custom)
    getAllModels() {
        return [...MiniMaxTtsProvider.defaultModels, ...this.settings.customModels];
    }

    // Get all voices (default + custom)
    getAllVoices() {
        return [...MiniMaxTtsProvider.defaultVoices, ...this.settings.customVoices];
    }

    /**
     * Convert display names to standard language codes
     * @param {string} displayName Language display name
     * @returns {string} Standard language code
     */
    convertDisplayNameToLanguageCode(displayName) {
        const displayNameToCode = {
            'Chinese': 'zh-CN',
            'Chinese,Yue': 'zh-TW',
            'English': 'en-US',
            'Japanese': 'ja-JP',
            'Korean': 'ko-KR',
            'French': 'fr-FR',
            'German': 'de-DE',
            'Spanish': 'es-ES',
            'Portuguese': 'pt-BR',
            'Italian': 'it-IT',
            'Arabic': 'ar-SA',
            'Russian': 'ru-RU',
            'Turkish': 'tr-TR',
            'Dutch': 'nl-NL',
            'Ukrainian': 'uk-UA',
            'Vietnamese': 'vi-VN',
            'Indonesian': 'id-ID',
            'Thai': 'th-TH',
            'Polish': 'pl-PL',
            'Romanian': 'ro-RO',
            'Greek': 'el-GR',
            'Czech': 'cs-CZ',
            'Finnish': 'fi-FI',
            'Hindi': 'hi-IN',
        };

        return displayNameToCode[displayName] || displayName;
    }

    updateModelSelect(models) {
        const modelSelect = $('#minimax_tts_model');
        const currentValue = modelSelect.val();

        // Clear existing options
        modelSelect.empty();

        // Add all models
        models.forEach(model => {
            const option = $('<option></option>');
            option.val(model.id);
            option.text(model.name);
            modelSelect.append(option);
        });

        // Restore previous selection if it still exists
        if (currentValue && models.find(m => m.id === currentValue)) {
            modelSelect.val(currentValue);
        }
    }

    async loadSettings(settings) {
        // Populate Provider UI given input settings
        if (Object.keys(settings).length === 0) {
            console.info('Using default MiniMax TTS Provider settings');
        }

        // Only accept keys defined in defaultSettings
        this.settings = { ...this.defaultSettings };

        for (const key in settings) {
            if (key in this.settings) {
                this.settings[key] = settings[key];
            } else {
                console.warn(`Invalid setting passed to MiniMax TTS Provider: ${key}`);
            }
        }

        // Ensure custom configuration arrays exist
        if (!this.settings.customModels) this.settings.customModels = [];
        if (!this.settings.customVoices) this.settings.customVoices = [];

        $('#minimax_tts_api_host').val(this.settings.apiHost || 'https://api.minimax.io');
        $('#minimax_tts_model').val(this.settings.model);
        $('#minimax_tts_speed').val(this.settings.speed);
        $('#minimax_tts_volume').val(this.settings.volume);
        $('#minimax_tts_pitch').val(this.settings.pitch);
        $('#minimax_tts_format').val(this.settings.format);
        $('#minimax_tts_custom_voice_id').val(this.settings.customVoiceId);

        $('#minimax_connect').on('click', () => {
            try {
                this.onConnectClick();
            } catch (error) {
                console.error('MiniMax TTS: Error in connect click handler:', error);
                toastr.error(`Connection failed: ${error.message}`);
            }
        });
        $('#minimax_refresh').on('click', () => {
            try {
                this.onRefreshClick();
            } catch (error) {
                console.error('MiniMax TTS: Error in refresh click handler:', error);
                toastr.error(`Refresh failed: ${error.message}`);
            }
        });
        $('#minimax_tts_api_host').on('change', this.onSettingsChange.bind(this));
        $('#minimax_tts_speed').on('input', this.onSettingsChange.bind(this));
        $('#minimax_tts_volume').on('input', this.onSettingsChange.bind(this));
        $('#minimax_tts_pitch').on('input', this.onSettingsChange.bind(this));
        $('#minimax_tts_model').on('change', this.onSettingsChange.bind(this));
        $('#minimax_tts_format').on('change', this.onSettingsChange.bind(this));
        $('#minimax_tts_custom_voice_id').on('input', this.onSettingsChange.bind(this));

        // Custom model and voice event listeners
        $('#minimax_add_custom_model').on('click', () => {
            try {
                this.addCustomModel();
            } catch (error) {
                console.error('MiniMax TTS: Error adding custom model:', error);
                toastr.error(`Failed to add custom model: ${error.message}`);
            }
        });
        $('#minimax_add_custom_voice').on('click', () => {
            try {
                this.addCustomVoice();
            } catch (error) {
                console.error('MiniMax TTS: Error adding custom voice:', error);
                toastr.error(`Failed to add custom voice: ${error.message}`);
            }
        });

        // Keyboard event listeners
        const ENTER_KEY = 13;
        $('#minimax_custom_model_id, #minimax_custom_model_name').on('keypress', (e) => {
            if (e.which === ENTER_KEY) {
                try {
                    this.addCustomModel();
                } catch (error) {
                    console.error('MiniMax TTS: Error adding custom model via keyboard:', error);
                    toastr.error(`Failed to add custom model: ${error.message}`);
                }
            }
        });

        $('#minimax_custom_voice_name, #minimax_custom_voice_id').on('keypress', (e) => {
            if (e.which === ENTER_KEY) {
                try {
                    this.addCustomVoice();
                } catch (error) {
                    console.error('MiniMax TTS: Error adding custom voice via keyboard:', error);
                    toastr.error(`Failed to add custom voice: ${error.message}`);
                }
            }
        });

        $('#minimax_tts_speed_output').text(this.settings.speed.toFixed(1));
        $('#minimax_tts_volume_output').text(this.settings.volume.toFixed(1));
        $('#minimax_tts_pitch_output').text(this.settings.pitch.toFixed(1));

        // Initialize custom configuration display
        this.updateCustomModelsDisplay();
        this.updateCustomVoicesDisplay();

        // Update model selector to include custom models
        this.updateModelSelect(this.getAllModels());

        // Initialize voice map for character voice assignment
        try {
            await initVoiceMap();
        } catch (error) {
            console.debug('MiniMax: Voice map initialization failed, but continuing');
        }

        $('#api_key_minimax').toggleClass('success', !!secret_state[SECRET_KEYS.MINIMAX]);
        $('#minimax_group_id').toggleClass('success', !!secret_state[SECRET_KEYS.MINIMAX_GROUP_ID]);
        [event_types.SECRET_WRITTEN, event_types.SECRET_DELETED, event_types.SECRET_ROTATED].forEach(event => {
            eventSource.on(event, this.handler);
        });

        // Only check ready status when API credentials are available
        if (secret_state[SECRET_KEYS.MINIMAX] && secret_state[SECRET_KEYS.MINIMAX_GROUP_ID]) {
            try {
                await this.checkReady();
                console.debug('MiniMax TTS: Settings loaded and ready');
            } catch (error) {
                console.debug('MiniMax TTS: Settings loaded, but not ready:', error);
            }
        } else {
            console.debug('MiniMax TTS: Settings loaded, waiting for API credentials');
        }
    }

    // Perform a simple readiness check
    async checkReady() {
        if (!secret_state[SECRET_KEYS.MINIMAX] || !secret_state[SECRET_KEYS.MINIMAX_GROUP_ID]) {
            const error = new Error('API Key and Group ID are required');
            console.error('MiniMax TTS checkReady error:', error.message);
            throw error;
        }
        // Try to fetch available models and voices, but don't block connection on failure
        try {
            await this.updateModelsAndVoices();
        } catch (error) {
            console.warn('MiniMax TTS: Failed to fetch models/voices during ready check, will use all available:', error);
            // Even if API call fails, set all available values to ensure basic functionality
            this.availableModels = this.getAllModels();
            this.availableVoices = this.getAllVoices();
        }

        // Ensure at least voices are available
        if (!this.availableVoices || this.availableVoices.length === 0) {
            this.availableVoices = this.getAllVoices();
        }
    }

    async onRefreshClick() {
        try {
            await this.updateModelsAndVoices();
            await initVoiceMap(); // Update voice map after refresh
            toastr.success('MiniMax TTS: Models and voices refreshed successfully');
        } catch (error) {
            toastr.error(`MiniMax TTS: Failed to refresh - ${error.message}`);
        }
    }

    async onConnectClick() {
        try {
            await this.checkReady();
            await initVoiceMap(); // Update voice map after connection
            toastr.success('MiniMax TTS: Connected successfully');
            saveTtsProviderSettings();
        } catch (error) {
            toastr.error(`MiniMax TTS: ${error.message}`);
        }
    }

    async getVoice(voiceName) {
        if (!voiceName) {
            const error = new Error('TTS Voice name not provided');
            console.error('MiniMax TTS getVoice error:', error.message);
            throw error;
        }

        // If no available voices, try to fetch them
        if (!this.availableVoices || this.availableVoices.length === 0) {
            this.availableVoices = await this.fetchTtsVoiceObjects();
        }

        // Ensure at least voices are available
        if (!this.availableVoices || this.availableVoices.length === 0) {
            this.availableVoices = this.getAllVoices();
        }

        const voice = this.availableVoices.find(voice =>
            voice.voice_id === voiceName || voice.name === voiceName,
        );

        if (!voice) {
            const error = new Error(`TTS Voice not found: ${voiceName}`);
            console.error('MiniMax TTS getVoice error:', error.message);
            throw error;
        }

        return voice;
    }

    async generateTts(text, voiceId) {
        // If voiceId is 'customVoice', use the custom voice ID from settings
        if (voiceId === 'customVoice') {
            const customVoiceId = this.settings.customVoiceId;
            if (!customVoiceId || customVoiceId.trim() === '') {
                const error = new Error('Please enter custom voice ID in settings first');
                console.error('MiniMax TTS generateTts error:', error.message);
                throw error;
            }
            voiceId = customVoiceId.trim();
        }

        // Get the voice object to determine language
        let language = null;
        try {
            const voice = await this.getVoice(voiceId);
            if (voice && voice.lang) {
                language = this.mapLanguageToMiniMaxFormat(voice.lang);
                console.debug(`MiniMax TTS: Using voice language ${voice.lang}, API language: ${language}`);
            }
        } catch (error) {
            console.debug('MiniMax TTS: Could not determine voice language, using default');
        }

        return await this.fetchTtsGeneration(text, voiceId, language);
    }

    async fetchTtsVoiceObjects() {
        try {
            if (!secret_state[SECRET_KEYS.MINIMAX] || !secret_state[SECRET_KEYS.MINIMAX_GROUP_ID]) {
                console.warn('MiniMax TTS: API Key and Group ID required for fetching voices');
                console.warn('Using all available voices (default + custom). Please check your API credentials');
                return this.getAllVoices();
            }

            // MiniMax API doesn't provide a voices listing endpoint
            // Using all available voices (default + custom)
            console.info('MiniMax TTS: Using all available voices (default + custom)');
            return this.getAllVoices();
        } catch (error) {
            console.error('Error fetching MiniMax voices:', error);
            console.warn('Using all available voices (default + custom). Please check your API credentials');
            return this.getAllVoices();
        }
    }

    async fetchTtsModels() {
        // MiniMax API doesn't provide a models listing endpoint
        // Using all available models (default + custom)
        console.info('MiniMax TTS: Using all available models (default + custom)');
        this.availableModels = this.getAllModels();
        return this.getAllModels();
    }

    async updateModelsAndVoices() {
        try {
            // Get models list
            this.availableModels = await this.fetchTtsModels();
            console.info(`MiniMax TTS: Loaded ${this.availableModels.length} models`);

            // Get voices list (now fetched from API)
            this.availableVoices = await this.fetchTtsVoiceObjects();
            console.info(`MiniMax TTS: Loaded ${this.availableVoices.length} voices`);

            // Update model dropdown
            this.updateModelSelect(this.availableModels);

            return {
                models: this.availableModels,
                voices: this.availableVoices,
            };
        } catch (error) {
            console.error('MiniMax TTS: Failed to update models and voices:', error);
            // Set all available values to ensure basic functionality
            this.availableModels = this.getAllModels();
            this.availableVoices = this.getAllVoices();
            throw error;
        }
    }

    // Get correct MIME type
    getAudioMimeType(format) {
        const mimeTypes = {
            'mp3': 'audio/mpeg',
            'wav': 'audio/wav',
            'pcm': 'audio/pcm',
            'flac': 'audio/flac',
            'aac': 'audio/aac',
        };
        return mimeTypes[format] || 'audio/mpeg';
    }

    async fetchTtsGeneration(inputText, voiceId, language = null) {
        console.info(`Generating new MiniMax TTS for voice_id ${voiceId}`);

        if (!secret_state[SECRET_KEYS.MINIMAX] || !secret_state[SECRET_KEYS.MINIMAX_GROUP_ID]) {
            const error = new Error('API Key and Group ID are required');
            console.error('MiniMax TTS fetchTtsGeneration error:', error.message);
            throw error;
        }

        const requestBody = {
            text: inputText,
            voiceId: voiceId,
            apiHost: this.settings.apiHost,
            model: this.settings.model || 'speech-02-hd',
            speed: Number(this.settings.speed) || 1.0,
            volume: Number(this.settings.volume) || 1.0,
            pitch: Number(this.settings.pitch) || 1.0,
            audioSampleRate: Number(this.settings.audioSampleRate) || 32000,
            bitrate: Number(this.settings.bitrate) || 128000,
            format: this.settings.format || 'mp3',
            language: language,
        };

        console.debug('MiniMax TTS Request:', {
            body: { ...requestBody, voiceId: '[REDACTED]' },
        });

        try {
            const response = await fetch('/api/minimax/generate-voice', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                let errorMessage = `HTTP ${response.status}`;

                try {
                    // Try to parse JSON error response from backend
                    const errorData = await response.json();
                    console.error('MiniMax TTS backend error:', errorData);
                    errorMessage = errorData.error || errorMessage;
                } catch (jsonError) {
                    // If not JSON, try to read text
                    try {
                        const errorText = await response.text();
                        console.error('MiniMax TTS backend error (Text):', errorText);
                        errorMessage = errorText || errorMessage;
                    } catch (textError) {
                        console.error('MiniMax TTS: Failed to read error response:', textError);
                    }
                }

                toastr.error(`${errorMessage}`, 'MiniMax TTS Generation Failed');
                const error = new Error(errorMessage);
                console.error('MiniMax TTS fetchTtsGeneration error:', error.message);
                throw error;
            }

            // Backend handles all the complex processing and returns audio data directly
            console.debug('MiniMax TTS: Audio response received from backend');
            return response;

        } catch (error) {
            console.error('Error in MiniMax TTS generation:', error);
            throw error;
        }
    }

    /**
     * Map language codes to MiniMax API supported language format
     * @param {string} lang Language code or display name
     * @returns {string} MiniMax API language format
     */
    mapLanguageToMiniMaxFormat(lang) {
        // Convert display name to language code if needed
        const languageCode = this.convertDisplayNameToLanguageCode(lang);

        // Then map language codes to MiniMax API format
        const languageMap = {
            'zh-CN': 'zh_CN',
            'zh-TW': 'zh_TW',
            'en-US': 'en_US',
            'en-GB': 'en_GB',
            'en-AU': 'en_AU',
            'en-IN': 'en_IN',
            'ja-JP': 'ja_JP',
            'ko-KR': 'ko_KR',
            'fr-FR': 'fr_FR',
            'de-DE': 'de_DE',
            'es-ES': 'es_ES',
            'pt-BR': 'pt_BR',
            'it-IT': 'it_IT',
            'ar-SA': 'ar_SA',
            'ru-RU': 'ru_RU',
            'tr-TR': 'tr_TR',
            'nl-NL': 'nl_NL',
            'uk-UA': 'uk_UA',
            'vi-VN': 'vi_VN',
            'id-ID': 'id_ID',
            'th-TH': 'th_TH',
            'pl-PL': 'pl_PL',
            'ro-RO': 'ro_RO',
            'el-GR': 'el_GR',
            'cs-CZ': 'cs_CZ',
            'fi-FI': 'fi_FI',
            'hi-IN': 'hi_IN',
        };

        // Return mapped language or default to auto
        return languageMap[languageCode] || 'auto';
    }

    /**
     * Preview TTS for a given voice ID.
     * @param {string} voiceId Voice ID
     */
    async previewTtsVoice(voiceId) {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;

        try {
            const voice = await this.getVoice(voiceId);
            // Get preview text based on voice language, defaulting to en-US
            const previewLang = voice.lang || 'en-US';
            const text = getPreviewString(previewLang);

            // Map the language to MiniMax API format for the request
            const apiLang = this.mapLanguageToMiniMaxFormat(previewLang);
            console.debug(`MiniMax TTS: Using preview language ${previewLang}, API language: ${apiLang}`);

            const response = await this.fetchTtsGeneration(text, voiceId, apiLang);

            if (!response.ok) {
                const errorText = await response.text();
                const error = new Error(`HTTP ${response.status}: ${errorText}`);
                console.error('MiniMax TTS previewTtsVoice error:', error.message);
                throw error;
            }

            const audio = await response.blob();
            console.debug(`MiniMax TTS: Audio blob size: ${audio.size}, type: ${audio.type}`);

            // Use the same method as other TTS providers - convert to base64 data URL
            const srcUrl = await getBase64Async(audio);
            console.debug('MiniMax TTS: Base64 data URL created');

            // Clean up previous event listener to prevent memory leaks
            this.audioElement.onended = null;
            this.audioElement.onerror = null;

            this.audioElement.src = srcUrl;
            this.audioElement.volume = Math.min(this.settings.volume || 1.0, 1.0); // HTML audio element max is 1.0

            // Add error handler for audio element
            this.audioElement.onerror = (e) => {
                console.error('MiniMax TTS: Audio element error:', e);
                console.error('MiniMax TTS: Audio element error details:', {
                    error: this.audioElement.error,
                    networkState: this.audioElement.networkState,
                    readyState: this.audioElement.readyState,
                    src: this.audioElement.src,
                });

                toastr.error('Audio playback failed. The audio format may not be supported by your browser.');
            };

            try {
                await this.audioElement.play();
                console.debug('MiniMax TTS: Audio playback started successfully');
            } catch (playError) {
                console.error('MiniMax TTS: Play error:', playError);
                throw new Error(`Audio playback failed: ${playError.message}`);
            }

            this.audioElement.onended = () => {
                this.audioElement.onended = null;
                this.audioElement.onerror = null;
            };

        } catch (error) {
            console.error('MiniMax TTS Preview Error:', error);
            toastr.error(`Could not generate preview: ${error.message}`);
        }
    }
}
