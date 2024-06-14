import { SlashCommandNamedArgumentAutoCompleteOption } from '../slash-commands/SlashCommandNamedArgumentAutoCompleteOption.js';
import { AutoCompleteOption } from './AutoCompleteOption.js';
// import { AutoCompleteSecondaryNameResult } from './AutoCompleteSecondaryNameResult.js';



export class AutoCompleteNameResult {
    /**@type {string} */ name;
    /**@type {number} */ start;
    /**@type {AutoCompleteOption[]} */ optionList = [];
    /**@type {boolean} */ canBeQuoted = false;
    /**@type {()=>string} */ makeNoMatchText = ()=>`No matches found for "${this.name}"`;
    /**@type {()=>string} */ makeNoOptionsText = ()=>'No options';


    /**
     * @param {string} name Name (potentially partial) of the name at the requested index.
     * @param {number} start Index where the name starts.
     * @param {AutoCompleteOption[]} optionList A list of autocomplete options found in the current scope.
     * @param {boolean} canBeQuoted Whether the name can be inside quotes.
     * @param {()=>string} makeNoMatchText Function that returns text to show when no matches where found.
     * @param {()=>string} makeNoOptionsText Function that returns text to show when no options are available to match against.
     */
    constructor(name, start, optionList = [], canBeQuoted = false, makeNoMatchText = null, makeNoOptionsText = null) {
        this.name = name;
        this.start = start;
        this.optionList = optionList;
        this.canBeQuoted = canBeQuoted;
        this.noMatchText = makeNoMatchText ?? this.makeNoMatchText;
        this.noOptionstext = makeNoOptionsText ?? this.makeNoOptionsText;
    }


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
