import { AutoCompleteNameResultBase } from './AutoCompleteNameResultBase.js';
import { AutoCompleteSecondaryNameResult } from './AutoCompleteSecondaryNameResult.js';



export class AutoCompleteNameResult extends AutoCompleteNameResultBase {
    /**
     *
     * @param {string} text The whole text
     * @param {number} index Cursor index within text
     * @param {boolean} isSelect Whether autocomplete was triggered by selecting an autocomplete option
     * @returns {AutoCompleteSecondaryNameResult}
     */
    getSecondaryNameAt(text, index, isSelect) {
        return null;
    }
}
