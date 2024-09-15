import { shouldSendOnEnter } from './RossAscends-mods.js';
import { power_user } from './power-user.js';
import { removeFromArray, runAfterAnimation, uuidv4 } from './utils.js';

/** @readonly */
/** @enum {Number} */
export const POPUP_TYPE = {
    /** Main popup type. Containing any content displayed, with buttons below. Can also contain additional input controls. */
    TEXT: 1,
    /** Popup mainly made to confirm something, answering with a simple Yes/No or similar. Focus on the button controls. */
    CONFIRM: 2,
    /** Popup who's main focus is the input text field, which is displayed here. Can contain additional content above. Return value for this is the input string. */
    INPUT: 3,
    /** Popup without any button controls. Used to simply display content, with a small X in the corner. */
    DISPLAY: 4,
    /** Popup that displays an image to crop. Returns a cropped image in result. */
    CROP: 5,
};

/** @readonly */
/** @enum {number?} */
export const POPUP_RESULT = {
    AFFIRMATIVE: 1,
    NEGATIVE: 0,
    CANCELLED: null,
};

/**
 * @typedef {object} PopupOptions
 * @property {string|boolean?} [okButton=null] - Custom text for the OK button, or `true` to use the default (If set, the button will always be displayed, no matter the type of popup)
 * @property {string|boolean?} [cancelButton=null] - Custom text for the Cancel button, or `true` to use the default (If set, the button will always be displayed, no matter the type of popup)
 * @property {number?} [rows=1] - The number of rows for the input field
 * @property {boolean?} [wide=false] - Whether to display the popup in wide mode (wide screen, 1/1 aspect ratio)
 * @property {boolean?} [wider=false] - Whether to display the popup in wider mode (just wider, no height scaling)
 * @property {boolean?} [large=false] - Whether to display the popup in large mode (90% of screen)
 * @property {boolean?} [transparent=false] - Whether to display the popup in transparent mode (no background, border, shadow or anything, only its content)
 * @property {boolean?} [allowHorizontalScrolling=false] - Whether to allow horizontal scrolling in the popup
 * @property {boolean?} [allowVerticalScrolling=false] - Whether to allow vertical scrolling in the popup
 * @property {'slow'|'fast'|'none'?} [animation='slow'] - Animation speed for the popup (opening, closing, ...)
 * @property {POPUP_RESULT|number?} [defaultResult=POPUP_RESULT.AFFIRMATIVE] - The default result of this popup when Enter is pressed. Can be changed from `POPUP_RESULT.AFFIRMATIVE`.
 * @property {CustomPopupButton[]|string[]?} [customButtons=null] - Custom buttons to add to the popup. If only strings are provided, the buttons will be added with default options, and their result will be in order from `2` onward.
 * @property {CustomPopupInput[]?} [customInputs=null] - Custom inputs to add to the popup. The display below the content and the input box, one by one.
 * @property {(popup: Popup) => Promise<boolean?>|boolean?} [onClosing=null] - Handler called before the popup closes, return `false` to cancel the close
 * @property {(popup: Popup) => Promise<void?>|void?} [onClose=null] - Handler called after the popup closes, but before the DOM is cleaned up
 * @property {number?} [cropAspect=null] - Aspect ratio for the crop popup
 * @property {string?} [cropImage=null] - Image URL to display in the crop popup
 */

/**
 * @typedef {object} CustomPopupButton
 * @property {string} text - The text of the button
 * @property {POPUP_RESULT|number?} [result] - The result of the button - can also be a custom result value to make be able to find out that this button was clicked. If no result is specified, this button will **not** close the popup.
 * @property {string[]|string?} [classes] - Optional custom CSS classes applied to the button
 * @property {()=>void?} [action] - Optional action to perform when the button is clicked
 * @property {boolean?} [appendAtEnd] - Whether to append the button to the end of the popup - by default it will be prepended
 */

/**
 * @typedef {object} CustomPopupInput
 * @property {string} id - The id for the html element
 * @property {string} label - The label text for the input
 * @property {string?} [tooltip=null] - Optional tooltip icon displayed behind the label
 * @property {boolean?} [defaultState=false] - The default state when opening the popup (false if not set)
 */

/**
 * @typedef {object} ShowPopupHelper
 * Local implementation of the helper functionality to show several popups.
 *
 * Should be called via `Popup.show.xxxx()`.
 */
const showPopupHelper = {
    /**
     * Asynchronously displays an input popup with the given header and text, and returns the user's input.
     *
     * @param {string?} header - The header text for the popup.
     * @param {string?} text - The main text for the popup.
     * @param {string} [defaultValue=''] - The default value for the input field.
     * @param {PopupOptions} [popupOptions={}] - Options for the popup.
     * @return {Promise<string?>} A Promise that resolves with the user's input.
     */
    input: async (header, text, defaultValue = '', popupOptions = {}) => {
        const content = PopupUtils.BuildTextWithHeader(header, text);
        const popup = new Popup(content, POPUP_TYPE.INPUT, defaultValue, popupOptions);
        const value = await popup.show();
        // Return values: If empty string, we explicitly handle that as returning that empty string as "success" provided.
        // Otherwise, all non-truthy values (false, null, undefined) are treated as "cancel" and return null.
        if (value === '') return '';
        return value ? String(value) : null;
    },

    /**
     * Asynchronously displays a confirmation popup with the given header and text, returning the clicked result button value.
     *
     * @param {string?} header - The header text for the popup.
     * @param {string?} text - The main text for the popup.
     * @param {PopupOptions} [popupOptions={}] - Options for the popup.
     * @return {Promise<POPUP_RESULT?>} A Promise that resolves with the result of the user's interaction.
     */
    confirm: async (header, text, popupOptions = {}) => {
        const content = PopupUtils.BuildTextWithHeader(header, text);
        const popup = new Popup(content, POPUP_TYPE.CONFIRM, null, popupOptions);
        const result = await popup.show();
        if (typeof result === 'string' || typeof result === 'boolean') throw new Error(`Invalid popup result. CONFIRM popups only support numbers, or null. Result: ${result}`);
        return result;
    },
    /**
     * Asynchronously displays a text popup with the given header and text, returning the clicked result button value.
     *
     * @param {string?} header - The header text for the popup.
     * @param {string?} text - The main text for the popup.
     * @param {PopupOptions} [popupOptions={}] - Options for the popup.
     * @return {Promise<POPUP_RESULT?>} A Promise that resolves with the result of the user's interaction.
     */
    text: async (header, text, popupOptions = {}) => {
        const content = PopupUtils.BuildTextWithHeader(header, text);
        const popup = new Popup(content, POPUP_TYPE.TEXT, null, popupOptions);
        const result = await popup.show();
        if (typeof result === 'string' || typeof result === 'boolean') throw new Error(`Invalid popup result. TEXT popups only support numbers, or null. Result: ${result}`);
        return result;
    },
};

export class Popup {
    /** @readonly @type {POPUP_TYPE} */ type;

    /** @readonly @type {string} */ id;

    /** @readonly @type {HTMLDialogElement} */ dlg;
    /** @readonly @type {HTMLDivElement} */ body;
    /** @readonly @type {HTMLDivElement} */ content;
    /** @readonly @type {HTMLTextAreaElement} */ mainInput;
    /** @readonly @type {HTMLDivElement} */ inputControls;
    /** @readonly @type {HTMLDivElement} */ buttonControls;
    /** @readonly @type {HTMLDivElement} */ okButton;
    /** @readonly @type {HTMLDivElement} */ cancelButton;
    /** @readonly @type {HTMLDivElement} */ closeButton;
    /** @readonly @type {HTMLDivElement} */ cropWrap;
    /** @readonly @type {HTMLImageElement} */ cropImage;
    /** @readonly @type {POPUP_RESULT|number?} */ defaultResult;
    /** @readonly @type {CustomPopupButton[]|string[]?} */ customButtons;
    /** @readonly @type {CustomPopupInput[]} */ customInputs;

    /** @type {(popup: Popup) => Promise<boolean?>|boolean?} */ onClosing;
    /** @type {(popup: Popup) => Promise<void?>|void?} */ onClose;

    /** @type {POPUP_RESULT|number} */ result;
    /** @type {any} */ value;
    /** @type {Map<string,boolean>?} */ inputResults;
    /** @type {any} */ cropData;

    /** @type {HTMLElement} */ lastFocus;

    /** @type {Promise<any>} */ #promise;
    /** @type {(result: any) => any} */ #resolver;
    /** @type {boolean} */ #isClosingPrevented;

    /**
     * Constructs a new Popup object with the given text content, type, inputValue, and options
     *
     * @param {JQuery<HTMLElement>|string|Element} content - Text content to display in the popup
     * @param {POPUP_TYPE} type - The type of the popup
     * @param {string} [inputValue=''] - The initial value of the input field
     * @param {PopupOptions} [options={}] - Additional options for the popup
     */
    constructor(content, type, inputValue = '', { okButton = null, cancelButton = null, rows = 1, wide = false, wider = false, large = false, transparent = false, allowHorizontalScrolling = false, allowVerticalScrolling = false, animation = 'fast', defaultResult = POPUP_RESULT.AFFIRMATIVE, customButtons = null, customInputs = null, onClosing = null, onClose = null, cropAspect = null, cropImage = null } = {}) {
        Popup.util.popups.push(this);

        // Make this popup uniquely identifiable
        this.id = uuidv4();
        this.type = type;

        // Utilize event handlers being passed in
        this.onClosing = onClosing;
        this.onClose = onClose;

        /**@type {HTMLTemplateElement}*/
        const template = document.querySelector('#popup_template');
        // @ts-ignore
        this.dlg = template.content.cloneNode(true).querySelector('.popup');
        this.body = this.dlg.querySelector('.popup-body');
        this.content = this.dlg.querySelector('.popup-content');
        this.mainInput = this.dlg.querySelector('.popup-input');
        this.inputControls = this.dlg.querySelector('.popup-inputs');
        this.buttonControls = this.dlg.querySelector('.popup-controls');
        this.okButton = this.dlg.querySelector('.popup-button-ok');
        this.cancelButton = this.dlg.querySelector('.popup-button-cancel');
        this.closeButton = this.dlg.querySelector('.popup-button-close');
        this.cropWrap = this.dlg.querySelector('.popup-crop-wrap');
        this.cropImage = this.dlg.querySelector('.popup-crop-image');

        this.dlg.setAttribute('data-id', this.id);
        if (wide) this.dlg.classList.add('wide_dialogue_popup');
        if (wider) this.dlg.classList.add('wider_dialogue_popup');
        if (large) this.dlg.classList.add('large_dialogue_popup');
        if (transparent) this.dlg.classList.add('transparent_dialogue_popup');
        if (allowHorizontalScrolling) this.dlg.classList.add('horizontal_scrolling_dialogue_popup');
        if (allowVerticalScrolling) this.dlg.classList.add('vertical_scrolling_dialogue_popup');
        if (animation) this.dlg.classList.add('popup--animation-' + animation);

        // If custom button captions are provided, we set them beforehand
        this.okButton.textContent = typeof okButton === 'string' ? okButton : 'OK';
        this.okButton.dataset.i18n = this.okButton.textContent;
        this.cancelButton.textContent = typeof cancelButton === 'string' ? cancelButton : template.getAttribute('popup-button-cancel');
        this.cancelButton.dataset.i18n = this.cancelButton.textContent;

        this.defaultResult = defaultResult;
        this.customButtons = customButtons;
        this.customButtons?.forEach((x, index) => {
            /** @type {CustomPopupButton} */
            const button = typeof x === 'string' ? { text: x, result: index + 2 } : x;

            const buttonElement = document.createElement('div');
            buttonElement.classList.add('menu_button', 'popup-button-custom', 'result-control');
            buttonElement.classList.add(...(button.classes ?? []));
            buttonElement.dataset.result = String(button.result); // This is expected to also write 'null' or 'staging', to indicate cancel and no action respectively
            buttonElement.textContent = button.text;
            buttonElement.dataset.i18n = buttonElement.textContent;
            buttonElement.tabIndex = 0;

            if (button.appendAtEnd) {
                this.buttonControls.appendChild(buttonElement);
            } else {
                this.buttonControls.insertBefore(buttonElement, this.okButton);
            }

            if (typeof button.action === 'function') {
                buttonElement.addEventListener('click', button.action);
            }
        });

        this.customInputs = customInputs;
        this.customInputs?.forEach(input => {
            if (!input.id || !(typeof input.id === 'string')) {
                console.warn('Given custom input does not have a valid id set');
                return;
            }

            const label = document.createElement('label');
            label.classList.add('checkbox_label', 'justifyCenter');
            label.setAttribute('for', input.id);
            const inputElement = document.createElement('input');
            inputElement.type = 'checkbox';
            inputElement.id = input.id;
            inputElement.checked = input.defaultState ?? false;
            label.appendChild(inputElement);
            const labelText = document.createElement('span');
            labelText.innerText = input.label;
            labelText.dataset.i18n = input.label;
            label.appendChild(labelText);

            if (input.tooltip) {
                const tooltip = document.createElement('div');
                tooltip.classList.add('fa-solid', 'fa-circle-info', 'opacity50p');
                tooltip.title = input.tooltip;
                tooltip.dataset.i18n = '[title]' + input.tooltip;
                label.appendChild(tooltip);
            }

            this.inputControls.appendChild(label);
        });

        // Set the default button class
        const defaultButton = this.buttonControls.querySelector(`[data-result="${this.defaultResult}"]`);
        if (defaultButton) defaultButton.classList.add('menu_button_default');

        // Styling differences depending on the popup type
        // General styling for all types first, that might be overriden for specific types below
        this.mainInput.style.display = 'none';
        this.inputControls.style.display = customInputs ? 'block' : 'none';
        this.closeButton.style.display = 'none';
        this.cropWrap.style.display = 'none';

        switch (type) {
            case POPUP_TYPE.TEXT: {
                if (!cancelButton) this.cancelButton.style.display = 'none';
                break;
            }
            case POPUP_TYPE.CONFIRM: {
                if (!okButton) this.okButton.textContent = template.getAttribute('popup-button-yes');
                if (!cancelButton) this.cancelButton.textContent = template.getAttribute('popup-button-no');
                break;
            }
            case POPUP_TYPE.INPUT: {
                this.mainInput.style.display = 'block';
                if (!okButton) this.okButton.textContent = template.getAttribute('popup-button-save');
                if (cancelButton === false) this.cancelButton.style.display = 'none';
                break;
            }
            case POPUP_TYPE.DISPLAY: {
                this.buttonControls.style.display = 'none';
                this.closeButton.style.display = 'block';
                break;
            }
            case POPUP_TYPE.CROP: {
                this.cropWrap.style.display = 'block';
                this.cropImage.src = cropImage;
                if (!okButton) this.okButton.textContent = template.getAttribute('popup-button-crop');
                $(this.cropImage).cropper({
                    aspectRatio: cropAspect ?? 2 / 3,
                    autoCropArea: 1,
                    viewMode: 2,
                    rotatable: false,
                    crop: (event) => {
                        this.cropData = event.detail;
                        this.cropData.want_resize = !power_user.never_resize_avatars;
                    },
                });
                break;
            }
            default: {
                console.warn('Unknown popup type.', type);
                break;
            }
        }

        this.mainInput.value = inputValue;
        this.mainInput.rows = rows ?? 1;

        this.content.innerHTML = '';
        if (content instanceof jQuery) {
            $(this.content).append(content);
        } else if (content instanceof HTMLElement) {
            this.content.append(content);
        } else if (typeof content == 'string') {
            this.content.innerHTML = content;
        } else {
            console.warn('Unknown popup text type. Should be jQuery, HTMLElement or string.', content);
        }

        // Already prepare the auto-focus control by adding the "autofocus" attribute, this should be respected by showModal()
        this.setAutoFocus({ applyAutoFocus: true });

        // Set focus event that remembers the focused element
        this.dlg.addEventListener('focusin', (evt) => { if (evt.target instanceof HTMLElement && evt.target != this.dlg) this.lastFocus = evt.target; });

        // Bind event listeners for all result controls to their defined event type
        this.dlg.querySelectorAll('[data-result]').forEach(resultControl => {
            if (!(resultControl instanceof HTMLElement)) return;
            // If no value was set, we exit out and don't bind an action
            if (String(resultControl.dataset.result) === String(undefined)) return;

            // Make sure that both `POPUP_RESULT` numbers and also `null` as 'cancelled' are supported
            const result = String(resultControl.dataset.result) === String(null) ? null
                : Number(resultControl.dataset.result);

            if (result !== null && isNaN(result)) throw new Error('Invalid result control. Result must be a number. ' + resultControl.dataset.result);
            const type = resultControl.dataset.resultEvent || 'click';
            resultControl.addEventListener(type, async () => await this.complete(result));
        });

        // Bind dialog listeners manually, so we can be sure context is preserved
        const cancelListener = async (evt) => {
            evt.preventDefault();
            evt.stopPropagation();
            await this.complete(POPUP_RESULT.CANCELLED);
        };
        this.dlg.addEventListener('cancel', cancelListener.bind(this));

        // Don't ask me why this is needed. I don't get it. But we have to keep it.
        // We make sure that the modal on its own doesn't hide. Dunno why, if onClosing is triggered multiple times through the cancel event, and stopped,
        // it seems to just call 'close' on the dialog even if the 'cancel' event was prevented.
        // So here we just say that close should not happen if it was prevented.
        const closeListener = async (evt) => {
            if (this.#isClosingPrevented) {
                evt.preventDefault();
                evt.stopPropagation();
                this.dlg.showModal();
            }
        };
        this.dlg.addEventListener('close', closeListener.bind(this));

        const keyListener = async (evt) => {
            switch (evt.key) {
                case 'Enter': {
                    // CTRL+Enter counts as a closing action, but all other modifiers (ALT, SHIFT) should not trigger this
                    if (evt.altKey || evt.shiftKey)
                        return;

                    // Check if we are the currently active popup
                    if (this.dlg != document.activeElement?.closest('.popup'))
                        return;

                    // Check if the current focus is a result control. Only should we apply the complete action
                    const resultControl = document.activeElement?.closest('.result-control');
                    if (!resultControl)
                        return;

                    // Check if we are inside an input type text or a textarea field and send on enter is disabled
                    const textarea = document.activeElement?.closest('textarea');
                    if (textarea instanceof HTMLTextAreaElement && !shouldSendOnEnter())
                        return;
                    const input = document.activeElement?.closest('input[type="text"]');
                    if (input instanceof HTMLInputElement && !shouldSendOnEnter())
                        return;

                    evt.preventDefault();
                    evt.stopPropagation();
                    const result = Number(document.activeElement.getAttribute('data-result') ?? this.defaultResult);

                    // Call complete on the popup. Make sure that we handle `onClosing` cancels correctly and don't remove the listener then.
                    await this.complete(result);

                    break;
                }
            }

        };
        this.dlg.addEventListener('keydown', keyListener.bind(this));
    }

    /**
     * Asynchronously shows the popup element by appending it to the document body,
     * setting its display to 'block' and focusing on the input if the popup type is INPUT.
     *
     * @returns {Promise<string|number|boolean?>} A promise that resolves with the value of the popup when it is completed.
     */
    async show() {
        document.body.append(this.dlg);

        // Run opening animation
        this.dlg.setAttribute('opening', '');

        this.dlg.showModal();

        // We need to fix the toastr to be present inside this dialog
        fixToastrForDialogs();

        runAfterAnimation(this.dlg, () => {
            this.dlg.removeAttribute('opening');
        });

        this.#promise = new Promise((resolve) => {
            this.#resolver = resolve;
        });
        return this.#promise;
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
                    control = this.mainInput;
                    break;
                }
                default:
                    // Select default button
                    control = this.buttonControls.querySelector(`[data-result="${this.defaultResult}"]`);
                    break;
            }
        }

        if (applyAutoFocus) {
            control.setAttribute('autofocus', '');
            // Manually enable tabindex too, as this might only be applied by the interactable functionality in the background, but too late for HTML autofocus
            // interactable only gets applied when inserted into the DOM
            control.tabIndex = 0;
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
     * <b>IMPORTANT:</b> If the popup closing was cancelled via the `onClosing` handler, the return value will be `Promise<undefined>`.
     *
     * @param {POPUP_RESULT|number} result - The result of the popup (either an existing `POPUP_RESULT` or a custom result value)
     *
     * @returns {Promise<string|number|boolean|undefined?>} A promise that resolves with the value of the popup when it is completed. <b>Returns `undefined` if the closing action was cancelled.</b>
     */
    async complete(result) {
        // In all cases besides INPUT the popup value should be the result
        /** @type {POPUP_RESULT|number|boolean|string?} */
        let value = result;
        // Input type have special results, so the input can be accessed directly without the need to save the popup and access both result and value
        if (this.type === POPUP_TYPE.INPUT) {
            if (result >= POPUP_RESULT.AFFIRMATIVE) value = this.mainInput.value;
            else if (result === POPUP_RESULT.NEGATIVE) value = false;
            else if (result === POPUP_RESULT.CANCELLED) value = null;
            else value = false; // Might a custom negative value?
        }

        // Cropped image should be returned as a data URL
        if (this.type === POPUP_TYPE.CROP) {
            value = result >= POPUP_RESULT.AFFIRMATIVE
                ? $(this.cropImage).data('cropper').getCroppedCanvas().toDataURL('image/jpeg')
                : null;
        }

        if (this.customInputs?.length) {
            this.inputResults = new Map(this.customInputs.map(input => {
                /** @type {HTMLInputElement} */
                const inputControl = this.dlg.querySelector(`#${input.id}`);
                return [inputControl.id, inputControl.checked];
            }));
        }

        this.value = value;
        this.result = result;

        if (this.onClosing) {
            const shouldClose = await this.onClosing(this);
            if (!shouldClose) {
                this.#isClosingPrevented = true;
                // Set values back if we cancel out of closing the popup
                this.value = undefined;
                this.result = undefined;
                this.inputResults = undefined;
                return undefined;
            }
        }
        this.#isClosingPrevented = false;

        Popup.util.lastResult = { value, result, inputResults: this.inputResults };
        this.#hide();

        return this.#promise;
    }
    async completeAffirmative() {
        return await this.complete(POPUP_RESULT.AFFIRMATIVE);
    }
    async completeNegative() {
        return await this.complete(POPUP_RESULT.NEGATIVE);
    }
    async completeCancelled() {
        return await this.complete(POPUP_RESULT.CANCELLED);
    }

    /**
     * Hides the popup, using the internal resolver to return the value to the original show promise
     */
    #hide() {
        // We close the dialog, first running the animation
        this.dlg.setAttribute('closing', '');

        // Once the hiding starts, we need to fix the toastr to the layer below
        fixToastrForDialogs();

        // After the dialog is actually completely closed, remove it from the DOM
        runAfterAnimation(this.dlg, async () => {
            // Call the close on the dialog
            this.dlg.close();

            // Run a possible custom handler right before DOM removal
            if (this.onClose) {
                await this.onClose(this);
            }

            // Remove it from the dom
            this.dlg.remove();

            // Remove it from the popup references
            removeFromArray(Popup.util.popups, this);

            // If there is any popup below this one, see if we can set the focus
            if (Popup.util.popups.length > 0) {
                const activeDialog = document.activeElement?.closest('.popup');
                const id = activeDialog?.getAttribute('data-id');
                const popup = Popup.util.popups.find(x => x.id == id);
                if (popup) {
                    if (popup.lastFocus) popup.lastFocus.focus();
                    else popup.setAutoFocus();
                }
            }

            this.#resolver(this.value);
        });
    }

    /**
     * Show a popup with any of the given helper methods. Use `await` to make them blocking.
     */
    static show = showPopupHelper;

    /**
     * Utility for popup and popup management.
     *
     * Contains the list of all currently open popups, and it'll remember the result of the last closed popup.
     */
    static util = {
        /** @readonly @type {Popup[]} Remember all popups */
        popups: [],

        /** @type {{value: any, result: POPUP_RESULT|number?, inputResults: Map<string, boolean>?}?} Last popup result */
        lastResult: null,

        /** @returns {boolean} Checks if any modal popup dialog is open */
        isPopupOpen() {
            return Popup.util.popups.filter(x => x.dlg.hasAttribute('open')).length > 0;
        },

        /**
         * Returns the topmost modal layer in the document. If there is an open dialog popup,
         * it returns the dialog element. Otherwise, it returns the document body.
         *
         * @return {HTMLElement} The topmost modal layer element
         */
        getTopmostModalLayer() {
            return getTopmostModalLayer();
        },
    };
}

class PopupUtils {
    /**
     * Builds popup content with header and text below
     *
     * @param {string?} header - The header to be added to the text
     * @param {string?} text - The main text content
     */
    static BuildTextWithHeader(header, text) {
        if (!header) {
            return text;
        }
        return `<h3>${header}</h3>
            ${text ?? ''}`; // Convert no text to empty string
    }
}

/**
 * Displays a blocking popup with a given content and type
 *
 * @param {JQuery<HTMLElement>|string|Element} content - Content or text to display in the popup
 * @param {POPUP_TYPE} type
 * @param {string} inputValue - Value to set the input to
 * @param {PopupOptions} [popupOptions={}] - Options for the popup
 * @returns {Promise<POPUP_RESULT|string|boolean?>} The value for this popup, which can either be the popup retult or the input value if chosen
 */
export function callGenericPopup(content, type, inputValue = '', popupOptions = {}) {
    const popup = new Popup(
        content,
        type,
        inputValue,
        popupOptions,
    );
    return popup.show();
}

/**
 * Returns the topmost modal layer in the document. If there is an open dialog,
 * it returns the dialog element. Otherwise, it returns the document body.
 *
 * @return {HTMLElement} The topmost modal layer element
 */
export function getTopmostModalLayer() {
    const dlg = Array.from(document.querySelectorAll('dialog[open]:not([closing])')).pop();
    if (dlg instanceof HTMLElement) return dlg;
    return document.body;
}

/**
 * Fixes the issue with toastr not displaying on top of the dialog by moving the toastr container inside the dialog or back to the main body
 */
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
    // we move the toastr back to the main body, or delete if its empty
    if (!dlg && isAlreadyPresent) {
        if (!toastContainer.childNodes.length) {
            toastContainer.remove();
        } else {
            document.body.appendChild(toastContainer);
            toastContainer.classList.add('toast-top-center');
        }
    }
}
