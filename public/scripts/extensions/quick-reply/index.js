import { chat, chat_metadata, eventSource, event_types, getRequestHeaders, characters, this_chid, saveSettingsDebounced, reloadCurrentChat } from '../../../script.js';
import { extension_settings, writeExtensionField } from '../../extensions.js';
import { Popup, POPUP_RESULT } from '../../popup.js';
import { QuickReplyApi } from './api/QuickReplyApi.js';
import { AutoExecuteHandler } from './src/AutoExecuteHandler.js';
import { QuickReply } from './src/QuickReply.js';
import { QuickReplyConfig } from './src/QuickReplyConfig.js';
import { QuickReplySet } from './src/QuickReplySet.js';
import { QuickReplySettings } from './src/QuickReplySettings.js';
import { SlashCommandHandler } from './src/SlashCommandHandler.js';
import { ButtonUi } from './src/ui/ButtonUi.js';
import { SettingsUi } from './src/ui/SettingsUi.js';
import { debounceAsync } from '../../utils.js';
export { debounceAsync };




const _VERBOSE = true;
export const debug = (...msg) => _VERBOSE ? console.debug('[QR2]', ...msg) : null;
export const log = (...msg) => _VERBOSE ? console.log('[QR2]', ...msg) : null;
export const warn = (...msg) => _VERBOSE ? console.warn('[QR2]', ...msg) : null;


const defaultConfig = {
    setList: [{
        set: 'Default',
        isVisible: true,
    }],
};

const defaultSettings = {
    isEnabled: false,
    isCombined: false,
    config: defaultConfig,
};


/** @type {Boolean}*/
let isReady = false;
/** @type {Function[]}*/
let executeQueue = [];
/** @type {string}*/
let lastCharId;
/** @type {QuickReplySettings}*/
let settings;
/** @type {SettingsUi} */
let manager;
/** @type {ButtonUi} */
let buttons;
/** @type {AutoExecuteHandler} */
let autoExec;
/** @type {QuickReplyApi} */
export let quickReplyApi;
const overwrittenGlobalSets = new Map();
/** A counter to prevent re-entrant, overlapping executions of onChatChanged */
let changeId = 0;




const loadSets = async () => {
    const response = await fetch('/api/settings/get', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({}),
    });

    if (response.ok) {
        const setList = (await response.json()).quickReplyPresets ?? [];
        for (const set of setList) {
            if (set.version !== 2) {
                // migrate old QR set
                set.version = 2;
                set.disableSend = set.quickActionEnabled ?? false;
                set.placeBeforeInput = set.placeBeforeInputEnabled ?? false;
                set.injectInput = set.AutoInputInject ?? false;
                set.qrList = set.quickReplySlots.map((slot,idx)=>{
                    const qr = {};
                    qr.id = idx + 1;
                    qr.label = slot.label ?? '';
                    qr.title = slot.title ?? '';
                    qr.message = slot.mes ?? '';
                    qr.isHidden = slot.hidden ?? false;
                    qr.executeOnStartup = slot.autoExecute_appStartup ?? false;
                    qr.executeOnUser = slot.autoExecute_userMessage ?? false;
                    qr.executeOnAi = slot.autoExecute_botMessage ?? false;
                    qr.executeOnChatChange = slot.autoExecute_chatLoad ?? false;
                    qr.executeOnGroupMemberDraft = slot.autoExecute_groupMemberDraft ?? false;
                    qr.executeOnNewChat = slot.autoExecute_newChat ?? false;
                    qr.automationId = slot.automationId ?? '';
                    qr.contextList = (slot.contextMenu ?? []).map(it=>({
                        set: it.preset,
                        isChained: it.chain,
                    }));
                    return qr;
                });
            }
            if (set.version == 2) {
                QuickReplySet.list.push(QuickReplySet.from(JSON.parse(JSON.stringify(set))));
            }
        }
        // need to load QR lists after all sets are loaded to be able to resolve context menu entries
        setList.forEach((set, idx)=>{
            QuickReplySet.list[idx].qrList = set.qrList.map(it=>QuickReply.from(it));
            QuickReplySet.list[idx].init();
        });
        log('sets: ', QuickReplySet.list);
    }
};

const loadSettings = async () => {
    if (!extension_settings.quickReplyV2) {
        if (!extension_settings.quickReply) {
            extension_settings.quickReplyV2 = defaultSettings;
        } else {
            extension_settings.quickReplyV2 = {
                isEnabled: extension_settings.quickReply.quickReplyEnabled ?? false,
                isCombined: false,
                isPopout: false,
                config: {
                    setList: [{
                        set: extension_settings.quickReply.selectedPreset ?? extension_settings.quickReply.name ?? 'Default',
                        isVisible: true,
                    }],
                },
            };
        }
    }
    try {
        settings = QuickReplySettings.from(extension_settings.quickReplyV2);
       settings.config.scope = 'global';
       settings.config.onSave = () => settings.save();
    } catch (ex) {
        settings = QuickReplySettings.from(defaultSettings);
    }
};

const executeIfReadyElseQueue = async (functionToCall, args) => {
    if (isReady) {
        log('calling', { functionToCall, args });
        await functionToCall(...args);
    } else {
        log('queueing', { functionToCall, args });
        executeQueue.push(async()=>await functionToCall(...args));
    }
};




const saveScopedSets = debounceAsync(async () => {
    if (!this_chid) return;
    const char = characters[this_chid];
    if (!char) return;

    if (!settings.charConfig) return;

    const newData = settings.charConfig.setList.map(link => {
        const setData = link.set.toJSON();
        // Manually add isVisible to the saved data, as it's part of the link, not the set itself.
        setData.isVisible = link.isVisible;
        return setData;
    });

    const oldData = char.data?.extensions?.quickReply_sets ?? [];

    // Deep compare old and new data. Only save if different to prevent loops.
    if (JSON.stringify(oldData) === JSON.stringify(newData)) {
        return;
    }

    await writeExtensionField(this_chid, 'quickReply_sets', newData);
    log('Scoped sets saved to character card.');

    // Refresh the UI to reflect the changes immediately.
    buttons.refresh();
    manager.rerender();
});




const onCharChanged = async () => {
    if (lastCharId === this_chid) return false;

    // Phase 1: Unload the old character's sets and restore any overwritten global sets.
    const oldCharConfig = settings.charConfig;
    if (oldCharConfig) {
        for (const link of oldCharConfig.setList) {
            const setToUnload = link.set;
            if (!setToUnload || setToUnload.scope !== 'character') continue;

            const listIndex = QuickReplySet.list.indexOf(setToUnload);
            if (listIndex === -1) continue;

            if (overwrittenGlobalSets.has(setToUnload.name)) {
                QuickReplySet.list[listIndex] = overwrittenGlobalSets.get(setToUnload.name);
                overwrittenGlobalSets.delete(setToUnload.name);
            } else {
                QuickReplySet.list.splice(listIndex, 1);
            }
        }
    }
    overwrittenGlobalSets.clear(); // Clear any leftovers.

    // Phase 2: Load the new character's sets.
    lastCharId = this_chid;
    settings.charConfig = null;

    if (!this_chid) {
        buttons.refresh();
        manager.rerender();
        return false;
    }

    const char = characters[this_chid];
    const embeddedSetsData = char.data?.extensions?.quickReply_sets ?? [];

    // If there are no sets, configure empty and exit.
    if (!embeddedSetsData || embeddedSetsData.length === 0) {
        settings.charConfig = QuickReplyConfig.from({ setList: [], scope: 'character', onSave: saveScopedSets });
        buttons.refresh();
        manager.rerender();
        return false;
    }

    // If there are sets, check for authorization, regex-style.
    const avatar = char?.avatar;
    const allowed = extension_settings.character_allowed_quickreply ?? [];
    if (avatar && !allowed.includes(avatar)) {
        const confirm = await Popup.show.confirm(
            'This character contains embedded Quick Reply sets, but is not authorized to execute them. Do you want to authorize it?',
            'Authorize Quick Replies',
            { okButton: 'Authorize' },
        );

        if (confirm === POPUP_RESULT.AFFIRMATIVE) {
            allowed.push(avatar);
            extension_settings.character_allowed_quickreply = allowed;
            saveSettingsDebounced();
            lastCharId = null; // Force a re-run of the logic after reload
            await reloadCurrentChat(); // Crucial step: reload to apply the new permission state.
            return true; // Stop further execution, as reload will trigger a new onCharChanged.
        } else {
            // User denied permission. Don't load sets.
            settings.charConfig = QuickReplyConfig.from({ setList: [], scope: 'character', onSave: saveScopedSets });
            buttons.refresh();
            manager.rerender();
            return false;
        }
    }


    // Load sets from character data
    for (const qrsData of embeddedSetsData) {
        qrsData.scope = 'character'; // Explicitly mark as a character-scoped set
        const newSet = QuickReplySet.from(qrsData);
        const existingSet = QuickReplySet.get(newSet.name);

        if (existingSet) {
            // It's an overwrite. Store the original global set to restore it later.
            if (existingSet.scope === 'global') {
                overwrittenGlobalSets.set(existingSet.name, existingSet);
            }
            const listIndex = QuickReplySet.list.indexOf(existingSet);
            QuickReplySet.list[listIndex] = newSet;
        } else {
            // It's a new set, just add it to the list.
            QuickReplySet.list.push(newSet);
        }
    }

    const charSetConfig = QuickReplyConfig.from({
        scope: 'character',
        setList: embeddedSetsData.map(qrsData => ({
            set: qrsData.name,
            isVisible: qrsData.isVisible !== false, // Restore visibility
        })),
    });
    charSetConfig.onSave = saveScopedSets;
    settings.charConfig = charSetConfig;

    // The parent onChatChanged will call buttons.refresh() and manager.rerender()
    return false;
};


const init = async () => {
    if (!extension_settings.character_allowed_quickreply) {
        extension_settings.character_allowed_quickreply = [];
    }
    await loadSets();
    await loadSettings();
    log('settings: ', settings);

    manager = new SettingsUi(settings);
    document.querySelector('#qr_container').append(await manager.render());

    buttons = new ButtonUi(settings);
    buttons.show();
    settings.onSave = ()=>buttons.refresh();
   QuickReplySet.onScopedSetSave = () => saveScopedSets();

    window['executeQuickReplyByName'] = async(name, args = {}, options = {}) => {
        let qr = [
           ...(settings.chatConfig?.setList ?? []),
           ...(settings.charConfig?.setList ?? []),
           ...settings.config.setList,
       ]
            .filter(it => it.isVisible)
            .map(it => it.set.qrList)
            .flat()
            .find(it=>it.label == name)
            ;
        if (!qr) {
            let [setName, ...qrName] = name.split('.');
            qrName = qrName.join('.');
            let qrs = QuickReplySet.get(setName);
            if (qrs) {
                qr = qrs.qrList.find(it=>it.label == qrName);
            }
        }
        if (qr && qr.onExecute) {
            return await qr.execute(args, false, true, options);
        } else {
            throw new Error(`No Quick Reply found for "${name}".`);
        }
    };

    quickReplyApi = new QuickReplyApi(settings, manager);
    const slash = new SlashCommandHandler(quickReplyApi);
    slash.init();
    autoExec = new AutoExecuteHandler(settings);

    eventSource.on(event_types.APP_READY, async()=>await finalizeInit());

    globalThis.quickReplyApi = quickReplyApi;
};
const finalizeInit = async () => {
    debug('executing startup');
    await autoExec.handleStartup();
    debug('/executing startup');

    debug(`executing queue (${executeQueue.length} items)`);
    while (executeQueue.length > 0) {
        const func = executeQueue.shift();
        await func();
    }
    debug('/executing queue');
    isReady = true;
    debug('READY');
};
await init();

const purgeEmbeddedQuickReplySets = ({ character }) => {
    const avatar = character?.avatar;

    if (avatar && extension_settings.character_allowed_quickreply?.includes(avatar)) {
        const index = extension_settings.character_allowed_quickreply.indexOf(avatar);
        if (index !== -1) {
            extension_settings.character_allowed_quickreply.splice(index, 1);
            saveSettingsDebounced();
            log(`Removed character avatar ${avatar} from Quick Reply whitelist.`);
        }
    }
};


const onChatChanged = async (chatIdx) => {
    const localChangeId = ++changeId;
    log('CHAT_CHANGED', chatIdx, `ID: ${localChangeId}`);

    // onCharChanged can trigger a reload, which will fire a new CHAT_CHANGED event.
    // We get a signal back to know if we should abort this execution path.
    const didReload = await onCharChanged();

    // If a newer execution has started (changeId changed) or if onCharChanged triggered
    // a reload, this instance is obsolete and should be aborted.
    if (localChangeId !== changeId || didReload) {
        log(`Aborting CHAT_CHANGED ID: ${localChangeId} (current: ${changeId}, reloaded: ${didReload})`);
        return;
    }

    if (chatIdx) {
       const chatConfig = QuickReplyConfig.from(chat_metadata.quickReply ?? {});
       chatConfig.scope = 'chat';
       chatConfig.onSave = () => settings.save();
       settings.chatConfig = chatConfig;
    } else {
        settings.chatConfig = null;
    }
    manager.rerender();
    buttons.refresh();

    await autoExec.handleChatChanged();
};
eventSource.on(event_types.CHAT_CHANGED, (...args)=>executeIfReadyElseQueue(onChatChanged, args));
eventSource.on(event_types.CHARACTER_DELETED, purgeEmbeddedQuickReplySets);

const onUserMessage = async () => {
    await autoExec.handleUser();
};
eventSource.makeFirst(event_types.USER_MESSAGE_RENDERED, (...args)=>executeIfReadyElseQueue(onUserMessage, args));

const onAiMessage = async (messageId) => {
    if (['...'].includes(chat[messageId]?.mes)) {
        log('QR auto-execution suppressed for swiped message');
        return;
    }

    await autoExec.handleAi();
};
eventSource.makeFirst(event_types.CHARACTER_MESSAGE_RENDERED, (...args)=>executeIfReadyElseQueue(onAiMessage, args));

const onGroupMemberDraft = async () => {
    await autoExec.handleGroupMemberDraft();
};
eventSource.on(event_types.GROUP_MEMBER_DRAFTED, (...args) => executeIfReadyElseQueue(onGroupMemberDraft, args));

const onWIActivation = async (entries) => {
    await autoExec.handleWIActivation(entries);
};
eventSource.on(event_types.WORLD_INFO_ACTIVATED, (...args) => executeIfReadyElseQueue(onWIActivation, args));

const onNewChat = async () => {
    await autoExec.handleNewChat();
};
eventSource.on(event_types.CHAT_CREATED, (...args) => executeIfReadyElseQueue(onNewChat, args));

