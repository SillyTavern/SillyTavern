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
 *     display.updateReasoning(chunk.state?.reasoning)
 *         .updateContent(chunk.text);
 * }
 *
 * display.complete('Generated Something'); // Mark as done (green LED, auto-hide if configured)
 */

import { SVGInject } from '../lib.js';
import { t } from './i18n.js';
import { animation_duration, messageFormatting } from '/script.js';

/** CSS class prefix */
const CSS_PREFIX = 'streaming-display';

/**
 * @typedef {Object} StreamingDisplayOptions
 * @property {string} [label] - Header label (e.g. "Generating greeting...")
 * @property {HTMLImageElement} [icon] - Optional API/model icon image (e.g. from createModelIcon). Will be SVG-injected when loaded.
 * @property {(() => (void | Promise<void>)) | null} [onStop] - Optional stop handler. When provided, a stop button is shown. Clicking it invokes this handler only — the display is not automatically hidden or completed.
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
    /** @type {HTMLButtonElement | null} */
    #stopButton = null;
    /** @type {HTMLButtonElement | null} */
    #minimizeButton = null;
    /** @type {HTMLButtonElement | null} */
    #closeButton = null;
    /** @type {(() => (void | Promise<void>)) | null} */
    #onStop = null;
    /** @type {HTMLElement | null} */
    #ledIndicator = null;
    /** @type {boolean} */
    #hasContent = false;
    /** @type {boolean} */
    #isMinimized = false;
    /** @type {boolean} */
    #isComplete = false;
    /** @type {boolean} */
    #isStopped = false;
    /** @type {ReturnType<typeof setTimeout> | null} */
    #hideTimeoutId = null;

    /**
     * Shows the streaming display panel.
     * @param {StreamingDisplayOptions} [options]
     * @returns {StreamingDisplay} this instance for chaining
     */
    show({ label = '', icon = null, onStop = null } = {}) {
        if (this.#element) this.hide({ instant: true });

        this.#isMinimized = false;
        this.#isComplete = false;
        this.#onStop = onStop;
        this.#clearHideTimeout();

        this.#element = document.createElement('div');
        this.#element.classList.add(CSS_PREFIX);

        // Header label with LED indicator
        this.#labelElement = document.createElement('div');
        this.#labelElement.classList.add(`${CSS_PREFIX}-label`);

        // LED status indicator (pulsing while streaming, green when complete)
        this.#ledIndicator = document.createElement('span');
        this.#ledIndicator.classList.add(`${CSS_PREFIX}-led`);
        this.#labelElement.appendChild(this.#ledIndicator);

        // Insert model icon into the label (after the LED)
        if (icon instanceof HTMLImageElement) {
            icon.classList.add(`${CSS_PREFIX}-icon`);
            this.#labelElement.appendChild(icon);
            icon.onload = async function () {
                await SVGInject(icon);
            };
        }

        this.#labelText = document.createElement('span');
        this.#labelText.classList.add(`${CSS_PREFIX}-label-text`);
        this.#labelText.textContent = label;
        this.#labelElement.appendChild(this.#labelText);

        // Window control buttons container
        const controls = document.createElement('div');
        controls.classList.add(`${CSS_PREFIX}-controls`);

        // Stop button (only shown when an onStop handler is provided)
        if (onStop) {
            this.#stopButton = document.createElement('button');
            this.#stopButton.classList.add(`${CSS_PREFIX}-btn`, `${CSS_PREFIX}-btn-stop`);
            this.#stopButton.setAttribute('aria-label', t`Stop`);
            this.#stopButton.setAttribute('title', t`Stop generation`);
            this.#stopButton.innerHTML = '&#9632;'; // Black square ■
            this.#stopButton.addEventListener('click', async () => {
                // Disable immediately to prevent double-clicks and give instant feedback
                if (this.#stopButton) {
                    this.#stopButton.disabled = true;
                }
                try {
                    await this.#onStop?.();
                } catch (e) {
                    console.error('[StreamingDisplay] Error executing stop handler', e);
                }
            });
            controls.appendChild(this.#stopButton);
        }

        // Minimize button
        this.#minimizeButton = document.createElement('button');
        this.#minimizeButton.classList.add(`${CSS_PREFIX}-btn`, `${CSS_PREFIX}-btn-minimize`);
        this.#minimizeButton.setAttribute('aria-label', t`Minimize`);
        this.#minimizeButton.setAttribute('title', t`Minimize`);
        this.#minimizeButton.innerHTML = '&#8211;'; // En dash
        this.#minimizeButton.addEventListener('click', () => this.toggleMinimize());
        controls.appendChild(this.#minimizeButton);

        // Close button
        this.#closeButton = document.createElement('button');
        this.#closeButton.classList.add(`${CSS_PREFIX}-btn`, `${CSS_PREFIX}-btn-close`);
        this.#closeButton.setAttribute('aria-label', t`Close`);
        this.#closeButton.setAttribute('title', t`Close (generation continues in background)`);
        this.#closeButton.innerHTML = '&#215;'; // Multiplication sign (×)
        this.#closeButton.addEventListener('click', () => this.hide());
        controls.appendChild(this.#closeButton);

        this.#labelElement.appendChild(controls);
        this.#element.appendChild(this.#labelElement);

        // Content container (for minimize functionality)
        const contentContainer = document.createElement('div');
        contentContainer.classList.add(`${CSS_PREFIX}-content`);

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

        contentContainer.appendChild(this.#reasoningSection);

        // Content section (hidden until content arrives)
        this.#textSection = document.createElement('div');
        this.#textSection.classList.add(`${CSS_PREFIX}-text`);
        this.#textSection.style.display = 'none';

        this.#textContent = document.createElement('div');
        this.#textContent.classList.add(`${CSS_PREFIX}-text-content`, 'mes_text'); // Allow formatting based on how chat messages are formatted too
        this.#textSection.appendChild(this.#textContent);

        contentContainer.appendChild(this.#textSection);
        this.#element.appendChild(contentContainer);

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
     * Toggles the minimized state of the display.
     * When minimized, only the header with label and buttons is shown.
     * @returns {StreamingDisplay} this instance for chaining
     */
    toggleMinimize() {
        if (!this.#element) return this;

        this.#isMinimized = !this.#isMinimized;
        this.#element.classList.toggle(`${CSS_PREFIX}-minimized`, this.#isMinimized);

        // Update minimize button icon/appearance
        if (this.#minimizeButton) {
            this.#minimizeButton.innerHTML = this.#isMinimized ? '&#9633;' : '&#8211;'; // Square when minimized, dash when not
            this.#minimizeButton.setAttribute('title', this.#isMinimized ? t`Restore` : t`Minimize`);
            this.#minimizeButton.setAttribute('aria-label', this.#isMinimized ? t`Restore` : t`Minimize`);
        }

        return this;
    }

    /**
     * @returns {boolean} Whether the display is currently minimized
     */
    get isMinimized() {
        return this.#isMinimized;
    }

    /**
     * @returns {boolean} Whether the display is marked as complete (generation finished)
     */
    get isComplete() {
        return this.#isComplete;
    }

    /**
     * @returns {boolean} Whether the display was stopped by the user
     */
    get isStopped() {
        return this.#isStopped;
    }

    /**
     * Updates the header label text.
     * @param {string} label
     * @returns {StreamingDisplay} this instance for chaining
     */
    setLabel(label) {
        if (this.#labelText) {
            this.#labelText.textContent = label;
        }
        return this;
    }

    /**
     * Updates the reasoning (thinking) section with new text.
     * Automatically shows the reasoning section when text is provided.
     * @param {string} text - Accumulated reasoning text
     * @returns {StreamingDisplay} this instance for chaining
     */
    updateReasoning(text) {
        if (!this.#reasoningContent || !this.#reasoningSection || !text) return this;

        this.#reasoningSection.style.display = '';
        this.#reasoningContent.innerHTML = messageFormatting(text, '', false, false, -1, {}, true);
        this.#reasoningContent.scrollTop = this.#reasoningContent.scrollHeight;
        return this;
    }

    /**
     * Updates the main content section with new text.
     * Automatically shows the content section when text is provided (including empty string).
     * @param {string|null|undefined} text - Accumulated content text
     * @returns {StreamingDisplay} this instance for chaining
     */
    updateContent(text) {
        if (!this.#textContent || !this.#textSection || !text) return this;

        this.#hasContent = true;
        this.#textSection.style.display = '';
        this.#textContent.innerHTML = messageFormatting(text, '', false, false, -1, {}, false);
        this.#textContent.scrollTop = this.#textContent.scrollHeight;
        return this;
    }

    /** @returns {boolean} Whether any content text has been displayed via streaming */
    get hasContent() {
        return this.#hasContent;
    }

    /**
     * Marks the generation as stopped by the user.
     *
     * Changes the LED indicator to solid red, removes the stop button, and keeps the display
     * visible until the user manually closes it with the close button (no auto-hide).
     *
     * @param {Object} [options={}]
     * @param {string|null} [options.label=null] - Optional label override (e.g. `'Generating... [Stopped]'`).
     * @returns {StreamingDisplay} this instance for chaining
     */
    markStopped({ label = null } = {}) {
        if (!this.#element || this.#isStopped || this.#isComplete) return this;

        this.#isStopped = true;
        this.#clearHideTimeout();
        this.#element.classList.add(`${CSS_PREFIX}-stopped`);

        // Remove the stop button — nothing left to stop
        if (this.#stopButton) {
            this.#stopButton.remove();
            this.#stopButton = null;
        }

        if (label !== null) {
            this.setLabel(label);
        }

        return this;
    }

    /**
     * Marks the generation as complete and initiates cleanup. Optionally set a new label.
     *
     * This is the **preferred method** to call after streaming ends. It:
     * - Changes the LED indicator from pulsing orange to solid green
     * - Waits for the specified delay to let the user see the final result
     * - Then hides the display with a fade-out animation
     *
     * @param {Object} [options={}]
     * @param {string|null} [options.label=null] - Set the label automatically to a new one to display the completed state.
     * @param {number|null} [options.delay=3000] - Delay in ms before hiding. Use `null` or negative value to keep displayed until user manually closes it.
     * @returns {StreamingDisplay} this instance for chaining
     */
    complete({ label = null, delay = 3000 } = {}) {
        if (!this.#element || this.#isComplete) return this;

        this.#isComplete = true;
        this.#element.classList.add(`${CSS_PREFIX}-complete`);

        // Clear any existing hide timeout
        this.#clearHideTimeout();

        if (this.#stopButton) {
            this.#stopButton.remove();
            this.#stopButton = null;
        }
        if (label !== null) {
            this.setLabel(label);
        }

        // Auto-hide after delay if specified (positive number)
        if (typeof delay === 'number' && delay >= 0) {
            this.#hideTimeoutId = setTimeout(() => {
                this.#performHide();
            }, delay);
        }

        return this;
    }

    /**
     * Immediately hides and removes the streaming display.
     *
     * **Note:** This is for immediate cleanup (e.g., when canceling generation
     * or closing the app). Prefer `complete()` when generation finishes normally,
     * as it shows the green LED and gives the user time to see the final result.
     *
     * @param {Object} [options={}]
     * @param {boolean} [options.instant=false] - Skip the fade-out animation
     * @returns {StreamingDisplay} this instance for chaining
     */
    hide({ instant = false } = {}) {
        this.#clearHideTimeout();
        this.#performHide({ instant });
        return this;
    }

    /**
     * Clears any pending auto-hide timeout.
     */
    #clearHideTimeout() {
        if (this.#hideTimeoutId !== null) {
            clearTimeout(this.#hideTimeoutId);
            this.#hideTimeoutId = null;
        }
    }

    /**
     * Internal method to actually remove the DOM element.
     * @param {Object} [options={}]
     * @param {boolean} [options.instant=false]
     */
    #performHide({ instant = false } = {}) {
        if (!this.#element) return;

        const el = this.#element;

        // Clear all private fields
        this.#element = null;
        this.#labelElement = null;
        this.#labelText = null;
        this.#reasoningSection = null;
        this.#reasoningContent = null;
        this.#textSection = null;
        this.#textContent = null;
        this.#stopButton = null;
        this.#minimizeButton = null;
        this.#closeButton = null;
        this.#ledIndicator = null;
        this.#onStop = null;
        this.#hasContent = false;
        this.#isMinimized = false;
        this.#isComplete = false;
        this.#isStopped = false;
        this.#hideTimeoutId = null;

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
    }
}
