import { chat_metadata, eventSource, event_types, getRequestHeaders } from '../../../script.js';
import { extension_settings } from '../../extensions.js';
import { QuickReply } from './src/QuickReply.js';
import { QuickReplyConfig } from './src/QuickReplyConfig.js';
import { QuickReplyContextLink } from './src/QuickReplyContextLink.js';
import { QuickReplySet } from './src/QuickReplySet.js';
import { QuickReplySettings } from './src/QuickReplySettings.js';
import { ButtonUi } from './src/ui/ButtonUi.js';
import { SettingsUi } from './src/ui/SettingsUi.js';




//TODO popout QR button bar (allow separate popouts for each QR set?)
//TODO move advanced QR options into own UI class
//TODO slash commands
//TODO easy way to CRUD QRs and sets
//TODO easy way to set global and chat sets




const _VERBOSE = true;
export const log = (...msg) => _VERBOSE ? console.log('[QR2]', ...msg) : null;
export const warn = (...msg) => _VERBOSE ? console.warn('[QR2]', ...msg) : null;


const defaultConfig = {
    setList: [{
        set: 'Default',
        isVisible: true,
    }],
};

const defaultSettings = {
    isEnabled: true,
    isCombined: false,
    config: defaultConfig,
};


/** @type {QuickReplySettings}*/
let settings;
/** @type {SettingsUi} */
let manager;
/** @type {ButtonUi} */
let buttons;




const loadSets = async () => {
    const response = await fetch('/api/settings/get', {
        method: 'POST',
        headers: getRequestHeaders(),
        body: JSON.stringify({}),
    });

    if (response.ok) {
        const setList = (await response.json()).quickReplyPresets ?? [];
        for (const set of setList) {
            if (set.version == 2) {
                QuickReplySet.list.push(QuickReplySet.from(JSON.parse(JSON.stringify(set))));
            } else {
                const qrs = new QuickReplySet();
                qrs.name = set.name;
                qrs.disableSend = set.quickActionEnabled ?? false;
                qrs.placeBeforeInput = set.placeBeforeInputEnabled ?? false;
                qrs.injectInput = set.AutoInputInject ?? false;
                qrs.qrList = set.quickReplySlots.map((slot,idx)=>{
                    const qr = new QuickReply();
                    qr.id = idx + 1;
                    qr.label = slot.label;
                    qr.title = slot.title;
                    qr.message = slot.mes;
                    qr.isHidden = slot.hidden ?? false;
                    qr.executeOnStartup = slot.autoExecute_appStartup ?? false;
                    qr.executeOnUser = slot.autoExecute_userMessage ?? false;
                    qr.executeOnAi = slot.autoExecute_botMessage ?? false;
                    qr.executeOnChatChange = slot.autoExecute_chatLoad ?? false;
                    qr.contextList = (slot.contextMenu ?? []).map(it=>(QuickReplyContextLink.from({
                        set: it.preset,
                        isChained: it.chain,
                    })));
                    return qr;
                });
                QuickReplySet.list.push(qrs);
                await qrs.save();
            }
        }
        setList.forEach((set, idx)=>{
            QuickReplySet.list[idx].qrList = set.qrList.map(it=>QuickReply.from(it));
            QuickReplySet.list[idx].init();
        });
        log('sets: ', QuickReplySet.list);
    }
};

const loadSettings = async () => {
    //TODO migrate old settings
    if (!extension_settings.quickReplyV2) {
        extension_settings.quickReplyV2 = defaultSettings;
    }
    try {
        settings = QuickReplySettings.from(extension_settings.quickReplyV2);
    } catch (ex) {
        debugger;
        settings = QuickReplySettings.from(defaultSettings);
    }
};




const init = async () => {
    await loadSets();
    await loadSettings();
    log('settings: ', settings);

    manager = new SettingsUi(settings);
    document.querySelector('#extensions_settings2').append(await manager.render());

    buttons = new ButtonUi(settings);
    buttons.show();
    settings.onSave = ()=>buttons.refresh();

    window['executeQuickReplyByName'] = async(name) => {
        let qr = [...settings.config.setList, ...(settings.chatConfig?.setList ?? [])]
            .map(it=>it.set.qrList)
            .flat()
            .find(it=>it.label == name)
            ;
        if (!qr) {
            let [setName, ...qrName] = name.split('.');
            name = qrName.join('.');
            let qrs = QuickReplySet.get(setName);
            if (qrs) {
                qr = qrs.qrList.find(it=>it.label == name);
            }
        }
        if (qr && qr.onExecute) {
            return await qr.onExecute();
        }
    };

    if (settings.isEnabled) {
        const qrList = [
            ...settings.config.setList.map(link=>link.set.qrList.filter(qr=>qr.executeOnStartup)).flat(),
            ...(settings.chatConfig?.setList?.map(link=>link.set.qrList.filter(qr=>qr.executeOnStartup))?.flat() ?? []),
        ];
        for (const qr of qrList) {
            await qr.onExecute();
        }
    }
};
eventSource.on(event_types.APP_READY, init);

const onChatChanged = async (chatIdx) => {
    log('CHAT_CHANGED', chatIdx);
    if (chatIdx) {
        settings.chatConfig = QuickReplyConfig.from(chat_metadata.quickReply ?? {});
    } else {
        settings.chatConfig = null;
    }
    manager.rerender();
    buttons.refresh();

    if (settings.isEnabled) {
        const qrList = [
            ...settings.config.setList.map(link=>link.set.qrList.filter(qr=>qr.executeOnChatChange)).flat(),
            ...(settings.chatConfig?.setList?.map(link=>link.set.qrList.filter(qr=>qr.executeOnChatChange))?.flat() ?? []),
        ];
        for (const qr of qrList) {
            await qr.onExecute();
        }
    }
};
eventSource.on(event_types.CHAT_CHANGED, onChatChanged);

const onUserMessage = async () => {
    if (settings.isEnabled) {
        const qrList = [
            ...settings.config.setList.map(link=>link.set.qrList.filter(qr=>qr.executeOnUser)).flat(),
            ...(settings.chatConfig?.setList?.map(link=>link.set.qrList.filter(qr=>qr.executeOnUser))?.flat() ?? []),
        ];
        for (const qr of qrList) {
            await qr.onExecute();
        }
    }
};
eventSource.on(event_types.USER_MESSAGE_RENDERED, onUserMessage);

const onAiMessage = async () => {
    if (settings.isEnabled) {
        const qrList = [
            ...settings.config.setList.map(link=>link.set.qrList.filter(qr=>qr.executeOnAi)).flat(),
            ...(settings.chatConfig?.setList?.map(link=>link.set.qrList.filter(qr=>qr.executeOnAi))?.flat() ?? []),
        ];
        for (const qr of qrList) {
            await qr.onExecute();
        }
    }
};
eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, onAiMessage);
