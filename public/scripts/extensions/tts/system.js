export { SystemTtsProvider }

class SystemTtsProvider {
    //########//
    // Config //
    //########//

    previewStrings = {
        'en-US': 'The quick brown fox jumps over the lazy dog',
        'en-GB': 'Sphinx of black quartz, judge my vow',
        'fr-FR': 'Portez ce vieux whisky au juge blond qui fume',
        'de-DE': 'Victor jagt zwölf Boxkämpfer quer über den großen Sylter Deich',
        'it-IT': "Pranzo d'acqua fa volti sghembi",
        'es-ES': 'Quiere la boca exhausta vid, kiwi, piña y fugaz jamón',
        'es-MX': 'Fabio me exige, sin tapujos, que añada cerveza al whisky',
        'ru-RU': 'В чащах юга жил бы цитрус? Да, но фальшивый экземпляр!',
        'pt-BR': 'Vejo xá gritando que fez show sem playback.',
        'pt-PR': 'Todo pajé vulgar faz boquinha sexy com kiwi.',
        'uk-UA': "Фабрикуймо гідність, лящім їжею, ґав хапаймо, з'єднавці чаш!",
    }
    fallbackPreview = 'Neque porro quisquam est qui dolorem ipsum quia dolor sit amet'
    settings
    voices = []

    defaultSettings = {
        voiceMap: {},
        rate: 1,
        pitch: 1,
    }

    get settingsHtml() {
        if (!window.speechSynthesis) {
            return "Your browser or operating system doesn't support speech synthesis";
        }

        return `<p>Uses the voices provided by your operating system</p>
        <label for="system_tts_rate">Rate: <span id="system_tts_rate_output"></span></label>
        <input id="system_tts_rate" type="range" value="${this.defaultSettings.rate}" min="0.5" max="2" step="0.1" />
        <label for="system_tts_pitch">Pitch: <span id="system_tts_pitch_output"></span></label>
        <input id="system_tts_pitch" type="range" value="${this.defaultSettings.pitch}" min="0" max="2" step="0.1" />`;
    }

    onSettingsChange() {
        this.settings.rate = Number($('#system_tts_rate').val());
        this.settings.pitch = Number($('#system_tts_pitch').val());
        $('#system_tts_pitch_output').text(this.settings.pitch);
        $('#system_tts_rate_output').text(this.settings.rate);
        console.log('Save changes');
    }

    loadSettings(settings) {
        // Populate Provider UI given input settings
        if (Object.keys(settings).length == 0) {
            console.info("Using default TTS Provider settings");
        }

        // Only accept keys defined in defaultSettings
        this.settings = this.defaultSettings;

        for (const key in settings) {
            if (key in this.settings) {
                this.settings[key] = settings[key];
            } else {
                throw `Invalid setting passed to TTS Provider: ${key}`;
            }
        }

        $('#system_tts_rate').val(this.settings.rate || this.defaultSettings.rate);
        $('#system_tts_pitch').val(this.settings.pitch || this.defaultSettings.pitch);
        $('#system_tts_pitch_output').text(this.settings.pitch);
        $('#system_tts_rate_output').text(this.settings.rate);
        console.info("Settings loaded");
    }

    async onApplyClick() {
        return
    }

    //#################//
    //  TTS Interfaces //
    //#################//
    fetchTtsVoiceIds() {
        if (!window.speechSynthesis) {
            return [];
        }

        return speechSynthesis
            .getVoices()
            .sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name))
            .map(x => ({ name: x.name, voice_id: x.voiceURI, preview_url: false, lang: x.lang }));
    }

    previewTtsVoice(voiceId) {
        const voice = speechSynthesis.getVoices().find(x => x.voiceURI === voiceId);

        if (!voice) {
            throw `TTS Voice name ${voiceName} not found`
        }

        speechSynthesis.cancel();
        const text = this.previewStrings[voice.lang] ?? this.fallbackPreview;
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = voice;
        utterance.rate = 1;
        utterance.pitch = 1;
        speechSynthesis.speak(utterance);
    }

    async getVoice(voiceName) {
        if (!window.speechSynthesis) {
            return { voice_id: null }
        }

        const voices = window.speechSynthesis.getVoices();
        const match = voices.find(x => x.name == voiceName);

        if (!match) {
            throw `TTS Voice name ${voiceName} not found`
        }

        return { voice_id: match.voiceURI, name: match.name };
    }

    async generateTts(text, voiceId) {
        if (!window.speechSynthesis) {
            throw 'Speech synthesis API is not supported';
        }

        const silence = await fetch('/sounds/silence.mp3');

        return new Promise((resolve, reject) => {
            const voices = speechSynthesis.getVoices();
            const voice = voices.find(x => x.voiceURI === voiceId);
            const utterance = new SpeechSynthesisUtterance(text);
            utterance.voice = voice;
            utterance.rate = this.settings.rate || 1;
            utterance.pitch = this.settings.pitch || 1;
            utterance.onend = () => resolve(silence);
            utterance.onerror = () => reject();
            speechSynthesis.speak(utterance);
        });
    }
}
