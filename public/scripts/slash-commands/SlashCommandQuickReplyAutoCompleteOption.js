import { SlashCommandAutoCompleteOption } from './SlashCommandAutoCompleteOption.js';

export class SlashCommandQuickReplyAutoCompleteOption extends SlashCommandAutoCompleteOption {
    /**
     * @param {string} value
     */
    constructor(value) {
        super(value, value);
    }


    renderItem() {
        let li;
        li = this.makeItem(this.name, 'QR', true);
        li.setAttribute('data-name', this.name);
        return li;
    }


    renderDetails() {
        const frag = document.createDocumentFragment();
        const specs = document.createElement('div'); {
            specs.classList.add('specs');
            const name = document.createElement('div'); {
                name.classList.add('name');
                name.classList.add('monospace');
                name.textContent = this.value.toString();
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
