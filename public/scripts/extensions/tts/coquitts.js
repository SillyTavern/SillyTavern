import { doExtrasFetch, getApiUrl, modules } from "../../extensions.js"

export { CoquiTtsProvider }

class CoquiTtsProvider {
    //########//
    // Config //
    //########//

    settings
    voices = []
    separator = ' .. '

    defaultSettings = {
        provider_endpoint: "http://localhost:5100",
        voiceMap: {}
    }


    get settingsHtml() {
        let html = `
        <div style="display: flex; width: 100%;">
        <div style="flex: 80%;">
          <label for="model">Model:</label>
          <select id="model">
            <option value="none">Select Model</option>
            <!-- Add more model options here -->
          </select>
        </div>
        <div style="flex: 20%; display: flex; justify-content: center;">
            <button id="preview" class="menu_button" type="button" style="width: 100%;">Play</button>
        </div>
      </div>
      
    
        <div style="display: flex; width: 100%;">
        <div style="flex: 1; margin-right: 10px;">
            <label for="speaker">Speaker:</label>
            <select id="speaker">
                <!-- Add more speaker options here -->
            </select>
        </div>
        <div style="flex: 1;">
            <label for="language">Language:</label>
            <select id="language">
                <!-- Add more language options here -->
            </select>
        </div>
    </div>

        <label for="Coqui_tts_endpoint">Provider Endpoint:</label>
        <input id="Coqui_tts_endpoint" type="text" class="text_pole" maxlength="250" value="${this.defaultSettings.provider_endpoint}"/>
        `
        return html
    }

    onSettingsChange() {
        // Used when provider settings are updated from UI
        this.settings.provider_endpoint = $('#Coqui_tts_endpoint').val()
    }

    loadSettings(settings) {
        // Pupulate Provider UI given input settings
        if (Object.keys(settings).length == 0) {
            console.info("Using default TTS Provider settings")
        }
        
        const modelSelect = document.getElementById('model');
        const previewButton = document.getElementById('preview');
        previewButton.addEventListener('click', () => {
            const selectedModel = modelSelect.value;
            this.sampleTtsVoice(selectedModel);
        });//add event listener to button
 
     
        previewButton.disabled = true;
        previewButton.innerText = "Select Model";


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
            if (modules.includes('tts') || modules.includes('Coqui-tts')) {
                const baseUrl = new URL(getApiUrl());
                baseUrl.pathname = '/api/coqui-tts/coqui-tts';
                this.settings.provider_endpoint = baseUrl.toString();
                $('#Coqui_tts_endpoint').val(this.settings.provider_endpoint);
                clearInterval(apiCheckInterval);
            }
        }, 2000);

        $('#Coqui_tts_endpoint').val(this.settings.provider_endpoint)
      
        const textexample = document.getElementById('tts_voice_map');
        textexample.placeholder = 'Enter comma separated map of charName:ttsName[speakerID][langID]. Example: \nAqua:tts_models--en--ljspeech--glow-tts\model_file.pth,\nDarkness:tts_models--multilingual--multi-dataset--your_tts\model_file.pth[2][3]';

        //Load models function
        this.getModels();
        this.onttsCoquiHideButtons();
        console.info("Settings loaded")
    }

    async onttsCoquiHideButtons(){
        // Get references to the select element and the two input elements
        const ttsProviderSelect = document.getElementById('tts_provider');
        const ttsVoicesInput = document.getElementById('tts_voices');
        const ttsPreviewInput = document.getElementById('tts_preview');
    
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
          const response = await fetch(`${this.settings.provider_endpoint}/api/coqui-tts/multlang`);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          const voiceData = await response.json();
      
          const modelSelect = document.getElementById('language');
          modelSelect.innerHTML = ''; // Clear existing options
      
          if (Object.keys(voiceData).length === 0) {
            const option = document.createElement('option');
            option.value = 'none';
            option.textContent = 'None';
            modelSelect.appendChild(option);
          } else {
            for (const [key, value] of Object.entries(voiceData)) {
              const option = document.createElement('option');
              option.value = key;
              option.textContent = key + ": " + value;
              modelSelect.appendChild(option);
            }
          }
        } catch (error) {
          //console.error('Error fetching voice data:', error);
      
          // Remove all options except "None"
          const modelSelect = document.getElementById('language');
          modelSelect.innerHTML = '';
      
          const option = document.createElement('option');
          option.value = 'none';
          option.textContent = 'None';
          modelSelect.appendChild(option);
        } 
      }


      async getSpeakers() {
          try {
            const response = await fetch(`${this.settings.provider_endpoint}/api/coqui-tts/multspeaker`);
            if (!response.ok) {
              throw new Error(`HTTP ${response.status}: ${response.statusText}`);
            }
            const voiceData = await response.json();
        
            const modelSelect = document.getElementById('speaker');
            modelSelect.innerHTML = ''; // Clear existing options
        
            if (Object.keys(voiceData).length === 0) {
              const option = document.createElement('option');
              option.value = 'none';
              option.textContent = 'None';
              modelSelect.appendChild(option);
            } else {
              for (const [index, name] of Object.entries(voiceData)) {
                const option = document.createElement('option');
                option.value = index;
                option.textContent = index + ": " + name;
                modelSelect.appendChild(option);
              }
            }
          } catch (error) {
            //console.error('Error fetching voice data:', error);
        
            // Remove all options except "None"
            const modelSelect = document.getElementById('speaker');
            modelSelect.innerHTML = '';
        
            const option = document.createElement('option');
            option.value = 'none';
            option.textContent = 'None';
            modelSelect.appendChild(option);
          }           
      }
      
      async getModels() {
        try {
          const response = await fetch(`${this.settings.provider_endpoint}/api/coqui-tts/list`);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          const voiceIds = await response.json();
      
          const modelSelect = document.getElementById('model');
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
          const modelSelect = document.getElementById('model');
          const option = document.createElement('option');
          option.value = 'none';
          option.textContent = 'None';
          modelSelect.appendChild(option);
        }
      }

      async LoadModel(selectedModel) {
        const previewButton = document.getElementById('preview');
        previewButton.disabled = true;
        previewButton.innerText = "Loading";
        try {
          const response = await fetch(`${this.defaultSettings.provider_endpoint}/api/coqui-tts/load?_model=${selectedModel}`);
          if (!response.ok) {
            throw new Error(`HTTP ${response.status}: ${response.statusText}`);
          }
          this.getSpeakers();
          this.getLang();

          const previewButton = document.getElementById('preview');
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
      const endpoint = `${this.settings.provider_endpoint}/api/coqui-tts/checkmap`;
      const response = await fetch(endpoint);
  
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
	  const endpoint = `${this.settings.provider_endpoint}/api/coqui-tts/speaker_id`;
	  const response = await fetch(endpoint);

	  if (!response.ok) {
		throw new Error(`HTTP ${response.status}: ${await response.json()}`);
	  }
	  const voiceData = await response.json();
	  const voices = voiceData.map((voice) => ({
		id: voice.name,
		name: voice.id, //add filename here
		voice_id: voice.id, 
    //preview_url: false,
    //preview_url: `${this.settings.provider_endpoint}/api/coqui-tts/download?model=${voice.id}`, 
    //http://localhost:5100/api/coqui-tts/speaker_id/tts_models/en/ljspeech/speedy-speech
		lang: voice.lang,
	  }));
	  return voices;
	}
  
  sampleTtsVoice(voiceId) {
    // Get the selected values of speaker and language
    const speakerSelect = document.getElementById('speaker');
    const languageSelect = document.getElementById('language');
    const selectedSpeaker = speakerSelect.value;
    const selectedLanguage = languageSelect.value;
  
    // Construct the URL with the selected values
    const url = `${this.settings.provider_endpoint}/api/coqui-tts/tts?text=The%20Quick%20Brown%20Fox%20Jumps%20Over%20the%20Lazy%20Dog.&speaker_id=${voiceId}&style_wav=&language_id=${selectedLanguage}&mspker=${selectedSpeaker}`;
  
    fetch(url)
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
    const url = `${this.settings.provider_endpoint}/api/coqui-tts/download?model=${voiceId}`;
  
    fetch(url)
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
  
  
	async generateTts(text, voiceId){
        const response = await this.fetchTtsGeneration(text, voiceId)
        return response
    }

	async fetchTtsGeneration(inputText, voiceId) {
    console.info(`Generating new TTS for voice_id ${voiceId}`);
    const response = await fetch(`${this.settings.provider_endpoint}/api/coqui-tts/tts?text=${encodeURIComponent(inputText)}&speaker_id=${voiceId}`);
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
