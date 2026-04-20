/** @type {boolean} Global flag indicating if accessibility enhancements are active. */
let isA11yEnabled = false;

const DEBUG_A11Y = new URLSearchParams(window.location.search).has(
    'debug_a11y',
);

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
 * Called when the user disables the Accessibility extension/setting.
 * (To be expanded in future PRs)
 */
function cleanupA11y() {
    const announcer = document.getElementById('a11y-announcer');
    if (announcer) {
        announcer.textContent = '';
    }
    logDebug('cleanupA11y', 'Accessibility features cleaned up.');
}

/**
 * Toggles the accessibility system on or off.
 *
 * @param {boolean} enabled - Whether to enable accessibility features.
 */
export function setAccessibilityEnabled(enabled) {
    if (isA11yEnabled === enabled) return;

    isA11yEnabled = enabled;

    if (!enabled) {
        cleanupA11y();
        return;
    }

    // TODO: Apply generic A11y rules, specific DOM enhancements, and start observers (Future PRs)
    logDebug('setAccessibilityEnabled', 'Accessibility features enabled.');
}

/**
 * Initializes the accessibility module.
 * Sets up global event delegation, keyboard shortcuts, and application event listeners.
 * This function should be called once when the application loads.
 */
export function initAccessibility() {
    // TODO: Setup global event listeners and initial DOM parsing (Future PRs)
    logDebug('initAccessibility', 'Accessibility module initialized.');
}

export const a11yProcessors = {};
export function registerA11ySelector() {}
export function handleDrawerFocus(container, drawer, isOpening) {
    if (!isA11yEnabled) return;
}
