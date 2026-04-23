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
    '#send_but',
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

const labelableSelectors = [
    buttonSelectors,
    'button',
    '[role="button"]',
    '[role="menuitem"]',
    '[role="tab"]',
    'input[type="button"]',
    'input[type="submit"]',
    'input[type="reset"]',
    'input[type="file"]',
    'input[type="checkbox"]',
    'input[type="radio"]',
    'input[type="range"]',
    'input[type="color"]',
    'select',
    'textarea',
].join(', ');

const textFallbackRoles = new Set(['button', 'menuitem', 'tab']);
const textFallbackTags = new Set(['A', 'BUTTON', 'LABEL', 'OPTION']);

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

function escapeCssIdentifier(value) {
    if (typeof CSS !== 'undefined' && typeof CSS.escape === 'function') {
        return CSS.escape(value);
    }

    return value.replace(/([^\w-])/g, '\\$1');
}

function hasAssociatedLabel(element) {
    if (!(element instanceof Element)) {
        return false;
    }

    if (element.hasAttribute('aria-label') || element.hasAttribute('aria-labelledby')) {
        return true;
    }

    if ('id' in element && element.id) {
        const associatedLabel = document.querySelector(`label[for="${escapeCssIdentifier(element.id)}"]`);
        if (associatedLabel && associatedLabel.textContent && associatedLabel.textContent.trim().length > 0) {
            return true;
        }
    }

    const closestLabel = element.closest('label');
    return Boolean(closestLabel && closestLabel.textContent && closestLabel.textContent.trim().length > 0);
}

function deriveLabelText(element) {
    if (!(element instanceof Element)) {
        return '';
    }

    const dataLabel = element.getAttribute('data-a11y-label');
    if (dataLabel && dataLabel.trim()) {
        return dataLabel.trim();
    }

    const role = element.getAttribute('role');
    if (textFallbackTags.has(element.tagName) || (role && textFallbackRoles.has(role))) {
        const text = element.textContent ? element.textContent.replace(/\s+/g, ' ').trim() : '';
        if (text) {
            return text;
        }
    }

    const title = element.getAttribute('title');
    if (title && title.trim()) {
        return title.trim();
    }

    const parentDataLabel = element.closest('[data-a11y-label]');
    if (parentDataLabel) {
        const parentLabel = parentDataLabel.getAttribute('data-a11y-label');
        if (parentLabel && parentLabel.trim()) {
            return parentLabel.trim();
        }
    }

    const titledParent = element.closest('[title]');
    if (titledParent) {
        const parentTitle = titledParent.getAttribute('title');
        if (parentTitle && parentTitle.trim()) {
            return parentTitle.trim();
        }
    }

    if (element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement) {
        const placeholder = element.getAttribute('placeholder');
        if (placeholder && placeholder.trim()) {
            return placeholder.trim();
        }
    }

    return '';
}

function ensureAccessibleLabel(element) {
    if (hasAssociatedLabel(element)) {
        return;
    }

    const labelText = deriveLabelText(element);
    if (labelText) {
        element.setAttribute('aria-label', labelText);
    }
}

function labelInteractiveControls(root) {
    if (!(root instanceof Element)) {
        return;
    }

    const targets = [];

    if (root.matches(labelableSelectors)) {
        targets.push(root);
    }

    root.querySelectorAll(labelableSelectors).forEach((element) => {
        targets.push(element);
    });

    for (const element of targets) {
        ensureAccessibleLabel(element);
    }
}

/**
 * Apply accessibility rules to an element.
 * @param {Element} element Element to process.
 */
function applyA11yRules(element) {
    try {
        for (const [selector, rule] of Object.entries(a11yRules)) {
            // Apply if the element directly matches the selector
            if (element.matches(selector)) {
                rule(element);
            }
            // Apply the rule to descendants
            element.querySelectorAll(selector).forEach(rule);
        }

        labelInteractiveControls(element);
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
