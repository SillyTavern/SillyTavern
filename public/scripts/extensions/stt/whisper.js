/*
 Kinda useless for now but will populate provider settings if introduced later
 */
export { WhisperSttProvider }

class WhisperSttProvider {
    //########//
    // Config //
    //########//

    settings

    defaultSettings = {
        //model_path: "",
    }

    get settingsHtml() {
        let html = ""
        return html
    }

    onSettingsChange() {
        // Used when provider settings are updated from UI
    }

    loadSettings(settings) {
        // Populate Provider UI given input settings
        if (Object.keys(settings).length == 0) {
            console.debug("<STT-whisper-module> Using default Whisper STT extension settings")
        }

        // Only accept keys defined in defaultSettings
        this.settings = this.defaultSettings

        for (const key in settings){
            if (key in this.settings){
                this.settings[key] = settings[key]
            } else {
                throw `Invalid setting passed to STT extension: ${key}`
            }
        }

        console.debug("<STT-whisper-module> Whisper STT settings loaded")
    }

}