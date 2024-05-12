import { AutoCompleteOption } from '../autocomplete/AutoCompleteOption.js';
import { SlashCommandEnumValue } from './SlashCommandEnumValue.js';

export class SlashCommandEnumAutoCompleteOption extends AutoCompleteOption {
    /**@type {SlashCommandEnumValue}*/ enumValue;



    /**
     * @param {SlashCommandEnumValue} enumValue
     */
    constructor(enumValue) {
        super(enumValue.value, '◊');
        this.enumValue = enumValue;
    }


    renderItem() {
        let li;
        li = this.makeItem(this.name, '◊', true, [], [], null, this.enumValue.description);
        li.setAttribute('data-name', this.name);
        li.setAttribute('data-option-type', 'enum');
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
            help.textContent = this.enumValue.description;
            frag.append(help);
        }
        return frag;
    }
}
