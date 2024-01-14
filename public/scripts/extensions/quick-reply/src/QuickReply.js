import { callPopup } from '../../../../script.js';
import { getSortableDelay } from '../../../utils.js';
import { log, warn } from '../index.js';
import { QuickReplyContextLink } from './QuickReplyContextLink.js';
import { QuickReplySet } from './QuickReplySet.js';
import { ContextMenu } from './ui/ctx/ContextMenu.js';

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

    /**@type {Boolean}*/ preventAutoExecute = true;
    /**@type {Boolean}*/ isHidden = false;
    /**@type {Boolean}*/ executeOnStartup = false;
    /**@type {Boolean}*/ executeOnUser = false;
    /**@type {Boolean}*/ executeOnAi = false;
    /**@type {Boolean}*/ executeOnChatChange = false;

    /**@type {Function}*/ onExecute;
    /**@type {Function}*/ onDelete;
    /**@type {Function}*/ onUpdate;


    /**@type {HTMLElement}*/ dom;
    /**@type {HTMLElement}*/ domLabel;
    /**@type {HTMLElement}*/ settingsDom;
    /**@type {HTMLInputElement}*/ settingsDomLabel;
    /**@type {HTMLTextAreaElement}*/ settingsDomMessage;


    get hasContext() {
        return this.contextList && this.contextList.length > 0;
    }




    unrender() {
        this.dom?.remove();
        this.dom = null;
    }
    updateRender() {
        if (!this.dom) return;
        this.dom.title = this.title || this.message;
        this.domLabel.textContent = this.label;
        this.dom.classList[this.hasContext ? 'add' : 'remove']('qr--hasCtx');
    }
    render() {
        this.unrender();
        if (!this.dom) {
            const root = document.createElement('div'); {
                this.dom = root;
                root.classList.add('qr--button');
                root.classList.add('menu_button');
                if (this.hasContext) {
                    root.classList.add('qr--hasCtx');
                }
                root.title = this.title || this.message;
                root.addEventListener('contextmenu', (evt) => {
                    log('contextmenu', this, this.hasContext);
                    if (this.hasContext) {
                        evt.preventDefault();
                        evt.stopPropagation();
                        const menu = new ContextMenu(this);
                        menu.show(evt);
                    }
                });
                root.addEventListener('click', (evt)=>{
                    if (evt.ctrlKey) {
                        this.showEditor();
                        return;
                    }
                    this.execute();
                });
                const lbl = document.createElement('div'); {
                    this.domLabel = lbl;
                    lbl.classList.add('qr--button-label');
                    lbl.textContent = this.label;
                    root.append(lbl);
                }
                const expander = document.createElement('div'); {
                    expander.classList.add('qr--button-expander');
                    expander.textContent = '⋮';
                    expander.title = 'Open context menu';
                    expander.addEventListener('click', (evt) => {
                        evt.stopPropagation();
                        evt.preventDefault();
                        const menu = new ContextMenu(this);
                        menu.show(evt);
                    });
                    root.append(expander);
                }
            }
        }
        return this.dom;
    }




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
                        this.settingsDomLabel = lbl;
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
                        opt.title = 'Additional options:\n - large editor\n - context menu\n - auto-execution\n - tooltip';
                        opt.addEventListener('click', ()=>this.showEditor());
                        optContainer.append(opt);
                    }
                    item.append(optContainer);
                }
                const mes = document.createElement('textarea'); {
                    this.settingsDomMessage = mes;
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
                        del.classList.add('redWarningBG');
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

    async showEditor() {
        const response = await fetch('/scripts/extensions/quick-reply/html/qrEditor.html', { cache: 'no-store' });
        if (response.ok) {
            this.template = document.createRange().createContextualFragment(await response.text()).querySelector('#qr--modalEditor');
            /**@type {HTMLElement} */
            // @ts-ignore
            const dom = this.template.cloneNode(true);
            const popupResult = callPopup(dom, 'text', undefined, { okButton: 'OK', wide: true, large: true, rows: 1 });

            // basics
            /**@type {HTMLInputElement}*/
            const label = dom.querySelector('#qr--modal-label');
            label.value = this.label;
            label.addEventListener('input', ()=>{
                this.updateLabel(label.value);
            });
            /**@type {HTMLInputElement}*/
            const title = dom.querySelector('#qr--modal-title');
            title.value = this.title;
            title.addEventListener('input', () => {
                this.updateTitle(title.value);
            });
            /**@type {HTMLTextAreaElement}*/
            const message = dom.querySelector('#qr--modal-message');
            message.value = this.message;
            message.addEventListener('input', () => {
                this.updateMessage(message.value);
            });
            //TODO move tab support for textarea into its own helper(?) and use for both this and .editor_maximize
            message.addEventListener('keydown', (evt) => {
                if (evt.key == 'Tab' && !evt.shiftKey && !evt.ctrlKey && !evt.altKey) {
                    evt.preventDefault();
                    const start = message.selectionStart;
                    const end = message.selectionEnd;
                    if (end - start > 0 && message.value.substring(start, end).includes('\n')) {
                        const lineStart = message.value.lastIndexOf('\n', start);
                        const count = message.value.substring(lineStart, end).split('\n').length - 1;
                        message.value = `${message.value.substring(0, lineStart)}${message.value.substring(lineStart, end).replace(/\n/g, '\n\t')}${message.value.substring(end)}`;
                        message.selectionStart = start + 1;
                        message.selectionEnd = end + count;
                        this.updateMessage(message.value);
                    } else {
                        message.value = `${message.value.substring(0, start)}\t${message.value.substring(end)}`;
                        message.selectionStart = start + 1;
                        message.selectionEnd = end + 1;
                        this.updateMessage(message.value);
                    }
                } else if (evt.key == 'Tab' && evt.shiftKey && !evt.ctrlKey && !evt.altKey) {
                    evt.preventDefault();
                    const start = message.selectionStart;
                    const end = message.selectionEnd;
                    const lineStart = message.value.lastIndexOf('\n', start);
                    const count = message.value.substring(lineStart, end).split('\n\t').length - 1;
                    message.value = `${message.value.substring(0, lineStart)}${message.value.substring(lineStart, end).replace(/\n\t/g, '\n')}${message.value.substring(end)}`;
                    message.selectionStart = start - 1;
                    message.selectionEnd = end - count;
                    this.updateMessage(message.value);
                }
            });

            // context menu
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
            const preventAutoExecute = dom.querySelector('#qr--preventAutoExecute');
            preventAutoExecute.checked = this.preventAutoExecute;
            preventAutoExecute.addEventListener('click', ()=>{
                this.preventAutoExecute = preventAutoExecute.checked;
                this.updateContext();
            });
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


            /**@type {HTMLElement}*/
            const executeErrors = dom.querySelector('#qr--modal-executeErrors');
            /**@type {HTMLInputElement}*/
            const executeHide = dom.querySelector('#qr--modal-executeHide');
            let executePromise;
            /**@type {HTMLElement}*/
            const executeBtn = dom.querySelector('#qr--modal-execute');
            executeBtn.addEventListener('click', async()=>{
                if (executePromise) return;
                executeBtn.classList.add('qr--busy');
                executeErrors.innerHTML = '';
                if (executeHide.checked) {
                    document.querySelector('#shadow_popup').classList.add('qr--hide');
                }
                try {
                    executePromise = this.execute();
                    await executePromise;
                } catch (ex) {
                    executeErrors.textContent = ex.message;
                }
                executePromise = null;
                executeBtn.classList.remove('qr--busy');
                document.querySelector('#shadow_popup').classList.remove('qr--hide');
            });

            await popupResult;
        } else {
            warn('failed to fetch qrEditor template');
        }
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
            if (this.settingsDomMessage && this.settingsDomMessage.value != value) {
                this.settingsDomMessage.value = value;
            }
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
            if (this.settingsDomLabel && this.settingsDomLabel.value != value) {
                this.settingsDomLabel.value = value;
            }
            this.label = value;
            this.updateRender();
            this.onUpdate(this);
        }
    }

    /**
     * @param {string} value
     */
    updateTitle(value) {
        if (this.onUpdate) {
            this.title = value;
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
    addContextLink(cl) {
        this.contextList.push(cl);
        this.updateContext();
    }
    removeContextLink(setName) {
        const idx = this.contextList.findIndex(it=>it.set.name == setName);
        if (idx > -1) {
            this.contextList.splice(idx, 1);
            this.updateContext();
        }
    }
    clearContextLinks() {
        if (this.contextList.length) {
            this.contextList.splice(0, this.contextList.length);
            this.updateContext();
        }
    }


    async execute(args = {}) {
        if (this.message?.length > 0 && this.onExecute) {
            const message = this.message.replace(/\{\{arg::([^}]+)\}\}/g, (_, key) => {
                return args[key] ?? '';
            });
            return await this.onExecute(this, message, args.isAutoExecute ?? false);
        }
    }




    toJSON() {
        return {
            id: this.id,
            label: this.label,
            title: this.title,
            message: this.message,
            contextList: this.contextList,
            preventAutoExecute: this.preventAutoExecute,
            isHidden: this.isHidden,
            executeOnStartup: this.executeOnStartup,
            executeOnUser: this.executeOnUser,
            executeOnAi: this.executeOnAi,
            executeOnChatChange: this.executeOnChatChange,
        };
    }
}
