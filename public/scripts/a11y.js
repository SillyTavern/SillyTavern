/** @type {boolean} Global flag indicating if accessibility enhancements are active. */
let isA11yEnabled = false;

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

    logDebug('setAccessibilityEnabled', 'Accessibility features enabled.');
}

/**
 * Initializes the accessibility module.
 */
export function initAccessibility() {
    applyGenericA11yRules(document.body);

    logDebug('initAccessibility', 'Accessibility module initialized.');
}

export function handleDrawerFocus(container, drawer, isOpening) {
    if (!isA11yEnabled) return;
}
