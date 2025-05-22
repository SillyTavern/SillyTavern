import { getContext } from '../../extensions.js';
import { saveTtsProviderSettings, getPreviewString } from './index.js';
import { extension_settings } from '../../extensions.js';

export { DiaTtsProvider };

// Constants
const DIA_CONSTANTS = {
    LOG_PREFIX: 'DiaTTS:',
    POLL_INTERVAL: 1000,
    MAX_RETRIES: 2,
    SUPPORTED_FORMATS: /\.(wav|mp3|ogg|m4a|flac|aac)$/i,
    DEFAULT_SPEAKER_TAG: '[S2]',
    USER_SPEAKER_TAG: '[S1]',
    ASSISTANT_SPEAKER_TAG: '[S2]',
    SYSTEM_SPEAKER_TAG: '[S2]',
};

const PRESET_CONFIGS = {
    quality: {
        temperature: 0.8,
        cfg_scale: 4.0,
        top_p: 0.8,
        max_tokens: 2000,
    },
    natural: {
        temperature: 1.4,
        cfg_scale: 2.5,
        top_p: 0.95,
        max_tokens: 2000,
    },
    fast: {
        temperature: 1.0,
        cfg_scale: 2.0,
        top_p: 0.9,
        max_tokens: 1000,
    },
    default: {
        temperature: 1.2,
        cfg_scale: 3.0,
        top_p: 0.95,
        max_tokens: 2000,
    },
};

const BUILT_IN_VOICES = [
    { name: 'Alloy', voice_id: 'alloy', preview_url: '', lang: 'en-US', description: 'Built-in voice' },
    { name: 'Echo', voice_id: 'echo', preview_url: '', lang: 'en-US', description: 'Built-in voice' },
    { name: 'Fable', voice_id: 'fable', preview_url: '', lang: 'en-US', description: 'Built-in voice' },
    { name: 'Nova', voice_id: 'nova', preview_url: '', lang: 'en-US', description: 'Built-in voice' },
    { name: 'Onyx', voice_id: 'onyx', preview_url: '', lang: 'en-US', description: 'Built-in voice' },
    { name: 'Shimmer', voice_id: 'shimmer', preview_url: '', lang: 'en-US', description: 'Built-in voice' },
];

/**
 * Dia TTS Provider implementation
 * Supports both synchronous and asynchronous TTS generation with voice cloning
 */
class DiaTtsProvider {
    /**
     * @typedef {Object} DiaTtsSettings
     * @property {Object} voiceMap - Voice mapping configuration
     * @property {string} endpoint - API endpoint URL
     * @property {string} apiKey - API authentication key
     * @property {Object} voiceMappings - Character to voice ID mappings
     * @property {Object} audioPrompts - Audio prompt storage
     * @property {string[]} customVoices - List of custom voice IDs
     * @property {number} temperature - Generation randomness (0.1-2.0)
     * @property {number} cfg_scale - Classifier-free guidance scale (1.0-10.0)
     * @property {number} top_p - Nucleus sampling threshold (0.0-1.0)
     * @property {number} max_tokens - Maximum tokens to generate (100-10000)
     * @property {boolean} use_async_mode - Enable async processing
     * @property {number} async_timeout - Async job timeout in milliseconds
     */

    /** @type {DiaTtsSettings} */
    settings = null;

    voices = [];
    separator = ' ... ';
    audioElement = document.createElement('audio');

    defaultSettings = {
        voiceMap: {},
        endpoint: 'http://localhost:7860',
        apiKey: 'sk-anything',
        voiceMappings: {},
        audioPrompts: {},
        customVoices: [],
        temperature: 1.2,
        cfg_scale: 3.0,
        top_p: 0.95,
        max_tokens: 2000,
        use_async_mode: true,
        async_timeout: 30000,
    };

    // UI Template Helpers
    _renderConnectionSettings(settings) {
        return `
            <label for="dia-tts-endpoint">Endpoint URL</label>
            <input id="dia-tts-endpoint" type="text" class="text_pole" placeholder="http://localhost:7860" value="${settings.endpoint || this.defaultSettings.endpoint}" />
            <small>Base URL for the Dia FastAPI server</small>

            <label for="dia-tts-apikey">API Key</label>
            <input id="dia-tts-apikey" type="text" class="text_pole" placeholder="sk-anything" value="${settings.apiKey || this.defaultSettings.apiKey}" />
            <small>API key (any string works with Dia)</small>
        `;
    }

    _renderParameterSlider(id, label, value, min, max, step, description) {
        return `
            <label for="${id}">${label}: <span id="${id}-output">${value}</span></label>
            <input id="${id}" type="range" value="${value}" min="${min}" max="${max}" step="${step}" />
            <small>${description}</small>
        `;
    }

    _renderModelParameters(settings) {
        return `
            <div class="dia_model_params">
                <span style="font-weight:bold;">Model Parameters</span><br>

                ${this._renderParameterSlider('dia-temperature', 'Temperature',
        settings.temperature || this.defaultSettings.temperature,
        0.1, 2.0, 0.1,
        'Controls randomness in generation (0.1 = consistent, 2.0 = creative)')}

                ${this._renderParameterSlider('dia-cfg-scale', 'CFG Scale',
        settings.cfg_scale || this.defaultSettings.cfg_scale,
        1.0, 10.0, 0.5,
        'Classifier-free guidance strength (1.0 = weak, 10.0 = strong conditioning)')}

                ${this._renderParameterSlider('dia-top-p', 'Top P',
        settings.top_p || this.defaultSettings.top_p,
        0.1, 1.0, 0.05,
        'Nucleus sampling threshold (0.1 = focused, 1.0 = diverse)')}

                ${this._renderParameterSlider('dia-max-tokens', 'Max Tokens',
        settings.max_tokens || this.defaultSettings.max_tokens,
        100, 10000, 100,
        'Maximum tokens to generate (100 = short, 10000 = very long)')}

                <label for="dia-async-mode">
                    <input id="dia-async-mode" type="checkbox" ${(settings.use_async_mode || this.defaultSettings.use_async_mode) ? 'checked' : ''} />
                    Use Worker Queue for Processing
                </label>
                <small>Enable async processing for better performance</small>

                <label for="dia-async-timeout">Async Timeout: <span id="dia-async-timeout-output">${Math.round((settings.async_timeout || this.defaultSettings.async_timeout) / 1000)}s</span></label>
                <input id="dia-async-timeout" type="range" value="${settings.async_timeout || this.defaultSettings.async_timeout}" min="10000" max="120000" step="5000" />
                <small>Maximum time to wait for async jobs to complete (10-120 seconds)</small>

                ${this._renderPresetButtons()}
            </div>
        `;
    }

    _renderPresetButtons() {
        return `
            <div style="margin-top:10px; padding:8px; background:var(--SmartThemeBlurTintColor); border-radius:5px;">
                <small style="color:var(--SmartThemeQuoteColor);">
                    <strong>Presets:</strong>
                    <button id="dia-preset-quality" class="menu_button" style="margin:2px; padding:2px 8px; font-size:11px;">High Quality</button>
                    <button id="dia-preset-natural" class="menu_button" style="margin:2px; padding:2px 8px; font-size:11px;">Natural</button>
                    <button id="dia-preset-fast" class="menu_button" style="margin:2px; padding:2px 8px; font-size:11px;">Fast</button>
                    <button id="dia-preset-default" class="menu_button" style="margin:2px; padding:2px 8px; font-size:11px;">Default</button>
                </small>
            </div>
        `;
    }

    _renderVoiceCloning() {
        return `
            <div class="dia_voice_cloning">
                <span>Voice Cloning</span><br>
                <label for="dia-tts-char-select">Character</label>
                <div style="display: flex; gap: 5px; align-items: center;">
                    <select id="dia-tts-char-select" class="text_pole" style="flex: 1;">
                        <option value="">Select Character...</option>
                    </select>
                    <div class="menu_button menu_button_icon" id="dia-refresh-characters" title="Refresh character list">
                        <i class="fa-solid fa-refresh"></i>
                    </div>
                </div>
                <small>Choose a character to create a custom voice for</small>

                <label for="dia-tts-voice-name">Voice Name</label>
                <input id="dia-tts-voice-name" type="text" class="text_pole" placeholder="Custom voice name" />
                <small>Name for the custom voice (auto-generated if empty)</small>

                <div class="menu_button menu_button_icon" id="dia-upload-voice-sample">
                    <i class="fa-solid fa-file-import"></i>
                    <span>Upload Voice Sample</span>
                </div>
                <input id="dia-tts-char-upload" type="file" accept="audio/*" style="display:none;" />
                <small>Upload 3-10 seconds of clean voice sample (.wav, .mp3, etc.)</small>

                <label for="dia-tts-transcript">Audio Transcript (Optional)</label>
                <textarea id="dia-tts-transcript" class="text_pole" rows="2" placeholder="[S1] What is said in the audio sample."></textarea>
                <small>What's being said in the audio (improves voice quality)</small>

                <input id="dia-tts-char-save" class="menu_button" type="button" value="Create Custom Voice" />

                <div id="dia-tts-char-list" style="margin-top:15px; border-top:1px solid var(--SmartThemeBorderColor); padding-top:10px;">
                    <small><i>Custom voices will appear in the main voice selection dropdown above.</i></small>
                </div>
            </div>
        `;
    }

    _renderHelpText() {
        return `
            <small style="margin-top:10px; display:block; color: var(--SmartThemeQuoteColor);">
                <strong>Note:</strong> Dia TTS uses speaker tags [S1] and [S2]. The provider automatically adds appropriate tags based on character context.
                <br><br>
                <strong>Role-Based Input:</strong> Characters are automatically mapped to roles:
                <br>• User messages → [S1] tag (user role)
                <br>• Character messages → [S2] tag (assistant role)
                <br>• System/Narrator → [S2] tag (system role)
                <br><br>
                <strong>Voice Cloning:</strong> For best results when cloning voices:
                <br>• Use 3-10 seconds of clear audio (no background noise/music)
                <br>• Add a transcript of what's said in the audio file
                <br>• Include speaker tags in the transcript ([S1] for user voices)
                <br>• Voice cloning works best with similar text content
                <br><br>
                <strong>Worker Queue:</strong> When enabled, requests are processed asynchronously using the server's worker pool for better performance.
                <br><br>
                <strong>Troubleshooting:</strong> If TTS only plays the first message, check that:
                <br>• Auto Generation is enabled in TTS settings
                <br>• Narrate User Messages is enabled (if you want user messages read)
                <br>• No content filters are blocking subsequent messages
                <br>• Click "Debug TTS Settings" above for detailed diagnostics
            </small>
        `;
    }

    // Logging helper
    log(...args) {
        console.log(`${DIA_CONSTANTS.LOG_PREFIX}`, ...args);
    }

    warn(...args) {
        console.warn(`${DIA_CONSTANTS.LOG_PREFIX}`, ...args);
    }

    error(...args) {
        console.error(`${DIA_CONSTANTS.LOG_PREFIX}`, ...args);
    }

    /**
     * Handle API errors consistently
     * @param {Response} response - The fetch response
     * @param {string} operation - Description of the operation
     * @returns {Promise<string>} Error message
     * @private
     */
    async _handleApiError(response, operation) {
        const errorText = await response.text().catch(() => 'Unknown error');
        let errorDetail = errorText;

        try {
            const errorJson = JSON.parse(errorText);
            errorDetail = errorJson.detail || errorText;
        } catch (e) {
            // If not JSON, use the raw text
        }

        this.error(`${operation} failed - HTTP ${response.status}: ${errorDetail}`);
        return errorDetail;
    }

    get settingsHtml() {
        const settings = this.settings || this.defaultSettings;
        this.log('Generating settings HTML', settings);

        return `
            <div class="dia_tts_settings">
                ${this._renderConnectionSettings(settings)}
                <hr>
                ${this._renderModelParameters(settings)}
                <hr>
                ${this._renderVoiceCloning()}
                <input id="dia-debug-tts" class="menu_button" type="button" value="Debug TTS Settings" style="margin-top:10px;" />
                ${this._renderHelpText()}
            </div>
        `;
    }

    /**
     * Load and initialize settings
     * @param {DiaTtsSettings} settingsFromMainExtension - Settings from the main TTS extension
     */
    async loadSettings(settingsFromMainExtension) {
        if (!settingsFromMainExtension) {
            this.warn('No settings object provided by main extension.');
            this.settings = JSON.parse(JSON.stringify(this.defaultSettings));
        } else {
            this.settings = settingsFromMainExtension;
        }

        // Ensure all default keys exist
        this._mergeDefaultSettings();

        this.log('Provider configured with settings:', this.settings);

        // Setup UI event handlers
        setTimeout(() => {
            this.setupEventHandlers();
            this.renderCharMappingList();
            this.loadCustomVoices();
        }, 0);

        await this.checkReady();
    }

    /**
     * Merge default settings with loaded settings
     * @private
     */
    _mergeDefaultSettings() {
        for (const key in this.defaultSettings) {
            if (this.settings[key] === undefined) {
                if (typeof this.defaultSettings[key] === 'object' && this.defaultSettings[key] !== null) {
                    this.settings[key] = JSON.parse(JSON.stringify(this.defaultSettings[key]));
                } else {
                    this.settings[key] = this.defaultSettings[key];
                }
            }
        }
    }

    /**
     * Setup all event handlers for the UI
     */
    setupEventHandlers() {
        this._setupConnectionHandlers();
        this._setupParameterHandlers();
        this._setupPresetHandlers();
        this._setupVoiceCloningHandlers();
        this._setupUtilityHandlers();

        // Populate character dropdown
        this.populateCharacterDropdown();

        // Refresh dropdown after a delay to ensure context is loaded
        setTimeout(() => {
            this.populateCharacterDropdown();
        }, 1000);
    }

    /**
     * Setup handlers for connection settings
     * @private
     */
    _setupConnectionHandlers() {
        const endpointInput = document.getElementById('dia-tts-endpoint');
        const apiKeyInput = document.getElementById('dia-tts-apikey');

        if (endpointInput instanceof HTMLInputElement) {
            endpointInput.addEventListener('change', (e) => {
                if (e.target instanceof HTMLInputElement) this.settings.endpoint = e.target.value;
                saveTtsProviderSettings();
            });
        }

        if (apiKeyInput instanceof HTMLInputElement) {
            apiKeyInput.addEventListener('change', (e) => {
                if (e.target instanceof HTMLInputElement) this.settings.apiKey = e.target.value;
                saveTtsProviderSettings();
            });
        }
    }

    /**
     * Setup handlers for model parameters
     * @private
     */
    _setupParameterHandlers() {
        const temperatureSlider = document.getElementById('dia-temperature');
        const cfgScaleSlider = document.getElementById('dia-cfg-scale');
        const topPSlider = document.getElementById('dia-top-p');
        const maxTokensSlider = document.getElementById('dia-max-tokens');
        const asyncModeCheckbox = document.getElementById('dia-async-mode');
        const asyncTimeoutSlider = document.getElementById('dia-async-timeout');

        // Setup model parameter sliders
        this.setupParameterSlider(temperatureSlider, 'temperature', 'dia-temperature-output');
        this.setupParameterSlider(cfgScaleSlider, 'cfg_scale', 'dia-cfg-scale-output');
        this.setupParameterSlider(topPSlider, 'top_p', 'dia-top-p-output');
        this.setupParameterSlider(maxTokensSlider, 'max_tokens', 'dia-max-tokens-output');

        // Setup async timeout slider (with custom handler for seconds conversion)
        if (asyncTimeoutSlider) {
            const timeoutOutput = document.getElementById('dia-async-timeout-output');
            asyncTimeoutSlider.addEventListener('input', (e) => {
                if (e.target instanceof HTMLInputElement) {
                    const value = parseInt(e.target.value);
                    this.settings.async_timeout = value;
                    if (timeoutOutput) {
                        timeoutOutput.textContent = `${Math.round(value / 1000)}s`;
                    }
                    saveTtsProviderSettings();
                }
            });
        }

        // Setup async mode checkbox
        if (asyncModeCheckbox instanceof HTMLInputElement) {
            asyncModeCheckbox.addEventListener('change', (e) => {
                if (e.target instanceof HTMLInputElement) {
                    this.settings.use_async_mode = e.target.checked;
                    saveTtsProviderSettings();
                    this.log(`Async mode ${e.target.checked ? 'enabled' : 'disabled'}`);
                }
            });
        }
    }

    /**
     * Setup handlers for preset buttons
     * @private
     */
    _setupPresetHandlers() {
        const presetButtons = {
            'dia-preset-quality': 'quality',
            'dia-preset-natural': 'natural',
            'dia-preset-fast': 'fast',
            'dia-preset-default': 'default',
        };

        Object.entries(presetButtons).forEach(([id, preset]) => {
            const button = document.getElementById(id);
            if (button) {
                button.addEventListener('click', () => this.applyPreset(preset));
            }
        });
    }

    /**
     * Setup handlers for voice cloning
     * @private
     */
    _setupVoiceCloningHandlers() {
        const charSelect = document.getElementById('dia-tts-char-select');
        const voiceNameInput = document.getElementById('dia-tts-voice-name');
        const uploadBtn = document.getElementById('dia-upload-voice-sample');
        const upload = document.getElementById('dia-tts-char-upload');
        const saveBtn = document.getElementById('dia-tts-char-save');
        const refreshBtn = document.getElementById('dia-refresh-characters');

        // Handle refresh button click
        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.populateCharacterDropdown();
                toastr.info('Character list refreshed');
            });
        }

        // Handle upload button click
        if (uploadBtn && upload) {
            uploadBtn.addEventListener('click', () => {
                upload.click();
            });
        }

        // Handle file selection
        if (upload instanceof HTMLInputElement) {
            upload.addEventListener('change', (e) => {
                const target = e.target;
                const file = (target instanceof HTMLInputElement && target.files) ? target.files[0] : null;
                if (file && uploadBtn) {
                    uploadBtn.innerHTML = `
                        <i class="fa-solid fa-file-check"></i>
                        <span>${file.name}</span>
                    `;
                } else {
                    uploadBtn.innerHTML = `
                        <i class="fa-solid fa-file-import"></i>
                        <span>Upload Voice Sample</span>
                    `;
                }
            });
        }

        // Handle save custom voice
        if (saveBtn && charSelect instanceof HTMLSelectElement && voiceNameInput instanceof HTMLInputElement && upload instanceof HTMLInputElement) {
            saveBtn.onclick = async () => {
                await this._handleCustomVoiceSave(charSelect, voiceNameInput, upload, uploadBtn, saveBtn);
            };
        }
    }

    /**
     * Setup utility button handlers
     * @private
     */
    _setupUtilityHandlers() {
        const debugBtn = document.getElementById('dia-debug-tts');

        if (debugBtn) {
            debugBtn.addEventListener('click', () => {
                this.debugTtsSettings();
            });
        }
    }

    /**
     * Handle custom voice save operation
     * @private
     */
    async _handleCustomVoiceSave(charSelect, voiceNameInput, upload, uploadBtn, saveBtn) {
        const charName = charSelect.value;
        if (!charName) {
            toastr.error('Please select a character');
            return;
        }

        const file = upload.files ? upload.files[0] : null;
        if (!file) {
            toastr.error('Please upload a voice sample');
            return;
        }

        if (!DIA_CONSTANTS.SUPPORTED_FORMATS.test(file.name)) {
            toastr.error('Please select an audio file (.wav, .mp3, .ogg, .m4a, .flac, .aac)');
            return;
        }

        // Get transcript if available
        const transcriptTextarea = document.getElementById('dia-tts-transcript');
        let transcript = '';
        if (transcriptTextarea instanceof HTMLTextAreaElement) {
            transcript = transcriptTextarea.value.trim();
        }
        // Add default speaker tag if not present and not empty
        if (transcript && !transcript.startsWith('[S1]') && !transcript.startsWith('[S2]')) {
            transcript = `[S1] ${transcript}`;
        }

        try {
            // Disable button and show progress
            if (saveBtn instanceof HTMLButtonElement) {
                saveBtn.disabled = true;
            } else if (saveBtn instanceof HTMLInputElement) {
                saveBtn.value = 'Creating Voice...';
            }

            // Generate voice name
            let voiceName = voiceNameInput.value.trim();
            if (!voiceName) {
                voiceName = `${charName}_voice`;
            }
            const customVoiceId = voiceName.toLowerCase().replace(/[^a-z0-9]/g, '_');

            // Upload audio prompt
            toastr.info('Uploading voice sample...');
            const promptId = await this.uploadAudioPrompt(customVoiceId, file);

            // Create voice mapping
            toastr.info('Creating voice mapping...');
            await this.createVoiceMapping(customVoiceId, promptId, transcript || null);

            // Add to custom voices list
            if (!this.settings.customVoices.includes(customVoiceId)) {
                this.settings.customVoices.push(customVoiceId);
            }

            saveTtsProviderSettings();
            this.renderCharMappingList();
            toastr.success(`Custom voice "${customVoiceId}" created successfully`);

            // Clear inputs
            charSelect.value = '';
            voiceNameInput.value = '';
            upload.value = '';
            if (transcriptTextarea instanceof HTMLTextAreaElement) {
                transcriptTextarea.value = '';
            }
            if (uploadBtn) {
                uploadBtn.innerHTML = `
                    <i class="fa-solid fa-file-import"></i>
                    <span>Upload Voice Sample</span>
                `;
            }
        } catch (error) {
            this.error('Error creating custom voice:', error);
            toastr.error(`Failed to create custom voice: ${error.message}`);
        } finally {
            // Re-enable button
            if (saveBtn instanceof HTMLButtonElement) {
                saveBtn.disabled = false;
            } else if (saveBtn instanceof HTMLInputElement) {
                saveBtn.value = 'Create Custom Voice';
            }
        }
    }

    /**
     * Setup parameter slider with output display
     * @param {HTMLElement} slider - The slider element
     * @param {string} settingKey - The setting key to update
     * @param {string} outputElementId - The output element ID
     */
    setupParameterSlider(slider, settingKey, outputElementId) {
        if (!slider) return;

        const outputElement = document.getElementById(outputElementId);

        slider.addEventListener('input', (e) => {
            if (e.target instanceof HTMLInputElement) {
                const value = parseFloat(e.target.value);
                this.settings[settingKey] = value;

                if (outputElement) {
                    outputElement.textContent = String(value);
                }

                saveTtsProviderSettings();
            }
        });
    }

    /**
     * Apply a preset configuration
     * @param {string} presetName - The name of the preset to apply
     */
    applyPreset(presetName) {
        const preset = PRESET_CONFIGS[presetName];
        if (!preset) return;

        // Apply preset values
        Object.assign(this.settings, preset);
        saveTtsProviderSettings();

        // Update sliders and output displays
        this.updateSliderValues();

        toastr.success(`Applied ${presetName} preset`);
    }

    updateSliderValues() {
        const sliders = [
            { id: 'dia-temperature', key: 'temperature', output: 'dia-temperature-output' },
            { id: 'dia-cfg-scale', key: 'cfg_scale', output: 'dia-cfg-scale-output' },
            { id: 'dia-top-p', key: 'top_p', output: 'dia-top-p-output' },
            { id: 'dia-max-tokens', key: 'max_tokens', output: 'dia-max-tokens-output' },
        ];

        sliders.forEach(({ id, key, output }) => {
            const slider = document.getElementById(id);
            const outputElement = document.getElementById(output);

            if (slider instanceof HTMLInputElement && this.settings[key] !== undefined) {
                slider.value = String(this.settings[key]);
            }
            if (outputElement && this.settings[key] !== undefined) {
                outputElement.textContent = String(this.settings[key]);
            }
        });

        // Handle async timeout slider separately (with seconds conversion)
        const asyncTimeoutSlider = document.getElementById('dia-async-timeout');
        const asyncTimeoutOutput = document.getElementById('dia-async-timeout-output');
        if (asyncTimeoutSlider instanceof HTMLInputElement && this.settings.async_timeout !== undefined) {
            asyncTimeoutSlider.value = String(this.settings.async_timeout);
        }
        if (asyncTimeoutOutput && this.settings.async_timeout !== undefined) {
            asyncTimeoutOutput.textContent = `${Math.round(this.settings.async_timeout / 1000)}s`;
        }

        // Handle async mode checkbox
        const asyncModeCheckbox = document.getElementById('dia-async-mode');
        if (asyncModeCheckbox instanceof HTMLInputElement && this.settings.use_async_mode !== undefined) {
            asyncModeCheckbox.checked = this.settings.use_async_mode;
        }
    }

    /**
     * Debug TTS settings and configuration
     */
    debugTtsSettings() {
        // For debugging, we use console.log directly for better visibility
        console.log('🔍 === DIA TTS DEBUG INFO ===');
        console.log('🎵 Dia Provider Settings:', this.settings);

        if (typeof extension_settings !== 'undefined' && extension_settings.tts) {
            console.log('🔧 TTS Extension Settings:', extension_settings.tts);

            // Check critical settings
            const issues = [];
            if (!extension_settings.tts.enabled) {
                issues.push('❌ TTS is disabled - enable it in TTS settings');
            }
            if (!extension_settings.tts.auto_generation) {
                issues.push('❌ Auto Generation is disabled - enable it to automatically narrate new messages');
            }
            if (extension_settings.tts.currentProvider !== 'Dia') {
                issues.push(`❌ Current provider is "${extension_settings.tts.currentProvider}" not "Dia"`);
            }

            if (issues.length > 0) {
                console.log('⚠️ POTENTIAL ISSUES FOUND:');
                issues.forEach(issue => console.log(issue));
            } else {
                console.log('✅ Main TTS settings look good!');
            }
        }

        // Check voice mappings
        console.log('👥 Character Voice Mappings:');
        if (this.settings.voiceMappings && Object.keys(this.settings.voiceMappings).length > 0) {
            for (const [char, voice] of Object.entries(this.settings.voiceMappings)) {
                console.log(`  - ${char}: ${voice}`);
            }
        } else {
            console.log('  - No character voice mappings configured');
        }

        // Check custom voices
        console.log('👥 Custom Voices:');
        if (this.settings.customVoices && this.settings.customVoices.length > 0) {
            this.settings.customVoices.forEach(voice => {
                console.log(`  - ${voice}`);
            });
        } else {
            console.log('  - No custom voices created');
        }

        // Call the global debug function if available
        if (typeof window['debugTtsPlayback'] === 'function') {
            console.log('📊 Full TTS Debug Info:');
            window['debugTtsPlayback']();
        }

        console.log('🔍 === END DEBUG INFO ===');
        toastr.info('TTS debug info logged to console (F12)');
    }

    /**
     * Populate character dropdown with available characters
     */
    populateCharacterDropdown() {
        const charSelect = document.getElementById('dia-tts-char-select');
        if (!charSelect) return;

        // Clear existing options except the first one
        charSelect.innerHTML = '<option value="">Select Character...</option>';

        try {
            const context = getContext();
            this.log('Context object:', context);

            let characters = [];

            if (context.groupId === null) {
                // Single character chat
                if (context.name2) {
                    characters.push(context.name2); // Character name
                }
                if (context.name1) {
                    characters.push(context.name1); // User name
                }
            } else {
                // Group chat
                if (context.name1) {
                    characters.push(context.name1); // User name
                }

                // Get group members
                const group = context.groups?.find(group => context.groupId == group.id);
                if (group && group.members) {
                    for (let member of group.members) {
                        const character = context.characters?.find(char => char.avatar === member);
                        if (character && character.name) {
                            characters.push(character.name);
                        }
                    }
                }
            }

            // Also try to get all characters if available
            if (context.characters && context.characters.length > 0) {
                const allCharNames = context.characters.map(char => char.name).filter(name => name);
                characters = [...characters, ...allCharNames].filter((name, index, arr) => arr.indexOf(name) === index);
            }

            // Remove duplicates and filter out empty names
            characters = characters.filter((name, index, arr) => name && arr.indexOf(name) === index);

            // Add characters to dropdown
            characters.forEach(charName => {
                const option = document.createElement('option');
                option.value = charName;
                option.textContent = charName;
                charSelect.appendChild(option);
            });

            this.log(`Populated character dropdown with ${characters.length} characters:`, characters);
        } catch (error) {
            this.warn('Could not populate character dropdown:', error.message);
        }
    }

    async uploadAudioPrompt(promptId, file, retryCount = 0) {
        const formData = new FormData();
        formData.append('prompt_id', promptId);
        formData.append('audio_file', file);

        try {
            const response = await fetch(`${this.settings.endpoint}/audio_prompts/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.settings.apiKey}`,
                },
                body: formData,
            });

            if (!response.ok) {
                const errorDetail = await this._handleApiError(response, 'Audio prompt upload');

                // Check if it's a file lock error that might be retryable
                if (errorDetail.includes('being used by another process') && retryCount < DIA_CONSTANTS.MAX_RETRIES) {
                    this.warn(`File lock error, retrying in ${(retryCount + 1) * 1000}ms... (attempt ${retryCount + 1}/${DIA_CONSTANTS.MAX_RETRIES + 1})`);

                    // Wait before retrying
                    await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 1000));
                    return this.uploadAudioPrompt(promptId, file, retryCount + 1);
                }

                // More user-friendly error messages
                if (errorDetail.includes('being used by another process')) {
                    throw new Error('Audio file is temporarily locked. Please try again in a few moments, or try using a different audio file.');
                } else if (errorDetail.includes('Failed to process audio file')) {
                    throw new Error('Failed to process audio file. Please ensure it\'s a valid audio format (.wav, .mp3, .ogg, .m4a, .flac, .aac).');
                } else {
                    throw new Error(`Upload failed: ${errorDetail}`);
                }
            }

            const result = await response.json();
            this.log('Audio prompt uploaded successfully:', result);
            return promptId;

        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Cannot connect to Dia server. Please check if the server is running and the endpoint URL is correct.');
            }
            throw error;
        }
    }

    async createVoiceMapping(voiceId, audioPrompt, transcript) {
        const response = await fetch(`${this.settings.endpoint}/voice_mappings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.settings.apiKey}`,
            },
            body: JSON.stringify({
                voice_id: voiceId,
                style: 'natural',
                primary_speaker: 'S1',
                audio_prompt: audioPrompt,
                audio_prompt_transcript: transcript || `[S1] This is a voice sample for ${voiceId}.`,
            }),
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to create voice mapping: ${error}`);
        }

        const result = await response.json();
        this.log('Voice mapping created:', result);
        return result;
    }

    async loadCustomVoices() {
        if (!this.settings || !this.settings.endpoint) {
            this.warn('Settings not initialized, skipping custom voice loading');
            return;
        }

        try {
            const response = await fetch(`${this.settings.endpoint}/voice_mappings`, {
                headers: {
                    'Authorization': `Bearer ${this.settings.apiKey}`,
                },
            });

            if (response.ok) {
                const voiceMappings = await response.json();
                const voiceSelect = document.getElementById('dia-tts-voice-select');

                if (voiceSelect instanceof HTMLSelectElement) {
                    // Add custom voices to dropdown
                    for (const mapping of voiceMappings) {
                        if (!Array.from(voiceSelect.options).some(opt => opt.value === mapping.voice_id)) {
                            const option = document.createElement('option');
                            option.value = mapping.voice_id;
                            option.textContent = `${mapping.voice_id} (Custom)`;
                            voiceSelect.appendChild(option);
                        }
                    }
                }
            }
        } catch (error) {
            this.warn('Could not load custom voices:', error.message);
        }
    }

    async checkReady() {
        if (!this.settings || !this.settings.endpoint) {
            this.warn('Settings not initialized, skipping health check');
            return false;
        }

        try {
            const response = await fetch(`${this.settings.endpoint}/health`);
            if (response.ok) {
                this.log('Server is ready');
                return true;
            } else {
                this.warn(`Server health check returned ${response.status}`);
            }
        } catch (error) {
            this.warn('Server health check failed:', error.message);
        }
        return false;
    }

    async onRefreshClick() {
        await this.checkReady();
        await this.loadCustomVoices();
    }

    async getVoice(voiceName) {
        return {
            name: voiceName,
            voice_id: voiceName,
            preview_url: '',
        };
    }

    /**
     * Fetch available TTS voice objects
     * @returns {Promise<Array>} Array of voice objects
     */
    async fetchTtsVoiceObjects() {
        this.log('Fetching available voices');

        const voices = [...BUILT_IN_VOICES];

        // Add custom voices if settings are available
        if (this.settings?.customVoices && Array.isArray(this.settings.customVoices)) {
            for (const customVoice of this.settings.customVoices) {
                voices.push({
                    name: `${customVoice} (Custom)`,
                    voice_id: customVoice,
                    preview_url: '',
                    lang: 'en-US',
                    description: 'Custom cloned voice',
                });
            }
        }

        this.log(`Returning ${voices.length} voice objects:`, voices);
        return voices;
    }

    async generateTts(text, voiceId, char) {
        if (!this.settings) {
            this.warn('Settings not initialized, using defaults');
            this.settings = { ...this.defaultSettings };
        }

        this.log('🎵 generateTts() called!');
        this.log(`📝 Text: "${text}"`);
        this.log(`🎙️ Voice ID: "${voiceId}"`);
        this.log(`👤 Character: "${char}"`);
        this.log('⚙️ Dia Settings:', this.settings);

        // Check TTS extension settings
        if (typeof extension_settings !== 'undefined' && extension_settings.tts) {
            this.log('🔧 TTS Extension Settings:', {
                enabled: extension_settings.tts.enabled,
                auto_generation: extension_settings.tts.auto_generation,
                narrate_user: extension_settings.tts.narrate_user,
                narrate_dialogues_only: extension_settings.tts.narrate_dialogues_only,
                narrate_quoted_only: extension_settings.tts.narrate_quoted_only,
                currentProvider: extension_settings.tts.currentProvider,
            });
        }

        // Determine voice to use - check character mapping first
        let selectedVoice = voiceId;
        if (char && this.settings.voiceMappings && this.settings.voiceMappings[char]) {
            selectedVoice = this.settings.voiceMappings[char];
            this.log(`🔄 Using mapped voice "${selectedVoice}" for character "${char}"`);
        }

        // Map character to role
        let role = 'assistant';
        if (char) {
            const c = char.toLowerCase();
            if (c === 'user' || c === 'you') {
                role = 'user';
            } else if (c === 'system' || c === 'narrator') {
                role = 'system';
            }
        }

        // Add speaker tags based on role
        let speakerTag = DIA_CONSTANTS.ASSISTANT_SPEAKER_TAG;
        if (role === 'user') {
            speakerTag = DIA_CONSTANTS.USER_SPEAKER_TAG;
        } else if (role === 'system') {
            speakerTag = DIA_CONSTANTS.SYSTEM_SPEAKER_TAG;
        }
        const formattedText = `${speakerTag} ${text} ${speakerTag}`;

        try {
            // Check if async mode is enabled
            const useAsync = this.settings.use_async_mode;

            if (useAsync) {
                this.log('Using async worker queue mode');
                return await this.generateTtsAsync(formattedText, selectedVoice, role);
            } else {
                this.log('Using synchronous mode');
                return await this.generateTtsSync(formattedText, selectedVoice, role);
            }

        } catch (error) {
            this.error('Error in generateTts:', error);
            throw error;
        }
    }

    async generateTtsSync(formattedText, selectedVoice, role) {
        const endpoint = `${this.settings.endpoint}/generate`;

        const payload = {
            text: formattedText,
            voice_id: selectedVoice,
            temperature: this.settings.temperature || this.defaultSettings.temperature,
            cfg_scale: this.settings.cfg_scale || this.defaultSettings.cfg_scale,
            top_p: this.settings.top_p || this.defaultSettings.top_p,
            max_tokens: this.settings.max_tokens || this.defaultSettings.max_tokens,
            role: role || 'assistant',
        };

        this.log(`Sending sync request to ${endpoint}`, payload);

        const response = await fetch(endpoint, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.settings.apiKey}`,
            },
            body: JSON.stringify(payload),
        });

        if (!response.ok) {
            const errorText = await response.text().catch(() => 'Unknown error');
            this.error(`HTTP ${response.status}: ${errorText}`);
            throw new Error(`Dia TTS: HTTP ${response.status} - ${errorText}`);
        }

        this.log('Successfully received sync audio response');
        return response;
    }

    async generateTtsAsync(formattedText, selectedVoice, role) {
        const endpoint = `${this.settings.endpoint}/generate`;

        const payload = {
            text: formattedText,
            voice_id: selectedVoice,
            temperature: this.settings.temperature || this.defaultSettings.temperature,
            cfg_scale: this.settings.cfg_scale || this.defaultSettings.cfg_scale,
            top_p: this.settings.top_p || this.defaultSettings.top_p,
            max_tokens: this.settings.max_tokens || this.defaultSettings.max_tokens,
            role: role || 'assistant',
        };

        this.log(`Sending async request to ${endpoint}?async_mode=true`, payload);

        // Step 1: Submit job to worker queue
        const jobResponse = await fetch(`${endpoint}?async_mode=true`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.settings.apiKey}`,
            },
            body: JSON.stringify(payload),
        });

        if (!jobResponse.ok) {
            const errorText = await jobResponse.text().catch(() => 'Unknown error');
            this.error(`Async job submission failed ${jobResponse.status}: ${errorText}`);
            throw new Error(`Dia TTS: Async job submission failed ${jobResponse.status} - ${errorText}`);
        }

        const jobInfo = await jobResponse.json();
        const jobId = jobInfo.job_id;
        this.log(`Job submitted successfully, job_id: ${jobId}`);

        // Step 2: Poll for job completion
        const timeout = this.settings.async_timeout || this.defaultSettings.async_timeout;
        const startTime = Date.now();
        const pollInterval = 1000; // Poll every 1 second

        while (Date.now() - startTime < timeout) {
            this.log(`Polling job status for ${jobId}`);

            const statusResponse = await fetch(`${this.settings.endpoint}/jobs/${jobId}`, {
                method: 'GET',
                headers: {
                    'Authorization': `Bearer ${this.settings.apiKey}`,
                },
            });

            if (!statusResponse.ok) {
                const errorText = await statusResponse.text().catch(() => 'Unknown error');
                this.error(`Job status check failed ${statusResponse.status}: ${errorText}`);
                throw new Error(`Dia TTS: Job status check failed ${statusResponse.status} - ${errorText}`);
            }

            const status = await statusResponse.json();
            this.log(`Job ${jobId} status:`, status);

            if (status.status === 'completed') {
                this.log(`Job ${jobId} completed successfully`);

                // Step 3: Retrieve the result
                const resultResponse = await fetch(`${this.settings.endpoint}/jobs/${jobId}/result`, {
                    method: 'GET',
                    headers: {
                        'Authorization': `Bearer ${this.settings.apiKey}`,
                    },
                });

                if (!resultResponse.ok) {
                    const errorText = await resultResponse.text().catch(() => 'Unknown error');
                    this.error(`Job result retrieval failed ${resultResponse.status}: ${errorText}`);
                    throw new Error(`Dia TTS: Job result retrieval failed ${resultResponse.status} - ${errorText}`);
                }

                this.log('Successfully retrieved async audio response');
                return resultResponse;

            } else if (status.status === 'failed') {
                const errorMsg = status.error || 'Job failed with unknown error';
                this.error(`Job ${jobId} failed:`, errorMsg);
                throw new Error(`Dia TTS: Job failed - ${errorMsg}`);
            }

            // Job is still pending/running, wait before next poll
            await new Promise(resolve => setTimeout(resolve, pollInterval));
        }

        // Timeout reached
        this.error(`Job ${jobId} timed out after ${timeout}ms`);
        throw new Error(`Dia TTS: Job timed out after ${timeout / 1000} seconds`);
    }

    async previewTtsVoice(id) {
        if (!this.settings) {
            this.warn('Settings not initialized for preview, using defaults');
            this.settings = { ...this.defaultSettings };
        }
        this.audioElement.pause();
        this.audioElement.currentTime = 0;

        const text = getPreviewString('en-US');
        const response = await this.generateTts(text, id);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const audio = await response.blob();
        const url = URL.createObjectURL(audio);
        this.audioElement.src = url;
        this.audioElement.play();
        this.audioElement.onended = () => URL.revokeObjectURL(url);
    }

    dispose() {
        this.audioElement.pause();
        this.audioElement.src = '';
    }

    renderCharMappingList() {
        const listDiv = document.getElementById('dia-tts-char-list');
        if (!listDiv) return;

        const customVoices = this.settings.customVoices || [];

        if (customVoices.length === 0) {
            listDiv.innerHTML = '<small><i>No custom voices created yet. Custom voices will appear in the main voice selection dropdown above.</i></small>';
            return;
        }

        listDiv.innerHTML = '<small><strong>Custom Voices Created:</strong></small><br>';

        customVoices.forEach(voiceId => {
            const voiceDiv = document.createElement('div');
            voiceDiv.style.display = 'flex';
            voiceDiv.style.alignItems = 'center';
            voiceDiv.style.marginBottom = '5px';
            voiceDiv.style.justifyContent = 'space-between';
            voiceDiv.style.padding = '2px 5px';
            voiceDiv.style.background = 'var(--SmartThemeBlurTintColor)';
            voiceDiv.style.borderRadius = '3px';

            const nameSpan = document.createElement('small');
            nameSpan.textContent = voiceId;
            voiceDiv.appendChild(nameSpan);

            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = '<i class="fa-solid fa-trash"></i>';
            deleteButton.style.border = 'none';
            deleteButton.style.background = 'transparent';
            deleteButton.style.color = 'var(--SmartThemeQuoteColor)';
            deleteButton.style.cursor = 'pointer';
            deleteButton.title = `Delete custom voice ${voiceId}`;
            deleteButton.onclick = () => this.removeCustomVoice(voiceId);

            voiceDiv.appendChild(deleteButton);
            listDiv.appendChild(voiceDiv);
        });

        const note = document.createElement('small');
        note.innerHTML = '<br><i>Use the Voice Map section above to assign these custom voices to characters.</i>';
        listDiv.appendChild(note);
    }

    async removeCustomVoice(voiceId) {
        if (!this.settings.customVoices) return;

        try {
            // Remove from server if possible
            const response = await fetch(`${this.settings.endpoint}/voice_mappings/${voiceId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.settings.apiKey}`,
                },
            });

            if (!response.ok) {
                this.warn(`Could not delete voice from server: ${response.status}`);
            }
        } catch (error) {
            this.warn('Error deleting voice from server:', error.message);
        }

        // Remove from local settings
        const index = this.settings.customVoices.indexOf(voiceId);
        if (index > -1) {
            this.settings.customVoices.splice(index, 1);
            saveTtsProviderSettings();
            this.renderCharMappingList();
            toastr.success(`Deleted custom voice: ${voiceId}`);
        }
    }

    removeCharacterVoiceMapping(charName) {
        if (!this.settings.voiceMappings) return;

        if (this.settings.voiceMappings[charName]) {
            delete this.settings.voiceMappings[charName];
            saveTtsProviderSettings();
            this.renderCharMappingList();
            toastr.success(`Removed voice mapping for ${charName}`);
        }
    }
}
