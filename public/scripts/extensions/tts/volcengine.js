import { event_types, eventSource, getRequestHeaders } from '../../../script.js';
import { SECRET_KEYS, secret_state } from '../../secrets.js';
import { saveTtsProviderSettings, initVoiceMap } from './index.js';
import { Popup } from '../../popup.js';
export { VolcengineTtsProvider };

class VolcengineTtsProvider {
    static voices = [
        {
            name: 'zh_female_xiaohe_uranus_bigtts',
            voice_id: 'zh_female_xiaohe_uranus_bigtts',
            lang: 'cl',
        },
        {
            name: 'zh_female_vv_uranus_bigtts',
            voice_id: 'zh_female_vv_uranus_bigtts',
            lang: 'cl',
        },
        {
            name: 'saturn_zh_female_keainvsheng_tob',
            voice_id: 'saturn_zh_female_keainvsheng_tob',
            lang: 'cl',
        },
        {
            name: 'saturn_zh_female_tiaopigongzhu_tob',
            voice_id: 'saturn_zh_female_tiaopigongzhu_tob',
            lang: 'cl',
        },
        {
            name: 'saturn_zh_female_cancan_tob',
            voice_id: 'saturn_zh_female_cancan_tob',
            lang: 'cl',
        },
        {
            name: 'saturn_zh_male_shuanglangshaonian_tob',
            voice_id: 'saturn_zh_male_shuanglangshaonian_tob',
            lang: 'cl',
        },
        {
            name: 'saturn_zh_male_tiancaitongzhuo_tob',
            voice_id: 'saturn_zh_male_tiancaitongzhuo_tob',
            lang: 'cl',
        },
        {
            name: 'zh_male_taocheng_uranus_bigtts',
            voice_id: 'zh_male_taocheng_uranus_bigtts',
            lang: 'cl',
        },
    ];
    settings;
    audioElement = document.createElement('audio');
    defaultSettings = {
        voiceMap: {},
        customVoices: [],
        resource_id: '',
        speed: 0,
        provider_endpoint: 'https://openspeech.bytedance.com/api/v3/tts/unidirectional',
    };

    processText(text) {
        return text.split('...').join('');
    }

    constructor() {
        this.handler = async function (/** @type {string} */ key) {
            if (![SECRET_KEYS.VOLCENGINE_APP_ID, SECRET_KEYS.VOLCENGINE_ACCESS_KEY].includes(key)) return;
            $('#volcengine-tts-app-id').toggleClass('success', !!secret_state[SECRET_KEYS.VOLCENGINE_APP_ID]);
            $('#volcengine-tts-access-key').toggleClass('success', !!secret_state[SECRET_KEYS.VOLCENGINE_ACCESS_KEY]);
            await this.onRefreshClick();
        }.bind(this);
    }

    dispose() {
        [event_types.SECRET_WRITTEN, event_types.SECRET_DELETED, event_types.SECRET_ROTATED].forEach(event => {
            eventSource.removeListener(event, this.handler);
        });
    }

    async previewTtsVoice(voice) {
        const text = 'Hello! Nice to meet you!';
        const audio = await this.generateTts(text, voice);
        const audioElement = new Audio(URL.createObjectURL(await audio.blob()));
        audioElement.play().catch(e => console.error('Error playing audio:', e));
    }

    async fetchTtsVoiceObjects() {
        return this.getAllVoices();
    }

    get settingsHtml() {
        let html = `
            <div>Volcengine (Doubao) TTS Configuration.</div>
            <small>Hint: Volcengine (Doubao) TTS configuration items.</small>
            <small>Please refer to the <a href="https://www.volcengine.com/docs/6561/1598757" target="_blank">documentation</a> to obtain the configuration items.</small>
            <div class="flex-container alignItemsCenter">
                <div id="volcengine-tts-app-id" class="menu_button menu_button_icon manage-api-keys" data-key="volcengine_app_id">
                    <i class="fa-solid fa-key"></i>
                    <span>App ID</span>
                </div>
                <div id="volcengine-tts-access-key" class="menu_button menu_button_icon manage-api-keys" data-key="volcengine_access_key">
                    <i class="fa-solid fa-key"></i>
                    <span>Access Key</span>
                </div>
            </div>
            <div>
                <label for="volcengine-tts-resource-id">Resource ID:</label>
                <input type="text" class="text_pole" id="volcengine-tts-resource-id">
            </div>
            <label for="volcengine-tts-voice">Custom Voice (Speaker):</label>
            <div class="tts_custom_voices">
                <select id="volcengine-tts-voice-select">
                </select>
                <i title="Add" id="volcengine-tts-add-voice" class="tts-button fa-solid fa-plus fa-xl success" role="button"></i>
                <i title="Delete" id="volcengine-tts-delete-voice" class="tts-button fa-solid fa-xmark fa-xl failure" tabindex="0" role="button"></i>
            </div>
            <div>
                <label for="volcengine-tts-speed">Speed:</label>
                <div class="flex-container">
                    <div class="range-block-range">
                        <input type="range" id="volcengine-tts-speed" min="-50" max="100" step="1">
                    </div>
                    <div class="range-block-counter">
                        <input type="number" min="-50" max="100" step="1" data-for="volcengine-tts-speed" id="volcengine-tts-speed_counter">
                    </div>
                </div>
            </div>
            <div>
                <label for="volcengine-tts-provider-endpoint">Provider Endpoint:</label>
                <input type="text" class="text_pole" id="volcengine-tts-provider-endpoint">
            </div>
        `;
        return html;
    }

    async getVoice(voiceName) {
        const allVoices = this.getAllVoices();
        return allVoices.find(voice => voice.name == voiceName);
    }

    getAllVoices() {
        const voices = [...VolcengineTtsProvider.voices];

        for (const customVoice of this.settings.customVoices) {
            voices.push({
                name: customVoice,
                voice_id: customVoice,
                lang: 'cl',
            });
        }

        return voices;
    }

    populateVoices() {
        const voiceSelect = $('#volcengine-tts-voice-select');

        voiceSelect.empty();

        for (const customVoice of this.settings.customVoices) {
            const option = document.createElement('option');
            option.value = customVoice;
            option.textContent = customVoice;
            voiceSelect.append(option);
        }
    }

    async onRefreshClick() {
        return await this.checkReady();
    }

    onSettingsChange() {
        // Used when provider settings are updated from UI
        this.settings.resource_id = $('#volcengine-tts-resource-id').val();
        this.settings.speed = $('#volcengine-tts-speed').val();
        this.settings.provider_endpoint = $('#volcengine-tts-provider-endpoint').val();
        saveTtsProviderSettings();
        this.changeTTSSettings();
    }

    async changeTTSSettings() {
        const speed = this.settings.speed;
        $('#volcengine-tts-speed').val(speed);
        $('#volcengine-tts-speed_counter').val(speed);
    }

    async loadSettings(settings) {
        // Populate Provider UI given input settings
        if (Object.keys(settings).length == 0) {
            console.info('Using default TTS Provider settings');
        }

        // Only accept keys defined in defaultSettings
        this.settings = { ...this.defaultSettings };

        for (const key in settings) {
            if (key in this.settings) {
                this.settings[key] = settings[key];
            } else {
                throw `Invalid setting passed to TTS Provider: ${key}`;
            }
        }

        // Set initial values from the settings
        $('#volcengine-tts-resource-id').val(this.settings.resource_id).on('change', this.onSettingsChange.bind(this));
        $('#volcengine-tts-add-voice').on('click', this.createNewVoice.bind(this));
        $('#volcengine-tts-delete-voice').on('click', this.deleteSelectedVoice.bind(this));

        // Ensure custom configuration arrays exist
        if (!this.settings.customVoices) this.settings.customVoices = [];


        this.populateVoices();

        // Speed control - range and number inputs
        const speedInput = $('#volcengine-tts-speed');
        const speedCounter = $('#volcengine-tts-speed_counter');

        speedInput.val(this.settings.speed).on('input change', (e) => {
            const value = $(e.target).val();
            speedCounter.val(value);
            this.settings.speed = value;
            saveTtsProviderSettings();
            this.changeTTSSettings();
        });

        speedCounter.val(this.settings.speed).on('input change', (e) => {
            const value = $(e.target).val();
            speedInput.val(value);
            this.settings.speed = value;
            saveTtsProviderSettings();
            this.changeTTSSettings();
        });

        $('#volcengine-tts-provider-endpoint').val(this.settings.provider_endpoint).on('change', this.onSettingsChange.bind(this));

        // Initialize secret keys UI
        $('#volcengine-tts-app-id').toggleClass('success', !!secret_state[SECRET_KEYS.VOLCENGINE_APP_ID]);
        $('#volcengine-tts-access-key').toggleClass('success', !!secret_state[SECRET_KEYS.VOLCENGINE_ACCESS_KEY]);
        [event_types.SECRET_WRITTEN, event_types.SECRET_DELETED, event_types.SECRET_ROTATED].forEach(event => {
            eventSource.on(event, this.handler);
        });

        await this.checkReady();

        console.info('Volcengine TTS: Settings loaded');
    }

    async createNewVoice() {
        const name = await Popup.show.input('Voice name: ', null);
        if (!name) {
            return;
        }
        if (this.settings.customVoices.includes(name)) {
            toastr.error('Voice name should be unique.');
            return;
        }
        this.settings.customVoices.push(name);
        this.populateVoices();
        initVoiceMap();
        saveTtsProviderSettings();
    }

    async deleteSelectedVoice() {
        const selectedVoiceName = $('#volcengine-tts-voice-select').val();

        if (!selectedVoiceName) {
            toastr.error('Please select a voice first.');
            return;
        }

        const confirm = await Popup.show.confirm(`Are you sure you want to delete the selected voice ${selectedVoiceName}?`);
        if (!confirm) {
            return;
        }


        const voiceIndex = this.settings.customVoices.indexOf(selectedVoiceName);
        if (voiceIndex !== -1) {
            this.settings.customVoices.splice(voiceIndex, 1);
        }

        this.populateVoices();
        initVoiceMap();
        saveTtsProviderSettings();
    }

    async checkReady() {
        await Promise.allSettled([this.changeTTSSettings()]);
    }

    async generateTts(text, speaker) {
        const response = await this.fetchTtsGeneration(text, speaker);
        return response;
    }
    async fetchTtsGeneration(text, voice_speaker) {
        console.info(`Generating new TTS for voice_id ${voice_speaker}`);
        const response = await fetch('/api/volcengine/generate-voice', {
            method: 'POST',
            headers: getRequestHeaders(),
            body: JSON.stringify({
                'provider_endpoint': this.settings.provider_endpoint,
                'resource_id': this.settings.resource_id,
                'text': text,
                'voice_speaker': voice_speaker,
                'speed': this.settings.speed,
            }),
        });
        if (!response.ok) {
            const errorText = await response.text();
            console.error(`HTTP ${response.status}: ${errorText}`);
            toastr.error(errorText);
            throw new Error(`HTTP ${response.status}: ${errorText}`);
        }
        return response;
    }
}
