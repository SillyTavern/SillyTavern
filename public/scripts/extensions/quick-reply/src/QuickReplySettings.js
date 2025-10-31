import { chat_metadata, saveSettingsDebounced } from '../../../../script.js';
import { extension_settings, saveMetadataDebounced } from '../../../extensions.js';
import { QuickReplyConfig } from './QuickReplyConfig.js';

export class QuickReplySettings {
    static from(props) {
        props.config = QuickReplyConfig.from(props.config);
        props.characterConfigs = props.characterConfigs ?? {};
        for (const key of Object.keys(props.characterConfigs)) {
            props.characterConfigs[key] = QuickReplyConfig.from(props.characterConfigs[key]);
        }
        const instance = Object.assign(new this(), props);
        instance.init();
        return instance;
    }




    /**@type {Boolean}*/ isEnabled = false;
    /**@type {Boolean}*/ isCombined = false;
    /**@type {Boolean}*/ isPopout = false;
    /**@type {Boolean}*/ showPopoutButton = true;
    /**@type {QuickReplyConfig}*/ config;
    /**@type {{[key:string]: QuickReplyConfig}}*/ characterConfigs = {};
    /**@type {QuickReplyConfig}*/ _chatConfig;
    /**@type {QuickReplyConfig}*/ _charConfig;
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
    get charConfig() {
        return this._charConfig;
    }
    set charConfig(value) {
        if (this._charConfig != value) {
            this.unhookConfig(this._charConfig);
            this._charConfig = value;
            this.hookConfig(this._charConfig);
        }
    }

    /**@type {Function}*/ onSave;
    /**@type {Function}*/ onRequestEditSet;




    init() {
        this.hookConfig(this.config);
        this.hookConfig(this.chatConfig);
        this.hookConfig(this.charConfig);
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
            saveMetadataDebounced();
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
        const characterConfigs = {};
        for (const key of Object.keys(this.characterConfigs)) {
            if (this.characterConfigs[key]?.setList?.length === 0) {
                continue;
            }
            characterConfigs[key] = this.characterConfigs[key].toJSON();
        }
        return {
            isEnabled: this.isEnabled,
            isCombined: this.isCombined,
            isPopout: this.isPopout,
            showPopoutButton: this.showPopoutButton,
            config: this.config,
            characterConfigs,
        };
    }
}
