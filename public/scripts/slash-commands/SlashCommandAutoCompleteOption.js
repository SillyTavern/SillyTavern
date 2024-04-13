import { SlashCommand } from './SlashCommand.js';



/**@readonly*/
/**@enum {Number}*/
export const OPTION_TYPE = {
    'COMMAND': 1,
    'QUICK_REPLY': 2,
    'VARIABLE_NAME': 3,
};


export class SlashCommandAutoCompleteOption {
    /**@type {OPTION_TYPE}*/ type;
    /**@type {string|SlashCommand}*/ value;
    /**@type {string}*/ name;


    /**
     * @param {OPTION_TYPE} type
     * @param {string|SlashCommand} value
     * @param {string} name
     */
    constructor(type, value, name) {
        this.type = type;
        this.value = value;
        this.name = name;
    }
}
