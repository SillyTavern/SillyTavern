import { SlashCommand } from '../../../slash-commands/SlashCommand.js';
import { ARGUMENT_TYPE, SlashCommandArgument, SlashCommandNamedArgument } from '../../../slash-commands/SlashCommandArgument.js';
import { SlashCommandParser } from '../../../slash-commands/SlashCommandParser.js';
import { isTrueBoolean } from '../../../utils.js';
// eslint-disable-next-line no-unused-vars
import { QuickReplyApi } from '../api/QuickReplyApi.js';

export class SlashCommandHandler {
    /**@type {QuickReplyApi}*/ api;




    constructor(/**@type {QuickReplyApi}*/api) {
        this.api = api;
    }




    init() {
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
            callback: () => toastr.warning('The command /qrset has been deprecated. Use /qr-set, /qr-set-on, and /qr-set-off instead.'),
            helpString: '<strong>DEPRECATED</strong> – The command /qrset has been deprecated. Use /qr-set, /qr-set-on, and /qr-set-off instead.',
        }));
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'qr-set',
            callback: (args, value) => this.toggleGlobalSet(value, args),
            namedArgumentList: [
                new SlashCommandNamedArgument(
                    'visible', 'set visibility', [ARGUMENT_TYPE.BOOLEAN], false, false, 'true',
                ),
            ],
            unnamedArgumentList: [
                new SlashCommandArgument(
                    'QR set name', [ARGUMENT_TYPE.STRING], true,
                ),
            ],
            helpString: 'Toggle global QR set',
        }));
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'qr-set-on',
            callback: (args, value) => this.addGlobalSet(value, args),
            namedArgumentList: [
                new SlashCommandNamedArgument(
                    'visible', 'set visibility', [ARGUMENT_TYPE.BOOLEAN], false, false, 'true',
                ),
            ],
            unnamedArgumentList: [
                new SlashCommandArgument(
                    'QR set name', [ARGUMENT_TYPE.STRING], true,
                ),
            ],
            helpString: 'Activate global QR set',
        }));
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'qr-set-off',
            callback: (_, value) => this.removeGlobalSet(value),
            unnamedArgumentList: [
                new SlashCommandArgument(
                    'QR set name', [ARGUMENT_TYPE.STRING], true,
                ),
            ],
            helpString: 'Deactivate global QR set',
        }));
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'qr-chat-set',
            callback: (args, value) => this.toggleChatSet(value, args),
            namedArgumentList: [
                new SlashCommandNamedArgument(
                    'visible', 'set visibility', [ARGUMENT_TYPE.BOOLEAN], false, false, 'true',
                ),
            ],
            unnamedArgumentList: [
                new SlashCommandArgument(
                    'QR set name', [ARGUMENT_TYPE.STRING], true,
                ),
            ],
            helpString: 'Toggle chat QR set',
        }));

        SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'qr-chat-set-on',
            callback: (args, value) => this.addChatSet(value, args),
            namedArgumentList: [
                new SlashCommandNamedArgument(
                    'visible', 'whether the QR set should be visible', [ARGUMENT_TYPE.BOOLEAN], false, false, 'true', ['true', 'false'],
                ),
            ],
            unnamedArgumentList: [
                new SlashCommandArgument(
                    'QR set name', [ARGUMENT_TYPE.STRING], true,
                ),
            ],
            helpString: 'Activate chat QR set',
        }));
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'qr-chat-set-off',
            callback: (_, value) => this.removeChatSet(value),
            unnamedArgumentList: [
                new SlashCommandArgument(
                    'QR set name', [ARGUMENT_TYPE.STRING], true,
                ),
            ],
            helpString: 'Deactivate chat QR set',
        }));
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'qr-set-list',
            callback: (_, value) => this.listSets(value ?? 'all'),
            returns: 'list of QR sets',
            namedArgumentList: [],
            unnamedArgumentList: [
                new SlashCommandArgument(
                    'set type', [ARGUMENT_TYPE.STRING], false, false, null, ['all', 'global', 'chat'],
                ),
            ],
            helpString: 'Gets a list of the names of all quick reply sets.',
        }));
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'qr-list',
            callback: (_, value) => this.listQuickReplies(value),
            returns: 'list of QRs',
            namedArgumentList: [],
            unnamedArgumentList: [
                new SlashCommandArgument(
                    'set name', [ARGUMENT_TYPE.STRING], true,
                ),
            ],
            helpString: 'Gets a list of the names of all quick replies in this quick reply set.',
        }));

        const qrArgs = [
            new SlashCommandNamedArgument('label', 'text on the button, e.g., label=MyButton', [ARGUMENT_TYPE.STRING]),
            new SlashCommandNamedArgument('set', 'name of the QR set, e.g., set=PresetName1', [ARGUMENT_TYPE.STRING]),
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
        ];
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'qr-create',
            callback: (args, message) => this.createQuickReply(args, message),
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
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'qr-update',
            callback: (args, message) => this.updateQuickReply(args, message),
            returns: 'updated quick reply',
            namedArgumentList: [...qrUpdateArgs, ...qrArgs],
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
            callback: (args, name) => this.deleteQuickReply(args, name),
            namedArgumentList: [
                new SlashCommandNamedArgument(
                    'set', 'Quick Reply set', [ARGUMENT_TYPE.STRING], true,
                ),
                new SlashCommandNamedArgument(
                    'label', 'Quick Reply label', [ARGUMENT_TYPE.STRING], false,
                ),
            ],
            helpString: 'Deletes a Quick Reply from the specified set. If no label is provided, the entire set is deleted.',
        }));
        SlashCommandParser.addCommandObject(SlashCommand.fromProps({ name: 'qr-contextadd',
            callback: (args, name) => this.createContextItem(args, name),
            namedArgumentList: [
                new SlashCommandNamedArgument(
                    'set', 'string', [ARGUMENT_TYPE.STRING], true,
                ),
                new SlashCommandNamedArgument(
                    'label', 'string', [ARGUMENT_TYPE.STRING], true,
                ),
                new SlashCommandNamedArgument(
                    'chain', 'boolean', [ARGUMENT_TYPE.BOOLEAN], false, false, 'false',
                ),
            ],
            unnamedArgumentList: [
                new SlashCommandArgument(
                    'preset name', [ARGUMENT_TYPE.STRING], true,
                ),
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
            callback: (args, name) => this.deleteContextItem(args, name),
            namedArgumentList: [
                new SlashCommandNamedArgument(
                    'set', 'string', [ARGUMENT_TYPE.STRING], true,
                ),
                new SlashCommandNamedArgument(
                    'label', 'string', [ARGUMENT_TYPE.STRING], true,
                ),
            ],
            unnamedArgumentList: [
                new SlashCommandArgument(
                    'preset name', [ARGUMENT_TYPE.STRING], true,
                ),
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
            callback: (args, label) => this.clearContextMenu(args, label),
            namedArgumentList: [
                new SlashCommandNamedArgument(
                    'set', 'context menu preset name', [ARGUMENT_TYPE.STRING], true,
                ),
            ],
            unnamedArgumentList: [
                new SlashCommandArgument(
                    'label', [ARGUMENT_TYPE.STRING], true,
                ),
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
            callback: (args, name) => this.createSet(name, args),
            aliases: ['qr-presetadd'],
            namedArgumentList: presetArgs,
            unnamedArgumentList: [
                new SlashCommandArgument(
                    'name', [ARGUMENT_TYPE.STRING], true,
                ),
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
            callback: (args, name) => this.updateSet(name, args),
            aliases: ['qr-presetupdate'],
            namedArgumentList: presetArgs,
            unnamedArgumentList: [
                new SlashCommandArgument('name', [ARGUMENT_TYPE.STRING], true),
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
            callback: (args, name) => this.deleteSet(name),
            aliases: ['qr-presetdelete'],
            unnamedArgumentList: [
                new SlashCommandArgument('name', [ARGUMENT_TYPE.STRING], true),
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
    updateQuickReply(args, message) {
        try {
            this.api.updateQuickReply(
                args.set ?? '',
                args.label ?? '',
                {
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
            this.api.deleteQuickReply(args.set, label);
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


    createSet(name, args) {
        try {
            this.api.createSet(
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
    updateSet(name, args) {
        try {
            this.api.updateSet(
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
    deleteSet(name) {
        try {
            this.api.deleteSet(name ?? '');
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
