// Borrowed from Agnai (AGPLv3)
// https://github.com/agnaistic/agnai/blob/dev/web/pages/Chat/components/SpeechRecognitionRecorder.tsx
// First version by Cohee#1207
// Adapted by Tony-sama

import { getContext } from "../../extensions.js";

export { BrowserSttProvider }

class BrowserSttProvider {
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

    static capitalizeInterim(interimTranscript) {
        let capitalizeIndex = -1;
        if (interimTranscript.length > 2 && interimTranscript[0] === ' ') capitalizeIndex = 1;
        else if (interimTranscript.length > 1) capitalizeIndex = 0;
        if (capitalizeIndex > -1) {
            const spacing = capitalizeIndex > 0 ? ' '.repeat(capitalizeIndex - 1) : '';
            const capitalized = interimTranscript[capitalizeIndex].toLocaleUpperCase();
            const rest = interimTranscript.substring(capitalizeIndex + 1);
            interimTranscript = spacing + capitalized + rest;
        }
        return interimTranscript;
    }
    
    static composeValues(previous, interim) {
        let spacing = '';
        if (previous.endsWith('.')) spacing = ' ';
        return previous + spacing + interim;
    }

    loadSettings(settings) {
        // Populate Provider UI given input settings
        if (Object.keys(settings).length == 0) {
            console.debug("<STT-Browser-module> Using default browser STT settings")
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

        (function ($) {
            $.fn.speechRecognitionPlugin = function (options) {
                const settings = $.extend({
                    grammar: '' // Custom grammar
                }, options);

                const speechRecognition = window.SpeechRecognition || window.webkitSpeechRecognition;
                const speechRecognitionList = window.SpeechGrammarList || window.webkitSpeechGrammarList;

                if (!speechRecognition) {
                    console.warn('Speech recognition is not supported in this browser.');
                    $("#microphone_button").hide();
                    toastr.error("Speech recognition is not supported in this browser, use another browser or another STT provider of SillyTavern-extras STT extension.", "STT activation Failed (Browser)", { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
                    return;
                }

                const recognition = new speechRecognition();

                if (settings.grammar && speechRecognitionList) {
                    speechRecognitionList.addFromString(settings.grammar, 1);
                    recognition.grammars = speechRecognitionList;
                }

                recognition.continuous = true;
                recognition.interimResults = true;
                // TODO: This should be configurable.
                recognition.lang = 'en-US'; // Set the language to English (US).

                const $textarea = this;
                //const $button = $('<div class="fa-solid fa-microphone speech-toggle" title="Click to speak"></div>');
                //$('#send_but_sheld').prepend($button);
                const $button = $('#microphone_button');

                let listening = false;
                //$button.on('click', function () {
                $button.off('click').on("click", function () {
                    if (listening) {
                        recognition.stop();
                    } else {
                        recognition.start();
                    }
                    listening = !listening;
                });

                let initialText = '';

                recognition.onresult = function (speechEvent) {
                    let finalTranscript = '';
                    let interimTranscript = ''

                    for (let i = speechEvent.resultIndex; i < speechEvent.results.length; ++i) {
                    const transcript = speechEvent.results[i][0].transcript;

                    if (speechEvent.results[i].isFinal) {
                        let interim = BrowserSttProvider.capitalizeInterim(transcript);
                        if (interim != '') {
                        let final = finalTranscript;
                        final = BrowserSttProvider.composeValues(final, interim);
                        if (final.slice(-1) != '.') final += '.';
                        finalTranscript = final;
                        recognition.abort();
                        listening = false;
                        }
                        interimTranscript = ' ';
                    } else {
                        interimTranscript += transcript;
                    }
                    }

                    interimTranscript = BrowserSttProvider.capitalizeInterim(interimTranscript);
                        
                    $textarea.val(initialText + finalTranscript + interimTranscript);
                };

                recognition.onerror = function (event) {
                    console.error('Error occurred in recognition:', event.error);
                    //if ($('#stt_debug').is(':checked'))
                    //    toastr.error('Error occurred in recognition:'+ event.error, 'STT Generation error (Browser)', { timeOut: 10000, extendedTimeOut: 20000, preventDuplicates: true });
                };

                recognition.onend = function () {
                    listening = false;
                    $button.toggleClass('fa-microphone fa-microphone-slash');

                    if ($("#stt_message_mode").val() == "auto_send") {
                        const context = getContext();
                        context.generate();
                    }
                };

                recognition.onstart = function () {
                    initialText = $textarea.val();
                    $button.toggleClass('fa-microphone fa-microphone-slash');
                    
                    if ($("#stt_message_mode").val() == "replace") {
                        $textarea.val("");
                        initialText = ""
                    }
                };
            };
        }(jQuery));

        jQuery(() => {
            const $textarea = $('#send_textarea');
            $textarea.speechRecognitionPlugin();
        });
        
        console.debug("<STT-Browser-module> Browser STT settings loaded")
    }
}
