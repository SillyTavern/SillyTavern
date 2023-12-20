import { QuickReplySettings } from '../QuickReplySettings.js';

export class ButtonUi {
    /**@type {QuickReplySettings}*/ settings;

    /**@type {HTMLElement}*/ dom;




    constructor(/**@type {QuickReplySettings}*/settings) {
        this.settings = settings;
    }




    render() {
        if (!this.dom) {
            let buttonHolder;
            const root = document.createElement('div'); {
                this.dom = root;
                buttonHolder = root;
                root.id = 'qr--bar';
                root.classList.add('flex-container');
                root.classList.add('flexGap5');
                if (this.settings.isCombined) {
                    const buttons = document.createElement('div'); {
                        buttonHolder = buttons;
                        buttons.classList.add('qr--buttons');
                        root.append(buttons);
                    }
                }
                [...this.settings.config.setList, ...(this.settings.chatConfig?.setList ?? [])]
                    .filter(link=>link.isVisible)
                    .forEach(link=>buttonHolder.append(link.set.render()))
                ;
            }
        }
        return this.dom;
    }
    unrender() {
        this.dom?.remove();
        this.dom = null;
    }

    show() {
        if (!this.settings.isEnabled) return;
        const sendForm = document.querySelector('#send_form');
        if (sendForm.children.length > 0) {
            sendForm.children[0].insertAdjacentElement('beforebegin', this.render());
        } else {
            sendForm.append(this.render());
        }
    }
    hide() {
        this.unrender();
    }
    refresh() {
        this.hide();
        this.show();
    }
}
