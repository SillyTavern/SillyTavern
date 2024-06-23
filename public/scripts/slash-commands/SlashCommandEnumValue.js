
/**
 * @typedef {'enum' | 'command' | 'namedArgument' | 'variable' | 'qr' | 'macro' | 'number' | 'name'} EnumType
 */

/**
 * Collection of the enum types that can be used with `SlashCommandEnumValue`
 *
 * Contains documentation on which color this will result to
 */
export const enumTypes = {
    /** 'enum' - [string] - light orange @type {EnumType} */
    enum: 'enum',
    /** 'command' - [cmd] - light yellow @type {EnumType} */
    command: 'command',
    /** 'namedArgument' - [argName] - sky blue @type {EnumType} */
    namedArgument: 'namedArgument',
    /** 'variable' - [punctuationL1] - pink @type {EnumType} */
    variable: 'variable',
    /** 'qr' - [variable] - light blue @type {EnumType} */
    qr: 'qr',
    /** 'macro' - [variableLanguage] - blue @type {EnumType} */
    macro: 'macro',
    /** 'number' - [number] - light green @type {EnumType} */
    number: 'number',
    /** 'name' - [type] - forest green @type {EnumType} */
    name: 'name',

    /**
     * Gets the value of the enum type based on the provided index
     *
     * Can be used to get differing colors or even random colors, by providing the index of a unique set
     *
     * @param {number?} index - The index used to retrieve the enum type
     * @return {EnumType} The enum type corresponding to the index
     */
    getBasedOnIndex(index) {
        const keys = Object.keys(this);
        return this[keys[(index ?? 0) % keys.length]];
    }
}

export class SlashCommandEnumValue {
    /**@type {string}*/ value;
    /**@type {string}*/ description;
    /**@type {EnumType}*/ type = 'enum';
    /**@type {string}*/ typeIcon = '◊';

    /**
     * A constructor for creating a SlashCommandEnumValue instance.
     *
     * @param {string} value - The value
     * @param {string?} description - Optional description, displayed in a second line
     * @param {EnumType?} type - type of the enum (defining its color)
     * @param {string} typeIcon - The icon to display (Can be pulled from `enumIcons` for common ones)
     */
    constructor(value, description = null, type = 'enum', typeIcon = '◊') {
        this.value = value;
        this.description = description;
        this.type = type ?? 'enum';
        this.typeIcon = typeIcon;
    }

    toString() {
        return this.value;
    }
}
