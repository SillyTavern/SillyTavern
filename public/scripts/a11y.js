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
// Import Popup System
import { callGenericPopup, POPUP_TYPE, POPUP_RESULT, Popup } from './popup.js';

// ============================================================================
// DEBUGGING UTILITIES
// ============================================================================
const DEBUG_FOCUS = true;

/**
 * Logs a message with a timestamp and prefix for filtering.
 * @param {string} location - Function or area where log originated
 * @param {string} message - The message
 * @param {any} [data] - Optional data object
 */
function logDebug(location, message, data = null) {
    if (!DEBUG_FOCUS) return;
    const time = new Date().toISOString().split('T')[1].slice(0, -1);
    if (data) {
        console.log(`%c[A11y][${time}][${location}] ${message}`, 'color: #00bcd4; font-weight: bold;', data);
    } else {
        console.log(`%c[A11y][${time}][${location}] ${message}`, 'color: #00bcd4; font-weight: bold;');
    }
}

// ============================================================================
// PART 1: LEGACY A11Y LOGIC (PRESERVED & EXPANDED)
// Defines generic roles for lists, buttons, tabs, etc.
// ============================================================================

const buttonSelectors = [
    '.menu_button',
    '.right_menu_button',
    '.mes_button',
    '.drawer-icon',
    '.swipe_left',
    '.swipe_right',
    '.character_select',
    '.tags .tag',
    '.jg-menu .jg-button',
    '.bg_example .mobile-only-menu-toggle',
    '.paginationjs-pages li a',
    '.inline-drawer-toggle',
    '.qr--action',
    '.prompt-manager-a11y-sort' // Added sort button
].join(', ');

const listSelectors = [
    '.options-content',
    '.list-group',
    '.list-group-item', // Note: Sometimes used as container
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
    '#completion_prompt_manager_list' // Added Prompt list
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
    '.completion_prompt_manager_prompt' // Added Prompt item
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
// PART 2: PROMPT SORTING LOGIC (FIXED & LOGGED)
// ============================================================================

/**
 * Opens the sort menu.
 * @param {HTMLElement} triggerElement The button that triggered the menu.
 */
async function handlePromptSortMenu(triggerElement) {
    const $li = $(triggerElement).closest('li');
    const $container = $('#completion_prompt_manager_list');
    const $allPrompts = $container.find('.completion_prompt_manager_prompt');
    
    const total = $allPrompts.length;
    const currentIndex = $allPrompts.index($li);
    const displayIndex = currentIndex + 1;

    logDebug('handlePromptSortMenu', `Opening sort menu for item: ${displayIndex}/${total}`);
    announceA11y(`Current position: ${displayIndex} of ${total}. Choose an action.`);

    // 1. Create menu container (using jQuery object to bind events)
    // We add a specific class to identify this popup later in trap logic
    const $menu = $('<div class="list-group a11y-sort-menu" role="menu"></div>');

    // 2. Define menu items
    const actions = [
        { id: 'up', icon: 'fa-arrow-up', text: 'Move Up' },
        { id: 'down', icon: 'fa-arrow-down', text: 'Move Down' },
        { id: 'top', icon: 'fa-angles-up', text: 'Move to Top' },
        { id: 'bottom', icon: 'fa-angles-down', text: 'Move to Bottom' },
        { id: 'jump', icon: 'fa-arrow-right-to-bracket', text: 'Move to Position...' }
    ];

    // 3. Build menu items and bind events directly
    actions.forEach((act, index) => {
        const $item = $(`
            <div class="list-group-item flex-container alignitemscenter interactable" role="menuitem" tabindex="0" data-action="${act.id}">
                <i class="fa-solid ${act.icon} fa-fw"></i> <span>${act.text}</span>
            </div>
        `);

        // Add autofocus tag to the first item for popup.js recognition
        if (index === 0) $item.attr('autofocus', 'true');

        // Bind click and enter key events
        $item.on('click keydown', async function(e) {
            if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
            e.preventDefault();
            e.stopPropagation();

            const action = $(this).data('action');
            logDebug('SortMenu', `Action triggered: ${action}`);

            // Close current popup.
            const $popupDlg = $(this).closest('.popup');
            const popupId = $popupDlg.data('id');
            const popupInstance = Popup.util.popups.find(p => p.id === popupId);
            
            if (popupInstance) {
                logDebug('SortMenu', `Closing popup ID: ${popupId}`);
                await popupInstance.complete(POPUP_RESULT.AFFIRMATIVE);
            }

            // Execute actual action (delayed slightly to ensure smooth popup closing animation)
            setTimeout(() => {
                if (action === 'jump') {
                    handleJumpAction($li);
                } else {
                    performSortAction($li, action);
                }
            }, 50);
        });

        $menu.append($item);
    });

    // 4. Show popup.
    logDebug('SortMenu', 'Calling generic popup...');
    
    // Attempt to temporarily pause Prompt Manager trap if it exists
    if (promptManagerTrap) {
        logDebug('SortMenu', 'Pausing PromptManager trap before opening sort menu.');
        try { promptManagerTrap.pause(); } catch (e) { console.warn(e); }
    }

    await callGenericPopup($menu, POPUP_TYPE.TEXT, '', { 
        okButton: 'Close',
        wide: false,
        allowVerticalScrolling: true,
        onOpen: (popup) => {
            logDebug('SortMenu', 'Popup opened (callback). Forcing focus to first item.');
            // Force focus on the first menu item to fix focus locking issues.
            const firstItem = $(popup.content).find('.list-group-item').first();
            if (firstItem.length) {
                firstItem.trigger('focus');
            } else {
                logDebug('SortMenu', 'Could not find first item to focus.');
            }
        },
        onClose: () => {
             logDebug('SortMenu', 'Popup closed.');
             // Note: Re-activation of prompt manager trap is handled by the Observer
        }
    });
}

/**
 * Handles jumping to a specific position.
 * @param {JQuery<HTMLElement>} $item 
 */
async function handleJumpAction($item) {
    const $container = $('#completion_prompt_manager_list');
    const max = $container.find('.completion_prompt_manager_prompt').length;
    
    logDebug('JumpAction', `Requesting input 1-${max}`);

    const input = await callGenericPopup(
        `Enter new position (1-${max}):`, 
        POPUP_TYPE.INPUT, 
        '',
        { okButton: 'Move' }
    );
    
    if (input) {
        const targetPos = parseInt(String(input));
        if (!isNaN(targetPos) && targetPos >= 1 && targetPos <= max) {
            logDebug('JumpAction', `Jumping to ${targetPos}`);
            performSortAction($item, 'jump', targetPos - 1); 
        } else {
            announceA11y("Invalid position number.");
            $item.find('.prompt-manager-a11y-sort').trigger('focus');
        }
    } else {
        logDebug('JumpAction', 'Cancelled or empty input. Returning focus.');
        $item.find('.prompt-manager-a11y-sort').trigger('focus');
    }
}

/**
 * Performs the move and saves.
 * @param {JQuery<HTMLElement>} $item 
 * @param {string} action 
 * @param {number|null} targetIndex 
 */
function performSortAction($item, action, targetIndex = null) {
    const $container = $('#completion_prompt_manager_list');
    const $allPrompts = $container.find('.completion_prompt_manager_prompt');
    const currentIndex = $allPrompts.index($item);
    let newIndex = currentIndex;
    let changed = false;

    logDebug('SortAction', `Performing sort. Action: ${action}, Current: ${currentIndex}`);

    // 1. Move DOM
    if (action === 'up') {
        if (currentIndex > 0) {
            $item.insertBefore($allPrompts.eq(currentIndex - 1));
            newIndex = currentIndex - 1;
            changed = true;
        }
    } else if (action === 'down') {
        if (currentIndex < $allPrompts.length - 1) {
            $item.insertAfter($allPrompts.eq(currentIndex + 1));
            newIndex = currentIndex + 1;
            changed = true;
        }
    } else if (action === 'top') {
        if (currentIndex > 0) {
            $item.insertBefore($allPrompts.first());
            newIndex = 0;
            changed = true;
        }
    } else if (action === 'bottom') {
        if (currentIndex < $allPrompts.length - 1) {
            $item.insertAfter($allPrompts.last());
            newIndex = $allPrompts.length - 1;
            changed = true;
        }
    } else if (action === 'jump' && targetIndex !== null) {
        if (targetIndex !== currentIndex) {
            if (targetIndex <= 0) {
                $item.insertBefore($allPrompts.first());
                newIndex = 0;
            } else if (targetIndex >= $allPrompts.length - 1) {
                $item.insertAfter($allPrompts.last());
                newIndex = $allPrompts.length - 1;
            } else {
                const $target = $allPrompts.eq(targetIndex);
                if (targetIndex > currentIndex) {
                    $item.insertAfter($target);
                } else {
                    $item.insertBefore($target);
                }
                newIndex = targetIndex;
            }
            changed = true;
        }
    }

    if (changed) {
        logDebug('SortAction', 'DOM moved. Triggering sortable update.');
        
        // 2. Critical Step: Sync jQuery UI Sortable state and trigger save
        if ($container.data('ui-sortable')) {
            /** @type {any} */ ($container).sortable('refresh');
            $container.trigger('sortupdate'); 
        } else {
            console.warn('[A11y] Warning: sortable instance not found on list container.');
        }

        announceA11y(`Moved. New position: ${newIndex + 1}.`);
    } else {
        announceA11y('Position not changed.');
    }

    // 3. Refocus
    // Small timeout to ensure DOM is settled and other observers have run
    setTimeout(() => {
        const $triggerBtn = $item.find('.prompt-manager-a11y-sort');
        logDebug('SortAction', 'Restoring focus to sort button', $triggerBtn[0]);
        $triggerBtn.trigger('focus');
    }, 100);
}


// ============================================================================
// PART 3: ADVANCED INTERACTIVE LOGIC (NEW)
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

    // B. Standard Input Labeling
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

    // C. Inline Drawers
    $('.inline-drawer').each(function () {
        const $drawer = $(this);
        const $header = $drawer.children('.inline-drawer-toggle');
        const $content = $drawer.children('.inline-drawer-content');
        const $icon = $header.find('.inline-drawer-icon');

        if (!$content.length || !$header.length) return;

        let contentId = $content.attr('id');
        if (!contentId) {
            contentId = 'drawer-' + Math.random().toString(36).substr(2, 6);
            $content.attr('id', contentId);
        }

        const isExpanded = $content.is(':visible');

        $header.attr({
            'role': 'button',
            'tabindex': '0',
            'aria-expanded': isExpanded ? 'true' : 'false',
            'aria-controls': contentId
        });

        $icon.attr({
            'aria-hidden': 'true',
            'tabindex': '-1'
        }).removeAttr('role');

        const $title = $header.find('b, strong, span').first();
        if ($title.length) {
            const titleId = $title.attr('id') || 'title-' + contentId;
            $title.attr('id', titleId);
            $header.attr('aria-labelledby', titleId);
        }
    });

    // D. Range Sliders
    $('input[type="range"]').each(function() {
        const $el = $(this);
        const hasSiblingNumber = $el.siblings('input[type="number"]').length > 0 || 
                                 $el.closest('.range-block-range-and-counter').find('input[type="number"]').length > 0;
        
        if (hasSiblingNumber) {
            $el.attr({ 'tabindex': '-1', 'aria-hidden': 'true' });
        } else {
            $el.removeAttr('tabindex aria-hidden');
        }
    });

    // E. Prompt Manager List (Dynamic Injection of Sort Button)
    $('.completion_prompt_manager_prompt').each(function () {
        const $li = $(this);
        const promptId = $li.attr('data-pm-identifier');
        const itemName = $li.find('.completion_prompt_manager_prompt_name').text().trim() || 'Prompt';
        
        // Hide original drag handle
        $li.find('.drag-handle').attr('aria-hidden', 'true');
        
        $li.find('.prompt-manager-inspect-action').attr({
            'role': 'button',
            'tabindex': '0',
            'aria-label': 'Inspect: ' + itemName
        });

        // 1. Dynamically inject sort button (if it doesn't exist)
        const $controls = $li.find('.prompt_manager_prompt_controls');
        if ($controls.length && $controls.find('.prompt-manager-a11y-sort').length === 0) {
            // Create button
            const $sortBtn = $('<span>', {
                class: 'prompt-manager-a11y-sort fa-solid fa-sort fa-xs',
                role: 'button',
                tabindex: '0',
                title: 'Sort / Move'
            });
            // Prepend to controls
            $controls.prepend($sortBtn);
            
            // Bind event to new button
            $sortBtn.on('click keydown', function(e) {
                if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                e.stopPropagation();
                handlePromptSortMenu(this);
            });
        }

        // 2. Update sort button position information
        const $sortBtn = $li.find('.prompt-manager-a11y-sort');
        if ($sortBtn.length) {
            const $container = $('#completion_prompt_manager_list');
            const $allPrompts = $container.find('.completion_prompt_manager_prompt');
            const index = $allPrompts.index($li) + 1;
            const total = $allPrompts.length;
            $sortBtn.attr('aria-label', `Sort ${itemName}. Current position ${index} of ${total}`);
        }

        // Handle other control buttons
        $li.find('.prompt_manager_prompt_controls span').not('.prompt-manager-a11y-sort').each(function () {
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
            logDebug('TrapManager', 'Creating Character Popup Trap');
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
        logDebug('TrapManager', 'Deactivating Character Popup Trap');
        try { charPopupTrap.deactivate(); } catch (e) {}
        charPopupTrap = null;
    }

    // B. Prompt Manager
    const $promptPopup = $('#completion_prompt_manager_popup');
    // Check if main Prompt Manager UI is active
    const isPromptActive = $promptPopup.is(':visible') && ($('#completion_prompt_manager_popup_edit').is(':visible') || $('#completion_prompt_manager_popup_inspect').is(':visible'));
    
    // CRITICAL: Check if a Generic Popup (like Sort Menu) is currently overriding it
    // The sort menu is usually a .list-group with role="menu" inside a .popup
    const isSortMenuOpen = $('.list-group[role="menu"]').is(':visible');

    if (isPromptActive) {
        if (isSortMenuOpen) {
            // If sort menu is open, we MUST pause or prevent the prompt trap
            logDebug('TrapManager', 'Conflict detected: Prompt Manager active BUT Sort Menu is Open. Skipping trap enforcement.');
            if (promptManagerTrap) {
                try { 
                    logDebug('TrapManager', 'Pausing existing Prompt Manager Trap');
                    promptManagerTrap.pause(); 
                } catch (e) {}
            }
        } else {
            // Normal Prompt Manager behavior
            if (!promptManagerTrap) {
                logDebug('TrapManager', 'Creating Prompt Manager Trap');
                lastFocusedBeforeTrap = document.activeElement;
                promptManagerTrap = focusTrap.createFocusTrap('#completion_prompt_manager_popup', {
                    allowOutsideClick: true,
                    initialFocus: '#completion_prompt_manager_popup_close_button',
                    onDeactivate: () => {
                        logDebug('TrapManager', 'Prompt Manager Trap Deactivated');
                        if (lastFocusedBeforeTrap instanceof HTMLElement) lastFocusedBeforeTrap.focus();
                    },
                });
                try { promptManagerTrap.activate(); } catch (e) {}
            } else {
                // Ensure it is unpaused if menu closed
                try { promptManagerTrap.unpause(); } catch (e) {}
            }
        }
    } else if (promptManagerTrap) {
        logDebug('TrapManager', 'Deactivating Prompt Manager Trap (UI hidden)');
        try { promptManagerTrap.deactivate(); } catch (e) {}
        promptManagerTrap = null;
    }

    // C. World Info
    const $expandedWI = $('#world_popup_entries_list .world_entry .inline-drawer-content:visible').closest('.world_entry');
    if ($expandedWI.length === 1) {
        const currentUid = $expandedWI.attr('uid');
        if (!worldInfoTrap || worldInfoTrapUid !== currentUid) {
            if (worldInfoTrap) try { worldInfoTrap.deactivate(); } catch (e) {}
            logDebug('TrapManager', 'Creating WI Trap');
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
    $('#send_but').attr({
        'tabindex': '-1',
        'aria-hidden': 'true'
    });

    // 2. Global Event Bindings
    $(document).on('keydown', '[role="button"][tabindex="0"], .prompt-manager-toggle-action, .killSwitch, .inline-drawer-toggle', function (e) {
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (this.tagName !== 'BUTTON') {
                $(this).trigger('click');
            }
        }
    });

    // Debug listener for global focus changes
    if (DEBUG_FOCUS) {
        document.addEventListener('focusin', (e) => {
            const id = e.target.id || 'no-id';
            const cls = e.target.className || 'no-class';
            logDebug('GlobalFocus', `Focus moved to: <${e.target.tagName} id="${id}" class="${cls}">`);
        });
    }

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
        logDebug('Observer', 'Processing Updates (Debounced)');
        applyGenericA11yRules(document.body);
        enhanceSpecificA11y();
        managePopupTraps();

        $('#send_but').attr({ 'tabindex': '-1', 'aria-hidden': 'true' });

        if (isAiGenerating) {
            const stopBtn = document.getElementById('mes_stop');
            if (stopBtn && document.activeElement !== stopBtn && stopBtn.offsetParent !== null) {
                stopBtn.focus();
            }
        }
    }, 250);

    const mainObserver = new MutationObserver((mutations) => {
        // Optional: filter mutations to reduce log spam
        // logDebug('Observer', `Mutation detected: ${mutations.length} changes`);
        processA11yUpdates();
    });

    mainObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'hidden'],
    });
}
