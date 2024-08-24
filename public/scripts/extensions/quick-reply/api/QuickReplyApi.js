// eslint-disable-next-line no-unused-vars
import { QuickReply } from '../src/QuickReply.js';
import { QuickReplyContextLink } from '../src/QuickReplyContextLink.js';
import { QuickReplySet } from '../src/QuickReplySet.js';
// eslint-disable-next-line no-unused-vars
import { QuickReplySettings } from '../src/QuickReplySettings.js';
// eslint-disable-next-line no-unused-vars
import { SettingsUi } from '../src/ui/SettingsUi.js';
import { onlyUnique } from '../../../utils.js';

export class QuickReplyApi {
    /**@type {QuickReplySettings}*/ settings;
    /**@type {SettingsUi}*/ settingsUi;




    constructor(/**@type {QuickReplySettings}*/settings, /**@type {SettingsUi}*/settingsUi) {
        this.settings = settings;
        this.settingsUi = settingsUi;
    }




    /**
     * @param {QuickReply} qr
     * @returns {QuickReplySet}
     */
    getSetByQr(qr) {
        return QuickReplySet.list.find(it=>it.qrList.includes(qr));
    }

    /**
     * Finds and returns an existing Quick Reply Set by its name.
     *
     * @param {string} name name of the quick reply set
     * @returns the quick reply set, or undefined if not found
     */
    getSetByName(name) {
        return QuickReplySet.get(name);
    }

    /**
     * Finds and returns an existing Quick Reply by its set's name and its label.
     *
     * @param {string} setName name of the quick reply set
     * @param {string|number} label label or numeric ID of the quick reply
     * @returns the quick reply, or undefined if not found
     */
    getQrByLabel(setName, label) {
        const set = this.getSetByName(setName);
        if (!set) return;
        if (Number.isInteger(label)) return set.qrList.find(it=>it.id == label);
        return set.qrList.find(it=>it.label == label);
    }




    /**
     * Executes a quick reply by its index and returns the result.
     *
     * @param {Number} idx the index (zero-based) of the quick reply to execute
     * @returns the return value of the quick reply, or undefined if not found
     */
    async executeQuickReplyByIndex(idx) {
        const qr = [...this.settings.config.setList, ...(this.settings.chatConfig?.setList ?? [])]
            .map(it=>it.set.qrList)
            .flat()[idx]
        ;
        if (qr) {
            return await qr.onExecute();
        } else {
            throw new Error(`No quick reply at index "${idx}"`);
        }
    }

    /**
     * Executes an existing quick reply.
     *
     * @param {string} setName name of the existing quick reply set
     * @param {string|number} label label of the existing quick reply (text on the button) or its numeric ID
     * @param {object} [args] optional arguments
     * @param {import('../../../slash-commands.js').ExecuteSlashCommandsOptions} [options] optional execution options
     */
    async executeQuickReply(setName, label, args = {}, options = {}) {
        const qr = this.getQrByLabel(setName, label);
        if (!qr) {
            throw new Error(`No quick reply with label "${label}" in set "${setName}" found.`);
        }
        return await qr.execute(args, false, false, options);
    }


    /**
     * Adds or removes a quick reply set to the list of globally active quick reply sets.
     *
     * @param {string} name the name of the set
     * @param {boolean} isVisible whether to show the set's buttons or not
     */
    toggleGlobalSet(name, isVisible = true) {
        const set = this.getSetByName(name);
        if (!set) {
            throw new Error(`No quick reply set with name "${name}" found.`);
        }
        if (this.settings.config.hasSet(set)) {
            this.settings.config.removeSet(set);
        } else {
            this.settings.config.addSet(set, isVisible);
        }
    }

    /**
     * Adds a quick reply set to the list of globally active quick reply sets.
     *
     * @param {string} name the name of the set
     * @param {boolean} isVisible whether to show the set's buttons or not
     */
    addGlobalSet(name, isVisible = true) {
        const set = this.getSetByName(name);
        if (!set) {
            throw new Error(`No quick reply set with name "${name}" found.`);
        }
        this.settings.config.addSet(set, isVisible);
    }

    /**
     * Removes a quick reply set from the list of globally active quick reply sets.
     *
     * @param {string} name the name of the set
     */
    removeGlobalSet(name) {
        const set = this.getSetByName(name);
        if (!set) {
            throw new Error(`No quick reply set with name "${name}" found.`);
        }
        this.settings.config.removeSet(set);
    }


    /**
     * Adds or removes a quick reply set to the list of the current chat's active quick reply sets.
     *
     * @param {string} name the name of the set
     * @param {boolean} isVisible whether to show the set's buttons or not
     */
    toggleChatSet(name, isVisible = true) {
        if (!this.settings.chatConfig) return;
        const set = this.getSetByName(name);
        if (!set) {
            throw new Error(`No quick reply set with name "${name}" found.`);
        }
        if (this.settings.chatConfig.hasSet(set)) {
            this.settings.chatConfig.removeSet(set);
        } else {
            this.settings.chatConfig.addSet(set, isVisible);
        }
    }

    /**
     * Adds a quick reply set to the list of the current chat's active quick reply sets.
     *
     * @param {string} name the name of the set
     * @param {boolean} isVisible whether to show the set's buttons or not
     */
    addChatSet(name, isVisible = true) {
        if (!this.settings.chatConfig) return;
        const set = this.getSetByName(name);
        if (!set) {
            throw new Error(`No quick reply set with name "${name}" found.`);
        }
        this.settings.chatConfig.addSet(set, isVisible);
    }

    /**
     * Removes a quick reply set from the list of the current chat's active quick reply sets.
     *
     * @param {string} name the name of the set
     */
    removeChatSet(name) {
        if (!this.settings.chatConfig) return;
        const set = this.getSetByName(name);
        if (!set) {
            throw new Error(`No quick reply set with name "${name}" found.`);
        }
        this.settings.chatConfig.removeSet(set);
    }


    /**
     * Creates a new quick reply in an existing quick reply set.
     *
     * @param {string} setName name of the quick reply set to insert the new quick reply into
     * @param {string} label label for the new quick reply (text on the button)
     * @param {object} [props]
     * @param {string} [props.icon] the icon to show on the QR button
     * @param {boolean} [props.showLabel] whether to show the label even when an icon is assigned
     * @param {string} [props.message] the message to be sent or slash command to be executed by the new quick reply
     * @param {string} [props.title] the title / tooltip to be shown on the quick reply button
     * @param {boolean} [props.isHidden] whether to hide or show the button
     * @param {boolean} [props.executeOnStartup] whether to execute the quick reply when SillyTavern starts
     * @param {boolean} [props.executeOnUser] whether to execute the quick reply after a user has sent a message
     * @param {boolean} [props.executeOnAi] whether to execute the quick reply after the AI has sent a message
     * @param {boolean} [props.executeOnChatChange] whether to execute the quick reply when a new chat is loaded
     * @param {boolean} [props.executeOnGroupMemberDraft] whether to execute the quick reply when a group member is selected
     * @param {boolean} [props.executeOnNewChat] whether to execute the quick reply when a new chat is created
     * @param {string} [props.automationId] when not empty, the quick reply will be executed when the WI with the given automation ID is activated
     * @returns {QuickReply} the new quick reply
     */
    createQuickReply(setName, label, {
        icon,
        showLabel,
        message,
        title,
        isHidden,
        executeOnStartup,
        executeOnUser,
        executeOnAi,
        executeOnChatChange,
        executeOnGroupMemberDraft,
        executeOnNewChat,
        automationId,
    } = {}) {
        const set = this.getSetByName(setName);
        if (!set) {
            throw new Error(`No quick reply set with named "${setName}" found.`);
        }
        const qr = set.addQuickReply();
        qr.label = label ?? '';
        qr.icon = icon ??  '';
        qr.showLabel = showLabel ?? false;
        qr.message = message ?? '';
        qr.title = title ?? '';
        qr.isHidden = isHidden ?? false;
        qr.executeOnStartup = executeOnStartup ?? false;
        qr.executeOnUser = executeOnUser ?? false;
        qr.executeOnAi = executeOnAi ?? false;
        qr.executeOnChatChange = executeOnChatChange ?? false;
        qr.executeOnGroupMemberDraft = executeOnGroupMemberDraft ?? false;
        qr.executeOnNewChat = executeOnNewChat ?? false;
        qr.automationId = automationId ?? '';
        qr.onUpdate();
        return qr;
    }

    /**
     * Updates an existing quick reply.
     *
     * @param {string} setName name of the existing quick reply set
     * @param {string|number} label label of the existing quick reply (text on the button) or its numeric ID
     * @param {object} [props]
     * @param {string} [props.icon] the icon to show on the QR button
     * @param {boolean} [props.showLabel] whether to show the label even when an icon is assigned
     * @param {string} [props.newLabel] new label for quick reply (text on the button)
     * @param {string} [props.message] the message to be sent or slash command to be executed by the quick reply
     * @param {string} [props.title] the title / tooltip to be shown on the quick reply button
     * @param {boolean} [props.isHidden] whether to hide or show the button
     * @param {boolean} [props.executeOnStartup] whether to execute the quick reply when SillyTavern starts
     * @param {boolean} [props.executeOnUser] whether to execute the quick reply after a user has sent a message
     * @param {boolean} [props.executeOnAi] whether to execute the quick reply after the AI has sent a message
     * @param {boolean} [props.executeOnChatChange] whether to execute the quick reply when a new chat is loaded
     * @param {boolean} [props.executeOnGroupMemberDraft] whether to execute the quick reply when a group member is selected
     * @param {boolean} [props.executeOnNewChat] whether to execute the quick reply when a new chat is created
     * @param {string} [props.automationId] when not empty, the quick reply will be executed when the WI with the given automation ID is activated
     * @returns {QuickReply} the altered quick reply
     */
    updateQuickReply(setName, label, {
        icon,
        showLabel,
        newLabel,
        message,
        title,
        isHidden,
        executeOnStartup,
        executeOnUser,
        executeOnAi,
        executeOnChatChange,
        executeOnGroupMemberDraft,
        executeOnNewChat,
        automationId,
    } = {}) {
        const qr = this.getQrByLabel(setName, label);
        if (!qr) {
            throw new Error(`No quick reply with label "${label}" in set "${setName}" found.`);
        }
        qr.updateIcon(icon ?? qr.icon);
        qr.updateShowLabel(showLabel ?? qr.showLabel);
        qr.updateLabel(newLabel ?? qr.label);
        qr.updateMessage(message ?? qr.message);
        qr.updateTitle(title ?? qr.title);
        qr.isHidden = isHidden ?? qr.isHidden;
        qr.executeOnStartup = executeOnStartup ?? qr.executeOnStartup;
        qr.executeOnUser = executeOnUser ?? qr.executeOnUser;
        qr.executeOnAi = executeOnAi ?? qr.executeOnAi;
        qr.executeOnChatChange = executeOnChatChange ?? qr.executeOnChatChange;
        qr.executeOnGroupMemberDraft = executeOnGroupMemberDraft ?? qr.executeOnGroupMemberDraft;
        qr.executeOnNewChat = executeOnNewChat ?? qr.executeOnNewChat;
        qr.automationId = automationId ?? qr.automationId;
        qr.onUpdate();
        return qr;
    }

    /**
     * Deletes an existing quick reply.
     *
     * @param {string} setName name of the existing quick reply set
     * @param {string|number} label label of the existing quick reply (text on the button) or its numeric ID
     */
    deleteQuickReply(setName, label) {
        const qr = this.getQrByLabel(setName, label);
        if (!qr) {
            throw new Error(`No quick reply with label "${label}" in set "${setName}" found.`);
        }
        qr.delete();
    }


    /**
     * Adds an existing quick reply set as a context menu to an existing quick reply.
     *
     * @param {string} setName name of the existing quick reply set containing the quick reply
     * @param {string|number} label label of the existing quick reply or its numeric ID
     * @param {string} contextSetName name of the existing quick reply set to be used as a context menu
     * @param {boolean} isChained whether or not to chain the context menu quick replies
     */
    createContextItem(setName, label, contextSetName, isChained = false) {
        const qr = this.getQrByLabel(setName, label);
        const set = this.getSetByName(contextSetName);
        if (!qr) {
            throw new Error(`No quick reply with label "${label}" in set "${setName}" found.`);
        }
        if (!set) {
            throw new Error(`No quick reply set with name "${contextSetName}" found.`);
        }
        const cl = new QuickReplyContextLink();
        cl.set = set;
        cl.isChained = isChained;
        qr.addContextLink(cl);
    }

    /**
     * Removes a quick reply set from a quick reply's context menu.
     *
     * @param {string} setName name of the existing quick reply set containing the quick reply
     * @param {string|number} label label of the existing quick reply or its numeric ID
     * @param {string} contextSetName name of the existing quick reply set to be used as a context menu
     */
    deleteContextItem(setName, label, contextSetName) {
        const qr = this.getQrByLabel(setName, label);
        const set = this.getSetByName(contextSetName);
        if (!qr) {
            throw new Error(`No quick reply with label "${label}" in set "${setName}" found.`);
        }
        if (!set) {
            throw new Error(`No quick reply set with name "${contextSetName}" found.`);
        }
        qr.removeContextLink(set.name);
    }

    /**
     * Removes all entries from a quick reply's context menu.
     *
     * @param {string} setName name of the existing quick reply set containing the quick reply
     * @param {string|number} label label of the existing quick reply or its numeric ID
     */
    clearContextMenu(setName, label) {
        const qr = this.getQrByLabel(setName, label);
        if (!qr) {
            throw new Error(`No quick reply with label "${label}" in set "${setName}" found.`);
        }
        qr.clearContextLinks();
    }


    /**
     * Create a new quick reply set.
     *
     * @param {string} name name of the new quick reply set
     * @param {object} [props]
     * @param {boolean} [props.disableSend] whether or not to send the quick replies or put the message or slash command into the char input box
     * @param {boolean} [props.placeBeforeInput] whether or not to place the quick reply contents before the existing user input
     * @param {boolean} [props.injectInput] whether or not to automatically inject the user input at the end of the quick reply
     * @returns {Promise<QuickReplySet>} the new quick reply set
     */
    async createSet(name, {
        disableSend,
        placeBeforeInput,
        injectInput,
    } = {}) {
        const set = new QuickReplySet();
        set.name = name;
        set.disableSend = disableSend ?? false;
        set.placeBeforeInput = placeBeforeInput ?? false;
        set.injectInput = injectInput ?? false;
        const oldSet = this.getSetByName(name);
        if (oldSet) {
            QuickReplySet.list.splice(QuickReplySet.list.indexOf(oldSet), 1, set);
        } else {
            const idx = QuickReplySet.list.findIndex(it=>it.name.localeCompare(name) == 1);
            if (idx > -1) {
                QuickReplySet.list.splice(idx, 0, set);
            } else {
                QuickReplySet.list.push(set);
            }
        }
        await set.save();
        this.settingsUi.rerender();
        return set;
    }

    /**
     * Update an existing quick reply set.
     *
     * @param {string} name name of the existing quick reply set
     * @param {object} [props]
     * @param {boolean} [props.disableSend] whether or not to send the quick replies or put the message or slash command into the char input box
     * @param {boolean} [props.placeBeforeInput] whether or not to place the quick reply contents before the existing user input
     * @param {boolean} [props.injectInput] whether or not to automatically inject the user input at the end of the quick reply
     * @returns {Promise<QuickReplySet>} the altered quick reply set
     */
    async updateSet(name, {
        disableSend,
        placeBeforeInput,
        injectInput,
    } = {}) {
        const set = this.getSetByName(name);
        if (!set) {
            throw new Error(`No quick reply set with name "${name}" found.`);
        }
        set.disableSend = disableSend ?? false;
        set.placeBeforeInput = placeBeforeInput ?? false;
        set.injectInput = injectInput ?? false;
        await set.save();
        this.settingsUi.rerender();
        return set;
    }

    /**
     * Delete an existing quick reply set.
     *
     * @param {string} name name of the existing quick reply set
     */
    async deleteSet(name) {
        const set  = this.getSetByName(name);
        if (!set) {
            throw new Error(`No quick reply set with name "${name}" found.`);
        }
        await set.delete();
        this.settingsUi.rerender();
    }


    /**
     * Gets a list of all quick reply sets.
     *
     * @returns array with the names of all quick reply sets
     */
    listSets() {
        return QuickReplySet.list.map(it=>it.name);
    }
    /**
     * Gets a list of all globally active quick reply sets.
     *
     * @returns array with the names of all quick reply sets
     */
    listGlobalSets() {
        return this.settings.config.setList.map(it=>it.set.name);
    }
    /**
     * Gets a list of all quick reply sets activated by the current chat.
     *
     * @returns array with the names of all quick reply sets
     */
    listChatSets() {
        return this.settings.chatConfig?.setList?.flatMap(it=>it.set.name) ?? [];
    }

    /**
     * Gets a list of all quick replies in the quick reply set.
     *
     * @param {string} setName name of the existing quick reply set
     * @returns array with the labels of this set's quick replies
     */
    listQuickReplies(setName) {
        const set = this.getSetByName(setName);
        if (!set) {
            throw new Error(`No quick reply set with name "${name}" found.`);
        }
        return set.qrList.map(it=>it.label);
    }

    /**
     * Gets a list of all Automation IDs used by quick replies.
     *
     * @returns {String[]} array with all automation IDs used by quick replies
     */
    listAutomationIds() {
        return this
            .listSets()
            .flatMap(it => ({ set: it, qrs: this.listQuickReplies(it) }))
            .map(it => it.qrs?.map(qr => this.getQrByLabel(it.set, qr)?.automationId))
            .flat()
            .filter(Boolean)
            .filter(onlyUnique)
            .map(String);
    }
}
