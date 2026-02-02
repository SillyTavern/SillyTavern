(function() {
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

    const style = document.createElement('style');
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
        .a11y-input, .a11y-select { width: 100%; padding: 1rem; font-size: 1.2rem; margin-bottom: 1rem; background: #000; color: #fff; border: 2px solid #444; box-sizing: border-box; border-radius: 4px; }
        .a11y-input:focus, .a11y-select:focus { border-color: #fff; outline: none; }
        .a11y-label { display: block; margin-top: 1rem; color: #bbb; font-weight: bold; font-size: 0.9rem; text-transform: uppercase; }
        .a11y-msg-container { margin-bottom: 1.5rem; padding: 1.2rem; border-radius: 12px; border: 1px solid #333; background: #161616; position: relative; }
        .a11y-msg-name { color: #fff; font-weight: bold; font-size: 1.1rem; display: block; margin-bottom: 8px; color: #00bcff; }
        .a11y-msg-text { line-height: 1.6; white-space: pre-wrap; font-size: 1.15rem; color: #ececec; }
        .a11y-msg-reasoning { background: #222; padding: 1rem; border-left: 4px solid #555; margin: 10px 0; font-style: italic; color: #aaa; }
        .a11y-msg-nav { margin-top: 15px; padding-top: 10px; border-top: 1px solid #333; display: flex; align-items: center; gap: 10px; }
        .sr-only { position: absolute; width: 1px; height: 1px; padding: 0; margin: -1px; overflow: hidden; clip: rect(0,0,0,0); border: 0; }
    `;
    document.head.appendChild(style);

    const trigger = document.createElement('button');
    trigger.className = 'silly-a11y-trigger';
    trigger.innerText = 'Press Enter to enter Accessibility Mode';
    document.body.prepend(trigger);

    const overlay = document.createElement('div');
    overlay.id = 'a11y-overlay';
    overlay.setAttribute('role', 'dialog');
    overlay.setAttribute('aria-modal', 'true');
    overlay.style.display = 'none';
    overlay.innerHTML = `
        <div id="a11y-status" class="sr-only" aria-live="assertive"></div>
        <div id="a11y-header" tabindex="-1"></div>
        <input type="file" id="a11y-file-input" class="sr-only" tabIndex="-1">
        <div id="a11y-content"></div>
        <div id="a11y-footer">Esc: Back | Tab: Navigate | Enter: Action | H: Jump Messages</div>
    `;
    document.body.appendChild(overlay);

    const A11yController = {
        trap: null,
        currentView: null,
        toastObserver: null,
        chatObserver: null,
        importContext: null,
        originalPopupShow: null,

        init() {
            trigger.onclick = () => this.enterMode();
            this.trap = window.focusTrap.createFocusTrap('#a11y-overlay', {
                initialFocus: '#a11y-header',
                fallbackFocus: '#a11y-header',
                allowOutsideClick: false
            });
            
            document.addEventListener('keydown', (e) => {
                if (overlay.style.display !== 'flex') return;
                
                if (e.key === 'Escape' && this.currentView !== 'MENU') {
                    if (this.currentView === 'CHAT') this.navigateTo('CHARS');
                    else this.navigateTo('MENU');
                }
            });

            const fileInput = document.getElementById('a11y-file-input');
            fileInput.onchange = (e) => this.handleFileSelected(e);

            this.initToastMonitor();
            this.interceptPopups();
        },

        interceptPopups() {
            const self = this;
            this.originalPopupShow = window.Popup.show;
            window.Popup.show = async function(title, content, type, options) {
                if (overlay.style.display === 'flex') {
                    return await self.renderA11yConfirmation(title, content);
                }
                return self.originalPopupShow.apply(this, arguments);
            };
        },

        async renderA11yConfirmation(title, content) {
            const contentArea = document.getElementById('a11y-content');
            const header = document.getElementById('a11y-header');
            const previousHTML = contentArea.innerHTML;
            const previousView = this.currentView;

            this.currentView = 'CONFIRM';
            header.innerText = "Confirmation Required";
            contentArea.innerHTML = '';

            this.createA11yLabel(contentArea, title);
            const desc = document.createElement('div');
            desc.className = 'a11y-msg-text';
            desc.innerHTML = content;
            contentArea.appendChild(desc);

            return new Promise((resolve) => {
                const btnYes = document.createElement('button');
                btnYes.className = 'a11y-btn';
                btnYes.innerText = "Yes";
                btnYes.onclick = () => {
                    this.currentView = previousView;
                    contentArea.innerHTML = previousHTML;
                    resolve(1);
                };

                const btnNo = document.createElement('button');
                btnNo.className = 'a11y-btn';
                btnNo.innerText = "No";
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
                                const text = mut.addedNodes[0].innerText;
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

        announce(text) {
            const el = document.getElementById('a11y-status');
            el.innerText = ''; 
            setTimeout(() => el.innerText = text, 50);
        },

        navigateTo(view, data = null) {
            this.currentView = view;
            const content = document.getElementById('a11y-content');
            const header = document.getElementById('a11y-header');
            content.innerHTML = '';
            content.scrollTop = 0;
            if (this.chatObserver) { this.chatObserver.disconnect(); this.chatObserver = null; }

            switch(view) {
                case 'MENU': header.innerText = "Main Menu"; this.renderMainMenu(content); break;
                case 'API': header.innerText = "API Connections"; this.renderApiMenu(content); break;
                case 'PRESET': header.innerText = "Presets and Templates"; this.renderPresetMenu(content); break;
                case 'CHARS': header.innerText = "Character Selection"; this.renderCharList(content); break;
                case 'CHAT': header.innerText = "Chat Session: " + (data || ""); this.renderChatInterface(content); break;
            }
            header.focus();
        },

        triggerUpload(context) {
            this.importContext = context;
            const fileInput = document.getElementById('a11y-file-input');
            fileInput.accept = (context === 'CHARACTER') ? ".png,.json,.charx,.byaf" : ".json,.settings";
            fileInput.click();
        },

        async handleFileSelected(e) {
            const file = e.target.files[0];
            if (!file) return;

            this.announce("Processing file: " + file.name);
            if (this.importContext === 'CHARACTER') {
                try {
                    const result = await window.importCharacter(file);
                    if (result) {
                        this.announce("Character " + file.name + " imported successfully");
                        this.navigateTo('CHARS');
                    }
                } catch (err) {
                    this.announce("Import failed: " + err.message);
                }
            } else {
                const reader = new FileReader();
                reader.onload = async (event) => {
                    try {
                        const data = JSON.parse(event.target.result);
                        await window.PresetManager.performMasterImport(data, file.name.replace('.json', ''));
                        this.announce("Presets updated successfully");
                        this.navigateTo('PRESET');
                    } catch (err) {
                        this.announce("Failed to parse JSON preset");
                    }
                };
                reader.readAsText(file);
            }
            e.target.value = '';
        },

        renderMainMenu(container) {
            const routes = [
                {t: "Character List", a: () => this.navigateTo('CHARS')},
                {t: "API Connections", a: () => this.navigateTo('API')},
                {t: "Presets and Templates", a: () => this.navigateTo('PRESET')}
            ];

            routes.forEach(i => {
                const b = document.createElement('button');
                b.className='a11y-btn';
                b.innerText=i.t;
                b.onclick=i.a;
                container.appendChild(b);
            });
            
            const exitBtn = document.createElement('button');
            exitBtn.className = 'a11y-btn';
            exitBtn.style.marginTop = '2rem';
            exitBtn.innerText = "Exit Accessibility Mode";
            exitBtn.tabIndex = -1;
            exitBtn.setAttribute('aria-hidden', 'true');
            exitBtn.onclick = () => location.reload();
            container.appendChild(exitBtn);
        },

        renderApiMenu(container) {
            const mainSelect = document.getElementById('main_api');
            if (!mainSelect) return;
            
            this.createA11yLabel(container, "Main API Type");
            const a11yMain = document.createElement('select');
            a11yMain.className = 'a11y-select';
            Array.from(mainSelect.options).forEach(o => a11yMain.add(new Option(o.text, o.value, false, o.selected)));
            a11yMain.onchange = (e) => {
                $(mainSelect).val(e.target.value).trigger('change');
                setTimeout(() => this.navigateTo('API'), 500);
            };
            container.appendChild(a11yMain);

            const apiMap = { 'kobold': 'kobold_api', 'koboldhorde': 'kobold_horde', 'novel': 'novel_api', 'textgenerationwebui': 'textgenerationwebui_api', 'openai': 'openai_api' };
            const targetContainer = document.getElementById(apiMap[mainSelect.value]);

            if (targetContainer) {
                this.createA11yLabel(container, "API Parameters");
                targetContainer.querySelectorAll('select, input:not([type="hidden"]), textarea').forEach(el => {
                    if (!this.isElementVisibleInOriginal(el, targetContainer)) return;
                    if (el.classList.contains('manage-api-keys') || el.id === 'main_api' || el.type === 'file') return;
                    this.createA11yControl(container, el);
                });
                
                targetContainer.querySelectorAll('.api_button, #test_api_button, .openrouter_authorize').forEach(btn => {
                    const text = btn.innerText.trim() || btn.getAttribute('title');
                    if (!text || btn.style.display === 'none') return;
                    const b = document.createElement('button');
                    b.className = 'a11y-btn';
                    b.innerText = "Action: " + text;
                    b.onclick = () => { $(btn).trigger('click'); };
                    container.appendChild(b);
                });
            }
            this.addBackButton(container, 'MENU');
        },

        renderCharList(container) {
            const importBtn = document.createElement('button');
            importBtn.className = 'a11y-btn';
            importBtn.innerText = "Import New Character Card";
            importBtn.onclick = () => this.triggerUpload('CHARACTER');
            container.appendChild(importBtn);

            const search = document.createElement('input');
            search.className = 'a11y-input';
            search.placeholder = "Filter characters by name...";
            search.setAttribute('aria-label', 'Search characters');
            container.appendChild(search);
            
            const charContainer = document.createElement('div');
            container.appendChild(charContainer);
            
            const drawChars = (filter = "") => {
                charContainer.innerHTML = '';
                const chars = Array.from(document.querySelectorAll('#rm_print_characters_block .character_select, .entity_block'));
                chars.forEach((el) => {
                    const name = el.querySelector('.ch_name')?.innerText || "Unnamed";
                    if (filter && !name.toLowerCase().includes(filter.toLowerCase())) return;
                    const b = document.createElement('button');
                    b.className = 'a11y-btn';
                    b.innerText = name;
                    b.onclick = () => {
                        $(el).trigger('click');
                        this.announce("Loading chat with " + name);
                        setTimeout(() => this.navigateTo('CHAT', name), 800);
                    };
                    charContainer.appendChild(b);
                });
            };
            search.oninput = (e) => drawChars(e.target.value);
            drawChars();
            this.addBackButton(container, 'MENU');
        },

        renderChatInterface(container) {
            const history = document.createElement('div');
            history.id = 'a11y-chat-log';
            history.setAttribute('role', 'log');
            history.setAttribute('aria-label', 'Chat Messages');
            history.style.flex = '1';
            history.style.overflowY = 'auto';
            container.appendChild(history);
            
            const updateChat = () => {
                const msgs = Array.from(document.querySelectorAll('#chat .mes[mesid]:not(.displayNone)'))
                                  .filter(m => !m.closest('.welcomePanel'));
                history.innerHTML = '';
                msgs.forEach(m => {
                    const mesId = m.getAttribute('mesid');
                    const name = m.querySelector('.name_text')?.innerText || "System";
                    const isUser = m.getAttribute('is_user') === 'true';
                    const textEl = m.querySelector('.mes_text');
                    const reasoning = m.querySelector('.mes_reasoning')?.innerText;
                    
                    const article = document.createElement('article');
                    article.className = 'a11y-msg-container';
                    article.setAttribute('aria-labelledby', `msg-label-${mesId}`);

                    const h = document.createElement('h3');
                    h.id = `msg-label-${mesId}`;
                    h.className = 'sr-only';
                    h.innerText = `${isUser ? 'You' : 'Character'} ${name} said:`;
                    article.appendChild(h);

                    const nameDisplay = document.createElement('span');
                    nameDisplay.className = 'a11y-msg-name';
                    nameDisplay.setAttribute('aria-hidden', 'true');
                    nameDisplay.innerText = name;
                    article.appendChild(nameDisplay);

                    if (reasoning && reasoning.trim()) {
                        const details = document.createElement('details');
                        details.innerHTML = `<summary>View Thought Process</summary><div class="a11y-msg-reasoning">${reasoning}</div>`;
                        article.appendChild(details);
                    }

                    const body = document.createElement('div');
                    body.className = 'a11y-msg-text';
                    const clone = textEl.cloneNode(true);
                    clone.querySelectorAll('button, .qr--list, .mes_buttons, i').forEach(ui => ui.remove());
                    body.innerText = clone.innerText.trim();
                    article.appendChild(body);

                    const swipes = window.chat?.[mesId]?.swipes;
                    if (swipes && swipes.length > 1) {
                        const nav = document.createElement('nav');
                        nav.className = 'a11y-msg-nav';
                        const cur = (parseInt(m.getAttribute('swipeid')) || 0) + 1;
                        nav.innerHTML = `<span>Branch ${cur} of ${swipes.length}</span>`;
                        
                        const bL = document.createElement('button');
                        bL.className = 'a11y-btn a11y-btn-sm';
                        bL.innerText = "Previous";
                        bL.onclick = () => { $(m.querySelector('.swipe_left')).trigger('click'); };
                        
                        const bR = document.createElement('button');
                        bR.className = 'a11y-btn a11y-btn-sm';
                        bR.innerText = "Next";
                        bR.onclick = () => { $(m.querySelector('.swipe_right')).trigger('click'); };
                        
                        nav.appendChild(bL);
                        nav.appendChild(bR);
                        article.appendChild(nav);
                    }

                    history.appendChild(article);
                });
                history.scrollTop = history.scrollHeight;
            };
            
            const realChat = document.getElementById('chat');
            if (realChat) {
                this.chatObserver = new MutationObserver(updateChat);
                this.chatObserver.observe(realChat, { childList: true, subtree: true });
            }
            updateChat();
            
            const inp = document.createElement('textarea');
            inp.className = 'a11y-input';
            inp.placeholder = "Type message and press Enter to send...";
            inp.setAttribute('aria-label', 'Message input');
            
            inp.onkeydown = async (e) => {
                if (e.key === 'Enter' && !e.shiftKey) {
                    e.preventDefault();
                    const val = e.target.value.trim();
                    if (!val) return;
                    
                    const $orig = $('#send_textarea');
                    if ($orig.length) {
                        $orig.val(val).trigger('input').trigger('change');
                        e.target.value = '';
                        try {
                            if (window.SillyTavern?.sendTextareaMessage) {
                                await window.SillyTavern.sendTextareaMessage();
                                this.announce("Message sent. Waiting for reply.");
                            } else {
                                $('#send_but').trigger('click');
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

        renderPresetMenu(container) {
            const importBtn = document.createElement('button');
            importBtn.className = 'a11y-btn';
            importBtn.innerText = "Import Settings File";
            importBtn.onclick = () => this.triggerUpload('PRESET');
            container.appendChild(importBtn);

            const api = document.getElementById('main_api')?.value;
            let sId = (api === 'openai') ? 'settings_preset_openai' : (api === 'textgenerationwebui' ? 'settings_preset_textgenerationwebui' : 'settings_preset');
            
            const targets = [
                {id: sId, t: "Generation Preset"},
                {id: 'instruct_presets', t: "Instruct Template"},
                {id: 'context_presets', t: "Context Template"},
                {id: 'sysprompt_select', t: "System Prompt"}
            ];

            targets.forEach(item => {
                const el = document.getElementById(item.id);
                if (!el) return;
                const b = document.createElement('button');
                b.className = 'a11y-btn';
                b.innerText = `${item.t}: ${el.options[el.selectedIndex]?.text || "None"}`;
                b.onclick = () => {
                    container.innerHTML = `<h3 style='color:#fff'>Select ${item.t}</h3>`;
                    Array.from(el.options).forEach(opt => {
                        const ob = document.createElement('button');
                        ob.className = 'a11y-btn';
                        ob.innerText = (opt.selected ? "[Selected] " : "") + opt.text;
                        ob.onclick = () => {
                            $(el).val(opt.value).trigger('change');
                            this.navigateTo('PRESET');
                        };
                        container.appendChild(ob);
                    });
                    this.addBackButton(container, 'PRESET');
                };
                container.appendChild(b);
            });
            this.addBackButton(container, 'MENU');
        },

        isElementVisibleInOriginal(el, container) {
            let p = el.parentElement;
            while (p && p !== container) {
                if (window.getComputedStyle(p).display === 'none' && !p.classList.contains('inline-drawer-content')) return false;
                if (p.dataset.source) {
                    const src = document.getElementById('chat_completion_source')?.value;
                    if (!p.dataset.source.split(',').includes(src)) return false;
                }
                p = p.parentElement;
            }
            return true;
        },

        createA11yControl(container, original) {
            const labelText = this.getLabelText(original);
            if (original.type === 'checkbox') {
                const b = document.createElement('button');
                b.className = 'a11y-btn';
                const sync = () => { b.innerText = (original.checked ? "Checked: " : "Unchecked: ") + labelText; };
                sync();
                b.onclick = () => { $(original).trigger('click'); setTimeout(sync, 100); };
                container.appendChild(b);
            } else {
                this.createA11yLabel(container, labelText);
                let ctrl;
                if (original.tagName === 'SELECT') {
                    ctrl = document.createElement('select');
                    ctrl.className = 'a11y-select';
                    Array.from(original.options).forEach(o => ctrl.add(new Option(o.text, o.value, false, o.selected)));
                    ctrl.onchange = (e) => {
                        $(original).val(e.target.value).trigger('change');
                        if (['chat_completion_source','textgen_type'].includes(original.id)) setTimeout(() => this.navigateTo('API'), 300);
                    };
                } else {
                    ctrl = document.createElement(original.tagName === 'TEXTAREA' ? 'textarea' : 'input');
                    ctrl.className = 'a11y-input';
                    ctrl.value = original.value;
                    ctrl.oninput = (e) => { $(original).val(e.target.value).trigger('input'); };
                }
                container.appendChild(ctrl);
            }
        },

        getLabelText(el) {
            if (ID_MAP[el.id]) return ID_MAP[el.id];
            const l = document.querySelector(`label[for="${el.id}"]`);
            if (l && l.innerText.trim().length > 1) return l.innerText.trim().split('\n')[0];
            let p = el.parentElement;
            for(let i=0; i<3; i++) { 
                if(!p) break;
                const h = p.querySelector('h4, small, b, .range-block-title');
                if (h && h.innerText.trim().length > 1) return h.innerText.trim().split('\n')[0];
                p = p.parentElement; 
            }
            return el.placeholder || "Settings Input";
        },

        createA11yLabel(c, t) {
            const l=document.createElement('div');
            l.className='a11y-label';
            l.innerText=t;
            c.appendChild(l);
        },

        addBackButton(c, t) {
            const b=document.createElement('button');
            b.className='a11y-btn';
            b.style.background='#333';
            b.style.marginTop='2rem';
            b.innerText="Go Back";
            b.onclick=()=>this.navigateTo(t);
            c.appendChild(b);
        }
    };

    window.addEventListener('load', () => {
        setTimeout(() => A11yController.init(), 3000);
    });
})();