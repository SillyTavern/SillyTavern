import { QuickReplySet } from './QuickReplySet.js';

export class QuickReplyLink {
    /**@type {QuickReplySet}*/ set;
    /**@type {Boolean}*/ isVisible = true;




    static from(props) {
        props.set = QuickReplySet.get(props.set);
        return Object.assign(new this(), props);
    }




    toJSON() {
        return {
            set: this.set.name,
            isVisible: this.isVisible,
        };
    }
}
