import { SlashCommandExecutor } from './SlashCommandExecutor.js';
import { SlashCommandScope } from './SlashCommandScope.js';

export class SlashCommandEnumValue {
    /**@type {string}*/ value;
    /**@type {string}*/ description;
    /**@type {string}*/ type = 'enum';
    /**@type {string}*/ typeIcon = '◊';
    /**@type {(input:string)=>boolean}*/ matchProvider;
    /**@type {(input:string)=>string}*/ valueProvider;

    constructor(value, description = null, type = 'enum', typeIcon = '◊', matchProvider, valueProvider) {
        this.value = value;
        this.description = description;
        this.type = type;
        this.typeIcon = typeIcon;
        this.matchProvider = matchProvider;
        this.valueProvider = valueProvider;
    }

    toString() {
        return this.value;
    }
}
