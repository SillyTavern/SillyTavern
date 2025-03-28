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


    async handleStartup() {
        if (!this.checkExecute()) return;
        const qrList = [
            ...this.settings.config.setList.map(link=>link.set.qrList.filter(qr=>qr.executeOnStartup)).flat(),
            ...(this.settings.chatConfig?.setList?.map(link=>link.set.qrList.filter(qr=>qr.executeOnStartup))?.flat() ?? []),
        ];
        await this.performAutoExecute(qrList);
    }

    async handleUser() {
        if (!this.checkExecute()) return;
        const qrList = [
            ...this.settings.config.setList.map(link=>link.set.qrList.filter(qr=>qr.executeOnUser)).flat(),
            ...(this.settings.chatConfig?.setList?.map(link=>link.set.qrList.filter(qr=>qr.executeOnUser))?.flat() ?? []),
        ];
        await this.performAutoExecute(qrList);
    }

    async handleAi() {
        if (!this.checkExecute()) return;
        const qrList = [
            ...this.settings.config.setList.map(link=>link.set.qrList.filter(qr=>qr.executeOnAi)).flat(),
            ...(this.settings.chatConfig?.setList?.map(link=>link.set.qrList.filter(qr=>qr.executeOnAi))?.flat() ?? []),
        ];
        await this.performAutoExecute(qrList);
    }

    async handleChatChanged() {
        if (!this.checkExecute()) return;
        const qrList = [
            ...this.settings.config.setList.map(link=>link.set.qrList.filter(qr=>qr.executeOnChatChange)).flat(),
            ...(this.settings.chatConfig?.setList?.map(link=>link.set.qrList.filter(qr=>qr.executeOnChatChange))?.flat() ?? []),
        ];
        await this.performAutoExecute(qrList);
    }

    async handleGroupMemberDraft() {
        if (!this.checkExecute()) return;
        const qrList = [
            ...this.settings.config.setList.map(link=>link.set.qrList.filter(qr=>qr.executeOnGroupMemberDraft)).flat(),
            ...(this.settings.chatConfig?.setList?.map(link=>link.set.qrList.filter(qr=>qr.executeOnGroupMemberDraft))?.flat() ?? []),
        ];
        await this.performAutoExecute(qrList);
    }

    async handleNewChat() {
        if (!this.checkExecute()) return;
        const qrList = [
            ...this.settings.config.setList.map(link=>link.set.qrList.filter(qr=>qr.executeOnNewChat)).flat(),
            ...(this.settings.chatConfig?.setList?.map(link=>link.set.qrList.filter(qr=>qr.executeOnNewChat))?.flat() ?? []),
        ];
        await this.performAutoExecute(qrList);
    }

    /**
     * @param {any[]} entries Set of activated entries
     */
    async handleWIActivation(entries) {
        if (!this.checkExecute() || !Array.isArray(entries) || entries.length === 0) return;
        const automationIds = entries.map(entry => entry.automationId).filter(Boolean);
        if (automationIds.length === 0) return;

        const qrList = [
            ...this.settings.config.setList.map(link=>link.set.qrList.filter(qr=>qr.automationId && automationIds.includes(qr.automationId))).flat(),
            ...(this.settings.chatConfig?.setList?.map(link=>link.set.qrList.filter(qr=>qr.automationId && automationIds.includes(qr.automationId)))?.flat() ?? []),
        ];

        await this.performAutoExecute(qrList);
    }
}
