import { registerSlashCommand } from '../../../slash-commands.js';
import { QuickReplyContextLink } from './QuickReplyContextLink.js';
import { QuickReplySet } from './QuickReplySet.js';
import { QuickReplySettings } from './QuickReplySettings.js';

export class SlashCommandHandler {
    /**@type {QuickReplySettings}*/ settings;




    constructor(/**@type {QuickReplySettings}*/settings) {
        this.settings = settings;
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

        const qrArgs = `
        label    - string - text on the button, e.g., label=MyButton
        set      - string - name of the QR set, e.g., set=PresetName1
        hidden   - bool   - whether the button should be hidden, e.g., hidden=true
        startup  - bool   - auto execute on app startup, e.g., startup=true
        user     - bool   - auto execute on user message, e.g., user=true
        bot      - bool   - auto execute on AI message, e.g., bot=true
        load     - bool   - auto execute on chat load, e.g., load=true
        title    - bool   - title / tooltip to be shown on button, e.g., title="My Fancy Button"
        `.trim();
        const qrUpdateArgs = `
        newlabel - string - new text fort the button, e.g. newlabel=MyRenamedButton
        ${qrArgs}
        `.trim();
        registerSlashCommand('qr-create', (args, message)=>this.createQuickReply(args, message), [], `<span class="monospace" style="white-space:pre-line;">(arguments [message])\n  arguments:\n    ${qrArgs}</span> – creates a new Quick Reply, example: <tt>/qr-create set=MyPreset label=MyButton /echo 123</tt>`, true, true);
        registerSlashCommand('qr-update', (args, message)=>this.updateQuickReply(args, message), [], `<span class="monospace" style="white-space:pre-line;">(arguments [message])\n  arguments:\n    ${qrUpdateArgs}</span> – updates Quick Reply, example: <tt>/qr-update set=MyPreset label=MyButton newlabel=MyRenamedButton /echo 123</tt>`, true, true);
        registerSlashCommand('qr-delete', (args, name)=>this.deleteQuickReply(args, name), [], '<span class="monospace">(set=string [label])</span> – deletes Quick Reply', true, true);
        registerSlashCommand('qr-contextadd', (args, name)=>this.createContextItem(args, name), [], '<span class="monospace">(set=string label=string chain=bool [preset name])</span> – add context menu preset to a QR, example: <tt>/qr-contextadd set=MyPreset label=MyButton chain=true MyOtherPreset</tt>', true, true);
        registerSlashCommand('qr-contextdel', (args, name)=>this.deleteContextItem(args, name), [], '<span class="monospace">(set=string label=string [preset name])</span> – remove context menu preset from a QR, example: <tt>/qr-contextdel set=MyPreset label=MyButton MyOtherPreset</tt>', true, true);
        registerSlashCommand('qr-contextclear', (args, label)=>this.clearContextMenu(args, label), [], '<span class="monospace">(set=string [label])</span> – remove all context menu presets from a QR, example: <tt>/qr-contextclear set=MyPreset MyButton</tt>', true, true);
        const presetArgs = `
        enabled - bool - enable or disable the preset
        nosend  - bool - disable send / insert in user input (invalid for slash commands)
        before  - bool - place QR before user input
        slots   - int  - number of slots
        inject  - bool - inject user input automatically (if disabled use {{input}})
        `.trim();
        registerSlashCommand('qr-set-create', (args, name)=>this.createSet(name, args), ['qr-presetadd'], `<span class="monospace" style="white-space:pre-line;">(arguments [label])\n  arguments:\n    ${presetArgs}</span> – create a new preset (overrides existing ones), example: <tt>/qr-presetadd slots=3 MyNewPreset</tt>`, true, true);
        registerSlashCommand('qr-set-update', (args, name)=>this.updateSet(name, args), ['qr-presetupdate'], `<span class="monospace" style="white-space:pre-line;">(arguments [label])\n  arguments:\n    ${presetArgs}</span> – update an existing preset, example: <tt>/qr-presetupdate enabled=false MyPreset</tt>`, true, true);
    }




    getSetByName(name) {
        const set = QuickReplySet.get(name);
        if (!set) {
            toastr.error(`No Quick Reply Set with the name "${name}" could be found.`);
        }
        return set;
    }

    getQrByLabel(setName, label) {
        const set = this.getSetByName(setName);
        if (!set) return;
        const qr = set.qrList.find(it=>it.label == label);
        if (!qr) {
            toastr.error(`No Quick Reply with the label "${label}" could be found in the set "${set.name}"`);
        }
        return qr;
    }




    async executeQuickReplyByIndex(idx) {
        const qr = [...this.settings.config.setList, ...(this.settings.chatConfig?.setList ?? [])]
            .map(it=>it.set.qrList)
            .flat()[idx]
        ;
        if (qr) {
            return await qr.onExecute();
        } else {
            toastr.error(`No Quick Reply at index "${idx}"`);
        }
    }


    toggleGlobalSet(name, args = {}) {
        const set = this.getSetByName(name);
        if (!set) return;
        if (this.settings.config.hasSet(set)) {
            this.settings.config.removeSet(set);
        } else {
            this.settings.config.addSet(set, JSON.parse(args.visible ?? 'true'));
        }
    }
    addGlobalSet(name, args = {}) {
        const set = this.getSetByName(name);
        if (!set) return;
        this.settings.config.addSet(set, JSON.parse(args.visible ?? 'true'));
    }
    removeGlobalSet(name) {
        const set = this.getSetByName(name);
        if (!set) return;
        this.settings.config.removeSet(set);
    }


    toggleChatSet(name, args = {}) {
        if (!this.settings.chatConfig) return;
        const set = this.getSetByName(name);
        if (!set) return;
        if (this.settings.chatConfig.hasSet(set)) {
            this.settings.chatConfig.removeSet(set);
        } else {
            this.settings.chatConfig.addSet(set, JSON.parse(args.visible ?? 'true'));
        }
    }
    addChatSet(name, args = {}) {
        if (!this.settings.chatConfig) return;
        const set = this.getSetByName(name);
        if (!set) return;
        this.settings.chatConfig.addSet(set, JSON.parse(args.visible ?? 'true'));
    }
    removeChatSet(name) {
        if (!this.settings.chatConfig) return;
        const set = this.getSetByName(name);
        if (!set) return;
        this.settings.chatConfig.removeSet(set);
    }


    createQuickReply(args, message) {
        const set = this.getSetByName(args.set);
        if (!set) return;
        const qr = set.addQuickReply();
        qr.label = args.label ?? '';
        qr.message = message ?? '';
        qr.title = args.title ?? '';
        qr.isHidden = JSON.parse(args.hidden ?? 'false') === true;
        qr.executeOnStartup = JSON.parse(args.startup ?? 'false') === true;
        qr.executeOnUser = JSON.parse(args.user ?? 'false') === true;
        qr.executeOnAi = JSON.parse(args.bot ?? 'false') === true;
        qr.executeOnChatChange = JSON.parse(args.load ?? 'false') === true;
        qr.onUpdate();
    }
    updateQuickReply(args, message) {
        const qr = this.getQrByLabel(args.set, args.label);
        if (!qr) return;
        qr.message = (message ?? '').trim().length > 0 ? message : qr.message;
        qr.label = args.newlabel !== undefined ? (args.newlabel ?? '') : qr.label;
        qr.title = args.title !== undefined ? (args.title ?? '') : qr.title;
        qr.isHidden = args.hidden !== undefined ? (JSON.parse(args.hidden ?? 'false') === true) : qr.isHidden;
        qr.executeOnStartup = args.startup !== undefined ? (JSON.parse(args.startup ?? 'false') === true) : qr.executeOnStartup;
        qr.executeOnUser = args.user !== undefined ? (JSON.parse(args.user ?? 'false') === true) : qr.executeOnUser;
        qr.executeOnAi = args.bot !== undefined ? (JSON.parse(args.bot ?? 'false') === true) : qr.executeOnAi;
        qr.executeOnChatChange = args.load !== undefined ? (JSON.parse(args.load ?? 'false') === true) : qr.executeOnChatChange;
        qr.onUpdate();
    }
    deleteQuickReply(args, label) {
        const qr = this.getQrByLabel(args.set, args.label ?? label);
        if (!qr) return;
        qr.delete();
    }


    createContextItem(args, name) {
        const qr = this.getQrByLabel(args.set, args.label);
        const set = this.getSetByName(name);
        if (!qr || !set) return;
        const cl = new QuickReplyContextLink();
        cl.set = set;
        cl.isChained = JSON.parse(args.chain ?? 'false') ?? false;
        qr.addContextLink(cl);
    }
    deleteContextItem(args, name) {
        const qr = this.getQrByLabel(args.set, args.label);
        const set = this.getSetByName(name);
        if (!qr || !set) return;
        qr.removeContextLink(set.name);
    }
    clearContextMenu(args, label) {
        const qr = this.getQrByLabel(args.set, args.label ?? label);
        if (!qr) return;
        qr.clearContextLinks();
    }


    createSet(name, args) {
        const set = new QuickReplySet();
        set.name = args.name ?? name;
        set.disableSend = JSON.parse(args.nosend ?? 'false') === true;
        set.placeBeforeInput = JSON.parse(args.before ?? 'false') === true;
        set.injectInput = JSON.parse(args.inject ?? 'false') === true;
        QuickReplySet.list.push(set);
        set.save();
        //TODO settings UI must be updated
    }
    updateSet(name, args) {
        const set = this.getSetByName(args.name ?? name);
        if (!set) return;
        set.disableSend = args.nosend !== undefined ? (JSON.parse(args.nosend ?? 'false') === true) : set.disableSend;
        set.placeBeforeInput = args.before !== undefined ? (JSON.parse(args.before ?? 'false') === true) : set.placeBeforeInput;
        set.injectInput = args.inject !== undefined ? (JSON.parse(args.inject ?? 'false') === true) : set.injectInput;
        set.save();
        //TODO settings UI must be updated
    }
}
