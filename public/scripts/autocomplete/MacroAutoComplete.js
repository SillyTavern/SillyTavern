/**
 * Macro autocomplete for free text inputs (textareas and input fields).
 * Provides macro autocomplete when typing `{{` in marked text inputs.
 *
 * This module uses shared utilities from MacroAutoCompleteHelper.js to ensure
 * consistent behavior with the slash command macro autocomplete.
 *
 * Usage:
 * - Mark a textarea/input with `data-macros` or `data-macros="true"` attribute
 * - Call `initMacroAutoComplete()` to initialize all marked elements
 * - Dynamically added elements are automatically initialized via MutationObserver
 */

import { power_user } from '../power-user.js';
import { AutoComplete, AUTOCOMPLETE_STATE } from './AutoComplete.js';
import { findMacroAtCursor, findUnclosedScopes, getMacroAutoCompleteAt } from './MacroAutoCompleteHelper.js';

/** Custom attribute name used to mark elements that support macro autocomplete */
export const MACRO_AUTOCOMPLETE_ATTRIBUTE = 'data-macros';

/** @type {WeakSet<HTMLElement>} Track initialized elements to avoid double-init */
const initializedElements = new WeakSet();

/**
 * Checks if the cursor is positioned where macro autocomplete should activate.
 * Activates when:
 * - Cursor is right after typing `{{`
 * - Cursor is inside a macro `{{...}}`
 * - Cursor is in scoped content of an unclosed scoped macro (e.g., after `{{setvar myvar}}`)
 *
 * @param {string} text - The full text content.
 * @param {number} cursorPos - The cursor position.
 * @returns {boolean}
 */
function shouldActivateMacroAutocomplete(text, cursorPos) {
    // Check if autocomplete is enabled at all
    if (power_user.stscript.autocomplete.state === AUTOCOMPLETE_STATE.DISABLED) {
        return false;
    }

    // Wether setting says autocomplete should only activate after typing {{ and two characters after that
    const onlyAfter2 = power_user.stscript.autocomplete.state === AUTOCOMPLETE_STATE.MIN_LENGTH;

    // Check if we're right after {{ (just typed the second brace)
    if (cursorPos >= 2 && text.slice(cursorPos - 2, cursorPos) === '{{') {
        return !onlyAfter2;
    }

    // Check if we're inside a macro
    const macro = findMacroAtCursor(text, cursorPos);
    if (macro !== null) {
        return !onlyAfter2 || (macro.content.trim()).length >= 2;
    }

    // Check if we're in scoped content of an unclosed scoped macro
    const textUpToCursor = text.slice(0, cursorPos);
    const unclosedScopes = findUnclosedScopes(textUpToCursor);
    return unclosedScopes.length > 0;
}

/**
 * Sets up macro autocomplete for a text input element.
 * The autocomplete will trigger when typing `{{` inside the element.
 *
 * @param {HTMLTextAreaElement|HTMLInputElement} textarea - The input element.
 * @returns {AutoComplete} The autocomplete instance.
 */
export function setMacroAutoComplete(textarea) {
    const ac = new AutoComplete(
        textarea,
        () => shouldActivateMacroAutocomplete(ac.text, textarea.selectionStart),
        (text, index) => getMacroAutoCompleteAt(text, index),
        true, // isFloating - always use floating mode for free text macro autocomplete
    );

    return ac;
}

/**
 * Initializes macro autocomplete on a single element if not already initialized.
 *
 * @param {HTMLTextAreaElement|HTMLInputElement} element - The element to initialize.
 * @returns {AutoComplete|null} The autocomplete instance, or null if already initialized.
 */
function initializeElement(element) {
    if (initializedElements.has(element)) {
        return null;
    }

    if (!(element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement)) {
        return null;
    }

    initializedElements.add(element);
    return setMacroAutoComplete(element);
}

/**
 * Checks if an element has the macro autocomplete attribute enabled.
 * Supports both `data-macros` (presence) and `data-macros="true"`.
 *
 * @param {Element} element - The element to check.
 * @returns {boolean}
 */
function hasMacroAttribute(element) {
    if (!element.hasAttribute(MACRO_AUTOCOMPLETE_ATTRIBUTE)) {
        return false;
    }
    const value = element.getAttribute(MACRO_AUTOCOMPLETE_ATTRIBUTE);
    // Attribute present with no value, empty string, or "true" all count as enabled
    return value === null || value === '' || value === 'true';
}

/**
 * Handles node changes from MutationObserver - checks for macro autocomplete attribute.
 *
 * @param {Node} node - The node to check.
 */
function handleNodeChange(node) {
    if (node.nodeType !== Node.ELEMENT_NODE || !(node instanceof Element)) {
        return;
    }

    // Check if this element has the macro autocomplete attribute
    if (hasMacroAttribute(node)) {
        if (node instanceof HTMLTextAreaElement || node instanceof HTMLInputElement) {
            initializeElement(node);
        }
    }

    // Check child elements - select all elements with the attribute (any value or no value)
    const children = node.querySelectorAll(`[${MACRO_AUTOCOMPLETE_ATTRIBUTE}]`);
    for (const child of children) {
        if (hasMacroAttribute(child) && (child instanceof HTMLTextAreaElement || child instanceof HTMLInputElement)) {
            initializeElement(child);
        }
    }
}

/**
 * MutationObserver to watch for dynamically added elements with macro autocomplete attribute.
 * @type {MutationObserver}
 */
const observer = new MutationObserver(mutations => {
    for (const mutation of mutations) {
        if (mutation.type === 'childList') {
            for (const node of mutation.addedNodes) {
                handleNodeChange(node);
            }
        }
        if (mutation.type === 'attributes') {
            const target = mutation.target;
            if (mutation.attributeName === MACRO_AUTOCOMPLETE_ATTRIBUTE && target instanceof Element) {
                handleNodeChange(target);
            }
        }
    }
});

/**
 * Initializes macro autocomplete for all elements with the `data-macros` attribute.
 * Also starts the MutationObserver to watch for dynamically added elements.
 * Should be called after DOM is ready.
 *
 * @returns {AutoComplete[]} Array of autocomplete instances created.
 */
export function initMacroAutoComplete() {
    const elements = /** @type {NodeListOf<HTMLTextAreaElement|HTMLInputElement>} */ (
        document.querySelectorAll(`[${MACRO_AUTOCOMPLETE_ATTRIBUTE}]`)
    );

    const instances = [];
    for (const element of elements) {
        if (hasMacroAttribute(element)) {
            const ac = initializeElement(element);
            if (ac) {
                instances.push(ac);
            }
        }
    }

    // Start observing for dynamically added elements
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: [MACRO_AUTOCOMPLETE_ATTRIBUTE],
    });

    return instances;
}

/**
 * Enables macro autocomplete on a specific element by ID.
 * Adds the attribute and initializes autocomplete.
 *
 * @param {string} elementId - The element ID (without #).
 * @returns {AutoComplete|null} The autocomplete instance, or null if element not found.
 */
export function enableMacroAutoCompleteById(elementId) {
    const element = /** @type {HTMLTextAreaElement|HTMLInputElement|null} */ (
        document.getElementById(elementId)
    );

    if (!element || !(element instanceof HTMLTextAreaElement || element instanceof HTMLInputElement)) {
        console.warn(`[MacroAutoComplete] Element not found or invalid: ${elementId}`);
        return null;
    }

    element.setAttribute(MACRO_AUTOCOMPLETE_ATTRIBUTE, 'true');
    return initializeElement(element);
}
