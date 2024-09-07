export function initInputMarkdown() {

    $('.mdHotkeys').on('keydown', function (e) {

        //early return on only control or no control
        if (e.key === 'Control' || !e.ctrlKey) {
            return;
        }
        let charsToAdd = '';
        let possiblePreviousFormattingMargin = 1;
        //ctrl+B to add markdown bold (double asterisks)
        if (e.ctrlKey && e.code === 'KeyB') {
            charsToAdd = '**';
            possiblePreviousFormattingMargin = 2;
        }
        //ctrl+I for markdown italics (single asterisk)
        if (e.ctrlKey && e.code === 'KeyI') { charsToAdd = '*'; }
        //ctrl+U for markdown underline (two underscores)
        if (e.ctrlKey && e.code === 'KeyU') {
            e.preventDefault(); //needed for ctrl+u which opens 'view page source' in chrome, but other problems could exist in other browsers
            charsToAdd = '__';
            possiblePreviousFormattingMargin = 2;
        }
        //ctrl+shift+backquote for markdown strikethrough (two tildes)
        if (e.ctrlKey && e.shiftKey && e.code === 'Backquote') {
            charsToAdd = '~~';
            possiblePreviousFormattingMargin = 2;
        }
        //ctrl+backquote for markdown inline code (two backticks)
        if (e.ctrlKey && e.code === 'Backquote') {
            e.preventDefault(); //needed for ctrl+` which 'swaps to previous tab' on chrome
            charsToAdd = '``';
        }

        if (charsToAdd !== '') {
            console.log('Chars to add: ', charsToAdd);
        }

        let selectedText = '';
        let start = $(this).prop('selectionStart');
        let end = $(this).prop('selectionEnd');
        let textareaFullValue = String($(this).val());
        let newFullValue = '';
        let isTextSelected = (start !== end);
        let cursorShift = charsToAdd.length;

        if (isTextSelected) { //if text selected surround it with the appropriate characters
            selectedText = String(textareaFullValue.substring(start, end));

            let selectedTextandPossibleFormatting = String(textareaFullValue.substring(start - possiblePreviousFormattingMargin, end + possiblePreviousFormattingMargin)).trim();
            if (selectedTextandPossibleFormatting === charsToAdd + selectedText + charsToAdd) {
                //if the selected text is already formatted, remove the formatting
                cursorShift = -charsToAdd.length;
                newFullValue = textareaFullValue.substring(0, start - possiblePreviousFormattingMargin) + selectedText + textareaFullValue.substring(end + possiblePreviousFormattingMargin);
            } else {
                //adding formatting to selected text
                let possibleAddedSpace = '';
                if (selectedText.endsWith(' ')) {
                    possibleAddedSpace = ' ';
                    selectedText = selectedText.substring(0, selectedText.length - 1);
                    end--;
                }
                //if the selected text is not formatted, add the formatting
                newFullValue = textareaFullValue.substring(0, start) + charsToAdd + selectedText + charsToAdd + possibleAddedSpace + textareaFullValue.substring(end);
            }
        } else {
            //if there is no selected, add the characters at the cursor position
            newFullValue = textareaFullValue.substring(0, $(this).prop('selectionStart')) + charsToAdd + charsToAdd + textareaFullValue.substring($(this).prop('selectionStart'));
        }

        $(this).val(newFullValue);

        //set the cursor position
        if (isTextSelected) {
            $(this).prop('selectionStart', start + cursorShift);
            $(this).prop('selectionEnd', start + cursorShift + selectedText.length);
        } else {
            $(this).prop('selectionStart', start + cursorShift);
            $(this).prop('selectionEnd', start + cursorShift);
        }

    });
}

