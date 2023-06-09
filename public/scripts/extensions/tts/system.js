import { isMobile } from "../../RossAscends-mods.js";
import { getPreviewString } from "./index.js";

export { SystemTtsProvider }

/**
 * Chunkify
 * Google Chrome Speech Synthesis Chunking Pattern
 * Fixes inconsistencies with speaking long texts in speechUtterance objects
 * Licensed under the MIT License
 *
 * Peter Woolley and Brett Zamir
 * Modified by Haaris for bug fixes
 */

var speechUtteranceChunker = function (utt, settings, callback) {
    settings = settings || {};
    var newUtt;
    var txt = (settings && settings.offset !== undefined ? utt.text.substring(settings.offset) : utt.text);
    if (utt.voice && utt.voice.voiceURI === 'native') { // Not part of the spec
        newUtt = utt;
        newUtt.text = txt;
        newUtt.addEventListener('end', function () {
            if (speechUtteranceChunker.cancel) {
                speechUtteranceChunker.cancel = false;
            }
            if (callback !== undefined) {
                callback();
            }
        });
    }
    else {
        var chunkLength = (settings && settings.chunkLength) || 160;
        var pattRegex = new RegExp('^[\\s\\S]{' + Math.floor(chunkLength / 2) + ',' + chunkLength + '}[.!?,]{1}|^[\\s\\S]{1,' + chunkLength + '}$|^[\\s\\S]{1,' + chunkLength + '} ');
        var chunkArr = txt.match(pattRegex);

        if (chunkArr == null || chunkArr[0] === undefined || chunkArr[0].length <= 2) {
            //call once all text has been spoken...
            if (callback !== undefined) {
                callback();
            }
            return;
        }
        var chunk = chunkArr[0];
        newUtt = new SpeechSynthesisUtterance(chunk);
        var x;
        for (x in utt) {
            if (utt.hasOwnProperty(x) && x !== 'text') {
                newUtt[x] = utt[x];
            }
        }
        newUtt.lang = utt.lang;
        newUtt.voice = utt.voice;
        newUtt.addEventListener('end', function () {
            if (speechUtteranceChunker.cancel) {
                speechUtteranceChunker.cancel = false;
                return;
            }
            settings.offset = settings.offset || 0;
            settings.offset += chunk.length;
            speechUtteranceChunker(utt, settings, callback);
        });
    }

    if (settings.modifier) {
        settings.modifier(newUtt);
    }
    console.log(newUtt); //IMPORTANT!! Do not remove: Logging the object out fixes some onend firing issues.
    //placing the speak invocation inside a callback fixes ordering and onend issues.
    setTimeout(function () {
        speechSynthesis.speak(newUtt);
    }, 0);
};

class SystemTtsProvider {
    //########//
    // Config //
    //########//

    settings
    voices = []
    separator = ' ... '

    defaultSettings = {
        voiceMap: {},
        rate: 1,
        pitch: 1,
    }

    get settingsHtml() {
        if (!('speechSynthesis' in window)) {
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

        // iOS should only allows speech synthesis trigged by user interaction
        if (isMobile()) {
            let hasEnabledVoice = false;

            document.addEventListener('click', () => {
                if (hasEnabledVoice) {
                    return;
                }
                const utterance = new SpeechSynthesisUtterance('hi');
                utterance.volume = 0;
                speechSynthesis.speak(utterance);
                hasEnabledVoice = true;
            });
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
        if (!('speechSynthesis' in window)) {
            return [];
        }

        return speechSynthesis
            .getVoices()
            .sort((a, b) => a.lang.localeCompare(b.lang) || a.name.localeCompare(b.name))
            .map(x => ({ name: x.name, voice_id: x.voiceURI, preview_url: false, lang: x.lang }));
    }

    previewTtsVoice(voiceId) {
        if (!('speechSynthesis' in window)) {
            throw 'Speech synthesis API is not supported';
        }

        const voice = speechSynthesis.getVoices().find(x => x.voiceURI === voiceId);

        if (!voice) {
            throw `TTS Voice name ${voiceName} not found`
        }

        speechSynthesis.cancel();
        const text = getPreviewString(voice.lang);
        const utterance = new SpeechSynthesisUtterance(text);
        utterance.voice = voice;
        utterance.rate = 1;
        utterance.pitch = 1;
        speechSynthesis.speak(utterance);
    }

    async getVoice(voiceName) {
        if (!('speechSynthesis' in window)) {
            return { voice_id: null }
        }

        const voices = speechSynthesis.getVoices();
        const match = voices.find(x => x.name == voiceName);

        if (!match) {
            throw `TTS Voice name ${voiceName} not found`
        }

        return { voice_id: match.voiceURI, name: match.name };
    }

    async generateTts(text, voiceId) {
        if (!('speechSynthesis' in window)) {
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
            speechUtteranceChunker(utterance, {
                chunkLength: 200,
            }, function () {
                //some code to execute when done
                console.log('System TTS done');
            });
        });
    }
}
