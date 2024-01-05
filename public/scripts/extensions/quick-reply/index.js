import { chat_metadata, eventSource, event_types, getRequestHeaders } from '../../../script.js';
import { extension_settings } from '../../extensions.js';
import { QuickReplyApi } from './api/QuickReplyApi.js';
import { AutoExecuteHandler } from './src/AutoExecuteHandler.js';
import { QuickReply } from './src/QuickReply.js';
import { QuickReplyConfig } from './src/QuickReplyConfig.js';
import { QuickReplySet } from './src/QuickReplySet.js';
import { QuickReplySettings } from './src/QuickReplySettings.js';
import { SlashCommandHandler } from './src/SlashCommandHandler.js';
import { ButtonUi } from './src/ui/ButtonUi.js';
import { SettingsUi } from './src/ui/SettingsUi.js';




const _VERBOSE = true;
export const log = (...msg) => _VERBOSE ? console.log('[QR2]', ...msg) : null;
export const warn = (...msg) => _VERBOSE ? console.warn('[QR2]', ...msg) : null;
/**
 * Creates a debounced function that delays invoking func until after wait milliseconds have elapsed since the last time the debounced function was invoked.
 * @param {Function} func The function to debounce.
 * @param {Number} [timeout=300] The timeout in milliseconds.
 * @returns {Function} The debounced function.
 */
export function debounceAsync(func, timeout = 300) {
    let timer;
    /**@type {Promise}*/
    let debouncePromise;
    /**@type {Function}*/
    let debounceResolver;
    return (...args) => {
        clearTimeout(timer);
        if (!debouncePromise) {
            debouncePromise = new Promise(resolve => {
                debounceResolver = resolve;
            });
        }
        timer = setTimeout(() => {
            debounceResolver(func.apply(this, args));
            debouncePromise = null;
        }, timeout);
        return debouncePromise;
    };
}


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
    } catch (ex) {
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

    window['executeQuickReplyByName'] = async(name, args = {}) => {
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
            return await qr.execute(args);
        }
    };

    quickReplyApi = new QuickReplyApi(settings, manager);
    const slash = new SlashCommandHandler(quickReplyApi);
    slash.init();
    autoExec = new AutoExecuteHandler(settings);

    autoExec.handleStartup();
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

    autoExec.handleChatChanged();
};
eventSource.on(event_types.CHAT_CHANGED, onChatChanged);

const onUserMessage = async () => {
    autoExec.handleUser();
};
eventSource.on(event_types.USER_MESSAGE_RENDERED, onUserMessage);

const onAiMessage = async () => {
    autoExec.handleAi();
};
eventSource.on(event_types.CHARACTER_MESSAGE_RENDERED, onAiMessage);
