import {
    chat,
    isChatSaving,
    this_edit_mes_id
} from '../script.js';
import {
    debounce
} from './utils.js';
import {
    eventSource,
    event_types
} from './events.js';
import {
    focusTrap
} from '../lib.js';

// ============================================================================
// PART 1: LEGACY A11Y LOGIC (RESTORED & EXPANDED)
// Defines generic roles for lists, buttons, tabs, etc.
// ============================================================================

const buttonSelectors = [
    '.menu_button',
    '.right_menu_button',
    '.mes_button',
    '.drawer-icon',
    // '.inline-drawer-icon', // Handled specifically in drawer logic now to avoid double focus
    '.swipe_left',
    '.swipe_right',
    '.character_select',
    '.tags .tag',
    '.jg-menu .jg-button',
    '.bg_example .mobile-only-menu-toggle',
    '.paginationjs-pages li a',
    '.inline-drawer-toggle', // Header acts as button
    '.qr--action',
].join(', ');

const listSelectors = [
    '.options-content',
    '.list-group',
    '#rm_print_characters_block',
    '#rm_group_members',
    '#rm_group_add_members',
    '.tag_view_list_tags',
    '.secretKeyManagerList',
    '.recentChatList',
    '.dataMaidCategoryContent',
    '#userList',
    '.bg_list',
    '.qr--setList',
    '.qr--set-qrListContents',
].join(', ');

const listItemSelectors = [
    '.options-content .list-group-item',
    '.list-group .list-group-item',
    '#rm_print_characters_block .entity_block',
    '#rm_group_members .group_member',
    '#rm_group_add_members .group_member',
    '.tag_view_list_tags .tag_view_item',
    '.secretKeyManagerList .secretKeyManagerItem',
    '.recentChatList .recentChat',
    '.dataMaidCategoryContent .dataMaidItem',
    '#userList .userSelect',
    '.bg_list .bg_example',
    '.qr--set-item',
].join(', ');

const toolbarSelectors = [
    '.jg-menu',
    '.qr--head',
].join(', ');

const tabListSelectors = [
    '#bg_tabs .bg_tabs_list',
].join(', ');

const tabItemSelectors = [
    '#bg_tabs .bg_tabs_list .bg_tab_button',
].join(', ');

/** @type {Record<string, (element: Element) => void>} */
const a11yRules = {
    [buttonSelectors]: (element) => {
        if (!element.hasAttribute('role')) element.setAttribute('role', 'button');
        if (!element.hasAttribute('tabindex') && element.tagName !== 'BUTTON' && element.tagName !== 'A') {
            element.setAttribute('tabindex', '0');
        }
    },
    [listSelectors]: (element) => {
        if (!element.hasAttribute('role')) element.setAttribute('role', 'list');
    },
    [listItemSelectors]: (element) => {
        if (!element.hasAttribute('role')) element.setAttribute('role', 'listitem');
    },
    [toolbarSelectors]: (element) => {
        if (!element.hasAttribute('role')) element.setAttribute('role', 'toolbar');
    },
    [tabListSelectors]: (element) => {
        if (!element.hasAttribute('role')) element.setAttribute('role', 'tablist');
    },
    [tabItemSelectors]: (element) => {
        if (!element.hasAttribute('role')) element.setAttribute('role', 'tab');
    },
    '#toast-container .toast': (element) => {
        if (!element.hasAttribute('role')) element.setAttribute('role', 'status');
    },
};

/**
 * Apply generic accessibility rules to an element based on selectors.
 * @param {Element} rootElement Element to process.
 */
function applyGenericA11yRules(rootElement) {
    try {
        for (const [selector, rule] of Object.entries(a11yRules)) {
            rootElement.querySelectorAll(selector).forEach(rule);
            if (rootElement.matches && rootElement.matches(selector)) {
                rule(rootElement);
            }
        }
    } catch (error) {
        console.error('Error applying accessibility rules:', error);
    }
}

// ============================================================================
// PART 2: ADVANCED INTERACTIVE LOGIC (NEW)
// Handles focus management, focus traps, chat semantics, and keyboard events.
// ============================================================================

let currentFocusTrap = null;
let promptManagerTrap = null;
let charPopupTrap = null;
let worldInfoTrap = null;
let worldInfoTrapUid = null;

let lastFocusedBeforeTrap = null;
let lastActivePromptId = null;
let lastActivePromptAction = null;
let lastActiveWIUid = null;
let isAiGenerating = false;

export function announceA11y(text) {
    const a11yAnnouncer = document.getElementById('a11y-announcer');
    if (a11yAnnouncer) {
        a11yAnnouncer.textContent = '';
        setTimeout(() => {
            a11yAnnouncer.textContent = text;
        }, 50);
    }
}

export function handleDrawerFocus(triggerButton, drawerElement, isOpening) {
    if (isOpening) {
        triggerButton.attr('aria-expanded', 'true');
        if (currentFocusTrap) {
            try { currentFocusTrap.deactivate(); } catch (e) { console.warn('Focus trap error', e); }
        }
        if (focusTrap && drawerElement) {
            currentFocusTrap = focusTrap.createFocusTrap(drawerElement, {
                initialFocus: false,
                fallbackFocus: drawerElement,
                escapeDeactivates: false,
                clickOutsideDeactivates: true,
                returnFocusOnDeactivate: false,
            });
            setTimeout(() => {
                try { currentFocusTrap.activate(); } catch (e) { console.warn('Trap activate failed', e); }
            }, 100);
        }
    } else {
        triggerButton.attr('aria-expanded', 'false');
        if (currentFocusTrap) {
            try { currentFocusTrap.deactivate(); } catch (e) {}
            currentFocusTrap = null;
        }
        triggerButton.trigger('focus');
    }
}

/**
 * Core function to enhance specific complex DOM elements (Chat, Inputs, Drawers).
 */
const enhanceSpecificA11y = () => {
    // A. Chat Message Refactoring
    $('#chat .mes').each(function () {
        const $mes = $(this);
        if ($mes.hasClass('a11y-refactored')) return;
        const charName = $mes.find('.name_text').text() || 'System';
        const isUser = $mes.attr('is_user') === 'true';
        const textContent = $mes.find('.mes_text').text().trim();

        $mes.attr({
            'role': 'article',
            'aria-label': `${isUser ? 'You' : charName}: ${textContent}`,
            'tabindex': '0',
        }).addClass('a11y-refactored');

        $mes.find('.mesIDDisplay, .extraMesButtons, .drag-handle, .swipes-counter, .mes_timer, .timestamp').attr('aria-hidden', 'true');
    });

    // B. Standard Input Labeling (Auto-association)
    // Expanded selectors to catch items in range-blocks and inline-drawers
    $('input:not([type="range"]), textarea, select').each(function () {
        const $el = $(this);
        if ($el.is('[type="hidden"]')) return;
        
        let id = $el.attr('id');
        if (!id) {
            id = 'st-a11y-' + Math.random().toString(36).substr(2, 5);
            $el.attr('id', id);
        }

        const $container = $el.closest('.range-block, .flex-container, .completion_prompt_manager_popup_entry_form_control, .world_entry_form_control, .inline-drawer-content');
        if (!$container.length) return;

        // Enhanced label finding: Looks for 'justifyLeft' used in Extensions settings
        let $title = $container.find('label, h4, .range-block-title, b, .justifyLeft').first();
        if ($el.parent('label').length) $title = $el.parent('label').find('span').first();
        
        if ($title.length && !$el.attr('aria-labelledby')) {
            const titleId = $title.attr('id') || 'label-' + id;
            $title.attr('id', titleId);
            $el.attr('aria-labelledby', titleId);
        }

        const $desc = $container.find('.text_muted, .toggle-description, small.flexBasis100p').first();
        if ($desc.length && !$el.attr('aria-describedby')) {
            const descId = $desc.attr('id') || 'desc-' + id;
            $desc.attr('id', descId);
            $el.attr('aria-describedby', descId);
        }

        if ($el.is('[type="number"]')) {
            $el.attr('role', 'spinbutton');
            const min = $el.attr('min'), max = $el.attr('max');
            if (min !== undefined) $el.attr('aria-valuemin', min);
            if (max !== undefined) $el.attr('aria-valuemax', max);
        }
    });

    // C. Inline Drawers (Extensions, Settings)
    $('.inline-drawer').each(function () {
        const $drawer = $(this);
        const $header = $drawer.children('.inline-drawer-toggle'); // Specifically direct child to avoid nesting issues
        const $content = $drawer.children('.inline-drawer-content');
        const $icon = $header.find('.inline-drawer-icon');

        if (!$content.length || !$header.length) return;

        let contentId = $content.attr('id');
        if (!contentId) {
            contentId = 'drawer-' + Math.random().toString(36).substr(2, 6);
            $content.attr('id', contentId);
        }

        const isExpanded = $content.is(':visible');

        // Make the header the interactive button
        $header.attr({
            'role': 'button',
            'tabindex': '0',
            'aria-expanded': isExpanded ? 'true' : 'false',
            'aria-controls': contentId
        });

        // Hide the icon from focus order since the header handles it
        $icon.attr({
            'aria-hidden': 'true',
            'tabindex': '-1'
        }).removeAttr('role');

        // Associate label if header contains text
        const $title = $header.find('b, strong, span').first();
        if ($title.length) {
            const titleId = $title.attr('id') || 'title-' + contentId;
            $title.attr('id', titleId);
            $header.attr('aria-labelledby', titleId);
        }
    });

    // D. Range Sliders (Smart Hide)
    // Only hide sliders from tab order if they are paired with a number input (SillyTavern pattern)
    // Otherwise, keep them focusable so keyboard users can adjust them.
    $('input[type="range"]').each(function() {
        const $el = $(this);
        const hasSiblingNumber = $el.siblings('input[type="number"]').length > 0 || 
                                 $el.closest('.range-block-range-and-counter').find('input[type="number"]').length > 0;
        
        if (hasSiblingNumber) {
            $el.attr({ 'tabindex': '-1', 'aria-hidden': 'true' });
        } else {
            $el.removeAttr('tabindex aria-hidden'); // Ensure standalone sliders are accessible
        }
    });

    // E. Prompt Manager List
    $('.completion_prompt_manager_prompt').each(function () {
        const $li = $(this);
        const promptId = $li.attr('data-pm-identifier');
        const itemName = $li.find('.completion_prompt_manager_prompt_name').text().trim() || 'Prompt';
        $li.find('.drag-handle').attr('aria-hidden', 'true');
        $li.find('.prompt-manager-inspect-action').attr({
            'role': 'button',
            'tabindex': '0',
            'aria-label': 'Inspect: ' + itemName
        });

        $li.find('.prompt_manager_prompt_controls span').each(function () {
            const $btn = $(this);
            const actionClass = ['.prompt-manager-toggle-action', '.prompt-manager-edit-action', '.prompt-manager-detach-action'].find(cls => $btn.is(cls));
            if (actionClass) {
                const actionTitle = $btn.attr('title') || 'Action';
                $btn.attr({
                    'role': 'button',
                    'tabindex': '0',
                    'aria-label': `${actionTitle}: ${itemName}`
                });
                if ($btn.hasClass('prompt-manager-toggle-action')) {
                    $btn.attr('aria-pressed', $btn.hasClass('fa-toggle-on') ? 'true' : 'false');
                }
                if (lastActivePromptId === promptId && lastActivePromptAction === actionClass) {
                    setTimeout(() => {
                        $btn.trigger('focus');
                        lastActivePromptId = null;
                        lastActivePromptAction = null;
                    }, 100);
                }
            } else {
                $btn.attr('tabindex', '-1').attr('aria-hidden', 'true');
            }
        });
    });

    // F. World Info Entries
    $('.world_entry').each(function () {
        const $entry = $(this);
        const uid = $entry.attr('uid');
        const title = $entry.find('textarea[name="comment"]').val() || 'Untitled Entry';

        const $killSwitch = $entry.find('.killSwitch');
        $killSwitch.attr({
            'role': 'button',
            'tabindex': '0',
            'aria-label': `Enable/Disable: ${title}`,
            'aria-pressed': $killSwitch.hasClass('fa-toggle-on') ? 'true' : 'false',
        });

        if (lastActiveWIUid === uid && document.activeElement !== $killSwitch[0]) {
            setTimeout(() => {
                $killSwitch.trigger('focus');
                lastActiveWIUid = null;
            }, 50);
        }

        const $drawerIcon = $entry.find('.inline-drawer-toggle');
        const isExpanded = $entry.find('.inline-drawer-content').is(':visible');
        $drawerIcon.attr({
            'role': 'button',
            'tabindex': '0',
            'aria-label': `${isExpanded ? 'Collapse' : 'Expand'}: ${title}`,
            'aria-expanded': isExpanded ? 'true' : 'false',
        });

        $entry.find('.menu_button').attr({
            'role': 'button',
            'tabindex': '0'
        });
    });

    // G. General Interface Buttons
    $('#character_popup .editor_maximize').attr({
        'role': 'button',
        'tabindex': '0',
        'aria-label': 'Expand Full Editor'
    });
    $('#character_cross').attr({
        'role': 'button',
        'tabindex': '0',
        'aria-label': 'Close'
    });
};

/**
 * Manages focus traps for various popups.
 */
const managePopupTraps = () => {
    if (!focusTrap) return;

    // A. Character Advanced Definitions Popup
    const $charPopup = $('#character_popup');
    if ($charPopup.is(':visible') && $charPopup.hasClass('open')) {
        if (!charPopupTrap) {
            lastFocusedBeforeTrap = document.activeElement;
            charPopupTrap = focusTrap.createFocusTrap('#character_popup', {
                allowOutsideClick: true,
                fallbackFocus: '#character_popup_ok',
                onDeactivate: () => {
                    if (lastFocusedBeforeTrap instanceof HTMLElement) lastFocusedBeforeTrap.focus();
                },
            });
            try { charPopupTrap.activate(); } catch (e) {}
        }
    } else if (charPopupTrap) {
        try { charPopupTrap.deactivate(); } catch (e) {}
        charPopupTrap = null;
    }

    // B. Prompt Manager
    const $promptPopup = $('#completion_prompt_manager_popup');
    const isPromptActive = $promptPopup.is(':visible') && ($('#completion_prompt_manager_popup_edit').is(':visible') || $('#completion_prompt_manager_popup_inspect').is(':visible'));
    if (isPromptActive) {
        if (!promptManagerTrap) {
            lastFocusedBeforeTrap = document.activeElement;
            promptManagerTrap = focusTrap.createFocusTrap('#completion_prompt_manager_popup', {
                allowOutsideClick: true,
                initialFocus: '#completion_prompt_manager_popup_close_button',
                onDeactivate: () => {
                    if (lastFocusedBeforeTrap instanceof HTMLElement) lastFocusedBeforeTrap.focus();
                },
            });
            try { promptManagerTrap.activate(); } catch (e) {}
        }
    } else if (promptManagerTrap) {
        try { promptManagerTrap.deactivate(); } catch (e) {}
        promptManagerTrap = null;
    }

    // C. World Info
    const $expandedWI = $('#world_popup_entries_list .world_entry .inline-drawer-content:visible').closest('.world_entry');
    if ($expandedWI.length === 1) {
        const currentUid = $expandedWI.attr('uid');
        if (!worldInfoTrap || worldInfoTrapUid !== currentUid) {
            if (worldInfoTrap) try { worldInfoTrap.deactivate(); } catch (e) {}
            worldInfoTrap = focusTrap.createFocusTrap($expandedWI.find('.world_entry_form')[0], {
                allowOutsideClick: true,
                clickOutsideDeactivates: false,
                initialFocus: false,
                escapeDeactivates: false,
            });
            worldInfoTrapUid = currentUid;
            try { worldInfoTrap.activate(); } catch (e) {}
        }
    } else if (worldInfoTrap) {
        try { worldInfoTrap.deactivate(); } catch (e) {}
        worldInfoTrap = null;
        worldInfoTrapUid = null;
    }
};

const trapFocusInChat = (e) => {
    if (e.key !== 'Tab') return;
    if ($('.openDrawer, .popup, #character_popup.open').is(':visible')) return;

    const selectors = ['#chat .mes', '#options_button', '#extensionsMenuButton', '#send_textarea', '#mes_stop'].join(', ');
    const $items = $(selectors).filter(':visible');
    if (!$items.length) return;

    const first = $items.first()[0];
    const last = $items.last()[0];

    if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {
        e.preventDefault();
        first.focus();
    }
};

export function initAccessibility() {
    // 1. Initial Static Cleanups
    // Send button always hidden from tab order (accessed via hotkey or virtual cursor)
    $('#send_but').attr({
        'tabindex': '-1',
        'aria-hidden': 'true'
    });

    // 2. Global Event Bindings
    // Handle Enter/Space for elements with role="button"
    $(document).on('keydown', '[role="button"][tabindex="0"], .prompt-manager-toggle-action, .killSwitch, .inline-drawer-toggle', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            // Prevent double-firing if the element is natively a button
            if (this.tagName !== 'BUTTON') {
                $(this).trigger('click');
            }
        }
    });

    eventSource.on(event_types.GENERATION_STARTED, (type) => {
        if (type === 'quiet') return;
        isAiGenerating = true;
        announceA11y('AI is generating response...');
        setTimeout(() => {
            document.getElementById('mes_stop')?.focus();
        }, 50);
    });

    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (mid) => {
        isAiGenerating = false;
        const msg = /** @type {any} */ (chat[mid]);
        if (msg) announceA11y(`AI has replied: ${msg.mes}`);
        $('#send_textarea').trigger('focus');
    });

    eventSource.on(event_types.GENERATION_STOPPED, () => {
        isAiGenerating = false;
        announceA11y('AI generation stopped.');
        $('#send_textarea').trigger('focus');
    });

    const sheldEl = document.getElementById('sheld');
    if (sheldEl) sheldEl.addEventListener('keydown', trapFocusInChat);

    window.addEventListener('beforeunload', (e) => {
        if (isChatSaving || (typeof this_edit_mes_id === 'number' && this_edit_mes_id >= 0)) {
            e.preventDefault();
            e.returnValue = true;
        }
    });

    // 3. Initial Execution
    applyGenericA11yRules(document.body);
    enhanceSpecificA11y();

    // 4. Mutation Observer
    const processA11yUpdates = debounce(() => {
        applyGenericA11yRules(document.body);
        enhanceSpecificA11y();
        managePopupTraps();

        // Re-apply send button hide
        $('#send_but').attr({ 'tabindex': '-1', 'aria-hidden': 'true' });

        if (isAiGenerating) {
            const stopBtn = document.getElementById('mes_stop');
            if (stopBtn && document.activeElement !== stopBtn && stopBtn.offsetParent !== null) {
                stopBtn.focus();
            }
        }
    }, 250);

    const mainObserver = new MutationObserver((_mutations, _observer) => {
        processA11yUpdates();
    });

    mainObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'hidden'],
    });
}
