import { registerSlashCommand } from '../../../slash-commands.js';
import { isTrueBoolean } from '../../../utils.js';
// eslint-disable-next-line no-unused-vars
import { QuickReplyApi } from '../api/QuickReplyApi.js';

export class SlashCommandHandler {
    /**@type {QuickReplyApi}*/ api;




    constructor(/**@type {QuickReplyApi}*/api) {
        this.api = api;
    }




    init() {
        registerSlashCommand('qr', (_, value) => this.executeQuickReplyByIndex(Number(value)), [], '<span class="monospace">(number)</span> – activates the specified Quick Reply', true, true);
        registerSlashCommand('qrset', ()=>toastr.warning('The command /qrset has been deprecated. Use /qr-set, /qr-set-on, and /qr-set-off instead.'), [], '<strong>DEPRECATED</strong> – The command /qrset has been deprecated. Use /qr-set, /qr-set-on, and /qr-set-off instead.', true, true);
        registerSlashCommand('qr-set', (args, value)=>this.toggleGlobalSet(value, args), [], '<span class="monospace">[visible=true] (number)</span> – toggle global QR set', true, true);
        registerSlashCommand('qr-set-on', (args, value)=>this.addGlobalSet(value, args), [], '<span class="monospace">[visible=true] (number)</span> – activate global QR set', true, true);
        registerSlashCommand('qr-set-off', (_, value)=>this.removeGlobalSet(value), [], '<span class="monospace">(number)</span> – deactivate global QR set', true, true);
        registerSlashCommand('qr-chat-set', (args, value)=>this.toggleChatSet(value, args), [], '<span class="monospace">[visible=true] (number)</span> – toggle chat QR set', true, true);
        registerSlashCommand('qr-chat-set-on', (args, value)=>this.addChatSet(value, args), [], '<span class="monospace">[visible=true] (number)</span> – activate chat QR set', true, true);
        registerSlashCommand('qr-chat-set-off', (_, value)=>this.removeChatSet(value), [], '<span class="monospace">(number)</span> – deactivate chat QR set', true, true);
        registerSlashCommand('qr-set-list', (_, value)=>this.listSets(value ?? 'all'), [], '(all|global|chat) – gets a list of the names of all quick reply sets', true, true);
        registerSlashCommand('qr-list', (_, value)=>this.listQuickReplies(value), [], '(set name) – gets a list of the names of all quick replies in this quick reply set', true, true);

        const qrArgs = `
        label    - string - text on the button, e.g., label=MyButton
        set      - string - name of the QR set, e.g., set=PresetName1
        hidden   - bool   - whether the button should be hidden, e.g., hidden=true
        startup  - bool   - auto execute on app startup, e.g., startup=true
        user     - bool   - auto execute on user message, e.g., user=true
        bot      - bool   - auto execute on AI message, e.g., bot=true
        load     - bool   - auto execute on chat load, e.g., load=true
        group    - bool   - auto execute on group member selection, e.g., group=true
        title    - string - title / tooltip to be shown on button, e.g., title="My Fancy Button"
        `.trim();
        const qrUpdateArgs = `
        newlabel - string - new text for the button, e.g. newlabel=MyRenamedButton
        ${qrArgs}
        `.trim();
        registerSlashCommand('qr-create', (args, message)=>this.createQuickReply(args, message), [], `<span class="monospace" style="white-space:pre-line;">[arguments] (message)\n  arguments:\n    ${qrArgs}</span> – creates a new Quick Reply, example: <tt>/qr-create set=MyPreset label=MyButton /echo 123</tt>`, true, true);
        registerSlashCommand('qr-update', (args, message)=>this.updateQuickReply(args, message), [], `<span class="monospace" style="white-space:pre-line;">[arguments] (message)\n  arguments:\n    ${qrUpdateArgs}</span> – updates Quick Reply, example: <tt>/qr-update set=MyPreset label=MyButton newlabel=MyRenamedButton /echo 123</tt>`, true, true);
        registerSlashCommand('qr-delete', (args, name)=>this.deleteQuickReply(args, name), [], '<span class="monospace">set=string [label]</span> – deletes Quick Reply', true, true);
        registerSlashCommand('qr-contextadd', (args, name)=>this.createContextItem(args, name), [], '<span class="monospace">set=string label=string [chain=false] (preset name)</span> – add context menu preset to a QR, example: <tt>/qr-contextadd set=MyPreset label=MyButton chain=true MyOtherPreset</tt>', true, true);
        registerSlashCommand('qr-contextdel', (args, name)=>this.deleteContextItem(args, name), [], '<span class="monospace">set=string label=string (preset name)</span> – remove context menu preset from a QR, example: <tt>/qr-contextdel set=MyPreset label=MyButton MyOtherPreset</tt>', true, true);
        registerSlashCommand('qr-contextclear', (args, label)=>this.clearContextMenu(args, label), [], '<span class="monospace">set=string (label)</span> – remove all context menu presets from a QR, example: <tt>/qr-contextclear set=MyPreset MyButton</tt>', true, true);
        const presetArgs = `
        nosend  - bool - disable send / insert in user input (invalid for slash commands)
        before  - bool - place QR before user input
        inject  - bool - inject user input automatically (if disabled use {{input}})
        `.trim();
        registerSlashCommand('qr-set-create', (args, name)=>this.createSet(name, args), ['qr-presetadd'], `<span class="monospace" style="white-space:pre-line;">[arguments] (name)\n  arguments:\n    ${presetArgs}</span> – create a new preset (overrides existing ones), example: <tt>/qr-set-add MyNewPreset</tt>`, true, true);
        registerSlashCommand('qr-set-update', (args, name)=>this.updateSet(name, args), ['qr-presetupdate'], `<span class="monospace" style="white-space:pre-line;">[arguments] (name)\n  arguments:\n    ${presetArgs}</span> – update an existing preset, example: <tt>/qr-set-update enabled=false MyPreset</tt>`, true, true);
        registerSlashCommand('qr-set-delete', (args, name)=>this.deleteSet(name), ['qr-presetdelete'], `<span class="monospace" style="white-space:pre-line;">(name)\n  arguments:\n    ${presetArgs}</span> – delete an existing preset, example: <tt>/qr-set-delete MyPreset</tt>`, true, true);
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
