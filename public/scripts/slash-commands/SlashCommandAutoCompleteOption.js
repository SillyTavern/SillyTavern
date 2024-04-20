import { SlashCommand } from './SlashCommand.js';



/**@readonly*/
/**@enum {Number}*/
export const OPTION_TYPE = {
    'COMMAND': 1,
    'QUICK_REPLY': 2,
    'VARIABLE_NAME': 3,
    'BLANK': 4,
};

export class SlashCommandFuzzyScore {
    /**@type {number}*/ start;
    /**@type {number}*/ longestConsecutive;

    /**
     * @param {number} start
     * @param {number} longestConsecutive
     */
    constructor(start, longestConsecutive) {
        this.start = start;
        this.longestConsecutive = longestConsecutive;
    }
}


export class SlashCommandAutoCompleteOption {
    /**@type {OPTION_TYPE}*/ type;
    /**@type {string|SlashCommand}*/ value;
    /**@type {string}*/ name;
    /**@type {SlashCommandFuzzyScore}*/ score;
    /**@type {string}*/ replacer;
    /**@type {HTMLElement}*/ dom;


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
