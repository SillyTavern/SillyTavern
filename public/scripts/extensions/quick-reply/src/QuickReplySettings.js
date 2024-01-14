import { chat_metadata, saveChatDebounced, saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';
import { QuickReplyConfig } from './QuickReplyConfig.js';

export class QuickReplySettings {
    static from(props) {
        props.config = QuickReplyConfig.from(props.config);
        const instance = Object.assign(new this(), props);
        instance.init();
        return instance;
    }




    /**@type {Boolean}*/ isEnabled = false;
    /**@type {Boolean}*/ isCombined = false;
    /**@type {Boolean}*/ isPopout = false;
    /**@type {QuickReplyConfig}*/ config;
    /**@type {QuickReplyConfig}*/ _chatConfig;
    get chatConfig() {
        return this._chatConfig;
    }
    set chatConfig(value) {
        if (this._chatConfig != value) {
            this.unhookConfig(this._chatConfig);
            this._chatConfig = value;
            this.hookConfig(this._chatConfig);
        }
    }

    /**@type {Function}*/ onSave;
    /**@type {Function}*/ onRequestEditSet;




    init() {
        this.hookConfig(this.config);
        this.hookConfig(this.chatConfig);
    }

    hookConfig(config) {
        if (config) {
            config.onUpdate = ()=>this.save();
            config.onRequestEditSet = (qrs)=>this.requestEditSet(qrs);
        }
    }
    unhookConfig(config) {
        if (config) {
            config.onUpdate = null;
            config.onRequestEditSet = null;
        }
    }




    save() {
        extension_settings.quickReplyV2 = this.toJSON();
        saveSettingsDebounced();
        if (this.chatConfig) {
            chat_metadata.quickReply = this.chatConfig.toJSON();
            saveChatDebounced();
        }
        if (this.onSave) {
            this.onSave();
        }
    }

    requestEditSet(qrs) {
        if (this.onRequestEditSet) {
            this.onRequestEditSet(qrs);
        }
    }

    toJSON() {
        return {
            isEnabled: this.isEnabled,
            isCombined: this.isCombined,
            isPopout: this.isPopout,
            config: this.config,
        };
    }
}
