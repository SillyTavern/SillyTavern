import { Popup } from '../../../../popup.js';
import { getSortableDelay } from '../../../../utils.js';
import { log, warn } from '../../index.js';
import { QuickReply } from '../QuickReply.js';
import { QuickReplySet } from '../QuickReplySet.js';
import { QuickReplySettings } from '../QuickReplySettings.js';

export class SettingsUi {
    /** @type {QuickReplySettings} */ settings;

    /** @type {HTMLElement} */ template;
    /** @type {HTMLElement} */ dom;

    /**@type {HTMLInputElement}*/ isEnabled;
    /**@type {HTMLInputElement}*/ isCombined;
    /**@type {HTMLInputElement}*/ showPopoutButton;

    /**@type {HTMLElement}*/ globalSetList;

    /**@type {HTMLElement}*/ chatSetList;
    /**@type {HTMLElement}*/ characterSetList;

    /**@type {QuickReplySet}*/ currentQrSet;
    /**@type {HTMLInputElement}*/ disableSend;
    /**@type {HTMLInputElement}*/ placeBeforeInput;
    /**@type {HTMLInputElement}*/ injectInput;
    /**@type {HTMLInputElement}*/ color;
    /**@type {HTMLInputElement}*/ onlyBorderColor;
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

        this.showPopoutButton = this.dom.querySelector('#qr--showPopoutButton');
        this.showPopoutButton.checked = this.settings.showPopoutButton;
        this.showPopoutButton.addEventListener('click', ()=>this.onShowPopoutButton());
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
    prepareCharacterSetList() {
        const dom = this.template.querySelector('#qr--character');
        const clone = /** @type {HTMLElement} */ (dom.cloneNode(true));

        if (!this.settings.charConfig) {
            const setListContainer = /** @type {HTMLElement} */ (clone.querySelector('.qr--setList'));
            setListContainer.innerHTML = '';
            const info = document.createElement('div');
            info.textContent = 'No character is currently loaded.';
            setListContainer.append(info);
        } else {
            // Let the config object handle its own rendering. It will render an empty list if there are no sets,
            // but the "add" button will always be functional.
            this.settings.charConfig.renderSettingsInto(clone);
        }

        // Replace the old DOM element with our newly prepared clone.
        this.dom.querySelector('#qr--character').replaceWith(clone);
    }

    prepareQrEditor() {
        // qr editor
        this.dom.querySelector('#qr--set-rename').addEventListener('click', async () => this.renameQrSet());
        this.dom.querySelector('#qr--set-new').addEventListener('click', async()=>this.addQrSet());
        /**@type {HTMLInputElement}*/
        const importFile = this.dom.querySelector('#qr--set-importFile');
        importFile.addEventListener('change', async()=>{
            await this.importQrSet(importFile.files);
            importFile.value = null;
        });
        this.dom.querySelector('#qr--set-import').addEventListener('click', ()=>importFile.click());
        this.dom.querySelector('#qr--set-export').addEventListener('click', async () => this.exportQrSet());
        this.dom.querySelector('#qr--set-duplicate').addEventListener('click', async () => this.duplicateQrSet());
        this.dom.querySelector('#qr--set-delete').addEventListener('click', async()=>this.deleteQrSet());
        this.dom.querySelector('#qr--set-add').addEventListener('click', async()=>{
            this.currentQrSet.addQuickReply();
        });
        this.dom.querySelector('#qr--set-paste').addEventListener('click', async()=>{
            const text = await navigator.clipboard.readText();
            this.currentQrSet.addQuickReplyFromText(text);
        });
        this.dom.querySelector('#qr--set-importQr').addEventListener('click', async()=>{
            const inp = document.createElement('input'); {
                inp.type = 'file';
                inp.accept = '.json';
                inp.addEventListener('change', async()=>{
                    if (inp.files.length > 0) {
                        for (const file of inp.files) {
                            const text = await file.text();
                            this.currentQrSet.addQuickReply(JSON.parse(text));
                        }
                    }
                });
                inp.click();
            }
        });
        this.qrList = this.dom.querySelector('#qr--set-qrList');
        this.currentSet = this.dom.querySelector('#qr--set');
        this.currentSet.addEventListener('change', ()=>this.onQrSetChange());
        QuickReplySet.list.toSorted((a,b)=>a.name.toLowerCase().localeCompare(b.name.toLowerCase())).forEach(qrs=>{
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
        let initialColorChange = true;
        this.color = this.dom.querySelector('#qr--color');
        // @ts-ignore
        this.color.color = this.currentQrSet?.color ?? 'transparent';
        this.color.addEventListener('change', (evt)=>{
            if (!this.dom.closest('body')) return;
            const qrs = this.currentQrSet;
            if (initialColorChange) {
                initialColorChange = false;
                // @ts-ignore
                this.color.color = qrs.color;
                return;
            }
            // @ts-ignore
            qrs.color = evt.detail.rgb;
            qrs.save();
            this.currentQrSet.updateColor();
        });
        // @ts-ignore
        this.dom.querySelector('#qr--colorClear').addEventListener('click', (evt)=>{
            const qrs = this.currentQrSet;
            // @ts-ignore
            this.color.color = 'transparent';
            qrs.save();
            this.currentQrSet.updateColor();
        });
        this.onlyBorderColor = this.dom.querySelector('#qr--onlyBorderColor');
        this.onlyBorderColor.addEventListener('click', ()=>{
            const qrs = this.currentQrSet;
            qrs.onlyBorderColor = this.onlyBorderColor.checked;
            qrs.save();
            this.currentQrSet.updateColor();
        });
        this.onQrSetChange();
    }
    onQrSetChange() {
        this.currentQrSet = QuickReplySet.get(this.currentSet.value) ?? new QuickReplySet();
        this.disableSend.checked = this.currentQrSet.disableSend;
        this.placeBeforeInput.checked = this.currentQrSet.placeBeforeInput;
        this.injectInput.checked = this.currentQrSet.injectInput;
        // @ts-ignore
        this.color.color = this.currentQrSet.color ?? 'transparent';
        this.onlyBorderColor.checked = this.currentQrSet.onlyBorderColor;
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
        this.prepareCharacterSetList();
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

    async onShowPopoutButton() {
        this.settings.showPopoutButton = this.showPopoutButton.checked;
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
        const confirmed = await Popup.show.confirm('Delete Quick Reply Set', `Are you sure you want to delete the Quick Reply Set "${this.currentQrSet.name}"?<br>This cannot be undone.`);
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
        if (this.settings.charConfig) {
            for (let i = this.settings.charConfig.setList.length - 1; i >= 0; i--) {
                if (this.settings.charConfig.setList[i].set == qrs) {
                    this.settings.charConfig.setList.splice(i, 1);
                }
            }
        }
        this.settings.save();
    }

    async renameQrSet() {
        const newName = await Popup.show.input('Rename Quick Reply Set', 'Enter a new name:', this.currentQrSet.name);
        if (newName && newName.length > 0) {
            const existingSet = QuickReplySet.get(newName);
            if (existingSet) {
                toastr.error(`A Quick Reply Set named "${newName}" already exists.`);
                return;
            }
            const oldName = this.currentQrSet.name;
            this.currentQrSet.name = newName;
            await this.currentQrSet.save();

            // Update it in both set lists
            this.settings.config.setList.forEach(set => {
                if (set.set.name === oldName) {
                    set.set.name = newName;
                }
            });
            this.settings.chatConfig?.setList.forEach(set => {
                if (set.set.name === oldName) {
                    set.set.name = newName;
                }
            });
            this.settings.charConfig?.setList.forEach(set => {
                if (set.set.name === oldName) {
                    set.set.name = newName;
                }
            });
            this.settings.save();

            // Update the option in the current selected QR dropdown. All others will be refreshed via the prepare calls below.
            /** @type {HTMLOptionElement} */
            const option = this.currentSet.querySelector(`#qr--set option[value="${oldName}"]`);
            option.value = newName;
            option.textContent = newName;

            this.currentSet.value = newName;
            this.onQrSetChange();
            this.prepareGlobalSetList();
            this.prepareChatSetList();
            this.prepareCharacterSetList();

            console.info(`Quick Reply Set renamed from ""${oldName}" to "${newName}".`);
        }
    }

    async addQrSet() {
        const name = await Popup.show.input('Create a new Quick Reply Set', 'Enter a name for the new Quick Reply Set:');
        if (name && name.length > 0) {
            const oldQrs = QuickReplySet.get(name);
            if (oldQrs) {
                const replace = Popup.show.confirm('Replace existing World Info', `A Quick Reply Set named "${name}" already exists.<br>Do you want to overwrite the existing Quick Reply Set?<br>The existing set will be deleted. This cannot be undone.`);
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
                    this.prepareCharacterSetList();
                }
            } else {
                const qrs = new QuickReplySet();
                qrs.name = name;
                qrs.addQuickReply();
                const idx = QuickReplySet.list.findIndex(it=>it.name.toLowerCase().localeCompare(name.toLowerCase()) == 1);
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
                this.prepareCharacterSetList();
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
                    const replace = Popup.show.confirm('Replace existing World Info', `A Quick Reply Set named "${name}" already exists.<br>Do you want to overwrite the existing Quick Reply Set?<br>The existing set will be deleted. This cannot be undone.`);
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
                        this.prepareCharacterSetList();
                    }
                } else {
                    const idx = QuickReplySet.list.findIndex(it=>it.name.toLowerCase().localeCompare(qrs.name.toLowerCase()) == 1);
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
                    this.prepareCharacterSetList();
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
        URL.revokeObjectURL(url);
    }

    async duplicateQrSet() {
        const newName = await Popup.show.input('Duplicate Quick Reply Set', 'Enter a name for the new Quick Reply Set:', `${this.currentQrSet.name} (Copy)`);
        if (newName && newName.length > 0) {
            const existingSet = QuickReplySet.get(newName);
            if (existingSet) {
                toastr.error(`A Quick Reply Set named "${newName}" already exists.`);
                return;
            }
            const newQrSet = QuickReplySet.from(this.currentQrSet.toJSON());
            newQrSet.name = newName;
            newQrSet.qrList = this.currentQrSet.qrList.map(qr => QuickReply.from(qr.toJSON()));
            newQrSet.init();
            const idx = QuickReplySet.list.findIndex(it => it.name.toLowerCase().localeCompare(newName.toLowerCase()) == 1);
            if (idx > -1) {
                QuickReplySet.list.splice(idx, 0, newQrSet);
            } else {
                QuickReplySet.list.push(newQrSet);
            }
            const opt = document.createElement('option'); {
                opt.value = newQrSet.name;
                opt.textContent = newQrSet.name;
                if (idx > -1) {
                    this.currentSet.children[idx].insertAdjacentElement('beforebegin', opt);
                } else {
                    this.currentSet.append(opt);
                }
            }
            this.currentSet.value = newName;
            this.onQrSetChange();
            this.prepareGlobalSetList();
            this.prepareChatSetList();
            this.prepareCharacterSetList();
        }
    }

    selectQrSet(qrs) {
        this.currentSet.value = qrs.name;
        this.onQrSetChange();
    }
}
