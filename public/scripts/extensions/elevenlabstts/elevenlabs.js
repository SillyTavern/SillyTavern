export { ElevenLabsTtsProvider }

class ElevenLabsTtsProvider {
    API_KEY
    set API_KEY(apiKey) {
        this.API_KEY = apiKey
    }
    get API_KEY() {
        return this.API_KEY
    }
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
                body: JSON.stringify({ text: text })
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
}
