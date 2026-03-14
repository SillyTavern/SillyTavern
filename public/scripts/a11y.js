import { chat } from '../script.js';
import { t } from './i18n.js';
import { eventSource, event_types } from './events.js';
import { extension_settings } from './extensions.js';
import { focusTrap } from '../lib.js';

/** @type {boolean} Global flag indicating if accessibility enhancements are active. */
let isA11yEnabled = false;

/** @type {boolean} Tracks if the AI is currently generating a response to prevent duplicate announcements. */
let isAiGenerating = false;

/** @type {any} Tracks the currently active focus trap for drawers/popups. */
let currentFocusTrap = null;

const DEBUG_A11Y = new URLSearchParams(window.location.search).has(
    'debug_a11y',
);

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
    '.list-group-item',
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
const tabListSelectors = ['#bg_tabs .bg_tabs_list'].join(', ');

/** Selectors for individual tabs. */
const tabItemSelectors = ['#bg_tabs .bg_tabs_list .bg_tab_button'].join(', ');

const GENERIC_ATTR = 'data-a11y-generic';

/**
 * Standard processor functions for common accessibility roles.
 * These apply the basic ARIA role and tabindex if missing.
 */
export const a11yProcessors = {
    button: (element) => {
        if (!element.hasAttribute('role'))
            element.setAttribute('role', 'button');
        if (
            !element.hasAttribute('tabindex') &&
            element.tagName !== 'BUTTON' &&
            element.tagName !== 'A'
        ) {
            element.setAttribute('tabindex', '0');
        }
    },
    list: (element) => {
        if (!element.hasAttribute('role')) element.setAttribute('role', 'list');
    },
    listItem: (element) => {
        if (!element.hasAttribute('role'))
            element.setAttribute('role', 'listitem');
        if (
            element.hasAttribute('tabindex') &&
            element.getAttribute('tabindex') === '0' &&
            (element.classList.contains('completion_prompt_manager_prompt') ||
                element.classList.contains('qr--item') ||
                element.classList.contains('regex-script-label') ||
                element.classList.contains('list-group-item'))
        ) {
            element.removeAttribute('tabindex');
        }
    },
    toolbar: (element) => {
        if (!element.hasAttribute('role'))
            element.setAttribute('role', 'toolbar');
    },
    tabList: (element) => {
        if (!element.hasAttribute('role'))
            element.setAttribute('role', 'tablist');
    },
    tab: (element) => {
        if (!element.hasAttribute('role')) element.setAttribute('role', 'tab');
    },
    status: (element) => {
        if (!element.hasAttribute('role'))
            element.setAttribute('role', 'status');
    },
};

/**
 * Registry mapping CSS selector strings to processor functions.
 * @type {Map<string, (element: Element) => void>}
 */
const a11yRegistry = new Map();

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
 * @param {((element: Element) => void) | string} processor - Callback function or a string key of a default processor.
 */
export function registerA11ySelector(selector, processor) {
    /** @type {(element: Element) => void} */
    let finalProcessor;

    if (typeof processor === 'string') {
        if (a11yProcessors[processor]) {
            finalProcessor = a11yProcessors[processor];
        } else {
            console.warn(
                `[A11y] Unknown processor type: ${processor}. Defaulting to no-op.`,
            );
            return;
        }
    } else if (typeof processor === 'function') {
        finalProcessor = processor;
    } else {
        console.warn(
            '[A11y] Processor must be a function or a valid processor key.',
        );
        return;
    }

    a11yRegistry.set(selector, finalProcessor);

    if (isA11yEnabled) {
        try {
            document.querySelectorAll(selector).forEach((el) => {
                if (!el.hasAttribute(GENERIC_ATTR)) {
                    finalProcessor(el);
                    el.setAttribute(GENERIC_ATTR, 'true');
                }
            });
        } catch (e) {
            console.warn(
                `[A11y] Failed to apply new rule for selector "${selector}":`,
                e,
            );
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
        if (
            rootElement.nodeType === 1 &&
            !rootElement.hasAttribute(GENERIC_ATTR)
        ) {
            for (const [selector, rule] of a11yRegistry.entries()) {
                if (rootElement.matches(selector)) {
                    rule(rootElement);
                    rootElement.setAttribute(GENERIC_ATTR, 'true');
                }
            }
        }

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

/**
 * Registry of specific, complex DOM processors.
 * Each function accepts a `root` element to support incremental DOM updates
 * when UI sections are dynamically injected via AJAX or React.
 */
const SpecificProcessors = {
    /**
     * Enhances chat messages by turning them into semantic `<article>` elements.
     * Links character names and message text via `aria-labelledby`.
     * Hides redundant visual elements (drag handles, timers) from screen readers.
     *
     * @param {Element|Document} root - The root container to process.
     */
    chat: (root) => {
        const $root = $(root);
        const $messages = $root.find('#chat .mes').addBack('#chat .mes');

        $messages.each(function () {
            const $mes = $(this);
            // Skip messages that have already been processed
            if ($mes.hasClass('a11y-refactored')) return;

            const $nameText = $mes.find('.name_text');
            const charName = $nameText.text() || 'System';
            const isUser = $mes.attr('is_user') === 'true';
            const timestamp = $mes.find('.timestamp').text().trim();
            const isLast = $mes.is(':last-child');

            // Generate unique IDs for the heading (name) and the message body
            let headingId = $nameText.attr('id');
            if (!headingId && $nameText.length) {
                headingId =
                    'mes-heading-' + Math.random().toString(36).substr(2, 5);
                $nameText.attr('id', headingId);
            }

            const $mesText = $mes.find('.mes_text');
            let textId = $mesText.attr('id');
            if (!textId && $mesText.length) {
                textId = 'mes-text-' + Math.random().toString(36).substr(2, 5);
                $mesText.attr('id', textId);
            }

            // Bind the heading and text to the article wrapper so screen readers read them together
            let labelledby = [];
            if (headingId) labelledby.push(headingId);
            if (textId) labelledby.push(textId);

            $mes.attr({
                role: 'article',
                // Only make the last message initially focusable to implement "Roving Tabindex"
                tabindex: isLast ? '0' : '-1',
                'aria-labelledby':
                    labelledby.length > 0 ? labelledby.join(' ') : undefined,
            }).addClass('a11y-refactored');

            // Make the character name a semantic heading
            if ($nameText.length) {
                const youStr = t`You`;
                $nameText.attr({
                    role: 'heading',
                    'aria-level': '3',
                    'aria-label': `${isUser ? youStr : charName} ${timestamp ? ', ' + timestamp : ''}`,
                });
            }

            // Label the swipe buttons for alternative greetings/swipes
            $mes.find('.swipe_left').attr('aria-label', t`Swipe Left`);
            $mes.find('.swipe_right').attr('aria-label', t`Swipe Right`);

            // Hide visual clutter from screen readers (they don't need to read the drag handle or internal IDs)
            $mes.find(
                '.mesIDDisplay, .drag-handle, .swipes-counter, .mes_timer, .timestamp',
            ).attr('aria-hidden', 'true');
        });
    },

    /**
     * Dynamically finds and links form inputs (range sliders, textboxes, dropdowns)
     * with their visible textual labels using `aria-labelledby` and `aria-describedby`.
     *
     * SillyTavern's UI relies heavily on structure rather than explicit `<label for="...">`
     * tags. This function crawls the DOM adjacent to inputs to find appropriate headings
     * (e.g., <h4>, <b>, .range-block-title), generates unique IDs for them, and maps
     * them to the input elements.
     *
     * @param {Element|Document} root - The root container to process.
     */
    inputs: (root) => {
        const $root = $(root);
        // Target all inputs (including range sliders), textareas, and dropdowns.
        const $inputs = $root
            .find('input, textarea, select')
            .addBack('input, textarea, select');

        $inputs.each(function () {
            const $el = $(this);
            // Ignore hidden inputs entirely.
            if ($el.is('[type="hidden"]')) return;
            // Skip if the element already has a valid aria-labelledby pointing to an existing DOM node.
            if (
                $el.attr('aria-labelledby') &&
                document.getElementById($el.attr('aria-labelledby'))
            )
                return;

            // Step 1: Ensure the input itself has an ID.
            let id = $el.attr('id');
            if (!id) {
                id = 'st-a11y-' + Math.random().toString(36).substr(2, 5);
                $el.attr('id', id);
            }

            let $label = null;

            // Step 2: Try to find a standard <label> associated with this input's ID.
            if ($el.attr('id')) {
                const $forLabel = $(`label[for="${$el.attr('id')}"]`);
                if ($forLabel.length) $label = $forLabel;
            }

            // Step 3: If no standard label exists, crawl DOM structure backwards/upwards to find one.
            if (!$label || !$label.length) {
                let $curr = $el;

                // Try jumping back up to 4 siblings/wrappers.
                for (let i = 0; i < 4; i++) {
                    let $prev = $curr.prev();
                    let attempts = 0;

                    // Traverse previous siblings up to 5 times looking for heading tags or bold text.
                    while ($prev.length && attempts < 5) {
                        if (
                            $prev.is(
                                '.range-block-title, h4, h3, h5, label, strong, b',
                            )
                        ) {
                            $label = $prev;
                            break;
                        }

                        // Check if the heading is nested immediately inside the sibling.
                        const $nestedTitle = $prev
                            .find(
                                '.range-block-title, h4, h3, h5, label, strong, b',
                            )
                            .first();
                        if ($nestedTitle.length) {
                            $label = $nestedTitle;
                            break;
                        }

                        // Skip layout fluff like dividers, tooltips, or empty spans.
                        if (
                            $prev.is(
                                '.toggle-description, .neutral_warning, small, hr, .inline-drawer-toggle, .notes-link, .fa-circle-info',
                            ) ||
                            $prev.hasClass('notes-link') ||
                            $prev.text().trim() === ''
                        ) {
                            $prev = $prev.prev();
                            attempts++;
                        } else {
                            break;
                        }
                    }

                    if ($label && $label.length) break;

                    // If not found in siblings, step out to the parent container and try again.
                    const $parent = $curr.parent();
                    if (
                        $parent.length &&
                        ($parent.hasClass('range-block-range') ||
                            $parent.hasClass('range-block-range-and-counter') ||
                            $parent.hasClass('range-block') ||
                            $parent.hasClass('wide100p') ||
                            $parent.hasClass('flex-container') ||
                            $parent.hasClass('oneline-dropdown') ||
                            $parent.is('div'))
                    ) {
                        $curr = $parent;
                    } else {
                        break;
                    }
                }
            }

            // Step 4: Fallback for specific UI structures like .range-block wrappers.
            if (!$label || !$label.length) {
                const $container = $el.closest('.range-block');
                if ($container.length) {
                    $label = $container
                        .find('.range-block-title, h4, h3, label')
                        .first();
                }
            }

            // Step 5: Assign the found label via aria-labelledby.
            if ($label && $label.length) {
                if ($label.is($el)) return; // Prevent infinite self-referencing.
                if ($label.closest('.neutral_warning').length) return; // Avoid reading warning banners as labels.

                // If label wraps a span/b instead of pure text, point to the child element for cleaner reading.
                if (
                    $label.children().length > 0 &&
                    !$label.text().trim() &&
                    $label.find('span, b, strong').length
                ) {
                    $label = $label.find('span, b, strong').first();
                }

                const titleId = $label.attr('id') || 'label-' + id;
                $label.attr('id', titleId);
                $el.attr('aria-labelledby', titleId);
            }

            // Step 6: Find and associate helper text/descriptions using aria-describedby.
            const $descContainer = $el.closest(
                '.range-block, .wide100p, .flex-container',
            );
            if ($descContainer.length) {
                const $desc = $descContainer
                    .find(
                        '.text_muted, .toggle-description, small.flexBasis100p',
                    )
                    .filter(function () {
                        return $(this).text().trim().length > 0;
                    })
                    .first();

                if ($desc.length && !$el.attr('aria-describedby')) {
                    const descId = $desc.attr('id') || 'desc-' + id;
                    $desc.attr('id', descId);
                    $el.attr('aria-describedby', descId);
                }
            }

            // Step 7: Apply specific roles and boundary attributes for number inputs.
            if ($el.is('[type="number"]')) {
                $el.attr('role', 'spinbutton');
                const min = $el.attr('min'),
                    max = $el.attr('max');
                if (min !== undefined) $el.attr('aria-valuemin', min);
                if (max !== undefined) $el.attr('aria-valuemax', max);
            }
        });

        // Step 8: Make 'Remove' buttons inside Select2 multi-select boxes accessible.
        $root
            .find('.select2-selection__choice__remove')
            .addBack('.select2-selection__choice__remove')
            .each(function () {
                const $btn = $(this);
                if ($btn.attr('tabindex')) return;
                $btn.attr('tabindex', '0');
                const $item = $btn.closest('.select2-selection__choice');
                const title =
                    $item.attr('title') ||
                    $item.find('.select2-selection__choice__display').text();
                if (title) $btn.attr('aria-label', `Remove ${title}`);
            });
    },

    /**
     * Processes inline collapsible drawers (accordions).
     * Adds `aria-expanded` and links the toggle button to the content via `aria-controls`.
     */
    drawers: (root) => {
        const $root = $(root);
        $root
            .find('.inline-drawer')
            .addBack('.inline-drawer')
            .each(function () {
                const $drawer = $(this);
                const $header = $drawer.children('.inline-drawer-toggle');
                if ($header.attr('aria-controls')) return;

                const $content = $drawer.children('.inline-drawer-content');
                const $icon = $header.find('.inline-drawer-icon');
                if (!$content.length || !$header.length) return;

                let contentId = $content.attr('id');
                if (!contentId) {
                    contentId =
                        'drawer-' + Math.random().toString(36).substr(2, 6);
                    $content.attr('id', contentId);
                }
                const isExpanded = $content.is(':visible');

                $header.attr({
                    role: 'button',
                    tabindex: '0',
                    'aria-expanded': isExpanded ? 'true' : 'false',
                    'aria-controls': contentId,
                });

                $icon
                    .attr({ 'aria-hidden': 'true', tabindex: '-1' })
                    .removeAttr('role');

                const $title = $header.find('b, strong, span').first();
                if ($title.length) {
                    const titleId = $title.attr('id') || 'title-' + contentId;
                    $title.attr('id', titleId);
                    $header.attr('aria-labelledby', titleId);
                }
            });
    },

    /**
     * Enhances side navigation panels and character setting specific UI elements.
     */
    navAndCharPanel: (root) => {
        const $root = $(root);

        // Pin/Unpin Panel Buttons
        $root
            .find('#lm_button_panel_pin_div, #rm_button_panel_pin_div')
            .addBack('#lm_button_panel_pin_div, #rm_button_panel_pin_div')
            .each(function () {
                const $container = $(this);
                const $btnDiv = $container.find('.right_menu_button');
                if ($btnDiv.attr('aria-pressed')) return;

                const $checkbox = $container.find('input[type="checkbox"]');
                const title = $container.attr('title') || 'Pin Panel';
                const isChecked = $checkbox.prop('checked');
                $btnDiv
                    .attr('aria-label', title)
                    .attr('aria-pressed', isChecked ? 'true' : 'false');
            });

        // Add aria-labels to right menu buttons that only have titles
        const charPanelSelectors =
            '#rm_button_bar .menu_button, #rm_button_bar .right_menu_button, #HotSwapWrapper .hotswap, #rm_button_characters';
        $root
            .find(charPanelSelectors)
            .addBack(charPanelSelectors)
            .each(function () {
                const $btn = $(this);
                if ($btn.attr('aria-label')) return;
                const title =
                    $btn.attr('title') ||
                    $btn.attr('data-i18n-title') ||
                    $btn.attr('data-original-title');
                if (title) $btn.attr('aria-label', title.split('\n')[0].trim());
            });

        // World Info / Lorebook Selectors
        $root
            .find('.character_world_info_selector, .chat_world_info_selector')
            .addBack(
                '.character_world_info_selector, .chat_world_info_selector',
            )
            .each(function () {
                const $el = $(this);
                if ($el.attr('aria-labelledby')) return;

                const $container = $el.closest('.range-block');
                const $label = $container
                    .find('.range-block-title h3, .range-block-title h4')
                    .first();
                if ($label.length) {
                    const labelId =
                        $label.attr('id') ||
                        'lbl-wi-' + Math.random().toString(36).substr(2, 5);
                    $label.attr('id', labelId);
                    $el.attr('aria-labelledby', labelId);
                }
            });
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

    Object.values(SpecificProcessors).forEach((process) => {
        try {
            process(rootElement);
        } catch (e) {
            console.warn('[A11y] Processor error:', e);
        }
    });
};

/**
 * Logs a message with a timestamp and prefix for filtering.
 * Used primarily for debugging focus transitions and trap activations.
 *
 * @param {string} location - Function name or code area where log originated.
 * @param {string} message - The log message.
 * @param {any} [data] - Optional data object to inspect.
 */
function logDebug(location, message, data = null) {
    if (!DEBUG_A11Y) return;
    const time = new Date().toISOString().split('T')[1].slice(0, -1);

    if (data) {
        console.debug(`[A11y][${time}][${location}] ${message}`, data);
    } else {
        console.debug(`[A11y][${time}][${location}] ${message}`);
    }
}
const buttonSelectors = [
    '.menu_button',
    '.right_menu_button',
    '.mes_button',
    '.drawer-icon',
    '.inline-drawer-icon',
    '.swipe_left',
    '.swipe_right',
    '.character_select',
    '.tags .tag',
    '.jg-menu .jg-button',
    '.bg_example .mobile-only-menu-toggle',
    '.paginationjs-pages li a',
    '#show_more_messages',
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
].join(', ');

/**
 * Announces text to screen readers using a dynamic aria-live region.
 * Uses a "nuclear" approach to ensure the message cuts through all other noise.
 *
 * @param {string} text - The text to announce.
 * @param {boolean} force - If true, uses role="alert" and assertive live region.
 */
export function announceA11y(text, force = false) {
    if (!text || !isA11yEnabled) return;
    logDebug('Announce', text);

    let announcer = document.getElementById('a11y-announcer');
    if (!announcer) {
        announcer = document.createElement('div');
        announcer.id = 'a11y-announcer';
        announcer.className = 'a11y-sr-only';
        document.body.appendChild(announcer);
    }

    // Clear previous text to force screen readers to re-read if the same text is sent
    announcer.textContent = '';

    if (force) {
        announcer.setAttribute('role', 'alert');
        announcer.setAttribute('aria-live', 'assertive');
    } else {
        announcer.setAttribute('role', 'status');
        announcer.setAttribute('aria-live', 'polite');
    }

    // Small delay ensures the DOM update is caught by screen readers
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

        if (currentFocusTrap) {
            try {
                currentFocusTrap.deactivate();
            } catch (e) {
                console.warn('Focus trap error', e);
            }
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
                try {
                    currentFocusTrap.activate();
                } catch (e) {
                    console.warn('Trap activate failed', e);
                }
            }, 100);
        }
    } else {
        triggerButton.attr('aria-expanded', 'false');
        if (currentFocusTrap) {
            try {
                currentFocusTrap.deactivate();
            } catch (e) {
                logDebug(
                    'handleDrawerFocus',
                    'Focus trap deactivation failed',
                    e,
                );
            }
            currentFocusTrap = null;
        }
        triggerButton.trigger('focus');
    }
}

/**
 * Removes all accessibility enhancements, attributes, and listeners.
 */
function cleanupA11y() {
    const announcer = document.getElementById('a11y-announcer');
    if (announcer) announcer.textContent = '';

    $(`[${GENERIC_ATTR}]`).removeAttr(GENERIC_ATTR);
    $(
        '[role="button"], [role="list"], [role="listitem"], [role="toolbar"], [role="tablist"], [role="tab"], [role="status"]',
    ).removeAttr(
        'role tabindex aria-label aria-hidden aria-expanded aria-controls aria-pressed aria-valuemin aria-valuemax aria-describedby aria-labelledby aria-haspopup aria-checked aria-level',
    );

    $('[id^="st-a11y-"]').removeAttr('id');
    $('[id^="label-st-a11y-"]').removeAttr('id');
    $('[id^="drawer-"]').removeAttr('id');
    $('[id^="title-drawer-"]').removeAttr('id');

    // Remove chat message specific classes
    $('.a11y-refactored').removeClass('a11y-refactored');

    logDebug('cleanupA11y', 'Accessibility features cleaned up.');
}

/**
 * Toggles the accessibility system on or off.
 */
export function setAccessibilityEnabled(enabled) {
    if (isA11yEnabled === enabled) return;

    isA11yEnabled = enabled;

    if (!enabled) {
        cleanupA11y();
        return;
    }

    applyGenericA11yRules(document.body);
    enhanceSpecificA11y(document.body);

    logDebug('setAccessibilityEnabled', 'Accessibility features enabled.');
}

/**
 * Initializes the accessibility module.
 */
export function initAccessibility() {
    applyGenericA11yRules(document.body);
    enhanceSpecificA11y(document.body);

    /**
     * Helper to move keyboard focus between chat messages.
     * Implements the "Roving Tabindex" pattern manually.
     */
    const moveMessageFocus = ($current, $target) => {
        if ($target.length) {
            $current.attr('tabindex', '-1');
            $target.attr('tabindex', '0').trigger('focus');
            $target[0].scrollIntoView({ behavior: 'smooth', block: 'nearest' });
        }
    };

    // Chat messages keyboard navigation (Up/Down arrows to move between messages)
    $(document).on('keydown', '#chat .mes', function (e) {
        if (!isA11yEnabled) return;
        if (e.target !== this) return; // Ignore events bubbling up from inputs inside the message

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
            case 'Escape':
                e.preventDefault();
                $('#send_textarea').trigger('focus');
                announceA11y(t`Returned to text input`);
                break;
        }
    });

    // Announce when AI starts generating a response
    eventSource.on(event_types.GENERATION_STARTED, (context) => {
        if (!isA11yEnabled) return;

        const typeStr =
            typeof context === 'string' ? context : context?.type || 'normal';
        const isQuiet =
            typeof context === 'string'
                ? context === 'quiet'
                : context?.quiet || false;

        // Skip quiet generations (e.g., summarize, classify) so we don't spam the user
        if (
            isQuiet ||
            typeStr === 'quiet' ||
            typeStr === 'summarize' ||
            typeStr === 'classify'
        )
            return;

        if (!isAiGenerating) {
            isAiGenerating = true;
            announceA11y(t`AI is generating response...`);
            // Attempt to move focus to the Stop button
            setTimeout(() => {
                const stopBtn = document.getElementById('mes_stop');
                if (stopBtn && stopBtn.offsetParent !== null) stopBtn.focus();
            }, 50);
        }
    });

    // Announce when the AI has finished rendering the message (Works for both streaming and non-streaming APIs)
    eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, (mid) => {
        if (!isA11yEnabled) return;
        isAiGenerating = false;

        const msg = /** @type {any} */ (chat[mid]);
        if (msg) {
            // TTS Overlap Avoidance: Check if the user has ST's native TTS extension enabled.
            // If TTS is enabled, it takes over the reading. We skip the screen reader aria-live
            // announcement here to prevent two voices talking over each other.
            const isTtsEnabled = extension_settings?.tts?.enabled;

            if (!isTtsEnabled) {
                const charName = msg.name || 'System';
                // Announce character name + full text
                announceA11y(t`${charName} replied: ${msg.mes}`);
            } else {
                console.log(
                    '[A11y] Skipped message announcement to prevent overlap with TTS extension.',
                );
            }
        }

        // Update Roving Tabindex so the newest message is focusable
        $('#chat .mes').attr('tabindex', '-1');
        $('#chat .mes').last().attr('tabindex', '0');

        // Return focus to the input box ready for the user's next reply
        $('#send_textarea').trigger('focus');
    });

    // Announce if generation is manually stopped
    eventSource.on(event_types.GENERATION_STOPPED, () => {
        if (!isA11yEnabled) return;
        isAiGenerating = false;
        announceA11y(t`AI generation stopped.`);
        $('#send_textarea').trigger('focus');
    });

    // Announce when left/right panels are pinned or unpinned
    $(document).on(
        'change',
        '#lm_button_panel_pin, #rm_button_panel_pin',
        function () {
            if (!isA11yEnabled) return;
            const $checkbox = $(this);
            const $container = $checkbox.parent();
            const $btnDiv = $container.find('.right_menu_button');
            const isChecked = $checkbox.prop('checked');

            $btnDiv.attr('aria-pressed', isChecked ? 'true' : 'false');

            const panelName =
                $checkbox.attr('id') === 'lm_button_panel_pin'
                    ? t`AI Configuration`
                    : t`Character Management`;
            const status = isChecked ? t`Locked open` : t`Unlocked`;
            announceA11y(`${panelName} panel ${status}`);
        },
    );

    /**
     * Defines ARIA landmarks to allow screen reader users to quickly jump
     * between major sections of the app using shortcut keys.
     */
    const setupLandmarks = () => {
        $('#top-settings-holder').attr({
            role: 'banner',
            'aria-label': 'Main Navigation',
        });
        $('#left-nav-panel').attr({
            role: 'region',
            'aria-label': 'AI Configuration',
        });
        $('#right-nav-panel').attr({
            role: 'region',
            'aria-label': 'Character Management',
        });
        $('#sheld').attr({ role: 'main', 'aria-label': 'Chat Log' });
        $('#send_form').attr({ role: 'form', 'aria-label': 'Message Input' });
    };
    setupLandmarks();

    // Global keyboard shortcuts for layout navigation
    $(document).on('keydown', function (e) {
        if (!isA11yEnabled || e.key !== 'Escape') return;

        // If in text area, Escape jumps to the left navigation panel
        if ($(e.target).is('#send_textarea')) {
            e.preventDefault();
            $('#leftNavDrawerIcon').trigger('focus');
            announceA11y(t`Focus moved to Navigation Bar`);
            return;
        }

        // If inside left nav, Escape jumps to Chat Input (or closes nav if unpinned)
        if ($(e.target).closest('#left-nav-panel').length) {
            if ($('#lm_button_panel_pin').is(':checked')) {
                e.preventDefault();
                $('#send_textarea').trigger('focus');
                announceA11y(t`Focus moved to Chat Input`);
            } else {
                setTimeout(() => $('#leftNavDrawerIcon').trigger('focus'), 50);
            }
            return;
        }

        // If inside right nav, Escape jumps to Chat Input (or closes nav if unpinned)
        if ($(e.target).closest('#right-nav-panel').length) {
            if ($('#rm_button_panel_pin').is(':checked')) {
                e.preventDefault();
                $('#send_textarea').trigger('focus');
                announceA11y(t`Focus moved to Chat Input`);
            } else {
                setTimeout(() => $('#rightNavDrawerIcon').trigger('focus'), 50);
            }
            return;
        }
    });

    logDebug('initAccessibility', 'Accessibility module initialized.');
}
