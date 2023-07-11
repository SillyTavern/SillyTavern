import { doExtrasFetch, getApiUrl, modules } from "../../extensions.js"

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
        // Pupulate Provider UI given input settings
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

    /*
    async onApplyClick() {
        return
    }*/

    //###########//
    // API CALLS //
    //###########//

    async getUserMessage() {
        console.debug("<STT-Whisper-module> Recording user message")
        // Return if module is not loaded
        if (!modules.includes('whisper-stt')) {
            console.debug("<STT-whisper-module> Module Whisper-stt must be activated in SillytaverExtra for streaming user voice.")
            return "";
        }
    
        const url = new URL(getApiUrl());
        url.pathname = '/api/stt/whisper/record';
    
        const apiResult = await doExtrasFetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Bypass-Tunnel-Reminder': 'bypass',
            },
            body: JSON.stringify({ text: "" }),
        });

        if (!apiResult.ok) {
            toastr.error(apiResult.statusText, 'STT Generation Failed');
            throw new Error(`HTTP ${apiResult.status}: ${await apiResult.text()}`);
        }
        
        const data = await apiResult.json();
        return data.transcript;
    }
}