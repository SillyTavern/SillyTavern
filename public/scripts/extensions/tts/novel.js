import { getRequestHeaders } from "../../../script.js"
import { getPreviewString } from "./index.js"

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
        voiceMap: {}
    }

    get settingsHtml() {
        let html = `Use NovelAI's TTS engine.<br>
        The Voice IDs in the preview list are only examples, as it can be any string of text. Feel free to try different options!<br>
        <small><i>Hint: Save an API key in the NovelAI API settings to use it here.</i></small>`;
        return html;
    }

    onSettingsChange() {
    }

    loadSettings(settings) {
        // Populate Provider UI given input settings
        if (Object.keys(settings).length == 0) {
            console.info("Using default TTS Provider settings")
        }

        // Only accept keys defined in defaultSettings
        this.settings = this.defaultSettings

        for (const key in settings) {
            if (key in this.settings) {
                this.settings[key] = settings[key]
            } else {
                throw `Invalid setting passed to TTS Provider: ${key}`
            }
        }

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
        const voices = [
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
