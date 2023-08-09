import { getRequestHeaders, callPopup } from "../../../script.js"
import { getPreviewString, initVoiceMap } from "./index.js"

export { NovelTtsProvider }

class NovelTtsProvider {
    //########//
    // Config //
    //########//

    settings
    voices = []
    separator = ' . '
    audioElement = document.createElement('audio')

    defaultSettings = {
        voiceMap: {},
        customVoices: []
    }

    get settingsHtml() {
        let html = `
        <br>
        <small>
        Use NovelAI's TTS engine.<br>
        The default Voice IDs are only examples. Add custom voices and Novel will create a new random voice for it. Feel free to try different options!<br>
        </small>
        <small><i>Hint: Save an API key in the NovelAI API settings to use it here.</i></small>
        <div class="flex1">
            <select id="tts-novel-custom-voices-select"><select>
            <label for="tts-novel-custom-voices-add">Custom Voices</label>
            <i id="tts-novel-custom-voices-add" class="tts-button fa-solid fa-plus" title="Add"></i>
            <i id="tts-novel-custom-voices-delete" class="tts-button fa-solid fa-xmark" title="Delete"></i>
        </div>
        `;
        return html;
    }

    onSettingsChange() {

    }

    // Add a new Novel custom voice to provider
    async addCustomVoice(){
        const voiceName = await callPopup('<h3>Custom Voice name:</h3>', 'input')
        this.settings.customVoices.push(voiceName)
        this.populateCustomVoices()
    }

    // Delete selected custom voice from provider
    deleteCustomVoice() {
        const selected = $("#tts-novel-custom-voices-select").find(':selected').val();
        const voiceIndex = this.settings.customVoices.indexOf(selected);
        
        if (voiceIndex !== -1) {
            this.settings.customVoices.splice(voiceIndex, 1);
        }
        this.populateCustomVoices()
    }

    // Create the UI dropdown list of voices in provider
    populateCustomVoices(){
        let voiceSelect = $("#tts-novel-custom-voices-select")
        voiceSelect.empty()
        this.settings.customVoices.forEach(voice => {
            voiceSelect.append(`<option>${voice}</option>`)
        })
        initVoiceMap()
    }

    loadSettings(settings) {
        // Populate Provider UI given input settings
        if (Object.keys(settings).length == 0) {
            console.info("Using default TTS Provider settings")
        }
        $("#tts-novel-custom-voices-add").on('click', () => (this.addCustomVoice()))
        $("#tts-novel-custom-voices-delete").on('click',() => (this.deleteCustomVoice()))

        // Only accept keys defined in defaultSettings
        this.settings = this.defaultSettings

        for (const key in settings) {
            if (key in this.settings) {
                this.settings[key] = settings[key]
            } else {
                throw `Invalid setting passed to TTS Provider: ${key}`
            }
        }

        this.populateCustomVoices()
        console.info("Settings loaded")
    }


    async onApplyClick() {
        return
    }

    //#################//
    //  TTS Interfaces //
    //#################//

    async getVoice(voiceName) {
        if (!voiceName) {
            throw `TTS Voice name not provided`
        }

        return { name: voiceName, voice_id: voiceName, lang: 'en-US', preview_url: false}
    }

    async generateTts(text, voiceId) {
        const response = await this.fetchTtsGeneration(text, voiceId)
        return response
    }

    //###########//
    // API CALLS //
    //###########//
    async fetchTtsVoiceIds() {
        let voices = [
            { name: 'Ligeia', voice_id: 'Ligeia', lang: 'en-US', preview_url: false },
            { name: 'Aini', voice_id: 'Aini', lang: 'en-US', preview_url: false },
            { name: 'Orea', voice_id: 'Orea', lang: 'en-US', preview_url: false },
            { name: 'Claea', voice_id: 'Claea', lang: 'en-US', preview_url: false },
            { name: 'Lim', voice_id: 'Lim', lang: 'en-US', preview_url: false },
            { name: 'Aurae', voice_id: 'Aurae', lang: 'en-US', preview_url: false },
            { name: 'Naia', voice_id: 'Naia', lang: 'en-US', preview_url: false },
            { name: 'Aulon', voice_id: 'Aulon', lang: 'en-US', preview_url: false },
            { name: 'Elei', voice_id: 'Elei', lang: 'en-US', preview_url: false },
            { name: 'Ogma', voice_id: 'Ogma', lang: 'en-US', preview_url: false },
            { name: 'Raid', voice_id: 'Raid', lang: 'en-US', preview_url: false },
            { name: 'Pega', voice_id: 'Pega', lang: 'en-US', preview_url: false },
            { name: 'Lam', voice_id: 'Lam', lang: 'en-US', preview_url: false },
        ];

        // Add in custom voices to the map
        let addVoices = this.settings.customVoices.map(voice => 
            ({ name: voice, voice_id: voice, lang: 'en-US', preview_url: false })
        )
        voices = voices.concat(addVoices)

        return voices;
    }


    async previewTtsVoice(id) {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;

        const text = getPreviewString('en-US')
        const response = await this.fetchTtsGeneration(text, id)
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}`)
        }

        const audio = await response.blob();
        const url = URL.createObjectURL(audio);
        this.audioElement.src = url;
        this.audioElement.play();
    }

    async fetchTtsGeneration(inputText, voiceId) {
        console.info(`Generating new TTS for voice_id ${voiceId}`)
        const response = await fetch(`/novel_tts`,
            {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({
                    "text": inputText,
                    "voice": voiceId,
                })
            }
        )
        if (!response.ok) {
            toastr.error(response.statusText, 'TTS Generation Failed');
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        return response
    }
}
