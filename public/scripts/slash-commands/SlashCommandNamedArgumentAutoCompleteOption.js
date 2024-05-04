import { AutoCompleteOption } from '../autocomplete/AutoCompleteOption.js';
import { SlashCommand } from './SlashCommand.js';
import { SlashCommandNamedArgument } from './SlashCommandArgument.js';
import { SlashCommandNamedArgumentAssignment } from './SlashCommandNamedArgumentAssignment.js';

export class SlashCommandNamedArgumentAutoCompleteOption extends AutoCompleteOption {
    /**@type {SlashCommandNamedArgument}*/ arg;
    /**@type {SlashCommand}*/ cmd;

    /**
     * @param {SlashCommandNamedArgument} arg
     */
    constructor(arg, cmd) {
        super(`${arg.name}=`);
        this.arg = arg;
        this.cmd = cmd;
    }


    renderItem() {
        let li;
        li = this.makeItem(this.name, '⌗', true, [], [], null, `${this.arg.isRequired ? '' : '(optional) '}${this.arg.description ?? ''}`);
        li.setAttribute('data-name', this.name);
        li.setAttribute('data-option-type', 'namedArgument');
        return li;
    }


    renderDetails() {
        const frag = document.createDocumentFragment();
        const specs = document.createElement('div'); {
            specs.classList.add('specs');
            const name = document.createElement('div'); {
                name.classList.add('name');
                name.classList.add('monospace');
                name.textContent = this.name;
                specs.append(name);
            }
            frag.append(specs);
        }
        const help = document.createElement('span'); {
            help.classList.add('help');
            help.innerHTML = `${this.arg.isRequired ? '' : '(optional) '}${this.arg.description ?? ''}`;
            frag.append(help);
        }
        return frag;
    }
}
