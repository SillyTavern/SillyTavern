import { power_user } from './power-user.js';

export function initInputMarkdown() {
    $(document).on('keydown', 'textarea.mdHotkeys', function (e) {
        if (!power_user.enable_md_hotkeys) { return; }

        // Ensure that the element is a textarea
        let textarea = this;
        if (!(textarea instanceof HTMLTextAreaElement)) {
            return;
        }

        // Early return on only control or no control, alt key, and win/cmd key
        if (e.key === 'Control' || !e.ctrlKey || e.altKey || e.metaKey || (e.shiftKey && !(e.ctrlKey && e.shiftKey && e.code === 'Backquote'))) {
            return;
        }
        let charsToAdd = '';
        let possiblePreviousFormattingMargin = 1;

        switch (true) {
            case e.ctrlKey && e.shiftKey && e.code === 'Backquote':
                e.preventDefault();
                e.stopPropagation();
                charsToAdd = '~~';
                possiblePreviousFormattingMargin = 2;
                break;
            case e.ctrlKey && e.code === 'KeyB':
                e.preventDefault();
                e.stopPropagation();
                charsToAdd = '**';
                possiblePreviousFormattingMargin = 2;
                break;
            case e.ctrlKey && e.code === 'KeyI':
                e.preventDefault();
                e.stopPropagation();
                charsToAdd = '*';
                break;
            case e.ctrlKey && e.code === 'KeyU':
                e.preventDefault();
                e.stopPropagation();
                charsToAdd = '__';
                possiblePreviousFormattingMargin = 2;
                break;
            case e.ctrlKey && e.code === 'KeyK':
                e.preventDefault();
                e.stopPropagation();
                charsToAdd = '`';
                break;
            default:
                return; // Early return if no key matches
        }

        let selectedText = '';
        let start = textarea.selectionStart;
        let end = textarea.selectionEnd;
        let beforeCaret = textarea.value.substring(start - 1, start);
        let afterCaret = textarea.value.substring(end, end + 1);
        let isTextSelected = (start !== end);
        let cursorShift = charsToAdd.length;
        let selectedTextandPossibleFormatting = textarea.value.substring(start - possiblePreviousFormattingMargin, end + possiblePreviousFormattingMargin).trim();

        if (isTextSelected) { //if text is selected
            selectedText = textarea.value.substring(start, end);
            if (selectedTextandPossibleFormatting === charsToAdd + selectedText + charsToAdd) {
                // If the selected text is already formatted, remove the formatting

                let expandedStart = start - charsToAdd.length;
                let expandedEnd = end + charsToAdd.length;

                // Ensure expanded range is within the bounds of the text
                if (expandedStart < 0) expandedStart = 0;
                if (expandedEnd > textarea.value.length) expandedEnd = textarea.value.length;

                // Select the expanded range
                textarea.setSelectionRange(expandedStart, expandedEnd);

                // Replace the expanded selection with the original selected text
                document.execCommand('insertText', false, selectedText);
                // Adjust cursor position
                cursorShift = -charsToAdd.length;
            } else {
                // Add formatting to the selected text
                let possibleAddedSpace = '';
                if (selectedText.endsWith(' ')) {
                    possibleAddedSpace = ' ';
                    selectedText = selectedText.substring(0, selectedText.length - 1);
                    end--; // Adjust the end index since we removed the space
                }
                // To add the formatting, we need to select the text first
                textarea.focus();
                document.execCommand('insertText', false, charsToAdd + selectedText + charsToAdd + possibleAddedSpace);
            }
        } else {// No text is selected
            //check 1 character before and after the cursor for non-space characters

            if (beforeCaret !== ' ' && afterCaret !== ' ' && afterCaret !== '' && beforeCaret !== '') { //look for caret in the middle of a word
                //expand the selection range until the next space on both sides
                let midCaretExpandedStart = start - 1;
                let midCaretExpandedEnd = end + 1;
                while (midCaretExpandedStart > 0 && textarea.value.substring(midCaretExpandedStart - 1, midCaretExpandedStart) !== ' ') {
                    midCaretExpandedStart--;
                }
                while (midCaretExpandedEnd < textarea.value.length && textarea.value.substring(midCaretExpandedEnd, midCaretExpandedEnd + 1) !== ' ') {
                    midCaretExpandedEnd++;
                }
                //make a selection of the discovered word
                textarea.setSelectionRange(midCaretExpandedStart, midCaretExpandedEnd);
                //set variables for comparison
                let discoveredWordWithPossibleFormatting = textarea.value.substring(midCaretExpandedStart, midCaretExpandedEnd).trim();
                let discoveredWord = '';

                if (discoveredWordWithPossibleFormatting.endsWith(charsToAdd) && discoveredWordWithPossibleFormatting.startsWith(charsToAdd)) {
                    discoveredWord = textarea.value.substring(midCaretExpandedStart + charsToAdd.length, midCaretExpandedEnd - charsToAdd.length).trim();
                } else {
                    discoveredWord = textarea.value.substring(midCaretExpandedStart, midCaretExpandedEnd).trim();
                }

                if (charsToAdd + discoveredWord + charsToAdd === discoveredWordWithPossibleFormatting) {

                    // Replace the expanded selection with the original discovered word
                    textarea.focus();
                    document.execCommand('insertText', false, discoveredWord);
                    // Adjust cursor position
                    cursorShift = -charsToAdd.length;
                } else { //format did not previously exist, so add it
                    textarea.focus();
                    document.execCommand('insertText', false, charsToAdd + discoveredWord + charsToAdd);
                }


            } else { //caret is not inside a word, so just add the formatting
                textarea.focus();
                textarea.setSelectionRange(start, end);
                selectedText = textarea.value.substring(start, end);
                document.execCommand('insertText', false, charsToAdd + selectedText + charsToAdd);
            }
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
