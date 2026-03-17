/**
 * Action loader utility - shows loader overlay with stoppable toast notification.
 * Designed to be flexible and reusable for various long-running operations.
 *
 * With default arguments, will function as a generation loader / wrapper.
 *
 * @module action-loader
 */

import { t } from './i18n.js';
import { stopGeneration } from '../script.js';
import { showLoader, hideLoader, isLoaderDisplayed } from './loader.js';

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
 * @property {string} [message='Generating...'] - The message to display in the toast
 * @property {string} [stopTooltip='Stop generation'] - Tooltip text for the stop button
 * @property {(() => void)|null} [onStop=null] - Custom stop handler. If null, calls `stopGeneration()`
 * @property {ActionLoaderToastMode} [toastMode='stoppable'] - Toast display mode
 */

/**
 * @typedef {object} ActionLoaderHandle
 * @property {() => Promise<void>} hide - Hides the loader and toast
 * @property {() => void} stop - Triggers the stop action
 */

/** @type {JQuery<HTMLElement>|null} */
let activeToast = null;

/** @type {(() => void)|null} */
let activeStopHandler = null;

/**
 * Shows an action loader with an optional stoppable toast notification.
 * The toast includes a stop button that can trigger a custom or default stop handler.
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
 * // With custom stop handler
 * const loader = showActionLoader({
 *     message: 'Downloading...',
 *     stopTooltip: 'Cancel download',
 *     onStop: () => {
 *         myCustomCancelFunction();
 *     }
 * });
 */
export function showActionLoader({
    message = t`Generating...`,
    toastMode = ActionLoaderToastMode.STOPPABLE,
    stopTooltip = t`Stop`,
    onStop = null,
} = {}) {
    // Show the blocking loader overlay
    showLoader();

    // Clear any existing toast from previous calls
    clearToast(activeToast);

    // Set up the stop handler
    activeStopHandler = onStop ?? (() => {
        stopGeneration();
    });

    if (toastMode !== ActionLoaderToastMode.NONE) {
        // Create toast content
        const toastContent = document.createElement('div');
        toastContent.className = 'action-loader-toast';

        const messageSpan = document.createElement('span');
        messageSpan.className = 'action-loader-message';
        messageSpan.textContent = message;

        toastContent.appendChild(messageSpan);

        // Only add stop button if mode is STOPPABLE
        if (toastMode === ActionLoaderToastMode.STOPPABLE) {
            const stopButton = document.createElement('i');
            stopButton.className = 'fa-solid fa-stop-circle action-loader-stop interactable';
            stopButton.title = stopTooltip;
            stopButton.addEventListener('click', (e) => {
                e.preventDefault();
                e.stopPropagation();
                handleStop();
            });
            toastContent.appendChild(stopButton);
        }

        // Show toast with no timeout (sticky) and no close button click dismiss
        activeToast = toastr.info($(toastContent), '', {
            timeOut: 0,
            extendedTimeOut: 0,
            tapToDismiss: false,
            escapeHtml: false,
        });
    }

    /**
     * Handles stop action
     */
    function handleStop() {
        if (activeStopHandler) {
            activeStopHandler();
        }
        // Hide loader and toast after stop
        hideLoaderAndToast();
    }

    /**
     * Hides the loader and clears the toast
     */
    async function hideLoaderAndToast() {
        clearToast(activeToast);
        activeStopHandler = null;
        await hideLoader();
    }

    return {
        hide: hideLoaderAndToast,
        stop: handleStop,
    };
}

/**
 * Hides any active action loader.
 * Useful for cleanup in error handlers or when the action completes.
 * @returns {Promise<boolean>} - Whether a loader was displayed and hidden
 */
export async function hideActionLoader() {
    const wasThere = isLoaderDisplayed();
    clearToast(activeToast);
    activeStopHandler = null;
    await hideLoader();
    return wasThere;
}

/**
 * Removes and clears a specific toast element.
 * @param {JQuery<HTMLElement>} [toast] - The toast element to remove, or null to remove the active toast
 */
function clearToast(toast) {
    const theToast = toast ?? activeToast;
    if (theToast) {
        toastr.clear(theToast);
        setTimeout(() => theToast.remove(), 250);
        if (theToast === activeToast) {
            activeToast = null;
        }
    }
}
