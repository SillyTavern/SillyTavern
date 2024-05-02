import { SlashCommand } from './SlashCommand.js';
import { AutoCompleteOption } from '../autocomplete/AutoCompleteOption.js';

export class SlashCommandCommandAutoCompleteOption extends AutoCompleteOption {
    /**@type {SlashCommand}*/ command;


    get value() {
        return this.command;
    }




    /**
     * @param {SlashCommand} command
     * @param {string} name
     */
    constructor(command, name) {
        super(name);
        this.command = command;
    }


    renderItem() {
        let li;
        li = this.command.renderHelpItem(this.name);
        li.setAttribute('data-name', this.name);
        li.setAttribute('data-option-type', 'command');
        return li;
    }


    renderDetails() {
        return this.command.renderHelpDetails(this.name);
    }
}
