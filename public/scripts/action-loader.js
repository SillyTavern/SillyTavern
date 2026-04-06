/**
 * Unified action loader system - shows loader overlay with optional toast notifications.
 * Designed to be flexible and reusable for various long-running operations.
 *
 * Features:
 * - Stacking multiple loaders - overlay stays single, but toasts can stack
 * - Blocking and non-blocking modes
 * - Stoppable or static toasts
 * - Class-based handle system for fine-grained control
 *
 * @module action-loader
 */

import { t } from './i18n.js';
import { stopGeneration } from '../script.js';
import { Popup, POPUP_RESULT, POPUP_TYPE } from './popup.js';

/**
 * Enum representing the toast display mode for the action loader.
 * @readonly
 * @enum {string}
 */
export const ActionLoaderToastMode = {
    /** No toast is displayed */
    NONE: 'none',
    /** Toast is displayed without stop button (non-interactable) */
    STATIC: 'static',
    /** Toast is displayed with stop button (default) */
    STOPPABLE: 'stoppable',
};

/**
 * @typedef {object} ActionLoaderOptions
 * @property {boolean} [blocking=true] - Whether to show the blocking overlay. Set to false for non-blocking toast-only loaders.
 * @property {ActionLoaderToastMode} [toastMode='stoppable'] - Toast display mode
 * @property {string} [message='Generating...'] - The message to display in the toast
 * @property {string} [title] - Optional title for the toast notification
 * @property {string} [stopTooltip='Stop'] - Tooltip text for the stop button
 * @property {HTMLElement|string|null} [overlayContent=null] - Custom content for the overlay (replaces default spinner)
 * @property {(() => void)|null} [onStop=null] - Custom stop handler. If null, calls `stopGeneration()`
 * @property {(() => void)|null} [onHide=null] - Custom hide handler. Called when the loader is hidden (not stopped).
 */

/** Counter for generating unique loader IDs */
let loaderIdCounter = 0;

/** @type {Set<ActionLoaderHandle>} Set of all active loader handles */
const activeHandles = new Set();

/**
 * Generates a unique loader ID.
 * @returns {string} Unique loader ID
 */
function generateLoaderId() {
    return `loader_${++loaderIdCounter}`;
}

/**
 * Checks if there are any active blocking loaders.
 * @returns {boolean} True if at least one blocking loader is active
 */
function hasBlockingLoaders() {
    for (const handle of activeHandles) {
        if (handle.isBlocking && handle.isActive) {
            return true;
        }
    }
    return false;
}

/**
 * Class representing an action loader handle.
 * Manages its own toast, stop handler, and lifecycle.
 */
export class ActionLoaderHandle {
    /** @type {string} Unique identifier for this handle */
    id;

    /** @type {JQuery<HTMLElement>|null} The toast element for this loader */
    #toast = null;

    /** @type {(() => void)|null} Custom stop handler */
    #onStop = null;

    /** @type {(() => void)|null} Custom hide handler */
    #onHide = null;

    /** @type {boolean} Whether this loader blocks the UI with an overlay */
    #blocking = true;

    /** @type {boolean} Whether this handle has been disposed */
    #disposed = false;

    /**
     * Creates a new ActionLoaderHandle.
     * @param {object} options - Configuration options
     * @param {boolean} [options.blocking=true] - Whether to show blocking overlay
     * @param {ActionLoaderToastMode} [options.toastMode] - Toast display mode
     * @param {string} [options.message='Generating...'] - Message to display in the toast
     * @param {string} [options.title] - Title for the toast notification
     * @param {string} [options.stopTooltip='Stop'] - Tooltip for the stop button
     * @param {HTMLElement|string|null} [options.overlayContent] - Custom content for the overlay (replaces default spinner)
     * @param {(() => void)|null} [options.onStop] - Custom stop handler
     * @param {(() => void)|null} [options.onHide] - Custom hide handler
     */
    constructor({
        blocking = true,
        toastMode = ActionLoaderToastMode.STOPPABLE,
        message = t`Generating...`,
        title = '',
        stopTooltip = t`Stop`,
        overlayContent = null,
        onStop = null,
        onHide = null,
    } = {}) {
        this.id = generateLoaderId();
        this.#blocking = blocking;
        this.#onStop = onStop;
        this.#onHide = onHide;

        // Warn if non-blocking loader has no toast - it won't be visible to the user
        if (!blocking && toastMode === ActionLoaderToastMode.NONE && !overlayContent) {
            console.warn('[ActionLoader] Non-blocking loader created without a toast. This loader will not be visible to the user.');
        }

        // Show the blocking loader overlay if this is the first blocking handle
        if (blocking && !hasBlockingLoaders() && !isOverlayDisplayed()) {
            showOverlay(overlayContent);
        }

        // Register this handle
        activeHandles.add(this);

        // Create toast if needed
        if (toastMode !== ActionLoaderToastMode.NONE) {
            this.#createToast(message, title, toastMode, stopTooltip);
        }
    }

    /**
     * Creates the toast element for this loader.
     * @param {string} message - Message to display
     * @param {string} title - Title for the toast
     * @param {ActionLoaderToastMode} toastMode - Toast mode
     * @param {string} stopTooltip - Tooltip for stop button
     */
    #createToast(message, title, toastMode, stopTooltip) {
        const toastContent = document.createElement('div');
        toastContent.className = 'action-loader-toast';

        const messageSpan = document.createElement('span');
        messageSpan.className = 'action-loader-message';
        messageSpan.textContent = message;
        toastContent.appendChild(messageSpan);

        // Add stop button if mode is STOPPABLE
        if (toastMode === ActionLoaderToastMode.STOPPABLE) {
            const stopButton = document.createElement('i');
            stopButton.className = 'fa-solid fa-stop-circle action-loader-stop interactable';
            stopButton.title = stopTooltip;
            stopButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                this.stop();
            });
            toastContent.appendChild(stopButton);
        }

        // Show toast with no timeout (sticky)
        this.#toast = toastr.info($(toastContent), title, {
            timeOut: 0,
            extendedTimeOut: 0,
            tapToDismiss: false,
            escapeHtml: false,
        });
    }

    /**
     * Clears the toast element for this loader.
     */
    #clearToast() {
        if (this.#toast) {
            toastr.clear(this.#toast, { force: true }); // Need to force as the toast might have focus/hover
            this.#toast = null;
        }
    }

    /**
     * Disposes this handle, removing it from active handles and hiding overlay if last.
     */
    async #dispose() {
        if (this.#disposed) return;
        this.#disposed = true;

        this.#clearToast();
        activeHandles.delete(this);

        // Hide the overlay if this was the last blocking handle
        if (this.#blocking && !hasBlockingLoaders()) {
            await hideOverlay();
        }
    }

    /**
     * Whether this handle is still active (not disposed).
     * @returns {boolean}
     */
    get isActive() {
        return !this.#disposed;
    }

    /**
     * Whether this loader blocks the UI with an overlay.
     * @returns {boolean}
     */
    get isBlocking() {
        return this.#blocking;
    }

    /**
     * Triggers the stop action on this loader.
     * Calls the custom onStop handler if provided, otherwise calls stopGeneration().
     * Then hides this loader.
     */
    async stop() {
        if (this.#disposed) return;

        // Call custom stop handler or default
        if (this.#onStop) {
            try {
                await this.#onStop();
            } catch (e) {
                console.error('Error executing onStop handler', e);
            }
        } else {
            stopGeneration();
        }

        // Dispose without calling onHide (stop is different from hide)
        await this.#dispose();
    }

    /**
     * Hides this loader and clears its toast.
     * Calls the custom onHide handler if provided.
     */
    async hide() {
        if (this.#disposed) return;

        // Call custom hide handler if provided
        if (this.#onHide) {
            try {
                await this.#onHide();
            } catch (e) {
                console.error('Error executing onHide handler', e);
            }
        }

        await this.#dispose();
    }
}

/**
 * Action loader utility API.
 * Provides a convenient interface for showing and managing loading indicators.
 *
 * Read the functions documentation for more details.
 *
 * @example
 * // Basic usage
 * const handle = loader.show({ message: 'Loading...' });
 * await someOperation();
 * handle.hide();
 *
 * @example
 * // Non-blocking background task
 * const handle = loader.show({ blocking: false, message: 'Processing...' });
 *
 * @example
 * // Hide all active loaders
 * loader.hide();
 */
export const loader = {
    /**
     * Shows an action loader with optional toast notification.
     * Returns a handle to control the loader.
     * @type {typeof showActionLoader}
     */
    show: showActionLoader,

    /**
     * Hides a specific loader by handle, or all loaders if no handle provided.
     * @type {typeof hideActionLoader}
     */
    hide: hideActionLoader,

    /**
     * Gets all currently active loader handles.
     * @type {typeof getActiveLoaderHandles}
     */
    active: getActiveLoaderHandles,

    /**
     * Gets a loader handle by its ID.
     * @type {typeof getLoaderHandleById}
     */
    get: getLoaderHandleById,

    /**
     * Checks if any blocking loader overlay is currently displayed.
     * @returns {boolean} True if a blocking overlay is shown
     */
    isBlocking: isOverlayDisplayed,

    /**
     * Toast display mode constants.
     * @type {typeof ActionLoaderToastMode}
     */
    ToastMode: ActionLoaderToastMode,

    /**
     * The ActionLoaderHandle class.
     * @type {typeof ActionLoaderHandle}
     */
    Handle: ActionLoaderHandle,

    /**
     * Creates a fresh default loader overlay element.
     * @type {typeof createDefaultLoaderOverlay}
     */
    createOverlay: createDefaultLoaderOverlay,
};

/**
 * Shows an action loader with an optional stoppable toast notification.
 * Multiple loaders can be stacked - the overlay stays single, but each gets its own toast.
 * When the last loader is hidden, the overlay is removed.
 *
 * With default arguments, will function as a generation loader / wrapper.
 *
 * @param {ActionLoaderOptions} [options={}] - Configuration options
 * @returns {ActionLoaderHandle} Handle to control the loader
 *
 * @example
 * // Basic usage
 * const loader = showActionLoader({ message: 'Generating title...' });
 * try {
 *     const result = await generateRaw({ prompt });
 *     // process result
 * } finally {
 *     await loader.hide();
 * }
 *
 * @example
 * // With custom stop and hide handlers
 * const loader = showActionLoader({
 *     message: 'Downloading...',
 *     stopTooltip: 'Cancel download',
 *     onStop: () => myCustomCancelFunction(),
 *     onHide: () => console.log('Loader hidden'),
 * });
 *
 * @example
 * // Stacking multiple loaders
 * const loader1 = showActionLoader({ message: 'Task 1...' });
 * const loader2 = showActionLoader({ message: 'Task 2...' });
 * await loader1.hide(); // Overlay stays, loader2 still active
 * await loader2.hide(); // Now overlay hides
 *
 * @example
 * // Non-blocking loader (toast only, no overlay)
 * const loader = showActionLoader({
 *     message: 'Captioning image...',
 *     blocking: false,
 *     onStop: () => abortCaptioning(),
 * });
 */
export function showActionLoader(options = {}) {
    return new ActionLoaderHandle(options);
}

/**
 * Hides a specific action loader by handle, or all active loaders if no handle provided.
 * @param {ActionLoaderHandle|null} [handle=null] - Specific handle to hide, or undefined to hide all
 * @returns {Promise<boolean>} Whether any loader was hidden
 */
export async function hideActionLoader(handle = null) {
    if (handle instanceof ActionLoaderHandle) {
        if (handle.isActive) {
            await handle.hide();
            return true;
        }
        return false;
    }

    // No handle provided - hide all active loaders
    const handles = getActiveLoaderHandles();
    for (const h of handles) {
        await h.hide();
    }
    return handles.length > 0;
}

/**
 * Gets all currently active loader handles.
 * @returns {ActionLoaderHandle[]} Array of active handles
 */
export function getActiveLoaderHandles() {
    return Array.from(activeHandles);
}

/**
 * Gets a loader handle by its ID.
 * @param {string} id - The handle ID
 * @returns {ActionLoaderHandle|undefined} The handle, or undefined if not found
 */
export function getLoaderHandleById(id) {
    for (const handle of activeHandles) {
        if (handle.id === id) {
            return handle;
        }
    }
    return undefined;
}

// ============================================================================
// Internal overlay management
// ============================================================================

/** @type {Popup|null} The current loader overlay popup */
let loaderPopup = null;

/** Whether the initial HTML preloader has been removed */
let preloaderYoinked = false;

/**
 * Creates the default loader overlay element.
 * Always returns a fresh element instance.
 *
 * @returns {HTMLDivElement} A new loader overlay element
 */
export function createDefaultLoaderOverlay() {
    const loaderElement = document.createElement('div');
    loaderElement.id = 'loader';

    const spinnerElement = document.createElement('div');
    spinnerElement.id = 'load-spinner';
    spinnerElement.className = 'fa-solid fa-gear fa-spin fa-3x';

    loaderElement.appendChild(spinnerElement);

    return loaderElement;
}

/**
 * Normalizes custom overlay content into a value supported by Popup.
 * @param {string|HTMLElement|null} customContent - Custom overlay content
 * @returns {string|HTMLElement} Content for Popup
 */
function getOverlayContent(customContent) {
    if (typeof customContent === 'string') {
        return customContent;
    }

    if (customContent instanceof HTMLElement) {
        return customContent;
    }

    return createDefaultLoaderOverlay();
}

/**
 * Checks if the loader overlay is currently displayed.
 * @returns {boolean} True if overlay is shown
 */
function isOverlayDisplayed() {
    return !!loaderPopup;
}

/**
 * Shows the blocking loader overlay.
 * Internal function - use showActionLoader() instead.
 * @param {HTMLElement|string|null} [customContent] - Custom content for the overlay
 */
function showOverlay(customContent = null) {
    // Two loaders don't make sense. Don't await, we can overlay the old loader while it closes
    if (loaderPopup) loaderPopup.complete(POPUP_RESULT.CANCELLED);

    const content = getOverlayContent(customContent);

    loaderPopup = new Popup(content, POPUP_TYPE.DISPLAY, null, {
        allowEscapeClose: false,
        transparent: true,
        animation: 'none',
        wide: true,
        large: true,
    });

    // No close button, loaders are not closable
    loaderPopup.closeButton.style.display = 'none';

    loaderPopup.show();
}

/**
 * Hides the blocking loader overlay with animation.
 * Internal function - use hideActionLoader() instead.
 * @returns {Promise<void>}
 */
async function hideOverlay() {
    if (!loaderPopup) {
        return Promise.resolve();
    }

    return new Promise((resolve) => {
        const loaderElement = $('#loader');
        const spinner = $('#load-spinner');

        if (!loaderElement.length) {
            console.warn('Loader element not found, skipping animation');
            cleanup();
            return;
        }

        // Check if transitions are enabled on spinner (which has the transition property)
        const transitionDuration = spinner.length && spinner[0] ? getComputedStyle(spinner[0]).transitionDuration : '0s';
        const hasTransitions = parseFloat(transitionDuration) > 0;

        if (hasTransitions) {
            Promise.race([
                new Promise((r) => setTimeout(r, 500)), // Fallback timeout
                new Promise((r) => loaderElement.one('transitionend webkitTransitionEnd oTransitionEnd MSTransitionEnd', r)),
            ]).finally(cleanup);
        } else {
            cleanup();
        }

        function cleanup() {
            loaderElement.remove();
            // Yoink preloader entirely; it only exists to cover up unstyled content while loading JS
            // If it's present, we remove it once and then it's gone.
            yoinkPreloader();

            loaderPopup.complete(POPUP_RESULT.AFFIRMATIVE)
                .catch((err) => console.error('Error completing loaderPopup:', err))
                .finally(() => {
                    loaderPopup = null;
                    resolve();
                });
        }

        // Apply the blur styles to the entire loader element
        loaderElement.css({
            'filter': 'blur(15px)',
            'opacity': '0',
        });
    });
}

/**
 * Removes the initial HTML preloader element.
 * Called once after the first loader hide.
 */
function yoinkPreloader() {
    if (preloaderYoinked) return;
    document.getElementById('preloader')?.remove();
    preloaderYoinked = true;
}

// ============================================================================
// End internal overlay management
// ============================================================================
