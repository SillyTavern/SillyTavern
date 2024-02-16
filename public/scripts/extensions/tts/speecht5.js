import { getPreviewString, saveTtsProviderSettings } from './index.js';
import { getBase64Async } from '../../utils.js';
import { getRequestHeaders } from '../../../script.js';

export { SpeechT5TtsProvider };

class SpeechT5TtsProvider {
    //########//
    // Config //
    //########//

    settings;
    ready = false;
    voices = [];
    separator = ' .. ';
    audioElement = document.createElement('audio');

    defaultSettings = {
        speakers: [],
        speaker: '',
        voiceMap: {},
    };

    get settingsHtml() {
        let html = `
        <label for="speecht5_tts_speaker">Speaker:</label>
        <div class="flex-container">
            <select id="speecht5_tts_speaker" class="text_pole flex1">
            </select>
            <div id="speecht5_tts_speaker_upload_button" class="menu_button" title="Upload speaker">
                <i class="fa-solid fa-upload"></i>
            </div>
            <div id="speecht5_tts_delete_speaker_button" class="menu_button" title="Delete speaker">
                <i class="fa-solid fa-trash"></i>
            </div>
        </div>
        <input type="file" id="speecht5_tts_speaker_upload" class="displayNone">
        <div><i>Loading model for the first time may take a while!</i></div>
        `;
        return html;
    }

    onSettingsChange() {
        // Used when provider settings are updated from UI
        this.settings.speaker = $('#speecht5_tts_speaker').val();
        saveTtsProviderSettings();
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
    }

    async loadSettings(settings) {
        // Pupulate Provider UI given input settings
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

        for (const speaker of this.settings.speakers) {
            $('#speecht5_tts_speaker').append($('<option>', {
                value: speaker.voice_id,
                text: speaker.name,
            }));
        }

        $('#speecht5_tts_speaker').val(this.settings.speaker);
        $('#speecht5_tts_speaker').on('change', this.onSettingsChange.bind(this));
        $('#speecht5_tts_speaker_upload_button').on('click', () => {
            $('#speecht5_tts_speaker_upload').trigger('click');
        });
        $('#speecht5_tts_speaker_upload').on('change', async (event) => {
            const file = event.target.files[0];
            if (file.size != 2048) {
                toastr.error('Invalid speaker file size, expected 2048 bytes');
                return;
            }

            const data = await getBase64Async(file);
            const speaker = {
                voice_id: file.name,
                name: file.name,
                data: data,
                lang: 'en-US',
                preview_url: false,
            };
            this.settings.speakers.push(speaker);
            $('#speecht5_tts_speaker').append($('<option>', {
                value: speaker.voice_id,
                text: speaker.name,
            }));
            $('#speecht5_tts_speaker').val(speaker.name);
            this.onSettingsChange();
        });
        $('#speecht5_tts_delete_speaker_button').on('click', () => {
            const confirmDelete = confirm('Are you sure you want to delete this speaker?');

            if (!confirmDelete) {
                return;
            }

            const speaker = this.settings.speakers.find(s => s.voice_id === this.settings.speaker);
            if (!speaker) {
                toastr.error('Speaker not found');
                return;
            }

            const index = this.settings.speakers.indexOf(speaker);
            this.settings.speakers.splice(index, 1);
            $(`#speecht5_tts_speaker option[value="${speaker.voice_id}"]`).remove();

            if (this.settings.speakers.length == 0) {
                console.log('No speakers left');
                return;
            }

            $('#speecht5_tts_speaker').val(this.settings.speakers[0].voice_id);
            this.onSettingsChange();
        });

        await this.checkReady();

        console.debug('SpeechT5: Settings loaded');
    }

    async checkReady() {
        return Promise.resolve();
    }

    async getVoice(voiceName) {
        return this.settings.speakers.find(s => s.voice_id === voiceName);
    }

    async generateTts(text, voiceId) {
        const response = await this.fetchTtsGeneration(text, voiceId);
        return response;
    }

    async fetchTtsVoiceObjects() {
        return this.settings.speakers;
    }

    async fetchTtsGeneration(inputText, voiceId) {
        console.info(`Generating new TTS for voice_id ${voiceId}`);
        const speaker = await this.getVoice(voiceId);

        if (!speaker) {
            toastr.error(`Speaker not found: ${voiceId}`, 'TTS Generation Failed');
            throw new Error(`Speaker not found: ${voiceId}`);
        }

        const response = await fetch(
            '/api/speech/synthesize',
            {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({
                    'text': inputText,
                    'speaker': speaker.data,
                    'model': 'Xenova/speecht5_tts',
                }),
            },
        );

        if (!response.ok) {
            toastr.error(response.statusText, 'TTS Generation Failed');
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }

        return response;
    }

    async fetchTtsFromHistory(history_item_id) {
        return Promise.resolve(history_item_id);
    }
}
