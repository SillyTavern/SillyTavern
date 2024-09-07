export function initInputMarkdown() {

    $('.mdHotkeys').on('keydown', function (e) {
        if (!e.ctrlKey) { return; }
        console.warn('saw ctrl keydown');
        let charsToAdd = '';
        //ctrl+B to add markdown bold (double asterisks)
        if (e.ctrlKey && e.code === 'KeyB') { charsToAdd = '**'; }
        //ctrl+I for markdown italics (single asterisk)
        if (e.ctrlKey && e.code === 'KeyI') { charsToAdd = '*'; }
        //ctrl+U for markdown underline (two underscores)
        if (e.ctrlKey && e.code === 'KeyU') {
            e.preventDefault(); //needed for ctrl+u which opens 'view page source' in chrome, but other problems could exist in other browsers
            charsToAdd = '__';
        }
        //ctrl+shift+backquote for markdown strikethrough (two tildes)
        if (e.ctrlKey && e.shiftKey && e.code === 'Backquote') { charsToAdd = '~~'; }
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

        if (isTextSelected) { //if text selected surround it with the appropriate characters
            selectedText = String(textareaFullValue.substring(start, end));
            newFullValue = textareaFullValue.substring(0, $(this).prop('selectionStart')) + charsToAdd + selectedText + charsToAdd + textareaFullValue.substring($(this).prop('selectionEnd'));
        } else {
            //if there is no selected, add the characters at the cursor position
            newFullValue = textareaFullValue.substring(0, $(this).prop('selectionStart')) + charsToAdd + charsToAdd + textareaFullValue.substring($(this).prop('selectionStart'));
        }

        $(this).val(newFullValue);

        //set the cursor position
        if (isTextSelected) {
            $(this).prop('selectionStart', start + charsToAdd.length);
            $(this).prop('selectionEnd', start + charsToAdd.length + selectedText.length);
        } else {
            $(this).prop('selectionStart', start + charsToAdd.length);
            $(this).prop('selectionEnd', start + charsToAdd.length);
        }

    });
}

