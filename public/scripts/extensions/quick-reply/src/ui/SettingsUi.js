import { callPopup } from '../../../../../script.js';
import { getSortableDelay } from '../../../../utils.js';
import { log, warn } from '../../index.js';
import { QuickReply } from '../QuickReply.js';
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
        settings.onRequestEditSet = (qrs) => this.selectQrSet(qrs);
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

    prepareGlobalSetList() {
        const dom = this.template.querySelector('#qr--global');
        const clone = dom.cloneNode(true);
        // @ts-ignore
        this.settings.config.renderSettingsInto(clone);
        this.dom.querySelector('#qr--global').replaceWith(clone);
    }
    prepareChatSetList() {
        const dom = this.template.querySelector('#qr--chat');
        const clone = dom.cloneNode(true);
        if (this.settings.chatConfig) {
            // @ts-ignore
            this.settings.chatConfig.renderSettingsInto(clone);
        } else {
            const info = document.createElement('div'); {
                info.textContent = 'No active chat.';
                // @ts-ignore
                clone.append(info);
            }
        }
        this.dom.querySelector('#qr--chat').replaceWith(clone);
    }

    prepareQrEditor() {
        // qr editor
        this.dom.querySelector('#qr--set-new').addEventListener('click', async()=>this.addQrSet());
        /**@type {HTMLInputElement}*/
        const importFile = this.dom.querySelector('#qr--set-importFile');
        importFile.addEventListener('change', async()=>{
            await this.importQrSet(importFile.files);
            importFile.value = null;
        });
        this.dom.querySelector('#qr--set-import').addEventListener('click', ()=>importFile.click());
        this.dom.querySelector('#qr--set-export').addEventListener('click', async()=>this.exportQrSet());
        this.dom.querySelector('#qr--set-delete').addEventListener('click', async()=>this.deleteQrSet());
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
            handle: '.drag-handle',
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

    async deleteQrSet() {
        const confirmed = await callPopup(`Are you sure you want to delete the Quick Reply Set "${this.currentQrSet.name}"?<br>This cannot be undone.`, 'confirm');
        if (confirmed) {
            await this.doDeleteQrSet(this.currentQrSet);
            this.rerender();
        }
    }
    async doDeleteQrSet(qrs) {
        await qrs.delete();
        //TODO (HACK) should just bubble up from QuickReplySet.delete() but that would require proper or at least more comples onDelete listeners
        for (let i = this.settings.config.setList.length - 1; i >= 0; i--) {
            if (this.settings.config.setList[i].set == qrs) {
                this.settings.config.setList.splice(i, 1);
            }
        }
        if (this.settings.chatConfig) {
            for (let i = this.settings.chatConfig.setList.length - 1; i >= 0; i--) {
                if (this.settings.chatConfig.setList[i].set == qrs) {
                    this.settings.chatConfig.setList.splice(i, 1);
                }
            }
        }
        this.settings.save();
    }

    async addQrSet() {
        const name = await callPopup('Quick Reply Set Name:', 'input');
        if (name && name.length > 0) {
            const oldQrs = QuickReplySet.get(name);
            if (oldQrs) {
                const replace = await callPopup(`A Quick Reply Set named "${name}" already exists.<br>Do you want to overwrite the existing Quick Reply Set?<br>The existing set will be deleted. This cannot be undone.`, 'confirm');
                if (replace) {
                    const idx = QuickReplySet.list.indexOf(oldQrs);
                    await this.doDeleteQrSet(oldQrs);
                    const qrs = new QuickReplySet();
                    qrs.name = name;
                    qrs.addQuickReply();
                    QuickReplySet.list.splice(idx, 0, qrs);
                    this.rerender();
                    this.currentSet.value = name;
                    this.onQrSetChange();
                    this.prepareGlobalSetList();
                    this.prepareChatSetList();
                }
            } else {
                const qrs = new QuickReplySet();
                qrs.name = name;
                qrs.addQuickReply();
                const idx = QuickReplySet.list.findIndex(it=>it.name.localeCompare(name) == 1);
                if (idx > -1) {
                    QuickReplySet.list.splice(idx, 0, qrs);
                } else {
                    QuickReplySet.list.push(qrs);
                }
                const opt = document.createElement('option'); {
                    opt.value = qrs.name;
                    opt.textContent = qrs.name;
                    if (idx > -1) {
                        this.currentSet.children[idx].insertAdjacentElement('beforebegin', opt);
                    } else {
                        this.currentSet.append(opt);
                    }
                }
                this.currentSet.value = name;
                this.onQrSetChange();
                this.prepareGlobalSetList();
                this.prepareChatSetList();
            }
        }
    }

    async importQrSet(/**@type {FileList}*/files) {
        for (let i = 0; i < files.length; i++) {
            await this.importSingleQrSet(files.item(i));
        }
    }
    async importSingleQrSet(/**@type {File}*/file) {
        log('FILE', file);
        try {
            const text = await file.text();
            const props = JSON.parse(text);
            if (!Number.isInteger(props.version) || typeof props.name != 'string') {
                toastr.error(`The file "${file.name}" does not appear to be a valid quick reply set.`);
                warn(`The file "${file.name}" does not appear to be a valid quick reply set.`);
            } else {
                /**@type {QuickReplySet}*/
                const qrs = QuickReplySet.from(JSON.parse(JSON.stringify(props)));
                qrs.qrList = props.qrList.map(it=>QuickReply.from(it));
                qrs.init();
                const oldQrs = QuickReplySet.get(props.name);
                if (oldQrs) {
                    const replace = await callPopup(`A Quick Reply Set named "${qrs.name}" already exists.<br>Do you want to overwrite the existing Quick Reply Set?<br>The existing set will be deleted. This cannot be undone.`, 'confirm');
                    if (replace) {
                        const idx = QuickReplySet.list.indexOf(oldQrs);
                        await this.doDeleteQrSet(oldQrs);
                        QuickReplySet.list.splice(idx, 0, qrs);
                        await qrs.save();
                        this.rerender();
                        this.currentSet.value = qrs.name;
                        this.onQrSetChange();
                        this.prepareGlobalSetList();
                        this.prepareChatSetList();
                    }
                } else {
                    const idx = QuickReplySet.list.findIndex(it=>it.name.localeCompare(qrs.name) == 1);
                    if (idx > -1) {
                        QuickReplySet.list.splice(idx, 0, qrs);
                    } else {
                        QuickReplySet.list.push(qrs);
                    }
                    await qrs.save();
                    const opt = document.createElement('option'); {
                        opt.value = qrs.name;
                        opt.textContent = qrs.name;
                        if (idx > -1) {
                            this.currentSet.children[idx].insertAdjacentElement('beforebegin', opt);
                        } else {
                            this.currentSet.append(opt);
                        }
                    }
                    this.currentSet.value = qrs.name;
                    this.onQrSetChange();
                    this.prepareGlobalSetList();
                    this.prepareChatSetList();
                }
            }
        } catch (ex) {
            warn(ex);
            toastr.error(`Failed to import "${file.name}":\n\n${ex.message}`);
        }
    }

    exportQrSet() {
        const blob = new Blob([JSON.stringify(this.currentQrSet)], { type:'application/json' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a'); {
            a.href = url;
            a.download = `${this.currentQrSet.name}.json`;
            a.click();
        }
    }

    selectQrSet(qrs) {
        this.currentSet.value = qrs.name;
        this.onQrSetChange();
    }
}
