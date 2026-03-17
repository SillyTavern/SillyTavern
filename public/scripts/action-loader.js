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
import { SlashCommand } from './slash-commands/SlashCommand.js';
import { SlashCommandNamedArgument, ARGUMENT_TYPE, SlashCommandArgument } from './slash-commands/SlashCommandArgument.js';
import { SlashCommandClosure } from './slash-commands/SlashCommandClosure.js';
import { enumIcons } from './slash-commands/SlashCommandCommonEnumsProvider.js';
import { SlashCommandEnumValue, enumTypes } from './slash-commands/SlashCommandEnumValue.js';
import { SlashCommandParser } from './slash-commands/SlashCommandParser.js';

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

/** @type {Map<string, ActionLoaderHandle>} Map of manual loader handles by ID */
const manualLoaderHandles = new Map();

/** Counter for generating unique loader IDs */
let loaderIdCounter = 0;

/**
 * Generates a unique loader ID for manual loader tracking.
 * @returns {string} Unique loader ID
 */
function generateLoaderId() {
    return `loader_${++loaderIdCounter}`;
}

/**
 * Registers slash commands for the action loader module.
 */
export function registerActionLoaderSlashCommands() {
    // Shared loader enum providers
    const loaderEnumProviders = {
        // Enum provider for toast mode
        toastModeEnumProvider: () => [
            new SlashCommandEnumValue(ActionLoaderToastMode.NONE, 'No toast displayed', enumTypes.enum, enumIcons.disabled),
            new SlashCommandEnumValue(ActionLoaderToastMode.STATIC, 'Static toast without stop button', enumTypes.enum, enumIcons.spinner),
            new SlashCommandEnumValue(ActionLoaderToastMode.STOPPABLE, 'Toast with stop button (default)', enumTypes.enum, enumIcons.stop),
        ],
        loaderHandleProvider: () => Array.from(manualLoaderHandles.keys()).map(
            id => new SlashCommandEnumValue(id, `Active loader: ${id}`, enumTypes.enum, enumIcons.spinner),
        ).concat(
            new SlashCommandEnumValue('Temporary loader handle', 'Any loader handle saved in variables or similar', 'enum', '📄', () => true, () => ''),
        ),
    };

    // Main /loader command - wraps a closure with loader display
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'loader-wrap',
        returns: 'result of the closure execution',
        helpString: `
            <div>
                Wraps a closure execution with an action loader overlay and optional toast notification.
                The loader blocks UI interaction until the closure completes.
            </div>
            <div>
                <strong>Toast modes:</strong>
                <ul>
                    <li><code>stoppable</code> - Shows toast with a stop button (default)</li>
                    <li><code>static</code> - Shows toast without stop button</li>
                    <li><code>none</code> - No toast, only loader overlay</li>
                </ul>
            </div>
            <div>
                The default stop behavior is calling <code>stopGeneration()</code>.
                If the wrapped action is doing sometthing different than generating, a custom stop closure can be provided.
            </div>
            <div>
                <strong>Examples:</strong>
                <ul>
                    <li><pre><code class="language-stscript">/loader message="Generating summary..." {: /gen Summary of the last message | /echo Done :}</code></pre></li>
                    <li><pre><code class="language-stscript">/loader toast=static message="Loading data..." {: /fetch "https://..." :}</code></pre></li>
                    <li><pre><code class="language-stscript">/loader toast=stoppable onStop={: /echo "Stopped by user" :} {: /delay 10000 :}</code></pre></li>
                </ul>
            </div>
        `,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'message',
                description: 'Message to display in the toast notification',
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: 'Generating...',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'toast',
                description: 'Toast display mode: stoppable (with stop button), static (no stop button), or none',
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: ActionLoaderToastMode.STOPPABLE,
                enumList: loaderEnumProviders.toastModeEnumProvider(),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'stopTooltip',
                description: 'Tooltip text for the stop button (only used when toast=stoppable)',
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: 'Stop',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'onStop',
                description: 'Closure to execute when the stop button is clicked. If not provided, uses default stop behavior.',
                typeList: [ARGUMENT_TYPE.CLOSURE],
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Closure to execute while the loader is displayed',
                typeList: [ARGUMENT_TYPE.CLOSURE],
                isRequired: true,
            }),
        ],
        callback: async (args, value) => {
            if (!(value instanceof SlashCommandClosure)) {
                // Throw error on purpose. This is defined as a syntax error.
                throw new Error('The /loader command requires a closure as the unnamed argument.');
            }

            const message = String(args.message ?? t`Generating...`);
            const toastMode = Object.values(ActionLoaderToastMode).includes(String(args.toast))
                ? String(args.toast)
                : ActionLoaderToastMode.STOPPABLE;
            const stopTooltip = String(args.stopTooltip ?? t`Stop`);

            // Set up custom stop handler if provided
            let customStopHandler = null;
            if (args.onStop instanceof SlashCommandClosure) {
                const stopClosure = args.onStop;
                customStopHandler = async () => {
                    try {
                        const localClosure = stopClosure.getCopy();
                        localClosure.onProgress = () => { };
                        await localClosure.execute();
                    } catch (e) {
                        console.error('Error executing onStop closure', e);
                    }
                };
            } else if (args.onStop) {
                toastr.warning(t`Invalid onStop provided for /loader command. This is not a closure.`);
            }

            const loader = showActionLoader({
                message,
                toastMode,
                stopTooltip,
                onStop: customStopHandler,
            });

            // TODO: Add an onHide parameter to action loader, so we can unregister the manual handles (memory leak, and all)

            try {
                const closureCopy = value.getCopy();
                const result = await closureCopy.execute();
                return result.pipe;
            } finally {
                await loader.hide();
            }
        },
    }));

    // /loader-show command - manually show a loader, returns handle ID
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'loader-show',
        returns: 'loader handle ID (use with /loader-hide)',
        helpString: `
            <div>
                Manually shows an action loader. Returns a handle ID that can be used with <code>/loader-hide</code> to hide it.
                Use this for fine-grained control when you need to show/hide the loader at specific points.
            </div>
            <div>
                <strong>Toast modes:</strong>
                <ul>
                    <li><code>stoppable</code> - Shows toast with a stop button (default)</li>
                    <li><code>static</code> - Shows toast without stop button</li>
                    <li><code>none</code> - No toast, only loader overlay</li>
                </ul>
            </div>
            <div>
                The default stop behavior is calling <code>stopGeneration()</code>.
                If the wrapped action is doing sometthing different than generating, a custom stop closure can be provided.
            </div>
            <div>
                <strong>Example:</strong>
                <pre>
                    <code class="language-stscript">
/loader-show message="Loading..." |
/setvar key=myLoader |
/some-operation |
/loader-hide handle={{getvar::myLoader}}
                    </code>
                </pre>
            </div>
        `,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'message',
                description: 'Message to display in the toast notification',
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: 'Generating...',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'toast',
                description: 'Toast display mode: stoppable (with stop button), static (no stop button), or none',
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: ActionLoaderToastMode.STOPPABLE,
                enumList: loaderEnumProviders.toastModeEnumProvider(),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'stopTooltip',
                description: 'Tooltip text for the stop button (only used when toast=stoppable)',
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: 'Stop',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'onStop',
                description: 'Closure to execute when the stop button is clicked',
                typeList: [ARGUMENT_TYPE.CLOSURE],
            }),
        ],
        unnamedArgumentList: [],
        callback: async (args) => {
            const message = String(args.message ?? 'Generating...');
            const toastMode = Object.values(ActionLoaderToastMode).includes(String(args.toast))
                ? String(args.toast)
                : ActionLoaderToastMode.STOPPABLE;
            const stopTooltip = String(args.stopTooltip ?? 'Stop');

            // Set up custom stop handler if provided
            let customStopHandler = null;
            if (args.onStop instanceof SlashCommandClosure) {
                const stopClosure = args.onStop;
                customStopHandler = async () => {
                    try {
                        const localClosure = stopClosure.getCopy();
                        localClosure.onProgress = () => { };
                        await localClosure.execute();
                    } catch (e) {
                        console.error('Error executing onStop closure', e);
                    }
                };
            }

            const loaderId = generateLoaderId();
            const handle = showActionLoader({
                message,
                toastMode,
                stopTooltip,
                onStop: customStopHandler,
            });

            manualLoaderHandles.set(loaderId, handle);
            return loaderId;
        },
    }));

    // /loader-hide command - manually hide a loader by handle ID
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'loader-hide',
        returns: '<code>true</code>, if an active loader was hidden - otherwise <code>false</code>',
        helpString: `
            <div>
                Hides an action loader that was shown with <code>/loader-show</code>.
                If no handle is provided, hides any active loader.
            </div>
            <div>
                <strong>Example:</strong>
                <pre><code class="language-stscript">/loader-hide handle={{getvar::myLoader}}</code></pre>
            </div>
        `,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'handle',
                description: 'Loader handle ID returned by /loader-show. If not provided, hides any active loader.',
                typeList: [ARGUMENT_TYPE.STRING],
                enumProvider: loaderEnumProviders.loaderHandleProvider,
            }),
        ],
        callback: async (args) => {
            const handleId = args.handle ? String(args.handle) : null;

            if (handleId && manualLoaderHandles.has(handleId)) {
                const handle = manualLoaderHandles.get(handleId);
                await handle.hide();
                manualLoaderHandles.delete(handleId);
                return 'true';
            } else {
                // Without handle, hide any active loader
                const result = await hideActionLoader();
                return result ? 'true' : 'false';
            }
        },
    }));

    // /loader-stop command - trigger the stop action on a loader
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'loader-stop',
        returns: '<code>true</code>, if an active loader was stopped - otherwise <code>false</code>',
        helpString: `
            <div>
                Triggers the stop action on an action loader, as if the user clicked the stop button.
                If no handle is provided, stops any active loader.
            </div>
            <div>
                <strong>Example:</strong>
                <pre><code class="language-stscript">/loader-stop handle={{getvar::myLoader}}</code></pre>
            </div>
        `,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'handle',
                description: 'Loader handle ID returned by /loader-show. If not provided, stops any active loader.',
                typeList: [ARGUMENT_TYPE.STRING],
                enumProvider: loaderEnumProviders.loaderHandleProvider,
            }),
        ],
        unnamedArgumentList: [],
        callback: async (args) => {
            const handleId = args.handle ? String(args.handle) : null;

            if (handleId && manualLoaderHandles.has(handleId)) {
                const handle = manualLoaderHandles.get(handleId);
                handle.stop();
                manualLoaderHandles.delete(handleId);
                return 'true';
            } else if (activeStopHandler) {
                // Fallback: trigger active stop handler
                activeStopHandler();
                await hideActionLoader();
                return 'true';
            }

            return 'false';
        },
    }));
}
