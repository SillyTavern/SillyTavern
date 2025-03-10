import { saveTtsProviderSettings } from './index.js';

export class KokoroTtsProvider {
    constructor() {
        this.settings = {
            modelId: "onnx-community/Kokoro-82M-v1.0-ONNX",
            dtype: "q8",
            device: "wasm",
            voiceMap: {},
            defaultVoice: "af_heart",
            speakingRate: 1.0,
            volumeGainDb: 0.0
        };
        this.ready = false;
        this.voices = [
            "af_heart", "af_alloy", "af_aoede", "af_bella", "af_jessica", "af_kore", "af_nicole", "af_nova", "af_river", "af_sarah", "af_sky", "am_adam", "am_echo", "am_eric", "am_fenrir", "am_liam", "am_michael", "am_onyx", "am_puck", "am_santa", "bf_emma", "bf_isabella", "bm_george", "bm_lewis", "bf_alice", "bf_lily", "bm_daniel", "bm_fable"
        ];
        this.tts = null;
        this.separator = ' ... ... ... ';
    }

    async loadSettings(settings) {
        if (settings.modelId !== undefined) this.settings.modelId = settings.modelId;
        if (settings.dtype !== undefined) this.settings.dtype = settings.dtype;
        if (settings.device !== undefined) this.settings.device = settings.device;
        if (settings.voiceMap !== undefined) this.settings.voiceMap = settings.voiceMap;
        if (settings.defaultVoice !== undefined) this.settings.defaultVoice = settings.defaultVoice;
    }

    async checkReady() {
        try {
            if (!this.tts) {
                const { KokoroTTS } = await import('../../../lib/kokoro.web.js');
                console.log('Initializing Kokoro TTS with settings:', {
                    modelId: this.settings.modelId,
                    dtype: this.settings.dtype,
                    device: this.settings.device
                });

                // Use KokoroTTS class
                const tts = await KokoroTTS.from_pretrained(this.settings.modelId, {
                    dtype: this.settings.dtype,
                    device: this.settings.device
                });

                // Check if generate method exists
                if (typeof tts.generate !== 'function') {
                    throw new Error('TTS instance does not have generate method');
                }

                this.tts = tts;
                console.log('TTS initialized:', this.tts);
                console.log('Available methods:', Object.getOwnPropertyNames(Object.getPrototypeOf(this.tts)));
            }
            this.ready = true;
            return true;
        } catch (error) {
            console.error("Kokoro TTS initialization failed:", error);
            this.ready = false;
            return false;
        }
    }

    async onRefreshClick() {
        return await this.checkReady();
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

                <label for="kokoro_volume_gain">Volume Gain: <span id="kokoro_volume_gain_output">${this.settings.volumeGainDb}dB</span></label>
                <input id="kokoro_volume_gain" type="range" value="${this.settings.volumeGainDb}" min="-10" max="10" step="0.5" />

                <hr>
            </div>
        `;
    }

    async onSettingsChange() {
        this.settings.modelId = $('#kokoro_model_id').val();
        this.settings.dtype = $('#kokoro_dtype').val();
        this.settings.device = $('#kokoro_device').val();
        this.settings.defaultVoice = $('#kokoro_default_voice').val();
        this.settings.speakingRate = parseFloat($('#kokoro_speaking_rate').val());
        this.settings.volumeGainDb = parseFloat($('#kokoro_volume_gain').val());

        // Update UI display
        $('#kokoro_speaking_rate_output').text(this.settings.speakingRate + 'x');
        $('#kokoro_volume_gain_output').text(this.settings.volumeGainDb + 'dB');

        // Reinitialize TTS engine
        this.tts = null;
        await this.checkReady();
        saveTtsProviderSettings();

        // Update status display
        const statusText = this.ready ? 'Ready' : 'Failed';
        const statusColor = this.ready ? 'green' : 'red';
        $('#kokoro_status_text').text(statusText).css('color', statusColor);
    }

    async fetchTtsVoiceObjects() {
        if (!this.ready) {
            await this.checkReady();
        }
        return this.voices.map(voice => ({ name: voice, voice_id: voice }));
    }

    async previewTtsVoice(voiceId) {
        if (!this.ready) {
            await this.checkReady();
        }

        const previewText = "Hello";
        return await this.generateTts(previewText, voiceId);
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
            lang: actualVoiceName.startsWith('b') ? 'en-GB' : 'en-US'
        };
    }

    async generateTts(text, voiceId) {
        try {
            if (!this.ready || !this.tts) {
                console.log('TTS not ready, initializing...');
                await this.checkReady();
            }

            if (!this.ready || !this.tts) {
                throw new Error('Failed to initialize TTS engine');
            }

            const voice = this.getVoice(voiceId);
            console.log('Using voice:', voice);
            console.log('Text to speak:', text);


            if (text.trim().length === 0) {
                throw new Error('Empty text');
            }

            const audio = await this.tts.generate(text, {
                voice: voice.voice_id,
                speed: this.settings.speakingRate || 1.0
            });

            const blob = audio.toBlob()

            return new Response(blob, {
                headers: {
                    'Content-Type': 'audio/wav'
                }
            });
        } catch (error) {
            console.error("Kokoro TTS generation failed:", error);
            throw error;
        }


    }
}
