import { SlashCommandAutoCompleteOption } from './SlashCommandAutoCompleteOption.js';

export class SlashCommandBlankAutoCompleteOption extends SlashCommandAutoCompleteOption {
    /**
     * @param {string} value
     */
    constructor(value) {
        super(value, value);
        this.dom = this.renderItem();
    }


    renderItem() {
        const li = document.createElement('li'); {
            li.classList.add('item');
            li.classList.add('blank');
            li.textContent = this.name;
        }
        return li;
    }


    renderDetails() {
        const frag = document.createDocumentFragment();
        return frag;
    }
}
