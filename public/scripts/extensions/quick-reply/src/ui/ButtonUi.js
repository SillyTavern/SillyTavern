import { animation_duration } from '../../../../../script.js';
import { dragElement } from '../../../../RossAscends-mods.js';
import { loadMovingUIState } from '../../../../power-user.js';
// eslint-disable-next-line no-unused-vars
import { QuickReplySettings } from '../QuickReplySettings.js';

export class ButtonUi {
    /**@type {QuickReplySettings}*/ settings;

    /**@type {HTMLElement}*/ dom;
    /**@type {HTMLElement}*/ popoutDom;




    constructor(/**@type {QuickReplySettings}*/settings) {
        this.settings = settings;
    }




    render() {
        if (this.settings.isPopout) {
            return this.renderPopout();
        }
        return this.renderBar();
    }
    unrender() {
        this.dom?.remove();
        this.dom = null;
        this.popoutDom?.remove();
        this.popoutDom = null;
    }

    show() {
        if (!this.settings.isEnabled) return;
        if (this.settings.isPopout) {
            document.body.append(this.render());
            loadMovingUIState();
            $(this.render()).fadeIn(animation_duration);
            dragElement($(this.render()));
        } else {
            const sendForm = document.querySelector('#send_form');
            if (sendForm.children.length > 0) {
                sendForm.children[0].insertAdjacentElement('beforebegin', this.render());
            } else {
                sendForm.append(this.render());
            }
        }
    }
    hide() {
        this.unrender();
    }
    refresh() {
        this.hide();
        this.show();
    }




    renderBar() {
        if (!this.dom) {
            let buttonHolder;
            const root = document.createElement('div'); {
                this.dom = root;
                buttonHolder = root;
                root.id = 'qr--bar';
                root.classList.add('flex-container');
                root.classList.add('flexGap5');
                const popout = document.createElement('div'); {
                    popout.id = 'qr--popoutTrigger';
                    popout.classList.add('menu_button');
                    popout.classList.add('fa-solid');
                    popout.classList.add('fa-window-restore');
                    popout.addEventListener('click', ()=>{
                        this.settings.isPopout = true;
                        this.refresh();
                        this.settings.save();
                    });
                    root.append(popout);
                }
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




    renderPopout() {
        if (!this.popoutDom) {
            let buttonHolder;
            const root = document.createElement('div'); {
                this.popoutDom = root;
                root.id = 'qr--popout';
                root.classList.add('qr--popout');
                root.classList.add('draggable');
                const head = document.createElement('div'); {
                    head.classList.add('qr--header');
                    root.append(head);
                    const controls = document.createElement('div'); {
                        controls.classList.add('qr--controls');
                        controls.classList.add('panelControlBar');
                        controls.classList.add('flex-container');
                        const drag = document.createElement('div'); {
                            drag.id = 'qr--popoutheader';
                            drag.classList.add('fa-solid');
                            drag.classList.add('fa-grip');
                            drag.classList.add('drag-grabber');
                            drag.classList.add('hoverglow');
                            controls.append(drag);
                        }
                        const close = document.createElement('div'); {
                            close.classList.add('qr--close');
                            close.classList.add('fa-solid');
                            close.classList.add('fa-circle-xmark');
                            close.classList.add('hoverglow');
                            close.addEventListener('click', ()=>{
                                this.settings.isPopout = false;
                                this.refresh();
                                this.settings.save();
                            });
                            controls.append(close);
                        }
                        head.append(controls);
                    }
                }
                const body = document.createElement('div'); {
                    buttonHolder = body;
                    body.classList.add('qr--body');
                    if (this.settings.isCombined) {
                        const buttons = document.createElement('div'); {
                            buttonHolder = buttons;
                            buttons.classList.add('qr--buttons');
                            body.append(buttons);
                        }
                    }
                    [...this.settings.config.setList, ...(this.settings.chatConfig?.setList ?? [])]
                        .filter(link=>link.isVisible)
                        .forEach(link=>buttonHolder.append(link.set.render()))
                    ;
                    root.append(body);
                }
            }
        }
        return this.popoutDom;
    }
}
