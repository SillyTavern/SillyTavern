import { saveTtsProviderSettings } from "./index.js"
export { ElevenLabsTtsProvider }

class ElevenLabsTtsProvider {
    //########//
    // Config //
    //########//

    settings
    voices = []
    separator = ' ... ... ... '


    defaultSettings = {
        stability: 0.75,
        similarity_boost: 0.75,
        apiKey: "",
        model: 'eleven_monolingual_v1',
        voiceMap: {}
    }

    get settingsHtml() {
        let html = `
        <div class="elevenlabs_tts_settings">
            <label for="elevenlabs_tts_api_key">API Key</label>
            <input id="elevenlabs_tts_api_key" type="text" class="text_pole" placeholder="<API Key>"/>
            <label for="elevenlabs_tts_model">Model</label>
            <select id="elevenlabs_tts_model" class="text_pole">
                <option value="eleven_monolingual_v1">Monolingual</option>
                <option value="eleven_multilingual_v1">Multilingual v1</option>
                <option value="eleven_multilingual_v2">Multilingual v2</option>
            </select>
            <input id="eleven_labs_connect" class="menu_button" type="button" value="Connect" />
            <label for="elevenlabs_tts_stability">Stability: <span id="elevenlabs_tts_stability_output"></span></label>
            <input id="elevenlabs_tts_stability" type="range" value="${this.defaultSettings.stability}" min="0" max="1" step="0.05" />
            <label for="elevenlabs_tts_similarity_boost">Similarity Boost: <span id="elevenlabs_tts_similarity_boost_output"></span></label>
            <input id="elevenlabs_tts_similarity_boost" type="range" value="${this.defaultSettings.similarity_boost}" min="0" max="1" step="0.05" />
        </div>
        `
        return html
    }

    onSettingsChange() {
        // Update dynamically
        this.settings.stability = $('#elevenlabs_tts_stability').val()
        this.settings.similarity_boost = $('#elevenlabs_tts_similarity_boost').val()
        this.settings.model = $('#elevenlabs_tts_model').find(':selected').val()
        $('#elevenlabs_tts_stability_output').text(this.settings.stability);
        $('#elevenlabs_tts_similarity_boost_output').text(this.settings.similarity_boost);
        saveTtsProviderSettings()
    }

    async loadSettings(settings) {
        // Pupulate Provider UI given input settings
        if (Object.keys(settings).length == 0) {
            console.info("Using default TTS Provider settings")
        }

        // Only accept keys defined in defaultSettings
        this.settings = this.defaultSettings

        // Migrate old settings
        if (settings['multilingual'] !== undefined) {
            settings.model = settings.multilingual ? 'eleven_multilingual_v1' : 'eleven_monolingual_v1';
            delete settings['multilingual'];
        }

        for (const key in settings) {
            if (key in this.settings) {
                this.settings[key] = settings[key]
            } else {
                throw `Invalid setting passed to TTS Provider: ${key}`
            }
        }

        $('#elevenlabs_tts_stability').val(this.settings.stability)
        $('#elevenlabs_tts_similarity_boost').val(this.settings.similarity_boost)
        $('#elevenlabs_tts_api_key').val(this.settings.apiKey)
        $('#elevenlabs_tts_model').val(this.settings.model);
        $('#eleven_labs_connect').on('click', () => { this.onConnectClick() })
        $('#elevenlabs_tts_similarity_boost').on('input', this.onSettingsChange.bind(this))
        $('#elevenlabs_tts_stability').on('input', this.onSettingsChange.bind(this))
        $('#elevenlabs_tts_model').on('change', this.onSettingsChange.bind(this))
        $('#elevenlabs_tts_stability_output').text(this.settings.stability);
        $('#elevenlabs_tts_similarity_boost_output').text(this.settings.similarity_boost);

        try {
            await this.checkReady()
            console.debug("ElevenLabs: Settings loaded")
        } catch {
            console.debug("ElevenLabs: Settings loaded, but not ready")
        }
    }

    // Perform a simple readiness check by trying to fetch voiceIds
    async checkReady() {
        await this.fetchTtsVoiceObjects()
    }

    async onRefreshClick() {
    }

    async onConnectClick() {
        // Update on Apply click
        return await this.updateApiKey().catch((error) => {
            toastr.error(`ElevenLabs: ${error}`)
        })
    }


    async updateApiKey() {
        // Using this call to validate API key
        this.settings.apiKey = $('#elevenlabs_tts_api_key').val()

        await this.fetchTtsVoiceObjects().catch(error => {
            throw `TTS API key validation failed`
        })
        this.settings.apiKey = this.settings.apiKey
        console.debug(`Saved new API_KEY: ${this.settings.apiKey}`)
        $('#tts_status').text('')
        this.onSettingsChange()
    }

    //#################//
    //  TTS Interfaces //
    //#################//

    async getVoice(voiceName) {
        if (this.voices.length == 0) {
            this.voices = await this.fetchTtsVoiceObjects()
        }
        const match = this.voices.filter(
            elevenVoice => elevenVoice.name == voiceName
        )[0]
        if (!match) {
            throw `TTS Voice name ${voiceName} not found in ElevenLabs account`
        }
        return match
    }


    async generateTts(text, voiceId) {
        const historyId = await this.findTtsGenerationInHistory(text, voiceId)

        let response
        if (historyId) {
            console.debug(`Found existing TTS generation with id ${historyId}`)
            response = await this.fetchTtsFromHistory(historyId)
        } else {
            console.debug(`No existing TTS generation found, requesting new generation`)
            response = await this.fetchTtsGeneration(text, voiceId)
        }
        return response
    }

    //###################//
    //  Helper Functions //
    //###################//

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
    async fetchTtsVoiceObjects() {
        const headers = {
            'xi-api-key': this.settings.apiKey
        }
        const response = await fetch(`https://api.elevenlabs.io/v1/voices`, {
            headers: headers
        })
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`)
        }
        const responseJson = await response.json()
        return responseJson.voices
    }

    async fetchTtsVoiceSettings() {
        const headers = {
            'xi-api-key': this.settings.apiKey
        }
        const response = await fetch(
            `https://api.elevenlabs.io/v1/voices/settings/default`,
            {
                headers: headers
            }
        )
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`)
        }
        return response.json()
    }

    async fetchTtsGeneration(text, voiceId) {
        let model = this.settings.model ?? "eleven_monolingual_v1";
        console.info(`Generating new TTS for voice_id ${voiceId}, model ${model}`)
        const response = await fetch(
            `https://api.elevenlabs.io/v1/text-to-speech/${voiceId}`,
            {
                method: 'POST',
                headers: {
                    'xi-api-key': this.settings.apiKey,
                    'Content-Type': 'application/json'
                },
                body: JSON.stringify({
                    model_id: model,
                    text: text,
                    voice_settings: {
                        stability: Number(this.settings.stability),
                        similarity_boost: Number(this.settings.similarity_boost),
                    },
                })
            }
        )
        if (!response.ok) {
            toastr.error(response.statusText, 'TTS Generation Failed');
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        return response
    }

    async fetchTtsFromHistory(history_item_id) {
        console.info(`Fetched existing TTS with history_item_id ${history_item_id}`)
        const response = await fetch(
            `https://api.elevenlabs.io/v1/history/${history_item_id}/audio`,
            {
                headers: {
                    'xi-api-key': this.settings.apiKey
                }
            }
        )
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`)
        }
        return response
    }

    async fetchTtsHistory() {
        const headers = {
            'xi-api-key': this.settings.apiKey
        }
        const response = await fetch(`https://api.elevenlabs.io/v1/history`, {
            headers: headers
        })
        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.text()}`)
        }
        const responseJson = await response.json()
        return responseJson.history
    }
}
