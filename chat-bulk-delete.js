
/**
 * Chat Bulk Delete Manager for SillyTavern - Fixed Version
 * This version handles missing target elements better and has teal-purple holographic effect
 */

class ChatBulkManager {
    static containerId = 'select_chat_div';
    static selectedClass = 'chat_selected';
    static checkboxClass = 'chat_bulk_checkbox';
    static selectAllId = 'chat_select_all';
    static bulkDeleteId = 'chat_bulk_delete';
    static bulkControlsId = 'chat_bulk_controls';

    #selectedChats = [];
    #isInitialized = false;
    #observer = null;

    initialize() {
        if (this.#isInitialized) return;
        console.log('[ChatBulkDelete] Initializing...');
        this.#addBulkControls();
        this.#setupEventListeners();
        this.#watchForChatPanel();
        this.#isInitialized = true;
        console.log('[ChatBulkDelete] Initialized successfully!');
    }

    #findTargetElement() {
        const possibleTargets = [
            '#select_chat_search',
            '#select_chat_div .flex-container',
            '#select_chat_div > div:first-child',
            '#select_chat_div',
            '.select_chat_block_wrapper:first',
            '#rm_print_characters_block'
        ];

        for (const selector of possibleTargets) {
            const element = $(selector);
            if (element.length > 0) {
                console.log(`[ChatBulkDelete] Found target element: ${selector}`);
                return element;
            }
        }
        console.warn('[ChatBulkDelete] Could not find any suitable target element');
        return null;
    }

    #watchForChatPanel() {
        this.#observer = new MutationObserver(() => {
            const chatPanel = $('#select_chat_div');
            if (chatPanel.is(':visible') && $('.select_chat_block_wrapper').length > 0) {
                if ($('#chat_bulk_toggle').length === 0) {
                    console.log('[ChatBulkDelete] Re-adding controls...');
                    this.#addBulkControls();
                }
            }
        });
        this.#observer.observe(document.body, { childList: true, subtree: true });
    }

    resetState() {
        if ($(`#${ChatBulkManager.bulkControlsId}`).is(':visible')) {
            this.exitBulkMode();
        }
        this.#selectedChats = [];
        $(`.${ChatBulkManager.checkboxClass}`).remove();
        $('.select_chat_block_wrapper').removeClass('bulk-mode');
        $(`#${ChatBulkManager.bulkControlsId}`).hide();
        $('#chat_bulk_toggle').show();
    }

    #disableNormalChatEvents() {
        $('.select_chat_block_wrapper').off('click');
        $('.select_chat_block').off('click');
    }

    #enableNormalChatEvents() {
        $('.select_chat_block_wrapper').on('click', function() {
            // Normal chat selection behavior
        });
    }

    #addBulkControls() {
        $('#chat_bulk_toggle').remove();
        $(`#${ChatBulkManager.bulkControlsId}`).remove();

        const targetElement = this.#findTargetElement();
        if (!targetElement) {
            console.warn('[ChatBulkDelete] Could not find target element for controls');
            return;
        }

        const bulkControlsHtml = `
            <div id="${ChatBulkManager.bulkControlsId}" class="flex-container alignitemscenter justifySpaceBetween m-t-1" style="display: none; padding: 10px; background: rgba(0,0,0,0.2); border-radius: 5px; margin-bottom: 10px;">
                <div class="flex-container alignitemscenter gap10px">
                    <label class="checkbox_label" style="margin: 0;">
                        <input type="checkbox" id="${ChatBulkManager.selectAllId}" />
                        <span>Select All</span>
                    </label>
                    <span id="chat_selected_count" class="text_muted">0 selected</span>
                </div>
                <div class="flex-container gap10px">
                    <button id="${ChatBulkManager.bulkDeleteId}" class="menu_button menu_button_icon" disabled>
                        <i class="fa-solid fa-trash"></i>
                        <span>Delete Selected</span>
                    </button>
                    <button id="chat_bulk_cancel" class="menu_button">
                        <span>Cancel</span>
                    </button>
                </div>
            </div>
            <style>
                @keyframes holographic-shift {
                    0% { background-position: 0% 50%; }
                    50% { background-position: 100% 50%; }
                    100% { background-position: 0% 50%; }
                }
                #chat_bulk_toggle {
                    position: relative;
                    overflow: hidden;
                    z-index: 1;
                }
                #chat_bulk_toggle::before {
                    content: '';
                    position: absolute;
                    top: 0;
                    left: -100%;
                    width: 100%;
                    height: 100%;
                    background: linear-gradient(90deg, transparent, rgba(255, 255, 255, 0.4), transparent);
                    transition: left 0.5s ease;
                    z-index: 2;
                }
                #chat_bulk_toggle:hover::before {
                    left: 100%;
                }
                #chat_bulk_toggle::after {
                    content: '';
                    position: absolute;
                    inset: 0;
                    border-radius: 6px;
                    padding: 2px;
                    background: linear-gradient(135deg, #00d4ff, #7b2cbf, #00d4ff, #7b2cbf, #00d4ff);
                    background-size: 400% 400%;
                    animation: holographic-shift 3s ease infinite;
                    -webkit-mask: linear-gradient(#fff 0 0) content-box, linear-gradient(#fff 0 0);
                    -webkit-mask-composite: xor;
                    mask-composite: exclude;
                    z-index: 0;
                }
            </style>
            <div style="text-align: right; margin: 8px 0;">
                <button id="chat_bulk_toggle" class="menu_button chat-bulk-toggle-holographic" style="
                    position: relative;
                    padding: 10px 20px;
                    font-size: 0.95em;
                    background: linear-gradient(135deg, #00d4ff 0%, #7b2cbf 25%, #00d4ff 50%, #7b2cbf 75%, #00d4ff 100%);
                    background-size: 400% 400%;
                    border: 2px solid transparent;
                    border-radius: 8px;
                    display: inline-flex;
                    align-items: center;
                    gap: 8px;
                    transition: all 0.3s ease;
                    color: #fff;
                    font-weight: 600;
                    box-shadow: 0 0 20px rgba(0, 212, 255, 0.5), 0 0 40px rgba(123, 44, 191, 0.3), inset 0 0 20px rgba(255, 255, 255, 0.1);
                    animation: holographic-shift 3s ease infinite;
                    cursor: pointer;
                    text-shadow: 0 0 10px rgba(255, 255, 255, 0.5);
                ">
                    <i class="fa-solid fa-layer-group" style="font-size: 1.1em;"></i>
                    <span style="font-size: 0.95em;">Bulk Delete</span>
                </button>
            </div>
        `;

        targetElement.after(bulkControlsHtml);

        setTimeout(() => {
            $('#chat_bulk_toggle').hover(
                function() {
                    $(this).css({
                        'box-shadow': '0 0 30px rgba(0, 212, 255, 0.7), 0 0 60px rgba(123, 44, 191, 0.5), inset 0 0 30px rgba(255, 255, 255, 0.2)',
                        'transform': 'translateY(-3px) scale(1.05)',
                        'animation': 'holographic-shift 1.5s ease infinite'
                    });
                },
                function() {
                    $(this).css({
                        'box-shadow': '0 0 20px rgba(0, 212, 255, 0.5), 0 0 40px rgba(123, 44, 191, 0.3), inset 0 0 20px rgba(255, 255, 255, 0.1)',
                        'transform': 'translateY(0) scale(1)',
                        'animation': 'holographic-shift 3s ease infinite'
                    });
                }
            );
        }, 100);

        console.log('[ChatBulkDelete] Controls added (Teal-Purple Holographic \u2728)');
    }

    #setupEventListeners() {
        console.log('[ChatBulkDelete] Setting up event listeners...');
        
        $(document).off('click', '#chat_bulk_toggle');
        $(document).on('click', '#chat_bulk_toggle', () => {
            console.log('[ChatBulkDelete] Toggle button clicked');
            this.enterBulkMode();
        });

        $(document).off('change', `#${ChatBulkManager.selectAllId}`);
        $(document).on('change', `#${ChatBulkManager.selectAllId}`, (e) => {
            const isChecked = e.target.checked;
            if (isChecked) {
                this.#selectedChats = [];
                $(`.${ChatBulkManager.checkboxClass}`).each((index, element) => {
                    const fileName = $(element).data('filename');
                    if (!this.#selectedChats.includes(fileName)) {
                        this.#selectedChats.push(fileName);
                    }
                    $(element).prop('checked', true);
                });
            } else {
                this.#selectedChats = [];
                $(`.${ChatBulkManager.checkboxClass}`).prop('checked', false);
            }
            this.#updateUI();
        });

        $(document).off('click', `.${ChatBulkManager.checkboxClass}`);
        $(document).on('click', `.${ChatBulkManager.checkboxClass}`, (e) => {
            e.stopPropagation();
        });

        $(document).off('change', `.${ChatBulkManager.checkboxClass}`);
        $(document).on('change', `.${ChatBulkManager.checkboxClass}`, (e) => {
            e.stopPropagation();
            const fileName = $(e.target).data('filename');
            if (e.target.checked) {
                if (!this.#selectedChats.includes(fileName)) {
                    this.#selectedChats.push(fileName);
                }
            } else {
                const index = this.#selectedChats.indexOf(fileName);
                if (index > -1) {
                    this.#selectedChats.splice(index, 1);
                }
            }
            this.#updateUI();
        });

        $(document).off('click', '.select_chat_block_wrapper.bulk-mode');
        $(document).on('click', '.select_chat_block_wrapper.bulk-mode', (e) => {
            if ($(e.target).hasClass(ChatBulkManager.checkboxClass)) {
                return;
            }
            e.preventDefault();
            e.stopPropagation();
            const $wrapper = $(e.currentTarget);
            const fileName = $wrapper.find('.select_chat_block').attr('file_name');
            const checkbox = $wrapper.find(`.${ChatBulkManager.checkboxClass}`);
            const isCurrentlyChecked = checkbox.prop('checked');
            checkbox.prop('checked', !isCurrentlyChecked);
            if (!isCurrentlyChecked) {
                if (!this.#selectedChats.includes(fileName)) {
                    this.#selectedChats.push(fileName);
                }
            } else {
                const index = this.#selectedChats.indexOf(fileName);
                if (index > -1) {
                    this.#selectedChats.splice(index, 1);
                }
            }
            this.#updateUI();
        });

        $(document).off('click', `#${ChatBulkManager.bulkDeleteId}`);
        $(document).on('click', `#${ChatBulkManager.bulkDeleteId}`, () => {
            this.#handleBulkDelete();
        });

        $(document).off('click', '#chat_bulk_cancel');
        $(document).on('click', '#chat_bulk_cancel', () => {
            this.exitBulkMode();
        });
    }

    enterBulkMode() {
        console.log('[ChatBulkDelete] Entering bulk mode...');
        this.#disableNormalChatEvents();
        $('.select_chat_block_wrapper').each((index, element) => {
            const $element = $(element);
            const fileName = $element.find('.select_chat_block').attr('file_name');
            if ($element.find(`.${ChatBulkManager.checkboxClass}`).length === 0) {
                const checkbox = `<input type="checkbox" class="${ChatBulkManager.checkboxClass}" data-filename="${fileName}" style="margin-right: 10px;">`;
                $element.prepend(checkbox);
            }
            $element.addClass('bulk-mode');
            const $chatBlock = $element.find('.select_chat_block');
            $chatBlock.addClass('bulk-mode-readonly');
            $chatBlock.css({
                'user-select': 'none',
                'pointer-events': 'none'
            });
        });
        $(`#${ChatBulkManager.bulkControlsId}`).show();
        $('#chat_bulk_toggle').hide();
        this.#updateUI();
        console.log('[ChatBulkDelete] Bulk mode active');
    }

    exitBulkMode() {
        console.log('[ChatBulkDelete] Exiting bulk mode...');
        this.#enableNormalChatEvents();
        $(`.${ChatBulkManager.checkboxClass}`).remove();
        $('.select_chat_block_wrapper').removeClass('bulk-mode');
        $('.select_chat_block').removeClass('bulk-mode-readonly');
        $('.select_chat_block').css({
            'user-select': '',
            'pointer-events': ''
        });
        $(`#${ChatBulkManager.bulkControlsId}`).hide();
        $('#chat_bulk_toggle').show();
        this.#selectedChats = [];
        this.#updateUI();
    }

    #updateUI() {
        const selectedCount = this.#selectedChats.length;
        const totalCount = $(`.${ChatBulkManager.checkboxClass}`).length;
        $('#chat_selected_count').text(`${selectedCount} selected`);
        const selectAllCheckbox = $(`#${ChatBulkManager.selectAllId}`);
        selectAllCheckbox.prop('indeterminate', selectedCount > 0 && selectedCount < totalCount);
        selectAllCheckbox.prop('checked', selectedCount === totalCount && totalCount > 0);
        $(`#${ChatBulkManager.bulkDeleteId}`).prop('disabled', selectedCount === 0);
    }

    async #handleBulkDelete() {
        if (this.#selectedChats.length === 0) return;
        console.log('[ChatBulkDelete] Deleting chats:', this.#selectedChats);
        const confirmed = confirm(`Delete ${this.#selectedChats.length} chat(s)?\
\
This action cannot be undone.\
\
Selected chats:\
${this.#selectedChats.join('\
')}`);
        if (!confirmed) return;

        try {
            if (typeof toastr !== 'undefined') {
                toastr.info('Deleting selected chats...', 'Please wait');
            }
            let successCount = 0;
            let failCount = 0;

            for (const fileName of this.#selectedChats) {
                try {
                    let avatarUrl = null;
                    if (typeof this_chid !== 'undefined' && typeof characters !== 'undefined' && characters[this_chid]) {
                        avatarUrl = characters[this_chid].avatar;
                    }
                    const response = await fetch('/api/chats/delete', {
                        method: 'POST',
                        headers: {
                            'Content-Type': 'application/json',
                        },
                        body: JSON.stringify({
                            chatfile: fileName,
                            avatar_url: avatarUrl
                        })
                    });
                    if (response.ok) {
                        successCount++;
                        console.log(`[ChatBulkDelete] Deleted: ${fileName}`);
                    } else {
                        failCount++;
                        console.error(`[ChatBulkDelete] Failed to delete ${fileName}:`, response.statusText);
                    }
                } catch (error) {
                    failCount++;
                    console.error(`[ChatBulkDelete] Error deleting ${fileName}:`, error);
                }
            }

            if (typeof toastr !== 'undefined') {
                if (successCount > 0) {
                    toastr.success(`Successfully deleted ${successCount} chat(s)`, 'Success');
                }
                if (failCount > 0) {
                    toastr.warning(`Failed to delete ${failCount} chat(s)`, 'Warning');
                }
            } else {
                alert(`Deleted ${successCount} chat(s). Failed: ${failCount}`);
            }

            this.exitBulkMode();
            setTimeout(() => {
                location.reload();
            }, 1000);

        } catch (error) {
            console.error('[ChatBulkDelete] Bulk delete failed:', error);
            if (typeof toastr !== 'undefined') {
                toastr.error('Failed to delete chats. Please try again.', 'Error');
            } else {
                alert('Failed to delete chats. Check console for details.');
            }
        }
    }

    get selectedChats() {
        return [...this.#selectedChats];
    }
}

(function initializeBulkDelete() {
    console.log('[ChatBulkDelete] Loading...');
    
    function tryInit() {
        if (typeof $ !== 'undefined' && typeof jQuery !== 'undefined') {
            $(document).ready(function() {
                window.chatBulkManager = new ChatBulkManager();
                window.chatBulkManager.initialize();
                
                setInterval(() => {
                    if ($('#select_chat_div').length > 0 && $('#chat_bulk_toggle').length === 0) {
                        console.log('[ChatBulkDelete] Re-initializing...');
                        window.chatBulkManager.initialize();
                    }
                }, 2000);
            });
        } else {
            setTimeout(tryInit, 100);
        }
    }
    
    tryInit();
})();