import { chat_metadata, saveChatDebounced, saveSettingsDebounced } from '../../../../script.js';
import { extension_settings } from '../../../extensions.js';
import { QuickReplyConfig } from './QuickReplyConfig.js';

export class QuickReplySettings {
    static from(props) {
        props.config = QuickReplyConfig.from(props.config);
        return Object.assign(new this(), props);
    }




    /**@type {Boolean}*/ isEnabled = false;
    /**@type {Boolean}*/ isCombined = false;
    /**@type {QuickReplyConfig}*/ config;
    /**@type {QuickReplyConfig}*/ chatConfig;

    /**@type {Function}*/ onSave;




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

    toJSON() {
        return {
            isEnabled: this.isEnabled,
            config: this.config,
        };
    }
}
