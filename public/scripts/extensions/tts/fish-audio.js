import { event_types, eventSource, getRequestHeaders } from '../../../script.js';
import { SECRET_KEYS, secret_state } from '../../secrets.js';
import { getPreviewString, initVoiceMap, saveTtsProviderSettings } from './index.js';

const IDENTIFIER = /^[A-Za-z0-9._-]{1,128}$/;
const MODELS = [
    { value: 's2.1-pro', label: 'S2.1 Pro' },
    { value: 's2.1-pro-free', label: 'S2.1 Pro (free)' },
    { value: 's2-pro', label: 'S2 Pro' },
    { value: 's1', label: 'S1' },
    { value: 'drama-3-preview', label: 'Drama 3 (preview)' },
];
const DEFAULT_MODEL = 's2.1-pro';
const LATENCY_VALUES = ['normal', 'balanced', 'low'];
const GENERATION_CONTROLS = {
    speed: { label: 'Speed', min: 0.5, max: 2, defaultValue: 1 },
    temperature: { label: 'Temperature', min: 0, max: 1, defaultValue: 0.7 },
    top_p: { label: 'Top P', min: 0, max: 1, defaultValue: 0.7 },
};
const SECRET_EVENTS = [event_types.SECRET_WRITTEN, event_types.SECRET_DELETED, event_types.SECRET_ROTATED];
const plainText = value => String(value ?? '').replace(/[<>&"'`\x00-\x1f\x7f]/g, '').trim().slice(0, 100);
const referenceId = label => String(label).match(/\[([A-Za-z0-9._-]{1,128})\]$/)?.[1];

export class FishAudioTtsProvider {
    settings;
    separator = ' . ';
    discovery = null;
    disposed = false;
    preview = null;
    audio = new Audio();
    previewUrl = null;

    get settingsHtml() {
        return `
        <div class="fish_audio_tts_settings">
            <div class="flex-container alignItemsBaseline">
                <h4 class="flex1 margin0">
                    <a href="https://fish.audio/app/api-keys" target="_blank">Fish Audio TTS Key</a>
                </h4>
                <div id="fish_audio_key" class="menu_button menu_button_icon manage-api-keys" data-key="api_key_fish_audio">
                    <i class="fa-solid fa-key"></i>
                    <span>Click to set</span>
                </div>
            </div>
            <label for="fish_audio_model">Model</label>
            <select id="fish_audio_model" class="text_pole">
                ${MODELS.map(model => `<option value="${model.value}">${model.label}</option>`).join('')}
            </select>
            <label for="fish_audio_latency">Latency</label>
            <select id="fish_audio_latency" class="text_pole">
                <option value="normal">Normal (best quality)</option>
                <option value="balanced">Balanced</option>
                <option value="low">Low</option>
            </select>
            ${Object.entries(GENERATION_CONTROLS).map(([key, control]) => `
                <label for="fish_audio_${key}">${control.label}: <span id="fish_audio_${key}_output"></span></label>
                <input id="fish_audio_${key}" type="range" value="${control.defaultValue}" min="${control.min}" max="${control.max}" step="0.01" />
            `).join('')}
            <hr>
            <div id="fish_audio_saved_voices">
                <span>Saved Voices</span><br>
                <small class="displayBlock">Your own voices load automatically. Add public or unlisted voices by reference ID. <a href="https://fish.audio/app/discovery/" target="_blank">Search for voices</a>.</small>
                <input id="fish_audio_voice_name" type="text" class="text_pole" maxlength="100" placeholder="Voice Name (optional)" aria-label="Voice Name (optional)" />
                <input id="fish_audio_voice_id" type="text" class="text_pole" maxlength="128" placeholder="Reference ID" aria-label="Reference ID" />
                <div id="fish_audio_add_voice" class="menu_button menu_button_icon">
                    <i class="fa-solid fa-plus"></i>
                    <span>Add Voice</span>
                </div>
                <div id="fish_audio_voices"></div>
                <small class="displayBlock">Removing a saved voice disables its assignments unless it is also an owned voice.</small>
            </div>
            <div id="fish_audio_status" role="status"></div>
            <small class="displayBlock">Voice previews use API credits. Expression tags such as [laughing] are preserved.</small>
            <hr>
        </div>`;
    }

    activeKey() {
        return secret_state[SECRET_KEYS.FISH_AUDIO]?.find(entry => entry.active)?.id ?? null;
    }

    async loadSettings(settings) {
        this.settings = settings;
        if (!settings.voiceMap || typeof settings.voiceMap !== 'object' || Array.isArray(settings.voiceMap)) settings.voiceMap = {};
        settings.model = MODELS.some(model => model.value === settings.model) ? settings.model : DEFAULT_MODEL;
        settings.manualVoices = (Array.isArray(settings.manualVoices) ? settings.manualVoices : [])
            .filter(voice => typeof voice?.id === 'string' && IDENTIFIER.test(voice.id))
            .map(voice => ({ id: voice.id, name: plainText(voice.name) }));
        $('#fish_audio_model').val(settings.model).on('change', () => {
            const model = String($('#fish_audio_model').val());
            if (MODELS.some(entry => entry.value === model)) settings.model = model;
            saveTtsProviderSettings();
        });
        if (!LATENCY_VALUES.includes(settings.latency)) settings.latency = 'balanced';
        $('#fish_audio_latency').val(settings.latency).on('change', () => {
            const latency = String($('#fish_audio_latency').val());
            if (LATENCY_VALUES.includes(latency)) settings.latency = latency;
            saveTtsProviderSettings();
        });
        for (const [key, { min, max, defaultValue }] of Object.entries(GENERATION_CONTROLS)) {
            const valid = value => Number.isFinite(value) && value >= min && value <= max;
            if (!valid(settings[key])) settings[key] = defaultValue;
            const output = $(`#fish_audio_${key}_output`);
            const updateOutput = () => output.text(`${settings[key].toFixed(2)}${key === 'speed' ? 'x' : ''}`);
            updateOutput();
            $(`#fish_audio_${key}`).val(settings[key]).on('input change', (event) => {
                const value = Number($(`#fish_audio_${key}`).val());
                if (valid(value)) settings[key] = value;
                updateOutput();
                if (event.type === 'change') saveTtsProviderSettings();
            });
        }
        $('#fish_audio_add_voice').on('click', () => this.addManualVoice());
        this.renderManualVoices();
        SECRET_EVENTS.forEach(event => eventSource.on(event, this.onSecretChange));
        // Start discovery even when TTS is disabled. Readiness checks share this request.
        this.fetchTtsVoiceObjects().catch(() => {});
    }

    onSecretChange = async (key) => {
        if (key !== SECRET_KEYS.FISH_AUDIO || this.disposed) return;
        this.resetDiscovery();
        this.stopPreview();
        $('#tts_voicemap_block').empty();
        await this.fetchTtsVoiceObjects().catch(() => {});
        if (!this.disposed) await initVoiceMap();
    };

    resetDiscovery() {
        this.discovery?.controller.abort();
        this.discovery = null;
    }

    async fetchTtsVoiceObjects() {
        if (this.disposed) return [];
        const key = this.activeKey();
        $('#fish_audio_key').toggleClass('success', !!key);
        if (this.discovery?.key !== key) this.resetDiscovery();
        if (!key) {
            $('#fish_audio_status').text('Set an API key to load your voices.');
            return this.voiceObjects([]);
        }
        if (!this.discovery) {
            const request = { key, controller: new AbortController(), voices: [], error: null, promise: null };
            this.discovery = request;
            $('#fish_audio_status').text('Loading Fish Audio voices…');
            request.promise = this.request('voices', undefined, request.controller.signal)
                .then(response => response.json())
                .then(data => {
                    if (!Array.isArray(data.voices)) throw new Error('Fish Audio returned an invalid voice list.');
                    request.voices = data.voices.filter(v => typeof v?.id === 'string' && IDENTIFIER.test(v.id));
                    return data.complete ? `${request.voices.length} owned voice${request.voices.length === 1 ? '' : 's'} loaded.` : 'Only part of your voice list was returned. You can add missing reference IDs above.';
                }).catch(error => {
                    request.error = error;
                    return `Could not load owned voices: ${plainText(error.message)} Use Refresh to try again.`;
                }).then(message => {
                    if (this.discovery === request && this.activeKey() === key && !this.disposed) $('#fish_audio_status').text(message);
                });
        }
        const request = this.discovery;
        await request.promise;
        // A response from the previous key must never repopulate the current voice list.
        if (this.discovery !== request || this.activeKey() !== key) return this.fetchTtsVoiceObjects();
        if (request.error?.status < 500) throw request.error;
        return this.voiceObjects(request.voices);
    }

    voiceObjects(owned) {
        const voices = new Map();
        for (const voice of [...owned, ...this.settings.manualVoices]) {
            voices.set(voice.id, { name: `${plainText(voice.name) || 'Voice'} [${voice.id}]`, voice_id: voice.id, lang: 'en-US', preview_url: false });
        }
        // SillyTavern stores labels, not IDs. Retain assigned labels across title changes and refreshes.
        const assigned = new Map();
        for (const label of Object.values(this.settings.voiceMap)) {
            const id = referenceId(label);
            if (!id) continue;
            voices.delete(id);
            assigned.set(label, { name: label, voice_id: id, lang: 'en-US', preview_url: false });
        }
        return [...voices.values(), ...assigned.values()].sort((a, b) => a.name.localeCompare(b.name));
    }

    async addManualVoice() {
        const id = String($('#fish_audio_voice_id').val()).trim();
        if (!IDENTIFIER.test(id)) {
            toastr.warning('Enter a reference ID using letters, numbers, dots, underscores, or hyphens.');
            return;
        }
        if (this.settings.manualVoices.some(voice => voice.id === id)) {
            toastr.warning('That reference ID is already saved.');
            return;
        }
        const name = plainText($('#fish_audio_voice_name').val()) || id;
        $('#fish_audio_voice_name, #fish_audio_voice_id').val('');
        await this.saveManualVoices([...this.settings.manualVoices, { id, name }]);
    }

    async saveManualVoices(voices) {
        const ids = new Set(voices.map(voice => voice.id));
        const removed = new Set(this.settings.manualVoices.map(v => v.id).filter(id => !ids.has(id) && !this.discovery?.voices.some(v => v.id === id)));
        for (const [character, label] of Object.entries(this.settings.voiceMap)) {
            if (removed.has(referenceId(label))) this.settings.voiceMap[character] = 'disabled';
        }
        this.settings.manualVoices = voices;
        this.renderManualVoices();
        saveTtsProviderSettings({ syncVoiceMapFromUi: false });
        await initVoiceMap();
    }

    renderManualVoices() {
        const list = $('#fish_audio_voices').empty();
        for (const voice of this.settings.manualVoices) {
            const row = $('<div>').addClass('flex-container alignItemsCenter');
            row.append($('<span>').addClass('flex1').text(`${voice.name || 'Voice'} [${voice.id}]`));
            const remove = $('<div>').addClass('menu_button menu_button_icon').attr('title', 'Remove saved voice');
            remove.append($('<i>').addClass('fa-solid fa-trash'));
            remove.on('click', () => this.saveManualVoices(this.settings.manualVoices.filter(v => v.id !== voice.id)));
            list.append(row.append(remove));
        }
    }

    async checkReady() {
        if (!this.activeKey()) throw new Error('Set a Fish Audio API key first.');
        await this.fetchTtsVoiceObjects();
    }

    async onRefreshClick() {
        this.resetDiscovery();
        await this.checkReady();
    }

    async getVoice(name) {
        const voices = await this.fetchTtsVoiceObjects();
        const voice = voices.find(voice => voice.name === name || voice.voice_id === name);
        if (!voice) throw new Error('Fish Audio voice not found. Refresh or add its reference ID.');
        return voice;
    }

    async request(route, body, signal) {
        const response = await fetch(`/api/speech/fish-audio/${route}`, {
            method: 'POST', headers: getRequestHeaders(), body: body ? JSON.stringify(body) : undefined, signal,
        });
        if (!response.ok) {
            const data = await response.json().catch(() => null);
            throw Object.assign(new Error(plainText(data?.error) || `Fish Audio HTTP ${response.status}`), { status: response.status });
        }
        return response;
    }

    async generateTts(text, voiceId, voiceMapKeyOrSignal) {
        if (!this.activeKey()) throw new Error('Set a Fish Audio API key first.');
        // Shared narration passes a character mapping key; previews pass an AbortSignal.
        const signal = voiceMapKeyOrSignal instanceof AbortSignal ? voiceMapKeyOrSignal : undefined;
        const { model, latency, speed, temperature, top_p } = this.settings;
        return this.request('synthesize', { text, reference_id: voiceId, model, latency, speed, temperature, top_p }, signal);
    }

    stopPreview() {
        this.preview?.abort();
        this.preview = null;
        this.audio.onended = this.audio.onerror = null;
        this.audio.pause();
        this.audio.removeAttribute('src');
        if (this.previewUrl) URL.revokeObjectURL(this.previewUrl);
        this.previewUrl = null;
    }

    async previewTtsVoice(id) {
        this.stopPreview();
        const controller = new AbortController();
        this.preview = controller;
        try {
            const voice = await this.getVoice(id);
            const response = await this.generateTts(getPreviewString(voice.lang), voice.voice_id, controller.signal);
            const audio = await response.blob();
            if (controller.signal.aborted || this.disposed) return;
            this.previewUrl = URL.createObjectURL(audio);
            this.audio.src = this.previewUrl;
            this.audio.onended = () => this.stopPreview();
            this.audio.onerror = () => {
                this.stopPreview();
                toastr.error('Could not play the Fish Audio preview.');
            };
            await this.audio.play();
        } catch (error) {
            if (controller.signal.aborted) return;
            this.stopPreview();
            toastr.error(plainText(error.message), 'Fish Audio preview failed');
        }
    }

    dispose() {
        this.disposed = true;
        this.resetDiscovery();
        this.stopPreview();
        SECRET_EVENTS.forEach(event => eventSource.removeListener(event, this.onSecretChange));
    }
}
