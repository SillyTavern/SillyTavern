export function initInputMarkdown() {

    $('.mdHotkeys').on('keydown', function (e) {

        // Ensure that the element is a textarea
        let textarea = this;
        if (!(textarea instanceof HTMLTextAreaElement)) {
            return;
        }

        // Early return on only control or no control
        if (e.key === 'Control' || !e.ctrlKey) {
            return;
        }

        let charsToAdd = '';
        let possiblePreviousFormattingMargin = 1;

        switch (true) {
            case e.ctrlKey && e.shiftKey && e.code === 'Backquote':
                charsToAdd = '~~';
                possiblePreviousFormattingMargin = 2;
                break;
            case e.ctrlKey && e.code === 'KeyB':
                charsToAdd = '**';
                possiblePreviousFormattingMargin = 2;
                break;
            case e.ctrlKey && e.code === 'KeyI':
                charsToAdd = '*';
                break;
            case e.ctrlKey && e.code === 'KeyU':
                e.preventDefault(); // Prevent Ctrl+U from opening 'view page source'
                charsToAdd = '__';
                possiblePreviousFormattingMargin = 2;
                break;
            case e.ctrlKey && e.code === 'Backquote':
                e.preventDefault(); // Prevent Ctrl+` from switching tabs in Chrome
                charsToAdd = '``';
                break;
            default:
                return; // Early return if no key matches
        }

        let selectedText = '';
        let start = textarea.selectionStart;
        let end = textarea.selectionEnd;
        let isTextSelected = (start !== end);
        let cursorShift = charsToAdd.length;

        if (isTextSelected) {
            selectedText = textarea.value.substring(start, end);
            let selectedTextandPossibleFormatting = textarea.value.substring(start - possiblePreviousFormattingMargin, end + possiblePreviousFormattingMargin).trim();

            if (selectedTextandPossibleFormatting === charsToAdd + selectedText + charsToAdd) {
                // If the selected text is already formatted, remove the formatting
                cursorShift = -charsToAdd.length;
                textarea.setRangeText(selectedText, start - possiblePreviousFormattingMargin, end + possiblePreviousFormattingMargin, 'end');
            } else {
                // Add formatting to the selected text
                let possibleAddedSpace = '';
                if (selectedText.endsWith(' ')) {
                    possibleAddedSpace = ' ';
                    selectedText = selectedText.substring(0, selectedText.length - 1);
                    end--; // Adjust the end index since we removed the space
                }
                textarea.setRangeText(charsToAdd + selectedText + charsToAdd + possibleAddedSpace, start, end, 'end');
            }
        } else {
            // No text is selected, insert the characters at the cursor position
            textarea.setRangeText(charsToAdd + charsToAdd, start, start, 'end');
        }

        // Manually trigger the 'input' event to make undo/redo work
        let event = new Event('input', { bubbles: true });
        textarea.dispatchEvent(event); // This notifies the browser of a change, allowing undo/redo to function.

        // Update the cursor position
        if (isTextSelected) {
            textarea.selectionStart = start + cursorShift;
            textarea.selectionEnd = start + cursorShift + selectedText.length;
        } else {
            textarea.selectionStart = start + cursorShift;
            textarea.selectionEnd = start + cursorShift;
        }
    });
}
