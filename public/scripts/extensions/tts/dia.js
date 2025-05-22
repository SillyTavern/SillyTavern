import { getRequestHeaders } from '../../../script.js';
import { getContext } from '../../extensions.js';
import { saveTtsProviderSettings, getPreviewString } from './index.js';
import { getBase64Async } from '../../utils.js';

export { DiaTtsProvider };

class DiaTtsProvider {
    settings;
    voices = [];
    separator = ' ... ';
    audioElement = document.createElement('audio');

    constructor() {
        // Initialize with defaults as a safety fallback
        this.settings = null;
    }

    defaultSettings = {
        voiceMap: {},
        endpoint: 'http://localhost:7860', // Default endpoint for Dia FastAPI server
        apiKey: 'sk-anything', // Default API key (any string works)
        model: 'dia',
        voiceMappings: {}, // { charName: voiceId }
        audioPrompts: {}, // { promptId: uploadedFileData }
        customVoices: [], // Array of custom voice IDs
    };

    get settingsHtml() {
        const settings = this.settings || this.defaultSettings;
        console.log('DiaTTS: Generating settings HTML, settings:', settings);
        return `
        <div class="dia_tts_settings">
            <label for="dia-tts-endpoint">Endpoint URL</label>
            <input id="dia-tts-endpoint" type="text" class="text_pole" placeholder="http://localhost:7860" value="${settings.endpoint || this.defaultSettings.endpoint}" />
            <small>Base URL for the Dia FastAPI server (without /v1/audio/speech)</small>

            <label for="dia-tts-apikey">API Key</label>
            <input id="dia-tts-apikey" type="text" class="text_pole" placeholder="sk-anything" value="${settings.apiKey || this.defaultSettings.apiKey}" />
            <small>API key (any string works with Dia)</small>

            <hr>
            
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

                <input id="dia-tts-char-save" class="menu_button" type="button" value="Create Custom Voice" />

                <div id="dia-tts-char-list" style="margin-top:15px; border-top:1px solid var(--SmartThemeBorderColor); padding-top:10px;">
                    <small><i>Custom voices will appear in the main voice selection dropdown above.</i></small>
                </div>
            </div>

            <small style="margin-top:10px; display:block; color: var(--SmartThemeQuoteColor);">
                <strong>Note:</strong> Dia TTS uses speaker tags [S1] and [S2]. The provider automatically adds appropriate tags based on character context.
                Use the Voice Map section above to assign voices to characters.
            </small>
        </div>
        `;
    }

    async loadSettings(settingsFromMainExtension) {
        if (!settingsFromMainExtension) {
            console.warn('DiaTTS: No settings object provided by main extension.');
            this.settings = JSON.parse(JSON.stringify(this.defaultSettings));
        } else {
            this.settings = settingsFromMainExtension;
        }

        // Ensure all default keys exist
        for (const key in this.defaultSettings) {
            if (this.settings[key] === undefined) {
                if (typeof this.defaultSettings[key] === 'object' && this.defaultSettings[key] !== null) {
                    this.settings[key] = JSON.parse(JSON.stringify(this.defaultSettings[key]));
                } else {
                    this.settings[key] = this.defaultSettings[key];
                }
            }
        }

        console.log('DiaTTS: Provider configured with settings:', this.settings);

        // Setup UI event handlers
        setTimeout(() => {
            this.setupEventHandlers();
            this.renderCharMappingList();
            this.loadCustomVoices();
        }, 0);

        await this.checkReady();
    }

    setupEventHandlers() {
        const endpointInput = document.getElementById('dia-tts-endpoint');
        const apiKeyInput = document.getElementById('dia-tts-apikey');
        const charSelect = document.getElementById('dia-tts-char-select');
        const voiceNameInput = document.getElementById('dia-tts-voice-name');
        const uploadBtn = document.getElementById('dia-upload-voice-sample');
        const upload = document.getElementById('dia-tts-char-upload');
        const saveBtn = document.getElementById('dia-tts-char-save');
        const refreshBtn = document.getElementById('dia-refresh-characters');

        if (endpointInput) {
            endpointInput.addEventListener('change', (e) => {
                this.settings.endpoint = e.target.value;
                saveTtsProviderSettings();
            });
        }

        if (apiKeyInput) {
            apiKeyInput.addEventListener('change', (e) => {
                this.settings.apiKey = e.target.value;
                saveTtsProviderSettings();
            });
        }

        // Populate character dropdown
        this.populateCharacterDropdown();
        
        // Also refresh dropdown when settings are fully loaded (with a small delay)
        setTimeout(() => {
            this.populateCharacterDropdown();
        }, 1000);

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
        if (upload) {
            upload.addEventListener('change', (e) => {
                const file = e.target.files[0];
                if (file) {
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

        if (saveBtn && charSelect && voiceNameInput && upload) {
            saveBtn.onclick = async () => {
                const charName = charSelect.value;
                if (!charName) {
                    toastr.error('Please select a character');
                    return;
                }

                const file = upload.files[0];
                if (!file) {
                    toastr.error('Please upload a voice sample');
                    return;
                }

                if (!/\.(wav|mp3|ogg|m4a|flac)$/i.test(file.name)) {
                    toastr.error('Please select an audio file (.wav, .mp3, .ogg, .m4a, .flac)');
                    return;
                }

                try {
                    // Disable button and show progress
                    saveBtn.disabled = true;
                    saveBtn.value = 'Creating Voice...';
                    
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
                    await this.createVoiceMapping(customVoiceId, promptId);
                    
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
                    uploadBtn.innerHTML = `
                        <i class="fa-solid fa-file-import"></i>
                        <span>Upload Voice Sample</span>
                    `;
                } catch (error) {
                    console.error('DiaTTS: Error creating custom voice:', error);
                    toastr.error(`Failed to create custom voice: ${error.message}`);
                } finally {
                    // Re-enable button
                    saveBtn.disabled = false;
                    saveBtn.value = 'Create Custom Voice';
                }
            };
        }
    }

    populateCharacterDropdown() {
        const charSelect = document.getElementById('dia-tts-char-select');
        if (!charSelect) return;

        // Clear existing options except the first one
        charSelect.innerHTML = '<option value="">Select Character...</option>';

        try {
            const context = getContext();
            console.log('DiaTTS: Context object:', context);
            
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

            console.log(`DiaTTS: Populated character dropdown with ${characters.length} characters:`, characters);
        } catch (error) {
            console.warn('DiaTTS: Could not populate character dropdown:', error.message);
        }
    }

    async uploadAudioPrompt(promptId, file, retryCount = 0) {
        const maxRetries = 2;
        const formData = new FormData();
        formData.append('prompt_id', promptId);
        formData.append('audio_file', file);

        try {
            const response = await fetch(`${this.settings.endpoint}/v1/audio_prompts/upload`, {
                method: 'POST',
                headers: {
                    'Authorization': `Bearer ${this.settings.apiKey}`
                },
                body: formData
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorDetail = errorText;
                
                try {
                    const errorJson = JSON.parse(errorText);
                    errorDetail = errorJson.detail || errorText;
                } catch (e) {
                    // If not JSON, use the raw text
                }

                // Check if it's a file lock error that might be retryable
                if (errorDetail.includes('being used by another process') && retryCount < maxRetries) {
                    console.warn(`DiaTTS: File lock error, retrying in ${(retryCount + 1) * 1000}ms... (attempt ${retryCount + 1}/${maxRetries + 1})`);
                    
                    // Wait before retrying
                    await new Promise(resolve => setTimeout(resolve, (retryCount + 1) * 1000));
                    return this.uploadAudioPrompt(promptId, file, retryCount + 1);
                }
                
                // More user-friendly error messages
                if (errorDetail.includes('being used by another process')) {
                    throw new Error('Audio file is temporarily locked. Please try again in a few moments, or try using a different audio file.');
                } else if (errorDetail.includes('Failed to process audio file')) {
                    throw new Error('Failed to process audio file. Please ensure it\'s a valid audio format (.wav, .mp3, .ogg, .m4a, .flac).');
                } else {
                    throw new Error(`Upload failed: ${errorDetail}`);
                }
            }

            const result = await response.json();
            console.log('DiaTTS: Audio prompt uploaded successfully:', result);
            return promptId;
            
        } catch (error) {
            if (error.name === 'TypeError' && error.message.includes('fetch')) {
                throw new Error('Cannot connect to Dia server. Please check if the server is running and the endpoint URL is correct.');
            }
            throw error;
        }
    }

    async createVoiceMapping(voiceId, audioPrompt) {
        const response = await fetch(`${this.settings.endpoint}/v1/voice_mappings`, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Authorization': `Bearer ${this.settings.apiKey}`
            },
            body: JSON.stringify({
                voice_id: voiceId,
                style: 'natural',
                primary_speaker: 'S1',
                audio_prompt: audioPrompt
            })
        });

        if (!response.ok) {
            const error = await response.text();
            throw new Error(`Failed to create voice mapping: ${error}`);
        }

        const result = await response.json();
        console.log('DiaTTS: Voice mapping created:', result);
        return result;
    }

    async loadCustomVoices() {
        if (!this.settings || !this.settings.endpoint) {
            console.warn('DiaTTS: Settings not initialized, skipping custom voice loading');
            return;
        }
        
        try {
            const response = await fetch(`${this.settings.endpoint}/v1/voice_mappings`, {
                headers: {
                    'Authorization': `Bearer ${this.settings.apiKey}`
                }
            });

            if (response.ok) {
                const voiceMappings = await response.json();
                const voiceSelect = document.getElementById('dia-tts-voice-select');
                
                if (voiceSelect) {
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
            console.warn('DiaTTS: Could not load custom voices:', error.message);
        }
    }

    async checkReady() {
        if (!this.settings || !this.settings.endpoint) {
            console.warn('DiaTTS: Settings not initialized, skipping health check');
            return false;
        }
        
        try {
            const response = await fetch(`${this.settings.endpoint}/health`);
            if (response.ok) {
                console.log('DiaTTS: Server is ready');
                return true;
            } else {
                console.warn(`DiaTTS: Server health check returned ${response.status}`);
            }
        } catch (error) {
            console.warn('DiaTTS: Server health check failed:', error.message);
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

    async fetchTtsVoiceObjects() {
        console.log('DiaTTS: Fetching available voices');
        
        const voices = [
            { name: 'Alloy', voice_id: 'alloy', preview_url: '', lang: 'en-US', description: 'Built-in voice' },
            { name: 'Echo', voice_id: 'echo', preview_url: '', lang: 'en-US', description: 'Built-in voice' },
            { name: 'Fable', voice_id: 'fable', preview_url: '', lang: 'en-US', description: 'Built-in voice' },
            { name: 'Nova', voice_id: 'nova', preview_url: '', lang: 'en-US', description: 'Built-in voice' },
            { name: 'Onyx', voice_id: 'onyx', preview_url: '', lang: 'en-US', description: 'Built-in voice' },
            { name: 'Shimmer', voice_id: 'shimmer', preview_url: '', lang: 'en-US', description: 'Built-in voice' }
        ];

        // Add custom voices if settings are available
        if (this.settings && this.settings.customVoices && Array.isArray(this.settings.customVoices)) {
            for (const customVoice of this.settings.customVoices) {
                voices.push({
                    name: `${customVoice} (Custom)`,
                    voice_id: customVoice,
                    preview_url: '',
                    lang: 'en-US',
                    description: 'Custom cloned voice'
                });
            }
        }

        console.log(`DiaTTS: Returning ${voices.length} voice objects:`, voices);
        return voices;
    }

    async generateTts(text, voiceId, char) {
        if (!this.settings) {
            console.warn('DiaTTS: Settings not initialized, using defaults');
            this.settings = { ...this.defaultSettings };
        }

        console.log(`DiaTTS: Generating TTS for "${text}" with voice "${voiceId}" for character "${char}"`);

        // Determine voice to use - check character mapping first
        let selectedVoice = voiceId;
        if (char && this.settings.voiceMappings && this.settings.voiceMappings[char]) {
            selectedVoice = this.settings.voiceMappings[char];
            console.log(`DiaTTS: Using mapped voice "${selectedVoice}" for character "${char}"`);
        }

        // Add speaker tags based on character
        let speakerTag = '[S2]'; // Default for characters
        if (char) {
            const c = char.toLowerCase();
            if (c === 'user' || c === 'narrator') {
                speakerTag = '[S1]';
            }
        }
        const formattedText = `${speakerTag} ${text}`;

        try {
            const endpoint = `${this.settings.endpoint}/v1/audio/speech`;
            
            const payload = {
                model: this.settings.model,
                input: formattedText,
                voice: selectedVoice,
                response_format: 'wav',
                speed: 1.0
            };

            console.log(`DiaTTS: Sending request to ${endpoint}`, payload);

            const response = await fetch(endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': `Bearer ${this.settings.apiKey}`
                },
                body: JSON.stringify(payload)
            });

            if (!response.ok) {
                const errorText = await response.text().catch(() => 'Unknown error');
                console.error(`DiaTTS: HTTP ${response.status}: ${errorText}`);
                throw new Error(`Dia TTS: HTTP ${response.status} - ${errorText}`);
            }

            console.log('DiaTTS: Successfully received audio response');
            return response;

        } catch (error) {
            console.error('DiaTTS: Error in generateTts:', error);
            throw error;
        }
    }

    async previewTtsVoice(id) {
        if (!this.settings) {
            console.warn('DiaTTS: Settings not initialized for preview, using defaults');
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
            const response = await fetch(`${this.settings.endpoint}/v1/voice_mappings/${voiceId}`, {
                method: 'DELETE',
                headers: {
                    'Authorization': `Bearer ${this.settings.apiKey}`
                }
            });

            if (!response.ok) {
                console.warn(`DiaTTS: Could not delete voice from server: ${response.status}`);
            }
        } catch (error) {
            console.warn('DiaTTS: Error deleting voice from server:', error.message);
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
