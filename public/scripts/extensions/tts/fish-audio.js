import { event_types, eventSource, getRequestHeaders } from '../../../script.js';
import { SECRET_KEYS, secret_state } from '../../secrets.js';
import { getPreviewString, initVoiceMap, saveTtsProviderSettings } from './index.js';

export { FishAudioTtsProvider };

const SAFE_IDENTIFIER = /^[A-Za-z0-9._-]+$/;
const ALLOWED_LATENCY_VALUES = new Set(['low', 'normal', 'balanced']);
const LANGUAGE_LOCALES = {
    ar: 'ar-SA',
    de: 'de-DE',
    en: 'en-US',
    es: 'es-ES',
    fr: 'fr-FR',
    hi: 'hi-IN',
    it: 'it-IT',
    ja: 'ja-JP',
    ko: 'ko-KR',
    pt: 'pt-BR',
    ru: 'ru-RU',
    zh: 'zh-CN',
};

class FishAudioTtsProvider {
    settings;
    voices = [];
    ownedVoiceIds = new Set();
    ownedVoicesLoaded = false;
    separator = ' . ';
    audioElement = document.createElement('audio');
    previewUrl = null;
    previewCleanup = null;
    previewRequestId = 0;

    defaultSettings = {
        voiceMap: {},
        manualVoices: [],
        model: 's2.1-pro',
        latency: 'balanced',
        speed: 1,
        temperature: 0.7,
        top_p: 0.7,
    };

    get settingsHtml() {
        return `
        <div class="fish_audio_tts_settings">
            <div class="flex-container alignItemsBaseline">
                <h4 class="flex1 margin0">
                    <a href="https://fish.audio/app/api-keys" target="_blank">Fish Audio API Key</a>
                </h4>
                <div id="fish_audio_tts_key" class="menu_button menu_button_icon manage-api-keys" data-key="api_key_fish_audio">
                    <i class="fa-solid fa-key"></i>
                    <span>Click to set</span>
                </div>
            </div>
            <label for="fish_audio_tts_model">Model</label>
            <small>Select a suggested Fish Audio model or enter a custom model identifier.</small>
            <input id="fish_audio_tts_model" class="text_pole" type="text" list="fish_audio_tts_models" maxlength="256" />
            <datalist id="fish_audio_tts_models">
                <option value="s2.1-pro" label="Recommended production model"></option>
                <option value="s2-pro" label="Previous-generation S2 model"></option>
            </datalist>
            <label for="fish_audio_tts_latency">Latency</label>
            <select id="fish_audio_tts_latency" class="text_pole">
                <option value="balanced">Balanced</option>
                <option value="normal">Normal</option>
                <option value="low">Low</option>
            </select>
            <label for="fish_audio_tts_speed">Speed: <span id="fish_audio_tts_speed_output"></span></label>
            <input id="fish_audio_tts_speed" type="range" min="0.5" max="2" step="0.05" />
            <label for="fish_audio_tts_temperature">Temperature: <span id="fish_audio_tts_temperature_output"></span></label>
            <input id="fish_audio_tts_temperature" type="range" min="0" max="1" step="0.05" />
            <label for="fish_audio_tts_top_p">Top P: <span id="fish_audio_tts_top_p_output"></span></label>
            <input id="fish_audio_tts_top_p" type="range" min="0" max="1" step="0.05" />
            <hr>
            <label>Saved reference IDs</label>
            <small>Add public or unlisted Fish Audio voices that are not returned with your owned voices.</small>
            <input id="fish_audio_manual_voice_name" class="text_pole" type="text" maxlength="256" placeholder="Display name (optional)" />
            <input id="fish_audio_manual_voice_id" class="text_pole" type="text" maxlength="256" placeholder="Fish Audio reference ID" />
            <div id="fish_audio_add_manual_voice" class="menu_button menu_button_icon">
                <i class="fa-solid fa-plus"></i>
                <span>Add reference ID</span>
            </div>
            <div id="fish_audio_manual_voices"></div>
            <hr>
        </div>`;
    }

    constructor() {
        this.secretHandler = async (/** @type {string} */ key) => {
            if (key !== SECRET_KEYS.FISH_AUDIO) return;
            $('#fish_audio_tts_key').toggleClass('success', !!secret_state[SECRET_KEYS.FISH_AUDIO]);
            if (!secret_state[SECRET_KEYS.FISH_AUDIO]) {
                this.voices = [];
                this.ownedVoiceIds.clear();
                this.ownedVoicesLoaded = false;
                $('#tts_voicemap_block').empty();
                // The first call may be reusing an initialization that began before the secret was deleted.
                await initVoiceMap(true);
                $('#tts_voicemap_block').empty();
                await initVoiceMap(true);
                return;
            }
            try {
                await this.onRefreshClick();
            } catch (error) {
                console.warn('Fish Audio TTS refresh failed:', error);
            } finally {
                await initVoiceMap(true);
            }
        };
    }

    cleanupActivePreview() {
        const cleanup = this.previewCleanup;
        this.previewCleanup = null;
        this.audioElement.onended = null;
        this.audioElement.onerror = null;
        if (typeof cleanup === 'function') {
            cleanup();
        } else if (this.previewUrl) {
            URL.revokeObjectURL(this.previewUrl);
            this.previewUrl = null;
            this.audioElement.removeAttribute('src');
        }
    }

    dispose() {
        [event_types.SECRET_WRITTEN, event_types.SECRET_DELETED, event_types.SECRET_ROTATED].forEach(event => {
            eventSource.removeListener(event, this.secretHandler);
        });
        this.previewRequestId++;
        this.audioElement.pause();
        this.cleanupActivePreview();
        this.audioElement.removeAttribute('src');
    }

    async loadSettings(settings) {
        this.settings = structuredClone(this.defaultSettings);

        for (const key in settings) {
            if (key in this.settings) {
                this.settings[key] = settings[key];
            } else {
                throw new Error(`Invalid setting passed to Fish Audio TTS Provider: ${key}`);
            }
        }

        if (!Array.isArray(this.settings.manualVoices)) {
            this.settings.manualVoices = [];
        }
        this.settings.manualVoices = [...new Map(this.settings.manualVoices
            .filter(voice => voice && typeof voice === 'object' && typeof voice.voice_id === 'string' && SAFE_IDENTIFIER.test(voice.voice_id))
            .map(voice => [voice.voice_id, {
                name: this.sanitizeDisplayText(voice.name) || `Manual ${this.getShortId(voice.voice_id)}`,
                voice_id: voice.voice_id,
            }])).values()];
        if (!this.settings.voiceMap || typeof this.settings.voiceMap !== 'object') {
            this.settings.voiceMap = {};
        }
        if (typeof this.settings.model !== 'string' || !SAFE_IDENTIFIER.test(this.settings.model)) {
            this.settings.model = this.defaultSettings.model;
        }
        if (!ALLOWED_LATENCY_VALUES.has(this.settings.latency)) {
            this.settings.latency = this.defaultSettings.latency;
        }
        if (!this.isNumberInRange(this.settings.speed, 0.5, 2)) {
            this.settings.speed = this.defaultSettings.speed;
        }
        if (!this.isNumberInRange(this.settings.temperature, 0, 1)) {
            this.settings.temperature = this.defaultSettings.temperature;
        }
        if (!this.isNumberInRange(this.settings.top_p, 0, 1)) {
            this.settings.top_p = this.defaultSettings.top_p;
        }

        $('#fish_audio_tts_key').toggleClass('success', !!secret_state[SECRET_KEYS.FISH_AUDIO]);
        [event_types.SECRET_WRITTEN, event_types.SECRET_DELETED, event_types.SECRET_ROTATED].forEach(event => {
            eventSource.on(event, this.secretHandler);
        });

        $('#fish_audio_tts_model').val(this.settings.model).on('input', () => this.onSettingsChange());
        $('#fish_audio_tts_latency').val(this.settings.latency).on('change', () => this.onSettingsChange());
        $('#fish_audio_tts_speed').val(this.settings.speed).on('input', () => this.onSettingsChange());
        $('#fish_audio_tts_temperature').val(this.settings.temperature).on('input', () => this.onSettingsChange());
        $('#fish_audio_tts_top_p').val(this.settings.top_p).on('input', () => this.onSettingsChange());
        $('#fish_audio_add_manual_voice').on('click', () => this.addManualVoice());
        this.updateSettingsOutputs();
        this.renderManualVoices();

        try {
            await this.checkReady();
            console.debug('Fish Audio TTS: Settings loaded');
        } catch {
            console.debug('Fish Audio TTS: Settings loaded, but not ready');
        }
    }

    onSettingsChange() {
        this.settings.model = String($('#fish_audio_tts_model').val()).trim();
        this.settings.latency = String($('#fish_audio_tts_latency').val());
        this.settings.speed = Number($('#fish_audio_tts_speed').val());
        this.settings.temperature = Number($('#fish_audio_tts_temperature').val());
        this.settings.top_p = Number($('#fish_audio_tts_top_p').val());
        this.updateSettingsOutputs();
        saveTtsProviderSettings();
    }

    updateSettingsOutputs() {
        $('#fish_audio_tts_speed_output').text(this.settings.speed);
        $('#fish_audio_tts_temperature_output').text(this.settings.temperature);
        $('#fish_audio_tts_top_p_output').text(this.settings.top_p);
    }

    async addManualVoice() {
        const voiceId = String($('#fish_audio_manual_voice_id').val()).trim();
        const voiceName = String($('#fish_audio_manual_voice_name').val()).trim();

        if (!voiceId || !SAFE_IDENTIFIER.test(voiceId)) {
            toastr.warning('Enter a valid Fish Audio reference ID using letters, numbers, dots, underscores, or hyphens.');
            return;
        }
        if (this.settings.manualVoices.some(voice => voice.voice_id === voiceId)) {
            toastr.warning('That Fish Audio reference ID is already saved.');
            return;
        }
        if (this.ownedVoiceIds.has(voiceId)) {
            toastr.warning('That Fish Audio reference ID is already available as an owned voice.');
            return;
        }

        this.settings.manualVoices.push({
            name: this.sanitizeDisplayText(voiceName) || `Manual ${this.getShortId(voiceId)}`,
            voice_id: voiceId,
        });
        this.voices = [];
        $('#fish_audio_manual_voice_id').val('');
        $('#fish_audio_manual_voice_name').val('');
        this.renderManualVoices();
        saveTtsProviderSettings();
        await initVoiceMap(true);
    }

    async removeManualVoice(voiceId) {
        const manualVoice = this.settings.manualVoices.find(voice => voice.voice_id === voiceId);
        if (!manualVoice) return;

        const isOwnedVoice = this.ownedVoiceIds.has(voiceId);
        if (!isOwnedVoice) {
            const baseName = `${this.sanitizeDisplayText(manualVoice.name) || 'Manual'} (${this.getShortId(voiceId)})`;
            const mappedNames = new Set([baseName, `${baseName} [${voiceId}]`]);
            const cachedVoice = this.voices.find(voice => voice.voice_id === voiceId);
            if (cachedVoice) mappedNames.add(cachedVoice.name);

            for (const key of Object.keys(this.settings.voiceMap)) {
                if (mappedNames.has(this.settings.voiceMap[key])) {
                    delete this.settings.voiceMap[key];
                }
            }
        }

        this.settings.manualVoices = this.settings.manualVoices.filter(voice => voice.voice_id !== voiceId);
        this.voices = [];
        this.renderManualVoices();
        saveTtsProviderSettings(false);
        await initVoiceMap(true);
    }

    renderManualVoices() {
        const container = $('#fish_audio_manual_voices').empty();

        for (const voice of this.settings.manualVoices) {
            const row = $('<div>').addClass('flex-container alignItemsCenter');
            const label = $('<span>').addClass('flex1').text(`${voice.name} (${voice.voice_id})`);
            const removeButton = $('<div>').addClass('menu_button menu_button_icon').attr('title', 'Remove saved reference ID');
            removeButton.append($('<i>').addClass('fa-solid fa-trash'));
            removeButton.on('click', () => this.removeManualVoice(voice.voice_id));
            row.append(label, removeButton);
            container.append(row);
        }
    }

    async checkReady() {
        if (!secret_state[SECRET_KEYS.FISH_AUDIO]) {
            this.voices = [];
            this.ownedVoiceIds.clear();
            this.ownedVoicesLoaded = false;
            throw new Error('Fish Audio API key not set');
        }
        await this.fetchTtsVoiceObjects();
    }

    async onRefreshClick() {
        this.voices = [];
        this.ownedVoiceIds.clear();
        this.ownedVoicesLoaded = false;
        await this.checkReady();
    }

    async getVoice(voiceName) {
        if (this.voices.length === 0) {
            await this.fetchTtsVoiceObjects();
        }

        let voice = this.voices.find(item => item.name === voiceName || item.voice_id === voiceName);
        if (!voice) {
            const idSuffix = String(voiceName).match(/(?:\(([^()]+)\)|\[([A-Za-z0-9._-]+)\])$/)?.slice(1).find(Boolean);
            const idMatches = idSuffix ? this.voices.filter(item => item.voice_id.startsWith(idSuffix)) : [];
            voice = idMatches.length === 1 ? idMatches[0] : null;
        }
        if (!voice) {
            throw new Error(`Fish Audio voice not found: ${voiceName}`);
        }
        return voice;
    }

    async generateTts(text, voiceId) {
        return await this.fetchTtsGeneration(text, voiceId);
    }

    async fetchTtsVoiceObjects() {
        if (!secret_state[SECRET_KEYS.FISH_AUDIO]) {
            throw new Error('Fish Audio API key not set');
        }
        if (this.voices.length > 0) {
            return this.voices;
        }

        const response = await fetch('/api/speech/fish-audio/voices', {
            method: 'POST',
            headers: getRequestHeaders({ omitContentType: true }),
        });
        if (!response.ok) {
            const error = await this.getResponseError(response);
            const isTransientServerFailure = response.status >= 500 && response.status < 600;
            if (isTransientServerFailure && this.settings.manualVoices.length > 0) {
                console.warn(`Fish Audio owned voices could not be loaded; using saved reference IDs: ${error}`);
                this.ownedVoiceIds.clear();
                this.ownedVoicesLoaded = false;
                this.voices = this.normalizeVoices([]);
                return this.voices;
            }
            throw new Error(error);
        }

        const data = await response.json();
        const ownedVoices = Array.isArray(data.voices) ? data.voices : [];
        this.ownedVoiceIds = new Set(ownedVoices.map(voice => String(voice?._id || '').trim()).filter(voiceId => SAFE_IDENTIFIER.test(voiceId)));
        this.ownedVoicesLoaded = true;
        this.voices = this.normalizeVoices(ownedVoices);
        return this.voices;
    }

    normalizeVoices(ownedVoices) {
        const voicesById = new Map();

        for (const voice of ownedVoices) {
            const voiceId = String(voice?._id || '').trim();
            if (!voiceId) continue;
            if (!SAFE_IDENTIFIER.test(voiceId)) continue;
            const title = this.sanitizeDisplayText(voice.title) || 'Voice';
            voicesById.set(voiceId, {
                name: `${title} (${this.getShortId(voiceId)})`,
                voice_id: voiceId,
                lang: this.getPreviewLanguage(voice.languages),
                preview_url: false,
            });
        }

        for (const voice of this.settings.manualVoices) {
            const voiceId = String(voice?.voice_id || '').trim();
            if (!voiceId || voicesById.has(voiceId)) continue;
            if (!SAFE_IDENTIFIER.test(voiceId)) continue;
            const name = this.sanitizeDisplayText(voice.name) || 'Manual';
            voicesById.set(voiceId, {
                name: `${name} (${this.getShortId(voiceId)})`,
                voice_id: voiceId,
                lang: '',
                preview_url: false,
            });
        }

        const voices = [...voicesById.values()];
        const nameCounts = new Map();
        for (const voice of voices) {
            nameCounts.set(voice.name, (nameCounts.get(voice.name) || 0) + 1);
        }
        for (const voice of voices) {
            if (nameCounts.get(voice.name) > 1) {
                voice.name = `${voice.name} [${voice.voice_id}]`;
            }
        }

        return voices.sort((a, b) => a.name.localeCompare(b.name));
    }

    isNumberInRange(value, minimum, maximum) {
        return typeof value === 'number' && Number.isFinite(value) && value >= minimum && value <= maximum;
    }

    sanitizeDisplayText(value) {
        return String(value || '').replace(/[<>&"'`]/g, '').replace(/[\u0000-\u001F\u007F]/g, ' ').trim();
    }

    getPreviewLanguage(languages) {
        if (!Array.isArray(languages) || languages.length === 0) return '';
        const language = this.sanitizeDisplayText(languages[0]);
        return LANGUAGE_LOCALES[language] || language;
    }

    getShortId(voiceId) {
        return String(voiceId).slice(0, 8);
    }

    async previewTtsVoice(voiceId) {
        const requestId = ++this.previewRequestId;
        let cleanupCreatedPreview = () => {};
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
        this.cleanupActivePreview();

        try {
            const voice = await this.getVoice(voiceId);
            const response = await this.fetchTtsGeneration(getPreviewString(voice.lang), voice.voice_id);
            const audio = await response.blob();
            const previewUrl = URL.createObjectURL(audio);

            if (requestId !== this.previewRequestId) {
                URL.revokeObjectURL(previewUrl);
                return;
            }

            this.previewUrl = previewUrl;
            this.audioElement.src = previewUrl;
            let revoked = false;
            cleanupCreatedPreview = () => {
                if (revoked) return;
                revoked = true;
                URL.revokeObjectURL(previewUrl);
                if (this.previewUrl === previewUrl) {
                    this.previewUrl = null;
                    this.previewCleanup = null;
                    this.audioElement.removeAttribute('src');
                }
            };
            this.previewCleanup = cleanupCreatedPreview;
            this.audioElement.onended = cleanupCreatedPreview;
            this.audioElement.onerror = cleanupCreatedPreview;
            await this.audioElement.play();
        } catch (error) {
            cleanupCreatedPreview();
            if (requestId !== this.previewRequestId) return;
            toastr.error(String(error), 'Fish Audio TTS Preview Failed');
            console.error('Fish Audio TTS preview failed:', error);
        }
    }

    async fetchTtsGeneration(text, voiceId) {
        if (!secret_state[SECRET_KEYS.FISH_AUDIO]) {
            throw new Error('Fish Audio API key not set');
        }
        if (!this.settings.model || !SAFE_IDENTIFIER.test(this.settings.model)) {
            throw new Error('Enter a valid Fish Audio model using letters, numbers, dots, underscores, or hyphens');
        }

        const response = await fetch('/api/speech/fish-audio/synthesize', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                text: text,
                reference_id: voiceId,
                model: this.settings.model,
                latency: this.settings.latency,
                speed: this.settings.speed,
                temperature: this.settings.temperature,
                top_p: this.settings.top_p,
            }),
        });
        if (!response.ok) {
            throw new Error(await this.getResponseError(response));
        }

        return response;
    }

    async getResponseError(response) {
        const responseText = await response.text();
        try {
            const responseJson = JSON.parse(responseText);
            return responseJson?.error || responseJson?.message || `HTTP ${response.status}`;
        } catch {
            return responseText || `HTTP ${response.status}`;
        }
    }
}
