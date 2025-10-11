import { event_types, eventSource, getRequestHeaders } from '../../../script.js';
import { SECRET_KEYS, secret_state } from '../../secrets.js';
import { getPreviewString, saveTtsProviderSettings, initVoiceMap } from './index.js';

export { megaNovaAITtsProvider };

class megaNovaAITtsProvider {
    settings;
    voices = [];
    models = [];
    separator = ' . ';
    audioElement = document.createElement('audio');

    defaultSettings = {
        voiceMap: {},
        model: 'tts-1',
        speed: 1,
        temperature: 1,
        top_p: 1,
        // GPT-4o Mini TTS
        instructions: '',
        // Dia
        speaker_transcript: '',
        cfg_filter_top_k: 25,
        cfg_scale: 3,
        // Microsoft TTS
        speech_rate: 0,
        pitch_adjustment: 0,
        emotional_style: '',
    };

    get settingsHtml() {
        let html = `
        <div>MegaNova AI unified TTS API.</div>
        <div class="flex-container alignItemsCenter">
            <div class="flex1"></div>
            <div id="meganovaai_tts_key" class="menu_button menu_button_icon manage-api-keys" data-key="api_key_meganovaai">
                <i class="fa-solid fa-key"></i>
                <span>API Key</span>
            </div>
        </div>
        <div class="flex-container flexGap10 wrap">
            <div class="flex1">
                <label for="meganovaai_tts_model">Model</label>
                <select id="meganovaai_tts_model" class="text_pole"></select>
            </div>
            <div>
                <label for="meganovaai_tts_speed">Speed <span id="meganovaai_tts_speed_output"></span></label>
                <input type="range" id="meganovaai_tts_speed" value="1" min="0.25" max="4" step="0.05">
            </div>
            <div>
                <label for="meganovaai_tts_temperature">Temperature</label>
                <input id="meganovaai_tts_temperature" class="text_pole" type="number" min="0" max="2" step="0.1" value="1" />
            </div>
            <div id="meganovaai_block_top_p" style="display:none;">
                <label for="meganovaai_tts_top_p">Top-p</label>
                <input id="meganovaai_tts_top_p" class="text_pole" type="number" min="0" max="1" step="0.01" value="1" />
            </div>
        </div>

        <div id="meganovaai_block_instructions" style="display:none;">
            <label for="meganovaai_tts_instructions">Instructions (GPT-4o Mini TTS):</label>
            <textarea id="meganovaai_tts_instructions" class="textarea_compact autoSetHeight" placeholder="e.g., 'Speak cheerfully and energetically'"></textarea>
        </div>

        <div id="meganovaai_block_dia" style="display:none;">
            <label for="meganovaai_tts_speaker_transcript">Speaker transcript (Dia):</label>
            <textarea id="meganovaai_tts_speaker_transcript" class="textarea_compact autoSetHeight" maxlength="1000"></textarea>
            <label for="meganovaai_tts_cfg_scale">CFG scale (1-5):</label>
            <input id="meganovaai_tts_cfg_scale" type="number" min="1" max="5" step="1" />
            <label for="meganovaai_tts_cfg_topk">CFG filter top_k (15-50):</label>
            <input id="meganovaai_tts_cfg_topk" type="number" min="15" max="50" step="1" />
        </div>

        <div id="meganovaai_block_msft" style="display:none;">
            <div class="flex-container flexGap10 wrap">
                <div>
                    <label for="meganovaai_tts_speech_rate">Speech rate (-100..100)</label>
                    <input id="meganovaai_tts_speech_rate" class="text_pole" type="number" min="-100" max="100" step="1" style="width:120px;" />
                </div>
                <div>
                    <label for="meganovaai_tts_pitch_adjustment">Pitch adjustment (-100..100)</label>
                    <input id="meganovaai_tts_pitch_adjustment" class="text_pole" type="number" min="-100" max="100" step="1" style="width:120px;" />
                </div>
            </div>
            <div class="flex-container flexGap10">
                <div class="flex1">
                    <label for="meganovaai_tts_emotional_style">Emotional style</label>
                    <input id="meganovaai_tts_emotional_style" class="text_pole" type="text" placeholder="cheerful, sad, angry, gentle..." />
                </div>
            </div>
        </div>

        <div id="meganovaai_dynamic_params" class="flex-container flexGap10 wrap" style="display:none;"></div>`;
        return html;
    }

    constructor() {
        this.handler = async function (/** @type {string} */ key) {
            if (key !== SECRET_KEYS.MEGANOVAAI) return;
            $('#meganovaai_tts_key').toggleClass('success', !!secret_state[SECRET_KEYS.MEGANOVAAI]);
            await this.onRefreshClick();
        }.bind(this);
    }

    dispose() {
        [event_types.SECRET_WRITTEN, event_types.SECRET_DELETED, event_types.SECRET_ROTATED].forEach(event => {
            eventSource.removeListener(event, this.handler);
        });
    }

    async loadSettings(settings) {
        if (Object.keys(settings).length == 0) {
            console.info('Using default MegaNova AI TTS settings');
        }

        this.settings = { ...this.defaultSettings, ...settings };

        await this.loadModels();
        this.populateModelSelect();
        console.log('eeeeee:', this.settings.model)
        $('#meganovaai_tts_model').val(this.settings.model);
        $('#meganovaai_tts_model').on('change', () => { this.onSettingsChange(); });

        $('#meganovaai_tts_speed').val(this.settings.speed);
        $('#meganovaai_tts_speed_output').text(this.settings.speed);
        $('#meganovaai_tts_speed').on('input', () => { this.onSettingsChange(); });

        $('#meganovaai_tts_temperature').val(this.settings.temperature);
        $('#meganovaai_tts_temperature').on('input', () => { this.onSettingsChange(); });

        $('#meganovaai_tts_top_p').val(this.settings.top_p);
        $('#meganovaai_tts_top_p').on('input', () => { this.onSettingsChange(); });

        $('#meganovaai_tts_instructions').val(this.settings.instructions);
        $('#meganovaai_tts_instructions').on('input', () => { this.onSettingsChange(); });

        $('#meganovaai_tts_speaker_transcript').val(this.settings.speaker_transcript);
        $('#meganovaai_tts_speaker_transcript').on('input', () => { this.onSettingsChange(); });
        $('#meganovaai_tts_cfg_scale').val(this.settings.cfg_scale);
        $('#meganovaai_tts_cfg_scale').on('input', () => { this.onSettingsChange(); });
        $('#meganovaai_tts_cfg_topk').val(this.settings.cfg_filter_top_k);
        $('#meganovaai_tts_cfg_topk').on('input', () => { this.onSettingsChange(); });

        $('#meganovaai_tts_speech_rate').val(this.settings.speech_rate);
        $('#meganovaai_tts_speech_rate').on('input', () => { this.onSettingsChange(); });
        $('#meganovaai_tts_pitch_adjustment').val(this.settings.pitch_adjustment);
        $('#meganovaai_tts_pitch_adjustment').on('input', () => { this.onSettingsChange(); });
        $('#meganovaai_tts_emotional_style').val(this.settings.emotional_style);
        $('#meganovaai_tts_emotional_style').on('input', () => { this.onSettingsChange(); });

        $('#meganovaai_tts_key').toggleClass('success', !!secret_state[SECRET_KEYS.MEGANOVAAI]);
        [event_types.SECRET_WRITTEN, event_types.SECRET_DELETED, event_types.SECRET_ROTATED].forEach(event => {
            eventSource.on(event, this.handler);
        });

        await this.checkReady();
        this.updateConditionalBlocks();
        this.renderDynamicParams();
        console.debug('MegaNova AI TTS: Settings loaded');
    }

    async onSettingsChange() {
        const previousModel = this.settings.model;
        this.settings.model = String($('#meganovaai_tts_model').find(':selected').val() || this.settings.model);
        this.settings.speed = Number($('#meganovaai_tts_speed').val());
        $('#meganovaai_tts_speed_output').text(this.settings.speed);
        this.settings.temperature = Number($('#meganovaai_tts_temperature').val());
        this.settings.top_p = Number($('#meganovaai_tts_top_p').val());
        this.settings.instructions = String($('#meganovaai_tts_instructions').val() || '');
        this.settings.speaker_transcript = String($('#meganovaai_tts_speaker_transcript').val() || '');
        this.settings.cfg_scale = Number($('#meganovaai_tts_cfg_scale').val());
        this.settings.cfg_filter_top_k = Number($('#meganovaai_tts_cfg_topk').val());
        this.settings.speech_rate = Number($('#meganovaai_tts_speech_rate').val());
        this.settings.pitch_adjustment = Number($('#meganovaai_tts_pitch_adjustment').val());
        this.settings.emotional_style = String($('#meganovaai_tts_emotional_style').val() || '');
        this.updateConditionalBlocks();
        this.renderDynamicParams();
        saveTtsProviderSettings();
        if (previousModel !== this.settings.model) {
            this.voices = await this.fetchTtsVoiceObjects();
            await initVoiceMap();
        }
    }

    async loadModels() {
        try {
            const response = await fetch('/api/sd/meganovaai/models', {
                method: 'POST',
                headers: getRequestHeaders(),
            });
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${await response.text()}`);
            }
            /** @type {Array<any>} */
            const data = await response.json();
            const allModels = Array.isArray(data) ? data : [];
            const ttsModels = allModels.filter(m => {
                const eps = Array.isArray(m?.endpoints) ? m.endpoints : [];
                return eps.some(ep => {
                    if (typeof ep !== 'string') return false;
                    return ep === '/v1/audio/speech' || ep.endsWith('/audio/speech') || ep === 'audio/speech';
                });
            });

            this.models = ttsModels;

            if (this.models.length > 0 && !this.models.find(m => m.id === this.settings.model)) {
                this.settings.model = this.models[0].id;
                saveTtsProviderSettings();
            }
        } catch (err) {
            console.warn('MegaNova AI models fetch failed', err);
            this.models = [];
        }
    }

    populateModelSelect() {
        const select = $('#meganovaai_tts_model');
        select.empty();
        const groups = this.groupByVendor(this.models);
        for (const [vendor, models] of groups.entries()) {
            const optgroup = document.createElement('optgroup');
            optgroup.label = vendor;
            for (const m of models) {
                const opt = document.createElement('option');
                opt.value = m.id;
                opt.text = m.name || m.id;
                optgroup.appendChild(opt);
            }
            select.append(optgroup);
        }

        if (this.models.find(x => x.id === this.settings.model)) {
            select.val(this.settings.model);
        }
    }

    /**
     * Group models by vendor prefix from name before ':'
     * @param {Array<any>} array
     * @returns {Map<string, any[]>}
     */
    groupByVendor(array) {
        return array.reduce((acc, curr) => {
            const name = String(curr?.name || curr?.id || 'Other');
            const vendor = name.split(':')[0].trim() || 'Other';
            if (!acc.has(vendor)) acc.set(vendor, []);
            acc.get(vendor).push(curr);
            return acc;
        }, new Map());
    }

    updateConditionalBlocks() {
        const modelId = this.settings.model;
        const model = this.models.find(m => m.id === modelId);
        const params = model?.parameters || {};
        const vendorName = String(model?.name || '').split(':')[0].trim().toLowerCase();

        const hasInstructions = 'instructions' in params || modelId === 'gpt-4o-mini-tts';
        const hasDia = 'speaker_transcript' in params || 'cfg_scale' in params || 'cfg_filter_top_k' in params || modelId.includes('dia');

        const hasMsft = 'speech_rate' in params || 'pitch_adjustment' in params || 'emotional_style' in params || vendorName === 'microsoft' || modelId === 'microsoft-tts';
        const hasTopP = 'top_p' in params;

        $('#meganovaai_block_instructions').toggle(!!hasInstructions);
        $('#meganovaai_block_dia').toggle(!!hasDia);
        $('#meganovaai_block_msft').toggle(!!hasMsft);
        $('#meganovaai_block_top_p').toggle(!!hasTopP);
    }

    /**
     * Build UI for additional model parameters dynamically
     */
    renderDynamicParams() {
        const container = $('#meganovaai_dynamic_params');
        container.empty();
        const model = this.models.find(m => m.id === this.settings.model);
        const params = model?.parameters || {};
        const modelHasVoices = Array.isArray(model?.voices) && model.voices.length > 0;
        const exclude = new Set(['input', 'response_format', 'model', 'speed', 'temperature', 'top_p', 'instructions', 'speaker_transcript', 'cfg_scale', 'cfg_filter_top_k', 'speech_rate', 'pitch_adjustment', 'emotional_style']);
        if (modelHasVoices) exclude.add('voice');

        const entries = Object.entries(params).filter(([k]) => !exclude.has(k));
        container.toggle(entries.length > 0);
        if (entries.length === 0) return;

        for (const [key, spec] of entries) {
            const nice = key.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
            const type = String(spec?.type || 'string');
            const id = `meganovaai_dyn_${key.replace(/[^a-zA-Z0-9_-]/g, '_')}`;

            if (Array.isArray(spec?.enum) && spec.enum.length) {
                const select = $(`<div><label for="${id}">${nice}</label><select id="${id}" class="text_pole"></select></div>`);
                container.append(select);
                const el = select.find('select');
                for (const opt of spec.enum) el.append(new Option(String(opt), String(opt)));
                const val = this.settings[key] ?? spec.default ?? spec.enum[0];
                el.val(String(val));
                el.on('change', () => { this.settings[key] = String(el.val() || ''); saveTtsProviderSettings(); });
                continue;
            }

            if (type === 'boolean') {
                const block = $(`<label class="checkbox_label" for="${id}"><input type="checkbox" id="${id}"> <small>${nice}</small></label>`);
                container.append(block);
                const el = block.find('input');
                el.prop('checked', !!(this.settings[key] ?? spec.default ?? false));
                el.on('change', () => { this.settings[key] = !!el.is(':checked'); saveTtsProviderSettings(); });
                continue;
            }

            if (type === 'number' || type === 'integer') {
                const min = spec.minimum ?? undefined;
                const max = spec.maximum ?? undefined;
                const step = type === 'integer' ? 1 : (spec.step ?? 0.01);
                const block = $(`<div><label for="${id}">${nice}${(min != null || max != null) ? ` (${min ?? ''}..${max ?? ''})` : ''}:</label><input id="${id}" type="number" class="text_pole" ${min != null ? `min="${min}"` : ''} ${max != null ? `max="${max}"` : ''} step="${step}"></div>`);
                container.append(block);
                const el = block.find('input');
                const val = this.settings[key] ?? spec.default ?? '';
                if (val !== '') el.val(val);
                el.on('input', () => {
                    const raw = el.val();
                    this.settings[key] = (raw === '') ? '' : Number(raw);
                    saveTtsProviderSettings();
                });
                continue;
            }

            const isLong = /instructions|transcript|style|prompt|description/i.test(key);
            if (isLong) {
                const block = $(`<div><label for="${id}">${nice}</label><textarea id="${id}" class="textarea_compact autoSetHeight"></textarea></div>`);
                container.append(block);
                const el = block.find('textarea');
                el.val(String(this.settings[key] ?? spec.default ?? ''));
                el.on('input', () => { this.settings[key] = String(el.val() || ''); saveTtsProviderSettings(); });
            } else {
                const block = $(`<div><label for="${id}">${nice}</label><input id="${id}" type="text" class="text_pole" /></div>`);
                container.append(block);
                const el = block.find('input');
                el.val(String(this.settings[key] ?? spec.default ?? ''));
                el.on('input', () => { this.settings[key] = String(el.val() || ''); saveTtsProviderSettings(); });
            }
        }
    }

    async checkReady() {
        this.voices = await this.fetchTtsVoiceObjects();
    }

    async onRefreshClick() {
        await this.loadModels();
        this.populateModelSelect();
        this.voices = await this.fetchTtsVoiceObjects();
        this.updateConditionalBlocks();
        this.renderDynamicParams();
        saveTtsProviderSettings();
    }

    async getVoice(voiceName) {
        if (this.voices.length == 0) {
            this.voices = await this.fetchTtsVoiceObjects();
        }
        const match = this.voices.filter(v => v.name == voiceName)[0];
        if (!match) {
            throw `TTS Voice name ${voiceName} not found`;
        }
        return match;
    }

    async generateTts(text, voiceId) {
        const response = await this.fetchTtsGeneration(text, voiceId);
        return response;
    }

    async fetchTtsVoiceObjects() {
        const modelId = this.settings.model;
        const model = this.models.find(m => m.id === modelId);
        if (model && Array.isArray(model.voices) && model.voices.length) {
            return model.voices.map(name => ({ name, voice_id: name, lang: 'en-US' }));
        }
        // Fallback to common OpenAI voices
        const fallback = ['alloy', 'ash', 'ballad', 'coral', 'echo', 'fable', 'onyx', 'nova', 'sage', 'shimmer', 'verse'];
        return fallback.map(name => ({ name, voice_id: name, lang: 'en-US' }));
    }

    async previewTtsVoice(voiceId) {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
        const text = getPreviewString('en-US');
        const response = await this.fetchTtsGeneration(text, voiceId);
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`);
        }
        const audio = await response.blob();
        const url = URL.createObjectURL(audio);
        this.audioElement.src = url;
        this.audioElement.play();
        this.audioElement.onended = () => URL.revokeObjectURL(url);
    }

    async fetchTtsGeneration(inputText, voiceId) {
        console.info(`Generating MegaNova AI TTS for voice_id ${voiceId}`);
        const body = {
            input: inputText,
            voice: voiceId,
            speed: this.settings.speed,
            temperature: this.settings.temperature,
            model: this.settings.model,
        };

        const model = (this.settings.model || '').toLowerCase();
        if (model === 'gpt-4o-mini-tts') {
            if (this.settings.instructions?.trim()) body.instructions = this.settings.instructions.trim();
        }
        if (model.includes('dia')) {
            if (this.settings.speaker_transcript?.trim()) body.speaker_transcript = this.settings.speaker_transcript.trim();
            if (Number.isFinite(this.settings.cfg_scale)) body.cfg_scale = Number(this.settings.cfg_scale);
            if (Number.isFinite(this.settings.cfg_filter_top_k)) body.cfg_filter_top_k = Number(this.settings.cfg_filter_top_k);
        }
        if (model.includes('microsoft-tts')) {
            if (Number.isFinite(this.settings.speech_rate)) body.speech_rate = Number(this.settings.speech_rate);
            if (Number.isFinite(this.settings.pitch_adjustment)) body.pitch_adjustment = Number(this.settings.pitch_adjustment);
            if ((this.settings.emotional_style || '').trim()) body.emotional_style = String(this.settings.emotional_style).trim();
        }
        if (Number.isFinite(this.settings.top_p)) {
            body.top_p = Number(this.settings.top_p);
        }

        // add dynamic params based on schema
        const modelObj = this.models.find(m => m.id === this.settings.model);
        const params = modelObj?.parameters || {};
        const modelHasVoices = Array.isArray(modelObj?.voices) && modelObj.voices.length > 0;
        const exclude = new Set(['input', 'response_format', 'model', 'speed', 'temperature', 'top_p', 'instructions', 'speaker_transcript', 'cfg_scale', 'cfg_filter_top_k', 'speech_rate', 'pitch_adjustment', 'emotional_style']);
        if (modelHasVoices) exclude.add('voice');
        for (const key of Object.keys(params)) {
            if (exclude.has(key)) continue;
            const val = this.settings[key];
            if (val === undefined || val === '') continue;
            body[key] = val;
        }

        const response = await fetch('/api/openai/electronhub/generate-voice', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify(body),
        });

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        return response;
    }
}
