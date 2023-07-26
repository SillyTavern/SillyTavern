/*
 Kinda useless for now but will populate provider settings if introduced later
 */
export { VoskSttProvider }

class VoskSttProvider {
    //########//
    // Config //
    //########//

    settings

    defaultSettings = {
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
            console.debug("<STT-Vosk-module> Using default vosk STT extension settings")
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

        console.debug("<STT-Vosk-module> Vosk STT settings loaded")
    }
}