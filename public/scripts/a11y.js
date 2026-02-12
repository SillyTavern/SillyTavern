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
import { callGenericPopup, POPUP_TYPE, POPUP_RESULT, Popup } from './popup.js';

let isA11yEnabled = true;
let mainObserver = null;

// ============================================================================
// DEBUGGING UTILITIES
// ============================================================================
const DEBUG_FOCUS = false;

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
    '.a11y-sort-button', // Generalized sort button
    '.extensions_toolbar button',
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
    '#completion_prompt_manager_list',
    '.regex-debugger-rules-list ul', // Regex Debugger Lists
    '.regex-script-container', // Regex Manager Lists
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
    '.qr--item',
    '.qr--set-item',
    '.completion_prompt_manager_prompt',
    '.regex-debugger-rule',
    '.regex-script-label',
    '.extension_block',
].join(', ');

const toolbarSelectors = [
    '.jg-menu',
    '.qr--head',
    '.regex_bulk_operations',
    '.extensions_toolbar',
].join(', ');

const tabListSelectors = [
    '#bg_tabs .bg_tabs_list',
].join(', ');

const tabItemSelectors = [
    '#bg_tabs .bg_tabs_list .bg_tab_button',
].join(', ');

/**
 * Standard processors for common accessibility roles.
 * Can be used by extensions via registerA11ySelector.
 */
export const a11yProcessors = {
    button: (element) => {
        if (!element.hasAttribute('role')) element.setAttribute('role', 'button');
        if (!element.hasAttribute('tabindex') && element.tagName !== 'BUTTON' && element.tagName !== 'A') {
            element.setAttribute('tabindex', '0');
        }
    },
    list: (element) => {
        if (!element.hasAttribute('role')) element.setAttribute('role', 'list');
    },
    listItem: (element) => {
        if (!element.hasAttribute('role')) element.setAttribute('role', 'listitem');
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
 * Registry mapping selector strings to processor functions.
 * @type {Map<string, (element: Element) => void>}
 */
const a11yRegistry = new Map();

// Initialize registry with default rules
a11yRegistry.set(buttonSelectors, a11yProcessors.button);
a11yRegistry.set(listSelectors, a11yProcessors.list);
a11yRegistry.set(listItemSelectors, a11yProcessors.listItem);
a11yRegistry.set(toolbarSelectors, a11yProcessors.toolbar);
a11yRegistry.set(tabListSelectors, a11yProcessors.tabList);
a11yRegistry.set(tabItemSelectors, a11yProcessors.tab);
a11yRegistry.set('#toast-container .toast', a11yProcessors.status);

/**
 * Registers a new accessibility rule for a CSS selector.
 * If accessibility is currently enabled, the rule is applied immediately to existing elements.
 *
 * @param {string} selector - CSS selector to match elements.
 * @param {((element: Element) => void) | string} processor - Callback function (element) => void, or a string key of a default processor ('button', 'list', etc.).
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

    // If enabled, apply immediately
    if (isA11yEnabled) {
        try {
            document.querySelectorAll(selector).forEach((el) => finalProcessor(el));
        } catch (e) {
            console.warn(`[A11y] Failed to apply new rule for selector "${selector}":`, e);
        }
    }
}

/**
 * Apply generic accessibility rules to an element based on registered selectors.
 * @param {Element} rootElement Element to process.
 */
function applyGenericA11yRules(rootElement) {
    try {
        for (const [selector, rule] of a11yRegistry.entries()) {
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
// PART 2: GENERALIZED SORTING LOGIC
// ============================================================================

/**
 * Opens the sort menu using generic popup.
 * @param {HTMLElement} triggerElement The button that triggered the menu.
 * @param {string} itemSelector CSS selector for the item being sorted (e.g. '.qr--item')
 * @param {string} containerSelector CSS selector for the container (e.g. '#qr--global-setList')
 */
async function handleSortMenu(triggerElement, itemSelector, containerSelector) {
    const $li = $(triggerElement).closest(itemSelector);
    const $container = $li.closest(containerSelector);
    const $allItems = $container.children(itemSelector); // Only direct children

    if ($allItems.length === 0) return;

    const total = $allItems.length;
    const currentIndex = $allItems.index($li);
    const displayIndex = currentIndex + 1;

    // Try to find a meaningful name
    let itemName = $li.find('.completion_prompt_manager_prompt_name, .qr--set option:selected, .qr--set-itemLabel, .regex_script_name').first().val() ||
                   $li.find('.completion_prompt_manager_prompt_name, .qr--set option:selected, .qr--set-itemLabel, .regex_script_name').first().text() ||
                   'Item';

    itemName = String(itemName).trim();

    logDebug('handleSortMenu', `Opening sort buttons for item: ${displayIndex}/${total}`);
    announceA11y(`Sorting ${itemName}. Current position: ${displayIndex} of ${total}.`);

    // Pause any active trap
    if (promptManagerTrap) try { promptManagerTrap.pause(); } catch (e) {}
    if (qrEditorTrap) try { qrEditorTrap.pause(); } catch (e) {}
    if (regexEditorTrap) try { regexEditorTrap.pause(); } catch (e) {}

    await callGenericPopup(
        `<h3>Sort Item</h3><p>Move <b>${itemName}</b> (Position ${displayIndex} of ${total})</p>`,
        POPUP_TYPE.TEXT,
        '',
        {
            okButton: false,
            cancelButton: 'Close',
            wide: true,
            customButtons: [
                {
                    text: 'Move Up',
                    result: POPUP_RESULT.CUSTOM1,
                    action: () => performGenericSortAction($li, $container, itemSelector, 'up'),
                },
                {
                    text: 'Move Down',
                    result: POPUP_RESULT.CUSTOM2,
                    action: () => performGenericSortAction($li, $container, itemSelector, 'down'),
                },
                {
                    text: 'To Top',
                    result: POPUP_RESULT.CUSTOM3,
                    action: () => performGenericSortAction($li, $container, itemSelector, 'top'),
                },
                {
                    text: 'To Bottom',
                    result: POPUP_RESULT.CUSTOM4,
                    action: () => performGenericSortAction($li, $container, itemSelector, 'bottom'),
                },
                {
                    text: 'Jump to...',
                    result: POPUP_RESULT.CUSTOM5,
                    action: () => setTimeout(() => handleGenericJumpAction($li, $container, itemSelector), 150),
                },
            ],
        },
    );
}

/**
 * Handles jumping to a specific position (Generic).
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

/**
 * Performs the move and triggers save/events.
 */
function performGenericSortAction($item, $container, itemSelector, action, targetIndex = null) {
    const $allItems = $container.children(itemSelector);
    const currentIndex = $allItems.index($item);
    let newIndex = currentIndex;
    let changed = false;

    logDebug('SortAction', `Performing sort. Action: ${action}, Current: ${currentIndex}`);

    if (action === 'up') {
        if (currentIndex > 0) {
            $item.insertBefore($allItems.eq(currentIndex - 1));
            newIndex = currentIndex - 1;
            changed = true;
        }
    } else if (action === 'down') {
        if (currentIndex < $allItems.length - 1) {
            $item.insertAfter($allItems.eq(currentIndex + 1));
            newIndex = currentIndex + 1;
            changed = true;
        }
    } else if (action === 'top') {
        if (currentIndex > 0) {
            $item.prependTo($container);
            newIndex = 0;
            changed = true;
        }
    } else if (action === 'bottom') {
        if (currentIndex < $allItems.length - 1) {
            $item.appendTo($container);
            newIndex = $allItems.length - 1;
            changed = true;
        }
    } else if (action === 'jump' && targetIndex !== null) {
        if (targetIndex !== currentIndex) {
            if (targetIndex <= 0) {
                $item.prependTo($container);
                newIndex = 0;
            } else if (targetIndex >= $allItems.length - 1) {
                $item.appendTo($container);
                newIndex = $allItems.length - 1;
            } else {
                const $target = $allItems.eq(targetIndex);
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

        // Trigger sortable update if jQuery UI sortable is used
        if ($container.data('ui-sortable')) {
            /** @type {any} */ ($container).sortable('refresh');
            $container.trigger('sortupdate');
        } else {
            // Fallback for custom lists not using standard sortupdate listeners (e.g. Quick Replies)
            $container.trigger('sortupdate');
        }

        announceA11y(`Moved. New position: ${newIndex + 1}.`);
    } else {
        announceA11y('Position not changed.');
    }

    // Restore Focus
    setTimeout(() => {
        const $triggerBtn = $item.find('.a11y-sort-button');
        logDebug('SortAction', 'Restoring focus to sort button');
        $triggerBtn.trigger('focus');
    }, 100);
}

// ============================================================================
// PART 3: ADVANCED INTERACTIVE LOGIC
// Handles focus management, focus traps, chat semantics, and keyboard events.
// ============================================================================

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

let lastFocusedBeforeTrap = null;
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
    if (!isA11yEnabled) return;
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
 * Core function to enhance specific complex DOM elements.
 */
const enhanceSpecificA11y = () => {
    if (!isA11yEnabled) return;

    // --- 1. Chat Message Refactoring ---
    $('#chat .mes').each(function () {
        const $mes = $(this);
        if ($mes.hasClass('a11y-refactored')) return;

        const $nameText = $mes.find('.name_text');
        const charName = $nameText.text() || 'System';
        const isUser = $mes.attr('is_user') === 'true';
        const timestamp = $mes.find('.timestamp').text().trim();

        // Discord Pattern: Only the last message is focusable via Tab by default.
        // Others are reached via Arrow Keys (Roving Tabindex).
        const isLast = $mes.is(':last-child');
        $mes.attr({
            'role': 'article',
            'tabindex': isLast ? '0' : '-1',
        }).addClass('a11y-refactored');

        // Character name and timestamp as H3 Heading
        // Allows screen reader users to jump between messages using 'H' or 'Shift+H'
        if ($nameText.length) {
            $nameText.attr({
                'role': 'heading',
                'aria-level': '3',
                'aria-label': `${isUser ? 'You' : charName} ${timestamp ? ', ' + timestamp : ''}`,
            });
        }

        // Hide decorative elements from screen readers
        $mes.find('.mesIDDisplay, .extraMesButtons, .drag-handle, .swipes-counter, .mes_timer, .timestamp').attr('aria-hidden', 'true');
    });

    // --- 2. Standard Input Labeling ---
    // Removed .inline-drawer-content from the selector string to prevent massive mis-labeling in drawers
    // This fixes issues where buttons in TTS/Summary extensions were wrongly bound to the first label in the drawer.
    const containerSelector = '.range-block, .flex-container, .completion_prompt_manager_popup_entry_form_control, .world_entry_form_control';
    $('input:not([type="range"]), textarea, select').each(function () {
        const $el = $(this);
        if ($el.is('[type="hidden"]')) return;

        let id = $el.attr('id');
        if (!id) {
            id = 'st-a11y-' + Math.random().toString(36).substr(2, 5);
            $el.attr('id', id);
        }

        const $container = $el.closest(containerSelector);
        if (!$container.length) return;

        // Try to find a label or header within the container
        let $title = $container.find('label, h4, h3, .range-block-title, b, .justifyLeft, small, strong').first();
        // If element is wrapped in label
        if ($el.parent('label').length) {
            $title = $el.parent('label').find('span, strong, small').first();
        }

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

    // --- 3. Inline Drawers ---
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

        // Added aria-expanded to drawer toggles to communicate state
        $header.attr({
            'role': 'button',
            'tabindex': '0',
            'aria-expanded': isExpanded ? 'true' : 'false',
            'aria-controls': contentId,
        });

        $icon.attr({
            'aria-hidden': 'true',
            'tabindex': '-1',
        }).removeAttr('role');

        const $title = $header.find('b, strong, span').first();
        if ($title.length) {
            const titleId = $title.attr('id') || 'title-' + contentId;
            $title.attr('id', titleId);
            $header.attr('aria-labelledby', titleId);
        }
    });

    // --- 4. Range Sliders ---
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

    // --- 5. Character Expressions Fixes ---
    $('#expression_api, #expression_fallback').each(function() {
        const id = this.id;
        const $label = $(`label[for="${id}"]`);
        if ($label.length) {
            const labelId = $label.attr('id') || `a11y-label-${id}`;
            $label.attr('id', labelId);
            $(this).attr('aria-labelledby', labelId);
        }
    });

    // --- 6. Image Generation Fixes ---
    const imgGenFixes = ['sd_refine_mode', 'sd_function_tool', 'sd_interactive_mode', 'sd_multimodal_captioning', 'sd_free_extend', 'sd_snap', 'sd_minimal_prompt_processing', 'sd_novel_anlas_guard'];
    imgGenFixes.forEach(id => {
        const $el = $('#' + id);
        if ($el.length) {
            const title = $el.parent().attr('title');
            if (title && !$el.attr('aria-label')) {
                $el.attr('aria-label', title);
            }
        }
    });

    // Explicit binding for SD fields that generic logic misses or misidentifies
    const sdIds = [
        'sd_source', 'sd_seed', 'sd_style',
        'sd_prompt_prefix', 'sd_negative_prompt',
        'sd_character_prompt', 'sd_character_negative_prompt',
        'sd_model', 'sd_vae', 'sd_sampler', 'sd_scheduler',
        'sd_resolution', 'sd_hr_upscaler',
    ];

    sdIds.forEach(id => {
        const $el = $('#' + id);
        if (!$el.length) return;

        let $label = $(`label[for="${id}"]`);

        // Specific fallback for sd_style which often lives under a header
        if (!$label.length && id === 'sd_style') {
            $label = $el.closest('.flex-container').prev('h4');
        }

        if ($label.length) {
            const labelId = $label.attr('id') || `a11y-lbl-${id}`;
            $label.attr('id', labelId);
            $el.attr('aria-labelledby', labelId);
            $el.removeAttr('aria-describedby');
        }
    });

    // Chat Message Visibility Checkboxes
    const $visHeader = $('h4[data-i18n="Chat Message Visibility (by source)"]');
    const $visDesc = $visHeader.next('small');
    if ($visHeader.length && $visDesc.length) {
        $visDesc.attr('id', 'sd-vis-desc');
        $('#sd_wand_visible, #sd_command_visible, #sd_interactive_visible, #sd_tool_visible').each(function() {
            const existingLabelledBy = $(this).attr('aria-labelledby') || '';
            if (!existingLabelledBy.includes('sd-vis-desc')) {
                $(this).attr('aria-describedby', 'sd-vis-desc');
            }
        });
    }

    // --- 7. Image Prompt Templates Fixes ---
    $('#sd_prompt_templates textarea').each(function() {
        const id = this.id;
        const $labelWrapper = $(this).prev('.title_restorable');
        if ($labelWrapper.length) {
            const $label = $labelWrapper.find(`label[for="${id}"]`);
            const $resetBtn = $labelWrapper.find('.menu_button.fa-undo');

            if ($label.length) {
                const labelId = $label.attr('id') || `a11y-lbl-${id}`;
                $label.attr('id', labelId);
                $(this).attr('aria-labelledby', labelId);

                if ($resetBtn.length) {
                    $resetBtn.attr({
                        'role': 'button',
                        'tabindex': '0',
                        'aria-label': 'Restore default: ' + $label.text(),
                    });
                }
            }
        }
    });

    // --- 8. TTS Fixes ---
    const $ttsProviderLabelSpan = $('#drawer-n8gxyt > span[data-i18n="Select TTS Provider"]');
    if ($ttsProviderLabelSpan.length) {
        $ttsProviderLabelSpan.attr('id', 'lbl-tts-provider-text');
        $('#tts_provider').attr('aria-labelledby', 'lbl-tts-provider-text').removeAttr('aria-describedby');
    }
    $('#tts_voices').removeAttr('aria-labelledby aria-describedby');

    $('#tts_refresh').attr('aria-label', 'Reload TTS Provider');

    $('#tts_provider_settings select, #tts_provider_settings input').each(function() {
        const id = this.id;
        const $label = $(`label[for="${id}"]`);
        if ($label.length) {
            const labelId = $label.attr('id') || `a11y-lbl-${id}`;
            $label.attr('id', labelId);
            $(this).attr('aria-labelledby', labelId);
        }
    });

    // --- 9. Caption Fixes ---
    const $captionSourceLabel = $('label[for="caption_source"]');
    if ($captionSourceLabel.length) {
        const lblId = $captionSourceLabel.attr('id') || 'lbl-caption-source';
        $captionSourceLabel.attr('id', lblId);
        $('#caption_source').attr('aria-labelledby', lblId).removeAttr('aria-describedby');
    }

    $('#caption_template, #caption_prompt').each(function() {
        const id = this.id;
        const $label = $(`label[for="${id}"]`);
        if ($label.length) {
            const labelId = $label.attr('id') || `a11y-lbl-${id}`;
            $label.attr('id', labelId);
            $(this).attr('aria-labelledby', labelId);
            $(this).removeAttr('aria-describedby');
        }
    });

    // --- 10. Summary Fixes ---
    const $sumSourceLabel = $('label[for="summary_source"]');
    if ($sumSourceLabel.length) {
        $sumSourceLabel.attr('id', 'lbl-sum-source');
        $('#summary_source').attr('aria-labelledby', 'lbl-sum-source').removeAttr('aria-describedby');
    }
    const $sumContentLabelSpan = $('#summaryExtensionDrawerContents span[data-i18n="ext_sum_current_summary"]');
    if ($sumContentLabelSpan.length) {
        $sumContentLabelSpan.attr('id', 'lbl-sum-content');
        $('#memory_contents').attr('aria-labelledby', 'lbl-sum-content').removeAttr('aria-describedby');
    }

    $('#summarySettingsBlock input, #summarySettingsBlock textarea, #summarySettingsBlock select').each(function() {
        const id = this.id;
        if (!id) return;
        if (id === 'memory_depth' || id === 'memory_role') {
            const $groupLabel = $('#label-st-a11y-0cwm1');
            if ($groupLabel.length) {
                $(this).attr('aria-labelledby', $groupLabel.attr('id'));
            }
            return;
        }
        const $label = $(`label[for="${id}"]`);
        if ($label.length) {
            const labelId = $label.attr('id') || `a11y-lbl-${id}`;
            $label.attr('id', labelId);
            $(this).attr('aria-labelledby', labelId);
        }
    });

    // --- 11. Translation Extension Fixes ---
    const transIds = ['translation_target_language', 'translation_provider', 'translation_auto_mode'];
    transIds.forEach(id => {
        const $el = $('#' + id);
        if (!$el.length) return;
        const $label = $(`label[for="${id}"]`);
        if ($label.length) {
            const labelId = $label.attr('id') || `a11y-lbl-${id}`;
            $label.attr('id', labelId);
            $el.attr('aria-labelledby', labelId);
        }
    });

    // --- 11b. Extensions: Assets URL Binding ---
    // Specifically binds the Assets URL input to both its label and the hint text
    const $assetsField = $('#assets-json-url-field');
    if ($assetsField.length) {
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

    // --- 12. Quick Replies & Prompt Manager Sorting ---
    // Inject sort button into Prompt Manager items if missing
    $('.completion_prompt_manager_prompt').each(function () {
        const $li = $(this);
        const $controls = $li.find('.prompt_manager_prompt_controls');
        if ($controls.length && $controls.find('.a11y-sort-button').length === 0) {
            const $sortBtn = $('<span>', {
                class: 'a11y-sort-button fa-solid fa-sort fa-xs',
                role: 'button',
                tabindex: '0',
                title: 'Sort',
                'aria-label': 'Sort Prompt',
            });
            $controls.prepend($sortBtn);

            $sortBtn.on('click keydown', function(e) {
                if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                e.stopPropagation();
                handleSortMenu(this, '.completion_prompt_manager_prompt', '#completion_prompt_manager_list');
            });
        }
    });

    // Quick Replies: Enhanced Logic for Containers and Items
    const qrContainers = [
        { id: '#qr--global', label: 'Global Quick Reply Sets' },
        { id: '#qr--chat', label: 'Chat Quick Reply Sets' },
        { id: '#qr--character', label: 'Character Quick Reply Sets' },
    ];

    qrContainers.forEach(container => {
        const $cont = $(container.id);
        if (!$cont.length) return;

        // 1. Fix Container Title ID for referencing
        const $title = $cont.find('.qr--title');
        const titleId = `lbl-${container.id.substring(1)}-title`;
        $title.attr('id', titleId);

        // 2. Fix "Add" button binding
        const $addBtn = $cont.find('.qr--setListAdd');
        $addBtn.attr('aria-label', `Add new ${container.label}`);

        // 3. Process Items within this container
        $cont.find('.qr--item').each(function() {
            const $li = $(this);

            // Fix Select Box binding
            // The select box (.qr--set) should be labelled by the container title
            const $select = $li.find('.qr--set');
            $select.removeAttr('aria-labelledby aria-describedby').attr('aria-labelledby', titleId);

            // Get current set name for binding other buttons
            const setName = $select.find('option:selected').text() || 'Set';

            // Bind "Buttons" checkbox
            const $cbLabel = $li.find('.qr--visible');
            const $cbInput = $cbLabel.find('input');
            $cbLabel.removeAttr('title'); // Remove tooltip to avoid reading duplicate
            $cbInput.attr('aria-label', `Show buttons for set: ${setName}`).removeAttr('aria-describedby');

            // Bind "Edit" button
            $li.find('.fa-pencil').parent().attr('aria-label', `Edit set: ${setName}`);

            // Bind "Remove" button
            $li.find('.qr--del').attr('aria-label', `Remove set: ${setName}`);

            // Inject Sort Button if missing
            if ($li.find('.a11y-sort-button').length === 0) {
                const $sortBtn = $('<div>', {
                    class: 'a11y-sort-button menu_button menu_button_icon fa-solid fa-sort interactable',
                    role: 'button',
                    tabindex: '0',
                    title: 'Sort',
                    'aria-label': `Sort set: ${setName}`,
                });

                const $delBtn = $li.find('.qr--del');
                if ($delBtn.length) {
                    $sortBtn.insertBefore($delBtn);
                } else {
                    $li.append($sortBtn);
                }

                $sortBtn.on('click keydown', function(e) {
                    if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
                    e.preventDefault();
                    e.stopPropagation();
                    handleSortMenu(this, '.qr--item', container.id + '-setList');
                });
            } else {
                // Update existing sort button label if set name changed
                $li.find('.a11y-sort-button').attr('aria-label', `Sort set: ${setName}`);
            }
        });
    });

    // Quick Replies: Editor Items (Individual Replies)
    $('.qr--set-item').each(function() {
        const $li = $(this);
        const $targetContainer = $li.find('.qr--set-itemLabelContainer');
        const replyLabel = $li.find('.qr--set-itemLabel').val() || 'Quick Reply';

        if ($targetContainer.length && $li.find('.a11y-sort-button').length === 0) {
            const $sortBtn = $('<div>', {
                class: 'a11y-sort-button menu_button menu_button_icon fa-solid fa-sort interactable',
                role: 'button',
                tabindex: '0',
                title: 'Sort',
                'aria-label': `Sort reply: ${replyLabel}`,
            });
            $targetContainer.append($sortBtn);

            $sortBtn.on('click keydown', function(e) {
                if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                e.stopPropagation();
                handleSortMenu(this, '.qr--set-item', '.qr--set-qrListContents');
            });
        } else {
            $li.find('.a11y-sort-button').attr('aria-label', `Sort reply: ${replyLabel}`);
        }
    });

    // --- 13. Regex Sorting & Fixes ---
    $('.regex-script-label').each(function() {
        const $row = $(this);
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

            $sortBtn.on('click keydown', function(e) {
                if (e.type === 'keydown' && e.key !== 'Enter' && e.key !== ' ') return;
                e.preventDefault();
                e.stopPropagation();
                handleSortMenu(this, '.regex-script-label', '.regex-script-container');
            });
        }
    });

    $('.regex-script-container label.checkbox').each(function() {
        const $lbl = $(this);
        $lbl.removeAttr('for');

        if (!$lbl.attr('tabindex')) {
            const $inp = $lbl.find('input');
            const scriptName = $lbl.closest('.regex-script-label').find('.regex_script_name').text() || 'Script';

            $lbl.attr({
                'role': 'checkbox',
                'tabindex': '0',
                'aria-label': $inp.hasClass('disable_regex') ? `Enable script: ${scriptName}` : `Toggle ${scriptName}`,
            });

            const isChecked = $inp.prop('checked');
            $lbl.attr('aria-checked', isChecked ? 'true' : 'false');

            $inp.off('change.a11y').on('change.a11y', function() {
                $lbl.attr('aria-checked', $(this).prop('checked') ? 'true' : 'false');
            });
        }
    });

    // --- 14. Extension Popups & Manager ---
    // Install Popup
    const $installPopup = $('.popup:visible').filter(function() {
        return $(this).find('h3[data-i18n="Enter the Git URL of the extension to install"]').length > 0;
    });
    if ($installPopup.length) {
        const $h3 = $installPopup.find('h3');
        const h3Id = $h3.attr('id') || 'a11y-install-ext-title';
        $h3.attr('id', h3Id);
        $installPopup.find('.popup-input').attr('aria-labelledby', h3Id);
    }

    // Manager
    $('.extension_block').each(function() {
        const $block = $(this);
        const name = $block.find('.extension_name').text().trim();
        $block.find('.extension_toggle input').attr('aria-label', `Enable ${name}`);
        $block.find('.extension_actions button').each(function() {
            const title = $(this).attr('title') || 'Action';
            $(this).attr('aria-label', `${title} for ${name}`);
        });
    });

    // --- 15. General Fixes ---
    $('#rm_extensions_block h3[data-i18n="Extensions"]').attr('id', 'title_extensions');
    $('#extensions_notify_updates').attr('aria-labelledby', 'label-extensions_notify_updates');
    $('#main_api, #chat_completion_source').each(function() {
        if (!$(this).attr('aria-labelledby')) {
            $(this).attr('aria-labelledby', 'title_api');
        }
    });

    $('.select2-selection__choice__remove').each(function() {
        const $btn = $(this);
        $btn.attr('tabindex', '0');
        const $item = $btn.closest('.select2-selection__choice');
        const title = $item.attr('title') || $item.find('.select2-selection__choice__display').text();
        if (title) {
            $btn.attr('aria-label', `Remove ${title}`);
        }
    });

    // --- 16. Character Management Panel Fixes ---
    const charPanelButtons = [
        '#rm_button_bar .menu_button',
        '#rm_button_bar .right_menu_button',
        '#HotSwapWrapper .hotswap',
        '#rm_button_characters',
    ].join(', ');

    $(charPanelButtons).each(function() {
        const $btn = $(this);
        const title = $btn.attr('title') || $btn.attr('data-i18n-title') || $btn.attr('data-original-title');
        if (title && !$btn.attr('aria-label')) {
            $btn.attr('aria-label', title);
        }
    });

    // Sort Dropdown
    const $sortOrder = $('#character_sort_order');
    if ($sortOrder.length && !$sortOrder.attr('aria-label')) {
        $sortOrder.attr('aria-label', $sortOrder.attr('title') || 'Sort Characters');
    }

    // Tag Filters (Favorites, Groups, etc.)
    $('.rm_tag_filter .tag').each(function() {
        const $tag = $(this);
        if (!$tag.attr('aria-label')) {
            const title = $tag.find('.tag_name').attr('title');
            if (title) {
                $tag.attr('aria-label', title);
            }
        }
    });

    // Panel Pin Button
    const $panelPin = $('#rm_button_panel_pin');
    if ($panelPin.length && !$panelPin.attr('aria-label')) {
        const pinTitle = $panelPin.closest('#rm_button_panel_pin_div').attr('title');
        if (pinTitle) {
            $panelPin.attr('aria-label', pinTitle);
        }
    }

    // --- 17. Character Edit Panel (Avatar Controls) ---
    // Includes buttons like Advanced Definitions, World Info, etc.
    $('#avatar_controls .menu_button').each(function() {
        const $btn = $(this);
        // Skip keys that might have been covered by generic rules if they have aria-label already
        if ($btn.attr('aria-label')) return;

        const title = $btn.attr('title') || $btn.attr('data-i18n-title') || $btn.attr('data-original-title');
        if (title) {
            // Clean up title if it contains newlines (common in tooltips)
            const cleanTitle = title.split('\n')[0].trim();
            $btn.attr('aria-label', cleanTitle);
        }
    });

    // --- 18. World Info Selectors (Character & Chat) ---
    $('.character_world_info_selector, .chat_world_info_selector').each(function() {
        const $el = $(this);
        const $container = $el.closest('.range-block');
        const $label = $container.find('.range-block-title h3, .range-block-title h4').first();

        if ($label.length && !$el.attr('aria-labelledby')) {
            const labelId = $label.attr('id') || 'lbl-wi-' + Math.random().toString(36).substr(2, 5);
            $label.attr('id', labelId);
            $el.attr('aria-labelledby', labelId);
        }
    });

    // Additional Lorebooks (Select2)
    $('.character_extra_world_info_selector').each(function() {
        const $el = $(this);
        const $container = $el.closest('.range-block');
        // The label is usually the h4 preceding it
        const $label = $container.find('h4').first();

        if ($label.length) {
            const labelId = $label.attr('id') || 'lbl-wi-extra-' + Math.random().toString(36).substr(2, 5);
            $label.attr('id', labelId);
            $el.attr('aria-labelledby', labelId);

            // Also try to fix the Select2 search field if it exists and is visible
            const $s2Search = $container.find('.select2-search__field');
            if ($s2Search.length && !$s2Search.attr('aria-labelledby')) {
                $s2Search.attr('aria-labelledby', labelId);
                $s2Search.attr('placeholder', 'Search additional lorebooks...'); // Improve placeholder if generic
            }
        }
    });

    // --- 19. Persona Connections Popup ---
    const $personaPopup = $('.popup h3:contains("Persona Connections")').closest('.popup');
    if ($personaPopup.length && $personaPopup.is(':visible')) {
        const $list = $personaPopup.find('.persona-list');
        $list.attr({
            'role': 'list',
            'aria-label': 'Connected Personas List',
        });

        const $avatars = $list.find('.avatar'); // Assuming avatars are the items
        if ($avatars.length) {
            $avatars.attr('role', 'listitem').attr('tabindex', '0');
        } else if ($list.text().includes('no personas connected')) {
            $list.attr('aria-label', 'No personas connected');
        }

        $personaPopup.find('.popup-button-custom[data-result="2"]').attr('role', 'button');
    }

    // --- 20. Alternate Greetings Popup ---
    const $altGreetings = $('.alternate_greetings_list');
    if ($altGreetings.length && $altGreetings.is(':visible')) {
        $altGreetings.attr('role', 'list');

        // Add Button
        $('.add_alternate_greeting').attr({
            'role': 'button',
            'tabindex': '0',
            'aria-label': 'Add new greeting',
        });

        $altGreetings.find('.alternate_greeting').each(function() {
            const $item = $(this);
            $item.attr('role', 'listitem');

            // Controls
            $item.find('.move_up_alternate_greeting').attr('aria-label', 'Move greeting up');
            $item.find('.move_down_alternate_greeting').attr('aria-label', 'Move greeting down');
            $item.find('.delete_alternate_greeting').attr('aria-label', 'Delete greeting');
            $item.find('.editor_maximize').attr('aria-label', 'Maximize editor');

            // Textarea Labeling
            const index = $item.data('index');
            const $ta = $item.find('textarea');
            const $label = $item.find('strong span').first(); // "Alternate Greeting #"

            if ($ta.length && $label.length) {
                // Ensure unique ID
                const labelId = 'lbl-alt-greet-' + index;
                $label.closest('strong').attr('id', labelId);
                $ta.attr('aria-labelledby', labelId);
            }
        });
    }

    // --- 20.b Floating Panels & Popups ---
    // Floating Prompt (Author's Note)
    const $anPanel = $('#floatingPrompt');
    if ($anPanel.length) {
        $anPanel.attr({ 'role': 'dialog', 'aria-label': 'Author\'s Note Configuration' });
        $('#ANClose').attr({ 'role': 'button', 'tabindex': '0', 'aria-label': 'Close Author\'s Note' });
        $('#floatingPromptMaximize').attr({ 'role': 'button', 'tabindex': '0', 'aria-label': 'Maximize Author\'s Note' });
        $('#floatingPromptheader').attr('aria-hidden', 'true'); // Drag handle
    }

    // CFG Config
    const $cfgPanel = $('#cfgConfig');
    if ($cfgPanel.length) {
        $cfgPanel.attr({ 'role': 'dialog', 'aria-label': 'CFG Configuration' });
        $('#CFGClose').attr({ 'role': 'button', 'tabindex': '0', 'aria-label': 'Close CFG Config' });
        $('#cfgConfigMaximize').attr({ 'role': 'button', 'tabindex': '0', 'aria-label': 'Maximize CFG Config' });
    }

    // Logprobs Viewer
    const $logprobsPanel = $('#logprobsViewer');
    if ($logprobsPanel.length) {
        $logprobsPanel.attr({ 'role': 'dialog', 'aria-label': 'Token Probabilities' });
        $('#logprobsViewerClose').attr({ 'role': 'button', 'tabindex': '0', 'aria-label': 'Close Logprobs' });
        $('#logprobsMaximizeToggle').attr({ 'role': 'button', 'tabindex': '0', 'aria-label': 'Maximize Logprobs' });
        $('#logprovsViewerBlockToggle').attr({ 'role': 'button', 'tabindex': '0', 'aria-label': 'Toggle Logprobs View' });
        $('#logprobsReroll').attr({ 'role': 'button', 'tabindex': '0' });
    }

    // Select Chat Popup
    const $selectChat = $('#select_chat_popup');
    if ($selectChat.length) {
        $selectChat.attr({ 'role': 'dialog', 'aria-label': 'Chat History' });
        $('#select_chat_cross').attr({ 'role': 'button', 'tabindex': '0', 'aria-label': 'Close Chat History' });
        $('#newChatFromManageScreenButton, #chat_import_button').attr({ 'role': 'button', 'tabindex': '0' });
        // Ensure chat blocks are accessible
        $selectChat.find('.select_chat_block').attr({ 'role': 'listitem', 'tabindex': '0' });
        $selectChat.find('.chatBackupsList').attr('role', 'list');
    }

    // Data Bank (Attachments)
    const $dataBank = $('.dataBankAttachments');
    if ($dataBank.length) {
        $dataBank.closest('dialog').attr('aria-label', 'Data Bank');
        $('.attachmentSort').attr('aria-label', 'Sort attachments');
        $('.bulkActionSelectAll, .bulkActionSelectNone, .bulkActionDisable, .bulkActionEnable, .bulkActionDelete, .openActionModalButton')
            .attr({ 'role': 'button', 'tabindex': '0' });
    }

    // --- 21. Left Menu (#options) & Magic Wand Popup (#extensionsMenu) ---
    const $optionsBtn = $('#options_button');
    const $optionsMenu = $('#options');
    if ($optionsBtn.length && $optionsMenu.length) {
        const isExpanded = $optionsMenu.is(':visible') && $optionsMenu.find('.options-content').is(':visible');
        
        $optionsBtn.attr({
            'role': 'button',
            'tabindex': '0',
            'aria-haspopup': 'true',
            'aria-expanded': isExpanded ? 'true' : 'false',
            'aria-controls': 'options',
            'aria-label': 'User Options',
        });

        $optionsMenu.find('.options-content').attr({
            'role': 'menu',
            'aria-labelledby': 'options_button',
        });

        $optionsMenu.find('a').attr({
            'role': 'menuitem',
            'tabindex': '0',
        });
    }

    const $extBtn = $('#extensionsMenuButton');
    const $extMenu = $('#extensionsMenu');
    if ($extBtn.length && $extMenu.length) {
        const isExpanded = $extMenu.is(':visible');

        $extBtn.attr({
            'role': 'button',
            'tabindex': '0',
            'aria-haspopup': 'true',
            'aria-expanded': isExpanded ? 'true' : 'false',
            'aria-controls': 'extensionsMenu',
            'aria-label': 'Extensions Menu',
        });

        $extMenu.attr({
            'role': 'menu',
            'aria-labelledby': 'extensionsMenuButton',
        });

        // The items inside are .extension_container, sometimes containing .list-group-item
        $extMenu.find('.list-group-item').attr({
            'role': 'menuitem',
            'tabindex': '0',
        });
    }
};

/**
 * Manages focus traps for various popups.
 */
const managePopupTraps = () => {
    if (!focusTrap || !isA11yEnabled) {
        if (currentFocusTrap) { try { currentFocusTrap.deactivate(); } catch (e) {} currentFocusTrap = null; }
        if (promptManagerTrap) { try { promptManagerTrap.deactivate(); } catch (e) {} promptManagerTrap = null; }
        if (charPopupTrap) { try { charPopupTrap.deactivate(); } catch (e) {} charPopupTrap = null; }
        if (worldInfoTrap) { try { worldInfoTrap.deactivate(); } catch (e) {} worldInfoTrap = null; }
        if (qrEditorTrap) { try { qrEditorTrap.deactivate(); } catch (e) {} qrEditorTrap = null; }
        if (regexEditorTrap) { try { regexEditorTrap.deactivate(); } catch (e) {} regexEditorTrap = null; }
        return;
    }

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
    const isSortMenuOpen = $('.list-group[role="menu"]').is(':visible');

    if (isPromptActive) {
        if (isSortMenuOpen) {
            if (promptManagerTrap) try { promptManagerTrap.pause(); } catch (e) {}
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
                try { promptManagerTrap.activate(); } catch (e) {}
            } else {
                try { promptManagerTrap.unpause(); } catch (e) {}
            }
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

    // D. QR Editor
    const $qrEditor = $('#qr--modalEditor');
    if ($qrEditor.is(':visible')) {
        if (!qrEditorTrap) {
            lastFocusedBeforeTrap = document.activeElement;
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
                try { qrEditorTrap.activate(); } catch (e) {}
            }
        }
    } else if (qrEditorTrap) {
        try { qrEditorTrap.deactivate(); } catch (e) {}
        qrEditorTrap = null;
    }

    // E. Regex Editor / Debugger Popups
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
            try { regexEditorTrap.activate(); } catch (e) {}
        }
    } else if (regexEditorTrap) {
        try { regexEditorTrap.deactivate(); } catch (e) {}
        regexEditorTrap = null;
    }

    // F. Extensions Menu
    const $extMenu = $('#extensionsMenu');
    if ($extMenu.is(':visible')) {
        if (!extensionsMenuTrap) {
            lastFocusedBeforeTrap = document.activeElement;
            extensionsMenuTrap = focusTrap.createFocusTrap('#extensionsMenu', {
                allowOutsideClick: true,
                clickOutsideDeactivates: true,
                initialFocus: false, // Let user navigate naturally or set specific focus if needed
                escapeDeactivates: false, // Handled manually
                onDeactivate: () => {
                    if (lastFocusedBeforeTrap instanceof HTMLElement) lastFocusedBeforeTrap.focus();
                },
            });
            try { extensionsMenuTrap.activate(); } catch (e) {}
        }
    } else if (extensionsMenuTrap) {
        try { extensionsMenuTrap.deactivate(); } catch (e) {}
        extensionsMenuTrap = null;
    }

    // G. Options Menu (Left Side)
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
            try { optionsMenuTrap.activate(); } catch (e) {}
        }
    } else if (optionsMenuTrap) {
        try { optionsMenuTrap.deactivate(); } catch (e) {}
        optionsMenuTrap = null;
    }

    // H. Select Chat Popup
    const $selectChat = $('#select_chat_popup');
    if ($selectChat.is(':visible') && $selectChat.css('display') !== 'none') {
        if (!selectChatTrap) {
            lastFocusedBeforeTrap = document.activeElement;
            selectChatTrap = focusTrap.createFocusTrap('#select_chat_popup', {
                allowOutsideClick: true,
                clickOutsideDeactivates: false,
                initialFocus: '#select_chat_search',
                fallbackFocus: '#select_chat_popup',
                escapeDeactivates: false, // Handled via keydown listener
                onDeactivate: () => {
                    if (lastFocusedBeforeTrap instanceof HTMLElement) lastFocusedBeforeTrap.focus();
                },
            });
            try { selectChatTrap.activate(); } catch (e) {}
        }
    } else if (selectChatTrap) {
        try { selectChatTrap.deactivate(); } catch (e) {}
        selectChatTrap = null;
    }

    // I. Floating Panels (Author's Note, CFG, Logprobs)
    // Helper for floating panels
    const handleFloatingTrap = (id, trapVar, setTrapVar) => {
        const $el = $(id);
        // Check opacity because these panels often animate fade-out but stay display:flex for a moment
        if ($el.is(':visible') && $el.css('opacity') !== '0' && $el.css('display') !== 'none') {
            if (!trapVar) {
                if (!document.activeElement.closest('.drawer-content')) {
                    lastFocusedBeforeTrap = document.activeElement;
                }
                const newTrap = focusTrap.createFocusTrap(id, {
                    allowOutsideClick: true, // User might click between panels
                    clickOutsideDeactivates: false,
                    initialFocus: false,
                    fallbackFocus: id,
                    escapeDeactivates: false,
                    onDeactivate: () => {
                         if (lastFocusedBeforeTrap instanceof HTMLElement) lastFocusedBeforeTrap.focus();
                    },
                });
                setTrapVar(newTrap);
                try { newTrap.activate(); } catch (e) {}
            }
        } else if (trapVar) {
            try { trapVar.deactivate(); } catch (e) {}
            setTrapVar(null);
        }
    };

    handleFloatingTrap('#floatingPrompt', floatingPromptTrap, (t) => floatingPromptTrap = t);
    handleFloatingTrap('#cfgConfig', cfgConfigTrap, (t) => cfgConfigTrap = t);
    handleFloatingTrap('#logprobsViewer', logprobsTrap, (t) => logprobsTrap = t);

    // J. Data Bank / Attachments
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
            try { dataBankTrap.activate(); } catch (e) {}
        }
    } else if (dataBankTrap) {
        try { dataBankTrap.deactivate(); } catch (e) {}
        dataBankTrap = null;
    }

    // K. Token Counter
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
            try { tokenCounterTrap.activate(); } catch (e) {}
        }
    } else if (tokenCounterTrap) {
        try { tokenCounterTrap.deactivate(); } catch (e) {}
        tokenCounterTrap = null;
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

function cleanupA11y() {
    if (mainObserver) {
        mainObserver.disconnect();
        mainObserver = null;
    }

    if (currentFocusTrap) { try { currentFocusTrap.deactivate(); } catch (e) {} currentFocusTrap = null; }
    if (promptManagerTrap) { try { promptManagerTrap.deactivate(); } catch (e) {} promptManagerTrap = null; }
    if (charPopupTrap) { try { charPopupTrap.deactivate(); } catch (e) {} charPopupTrap = null; }
    if (worldInfoTrap) { try { worldInfoTrap.deactivate(); } catch (e) {} worldInfoTrap = null; }
    if (qrEditorTrap) { try { qrEditorTrap.deactivate(); } catch (e) {} qrEditorTrap = null; }
    if (regexEditorTrap) { try { regexEditorTrap.deactivate(); } catch (e) {} regexEditorTrap = null; }
    if (extensionTrap) { try { extensionTrap.deactivate(); } catch (e) {} extensionTrap = null; }
    if (extensionsMenuTrap) { try { extensionsMenuTrap.deactivate(); } catch (e) {} extensionsMenuTrap = null; }
    if (optionsMenuTrap) { try { optionsMenuTrap.deactivate(); } catch (e) {} optionsMenuTrap = null; }
    if (selectChatTrap) { try { selectChatTrap.deactivate(); } catch (e) {} selectChatTrap = null; }
    if (floatingPromptTrap) { try { floatingPromptTrap.deactivate(); } catch (e) {} floatingPromptTrap = null; }
    if (cfgConfigTrap) { try { cfgConfigTrap.deactivate(); } catch (e) {} cfgConfigTrap = null; }
    if (logprobsTrap) { try { logprobsTrap.deactivate(); } catch (e) {} logprobsTrap = null; }
    if (dataBankTrap) { try { dataBankTrap.deactivate(); } catch (e) {} dataBankTrap = null; }
    if (tokenCounterTrap) { try { tokenCounterTrap.deactivate(); } catch (e) {} tokenCounterTrap = null; }

    $('[role="button"], [role="list"], [role="listitem"], [role="toolbar"], [role="tablist"], [role="tab"], [role="status"]')
        .removeAttr('role tabindex aria-label aria-hidden aria-expanded aria-controls aria-pressed aria-valuemin aria-valuemax aria-describedby aria-labelledby');

    $('.a11y-sort-button').remove();
    $('.a11y-refactored').removeClass('a11y-refactored');
}

export function setAccessibilityEnabled(enabled) {
    if (isA11yEnabled === enabled && mainObserver) return;

    isA11yEnabled = enabled;

    if (!enabled) {
        cleanupA11y();
        return;
    }

    applyGenericA11yRules(document.body);
    enhanceSpecificA11y();

    const processA11yUpdates = debounce(() => {
        if (!isA11yEnabled) return;
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

    mainObserver = new MutationObserver((mutations) => {
        processA11yUpdates();
    });

    mainObserver.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['style', 'class', 'hidden', 'open'],
    });
}

export function initAccessibility() {
    // 1. Initial Static Cleanups
    $('#send_but').attr({
        'tabindex': '-1',
        'aria-hidden': 'true',
    });

    // 2. Global Event Bindings
    // Manages focus movement within the chat list.
    const moveMessageFocus = ($current, $target) => {
        if ($target.length) {
            $current.attr('tabindex', '-1');
            $target.attr('tabindex', '0').trigger('focus');
            $target[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    };

    $(document).on('keydown', '#chat .mes', function (e) {
        if (!isA11yEnabled) return;

        const $this = $(this);
        const $allMessages = $('#chat .mes:visible');
        const index = $allMessages.index($this);

        switch (e.key) {
            case 'ArrowDown':
                e.preventDefault();
                if (index < $allMessages.length - 1) {
                    moveMessageFocus($this, $allMessages.eq(index + 1));
                }
                break;
            case 'ArrowUp':
                e.preventDefault();
                if (index > 0) {
                    moveMessageFocus($this, $allMessages.eq(index - 1));
                }
                break;
            case 'Home':
                e.preventDefault();
                moveMessageFocus($this, $allMessages.first());
                announceA11y('Jumped to first message');
                break;
            case 'End':
                e.preventDefault();
                moveMessageFocus($this, $allMessages.last());
                announceA11y('Jumped to latest message');
                break;
            case 'Escape':
                e.preventDefault();
                $('#send_textarea').trigger('focus');
                announceA11y('Returned to text input');
                break;
        }
    });

    // Explicitly added #options_button and #extensionsMenuButton to ensure they work with Spacebar
    $(document).on('keydown', '[role="button"][tabindex="0"], .prompt-manager-toggle-action, .killSwitch, .inline-drawer-toggle, #options_button, #extensionsMenuButton', function (e) {
        if (!isA11yEnabled) return;
        if (e.key === 'Enter' || e.key === ' ') {
            e.preventDefault();
            if (this.tagName !== 'BUTTON') {
                $(this).trigger('click');
            }
        }
    });

    // Dynamic Focus Trap for Extensions
    $(document).on('click', '.extension_container .inline-drawer-toggle', function () {
        if (!isA11yEnabled) return;
        const $drawer = $(this).closest('.inline-drawer');
        const $content = $drawer.find('.inline-drawer-content');

        setTimeout(() => {
            if ($content.is(':visible')) {
                if (extensionTrap) try { extensionTrap.deactivate(); } catch (e) {}

                extensionTrap = focusTrap.createFocusTrap($drawer[0], {
                    allowOutsideClick: true,
                    clickOutsideDeactivates: true,
                    initialFocus: false,
                    fallbackFocus: $(this)[0],
                    escapeDeactivates: false,
                });
                try { extensionTrap.activate(); } catch (e) {}
            } else {
                if (extensionTrap) {
                    try { extensionTrap.deactivate(); } catch (e) {}
                    extensionTrap = null;
                }
            }
        }, 450);
    });

    // Label checkbox activation support
    // --- Escape Key Handler for Extension Drawers ---
    $(document).on('keydown', '.extension_container .inline-drawer', function (e) {
        if (!isA11yEnabled) return;
        if (e.key === 'Escape') {
            const $drawer = $(this);
            const $content = $drawer.find('.inline-drawer-content');

            if ($content.is(':visible')) {
                e.preventDefault();
                e.stopPropagation();

                const $header = $drawer.find('.inline-drawer-toggle');

                $header.trigger('click');
                $header.trigger('focus');

                if (typeof extensionTrap !== 'undefined' && extensionTrap) {
                    try { extensionTrap.deactivate(); } catch (e) {}
                    extensionTrap = null;
                }

                announceA11y('Extension menu closed.');
            }
        }
    });

    // --- Escape Key Handler for Main Menus & Popups ---
    $(document).on('keydown', function(e) {
        if (!isA11yEnabled || e.key !== 'Escape') return;

        // Options Menu
        const $optionsMenu = $('#options');
        if ($optionsMenu.is(':visible') && $optionsMenu.find('.options-content').is(':visible')) {
            if ($(e.target).closest('#options').length) {
                e.preventDefault();
                e.stopPropagation();
                $('#options_button').trigger('click').trigger('focus');
                return;
            }
        }

        // Extensions Menu
        const $extMenu = $('#extensionsMenu');
        if ($extMenu.is(':visible')) {
            if ($(e.target).closest('#extensionsMenu').length && !$(e.target).closest('.inline-drawer-content').length) {
                 e.preventDefault();
                 e.stopPropagation();
                 $('#extensionsMenuButton').trigger('click').trigger('focus');
                 return;
            }
        }

        // Select Chat Popup
        const $selectChat = $('#select_chat_popup');
        if ($selectChat.is(':visible')) {
            e.preventDefault();
            e.stopPropagation();
            $('#select_chat_cross').trigger('click');
            return;
        }

        // Floating Panel: Author's Note
        const $floatingPrompt = $('#floatingPrompt');
        if ($floatingPrompt.is(':visible') && $floatingPrompt.css('opacity') !== '0') {
            e.preventDefault();
            e.stopPropagation();
            $('#ANClose').trigger('click');
            return;
        }

        // Floating Panel: CFG
        const $cfg = $('#cfgConfig');
        if ($cfg.is(':visible') && $cfg.css('opacity') !== '0') {
             e.preventDefault();
             e.stopPropagation();
             $('#CFGClose').trigger('click');
             return;
        }

        // Floating Panel: Logprobs
        const $logprobs = $('#logprobsViewer');
        if ($logprobs.is(':visible') && $logprobs.css('opacity') !== '0') {
             e.preventDefault();
             e.stopPropagation();
             $('#logprobsViewerClose').trigger('click');
             return;
        }
    });

    // Debug listener for global focus changes
    if (DEBUG_FOCUS) {
        document.addEventListener('focusin', (e) => {
            if (e.target instanceof HTMLElement) {
                const id = e.target.id || 'no-id';
                const cls = e.target.className || 'no-class';
                logDebug('GlobalFocus', `Focus moved to: <${e.target.tagName} id="${id}" class="${cls}">`);
            } else {
                logDebug('GlobalFocus', 'Focus moved to non-element target');
            }
        });
    }

    eventSource.on(event_types.GENERATION_STARTED, (type) => {
        if (!isA11yEnabled || type === 'quiet') return;
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

        // Update roving tabindex: reset all and set the new latest message as the Tab target
        $('#chat .mes').attr('tabindex', '-1');
        $('#chat .mes').last().attr('tabindex', '0');

        $('#send_textarea').trigger('focus');
    });

    eventSource.on(event_types.GENERATION_STOPPED, () => {
        isAiGenerating = false;
        announceA11y('AI generation stopped.');
        $('#send_textarea').trigger('focus');
    });

    const sheldEl = document.getElementById('sheld');
    if (sheldEl) sheldEl.addEventListener('keydown', (e) => {
        if (!isA11yEnabled) return;
        trapFocusInChat(e);
    });

    window.addEventListener('beforeunload', (e) => {
        if (isChatSaving || (typeof this_edit_mes_id === 'number' && this_edit_mes_id >= 0)) {
            e.preventDefault();
            e.returnValue = true;
        }
    });

    // Special handler: Allow escaping the QR message editor (which consumes Tab)
    $(document).on('keydown', '#qr--modal-message', function (e) {
        if (e.key === 'Escape') {
            e.preventDefault();
            e.stopPropagation();

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

    // 3. Initial Execution
    applyGenericA11yRules(document.body);
    enhanceSpecificA11y();
}
