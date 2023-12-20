import { getSortableDelay } from '../../../../utils.js';
import { warn } from '../../index.js';
import { QuickReplyLink } from '../QuickReplyLink.js';
import { QuickReplySet } from '../QuickReplySet.js';
// eslint-disable-next-line no-unused-vars
import { QuickReplySettings } from '../QuickReplySettings.js';

export class SettingsUi {
    /**@type {QuickReplySettings}*/ settings;

    /**@type {HTMLElement}*/ template;
    /**@type {HTMLElement}*/ dom;

    /**@type {HTMLInputElement}*/ isEnabled;
    /**@type {HTMLInputElement}*/ isCombined;

    /**@type {HTMLElement}*/ globalSetList;

    /**@type {HTMLElement}*/ chatSetList;

    /**@type {QuickReplySet}*/ currentQrSet;
    /**@type {HTMLInputElement}*/ disableSend;
    /**@type {HTMLInputElement}*/ placeBeforeInput;
    /**@type {HTMLInputElement}*/ injectInput;
    /**@type {HTMLSelectElement}*/ currentSet;




    constructor(/**@type {QuickReplySettings}*/settings) {
        this.settings = settings;
    }






    rerender() {
        if (!this.dom) return;
        const content = this.dom.querySelector('.inline-drawer-content');
        content.innerHTML = '';
        // @ts-ignore
        Array.from(this.template.querySelector('.inline-drawer-content').cloneNode(true).children).forEach(el=>{
            content.append(el);
        });
        this.prepareDom();
    }
    unrender() {
        this.dom?.remove();
        this.dom = null;
    }
    async render() {
        if (!this.dom) {
            const response = await fetch('/scripts/extensions/quick-reply/html/settings.html', { cache: 'no-store' });
            if (response.ok) {
                this.template = document.createRange().createContextualFragment(await response.text()).querySelector('#qr--settings');
                // @ts-ignore
                this.dom = this.template.cloneNode(true);
                this.prepareDom();
            } else {
                warn('failed to fetch settings template');
            }
        }
        return this.dom;
    }


    prepareGeneralSettings() {
        // general settings
        this.isEnabled = this.dom.querySelector('#qr--isEnabled');
        this.isEnabled.checked = this.settings.isEnabled;
        this.isEnabled.addEventListener('click', ()=>this.onIsEnabled());

        this.isCombined = this.dom.querySelector('#qr--isCombined');
        this.isCombined.checked = this.settings.isCombined;
        this.isCombined.addEventListener('click', ()=>this.onIsCombined());
    }

    /**
     * @param {QuickReplyLink} qrl
     * @param {Number} idx
     */
    renderQrLinkItem(qrl, idx, isGlobal) {
        const item = document.createElement('div'); {
            item.classList.add('qr--item');
            item.setAttribute('data-order', String(idx));
            const drag = document.createElement('div'); {
                drag.classList.add('drag-handle');
                drag.classList.add('ui-sortable-handle');
                drag.textContent = '☰';
                item.append(drag);
            }
            const set = document.createElement('select'); {
                set.addEventListener('change', ()=>{
                    qrl.set = QuickReplySet.get(set.value);
                    this.settings.save();
                });
                QuickReplySet.list.forEach(qrs=>{
                    const opt = document.createElement('option'); {
                        opt.value = qrs.name;
                        opt.textContent = qrs.name;
                        opt.selected = qrs == qrl.set;
                        set.append(opt);
                    }
                });
                item.append(set);
            }
            const visible = document.createElement('label'); {
                visible.classList.add('qr--visible');
                const cb = document.createElement('input'); {
                    cb.type = 'checkbox';
                    cb.checked = qrl.isVisible;
                    cb.addEventListener('click', ()=>{
                        qrl.isVisible = cb.checked;
                        this.settings.save();
                    });
                    visible.append(cb);
                }
                visible.append('Show buttons');
                item.append(visible);
            }
            const edit = document.createElement('div'); {
                edit.classList.add('menu_button');
                edit.classList.add('menu_button_icon');
                edit.classList.add('fa-solid');
                edit.classList.add('fa-pencil');
                edit.title = 'Edit quick reply set';
                edit.addEventListener('click', ()=>{
                    this.currentSet.value = qrl.set.name;
                    this.onQrSetChange();
                });
                item.append(edit);
            }
            const del = document.createElement('div'); {
                del.classList.add('menu_button');
                del.classList.add('menu_button_icon');
                del.classList.add('fa-solid');
                del.classList.add('fa-trash-can');
                del.title = 'Remove quick reply set';
                del.addEventListener('click', ()=>{
                    item.remove();
                    if (isGlobal) {
                        this.settings.config.setList.splice(this.settings.config.setList.indexOf(qrl), 1);
                        this.updateOrder(this.globalSetList);
                    } else {
                        this.settings.chatConfig.setList.splice(this.settings.chatConfig.setList.indexOf(qrl), 1);
                        this.updateOrder(this.chatSetList);
                    }
                    this.settings.save();
                });
                item.append(del);
            }
        }
        return item;
    }
    prepareGlobalSetList() {
        // global set list
        this.dom.querySelector('#qr--global-setListAdd').addEventListener('click', ()=>{
            const qrl = new QuickReplyLink();
            qrl.set = QuickReplySet.list[0];
            this.settings.config.setList.push(qrl);
            this.globalSetList.append(this.renderQrLinkItem(qrl, this.settings.config.setList.length - 1, true));
            this.settings.save();
        });
        this.globalSetList = this.dom.querySelector('#qr--global-setList');
        // @ts-ignore
        $(this.globalSetList).sortable({
            delay: getSortableDelay(),
            stop: ()=>this.onGlobalSetListSort(),
        });
        this.settings.config.setList.forEach((qrl,idx)=>{
            this.globalSetList.append(this.renderQrLinkItem(qrl, idx, true));
        });
    }
    prepareChatSetList() {
        // chat set list
        this.dom.querySelector('#qr--chat-setListAdd').addEventListener('click', ()=>{
            if (!this.settings.chatConfig) {
                toastr.warning('No active chat.');
                return;
            }
            const qrl = new QuickReplyLink();
            qrl.set = QuickReplySet.list[0];
            this.settings.chatConfig.setList.push(qrl);
            this.chatSetList.append(this.renderQrLinkItem(qrl, this.settings.chatConfig.setList.length - 1, false));
            this.settings.save();
        });

        this.chatSetList = this.dom.querySelector('#qr--chat-setList');
        if (!this.settings.chatConfig) {
            const info = document.createElement('small'); {
                info.textContent = 'No active chat.';
                this.chatSetList.append(info);
            }
        }
        // @ts-ignore
        $(this.chatSetList).sortable({
            delay: getSortableDelay(),
            stop: ()=>this.onChatSetListSort(),
        });
        this.settings.chatConfig?.setList?.forEach((qrl,idx)=>{
            this.chatSetList.append(this.renderQrLinkItem(qrl, idx, false));
        });
    }

    prepareQrEditor() {
        // qr editor
        this.dom.querySelector('#qr--set-add').addEventListener('click', async()=>{
            this.currentQrSet.addQuickReply();
        });
        this.qrList = this.dom.querySelector('#qr--set-qrList');
        this.currentSet = this.dom.querySelector('#qr--set');
        this.currentSet.addEventListener('change', ()=>this.onQrSetChange());
        QuickReplySet.list.forEach(qrs=>{
            const opt = document.createElement('option'); {
                opt.value = qrs.name;
                opt.textContent = qrs.name;
                this.currentSet.append(opt);
            }
        });
        this.disableSend = this.dom.querySelector('#qr--disableSend');
        this.disableSend.addEventListener('click', ()=>{
            const qrs = this.currentQrSet;
            qrs.disableSend = this.disableSend.checked;
            qrs.save();
        });
        this.placeBeforeInput = this.dom.querySelector('#qr--placeBeforeInput');
        this.placeBeforeInput.addEventListener('click', ()=>{
            const qrs = this.currentQrSet;
            qrs.placeBeforeInput = this.placeBeforeInput.checked;
            qrs.save();
        });
        this.injectInput = this.dom.querySelector('#qr--injectInput');
        this.injectInput.addEventListener('click', ()=>{
            const qrs = this.currentQrSet;
            qrs.injectInput = this.injectInput.checked;
            qrs.save();
        });
        this.onQrSetChange();
    }
    onQrSetChange() {
        this.currentQrSet = QuickReplySet.get(this.currentSet.value);
        this.disableSend.checked = this.currentQrSet.disableSend;
        this.placeBeforeInput.checked = this.currentQrSet.placeBeforeInput;
        this.injectInput.checked = this.currentQrSet.injectInput;
        this.qrList.innerHTML = '';
        const qrsDom = this.currentQrSet.renderSettings();
        this.qrList.append(qrsDom);
        // @ts-ignore
        $(qrsDom).sortable({
            delay: getSortableDelay(),
            stop: ()=>this.onQrListSort(),
        });
    }


    prepareDom() {
        this.prepareGeneralSettings();
        this.prepareGlobalSetList();
        this.prepareChatSetList();
        this.prepareQrEditor();
    }




    async onIsEnabled() {
        this.settings.isEnabled = this.isEnabled.checked;
        this.settings.save();
    }

    async onIsCombined() {
        this.settings.isCombined = this.isCombined.checked;
        this.settings.save();
    }

    async onGlobalSetListSort() {
        this.settings.config.setList = Array.from(this.globalSetList.children).map((it,idx)=>{
            const set = this.settings.config.setList[Number(it.getAttribute('data-order'))];
            it.setAttribute('data-order', String(idx));
            return set;
        });
        this.settings.save();
    }

    async onChatSetListSort() {
        this.settings.chatConfig.setList = Array.from(this.chatSetList.children).map((it,idx)=>{
            const set = this.settings.chatConfig.setList[Number(it.getAttribute('data-order'))];
            it.setAttribute('data-order', String(idx));
            return set;
        });
        this.settings.save();
    }

    updateOrder(list) {
        Array.from(list.children).forEach((it,idx)=>{
            it.setAttribute('data-order', idx);
        });
    }

    async onQrListSort() {
        this.currentQrSet.qrList = Array.from(this.qrList.querySelectorAll('.qr--set-item')).map((it,idx)=>{
            const qr = this.currentQrSet.qrList.find(qr=>qr.id == Number(it.getAttribute('data-id')));
            it.setAttribute('data-order', String(idx));
            return qr;
        });
        this.currentQrSet.save();
    }
}
