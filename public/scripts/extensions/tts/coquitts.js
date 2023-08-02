import { eventSource, event_types } from "../../../script.js"
import { doExtrasFetch, getApiUrl, modules } from "../../extensions.js"

export { CoquiTtsProvider }

function throwIfModuleMissing() {
    if (!modules.includes('coqui-tts')) {
        toastr.error(`Coqui TTS module not loaded. Add coqui-tts to enable-modules and restart the Extras API.`)
        throw new Error(`Coqui TTS module not loaded.`)
    }
}

class CoquiTtsProvider {
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
        let html = `
        <div class="flex wide100p flexGap10 alignitemscenter">
            <div style="flex: 80%;">
                <label for="coqui_model">Model:</label>
                <select id="coqui_model">
                    <option value="none">Select Model</option>
                    <!-- Add more model options here -->
                </select>
            </div>
            <div class="flex justifyCenter" style="flex: 20%;">
                <button id="coqui_preview" class="menu_button menu_button_icon wide100p" type="button">
                </button>
            </div>
        </div>

        <div class="flex wide100p flexGap10">
            <div class="flex1">
                <label for="coqui_speaker">Speaker:</label>
                <select id="coqui_speaker">
                    <!-- Add more speaker options here -->
                </select>
            </div>
            <div class="flex1">
                <label for="coqui_language">Language:</label>
                <select id="coqui_language">
                    <!-- Add more language options here -->
                </select>
            </div>
        </div>
        `
        return html
    }

    onSettingsChange() {
    }

    loadSettings(settings) {
        // Pupulate Provider UI given input settings
        if (Object.keys(settings).length == 0) {
            console.info("Using default TTS Provider settings")
        }

        const modelSelect = document.getElementById('coqui_model');
        const previewButton = document.getElementById('coqui_preview');
        previewButton.addEventListener('click', () => {
            const selectedModel = modelSelect.value;
            this.sampleTtsVoice(selectedModel);
        });//add event listener to button

        previewButton.disabled = true;
        previewButton.innerText = "Select Model";

        // Only accept keys defined in defaultSettings
        this.settings = this.defaultSettings

        for (const key in settings) {
            if (key in this.settings) {
                this.settings[key] = settings[key]
            } else {
                throw `Invalid setting passed to TTS Provider: ${key}`
            }
        }

        const textexample = document.getElementById('tts_voice_map');
        textexample.placeholder = 'Enter comma separated map of charName:ttsName[speakerID][langID]. Example: \nAqua:tts_models--en--ljspeech--glow-tts\model_file.pth,\nDarkness:tts_models--multilingual--multi-dataset--your_tts\model_file.pth[2][3]';

        //Load models function
        eventSource.on(event_types.EXTRAS_CONNECTED, () => {
            this.getModels();
        });
        this.onttsCoquiHideButtons();
        console.info("Settings loaded")
    }

    async onttsCoquiHideButtons() {
        // Get references to the select element and the two input elements
        const ttsProviderSelect = document.getElementById('tts_provider');
        const ttsVoicesInput = document.getElementById('tts_voices');
        const ttsPreviewInput = document.getElementById('tts_preview');

        ttsProviderSelect.addEventListener('click', () => {
            this.getModels();
         });

        // Add an event listener to the 'change' event of the tts_provider select element
        ttsProviderSelect.addEventListener('change', () => {
            // Check if the selected value is 'Coqui'
            if (ttsProviderSelect.value === 'Coqui') {
                ttsVoicesInput.style.display = 'none'; // Hide the tts_voices input
                ttsPreviewInput.style.display = ''; // Show the tts_preview input
            } else {
                ttsVoicesInput.style.display = ''; // Show the tts_voices input
                ttsPreviewInput.style.display = 'none'; // Hide the tts_preview input
            }
        });
    }

    async onApplyClick() {
        return
    }

    async getLang() {
        try {
            const response = await doExtrasFetch(`${getApiUrl()}/api/coqui-tts/multlang`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const voiceData = await response.json();

            const languageSelect = document.getElementById('coqui_language');
            languageSelect.innerHTML = ''; // Clear existing options

            if (Object.keys(voiceData).length === 0) {
                const option = document.createElement('option');
                option.value = 'none';
                option.textContent = 'None';
                languageSelect.appendChild(option);
            } else {
                for (const [key, value] of Object.entries(voiceData)) {
                    const option = document.createElement('option');
                    option.value = key;
                    option.textContent = key + ": " + value;
                    languageSelect.appendChild(option);
                }
            }
        } catch (error) {
            //console.error('Error fetching voice data:', error);

            // Remove all options except "None"
            const languageSelect = document.getElementById('coqui_language');
            languageSelect.innerHTML = '';

            const option = document.createElement('option');
            option.value = 'none';
            option.textContent = 'None';
            languageSelect.appendChild(option);
        }
    }


    async getSpeakers() {
        try {
            const response = await doExtrasFetch(`${getApiUrl()}/api/coqui-tts/multspeaker`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const voiceData = await response.json();

            const speakerSelect = document.getElementById('coqui_speaker');
            speakerSelect.innerHTML = ''; // Clear existing options

            if (Object.keys(voiceData).length === 0) {
                const option = document.createElement('option');
                option.value = 'none';
                option.textContent = 'None';
                speakerSelect.appendChild(option);
            } else {
                for (const [index, name] of Object.entries(voiceData)) {
                    const option = document.createElement('option');
                    option.value = index;
                    option.textContent = index + ": " + name;
                    speakerSelect.appendChild(option);
                }
            }
        } catch (error) {
            //console.error('Error fetching voice data:', error);

            // Remove all options except "None"
            const speakerSelect = document.getElementById('coqui_speaker');
            speakerSelect.innerHTML = '';

            const option = document.createElement('option');
            option.value = 'none';
            option.textContent = 'None';
            speakerSelect.appendChild(option);
        }
    }

    async getModels() {
        try {
            throwIfModuleMissing();
            const response = await doExtrasFetch(`${getApiUrl()}/api/coqui-tts/list`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const voiceIds = await response.json();

            const modelSelect = document.getElementById('coqui_model');
            if (voiceIds.length === 0) {
                const option = document.createElement('option');
                option.value = 'none';
                option.textContent = 'Select Model';
                modelSelect.appendChild(option);
            } else {
                voiceIds.forEach(voiceId => {
                    const option = document.createElement('option');
                    option.value = voiceId;
                    option.textContent = voiceId;
                    modelSelect.appendChild(option);
                });
            }

            // Update provider endpoint on model selection change
            modelSelect.addEventListener('change', () => {
                const selectedModel = modelSelect.value;
                this.LoadModel(selectedModel);
            });
        } catch (error) {
            console.error('Error fetching voice IDs:', error);

            // Add "None" option when the request fails or the response is empty
            const modelSelect = document.getElementById('coqui_model');
            const option = document.createElement('option');
            option.value = 'none';
            option.textContent = 'None';
            modelSelect.appendChild(option);
        }
    }

    async LoadModel(selectedModel) {
        const previewButton = document.getElementById('coqui_preview');
        previewButton.disabled = true;
        previewButton.innerText = "Loading";
        try {
            throwIfModuleMissing();
            const response = await doExtrasFetch(`${getApiUrl()}/api/coqui-tts/load?_model=${selectedModel}`);
            if (!response.ok) {
                throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            this.getSpeakers();
            this.getLang();

            const previewButton = document.getElementById('coqui_preview');
            previewButton.disabled = false;
            previewButton.innerText = "Play";

        } catch (error) {
            console.error('Error updating provider endpoint:', error);
        }
    }

    async getVoice(voiceName) {
        //tts_models--multilingual--multi-dataset--your_tts\model_file.pth[2][1]
        //tts_models--en--ljspeech--glow-tts\model_file.pth

        let _voiceNameOrg = voiceName; // Store the original voiceName in a variable _voiceNameOrg
        voiceName = voiceName.replace(/(\[\d+\])+$/, ''); // For example, converts 'model[2][1]' to 'model'

        this.voices = []; //reset for follow up runs

        if (this.voices.length === 0) { this.voices = await this.fetchCheckMap(); }

        // Search for a voice object in the 'this.voices' array where the 'name' property matches the provided 'voiceName'

        //const match = this.voices.find((CoquiVoice) => CoquiVoice.name === voiceName);
        const match = this.voices.find((CoquiVoice) => CoquiVoice.name === voiceName);

        // If no match is found, throw an error indicating that the TTS Voice name was not found
        if (!match) {
            throw new Error(`TTS Voice name ${voiceName} not found`);
        } else {
            match.name = _voiceNameOrg;
            match.voice_id = _voiceNameOrg;
        }
        // Return the matched voice object (with the 'name' property updated if a match was found)
        return match;
    }

    async fetchCheckMap() {
        const endpoint = `${getApiUrl()}/api/coqui-tts/checkmap`;
        const response = await doExtrasFetch(endpoint);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.json()}`);
        }
        const voiceData = await response.json();
        const voices = voiceData.map((voice) => ({
            id: voice.name,
            name: voice.id, // this is the issue!!!
            voice_id: voice.id, // this is the issue!!!
            //preview_url: false,
            lang: voice.lang,
        }));
        return voices;
    }

    async fetchTtsVoiceIds() {
        throwIfModuleMissing();
        const endpoint = `${getApiUrl()}/api/coqui-tts/speaker_id`;
        const response = await doExtrasFetch(endpoint);

        if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${await response.json()}`);
        }
        const voiceData = await response.json();
        const voices = voiceData.map((voice) => ({
            id: voice.name,
            name: voice.id, //add filename here
            voice_id: voice.id,
            //preview_url: false,
            //preview_url: `${getApiUrl()}/api/coqui-tts/download?model=${voice.id}`,
            //http://localhost:5100/api/coqui-tts/speaker_id/tts_models/en/ljspeech/speedy-speech
            lang: voice.lang,
        }));
        return voices;
    }

    sampleTtsVoice(voiceId) {
        // Get the selected values of speaker and language
        const speakerSelect = document.getElementById('coqui_speaker');
        const languageSelect = document.getElementById('coqui_language');
        const selectedSpeaker = speakerSelect.value;
        const selectedLanguage = languageSelect.value;

        // Construct the URL with the selected values
        const url = `${getApiUrl()}/api/coqui-tts/tts?text=The%20Quick%20Brown%20Fox%20Jumps%20Over%20the%20Lazy%20Dog.&speaker_id=${voiceId}&style_wav=&language_id=${selectedLanguage}&mspker=${selectedSpeaker}`;

        doExtrasFetch(url)
            .then(response => response.blob())
            .then(blob => {
                const audioUrl = URL.createObjectURL(blob);
                // Play the audio
                const audio = new Audio(audioUrl);
                audio.play();
            })
            .catch(error => {
                console.error('Error performing TTS request:', error);
            });
    }

    previewTtsVoice(voiceId) { //button on avail voices
        throwIfModuleMissing();
        const url = `${getApiUrl()}/api/coqui-tts/download?model=${voiceId}`;

        doExtrasFetch(url)
            .then(response => response.text()) // Expecting a text response
            .then(responseText => {
                const isResponseTrue = responseText.trim().toLowerCase() === 'true';

                if (isResponseTrue) {
                    console.log("Downloading Model") //if true
                } else {
                    console.error('Already Installed'); //if false
                }
            })
            .catch(error => {
                console.error('Error performing download:', error);
            });
    }


    async generateTts(text, voiceId) {
        const response = await this.fetchTtsGeneration(text, voiceId)
        return response
    }

    async fetchTtsGeneration(inputText, voiceId) {
        throwIfModuleMissing();
        console.info(`Generating new TTS for voice_id ${voiceId}`);
        const response = await doExtrasFetch(`${getApiUrl()}/api/coqui-tts/tts?text=${encodeURIComponent(inputText)}&speaker_id=${voiceId}`);
        if (!response.ok) {
            toastr.error(response.statusText, 'TTS Generation Failed');
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        if (!response.ok) {
            toastr.error(response.statusText, 'TTS Generation Failed');
            throw new Error(`HTTP ${response.status}: ${await response.text()}`);
        }
        return response
    }

    async fetchTtsFromHistory(history_item_id) {
        return Promise.resolve(history_item_id);
    }

}
