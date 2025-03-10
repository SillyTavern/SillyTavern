import { doExtrasFetch } from '../../extensions.js';
import { debounce } from '../../utils.js';
import { saveTtsProviderSettings } from './index.js';

export { AllTalkTtsProvider };

class AllTalkTtsProvider {
    //########//
    // Config //
    //########//

    settings = {};
    constructor() {
        // Initialize with default settings if they are not already set
        this.settings = {
            provider_endpoint: this.settings.provider_endpoint || 'http://localhost:7851',
            server_version: this.settings.server_version || 'v2',
            language: this.settings.language || 'en',
            voiceMap: this.settings.voiceMap || {},
            at_generation_method: this.settings.at_generation_method || 'standard_generation',
            narrator_enabled: this.settings.narrator_enabled || 'false',
            at_narrator_text_not_inside: this.settings.at_narrator_text_not_inside || 'narrator',
            narrator_voice_gen: this.settings.narrator_voice_gen || 'Please set a voice',
            rvc_character_voice: this.settings.rvc_character_voice || 'Disabled',
            rvc_character_pitch: this.settings.rvc_character_pitch || '0',
            rvc_narrator_voice: this.settings.rvc_narrator_voice || 'Disabled',
            rvc_narrator_pitch: this.settings.rvc_narrator_pitch || '0',
            finetuned_model: this.settings.finetuned_model || 'false',
        };
        // Separate property for dynamically updated settings from the server
        this.dynamicSettings = {
            modelsAvailable: [],
            currentModel: '',
            deepspeed_available: false,
            deepspeed_enabled: false,
            lowvram_capable: false,
            lowvram_enabled: false,
        };
        this.rvcVoices = []; // Initialize rvcVoices as an empty array
    }
    ready = false;
    voices = [];
    separator = '. ';
    audioElement = document.createElement('audio');

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

    get settingsHtml() {
        // HTML template literals can trigger ESLint quotes warnings when quotes are used in HTML attributes.
        // Disabling quotes rule for this one line as it's a false positive with HTML template literals.
        // eslint-disable-next-line quotes
        let html = `<div class="at-settings-separator">AllTalk V2 Settings</div>`;

        html += `<div class='at-settings-row'>
        <div class='at-settings-option'>
            <label for='at_generation_method'>AllTalk TTS Generation Method</label>
                <select id='at_generation_method'>
                <option value='standard_generation'>Standard Audio Generation (AT Narrator - Optional)</option>
                <option value='streaming_enabled'>Streaming Audio Generation (AT Narrator - Disabled)</option>
        </select>
        </div>
        </div>`;

        html += `<div class='at-settings-row'>
        <div class='at-settings-option'>
            <label for='at_narrator_enabled'>AT Narrator</label>
                <select id='at_narrator_enabled'>
                <option value='true'>Enabled</option>
                <option value='silent'>Enabled (Silenced)</option>
                <option value='false'>Disabled</option>
        </select>
        </div>

        <div class='at-settings-option'>
            <label for='at_narrator_text_not_inside'>Text Not Inside * or " is</label>
                <select id='at_narrator_text_not_inside'>
                <option value='character'>Character</option>
                <option value='narrator'>Narrator</option>
                <option value='silent'>Silent</option>
        </select>
        </div>
    </div>`;

        html += `<div class='at-settings-row'>
        <div class='at-settings-option'>
            <label for='narrator_voice'>Narrator Voice</label>
            <select id='narrator_voice'>`;
        if (this.voices) {
            for (let voice of this.voices) {
                html += `<option value='${voice.voice_id}'>${voice.name}</option>`;
            }
        }
        html += `</select>
        </div>
        <div class='at-settings-option'>
            <label for='language_options'>Language</label>
            <select id='language_options'>`;
        for (let language in this.languageLabels) {
            html += `<option value='${this.languageLabels[language]}' ${this.languageLabels[language] === this.settings?.language ? 'selected="selected"' : ''}>${language}</option>`;
        }
        html += `</select>
        </div>
    </div>`;

        html += `<div class='at-settings-row'>
    <div class='at-settings-option'>
        <label for='rvc_character_voice'>RVC Character</label>
        <select id='rvc_character_voice'>`;
        if (this.rvcVoices) {
            for (let rvccharvoice of this.rvcVoices) {
                html += `<option value='${rvccharvoice.voice_id}'>${rvccharvoice.name}</option>`;
            }
        }
        html += `</select>
    </div>
    <div class='at-settings-option'>
        <label for='rvc_narrator_voice'>RVC Narrator</label>
        <select id='rvc_narrator_voice'>`;
        if (this.rvcVoices) {
            for (let rvcnarrvoice of this.rvcVoices) {
                html += `<option value='${rvcnarrvoice.voice_id}'>${rvcnarrvoice.name}</option>`;
            }
        }
        html += `</select>
    </div>
</div>`;

        html += `<div class='at-settings-row'>
        <div class='at-settings-option'>
            <label for='rvc_character_pitch'>RVC Character Pitch</label>
            <select id='rvc_character_pitch'>`;
        for (let i = -24; i <= 24; i++) {
            const selected = i === 0 ? 'selected="selected"' : '';
            html += `<option value='${i}' ${selected}>${i}</option>`;
        }
        html += `</select>
        </div>
        <div class='at-settings-option'>
            <label for='rvc_narrator_pitch'>RVC Narrator Pitch</label>
            <select id='rvc_narrator_pitch'>`;
        for (let i = -24; i <= 24; i++) {
            const selected = i === 0 ? 'selected="selected"' : '';
            html += `<option value='${i}' ${selected}>${i}</option>`;
        }
        html += `</select>
        </div>
    </div>`;

        html += `<div class='at-model-endpoint-row'>
        <div class='at-model-option'>
        <label for='switch_model'>Switch Model</label>
        <select id='switch_model'>
            <!-- Options will be dynamically populated -->
        </select>
        </div>

        <div class='at-endpoint-option'>
            <label for='at_server'>AllTalk Endpoint:</label>
            <input id='at_server' type='text' class='text_pole' maxlength='80' value='${this.settings.provider_endpoint}'/>
        </div>
   </div>`;

        html += `<div class='at-settings-row'>
        <div class='at-settings-option'>
            <label for='server_version'>AllTalk Server Version</label>
            <select id='server_version'>
                <option value='v1'>AllTalk V1</option>
                <option value='v2'>AllTalk V2</option>
            </select>
        </div>
    </div>`;

        html += `<div class='at-model-endpoint-row'>
    <div class='at-settings-option'>
        <label for='low_vram'>Low VRAM</label>
        <input id='low_vram' type='checkbox'/>
    </div>
    <div class='at-settings-option'>
        <label for='deepspeed'>DeepSpeed</label>
        <input id='deepspeed' type='checkbox'/>
    </div>
    <div class='at-settings-option status-option'>
        <span>Status: <span id='status_info'>Ready</span></span>
    </div>
    <div class='at-settings-option empty-option'>
        <!-- This div remains empty for spacing -->
    </div>
</div>`;

        html += `<div class='at-website-row'>
        <div class='at-website-option'>
        <span>AllTalk V2<a target='_blank' href='${this.settings.provider_endpoint}'>Config & Docs</a>.</span>
    </div>

    <div class='at-website-option'>
        <span>AllTalk <a target='_blank' href='https://github.com/erew123/alltalk_tts/'>Website</a>.</span>
    </div>
</div>`;

        html += `<div class='at-website-row'>
<div class='at-website-option'>
<span>- If you <strong>change your TTS engine</strong> in AllTalk, you will need to <strong>Reload</strong> (button above) and re-select your voices.</span><br><br>
<span>- Assuming the server is <strong>Status: Ready</strong>, most problems will be resolved by hitting Reload and selecting voices that match the loaded TTS engine.</span><br><br>
<span>- <strong>Text-generation-webui</strong> users - Uncheck <strong>Enable TTS</strong> in the TGWUI interface, or you will hear 2x voices and file names being generated.</span>
</div>
</div>`;

        return html;
    }


    //#################//
    // Startup ST & AT //
    //#################//

    async loadSettings(settings) {
        updateStatus('Offline');

        if (Object.keys(settings).length === 0) {
            console.info('Using default AllTalk TTS Provider settings');
        } else {
            // Populate settings with provided values, ignoring server-provided settings
            for (const key in settings) {
                if (key in this.settings) {
                    this.settings[key] = settings[key];
                } else {
                    console.debug(`Ignoring non-user-configurable setting: ${key}`);
                }
            }
        }

        // Update UI elements to reflect the loaded settings
        $('#at_server').val(this.settings.provider_endpoint);
        $('#language_options').val(this.settings.language);
        $('#at_generation_method').val(this.settings.at_generation_method);
        $('#at_narrator_enabled').val(this.settings.narrator_enabled);
        $('#at_narrator_text_not_inside').val(this.settings.at_narrator_text_not_inside);
        $('#narrator_voice').val(this.settings.narrator_voice_gen);
        $('#rvc_character_voice').val(this.settings.rvc_character_voice);
        $('#rvc_narrator_voice').val(this.settings.rvc_narrator_voice);
        $('#rvc_character_pitch').val(this.settings.rvc_character_pitch);
        $('#rvc_narrator_pitch').val(this.settings.rvc_narrator_pitch);
        $('#server_version').val(this.settings.server_version);

        console.debug('AllTalkTTS: Settings loaded');
        try {
            // Check if TTS provider is ready
            this.setupEventListeners();
            this.updateLanguageDropdown();
            await this.checkReady();
            await this.updateSettingsFromServer(); // Fetch dynamic settings from the TTS server
            await this.fetchTtsVoiceObjects(); // Fetch voices only if service is ready
            await this.fetchRvcVoiceObjects(); // Fetch RVC voices
            this.updateNarratorVoicesDropdown();
            this.applySettingsToHTML();
            updateStatus('Ready');
        } catch (error) {
            console.error('Error loading settings:', error);
            updateStatus('Offline');
        }
    }


    applySettingsToHTML() {
        const narratorVoiceSelect = document.getElementById('narrator_voice');
        const atNarratorSelect = document.getElementById('at_narrator_enabled');
        const textNotInsideSelect = document.getElementById('at_narrator_text_not_inside');
        const generationMethodSelect = document.getElementById('at_generation_method');
        this.settings.narrator_voice = this.settings.narrator_voice_gen;
        // Apply settings to Narrator Voice dropdown
        if (narratorVoiceSelect && this.settings.narrator_voice) {
            narratorVoiceSelect.value = this.settings.narrator_voice; // Remove the parentheses
        }
        // Apply settings to AT Narrator Enabled dropdown
        if (atNarratorSelect) {
            const ttsPassAsterisksCheckbox = document.getElementById('tts_pass_asterisks');
            const ttsNarrateQuotedCheckbox = document.getElementById('tts_narrate_quoted');
            const ttsNarrateDialoguesCheckbox = document.getElementById('tts_narrate_dialogues');
            if (this.settings.narrator_enabled) {
                ttsPassAsterisksCheckbox.checked = false;
                $('#tts_pass_asterisks').click();
                $('#tts_pass_asterisks').trigger('change');
            }
            if (!this.settings.narrator_enabled) {
                ttsPassAsterisksCheckbox.checked = true;
                $('#tts_pass_asterisks').click();
                $('#tts_pass_asterisks').trigger('change');
            }
            if (this.settings.narrator_enabled) {
                ttsNarrateQuotedCheckbox.checked = true;
                ttsNarrateDialoguesCheckbox.checked = true;
                $('#tts_narrate_quoted').click();
                $('#tts_narrate_quoted').trigger('change');
                $('#tts_narrate_dialogues').click();
                $('#tts_narrate_dialogues').trigger('change');
            }
            atNarratorSelect.value = this.settings.narrator_enabled.toString();
            this.settings.narrator_enabled = this.settings.narrator_enabled.toString();
        }
        const languageSelect = document.getElementById('language_options');
        if (languageSelect && this.settings.language) {
            languageSelect.value = this.settings.language;
        }
        if (textNotInsideSelect && this.settings.text_not_inside) {
            textNotInsideSelect.value = this.settings.text_not_inside;
            this.settings.at_narrator_text_not_inside = this.settings.text_not_inside;
        }
        if (generationMethodSelect && this.settings.at_generation_method) {
            generationMethodSelect.value = this.settings.at_generation_method;
        }
        const isStreamingEnabled = this.settings.at_generation_method === 'streaming_enabled';
        if (isStreamingEnabled) {
            if (atNarratorSelect) atNarratorSelect.disabled = true;
            if (textNotInsideSelect) textNotInsideSelect.disabled = true;
            if (narratorVoiceSelect) narratorVoiceSelect.disabled = true;
        } else {
            if (atNarratorSelect) atNarratorSelect.disabled = false;
            if (textNotInsideSelect) textNotInsideSelect.disabled = !this.settings.narrator_enabled;
            if (narratorVoiceSelect) narratorVoiceSelect.disabled = !this.settings.narrator_enabled;
        }
    }


    //##############################//
    // Check AT Server is Available //
    //##############################//

    async checkReady() {
        try {
            const response = await fetch(`${this.settings.provider_endpoint}/api/ready`);
            // Check if the HTTP request was successful
            if (!response.ok) {
                throw new Error(`HTTP Error Response: ${response.status} ${response.statusText}`);
            }
            const statusText = await response.text();
            // Check if the response is 'Ready'
            if (statusText === 'Ready') {
                this.ready = true; // Set the ready flag to true
                console.log('TTS service is ready.');
            } else {
                this.ready = false;
                console.log('TTS service is not ready.');
            }
        } catch (error) {
            console.error('Error checking TTS service readiness:', error);
            this.ready = false; // Ensure ready flag is set to false in case of error
        }
    }

    //######################//
    // Get Available Voices //
    //######################//

    async fetchTtsVoiceObjects() {
        const response = await fetch(`${this.settings.provider_endpoint}/api/voices`);
        if (!response.ok) {
            const errorText = await response.text();
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        const data = await response.json();
        const voices = data.voices.map(filename => {
            return {
                name: filename,
                voice_id: filename,
                preview_url: null, // Preview URL will be dynamically generated
                lang: 'en', // Default language
            };
        });
        this.voices = voices; // Assign to the class property
        return voices; // Also return this list
    }

    async fetchRvcVoiceObjects() {
        if (this.settings.server_version == 'v1') {
            console.log('Skipping RVC voices fetch for V1 server');
            return [];
        }

        console.log('Fetching RVC Voices');
        try {
            const response = await fetch(`${this.settings.provider_endpoint}/api/rvcvoices`);
            if (!response.ok) {
                const errorText = await response.text();
                console.error('Error text:', errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            if (!data || !data.rvcvoices) {
                console.error('Invalid data format:', data);
                throw new Error('Invalid data format received from /api/rvcvoices');
            }

            const voices = data.rvcvoices.map(filename => {
                return {
                    name: filename,
                    voice_id: filename,
                };
            });

            console.log('RVC voices:', voices);
            this.rvcVoices = voices; // Assign to the class property
            this.updateRvcVoiceDropdowns(); // Update UI after fetching voices
            return voices; // Also return this list
        } catch (error) {
            console.error('Error fetching RVC voices:', error);
            this.rvcVoices = [{ name: 'Disabled', voice_id: 'Disabled' }]; // Set default on error
            throw error;
        } finally {
            // Ensure dropdowns are updated even if there was an error
            this.updateRvcVoiceDropdowns();
        }
    }

    //##########################################//
    // Get Current AT Server Config & Update ST //
    //##########################################//

    async updateSettingsFromServer() {
        try {
            const response = await fetch(`${this.settings.provider_endpoint}/api/currentsettings`);
            if (!response.ok) {
                throw new Error(`Failed to fetch current settings: ${response.statusText}`);
            }
            const currentSettings = await response.json();
            currentSettings.models_available.sort((a, b) => a.name.localeCompare(b.name));

            this.settings.enginesAvailable = currentSettings.engines_available;
            this.settings.currentEngineLoaded = currentSettings.current_engine_loaded;
            this.settings.modelsAvailable = currentSettings.models_available;
            this.settings.currentModel = currentSettings.current_model_loaded;
            this.settings.deepspeed_capable = currentSettings.deepspeed_capable;
            this.settings.deepspeed_available = currentSettings.deepspeed_available;
            this.settings.deepspeed_enabled = currentSettings.deepspeed_enabled;
            this.settings.lowvram_capable = currentSettings.lowvram_capable;
            this.settings.lowvram_enabled = currentSettings.lowvram_enabled;

            await this.fetchRvcVoiceObjects(); // Fetch RVC voices

            this.updateModelDropdown();
            this.updateCheckboxes();
            this.updateRvcVoiceDropdowns(); // Update the RVC voice dropdowns
        } catch (error) {
            console.error(`Error updating settings from server: ${error}`);
        }
    }

    updateRvcVoiceDropdowns() {
        // Handle all RVC-related elements
        const rvcElements = document.querySelectorAll('.rvc-setting');
        const isV2 = this.settings.server_version === 'v2';

        rvcElements.forEach(element => {
            element.style.display = isV2 ? 'block' : 'none';
        });

        // Update and disable/enable character voice dropdown
        const rvcCharacterVoiceSelect = document.getElementById('rvc_character_voice');
        if (rvcCharacterVoiceSelect) {
            rvcCharacterVoiceSelect.disabled = !isV2;
            if (this.rvcVoices) {
                rvcCharacterVoiceSelect.innerHTML = '';
                for (let voice of this.rvcVoices) {
                    const option = document.createElement('option');
                    option.value = voice.voice_id;
                    option.textContent = voice.name;
                    if (voice.voice_id === this.settings.rvc_character_voice) {
                        option.selected = true;
                    }
                    rvcCharacterVoiceSelect.appendChild(option);
                }
            }
        }

        // Update and disable/enable narrator voice dropdown
        const rvcNarratorVoiceSelect = document.getElementById('rvc_narrator_voice');
        if (rvcNarratorVoiceSelect) {
            rvcNarratorVoiceSelect.disabled = !isV2;
            if (this.rvcVoices) {
                rvcNarratorVoiceSelect.innerHTML = '';
                for (let voice of this.rvcVoices) {
                    const option = document.createElement('option');
                    option.value = voice.voice_id;
                    option.textContent = voice.name;
                    if (voice.voice_id === this.settings.rvc_narrator_voice) {
                        option.selected = true;
                    }
                    rvcNarratorVoiceSelect.appendChild(option);
                }
            }
        }

        // Update pitch inputs
        const characterPitch = document.getElementById('rvc_character_pitch');
        if (characterPitch) {
            characterPitch.disabled = !isV2;
        }

        const narratorPitch = document.getElementById('rvc_narrator_pitch');
        if (narratorPitch) {
            narratorPitch.disabled = !isV2;
        }
    }

    //###################################################//
    // Get Current AT Server Config & Update ST (Models) //
    //###################################################//

    updateModelDropdown() {
        const modelSelect = document.getElementById('switch_model');
        if (modelSelect) {
            modelSelect.innerHTML = ''; // Clear existing options
            this.settings.modelsAvailable.forEach(model => {
                const option = document.createElement('option');
                option.value = model.name;
                option.textContent = model.name; // Use model name directly
                option.selected = model.name === this.settings.currentModel;
                modelSelect.appendChild(option);
            });
        }
    }

    //#######################################################//
    // Get Current AT Server Config & Update ST (DS and LVR) //
    //#######################################################//

    updateCheckboxes() {
        const deepspeedCheckbox = document.getElementById('deepspeed');
        const lowVramCheckbox = document.getElementById('low_vram');

        // Handle DeepSpeed checkbox
        if (deepspeedCheckbox) {
            if (this.settings.deepspeed_capable) {
                // If TTS engine is capable of using DeepSpeed
                deepspeedCheckbox.disabled = !this.settings.deepspeed_available;
                this.settings.deepspeed_enabled = this.settings.deepspeed_available && this.settings.deepspeed_enabled;
            } else {
                // If TTS engine is NOT capable of using DeepSpeed
                deepspeedCheckbox.disabled = true;
                this.settings.deepspeed_enabled = false;
            }
            deepspeedCheckbox.checked = this.settings.deepspeed_enabled;
        }

        // Handle Low VRAM checkbox
        if (lowVramCheckbox) {
            if (this.settings.lowvram_capable) {
                // If TTS engine is capable of low VRAM
                lowVramCheckbox.disabled = false;
            } else {
                // If TTS engine is NOT capable of low VRAM
                lowVramCheckbox.disabled = true;
                this.settings.lowvram_enabled = false;
            }
            lowVramCheckbox.checked = this.settings.lowvram_enabled;
        }
    }


    //###############################################################//
    // Get Current AT Server Config & Update ST (AT Narrator Voices) //
    //###############################################################//

    updateNarratorVoicesDropdown() {
        const narratorVoiceSelect = document.getElementById('narrator_voice');
        if (narratorVoiceSelect && this.voices) {
            // Clear existing options
            narratorVoiceSelect.innerHTML = '';
            // Add new options
            for (let voice of this.voices) {
                const option = document.createElement('option');
                option.value = voice.voice_id;
                option.textContent = voice.name;
                narratorVoiceSelect.appendChild(option);
            }
        }
    }

    //######################################################//
    // Get Current AT Server Config & Update ST (Languages) //
    //######################################################//

    updateLanguageDropdown() {
        const languageSelect = document.getElementById('language_options');
        if (languageSelect) {
            // Ensure default language is set
            this.settings.language = this.settings.language || 'en';

            languageSelect.innerHTML = '';
            for (let language in this.languageLabels) {
                const option = document.createElement('option');
                option.value = this.languageLabels[language];
                option.textContent = language;
                if (this.languageLabels[language] === this.settings.language) {
                    option.selected = true;
                }
                languageSelect.appendChild(option);
            }
        }
    }

    //########################################//
    // Start AT TTS extenstion page listeners //
    //########################################//

    setupEventListeners() {
        // Define the event handler function
        const onModelSelectChange = async (event) => {
            console.log('Model select change event triggered');
            const selectedModel = event.target.value;
            console.log(`Selected model: ${selectedModel}`);
            updateStatus('Processing');
            try {
                const response = await fetch(`${this.settings.provider_endpoint}/api/reload?tts_method=${encodeURIComponent(selectedModel)}`, {
                    method: 'POST',
                });
                if (!response.ok) {
                    throw new Error(`HTTP Error: ${response.status}`);
                }
                const data = await response.json();
                console.log('POST response data:', data);
                updateStatus('Ready');
            } catch (error) {
                console.error('POST request error:', error);
                updateStatus('Error');
            }
        };

        // Switch Model Listener with debounce
        const modelSelect = document.getElementById('switch_model');
        if (modelSelect) {
            const debouncedModelSelectChange = debounce(onModelSelectChange, 1400);
            modelSelect.addEventListener('change', debouncedModelSelectChange);
        }

        // AllTalk Server version change listener
        const serverVersionSelect = document.getElementById('server_version');
        if (serverVersionSelect) {
            serverVersionSelect.addEventListener('change', async (event) => {
                this.settings.server_version = event.target.value;
                this.onSettingsChange();
                if (event.target.value === 'v2') {
                    await this.fetchRvcVoiceObjects();
                }
                this.updateRvcVoiceDropdowns();
            });
        }

        // RVC Voice and Pitch listeners
        const rvcCharacterVoiceSelect = document.getElementById('rvc_character_voice');
        if (rvcCharacterVoiceSelect) {
            rvcCharacterVoiceSelect.addEventListener('change', (event) => {
                this.settings.rvccharacter_voice_gen = event.target.value;
                this.onSettingsChange();
            });
        }

        const rvcNarratorVoiceSelect = document.getElementById('rvc_narrator_voice');
        if (rvcNarratorVoiceSelect) {
            rvcNarratorVoiceSelect.addEventListener('change', (event) => {
                this.settings.rvcnarrator_voice_gen = event.target.value;
                this.onSettingsChange();
            });
        }

        const rvcCharacterPitchSelect = document.getElementById('rvc_character_pitch');
        if (rvcCharacterPitchSelect) {
            rvcCharacterPitchSelect.addEventListener('change', (event) => {
                this.settings.rvc_character_pitch = event.target.value;
                this.onSettingsChange();
            });
        }

        const rvcNarratorPitchSelect = document.getElementById('rvc_narrator_pitch');
        if (rvcNarratorPitchSelect) {
            rvcNarratorPitchSelect.addEventListener('change', (event) => {
                this.settings.rvc_narrator_pitch = event.target.value;
                this.onSettingsChange();
            });
        }

        // DeepSpeed Listener
        const deepspeedCheckbox = document.getElementById('deepspeed');
        if (deepspeedCheckbox) {
            const handleDeepSpeedChange = async (event) => {
                const deepSpeedValue = event.target.checked ? 'True' : 'False';
                updateStatus('Processing');
                try {
                    const response = await fetch(`${this.settings.provider_endpoint}/api/deepspeed?new_deepspeed_value=${deepSpeedValue}`, {
                        method: 'POST',
                    });
                    if (!response.ok) {
                        throw new Error(`HTTP Error: ${response.status}`);
                    }
                    const data = await response.json();
                    console.log('POST response data:', data);
                    updateStatus('Ready');
                } catch (error) {
                    console.error('POST request error:', error);
                    updateStatus('Error');
                }
            };

            const debouncedHandleDeepSpeedChange = debounce(handleDeepSpeedChange, 300);
            deepspeedCheckbox.addEventListener('change', debouncedHandleDeepSpeedChange);
        }

        // Low VRAM Listener
        const lowVramCheckbox = document.getElementById('low_vram');
        if (lowVramCheckbox) {
            const handleLowVramChange = async (event) => {
                const lowVramValue = event.target.checked ? 'True' : 'False';
                updateStatus('Processing');
                try {
                    const response = await fetch(`${this.settings.provider_endpoint}/api/lowvramsetting?new_low_vram_value=${lowVramValue}`, {
                        method: 'POST',
                    });
                    if (!response.ok) {
                        throw new Error(`HTTP Error: ${response.status}`);
                    }
                    const data = await response.json();
                    console.log('POST response data:', data);
                    updateStatus('Ready');
                } catch (error) {
                    console.error('POST request error:', error);
                    updateStatus('Error');
                }
            };

            const debouncedHandleLowVramChange = debounce(handleLowVramChange, 300);
            lowVramCheckbox.addEventListener('change', debouncedHandleLowVramChange);
        }

        // Other listeners without debounce since they don't need it
        const narratorVoiceSelect = document.getElementById('narrator_voice');
        if (narratorVoiceSelect) {
            narratorVoiceSelect.addEventListener('change', (event) => {
                this.settings.narrator_voice_gen = `${event.target.value}`;
                this.onSettingsChange();
            });
        }

        const textNotInsideSelect = document.getElementById('at_narrator_text_not_inside');
        if (textNotInsideSelect) {
            textNotInsideSelect.addEventListener('change', (event) => {
                this.settings.text_not_inside = event.target.value;
                this.onSettingsChange();
            });
        }

        // AT Narrator Dropdown Listener
        const atNarratorSelect = document.getElementById('at_narrator_enabled');
        const ttsPassAsterisksCheckbox = document.getElementById('tts_pass_asterisks');
        const ttsNarrateQuotedCheckbox = document.getElementById('tts_narrate_quoted');
        const ttsNarrateDialoguesCheckbox = document.getElementById('tts_narrate_dialogues');

        if (atNarratorSelect && textNotInsideSelect && narratorVoiceSelect) {
            atNarratorSelect.addEventListener('change', (event) => {
                const narratorOption = event.target.value;
                this.settings.narrator_enabled = narratorOption;

                const isNarratorDisabled = narratorOption === 'false';
                textNotInsideSelect.disabled = isNarratorDisabled;
                narratorVoiceSelect.disabled = isNarratorDisabled;

                if (narratorOption === 'true') {
                    ttsPassAsterisksCheckbox.checked = false;
                    $('#tts_pass_asterisks').click();
                    $('#tts_pass_asterisks').trigger('change');
                    ttsNarrateQuotedCheckbox.checked = true;
                    ttsNarrateDialoguesCheckbox.checked = true;
                    $('#tts_narrate_quoted').click();
                    $('#tts_narrate_quoted').trigger('change');
                    $('#tts_narrate_dialogues').click();
                    $('#tts_narrate_dialogues').trigger('change');
                } else if (narratorOption === 'silent') {
                    ttsPassAsterisksCheckbox.checked = false;
                    $('#tts_pass_asterisks').click();
                    $('#tts_pass_asterisks').trigger('change');
                } else {
                    ttsPassAsterisksCheckbox.checked = true;
                    $('#tts_pass_asterisks').click();
                    $('#tts_pass_asterisks').trigger('change');
                }

                this.onSettingsChange();
            });
        }

        // Event Listener for AT Generation Method Dropdown
        const atGenerationMethodSelect = document.getElementById('at_generation_method');
        if (atGenerationMethodSelect) {
            atGenerationMethodSelect.addEventListener('change', (event) => {
                const selectedMethod = event.target.value;

                if (selectedMethod === 'streaming_enabled') {
                    // Disable and unselect AT Narrator
                    atNarratorSelect.disabled = true;
                    atNarratorSelect.value = 'false';
                    textNotInsideSelect.disabled = true;
                    narratorVoiceSelect.disabled = true;
                } else if (selectedMethod === 'standard_generation') {
                    // Enable AT Narrator
                    atNarratorSelect.disabled = false;
                }
                this.settings.at_generation_method = selectedMethod;
                this.onSettingsChange();
            });
        }

        // Language Dropdown Listener
        const languageSelect = document.getElementById('language_options');
        if (languageSelect) {
            languageSelect.addEventListener('change', (event) => {
                this.settings.language = event.target.value;
                this.onSettingsChange();
            });
        }

        // AllTalk Endpoint Input Listener
        const atServerInput = document.getElementById('at_server');
        if (atServerInput) {
            atServerInput.addEventListener('input', (event) => {
                this.settings.provider_endpoint = event.target.value;
                this.onSettingsChange();
            });
        }
    }

    //#############################//
    // Store ST interface settings //
    //#############################//

    onSettingsChange() {
        // Update settings based on the UI elements
        //this.settings.provider_endpoint = $('#at_server').val();
        this.settings.language = $('#language_options').val();
        //this.settings.voiceMap = $('#voicemap').val();
        this.settings.at_generation_method = $('#at_generation_method').val();
        this.settings.narrator_enabled = $('#at_narrator_enabled').val();
        this.settings.at_narrator_text_not_inside = $('#at_narrator_text_not_inside').val();
        this.settings.rvc_character_voice = $('#rvc_character_voice').val();
        this.settings.rvc_narrator_voice = $('#rvc_narrator_voice').val();
        this.settings.rvc_character_pitch = $('#rvc_character_pitch').val();
        this.settings.rvc_narrator_pitch = $('#rvc_narrator_pitch').val();
        this.settings.narrator_voice_gen = $('#narrator_voice').val();
        // Save the updated settings
        saveTtsProviderSettings();
    }

    //#########################//
    // ST Handle Reload button //
    //#########################//

    async onRefreshClick() {
        try {
            updateStatus('Processing'); // Set status to Processing while refreshing
            await this.checkReady(); // Check if the TTS provider is ready
            await this.loadSettings(this.settings); // Reload the settings
            await this.checkReady(); // Check if the TTS provider is ready
            updateStatus(this.ready ? 'Ready' : 'Offline'); // Update the status based on readiness
        } catch (error) {
            console.error('Error during refresh:', error);
            updateStatus('Error'); // Set status to Error in case of failure
        }
    }

    //##################//
    // Preview AT Voice //
    //##################//

    async previewTtsVoice(voiceName) {
        try {
            // Prepare data for POST request
            const postData = new URLSearchParams();
            postData.append('voice', `${voiceName}`);

            // Add RVC parameters for V2 if applicable
            if (this.settings.server_version === 'v2' && this.settings.rvc_character_voice !== 'Disabled') {
                postData.append('rvccharacter_voice_gen', this.settings.rvc_character_voice);
                postData.append('rvccharacter_pitch', this.settings.rvc_character_pitch || '0');
            }

            // Making the POST request
            const response = await fetch(`${this.settings.provider_endpoint}/api/previewvoice/`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded',
                },
                body: postData,
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('previewTtsVoice Error Response Text:', errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();
            if (data.output_file_url) {
                // Handle V1/V2 URL differences
                const fullUrl = this.settings.server_version === 'v1'
                    ? data.output_file_url
                    : `${this.settings.provider_endpoint}${data.output_file_url}`;

                const audioElement = new Audio(fullUrl);
                audioElement.play().catch(e => console.error('Error playing audio:', e));
            } else {
                console.warn('previewTtsVoice No output file URL received in the response');
                throw new Error('No output file URL received in the response');
            }
        } catch (error) {
            console.error('previewTtsVoice Exception caught during preview generation:', error);
            throw error;
        }
    }

    //#####################//
    //  Populate ST voices //
    //#####################//

    async getVoice(voiceName, generatePreview = false) {
        // Ensure this.voices is populated
        if (this.voices.length === 0) {
            // Fetch voice objects logic
        }
        // Find the object where the name matches voiceName
        const match = this.voices.find(voice => voice.name === voiceName);
        if (!match) {
            // Error handling
        }
        // Generate preview URL only if requested
        if (!match.preview_url && generatePreview) {
            // Generate preview logic
        }
        return match; // Return the found voice object
    }

    //##########################################//
    //  Generate TTS Streaming or call Standard //
    //##########################################//

    async generateTts(inputText, voiceId) {
        try {
            if (this.settings.at_generation_method === 'streaming_enabled') {
                // Construct the streaming URL
                const streamingUrl = `${this.settings.provider_endpoint}/api/tts-generate-streaming?text=${encodeURIComponent(inputText)}&voice=${encodeURIComponent(voiceId)}&language=${encodeURIComponent(this.settings.language)}&output_file=stream_output.wav`;
                console.log('Streaming URL:', streamingUrl);

                // Return the streaming URL directly
                return streamingUrl;
            } else {
                // For standard method
                const outputUrl = await this.fetchTtsGeneration(inputText, voiceId);
                const audioResponse = await fetch(outputUrl);
                if (!audioResponse.ok) {
                    throw new Error(`HTTP ${audioResponse.status}: Failed to fetch audio data`);
                }
                return audioResponse; // Return the fetch response directly
            }
        } catch (error) {
            console.error('Error in generateTts:', error);
            throw error;
        }
    }


    //####################//
    //  Generate Standard //
    //####################//

    async fetchTtsGeneration(inputText, voiceId) {
        const requestBody = new URLSearchParams({
            'text_input': inputText,
            'text_filtering': 'standard',
            'character_voice_gen': voiceId,
            'narrator_enabled': this.settings.narrator_enabled,
            'narrator_voice_gen': this.settings.narrator_voice_gen,
            'text_not_inside': this.settings.at_narrator_text_not_inside,
            'language': this.settings.language,
            'output_file_name': 'st_output',
            'output_file_timestamp': 'true',
            'autoplay': 'false',
            'autoplay_volume': '0.8',
        });

        // Add RVC parameters only for V2
        if (this.settings.server_version === 'v2') {
            if (this.settings.rvc_character_voice !== 'Disabled') {
                requestBody.append('rvccharacter_voice_gen', this.settings.rvc_character_voice);
                requestBody.append('rvccharacter_pitch', this.settings.rvc_character_pitch || '0');
            }
            if (this.settings.rvc_narrator_voice !== 'Disabled') {
                requestBody.append('rvcnarrator_voice_gen', this.settings.rvc_narrator_voice);
                requestBody.append('rvcnarrator_pitch', this.settings.rvc_narrator_pitch || '0');
            }
        }

        try {
            const response = await doExtrasFetch(
                `${this.settings.provider_endpoint}/api/tts-generate`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Cache-Control': 'no-cache',
                    },
                    body: requestBody,
                },
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error('fetchTtsGeneration Error Response Text:', errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            const data = await response.json();

            // V1 returns a complete URL, V2 returns a relative path
            if (this.settings.server_version === 'v1') {
                // V1: Use the complete URL directly from the response
                return data.output_file_url;
            } else {
                // V2: Combine the endpoint with the relative path
                return `${this.settings.provider_endpoint}${data.output_file_url}`;
            }

        } catch (error) {
            console.error('[fetchTtsGeneration] Exception caught:', error);
            throw error;
        }
    }
}

//#########################//
//  Update Status Messages //
//#########################//

function updateStatus(message) {
    const statusElement = document.getElementById('status_info');
    if (statusElement) {
        statusElement.textContent = message;
        switch (message) {
            case 'Offline':
                statusElement.style.color = 'red';
                break;
            case 'Ready':
                statusElement.style.color = 'lightgreen';
                break;
            case 'Processing':
                statusElement.style.color = 'blue';
                break;
            case 'Error':
                statusElement.style.color = 'red';
                break;
        }
    }
}
