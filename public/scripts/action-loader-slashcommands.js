import { ActionLoaderToastMode, getActiveLoaderHandles, getLoaderHandleById, hideActionLoader, showActionLoader } from './action-loader.js';
import { t } from './i18n.js';
import { SlashCommand } from './slash-commands/SlashCommand.js';
import { SlashCommandNamedArgument, ARGUMENT_TYPE, SlashCommandArgument } from './slash-commands/SlashCommandArgument.js';
import { SlashCommandClosure } from './slash-commands/SlashCommandClosure.js';
import { commonEnumProviders, enumIcons } from './slash-commands/SlashCommandCommonEnumsProvider.js';
import { SlashCommandEnumValue, enumTypes } from './slash-commands/SlashCommandEnumValue.js';
import { SlashCommandParser } from './slash-commands/SlashCommandParser.js';
import { isFalseBoolean } from './utils.js';

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
        returns: 'true if an active loader was hidden, otherwise false',
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
        returns: 'true if an active loader was stopped, otherwise false',
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
