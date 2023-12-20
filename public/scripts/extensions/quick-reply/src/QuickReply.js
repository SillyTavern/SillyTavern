import { callPopup } from '../../../../script.js';
import { getSortableDelay } from '../../../utils.js';
import { log, warn } from '../index.js';
import { QuickReplyContextLink } from './QuickReplyContextLink.js';
import { QuickReplySet } from './QuickReplySet.js';

export class QuickReply {
    /**
     * @param {{ id?: number; contextList?: any; }} props
     */
    static from(props) {
        props.contextList = (props.contextList ?? []).map((/** @type {any} */ it)=>QuickReplyContextLink.from(it));
        return Object.assign(new this(), props);
    }




    /**@type {Number}*/ id;
    /**@type {String}*/ label = '';
    /**@type {String}*/ title = '';
    /**@type {String}*/ message = '';

    /**@type {QuickReplyContextLink[]}*/ contextList;

    /**@type {Boolean}*/ isHidden = false;
    /**@type {Boolean}*/ executeOnStartup = false;
    /**@type {Boolean}*/ executeOnUser = false;
    /**@type {Boolean}*/ executeOnAi = false;
    /**@type {Boolean}*/ executeOnChatChange = false;

    /**@type {Function}*/ onExecute;
    /**@type {Function}*/ onDelete;
    /**@type {Function}*/ onUpdate;


    /**@type {HTMLElement}*/ dom;
    /**@type {HTMLElement}*/ settingsDom;




    unrender() {
        this.dom?.remove();
        this.dom = null;
    }
    updateRender() {
        if (!this.dom) return;
        this.dom.title = this.title || this.message;
        this.dom.textContent = this.label;
    }
    render() {
        this.unrender();
        if (!this.dom) {
            const root = document.createElement('div'); {
                this.dom = root;
                root.classList.add('qr--button');
                root.title = this.title || this.message;
                root.textContent = this.label;
                root.addEventListener('click', ()=>{
                    if (this.message?.length > 0 && this.onExecute) {
                        this.onExecute(this);
                    }
                });
            }
        }
        return this.dom;
    }




    /**
     * @param {any} idx
     */
    renderSettings(idx) {
        if (!this.settingsDom) {
            const item = document.createElement('div'); {
                this.settingsDom = item;
                item.classList.add('qr--set-item');
                item.setAttribute('data-order', String(idx));
                item.setAttribute('data-id', String(this.id));
                const drag = document.createElement('div'); {
                    drag.classList.add('drag-handle');
                    drag.classList.add('ui-sortable-handle');
                    drag.textContent = '☰';
                    item.append(drag);
                }
                const lblContainer = document.createElement('div'); {
                    lblContainer.classList.add('qr--set-itemLabelContainer');
                    const lbl = document.createElement('input'); {
                        lbl.classList.add('qr--set-itemLabel');
                        lbl.classList.add('text_pole');
                        lbl.value = this.label;
                        lbl.addEventListener('input', ()=>this.updateLabel(lbl.value));
                        lblContainer.append(lbl);
                    }
                    item.append(lblContainer);
                }
                const optContainer = document.createElement('div'); {
                    optContainer.classList.add('qr--set-optionsContainer');
                    const opt = document.createElement('div'); {
                        opt.classList.add('qr--action');
                        opt.classList.add('menu_button');
                        opt.classList.add('fa-solid');
                        opt.textContent = '⁝';
                        opt.title = 'Additional options:\n - context menu\n - auto-execution\n - tooltip';
                        opt.addEventListener('click', ()=>this.showOptions());
                        optContainer.append(opt);
                    }
                    item.append(optContainer);
                }
                const expandContainer = document.createElement('div'); {
                    expandContainer.classList.add('qr--set-optionsContainer');
                    const expand = document.createElement('div'); {
                        expand.classList.add('qr--expand');
                        expand.classList.add('menu_button');
                        expand.classList.add('menu_button_icon');
                        expand.classList.add('editor_maximize');
                        expand.classList.add('fa-solid');
                        expand.classList.add('fa-maximize');
                        expand.title = 'Expand the editor';
                        expand.setAttribute('data-for', `qr--set--item${this.id}`);
                        expand.setAttribute('data-tab', 'true');
                        expandContainer.append(expand);
                    }
                    item.append(expandContainer);
                }
                const mes = document.createElement('textarea'); {
                    mes.id = `qr--set--item${this.id}`;
                    mes.classList.add('qr--set-itemMessage');
                    mes.value = this.message;
                    //HACK need to use jQuery to catch the triggered event from the expanded editor
                    $(mes).on('input', ()=>this.updateMessage(mes.value));
                    item.append(mes);
                }
                const actions = document.createElement('div'); {
                    actions.classList.add('qr--actions');
                    const del = document.createElement('div'); {
                        del.classList.add('qr--action');
                        del.classList.add('menu_button');
                        del.classList.add('menu_button_icon');
                        del.classList.add('fa-solid');
                        del.classList.add('fa-trash-can');
                        del.title = 'Remove quick reply';
                        del.addEventListener('click', ()=>this.delete());
                        actions.append(del);
                    }
                    item.append(actions);
                }
            }
        }
        return this.settingsDom;
    }
    unrenderSettings() {
        this.settingsDom?.remove();
    }




    delete() {
        if (this.onDelete) {
            this.unrender();
            this.unrenderSettings();
            this.onDelete(this);
        }
    }
    /**
     * @param {string} value
     */
    updateMessage(value) {
        if (this.onUpdate) {
            this.message = value;
            this.updateRender();
            this.onUpdate(this);
        }
    }
    /**
     * @param {string} value
     */
    updateLabel(value) {
        if (this.onUpdate) {
            this.label = value;
            this.updateRender();
            this.onUpdate(this);
        }
    }

    updateContext() {
        if (this.onUpdate) {
            this.updateRender();
            this.onUpdate(this);
        }
    }

    async showOptions() {
        const response = await fetch('/scripts/extensions/quick-reply/html/qrOptions.html', { cache: 'no-store' });
        if (response.ok) {
            this.template = document.createRange().createContextualFragment(await response.text()).querySelector('#qr--qrOptions');
            /**@type {HTMLElement} */
            // @ts-ignore
            const dom = this.template.cloneNode(true);
            const popupResult = callPopup(dom, 'text', undefined, { okButton: 'OK', wide: false, large: false, rows: 1 });
            /**@type {HTMLTemplateElement}*/
            const tpl = dom.querySelector('#qr--ctxItem');
            const linkList = dom.querySelector('#qr--ctxEditor');
            const fillQrSetSelect = (/**@type {HTMLSelectElement}*/select, /**@type {QuickReplyContextLink}*/ link) => {
                [{ name: 'Select a QR set' }, ...QuickReplySet.list].forEach(qrs => {
                    const opt = document.createElement('option'); {
                        opt.value = qrs.name;
                        opt.textContent = qrs.name;
                        opt.selected = qrs.name == link.set?.name;
                        select.append(opt);
                    }
                });
            };
            const addCtxItem = (/**@type {QuickReplyContextLink}*/link, /**@type {Number}*/idx) => {
                /**@type {HTMLElement} */
                // @ts-ignore
                const itemDom = tpl.content.querySelector('.qr--ctxItem').cloneNode(true); {
                    itemDom.setAttribute('data-order', String(idx));

                    /**@type {HTMLSelectElement} */
                    const select = itemDom.querySelector('.qr--set');
                    fillQrSetSelect(select, link);
                    select.addEventListener('change', () => {
                        link.set = QuickReplySet.get(select.value);
                        this.updateContext();
                    });

                    /**@type {HTMLInputElement} */
                    const chain = itemDom.querySelector('.qr--isChained');
                    chain.checked = link.isChained;
                    chain.addEventListener('click', () => {
                        link.isChained = chain.checked;
                        this.updateContext();
                    });

                    itemDom.querySelector('.qr--delete').addEventListener('click', () => {
                        itemDom.remove();
                        this.contextList.splice(this.contextList.indexOf(link), 1);
                        this.updateContext();
                    });

                    linkList.append(itemDom);
                }
            };
            [...this.contextList].forEach((link, idx) => addCtxItem(link, idx));
            dom.querySelector('#qr--ctxAdd').addEventListener('click', () => {
                const link = new QuickReplyContextLink();
                this.contextList.push(link);
                addCtxItem(link, this.contextList.length - 1);
            });
            const onContextSort = () => {
                this.contextList = Array.from(linkList.querySelectorAll('.qr--ctxItem')).map((it,idx) => {
                    const link = this.contextList[Number(it.getAttribute('data-order'))];
                    it.setAttribute('data-order', String(idx));
                    return link;
                });
                this.updateContext();
            };
            // @ts-ignore
            $(linkList).sortable({
                delay: getSortableDelay(),
                stop: () => onContextSort(),
            });

            // auto-exec
            /**@type {HTMLInputElement}*/
            const isHidden = dom.querySelector('#qr--isHidden');
            isHidden.checked = this.isHidden;
            isHidden.addEventListener('click', ()=>{
                this.isHidden = isHidden.checked;
                this.updateContext();
            });
            /**@type {HTMLInputElement}*/
            const executeOnStartup = dom.querySelector('#qr--executeOnStartup');
            executeOnStartup.checked = this.executeOnStartup;
            executeOnStartup.addEventListener('click', ()=>{
                this.executeOnStartup = executeOnStartup.checked;
                this.updateContext();
            });
            /**@type {HTMLInputElement}*/
            const executeOnUser = dom.querySelector('#qr--executeOnUser');
            executeOnUser.checked = this.executeOnUser;
            executeOnUser.addEventListener('click', ()=>{
                this.executeOnUser = executeOnUser.checked;
                this.updateContext();
            });
            /**@type {HTMLInputElement}*/
            const executeOnAi = dom.querySelector('#qr--executeOnAi');
            executeOnAi.checked = this.executeOnAi;
            executeOnAi.addEventListener('click', ()=>{
                this.executeOnAi = executeOnAi.checked;
                this.updateContext();
            });
            /**@type {HTMLInputElement}*/
            const executeOnChatChange = dom.querySelector('#qr--executeOnChatChange');
            executeOnChatChange.checked = this.executeOnChatChange;
            executeOnChatChange.addEventListener('click', ()=>{
                this.executeOnChatChange = executeOnChatChange.checked;
                this.updateContext();
            });

            // UI options
            /**@type {HTMLInputElement}*/
            const title = dom.querySelector('#qr--title');
            title.value = this.title;
            title.addEventListener('input', () => {
                this.title = title.value.trim();
                this.updateContext();
            });

            await popupResult;
        } else {
            warn('failed to fetch qrOptions template');
        }
    }




    toJSON() {
        return {
            id: this.id,
            label: this.label,
            title: this.title,
            message: this.message,
            contextList: this.contextList,
            isHidden: this.isHidden,
            executeOnStartup: this.executeOnStartup,
            executeOnUser: this.executeOnUser,
            executeOnAi: this.executeOnAi,
            executeOnChatChange: this.executeOnChatChange,
        };
    }
}
