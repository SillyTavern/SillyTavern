import { SlashCommand } from './SlashCommand.js';
import { SlashCommandAutoCompleteOption } from './SlashCommandAutoCompleteOption.js';

export class SlashCommandCommandAutoCompleteOption extends SlashCommandAutoCompleteOption {
    /**@type {SlashCommand} */
    get cmd() {
        // @ts-ignore
        return this.value;
    }
    /**
     * @param {SlashCommand} value
     * @param {string} name
     */
    constructor(value, name) {
        super(value, name);
    }


    renderItem() {
        let li;
        li = this.cmd.renderHelpItem(this.name);
        li.setAttribute('data-name', this.name);
        return li;
    }


    renderDetails() {
        return this.cmd.renderHelpDetails(this.name);
    }
}
