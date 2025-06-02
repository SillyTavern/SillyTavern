import { getContext } from '../../extensions.js';
import { saveTtsProviderSettings, getPreviewString } from './index.js';
import { extension_settings } from '../../extensions.js';

export { DiaTtsProvider };

/**
 * @typedef {Object} Toastr
 * @property {function(string): void} success - Display success message
 * @property {function(string): void} error - Display error message
 * @property {function(string): void} info - Display info message
 * @property {function(string): void} warning - Display warning message
 */

/** @type {Toastr} */
// @ts-ignore
const toastr = window.toastr;

/**
 * @typedef {Object} DiaTtsSettings
 * @property {string} endpoint - API endpoint URL
 * @property {string} apiKey - API authentication key
 * @property {Object.<string, string>} voiceMappings - Character to voice ID mappings
 * @property {string[]} customVoices - List of custom voice IDs
 * @property {number} temperature - Generation randomness (0.1-2.0)
 * @property {number} cfg_scale - Classifier-free guidance scale (1.0-10.0)
 * @property {number} top_p - Nucleus sampling threshold (0.0-1.0)
 * @property {number} max_tokens - Maximum tokens to generate (100-10000)
 * @property {number} speed - Speech speed (0.25-4.0)
 * @property {boolean} asyncMode - Use async mode for long texts
 */

// Constants
const DIA_CONSTANTS = {
    LOG_PREFIX: 'DiaTTS:',
    POLL_INTERVAL: 1000,
    MAX_RETRIES: 2,
    SUPPORTED_FORMATS: /\.(wav|mp3|ogg|m4a|flac|aac)$/i
};

const PRESET_CONFIGS = {
    quality: {
        temperature: 0.8,
        cfg_scale: 4.0,
        top_p: 0.8,
        max_tokens: 2000,
        speed: 1.0
    },
    natural: {
        temperature: 1.4,
        cfg_scale: 2.5,
        top_p: 0.95,
        max_tokens: 2000,
        speed: 1.0
    },
    fast: {
        temperature: 1.0,
        cfg_scale: 2.0,
        top_p: 0.9,
        max_tokens: 1000,
        speed: 1.2
    },
    default: {
        temperature: 1.2,
        cfg_scale: 3.0,
        top_p: 0.95,
        max_tokens: 2000,
        speed: 1.0
    },
};

// Note: Built-in voices are now fetched dynamically from the server
// No hardcoded voices needed as the server provides the available voice list

/**
 * Dia TTS Provider implementation
 * Supports text-to-speech generation with voice cloning and role-based input
 */
class DiaTtsProvider {
    //########//
    // Config //
    //########//

    /** @type {DiaTtsSettings} */
    settings;

    constructor() {
        // Initialize with default settings
        this.settings = {
            endpoint: 'http://localhost:7860',
            apiKey: 'sk-anything',
            voiceMappings: {},
            customVoices: [],
            temperature: 1.2,
            cfg_scale: 3.0,
            top_p: 0.95,
            max_tokens: 2000,
            speed: 1.0,
            asyncMode: false
        };
    }

    ready = false;
    voices = [];
    separator = ' ... ';
    audioElement = document.createElement('audio');

    //######//
    // HTML //
    //######//

    get settingsHtml() {
        let html = `<div class="dia-tts-settings">`;

        // Connection Settings
        html += this._renderConnectionSettings();
        html += `<hr>`;

        // Model Parameters
        html += this._renderModelParameters();
        html += `<hr>`;

        // Voice Cloning
        html += this._renderVoiceCloning();

        // Server Management
        html += this._renderServerManagement();
        html += `<hr>`;

        // Debug and Help
        html += `<input id="dia-debug-tts" class="menu_button" type="button" value="Debug TTS Settings" style="margin-top:10px;" />`;
        html += `<input id="dia-repair-voices" class="menu_button" type="button" value="Repair Voice Mappings" style="margin-top:5px; background: var(--SmartThemeQuoteColor);" />`;
        html += this._renderHelpText();

        html += `</div>`;
        return html;
    }

    _renderConnectionSettings() {
        return `
            <div class="dia-connection-settings">
                <span style="font-weight:bold;">Connection</span><br>
                <label for="dia-tts-endpoint">Endpoint URL</label>
                <input id="dia-tts-endpoint" type="text" class="text_pole" placeholder="http://localhost:7860" value="${this.settings.endpoint}" />
                <small><strong>Default:</strong> http://localhost:7860 (NOT 8000). Ensure Dia server is running.</small>

                <label for="dia-tts-apikey">API Key</label>
                <input id="dia-tts-apikey" type="text" class="text_pole" placeholder="sk-anything" value="${this.settings.apiKey}" />
                <small>API key (any string works with Dia)</small>

                <div style="margin-top:10px;">
                    <button id="dia-test-connection" class="menu_button" style="background: var(--SmartThemeQuoteColor); color: white; border: none; padding: 5px 10px; border-radius: 3px;">
                        Test Connection
                    </button>
                    <small id="dia-connection-status" style="margin-left: 10px; font-weight: bold;"></small>
                </div>
            </div>
        `;
    }

    _renderModelParameters() {
        return `
            <div class="dia-model-params">
                <span style="font-weight:bold;">Model Parameters</span><br>

                <label for="dia-temperature">Temperature: <span id="dia-temperature-output">${this.settings.temperature}</span></label>
                <input id="dia-temperature" type="range" value="${this.settings.temperature}" min="0.1" max="2.0" step="0.1" />
                <small>Controls randomness in generation (0.1 = consistent, 2.0 = creative)</small>

                <label for="dia-cfg-scale">CFG Scale: <span id="dia-cfg-scale-output">${this.settings.cfg_scale}</span></label>
                <input id="dia-cfg-scale" type="range" value="${this.settings.cfg_scale}" min="1.0" max="10.0" step="0.5" />
                <small>Classifier-free guidance strength (1.0 = weak, 10.0 = strong conditioning)</small>

                <label for="dia-top-p">Top P: <span id="dia-top-p-output">${this.settings.top_p}</span></label>
                <input id="dia-top-p" type="range" value="${this.settings.top_p}" min="0.1" max="1.0" step="0.05" />
                <small>Nucleus sampling threshold (0.1 = focused, 1.0 = diverse)</small>

                <label for="dia-max-tokens">Max Tokens: <span id="dia-max-tokens-output">${this.settings.max_tokens}</span></label>
                <input id="dia-max-tokens" type="range" value="${this.settings.max_tokens}" min="100" max="10000" step="100" />
                <small>Maximum tokens to generate (100 = short, 10000 = very long)</small>

                <label for="dia-speed">Speed: <span id="dia-speed-output">${this.settings.speed}</span></label>
                <input id="dia-speed" type="range" value="${this.settings.speed}" min="0.25" max="4.0" step="0.25" />
                <small>Speech speed (0.25 = very slow, 4.0 = very fast)</small>

                <div style="margin-top:10px;">
                    <label for="dia-async-mode" style="display: flex; align-items: center; gap: 5px;">
                        <input id="dia-async-mode" type="checkbox" ${this.settings.asyncMode ? 'checked' : ''} />
                        <span>Use Async Mode for long texts</span>
                    </label>
                    <small>Recommended for texts longer than 1000 characters</small>
                </div>

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
            <div class="dia-voice-cloning">
                <span style="font-weight:bold;">Voice Creation</span><br>

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

                <!-- Voice Creation Method Selection -->
                <div style="margin-top:15px; padding:10px; background:var(--SmartThemeBlurTintColor); border-radius:5px;">
                    <label style="font-weight:bold; color:var(--SmartThemeQuoteColor);">Voice Creation Method:</label><br>
                    <div style="margin-top:8px;">
                        <label style="display: flex; align-items: center; gap: 5px; margin-bottom: 5px;">
                            <input type="radio" name="dia-voice-method" value="audio" id="dia-method-audio" checked />
                            <span>Audio Sample (Voice Cloning)</span>
                        </label>
                        <label style="display: flex; align-items: center; gap: 5px;">
                            <input type="radio" name="dia-voice-method" value="seed" id="dia-method-seed" />
                            <span>Voice Seed (Random Generation)</span>
                        </label>
                    </div>
                </div>

                <!-- Audio Sample Method -->
                <div id="dia-audio-method" class="dia-voice-method-section">
                    <div class="menu_button menu_button_icon" id="dia-upload-voice-sample" style="margin-top:10px;">
                        <i class="fa-solid fa-file-import"></i>
                        <span>Upload Voice Sample</span>
                    </div>
                    <input id="dia-tts-char-upload" type="file" accept="audio/*" style="display:none;" />
                    <small>Upload 3-10 seconds of clean voice sample (.wav, .mp3, etc.)</small>
                </div>

                <!-- Voice Seed Method -->
                <div id="dia-seed-method" class="dia-voice-method-section" style="display:none;">
                    <label for="dia-voice-seed" style="margin-top:10px;">Voice Seed</label>
                    <div style="display: flex; gap: 5px; align-items: center;">
                        <input id="dia-voice-seed" type="number" class="text_pole" placeholder="Enter number (1-999999)" min="1" max="999999" style="flex: 1;" />
                        <div class="menu_button menu_button_icon" id="dia-random-seed" title="Generate random seed">
                            <i class="fa-solid fa-dice"></i>
                        </div>
                    </div>
                    <small>Enter a number to generate a consistent voice. Same seed = same voice.</small>
                </div>

                <input id="dia-tts-char-save" class="menu_button" type="button" value="Create Custom Voice" style="margin-top:15px;" />

                <div id="dia-tts-char-list" style="margin-top:15px; border-top:1px solid var(--SmartThemeBorderColor); padding-top:10px;">
                    <small><i>Custom voices will appear in the main voice selection dropdown above.</i></small>
                </div>

                <!-- Audio Prompt Management -->
                <div style="margin-top:15px; padding:10px; background:var(--SmartThemeBlurTintColor); border-radius:5px;">
                    <span style="font-weight:bold; color:var(--SmartThemeQuoteColor);">Audio Prompt Management</span><br>

                    <div style="display: flex; gap: 5px; margin-top: 8px; flex-wrap: wrap;">
                        <button id="dia-view-prompts" class="menu_button" style="font-size:11px; padding:4px 8px;">
                            View Audio Prompts
                        </button>
                        <button id="dia-transcribe-prompts" class="menu_button" style="font-size:11px; padding:4px 8px;">
                            Re-transcribe All
                        </button>
                        <button id="dia-whisper-status" class="menu_button" style="font-size:11px; padding:4px 8px;">
                            Whisper Status
                        </button>
                    </div>

                    <div id="dia-prompts-info" style="margin-top:8px; font-size:11px; color:var(--SmartThemeQuoteColor); max-height:150px; overflow-y:auto;">
                        <span>Audio prompt information will appear here...</span>
                    </div>
                </div>
            </div>
        `;
    }

    _renderServerManagement() {
        return `
            <div class="dia-server-management" style="margin-top:15px; padding:10px; background:var(--SmartThemeBlurTintColor); border-radius:5px;">
                <span style="font-weight:bold; color:var(--SmartThemeQuoteColor);">Server Management</span><br>

                <div style="display: flex; gap: 5px; margin-top: 8px; flex-wrap: wrap;">
                    <button id="dia-server-status" class="menu_button" style="font-size:11px; padding:4px 8px;">
                        Server Status
                    </button>
                    <button id="dia-queue-stats" class="menu_button" style="font-size:11px; padding:4px 8px;">
                        Queue Status
                    </button>
                    <button id="dia-generation-logs" class="menu_button" style="font-size:11px; padding:4px 8px;">
                        View Logs
                    </button>
                    <button id="dia-discover-prompts" class="menu_button" style="font-size:11px; padding:4px 8px;">
                        Discover Audio
                    </button>
                    <button id="dia-cleanup-server" class="menu_button" style="font-size:11px; padding:4px 8px; background: var(--SmartThemeQuoteColor);">
                        Cleanup Server
                    </button>
                </div>

                <div id="dia-server-info" style="margin-top:10px; font-size:11px; color:var(--SmartThemeQuoteColor);">
                    <span>Server information will appear here...</span>
                </div>
            </div>
        `;
    }

    _renderHelpText() {
        return `
            <small style="margin-top:10px; display:block; color: var(--SmartThemeQuoteColor);">
                <strong>Server Connection:</strong> Voices are fetched dynamically from the Dia server.
                <br>• Ensure the Dia server is running at the configured endpoint
                <br>• Available voices will appear in the main TTS voice selection dropdown
                <br>• If no voices appear, check the server connection and click "Refresh"
                <br><br>
                <strong>Role Mapping:</strong> The provider automatically maps character context:
                <br>• User messages → 'user' role
                <br>• Character messages → 'assistant' role
                <br>• System/Narrator → 'system' role
                <br><br>
                <strong>Voice Creation Methods:</strong>
                <br>• <strong>Audio Sample:</strong> Upload 3-10 seconds of clear audio for voice cloning
                <br>&nbsp;&nbsp;- Audio will be automatically transcribed using Whisper if available
                <br>&nbsp;&nbsp;- Works best with similar text content to the sample
                <br>&nbsp;&nbsp;- Supported formats: WAV, MP3, OGG, M4A, FLAC, AAC
                <br>• <strong>Voice Seed:</strong> Use a number (1-999999) to generate a consistent voice
                <br>&nbsp;&nbsp;- Same seed always produces the same voice characteristics
                <br>&nbsp;&nbsp;- No audio upload required - purely generated
                <br>&nbsp;&nbsp;- Good for consistent characters without reference audio
                <br><br>
                <strong>Troubleshooting:</strong> If TTS only plays the first message, check that:
                <br>• Auto Generation is enabled in TTS settings
                <br>• Narrate User Messages is enabled (if you want user messages read)
                <br>• Server is running at the correct endpoint URL (default: http://localhost:7860)
                <br>• Click "Debug TTS Settings" for detailed diagnostics
                <br>• Click "Repair Voice Mappings" if voices are missing after server restart
            </small>
        `;
    }

    //##################//
    // Settings Loading //
    //##################//

    async loadSettings(settingsFromMainExtension) {
        console.log('=== DIA TTS LOAD SETTINGS DEBUG ===');
        console.log('Settings from main extension:', settingsFromMainExtension);
        console.log('Current settings before merge:', this.settings);

        if (!settingsFromMainExtension) {
            console.warn('No settings object provided by main extension.');
            this.settings = { ...this.settings }; // Use defaults
        } else {
            // Merge settings but protect against incorrect endpoint defaults
            this.settings = { ...this.settings, ...settingsFromMainExtension };

            // If the endpoint is the problematic default 8000, reset to correct default
            if (this.settings.endpoint === 'http://localhost:8000' || this.settings.endpoint === 'http://127.0.0.1:8000') {
                console.warn('Detected incorrect default endpoint 8000, resetting to 7860');
                this.settings.endpoint = 'http://localhost:7860';

                // Save the corrected settings immediately
                setTimeout(() => {
                    this.onSettingsChange();
                    toastr.info('Corrected endpoint from 8000 to 7860');
                }, 200);
            }
        }

        console.log('Final merged settings:', this.settings);
        console.log('=== END DEBUG ===');

        // Setup UI after a delay to ensure DOM is ready
        setTimeout(() => {
            console.log('Setting up UI components...');
            this.setupEventListeners();
            this.applySettingsToHTML();
            this.populateCharacterDropdown();
            this.renderCustomVoicesList();
        }, 100);

        await this.checkReady();
    }

    applySettingsToHTML() {
        console.log('Applying settings to HTML, endpoint:', this.settings.endpoint);

        // Apply settings to HTML elements
        const elements = [
            { id: 'dia-tts-endpoint', value: this.settings.endpoint },
            { id: 'dia-tts-apikey', value: this.settings.apiKey },
            { id: 'dia-temperature', value: this.settings.temperature },
            { id: 'dia-cfg-scale', value: this.settings.cfg_scale },
            { id: 'dia-top-p', value: this.settings.top_p },
            { id: 'dia-max-tokens', value: this.settings.max_tokens },
            { id: 'dia-speed', value: this.settings.speed }
        ];

        elements.forEach(({ id, value }) => {
            const element = document.getElementById(id);
            if (element instanceof HTMLInputElement) {
                if (id === 'dia-tts-endpoint') {
                    console.log(`Setting endpoint input to: ${value}`);
                }
                element.value = String(value);
            } else {
                console.warn(`Element ${id} not found or not an input element:`, element);
            }
        });

        // Apply async mode checkbox
        const asyncModeCheckbox = document.getElementById('dia-async-mode');
        if (asyncModeCheckbox instanceof HTMLInputElement) {
            asyncModeCheckbox.checked = this.settings.asyncMode;
        }

        this.updateSliderOutputs();
    }

    updateSliderOutputs() {
        const sliders = [
            { id: 'dia-temperature', key: 'temperature', output: 'dia-temperature-output' },
            { id: 'dia-cfg-scale', key: 'cfg_scale', output: 'dia-cfg-scale-output' },
            { id: 'dia-top-p', key: 'top_p', output: 'dia-top-p-output' },
            { id: 'dia-max-tokens', key: 'max_tokens', output: 'dia-max-tokens-output' },
            { id: 'dia-speed', key: 'speed', output: 'dia-speed-output' }
        ];

        sliders.forEach(({ output, key }) => {
            const outputElement = document.getElementById(output);
            if (outputElement && this.settings[key] !== undefined) {
                outputElement.textContent = String(this.settings[key]);
            }
        });
    }

    //#################//
    // Event Listeners //
    //#################//

    setupEventListeners() {
        this.setupConnectionHandlers();
        this.setupParameterHandlers();
        this.setupPresetHandlers();
        this.setupVoiceCloningHandlers();
        this.setupUtilityHandlers();
    }

    setupConnectionHandlers() {
        const endpointInput = document.getElementById('dia-tts-endpoint');
        const apiKeyInput = document.getElementById('dia-tts-apikey');
        const testButton = document.getElementById('dia-test-connection');

        if (endpointInput instanceof HTMLInputElement) {
            console.log('Endpoint input element found, current value:', endpointInput.value, 'settings value:', this.settings.endpoint);
            endpointInput.addEventListener('change', (e) => {
                if (e.target instanceof HTMLInputElement) {
                    console.log('Endpoint changed from UI:', e.target.value);
                    this.settings.endpoint = e.target.value;
                    this.onSettingsChange();

                    // Clear connection status
                    this.updateConnectionStatus('', '');

                    // Trigger health check with new endpoint
                    setTimeout(() => {
                        this.checkReady().then(isReady => {
                            if (isReady) {
                                toastr.success(`Connected to Dia server at ${this.settings.endpoint}`);
                                this.updateConnectionStatus('✅ Connected', '#4CAF50');
                            } else {
                                toastr.warning(`Could not connect to ${this.settings.endpoint}`);
                                this.updateConnectionStatus('❌ Failed', '#f44336');
                            }
                        });
                    }, 100);
                }
            });
        }

        if (apiKeyInput instanceof HTMLInputElement) {
            apiKeyInput.addEventListener('change', (e) => {
                if (e.target instanceof HTMLInputElement) {
                    this.settings.apiKey = e.target.value;
                    this.onSettingsChange();
                }
            });
        }

        if (testButton instanceof HTMLButtonElement) {
            testButton.addEventListener('click', async () => {
                testButton.disabled = true;
                testButton.textContent = 'Testing...';
                this.updateConnectionStatus('⏳ Testing...', '#FF9800');

                try {
                    const isReady = await this.checkReady();
                    if (isReady) {
                        // Also test voice fetching
                        const voices = await this.fetchTtsVoiceObjects();
                        toastr.success(`Connected! Found ${voices.length} voices on server.`);
                        this.updateConnectionStatus(`✅ Connected (${voices.length} voices)`, '#4CAF50');
                    } else {
                        toastr.error('Connection test failed. Check endpoint and server status.');
                        this.updateConnectionStatus('❌ Connection Failed', '#f44336');
                    }
                } catch (error) {
                    console.error('Connection test error:', error);
                    toastr.error(`Connection test failed: ${error.message}`);
                    this.updateConnectionStatus('❌ Error', '#f44336');
                }

                testButton.disabled = false;
                testButton.textContent = 'Test Connection';
            });
        }
    }

    updateConnectionStatus(text, color) {
        const statusElement = document.getElementById('dia-connection-status');
        if (statusElement) {
            statusElement.textContent = text;
            statusElement.style.color = color;
        }
    }

    setupParameterHandlers() {
        const sliders = ['temperature', 'cfg_scale', 'top_p', 'max_tokens', 'speed'];

        sliders.forEach(param => {
            this.setupParameterSlider(`dia-${param.replace('_', '-')}`, param, `dia-${param.replace('_', '-')}-output`);
        });

        // Async mode checkbox
        const asyncModeCheckbox = document.getElementById('dia-async-mode');
        if (asyncModeCheckbox instanceof HTMLInputElement) {
            asyncModeCheckbox.addEventListener('change', (e) => {
                if (e.target instanceof HTMLInputElement) {
                    this.settings.asyncMode = e.target.checked;
                    this.onSettingsChange();
                }
            });
        }
    }

    setupParameterSlider(sliderId, settingKey, outputId) {
        const slider = document.getElementById(sliderId);
        const output = document.getElementById(outputId);

        if (slider instanceof HTMLInputElement) {
            slider.addEventListener('input', (e) => {
                if (e.target instanceof HTMLInputElement) {
                    const value = parseFloat(e.target.value);
                    this.settings[settingKey] = value;

                    if (output) {
                        output.textContent = String(value);
                    }

                    this.onSettingsChange();
                }
            });
        }
    }

    setupPresetHandlers() {
        const presets = ['quality', 'natural', 'fast', 'default'];

        presets.forEach(preset => {
            const button = document.getElementById(`dia-preset-${preset}`);
            if (button) {
                button.addEventListener('click', () => this.applyPreset(preset));
            }
        });
    }

    setupVoiceCloningHandlers() {
        const uploadBtn = document.getElementById('dia-upload-voice-sample');
        const upload = document.getElementById('dia-tts-char-upload');
        const saveBtn = document.getElementById('dia-tts-char-save');
        const refreshBtn = document.getElementById('dia-refresh-characters');
        const randomSeedBtn = document.getElementById('dia-random-seed');
        const seedInput = document.getElementById('dia-voice-seed');

        // Method switching
        const audioMethodRadio = document.getElementById('dia-method-audio');
        const seedMethodRadio = document.getElementById('dia-method-seed');
        const audioMethodSection = document.getElementById('dia-audio-method');
        const seedMethodSection = document.getElementById('dia-seed-method');

        if (audioMethodRadio instanceof HTMLInputElement && seedMethodRadio instanceof HTMLInputElement && audioMethodSection && seedMethodSection) {
            const toggleMethods = () => {
                if (audioMethodRadio.checked) {
                    audioMethodSection.style.display = 'block';
                    seedMethodSection.style.display = 'none';
                } else {
                    audioMethodSection.style.display = 'none';
                    seedMethodSection.style.display = 'block';
                }
            };

            audioMethodRadio.addEventListener('change', toggleMethods);
            seedMethodRadio.addEventListener('change', toggleMethods);
            toggleMethods(); // Initial state
        }

        // Random seed generation
        if (randomSeedBtn && seedInput instanceof HTMLInputElement) {
            randomSeedBtn.addEventListener('click', () => {
                const randomSeed = Math.floor(Math.random() * 999999) + 1;
                seedInput.value = String(randomSeed);
            });
        }

        if (refreshBtn) {
            refreshBtn.addEventListener('click', () => {
                this.populateCharacterDropdown();
                toastr.info('Character list refreshed');
            });
        }

        if (uploadBtn && upload) {
            uploadBtn.addEventListener('click', () => upload.click());

            upload.addEventListener('change', (e) => {
                const target = e.target;
                const file = (target instanceof HTMLInputElement && target.files) ? target.files[0] : null;
                if (file && uploadBtn) {
                    uploadBtn.innerHTML = `
                        <i class="fa-solid fa-file-check"></i>
                        <span>${file.name}</span>
                    `;
                }
            });
        }

        if (saveBtn) {
            saveBtn.addEventListener('click', () => this.handleCustomVoiceSave());
        }

        this.setupAudioPromptHandlers();
        this.populateCharacterDropdown();
    }

    setupAudioPromptHandlers() {
        const viewPromptsBtn = document.getElementById('dia-view-prompts');
        const transcribePromptsBtn = document.getElementById('dia-transcribe-prompts');
        const whisperStatusBtn = document.getElementById('dia-whisper-status');

        if (viewPromptsBtn) {
            viewPromptsBtn.addEventListener('click', () => this.viewAudioPrompts());
        }

        if (transcribePromptsBtn) {
            transcribePromptsBtn.addEventListener('click', () => this.retranscribeAllPrompts());
        }

        if (whisperStatusBtn) {
            whisperStatusBtn.addEventListener('click', () => this.showWhisperStatus());
        }
    }

    setupUtilityHandlers() {
        const debugBtn = document.getElementById('dia-debug-tts');
        const repairBtn = document.getElementById('dia-repair-voices');

        if (debugBtn) {
            debugBtn.addEventListener('click', () => this.debugTtsSettings());
        }

        if (repairBtn instanceof HTMLInputElement) {
            repairBtn.addEventListener('click', async () => {
                repairBtn.disabled = true;
                repairBtn.value = 'Repairing...';

                try {
                    await this.repairVoiceMappings();
                } catch (error) {
                    console.error('Repair failed:', error);
                    toastr.error('Voice repair failed: ' + error.message);
                }

                repairBtn.disabled = false;
                repairBtn.value = 'Repair Voice Mappings';
            });
        }

        this.setupServerManagementHandlers();
    }

    setupServerManagementHandlers() {
        const serverStatusBtn = document.getElementById('dia-server-status');
        const queueStatsBtn = document.getElementById('dia-queue-stats');
        const generationLogsBtn = document.getElementById('dia-generation-logs');
        const discoverPromptsBtn = document.getElementById('dia-discover-prompts');
        const cleanupServerBtn = document.getElementById('dia-cleanup-server');

        if (serverStatusBtn) {
            serverStatusBtn.addEventListener('click', () => this.showServerStatus());
        }

        if (queueStatsBtn) {
            queueStatsBtn.addEventListener('click', () => this.showQueueStats());
        }

        if (generationLogsBtn) {
            generationLogsBtn.addEventListener('click', () => this.showGenerationLogs());
        }

        if (discoverPromptsBtn) {
            discoverPromptsBtn.addEventListener('click', () => this.discoverAudioPrompts());
        }

        if (cleanupServerBtn) {
            cleanupServerBtn.addEventListener('click', () => this.cleanupServer());
        }
    }

    //###################//
    // Settings Changes  //
    //###################//

    onSettingsChange() {
        saveTtsProviderSettings();
    }

    applyPreset(presetName) {
        const preset = PRESET_CONFIGS[presetName];
        if (!preset) return;

        Object.assign(this.settings, preset);
        this.onSettingsChange();
        this.applySettingsToHTML();

        toastr.success(`Applied ${presetName} preset`);
    }

    //#################//
    // Server Readiness//
    //#################//

    async checkReady() {
        if (!this.settings?.endpoint) {
            console.warn('Settings not initialized, skipping health check');
            return false;
        }

        try {
            const response = await fetch(`${this.settings.endpoint}/health`, {
                method: 'GET',
                mode: 'cors',
                credentials: 'omit'
            });

            if (response.ok) {
                const healthData = await response.json();
                console.log('Server health check:', healthData);
                this.ready = true;
                return true;
            }
        } catch (error) {
            console.warn('Server health check failed:', error.message);
        }

        this.ready = false;
        return false;
    }

    async onRefreshClick() {
        try {
            await this.checkReady();
            if (this.ready) {
                await this.cleanupVoiceMappings();
            }
            await this.loadSettings(this.settings);
            toastr.info(this.ready ? 'Server is ready' : 'Server is offline');
        } catch (error) {
            console.error('Error during refresh:', error);
            toastr.error('Refresh failed');
        }
    }

    //##############//
    // Voice Objects//
    //##############//

    async fetchTtsVoiceObjects() {
        const voices = [];

        try {
            // Fetch voices from API
            const response = await fetch(`${this.settings.endpoint}/voices`, {
                method: 'GET',
                mode: 'cors',
                credentials: 'omit'
            });

            if (response.ok) {
                const result = await response.json();
                console.log('Raw API response from /voices:', result);

                const apiVoices = result.voices || [];
                console.log('API voices array:', apiVoices);

                // Convert API voices to our format
                apiVoices.forEach(voice => {
                    console.log('Processing API voice:', voice);
                    voices.push({
                        name: voice.name || voice.voice_id,
                        voice_id: voice.voice_id,
                        preview_url: false, // Disable direct preview URLs, use TTS generation instead
                        lang: voice.lang || 'en-US',
                        description: voice.description || 'Voice from server'
                    });
                });

                console.log(`Fetched ${apiVoices.length} voices from API`);
            } else {
                console.warn('Could not fetch voices from API, status:', response.status);
                console.warn('Response text:', await response.text());

                // If API is not available, provide a fallback message
                toastr.warning('Could not fetch voices from server. Please check if the Dia server is running.');
            }
        } catch (error) {
            console.warn('Error fetching voices from API:', error);
            toastr.warning(`Could not connect to Dia server: ${error.message}`);
        }

        // Add custom voices from local settings that might not be on server yet
        const customVoices = this.settings?.customVoices || [];
        console.log('Adding local custom voices:', customVoices);

        customVoices.forEach(voiceId => {
            // Only add if not already in the list from API
            if (!voices.find(v => v.voice_id === voiceId)) {
                voices.push({
                    name: `${voiceId} (Local)`,
                    voice_id: voiceId,
                    preview_url: false, // Disable direct preview URLs
                    lang: 'en-US',
                    description: 'Custom cloned voice (local)'
                });
            }
        });

        console.log(`Returning ${voices.length} total voices:`, voices);
        return voices;
    }

    async getVoice(voiceName) {
        const voices = await this.fetchTtsVoiceObjects();
        return voices.find(voice => voice.name === voiceName || voice.voice_id === voiceName) || voices[0];
    }

    //##################//
    // Voice Preview    //
    //##################//

    async previewTtsVoice(voiceId) {
        try {
            // Check if server is ready first
            if (!this.ready) {
                const isReady = await this.checkReady();
                if (!isReady) {
                    toastr.error('Dia server is not available. Please check the endpoint configuration.');
                    return;
                }
            }

            // Validate voice ID
            if (!voiceId) {
                toastr.error('No voice ID provided for preview');
                return;
            }

            this.audioElement.pause();
            this.audioElement.currentTime = 0;

            // Show loading message
            toastr.info('Generating voice preview...');

            const text = getPreviewString('en-US');
            console.log(`Generating preview for voice: ${voiceId} with text: "${text}"`);

            const response = await this.generateTts(text, voiceId);

            if (!response || !response.ok) {
                throw new Error(`Server returned ${response?.status || 'unknown error'}`);
            }

            const audio = await response.blob();

            if (!audio || audio.size === 0) {
                throw new Error('Received empty audio data');
            }

            const url = URL.createObjectURL(audio);

            this.audioElement.onerror = (e) => {
                console.error('Audio playback error:', e);
                URL.revokeObjectURL(url);
                toastr.error('Failed to play audio preview');
            };

            this.audioElement.onended = () => {
                URL.revokeObjectURL(url);
            };

            this.audioElement.src = url;
            await this.audioElement.play();

            // Clear the "generating" message
            this.clearToastrMessage('Generating voice preview...');
            console.log(`Preview successful for voice: ${voiceId}`);

        } catch (error) {
            console.error('Preview failed:', error);
            this.clearToastrMessage('Generating voice preview...');

            let errorMessage = 'Preview failed';
            if (error.message.includes('404')) {
                errorMessage = `Voice "${voiceId}" not found on server`;
            } else if (error.message.includes('connection')) {
                errorMessage = 'Cannot connect to Dia server';
            } else {
                errorMessage = `Preview failed: ${error.message}`;
            }

            toastr.error(errorMessage);
        }
    }

    //##################//
    // TTS Generation   //
    //##################//

        async generateTts(text, voiceId, char) {
        // Determine voice to use - check character mapping first
        let selectedVoice = voiceId;
        if (char && this.settings.voiceMappings?.[char]) {
            selectedVoice = this.settings.voiceMappings[char];
        }

        // Clean up voice ID if it has "(Local)" or other suffixes
        if (selectedVoice && selectedVoice.includes('(')) {
            selectedVoice = selectedVoice.split('(')[0].trim();
        }

        console.log(`TTS Generation - Original voiceId: ${voiceId}, Character: ${char}, Selected voice: ${selectedVoice}`);

        // Validate voice ID
        if (!selectedVoice) {
            throw new Error('No voice ID specified');
        }

        // Map character to role for API
        let role = "assistant";
        if (char) {
            const c = char.toLowerCase();
            if (c === 'user' || c === 'you') {
                role = "user";
            } else if (c === 'system' || c === 'narrator') {
                role = "system";
            }
        }

        const requestBody = {
            text: text,
            voice_id: selectedVoice,
            role: role,
            response_format: 'wav',
            speed: this.settings.speed,
            temperature: this.settings.temperature,
            cfg_scale: this.settings.cfg_scale,
            top_p: this.settings.top_p,
            max_tokens: this.settings.max_tokens
        };

        // Add voice_seed if this is a seed-based voice (check if voice mapping has a seed)
        try {
            const mappingsResponse = await fetch(`${this.settings.endpoint}/voice_mappings`);
            if (mappingsResponse.ok) {
                const mappingsData = await mappingsResponse.json();
                const voiceMapping = mappingsData[selectedVoice];
                if (voiceMapping && voiceMapping.voice_seed) {
                    requestBody.voice_seed = voiceMapping.voice_seed;
                    console.log(`Using voice seed ${voiceMapping.voice_seed} for voice ${selectedVoice}`);
                }
            }
        } catch (error) {
            console.warn('Could not check voice mappings for seed:', error);
        }

        console.log('TTS Request payload:', requestBody);

        try {
            // Check if we should use async mode for long texts
            const useAsync = this.settings.asyncMode && text.length > 1000;

            if (useAsync) {
                return await this.generateTtsAsync(requestBody);
            } else {
                return await this.generateTtsSync(requestBody);
            }

        } catch (error) {
            this.clearToastrMessage('Generating audio...');

            if (error.name === 'AbortError') {
                toastr.error('TTS generation timed out after 3 minutes');
                throw new Error('TTS generation timed out');
            }

            console.error('TTS Generation Error:', error);
            toastr.error(`TTS generation failed: ${error.message}`);
            throw error;
        }
    }

    async generateTtsSync(requestBody) {
        toastr.info('Generating audio...');

        const controller = new AbortController();
        const timeout = setTimeout(() => controller.abort(), 180000); // 3 minute timeout

        const response = await fetch(`${this.settings.endpoint}/generate`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Accept': 'audio/wav, audio/mpeg, audio/*, */*'
            },
            body: JSON.stringify(requestBody),
            signal: controller.signal
        });

        clearTimeout(timeout);

        if (!response.ok) {
            const errorText = await response.text();
            console.error('TTS Server Error Response:', errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }

        this.clearToastrMessage('Generating audio...');
        return response;
    }

    async generateTtsAsync(requestBody) {
        toastr.info('Queuing audio generation...');

        // Submit async job
        const jobResponse = await fetch(`${this.settings.endpoint}/generate?async_mode=true`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify(requestBody)
        });

        if (!jobResponse.ok) {
            throw new Error(`Job submission failed: ${await jobResponse.text()}`);
        }

        const jobData = await jobResponse.json();
        const jobId = jobData.job_id;

        this.clearToastrMessage('Queuing audio generation...');
        toastr.info('Audio generation queued, polling for completion...');

        // Poll for completion
        return await this.pollJobCompletion(jobId);
    }

    async pollJobCompletion(jobId) {
        const maxWaitTime = 300000; // 5 minutes
        const pollInterval = 2000; // 2 seconds
        const startTime = Date.now();

        while (Date.now() - startTime < maxWaitTime) {
            try {
                const status = await this.fetchEndpoint(`/jobs/${jobId}`);

                if (status.status === 'completed') {
                    toastr.success('Audio generation completed!');
                    this.clearToastrMessage('Audio generation queued, polling for completion...');

                    // Fetch the result
                    const resultResponse = await fetch(`${this.settings.endpoint}/jobs/${jobId}/result`);
                    if (!resultResponse.ok) {
                        throw new Error('Failed to fetch job result');
                    }
                    return resultResponse;

                } else if (status.status === 'failed') {
                    throw new Error(`Generation failed: ${status.error_message || 'Unknown error'}`);

                } else if (status.status === 'cancelled') {
                    throw new Error('Generation was cancelled');
                }

                // Still processing, wait and poll again
                await new Promise(resolve => setTimeout(resolve, pollInterval));

            } catch (error) {
                if (error.message.includes('404')) {
                    // Job not found, might have been cleaned up
                    throw new Error('Job not found - may have been cleaned up');
                }
                throw error;
            }
        }

                 // Timeout reached
         throw new Error('Job polling timed out after 5 minutes');
     }

    clearToastrMessage(message) {
        const toasts = document.querySelectorAll('#toast-container .toast');
        toasts.forEach(toast => {
            if (toast.textContent.includes(message)) {
                toast.remove();
            }
        });
    }

    //##################//
    // Voice Cloning    //
    //##################//

    async handleCustomVoiceSave() {
        const charSelect = document.getElementById('dia-tts-char-select');
        const voiceNameInput = document.getElementById('dia-tts-voice-name');
        const audioMethodRadio = document.getElementById('dia-method-audio');
        const seedMethodRadio = document.getElementById('dia-method-seed');

        if (!(charSelect instanceof HTMLSelectElement) ||
            !(voiceNameInput instanceof HTMLInputElement) ||
            !(audioMethodRadio instanceof HTMLInputElement) ||
            !(seedMethodRadio instanceof HTMLInputElement)) {
            return;
        }

        const charName = charSelect.value;
        if (!charName) {
            toastr.error('Please select a character');
            return;
        }

        // Generate voice name if not provided
        let voiceName = voiceNameInput.value.trim();
        if (!voiceName) {
            voiceName = `${charName}_voice`;
        }
        const customVoiceId = voiceName.toLowerCase().replace(/[^a-z0-9]/g, '_');

        // Handle different creation methods
        if (audioMethodRadio.checked) {
            await this.handleAudioSampleVoice(charName, customVoiceId);
        } else if (seedMethodRadio.checked) {
            await this.handleSeedBasedVoice(charName, customVoiceId);
        }
    }

    async handleAudioSampleVoice(charName, customVoiceId) {
        const upload = document.getElementById('dia-tts-char-upload');

        if (!(upload instanceof HTMLInputElement)) {
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

        try {

            // Step 1: Upload audio prompt
            toastr.info('Uploading voice sample...');

            const formData = new FormData();
            formData.append('prompt_id', customVoiceId);
            formData.append('audio_file', file);

            const uploadResponse = await fetch(`${this.settings.endpoint}/audio_prompts/upload`, {
                method: 'POST',
                body: formData,
                mode: 'cors',
                credentials: 'omit'
            });

            if (!uploadResponse.ok) {
                const error = await uploadResponse.text();
                throw new Error(`Upload failed: ${error}`);
            }

            const uploadResult = await uploadResponse.json();
            console.log('Audio prompt uploaded:', uploadResult);

            // Step 2: Wait a moment for transcription if available
            if (uploadResult.transcript) {
                console.log('Auto-generated transcript:', uploadResult.transcript);
            } else {
                // Try to get transcript after a delay
                setTimeout(async () => {
                    try {
                        const metadataResponse = await fetch(`${this.settings.endpoint}/audio_prompts/metadata/${customVoiceId}`, {
                            mode: 'cors',
                            credentials: 'omit'
                        });
                        if (metadataResponse.ok) {
                            const metadata = await metadataResponse.json();
                            if (metadata.transcript) {
                                console.log('Retrieved transcript:', metadata.transcript);
                            }
                        }
                    } catch (error) {
                        console.warn('Could not retrieve transcript:', error);
                    }
                }, 2000);
            }

                        // Step 3: Create voice mapping
            toastr.info('Creating voice mapping...');

            const voiceMappingResponse = await fetch(`${this.settings.endpoint}/voice_mappings`, {
                method: 'POST',
                    headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    voice_id: customVoiceId,
                    style: 'conversational',
                    primary_speaker: 'S1',
                    audio_prompt: customVoiceId,
                    audio_prompt_transcript: uploadResult.transcript || null
                }),
                mode: 'cors',
                credentials: 'omit'
            });

            if (!voiceMappingResponse.ok) {
                const error = await voiceMappingResponse.text();
                console.error('Voice mapping creation failed:', error);
                throw new Error(`Voice mapping failed: ${error}`);
            }

            const mappingResult = await voiceMappingResponse.json();
            console.log('Voice mapping created:', mappingResult);

            // Initialize mappings if needed
            if (!this.settings.customVoices) {
                this.settings.customVoices = [];
            }
            if (!this.settings.voiceMappings) {
                this.settings.voiceMappings = {};
            }

            // Add to custom voices list if not already present
            if (!this.settings.customVoices.includes(customVoiceId)) {
                this.settings.customVoices.push(customVoiceId);
            }

            // Map character to voice
            this.settings.voiceMappings[charName] = customVoiceId;

            this.onSettingsChange();
            this.renderCustomVoicesList();
            toastr.success(`Custom voice "${customVoiceId}" created successfully`);

            // Clear inputs
            const charSelect = document.getElementById('dia-tts-char-select');
            const voiceNameInput = document.getElementById('dia-tts-voice-name');
            const upload = document.getElementById('dia-tts-char-upload');

            if (charSelect instanceof HTMLSelectElement) charSelect.value = '';
            if (voiceNameInput instanceof HTMLInputElement) voiceNameInput.value = '';
            if (upload instanceof HTMLInputElement) upload.value = '';

            const uploadBtn = document.getElementById('dia-upload-voice-sample');
            if (uploadBtn) {
                uploadBtn.innerHTML = `
                    <i class="fa-solid fa-file-import"></i>
                    <span>Upload Voice Sample</span>
                `;
            }

        } catch (error) {
            console.error('Error creating custom voice:', error);
            toastr.error(`Failed to create custom voice: ${error.message}`);
        }
    }

    async handleSeedBasedVoice(charName, customVoiceId) {
        const seedInput = document.getElementById('dia-voice-seed');

        if (!(seedInput instanceof HTMLInputElement)) {
            return;
        }

        const seed = parseInt(seedInput.value);
        if (!seed || seed < 1 || seed > 999999) {
            toastr.error('Please enter a valid seed number (1-999999)');
            return;
        }

        try {
            toastr.info('Creating seed-based voice...');

            // Create voice mapping directly with seed
            const voiceMappingResponse = await fetch(`${this.settings.endpoint}/voice_mappings`, {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({
                    voice_id: customVoiceId,
                    style: 'seed_based',
                    primary_speaker: 'S1',
                    voice_seed: seed,
                    audio_prompt: null,
                    audio_prompt_transcript: null
                }),
                mode: 'cors',
                credentials: 'omit'
            });

            if (!voiceMappingResponse.ok) {
                const error = await voiceMappingResponse.text();
                throw new Error(`Voice mapping failed: ${error}`);
            }

            const mappingResult = await voiceMappingResponse.json();
            console.log('Seed-based voice mapping created:', mappingResult);

            // Initialize mappings if needed
            if (!this.settings.customVoices) {
                this.settings.customVoices = [];
            }
            if (!this.settings.voiceMappings) {
                this.settings.voiceMappings = {};
            }

            // Add to custom voices list if not already present
            if (!this.settings.customVoices.includes(customVoiceId)) {
                this.settings.customVoices.push(customVoiceId);
            }

            // Map character to voice
            this.settings.voiceMappings[charName] = customVoiceId;

            this.onSettingsChange();
            this.renderCustomVoicesList();
            toastr.success(`Seed-based voice "${customVoiceId}" created with seed ${seed}`);

            // Clear inputs
            const charSelect = document.getElementById('dia-tts-char-select');
            const voiceNameInput = document.getElementById('dia-tts-voice-name');

            if (charSelect instanceof HTMLSelectElement) charSelect.value = '';
            if (voiceNameInput instanceof HTMLInputElement) voiceNameInput.value = '';
            if (seedInput instanceof HTMLInputElement) seedInput.value = '';

        } catch (error) {
            console.error('Error creating seed-based voice:', error);
            toastr.error(`Failed to create seed-based voice: ${error.message}`);
        }
    }

    renderCustomVoicesList() {
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
            voiceDiv.style.cssText = 'display:flex; align-items:center; margin-bottom:5px; justify-content:space-between; padding:2px 5px; background:var(--SmartThemeBlurTintColor); border-radius:3px;';

            const nameSpan = document.createElement('small');
            nameSpan.textContent = voiceId;
            voiceDiv.appendChild(nameSpan);

            const deleteButton = document.createElement('button');
            deleteButton.innerHTML = '<i class="fa-solid fa-trash"></i>';
            deleteButton.style.cssText = 'border:none; background:transparent; color:var(--SmartThemeQuoteColor); cursor:pointer;';
            deleteButton.title = `Delete custom voice ${voiceId}`;
            deleteButton.onclick = async (e) => {
                e.preventDefault();
                e.stopPropagation();
                await this.removeCustomVoice(voiceId);
            };

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
            // Remove voice mapping from server
            const voiceMappingResponse = await fetch(`${this.settings.endpoint}/voice_mappings/${voiceId}`, {
                method: 'DELETE',
                mode: 'cors',
                credentials: 'omit'
            });

            if (!voiceMappingResponse.ok) {
                console.warn(`Could not delete voice mapping from server: ${voiceMappingResponse.status}`);
            }

            // Remove audio prompt from server
            const audioPromptResponse = await fetch(`${this.settings.endpoint}/audio_prompts/${voiceId}`, {
                method: 'DELETE',
                mode: 'cors',
                credentials: 'omit'
            });

            if (!audioPromptResponse.ok) {
                console.warn(`Could not delete audio prompt from server: ${audioPromptResponse.status}`);
            }

            // Remove from local settings
            const index = this.settings.customVoices.indexOf(voiceId);
            if (index > -1) {
                this.settings.customVoices.splice(index, 1);

                // Also remove any character mappings using this voice
                if (this.settings.voiceMappings) {
                    for (const [char, voice] of Object.entries(this.settings.voiceMappings)) {
                        if (voice === voiceId) {
                            delete this.settings.voiceMappings[char];
                        }
                    }
                }

                this.onSettingsChange();
                this.renderCustomVoicesList();
                toastr.success(`Deleted custom voice: ${voiceId}`);
            }
        } catch (error) {
            console.error('Error deleting voice:', error);
            toastr.error(`Failed to delete voice: ${error.message}`);
        }
    }

    //##################//
    // Character Utils  //
    //##################//

    populateCharacterDropdown() {
        const charSelect = document.getElementById('dia-tts-char-select');
        if (!charSelect) return;

        charSelect.innerHTML = '<option value="">Select Character...</option>';

        try {
            const context = getContext();
            let characters = [];

            if (context.groupId === null) {
                // Single character chat
                if (context.name2) characters.push(context.name2);
                if (context.name1) characters.push(context.name1);
            } else {
                // Group chat
                if (context.name1) characters.push(context.name1);

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

            // Add all available characters
            if (context.characters && context.characters.length > 0) {
                const allCharNames = context.characters.map(char => char.name).filter(name => name);
                characters = [...characters, ...allCharNames].filter((name, index, arr) => arr.indexOf(name) === index);
            }

            // Remove duplicates and add to dropdown
            characters = characters.filter((name, index, arr) => name && arr.indexOf(name) === index);

            characters.forEach(charName => {
                const option = document.createElement('option');
                option.value = charName;
                option.textContent = charName;
                charSelect.appendChild(option);
            });

            console.log(`Populated character dropdown with ${characters.length} characters:`, characters);
        } catch (error) {
            console.warn('Could not populate character dropdown:', error.message);
        }
    }

    /**
     * Clean up voice mappings to remove invalid voices
     */
    async cleanupVoiceMappings() {
        try {
            const availableVoices = await this.fetchTtsVoiceObjects();
            const validVoiceIds = availableVoices.map(v => v.voice_id);

            console.log('Available voice IDs:', validVoiceIds);
            console.log('Current voice mappings:', this.settings.voiceMappings);

            let cleaned = false;
            for (const [char, voiceId] of Object.entries(this.settings.voiceMappings || {})) {
                // Clean up voice ID (remove suffixes like "(Local)")
                const cleanVoiceId = voiceId.includes('(') ? voiceId.split('(')[0].trim() : voiceId;

                if (!validVoiceIds.includes(cleanVoiceId)) {
                    console.warn(`Removing invalid voice mapping: ${char} -> ${voiceId}`);
                    delete this.settings.voiceMappings[char];
                    cleaned = true;
                } else if (cleanVoiceId !== voiceId) {
                    console.log(`Cleaning voice ID: ${voiceId} -> ${cleanVoiceId}`);
                    this.settings.voiceMappings[char] = cleanVoiceId;
                    cleaned = true;
                }
            }

            if (cleaned) {
                this.onSettingsChange();
                console.log('Cleaned voice mappings:', this.settings.voiceMappings);
            }
        } catch (error) {
            console.warn('Could not clean up voice mappings:', error);
        }
    }

    //######################//
    // Server Management    //
    //######################//

    async showServerStatus() {
        try {
            const [health, gpu, config] = await Promise.all([
                this.fetchEndpoint('/health'),
                this.fetchEndpoint('/gpu/status'),
                this.fetchEndpoint('/config')
            ]);

            const infoDiv = document.getElementById('dia-server-info');
            if (!infoDiv) return;

            let info = '<strong>Server Status:</strong><br>';
            info += `• Health: ${health.status || 'Unknown'}<br>`;
            info += `• Model Loaded: ${health.model_loaded ? '✅' : '❌'}<br>`;

            if (gpu.gpu_mode) {
                info += `• GPU Mode: ${gpu.gpu_mode} (${gpu.gpu_count} GPUs)<br>`;
                info += `• Multi-GPU: ${gpu.use_multi_gpu ? 'Enabled' : 'Disabled'}<br>`;
            }

            if (config.debug_mode !== undefined) {
                info += `• Debug Mode: ${config.debug_mode ? 'On' : 'Off'}<br>`;
                info += `• Save Outputs: ${config.save_outputs ? 'On' : 'Off'}<br>`;
            }

            infoDiv.innerHTML = info;
            toastr.success('Server status updated');

        } catch (error) {
            console.error('Failed to get server status:', error);
            toastr.error('Failed to get server status');
        }
    }

    async showQueueStats() {
        try {
            const stats = await this.fetchEndpoint('/queue/stats');

            const infoDiv = document.getElementById('dia-server-info');
            if (!infoDiv) return;

            let info = '<strong>Queue Statistics:</strong><br>';
            info += `• Pending Jobs: ${stats.pending_jobs}<br>`;
            info += `• Processing Jobs: ${stats.processing_jobs}<br>`;
            info += `• Completed Jobs: ${stats.completed_jobs}<br>`;
            info += `• Failed Jobs: ${stats.failed_jobs}<br>`;
            info += `• Active Workers: ${stats.active_workers}/${stats.total_workers}<br>`;

            if (stats.memory_pressure && Object.keys(stats.memory_pressure).length > 0) {
                info += '<br><strong>GPU Memory:</strong><br>';
                for (const [gpu, pressure] of Object.entries(stats.memory_pressure)) {
                    const status = pressure.status === 'high' ? '⚠️' : '✅';
                    info += `• ${gpu}: ${status} ${(pressure.pressure * 100).toFixed(1)}%<br>`;
                }
            }

            infoDiv.innerHTML = info;
            toastr.success('Queue stats updated');

        } catch (error) {
            console.error('Failed to get queue stats:', error);
            toastr.error('Failed to get queue stats');
        }
    }

    async showGenerationLogs() {
        try {
            const logs = await this.fetchEndpoint('/logs?limit=10');

            const infoDiv = document.getElementById('dia-server-info');
            if (!infoDiv) return;

            let info = '<strong>Recent Generations:</strong><br>';

            if (logs.logs && logs.logs.length > 0) {
                logs.logs.forEach((log, index) => {
                    const time = new Date(log.timestamp).toLocaleTimeString();
                    const text = log.text.length > 30 ? log.text.substring(0, 30) + '...' : log.text;
                    info += `• ${time} - ${log.voice}: "${text}" (${log.generation_time?.toFixed(2)}s)<br>`;
                });
            } else {
                info += '• No recent generations found<br>';
            }

            infoDiv.innerHTML = info;
            toastr.success('Generation logs updated');

        } catch (error) {
            console.error('Failed to get generation logs:', error);
            toastr.error('Failed to get generation logs');
        }
    }

    async discoverAudioPrompts() {
        try {
            toastr.info('Discovering audio prompts...');

            const result = await this.fetchEndpoint('/audio_prompts/discover', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ force_retranscribe: false })
            });

            const infoDiv = document.getElementById('dia-server-info');
            if (!infoDiv) return;

            let info = '<strong>Audio Prompt Discovery:</strong><br>';
            info += `• Total Prompts: ${result.total_prompts}<br>`;
            info += `• Newly Discovered: ${result.discovered?.length || 0}<br>`;

            if (result.discovered && result.discovered.length > 0) {
                info += '<br><strong>New Prompts:</strong><br>';
                result.discovered.forEach(prompt => {
                    const hasTranscript = prompt.transcript ? '📝' : '❌';
                    info += `• ${prompt.prompt_id}: ${hasTranscript} ${prompt.duration}s<br>`;
                });
            }

            infoDiv.innerHTML = info;
            toastr.success(`Discovered ${result.total_prompts} audio prompts`);

            // Refresh voices since new prompts might create new voices
            setTimeout(() => this.fetchTtsVoiceObjects(), 1000);

        } catch (error) {
            console.error('Failed to discover audio prompts:', error);
            toastr.error('Failed to discover audio prompts');
        }
    }

    async cleanupServer() {
        try {
            toastr.info('Cleaning up server...');

            await this.fetchEndpoint('/cleanup', { method: 'POST' });

            const infoDiv = document.getElementById('dia-server-info');
            if (!infoDiv) return;

            infoDiv.innerHTML = '<strong>Server Cleanup:</strong><br>• Cleaned up old files and jobs<br>• Memory freed';
            toastr.success('Server cleanup completed');

        } catch (error) {
            console.error('Failed to cleanup server:', error);
            toastr.error('Failed to cleanup server');
        }
    }

                async fetchEndpoint(path, options = {}) {
        const url = `${this.settings.endpoint}${path}`;
        const response = await fetch(url, options);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        return await response.json();
    }

    async viewAudioPrompts() {
        try {
            const metadata = await this.fetchEndpoint('/audio_prompts/metadata');

            const infoDiv = document.getElementById('dia-prompts-info');
            if (!infoDiv) return;

            if (!metadata || Object.keys(metadata).length === 0) {
                infoDiv.innerHTML = '<strong>No audio prompts found</strong><br>Upload audio samples to create voice clones.';
                return;
            }

            let info = '<strong>Audio Prompts:</strong><br>';

            for (const [promptId, meta] of Object.entries(metadata)) {
                const hasTranscript = meta.transcript ? '📝' : '❌';
                const source = meta.transcript_source ? `(${meta.transcript_source})` : '';
                const duration = meta.duration ? `${meta.duration}s` : 'Unknown';

                info += `• <strong>${promptId}</strong>: ${hasTranscript} ${duration} ${source}<br>`;

                if (meta.transcript) {
                    const preview = meta.transcript.length > 50 ?
                        meta.transcript.substring(0, 50) + '...' : meta.transcript;
                    info += `&nbsp;&nbsp;"${preview}"<br>`;
                }
            }

            infoDiv.innerHTML = info;
            toastr.success(`Found ${Object.keys(metadata).length} audio prompts`);

        } catch (error) {
            console.error('Failed to view audio prompts:', error);
            toastr.error('Failed to view audio prompts');
        }
    }

    async retranscribeAllPrompts() {
        try {
            toastr.info('Re-transcribing all audio prompts...');

            const result = await this.fetchEndpoint('/audio_prompts/discover', {
                method: 'POST',
                headers: { 'Content-Type': 'application/json' },
                body: JSON.stringify({ force_retranscribe: true })
            });

            const infoDiv = document.getElementById('dia-prompts-info');
            if (!infoDiv) return;

            let info = '<strong>Re-transcription Results:</strong><br>';
            info += `• Total Prompts: ${result.total_prompts}<br>`;
            info += `• Processed: ${result.discovered?.length || 0}<br>`;

            if (result.discovered && result.discovered.length > 0) {
                info += '<br><strong>Updated Transcripts:</strong><br>';
                result.discovered.forEach(prompt => {
                    const status = prompt.transcript ? '✅' : '❌';
                    info += `• ${prompt.prompt_id}: ${status}<br>`;
                });
            }

            infoDiv.innerHTML = info;
            toastr.success('Re-transcription completed');

        } catch (error) {
            console.error('Failed to re-transcribe prompts:', error);
            toastr.error('Failed to re-transcribe prompts');
        }
    }

    async showWhisperStatus() {
        try {
            const status = await this.fetchEndpoint('/whisper/status');

            const infoDiv = document.getElementById('dia-prompts-info');
            if (!infoDiv) return;

            let info = '<strong>Whisper Status:</strong><br>';
            info += `• Available: ${status.available ? '✅' : '❌'}<br>`;
            info += `• Model Loaded: ${status.model_loaded ? '✅' : '❌'}<br>`;

            if (status.model_size) {
                info += `• Model Size: ${status.model_size}<br>`;
            }

            info += `• Auto-transcribe: ${status.auto_transcribe ? 'Enabled' : 'Disabled'}<br>`;

            if (!status.available) {
                info += '<br><small>Install Whisper: pip install openai-whisper</small>';
            } else if (!status.model_loaded) {
                info += '<br><button id="dia-load-whisper" class="menu_button" style="font-size:11px; margin-top:5px;">Load Whisper Model</button>';
            }

            infoDiv.innerHTML = info;

            // Add handler for load button if it exists
            const loadBtn = document.getElementById('dia-load-whisper');
            if (loadBtn) {
                loadBtn.addEventListener('click', async () => {
                    try {
                        toastr.info('Loading Whisper model...');
                        await this.fetchEndpoint('/whisper/load', { method: 'POST' });
                        toastr.success('Whisper model loaded');
                        this.showWhisperStatus(); // Refresh status
                    } catch (error) {
                        toastr.error('Failed to load Whisper model');
                    }
                });
            }

            toastr.success('Whisper status updated');

        } catch (error) {
            console.error('Failed to get Whisper status:', error);
            toastr.error('Failed to get Whisper status');
        }
    }

    //##################//
    // Debug Utilities  //
    //##################//

    async runFullDiagnostics() {
        try {
            // Basic cleanup first
            await this.cleanupVoiceMappings();

            // Now run full diagnostics
            console.log('🔍 === FULL DIA TTS DIAGNOSTICS ===');

            // Check server status
            const health = await fetch(`${this.settings.endpoint}/health`);
            const healthData = await health.json();
            console.log('🏥 Server Health:', healthData);

            // Check voices on server
            const voicesResponse = await fetch(`${this.settings.endpoint}/voices`);
            const voicesData = await voicesResponse.json();
            console.log('🎤 Server Voices:', voicesData);

            // Check audio prompts on server
            try {
                const promptsResponse = await fetch(`${this.settings.endpoint}/audio_prompts`);
                const promptsData = await promptsResponse.json();
                console.log('🎧 Server Audio Prompts:', promptsData);

                // If we have local custom voices but no server voices, try to repair
                if (this.settings.customVoices?.length > 0 && voicesData.voices.length === 0) {
                    console.log('🔧 REPAIR NEEDED: Local voices exist but server has none');
                    await this.repairVoiceMappings();
                }
            } catch (error) {
                console.warn('⚠️ Could not check audio prompts:', error);
            }

            // Check voice mappings on server
            try {
                const mappingsResponse = await fetch(`${this.settings.endpoint}/voice_mappings`);
                const mappingsData = await mappingsResponse.json();
                console.log('🗺️ Server Voice Mappings:', mappingsData);
            } catch (error) {
                console.warn('⚠️ Could not check voice mappings:', error);
            }

            console.log('🔍 === END DIAGNOSTICS ===');
        } catch (error) {
            console.error('❌ Diagnostics failed:', error);
        }
    }

    async repairVoiceMappings() {
        console.log('🔧 === STARTING VOICE MAPPING REPAIR ===');

        for (const voiceId of this.settings.customVoices || []) {
            try {
                console.log(`🔧 Attempting to repair voice: ${voiceId}`);

                // Check if audio prompt exists
                const promptCheck = await fetch(`${this.settings.endpoint}/audio_prompts/metadata/${voiceId}`);
                if (promptCheck.ok) {
                    const promptData = await promptCheck.json();
                    console.log(`✅ Audio prompt exists for ${voiceId}:`, promptData);

                    // Create voice mapping
                    const mappingResponse = await fetch(`${this.settings.endpoint}/voice_mappings`, {
                        method: 'POST',
                        headers: { 'Content-Type': 'application/json' },
                        body: JSON.stringify({
                            voice_id: voiceId,
                            style: 'conversational',
                            primary_speaker: 'S1',
                            audio_prompt: voiceId,
                            audio_prompt_transcript: promptData.transcript || null
                        }),
                        mode: 'cors',
                        credentials: 'omit'
                    });

                    if (mappingResponse.ok) {
                        const result = await mappingResponse.json();
                        console.log(`✅ Repaired voice mapping for ${voiceId}:`, result);
                        toastr.success(`Repaired voice mapping for ${voiceId}`);
                    } else {
                        const error = await mappingResponse.text();
                        console.error(`❌ Failed to create mapping for ${voiceId}:`, error);
                    }
                } else {
                    console.warn(`⚠️ Audio prompt not found for ${voiceId}`);
                    console.log(`🔧 Removing ${voiceId} from local custom voices list`);

                    // Remove from local list if audio prompt doesn't exist
                    const index = this.settings.customVoices.indexOf(voiceId);
                    if (index > -1) {
                        this.settings.customVoices.splice(index, 1);
                        this.onSettingsChange();
                    }
                }
            } catch (error) {
                console.error(`❌ Error repairing voice ${voiceId}:`, error);
            }
        }

        console.log('🔧 === REPAIR COMPLETED ===');

        // Refresh voice list
        setTimeout(() => {
            this.fetchTtsVoiceObjects().then(voices => {
                console.log(`🔄 After repair, found ${voices.length} voices:`, voices);
                toastr.info(`Voice repair completed. Found ${voices.length} voices.`);
            });
        }, 1000);
    }

    debugTtsSettings() {
                console.log('🔍 === DIA TTS DEBUG INFO ===');
        console.log('🎵 Dia Provider Settings:', this.settings);
        console.log('🌐 Server Endpoint:', this.settings.endpoint);
        console.log('🔗 Server Ready:', this.ready);

        // Run cleanup and diagnostics
        this.runFullDiagnostics();

        if (typeof extension_settings !== 'undefined' && extension_settings.tts) {
            console.log('🔧 TTS Extension Settings:', extension_settings.tts);

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
        console.log('🔊 Custom Voices:');
        if (this.settings.customVoices && this.settings.customVoices.length > 0) {
            this.settings.customVoices.forEach(voice => {
                console.log(`  - ${voice}`);
            });
        } else {
            console.log('  - No custom voices created');
        }

                // Test server connection and voice fetching
        console.log('🔄 Testing server connection...');
        this.checkReady().then(isReady => {
            console.log('🌐 Server Health Check:', isReady ? '✅ Connected' : '❌ Failed');

            if (isReady) {
                return this.fetchTtsVoiceObjects();
            } else {
                console.log('❌ Cannot fetch voices - server not ready');
                return [];
            }
        }).then(voices => {
            console.log('🎤 Available Voices from Server:');
            if (voices && voices.length > 0) {
                voices.forEach(voice => {
                    console.log(`  - ${voice.name} (${voice.voice_id}): ${voice.description}`);
                });

                // Test a simple generation with the first available voice
                const testVoice = voices[0].voice_id;
                console.log(`🧪 Testing generation with voice: ${testVoice}`);
                return this.generateTts('Test message', testVoice);
            } else {
                console.log('  - No voices available from server');
                return null;
            }
        }).then(response => {
            if (response) {
                console.log('✅ Test generation successful');
            }
        }).catch(error => {
            console.error('❌ Error during debug test:', error);
        });

        console.log('🔍 === END DEBUG INFO ===');
        toastr.info('TTS debug info logged to console (F12)');
    }

    //##################//
    // Whisper Support  //
    //##################//

    async transcribeAudioPrompt(promptId) {
        try {
            const response = await fetch(`${this.settings.endpoint}/audio_prompts/${promptId}/transcribe`, {
                method: 'POST',
                mode: 'cors',
                credentials: 'omit'
            });

            if (!response.ok) {
                throw new Error(`Transcription failed: ${await response.text()}`);
            }

            const result = await response.json();
            return result.transcript;
        } catch (error) {
            console.error('Error transcribing audio prompt:', error);
            throw error;
        }
    }

    async getWhisperStatus() {
        try {
            const response = await fetch(`${this.settings.endpoint}/whisper/status`, {
                method: 'GET',
                mode: 'cors',
                credentials: 'omit'
            });

            if (response.ok) {
                return await response.json();
            }
            return null;
        } catch (error) {
            console.warn('Could not get Whisper status:', error);
            return null;
        }
    }

    //##################//
    // Cleanup          //
    //##################//

    dispose() {
        this.audioElement.pause();
        this.audioElement.src = '';
    }
}
