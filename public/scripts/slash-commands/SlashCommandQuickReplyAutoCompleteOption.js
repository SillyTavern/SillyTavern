import { AutoCompleteOption } from '../autocomplete/AutoCompleteOption.js';

export class SlashCommandQuickReplyAutoCompleteOption extends AutoCompleteOption {
    /**
     * @param {string} name
     */
    constructor(name) {
        super(name);
    }


    renderItem() {
        let li;
        li = this.makeItem(this.name, 'QR', true);
        li.setAttribute('data-name', this.name);
        li.setAttribute('data-option-type', 'qr');
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
            help.textContent = 'Quick Reply';
            frag.append(help);
        }
        return frag;
    }
}
