// Borrowed from Agnai (AGPLv3)
// https://github.com/agnaistic/agnai/blob/dev/web/pages/Chat/components/SpeechRecognitionRecorder.tsx
function capitalizeInterim(interimTranscript) {
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

function composeValues(previous, interim) {
    let spacing = '';
    if (previous.endsWith('.')) spacing = ' ';
    return previous + spacing + interim;
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
        const $button = $('<div class="fa-solid fa-microphone speech-toggle" title="Click to speak"></div>');
        $('#send_but_sheld').prepend($button);

        let listening = false;
        $button.on('click', function () {
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
                let interim = capitalizeInterim(transcript);
                if (interim != '') {
                  let final = finalTranscript;
                  final = composeValues(final, interim) + '.';
                  finalTranscript = final;
                  recognition.abort();
                  listening = false;
                }
                interimTranscript = ' ';
              } else {
                interimTranscript += transcript;
              }
            }

            interimTranscript = capitalizeInterim(interimTranscript);

            $textarea.val(initialText + finalTranscript + interimTranscript);
        };

        recognition.onerror = function (event) {
            console.error('Error occurred in recognition:', event.error);
        };

        recognition.onend = function () {
            listening = false;
            $button.toggleClass('fa-microphone fa-microphone-slash');
        };

        recognition.onstart = function () {
            initialText = $textarea.val();
            $button.toggleClass('fa-microphone fa-microphone-slash');
        };
    };
}(jQuery));

jQuery(() => {
    const $textarea = $('#send_textarea');
    $textarea.speechRecognitionPlugin();
});
