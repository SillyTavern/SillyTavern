import { getPreviewString, initVoiceMap, saveTtsProviderSettings } from './index.js';
import { event_types, eventSource, getRequestHeaders } from '../../../script.js';
import { SECRET_KEYS, secret_state } from '../../secrets.js';
import { getBase64Async } from '../../utils.js';

export { DashScopeTtsProvider };

class DashScopeTtsProvider {
    settings;
    voices = [];
    audioElement = document.createElement('audio');

    maxCloneFileSize = 500 * 1024 * 1024; // 500 MB safeguard

    defaultSettings = {
        apiHost: 'https://dashscope.aliyuncs.com',
        modelOfficialVoice: 'qwen3-tts-flash',
        modelVcVoice: 'qwen3-tts-vc-realtime-2025-11-27',
        modelVdVoice: 'qwen3-tts-vd-realtime-2025-12-16',
        format: 'wav',
        customVoices: [], // Store custom voices: [{ name, voiceId, type: 'clone'/'design', description, createdAt }]
    };

    static defaultVoices = [
        { name: 'Cherry', voice_id: 'Cherry', lang: 'zh-CN', preview_url: null },
        { name: 'Ryan', voice_id: 'Ryan', lang: 'en-US', preview_url: null },
    ];

    get settingsHtml() {
        return `
        <div class="dashscope_tts_settings">
            <div class="tts_block justifyCenter">
                <div id="api_key_dashscope" class="menu_button menu_button_icon manage-api-keys" data-key="api_key_dashscope">
                    <i class="fa-solid fa-key"></i>
                    <span>Click to set API Key</span>
                </div>
            </div>
            <div class="tts_block">
                <label for="dashscope_tts_api_host">API Host</label>
                <select id="dashscope_tts_api_host" class="text_pole">
                    <option value="https://dashscope.aliyuncs.com">China (Beijing)</option>
                    <option value="https://dashscope-intl.aliyuncs.com">International (Singapore)</option>
                </select>
            </div>
            <div class="tts_block">
                <input id="dashscope_connect" class="menu_button" type="button" value="Test Connection" />
            </div>
            <div class="tts_block">
                <label>Model Selection (Choose Voice Type)</label>
                <div style="display: flex; flex-direction: column; gap: 10px; margin-top: 8px;">
                    <label style="display: flex; flex-direction: column; gap: 4px;">
                        <span style="font-weight: 700;">Official Voice</span>
                        <select id="dashscope_model_official_select" class="text_pole">
                            <option value="qwen3-tts-flash">qwen3-tts-flash</option>
                        </select>
                    </label>
                    <label style="display: flex; flex-direction: column; gap: 4px;">
                        <span style="font-weight: 700;">Voice Clone (VC)</span>
                        <select id="dashscope_model_vc_select" class="text_pole">
                            <option value="qwen3-tts-vc-realtime-2025-11-27">qwen3-tts-vc-realtime-2025-11-27</option>
                        </select>
                    </label>
                    <label style="display: flex; flex-direction: column; gap: 4px;">
                        <span style="font-weight: 700;">Voice Design (VD)</span>
                        <select id="dashscope_model_vd_select" class="text_pole">
                            <option value="qwen3-tts-vd-realtime-2025-12-16">qwen3-tts-vd-realtime-2025-12-16</option>
                        </select>
                    </label>
                </div>
            </div>
            <div class="tts_block">
                <label for="dashscope_tts_format">Audio Format</label>
                <select id="dashscope_tts_format" class="text_pole">
                    <option value="wav">WAV</option>
                </select>
            </div>
            
            <hr class="sysMsg" />
            <h4>🎨 Custom Voice Creation</h4>
            
            <div class="tts_block">
                <label><i class="fa-solid fa-microphone"></i> Voice Clone (VC)</label>
                <small class="notes">Upload 3+ seconds audio to clone a voice</small>
                <div style="display: flex; gap: 10px; margin-top: 5px; align-items: center;">
                    <input type="file" id="dashscope_voice_clone_file" accept="audio/*" style="display: block; position: absolute; left: -9999px; width: 1px; height: 1px;" />
                    <button id="dashscope_voice_clone_select" class="menu_button" type="button" style="flex: 0 0 auto; white-space: nowrap;">Select Audio</button>
                    <span id="dashscope_voice_clone_filename" style="flex: 1; font-size: 12px; opacity: 0.8; overflow: hidden; text-overflow: ellipsis; white-space: nowrap;">No file selected</span>
                    <input id="dashscope_voice_clone_name" class="text_pole" type="text" placeholder="Voice name" style="flex: 1;" />
                </div>
                <input id="dashscope_create_clone" class="menu_button" type="button" value="Create Cloned Voice" style="margin-top: 5px;" />
            </div>
            
            <div class="tts_block">
                <label><i class="fa-solid fa-wand-magic-sparkles"></i> Voice Design (VD)</label>
                <small class="notes">Describe the voice you want to create</small>
                <div style="display: flex; gap: 10px; margin-top: 5px;">
                    <input id="dashscope_voice_design_name" class="text_pole" type="text" placeholder="Voice name" style="flex: 1;" />
                </div>
                <textarea id="dashscope_voice_design_desc" class="text_pole" rows="3" placeholder="Example: A warm and gentle female voice, clear pronunciation, moderate speed, suitable for storytelling..." style="margin-top: 5px; width: 100%; resize: vertical;"></textarea>
                <input id="dashscope_create_design" class="menu_button" type="button" value="Create Designed Voice" style="margin-top: 5px;" />
            </div>
            
            <div class="tts_block" id="dashscope_custom_voices_block">
                <label><i class="fa-solid fa-list"></i> Custom Voices</label>
                <div id="dashscope_custom_voices_list" style="margin-top: 10px;">
                    <small class="notes">No custom voices yet. Create one above!</small>
                </div>
            </div>
        </div>
        `;
    }

    constructor() {
        this.handler = async function (/** @type {string} */ key) {
            if (key !== SECRET_KEYS.DASHSCOPE) return;
            $('#api_key_dashscope').toggleClass('success', !!secret_state[SECRET_KEYS.DASHSCOPE]);
        }.bind(this);

        // Store instance globally for onclick handlers
        globalThis.dashscopeProviderInstance = this;
    }

    dispose() {
        [event_types.SECRET_WRITTEN, event_types.SECRET_DELETED, event_types.SECRET_ROTATED].forEach(event => {
            eventSource.removeListener(event, this.handler);
        });
    }

    onSettingsChange() {
        this.settings.apiHost = $('#dashscope_tts_api_host').val();
        this.settings.modelOfficialVoice = $('#dashscope_model_official_select').val() || this.defaultSettings.modelOfficialVoice;
        this.settings.modelVcVoice = $('#dashscope_model_vc_select').val() || this.defaultSettings.modelVcVoice;
        this.settings.modelVdVoice = $('#dashscope_model_vd_select').val() || this.defaultSettings.modelVdVoice;
        this.settings.format = $('#dashscope_tts_format').find(':selected').val();
        saveTtsProviderSettings();
    }

    async loadSettings(settings) {
        if (Object.keys(settings).length === 0) {
            console.info('Using default DashScope TTS Provider settings');
        }

        this.settings = { ...this.defaultSettings };
        for (const key in settings) {
            if (key in this.settings) {
                this.settings[key] = settings[key];
            } else {
                console.warn(`Invalid setting passed to DashScope TTS Provider: ${key}`);
            }
        }

        $('#dashscope_tts_api_host').val(this.settings.apiHost || this.defaultSettings.apiHost);
        $('#dashscope_model_official_select').val(this.settings.modelOfficialVoice || this.defaultSettings.modelOfficialVoice);
        $('#dashscope_model_vc_select').val(this.settings.modelVcVoice || this.defaultSettings.modelVcVoice);
        $('#dashscope_model_vd_select').val(this.settings.modelVdVoice || this.defaultSettings.modelVdVoice);
        $('#dashscope_tts_format').val(this.settings.format || this.defaultSettings.format);

        $('#dashscope_tts_api_host').on('change', this.onSettingsChange.bind(this));
        $('#dashscope_model_official_select').on('change', this.onSettingsChange.bind(this));
        $('#dashscope_model_vc_select').on('change', this.onSettingsChange.bind(this));
        $('#dashscope_model_vd_select').on('change', this.onSettingsChange.bind(this));
        $('#dashscope_tts_format').on('change', this.onSettingsChange.bind(this));

        // Custom voice buttons
        $('#dashscope_create_clone').on('click', this.onCreateCloneClick.bind(this));
        $('#dashscope_create_design').on('click', this.onCreateDesignClick.bind(this));
        $('#dashscope_voice_clone_select').on('click', () => {
            $('#dashscope_voice_clone_file').trigger('click');
        });
        $('#dashscope_voice_clone_file').on('change', this.onCloneFileChanged.bind(this));

        // Load custom voices
        this.renderCustomVoices();

        $('#dashscope_connect').on('click', () => {
            try {
                this.onTestConnectionClick();
            } catch (error) {
                console.error('DashScope TTS: Error in connect click handler:', error);
                toastr.error(`Connection test failed: ${error.message}`);
            }
        });

        $('#api_key_dashscope').toggleClass('success', !!secret_state[SECRET_KEYS.DASHSCOPE]);
        [event_types.SECRET_WRITTEN, event_types.SECRET_DELETED, event_types.SECRET_ROTATED].forEach(event => {
            eventSource.on(event, this.handler);
        });

        try {
            await this.checkReady();
        } catch (error) {
            console.debug('DashScope: Settings loaded, but not ready', error);
        }

        try {
            await initVoiceMap();
        } catch (error) {
            console.debug('DashScope: Voice map init failed, continuing');
        }
    }

    async checkReady() {
        if (!secret_state[SECRET_KEYS.DASHSCOPE]) {
            throw new Error('API Key is required');
        }
    }

    getAllVoices() {
        const systemVoices = [...DashScopeTtsProvider.defaultVoices];
        const customVoices = (this.settings.customVoices || []).map(cv => ({
            name: `${cv.name} (${cv.type === 'clone' ? '🎤' : '✨'})`,
            voice_id: cv.voiceId,
            lang: 'custom',
            preview_url: null,
            isCustom: true,
        }));
        return [...systemVoices, ...customVoices];
    }

    async getVoice(voiceName) {
        const voices = this.getAllVoices();
        const voice = voices.find(v => v.voice_id === voiceName || v.name === voiceName);
        if (!voice) {
            const error = new Error(`TTS Voice not found: ${voiceName}`);
            console.error('DashScope TTS getVoice error:', error.message);
            throw error;
        }
        return voice;
    }

    async fetchTtsVoiceObjects() {
        return this.getAllVoices();
    }

    mapLanguageToDashScopeType(lang) {
        const languageMap = {
            'zh-CN': 'Chinese',
            'zh-TW': 'Chinese',
            'en-US': 'English',
            'en-GB': 'English',
            'ja-JP': 'Japanese',
            'ko-KR': 'Korean',
            'fr-FR': 'French',
            'de-DE': 'German',
            'es-ES': 'Spanish',
            'pt-BR': 'Portuguese',
            'it-IT': 'Italian',
            'ru-RU': 'Russian',
        };
        return languageMap[lang] || 'English';
    }

    async generateTts(text, voiceId) {
        // Determine language from voice or default
        let languageType = 'English';
        try {
            const voice = await this.getVoice(voiceId);
            languageType = this.mapLanguageToDashScopeType(voice.lang || 'zh-CN');
        } catch (error) {
            console.debug('DashScope TTS: Could not determine voice language, using default');
        }

        return await this.fetchTtsGeneration(text, voiceId, languageType);
    }

    async fetchTtsGeneration(inputText, voiceId, languageType) {
        console.info(`Generating new DashScope TTS for voice ${voiceId}`);

        if (!secret_state[SECRET_KEYS.DASHSCOPE]) {
            const error = new Error('API Key is required');
            console.error('DashScope TTS fetchTtsGeneration error:', error.message);
            throw error;
        }

        // Determine model based on voice_id or known custom voice type
        const customVoice = (this.settings.customVoices || []).find(v => v.voiceId === voiceId);
        let selectedModel = this.settings.modelOfficialVoice || this.defaultSettings.modelOfficialVoice;
        const vcModel = this.settings.modelVcVoice || this.defaultSettings.modelVcVoice;
        const vdModel = this.settings.modelVdVoice || this.defaultSettings.modelVdVoice;

        // If the voice is one of the saved custom voices, trust its type
        if (customVoice) {
            if (customVoice.type === 'clone') {
                selectedModel = vcModel;
            } else if (customVoice.type === 'design') {
                selectedModel = vdModel;
            }
        } else if (voiceId && voiceId.startsWith('qwen-tts-vc-')) {
            selectedModel = vcModel;
        } else if (voiceId && voiceId.startsWith('qwen-tts-vd-')) {
            selectedModel = vdModel;
        }

        const requestBody = {
            text: inputText,
            voiceId: voiceId,
            apiHost: this.settings.apiHost || this.defaultSettings.apiHost,
            model: selectedModel,
            format: this.settings.format || this.defaultSettings.format,
            languageType: languageType,
        };

        try {
            const response = await fetch('/api/dashscope/generate-voice', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify(requestBody),
            });

            if (!response.ok) {
                let rawErrorText = await response.text();
                let userMessage = rawErrorText;

                // Try to parse JSON error responses to extract a meaningful message
                try {
                    const parsed = JSON.parse(rawErrorText);
                    if (parsed && typeof parsed.message === 'string' && parsed.message.trim()) {
                        userMessage = parsed.message;
                    } else if (parsed && typeof parsed.error === 'string' && parsed.error.trim()) {
                        userMessage = parsed.error;
                    } else if (parsed?.error?.message) {
                        userMessage = parsed.error.message;
                    } else if (parsed && typeof parsed.detail === 'string' && parsed.detail.trim()) {
                        userMessage = parsed.detail;
                    }
                } catch (e) {
                    // rawErrorText is not JSON; keep it as-is
                }

                if (!userMessage || !userMessage.trim()) {
                    userMessage = `HTTP ${response.status}`;
                }

                toastr.error(userMessage, 'DashScope TTS Generation Failed');
                const error = new Error(userMessage);
                console.error('DashScope TTS fetchTtsGeneration error:', error.message);
                throw error;
            }

            return response;
        } catch (error) {
            console.error('Error in DashScope TTS generation:', error);
            throw error;
        }
    }

    async previewTtsVoice(voiceId) {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;

        try {
            const voice = await this.getVoice(voiceId);
            const previewLang = voice.lang || 'zh-CN';
            const text = getPreviewString(previewLang);
            const languageType = this.mapLanguageToDashScopeType(previewLang);

            const response = await this.fetchTtsGeneration(text, voiceId, languageType);
            if (!response.ok) {
                const errorText = await response.text();
                const error = new Error(`HTTP ${response.status}: ${errorText}`);
                console.error('DashScope TTS previewTtsVoice error:', error.message);
                throw error;
            }

            const audio = await response.blob();
            const srcUrl = await getBase64Async(audio);

            this.audioElement.onended = null;
            this.audioElement.onerror = null;
            this.audioElement.src = srcUrl;

            try {
                await this.audioElement.play();
                console.debug('DashScope TTS: Audio playback started');
            } catch (playError) {
                console.error('DashScope TTS: Play error:', playError);
                throw new Error(`Audio playback failed: ${playError.message}`);
            }

            this.audioElement.onended = () => {
                this.audioElement.onended = null;
                this.audioElement.onerror = null;
            };
        } catch (error) {
            console.error('DashScope TTS Preview Error:', error);
            toastr.error(`Could not generate preview: ${error.message}`);
        }
    }

    async onTestConnectionClick() {
        try {
            const apiHost = this.settings.apiHost || this.defaultSettings.apiHost;
            const model = this.defaultSettings.modelOfficialVoice; // Use official voice model for connection test
            const format = this.settings.format || this.defaultSettings.format;

            console.log(`DashScope TTS: Testing connection to ${apiHost}`);

            // Test by attempting to generate a short piece of audio
            const testText = 'Test';
            const response = await fetch('/api/dashscope/test-connection', {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    ...getRequestHeaders(),
                },
                body: JSON.stringify({
                    text: testText,
                    apiHost: apiHost,
                    model: model,
                    format: format,
                    voiceId: 'Cherry',
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                let errorMsg;
                try {
                    const errorJson = JSON.parse(errorText);
                    errorMsg = errorJson.error || `HTTP ${response.status}`;
                } catch (e) {
                    errorMsg = `HTTP ${response.status}: ${errorText}`;
                }

                console.error('DashScope TTS test connection error:', errorMsg);
                throw new Error(errorMsg);
            }

            const result = await response.json();
            const hostLabel = apiHost.includes('intl') ? 'International (Singapore)' : 'China (Beijing)';
            toastr.success(`DashScope TTS: Successfully connected to ${hostLabel}`);
            console.log('DashScope TTS: Connection test passed', result);
        } catch (error) {
            console.error('DashScope TTS: Connection test failed:', error);
            toastr.error(`DashScope TTS: ${error.message}`);
        }
    }

    renderCustomVoices() {
        const listContainer = $('#dashscope_custom_voices_list');
        const customVoices = this.settings.customVoices || [];

        listContainer.empty();

        if (customVoices.length === 0) {
            listContainer.append($('<small class="notes">').text('No custom voices yet. Create one above!'));
            return;
        }

        const grid = $('<div>')
            .addClass('custom_voices_grid')
            .attr('style', 'display: flex; flex-direction: column; gap: 8px;');

        customVoices.forEach((voice, index) => {
            const icon = voice.type === 'clone' ? '🎤' : '✨';
            const typeLabel = voice.type === 'clone' ? 'Voice Clone' : 'Voice Design';
            const date = new Date(voice.createdAt).toLocaleDateString();

            const item = $('<div>')
                .addClass('custom_voice_item')
                .attr('style', 'display: flex; align-items: center; gap: 10px; padding: 10px; background: rgba(0,0,0,0.1); border-radius: 5px;');

            const iconSpan = $('<span>').attr('style', 'font-size: 20px;').text(icon);

            const contentDiv = $('<div>').attr('style', 'flex: 1;');
            const nameDiv = $('<div>').attr('style', 'font-weight: bold;').text(voice.name);
            const metaSmall = $('<small>').attr('style', 'opacity: 0.7;').text(`${typeLabel} • ${date}`);
            contentDiv.append(nameDiv, metaSmall);

            const previewButton = $('<button>', {
                type: 'button',
                class: 'menu_button menu_button_icon',
                title: 'Preview',
            });
            previewButton.append($('<i>').addClass('fa-solid fa-play'));
            previewButton.on('click', (event) => {
                if (event?.preventDefault) {
                    event.preventDefault();
                }
                const provider = globalThis.dashscopeProviderInstance;
                if (provider) {
                    provider.previewCustomVoice(voice.voiceId);
                }
            });

            const deleteButton = $('<button>', {
                class: 'menu_button menu_button_icon caution',
                title: 'Delete',
            });
            deleteButton.append($('<i>').addClass('fa-solid fa-trash'));
            deleteButton.on('click', (event) => {
                if (event?.preventDefault) {
                    event.preventDefault();
                }
                const provider = globalThis.dashscopeProviderInstance;
                if (provider) {
                    provider.deleteCustomVoice(index);
                }
            });

            item.append(iconSpan, contentDiv, previewButton, deleteButton);
            grid.append(item);
        });

        listContainer.append(grid);
    }

    async onCreateCloneClick() {
        try {
            const fileInput = document.getElementById('dashscope_voice_clone_file');
            const nameInput = $('#dashscope_voice_clone_name');
            const nameLabel = document.getElementById('dashscope_voice_clone_filename');

            const file = fileInput.files[0];
            const name = nameInput.val().trim();

            if (!file) {
                toastr.warning('Please select an audio file');
                return;
            }

            if (file.size > this.maxCloneFileSize) {
                toastr.warning('Audio file is too large (max 500MB)');
                return;
            }

            if (!name) {
                toastr.warning('Please enter a voice name');
                return;
            }

            if (!secret_state[SECRET_KEYS.DASHSCOPE]) {
                toastr.error('API Key is required');
                return;
            }

            toastr.info('Creating cloned voice... This may take a moment.');

            // Convert file to base64
            const base64Audio = await this.fileToBase64(file);

            const response = await fetch('/api/dashscope/create-voice-clone', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({
                    name: name,
                    audioData: base64Audio,
                    apiHost: this.settings.apiHost || this.defaultSettings.apiHost,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || `HTTP ${response.status}`);
            }

            const result = await response.json();

            // Add to custom voices
            if (!this.settings.customVoices) {
                this.settings.customVoices = [];
            }

            this.settings.customVoices.push({
                name: name,
                voiceId: result.voiceId,
                type: 'clone',
                createdAt: new Date().toISOString(),
            });

            saveTtsProviderSettings();
            this.renderCustomVoices();

            // Clear inputs
            fileInput.value = '';
            nameInput.val('');
            if (nameLabel) {
                nameLabel.textContent = 'No file selected';
            }

            toastr.success(`Voice "${name}" created successfully!`);
        } catch (error) {
            console.error('DashScope Voice Clone Error:', error);
            toastr.error(`Failed to create cloned voice: ${error.message}`);
        }
    }

    async onCreateDesignClick() {
        try {
            const nameInput = $('#dashscope_voice_design_name');
            const descInput = $('#dashscope_voice_design_desc');

            const name = nameInput.val().trim();
            const description = descInput.val().trim();

            if (!name) {
                toastr.warning('Please enter a voice name');
                return;
            }

            if (!description) {
                toastr.warning('Please enter a voice description');
                return;
            }

            if (!secret_state[SECRET_KEYS.DASHSCOPE]) {
                toastr.error('API Key is required');
                return;
            }

            toastr.info('Creating designed voice... This may take a moment.');

            const response = await fetch('/api/dashscope/create-voice-design', {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({
                    name: name,
                    description: description,
                    apiHost: this.settings.apiHost || this.defaultSettings.apiHost,
                }),
            });

            if (!response.ok) {
                const errorText = await response.text();
                throw new Error(errorText || `HTTP ${response.status}`);
            }

            const result = await response.json();

            // Add to custom voices
            if (!this.settings.customVoices) {
                this.settings.customVoices = [];
            }

            this.settings.customVoices.push({
                name: name,
                voiceId: result.voiceId,
                type: 'design',
                description: description,
                createdAt: new Date().toISOString(),
            });

            saveTtsProviderSettings();
            this.renderCustomVoices();

            // Clear inputs
            nameInput.val('');
            descInput.val('');

            toastr.success(`Voice "${name}" created successfully!`);
        } catch (error) {
            console.error('DashScope Voice Design Error:', error);
            toastr.error(`Failed to create designed voice: ${error.message}`);
        }
    }

    async previewCustomVoice(voiceId) {
        try {
            await this.checkReady();
            await this.previewTtsVoice(voiceId);
        } catch (error) {
            console.error('DashScope Custom Voice Preview Error:', error);
            toastr.error(`Preview failed: ${error.message}`);
        }
    }

    deleteCustomVoice(index) {
        if (!this.settings.customVoices || index >= this.settings.customVoices.length) {
            return;
        }

        const voice = this.settings.customVoices[index];

        if (confirm(`Delete custom voice "${voice.name}"?`)) {
            this.settings.customVoices.splice(index, 1);
            saveTtsProviderSettings();
            this.renderCustomVoices();
            toastr.info(`Voice "${voice.name}" deleted`);
        }
    }

    fileToBase64(file) {
        return new Promise((resolve, reject) => {
            const reader = new FileReader();
            reader.onload = () => resolve(reader.result);
            reader.onerror = reject;
            reader.readAsDataURL(file);
        });
    }

    onCloneFileChanged() {
        const fileInput = document.getElementById('dashscope_voice_clone_file');
        const nameLabel = document.getElementById('dashscope_voice_clone_filename');

        if (!fileInput || !nameLabel) {
            return;
        }

        const file = fileInput.files?.[0];
        nameLabel.textContent = file ? file.name : 'No file selected';
    }
}
