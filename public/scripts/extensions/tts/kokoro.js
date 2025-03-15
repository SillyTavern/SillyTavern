import { debounce_timeout } from '../../constants.js';
import { debounceAsync, splitRecursive } from '../../utils.js';
import { getPreviewString, saveTtsProviderSettings } from './index.js';

export class KokoroTtsProvider {
    constructor() {
        this.settings = {
            modelId: 'onnx-community/Kokoro-82M-v1.0-ONNX',
            dtype: 'q8',
            device: 'wasm',
            voiceMap: {},
            defaultVoice: 'af_heart',
            speakingRate: 1.0,
        };
        this.ready = false;
        this.voices = [
            'af_heart',
            'af_alloy',
            'af_aoede',
            'af_bella',
            'af_jessica',
            'af_kore',
            'af_nicole',
            'af_nova',
            'af_river',
            'af_sarah',
            'af_sky',
            'am_adam',
            'am_echo',
            'am_eric',
            'am_fenrir',
            'am_liam',
            'am_michael',
            'am_onyx',
            'am_puck',
            'am_santa',
            'bf_emma',
            'bf_isabella',
            'bm_george',
            'bm_lewis',
            'bf_alice',
            'bf_lily',
            'bm_daniel',
            'bm_fable',
        ];
        this.worker = null;
        this.separator = ' ... ... ... ';
        this.pendingRequests = new Map();
        this.nextRequestId = 1;

        // Update display values immediately but only reinitialize TTS after a delay
        this.initTtsDebounced = debounceAsync(this.initializeWorker.bind(this), debounce_timeout.relaxed);
    }

    /**
     * Perform any text processing before passing to TTS engine.
     * @param {string} text Input text
     * @returns {string} Processed text
     */
    processText(text) {
        // TILDE!
        text = text.replace(/~/g, '.');
        return text;
    }

    async loadSettings(settings) {
        if (settings.modelId !== undefined) this.settings.modelId = settings.modelId;
        if (settings.dtype !== undefined) this.settings.dtype = settings.dtype;
        if (settings.device !== undefined) this.settings.device = settings.device;
        if (settings.voiceMap !== undefined) this.settings.voiceMap = settings.voiceMap;
        if (settings.defaultVoice !== undefined) this.settings.defaultVoice = settings.defaultVoice;
        if (settings.speakingRate !== undefined) this.settings.speakingRate = settings.speakingRate;

        $('#kokoro_model_id').val(this.settings.modelId).on('input', this.onSettingsChange.bind(this));
        $('#kokoro_dtype').val(this.settings.dtype).on('change', this.onSettingsChange.bind(this));
        $('#kokoro_device').val(this.settings.device).on('change', this.onSettingsChange.bind(this));
        $('#kokoro_speaking_rate').val(this.settings.speakingRate).on('input', this.onSettingsChange.bind(this));
        $('#kokoro_speaking_rate_output').text(this.settings.speakingRate + 'x');
    }

    initializeWorker() {
        return new Promise((resolve, reject) => {
            try {
                // Terminate the existing worker if it exists
                if (this.worker) {
                    this.worker.terminate();
                    $('#kokoro_status_text').text('Initializing...').removeAttr('style');
                }

                // Create a new worker
                this.worker = new Worker(new URL('./kokoro-worker.js', import.meta.url), { type: 'module' });

                // Set up message handling
                this.worker.onmessage = this.handleWorkerMessage.bind(this);

                // Initialize the worker with the current settings
                this.worker.postMessage({
                    action: 'initialize',
                    data: {
                        modelId: this.settings.modelId,
                        dtype: this.settings.dtype,
                        device: this.settings.device,
                    },
                });

                // Create a promise that will resolve when initialization completes
                const initPromise = new Promise((initResolve, initReject) => {
                    const timeoutId = setTimeout(() => {
                        initReject(new Error('Worker initialization timed out'));
                    }, 600000); // 600 second timeout

                    this.pendingRequests.set('initialization', {
                        resolve: (result) => {
                            clearTimeout(timeoutId);
                            initResolve(result);
                        },
                        reject: (error) => {
                            clearTimeout(timeoutId);
                            initReject(error);
                        },
                    });
                });

                // Resolve the outer promise when initialization completes
                initPromise.then(success => {
                    this.ready = success;
                    this.updateStatusDisplay();
                    resolve(success);
                }).catch(error => {
                    console.error('Worker initialization failed:', error);
                    this.ready = false;
                    this.updateStatusDisplay();
                    reject(error);
                });
            } catch (error) {
                console.error('Failed to create worker:', error);
                this.ready = false;
                this.updateStatusDisplay();
                reject(error);
            }
        });
    }

    handleWorkerMessage(event) {
        const { action, success, ready, error, requestId, blobUrl } = event.data;

        switch (action) {
            case 'initialized': {
                const initRequest = this.pendingRequests.get('initialization');
                if (initRequest) {
                    if (success) {
                        initRequest.resolve(true);
                    } else {
                        initRequest.reject(new Error(error || 'Initialization failed'));
                    }
                    this.pendingRequests.delete('initialization');
                }
            } break;
            case 'generatedTts': {
                const request = this.pendingRequests.get(requestId);
                if (request) {
                    if (success) {
                        fetch(blobUrl).then(response => response.blob()).then(audioBlob => {
                            // Clean up the blob URL
                            URL.revokeObjectURL(blobUrl);

                            request.resolve(new Response(audioBlob, {
                                headers: {
                                    'Content-Type': 'audio/wav',
                                },
                            }));
                        }).catch(error => {
                            request.reject(new Error('Failed to fetch TTS audio blob: ' + error));
                        });
                    } else {
                        request.reject(new Error(error || 'TTS generation failed'));
                    }
                    this.pendingRequests.delete(requestId);
                }
            } break;
            case 'readyStatus':
                this.ready = ready;
                this.updateStatusDisplay();
                break;
        }
    }

    updateStatusDisplay() {
        const statusText = this.ready ? 'Ready' : 'Failed';
        const statusColor = this.ready ? 'green' : 'red';
        $('#kokoro_status_text').text(statusText).css('color', statusColor);
    }

    async checkReady() {
        if (!this.worker) {
            return await this.initializeWorker();
        }

        this.worker.postMessage({ action: 'checkReady' });
        return this.ready;
    }

    async onRefreshClick() {
        return await this.initializeWorker();
    }

    get settingsHtml() {
        return `
            <div class="kokoro_tts_settings">
                <label for="kokoro_model_id">Model ID:</label>
                <input id="kokoro_model_id" type="text" class="text_pole" value="${this.settings.modelId}" />

                <label for="kokoro_dtype">Data Type:</label>
                <select id="kokoro_dtype" class="text_pole">
                    <option value="q8" ${this.settings.dtype === 'q8' ? 'selected' : ''}>q8 (Recommended)</option>
                    <option value="fp32" ${this.settings.dtype === 'fp32' ? 'selected' : ''}>fp32 (High Precision)</option>
                    <option value="fp16" ${this.settings.dtype === 'fp16' ? 'selected' : ''}>fp16</option>
                    <option value="q4" ${this.settings.dtype === 'q4' ? 'selected' : ''}>q4 (Low Memory)</option>
                    <option value="q4f16" ${this.settings.dtype === 'q4f16' ? 'selected' : ''}>q4f16</option>
                </select>

                <label for="kokoro_device">Device:</label>
                <select id="kokoro_device" class="text_pole">
                    <option value="wasm" ${this.settings.device === 'wasm' ? 'selected' : ''}>WebAssembly (CPU)</option>
                    <option value="webgpu" ${this.settings.device === 'webgpu' ? 'selected' : ''}>WebGPU (GPU Acceleration)</option>
                </select>

                <label for="kokoro_speaking_rate">Speaking Rate: <span id="kokoro_speaking_rate_output">${this.settings.speakingRate}x</span></label>
                <input id="kokoro_speaking_rate" type="range" value="${this.settings.speakingRate}" min="0.5" max="2.0" step="0.1" />

                <hr>
                <div>
                    Status: <span id="kokoro_status_text">Initializing...</span>
                </div>
            </div>
        `;
    }

    async onSettingsChange() {
        this.settings.modelId = $('#kokoro_model_id').val().toString();
        this.settings.dtype = $('#kokoro_dtype').val().toString();
        this.settings.device = $('#kokoro_device').val().toString();
        this.settings.speakingRate = parseFloat($('#kokoro_speaking_rate').val().toString());

        // Update UI display
        $('#kokoro_speaking_rate_output').text(this.settings.speakingRate + 'x');

        // Reinitialize TTS engine with debounce
        this.initTtsDebounced();
        saveTtsProviderSettings();
    }

    async fetchTtsVoiceObjects() {
        if (!this.ready) {
            await this.checkReady();
        }
        return this.voices.map(voice => ({
            name: voice,
            voice_id: voice,
            preview_url: null,
            lang: voice.startsWith('b') ? 'en-GB' : 'en-US',
        }));
    }

    async previewTtsVoice(voiceId) {
        if (!this.ready) {
            await this.checkReady();
        }

        const voice = this.getVoice(voiceId);
        const previewText = getPreviewString(voice.lang);
        for await (const response of this.generateTts(previewText, voiceId)) {
            const audio = await response.blob();
            const url = URL.createObjectURL(audio);
            await new Promise(resolve => {
                const audioElement = new Audio();
                audioElement.src = url;
                audioElement.play();
                audioElement.onended = () => resolve();
            });
            URL.revokeObjectURL(url);
        }
    }

    getVoiceDisplayName(voiceId) {
        return voiceId;
    }

    getVoice(voiceName) {
        const defaultVoice = this.settings.defaultVoice || 'af_heart';
        const actualVoiceName = this.voices.includes(voiceName) ? voiceName : defaultVoice;
        return {
            name: actualVoiceName,
            voice_id: actualVoiceName,
            preview_url: null,
            lang: actualVoiceName.startsWith('b') ? 'en-GB' : 'en-US',
        };
    }

    /**
     * Generate TTS audio for the given text using the specified voice.
     * @param {string} text Text to generate
     * @param {string} voiceId Voice ID
     * @returns {AsyncGenerator<Response>} Audio response generator
     */
    async* generateTts(text, voiceId) {
        if (!this.ready || !this.worker) {
            console.log('TTS not ready, initializing...');
            await this.initializeWorker();
        }

        if (!this.ready || !this.worker) {
            throw new Error('Failed to initialize TTS engine');
        }

        if (text.trim().length === 0) {
            throw new Error('Empty text');
        }

        const voice = this.getVoice(voiceId);
        const requestId = this.nextRequestId++;

        const chunkSize = 400;
        const chunks = splitRecursive(text, chunkSize, ['\n\n', '\n', '.', '?', '!', ',', ' ', '']);

        for (const chunk of chunks) {
            yield await new Promise((resolve, reject) => {
                // Store the promise callbacks
                this.pendingRequests.set(requestId, { resolve, reject });

                // Send the request to the worker
                this.worker.postMessage({
                    action: 'generateTts',
                    data: {
                        text: chunk,
                        voice: voice.voice_id,
                        speakingRate: this.settings.speakingRate || 1.0,
                        requestId,
                    },
                });
            });
        }
    }

    dispose() {
        // Clean up the worker when the provider is disposed
        if (this.worker) {
            this.worker.terminate();
            this.worker = null;
        }
    }
}
