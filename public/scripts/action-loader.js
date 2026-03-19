/**
 * Action loader utility - shows loader overlay with stoppable toast notification.
 * Designed to be flexible and reusable for various long-running operations.
 * Supports stacking multiple loaders - overlay stays single, but toasts can stack.
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
import { commonEnumProviders, enumIcons } from './slash-commands/SlashCommandCommonEnumsProvider.js';
import { SlashCommandEnumValue, enumTypes } from './slash-commands/SlashCommandEnumValue.js';
import { SlashCommandParser } from './slash-commands/SlashCommandParser.js';
import { isFalseBoolean } from './utils.js';

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
     * @param {(() => void)|null} [options.onStop] - Custom stop handler
     * @param {(() => void)|null} [options.onHide] - Custom hide handler
     */
    constructor({
        blocking = true,
        toastMode = ActionLoaderToastMode.STOPPABLE,
        message = t`Generating...`,
        title = '',
        stopTooltip = t`Stop`,
        onStop = null,
        onHide = null,
    } = {}) {
        this.id = generateLoaderId();
        this.#blocking = blocking;
        this.#onStop = onStop;
        this.#onHide = onHide;

        // Warn if non-blocking loader has no toast - it won't be visible to the user
        if (!blocking && toastMode === ActionLoaderToastMode.NONE) {
            console.warn('[ActionLoader] Non-blocking loader created without a toast. This loader will not be visible to the user.');
        }

        // Show the blocking loader overlay if this is the first blocking handle
        if (blocking && !hasBlockingLoaders() && !isLoaderDisplayed()) {
            showLoader();
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
            await hideLoader();
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

/**
 * Registers slash commands for the action loader module.
 */
export function registerActionLoaderSlashCommands() {
    /**
     * Helper to create a closure-based handler from a SlashCommandClosure argument.
     * Allows all possible slash command arg types to be passed in, but only closure is accepted.
     * @param {string | SlashCommandClosure | (string | SlashCommandClosure)[]} closure - The closure argument
     * @param {Object} options - Configuration options
     * @param {string} [options.argName='onStop'] - Name of the argument for error messages
     * @param {boolean} [options.throwInvalid=true] - Whether to throw an error for invalid input
     * @returns {(() => Promise<void>)|null} The handler function, or null if no closure
     */
    function createClosureHandler(closure, { argName = 'onStop', throwInvalid = true } = {}) {
        if (!(closure instanceof SlashCommandClosure)) {
            if (closure && throwInvalid) {
                // Throw error on purpose. This is defined as a syntax error.
                throw new Error(t`Invalid argument for ${argName} provided. This is not a closure.`);
            }
            return null;
        }
        return async () => {
            try {
                const localClosure = closure.getCopy();
                localClosure.onProgress = () => { };
                await localClosure.execute();
            } catch (e) {
                console.error('Error executing closure handler', e);
            }
        };
    }

    // Shared loader enum providers
    const loaderEnumProviders = {
        toastModeEnumProvider: () => [
            new SlashCommandEnumValue(ActionLoaderToastMode.NONE, 'No toast displayed', enumTypes.enum, enumIcons.disabled),
            new SlashCommandEnumValue(ActionLoaderToastMode.STATIC, 'Static toast without stop button', enumTypes.enum, enumIcons.spinner),
            new SlashCommandEnumValue(ActionLoaderToastMode.STOPPABLE, 'Toast with stop button (default)', enumTypes.enum, enumIcons.stop),
        ],
        loaderHandleProvider: () => getActiveLoaderHandles().map(
            handle => new SlashCommandEnumValue(handle.id, `Active loader: ${handle.id}`, enumTypes.enum, enumIcons.spinner),
        ).concat(
            new SlashCommandEnumValue('Temporary loader handle', 'Any loader handle saved in variables or similar', 'enum', '📄', () => true, () => ''),
        ),
    };

    // /loader-wrap command - wraps a closure with loader display
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'loader-wrap',
        returns: 'result of the closure execution',
        helpString: `
            <div>
                Wraps a closure execution with an action loader overlay and optional toast notification.
                By default, the loader blocks UI interaction until the closure completes.
                Multiple loaders can be stacked - each gets its own toast, but the overlay stays single.
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
                Set <code>blocking=false</code> to show only a toast without blocking the UI.
                Useful for background operations like image captioning or generation.
            </div>
            <div>
                The default stop behavior is calling <code>stopGeneration()</code>.
                If the wrapped action is doing something different than generating, a custom stop closure can be provided.
            </div>
            <div>
                <strong>Examples:</strong>
                <ul>
                    <li><pre><code class="language-stscript">/loader-wrap message="Generating summary..." {: /gen Summary of the last message | /echo Done :}</code></pre></li>
                    <li><pre><code class="language-stscript">/loader-wrap blocking=false message="Captioning..." {: /caption :}</code></pre></li>
                    <li><pre><code class="language-stscript">/loader-wrap toast=stoppable onStop={: /echo "Stopped by user" :} {: /delay 10000 :}</code></pre></li>
                </ul>
            </div>
        `,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'blocking',
                description: 'Whether to show blocking overlay. Set to false for non-blocking toast-only loaders.',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'true',
                enumList: commonEnumProviders.boolean()(),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'toast',
                description: 'Toast display mode: stoppable (with stop button), static (no stop button), or none',
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: ActionLoaderToastMode.STOPPABLE,
                enumList: loaderEnumProviders.toastModeEnumProvider(),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'message',
                description: 'Message to display in the toast notification',
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: 'Generating...',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'title',
                description: 'Optional title for the toast notification',
                typeList: [ARGUMENT_TYPE.STRING],
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
                throw new Error(t`Invalid argument for unnamed argument provided. This is not a closure.`);
            }

            const blocking = !isFalseBoolean(String(args.blocking));
            const toastMode = Object.values(ActionLoaderToastMode).includes(String(args.toast))
                ? String(args.toast)
                : ActionLoaderToastMode.STOPPABLE;
            const message = String(args.message ?? t`Generating...`);
            const title = args.title ? String(args.title) : '';
            const stopTooltip = String(args.stopTooltip ?? t`Stop`);

            const loader = showActionLoader({
                blocking,
                toastMode,
                message,
                title,
                stopTooltip,
                onStop: createClosureHandler(args.onStop),
            });

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
                Multiple loaders can be stacked - each gets its own toast, but the overlay stays single.
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
                Set <code>blocking=false</code> to show only a toast without blocking the UI.
                Useful for background operations like image captioning or generation.
            </div>
            <div>
                The default stop behavior is calling <code>stopGeneration()</code>.
                If the wrapped action is doing something different than generating, a custom stop closure can be provided.
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
                name: 'blocking',
                description: 'Whether to show blocking overlay. Set to false for non-blocking toast-only loaders.',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'true',
                enumList: commonEnumProviders.boolean()(),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'toast',
                description: 'Toast display mode: stoppable (with stop button), static (no stop button), or none',
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: ActionLoaderToastMode.STOPPABLE,
                enumList: loaderEnumProviders.toastModeEnumProvider(),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'message',
                description: 'Message to display in the toast notification',
                typeList: [ARGUMENT_TYPE.STRING],
                defaultValue: 'Generating...',
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'title',
                description: 'Optional title for the toast notification',
                typeList: [ARGUMENT_TYPE.STRING],
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
            SlashCommandNamedArgument.fromProps({
                name: 'onHide',
                description: 'Closure to execute when the loader is hidden (not stopped)',
                typeList: [ARGUMENT_TYPE.CLOSURE],
            }),
        ],
        unnamedArgumentList: [],
        callback: async (args) => {
            const blocking = !isFalseBoolean(String(args.blocking));
            const toastMode = Object.values(ActionLoaderToastMode).includes(String(args.toast))
                ? String(args.toast)
                : ActionLoaderToastMode.STOPPABLE;
            const message = String(args.message ?? t`Generating...`);
            const title = args.title ? String(args.title) : '';
            const stopTooltip = String(args.stopTooltip ?? t`Stop`);

            const handle = showActionLoader({
                blocking,
                toastMode,
                message,
                title,
                stopTooltip,
                onStop: createClosureHandler(args.onStop),
                onHide: createClosureHandler(args.onHide, { argName: 'onHide' }),
            });

            return handle.id;
        },
    }));

    // /loader-hide command - manually hide a loader by handle ID
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'loader-hide',
        returns: '<code>true</code> if an active loader was hidden, otherwise <code>false</code>',
        helpString: `
            <div>
                Hides an action loader that was shown with <code>/loader-show</code>.
                If no handle is provided, hides <strong>all</strong> active loaders.
            </div>
            <div>
                <strong>Example:</strong>
                <pre><code class="language-stscript">/loader-hide handle={{getvar::myLoader}}</code></pre>
            </div>
        `,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'handle',
                description: 'Loader handle ID returned by /loader-show. If not provided, hides all active loaders.',
                typeList: [ARGUMENT_TYPE.STRING],
                enumProvider: loaderEnumProviders.loaderHandleProvider,
            }),
        ],
        callback: async (args) => {
            const handleId = args.handle ? String(args.handle) : null;

            if (handleId) {
                const handle = getLoaderHandleById(handleId);
                if (handle && handle.isActive) {
                    await handle.hide();
                    return 'true';
                }
                return 'false';
            }

            // No handle provided - hide all active loaders
            const result = await hideActionLoader();
            return result ? 'true' : 'false';
        },
    }));

    // /loader-stop command - trigger the stop action on a loader
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'loader-stop',
        returns: '<code>true</code> if an active loader was stopped, otherwise <code>false</code>',
        helpString: `
            <div>
                Triggers the stop action on a specific action loader, as if the user clicked the stop button.
                Unlike <code>/loader-hide</code>, this command requires a handle - you must specify which loader to stop.
            </div>
            <div>
                <strong>Example:</strong>
                <pre><code class="language-stscript">/loader-stop handle={{getvar::myLoader}}</code></pre>
            </div>
        `,
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'handle',
                description: 'Loader handle ID returned by /loader-show.',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: loaderEnumProviders.loaderHandleProvider,
            }),
        ],
        callback: async (args) => {
            const handleId = args.handle ? String(args.handle) : null;

            if (!handleId) {
                toastr.warning(t`No handle provided. You must specify which loader to stop.`);
                return 'false';
            }

            const handle = getLoaderHandleById(handleId);
            if (handle && handle.isActive) {
                await handle.stop();
                return 'true';
            }

            return 'false';
        },
    }));
}
