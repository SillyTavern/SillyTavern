import { saveTtsProviderSettings } from './index.js';
import { event_types, eventSource, getRequestHeaders } from '/script.js';
import { SECRET_KEYS, secret_state, writeSecret } from '/scripts/secrets.js';
import { getBase64Async } from '/scripts/utils.js';
export { ElevenLabsTtsProvider };

class ElevenLabsTtsProvider {
    settings;
    voices = [];
    separator = ' ... ... ... ';

    defaultSettings = {
        stability: 0.75,
        similarity_boost: 0.75,
        style_exaggeration: 0.00,
        speaker_boost: true,
        speed: 1.0,
        model: 'eleven_turbo_v2_5',
        voiceMap: {},
    };

    get settingsHtml() {
        let html = `
        <div class="elevenlabs_tts_settings">
            <div class="flex-container alignItemsBaseline">
                <h4 for="elevenlabs_tts_key" class="flex1 margin0">
                    <a href="https://elevenlabs.io/app/developers/api-keys" target="_blank">ElevenLabs TTS Key</a>
                </h4>
                <div id="elevenlabs_tts_key" class="menu_button menu_button_icon manage-api-keys" data-key="api_key_elevenlabs">
                    <i class="fa-solid fa-key"></i>
                    <span>Click to set</span>
                </div>
            </div>
            <label for="elevenlabs_tts_model">Model</label>
            <select id="elevenlabs_tts_model" class="text_pole">
                <option value="eleven_v3">Eleven v3</option>
                <option value="eleven_ttv_v3">Eleven ttv v3</option>
                <option value="eleven_multilingual_v2">Multilingual v2</option>
                <option value="eleven_flash_v2_5">Eleven Flash v2.5</option>
                <option value="eleven_turbo_v2_5">Turbo v2.5</option>
                <option value="eleven_multilingual_ttv_v2">Multilingual ttv v2</option>
                <option value="eleven_monolingual_v1">English v1 (Old)</option>
                <option value="eleven_multilingual_v1">Multilingual v1 (Old)</option>
                <option value="eleven_turbo_v2">Turbo v2 (Old)</option>
            </select>
            <label for="elevenlabs_tts_stability">Stability: <span id="elevenlabs_tts_stability_output"></span></label>
            <input id="elevenlabs_tts_stability" type="range" value="${this.defaultSettings.stability}" min="0" max="1" step="0.01" />
            <label for="elevenlabs_tts_similarity_boost">Similarity Boost: <span id="elevenlabs_tts_similarity_boost_output"></span></label>
            <input id="elevenlabs_tts_similarity_boost" type="range" value="${this.defaultSettings.similarity_boost}" min="0" max="1" step="0.01" />
            <label for="elevenlabs_tts_speed">Speed: <span id="elevenlabs_tts_speed_output"></span></label>
            <input id="elevenlabs_tts_speed" type="range" value="${this.defaultSettings.speed}" min="0.7" max="1.2" step="0.01" />
            <div id="elevenlabs_tts_v2_options" style="display: none;">
                <label for="elevenlabs_tts_style_exaggeration">Style Exaggeration: <span id="elevenlabs_tts_style_exaggeration_output"></span></label>
                <input id="elevenlabs_tts_style_exaggeration" type="range" value="${this.defaultSettings.style_exaggeration}" min="0" max="1" step="0.01" />
                <label for="elevenlabs_tts_speaker_boost">Speaker Boost:</label>
                <input id="elevenlabs_tts_speaker_boost" style="display: inline-grid" type="checkbox" />
            </div>
            <hr>
            <div id="elevenlabs_tts_voice_cloning">
                <span>Instant Voice Cloning</span><br>
                <input id="elevenlabs_tts_voice_cloning_name" type="text" class="text_pole" placeholder="Voice Name"/>
                <input id="elevenlabs_tts_voice_cloning_description" type="text" class="text_pole" placeholder="Voice Description"/>
                <input id="elevenlabs_tts_voice_cloning_labels" type="text" class="text_pole" placeholder="Labels"/>
                <div class="menu_button menu_button_icon" id="upload_audio_file">
                    <i class="fa-solid fa-file-import"></i>
                    <span>Upload Audio Files</span>
                </div>
                <input id="elevenlabs_tts_audio_files" type="file" name="audio_files" accept="audio/*" style="display: none;" multiple>
                <div id="elevenlabs_tts_selected_files_list"></div>
                <input id="elevenlabs_tts_clone_voice_button" class="menu_button menu_button_icon" type="button" value="Clone Voice">
            </div>
            <hr>
        </div>
        `;
        return html;
    }

    constructor() {
        this.handler = async function (/** @type {string} */ key) {
            if (key !== SECRET_KEYS.ELEVENLABS) return;
            $('#elevenlabs_tts_key').toggleClass('success', !!secret_state[SECRET_KEYS.ELEVENLABS]);
            await this.fetchTtsVoiceObjects();
        }.bind(this);
    }

    dispose() {
        [event_types.SECRET_WRITTEN, event_types.SECRET_DELETED, event_types.SECRET_ROTATED].forEach(event => {
            eventSource.removeListener(event, this.handler);
        });
    }

    shouldInvolveExtendedSettings() {
        // Models that support extended settings (style_exaggeration, speaker_boost)
        const modelsWithExtendedSettings = [
            'eleven_v3',
            'eleven_ttv_v3',
            'eleven_multilingual_v2',
            'eleven_multilingual_ttv_v2',
        ];
        return modelsWithExtendedSettings.includes(this.settings.model);
    }

    onSettingsChange() {
        // Update dynamically
        this.settings.stability = $('#elevenlabs_tts_stability').val();
        this.settings.similarity_boost = $('#elevenlabs_tts_similarity_boost').val();
        this.settings.style_exaggeration = $('#elevenlabs_tts_style_exaggeration').val();
        this.settings.speaker_boost = $('#elevenlabs_tts_speaker_boost').is(':checked');
        this.settings.speed = $('#elevenlabs_tts_speed').val();
        this.settings.model = $('#elevenlabs_tts_model').find(':selected').val();
        $('#elevenlabs_tts_stability_output').text(Math.round(this.settings.stability * 100) + '%');
        $('#elevenlabs_tts_similarity_boost_output').text(Math.round(this.settings.similarity_boost * 100) + '%');
        $('#elevenlabs_tts_style_exaggeration_output').text(Math.round(this.settings.style_exaggeration * 100) + '%');
        $('#elevenlabs_tts_speed_output').text(this.settings.speed + 'x');
        $('#elevenlabs_tts_v2_options').toggle(this.shouldInvolveExtendedSettings());
        saveTtsProviderSettings();
    }

    async loadSettings(settings) {
        // Pupulate Provider UI given input settings
        if (Object.keys(settings).length == 0) {
            console.info('Using default TTS Provider settings');
        }

        // Only accept keys defined in defaultSettings
        this.settings = this.defaultSettings;

        // Migrate old settings
        if (settings.multilingual !== undefined) {
            settings.model = settings.multilingual ? 'eleven_multilingual_v1' : 'eleven_monolingual_v1';
            delete settings.multilingual;
        }

        if (Object.hasOwn(settings, 'apiKey')) {
            if (settings.apiKey && !secret_state[SECRET_KEYS.ELEVENLABS]){
                await writeSecret(SECRET_KEYS.ELEVENLABS, settings.apiKey);
            }
            delete settings.apiKey;
        }

        $('#elevenlabs_tts_key').toggleClass('success', !!secret_state[SECRET_KEYS.ELEVENLABS]);
        [event_types.SECRET_WRITTEN, event_types.SECRET_DELETED, event_types.SECRET_ROTATED].forEach(event => {
            eventSource.on(event, this.handler);
        });

        for (const key in settings) {
            if (key in this.settings) {
                this.settings[key] = settings[key];
            } else {
                throw `Invalid setting passed to TTS Provider: ${key}`;
            }
        }

        $('#elevenlabs_tts_stability').val(this.settings.stability);
        $('#elevenlabs_tts_similarity_boost').val(this.settings.similarity_boost);
        $('#elevenlabs_tts_style_exaggeration').val(this.settings.style_exaggeration);
        $('#elevenlabs_tts_speaker_boost').prop('checked', this.settings.speaker_boost);
        $('#elevenlabs_tts_speed').val(this.settings.speed);
        $('#elevenlabs_tts_model').val(this.settings.model);
        $('#elevenlabs_tts_similarity_boost').on('input', this.onSettingsChange.bind(this));
        $('#elevenlabs_tts_stability').on('input', this.onSettingsChange.bind(this));
        $('#elevenlabs_tts_style_exaggeration').on('input', this.onSettingsChange.bind(this));
        $('#elevenlabs_tts_speaker_boost').on('change', this.onSettingsChange.bind(this));
        $('#elevenlabs_tts_speed').on('input', this.onSettingsChange.bind(this));
        $('#elevenlabs_tts_model').on('change', this.onSettingsChange.bind(this));
        $('#elevenlabs_tts_stability_output').text(Math.round(this.settings.stability * 100) + '%');
        $('#elevenlabs_tts_similarity_boost_output').text(Math.round(this.settings.similarity_boost * 100) + '%');
        $('#elevenlabs_tts_style_exaggeration_output').text(Math.round(this.settings.style_exaggeration * 100) + '%');
        $('#elevenlabs_tts_speed_output').text(this.settings.speed + 'x');
        $('#elevenlabs_tts_v2_options').toggle(this.shouldInvolveExtendedSettings());
        try {
            await this.checkReady();
            console.debug('ElevenLabs: Settings loaded');
        } catch {
            console.debug('ElevenLabs: Settings loaded, but not ready');
        }

        this.setupVoiceCloningMenu();
    }

    // Perform a simple readiness check by trying to fetch voiceIds
    async checkReady() {
        await this.fetchTtsVoiceObjects();
    }

    async onRefreshClick() {
        await this.fetchTtsVoiceObjects();
    }

    setupVoiceCloningMenu() {
        const audioFilesInput = /** @type {HTMLInputElement} */ (document.getElementById('elevenlabs_tts_audio_files'));
        const selectedFilesListElement = document.getElementById('elevenlabs_tts_selected_files_list');
        const cloneVoiceButton = document.getElementById('elevenlabs_tts_clone_voice_button');
        const uploadAudioFileButton = document.getElementById('upload_audio_file');
        const voiceCloningNameInput = /** @type {HTMLInputElement} */ (document.getElementById('elevenlabs_tts_voice_cloning_name'));
        const voiceCloningDescriptionInput = /** @type {HTMLInputElement} */ (document.getElementById('elevenlabs_tts_voice_cloning_description'));
        const voiceCloningLabelsInput = /** @type {HTMLInputElement} */ (document.getElementById('elevenlabs_tts_voice_cloning_labels'));

        const updateCloneVoiceButtonVisibility = () => {
            cloneVoiceButton.style.display = audioFilesInput.files.length > 0 ? 'inline-block' : 'none';
        };

        const clearSelectedFiles = () => {
            audioFilesInput.value = '';
            selectedFilesListElement.innerHTML = '';
            updateCloneVoiceButtonVisibility();
        };

        uploadAudioFileButton.addEventListener('click', () => {
            audioFilesInput.click();
        });

        audioFilesInput.addEventListener('change', () => {
            selectedFilesListElement.innerHTML = '';
            for (const file of audioFilesInput.files) {
                const listItem = document.createElement('div');
                listItem.textContent = file.name;
                selectedFilesListElement.appendChild(listItem);
            }
            updateCloneVoiceButtonVisibility();
        });

        cloneVoiceButton.addEventListener('click', async () => {
            const voiceName = voiceCloningNameInput.value.trim();
            const voiceDescription = voiceCloningDescriptionInput.value.trim();
            const voiceLabels = voiceCloningLabelsInput.value.trim();

            if (!voiceName) {
                toastr.error('Please provide a name for the cloned voice.');
                return;
            }

            try {
                await this.addVoice(voiceName, voiceDescription, voiceLabels);
                toastr.success('Voice cloned successfully. Hit reload to see the new voice in the voice listing.');
                clearSelectedFiles();
                voiceCloningNameInput.value = '';
                voiceCloningDescriptionInput.value = '';
                voiceCloningLabelsInput.value = '';
            } catch (error) {
                toastr.error(`Failed to clone voice: ${error.message}`);
            }
        });

        updateCloneVoiceButtonVisibility();
    }

    /**
     * Get voice object by name
     * @param {string} voiceName Voice name to look up
     * @returns {Promise<Object>} Voice object
     */
    async getVoice(voiceName) {
        if (this.voices.length == 0) {
            this.voices = await this.fetchTtsVoiceObjects();
        }
        const match = this.voices.filter(
            elevenVoice => elevenVoice.name == voiceName,
        )[0];
        if (!match) {
            throw `TTS Voice name ${voiceName} not found in ElevenLabs account`;
        }
        return match;
    }

    /**
     * Generate TTS audio
     * @param {string} text Text to synthesize
     * @param {string} voiceId Voice ID to use for synthesis
     * @returns {Promise<Response>} Response object containing audio data
     */
    async generateTts(text, voiceId) {
        const historyId = await this.findTtsGenerationInHistory(text, voiceId);

        if (historyId) {
            console.debug(`Found existing TTS generation with id ${historyId}`);
            return await this.fetchTtsFromHistory(historyId);
        } else {
            console.debug('No existing TTS generation found, requesting new generation');
            return await this.fetchTtsGeneration(text, voiceId);
        }
    }

    /**
     * Find existing TTS generation in history
     * @param {string} message Message text used for TTS generation
     * @param {string} voiceId Voice ID used for TTS generation
     * @returns {Promise<string>} History item ID if found, empty string otherwise
     */
    async findTtsGenerationInHistory(message, voiceId) {
        const ttsHistory = await this.fetchTtsHistory();
        for (const history of ttsHistory) {
            const text = history.text;
            const itemId = history.history_item_id;
            if (message === text && history.voice_id == voiceId) {
                console.info(`Existing TTS history item ${itemId} found: ${text} `);
                return itemId;
            }
        }
        return '';
    }

    async fetchTtsVoiceObjects() {
        const response = await fetch('/api/speech/elevenlabs/voices', {
            method: 'POST',
            headers: getRequestHeaders({ omitContentType: true }),
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}. See server console for details.`);
        }
        const responseJson = await response.json();
        return responseJson.voices;
    }

    async fetchTtsVoiceSettings() {
        const response = await fetch('/api/speech/elevenlabs/voice-settings', {
            method: 'POST',
            headers: getRequestHeaders({ omitContentType: true }),
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}. See server console for details.`);
        }
        return response.json();
    }

    /**
     * Fetch new TTS generation from ElevenLabs API
     * @param {string} text Text to synthesize
     * @param {string} voiceId Voice ID to use for synthesis
     * @returns {Promise<Response>} Response object containing audio data
     */
    async fetchTtsGeneration(text, voiceId) {
        let model = this.settings.model ?? 'eleven_monolingual_v1';
        console.info(`Generating new TTS for voice_id ${voiceId}, model ${model}`);
        const request = {
            model_id: model,
            text: text,
            voice_settings: {
                stability: Number(this.settings.stability),
                similarity_boost: Number(this.settings.similarity_boost),
                speed: Number(this.settings.speed),
            },
        };
        if (this.shouldInvolveExtendedSettings()) {
            request.voice_settings.style = Number(this.settings.style_exaggeration);
            request.voice_settings.use_speaker_boost = Boolean(this.settings.speaker_boost);
        }
        const response = await fetch('/api/speech/elevenlabs/synthesize', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                voiceId: voiceId,
                request: request,
            }),
        });
        if (!response.ok) {
            toastr.error(response.statusText, 'TTS Generation Failed');
            throw new Error(`HTTP ${response.status}. See server console for details.`);
        }
        return response;
    }

    /**
     * Fetch existing TTS audio from history
     * @param {string} historyItemId History item ID to fetch audio for
     * @returns {Promise<Response>} Response object containing audio data
     */
    async fetchTtsFromHistory(historyItemId) {
        console.info(`Fetched existing TTS with history_item_id ${historyItemId}`);
        const response = await fetch('/api/speech/elevenlabs/history-audio', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                historyItemId: historyItemId,
            }),
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}. See server console for details.`);
        }
        return response;
    }

    /**
     * Fetch TTS generation history
     * @returns {Promise<Array>} Array of TTS history items
     */
    async fetchTtsHistory() {
        const response = await fetch('/api/speech/elevenlabs/history', {
            method: 'POST',
            headers: getRequestHeaders({ omitContentType: true }),
        });
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}. See server console for details.`);
        }
        const responseJson = await response.json();
        return responseJson.history;
    }

    /**
     * Add a new voice via ElevenLabs API
     * @param {string} name Voice name
     * @param {string} description Voice description
     * @param {string} labels Voice labels
     * @returns {Promise<Object>} Newly created voice object
     */
    async addVoice(name, description, labels) {
        const audioFilesInput = /** @type {HTMLInputElement} */ (document.getElementById('elevenlabs_tts_audio_files'));
        if (!(audioFilesInput instanceof HTMLInputElement) || audioFilesInput.files.length === 0) {
            throw new Error('No audio files selected for voice cloning.');
        }

        const data = {
            name: name,
            description: description,
            labels: labels,
            files: [],
        };

        for (const file of audioFilesInput.files) {
            const base64Data = await getBase64Async(file);
            data.files.push(base64Data);
        }

        const response = await fetch('/api/speech/elevenlabs/voices/add', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(data),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}. See server console for details.`);
        }

        return await response.json();
    }
}
