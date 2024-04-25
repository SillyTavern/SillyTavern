import { SlashCommandAutoCompleteOption } from './SlashCommandAutoCompleteOption.js';


/**@readonly*/
/**@enum {number}*/
export const NAME_RESULT_TYPE = {
    'COMMAND': 1,
    'CLOSURE': 2,
};



export class SlashCommandParserNameResult {
    /**@type {NAME_RESULT_TYPE} */ type;
    /**@type {string} */ name;
    /**@type {number} */ start;
    /**@type {SlashCommandAutoCompleteOption[]} */ optionList = [];
    /**@type {boolean} */ canBeQuoted = false;
    /**@type {()=>string} */ makeNoMatchText = ()=>`No matches found for "${this.name}"`;
    /**@type {()=>string} */ makeNoOptionstext = ()=>'No options';


    /**
     * @param {NAME_RESULT_TYPE} type Type of the name at the requested index.
     * @param {string} name Name (potentially partial) of the name at the requested index.
     * @param {number} start Index where the name starts.
     * @param {SlashCommandAutoCompleteOption[]} optionList A list of autocomplete options found in the current scope.
     * @param {boolean} canBeQuoted Whether the name can be inside quotes.
     * @param {()=>string} makeNoMatchText Function that returns text to show when no matches where found.
     * @param {()=>string} makeNoOptionsText Function that returns text to show when no options are available to match against.
     */
    constructor(type, name, start, optionList = [], canBeQuoted = false, makeNoMatchText = null, makeNoOptionsText = null) {
        this.type = type;
        this.name = name;
        this.start = start;
        this.optionList = optionList;
        this.canBeQuoted = canBeQuoted;
        this.noMatchText = makeNoMatchText ?? this.makeNoMatchText;
        this.noOptionstext = makeNoOptionsText ?? this.makeNoOptionstext;
    }
}
