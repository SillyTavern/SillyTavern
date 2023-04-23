export { ElevenLabsTtsProvider }

class ElevenLabsTtsProvider {
    //########//
    // Config //
    //########//

    API_KEY
    settings = this.defaultSettings
    voices = []

    set API_KEY(apiKey) {
        this.API_KEY = apiKey
    }
    get API_KEY() {
        return this.API_KEY
    }
    get settings() {
        return this.settings
    }

    updateSettings(settings) {
        console.info("Settings updated")
        if("stability" in settings && "similarity_boost" in settings){
            this.settings = settings
            $('#elevenlabs_tts_stability').val(this.settings.stability)
            $('#elevenlabs_tts_similarity_boost').val(this.settings.similarity_boost)
            this.onSettingsChange()
        } else {
            throw `Invalid settings passed to ElevenLabs: ${JSON.stringify(settings)}`
        }
    }

    defaultSettings = {
        stability: 0.75,
        similarity_boost: 0.75
    }

    onSettingsChange() {
        this.settings = {
            stability: $('#elevenlabs_tts_stability').val(),
            similarity_boost: $('#elevenlabs_tts_similarity_boost').val()
        }
        $('#elevenlabs_tts_stability_output').text(this.settings.stability)
        $('#elevenlabs_tts_similarity_boost_output').text(this.settings.similarity_boost)
    }

    get settingsHtml() {
        let html = `
        <label for="elevenlabs_tts_stability">Stability: <span id="elevenlabs_tts_stability_output"></span></label>
        <input id="elevenlabs_tts_stability" type="range" value="${this.defaultSettings.stability}" min="0" max="1" step="0.05" />
        <label for="elevenlabs_tts_similarity_boost">Stability: <span id="elevenlabs_tts_similarity_boost_output"></span></label>
        <input id="elevenlabs_tts_similarity_boost" type="range" value="${this.defaultSettings.similarity_boost}" min="0" max="1" step="0.05" />
        `
        return html
    }

    //#############//
    //  Management //
    //#############//

    async getVoice(voiceName) {
        if (this.voices.length == 0) {
            this.voices = await this.fetchTtsVoiceIds()
        }
        const match = this.voices.filter(
            elevenVoice => elevenVoice.name == voiceName
        )[0]
        if (!match) {
            throw `TTS Voice name ${voiceName} not found in ElevenLabs account`
        }
        return match
    }

    async findTtsGenerationInHistory(message, voiceId) {
        const ttsHistory = await this.fetchTtsHistory()
        for (const history of ttsHistory) {
            const text = history.text
            const itemId = history.history_item_id
            if (message === text && history.voice_id == voiceId) {
                console.info(`Existing TTS history item ${itemId} found: ${text} `)
                return itemId
            }
        }
        return ''
    }

    //###########//
    // API CALLS //
    //###########//
    async fetchTtsVoiceIds() {
        const headers = {
            'xi-api-key': this.API_KEY
        }
        const response = await fetch(`https://api.elevenlabs.io/v1/voices`, {
            headers: headers
        })
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.json()}`)
        }
        const responseJson = await response.json()
        return responseJson.voices
    }

    /**
     * 
     * @returns 
     */
    async fetchTtsVoiceSettings() {
        const headers = {
            'xi-api-key': this.API_KEY
        }
        const response = await fetch(
            `https://api.elevenlabs.io/v1/voices/settings/default`,
            {
                headers: headers
            }
        )
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.json()}`)
        }
        return response.json()
    }

    async fetchTtsGeneration(text, voiceId) {
        console.info(`Generating new TTS for voice_id ${voiceId}`)
        const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
            {
                method: 'POST',
                headers: {
                    'xi-api-key': this.API_KEY,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    text: text,
                    voice_settings: this.settings
                })
            }
        )
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.json()}`)
        }
        return response
    }

    async fetchTtsFromHistory(history_item_id) {
        console.info(`Fetched existing TTS with history_item_id ${history_item_id}`)
        const response = await fetch(
            `https://api.elevenlabs.io/v1/history/${history_item_id}/audio`,
            {
                headers: {
                    'xi-api-key': this.API_KEY
                }
            }
        )
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.json()}`)
        }
        return response
    }

    async fetchTtsHistory() {
        const headers = {
            'xi-api-key': this.API_KEY
        }
        const response = await fetch(`https://api.elevenlabs.io/v1/history`, {
            headers: headers
        })
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.json()}`)
        }
        const responseJson = await response.json()
        return responseJson.history
    }
}
