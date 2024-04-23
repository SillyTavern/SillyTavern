import { SlashCommandClosure } from './SlashCommandClosure.js';



/**@readonly*/
/**@enum {string}*/
export const ARGUMENT_TYPE = {
    'STRING': 'string',
    'NUMBER': 'number',
    'BOOLEAN': 'bool',
    'VARIABLE_NAME': 'varname',
    'CLOSURE': 'closure',
    'SUBCOMMAND': 'subcommand',
    'LIST': 'list',
    'DICTIONARY': 'dictionary',
};



export class SlashCommandArgument {
    /**@type {string}*/ description;
    /**@type {ARGUMENT_TYPE[]}*/ typeList = [];
    /**@type {boolean}*/ isRequired = false;
    /**@type {boolean}*/ acceptsMultiple = false;
    /**@type {string|SlashCommandClosure}*/ defaultValue;
    /**@type {string[]}*/ enumList = [];

    /**
     * @param {string} description
     * @param {ARGUMENT_TYPE|ARGUMENT_TYPE[]} types
     * @param {string|SlashCommandClosure} defaultValue
     * @param {string|string[]} enums
     */
    constructor(description, types, isRequired = false, acceptsMultiple = false, defaultValue = null, enums = []) {
        this.description = description;
        this.typeList = types ? Array.isArray(types) ? types : [types] : [];
        this.isRequired = isRequired ?? false;
        this.acceptsMultiple = acceptsMultiple ?? false;
        this.defaultValue = defaultValue;
        this.enumList = enums ? Array.isArray(enums) ? enums : [enums] : [];
    }
}



export class SlashCommandNamedArgument extends SlashCommandArgument {
    /**@type {string}*/ name;
    /**@type {string[]}*/ aliasList = [];

    /**
     * @param {string} name
     * @param {string} description
     * @param {ARGUMENT_TYPE|ARGUMENT_TYPE[]} types
     * @param {string|SlashCommandClosure} defaultValue
     * @param {string|string[]} enums
     */
    constructor(name, description, types, isRequired = false, acceptsMultiple = false, defaultValue = null, enums = [], aliases = []) {
        super(name, description, types, isRequired, acceptsMultiple, defaultValue, enums);
        this.name = name;
        this.aliasList = aliases ? Array.isArray(aliases) ? aliases : [aliases] : [];
    }
}
