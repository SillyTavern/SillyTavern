import { QuickReplySet } from './QuickReplySet.js';

export class QuickReplyContextLink {
    static from(props) {
        props.set = QuickReplySet.get(props.set);
        const x = Object.assign(new this(), props);
        return x;
    }




    /**@type {QuickReplySet}*/ set;
    /**@type {Boolean}*/ isChained = false;

    toJSON() {
        return {
            set: this.set?.name,
            isChained: this.isChained,
        };
    }
}
