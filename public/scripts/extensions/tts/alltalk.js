import { doExtrasFetch, getApiUrl, modules } from '../../extensions.js';
import { saveTtsProviderSettings } from './index.js';

export { AllTalkTtsProvider };

const css = `
.settings-row {
    display: flex;
    justify-content: space-between; /* Distribute space evenly between the children */
    align-items: center;
    width: 100%; /* Full width to spread out the children */
}

.settings-option {
    flex: 1; /* Each child will take equal space */
    margin: 0 10px; /* Adjust spacing as needed */
}

.endpoint-option {
    flex: 1; /* Each child will take equal space */
    margin: 0 10px; /* Adjust spacing as needed */
    margin-right: 25px;
    width: 38%; /* Full width to spread out the children */
}

.website-row {
    display: flex;
    justify-content: start; /* Aligns items to the start of the row */
    align-items: center;
    margin-top: 10px; /* Top margin */
    margin-bottom: 10px; /* Bottom margin */
}

.website-option {
    flex: 1; /* Allows each option to take equal space */
    margin-right: 10px; /* Spacing between the two options, adjust as needed */
    margin-left: 10px; /* Adjust this value to align as desired */
    /* Remove the individual margin top and bottom declarations if they are set globally on the .settings-row */
}

.settings-separator {
    margin-top: 10px;
    margin-bottom: 10px;
    padding: 18x;
    font-weight: bold;
    border-top: 1px solid #e1e1e1; /* Grey line */
    border-bottom: 1px solid #e1e1e1; /* Grey line */
    text-align: center;
}

.status-message {
    flex: 1; /* Adjust as needed */
    margin: 0 10px;
    /* Additional styling */
}

.model-endpoint-row {
    display: flex;
    justify-content: space-between;
    align-items: center;
    width: 100%;
}

.model-option, .endpoint-option {
    flex: 1;
    margin: 0 10px;
    margin-left: 10px; /* Adjust this value to align as desired */
    /* Adjust width as needed to fit in one line */
}

.endpoint-option {
    /* Adjust width to align with model dropdown */
    width: 38%;
}

#status_info {
    color: lightgreen; /* Or any specific shade of green you prefer */
}
`;

const style = document.createElement('style');
style.type = 'text/css';
style.appendChild(document.createTextNode(css));
document.head.appendChild(style);

class AllTalkTtsProvider {
    //########//
    // Config //
    //########//

    settings;
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

    Settings = {
        provider_endpoint: 'http://localhost:7851',
        language: 'en',
        voiceMap: {},
        at_generation_method: 'standard_generation',
        narrator_enabled: 'false',
        at_narrator_text_not_inside: 'narrator',
        narrator_voice_gen: 'female_01.wav',
        finetuned_model: 'false'
    };

    get settingsHtml() {
        let html = `<div class="settings-separator">AllTalk Settings</div>`;

        html += `<div class="settings-row">

        <div class="settings-option">
            <label for="at_generation_method">AllTalk TTS Generation Method</label>
                <select id="at_generation_method">
                <option value="standard_generation">Standard Audio Generation (AT Narrator - Optional)</option>
                <option value="streaming_enabled">Streaming Audio Generation (AT Narrator - Disabled)</option>
        </select>
        </div>
        </div>`;

        html += `<div class="settings-row">

        <div class="settings-option">
            <label for="at_narrator_enabled">AT Narrator</label>
                <select id="at_narrator_enabled">
                <option value="true">Enabled</option>
                <option value="false">Disabled</option>
        </select>
        </div>

        <div class="settings-option">
            <label for="at_narrator_text_not_inside">Text Not Inside * or " is</label>
                <select id="at_narrator_text_not_inside">
                <option value="narrator">Narrator</option>
                <option value="character">Character</option>
        </select>
        </div>

    </div>`;

        html += `<div class="settings-row">
        <div class="settings-option">
            <label for="narrator_voice">Narrator Voice</label>
            <select id="narrator_voice">`;
        if (this.voices) {
            for (let voice of this.voices) {
                html += `<option value="${voice.voice_id}">${voice.name}</option>`;
            }
        }
        html += `</select>
        </div>
        <div class="settings-option">
            <label for="language_options">Language</label>
            <select id="language_options">`;
        for (let language in this.languageLabels) {
            html += `<option value="${this.languageLabels[language]}" ${this.languageLabels[language] === this.settings?.language ? 'selected="selected"' : ''}>${language}</option>`;
        }
        html += `</select>
        </div>
    </div>`;


        html += `<div class="model-endpoint-row">
    <div class="model-option">
            <label for="switch_model">Switch Model</label>
            <select id="switch_model">
            <option value="api_tts">API TTS</option>
            <option value="api_local">API Local</option>
            <option value="xttsv2_local">XTTSv2 Local</option>
        </select>
        </div>

        <div class="endpoint-option">
            <label for="at_server">AllTalk Endpoint:</label>
            <input id="at_server" type="text" class="text_pole" maxlength="80" value="${this.Settings.provider_endpoint}"/>
        </div>
   </div>`;


        html += `<div class="model-endpoint-row">
    <div class="settings-option">
        <label for="low_vram">Low VRAM</label>
        <input id="low_vram" type="checkbox"/>
    </div>
    <div class="settings-option">
        <label for="deepspeed">DeepSpeed</label>
        <input id="deepspeed" type="checkbox"/>
    </div>
    <div class="settings-option status-option">
        <span>Status: <span id="status_info">Ready</span></span>
    </div>
    <div class="settings-option empty-option">
        <!-- This div remains empty for spacing -->
    </div>
</div>`;


        html += `<div class="website-row">
        <div class="website-option">
        <span>AllTalk <a target="_blank" href="${this.Settings.provider_endpoint}">Config & Docs</a>.</span>
    </div>

    <div class="website-option">
        <span>AllTalk <a target="_blank" href="https://github.com/erew123/alltalk_tts/">Website</a>.</span>
    </div>
</div>`;

html += `<div class="website-row">
<div class="website-option">
<span><strong>Text-generation-webui</strong> users - Uncheck <strong>Enable TTS</strong> in Text-generation-webui.</span>
</div>
</div>`;



        return html;
    }


    //#################//
    // Startup ST & AT //
    //#################//

    async loadSettings(settings) {
        updateStatus('Offline');
        // Use default settings if no settings are provided
        this.settings = Object.keys(settings).length === 0 ? this.Settings : settings;

        try {
            // Check if TTS provider is ready
            await this.checkReady();
            await this.fetchTtsVoiceObjects(); // Fetch voices only if service is ready
            await this.updateSettingsFromServer();
            this.updateNarratorVoicesDropdown();
            this.updateLanguageDropdown();
            this.setupEventListeners();
            this.applySettingsToHTML();
            updateStatus('Ready');
        } catch (error) {
            console.error("Error loading settings:", error);
            // Set status to Error if there is an issue in loading settings
            updateStatus('Offline');
        }
    }

    applySettingsToHTML() {
        // Load AllTalk specific settings first
        const loadedSettings = loadAllTalkSettings();
        // Apply loaded settings or use defaults
        this.settings = loadedSettings ? { ...this.Settings, ...loadedSettings } : this.Settings;
        const narratorVoiceSelect = document.getElementById('narrator_voice');
        const atNarratorSelect = document.getElementById('at_narrator_enabled');
        const textNotInsideSelect = document.getElementById('at_narrator_text_not_inside');
        const generationMethodSelect = document.getElementById('at_generation_method');
        // Apply settings to Narrator Voice dropdown
        if (narratorVoiceSelect && this.settings.narrator_voice) {
            narratorVoiceSelect.value = this.settings.narrator_voice.replace('.wav', '');
            this.settings.narrator_voice_gen = this.settings.narrator_voice;
            //console.log(this.settings.narrator_voice_gen)
        }
        // Apply settings to AT Narrator Enabled dropdown
        if (atNarratorSelect) {
            //console.log(this.settings.narrator_enabled)
            // Sync the state with the checkbox in index.js
            const ttsPassAsterisksCheckbox = document.getElementById('tts_pass_asterisks'); // Access the checkbox from index.js
            const ttsNarrateQuotedCheckbox = document.getElementById('tts_narrate_quoted'); // Access the checkbox from index.js
            const ttsNarrateDialoguesCheckbox = document.getElementById('tts_narrate_dialogues'); // Access the checkbox from index.js
            // Sync the state with the checkbox in index.js
            if (this.settings.narrator_enabled) {
                ttsPassAsterisksCheckbox.checked = false;
                $('#tts_pass_asterisks').click(); // Simulate a click event
                $('#tts_pass_asterisks').trigger('change');
            }
            if (!this.settings.narrator_enabled) {
                ttsPassAsterisksCheckbox.checked = true;
                $('#tts_pass_asterisks').click(); // Simulate a click event
                $('#tts_pass_asterisks').trigger('change');
            }
            // Uncheck and set tts_narrate_quoted to false if narrator is enabled
            if (this.settings.narrator_enabledd) {
                ttsNarrateQuotedCheckbox.checked = true;
                ttsNarrateDialoguesCheckbox.checked = true;
                // Trigger click events instead of change events
                $('#tts_narrate_quoted').click();
                $('#tts_narrate_quoted').trigger('change');
                $('#tts_narrate_dialogues').click();
                $('#tts_narrate_dialogues').trigger('change');
            }
            atNarratorSelect.value = this.settings.narrator_enabled.toString();
            this.settings.narrator_enabled = this.settings.narrator_enabled.toString();
        }
        // Apply settings to the Language dropdown
        const languageSelect = document.getElementById('language_options');
        if (languageSelect && this.settings.language) {
            languageSelect.value = this.settings.language;
            //console.log(this.settings.language)
        }
        // Apply settings to Text Not Inside dropdown
        if (textNotInsideSelect && this.settings.text_not_inside) {
            textNotInsideSelect.value = this.settings.text_not_inside;
            this.settings.at_narrator_text_not_inside = this.settings.text_not_inside;
            //console.log(this.settings.at_narrator_text_not_inside)
        }
        // Apply settings to Generation Method dropdown
        if (generationMethodSelect && this.settings.at_generation_method) {
            generationMethodSelect.value = this.settings.at_generation_method;
            //console.log(this.settings.at_generation_method)
        }
        // Additional logic to disable/enable dropdowns based on the selected generation method
        const isStreamingEnabled = this.settings.at_generation_method === 'streaming_enabled';
        if (isStreamingEnabled) {
            // Disable certain dropdowns when streaming is enabled
            if (atNarratorSelect) atNarratorSelect.disabled = true;
            if (textNotInsideSelect) textNotInsideSelect.disabled = true;
            if (narratorVoiceSelect) narratorVoiceSelect.disabled = true;
        } else {
            // Enable dropdowns for standard generation
            if (atNarratorSelect) atNarratorSelect.disabled = false;
            if (textNotInsideSelect) textNotInsideSelect.disabled = !this.settings.narrator_enabled;
            if (narratorVoiceSelect) narratorVoiceSelect.disabled = !this.settings.narrator_enabled;
        }
        const modelSelect = document.getElementById('switch_model');
        if (this.settings.finetuned_model === 'true') {
            const ftOption = document.createElement('option');
            ftOption.value = 'XTTSv2 FT';
            ftOption.textContent = 'XTTSv2 FT';
            modelSelect.appendChild(ftOption);
        }
        //console.log("Settings applied to HTML.");
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
            const voiceName = filename.replace('.wav', '');
            return {
                name: voiceName,
                voice_id: voiceName,
                preview_url: null, // Preview URL will be dynamically generated
                lang: 'en' // Default language
            };
        });
        this.voices = voices; // Assign to the class property
        return voices; // Also return this list
    }

    //##########################################//
    // Get Current AT Server Config & Update ST //
    //##########################################//

    async updateSettingsFromServer() {
        try {
            // Fetch current settings
            const response = await fetch(`${this.settings.provider_endpoint}/api/currentsettings`);
            if (!response.ok) {
                throw new Error(`Failed to fetch current settings: ${response.statusText}`);
            }
            const currentSettings = await response.json();
            // Update internal settings
            this.settings.modelsAvailable = currentSettings.models_available;
            this.settings.currentModel = currentSettings.current_model_loaded;
            this.settings.deepspeed_available = currentSettings.deepspeed_available;
            this.settings.deepSpeedEnabled = currentSettings.deepspeed_status;
            this.settings.lowVramEnabled = currentSettings.low_vram_status;
            this.settings.finetuned_model = currentSettings.finetuned_model
            // Update HTML elements
            this.updateModelDropdown();
            this.updateCheckboxes();
        } catch (error) {
            console.error(`Error updating settings from server: ${error}`);
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
                option.value = model.model_name;
                option.textContent = model.model_name; // Use model_name instead of name
                option.selected = model.model_name === this.settings.currentModel;
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
        if (lowVramCheckbox) lowVramCheckbox.checked = this.settings.lowVramEnabled;
        if (deepspeedCheckbox) {
            deepspeedCheckbox.checked = this.settings.deepSpeedEnabled;
            deepspeedCheckbox.disabled = !this.settings.deepspeed_available; // Disable checkbox if deepspeed is not available
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
            this.settings.language = this.Settings.language;

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

        let debounceTimeout;
        const debounceDelay = 500; // Milliseconds

        // Define the event handler function
        const onModelSelectChange = async (event) => {
            console.log("Model select change event triggered"); // Debugging statement
            const selectedModel = event.target.value;
            console.log(`Selected model: ${selectedModel}`); // Debugging statement 
            // Set status to Processing
            updateStatus('Processing');
            try {
                const response = await fetch(`${this.settings.provider_endpoint}/api/reload?tts_method=${encodeURIComponent(selectedModel)}`, {
                    method: 'POST'
                });
                if (!response.ok) {
                    throw new Error(`HTTP Error: ${response.status}`);
                }
                const data = await response.json();
                console.log("POST response data:", data); // Debugging statement 
                // Set status to Ready if successful
                updateStatus('Ready');
            } catch (error) {
                console.error("POST request error:", error); // Debugging statement
                // Set status to Error in case of failure
                updateStatus('Error');
            }

            // Handle response or error
        };

        const debouncedModelSelectChange = (event) => {
            clearTimeout(debounceTimeout);
            debounceTimeout = setTimeout(() => {
                onModelSelectChange(event);
            }, debounceDelay);
        };

        // Switch Model Listener
        const modelSelect = document.getElementById('switch_model');
        if (modelSelect) {
            // Remove the event listener if it was previously added
            modelSelect.removeEventListener('change', debouncedModelSelectChange);
            // Add the debounced event listener
            modelSelect.addEventListener('change', debouncedModelSelectChange);
        }

        // DeepSpeed Listener
        const deepspeedCheckbox = document.getElementById('deepspeed');
        if (deepspeedCheckbox) {
            deepspeedCheckbox.addEventListener('change', async (event) => {
                const deepSpeedValue = event.target.checked ? 'True' : 'False';
                // Set status to Processing
                updateStatus('Processing');
                try {
                    const response = await fetch(`${this.settings.provider_endpoint}/api/deepspeed?new_deepspeed_value=${deepSpeedValue}`, {
                        method: 'POST'
                    });
                    if (!response.ok) {
                        throw new Error(`HTTP Error: ${response.status}`);
                    }
                    const data = await response.json();
                    console.log("POST response data:", data); // Debugging statement
                    // Set status to Ready if successful
                    updateStatus('Ready');
                } catch (error) {
                    console.error("POST request error:", error); // Debugging statement
                    // Set status to Error in case of failure
                    updateStatus('Error');
                }
            });
        }

        // Low VRAM Listener
        const lowVramCheckbox = document.getElementById('low_vram');
        if (lowVramCheckbox) {
            lowVramCheckbox.addEventListener('change', async (event) => {
                const lowVramValue = event.target.checked ? 'True' : 'False';
                // Set status to Processing
                updateStatus('Processing');
                try {
                    const response = await fetch(`${this.settings.provider_endpoint}/api/lowvramsetting?new_low_vram_value=${lowVramValue}`, {
                        method: 'POST'
                    });
                    if (!response.ok) {
                        throw new Error(`HTTP Error: ${response.status}`);
                    }
                    const data = await response.json();
                    console.log("POST response data:", data); // Debugging statement
                    // Set status to Ready if successful
                    updateStatus('Ready');
                } catch (error) {
                    console.error("POST request error:", error); // Debugging statement
                    // Set status to Error in case of failure
                    updateStatus('Error');
                }
            });
        }

        // Narrator Voice Dropdown Listener
        const narratorVoiceSelect = document.getElementById('narrator_voice');
        if (narratorVoiceSelect) {
            narratorVoiceSelect.addEventListener('change', (event) => {
                this.settings.narrator_voice_gen = `${event.target.value}.wav`;
                this.onSettingsChangeAllTalk(); // Save the settings after change
            });
        }

        const textNotInsideSelect = document.getElementById('at_narrator_text_not_inside');
        if (textNotInsideSelect) {
            textNotInsideSelect.addEventListener('change', (event) => {
                this.settings.text_not_inside = event.target.value;
                this.onSettingsChangeAllTalk(); // Save the settings after change
            });
        }

        // AT Narrator Dropdown Listener
        const atNarratorSelect = document.getElementById('at_narrator_enabled');
        const ttsPassAsterisksCheckbox = document.getElementById('tts_pass_asterisks'); // Access the checkbox from index.js
        const ttsNarrateQuotedCheckbox = document.getElementById('tts_narrate_quoted'); // Access the checkbox from index.js
        const ttsNarrateDialoguesCheckbox = document.getElementById('tts_narrate_dialogues'); // Access the checkbox from index.js

        if (atNarratorSelect && textNotInsideSelect && narratorVoiceSelect) {
            atNarratorSelect.addEventListener('change', (event) => {
                const isNarratorEnabled = event.target.value === 'true';
                this.settings.narrator_enabled = isNarratorEnabled; // Update the setting here
                textNotInsideSelect.disabled = !isNarratorEnabled;
                narratorVoiceSelect.disabled = !isNarratorEnabled;

                // Sync the state with the checkbox in index.js
                if (isNarratorEnabled) {
                    ttsPassAsterisksCheckbox.checked = false;
                    $('#tts_pass_asterisks').click(); // Simulate a click event
                    $('#tts_pass_asterisks').trigger('change');
                }
                if (!isNarratorEnabled) {
                    ttsPassAsterisksCheckbox.checked = true;
                    $('#tts_pass_asterisks').click(); // Simulate a click event
                    $('#tts_pass_asterisks').trigger('change');
                }
                // Uncheck and set tts_narrate_quoted to false if narrator is enabled
                if (isNarratorEnabled) {
                    ttsNarrateQuotedCheckbox.checked = true;
                    ttsNarrateDialoguesCheckbox.checked = true;
                    // Trigger click events instead of change events
                    $('#tts_narrate_quoted').click();
                    $('#tts_narrate_quoted').trigger('change');
                    $('#tts_narrate_dialogues').click();
                    $('#tts_narrate_dialogues').trigger('change');
                }
                this.onSettingsChangeAllTalk(); // Save the settings after change
            });
        }



        // Event Listener for AT Generation Method Dropdown
        const atGenerationMethodSelect = document.getElementById('at_generation_method');
        const atNarratorEnabledSelect = document.getElementById('at_narrator_enabled');
        if (atGenerationMethodSelect) {
            atGenerationMethodSelect.addEventListener('change', (event) => {
                const selectedMethod = event.target.value;

                if (selectedMethod === 'streaming_enabled') {
                    // Disable and unselect AT Narrator
                    atNarratorEnabledSelect.disabled = true;
                    atNarratorEnabledSelect.value = 'false';
                    textNotInsideSelect.disabled = true;
                    narratorVoiceSelect.disabled = true;
                } else if (selectedMethod === 'standard_generation') {
                    // Enable AT Narrator
                    atNarratorEnabledSelect.disabled = false;
                }
                this.settings.at_generation_method = selectedMethod; // Update the setting here
                this.onSettingsChangeAllTalk(); // Save the settings after change
            });
        }

        // Listener for Language Dropdown
        const languageSelect = document.getElementById('language_options');
        if (languageSelect) {
            languageSelect.addEventListener('change', (event) => {
                this.settings.language = event.target.value;
                this.onSettingsChangeAllTalk(); // Save the settings after change
            });
        }
    }

    //#############################//
    // Store ST interface settings //
    //#############################//

    onSettingsChange() {
        // Update settings that SillyTavern will save
        this.settings.provider_endpoint = $('#at_server').val();
        this.settings.language = $('#language_options').val();
        saveTtsProviderSettings(); // This function should save settings handled by SillyTavern
        // Call the function to handle AllTalk specific settings
        this.onSettingsChangeAllTalk(); // Save the settings after change
    }

    onSettingsChangeAllTalk() {
        // Update AllTalk specific settings and save to localStorage
        this.settings.narrator_enabled = $('#at_narrator_enabled').val() === 'true';
        this.settings.narrator_voice = $('#narrator_voice').val() + '.wav'; // assuming you need to append .wav
        this.settings.text_not_inside = $('#at_narrator_text_not_inside').val(); // "character" or "narrator"
        this.settings.at_generation_method = $('#at_generation_method').val(); // Streaming or standard
        this.settings.language = $('#language_options').val(); // Streaming or standard

        // Call the save function with the current settings
        saveAllTalkSettings({
            narrator_voice: this.settings.narrator_voice,
            narrator_enabled: this.settings.narrator_enabled,
            text_not_inside: this.settings.text_not_inside,
            at_generation_method: this.settings.at_generation_method,
            language: this.settings.language
        });
    }

    //#########################//
    // ST Handle Reload button //
    //#########################//

    async onRefreshClick() {
        await this.checkReady(); // Check if the TTS provider is ready
        await this.loadSettings(this.settings); // Reload the settings
        // Additional actions as needed
    }

    //##################//
    // Preview AT Voice //
    //##################//

    async previewTtsVoice(voiceName) {
        try {
            // Prepare data for POST request
            const postData = new URLSearchParams();
            postData.append("voice", `${voiceName}.wav`);
            // Making the POST request
            const response = await fetch(`${this.settings.provider_endpoint}/api/previewvoice/`, {
                method: "POST",
                headers: {
                    'Content-Type': 'application/x-www-form-urlencoded'
                },
                body: postData,
            });
            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[previewTtsVoice] Error Response Text:`, errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            // Assuming the server returns a URL to the .wav file
            const data = await response.json();
            if (data.output_file_url) {
                // Use an audio element to play the .wav file
                const audioElement = new Audio(data.output_file_url);
                audioElement.play().catch(e => console.error("Error playing audio:", e));
            } else {
                console.warn("[previewTtsVoice] No output file URL received in the response");
                throw new Error("No output file URL received in the response");
            }

        } catch (error) {
            console.error("[previewTtsVoice] Exception caught during preview generation:", error);
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
                // For streaming method
                const streamingUrl = `${this.settings.provider_endpoint}/api/tts-generate-streaming?text=${encodeURIComponent(inputText)}&voice=${encodeURIComponent(voiceId)}.wav&language=${encodeURIComponent(this.settings.language)}&output_file=stream_output.wav`;
                const audioElement = new Audio(streamingUrl);
                audioElement.play(); // Play the audio stream directly
                console.log("Streaming URL:", streamingUrl);
                return new Response(null, {
                    status: 200,
                    statusText: "OK",
                    headers: {
                        "Content-Type": "audio/wav",
                        "Content-Location": streamingUrl
                    }
                });
            } else {
                // For standard method
                const outputUrl = await this.fetchTtsGeneration(inputText, voiceId);
                // Fetch the audio data as a blob from the URL
                const audioResponse = await fetch(outputUrl);
                if (!audioResponse.ok) {
                    throw new Error(`HTTP ${audioResponse.status}: Failed to fetch audio data`);
                }
                const audioBlob = await audioResponse.blob();
                if (!audioBlob.type.startsWith('audio/')) {
                    throw new Error(`Invalid audio data format. Expecting audio/*, got ${audioBlob.type}`);
                }
                return new Response(audioBlob, {
                    status: 200,
                    statusText: "OK",
                    headers: {
                        "Content-Type": audioBlob.type
                    }
                });
            }
        } catch (error) {
            console.error("Error in generateTts:", error);
            throw error;
        }
    }

    //####################//
    //  Generate Standard //
    //####################//

    async fetchTtsGeneration(inputText, voiceId) {
        // Prepare the request payload
        const requestBody = new URLSearchParams({
            'text_input': inputText,
            'text_filtering': "standard",
            'character_voice_gen': voiceId + ".wav",
            'narrator_enabled': this.settings.narrator_enabled,
            'narrator_voice_gen': this.settings.narrator_voice_gen,
            'text_not_inside': this.settings.text_not_inside,
            'language': this.settings.language,
            'output_file_name': "st_output",
            'output_file_timestamp': "true",
            'autoplay': "false",
            'autoplay_volume': "0.8"
        }).toString();

        try {
            const response = await doExtrasFetch(
                `${this.settings.provider_endpoint}/api/tts-generate`,
                {
                    method: 'POST',
                    headers: {
                        'Content-Type': 'application/x-www-form-urlencoded',
                        'Cache-Control': 'no-cache',
                    },
                    body: requestBody
                }
            );

            if (!response.ok) {
                const errorText = await response.text();
                console.error(`[fetchTtsGeneration] Error Response Text:`, errorText);
                // Uncomment the following line if you have a UI element for displaying errors
                // toastr.error(response.statusText, 'TTS Generation Failed');
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }
            const data = await response.json();
            const outputUrl = data.output_file_url;
            return outputUrl; // Return only the output_file_url
        } catch (error) {
            console.error("[fetchTtsGeneration] Exception caught:", error);
            throw error; // Rethrow the error for further handling
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
            // Add more cases as needed
        }
    }
}

//########################//
//  Save/load AT Settings //
//########################//

function saveAllTalkSettings(settingsToSave) {
    // Save the specific settings to localStorage
    console.log("settings", settingsToSave)
    localStorage.setItem('AllTalkSettings', JSON.stringify(settingsToSave));
}

function loadAllTalkSettings() {
    // Retrieve the settings from localStorage
    const settings = localStorage.getItem('AllTalkSettings');
    // If settings exist, parse them back into an object
    if (settings) {
        return JSON.parse(settings);
    }
    return null;
}
