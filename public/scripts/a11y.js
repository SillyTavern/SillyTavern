/**
 * Shared module between login and main app.
 * Be careful what you import!
 */

const MANAGED_ROLE_ATTRIBUTE = 'data-a11y-role';

function setManagedRole(element, role) {
    element.setAttribute('role', role);
    element.setAttribute(MANAGED_ROLE_ATTRIBUTE, role);
}

function clearManagedRole(element) {
    if (element.hasAttribute(MANAGED_ROLE_ATTRIBUTE)) {
        element.removeAttribute('role');
        element.removeAttribute(MANAGED_ROLE_ATTRIBUTE);
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
    '.swipes-counter.interactable',
    '.bg_example .mobile-only-menu-toggle',
    '.paginationjs-pages li a',
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
        setManagedRole(element, 'button');
    },
    [listSelectors]: (element) => {
        setManagedRole(element, 'list');
    },
    [listItemSelectors]: (element) => {
        setManagedRole(element, 'listitem');
    },
    [toolbarSelectors]: (element) => {
        setManagedRole(element, 'toolbar');
    },
    [tabListSelectors]: (element) => {
        setManagedRole(element, 'tablist');
    },
    [tabItemSelectors]: (element) => {
        setManagedRole(element, 'tab');
    },
    '#toast-container .toast': (element) => {
        setManagedRole(element, 'status');
    },
};

/**
 * Apply accessibility rules to an element.
 * @param {Element} element Element to process.
 */
function applyA11yRules(element) {
    try {
        if (element.hasAttribute(MANAGED_ROLE_ATTRIBUTE)) {
            clearManagedRole(element);
        }
        element.querySelectorAll(`[${MANAGED_ROLE_ATTRIBUTE}]`).forEach(clearManagedRole);

        for (const [selector, rule] of Object.entries(a11yRules)) {
            // Apply if the element directly matches the selector
            if (element.matches(selector)) {
                rule(element);
            }
            // Apply the rule to descendants
            element.querySelectorAll(selector).forEach(rule);
        }
    } catch (error) {
        console.error('Error applying accessibility rules to element:', element, error);
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
                    if (addedNode instanceof Element && addedNode.nodeType === Node.ELEMENT_NODE) {
                        applyA11yRules(addedNode);
                    }
                }
            }
            if (mutation.type === 'attributes' && mutation.target instanceof Element) {
                applyA11yRules(mutation.target);
            }
        }
    });

    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class'],
    });
}

export function initAccessibility() {
    setAccessibilityObserver();
}
