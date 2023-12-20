import { QuickReplyLink } from './QuickReplyLink.js';

export class QuickReplyConfig {
    /**@type {QuickReplyLink[]}*/ setList = [];




    static from(props) {
        props.setList = props.setList?.map(it=>QuickReplyLink.from(it)) ?? [];
        return Object.assign(new this(), props);
    }




    toJSON() {
        return {
            setList: this.setList,
        };
    }
}
