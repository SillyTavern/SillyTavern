import { AutoCompleteOption } from './AutoCompleteOption.js';

export class BlankAutoCompleteOption extends AutoCompleteOption {
    /**
     * @param {string} name
     */
    constructor(name) {
        super(name);
        this.dom = this.renderItem();
    }

    get value() { return null; }


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
