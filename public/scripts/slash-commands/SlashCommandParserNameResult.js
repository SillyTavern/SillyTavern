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


    /**
     * @param {NAME_RESULT_TYPE} type Type of the name at the requested index.
     * @param {string} name Name (potentially partial) of the name at the requested index.
     * @param {number} start Index where the name starts.
     * @param {SlashCommandAutoCompleteOption[]} optionList A list of autocomplete options found in the current scope.
     */
    constructor(type, name, start, optionList = []) {
        this.type = type;
        this.name = name;
        this.start = start;
        this.optionList = optionList;
    }
}
