import { getRequestHeaders } from "../../../script.js"
import { getApiUrl } from "../../extensions.js"
import { doExtrasFetch, modules } from "../../extensions.js"
import { getPreviewString } from "./index.js"

export { EdgeTtsProvider }

class EdgeTtsProvider {
    //########//
    // Config //
    //########//

    settings
    voices = []
    separator = ' . '
    audioElement = document.createElement('audio')

    defaultSettings = {
        voiceMap: {},
        rate: 0,
    }

    get settingsHtml() {
        let html = `Microsoft Edge TTS Provider<br>
        <label for="edge_tts_rate">Rate: <span id="edge_tts_rate_output"></span></label>
        <input id="edge_tts_rate" type="range" value="${this.defaultSettings.rate}" min="-100" max="100" step="1" />`
        return html
    }

    onSettingsChange() {
        this.settings.rate = Number($('#edge_tts_rate').val());
        $('#edge_tts_rate_output').text(this.settings.rate);
    }

    loadSettings(settings) {
        // Pupulate Provider UI given input settings
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

        $('#edge_tts_rate').val(this.settings.rate || 0);
        $('#edge_tts_rate_output').text(this.settings.rate || 0);

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

    async generateTts(text, voiceId) {
        const response = await this.fetchTtsGeneration(text, voiceId)
        return response
    }

    //###########//
    // API CALLS //
    //###########//
    async fetchTtsVoiceIds() {
        throwIfModuleMissing()

        const url = new URL(getApiUrl());
        url.pathname = `/api/edge-tts/list`
        const response = await doExtrasFetch(url)
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`)
        }
        let responseJson = await response.json()
        responseJson = responseJson
            .sort((a, b) => a.Locale.localeCompare(b.Locale) || a.ShortName.localeCompare(b.ShortName))
            .map(x => ({ name: x.ShortName, voice_id: x.ShortName, preview_url: false, lang: x.Locale }));
        return responseJson
    }


    async previewTtsVoice(id) {
        this.audioElement.pause();
        this.audioElement.currentTime = 0;
        const voice = await this.getVoice(id);
        const text = getPreviewString(voice.lang);
        const response = await this.fetchTtsGeneration(text, id)
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`)
        }

        const audio = await response.blob();
        const url = URL.createObjectURL(audio);
        this.audioElement.src = url;
        this.audioElement.play();
    }

    async fetchTtsGeneration(inputText, voiceId) {
        throwIfModuleMissing()

        console.info(`Generating new TTS for voice_id ${voiceId}`)
        const url = new URL(getApiUrl());
        url.pathname = `/api/edge-tts/generate`;
        const response = await doExtrasFetch(url,
            {
                method: 'POST',
                headers: getRequestHeaders(),
                body: JSON.stringify({
                    "text": inputText,
                    "voice": voiceId,
                    "rate": Number(this.settings.rate),
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
function throwIfModuleMissing() {
    if (!modules.includes('edge-tts')) {
        toastr.error(`Edge TTS module not loaded. Add edge-tts to enable-modules and restart the Extras API.`)
        throw new Error(`Edge TTS module not loaded.`)
    }
}

