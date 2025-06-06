import { getRequestHeaders } from '../../../script.js';
import { callGenericPopup, POPUP_RESULT, POPUP_TYPE } from '../../popup.js';
import { findSecret, SECRET_KEYS, secret_state, writeSecret } from '../../secrets.js';
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
        available_voices: ['random'],
        provider_endpoint: 'http://127.0.0.1:7778/v1/audio/speech',
        streaming: false,
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
                <label for="openai_compatible_tts_endpoint">Provider Endpoint:</label>
                <input id="openai_compatible_tts_endpoint" type="text" class="text_pole" maxlength="500" value="${this.defaultSettings.provider_endpoint}"/>
            </div>
            <div id="openai_compatible_tts_key" class="menu_button menu_button_icon padding10">
                <i class="fa-solid fa-key"></i>
                <span>API Key</span>
            </div>
        </div>
        
        <div class="flex gap10px marginBot10">
            <div class="flex1 flexFlowColumn">
                <label for="openai_compatible_model">Model:</label>
                <input id="openai_compatible_model" type="text" class="text_pole" maxlength="500" value="${this.defaultSettings.model}"/>
            </div>
            <div class="flex1 flexFlowColumn">
                <label for="openai_compatible_tts_voices">Available Voices (comma separated):</label>
                <input id="openai_compatible_tts_voices" type="text" class="text_pole" value="${this.defaultSettings.available_voices.join()}"/>
            </div>
        </div>
        
        <div class="flex gap10px marginBot10">
            <div class="flex1 flexFlowColumn">
                <label for="openai_compatible_tts_streaming" class="checkbox_label alignItemsCenter flexGap5">
                    <input id="openai_compatible_tts_streaming" type="checkbox" />
                    <span>Streaming</span>
                </label>
            </div>
            <div class="flex1 flexFlowColumn">
                <label for="openai_compatible_tts_volume">Volume: <span id="openai_compatible_tts_volume_output">${this.defaultSettings.volume}</span></label>
                <input type="range" id="openai_compatible_tts_volume" value="${this.defaultSettings.volume}" min="0" max="2" step="0.1">
            </div>
        </div>
        
        <hr>
        <h4 class="textAlignCenter">Generation Settings</h4>
        
        <div class="flex gap10px marginBot10">
            <div class="flex1 flexFlowColumn">
                <label for="openai_compatible_exaggeration">Exaggeration: <span id="openai_compatible_exaggeration_output">${this.defaultSettings.exaggeration}</span></label>
                <input id="openai_compatible_exaggeration" type="range" value="${this.defaultSettings.exaggeration}" min="0" max="2" step="0.1" />
            </div>
            <div class="flex1 flexFlowColumn">
                <label for="openai_compatible_cfg_weight">CFG Weight: <span id="openai_compatible_cfg_weight_output">${this.defaultSettings.cfg_weight}</span></label>
                <input id="openai_compatible_cfg_weight" type="range" value="${this.defaultSettings.cfg_weight}" min="0" max="2" step="0.1" />
            </div>
        </div>
        
        <div class="flex gap10px marginBot10">
            <div class="flex1 flexFlowColumn">
                <label for="openai_compatible_temperature">Temperature: <span id="openai_compatible_temperature_output">${this.defaultSettings.temperature}</span></label>
                <input id="openai_compatible_temperature" type="range" value="${this.defaultSettings.temperature}" min="0" max="2" step="0.1" />
            </div>
            <div class="flex1 flexFlowColumn">
                <label for="openai_compatible_seed">Seed (-1 for random):</label>
                <input id="openai_compatible_seed" type="text" class="text_pole" value="${this.defaultSettings.seed}"/>
            </div>
        </div>
        
        <hr>
        <h4 class="textAlignCenter">Chunking</h4>
        
        <div class="flex gap10px marginBot10">
            <div class="flex1 flexFlowColumn">
                <label for="openai_compatible_chunked" class="checkbox_label alignItemsCenter flexGap5">
                    <input id="openai_compatible_chunked" type="checkbox" />
                    <span>Split prompt into chunks</span>
                </label>
            </div>
            <div class="flex1 flexFlowColumn">
                <label for="openai_compatible_halve_first_chunk" class="checkbox_label alignItemsCenter flexGap5">
                    <input id="openai_compatible_halve_first_chunk" type="checkbox" />
                    <span>Halve First Chunk</span>
                </label>
            </div>
        </div>
        
        <div class="flex gap10px marginBot10">
            <div class="flex1 flexFlowColumn">
                <label for="openai_compatible_desired_length">Desired Length: <span id="openai_compatible_desired_length_output">${this.defaultSettings.desired_length}</span></label>
                <input id="openai_compatible_desired_length" type="range" value="${this.defaultSettings.desired_length}" min="25" max="300" step="5" />
            </div>
            <div class="flex1 flexFlowColumn">
                <label for="openai_compatible_max_length">Max Length: <span id="openai_compatible_max_length_output">${this.defaultSettings.max_length}</span></label>
                <input id="openai_compatible_max_length" type="range" value="${this.defaultSettings.max_length}" min="50" max="450" step="5" />
            </div>
        </div>
        
        <hr>
        <h4 class="textAlignCenter">Model</h4>
        
        <div class="flex gap10px marginBot10">
            <div class="flex1 flexFlowColumn">
                <label for="openai_compatible_device">Device:</label>
                <select id="openai_compatible_device">
                    <option value="auto" ${this.defaultSettings.device === 'auto' ? 'selected' : ''}>Auto</option>
                    <option value="cuda" ${this.defaultSettings.device === 'cuda' ? 'selected' : ''}>CUDA</option>
                    <option value="mps" ${this.defaultSettings.device === 'mps' ? 'selected' : ''}>MPS</option>
                    <option value="cpu" ${this.defaultSettings.device === 'cpu' ? 'selected' : ''}>CPU</option>
                </select>
            </div>
            <div class="flex1 flexFlowColumn">
                <label for="openai_compatible_dtype">Data Type:</label>
                <select id="openai_compatible_dtype">
                    <option value="float32" ${this.defaultSettings.dtype === 'float32' ? 'selected' : ''}>Float32</option>
                    <option value="float16" ${this.defaultSettings.dtype === 'float16' ? 'selected' : ''}>Float16</option>
                    <option value="bfloat16" ${this.defaultSettings.dtype === 'bfloat16' ? 'selected' : ''}>BFloat16</option>
                </select>
            </div>
        </div>
        
        <div class="flex gap10px marginBot10">
            <div class="flex1 flexFlowColumn">
                <label for="openai_compatible_cpu_offload" class="checkbox_label alignItemsCenter flexGap5">
                    <input id="openai_compatible_cpu_offload" type="checkbox" />
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
                <label for="openai_compatible_tokens_per_slice">Tokens Per Slice: <span id="openai_compatible_tokens_per_slice_output">${this.defaultSettings.tokens_per_slice}</span></label>
                <input id="openai_compatible_tokens_per_slice" type="range" value="${this.defaultSettings.tokens_per_slice}" min="15" max="1000" step="1" />
            </div>
            <div class="flex1 flexFlowColumn">
                <label for="openai_compatible_chunk_overlap_method">Chunk Overlap Method:</label>
                <select id="openai_compatible_chunk_overlap_method">
                    <option value="zero" ${this.defaultSettings.chunk_overlap_method === 'zero' ? 'selected' : ''}>Zero</option>
                    <option value="full" ${this.defaultSettings.chunk_overlap_method === 'full' ? 'selected' : ''}>Full</option>
                </select>
            </div>
        </div>
        
        <div class="flex gap10px marginBot10">
            <div class="flex1 flexFlowColumn">
                <label for="openai_compatible_remove_milliseconds">Remove Milliseconds: <span id="openai_compatible_remove_milliseconds_output">${this.defaultSettings.remove_milliseconds}</span></label>
                <input id="openai_compatible_remove_milliseconds" type="range" value="${this.defaultSettings.remove_milliseconds}" min="0" max="100" step="1" />
            </div>
            <div class="flex1 flexFlowColumn">
                <label for="openai_compatible_remove_milliseconds_start">Remove Milliseconds Start: <span id="openai_compatible_remove_milliseconds_start_output">${this.defaultSettings.remove_milliseconds_start}</span></label>
                <input id="openai_compatible_remove_milliseconds_start" type="range" value="${this.defaultSettings.remove_milliseconds_start}" min="0" max="100" step="1" />
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

        $('#openai_compatible_tts_endpoint').val(this.settings.provider_endpoint);
        $('#openai_compatible_tts_endpoint').on('input', () => { this.onSettingsChange(); });

        $('#openai_compatible_model').val(this.settings.model);
        $('#openai_compatible_model').on('input', () => { this.onSettingsChange(); });

        $('#openai_compatible_tts_voices').val(this.settings.available_voices.join());
        $('#openai_compatible_tts_voices').on('input', () => { this.onSettingsChange(); });

        $('#openai_compatible_tts_streaming').prop('checked', this.settings.streaming);
        $('#openai_compatible_tts_streaming').on('change', () => { this.onSettingsChange(); });

        $('#openai_compatible_tts_volume').val(this.settings.volume);
        $('#openai_compatible_tts_volume').on('input', () => {
            this.onSettingsChange();
        });

        $('#openai_compatible_stream_chunk_size').val(this.settings.stream_chunk_size);
        $('#openai_compatible_stream_chunk_size').on('input', () => { this.onSettingsChange(); });

        $('#openai_compatible_desired_length').val(this.settings.desired_length);
        $('#openai_compatible_desired_length').on('input', () => { this.onSettingsChange(); });

        $('#openai_compatible_max_length').val(this.settings.max_length);
        $('#openai_compatible_max_length').on('input', () => { this.onSettingsChange(); });

        $('#openai_compatible_halve_first_chunk').prop('checked', this.settings.halve_first_chunk);
        $('#openai_compatible_halve_first_chunk').on('change', () => { this.onSettingsChange(); });

        $('#openai_compatible_exaggeration').val(this.settings.exaggeration);
        $('#openai_compatible_exaggeration').on('input', () => { this.onSettingsChange(); });

        $('#openai_compatible_cfg_weight').val(this.settings.cfg_weight);
        $('#openai_compatible_cfg_weight').on('input', () => { this.onSettingsChange(); });

        $('#openai_compatible_temperature').val(this.settings.temperature);
        $('#openai_compatible_temperature').on('input', () => { this.onSettingsChange(); });

        $('#openai_compatible_device').val(this.settings.device);
        $('#openai_compatible_device').on('change', () => { this.onSettingsChange(); });

        $('#openai_compatible_dtype').val(this.settings.dtype);
        $('#openai_compatible_dtype').on('change', () => { this.onSettingsChange(); });

        $('#openai_compatible_cpu_offload').prop('checked', this.settings.cpu_offload);
        $('#openai_compatible_cpu_offload').on('change', () => { this.onSettingsChange(); });

        $('#openai_compatible_chunked').prop('checked', this.settings.chunked);
        $('#openai_compatible_chunked').on('change', () => { this.onSettingsChange(); });

        $('#openai_compatible_tokens_per_slice').val(this.settings.tokens_per_slice);
        $('#openai_compatible_tokens_per_slice').on('input', () => { this.onSettingsChange(); });

        $('#openai_compatible_remove_milliseconds').val(this.settings.remove_milliseconds);
        $('#openai_compatible_remove_milliseconds').on('input', () => { this.onSettingsChange(); });

        $('#openai_compatible_remove_milliseconds_start').val(this.settings.remove_milliseconds_start);
        $('#openai_compatible_remove_milliseconds_start').on('input', () => { this.onSettingsChange(); });

        $('#openai_compatible_chunk_overlap_method').val(this.settings.chunk_overlap_method);
        $('#openai_compatible_chunk_overlap_method').on('change', () => { this.onSettingsChange(); });

        $('#openai_compatible_seed').val(this.settings.seed);
        $('#openai_compatible_seed').on('input', () => { this.onSettingsChange(); });

        $('#openai_compatible_tts_key').toggleClass('success', secret_state[SECRET_KEYS.TTS_WEBUI]);
        $('#openai_compatible_tts_key').on('click', async () => {
            const popupText = 'TTS WebUI API Key';
            const savedKey = secret_state[SECRET_KEYS.TTS_WEBUI] ? await findSecret(SECRET_KEYS.TTS_WEBUI) : '';

            const key = await callGenericPopup(popupText, POPUP_TYPE.INPUT, savedKey, {
                customButtons: [{
                    text: 'Remove Key',
                    appendAtEnd: true,
                    result: POPUP_RESULT.NEGATIVE,
                    action: async () => {
                        await writeSecret(SECRET_KEYS.TTS_WEBUI, '');
                        $('#openai_compatible_tts_key').toggleClass('success', !!secret_state[SECRET_KEYS.TTS_WEBUI]);
                        toastr.success('API Key removed');
                        await this.onRefreshClick();
                    },
                }],
            });

            if (!key) {
                return;
            }

            await writeSecret(SECRET_KEYS.TTS_WEBUI, String(key));

            toastr.success('API Key saved');
            $('#openai_compatible_tts_key').toggleClass('success', secret_state[SECRET_KEYS.TTS_WEBUI]);
            await this.onRefreshClick();
        });

        // Update output labels
        $('#openai_compatible_tts_volume_output').text(this.settings.volume);
        $('#openai_compatible_desired_length_output').text(this.settings.desired_length);
        $('#openai_compatible_max_length_output').text(this.settings.max_length);
        $('#openai_compatible_exaggeration_output').text(this.settings.exaggeration);
        $('#openai_compatible_cfg_weight_output').text(this.settings.cfg_weight);
        $('#openai_compatible_temperature_output').text(this.settings.temperature);
        $('#openai_compatible_tokens_per_slice_output').text(this.settings.tokens_per_slice);
        $('#openai_compatible_remove_milliseconds_output').text(this.settings.remove_milliseconds);
        $('#openai_compatible_remove_milliseconds_start_output').text(this.settings.remove_milliseconds_start);

        await this.checkReady();

        console.debug('OpenAI Compatible TTS: Settings loaded');
    }

    onSettingsChange() {
        // Update dynamically
        this.settings.provider_endpoint = String($('#openai_compatible_tts_endpoint').val());
        this.settings.model = String($('#openai_compatible_model').val());
        this.settings.available_voices = String($('#openai_compatible_tts_voices').val()).split(',');
        this.settings.volume = Number($('#openai_compatible_tts_volume').val());
        this.settings.streaming = $('#openai_compatible_tts_streaming').is(':checked');
        this.settings.stream_chunk_size = Number($('#openai_compatible_stream_chunk_size').val());
        this.settings.desired_length = Number($('#openai_compatible_desired_length').val());
        this.settings.max_length = Number($('#openai_compatible_max_length').val());
        this.settings.halve_first_chunk = $('#openai_compatible_halve_first_chunk').is(':checked');
        this.settings.exaggeration = Number($('#openai_compatible_exaggeration').val());
        this.settings.cfg_weight = Number($('#openai_compatible_cfg_weight').val());
        this.settings.temperature = Number($('#openai_compatible_temperature').val());
        this.settings.device = String($('#openai_compatible_device').val());
        this.settings.dtype = String($('#openai_compatible_dtype').val());
        this.settings.cpu_offload = $('#openai_compatible_cpu_offload').is(':checked');
        this.settings.chunked = $('#openai_compatible_chunked').is(':checked');
        this.settings.tokens_per_slice = Number($('#openai_compatible_tokens_per_slice').val());
        this.settings.remove_milliseconds = Number($('#openai_compatible_remove_milliseconds').val());
        this.settings.remove_milliseconds_start = Number($('#openai_compatible_remove_milliseconds_start').val());
        this.settings.chunk_overlap_method = String($('#openai_compatible_chunk_overlap_method').val());
        this.settings.seed = parseInt($('#openai_compatible_seed').val()) || -1;

        // Apply volume change immediately
        this.setVolume(this.settings.volume);

        // Update output labels
        $('#openai_compatible_tts_volume_output').text(this.settings.volume);
        $('#openai_compatible_desired_length_output').text(this.settings.desired_length);
        $('#openai_compatible_max_length_output').text(this.settings.max_length);
        $('#openai_compatible_exaggeration_output').text(this.settings.exaggeration);
        $('#openai_compatible_cfg_weight_output').text(this.settings.cfg_weight);
        $('#openai_compatible_temperature_output').text(this.settings.temperature);
        $('#openai_compatible_tokens_per_slice_output').text(this.settings.tokens_per_slice);
        $('#openai_compatible_remove_milliseconds_output').text(this.settings.remove_milliseconds);
        $('#openai_compatible_remove_milliseconds_start_output').text(this.settings.remove_milliseconds_start);

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

            // Return a silent WAV file as dummy to prevent overlapping audio
            const silentWavHeader = new Uint8Array([
                0x52, 0x49, 0x46, 0x46, // "RIFF"
                0x24, 0x00, 0x00, 0x00, // File size (36 bytes)
                0x57, 0x41, 0x56, 0x45, // "WAVE"
                0x66, 0x6D, 0x74, 0x20, // "fmt "
                0x10, 0x00, 0x00, 0x00, // Subchunk1Size (16)
                0x01, 0x00,             // AudioFormat (PCM)
                0x01, 0x00,             // NumChannels (1)
                0x44, 0xAC, 0x00, 0x00, // SampleRate (44100)
                0x88, 0x58, 0x01, 0x00, // ByteRate
                0x02, 0x00,             // BlockAlign
                0x10, 0x00,             // BitsPerSample (16)
                0x64, 0x61, 0x74, 0x61, // "data"
                0x00, 0x00, 0x00, 0x00,  // Subchunk2Size (0 - no audio data)
            ]);

            const silentBlob = new Blob([silentWavHeader], { type: 'audio/wav' });
            return new Response(silentBlob, {
                status: 200,
                headers: {
                    'Content-Type': 'audio/wav',
                    'Content-Length': silentBlob.size.toString(),
                },
            });
        }

        return response;
    }

    async fetchTtsVoiceObjects() {
        // Try to fetch voices from the provider endpoint
        try {
            const voicesEndpoint = this.settings.provider_endpoint.replace('/speech', '/voices/' + this.settings.model);

            const response = await fetch(voicesEndpoint, {
                headers: {
                    'Authorization': secret_state[SECRET_KEYS.TTS_WEBUI] ? `Bearer ${await findSecret(SECRET_KEYS.TTS_WEBUI)}` : '',
                },
            });

            if (!response.ok) {
                throw new Error(`HTTP ${response.status}`);
            }

            const responseJson = await response.json();
            console.info('Discovered voices from provider:', responseJson);

            // Handle chatterbox format: {"voices":["Alice.wav","Emmett.wav",...]}
            this.voices = responseJson.voices.map(voiceFile => ({
                name: voiceFile.replace(/\.wav$/, ''),
                voice_id: `voices/chatterbox/${voiceFile}`,
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

        // Simple AudioWorklet processor for PCM streaming
        const processorCode = `
class PCMProcessor extends AudioWorkletProcessor {
    constructor() {
        super();
        this.buffer = new Float32Array(24000 * 30); // Pre-allocate buffer for ~30 seconds at 24kHz
        this.writeIndex = 0;
        this.readIndex = 0;
        this.pendingBytes = new Uint8Array(0); // Buffer for incomplete samples
        this.volume = 1.0; // Default volume (1.0 = 100%, 0.5 = 50%, etc.)
        this.port.onmessage = (event) => {
            if (event.data.pcmData) {
                // Combine any pending bytes with new data
                const newData = new Uint8Array(event.data.pcmData);
                const combined = new Uint8Array(this.pendingBytes.length + newData.length);
                combined.set(this.pendingBytes);
                combined.set(newData, this.pendingBytes.length);
                
                // Calculate how many complete 16-bit samples we have
                const completeSamples = Math.floor(combined.length / 2);
                const bytesToProcess = completeSamples * 2;
                
                if (completeSamples > 0) {
                    // Process complete samples
                    const int16Array = new Int16Array(combined.buffer.slice(0, bytesToProcess));
                    
                    // Write directly to circular buffer
                    for (let i = 0; i < int16Array.length; i++) {
                        // Expand buffer if needed
                        if (this.writeIndex >= this.buffer.length) {
                            const newBuffer = new Float32Array(this.buffer.length * 2);
                            // Copy existing data maintaining order
                            let sourceIndex = this.readIndex;
                            let targetIndex = 0;
                            while (sourceIndex !== this.writeIndex) {
                                newBuffer[targetIndex++] = this.buffer[sourceIndex];
                                sourceIndex = (sourceIndex + 1) % this.buffer.length;
                            }
                            this.buffer = newBuffer;
                            this.readIndex = 0;
                            this.writeIndex = targetIndex;
                        }
                        
                        this.buffer[this.writeIndex] = int16Array[i] / 32768.0; // Convert 16-bit to float
                        this.writeIndex = (this.writeIndex + 1) % this.buffer.length;
                    }
                }
                
                // Store any remaining incomplete bytes
                if (combined.length > bytesToProcess) {
                    this.pendingBytes = combined.slice(bytesToProcess);
                } else {
                    this.pendingBytes = new Uint8Array(0);
                }
            } else if (event.data.volume !== undefined) {
                // Set volume (0.0 to 1.0, can go higher for amplification)
                this.volume = Math.max(0, event.data.volume);
            }
        };
    }
    
    process(inputs, outputs, parameters) {
        const output = outputs[0];
        if (output.length > 0 && this.readIndex !== this.writeIndex) {
            const channelData = output[0];
            for (let i = 0; i < channelData.length && this.readIndex !== this.writeIndex; i++) {
                channelData[i] = this.buffer[this.readIndex] * this.volume;
                this.readIndex = (this.readIndex + 1) % this.buffer.length;
            }
        }
        return true;
    }
}
registerProcessor('pcm-processor', PCMProcessor);
`;

        const blob = new Blob([processorCode], { type: 'application/javascript' });
        const processorUrl = URL.createObjectURL(blob);

        await this.audioContext.audioWorklet.addModule(processorUrl);
        this.audioWorkletNode = new AudioWorkletNode(this.audioContext, 'pcm-processor');
        this.audioWorkletNode.connect(this.audioContext.destination);

        URL.revokeObjectURL(processorUrl);
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

        const requestBody = {
            model: this.settings.model,
            voice: voiceId,
            input: inputText,
            response_format: 'wav',
            speed: this.settings.speed,
            stream: this.settings.streaming,
            params: {
                desired_length: this.settings.desired_length,
                max_length: this.settings.max_length,
                halve_first_chunk: this.settings.halve_first_chunk,
                exaggeration: this.settings.exaggeration,
                cfg_weight: this.settings.cfg_weight,
                temperature: this.settings.temperature,
                device: this.settings.device,
                dtype: this.settings.dtype,
                cpu_offload: this.settings.cpu_offload,
                chunked: this.settings.chunked,
                cache_voice: this.settings.cache_voice,
                tokens_per_slice: this.settings.tokens_per_slice,
                remove_milliseconds: this.settings.remove_milliseconds,
                remove_milliseconds_start: this.settings.remove_milliseconds_start,
                chunk_overlap_method: this.settings.chunk_overlap_method,
                seed: this.settings.seed,
            },
        };

        const headers = {
            'Content-Type': 'application/json',
            'Authorization': secret_state[SECRET_KEYS.TTS_WEBUI] ? `Bearer ${await findSecret(SECRET_KEYS.TTS_WEBUI)}` : '',
        };

        if (this.settings.streaming) {
            headers['Cache-Control'] = 'no-cache';
        }

        let response;

        if (this.settings.streaming) {
            // For streaming mode, make a direct request to the provider endpoint
            response = await fetch(this.settings.provider_endpoint, {
                method: 'POST',
                headers,
                body: JSON.stringify(requestBody),
            });
        } else {
            // Non-streaming request
            response = await fetch('/api/openai/custom/generate-voice', {
                method: 'POST',
                headers: { ...getRequestHeaders() },
                body: JSON.stringify({
                    provider_endpoint: this.settings.provider_endpoint,
                    ...requestBody,
                }),
            });
        }

        if (!response.ok) {
            toastr.error(response.statusText, 'TTS Generation Failed');
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
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

    getVolume() {
        return this.currentVolume;
    }

    mute() {
        this.setVolume(0);
    }

    unmute() {
        this.setVolume(1.0);
    }
}
