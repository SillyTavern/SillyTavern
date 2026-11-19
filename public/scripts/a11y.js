/**
 * Shared module between login and main app.
 * Be careful what you import!
 */

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
].join(', ');

const toolbarSelectors = [
    '.jg-menu',
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
        element.setAttribute('role', 'button');
    },
    [listSelectors]: (element) => {
        element.setAttribute('role', 'list');
    },
    [listItemSelectors]: (element) => {
        element.setAttribute('role', 'listitem');
    },
    [toolbarSelectors]: (element) => {
        element.setAttribute('role', 'toolbar');
    },
    [tabListSelectors]: (element) => {
        element.setAttribute('role', 'tablist');
    },
    [tabItemSelectors]: (element) => {
        element.setAttribute('role', 'tab');
    },
    '#toast-container .toast': (element) => {
        element.setAttribute('role', 'status');
    },
};

const a11yRuleEntries = Object.entries(a11yRules);
const combinedA11ySelector = Object.keys(a11yRules).join(', ');

/**
 * Apply the matching accessibility rules to a single element.
 * @param {Element} element Element to process.
 */
function applyMatchingRules(element) {
    for (const [selector, rule] of a11yRuleEntries) {
        if (element.matches(selector)) {
            rule(element);
        }
    }
}

/**
 * Apply accessibility rules to an element and its descendants.
 * @param {Element} element Element to process.
 */
function applyA11yRules(element) {
    try {
        // Single combined query, then dispatch rules only on actual matches
        if (element.matches(combinedA11ySelector)) {
            applyMatchingRules(element);
        }
        element.querySelectorAll(combinedA11ySelector).forEach(applyMatchingRules);
    } catch (error) {
        console.error('Error applying accessibility rules to element:', element, error);
    }
}

/** @type {Set<Element>} */
const pendingElements = new Set();
let flushScheduled = false;

/**
 * Check if any ancestor of the element is also queued for processing.
 * @param {Element} element Element to check.
 * @param {Set<Element>} queued Set of queued elements.
 * @returns {boolean} True if a queued ancestor exists.
 */
function hasQueuedAncestor(element, queued) {
    for (let parent = element.parentElement; parent; parent = parent.parentElement) {
        if (queued.has(parent)) {
            return true;
        }
    }
    return false;
}

function flushPendingElements() {
    flushScheduled = false;
    const elements = new Set(pendingElements);
    pendingElements.clear();

    for (const element of elements) {
        // Skip elements that were removed or are covered by a queued ancestor
        if (!element.isConnected || hasQueuedAncestor(element, elements)) {
            continue;
        }
        applyA11yRules(element);
    }
}

/**
 * Queue an element for rule application on the next animation frame.
 * @param {Element} element Element to process.
 */
function queueElement(element) {
    pendingElements.add(element);
    if (!flushScheduled) {
        flushScheduled = true;
        requestAnimationFrame(flushPendingElements);
    }
}

function setAccessibilityObserver() {
    // Apply for existing elements
    applyA11yRules(document.body);

    // Setup observer for dynamic content
    const observer = new MutationObserver((mutationsList) => {
        for (const mutation of mutationsList) {
            if (mutation.type === 'childList') {
                for (const addedNode of mutation.addedNodes) {
                    if (addedNode instanceof Element) {
                        queueElement(addedNode);
                    }
                }
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
    });
}

export function initAccessibility() {
    setAccessibilityObserver();
}
