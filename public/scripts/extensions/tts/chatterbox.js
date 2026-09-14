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
            provider_endpoint: this.settings.provider_endpoint || 'http://localhost:8004',
            voice_mode: this.settings.voice_mode || 'predefined',
            predefined_voice: this.settings.predefined_voice || 'S1',
            reference_voice: this.settings.reference_voice || '',
            temperature: this.settings.temperature || 0.8,
            exaggeration: this.settings.exaggeration || 0.5,
            cfg_weight: this.settings.cfg_weight || 0.5,
            seed: this.settings.seed || -1,
            speed_factor: this.settings.speed_factor || 1.0,
            language: this.settings.language || 'en',
            split_text: this.settings.split_text || true,
            chunk_size: this.settings.chunk_size || 120,
            output_format: this.settings.output_format || 'wav',
            streaming: this.settings.streaming || false,
            voiceMap: this.settings.voiceMap || {},
        };
    }

    ready = false;
    voices = [];
    separator = '. ';
    audioElement = document.createElement('audio');
    audioContext = null;
    audioWorkletNode = null;
    scriptNode = null;
    useWorklet = false;
    sampleChunks = [];
    chunkPos = 0;
    pendingBytes = new Uint8Array(0);
    currentVolume = 1.0;
    abortController = null;

    languageLabels = {
        'English': 'en',
        'Spanish': 'es',
        'French': 'fr',
        'German': 'de',
        'Italian': 'it',
        'Portuguese': 'pt',
        'Polish': 'pl',
        'Turkish': 'tr',
        'Russian': 'ru',
        'Dutch': 'nl',
        'Czech': 'cs',
        'Arabic': 'ar',
        'Chinese': 'zh-cn',
        'Japanese': 'ja',
        'Korean': 'ko',
        'Hindi': 'hi',
    };

    get settingsHtml() {
        let html = `<div class="chatterbox-settings-container">
            <div class="chatterbox-settings-header">
                <h3>Chatterbox TTS Settings</h3>
                <div class="status-indicator">
                    Status: <span id="chatterbox-status" class="offline">Offline</span>
                </div>
            </div>`;

        // Server endpoint
        html += `<div class="chatterbox-setting-row">
            <label for="chatterbox-endpoint">Server Endpoint:</label>
            <input id="chatterbox-endpoint" type="text" class="text_pole" value="${this.settings.provider_endpoint}" />
        </div>`;

        // Language selection
        html += `<div class="chatterbox-setting-row">
            <label for="chatterbox-language">Language:</label>
            <select id="chatterbox-language">`;
        for (let language in this.languageLabels) {
            html += `<option value="${this.languageLabels[language]}" ${this.languageLabels[language] === this.settings.language ? 'selected' : ''}>${language}</option>`;
        }
        html += `</select>
        </div>`;

        // Generation parameters
        html += `<div class="chatterbox-params-section">
            <h4>Generation Parameters</h4>`;

        // Temperature
        html += `<div class="chatterbox-setting-row">
            <label for="chatterbox-temperature">Temperature: <span id="chatterbox-temperature-value">${this.settings.temperature}</span></label>
            <input id="chatterbox-temperature" type="range" min="0" max="1" step="0.1" value="${this.settings.temperature}" />
        </div>`;

        // Exaggeration
        html += `<div class="chatterbox-setting-row">
            <label for="chatterbox-exaggeration">Exaggeration: <span id="chatterbox-exaggeration-value">${this.settings.exaggeration}</span></label>
            <input id="chatterbox-exaggeration" type="range" min="0" max="2" step="0.1" value="${this.settings.exaggeration}" />
        </div>`;

        // CFG Weight
        html += `<div class="chatterbox-setting-row">
            <label for="chatterbox-cfg-weight">CFG Weight: <span id="chatterbox-cfg-weight-value">${this.settings.cfg_weight}</span></label>
            <input id="chatterbox-cfg-weight" type="range" min="0" max="1" step="0.1" value="${this.settings.cfg_weight}" />
        </div>`;

        // Speed Factor
        html += `<div class="chatterbox-setting-row">
            <label for="chatterbox-speed">Speed Factor: <span id="chatterbox-speed-value">${this.settings.speed_factor}</span></label>
            <input id="chatterbox-speed" type="range" min="0.5" max="2" step="0.1" value="${this.settings.speed_factor}" />
        </div>`;

        // Seed
        html += `<div class="chatterbox-setting-row">
            <label for="chatterbox-seed">Seed (-1 for random):</label>
            <input id="chatterbox-seed" class="text_pole" type="number" min="-1" value="${this.settings.seed}" />
        </div>`;

        // Text chunking
        html += `<div class="chatterbox-setting-row">
            <label class="checkbox_label">
                <input type="checkbox" id="chatterbox-split-text" ${this.settings.split_text ? 'checked' : ''} />
                Split long texts into chunks
            </label>
        </div>`;

        // Chunk size
        html += `<div class="chatterbox-setting-row" id="chunk-size-row" ${!this.settings.split_text ? 'style="display: none;"' : ''}>
            <label for="chatterbox-chunk-size">Chunk Size:</label>
            <input id="chatterbox-chunk-size" class="text_pole" type="number" min="50" max="500" value="${this.settings.chunk_size}" />
        </div>`;

        // Output format
        html += `<div class="chatterbox-setting-row">
            <label for="chatterbox-format">Output Format:</label>
            <select id="chatterbox-format">
                <option value="wav" ${this.settings.output_format === 'wav' ? 'selected' : ''}>WAV</option>
                <option value="opus" ${this.settings.output_format === 'opus' ? 'selected' : ''}>Opus</option>
            </select>
        </div>`;

        // Streaming
        html += `<div class="chatterbox-setting-row">
            <label class="checkbox_label">
                <input type="checkbox" id="chatterbox-streaming" ${this.settings.streaming ? 'checked' : ''} />
                Streaming <small>(plays audio as it is generated; always WAV. Requires server v2.0.0+)</small>
            </label>
        </div>`;

        html += '</div>'; // End params section

        // Footer with links
        html += `<div class="chatterbox-footer">
            <a href="${this.settings.provider_endpoint}" target="_blank">Chatterbox Web UI</a> |
            <a href="https://github.com/devnen/Chatterbox-TTS-Server" target="_blank">Documentation</a>
        </div>`;

        html += '</div>'; // End container

        // Add CSS styles
        html += `<style>
            .chatterbox-settings-container {
                padding: 10px;
            }
            .chatterbox-settings-header {
                display: flex;
                justify-content: space-between;
                align-items: center;
                margin-bottom: 15px;
            }
            .chatterbox-settings-header h3 {
                margin: 0;
            }
            .chatterbox-settings-container .status-indicator {
                font-weight: bold;
            }
            #chatterbox-status.ready { color: #4CAF50; }
            #chatterbox-status.offline { color: #f44336; }
            #chatterbox-status.processing { color: #2196F3; }
            .chatterbox-setting-row {
                margin-bottom: 10px;
                display: flex;
                align-items: center;
                gap: 10px;
            }
            .chatterbox-setting-row label {
                flex: 0 0 150px;
            }
            .chatterbox-setting-row label.checkbox_label {
                flex-basis: auto;
            }
            .chatterbox-setting-row input[type="text"],
            .chatterbox-setting-row input[type="number"],
            .chatterbox-setting-row select {
                flex: 1;
            }
            .chatterbox-setting-row input[type="range"] {
                flex: 1;
            }
            .chatterbox-params-section {
                margin-top: 15px;
                padding-top: 15px;
                border-top: 1px solid #ccc;
            }
            .chatterbox-params-section h4 {
                margin-top: 0;
                margin-bottom: 10px;
            }
            .chatterbox-footer {
                margin-top: 15px;
                padding-top: 15px;
                border-top: 1px solid #ccc;
                text-align: center;
                font-size: 0.9em;
            }
        </style>`;

        return html;
    }

    //######################//
    // Startup & Initialize //
    //######################//

    async loadSettings(settings) {
        this.updateStatus('Offline');

        if (Object.keys(settings).length === 0) {
            console.info('Using default Chatterbox TTS Provider settings');
        } else {
            // Populate settings with provided values
            for (const key in settings) {
                if (key in this.settings) {
                    this.settings[key] = settings[key];
                }
            }
        }

        // Update UI elements
        this.updateUIFromSettings();

        console.debug('ChatterboxTTS: Settings loaded');

        try {
            // Check if TTS provider is ready
            await this.checkReady();

            if (this.ready) {
                // Fetch all voice types for the voice map
                await this.fetchTtsVoiceObjects();
                this.updateStatus('Ready');
            }

            this.setupEventListeners();
        } catch (error) {
            console.error('Error loading Chatterbox settings:', error);
            this.updateStatus('Offline');
        }
    }

    updateUIFromSettings() {
        $('#chatterbox-endpoint').val(this.settings.provider_endpoint);
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
        $('#chatterbox-streaming').prop('checked', this.settings.streaming);

        // Show/hide chunk size based on split text
        if (this.settings.split_text) {
            $('#chunk-size-row').show();
        } else {
            $('#chunk-size-row').hide();
        }
    }

    //##############################//
    // Check Server is Available    //
    //##############################//

    async checkReady() {
        try {
            const response = await fetch(`${this.settings.provider_endpoint}/api/ui/initial-data`);

            if (!response.ok) {
                throw new Error(`HTTP Error Response: ${response.status} ${response.statusText}`);
            }

            const data = await response.json();

            // Check if we got valid data
            if (data) {
                this.ready = true;
                console.log('Chatterbox TTS service is ready.');
            } else {
                this.ready = false;
                console.log('Chatterbox TTS service returned invalid data.');
            }
        } catch (error) {
            console.error('Error checking Chatterbox TTS service readiness:', error);
            this.ready = false;
        }
    }

    //######################//
    // Get Available Voices //
    //######################//

    async fetchTtsVoiceObjects() {
        try {
            // Always fetch predefined voices
            const predefinedResponse = await fetch(`${this.settings.provider_endpoint}/get_predefined_voices`);
            if (!predefinedResponse.ok) {
                throw new Error(`HTTP ${predefinedResponse.status}: ${predefinedResponse.statusText}`);
            }

            const predefinedData = await predefinedResponse.json();

            // Transform predefined voices
            const predefinedVoices = predefinedData.map(voice => ({
                name: voice.display_name,
                voice_id: voice.voice_id || voice.filename,
                preview_url: null,
                lang: voice.language || 'en',
            }));

            // Always try to fetch reference voices
            let referenceVoices = [];
            try {
                const refResponse = await fetch(`${this.settings.provider_endpoint}/get_reference_files`);
                if (refResponse.ok) {
                    const refData = await refResponse.json();
                    referenceVoices = refData.map(filename => ({
                        name: `[Clone] ${filename}`,
                        voice_id: `ref_${filename}`,
                        preview_url: null,
                        lang: 'en',
                    }));
                }
            } catch (error) {
                console.warn('Failed to fetch reference voices:', error);
            }

            // Combine all voices
            this.voices = [...predefinedVoices, ...referenceVoices];

            console.log(`Loaded ${this.voices.length} voices (${predefinedVoices.length} predefined, ${referenceVoices.length} reference)`);
            return this.voices;
        } catch (error) {
            console.error('Error fetching Chatterbox voices:', error);
            this.voices = [];
            return [];
        }
    }

    // Alias for internal use
    async fetchVoices() {
        return this.fetchTtsVoiceObjects();
    }

    //###########################//
    // Setup Event Listeners     //
    //###########################//

    setupEventListeners() {
        // Server endpoint change
        $('#chatterbox-endpoint').on('input', () => {
            this.settings.provider_endpoint = $('#chatterbox-endpoint').val();
            this.onSettingsChange();
        });

        // Language
        $('#chatterbox-language').on('change', (e) => {
            this.settings.language = e.target.value;
            this.onSettingsChange();
        });

        // Parameter sliders
        $('#chatterbox-temperature').on('input', (e) => {
            this.settings.temperature = parseFloat(e.target.value);
            $('#chatterbox-temperature-value').text(this.settings.temperature);
            this.onSettingsChange();
        });

        $('#chatterbox-exaggeration').on('input', (e) => {
            this.settings.exaggeration = parseFloat(e.target.value);
            $('#chatterbox-exaggeration-value').text(this.settings.exaggeration);
            this.onSettingsChange();
        });

        $('#chatterbox-cfg-weight').on('input', (e) => {
            this.settings.cfg_weight = parseFloat(e.target.value);
            $('#chatterbox-cfg-weight-value').text(this.settings.cfg_weight);
            this.onSettingsChange();
        });

        $('#chatterbox-speed').on('input', (e) => {
            this.settings.speed_factor = parseFloat(e.target.value);
            $('#chatterbox-speed-value').text(this.settings.speed_factor);
            this.onSettingsChange();
        });

        // Seed
        $('#chatterbox-seed').on('change', (e) => {
            this.settings.seed = parseInt(e.target.value);
            this.onSettingsChange();
        });

        // Text splitting
        $('#chatterbox-split-text').on('change', (e) => {
            this.settings.split_text = e.target.checked;
            if (e.target.checked) {
                $('#chunk-size-row').show();
            } else {
                $('#chunk-size-row').hide();
            }
            this.onSettingsChange();
        });

        $('#chatterbox-chunk-size').on('change', (e) => {
            this.settings.chunk_size = parseInt(e.target.value);
            this.onSettingsChange();
        });

        // Output format
        $('#chatterbox-format').on('change', (e) => {
            this.settings.output_format = e.target.value;
            this.onSettingsChange();
        });

        // Streaming
        $('#chatterbox-streaming').on('change', (e) => {
            this.settings.streaming = e.target.checked;
            this.onSettingsChange();
        });
    }

    //#############################//
    // Store ST interface settings //
    //#############################//

    onSettingsChange() {
        // Save the updated settings
        saveTtsProviderSettings();
    }

    //#########################//
    // Handle Reload button    //
    //#########################//

    async onRefreshClick() {
        try {
            this.updateStatus('Processing');
            await this.checkReady();

            if (this.ready) {
                await this.fetchTtsVoiceObjects();
                this.updateStatus('Ready');
            } else {
                this.updateStatus('Offline');
            }
        } catch (error) {
            console.error('Error during refresh:', error);
            this.updateStatus('Offline');
        }
    }

    //##################//
    // Preview Voice    //
    //##################//

    async previewTtsVoice(voiceId) {
        try {
            this.updateStatus('Processing');

            const previewText = 'Hello! This is a preview of the selected voice.';

            // Determine if this is a reference voice
            let isReferenceVoice = false;
            let actualVoiceId = voiceId;

            if (voiceId && voiceId.startsWith('ref_')) {
                isReferenceVoice = true;
                actualVoiceId = voiceId.substring(4); // Remove 'ref_' prefix
            }

            // Generate preview using the main TTS endpoint
            const requestBody = {
                text: previewText,
                voice_mode: isReferenceVoice ? 'clone' : 'predefined',
                temperature: this.settings.temperature,
                exaggeration: this.settings.exaggeration,
                cfg_weight: this.settings.cfg_weight,
                seed: this.settings.seed >= 0 ? this.settings.seed : Math.floor(Math.random() * 2147483648), // Use random seed if -1
                speed_factor: this.settings.speed_factor,
                language: this.settings.language,
                split_text: false, // Don't split for preview
                output_format: this.settings.streaming ? 'wav' : this.settings.output_format,
                stream: this.settings.streaming,
            };

            // Add voice-specific parameters
            if (isReferenceVoice) {
                requestBody.reference_audio_filename = actualVoiceId;
            } else {
                requestBody.predefined_voice_id = actualVoiceId;
            }

            this.abortController = new AbortController();

            const response = await fetch(`${this.settings.provider_endpoint}/tts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                },
                body: JSON.stringify(requestBody),
                signal: this.abortController.signal,
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }

            // Stream the preview in real-time when streaming is enabled
            if (this.settings.streaming) {
                await this.processStreamingAudio(response);
                this.updateStatus('Ready');
                return;
            }

            // Get the audio blob and play it
            const audioBlob = await response.blob();
            const audioUrl = URL.createObjectURL(audioBlob);

            const audio = new Audio(audioUrl);
            audio.addEventListener('ended', () => {
                URL.revokeObjectURL(audioUrl);
                this.updateStatus('Ready');
            });

            await audio.play();
        } catch (error) {
            this.updateStatus('Ready');
            if (error?.name === 'AbortError') {
                console.info('Chatterbox TTS preview cancelled.');
                return;
            }
            console.error('Error previewing voice:', error);
            throw error;
        } finally {
            this.abortController = null;
        }
    }

    //#####################//
    // Get Voice Object    //
    //#####################//

    async getVoice(voiceName) {
        // Ensure voices are loaded
        if (this.voices.length === 0) {
            await this.fetchTtsVoiceObjects();
        }

        // Find the voice object by name or voice_id
        let match = this.voices.find(voice =>
            voice.name === voiceName ||
            voice.voice_id === voiceName ||
            voice.display_name === voiceName,
        );

        if (!match) {
            console.warn(`Voice not found: ${voiceName}`);
            // Check if it's a reference voice that wasn't in the list
            if (voiceName && voiceName.startsWith('ref_')) {
                const filename = voiceName.substring(4);
                return {
                    name: `[Clone] ${filename}`,
                    voice_id: voiceName,
                    preview_url: null,
                    lang: 'en',
                };
            }
            // Return a default voice object
            return {
                name: voiceName || 'Default',
                voice_id: voiceName || this.settings.predefined_voice || 'S1',
                preview_url: null,
                lang: 'en',
            };
        }

        return match;
    }

    //##################//
    // Generate TTS     //
    //##################//

    async generateTts(inputText, voiceId) {
        try {
            this.updateStatus('Processing');

            // Determine if this is a reference voice
            let isReferenceVoice = false;
            let actualVoiceId = voiceId;

            if (voiceId && voiceId.startsWith('ref_')) {
                isReferenceVoice = true;
                actualVoiceId = voiceId.substring(4); // Remove 'ref_' prefix
            }

            // Prepare the request body
            const requestBody = {
                text: inputText,
                voice_mode: isReferenceVoice ? 'clone' : 'predefined',
                temperature: this.settings.temperature,
                exaggeration: this.settings.exaggeration,
                cfg_weight: this.settings.cfg_weight,
                seed: this.settings.seed >= 0 ? this.settings.seed : Math.floor(Math.random() * 2147483648), // Use random seed if -1
                speed_factor: this.settings.speed_factor,
                language: this.settings.language,
                split_text: this.settings.split_text,
                chunk_size: this.settings.chunk_size,
                // The server ignores output_format when streaming (always WAV).
                output_format: this.settings.streaming ? 'wav' : this.settings.output_format,
                stream: this.settings.streaming,
            };

            // Add voice-specific parameters
            if (isReferenceVoice) {
                requestBody.reference_audio_filename = actualVoiceId;
            } else {
                requestBody.predefined_voice_id = actualVoiceId || this.settings.predefined_voice;
            }

            console.log('Generating TTS with params:', requestBody);

            // Track this request so it can be cancelled via stop() (e.g. the TTS stop button).
            // Aborting disconnects the HTTP stream, which cancels server-side generation.
            this.abortController = new AbortController();

            const response = await fetch(`${this.settings.provider_endpoint}/tts`, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Cache-Control': 'no-cache',
                },
                body: JSON.stringify(requestBody),
                signal: this.abortController.signal,
            });

            if (!response.ok) {
                const errorText = await response.text();
                console.error('TTS generation error:', errorText);
                throw new Error(`HTTP ${response.status}: ${errorText}`);
            }

            // When streaming, play the audio in real-time via the AudioWorklet and
            // return an empty string so the framework skips its own playback queue.
            if (this.settings.streaming) {
                await this.processStreamingAudio(response);
                this.updateStatus('Ready');
                return '';
            }

            this.updateStatus('Ready');

            // Return the response directly - SillyTavern expects a Response object
            return response;
        } catch (error) {
            this.updateStatus('Ready');
            // A user-initiated stop aborts the request; treat it as a clean cancellation.
            if (error?.name === 'AbortError') {
                console.info('Chatterbox TTS generation cancelled.');
                return '';
            }
            console.error('Error in generateTts:', error);
            throw error;
        } finally {
            this.abortController = null;
        }
    }

    //######################//
    // Streaming Playback   //
    //######################//

    async initStreamingPlayer(sampleRate) {
        // Tear down any previous streaming session to avoid leaking AudioContexts
        this.teardownStreamingPlayer();

        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate });

        // AudioWorklet is only available in secure contexts (HTTPS / localhost).
        // When SillyTavern is served over plain HTTP (e.g. a LAN IP), it is
        // undefined, so we fall back to a ScriptProcessorNode which works there.
        if (this.audioContext.audioWorklet) {
            try {
                const processorUrl = './scripts/extensions/tts/lib/pcm-processor.js';
                await this.audioContext.audioWorklet.addModule(processorUrl);
                this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor');
                this.audioWorkletNode.connect(this.audioContext.destination);
                this.audioWorkletNode.port.postMessage({ volume: this.currentVolume });
                this.useWorklet = true;
                return;
            } catch (error) {
                console.warn('Chatterbox: AudioWorklet init failed, falling back to ScriptProcessorNode:', error);
                this.audioWorkletNode = null;
            }
        } else {
            console.warn('Chatterbox: AudioWorklet unavailable (insecure context). Using ScriptProcessorNode fallback for streaming.');
        }

        this.useWorklet = false;
        this.initScriptProcessor();
    }

    initScriptProcessor() {
        // Queue of decoded Float32 sample chunks awaiting playback
        this.sampleChunks = [];
        this.chunkPos = 0;
        this.pendingBytes = new Uint8Array(0);

        const bufferSize = 4096;
        this.scriptNode = this.audioContext.createScriptProcessor(bufferSize, 0, 1);
        this.scriptNode.onaudioprocess = (event) => {
            const output = event.outputBuffer.getChannelData(0);
            for (let i = 0; i < output.length; i++) {
                // Drop fully-consumed chunks
                while (this.sampleChunks.length > 0 && this.chunkPos >= this.sampleChunks[0].length) {
                    this.sampleChunks.shift();
                    this.chunkPos = 0;
                }
                if (this.sampleChunks.length > 0) {
                    output[i] = this.sampleChunks[0][this.chunkPos++] * this.currentVolume;
                } else {
                    output[i] = 0;
                }
            }
        };
        this.scriptNode.connect(this.audioContext.destination);
    }

    pushPcm(bytes) {
        if (this.useWorklet) {
            this.audioWorkletNode.port.postMessage({ pcmData: bytes });
            return;
        }

        // ScriptProcessor fallback: decode 16-bit PCM to Float32 on the main thread.
        const newData = bytes instanceof Uint8Array ? bytes : new Uint8Array(bytes);
        const combined = new Uint8Array(this.pendingBytes.length + newData.length);
        combined.set(this.pendingBytes);
        combined.set(newData, this.pendingBytes.length);

        const completeSamples = Math.floor(combined.length / 2);
        const bytesToProcess = completeSamples * 2;

        if (completeSamples > 0) {
            const int16 = new Int16Array(combined.buffer.slice(0, bytesToProcess));
            const floats = new Float32Array(completeSamples);
            for (let i = 0; i < completeSamples; i++) {
                floats[i] = int16[i] / 32768.0;
            }
            this.sampleChunks.push(floats);
        }

        this.pendingBytes = combined.length > bytesToProcess
            ? combined.slice(bytesToProcess)
            : new Uint8Array(0);
    }

    teardownStreamingPlayer() {
        try {
            if (this.scriptNode) {
                this.scriptNode.onaudioprocess = null;
                this.scriptNode.disconnect();
                this.scriptNode = null;
            }
            if (this.audioWorkletNode) {
                this.audioWorkletNode.disconnect();
                this.audioWorkletNode = null;
            }
            if (this.audioContext) {
                this.audioContext.close();
                this.audioContext = null;
            }
        } catch (error) {
            console.warn('Chatterbox: error tearing down streaming player:', error);
        }
    }

    // Called by the TTS framework when the user stops playback.
    // Aborts the in-flight request (cancels server generation) and stops local playback.
    stop() {
        if (this.abortController) {
            this.abortController.abort();
            this.abortController = null;
        }
        this.teardownStreamingPlayer();
        this.sampleChunks = [];
        this.chunkPos = 0;
        this.pendingBytes = new Uint8Array(0);
        this.updateStatus('Ready');
    }

    parseWavHeader(buffer) {
        const view = new DataView(buffer);
        // Number of channels: bytes 22-23 (little endian)
        const channels = view.getUint16(22, true);
        // Sample rate: bytes 24-27 (little endian)
        const sampleRate = view.getUint32(24, true);
        // Bits per sample: bytes 34-35 (little endian)
        const bitsPerSample = view.getUint16(34, true);

        return { sampleRate, channels, bitsPerSample };
    }

    async processStreamingAudio(response) {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        let headerParsed = false;
        // Buffer used to accumulate the leading WAV header across reads, in case
        // the first chunk arrives smaller than the 44-byte header.
        let headerBuffer = new Uint8Array(0);

        const concat = (a, b) => {
            const combined = new Uint8Array(a.length + b.length);
            combined.set(a);
            combined.set(b, a.length);
            return combined;
        };

        try {
            while (true) {
                const { done, value } = await reader.read();
                if (done) {
                    break;
                }

                if (!headerParsed) {
                    headerBuffer = concat(headerBuffer, value);
                    if (headerBuffer.length < 44) {
                        // Need more bytes before we can read the header
                        continue;
                    }

                    const wavInfo = this.parseWavHeader(headerBuffer.buffer);
                    console.log('Chatterbox WAV stream info:', wavInfo);

                    await this.initStreamingPlayer(wavInfo.sampleRate);

                    // Forward any PCM data that arrived after the 44-byte header
                    const pcmData = headerBuffer.slice(44);
                    if (pcmData.length > 0) {
                        this.pushPcm(pcmData);
                    }
                    headerParsed = true;
                    headerBuffer = new Uint8Array(0);
                    continue;
                }

                this.pushPcm(value);
            }
        } catch (error) {
            // stop() aborts the fetch, which surfaces here; treat as a clean cancellation.
            if (error?.name === 'AbortError') {
                console.info('Chatterbox audio stream cancelled.');
                return;
            }
            throw error;
        }
    }

    setVolume(volume) {
        // Clamp volume between 0.0 and 2.0 (0% to 200%)
        this.currentVolume = Math.max(0, Math.min(2.0, volume));

        // Regular (non-streaming) playback
        this.audioElement.volume = Math.min(this.currentVolume, 1.0);

        // Streaming playback via AudioWorklet (ScriptProcessor reads currentVolume directly)
        if (this.audioWorkletNode) {
            this.audioWorkletNode.port.postMessage({ volume: this.currentVolume });
        }
    }

    //######################//
    // Update Status        //
    //######################//

    updateStatus(status) {
        const statusElement = document.getElementById('chatterbox-status');
        if (statusElement) {
            statusElement.textContent = status;
            statusElement.className = status.toLowerCase();
        }
    }
}
