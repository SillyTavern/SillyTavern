import { warn } from '../index.js';
import { QuickReply } from './QuickReply.js';
import { QuickReplySettings } from './QuickReplySettings.js';

export class AutoExecuteHandler {
    /** @type {QuickReplySettings} */ settings;

    /** @type {Boolean[]}*/ preventAutoExecuteStack = [];




    constructor(/** @type {QuickReplySettings} */settings) {
        this.settings = settings;
    }


    checkExecute() {
        return this.settings.isEnabled && !this.preventAutoExecuteStack.slice(-1)[0];
    }




    async performAutoExecute(/** @type {QuickReply[]} */qrList) {
        for (const qr of qrList) {
            this.preventAutoExecuteStack.push(qr.preventAutoExecute);
            try {
                await qr.execute({ isAutoExecute:true });
            } catch (ex) {
                warn(ex);
            } finally {
                this.preventAutoExecuteStack.pop();
            }
        }
    }


    getCommands(eventName) {
        const getFromConfig = (config) => {
            // This safely handles cases where a link exists but the set hasn't been loaded (link.set is null)
            return config?.setList?.map(link => link.set ? link.set.qrList.filter(qr => qr[eventName]) : [])?.flat() ?? [];
        };
        return [
            ...getFromConfig(this.settings.config),
            ...getFromConfig(this.settings.chatConfig),
            ...getFromConfig(this.settings.charConfig),
        ];
    }

    async handleStartup() {
        if (!this.checkExecute()) return;
        await this.performAutoExecute(this.getCommands('executeOnStartup'));
    }

    async handleUser() {
        if (!this.checkExecute()) return;
        await this.performAutoExecute(this.getCommands('executeOnUser'));
    }

    async handleAi() {
        if (!this.checkExecute()) return;
        await this.performAutoExecute(this.getCommands('executeOnAi'));
    }

    async handleChatChanged() {
        if (!this.checkExecute()) return;
        await this.performAutoExecute(this.getCommands('executeOnChatChange'));
    }

    async handleGroupMemberDraft() {
        if (!this.checkExecute()) return;
        await this.performAutoExecute(this.getCommands('executeOnGroupMemberDraft'));
    }

    async handleNewChat() {
        if (!this.checkExecute()) return;
        await this.performAutoExecute(this.getCommands('executeOnNewChat'));
    }

    async handleBeforeGeneration() {
        if (!this.checkExecute()) return;
        await this.performAutoExecute(this.getCommands('executeBeforeGeneration'));
    }

    /**
     * @param {any[]} entries Set of activated entries
     */
    async handleWIActivation(entries) {
        if (!this.checkExecute() || !Array.isArray(entries) || entries.length === 0) return;
        const automationIds = entries.map(entry => entry.automationId).filter(Boolean);
        if (automationIds.length === 0) return;

        const getFromConfig = (config) => {
            return config?.setList
                ?.map(link => link.set ? link.set.qrList.filter(qr => qr.automationId && automationIds.includes(qr.automationId)) : [])
                ?.flat() ?? [];
        };

        const qrList = [
            ...getFromConfig(this.settings.config),
            ...getFromConfig(this.settings.chatConfig),
            ...getFromConfig(this.settings.charConfig),
        ];

        await this.performAutoExecute(qrList);
    }
}
