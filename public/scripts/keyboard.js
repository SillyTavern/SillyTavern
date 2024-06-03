/* All selectors that should act as keyboard buttons by default */
const buttonSelectors = ['.menu_button', '.right_menu_button', '.clickable'];

const CUSTOM_CLICKABLE_BUTTON_CLASS = 'clickable';

const NOT_FOCUSABLE_CLASS = 'not_focusable';
const DISABLED_CLASS = 'disabled';

/**
 * An observer that will check if any new buttons are added to the body
 * @type {MutationObserver}
 */
const observer = new MutationObserver(mutations => {
    mutations.forEach(mutation => {
        if (mutation.type === 'childList') {
            mutation.addedNodes.forEach(node => {
                if (node.nodeType === Node.ELEMENT_NODE && node instanceof Element) {
                    // Check if the node itself is a button
                    if (isKeyboardButton(node)) {
                        enableKeyboardButton(node);
                    }
                    // Check for any descendants that might be buttons
                    const newButtons = getAllButtons(node);
                    enableKeyboardButton(...newButtons);
                }
            });
        } else if (mutation.type === 'attributes') {
            const target = mutation.target;
            if (mutation.attributeName === 'class' && target instanceof Element) {
                if (isKeyboardButton(target)) {
                    enableKeyboardButton(target);
                }
            }
        }
    });
});

/**
 * Registers a button class (for example for an exatension) and makes it keyboard-selectable.
 * Optionally apply the 'not_focusable' and 'disabled' classes if needed.
 *
 * @param {string} buttonSelector - The CSS selector for the button (Supports class combinations, chained via dots like <c>tag.actionable</c>, and sub selectors)
 * @param {object} [options={}] - Optional settings for the button class
 * @param {boolean} [options.disabledByDefault=false] - Whether buttons of this class should be disabled by default
 * @param {boolean} [options.notFocusableByDefault=false] - Whether buttons of this class should not be focusable by default
 */
export function registerKeyboardButtonClass(buttonSelector, { disabledByDefault = false, notFocusableByDefault = false } = {}) {
    buttonSelectors.push(buttonSelector);

    const buttons = document.querySelectorAll(buttonSelector);

    if (disabledByDefault || notFocusableByDefault) {
        buttons.forEach(button => {
            if (disabledByDefault) button.classList.add(DISABLED_CLASS);
            if (notFocusableByDefault) button.classList.add(NOT_FOCUSABLE_CLASS);
        });
    }

    enableKeyboardButton(...buttons);
}

/**
 * Checks if the given button is a keyboard-enabled button.
 *
 * @param {Element} button - The button element to check
 * @returns {boolean} Returns true if the button is a keyboard button, false otherwise
 */
export function isKeyboardButton(button) {
    // Check if this button matches any of the selectors
    return buttonSelectors.some(selector => button.matches(selector));
}

/**
 * Sets a
 * Adds the 'tabindex' attribute to buttons that are not marked as 'not_focusable' or 'disabled'
 *
 * @param {Element[]} buttons - The buttons to add the 'tabindex' attribute to
 */
export function enableKeyboardButton(...buttons) {
    buttons.forEach(button => {
        // If this button doesn't have any of the classes, lets say the caller knows this and wants this to be a custom-enabled keyboard button.
        if (!isKeyboardButton(button)) {
            button.classList.add(CUSTOM_CLICKABLE_BUTTON_CLASS);
        }

        // Set/remove the tabindex accordingly to the classes. Remembering if it had a custom value.
        if (!button.classList.contains(NOT_FOCUSABLE_CLASS) && !button.classList.contains(DISABLED_CLASS)) {
            if (!button.hasAttribute('tabindex')) {
                const tabIndex = button.getAttribute('data-original-tabindex') ?? '0';
                button.setAttribute('tabindex', tabIndex);
            }
        } else {
            button.setAttribute('data-original-tabindex', button.getAttribute('tabindex'));
            button.removeAttribute('tabindex');
        }
    });
}

/**
 * Initializes the focusability of buttons on the given element or the document
 *
 * @param {Element|Document} [element=document] - The element on which to initialize the button focus. Defaults to the document
 */
function initializeButtonFocus(element = document) {
    const buttons = getAllButtons(element);
    enableKeyboardButton(...buttons);
}

/**
 * Queries all buttons within the given element based on the button selectors and returns them as an array
 *
 * @param {Element|Document} element - The element within which to query the buttons
 * @returns {HTMLElement[]} An array containing all the buttons that match the button selectors
 */
function getAllButtons(element) {
    // Query each selecter individually and combine all to a big array to return
    return [].concat(...buttonSelectors.map(selector => Array.from(element.querySelectorAll(`${selector}`))));
}

/**
 * Handles keydown events on the document to trigger click on Enter key press for buttons
 *
 * @param {KeyboardEvent} event - The keyboard event
 */
function handleGlobalKeyDown(event) {
    if (event.key === 'Enter') {
        if (!(event.target instanceof HTMLElement))
            return;

        // Only count enter on this button if no modifier key is pressed
        if (event.altKey || event.ctrlKey || event.shiftKey)
            return;

        // Traverse up the DOM tree to find the actual button element
        let target = event.target;
        while (target && !isKeyboardButton(target)) {
            target = target.parentElement;
        }

        // Trigger click if a valid button is found and it's not disabled
        if (target && !target.classList.contains(DISABLED_CLASS)) {
            console.debug('Triggering click on keyboard-focused button via Enter', target);
            target.click();
        }
    }
}

/**
 * Initializes severial keyboard functionalities for ST
 */
export function initKeyboard() {
    // Start observing the body for added elements and attribute changes
    observer.observe(document.body, {
        childList: true,
        subtree: true,
        attributes: true,
        attributeFilter: ['class']
    });

    // Initialize tabindex for existing buttons
    initializeButtonFocus();

    // Add a global keydown listener
    document.addEventListener('keydown', handleGlobalKeyDown);
}
