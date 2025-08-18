// chatterbox.js

import { saveTtsProviderSettings } from './index.js';

export { ChatterboxTtsProvider };

class ChatterboxTtsProvider {
    //########//
    // Config //
    //########//

    settings = {};
    constructor() {
        // Initialize with default settings
        this.settings = {
            provider_endpoint: 'http://localhost:8004',
            generation_method: 'standard', // 'streaming' or 'standard'
            temperature: 0.8,
            exaggeration: 0.5,
            cfg_weight: 0.5,
            seed: -1,
            speed_factor: 1.0,
            language: 'en',
            split_text: true,
            chunk_size: 120,
            output_format: 'wav',
            voiceMap: {},
            // Narrator settings
            narrator_enabled: 'true',
            narrator_text_not_inside: 'narrator',
            narrator_voice: 'S1',
        };
    }

    ready = false;
    voices = [];
    separator = '. ';
    audioElement = document.createElement('audio');

    languageLabels = {
        'English': 'en', 'Spanish': 'es', 'French': 'fr', 'German': 'de', 'Italian': 'it',
        'Portuguese': 'pt', 'Polish': 'pl', 'Turkish': 'tr', 'Russian': 'ru', 'Dutch': 'nl',
        'Czech': 'cs', 'Arabic': 'ar', 'Chinese': 'zh-cn', 'Japanese': 'ja', 'Korean': 'ko', 'Hindi': 'hi',
    };

    get settingsHtml() {
        let languageOptions = '';
        for (const [name, code] of Object.entries(this.languageLabels)) {
            languageOptions += `<option value="${code}">${name}</option>`;
        }

        return `
        <div class="chatterbox-settings-container">
            <div class="chatterbox-settings-header">
                <h3>Chatterbox TTS Settings</h3>
                <div class="status-indicator">
                    Status: <span id="chatterbox-status" class="offline">Offline</span>
                </div>
            </div>

            <div class="chatterbox-setting-row">
                <label for="chatterbox-endpoint">Server Endpoint:</label>
                <input id="chatterbox-endpoint" type="text" class="text_pole" value="${this.settings.provider_endpoint}" />
            </div>

            <div class="chatterbox-setting-row">
                <label for="chatterbox-generation-method">Generation Method:</label>
                <select id="chatterbox-generation-method">
                    <option value="streaming">Streaming (Recommended)</option>
                    <option value="standard">Standard / Concatenated (Narrator Mode)</option>
                </select>
            </div>

            <div class="chatterbox-narrator-section">
                <h4>Narrator Settings</h4>
                <div class='chatterbox-setting-row'>
                    <div class='chatterbox-setting-option'>
                        <label for='chatterbox_narrator_enabled'>Narrator Mode</label>
                        <select id='chatterbox_narrator_enabled'>
                            <option value='true'>Enabled</option>
                            <option value='silent'>Enabled (Silenced)</option>
                            <option value='false'>Disabled</option>
                        </select>
                    </div>
                    <div class='chatterbox-setting-option'>
                        <label for='chatterbox_narrator_text_not_inside'>Text Not Inside * or " is</label>
                        <select id='chatterbox_narrator_text_not_inside'>
                            <option value='character'>Character</option>
                            <option value='narrator'>Narrator</option>
                            <option value='silent'>Silent</option>
                        </select>
                    </div>
                </div>
                <div class='chatterbox-setting-row'>
                    <div class='chatterbox-setting-option' style="flex-grow: 2;">
                        <label for='chatterbox_narrator_voice'>Narrator Voice</label>
                        <select id='chatterbox_narrator_voice'>
                            <option value="">-- Load voices --</option>
                        </select>
                    </div>
                </div>
            </div>

            <div class="chatterbox-params-section">
                <h4>Generation Parameters</h4>
                <div class="chatterbox-setting-row">
                    <label for="chatterbox-language">Language:</label>
                    <select id="chatterbox-language">${languageOptions}</select>
                </div>
                <div class="chatterbox-setting-row">
                    <label for="chatterbox-temperature">Temperature: <span id="chatterbox-temperature-value">${this.settings.temperature}</span></label>
                    <input id="chatterbox-temperature" type="range" min="0" max="1" step="0.1" value="${this.settings.temperature}" />
                </div>
                <div class="chatterbox-setting-row">
                    <label for="chatterbox-exaggeration">Exaggeration: <span id="chatterbox-exaggeration-value">${this.settings.exaggeration}</span></label>
                    <input id="chatterbox-exaggeration" type="range" min="0" max="2" step="0.1" value="${this.settings.exaggeration}" />
                </div>
                <div class="chatterbox-setting-row">
                    <label for="chatterbox-cfg-weight">CFG Weight: <span id="chatterbox-cfg-weight-value">${this.settings.cfg_weight}</span></label>
                    <input id="chatterbox-cfg-weight" type="range" min="0" max="1" step="0.1" value="${this.settings.cfg_weight}" />
                </div>
                <div class="chatterbox-setting-row">
                    <label for="chatterbox-speed">Speed Factor: <span id="chatterbox-speed-value">${this.settings.speed_factor}</span></label>
                    <input id="chatterbox-speed" type="range" min="0.5" max="2" step="0.1" value="${this.settings.speed_factor}" />
                </div>
                <div class="chatterbox-setting-row">
                    <label for="chatterbox-seed">Seed (-1 for random):</label>
                    <input id="chatterbox-seed" class="text_pole" type="number" min="-1" value="${this.settings.seed}" />
                </div>
                <div class="chatterbox-setting-row">
                    <label class="checkbox_label">
                        <input type="checkbox" id="chatterbox-split-text" ${this.settings.split_text ? 'checked' : ''} />
                        Split long texts into chunks
                    </label>
                </div>
                <div class="chatterbox-setting-row" id="chunk-size-row" ${!this.settings.split_text ? 'style="display: none;"' : ''}>
                    <label for="chatterbox-chunk-size">Chunk Size:</label>
                    <input id="chatterbox-chunk-size" class="text_pole" type="number" min="50" max="500" value="${this.settings.chunk_size}" />
                </div>
                <div class="chatterbox-setting-row">
                    <label for="chatterbox-format">Output Format:</label>
                    <select id="chatterbox-format">
                        <option value="wav">WAV</option>
                        <option value="opus">Opus</option>
                    </select>
                </div>
            </div>

            <div class="chatterbox-footer">
                <a href="${this.settings.provider_endpoint}" target="_blank">Chatterbox Web UI</a> |
                <a href="https://github.com/devnen/Chatterbox-TTS-Server" target="_blank">Documentation</a>
            </div>
        </div>

        <style>
            .chatterbox-settings-container { padding: 10px; }
            .chatterbox-settings-header { display: flex; justify-content: space-between; align-items: center; margin-bottom: 15px; }
            .chatterbox-settings-header h3 { margin: 0; }
            .chatterbox-settings-container .status-indicator { font-weight: bold; }
            #chatterbox-status.ready { color: #4CAF50; }
            #chatterbox-status.offline { color: #f44336; }
            #chatterbox-status.processing { color: #2196F3; }
            .chatterbox-setting-row { margin-bottom: 10px; display: flex; align-items: center; gap: 10px; }
            .chatterbox-setting-row > label { flex: 0 0 150px; }
            .chatterbox-setting-row label.checkbox_label { flex-basis: auto; }
            .chatterbox-setting-row > input[type="text"], .chatterbox-setting-row > input[type="number"], .chatterbox-setting-row > select { flex: 1; }
            .chatterbox-setting-row input[type="range"] { flex: 1; }
            .chatterbox-narrator-section, .chatterbox-params-section { margin-top: 15px; padding-top: 15px; border-top: 1px solid #ccc; }
            .chatterbox-narrator-section h4, .chatterbox-params-section h4 { margin-top: 0; margin-bottom: 10px; }
            .chatterbox-setting-option { flex: 1; display: flex; flex-direction: column; gap: 5px; }
            .chatterbox-setting-option select { width: 100%; }
            .chatterbox-footer { margin-top: 15px; padding-top: 15px; border-top: 1px solid #ccc; text-align: center; font-size: 0.9em; }
        </style>
        `;
    }

    async loadSettings(settings) {
        this.updateStatus('Offline');
        if (settings && Object.keys(settings).length > 0) {
            Object.assign(this.settings, settings);
        }
        console.debug('ChatterboxTTS: Settings loaded');

        this.updateUIFromSettings();
        this.setupEventListeners();

        try {
            await this.checkReady();
            if (this.ready) {
                await this.fetchTtsVoiceObjects();
                this.updateNarratorUIDisplay();
                this.updateStatus('Ready');
            } else {
                this.updateStatus('Offline');
            }
        } catch (error) {
            console.error('Error loading Chatterbox settings:', error);
            this.updateStatus('Offline');
        }
    }

    updateUIFromSettings() {
        $('#chatterbox-endpoint').val(this.settings.provider_endpoint);
        $('#chatterbox-generation-method').val(this.settings.generation_method);
        $('#chatterbox-language').val(this.settings.language);
        $('#chatterbox-temperature').val(this.settings.temperature);
        $('#chatterbox-temperature-value').text(this.settings.temperature);
        $('#chatterbox-exaggeration').val(this.settings.exaggeration);
        $('#chatterbox-exaggeration-value').text(this.settings.exaggeration);
        $('#chatterbox-cfg-weight').val(this.settings.cfg_weight);
        $('#chatterbox-cfg-weight-value').text(this.settings.cfg_weight);
        $('#chatterbox-speed').val(this.settings.speed_factor);
        $('#chatterbox-speed-value').text(this.settings.speed_factor);
        $('#chatterbox-seed').val(this.settings.seed);
        $('#chatterbox-split-text').prop('checked', this.settings.split_text);
        $('#chatterbox-chunk-size').val(this.settings.chunk_size);
        $('#chatterbox-format').val(this.settings.output_format);
        $('#chunk-size-row').toggle(this.settings.split_text);
        this.updateNarratorUIDisplay();
        this.toggleNarratorSection();
    }

    toggleNarratorSection() {
        const isStreaming = this.settings.generation_method === 'streaming';
        $('.chatterbox-narrator-section').toggle(!isStreaming);
    }

    updateNarratorUIDisplay() {
        const narratorVoiceSelect = $('#chatterbox_narrator_voice');
        if (narratorVoiceSelect.length) {
            const currentVal = this.settings.narrator_voice;
            narratorVoiceSelect.empty();
            if (this.voices.length > 0) {
                this.voices.forEach(voice => narratorVoiceSelect.append($('<option>', { value: voice.voice_id, text: voice.name })));
                narratorVoiceSelect.val(currentVal);
            } else {
                narratorVoiceSelect.append($('<option>', { value: '', text: '-- Connect to server --' }));
            }
        }
        $('#chatterbox_narrator_enabled').val(this.settings.narrator_enabled);
        $('#chatterbox_narrator_text_not_inside').val(this.settings.narrator_text_not_inside);
        const isNarratorDisabled = this.settings.narrator_enabled === 'false';
        $('#chatterbox_narrator_text_not_inside').prop('disabled', isNarratorDisabled);
        $('#chatterbox_narrator_voice').prop('disabled', isNarratorDisabled);
    }

    async checkReady() {
        try {
            const response = await fetch(this.settings.provider_endpoint);
            if (!response.ok) throw new Error(`HTTP Error: ${response.status} ${response.statusText}`);
            this.ready = true;
            console.log('Chatterbox TTS service is ready.');
        } catch (error) {
            console.error('Error checking Chatterbox TTS service readiness:', error.message);
            this.ready = false;
        }
    }

    async fetchTtsVoiceObjects() {
        try {
            const predefinedResponse = await fetch(`${this.settings.provider_endpoint}/get_predefined_voices`);
            if (!predefinedResponse.ok) throw new Error(`Failed to fetch predefined voices: ${predefinedResponse.statusText}`);
            const predefinedVoices = (await predefinedResponse.json()).map(v => ({ name: v.display_name, voice_id: v.voice_id || v.filename, lang: v.language || 'en' }));
            let referenceVoices = [];
            try {
                const refResponse = await fetch(`${this.settings.provider_endpoint}/get_reference_files`);
                if (refResponse.ok) {
                    referenceVoices = (await refResponse.json()).map(f => ({ name: `[Clone] ${f}`, voice_id: `ref_${f}`, lang: 'en' }));
                }
            } catch (error) { console.warn('Failed to fetch reference voices:', error); }
            this.voices = [...predefinedVoices, ...referenceVoices];
            console.log(`Loaded ${this.voices.length} Chatterbox voices`);
            return this.voices;
        } catch (error) {
            console.error('Error fetching Chatterbox voices:', error);
            this.voices = [];
            return [];
        }
    }

    setupEventListeners() {
        $('#chatterbox-endpoint').on('input', () => { this.settings.provider_endpoint = $('#chatterbox-endpoint').val(); this.onSettingsChange(); });
        $('#chatterbox-generation-method').on('change', (e) => {
            this.settings.generation_method = e.target.value;
            this.toggleNarratorSection();
            this.onSettingsChange();
        });
        $('#chatterbox-language').on('change', (e) => { this.settings.language = e.target.value; this.onSettingsChange(); });
        $('#chatterbox-temperature').on('input', (e) => { this.settings.temperature = parseFloat(e.target.value); $('#chatterbox-temperature-value').text(this.settings.temperature); this.onSettingsChange(); });
        $('#chatterbox-exaggeration').on('input', (e) => { this.settings.exaggeration = parseFloat(e.target.value); $('#chatterbox-exaggeration-value').text(this.settings.exaggeration); this.onSettingsChange(); });
        $('#chatterbox-cfg-weight').on('input', (e) => { this.settings.cfg_weight = parseFloat(e.target.value); $('#chatterbox-cfg-weight-value').text(this.settings.cfg_weight); this.onSettingsChange(); });
        $('#chatterbox-speed').on('input', (e) => { this.settings.speed_factor = parseFloat(e.target.value); $('#chatterbox-speed-value').text(this.settings.speed_factor); this.onSettingsChange(); });
        $('#chatterbox-seed').on('change', (e) => { this.settings.seed = parseInt(e.target.value, 10); this.onSettingsChange(); });
        $('#chatterbox-split-text').on('change', (e) => { this.settings.split_text = e.target.checked; $('#chunk-size-row').toggle(e.target.checked); this.onSettingsChange(); });
        $('#chatterbox-chunk-size').on('change', (e) => { this.settings.chunk_size = parseInt(e.target.value, 10); this.onSettingsChange(); });
        $('#chatterbox-format').on('change', (e) => { this.settings.output_format = e.target.value; this.onSettingsChange(); });
        $('#chatterbox_narrator_enabled').on('change', (e) => {
            this.settings.narrator_enabled = e.target.value;
            this.updateNarratorUIDisplay();
            const ttsPassAsterisksCheckbox = $('#tts_pass_asterisks');
            if (this.settings.narrator_enabled !== 'false' && ttsPassAsterisksCheckbox.prop('checked')) ttsPassAsterisksCheckbox.click();
            else if (this.settings.narrator_enabled === 'false' && !ttsPassAsterisksCheckbox.prop('checked')) ttsPassAsterisksCheckbox.click();
            this.onSettingsChange();
        });
        $('#chatterbox_narrator_text_not_inside').on('change', (e) => { this.settings.narrator_text_not_inside = e.target.value; this.onSettingsChange(); });
        $('#chatterbox_narrator_voice').on('change', (e) => { this.settings.narrator_voice = e.target.value; this.onSettingsChange(); });
    }

    onSettingsChange() { saveTtsProviderSettings(); }

    async onRefreshClick() {
        try {
            this.updateStatus('Processing');
            await this.checkReady();
            if (this.ready) {
                await this.fetchTtsVoiceObjects();
                this.updateNarratorUIDisplay();
                this.updateStatus('Ready');
            } else {
                this.updateStatus('Offline');
            }
        } catch (error) {
            console.error('Error during refresh:', error);
            this.updateStatus('Offline');
        }
    }

    async previewTtsVoice(voiceId) {
        try {
            this.updateStatus('Processing');
            const audioBlob = await this._fetchSingleTts('Hello! This is a preview of the selected voice.', voiceId);
            const audioUrl = URL.createObjectURL(audioBlob);
            const audio = new Audio(audioUrl);
            audio.addEventListener('ended', () => { URL.revokeObjectURL(audioUrl); this.updateStatus('Ready'); });
            await audio.play();
        } catch (error) {
            console.error('Error previewing voice:', error);
            this.updateStatus('Ready');
            throw error;
        }
    }

    async getVoice(voiceName) {
        if (!this.voices || this.voices.length === 0) await this.fetchTtsVoiceObjects();
        const match = this.voices.find(v => v.name === voiceName || v.voice_id === voiceName);
        return match || { name: voiceName || 'Default', voice_id: voiceName || 'S1' };
    }

    async _fetchSingleTts(inputText, voiceId) {
        if (!inputText || !inputText.trim()) return null;
        const isReferenceVoice = voiceId && voiceId.startsWith('ref_');
        const actualVoiceId = isReferenceVoice ? voiceId.substring(4) : voiceId;
        const requestBody = {
            text: inputText,
            voice_mode: isReferenceVoice ? 'clone' : 'predefined',
            temperature: this.settings.temperature,
            exaggeration: this.settings.exaggeration,
            cfg_weight: this.settings.cfg_weight,
            seed: this.settings.seed >= 0 ? this.settings.seed : Math.floor(Math.random() * 2147483648),
            speed_factor: this.settings.speed_factor,
            language: this.settings.language,
            split_text: this.settings.split_text,
            chunk_size: this.settings.chunk_size,
            output_format: this.settings.output_format,
        };
        if (isReferenceVoice) requestBody.reference_audio_filename = actualVoiceId;
        else requestBody.predefined_voice_id = actualVoiceId || 'S1';
        const response = await fetch(`${this.settings.provider_endpoint}/tts`, {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', 'Cache-Control': 'no-cache' },
            body: JSON.stringify(requestBody),
        });
        if (!response.ok) throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        return response.blob();
    }

    /**
     * Concatenates multiple audio blobs into a single valid audio blob using the Web Audio API.
     * @param {Blob[]} audioBlobs - An array of audio blobs to concatenate.
     * @returns {Promise<Blob>} A promise that resolves with the combined audio blob.
     */
    async _concatAudioBlobs(audioBlobs) {
        const audioContext = new (window.AudioContext || window.webkitAudioContext)();
        const decodedBuffers = await Promise.all(
            audioBlobs.map(blob => blob.arrayBuffer().then(buffer => audioContext.decodeAudioData(buffer)))
        );

        const totalLength = decodedBuffers.reduce((acc, buffer) => acc + buffer.length, 0);
        const sampleRate = decodedBuffers[0].sampleRate;
        const numberOfChannels = decodedBuffers[0].numberOfChannels;

        const combinedBuffer = audioContext.createBuffer(numberOfChannels, totalLength, sampleRate);

        let offset = 0;
        for (const buffer of decodedBuffers) {
            for (let channel = 0; channel < numberOfChannels; channel++) {
                combinedBuffer.getChannelData(channel).set(buffer.getChannelData(channel), offset);
            }
            offset += buffer.length;
        }

        // This is a simplified WAV encoder. It should work for most cases.
        const writeString = (view, offset, string) => {
            for (let i = 0; i < string.length; i++) {
                view.setUint8(offset + i, string.charCodeAt(i));
            }
        };

        const buffer = new ArrayBuffer(44 + combinedBuffer.length * 2);
        const view = new DataView(buffer);
        const pcmData = combinedBuffer.getChannelData(0);

        writeString(view, 0, 'RIFF');
        view.setUint32(4, 36 + pcmData.length * 2, true);
        writeString(view, 8, 'WAVE');
        writeString(view, 12, 'fmt ');
        view.setUint32(16, 16, true);
        view.setUint16(20, 1, true);
        view.setUint16(22, numberOfChannels, true);
        view.setUint32(24, sampleRate, true);
        view.setUint32(28, sampleRate * 2 * numberOfChannels, true);
        view.setUint16(32, 2 * numberOfChannels, true);
        view.setUint16(34, 16, true);
        writeString(view, 36, 'data');
        view.setUint32(40, pcmData.length * 2, true);

        let byteOffset = 44;
        for (let i = 0; i < pcmData.length; i++, byteOffset += 2) {
            const s = Math.max(-1, Math.min(1, pcmData[i]));
            view.setInt16(byteOffset, s < 0 ? s * 0x8000 : s * 0x7FFF, true);
        }

        return new Blob([view], { type: 'audio/wav' });
    }

    async generateTts(inputText, voiceId) {
        try {
            this.updateStatus('Processing');

            if (this.settings.generation_method === 'streaming') {
                const isReferenceVoice = voiceId && voiceId.startsWith('ref_');
                const actualVoiceId = isReferenceVoice ? voiceId.substring(4) : voiceId;
                const params = new URLSearchParams({
                    text: inputText,
                    voice_mode: isReferenceVoice ? 'clone' : 'predefined',
                    temperature: this.settings.temperature,
                    exaggeration: this.settings.exaggeration,
                    cfg_weight: this.settings.cfg_weight,
                    seed: this.settings.seed >= 0 ? this.settings.seed : -1,
                    speed_factor: this.settings.speed_factor,
                    language: this.settings.language,
                    output_format: this.settings.output_format,
                });
                if (isReferenceVoice) params.append('reference_audio_filename', actualVoiceId);
                else params.append('predefined_voice_id', actualVoiceId || 'S1');
                const streamingUrl = `${this.settings.provider_endpoint}/tts-stream?${params.toString()}`;
                this.updateStatus('Ready');
                return streamingUrl;
            }

            if (this.settings.narrator_enabled === 'false') {
                const blob = await this._fetchSingleTts(inputText, voiceId);
                this.updateStatus('Ready');
                return new Response(blob, { headers: { 'Content-Type': blob.type } });
            }

            const segments = inputText.split(/(["*].*?["*])/g).filter(s => s && s.trim());
            const audioBlobs = [];
            for (const segment of segments) {
                const isQuotedDialogue = segment.startsWith('"') && segment.endsWith('"');
                const isAsteriskNarration = segment.startsWith('*') && segment.endsWith('*');
                let textToSpeak, voiceForSegment, isNarratorSegment = false;

                if (isQuotedDialogue) {
                    textToSpeak = segment.slice(1, -1); voiceForSegment = voiceId;
                } else if (isAsteriskNarration) {
                    textToSpeak = segment.slice(1, -1); voiceForSegment = this.settings.narrator_voice; isNarratorSegment = true;
                } else {
                    textToSpeak = segment;
                    switch (this.settings.narrator_text_not_inside) {
                        case 'narrator': voiceForSegment = this.settings.narrator_voice; isNarratorSegment = true; break;
                        case 'character': voiceForSegment = voiceId; break;
                        case 'silent': continue;
                    }
                }
                if (this.settings.narrator_enabled === 'silent' && isNarratorSegment) continue;
                const blob = await this._fetchSingleTts(textToSpeak, voiceForSegment);
                if (blob) audioBlobs.push(blob);
            }

            if (audioBlobs.length === 0) {
                this.updateStatus('Ready');
                return new Response(new Blob([], { type: `audio/${this.settings.output_format}` }));
            }
            if (audioBlobs.length === 1) {
                this.updateStatus('Ready');
                return new Response(audioBlobs[0], { headers: { 'Content-Type': audioBlobs[0].type } });
            }

            // Use the Web Audio API to correctly concatenate the blobs.
            const combinedBlob = await this._concatAudioBlobs(audioBlobs);
            this.updateStatus('Ready');
            return new Response(combinedBlob, { headers: { 'Content-Type': combinedBlob.type } });

        } catch (error) {
            console.error('Error in generateTts:', error);
            this.updateStatus('Ready');
            throw error;
        }
    }

    updateStatus(status) {
        const statusElement = document.getElementById('chatterbox-status');
        if (statusElement) {
            statusElement.textContent = status;
            statusElement.className = status.toLowerCase();
        }
    }
}