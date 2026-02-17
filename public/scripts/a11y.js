import {
    chat,
    isChatSaving,
    this_edit_mes_id,
} from '../script.js';
import {
    debounce,
} from './utils.js';
import {
    eventSource,
    event_types,
} from './events.js';
import {
    focusTrap,
} from '../lib.js';
// Import Popup System
import { callGenericPopup, POPUP_TYPE } from './popup.js';

// ============================================================================
// GLOBAL STATE & CONFIGURATION
// ============================================================================

/** @type {boolean} Global flag indicating if accessibility enhancements are active. */
let isA11yEnabled = true;

/** @type {MutationObserver|null} Observes DOM changes to apply A11y rules dynamically. */
let mainObserver = null;

/** @type {string|null} CSS selector to restore focus to after a specific action completes. */
let focusRestoreSelector = null;

// ============================================================================
// DEBUGGING UTILITIES
// ============================================================================

const DEBUG_FOCUS = false;

/**
 * Logs a message with a timestamp and prefix for filtering.
 * Used primarily for debugging focus transitions and trap activations.
 *
 * @param {string} location - Function name or code area where log originated.
 * @param {string} message - The log message.
 * @param {any} [data] - Optional data object to inspect.
 */
function logDebug(location, message, data = null) {
    if (!DEBUG_FOCUS) return;
    const time = new Date().toISOString().split('T')[1].slice(0, -1);
    const css = 'color: #00bcd4; font-weight: bold;';

    if (data) {
        console.log(`%c[A11y][${time}][${location}] ${message}`, css, data);
    } else {
        console.log(`%c[A11y][${time}][${location}] ${message}`, css);
    }
}

// ============================================================================
// SECTION 1: ELEMENT SELECTORS
// Defines CSS selectors for common UI elements to apply generic ARIA roles.
// ============================================================================

/** Selectors for elements that function as buttons but might be <div> or <span> tags. */
const buttonSelectors = [
    '.menu_button',
    '.right_menu_button',
    '.killSwitch',
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
    '.a11y-sort-button',
    '.extensions_toolbar button',
].join(', ');

/** Selectors for containers that should be treated as lists (aria-role="list"). */
const listSelectors = [
    '.options-content',
    '.list-group',
    '.list-group-item',         // Edge case: sometimes used as a container
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
    '#completion_prompt_manager_list',
    '.regex-debugger-rules-list ul',
    '.regex-script-container',
].join(', ');

/** Selectors for individual items within a list (aria-role="listitem"). */
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
    '.qr--item',
    '.qr--set-item',
    '.completion_prompt_manager_prompt',
    '.regex-debugger-rule',
    '.regex-script-label',
    '.extension_block',
].join(', ');

/** Selectors for toolbar containers. */
const toolbarSelectors = [
    '.jg-menu',
    '.qr--head',
    '.regex_bulk_operations',
    '.extensions_toolbar',
].join(', ');

/** Selectors for tab containers. */
const tabListSelectors = [
    '#bg_tabs .bg_tabs_list',
].join(', ');

/** Selectors for individual tabs. */
const tabItemSelectors = [
    '#bg_tabs .bg_tabs_list .bg_tab_button',
].join(', ');

// ============================================================================
// SECTION 2: GENERIC PROCESSORS & REGISTRY
// System for applying standard ARIA roles to the selectors defined above.
// ============================================================================

// OPTIMIZATION: Attributes used to mark processing state.
// GENERIC_ATTR prevents re-applying basic roles (list, button) repeatedly.
const GENERIC_ATTR = 'data-a11y-generic';

/**
 * Standard processor functions for common accessibility roles.
 * These apply the basic ARIA role and tabindex if missing.
 * Can be referenced by extensions via `registerA11ySelector`.
 */
export const a11yProcessors = {
    button: (element) => {
        if (!element.hasAttribute('role')) element.setAttribute('role', 'button');
        // Ensure element is keyboard focusable if it's not natively interactive
        if (!element.hasAttribute('tabindex') && element.tagName !== 'BUTTON' && element.tagName !== 'A') {
            element.setAttribute('tabindex', '0');
        }
    },
    list: (element) => {
        if (!element.hasAttribute('role')) element.setAttribute('role', 'list');
    },
    listItem: (element) => {
        if (!element.hasAttribute('role')) element.setAttribute('role', 'listitem');
        if (element.hasAttribute('tabindex') && element.getAttribute('tabindex') === '0' && (
            element.classList.contains('completion_prompt_manager_prompt') ||
            element.classList.contains('qr--item') ||
            element.classList.contains('regex-script-label') ||
            element.classList.contains('list-group-item')
        )) {
            element.removeAttribute('tabindex');
        }
    },
    toolbar: (element) => {
        if (!element.hasAttribute('role')) element.setAttribute('role', 'toolbar');
    },
    tabList: (element) => {
        if (!element.hasAttribute('role')) element.setAttribute('role', 'tablist');
    },
    tab: (element) => {
        if (!element.hasAttribute('role')) element.setAttribute('role', 'tab');
    },
    status: (element) => {
        if (!element.hasAttribute('role')) element.setAttribute('role', 'status');
    },
};

/**
 * Registry mapping CSS selector strings to processor functions.
 * @type {Map<string, (element: Element) => void>}
 */
const a11yRegistry = new Map();

// Initialize registry with default internal rules
a11yRegistry.set(buttonSelectors, a11yProcessors.button);
a11yRegistry.set(listSelectors, a11yProcessors.list);
a11yRegistry.set(listItemSelectors, a11yProcessors.listItem);
a11yRegistry.set(toolbarSelectors, a11yProcessors.toolbar);
a11yRegistry.set(tabListSelectors, a11yProcessors.tabList);
a11yRegistry.set(tabItemSelectors, a11yProcessors.tab);
a11yRegistry.set('#toast-container .toast', a11yProcessors.status);

/**
 * Registers a new accessibility rule for a CSS selector.
 * Allows external scripts or extensions to add accessibility support to their UI.
 *
 * @param {string} selector - CSS selector to match elements.
 * @param {((element: Element) => void) | string} processor - Callback function or a string key of a default processor ('button', 'list', etc.).
 */
export function registerA11ySelector(selector, processor) {
    /** @type {(element: Element) => void} */
    let finalProcessor;

    if (typeof processor === 'string') {
        if (a11yProcessors[processor]) {
            finalProcessor = a11yProcessors[processor];
        } else {
            console.warn(`[A11y] Unknown processor type: ${processor}. Defaulting to no-op.`);
            return;
        }
    } else if (typeof processor === 'function') {
        finalProcessor = processor;
    } else {
        console.warn('[A11y] Processor must be a function or a valid processor key.');
        return;
    }

    a11yRegistry.set(selector, finalProcessor);

    // If A11y is currently enabled, apply the new rule immediately
    if (isA11yEnabled) {
        try {
            document.querySelectorAll(selector).forEach((el) => {
                if (!el.hasAttribute(GENERIC_ATTR)) {
                    finalProcessor(el);
                    el.setAttribute(GENERIC_ATTR, 'true');
                }
            });
        } catch (e) {
            console.warn(`[A11y] Failed to apply new rule for selector "${selector}":`, e);
        }
    }
}

/**
 * Applies generic accessibility rules to an element and its children based on the registry.
 * Optimized to skip elements that have already been processed.
 *
 * @param {Element} rootElement - The root DOM element to scan (e.g., document.body or a newly added node).
 */
function applyGenericA11yRules(rootElement) {
    try {
        // Case 1: The root element itself is new and matches a generic rule
        if (rootElement.nodeType === 1 && !rootElement.hasAttribute(GENERIC_ATTR)) {
            for (const [selector, rule] of a11yRegistry.entries()) {
                if (rootElement.matches(selector)) {
                    rule(rootElement);
                    rootElement.setAttribute(GENERIC_ATTR, 'true');
                }
            }
        }

        // Case 2: Process children of the root element
        for (const [selector, rule] of a11yRegistry.entries()) {
            const elements = rootElement.querySelectorAll(selector);
            for (let i = 0; i < elements.length; i++) {
                const el = elements[i];
                if (!el.hasAttribute(GENERIC_ATTR)) {
                    rule(el);
                    el.setAttribute(GENERIC_ATTR, 'true');
                }
            }
        }
    } catch (error) {
        console.error('Error applying accessibility rules:', error);
    }
}

// ============================================================================
// SECTION 3: GENERALIZED SORTING LOGIC
// ============================================================================
/*
 * Provides a keyboard-accessible alternative to Drag-and-Drop sorting.
 * Opens a popup menu allowing users to Move Up, Move Down, Jump to position, etc.
 */

/**
 * Opens the generic sort menu for a list item.
 * Fixes: ESC key requiring multiple presses, focus loss on close.
 */
async function handleSortMenu(triggerElement, itemSelector, containerSelector) {
    const $trigger = $(triggerElement);
    const $li = $trigger.closest(itemSelector);
    const $container = $li.closest(containerSelector);

    // Logic to calculate position based solely on items (ignoring scripts/hidden inputs)
    const $allItems = $container.children(itemSelector);
    const total = $allItems.length;
    const currentIndex = $allItems.index($li);
    const displayIndex = currentIndex + 1;

    let itemName = $li.find('.completion_prompt_manager_prompt_name, .qr--set option:selected, .qr--set-itemLabel, .regex_script_name').first().val() ||
                   $li.find('.completion_prompt_manager_prompt_name, .qr--set option:selected, .qr--set-itemLabel, .regex_script_name').first().text() ||
                   'Item';
    itemName = String(itemName).trim();

    // 1. Pause existing traps to prevent conflict
    if (promptManagerTrap) try { promptManagerTrap.pause(); } catch (e) { /* ignore error */ }
    if (qrEditorTrap) try { qrEditorTrap.pause(); } catch (e) { /* ignore error */ }
    if (regexEditorTrap) try { regexEditorTrap.pause(); } catch (e) { /* ignore error */ }

    // 2. Define the popup actions
    const popupPromise = callGenericPopup(
        `<h3>Sort Item</h3><p>Move <b>${itemName}</b> (Position ${displayIndex} of ${total})</p>`,
        POPUP_TYPE.TEXT,
        '',
        {
            okButton: 'Close',
            cancelButton: false,
            wide: true,
            customButtons: [
                {
                    text: 'Move Up',
                    result: 1000,
                    action: () => performGenericSortAction($li, $container, itemSelector, 'up'),
                },
                {
                    text: 'Move Down',
                    result: 1000,
                    action: () => performGenericSortAction($li, $container, itemSelector, 'down'),
                },
                {
                    text: 'To Top',
                    result: 1000,
                    action: () => performGenericSortAction($li, $container, itemSelector, 'top'),
                },
                {
                    text: 'To Bottom',
                    result: 1000,
                    action: () => performGenericSortAction($li, $container, itemSelector, 'bottom'),
                },
                {
                    text: 'Jump to...',
                    result: 1000,
                    action: () => setTimeout(() => handleGenericJumpAction($li, $container, itemSelector), 150),
                },
            ],
        },
    );

    // 3. ESC KEY FIX: Attach a direct listener to the popup immediately
    // Wait a tiny bit for the DOM to render
    setTimeout(() => {
        const $popup = $('.popup:visible').last();
        if ($popup.length) {
            // Force focus to the popup container first to ensure keystrokes are caught
            $popup.attr('tabindex', '-1').focus();

            // Intercept ESC
            $popup.on('keydown.a11ySort', (e) => {
                if (e.key === 'Escape') {
                    e.preventDefault(); // Stop browser from moving focus to "Close" button
                    e.stopPropagation(); // Stop global handlers
                    // Trigger the Close/OK button programmatically
                    $popup.find('.popup-button-ok').trigger('click');
                }
            });
        }
    }, 50);

    try {
        await popupPromise;
    } finally {
        // 4. Cleanup and Restore
        // Remove our custom listener (just in case)
        $('.popup').off('keydown.a11ySort');

        // Unpause traps
        if (promptManagerTrap) try { promptManagerTrap.unpause(); } catch (e) { /* ignore error */ }
        if (qrEditorTrap) try { qrEditorTrap.unpause(); } catch (e) { /* ignore error */ }
        if (regexEditorTrap) try { regexEditorTrap.unpause(); } catch (e) { /* ignore error */ }

        // Restore focus to the trigger button
        setTimeout(() => {
            if ($trigger.closest('body').length) {
                $trigger.trigger('focus');
            } else {
                // If the DOM moved, find the button at the new index
                const $newLi = $container.children(itemSelector).eq(currentIndex);
                $newLi.find('.a11y-sort-button').trigger('focus');
            }
        }, 150);
    }
}

/**
 * Handles the "Jump to Position" action via a numeric input popup.
 *
 * @param {JQuery} $item - The jQuery object of the item being moved.
 * @param {JQuery} $container - The jQuery object of the list container.
 * @param {string} itemSelector - The selector string for items.
 */
async function handleGenericJumpAction($item, $container, itemSelector) {
    const max = $container.children(itemSelector).length;

    logDebug('JumpAction', `Requesting input 1-${max}`);

    const input = await callGenericPopup(
        `Enter new position (1-${max}):`,
        POPUP_TYPE.INPUT,
        '',
        { okButton: 'Move' },
    );

    if (input) {
        const targetPos = parseInt(String(input));
        if (!isNaN(targetPos) && targetPos >= 1 && targetPos <= max) {
            logDebug('JumpAction', `Jumping to ${targetPos}`);
            performGenericSortAction($item, $container, itemSelector, 'jump', targetPos - 1);
        } else {
            announceA11y('Invalid position number.');
            $item.find('.a11y-sort-button').trigger('focus');
        }
    } else {
        logDebug('JumpAction', 'Cancelled. Returning focus.');
        $item.find('.a11y-sort-button').trigger('focus');
    }
}

// eslint-disable-next-line no-unused-vars
function _getA11yItemName($li) {
    const $nameLink = $li.find('.prompt-manager-inspect-action');
    if ($nameLink.length) return $nameLink.text().trim();

    return ($li.find('.completion_prompt_manager_prompt_name, .qr--set-itemLabel, .regex_script_name').first().val() ||
            $li.find('.completion_prompt_manager_prompt_name, .qr--set-itemLabel, .regex_script_name').first().text() ||
            'Item').trim();
}

/**
 * Performs DOM manipulation and handles accessibility announcements.
 * Announces the swap target name and the new position.
 */
function performGenericSortAction($item, $container, itemSelector, action, targetIndex = null) {
    const validSelectors = '.qr--item, .qr--set-item, .completion_prompt_manager_prompt, .regex-script-label, .list-group-item';

    let $allItems = $container.children(validSelectors);
    const total = $allItems.length;
    const currentIndex = $allItems.index($item);

    let changed = false;
    let actionText = '';
    let targetName = '';

    const getA11yName = ($el) => {
        return ($el.find('.completion_prompt_manager_prompt_name, .qr--set option:selected, .qr--set-itemLabel, .regex_script_name').first().val() ||
                $el.find('.completion_prompt_manager_prompt_name, .qr--set option:selected, .qr--set-itemLabel, .regex_script_name').first().text() ||
                'Item').trim();
    };

    if (action === 'up' && currentIndex > 0) {
        const $other = $allItems.eq(currentIndex - 1);
        targetName = getA11yName($other);
        $item.insertBefore($other);
        changed = true;
        actionText = `Swapped with ${targetName}`;
    } else if (action === 'down' && currentIndex < total - 1) {
        const $other = $allItems.eq(currentIndex + 1);
        targetName = getA11yName($other);
        $item.insertAfter($other);
        changed = true;
        actionText = `Swapped with ${targetName}`;
    } else if (action === 'top' && currentIndex > 0) {
        $item.prependTo($container);
        changed = true;
        actionText = 'Moved to top';
    } else if (action === 'bottom' && currentIndex < total - 1) {
        $item.appendTo($container);
        changed = true;
        actionText = 'Moved to bottom';
    } else if (action === 'jump' && targetIndex !== null) {
        if (targetIndex >= 0 && targetIndex < total && targetIndex !== currentIndex) {
            const $target = $allItems.eq(targetIndex);
            targetName = getA11yName($target);
            if (currentIndex < targetIndex) $item.insertAfter($target);
            else $item.insertBefore($target);
            changed = true;
            actionText = `Moved to position ${targetIndex + 1}`;
        }
    }

    if (changed) {
        if ($container.data('ui-sortable')) {
            /** @type {any} */ ($container).sortable('refresh');
        }
        $container.trigger('sortupdate');

        const $newAllItems = $container.children(validSelectors);
        const newIndex = $newAllItems.index($item) + 1;

        const finalMessage = `${actionText}. Position ${newIndex} of ${total}.`;

        const $popup = $('.popup:visible');
        let btnType = '';
        if (action === 'up') btnType = 'Move Up';
        else if (action === 'down') btnType = 'Move Down';
        else if (action === 'top') btnType = 'To Top';
        else if (action === 'bottom') btnType = 'To Bottom';

        if ($popup.length && btnType) {
            const $btn = $popup.find('.popup-button-custom').filter(function () {
                return $(this).text().trim() === btnType;
            });

            if ($btn.length) {
                $btn.attr('aria-label', finalMessage);

                $btn.trigger('focus');

                setTimeout(() => {
                    $btn.removeAttr('aria-label');
                }, 2000);

                return;
            }
        }

        announceA11y(finalMessage, true);
    } else {
        announceA11y('Already at limit.', true);
    }
}

// ============================================================================
// SECTION 4: ADVANCED INTERACTIVE LOGIC & HELPERS
// ============================================================================

// Global variables for managing Focus Traps (referenced in Part 4)
let currentFocusTrap = null;
let promptManagerTrap = null;
let charPopupTrap = null;
let worldInfoTrap = null;
let worldInfoTrapUid = null;
let qrEditorTrap = null;
let regexEditorTrap = null;
let extensionTrap = null;
let extensionsMenuTrap = null;
let optionsMenuTrap = null;
let selectChatTrap = null;
let floatingPromptTrap = null;
let cfgConfigTrap = null;
let logprobsTrap = null;
let dataBankTrap = null;
let tokenCounterTrap = null;
let exportFormatTrap = null;
let extManagerTrap = null;
let apiParamsTrap = null;

// Global state trackers
let lastFocusedBeforeTrap = null;
// eslint-disable-next-line no-unused-vars
let _lastActiveWIUid = null;
let isAiGenerating = false;

/**
 * Announces text to screen readers using a dynamic aria-live region.
 * Uses a "nuclear" approach to ensure the message cuts through all other noise.
 *
 * @param {string} text - The text to announce.
 * @param {boolean} force - If true, uses role="alert" and assertive live region.
 */
export function announceA11y(text, force = false) {
    if (!text) return;
    console.log(`%c[A11y] ${text}`, 'color: #4caf50');

    let announcer = document.getElementById('a11y-announcer');
    if (!announcer) {
        announcer = document.createElement('div');
        announcer.id = 'a11y-announcer';
        // Hide visually but keep available for screen readers
        Object.assign(announcer.style, {
            position: 'absolute', width: '1px', height: '1px', padding: '0',
            margin: '-1px', overflow: 'hidden', clip: 'rect(0, 0, 0, 0)',
            whiteSpace: 'nowrap', border: '0',
        });
        document.body.appendChild(announcer);
    }

    // 1. Clear content to register a change
    announcer.textContent = '';

    // 2. Set attributes based on urgency
    if (force) {
        announcer.setAttribute('role', 'alert');
        announcer.setAttribute('aria-live', 'assertive');
    } else {
        announcer.setAttribute('role', 'status');
        announcer.setAttribute('aria-live', 'polite');
    }

    // 3. Tiny delay to ensure the browser registers the "clear" then "set"
    // This "flicker" forces the screen reader to treat it as new content.
    setTimeout(() => {
        announcer.textContent = text;
    }, 50);
}

/**
 * Manages focus when expanding/collapsing side drawers (Inline Drawers).
 * Ensures keyboard focus doesn't get lost or trapped incorrectly.
 *
 * @param {JQuery} triggerButton - The button user clicked to toggle drawer.
 * @param {HTMLElement} drawerElement - The content element of the drawer.
 * @param {boolean} isOpening - Whether the drawer is opening or closing.
 */
export function handleDrawerFocus(triggerButton, drawerElement, isOpening) {
    if (!isA11yEnabled) return;

    if (isOpening) {
        triggerButton.attr('aria-expanded', 'true');

        // Deactivate global trap if one exists (to switch context)
        if (currentFocusTrap) {
            try { currentFocusTrap.deactivate(); } catch (e) { console.warn('Focus trap error', e); }
        }

        // Create a local trap for the drawer if library supports it
        if (focusTrap && drawerElement) {
            currentFocusTrap = focusTrap.createFocusTrap(drawerElement, {
                initialFocus: false,        // Let browser handle first focus or user tab in
                fallbackFocus: drawerElement,
                escapeDeactivates: false,   // Handled by our custom listeners
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
            try { currentFocusTrap.deactivate(); } catch (e) { /* ignore error */ }
            currentFocusTrap = null;
        }
        // Return focus to the toggle button
        triggerButton.trigger('focus');
    }
}

// ============================================================================
// SECTION 5: SPECIFIC ELEMENT PROCESSORS (PART A)
// Modular processors for specific UI areas that require complex logic
// beyond simple ARIA roles.
// ============================================================================

/**
 * Registry of specific processors.
 * Each function accepts a `root` element to support incremental DOM updates.
 */
const SpecificProcessors = {
    // --- 1. Static / Specific ID Fixes ---
    staticFixes: (root) => {
        const findId = (id) => {
            const el = document.getElementById(id);
            return (el && root.contains(el)) ? $(el) : null;
        };

        const $assetsField = findId('assets-json-url-field');
        if ($assetsField && !$assetsField.attr('aria-labelledby')) {
            const $mainLabel = $('label[for="assets-json-url-field"]');
            const $hintSpan = $assetsField.closest('.assets-url-block').find('small span[data-i18n="Load an asset list"]');
            if ($mainLabel.length && $hintSpan.length) {
                const labelId = $mainLabel.attr('id') || 'label-assets-url';
                $mainLabel.attr('id', labelId);
                const hintId = $hintSpan.attr('id') || 'label-assets-hint';
                $hintSpan.attr('id', hintId);
                $assetsField.attr('aria-labelledby', `${labelId} ${hintId}`);
            }
        }

        const $extTitle = findId('rm_extensions_block');
        if ($extTitle) {
            $extTitle.find('h3[data-i18n="Extensions"]').attr('id', 'title_extensions');
            findId('extensions_notify_updates')?.attr('aria-labelledby', 'label-extensions_notify_updates');
        }

        ['expression_api', 'expression_fallback'].forEach(id => {
            const $el = findId(id);
            if ($el && !$el.attr('aria-labelledby')) {
                const $label = $(`label[for="${id}"]`);
                if ($label.length) {
                    const labelId = $label.attr('id') || `a11y-label-${id}`;
                    $label.attr('id', labelId);
                    $el.attr('aria-labelledby', labelId);
                }
            }
        });

        const imgGenFixes = ['sd_refine_mode', 'sd_function_tool', 'sd_interactive_mode', 'sd_multimodal_captioning', 'sd_free_extend', 'sd_snap', 'sd_minimal_prompt_processing', 'sd_novel_anlas_guard'];
        imgGenFixes.forEach(id => {
            const $el = findId(id);
            if ($el && !$el.attr('aria-label')) {
                const title = $el.parent().attr('title');
                if (title) $el.attr('aria-label', title);
            }
        });

        const $visHeader = $('h4[data-i18n="Chat Message Visibility (by source)"]');
        if ($visHeader.length && root.contains($visHeader[0])) {
            const $visDesc = $visHeader.next('small');
            if ($visDesc.length) {
                $visDesc.attr('id', 'sd-vis-desc');
                $('#sd_wand_visible, #sd_command_visible, #sd_interactive_visible, #sd_tool_visible').each(function () {
                    if (!$(this).attr('aria-describedby')) $(this).attr('aria-describedby', 'sd-vis-desc');
                });
            }
        }

        const $sdPrompt = findId('sd_prompt_templates');
        if ($sdPrompt) {
            $sdPrompt.find('textarea').each(function () {
                if ($(this).attr('aria-labelledby')) return;
                const id = this.id;
                const $labelWrapper = $(this).prev('.title_restorable');
                if ($labelWrapper.length) {
                    const $label = $labelWrapper.find(`label[for="${id}"]`);
                    if ($label.length) {
                        const labelId = $label.attr('id') || `a11y-lbl-${id}`;
                        $label.attr('id', labelId);
                        $(this).attr('aria-labelledby', labelId);
                        $labelWrapper.find('.menu_button.fa-undo').attr({ 'role': 'button', 'tabindex': '0', 'aria-label': 'Restore default: ' + $label.text() });
                    }
                }
            });
        }

        const $ttsProvider = findId('tts_provider');
        if ($ttsProvider && !$ttsProvider.attr('aria-labelledby')) {
            const $lbl = $('#drawer-n8gxyt > span[data-i18n="Select TTS Provider"]');
            if ($lbl.length) {
                $lbl.attr('id', 'lbl-tts-provider-text');
                $ttsProvider.attr('aria-labelledby', 'lbl-tts-provider-text').removeAttr('aria-describedby');
            }
        }
        findId('tts_refresh')?.attr('aria-label', 'Reload TTS Provider');

        const $capSrc = findId('caption_source');
        if ($capSrc && !$capSrc.attr('aria-labelledby')) {
            const $lbl = $('label[for="caption_source"]');
            if ($lbl.length) {
                const id = $lbl.attr('id') || 'lbl-caption-source';
                $lbl.attr('id', id);
                $capSrc.attr('aria-labelledby', id).removeAttr('aria-describedby');
            }
        }

        // --- FIXED API BLOCK LOGIC ---
        // This logic is now unblocked and will properly find labels even if inputs() ran first.
        if ($(root).find('#rm_api_block').length || $(root).is('#rm_api_block')) {
            $('#rm_api_block select, #rm_api_block input').each(function () {
                const $el = $(this);
                if ($el.attr('id') === 'main_api') return;

                // If it already has a "generic" st-a11y label, we might want to overwrite it if we find a better one here.
                // But for safety, let's just check if we can find a better one.

                let $label = null;
                if ($el.attr('id')) {
                    const $forLabel = $(`label[for="${$el.attr('id')}"]`);
                    if ($forLabel.length) $label = $forLabel;
                }

                if (!$label || !$label.length) {
                    let $current = $el.parent();
                    if ($current.hasClass('flex-container') || $current.hasClass('wide100p') || $current.hasClass('openai_logit_bias_preset_form') || $current.is('div')) {
                        let $prev = $current.prev();
                        while ($prev.length) {
                            if ($prev.is('.range-block-title, h3, h4, h5, label, strong, b')) {
                                $label = $prev;
                                break;
                            }
                            if ($prev.is('.toggle-description, .neutral_warning, small, hr, .inline-drawer-toggle') || $prev.hasClass('notes-link')) {
                                $prev = $prev.prev();
                            } else {
                                break;
                            }
                        }
                    }
                }

                if ($label && $label.length && !$label.closest('.neutral_warning').length) {
                    let labelId = $label.attr('id') || 'lbl-' + ($el.attr('id') || Math.random().toString(36).substr(2, 5));
                    $label.attr('id', labelId);
                    $el.attr('aria-labelledby', labelId);
                }
            });
        }
    },

    // --- 2. Chat Messages ---
    chat: (root) => {
        const $root = $(root);
        const $messages = $root.find('#chat .mes').addBack('#chat .mes');

        $messages.each(function () {
            const $mes = $(this);
            if ($mes.hasClass('a11y-refactored')) return;

            const $nameText = $mes.find('.name_text');
            const charName = $nameText.text() || 'System';
            const isUser = $mes.attr('is_user') === 'true';
            const timestamp = $mes.find('.timestamp').text().trim();
            const isLast = $mes.is(':last-child');

            $mes.attr({
                'role': 'article',
                'tabindex': isLast ? '0' : '-1',
            }).addClass('a11y-refactored');

            if ($nameText.length) {
                $nameText.attr({
                    'role': 'heading',
                    'aria-level': '3',
                    'aria-label': `${isUser ? 'You' : charName} ${timestamp ? ', ' + timestamp : ''}`,
                });
            }
            $mes.find('.mesIDDisplay, .extraMesButtons, .drag-handle, .swipes-counter, .mes_timer, .timestamp').attr('aria-hidden', 'true');
        });
    },

    // --- 3. Generic Inputs & Labels ---
    inputs: (root) => {
        const $root = $(root);
        const $inputs = $root.find('input:not([type="range"]), textarea, select').addBack('input:not([type="range"]), textarea, select');

        $inputs.each(function () {
            const $el = $(this);
            if ($el.is('[type="hidden"]')) return;
            if ($el.attr('aria-labelledby') && document.getElementById($el.attr('aria-labelledby'))) return;

            let id = $el.attr('id');
            if (!id) {
                id = 'st-a11y-' + Math.random().toString(36).substr(2, 5);
                $el.attr('id', id);
            }

            let $label = null;

            if ($el.attr('id')) {
                const $forLabel = $(`label[for="${$el.attr('id')}"]`);
                if ($forLabel.length) $label = $forLabel;
            }

            if (!$label || !$label.length) {
                let $curr = $el;

                for (let i = 0; i < 4; i++) {
                    let $prev = $curr.prev();
                    let attempts = 0;

                    while ($prev.length && attempts < 5) {
                        if ($prev.is('.range-block-title, h4, h3, h5, label, strong, b')) {
                            $label = $prev;
                            break;
                        }
                        const $nestedTitle = $prev.find('.range-block-title, h4, h3, h5, label, strong, b').first();
                        if ($nestedTitle.length) {
                            $label = $nestedTitle;
                            break;
                        }

                        if ($prev.is('.toggle-description, .neutral_warning, small, hr, .inline-drawer-toggle, .notes-link, .fa-circle-info') ||
                            $prev.hasClass('notes-link') ||
                            $prev.text().trim() === '') {
                            $prev = $prev.prev();
                            attempts++;
                        } else {
                            break;
                        }
                    }

                    if ($label && $label.length) break;

                    const $parent = $curr.parent();
                    if ($parent.length && (
                        $parent.hasClass('range-block-range') ||
                        $parent.hasClass('range-block-range-and-counter') ||
                        $parent.hasClass('range-block') ||
                        $parent.hasClass('wide100p') ||
                        $parent.hasClass('flex-container') ||
                        $parent.hasClass('oneline-dropdown') ||
                        $parent.is('div')
                    )) {
                        $curr = $parent;
                    } else {
                        break;
                    }
                }
            }

            if (!$label || !$label.length) {
                const $container = $el.closest('.range-block');
                if ($container.length) {
                    $label = $container.find('.range-block-title, h4, h3, label').first();
                }
            }

            if ($label && $label.length) {
                if ($label.is($el)) return;
                if ($label.closest('.neutral_warning').length) return;

                if ($label.children().length > 0 && !$label.text().trim() && $label.find('span, b, strong').length) {
                    $label = $label.find('span, b, strong').first();
                }

                const titleId = $label.attr('id') || 'label-' + id;
                $label.attr('id', titleId);
                $el.attr('aria-labelledby', titleId);
            }

            const $descContainer = $el.closest('.range-block, .wide100p, .flex-container');
            if ($descContainer.length) {
                const $desc = $descContainer.find('.text_muted, .toggle-description, small.flexBasis100p').filter(function () {
                    return $(this).text().trim().length > 0;
                }).first();

                if ($desc.length && !$el.attr('aria-describedby')) {
                    const descId = $desc.attr('id') || 'desc-' + id;
                    $desc.attr('id', descId);
                    $el.attr('aria-describedby', descId);
                }
            }

            if ($el.is('[type="number"]')) {
                $el.attr('role', 'spinbutton');
                const min = $el.attr('min'), max = $el.attr('max');
                if (min !== undefined) $el.attr('aria-valuemin', min);
                if (max !== undefined) $el.attr('aria-valuemax', max);
            }
        });

        $root.find('input[type="range"]').addBack('input[type="range"]').each(function () {
            const $el = $(this);
            if ($el.attr('aria-hidden') === 'true') return;
            const hasSiblingNumber = $el.siblings('input[type="number"]').length > 0 ||
                                     $el.closest('.range-block-range-and-counter').find('input[type="number"]').length > 0 ||
                                     $el.closest('.range-block').find('input[type="number"]').length > 0;
            if (hasSiblingNumber) {
                $el.attr({ 'tabindex': '-1', 'aria-hidden': 'true' });
            }
        });

        $root.find('.select2-selection__choice__remove').addBack('.select2-selection__choice__remove').each(function () {
            const $btn = $(this);
            if ($btn.attr('tabindex')) return;
            $btn.attr('tabindex', '0');
            const $item = $btn.closest('.select2-selection__choice');
            const title = $item.attr('title') || $item.find('.select2-selection__choice__display').text();
            if (title) $btn.attr('aria-label', `Remove ${title}`);
        });
    },

    // --- 4. Drawers ---
    drawers: (root) => {
        const $root = $(root);
        $root.find('.inline-drawer').addBack('.inline-drawer').each(function () {
            const $drawer = $(this);
            const $header = $drawer.children('.inline-drawer-toggle');
            // If already processed, skip
            if ($header.attr('aria-controls')) return;

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
                'aria-controls': contentId,
            });

            $icon.attr({ 'aria-hidden': 'true', 'tabindex': '-1' }).removeAttr('role');

            const $title = $header.find('b, strong, span').first();
            if ($title.length) {
                const titleId = $title.attr('id') || 'title-' + contentId;
                $title.attr('id', titleId);
                $header.attr('aria-labelledby', titleId);
            }
        });
    },

    // --- 5. Navigation & Character Panel ---
    navAndCharPanel: (root) => {
        const $root = $(root);

        $root.find('#lm_button_panel_pin_div, #rm_button_panel_pin_div').addBack('#lm_button_panel_pin_div, #rm_button_panel_pin_div').each(function () {
            const $container = $(this);
            const $btnDiv = $container.find('.right_menu_button');
            if ($btnDiv.attr('aria-pressed')) return; // Skip if done

            const $checkbox = $container.find('input[type="checkbox"]');
            const title = $container.attr('title') || 'Pin Panel';
            const isChecked = $checkbox.prop('checked');
            $btnDiv.attr('aria-label', title).attr('aria-pressed', isChecked ? 'true' : 'false');
        });

        const charPanelSelectors = '#rm_button_bar .menu_button, #rm_button_bar .right_menu_button, #HotSwapWrapper .hotswap, #rm_button_characters';
        $root.find(charPanelSelectors).addBack(charPanelSelectors).each(function () {
            const $btn = $(this);
            if ($btn.attr('aria-label')) return;
            const title = $btn.attr('title') || $btn.attr('data-i18n-title') || $btn.attr('data-original-title');
            if (title) $btn.attr('aria-label', title.split('\n')[0].trim());
        });

        const $sortOrder = $root.find('#character_sort_order').addBack('#character_sort_order');
        if ($sortOrder.length && !$sortOrder.attr('aria-label')) {
            $sortOrder.attr('aria-label', $sortOrder.attr('title') || 'Sort Characters');
        }

        $root.find('.rm_tag_filter .tag').addBack('.rm_tag_filter .tag').each(function () {
            const $tag = $(this);
            if ($tag.attr('aria-label')) return;
            const title = $tag.find('.tag_name').attr('title');
            if (title) $tag.attr('aria-label', title);
        });

        $root.find('#avatar_controls .menu_button').addBack('#avatar_controls .menu_button').each(function () {
            const $btn = $(this);
            if ($btn.attr('aria-label')) return;
            const title = $btn.attr('title') || $btn.attr('data-i18n-title');
            if (title) $btn.attr('aria-label', title.split('\n')[0].trim());
        });

        // WI Selectors - ensure we re-check in case labels loaded late
        $root.find('.character_world_info_selector, .chat_world_info_selector').addBack('.character_world_info_selector, .chat_world_info_selector').each(function () {
            const $el = $(this);
            if ($el.attr('aria-labelledby')) return;

            const $container = $el.closest('.range-block');
            const $label = $container.find('.range-block-title h3, .range-block-title h4').first();
            if ($label.length) {
                const labelId = $label.attr('id') || 'lbl-wi-' + Math.random().toString(36).substr(2, 5);
                $label.attr('id', labelId);
                $el.attr('aria-labelledby', labelId);
            }
        });

        $root.find('.character_extra_world_info_selector').addBack('.character_extra_world_info_selector').each(function () {
            const $el = $(this);
            if ($el.attr('aria-labelledby')) return;

            const $container = $el.closest('.range-block');
            const $label = $container.find('h4').first();
            if ($label.length) {
                const labelId = $label.attr('id') || 'lbl-wi-extra-' + Math.random().toString(36).substr(2, 5);
                $label.attr('id', labelId);
                $el.attr('aria-labelledby', labelId);
                const $s2Search = $container.find('.select2-search__field');
                if ($s2Search.length) $s2Search.attr('aria-labelledby', labelId).attr('placeholder', 'Search additional lorebooks...');
            }
        });
    },

    // --- 6. Complex Lists & Sorting ---
    sortingAndLists: (root) => {
        const $root = $(root);

        // A. Prompt Manager List
        $root.find('.completion_prompt_manager_prompt').addBack('.completion_prompt_manager_prompt').each(function () {
            const $li = $(this);
            // Ensure sort button is present (Idempotent check)
            const $controls = $li.find('.prompt_manager_prompt_controls');
            if ($controls.length && $controls.find('.a11y-sort-button').length === 0) {
                const itemName = $li.find('.completion_prompt_manager_prompt_name').text().trim() || 'Prompt';

                // IMPORTANT: Ensure children buttons are focusable to solve "cannot focus item"
                $li.find('.prompt-manager-inspect-action').attr({ 'role': 'button', 'tabindex': '0', 'aria-label': 'Inspect: ' + itemName });

                const $sortBtn = $('<span>', {
                    class: 'a11y-sort-button fa-solid fa-sort fa-xs',
                    role: 'button',
                    tabindex: '0',
                    title: 'Sort',
                    'aria-label': 'Sort Prompt: ' + itemName,
                });
                $controls.prepend($sortBtn);

                $controls.find('span').not('.a11y-sort-button').each(function () {
                    const $btn = $(this);
                    const isAction = $btn.hasClass('prompt-manager-toggle-action') || $btn.hasClass('prompt-manager-edit-action') || $btn.hasClass('prompt-manager-detach-action') || $btn.hasClass('prompt-manager-delete-action');
                    if (isAction) {
                        $btn.attr({ 'role': 'button', 'tabindex': '0', 'aria-label': `${$btn.attr('title') || 'Action'}: ${itemName}` });
                        if ($btn.hasClass('prompt-manager-toggle-action')) {
                            $btn.attr('aria-pressed', $btn.hasClass('fa-toggle-on') ? 'true' : 'false');
                        }
                    } else {
                        $btn.attr('aria-hidden', 'true');
                    }
                });
            }
        });

        // B. Quick Replies
        const qrContainers = [
            { id: '#qr--global', label: 'Global' },
            { id: '#qr--chat', label: 'Chat' },
            { id: '#qr--character', label: 'Character' },
        ];

        qrContainers.forEach(container => {
            const $cont = $root.find(container.id).addBack(container.id);
            if (!$cont.length) return;

            // Re-apply header ID in case it was missed
            const titleId = `lbl-${container.id.substring(1)}-title`;
            $cont.find('.qr--title').attr('id', titleId);
            $cont.find('.qr--setListAdd').attr('aria-label', `Add new ${container.label} set`);

            $cont.find('.qr--item').each(function () {
                const $li = $(this);
                // Check if button exists to prevent duplicate
                if ($li.find('.a11y-sort-button').length === 0) {
                    const $select = $li.find('.qr--set');
                    $select.removeAttr('aria-labelledby aria-describedby').attr('aria-labelledby', titleId);
                    const setName = $select.find('option:selected').text() || 'Set';

                    $li.find('.qr--visible input').attr('aria-label', `Show buttons for set: ${setName}`);
                    $li.find('.fa-pencil').parent().attr('aria-label', `Edit set: ${setName}`);
                    $li.find('.qr--del').attr('aria-label', `Remove set: ${setName}`);

                    const $sortBtn = $('<div>', {
                        class: 'a11y-sort-button menu_button menu_button_icon fa-solid fa-sort interactable',
                        role: 'button',
                        tabindex: '0',
                        title: 'Sort',
                        'aria-label': `Sort set: ${setName}`,
                    });
                    const $delBtn = $li.find('.qr--del');
                    if ($delBtn.length) $sortBtn.insertBefore($delBtn);
                    else $li.append($sortBtn);
                }
            });
        });

        // C. Regex Scripts
        $root.find('.regex-script-label').addBack('.regex-script-label').each(function () {
            const $row = $(this);
            if (!$row.attr('tabindex')) $row.attr({ 'role': 'listitem', 'tabindex': '0' });

            const $btnContainer = $row.find('.regex_script_buttons');
            if ($btnContainer.length && $row.find('.a11y-sort-button').length === 0) {
                const $sortBtn = $('<div>', {
                    class: 'a11y-sort-button menu_button interactable',
                    role: 'button',
                    tabindex: '0',
                    title: 'Sort',
                    'aria-label': 'Sort Script',
                }).append('<i class="fa-solid fa-sort"></i>');
                $btnContainer.prepend($sortBtn);

                // Fix checkbox
                const scriptName = $row.find('.regex_script_name').text() || 'Script';
                const $lbl = $row.find('label.checkbox');
                const $inp = $lbl.find('input');
                $lbl.removeAttr('for').attr({
                    'role': 'checkbox',
                    'tabindex': '0',
                    'aria-label': $inp.hasClass('disable_regex') ? `Enable script: ${scriptName}` : `Toggle ${scriptName}`,
                    'aria-checked': $inp.prop('checked') ? 'true' : 'false',
                });
            }
        });
    },

    // --- 7. Autocomplete (Slash Commands) ---
    autoComplete: (root) => {
        const $input = $('#send_textarea');
        const $visibleList = $('.autoComplete:visible');
        const $visibleDetails = $('.autoComplete-detailsWrap:visible'); // 详情面板

        if ($visibleDetails.length && $visibleDetails.css('opacity') !== '0') {
            const detailsId = 'a11y-slash-details';

            if ($visibleDetails.attr('id') !== detailsId) {
                $visibleDetails.attr({
                    'id': detailsId,
                    'role': 'status',
                    'aria-live': 'polite',
                    'aria-atomic': 'true',
                });
            }

            $visibleDetails.find('.source').each(function () {
                const $icon = $(this);
                if (!$icon.attr('aria-label')) {
                    const titleText = $icon.attr('title') || 'Command Source';
                    const cleanLabel = titleText.replace(/\n/g, ' ').trim();
                    $icon.attr({
                        'role': 'img',
                        'aria-label': cleanLabel,
                    });
                }
            });

            let currentDescribedBy = $input.attr('aria-describedby') || '';
            if (!currentDescribedBy.includes(detailsId)) {
                $input.attr('aria-describedby', (currentDescribedBy + ' ' + detailsId).trim());
            }

            $input.removeAttr('aria-activedescendant');

            $input.attr('aria-expanded', 'true');

            return;
        }

        if ($visibleList.length) {
            const listId = 'a11y-autocomplete-list';

            if (!$visibleList.attr('role')) {
                $visibleList.attr({
                    'role': 'listbox',
                    'id': listId,
                    'aria-label': 'Command Suggestions',
                });
            }

            if ($input.attr('aria-expanded') !== 'true') {
                $input.attr({
                    'aria-expanded': 'true',
                    'aria-autocomplete': 'list',
                    'aria-controls': listId,
                    'aria-haspopup': 'listbox',
                });
            }

            let currentDescribedBy = $input.attr('aria-describedby') || '';
            if (currentDescribedBy.includes('a11y-slash-details')) {
                $input.attr('aria-describedby', currentDescribedBy.replace('a11y-slash-details', '').trim());
            }

            const $items = $visibleList.find('li');
            let activeId = '';

            $items.each(function (index) {
                const $li = $(this);

                let id = $li.attr('id');
                if (!id) {
                    id = `autocomplete-item-${index}`;
                    $li.attr('id', id);
                }

                const isBlank = $li.hasClass('blank');

                $li.attr({
                    'role': 'option',
                    'aria-setsize': $items.length,
                    'aria-posinset': index + 1,
                    'aria-disabled': isBlank ? 'true' : 'false',
                });

                if ($li.hasClass('selected')) {
                    $li.attr('aria-selected', 'true');
                    activeId = id;
                } else {
                    $li.attr('aria-selected', 'false');
                }
            });

            if (activeId) {
                $input.attr('aria-activedescendant', activeId);
            } else {
                $input.removeAttr('aria-activedescendant');
            }

            return;
        }

        if ($input.attr('aria-expanded') === 'true') {
            $input.attr('aria-expanded', 'false')
                .removeAttr('aria-activedescendant')
                .removeAttr('aria-controls');

            let currentDescribedBy = $input.attr('aria-describedby') || '';
            if (currentDescribedBy.includes('a11y-slash-details')) {
                $input.attr('aria-describedby', currentDescribedBy.replace('a11y-slash-details', '').trim());
            }
        }
    },

    // --- 8. Popups & Menus ---
    popupsAndMenus: (root) => {
        const $root = $(root);

        // Extensions (Sidebar & Popup Manager)
        const $extBlocks = $root.find('.extension_block').addBack('.extension_block').filter(':visible');
        if ($extBlocks.length) {
            $extBlocks.each(function () {
                const $block = $(this);
                if ($block.attr('data-a11y-processed-ext')) return;

                const name = $block.find('.extension_name').text().trim() || $block.attr('data-name');

                // Toggle Checkbox
                $block.find('.extension_toggle input').attr('aria-label', `Enable extension: ${name}`);

                // Action Buttons (Update, Branch, Move, Delete)
                $block.find('.extension_actions button, .extension_actions .menu_button').each(function () {
                    const $btn = $(this);
                    const title = $btn.attr('title') || $btn.text().trim() || 'Action';
                    const cleanTitle = title.split('\n')[0].trim();
                    $btn.attr('aria-label', `${cleanTitle} for ${name}`);
                });

                $block.attr('data-a11y-processed-ext', 'true');
            });
        }

        // Extension Manager Toolbar (Update All / Sort)
        const $extToolbar = $root.find('.extensions_toolbar').addBack('.extensions_toolbar');
        if ($extToolbar.length) {
            $extToolbar.attr('role', 'toolbar').attr('aria-label', 'Extensions Management Toolbar');
        }

        // Floating Panels checks
        const $anPanel = $('#floatingPrompt');
        if ($anPanel.length && !$anPanel.attr('role')) {
            $anPanel.attr({ 'role': 'dialog', 'aria-label': 'Author\'s Note Configuration' });
            $('#ANClose').attr({ 'role': 'button', 'tabindex': '0', 'aria-label': 'Close Author\'s Note' });
            $('#floatingPromptMaximize').attr({ 'role': 'button', 'tabindex': '0', 'aria-label': 'Maximize Author\'s Note' });
            $('#floatingPromptheader').attr('aria-hidden', 'true');
        }

        const $cfgPanel = $('#cfgConfig');
        if ($cfgPanel.length && !$cfgPanel.attr('role')) {
            $cfgPanel.attr({ 'role': 'dialog', 'aria-label': 'CFG Configuration' });
            $('#CFGClose').attr({ 'role': 'button', 'tabindex': '0', 'aria-label': 'Close CFG Config' });
            $('#cfgConfigMaximize').attr({ 'role': 'button', 'tabindex': '0', 'aria-label': 'Maximize CFG Config' });
        }

        const $logprobsPanel = $('#logprobsViewer');
        if ($logprobsPanel.length && !$logprobsPanel.attr('role')) {
            $logprobsPanel.attr({ 'role': 'dialog', 'aria-label': 'Token Probabilities' });
            $('#logprobsViewerClose').attr({ 'role': 'button', 'tabindex': '0', 'aria-label': 'Close Logprobs' });
            $('#logprobsMaximizeToggle').attr({ 'role': 'button', 'tabindex': '0', 'aria-label': 'Maximize Logprobs' });
            $('#logprovsViewerBlockToggle').attr({ 'role': 'button', 'tabindex': '0', 'aria-label': 'Toggle Logprobs View' });
            $('#logprobsReroll').attr({ 'role': 'button', 'tabindex': '0' });
        }

        const $selectChat = $('#select_chat_popup');
        if ($selectChat.length && !$selectChat.attr('role')) {
            $selectChat.attr({ 'role': 'dialog', 'aria-label': 'Chat History' });
            $('#select_chat_cross').attr({ 'role': 'button', 'tabindex': '0', 'aria-label': 'Close Chat History' });
            $('#newChatFromManageScreenButton, #chat_import_button').attr({ 'role': 'button', 'tabindex': '0' });
            $selectChat.find('.select_chat_block').attr({ 'role': 'listitem', 'tabindex': '0' });
            $selectChat.find('.chatBackupsList').attr('role', 'list');
        }

        const $dataBank = $root.find('.dataBankAttachments').addBack('.dataBankAttachments');
        if ($dataBank.length) {
            $dataBank.closest('dialog').attr('aria-label', 'Data Bank');
            $dataBank.find('.attachmentSort').attr('aria-label', 'Sort attachments');
            $dataBank.find('.bulkActionSelectAll, .bulkActionSelectNone, .bulkActionDisable, .bulkActionEnable, .bulkActionDelete, .openActionModalButton')
                .attr({ 'role': 'button', 'tabindex': '0' });
        }

        const $exportFormatPopup = $('#export_format_popup');
        if ($exportFormatPopup.length && !$exportFormatPopup.attr('role')) {
            $exportFormatPopup.attr({ 'role': 'menu', 'aria-label': 'Export Format Options' });
            $exportFormatPopup.find('.export_format').attr({
                'role': 'menuitem',
                'tabindex': '0',
                'aria-label': function () { return $(this).text().trim() + ' format'; },
            });
        }

        const $personaPopup = $root.closest('.popup').filter((_, el) => $(el).find('h3:contains("Persona Connections")').length > 0);
        if ($personaPopup.length && $personaPopup.is(':visible') && !$personaPopup.find('.persona-list').attr('role')) {
            const $list = $personaPopup.find('.persona-list');
            $list.attr({ 'role': 'list', 'aria-label': 'Connected Personas List' });
            $list.find('.avatar').attr({ 'role': 'listitem', 'tabindex': '0' });
        }

        const $altGreetings = $root.find('.alternate_greetings_list').addBack('.alternate_greetings_list');
        if ($altGreetings.length && $altGreetings.is(':visible')) {
            $altGreetings.attr('role', 'list');
            $root.find('.add_alternate_greeting').attr({ 'role': 'button', 'tabindex': '0', 'aria-label': 'Add new greeting' });

            $altGreetings.find('.alternate_greeting').each(function () {
                const $item = $(this);
                if ($item.attr('role')) return;
                $item.attr('role', 'listitem');
                $item.find('.move_up_alternate_greeting').attr('aria-label', 'Move greeting up');
                $item.find('.move_down_alternate_greeting').attr('aria-label', 'Move greeting down');
                $item.find('.delete_alternate_greeting').attr('aria-label', 'Delete greeting');
                const index = $item.data('index');
                const labelId = 'lbl-alt-greet-' + index;
                $item.find('strong span').first().closest('strong').attr('id', labelId);
                $item.find('textarea').attr('aria-labelledby', labelId);
            });
        }

        const $optionsBtn = $('#options_button');
        if ($optionsBtn.length && !$optionsBtn.attr('aria-haspopup')) {
            $optionsBtn.attr({
                'role': 'button',
                'tabindex': '0',
                'aria-haspopup': 'true',
                'aria-label': 'User Options',
            });
            $('#options .options-content').attr({ 'role': 'menu', 'aria-labelledby': 'options_button' });
            $('#options a').attr({ 'role': 'menuitem', 'tabindex': '0' });
        }
    },
};

/**
 * Main entry point to apply specific accessibility enhancements.
 * Iterates through all modular processors defined in SpecificProcessors.
 *
 * @param {Element|Document} rootElement - The root element to scan (default: document).
 */
const enhanceSpecificA11y = (rootElement = document) => {
    if (!isA11yEnabled) return;

    // Execute all specific processors
    Object.values(SpecificProcessors).forEach(process => {
        try {
            process(rootElement);
        } catch (e) {
            console.warn('[A11y] Processor error:', e);
        }
    });

    // Check if we need to restore focus to a specific element after a UI update
    if (focusRestoreSelector) {
        const $target = $(focusRestoreSelector);
        if ($target.length && $target.is(':visible')) {
            setTimeout(() => {
                // Only restore if user hasn't already moved focus elsewhere intentionally
                if (document.activeElement === document.body) {
                    $target.trigger('focus');
                    logDebug('FocusRestore', `Restored focus to: ${focusRestoreSelector}`);
                }
                focusRestoreSelector = null;
            }, 50);
        }
    }
};

// ============================================================================
// SECTION 8: FOCUS TRAP MANAGEMENT
// Handles the creation, activation, and pausing of focus traps for modals.
// Uses the 'focus-trap' library (imported as focusTrap).
// ============================================================================

/**
 * Manages focus traps for various popups in the application.
 * Called via debounce whenever the DOM changes or popups open/close.
 *
 * Logic:
 * 1. Checks if a specific popup is visible.
 * 2. If visible and no trap exists, creates and activates one.
 * 3. If visible and trap exists, ensures it's active.
 * 4. If not visible but trap exists, deactivates and destroys it.
 */
const managePopupTraps = () => {
    // Safety check: If library is missing or A11y disabled, cleanup everything.
    if (!focusTrap || !isA11yEnabled) {
        const traps = [
            currentFocusTrap, promptManagerTrap, charPopupTrap, worldInfoTrap,
            qrEditorTrap, regexEditorTrap, extensionTrap, extensionsMenuTrap,
            optionsMenuTrap, selectChatTrap, floatingPromptTrap, cfgConfigTrap,
            logprobsTrap, dataBankTrap, tokenCounterTrap, exportFormatTrap,
        ];
        traps.forEach(trap => { if (trap) try { trap.deactivate(); } catch (e) { /* ignore error */ } });

        // Reset global variables
        currentFocusTrap = null; promptManagerTrap = null; charPopupTrap = null;
        worldInfoTrap = null; worldInfoTrapUid = null; qrEditorTrap = null;
        regexEditorTrap = null; extensionTrap = null; extensionsMenuTrap = null;
        optionsMenuTrap = null; selectChatTrap = null; floatingPromptTrap = null;
        cfgConfigTrap = null; logprobsTrap = null; dataBankTrap = null;
        tokenCounterTrap = null; exportFormatTrap = null;
        extManagerTrap = null; apiParamsTrap = null;
        return;
    }

    // --- A. Character Advanced Definitions Popup ---
    const $charPopup = $('#character_popup');
    if ($charPopup.is(':visible') && $charPopup.hasClass('open')) {
        if (!charPopupTrap) {
            lastFocusedBeforeTrap = document.activeElement;
            charPopupTrap = focusTrap.createFocusTrap('#character_popup', {
                allowOutsideClick: true, // Allow clicking toast notifications etc.
                fallbackFocus: '#character_popup_ok',
                onDeactivate: () => {
                    if (lastFocusedBeforeTrap instanceof HTMLElement) lastFocusedBeforeTrap.focus();
                },
            });
            try { charPopupTrap.activate(); } catch (e) { /* ignore error */ }
        }
    } else if (charPopupTrap) {
        try { charPopupTrap.deactivate(); } catch (e) { /* ignore error */ }
        charPopupTrap = null;
    }

    // --- B. Prompt Manager ---
    const $promptPopup = $('#completion_prompt_manager_popup');
    // Check if we are in Edit or Inspect mode (main list doesn't strictly need a trap)
    const isPromptActive = $promptPopup.is(':visible') &&
                          ($('#completion_prompt_manager_popup_edit').is(':visible') || $('#completion_prompt_manager_popup_inspect').is(':visible'));
    const isSortMenuOpen = $('.list-group[role="menu"]').is(':visible'); // Generic popup overlay

    if (isPromptActive) {
        // Pause trap if a secondary popup (like the Sort Menu) is open on top
        if (isSortMenuOpen) {
            if (promptManagerTrap) try { promptManagerTrap.pause(); } catch (e) { /* ignore error */ }
        } else {
            if (!promptManagerTrap) {
                lastFocusedBeforeTrap = document.activeElement;
                promptManagerTrap = focusTrap.createFocusTrap('#completion_prompt_manager_popup', {
                    allowOutsideClick: true,
                    initialFocus: '#completion_prompt_manager_popup_close_button',
                    onDeactivate: () => {
                        if (lastFocusedBeforeTrap instanceof HTMLElement) lastFocusedBeforeTrap.focus();
                    },
                });
                try { promptManagerTrap.activate(); } catch (e) { /* ignore error */ }
            } else {
                try { promptManagerTrap.unpause(); } catch (e) { /* ignore error */ }
            }
        }
    } else if (promptManagerTrap) {
        try { promptManagerTrap.deactivate(); } catch (e) { /* ignore error */ }
        promptManagerTrap = null;
    }

    // --- C. World Info (Inline Drawer Logic) ---
    // Specifically targets the currently expanded World Info entry to trap focus within it.
    const $expandedWI = $('#world_popup_entries_list .world_entry .inline-drawer-content:visible').closest('.world_entry');
    if ($expandedWI.length === 1) {
        const currentUid = $expandedWI.attr('uid');
        if (!worldInfoTrap || worldInfoTrapUid !== currentUid) {
            if (worldInfoTrap) try { worldInfoTrap.deactivate(); } catch (e) { /* ignore error */ }

            worldInfoTrap = focusTrap.createFocusTrap($expandedWI.find('.world_entry_form')[0], {
                allowOutsideClick: true,
                clickOutsideDeactivates: false,
                initialFocus: false,
                escapeDeactivates: false, // Handled by global listeners
            });
            worldInfoTrapUid = currentUid;
            try { worldInfoTrap.activate(); } catch (e) { /* ignore error */ }
        }
    } else if (worldInfoTrap) {
        try { worldInfoTrap.deactivate(); } catch (e) { /* ignore error */ }
        worldInfoTrap = null;
        worldInfoTrapUid = null;
    }

    // --- D. QR Editor (Quick Replies) ---
    const $qrEditor = $('#qr--modalEditor');
    if ($qrEditor.is(':visible')) {
        if (!qrEditorTrap) {
            lastFocusedBeforeTrap = document.activeElement;
            // Trap the entire popup body
            const $trapContainer = $qrEditor.closest('.popup-body');
            if ($trapContainer.length) {
                qrEditorTrap = focusTrap.createFocusTrap($trapContainer[0], {
                    allowOutsideClick: true,
                    initialFocus: '#qr--modal-label',
                    fallbackFocus: '.popup-button-ok',
                    escapeDeactivates: false,
                    onDeactivate: () => {
                        if (lastFocusedBeforeTrap instanceof HTMLElement) lastFocusedBeforeTrap.focus();
                    },
                });
                try { qrEditorTrap.activate(); } catch (e) { /* ignore error */ }
            }
        }
    } else if (qrEditorTrap) {
        try { qrEditorTrap.deactivate(); } catch (e) { /* ignore error */ }
        qrEditorTrap = null;
    }

    // --- E. Regex Editor / Debugger Popups ---
    const $regexDialog = $('dialog.popup[open]').has('.regex_editor, .regex-debugger-container');
    if ($regexDialog.length) {
        if (!regexEditorTrap) {
            lastFocusedBeforeTrap = document.activeElement;
            regexEditorTrap = focusTrap.createFocusTrap($regexDialog[0], {
                allowOutsideClick: true,
                initialFocus: '.regex_script_name, .regex-debugger-container button',
                escapeDeactivates: false,
                onDeactivate: () => {
                    if (lastFocusedBeforeTrap instanceof HTMLElement) lastFocusedBeforeTrap.focus();
                },
            });
            try { regexEditorTrap.activate(); } catch (e) { /* ignore error */ }
        }
    } else if (regexEditorTrap) {
        try { regexEditorTrap.deactivate(); } catch (e) { /* ignore error */ }
        regexEditorTrap = null;
    }

    // --- F. Extensions Menu ---
    const $extMenu = $('#extensionsMenu');
    if ($extMenu.is(':visible')) {
        if (!extensionsMenuTrap) {
            lastFocusedBeforeTrap = document.activeElement;
            extensionsMenuTrap = focusTrap.createFocusTrap('#extensionsMenu', {
                allowOutsideClick: true,
                clickOutsideDeactivates: true,
                initialFocus: false,
                escapeDeactivates: false,
                onDeactivate: () => {
                    if (lastFocusedBeforeTrap instanceof HTMLElement) lastFocusedBeforeTrap.focus();
                },
            });
            try { extensionsMenuTrap.activate(); } catch (e) { /* ignore error */ }
        }
    } else if (extensionsMenuTrap) {
        try { extensionsMenuTrap.deactivate(); } catch (e) { /* ignore error */ }
        extensionsMenuTrap = null;
    }

    // --- G. Options Menu (Left Side) ---
    const $optionsMenu = $('#options');
    if ($optionsMenu.is(':visible') && $optionsMenu.find('.options-content').is(':visible')) {
        if (!optionsMenuTrap) {
            lastFocusedBeforeTrap = document.activeElement;
            optionsMenuTrap = focusTrap.createFocusTrap('#options', {
                allowOutsideClick: true,
                clickOutsideDeactivates: true,
                initialFocus: false,
                escapeDeactivates: false,
                onDeactivate: () => {
                    if (lastFocusedBeforeTrap instanceof HTMLElement) lastFocusedBeforeTrap.focus();
                },
            });
            try { optionsMenuTrap.activate(); } catch (e) { /* ignore error */ }
        }
    } else if (optionsMenuTrap) {
        try { optionsMenuTrap.deactivate(); } catch (e) { /* ignore error */ }
        optionsMenuTrap = null;
    }

    // --- H. Select Chat Popup ---
    const $selectChat = $('#select_chat_popup');
    if ($selectChat.is(':visible') && $selectChat.css('display') !== 'none') {
        if (!selectChatTrap) {
            lastFocusedBeforeTrap = document.activeElement;
            selectChatTrap = focusTrap.createFocusTrap('#select_chat_popup', {
                allowOutsideClick: true,
                clickOutsideDeactivates: false,
                initialFocus: '#select_chat_search',
                fallbackFocus: '#select_chat_popup',
                escapeDeactivates: false,
                onDeactivate: () => {
                    if (lastFocusedBeforeTrap instanceof HTMLElement) lastFocusedBeforeTrap.focus();
                },
            });
            try { selectChatTrap.activate(); } catch (e) { /* ignore error */ }
        }
    } else if (selectChatTrap) {
        try { selectChatTrap.deactivate(); } catch (e) { /* ignore error */ }
        selectChatTrap = null;
    }

    // --- I. Floating Panels (Author's Note, CFG, Logprobs) ---
    /**
     * Helper to manage traps for panels that might fade out (opacity 0) but stay in DOM.
     * @param {string} id - Selector for the panel.
     * @param {Object} trapVar - The current trap variable.
     * @param {Function} setTrapVar - Setter function to update the trap variable.
     */
    const handleFloatingTrap = (id, trapVar, setTrapVar) => {
        const $el = $(id);
        // Check opacity because these panels often animate fade-out but stay display:flex
        if ($el.is(':visible') && $el.css('opacity') !== '0' && $el.css('display') !== 'none') {
            if (!trapVar) {
                // Do not capture focus if user is in a side drawer
                if (!document.activeElement.closest('.drawer-content')) {
                    lastFocusedBeforeTrap = document.activeElement;
                }
                const newTrap = focusTrap.createFocusTrap(id, {
                    allowOutsideClick: true,
                    clickOutsideDeactivates: false,
                    initialFocus: false,
                    fallbackFocus: id,
                    escapeDeactivates: false,
                    onDeactivate: () => {
                        if (lastFocusedBeforeTrap instanceof HTMLElement) lastFocusedBeforeTrap.focus();
                    },
                });
                setTrapVar(newTrap);
                try { newTrap.activate(); } catch (e) { /* ignore error */ }
            }
        } else if (trapVar) {
            try { trapVar.deactivate(); } catch (e) { /* ignore error */ }
            setTrapVar(null);
        }
    };

    handleFloatingTrap('#floatingPrompt', floatingPromptTrap, (t) => floatingPromptTrap = t);
    handleFloatingTrap('#cfgConfig', cfgConfigTrap, (t) => cfgConfigTrap = t);
    handleFloatingTrap('#logprobsViewer', logprobsTrap, (t) => logprobsTrap = t);

    // --- J. Data Bank / Attachments ---
    const $dataBank = $('dialog[open] .dataBankAttachments').closest('dialog');
    if ($dataBank.length && $dataBank.is(':visible')) {
        if (!dataBankTrap) {
            lastFocusedBeforeTrap = document.activeElement;
            dataBankTrap = focusTrap.createFocusTrap($dataBank[0], {
                allowOutsideClick: true,
                initialFocus: '#attachmentSearch',
                escapeDeactivates: false,
                onDeactivate: () => {
                    if (lastFocusedBeforeTrap instanceof HTMLElement) lastFocusedBeforeTrap.focus();
                },
            });
            try { dataBankTrap.activate(); } catch (e) { /* ignore error */ }
        }
    } else if (dataBankTrap) {
        try { dataBankTrap.deactivate(); } catch (e) { /* ignore error */ }
        dataBankTrap = null;
    }

    // --- K. Export Format Popup ---
    const $exportFormat = $('#export_format_popup');
    if ($exportFormat.is(':visible')) {
        if (!exportFormatTrap) {
            lastFocusedBeforeTrap = document.activeElement;
            exportFormatTrap = focusTrap.createFocusTrap('#export_format_popup', {
                allowOutsideClick: true,
                clickOutsideDeactivates: true,
                initialFocus: false,
                escapeDeactivates: false,
                onDeactivate: () => {
                    if (lastFocusedBeforeTrap instanceof HTMLElement) lastFocusedBeforeTrap.focus();
                },
            });
            try { exportFormatTrap.activate(); } catch (e) { /* ignore error */ }
        }
    } else if (exportFormatTrap) {
        try { exportFormatTrap.deactivate(); } catch (e) { /* ignore error */ }
        exportFormatTrap = null;
    }

    // --- L. Token Counter ---
    const $tokenCounter = $('dialog[open] h3[data-i18n="Token Counter"]').closest('dialog');
    if ($tokenCounter.length && $tokenCounter.is(':visible')) {
        if (!tokenCounterTrap) {
            lastFocusedBeforeTrap = document.activeElement;
            tokenCounterTrap = focusTrap.createFocusTrap($tokenCounter[0], {
                allowOutsideClick: true,
                initialFocus: '#token_counter_textarea',
                escapeDeactivates: false,
                onDeactivate: () => {
                    if (lastFocusedBeforeTrap instanceof HTMLElement) lastFocusedBeforeTrap.focus();
                },
            });
            try { tokenCounterTrap.activate(); } catch (e) { /* ignore error */ }
        }
    } else if (tokenCounterTrap) {
        try { tokenCounterTrap.deactivate(); } catch (e) { /* ignore error */ }
        tokenCounterTrap = null;
    }

    // --- M. Extensions Manager Popup ---
    const $extManager = $('dialog[open] .extensions_info').closest('dialog');
    if ($extManager.length && $extManager.is(':visible')) {
        if (!extManagerTrap) {
            lastFocusedBeforeTrap = document.activeElement;
            extManagerTrap = focusTrap.createFocusTrap($extManager[0], {
                allowOutsideClick: true,
                initialFocus: '.extensions_toolbar button, .popup-button-close',
                fallbackFocus: '.popup-content',
                escapeDeactivates: false,
                onDeactivate: () => {
                    if (lastFocusedBeforeTrap instanceof HTMLElement) lastFocusedBeforeTrap.focus();
                },
            });
            try { extManagerTrap.activate(); } catch (e) { /* ignore error */ }
        }
    } else if (extManagerTrap) {
        try { extManagerTrap.deactivate(); } catch (e) { /* ignore error */ }
        extManagerTrap = null;
    }

    // --- N. API Additional Parameters Popup ---
    const $apiParams = $('dialog[open] h3[data-i18n="Additional Parameters"]').closest('dialog');
    if ($apiParams.length && $apiParams.is(':visible')) {
        if (!apiParamsTrap) {
            lastFocusedBeforeTrap = document.activeElement;
            apiParamsTrap = focusTrap.createFocusTrap($apiParams[0], {
                allowOutsideClick: true,
                initialFocus: 'textarea',
                fallbackFocus: '.popup-button-ok',
                escapeDeactivates: false,
                onDeactivate: () => {
                    if (lastFocusedBeforeTrap instanceof HTMLElement) lastFocusedBeforeTrap.focus();
                },
            });
            try { apiParamsTrap.activate(); } catch (e) { /* ignore error */ }
        }
    } else if (apiParamsTrap) {
        try { apiParamsTrap.deactivate(); } catch (e) { /* ignore error */ }
        apiParamsTrap = null;
    }
};

/**
 * Handles Tab navigation within the main Chat UI when no popups are active.
 * Creates a "cycle" between the top of the chat (Send Input) and the bottom (Stop Button / Messages).
 *
 * @param {KeyboardEvent} e
 */
const trapFocusInChat = (e) => {
    if (e.key !== 'Tab') return;

    // Don't interfere if any popup or drawer is open
    if ($('.openDrawer, .popup, #character_popup.open').is(':visible')) return;

    const selectors = ['#chat .mes', '#options_button', '#extensionsMenuButton', '#send_textarea', '#mes_stop'].join(', ');
    const $items = $(selectors).filter(':visible');
    if (!$items.length) return;

    const first = $items.first()[0];
    const last = $items.last()[0];

    // Shift+Tab on first element -> Loop to last
    if (e.shiftKey && document.activeElement === first) {
        e.preventDefault();
        last.focus();
    } else if (!e.shiftKey && document.activeElement === last) {     // Tab on last element -> Loop to first
        e.preventDefault();
        first.focus();
    }
};

// ============================================================================
// SECTION 9: LIFECYCLE MANAGEMENT (INIT & CLEANUP)
// ============================================================================

/**
 * Removes all accessibility enhancements, attributes, and listeners.
 * Called when the user disables the Accessibility extension/setting.
 */
function cleanupA11y() {
    // 1. Stop Observer to prevent new elements from being processed
    if (mainObserver) {
        mainObserver.disconnect();
        mainObserver = null;
    }

    // 2. Deactivate and Clear All Focus Traps
    const trapVars = [
        currentFocusTrap, promptManagerTrap, charPopupTrap, worldInfoTrap,
        qrEditorTrap, regexEditorTrap, extensionTrap, extensionsMenuTrap,
        optionsMenuTrap, selectChatTrap, floatingPromptTrap, cfgConfigTrap,
        logprobsTrap, dataBankTrap, tokenCounterTrap, exportFormatTrap,
        extManagerTrap, apiParamsTrap,
    ];

    trapVars.forEach(trap => {
        if (trap) {
            try { trap.deactivate(); } catch (e) { /* ignore errors during cleanup */ }
        }
    });

    // Nullify all trap references
    currentFocusTrap = null; promptManagerTrap = null; charPopupTrap = null;
    worldInfoTrap = null; worldInfoTrapUid = null; qrEditorTrap = null;
    regexEditorTrap = null; extensionTrap = null; extensionsMenuTrap = null;
    optionsMenuTrap = null; selectChatTrap = null; floatingPromptTrap = null;
    cfgConfigTrap = null; logprobsTrap = null; dataBankTrap = null;
    tokenCounterTrap = null; exportFormatTrap = null;

    // 3. Clean DOM: Remove injected attributes and elements
    // This allows the page to return to its original state without reload.
    $(`[${GENERIC_ATTR}]`).removeAttr(GENERIC_ATTR);

    $('[role="button"], [role="list"], [role="listitem"], [role="toolbar"], [role="tablist"], [role="tab"], [role="status"]')
        .removeAttr('role tabindex aria-label aria-hidden aria-expanded aria-controls aria-pressed aria-valuemin aria-valuemax aria-describedby aria-labelledby aria-haspopup aria-checked aria-level');

    // Remove injected UI elements
    $('.a11y-sort-button').remove();
    $('.a11y-refactored').removeClass('a11y-refactored');

    // Remove dynamically generated IDs
    $('[id^="st-a11y-"]').removeAttr('id');
    $('[id^="drawer-"]').removeAttr('id');
    $('[id^="label-st-a11y-"]').removeAttr('id');
}

/**
 * Toggles the accessibility system on or off.
 *
 * @param {boolean} enabled - Whether to enable accessibility features.
 */
export function setAccessibilityEnabled(enabled) {
    // Avoid redundant calls
    if (isA11yEnabled === enabled && mainObserver) return;

    isA11yEnabled = enabled;

    if (!enabled) {
        cleanupA11y();
        return;
    }

    // --- ENABLE SEQUENCE ---

    // 1. Initial Scan: Apply rules to everything currently in the DOM
    applyGenericA11yRules(document.body);
    enhanceSpecificA11y(document.body);
    managePopupTraps();

    // Minor static tweaks
    $('#send_but').attr({ 'tabindex': '-1', 'aria-hidden': 'true' });

    // 2. Start Mutation Observer
    // Watches for changes (popups opening, new chat messages) to apply rules dynamically.
    mainObserver = new MutationObserver((mutations) => {
        if (!isA11yEnabled) return;

        let shouldCheckTraps = false;

        for (const mutation of mutations) {
            // A. Handle new nodes (Incremental Updates)
            if (mutation.type === 'childList') {
                if (mutation.addedNodes.length > 0) {
                    mutation.addedNodes.forEach(node => {
                        if (node.nodeType === 1) { // ELEMENT_NODE only
                            const element = /** @type {Element} */ (node);
                            applyGenericA11yRules(element);
                            enhanceSpecificA11y(element);
                        }
                    });
                }
                // If nodes are removed, traps might need updates
                if (mutation.removedNodes.length > 0) {
                    shouldCheckTraps = true;
                }
            } else if (mutation.type === 'attributes') {    // B. Handle visibility/attribute changes (Triggers Trap logic)
                shouldCheckTraps = true;
            }
        }

        if (shouldCheckTraps) {
            // Debounce trap management to avoid performance hits during rapid animations
            debounce(() => managePopupTraps(), 100)();
        }

        // Feature: Keep 'Stop' button accessible during generation
        if (isAiGenerating) {
            const stopBtn = document.getElementById('mes_stop');
            if (stopBtn && document.activeElement !== stopBtn && stopBtn.offsetParent !== null) {
                // Logic to potentially refocus stop button could go here
            }
        }
    });

    mainObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'hidden', 'open', 'aria-hidden'],
    });
}

// ============================================================================
// SECTION 10: INITIALIZATION & GLOBAL EVENT HANDLERS
// Sets up persistent event listeners for the application lifecycle.
// ============================================================================

/**
 * Initializes the accessibility module.
 * Sets up global event delegation, keyboard shortcuts, and application event listeners.
 * This function should be called once when the extension loads.
 */
export function initAccessibility() {
    // 1. Initial Static Cleanups
    // Remove the Send button from tab order (users rely on Enter in textarea)
    $('#send_but').attr({
        'tabindex': '-1',
        'aria-hidden': 'true',
    });

    // --- A. Global Event Delegation (Optimization) ---
    // Instead of attaching listeners to thousands of elements, we attach to document.
    // 1. Sort Buttons (Generic Handler)
    $(document).on('focus', '.a11y-sort-button', function () {
        if (!isA11yEnabled) return;
        const $this = $(this);

        const validSelectors = '.qr--item, .qr--set-item, .completion_prompt_manager_prompt, .regex-script-label, .list-group-item';
        const $item = $this.closest(validSelectors);

        if ($item.length) {
            const $container = $item.parent();
            const $siblings = $container.children(validSelectors);

            const idx = $siblings.index($item) + 1;
            const tot = $siblings.length;

            console.log(`[A11y Debug] Item Focus: ${idx}/${tot} (Total DOM children: ${$container.children().length})`);

            announceA11y(`Position ${idx} of ${tot}.`);
        }
    });

    $(document).on('click keydown', '.a11y-sort-button', function (e) {
        if (!isA11yEnabled) return;

        if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;

        e.preventDefault();
        e.stopPropagation();

        if ($(this).closest('.completion_prompt_manager_prompt').length) {
            handleSortMenu(this, '.completion_prompt_manager_prompt', '#completion_prompt_manager_list');
        } else if ($(this).closest('.qr--item').length) {
            const containerId = $(this).closest('.qr--setList').attr('id');
            handleSortMenu(this, '.qr--item', '#' + containerId);
        } else if ($(this).closest('.qr--set-item').length) {
            handleSortMenu(this, '.qr--set-item', '.qr--set-qrListContents');
        } else if ($(this).closest('.regex-script-label').length) {
            handleSortMenu(this, '.regex-script-label', '.regex-script-container');
        }
    });

    // 2. State Synchronization Handlers
    // Ensures visual checkboxes sync their state to ARIA attributes on custom labels.

    // Regex Checkboxes
    $(document).on('change', '.regex-script-container input[type="checkbox"]', function () {
        if (!isA11yEnabled) return;
        const $lbl = $(this).closest('.regex-script-label').find('label.checkbox');
        if ($lbl.length) {
            $lbl.attr('aria-checked', $(this).prop('checked') ? 'true' : 'false');
        }
    });

    // Panel Pin Toggles (Left/Right Menu)
    $(document).on('change', '#lm_button_panel_pin, #rm_button_panel_pin', function () {
        if (!isA11yEnabled) return;
        const $checkbox = $(this);
        const $container = $checkbox.parent();
        const $btnDiv = $container.find('.right_menu_button');
        const isChecked = $checkbox.prop('checked');

        $btnDiv.attr('aria-pressed', isChecked ? 'true' : 'false');

        const panelName = $checkbox.attr('id') === 'lm_button_panel_pin' ? 'AI Configuration' : 'Character Management';
        const status = isChecked ? 'Locked open' : 'Unlocked';
        announceA11y(`${panelName} panel ${status}`);
    });

    // Prompt Manager Toggle Buttons
    $(document).on('click', '.prompt-manager-toggle-action', function () {
        if (!isA11yEnabled) return;
        // Wait briefly for the class to toggle (visual change)
        setTimeout(() => {
            $(this).attr('aria-pressed', $(this).hasClass('fa-toggle-on') ? 'true' : 'false');
        }, 50);
    });

    // --- B. Keyboard Navigation Enhancements ---

    /**
     * Helper to move focus between chat messages.
     * Implements "Roving Tabindex" pattern manually.
     */
    const moveMessageFocus = ($current, $target) => {
        if ($target.length) {
            $current.attr('tabindex', '-1');
            $target.attr('tabindex', '0').trigger('focus');
            $target[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    };

    // Chat History Navigation (Arrow Keys)
    $(document).on('keydown', '#chat .mes', function (e) {
        if (!isA11yEnabled) return;

        const $this = $(this);
        const $allMessages = $('#chat .mes:visible');
        const index = $allMessages.index($this);

        switch (e.key) {
            case 'ArrowDown': // Next Message
                e.preventDefault();
                if (index < $allMessages.length - 1) {
                    moveMessageFocus($this, $allMessages.eq(index + 1));
                }
                break;
            case 'ArrowUp': // Previous Message
                e.preventDefault();
                if (index > 0) {
                    moveMessageFocus($this, $allMessages.eq(index - 1));
                }
                break;
            case 'Escape': // Return to Input
                e.preventDefault();
                $('#send_textarea').trigger('focus');
                announceA11y('Returned to text input');
                break;
        }
    });

    // Activate pseudo-buttons with Keyboard (Enter/Space)
    // Many UI elements are <div>s with click handlers. This makes them keyboard accessible.
    $(document).on('keydown', '[role="button"][tabindex="0"]:not(.a11y-sort-button), [role="listitem"][tabindex="0"], [role="menuitem"][tabindex="0"], .prompt-manager-toggle-action, .killSwitch, .inline-drawer-toggle, #options_button, #extensionsMenuButton', function (e) {
        if (!isA11yEnabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            // Trigger native click if not a real button
            if (this.tagName !== 'BUTTON') {
                $(this).trigger('click');
            }
        }
    });

    // --- C. Smart Focus Preservation ---
    // Tracks where the user was before clicking a toggle that might redraw the UI.
    // Allows restoring focus to the correct element after a re-render.
    $(document).on('mousedown click', '.killSwitch, .prompt-manager-toggle-action, .disable_regex, .enable_scoped', function () {
        if (!isA11yEnabled) return;
        const $el = $(this);
        let selector = null;

        // 1. World Info (.killSwitch)
        const $wiEntry = $el.closest('.world_entry');
        if ($wiEntry.length) {
            const uid = $wiEntry.attr('uid');
            if (uid) selector = `.world_entry[uid="${uid}"] .killSwitch`;
        }

        // 2. Prompt Manager (.prompt-manager-toggle-action)
        if (!selector) {
            const $pmEntry = $el.closest('.completion_prompt_manager_prompt');
            if ($pmEntry.length) {
                const id = $pmEntry.attr('data-pm-identifier');
                if (id) selector = `.completion_prompt_manager_prompt[data-pm-identifier="${id}"] .prompt-manager-toggle-action`;
            }
        }

        // 3. Regex Scripts (.disable_regex)
        if (!selector) {
            const $regexEntry = $el.closest('.regex-script-label');
            if ($regexEntry.length) {
                const id = $regexEntry.attr('id');
                if (id) selector = `#${id} .disable_regex`;
            }
        }

        // 4. Scoped/Preset Regex Toggles
        if (!selector && $el.hasClass('enable_scoped')) {
            const id = $el.attr('id');
            if (id) selector = `#${id}`;
        }

        if (selector) {
            focusRestoreSelector = selector;
        }
    });

    // --- D. Extensions Menu Handling ---
    // Handles focus trapping for inline extension drawers.

    $(document).on('click', '.extension_container .inline-drawer-toggle', function () {
        if (!isA11yEnabled) return;
        const $drawer = $(this).closest('.inline-drawer');
        const $content = $drawer.find('.inline-drawer-content');

        // Delay to allow animation to start/finish
        setTimeout(() => {
            if ($content.is(':visible')) {
                // Close existing trap, create new one
                if (extensionTrap) try { extensionTrap.deactivate(); } catch (e) { /* ignore error */ }

                extensionTrap = focusTrap.createFocusTrap($drawer[0], {
                    allowOutsideClick: true,
                    clickOutsideDeactivates: true,
                    initialFocus: false,
                    fallbackFocus: $(this)[0],
                    escapeDeactivates: false, // Handled below
                });
                try { extensionTrap.activate(); } catch (e) { /* ignore error */ }
            } else {
                if (extensionTrap) {
                    try { extensionTrap.deactivate(); } catch (e) { /* ignore error */ }
                    extensionTrap = null;
                }
            }
        }, 450);
    });

    // Escape Key Handler for Extension Drawers
    $(document).on('keydown', '.extension_container .inline-drawer', function (e) {
        if (!isA11yEnabled) return;
        if (e.key === 'Escape') {
            const $drawer = $(this);
            const $content = $drawer.find('.inline-drawer-content');

            if ($content.is(':visible')) {
                e.preventDefault();
                e.stopPropagation();

                const $header = $drawer.find('.inline-drawer-toggle');
                $header.trigger('click'); // Collapse
                $header.trigger('focus'); // Restore focus

                if (typeof extensionTrap !== 'undefined' && extensionTrap) {
                    try { extensionTrap.deactivate(); } catch (e) { /* ignore error */ }
                    extensionTrap = null;
                }
                announceA11y('Extension menu closed.');
            }
        }
    });

    // --- E. Global Escape Key Logic ---
    // Prioritized handling of Escape key to close topmost menus/popups.
    $(document).on('keydown', function (e) {
        if (!isA11yEnabled || e.key !== 'Escape') return;

        // 1. Options Menu
        const $optionsMenu = $('#options');
        if ($optionsMenu.is(':visible') && $optionsMenu.find('.options-content').is(':visible')) {
            if ($(e.target).closest('#options').length) {
                e.preventDefault();
                e.stopPropagation();
                $('#options_button').trigger('click').trigger('focus');
                return;
            }
        }

        // 2. Extensions Menu (Overall)
        const $extMenu = $('#extensionsMenu');
        if ($extMenu.is(':visible')) {
            // Only close if not inside a drawer (drawer handled above)
            if ($(e.target).closest('#extensionsMenu').length && !$(e.target).closest('.inline-drawer-content').length) {
                e.preventDefault();
                e.stopPropagation();
                $('#extensionsMenuButton').trigger('click').trigger('focus');
                return;
            }
        }

        // 3. Select Chat Popup
        const $selectChat = $('#select_chat_popup');
        if ($selectChat.is(':visible')) {
            e.preventDefault();
            e.stopPropagation();
            $('#select_chat_cross').trigger('click');
            return;
        }

        // 4. Floating Panels (AN, CFG, Logprobs)
        const panels = [
            { id: '#floatingPrompt', closeBtn: '#ANClose' },
            { id: '#cfgConfig', closeBtn: '#CFGClose' },
            { id: '#logprobsViewer', closeBtn: '#logprobsViewerClose' },
        ];

        for (let panel of panels) {
            const $p = $(panel.id);
            if ($p.is(':visible') && $p.css('opacity') !== '0') {
                e.preventDefault();
                e.stopPropagation();
                $(panel.closeBtn).trigger('click');
                return;
            }
        }

        // 5. Export Format Popup
        const $exportFormat = $('#export_format_popup');
        if ($exportFormat.is(':visible')) {
            e.preventDefault();
            e.stopPropagation();
            $exportFormat.hide();
            return;
        }
    });

    // --- F. Application Event Integration ---

    // 1. Generation Started
    eventSource.on(event_types.GENERATION_STARTED, (type) => {
        if (!isA11yEnabled || type === 'quiet') return;
        isAiGenerating = true;
        announceA11y('AI is generating response...');
        // Focus Stop button so user can easily cancel
        setTimeout(() => {
            document.getElementById('mes_stop')?.focus();
        }, 50);
    });

    // 2. Message Rendered (Generation Finished/Updated)
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (mid) => {
        isAiGenerating = false;
        const msg = /** @type {any} */ (chat[mid]);
        if (msg) announceA11y(`AI has replied: ${msg.mes}`);

        // Update roving tabindex: Set focusable to the NEW last message
        $('#chat .mes').attr('tabindex', '-1');
        $('#chat .mes').last().attr('tabindex', '0');

        // Move focus back to input for continuation
        $('#send_textarea').trigger('focus');
    });

    // 3. Generation Stopped Manually
    eventSource.on(event_types.GENERATION_STOPPED, () => {
        isAiGenerating = false;
        announceA11y('AI generation stopped.');
        $('#send_textarea').trigger('focus');
    });

    // Chat Focus Trap (Legacy Wrapper)
    const sheldEl = document.getElementById('sheld');
    if (sheldEl) sheldEl.addEventListener('keydown', (e) => {
        if (!isA11yEnabled) return;
        trapFocusInChat(e);
    });

    // Prevent accidental navigation away when editing
    window.addEventListener('beforeunload', (e) => {
        if (isChatSaving || (typeof this_edit_mes_id === 'number' && this_edit_mes_id >= 0)) {
            e.preventDefault();
            e.returnValue = true;
        }
    });

    // Special handler: Allow escaping the QR message editor (which traps Tab by default)
    $(document).on('keydown', '#qr--modal-message', function (e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();

            // Find next focusable element outside the textarea
            const $popup = $(this).closest('.popup-body');
            const $focusable = $popup.find('button, [href], input, select, textarea, [tabindex]:not([tabindex="-1"])').filter(':visible:not(:disabled)');
            const index = $focusable.index(this);

            if (index > -1 && index < $focusable.length - 1) {
                $focusable.eq(index + 1).trigger('focus');
            } else {
                $popup.find('.popup-button-ok').trigger('focus');
            }
            announceA11y('Exited text editor.');
        }
    });

    // --- G. UI Landmarks Setup ---
    // Defines ARIA landmarks to help screen readers navigate major regions.
    const setupLandmarks = () => {
        $('#top-settings-holder').attr({ 'role': 'banner', 'aria-label': 'Main Navigation' });
        $('#left-nav-panel').attr({ 'role': 'region', 'aria-label': 'AI Configuration' });
        $('#right-nav-panel').attr({ 'role': 'region', 'aria-label': 'Character Management' });
        $('#sheld').attr({ 'role': 'main', 'aria-label': 'Chat Log' });
        $('#send_form').attr({ 'role': 'form', 'aria-label': 'Message Input' });
    };
    setupLandmarks();

    // --- H. Navigation Bar Shortcuts (Smart Escape) ---
    // Determines where to move focus when Escape is pressed in various contexts.
    $(document).on('keydown', function (e) {
        if (!isA11yEnabled || e.key !== 'Escape') return;

        // Case 1: Escape in Main Input -> Go to Left Nav (Toggle)
        if ($(e.target).is('#send_textarea')) {
            e.preventDefault();
            $('#leftNavDrawerIcon').trigger('focus');
            announceA11y('Focus moved to Navigation Bar');
            return;
        }

        // Case 2: Escape in Left Panel
        if ($(e.target).closest('#left-nav-panel').length) {
            // If pinned, just go to input. If floating, close it (via focus loss logic elsewhere) or move to toggle.
            if ($('#lm_button_panel_pin').is(':checked')) {
                e.preventDefault();
                $('#send_textarea').trigger('focus');
                announceA11y('Focus moved to Chat Input');
            } else {
                setTimeout(() => $('#leftNavDrawerIcon').trigger('focus'), 50);
            }
            return;
        }

        // Case 3: Escape in Right Panel
        if ($(e.target).closest('#right-nav-panel').length) {
            if ($('#rm_button_panel_pin').is(':checked')) {
                e.preventDefault();
                $('#send_textarea').trigger('focus');
                announceA11y('Focus moved to Chat Input');
            } else {
                setTimeout(() => $('#rightNavDrawerIcon').trigger('focus'), 50);
            }
            return;
        }
    });

    // 3. Initial Execution
    // Apply rules immediately upon load if enabled
    applyGenericA11yRules(document.body);
    enhanceSpecificA11y();
}
