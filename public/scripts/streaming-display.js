/**
 * A floating toast-like display panel for showing streaming LLM generation progress.
 * Shows reasoning (thinking) and content as they stream in.
 * Designed to work with ConnectionManagerRequestService streaming responses.
 *
 * Appends itself inside the topmost open `<dialog>` element (same approach as
 * fixToastrForDialogs in popup.js) so it renders above modal overlays.
 *
 * @example
 * const display = new StreamingDisplay();
 * display.show({ label: 'Generating...' });
 *
 * for await (const chunk of streamGenerator) {
 *     display.updateReasoning(chunk.state?.reasoning);
 *     display.updateContent(chunk.text);
 * }
 *
 * display.hide();
 */

import { SVGInject } from '../lib.js';
import { t } from './i18n.js';
import { animation_duration } from '/script.js';

/** CSS class prefix */
const CSS_PREFIX = 'streaming-display';

/**
 * @typedef {Object} StreamingDisplayOptions
 * @property {string} [label] - Header label (e.g. "Generating greeting...")
 * @property {HTMLImageElement} [icon] - Optional API/model icon image (e.g. from createModelIcon). Will be SVG-injected when loaded.
 */

export class StreamingDisplay {
    /** @type {HTMLElement | null} */
    #element = null;
    /** @type {HTMLElement | null} */
    #labelElement = null;
    /** @type {HTMLElement | null} */
    #labelText = null;
    /** @type {HTMLElement | null} */
    #reasoningSection = null;
    /** @type {HTMLElement | null} */
    #reasoningContent = null;
    /** @type {HTMLElement | null} */
    #textSection = null;
    /** @type {HTMLElement | null} */
    #textContent = null;
    /** @type {boolean} */
    #hasContent = false;

    /**
     * Shows the streaming display panel.
     * @param {StreamingDisplayOptions} [options]
     * @returns {StreamingDisplay} this instance for chaining
     */
    show({ label = '', icon = null } = {}) {
        if (this.#element) this.hide({ instant: true });

        this.#element = document.createElement('div');
        this.#element.classList.add(CSS_PREFIX);

        // Header label
        this.#labelElement = document.createElement('div');
        this.#labelElement.classList.add(`${CSS_PREFIX}-label`);

        // Insert model icon into the label (after the pulsating dot pseudo-element)
        if (icon instanceof HTMLImageElement) {
            icon.classList.add(`${CSS_PREFIX}-icon`);
            this.#labelElement.appendChild(icon);
            icon.onload = async function () {
                await SVGInject(icon);
            };
        }

        this.#labelText = document.createElement('span');
        this.#labelText.textContent = label;
        this.#labelElement.appendChild(this.#labelText);

        this.#element.appendChild(this.#labelElement);

        // Reasoning section (hidden until content arrives)
        this.#reasoningSection = document.createElement('div');
        this.#reasoningSection.classList.add(`${CSS_PREFIX}-reasoning`);
        this.#reasoningSection.style.display = 'none';

        const reasoningLabel = document.createElement('div');
        reasoningLabel.classList.add(`${CSS_PREFIX}-reasoning-label`);
        reasoningLabel.textContent = t`Thinking...`;
        this.#reasoningSection.appendChild(reasoningLabel);

        this.#reasoningContent = document.createElement('div');
        this.#reasoningContent.classList.add(`${CSS_PREFIX}-reasoning-content`);
        this.#reasoningSection.appendChild(this.#reasoningContent);

        this.#element.appendChild(this.#reasoningSection);

        // Content section (hidden until content arrives)
        this.#textSection = document.createElement('div');
        this.#textSection.classList.add(`${CSS_PREFIX}-text`);
        this.#textSection.style.display = 'none';

        this.#textContent = document.createElement('div');
        this.#textContent.classList.add(`${CSS_PREFIX}-text-content`);
        this.#textSection.appendChild(this.#textContent);

        this.#element.appendChild(this.#textSection);

        // Append inside the topmost open dialog (same pattern as fixToastrForDialogs in popup.js).
        // Modal <dialog> elements live in the browser's top layer, so z-index alone won't work.
        const target = Array.from(document.querySelectorAll('dialog[open]:not([closing])')).pop() ?? document.body;
        target.appendChild(this.#element);

        // Trigger entrance animation on next frame
        requestAnimationFrame(() => {
            this.#element?.classList.add(`${CSS_PREFIX}-visible`);
        });

        return this;
    }

    /**
     * Updates the header label text.
     * @param {string} label
     */
    setLabel(label) {
        if (this.#labelText) {
            this.#labelText.textContent = label;
        }
    }

    /**
     * Updates the reasoning (thinking) section with new text.
     * Automatically shows the reasoning section when text is provided.
     * @param {string} text - Accumulated reasoning text
     */
    updateReasoning(text) {
        if (!this.#reasoningContent || !this.#reasoningSection || !text) return;

        this.#reasoningSection.style.display = '';
        this.#reasoningContent.textContent = text;
        this.#reasoningContent.scrollTop = this.#reasoningContent.scrollHeight;
    }

    /**
     * Updates the main content section with new text.
     * Automatically shows the content section when text is provided (including empty string).
     * @param {string|null|undefined} text - Accumulated content text
     */
    updateContent(text) {
        if (!this.#textContent || !this.#textSection || !text) return;

        this.#hasContent = true;
        this.#textSection.style.display = '';
        this.#textContent.textContent = text;
        this.#textContent.scrollTop = this.#textContent.scrollHeight;
    }

    /** @returns {boolean} Whether any content text has been displayed via streaming */
    get hasContent() {
        return this.#hasContent;
    }

    /**
     * Hides and removes the streaming display.
     * @param {Object} [options]
     * @param {boolean} [options.instant=false] - Skip the fade-out animation
     * @param {number} [options.delay=1000] - Delay in ms before starting the hide animation (to let user see final result)
     */
    hide({ instant = false, delay = 1000 } = {}) {
        if (!this.#element) return;

        const el = this.#element;
        this.#element = null;
        this.#labelElement = null;
        this.#labelText = null;
        this.#reasoningSection = null;
        this.#reasoningContent = null;
        this.#textSection = null;
        this.#textContent = null;
        this.#hasContent = false;

        const doHide = () => {
            if (instant) {
                el.remove();
                return;
            }

            el.classList.remove(`${CSS_PREFIX}-visible`);
            const duration = animation_duration;
            if (duration > 0) {
                setTimeout(() => el.remove(), duration);
            } else {
                el.remove();
            }
        };

        if (delay > 0) {
            setTimeout(doHide, delay);
        } else {
            doHide();
        }
    }
}
