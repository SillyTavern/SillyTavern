import { animation_duration, animation_easing } from '../script.js';
import { delay } from './utils.js';

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

const POPUP_START_Z_INDEX = 9998;
let currentPopupZIndex = POPUP_START_Z_INDEX;

/**
 * @typedef {object} PopupOptions
 * @property {string|boolean?} [okButton] - Custom text for the OK button, or `true` to use the default (If set, the button will always be displayed, no matter the type of popup)
 * @property {string|boolean?} [cancelButton] - Custom text for the Cancel button, or `true` to use the default (If set, the button will always be displayed, no matter the type of popup)
 * @property {number?} [rows] - The number of rows for the input field
 * @property {boolean?} [wide] - Whether to display the popup in wide mode
 * @property {boolean?} [large] - Whether to display the popup in large mode
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
    /**@type {POPUP_TYPE}*/ type;

    /**@type {HTMLElement}*/ dom;
    /**@type {HTMLElement}*/ dlg;
    /**@type {HTMLElement}*/ text;
    /**@type {HTMLTextAreaElement}*/ input;
    /**@type {HTMLElement}*/ ok;
    /**@type {HTMLElement}*/ cancel;

    /**@type {POPUP_RESULT}*/ result;
    /**@type {any}*/ value;

    /**@type {Promise}*/ promise;
    /**@type {Function}*/ resolver;

    /**@type {Function}*/ keyListenerBound;

    /**
     * Constructs a new Popup object with the given text, type, inputValue, and options
     *
     * @param {JQuery<HTMLElement>|string|Element} text - Text to display in the popup
     * @param {POPUP_TYPE} type - The type of the popup
     * @param {string} [inputValue=''] - The initial value of the input field
     * @param {PopupOptions} [options={}] - Additional options for the popup
     */
    constructor(text, type, inputValue = '', { okButton = null, cancelButton = null, rows = 1, wide = false, large = false, allowHorizontalScrolling = false, allowVerticalScrolling = false, defaultResult = POPUP_RESULT.AFFIRMATIVE, customButtons = null } = {}) {
        this.type = type;

        /**@type {HTMLTemplateElement}*/
        const template = document.querySelector('#shadow_popup_template');
        // @ts-ignore
        this.dom = template.content.cloneNode(true).querySelector('.shadow_popup');
        const dlg = this.dom.querySelector('.dialogue_popup');
        // @ts-ignore
        this.dlg = dlg;
        this.text = this.dom.querySelector('.dialogue_popup_text');
        this.input = this.dom.querySelector('.dialogue_popup_input');
        this.controls = this.dom.querySelector('.dialogue_popup_controls');
        this.ok = this.dom.querySelector('.dialogue_popup_ok');
        this.cancel = this.dom.querySelector('.dialogue_popup_cancel');

        if (wide) dlg.classList.add('wide_dialogue_popup');
        if (large) dlg.classList.add('large_dialogue_popup');
        if (allowHorizontalScrolling) dlg.classList.add('horizontal_scrolling_dialogue_popup');
        if (allowVerticalScrolling) dlg.classList.add('vertical_scrolling_dialogue_popup');

        // If custom button captions are provided, we set them beforehand
        this.ok.textContent = typeof okButton === 'string' ? okButton : 'OK';
        this.cancel.textContent = typeof cancelButton === 'string' ? cancelButton : template.getAttribute('popup_text_cancel');

        this.defaultResult = defaultResult;
        this.customButtons = customButtons;
        this.customButtonElements = this.customButtons?.map((x, index) => {
            /** @type {CustomPopupButton} */
            const button = typeof x === 'string' ? { text: x, result: index + 2 } : x;
            const buttonElement = document.createElement('button');

            buttonElement.classList.add('menu_button', 'menu_button_custom');
            buttonElement.classList.add(...(button.classes ?? []));

            buttonElement.textContent = button.text;
            if (button.action) buttonElement.addEventListener('click', button.action);
            if (button.result) buttonElement.addEventListener('click', () => this.completeCustom(button.result));

            buttonElement.setAttribute('data-result', String(button.result ?? undefined));

            if (button.appendAtEnd) {
                this.controls.appendChild(buttonElement);
            } else {
                this.controls.insertBefore(buttonElement, this.ok);
            }
            return buttonElement;
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
                // illegal argument
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
            // illegal argument
        }

        this.ok.addEventListener('click', () => this.completeAffirmative());
        this.cancel.addEventListener('click', () => this.completeNegative());
        const keyListener = (evt) => {
            switch (evt.key) {
                case 'Escape': {
                    // does it really matter where we check?
                    const topModal = document.elementFromPoint(window.innerWidth / 2, window.innerHeight / 2)?.closest('.shadow_popup');
                    if (topModal == this.dom) {
                        evt.preventDefault();
                        evt.stopPropagation();
                        this.completeCancelled();
                        window.removeEventListener('keydown', keyListenerBound);
                        break;
                    }
                }
                case 'Enter': {
                    // Only count enter if no modifier key is pressed
                    if (!evt.altKey && !evt.ctrlKey && !evt.shiftKey) {
                        evt.preventDefault();
                        evt.stopPropagation();
                        this.completeCustom(this.defaultResult);
                        window.removeEventListener('keydown', keyListenerBound);
                    }
                    break;
                }
            }
        };
        const keyListenerBound = keyListener.bind(this);
        window.addEventListener('keydown', keyListenerBound);
    }

    /**
     * Asynchronously shows the popup element by appending it to the document body,
     * setting its display to 'block' and focusing on the input if the popup type is INPUT.
     *
     * @returns {Promise<string|number|boolean?>} A promise that resolves with the value of the popup when it is completed.
     */
    async show() {
        // Set z-index, so popups can stack "on top" of each other
        this.dom.style.zIndex = String(++currentPopupZIndex);

        document.body.append(this.dom);
        this.dom.style.display = 'block';
        switch (this.type) {
            case POPUP_TYPE.INPUT: {
                this.input.focus();
                break;
            }
            default:
                this.ok.focus();
                break;
        }

        $(this.dom).transition({
            opacity: 1,
            duration: animation_duration,
            easing: animation_easing,
        });

        this.promise = new Promise((resolve) => {
            this.resolver = resolve;
        });
        return this.promise;
    }

    completeAffirmative() {
        switch (this.type) {
            case POPUP_TYPE.TEXT:
            case POPUP_TYPE.CONFIRM: {
                this.value = true;
                break;
            }
            case POPUP_TYPE.INPUT: {
                this.value = this.input.value;
                break;
            }
        }
        this.result = POPUP_RESULT.AFFIRMATIVE;
        this.hide();
    }

    completeNegative() {
        switch (this.type) {
            case POPUP_TYPE.TEXT:
            case POPUP_TYPE.CONFIRM:
            case POPUP_TYPE.INPUT: {
                this.value = false;
                break;
            }
        }
        this.result = POPUP_RESULT.NEGATIVE;
        this.hide();
    }

    completeCancelled() {
        switch (this.type) {
            case POPUP_TYPE.TEXT:
            case POPUP_TYPE.CONFIRM:
            case POPUP_TYPE.INPUT: {
                this.value = null;
                break;
            }
        }
        this.result = POPUP_RESULT.CANCELLED;
        this.hide();
    }



    /**
     * Completes the popup with a custom result.
     * Calls into the default three delete states, if a valid `POPUP_RESULT` is provided.
     *
     * @param {POPUP_RESULT|number} result - The result of the custom action
     */
    completeCustom(result) {
        switch (result) {
            case POPUP_RESULT.AFFIRMATIVE: {
                this.completeAffirmative();
                break;
            }
            case POPUP_RESULT.NEGATIVE: {
                this.completeNegative();
                break;
            }
            case POPUP_RESULT.CANCELLED: {
                this.completeCancelled();
                break;
            }
            default: {
                this.value = this.type === POPUP_TYPE.INPUT ? this.input.value : result;
                this.result = result ? POPUP_RESULT.AFFIRMATIVE : POPUP_RESULT.NEGATIVE;
                this.hide();
                break;
            }
        }
    }

    /**
     * Hides the popup, using the internal resolver to return the value to the original show promise
     */
    hide() {
        --currentPopupZIndex;
        $(this.dom).transition({
            opacity: 0,
            duration: animation_duration,
            easing: animation_easing,
        });
        delay(animation_duration).then(() => {
            this.dom.remove();
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
