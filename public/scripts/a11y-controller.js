(function () {
    const w = /** @type {any} */ (window);
    const doc = document;

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
        'reasoning_select': 'Reasoning Formatting'
    };

    const style = doc.createElement('style');
    style.textContent = `
        .silly-a11y-trigger { position: absolute; top: -1000px; left: -1000px; padding: 10px; background: #000; color: #fff; z-index: 1000000; }
        .silly-a11y-trigger:focus { top: 0; left: 0; }
        #a11y-overlay { position: fixed; top: 0; left: 0; width: 100vw; height: 100vh; background-color: #0f0f0f; color: #e0e0e0; z-index: 999999; display: flex; flex-direction: column; font-family: system-ui, -apple-system, sans-serif; }
        #a11y-header { padding: 1rem; border-bottom: 2px solid #444; background: #000; color: #fff; font-weight: bold; flex-shrink: 0; font-size: 1.4rem; outline: none; }
        #a11y-content { flex: 1; overflow-y: auto; padding: 1rem; display: flex; flex-direction: column; gap: 1rem; }
        #a11y-footer { padding: 0.5rem; border-top: 1px solid #444; font-size: 0.9rem; background: #1a1a1a; text-align: center; color: #888; }
        .a11y-btn { display: block; width: 100%; padding: 1.2rem; margin-bottom: 0.5rem; background: #2a2a2a; color: #fff; border: 2px solid #444; border-radius: 8px; font-size: 1.1rem; text-align: left; cursor: pointer; transition: background 0.2s; }
        .a11y-btn:focus { background: #444; border-color: #fff; outline: none; box-shadow: 0 0 0 4px rgba(255, 255, 255, 0.2); }
        .a11y-btn-sm { width: auto; display: inline-block; padding: 0.5rem 1rem; font-size: 0.9rem; margin-right: 0.5rem; }
        .a11y-btn-action { border-color: #00bcff; background: #1a3a4a; }
        .a11y-btn-danger { border-color: #ff4444; background: #3a1a1a; }
        .a11y-input, .a11y-select { width: 100%; padding: 1rem; font-size: 1.2rem; margin-bottom: 1rem; background: #000; color: #fff; border: 2px solid #444; box-sizing: border-box; border-radius: 4px; }
        .a11y-input:focus, .a11y-select:focus { border-color: #fff; outline: none; }
        .a11y-label { display: block; margin-top: 1rem; margin-bottom: 0.5rem; color: #bbb; font-weight: bold; font-size: 0.9rem; text-transform: uppercase; }
        .a11y-section-header { font-size: 1.2rem; font-weight: bold; color: #fff; margin: 1.5rem 0 0.5rem 0; padding-bottom: 0.5rem; border-bottom: 1px solid #333; }
        .a11y-msg-container { margin-bottom: 1.5rem; padding: 1.2rem; border-radius: 12px; border: 1px solid #333; background: #161616; position: relative; }
        .a11y-msg-name { color: #fff; font-weight: bold; font-size: 1.1rem; display: block; margin-bottom: 8px; color: #00bcff; }
        .a11y-msg-text { line-height: 1.6; white-space: pre-wrap; font-size: 1.15rem; color: #ececec; }
        .a11y-msg-reasoning { background: #222; padding: 1rem; border-left: 4px solid #555; margin: 10px 0; font-style: italic; color: #aaa; }
        .a11y-msg-nav { margin-top: 15px; padding-top: 10px; border-top: 1px solid #333; display: flex; align-items: center; gap: 10px; }
        .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }
        .a11y-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(150px, 1fr)); gap: 10px; margin-bottom: 1rem; }
    `;
    doc.head.appendChild(style);

    const trigger = doc.createElement('button');
    trigger.className = 'silly-a11y-trigger';
    trigger.textContent = 'Press Enter to enter Accessibility Mode';
    doc.body.prepend(trigger);

    const overlay = doc.createElement('div');
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
    doc.body.appendChild(overlay);

    const A11yController = {
        trap: null,
        currentView: null,
        toastObserver: null,
        chatObserver: null,
        importContext: null,
        /** @type {Function|null} */
        originalPopupShow: null,

        init() {
            trigger.onclick = () => this.enterMode();
            if (w.focusTrap) {
                this.trap = w.focusTrap.createFocusTrap('#a11y-overlay', {
                    initialFocus: '#a11y-header',
                    fallbackFocus: '#a11y-header',
                    allowOutsideClick: false
                });
            } else {
                console.warn("focusTrap not loaded, navigation trapping disabled.");
                this.trap = { activate: () => { }, deactivate: () => { } };
            }

            doc.addEventListener('keydown', (e) => {
                if (overlay.style.display !== 'flex') return;

                if (e.key === 'Escape' && this.currentView !== 'MENU') {
                    if (this.currentView === 'CHAT') this.navigateTo('CHARS');
                    else this.navigateTo('MENU');
                }
            });

            const fileInput = doc.getElementById('a11y-file-input');
            if (fileInput) {
                fileInput.onchange = (e) => this.handleFileSelected(e);
            }

            this.initToastMonitor();
            this.interceptPopups();
        },

        interceptPopups() {
            const self = this;
            if (w.Popup) {
                this.originalPopupShow = w.Popup.show;
                w.Popup.show = async function (/** @type {any} */ title, /** @type {any} */ content, /** @type {any} */ type, /** @type {any} */ options) {
                    if (overlay.style.display === 'flex') {
                        // Pass arguments to custom handler
                        // Note: content might be a jQuery object or string
                        let textContent = content;
                        if (typeof content === 'object' && content.jquery) {
                            textContent = content.text();
                        } else if (content instanceof HTMLElement) {
                            textContent = content.textContent;
                        }
                        return await self.renderA11yConfirmation(title, textContent);
                    }
                    if (self.originalPopupShow) {
                        return self.originalPopupShow.apply(this, arguments);
                    }
                };
            }
        },

        async renderA11yConfirmation(/** @type {string} */ title, /** @type {string} */ content) {
            const contentArea = doc.getElementById('a11y-content');
            const header = doc.getElementById('a11y-header');
            if (!contentArea || !header) return;

            const previousHTML = contentArea.innerHTML;
            const previousView = this.currentView;

            this.currentView = 'CONFIRM';
            header.innerText = "Confirmation Required";
            contentArea.innerHTML = '';

            this.createA11yLabel(contentArea, typeof title === 'string' ? title : "Alert");
            const desc = doc.createElement('div');
            desc.className = 'a11y-msg-text';
            desc.innerHTML = typeof content === 'string' ? content : "Please confirm action.";
            contentArea.appendChild(desc);

            return new Promise((resolve) => {
                const btnYes = doc.createElement('button');
                btnYes.className = 'a11y-btn';
                btnYes.innerText = "Yes / OK";
                btnYes.onclick = () => {
                    this.currentView = previousView;
                    contentArea.innerHTML = previousHTML;
                    resolve(1); // Standard SillyTavern generic popup affirmation is 1
                };

                const btnNo = doc.createElement('button');
                btnNo.className = 'a11y-btn';
                btnNo.innerText = "No / Cancel";
                btnNo.onclick = () => {
                    this.currentView = previousView;
                    contentArea.innerHTML = previousHTML;
                    resolve(0); // Cancellation is 0
                };

                contentArea.appendChild(btnYes);
                contentArea.appendChild(btnNo);
                btnYes.focus();
            });
        },

        initToastMonitor() {
            const monitor = () => {
                const container = doc.getElementById('toast-container');
                if (container) {
                    this.toastObserver = new MutationObserver((mutations) => {
                        mutations.forEach(mut => {
                            if (mut.addedNodes.length) {
                                const node = mut.addedNodes[0];
                                const text = node.textContent || /** @type {HTMLElement} */(node).innerText;
                                if (text) this.announce("System Notification: " + text);
                            }
                        });
                    });
                    this.toastObserver.observe(container, { childList: true });
                }
            };
            setTimeout(monitor, 2000);
        },

        enterMode() {
            overlay.style.display = 'flex';
            this.navigateTo('MENU');
            this.trap.activate();
            this.announce("Accessibility Mode activated");
        },

        announce(/** @type {string} */ text) {
            const el = doc.getElementById('a11y-status');
            if (el) {
                el.innerText = '';
                setTimeout(() => el.innerText = text, 50);
            }
        },

        navigateTo(/** @type {string} */ view, /** @type {string|null} */ data = null) {
            this.currentView = view;
            const content = doc.getElementById('a11y-content');
            const header = doc.getElementById('a11y-header');
            if (!content || !header) return;

            content.innerHTML = '';
            content.scrollTop = 0;
            if (this.chatObserver) { this.chatObserver.disconnect(); this.chatObserver = null; }

            switch (view) {
                case 'MENU': header.innerText = "Main Menu"; this.renderMainMenu(content); break;
                case 'API': header.innerText = "API Connections"; this.renderApiMenu(content); break;
                case 'PRESET': header.innerText = "Presets and Templates"; this.renderPresetMenu(content); break;
                case 'CHARS': header.innerText = "Character Selection"; this.renderCharList(content); break;
                case 'CHAT': header.innerText = "Chat Session: " + (data || ""); this.renderChatInterface(content); break;
            }
            header.focus();
        },

        triggerUpload(/** @type {string} */ context) {
            this.importContext = context;
            const fileInput = /** @type {HTMLInputElement} */ (doc.getElementById('a11y-file-input'));
            if (!fileInput) return;

            // Determine selector based on context to trigger original UI functionality
            let targetSelector = '';
            if (context === 'CHARACTER') targetSelector = '#character_import_file';
            else if (context === 'PRESET_KOBOLD') targetSelector = '[data-preset-manager-file="kobold"]';
            else if (context === 'PRESET_NOVEL') targetSelector = '[data-preset-manager-file="novel"]';
            else if (context === 'PRESET_TEXTGEN') targetSelector = '[data-preset-manager-file="textgenerationwebui"]';
            else if (context === 'PRESET_OPENAI') targetSelector = '#openai_preset_import_file';

            if (targetSelector) {
                // If we can find the original input, click it to let ST handle logic
                const origInput = /** @type {HTMLElement} */ (doc.querySelector(targetSelector));
                if (origInput) {
                    origInput.click();
                    return;
                }
            }

            // Fallback: use our own input if specific handler logic is known and simple
            fileInput.accept = (context === 'CHARACTER') ? ".png,.json,.charx,.byaf" : ".json,.settings";
            fileInput.click();
        },

        async handleFileSelected(/** @type {Event} */ e) {
            const input = /** @type {HTMLInputElement} */ (e.target);
            const file = input.files ? input.files[0] : null;
            if (!file) return;

            this.announce("Processing file: " + file.name);
            input.value = '';
        },

        renderMainMenu(/** @type {HTMLElement} */ container) {
            const routes = [
                { t: "Character List", a: () => this.navigateTo('CHARS') },
                { t: "API Connections", a: () => this.navigateTo('API') },
                { t: "Presets", a: () => this.navigateTo('PRESET') }
            ];

            routes.forEach(i => {
                const b = doc.createElement('button');
                b.className = 'a11y-btn';
                b.innerText = i.t;
                b.onclick = i.a;
                container.appendChild(b);
            });

            const exitBtn = doc.createElement('button');
            exitBtn.className = 'a11y-btn';
            exitBtn.style.marginTop = '2rem';
            exitBtn.innerText = "Exit Accessibility Mode";
            exitBtn.tabIndex = -1;
            exitBtn.setAttribute('aria-hidden', 'true');
            exitBtn.onclick = () => {
                overlay.style.display = 'none';
                this.trap.deactivate();
            };
            container.appendChild(exitBtn);
        },

        renderApiMenu(/** @type {HTMLElement} */ container) {
            // 1. Connection Profiles Section
            const cpBlock = doc.getElementById('rm_api_block');
            if (cpBlock) {
                const cpSection = doc.createElement('div');
                this.createSectionHeader(cpSection, "Connection Profiles");
                
                // Profile Select
                const profSelect = /** @type {HTMLSelectElement} */ (doc.getElementById('connection_profiles'));
                if (profSelect) {
                    this.createA11yControl(cpSection, profSelect);
                }

                // Profile Actions
                const actionDiv = doc.createElement('div');
                actionDiv.className = 'a11y-grid';
                const actions = [
                    { id: 'create_connection_profile', label: "New Profile" },
                    { id: 'update_connection_profile', label: "Update" },
                    { id: 'edit_connection_profile', label: "Edit" },
                    { id: 'delete_connection_profile', label: "Delete", danger: true }
                ];
                actions.forEach(a => {
                    const btn = doc.getElementById(a.id);
                    if (btn && w.getComputedStyle(btn).display !== 'none') {
                        const b = doc.createElement('button');
                        b.className = `a11y-btn ${a.danger ? 'a11y-btn-danger' : ''}`;
                        b.innerText = a.label;
                        b.onclick = () => btn.click();
                        actionDiv.appendChild(b);
                    }
                });
                cpSection.appendChild(actionDiv);
                container.appendChild(cpSection);
            }

            // 2. Main API Selection
            const mainSelect = /** @type {HTMLSelectElement} */ (doc.getElementById('main_api'));
            if (!mainSelect) return;

            const lbl = this.createA11yLabel(container, "Main API Type");
            const a11yMain = doc.createElement('select');
            a11yMain.id = 'a11y-main-api-select';
            lbl.htmlFor = a11yMain.id;
            a11yMain.className = 'a11y-select';
            Array.from(mainSelect.options).forEach(o => a11yMain.add(new Option(o.text, o.value, false, o.selected)));
            a11yMain.onchange = (e) => {
                const target = /** @type {HTMLSelectElement} */ (e.target);
                if (w.$) w.$(mainSelect).val(target.value).trigger('change');
                else { mainSelect.value = target.value; mainSelect.dispatchEvent(new Event('change')); }
                
                // Re-render settings after slight delay to allow ST to update DOM
                setTimeout(() => this.renderApiSettings(settingsContainer), 100);
            };
            container.appendChild(a11yMain);

            // 3. API Settings Container
            const settingsContainer = doc.createElement('div');
            container.appendChild(settingsContainer);
            this.renderApiSettings(settingsContainer);

            // 4. Global Settings (Auto-connect, etc.)
            const globalSection = doc.createElement('div');
            globalSection.className = 'a11y-section';
            this.createSectionHeader(globalSection, "Global API Settings");
            
            const autoConnect = /** @type {HTMLInputElement} */ (doc.getElementById('auto-connect-checkbox'));
            if (autoConnect) {
                this.createA11yControl(globalSection, autoConnect);
            }
            container.appendChild(globalSection);

            this.addBackButton(container, 'MENU');
        },

        renderApiSettings(/** @type {HTMLElement} */ container) {
            container.innerHTML = ''; // Clear previous settings
            const mainSelect = /** @type {HTMLSelectElement} */ (doc.getElementById('main_api'));
            if (!mainSelect) return;

            const apiMap = { 'kobold': 'kobold_api', 'koboldhorde': 'kobold_horde', 'novel': 'novel_api', 'textgenerationwebui': 'textgenerationwebui_api', 'openai': 'openai_api' };
            const targetId = apiMap[mainSelect.value];
            const targetContainer = doc.getElementById(targetId);

            if (targetContainer) {
                this.createA11yLabel(container, "API Parameters");
                
                // We need to re-harvest inputs every time because inner sections (like custom endpoint block) show/hide
                this.harvestInputs(targetContainer, container);

                // Add Actions (Connect, etc.)
                const actionDiv = doc.createElement('div');
                actionDiv.className = 'a11y-grid';
                
                targetContainer.querySelectorAll('.api_button, #test_api_button, .openrouter_authorize, #horde_api_key_button').forEach(btn => {
                    const htmlBtn = /** @type {HTMLElement} */ (btn);
                    
                    // Force visibility check: sometimes ST hides buttons using opacity or other means
                    const style = w.getComputedStyle(htmlBtn);
                    if (style.display === 'none' || style.visibility === 'hidden' || style.opacity === '0') return;

                    const text = htmlBtn.innerText.trim() || htmlBtn.getAttribute('title') || "Action";
                    const b = doc.createElement('button');
                    b.className = 'a11y-btn a11y-btn-action';
                    b.innerText = text;
                    b.title = htmlBtn.getAttribute('title') || '';
                    b.onclick = () => { if (w.$) w.$(htmlBtn).trigger('click'); else htmlBtn.click(); };
                    actionDiv.appendChild(b);
                });
                container.appendChild(actionDiv);

                // SPECIAL HANDLING: DYNAMIC RE-RENDER LISTENERS
                // If this API has a "Source" selector (like Chat Completion Source), listens to it
                // We find the 'driver' select elements
                const drivers = targetContainer.querySelectorAll('select#chat_completion_source, select#textgen_type');
                drivers.forEach(d => {
                    // Check if we already attached a listener? Hard to track. 
                    // Instead, we attach a one-time listener that re-renders this entire block.
                    // Actually, since `harvestInputs` creates NEW a11y controls, we need to find the CORRESPONDING a11y control 
                    // and attach the 'renderSettings' trigger to IT, not the original (which is hidden).
                    
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

        renderPresetMenu(/** @type {HTMLElement} */ container) {
            const apiSelect = /** @type {HTMLSelectElement} */ (doc.getElementById('main_api'));
            const api = apiSelect ? apiSelect.value : 'kobold';

            // Map API to specific preset container IDs
            let presetContainerId = 'kobold_api-presets';
            let selectId = 'settings_preset';

            if (api === 'novel') { presetContainerId = 'novel_api-presets'; selectId = 'settings_preset_novel'; }
            if (api === 'textgenerationwebui') { presetContainerId = 'textgenerationwebui_api-presets'; selectId = 'settings_preset_textgenerationwebui'; }
            if (api === 'openai') { presetContainerId = 'openai_api-presets'; selectId = 'settings_preset_openai'; }

            const selectEl = /** @type {HTMLSelectElement} */ (doc.getElementById(selectId));

            // 1. Preset Selection Section
            const section1 = doc.createElement('div');
            this.createSectionHeader(section1, `Generation Presets (${api})`);

            if (selectEl) {
                const lbl = this.createA11yLabel(section1, "Active Preset");
                const a11ySelect = doc.createElement('select');
                a11ySelect.id = `a11y-preset-select-${api}`;
                lbl.htmlFor = a11ySelect.id;
                a11ySelect.className = 'a11y-select';
                // Refresh options from DOM
                Array.from(selectEl.options).forEach(o => a11ySelect.add(new Option(o.text, o.value, false, o.selected)));
                a11ySelect.onchange = (e) => {
                    const target = /** @type {HTMLSelectElement} */ (e.target);
                    if (w.$) w.$(selectEl).val(target.value).trigger('change');
                    else { selectEl.value = target.value; selectEl.dispatchEvent(new Event('change')); }
                    this.announce("Preset changed to " + target.options[target.selectedIndex].text);
                };
                section1.appendChild(a11ySelect);

                // Action Buttons for Presets
                const btnGrid = doc.createElement('div');
                btnGrid.className = 'a11y-grid';

                const actions = [
                    { sel: `[data-preset-manager-new="${api === 'koboldhorde' ? 'kobold' : api}"]`, txt: "Save As New", fallbackId: `new_${api === 'openai' ? 'oai' : api}_preset` },
                    { sel: `[data-preset-manager-update="${api === 'koboldhorde' ? 'kobold' : api}"]`, txt: "Update Current", fallbackId: `update_${api === 'openai' ? 'oai' : api}_preset` },
                    { sel: `[data-preset-manager-rename="${api === 'koboldhorde' ? 'kobold' : api}"]`, txt: "Rename", fallbackId: null },
                    { sel: `[data-preset-manager-delete="${api === 'koboldhorde' ? 'kobold' : api}"]`, txt: "Delete", fallbackId: `delete_${api === 'openai' ? 'oai' : api}_preset` },
                    { sel: `[data-preset-manager-import="${api === 'koboldhorde' ? 'kobold' : api}"]`, txt: "Import Preset", fallbackId: `import_${api === 'openai' ? 'oai' : api}_preset` },
                    { sel: `[data-preset-manager-export="${api === 'koboldhorde' ? 'kobold' : api}"]`, txt: "Export Preset", fallbackId: `export_${api === 'openai' ? 'oai' : api}_preset` }
                ];

                actions.forEach(act => {
                    // Try to find button by attribute, then ID
                    let btn = /** @type {HTMLElement} */ (doc.querySelector(act.sel));
                    if (!btn && act.fallbackId) btn = /** @type {HTMLElement} */ (doc.getElementById(act.fallbackId));

                    if (btn) {
                        const b = doc.createElement('button');
                        b.className = 'a11y-btn';
                        if (act.txt === 'Delete') b.classList.add('a11y-btn-danger');
                        b.innerText = act.txt;
                        b.onclick = () => { if (w.$) w.$(btn).trigger('click'); else btn.click(); };
                        btnGrid.appendChild(b);
                    }
                });
                section1.appendChild(btnGrid);
            }
            container.appendChild(section1);

            // 2. Parameters Section (Sliders, etc.)
            const section2 = doc.createElement('div');
            this.createSectionHeader(section2, "Generation Parameters");

            // Common settings block (Context, Response Length)
            const commonBlock = doc.getElementById('common-gen-settings-block');
            if (commonBlock) {
                this.harvestInputs(commonBlock, section2);
            }

            // API Specific Range Block (Temp, Top P, etc.)
            let rangeBlockId = 'novel_api-settings'; 
            if (api === 'openai') {
                rangeBlockId = 'openai_settings';
            } else if (api === 'textgenerationwebui') {
                rangeBlockId = 'textgenerationwebui_api-settings';
            } else if (api === 'kobold' || api === 'koboldhorde') {
                rangeBlockId = 'kobold_api-settings';
            }

            const rangeBlock = doc.getElementById(rangeBlockId);
            if (rangeBlock) {
                this.harvestInputs(rangeBlock, section2);
            }

            container.appendChild(section2);

            // 3. Navigation to other templates
            const section3 = doc.createElement('div');
            this.createSectionHeader(section3, "Other Templates");

            const templates = [
                { id: 'instruct_presets', txt: "Instruct Templates" },
                { id: 'context_presets', txt: "Context Templates" },
                { id: 'sysprompt_select', txt: "System Prompts" },
                { id: 'reasoning_select', txt: "Reasoning Templates" }
            ];

            templates.forEach(tpl => {
                const el = /** @type {HTMLSelectElement} */ (doc.getElementById(tpl.id));
                if (el) {
                    const b = doc.createElement('button');
                    b.className = 'a11y-btn';
                    b.innerText = "Manage " + tpl.txt;
                    b.onclick = () => {
                        // Build a mini-menu for this template
                        container.innerHTML = '';
                        this.createSectionHeader(container, tpl.txt);

                        const sel = doc.createElement('select');
                        sel.className = 'a11y-select';
                        Array.from(el.options).forEach(o => sel.add(new Option(o.text, o.value, false, o.selected)));
                        sel.onchange = (e) => {
                            const target = /** @type {HTMLSelectElement} */ (e.target);
                            if (w.$) w.$(el).val(target.value).trigger('change');
                            this.announce("Template updated");
                        };
                        container.appendChild(sel);

                        // Add actions if found (buttons near the select)
                        const parent = el.parentElement; // container
                        if (parent) {
                            const btnContainer = doc.createElement('div');
                            btnContainer.className = 'a11y-grid';
                            parent.querySelectorAll('.menu_button').forEach(origBtn => {
                                const htmlOrigBtn = /** @type {HTMLElement} */ (origBtn);
                                const title = htmlOrigBtn.getAttribute('title') || "Action";
                                if (htmlOrigBtn.style.display !== 'none') {
                                    const ab = doc.createElement('button');
                                    ab.className = 'a11y-btn';
                                    ab.innerText = title;
                                    ab.onclick = () => { if (w.$) w.$(htmlOrigBtn).trigger('click'); else htmlOrigBtn.click(); };
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

        // Helper to grab inputs from a container and render accessible controls
        harvestInputs(/** @type {HTMLElement} */ sourceContainer, /** @type {HTMLElement} */ targetContainer) {
            const inputs = /** @type {NodeListOf<HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement>} */ (sourceContainer.querySelectorAll('input, select, textarea'));
            const processedRadios = new Set();
            
            inputs.forEach(el => {
                if (!this.isElementVisibleInOriginal(el, sourceContainer)) return;
                // Skip hidden inputs or specific utility inputs
                if (el.type === 'hidden' || el.type === 'file' || el.classList.contains('displayNone')) return;
                
                // Skip neo-range-input as we use the range slider to generate our control (or vice versa, but we need only one)
                // Actually, the plan is to use the number input if available, or transform the range.
                // But usually they come in pairs.
                // Strategy: If we encounter a range input, we handle it. If we encounter a number input that has a data-for attribute pointing to a range, we skip it (because we handle it via the range or handle the range via it).
                // WAIT, better strategy per plan: "Hide sliders (type=range) but keep number inputs."
                // So if it's a range, we SKIP it. If it's a number input, we render it.
                if (el.type === 'range') return;

                // Also skip inputs that are just counters for ranges if they don't have the class but act like it (check logic below)
                
                if (el.type === 'radio') {
                    if (processedRadios.has(el.name)) return;
                    processedRadios.add(el.name);
                    // Find all radios with this name in the container
                    const radios = Array.from(sourceContainer.querySelectorAll(`input[type="radio"][name="${el.name}"]`));
                    this.createA11yRadioGroup(targetContainer, /** @type {HTMLInputElement[]} */(radios));
                    return;
                }

                this.createA11yControl(targetContainer, el);
            });
        },

        renderCharList(/** @type {HTMLElement} */ container) {
            const importBtn = doc.createElement('button');
            importBtn.className = 'a11y-btn';
            importBtn.innerText = "Import New Character Card";
            importBtn.onclick = () => this.triggerUpload('CHARACTER');
            container.appendChild(importBtn);

            const search = doc.createElement('input');
            search.className = 'a11y-input';
            search.placeholder = "Filter characters by name...";
            search.setAttribute('aria-label', 'Search characters');
            container.appendChild(search);

            const charContainer = doc.createElement('div');
            container.appendChild(charContainer);

            const drawChars = (filter = "") => {
                charContainer.innerHTML = '';
                const chars = Array.from(doc.querySelectorAll('#rm_print_characters_block .character_select, .entity_block'));
                chars.forEach((el) => {
                    const htmlEl = /** @type {HTMLElement} */ (el);
                    const name = htmlEl.querySelector('.ch_name')?.textContent || "Unnamed";
                    if (filter && !name.toLowerCase().includes(filter.toLowerCase())) return;
                    const b = doc.createElement('button');
                    b.className = 'a11y-btn';
                    b.innerText = name;
                    b.onclick = () => {
                        if (w.$) w.$(htmlEl).trigger('click'); else htmlEl.click();
                        this.announce("Loading chat with " + name);
                        setTimeout(() => this.navigateTo('CHAT', name), 800);
                    };
                    charContainer.appendChild(b);
                });
                if (charContainer.children.length === 0) {
                    charContainer.innerText = "No characters found.";
                }
            };
            search.oninput = (e) => drawChars(/** @type {HTMLInputElement} */(e.target).value);
            drawChars();
            this.addBackButton(container, 'MENU');
        },

        renderChatInterface(/** @type {HTMLElement} */ container) {
            // Live Region for Typing
            const liveRegion = doc.createElement('div');
            liveRegion.setAttribute('aria-live', 'polite');
            liveRegion.setAttribute('aria-atomic', 'true');
            liveRegion.className = 'sr-only';
            container.appendChild(liveRegion);

            // Chat List Container (Semantic List)
            const history = doc.createElement('ol');
            history.id = 'a11y-chat-log';
            history.setAttribute('role', 'list'); // Explicit semantics
            history.setAttribute('aria-label', 'Chat Messages');
            history.style.flex = '1';
            history.style.overflowY = 'auto';
            history.style.border = '1px solid #333';
            history.style.padding = '10px';
            history.style.listStyle = 'none'; // Visual cleanup
            history.style.margin = '0';
            history.tabIndex = 0; // The container is focusable initially
            container.appendChild(history);

            // Roving Tabindex Logic
            let focusedIndex = -1;
            
            history.addEventListener('keydown', (e) => {
                const items = history.querySelectorAll('li[role="listitem"]');
                if (!items.length) return;

                if (e.key === 'ArrowDown') {
                    e.preventDefault();
                    focusedIndex = Math.min(focusedIndex + 1, items.length - 1);
                    /** @type {HTMLElement} */(items[focusedIndex]).focus();
                } else if (e.key === 'ArrowUp') {
                    e.preventDefault();
                    focusedIndex = Math.max(focusedIndex - 1, 0);
                    /** @type {HTMLElement} */(items[focusedIndex]).focus();
                }
            });

            const updateChat = () => {
                const msgs = Array.from(doc.querySelectorAll('#chat .mes[mesid]:not(.displayNone)'))
                    .filter(m => !m.closest('.welcomePanel'));
                
                history.innerHTML = ''; // Clear for full re-render (simplest approach for sync)
                
                // Typing Indicator Check
                const isTyping = doc.querySelector('.typing_indicator') || doc.querySelector('#chat .fa-spinner');
                if (isTyping) {
                    liveRegion.innerText = "AI is typing...";
                } else {
                    liveRegion.innerText = "";
                }

                const total = msgs.length;
                msgs.forEach((m, index) => {
                    const mesId = m.getAttribute('mesid');
                    const nameEl = m.querySelector('.name_text');
                    const name = nameEl ? nameEl.textContent : "System";
                    const isUser = m.getAttribute('is_user') === 'true';
                    const textEl = /** @type {HTMLElement} */ (m.querySelector('.mes_text'));
                    const reasoningEl = m.querySelector('.mes_reasoning');
                    const reasoning = reasoningEl ? reasoningEl.textContent : "";
                    
                    // Timestamp Logic
                    let timeText = "";
                    const timestampAttr = m.getAttribute('timestamp');
                    if (timestampAttr) {
                        timeText = ` at ${new Date(Number(timestampAttr)).toLocaleTimeString()}`;
                    } else {
                        // Fallback: try to find date in DOM if rendered
                        const dateEl = m.querySelector('.mes_date');
                        if (dateEl) timeText = ` at ${dateEl.textContent}`;
                    }

                    // Semantic List Item
                    const li = doc.createElement('li');
                    li.className = 'a11y-msg-container';
                    li.setAttribute('role', 'listitem');
                    li.tabIndex = -1; // Not focusable by tab, only programmatic
                    
                    // Accessible Labeling
                    const labelId = `msg-label-${mesId}`;
                    li.setAttribute('aria-labelledby', labelId);

                    // Hidden Label for Screen Readers (Floor, Sender, Time)
                    const h = doc.createElement('h3');
                    h.id = labelId;
                    h.className = 'sr-only';
                    // Format: "Message 5 of 20. You said at 10:30 PM:"
                    h.innerText = `Message ${index + 1} of ${total}. ${isUser ? 'You' : name} said${timeText}:`;
                    li.appendChild(h);

                    // Visual Name (Hidden from SR as it is in the Label)
                    const nameDisplay = doc.createElement('span');
                    nameDisplay.className = 'a11y-msg-name';
                    nameDisplay.setAttribute('aria-hidden', 'true'); 
                    nameDisplay.innerText = name || "Unknown";
                    li.appendChild(nameDisplay);

                    if (reasoning && reasoning.trim()) {
                        const details = doc.createElement('details');
                        details.innerHTML = `<summary>View Thought Process</summary><div class="a11y-msg-reasoning">${reasoning}</div>`;
                        li.appendChild(details);
                    }

                    const body = doc.createElement('div');
                    body.className = 'a11y-msg-text';
                    if (textEl) {
                        const clone = /** @type {HTMLElement} */ (textEl.cloneNode(true));
                        clone.querySelectorAll('button, .qr--list, .mes_buttons, i').forEach(ui => ui.remove());
                        body.innerText = clone.innerText.trim();
                    }
                    li.appendChild(body);

                    // Swipes
                    const swipeLeft = /** @type {HTMLElement} */ (m.querySelector('.swipe_left'));
                    const swipeRight = /** @type {HTMLElement} */ (m.querySelector('.swipe_right'));

                    if ((swipeLeft && w.getComputedStyle(swipeLeft).display !== 'none') ||
                        (swipeRight && w.getComputedStyle(swipeRight).display !== 'none')) {

                        const nav = doc.createElement('nav');
                        nav.className = 'a11y-msg-nav';
                        const counter = m.querySelector('.swipes-counter')?.textContent || "Swipes";
                        nav.innerHTML = `<span>${counter}</span>`;

                        const bL = doc.createElement('button');
                        bL.className = 'a11y-btn a11y-btn-sm';
                        bL.innerText = "Previous Branch";
                        bL.onclick = () => { if (w.$) w.$(swipeLeft).trigger('click'); else swipeLeft.click(); };

                        const bR = doc.createElement('button');
                        bR.className = 'a11y-btn a11y-btn-sm';
                        bR.innerText = "Next Branch";
                        bR.onclick = () => { if (w.$) w.$(swipeRight).trigger('click'); else swipeRight.click(); };

                        nav.appendChild(bL);
                        nav.appendChild(bR);
                        li.appendChild(nav);
                    }

                    history.appendChild(li);
                });

                // Auto-scroll or maintain focus position
                history.scrollTop = history.scrollHeight;
                
                // Update focusable items list
                focusedIndex = msgs.length - 1; // Default to last item
            };

            const realChat = doc.getElementById('chat');
            if (realChat) {
                this.chatObserver = new MutationObserver(updateChat);
                this.chatObserver.observe(realChat, { childList: true, subtree: true, attributes: true, attributeFilter: ['mesid', 'class'] });
            }
            updateChat();

            const inp = doc.createElement('textarea');
            inp.className = 'a11y-input';
            inp.placeholder = "Type message and press Enter to send...";
            inp.setAttribute('aria-label', 'Message input');

            inp.onkeydown = async (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const target = /** @type {HTMLTextAreaElement} */ (e.target);
                    const val = target.value.trim();
                    if (!val) return;

                    const $orig = w.$ ? w.$('#send_textarea') : null;
                    if ($orig && $orig.length) {
                        $orig.val(val).trigger('input').trigger('change');
                        target.value = '';
                        try {
                            if (w.SillyTavern && w.SillyTavern.sendTextareaMessage) {
                                await w.SillyTavern.sendTextareaMessage();
                                this.announce("Message sent. Waiting for reply.");
                            } else {
                                const sendBtn = doc.getElementById('send_but');
                                if (sendBtn) sendBtn.click();
                            }
                        } catch (err) {
                            this.announce("Error sending message");
                        }
                    }
                }
            };
            container.appendChild(inp);
            this.addBackButton(container, 'CHARS');
        },

        isElementVisibleInOriginal(/** @type {HTMLElement} */ el, /** @type {HTMLElement} */ container) {
            let p = el.parentElement;
            while (p && p !== container) {
                if (w.getComputedStyle(p).display === 'none' && !p.classList.contains('inline-drawer-content')) return false;
                if (p.dataset && p.dataset.source) {
                    // Check if current source matches
                    const srcSelect = /** @type {HTMLSelectElement} */ (doc.getElementById('chat_completion_source'));
                    const src = srcSelect ? srcSelect.value : '';
                    if (src && !p.dataset.source.split(',').includes(src)) return false;
                }
                p = p.parentElement;
            }
            return w.getComputedStyle(el).display !== 'none';
        },

        createA11yRadioGroup(/** @type {HTMLElement} */ container, /** @type {HTMLInputElement[]} */ radios) {
            if (!radios.length) return;
            // Use getGroupHeader checks for the Section Title.
            // If that fails, fallback to standard label text (which might be "None" -> "Section - None" now, but simpler is better)
            let title = this.getGroupHeader(radios[0]);
            if (!title) {
                // Fallback: try to get a comprehensive label
                 const lbl = this.getLabelText(radios[0]);
                 // If the label is "Section - None", extract "Section"
                 if (lbl.includes(' - ')) {
                     title = lbl.split(' - ')[0];
                 } else {
                     title = lbl || radios[0].name;
                 }
            }
            
            this.createA11yLabel(container, title);
            const fieldset = doc.createElement('div');
            fieldset.style.border = '1px solid #444';
            fieldset.style.borderRadius = '4px';
            fieldset.style.padding = '10px';
            fieldset.style.marginBottom = '1rem';
            fieldset.setAttribute('role', 'radiogroup');
            fieldset.setAttribute('aria-label', title);

            radios.forEach(radio => {
                const wrapper = doc.createElement('div');
                wrapper.style.marginBottom = '5px';
                
                const r = doc.createElement('input');
                r.type = 'radio';
                r.name = "a11y_" + radio.name; // scoped name
                r.id = "a11y_" + radio.id;
                r.checked = radio.checked;
                r.className = 'a11y-radio';
                r.style.marginRight = '10px';
                
                // Sync
                r.onchange = () => {
                   if (r.checked) {
                        if (w.$) w.$(radio).trigger('click');
                        else radio.click();
                   }
                };

                const lbl = doc.createElement('label');
                lbl.innerText = this.getLabelText(radio) || radio.value;
                lbl.setAttribute('for', r.id);
                lbl.style.color = '#ddd';

                wrapper.appendChild(r);
                wrapper.appendChild(lbl);
                fieldset.appendChild(wrapper);
            });
            container.appendChild(fieldset);
        },

        createA11yControl(/** @type {HTMLElement} */ container, /** @type {HTMLInputElement|HTMLSelectElement|HTMLTextAreaElement} */ original) {
            const labelText = this.getLabelText(original);
            
            // Extract Help Text
            let helpText = '';
            let context = original.parentElement;
            
            // Try to find the associated label to look for siblings (like info icons)
            if (original.id) {
                const label = document.querySelector(`label[for="${original.id}"]`);
                if (label) context = label.parentElement;
            }
            if (!context) context = original.parentElement;

            // 1. Look for fa-circle-info with title
            if (context) {
                const infoIcon = context.querySelector('.fa-circle-info[title]');
                if (infoIcon) helpText = infoIcon.getAttribute('title');
                
                // 2. Look for toggle-description (often in parent block)
                if (!helpText) {
                    const block = context.closest('.range-block') || context.closest('.flex-container');
                    if (block) {
                        const descDiv = block.querySelector('.toggle-description');
                        if (descDiv) helpText = /** @type {HTMLElement} */(descDiv).innerText.trim();
                    }
                }
            }

            const descId = helpText ? `desc_${original.id || Date.now()}` : '';

            // Special handling for sliders (range inputs) - SKIP them as per new plan, we rely on the number input counterpart.
            // But if it's a lonely slider without a number input? 
            // The harvestInputs skips 'range', so we shouldn't see them here unless called directly.
            
            if (original.type === 'checkbox') {
                const checkbox = /** @type {HTMLInputElement} */ (original);
                const wrapper = doc.createElement('div');
                wrapper.style.display = 'flex';
                wrapper.style.flexDirection = 'column';
                wrapper.style.padding = '10px';
                wrapper.style.marginBottom = '1rem';
                wrapper.style.background = '#000';
                wrapper.style.border = '2px solid #444';
                wrapper.style.borderRadius = '4px';

                const innerRow = doc.createElement('div');
                innerRow.style.display = 'flex';
                innerRow.style.alignItems = 'center';

                const cb = doc.createElement('input');
                cb.type = 'checkbox';
                cb.checked = checkbox.checked;
                cb.id = 'a11y_' + checkbox.id;
                cb.style.width = '20px';
                cb.style.height = '20px';
                cb.style.marginRight = '10px';
                if (descId) cb.setAttribute('aria-describedby', descId);
                
                // One-way: A11y -> Original
                cb.onclick = (e) => {
                    // Use click() to simulate genuine user interaction which most scripts listen for
                    if (w.$) w.$(original).trigger('click');
                    else original.click();
                };

                // Reverse: Original -> A11y (Sync state back if script changes it or rejects change)
                const updateState = () => {
                    if (cb.checked !== checkbox.checked) {
                        cb.checked = checkbox.checked;
                    }
                };
                
                // Observer to catch programmatic changes not firing events
                // And listen to events
                original.addEventListener('change', updateState);
                original.addEventListener('input', updateState);
                
                const lbl = doc.createElement('label');
                lbl.htmlFor = cb.id;
                lbl.innerText = labelText;
                lbl.style.color = '#fff';
                lbl.style.fontSize = '1.1rem';
                lbl.style.cursor = 'pointer';

                innerRow.appendChild(cb);
                innerRow.appendChild(lbl);
                wrapper.appendChild(innerRow);

                if (helpText) {
                    const desc = doc.createElement('div');
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
                
                // Add description if exists
                if (helpText) {
                    const desc = doc.createElement('div');
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
                    ctrl = doc.createElement('select');
                    ctrl.className = 'a11y-select';
                    ctrl.id = 'a11y_ctrl_' + (original.id || Date.now());
                    if (lbl) lbl.htmlFor = ctrl.id;

                    if (descId) ctrl.setAttribute('aria-describedby', descId);
                    
                    const updateOptions = () => {
                        ctrl.innerHTML = '';
                        Array.from(select.options).forEach(o => ctrl.add(new Option(o.text, o.value, false, o.selected)));
                    }
                    updateOptions();

                    ctrl.onchange = (e) => {
                        const target = /** @type {HTMLSelectElement} */ (e.target);
                        if (w.$) w.$(original).val(target.value).trigger('change');
                        else { original.value = target.value; original.dispatchEvent(new Event('change')); }
                        this.announce(labelText + " updated");
                        
                        if (['chat_completion_source', 'textgen_type'].includes(original.id)) {
                            setTimeout(() => this.navigateTo(this.currentView), 300);
                        }
                    };
                    
                    // Sync back
                    original.addEventListener('change', () => {
                        if (ctrl.value !== select.value) ctrl.value = select.value;
                    });
                     // Watch for option changes (dynamic lists)
                    const obs = new MutationObserver(updateOptions);
                    obs.observe(original, { childList: true });

                } else {
                    const input = /** @type {HTMLInputElement|HTMLTextAreaElement} */ (original);
                    ctrl = doc.createElement(original.tagName === 'TEXTAREA' ? 'textarea' : 'input');
                    ctrl.className = 'a11y-input';
                    ctrl.id = 'a11y_ctrl_' + (original.id || Date.now());
                    if (lbl) lbl.htmlFor = ctrl.id;

                    ctrl.value = input.value;
                    if (descId) ctrl.setAttribute('aria-describedby', descId);
                    
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
                        
                        ctrl.setAttribute('aria-valuenow', input.value);
                    }
                    
                    // Forward: A11y -> Original
                    ctrl.oninput = (e) => {
                        const target = /** @type {HTMLInputElement} */ (e.target);
                        // Prevent loops: if value matches, don't re-trigger
                        if (original.value === target.value) return;

                        if (w.$) w.$(original).val(target.value).trigger('input');
                        else { original.value = target.value; original.dispatchEvent(new Event('input')); }
                    };
                    
                    ctrl.onchange = (e) => {
                         const target = /** @type {HTMLInputElement} */ (e.target);
                         if (w.$) w.$(original).val(target.value).trigger('change');
                         else { original.value = target.value; original.dispatchEvent(new Event('change')); }
                    };

                    // Backward: Original -> A11y (Sync clamping/updates)
                    const syncBack = () => {
                         if (document.activeElement === ctrl && Math.abs(Number(ctrl.value) - Number(input.value)) < 0.0001) return; // Don't interrupt user typing unless value drastically changed (clamped)
                         
                         if (ctrl.value !== input.value) {
                             ctrl.value = input.value;
                             if (input.type === 'number') ctrl.setAttribute('aria-valuenow', input.value);
                         }
                    };
                    original.addEventListener('input', syncBack);
                    original.addEventListener('change', syncBack);
                }
                container.appendChild(ctrl);
            }
        },

        getLabelText(/** @type {HTMLElement} */ el) {
            if (ID_MAP[el.id]) return ID_MAP[el.id];

            let text = '';
            // 1. Try explicit aria-label
            if (el.getAttribute('aria-label')) return el.getAttribute('aria-label');

            // 2. Try 'for' attribute label
            let l = doc.querySelector(`label[for="${el.id}"]`);
            if (l) {
                text = /** @type {HTMLElement} */(l).innerText.trim().split('\n')[0];
            }

            // 3. Fallback: Check for immediate parent headers (Standard Logic)
            if (!text) {
                let p = el.parentElement;
                for (let i = 0; i < 3; i++) {
                    if (!p) break;
                    
                    // If this is a wrapper for a setting (often has span or b)
                    const labelCandidate = /** @type {HTMLElement} */ (p.querySelector('span[data-i18n], b[data-i18n], small[data-i18n]'));
                    if (labelCandidate && labelCandidate !== el && !labelCandidate.closest('.fa-circle-info')) {
                        // Check if candidate is likely a warning or description
                        const isWarning = labelCandidate.classList.contains('neutral_warning') || labelCandidate.closest('.neutral_warning') || labelCandidate.closest('.reverse_proxy_warning');
                        const isDesc = labelCandidate.closest('.toggle-description');
                        
                        // Strict check: if the text is long and looks like a sentence, it's probably not a label (heuristic)
                        const candidateText = labelCandidate.innerText?.trim();
                        const isLong = candidateText && candidateText.length > 61; // "Doesn't work? Try adding /v1 at the end!" is ~40-50 chars, let's be safe
                        const isHelpText = candidateText && (candidateText.includes('?') || candidateText.includes('Try adding'));

                        if (!isWarning && !isDesc && !isLong && !isHelpText) {
                            if (candidateText) {
                                text = candidateText;
                                break;
                            }
                        }
                    }

                    // Look for headers (range-block-title) in immediate vicinity
                    const h = p.querySelector('h4, small, b, .range-block-title');
                    if (h && !h.closest('.toggle-description') && !h.closest('.neutral_warning')) {
                        const hText = /** @type {HTMLElement} */(h).innerText?.trim().split('\n')[0];
                        if (hText && hText.length > 1) {
                            text = hText;
                            break;
                        }
                    }
                    p = p.parentElement;
                }
            }

            // 4. Generic Check: If text is still empty OR generic ('None'), try to find a Group/Section Header
            const genericTerms = ['None', 'Default', 'Empty', '无', '默认', 'Space', 'Newline', 'Double Newline', '空格', '换行', '双换行'];
            const isGeneric = !text || genericTerms.includes(text) || text.length < 2;

            if (isGeneric) {
                const groupHeader = this.getGroupHeader(el);
                 if (groupHeader && groupHeader !== text) {
                     return text ? `${groupHeader} - ${text}` : groupHeader;
                 }
            }
            
            return text || /** @type {HTMLInputElement} */(el).name || el.id;
        },

        getGroupHeader(/** @type {HTMLElement} */ el) {
            // 1. Inline Drawer Check (SillyTavern pattern)
            const drawerContent = el.closest('.inline-drawer-content');
            if (drawerContent) {
                const drawer = drawerContent.parentElement;
                if (drawer && drawer.classList.contains('inline-drawer')) {
                     const drawerHeader = drawer.querySelector('.inline-drawer-header b[data-i18n], .inline-drawer-header span[data-i18n]');
                     if (drawerHeader) return /** @type {HTMLElement} */(drawerHeader).innerText.trim();
                }
            }

            // 2. Standard Container/Range Block Check
            let p = el.closest('.range-block') || el.closest('.flex-container') || el.parentElement;
            
            // Traverse up a few levels to find a suitable header
            for (let i = 0; i < 4; i++) {
                if (!p || p === doc.body) break;

                // Look for a header in this container
                // Exclude toggle-description or simple labels
                const header = p.querySelector('h4, .range-block-title, strong[data-i18n]');
                if (header) {
                     // specific exclusion for toggle description
                     if (header.classList.contains('toggle-description')) {
                         p = p.parentElement;
                         continue;
                     }

                     const headerText = /** @type {HTMLElement} */(header).innerText.trim().split('\n')[0];
                     if (headerText) return headerText;
                }
                p = p.parentElement;
            }
            return '';
        },

        createSectionHeader(/** @type {HTMLElement} */ c, /** @type {string} */ t) {
            const h = doc.createElement('h3');
            h.className = 'a11y-section-header';
            h.textContent = t;
            c.appendChild(h);
        },

        createA11yLabel(/** @type {HTMLElement} */ c, /** @type {string} */ t) {
            const l = doc.createElement('label');
            l.className = 'a11y-label';
            l.textContent = t;
            c.appendChild(l);
            return l;
        },

        addBackButton(/** @type {HTMLElement} */ c, /** @type {string} */ t) {
            const b = doc.createElement('button');
            b.className = 'a11y-btn';
            b.style.background = '#333';
            b.style.marginTop = '2rem';
            b.innerText = "Go Back";
            b.onclick = () => this.navigateTo(t);
            c.appendChild(b);
        }
    };

    w.addEventListener('load', () => {
        // Wait a bit for other scripts to initialize
        setTimeout(() => A11yController.init(), 2000);
    });
})();