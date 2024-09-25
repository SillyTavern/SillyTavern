import { disableExtension, enableExtension, extension_settings, extensionNames } from './extensions.js';
import { SlashCommand } from './slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from './slash-commands/SlashCommandArgument.js';
import { SlashCommandClosure } from './slash-commands/SlashCommandClosure.js';
import { commonEnumProviders } from './slash-commands/SlashCommandCommonEnumsProvider.js';
import { SlashCommandEnumValue } from './slash-commands/SlashCommandEnumValue.js';
import { SlashCommandParser } from './slash-commands/SlashCommandParser.js';
import { equalsIgnoreCaseAndAccents, isFalseBoolean, isTrueBoolean } from './utils.js';

/**
 * @param {'enable' | 'disable' | 'toggle'} action - The action to perform on the extension
 * @returns {(args: {[key: string]: string | SlashCommandClosure}, extensionName: string | SlashCommandClosure) => Promise<string>}
 */
function getExtensionActionCallback(action) {
    return async (args, extensionName) => {
        if (args?.reload instanceof SlashCommandClosure) throw new Error('\'reload\' argument cannot be a closure.');
        if (typeof extensionName !== 'string') throw new Error('Extension name must be a string. Closures or arrays are not allowed.');
        if (!extensionName) {
            toastr.warning(`Extension name must be provided as an argument to ${action} this extension.`);
            return '';
        }

        const reload = isTrueBoolean(args?.reload);
        const internalExtensionName = extensionNames.find(x => equalsIgnoreCaseAndAccents(x, extensionName));
        if (!internalExtensionName) {
            toastr.warning(`Extension ${extensionName} does not exist.`);
            return '';
        }

        const isEnabled = !extension_settings.disabledExtensions.includes(internalExtensionName);

        if (action === 'enable' && isEnabled) {
            toastr.info(`Extension ${extensionName} is already enabled.`);
            return internalExtensionName;
        }

        if (action === 'disable' && !isEnabled) {
            toastr.info(`Extension ${extensionName} is already disabled.`);
            return internalExtensionName;
        }

        if (action === 'toggle') {
            action = isEnabled ? 'disable' : 'enable';
        }

        reload && toastr.info(`${action.charAt(0).toUpperCase() + action.slice(1)}ing extension ${extensionName} and reloading...`);

        if (action === 'enable') {
            await enableExtension(internalExtensionName, reload);
        } else {
            await disableExtension(internalExtensionName, reload);
        }

        toastr.success(`Extension ${extensionName} ${action}d.`);

        return internalExtensionName;
    };
}

export function registerExtensionSlashCommands() {
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'extension-enable',
        callback: getExtensionActionCallback('enable'),
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'reload',
                description: 'Whether to reload the page after enabling the extension',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'true',
                enumList: commonEnumProviders.boolean('trueFalse')(),
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Extension name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: () => extensionNames.map(name => new SlashCommandEnumValue(name)),
                forceEnum: true,
            }),
        ],
        helpString: `
            <div>
                Enables a specified extension.
            </div>
            <div>
                By default, the page will be reloaded automatically, stopping any further commands.<br />
                If <code>reload=false</code> named argument is passed, the page will not be reloaded, and the extension will stay disabled until refreshed.
                The page either needs to be refreshed, or <code>/reload-page</code> has to be called.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/extension-enable Summarize</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'extension-disable',
        callback: getExtensionActionCallback('enable'),
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'reload',
                description: 'Whether to reload the page after disabling the extension',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'true',
                enumList: commonEnumProviders.boolean('trueFalse')(),
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Extension name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: () => extensionNames.map(name => new SlashCommandEnumValue(name)),
                forceEnum: true,
            }),
        ],
        helpString: `
            <div>
                Disables a specified extension.
            </div>
            <div>
                By default, the page will be reloaded automatically, stopping any further commands.<br />
                If <code>reload=false</code> named argument is passed, the page will not be reloaded, and the extension will stay enabled until refreshed.
                The page either needs to be refreshed, or <code>/reload-page</code> has to be called.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/extension-disable Summarize</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'extension-toggle',
        callback: async (args, extensionName) => {
            if (args?.state instanceof SlashCommandClosure) throw new Error('\'state\' argument cannot be a closure.');
            if (typeof extensionName !== 'string') throw new Error('Extension name must be a string. Closures or arrays are not allowed.');

            const action = isTrueBoolean(args?.state) ? 'enable' :
                isFalseBoolean(args?.state) ? 'disable' :
                    'toggle';

            return await getExtensionActionCallback(action)(args, extensionName);
        },
        namedArgumentList: [
            SlashCommandNamedArgument.fromProps({
                name: 'reload',
                description: 'Whether to reload the page after toggling the extension',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                defaultValue: 'true',
                enumList: commonEnumProviders.boolean('trueFalse')(),
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'state',
                description: 'Explicitly set the state of the extension (true to enable, false to disable). If not provided, the state will be toggled to the opposite of the current state.',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                enumList: commonEnumProviders.boolean('trueFalse')(),
            }),
        ],
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Extension name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: () => extensionNames.map(name => new SlashCommandEnumValue(name)),
                forceEnum: true,
            }),
        ],
        helpString: `
            <div>
                Toggles the state of a specified extension.
            </div>
            <div>
                By default, the page will be reloaded automatically, stopping any further commands.<br />
                If <code>reload=false</code> named argument is passed, the page will not be reloaded, and the extension will stay in its current state until refreshed.
                The page either needs to be refreshed, or <code>/reload-page</code> has to be called.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/extension-toggle Summarize</code></pre>
                    </li>
                    <li>
                        <pre><code class="language-stscript">/extension-toggle Summarize state=true</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'extension-state',
        callback: async (_, extensionName) => {
            if (typeof extensionName !== 'string') throw new Error('Extension name must be a string. Closures or arrays are not allowed.');
            const internalExtensionName = extensionNames.find(x => equalsIgnoreCaseAndAccents(x, extensionName));
            if (!internalExtensionName) {
                toastr.warning(`Extension ${extensionName} does not exist.`);
                return '';
            }

            const isEnabled = !extension_settings.disabledExtensions.includes(internalExtensionName);
            return String(isEnabled);
        },
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Extension name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: () => extensionNames.map(name => new SlashCommandEnumValue(name)),
                forceEnum: true,
            }),
        ],
        helpString: `
            <div>
                Returns the state of a specified extension (true if enabled, false if disabled).
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/extension-state Summarize</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));
    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'extension-exists',
        aliases: ['extension-installed'],
        callback: async (_, extensionName) => {
            if (typeof extensionName !== 'string') throw new Error('Extension name must be a string. Closures or arrays are not allowed.');
            const exists = extensionNames.find(x => equalsIgnoreCaseAndAccents(x, extensionName)) !== undefined;
            return exists ? 'true' : 'false';
        },
        unnamedArgumentList: [
            SlashCommandArgument.fromProps({
                description: 'Extension name',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: () => extensionNames.map(name => new SlashCommandEnumValue(name)),
                forceEnum: true,
            }),
        ],
        helpString: `
            <div>
                Checks if a specified extension exists.
            </div>
            <div>
                <strong>Example:</strong>
                <ul>
                    <li>
                        <pre><code class="language-stscript">/extension-exists LALib</code></pre>
                    </li>
                </ul>
            </div>
        `,
    }));

    SlashCommandParser.addCommandObject(SlashCommand.fromProps({
        name: 'reload-page',
        callback: async () => {
            toastr.info('Reloading the page...');
            location.reload();
            return '';
        },
        helpString: 'Reloads the current page. All further commands will not be processed.',
    }));
}
