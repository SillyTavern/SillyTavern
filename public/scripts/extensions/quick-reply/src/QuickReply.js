import { hljs, morphdom } from '../../../../lib.js';
import { POPUP_RESULT, POPUP_TYPE, Popup } from '../../../popup.js';
import { setSlashCommandAutoComplete } from '../../../slash-commands.js';
import { SlashCommandAbortController } from '../../../slash-commands/SlashCommandAbortController.js';
import { SlashCommandBreakPoint } from '../../../slash-commands/SlashCommandBreakPoint.js';
import { SlashCommandClosure } from '../../../slash-commands/SlashCommandClosure.js';
import { SlashCommandClosureResult } from '../../../slash-commands/SlashCommandClosureResult.js';
import { SlashCommandDebugController } from '../../../slash-commands/SlashCommandDebugController.js';
import { SlashCommandExecutor } from '../../../slash-commands/SlashCommandExecutor.js';
import { SlashCommandParser } from '../../../slash-commands/SlashCommandParser.js';
import { SlashCommandParserError } from '../../../slash-commands/SlashCommandParserError.js';
import { SlashCommandScope } from '../../../slash-commands/SlashCommandScope.js';
import { debounce, delay, getSortableDelay, showFontAwesomePicker } from '../../../utils.js';
import { log, quickReplyApi, warn } from '../index.js';
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




    /**@type {number}*/ id;
    /**@type {string}*/ icon;
    /**@type {string}*/ label = '';
    /**@type {boolean}*/ showLabel = false;
    /**@type {string}*/ title = '';
    /**@type {string}*/ message = '';

    /**@type {QuickReplyContextLink[]}*/ contextList;

    /**@type {boolean}*/ preventAutoExecute = true;
    /**@type {boolean}*/ isHidden = false;
    /**@type {boolean}*/ executeOnStartup = false;
    /**@type {boolean}*/ executeOnUser = false;
    /**@type {boolean}*/ executeOnAi = false;
    /**@type {boolean}*/ executeOnChatChange = false;
    /**@type {boolean}*/ executeOnGroupMemberDraft = false;
    /**@type {boolean}*/ executeOnNewChat = false;
    /**@type {string}*/ automationId = '';

    /**@type {function}*/ onExecute;
    /**@type {(qr:QuickReply)=>AsyncGenerator<SlashCommandClosureResult|{closure:SlashCommandClosure, executor:SlashCommandExecutor|SlashCommandClosureResult}, SlashCommandClosureResult, boolean>}*/ onDebug;
    /**@type {function}*/ onDelete;
    /**@type {function}*/ onUpdate;
    /**@type {function}*/ onInsertBefore;
    /**@type {function}*/ onTransfer;


    /**@type {HTMLElement}*/ dom;
    /**@type {HTMLElement}*/ domIcon;
    /**@type {HTMLElement}*/ domLabel;
    /**@type {HTMLElement}*/ settingsDom;
    /**@type {HTMLElement}*/ settingsDomIcon;
    /**@type {HTMLInputElement}*/ settingsDomLabel;
    /**@type {HTMLTextAreaElement}*/ settingsDomMessage;

    /**@type {Popup}*/ editorPopup;
    /**@type {HTMLElement}*/ editorDom;

    /**@type {HTMLTextAreaElement}*/ editorMessage;
    /**@type {HTMLTextAreaElement}*/ editorMessageLabel;
    /**@type {HTMLElement}*/ editorSyntax;
    /**@type {HTMLElement}*/ editorExecuteBtn;
    /**@type {HTMLElement}*/ editorExecuteBtnPause;
    /**@type {HTMLElement}*/ editorExecuteBtnStop;
    /**@type {HTMLElement}*/ editorExecuteProgress;
    /**@type {HTMLElement}*/ editorExecuteErrors;
    /**@type {HTMLElement}*/ editorExecuteResult;
    /**@type {HTMLElement}*/ editorDebugState;
    /**@type {Promise}*/ editorExecutePromise;
    /**@type {boolean}*/ isExecuting;
    /**@type {SlashCommandAbortController}*/ abortController;
    /**@type {SlashCommandDebugController}*/ debugController;


    get hasContext() {
        return this.contextList && this.contextList.filter(it => it.set).length > 0;
    }




    unrender() {
        this.dom?.remove();
        this.dom = null;
    }
    updateRender() {
        if (!this.dom) return;
        this.dom.title = this.title || this.message;
        if (this.icon) {
            this.domIcon.classList.remove('qr--hidden');
            if (this.showLabel) this.domLabel.classList.remove('qr--hidden');
            else this.domLabel.classList.add('qr--hidden');
        } else {
            this.domIcon.classList.add('qr--hidden');
            this.domLabel.classList.remove('qr--hidden');
        }
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
                const icon = document.createElement('div'); {
                    this.domIcon = icon;
                    icon.classList.add('qr--button-icon');
                    icon.classList.add('fa-solid');
                    if (!this.icon) icon.classList.add('qr--hidden');
                    else icon.classList.add(this.icon);
                    root.append(icon);
                }
                const lbl = document.createElement('div'); {
                    this.domLabel = lbl;
                    lbl.classList.add('qr--button-label');
                    if (this.icon && !this.showLabel) lbl.classList.add('qr--hidden');
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
                const adder = document.createElement('div'); {
                    adder.classList.add('qr--set-itemAdder');
                    const actions = document.createElement('div'); {
                        actions.classList.add('qr--actions');
                        const addNew = document.createElement('div'); {
                            addNew.classList.add('qr--action');
                            addNew.classList.add('qr--add');
                            addNew.classList.add('menu_button');
                            addNew.classList.add('menu_button_icon');
                            addNew.classList.add('fa-solid');
                            addNew.classList.add('fa-plus');
                            addNew.title = 'Add quick reply';
                            addNew.addEventListener('click', ()=>this.onInsertBefore());
                            actions.append(addNew);
                        }
                        const paste = document.createElement('div'); {
                            paste.classList.add('qr--action');
                            paste.classList.add('qr--paste');
                            paste.classList.add('menu_button');
                            paste.classList.add('menu_button_icon');
                            paste.classList.add('fa-solid');
                            paste.classList.add('fa-paste');
                            paste.title = 'Add quick reply from clipboard';
                            paste.addEventListener('click', async()=>{
                                const text = await navigator.clipboard.readText();
                                this.onInsertBefore(text);
                            });
                            actions.append(paste);
                        }
                        const importFile = document.createElement('div'); {
                            importFile.classList.add('qr--action');
                            importFile.classList.add('qr--importFile');
                            importFile.classList.add('menu_button');
                            importFile.classList.add('menu_button_icon');
                            importFile.classList.add('fa-solid');
                            importFile.classList.add('fa-file-import');
                            importFile.title = 'Add quick reply from JSON file';
                            importFile.addEventListener('click', async()=>{
                                const inp = document.createElement('input'); {
                                    inp.type = 'file';
                                    inp.accept = '.json';
                                    inp.addEventListener('change', async()=>{
                                        if (inp.files.length > 0) {
                                            for (const file of inp.files) {
                                                const text = await file.text();
                                                this.onInsertBefore(text);
                                            }
                                        }
                                    });
                                    inp.click();
                                }
                            });
                            actions.append(importFile);
                        }
                        adder.append(actions);
                    }
                    item.append(adder);
                }
                const itemContent = document.createElement('div'); {
                    itemContent.classList.add('qr--content');
                    const drag = document.createElement('div'); {
                        drag.classList.add('drag-handle');
                        drag.classList.add('ui-sortable-handle');
                        drag.textContent = '☰';
                        itemContent.append(drag);
                    }
                    const lblContainer = document.createElement('div'); {
                        lblContainer.classList.add('qr--set-itemLabelContainer');
                        const icon = document.createElement('div'); {
                            this.settingsDomIcon = icon;
                            icon.title = 'Click to change icon';
                            icon.classList.add('qr--set-itemIcon');
                            icon.classList.add('menu_button');
                            icon.classList.add('fa-fw');
                            if (this.icon) {
                                icon.classList.add('fa-solid');
                                icon.classList.add(this.icon);
                            }
                            icon.addEventListener('click', async()=>{
                                let value = await showFontAwesomePicker();
                                this.updateIcon(value);
                            });
                            lblContainer.append(icon);
                        }
                        const lbl = document.createElement('input'); {
                            this.settingsDomLabel = lbl;
                            lbl.classList.add('qr--set-itemLabel');
                            lbl.classList.add('text_pole');
                            lbl.value = this.label;
                            lbl.addEventListener('input', ()=>this.updateLabel(lbl.value));
                            lblContainer.append(lbl);
                        }
                        itemContent.append(lblContainer);
                    }
                    item.append(itemContent);
                }
                const optContainer = document.createElement('div'); {
                    optContainer.classList.add('qr--set-optionsContainer');
                    const opt = document.createElement('div'); {
                        opt.classList.add('qr--action');
                        opt.classList.add('menu_button');
                        opt.classList.add('fa-fw');
                        opt.classList.add('fa-solid');
                        opt.textContent = '⁝';
                        opt.title = 'Additional options:\n - large editor\n - context menu\n - auto-execution\n - tooltip';
                        opt.addEventListener('click', ()=>this.showEditor());
                        optContainer.append(opt);
                    }
                    itemContent.append(optContainer);
                }
                const mes = document.createElement('textarea'); {
                    this.settingsDomMessage = mes;
                    mes.id = `qr--set--item${this.id}`;
                    mes.classList.add('qr--set-itemMessage');
                    mes.value = this.message;
                    //HACK need to use jQuery to catch the triggered event from the expanded editor
                    $(mes).on('input', ()=>this.updateMessage(mes.value));
                    itemContent.append(mes);
                }
                const actions = document.createElement('div'); {
                    actions.classList.add('qr--actions');
                    const move = document.createElement('div'); {
                        move.classList.add('qr--action');
                        move.classList.add('menu_button');
                        move.classList.add('fa-fw');
                        move.classList.add('fa-solid');
                        move.classList.add('fa-truck-arrow-right');
                        move.title = 'Move quick reply to other set';
                        move.addEventListener('click', ()=>this.onTransfer(this));
                        actions.append(move);
                    }
                    const copy = document.createElement('div'); {
                        copy.classList.add('qr--action');
                        copy.classList.add('menu_button');
                        copy.classList.add('fa-fw');
                        copy.classList.add('fa-solid');
                        copy.classList.add('fa-copy');
                        copy.title = 'Copy quick reply to clipboard';
                        copy.addEventListener('click', async()=>{
                            await navigator.clipboard.writeText(JSON.stringify(this));
                            copy.classList.add('qr--success');
                            await delay(3010);
                            copy.classList.remove('qr--success');
                        });
                        actions.append(copy);
                    }
                    const cut = document.createElement('div'); {
                        cut.classList.add('qr--action');
                        cut.classList.add('menu_button');
                        cut.classList.add('fa-fw');
                        cut.classList.add('fa-solid');
                        cut.classList.add('fa-cut');
                        cut.title = 'Cut quick reply to clipboard (copy and remove)';
                        cut.addEventListener('click', async()=>{
                            await navigator.clipboard.writeText(JSON.stringify(this));
                            this.delete();
                        });
                        actions.append(cut);
                    }
                    const exp = document.createElement('div'); {
                        exp.classList.add('qr--action');
                        exp.classList.add('menu_button');
                        exp.classList.add('fa-fw');
                        exp.classList.add('fa-solid');
                        exp.classList.add('fa-file-export');
                        exp.title = 'Export quick reply as file';
                        exp.addEventListener('click', ()=>{
                            const blob = new Blob([JSON.stringify(this)], { type:'text' });
                            const url = URL.createObjectURL(blob);
                            const a = document.createElement('a'); {
                                a.href = url;
                                a.download = `${this.label}.qr.json`;
                                a.click();
                            }
                        });
                        actions.append(exp);
                    }
                    const del = document.createElement('div'); {
                        del.classList.add('qr--action');
                        del.classList.add('menu_button');
                        del.classList.add('fa-fw');
                        del.classList.add('fa-solid');
                        del.classList.add('fa-trash-can');
                        del.classList.add('redWarningBG');
                        del.title = 'Remove Quick Reply\n---\nShift+Click to skip confirmation';
                        del.addEventListener('click', async(evt)=>{
                            if (!evt.shiftKey) {
                                const result = await Popup.show.confirm(
                                    'Remove Quick Reply',
                                    'Are you sure you want to remove this Quick Reply?',
                                );
                                if (result != POPUP_RESULT.AFFIRMATIVE) {
                                    return;
                                }
                            }
                            this.delete();
                        });
                        actions.append(del);
                    }
                    itemContent.append(actions);
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
            this.editorDom = dom;
            this.editorPopup = new Popup(dom, POPUP_TYPE.TEXT, undefined, { okButton: 'OK', wide: true, large: true, rows: 1 });
            const popupResult = this.editorPopup.show();

            // basics
            /**@type {HTMLElement}*/
            const icon = dom.querySelector('#qr--modal-icon');
            if (this.icon) {
                icon.classList.add('fa-solid');
                icon.classList.add(this.icon);
            }
            else {
                icon.textContent = '…';
            }
            icon.addEventListener('click', async()=>{
                let value = await showFontAwesomePicker();
                if (value === null) return;
                if (this.icon) icon.classList.remove(this.icon);
                if (value == '') {
                    icon.classList.remove('fa-solid');
                    icon.textContent = '…';
                } else {
                    icon.textContent = '';
                    icon.classList.add('fa-solid');
                    icon.classList.add(value);
                }
                this.updateIcon(value);
            });
            /**@type {HTMLInputElement}*/
            const showLabel = dom.querySelector('#qr--modal-showLabel');
            showLabel.checked = this.showLabel;
            showLabel.addEventListener('click', ()=>{
                this.updateShowLabel(showLabel.checked);
            });
            /**@type {HTMLInputElement}*/
            const label = dom.querySelector('#qr--modal-label');
            label.value = this.label;
            label.addEventListener('input', ()=>{
                this.updateLabel(label.value);
            });
            let switcherList;
            dom.querySelector('#qr--modal-switcher').addEventListener('click', (evt)=>{
                if (switcherList) {
                    switcherList.remove();
                    switcherList = null;
                    return;
                }
                const list = document.createElement('ul'); {
                    switcherList = list;
                    list.classList.add('qr--modal-switcherList');
                    const makeList = (qrs)=>{
                        const setItem = document.createElement('li'); {
                            setItem.classList.add('qr--modal-switcherItem');
                            setItem.addEventListener('click', ()=>{
                                list.innerHTML = '';
                                for (const qrs of quickReplyApi.listSets()) {
                                    const item = document.createElement('li'); {
                                        item.classList.add('qr--modal-switcherItem');
                                        item.addEventListener('click', ()=>{
                                            list.innerHTML = '';
                                            makeList(quickReplyApi.getSetByName(qrs));
                                        });
                                        const lbl = document.createElement('div'); {
                                            lbl.classList.add('qr--label');
                                            lbl.textContent = qrs;
                                            item.append(lbl);
                                        }
                                        list.append(item);
                                    }
                                }
                            });
                            const lbl = document.createElement('div'); {
                                lbl.classList.add('qr--label');
                                const icon = document.createElement('i'); {
                                    icon.classList.add('fa-solid');
                                    icon.classList.add('fa-arrow-alt-circle-right');
                                    icon.classList.add('menu_button');
                                    lbl.append(icon);
                                }
                                const text = document.createElement('span'); {
                                    text.textContent = 'Switch QR Sets...';
                                    lbl.append(text);
                                }
                                setItem.append(lbl);
                            }
                            list.append(setItem);
                        }
                        const addItem = document.createElement('li'); {
                            addItem.classList.add('qr--modal-switcherItem');
                            addItem.addEventListener('click', ()=>{
                                const qr = quickReplyApi.getSetByQr(this).addQuickReply();
                                this.editorPopup.completeAffirmative();
                                qr.showEditor();
                            });
                            const lbl = document.createElement('div'); {
                                lbl.classList.add('qr--label');
                                const icon = document.createElement('i'); {
                                    icon.classList.add('fa-solid');
                                    icon.classList.add('fa-plus');
                                    icon.classList.add('menu_button');
                                    lbl.append(icon);
                                }
                                const text = document.createElement('span'); {
                                    text.textContent = 'Add QR';
                                    lbl.append(text);
                                }
                                addItem.append(lbl);
                            }
                            list.append(addItem);
                        }
                        for (const qr of qrs.qrList.toSorted((a,b)=>a.label.toLowerCase().localeCompare(b.label.toLowerCase()))) {
                            const item = document.createElement('li'); {
                                item.classList.add('qr--modal-switcherItem');
                                if (qr == this) item.classList.add('qr--current');
                                else item.addEventListener('click', ()=>{
                                    this.editorPopup.completeAffirmative();
                                    qr.showEditor();
                                });
                                const lbl = document.createElement('div'); {
                                    lbl.classList.add('qr--label');
                                    lbl.textContent = qr.label;
                                    item.append(lbl);
                                }
                                const id = document.createElement('div'); {
                                    id.classList.add('qr--id');
                                    id.textContent = qr.id.toString();
                                    item.append(id);
                                }
                                const mes = document.createElement('div'); {
                                    mes.classList.add('qr--message');
                                    mes.textContent = qr.message;
                                    item.append(mes);
                                }
                                list.append(item);
                            }
                        }
                    };
                    makeList(quickReplyApi.getSetByQr(this));
                }
                label.parentElement.append(list);
            });
            /**@type {HTMLInputElement}*/
            const title = dom.querySelector('#qr--modal-title');
            title.value = this.title;
            title.addEventListener('input', () => {
                this.updateTitle(title.value);
            });
            /**@type {HTMLElement}*/
            const messageSyntaxInner = dom.querySelector('#qr--modal-messageSyntaxInner');
            this.editorSyntax = messageSyntaxInner;
            /**@type {HTMLInputElement}*/
            const wrap = dom.querySelector('#qr--modal-wrap');
            wrap.checked = JSON.parse(localStorage.getItem('qr--wrap') ?? 'false');
            wrap.addEventListener('click', () => {
                localStorage.setItem('qr--wrap', JSON.stringify(wrap.checked));
                updateWrap();
            });
            const updateWrap = () => {
                if (wrap.checked) {
                    message.style.whiteSpace = 'pre-wrap';
                    messageSyntaxInner.style.whiteSpace = 'pre-wrap';
                    if (this.clone) {
                        this.clone.style.whiteSpace = 'pre-wrap';
                    }
                } else {
                    message.style.whiteSpace = 'pre';
                    messageSyntaxInner.style.whiteSpace = 'pre';
                    if (this.clone) {
                        this.clone.style.whiteSpace = 'pre';
                    }
                }
                updateScrollDebounced();
            };
            const updateScroll = (evt) => {
                let left = message.scrollLeft;
                let top = message.scrollTop;
                if (evt) {
                    evt.preventDefault();
                    left = message.scrollLeft + evt.deltaX;
                    top = message.scrollTop + evt.deltaY;
                    message.scrollTo({
                        behavior: 'instant',
                        left,
                        top,
                    });
                }
                messageSyntaxInner.scrollTo({
                    behavior: 'instant',
                    left,
                    top,
                });
            };
            const updateScrollDebounced = updateScroll;
            const updateSyntaxEnabled = ()=>{
                if (syntax.checked) {
                    dom.querySelector('#qr--modal-messageHolder').classList.remove('qr--noSyntax');
                } else {
                    dom.querySelector('#qr--modal-messageHolder').classList.add('qr--noSyntax');
                }
            };
            /**@type {HTMLInputElement}*/
            const tabSize = dom.querySelector('#qr--modal-tabSize');
            tabSize.value = JSON.parse(localStorage.getItem('qr--tabSize') ?? '4');
            const updateTabSize = () => {
                message.style.tabSize = tabSize.value;
                messageSyntaxInner.style.tabSize = tabSize.value;
                updateScrollDebounced();
            };
            tabSize.addEventListener('change', () => {
                localStorage.setItem('qr--tabSize', JSON.stringify(Number(tabSize.value)));
                updateTabSize();
            });
            /**@type {HTMLInputElement}*/
            const executeShortcut = dom.querySelector('#qr--modal-executeShortcut');
            executeShortcut.checked = JSON.parse(localStorage.getItem('qr--executeShortcut') ?? 'true');
            executeShortcut.addEventListener('click', () => {
                localStorage.setItem('qr--executeShortcut', JSON.stringify(executeShortcut.checked));
            });
            /**@type {HTMLInputElement}*/
            const syntax = dom.querySelector('#qr--modal-syntax');
            syntax.checked = JSON.parse(localStorage.getItem('qr--syntax') ?? 'true');
            syntax.addEventListener('click', () => {
                localStorage.setItem('qr--syntax', JSON.stringify(syntax.checked));
                updateSyntaxEnabled();
            });
            if (navigator.keyboard) {
                navigator.keyboard.getLayoutMap().then(it=>dom.querySelector('#qr--modal-commentKey').textContent = it.get('Backslash'));
            } else {
                dom.querySelector('#qr--modal-commentKey').closest('small').remove();
            }
            this.editorMessageLabel = dom.querySelector('label[for="qr--modal-message"]');
            /**@type {HTMLTextAreaElement}*/
            const message = dom.querySelector('#qr--modal-message');
            this.editorMessage = message;
            message.value = this.message;
            const updateMessageDebounced = debounce((value)=>this.updateMessage(value), 10);
            message.addEventListener('input', () => {
                updateMessageDebounced(message.value);
                updateScrollDebounced();
            }, { passive:true });
            const getLineStart = ()=>{
                const start = message.selectionStart;
                const end = message.selectionEnd;
                let lineStart;
                if (start == 0 || message.value[start - 1] == '\n') {
                    // cursor is already at beginning of line
                    // -> keep start
                    lineStart = start;
                } else {
                    // cursor is at end of line or somewhere in the line
                    // -> find last newline before cursor and start after that
                    lineStart = message.value.lastIndexOf('\n', start - 1) + 1;
                }
                return lineStart;
            };
            message.addEventListener('keydown', async(evt) => {
                if (this.isExecuting) return;
                if (evt.key == 'Tab' && !evt.shiftKey && !evt.ctrlKey && !evt.altKey) {
                    // increase indent
                    evt.preventDefault();
                    const start = message.selectionStart;
                    const end = message.selectionEnd;
                    if (end - start > 0 && message.value.substring(start, end).includes('\n')) {
                        evt.stopImmediatePropagation();
                        evt.stopPropagation();
                        const lineStart = getLineStart();
                        message.selectionStart = lineStart;
                        const affectedLines = message.value.substring(lineStart, end).split('\n');
                        // document.execCommand is deprecated (and potentially buggy in some browsers) but the only way to retain undo-history
                        document.execCommand('insertText', false, `\t${affectedLines.join('\n\t')}`);
                        message.selectionStart = start + 1;
                        message.selectionEnd = end + affectedLines.length;
                        message.dispatchEvent(new Event('input', { bubbles:true }));
                    } else if (!(ac.isReplaceable && ac.isActive)) {
                        evt.stopImmediatePropagation();
                        evt.stopPropagation();
                        // document.execCommand is deprecated (and potentially buggy in some browsers) but the only way to retain undo-history
                        document.execCommand('insertText', false, '\t');
                        message.dispatchEvent(new Event('input', { bubbles:true }));
                    }
                } else if (evt.key == 'Tab' && evt.shiftKey && !evt.ctrlKey && !evt.altKey) {
                    // decrease indent
                    evt.preventDefault();
                    evt.stopImmediatePropagation();
                    evt.stopPropagation();
                    const start = message.selectionStart;
                    const end = message.selectionEnd;
                    const lineStart = getLineStart();
                    message.selectionStart = lineStart;
                    const affectedLines = message.value.substring(lineStart, end).split('\n');
                    const newText = affectedLines.map(it=>it.replace(/^\t/, '')).join('\n');
                    const delta = affectedLines.join('\n').length - newText.length;
                    // document.execCommand is deprecated (and potentially buggy in some browsers) but the only way to retain undo-history
                    if (delta > 0) {
                        if (newText == '') {
                            document.execCommand('delete', false);
                        } else {
                            document.execCommand('insertText', false, newText);
                        }
                        message.selectionStart = start - (affectedLines[0].startsWith('\t') ? 1 : 0);
                        message.selectionEnd = end - delta;
                        message.dispatchEvent(new Event('input', { bubbles:true }));
                    } else {
                        message.selectionStart = start;
                    }
                } else if (evt.key == 'Enter' && !evt.ctrlKey && !evt.shiftKey && !evt.altKey && !(ac.isReplaceable && ac.isActive)) {
                    // new line, keep indent
                    const start = message.selectionStart;
                    const end = message.selectionEnd;
                    let lineStart = getLineStart();
                    const indent = /^([^\S\n]*)/.exec(message.value.slice(lineStart))[1] ?? '';
                    if (indent.length) {
                        evt.stopImmediatePropagation();
                        evt.stopPropagation();
                        evt.preventDefault();
                        // document.execCommand is deprecated (and potentially buggy in some browsers) but the only way to retain undo-history
                        document.execCommand('insertText', false, `\n${indent}`);
                        message.selectionStart = start + 1 + indent.length;
                        message.selectionEnd  = message.selectionStart;
                        message.dispatchEvent(new Event('input', { bubbles:true }));
                    }
                } else if (evt.key == 'Enter' && evt.ctrlKey && !evt.shiftKey && !evt.altKey) {
                    if (executeShortcut.checked) {
                        // execute QR
                        evt.stopImmediatePropagation();
                        evt.stopPropagation();
                        evt.preventDefault();
                        const selectionStart = message.selectionStart;
                        const selectionEnd = message.selectionEnd;
                        message.blur();
                        await this.executeFromEditor();
                        if (document.activeElement != message) {
                            message.focus();
                            message.selectionStart = selectionStart;
                            message.selectionEnd = selectionEnd;
                        }
                    }
                } else if (evt.key == 'F9' && !evt.ctrlKey && !evt.shiftKey && !evt.altKey) {
                    // toggle breakpoint
                    evt.stopImmediatePropagation();
                    evt.stopPropagation();
                    evt.preventDefault();
                    preBreakPointStart = message.selectionStart;
                    preBreakPointEnd = message.selectionEnd;
                    toggleBreakpoint();
                } else if (evt.code == 'Backslash' && evt.ctrlKey && !evt.shiftKey && !evt.altKey) {
                    // toggle block comment
                    // (evt.code will use the same physical key on the keyboard across different keyboard layouts)
                    evt.stopImmediatePropagation();
                    evt.stopPropagation();
                    evt.preventDefault();
                    // check if we are inside a comment -> uncomment
                    const parser = new SlashCommandParser();
                    parser.parse(message.value, false);
                    const start = message.selectionStart;
                    const end = message.selectionEnd;
                    const comment = parser.commandIndex.findLast(it=>it.name == '*' && (it.start <= start && it.end >= start || it.start <= end && it.end >= end));
                    if (comment) {
                        // uncomment
                        let content = message.value.slice(comment.start + 1, comment.end - 1);
                        let len = content.length;
                        content = content.replace(/^ /, '');
                        const offsetStart = len - content.length;
                        len = content.length;
                        content = content.replace(/ $/, '');
                        const offsetEnd = len - content.length;
                        message.selectionStart = comment.start - 1;
                        message.selectionEnd = comment.end + 1;
                        // document.execCommand is deprecated (and potentially buggy in some browsers) but the only way to retain undo-history
                        document.execCommand('insertText', false, content);
                        message.selectionStart = start - (start >= comment.start ? 2 + offsetStart : 0);
                        message.selectionEnd = end - 2 - offsetStart - (end >= comment.end ? 2 + offsetEnd : 0);
                    } else {
                        // comment
                        const lineStart = getLineStart();
                        const lineEnd = message.value.indexOf('\n', end);
                        message.selectionStart = lineStart;
                        message.selectionEnd = lineEnd;
                        // document.execCommand is deprecated (and potentially buggy in some browsers) but the only way to retain undo-history
                        document.execCommand('insertText', false, `/* ${message.value.slice(lineStart, lineEnd)} *|`);
                        message.selectionStart = start + 3;
                        message.selectionEnd = end + 3;
                    }
                    message.dispatchEvent(new Event('input', { bubbles:true }));
                }
            });
            const ac = await setSlashCommandAutoComplete(message, true);
            message.addEventListener('wheel', (evt)=>{
                updateScrollDebounced(evt);
            });
            message.addEventListener('scroll', (evt)=>{
                updateScrollDebounced();
            });
            let preBreakPointStart;
            let preBreakPointEnd;
            /**
             * @param {SlashCommandBreakPoint} bp
             */
            const removeBreakpoint = (bp)=>{
                // start at -1 because "/" is not included in start-end
                let start = bp.start - 1;
                // step left until forward slash "/"
                while (message.value[start] != '/') start--;
                // step left while whitespace (except newline) before start
                while (/[^\S\n]/.test(message.value[start - 1])) start--;
                // if newline before indent, include the newline for removal
                if (message.value[start - 1] == '\n') start--;
                let end = bp.end;
                // step right while whitespace
                while (/\s/.test(message.value[end])) end++;
                // if pipe after whitepace, include pipe for removal
                if (message.value[end] == '|') end++;
                message.selectionStart = start;
                message.selectionEnd = end;
                // document.execCommand is deprecated (and potentially buggy in some browsers) but the only way to retain undo-history
                document.execCommand('insertText', false, '');
                message.dispatchEvent(new Event('input', { bubbles:true }));
                let postStart = preBreakPointStart;
                let postEnd = preBreakPointEnd;
                // set caret back to where it was
                if (preBreakPointStart <= start) {
                    // selection start was before breakpoint: do nothing
                } else if (preBreakPointStart > start && preBreakPointEnd < end) {
                    // selection start was inside breakpoint: move to index before breakpoint
                    postStart = start;
                } else if (preBreakPointStart >= end) {
                    // selection start was behind breakpoint: move back by length of removed string
                    postStart = preBreakPointStart - (end - start);
                }
                if (preBreakPointEnd <= start) {
                    // do nothing
                } else if (preBreakPointEnd > start && preBreakPointEnd < end) {
                    // selection end was inside breakpoint: move to index before breakpoint
                    postEnd = start;
                } else if (preBreakPointEnd >= end) {
                    // selection end was behind breakpoint: move back by length of removed string
                    postEnd = preBreakPointEnd - (end - start);
                }
                return { start:postStart, end:postEnd };
            };
            /**
             * @param {SlashCommandExecutor} cmd
             */
            const addBreakpoint = (cmd)=>{
                // start at -1 because "/" is not included in start-end
                let start = cmd.start - 1;
                let indent = '';
                // step left until forward slash "/"
                while (message.value[start] != '/') start--;
                // step left while whitespace (except newline) before start, collect the whitespace to help build indentation
                while (/[^\S\n]/.test(message.value[start - 1])) {
                    start--;
                    indent += message.value[start];
                }
                // if newline before indent, include the newline
                if (message.value[start - 1] == '\n') {
                    start--;
                    indent = `\n${indent}`;
                }
                const breakpointText = `${indent}/breakpoint |`;
                message.selectionStart = start;
                message.selectionEnd = start;
                // document.execCommand is deprecated (and potentially buggy in some browsers) but the only way to retain undo-history
                document.execCommand('insertText', false, breakpointText);
                message.dispatchEvent(new Event('input', { bubbles:true }));
                return breakpointText.length;
            };
            const toggleBreakpoint = ()=>{
                const idx = message.selectionStart;
                let postStart = preBreakPointStart;
                let postEnd = preBreakPointEnd;
                const parser = new SlashCommandParser();
                parser.parse(message.value, false);
                const cmdIdx = parser.commandIndex.findLastIndex(it=>it.start <= idx);
                if (cmdIdx > -1) {
                    const cmd = parser.commandIndex[cmdIdx];
                    if (cmd instanceof SlashCommandBreakPoint) {
                        const bp = cmd;
                        const { start, end } = removeBreakpoint(bp);
                        postStart = start;
                        postEnd = end;
                    } else if (parser.commandIndex[cmdIdx - 1] instanceof SlashCommandBreakPoint) {
                        const bp = parser.commandIndex[cmdIdx - 1];
                        const { start, end } = removeBreakpoint(bp);
                        postStart = start;
                        postEnd = end;
                    } else {
                        const len = addBreakpoint(cmd);
                        postStart += len;
                        postEnd += len;
                    }
                    message.selectionStart = postStart;
                    message.selectionEnd = postEnd;
                }
            };
            message.addEventListener('pointerdown', (evt)=>{
                if (!evt.ctrlKey || !evt.altKey) return;
                preBreakPointStart = message.selectionStart;
                preBreakPointEnd = message.selectionEnd;
            });
            message.addEventListener('pointerup', async(evt)=>{
                if (!evt.ctrlKey || !evt.altKey || message.selectionStart != message.selectionEnd) return;
                toggleBreakpoint();
            });
            /** @type {any} */
            const resizeListener = debounce((evt) => {
                updateScrollDebounced(evt);
                if (document.activeElement == message) {
                    message.blur();
                    message.focus();
                }
            });
            window.addEventListener('resize', resizeListener);
            updateSyntaxEnabled();
            const updateSyntax = ()=>{
                if (messageSyntaxInner && syntax.checked) {
                    morphdom(
                        messageSyntaxInner,
                        `<div>${hljs.highlight(`${message.value}${message.value.slice(-1) == '\n' ? ' ' : ''}`, { language:'stscript', ignoreIllegals:true })?.value}</div>`,
                        { childrenOnly: true },
                    );
                    updateScrollDebounced();
                }
            };
            let lastSyntaxUpdate = 0;
            const fpsTime = 1000 / 30;
            let lastMessageValue = null;
            let wasSyntax = null;
            const updateSyntaxLoop = ()=>{
                const now = Date.now();
                // fps limit
                if (now - lastSyntaxUpdate < fpsTime) return requestAnimationFrame(updateSyntaxLoop);
                // elements don't exist (yet?)
                if (!messageSyntaxInner || !message)  return requestAnimationFrame(updateSyntaxLoop);
                // elements no longer part of the document
                if (!messageSyntaxInner.closest('body')) return;
                // debugger is running
                if (this.isExecuting) {
                    lastMessageValue = null;
                    return requestAnimationFrame(updateSyntaxLoop);
                }
                // value hasn't changed
                if (wasSyntax == syntax.checked && lastMessageValue == message.value) return requestAnimationFrame(updateSyntaxLoop);
                wasSyntax = syntax.checked;
                lastSyntaxUpdate = now;
                lastMessageValue = message.value;
                updateSyntax();
                requestAnimationFrame(updateSyntaxLoop);
            };
            requestAnimationFrame(()=>updateSyntaxLoop());
            message.style.setProperty('text-shadow', 'none', 'important');
            updateWrap();
            updateTabSize();

            // context menu
            /**@type {HTMLTemplateElement}*/
            const tpl = dom.querySelector('#qr--ctxItem');
            const linkList = dom.querySelector('#qr--ctxEditor');
            const fillQrSetSelect = (/**@type {HTMLSelectElement}*/select, /**@type {QuickReplyContextLink}*/ link) => {
                [{ name: 'Select a QR set' }, ...QuickReplySet.list.toSorted((a,b)=>a.name.toLowerCase().localeCompare(b.name.toLowerCase()))].forEach(qrs => {
                    const opt = document.createElement('option'); {
                        opt.value = qrs.name;
                        opt.textContent = qrs.name;
                        opt.selected = qrs.name == link.set?.name;
                        select.append(opt);
                    }
                });
            };
            const addCtxItem = (/**@type {QuickReplyContextLink}*/link, /**@type {number}*/idx) => {
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
            /**@type {HTMLInputElement}*/
            const executeOnGroupMemberDraft = dom.querySelector('#qr--executeOnGroupMemberDraft');
            executeOnGroupMemberDraft.checked = this.executeOnGroupMemberDraft;
            executeOnGroupMemberDraft.addEventListener('click', ()=>{
                this.executeOnGroupMemberDraft = executeOnGroupMemberDraft.checked;
                this.updateContext();
            });
            /**@type {HTMLInputElement}*/
            const executeOnNewChat = dom.querySelector('#qr--executeOnNewChat');
            executeOnNewChat.checked = this.executeOnNewChat;
            executeOnNewChat.addEventListener('click', ()=>{
                this.executeOnNewChat = executeOnNewChat.checked;
                this.updateContext();
            });
            /**@type {HTMLInputElement}*/
            const automationId = dom.querySelector('#qr--automationId');
            automationId.value = this.automationId;
            automationId.addEventListener('input', () => {
                this.automationId = automationId.value;
                this.updateContext();
            });

            /**@type {HTMLElement}*/
            const executeProgress = dom.querySelector('#qr--modal-executeProgress');
            this.editorExecuteProgress = executeProgress;
            /**@type {HTMLElement}*/
            const executeErrors = dom.querySelector('#qr--modal-executeErrors');
            this.editorExecuteErrors = executeErrors;
            /**@type {HTMLElement}*/
            const executeResult = dom.querySelector('#qr--modal-executeResult');
            this.editorExecuteResult = executeResult;
            /**@type {HTMLElement}*/
            const debugState = dom.querySelector('#qr--modal-debugState');
            this.editorDebugState = debugState;
            /**@type {HTMLElement}*/
            const executeBtn = dom.querySelector('#qr--modal-execute');
            this.editorExecuteBtn = executeBtn;
            executeBtn.addEventListener('click', async()=>{
                await this.executeFromEditor();
            });
            /**@type {HTMLElement}*/
            const executeBtnPause = dom.querySelector('#qr--modal-pause');
            this.editorExecuteBtnPause = executeBtnPause;
            executeBtnPause.addEventListener('click', async()=>{
                if (this.abortController) {
                    if (this.abortController.signal.paused) {
                        this.abortController.continue('Continue button clicked');
                        this.editorExecuteProgress.classList.remove('qr--paused');
                    } else {
                        this.abortController.pause('Pause button clicked');
                        this.editorExecuteProgress.classList.add('qr--paused');
                    }
                }
            });
            /**@type {HTMLElement}*/
            const executeBtnStop = dom.querySelector('#qr--modal-stop');
            this.editorExecuteBtnStop = executeBtnStop;
            executeBtnStop.addEventListener('click', async()=>{
                this.abortController?.abort('Stop button clicked');
            });

            /**@type {HTMLTextAreaElement} */
            const inputOg = document.querySelector('#send_textarea');
            const inputMirror = dom.querySelector('#qr--modal-send_textarea');
            inputMirror.value = inputOg.value;
            const inputOgMo = new MutationObserver(muts=>{
                if (muts.find(it=>[...it.removedNodes].includes(inputMirror) || [...it.removedNodes].find(n=>n.contains(inputMirror)))) {
                    inputOg.removeEventListener('input', inputOgListener);
                }
            });
            inputOgMo.observe(document.body, { childList:true });
            const inputOgListener = ()=>{
                inputMirror.value = inputOg.value;
            };
            inputOg.addEventListener('input', inputOgListener);
            inputMirror.addEventListener('input', ()=>{
                inputOg.value = inputMirror.value;
            });

            /**@type {HTMLElement}*/
            const resumeBtn = dom.querySelector('#qr--modal-resume');
            resumeBtn.addEventListener('click', ()=>{
                this.debugController?.resume();
            });
            /**@type {HTMLElement}*/
            const stepBtn = dom.querySelector('#qr--modal-step');
            stepBtn.addEventListener('click', ()=>{
                this.debugController?.step();
            });
            /**@type {HTMLElement}*/
            const stepIntoBtn = dom.querySelector('#qr--modal-stepInto');
            stepIntoBtn.addEventListener('click', ()=>{
                this.debugController?.stepInto();
            });
            /**@type {HTMLElement}*/
            const stepOutBtn = dom.querySelector('#qr--modal-stepOut');
            stepOutBtn.addEventListener('click', ()=>{
                this.debugController?.stepOut();
            });
            /**@type {HTMLElement}*/
            const minimizeBtn = dom.querySelector('#qr--modal-minimize');
            minimizeBtn.addEventListener('click', ()=>{
                this.editorDom.classList.add('qr--minimized');
            });
            const maximizeBtn = dom.querySelector('#qr--modal-maximize');
            maximizeBtn.addEventListener('click', ()=>{
                this.editorDom.classList.remove('qr--minimized');
            });
            /**@type {boolean}*/
            let isResizing = false;
            let resizeStart;
            let wStart;
            /**@type {HTMLElement}*/
            const resizeHandle = dom.querySelector('#qr--resizeHandle');
            resizeHandle.addEventListener('pointerdown', (evt)=>{
                if (isResizing) return;
                isResizing = true;
                evt.preventDefault();
                resizeStart = evt.x;
                wStart = dom.querySelector('#qr--qrOptions').offsetWidth;
                const dragListener = debounce((evt)=>{
                    const w = wStart + resizeStart - evt.x;
                    dom.querySelector('#qr--qrOptions').style.setProperty('--width', `${w}px`);
                }, 5);
                window.addEventListener('pointerup', ()=>{
                    window.removeEventListener('pointermove', dragListener);
                    isResizing = false;
                }, { once:true });
                window.addEventListener('pointermove', dragListener);
            });

            await popupResult;

            window.removeEventListener('resize', resizeListener);
        } else {
            warn('failed to fetch qrEditor template');
        }
    }

    getEditorPosition(start, end, message = null) {
        const inputRect = this.editorMessage.getBoundingClientRect();
        const style = window.getComputedStyle(this.editorMessage);
        if (!this.clone) {
            this.clone = document.createElement('div');
            for (const key of style) {
                this.clone.style[key] = style[key];
            }
            this.clone.style.position = 'fixed';
            this.clone.style.visibility = 'hidden';
            const mo = new MutationObserver(muts=>{
                if (muts.find(it=>[...it.removedNodes].includes(this.editorMessage) || [...it.removedNodes].find(n=>n.contains(this.editorMessage)))) {
                    this.clone?.remove();
                    this.clone = null;
                }
            });
            mo.observe(document.body, { childList:true });
        }
        document.body.append(this.clone);
        this.clone.style.width = `${inputRect.width}px`;
        this.clone.style.height = `${inputRect.height}px`;
        this.clone.style.left = `${inputRect.left}px`;
        this.clone.style.top = `${inputRect.top}px`;
        this.clone.style.whiteSpace = style.whiteSpace;
        this.clone.style.tabSize = style.tabSize;
        const text = message ?? this.editorMessage.value;
        const before = text.slice(0, start);
        this.clone.textContent = before;
        const locator = document.createElement('span');
        locator.textContent = text.slice(start, end);
        this.clone.append(locator);
        this.clone.append(text.slice(end));
        this.clone.scrollTop = this.editorSyntax.scrollTop;
        this.clone.scrollLeft = this.editorSyntax.scrollLeft;
        const locatorRect = locator.getBoundingClientRect();
        const bodyRect = document.body.getBoundingClientRect();
        const location = {
            left: locatorRect.left - bodyRect.left,
            right: locatorRect.right - bodyRect.left,
            top: locatorRect.top - bodyRect.top,
            bottom: locatorRect.bottom - bodyRect.top,
        };
        // this.clone.remove();
        return location;
    }
    async executeFromEditor() {
        if (this.isExecuting) return;
        this.editorPopup.onClosing = ()=>false;
        const uuidCheck = /^[0-9a-z]{8}(-[0-9a-z]{4}){3}-[0-9a-z]{12}$/;
        const oText = this.message;
        this.isExecuting = true;
        this.editorDom.classList.add('qr--isExecuting');
        const noSyntax = this.editorDom.querySelector('#qr--modal-messageHolder').classList.contains('qr--noSyntax');
        if (noSyntax) {
            this.editorDom.querySelector('#qr--modal-messageHolder').classList.remove('qr--noSyntax');
        }
        this.editorExecuteBtn.classList.add('qr--busy');
        this.editorExecuteProgress.style.setProperty('--prog', '0');
        this.editorExecuteErrors.classList.remove('qr--hasErrors');
        this.editorExecuteResult.classList.remove('qr--hasResult');
        this.editorExecuteProgress.classList.remove('qr--error');
        this.editorExecuteProgress.classList.remove('qr--success');
        this.editorExecuteProgress.classList.remove('qr--paused');
        this.editorExecuteProgress.classList.remove('qr--aborted');
        this.editorExecuteErrors.innerHTML = '';
        this.editorExecuteResult.innerHTML = '';
        const syntax = this.editorDom.querySelector('#qr--modal-messageSyntaxInner');
        const updateScroll = (evt) => {
            let left = syntax.scrollLeft;
            let top = syntax.scrollTop;
            if (evt) {
                evt.preventDefault();
                left = syntax.scrollLeft + evt.deltaX;
                top = syntax.scrollTop + evt.deltaY;
                syntax.scrollTo({
                    behavior: 'instant',
                    left,
                    top,
                });
            }
            this.editorMessage.scrollTo({
                behavior: 'instant',
                left,
                top,
            });
        };
        const updateScrollDebounced = updateScroll;
        syntax.addEventListener('wheel', (evt)=>{
            updateScrollDebounced(evt);
        });
        syntax.addEventListener('scroll', (evt)=>{
            updateScrollDebounced();
        });
        try {
            this.abortController = new SlashCommandAbortController();
            this.debugController = new SlashCommandDebugController();
            this.debugController.onBreakPoint = async(closure, executor)=>{
                this.editorDom.classList.add('qr--isPaused');
                syntax.innerHTML = hljs.highlight(`${closure.fullText}${closure.fullText.slice(-1) == '\n' ? ' ' : ''}`, { language:'stscript', ignoreIllegals:true })?.value;
                this.editorMessageLabel.innerHTML = '';
                if (uuidCheck.test(closure.source)) {
                    const p0 = document.createElement('span'); {
                        p0.textContent = 'anonymous: ';
                        this.editorMessageLabel.append(p0);
                    }
                    const p1 = document.createElement('strong'); {
                        p1.textContent = executor.source.slice(0,5);
                        this.editorMessageLabel.append(p1);
                    }
                    const p2 = document.createElement('span'); {
                        p2.textContent = executor.source.slice(5, -5);
                        this.editorMessageLabel.append(p2);
                    }
                    const p3 = document.createElement('strong'); {
                        p3.textContent = executor.source.slice(-5);
                        this.editorMessageLabel.append(p3);
                    }
                } else {
                    this.editorMessageLabel.textContent = executor.source;
                }
                const source = closure.source;
                this.editorDebugState.innerHTML = '';
                let ci = -1;
                const varNames = [];
                const macroNames = [];
                /**
                 * @param {SlashCommandScope} scope
                 */
                const buildVars = (scope, isCurrent = false)=>{
                    if (!isCurrent) {
                        ci--;
                    }
                    const c = this.debugController.stack.slice(ci)[0];
                    const wrap = document.createElement('div'); {
                        wrap.classList.add('qr--scope');
                        if (isCurrent) {
                            const executor = this.debugController.cmdStack.slice(-1)[0];
                            { // named args
                                const namedTitle = document.createElement('div'); {
                                    namedTitle.classList.add('qr--title');
                                    namedTitle.textContent = `Named Args - /${executor.name}`;
                                    if (executor.command.name == 'run') {
                                        namedTitle.textContent += `${(executor.name == ':' ? '' : ' ')}${executor.unnamedArgumentList[0]?.value}`;
                                    }
                                    wrap.append(namedTitle);
                                }
                                const keys = new Set([...Object.keys(this.debugController.namedArguments ?? {}), ...(executor.namedArgumentList ?? []).map(it=>it.name)]);
                                for (const key of keys) {
                                    if (key[0] == '_') continue;
                                    const item = document.createElement('div'); {
                                        item.classList.add('qr--var');
                                        const k = document.createElement('div'); {
                                            k.classList.add('qr--key');
                                            k.textContent = key;
                                            item.append(k);
                                        }
                                        const vUnresolved = document.createElement('div'); {
                                            vUnresolved.classList.add('qr--val');
                                            vUnresolved.classList.add('qr--singleCol');
                                            const val = executor.namedArgumentList.find(it=>it.name == key)?.value;
                                            if (val instanceof SlashCommandClosure) {
                                                vUnresolved.classList.add('qr--closure');
                                                vUnresolved.title = val.rawText;
                                                vUnresolved.textContent = val.toString();
                                            } else if (val === undefined) {
                                                vUnresolved.classList.add('qr--undefined');
                                                vUnresolved.textContent = 'undefined';
                                            } else {
                                                let jsonVal;
                                                try { jsonVal = JSON.parse(val); } catch { /* empty */ }
                                                if (jsonVal && typeof jsonVal == 'object') {
                                                    vUnresolved.textContent = JSON.stringify(jsonVal, null, 2);
                                                } else {
                                                    vUnresolved.textContent = val;
                                                    vUnresolved.classList.add('qr--simple');
                                                }
                                            }
                                            item.append(vUnresolved);
                                        }
                                        const vResolved = document.createElement('div'); {
                                            vResolved.classList.add('qr--val');
                                            vResolved.classList.add('qr--singleCol');
                                            if (this.debugController.namedArguments === undefined) {
                                                vResolved.classList.add('qr--unresolved');
                                            } else {
                                                const val = this.debugController.namedArguments?.[key];
                                                if (val instanceof SlashCommandClosure) {
                                                    vResolved.classList.add('qr--closure');
                                                    vResolved.title = val.rawText;
                                                    vResolved.textContent = val.toString();
                                                } else if (val === undefined) {
                                                    vResolved.classList.add('qr--undefined');
                                                    vResolved.textContent = 'undefined';
                                                } else {
                                                    let jsonVal;
                                                    try { jsonVal = JSON.parse(val); } catch { /* empty */ }
                                                    if (jsonVal && typeof jsonVal == 'object') {
                                                        vResolved.textContent = JSON.stringify(jsonVal, null, 2);
                                                    } else {
                                                        vResolved.textContent = val;
                                                        vResolved.classList.add('qr--simple');
                                                    }
                                                }
                                            }
                                            item.append(vResolved);
                                        }
                                        wrap.append(item);
                                    }
                                }
                            }
                            { // unnamed args
                                const unnamedTitle = document.createElement('div'); {
                                    unnamedTitle.classList.add('qr--title');
                                    unnamedTitle.textContent = `Unnamed Args - /${executor.name}`;
                                    if (executor.command.name == 'run') {
                                        unnamedTitle.textContent += `${(executor.name == ':' ? '' : ' ')}${executor.unnamedArgumentList[0]?.value}`;
                                    }
                                    wrap.append(unnamedTitle);
                                }
                                let i = 0;
                                let unnamed = this.debugController.unnamedArguments ?? [];
                                if (!Array.isArray(unnamed)) unnamed = [unnamed];
                                while (unnamed.length < executor.unnamedArgumentList?.length ?? 0) unnamed.push(undefined);
                                unnamed = unnamed.map((it,idx)=>[executor.unnamedArgumentList?.[idx], it]);
                                for (const arg of unnamed) {
                                    i++;
                                    const item = document.createElement('div'); {
                                        item.classList.add('qr--var');
                                        const k = document.createElement('div'); {
                                            k.classList.add('qr--key');
                                            k.textContent = i.toString();
                                            item.append(k);
                                        }
                                        const vUnresolved = document.createElement('div'); {
                                            vUnresolved.classList.add('qr--val');
                                            vUnresolved.classList.add('qr--singleCol');
                                            const val = arg[0]?.value;
                                            if (val instanceof SlashCommandClosure) {
                                                vUnresolved.classList.add('qr--closure');
                                                vUnresolved.title = val.rawText;
                                                vUnresolved.textContent = val.toString();
                                            } else if (val === undefined) {
                                                vUnresolved.classList.add('qr--undefined');
                                                vUnresolved.textContent = 'undefined';
                                            } else {
                                                let jsonVal;
                                                try { jsonVal = JSON.parse(val); } catch { /* empty */ }
                                                if (jsonVal && typeof jsonVal == 'object') {
                                                    vUnresolved.textContent = JSON.stringify(jsonVal, null, 2);
                                                } else {
                                                    vUnresolved.textContent = val;
                                                    vUnresolved.classList.add('qr--simple');
                                                }
                                            }
                                            item.append(vUnresolved);
                                        }
                                        const vResolved = document.createElement('div'); {
                                            vResolved.classList.add('qr--val');
                                            vResolved.classList.add('qr--singleCol');
                                            if (this.debugController.unnamedArguments === undefined) {
                                                vResolved.classList.add('qr--unresolved');
                                            } else if ((Array.isArray(this.debugController.unnamedArguments) ? this.debugController.unnamedArguments : [this.debugController.unnamedArguments]).length < i) {
                                                // do nothing
                                            } else {
                                                const val = arg[1];
                                                if (val instanceof SlashCommandClosure) {
                                                    vResolved.classList.add('qr--closure');
                                                    vResolved.title = val.rawText;
                                                    vResolved.textContent = val.toString();
                                                } else if (val === undefined) {
                                                    vResolved.classList.add('qr--undefined');
                                                    vResolved.textContent = 'undefined';
                                                } else {
                                                    let jsonVal;
                                                    try { jsonVal = JSON.parse(val); } catch { /* empty */ }
                                                    if (jsonVal && typeof jsonVal == 'object') {
                                                        vResolved.textContent = JSON.stringify(jsonVal, null, 2);
                                                    } else {
                                                        vResolved.textContent = val;
                                                        vResolved.classList.add('qr--simple');
                                                    }
                                                }
                                            }
                                            item.append(vResolved);
                                        }
                                        wrap.append(item);
                                    }
                                }
                            }
                        }
                        // current scope
                        const title = document.createElement('div'); {
                            title.classList.add('qr--title');
                            title.textContent = isCurrent ? 'Current Scope' : 'Parent Scope';
                            if (c.source == source) {
                                let hi;
                                title.addEventListener('pointerenter', ()=>{
                                    const loc = this.getEditorPosition(Math.max(0, c.executorList[0].start - 1), c.executorList.slice(-1)[0].end, c.fullText);
                                    const layer = syntax.getBoundingClientRect();
                                    hi = document.createElement('div');
                                    hi.classList.add('qr--highlight-secondary');
                                    hi.style.left = `${loc.left - layer.left}px`;
                                    hi.style.width = `${loc.right - loc.left}px`;
                                    hi.style.top = `${loc.top - layer.top + syntax.scrollTop}px`;
                                    hi.style.height = `${loc.bottom - loc.top}px`;
                                    syntax.append(hi);
                                });
                                title.addEventListener('pointerleave', ()=>hi?.remove());
                            }
                            wrap.append(title);
                        }
                        for (const key of Object.keys(scope.variables)) {
                            const isHidden = varNames.includes(key);
                            if (!isHidden) varNames.push(key);
                            const item = document.createElement('div'); {
                                item.classList.add('qr--var');
                                if (isHidden) item.classList.add('qr--isHidden');
                                const k = document.createElement('div'); {
                                    k.classList.add('qr--key');
                                    k.textContent = key;
                                    item.append(k);
                                }
                                const v = document.createElement('div'); {
                                    v.classList.add('qr--val');
                                    const val = scope.variables[key];
                                    if (val instanceof SlashCommandClosure) {
                                        v.classList.add('qr--closure');
                                        v.title = val.rawText;
                                        v.textContent = val.toString();
                                    } else if (val === undefined) {
                                        v.classList.add('qr--undefined');
                                        v.textContent = 'undefined';
                                    } else {
                                        let jsonVal;
                                        try { jsonVal = JSON.parse(val); } catch { /* empty */ }
                                        if (jsonVal && typeof jsonVal == 'object') {
                                            v.textContent = JSON.stringify(jsonVal, null, 2);
                                        } else {
                                            v.textContent = val;
                                            v.classList.add('qr--simple');
                                        }
                                    }
                                    item.append(v);
                                }
                                wrap.append(item);
                            }
                        }
                        for (const key of Object.keys(scope.macros)) {
                            const isHidden = macroNames.includes(key);
                            if (!isHidden) macroNames.push(key);
                            const item = document.createElement('div'); {
                                item.classList.add('qr--macro');
                                if (isHidden) item.classList.add('qr--isHidden');
                                const k = document.createElement('div'); {
                                    k.classList.add('qr--key');
                                    k.textContent = key;
                                    item.append(k);
                                }
                                const v = document.createElement('div'); {
                                    v.classList.add('qr--val');
                                    const val = scope.macros[key];
                                    if (val instanceof SlashCommandClosure) {
                                        v.classList.add('qr--closure');
                                        v.title = val.rawText;
                                        v.textContent = val.toString();
                                    } else if (val === undefined) {
                                        v.classList.add('qr--undefined');
                                        v.textContent = 'undefined';
                                    } else {
                                        let jsonVal;
                                        try { jsonVal = JSON.parse(val); } catch { /* empty */ }
                                        if (jsonVal && typeof jsonVal == 'object') {
                                            v.textContent = JSON.stringify(jsonVal, null, 2);
                                        } else {
                                            v.textContent = val;
                                            v.classList.add('qr--simple');
                                        }
                                    }
                                    item.append(v);
                                }
                                wrap.append(item);
                            }
                        }
                        const pipeItem = document.createElement('div'); {
                            pipeItem.classList.add('qr--pipe');
                            const k = document.createElement('div'); {
                                k.classList.add('qr--key');
                                k.textContent = 'pipe';
                                pipeItem.append(k);
                            }
                            const v = document.createElement('div'); {
                                v.classList.add('qr--val');
                                const val = scope.pipe;
                                if (val instanceof SlashCommandClosure) {
                                    v.classList.add('qr--closure');
                                    v.title = val.rawText;
                                    v.textContent = val.toString();
                                } else if (val === undefined) {
                                    v.classList.add('qr--undefined');
                                    v.textContent = 'undefined';
                                } else {
                                    let jsonVal;
                                    try { jsonVal = JSON.parse(val); } catch { /* empty */ }
                                    if (jsonVal && typeof jsonVal == 'object') {
                                        v.textContent = JSON.stringify(jsonVal, null, 2);
                                    } else {
                                        v.textContent = val;
                                        v.classList.add('qr--simple');
                                    }
                                }
                                pipeItem.append(v);
                            }
                            wrap.append(pipeItem);
                        }
                        if (scope.parent) {
                            wrap.append(buildVars(scope.parent));
                        }
                    }
                    return wrap;
                };
                const buildStack = ()=>{
                    const wrap = document.createElement('div'); {
                        wrap.classList.add('qr--stack');
                        const title = document.createElement('div'); {
                            title.classList.add('qr--title');
                            title.textContent = 'Call Stack';
                            wrap.append(title);
                        }
                        let ei = -1;
                        for (const executor of this.debugController.cmdStack.toReversed()) {
                            ei++;
                            const c = this.debugController.stack.toReversed()[ei];
                            const item = document.createElement('div'); {
                                item.classList.add('qr--item');
                                if (executor.source == source) {
                                    let hi;
                                    item.addEventListener('pointerenter', ()=>{
                                        const loc = this.getEditorPosition(Math.max(0, executor.start - 1), executor.end, c.fullText);
                                        const layer = syntax.getBoundingClientRect();
                                        hi = document.createElement('div');
                                        hi.classList.add('qr--highlight-secondary');
                                        hi.style.left = `${loc.left - layer.left}px`;
                                        hi.style.width = `${loc.right - loc.left}px`;
                                        hi.style.top = `${loc.top - layer.top + syntax.scrollTop}px`;
                                        hi.style.height = `${loc.bottom - loc.top}px`;
                                        syntax.append(hi);
                                    });
                                    item.addEventListener('pointerleave', ()=>hi?.remove());
                                }
                                const cmd = document.createElement('div'); {
                                    cmd.classList.add('qr--cmd');
                                    cmd.textContent = `/${executor.name}`;
                                    if (executor.command.name == 'run') {
                                        cmd.textContent += `${(executor.name == ':' ? '' : ' ')}${executor.unnamedArgumentList[0]?.value}`;
                                    }
                                    item.append(cmd);
                                }
                                const src = document.createElement('div'); {
                                    src.classList.add('qr--source');
                                    const line = closure.fullText.slice(0, executor.start).split('\n').length;
                                    if (uuidCheck.test(executor.source)) {
                                        const p1 = document.createElement('span'); {
                                            p1.classList.add('qr--fixed');
                                            p1.textContent = executor.source.slice(0,5);
                                            src.append(p1);
                                        }
                                        const p2 = document.createElement('span'); {
                                            p2.classList.add('qr--truncated');
                                            p2.textContent = '…';
                                            src.append(p2);
                                        }
                                        const p3 = document.createElement('span'); {
                                            p3.classList.add('qr--fixed');
                                            p3.textContent = `${executor.source.slice(-5)}:${line}`;
                                            src.append(p3);
                                        }
                                        src.title = `anonymous: ${executor.source}`;
                                    } else {
                                        src.textContent = `${executor.source}:${line}`;
                                    }
                                    item.append(src);
                                }
                                wrap.append(item);
                            }
                        }
                    }
                    return wrap;
                };
                this.editorDebugState.append(buildVars(closure.scope, true));
                this.editorDebugState.append(buildStack());
                this.editorDebugState.classList.add('qr--active');
                const loc = this.getEditorPosition(Math.max(0, executor.start - 1), executor.end, closure.fullText);
                const layer = syntax.getBoundingClientRect();
                const hi = document.createElement('div');
                hi.classList.add('qr--highlight');
                if (this.debugController.namedArguments === undefined) {
                    hi.classList.add('qr--unresolved');
                }
                hi.style.left = `${loc.left - layer.left}px`;
                hi.style.width = `${loc.right - loc.left}px`;
                hi.style.top = `${loc.top - layer.top + syntax.scrollTop}px`;
                hi.style.height = `${loc.bottom - loc.top}px`;
                syntax.append(hi);
                const isStepping = await this.debugController.awaitContinue();
                hi.remove();
                this.editorDebugState.textContent = '';
                this.editorDebugState.classList.remove('qr--active');
                this.editorDom.classList.remove('qr--isPaused');
                return isStepping;
            };
            const result = await this.onDebug(this);
            if (this.abortController?.signal?.aborted) {
                this.editorExecuteProgress.classList.add('qr--aborted');
            } else {
                this.editorExecuteResult.textContent = result?.toString();
                this.editorExecuteResult.classList.add('qr--hasResult');
                this.editorExecuteProgress.classList.add('qr--success');
            }
            this.editorExecuteProgress.classList.remove('qr--paused');
        } catch (ex) {
            this.editorExecuteErrors.classList.add('qr--hasErrors');
            this.editorExecuteProgress.classList.add('qr--error');
            this.editorExecuteProgress.classList.remove('qr--paused');
            if (ex instanceof SlashCommandParserError) {
                this.editorExecuteErrors.innerHTML = `
                    <div>${ex.message}</div>
                    <div>Line: ${ex.line} Column: ${ex.column}</div>
                    <pre style="text-align:left;">${ex.hint}</pre>
                `;
            } else {
                this.editorExecuteErrors.innerHTML = `
                    <div>${ex.message}</div>
                `;
            }
        }
        if (noSyntax) {
            this.editorDom.querySelector('#qr--modal-messageHolder').classList.add('qr--noSyntax');
        }
        this.editorMessageLabel.innerHTML = '';
        this.editorMessageLabel.textContent = 'Message / Command: ';
        this.editorMessage.value = oText;
        this.editorMessage.dispatchEvent(new Event('input', { bubbles:true }));
        this.editorExecutePromise = null;
        this.editorExecuteBtn.classList.remove('qr--busy');
        this.editorDom.classList.remove('qr--isExecuting');
        this.isExecuting = false;
        this.editorPopup.onClosing = null;
    }

    updateEditorProgress(done, total) {
        this.editorExecuteProgress.style.setProperty('--prog', `${done / total * 100}`);
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
    updateIcon(value) {
        if (this.onUpdate) {
            if (value === null) return;
            if (this.settingsDomIcon) {
                if (this.icon != value) {
                    if (value == '') {
                        if (this.icon) {
                            this.settingsDomIcon.classList.remove(this.icon);
                        }
                        this.settingsDomIcon.textContent = '…';
                        this.settingsDomIcon.classList.remove('fa-solid');
                    } else {
                        if (this.icon) {
                            this.settingsDomIcon.classList.remove(this.icon);
                        } else {
                            this.settingsDomIcon.classList.add('fa-solid');
                        }
                        this.settingsDomIcon.classList.add(value);
                    }
                }
            }
            this.icon = value;
            this.updateRender();
            this.onUpdate(this);
        }
    }

    /**
     * @param {boolean} value
     */
    updateShowLabel(value) {
        if (this.onUpdate) {
            this.showLabel = value;
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


    async execute(args = {}, isEditor = false, isRun = false, options = {}) {
        if (this.message?.length > 0 && this.onExecute) {
            const scope = new SlashCommandScope();
            for (const key of Object.keys(args)) {
                if (key[0] == '_') continue;
                if (key == 'isAutoExecute') continue;
                scope.setMacro(`arg::${key}`, args[key]);
            }
            scope.setMacro('arg::*', '');
            if (isEditor) {
                this.abortController = new SlashCommandAbortController();
            }
            return await this.onExecute(this, {
                message: this.message,
                isAutoExecute: args.isAutoExecute ?? false,
                isEditor,
                isRun,
                scope,
                executionOptions: options,
            });
        }
    }




    toJSON() {
        return {
            id: this.id,
            icon: this.icon,
            showLabel: this.showLabel,
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
            executeOnGroupMemberDraft: this.executeOnGroupMemberDraft,
            executeOnNewChat: this.executeOnNewChat,
            automationId: this.automationId,
        };
    }
}
