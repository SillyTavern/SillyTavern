import { doExtrasFetch, getApiUrl, modules } from "../../extensions.js"

export { VoskSttProvider }

class VoskSttProvider {
    //########//
    // Config //
    //########//

    settings

    defaultSettings = {
        //model_path: "",
    }

    get settingsHtml() {
        let html = ""
        /*
        let html = `
        <label for="vosk_stt_model_path">Vosk model path:</label>
        <input id="vosk_stt_model_path" type="text" class="text_pole" maxlength="250" value="${this.defaultSettings.model_path}"/>
        <span>
        <span>Use absolute path.</span>
        `*/
        return html
    }

    onSettingsChange() {
        // Used when provider settings are updated from UI
        //this.settings.model_path = $('#vosk_stt_model_path').val()
    }

    loadSettings(settings) {
        // Pupulate Provider UI given input settings
        if (Object.keys(settings).length == 0) {
            console.info("Using default vosk STT extension settings")
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

        //if (!modules.includes('vosk-stt')) {
        //    console.debug("Error, module vosk-stt must be load by SillyTavern-extra")
        //}

        //$('#vosk_stt_model_path').val(this.settings.model_path)
        console.info("Vosk STT settings loaded")
    }

    /*
    async onApplyClick() {
        return
    }*/

    //###########//
    // API CALLS //
    //###########//

    async getUserMessage() {
        console.info("Recording user message")
        // Return if module is not loaded
        if (!modules.includes('vosk-stt')) {
            console.log("Module vosk-stt must be activated in SillytaverExtra for streaming user voice.")
            return "";
        }

        // Return if no path to model given
        //if(this.settings.model_path == "") {
        //    console.log("No path to model given")
        //    return ""
        //}
    
        const url = new URL(getApiUrl());
        url.pathname = '/api/vosk-stt/record';
    
        const apiResult = await doExtrasFetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Bypass-Tunnel-Reminder': 'bypass',
            },
            body: JSON.stringify({ text: "" }),
        });

        if (!apiResult.ok) {
            toastr.error(response.statusText, 'STT Generation Failed');
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        
        const data = await apiResult.json();
        return data.transcript;
    }

    /*
    async loadModel() {
        console.info("Loading vosk model")
        // Return if module is not loaded
        if (!modules.includes('vosk-stt')) {
            console.log("Module vosk-stt must be activated in SillytaverExtra for loading vosk model.")
            return "";
        }
        
        this.settings.model_path = $('#vosk_stt_model_path').val()

        const url = new URL(getApiUrl());
        url.pathname = '/api/vosk-stt/load';
    
        const apiResult = await doExtrasFetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Bypass-Tunnel-Reminder': 'bypass',
            },
            body: JSON.stringify({ model_path: this.settings.model_path }),
        });

        if (!apiResult.ok) {
            toastr.error(response.statusText, 'Vosk STT model load Failed');
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        

        const data = await apiResult.json();
        return data.transcript;
    }

    async enabled(value) {
        const url = new URL(getApiUrl());
        
        url.pathname = '/api/vosk-stt/enable';

        if (!value)
            url.pathname = '/api/vosk-stt/disable';
    
        const apiResult = await doExtrasFetch(url, {
            method: 'POST',
            headers: {
                'Content-Type': 'application/json',
                'Bypass-Tunnel-Reminder': 'bypass',
            },
            body: JSON.stringify({ text: "" }),
        });

        if (!apiResult.ok) {
            if (value)
                toastr.error(response.statusText, 'Vosk STT enable failed');
            else
                toastr.error(response.statusText, 'Vosk STT disable failed');
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
    }
    */
}