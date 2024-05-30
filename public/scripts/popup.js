import { debounce_timeout } from './constants.js';
import { hasAnimation, removeFromArray, runAfterAnimation, uuidv4 } from './utils.js';

/** @readonly */
/** @enum {Number} */
export const POPUP_TYPE = {
    'TEXT': 1,
    'CONFIRM': 2,
    'INPUT': 3,
};

/** @readonly */
/** @enum {number} */
export const POPUP_RESULT = {
    'AFFIRMATIVE': 1,
    'NEGATIVE': 0,
    'CANCELLED': undefined,
};

/** @type {Popup[]} Remember all popups */
export const popups = [];

/**
 * @typedef {object} PopupOptions
 * @property {string|boolean?} [okButton] - Custom text for the OK button, or `true` to use the default (If set, the button will always be displayed, no matter the type of popup)
 * @property {string|boolean?} [cancelButton] - Custom text for the Cancel button, or `true` to use the default (If set, the button will always be displayed, no matter the type of popup)
 * @property {number?} [rows] - The number of rows for the input field
 * @property {boolean?} [wide] - Whether to display the popup in wide mode (wide screen, 1/1 aspect ratio)
 * @property {boolean?} [wider] - Whether to display the popup in wider mode (just wider, no height scaling)
 * @property {boolean?} [large] - Whether to display the popup in large mode (90% of screen)
 * @property {boolean?} [allowHorizontalScrolling] - Whether to allow horizontal scrolling in the popup
 * @property {boolean?} [allowVerticalScrolling] - Whether to allow vertical scrolling in the popup
 * @property {POPUP_RESULT|number?} [defaultResult] - The default result of this popup when Enter is pressed. Can be changed from `POPUP_RESULT.AFFIRMATIVE`.
 * @property {CustomPopupButton[]|string[]?} [customButtons] - Custom buttons to add to the popup. If only strings are provided, the buttons will be added with default options, and their result will be in order from `2` onward.
 */

/**
 * @typedef {object} CustomPopupButton
 * @property {string} text - The text of the button
 * @property {POPUP_RESULT|number?} result - The result of the button - can also be a custom result value to make be able to find out that this button was clicked. If no result is specified, this button will **not** close the popup.
 * @property {string[]|string?} [classes] - Optional custom CSS classes applied to the button
 * @property {()=>void?} [action] - Optional action to perform when the button is clicked
 * @property {boolean?} [appendAtEnd] - Whether to append the button to the end of the popup - by default it will be prepended
 */

export class Popup {
    /** @type {POPUP_TYPE} */ type;

    /** @type {string} */ id;

    /** @type {HTMLDialogElement} */ dlg;
    /** @type {HTMLElement} */ text;
    /** @type {HTMLTextAreaElement} */ input;
    /** @type {HTMLElement} */ controls;
    /** @type {HTMLElement} */ ok;
    /** @type {HTMLElement} */ cancel;
    /** @type {POPUP_RESULT|number?} */ defaultResult;
    /** @type {CustomPopupButton[]|string[]?} */ customButtons;

    /** @type {POPUP_RESULT|number} */ result;
    /** @type {any} */ value;

    /** @type {HTMLElement} */ lastFocus;

    /** @type {Promise<any>} */ promise;
    /** @type {(result: any) => any} */ resolver;

    /**
     * Constructs a new Popup object with the given text, type, inputValue, and options
     *
     * @param {JQuery<HTMLElement>|string|Element} text - Text to display in the popup
     * @param {POPUP_TYPE} type - The type of the popup
     * @param {string} [inputValue=''] - The initial value of the input field
     * @param {PopupOptions} [options={}] - Additional options for the popup
     */
    constructor(text, type, inputValue = '', { okButton = null, cancelButton = null, rows = 1, wide = false, wider = false, large = false, allowHorizontalScrolling = false, allowVerticalScrolling = false, defaultResult = POPUP_RESULT.AFFIRMATIVE, customButtons = null } = {}) {
        popups.push(this);

        // Make this popup uniquely identifiable
        this.id = uuidv4();
        this.type = type;

        /**@type {HTMLTemplateElement}*/
        const template = document.querySelector('#shadow_popup_template');
        // @ts-ignore
        this.dlg = template.content.cloneNode(true).querySelector('.dialogue_popup');
        this.text = this.dlg.querySelector('.dialogue_popup_text');
        this.input = this.dlg.querySelector('.dialogue_popup_input');
        this.controls = this.dlg.querySelector('.dialogue_popup_controls');
        this.ok = this.dlg.querySelector('.dialogue_popup_ok');
        this.cancel = this.dlg.querySelector('.dialogue_popup_cancel');

        this.dlg.setAttribute('data-id', this.id);
        if (wide) this.dlg.classList.add('wide_dialogue_popup');
        if (wider) this.dlg.classList.add('wider_dialogue_popup');
        if (large) this.dlg.classList.add('large_dialogue_popup');
        if (allowHorizontalScrolling) this.dlg.classList.add('horizontal_scrolling_dialogue_popup');
        if (allowVerticalScrolling) this.dlg.classList.add('vertical_scrolling_dialogue_popup');

        // If custom button captions are provided, we set them beforehand
        this.ok.textContent = typeof okButton === 'string' ? okButton : 'OK';
        this.cancel.textContent = typeof cancelButton === 'string' ? cancelButton : template.getAttribute('popup_text_cancel');

        this.defaultResult = defaultResult;
        this.customButtons = customButtons;
        this.customButtons?.forEach((x, index) => {
            /** @type {CustomPopupButton} */
            const button = typeof x === 'string' ? { text: x, result: index + 2 } : x;

            const buttonElement = document.createElement('div');
            buttonElement.classList.add('menu_button', 'menu_button_custom', 'result_control');
            buttonElement.classList.add(...(button.classes ?? []));
            buttonElement.setAttribute('data-result', String(button.result ?? undefined));
            buttonElement.textContent = button.text;
            buttonElement.tabIndex = 0;

            if (button.action) buttonElement.addEventListener('click', button.action);
            if (button.result) buttonElement.addEventListener('click', () => this.complete(button.result));

            if (button.appendAtEnd) {
                this.controls.appendChild(buttonElement);
            } else {
                this.controls.insertBefore(buttonElement, this.ok);
            }
        });

        // Set the default button class
        const defaultButton = this.controls.querySelector(`[data-result="${this.defaultResult}"]`);
        if (defaultButton) defaultButton.classList.add('menu_button_default');

        switch (type) {
            case POPUP_TYPE.TEXT: {
                this.input.style.display = 'none';
                if (!cancelButton) this.cancel.style.display = 'none';
                break;
            }
            case POPUP_TYPE.CONFIRM: {
                this.input.style.display = 'none';
                if (!okButton) this.ok.textContent = template.getAttribute('popup_text_yes');
                if (!cancelButton) this.cancel.textContent = template.getAttribute('popup_text_no');
                break;
            }
            case POPUP_TYPE.INPUT: {
                this.input.style.display = 'block';
                if (!okButton) this.ok.textContent = template.getAttribute('popup_text_save');
                break;
            }
            default: {
                console.warn('Unknown popup type.', type);
                break;
            }
        }

        this.input.value = inputValue;
        this.input.rows = rows ?? 1;

        this.text.innerHTML = '';
        if (text instanceof jQuery) {
            $(this.text).append(text);
        } else if (text instanceof HTMLElement) {
            this.text.append(text);
        } else if (typeof text == 'string') {
            this.text.innerHTML = text;
        } else {
            console.warn('Unknown popup text type. Should be jQuery, HTMLElement or string.', text);
        }

        // Already prepare the auto-focus control by adding the "autofocus" attribute, this should be respected by showModal()
        this.setAutoFocus({ applyAutoFocus: true });

        // Set focus event that remembers the focused element
        this.dlg.addEventListener('focusin', (evt) => { if (evt.target instanceof HTMLElement && evt.target != this.dlg) this.lastFocus = evt.target; });

        this.ok.addEventListener('click', () => this.complete(POPUP_RESULT.AFFIRMATIVE));
        this.cancel.addEventListener('click', () => this.complete(POPUP_RESULT.NEGATIVE));
        const keyListener = (evt) => {
            switch (evt.key) {
                case 'Escape': {
                    // Check if we are the currently active popup
                    if (this.dlg != document.activeElement?.closest('.dialogue_popup'))
                        return;

                    this.complete(POPUP_RESULT.CANCELLED);
                    evt.preventDefault();
                    evt.stopPropagation();
                    window.removeEventListener('keydown', keyListenerBound);
                    break;
                }
                case 'Enter': {
                    // Only count enter if no modifier key is pressed
                    if (evt.altKey || evt.ctrlKey || evt.shiftKey)
                        return;

                    // Check if we are the currently active popup
                    if (this.dlg != document.activeElement?.closest('.dialogue_popup'))
                        return;

                    // Check if the current focus is a result control. Only should we apply the compelete action
                    const resultControl = document.activeElement?.closest('.result_control');
                    if (!resultControl)
                        return;

                    const result = Number(document.activeElement.getAttribute('data-result') ?? this.defaultResult);
                    this.complete(result);
                    evt.preventDefault();
                    evt.stopPropagation();
                    window.removeEventListener('keydown', keyListenerBound);

                    break;
                }
            }

        };
        const keyListenerBound = keyListener.bind(this);
        this.dlg.addEventListener('keydown', keyListenerBound);
    }

    /**
     * Asynchronously shows the popup element by appending it to the document body,
     * setting its display to 'block' and focusing on the input if the popup type is INPUT.
     *
     * @returns {Promise<string|number|boolean?>} A promise that resolves with the value of the popup when it is completed.
     */
    async show() {
        document.body.append(this.dlg);

        this.dlg.showModal();

        // We need to fix the toastr to be present inside this dialog
        fixToastrForDialogs();

        this.promise = new Promise((resolve) => {
            this.resolver = resolve;
        });
        return this.promise;
    }

    setAutoFocus({ applyAutoFocus = false } = {}) {
        /** @type {HTMLElement} */
        let control;

        // Try to find if we have an autofocus control already present
        control = this.dlg.querySelector('[autofocus]');

        // If not, find the default control for this popup type
        if (!control) {
            switch (this.type) {
                case POPUP_TYPE.INPUT: {
                    control = this.input;
                    break;
                }
                default:
                    // Select default button
                    control = this.controls.querySelector(`[data-result="${this.defaultResult}"]`);
                    break;
            }
        }

        if (applyAutoFocus) {
            control.setAttribute('autofocus', '');
        } else {
            control.focus();
        }
    }

    /**
     * Completes the popup and sets its result and value
     *
     * The completion handling will make the popup return the result to the original show promise.
     *
     * There will be two different types of result values:
     * - popup with `POPUP_TYPE.INPUT` will return the input value - or `false` on negative and `null` on cancelled
     * - All other will return the result value as provided as `POPUP_RESULT` or a custom number value
     *
     * @param {POPUP_RESULT|number} result - The result of the popup (either an existing `POPUP_RESULT` or a custom result value)
     */
    complete(result) {
        // In all cases besides INPUT the popup value should be the result
        /** @type {POPUP_RESULT|number|boolean|string?} */
        let value = result;
        // Input type have special results, so the input can be accessed directly without the need to save the popup and access both result and value
        if (this.type === POPUP_TYPE.INPUT) {
            if (result >= POPUP_RESULT.AFFIRMATIVE) value = this.input.value;
            if (result === POPUP_RESULT.NEGATIVE) value = false;
            if (result === POPUP_RESULT.CANCELLED) value = null;
            else value = false; // Might a custom negative value?
        }

        this.value = value;
        this.result = result;
        this.hide();
    }

    /**
     * Hides the popup, using the internal resolver to return the value to the original show promise
     * @private
     */
    hide() {
        // We close the dialog, first running the animation
        this.dlg.setAttribute('closing', '');

        // Once the hiding starts, we need to fix the toastr to the layer below
        fixToastrForDialogs();

        // After the dialog is actually completely closed, remove it from the DOM
        runAfterAnimation(this.dlg, () => {
            // Call the close on the dialog
            this.dlg.close();

            // Remove it from the dom
            this.dlg.remove();

            // Remove it from the popup references
            removeFromArray(popups, this);

            // If there is any popup below this one, see if we can set the focus
            if (popups.length > 0) {
                const activeDialog = document.activeElement?.closest('.dialogue_popup');
                const id = activeDialog?.getAttribute('data-id');
                const popup = popups.find(x => x.id == id);
                if (popup) {
                    if (popup.lastFocus) popup.lastFocus.focus();
                    else popup.setAutoFocus();
                }
            }
        });

        this.resolver(this.value);
    }
}

/**
 * Displays a blocking popup with a given text and type
 * @param {JQuery<HTMLElement>|string|Element} text - Text to display in the popup
 * @param {POPUP_TYPE} type
 * @param {string} inputValue - Value to set the input to
 * @param {PopupOptions} [popupOptions={}] - Options for the popup
 * @returns {Promise<POPUP_RESULT|string|boolean?>} The value for this popup, which can either be the popup retult or the input value if chosen
 */
export function callGenericPopup(text, type, inputValue = '', popupOptions = {}) {
    const popup = new Popup(
        text,
        type,
        inputValue,
        popupOptions,
    );
    return popup.show();
}

export function fixToastrForDialogs() {
    // Hacky way of getting toastr to actually display on top of the popup...

    const dlg = Array.from(document.querySelectorAll('dialog[open]:not([closing])')).pop();

    let toastContainer = document.getElementById('toast-container');
    const isAlreadyPresent = !!toastContainer;
    if (!toastContainer) {
        toastContainer = document.createElement('div');
        toastContainer.setAttribute('id', 'toast-container');
        if (toastr.options.positionClass) toastContainer.classList.add(toastr.options.positionClass);
    }

    // Check if toastr is already a child. If not, we need to move it inside this dialog.
    // This is either the existing toastr container or the newly created one.
    if (dlg && !dlg.contains(toastContainer)) {
        dlg?.appendChild(toastContainer);
        return;
    }

    // Now another case is if we only have one popup and that is currently closing. In that case the toastr container exists,
    // but we don't have an open dialog to move it into. It's just inside the existing one that will be gone in milliseconds.
    // To prevent new toasts from being showing up in there and then vanish in an instant,
    // we move the toastr back to the main body
    if (!dlg && isAlreadyPresent) {
        document.body.appendChild(toastContainer);
    }
}
