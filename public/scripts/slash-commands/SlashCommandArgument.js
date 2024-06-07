import { SlashCommandClosure } from './SlashCommandClosure.js';
import { SlashCommandEnumValue } from './SlashCommandEnumValue.js';



/**@readonly*/
/**@enum {string}*/
export const ARGUMENT_TYPE = {
    'STRING': 'string',
    'NUMBER': 'number',
    'RANGE': 'range',
    'BOOLEAN': 'bool',
    'VARIABLE_NAME': 'varname',
    'CLOSURE': 'closure',
    'SUBCOMMAND': 'subcommand',
    'LIST': 'list',
    'DICTIONARY': 'dictionary',
};



export class SlashCommandArgument {
    /**
     * Creates an unnamed argument from a properties object.
     * @param {Object} props
     * @param {string} props.description description of the argument
     * @param {ARGUMENT_TYPE|ARGUMENT_TYPE[]} props.typeList default: ARGUMENT_TYPE.STRING - list of accepted types (from ARGUMENT_TYPE)
     * @param {boolean} [props.isRequired] default: false - whether the argument is required (false = optional argument)
     * @param {boolean} [props.acceptsMultiple] default: false - whether argument accepts multiple values
     * @param {string|SlashCommandClosure} [props.defaultValue] default value if no value is provided
     * @param {string|SlashCommandEnumValue|(string|SlashCommandEnumValue)[]} [props.enumList] list of accepted values
     */
    static fromProps(props) {
        return new SlashCommandArgument(
            props.description,
            props.typeList ?? [ARGUMENT_TYPE.STRING],
            props.isRequired ?? false,
            props.acceptsMultiple ?? false,
            props.defaultValue ?? null,
            props.enumList ?? [],
        );
    }




    /**@type {string}*/ description;
    /**@type {ARGUMENT_TYPE[]}*/ typeList = [];
    /**@type {boolean}*/ isRequired = false;
    /**@type {boolean}*/ acceptsMultiple = false;
    /**@type {string|SlashCommandClosure}*/ defaultValue;
    /**@type {SlashCommandEnumValue[]}*/ enumList = [];


    /**
     * @param {string} description
     * @param {ARGUMENT_TYPE|ARGUMENT_TYPE[]} types
     * @param {string|SlashCommandClosure} defaultValue
     * @param {string|SlashCommandEnumValue|(string|SlashCommandEnumValue)[]} enums
     */
    constructor(description, types, isRequired = false, acceptsMultiple = false, defaultValue = null, enums = []) {
        this.description = description;
        this.typeList = types ? Array.isArray(types) ? types : [types] : [];
        this.isRequired = isRequired ?? false;
        this.acceptsMultiple = acceptsMultiple ?? false;
        this.defaultValue = defaultValue;
        this.enumList = (enums ? Array.isArray(enums) ? enums : [enums] : []).map(it=>{
            if (it instanceof SlashCommandEnumValue) return it;
            return new SlashCommandEnumValue(it);
        });
    }
}



export class SlashCommandNamedArgument extends SlashCommandArgument {
    /**
     * Creates an unnamed argument from a properties object.
     * @param {Object} props
     * @param {string} props.name the argument's name
     * @param {string[]} [props.aliasList] list of aliases
     * @param {string} props.description description of the argument
     * @param {ARGUMENT_TYPE|ARGUMENT_TYPE[]} props.typeList default: ARGUMENT_TYPE.STRING - list of accepted types (from ARGUMENT_TYPE)
     * @param {boolean} [props.isRequired] default: false - whether the argument is required (false = optional argument)
     * @param {boolean} [props.acceptsMultiple] default: false - whether argument accepts multiple values
     * @param {string|SlashCommandClosure} [props.defaultValue] default value if no value is provided
     * @param {string|SlashCommandEnumValue|(string|SlashCommandEnumValue)[]} [props.enumList] list of accepted values
     */
    static fromProps(props) {
        return new SlashCommandNamedArgument(
            props.name,
            props.description,
            props.typeList ?? [ARGUMENT_TYPE.STRING],
            props.isRequired ?? false,
            props.acceptsMultiple ?? false,
            props.defaultValue ?? null,
            props.enumList ?? [],
            props.aliasList ?? [],
        );
    }




    /**@type {string}*/ name;
    /**@type {string[]}*/ aliasList = [];


    /**
     * @param {string} name
     * @param {string} description
     * @param {ARGUMENT_TYPE|ARGUMENT_TYPE[]} types
     * @param {string|SlashCommandClosure} defaultValue
     * @param {string|SlashCommandEnumValue|(string|SlashCommandEnumValue)[]} enums
     */
    constructor(name, description, types, isRequired = false, acceptsMultiple = false, defaultValue = null, enums = [], aliases = []) {
        super(description, types, isRequired, acceptsMultiple, defaultValue, enums);
        this.name = name;
        this.aliasList = aliases ? Array.isArray(aliases) ? aliases : [aliases] : [];
    }
}
