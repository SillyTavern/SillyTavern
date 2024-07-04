import { SlashCommandClosure } from './SlashCommandClosure.js';
import { commonEnumProviders } from './SlashCommandCommonEnumsProvider.js';
import { SlashCommandEnumValue } from './SlashCommandEnumValue.js';
import { SlashCommandExecutor } from './SlashCommandExecutor.js';
import { SlashCommandScope } from './SlashCommandScope.js';



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
     * @param {ARGUMENT_TYPE|ARGUMENT_TYPE[]} [props.typeList=[ARGUMENT_TYPE.STRING]] default: ARGUMENT_TYPE.STRING - list of accepted types (from ARGUMENT_TYPE)
     * @param {boolean} [props.isRequired=false] default: false - whether the argument is required (false = optional argument)
     * @param {boolean} [props.acceptsMultiple=false] default: false - whether argument accepts multiple values
     * @param {string|SlashCommandClosure} [props.defaultValue=null] default value if no value is provided
     * @param {string|SlashCommandEnumValue|(string|SlashCommandEnumValue)[]} [props.enumList=[]] list of accepted values
     * @param {(executor:SlashCommandExecutor, scope:SlashCommandScope)=>SlashCommandEnumValue[]} [props.enumProvider=null] function that returns auto complete options
     * @param {boolean} [props.forceEnum=false] default: false - whether the input must match one of the enum values
     */
    static fromProps(props) {
        return new SlashCommandArgument(
            props.description,
            props.typeList ?? [ARGUMENT_TYPE.STRING],
            props.isRequired ?? false,
            props.acceptsMultiple ?? false,
            props.defaultValue ?? null,
            props.enumList ?? [],
            props.enumProvider ?? null,
            props.forceEnum ?? false,
        );
    }

    /**@type {string}*/ description;
    /**@type {ARGUMENT_TYPE[]}*/ typeList = [];
    /**@type {boolean}*/ isRequired = false;
    /**@type {boolean}*/ acceptsMultiple = false;
    /**@type {string|SlashCommandClosure}*/ defaultValue;
    /**@type {SlashCommandEnumValue[]}*/ enumList = [];
    /**@type {(executor:SlashCommandExecutor, scope:SlashCommandScope)=>SlashCommandEnumValue[]}*/ enumProvider = null;
    /**@type {boolean}*/ forceEnum = false;

    /**
     * @param {string} description
     * @param {ARGUMENT_TYPE|ARGUMENT_TYPE[]} types
     * @param {string|SlashCommandClosure} defaultValue
     * @param {string|SlashCommandEnumValue|(string|SlashCommandEnumValue)[]} enums
     * @param {(executor:SlashCommandExecutor, scope:SlashCommandScope)=>SlashCommandEnumValue[]} enumProvider function that returns auto complete options
     */
    constructor(description, types, isRequired = false, acceptsMultiple = false, defaultValue = null, enums = [], enumProvider = null, forceEnum = false) {
        this.description = description;
        this.typeList = types ? Array.isArray(types) ? types : [types] : [];
        this.isRequired = isRequired ?? false;
        this.acceptsMultiple = acceptsMultiple ?? false;
        this.defaultValue = defaultValue;
        this.enumList = (enums ? Array.isArray(enums) ? enums : [enums] : []).map(it=>{
            if (it instanceof SlashCommandEnumValue) return it;
            return new SlashCommandEnumValue(it);
        });
        this.enumProvider = enumProvider;
        this.forceEnum = forceEnum;

        // If no enums were set explictly and the type is one where we know possible enum values, we set them here
        if (!this.enumList.length && this.typeList.length === 1 && this.typeList.includes(ARGUMENT_TYPE.BOOLEAN)) this.enumList = commonEnumProviders.boolean()();
    }
}

export class SlashCommandNamedArgument extends SlashCommandArgument {
    /**
     * Creates an unnamed argument from a properties object.
     * @param {Object} props
     * @param {string} props.name the argument's name
     * @param {string} props.description description of the argument
     * @param {string[]} [props.aliasList=[]] list of aliases
     * @param {ARGUMENT_TYPE|ARGUMENT_TYPE[]} [props.typeList=[ARGUMENT_TYPE.STRING]] default: ARGUMENT_TYPE.STRING - list of accepted types (from ARGUMENT_TYPE)
     * @param {boolean} [props.isRequired=false] default: false - whether the argument is required (false = optional argument)
     * @param {boolean} [props.acceptsMultiple=false] default: false - whether argument accepts multiple values
     * @param {string|SlashCommandClosure} [props.defaultValue=null] default value if no value is provided
     * @param {string|SlashCommandEnumValue|(string|SlashCommandEnumValue)[]} [props.enumList=[]] list of accepted values
     * @param {(executor:SlashCommandExecutor, scope:SlashCommandScope)=>SlashCommandEnumValue[]} [props.enumProvider=null] function that returns auto complete options
     * @param {boolean} [props.forceEnum=false] default: false - whether the input must match one of the enum values
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
            props.enumProvider ?? null,
            props.forceEnum ?? false,
        );
    }

    /**@type {string}*/ name;
    /**@type {string[]}*/ aliasList = [];

    /**
     * @param {string} name
     * @param {string} description
     * @param {ARGUMENT_TYPE|ARGUMENT_TYPE[]} types
     * @param {boolean} [isRequired=false]
     * @param {boolean} [acceptsMultiple=false]
     * @param {string|SlashCommandClosure} [defaultValue=null]
     * @param {string|SlashCommandEnumValue|(string|SlashCommandEnumValue)[]} [enums=[]]
     * @param {string[]} [aliases=[]]
     * @param {(executor:SlashCommandExecutor, scope:SlashCommandScope)=>SlashCommandEnumValue[]} [enumProvider=null] function that returns auto complete options
     * @param {boolean} [forceEnum=false]
     */
    constructor(name, description, types, isRequired = false, acceptsMultiple = false, defaultValue = null, enums = [], aliases = [], enumProvider = null, forceEnum = false) {
        super(description, types, isRequired, acceptsMultiple, defaultValue, enums, enumProvider, forceEnum);
        this.name = name;
        this.aliasList = aliases ? Array.isArray(aliases) ? aliases : [aliases] : [];
    }
}
