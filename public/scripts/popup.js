import { animation_duration, animation_easing } from '../script.js';
import { delay } from './utils.js';



/**@readonly*/
/**@enum {Number}*/
export const POPUP_TYPE = {
    'TEXT': 1,
    'CONFIRM': 2,
    'INPUT': 3,
};

/**@readonly*/
/**@enum {Boolean}*/
export const POPUP_RESULT = {
    'AFFIRMATIVE': true,
    'NEGATIVE': false,
    'CANCELLED': undefined,
};



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
     * @typedef {{okButton?: string, cancelButton?: string, rows?: number, wide?: boolean, large?: boolean, allowHorizontalScrolling?: boolean, allowVerticalScrolling?: boolean }} PopupOptions - Options for the popup.
     * @param {JQuery<HTMLElement>|string|Element} text - Text to display in the popup.
     * @param {POPUP_TYPE} type - One of Popup.TYPE
     * @param {string} inputValue - Value to set the input to.
     * @param {PopupOptions} options - Options for the popup.
     */
    constructor(text, type, inputValue = '', { okButton, cancelButton, rows, wide, wider, large, allowHorizontalScrolling, allowVerticalScrolling } = {}) {
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
        this.ok = this.dom.querySelector('.dialogue_popup_ok');
        this.cancel = this.dom.querySelector('.dialogue_popup_cancel');

        if (wide) dlg.classList.add('wide_dialogue_popup');
        if (wider) dlg.classList.add('wider_dialogue_popup');
        if (large) dlg.classList.add('large_dialogue_popup');
        if (allowHorizontalScrolling) dlg.classList.add('horizontal_scrolling_dialogue_popup');
        if (allowVerticalScrolling) dlg.classList.add('vertical_scrolling_dialogue_popup');

        this.ok.textContent = okButton ?? 'OK';
        this.cancel.textContent = cancelButton ?? template.getAttribute('popup_text_cancel');

        switch (type) {
            case POPUP_TYPE.TEXT: {
                this.input.style.display = 'none';
                this.cancel.style.display = 'none';
                break;
            }
            case POPUP_TYPE.CONFIRM: {
                this.input.style.display = 'none';
                this.ok.textContent = okButton ?? template.getAttribute('popup_text_yes');
                this.cancel.textContent = cancelButton ?? template.getAttribute('popup_text_no');
                break;
            }
            case POPUP_TYPE.INPUT: {
                this.input.style.display = 'block';
                this.ok.textContent = okButton ?? template.getAttribute('popup_text_save');
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

        this.input.addEventListener('keydown', (evt) => {
            if (evt.key != 'Enter' || evt.altKey || evt.ctrlKey || evt.shiftKey) return;
            evt.preventDefault();
            evt.stopPropagation();
            this.completeAffirmative();
        });

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
            }
        };
        const keyListenerBound = keyListener.bind(this);
        window.addEventListener('keydown', keyListenerBound);
    }

    async show() {
        document.body.append(this.dom);
        this.dom.style.display = 'block';
        switch (this.type) {
            case POPUP_TYPE.INPUT: {
                this.input.focus();
                break;
            }
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



    hide() {
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
 * Displays a blocking popup with a given text and type.
 * @param {JQuery<HTMLElement>|string|Element} text - Text to display in the popup.
 * @param {POPUP_TYPE} type
 * @param {string} inputValue - Value to set the input to.
 * @param {PopupOptions} options - Options for the popup.
 * @returns
 */
export function callGenericPopup(text, type, inputValue = '', { okButton, cancelButton, rows, wide, wider, large, allowHorizontalScrolling, allowVerticalScrolling } = {}) {
    const popup = new Popup(
        text,
        type,
        inputValue,
        { okButton, cancelButton, rows, wide, wider, large, allowHorizontalScrolling, allowVerticalScrolling },
    );
    return popup.show();
}
