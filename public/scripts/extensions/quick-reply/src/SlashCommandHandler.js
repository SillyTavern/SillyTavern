import { SlashCommand } from '../../../slash-commands/SlashCommand.js';
import { SlashCommandAbortController } from '../../../slash-commands/SlashCommandAbortController.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from '../../../slash-commands/SlashCommandArgument.js';
import { SlashCommandClosure } from '../../../slash-commands/SlashCommandClosure.js';
import { enumIcons } from '../../../slash-commands/SlashCommandCommonEnumsProvider.js';
import { SlashCommandDebugController } from '../../../slash-commands/SlashCommandDebugController.js';
import { SlashCommandEnumValue, enumTypes } from '../../../slash-commands/SlashCommandEnumValue.js';
import { SlashCommandParser } from '../../../slash-commands/SlashCommandParser.js';
import { SlashCommandScope } from '../../../slash-commands/SlashCommandScope.js';
import { isTrueBoolean } from '../../../utils.js';
// eslint-disable-next-line no-unused-vars
import { QuickReplyApi } from '../api/QuickReplyApi.js';
import { QuickReply } from './QuickReply.js';
import { QuickReplySet } from './QuickReplySet.js';

export class SlashCommandHandler {
    /**@type {QuickReplyApi}*/ api;




    constructor(/**@type {QuickReplyApi}*/api) {
        this.api = api;
    }




    init() {
        function getExecutionIcons(/**@type {QuickReply} */ qr) {
            let icons = '';
            if (qr.preventAutoExecute) icons += '🚫';
            if (qr.isHidden) icons += '👁️';
            if (qr.executeOnStartup) icons += '🚀';
            if (qr.executeOnUser) icons += enumIcons.user;
            if (qr.executeOnAi) icons += enumIcons.assistant;
            if (qr.executeOnChatChange) icons += '💬';
            if (qr.executeOnGroupMemberDraft) icons += enumIcons.group;
            return icons;
        }

        const localEnumProviders = {
            /** All quick reply sets, optionally filtering out sets that wer already used in the "set" named argument */
            qrSets: (executor) => QuickReplySet.list.filter(qrSet => qrSet.name != String(executor.namedArgumentList.find(x => x.name == 'set')?.value))
                .map(qrSet => new SlashCommandEnumValue(qrSet.name, null, enumTypes.enum, 'S')),

            /** All QRs inside a set, utilizing the "set" named argument */
            qrEntries: (executor) => QuickReplySet.get(String(executor.namedArgumentList.find(x => x.name == 'set')?.value))?.qrList.map(qr => {
                const icons = getExecutionIcons(qr);
                const message = `${qr.automationId ? `[${qr.automationId}]` : ''}${icons ? `[auto: ${icons}]` : ''} ${qr.title || qr.message}`.trim();
                return new SlashCommandEnumValue(qr.label, message, enumTypes.enum, enumIcons.qr);
            }) ?? [],

            /** All QRs inside a set, utilizing the "set" named argument, returns the QR's ID */
            qrIds: (executor) => QuickReplySet.get(String(executor.namedArgumentList.find(x => x.name == 'set')?.value))?.qrList.map(qr => {
                const icons = getExecutionIcons(qr);
                const message = `${qr.automationId ? `[${qr.automationId}]` : ''}${icons ? `[auto: ${icons}]` : ''} ${qr.title || qr.message}`.trim();
                return new SlashCommandEnumValue(qr.label, message, enumTypes.enum, enumIcons.qr, null, ()=>qr.id.toString(), true);
            }) ?? [],

            /** All QRs as a set.name string, to be able to execute, for example via the /run command */
            qrExecutables: () => {
                const globalSetList = this.api.settings.config.setList;
                const chatSetList = this.api.settings.chatConfig?.setList;

                const globalQrs = globalSetList.map(link => link.set.qrList.map(qr => ({ set: link.set, qr }))).flat();
                const chatQrs = chatSetList?.map(link => link.set.qrList.map(qr => ({ set: link.set, qr }))).flat() ?? [];
                const otherQrs = QuickReplySet.list.filter(set => !globalSetList.some(link => link.set.name === set.name && !chatSetList?.some(link => link.set.name === set.name)))
                    .map(set => set.qrList.map(qr => ({ set, qr }))).flat();

                return [
                    ...globalQrs.map(x => new SlashCommandEnumValue(`${x.set.name}.${x.qr.label}`, `[global] ${x.qr.title || x.qr.message}`, enumTypes.name, enumIcons.qr)),
                    ...chatQrs.map(x => new SlashCommandEnumValue(`${x.set.name}.${x.qr.label}`, `[chat] ${x.qr.title || x.qr.message}`, enumTypes.enum, enumIcons.qr)),
                    ...otherQrs.map(x => new SlashCommandEnumValue(`${x.set.name}.${x.qr.label}`, `${x.qr.title || x.qr.message}`, enumTypes.qr, enumIcons.qr)),
                ];
            },
        };

        window['qrEnumProviderExecutables'] = localEnumProviders.qrExecutables;

        SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'qr',
            callback: (_, value) => this.executeQuickReplyByIndex(Number(value)),
            unnamedArgumentList: [
                new SlashCommandArgument(
                    'number', [ARGUMENT_TYPE.NUMBER], true,
                ),
            ],
            helpString: 'Activates the specified Quick Reply',
        }));
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'qrset',
            callback: () => {
                toastr.warning('The command /qrset has been deprecated. Use /qr-set, /qr-set-on, and /qr-set-off instead.');
                return '';
            },
            helpString: '<strong>DEPRECATED</strong> – The command /qrset has been deprecated. Use /qr-set, /qr-set-on, and /qr-set-off instead.',
        }));
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'qr-set',
            callback: (args, value) => {
                this.toggleGlobalSet(value, args);
                return '';
            },
            namedArgumentList: [
                new SlashCommandNamedArgument(
                    'visible', 'set visibility', [ARGUMENT_TYPE.BOOLEAN], false, false, 'true',
                ),
            ],
            unnamedArgumentList: [
                SlashCommandArgument.fromProps({
                    description: 'QR set name',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: true,
                    enumProvider: localEnumProviders.qrSets,
                }),
            ],
            helpString: 'Toggle global QR set',
        }));
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'qr-set-on',
            callback: (args, value) => {
                this.addGlobalSet(value, args);
                return '';
            },
            namedArgumentList: [
                new SlashCommandNamedArgument(
                    'visible', 'set visibility', [ARGUMENT_TYPE.BOOLEAN], false, false, 'true',
                ),
            ],
            unnamedArgumentList: [
                SlashCommandArgument.fromProps({
                    description: 'QR set name',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: true,
                    enumProvider: localEnumProviders.qrSets,
                }),
            ],
            helpString: 'Activate global QR set',
        }));
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'qr-set-off',
            callback: (_, value) => {
                this.removeGlobalSet(value);
                return '';
            },
            unnamedArgumentList: [
                SlashCommandArgument.fromProps({
                    description: 'QR set name',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: true,
                    enumProvider: localEnumProviders.qrSets,
                }),
            ],
            helpString: 'Deactivate global QR set',
        }));
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'qr-chat-set',
            callback: (args, value) => {
                this.toggleChatSet(value, args);
                return '';
            },
            namedArgumentList: [
                new SlashCommandNamedArgument(
                    'visible', 'set visibility', [ARGUMENT_TYPE.BOOLEAN], false, false, 'true',
                ),
            ],
            unnamedArgumentList: [
                SlashCommandArgument.fromProps({
                    description: 'QR set name',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: true,
                    enumProvider: localEnumProviders.qrSets,
                }),
            ],
            helpString: 'Toggle chat QR set',
        }));

        SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'qr-chat-set-on',
            callback: (args, value) => {
                this.addChatSet(value, args);
                return '';
            },
            namedArgumentList: [
                new SlashCommandNamedArgument(
                    'visible', 'whether the QR set should be visible', [ARGUMENT_TYPE.BOOLEAN], false, false, 'true',
                ),
            ],
            unnamedArgumentList: [
                SlashCommandArgument.fromProps({
                    description: 'QR set name',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: true,
                    enumProvider: localEnumProviders.qrSets,
                }),
            ],
            helpString: 'Activate chat QR set',
        }));
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'qr-chat-set-off',
            callback: (_, value) => {
                this.removeChatSet(value);
                return '';
            },
            unnamedArgumentList: [
                SlashCommandArgument.fromProps({
                    description: 'QR set name',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: true,
                    enumProvider: localEnumProviders.qrSets,
                }),
            ],
            helpString: 'Deactivate chat QR set',
        }));
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'qr-set-list',
            callback: (_, value) => JSON.stringify(this.listSets(value ?? 'all')),
            returns: 'list of QR sets',
            namedArgumentList: [],
            unnamedArgumentList: [
                new SlashCommandArgument(
                    'set type', [ARGUMENT_TYPE.STRING], false, false, 'all', ['all', 'global', 'chat'],
                ),
            ],
            helpString: 'Gets a list of the names of all quick reply sets.',
        }));
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'qr-list',
            callback: (_, value) => {
                return JSON.stringify(this.listQuickReplies(value));
            },
            returns: 'list of QRs',
            namedArgumentList: [],
            unnamedArgumentList: [
                SlashCommandArgument.fromProps({
                    description: 'QR set name',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: true,
                    enumProvider: localEnumProviders.qrSets,
                }),
            ],
            helpString: 'Gets a list of the names of all quick replies in this quick reply set.',
        }));

        const qrArgs = [
            SlashCommandNamedArgument.fromProps({
                name: 'set',
                description: 'name of the QR set, e.g., set=PresetName1',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: true,
                enumProvider: localEnumProviders.qrSets,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'label',
                description: 'text on the button, e.g., label=MyButton',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
                enumProvider: localEnumProviders.qrEntries,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'icon',
                description: 'icon to show on the button, e.g., icon=fa-pencil',
                typeList: [ARGUMENT_TYPE.STRING],
                isRequired: false,
            }),
            SlashCommandNamedArgument.fromProps({
                name: 'showlabel',
                description: 'whether to show the label even when an icon is assigned, e.g., icon=fa-pencil showlabel=true',
                typeList: [ARGUMENT_TYPE.BOOLEAN],
                isRequired: false,
            }),
            new SlashCommandNamedArgument('hidden', 'whether the button should be hidden, e.g., hidden=true', [ARGUMENT_TYPE.BOOLEAN], false, false, 'false'),
            new SlashCommandNamedArgument('startup', 'auto execute on app startup, e.g., startup=true', [ARGUMENT_TYPE.BOOLEAN], false, false, 'false'),
            new SlashCommandNamedArgument('user', 'auto execute on user message, e.g., user=true', [ARGUMENT_TYPE.BOOLEAN], false, false, 'false'),
            new SlashCommandNamedArgument('bot', 'auto execute on AI message, e.g., bot=true', [ARGUMENT_TYPE.BOOLEAN], false, false, 'false'),
            new SlashCommandNamedArgument('load', 'auto execute on chat load, e.g., load=true', [ARGUMENT_TYPE.BOOLEAN], false, false, 'false'),
            new SlashCommandNamedArgument('group', 'auto execute on group member selection, e.g., group=true', [ARGUMENT_TYPE.BOOLEAN], false, false, 'false'),
            new SlashCommandNamedArgument('title', 'title / tooltip to be shown on button, e.g., title="My Fancy Button"', [ARGUMENT_TYPE.STRING], false),
        ];
        const qrUpdateArgs = [
            new SlashCommandNamedArgument('newlabel', 'new text for the button', [ARGUMENT_TYPE.STRING], false),
            SlashCommandNamedArgument.fromProps({
                name: 'id',
                description: 'numeric ID of the QR, e.g., id=42',
                typeList: [ARGUMENT_TYPE.NUMBER],
                isRequired: false,
                enumProvider: localEnumProviders.qrIds,
            }),
        ];

        SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'qr-create',
            callback: (args, message) => {
                this.createQuickReply(args, message);
                return '';
            },
            namedArgumentList: qrArgs,
            unnamedArgumentList: [
                new SlashCommandArgument(
                    'command', [ARGUMENT_TYPE.STRING], true,
                ),
            ],
            helpString: `
                <div>Creates a new Quick Reply.</div>
                <div>
                    <strong>Example:</strong>
                    <ul>
                        <li>
                            <pre><code>/qr-create set=MyPreset label=MyButton /echo 123</code></pre>
                        </li>
                    </ul>
                </div>
            `,
        }));
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'qr-get',
            callback: (args, _) => {
                return this.getQuickReply(args);
            },
            namedArgumentList: [
                SlashCommandNamedArgument.fromProps({
                    name: 'set',
                    description: 'name of the QR set, e.g., set=PresetName1',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: true,
                    enumProvider: localEnumProviders.qrSets,
                }),
                SlashCommandNamedArgument.fromProps({
                    name: 'label',
                    description: 'text on the button, e.g., label=MyButton',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: false,
                    enumProvider: localEnumProviders.qrEntries,
                }),
                SlashCommandNamedArgument.fromProps({
                    name: 'id',
                    description: 'numeric ID of the QR, e.g., id=42',
                    typeList: [ARGUMENT_TYPE.NUMBER],
                    isRequired: false,
                    enumProvider: localEnumProviders.qrIds,
                }),
            ],
            returns: 'a dictionary with all the QR\'s properties',
            helpString: `
                <div>Get a Quick Reply's properties.</div>
                <div>
                    <strong>Examples:</strong>
                    <ul>
                        <li>
                            <pre><code>/qr-get set=MyPreset label=MyButton | /echo</code></pre>
                            <pre><code>/qr-get set=MyPreset id=42 | /echo</code></pre>
                        </li>
                    </ul>
                </div>
            `,
        }));
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'qr-update',
            callback: (args, message) => {
                this.updateQuickReply(args, message);
                return '';
            },
            returns: 'updated quick reply',
            namedArgumentList: [...qrUpdateArgs, ...qrArgs.map(it=>{
                if (it.name == 'label') {
                    const clone = SlashCommandNamedArgument.fromProps(it);
                    clone.isRequired = false;
                    return clone;
                }
                return it;
            })],
            unnamedArgumentList: [
                new SlashCommandArgument('command', [ARGUMENT_TYPE.STRING]),
            ],
            helpString: `
                <div>
                    Updates Quick Reply.
                </div>
                <div>
                    <strong>Example:</strong>
                    <ul>
                        <li>
                            <pre><code>/qr-update set=MyPreset label=MyButton newlabel=MyRenamedButton /echo 123</code></pre>
                        </li>
                    </ul>
                </div>
            `,
        }));
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'qr-delete',
            callback: (args, name) => {
                this.deleteQuickReply(args, name);
                return '';
            },
            namedArgumentList: [
                SlashCommandNamedArgument.fromProps({
                    name: 'set',
                    description: 'QR set name',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: true,
                    enumProvider: localEnumProviders.qrSets,
                }),
                SlashCommandNamedArgument.fromProps({
                    name: 'label',
                    description: 'Quick Reply label',
                    typeList: [ARGUMENT_TYPE.STRING],
                    enumProvider: localEnumProviders.qrEntries,
                }),
                SlashCommandNamedArgument.fromProps({
                    name: 'id',
                    description: 'numeric ID of the QR, e.g., id=42',
                    typeList: [ARGUMENT_TYPE.NUMBER],
                    enumProvider: localEnumProviders.qrIds,
                }),
            ],
            unnamedArgumentList: [
                SlashCommandArgument.fromProps({
                    description: 'label',
                    typeList: [ARGUMENT_TYPE.STRING],
                    enumProvider: localEnumProviders.qrEntries,
                }),
            ],
            helpString: 'Deletes a Quick Reply from the specified set. (Label must be provided via named or unnamed argument)',
        }));
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'qr-contextadd',
            callback: (args, name) => {
                this.createContextItem(args, name);
                return '';
            },
            namedArgumentList: [
                SlashCommandNamedArgument.fromProps({
                    name: 'set',
                    description: 'QR set name',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: true,
                    enumProvider: localEnumProviders.qrSets,
                }),
                SlashCommandNamedArgument.fromProps({
                    name: 'label',
                    description: 'Quick Reply label',
                    typeList: [ARGUMENT_TYPE.STRING],
                    enumProvider: localEnumProviders.qrEntries,
                }),
                SlashCommandNamedArgument.fromProps({
                    name: 'id',
                    description: 'numeric ID of the QR, e.g., id=42',
                    typeList: [ARGUMENT_TYPE.NUMBER],
                    enumProvider: localEnumProviders.qrIds,
                }),
                new SlashCommandNamedArgument(
                    'chain', 'boolean', [ARGUMENT_TYPE.BOOLEAN], false, false, 'false',
                ),
            ],
            unnamedArgumentList: [
                SlashCommandArgument.fromProps({
                    description: 'QR set name',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: true,
                    enumProvider: localEnumProviders.qrSets,
                }),
            ],
            helpString: `
                <div>
                    Add context menu preset to a QR.
                </div>
                <div>
                    <strong>Example:</strong>
                    <ul>
                        <li>
                            <pre><code>/qr-contextadd set=MyPreset label=MyButton chain=true MyOtherPreset</code></pre>
                        </li>
                    </ul>
                </div>
            `,
        }));
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'qr-contextdel',
            callback: (args, name) => {
                this.deleteContextItem(args, name);
                return '';
            },
            namedArgumentList: [
                SlashCommandNamedArgument.fromProps({
                    name: 'set',
                    description: 'QR set name',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: true,
                    enumProvider: localEnumProviders.qrSets,
                }),
                SlashCommandNamedArgument.fromProps({
                    name: 'label',
                    description: 'Quick Reply label',
                    typeList: [ARGUMENT_TYPE.STRING],
                    enumProvider: localEnumProviders.qrEntries,
                }),
                SlashCommandNamedArgument.fromProps({
                    name: 'id',
                    description: 'numeric ID of the QR, e.g., id=42',
                    typeList: [ARGUMENT_TYPE.NUMBER],
                    enumProvider: localEnumProviders.qrIds,
                }),
            ],
            unnamedArgumentList: [
                SlashCommandArgument.fromProps({
                    description: 'QR set name',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: true,
                    enumProvider: localEnumProviders.qrSets,
                }),
            ],
            helpString: `
                <div>
                    Remove context menu preset from a QR.
                </div>
                <div>
                    <strong>Example:</strong>
                    <ul>
                        <li>
                            <pre><code>/qr-contextdel set=MyPreset label=MyButton MyOtherPreset</code></pre>
                        </li>
                    </ul>
                </div>
            `,
        }));
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'qr-contextclear',
            callback: (args, label) => {
                this.clearContextMenu(args, label);
                return '';
            },
            namedArgumentList: [
                SlashCommandNamedArgument.fromProps({
                    name: 'set',
                    description: 'QR set name',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: true,
                    enumProvider: localEnumProviders.qrSets,
                }),
                SlashCommandNamedArgument.fromProps({
                    name: 'id',
                    description: 'numeric ID of the QR, e.g., id=42',
                    typeList: [ARGUMENT_TYPE.NUMBER],
                    enumProvider: localEnumProviders.qrIds,
                }),
            ],
            unnamedArgumentList: [
                SlashCommandArgument.fromProps({
                    description: 'Quick Reply label',
                    typeList: [ARGUMENT_TYPE.STRING],
                    enumProvider: localEnumProviders.qrEntries,
                }),
            ],
            helpString: `
                <div>
                    Remove all context menu presets from a QR.
                </div>
                <div>
                    <strong>Example:</strong>
                    <ul>
                        <li>
                            <pre><code>/qr-contextclear set=MyPreset MyButton</code></pre>
                        </li>
                    </ul>
                </div>
            `,
        }));

        const presetArgs = [
            new SlashCommandNamedArgument('nosend', 'disable send / insert in user input (invalid for slash commands)', [ARGUMENT_TYPE.BOOLEAN], false),
            new SlashCommandNamedArgument('before', 'place QR before user input', [ARGUMENT_TYPE.BOOLEAN], false),
            new SlashCommandNamedArgument('inject', 'inject user input automatically (if disabled use {{input}})', [ARGUMENT_TYPE.BOOLEAN], false),
        ];
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'qr-set-create',
            callback: async (args, name) => {
                await this.createSet(name, args);
                return '';
            },
            aliases: ['qr-presetadd'],
            namedArgumentList: presetArgs,
            unnamedArgumentList: [
                SlashCommandArgument.fromProps({
                    description: 'QR set name',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: true,
                    enumProvider: localEnumProviders.qrSets,
                    forceEnum: false,
                }),
            ],
            helpString: `
                <div>
                    Create a new preset (overrides existing ones).
                </div>
                <div>
                    <strong>Example:</strong>
                    <ul>
                        <li>
                            <pre><code>/qr-set-add MyNewPreset</code></pre>
                        </li>
                    </ul>
                </div>
            `,
        }));

        SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'qr-set-update',
            callback: async (args, name) => {
                await this.updateSet(name, args);
                return '';
            },
            aliases: ['qr-presetupdate'],
            namedArgumentList: presetArgs,
            unnamedArgumentList: [
                SlashCommandArgument.fromProps({
                    description: 'QR set name',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: true,
                    enumProvider: localEnumProviders.qrSets,
                }),
            ],
            helpString: `
                <div>
                    Update an existing preset.
                </div>
                <div>
                    <strong>Example:</strong>
                    <pre><code>/qr-set-update enabled=false MyPreset</code></pre>
                </div>
            `,
        }));
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'qr-set-delete',
            callback: async (_, name) => {
                await this.deleteSet(name);
                return '';
            },
            aliases: ['qr-presetdelete'],
            unnamedArgumentList: [
                SlashCommandArgument.fromProps({
                    description: 'QR set name',
                    typeList: [ARGUMENT_TYPE.STRING],
                    isRequired: true,
                    enumProvider: localEnumProviders.qrSets,
                }),
            ],
            helpString: `
                <div>
                    Delete an existing preset.
                </div>
                <div>
                    <strong>Example:</strong>
                    <pre><code>/qr-set-delete MyPreset</code></pre>
                </div>
            `,
        }));

        SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'qr-arg',
            callback: ({ _scope }, [key, value]) => {
                _scope.setMacro(`arg::${key}`, value, key.includes('*'));
                return '';
            },
            unnamedArgumentList: [
                SlashCommandArgument.fromProps({ description: 'argument name',
                    typeList: ARGUMENT_TYPE.STRING,
                    isRequired: true,
                }),
                SlashCommandArgument.fromProps({ description: 'argument value',
                    typeList: [ARGUMENT_TYPE.STRING, ARGUMENT_TYPE.NUMBER, ARGUMENT_TYPE.BOOLEAN, ARGUMENT_TYPE.LIST, ARGUMENT_TYPE.DICTIONARY],
                    isRequired: true,
                }),
            ],
            splitUnnamedArgument: true,
            splitUnnamedArgumentCount: 2,
            helpString: `
                <div>
                    Set a fallback value for a Quick Reply argument.
                </div>
                <div>
                    <strong>Example:</strong>
                    <pre><code>/qr-arg x foo |\n/echo {{arg::x}}</code></pre>
                </div>
            `,
        }));

        SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'import',
            /**
             *
             * @param {{_scope:SlashCommandScope, _abortController:SlashCommandAbortController, _debugController:SlashCommandDebugController, from:string}} args
             * @param {string} value
             */
            callback: (args, value) => {
                if (!args.from) throw new Error('/import requires from= to be set.');
                if (!value) throw new Error('/import requires the unnamed argument to be set.');
                let qr = [...this.api.listGlobalSets(), ...this.api.listChatSets()]
                    .map(it=>this.api.getSetByName(it)?.qrList ?? [])
                    .flat()
                    .find(it=>it.label == args.from)
                ;
                if (!qr) {
                    let [setName, ...qrNameParts] = args.from.split('.');
                    let qrName = qrNameParts.join('.');
                    let qrs = QuickReplySet.get(setName);
                    if (qrs) {
                        qr = qrs.qrList.find(it=>it.label == qrName);
                    }
                }
                if (qr) {
                    const parser = new SlashCommandParser();
                    const closure = parser.parse(qr.message, true, [], args._abortController, args._debugController);
                    if (args._debugController) {
                        closure.source = args.from;
                    }
                    const testCandidates = (executor)=>{
                        return (
                            executor.namedArgumentList.find(arg=>arg.name == 'key')
                            && executor.unnamedArgumentList.length > 0
                            && executor.unnamedArgumentList[0].value instanceof SlashCommandClosure
                        ) || (
                            !executor.namedArgumentList.find(arg=>arg.name == 'key')
                            && executor.unnamedArgumentList.length > 1
                            && executor.unnamedArgumentList[1].value instanceof SlashCommandClosure
                        );
                    };
                    const candidates = closure.executorList
                        .filter(executor=>['let', 'var'].includes(executor.command.name))
                        .filter(testCandidates)
                        .map(executor=>({
                            key: executor.namedArgumentList.find(arg=>arg.name == 'key')?.value ?? executor.unnamedArgumentList[0].value,
                            value: executor.unnamedArgumentList[executor.namedArgumentList.find(arg=>arg.name == 'key') ? 0 : 1].value,
                        }))
                    ;
                    for (let i = 0; i < value.length; i++) {
                        const srcName = value[i];
                        let dstName = srcName;
                        if (i + 2 < value.length && value[i + 1] == 'as') {
                            dstName = value[i + 2];
                            i += 2;
                        }
                        const pick = candidates.find(it=>it.key == srcName);
                        if (!pick) throw new Error(`No scoped closure named "${srcName}" found in "${args.from}"`);
                        if (args._scope.existsVariableInScope(dstName)) {
                            args._scope.setVariable(dstName, pick.value);
                        } else {
                            args._scope.letVariable(dstName, pick.value);
                        }
                    }
                } else {
                    throw new Error(`No Quick Reply found for "${name}".`);
                }
                return '';
            },
            namedArgumentList: [
                SlashCommandNamedArgument.fromProps({ name: 'from',
                    description: 'Quick Reply to import from (QRSet.QRLabel)',
                    typeList: ARGUMENT_TYPE.STRING,
                    isRequired: true,
                }),
            ],
            unnamedArgumentList: [
                SlashCommandArgument.fromProps({ description: 'what to import (x or x as y)',
                    acceptsMultiple: true,
                    typeList: ARGUMENT_TYPE.STRING,
                    isRequired: true,
                }),
            ],
            splitUnnamedArgument: true,
            helpString: `
                <div>
                    Import one or more closures from another Quick Reply.
                </div>
                <div>
                    Only imports closures that are directly assigned a scoped variable via <code>/let</code> or <code>/var</code>.
                </div>
                <div>
                    <strong>Examples:</strong>
                    <ul>
                        <li><pre><code>/import from=LibraryQrSet.FooBar foo |\n/:foo</code></pre></li>
                        <li><pre><code>/import from=LibraryQrSet.FooBar\n\tfoo\n\tbar\n|\n/:foo |\n/:bar</code></pre></li>
                        <li><pre><code>/import from=LibraryQrSet.FooBar\n\tfoo as x\n\tbar as y\n|\n/:x |\n/:y</code></pre></li>
                    </ul>
                </div>
            `,
        }));
    }




    getSetByName(name) {
        const set = this.api.getSetByName(name);
        if (!set) {
            toastr.error(`No Quick Reply Set with the name "${name}" could be found.`);
        }
        return set;
    }

    getQrByLabel(setName, label) {
        const qr = this.api.getQrByLabel(setName, label);
        if (!qr) {
            toastr.error(`No Quick Reply with the label "${label}" could be found in the set "${setName}"`);
        }
        return qr;
    }




    async executeQuickReplyByIndex(idx) {
        try {
            return await this.api.executeQuickReplyByIndex(idx);
        } catch (ex) {
            toastr.error(ex.message);
        }
    }


    toggleGlobalSet(name, args = {}) {
        try {
            this.api.toggleGlobalSet(name, isTrueBoolean(args.visible ?? 'true'));
        } catch (ex) {
            toastr.error(ex.message);
        }
    }
    addGlobalSet(name, args = {}) {
        try {
            this.api.addGlobalSet(name, isTrueBoolean(args.visible ?? 'true'));
        } catch (ex) {
            toastr.error(ex.message);
        }
    }
    removeGlobalSet(name) {
        try {
            this.api.removeGlobalSet(name);
        } catch (ex) {
            toastr.error(ex.message);
        }
    }


    toggleChatSet(name, args = {}) {
        try {
            this.api.toggleChatSet(name, isTrueBoolean(args.visible ?? 'true'));
        } catch (ex) {
            toastr.error(ex.message);
        }
    }
    addChatSet(name, args = {}) {
        try {
            this.api.addChatSet(name, isTrueBoolean(args.visible ?? 'true'));
        } catch (ex) {
            toastr.error(ex.message);
        }
    }
    removeChatSet(name) {
        try {
            this.api.removeChatSet(name);
        } catch (ex) {
            toastr.error(ex.message);
        }
    }


    createQuickReply(args, message) {
        try {
            this.api.createQuickReply(
                args.set ?? '',
                args.label ?? '',
                {
                    icon: args.icon,
                    showLabel: args.showlabel === undefined ? undefined : isTrueBoolean(args.showlabel),
                    message: message ?? '',
                    title: args.title,
                    isHidden: isTrueBoolean(args.hidden),
                    executeOnStartup: isTrueBoolean(args.startup),
                    executeOnUser: isTrueBoolean(args.user),
                    executeOnAi: isTrueBoolean(args.bot),
                    executeOnChatChange: isTrueBoolean(args.load),
                    executeOnGroupMemberDraft: isTrueBoolean(args.group),
                    automationId: args.automationId ?? '',
                },
            );
        } catch (ex) {
            toastr.error(ex.message);
        }
    }
    getQuickReply(args) {
        try {
            return JSON.stringify(this.api.getQrByLabel(args.set, args.id !== undefined ? Number(args.id) : args.label));
        } catch (ex) {
            toastr.error(ex.message);
        }
    }
    updateQuickReply(args, message) {
        try {
            this.api.updateQuickReply(
                args.set ?? '',
                args.id !== undefined ? Number(args.id) : (args.label ?? ''),
                {
                    icon: args.icon,
                    showLabel: args.showlabel === undefined ? undefined : isTrueBoolean(args.showlabel),
                    newLabel: args.newlabel,
                    message: (message ?? '').trim().length > 0 ? message : undefined,
                    title: args.title,
                    isHidden: args.hidden === undefined ? undefined : isTrueBoolean(args.hidden),
                    executeOnStartup: args.startup === undefined ? undefined : isTrueBoolean(args.startup),
                    executeOnUser: args.user === undefined ? undefined : isTrueBoolean(args.user),
                    executeOnAi: args.bot === undefined ? undefined : isTrueBoolean(args.bot),
                    executeOnChatChange: args.load === undefined ? undefined : isTrueBoolean(args.load),
                    executeOnGroupMemberDraft: args.group === undefined ? undefined : isTrueBoolean(args.group),
                    automationId: args.automationId ?? '',
                },
            );
        } catch (ex) {
            toastr.error(ex.message);
        }
    }
    deleteQuickReply(args, label) {
        try {
            this.api.deleteQuickReply(args.set, args.id !== undefined ? Number(args.id) : (args.label ?? label));
        } catch (ex) {
            toastr.error(ex.message);
        }
    }


    createContextItem(args, name) {
        try {
            this.api.createContextItem(
                args.set,
                args.label,
                name,
                isTrueBoolean(args.chain),
            );
        }  catch (ex) {
            toastr.error(ex.message);
        }
    }
    deleteContextItem(args, name) {
        try {
            this.api.deleteContextItem(args.set, args.label, name);
        }  catch (ex) {
            toastr.error(ex.message);
        }
    }
    clearContextMenu(args, label) {
        try {
            this.api.clearContextMenu(args.set, args.label ?? label);
        } catch (ex) {
            toastr.error(ex.message);
        }
    }


    async createSet(name, args) {
        try {
            await this.api.createSet(
                args.name ?? name ?? '',
                {
                    disableSend: isTrueBoolean(args.nosend),
                    placeBeforeInput: isTrueBoolean(args.before),
                    injectInput: isTrueBoolean(args.inject),
                },
            );
        } catch (ex) {
            toastr.error(ex.message);
        }
    }
    async updateSet(name, args) {
        try {
            await this.api.updateSet(
                args.name ?? name ?? '',
                {
                    disableSend: args.nosend !== undefined ? isTrueBoolean(args.nosend) : undefined,
                    placeBeforeInput: args.before !== undefined ? isTrueBoolean(args.before) : undefined,
                    injectInput: args.inject !== undefined ? isTrueBoolean(args.inject) : undefined,
                },
            );
        } catch (ex) {
            toastr.error(ex.message);
        }
    }
    async deleteSet(name) {
        try {
            await this.api.deleteSet(name ?? '');
        } catch (ex) {
            toastr.error(ex.message);
        }
    }

    listSets(source) {
        try {
            switch (source) {
                case 'global':
                    return this.api.listGlobalSets();
                case 'chat':
                    return this.api.listChatSets();
                default:
                    return this.api.listSets();
            }
        } catch (ex) {
            toastr.error(ex.message);
        }
    }
    listQuickReplies(name) {
        try {
            return this.api.listQuickReplies(name);
        } catch (ex) {
            toastr.error(ex.message);
        }
    }
}
