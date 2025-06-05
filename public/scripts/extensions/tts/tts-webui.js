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

    defaultSettings = {
        voiceMap: {},
        model: 'chatterbox',
        speed: 1,
        available_voices: ['random', 'echo'],
        provider_endpoint: 'http://127.0.0.1:7778/v1/audio/speech',
        streaming: false,
        stream_chunk_size: 100,
    };

    get settingsHtml() {
        let html = `
        <label for="openai_compatible_tts_endpoint">Provider Endpoint:</label>
        <div class="flex-container alignItemsCenter">
            <div class="flex1">
                <input id="openai_compatible_tts_endpoint" type="text" class="text_pole" maxlength="500" value="${this.defaultSettings.provider_endpoint}"/>
            </div>
            <div id="openai_compatible_tts_key" class="menu_button menu_button_icon">
                <i class="fa-solid fa-key"></i>
                <span>API Key</span>
            </div>
        </div>
        <label for="openai_compatible_model">Model:</label>
        <input id="openai_compatible_model" type="text" class="text_pole" maxlength="500" value="${this.defaultSettings.model}"/>
        <label for="openai_compatible_tts_voices">Available Voices (comma separated):</label>
        <input id="openai_compatible_tts_voices" type="text" class="text_pole" value="${this.defaultSettings.available_voices.join()}"/>
        <label for="openai_compatible_tts_streaming" class="checkbox_label">
            <input id="openai_compatible_tts_streaming" type="checkbox" />
            <span>Streaming</span>
        </label>
        <label for="openai_compatible_tts_speed">Speed: <span id="openai_compatible_tts_speed_output"></span></label>
        <input type="range" id="openai_compatible_tts_speed" value="1" min="0.25" max="4" step="0.05">
        <label for="openai_compatible_stream_chunk_size">Stream Chunk Size: <span id="openai_compatible_stream_chunk_size_output">${this.defaultSettings.stream_chunk_size}</span></label>
        <input id="openai_compatible_stream_chunk_size" type="range" value="${this.defaultSettings.stream_chunk_size}" min="50" max="500" step="10" />`;
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

        $('#openai_compatible_tts_speed').val(this.settings.speed);
        $('#openai_compatible_tts_speed').on('input', () => {
            this.onSettingsChange();
        });

        $('#openai_compatible_stream_chunk_size').val(this.settings.stream_chunk_size);
        $('#openai_compatible_stream_chunk_size').on('input', () => { this.onSettingsChange(); });

        $('#openai_compatible_tts_speed_output').text(this.settings.speed);
        $('#openai_compatible_stream_chunk_size_output').text(this.settings.stream_chunk_size);

        $('#openai_compatible_tts_key').toggleClass('success', secret_state[SECRET_KEYS.CUSTOM_OPENAI_TTS]);
        $('#openai_compatible_tts_key').on('click', async () => {
            const popupText = 'OpenAI-compatible TTS API Key';
            const savedKey = secret_state[SECRET_KEYS.CUSTOM_OPENAI_TTS] ? await findSecret(SECRET_KEYS.CUSTOM_OPENAI_TTS) : '';

            const key = await callGenericPopup(popupText, POPUP_TYPE.INPUT, savedKey, {
                customButtons: [{
                    text: 'Remove Key',
                    appendAtEnd: true,
                    result: POPUP_RESULT.NEGATIVE,
                    action: async () => {
                        await writeSecret(SECRET_KEYS.CUSTOM_OPENAI_TTS, '');
                        $('#openai_compatible_tts_key').toggleClass('success', !!secret_state[SECRET_KEYS.CUSTOM_OPENAI_TTS]);
                        toastr.success('API Key removed');
                        await this.onRefreshClick();
                    },
                }],
            });

            if (!key) {
                return;
            }

            await writeSecret(SECRET_KEYS.CUSTOM_OPENAI_TTS, String(key));

            toastr.success('API Key saved');
            $('#openai_compatible_tts_key').toggleClass('success', secret_state[SECRET_KEYS.CUSTOM_OPENAI_TTS]);
            await this.onRefreshClick();
        });

        await this.checkReady();

        console.debug('OpenAI Compatible TTS: Settings loaded');
    }

    onSettingsChange() {
        // Update dynamically
        this.settings.provider_endpoint = String($('#openai_compatible_tts_endpoint').val());
        this.settings.model = String($('#openai_compatible_model').val());
        this.settings.available_voices = String($('#openai_compatible_tts_voices').val()).split(',');
        this.settings.speed = Number($('#openai_compatible_tts_speed').val());
        this.settings.streaming = $('#openai_compatible_tts_streaming').is(':checked');
        this.settings.stream_chunk_size = Number($('#openai_compatible_stream_chunk_size').val());
        
        $('#openai_compatible_tts_speed_output').text(this.settings.speed);
        $('#openai_compatible_stream_chunk_size_output').text(this.settings.stream_chunk_size);
        
        saveTtsProviderSettings();
    }

    async checkReady() {
        await this.fetchTtsVoiceObjects();
    }

    async onRefreshClick() {
        return;
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
            // Stream audio in real-time like previewTtsVoice
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
            
            // Return a dummy response since audio is already playing
            return new Response(new Blob(), { status: 200 });
        }
        
        return response;
    }

    async fetchTtsVoiceObjects() {
        return this.settings.available_voices.map(v => {
            return { name: v, voice_id: v, lang: 'en-US' };
        });
    }

    async initAudioWorklet(wavSampleRate) {
        this.audioContext = new (window.AudioContext || window.webkitAudioContext)({ sampleRate: wavSampleRate });
        
        // Simple AudioWorklet processor for PCM streaming
        const processorCode = `
        
        class PCMProcessor extends AudioWorkletProcessor {
            constructor() {
                super();
                this.buffer = [];
                this.pendingBytes = new Uint8Array(0); // Buffer for incomplete samples
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
                            const float32Data = new Float32Array(int16Array.length);
                            for (let i = 0; i < int16Array.length; i++) {
                                float32Data[i] = int16Array[i] / 32768.0; // Convert 16-bit to float
                            }
                            // Use a loop instead of spread operator to avoid call stack overflow
                            for (let i = 0; i < float32Data.length; i++) {
                                this.buffer.push(float32Data[i]);
                            }
                        }
                        
                        // Store any remaining incomplete bytes
                        if (combined.length > bytesToProcess) {
                            this.pendingBytes = combined.slice(bytesToProcess);
                        } else {
                            this.pendingBytes = new Uint8Array(0);
                        }
                    }
                };
            }
            
            process(inputs, outputs, parameters) {
                const output = outputs[0];
                if (output.length > 0 && this.buffer.length > 0) {
                    const channelData = output[0];
                    for (let i = 0; i < channelData.length && this.buffer.length > 0; i++) {
                        channelData[i] = this.buffer.shift() || 0;
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

    async previewTtsVoice(voiceId) {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;

        const text = getPreviewString('en-US');
        const response = await this.fetchTtsGeneration(text, voiceId);
        
        if (this.settings.streaming) {
            // For streaming WAV audio using AudioWorklet
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

                // Send PCM data to AudioWorklet
                this.audioWorkletNode.port.postMessage({ pcmData: value });
                const next = await reader.read();
                return processStream(next);
            };

            const firstChunk = await reader.read();
            await processStream(firstChunk);
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
        
        if (this.settings.streaming) {
            // For streaming mode, make a direct request to the provider endpoint
            const response = await fetch(this.settings.provider_endpoint, {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json',
                    'Authorization': secret_state[SECRET_KEYS.CUSTOM_OPENAI_TTS] ? `Bearer ${await findSecret(SECRET_KEYS.CUSTOM_OPENAI_TTS)}` : '',
                    'Cache-Control': 'no-cache',
                },
                body: JSON.stringify({
                    model: this.settings.model,
                    voice: voiceId,
                    input: inputText,
                    response_format: 'wav', // Changed from 'mp3' to 'wav' for streaming
                    speed: this.settings.speed,
                    stream: true,
                    params: {
                        desired_length: this.settings.stream_chunk_size - 5,
                        max_length: this.settings.stream_chunk_size,
                    },
                }),
            });

            if (!response.ok) {
                toastr.error(response.statusText, 'TTS Generation Failed');
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }

            // For streaming, return the response directly so it can be consumed as a stream
            return response;
        }

        // Non-streaming request (existing code)
        const response = await fetch('/api/openai/custom/generate-voice', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                provider_endpoint: this.settings.provider_endpoint,
                model: this.settings.model,
                input: inputText,
                voice: voiceId,
                response_format: 'mp3',
                speed: this.settings.speed,
            }),
        });

        if (!response.ok) {
            toastr.error(response.statusText, 'TTS Generation Failed');
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        return response;
    }
}