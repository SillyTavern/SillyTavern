import { getRequestHeaders } from "../../../script.js"
import { doExtrasFetch, getApiUrl, modules } from "../../extensions.js"
import { getPreviewString } from "./index.js"

export { EdgeTtsProvider }

class EdgeTtsProvider {
    //########//
    // Config //
    //########//

    settings
    voices = []
    separator = ' .. '

    defaultSettings = {
        voiceMap: {}
    }

    get settingsHtml() {
        let html = `Microsoft Edge TTS Provider<br>`
        return html
    }

    onSettingsChange() {
    }

    loadSettings(settings) {
        // Pupulate Provider UI given input settings
        if (Object.keys(settings).length == 0) {
            console.info("Using default TTS Provider settings")
        }

        // Only accept keys defined in defaultSettings
        this.settings = this.defaultSettings

        for (const key in settings){
            if (key in this.settings){
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
        if (this.voices.length == 0) {
            this.voices = await this.fetchTtsVoiceIds()
        }
        const match = this.voices.filter(
            voice => voice.name == voiceName
        )[0]
        if (!match) {
            throw `TTS Voice name ${voiceName} not found`
        }
        return match
    }

    async generateTts(text, voiceId){
        const response = await this.fetchTtsGeneration(text, voiceId)
        return response
    }

    //###########//
    // API CALLS //
    //###########//
    async fetchTtsVoiceIds() {
        const response = await doExtrasFetch(`/edge_voices`)
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.json()}`)
        }
        let responseJson = await response.json()
        responseJson = responseJson
            .sort((a, b) => a.Locale.localeCompare(b.Locale) || a.ShortName.localeCompare(b.ShortName))
            .map(x => ({ name: x.ShortName, voice_id: x.ShortName, preview_url: false, lang: x.Locale }));
        return responseJson
    }


    async previewTtsVoice(id) {
        const voice = await this.getVoice(id);
        const text = getPreviewString(voice.lang);
        const response = await this.fetchTtsGeneration(text, id)
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.json()}`)
        }

        const audio = await response.blob();
        const url = URL.createObjectURL(audio);
        const audioElement = document.createElement("audio");
        audioElement.src = url;
        audioElement.play();
    }

    async fetchTtsGeneration(inputText, voiceId) {
        console.info(`Generating new TTS for voice_id ${voiceId}`)
        const response = await doExtrasFetch(
            `/edge_speech`,
            {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({
                    "text": inputText,
                    "voice": voiceId
                })
            }
        )
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.json()}`)
        }
        return response
    }
}
