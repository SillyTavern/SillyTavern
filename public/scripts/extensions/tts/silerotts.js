import { doExtrasFetch, getApiUrl, modules } from "../../extensions.js"

export { SileroTtsProvider }

class SileroTtsProvider {
    //########//
    // Config //
    //########//

    settings
    voices = []
    separator = ' .. '

    defaultSettings = {
        provider_endpoint: "http://localhost:8001/tts",
        voiceMap: {}
    }

    get settingsHtml() {
        let html = `
        <label for="silero_tts_endpoint">Provider Endpoint:</label>
        <input id="silero_tts_endpoint" type="text" class="text_pole" maxlength="250" value="${this.defaultSettings.provider_endpoint}"/>
        <span>
        <span>Use <a target="_blank" href="https://github.com/SillyTavern/SillyTavern-extras">SillyTavern Extras API</a> or <a target="_blank" href="https://github.com/ouoertheo/silero-api-server">Silero TTS Server</a>.</span>
        `
        return html
    }

    onSettingsChange() {
        // Used when provider settings are updated from UI
        this.settings.provider_endpoint = $('#silero_tts_endpoint').val()
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

        const apiCheckInterval = setInterval(() => {
            // Use Extras API if TTS support is enabled
            if (modules.includes('tts') || modules.includes('silero-tts')) {
                const baseUrl = new URL(getApiUrl());
                baseUrl.pathname = '/api/tts';
                this.settings.provider_endpoint = baseUrl.toString();
                $('#silero_tts_endpoint').val(this.settings.provider_endpoint);
                clearInterval(apiCheckInterval);
            }
        }, 2000);

        $('#silero_tts_endpoint').val(this.settings.provider_endpoint)
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
            sileroVoice => sileroVoice.name == voiceName
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
        const response = await doExtrasFetch(`${this.settings.provider_endpoint}/speakers`)
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.json()}`)
        }
        const responseJson = await response.json()
        return responseJson
    }

    async fetchTtsGeneration(inputText, voiceId) {
        console.info(`Generating new TTS for voice_id ${voiceId}`)
        const response = await doExtrasFetch(
            `${this.settings.provider_endpoint}/generate`,
            {
                method: 'POST',
                headers: {
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    "text": inputText,
                    "speaker": voiceId
                })
            }
        )
        if (!response.ok) {
            toastr.error(response.statusText, 'TTS Generation Failed');
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        return response
    }

    // Interface not used by Silero TTS
    async fetchTtsFromHistory(history_item_id) {
        return Promise.resolve(history_item_id);
    }

}
