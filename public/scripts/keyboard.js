/* All selectors that should act as interactables / keyboard buttons by default */
const interactableSelectors = ['.menu_button', '.right_menu_button', '.custom_interactable', '.interactable'];

export const INTERACTABLE_CONTROL_CLASS = 'interactable';
export const CUSTOM_INTERACTABLE_CONTROL_CLASS = 'custom_interactable';

export const NOT_FOCUSABLE_CONTROL_CLASS = 'not_focusable';
export const DISABLED_CONTROL_CLASS = 'disabled';

/**
 * An observer that will check if any new interactables are added to the body
 * @type {MutationObserver}
 */
const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE && node instanceof Element) {
                    // Check if the node itself is an interactable
                    if (isKeyboardInteractable(node)) {
                        makeKeyboardInteractable(node);
                    }
                    // Check for any descendants that might be an interactable
                    const interactables = getAllInteractables(node);
                    makeKeyboardInteractable(...interactables);
                }
            });
        } else if (mutation.type === 'attributes') {
            const target = mutation.target;
            if (mutation.attributeName === 'class' && target instanceof Element) {
                if (isKeyboardInteractable(target)) {
                    makeKeyboardInteractable(target);
                }
            }
        }
    });
});

/**
 * Registers an interactable class (for example for an extension) and makes it keyboard interactable.
 * Optionally apply the 'not_focusable' and 'disabled' classes if needed.
 *
 * @param {string} interactableSelector - The CSS selector for the interactable (Supports class combinations, chained via dots like <c>tag.actionable</c>, and sub selectors)
 * @param {object} [options={}] - Optional settings for the interactable
 * @param {boolean} [options.disabledByDefault=false] - Whether interactables of this class should be disabled by default
 * @param {boolean} [options.notFocusableByDefault=false] - Whether interactables of this class should not be focusable by default
 */
export function registerInteractableType(interactableSelector, { disabledByDefault = false, notFocusableByDefault = false } = {}) {
    interactableSelectors.push(interactableSelector);

    const interactables = document.querySelectorAll(interactableSelector);

    if (disabledByDefault || notFocusableByDefault) {
        interactables.forEach(interactable => {
            if (disabledByDefault) interactable.classList.add(DISABLED_CONTROL_CLASS);
            if (notFocusableByDefault) interactable.classList.add(NOT_FOCUSABLE_CONTROL_CLASS);
        });
    }

    makeKeyboardInteractable(...interactables);
}

/**
 * Checks if the given control is a keyboard-enabled interactable.
 *
 * @param {Element} control - The control element to check
 * @returns {boolean} Returns true if the control is a keyboard interactable, false otherwise
 */
export function isKeyboardInteractable(control) {
    // Check if this control matches any of the selectors
    return interactableSelectors.some(selector => control.matches(selector));
}

/**
 * Makes all the given controls keyboard interactable and sets their state.
 * If the control doesn't have any of the classes, it will be set to a custom-enabled keyboard interactable.
 *
 * @param {Element[]} interactables - The controls to make interactable and set their state
 */
export function makeKeyboardInteractable(...interactables) {
    interactables.forEach(interactable => {
        // If this control doesn't have any of the classes, lets say the caller knows this and wants this to be a custom-enabled keyboard control.
        if (!isKeyboardInteractable(interactable)) {
            interactable.classList.add(CUSTOM_INTERACTABLE_CONTROL_CLASS);
        }

        // Just for CSS styling and future reference, every keyboard interactable control should have a common class
        if (!interactable.classList.contains(INTERACTABLE_CONTROL_CLASS)) {
            interactable.classList.add(INTERACTABLE_CONTROL_CLASS);
        }

        // Set/remove the tabindex accordingly to the classes. Remembering if it had a custom value.
        if (!interactable.classList.contains(NOT_FOCUSABLE_CONTROL_CLASS) && !interactable.classList.contains(DISABLED_CONTROL_CLASS)) {
            if (!interactable.hasAttribute('tabindex')) {
                const tabIndex = interactable.getAttribute('data-original-tabindex') ?? '0';
                interactable.setAttribute('tabindex', tabIndex);
            }
        } else {
            interactable.setAttribute('data-original-tabindex', interactable.getAttribute('tabindex'));
            interactable.removeAttribute('tabindex');
        }
    });
}

/**
 * Initializes the focusability of controls on the given element or the document
 *
 * @param {Element|Document} [element=document] - The element on which to initialize the interactable state. Defaults to the document.
 */
function initializeInteractables(element = document) {
    const interactables = getAllInteractables(element);
    makeKeyboardInteractable(...interactables);
}

/**
 * Queries all interactables within the given element based on the given selectors and returns them as an array
 *
 * @param {Element|Document} element - The element within which to query the interactables
 * @returns {HTMLElement[]} An array containing all the interactables that match the given selectors
 */
function getAllInteractables(element) {
    // Query each selector individually and combine all to a big array to return
    return [].concat(...interactableSelectors.map(selector => Array.from(element.querySelectorAll(`${selector}`))));
}

/**
 * Handles keydown events on the document to trigger click on Enter key press for interactables
 *
 * @param {KeyboardEvent} event - The keyboard event
 */
function handleGlobalKeyDown(event) {
    if (event.key === 'Enter') {
        if (!(event.target instanceof HTMLElement))
            return;

        // Only count enter on this interactable if no modifier key is pressed
        if (event.altKey || event.ctrlKey || event.shiftKey)
            return;

        // Traverse up the DOM tree to find the actual interactable element
        let target = event.target;
        while (target && !isKeyboardInteractable(target)) {
            target = target.parentElement;
        }

        // Trigger click if a valid interactable is found and it's not disabled
        if (target && !target.classList.contains(DISABLED_CONTROL_CLASS)) {
            console.debug('Triggering click on keyboard-focused interactable control via Enter', target);
            target.click();
        }
    }
}

/**
 * Initializes several keyboard functionalities for ST
 */
export function initKeyboard() {
    // Start observing the body for added elements and attribute changes
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
    });

    // Initialize interactable state for already existing controls
    initializeInteractables();

    // Add a global keydown listener
    document.addEventListener('keydown', handleGlobalKeyDown);
}
