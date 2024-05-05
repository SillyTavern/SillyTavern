import { AutoCompleteOption } from './AutoCompleteOption.js';

export class MacroAutoCompleteOption extends AutoCompleteOption {
    /**@type {string}*/ fullName;
    /**@type {string}*/ description;


    constructor(name, fullName, description) {
        super(name, '{}');
        this.fullName = fullName;
        this.description = description;
        this.nameOffset = 2;
    }


    renderItem() {
        let li;
        li = this.makeItem(`${this.fullName}`, '{}', true, [], [], null, this.description);
        li.setAttribute('data-name', this.name);
        li.setAttribute('data-option-type', 'macro');
        return li;
    }


    renderDetails() {
        const frag = document.createDocumentFragment();
        const specs = document.createElement('div'); {
            specs.classList.add('specs');
            const name = document.createElement('div'); {
                name.classList.add('name');
                name.classList.add('monospace');
                name.textContent = this.fullName;
                specs.append(name);
            }
            frag.append(specs);
        }
        const help = document.createElement('span'); {
            help.classList.add('help');
            help.innerHTML = this.description;
            frag.append(help);
        }
        return frag;
    }
}
