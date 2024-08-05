import { AutoCompleteOption } from '../autocomplete/AutoCompleteOption.js';
import { SlashCommand } from './SlashCommand.js';
import { SlashCommandEnumValue } from './SlashCommandEnumValue.js';

export class SlashCommandEnumAutoCompleteOption extends AutoCompleteOption {
    /**
     * @param {SlashCommand} cmd
     * @param {SlashCommandEnumValue} enumValue
     * @returns {SlashCommandEnumAutoCompleteOption}
     */
    static from(cmd, enumValue) {
        const mapped = this.valueToOptionMap.find(it=>enumValue instanceof it.value)?.option ?? this;
        return new mapped(cmd, enumValue);
    }
    /**@type {{value:(typeof SlashCommandEnumValue), option:(typeof SlashCommandEnumAutoCompleteOption)}[]} */
    static valueToOptionMap = [];
    /**@type {SlashCommand}*/ cmd;
    /**@type {SlashCommandEnumValue}*/ enumValue;



    /**
     * @param {SlashCommand} cmd
     * @param {SlashCommandEnumValue} enumValue
     */
    constructor(cmd, enumValue) {
        super(enumValue.value, enumValue.typeIcon, enumValue.type, enumValue.matchProvider, enumValue.valueProvider, enumValue.makeSelectable);
        this.cmd = cmd;
        this.enumValue = enumValue;
    }


    renderItem() {
        let li;
        li = this.makeItem(this.name, this.typeIcon, true, [], [], null, this.enumValue.description);
        li.setAttribute('data-name', this.name);
        li.setAttribute('data-option-type', this.type);
        return li;
    }


    renderDetails() {
        return this.cmd.renderHelpDetails();
    }
}
