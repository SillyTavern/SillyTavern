import { getPreviewString, saveTtsProviderSettings } from './index.js';

export { TtsWebuiProvider };

class TtsWebuiProvider {
    settings;
    voices = [];
    separator = ' . ';

    audioElement = document.createElement('audio');
    audioContext = null;
    audioWorkletNode = null;
    currentVolume = 1.0; // Track current volume

    defaultSettings = {
        voiceMap: {},
        model: 'chatterbox',
        speed: 1,
        volume: 1.0,
        available_voices: [''],
        provider_endpoint: 'http://127.0.0.1:7778/v1/audio/speech',
        streaming: true,
        stream_chunk_size: 100,
        desired_length: 80,
        max_length: 200,
        halve_first_chunk: true,
        exaggeration: 0.5,
        cfg_weight: 0.5,
        temperature: 0.8,
        device: 'auto',
        dtype: 'float32',
        cpu_offload: false,
        chunked: true,
        cache_voice: false,
        tokens_per_slice: 1000,
        remove_milliseconds: 45,
        remove_milliseconds_start: 25,
        chunk_overlap_method: 'zero',
        seed: -1,
    };

    get settingsHtml() {
        let html = `
        <h4 class="textAlignCenter">TTS WebUI Settings</h4>

        <div class="flex gap10px marginBot10 alignItemsFlexEnd">
            <div class="flex1 flexFlowColumn">
                <label for="tts_webui_endpoint">Provider Endpoint:</label>
                <input id="tts_webui_endpoint" type="text" class="text_pole" maxlength="500" value="${this.defaultSettings.provider_endpoint}"/>
            </div>
        </div>

        <div class="flex gap10px marginBot10">
            <div class="flex1 flexFlowColumn">
                <label for="tts_webui_model">Model:</label>
                <input id="tts_webui_model" type="text" class="text_pole" maxlength="500" value="${this.defaultSettings.model}"/>
            </div>
            <div class="flex1 flexFlowColumn">
                <label for="tts_webui_voices">Available Voices (comma separated):</label>
                <input id="tts_webui_voices" type="text" class="text_pole" value="${this.defaultSettings.available_voices.join()}"/>
            </div>
        </div>

        <div class="flex gap10px marginBot10">
            <div class="flex1 flexFlowColumn">
                <label for="tts_webui_streaming" class="checkbox_label alignItemsCenter flexGap5">
                    <input id="tts_webui_streaming" type="checkbox" />
                    <span>Streaming</span>
                </label>
            </div>
            <div class="flex1 flexFlowColumn">
                <label for="tts_webui_volume">Volume: <span id="tts_webui_volume_output">${this.defaultSettings.volume}</span></label>
                <input type="range" id="tts_webui_volume" value="${this.defaultSettings.volume}" min="0" max="2" step="0.1">
            </div>
        </div>

        <hr>
        <h4 class="textAlignCenter">Generation Settings</h4>

        <div class="flex gap10px marginBot10">
            <div class="flex1 flexFlowColumn">
                <label for="tts_webui_exaggeration">Exaggeration: <span id="tts_webui_exaggeration_output">${this.defaultSettings.exaggeration}</span></label>
                <input id="tts_webui_exaggeration" type="range" value="${this.defaultSettings.exaggeration}" min="0" max="2" step="0.1" />
            </div>
            <div class="flex1 flexFlowColumn">
                <label for="tts_webui_cfg_weight">CFG Weight: <span id="tts_webui_cfg_weight_output">${this.defaultSettings.cfg_weight}</span></label>
                <input id="tts_webui_cfg_weight" type="range" value="${this.defaultSettings.cfg_weight}" min="0" max="2" step="0.1" />
            </div>
        </div>

        <div class="flex gap10px marginBot10">
            <div class="flex1 flexFlowColumn">
                <label for="tts_webui_temperature">Temperature: <span id="tts_webui_temperature_output">${this.defaultSettings.temperature}</span></label>
                <input id="tts_webui_temperature" type="range" value="${this.defaultSettings.temperature}" min="0" max="2" step="0.1" />
            </div>
            <div class="flex1 flexFlowColumn">
                <label for="tts_webui_seed">Seed (-1 for random):</label>
                <input id="tts_webui_seed" type="text" class="text_pole" value="${this.defaultSettings.seed}"/>
            </div>
        </div>

        <hr>
        <h4 class="textAlignCenter">Chunking</h4>

        <div class="flex gap10px marginBot10">
            <div class="flex1 flexFlowColumn">
                <label for="tts_webui_chunked" class="checkbox_label alignItemsCenter flexGap5">
                    <input id="tts_webui_chunked" type="checkbox" />
                    <span>Split prompt into chunks</span>
                </label>
            </div>
            <div class="flex1 flexFlowColumn">
                <label for="tts_webui_halve_first_chunk" class="checkbox_label alignItemsCenter flexGap5">
                    <input id="tts_webui_halve_first_chunk" type="checkbox" />
                    <span>Halve First Chunk</span>
                </label>
            </div>
        </div>

        <div class="flex gap10px marginBot10">
            <div class="flex1 flexFlowColumn">
                <label for="tts_webui_desired_length">Desired Length: <span id="tts_webui_desired_length_output">${this.defaultSettings.desired_length}</span></label>
                <input id="tts_webui_desired_length" type="range" value="${this.defaultSettings.desired_length}" min="25" max="300" step="5" />
            </div>
            <div class="flex1 flexFlowColumn">
                <label for="tts_webui_max_length">Max Length: <span id="tts_webui_max_length_output">${this.defaultSettings.max_length}</span></label>
                <input id="tts_webui_max_length" type="range" value="${this.defaultSettings.max_length}" min="50" max="450" step="5" />
            </div>
        </div>

        <hr>
        <h4 class="textAlignCenter">Model</h4>

        <div class="flex gap10px marginBot10">
            <div class="flex1 flexFlowColumn">
                <label for="tts_webui_device">Device:</label>
                <select id="tts_webui_device">
                    <option value="auto" ${this.defaultSettings.device === 'auto' ? 'selected' : ''}>Auto</option>
                    <option value="cuda" ${this.defaultSettings.device === 'cuda' ? 'selected' : ''}>CUDA</option>
                    <option value="mps" ${this.defaultSettings.device === 'mps' ? 'selected' : ''}>MPS</option>
                    <option value="cpu" ${this.defaultSettings.device === 'cpu' ? 'selected' : ''}>CPU</option>
                </select>
            </div>
            <div class="flex1 flexFlowColumn">
                <label for="tts_webui_dtype">Data Type:</label>
                <select id="tts_webui_dtype">
                    <option value="float32" ${this.defaultSettings.dtype === 'float32' ? 'selected' : ''}>Float32</option>
                    <option value="float16" ${this.defaultSettings.dtype === 'float16' ? 'selected' : ''}>Float16</option>
                    <option value="bfloat16" ${this.defaultSettings.dtype === 'bfloat16' ? 'selected' : ''}>BFloat16</option>
                </select>
            </div>
        </div>

        <div class="flex gap10px marginBot10">
            <div class="flex1 flexFlowColumn">
                <label for="tts_webui_cpu_offload" class="checkbox_label alignItemsCenter flexGap5">
                    <input id="tts_webui_cpu_offload" type="checkbox" />
                    <span>CPU Offload</span>
                </label>
            </div>
            <div class="flex1">
                <!-- Empty for spacing -->
            </div>
        </div>

        <hr>
        <h4 class="textAlignCenter">Streaming (Advanced Settings)</h4>

        <div class="flex gap10px marginBot10">
            <div class="flex1 flexFlowColumn">
                <label for="tts_webui_tokens_per_slice">Tokens Per Slice: <span id="tts_webui_tokens_per_slice_output">${this.defaultSettings.tokens_per_slice}</span></label>
                <input id="tts_webui_tokens_per_slice" type="range" value="${this.defaultSettings.tokens_per_slice}" min="15" max="1000" step="1" />
            </div>
            <div class="flex1 flexFlowColumn">
                <label for="tts_webui_chunk_overlap_method">Chunk Overlap Method:</label>
                <select id="tts_webui_chunk_overlap_method">
                    <option value="zero" ${this.defaultSettings.chunk_overlap_method === 'zero' ? 'selected' : ''}>Zero</option>
                    <option value="full" ${this.defaultSettings.chunk_overlap_method === 'full' ? 'selected' : ''}>Full</option>
                </select>
            </div>
        </div>

        <div class="flex gap10px marginBot10">
            <div class="flex1 flexFlowColumn">
                <label for="tts_webui_remove_milliseconds">Remove Milliseconds: <span id="tts_webui_remove_milliseconds_output">${this.defaultSettings.remove_milliseconds}</span></label>
                <input id="tts_webui_remove_milliseconds" type="range" value="${this.defaultSettings.remove_milliseconds}" min="0" max="100" step="1" />
            </div>
            <div class="flex1 flexFlowColumn">
                <label for="tts_webui_remove_milliseconds_start">Remove Milliseconds Start: <span id="tts_webui_remove_milliseconds_start_output">${this.defaultSettings.remove_milliseconds_start}</span></label>
                <input id="tts_webui_remove_milliseconds_start" type="range" value="${this.defaultSettings.remove_milliseconds_start}" min="0" max="100" step="1" />
            </div>
        </div>`;
        return html;
    }

    async loadSettings(settings) {
        // Populate Provider UI given input settings
        if (Object.keys(settings).length == 0) {
            console.info('Using default TTS Provider settings');
        }

        // Only accept keys defined in defaultSettings
        this.settings = this.defaultSettings;

        for (const key in settings) {
            if (key in this.settings) {
                this.settings[key] = settings[key];
            } else {
                throw `Invalid setting passed to TTS Provider: ${key}`;
            }
        }

        $('#tts_webui_endpoint').val(this.settings.provider_endpoint);
        $('#tts_webui_endpoint').on('input', () => { this.onSettingsChange(); });

        $('#tts_webui_model').val(this.settings.model);
        $('#tts_webui_model').on('input', () => { this.onSettingsChange(); });

        $('#tts_webui_voices').val(this.settings.available_voices.join());
        $('#tts_webui_voices').on('input', () => { this.onSettingsChange(); });

        $('#tts_webui_streaming').prop('checked', this.settings.streaming);
        $('#tts_webui_streaming').on('change', () => { this.onSettingsChange(); });

        $('#tts_webui_volume').val(this.settings.volume);
        $('#tts_webui_volume').on('input', () => {
            this.onSettingsChange();
        });

        $('#tts_webui_stream_chunk_size').val(this.settings.stream_chunk_size);
        $('#tts_webui_stream_chunk_size').on('input', () => { this.onSettingsChange(); });

        $('#tts_webui_desired_length').val(this.settings.desired_length);
        $('#tts_webui_desired_length').on('input', () => { this.onSettingsChange(); });

        $('#tts_webui_max_length').val(this.settings.max_length);
        $('#tts_webui_max_length').on('input', () => { this.onSettingsChange(); });

        $('#tts_webui_halve_first_chunk').prop('checked', this.settings.halve_first_chunk);
        $('#tts_webui_halve_first_chunk').on('change', () => { this.onSettingsChange(); });

        $('#tts_webui_exaggeration').val(this.settings.exaggeration);
        $('#tts_webui_exaggeration').on('input', () => { this.onSettingsChange(); });

        $('#tts_webui_cfg_weight').val(this.settings.cfg_weight);
        $('#tts_webui_cfg_weight').on('input', () => { this.onSettingsChange(); });

        $('#tts_webui_temperature').val(this.settings.temperature);
        $('#tts_webui_temperature').on('input', () => { this.onSettingsChange(); });

        $('#tts_webui_device').val(this.settings.device);
        $('#tts_webui_device').on('change', () => { this.onSettingsChange(); });

        $('#tts_webui_dtype').val(this.settings.dtype);
        $('#tts_webui_dtype').on('change', () => { this.onSettingsChange(); });

        $('#tts_webui_cpu_offload').prop('checked', this.settings.cpu_offload);
        $('#tts_webui_cpu_offload').on('change', () => { this.onSettingsChange(); });

        $('#tts_webui_chunked').prop('checked', this.settings.chunked);
        $('#tts_webui_chunked').on('change', () => { this.onSettingsChange(); });

        $('#tts_webui_tokens_per_slice').val(this.settings.tokens_per_slice);
        $('#tts_webui_tokens_per_slice').on('input', () => { this.onSettingsChange(); });

        $('#tts_webui_remove_milliseconds').val(this.settings.remove_milliseconds);
        $('#tts_webui_remove_milliseconds').on('input', () => { this.onSettingsChange(); });

        $('#tts_webui_remove_milliseconds_start').val(this.settings.remove_milliseconds_start);
        $('#tts_webui_remove_milliseconds_start').on('input', () => { this.onSettingsChange(); });

        $('#tts_webui_chunk_overlap_method').val(this.settings.chunk_overlap_method);
        $('#tts_webui_chunk_overlap_method').on('change', () => { this.onSettingsChange(); });

        $('#tts_webui_seed').val(this.settings.seed);
        $('#tts_webui_seed').on('input', () => { this.onSettingsChange(); });

        // Update output labels
        $('#tts_webui_volume_output').text(this.settings.volume);
        $('#tts_webui_desired_length_output').text(this.settings.desired_length);
        $('#tts_webui_max_length_output').text(this.settings.max_length);
        $('#tts_webui_exaggeration_output').text(this.settings.exaggeration);
        $('#tts_webui_cfg_weight_output').text(this.settings.cfg_weight);
        $('#tts_webui_temperature_output').text(this.settings.temperature);
        $('#tts_webui_tokens_per_slice_output').text(this.settings.tokens_per_slice);
        $('#tts_webui_remove_milliseconds_output').text(this.settings.remove_milliseconds);
        $('#tts_webui_remove_milliseconds_start_output').text(this.settings.remove_milliseconds_start);

        await this.checkReady();

        console.debug('OpenAI Compatible TTS: Settings loaded');
    }

    onSettingsChange() {
        // Update dynamically
        this.settings.provider_endpoint = String($('#tts_webui_endpoint').val());
        this.settings.model = String($('#tts_webui_model').val());
        this.settings.available_voices = String($('#tts_webui_voices').val()).split(',');
        this.settings.volume = Number($('#tts_webui_volume').val());
        this.settings.streaming = $('#tts_webui_streaming').is(':checked');
        this.settings.stream_chunk_size = Number($('#tts_webui_stream_chunk_size').val());
        this.settings.desired_length = Number($('#tts_webui_desired_length').val());
        this.settings.max_length = Number($('#tts_webui_max_length').val());
        this.settings.halve_first_chunk = $('#tts_webui_halve_first_chunk').is(':checked');
        this.settings.exaggeration = Number($('#tts_webui_exaggeration').val());
        this.settings.cfg_weight = Number($('#tts_webui_cfg_weight').val());
        this.settings.temperature = Number($('#tts_webui_temperature').val());
        this.settings.device = String($('#tts_webui_device').val());
        this.settings.dtype = String($('#tts_webui_dtype').val());
        this.settings.cpu_offload = $('#tts_webui_cpu_offload').is(':checked');
        this.settings.chunked = $('#tts_webui_chunked').is(':checked');
        this.settings.tokens_per_slice = Number($('#tts_webui_tokens_per_slice').val());
        this.settings.remove_milliseconds = Number($('#tts_webui_remove_milliseconds').val());
        this.settings.remove_milliseconds_start = Number($('#tts_webui_remove_milliseconds_start').val());
        this.settings.chunk_overlap_method = String($('#tts_webui_chunk_overlap_method').val());
        this.settings.seed = parseInt($('#tts_webui_seed').val()) || -1;

        // Apply volume change immediately
        this.setVolume(this.settings.volume);

        // Update output labels
        $('#tts_webui_volume_output').text(this.settings.volume);
        $('#tts_webui_desired_length_output').text(this.settings.desired_length);
        $('#tts_webui_max_length_output').text(this.settings.max_length);
        $('#tts_webui_exaggeration_output').text(this.settings.exaggeration);
        $('#tts_webui_cfg_weight_output').text(this.settings.cfg_weight);
        $('#tts_webui_temperature_output').text(this.settings.temperature);
        $('#tts_webui_tokens_per_slice_output').text(this.settings.tokens_per_slice);
        $('#tts_webui_remove_milliseconds_output').text(this.settings.remove_milliseconds);
        $('#tts_webui_remove_milliseconds_start_output').text(this.settings.remove_milliseconds_start);

        saveTtsProviderSettings();
    }

    async checkReady() {
        await this.fetchTtsVoiceObjects();
    }

    async onRefreshClick() {
        await this.fetchTtsVoiceObjects();
        console.info('TTS voices refreshed');
    }

    async getVoice(voiceName) {
        if (this.voices.length == 0) {
            this.voices = await this.fetchTtsVoiceObjects();
        }
        const match = this.voices.filter(
            oaicVoice => oaicVoice.name == voiceName,
        )[0];
        if (!match) {
            throw `TTS Voice name ${voiceName} not found`;
        }
        return match;
    }

    async generateTts(text, voiceId) {
        const response = await this.fetchTtsGeneration(text, voiceId);

        if (this.settings.streaming) {
            // Stream audio in real-time
            await this.processStreamingAudio(response);
            // Return empty string since audio is already played via AudioWorklet
            return '';
        }

        return response;
    }

    async fetchTtsVoiceObjects() {
        // Try to fetch voices from the provider endpoint
        try {
            const voicesEndpoint = this.settings.provider_endpoint.replace('/speech', '/voices/' + this.settings.model);
            const response = await fetch(voicesEndpoint);

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const responseJson = await response.json();
            console.info('Discovered voices from provider:', responseJson);

            this.voices = responseJson.voices.map(({ value, label }) => ({
                name: label,
                voice_id: value,
                lang: 'en-US',
            }));

            return this.voices;
        } catch (error) {
            console.warn('Voice discovery failed, using configured voices:', error);
        }

        // Fallback to configured voices
        this.voices = this.settings.available_voices.map(name => ({
            name, voice_id: name, lang: 'en-US',
        }));

        return this.voices;
    }

    async initAudioWorklet(wavSampleRate) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: wavSampleRate });

        // Load the PCM processor from separate file
        const processorUrl = './scripts/extensions/tts/lib/pcm-processor.js';
        await this.audioContext.audioWorklet.addModule(processorUrl);
        this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor');
        this.audioWorkletNode.connect(this.audioContext.destination);
    }

    parseWavHeader(buffer) {
        const view = new DataView(buffer);
        // Sample rate is at bytes 24-27 (little endian)
        const sampleRate = view.getUint32(24, true);
        // Number of channels is at bytes 22-23 (little endian)
        const channels = view.getUint16(22, true);
        // Bits per sample is at bytes 34-35 (little endian)
        const bitsPerSample = view.getUint16(34, true);

        return { sampleRate, channels, bitsPerSample };
    }

    async processStreamingAudio(response) {
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }

        const reader = response.body.getReader();
        let headerParsed = false;
        let wavInfo = null;

        const processStream = async ({ done, value }) => {
            if (done) {
                return;
            }

            if (!headerParsed) {
                // Parse WAV header to get sample rate
                wavInfo = this.parseWavHeader(value.buffer);
                console.log('WAV Info:', wavInfo);

                // Initialize AudioWorklet with correct sample rate
                await this.initAudioWorklet(wavInfo.sampleRate);

                // Skip WAV header (first 44 bytes typically)
                const pcmData = value.slice(44);
                this.audioWorkletNode.port.postMessage({ pcmData });
                headerParsed = true;

                const next = await reader.read();
                return processStream(next);
            }

            // Send PCM data to AudioWorklet for immediate playback
            this.audioWorkletNode.port.postMessage({ pcmData: value });
            const next = await reader.read();
            return processStream(next);
        };

        const firstChunk = await reader.read();
        await processStream(firstChunk);
    }

    async previewTtsVoice(voiceId) {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;

        const text = getPreviewString('en-US');
        const response = await this.fetchTtsGeneration(text, voiceId);

        if (this.settings.streaming) {
            // Use shared streaming method
            await this.processStreamingAudio(response);
        } else {
            // For non-streaming, response is a fetch Response object
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const audio = await response.blob();
            const url = URL.createObjectURL(audio);
            this.audioElement.src = url;
            this.audioElement.play();
            this.audioElement.onended = () => URL.revokeObjectURL(url);
        }
    }

    async fetchTtsGeneration(inputText, voiceId) {
        console.info(`Generating new TTS for voice_id ${voiceId}`);

        const settings = this.settings;
        const streaming = settings.streaming;

        const chatterboxParams = [
            'desired_length',
            'max_length',
            'halve_first_chunk',
            'exaggeration',
            'cfg_weight',
            'temperature',
            'device',
            'dtype',
            'cpu_offload',
            'chunked',
            'cache_voice',
            'tokens_per_slice',
            'remove_milliseconds',
            'remove_milliseconds_start',
            'chunk_overlap_method',
            'seed',
        ];
        const getParams = settings => Object.fromEntries(
            Object.entries(settings).filter(([key]) =>
                chatterboxParams.includes(key),
            ),
        );

        const requestBody = {
            model: settings.model,
            voice: voiceId,
            input: inputText,
            response_format: 'wav',
            speed: settings.speed,
            stream: streaming,
            params: getParams(settings),
        };

        const headers = {
            'Content-Type': 'application/json',
            'Cache-Control': streaming ? 'no-cache' : undefined,
        };

        if (streaming) {
            headers['Cache-Control'] = 'no-cache';
        }

        const response = await fetch(settings.provider_endpoint, {
            method: 'POST',
            headers,
            body: JSON.stringify(requestBody),
        });

        if (!response.ok) {
            toastr.error(response.statusText, 'TTS Generation Failed');
            throw new Error(
                `HTTP ${response.status}: ${await response.text()}`,
            );
        }

        return response;
    }

    setVolume(volume) {
        // Clamp volume between 0.0 and 2.0 (0% to 200%)
        this.currentVolume = Math.max(0, Math.min(2.0, volume));

        // Set volume for regular audio element (non-streaming)
        this.audioElement.volume = Math.min(this.currentVolume, 1.0); // HTML audio element max is 1.0

        // Set volume for AudioWorklet (streaming)
        if (this.audioWorkletNode) {
            this.audioWorkletNode.port.postMessage({ volume: this.currentVolume });
        }
    }
}
