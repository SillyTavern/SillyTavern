import { eventSource, event_types, sendTextareaMessage } from '../script.js';
import { Popup } from './popup.js';

/** @typedef {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} AnyInput */

// Constants for cleaner labeling
const ID_MAP = {
    'main_api': 'Main API Type',
    'chat_completion_source': 'Chat Completion Source',
    'textgen_type': 'API Type',
    'api_key_openai': 'OpenAI API Key',
    'openai_reverse_proxy': 'Proxy Server URL',
    'openai_proxy_password': 'Proxy Password',
    'model_openai_select': 'Model Selection',
    'api_key_makersuite': 'Google AI Studio API Key',
    'api_url_text': 'API URL',
    'settings_preset_openai': 'Chat Completion Presets',
    'settings_preset_textgenerationwebui': 'Text Completion Presets',
    'settings_preset': 'Kobold Presets',
    'settings_preset_novel': 'NovelAI Presets',
    'instruct_presets': 'Instruct Template',
    'context_presets': 'Context Template',
    'sysprompt_select': 'System Prompt',
    'reasoning_select': 'Reasoning Formatting',
};

// Global references
/** @type {HTMLButtonElement | null} */
let trigger = null;
/** @type {HTMLDivElement | null} */
let overlay = null;

const A11yController = {
    /** @type {any | null} */
    trap: null,
    /** @type {string|null} */
    currentView: null,
    /** @type {MutationObserver|null} */
    toastObserver: null,
    /** @type {MutationObserver|null} */
    chatObserver: null,
    /** @type {string|null} */
    importContext: null,
    /** @type {any} */
    originalPopupShow: null,

    init() {
        // Create Trigger Button
        trigger = document.createElement('button');
        trigger.className = 'silly-a11y-trigger';
        trigger.textContent = 'Press Enter to enter Accessibility Mode';
        trigger.onclick = () => this.enterMode();
        document.body.prepend(trigger);
        // Create Overlay
        overlay = document.createElement('div');
        overlay.id = 'a11y-overlay';
        overlay.setAttribute('role', 'dialog');
        overlay.setAttribute('aria-modal', 'true');
        overlay.style.display = 'none';
        overlay.innerHTML = `
            <div id="a11y-status" class="sr-only" aria-live="assertive"></div>
            <div id="a11y-header" tabindex="-1"></div>
            <input type="file" id="a11y-file-input" class="sr-only" tabIndex="-1">
            <div id="a11y-content"></div>
            <div id="a11y-footer">Esc: Back | Tab: Navigate | Enter: Action</div>
        `;
        document.body.appendChild(overlay);

        const focusTrapLib = /** @type {any} */ (window).focusTrap;
        if (focusTrapLib) {
            this.trap = focusTrapLib.createFocusTrap('#a11y-overlay', {
                initialFocus: '#a11y-header',
                fallbackFocus: '#a11y-header',
                allowOutsideClick: false,
                escapeDeactivates: false,
                returnFocusOnDeactivate: true,
            });
        }

        document.addEventListener('keydown', (e) => this.handleGlobalKeydown(e));

        /** @type {HTMLInputElement | null} */
        const fileInput = document.querySelector('#a11y-file-input');
        if (fileInput) {
            fileInput.onchange = (e) => this.handleFileSelected(e);
        }

        this.initToastMonitor();
        this.interceptPopups();
    },

    /** @param {KeyboardEvent} e */
    handleGlobalKeydown(e) {
        if (!overlay || overlay.style.display !== 'flex') return;

        if (e.key === 'Escape') {
            e.preventDefault();
            if (this.currentView !== 'MENU') {
                if (this.currentView === 'CHAT') this.navigateTo('CHARS');
                else this.navigateTo('MENU');
            } else {
                this.exitMode();
            }
            return;
        }
    },

    interceptPopups() {
        const self = this;
        const popupModule = /** @type {any} */ (Popup);

        if (popupModule && popupModule.show) {
            this.originalPopupShow = popupModule.show;

            popupModule.show = async function (title, content, type, options) {
                if (overlay && overlay.style.display === 'flex') {
                    let textContent = '';
                    if (typeof content === 'string') {
                        textContent = content;
                    } else if (content && content instanceof HTMLElement) {
                        textContent = content.textContent || '';
                    } else if (content && typeof content === 'object' && 'jquery' in content) {
                        textContent = content.text();
                    }
                    return await self.renderA11yConfirmation(title, textContent);
                }

                if (typeof self.originalPopupShow === 'function') {
                    return self.originalPopupShow.apply(this, arguments);
                }
                return null;
            };
        }
    },

    /**
     * @param {string} title
     * @param {string} content
     * @returns {Promise<number>}
     */
    async renderA11yConfirmation(title, content) {
        const contentArea = document.getElementById('a11y-content');
        const header = document.getElementById('a11y-header');
        if (!contentArea || !header) return 0;

        const previousHTML = contentArea.innerHTML;
        const previousView = this.currentView;

        this.currentView = 'CONFIRM';
        header.innerText = 'Confirmation Required';
        contentArea.innerHTML = '';

        this.createA11yLabel(contentArea, typeof title === 'string' ? title : 'Alert');
        const desc = document.createElement('div');
        desc.className = 'a11y-msg-text';
        desc.innerHTML = typeof content === 'string' ? content : 'Please confirm action.';
        contentArea.appendChild(desc);

        return new Promise((resolve) => {
            const btnYes = document.createElement('button');
            btnYes.className = 'a11y-btn';
            btnYes.innerText = 'Yes / OK';
            btnYes.onclick = () => {
                this.currentView = previousView;
                contentArea.innerHTML = previousHTML;
                resolve(1);
            };

            const btnNo = document.createElement('button');
            btnNo.className = 'a11y-btn';
            btnNo.innerText = 'No / Cancel';
            btnNo.onclick = () => {
                this.currentView = previousView;
                contentArea.innerHTML = previousHTML;
                resolve(0);
            };

            contentArea.appendChild(btnYes);
            contentArea.appendChild(btnNo);
            btnYes.focus();
        });
    },

    initToastMonitor() {
        const monitor = () => {
            const container = document.getElementById('toast-container');
            if (container) {
                this.toastObserver = new MutationObserver((mutations) => {
                    mutations.forEach(mut => {
                        if (mut.addedNodes.length) {
                            const node = /** @type {HTMLElement} */ (mut.addedNodes[0]);
                            const text = node.textContent || node.innerText;
                            if (text) this.announce('System Notification: ' + text);
                        }
                    });
                });
                this.toastObserver.observe(container, { childList: true });
            }
        };
        setTimeout(monitor, 2000);
    },

    enterMode() {
        if (!overlay) return;
        overlay.style.display = 'flex';
        this.navigateTo('MENU');
        if (this.trap) this.trap.activate();
        this.announce('Accessibility Mode activated');
    },

    exitMode() {
        if (overlay) overlay.style.display = 'none';
        if (this.trap) this.trap.deactivate();
        this.announce('Accessibility Mode deactivated');
    },

    /** @param {string} text */
    announce(text) {
        const el = document.getElementById('a11y-status');
        if (el) {
            el.innerText = '';
            setTimeout(() => { el.innerText = text; }, 50);
        }
    },

    /**
     * @param {string} view
     * @param {string|null} data
     */
    navigateTo(view, data = null) {
        this.currentView = view;
        const content = document.getElementById('a11y-content');
        const header = /** @type {HTMLElement | null} */ (document.getElementById('a11y-header'));
        if (!content || !header) return;

        content.innerHTML = '';
        content.scrollTop = 0;
        if (this.chatObserver) { this.chatObserver.disconnect(); this.chatObserver = null; }

        switch (view) {
            case 'MENU': header.innerText = 'Main Menu'; this.renderMainMenu(content); break;
            case 'API': header.innerText = 'API Connections'; this.renderApiMenu(content); break;
            case 'PRESET': header.innerText = 'Presets and Templates'; this.renderPresetMenu(content); break;
            case 'CHARS': header.innerText = 'Character Selection'; this.renderCharList(content); break;
            case 'CHAT': header.innerText = 'Chat Session: ' + (data || ''); this.renderChatInterface(content); break;
        }
        header.focus();
    },

    /** @param {string} context */
    triggerUpload(context) {
        this.importContext = context;
        /** @type {HTMLInputElement | null} */
        const fileInput = document.querySelector('#a11y-file-input');
        if (!fileInput) return;

        let targetSelector = '';
        if (context === 'CHARACTER') targetSelector = '#character_import_file';
        else if (context === 'PRESET_KOBOLD') targetSelector = '[data-preset-manager-file="kobold"]';
        else if (context === 'PRESET_NOVEL') targetSelector = '[data-preset-manager-file="novel"]';
        else if (context === 'PRESET_TEXTGEN') targetSelector = '[data-preset-manager-file="textgenerationwebui"]';
        else if (context === 'PRESET_OPENAI') targetSelector = '#openai_preset_import_file';

        if (targetSelector) {
            const origInput = /** @type {HTMLElement | null} */ (document.querySelector(targetSelector));
            if (origInput) {
                origInput.click();
                return;
            }
        }

        fileInput.accept = (context === 'CHARACTER') ? '.png,.json,.charx,.byaf' : '.json,.settings';
        fileInput.click();
    },

    /** @param {Event} e */
    async handleFileSelected(e) {
        const input = /** @type {HTMLInputElement} */ (e.target);
        const file = input.files ? input.files[0] : null;
        if (!file) return;

        this.announce('Processing file: ' + file.name);
        input.value = '';
    },

    /** @param {HTMLElement} container */
    renderMainMenu(container) {
        const routes = [
            { t: 'Character List', a: () => this.navigateTo('CHARS') },
            { t: 'API Connections', a: () => this.navigateTo('API') },
            { t: 'Presets', a: () => this.navigateTo('PRESET') },
        ];

        routes.forEach(i => {
            const b = document.createElement('button');
            b.className = 'a11y-btn';
            b.innerText = i.t;
            b.onclick = i.a;
            container.appendChild(b);
        });

        const exitBtn = document.createElement('button');
        exitBtn.className = 'a11y-btn';
        exitBtn.style.marginTop = '2rem';
        exitBtn.innerText = 'Exit Accessibility Mode';
        
        exitBtn.setAttribute('aria-hidden', 'true');
        exitBtn.tabIndex = -1;
        
        exitBtn.onclick = () => this.exitMode();
        container.appendChild(exitBtn);
    },

    /** @param {HTMLElement} container */
    renderApiMenu(container) {
        const cpBlock = document.getElementById('rm_api_block');
        if (cpBlock) {
            const cpSection = document.createElement('div');
            this.createSectionHeader(cpSection, 'Connection Profiles');

            const profSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById('connection_profiles'));
            if (profSelect) {
                this.createA11yControl(cpSection, profSelect);
            }

            const actionDiv = document.createElement('div');
            actionDiv.className = 'a11y-grid';
            const actions = [
                { id: 'create_connection_profile', label: 'New Profile' },
                { id: 'update_connection_profile', label: 'Update' },
                { id: 'edit_connection_profile', label: 'Edit' },
                { id: 'delete_connection_profile', label: 'Delete', danger: true },
            ];
            actions.forEach(a => {
                const btn = /** @type {HTMLElement | null} */ (document.getElementById(a.id));
                if (btn && window.getComputedStyle(btn).display !== 'none') {
                    const b = document.createElement('button');
                    b.className = `a11y-btn ${a.danger ? 'a11y-btn-danger' : ''}`;
                    b.innerText = a.label;
                    b.onclick = () => btn.click();
                    actionDiv.appendChild(b);
                }
            });
            cpSection.appendChild(actionDiv);
            container.appendChild(cpSection);
        }

        const mainSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById('main_api'));
        if (!mainSelect) return;

        const lbl = this.createA11yLabel(container, 'Main API Type');
        const a11yMain = document.createElement('select');
        a11yMain.id = 'a11y-main-api-select';
        lbl.htmlFor = a11yMain.id;
        a11yMain.className = 'a11y-select';
        Array.from(mainSelect.options).forEach(o => a11yMain.add(new Option(o.text, o.value, false, o.selected)));

        a11yMain.onchange = (e) => {
            const target = /** @type {HTMLSelectElement} */ (e.target);
            // @ts-ignore
            if (window.$) window.$(mainSelect).val(target.value).trigger('change');
            else { mainSelect.value = target.value; mainSelect.dispatchEvent(new Event('change')); }

            setTimeout(() => this.renderApiSettings(settingsContainer), 100);
        };
        container.appendChild(a11yMain);

        const settingsContainer = document.createElement('div');
        container.appendChild(settingsContainer);
        this.renderApiSettings(settingsContainer);

        const globalSection = document.createElement('div');
        globalSection.className = 'a11y-section';
        this.createSectionHeader(globalSection, 'Global API Settings');

        const autoConnect = /** @type {HTMLInputElement | null} */ (document.getElementById('auto-connect-checkbox'));
        if (autoConnect) {
            this.createA11yControl(globalSection, autoConnect);
        }
        container.appendChild(globalSection);

        this.addBackButton(container, 'MENU');
    },

    /** @param {HTMLElement} container */
    renderApiSettings(container) {
        container.innerHTML = '';
        const mainSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById('main_api'));
        if (!mainSelect) return;

        const apiMap = { 'kobold': 'kobold_api', 'koboldhorde': 'kobold_horde', 'novel': 'novel_api', 'textgenerationwebui': 'textgenerationwebui_api', 'openai': 'openai_api' };
        // @ts-ignore
        const targetId = apiMap[mainSelect.value];
        const targetContainer = document.getElementById(targetId);

        if (targetContainer) {
            this.createA11yLabel(container, 'API Parameters');
            this.harvestInputs(targetContainer, container);

            const actionDiv = document.createElement('div');
            actionDiv.className = 'a11y-grid';

            targetContainer.querySelectorAll('.api_button, #test_api_button, .openrouter_authorize, #horde_api_key_button').forEach(btn => {
                const htmlBtn = /** @type {HTMLElement} */ (btn);
                const style = window.getComputedStyle(htmlBtn);
                if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;

                const text = htmlBtn.innerText.trim() || htmlBtn.getAttribute('title') || 'Action';
                const b = document.createElement('button');
                b.className = 'a11y-btn a11y-btn-action';
                b.innerText = text;
                b.onclick = () => {
                    // @ts-ignore
                    if (window.$) window.$(htmlBtn).trigger('click'); else htmlBtn.click();
                };
                actionDiv.appendChild(b);
            });
            container.appendChild(actionDiv);

            const drivers = targetContainer.querySelectorAll('select#chat_completion_source, select#textgen_type');
            drivers.forEach(d => {
                const a11yDriverId = 'a11y_ctrl_' + (d.id || '');
                const a11yDriver = container.querySelector('#' + a11yDriverId);
                if (a11yDriver) {
                    a11yDriver.addEventListener('change', () => {
                        setTimeout(() => this.renderApiSettings(container), 100);
                    });
                }
            });
        }
    },

    /** @param {HTMLElement} container */
    renderPresetMenu(container) {
        const apiSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById('main_api'));
        const api = apiSelect ? apiSelect.value : 'kobold';
        let selectId = 'settings_preset';

        if (api === 'novel') selectId = 'settings_preset_novel';
        if (api === 'textgenerationwebui') selectId = 'settings_preset_textgenerationwebui';
        if (api === 'openai') selectId = 'settings_preset_openai';

        const selectEl = /** @type {HTMLSelectElement | null} */ (document.getElementById(selectId));

        const section1 = document.createElement('div');
        this.createSectionHeader(section1, `Generation Presets (${api})`);

        if (selectEl) {
            const lbl = this.createA11yLabel(section1, 'Active Preset');
            const a11ySelect = document.createElement('select');
            a11ySelect.id = `a11y-preset-select-${api}`;
            lbl.htmlFor = a11ySelect.id;
            a11ySelect.className = 'a11y-select';

            Array.from(selectEl.options).forEach(o => a11ySelect.add(new Option(o.text, o.value, false, o.selected)));
            a11ySelect.onchange = (e) => {
                const target = /** @type {HTMLSelectElement} */ (e.target);
                // @ts-ignore
                if (window.$) window.$(selectEl).val(target.value).trigger('change');
                else { selectEl.value = target.value; selectEl.dispatchEvent(new Event('change')); }
                this.announce('Preset changed to ' + target.options[target.selectedIndex].text);
            };
            section1.appendChild(a11ySelect);

            const btnGrid = document.createElement('div');
            btnGrid.className = 'a11y-grid';

            const actions = [
                { sel: `[data-preset-manager-new="${api === 'koboldhorde' ? 'kobold' : api}"]`, txt: 'Save As New', fallbackId: `new_${api === 'openai' ? 'oai' : api}_preset` },
                { sel: `[data-preset-manager-update="${api === 'koboldhorde' ? 'kobold' : api}"]`, txt: 'Update Current', fallbackId: `update_${api === 'openai' ? 'oai' : api}_preset` },
                { sel: `[data-preset-manager-rename="${api === 'koboldhorde' ? 'kobold' : api}"]`, txt: 'Rename', fallbackId: null },
                { sel: `[data-preset-manager-delete="${api === 'koboldhorde' ? 'kobold' : api}"]`, txt: 'Delete', fallbackId: `delete_${api === 'openai' ? 'oai' : api}_preset` },
                { sel: `[data-preset-manager-import="${api === 'koboldhorde' ? 'kobold' : api}"]`, txt: 'Import Preset', fallbackId: `import_${api === 'openai' ? 'oai' : api}_preset` },
                { sel: `[data-preset-manager-export="${api === 'koboldhorde' ? 'kobold' : api}"]`, txt: 'Export Preset', fallbackId: `export_${api === 'openai' ? 'oai' : api}_preset` },
            ];

            actions.forEach(act => {
                let btn = /** @type {HTMLElement | null} */ (document.querySelector(act.sel));
                if (!btn && act.fallbackId) btn = document.getElementById(act.fallbackId);

                if (btn) {
                    const b = document.createElement('button');
                    b.className = 'a11y-btn';
                    if (act.txt === 'Delete') b.classList.add('a11y-btn-danger');
                    b.innerText = act.txt;
                    b.onclick = () => {
                        // @ts-ignore
                        if (window.$) window.$(btn).trigger('click'); else btn.click();
                    };
                    btnGrid.appendChild(b);
                }
            });
            section1.appendChild(btnGrid);
        }
        container.appendChild(section1);

        const section2 = document.createElement('div');
        this.createSectionHeader(section2, 'Generation Parameters');

        const commonBlock = document.getElementById('common-gen-settings-block');
        if (commonBlock) this.harvestInputs(commonBlock, section2);

        let rangeBlockId = 'novel_api-settings';
        if (api === 'openai') rangeBlockId = 'openai_settings';
        else if (api === 'textgenerationwebui') rangeBlockId = 'textgenerationwebui_api-settings';
        else if (api === 'kobold' || api === 'koboldhorde') rangeBlockId = 'kobold_api-settings';

        const rangeBlock = document.getElementById(rangeBlockId);
        if (rangeBlock) this.harvestInputs(rangeBlock, section2);

        container.appendChild(section2);

        const section3 = document.createElement('div');
        this.createSectionHeader(section3, 'Other Templates');

        const templates = [
            { id: 'instruct_presets', txt: 'Instruct Templates' },
            { id: 'context_presets', txt: 'Context Templates' },
            { id: 'sysprompt_select', txt: 'System Prompts' },
            { id: 'reasoning_select', txt: 'Reasoning Templates' },
        ];

        templates.forEach(tpl => {
            const el = /** @type {HTMLSelectElement | null} */ (document.getElementById(tpl.id));
            if (el) {
                const b = document.createElement('button');
                b.className = 'a11y-btn';
                b.innerText = 'Manage ' + tpl.txt;
                b.onclick = () => {
                    container.innerHTML = '';
                    this.createSectionHeader(container, tpl.txt);

                    const sel = document.createElement('select');
                    sel.className = 'a11y-select';
                    Array.from(el.options).forEach(o => sel.add(new Option(o.text, o.value, false, o.selected)));
                    sel.onchange = (e) => {
                        const target = /** @type {HTMLSelectElement} */ (e.target);
                        // @ts-ignore
                        if (window.$) window.$(el).val(target.value).trigger('change');
                        this.announce('Template updated');
                    };
                    container.appendChild(sel);

                    const parent = el.parentElement;
                    if (parent) {
                        const btnContainer = document.createElement('div');
                        btnContainer.className = 'a11y-grid';
                        parent.querySelectorAll('.menu_button').forEach(origBtn => {
                            const htmlOrigBtn = /** @type {HTMLElement} */ (origBtn);
                            const title = htmlOrigBtn.getAttribute('title') || 'Action';
                            if (htmlOrigBtn.style.display !== 'none') {
                                const ab = document.createElement('button');
                                ab.className = 'a11y-btn';
                                ab.innerText = title;
                                ab.onclick = () => {
                                    // @ts-ignore
                                    if (window.$) window.$(htmlOrigBtn).trigger('click'); else htmlOrigBtn.click();
                                };
                                btnContainer.appendChild(ab);
                            }
                        });
                        container.appendChild(btnContainer);
                    }
                    this.addBackButton(container, 'PRESET');
                };
                section3.appendChild(b);
            }
        });
        container.appendChild(section3);
        this.addBackButton(container, 'MENU');
    },

    /**
     * @param {HTMLElement} sourceContainer
     * @param {HTMLElement} targetContainer
     */
    harvestInputs(sourceContainer, targetContainer) {
        /** @type {NodeListOf<AnyInput>} */
        const inputs = sourceContainer.querySelectorAll('input, select, textarea');
        const processedRadios = new Set();

        inputs.forEach(el => {
            if (!this.isElementVisibleInOriginal(el, sourceContainer)) return;
            // @ts-ignore
            if (el.type === 'hidden' || el.type === 'file' || el.classList.contains('displayNone')) return;
            // @ts-ignore
            if (el.type === 'range') return;

            // @ts-ignore
            if (el.type === 'radio') {
                const radio = /** @type {HTMLInputElement} */ (el);
                if (processedRadios.has(radio.name)) return;
                processedRadios.add(radio.name);
                const radios = Array.from(sourceContainer.querySelectorAll(`input[type="radio"][name="${radio.name}"]`));
                this.createA11yRadioGroup(targetContainer, /** @type {HTMLInputElement[]} */(radios));
                return;
            }
            this.createA11yControl(targetContainer, el);
        });
    },

    /** @param {HTMLElement} container */
    renderCharList(container) {
        const importBtn = document.createElement('button');
        importBtn.className = 'a11y-btn';
        importBtn.innerText = 'Import New Character Card';
        importBtn.onclick = () => this.triggerUpload('CHARACTER');
        container.appendChild(importBtn);

        const search = document.createElement('input');
        search.className = 'a11y-input';
        search.placeholder = 'Filter characters by name...';
        search.setAttribute('aria-label', 'Search characters');
        container.appendChild(search);

        const charContainer = document.createElement('div');
        container.appendChild(charContainer);

        const drawChars = (filter = '') => {
            charContainer.innerHTML = '';
            const chars = Array.from(document.querySelectorAll('#rm_print_characters_block .character_select, .entity_block'));
            chars.forEach((el) => {
                const htmlEl = /** @type {HTMLElement} */ (el);
                const name = htmlEl.querySelector('.ch_name')?.textContent || 'Unnamed';
                if (filter && !name.toLowerCase().includes(filter.toLowerCase())) return;
                const b = document.createElement('button');
                b.className = 'a11y-btn';
                b.innerText = name;
                b.onclick = () => {
                    // @ts-ignore
                    if (window.$) window.$(htmlEl).trigger('click'); else htmlEl.click();
                    this.announce('Loading chat with ' + name);
                    setTimeout(() => this.navigateTo('CHAT', name), 800);
                };
                charContainer.appendChild(b);
            });
            if (charContainer.children.length === 0) {
                charContainer.innerText = 'No characters found.';
            }
        };
        search.oninput = (e) => {
            const target = /** @type {HTMLInputElement} */ (e.target);
            drawChars(target.value);
        };
        drawChars();
        this.addBackButton(container, 'MENU');
    },

    /** @param {HTMLElement} container */
    renderChatInterface(container) {
        const liveRegion = document.createElement('div');
        liveRegion.setAttribute('aria-live', 'polite');
        liveRegion.setAttribute('aria-atomic', 'true');
        liveRegion.className = 'sr-only';
        container.appendChild(liveRegion);

        const history = document.createElement('ol');
        history.id = 'a11y-chat-log';
        history.setAttribute('role', 'list');
        history.setAttribute('aria-label', 'Chat Messages');
        // @ts-ignore
        history.style.flex = '1';
        history.style.overflowY = 'auto';
        history.style.border = '1px solid #333';
        history.style.padding = '10px';
        history.style.listStyle = 'none';
        history.style.margin = '0';
        history.tabIndex = 0;
        container.appendChild(history);

        const updateChat = () => {
            const msgs = Array.from(document.querySelectorAll('#chat .mes[mesid]:not(.displayNone)'))
                .filter(m => !m.closest('.welcomePanel'));

            history.innerHTML = '';

            const isTyping = document.querySelector('.typing_indicator') || document.querySelector('#chat .fa-spinner');
            liveRegion.innerText = isTyping ? 'AI is typing...' : '';

            const total = msgs.length;
            msgs.forEach((m, index) => {
                const mesId = m.getAttribute('mesid');
                const nameEl = m.querySelector('.name_text');
                const name = nameEl ? nameEl.textContent : 'System';
                const isUser = m.getAttribute('is_user') === 'true';
                const textEl = m.querySelector('.mes_text');
                const reasoningEl = m.querySelector('.mes_reasoning');
                const reasoning = reasoningEl ? reasoningEl.textContent : '';

                let timeText = '';
                const timestampAttr = m.getAttribute('timestamp');
                if (timestampAttr) {
                    timeText = ` at ${new Date(Number(timestampAttr)).toLocaleTimeString()}`;
                } else {
                    const dateEl = m.querySelector('.mes_date');
                    if (dateEl) timeText = ` at ${dateEl.textContent}`;
                }

                const li = document.createElement('li');
                li.className = 'a11y-msg-container';
                li.setAttribute('role', 'listitem');
                li.tabIndex = -1;

                const labelId = `msg-label-${mesId}`;
                li.setAttribute('aria-labelledby', labelId);

                const h = document.createElement('h3');
                h.id = labelId;
                h.className = 'sr-only';
                h.innerText = `Message ${index + 1} of ${total}. ${isUser ? 'You' : name} said${timeText}:`;
                li.appendChild(h);

                const nameDisplay = document.createElement('span');
                nameDisplay.className = 'a11y-msg-name';
                nameDisplay.setAttribute('aria-hidden', 'true');
                nameDisplay.innerText = name || 'Unknown';
                li.appendChild(nameDisplay);

                if (reasoning && reasoning.trim()) {
                    const details = document.createElement('details');
                    details.innerHTML = `<summary>View Thought Process</summary><div class="a11y-msg-reasoning">${reasoning}</div>`;
                    li.appendChild(details);
                }

                const body = document.createElement('div');
                body.className = 'a11y-msg-text';
                if (textEl) {
                    const clone = /** @type {HTMLElement} */ (textEl.cloneNode(true));
                    clone.querySelectorAll('button, .qr--list, .mes_buttons, i').forEach(ui => ui.remove());
                    body.innerText = clone.innerText.trim();
                }
                li.appendChild(body);

                const swipeLeft = /** @type {HTMLElement | null} */ (m.querySelector('.swipe_left'));
                const swipeRight = /** @type {HTMLElement | null} */ (m.querySelector('.swipe_right'));

                if ((swipeLeft && window.getComputedStyle(swipeLeft).display !== 'none') ||
                    (swipeRight && window.getComputedStyle(swipeRight).display !== 'none')) {

                    const nav = document.createElement('nav');
                    nav.className = 'a11y-msg-nav';
                    const counter = m.querySelector('.swipes-counter')?.textContent || 'Swipes';
                    nav.innerHTML = `<span>${counter}</span>`;

                    const bL = document.createElement('button');
                    bL.className = 'a11y-btn a11y-btn-sm';
                    bL.innerText = 'Previous Branch';
                    bL.onclick = () => {
                        // @ts-ignore
                        if (window.$) window.$(swipeLeft).trigger('click'); else swipeLeft.click();
                    };

                    const bR = document.createElement('button');
                    bR.className = 'a11y-btn a11y-btn-sm';
                    bR.innerText = 'Next Branch';
                    bR.onclick = () => {
                        // @ts-ignore
                        if (window.$) window.$(swipeRight).trigger('click'); else swipeRight.click();
                    };

                    nav.appendChild(bL);
                    nav.appendChild(bR);
                    li.appendChild(nav);
                }

                history.appendChild(li);
            });

            history.scrollTop = history.scrollHeight;
        };

        const realChat = document.getElementById('chat');
        if (realChat) {
            this.chatObserver = new MutationObserver(updateChat);
            this.chatObserver.observe(realChat, { childList: true, subtree: true, attributes: true, attributeFilter: ['mesid', 'class'] });
        }
        updateChat();

        const inp = document.createElement('textarea');
        inp.className = 'a11y-input';
        inp.placeholder = 'Type message and press Enter to send...';
        inp.setAttribute('aria-label', 'Message input');

        inp.onkeydown = async (e) => {
            if (e.key === 'Enter' && !e.shiftKey) {
                e.preventDefault();
                const target = /** @type {HTMLTextAreaElement} */ (e.target);
                const val = target.value.trim();
                if (!val) return;

                // @ts-ignore
                const $orig = window.$ ? window.$('#send_textarea') : null;
                if ($orig && $orig.length) {
                    $orig.val(val).trigger('input').trigger('change');
                    target.value = '';
                    try {
                        if (sendTextareaMessage) {
                            await sendTextareaMessage();
                            this.announce('Message sent. Waiting for reply.');
                        } else {
                            const sendBtn = document.getElementById('send_but');
                            if (sendBtn) sendBtn.click();
                        }
                    } catch (err) {
                        this.announce('Error sending message');
                    }
                }
            }
        };
        container.appendChild(inp);
        this.addBackButton(container, 'CHARS');
    },

    /**
     * @param {HTMLElement} el
     * @param {HTMLElement} container
     */
    isElementVisibleInOriginal(el, container) {
        let p = el.parentElement;
        while (p && p !== container) {
            if (window.getComputedStyle(p).display === 'none' && !p.classList.contains('inline-drawer-content')) return false;
            if (p.dataset && p.dataset.source) {
                const srcSelect = /** @type {HTMLSelectElement | null} */ (document.getElementById('chat_completion_source'));
                const src = srcSelect ? srcSelect.value : '';
                if (src && !p.dataset.source.split(',').includes(src)) return false;
            }
            p = p.parentElement;
        }
        return window.getComputedStyle(el).display !== 'none';
    },

    /**
     * @param {HTMLElement} container
     * @param {HTMLInputElement[]} radios
     */
    createA11yRadioGroup(container, radios) {
        if (!radios.length) return;
        let title = this.getGroupHeader(radios[0]);
        if (!title) {
            const lbl = this.getLabelText(radios[0]);
            if (lbl.includes(' - ')) {
                title = lbl.split(' - ')[0];
            } else {
                title = lbl || radios[0].name;
            }
        }

        this.createA11yLabel(container, title);
        const fieldset = document.createElement('div');
        fieldset.style.border = '1px solid #444';
        fieldset.style.borderRadius = '4px';
        fieldset.style.padding = '10px';
        fieldset.style.marginBottom = '1rem';
        fieldset.setAttribute('role', 'radiogroup');
        fieldset.setAttribute('aria-label', title);

        radios.forEach(radio => {
            const wrapper = document.createElement('div');
            wrapper.style.marginBottom = '5px';

            const r = document.createElement('input');
            r.type = 'radio';
            r.name = 'a11y_' + radio.name;
            r.id = 'a11y_' + radio.id;
            r.checked = radio.checked;
            r.className = 'a11y-radio';
            r.style.marginRight = '10px';

            r.onchange = () => {
                if (r.checked) {
                    // @ts-ignore
                    if (window.$) window.$(radio).trigger('click');
                    else radio.click();
                }
            };

            const lbl = document.createElement('label');
            lbl.innerText = this.getLabelText(radio) || radio.value;
            lbl.setAttribute('for', r.id);
            lbl.style.color = '#ddd';

            wrapper.appendChild(r);
            wrapper.appendChild(lbl);
            fieldset.appendChild(wrapper);
        });
        container.appendChild(fieldset);
    },

    /**
     * @param {HTMLElement} container
     * @param {AnyInput} original
     */
    createA11yControl(container, original) {
        const labelText = this.getLabelText(original);
        let helpText = '';
        let context = original.parentElement;

        if (original.id) {
            const label = document.querySelector(`label[for="${original.id}"]`);
            if (label) context = label.parentElement;
        }
        if (!context) context = original.parentElement;

        if (context) {
            const infoIcon = context.querySelector('.fa-circle-info[title]');
            if (infoIcon) helpText = infoIcon.getAttribute('title') || '';

            if (!helpText) {
                const block = context.closest('.range-block') || context.closest('.flex-container');
                if (block) {
                    const descDiv = /** @type {HTMLElement | null} */ (block.querySelector('.toggle-description'));
                    if (descDiv) helpText = descDiv.innerText.trim();
                }
            }
        }

        const descId = helpText ? `desc_${original.id || Date.now()}` : '';

        // @ts-ignore
        if (original.type === 'checkbox') {
            const checkbox = /** @type {HTMLInputElement} */ (original);
            const wrapper = document.createElement('div');
            wrapper.style.display = 'flex';
            wrapper.style.flexDirection = 'column';
            wrapper.style.padding = '10px';
            wrapper.style.marginBottom = '1rem';
            wrapper.style.background = '#000';
            wrapper.style.border = '2px solid #444';
            wrapper.style.borderRadius = '4px';

            const innerRow = document.createElement('div');
            innerRow.style.display = 'flex';
            innerRow.style.alignItems = 'center';

            const cb = document.createElement('input');
            cb.type = 'checkbox';
            cb.checked = checkbox.checked;
            cb.id = 'a11y_' + checkbox.id;
            cb.style.width = '20px';
            cb.style.height = '20px';
            cb.style.marginRight = '10px';
            if (descId) cb.setAttribute('aria-describedby', descId);

            cb.onclick = () => {
                // @ts-ignore
                if (window.$) window.$(original).trigger('click');
                else original.click();
            };

            const updateState = () => {
                if (cb.checked !== checkbox.checked) {
                    cb.checked = checkbox.checked;
                }
            };

            original.addEventListener('change', updateState);
            original.addEventListener('input', updateState);

            const lbl = document.createElement('label');
            lbl.htmlFor = cb.id;
            lbl.innerText = labelText;
            lbl.style.color = '#fff';
            lbl.style.fontSize = '1.1rem';
            lbl.style.cursor = 'pointer';

            innerRow.appendChild(cb);
            innerRow.appendChild(lbl);
            wrapper.appendChild(innerRow);

            if (helpText) {
                const desc = document.createElement('div');
                desc.id = descId;
                desc.innerText = helpText;
                desc.style.color = '#ccc';
                desc.style.fontSize = '0.9rem';
                desc.style.marginTop = '5px';
                desc.style.paddingLeft = '30px';
                wrapper.appendChild(desc);
            }

            container.appendChild(wrapper);
        } else {
            const lbl = this.createA11yLabel(container, labelText);

            if (helpText) {
                const desc = document.createElement('div');
                desc.id = descId;
                desc.innerText = helpText;
                desc.style.color = '#ccc';
                desc.style.fontSize = '0.9rem';
                desc.style.marginBottom = '5px';
                container.appendChild(desc);
            }

            let ctrl;
            if (original.tagName === 'SELECT') {
                const select = /** @type {HTMLSelectElement} */ (original);
                ctrl = document.createElement('select');
                ctrl.className = 'a11y-select';
                ctrl.id = 'a11y_ctrl_' + (original.id || Date.now());
                if (lbl) lbl.htmlFor = ctrl.id;

                if (descId) ctrl.setAttribute('aria-describedby', descId);

                const updateOptions = () => {
                    if (!ctrl || !(ctrl instanceof HTMLSelectElement)) return;
                    ctrl.innerHTML = '';
                    Array.from(select.options).forEach(o => ctrl.add(new Option(o.text, o.value, false, o.selected)));
                };
                updateOptions();

                ctrl.onchange = (e) => {
                    const target = /** @type {HTMLSelectElement} */ (e.target);
                    // @ts-ignore
                    if (window.$) window.$(original).val(target.value).trigger('change');
                    else { original.value = target.value; original.dispatchEvent(new Event('change')); }
                    this.announce(labelText + ' updated');

                    if (['chat_completion_source', 'textgen_type'].includes(original.id)) {
                        setTimeout(() => this.navigateTo(this.currentView || 'MENU'), 300);
                    }
                };

                original.addEventListener('change', () => {
                    if (ctrl.value !== select.value) ctrl.value = select.value;
                });
                const obs = new MutationObserver(updateOptions);
                obs.observe(original, { childList: true });

            } else {
                const input = /** @type {HTMLInputElement | HTMLTextAreaElement} */ (original);
                ctrl = document.createElement(original.tagName === 'TEXTAREA' ? 'textarea' : 'input');
                ctrl.className = 'a11y-input';
                ctrl.id = 'a11y_ctrl_' + (original.id || Date.now());
                if (lbl) lbl.htmlFor = ctrl.id;

                // @ts-ignore
                ctrl.value = input.value;
                if (descId) ctrl.setAttribute('aria-describedby', descId);

                // @ts-ignore
                if (input.type === 'number') {
                    ctrl.setAttribute('type', 'number');
                    ctrl.setAttribute('role', 'spinbutton');

                    const min = input.getAttribute('min');
                    const max = input.getAttribute('max');
                    const step = input.getAttribute('step');

                    if (min) {
                        ctrl.setAttribute('min', min);
                        ctrl.setAttribute('aria-valuemin', min);
                    }
                    if (max) {
                        ctrl.setAttribute('max', max);
                        ctrl.setAttribute('aria-valuemax', max);
                    }
                    if (step) ctrl.setAttribute('step', step);

                    // @ts-ignore
                    ctrl.setAttribute('aria-valuenow', input.value);
                }

                ctrl.oninput = (e) => {
                    const target = /** @type {HTMLInputElement} */ (e.target);
                    if (original.value === target.value) return;

                    // @ts-ignore
                    if (window.$) window.$(original).val(target.value).trigger('input');
                    else { original.value = target.value; original.dispatchEvent(new Event('input')); }
                };

                ctrl.onchange = (e) => {
                    const target = /** @type {HTMLInputElement} */ (e.target);
                    // @ts-ignore
                    if (window.$) window.$(original).val(target.value).trigger('change');
                    else { original.value = target.value; original.dispatchEvent(new Event('change')); }
                };

                const syncBack = () => {
                    // @ts-ignore
                    if (document.activeElement === ctrl && Math.abs(Number(ctrl.value) - Number(input.value)) < 0.0001) return;

                    // @ts-ignore
                    if (ctrl.value !== input.value) {
                        // @ts-ignore
                        ctrl.value = input.value;
                        // @ts-ignore
                        if (input.type === 'number') ctrl.setAttribute('aria-valuenow', input.value);
                    }
                };
                original.addEventListener('input', syncBack);
                original.addEventListener('change', syncBack);
            }
            container.appendChild(ctrl);
        }
    },

    /** @param {HTMLElement} el */
    getLabelText(el) {
        // @ts-ignore
        if (ID_MAP[el.id]) return ID_MAP[el.id];

        let text = '';
        if (el.getAttribute('aria-label')) return el.getAttribute('aria-label') || '';

        let l = /** @type {HTMLElement | null} */ (document.querySelector(`label[for="${el.id}"]`));
        if (l) {
            text = l.innerText.trim().split('\n')[0];
        }

        if (!text) {
            let p = el.parentElement;
            for (let i = 0; i < 3; i++) {
                if (!p) break;

                const labelCandidate = /** @type {HTMLElement | null} */ (p.querySelector('span[data-i18n], b[data-i18n], small[data-i18n]'));
                if (labelCandidate && labelCandidate !== el && !labelCandidate.closest('.fa-circle-info')) {
                    const isWarning = labelCandidate.classList.contains('neutral_warning') || labelCandidate.closest('.neutral_warning') || labelCandidate.closest('.reverse_proxy_warning');
                    const isDesc = labelCandidate.closest('.toggle-description');

                    const candidateText = labelCandidate.innerText?.trim();
                    const isLong = candidateText && candidateText.length > 61;
                    const isHelpText = candidateText && (candidateText.includes('?') || candidateText.includes('Try adding'));

                    if (!isWarning && !isDesc && !isLong && !isHelpText) {
                        if (candidateText) {
                            text = candidateText;
                            break;
                        }
                    }
                }

                const h = /** @type {HTMLElement | null} */ (p.querySelector('h4, small, b, .range-block-title'));
                if (h && !h.closest('.toggle-description') && !h.closest('.neutral_warning')) {
                    const hText = h.innerText?.trim().split('\n')[0];
                    if (hText && hText.length > 1) {
                        text = hText;
                        break;
                    }
                }
                p = p.parentElement;
            }
        }

        const genericTerms = ['None', 'Default', 'Empty', 'Space', 'Newline', 'Double Newline'];
        const isGeneric = !text || genericTerms.includes(text) || text.length < 2;

        if (isGeneric) {
            const groupHeader = this.getGroupHeader(el);
            if (groupHeader && groupHeader !== text) {
                return text ? `${groupHeader} - ${text}` : groupHeader;
            }
        }

        // @ts-ignore
        return text || el.name || el.id || '';
    },

    /** @param {HTMLElement} el */
    getGroupHeader(el) {
        const drawerContent = el.closest('.inline-drawer-content');
        if (drawerContent) {
            const drawer = drawerContent.parentElement;
            if (drawer && drawer.classList.contains('inline-drawer')) {
                const drawerHeader = /** @type {HTMLElement | null} */ (drawer.querySelector('.inline-drawer-header b[data-i18n], .inline-drawer-header span[data-i18n]'));
                if (drawerHeader) return drawerHeader.innerText.trim();
            }
        }

        let p = el.closest('.range-block') || el.closest('.flex-container') || el.parentElement;

        for (let i = 0; i < 4; i++) {
            if (!p || p === document.body) break;

            const header = /** @type {HTMLElement | null} */ (p.querySelector('h4, .range-block-title, strong[data-i18n]'));
            if (header) {
                if (header.classList.contains('toggle-description')) {
                    p = p.parentElement;
                    continue;
                }
                const headerText = header.innerText.trim().split('\n')[0];
                if (headerText) return headerText;
            }
            p = p.parentElement;
        }
        return '';
    },

    /**
     * @param {HTMLElement} c
     * @param {string} t
     */
    createSectionHeader(c, t) {
        const h = document.createElement('h3');
        h.className = 'a11y-section-header';
        h.textContent = t;
        c.appendChild(h);
    },

    /**
     * @param {HTMLElement} c
     * @param {string} t
     */
    createA11yLabel(c, t) {
        const l = document.createElement('label');
        l.className = 'a11y-label';
        l.textContent = t;
        c.appendChild(l);
        return l;
    },

    /**
     * @param {HTMLElement} c
     * @param {string} t
     */
    addBackButton(c, t) {
        const b = document.createElement('button');
        b.className = 'a11y-btn';
        b.style.background = '#333';
        b.style.marginTop = '2rem';
        b.innerText = 'Go Back';
        b.onclick = () => this.navigateTo(t);
        c.appendChild(b);
    },
};

// Use eventSource instead of window.load for better lifecycle management
eventSource.on(event_types.APP_READY, () => {
    A11yController.init();
});