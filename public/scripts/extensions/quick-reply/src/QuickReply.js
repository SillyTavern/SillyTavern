import { POPUP_TYPE, Popup } from '../../../popup.js';
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
import { debounce, getSortableDelay } from '../../../utils.js';
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
    /**@type {Boolean}*/ executeOnGroupMemberDraft = false;
    /**@type {String}*/ automationId = '';

    /**@type {Function}*/ onExecute;
    /**@type {(qr:QuickReply)=>AsyncGenerator<SlashCommandClosureResult|{closure:SlashCommandClosure, executor:SlashCommandExecutor|SlashCommandClosureResult}, SlashCommandClosureResult, boolean>}*/ onDebug;
    /**@type {Function}*/ onDelete;
    /**@type {Function}*/ onUpdate;


    /**@type {HTMLElement}*/ dom;
    /**@type {HTMLElement}*/ domLabel;
    /**@type {HTMLElement}*/ settingsDom;
    /**@type {HTMLInputElement}*/ settingsDomLabel;
    /**@type {HTMLTextAreaElement}*/ settingsDomMessage;

    /**@type {Popup}*/ editorPopup;
    /**@type {HTMLElement}*/ editorDom;

    /**@type {HTMLElement}*/ editorExecuteBtn;
    /**@type {HTMLElement}*/ editorExecuteBtnPause;
    /**@type {HTMLElement}*/ editorExecuteBtnStop;
    /**@type {HTMLElement}*/ editorExecuteProgress;
    /**@type {HTMLElement}*/ editorExecuteErrors;
    /**@type {HTMLElement}*/ editorExecuteResult;
    /**@type {HTMLElement}*/ editorDebugState;
    /**@type {HTMLInputElement}*/ editorExecuteHide;
    /**@type {Promise}*/ editorExecutePromise;
    /**@type {boolean}*/ isExecuting;
    /**@type {SlashCommandAbortController}*/ abortController;
    /**@type {SlashCommandDebugController}*/ debugController;


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
            this.editorDom = dom;
            this.editorPopup = new Popup(dom, POPUP_TYPE.TEXT, undefined, { okButton: 'OK', wide: true, large: true, rows: 1 });
            const popupResult = this.editorPopup.show();

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
            const updateSyntax = ()=>{
                messageSyntaxInner.innerHTML = hljs.highlight(`${message.value}${message.value.slice(-1) == '\n' ? ' ' : ''}`, { language:'stscript', ignoreIllegals:true })?.value;
            };
            const updateSyntaxEnabled = ()=>{
                if (JSON.parse(localStorage.getItem('qr--syntax'))) {
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
            /**@type {HTMLTextAreaElement}*/
            const message = dom.querySelector('#qr--modal-message');
            this.editorMessage = message;
            message.value = this.message;
            message.addEventListener('input', () => {
                updateSyntax();
                this.updateMessage(message.value);
                updateScrollDebounced();
            });
            setSlashCommandAutoComplete(message, true);
            //TODO move tab support for textarea into its own helper(?) and use for both this and .editor_maximize
            message.addEventListener('keydown', async(evt) => {
                if (this.isExecuting) return;
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
                        updateSyntax();
                    } else {
                        message.value = `${message.value.substring(0, start)}\t${message.value.substring(end)}`;
                        message.selectionStart = start + 1;
                        message.selectionEnd = end + 1;
                        updateSyntax();
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
                    updateSyntax();
                } else if (evt.key == 'Enter' && evt.ctrlKey && !evt.shiftKey && !evt.altKey) {
                    evt.stopPropagation();
                    evt.preventDefault();
                    if (executeShortcut.checked) {
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
                }
            });
            message.addEventListener('wheel', (evt)=>{
                updateScrollDebounced(evt);
            });
            message.addEventListener('scroll', (evt)=>{
                updateScrollDebounced();
            });
            message.addEventListener('pointerup', async(evt)=>{
                if (!evt.ctrlKey) return;
                const selIdx = message.selectionStart;
                const parser = new SlashCommandParser();
                parser.parse(message.value, false);
                const cmdIdx = parser.commandIndex.findLastIndex(it=>it.start <= message.selectionStart && it.end >= message.selectionStart);
                if (cmdIdx > -1) {
                    const cmd = parser.commandIndex[cmdIdx];
                    if (cmd instanceof SlashCommandBreakPoint) {
                        const bp = cmd;
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
                        if (message.value[end ] == '|') end++;
                        const v = `${message.value.slice(0, start)}${message.value.slice(end)}`;
                        message.value = v;
                        message.dispatchEvent(new Event('input', { bubbles:true }));
                    } else if (parser.commandIndex[cmdIdx - 1] instanceof SlashCommandBreakPoint) {
                        const bp = parser.commandIndex[cmdIdx - 1];
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
                        const v = `${message.value.slice(0, start)}${message.value.slice(end)}`;
                        message.value = v;
                        message.dispatchEvent(new Event('input', { bubbles:true }));
                    } else {
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
                            indent += `\n${indent}`;
                        }
                        const v = `${message.value.slice(0, start)}${indent}/breakpoint |${message.value.slice(start)}`;
                        message.value = v;
                        message.dispatchEvent(new Event('input', { bubbles:true }));
                    }
                }
            });
            /** @type {any} */
            const resizeListener = debounce((evt) => {
                updateSyntax();
                updateScrollDebounced(evt);
                if (document.activeElement == message) {
                    message.blur();
                    message.focus();
                }
            });
            window.addEventListener('resize', resizeListener);
            updateSyntaxEnabled();
            message.style.setProperty('text-shadow', 'none', 'important');
            /**@type {HTMLElement}*/
            const messageSyntaxInner = dom.querySelector('#qr--modal-messageSyntaxInner');
            updateSyntax();
            updateWrap();
            updateTabSize();

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
            /**@type {HTMLInputElement}*/
            const executeOnGroupMemberDraft = dom.querySelector('#qr--executeOnGroupMemberDraft');
            executeOnGroupMemberDraft.checked = this.executeOnGroupMemberDraft;
            executeOnGroupMemberDraft.addEventListener('click', ()=>{
                this.executeOnGroupMemberDraft = executeOnGroupMemberDraft.checked;
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
            /**@type {HTMLInputElement}*/
            const executeHide = dom.querySelector('#qr--modal-executeHide');
            this.editorExecuteHide = executeHide;
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

    getEditorPosition(start, end) {
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
        const text = this.editorMessage.value;
        const before = text.slice(0, start);
        this.clone.textContent = before;
        const locator = document.createElement('span');
        locator.textContent = text.slice(start, end);
        this.clone.append(locator);
        this.clone.append(text.slice(end));
        this.clone.scrollTop = this.editorMessage.scrollTop;
        this.clone.scrollLeft = this.editorMessage.scrollLeft;
        const locatorRect = locator.getBoundingClientRect();
        const location = {
            left: locatorRect.left,
            right: locatorRect.right,
            top: locatorRect.top,
            bottom: locatorRect.bottom,
        };
        // this.clone.remove();
        return location;
    }
    async executeFromEditor() {
        if (this.isExecuting) return;
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
        if (this.editorExecuteHide.checked) {
            this.editorPopup.dlg.classList.add('qr--hide');
        }
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
                                            const val = this.debugController.namedArguments[key];
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
                            let hi;
                            title.addEventListener('pointerenter', ()=>{
                                const loc = this.getEditorPosition(Math.max(0, c.executorList[0].start - 1), c.executorList.slice(-1)[0].end);
                                const layer = syntax.getBoundingClientRect();
                                hi = document.createElement('div');
                                hi.classList.add('qr--highlight-secondary');
                                hi.style.left = `${loc.left - layer.left}px`;
                                hi.style.width = `${loc.right - loc.left}px`;
                                hi.style.top = `${loc.top - layer.top}px`;
                                hi.style.height = `${loc.bottom - loc.top}px`;
                                syntax.append(hi);
                            });
                            title.addEventListener('pointerleave', ()=>hi?.remove());
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
                        for (const executor of this.debugController.cmdStack.toReversed()) {
                            const item = document.createElement('div'); {
                                item.classList.add('qr--item');
                                item.textContent = `/${executor.name}`;
                                if (executor.command.name == 'run') {
                                    item.textContent += `${(executor.name == ':' ? '' : ' ')}${executor.unnamedArgumentList[0]?.value}`;
                                }
                                let hi;
                                item.addEventListener('pointerenter', ()=>{
                                    const loc = this.getEditorPosition(Math.max(0, executor.start - 1), executor.end);
                                    const layer = syntax.getBoundingClientRect();
                                    hi = document.createElement('div');
                                    hi.classList.add('qr--highlight-secondary');
                                    hi.style.left = `${loc.left - layer.left}px`;
                                    hi.style.width = `${loc.right - loc.left}px`;
                                    hi.style.top = `${loc.top - layer.top}px`;
                                    hi.style.height = `${loc.bottom - loc.top}px`;
                                    syntax.append(hi);
                                });
                                item.addEventListener('pointerleave', ()=>hi?.remove());
                                wrap.append(item);
                            }
                        }
                    }
                    return wrap;
                };
                this.editorDebugState.append(buildVars(closure.scope, true));
                this.editorDebugState.append(buildStack());
                this.editorDebugState.classList.add('qr--active');
                const loc = this.getEditorPosition(Math.max(0, executor.start - 1), executor.end);
                const layer = syntax.getBoundingClientRect();
                const hi = document.createElement('div');
                hi.classList.add('qr--highlight');
                if (this.debugController.namedArguments === undefined) {
                    hi.classList.add('qr--unresolved');
                }
                hi.style.left = `${loc.left - layer.left}px`;
                hi.style.width = `${loc.right - loc.left}px`;
                hi.style.top = `${loc.top - layer.top}px`;
                hi.style.height = `${loc.bottom - loc.top}px`;
                syntax.append(hi);
                const isStepping = await this.debugController.awaitContinue();
                hi.remove();
                this.editorDebugState.textContent = '';
                this.editorDebugState.classList.remove('qr--active');
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
        this.editorExecutePromise = null;
        this.editorExecuteBtn.classList.remove('qr--busy');
        this.editorPopup.dlg.classList.remove('qr--hide');
        this.editorDom.classList.remove('qr--isExecuting');
        this.isExecuting = false;
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


    async execute(args = {}, isEditor = false, isRun = false) {
        if (this.message?.length > 0 && this.onExecute) {
            const scope = new SlashCommandScope();
            for (const key of Object.keys(args)) {
                scope.setMacro(`arg::${key}`, args[key]);
            }
            if (isEditor) {
                this.abortController = new SlashCommandAbortController();
            }
            return await this.onExecute(this, {
                message:this.message,
                isAutoExecute: args.isAutoExecute ?? false,
                isEditor,
                isRun,
                scope,
            });
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
            executeOnGroupMemberDraft: this.executeOnGroupMemberDraft,
            automationId: this.automationId,
        };
    }
}
